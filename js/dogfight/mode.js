// Dogfights (3D beta): pick "Dogfights" on the mode card and press PLAY.
// Loads three.js (only for this mode), builds the world, puts you in your
// Hangar plane against computer pilots, and runs the loop: input, AI, flight,
// combat, chase camera, HUD and sound. Esc pauses; "Leave" goes back to the lobby.
(function () {
    const D = window.BitDogfight = window.BitDogfight || {};
    const ENEMIES = 7;
    const COINS_PER_KILL = 50;
    const RESPAWN_S = 3;
    const NAMES = ["Viper", "Maverick", "Ghost", "Hawk", "Falcon", "Jester", "Iceman", "Phoenix", "Rooster", "Cyclone",
        "Raven", "Blaze", "Talon", "Nomad", "Vandal", "Wraith", "Kestrel", "Saber", "Rogue", "Banshee"];

    let fight = null;

    // ------------------------------------------------------------ loading

    function loadThree() {
        if (window.THREE) return Promise.resolve(window.THREE);
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = (window.BitBase || "") + "js/vendor/three.min.js";
            s.onload = () => (window.THREE ? resolve(window.THREE) : reject(new Error("three.js didn't load")));
            s.onerror = () => reject(new Error("Couldn't load the 3D engine. Check your connection."));
            document.head.appendChild(s);
        });
    }

    function status(text) {
        const el = document.querySelector(".online-status");
        if (el) el.textContent = text;
    }

    // ------------------------------------------------------------- planes

    function shopStats(p, loadout) {
        // Your plane uses your upgrades; bots fly the stock plane.
        const l = loadout || {thrust: p.thrust, turn: p.turn, reload: p.reload, bulletSpeed: p.bulletSpeed || 1, life: p.life, ammo: p.ammo, missiles: p.missiles, flares: p.flares || 0};
        return {thrust: l.thrust, turn: l.turn, reload: l.reload, bulletSpeed: l.bulletSpeed, life: l.life, ammo: l.ammo, missiles: l.missiles, flares: l.flares};
    }

    function gunOf(planeId) {
        const prof = window.BitSoundProfiles && window.BitSoundProfiles[planeId];
        return (prof && prof.gun) || "vickers";
    }

    const HEAVY = ["mg151", "type99", "shvak", "hispano", "gsh23", "gsh301", "m61", "gau22", "gau8"];

    function makePlane(scene, p, color, name, isPlayer, loadout) {
        const gun = gunOf(p.id);
        const a = new D.Aircraft(scene, {
            name, label: p.name, color, shape: p.skin || "", planeId: p.id, isPlayer,
            stats: shopStats(p, loadout), gun,
        });
        a.heavyGun = HEAVY.includes(gun);
        return a;
    }

    // ------------------------------------------------------------- start

    async function start() {
        if (fight) return;
        status("Loading 3D Dogfights…");
        let THREE;
        try {
            THREE = await loadThree();
        } catch (e) {
            return status(e.message);
        }
        D.THREE = THREE;
        const root = document.createElement("div");
        root.className = "df-root";
        document.body.appendChild(root);
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({antialias: true});
        } catch (e) {
            root.remove();
            return status("Your browser or computer can't show 3D graphics (WebGL is off).");
        }
        status("");
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        root.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(70, 1, 1, 14000);
        const world = D.makeWorld(THREE, scene);
        const hud = D.makeHud(root);

        const shop = window.BitShop;
        const selected = shop.selected();
        const player = makePlane(scene, selected, shop.colorOf(selected), "You", true, shop.loadout());
        const pool = shop.planes.filter(p => !p.exclusive);
        const names = NAMES.slice().sort(() => Math.random() - 0.5);
        const enemies = [];
        for (let k = 0; k < ENEMIES; k++) {
            const p = pool[Math.floor(Math.random() * pool.length)];
            const e = makePlane(scene, p, p.color, names[k % names.length], false);
            e.pilot = D.makePilot(THREE, e, 0.55 + Math.random() * 0.4);
            enemies.push(e);
        }
        const planes = [player, ...enemies];

        const g = fight = {
            THREE, renderer, scene, camera, world, hud, root, player, enemies, planes,
            keys: new Set(), paused: false, time: 0, coins: 0, last: performance.now(), raf: 0,
            respawnAt: {}, lock: null, sounds: makeSounds(), lastEnemyGun: new Map(), fireT: 0,
        };
        g.combat = D.makeCombat(THREE, scene, world, {
            hit: (by, target, dmg) => onHit(by, target, dmg),
            boom: (pos, scale) => g.sounds.boom(pos.distanceTo(player.pos), scale),
        });

        // Everyone starts in the air, the enemies spread out ahead of you.
        spawn(player, 0);
        enemies.forEach((e, k) => spawn(e, k + 1));

        // Stats: one more match played.
        const st = window.BitStats && window.BitStats.get();
        if (st) st.matches++;

        // Keyboard (only while this mode is open).
        g.onKey = ev => {
            if (!fight) return;
            const down = ev.type === "keydown";
            if (ev.code === "Escape") {
                if (down) setPaused(!g.paused);
            } else if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyS", "KeyA", "KeyD", "KeyX", "KeyQ"].includes(ev.code)) {
                if (down) {
                    if (!g.keys.has(ev.code) && !g.paused) {
                        if (ev.code === "KeyX") fireMissile();
                        if (ev.code === "KeyQ") dropFlares();
                    }
                    g.keys.add(ev.code);
                } else g.keys.delete(ev.code);
            } else return;
            ev.preventDefault();
            ev.stopImmediatePropagation();
        };
        window.addEventListener("keydown", g.onKey, true);
        window.addEventListener("keyup", g.onKey, true);
        g.onResize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", g.onResize);
        g.onResize();
        hud.onResume(() => setPaused(false));
        hud.onLeave(stop);
        hud.message(`${world.theme.name} skies · Shoot them down! (Esc for controls)`, 4500);
        loop();
    }

    function spawn(plane, slot) {
        const g = fight, T = g.THREE, w = g.world;
        let pos;
        if (plane.isPlayer) pos = new T.Vector3(0, 1100, w.size * 0.25);
        else {
            // Somewhere in front of the player, at a fair distance.
            const base = g.player.alive ? g.player.pos : new T.Vector3();
            const ang = Math.random() * Math.PI * 2, d = 1400 + Math.random() * 1200;
            pos = new T.Vector3(Math.max(-3000, Math.min(3000, base.x + Math.cos(ang) * d)), 0, Math.max(-3000, Math.min(3000, base.z + Math.sin(ang) * d)));
        }
        pos.y = Math.max(pos.y, w.ground(pos.x, pos.z) + 600 + Math.random() * 400);
        plane.spawn(pos, plane.isPlayer ? new T.Vector3(0, 1000, 0) : g.player.pos.clone().setY(pos.y));
    }

    // ------------------------------------------------------------- combat

    function onHit(by, target, dmg) {
        const g = fight;
        if (!target.alive) return;
        target.health -= dmg;
        target.lastHitBy = by;
        target.lastHitAt = g.time;
        const st = window.BitStats && window.BitStats.get();
        if (by === g.player) {
            g.hud.hit();
            if (st) st.hits++;
        }
        if (target === g.player) g.hud.hurt();
        if (target.health <= 0) destroy(target, by);
    }

    // collidedWith: the other plane in a mid-air collision (quiet: it's already in the feed).
    function destroy(plane, by, collidedWith, quiet) {
        const g = fight;
        g.combat.explosion(plane.pos, plane.radius > 12 ? 1.5 : 1);
        plane.hide();
        plane.deaths++;
        const st = window.BitStats && window.BitStats.get();
        const killer = by && by !== plane ? by : null;
        if (killer) killer.kills++;
        const name = p => (p === g.player ? "<b>You</b>" : p.name);
        if (killer) g.hud.feed(`${name(killer)} <span class="df-feed-icon">✈</span> ${name(plane)}`);
        else if (collidedWith && !quiet) g.hud.feed(`${name(plane)} and ${name(collidedWith)} collided`);
        else if (!collidedWith) g.hud.feed(`${name(plane)} crashed`);
        if (killer === g.player) {
            g.coins += COINS_PER_KILL;
            window.BitShop && window.BitShop.addCoins(COINS_PER_KILL);
            if (st) {
                st.killed++;
                st.coinsEarned += COINS_PER_KILL;
                st.streak++;
                st.bestStreak = Math.max(st.bestStreak, st.streak);
            }
            g.hud.message(`Shot down ${plane.name}! +${COINS_PER_KILL} coins`, 1800);
        }
        if (plane === g.player) {
            if (st) {
                st.deaths++;
                st.streak = 0;
            }
            g.hud.message(killer ? `Shot down by ${killer.name}. Back in ${RESPAWN_S}…`
                : collidedWith ? `You collided with ${collidedWith.name}. Back in ${RESPAWN_S}…` : `You crashed. Back in ${RESPAWN_S}…`, RESPAWN_S * 1000);
        }
        g.respawnAt[g.planes.indexOf(plane)] = g.time + (plane === g.player ? RESPAWN_S : 5);
    }

    // Missile target: the enemy closest to the middle of your view, in front.
    function findLock() {
        const g = fight, p = g.player;
        let best = null, bestDot = Math.cos(14 * Math.PI / 180);
        for (const e of g.enemies) {
            if (!e.alive) continue;
            const to = e.pos.clone().sub(p.pos), d = to.length();
            if (d > 2600) continue;
            const dot = to.normalize().dot(p.forward);
            if (dot > bestDot) [best, bestDot] = [e, dot];
        }
        return best;
    }

    function fireMissile() {
        const g = fight, p = g.player;
        if (!p.alive || p.missiles <= 0) return;
        g.combat.launch(p, g.lock);
        p.missiles--;
        g.sounds.missile(0);
        const st = window.BitStats && window.BitStats.get();
        if (st) st.missiles++;
        if (p.missiles <= 0) p.missileReloadAt = g.time + 10;
    }

    function dropFlares() {
        const g = fight, p = g.player;
        if (!p.alive || p.flares <= 0) return;
        p.flares--;
        g.combat.dropFlares(p);
        g.sounds.flare();
        if (p.flares <= 0) p.flareReloadAt = g.time + 15;
    }

    function shoot(plane, dt) {
        const g = fight;
        plane.gunT = (plane.gunT || 0) - dt;
        if (plane.reloadAt && g.time >= plane.reloadAt) {
            plane.reloadAt = 0;
            plane.ammo = plane.maxAmmo;
        }
        if (plane.gunT > 0 || plane.reloadAt || plane.ammo <= 0) return;
        // Reload upgrades speed the guns up, but not without limit.
        plane.gunT = 0.1 * Math.max(0.6, plane.stats.reload || 1);
        if (!g.combat.fire(plane)) return;
        plane.ammo--;
        if (plane.ammo <= 0) plane.reloadAt = g.time + 2.5 * (plane.stats.reload || 1);
        const d = plane.pos.distanceTo(g.player.pos);
        if (plane === g.player) {
            g.sounds.gun(plane.gun, 0.9);
            const st = window.BitStats && window.BitStats.get();
            if (st) st.bullets++;
        } else if (d < 2500) {
            const last = g.lastEnemyGun.get(plane) || 0;
            if (g.time - last > 0.06) {
                g.lastEnemyGun.set(plane, g.time);
                g.sounds.gun(plane.gun, 0.55 * (1 - d / 2500) ** 2);
            }
        }
    }

    // ------------------------------------------------------------- loop

    function loop() {
        const g = fight;
        if (!g) return;
        g.raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.05, (now - g.last) / 1000);
        g.last = now;
        if (!g.paused) step(dt);
        render(dt);
    }

    function step(dt) {
        const g = fight, p = g.player, k = g.keys, T = g.THREE;
        g.time += dt;
        // Your controls.
        p.input.pitch = (k.has("ArrowUp") ? 1 : 0) - (k.has("ArrowDown") ? 1 : 0);
        p.input.roll = (k.has("ArrowRight") ? 1 : 0) - (k.has("ArrowLeft") ? 1 : 0);
        p.input.yaw = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
        p.input.throttleDelta = (k.has("KeyW") ? 0.6 : 0) - (k.has("KeyS") ? 0.6 : 0);
        delete p.input.throttle;
        // Outside the battle area: the plane turns back by itself.
        const out = Math.hypot(p.pos.x, p.pos.z) / g.world.size;
        let warning = "";
        if (p.alive && out > 0.42) {
            warning = `<span class="df-warn-area">Return to the battle area</span>`;
            if (out > 0.46) {
                const to = new T.Vector3(-p.pos.x, 0, -p.pos.z).normalize();
                const side = p.right.dot(to);
                p.input.roll = Math.max(-1, Math.min(1, side * 2));
                p.input.pitch = 0.6;
            }
        }
        if (p.alive) {
            const groundBelow = g.world.ground(p.pos.x, p.pos.z);
            if (p.pos.y - groundBelow < 140 && p.forward.y < 0) warning = `<span class="df-warn-pull">PULL UP!</span>`;
            if (g.combat.missilesAt(p) > 0) warning = `<span class="df-warn-missile">MISSILE!${p.flares > 0 ? " Press Q for flares" : ""}</span>`;
        }
        g.warning = warning;
        if (p.alive && k.has("Space")) shoot(p, dt);
        else if (p.alive) p.gunT = (p.gunT || 0) - dt;
        if (p.missileReloadAt && g.time >= p.missileReloadAt) [p.missiles, p.missileReloadAt] = [p.maxMissiles, 0];
        if (p.flareReloadAt && g.time >= p.flareReloadAt) [p.flares, p.flareReloadAt] = [p.maxFlares, 0];
        g.lock = p.alive ? findLock() : null;

        // Computer pilots.
        for (const e of g.enemies) {
            if (!e.alive) continue;
            e.pilot.think(dt, {planes: g.planes, player: p, world: g.world, combat: g.combat, time: g.time});
            if (e.pilot.wantFire) shoot(e, dt);
            else e.gunT = (e.gunT || 0) - dt;
            if (e.missileReloadAt && g.time >= e.missileReloadAt) [e.missiles, e.missileReloadAt] = [e.maxMissiles, 0];
            if (e.missiles <= 0 && !e.missileReloadAt) e.missileReloadAt = g.time + 25;
        }
        // Fly everyone; crashing into the ground is fatal.
        for (const plane of g.planes) {
            if (plane.update(dt, g.world) === "crash") destroy(plane, plane.lastHitBy && g.time - (plane.lastHitAt || 0) < 4 ? plane.lastHitBy : null);
        }
        // Mid-air collisions.
        for (let a = 0; a < g.planes.length; a++) for (let b = a + 1; b < g.planes.length; b++) {
            const A = g.planes[a], B = g.planes[b];
            if (A.alive && B.alive && A.pos.distanceTo(B.pos) < (A.radius + B.radius) * 0.6) {
                destroy(A, null, B);
                destroy(B, null, A, true);
            }
        }
        g.combat.update(dt, g.planes);
        // Respawns.
        for (const [i, t] of Object.entries(g.respawnAt)) {
            if (g.time >= t) {
                const plane = g.planes[i];
                spawn(plane, Number(i));
                delete g.respawnAt[i];
            }
        }
        // Time in the air counts for stats and quests.
        g.secT = (g.secT || 0) + dt;
        if (g.secT >= 1) {
            g.secT -= 1;
            const st = window.BitStats && window.BitStats.get();
            if (st && p.alive) {
                st.flySeconds++;
                st.planeSeconds[p.planeId] = (st.planeSeconds[p.planeId] || 0) + 1;
            }
        }
        g.sounds.engine(p.alive ? p.throttle : 0, p.shape);
    }

    function render(dt) {
        const g = fight, p = g.player, cam = g.camera, T = g.THREE;
        // Chase camera: behind and a little above, leaning into turns.
        const target = p.alive ? p : (g.deadCam || (g.deadCam = {pos: p.pos.clone(), forward: p.forward.clone(), up: new T.Vector3(0, 1, 0)}));
        if (p.alive) g.deadCam = null;
        const f = target.forward, up = target.up;
        const want = target.pos.clone().addScaledVector(f, -34).addScaledVector(up, 9);
        const k = 1 - Math.exp(-dt * 7);
        if (!g.camInit) {
            cam.position.copy(want);
            g.camInit = true;
        } else cam.position.lerp(want, k);
        cam.up.lerp(new T.Vector3(0, 1, 0).lerp(up, 0.65), k).normalize();
        cam.lookAt(target.pos.clone().addScaledVector(f, 60));
        cam.fov = 68 + 10 * Math.min(1, p.speed / p.topSpeed);
        cam.updateProjectionMatrix();
        g.renderer.render(g.scene, cam);
        g.hud.update(dt, {player: p, enemies: g.enemies, camera: cam, width: window.innerWidth, height: window.innerHeight,
            lock: g.lock, time: g.time, coins: g.coins, warning: g.warning});
    }

    function setPaused(on) {
        const g = fight;
        g.paused = on;
        g.keys.clear();
        g.hud.pause(on);
        g.sounds.engine(0);
        g.last = performance.now();
    }

    function stop() {
        const g = fight;
        if (!g) return;
        cancelAnimationFrame(g.raf);
        window.removeEventListener("keydown", g.onKey, true);
        window.removeEventListener("keyup", g.onKey, true);
        window.removeEventListener("resize", g.onResize);
        g.sounds.stop();
        g.renderer.dispose();
        g.root.remove();
        fight = null;
    }

    // ------------------------------------------------------------- sound

    // Engine hum (own little synth) plus the 2D activity's real gun sounds.
    function makeSounds() {
        const S = window.BitSound;
        let ac = null, eng = null;
        const muted = () => S && S.isMuted && S.isMuted();
        // The gun/explosion sounds need a "listener"; in 3D you are always at the middle.
        const prevListener = S && S.state && S.state.listener;
        if (S) S.setListener(() => ({position: {x: 0, y: 0}}));
        function ensure() {
            if (ac || muted()) return;
            try {
                ac = new (window.AudioContext || window.webkitAudioContext)();
                const o1 = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), gn = ac.createGain();
                o1.type = "sawtooth";
                o2.type = "triangle";
                lp.type = "lowpass";
                lp.frequency.value = 600;
                gn.gain.value = 0;
                o1.connect(lp);
                o2.connect(lp);
                lp.connect(gn);
                gn.connect(ac.destination);
                o1.start();
                o2.start();
                eng = {o1, o2, lp, gn};
            } catch (e) {
                ac = null;
            }
        }
        return {
            engine(throttle, shape) {
                ensure();
                if (!eng) return;
                const t = ac.currentTime, jet = shape === "jet" || shape === "bomber";
                const base = jet ? 110 : 55;
                eng.o1.frequency.setTargetAtTime(base + throttle * base * 1.2, t, 0.1);
                eng.o2.frequency.setTargetAtTime((base + throttle * base * 1.2) * (jet ? 4.1 : 2.02), t, 0.1);
                eng.lp.frequency.setTargetAtTime(jet ? 900 + throttle * 1800 : 500 + throttle * 900, t, 0.1);
                eng.gn.gain.setTargetAtTime(muted() ? 0 : 0.035 + throttle * 0.05, t, 0.1);
            },
            gun(type, vol) {
                if (S && !muted() && vol > 0.02) S.playGun(type, vol);
            },
            missile(d) {
                if (S && !muted()) S.missileAt({x: Math.min(2100, d * 0.85), y: 0});
            },
            flare() {
                if (S && !muted() && S.flaresAt) S.flaresAt({x: 0, y: 0});
            },
            boom(d, scale) {
                if (S && !muted() && d < 2600) S.explosion({x: Math.min(2100, d * 0.8), y: 0});
            },
            stop() {
                if (ac) ac.close();
                ac = null;
                if (S) S.setListener(prevListener || null);
            },
        };
    }

    // ------------------------------------------------------------- lobby

    function init() {
        // PLAY with "Dogfights" chosen starts this mode instead of the 2D one.
        document.addEventListener("submit", ev => {
            const form = ev.target;
            if (!form || form.id !== "activity") return;
            const mode = form.querySelector('input[name="mode"]:checked');
            if (!mode || mode.value !== "dogfights") return;
            ev.preventDefault();
            ev.stopImmediatePropagation();
            start();
        }, true);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    D.start = start;
    D.stop = stop;
    D.state = () => fight;
    // For automated tests: run the fight for some seconds without drawing.
    D.advance = seconds => {
        for (let t = 0; fight && t < seconds; t += 1 / 60) step(1 / 60);
    };
})();
