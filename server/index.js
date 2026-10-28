// Relay server for online play. Players connect to it over a normal secure
// WebSocket (port 443 when hosted), which school and office networks allow,
// instead of connecting straight to each other. The host's browser still runs
// the activity; this server only passes messages between the host and guests.
//
// Messages (JSON, one per WebSocket frame):
//   client -> server  {op: "host", id}       open a room (id = room name)
//                     {op: "join", id}       join a room
//                     {op: "to", to, d}      host -> one guest
//                     {op: "up", d}          guest -> host
//                     {op: "kick", to}       host drops a guest
//                     {op: "bye"}            host closes the room on purpose
//                     {op: "find"}           Multiplayer: which public match to join?
//                     {op: "list"}           Multiplayer server browser: all public matches
//                     {op: "meta", d}        host: room info for the browser (name, players, ping…)
//                     {op: "ping", t}        latency check, answered with {op: "pong", t}
//   (a host can add pub: true to "host" to list its room for Multiplayer)
//   server -> client  {op: "hello", v}       on connect: server version (2 = light format below)
//                     {op: "hosted"}         room is open
//                     {op: "joined"}         joined the room
//                     {op: "conn", from}     (host) a guest joined
//                     {op: "data", from, d}  a message (from = guest id for the host)
//                     {op: "gone", from}     (host) a guest left
//                     {op: "closed"}         (guest) the host left
//                     {op: "list", rooms}    answer to "list": [{id, players, meta}]
//                     {op: "found", id}      answer to "find": a public room id, or null =
//                                            host a new one (retry: ms = ask again soon)
//                     {op: "err", type}      "unavailable-id" | "peer-unavailable" | "bad-request" | "full"
//
// Activity data uses a lighter format the server forwards without decoding
// (much less work for a small free server):
//   host  -> server   "T<guestId>\n<json>"   to one guest
//   guest -> server   "U<json>"               to the host
//   server -> guest   "D<json>"
//   server -> host    "D<guestId>\n<json>"
const http = require("http");
const {WebSocketServer} = require("ws");

const PORT = Number(process.env.PORT) || 8787;
const MAX_ROOMS = 1000;
const MAX_GUESTS = 16;
const HOST_GRACE_MS = 15000; // keep a room this long while its host reconnects
const ID = /^[A-Za-z0-9_-]{1,64}$/;
const MAX_PUBLIC_PLAYERS = 10; // real people (host + guests) in one Multiplayer match
let lastHostOffer = 0; // when we last told someone to host a new public match

const rooms = new Map(); // id -> {host, guests: Map<guestId, socket>, nextId, timer}

function send(ws, msg) {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function closeRoom(id) {
    const room = rooms.get(id);
    if (!room) return;
    rooms.delete(id);
    clearTimeout(room.timer);
    for (const g of room.guests.values()) {
        send(g, {op: "closed"});
        g.room = null;
        g.close();
    }
}

function onMessage(ws, text) {
    // Fast path: forward activity data as is.
    const kind = text[0];
    if (kind === "T" || kind === "U") {
        const room = ws.room && rooms.get(ws.room);
        if (!room) return;
        if (kind === "T" && ws.isHost) {
            const nl = text.indexOf("\n");
            const g = nl > 0 && room.guests.get(text.slice(1, nl));
            if (g && g.readyState === g.OPEN) g.send("D" + text.slice(nl + 1));
        } else if (kind === "U" && !ws.isHost && room.host && room.host.readyState === room.host.OPEN) {
            room.host.send("D" + ws.gid + "\n" + text.slice(1));
        }
        return;
    }
    let msg;
    try {
        msg = JSON.parse(text);
    } catch (e) {
        return;
    }
    if (!msg || typeof msg !== "object") return;

    if (msg.op === "ping") return send(ws, {op: "pong", t: msg.t});

    if (msg.op === "list") {
        const list = [];
        for (const [id, room] of rooms) {
            if (room.public && room.host) list.push({id, players: room.guests.size + 1, max: MAX_PUBLIC_PLAYERS, meta: room.meta || {}});
        }
        return send(ws, {op: "list", rooms: list.slice(0, 100)});
    }

    if (msg.op === "meta") {
        const room = ws.isHost && rooms.get(ws.room);
        // Only small, plain room info is kept.
        if (room && msg.d && typeof msg.d === "object" && JSON.stringify(msg.d).length < 2000) room.meta = msg.d;
        return;
    }

    if (msg.op === "find") {
        // The fullest public match that still has room.
        let best = null;
        for (const [id, room] of rooms) {
            if (!room.public || !room.host || room.guests.size + 1 >= MAX_PUBLIC_PLAYERS) continue;
            if (!best || room.guests.size > best.room.guests.size) best = {id, room};
        }
        if (best) return send(ws, {op: "found", id: best.id});
        // Nobody hosting yet. If someone was just told to host, wait for them
        // instead of starting a second empty match.
        if (Date.now() - lastHostOffer < 6000) return send(ws, {op: "found", id: null, retry: 1500});
        lastHostOffer = Date.now();
        return send(ws, {op: "found", id: null});
    }

    if (msg.op === "host") {
        if (ws.room || !ID.test(msg.id)) return send(ws, {op: "err", type: "bad-request"});
        let room = rooms.get(msg.id);
        if (room && room.host) return send(ws, {op: "err", type: "unavailable-id"});
        if (room) {
            // The host is back after a short disconnect: same room, same guests.
            clearTimeout(room.timer);
            room.host = ws;
        } else {
            if (rooms.size >= MAX_ROOMS) return send(ws, {op: "err", type: "full"});
            room = {host: ws, guests: new Map(), nextId: 1, timer: null, public: !!msg.pub};
            rooms.set(msg.id, room);
            if (room.public) lastHostOffer = 0;
        }
        ws.room = msg.id;
        ws.isHost = true;
        send(ws, {op: "hosted"});
        for (const gid of room.guests.keys()) send(ws, {op: "conn", from: gid});
        return;
    }

    if (msg.op === "join") {
        if (ws.room || !ID.test(msg.id)) return send(ws, {op: "err", type: "bad-request"});
        const room = rooms.get(msg.id);
        if (!room || !room.host) return send(ws, {op: "err", type: "peer-unavailable"});
        if (room.guests.size >= MAX_GUESTS || (room.public && room.guests.size + 1 >= MAX_PUBLIC_PLAYERS)) return send(ws, {op: "err", type: "full"});
        const gid = "g" + room.nextId++;
        room.guests.set(gid, ws);
        ws.room = msg.id;
        ws.gid = gid;
        send(ws, {op: "joined"});
        send(room.host, {op: "conn", from: gid});
        return;
    }

    const room = ws.room && rooms.get(ws.room);
    if (!room) return;
    if (ws.isHost) {
        const g = room.guests.get(msg.to);
        if (msg.op === "to") send(g, {op: "data", d: msg.d});
        else if (msg.op === "bye") closeRoom(ws.room);
        else if (msg.op === "kick" && g) {
            room.guests.delete(msg.to);
            g.room = null;
            send(g, {op: "closed"});
            g.close();
        }
    } else if (msg.op === "up") {
        send(room.host, {op: "data", from: ws.gid, d: msg.d});
    }
}

function onClose(ws) {
    const room = ws.room && rooms.get(ws.room);
    if (!room) return;
    if (ws.isHost) {
        if (room.host !== ws) return;
        room.host = null;
        room.timer = setTimeout(() => closeRoom(ws.room), HOST_GRACE_MS);
    } else if (room.guests.get(ws.gid) === ws) {
        room.guests.delete(ws.gid);
        send(room.host, {op: "gone", from: ws.gid});
    }
}

const server = http.createServer((req, res) => {
    // Health check page (Render and you can open it to see the server is up).
    res.writeHead(200, {"Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"});
    const pub = [...rooms.values()].filter(r => r.public).length;
    res.end(`Bit Planes relay server is running. Rooms open: ${rooms.size} (${pub} Multiplayer)\n`);
});

const wss = new WebSocketServer({server, maxPayload: 512 * 1024});
wss.on("connection", ws => {
    // Tells browsers this server understands the light "T"/"U" data format.
    send(ws, {op: "hello", v: 4}); // 3 = Multiplayer matchmaking, 4 = server browser
    ws.alive = true;
    ws.on("pong", () => (ws.alive = true));
    ws.on("message", data => onMessage(ws, data.toString()));
    ws.on("close", () => onClose(ws));
    ws.on("error", () => {});
});

// Drop connections that stopped answering, and keep idle ones from timing out.
setInterval(() => {
    for (const ws of wss.clients) {
        if (!ws.alive) {
            ws.terminate();
            continue;
        }
        ws.alive = false;
        ws.ping();
    }
}, 25000);

server.listen(PORT, () => console.log(`Bit Planes relay server on port ${PORT}`));
