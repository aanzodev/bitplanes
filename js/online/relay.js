// Online play through the relay server (server/index.js) instead of a direct
// WebRTC connection. RelayPeer and RelayConn copy the small part of PeerJS's
// API that host.js and guest.js use, so the rest of the online code works the
// same either way. See config.js for when the relay server is used.
(function () {
    const O = window.BitOnline;
    const WAKE_NOTICE_MS = 3000; // free servers sleep when unused and take a while to wake up
    const OPEN_TIMEOUT_MS = 75000;

    class Emitter {
        constructor() {
            this._handlers = {};
        }

        on(event, fn) {
            (this._handlers[event] = this._handlers[event] || []).push(fn);
            return this;
        }

        emit(event, ...args) {
            for (const fn of (this._handlers[event] || []).slice()) fn(...args);
        }
    }

    // One link between the host and a guest, through the server.
    class RelayConn extends Emitter {
        constructor(peer, remoteId) {
            super();
            this._peer = peer;
            this.peer = remoteId;
            this.open = false;
        }

        send(data) {
            if (!this.open) return;
            // Light format the server forwards without decoding (see server/index.js).
            const p = this._peer;
            if (!p.fast) return p._send(p.isHost ? {op: "to", to: this.peer, d: data} : {op: "up", d: data}); // older server
            const json = JSON.stringify(data);
            p._sendRaw(p.isHost ? "T" + this.peer + "\n" + json : "U" + json);
        }

        close() {
            if (!this.open) return;
            if (this._peer.isHost) this._peer._send({op: "kick", to: this.peer});
            this._closed();
            if (!this._peer.isHost) this._peer.destroy();
        }

        _closed() {
            if (!this.open) return;
            this.open = false;
            this.emit("close");
        }
    }

    class RelayPeer extends Emitter {
        // id given: host a room with that id. No id: a guest that will connect().
        constructor(url, id) {
            super();
            this.url = url;
            this.id = id || "";
            this.isHost = !!id;
            this.destroyed = false;
            this.disconnected = true;
            this.conns = new Map();
            setTimeout(() => this._connect(), 0);
        }

        _connect() {
            if (this.destroyed) return;
            let ws;
            try {
                ws = new WebSocket(this.url);
            } catch (e) {
                return this._error("server-error");
            }
            this.ws = ws;
            let opened = false;
            const wake = setTimeout(() => opened || this.emit("waking"), WAKE_NOTICE_MS);
            const giveUp = setTimeout(() => opened || ws.close(), OPEN_TIMEOUT_MS);
            ws.onopen = () => {
                opened = true;
                clearTimeout(wake);
                clearTimeout(giveUp);
                this.disconnected = false;
                if (this.isHost) this._send({op: "host", id: this.id});
                else this.emit("open", this.id);
            };
            ws.onmessage = ev => {
                const text = ev.data;
                if (typeof text !== "string") return;
                try {
                    if (text[0] === "D" && this.fast) {
                        // Activity data: "D<json>" for guests, "D<guestId>\n<json>" for the host.
                        if (this.isHost) {
                            const nl = text.indexOf("\n");
                            const c = this.conns.get(text.slice(1, nl));
                            if (c) c.emit("data", JSON.parse(text.slice(nl + 1)));
                        } else {
                            const c = this.conns.get("host");
                            if (c) c.emit("data", JSON.parse(text.slice(1)));
                        }
                    } else this._onMessage(JSON.parse(text));
                } catch (e) {}
            };
            ws.onclose = () => {
                clearTimeout(wake);
                clearTimeout(giveUp);
                if (this.ws !== ws || this.destroyed) return;
                this.disconnected = true;
                if (!opened) {
                    // A host that already had a room keeps trying (the server holds it for 15s).
                    if (this.isHost && this.hosted) return setTimeout(() => this._connect(), 2000);
                    return this._error("server-error");
                }
                if (this.isHost) {
                    this.emit("disconnected", this.id);
                } else {
                    for (const c of this.conns.values()) c._closed();
                    this.conns.clear();
                }
            };
        }

        _onMessage(msg) {
            if (msg.op === "hello") {
                this.fast = msg.v >= 2;
            } else if (msg.op === "hosted") {
                if (!this.hosted) this.emit("open", this.id);
                this.hosted = true;
            } else if (msg.op === "conn") {
                if (this.conns.has(msg.from)) return;
                const c = new RelayConn(this, msg.from);
                c.open = true;
                this.conns.set(msg.from, c);
                this.emit("connection", c);
                setTimeout(() => c.emit("open"), 0);
            } else if (msg.op === "joined") {
                const c = this.conns.get("host");
                if (c) {
                    c.open = true;
                    c.emit("open");
                }
            } else if (msg.op === "data") {
                const c = this.conns.get(this.isHost ? msg.from : "host");
                if (c) c.emit("data", msg.d);
            } else if (msg.op === "gone") {
                const c = this.conns.get(msg.from);
                this.conns.delete(msg.from);
                if (c) c._closed();
            } else if (msg.op === "closed") {
                for (const c of this.conns.values()) c._closed();
                this.conns.clear();
            } else if (msg.op === "err") {
                this._error(msg.type);
            }
        }

        _error(type) {
            const err = new Error(type);
            err.type = type;
            this.emit("error", err);
        }

        _send(msg) {
            this._sendRaw(JSON.stringify(msg));
        }

        _sendRaw(text) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(text);
        }

        // Guests: join the room with this id.
        connect(id) {
            const c = new RelayConn(this, id);
            this.conns.set("host", c);
            this._send({op: "join", id});
            return c;
        }

        // Hosts: the server keeps the room for a few seconds, so reconnect quickly.
        reconnect() {
            if (!this.destroyed && this.disconnected) this._connect();
        }

        destroy() {
            if (this.destroyed) return;
            this.destroyed = true;
            // Tell the server this is on purpose, so it closes the room right away
            // instead of waiting for the host to come back.
            if (this.isHost) this._send({op: "bye"});
            const ws = this.ws;
            this.ws = null;
            if (ws) ws.close();
        }
    }

    // ------------------------------------------------------------------
    // Direct first, server as backup. A direct (WebRTC) connection is fastest,
    // e.g. two laptops on the same home Wi-Fi. Networks that block it (school,
    // office) fall back to the relay server after a few seconds.

    const DIRECT_TRY_MS = 4500;

    // The host listens on both: friends can reach it either way.
    class HybridHost extends Emitter {
        constructor(url, id) {
            super();
            this.id = id;
            this.destroyed = false;
            this.relay = new RelayPeer(url, id);
            this.relay.on("open", () => this._opened());
            this.relay.on("waking", () => this.isOpen || this.emit("waking"));
            this.relay.on("connection", c => (c.via = "server", this.emit("connection", c)));
            this.relay.on("disconnected", () => this.relay.reconnect());
            this.relay.on("error", err => {
                if (err.type === "unavailable-id") return this.emit("error", err);
                this.relayFailed = err;
                this._failed();
            });
            try {
                this.direct = new Peer(id, O.peerOptions());
                this.direct.on("open", () => this._opened());
                this.direct.on("connection", c => (c.via = "direct", this.emit("connection", c)));
                this.direct.on("disconnected", () => this.direct.destroyed || this.direct.reconnect());
                this.direct.on("error", err => {
                    // Someone else has this code on the direct network: pick a new code.
                    if (err.type === "unavailable-id") return this.emit("error", err);
                    console.warn("Direct connections unavailable:", err.type);
                    this.directFailed = err;
                    this._failed();
                });
            } catch (e) {
                this.direct = null;
                this.directFailed = e;
            }
        }

        // The room is open as soon as either way works.
        _opened() {
            if (this.isOpen) return;
            this.isOpen = true;
            this.emit("open", this.id);
        }

        // Only an error when neither way works.
        _failed() {
            if (this.relayFailed && this.directFailed && !this.isOpen) this.emit("error", this.relayFailed);
            else if (this.relayFailed && this.isOpen) console.warn("Online server unavailable; direct connections only.");
        }

        reconnect() {}

        destroy() {
            if (this.destroyed) return;
            this.destroyed = true;
            this.relay.destroy();
            if (this.direct) this.direct.destroy();
        }
    }

    // A guest's link to the host: tries direct, then the server.
    class HybridConn extends Emitter {
        constructor(guest, id) {
            super();
            this.guest = guest;
            this.peer = id;
            this.open = false;
            this.c = null;
            this.viaServerStarted = false;
            this._tryDirect();
        }

        _tryDirect() {
            const d = this.guest.direct;
            if (!d) return this._tryServer();
            const timer = setTimeout(() => this._tryServer(), DIRECT_TRY_MS);
            const go = () => {
                if (this.c || this.viaServerStarted) return;
                let c;
                try {
                    c = d.connect(this.peer, {reliable: true, serialization: "json"});
                } catch (e) {
                    return this._tryServer();
                }
                c.on("open", () => {
                    clearTimeout(timer);
                    if (this.c || this.viaServerStarted) return c.close();
                    this._adopt(c, "direct");
                });
                c.on("error", () => this._tryServer());
            };
            // e.g. "peer-unavailable": the host has no direct link, use the server now.
            d.on("error", () => this._tryServer());
            if (d.open) go();
            else d.on("open", go);
        }

        _tryServer() {
            if (this.c || this.viaServerStarted) return;
            this.viaServerStarted = true;
            const r = this.guest.relay;
            if (this.guest.relayDown) return this.guest.emit("error", this.guest.relayDown);
            const go = () => {
                const c = r.connect(this.peer);
                c.on("open", () => this._adopt(c, "server"));
            };
            if (r.ready) go();
            else r.on("open", go);
        }

        _adopt(c, via) {
            this.c = c;
            this.open = true;
            this.via = O.via = via;
            c.on("data", d => this.emit("data", d));
            c.on("close", () => {
                this.open = false;
                this.emit("close");
            });
            c.on("error", err => this.emit("error", err));
            // Stop the other attempt.
            if (via === "server" && this.guest.direct) this.guest.direct.destroy();
            this.emit("open");
        }

        send(data) {
            if (this.open) this.c.send(data);
        }

        close() {
            if (this.c) this.c.close();
        }
    }

    class HybridGuest extends Emitter {
        constructor(url) {
            super();
            this.destroyed = false;
            this.relay = new RelayPeer(url);
            this.relay.on("open", () => {
                this.relay.ready = true;
                this._opened();
            });
            this.relay.on("waking", () => this.emit("waking"));
            // "Room not found" comes from the relay (the backup path). If the server
            // itself can't be reached, that only matters once the direct try failed.
            this.relay.on("error", err => {
                if (err.type === "server-error") {
                    this.relayDown = err;
                    if (this.conn && this.conn.viaServerStarted && !this.conn.open) this.emit("error", err);
                    else this._maybeFail();
                    return;
                }
                this.emit("error", err);
            });
            try {
                this.direct = new Peer(O.peerOptions());
                this.direct.on("open", () => this._opened());
                this.direct.on("error", err => {
                    console.warn("Direct connection:", err.type);
                    if (!this.isOpen) {
                        this.directFailed = true;
                        this._maybeFail();
                    }
                });
            } catch (e) {
                this.direct = null;
                this.directFailed = true;
            }
        }

        // Neither the server nor direct connections could even start.
        _maybeFail() {
            if (!this.isOpen && this.relayDown && this.directFailed) this.emit("error", this.relayDown);
        }

        _opened() {
            if (this.isOpen) return;
            this.isOpen = true;
            this.emit("open");
        }

        connect(id) {
            this.conn = new HybridConn(this, id);
            return this.conn;
        }

        destroy() {
            if (this.destroyed) return;
            this.destroyed = true;
            this.relay.destroy();
            if (this.direct) this.direct.destroy();
        }
    }

    O.RelayPeer = RelayPeer;
    O.HybridHost = HybridHost;
    O.HybridGuest = HybridGuest;
})();
