// Dogfights (3D): builds a map. Terrain from the map's height function
// (colored by height and steepness), a sky dome and water drawn by small GLSL
// shaders, forests, clouds, and each map's extras: a city of skyscrapers whose
// windows light up at dusk, an aircraft carrier, icebergs, farms.
// ground(x, z) gives the height of whatever is there (terrain, building roof,
// carrier deck) so planes crash into it and computer pilots avoid it.
(function () {
    const D = window.BitDogfight = window.BitDogfight || {};

    // ------------------------------------------------------------ shaders

    const SKY_VERT = `
        varying vec3 vDir;
        void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww; // always at the far plane
        }`;
    const SKY_FRAG = `
        uniform vec3 top, horizon, sunColor, sunDir, ground;
        uniform float moon, sunBoost, groundMix;
        varying vec3 vDir;
        void main() {
            vec3 d = normalize(vDir);
            float h = max(d.y, 0.0);
            vec3 col = mix(horizon, top, pow(h, 0.55));
            // below the horizon: a little darker haze
            col = mix(col, horizon * 0.82, smoothstep(0.0, -0.25, d.y));
            col = mix(col, ground, smoothstep(0.0, -0.2, d.y) * groundMix);
            float s = max(dot(d, normalize(sunDir)), 0.0);
            col += sunColor * (pow(s, 8.0) * 0.18 + pow(s, 64.0) * 0.35) * (1.0 - moon * 0.7);
            float disc = smoothstep(0.9993, 0.9996, s);
            col = mix(col, (moon > 0.5 ? vec3(0.92, 0.94, 1.0) : vec3(1.0, 0.97, 0.88)) * (moon > 0.5 ? 1.0 : sunBoost), disc);
            col += sunColor * pow(s, 400.0) * (sunBoost - 1.0) * (1.0 - moon);
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
        }`;

    const WATER_VERT = `
        varying vec3 vWorld;
        #include <fog_pars_vertex>
        void main() {
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            vec4 mvPosition = viewMatrix * w;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
        }`;
    const WATER_FRAG = `
        uniform vec3 deep, skyColor, sunColor, sunDir;
        uniform float time, sunBoost;
        varying vec3 vWorld;
        #include <fog_pars_fragment>
        void main() {
            vec2 p = vWorld.xz;
            // A few moving waves, summed as slopes for the normal.
            vec2 g = vec2(0.0);
            g += 0.06 * cos(dot(p, vec2(0.021, 0.013)) + time * 0.9) * vec2(0.021, 0.013) / 0.025;
            g += 0.05 * cos(dot(p, vec2(-0.017, 0.029)) + time * 1.3) * vec2(-0.017, 0.029) / 0.034;
            g += 0.03 * cos(dot(p, vec2(0.071, -0.043)) + time * 2.1) * vec2(0.071, -0.043) / 0.083;
            g += 0.02 * cos(dot(p, vec2(0.13, 0.11)) + time * 2.9) * vec2(0.13, 0.11) / 0.17;
            vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
            vec3 v = normalize(cameraPosition - vWorld);
            float fres = pow(1.0 - max(dot(n, v), 0.0), 4.0);
            vec3 col = mix(deep, skyColor, 0.15 + 0.75 * fres);
            vec3 r = reflect(-v, n);
            float spec = pow(max(dot(r, normalize(sunDir)), 0.0), 180.0);
            col += sunColor * spec * 1.4 * sunBoost;
            gl_FragColor = vec4(col, 0.94);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
            #include <fog_fragment>
        }`;

    const BUILDING_VERT = `
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying vec3 vColor;
        #include <fog_pars_vertex>
        void main() {
            vec4 local = instanceMatrix * vec4(position, 1.0);
            vec4 w = modelMatrix * local;
            vWorld = w.xyz;
            vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
            #ifdef USE_INSTANCING_COLOR
                vColor = instanceColor;
            #else
                vColor = vec3(0.6);
            #endif
            vec4 mvPosition = viewMatrix * w;
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
        }`;
    const BUILDING_FRAG = `
        uniform vec3 sunDir, sunColor, ambient;
        uniform float lights, glow;
        varying vec3 vWorld;
        varying vec3 vNormal;
        varying vec3 vColor;
        #include <fog_pars_fragment>
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main() {
            vec3 n = normalize(vNormal);
            float diff = max(dot(n, normalize(sunDir)), 0.0);
            vec3 col = vColor * (ambient + sunColor * diff * 0.9);
            if (abs(n.y) < 0.5) {
                // Windows on the walls: a grid in floors (3.6 m) and bays (3 m).
                float u = abs(n.z) > 0.5 ? vWorld.x : vWorld.z;
                vec2 cell = vec2(floor(u / 3.0), floor(vWorld.y / 3.6));
                vec2 f = vec2(fract(u / 3.0), fract(vWorld.y / 3.6));
                float win = step(0.18, f.x) * step(f.x, 0.82) * step(0.25, f.y) * step(f.y, 0.85);
                if (vWorld.y < 4.0) win = 0.0;
                vec3 glass = vec3(0.16, 0.22, 0.3) + sunColor * diff * 0.25;
                col = mix(col, glass, win * 0.85);
                float on = step(0.55, hash(cell + floor(vWorld.xz / 40.0)));
                col += win * on * lights * vec3(1.0, 0.82, 0.45) * 0.95 * glow;
            }
            gl_FragColor = vec4(col, 1.0);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
            #include <fog_fragment>
        }`;

    // ------------------------------------------------------- geometry help

    // Merge simple parts into one geometry with a color per part (for trees,
    // barns, the carrier). parts: [{geo, color}]
    function merge(THREE, parts) {
        let count = 0;
        const geos = parts.map(p => {
            const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
            g.computeVertexNormals();
            count += g.attributes.position.count;
            return {g, c: new THREE.Color(p.color)};
        });
        const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), col = new Float32Array(count * 3);
        let o = 0;
        for (const {g, c} of geos) {
            const n = g.attributes.position.count;
            pos.set(g.attributes.position.array, o * 3);
            nor.set(g.attributes.normal.array, o * 3);
            for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], (o + i) * 3);
            o += n;
        }
        const out = new THREE.BufferGeometry();
        out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
        out.setAttribute("color", new THREE.BufferAttribute(col, 3));
        return out;
    }

    function treeGeometry(THREE, kind) {
        const T = THREE, at = (g, x, y, z) => (g.translate(x, y, z), g);
        if (kind === "palm") {
            const trunk = at(new T.CylinderGeometry(0.9, 1.4, 22, 5), 0, 11, 0);
            trunk.rotateZ(0.12);
            const crown = at(new T.ConeGeometry(9, 4, 7), 1.3, 22, 0);
            return merge(T, [{geo: trunk, color: 0x8a6a42}, {geo: crown, color: 0x3e8a2c}]);
        }
        if (kind === "cactus") {
            const body = at(new T.CylinderGeometry(1.4, 1.6, 14, 6), 0, 7, 0);
            const arm1 = at(new T.CylinderGeometry(0.9, 0.9, 6, 5), 3, 9, 0);
            const arm2 = at(new T.CylinderGeometry(0.9, 0.9, 5, 5), -3, 7, 0);
            const j1 = at(new T.BoxGeometry(3, 1.6, 1.6), 1.6, 7, 0);
            const j2 = at(new T.BoxGeometry(3, 1.6, 1.6), -1.6, 5, 0);
            return merge(T, [{geo: body, color: 0x4f7f3a}, {geo: arm1, color: 0x4f7f3a}, {geo: arm2, color: 0x4f7f3a}, {geo: j1, color: 0x4f7f3a}, {geo: j2, color: 0x4f7f3a}]);
        }
        if (kind === "broad") {
            const trunk = at(new T.CylinderGeometry(1, 1.4, 10, 5), 0, 5, 0);
            const crown = at(new T.IcosahedronGeometry(8, 0), 0, 15, 0);
            return merge(T, [{geo: trunk, color: 0x6b4a2e}, {geo: crown, color: 0x467f2e}]);
        }
        const snow = kind === "snowpine";
        const trunk = at(new T.CylinderGeometry(0.8, 1.1, 6, 5), 0, 3, 0);
        const low = at(new T.ConeGeometry(9, 18, 6), 0, 13, 0);
        const high = at(new T.ConeGeometry(6, 14, 6), 0, 23, 0);
        return merge(T, [{geo: trunk, color: 0x5a3e28}, {geo: low, color: snow ? 0x35553a : 0x2c5a2a}, {geo: high, color: snow ? 0xeef3f7 : 0x356a30}]);
    }

    function carrierGeometry(THREE) {
        const T = THREE, at = (g, x, y, z) => (g.translate(x, y, z), g);
        return merge(T, [
            {geo: at(new T.BoxGeometry(76, 22, 330), 0, 0, 0), color: 0x5b636b},
            {geo: at(new T.BoxGeometry(80, 2, 336), 0, 12, 0), color: 0x3b4046},
            {geo: at(new T.BoxGeometry(2, 0.3, 300), -8, 13.2, -10), color: 0xd9d9d9},
            {geo: at(new T.BoxGeometry(14, 24, 40), 30, 25, 40), color: 0x6b737b},
            {geo: at(new T.BoxGeometry(6, 14, 6), 30, 44, 34), color: 0x4a5056},
        ]);
    }

    function barnGeometry(THREE) {
        const T = THREE, at = (g, x, y, z) => (g.translate(x, y, z), g);
        const roof = new T.CylinderGeometry(13, 13, 30, 3, 1);
        roof.rotateX(Math.PI / 2);
        roof.rotateZ(Math.PI / 2);
        roof.scale(1, 0.55, 1);
        return merge(T, [
            {geo: at(new T.BoxGeometry(22, 14, 30), 0, 7, 0), color: 0xb2271e},
            {geo: at(roof, 0, 18, 0), color: 0x5a3a2a},
            {geo: at(new T.BoxGeometry(6, 9, 0.6), 0, 4.5, 15.1), color: 0xf2f2f2},
            {geo: at(new T.CylinderGeometry(4, 4, 26, 8), 18, 13, -6), color: 0xc9ccd0},
            {geo: at(new T.SphereGeometry(4, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 18, 26, -6), color: 0x9aa0a6},
        ]);
    }

    // Low/Medium clouds: clusters of round puffs, one mesh for all of them.
    function puffyClouds(THREE, map, sky, Q) {
        const SIZE = D.MAP_SIZE;
        const cloudCount = Math.round(110 * (map.cloudAmount || 1) * (0.5 + 0.5 * Q));
        const puffs = cloudCount * 9;
        const cloudMat = new THREE.MeshLambertMaterial({color: 0xffffff, emissive: new THREE.Color(sky.horizon).multiplyScalar(0.55), transparent: true, opacity: 0.88, depthWrite: false});
        const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), cloudMat, puffs);
        {
            const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
            let k = 0;
            for (let i = 0; i < cloudCount; i++) {
                const cx = (Math.random() - 0.5) * SIZE * 1.1, cz = (Math.random() - 0.5) * SIZE * 1.1;
                const cy = map.cloudHeight + (Math.random() - 0.3) * 900, big = 1 + Math.random() * 1.8;
                const parts = 5 + (Math.random() * 5 | 0);
                for (let j = 0; j < parts && k < puffs; j++) {
                    const r = (90 + Math.random() * 130) * big;
                    m.compose(p.set(cx + (Math.random() - 0.5) * 420 * big, cy + (Math.random() - 0.5) * 70 * big, cz + (Math.random() - 0.5) * 260 * big), q,
                        s.set(r * 1.5, r * 0.75, r));
                    clouds.setMatrixAt(k++, m);
                }
            }
            clouds.count = k;
        }
        return clouds;
    }

    // High/Ultra clouds: hundreds of soft billboards (always facing you), lit
    // from the sun: bright tops, grey bellies, glowing edges against the sun.
    const CLOUD_VERT = `
        varying vec2 vUv;
        varying float vShade;
        varying float vSun;
        varying float vFade;
        uniform vec3 sunDir;
        #include <fog_pars_vertex>
        void main() {
            vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float sx = length(instanceMatrix[0].xyz), sy = length(instanceMatrix[1].xyz);
            float a = fract(sin(dot(center.xz, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831;
            vec2 p = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
            vec4 mvPosition = viewMatrix * vec4(center, 1.0);
            mvPosition.xy += vec2(p.x * sx, p.y * sy);
            vUv = uv;
            vShade = p.y + 0.5;
            vec3 toCloud = normalize(center - cameraPosition);
            vSun = pow(max(dot(toCloud, normalize(sunDir)), 0.0), 6.0);
            vFade = smoothstep(40.0, 420.0, -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
        }`;
    const CLOUD_FRAG = `
        uniform sampler2D map;
        uniform vec3 lit, shadow, sunColor;
        uniform float opacity, sunGlow;
        varying vec2 vUv;
        varying float vShade;
        varying float vSun;
        varying float vFade;
        #include <fog_pars_fragment>
        void main() {
            float a = texture2D(map, vUv).a * opacity * vFade;
            if (a < 0.01) discard;
            vec3 col = mix(shadow, lit, smoothstep(0.1, 0.9, vShade));
            col += sunColor * vSun * sunGlow * (1.0 - a);
            gl_FragColor = vec4(col, a);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
            #include <fog_fragment>
        }`;

    function cloudTexture(THREE) {
        const c = document.createElement("canvas");
        c.width = c.height = 128;
        const x = c.getContext("2d");
        // A fluffy blob: many soft circles, densest in the middle.
        for (let i = 0; i < 40; i++) {
            const r = 14 + Math.random() * 26, ang = Math.random() * 6.28, d = Math.random() * 30;
            const cx = 64 + Math.cos(ang) * d, cy = 64 + Math.sin(ang) * d * 0.7;
            const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
            g.addColorStop(0, "rgba(255,255,255,0.22)");
            g.addColorStop(1, "rgba(255,255,255,0)");
            x.fillStyle = g;
            x.fillRect(0, 0, 128, 128);
        }
        const t = new THREE.CanvasTexture(c);
        t.minFilter = THREE.LinearMipmapLinearFilter;
        return t;
    }

    function softClouds(THREE, map, sky, Q, sunDir, hdr) {
        const SIZE = D.MAP_SIZE;
        const count = Math.round(95 * (map.cloudAmount || 1) * Math.min(1.3, Q));
        const per = 14, total = count * per;
        const geo = new THREE.PlaneGeometry(1, 1);
        const night = sky.stars ? 0.25 : 1;
        const mat = new THREE.ShaderMaterial({
            vertexShader: CLOUD_VERT, fragmentShader: CLOUD_FRAG, transparent: true, depthWrite: false, fog: true,
            uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
                map: {value: cloudTexture(THREE)}, sunDir: {value: sunDir.clone()},
                lit: {value: new THREE.Color(0xffffff).lerp(new THREE.Color(sky.sunColor), 0.35).multiplyScalar(night)},
                shadow: {value: new THREE.Color(sky.horizon).lerp(new THREE.Color(0x6a7280), 0.55).multiplyScalar(0.85 * night)},
                sunColor: {value: new THREE.Color(sky.sunColor)}, sunGlow: {value: hdr ? 2.2 : 0.6}, opacity: {value: 0.72},
            }]),
        });
        const clouds = new THREE.InstancedMesh(geo, mat, total);
        const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
        let k = 0;
        for (let i = 0; i < count; i++) {
            const cx = (Math.random() - 0.5) * SIZE * 1.15, cz = (Math.random() - 0.5) * SIZE * 1.15;
            const cy = map.cloudHeight + (Math.random() - 0.3) * 900, big = 1 + Math.random() * 1.6;
            for (let j = 0; j < per && k < total; j++) {
                const r = (260 + Math.random() * 300) * big;
                // Flat bottoms, piled up in the middle.
                const up = Math.random() * Math.random() * 160 * big;
                m.compose(p.set(cx + (Math.random() - 0.5) * 700 * big, cy + up, cz + (Math.random() - 0.5) * 500 * big), q, s.set(r, r * 0.7, 1));
                clouds.setMatrixAt(k++, m);
            }
        }
        clouds.count = k;
        clouds.frustumCulled = false;
        clouds.renderOrder = 1;
        return clouds;
    }

    // High/Ultra ground: physically based, with fine color detail that
    // changes across the ground (worked out per pixel from the position).
    function detailMaterial(THREE) {
        const mat = new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.93, metalness: 0});
        mat.onBeforeCompile = sh => {
            sh.vertexShader = sh.vertexShader
                .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;")
                .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
            sh.fragmentShader = sh.fragmentShader
                .replace("#include <common>", `#include <common>
                    varying vec3 vWPos;
                    float dHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                    float dNoise(vec2 p) {
                        vec2 i = floor(p), f = fract(p);
                        vec2 u = f * f * (3.0 - 2.0 * f);
                        return mix(mix(dHash(i), dHash(i + vec2(1.0, 0.0)), u.x), mix(dHash(i + vec2(0.0, 1.0)), dHash(i + vec2(1.0, 1.0)), u.x), u.y);
                    }`)
                .replace("#include <color_fragment>", `#include <color_fragment>
                    float camD = length(vWPos - cameraPosition);
                    float dt = (dNoise(vWPos.xz * 0.0035) - 0.5) * 0.28
                             + (dNoise(vWPos.xz * 0.028) - 0.5) * 0.2
                             + (dNoise(vWPos.xz * 0.21) - 0.5) * 0.16 * smoothstep(1800.0, 250.0, camD)
                             + (dNoise(vWPos.xz * 1.3) - 0.5) * 0.12 * smoothstep(300.0, 40.0, camD);
                    diffuseColor.rgb *= 1.0 + dt;`);
        };
        return mat;
    }

    // ------------------------------------------------------------- world

    // opts: {quality: "low" | "medium" | "high" | "ultra", sky: "day" | ..., seed,
    //        renderer (for sky reflections), hdr (the cinematic High/Ultra look)}
    D.makeWorld = function (THREE, scene, map, opts = {}) {
        const seed = opts.seed || ((Math.random() * 1e6) | 0);
        const n = D.makeNoise(seed % 1000 + 1);
        const SIZE = D.MAP_SIZE;
        const quality = opts.quality || "high";
        const fancy = quality === "high" || quality === "ultra";
        const Q = {low: 0.4, medium: 0.7, high: 1, ultra: 1.6}[quality] || 1;
        const sky = D.SKIES[opts.sky || map.sky] || D.SKIES.day;
        const SEG = {low: 200, medium: 270, high: 360, ultra: 520}[quality] || 360;
        const hdr = !!opts.hdr;
        const sunBoost = hdr ? 14 : 1;
        const step = SIZE / SEG;
        const height = (x, z) => map.height(n, x, z);

        // ---- heights on a grid (the terrain mesh, and ground() reads it back)
        const W = SEG + 1, grid = new Float32Array(W * W);
        for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) grid[j * W + i] = height(-SIZE / 2 + i * step, -SIZE / 2 + j * step);
        function gridAt(x, z) {
            const fx = (x + SIZE / 2) / step, fz = (z + SIZE / 2) / step;
            if (fx < 0 || fz < 0 || fx >= SEG || fz >= SEG) return height(x, z);
            const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
            const a = grid[j * W + i], b = grid[j * W + i + 1], c = grid[(j + 1) * W + i], d = grid[(j + 1) * W + i + 1];
            // The same two triangles per square as the mesh.
            return u + v < 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
        }

        const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new THREE.Color();
        for (let k = 0; k < pos.count; k++) {
            const x = pos.getX(k), z = pos.getZ(k);
            const i = Math.round((x + SIZE / 2) / step), j = Math.round((z + SIZE / 2) / step);
            const h = grid[j * W + i];
            pos.setY(k, h);
            const hx = grid[j * W + Math.min(SEG, i + 1)] - grid[j * W + Math.max(0, i - 1)];
            const hz = grid[Math.min(SEG, j + 1) * W + i] - grid[Math.max(0, j - 1) * W + i];
            const slope = Math.hypot(hx, hz) / (2 * step);
            c.setHex(map.color(h, slope, n, x, z));
            c.offsetHSL(0, 0, (n.fbm(x / 120, z / 120, 2) - 0.5) * 0.09);
            colors.set([c.r, c.g, c.b], k * 3);
        }
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const terrain = new THREE.Mesh(geo, fancy ? detailMaterial(THREE) : new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}));
        terrain.receiveShadow = fancy;
        scene.add(terrain);

        // ---- sky, fog and light
        const sunDir = new THREE.Vector3(...sky.sun).normalize();
        const skyMat = new THREE.ShaderMaterial({
            vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
            uniforms: {top: {value: new THREE.Color(sky.top)}, horizon: {value: new THREE.Color(sky.horizon)},
                sunColor: {value: new THREE.Color(sky.sunColor)}, sunDir: {value: sunDir}, moon: {value: sky.moon ? 1 : 0},
                sunBoost: {value: sunBoost}, ground: {value: new THREE.Color(sky.hemiGround)}, groundMix: {value: 0}},
        });
        const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1000, 32, 16), skyMat);
        skyDome.renderOrder = -1;
        skyDome.frustumCulled = false;
        scene.add(skyDome);
        scene.background = new THREE.Color(sky.horizon);
        const fogFar = {low: 15000, medium: 19000, high: 24000, ultra: 30000}[quality] || 24000;
        scene.fog = new THREE.Fog(new THREE.Color(sky.fog).multiplyScalar(fancy ? 0.85 : 1), fogFar * (fancy ? 0.32 : 0.22), fogFar);
        // With sky reflections on (High/Ultra), the sky itself lights things too.
        scene.add(new THREE.HemisphereLight(sky.hemiSky, sky.hemiGround, sky.hemiI * (fancy ? 0.55 : 1)));
        const sun = new THREE.DirectionalLight(sky.sunColor, sky.sunI * (fancy ? 1.25 : 1));
        sun.position.copy(sunDir).multiplyScalar(5000);
        scene.add(sun);
        scene.add(sun.target);
        // Real-time shadows in a box around you (High: 2048, Ultra: 4096 pixels).
        const shadowSize = quality === "ultra" ? 1700 : 1200;
        if (fancy) {
            sun.castShadow = true;
            const res = quality === "ultra" ? 4096 : 2048;
            sun.shadow.mapSize.set(res, res);
            Object.assign(sun.shadow.camera, {left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 50, far: 9000});
            sun.shadow.camera.updateProjectionMatrix();
            sun.shadow.bias = -0.0004;
            sun.shadow.normalBias = 1.2;
        }
        // Sky reflections (and soft light) for metal, glass and paint.
        if (fancy && opts.renderer) {
            const envScene = new THREE.Scene(), envMat = skyMat.clone();
            envMat.uniforms.groundMix.value = 1;
            envMat.uniforms.sunBoost.value = hdr ? 6 : 1;
            envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), envMat));
            const pm = new THREE.PMREMGenerator(opts.renderer);
            scene.environment = pm.fromScene(envScene, 0.015).texture;
            pm.dispose();
            envMat.dispose();
        }

        if (sky.stars) {
            const sp = new Float32Array(1500 * 3);
            for (let i = 0; i < 1500; i++) {
                const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.08, Math.random() - 0.5).normalize().multiplyScalar(900);
                sp.set([v.x, v.y, v.z], i * 3);
            }
            const sg = new THREE.BufferGeometry();
            sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
            const stars = new THREE.Points(sg, new THREE.PointsMaterial({color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, depthWrite: false}));
            stars.renderOrder = -1;
            stars.frustumCulled = false;
            skyDome.add(stars);
        }

        // ---- water
        let water = null;
        if (map.water > -1000) {
            const wm = new THREE.ShaderMaterial({
                vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, fog: true,
                uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
                    deep: {value: new THREE.Color(sky.water)}, skyColor: {value: new THREE.Color(sky.horizon)},
                    sunColor: {value: new THREE.Color(sky.sunColor)}, sunDir: {value: sunDir.clone()}, time: {value: 0}, sunBoost: {value: hdr ? 6 : 1},
                }]),
            });
            water = new THREE.Mesh(new THREE.PlaneGeometry(SIZE * 3, SIZE * 3, 1, 1), wm);
            water.rotation.x = -Math.PI / 2;
            water.position.y = map.water;
            scene.add(water);
        }

        // ---- solid things on the ground: buildings, carriers (for ground())
        const solids = []; // {x0, x1, z0, z1, top} in world space, axis aligned in their own frame
        const cityCells = new Map();
        let cityCell = 0, cityX0 = 0, cityZ0 = 0;

        if (map.city) {
            const C = map.city, cell = C.cell;
            cityCell = cell;
            const list = [];
            for (let x = C.x0; x < C.x1; x += cell) {
                const coast = map.coast(n, x + cell / 2);
                for (let z = coast - 4200; z < coast - 250; z += cell) {
                    const cx = x + cell / 2, cz = z + cell / 2;
                    const center = Math.exp(-((cx * cx) / (2 * 1500 * 1500)) - ((cz - coast + 2000) ** 2) / (2 * 1300 * 1300));
                    if (n.hash(Math.floor(cx), Math.floor(cz)) < 0.12) continue; // a park
                    const ground = gridAt(cx, cz);
                    if (ground < 2 || ground > 40) continue;
                    const tall = 30 + center * 380 * (0.4 + 0.6 * n.hash(Math.floor(cz), Math.floor(cx)));
                    const w = cell * (0.5 + 0.25 * n.hash(Math.floor(cx) + 3, 7)), d = cell * (0.5 + 0.25 * n.hash(9, Math.floor(cz) + 5));
                    list.push({x: cx, z: cz, w, d, h: tall, g: ground});
                }
            }
            cityX0 = C.x0;
            cityZ0 = -SIZE / 2;
            const bm = new THREE.ShaderMaterial({
                vertexShader: BUILDING_VERT, fragmentShader: BUILDING_FRAG, fog: true,
                uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
                    sunDir: {value: sunDir.clone()}, sunColor: {value: new THREE.Color(sky.sunColor).multiplyScalar(sky.sunI)},
                    ambient: {value: new THREE.Color(sky.hemiSky).multiplyScalar(sky.hemiI * 0.75)}, lights: {value: sky.lights || 0},
                    glow: {value: hdr ? 3.5 : 1},
                }]),
            });
            const box = new THREE.BoxGeometry(1, 1, 1);
            box.translate(0, 0.5, 0);
            const inst = new THREE.InstancedMesh(box, bm, list.length);
            const m = new THREE.Matrix4(), col = new THREE.Color();
            const tones = [0xb8bcc2, 0x9aa3ad, 0xc9c1b4, 0x8b939c, 0xd6d8db, 0x7a8590, 0xa89f94];
            list.forEach((b, i) => {
                m.makeScale(b.w, b.h + b.g, b.d).setPosition(b.x, 0, b.z);
                inst.setMatrixAt(i, m);
                inst.setColorAt(i, col.setHex(tones[i % tones.length]));
                const key = Math.floor((b.x - cityX0) / cell) + "," + Math.floor((b.z - cityZ0) / cell);
                cityCells.set(key, b);
            });
            inst.castShadow = fancy;
            scene.add(inst);
        }

        function addCarrier(spec) {
            const g = new THREE.Mesh(carrierGeometry(THREE), new THREE.MeshLambertMaterial({vertexColors: true}));
            g.position.set(spec.x, 0, spec.z);
            g.rotation.y = spec.rot;
            g.castShadow = g.receiveShadow = fancy;
            scene.add(g);
            solids.push({x: spec.x, z: spec.z, rot: spec.rot, hw: 40, hl: 168, top: 13});
        }
        if (map.carrier) addCarrier(map.carrier);

        if (map.icebergs) {
            const ig = new THREE.IcosahedronGeometry(1, 0);
            const ice = new THREE.InstancedMesh(ig, new THREE.MeshLambertMaterial({color: 0xeaf6ff, flatShading: true}), map.icebergs);
            const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
            let k = 0;
            for (let t = 0; t < 4000 && k < map.icebergs; t++) {
                const x = (Math.random() - 0.5) * SIZE * 0.8, z = (Math.random() - 0.5) * SIZE * 0.8;
                if (gridAt(x, z) > -40) continue;
                const r = 30 + Math.random() * 80;
                q.setFromEuler(new THREE.Euler(Math.random(), Math.random() * 6, Math.random() * 0.4));
                m.compose(p.set(x, -r * 0.2, z), q, s.set(r, r * (0.5 + Math.random() * 0.5), r * (0.7 + Math.random() * 0.6)));
                ice.setMatrixAt(k++, m);
            }
            ice.count = k;
            scene.add(ice);
        }

        if (map.barns) {
            const bg = barnGeometry(THREE);
            const barns = new THREE.InstancedMesh(bg, new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}), map.barns);
            const m = new THREE.Matrix4();
            let k = 0;
            for (let t = 0; t < 6000 && k < map.barns; t++) {
                const x = (Math.random() - 0.5) * SIZE * 0.75, z = (Math.random() - 0.5) * SIZE * 0.75, h = gridAt(x, z);
                if (h < 5 || h > 500) continue;
                m.makeRotationY(Math.random() * Math.PI).setPosition(x, h - 1, z);
                barns.setMatrixAt(k++, m);
            }
            barns.count = k;
            barns.castShadow = barns.receiveShadow = fancy;
            scene.add(barns);
        }

        // ---- trees
        if (map.trees) {
            const T = map.trees, count = Math.round(T.count * Q);
            const trees = new THREE.InstancedMesh(treeGeometry(THREE, T.kind), new THREE.MeshLambertMaterial({vertexColors: true, flatShading: true}), count);
            const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
            let k = 0;
            for (let t = 0; t < count * 8 && k < count; t++) {
                const x = (Math.random() - 0.5) * SIZE * 0.92, z = (Math.random() - 0.5) * SIZE * 0.92, h = gridAt(x, z);
                if (h < T.min || h > T.max || n.fbm(x / 900 + 9, z / 900 + 9, 3) < 0.48) continue;
                if (Math.abs(gridAt(x + 20, z) - h) > 14) continue; // not on cliffs
                if (cityCells.size && cityCells.has(Math.floor((x - cityX0) / cityCell) + "," + Math.floor((z - cityZ0) / cityCell))) continue;
                const sc = 0.8 + Math.random() * 0.9;
                q.setFromAxisAngle(up, Math.random() * 6.3);
                m.compose(p.set(x, h - 1, z), q, s.set(sc, sc * (0.85 + Math.random() * 0.4), sc));
                trees.setMatrixAt(k++, m);
            }
            trees.count = k;
            trees.castShadow = trees.receiveShadow = fancy;
            scene.add(trees);
        }

        // ---- clouds: soft lit billboards (High/Ultra), or puffy clusters
        const clouds = fancy ? softClouds(THREE, map, sky, Q, sunDir, hdr) : puffyClouds(THREE, map, sky, Q);
        scene.add(clouds);

        // ---- ground(): the top of whatever is at x, z
        function ground(x, z) {
            let h = Math.max(map.water > -1000 ? map.water : -1e9, gridAt(x, z));
            if (cityCell) {
                const b = cityCells.get(Math.floor((x - cityX0) / cityCell) + "," + Math.floor((z - cityZ0) / cityCell));
                if (b && Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) h = Math.max(h, b.g + b.h);
            }
            for (const s of solids) {
                const dx = x - s.x, dz = z - s.z, cs = Math.cos(-s.rot), sn = Math.sin(-s.rot);
                const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
                if (Math.abs(lx) < s.hw && Math.abs(lz) < s.hl) h = Math.max(h, s.top);
            }
            return h;
        }

        let time = 0;
        return {
            map, sky, size: SIZE, theme: {name: map.name + " · " + sky.name},
            height: gridAt, ground, water: map.water,
            sunDir,
            // Each frame: the sky follows the camera, the water moves, and the
            // shadow box follows what you're looking at.
            update(dt, camera, focus) {
                if (sun.castShadow && focus) {
                    const texel = (2 * shadowSize) / sun.shadow.mapSize.x;
                    const fx = Math.round(focus.x / texel) * texel, fy = Math.round(focus.y / texel) * texel, fz = Math.round(focus.z / texel) * texel;
                    sun.target.position.set(fx, fy, fz);
                    sun.position.set(fx, fy, fz).addScaledVector(sunDir, 4000);
                }
                time += dt;
                skyDome.position.copy(camera.position);
                skyDome.scale.setScalar(camera.far * 0.9 / 1000);
                if (water) {
                    water.material.uniforms.time.value = time;
                    water.position.x = Math.round(camera.position.x / 1000) * 1000;
                    water.position.z = Math.round(camera.position.z / 1000) * 1000;
                }
            },
        };
    };
})();
