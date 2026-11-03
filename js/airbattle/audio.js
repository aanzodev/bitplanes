// Air Battle (3D): sound. Everything is synthesized live with the Web Audio
// API and placed in 3D around you (HRTF panning), sharing Bit Planes' audio
// output, volume and mute.
//   Your engine: piston engines rumble and pop in time with the RPM and the
//   propeller whops; jets whine and roar, and the afterburner thunders. Wind
//   rushes louder with speed and screams in hard turns.
//   Other planes: their own engine note, pitched by the Doppler effect as they
//   pass, with a whoosh on close flybys.
//   Guns: each plane's real gun sound, from where it is. Hits on you clang.
//   Missiles: the seeker growl while locking, a solid tone when locked, the
//   rocket roar, and warning beeps when someone locks onto you or fires.
//   Explosions: heard late when far away (sound travels 343 m/s) and duller.
//   In the cockpit the outside world is muffled.
(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};
    const C = 343; // speed of sound, m/s

    D.makeAudio = function () {
        const S = window.BitSound;
        const ctx = S && S.context && S.context();
        const muted = () => !S || (S.isMuted && S.isMuted());
        if (!ctx) return dummy();
        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(S.master());
        master.gain.setTargetAtTime(1, ctx.currentTime, 0.4);
        const noiseBuf = S.noiseBuffer();

        // Buses: the outside world goes through a filter that closes in the cockpit.
        const extFilter = ctx.createBiquadFilter();
        extFilter.type = "lowpass";
        extFilter.frequency.value = 18000;
        extFilter.connect(master);
        const ext = ctx.createGain();
        ext.connect(extFilter);
        const own = ctx.createGain();
        own.connect(master);
        const ui = ctx.createGain();
        ui.gain.value = 0.7;
        ui.connect(master);

        // ---- building blocks
        const now = () => ctx.currentTime;
        function noise(loop = true) {
            const n = ctx.createBufferSource();
            n.buffer = noiseBuf;
            n.loop = loop;
            n.loopStart = Math.random();
            return n;
        }
        function osc(type, f) {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = f;
            return o;
        }
        function filt(type, f, q = 1) {
            const b = ctx.createBiquadFilter();
            b.type = type;
            b.frequency.value = f;
            b.Q.value = q;
            return b;
        }
        function gain(v = 0) {
            const g = ctx.createGain();
            g.gain.value = v;
            return g;
        }
        function chain(...n) {
            for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]);
            return n[n.length - 1];
        }
        function panner(pos) {
            const p = ctx.createPanner();
            p.panningModel = "HRTF";
            p.distanceModel = "inverse";
            p.refDistance = 70;
            p.rolloffFactor = 1.1;
            p.maxDistance = 9000;
            if (pos) place(p, pos);
            p.connect(ext);
            return p;
        }
        function place(p, v) {
            if (p.positionX) {
                p.positionX.value = v.x;
                p.positionY.value = v.y;
                p.positionZ.value = v.z;
            } else p.setPosition(v.x, v.y, v.z);
        }
        function shot(nodes, dur) {
            const t = now();
            nodes.forEach(n => {
                n.start(t);
                n.stop(t + dur);
            });
        }
        function env(g, peak, a, d, t0 = now()) {
            g.gain.setValueAtTime(0.0001, t0);
            g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
        }
        // A wave shaper for engine grit.
        function shaper(amount) {
            const ws = ctx.createWaveShaper(), n = 1024, curve = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                const x = i / (n - 1) * 2 - 1;
                curve[i] = Math.tanh(x * amount);
            }
            ws.curve = curve;
            return ws;
        }

        // ---------------------------------------------------- your engine

        // Every plane's engine is modelled on its real one (audio/engines.js).
        const PROFILES = window.BitSoundProfiles || {};
        const profileOf = p => PROFILES[p.planeId] || PROFILES.classic || {kind: p.shape === "jet" ? "jet" : "prop"};

        // Wind and the scream of air in hard turns (your plane only).
        const wind = noise(), windF = filt("bandpass", 500, 0.6), windG = gain(0);
        chain(wind, windF, windG, own);
        const scream = noise(), screamF = filt("bandpass", 2600, 6), screamG = gain(0);
        chain(scream, screamF, screamG, own);
        wind.start();
        scream.start();

        let engine = null, enginePlane = null;
        const engineBus = gain(0);
        engineBus.connect(own);

        function updateEngine(p, dt, cockpit) {
            const t = now(), k = 0.08;
            if (!p || !p.alive) {
                engineBus.gain.setTargetAtTime(0, t, 0.3);
                windG.gain.setTargetAtTime(0, t, 0.3);
                screamG.gain.setTargetAtTime(0, t, 0.3);
                return;
            }
            if (!engine || enginePlane !== p.planeId) {
                if (engine) engine.stop();
                engine = window.BitEngines.create(ctx, engineBus, profileOf(p), noiseBuf);
                enginePlane = p.planeId;
            }
            // Louder and bassier from the seat; a damaged engine misfires.
            const ev = S.mix ? S.mix("engineVolume") : 0.6;
            engineBus.gain.setTargetAtTime((cockpit ? 0.42 : 0.28) * ev * (p.burning && Math.random() < 0.25 ? 0.35 : 1), t, 0.05);
            engine.set(p.throttle, {boost: p.boosting, speed: p.speed / p.topSpeed});
            const windLevel = Math.min(1, (p.speed / 260) ** 2);
            windF.frequency.setTargetAtTime(300 + p.speed * 6, t, k);
            windG.gain.setTargetAtTime((cockpit ? 0.12 : 0.3) * windLevel, t, k);
            const gs = Math.max(0, (p.g - 4) / 6);
            screamG.gain.setTargetAtTime(0.08 * gs * windLevel, t, k);
            screamF.frequency.setTargetAtTime(1800 + p.speed * 6, t, k);
        }

        // ---------------------------------------------- other planes' engines

        // The four nearest planes each get their own engine sound, placed where
        // they are and pitched by the Doppler effect as they pass.
        const VOICES = 4;
        const voices = [];
        for (let i = 0; i < VOICES; i++) {
            const pan = panner(), bus = gain(0);
            bus.connect(pan);
            voices.push({p: pan, bus, eng: null, planeId: null, plane: null});
        }
        const tmp = {x: 0, y: 0, z: 0};

        function updateVoices(planes, me, listenerPos, listenerVel) {
            const others = planes.filter(p => p.alive && p !== me).map(p => ({p, d: p.pos.distanceTo(listenerPos)})).sort((a, b) => a.d - b.d).slice(0, VOICES);
            const t = now();
            voices.forEach((v, i) => {
                const o = others[i];
                if (!o || o.d > 6000) {
                    v.bus.gain.setTargetAtTime(0, t, 0.2);
                    v.plane = null;
                    return;
                }
                const p = o.p, jet = p.shape === "jet" || p.shape === "bomber";
                if (v.planeId !== p.planeId || !v.eng) {
                    if (v.eng) v.eng.stop();
                    v.eng = window.BitEngines.create(ctx, v.bus, profileOf(p), noiseBuf);
                    v.planeId = p.planeId;
                }
                place(v.p, p.pos);
                // Doppler: higher when coming at you, lower going away.
                const dir = tmp;
                dir.x = (listenerPos.x - p.pos.x) / (o.d || 1);
                dir.y = (listenerPos.y - p.pos.y) / (o.d || 1);
                dir.z = (listenerPos.z - p.pos.z) / (o.d || 1);
                const vs = p.forward.x * p.speed * dir.x + p.forward.y * p.speed * dir.y + p.forward.z * p.speed * dir.z;
                const vl = listenerVel ? -(listenerVel.x * dir.x + listenerVel.y * dir.y + listenerVel.z * dir.z) : 0;
                const dop = Math.max(0.5, Math.min(2.2, (C + vl) / Math.max(60, C - vs)));
                v.eng.set(p.throttle, {boost: p.boosting, speed: p.speed / p.topSpeed, pitch: dop});
                v.bus.gain.setTargetAtTime((jet ? 0.5 : 0.8) * (S.mix ? S.mix("engineVolume") : 0.6), t, 0.1);
                // A close pass: a whoosh as it goes by.
                if (v.plane === p && o.d < 160 && (!p._whooshAt || t - p._whooshAt > 2.5) && vs - vl < -40) {
                    p._whooshAt = t;
                    flyby(p.pos, jet);
                }
                v.plane = p;
            });
        }

        function flyby(pos, jet) {
            const p = panner(pos), n = noise(false), f = filt("bandpass", jet ? 2400 : 1400, 1.2), g = gain(0);
            chain(n, f, g, p);
            const t = now();
            f.frequency.setValueAtTime(jet ? 2600 : 1600, t);
            f.frequency.exponentialRampToValueAtTime(jet ? 500 : 300, t + 1.1);
            env(g, 1.2, 0.08, 1.1, t);
            shot([n], 1.3);
        }

        // ------------------------------------------------------------- guns

        let lastOther = 0;
        // A plane's whole gun loadout (its real guns, see profiles.js) for one
        // firing interval, from where it is.
        function gun(plane, mine, listenerPos, interval = 0.07) {
            if (muted()) return;
            const vol = S.volleyInto ? (id, node, v, d) => S.volleyInto(id, node, v, d, interval) : (id, node, v, d) => S.playGunInto(plane.gun, node, v, d);
            if (mine) return vol(plane.planeId, own, 0.55, 0);
            const t = now(), d = plane.pos.distanceTo(listenerPos);
            if (d > 4000 || t - lastOther < 0.05) return;
            lastOther = t;
            const p = panner(plane.pos);
            vol(plane.planeId, p, 1.1, Math.min(1, d / 4000));
            setTimeout(() => p.disconnect(), 1500);
        }

        // Bullets hitting you: metal clangs. Your hits on others: a crisp tick.
        function clang() {
            const t = now(), n = noise(false), f = filt("highpass", 1800, 0.7), g = gain(0);
            chain(n, f, g, own);
            env(g, 0.5, 0.002, 0.12, t);
            const r = osc("triangle", 900 + Math.random() * 700), rg = gain(0);
            chain(r, rg, own);
            env(rg, 0.25, 0.002, 0.25, t);
            shot([n, r], 0.3);
        }
        let lastTick = 0;
        function hitTick() {
            const t = now();
            if (t - lastTick < 0.06) return;
            lastTick = t;
            const o = osc("square", 2400), g = gain(0);
            chain(o, filt("bandpass", 2400, 3), g, ui);
            env(g, 0.18, 0.001, 0.05, t);
            shot([o], 0.08);
        }
        // The kill confirm: a bright ding over a bass thump.
        function killConfirm() {
            const t = now();
            [[1320, 0.22], [1980, 0.12]].forEach(([f, v]) => {
                const o = osc("sine", f), g = gain(0);
                chain(o, g, ui);
                env(g, v, 0.005, 0.6, t);
                shot([o], 0.7);
            });
            const b = osc("sine", 90), bg = gain(0);
            chain(b, bg, ui);
            b.frequency.exponentialRampToValueAtTime(45, t + 0.25);
            env(bg, 0.5, 0.005, 0.3, t);
            shot([b], 0.35);
        }

        // ---------------------------------------------------- missiles, flares

        function missileLaunch(pos, mine) {
            const out = mine ? own : panner(pos);
            const t = now();
            const n = noise(false), f = filt("bandpass", 3000, 1.2), g = gain(0);
            chain(n, f, g, out);
            f.frequency.exponentialRampToValueAtTime(500, t + 1.6);
            env(g, mine ? 0.9 : 1.4, 0.02, 1.6, t);
            const r = noise(false), rf = filt("lowpass", 400, 1), rg = gain(0);
            chain(r, rf, rg, out);
            env(rg, mine ? 0.8 : 1.2, 0.05, 2.2, t);
            const th = osc("sine", 160), tg = gain(0);
            chain(th, tg, out);
            th.frequency.exponentialRampToValueAtTime(40, t + 0.3);
            env(tg, 0.6, 0.005, 0.3, t);
            shot([n, r, th], 2.4);
        }

        function flares(pos, mine) {
            const out = mine ? own : panner(pos);
            // A long string of pops as the flares are fired in pairs.
            for (let k = 0; k < 16; k++) {
                const t = now() + Math.floor(k / 2) * 0.17 + (k % 2) * 0.035, o = osc("sine", 900), g = gain(0);
                chain(o, g, out);
                o.frequency.setValueAtTime(900, t);
                o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
                env(g, 0.35, 0.003, 0.08, t);
                o.start(t);
                o.stop(t + 0.12);
            }
            const n = noise(false), g = gain(0);
            chain(n, filt("highpass", 3000), g, out);
            env(g, 0.12, 0.05, 2.6);
            shot([n], 2.7);
        }

        // ------------------------------------------------- tones and warnings

        // Continuous tones: the seeker growl / lock tone, and the warning beeps.
        const seek = osc("sine", 900), seekG = gain(0), seekAM = osc("sine", 18), seekAMg = gain(0);
        chain(seek, seekG, ui);
        chain(seekAM, seekAMg, seekG.gain);
        seek.start();
        seekAM.start();
        const warn = osc("square", 1000), warnF = filt("lowpass", 3000), warnG = gain(0);
        chain(warn, warnF, warnG, ui);
        warn.start();
        const horn = osc("square", 420), hornG = gain(0);
        chain(horn, filt("lowpass", 1500), hornG, ui);
        horn.start();
        let beepT = 0;

        // lock: 0 none, 0..1 locking, 1 locked. threat: "" | "lock" | "missile". alarm: stall/pull up.
        function tones(dt, lock, threat, alarm) {
            const t = now();
            if (lock >= 1) {
                seek.frequency.setTargetAtTime(1350, t, 0.02);
                seekG.gain.setTargetAtTime(0.09, t, 0.02);
                seekAMg.gain.setTargetAtTime(0, t, 0.02);
            } else if (lock > 0) {
                seek.frequency.setTargetAtTime(700 + 300 * lock, t, 0.05);
                seekG.gain.setTargetAtTime(0.04, t, 0.03);
                seekAMg.gain.setTargetAtTime(0.035, t, 0.03);
            } else {
                seekG.gain.setTargetAtTime(0, t, 0.03);
                seekAMg.gain.setTargetAtTime(0, t, 0.03);
            }
            beepT += dt;
            const rate = threat === "missile" ? 0.1 : threat === "lock" ? 0.32 : 0;
            if (rate && beepT >= rate) {
                beepT = 0;
                warn.frequency.setValueAtTime(threat === "missile" ? 1650 : 1050, t);
                warnG.gain.setValueAtTime(0.07, t);
                warnG.gain.setValueAtTime(0, t + rate * 0.55);
            }
            if (!rate) warnG.gain.setTargetAtTime(0, t, 0.02);
            hornG.gain.setTargetAtTime(alarm && Math.floor(t * 4) % 2 ? 0.035 : 0, t, 0.01);
        }

        // ------------------------------------------------------- explosions

        function boom(pos, scale, listenerPos) {
            if (muted()) return;
            const d = pos.distanceTo(listenerPos);
            if (d > 9000) return;
            const delay = Math.min(3, d / C);
            const p = panner(pos);
            const t = now() + delay;
            const dull = 600 + 6000 * Math.max(0, 1 - d / 4000) ** 2;
            const n = noise(false), lp = filt("lowpass", dull, 0.7), g = gain(0);
            chain(n, lp, g, p);
            lp.frequency.setValueAtTime(dull, t);
            lp.frequency.exponentialRampToValueAtTime(90, t + 1.8 * scale);
            env(g, 2.2 * Math.min(1.5, scale), 0.008, 1.8 * scale, t);
            const sub = osc("sine", 75), sg = gain(0);
            chain(sub, sg, p);
            sub.frequency.setValueAtTime(75, t);
            sub.frequency.exponentialRampToValueAtTime(28, t + 0.8);
            env(sg, 1.6 * Math.min(1.5, scale), 0.006, 0.9, t);
            const cr = noise(false), cf = filt("bandpass", 1200, 2), cg = gain(0);
            chain(cr, shaper(8), cf, cg, p);
            env(cg, 0.4, 0.05, 1.2, t + 0.1);
            [n, sub, cr].forEach(x => {
                x.start(t);
                x.stop(t + 2.6 * scale + 0.4);
            });
        }

        // ------------------------------------------------------------ frame

        function listen(camera, vel) {
            const L = ctx.listener, p = camera.position;
            const f = {x: 0, y: 0, z: -1}, u = {x: 0, y: 1, z: 0};
            const q = camera.quaternion;
            const fv = new D.THREE.Vector3(0, 0, -1).applyQuaternion(q), uv = new D.THREE.Vector3(0, 1, 0).applyQuaternion(q);
            Object.assign(f, {x: fv.x, y: fv.y, z: fv.z});
            Object.assign(u, {x: uv.x, y: uv.y, z: uv.z});
            if (L.positionX) {
                L.positionX.value = p.x;
                L.positionY.value = p.y;
                L.positionZ.value = p.z;
                L.forwardX.value = f.x;
                L.forwardY.value = f.y;
                L.forwardZ.value = f.z;
                L.upX.value = u.x;
                L.upY.value = u.y;
                L.upZ.value = u.z;
            } else {
                L.setPosition(p.x, p.y, p.z);
                L.setOrientation(f.x, f.y, f.z, u.x, u.y, u.z);
            }
        }

        let voiceT = 0;
        return {
            frame(dt, {camera, player, planes, cockpit, lock, threat, alarm, paused}) {
                if (paused) {
                    master.gain.setTargetAtTime(0, now(), 0.05);
                    return;
                }
                master.gain.setTargetAtTime(1, now(), 0.1);
                listen(camera);
                extFilter.frequency.setTargetAtTime(cockpit ? 2600 : 18000, now(), 0.1);
                updateEngine(player, dt, cockpit);
                voiceT -= dt;
                if (voiceT <= 0) {
                    voiceT = 0.05;
                    updateVoices(planes, player, camera.position, player && player.alive ? player.velocity : null);
                }
                tones(dt, lock, threat, alarm);
            },
            gun, clang, hitTick, killConfirm, missileLaunch, flares, boom,
            stop() {
                master.gain.setTargetAtTime(0, now(), 0.05);
                setTimeout(() => {
                    try {
                        if (engine) engine.stop();
                        voices.forEach(v => v.eng && v.eng.stop());
                        wind.stop();
                        scream.stop();
                        [seek, seekAM, warn, horn].forEach(n => n.stop());
                        master.disconnect();
                    } catch (e) {}
                }, 200);
            },
        };
    };

    // No sound available (old browser, or sound not allowed yet): do nothing.
    function dummy() {
        const nop = () => {};
        return {frame: nop, gun: nop, clang: nop, hitTick: nop, killConfirm: nop, missileLaunch: nop, flares: nop, boom: nop, stop: nop};
    }
})();
