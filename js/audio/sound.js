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
    // dest: {node, dist} plays into that node instead (the 3D Dogfights mode
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
        vickers: {name: "Vickers .303", crack: [2600, 1.6], body: 3200, thump: [200, 90], dur: 0.07, vol: 0.5, click: true},
        lewis: {name: "Lewis gun", crack: [2900, 1.8], body: 3600, thump: [230, 110], dur: 0.06, vol: 0.42, click: true},
        spandau: {name: "LMG 08/15 Spandau", crack: [2300, 1.5], body: 2800, thump: [180, 85], dur: 0.075, vol: 0.52, click: true},
        // WWII
        shkas: {name: "ShKAS 7.62 mm", crack: [3200, 1.4], body: 3800, thump: [240, 120], dur: 0.045, vol: 0.4, click: true},
        browning303: {name: "Browning .303", crack: [2400, 1.3], body: 3000, thump: [190, 85], dur: 0.06, vol: 0.48, click: true},
        m2: {name: "Browning M2 .50 cal", crack: [1500, 1.4], body: 2000, thump: [130, 55], dur: 0.12, vol: 0.7},
        mg151: {name: "MG 151/20 20 mm", crack: [950, 1.2], body: 1500, thump: [95, 42], dur: 0.17, vol: 0.8},
        type99: {name: "Type 99 20 mm", crack: [1050, 1.2], body: 1600, thump: [100, 45], dur: 0.16, vol: 0.78},
        shvak: {name: "ShVAK 20 mm", crack: [1000, 1.2], body: 1550, thump: [98, 44], dur: 0.15, vol: 0.76},
        hispano: {name: "Hispano 20 mm", crack: [900, 1.1], body: 1450, thump: [90, 40], dur: 0.18, vol: 0.82},
        // Jets
        gsh23: {name: "GSh-23 23 mm", crack: [850, 1.1], body: 1400, thump: [85, 40], dur: 0.12, vol: 0.75, buzz: 57},
        gsh301: {name: "GSh-30-1 30 mm", crack: [700, 1.0], body: 1200, thump: [70, 32], dur: 0.2, vol: 0.9},
        m61: {name: "M61 Vulcan 20 mm", crack: [1300, 0.9], body: 2200, thump: [110, 60], dur: 0.09, vol: 0.55, buzz: 100},
        gau22: {name: "GAU-22/A 25 mm", crack: [1100, 0.9], body: 1800, thump: [95, 50], dur: 0.1, vol: 0.6, buzz: 55},
        gau8: {name: "GAU-8 Avenger 30 mm", crack: [600, 0.8], body: 900, thump: [65, 35], dur: 0.13, vol: 0.62, buzz: 65},
    };
    // Older names still used by some code paths.
    GUNS.mg = GUNS.vickers;
    GUNS.cannon = GUNS.m61;
    GUNS.brrt = GUNS.gau8;
    // The gun a plane shape usually carries (for planes we only know the shape of).
    const SHAPE_GUN = {"": "vickers", prop: "m2", jet: "m61", bomber: "m61"};

    function gun(plane) {
        const mine = isMine(plane);
        if (!mine && !throttle("gun", 35)) return;
        playGun(profileOf(plane).gun, mine ? null : plane.position, mine ? 1 : 0.6);
    }

    function playGun(type, pos, volume, dest) {
        const g = GUNS[type] || GUNS.vickers;
        // Far-away guns are quieter and duller (the air soaks up the crack).
        const out = output(pos, volume, true, dest);
        if (!out) return;
        const t = s.ctx.currentTime;
        const vary = 0.9 + Math.random() * 0.2; // no two shots sound exactly alike
        const dur = g.dur * vary, v = g.vol * vary;
        const nodes = [];

        // Crack: a short, bright snap.
        const n1 = noise(), cg = gain(0);
        chain(n1, filter("bandpass", g.crack[0] * vary, g.crack[1]), cg, out);
        envelope(cg, v * 0.9, 0.001, dur * 0.35);
        nodes.push(n1);

        // Body: the roar of the blast.
        const n2 = noise(), bg = gain(0);
        chain(n2, filter("lowpass", g.body, 0.7), bg, out);
        envelope(bg, v * 0.6, 0.002, dur);
        nodes.push(n2);

        // Thump: the punch you feel.
        const th = osc("sine", g.thump[0] * vary), tg = gain(0);
        chain(th, tg, out);
        th.frequency.exponentialRampToValueAtTime(g.thump[1], t + dur * 0.8);
        envelope(tg, v * 0.7, 0.002, dur * 0.85);
        nodes.push(th);

        // Rotary cannons: the barrels spinning, a tearing buzz.
        if (g.buzz) {
            const saw = osc("sawtooth", g.buzz * vary), sub = osc("square", g.buzz / 2), zg = gain(0);
            chain(saw, filter("lowpass", g.body * 0.8, 1.2), zg, out);
            chain(sub, filter("lowpass", 300), zg);
            envelope(zg, v * 0.55, 0.004, dur * 1.3);
            nodes.push(saw, sub);
        }

        // Light machine guns: the bolt clacking back.
        if (g.click) {
            const n3 = noise(), kg = gain(0);
            chain(n3, filter("highpass", 4500), kg, out);
            kg.gain.setValueAtTime(0.0001, t);
            kg.gain.setValueAtTime(0.0001, t + dur * 0.55);
            kg.gain.exponentialRampToValueAtTime(v * 0.25, t + dur * 0.56);
            kg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.56 + 0.012);
            nodes.push(n3);
        }
        startStop(nodes, dur * 1.4);
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
        // Four pairs of pops, then a burning fizz.
        for (let k = 0; k < 4; k++) {
            const t = s.ctx.currentTime + k * 0.09, pop = osc("sine", 950), g = gain(0);
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
        envelope(g, 0.14, 0.05, 0.9);
        startStop([n], 0.9);
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

    function buildEngine(profile) {
        const out = gain(0);
        out.connect(s.master);
        const e = {profile, out, nodes: []};
        if (profile.kind === "jet") {
            const roar = noise(), roarLp = filter("lowpass", profile.roar[0], 0.7);
            e.roarLp = roarLp;
            e.roarGain = gain(0.2);
            chain(roar, roarLp, e.roarGain, out);
            e.whine = osc("sine", profile.whine[0]);
            e.whineGain = gain(profile.whineVol);
            chain(e.whine, e.whineGain, out);
            const burner = noise();
            e.burnerGain = gain(0);
            chain(burner, filter("lowpass", 180, 0.8), e.burnerGain, out);
            e.nodes.push(roar, e.whine, burner);
        } else {
            e.osc1 = osc(profile.wave, profile.base);
            e.osc2 = osc("square", profile.base / 2);
            const mix = gain(0.6), sub = gain(0.25);
            e.tone = filter("lowpass", profile.tone, 1.5);
            e.am = gain(0.6);
            e.lfo = osc("sine", profile.pulse);
            const depth = gain(0.4);
            chain(e.lfo, depth);
            depth.connect(e.am.gain);
            e.osc1.connect(mix);
            chain(e.osc2, sub, mix);
            chain(mix, e.tone, e.am, out);
            const wash = noise();
            e.washGain = gain(0.05);
            chain(wash, filter("bandpass", 650, 0.7), e.washGain, out);
            e.nodes.push(e.osc1, e.osc2, e.lfo, wash);
            if (profile.whistle) {
                e.whistle = osc("sine", profile.whistle);
                e.whistleGain = gain(0);
                chain(e.whistle, e.whistleGain, out);
                e.nodes.push(e.whistle);
            }
        }
        e.nodes.forEach(n => n.start());
        return e;
    }

    function stopEngine() {
        if (!s.engine) return;
        const e = s.engine;
        s.engine = null;
        e.out.gain.setTargetAtTime(0, s.ctx.currentTime, 0.05);
        setTimeout(() => e.nodes.forEach(n => n.stop()), 300);
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
        const e = s.engine, now = s.ctx.currentTime, glide = 0.12;
        const t = Math.max(0, Math.min(1, plane.thrust / (plane.maxThrust || 17)));
        // Overall loudness for this plane; some engines are silent at idle.
        const level = (profile.volume || 1) * (profile.idleSilent && t === 0 ? 0 : 1);
        if (profile.kind === "jet") {
            e.roarLp.frequency.setTargetAtTime(profile.roar[0] + (profile.roar[1] - profile.roar[0]) * t, now, glide);
            e.roarGain.gain.setTargetAtTime(0.14 + 0.3 * t, now, glide);
            e.whine.frequency.setTargetAtTime(profile.whine[0] + (profile.whine[1] - profile.whine[0]) * t, now, glide);
            e.whineGain.gain.setTargetAtTime(profile.whineVol * (0.4 + 0.6 * t), now, glide);
            e.burnerGain.gain.setTargetAtTime(t > 0.8 ? profile.burner * (t - 0.8) / 0.2 : 0, now, glide);
            e.out.gain.setTargetAtTime(0.5 * level, now, glide);
        } else {
            const f = profile.base + profile.range * t;
            e.osc1.frequency.setTargetAtTime(f, now, glide);
            e.osc2.frequency.setTargetAtTime(f / 2, now, glide);
            e.lfo.frequency.setTargetAtTime(profile.pulse * (0.6 + 0.8 * t), now, glide);
            e.tone.frequency.setTargetAtTime(profile.tone * (0.6 + 0.9 * t), now, glide);
            e.washGain.gain.setTargetAtTime(0.03 + 0.07 * t, now, glide);
            if (e.whistleGain) e.whistleGain.gain.setTargetAtTime(0.03 * t, now, glide);
            let vol = (0.16 + 0.22 * t) * level;
            if (profile.sputter && Math.random() < profile.sputter) vol *= 0.35;
            e.out.gain.setTargetAtTime(vol, now, 0.04);
        }
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
        // A gun sound right here (no position), e.g. for the 3D Dogfights beta.
        playGun: (type, volume = 1) => playGun(type, null, volume),
        // A gun sound into a node of your own (3D Dogfights), dist 0..1 for distance.
        playGunInto: (type, node, volume = 1, dist = 0) => playGun(type, null, volume, {node, dist}),
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
