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
            this._peer._send(this._peer.isHost ? {op: "to", to: this.peer, d: data} : {op: "up", d: data});
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
                let msg;
                try {
                    msg = JSON.parse(ev.data);
                } catch (e) {
                    return;
                }
                this._onMessage(msg);
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
            if (msg.op === "hosted") {
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
            if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
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

    O.RelayPeer = RelayPeer;
})();
