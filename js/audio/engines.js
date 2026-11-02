// Engine sounds modelled on each plane's real engine (see the "engine"
// entries in profiles.js). Used by Bit Planes (sound.js) and Dogfights
// (dogfight/audio.js) alike.
//
// Piston engines are built from how they really work:
//   - each cylinder fires once every two turns, so the firing note is
//     rpm / 60 * cylinders / 2 (a Merlin V12 at 3,000 rpm: 300 Hz, a 9 cylinder
//     rotary at 1,200 rpm: 90 Hz), shaped by the exhaust's resonances;
//   - exhaust pops ride on every firing; a lope once per turn of the crank
//     (radials are lumpy, V12s smooth) and small timing wobbles (rough);
//   - the propeller adds a "whop" at its blade-pass rate and a wash of air;
//   - superchargers and turbochargers whine; the P-51's scoop whistles;
//   - rotary engines (WWI) stutter on the blip switch;
//   - twin-engine planes have two engines a little out of step, which beat.
// Jet engines:
//   - roar (broadband exhaust noise), turbine whine (and its harmonic),
//   - turbofans buzz (the fan's "buzzsaw" tone at high thrust),
//   - turbojets rasp and howl, the A-10's TF34s whine loudly,
//   - the afterburner adds thunder and crackle.
window.BitEngines = (function () {
    function makeCurve(amount) {
        const n = 1024, c = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            const x = i / (n - 1) * 2 - 1;
            c[i] = Math.tanh(x * amount);
        }
        return c;
    }

    // ctx: AudioContext, dest: node to play into, p: the plane's sound profile
    // (with p.engine), noiseBuf: a looping noise buffer.
    function create(ctx, dest, p, noiseBuf) {
        const E = p.engine || {type: p.kind === "jet" ? "turbofan" : "inline", cyl: 6, rpm: [700, 2600]};
        const nodes = [];
        const osc = (type, f) => {
            const o = ctx.createOscillator();
            o.type = type;
            o.frequency.value = f;
            nodes.push(o);
            return o;
        };
        const noise = () => {
            const n = ctx.createBufferSource();
            n.buffer = noiseBuf;
            n.loop = true;
            n.loopStart = Math.random();
            nodes.push(n);
            return n;
        };
        const filt = (type, f, q = 1) => {
            const b = ctx.createBiquadFilter();
            b.type = type;
            b.frequency.value = f;
            b.Q.value = q;
            return b;
        };
        const gain = v => {
            const g = ctx.createGain();
            g.gain.value = v;
            return g;
        };
        const chain = (...n) => {
            for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]);
            return n[n.length - 1];
        };
        const shaper = a => {
            const w = ctx.createWaveShaper();
            w.curve = makeCurve(a);
            return w;
        };

        const out = gain(0);
        out.connect(dest);
        const v = {out, nodes};
        const jet = E.type === "turbojet" || E.type === "turbofan" || E.type === "tf34" || E.type === "stealth";

        if (!jet) {
            // ---- one piston engine (a second, slightly out of step, for twins)
            const engines = E.engines || 1;
            v.fire = [];
            v.cranks = [];
            for (let k = 0; k < engines; k++) {
                const f = osc("sawtooth", 80);
                const wob = osc("sine", 7 + k * 1.3), wobG = gain(0);
                chain(wob, wobG, f.frequency);
                const sh = shaper(E.drive || 3);
                const body = filt("bandpass", 300, 1.1), bodyG = gain(0.55);
                const exh = filt("bandpass", E.exhaust || 1100, 2.2), exhG = gain(0.3 * (E.bright || 0.8));
                const crank = gain(1);
                chain(f, sh);
                sh.connect(body);
                sh.connect(exh);
                chain(body, bodyG, crank);
                chain(exh, exhG, crank);
                crank.connect(out);
                // The lope: once per turn of the crank.
                const lope = osc("sine", 10), lopeG = gain(0);
                chain(lope, lopeG, crank.gain);
                v.fire.push({f, wobG, body, exh, lope, lopeG, detune: 1 + k * 0.013});
                v.cranks.push(crank);
            }
            // Exhaust pops on each firing.
            const pops = noise(), popsF = filt("bandpass", E.exhaust || 1100, 1.4), popsAM = gain(0), popsG = gain(0.35 * (E.bright || 0.8));
            const popLfo = osc("square", 80), popDepth = gain(0.5);
            chain(popLfo, popDepth, popsAM.gain);
            chain(pops, popsF, popsAM, popsG, out);
            v.popLfo = popLfo;
            v.popsF = popsF;
            // Low rumble (half the firing note).
            const sub = osc("sine", 40), subG = gain(0.35);
            chain(sub, subG, out);
            v.sub = sub;
            // Propeller: blade-pass whop on a wash of air.
            const wash = noise(), washF = filt("bandpass", 500, 0.8), washAM = gain(0.5), washG = gain(0.18);
            const whop = osc("sine", 20), whopD = gain(0.45);
            chain(whop, whopD, washAM.gain);
            chain(wash, washF, washAM, washG, out);
            v.whop = whop;
            v.washF = washF;
            v.washG = washG;
            // Supercharger / turbo whine.
            if (E.blower) {
                const b = osc("sine", 1500), bG = gain(0);
                chain(b, bG, out);
                v.blower = {o: b, g: bG};
            }
            if (p.whistle || E.whistle) {
                const w = osc("sine", p.whistle || E.whistle), wG = gain(0);
                chain(w, wG, out);
                v.whistle = wG;
            }
        } else {
            // ---- jets
            const roar = noise(), roarF = filt("lowpass", 800, 0.6), roarG = gain(0.5);
            chain(roar, roarF, roarG, out);
            const core = noise(), coreF = filt("bandpass", 600, 1.2), coreG = gain(0.2);
            chain(core, coreF, coreG, out);
            v.roarF = roarF;
            v.roarG = roarG;
            v.coreF = coreF;
            const engines = E.engines || 1;
            v.whines = [];
            for (let k = 0; k < engines; k++) {
                const w1 = osc("sine", 3000), w2 = osc("sine", 6000), wg = gain(0), w2g = gain(0.3);
                chain(w1, wg, out);
                chain(w2, w2g, wg);
                v.whines.push({w1, w2, wg, detune: 1 + k * 0.007});
            }
            if (E.type === "turbofan" || E.type === "tf34") {
                const fan = osc("sawtooth", 150), fanF = filt("bandpass", 1200, 1.5), fanG = gain(0);
                chain(fan, fanF, fanG, out);
                v.fan = {o: fan, f: fanF, g: fanG};
            }
            if (E.type === "turbojet" || E.crackle) {
                const cr = noise(), crF = filt("bandpass", 1600, 1.8), crG = gain(0);
                chain(cr, shaper(9), crF, crG, out);
                v.crackle = crG;
                const howl = noise(), hF = filt("bandpass", 900, 9), hG = gain(0);
                chain(howl, hF, hG, out);
                v.howl = {f: hF, g: hG};
            }
            const ab = noise(), abF = filt("lowpass", 220, 0.9), abG = gain(0);
            chain(ab, abF, abG, out);
            const rumble = osc("sine", 38), rumbleG = gain(0);
            chain(rumble, rumbleG, out);
            const abCr = noise(), abCrF = filt("bandpass", 260, 3), abCrG = gain(0);
            chain(abCr, shaper(7), abCrF, abCrG, out);
            v.ab = {g: abG, f: abF, rumble: rumbleG, crackle: abCrG};
        }
        nodes.forEach(n => n.start());

        let sputter = 0;
        // t: throttle 0..1, opts: {boost, speed (0..1.5 of top speed), pitch (Doppler), level}
        v.set = function (t, opts = {}) {
            const now = ctx.currentTime, k = 0.08, pitch = opts.pitch || 1, boost = opts.boost ? 1 : 0;
            const level = opts.level === undefined ? 1 : opts.level;
            if (!jet) {
                // Engine speed: up with the throttle, a bit more on emergency
                // power, and the propeller windmills faster in a dive.
                const [idle, max] = E.rpm;
                const rpm = (idle + (max - idle) * Math.pow(t, 0.85)) * (1 + 0.06 * boost + 0.05 * Math.max(0, (opts.speed || 0) - 0.9));
                const crankF = rpm / 60, fireF = crankF * E.cyl / 2 * pitch;
                for (const c of v.fire) {
                    c.f.frequency.setTargetAtTime(fireF * c.detune, now, 0.1);
                    c.wobG.gain.setTargetAtTime(fireF * 0.012 * (E.rough || 0.15), now, k);
                    c.body.frequency.setTargetAtTime(Math.min(700, fireF * 2.2), now, k);
                    c.exh.frequency.setTargetAtTime((E.exhaust || 1100) * (0.75 + 0.45 * t) * pitch, now, k);
                    c.lope.frequency.setTargetAtTime(crankF * pitch * c.detune, now, 0.1);
                    c.lopeG.gain.setTargetAtTime(E.lump || 0.2, now, k);
                }
                v.popLfo.frequency.setTargetAtTime(fireF, now, 0.1);
                v.popsF.frequency.setTargetAtTime((E.exhaust || 1100) * (0.8 + 0.4 * t) * pitch, now, k);
                v.sub.frequency.setTargetAtTime(fireF / 2, now, 0.1);
                v.whop.frequency.setTargetAtTime(crankF * (E.gear || 1) * (E.blades || 2) * pitch, now, 0.1);
                v.washF.frequency.setTargetAtTime((350 + 500 * t) * pitch, now, k);
                v.washG.gain.setTargetAtTime(0.1 + 0.18 * t, now, k);
                if (v.blower) {
                    v.blower.o.frequency.setTargetAtTime(rpm * (E.blower > 1 ? 1.6 : 0.6) * pitch, now, 0.15);
                    v.blower.g.gain.setTargetAtTime(0.012 * Math.min(2, E.blower) * t * t, now, k);
                }
                if (v.whistle) v.whistle.gain.setTargetAtTime(0.03 * t * Math.min(1, opts.speed || t), now, k);
                // WWI rotaries: the pilot blips the ignition now and then.
                let vol = (0.32 + 0.4 * t) * level;
                if (E.sputter) {
                    sputter -= 1;
                    if (sputter <= 0 && Math.random() < E.sputter * 0.25) sputter = 2 + Math.random() * 4;
                    if (sputter > 0) vol *= 0.3;
                }
                out.gain.setTargetAtTime(vol, now, 0.03);
            } else {
                const spool = 0.45 + 0.55 * Math.pow(t, 0.8) + 0.06 * boost;
                const [wLo, wHi] = E.whine || [2000, 5000];
                for (const w of v.whines) {
                    const f = (wLo + (wHi - wLo) * spool) * pitch * w.detune;
                    w.w1.frequency.setTargetAtTime(f, now, 0.25);
                    w.w2.frequency.setTargetAtTime(f * 2.02, now, 0.25);
                    w.wg.gain.setTargetAtTime((E.whineVol || 0.05) * (0.5 + 0.6 * spool) / v.whines.length, now, k);
                }
                const [rLo, rHi] = E.roar || [400, 2400];
                v.roarF.frequency.setTargetAtTime((rLo + (rHi - rLo) * t) * pitch, now, k);
                v.roarG.gain.setTargetAtTime(0.5 + 0.4 * t, now, k);
                v.coreF.frequency.setTargetAtTime((300 + 600 * t) * pitch, now, k);
                if (v.fan) {
                    // The fan's buzzsaw comes in at high thrust.
                    const [fLo, fHi] = E.fan || [110, 240];
                    v.fan.o.frequency.setTargetAtTime((fLo + (fHi - fLo) * spool) * pitch, now, 0.2);
                    v.fan.f.frequency.setTargetAtTime((900 + 1400 * t) * pitch, now, k);
                    v.fan.g.gain.setTargetAtTime((E.buzz || 0.05) * Math.max(0, t - 0.45) * 1.8 + (E.type === "tf34" ? 0.02 : 0), now, k);
                }
                if (v.crackle) {
                    v.crackle.gain.setTargetAtTime((E.crackle || 0.4) * 0.25 * t * (0.6 + Math.random() * 0.4), now, 0.03);
                    v.howl.f.frequency.setTargetAtTime((700 + 500 * t) * pitch, now, k);
                    v.howl.g.gain.setTargetAtTime(0.08 * t, now, k);
                }
                const burner = boost * (E.burner || 0);
                v.ab.g.gain.setTargetAtTime(burner * 1.2, now, 0.12);
                v.ab.f.frequency.setTargetAtTime(160 + 120 * burner, now, k);
                v.ab.rumble.gain.setTargetAtTime(burner * 0.5, now, 0.12);
                v.ab.crackle.gain.setTargetAtTime(burner * 0.45 * (0.5 + Math.random() * 0.5), now, 0.04);
                const quiet = E.idleSilent && t < 0.02 ? 0 : 1;
                out.gain.setTargetAtTime((0.5 + 0.3 * t + 0.25 * burner) * (E.volume || 1) * level * quiet, now, k);
            }
        };

        v.stop = function () {
            out.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
            setTimeout(() => {
                nodes.forEach(n => {
                    try {
                        n.stop();
                    } catch (e) {}
                });
                out.disconnect();
            }, 250);
        };
        return v;
    }

    return {create};
})();
