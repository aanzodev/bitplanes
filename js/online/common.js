(function () {
    const O = window.BitOnline = {};
    O.role = null;

    const PREFIX = "bitplanes-room-";
    const SNAPSHOT_MS = 33;
    const RENDER_DELAY_MS = 45;
    const TIMEOUT_MS = 6000;
    const JOIN_TIMEOUT_MS = 20000;
    const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const GUEST_COLORS = ["#145ece", "#f36a20", "#70ba01", "#d23be7", "#34bbe6", "#dbaf02", "#ff0786"];
    const KEYS = {
        up: ["ArrowUp", "KeyW"],
        down: ["ArrowDown", "KeyS"],
        left: ["ArrowLeft", "KeyA"],
        right: ["ArrowRight", "KeyD"],
        fire: ["Space"],
        missile: ["KeyX"],
        catapult: ["KeyC"],
        flare: ["KeyQ"],
    };

    function engine() {
        return window.BitEngine;
    }

    function iceServers(q) {
        const servers = [
            {urls: ["stun:stun.l.google.com:19302", "stun:stun.cloudflare.com:3478"]},
            {urls: ["turn:eu-0.turn.peerjs.com:3478", "turn:us-0.turn.peerjs.com:3478"], username: "peerjs", credential: "peerjsp"},
            {
                urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443?transport=tcp", "turns:openrelay.metered.ca:443?transport=tcp"],
                username: "openrelayproject", credential: "openrelayproject",
            },
        ];
        if (q.get("turn")) servers.unshift({urls: q.get("turn").split(","), username: q.get("turnuser") || "", credential: q.get("turnpass") || ""});
        return servers;
    }

    function peerOptions() {
        const q = new URLSearchParams(location.search);
        const options = {debug: 1, config: {iceServers: iceServers(q)}};
        const host = q.get("peerhost");
        if (!host) return options;
        return Object.assign(options, {
            host,
            port: Number(q.get("peerport") || 9000),
            path: q.get("peerpath") || "/",
            secure: q.get("peersecure") === "1",
        });
    }

    function serverUrl() {
        const q = new URLSearchParams(location.search).get("server");
        if (q === "off") return "";
        return q || window.BitOnlineServer || "";
    }

    function newPeer(id) {
        const url = serverUrl();
        const direct = typeof Peer !== "undefined" && new URLSearchParams(location.search).get("direct") !== "off";
        if (url && direct) return id ? new O.HybridHost(url, id) : new O.HybridGuest(url);
        if (url) {
            O.via = "server";
            return new O.RelayPeer(url, id);
        }
        O.via = "direct";
        return id ? new Peer(id, peerOptions()) : new Peer(peerOptions());
    }

    function errorText(type) {
        if (type === "server-error") return "Couldn't reach the online server. Check your internet connection and try again.";
        if (type === "full") return "That match is full (10 players). Pick another server or press Start for a new one.";
        return "Couldn't connect (" + type + "). Check your internet connection and try again.";
    }

    function makeTimeline(minDelay = 40, maxDelay = 250, interval = SNAPSHOT_MS) {
        const tl = {offsets: [], lates: [], offset: 0, delay: minDelay, clock: undefined, clockAt: 0};
        tl.add = (ts, now) => {
            tl.offsets.push(now - ts);
            if (tl.offsets.length > 90) tl.offsets.shift();
            tl.offset = Math.min(...tl.offsets);
            tl.lates.push(now - ts - tl.offset);
            if (tl.lates.length > 90) tl.lates.shift();
            if (tl.lates.length < 10) return;
            const sorted = tl.lates.slice().sort((a, b) => a - b);
            const target = Math.max(minDelay, Math.min(maxDelay, sorted[Math.floor(sorted.length * 0.95)] + interval + 10));
            tl.delay += (target - tl.delay) * (target > tl.delay ? 0.25 : 0.02);
        };
        tl.time = now => {
            const target = now - tl.offset - tl.delay;
            if (tl.clock === undefined || Math.abs(target - tl.clock) > 500) tl.clock = target;
            else {
                const dt = now - tl.clockAt;
                tl.clock += dt + Math.max(-dt * 0.5, Math.min(dt * 0.5, (target - tl.clock - dt) * 0.1));
            }
            tl.clockAt = now;
            return tl.clock;
        };
        return tl;
    }

    function makeCode() {
        let code = "";
        for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        return code;
    }

    function cleanName(name) {
        return String(name || "").replace(/[<>&"'`\\]/g, "").trim().slice(0, 26) || "Guest";
    }

    function round(v, digits) {
        const m = 10 ** digits;
        return Math.round(v * m) / m;
    }

    function status(text) {
        const el = document.querySelector(".online-status");
        if (el) el.textContent = text;
    }

    function pingMeter(rows) {
        let el = document.querySelector(".ping-meter");
        if (!el) {
            el = document.createElement("div");
            el.className = "ping-meter";
            document.querySelector(".ui").appendChild(el);
        }
        el.hidden = !rows.length;
        el.innerHTML = rows.map(({name, ms}) => {
            const level = typeof ms !== "number" ? "waiting" : ms < 80 ? "good" : ms < 160 ? "ok" : "bad";
            const label = typeof ms !== "number" ? "…" : Math.round(ms) + " ms";
            const who = name ? cleanName(name) : "Ping" + (O.via ? " · " + O.via : "");
            return `<span class="ping ${level}" title="Round trip time${name ? " to " + who : " to the host"}">` +
                `<i class="bars"><i></i><i></i><i></i></i> ${who} <b>${label}</b></span>`;
        }).join("");
    }

    function banner(text) {
        let el = document.querySelector(".room-banner");
        if (!el) {
            el = document.createElement("div");
            el.className = "room-banner";
            document.querySelector(".ui").appendChild(el);
        }
        el.textContent = text;
    }

    function safeHtml(html) {
        const tpl = document.createElement("template");
        tpl.innerHTML = html;
        (function clean(node) {
            for (const child of [...node.childNodes]) {
                if (child.nodeType === Node.TEXT_NODE) continue;
                if (child.nodeType !== Node.ELEMENT_NODE || !["SPAN", "DIV", "I"].includes(child.tagName)) {
                    child.replaceWith(document.createTextNode(child.textContent || ""));
                    continue;
                }
                for (const attr of [...child.attributes]) {
                    const ok = attr.name === "class" ||
                        (attr.name === "style" && /^\s*color:\s*#[0-9a-f]{3,8};?\s*$/i.test(attr.value));
                    if (!ok) child.removeAttribute(attr.name);
                }
                clean(child);
            }
        })(tpl.content);
        return tpl.innerHTML;
    }

    function addLog(html) {
        const log = document.querySelector(".log");
        if (!log) return;
        const div = document.createElement("div");
        div.innerHTML = safeHtml(html);
        log.appendChild(div);
        setTimeout(() => div.classList.add("hide"), 7000);
        setTimeout(() => div.remove(), 7300);
    }

    Object.assign(O, {PREFIX, SNAPSHOT_MS, RENDER_DELAY_MS, TIMEOUT_MS, JOIN_TIMEOUT_MS, CODE_CHARS, GUEST_COLORS, KEYS});
    Object.assign(O, {engine, peerOptions, serverUrl, newPeer, errorText, makeTimeline, makeCode, cleanName, round, status, banner, pingMeter, safeHtml, addLog});
})();
