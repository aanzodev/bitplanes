(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};
    let T;


    const PAINT_GLSL = `
        varying vec3 vObj;
        uniform float pattern;
        uniform vec3 color2, color3;
        float pHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float pNoise(vec3 p) {
            vec3 i = floor(p), f = fract(p);
            vec3 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(mix(pHash(i), pHash(i + vec3(1, 0, 0)), u.x), mix(pHash(i + vec3(0, 1, 0)), pHash(i + vec3(1, 1, 0)), u.x), u.y),
                       mix(mix(pHash(i + vec3(0, 0, 1)), pHash(i + vec3(1, 0, 1)), u.x), mix(pHash(i + vec3(0, 1, 1)), pHash(i + vec3(1, 1, 1)), u.x), u.y), u.z);
        }
        float pLine(float v, float period) {
            float d = abs(fract(v / period + 0.5) - 0.5) * period;
            float w = max(0.018, fwidth(v) * 1.2);
            return (1.0 - smoothstep(0.0, w, d)) * clamp(0.06 / fwidth(v), 0.0, 1.0);
        }`;

    const matCache = new Map();

    function paint(color, opts = {}) {
        const key = [color, opts.pattern || "", opts.rough || 0, opts.metal || 0, D.pbr ? 1 : 0].join("|");
        if (matCache.has(key)) return matCache.get(key);
        let m;
        if (!D.pbr) {
            m = new T.MeshLambertMaterial({color, flatShading: false});
        } else {
            m = new T.MeshStandardMaterial({color, roughness: opts.rough || 0.55, metalness: opts.metal || 0.25});
            const base = new T.Color(color);
            const pid = {camo: 1, tiger: 2, checkers: 3}[opts.pattern] || 0;
            const c2 = pid === 2 ? new T.Color(0x151515) : pid === 3 ? new T.Color(0xf2f2f2) : base.clone().multiplyScalar(0.62).lerp(new T.Color(0x3d4a2a), 0.35);
            const c3 = base.clone().multiplyScalar(0.82).lerp(new T.Color(0x6b5a3a), 0.25);
            m.onBeforeCompile = sh => {
                sh.uniforms.pattern = {value: pid};
                sh.uniforms.color2 = {value: c2};
                sh.uniforms.color3 = {value: c3};
                sh.vertexShader = sh.vertexShader
                    .replace("#include <common>", "#include <common>\nvarying vec3 vObj;")
                    .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObj = position;");
                sh.fragmentShader = sh.fragmentShader
                    .replace("#include <common>", "#include <common>\n" + PAINT_GLSL)
                    .replace("#include <color_fragment>", `#include <color_fragment>
                        if (pattern > 0.5 && pattern < 1.5) {
                            float n = pNoise(vObj * 0.35) * 0.65 + pNoise(vObj * 0.9) * 0.35;
                            if (n > 0.58) diffuseColor.rgb = color2; else if (n < 0.4) diffuseColor.rgb = color3;
                        } else if (pattern > 1.5 && pattern < 2.5) {
                            float s = sin(vObj.z * 2.2 + pNoise(vObj * 0.8) * 3.0 + vObj.x * 0.6);
                            if (s > 0.72) diffuseColor.rgb = color2;
                        } else if (pattern > 2.5) {
                            if (mod(floor(vObj.x * 0.8) + floor(vObj.z * 0.8) + floor(vObj.y * 0.8), 2.0) > 0.5) diffuseColor.rgb = color2;
                        }
                        float pl = max(pLine(vObj.z, 1.45), pLine(vObj.x + vObj.y * 0.4, 1.9) * 0.8);
                        diffuseColor.rgb *= 1.0 - pl * 0.32;
                        diffuseColor.rgb *= 0.93 + 0.12 * pNoise(vObj * 2.3);`)
                    .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
                        roughnessFactor = clamp(roughnessFactor + (pNoise(vObj * 3.1) - 0.5) * 0.22, 0.05, 1.0);`);
            };
            m.customProgramCacheKey = () => "paint";
        }
        matCache.set(key, m);
        return m;
    }

    function plain(color, rough = 0.5, metal = 0.3) {
        const key = "plain|" + color + "|" + rough + "|" + metal + "|" + (D.pbr ? 1 : 0);
        if (matCache.has(key)) return matCache.get(key);
        const m = D.pbr ? new T.MeshStandardMaterial({color, roughness: rough, metalness: metal}) : new T.MeshLambertMaterial({color});
        matCache.set(key, m);
        return m;
    }

    function glassMat() {
        return D.pbr
            ? new T.MeshStandardMaterial({color: 0x2a3a48, roughness: 0.04, metalness: 0.95, transparent: true, opacity: 0.82, envMapIntensity: 2})
            : new T.MeshPhongMaterial({color: 0x6fa8c8, shininess: 90, transparent: true, opacity: 0.75});
    }

    function glowMat(hex, k = 1) {
        return new T.MeshBasicMaterial({color: new T.Color(hex).multiplyScalar(1 + ((D.glow || 1) - 1) * k), transparent: true, depthWrite: false});
    }


    function loft(stations, radial = 24, capEnd = true) {
        const pos = [], idx = [];
        for (const s of stations) {
            const n = s.n || 2, e = 2 / n;
            for (let i = 0; i < radial; i++) {
                const a = (i / radial) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
                const x = s.w * Math.sign(c) * Math.pow(Math.abs(c), e);
                const y = (sn >= 0 ? s.h * (s.top === undefined ? 1 : s.top) : s.h * (s.bot === undefined ? 1 : s.bot)) * Math.sign(sn) * Math.pow(Math.abs(sn), e) + (s.y || 0);
                pos.push(x, y, s.z);
            }
        }
        for (let k = 0; k < stations.length - 1; k++) for (let i = 0; i < radial; i++) {
            const a = k * radial + i, b = k * radial + (i + 1) % radial, c = (k + 1) * radial + i, d = (k + 1) * radial + (i + 1) % radial;
            idx.push(a, c, b, b, c, d);
        }
        const cap = (k, flip) => {
            const s = stations[k], center = pos.length / 3;
            pos.push(0, s.y || 0, s.z);
            for (let i = 0; i < radial; i++) {
                const a = k * radial + i, b = k * radial + (i + 1) % radial;
                if (flip) idx.push(center, b, a);
                else idx.push(center, a, b);
            }
        };
        if (stations[0].w > 0.01) cap(0, true);
        if (capEnd && stations[stations.length - 1].w > 0.01) cap(stations.length - 1, false);
        const g = new T.BufferGeometry();
        g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
    }

    function wing(pts, thick, opts = {}) {
        const s = new T.Shape();
        pts.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
        const bev = thick * 0.42;
        const g = new T.ExtrudeGeometry(s, {depth: thick * 0.16, bevelEnabled: true, bevelThickness: bev, bevelSize: Math.min(bev, opts.edge || bev), bevelSegments: 2, curveSegments: 4});
        g.rotateX(Math.PI / 2);
        g.translate(0, thick * 0.08, 0);
        const p = g.attributes.position, span = opts.span || Math.max(...pts.map(q => Math.abs(q[0] - (opts.root || 0)))) || 1;
        const root = opts.root || 0, tip = opts.tip === undefined ? 0.35 : opts.tip, dih = opts.dihedral || 0;
        for (let i = 0; i < p.count; i++) {
            const d = Math.min(1, Math.abs(p.getX(i) - root) / span);
            p.setY(i, p.getY(i) * (1 - (1 - tip) * d) + Math.abs(p.getX(i) - root) * dih + (opts.gull ? -Math.sin(Math.min(1, d * 2.2) * Math.PI) * opts.gull : 0));
        }
        g.computeVertexNormals();
        return g;
    }

    function both(right) {
        return right.map(([x, z]) => [-x, z]).reverse().concat(right);
    }

    function fin(pts, thick) {
        const s = new T.Shape();
        pts.forEach(([z, y], i) => (i ? s.lineTo(z, y) : s.moveTo(z, y)));
        const bev = thick * 0.4;
        const g = new T.ExtrudeGeometry(s, {depth: thick * 0.2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 4});
        g.rotateY(-Math.PI / 2);
        g.translate(thick * 0.1, 0, 0);
        return g;
    }

    function mesh(geo, mat, x = 0, y = 0, z = 0) {
        const m = new T.Mesh(geo, mat);
        m.position.set(x, y, z);
        return m;
    }

    function cyl(r1, r2, len, mat, segs = 14) {
        const g = new T.CylinderGeometry(r1, r2, len, segs);
        g.rotateX(Math.PI / 2);
        return new T.Mesh(g, mat);
    }

    function hinge(part, px, py, pz, ox = 0, oy = 0, oz = 0) {
        const p = new T.Group();
        p.position.set(px, py, pz);
        part.position.set(ox - px, oy - py, oz - pz);
        p.add(part);
        return p;
    }


    function numberDecal(text, w, h) {
        const c = document.createElement("canvas");
        c.width = 128;
        c.height = 64;
        const x = c.getContext("2d");
        x.font = "bold 52px Arial, sans-serif";
        x.textAlign = "center";
        x.textBaseline = "middle";
        x.fillStyle = "rgba(240,240,240,0.92)";
        x.fillText(text, 64, 34);
        const t = new T.CanvasTexture(c);
        t.encoding = T.sRGBEncoding;
        return new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: T.DoubleSide}));
    }

    function roundel(r, team, color) {
        const g = new T.Group();
        const ring = team === "red" ? 0xc8102e : team === "blue" ? 0x1f4fd1 : color;
        const outer = new T.Mesh(new T.CircleGeometry(r, 20), new T.MeshBasicMaterial({color: ring, polygonOffset: true, polygonOffsetFactor: -2}));
        const inner = new T.Mesh(new T.CircleGeometry(r * 0.55, 20), new T.MeshBasicMaterial({color: 0xf4f4f4, polygonOffset: true, polygonOffsetFactor: -3}));
        inner.position.z = 0.01;
        const dot = new T.Mesh(new T.CircleGeometry(r * 0.25, 16), new T.MeshBasicMaterial({color: ring, polygonOffset: true, polygonOffsetFactor: -4}));
        dot.position.z = 0.02;
        g.add(outer, inner, dot);
        return g;
    }

    function missile(len = 3.6) {
        const g = new T.Group();
        const white = plain(0xe8e8e8, 0.45, 0.2), dark = plain(0x333333, 0.5, 0.4);
        const body = cyl(0.13, 0.13, len, white, 10);
        g.add(body);
        const nose = new T.Mesh(new T.ConeGeometry(0.13, 0.5, 10), dark);
        nose.rotation.x = -Math.PI / 2;
        nose.position.z = -len / 2 - 0.25;
        g.add(nose);
        for (let i = 0; i < 4; i++) {
            const f = mesh(new T.BoxGeometry(0.02, 0.5, 0.45), white, 0, 0, len / 2 - 0.3);
            f.rotation.z = i * Math.PI / 2 + Math.PI / 4;
            f.geometry = f.geometry.clone().translate(0, 0.22, 0);
            g.add(f);
        }
        return g;
    }

    function nozzle(r, len, out) {
        const g = new T.Group();
        const metal = plain(0x3a3632, 0.35, 0.85), inner = plain(0x141414, 0.8, 0.2);
        const prof = [new T.Vector2(r * 1.05, 0), new T.Vector2(r * 1.0, len * 0.6), new T.Vector2(r * 0.88, len)];
        const lg = new T.LatheGeometry(prof, 16);
        lg.rotateX(Math.PI / 2);
        const shell = new T.Mesh(lg, metal);
        shell.material = shell.material.clone();
        shell.material.side = T.DoubleSide;
        g.add(shell);
        const back = new T.Mesh(new T.CircleGeometry(r * 0.86, 18), inner);
        back.position.z = len * 0.25;
        back.rotation.y = Math.PI;
        g.add(back);
        const hot = new T.Mesh(new T.RingGeometry(r * 0.25, r * 0.8, 20), glowMat(0xff7a2a, 0.6));
        hot.position.z = len * 0.3;
        hot.rotation.y = Math.PI;
        g.add(hot);
        out.glows.push(hot);
        const f = new T.Mesh(new T.ConeGeometry(r * 0.75, 3, 12, 1, true), glowMat(0xffa040));
        f.material.opacity = 0.8;
        f.rotation.x = Math.PI / 2;
        f.position.z = len + 1.5;
        f.userData.z = len;
        g.add(f);
        out.burners.push(f);
        return g;
    }

    function propeller(blades, r, out, z, x = 0, y = 0) {
        const p = new T.Group();
        const bladeMat = plain(0x1c1c1c, 0.6, 0.3), tipMat = plain(0xf2c230, 0.5, 0.2);
        for (let i = 0; i < blades; i++) {
            const b = new T.Group();
            const blade = new T.Mesh(new T.BoxGeometry(0.32, r, 0.06), bladeMat);
            blade.position.y = r / 2;
            blade.rotation.y = 0.35;
            b.add(blade);
            const tip = new T.Mesh(new T.BoxGeometry(0.33, r * 0.08, 0.07), tipMat);
            tip.position.y = r * 0.96;
            tip.rotation.y = 0.35;
            b.add(tip);
            b.rotation.z = (i * Math.PI * 2) / blades;
            p.add(b);
        }
        const disc = new T.Mesh(new T.CircleGeometry(r, 24), new T.MeshBasicMaterial({color: 0x222222, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false}));
        p.add(disc);
        p.position.set(x, y, z);
        out.props.push(p);
        return p;
    }

    function wheel(r, x, y, z) {
        const g = new T.CylinderGeometry(r, r, r * 0.6, 14);
        g.rotateZ(Math.PI / 2);
        return mesh(g, plain(0x1a1a1a, 0.9, 0), x, y, z);
    }


    const JETS = {
        f22: {nose: -10, tail: 8.6, w: 1.5, chine: 3.2, wingR: [[1.2, -3.2], [6.8, 2.6], [6.8, 3.7], [3.6, 3.4], [1.2, 5.2]], tails: 2, cant: 0.45, engines: 2, spread: 0.85, flat: true, intake: "caret", stab: [[1.0, 5.4], [3.6, 7.6], [3.6, 8.4], [1.0, 8.6]], finSide: [[3.6, 0.5], [7.9, 0.5], [8.3, 3.7], [6.4, 3.7]]},
        f35: {nose: -9.2, tail: 7.4, w: 1.65, chine: 3.0, wingR: [[1.3, -2.4], [5.4, 2.2], [5.4, 3.3], [1.3, 4.2]], tails: 2, cant: 0.4, engines: 1, flat: false, intake: "caret", stab: [[1.0, 4.6], [3.4, 6.6], [3.4, 7.4], [1.0, 7.4]], finSide: [[3.2, 0.6], [6.9, 0.6], [7.4, 3.2], [5.7, 3.2]]},
        f15: {nose: -10.4, tail: 8.8, w: 1.45, chine: 2.4, wingR: [[1.6, -2.4], [6.6, 3.0], [6.6, 4.4], [1.6, 4.6]], tails: 2, cant: 0.04, engines: 2, spread: 0.9, intake: "box", stab: [[1.4, 5.6], [4.4, 7.8], [4.4, 8.8], [1.4, 8.8]], finSide: [[4.4, 0.8], [8.3, 0.8], [8.8, 4.3], [7.0, 4.3]]},
        su27: {nose: -11, tail: 9.4, w: 1.3, chine: 2.2, wingR: [[1.2, -5.5], [2.0, -2.2], [7.4, 3.2], [7.4, 4.3], [2.0, 4.6]], tails: 2, cant: 0.06, engines: 2, spread: 1.55, pods: true, intake: "under", stab: [[2.0, 6.6], [4.6, 8.8], [4.6, 9.6], [2.0, 9.6]], finSide: [[4.8, 0.7], [8.4, 0.7], [9.1, 4.4], [7.3, 4.4]], finX: 1.8},
        mig29: {nose: -9.6, tail: 8.2, w: 1.25, chine: 2.2, wingR: [[1.1, -4.6], [1.9, -1.8], [6.0, 2.6], [6.0, 3.6], [1.9, 3.9]], tails: 2, cant: 0.1, engines: 2, spread: 1.4, pods: true, intake: "under", stab: [[1.8, 5.6], [4.0, 7.6], [4.0, 8.3], [1.8, 8.3]], finSide: [[4.0, 0.6], [7.2, 0.6], [7.8, 3.8], [6.2, 3.8]], finX: 1.6},
        f16: {nose: -8.6, tail: 7.0, w: 1.15, chine: 2.3, wingR: [[0.9, -3.6], [1.3, -1.2], [5.0, 2.4], [5.0, 3.2], [1.3, 3.4]], tails: 1, cant: 0, engines: 1, intake: "chin", stab: [[0.9, 4.6], [3.0, 6.3], [3.0, 7.0], [0.9, 7.0]], finSide: [[2.6, 0.8], [6.2, 0.8], [6.9, 4.2], [5.4, 4.2]], bubble: true},
        mig21: {nose: -8.4, tail: 6.8, w: 0.95, chine: 2.0, wingR: [[0.9, -1.0], [4.1, 3.8], [4.1, 4.2], [0.9, 4.3]], tails: 1, cant: 0, engines: 1, intake: "nose", stab: [[0.8, 5.0], [2.4, 6.4], [2.4, 6.8], [0.8, 6.8]], finSide: [[2.4, 0.7], [6.0, 0.7], [6.7, 3.8], [5.5, 3.8]]},
    };

    function buildJet(def, color, opts, out) {
        const g = out.group, body = paint(color, {pattern: opts.pattern, rough: 0.45, metal: 0.35});
        const dark = plain(new T.Color(color).multiplyScalar(0.55).getHex(), 0.5, 0.4), black = plain(0x1b1b1b, 0.6, 0.3);
        const L0 = def.nose, L1 = def.tail, w = def.w, n = def.chine;
        const st = [
            {z: L0, w: 0.02, h: 0.02, y: -0.1, n: 2},
            {z: L0 + 0.6, w: 0.22, h: 0.2, y: -0.08, n: 2.2},
            {z: L0 + 2, w: 0.52, h: 0.45, y: 0, n: n * 0.8, top: 1, bot: 0.85},
            {z: L0 + 4, w: 0.85, h: 0.7, y: 0.1, n, top: 1.15, bot: 0.8},
            {z: -2.5, w: w, h: 0.78, y: 0.1, n, top: 1.05, bot: 0.85},
            {z: 1.5, w: w * (def.engines === 2 && !def.pods ? 1.2 : 1), h: 0.72, y: 0.05, n: n + 0.4, top: 0.9, bot: 0.9},
            {z: L1 - 2, w: w * (def.engines === 2 && !def.pods ? 1.15 : 0.8), h: 0.62, y: 0, n: n + 0.4},
            {z: L1 - 0.5, w: w * (def.engines === 2 && !def.pods ? 1.05 : 0.66), h: 0.55, y: 0, n: n},
        ];
        g.add(mesh(loft(st, 28), body));
        if (def.pods) [-1, 1].forEach(s => {
            g.add(mesh(loft([
                {z: -2.6, w: 0.62, h: 0.62, y: -0.55, n: 3}, {z: -1.5, w: 0.66, h: 0.66, y: -0.6, n: 2.6},
                {z: 4, w: 0.66, h: 0.66, y: -0.5, n: 2.2}, {z: L1 - 0.3, w: 0.58, h: 0.58, y: -0.4, n: 2},
            ], 20), body, s * def.spread, 0, 0));
            const intake = mesh(new T.BoxGeometry(1.05, 0.95, 0.2), black, s * def.spread, -0.6, -2.7);
            g.add(intake);
        });
        if (def.intake === "caret" || def.intake === "box") [-1, 1].forEach(s => {
            const caret = mesh(loft([
                {z: -4.6, w: 0.42, h: 0.5, n: 4}, {z: -3.4, w: 0.55, h: 0.6, n: 4}, {z: 0.5, w: 0.5, h: 0.55, n: 3},
            ], 16), body, s * (w + 0.25), -0.05, 0);
            if (def.intake === "caret") caret.rotation.z = s * -0.18;
            g.add(caret);
            g.add(mesh(new T.BoxGeometry(0.8, 0.95, 0.15), black, s * (w + 0.25), -0.05, -4.62));
        });
        if (def.intake === "chin") {
            g.add(mesh(loft([{z: -4.2, w: 0.62, h: 0.42, n: 3.5}, {z: -2.8, w: 0.66, h: 0.48, n: 3.5}, {z: 1.0, w: 0.6, h: 0.4, n: 3}], 16), body, 0, -0.85, 0));
            g.add(mesh(new T.BoxGeometry(1.15, 0.75, 0.15), black, 0, -0.85, -4.2));
        }
        if (def.intake === "nose") {
            const ring = new T.Mesh(new T.TorusGeometry(0.5, 0.08, 8, 20), dark);
            ring.position.z = L0 + 0.15;
            g.add(ring);
            const cone = new T.Mesh(new T.ConeGeometry(0.3, 0.8, 14), dark);
            cone.rotation.x = -Math.PI / 2;
            cone.position.set(0, -0.04, L0 + 0.05);
            g.add(cone);
            g.children[0].geometry = loft([{z: L0, w: 0.55, h: 0.55, n: 2}].concat(st.slice(3)), 28);
        }
        if (def.intake === "under") {
        }
        const wingGeo = wing(both(def.wingR), 0.32, {tip: 0.35, dihedral: -0.03});
        g.add(mesh(wingGeo, body, 0, -0.05, 0));
        const wr = def.wingR, tip = wr[wr.length - 3] || wr[1], tipBack = wr[wr.length - 2];
        [-1, 1].forEach(s => {
            const span = Math.abs(tipBack[0]);
            const a = [[span * 0.55, tipBack[1] - 0.2], [span * 0.95, tipBack[1] - 0.15], [span * 0.95, tipBack[1] + 0.55], [span * 0.55, tipBack[1] + 0.6]].map(([x, z]) => [x * s, z]);
            const ail = mesh(wing(s > 0 ? a : a.slice().reverse(), 0.14, {tip: 1}), dark);
            const h = hinge(ail, 0, -0.06, tipBack[1] - 0.1, 0, -0.06, 0);
            g.add(h);
            out.ailerons.push({pivot: h, side: s});
            void tip;
        });
        [-1, 1].forEach(s => {
            const pts = def.stab.map(([x, z]) => [x * s, z]);
            const geo = wing(s > 0 ? pts : pts.slice().reverse(), 0.18, {tip: 0.4, root: def.stab[0][0] * s, span: Math.abs(def.stab[1][0] - def.stab[0][0])});
            const st = mesh(geo, body);
            const pz = (def.stab[0][1] + def.stab[3][1]) / 2;
            const h = hinge(st, 0, 0, pz);
            g.add(h);
            out.elevators.push(h);
        });
        const fins = def.tails === 2 ? [-1, 1] : [0];
        fins.forEach(s => {
            const f = new T.Group();
            f.add(mesh(fin(def.finSide, 0.22), body));
            const fz = def.finSide[1][0];
            const rudGeo = fin([[fz - 0.9, 0.7], [fz, 0.7], [fz + 0.25, 2.6], [fz - 0.6, 2.6]], 0.12);
            const rud = hinge(mesh(rudGeo, dark), 0, 0, fz - 0.9);
            f.add(rud);
            out.rudders.push(rud);
            if (opts.number) [-1, 1].forEach(side => {
                const d = numberDecal(opts.number, 1.3, 0.65);
                d.position.set(side * 0.2, 2.2, def.finSide[2][0] - 1.9);
                d.rotation.y = side * Math.PI / 2;
                f.add(d);
            });
            f.position.set(s * (def.finX || w * 0.7), 0.55, 0);
            f.rotation.z = -s * def.cant;
            g.add(f);
        });
        const cz = L0 + 4.3;
        const canopy = mesh(loft([
            {z: cz - 1.6, w: 0.05, h: 0.05, y: 0.75, n: 2}, {z: cz - 0.9, w: 0.45, h: 0.42, y: 0.75, n: 2, bot: 0.1},
            {z: cz, w: 0.55, h: 0.55, y: 0.78, n: 2, bot: 0.1}, {z: cz + 1.3, w: 0.48, h: 0.42, y: 0.78, n: 2, bot: 0.1},
            {z: cz + (def.bubble ? 2.2 : 2.6), w: 0.1, h: 0.08, y: 0.8, n: 2, bot: 0.1},
        ], 20), glassMat());
        g.add(canopy);
        out.canopy = canopy;
        out.helmetPos = [0, 0.98, cz + 0.4];
        out.eye = [0, 1.3, cz + 0.3];
        g.add(mesh(new T.BoxGeometry(0.5, 0.7, 0.2), black, 0, 1.0, cz + 0.85));
        const nz = L1 - 0.4;
        if (def.flat) [-1, 1].forEach(s => {
            const nb = mesh(new T.BoxGeometry(0.95, 0.55, 1.2), plain(0x3a3632, 0.35, 0.85), s * def.spread, 0, nz + 0.6);
            g.add(nb);
            const hot = new T.Mesh(new T.PlaneGeometry(0.75, 0.38), glowMat(0xff7a2a, 0.6));
            hot.position.set(s * def.spread, 0, nz + 0.9);
            hot.rotation.y = Math.PI;
            g.add(hot);
            out.glows.push(hot);
            const f = new T.Mesh(new T.ConeGeometry(0.42, 3, 12, 1, true), glowMat(0xffa040));
            f.rotation.x = Math.PI / 2;
            f.scale.x = 1.5;
            f.position.set(s * def.spread, 0, nz + 2.7);
            f.userData.z = nz + 1.2;
            g.add(f);
            out.burners.push(f);
        });
        else if (def.engines === 2) [-1, 1].forEach(s => g.add(Object.assign(nozzle(0.52, 1.2, out), {}).translateX(s * (def.pods ? def.spread : def.spread * 0.75)).translateZ(nz).translateY(def.pods ? -0.4 : 0)));
        else g.add(nozzle(0.62, 1.3, out).translateZ(nz));
        const span = Math.max(...def.wingR.map(p => p[0]));
        [-1, 1].forEach(s => {
            const m = missile();
            m.position.set(s * span * 0.98, -0.1, def.wingR[def.wingR.length - 2][1] - 1.5);
            g.add(m);
            const m2 = missile();
            m2.position.set(s * span * 0.6, -0.55, def.wingR[def.wingR.length - 2][1] - 1.2);
            g.add(m2);
            g.add(mesh(new T.BoxGeometry(0.12, 0.3, 1.6), dark, s * span * 0.6, -0.3, def.wingR[def.wingR.length - 2][1] - 1.2));
            const r = roundel(0.55, opts.team, color);
            r.rotation.x = -Math.PI / 2;
            r.position.set(s * span * 0.72, 0.06, def.wingR[def.wingR.length - 2][1] - 0.9);
            g.add(r);
        });
        out.tips = [[-span, -0.05, def.wingR[def.wingR.length - 2][1]], [span, -0.05, def.wingR[def.wingR.length - 2][1]]];
        out.tail = [def.tails === 2 ? (def.finX || w * 0.7) : 0, 4.2, def.finSide[2][0]];
    }

    function buildA10(color, opts, out) {
        const g = out.group, body = paint(color, {pattern: opts.pattern, rough: 0.7, metal: 0.1});
        const dark = plain(0x2a2d30, 0.6, 0.4), black = plain(0x1a1a1a, 0.7, 0.3);
        g.add(mesh(loft([
            {z: -9.4, w: 0.25, h: 0.25, y: -0.2, n: 2}, {z: -8.6, w: 0.75, h: 0.75, y: -0.1, n: 2.4}, {z: -6, w: 1.0, h: 1.0, y: 0.05, n: 2.6},
            {z: -2, w: 1.05, h: 1.0, y: 0.1, n: 2.8}, {z: 3, w: 0.8, h: 0.8, y: 0.15, n: 2.4}, {z: 7.5, w: 0.45, h: 0.5, y: 0.35, n: 2.2},
        ], 26), body));
        g.add(cyl(0.12, 0.12, 2, dark).translateZ(-10.2).translateY(-0.35));
        g.add(mesh(wing(both([[0.9, -2.2], [8.8, -1.6], [8.9, 0.2], [0.9, 0.4]]), 0.45, {tip: 0.55, dihedral: 0.02}), body, 0, -0.55, 0));
        [-1, 1].forEach(s => {
            const pod = mesh(loft([{z: 2.5, w: 0.75, h: 0.75, n: 2}, {z: 3.2, w: 0.85, h: 0.85, n: 2}, {z: 6.2, w: 0.78, h: 0.78, n: 2}, {z: 6.8, w: 0.6, h: 0.6, n: 2}], 20), body, s * 1.75, 1.45, 0);
            g.add(pod);
            g.add(mesh(new T.CircleGeometry(0.7, 18), black, s * 1.75, 1.45, 2.49).rotateY(Math.PI));
            const hot = new T.Mesh(new T.RingGeometry(0.2, 0.55, 18), glowMat(0xff7a2a, 0.3));
            hot.position.set(s * 1.75, 1.45, 6.7);
            g.add(hot);
            out.glows.push(hot);
            g.add(mesh(new T.BoxGeometry(0.25, 0.7, 1.2), body, s * 1.75, 0.95, 4.2));
        });
        [-1, 1].forEach(s => {
            const h = hinge(mesh(wing(s > 0 ? [[0.3, 6.4], [3.8, 6.6], [3.8, 7.8], [0.3, 7.8]] : [[-0.3, 7.8], [-3.8, 7.8], [-3.8, 6.6], [-0.3, 6.4]], 0.22, {tip: 0.8}), body), 0, 0.4, 6.5, 0, 0.4, 0);
            g.add(h);
            out.elevators.push(h);
            const f = new T.Group();
            f.add(mesh(fin([[6.6, -0.8], [8.0, -0.8], [8.1, 2.4], [7.0, 2.4]], 0.2), body));
            const rud = hinge(mesh(fin([[7.6, -0.6], [8.05, -0.6], [8.1, 2.2], [7.65, 2.2]], 0.12), dark), 0, 0, 7.6);
            f.add(rud);
            out.rudders.push(rud);
            f.position.set(s * 3.8, 0.45, 0);
            g.add(f);
            const ail = hinge(mesh(wing(s > 0 ? [[5.5, 0.1], [8.8, 0.15], [8.8, 0.8], [5.5, 0.8]] : [[-5.5, 0.8], [-8.8, 0.8], [-8.8, 0.15], [-5.5, 0.1]], 0.16, {tip: 1}), dark), 0, -0.55, 0.15, 0, -0.55, 0);
            g.add(ail);
            out.ailerons.push({pivot: ail, side: s});
            const r = roundel(0.6, opts.team, color);
            r.rotation.x = -Math.PI / 2;
            r.position.set(s * 6.5, -0.3, -0.9);
            g.add(r);
        });
        const canopy = mesh(loft([{z: -7.2, w: 0.1, h: 0.1, y: 0.9, n: 2}, {z: -6.4, w: 0.55, h: 0.55, y: 0.95, bot: 0.1}, {z: -4.8, w: 0.55, h: 0.5, y: 0.95, bot: 0.1}, {z: -4.0, w: 0.15, h: 0.1, y: 1.0, bot: 0.1}], 18), glassMat());
        g.add(canopy);
        out.canopy = canopy;
        out.helmetPos = [0, 1.15, -5.4];
        out.eye = [0, 1.5, -5.5];
        out.tips = [[-8.9, -0.4, -0.6], [8.9, -0.4, -0.6]];
        out.tail = [3.8, 2.8, 7.6];
    }

    function buildB2(color, opts, out) {
        const g = out.group, body = paint(color, {rough: 0.8, metal: 0.05}), dark = plain(0x24282c, 0.8, 0.1);
        const outline = [[0, -9], [18, 4], [17, 6], [11, 3.5], [6, 6], [0, 3.5], [-6, 6], [-11, 3.5], [-17, 6], [-18, 4]];
        const w = wing(outline.slice().reverse(), 1.4, {tip: 0.25, span: 18, edge: 0.4});
        g.add(mesh(w, body));
        g.add(mesh(loft([{z: -8.2, w: 0.3, h: 0.3, n: 2, bot: 0.3}, {z: -6, w: 2.3, h: 1.1, n: 2.4, bot: 0.25}, {z: -1, w: 3.2, h: 1.4, n: 2.6, bot: 0.25}, {z: 3, w: 2.2, h: 0.9, n: 2.6, bot: 0.25}, {z: 4.2, w: 0.8, h: 0.3, n: 2, bot: 0.25}], 24), body));
        [-1, 1].forEach(s => {
            g.add(mesh(loft([{z: -2.2, w: 0.75, h: 0.35, n: 3, bot: 0.2}, {z: -1, w: 0.95, h: 0.62, n: 3, bot: 0.2}, {z: 3, w: 1.0, h: 0.5, n: 3, bot: 0.2}, {z: 5, w: 0.8, h: 0.15, n: 3, bot: 0.2}], 18), body, s * 4.5, 0.55, 0));
            g.add(mesh(new T.BoxGeometry(1.2, 0.18, 0.1), dark, s * 4.5, 0.8, -1.4));
            const hot = new T.Mesh(new T.PlaneGeometry(1.4, 0.15), glowMat(0xff7a2a, 0.2));
            hot.position.set(s * 4.5, 0.62, 5.05);
            hot.rotation.y = Math.PI;
            g.add(hot);
            out.glows.push(hot);
            const el = hinge(mesh(wing(s > 0 ? [[11.5, 3.8], [16.8, 5.6], [16.6, 6.2], [11.3, 4.4]] : [[-11.3, 4.4], [-16.6, 6.2], [-16.8, 5.6], [-11.5, 3.8]], 0.3, {tip: 1}), dark), 0, 0, 4.5);
            g.add(el);
            out.ailerons.push({pivot: el, side: s});
        });
        const canopy = mesh(loft([{z: -6.4, w: 0.2, h: 0.1, y: 1.0, bot: 0.1}, {z: -5.8, w: 1.3, h: 0.35, y: 1.05, n: 3, bot: 0.1}, {z: -4.8, w: 1.3, h: 0.3, y: 1.15, n: 3, bot: 0.1}], 16), glassMat());
        g.add(canopy);
        out.canopy = canopy;
        out.eye = [0, 1.75, -5.4];
        out.tips = [[-18, 0, 4], [18, 0, 4]];
        out.tail = [0, 0.9, 4];
    }


    const PROPS = {
        spitfire: {len: 9.1, eng: "inline", wing: "ellipse", span: 5.6, blades: 4, chord: 2.4},
        hurricane: {len: 9.6, eng: "inline", wing: "tapered", span: 6.0, blades: 3, chord: 2.6, hump: true},
        bf109: {len: 8.9, eng: "inline", wing: "square", span: 4.9, blades: 3, chord: 2.0},
        mustang: {len: 9.8, eng: "inline", wing: "square", span: 5.6, blades: 4, chord: 2.5, bubble: true, scoop: true},
        yak3: {len: 8.5, eng: "inline", wing: "tapered", span: 4.6, blades: 3, chord: 2.0, bubble: true},
        p38: {len: 11.5, eng: "twin", wing: "tapered", span: 7.8, blades: 3, chord: 2.4},
        zero: {len: 9.1, eng: "radial", wing: "ellipse", span: 6.0, blades: 3, chord: 2.3},
        fw190: {len: 9.0, eng: "radial", wing: "tapered", span: 5.2, blades: 3, chord: 2.2},
        corsair: {len: 10.2, eng: "radial", wing: "gull", span: 6.2, blades: 3, chord: 2.6},
        p47: {len: 11, eng: "radial", wing: "ellipse", span: 6.2, blades: 4, chord: 2.7, fat: 1.25},
        i16: {len: 6.2, eng: "radial", wing: "tapered", span: 4.5, blades: 2, chord: 2.0, fat: 1.15},
        cub: {len: 6.9, eng: "radial", wing: "high", span: 5.4, blades: 2, chord: 1.6, small: true},
    };

    function propWing(kind, span, chord) {
        const le = -chord * 0.4, te = chord * 0.6;
        if (kind === "ellipse") {
            const pts = [];
            for (let i = 0; i <= 10; i++) {
                const t = i / 10, x = 0.8 + span * Math.sin(t * Math.PI / 2), c = Math.cos(t * Math.PI / 2) * 0.85 + 0.15;
                pts.push([x, le * c]);
            }
            for (let i = 10; i >= 0; i--) {
                const t = i / 10, x = 0.8 + span * Math.sin(t * Math.PI / 2), c = Math.cos(t * Math.PI / 2) * 0.85 + 0.15;
                pts.push([x, te * c]);
            }
            return pts;
        }
        if (kind === "square") return [[0.8, le], [span + 0.5, le * 0.6], [span + 0.8, le * 0.3], [span + 0.8, te * 0.35], [span + 0.5, te * 0.5], [0.8, te]];
        return [[0.8, le], [span + 0.5, le * 0.45], [span + 0.8, 0], [span + 0.5, te * 0.4], [0.8, te]];
    }

    function buildProp(def, color, opts, out) {
        const g = out.group, body = paint(color, {pattern: opts.pattern, rough: 0.6, metal: 0.15});
        const dark = plain(new T.Color(color).multiplyScalar(0.55).getHex(), 0.6, 0.3), black = plain(0x1b1b1b, 0.7, 0.3), metal = plain(0x55524c, 0.4, 0.8);
        const f = def.fat || 1, L = def.len, nose = -L * 0.5, tail = L * 0.5, radial = def.eng === "radial";
        if (def.eng !== "twin") {
            g.add(mesh(loft([
                {z: nose, w: radial ? 0.95 * f : 0.62, h: radial ? 0.95 * f : 0.72, n: 2},
                {z: nose + 1.2, w: radial ? 1.0 * f : 0.72, h: radial ? 1.0 * f : 0.85, n: 2.1},
                {z: nose + L * 0.36, w: 0.72 * f, h: 0.92 * f, y: 0.05, n: 2.2},
                {z: nose + L * 0.55, w: 0.6 * f, h: 0.8 * f, y: 0.12, n: 2.2, top: def.hump ? 1.1 : 1},
                {z: tail - 1.2, w: 0.26, h: 0.42, y: 0.35, n: 2},
                {z: tail, w: 0.06, h: 0.12, y: 0.45, n: 2},
            ], 26), body));
            if (radial) {
                const ring = new T.Mesh(new T.TorusGeometry(0.88 * f, 0.13, 8, 24), dark);
                ring.position.z = nose;
                g.add(ring);
                g.add(mesh(new T.CircleGeometry(0.85 * f, 20), black, 0, 0, nose + 0.05).rotateY(Math.PI));
                for (let i = 0; i < 9; i++) {
                    const a = i / 9 * Math.PI * 2, c = cyl(0.13, 0.13, 0.5, metal, 8);
                    c.position.set(Math.cos(a) * 0.55 * f, Math.sin(a) * 0.55 * f, nose + 0.15);
                    g.add(c);
                }
            } else {
                [-1, 1].forEach(s => {
                    for (let i = 0; i < 6; i++) g.add(mesh(new T.BoxGeometry(0.16, 0.1, 0.16), metal, s * 0.66, 0.25, nose + 0.5 + i * 0.3));
                });
            }
            if (def.scoop || !radial) g.add(mesh(loft([{z: -0.5, w: 0.3, h: 0.15, n: 3}, {z: 0.5, w: 0.4, h: 0.32, n: 3}, {z: 2, w: 0.35, h: 0.28, n: 3}, {z: 2.8, w: 0.15, h: 0.08, n: 2}], 14), dark, 0, -0.85, 0));
            const spin = mesh(loft([{z: nose - 1.1, w: 0.02, h: 0.02, n: 2}, {z: nose - 0.7, w: 0.3, h: 0.3, n: 2}, {z: nose - 0.15, w: radial ? 0.42 : 0.5, h: radial ? 0.42 : 0.5, n: 2}], 16), dark);
            g.add(spin);
            out.spinners.push(spin);
            g.add(propeller(def.blades, def.small ? 1.0 : 1.6, out, nose - 0.45));
        } else {
            g.add(mesh(loft([{z: -4.8, w: 0.1, h: 0.1, n: 2}, {z: -3.6, w: 0.6, h: 0.6, n: 2}, {z: 0, w: 0.75, h: 0.8, n: 2.2}, {z: 1.8, w: 0.4, h: 0.4, n: 2}], 22), body));
            [-1, 1].forEach(s => {
                g.add(mesh(loft([{z: -3.8, w: 0.55, h: 0.6, n: 2}, {z: -2, w: 0.62, h: 0.7, n: 2}, {z: 2, w: 0.42, h: 0.5, y: 0.1, n: 2}, {z: 5.6, w: 0.22, h: 0.3, y: 0.25, n: 2}], 20), body, s * 2.1, 0, 0));
                g.add(propeller(3, 1.5, out, -4.2, s * 2.1));
                const sp = mesh(loft([{z: -4.8, w: 0.02, h: 0.02, n: 2}, {z: -4.4, w: 0.28, h: 0.28, n: 2}, {z: -3.85, w: 0.4, h: 0.4, n: 2}], 14), dark, s * 2.1, 0, 0);
                g.add(sp);
                out.spinners.push(sp);
                g.add(mesh(fin([[4.4, -0.5], [5.8, -0.5], [5.9, 1.5], [4.9, 1.5]], 0.14), body, s * 2.1, 0, 0));
            });
            g.add(mesh(wing([[-2.1, 4.9], [2.1, 4.9], [2.1, 5.8], [-2.1, 5.8]], 0.16, {tip: 1}), body, 0, 0.35, 0));
        }
        const outline = propWing(def.wing === "gull" || def.wing === "high" ? "tapered" : def.wing, def.span, def.chord);
        const gw = wing(both(outline), 0.36, {tip: 0.4, dihedral: def.wing === "high" ? 0.0 : 0.09, gull: def.wing === "gull" ? 0.6 : 0, span: def.span});
        const wy = def.wing === "high" ? 0.95 : def.eng === "twin" ? -0.1 : -0.55;
        g.add(mesh(gw, body, 0, wy, def.eng === "twin" ? -0.5 : nose + L * 0.36));
        const wz = def.eng === "twin" ? -0.5 : nose + L * 0.36;
        if (def.wing === "high") [-1, 1].forEach(s => {
            const strut = mesh(new T.CylinderGeometry(0.05, 0.05, 2.4, 6), metal, s * 1.6, 0.1, wz + 0.2);
            strut.rotation.z = s * 0.95;
            g.add(strut);
        });
        [-1, 1].forEach(s => {
            const sp = def.span;
            const a = [[sp * 0.55, def.chord * 0.25], [sp * 0.95, def.chord * 0.15], [sp * 0.95, def.chord * 0.42], [sp * 0.55, def.chord * 0.55]].map(([x, z]) => [x * s, z]);
            const ay = wy + sp * 0.75 * (def.wing === "high" ? 0 : 0.09) + 0.02;
            const ail = hinge(mesh(wing(s > 0 ? a : a.slice().reverse(), 0.12, {tip: 1}), dark), 0, ay, wz + def.chord * 0.2, 0, ay, wz);
            g.add(ail);
            out.ailerons.push({pivot: ail, side: s});
            const r = roundel(0.55, opts.team, color);
            r.rotation.x = -Math.PI / 2;
            r.position.set(s * sp * 0.7, wy + sp * 0.7 * 0.09 + 0.2, wz - 0.1);
            g.add(r);
        });
        if (def.eng !== "twin") {
            const tz = tail - 1.0, ty = 0.3;
            g.add(mesh(wing(both([[0.2, -0.5], [1.8, -0.2], [2.1, 0.2], [1.8, 0.5], [0.2, 0.6]]), 0.16, {tip: 0.6}), body, 0, ty, tz));
            const el = hinge(mesh(wing(both([[0.2, 0.55], [1.8, 0.5], [2.0, 0.85], [0.2, 0.95]]), 0.1, {tip: 1}), dark), 0, ty, tz + 0.52, 0, ty, tz);
            g.add(el);
            out.elevators.push(el);
            g.add(mesh(fin([[tz - 1.6, 0.35], [tz + 0.4, 0.35], [tz + 0.3, 1.6], [tz - 0.2, 1.9], [tz - 0.8, 1.4]], 0.14), body));
            const rud = hinge(mesh(fin([[tz + 0.3, 0.4], [tz + 0.9, 0.4], [tz + 0.8, 1.7], [tz + 0.25, 1.7]], 0.1), dark), 0, 0, tz + 0.3);
            g.add(rud);
            out.rudders.push(rud);
            if (opts.number) [-1, 1].forEach(side => {
                const d = numberDecal(opts.number, 0.9, 0.45);
                d.position.set(side * 0.62, 0.3, nose + L * 0.62);
                d.rotation.y = side * Math.PI / 2;
                g.add(d);
            });
            out.tail = [0, 1.9, tz];
        } else out.tail = [2.1, 1.5, 5.8];
        const cz = def.eng === "twin" ? -2.2 : nose + L * 0.47;
        const canopy = mesh(loft([
            {z: cz - 0.9, w: 0.08, h: 0.06, y: 0.72, n: 2, bot: 0.1}, {z: cz - 0.4, w: 0.42, h: 0.42, y: 0.76, n: 2, bot: 0.1},
            {z: cz + 0.5, w: 0.45, h: 0.48, y: 0.78, n: 2, bot: 0.1}, {z: cz + (def.bubble ? 1.3 : 2.4), w: def.bubble ? 0.1 : 0.15, h: 0.1, y: 0.8, n: 2, bot: 0.1},
        ], 18), glassMat());
        g.add(canopy);
        out.canopy = canopy;
        out.helmetPos = [0, 0.95, cz + 0.3];
        out.eye = [0, 1.32, cz + 0.2];
        out.tips = [[-def.span - 0.8, wy, wz + 0.2], [def.span + 0.8, wy, wz + 0.2]];
        g.add(wheel(0.18, 0, -0.1, tail - 0.6));
    }


    const BIPLANES = {
        classic: {len: 6.2, fw: 0.8, span: 4.0, chord: 1.5, gap: 2.5, stagger: 0.3, eng: "rotary", bays: 1, tips: "round"},
        tigermoth: {len: 7.0, fw: 0.62, span: 4.4, chord: 1.4, gap: 2.4, stagger: 0.7, sweep: 0.18, eng: "inline", bays: 1, tips: "square", seats: 2},
        duster: {len: 7.4, fw: 0.85, span: 4.7, chord: 1.7, gap: 2.6, stagger: 0.5, eng: "radial", bays: 1, tips: "round", spray: true, bigWheels: true},
        swift: {len: 5.6, fw: 0.66, span: 3.3, chord: 1.25, gap: 2.0, stagger: 0.45, eng: "inline", bays: 0, tips: "round", spats: true, spinner: true, smooth: true},
        gunship: {len: 7.6, fw: 0.92, span: 5.2, chord: 1.7, gap: 2.7, stagger: 0.3, eng: "radial", bays: 2, tips: "square", seats: 2, gunner: true, guns: 2},
        fokker: {len: 5.8, fw: 0.78, span: 3.6, chord: 1.4, gap: 1.35, stagger: 0.25, eng: "rotary", bays: 1, tips: "round", wings: 3},
        spad: {len: 6.2, fw: 0.8, span: 4.1, chord: 1.55, gap: 2.4, stagger: 0.35, eng: "radiator", bays: 2, tips: "square"},
        fortress: {len: 10.5, fw: 0.82, span: 8.2, chord: 2.3, gap: 3.0, stagger: 0.2, eng: "twin", bays: 3, tips: "square", seats: 2, gunner: true, nose: true},
        camel: {len: 5.7, fw: 0.8, span: 4.2, chord: 1.45, gap: 2.4, stagger: 0.35, eng: "rotary", bays: 1, tips: "round", hump: true, lowerDihedral: 0.09},
        phantom: {len: 6.6, fw: 0.72, span: 4.3, chord: 1.45, gap: 2.2, stagger: 0.55, sweep: 0.1, eng: "inline", bays: 0, tips: "round", spats: true, spinner: true, canopy: true, smooth: true},
    };

    function biWingOutline(sp, c, tips, sweep = 0) {
        const pts = tips === "square"
            ? [[0.1, -c * 0.45], [sp - 0.1, -c * 0.45], [sp, -c * 0.4], [sp, c * 0.5], [sp - 0.1, c * 0.55], [0.1, c * 0.55]]
            : [[0.1, -c * 0.45], [sp - 0.5, -c * 0.45], [sp - 0.1, -c * 0.32], [sp, 0], [sp - 0.1, c * 0.35], [sp - 0.5, c * 0.55], [0.1, c * 0.55]];
        return both(pts.map(([x, z]) => [x, z + x * sweep]));
    }

    function buildBiplane(color, opts, out, planeId) {
        const def = BIPLANES[planeId] || BIPLANES.classic;
        const g = out.group;
        const fabric = paint(color, {pattern: opts.pattern, rough: def.smooth ? 0.45 : 0.85, metal: def.smooth ? 0.35 : 0});
        const dark = plain(new T.Color(color).multiplyScalar(0.55).getHex(), 0.8, 0.1), metal = plain(0x4a4844, 0.45, 0.7);
        const wood = plain(0x6b4a2e, 0.7, 0), black = plain(0x1b1b1b, 0.7, 0.3);
        const L = def.len, nose = -L * 0.48, tail = L * 0.52, fw = def.fw, twin = def.eng === "twin";
        const boxy = def.smooth ? 2.4 : 3.6;
        g.add(mesh(loft([
            {z: nose, w: fw * (def.eng === "radiator" ? 0.95 : 0.98), h: fw * 1.02, n: def.eng === "radiator" ? 4 : 2.2},
            {z: nose + 0.9, w: fw * 1.05, h: fw * 1.1, n: boxy * 0.8},
            {z: nose + L * 0.35, w: fw, h: fw * 1.12, y: 0.05, n: boxy, top: def.hump ? 1.35 : 1},
            {z: nose + L * 0.55, w: fw * 0.85, h: fw * 1.0, y: 0.1, n: boxy},
            {z: tail - 0.6, w: 0.14, h: 0.24, y: 0.35, n: 2.5},
            {z: tail, w: 0.05, h: 0.1, y: 0.4, n: 2},
        ], 22), fabric));
        if (def.eng === "rotary" || def.eng === "radial") {
            const ring = new T.Mesh(new T.TorusGeometry(fw * 0.98, 0.12, 8, 24), def.eng === "rotary" ? metal : dark);
            ring.position.z = nose;
            g.add(ring);
            g.add(mesh(new T.CircleGeometry(fw * 0.95, 20), black, 0, 0, nose + 0.02).rotateY(Math.PI));
            const cyls = def.eng === "rotary" ? 9 : 7;
            for (let i = 0; i < cyls; i++) {
                const a = i / cyls * Math.PI * 2, c = cyl(0.12, 0.14, 0.55, metal, 8);
                c.rotation.z = a - Math.PI / 2;
                c.geometry = c.geometry.clone().rotateX(-Math.PI / 2);
                c.position.set(Math.cos(a) * fw * 0.6, Math.sin(a) * fw * 0.6, nose - (def.eng === "radial" ? 0.15 : -0.05));
                g.add(c);
            }
        } else if (def.eng === "radiator") {
            g.add(mesh(new T.BoxGeometry(fw * 1.7, fw * 1.7, 0.12), black, 0, 0, nose - 0.02));
            for (let i = -3; i <= 3; i++) g.add(mesh(new T.BoxGeometry(fw * 1.6, 0.03, 0.14), metal, 0, i * fw * 0.22, nose - 0.04));
        } else if (def.eng === "inline") {
            g.add(mesh(cyl(0.07, 0.07, L * 0.4, metal, 8).geometry, metal, fw * 0.95, -0.25, nose + L * 0.2));
        }
        if (twin) {
            [-1, 1].forEach(s => {
                const nx = s * def.span * 0.38;
                g.add(mesh(loft([{z: -2.6, w: 0.5, h: 0.55, n: 2}, {z: -1.8, w: 0.58, h: 0.62, n: 2.4}, {z: 0.6, w: 0.45, h: 0.5, n: 2.4}, {z: 1.4, w: 0.1, h: 0.12, n: 2}], 18), dark, nx, -def.gap * 0.32, 0));
                const ring = new T.Mesh(new T.TorusGeometry(0.5, 0.08, 8, 20), metal);
                ring.position.set(nx, -def.gap * 0.32, -2.6);
                g.add(ring);
                g.add(propeller(2, 1.5, out, -2.95, nx, -def.gap * 0.32));
                const sp = mesh(loft([{z: -3.3, w: 0.02, h: 0.02, n: 2}, {z: -3.1, w: 0.18, h: 0.18, n: 2}, {z: -2.85, w: 0.22, h: 0.22, n: 2}], 12), metal, nx, -def.gap * 0.32, 0);
                g.add(sp);
                out.spinners.push(sp);
            });
            g.add(mesh(loft([{z: nose - 0.6, w: 0.05, h: 0.05, n: 2}, {z: nose - 0.3, w: 0.55, h: 0.55, n: 2}, {z: nose + 0.1, w: fw * 0.95, h: fw, n: 2.4}], 16), glassMat()));
        } else {
            const big = def.spinner;
            const sp = mesh(loft([{z: nose - (big ? 1.0 : 0.75), w: 0.02, h: 0.02, n: 2}, {z: nose - (big ? 0.6 : 0.5), w: big ? 0.36 : 0.25, h: big ? 0.36 : 0.25, n: 2},
                {z: nose - 0.12, w: big ? fw * 0.75 : 0.3, h: big ? fw * 0.75 : 0.3, n: 2}], 14), big ? fabric : metal);
            g.add(sp);
            out.spinners.push(sp);
            g.add(propeller(2, def.span * 0.33 + 0.2, out, nose - 0.42));
        }
        const nw = def.wings || 2, top = def.gap * (nw === 3 ? 1.35 : 0.72), z0 = nose + L * 0.28;
        const levels = [];
        for (let i = 0; i < nw; i++) {
            const y = top - i * def.gap * (nw === 3 ? 0.68 : 1);
            const sp = def.span * (i === 0 ? 1 : nw === 3 && i === 1 ? 1.03 : 0.92);
            const z = z0 - def.stagger * (nw - 1 - i) / (nw - 1 || 1) * 1.0 + (i === 0 ? -def.stagger : 0) * 0.3;
            levels.push({y, sp, z});
            g.add(mesh(wing(biWingOutline(sp, def.chord, def.tips, def.sweep), 0.16, {tip: 0.7, dihedral: i === nw - 1 ? (def.lowerDihedral || 0.04) : 0, span: sp}), fabric, 0, y, z));
        }
        const T0 = levels[0], B = levels[levels.length - 1];
        [-1, 1].forEach(s => {
            const sp = T0.sp, c = def.chord, sw = (def.sweep || 0);
            const a = [[sp * 0.6, c * 0.4], [sp - 0.15, c * 0.33], [sp - 0.2, c * 0.6], [sp * 0.6, c * 0.6]].map(([x, z]) => [x * s, z + x * sw]);
            const ail = hinge(mesh(wing(s > 0 ? a : a.slice().reverse(), 0.07, {tip: 1}), dark), 0, T0.y + 0.02, T0.z + c * 0.4, 0, T0.y + 0.02, T0.z);
            g.add(ail);
            out.ailerons.push({pivot: ail, side: s});
            const r = roundel(0.42 + def.span * 0.02, opts.team, color);
            r.rotation.x = -Math.PI / 2;
            r.position.set(s * sp * 0.68, T0.y + 0.1, T0.z + sp * 0.68 * sw);
            g.add(r);
        });
        [-1, 1].forEach(s => [-0.35, 0.35].forEach(dz => {
            const st = mesh(new T.BoxGeometry(0.06, T0.y - fw * 0.6, 0.06), metal, s * fw * 0.6, (T0.y + fw * 0.6) / 2, T0.z + dz);
            st.rotation.z = s * -0.15;
            g.add(st);
        }));
        const bays = Math.max(1, def.bays);
        [-1, 1].forEach(s => {
            for (let b = 1; b <= bays; b++) {
                const x = s * T0.sp * (bays === 1 ? 0.7 : 0.3 + 0.62 * (b - 1) / (bays - 1));
                const zt = T0.z + Math.abs(x) * (def.sweep || 0), zb = B.z + Math.abs(x) * (def.sweep || 0);
                if (def.bays === 0) {
                    const st = mesh(new T.BoxGeometry(0.08, T0.y - B.y, def.chord * 0.5), wood, x, (T0.y + B.y) / 2, (zt + zb) / 2);
                    st.rotation.x = Math.atan2(zt - zb, T0.y - B.y);
                    g.add(st);
                } else [-0.35, 0.35].forEach(dz => {
                    const st = mesh(new T.BoxGeometry(0.08, T0.y - B.y, 0.12), wood, x, (T0.y + B.y) / 2, (zt + zb) / 2 + dz * def.chord);
                    st.rotation.x = Math.atan2(zt - zb, T0.y - B.y);
                    g.add(st);
                });
                if (def.bays > 0) {
                    const inner = b === 1 ? s * fw : s * T0.sp * (0.3 + 0.62 * (b - 2) / (bays - 1));
                    const dx = x - inner, dy = T0.y - B.y, len = Math.hypot(dx, dy);
                    [1, -1].forEach(dir => {
                        const w = mesh(new T.CylinderGeometry(0.012, 0.012, len, 4), metal, (x + inner) / 2, (T0.y + B.y) / 2, (zt + zb) / 2);
                        w.rotation.z = Math.atan2(dx, dy) * dir;
                        g.add(w);
                    });
                }
            }
        });
        const wr = def.bigWheels ? 0.55 : 0.45, gy = B.y - 1.1;
        [-1, 1].forEach(s => {
            g.add(wheel(wr, s * (fw + 0.25), gy, nose + L * 0.22));
            if (def.spats) g.add(mesh(loft([{z: -0.7, w: 0.02, h: 0.05, n: 2}, {z: -0.3, w: 0.2, h: 0.5, n: 2}, {z: 0.4, w: 0.18, h: 0.45, n: 2}, {z: 0.8, w: 0.02, h: 0.05, n: 2}], 12), fabric, s * (fw + 0.25), gy, nose + L * 0.22));
            const leg = mesh(new T.BoxGeometry(0.06, Math.abs(gy) + 0.2, 0.06), metal, s * (fw * 0.7), gy / 2 - 0.1, nose + L * 0.2);
            leg.rotation.z = s * 0.3;
            g.add(leg);
        });
        if (!def.spats) g.add(mesh(new T.CylinderGeometry(0.03, 0.03, 2 * (fw + 0.25), 4).rotateZ(Math.PI / 2), metal, 0, gy, nose + L * 0.22));
        g.add(mesh(new T.BoxGeometry(0.05, 0.5, 0.05), metal, 0, 0.0, tail - 0.4));
        if (def.spray) {
            g.add(mesh(new T.CylinderGeometry(0.04, 0.04, B.sp * 1.7, 6).rotateZ(Math.PI / 2), metal, 0, B.y - 0.25, B.z + def.chord * 0.55));
            for (let i = -6; i <= 6; i++) g.add(mesh(new T.BoxGeometry(0.04, 0.12, 0.04), metal, i * B.sp * 0.13, B.y - 0.33, B.z + def.chord * 0.55));
            g.add(mesh(loft([{z: -0.6, w: 0.3, h: 0.3, n: 2}, {z: 0, w: 0.45, h: 0.45, n: 2}, {z: 0.6, w: 0.3, h: 0.3, n: 2}], 12), dark, 0, -fw - 0.2, nose + L * 0.3));
        }
        const tz = tail - 0.9;
        g.add(mesh(wing(both([[0.1, -0.4], [1.6 + def.span * 0.06, -0.2], [1.9 + def.span * 0.06, 0.2], [1.6 + def.span * 0.06, 0.5], [0.1, 0.5]]), 0.1, {tip: 0.8}), fabric, 0, 0.35, tz));
        const el = hinge(mesh(wing(both([[0.1, 0.5], [1.6 + def.span * 0.06, 0.5], [1.7 + def.span * 0.06, 0.9], [0.1, 0.95]]), 0.06, {tip: 1}), dark), 0, 0.35, tz + 0.5, 0, 0.35, tz);
        g.add(el);
        out.elevators.push(el);
        g.add(mesh(fin([[tz - 0.9, 0.35], [tz + 0.6, 0.35], [tz + 0.6, 1.5], [tz, 1.6]], 0.08), fabric));
        const rud = hinge(mesh(fin([[tz + 0.6, 0.2], [tz + 1.2, 0.2], [tz + 1.2, 1.4], [tz + 0.6, 1.6]], 0.06), dark), 0, 0, tz + 0.6);
        g.add(rud);
        out.rudders.push(rud);
        if (opts.number) [-1, 1].forEach(side => {
            const d = numberDecal(opts.number, 0.7, 0.35);
            d.position.set(side * fw * 0.8, 0.25, nose + L * 0.62);
            d.rotation.y = side * Math.PI / 2;
            g.add(d);
        });
        const guns = def.guns || 2;
        for (let i = 0; i < guns; i++) {
            const x = (i - (guns - 1) / 2) * 0.45;
            g.add(cyl(0.06, 0.06, 1.5, metal, 8).translateX(x).translateY(fw * (def.hump ? 1.45 : 1.15)).translateZ(nose + L * 0.2));
        }
        const cz = nose + L * 0.47;
        let shield;
        if (def.canopy) {
            shield = mesh(loft([{z: cz - 0.8, w: 0.05, h: 0.05, y: fw * 0.95, n: 2, bot: 0.1}, {z: cz - 0.3, w: 0.4, h: 0.38, y: fw * 0.95, n: 2, bot: 0.1}, {z: cz + 0.6, w: 0.4, h: 0.38, y: fw * 0.95, n: 2, bot: 0.1}, {z: cz + 1.2, w: 0.1, h: 0.1, y: fw * 0.97, n: 2, bot: 0.1}], 16), glassMat());
        } else {
            shield = mesh(new T.PlaneGeometry(0.62, 0.28), glassMat(), 0, fw * 1.25, cz - 0.6);
            shield.rotation.x = -0.4;
        }
        g.add(shield);
        out.canopy = shield;
        const rim = (r, z) => {
            const m = new T.Mesh(new T.TorusGeometry(r, 0.06, 6, 16), black);
            m.rotation.x = Math.PI / 2;
            m.position.set(0, fw * 1.08, z);
            g.add(m);
        };
        rim(0.38, cz);
        if (def.seats === 2) rim(0.36, cz + 1.3);
        if (def.gunner) {
            const ring = new T.Mesh(new T.TorusGeometry(0.42, 0.05, 6, 18), metal);
            ring.rotation.x = Math.PI / 2;
            ring.position.set(0, fw * 1.1, cz + 1.3);
            g.add(ring);
            g.add(cyl(0.05, 0.05, 1.2, metal, 8).translateY(fw * 1.45).translateZ(cz + 1.9));
            g.add(mesh(new T.SphereGeometry(0.24, 10, 8), plain(0x5a3b22, 0.8, 0), 0, fw * 1.4, cz + 1.3));
        }
        out.helmetPos = [0, fw * 1.25, cz + 0.1];
        out.eye = [0, fw * 1.45, cz];
        out.tips = [[-T0.sp, T0.y, T0.z], [T0.sp, T0.y, T0.z]];
        out.tail = [0, 1.6, tz + 1.1];
    }


    D.buildPlaneModel = function (shape, color, planeId, opts = {}) {
        T = D.THREE;
        const out = {group: new T.Group(), props: [], spinners: [], burners: [], glows: [], ailerons: [], elevators: [], rudders: [], canopy: null, tips: null, tail: null, eye: null, helmetPos: null};
        if (shape === "jet") {
            if (planeId === "a10") buildA10(color, opts, out);
            else buildJet(JETS[planeId] || JETS.f16, color, opts, out);
        } else if (shape === "bomber") buildB2(color, opts, out);
        else if (shape === "prop") buildProp(PROPS[planeId] || PROPS.spitfire, color, opts, out);
        else buildBiplane(color, opts, out, planeId);
        if (D.shadows) out.group.traverse(o => {
            if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)) o.castShadow = o.receiveShadow = true;
        });
        return out;
    };

    D.resetModelCache = () => {
        for (const m of matCache.values()) m.dispose();
        matCache.clear();
    };
})();
