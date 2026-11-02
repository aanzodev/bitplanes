// Dogfights (3D beta): the world. Terrain made from layered noise (rolling
// hills, sharp ridges, snowy peaks, lakes and a coast), water, forests,
// clouds, sun and haze. height(x, z) gives the ground height anywhere, for
// crashes and for the AI to avoid the ground.
(function () {
    const D = window.BitDogfight = window.BitDogfight || {};
    const SIZE = 9000;      // terrain is SIZE x SIZE (1 unit ~ 1 meter)
    const SEG = 180;        // grid resolution
    const THEMES = [
        {name: "Day", sky: 0x8ec9f0, fog: 0xa9d4f2, sun: 0xfff2d0, hemiSky: 0xcfe8ff, hemiGround: 0x4a5a3a, water: 0x2b7bb9},
        {name: "Sunset", sky: 0xf2a65a, fog: 0xf0b98a, sun: 0xffc48a, hemiSky: 0xffd9b0, hemiGround: 0x5a4636, water: 0x3d6f9a},
        {name: "Overcast", sky: 0xaab6c2, fog: 0xb7c2cc, sun: 0xe8eef5, hemiSky: 0xdfe6ee, hemiGround: 0x4f5a4a, water: 0x3f6f8f},
    ];

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
        return function fbm(x, z, octaves = 5) {
            let s = 0, amp = 1, f = 1, norm = 0;
            for (let i = 0; i < octaves; i++) {
                s += amp * noise(x * f, z * f);
                norm += amp;
                amp *= 0.5;
                f *= 2.03;
            }
            return s / norm;
        };
    }

    D.makeWorld = function (THREE, scene, seed = (Math.random() * 1e6) | 0) {
        const fbm = makeNoise(seed);
        const theme = THEMES[seed % THEMES.length];

        // Ground height at (x, z). Water is at height 0.
        function height(x, z) {
            const rolling = fbm(x / 1500, z / 1500);
            const ridge = 1 - Math.abs(fbm(x / 2600 + 50, z / 2600 + 50, 4) * 2 - 1);
            let h = (rolling - 0.42) * 900 + Math.pow(ridge, 3) * 1000;
            // The land drops into the sea near the edges.
            const d = Math.hypot(x, z) / (SIZE / 2);
            if (d > 0.78) h -= (d - 0.78) / 0.22 * 700;
            return h;
        }

        // ---- terrain mesh, colored by height and steepness (low-poly look)
        const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
        const step = SIZE / SEG;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), z = pos.getZ(i), h = height(x, z);
            pos.setY(i, h);
            const slope = Math.abs(height(x + step, z) - h) + Math.abs(height(x, z + step) - h);
            const jitter = (fbm(x / 90, z / 90, 2) - 0.5) * 0.08;
            if (h < 12) c.setHex(0xd9c690);                        // beach
            else if (slope > 150 && h > 120) c.setHex(0x7a7468);   // cliffs
            else if (h < 330) c.setHex(0x5e9a3a);                  // grass
            else if (h < 640) c.setHex(0x3f7a33);                  // forest
            else if (h < 920) c.setHex(0x8a8172);                  // rock
            else c.setHex(0xf2f5f7);                               // snow
            c.offsetHSL(0, 0, jitter);
            colors.set([c.r, c.g, c.b], i * 3);
        }
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}));
        scene.add(terrain);

        // ---- water
        const water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 4, SIZE * 4),
            new THREE.MeshPhongMaterial({color: theme.water, transparent: true, opacity: 0.88, shininess: 80}));
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0;
        scene.add(water);

        // ---- forests: one mesh for every tree
        const treeGeo = new THREE.ConeGeometry(16, 46, 6);
        treeGeo.translate(0, 23, 0);
        const trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({color: 0x2f5e2a, flatShading: true}), 1600);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
        let n = 0;
        for (let tries = 0; tries < 12000 && n < trees.count; tries++) {
            const x = (Math.random() - 0.5) * SIZE * 0.8, z = (Math.random() - 0.5) * SIZE * 0.8, h = height(x, z);
            if (h < 25 || h > 640 || fbm(x / 600 + 9, z / 600 + 9, 3) < 0.5) continue;
            const s = 0.7 + Math.random() * 0.8;
            m.compose(p.set(x, h - 2, z), q, sc.set(s, s * (0.8 + Math.random() * 0.5), s));
            trees.setMatrixAt(n++, m);
        }
        trees.count = n;
        scene.add(trees);

        // ---- clouds: puffy clusters high up
        // Soft and bright: lit from inside a little so the undersides don't go grey.
        const cloudMat = new THREE.MeshLambertMaterial({color: 0xffffff, emissive: 0xb8c4cf, transparent: true, opacity: 0.9, depthWrite: false});
        const puff = new THREE.IcosahedronGeometry(1, 2);
        for (let i = 0; i < 45; i++) {
            const cloud = new THREE.Group();
            for (let k = 0; k < 5 + (Math.random() * 5 | 0); k++) {
                const b = new THREE.Mesh(puff, cloudMat);
                const r = 60 + Math.random() * 90;
                b.scale.set(r * 1.4, r * 0.8, r);
                b.position.set((Math.random() - 0.5) * 260, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 160);
                cloud.add(b);
            }
            cloud.position.set((Math.random() - 0.5) * SIZE, 1500 + Math.random() * 900, (Math.random() - 0.5) * SIZE);
            scene.add(cloud);
        }

        // ---- sky, haze and light
        scene.background = new THREE.Color(theme.sky);
        scene.fog = new THREE.Fog(theme.fog, 1800, 8000);
        scene.add(new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, 0.75));
        const sun = new THREE.DirectionalLight(theme.sun, 0.95);
        sun.position.set(2000, 3000, 1000);
        scene.add(sun);

        return {height, size: SIZE, theme, ground: (x, z) => Math.max(0, height(x, z))};
    };
})();
