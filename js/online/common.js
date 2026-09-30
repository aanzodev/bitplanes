// Online play: shared settings and helpers.
//
// One browser hosts: it runs the real game (a death match) and gets a room
// code. Friends join with that code over a direct WebRTC connection (PeerJS).
// Guests send their key presses to the host; the host simulates their planes
// and sends back snapshots of the world ~20 times a second, which guests draw.
//
// Files: common.js (this), sync.js (turning game objects into messages),
// host.js, guest.js and lobby.js (the buttons on the start screen).
(function () {
    const O = window.BitOnline = {};
    O.role = null; // "host" | "guest"

    const PREFIX = "bitplanes-room-";
    const SNAPSHOT_MS = 33; // ~30 snapshots per second
    // Guests draw the world this far in the past so there are always two
    // snapshots to blend between, even when one arrives a bit late.
    const RENDER_DELAY_MS = 90;
    const TIMEOUT_MS = 6000;
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

    function peerOptions() {
        // ?peerhost=192.168.1.10&peerport=9000 uses your own PeerJS server,
        // e.g. one running on your local network. Default: the free PeerJS cloud.
        const q = new URLSearchParams(location.search);
        const host = q.get("peerhost");
        if (!host) return {debug: 1};
        return {
            host,
            port: Number(q.get("peerport") || 9000),
            path: q.get("peerpath") || "/",
            secure: q.get("peersecure") === "1",
            debug: 1,
        };
    }

    function makeCode() {
        let code = "";
        for (let i = 0; i < 5; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
        return code;
    }

    function cleanName(name) {
        return String(name || "").replace(/[<>&"'`\\]/g, "").trim().slice(0, 16) || "Guest";
    }

    function round(v, digits) {
        const m = 10 ** digits;
        return Math.round(v * m) / m;
    }

    function status(text) {
        const el = document.querySelector(".online-status");
        if (el) el.textContent = text;
    }

    // Ping meter (online games only). rows: [{name, ms}], name empty for the guest's own ping.
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
            const who = name ? cleanName(name) : "Ping";
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

    // Only allow simple markup in kill messages coming from the host.
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

    Object.assign(O, {PREFIX, SNAPSHOT_MS, RENDER_DELAY_MS, TIMEOUT_MS, CODE_CHARS, GUEST_COLORS, KEYS});
    Object.assign(O, {engine, peerOptions, makeCode, cleanName, round, status, banner, pingMeter, safeHtml, addLog});
})();
