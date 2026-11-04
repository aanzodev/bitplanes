(function () {
    const D = window.BitFlightMode = window.BitFlightMode || {};


    function makeNoise(seed) {
        function hash(x, z) {
            let h = Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(seed, 2147483647);
            h = Math.imul(h ^ (h >>> 13), 1274126177);
            return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
        }
        const smooth = t => t * t * (3 - 2 * t);
        function noise(x, z) {
            const xi = Math.floor(x), zi = Math.floor(z), u = smooth(x - xi), v = smooth(z - zi);
            const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
            return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
        }
        function fbm(x, z, octaves = 5) {
            let s = 0, amp = 1, f = 1, norm = 0;
            for (let i = 0; i < octaves; i++) {
                s += amp * noise(x * f + i * 17.3, z * f - i * 9.1);
                norm += amp;
                amp *= 0.5;
                f *= 2.03;
            }
            return s / norm;
        }
        const ridge = (x, z, o = 5) => 1 - Math.abs(fbm(x, z, o) * 2 - 1);
        return {fbm, ridge, hash, noise};
    }

    const smoothstep = (a, b, x) => {
        const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    };
    const mix = (a, b, t) => a + (b - a) * t;

    function rgb(hex) {
        return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
    }

    const SIZE = 24000;

    function rim(x, z, start = 0.8, height = 1600) {
        const d = Math.hypot(x, z) / (SIZE / 2);
        return d > start ? Math.pow((d - start) / (1 - start), 1.6) * height : 0;
    }


    const MAPS = [
        {
            id: "alpine", name: "Alpine Valley", icon: "🏔", desc: "Snowy peaks, deep valleys and blue lakes.",
            sky: "day", water: 0, cloudHeight: 2600, trees: {kind: "pine", count: 9000, min: 30, max: 1400},
            height(n, x, z) {
                const rolling = n.fbm(x / 2600, z / 2600);
                const r = n.ridge(x / 4600 + 40, z / 4600 + 40, 5);
                let h = (rolling - 0.42) * 800 + Math.pow(r, 2.8) * 1900;
                h -= smoothstep(0.55, 0.85, n.fbm(x / 7000 + 9, z / 7000 - 3, 3)) * 500;
                return h + rim(x, z, 0.8, 1900);
            },
            color(h, slope, n, x, z) {
                const snowLine = 1550 + n.fbm(x / 800, z / 800, 2) * 350;
                if (h < 8) return 0xb8ad8a;
                if (slope > 0.9 && h > 120) return h > snowLine ? 0xc9cfd4 : 0x6f6a61;
                if (h > snowLine) return 0xeef1f3;
                if (h > snowLine - 250) return 0x847e73;
                if (h < 500) return n.fbm(x / 600, z / 600, 2) > 0.5 ? 0x56703a : 0x63793f;
                return 0x3c5a2e;
            },
        },
        {
            id: "canyon", name: "Red Canyon", icon: "🏜", desc: "Desert mesas and a winding canyon to fly through.",
            sky: "sunset", water: -9999, cloudHeight: 3400, cloudAmount: 0.35, trees: {kind: "cactus", count: 2600, min: 0, max: 900},
            height(n, x, z) {
                let h = 120 + n.fbm(x / 2500, z / 2500) * 160;
                const m = n.fbm(x / 3400 + 11, z / 3400 + 7, 4);
                h += smoothstep(0.52, 0.56, m) * 380 + smoothstep(0.64, 0.67, m) * 260;
                const c = n.ridge(x / 9000 + 3, z / 9000 + 3, 3);
                h -= Math.pow(c, 10) * 520;
                return h + rim(x, z, 0.8, 1300);
            },
            color(h, slope, n, x, z) {
                if (slope > 0.75) {
                    const band = Math.floor(h / 45) % 3;
                    return [0xa24a2a, 0xb9603a, 0x8e3d22][band];
                }
                if (h < 40) return 0xc2a578;
                if (h > 560) return 0xc87a4a;
                return n.fbm(x / 500, z / 500, 2) > 0.55 ? 0xd9a96e : 0xe0b77f;
            },
        },
        {
            id: "islands", name: "Pacific Islands", icon: "🏝", desc: "Tropical islands and a volcano in an endless ocean.", shallow: 0x2fd0c0,
            sky: "day", water: 0, cloudHeight: 2200, cloudAmount: 1.2, trees: {kind: "palm", count: 5000, min: 6, max: 500},
            carrier: {x: 4200, z: 5200, rot: 0.6},
            height(n, x, z) {
                const i = n.fbm(x / 2300 + 5, z / 2300 - 5, 5);
                let h = (i - 0.56) * 2600;
                const d = Math.hypot(x + 1500, z - 900);
                h = Math.max(h, 1700 * Math.exp(-d * d / (2 * 2100 * 2100)) - (d < 380 ? (380 - d) * 1.2 : 0) - 200);
                const e = Math.hypot(x, z) / (SIZE / 2);
                if (e > 0.75) h -= (e - 0.75) * 2400;
                return h;
            },
            color(h, slope, n, x, z) {
                if (h < 0) return 0x6f8f82;
                if (h < 18) return 0xe6d6a6;
                if (slope > 0.8) return 0x5a4e44;
                if (h > 1000) return 0x4e4540;
                if (h > 650) return 0x5f7a3c;
                return n.fbm(x / 400, z / 400, 2) > 0.5 ? 0x3d7a34 : 0x4a8a3c;
            },
        },
        {
            id: "fjords", name: "Arctic Fjords", icon: "🧊", desc: "Icy cliffs, narrow fjords and icebergs.", shallow: 0x3f7f86,
            sky: "overcast", water: 0, cloudHeight: 1900, cloudAmount: 1.4, trees: {kind: "snowpine", count: 3000, min: 30, max: 500},
            icebergs: 70,
            height(n, x, z) {
                const r = n.ridge(x / 3800 - 20, z / 3800 + 13, 5);
                let h = Math.pow(r, 1.8) * 2300 + n.fbm(x / 1500, z / 1500) * 500 - 250;
                const v = Math.abs(n.fbm(x / 6500 + 30, z / 6500 - 30, 3) - 0.5);
                h = mix(-160, h, smoothstep(0.02, 0.1, v));
                return h + rim(x, z, 0.82, 1500);
            },
            color(h, slope, n, x, z) {
                if (h < 6) return 0x8e9aa3;
                if (slope > 0.85) return 0x4f5961;
                if (h < 260 && slope < 0.5) return 0x6f7d5f;
                return n.fbm(x / 600, z / 600, 2) > 0.45 ? 0xf4f8fb : 0xdde6ee;
            },
        },
        {
            id: "harbor", name: "Harbor City", icon: "🏙", desc: "Fly between skyscrapers over a busy harbor.", shallow: 0x3f8f8a, erosion: 0.6,
            sky: "dusk", water: 0, cloudHeight: 2500, trees: {kind: "broad", count: 3500, min: 10, max: 800},
            city: {x0: -3400, x1: 3400, cell: 150}, carrier: {x: -2600, z: 5600, rot: -0.3},
            coast(n, x) {
                return 1200 + (n.fbm(x / 4000, 3.3, 3) - 0.5) * 2600;
            },
            height(n, x, z) {
                const coast = this.coast(n, x);
                if (z > coast) return -40 - (z - coast) * 0.08;
                const back = coast - z;
                let h = 6 + smoothstep(0, 60, back) * 6;
                h += smoothstep(5000, 9000, back) * (n.fbm(x / 2400, z / 2400) * 1600 + 200);
                h += smoothstep(2500, 5500, back) * n.fbm(x / 1800 + 4, z / 1800, 3) * 250;
                return h + rim(x, z, 0.82, 1500);
            },
            color(h, slope, n, x, z) {
                if (h < 3) return 0x9c9580;
                if (h < 14) return 0x6f7176;
                if (slope > 0.8) return 0x6d665c;
                if (h > 900) return 0x8a8578;
                return n.fbm(x / 500, z / 500, 2) > 0.5 ? 0x4c6e38 : 0x587a40;
            },
        },
        {
            id: "farmlands", name: "Farmlands", icon: "🌾", desc: "Rolling fields, red barns and a river (cows too).", shallow: 0x4f8f6a, erosion: 0.6,
            sky: "dawn", water: 0, cloudHeight: 2100, trees: {kind: "broad", count: 7000, min: 5, max: 900},
            barns: 140,
            height(n, x, z) {
                let h = 60 + (n.fbm(x / 3200, z / 3200) - 0.35) * 520;
                const river = Math.abs(n.fbm(x / 8000 + 21, z / 8000 - 4, 3) - 0.5);
                h = mix(-30, h, smoothstep(0.008, 0.03, river));
                return h + rim(x, z, 0.8, 1400);
            },
            color(h, slope, n, x, z) {
                if (h < 2) return 0x8f8460;
                if (slope > 0.7 || h > 700) return 0x6c7a4a;
                const cx = Math.floor(x / 340), cz = Math.floor(z / 260);
                const fx = x / 340 - cx, fz = z / 260 - cz;
                if (fx < 0.03 || fz < 0.04) return 0x9b8a62;
                const k = n.hash(cx, cz);
                return [0xc4ae62, 0x6e8f42, 0x7a5f42, 0x58803a, 0xb59f60, 0x7f9a4c][Math.floor(k * 6)];
            },
        },
        {
            id: "savanna", name: "Savanna Plains", icon: "🦒", desc: "Golden grassland, rocky outcrops and a winding river.", shallow: 0x6f8f5a, erosion: 0.5,
            sky: "sunset", water: 0, cloudHeight: 2800, cloudAmount: 0.5, trees: {kind: "broad", count: 2600, min: 4, max: 700}, rock: 0x7a6a58,
            height(n, x, z) {
                let h = 50 + (n.fbm(x / 4200, z / 4200) - 0.4) * 260;
                const k = n.fbm(x / 1500 + 13, z / 1500 - 8, 4);
                h += smoothstep(0.6, 0.7, k) * (220 + n.fbm(x / 300, z / 300, 2) * 160);
                const river = Math.abs(n.fbm(x / 9000 - 7, z / 9000 + 15, 3) - 0.5);
                h = mix(-25, h, smoothstep(0.01, 0.035, river));
                return h + rim(x, z, 0.82, 1200);
            },
            color(h, slope, n, x, z) {
                if (h < 2) return 0x8f7a50;
                if (slope > 0.6) return 0x7a6a58;
                const g = n.fbm(x / 700, z / 700, 2);
                return g > 0.6 ? 0x9a8a44 : g > 0.42 ? 0xc9a94e : 0xd6b85e;
            },
        },
        {
            id: "glacier", name: "Glacier Pass", icon: "❄", desc: "Towering ice walls and a frozen pass between them.",
            sky: "day", water: -9999, cloudHeight: 3200, cloudAmount: 0.9, trees: {kind: "snowpine", count: 1600, min: 60, max: 700}, snowLevel: 500, rock: 0x5b636b,
            height(n, x, z) {
                const r = n.ridge(x / 4200 + 8, z / 4200 - 21, 5);
                let h = Math.pow(r, 2.2) * 2900 + n.fbm(x / 1700, z / 1700) * 400 + 200;
                const pass = Math.abs(n.fbm(x / 10000 + 2, z / 7000 - 9, 3) - 0.5);
                h = mix(120 + n.fbm(x / 900, z / 900, 2) * 40, h, smoothstep(0.03, 0.13, pass));
                return h + rim(x, z, 0.8, 2000);
            },
            color(h, slope, n, x, z) {
                if (slope < 0.3 && h < 260) return n.fbm(x / 500, z / 500, 2) > 0.5 ? 0xcfe6f2 : 0xbcdbeb;
                if (slope > 0.85) return 0x5b636b;
                return n.fbm(x / 600, z / 600, 2) > 0.4 ? 0xf3f7fa : 0xe2ebf2;
            },
        },
        {
            id: "atolls", name: "Coral Atolls", icon: "🐚", desc: "Ring-shaped reefs around turquoise lagoons.", shallow: 0x3fe0d0, erosion: 0.3,
            sky: "day", water: 0, cloudHeight: 2000, cloudAmount: 1.1, trees: {kind: "palm", count: 3200, min: 2, max: 140},
            carrier: {x: -5200, z: -3800, rot: 1.1},
            rings: [[-2600, 1800, 1700], [3600, -1400, 2100], [600, -5600, 1300], [-5800, -2000, 1100], [5200, 4600, 1500], [-1200, 6200, 1200]],
            height(n, x, z) {
                let h = -260 + n.fbm(x / 3000, z / 3000) * 120;
                for (const [cx, cz, r] of this.rings) {
                    const d = Math.hypot(x - cx, z - cz), wob = (n.fbm(x / 600, z / 600, 3) - 0.5) * 320;
                    const ring = Math.exp(-Math.pow(d - r - wob, 2) / (2 * 140 * 140));
                    const lagoon = d < r ? -24 + 10 * n.fbm(x / 400, z / 400, 2) : -260;
                    h = Math.max(h, mix(lagoon, 28 + n.fbm(x / 250, z / 250, 2) * 26, ring));
                }
                return h;
            },
            color(h, slope, n, x, z) {
                if (h < 0) return 0xd9cfa4;
                if (h < 12) return 0xeadcae;
                return n.fbm(x / 300, z / 300, 2) > 0.5 ? 0x4f9a46 : 0x5aa84e;
            },
        },
        {
            id: "highlands", name: "Highland Lochs", icon: "🏞", desc: "Misty green hills cut by long, dark lochs.", shallow: 0x3d5a5a,
            sky: "overcast", water: 0, cloudHeight: 1700, cloudAmount: 1.4, trees: {kind: "pine", count: 4200, min: 10, max: 600}, rock: 0x6a6a62,
            height(n, x, z) {
                let h = (n.fbm(x / 2800, z / 2800) - 0.3) * 1100 + Math.pow(n.ridge(x / 5200 - 4, z / 5200 + 6, 4), 2) * 600;
                const loch = Math.abs(n.fbm(x / 11000 + 40, z / 3200 - 12, 3) - 0.5);
                h = mix(-90, h, smoothstep(0.015, 0.07, loch));
                return h + rim(x, z, 0.8, 1500);
            },
            color(h, slope, n, x, z) {
                if (h < 4) return 0x6f6a55;
                if (slope > 0.8) return 0x6a6a62;
                const p = n.fbm(x / 650, z / 650, 2);
                if (h > 450 && p > 0.62) return 0x6f6268;
                return p > 0.45 ? 0x5d7a3a : 0x4e6c33;
            },
        },
        {
            id: "ashlands", name: "Ash Wastes", icon: "🌋", desc: "Black lava plains around a smoking caldera.",
            sky: "dusk", water: -9999, cloudHeight: 3000, cloudAmount: 0.7, trees: {kind: "pine", count: 400, min: 0, max: 400}, rock: 0x2e2a28,
            height(n, x, z) {
                let h = 80 + (n.fbm(x / 3000, z / 3000) - 0.4) * 400;
                h += Math.pow(n.ridge(x / 2200 + 3, z / 2200 + 3, 4), 4) * 300;
                const d = Math.hypot(x - 800, z + 1200);
                const cone = 2100 * Math.exp(-d * d / (2 * 2600 * 2600));
                const caldera = d < 700 ? (700 - d) * 1.6 : 0;
                return Math.max(h, cone - caldera) + rim(x, z, 0.82, 1600);
            },
            color(h, slope, n, x, z) {
                const d = Math.hypot(x - 800, z + 1200);
                if (d < 900 && h > 1200) return 0x6b3a26;
                if (slope > 0.7) return 0x2e2a28;
                const a = n.fbm(x / 500, z / 500, 2);
                return a > 0.6 ? 0x5a5652 : a > 0.4 ? 0x3a3634 : 0x45403c;
            },
        },
    ];

    const SKIES = {
        day: {name: "Day", top: 0x3b7fd6, horizon: 0xbfdcf5, fog: 0xb4d3ee, sun: [0.35, 0.62, 0.3], sunColor: 0xfff2d6, sunI: 1.05, hemiSky: 0xcfe6ff, hemiGround: 0x5a6248, hemiI: 0.7, water: 0x1f6fa8},
        dawn: {name: "Dawn", top: 0x4b6fb0, horizon: 0xf7c59a, fog: 0xe8c8ad, sun: [-0.8, 0.16, 0.25], sunColor: 0xffc79a, sunI: 0.95, hemiSky: 0xf2d8c4, hemiGround: 0x4f4a42, hemiI: 0.65, water: 0x3f6f96},
        sunset: {name: "Sunset", top: 0x3a4f8f, horizon: 0xff9a52, fog: 0xe8a77a, sun: [0.85, 0.12, -0.2], sunColor: 0xffa65c, sunI: 1.0, hemiSky: 0xffcfa6, hemiGround: 0x5a4434, hemiI: 0.62, water: 0x3d5f8a},
        overcast: {name: "Overcast", top: 0x8796a6, horizon: 0xc3ccd4, fog: 0xbcc6cf, sun: [0.2, 0.7, 0.3], sunColor: 0xe9eef3, sunI: 0.55, hemiSky: 0xe0e7ee, hemiGround: 0x59615a, hemiI: 0.95, water: 0x46667c},
        dusk: {name: "Dusk", top: 0x1d2a55, horizon: 0xc77a6a, fog: 0x8e6f78, sun: [-0.6, 0.05, -0.75], sunColor: 0xff9a7a, sunI: 0.55, hemiSky: 0x9a8aa8, hemiGround: 0x2e2a35, hemiI: 0.6, water: 0x2a3d5e, lights: 0.8},
        night: {name: "Night", top: 0x050a1a, horizon: 0x1c2a4a, fog: 0x141d33, sun: [0.3, 0.55, -0.6], sunColor: 0x9fb4e8, sunI: 0.35, hemiSky: 0x3a4a78, hemiGround: 0x101420, hemiI: 0.55, water: 0x0f1e36, lights: 1, stars: true, moon: true},
    };

    D.MAPS = MAPS;
    D.SKIES = SKIES;
    D.MAP_SIZE = SIZE;
    D.makeNoise = makeNoise;
    D.mapUtil = {smoothstep, mix, rgb};
})();
