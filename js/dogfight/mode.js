// Dogfights (3D beta): pick "Dogfights" on the mode card and press PLAY.
// The deploy screen picks the map and match; then this loads three.js (only
// for this mode), builds the world and runs the match: blue team vs red team
// (or free for all), first to the kill goal or the most kills in 10 minutes.
//   Flying: keys and/or the mouse (Battlefield style), afterburner, chase or
//   cockpit camera, free look and look back. Keys come from Settings.
//   Fighting: guns with a lead indicator, missiles that need a lock (or fly
//   straight), flares, holding a key to repair, ejecting.
//   Scoring: kills, assists, missile and revenge bonuses as score ribbons;
//   coins per kill and XP at the end. Killcam when you're shot down.
(function () {
    const D = window.BitDogfight = window.BitDogfight || {};
    const COINS_PER_KILL = 50;
    const MATCH_S = 600;
    const PLAYER_RESPAWN = 5, AI_RESPAWN = 6;
    const CALLSIGNS = ["Viper", "Maverick", "Ghost", "Hawk", "Falcon", "Jester", "Iceman", "Phoenix", "Rooster", "Cyclone",
        "Raven", "Blaze", "Talon", "Nomad", "Vandal", "Wraith", "Kestrel", "Saber", "Rogue", "Banshee", "Reaper", "Hollywood",
        "Merlin", "Goose", "Slider", "Cougar", "Payback", "Fanboy", "Bob", "Coyote", "Warlock", "Hangman", "Spectre", "Odin"];
    const SKILL = {easy: [0.3, 0.5], normal: [0.5, 0.72], hard: [0.72, 0.9], ace: [0.88, 1]};
    const HEAVY = ["mg151", "type99", "shvak", "hispano", "gsh23", "gsh301", "m61", "gau22", "gau8"];

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

    function stats() {
        return window.BitStats && window.BitStats.get();
    }

    function setting(k) {
        return window.BitSettings ? window.BitSettings.get(k) : undefined;
    }

    // ------------------------------------------------------------- planes

    function gunOf(planeId) {
        const prof = window.BitSoundProfiles && window.BitSoundProfiles[planeId];
        return (prof && prof.gun) || "vickers";
    }

    function makePlane(scene, p, color, name, opts) {
        const gun = gunOf(p.id);
        const l = opts.loadout || {thrust: p.thrust, turn: p.turn, reload: p.reload, bulletSpeed: p.bulletSpeed || 1, life: p.life, ammo: p.ammo, missiles: p.missiles, flares: p.flares || 0};
        const a = new D.Aircraft(scene, {
            name, label: p.name, color, shape: p.skin || "", planeId: p.id, isPlayer: !!opts.isPlayer, team: opts.team || null,
            stats: Object.assign({}, l, opts.extra || {}), gun, smartMissiles: !!p.smartMissiles,
        });
        a.heavyGun = HEAVY.includes(gun);
        return a;
    }

    // Computer pilots fly planes from the same era as yours, mostly.
    function pickPlane(pool, shape) {
        const same = pool.filter(p => (p.skin || "") === shape);
        const list = same.length && Math.random() < 0.65 ? same : pool;
        return list[Math.floor(Math.random() * list.length)];
    }

    // ------------------------------------------------------------- start

    function open() {
        if (fight) return;
        D.showDeploy(start);
    }

    async function start(setup) {
        if (fight) return;
        setup = Object.assign({map: "alpine", sky: "", mode: "team", size: 6, difficulty: "normal"}, setup || {});
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
        const loading = document.createElement("div");
        loading.className = "df-loading";
        const map = D.MAPS.find(m => m.id === setup.map) || D.MAPS[0];
        loading.innerHTML = `<div><span>${map.icon}</span><h2>${map.name}</h2><p>Building the world…</p></div>`;
        root.appendChild(loading);
        document.body.appendChild(root);
        // Let the loading screen show before the heavy work.
        await new Promise(r => setTimeout(r, 30));
        const quality = setting("dfQuality") || "high";
        const fancy = quality === "high" || quality === "ultra";
        // Colors are given in sRGB and lit in linear light, like modern 3D engines.
        if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({antialias: quality === "medium", powerPreference: "high-performance"});
        } catch (e) {
            root.remove();
            return status("Your browser or computer can't show 3D graphics (WebGL is off).");
        }
        status("");
        const dpr = window.devicePixelRatio || 1;
        renderer.setPixelRatio({low: Math.min(1, dpr) * 0.75, medium: Math.min(dpr, 1), high: Math.min(dpr, 1.5), ultra: Math.min(dpr, 2)}[quality] || 1);
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;
        // High/Ultra: shadows, reflections, smooth bodies, and the cinematic look
        // (glow, filmic tone mapping) when the browser has WebGL 2.
        const hdr = fancy && renderer.capabilities.isWebGL2;
        if (fancy) {
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        }
        D.pbr = fancy;
        D.shadows = fancy;
        D.glow = hdr ? 4 : 1;
        root.appendChild(renderer.domElement);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(setting("dfFov") || 72, 1, 0.5, quality === "ultra" ? 38000 : 32000);
        const world = D.makeWorld(THREE, scene, map, {quality, sky: setup.sky || map.sky, renderer, hdr});
        const sky = D.SKIES[setup.sky || map.sky] || D.SKIES.day;
        const post = hdr ? D.makePost(THREE, renderer, {samples: quality === "ultra" ? 8 : 4, exposure: sky.stars ? 1.3 : 0.82, bloom: quality === "ultra" ? 0.95 : 0.8}) : null;
        const hud = D.makeHud(root);

        // ---- the pilots
        const shop = window.BitShop;
        const selected = shop.selected();
        const lvl = id => shop.level(id);
        const extra = {boost: lvl("boost"), seeker: lvl("seeker"), radar: lvl("radar"), airframe: lvl("airframe")};
        const teams = setup.mode === "team";
        const player = makePlane(scene, selected, shop.colorOf(selected), cleanName(), {isPlayer: true, team: teams ? "blue" : null, loadout: shop.loadout(), extra});
        player.setPilot(window.BitSkins ? window.BitSkins.selected() : null);
        const pool = shop.planes.filter(p => !p.exclusive);
        const names = CALLSIGNS.slice().sort(() => Math.random() - 0.5);
        const [lo, hi] = SKILL[setup.difficulty] || SKILL.normal;
        const skins = window.BitSkins ? window.BitSkins.list : [];
        const others = [];
        const count = teams ? setup.size * 2 - 1 : setup.size - 1;
        for (let k = 0; k < count; k++) {
            const team = teams ? (k < setup.size - 1 ? "blue" : "red") : null;
            const p = pickPlane(pool, selected.skin || "");
            const e = makePlane(scene, p, p.color, names[k % names.length], {team});
            e.pilot = D.makePilot(THREE, e, lo + Math.random() * (hi - lo));
            e.setPilot(skins.length ? skins[Math.floor(Math.random() * skins.length)] : null);
            others.push(e);
        }
        const planes = [player, ...others];

        const g = fight = {
            THREE, renderer, post, scene, camera, world, hud, root, player, others, planes, setup, map,
            keys: new Set(), held: new Set(), paused: false, time: 0, coins: 0, last: performance.now(), raf: 0,
            respawnAt: new Map(), lock: {target: null, progress: 0}, audio: D.makeAudio(), lastEnemyGun: new Map(),
            view: setting("dfView") === "cockpit" ? "cockpit" : "chase", look: {yaw: 0, pitch: 0}, stick: {x: 0, y: 0},
            shake: 0, chutes: [], camQuat: new THREE.Quaternion(), camPos: new THREE.Vector3(), camInit: false,
            match: {teams, goal: teams ? Math.max(15, setup.size * 4) : 15, timeLeft: MATCH_S, blue: 0, red: 0, over: false},
            area: world.size * 0.42, repairCd: 0, lastKills: [], blackout: 0, frame: 0, quality,
        };
        g.combat = D.makeCombat(THREE, scene, world, {
            hit: onHit, flareSave,
            boom: (pos, scale) => {
                g.audio.boom(pos, scale, camera.position);
                const d = pos.distanceTo(camera.position);
                if (d < 600) g.shake = Math.max(g.shake, (1 - d / 600) * 1.4 * scale);
            },
        }, {quality});

        // Everyone starts in the air: teams on opposite sides.
        planes.forEach(p => spawn(p));

        // Stats: one more match played, and this map flown.
        const st = stats();
        if (st) {
            st.matches++;
            st.dfMatches++;
            st.dfMaps[map.id] = 1;
        }

        bindInput();
        g.onResize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (post) post.setSize(window.innerWidth, window.innerHeight);
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        };
        window.addEventListener("resize", g.onResize);
        g.onResize();
        hud.onResume(() => setPaused(false));
        hud.onLeave(stop);
        hud.onSettings(() => window.BitSettings && window.BitSettings.show("general"));
        g.offSettings = window.BitSettings && window.BitSettings.onChange(applySettings);
        applySettings();
        loading.remove();
        hud.message(`<b>${world.theme.name}</b><br>${teams ? `You fly for the <span class="df-blue-t">blue team</span>. First to ${g.match.goal} kills wins.` : `Free for all: first to ${g.match.goal} kills.`}<br><small>Esc pauses · ${keyName("camera")} cockpit view · ${setting("dfMouse") ? "click to fly with the mouse" : "keys to fly"}</small>`, 6000);
        loop();
    }

    function cleanName() {
        let n = "";
        try {
            n = (document.querySelector('input[name="nickname"]') || {}).value || localStorage.getItem("nickname") || "";
        } catch (e) {}
        return n.trim().slice(0, 16) || "You";
    }

    function keyName(action) {
        const S = window.BitSettings;
        if (!S) return "";
        const k = S.keys("keysDf")[action];
        return k && k[0] ? S.keyName(k[0]) : "";
    }

    function applySettings() {
        const g = fight;
        if (!g) return;
        g.camera.fov = setting("dfFov") || 72;
        g.binds = window.BitSettings ? window.BitSettings.keys("keysDf") : {};
    }

    function spawn(plane) {
        const g = fight, T = g.THREE, w = g.world;
        let pos, look;
        if (g.match.teams) {
            // Blue comes from the south, red from the north, spread out in a line.
            const side = plane.team === "blue" ? 1 : -1;
            const mates = g.planes.filter(p => p.team === plane.team), i = mates.indexOf(plane);
            pos = new T.Vector3((i - mates.length / 2) * 260 + (Math.random() - 0.5) * 300, 0, side * w.size * 0.15 + (Math.random() - 0.5) * 600);
            look = new T.Vector3(pos.x * 0.3, 0, 0);
        } else {
            const a = Math.random() * Math.PI * 2, d = w.size * (0.12 + Math.random() * 0.2);
            pos = new T.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
            look = new T.Vector3((Math.random() - 0.5) * 2000, 0, (Math.random() - 0.5) * 2000);
        }
        pos.y = w.ground(pos.x, pos.z) + 900 + Math.random() * 400;
        look.y = pos.y;
        plane.spawn(pos, look);
        if (plane.isPlayer) {
            plane.setCockpit(g.view === "cockpit");
            g.killcam = null;
            g.hud.killcam(null);
            g.camInit = false;
            g.blackout = 0;
        }
    }

    // ------------------------------------------------------------- input

    function bindInput() {
        const g = fight;
        const actionOf = code => {
            for (const [id, keys] of Object.entries(g.binds || {})) if (keys.includes(code)) return id;
            return null;
        };
        const press = (action, down) => {
            if (down) {
                if (g.held.has(action)) return;
                g.held.add(action);
                if (g.paused || g.match.over) return;
                if (action === "missile") fireMissile();
                else if (action === "flare") dropFlares(g.player);
                else if (action === "camera") toggleView();
                else if (action === "eject") eject();
            } else g.held.delete(action);
        };
        g.onKey = ev => {
            if (!fight) return;
            if (window.BitSettings && window.BitSettings.isOpen()) return;
            if (/INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || "")) return;
            const down = ev.type === "keydown";
            if (ev.code === "Escape") {
                if (down && !g.match.over) setPaused(!g.paused);
            } else {
                const action = actionOf(ev.code);
                if (!action) return;
                if (!ev.repeat) press(action, down);
            }
            ev.preventDefault();
            ev.stopImmediatePropagation();
        };
        window.addEventListener("keydown", g.onKey, true);
        window.addEventListener("keyup", g.onKey, true);
        const canvas = g.renderer.domElement;
        g.onMouse = ev => {
            if (!fight || g.paused) return;
            if (window.BitSettings && window.BitSettings.isOpen()) return;
            if (ev.target !== canvas && document.pointerLockElement !== canvas) return;
            const down = ev.type === "mousedown";
            if (down && setting("dfMouse") && document.pointerLockElement !== canvas && canvas.requestPointerLock) {
                try {
                    canvas.requestPointerLock();
                } catch (e) {}
            }
            const action = actionOf("Mouse" + ev.button);
            if (action) press(action, down);
            ev.preventDefault();
        };
        g.onMove = ev => {
            if (!fight || g.paused || document.pointerLockElement !== canvas) return;
            const sens = (setting("dfMouseSens") || 1) * 0.0045;
            if (g.held.has("look")) {
                g.look.yaw = Math.max(-2.6, Math.min(2.6, g.look.yaw - ev.movementX * 0.004));
                g.look.pitch = Math.max(-1.2, Math.min(1.2, g.look.pitch - ev.movementY * 0.004));
                return;
            }
            if (!setting("dfMouse")) return;
            g.stick.x = Math.max(-1.4, Math.min(1.4, g.stick.x + ev.movementX * sens));
            g.stick.y = Math.max(-1.4, Math.min(1.4, g.stick.y + ev.movementY * sens * (setting("dfInvertMouse") ? -1 : 1)));
        };
        g.onWheel = ev => {
            if (!fight || g.paused) return;
            g.player.throttle = Math.max(0, Math.min(1, g.player.throttle - Math.sign(ev.deltaY) * 0.08));
        };
        g.onMenu = ev => ev.preventDefault();
        g.onLockChange = () => {
            if (!fight || document.pointerLockElement === canvas) return;
            g.stick.x = g.stick.y = 0;
            // Esc while flying with the mouse releases it before we see the key: pause.
            if (!g.unlocking && !g.paused && !g.match.over) setPaused(true);
            g.unlocking = false;
        };
        window.addEventListener("mousedown", g.onMouse, true);
        window.addEventListener("mouseup", g.onMouse, true);
        window.addEventListener("mousemove", g.onMove);
        canvas.addEventListener("wheel", g.onWheel, {passive: true});
        canvas.addEventListener("contextmenu", g.onMenu);
        document.addEventListener("pointerlockchange", g.onLockChange);
        g.onBlur = () => g.held.clear();
        window.addEventListener("blur", g.onBlur);
    }

    function toggleView() {
        const g = fight;
        g.view = g.view === "chase" ? "cockpit" : "chase";
        g.player.setCockpit(g.view === "cockpit" && g.player.alive);
        g.camInit = false;
    }

    // ------------------------------------------------------------- combat

    function onHit(by, target, dmg, kind, at) {
        const g = fight;
        if (!target.alive || g.match.over) return;
        if (by && by.team && by.team === target.team) return;
        target.health -= dmg;
        target.lastHitBy = by;
        target.lastHitAt = g.time;
        if (by && by !== target) {
            const d = target.damageBy.get(by) || {dmg: 0, t: 0};
            d.dmg += dmg;
            d.t = g.time;
            target.damageBy.set(by, d);
        }
        const st = stats();
        if (by === g.player) {
            g.hud.hit();
            g.audio.hitTick();
            if (st && kind === "gun") st.hits++;
            if (kind === "missile") g.hud.ribbon(0, "Missile hit");
        }
        if (target === g.player) {
            g.audio.clang();
            g.shake = Math.max(g.shake, kind === "missile" ? 1.6 : 0.35);
            // Which way did it come from (relative to your nose)?
            let ang;
            if (by && by.pos) {
                const to = by.pos.clone().sub(target.pos);
                const x = to.dot(target.right), z = -to.dot(target.forward);
                ang = Math.atan2(x, -z);
            }
            g.hud.hurt(ang);
        }
        if (target.health <= 0) destroy(target, by, kind);
        else if (target.health < target.maxHealth * 0.18) target.burning = true;
    }

    function flareSave(plane) {
        const g = fight;
        if (plane === g.player) {
            g.hud.ribbon(25, "Missile evaded");
            g.player.score += 25;
            const st = stats();
            if (st) st.dfFlareSaves++;
        }
    }

    // A plane is shot down (or crashes). how: "gun" | "missile" | "crash" | "collision" | "eject"
    function destroy(plane, by, how, collidedWith) {
        const g = fight;
        if (!plane.alive) return;
        const T = g.THREE;
        g.combat.breakUp(plane);
        // The pilot gets out under a parachute (unless they already ejected).
        if (how !== "eject") spawnChute(plane, plane.pos.clone().add(new T.Vector3(0, 6, 0)), plane.velocity.multiplyScalar(0.3));
        plane.hide();
        if (plane.isPlayer) plane.setCockpit(false);
        plane.deaths++;
        const st = stats();
        const killer = by && by !== plane && !(by.team && by.team === plane.team) ? by : null;
        const name = p => `<span class="df-n ${p.team || (p.isPlayer ? "blue" : "red")}">${p === g.player ? "You" : p.name}</span>`;
        const icon = {gun: "▬▸", missile: "🚀", crash: "💥", collision: "💥", eject: "🪂"}[how] || "✈";
        if (killer) {
            killer.kills++;
            killer.score += 100;
            if (g.match.teams) g.match[killer.team]++;
            g.hud.feed(`${name(killer)} <span class="df-feed-icon">${icon}</span> ${name(plane)}`);
        } else if (collidedWith) g.hud.feed(`${name(plane)} 💥 ${name(collidedWith)}`);
        else g.hud.feed(`${name(plane)} ${how === "eject" ? "ejected 🪂" : "crashed 💥"}`);
        // Assists: anyone else who did a quarter of the damage lately.
        for (const [p, d] of plane.damageBy || []) {
            if (p === killer || !p || d.dmg < plane.maxHealth * 0.25 || g.time - d.t > 15) continue;
            p.score += 50;
            if (p === g.player) g.hud.ribbon(50, `Assist · ${plane.name}`);
        }
        if (killer === g.player) {
            g.coins += COINS_PER_KILL;
            window.BitShop && window.BitShop.addCoins(COINS_PER_KILL);
            g.hud.kill();
            g.audio.killConfirm();
            g.hud.ribbon(100, `Enemy down · ${plane.name}`, true);
            if (st) {
                st.killed++;
                st.dfKills++;
                if (how === "missile") st.dfMissileKills++;
                if (how === "gun") st.dfGunKills++;
                st.coinsEarned += COINS_PER_KILL;
                st.streak++;
                st.bestStreak = Math.max(st.bestStreak, st.streak);
                if (g.player.lastHitBy === plane && g.time - (g.player.lastHitAt || 0) < 30) {
                    g.player.score += 50;
                    g.hud.ribbon(50, "Revenge");
                }
            }
            g.lastKills = g.lastKills.filter(t => g.time - t < 5).concat(g.time);
            if (g.lastKills.length >= 2) {
                g.player.score += 50 * (g.lastKills.length - 1);
                g.hud.ribbon(50 * (g.lastKills.length - 1), g.lastKills.length === 2 ? "Double kill" : g.lastKills.length === 3 ? "Triple kill" : "Multi kill", true);
            }
            if (how === "missile") {
                g.player.score += 20;
                g.hud.ribbon(20, "Missile kill");
            }
        }
        if (plane === g.player) {
            if (st) {
                st.deaths++;
                st.dfDeaths++;
                st.streak = 0;
            }
            g.killcam = killer ? {target: killer, until: g.time + 3.5} : null;
            const dist = killer ? Math.round(killer.pos.distanceTo(plane.pos)) : 0;
            g.hud.killcam(killer
                ? `<small>Shot down by</small><b class="df-n ${killer.team || "red"}">${killer.name}</b><span>${killer.label} · ${dist} m · ${Math.max(0, Math.ceil(100 * killer.health / killer.maxHealth))}% health left</span><em class="df-respawn"></em>`
                : `<b>${how === "eject" ? "You ejected" : collidedWith ? `You collided with ${collidedWith.name}` : "You crashed"}</b><em class="df-respawn"></em>`);
        }
        g.respawnAt.set(plane, g.time + (plane === g.player ? PLAYER_RESPAWN : AI_RESPAWN));
        checkEnd();
    }

    function spawnChute(plane, pos, vel) {
        const g = fight;
        const c = D.makeChute(g.THREE, plane.skin);
        c.position.copy(pos);
        c.scale.setScalar(0.01);
        g.scene.add(c);
        g.chutes.push({mesh: c, vel: vel.clone().setY(Math.max(10, vel.y + 15)), t: 0, sway: Math.random() * 6, plane});
    }

    function updateChutes(dt) {
        const g = fight;
        for (let i = g.chutes.length - 1; i >= 0; i--) {
            const c = g.chutes[i];
            c.t += dt;
            // A second of free fall, then the canopy opens and they drift down.
            const open = c.t > 0.8;
            c.vel.multiplyScalar(1 - (open ? 2.5 : 0.4) * dt);
            c.vel.y += (open ? -6 - c.vel.y : -9.8) * dt * (open ? 2 : 1);
            c.mesh.position.addScaledVector(c.vel, dt);
            c.mesh.scale.setScalar(Math.min(1, open ? (c.t - 0.8) * 2 + 0.25 : 0.25));
            c.mesh.userData.canopy.visible = open;
            c.mesh.rotation.z = Math.sin(c.t * 1.3 + c.sway) * 0.12;
            c.mesh.rotation.y += dt * 0.2;
            const ground = g.world.ground(c.mesh.position.x, c.mesh.position.z);
            if (c.mesh.position.y < ground || c.t > 40) {
                g.scene.remove(c.mesh);
                g.chutes.splice(i, 1);
            }
        }
    }

    function eject() {
        const g = fight, p = g.player;
        if (!p.alive) return;
        const st = stats();
        if (st && p.health < p.maxHealth * 0.4) st.dfEjects++;
        spawnChute(p, p.pos.clone().addScaledVector(p.up, 4), p.velocity.multiplyScalar(0.4).addScaledVector(p.up, 25));
        // The plane flies on without you for a moment, then goes down.
        const credit = p.lastHitBy && g.time - (p.lastHitAt || 0) < 8 ? p.lastHitBy : null;
        destroy(p, credit, credit ? "gun" : "eject");
        g.chuteCam = g.chutes[g.chutes.length - 1];
    }

    // Your missile target: an enemy near the middle of your view, in range.
    function lockCandidate() {
        const g = fight, p = g.player;
        const range = 2800 * (1 + 0.2 * (p.stats.radar || 0));
        let best = null, bestDot = Math.cos(20 * Math.PI / 180);
        for (const e of g.planes) {
            if (e === p || !e.alive || (p.team && e.team === p.team)) continue;
            const to = e.pos.clone().sub(p.pos), d = to.length();
            if (d > range || d < 150) continue;
            const dot = to.normalize().dot(p.forward);
            if (dot > bestDot) [best, bestDot] = [e, dot];
        }
        return best;
    }

    function updateLock(dt) {
        const g = fight, p = g.player, L = g.lock;
        const c = p.alive ? lockCandidate() : null;
        if (c !== L.target) {
            L.target = c;
            L.progress = 0;
        }
        if (c) {
            const time = 1.8 / (1 + 0.15 * (p.stats.seeker || 0)) * (p.smartMissiles ? 0.6 : 1);
            L.progress = Math.min(1, L.progress + dt / time);
            if (L.progress >= 1) {
                c.lockedBy = p;
                c.lockedAt = g.time;
            }
        }
    }

    function launch(plane, target) {
        const g = fight;
        g.combat.launch(plane, target);
        plane.missiles--;
        if (plane.missiles <= 0 && !plane.missileReloadAt) plane.missileReloadAt = g.time + (plane.isPlayer ? 12 * (plane.stats.missileReload || 1) : 20);
        g.audio.missileLaunch(plane.pos, plane === g.player);
    }

    function fireMissile() {
        const g = fight, p = g.player;
        if (!p.alive || p.missiles <= 0) return;
        const locked = g.lock.target && g.lock.progress >= 1 ? g.lock.target : null;
        launch(p, locked);
        if (!locked) g.hud.ribbon(0, "No lock: missile fired straight");
        const st = stats();
        if (st) st.missiles++;
    }

    function dropFlares(plane) {
        const g = fight;
        if (!plane.alive || plane.flares <= 0) return;
        plane.flares--;
        // Your flares fool most missiles; computer pilots' a bit fewer.
        g.combat.dropFlares(plane, plane.isPlayer ? 0.85 : 0.65);
        g.audio.flares(plane.pos, plane === g.player);
        if (plane.flares <= 0 && !plane.flareReloadAt) plane.flareReloadAt = g.time + 14;
    }

    function shoot(plane, dt) {
        const g = fight;
        plane.gunT = (plane.gunT || 0) - dt;
        if (plane.reloadAt && g.time >= plane.reloadAt) {
            plane.reloadAt = 0;
            plane.ammo = plane.maxAmmo;
        }
        if (plane.gunT > 0 || plane.reloadAt || plane.ammo <= 0) return;
        plane.gunT = 0.07 * Math.max(0.6, plane.stats.reload || 1) * (plane.heavyGun ? 1.25 : 1);
        if (!g.combat.fire(plane)) return;
        plane.ammo--;
        if (plane.ammo <= 0) plane.reloadAt = g.time + 3 * (plane.stats.reload || 1);
        if (plane === g.player) {
            g.audio.gun(plane.gun, plane.pos, true);
            g.shake = Math.max(g.shake, 0.06);
            const st = stats();
            if (st) st.bullets++;
        } else g.audio.gun(plane.gun, plane.pos, false, g.camera.position);
    }

    // ------------------------------------------------------------- match

    function checkEnd() {
        const g = fight, m = g.match;
        if (m.over) return;
        const leader = Math.max(...g.planes.map(p => p.kills));
        m.leader = leader;
        if (m.teams ? (m.blue >= m.goal || m.red >= m.goal) : leader >= m.goal) endMatch();
    }

    function endMatch() {
        const g = fight, m = g.match, p = g.player;
        if (m.over) return;
        m.over = true;
        g.held.clear();
        if (document.pointerLockElement && document.exitPointerLock) {
            g.unlocking = true;
            document.exitPointerLock();
        }
        let won, title;
        if (m.teams) {
            won = m.blue > m.red;
            title = m.blue === m.red ? "Draw" : won ? "Victory" : "Defeat";
        } else {
            const top = g.planes.slice().sort((a, b) => b.kills - a.kills || b.score - a.score);
            won = top[0] === p;
            title = won ? "You won!" : `${top[0].name} won`;
        }
        const winBonus = won ? 500 : 150;
        const xp = p.score + winBonus;
        const coins = won ? 300 : 0;
        if (coins && window.BitShop) window.BitShop.addCoins(coins);
        const st = stats();
        if (st) {
            if (won) st.dfWins++;
            if (coins) st.coinsEarned += coins;
        }
        if (window.BitProgress) window.BitProgress.addXp(xp);
        const ranked = g.planes.slice().sort((a, b) => b.score - a.score || b.kills - a.kills);
        const mvp = ranked[0];
        const esc = s => String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
        g.hud.results(`<div class="df-results-box ${won ? "won" : "lost"}">
            <h1>${title}</h1>
            ${m.teams ? `<p class="df-final"><span class="df-blue-t">Blue ${m.blue}</span> · <span class="df-red-t">${m.red} Red</span></p>` : ""}
            <div class="df-res-grid">
                <div><b>${p.score}</b><small>Score</small></div>
                <div><b>${p.kills}</b><small>Kills</small></div>
                <div><b>${p.deaths}</b><small>Deaths</small></div>
                <div><b>+${xp.toLocaleString()}</b><small>XP</small></div>
                <div><b>+${(g.coins + coins).toLocaleString()}</b><small>Coins</small></div>
            </div>
            <p class="df-mvp">MVP: <b>${esc(mvp === p ? "You" : mvp.name)}</b> (${esc(mvp.label)}) · ${mvp.kills} kills · ${mvp.score} score</p>
            <table class="df-res-table"><tr><th>#</th><th>Pilot</th><th>Plane</th><th>K</th><th>D</th><th>Score</th></tr>
                ${ranked.slice(0, 8).map((x, i) => `<tr class="${x === p ? "me" : ""} ${x.team || ""}"><td>${i + 1}</td><td>${esc(x === p ? "You" : x.name)}</td><td>${esc(x.label)}</td><td>${x.kills}</td><td>${x.deaths}</td><td>${x.score}</td></tr>`).join("")}
            </table>
            <div class="df-res-buttons"><button type="button" class="btn df-again">Play again</button><button type="button" class="btn df-out">Back to the lobby</button></div>
        </div>`, () => {
            const setup = g.setup;
            stop();
            start(setup);
        }, stop);
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
        const g = fight, p = g.player, T = g.THREE, m = g.match;
        g.time += dt;
        if (!m.over) {
            m.timeLeft -= dt;
            if (m.timeLeft <= 0) endMatch();
            else checkEnd();
        }
        m.leader = Math.max(...g.planes.filter(x => x !== p).map(x => x.kills), 0);

        // ---- your controls
        const h = a => g.held.has(a) && !m.over;
        const inv = setting("dfInvertPitch") ? -1 : 1;
        // The mouse stick springs back to the middle (moving the mouse = turning).
        const back = Math.exp(-dt * 7);
        g.stick.x *= back;
        g.stick.y *= back;
        p.input.pitch = Math.max(-1, Math.min(1, inv * ((h("pitchUp") ? 1 : 0) - (h("pitchDown") ? 1 : 0)) + g.stick.y));
        p.input.roll = Math.max(-1, Math.min(1, (h("rollRight") ? 1 : 0) - (h("rollLeft") ? 1 : 0) + g.stick.x));
        p.input.yaw = (h("yawRight") ? 1 : 0) - (h("yawLeft") ? 1 : 0);
        p.input.throttleDelta = (h("throttleUp") ? 0.7 : 0) - (h("throttleDown") ? 0.7 : 0);
        p.input.boost = h("boost");
        delete p.input.throttle;
        if (!h("look") && !h("lookBack")) {
            g.look.yaw *= Math.exp(-dt * 6);
            g.look.pitch *= Math.exp(-dt * 6);
        }

        // ---- warnings
        let warning = "", alarm = false, threat = "";
        if (p.alive && !m.over) {
            const out = Math.hypot(p.pos.x, p.pos.z);
            if (out > g.area) {
                warning = `<span class="df-warn-area">Return to the battle area</span>`;
                if (out > g.area * 1.08) {
                    const to = new T.Vector3(-p.pos.x, 0, -p.pos.z).normalize();
                    p.input.roll = Math.max(-1, Math.min(1, p.right.dot(to) * 2));
                    p.input.pitch = 0.6;
                }
            }
            // Ground ahead within about 4 seconds.
            const ahead = p.pos.clone().addScaledVector(p.forward, p.speed * 3);
            const below = g.world.ground(p.pos.x, p.pos.z);
            if ((ahead.y < g.world.ground(ahead.x, ahead.z) + 40 || p.pos.y - below < 120) && p.forward.y < 0.1) {
                warning = `<span class="df-warn-pull">PULL UP</span>`;
                alarm = true;
            }
            if (p.stalling) {
                warning = `<span class="df-warn-pull">STALL · nose down, throttle up</span>`;
                alarm = true;
            }
            const incoming = g.combat.missilesAt(p);
            if (incoming.length) {
                threat = "missile";
                const near = incoming.reduce((a, b) => (a.mesh.position.distanceTo(p.pos) < b.mesh.position.distanceTo(p.pos) ? a : b));
                warning = `<span class="df-warn-missile">MISSILE · ${Math.round(near.mesh.position.distanceTo(p.pos))} m${p.flares > 0 ? ` · ${keyName("flare")} flares` : " · break hard!"}</span>`;
            } else if (p.lockedAt && g.time - p.lockedAt < 0.3) {
                threat = "lock";
                warning = `<span class="df-warn-lock">${p.lockedBy ? p.lockedBy.name + " is locking on" : "Locked on"}</span>`;
            }
        }
        g.warning = warning;
        g.alarm = alarm;
        g.threat = threat;

        // ---- your guns, lock, repair
        if (p.alive && h("fire")) shoot(p, dt);
        else if (p.alive) p.gunT = (p.gunT || 0) - dt;
        for (const pl of g.planes) {
            if (pl.missileReloadAt && g.time >= pl.missileReloadAt) [pl.missiles, pl.missileReloadAt] = [pl.maxMissiles, 0];
            if (pl.flareReloadAt && g.time >= pl.flareReloadAt) [pl.flares, pl.flareReloadAt] = [pl.maxFlares, 0];
            if (pl.reloadAt && g.time >= pl.reloadAt) [pl.ammo, pl.reloadAt] = [pl.maxAmmo, 0];
            // Burning planes lose health until repaired.
            if (pl.alive && pl.burning) {
                pl.health -= pl.maxHealth * 0.012 * dt;
                if (pl.health <= 0) destroy(pl, pl.lastHitBy, "gun");
            }
            // Computer pilots patch themselves up when left alone a while.
            if (pl.alive && !pl.isPlayer && g.time - (pl.lastHitAt || -99) > 10 && pl.health < pl.maxHealth) {
                pl.health = Math.min(pl.maxHealth, pl.health + pl.maxHealth * 0.04 * dt);
                if (pl.health > pl.maxHealth * 0.25) pl.burning = false;
            }
        }
        updateLock(dt);
        g.repairCd = Math.max(0, g.repairCd - dt);
        g.repairText = "";
        if (p.alive) {
            const hurtRecently = g.time - (p.lastHitAt || -99) < 2.5;
            if (h("repair") && g.repairCd <= 0 && p.health < p.maxHealth) {
                if (hurtRecently) g.repairText = `<span class="bad">Can't repair under fire</span>`;
                else {
                    p.health = Math.min(p.maxHealth, p.health + p.maxHealth * 0.16 * dt);
                    p.burning = false;
                    g.repairing = true;
                    g.repairText = `<span class="on">🔧 Repairing… ${Math.round(100 * p.health / p.maxHealth)}%</span>`;
                    if (p.health >= p.maxHealth) [g.repairCd, g.repairing] = [20, false];
                }
            } else if (g.repairing) [g.repairCd, g.repairing] = [20, false];
            if (!g.repairText) g.repairText = g.repairCd > 0 ? `🔧 Repair in ${Math.ceil(g.repairCd)}s` : p.health < p.maxHealth ? `🔧 Hold ${keyName("repair")} to repair` : "";
        }

        // ---- computer pilots
        const ctx = {
            planes: g.planes, player: p, world: g.world, combat: g.combat, time: g.time,
            focusPlayer: {easy: 0.2, normal: 0.35, hard: 0.45, ace: 0.5}[g.setup.difficulty] || 0.35,
            flare: pl => dropFlares(pl), launch: (pl, t) => launch(pl, t),
        };
        if (!m.over) for (const e of g.others) {
            if (!e.alive) continue;
            e.pilot.think(dt, ctx);
            if (e.pilot.wantFire) shoot(e, dt);
            else e.gunT = (e.gunT || 0) - dt;
        }
        // ---- fly everyone; hitting the ground (or a building) is fatal
        for (const plane of g.planes) {
            if (plane.update(dt, g.world) === "crash") {
                const by = plane.lastHitBy && g.time - (plane.lastHitAt || 0) < 6 ? plane.lastHitBy : null;
                destroy(plane, by, by ? "gun" : "crash");
            }
        }
        // ---- mid-air collisions
        for (let a = 0; a < g.planes.length; a++) for (let b = a + 1; b < g.planes.length; b++) {
            const A = g.planes[a], B = g.planes[b];
            if (A.alive && B.alive && A.pos.distanceTo(B.pos) < (A.radius * A.scale + B.radius * B.scale) * 0.55) {
                destroy(A, null, "collision", B);
                destroy(B, null, "collision", A);
            }
        }
        g.combat.update(dt, g.planes, g.camera);
        updateChutes(dt);
        // ---- respawns
        for (const [plane, t] of g.respawnAt) {
            if (plane.isPlayer) {
                const left = Math.max(0, Math.ceil(t - g.time));
                const r = g.hud.el.querySelector(".df-respawn");
                if (r) r.textContent = m.over ? "" : `Back in the air in ${left}…`;
            }
            if (g.time >= t && !m.over) {
                g.respawnAt.delete(plane);
                spawn(plane);
                if (plane.isPlayer) g.chuteCam = null;
            }
        }
        // ---- time in the air counts for stats and quests
        g.secT = (g.secT || 0) + dt;
        if (g.secT >= 1) {
            g.secT -= 1;
            const st = stats();
            if (st && p.alive) {
                st.flySeconds++;
                st.planeSeconds[p.planeId] = (st.planeSeconds[p.planeId] || 0) + 1;
            }
        }
        // ---- blackout in long hard pulls
        if (p.alive && p.g > 8) g.blackout = Math.min(1, g.blackout + (p.g - 8) * 0.06 * dt);
        else g.blackout = Math.max(0, g.blackout - dt * 0.6);
    }

    // ------------------------------------------------------------- camera

    function render(dt) {
        const g = fight, p = g.player, cam = g.camera, T = g.THREE;
        let deadView = false;
        if (p.alive) {
            const lookBack = g.held.has("lookBack");
            const yaw = g.look.yaw + (lookBack ? Math.PI : 0);
            const look = new T.Quaternion().setFromEuler(new T.Euler(g.look.pitch, yaw, 0, "YXZ"));
            if (g.view === "cockpit") {
                // In the seat: the camera is your head, turning with the plane.
                cam.position.copy(p.eye).applyQuaternion(p.quat).add(p.pos);
                cam.quaternion.copy(p.quat).multiply(look);
                // G pushes your head down a little.
                cam.position.addScaledVector(p.up, -Math.min(0.15, Math.max(0, p.g - 1) * 0.015));
            } else {
                // Chase camera: lags a little behind the plane's turns.
                if (!g.camInit) {
                    g.camQuat.copy(p.quat);
                    g.camInit = true;
                } else g.camQuat.slerp(p.quat, 1 - Math.exp(-dt * 6));
                const q = g.camQuat.clone().multiply(look);
                const dist = (24 + 10 * p.scale + p.speed * 0.03) * (p.shape === "bomber" ? 1.5 : 1);
                const offset = new T.Vector3(0, 6 * p.scale + 2, dist).applyQuaternion(q);
                cam.position.copy(p.pos).add(offset);
                cam.quaternion.copy(q);
                // Look slightly above the plane so it sits low on the screen.
                cam.rotateX(-0.06);
            }
            cam.fov = (setting("dfFov") || 72) + 8 * Math.min(1.2, p.speed / p.topSpeed) + (p.boosting ? 6 : 0);
        } else {
            deadView = true;
            // Killcam: look at whoever got you, then the parachute or the wreck.
            const kc = g.killcam && g.time < g.killcam.until && g.killcam.target.alive ? g.killcam.target : null;
            const chute = g.chuteCam && g.chutes.includes(g.chuteCam) ? g.chuteCam.mesh : null;
            const focus = kc ? kc.pos : chute ? chute.position : g.lastDeathPos || p.pos;
            const orbit = g.time * 0.25;
            const dist = kc ? 70 : 40;
            cam.position.set(focus.x + Math.cos(orbit) * dist, focus.y + (kc ? 18 : 10), focus.z + Math.sin(orbit) * dist);
            cam.lookAt(focus);
            cam.fov = 55;
        }
        if (p.alive) g.lastDeathPos = p.pos.clone();
        // Shake: hits, explosions, firing.
        if (g.shake > 0.001 && setting("dfShake") !== false) {
            const s = g.shake * 0.02;
            cam.rotateX((Math.random() - 0.5) * s);
            cam.rotateY((Math.random() - 0.5) * s);
        }
        g.shake *= Math.exp(-dt * 8);
        cam.updateProjectionMatrix();
        g.world.update(dt, cam, p.alive ? p.pos : cam.position);
        if (p.alive && g.view === "cockpit" && (g.frame++ % 3 === 0)) p.updateInstruments();
        if (g.post) g.post.render(g.scene, cam, dt);
        else g.renderer.render(g.scene, cam);

        // Lead indicator: where to aim at the target nearest your gunsight.
        let lead = null;
        if (p.alive) {
            const t = g.lock.target || nearestAhead();
            if (t) {
                const d = t.pos.distanceTo(p.pos);
                if (d < 1400) {
                    const tof = d / (1000 * (p.stats.bulletSpeed || 1) + p.speed);
                    lead = t.pos.clone().addScaledVector(t.velocity, tof).addScaledVector(p.velocity, -tof * 0).add(new T.Vector3(0, 0.5 * 9.8 * tof * tof, 0));
                }
            }
        }
        const m = g.match;
        g.hud.update(dt, {
            player: p, planes: g.planes, camera: cam, width: window.innerWidth, height: window.innerHeight,
            lock: p.alive ? g.lock : null, time: g.time, coins: g.coins, warning: g.warning, repair: g.repairText, lead, deadView,
            match: {teams: m.teams, blue: m.blue, red: m.red, goal: m.goal, timeLeft: m.timeLeft, leader: m.leader || 0},
            radarRange: 4000 * (1 + 0.2 * (p.stats.radar || 0)), area: g.area, missiles: g.combat.missiles(), blackout: g.blackout,
        });
        if (g.held.has("scores") || m.over) {
            if (!m.over) g.hud.scoreboard(true, scoreTeams());
        } else g.hud.scoreboard(false);
        g.audio.frame(dt, {
            camera: cam, player: p, planes: g.planes, cockpit: g.view === "cockpit" && p.alive,
            lock: p.alive && g.lock.target ? g.lock.progress : 0, threat: g.threat, alarm: g.alarm, paused: g.paused || m.over,
        });
    }

    function nearestAhead() {
        const g = fight, p = g.player;
        let best = null, bestDot = Math.cos(15 * Math.PI / 180);
        for (const e of g.planes) {
            if (e === p || !e.alive || (p.team && e.team === p.team)) continue;
            const to = e.pos.clone().sub(p.pos);
            if (to.length() > 1500) continue;
            const dot = to.normalize().dot(p.forward);
            if (dot > bestDot) [best, bestDot] = [e, dot];
        }
        return best;
    }

    function scoreTeams() {
        const g = fight;
        const row = x => ({name: x === g.player ? x.name + " (you)" : x.name, label: x.label, kills: x.kills, deaths: x.deaths, score: x.score, isPlayer: x === g.player});
        if (!g.match.teams) return [{name: "Free for all", list: g.planes.map(row)}];
        return [{name: `Blue · ${g.match.blue}`, list: g.planes.filter(x => x.team === "blue").map(row)},
            {name: `Red · ${g.match.red}`, list: g.planes.filter(x => x.team === "red").map(row)}];
    }

    function setPaused(on) {
        const g = fight;
        g.paused = on;
        g.held.clear();
        g.hud.pause(on);
        if (on && document.pointerLockElement && document.exitPointerLock) {
            g.unlocking = true;
            document.exitPointerLock();
        }
        g.last = performance.now();
    }

    function stop() {
        const g = fight;
        if (!g) return;
        cancelAnimationFrame(g.raf);
        window.removeEventListener("keydown", g.onKey, true);
        window.removeEventListener("keyup", g.onKey, true);
        window.removeEventListener("mousedown", g.onMouse, true);
        window.removeEventListener("mouseup", g.onMouse, true);
        window.removeEventListener("mousemove", g.onMove);
        window.removeEventListener("resize", g.onResize);
        window.removeEventListener("blur", g.onBlur);
        document.removeEventListener("pointerlockchange", g.onLockChange);
        if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
        g.audio.stop();
        g.scene.traverse(o => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) [].concat(o.material).forEach(mm => mm.dispose());
        });
        if (g.post) g.post.dispose();
        if (g.scene.environment) g.scene.environment.dispose();
        g.renderer.dispose();
        g.root.remove();
        fight = null;
    }

    // ------------------------------------------------------------- lobby

    function init() {
        // PLAY with "Dogfights" chosen opens the deploy screen instead of the 2D activity.
        document.addEventListener("submit", ev => {
            const form = ev.target;
            if (!form || form.id !== "activity") return;
            const mode = form.querySelector('input[name="mode"]:checked');
            if (!mode || mode.value !== "dogfights") return;
            ev.preventDefault();
            ev.stopImmediatePropagation();
            open();
        }, true);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    D.open = open;
    D.start = start;
    D.stop = stop;
    D.state = () => fight;
    // For automated tests: run the match for some seconds without drawing.
    D.advance = seconds => {
        for (let t = 0; fight && t < seconds; t += 1 / 60) step(1 / 60);
    };
})();
