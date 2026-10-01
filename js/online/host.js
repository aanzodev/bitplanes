// Online play, host side: opens the room, adds guests' planes to the activity,
// drives them with the guests' key presses and sends out snapshots.
(function () {
    const O = window.BitOnline;
    const {PREFIX, SNAPSHOT_MS, TIMEOUT_MS, GUEST_COLORS, engine, peerOptions, makeCode, cleanName, round, status, banner, addLog, engineClasses, indexSprites, lookKey, serializeParticle} = O;

    const host = {peer: null, code: null, world: null, clients: new Map(), pending: [], nextId: 1, fx: new Set()};

    function startHost() {
        if (O.role) return;
        O.role = "host";
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
            document.getElementById("activity").requestSubmit();
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
                // Never got a room: stop trying and let the player retry.
                peer.destroy();
                O.role = null;
                status("Couldn't create a room (" + err.type + "). Check your internet connection.");
            } else {
                console.warn("PeerJS:", err);
            }
        });
    }

    // Called by the death match once its world exists.
    function onWorld(world, localPlayer) {
        if (O.role !== "host") return;
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
        keepRunning(world);
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

    // Browsers pause animation frames in covered or hidden windows, and slow
    // down their timers. A Web Worker timer is not slowed down, so it keeps the
    // host's activity simulating and sending snapshots while the host looks away.
    function keepRunning(world) {
        let last = 0;
        const beat = () => {
            world.tick && world.tick();
            const now = performance.now();
            if (now - last >= SNAPSHOT_MS - 4) {
                last = now;
                sendSnapshots();
            }
        };
        try {
            const src = "setInterval(function () { postMessage(0); }, 16);";
            const worker = new Worker(URL.createObjectURL(new Blob([src], {type: "text/javascript"})));
            worker.onmessage = beat;
        } catch (e) {
            setInterval(beat, 16);
        }
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
            skin: ["jet", "prop", "bomber"].includes(l.skin) ? l.skin : "",
            planeId: typeof l.planeId === "string" && /^[a-z0-9]{1,20}$/.test(l.planeId) ? l.planeId : "classic",
            thrust: n(l.thrust, 0.5, 2, 1),
            turn: n(l.turn, 0.5, 2, 1),
            reload: n(l.reload, 0.3, 1.5, 1),
            bulletSpeed: n(l.bulletSpeed, 1, 2.2, 1),
            missileReload: n(l.missileReload, 0.5, 1, 1),
            repair: Math.round(n(l.repair, 0, 3, 0)),
            life: Math.round(n(l.life, 0, 10, 0)),
            ammo: Math.round(n(l.ammo, -10, 40, 0)),
            missiles: Math.round(n(l.missiles, 0, 6, 0)),
            flares: Math.round(n(l.flares, 0, 8, 0)),
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
        if (msg.t === "loadout") {
            // New plane choice from the guest's menu: used for their next plane.
            client.loadout = cleanLoadout(msg.l);
            client.player.loadout = client.loadout;
            client.player.loadoutColor = client.loadout.color;
        } else if (msg.t === "paint" && /^#[0-9a-f]{3,8}$/i.test(msg.c)) {
            // New paint: repaint the guest's current plane right away.
            const player = client.player, plane = player.hasPlane();
            client.loadout.color = player.loadoutColor = msg.c;
            if (plane && plane.planeId === client.loadout.planeId) {
                plane.setSkin(msg.c, plane.skin);
                player.color = msg.c;
            }
        } else if (msg.t === "st" && Array.isArray(msg.s)) {
            applyGuestPlane(client, msg.s);
        } else if (msg.t === "ping") {
            // Echo the guest's timestamp so it can measure its own ping.
            if (client.conn.open) client.conn.send({t: "pong", c: msg.c});
        } else if (msg.t === "in" && msg.s) {
            client.input = {u: !!msg.s.u, d: !!msg.s.d, l: !!msg.s.l, r: !!msg.s.r, f: !!msg.s.f};
            // Turn right away instead of waiting for the next control tick.
            const plane = client.player.hasPlane(), i = client.input;
            if (plane && !plane.remoteDriven) plane.elevator = i.l && !i.r ? -1 : !i.l && i.r ? 1 : 0;
        } else if (msg.t === "act") {
            const world = host.world, player = client.player, controls = engine().controls;
            const plane = player.hasPlane();
            if (msg.a === "missile" && plane) controls.e(world, plane);
            if (msg.a === "flare" && plane) controls.f(world, plane);
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
            world: {width: world.width, height: world.height, ground: world.ground, stratosphere: world.stratosphere, map: world.map && world.map.id},
        });
        updateHostBanner();
        hostLog(`<span class="message">${player.html()} joined</span>`);
    }

    // Mirrors the keyboard controls, but driven by the guest's key presses.
    // The guest flies its own plane and reports where it is; copy that onto
    // our plane. Hits, damage and crashes are still worked out here.
    function applyGuestPlane(client, s) {
        const plane = client.player.hasPlane(), world = host.world;
        const [id, x, y, vx, vy, a, thrust, elevator, landed] = s.map(Number);
        if (!plane || plane.netId !== id || ![x, y, vx, vy, a, thrust].every(Number.isFinite)) return;
        const max = plane.maxThrust || engine().consts.k;
        plane.remoteDriven = true;
        plane.previous = plane.position;
        plane.position = {x: Math.min(world.width, Math.max(0, x)), y: Math.min(world.ground, Math.max(-5000, y))};
        plane.velocity = {x: vx, y: vy};
        plane.angle = a;
        plane.thrust = Math.min(max, Math.max(0, thrust));
        plane.elevator = Math.sign(elevator) || 0;
        plane.landed = !!landed;
    }

    function startRemoteControl(world, player, client) {
        const controls = engine().controls, consts = engine().consts;
        return setInterval(() => {
            const input = client.input, plane = player.hasPlane();
            if (plane) {
                if (input.f) controls.d(world, plane);
                if (plane.remoteDriven) return; // the guest flies it and reports its position
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
            player.inActivity = () => true;
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
            if (engineClasses().bodies.indexOf(o.constructor) < 0) continue;
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
            // A guest draws its own bullets itself, so leave those out.
            const mine = client.player.object;
            const own = o => o.source === mine && o.constructor === engineClasses().bodies[2];
            for (const o of all) {
                if (own(o)) continue;
                const look = lookKey(o);
                if (!client.known.has(o)) {
                    client.known.add(o);
                    client.looks.set(o, look);
                    defs.push([o.netId, engineClasses().bodies.indexOf(o.constructor), look, o.radius]);
                } else if (client.looks.get(o) !== look) {
                    client.looks.set(o, look);
                    looks.push([o.netId, look]);
                }
            }
            const hud = mine && mine.constructor === engineClasses().Plane
                ? [mine.ammo, mine.maxAmmo, mine.missiles, mine.maxMissiles, mine.thrust, mine.maxThrust || consts.k,
                    mine.flares || 0, mine.maxFlares || 0, mine.landed ? 1 : 0]
                : null;
            const list = mine ? entries.filter((e, k) => !own(all[k])) : entries;
            client.conn.send({t: "s", ts: round(performance.now(), 1), o: list, d: defs, k: looks, p: players, fx, me: mine && mine.netId || 0, h: hud});
        }
    }

    Object.assign(O, {startHost, onWorld, rewardRemote, hostState: host});
})();
