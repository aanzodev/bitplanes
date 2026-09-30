// Online play with room codes.
//
// One browser hosts: it runs the real game (a death match) and gets a room
// code. Friends join with that code over a direct WebRTC connection (PeerJS).
// Guests send their key presses to the host; the host simulates their planes
// and sends back snapshots of the world ~20 times a second, which guests draw.
(function () {
    const PREFIX = "bitplanes-room-";
    const SNAPSHOT_MS = 50;
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
    };

    let role = null; // "host" | "guest"

    // ---------------------------------------------------------------- helpers

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

    function banner(text) {
        let el = document.querySelector(".room-banner");
        if (!el) {
            el = document.createElement("div");
            el.className = "room-banner";
            document.querySelector(".ui").appendChild(el);
        }
        el.textContent = text;
    }

    let classes;

    function engineClasses() {
        if (classes) return classes;
        const r = engine().require;
        const p = r(10);
        classes = {
            // plane, missile, bullet, pilot, parachute, barn, cow
            bodies: [r(4).a, r(5).a, r(15).a, r(8).b, r(8).a, r(17).a, r(11).a],
            particles: [p.f, p.a, p.c, p.b, p.d, p.e],
        };
        classes.Plane = classes.bodies[0];
        classes.Pilot = classes.bodies[3];
        classes.Cow = classes.bodies[6];
        return classes;
    }

    // Sprites are sent by name ("explosion.3") or, for planes, by their look.
    let spriteKeys, spritesByKey;

    function indexSprites() {
        if (spriteKeys) return;
        spriteKeys = new Map();
        spritesByKey = new Map();
        const Sprite = engine().Sprite;
        (function walk(obj, path) {
            for (const k of Object.keys(obj)) {
                const v = obj[k];
                const p = path ? path + "." + k : k;
                if (v instanceof Sprite) {
                    spriteKeys.set(v, p);
                    spritesByKey.set(p, v);
                } else if (v && typeof v === "object") {
                    walk(v, p);
                }
            }
        })(engine().sprites, "");
    }

    function spriteKey(sprite) {
        if (!sprite) return null;
        if (sprite.planeKey) return "plane|" + sprite.planeKey.join("|");
        return spriteKeys.get(sprite) || null;
    }

    function spriteFromKey(key) {
        if (spritesByKey.has(key)) return spritesByKey.get(key);
        if (typeof key === "string" && key.startsWith("plane|")) {
            const [, color, pilot, skin] = key.split("|");
            if (!/^#[0-9a-f]{3,8}$/i.test(color)) return null;
            const sprite = new (engine().Sprite)(window.bitPlaneImage(color, pilot === "1", skin || undefined), 36, 22);
            spritesByKey.set(key, sprite);
            return sprite;
        }
        return null;
    }

    function lookKey(o) {
        let key = spriteKey(o.sprite) || "";
        if (o.constructor === classes.Cow) key += "~" + [o.running ? 1 : 0, o.direction, o.dead ? 1 : 0].join(",");
        return key;
    }

    function applyLook(o, key) {
        const [sprite, cow] = String(key).split("~");
        const s = spriteFromKey(sprite);
        if (s) o.sprite = s;
        if (cow) {
            const [running, direction, dead] = cow.split(",").map(Number);
            o.running = !!running;
            o.direction = direction;
            o.dead = !!dead;
        }
    }

    function isVector(v) {
        return v && typeof v === "object" && typeof v.x === "number" && typeof v.y === "number" && Object.keys(v).length === 2;
    }

    const TIME_FIELDS = ["createdAt", "timeSinceFrameShown"];

    function serializeParticle(p) {
        const cls = classes.particles.indexOf(p.constructor);
        if (cls < 0) return null;
        const now = performance.now();
        const f = {};
        for (const [k, v] of Object.entries(p)) {
            if (typeof v === "number") f[k] = TIME_FIELDS.includes(k) ? now - v : round(v, 3);
            else if (typeof v === "string" || typeof v === "boolean") f[k] = v;
            else if (k === "sprite") {
                const s = spriteKey(v);
                if (!s) return null;
                f.sprite = s;
            } else if (k === "sprites" && Array.isArray(v)) {
                const s = v.map(spriteKey);
                if (s.some(x => !x)) return null;
                f.sprites = s;
            } else if (isVector(v)) f[k] = {x: round(v.x, 1), y: round(v.y, 1)};
        }
        return [cls, f];
    }

    function spawnParticle(world, [cls, f]) {
        const C = classes.particles[cls];
        if (!C) return;
        const p = Object.create(C.prototype);
        const now = performance.now();
        for (const [k, v] of Object.entries(f)) {
            if (k === "sprite") p.sprite = spriteFromKey(v);
            else if (k === "sprites") p.sprites = v.map(spriteFromKey);
            else if (TIME_FIELDS.includes(k)) p[k] = now - v;
            else if (v && typeof v === "object") p[k] = {x: v.x, y: v.y};
            else p[k] = v;
        }
        if (("sprite" in f && !p.sprite) || (p.sprites && p.sprites.some(s => !s))) return;
        world.particles.add(p);
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

    // ------------------------------------------------------------------- host

    const host = {peer: null, code: null, world: null, clients: new Map(), pending: [], nextId: 1, fx: new Set()};

    function startHost() {
        if (role) return;
        role = "host";
        status("Creating room…");
        openHostPeer();
    }

    function openHostPeer() {
        const code = makeCode();
        const peer = new Peer(PREFIX + code, peerOptions());
        host.peer = peer;
        peer.on("open", () => {
            host.code = code;
            status("Room " + code + " is open.");
            const dm = document.querySelector('input[name="mode"][value="death-match"]');
            if (dm) dm.checked = true;
            document.getElementById("game").requestSubmit();
        });
        peer.on("connection", conn => {
            conn.on("data", msg => onHostData(conn, msg));
            conn.on("close", () => removeGuest(conn));
            conn.on("error", () => removeGuest(conn));
            conn.on("iceStateChanged", state => {
                if (state === "failed" || state === "closed") removeGuest(conn);
            });
        });
        peer.on("disconnected", () => {
            // Lost the signaling server; reconnect so new friends can still join.
            if (!peer.destroyed) peer.reconnect();
        });
        peer.on("error", err => {
            if (err.type === "unavailable-id") {
                peer.destroy();
                openHostPeer();
            } else if (!host.world) {
                role = null;
                status("Couldn't create a room (" + err.type + "). Check your internet connection.");
            } else {
                console.warn("PeerJS:", err);
            }
        });
    }

    // Called by the death match once its world exists.
    function onWorld(world, localPlayer) {
        if (role !== "host") return;
        engineClasses();
        indexSprites();
        host.world = world;
        host.local = localPlayer;

        const add = world.particles.add.bind(world.particles);
        // Remember new particles; they are sent (in their current state) with the next snapshot.
        world.particles.add = p => {
            if (host.clients.size) host.fx.add(p);
            return add(p);
        };
        window.bitOnLog = html => broadcast({t: "log", h: html});

        updateHostBanner();
        setInterval(sendSnapshots, SNAPSHOT_MS);
        // Drop guests that went silent (closed tab, lost connection).
        setInterval(() => {
            const now = performance.now();
            for (const [conn, c] of host.clients) {
                if (now - c.lastSeen > TIMEOUT_MS) {
                    removeGuest(conn);
                    conn.close();
                }
            }
        }, 1000);
        window.addEventListener("beforeunload", () => host.peer && host.peer.destroy());
        host.pending.splice(0).forEach(spawnGuest);
    }

    function updateHostBanner() {
        const n = [...host.clients.values()].filter(c => c.player).length;
        banner(`Room code: ${host.code} · ${n} friend${n === 1 ? "" : "s"} connected`);
    }

    function hostLog(html) {
        addLog(html);
        broadcast({t: "log", h: html});
    }

    function broadcast(msg) {
        for (const c of host.clients.values()) if (c.player && c.conn.open) c.conn.send(msg);
    }

    function cleanLoadout(l) {
        l = l || {};
        const n = (v, lo, hi, d) => {
            v = Number(v);
            return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
        };
        return {
            color: /^#[0-9a-f]{3,8}$/i.test(l.color) ? l.color : GUEST_COLORS[0],
            skin: l.skin === "jet" ? "jet" : "",
            thrust: n(l.thrust, 0.5, 2, 1),
            turn: n(l.turn, 0.5, 2, 1),
            reload: n(l.reload, 0.3, 1.5, 1),
            bulletSpeed: n(l.bulletSpeed, 1, 2, 1),
            life: Math.round(n(l.life, 0, 10, 0)),
            ammo: Math.round(n(l.ammo, -10, 40, 0)),
            missiles: Math.round(n(l.missiles, 0, 6, 0)),
        };
    }

    function onHostData(conn, msg) {
        if (!msg || typeof msg !== "object") return;
        let client = host.clients.get(conn);
        if (client) client.lastSeen = performance.now();
        if (msg.t === "hello") {
            if (client) return;
            client = {
                conn,
                name: cleanName(msg.name),
                loadout: cleanLoadout(msg.loadout),
                input: {},
                known: new WeakSet(),
                looks: new WeakMap(),
                player: null,
                lastSeen: performance.now(),
            };
            host.clients.set(conn, client);
            if (host.world) spawnGuest(client);
            else host.pending.push(client);
            return;
        }
        if (!client || !client.player) return;
        if (msg.t === "in" && msg.s) {
            client.input = {u: !!msg.s.u, d: !!msg.s.d, l: !!msg.s.l, r: !!msg.s.r, f: !!msg.s.f};
        } else if (msg.t === "act") {
            const world = host.world, player = client.player, controls = engine().controls;
            const plane = player.hasPlane();
            if (msg.a === "missile" && plane) controls.e(world, plane);
            if (msg.a === "catapult") {
                if (plane) controls.b(world, player);
                else {
                    const pilot = player.hasPilot();
                    pilot && pilot.deployParachute(world);
                }
            }
        }
    }

    function spawnGuest(client) {
        if (!host.clients.has(client.conn)) return;
        const {Plane, Player, vec, consts} = engine();
        const world = host.world;
        const used = new Set(world.players.filter(p => p.isHuman || p.remote).map(p => p.color));
        let color = client.loadout.color;
        if (used.has(color)) color = GUEST_COLORS.find(c => !used.has(c)) || color;

        const plane = new Plane(color);
        const player = new Player(client.name, color, plane);
        player.remote = client;
        player.loadout = client.loadout;
        player.loadoutColor = color;
        player.maxAmmo = consts.f;
        plane.life = consts.h;
        plane.maxAmmo = plane.ammo = consts.f;
        plane.landed = true;
        plane.move(vec(world.width / 2 + (1200 * Math.random() - 600), world.ground));
        player.control(plane);
        world.players.push(player);
        world.add(plane);
        client.player = player;
        client.control = startRemoteControl(world, player, client);

        client.conn.send({
            t: "welcome",
            code: host.code,
            world: {width: world.width, height: world.height, ground: world.ground, stratosphere: world.stratosphere},
        });
        updateHostBanner();
        hostLog(`<span class="message">${player.html()} joined</span>`);
    }

    // Mirrors the keyboard controls, but driven by the guest's key presses.
    function startRemoteControl(world, player, client) {
        const controls = engine().controls, consts = engine().consts;
        return setInterval(() => {
            const input = client.input, plane = player.hasPlane();
            if (plane) {
                if (input.f) controls.d(world, plane);
                if (input.d) plane.thrust = Math.max(0, plane.thrust - 2);
                if (input.u) plane.thrust = Math.min(plane.maxThrust || consts.k, plane.thrust + 2);
                plane.elevator = input.l && !input.r ? -1 : !input.l && input.r ? 1 : 0;
                return;
            }
            const pilot = player.hasPilot();
            if (!pilot) return;
            if (pilot.landed) {
                if (input.l && !input.r) pilot.velocity.x = -10;
                else if (!input.l && input.r) pilot.velocity.x = 10;
            }
            if (pilot.parachute) {
                if (input.l && !input.r) pilot.velocity.x = -20;
                else if (!input.l && input.r) pilot.velocity.x = 20;
            }
            if (pilot.landed && input.u) {
                pilot.landed = false;
                pilot.velocity.y = -10;
            }
        }, consts.c);
    }

    function removeGuest(conn) {
        const client = host.clients.get(conn);
        if (!client) return;
        host.clients.delete(conn);
        clearInterval(client.control);
        const player = client.player;
        if (player && host.world) {
            const world = host.world;
            // Stop the death match from respawning a plane for someone who left.
            player.inGame = () => true;
            const obj = player.object;
            if (obj && world.has(obj)) world.delete(obj);
            player.detach();
            const index = world.players.indexOf(player);
            if (index >= 0) world.players.splice(index, 1);
            hostLog(`<span class="message">${player.html()} left</span>`);
        }
        updateHostBanner();
    }

    function rewardRemote(player) {
        const c = player.remote;
        if (c && c.conn.open) c.conn.send({t: "coins"});
    }

    function sendSnapshots() {
        const world = host.world;
        if (![...host.clients.values()].some(c => c.player)) {
            host.fx.clear();
            return;
        }
        const all = [];
        const entries = [];
        for (const o of world) {
            if (classes.bodies.indexOf(o.constructor) < 0) continue;
            if (!o.netId) o.netId = host.nextId++;
            all.push(o);
            entries.push([o.netId, round(o.position.x, 1), round(o.position.y, 1), round(o.angle, 3)]);
        }
        const players = world.players.map(p => [
            p.name, p.color, p.kills, p.deaths, p.object && p.object.netId || 0,
        ]);
        const fx = [];
        for (const p of host.fx) {
            if (!world.particles.has(p)) continue;
            const s = serializeParticle(p);
            if (s) fx.push(s);
        }
        host.fx.clear();
        const consts = engine().consts;

        for (const client of host.clients.values()) {
            if (!client.player || !client.conn.open) continue;
            const defs = [], looks = [];
            for (const o of all) {
                const look = lookKey(o);
                if (!client.known.has(o)) {
                    client.known.add(o);
                    client.looks.set(o, look);
                    defs.push([o.netId, classes.bodies.indexOf(o.constructor), look, o.radius]);
                } else if (client.looks.get(o) !== look) {
                    client.looks.set(o, look);
                    looks.push([o.netId, look]);
                }
            }
            const mine = client.player.object;
            const hud = mine && mine.constructor === classes.Plane
                ? [mine.ammo, mine.maxAmmo, mine.missiles, mine.maxMissiles, mine.thrust, mine.maxThrust || consts.k]
                : null;
            client.conn.send({t: "s", o: entries, d: defs, k: looks, p: players, fx, me: mine && mine.netId || 0, h: hud});
        }
    }

    // ------------------------------------------------------------------ guest

    const guest = {conn: null, code: null, world: null, objects: new Map(), me: 0, last: 0, interval: SNAPSHOT_MS, input: {}};

    function join(code) {
        if (role) return;
        code = String(code || "").trim().toUpperCase();
        if (!/^[A-Z0-9]{5}$/.test(code)) {
            status("Enter the 5 character room code.");
            return;
        }
        role = "guest";
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
            role = null;
            status(err.type === "peer-unavailable"
                ? "Room " + code + " not found. Check the code and try again."
                : "Couldn't connect (" + err.type + ").");
            peer.destroy();
        });
    }

    function hostLeft() {
        if (guest.gone) return;
        if (!guest.world) {
            role = null;
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
                return o && o.constructor === classes.Plane ? o : undefined;
            },
            hasPilot: () => {
                const o = guest.objects.get(guest.me);
                return o && o.constructor === classes.Pilot ? o : undefined;
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
        const C = classes.bodies[cls];
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
                return o && o.constructor === classes.Plane ? o : undefined;
            },
            hasPilot() {
                const o = guest.objects.get(objectId);
                return o && o.constructor === classes.Pilot ? o : undefined;
            },
            inGame() {
                return guest.objects.has(objectId);
            },
        }));

        const plane = guest.objects.get(guest.me);
        if (msg.h && plane && plane.constructor === classes.Plane) {
            [plane.ammo, plane.maxAmmo, plane.missiles, plane.maxMissiles, plane.thrust, plane.maxThrust] = msg.h;
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
            for (const k of ["missile", "catapult"]) {
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

    // --------------------------------------------------------------------- UI

    function init() {
        const hostBtn = document.querySelector(".host-game");
        const joinBtn = document.querySelector(".join-game");
        const codeInput = document.querySelector(".room-code");
        if (typeof Peer === "undefined") {
            status("Online play is unavailable (PeerJS failed to load).");
            if (hostBtn) hostBtn.disabled = true;
            if (joinBtn) joinBtn.disabled = true;
            return;
        }
        hostBtn && hostBtn.addEventListener("click", startHost);
        joinBtn && joinBtn.addEventListener("click", () => join(codeInput.value));
        codeInput && codeInput.addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                join(codeInput.value);
            }
        });
        const q = new URLSearchParams(location.search).get("room");
        if (q && codeInput) codeInput.value = q.toUpperCase();
    }

    window.BitNet = {onWorld, rewardRemote, host: startHost, join};

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
