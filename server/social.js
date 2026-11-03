// Friends and the global leaderboard. Every browser connects once with a
// secret random id (uid) and gets a short public friend code made from it, so
// the same player always has the same code. The server keeps everyone's name,
// level and a few stats for the leaderboard, friend requests waiting for
// someone who is offline, and who is online in which room.
//
// Data is saved to data.json (or $DATA_FILE) every half minute. On free hosting
// that file can be wiped when the server restarts; browsers send their stats
// again every time they connect, so the leaderboard fills back up by itself.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_PROFILES = 200000;
const MAX_FRIENDS = 100;
const BOARDS = ["xp", "kills", "dfKills", "streak"];

const profiles = new Map(); // code -> profile
const online = new Map();   // code -> socket
let pending = new Map();    // code -> [{type, from, name, at}] notices for someone offline
let dirty = false;
const boardCache = new Map(); // by -> {at, rows}

function codeOf(uid) {
    const h = crypto.createHash("sha256").update("bitplanes:" + uid).digest();
    let s = "";
    for (let i = 0; i < 6; i++) s += CODE_CHARS[h[i] % CODE_CHARS.length];
    return s;
}

function num(v, max) {
    v = Math.floor(Number(v));
    return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
}

function cleanName(v) {
    return String(v || "").replace(/[<>&"'`\u0000-\u001f]/g, "").trim().slice(0, 16) || "Pilot";
}

function load() {
    try {
        const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        for (const p of data.profiles || []) if (p && p.code) profiles.set(p.code, p);
        pending = new Map(Object.entries(data.pending || {}));
        console.log(`Loaded ${profiles.size} players from ${DATA_FILE}`);
    } catch (e) {}
}

function saveNow() {
    if (!dirty) return;
    dirty = false;
    try {
        const data = {profiles: [...profiles.values()], pending: Object.fromEntries(pending)};
        fs.writeFileSync(DATA_FILE + ".tmp", JSON.stringify(data));
        fs.renameSync(DATA_FILE + ".tmp", DATA_FILE);
    } catch (e) {
        console.log("Couldn't save player data:", e.message);
    }
}

load();
setInterval(saveNow, 30000).unref();

// Forget players who haven't been seen in 180 days, if the list gets huge.
function trim() {
    if (profiles.size <= MAX_PROFILES) return;
    const old = [...profiles.values()].sort((a, b) => a.seen - b.seen);
    for (const p of old.slice(0, profiles.size - MAX_PROFILES)) profiles.delete(p.code);
}

function publicInfo(p) {
    const ws = online.get(p.code);
    return {
        code: p.code, name: p.name, level: p.level, skin: p.skin, plane: p.plane,
        online: !!ws, room: ws ? ws.where || null : null, seen: p.seen,
    };
}

function notify(code, notice, send) {
    const ws = online.get(code);
    if (ws) return send(ws, Object.assign({op: "notice"}, notice));
    const list = pending.get(code) || [];
    // One notice of each kind per sender is enough.
    const i = list.findIndex(n => n.type === notice.type && n.from === notice.from);
    if (i >= 0) list.splice(i, 1);
    list.push(notice);
    pending.set(code, list.slice(-50));
    dirty = true;
}

function board(by) {
    const c = boardCache.get(by);
    if (c && Date.now() - c.at < 10000) return c.rows;
    const key = {xp: "xp", kills: "kills", dfKills: "dfKills", streak: "streak"}[by];
    const rows = [...profiles.values()].filter(p => p[key] > 0).sort((a, b) => b[key] - a[key] || a.seen - b.seen);
    boardCache.set(by, {at: Date.now(), rows});
    return rows;
}

// Returns true if the message was one of ours.
function handle(ws, msg, send) {
    const op = msg.op;
    if (op === "hi") {
        if (typeof msg.uid !== "string" || !/^[A-Za-z0-9]{16,64}$/.test(msg.uid)) return send(ws, {op: "err", type: "bad-request"}), true;
        const code = codeOf(msg.uid);
        let p = profiles.get(code);
        if (!p) {
            p = {code, uid: msg.uid, friends: [], created: Date.now()};
            profiles.set(code, p);
            trim();
        }
        if (p.uid !== msg.uid) return send(ws, {op: "err", type: "bad-request"}), true;
        Object.assign(p, {
            name: cleanName(msg.name), level: num(msg.level, 100), xp: num(msg.xp, 1e9), kills: num(msg.kills, 1e8),
            dfKills: num(msg.dfKills, 1e8), streak: num(msg.streak, 1e5),
            skin: /^[a-z0-9]{1,20}$/.test(msg.skin || "") ? msg.skin : "", plane: /^[a-z0-9]{1,20}$/.test(msg.plane || "") ? msg.plane : "",
            seen: Date.now(),
        });
        // Friends this browser remembers. When both sides remember each other,
        // the friendship comes back (after the saved data was lost).
        if (Array.isArray(msg.friends)) {
            p.claims = msg.friends.map(String).filter(c => /^[A-Z0-9]{6}$/.test(c)).slice(0, MAX_FRIENDS);
            for (const c of p.claims) {
                const other = profiles.get(c);
                if (other && (other.claims || []).includes(code)) {
                    if (!(p.friends || []).includes(c)) p.friends = (p.friends || []).concat(c).slice(-MAX_FRIENDS);
                    if (!(other.friends || []).includes(code)) other.friends = (other.friends || []).concat(code).slice(-MAX_FRIENDS);
                }
            }
        }
        dirty = true;
        if (ws.code && ws.code !== code && online.get(ws.code) === ws) online.delete(ws.code);
        ws.code = code;
        const prev = online.get(code);
        if (prev && prev !== ws) prev.code = null; // the same player in a newer tab
        online.set(code, ws);
        const notices = pending.get(code) || [];
        pending.delete(code);
        send(ws, {op: "me", code, notices, friends: p.friends || [], outgoing: p.outgoing || []});
        return true;
    }
    if (!["where", "friends", "fadd", "faccept", "fdecline", "fremove", "invite", "lb"].includes(op)) return false;
    const me = ws.code && profiles.get(ws.code);
    if (op === "lb") {
        const by = BOARDS.includes(msg.by) ? msg.by : "xp";
        const key = by === "streak" ? "streak" : by;
        const rows = board(by);
        const top = rows.slice(0, 50).map((p, i) => ({rank: i + 1, code: p.code, name: p.name, level: p.level, skin: p.skin, plane: p.plane, value: p[key]}));
        const rank = me ? rows.indexOf(me) : -1;
        send(ws, {op: "lb", by, rows: top, total: rows.length, me: me ? {rank: rank >= 0 ? rank + 1 : null, value: me[key] || 0} : null});
        return true;
    }
    if (!me) return send(ws, {op: "err", type: "hi-first"}), true;
    if (op === "where") {
        // {room: "ABCDE", mode: "multiplayer" | "room" | "airbattle" | "solo"} or nothing (in the lobby)
        const room = typeof msg.room === "string" && /^[A-Z0-9]{5}$/.test(msg.room) ? msg.room : null;
        // (Pages from before the rename still send its old name.)
        const sent = msg.mode === "dog" + "fights" ? "airbattle" : msg.mode;
        const mode = ["multiplayer", "room", "airbattle", "solo"].includes(sent) ? sent : null;
        ws.where = mode ? {room, mode} : null;
        return true;
    }
    if (op === "friends") {
        const codes = Array.isArray(msg.codes) ? msg.codes.slice(0, MAX_FRIENDS) : [];
        const list = codes.map(c => profiles.get(String(c))).filter(Boolean).map(publicInfo);
        send(ws, {op: "friends", list});
        return true;
    }
    const code = String(msg.code || "").toUpperCase();
    const other = profiles.get(code);
    if (op === "fadd") {
        if (code === me.code) return send(ws, {op: "ferr", code, text: "That's your own code."}), true;
        if (!other) return send(ws, {op: "ferr", code, text: "No pilot has that code. Check it and try again."}), true;
        if ((me.friends || []).includes(code)) return send(ws, {op: "ferr", code, text: `${other.name} is already your friend.`}), true;
        // They already asked us: that's a yes from both sides.
        const theirs = pending.get(me.code) || [];
        me.outgoing = (me.outgoing || []).filter(c => c !== code).concat(code).slice(-MAX_FRIENDS);
        if ((other.outgoing || []).includes(me.code) || theirs.some(n => n.type === "request" && n.from === code)) return accept(ws, me, other, send), true;
        notify(code, {type: "request", from: me.code, name: me.name, level: me.level, at: Date.now()}, send);
        send(ws, {op: "fsent", code, name: other.name});
        dirty = true;
        return true;
    }
    if (op === "faccept") {
        if (!other || !(other.outgoing || []).includes(me.code)) return send(ws, {op: "ferr", code, text: "That friend request is gone."}), true;
        accept(ws, me, other, send);
        return true;
    }
    if (op === "fdecline") {
        if (other) other.outgoing = (other.outgoing || []).filter(c => c !== me.code);
        dirty = true;
        return true;
    }
    if (op === "fremove") {
        me.friends = (me.friends || []).filter(c => c !== code);
        me.claims = (me.claims || []).filter(c => c !== code);
        if (other) {
            other.friends = (other.friends || []).filter(c => c !== me.code);
            other.claims = (other.claims || []).filter(c => c !== me.code);
            notify(code, {type: "removed", from: me.code, name: me.name, at: Date.now()}, send);
        }
        dirty = true;
        return true;
    }
    if (op === "invite") {
        if (!other || !(me.friends || []).includes(code) || !ws.where || !ws.where.room) return true;
        const target = online.get(code);
        if (target) send(target, {op: "notice", type: "invite", from: me.code, name: me.name, room: ws.where.room, mode: ws.where.mode, at: Date.now()});
        return true;
    }
    return true;
}

function accept(ws, me, other, send) {
    me.friends = [...new Set((me.friends || []).concat(other.code))].slice(-MAX_FRIENDS);
    other.friends = [...new Set((other.friends || []).concat(me.code))].slice(-MAX_FRIENDS);
    me.outgoing = (me.outgoing || []).filter(c => c !== other.code);
    other.outgoing = (other.outgoing || []).filter(c => c !== me.code);
    const mine = pending.get(me.code);
    if (mine) pending.set(me.code, mine.filter(n => !(n.type === "request" && n.from === other.code)));
    dirty = true;
    send(ws, {op: "fok", code: other.code, name: other.name});
    notify(other.code, {type: "accepted", from: me.code, name: me.name, at: Date.now()}, send);
}

function closed(ws) {
    if (ws.code && online.get(ws.code) === ws) online.delete(ws.code);
}

function summary() {
    return `Pilots: ${profiles.size}, online: ${online.size}.`;
}

module.exports = {handle, closed, summary, saveNow, codeOf};
