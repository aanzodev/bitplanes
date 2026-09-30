// Online play, guest side: joins a room, draws the host's snapshots and
// sends key presses back.
(function () {
    const O = window.BitOnline;
    const {PREFIX, SNAPSHOT_MS, RENDER_DELAY_MS, TIMEOUT_MS, KEYS, engine, peerOptions, cleanName, status, banner, pingMeter, addLog, engineClasses, indexSprites, applyLook, spawnParticle} = O;

    const guest = {conn: null, code: null, world: null, objects: new Map(), me: 0, last: 0, offsets: [], offset: null, input: {}};

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
            const conn = peer.connect(PREFIX + code, {reliable: true, serialization: "json"});
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
        else if (msg.t === "pong") onPong(msg);
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
        O.prediction.start(world, m => guest.conn && guest.conn.open && guest.conn.send(m));

        const me = {
            hasPlane: () => {
                const local = O.prediction.plane();
                if (local) return local;
                const o = guest.objects.get(guest.me);
                return o && o.constructor === engineClasses().Plane ? o : undefined;
            },
            hasPilot: () => {
                const o = guest.objects.get(guest.me);
                return o && o.constructor === engineClasses().Pilot ? o : undefined;
            },
        };
        window.BitSound && window.BitSound.setListener(() => me.hasPlane() || me.hasPilot());
        const [camera, ctx] = e.camera(1.25, document.querySelector("#canvas"));
        e.loop(camera, ctx, world, (cam, alpha) => e.follow(cam, world, me, alpha), g => e.scoreboard(g, world.players));
        e.minimap(world);
        bindGuestKeys();
        banner("Room " + guest.code);
        setInterval(() => {
            sendPing();
            if (performance.now() - guest.last > TIMEOUT_MS) hostLeft();
        }, 1000);
        window.addEventListener("beforeunload", () => guest.conn && guest.conn.close());
        pingMeter([{name: "", ms: null}]);
        sendPing();
    }

    // Ping: the host echoes our timestamp back; the round trip is the ping.
    function sendPing() {
        if (guest.conn && guest.conn.open) guest.conn.send({t: "ping", c: performance.now()});
    }

    function onPong(msg) {
        const sample = performance.now() - Number(msg.c);
        if (!Number.isFinite(sample) || sample < 0) return;
        guest.rtt = typeof guest.rtt === "number" ? guest.rtt * 0.6 + sample * 0.4 : sample;
        pingMeter([{name: "", ms: guest.rtt}]);
    }

    function lerpAngle(a, b, t) {
        const d = ((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
        return a + d * t;
    }

    // The host time the guest is currently drawing.
    function renderTime() {
        return performance.now() - (guest.offset || 0) - RENDER_DELAY_MS;
    }

    // Called by the render loop every frame: place every object where it was
    // at renderTime(), blending between the two snapshots around that time.
    function guestAlpha() {
        const t = renderTime();
        for (const [id, o] of guest.objects) {
            if (o.goneAt !== undefined && t >= o.goneAt) {
                removeObject(guest.world, o);
                guest.objects.delete(id);
                continue;
            }
            const h = o.hist;
            if (!h || !h.length) continue;
            let x, y, a;
            if (t <= h[0][0]) [, x, y, a] = h[0];
            else if (t >= h[h.length - 1][0]) [, x, y, a] = h[h.length - 1];
            else {
                let i = h.length - 2;
                while (i > 0 && h[i][0] > t) i--;
                const [t0, x0, y0, a0] = h[i], [t1, x1, y1, a1] = h[i + 1];
                const k = t1 > t0 ? (t - t0) / (t1 - t0) : 1;
                x = x0 + (x1 - x0) * k;
                y = y0 + (y1 - y0) * k;
                a = lerpAngle(a0, a1, k);
            }
            o.position = {x, y};
            o.previous = o.position;
            o.angle = a;
        }
        O.prediction.step();
        return 1;
    }

    // Estimate (local clock - host clock) as the smallest recent difference,
    // i.e. the snapshot that arrived fastest.
    function updateOffset(ts, now) {
        guest.offsets.push(now - ts);
        if (guest.offsets.length > 90) guest.offsets.shift();
        guest.offset = Math.min(...guest.offsets);
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
        o.netId = id;
        guest.objects.set(id, o);
        world.add(o);
        // Sounds for things the host fired (our own bullets are simulated locally).
        const S = window.BitSound;
        if (S && guest.started) {
            if (cls === 2) S.gunAt(o.position);
            if (cls === 1) S.missileAt(o.position);
        }
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
        guest.last = now;
        const ts = typeof msg.ts === "number" ? msg.ts : now;
        updateOffset(ts, now);

        for (const d of msg.d || []) createObject(world, d);
        guest.started = true; // no sounds for everything already flying when we joined
        for (const [id, look] of msg.k || []) {
            const o = guest.objects.get(id);
            if (o) applyLook(o, look);
        }
        const seen = new Set();
        for (const [id, x, y, a] of msg.o || []) {
            const o = guest.objects.get(id);
            if (!o) continue;
            seen.add(id);
            if (!o.hist) {
                o.hist = [];
                o.position = o.previous = {x, y};
                o.angle = a;
            }
            o.hist.push([ts, x, y, a]);
            if (o.hist.length > 10) o.hist.shift();
        }
        // Objects missing from the snapshot are removed once the drawn time catches up.
        for (const o of guest.objects.values()) {
            if (!seen.has(o.netId) && o.goneAt === undefined) o.goneAt = ts;
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

        O.prediction.sync(guest.objects.get(guest.me), msg.h);
        const plane = guest.objects.get(guest.me);
        if (!O.prediction.plane() && msg.h && plane && plane.constructor === engineClasses().Plane) {
            [plane.ammo, plane.maxAmmo, plane.missiles, plane.maxMissiles, plane.thrust, plane.maxThrust,
                plane.flares, plane.maxFlares] = msg.h;
            e.cockpit(plane);
        }
        // Particles are delayed like everything else so they line up with the planes.
        if (msg.fx && msg.fx.length) setTimeout(() => msg.fx.forEach(p => spawnParticle(world, p)), RENDER_DELAY_MS);
    }

    function bindGuestKeys() {
        const held = ["up", "down", "left", "right", "fire"];
        const send = () => {
            if (!guest.conn || !guest.conn.open) return;
            const i = guest.input;
            O.prediction.setInput({...i});
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
