// Friends and the global leaderboard, through the online server.
//   Friends (👥 in the lobby): your friend code, add friends by code, accept
//   requests, see who is online and where, join their room, invite them to yours.
//   Leaderboard tab: the top 50 pilots worldwide by XP, kills, Dogfights kills
//   or best kill streak, and your own rank.
// Your secret id (localStorage "uid") stays in this browser; others only see
// your friend code, name, level and pilot skin.
window.BitSocial = (function () {
    const O = window.BitOnline || {};
    const BOARDS = [
        {id: "xp", name: "Level", unit: "XP"},
        {id: "kills", name: "Points", unit: "points"},
        {id: "dfKills", name: "Flight Sessions points", unit: "points"},
        {id: "streak", name: "Best streak", unit: "in a row"},
    ];
    let ws = null, ready = false, version = 0, myCode = "", retry = 3000, timer = null, lastHi = "";
    let friends = load("friendsCache", []); // [{code, name, level, skin, online, room, seen}]
    let requests = [];                      // [{from, name, level}]
    let outgoing = [];
    let board = {by: "xp", rows: null, me: null, total: 0};
    let friendsEl, boardEl, notice = "";

    function load(k, d) {
        try {
            return JSON.parse(localStorage.getItem(k)) || d;
        } catch (e) {
            return d;
        }
    }

    function store(k, v) {
        try {
            localStorage.setItem(k, JSON.stringify(v));
        } catch (e) {}
    }

    function uid() {
        let id = "";
        try {
            id = localStorage.getItem("uid") || "";
        } catch (e) {}
        if (!/^[A-Za-z0-9]{16,64}$/.test(id)) {
            const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", a = new Uint8Array(24);
            (window.crypto || window.msCrypto).getRandomValues(a);
            id = [...a].map(b => chars[b % chars.length]).join("");
            try {
                localStorage.setItem("uid", id);
            } catch (e) {}
        }
        return id;
    }

    function esc(s) {
        return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    }

    function nickname() {
        const input = document.querySelector('input[name="nickname"]');
        let n = input && input.value.trim();
        if (!n) try {
            n = localStorage.getItem("nickname") || "";
        } catch (e) {}
        return n || "Pilot";
    }

    // --------------------------------------------------------- connection

    function serverUrl() {
        return O.serverUrl ? O.serverUrl() : window.BitOnlineServer || "";
    }

    function send(msg) {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
    }

    function connect() {
        clearTimeout(timer);
        const url = serverUrl();
        if (!url || ws) return;
        try {
            ws = new WebSocket(url);
        } catch (e) {
            return later();
        }
        ws.addEventListener("message", ev => {
            let msg;
            try {
                msg = JSON.parse(ev.data);
            } catch (e) {
                return;
            }
            onMessage(msg);
        });
        ws.addEventListener("close", () => {
            ws = null;
            ready = false;
            later();
            render();
        });
        ws.addEventListener("error", () => {});
    }

    function later() {
        clearTimeout(timer);
        timer = setTimeout(connect, retry);
        retry = Math.min(60000, retry * 2);
    }

    function profile() {
        const s = (window.BitStats && window.BitStats.get()) || {};
        const P = window.BitProgress, lv = P ? P.levelInfo() : {level: 1, xp: 0};
        return {
            op: "hi", uid: uid(), name: nickname(), level: lv.level, xp: lv.xp, kills: s.killed || 0, dfKills: s.dfKills || 0,
            streak: s.bestStreak || 0, skin: window.BitSkins ? window.BitSkins.selected().id : "",
            plane: window.BitShop ? window.BitShop.selected().id : "",
            friends: friends.map(f => f.code),
        };
    }

    // Say who we are (again when something changed, e.g. a new level or name).
    function hi(force) {
        if (!ws || ws.readyState !== 1 || version < 5) return;
        const p = profile(), key = JSON.stringify(p);
        if (!force && key === lastHi) return;
        lastHi = key;
        send(p);
    }

    function onMessage(msg) {
        if (msg.op === "hello") {
            version = msg.v || 0;
            if (version < 5) {
                notice = "Friends and the rankings need the online server's update (Render installs it a few minutes after it's merged).";
                return render();
            }
            retry = 3000;
            lastHi = "";
            hi(true);
        } else if (msg.op === "me") {
            ready = true;
            notice = "";
            myCode = msg.code;
            store("friendCode", myCode);
            // Friends from the server plus the ones this browser remembers (the
            // server restores those once the friend comes back online too).
            const known = new Map(friends.map(f => [f.code, f]));
            const codes = [...new Set((msg.friends || []).concat(friends.map(f => f.code)))];
            friends = codes.map(c => known.get(c) || {code: c, name: c, level: 1});
            outgoing = msg.outgoing || [];
            store("friendsCache", friends);
            for (const n of msg.notices || []) onNotice(n, true);
            whereNow(true);
            refresh();
        } else if (msg.op === "notice") onNotice(msg);
        else if (msg.op === "friends") {
            const byCode = new Map((msg.list || []).map(f => [f.code, f]));
            friends = friends.map(f => byCode.get(f.code) || f);
            store("friendsCache", friends);
            render();
        } else if (msg.op === "fsent") {
            outgoing = outgoing.concat(msg.code);
            say(`Friend request sent to ${esc(msg.name)}.`);
        } else if (msg.op === "fok") {
            addFriend(msg.code, msg.name);
            say(`You and ${esc(msg.name)} are friends now!`);
        } else if (msg.op === "ferr") say(esc(msg.text));
        else if (msg.op === "lb") {
            board = {by: msg.by, rows: msg.rows || [], me: msg.me, total: msg.total || 0};
            renderBoard();
        }
    }

    function onNotice(n, quiet) {
        const toast = window.BitProgress && window.BitProgress.toast;
        if (n.type === "request") {
            if (!requests.some(r => r.from === n.from)) requests.push({from: n.from, name: n.name, level: n.level});
            if (toast) toast(`<span class="toast-icon">👥</span><span><small>Friend request</small><b>${esc(n.name)}</b>wants to be friends. Open 👥 Friends to accept.</span>`, "friend", 5000);
        } else if (n.type === "accepted") {
            addFriend(n.from, n.name);
            if (toast && !quiet) toast(`<span class="toast-icon">🤝</span><span><small>Friends</small><b>${esc(n.name)}</b>accepted your friend request.</span>`, "friend", 4000);
        } else if (n.type === "removed") {
            friends = friends.filter(f => f.code !== n.from);
            store("friendsCache", friends);
        } else if (n.type === "invite" && !quiet) showInvite(n);
        render();
    }

    function addFriend(code, name) {
        if (!friends.some(f => f.code === code)) friends.push({code, name, level: 1});
        outgoing = outgoing.filter(c => c !== code);
        requests = requests.filter(r => r.from !== code);
        store("friendsCache", friends);
        refresh();
    }

    // Where we are right now, for friends' lists.
    let lastWhere = "";

    function whereNow(force) {
        const df = window.BitDogfight && window.BitDogfight.state && window.BitDogfight.state();
        const ui = document.querySelector(".ui"), flying = ui && ui.style.display === "block";
        let w = {};
        if (df) w = {mode: "dogfights"};
        else if (O.role === "host" && O.hostState && O.hostState.code) w = {mode: O.mode === "multiplayer" ? "multiplayer" : "room", room: O.hostState.code};
        else if (O.role === "guest" && O.guestState && O.guestState.code) w = {mode: O.mode === "multiplayer" ? "multiplayer" : "room", room: O.guestState.code};
        else if (flying) w = {mode: "solo"};
        const key = JSON.stringify(w);
        if (!force && key === lastWhere) return;
        lastWhere = key;
        send(Object.assign({op: "where"}, w));
    }

    function refresh() {
        if (ready && friends.length) send({op: "friends", codes: friends.map(f => f.code)});
        render();
    }

    // ------------------------------------------------------------ actions

    function say(text) {
        notice = text;
        render();
    }

    function inActivity() {
        const ui = document.querySelector(".ui");
        return (ui && ui.style.display === "block") || !!(window.BitDogfight && window.BitDogfight.state && window.BitDogfight.state());
    }

    // Join a friend's room. From inside an activity the page reloads into it.
    function joinRoom(room, mode) {
        if (!/^[A-Z0-9]{5}$/.test(room || "")) return;
        if (inActivity() || O.role) {
            location.href = location.pathname + "?join=" + room + "&jm=" + (mode === "multiplayer" ? "multiplayer" : "room");
            return;
        }
        hide();
        O.mode = mode === "multiplayer" ? "multiplayer" : null;
        O.publicRoom = false;
        O.join && O.join(room);
    }

    function showInvite(n) {
        const toast = window.BitProgress && window.BitProgress.toast;
        if (!toast) return;
        const id = "inv" + Date.now();
        toast(`<span class="toast-icon">✉</span><span><small>Invite</small><b>${esc(n.name)}</b>invited you to their ${n.mode === "multiplayer" ? "Multiplayer match" : "room"}.
            <button type="button" class="btn toast-join" id="${id}">Join</button></span>`, "friend", 12000);
        setTimeout(() => {
            const b = document.getElementById(id);
            if (b) b.addEventListener("click", () => joinRoom(n.room, n.mode));
        });
    }

    function statusText(f) {
        if (!f.online) {
            if (!f.seen) return "Offline";
            const mins = Math.round((Date.now() - f.seen) / 60000);
            return "Offline · " + (mins < 60 ? `${Math.max(1, mins)} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`);
        }
        const r = f.room;
        if (!r) return "Online · in the lobby";
        return "Online · " + ({multiplayer: "in a Multiplayer session", room: "in a private room", dogfights: "in Flight Sessions", solo: "flying solo"}[r.mode] || "playing");
    }

    function myRoom() {
        if (O.role === "host" && O.hostState) return O.hostState.code;
        if (O.role === "guest" && O.guestState) return O.guestState.code;
        return null;
    }

    function skinImg(id) {
        const S = window.BitSkins, skin = S && (S.get(id) || S.list[0]);
        return skin ? S.image(skin, true) : "";
    }

    function render() {
        const dot = document.querySelector(".friend-dot");
        if (dot) dot.hidden = !requests.length;
        if (!friendsEl || friendsEl.hidden) return;
        const room = myRoom();
        const online = friends.filter(f => f.online).length;
        const sorted = friends.slice().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || String(a.name).localeCompare(b.name));
        friendsEl.querySelector(".friends-body").innerHTML = `
            ${notice ? `<p class="social-note">${notice}</p>` : ""}
            ${!serverUrl() ? `<p class="social-note">Friends need the online server (js/online/config.js).</p>` : ""}
            <div class="friend-me">
                <div><small>Your friend code</small><b class="my-code">${myCode || load("friendCode", "") || "······"}</b></div>
                <button type="button" class="pill copy-code"${myCode ? "" : " disabled"}>Copy</button>
                <span class="${ready ? "net-on" : "net-off"}">${ready ? "● Online" : ws ? "Connecting…" : "● Offline"}</span>
            </div>
            <form class="friend-add">
                <input type="text" class="friend-code" maxlength="6" placeholder="Friend's code (6 letters)" autocomplete="off" spellcheck="false">
                <button class="btn"${ready ? "" : " disabled"}>Add friend</button>
            </form>
            ${requests.length ? `<h3>Requests</h3>${requests.map(r => `
                <div class="friend-row"><img src="${skinImg("")}" alt=""><div><b>${esc(r.name)}</b><small>Level ${r.level || 1} · ${esc(r.from)}</small></div>
                    <button type="button" class="btn friend-accept" data-code="${esc(r.from)}">Accept</button>
                    <button type="button" class="pill friend-decline" data-code="${esc(r.from)}">Decline</button></div>`).join("")}` : ""}
            <h3>Friends <small>${online} online · ${friends.length} total</small></h3>
            ${sorted.length ? sorted.map(f => `
                <div class="friend-row${f.online ? " on" : ""}"><img src="${skinImg(f.skin)}" alt="">
                    <div><b>${esc(f.name)}</b> <span class="friend-lv">LV ${f.level || 1}</span><small>${statusText(f)}</small></div>
                    ${f.online && f.room && f.room.room && f.room.room !== room ? `<button type="button" class="btn friend-join" data-room="${f.room.room}" data-mode="${f.room.mode}">Join</button>` : ""}
                    ${f.online && room && !(f.room && f.room.room === room) ? `<button type="button" class="pill friend-invite" data-code="${esc(f.code)}">Invite</button>` : ""}
                    <button type="button" class="friend-remove" data-code="${esc(f.code)}" title="Remove friend">×</button>
                </div>`).join("") : `<p class="shop-note">No friends yet. Share your code, or type a friend's code above.</p>`}
            ${outgoing.length ? `<p class="shop-note">Waiting for ${outgoing.length} friend request${outgoing.length === 1 ? "" : "s"} to be accepted.</p>` : ""}`;
    }

    function renderBoard() {
        if (!boardEl || boardEl.hidden) return;
        boardEl.querySelectorAll(".set-tab").forEach(b => b.classList.toggle("active", b.dataset.by === board.by));
        const def = BOARDS.find(b => b.id === board.by) || BOARDS[0];
        const friendCodes = new Set(friends.map(f => f.code));
        const body = boardEl.querySelector(".board-body");
        if (!serverUrl()) return (body.innerHTML = `<p class="social-note">The rankings need the online server.</p>`);
        if (version && version < 5) return (body.innerHTML = `<p class="social-note">${notice}</p>`);
        if (!board.rows) return (body.innerHTML = `<p class="shop-note">${ready ? "Loading…" : "Connecting to the online server… (it can take up to a minute to wake up)"}</p>`);
        const val = r => (def.id === "xp" ? `<b>LV ${r.level}</b> <small>${Number(r.value).toLocaleString()} XP</small>` : `<b>${Number(r.value).toLocaleString()}</b>`);
        body.innerHTML = `
            ${board.me ? `<p class="board-me">Your rank: <b>${board.me.rank ? "#" + board.me.rank.toLocaleString() : "not ranked yet"}</b> of ${board.total.toLocaleString()} pilots</p>` : ""}
            ${board.rows.length ? `<table class="board-table"><tr><th>#</th><th></th><th>Pilot</th><th>${def.name}</th></tr>
            ${board.rows.map(r => `<tr class="${r.code === myCode ? "me" : friendCodes.has(r.code) ? "friend" : ""}">
                <td class="rank rank-${r.rank}">${r.rank}</td><td><img src="${skinImg(r.skin)}" alt=""></td>
                <td>${esc(r.name)}${r.code === myCode ? " <em>(you)</em>" : friendCodes.has(r.code) ? " <em>friend</em>" : ""}</td><td>${val(r)}</td></tr>`).join("")}
            </table>` : `<p class="shop-note">Nobody on this board yet. Be the first!</p>`}`;
    }

    function hide() {
        if (friendsEl) friendsEl.hidden = true;
        if (boardEl) boardEl.hidden = true;
    }

    function openFriends() {
        friendsEl.hidden = false;
        connect();
        refresh();
    }

    function openBoard(by) {
        boardEl.hidden = false;
        connect();
        if (by) board.by = by;
        board.rows = null;
        renderBoard();
        if (ready || ws) {
            hi(true);
            send({op: "lb", by: board.by});
        }
    }

    function init() {
        friendsEl = document.createElement("div");
        friendsEl.className = "friends-list panel-backdrop";
        friendsEl.hidden = true;
        friendsEl.innerHTML = `<div class="panel" role="dialog" aria-label="Friends">
            <div class="shop-header"><h2>Friends</h2><button type="button" class="close-shop social-close" aria-label="Close">×</button></div>
            <div class="friends-body"></div></div>`;
        boardEl = document.createElement("div");
        boardEl.className = "leaderboard panel-backdrop";
        boardEl.hidden = true;
        boardEl.innerHTML = `<div class="panel" role="dialog" aria-label="Rankings">
            <div class="shop-header"><h2>Global rankings</h2><button type="button" class="close-shop social-close" aria-label="Close">×</button></div>
            <div class="set-tabs">${BOARDS.map(b => `<button type="button" class="set-tab" data-by="${b.id}">${b.name}</button>`).join("")}</div>
            <div class="board-body"></div></div>`;
        document.body.appendChild(friendsEl);
        document.body.appendChild(boardEl);

        friendsEl.addEventListener("click", ev => {
            const t = ev.target;
            if (t === friendsEl || t.closest(".social-close")) return hide();
            const b = t.closest("button");
            if (!b) return;
            const code = b.dataset.code;
            if (b.classList.contains("copy-code") && myCode) {
                (navigator.clipboard ? navigator.clipboard.writeText(myCode) : Promise.reject()).then(() => say("Code copied!"), () => say("Your code: " + myCode));
            } else if (b.classList.contains("friend-accept")) {
                send({op: "faccept", code});
                requests = requests.filter(r => r.from !== code);
                render();
            } else if (b.classList.contains("friend-decline")) {
                send({op: "fdecline", code});
                requests = requests.filter(r => r.from !== code);
                render();
            } else if (b.classList.contains("friend-remove")) {
                const f = friends.find(x => x.code === code);
                if (!confirm(`Remove ${f ? f.name : code} from your friends?`)) return;
                send({op: "fremove", code});
                friends = friends.filter(x => x.code !== code);
                store("friendsCache", friends);
                render();
            } else if (b.classList.contains("friend-join")) joinRoom(b.dataset.room, b.dataset.mode);
            else if (b.classList.contains("friend-invite")) {
                whereNow(true);
                send({op: "invite", code});
                b.textContent = "Invited ✓";
                b.disabled = true;
            }
        });
        friendsEl.addEventListener("submit", ev => {
            ev.preventDefault();
            const input = friendsEl.querySelector(".friend-code");
            const code = input.value.trim().toUpperCase();
            if (!/^[A-Z0-9]{6}$/.test(code)) return say("Friend codes have 6 letters and numbers.");
            send({op: "fadd", code});
            input.value = "";
        });
        boardEl.addEventListener("click", ev => {
            if (ev.target === boardEl || ev.target.closest(".social-close")) return hide();
            const t = ev.target.closest(".set-tab");
            if (t) openBoard(t.dataset.by);
        });
        document.addEventListener("keydown", ev => ev.key === "Escape" && hide());
        document.querySelectorAll(".open-friends-list").forEach(b => b.addEventListener("click", openFriends));
        document.querySelectorAll(".open-leaderboard").forEach(b => b.addEventListener("click", () => openBoard()));
        // Ready answers to the leaderboard once connected.
        setInterval(() => {
            hi();
            whereNow();
            if (boardEl && !boardEl.hidden && !board.rows && ready) send({op: "lb", by: board.by});
        }, 2000);
        setInterval(() => ready && friends.length && send({op: "friends", codes: friends.map(f => f.code)}), friendsEl ? 15000 : 60000);
        setInterval(() => friendsEl && !friendsEl.hidden && refresh(), 5000);
        setTimeout(connect, 1500);

        // Arrived from an invite while flying: ?join=CODE&jm=multiplayer|room
        const q = new URLSearchParams(location.search), room = (q.get("join") || "").toUpperCase();
        if (/^[A-Z0-9]{5}$/.test(room)) {
            q.delete("join");
            const mode = q.get("jm");
            q.delete("jm");
            history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
            setTimeout(() => joinRoom(room, mode), 900);
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    return {
        friendCount: () => friends.length,
        friends: () => friends.slice(),
        code: () => myCode,
        openFriends: () => openFriends(),
        openBoard: by => openBoard(by),
        connected: () => ready,
        _send: send,
    };
})();
