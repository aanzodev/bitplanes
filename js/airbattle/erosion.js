// Air Battle (3D): wears the terrain down like rain does over thousands of
// years (hydraulic erosion), so mountains get real gullies, ridges and
// valley floors. The work is done by native/erosion.c compiled to
// WebAssembly (erosion.wasm, about 2.5 KB). If WebAssembly can't load (an old
// browser, or opening index.html straight from disk), the same steps run in
// plain JavaScript with fewer raindrops.
(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};
    let wasm = null, loading = null;

    D.loadErosion = function () {
        if (wasm || loading) return loading || Promise.resolve(wasm);
        loading = (async () => {
            try {
                if (typeof WebAssembly === "undefined") return null;
                const res = await fetch((window.BitBase || "") + "js/airbattle/erosion.wasm");
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

    // grid: Float32Array of w * w heights in meters, spacing 'step' meters.
    // Changes the grid in place. Returns "wasm" or "js".
    D.erode = function (grid, w, step, opts = {}) {
        const drops = Math.round((opts.drops || 0.9) * w * w);
        const sea = opts.sea === undefined ? -1e9 : opts.sea / step;
        const strength = opts.strength || 1;
        if (wasm) {
            wasm.reset();
            const p = wasm.alloc(w * w * 4), t = wasm.alloc(w * w * 4);
            if (p && t) {
                const h = new Float32Array(wasm.memory.buffer, p, w * w);
                for (let i = 0; i < w * w; i++) h[i] = grid[i] / step;
                wasm.erode(p, w, drops, (opts.seed || 1) >>> 0, strength, sea);
                wasm.smooth(p, t, w);
                const out = new Float32Array(wasm.memory.buffer, p, w * w);
                for (let i = 0; i < w * w; i++) grid[i] = out[i] * step;
                return "wasm";
            }
        }
        const h = new Float32Array(w * w);
        for (let i = 0; i < w * w; i++) h[i] = grid[i] / step;
        erodeJs(h, w, Math.round(drops * 0.4), opts.seed || 1, strength, sea);
        for (let i = 0; i < w * w; i++) grid[i] = h[i] * step;
        return "js";
    };

    // The same raindrops as erosion.c (see the comments there).
    function erodeJs(h, w, drops, seed, strength, sea) {
        let rng = seed >>> 0 || 1;
        const rnd = () => {
            rng ^= rng << 13;
            rng >>>= 0;
            rng ^= rng >>> 17;
            rng ^= rng << 5;
            rng >>>= 0;
            return (rng >>> 8) / 16777216;
        };
        const K = [0.05, 0.1, 0.05, 0.1, 0.4, 0.1, 0.05, 0.1, 0.05];
        const sample = (x, y) => {
            const ix = x | 0, iy = y | 0, u = x - ix, v = y - iy, i = iy * w + ix;
            const a = h[i], b = h[i + 1], c = h[i + w], d = h[i + w + 1];
            return [a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v, (b - a) * (1 - v) + (d - c) * v, (c - a) * (1 - u) + (d - b) * u];
        };
        for (let n = 0; n < drops; n++) {
            let x = 1 + rnd() * (w - 3), y = 1 + rnd() * (w - 3), dx = 0, dy = 0, speed = 1, water = 1, sed = 0;
            for (let s = 0; s < 48; s++) {
                const ix = x | 0, iy = y | 0, u = x - ix, v = y - iy;
                const [height, gx, gy] = sample(x, y);
                if (height < sea) break;
                dx = dx * 0.05 - gx * 0.95;
                dy = dy * 0.05 - gy * 0.95;
                const len = Math.hypot(dx, dy) || 1;
                dx /= len;
                dy /= len;
                const nx = x + dx, ny = y + dy;
                if (nx < 1 || ny < 1 || nx >= w - 2 || ny >= w - 2) break;
                const drop = sample(nx, ny)[0] - height;
                const cap = Math.max(-drop * speed * water * 4, 0.01);
                const i = iy * w + ix;
                if (sed > cap || drop > 0) {
                    const a = drop > 0 ? Math.min(drop, sed) : (sed - cap) * 0.3;
                    sed -= a;
                    h[i] += a * (1 - u) * (1 - v);
                    h[i + 1] += a * u * (1 - v);
                    h[i + w] += a * (1 - u) * v;
                    h[i + w + 1] += a * u * v;
                } else {
                    const a = Math.min((cap - sed) * 0.3 * strength, -drop);
                    let k = 0;
                    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++, k++) {
                        const px = ix + ox, py = iy + oy;
                        if (px >= 0 && py >= 0 && px < w && py < w) h[py * w + px] -= a * K[k];
                    }
                    sed += a;
                }
                speed = Math.sqrt(Math.max(0, speed * speed + drop * 4));
                water *= 0.985;
                x = nx;
                y = ny;
            }
        }
    }
})();
