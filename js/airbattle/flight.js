(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};

    const SPECS = {
        classic: [800, 30, 11, 82e3, 1], cub: [550, 16.6, 10.7, 48e3, 1], tigermoth: [830, 22.2, 8.9, 97e3, 1],
        duster: [1200, 27.6, 9.8, 164e3, 1], swift: [700, 14, 8, 150e3, 1], gunship: [1300, 37.6, 11.96, 205e3, 1],
        fokker: [586, 18.7, 7.19, 82e3, 1], spad: [845, 21.1, 8.25, 164e3, 1], fortress: [3000, 70, 18, 400e3, 1],
        camel: [659, 21.5, 8.53, 97e3, 1], phantom: [2200, 30, 9.83, 620e3, 1],
        i16: [1900, 14.5, 9, 820e3, 1], zero: [2400, 22.4, 12, 710e3, 1], hurricane: [3300, 23.9, 12.2, 870e3, 1],
        spitfire: [3000, 22.5, 11.2, 1100e3, 1], yak3: [2700, 14.85, 9.2, 970e3, 1], bf109: [3100, 16.05, 9.9, 1100e3, 1],
        mustang: [4200, 21.8, 11.3, 1250e3, 1], fw190: [4300, 18.3, 10.5, 1270e3, 1], corsair: [5300, 29.2, 12.5, 1500e3, 1],
        p47: [6600, 27.9, 12.4, 1700e3, 1], p38: [7000, 30.4, 15.85, 2120e3, 1],
        mig21: [8700, 23, 7.15, 40e3, 0], f16: [12000, 27.87, 9.96, 76e3, 0], mig29: [15000, 38, 11.36, 100e3, 0],
        a10: [14800, 47, 17.53, 80e3, 0], f15: [20000, 56.5, 13.05, 130e3, 0], su27: [23000, 62, 14.7, 150e3, 0],
        f35: [22000, 42.7, 10.7, 125e3, 0], f22: [29000, 78, 13.56, 232e3, 0], b2: [152000, 478, 52.4, 308e3, 0],
    };
    const BY_SHAPE = {"": SPECS.classic, prop: SPECS.spitfire, jet: SPECS.f16, bomber: SPECS.b2};

    const RHO0 = 1.225, G = 9.81, H = 9000, OSWALD = 0.8, ETA = 0.8, PACE = 2.2, FLOATS = 16;
    const [MASS, AREA, SPAN, ENGINE, PROP, TOP, MIN, BOOST, K, CD0, CLMAX, BOOST_ENGINE, PROP_REF] = [...Array(13).keys()];

    function jsModel(f) {
        const density = alt => RHO0 * Math.exp(-Math.max(alt, 0) / H);
        const thrustAt = (v, engine, lapse) => f[PROP] > 0.5 ? ETA * engine * lapse / Math.max(v, f[PROP_REF]) : engine * lapse;
        const drag = (v, rho, load) => {
            const qs = Math.max(0.5 * rho * v * v * f[AREA], 1), lift = load * f[MASS] * G;
            return qs * f[CD0] + f[K] * lift * lift / qs;
        };
        const weight = f[MASS] * G;
        f[K] = 1 / (Math.PI * OSWALD * f[SPAN] * f[SPAN] / f[AREA]);
        f[CLMAX] = 2 * weight / (RHO0 * f[AREA] * f[MIN] * f[MIN]);
        f[PROP_REF] = 0.35 * f[TOP];
        const qs = 0.5 * RHO0 * f[TOP] * f[TOP] * f[AREA];
        f[CD0] = Math.max((thrustAt(f[TOP], f[ENGINE], 1) - f[K] * weight * weight / qs) / qs, 0.004);
        const vb = f[TOP] * f[BOOST], db = drag(vb, RHO0, 1);
        f[BOOST_ENGINE] = f[PROP] > 0.5 ? db * vb / ETA : db;
        return {
            step(v, throttle, boosting, burning, alt, sinClimb, load, dt) {
                const rho = density(alt);
                let engine = boosting ? f[BOOST_ENGINE] : f[ENGINE] * Math.max(0.05, throttle);
                if (burning) engine *= 0.65;
                const lapse = Math.exp((f[PROP] > 0.5 ? -0.6 : -0.75) * Math.max(alt, 0) / H);
                const accel = (thrustAt(v, engine, lapse) - drag(v, rho, Math.max(load, 0))) / f[MASS] - G * sinClimb;
                return v + accel * dt * PACE;
            },
            stall(alt, load) {
                const lift = Math.sqrt(Math.max(load, 0.6)) * f[MASS] * G;
                return Math.sqrt(2 * lift / (density(alt) * f[AREA] * f[CLMAX]));
            },
        };
    }

    let wasm = null, loading = null, next = 0;

    D.loadFlight = function () {
        if (wasm || loading) return loading || Promise.resolve(wasm);
        loading = (async () => {
            try {
                if (typeof WebAssembly === "undefined") return null;
                const res = await fetch((window.BitBase || "") + "js/airbattle/flight.wasm");
                if (!res.ok) return null;
                const {instance} = await WebAssembly.instantiate(await res.arrayBuffer(), {});
                wasm = instance.exports;
                return wasm;
            } catch (e) {
                return null;
            }
        })();
        return loading;
    };

    D.makeFlight = function (planeId, shape, top, min, boostMul, opts = {}) {
        const spec = SPECS[planeId] || BY_SHAPE[shape] || SPECS.classic;
        const values = [...spec, top, min, boostMul];
        if (wasm && !opts.js) {
            const i = next++ % wasm.fm_slots();
            new Float32Array(wasm.memory.buffer, wasm.fm_params(i), FLOATS).fill(0).set(values);
            wasm.fm_calibrate(i);
            return {
                engine: "wasm",
                step: (v, throttle, boosting, burning, alt, sinClimb, load, dt) => wasm.fm_step(i, v, throttle, boosting ? 1 : 0, burning ? 1 : 0, alt, sinClimb, load, dt),
                stall: (alt, load) => wasm.fm_stall_speed(i, alt, load),
            };
        }
        const f = new Float32Array(FLOATS);
        f.set(values);
        return Object.assign(jsModel(f), {engine: "js"});
    };

    D.FLIGHT_SPECS = SPECS;
})();
