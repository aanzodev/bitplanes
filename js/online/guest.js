// Online play, guest side: joins a room, draws the host's snapshots and
// sends key presses back.
(function () {
    const O = window.BitOnline;
    const {PREFIX, SNAPSHOT_MS, TIMEOUT_MS, KEYS, engine, peerOptions, cleanName, status, banner, addLog, engineClasses, indexSprites, applyLook, spawnParticle} = O;

    const guest = {conn: null, code: null, world: null, objects: new Map(), me: 0, last: 0, interval: SNAPSHOT_MS, input: {}};

    function join(code) {
        if (O.role) return;
        code = String(code || "").trim().toUpperCase();
        if (!/^[A-Z0-9]{5}$/.test(code)) {
            status("Enter the 5 character room code.");
            return;
        }
        O.role = "guest";
        guest.code = code;
        status("Connecting to room " + code + "…");
        const peer = new Peer(peerOptions());
        peer.on("open", () => {
            const conn = peer.connect(PREFIX + code, {reliable: true});
            guest.conn = conn;
            conn.on("open", () => {
                conn.send({
                    t: "hello",
                    name: (document.getElementsByName("nickname")[0] || {}).value || "Guest",
                    loadout: window.BitShop ? window.BitShop.loadout() : {},
                });
            });
            conn.on("data", onGuestData);
            conn.on("close", hostLeft);
        });
        peer.on("error", err => {
            if (guest.world) return console.warn("PeerJS:", err);
            O.role = null;
            status(err.type === "peer-unavailable"
                ? "Room " + code + " not found. Check the code and try again."
                : "Couldn't connect (" + err.type + ").");
            peer.destroy();
        });
    }

    function hostLeft() {
        if (guest.gone) return;
        if (!guest.world) {
            O.role = null;
            status("The host closed the room.");
            return;
        }
        guest.gone = true;
        alert("The host left the game.");
        location.href = location.pathname;
    }

    function onGuestData(msg) {
        if (!msg || typeof msg !== "object") return;
        if (msg.t === "welcome") {
            guest.last = performance.now();
            startGuestWorld(msg);
        }
        else if (msg.t === "s" && guest.world) applySnapshot(msg);
        else if (msg.t === "log") addLog(String(msg.h || ""));
        else if (msg.t === "coins" && window.BitShop) window.BitShop.reward();
    }

    function startGuestWorld(msg) {
        if (guest.world) return;
        const e = engine();
        engineClasses();
        indexSprites();
        e.stopDemo && e.stopDemo();
        document.querySelector("main").style.display = "none";
        document.querySelector("#canvas").style.display = "block";
        document.querySelector(".ui").style.display = "block";
        document.querySelector(".log").innerHTML = "";

        const w = msg.world || {};
        const world = new e.World({width: w.width, height: w.height, ground: 0, stratosphere: w.stratosphere});
        world.ground = w.ground;
        world.players = [];
        e.decorate(world);
        world.remote = {alpha: guestAlpha};
        guest.world = world;

        const me = {
            hasPlane: () => {
                const o = guest.objects.get(guest.me);
                return o && o.constructor === engineClasses().Plane ? o : undefined;
            },
            hasPilot: () => {
                const o = guest.objects.get(guest.me);
                return o && o.constructor === engineClasses().Pilot ? o : undefined;
            },
        };
        const [camera, ctx] = e.camera(1.25, document.querySelector("#canvas"));
        e.loop(camera, ctx, world, (cam, alpha) => e.follow(cam, world, me, alpha), g => e.scoreboard(g, world.players));
        e.minimap(world);
        bindGuestKeys();
        banner("Room " + guest.code);
        setInterval(() => {
            if (guest.conn && guest.conn.open) guest.conn.send({t: "ping"});
            if (performance.now() - guest.last > TIMEOUT_MS) hostLeft();
        }, 1000);
        window.addEventListener("beforeunload", () => guest.conn && guest.conn.close());
    }

    function lerpAngle(a, b, t) {
        const d = ((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        return a + d * t;
    }

    function guestAlpha() {
        const t = Math.min(1, (performance.now() - guest.last) / guest.interval);
        for (const o of guest.objects.values()) {
            if (o.nextAngle !== undefined) o.angle = lerpAngle(o.prevAngle, o.nextAngle, t);
        }
        return t;
    }

    function createObject(world, [id, cls, look, radius]) {
        const C = engineClasses().bodies[cls];
        if (!C || guest.objects.has(id)) return;
        const o = Object.create(C.prototype);
        Object.assign(o, {
            timeouts: [], intervals: [], circles: [],
            position: {x: 0, y: 0}, previous: {x: 0, y: 0}, velocity: {x: 0, y: 0}, force: {x: 0, y: 0},
            forward: {x: 1, y: 0}, normal: {x: 0, y: 1},
            angle: 0, radius: radius || 1, mass: 1, t2: 0, frame: 0,
        });
        applyLook(o, look);
        if (!o.sprite) return;
        guest.objects.set(id, o);
        world.add(o);
    }

    function removeObject(world, o) {
        world.bodies.delete(o);
        world.bullets.delete(o);
        world.pilots.delete(o);
        world.barns.delete(o);
    }

    function applySnapshot(msg) {
        const world = guest.world, e = engine();
        const now = performance.now();
        if (guest.last) guest.interval = guest.interval * 0.8 + Math.min(200, Math.max(20, now - guest.last)) * 0.2;
        guest.last = now;

        for (const d of msg.d || []) createObject(world, d);
        for (const [id, look] of msg.k || []) {
            const o = guest.objects.get(id);
            if (o) applyLook(o, look);
        }
        const seen = new Set();
        for (const [id, x, y, a] of msg.o || []) {
            const o = guest.objects.get(id);
            if (!o) continue;
            seen.add(id);
            if (o.seen) {
                o.previous = {x: o.position.x, y: o.position.y};
                o.prevAngle = o.nextAngle;
            } else {
                o.previous = {x, y};
                o.prevAngle = a;
                o.seen = true;
            }
            o.position = {x, y};
            o.nextAngle = a;
        }
        for (const [id, o] of guest.objects) {
            if (!seen.has(id)) {
                removeObject(world, o);
                guest.objects.delete(id);
            }
        }

        guest.me = msg.me || 0;
        world.players = (msg.p || []).map(([name, color, kills, deaths, objectId]) => ({
            name: cleanName(name), color: /^#[0-9a-f]{3,8}$/i.test(color) ? color : "#000", kills, deaths,
            points() {
                return this.kills;
            },
            hasPlane() {
                const o = guest.objects.get(objectId);
                return o && o.constructor === engineClasses().Plane ? o : undefined;
            },
            hasPilot() {
                const o = guest.objects.get(objectId);
                return o && o.constructor === engineClasses().Pilot ? o : undefined;
            },
            inGame() {
                return guest.objects.has(objectId);
            },
        }));

        const plane = guest.objects.get(guest.me);
        if (msg.h && plane && plane.constructor === engineClasses().Plane) {
            [plane.ammo, plane.maxAmmo, plane.missiles, plane.maxMissiles, plane.thrust, plane.maxThrust,
                plane.flares, plane.maxFlares] = msg.h;
            e.cockpit(plane);
        }
        for (const p of msg.fx || []) spawnParticle(world, p);
    }

    function bindGuestKeys() {
        const held = ["up", "down", "left", "right", "fire"];
        const send = () => {
            if (!guest.conn || !guest.conn.open) return;
            const i = guest.input;
            guest.conn.send({t: "in", s: {u: !!i.up, d: !!i.down, l: !!i.left, r: !!i.right, f: !!i.fire}});
        };
        document.addEventListener("keydown", ev => {
            let handled = false, changed = false;
            for (const k of held) {
                if (KEYS[k].includes(ev.code)) {
                    handled = true;
                    if (!guest.input[k]) changed = guest.input[k] = true;
                }
            }
            for (const k of ["missile", "catapult", "flare"]) {
                if (KEYS[k].includes(ev.code)) {
                    handled = true;
                    if (!ev.repeat && guest.conn && guest.conn.open) guest.conn.send({t: "act", a: k});
                }
            }
            if (handled) ev.preventDefault();
            if (changed) send();
        }, true);
        document.addEventListener("keyup", ev => {
            let changed = false;
            for (const k of held) {
                if (KEYS[k].includes(ev.code) && guest.input[k]) {
                    guest.input[k] = false;
                    changed = true;
                }
            }
            if (changed) {
                ev.preventDefault();
                send();
            }
        }, true);
        window.addEventListener("blur", () => {
            guest.input = {};
            send();
        });
    }

    Object.assign(O, {join, guestState: guest});
})();
