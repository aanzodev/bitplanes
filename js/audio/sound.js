// Game sounds: your engine, guns, missiles, flares and explosions.
// Everything is synthesized with the Web Audio API (no audio files).
// Sounds from other planes get quieter and pan left/right with distance.
// Press M or the speaker button to mute.
(function () {
    const PROFILES = window.BitSoundProfiles;
    const HEAR_DISTANCE = 2200;
    const s = {ctx: null, master: null, noise: null, muted: false, listener: null, engine: null, last: {}};
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
            s.master.gain.value = s.muted ? 0 : 0.7;
            s.master.connect(comp);
            s.noise = noiseBuffer();
        }
        if (s.ctx.state === "suspended") s.ctx.resume();
        return s.ctx;
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
    // Returns null when the sound is too far away or we are not in a game.
    function output(pos, volume) {
        if (!s.listener || !ctx() || s.muted) return null;
        let v = volume, pan = 0;
        if (pos) {
            const me = listenerObject();
            if (!me) return null;
            const dx = pos.x - me.position.x, dy = pos.y - me.position.y;
            const d = Math.hypot(dx, dy);
            if (d > HEAR_DISTANCE) return null;
            v *= (1 - d / HEAR_DISTANCE) ** 1.5;
            pan = Math.max(-1, Math.min(1, dx / 900));
        }
        if (v < 0.01) return null;
        const g = gain(v);
        if (s.ctx.createStereoPanner) {
            const p = s.ctx.createStereoPanner();
            p.pan.value = pan;
            chain(g, p, s.master);
        } else g.connect(s.master);
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

    function gun(plane) {
        const mine = isMine(plane);
        if (!mine && !throttle("gun", 35)) return;
        playGun(profileOf(plane).gun, mine ? null : plane.position, mine ? 1 : 0.6);
    }

    function playGun(type, pos, volume) {
        const out = output(pos, volume);
        if (!out) return;
        if (type === "brrt") {
            // GAU-8: a deep, very fast buzz.
            const dur = 0.11, saw = osc("sawtooth", 64), n = noise(), g = gain(0);
            chain(saw, filter("lowpass", 700), g);
            chain(n, filter("bandpass", 350, 0.8), g);
            chain(g, out);
            envelope(g, 0.55, 0.004, dur);
            startStop([saw, n], dur);
        } else if (type === "cannon") {
            // M61 Vulcan: a quick tearing burst.
            const dur = 0.09, n = noise(), am = gain(0.5), lfo = osc("square", 95), depth = gain(0.5), g = gain(0);
            chain(lfo, depth);
            depth.connect(am.gain);
            chain(n, filter("bandpass", 1100, 0.9), am, g, out);
            envelope(g, 0.45, 0.003, dur);
            startStop([n, lfo], dur);
        } else {
            // Machine gun: a short sharp pop.
            const dur = 0.06, n = noise(), g = gain(0), thump = osc("triangle", 180), tg = gain(0);
            chain(n, filter("bandpass", 1700, 1.2), g, out);
            chain(thump, tg, out);
            envelope(g, 0.5, 0.002, dur);
            envelope(tg, 0.25, 0.002, dur);
            thump.frequency.exponentialRampToValueAtTime(60, s.ctx.currentTime + dur);
            startStop([n, thump], dur);
        }
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
        if (profile.kind === "jet") {
            e.roarLp.frequency.setTargetAtTime(profile.roar[0] + (profile.roar[1] - profile.roar[0]) * t, now, glide);
            e.roarGain.gain.setTargetAtTime(0.14 + 0.3 * t, now, glide);
            e.whine.frequency.setTargetAtTime(profile.whine[0] + (profile.whine[1] - profile.whine[0]) * t, now, glide);
            e.whineGain.gain.setTargetAtTime(profile.whineVol * (0.4 + 0.6 * t), now, glide);
            e.burnerGain.gain.setTargetAtTime(t > 0.8 ? profile.burner * (t - 0.8) / 0.2 : 0, now, glide);
            e.out.gain.setTargetAtTime(0.5, now, glide);
        } else {
            const f = profile.base + profile.range * t;
            e.osc1.frequency.setTargetAtTime(f, now, glide);
            e.osc2.frequency.setTargetAtTime(f / 2, now, glide);
            e.lfo.frequency.setTargetAtTime(profile.pulse * (0.6 + 0.8 * t), now, glide);
            e.tone.frequency.setTargetAtTime(profile.tone * (0.6 + 0.9 * t), now, glide);
            e.washGain.gain.setTargetAtTime(0.03 + 0.07 * t, now, glide);
            if (e.whistleGain) e.whistleGain.gain.setTargetAtTime(0.03 * t, now, glide);
            let vol = 0.16 + 0.22 * t;
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
        if (s.master) s.master.gain.setTargetAtTime(muted ? 0 : 0.7, s.ctx.currentTime, 0.05);
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
        gun, missile, flares, flaresAt, explosion,
        gunAt: (pos, type) => throttle("gun", 35) && playGun(type || "mg", pos, 0.6),
        missileAt: pos => missile({position: pos}),
        setMuted,
        isMuted: () => s.muted,
        state: s,
    };
})();
