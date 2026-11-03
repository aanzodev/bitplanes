// Activity sounds: your engine, guns, missiles, flares and explosions.
// Everything is synthesized with the Web Audio API (no audio files).
// Sounds from other planes get quieter and pan left/right with distance.
// Press M or the speaker button to mute.
(function () {
    const PROFILES = window.BitSoundProfiles;
    const HEAR_DISTANCE = 2200;
    const s = {ctx: null, master: null, noise: null, muted: false, volume: 0.8, listener: null, engine: null, last: {}};
    try {
        s.muted = localStorage.getItem("muted") === "1";
    } catch (e) {}

    // ----------------------------------------------------------------- setup

    function ctx() {
        if (!s.ctx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return null;
            s.ctx = new AC();
            const comp = s.ctx.createDynamicsCompressor();
            comp.connect(s.ctx.destination);
            s.master = s.ctx.createGain();
            s.master.gain.value = level();
            s.master.connect(comp);
            s.noise = noiseBuffer();
        }
        if (s.ctx.state === "suspended") s.ctx.resume();
        return s.ctx;
    }

    // Engine and gun levels from Settings (0..1, 1 = the loudest).
    function mix(k) {
        const v = window.BitSettings && window.BitSettings.get(k);
        return typeof v === "number" ? v : 0.6;
    }

    // Master level: off when muted, otherwise the Settings volume.
    function level() {
        return s.muted ? 0 : 0.875 * s.volume;
    }

    // Browsers only allow sound after the player clicks or presses a key.
    ["pointerdown", "keydown"].forEach(type => window.addEventListener(type, () => ctx(), {capture: true}));

    function noiseBuffer() {
        const len = s.ctx.sampleRate * 2, buf = s.ctx.createBuffer(1, len, s.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        return buf;
    }

    function noise() {
        const n = s.ctx.createBufferSource();
        n.buffer = s.noise;
        n.loop = true;
        n.loopStart = Math.random();
        return n;
    }

    function osc(type, freq) {
        const o = s.ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        return o;
    }

    function filter(type, freq, q = 1) {
        const f = s.ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        return f;
    }

    function gain(v) {
        const g = s.ctx.createGain();
        g.gain.value = v;
        return g;
    }

    function chain(...nodes) {
        for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
        return nodes[nodes.length - 1];
    }

    // --------------------------------------------------------------- position

    function listenerObject() {
        try {
            return s.listener && s.listener();
        } catch (e) {
            return undefined;
        }
    }

    // Output for a one-shot sound at a world position (or right here if pos is null).
    // Returns null when the sound is too far away or we are not in an activity.
    // dest: {node, dist} plays into that node instead (the 3D Air Battle mode
    // places sounds itself); dist 0..1 makes it duller with distance.
    function output(pos, volume, muffle, dest) {
        if (dest) {
            if (!ctx() || s.muted || volume < 0.01) return null;
            const g = gain(volume);
            if (muffle && dest.dist > 0) chain(g, filter("lowpass", 600 + 9000 * (1 - Math.min(1, dest.dist)) ** 2, 0.7), dest.node);
            else g.connect(dest.node);
            return g;
        }
        if (!s.listener || !ctx() || s.muted) return null;
        let v = volume, pan = 0, dist = 0;
        if (pos) {
            const me = listenerObject();
            if (!me) return null;
            const dx = pos.x - me.position.x, dy = pos.y - me.position.y;
            const d = Math.hypot(dx, dy);
            if (d > HEAR_DISTANCE) return null;
            v *= (1 - d / HEAR_DISTANCE) ** 1.5;
            pan = Math.max(-1, Math.min(1, dx / 900));
            dist = d / HEAR_DISTANCE;
        }
        if (v < 0.01) return null;
        const g = gain(v);
        let last = g;
        // muffle: far sounds lose their high end, like real distant gunfire.
        if (muffle && dist > 0) last = chain(g, filter("lowpass", 600 + 9000 * (1 - dist) ** 2, 0.7));
        if (s.ctx.createStereoPanner) {
            const p = s.ctx.createStereoPanner();
            p.pan.value = pan;
            chain(last, p, s.master);
        } else last.connect(s.master);
        return g;
    }

    function throttle(key, ms) {
        const now = performance.now();
        if (now - (s.last[key] || 0) < ms) return false;
        s.last[key] = now;
        return true;
    }

    function isMine(obj) {
        return obj && obj === listenerObject();
    }

    function profileOf(plane) {
        return PROFILES[plane && plane.planeId] || PROFILES.classic;
    }

    // Plays nodes from now for `dur` seconds with a quick attack and decay.
    function envelope(g, peak, attack, dur) {
        const t = s.ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }

    function startStop(nodes, dur) {
        const t = s.ctx.currentTime;
        nodes.forEach(n => {
            n.start(t);
            n.stop(t + dur + 0.05);
        });
    }

    // ------------------------------------------------------------------ guns

    // Real aircraft guns, each built from a few parts:
    //   crack  [Hz, Q]   the sharp supersonic snap of the muzzle blast
    //   body   Hz        how bright the blast's roar is (low-pass cutoff)
    //   thump  [Hz, Hz]  the low punch of the shot (falls from the first to the second)
    //   buzz   Hz        rotary cannons: barrels spinning (= rounds per second)
    //   click            light machine guns: the bolt cycling
    //   dur, vol         length of one shot and loudness
    const GUNS = {
        // WWI rifle-caliber machine guns: light, fast and rattly.
        // rof: real rounds per second for one gun.
        vickers: {name: "Vickers .303", crack: [2600, 1.6], body: 3200, thump: [200, 90], dur: 0.07, vol: 0.5, click: true, rof: 8},
        lewis: {name: "Lewis gun", crack: [2900, 1.8], body: 3600, thump: [230, 110], dur: 0.06, vol: 0.42, click: true, rof: 9.5},
        spandau: {name: "LMG 08/15 Spandau", crack: [2300, 1.5], body: 2800, thump: [180, 85], dur: 0.075, vol: 0.52, click: true, rof: 7.5},
        // WWII
        shkas: {name: "ShKAS 7.62 mm", crack: [3200, 1.4], body: 3800, thump: [240, 120], dur: 0.045, vol: 0.4, click: true, rof: 30},
        browning303: {name: "Browning .303", crack: [2400, 1.3], body: 3000, thump: [190, 85], dur: 0.06, vol: 0.48, click: true, rof: 19},
        m2: {name: "Browning M2 .50 cal", crack: [1500, 1.4], body: 2000, thump: [130, 55], dur: 0.12, vol: 0.7, rof: 13},
        mg151: {name: "MG 151/20 20 mm", crack: [950, 1.2], body: 1500, thump: [95, 42], dur: 0.17, vol: 0.8, rof: 12},
        type99: {name: "Type 99 20 mm", crack: [1050, 1.2], body: 1600, thump: [100, 45], dur: 0.16, vol: 0.78, rof: 8},
        shvak: {name: "ShVAK 20 mm", crack: [1000, 1.2], body: 1550, thump: [98, 44], dur: 0.15, vol: 0.76, rof: 13},
        hispano: {name: "Hispano 20 mm", crack: [900, 1.1], body: 1450, thump: [90, 40], dur: 0.18, vol: 0.82, rof: 11},
        // Jets
        gsh23: {name: "GSh-23 23 mm", crack: [850, 1.1], body: 1400, thump: [85, 40], dur: 0.12, vol: 0.75, buzz: 57, rof: 57},
        gsh301: {name: "GSh-30-1 30 mm", crack: [700, 1.0], body: 1200, thump: [70, 32], dur: 0.2, vol: 0.9, rof: 27},
        m61: {name: "M61 Vulcan 20 mm", crack: [1300, 0.9], body: 2200, thump: [110, 60], dur: 0.09, vol: 0.55, buzz: 100, rof: 100},
        gau22: {name: "GAU-22/A 25 mm", crack: [1100, 0.9], body: 1800, thump: [95, 50], dur: 0.1, vol: 0.6, buzz: 55, rof: 55},
        gau8: {name: "GAU-8 Avenger 30 mm", crack: [600, 0.8], body: 900, thump: [65, 35], dur: 0.13, vol: 0.62, buzz: 65, rof: 65},
    };
    // More WWII guns for mixed loadouts.
    GUNS.mg131 = {name: "MG 131 13 mm", crack: [1700, 1.3], body: 2300, thump: [140, 62], dur: 0.1, vol: 0.62, rof: 15};
    GUNS.type97 = {name: "Type 97 7.7 mm", crack: [2700, 1.5], body: 3300, thump: [210, 95], dur: 0.06, vol: 0.45, click: true, rof: 15};
    GUNS.ubs = {name: "Berezin UBS 12.7 mm", crack: [1600, 1.3], body: 2200, thump: [135, 58], dur: 0.1, vol: 0.64, rof: 17};
    // Older names still used by some code paths.
    GUNS.mg = GUNS.vickers;
    GUNS.cannon = GUNS.m61;
    GUNS.brrt = GUNS.gau8;
    // The gun a plane shape usually carries (for planes we only know the shape of).
    const SHAPE_GUN = {"": "vickers", prop: "m2", jet: "m61", bomber: "m61"};

    // One round, scheduled at time t0, into node out. Real aircraft guns are
    // built from a few parts:
    //   crack  [Hz, Q]   the sharp supersonic snap of the muzzle blast
    //   body   Hz        how bright the blast's roar is (low-pass cutoff)
    //   thump  [Hz, Hz]  the low punch of the shot (falls from the first to the second)
    //   buzz   Hz        rotary cannons: the barrels' tearing buzz (len: how long it runs)
    //   click            light machine guns: the bolt clacking back
    function shotAt(g, out, t0, volume = 1, len = 0) {
        const vary = 0.9 + Math.random() * 0.2; // no two shots sound exactly alike
        const dur = g.dur * vary, v = g.vol * vary * volume;
        const env = (gn, peak, attack, d, at = t0) => {
            gn.gain.setValueAtTime(0.0001, at);
            gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
            gn.gain.exponentialRampToValueAtTime(0.0001, at + d);
        };
        const run = (nodes, d) => nodes.forEach(n => {
            n.start(t0);
            n.stop(t0 + d + 0.05);
        });
        const nodes = [];
        const n1 = noise(), cg = gain(0);
        chain(n1, filter("bandpass", g.crack[0] * vary, g.crack[1]), cg, out);
        env(cg, v * 0.9, 0.001, dur * 0.35);
        nodes.push(n1);
        const n2 = noise(), bg = gain(0);
        chain(n2, filter("lowpass", g.body, 0.7), bg, out);
        env(bg, v * 0.6, 0.002, dur);
        nodes.push(n2);
        const th = osc("sine", g.thump[0] * vary), tg = gain(0);
        chain(th, tg, out);
        th.frequency.setValueAtTime(g.thump[0] * vary, t0);
        th.frequency.exponentialRampToValueAtTime(g.thump[1], t0 + dur * 0.8);
        env(tg, v * 0.7, 0.002, dur * 0.85);
        nodes.push(th);
        if (g.buzz) {
            const blen = Math.max(dur * 1.3, len);
            const saw = osc("sawtooth", g.buzz * vary), sub = osc("square", g.buzz / 2), zg = gain(0);
            chain(saw, filter("lowpass", g.body * 0.8, 1.2), zg, out);
            chain(sub, filter("lowpass", 300), zg);
            zg.gain.setValueAtTime(0.0001, t0);
            zg.gain.exponentialRampToValueAtTime(v * 0.55, t0 + 0.004);
            zg.gain.setValueAtTime(v * 0.55, t0 + Math.max(0.005, blen - 0.03));
            zg.gain.exponentialRampToValueAtTime(0.0001, t0 + blen);
            nodes.push(saw, sub);
            run(nodes, Math.max(dur * 1.4, blen));
            return;
        }
        if (g.click) {
            const n3 = noise(), kg = gain(0);
            chain(n3, filter("highpass", 4500), kg, out);
            kg.gain.setValueAtTime(0.0001, t0);
            kg.gain.setValueAtTime(0.0001, t0 + dur * 0.55);
            kg.gain.exponentialRampToValueAtTime(v * 0.25, t0 + dur * 0.56);
            kg.gain.exponentialRampToValueAtTime(0.0001, t0 + dur * 0.56 + 0.012);
            nodes.push(n3);
        }
        run(nodes, dur * 1.4);
    }

    // A single round of a gun type (used where only the type is known).
    function playGun(type, pos, volume, dest) {
        const g = GUNS[type] || GUNS.vickers;
        // Far-away guns are quieter and duller (the air soaks up the crack).
        const out = output(pos, volume, true, dest);
        if (!out) return;
        shotAt(g, out, s.ctx.currentTime);
    }

    // Every plane sounds different: its own airframe resonance (where its
    // guns sit rings the structure around them), from its name.
    function voiceOf(id) {
        let h = 2166136261;
        for (const c of String(id || "x")) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
        return {freq: 280 + (h % 1000), q: 1.2 + ((h >>> 10) % 20) / 10, db: 4 + ((h >>> 16) % 6)};
    }

    // A volley: every gun the plane carries, for one firing interval (in
    // seconds). profile: from profiles.js (guns: [[type, count], ...], mount:
    // "nose" | "wing" | "sync" | "side" | "internal"). Mixed loadouts like the
    // Spitfire's two 20 mm cannons and four .303s play together, at their real
    // rates of fire: eight .50 cals chatter densely, a synchronized WWI gun
    // fires slower through the propeller, rotary cannons tear continuously.
    function volley(profile, pos, volume, dest, interval = 0.08) {
        const out = output(pos, volume, true, dest);
        if (!out) return;
        const t0 = s.ctx.currentTime;
        const id = profile.id || profile.gun;
        const vc = voiceOf(id), mount = profile.mount || "nose";
        // The plane's own sound: resonance, then how the mounting colors it.
        const head = gain(1), res = filter("peaking", vc.freq, vc.q);
        res.gain.value = vc.db;
        let last = chain(head, res);
        if (mount === "internal") last = chain(last, filter("lowpass", 2800, 0.9));
        if (mount === "sync") last = chain(last, filter("lowpass", 6500, 0.7));
        if (mount === "nose") {
            const shelf = filter("lowshelf", 180);
            shelf.gain.value = 5;
            last = chain(last, shelf);
        }
        last.connect(out);
        const groups = profile.guns || [[profile.gun || "vickers", 1]];
        // How many rounds land in this interval, at most 6 sounds in all.
        const want = groups.map(([type, count]) => {
            const g = GUNS[type] || GUNS.vickers;
            return g.buzz ? 1 : Math.max(1, count * (g.rof || 10) * interval * (mount === "sync" ? 0.85 : 1));
        });
        const total = want.reduce((a, b) => a + b, 0), scale = Math.min(1, 6 / total);
        groups.forEach(([type, count], gi) => {
            const g = GUNS[type] || GUNS.vickers;
            const n = g.buzz ? 1 : Math.max(1, Math.round(want[gi] * scale));
            // Several guns at once are louder, but not simply added up.
            // Rifle-caliber guns are lighter, but not that much quieter in the cockpit.
            const kind = g.click ? 1.8 : g.buzz ? 0.85 : 1;
            const vol = kind * Math.min(1.6, Math.sqrt(count)) / Math.sqrt(Math.max(1, n * 0.7));
            let dst = head;
            if (mount === "wing" && s.ctx.createStereoPanner) {
                const pan = s.ctx.createStereoPanner();
                pan.pan.value = (gi % 2 ? 0.3 : -0.3) * (pos ? 0.4 : 1);
                pan.connect(head);
                dst = pan;
            }
            for (let k = 0; k < n; k++) {
                const at = t0 + (k + Math.random() * 0.6) / n * interval * (g.buzz ? 0 : 1);
                shotAt(g, dst, at, vol, g.buzz ? interval * 1.15 : 0);
            }
        });
    }

    function gun(plane) {
        const mine = isMine(plane);
        if (!mine && !throttle("gun", 35)) return;
        const prof = profileOf(plane);
        volley(Object.assign({id: plane.planeId}, prof), mine ? null : plane.position, (mine ? 0.75 : 0.45) * mix("gunVolume"), undefined, 0.08);
    }

    // --------------------------------------------------- missiles and flares

    function missile(plane) {
        const mine = isMine(plane);
        const out = output(mine ? null : plane.position, mine ? 0.9 : 0.6);
        if (!out) return;
        const dur = 1.0, t = s.ctx.currentTime;
        const n = noise(), bp = filter("bandpass", 2600, 1.4), g = gain(0);
        chain(n, bp, g, out);
        bp.frequency.exponentialRampToValueAtTime(600, t + dur);
        envelope(g, 0.5, 0.03, dur);
        const thump = osc("sine", 140), tg = gain(0);
        chain(thump, tg, out);
        thump.frequency.exponentialRampToValueAtTime(45, t + 0.18);
        envelope(tg, 0.5, 0.005, 0.2);
        startStop([n, thump], dur);
    }

    function flares(plane) {
        const mine = isMine(plane);
        if (!mine && !throttle("flares", 400)) return;
        const out = output(mine ? null : plane.position, mine ? 0.8 : 0.5);
        if (!out) return;
        // Twelve quick pairs of pops (one per flare), then a long burning fizz.
        for (let k = 0; k < 24; k++) {
            const t = s.ctx.currentTime + Math.floor(k / 2) * 0.055 + (k % 2) * 0.02, pop = osc("sine", 950), g = gain(0);
            chain(pop, g, out);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.35, t + 0.004);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
            pop.frequency.setValueAtTime(950, t);
            pop.frequency.exponentialRampToValueAtTime(220, t + 0.07);
            pop.start(t);
            pop.stop(t + 0.1);
        }
        const n = noise(), g = gain(0);
        chain(n, filter("highpass", 3500), g, out);
        envelope(g, 0.14, 0.05, 2.2);
        startStop([n], 2.2);
    }

    // Guests only see other players' flares as particles.
    function flaresAt(pos) {
        flares({position: pos});
    }

    // ------------------------------------------------------------ explosions

    function explosion(pos) {
        if (!throttle("boom", 60)) return;
        const out = output(pos, 0.9);
        if (!out) return;
        const dur = 1.1, t = s.ctx.currentTime;
        const n = noise(), lp = filter("lowpass", 1400), g = gain(0);
        chain(n, lp, g, out);
        lp.frequency.exponentialRampToValueAtTime(120, t + dur);
        envelope(g, 0.8, 0.005, dur);
        const sub = osc("sine", 70), sg = gain(0);
        chain(sub, sg, out);
        sub.frequency.exponentialRampToValueAtTime(35, t + 0.5);
        envelope(sg, 0.7, 0.005, 0.55);
        startStop([n, sub], dur);
    }

    // A far-off rumble of thunder (storms).
    function thunder() {
        const out = output(null, 0.55);
        if (!out) return;
        const dur = 3, t = s.ctx.currentTime;
        const n = noise(), lp = filter("lowpass", 900), g = gain(0);
        chain(n, lp, g, out);
        lp.frequency.exponentialRampToValueAtTime(90, t + dur);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.9, t + 0.08);
        g.gain.linearRampToValueAtTime(0.5, t + 0.6);
        g.gain.linearRampToValueAtTime(0.7, t + 1);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        startStop([n], dur);
    }

    // ---------------------------------------------------------- your engine

    // Your plane's engine, modelled on its real engine (audio/engines.js).
    function buildEngine(profile) {
        const out = gain(0);
        out.connect(s.master);
        return {profile, out, eng: window.BitEngines.create(s.ctx, out, profile, s.noise)};
    }

    function stopEngine() {
        if (!s.engine) return;
        const e = s.engine;
        s.engine = null;
        e.out.gain.setTargetAtTime(0, s.ctx.currentTime, 0.05);
        e.eng.stop();
    }

    function updateEngine() {
        if (!s.ctx || !s.listener) return;
        const obj = listenerObject();
        const plane = obj && obj.maxThrust !== undefined && obj.thrust !== undefined && obj.elevator !== undefined ? obj : null;
        if (!plane || s.muted) {
            if (s.engine) s.engine.out.gain.setTargetAtTime(0, s.ctx.currentTime, 0.15);
            return;
        }
        const profile = profileOf(plane);
        if (!s.engine || s.engine.profile !== profile) {
            stopEngine();
            s.engine = buildEngine(profile);
        }
        const e = s.engine;
        const t = Math.max(0, Math.min(1, plane.thrust / (plane.maxThrust || 17)));
        e.out.gain.setTargetAtTime((profile.kind === "jet" ? 0.2 : 0.24) * mix("engineVolume"), s.ctx.currentTime, 0.1);
        // Jets light the afterburner at full throttle.
        e.eng.set(t, {boost: profile.kind === "jet" && t > 0.85, speed: t, level: profile.idleSilent && t === 0 ? 0 : 1});
    }

    setInterval(updateEngine, 60);

    // ---------------------------------------------------------------- mute

    function setMuted(muted) {
        s.muted = muted;
        try {
            localStorage.setItem("muted", muted ? "1" : "0");
        } catch (e) {}
        if (s.master) s.master.gain.setTargetAtTime(level(), s.ctx.currentTime, 0.05);
        document.querySelectorAll(".sound-toggle").forEach(b => {
            b.textContent = muted ? "🔇" : "🔊";
            b.title = muted ? "Sound off (M)" : "Sound on (M)";
        });
    }

    function init() {
        document.querySelectorAll(".sound-toggle").forEach(b => b.addEventListener("click", ev => {
            ev.currentTarget.blur();
            setMuted(!s.muted);
        }));
        document.addEventListener("keydown", ev => {
            if (ev.code === "KeyM" && !ev.repeat && !/INPUT|TEXTAREA/.test(ev.target.tagName)) setMuted(!s.muted);
        });
        setMuted(s.muted);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    window.BitSound = {
        // fn returns the object you are flying (plane or pilot); sounds are heard from there.
        setListener: fn => (s.listener = fn),
        gun, missile, flares, flaresAt, explosion, thunder,
        gunAt: (pos, type) => throttle("gun", 35) && playGun(type || "mg", pos, 0.6),
        // Online guests only know the shooter's plane shape.
        gunForShape: shape => SHAPE_GUN[shape || ""] || "vickers",
        // A gun sound right here (no position), e.g. for the 3D Air Battle beta.
        playGun: (type, volume = 1) => playGun(type, null, volume),
        // A gun sound into a node of your own (3D Air Battle), dist 0..1 for distance.
        playGunInto: (type, node, volume = 1, dist = 0) => playGun(type, null, volume * mix("gunVolume"), {node, dist}),
        // A plane's whole gun loadout for one firing interval, into a node of your own (3D Air Battle).
        volleyInto: (planeId, node, volume = 1, dist = 0, interval = 0.08) =>
            volley(Object.assign({id: planeId}, PROFILES[planeId] || PROFILES.classic), null, volume * mix("gunVolume"), {node, dist}, interval),
        mix,
        profileGuns: planeId => (PROFILES[planeId] || {}).guns || null,
        // The shared audio context and master output (null until sound is allowed).
        context: () => ctx(),
        master: () => (ctx(), s.master),
        noiseBuffer: () => (ctx(), s.noise),
        setVolume(v) {
            s.volume = Math.max(0, Math.min(1, Number(v) || 0));
            if (s.master) s.master.gain.setTargetAtTime(level(), s.ctx.currentTime, 0.05);
        },
        guns: GUNS,
        missileAt: pos => missile({position: pos}),
        setMuted,
        isMuted: () => s.muted,
        state: s,
    };
})();
