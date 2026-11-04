(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};
    let T;

    const GLASS_VERT = `
        varying vec3 vWorld, vNormal;
        varying vec2 vUv;
        void main() {
            vUv = uv;
            vec4 w = modelMatrix * vec4(position, 1.0);
            vWorld = w.xyz;
            vNormal = normalize(mat3(modelMatrix) * normal);
            gl_Position = projectionMatrix * viewMatrix * w;
        }`;

    const GLASS_FRAG = `
        uniform vec3 tint, sky, sunDir, sunColor;
        uniform float strength, dirt;
        varying vec3 vWorld, vNormal;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
        }
        void main() {
            vec3 v = normalize(cameraPosition - vWorld);
            vec3 n = normalize(vNormal);
            if (dot(n, v) < 0.0) n = -n;
            float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0);
            vec3 r = reflect(-v, n);
            float glint = pow(max(dot(r, normalize(sunDir)), 0.0), 220.0) * 3.0 + pow(max(dot(r, normalize(sunDir)), 0.0), 18.0) * 0.12;
            vec2 p = vUv * vec2(90.0, 60.0);
            float scratch = smoothstep(0.985, 1.0, noise(vec2(p.x * 0.15, p.y * 6.0) + noise(p * 0.3) * 4.0)) * 0.6;
            float dust = smoothstep(0.55, 0.9, noise(vUv * 26.0)) * 0.5 + smoothstep(0.7, 1.0, noise(vUv * 140.0)) * 0.35;
            float edge = smoothstep(0.35, 0.5, max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)));
            float alpha = strength * (0.05 + fres * 0.55) + dirt * (dust * 0.06 + edge * 0.08) + (scratch + glint) * dirt;
            vec3 col = mix(tint, sky, fres) + sunColor * (glint + scratch * 0.4);
            gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
        }`;

    const GLOW_FRAG = `
        uniform sampler2D map;
        uniform vec3 color;
        uniform float power, texel;
        varying vec3 vWorld, vNormal;
        varying vec2 vUv;
        void main() {
            float core = texture2D(map, vUv).a;
            float halo = 0.0;
            for (int i = 0; i < 8; i++) {
                float a = float(i) * 0.785398;
                vec2 o = vec2(cos(a), sin(a)) * texel;
                halo += texture2D(map, vUv + o * 1.5).a + texture2D(map, vUv + o * 3.5).a * 0.6;
            }
            halo /= 12.8;
            vec3 c = color * (core * 1.7 + halo * 0.75) * power;
            gl_FragColor = vec4(c, max(core, halo * 0.6));
        }`;

    const LCD_FRAG = `
        uniform sampler2D map;
        uniform float power;
        varying vec3 vWorld, vNormal;
        varying vec2 vUv;
        void main() {
            vec3 c = texture2D(map, vUv).rgb;
            vec2 px = fract(vUv * vec2(320.0, 320.0));
            float grid = 0.82 + 0.18 * step(0.18, px.x) * step(0.18, px.y);
            float vig = 1.0 - 0.35 * pow(length(vUv - 0.5) * 1.35, 2.0);
            vec3 v = normalize(cameraPosition - vWorld);
            float glare = pow(1.0 - abs(dot(normalize(vNormal), v)), 3.0) * 0.08;
            gl_FragColor = vec4((c * grid * vig + vec3(0.02, 0.03, 0.03)) * power + glare, 1.0);
        }`;

    function sunUniforms() {
        return {sunDir: {value: new T.Vector3(0.35, 0.62, 0.3)}, sunColor: {value: new T.Color(0xfff2d6)}, sky: {value: new T.Color(0xbfdcf5)}};
    }

    function glassMat(tint = 0x9fb8c8, strength = 1, dirt = 1) {
        return new T.ShaderMaterial({
            uniforms: Object.assign({tint: {value: new T.Color(tint)}, strength: {value: strength * (D.pbr ? 1 : 0.4)}, dirt: {value: dirt * (D.pbr ? 1 : 0.5)}}, sunUniforms()),
            vertexShader: GLASS_VERT, fragmentShader: GLASS_FRAG, transparent: true, depthWrite: false, side: T.DoubleSide,
        });
    }

    function glowMat(tex, color, size, power = 1) {
        return new T.ShaderMaterial({
            uniforms: {map: {value: tex}, color: {value: new T.Color(color)}, power: {value: power}, texel: {value: 1 / size}},
            vertexShader: GLASS_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
        });
    }

    function lcdMat(tex) {
        return new T.ShaderMaterial({uniforms: {map: {value: tex}, power: {value: 1}}, vertexShader: GLASS_VERT, fragmentShader: LCD_FRAG});
    }

    function std(color, rough = 0.7, metal = 0.1) {
        return D.pbr ? new T.MeshStandardMaterial({color, roughness: rough, metalness: metal})
            : new T.MeshLambertMaterial({color});
    }

    function canvasTex(w, h) {
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const tex = new T.CanvasTexture(canvas);
        tex.encoding = T.sRGBEncoding;
        tex.anisotropy = 4;
        return {canvas, tex, ctx: canvas.getContext("2d")};
    }

    function mesh(geo, mat, x = 0, y = 0, z = 0) {
        const m = new T.Mesh(geo, mat);
        m.position.set(x, y, z);
        return m;
    }

    function box(w, h, d, mat, x, y, z) {
        return mesh(new T.BoxGeometry(w, h, d), mat, x, y, z);
    }

    function cyl(r1, r2, len, mat, segs = 12) {
        return new T.Mesh(new T.CylinderGeometry(r1, r2, len, segs), mat);
    }

    function rounded(w, h, r) {
        const s = new T.Shape();
        s.moveTo(-w / 2 + r, -h / 2);
        s.lineTo(w / 2 - r, -h / 2);
        s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
        s.lineTo(w / 2, h / 2 - r);
        s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
        s.lineTo(-w / 2 + r, h / 2);
        s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
        s.lineTo(-w / 2, -h / 2 + r);
        s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
        return s;
    }

    function arch(r, tube, mat, arc = Math.PI, sx = 1, sy = 1) {
        const m = new T.Mesh(new T.TorusGeometry(r, tube, 8, 28, arc), mat);
        m.scale.set(sx, sy, 1);
        return m;
    }

    function panelPlane(w, h, tex, base, tilt) {
        const g = new T.Group();
        const face = mesh(new T.PlaneGeometry(w, h), D.pbr
            ? new T.MeshStandardMaterial({map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.32, roughness: 0.85, metalness: 0.05})
            : new T.MeshLambertMaterial({map: tex, emissiveMap: tex, emissive: 0x777777}));
        g.add(face);
        const back = new T.Mesh(new T.ExtrudeGeometry(rounded(w + 0.04, h + 0.04, 0.05), {depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2}), base);
        back.position.z = -0.075;
        g.add(back);
        g.rotation.x = tilt;
        g.userData = {w, h};
        return g;
    }

    function at(panel, cw, ch, u, v, z = 0.004) {
        const {w, h} = panel.userData;
        return new T.Vector3((u / cw - 0.5) * w, (0.5 - v / ch) * h, z);
    }

    function bezel(panel, cw, ch, u, v, rpx, mat, glass) {
        const r = rpx / cw * panel.userData.w;
        const ring = new T.Mesh(new T.TorusGeometry(r * 1.02, r * 0.09, 8, 32), mat);
        ring.position.copy(at(panel, cw, ch, u, v, 0.012));
        panel.add(ring);
        if (glass) {
            const disc = new T.Mesh(new T.CircleGeometry(r, 32), glass);
            disc.position.copy(at(panel, cw, ch, u, v, 0.016));
            panel.add(disc);
        }
        for (let k = 0; k < 4; k++) {
            const a = Math.PI / 4 + k * Math.PI / 2;
            const screw = cyl(r * 0.07, r * 0.07, 0.01, mat, 8);
            screw.rotation.x = Math.PI / 2;
            screw.position.copy(at(panel, cw, ch, u + Math.cos(a) * rpx * 1.25, v + Math.sin(a) * rpx * 1.25, 0.008));
            panel.add(screw);
        }
    }

    function toggles(group, x0, z0, cols, rows, dx, dz, y, mats) {
        for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
            const k = (i * 7 + j * 3) % 5;
            const x = x0 + i * dx, z = z0 + j * dz;
            if (k === 0) {
                const knob = cyl(0.016, 0.018, 0.02, mats.knob, 12);
                knob.position.set(x, y + 0.01, z);
                group.add(knob);
                group.add(box(0.004, 0.004, 0.014, mats.white, x, y + 0.021, z - 0.006));
            } else {
                const t = cyl(0.0035, 0.0035, 0.026, mats.metal, 6);
                t.position.set(x, y + 0.012, z);
                t.rotation.x = (k % 2 ? 0.45 : -0.45);
                group.add(t);
                group.add(box(0.012, 0.004, 0.012, mats.dark, x, y + 0.002, z));
            }
        }
    }

    function screws(c, w, h, step) {
        c.fillStyle = "rgba(255,255,255,0.18)";
        for (let x = step / 2; x < w; x += step) for (const y of [8, h - 8]) {
            c.beginPath();
            c.arc(x, y, 3, 0, Math.PI * 2);
            c.fill();
        }
    }

    function label(c, text, x, y, size = 14, color = "#e8e8e8", align = "center") {
        c.fillStyle = color;
        c.font = `bold ${size}px "Helvetica Neue", Arial, sans-serif`;
        c.textAlign = align;
        c.textBaseline = "middle";
        c.fillText(text, x, y);
    }

    function needle(c, x, y, a, len, width, color, tail = 0.18) {
        c.save();
        c.translate(x, y);
        c.rotate(a);
        c.fillStyle = color;
        c.beginPath();
        c.moveTo(-len * tail, -width);
        c.lineTo(len, 0);
        c.lineTo(-len * tail, width);
        c.closePath();
        c.fill();
        c.restore();
        c.fillStyle = "#222";
        c.beginPath();
        c.arc(x, y, width * 1.3, 0, Math.PI * 2);
        c.fill();
    }

    function dialFace(c, x, y, r, opts) {
        const {from = Math.PI * 0.75, sweep = Math.PI * 1.5, ticks = 10, minor = 5, nums, title, face = "#0c0c0c", ink = "#f2efe4", bands} = opts;
        const g = c.createRadialGradient(x, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, face === "#0c0c0c" ? "#1d1d1d" : face);
        g.addColorStop(1, face);
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.fill();
        if (bands) for (const [a, b, col] of bands) {
            c.strokeStyle = col;
            c.lineWidth = r * 0.07;
            c.beginPath();
            c.arc(x, y, r * 0.86, from + sweep * a, from + sweep * b);
            c.stroke();
        }
        c.strokeStyle = ink;
        for (let i = 0; i <= ticks * minor; i++) {
            const a = from + sweep * i / (ticks * minor), big = i % minor === 0;
            c.lineWidth = big ? r * 0.035 : r * 0.015;
            c.beginPath();
            c.moveTo(x + Math.cos(a) * r * (big ? 0.72 : 0.8), y + Math.sin(a) * r * (big ? 0.72 : 0.8));
            c.lineTo(x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
            c.stroke();
        }
        if (nums) nums.forEach((t, i) => {
            const a = from + sweep * i / (nums.length - 1);
            label(c, t, x + Math.cos(a) * r * 0.56, y + Math.sin(a) * r * 0.56, r * 0.16, ink);
        });
        if (title) label(c, title, x, y + r * 0.42, r * 0.11, ink);
    }

    function attitude(c, x, y, r, pitch, roll, sky = "#3a7bd5", ground = "#7a4f28") {
        c.save();
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2);
        c.clip();
        c.translate(x, y);
        c.rotate(roll);
        const off = pitch * r * 1.6;
        c.fillStyle = sky;
        c.fillRect(-r * 2, -r * 3 + off, r * 4, r * 3);
        c.fillStyle = ground;
        c.fillRect(-r * 2, off, r * 4, r * 3);
        c.strokeStyle = "#fff";
        c.lineWidth = Math.max(1.5, r * 0.025);
        c.beginPath();
        c.moveTo(-r * 2, off);
        c.lineTo(r * 2, off);
        c.stroke();
        for (let k = -4; k <= 4; k++) {
            if (!k) continue;
            const yy = off - k * r * 0.14, w = k % 2 ? r * 0.18 : r * 0.34;
            c.beginPath();
            c.moveTo(-w, yy);
            c.lineTo(w, yy);
            c.stroke();
        }
        c.restore();
        c.save();
        c.translate(x, y);
        c.strokeStyle = "#fff";
        c.lineWidth = r * 0.03;
        for (const d of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
            const a = (d - 90) * Math.PI / 180;
            c.beginPath();
            c.moveTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86);
            c.lineTo(Math.cos(a) * r * (d % 30 ? 0.94 : 0.99), Math.sin(a) * r * (d % 30 ? 0.94 : 0.99));
            c.stroke();
        }
        c.rotate(roll);
        c.fillStyle = "#ffcf3a";
        c.beginPath();
        c.moveTo(0, -r * 0.84);
        c.lineTo(-r * 0.07, -r * 0.72);
        c.lineTo(r * 0.07, -r * 0.72);
        c.fill();
        c.restore();
        c.strokeStyle = "#ffb000";
        c.lineWidth = r * 0.06;
        c.beginPath();
        c.moveTo(x - r * 0.55, y);
        c.lineTo(x - r * 0.18, y);
        c.lineTo(x, y + r * 0.12);
        c.lineTo(x + r * 0.18, y);
        c.lineTo(x + r * 0.55, y);
        c.stroke();
    }

    function flightData(plane) {
        const f = plane.forward, r = plane.right;
        return {
            pitch: Math.asin(Math.max(-1, Math.min(1, f.y))),
            roll: Math.atan2(r.y, plane.up.y),
            heading: (Math.atan2(f.x, -f.z) * 180 / Math.PI + 360) % 360,
            kmh: plane.speed * 3.6,
            alt: plane.pos.y,
            climb: f.y * plane.speed,
        };
    }

    function buildJet(ctx) {
        const {g, ex, ey, ez, mats, color} = ctx;
        const panelTex = canvasTex(1024, 512);
        const panel = panelPlane(1.28, 0.64, panelTex.tex, mats.panel, -0.22);
        panel.position.set(ex, ey - 0.6, ez - 0.98);
        g.add(panel);
        const mfds = [-1, 1].map(s => {
            const t = canvasTex(512, 512);
            const frame = new T.Group();
            frame.add(mesh(new T.ExtrudeGeometry(rounded(0.3, 0.3, 0.025), {depth: 0.03, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2}), mats.bezel, 0, 0, -0.012));
            frame.add(mesh(new T.PlaneGeometry(0.215, 0.215), lcdMat(t.tex), 0, 0, 0.026));
            for (let side = 0; side < 4; side++) for (let k = 0; k < 5; k++) {
                const o = (k - 2) * 0.042, b = box(side % 2 ? 0.02 : 0.03, side % 2 ? 0.03 : 0.02, 0.014, mats.button, 0, 0, 0.026);
                if (side === 0) b.position.set(o, 0.133, 0.026);
                if (side === 1) b.position.set(0.133, -o, 0.026);
                if (side === 2) b.position.set(-o, -0.133, 0.026);
                if (side === 3) b.position.set(-0.133, o, 0.026);
                frame.add(b);
            }
            frame.position.copy(at(panel, 1024, 512, 512 + s * 350, 300, 0.02));
            panel.add(frame);
            return t;
        });
        const dedTex = canvasTex(512, 160);
        const ded = mesh(new T.PlaneGeometry(0.22, 0.068), lcdMat(dedTex.tex));
        ded.position.copy(at(panel, 1024, 512, 512, 118, 0.03));
        panel.add(ded);
        const dedFrame = box(0.26, 0.1, 0.05, mats.bezel, 0, 0, 0);
        dedFrame.position.copy(at(panel, 1024, 512, 512, 118, 0.0));
        panel.add(dedFrame);
        [[512, 300, 62], [440, 432, 40], [584, 432, 40]].forEach(([u, v, r]) => bezel(panel, 1024, 512, u, v, r, mats.metal, ctx.gaugeGlass));
        const shield = new T.Mesh(new T.ExtrudeGeometry((() => {
            const s = new T.Shape();
            s.moveTo(-0.72, 0);
            s.quadraticCurveTo(-0.7, 0.12, -0.3, 0.13);
            s.lineTo(0.3, 0.13);
            s.quadraticCurveTo(0.7, 0.12, 0.72, 0);
            s.lineTo(-0.72, 0);
            return s;
        })(), {depth: 0.42, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3}), mats.glare);
        shield.position.set(ex, ey - 0.34, ez - 1.3);
        g.add(shield);
        const hudTex = canvasTex(512, 512);
        const hud = {w: 0.46, h: 0.42, d: 0.82};
        [-1, 1].forEach(s => {
            const post = box(0.022, 0.32, 0.022, mats.bezel, ex + s * 0.22, ey - 0.16, ez - hud.d - 0.04);
            post.rotation.x = 0.12;
            g.add(post);
        });
        g.add(box(0.5, 0.06, 0.16, mats.bezel, ex, ey - 0.3, ez - hud.d - 0.06));
        const combiner = mesh(new T.PlaneGeometry(hud.w, hud.h), glassMat(0x6fae8a, 0.7, 0.5), ex, ey + 0.02, ez - hud.d);
        g.add(combiner);
        const hudPlane = mesh(new T.PlaneGeometry(hud.w, hud.h), glowMat(hudTex.tex, 0x5cff8a, 512, D.pbr ? 2.2 : 1.1), ex, ey + 0.02, ez - hud.d + 0.002);
        hudPlane.renderOrder = 3;
        g.add(hudPlane);
        Object.assign(hud, {tex: hudTex, cx: ex, cy: ey + 0.02});
        [-1, 1].forEach(s => {
            const con = box(0.3, 0.09, 1.1, mats.console, ex + s * 0.5, ey - 0.86, ez + 0.05);
            g.add(con);
            const top = canvasTex(256, 512);
            drawConsole(top.ctx, s);
            top.tex.needsUpdate = true;
            const face = mesh(new T.PlaneGeometry(0.3, 1.1), D.pbr ? new T.MeshStandardMaterial({map: top.tex, roughness: 0.8}) : new T.MeshLambertMaterial({map: top.tex}), ex + s * 0.5, ey - 0.813, ez + 0.05);
            face.rotation.x = -Math.PI / 2;
            g.add(face);
            toggles(g, ex + s * 0.5 - 0.1, ez - 0.36, 6, 3, 0.04, 0.05, ey - 0.81, mats);
            toggles(g, ex + s * 0.5 - 0.1, ez + 0.14, 6, 2, 0.04, 0.06, ey - 0.81, mats);
            const rail = box(0.09, 0.07, 2.4, mats.pad, ex + s * 0.78, ey - 0.4, ez + 0.5);
            g.add(rail);
            g.add(box(0.035, 0.035, 2.4, mats.frame, ex + s * 0.8, ey - 0.35, ez + 0.5));
        });
        const bow = arch(0.78, 0.05, mats.frame, Math.PI, 1, 0.82);
        bow.position.set(ex, ey - 0.36, ez + 0.62);
        g.add(bow);
        [-0.32, 0, 0.32].forEach(x => {
            const m = box(0.16, 0.06, 0.012, mats.mirror, ex + x, ey + 0.27 - Math.abs(x) * 0.45, ez + 0.58);
            m.rotation.x = 0.35;
            m.rotation.y = -x * 0.8;
            g.add(m);
            g.add(box(0.17, 0.07, 0.01, mats.frame, ex + x, ey + 0.27 - Math.abs(x) * 0.45, ez + 0.594).rotateX(0.35));
        });
        const shell = new T.Mesh(new T.SphereGeometry(1, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), glassMat(0x8fb0c4, 1, 1));
        shell.scale.set(0.82, 0.62, 2.0);
        shell.position.set(ex, ey - 0.36, ez - 0.2);
        shell.renderOrder = 2;
        g.add(shell);
        ctx.glass.push(shell.material, combiner.material);
        const stick = new T.Group();
        stick.position.set(ex + 0.5, ey - 0.81, ez - 0.18);
        stick.add(mesh(new T.CylinderGeometry(0.02, 0.026, 0.1, 10), mats.dark, 0, 0.05, 0));
        const grip = mesh(new T.CapsuleGeometry(0.032, 0.09, 4, 10), mats.grip, 0, 0.14, 0);
        grip.rotation.x = -0.2;
        stick.add(grip);
        stick.add(mesh(new T.SphereGeometry(0.012, 8, 6), mats.red, 0, 0.2, -0.02));
        g.add(stick);
        const throttle = new T.Group();
        throttle.position.set(ex - 0.5, ey - 0.81, ez - 0.1);
        const lever = new T.Group();
        lever.add(box(0.03, 0.12, 0.03, mats.dark, 0, 0.06, 0));
        lever.add(mesh(new T.CapsuleGeometry(0.04, 0.08, 4, 10), mats.grip, 0, 0.14, 0).rotateZ(Math.PI / 2));
        throttle.add(lever);
        g.add(throttle);
        ctx.moving = {stick, lever, leverRange: [0.12, -0.14]};
        ctx.hands = [[stick, 0, 0.15, 0.02], [lever, 0, 0.16, 0.03]];
        addTub(ctx, {half: 0.66, floor: 1.38, top: 0.42, front: 0.95, back: 0.7, mat: mats.tub, rib: mats.console});
        return {panelTex, mfds, dedTex, hud, panel};
    }

    function drawConsole(c, s) {
        c.fillStyle = "#2a2e33";
        c.fillRect(0, 0, 256, 512);
        c.strokeStyle = "#111";
        c.lineWidth = 3;
        for (const y of [10, 190, 330, 500]) {
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(256, y);
            c.stroke();
        }
        const names = s < 0 ? ["FUEL", "EXT LT", "ENG", "ECM", "COMM"] : ["SNSR", "AVIONICS", "HUD", "ANTI ICE", "OXY"];
        names.forEach((n, i) => label(c, n, 128, 24 + i * 100, 16, "#e9e9e0"));
        screws(c, 256, 512, 40);
    }

    function buildProp(ctx) {
        const {g, ex, ey, ez, mats, color} = ctx;
        const panelTex = canvasTex(1024, 512);
        const panel = panelPlane(1.12, 0.56, panelTex.tex, mats.panel, -0.12);
        panel.position.set(ex, ey - 0.56, ez - 0.92);
        g.add(panel);
        const gauges = [[230, 170, 92], [512, 170, 92], [794, 170, 92], [230, 380, 82], [512, 380, 82], [794, 380, 82], [90, 300, 52], [934, 300, 52]];
        gauges.forEach(([u, v, r]) => bezel(panel, 1024, 512, u, v, r, mats.metal, ctx.gaugeGlass));
        const coaming = new T.Mesh(new T.ExtrudeGeometry(rounded(1.08, 0.07, 0.035), {depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 3}), mats.pad);
        coaming.position.set(ex, ey - 0.4, ez - 1.06);
        g.add(coaming);
        const sight = new T.Group();
        sight.position.set(ex, ey - 0.26, ez - 0.92);
        sight.add(box(0.07, 0.07, 0.14, mats.dark, 0, -0.02, 0.03));
        sight.add(cyl(0.028, 0.028, 0.08, mats.dark, 14).rotateX(Math.PI / 2));
        const refl = mesh(new T.PlaneGeometry(0.15, 0.13), glassMat(0xd6c39a, 0.8, 0.4), 0, 0.09, -0.02);
        refl.rotation.x = -0.12;
        sight.add(refl);
        const ret = canvasTex(256, 256);
        drawReticle(ret.ctx);
        ret.tex.needsUpdate = true;
        const reticle = mesh(new T.PlaneGeometry(0.15, 0.13), glowMat(ret.tex, 0xff9a3a, 256, D.pbr ? 2 : 1), 0, 0.09, -0.018);
        reticle.rotation.x = -0.12;
        reticle.renderOrder = 3;
        sight.add(reticle);
        g.add(sight);
        ctx.glass.push(refl.material);
        const glass = mesh(new T.PlaneGeometry(0.42, 0.32), glassMat(0xa9c4cf, 1.3, 1.2), ex, ey - 0.06, ez - 1.02);
        glass.rotation.x = -0.18;
        g.add(glass);
        ctx.glass.push(glass.material);
        g.add(box(0.46, 0.035, 0.05, mats.frame, ex, ey + 0.11, ez - 1.0));
        [-1, 1].forEach(s => {
            const post = box(0.045, 0.52, 0.045, mats.frame, ex + s * 0.23, ey - 0.12, ez - 1.0);
            post.rotation.z = -s * 0.12;
            g.add(post);
            const side = mesh(new T.PlaneGeometry(0.62, 0.42), glassMat(0xa9c4cf, 1, 1), ex + s * 0.5, ey - 0.12, ez - 0.82);
            side.rotation.y = -s * 0.95;
            side.rotation.z = s * 0.15;
            g.add(side);
            ctx.glass.push(side.material);
            const sp = box(0.028, 0.5, 0.028, mats.frame, ex + s * 0.68, ey - 0.14, ez - 0.6);
            sp.rotation.z = -s * 0.32;
            g.add(sp);
            g.add(box(0.05, 0.05, 2.0, mats.frame, ex + s * 0.7, ey - 0.38, ez + 0.3));
            for (let k = 0; k < 6; k++) g.add(box(0.03, 0.42, 0.04, mats.interior, ex + s * 0.68, ey - 0.6, ez - 0.55 + k * 0.28));
            g.add(box(0.02, 0.45, 1.8, mats.interiorDark, ex + s * 0.7, ey - 0.62, ez + 0.2));
        });
        const bow = arch(0.68, 0.04, mats.frame, Math.PI, 1, 0.75);
        bow.position.set(ex, ey - 0.38, ez + 0.45);
        g.add(bow);
        const shell = new T.Mesh(new T.SphereGeometry(1, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2), glassMat(0x9fb8c8, 1, 1));
        shell.scale.set(0.7, 0.55, 1.2);
        shell.position.set(ex, ey - 0.38, ez + 0.1);
        shell.renderOrder = 2;
        g.add(shell);
        ctx.glass.push(shell.material);
        const mirror = box(0.24, 0.07, 0.012, mats.mirror, ex, ey + 0.2, ez - 0.95);
        mirror.rotation.x = 0.3;
        g.add(mirror);
        g.add(box(0.02, 0.08, 0.02, mats.frame, ex, ey + 0.15, ez - 0.97));
        const trim = new T.Mesh(new T.TorusGeometry(0.075, 0.012, 8, 24), mats.dark);
        trim.rotation.y = Math.PI / 2;
        trim.position.set(ex - 0.6, ey - 0.62, ez - 0.25);
        g.add(trim);
        const stick = new T.Group();
        stick.position.set(ex, ey - 1.05, ez - 0.45);
        stick.add(mesh(new T.CylinderGeometry(0.018, 0.026, 0.42, 10), mats.dark, 0, 0.21, 0));
        const spade = new T.Mesh(new T.TorusGeometry(0.06, 0.014, 8, 20), mats.grip);
        spade.position.y = 0.46;
        stick.add(spade);
        stick.add(mesh(new T.CylinderGeometry(0.012, 0.012, 0.03, 8), mats.brass, 0, 0.5, -0.03).rotateX(Math.PI / 2));
        g.add(stick);
        const throttle = new T.Group();
        throttle.position.set(ex - 0.55, ey - 0.7, ez - 0.4);
        throttle.add(box(0.06, 0.04, 0.32, mats.dark, 0, -0.02, 0));
        const lever = new T.Group();
        lever.add(box(0.015, 0.14, 0.015, mats.metal, 0, 0.07, 0));
        lever.add(mesh(new T.SphereGeometry(0.03, 12, 8), mats.red, 0, 0.15, 0));
        throttle.add(lever);
        g.add(throttle);
        ctx.moving = {stick, lever, leverRange: [0.1, -0.12], stickTravel: 0.28};
        ctx.hands = [[stick, 0, 0.46, 0], [lever, 0, 0.16, 0]];
        addTub(ctx, {half: 0.67, floor: 1.38, top: 0.4, front: 0.9, back: 0.6, mat: mats.interiorDark, rib: mats.interior});
        return {panelTex, panel};
    }

    function drawReticle(c) {
        c.clearRect(0, 0, 256, 256);
        c.strokeStyle = "#fff";
        c.fillStyle = "#fff";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(128, 128, 78, 0, Math.PI * 2);
        c.stroke();
        c.beginPath();
        c.arc(128, 128, 4, 0, Math.PI * 2);
        c.fill();
        for (const [a, b] of [[[128, 20], [128, 96]], [[128, 160], [128, 236]], [[20, 128], [96, 128]], [[160, 128], [236, 128]]]) {
            c.beginPath();
            c.moveTo(...a);
            c.lineTo(...b);
            c.stroke();
        }
    }

    function buildBiplane(ctx) {
        const {g, ex, ey, ez, mats} = ctx;
        const panelTex = canvasTex(1024, 384);
        const panel = panelPlane(0.96, 0.36, panelTex.tex, mats.wood, -0.18);
        panel.position.set(ex, ey - 0.6, ez - 0.86);
        g.add(panel);
        [[200, 190, 105], [512, 170, 115], [824, 190, 105], [360, 320, 50], [664, 320, 50]].forEach(([u, v, r]) => bezel(panel, 1024, 384, u, v, r, mats.brass, ctx.gaugeGlass));
        const rim = new T.Mesh(new T.TorusGeometry(0.62, 0.065, 12, 40), mats.leather);
        rim.rotation.x = Math.PI / 2;
        rim.scale.set(1, 1.45, 1);
        rim.position.set(ex, ey - 0.5, ez - 0.05);
        g.add(rim);
        for (let k = 0; k < 24; k++) {
            const a = k / 24 * Math.PI * 2;
            g.add(mesh(new T.SphereGeometry(0.011, 6, 4), mats.brass, ex + Math.cos(a) * 0.62, ey - 0.44, ez - 0.05 + Math.sin(a) * 0.9));
        }
        const ws = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.24, 24, 1, true, -0.7, 1.4), glassMat(0xc9dde6, 1.2, 1.3));
        ws.rotation.y = Math.PI;
        ws.position.set(ex, ey - 0.2, ez - 0.55);
        g.add(ws);
        ctx.glass.push(ws.material);
        const wsFrame = new T.Mesh(new T.TorusGeometry(0.42, 0.012, 6, 24, 1.4), mats.brass);
        wsFrame.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.7 + Math.PI);
        wsFrame.position.set(ex, ey - 0.08, ez - 0.55);
        g.add(wsFrame);
        [-1, 1].forEach(s => {
            const gun = new T.Group();
            gun.position.set(ex + s * 0.17, ey - 0.26, ez - 1.05);
            gun.add(box(0.11, 0.12, 0.34, mats.gunmetal, 0, 0, 0.12));
            const jacket = cyl(0.05, 0.05, 0.9, mats.gunmetal, 14);
            jacket.rotation.x = Math.PI / 2;
            jacket.position.z = -0.48;
            gun.add(jacket);
            for (let k = 0; k < 6; k++) {
                const ring = new T.Mesh(new T.TorusGeometry(0.052, 0.006, 6, 14), mats.dark);
                ring.position.z = -0.15 - k * 0.13;
                gun.add(ring);
            }
            gun.add(box(0.02, 0.05, 0.08, mats.brass, s * 0.07, 0.02, 0.2));
            gun.add(box(0.08, 0.02, 0.06, mats.dark, 0, 0.07, 0.25));
            g.add(gun);
        });
        const stick = new T.Group();
        stick.position.set(ex, ey - 1.1, ez - 0.4);
        stick.add(mesh(new T.CylinderGeometry(0.016, 0.022, 0.48, 10), mats.wood, 0, 0.24, 0));
        const spade = new T.Mesh(new T.TorusGeometry(0.06, 0.013, 8, 20), mats.leather);
        spade.position.y = 0.52;
        stick.add(spade);
        g.add(stick);
        const throttle = new T.Group();
        throttle.position.set(ex - 0.5, ey - 0.62, ez - 0.35);
        const lever = new T.Group();
        lever.add(box(0.014, 0.12, 0.014, mats.brass, 0, 0.06, 0));
        lever.add(mesh(new T.SphereGeometry(0.022, 10, 8), mats.wood, 0, 0.13, 0));
        throttle.add(lever);
        g.add(throttle);
        ctx.moving = {stick, lever, leverRange: [0.1, -0.1], stickTravel: 0.3};
        ctx.hands = [[stick, 0, 0.52, 0], [lever, 0, 0.14, 0]];
        addTub(ctx, {half: 0.58, floor: 1.4, top: 0.48, front: 0.85, back: 0.75, mat: mats.fabric, rib: mats.wood, floorMat: mats.wood});
        return {panelTex, panel, wood: true};
    }

    function limb(a, b, r, mat) {
        const dir = b.clone().sub(a), len = dir.length();
        const m = new T.Mesh(new T.CapsuleGeometry(r, Math.max(0.01, len - 2 * r), 4, 12), mat);
        m.position.copy(a).add(b).multiplyScalar(0.5);
        m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
        return m;
    }

    function addTub(ctx, o) {
        const {g, ex, ey, ez, mats} = ctx;
        const wall = o.mat, w = o.half, y0 = ey - o.floor, y1 = ey - o.top, z0 = ez - o.front, z1 = ez + o.back;
        const h = y1 - y0, len = z1 - z0;
        [-1, 1].forEach(s => {
            g.add(box(0.03, h, len, wall, ex + s * w, y0 + h / 2, z0 + len / 2));
            for (let k = 1; k < 5; k++) g.add(box(0.035, h * 0.92, 0.035, o.rib || wall, ex + s * (w - 0.025), y0 + h / 2, z0 + len * k / 5));
            g.add(box(0.035, 0.035, len, o.rib || wall, ex + s * (w - 0.025), y0 + h * 0.62, z0 + len / 2));
        });
        g.add(box(w * 2, 0.03, len + 0.12, o.floorMat || wall, ex, y0, z0 + len / 2 - 0.06));
        g.add(box(w * 2, h * 0.75, 0.03, wall, ex, y0 + h * 0.375, z0 - 0.12));
        g.add(box(w * 2, h, 0.03, wall, ex, y0 + h / 2, z1));
        [-1, 1].forEach(s => {
            const pedal = box(0.1, 0.16, 0.03, mats.metal, ex + s * 0.17, y0 + 0.12, ez - o.front + 0.22);
            pedal.rotation.x = -0.5;
            g.add(pedal);
            g.add(box(0.03, 0.03, 0.2, mats.dark, ex + s * 0.17, y0 + 0.06, ez - o.front + 0.32));
        });
    }

    function addPilot(ctx, skin) {
        const {g, ex, ey, ez} = ctx;
        const suit = std(skin && skin.pants || "#4a4f3a", 0.85, 0), glove = std(skin && skin.gloves || "#3b2a1a", 0.7, 0);
        const boot = std(0x1c1c1c, 0.6, 0.1);
        const parts = [];
        [-1, 1].forEach(s => {
            const hip = new T.Vector3(ex + s * 0.13, ey - 0.98, ez + 0.05);
            const knee = new T.Vector3(ex + s * 0.16, ey - 0.86, ez - 0.4);
            const foot = new T.Vector3(ex + s * 0.17, ey - 1.26, ez - 0.68);
            const thigh = limb(hip, knee, 0.08, suit), shin = limb(knee, foot, 0.065, suit);
            g.add(thigh, shin);
            const b = box(0.1, 0.09, 0.22, boot, foot.x, foot.y - 0.02, foot.z - 0.06);
            g.add(b);
            parts.push(thigh, shin, b);
        });
        ctx.hands.forEach(([obj, x, y, z]) => {
            const h = mesh(new T.SphereGeometry(0.048, 12, 8), glove, x, y, z + 0.01);
            h.scale.set(1, 0.85, 1.25);
            obj.add(h);
            parts.push(h);
        });
        ctx.suitMat = suit;
        ctx.gloveMat = glove;
        return parts;
    }

    function drawJetPanel(cp, plane, d, info) {
        const c = cp.panelTex.ctx;
        if (!cp.panelBase) {
            const base = document.createElement("canvas");
            base.width = 1024;
            base.height = 512;
            const b = base.getContext("2d");
            const grad = b.createLinearGradient(0, 0, 0, 512);
            grad.addColorStop(0, "#3a3f45");
            grad.addColorStop(1, "#24282c");
            b.fillStyle = grad;
            b.fillRect(0, 0, 1024, 512);
            b.strokeStyle = "rgba(0,0,0,0.6)";
            b.lineWidth = 3;
            for (const [x, y, w, h] of [[20, 20, 300, 470], [704, 20, 300, 470], [330, 20, 364, 200], [330, 230, 364, 260]]) b.strokeRect(x, y, w, h);
            screws(b, 1024, 512, 64);
            label(b, "MASTER", 400, 52, 13, "#ddd");
            label(b, "CAUTION", 400, 68, 13, "#ddd");
            label(b, "STBY", 512, 236, 12, "#bbb");
            cp.panelBase = base;
        }
        c.drawImage(cp.panelBase, 0, 0);
        const warn = (x, y, text, on, colOn) => {
            c.fillStyle = on ? colOn : "#3a2a12";
            c.fillRect(x - 46, y - 14, 92, 28);
            label(c, text, x, y, 13, on ? "#111" : "#6b5a3a");
        };
        const blink = Math.floor(info.time * 3) % 2 === 0;
        warn(400, 96, "CAUTION", plane.health < plane.maxHealth * 0.5, "#ffb000");
        warn(624, 52, "FIRE", !!plane.burning && blink, "#ff3b2a");
        warn(624, 96, "STALL", !!plane.stalling, "#ff3b2a");
        warn(624, 140, "LOCK", !!(info.lock && info.lock.target && info.lock.progress >= 1), "#ffd23f");
        warn(400, 140, "MSL", info.threat === "missile" && blink, "#ff3b2a");
        warn(400, 184, "LOW ALT", d.alt < 300, "#ffb000");
        warn(624, 184, "AB", !!plane.boosting, "#7dff9a");
        dialFace(c, 512, 300, 62, {face: "#0c0c0c", ticks: 0, minor: 1});
        attitude(c, 512, 300, 58, d.pitch, d.roll);
        dialFace(c, 440, 432, 40, {ticks: 8, minor: 2, title: "KTS", nums: null});
        needle(c, 440, 432, Math.PI * 0.75 + Math.min(1, plane.speed / (plane.topSpeed * 1.4)) * Math.PI * 1.5, 34, 3, "#fff");
        dialFace(c, 584, 432, 40, {ticks: 10, minor: 1, from: -Math.PI / 2, sweep: Math.PI * 2, title: "ALT"});
        needle(c, 584, 432, -Math.PI / 2 + (d.alt % 1000) / 1000 * Math.PI * 2, 34, 3, "#fff");
        cp.panelTex.tex.needsUpdate = true;
    }

    function drawMfdRadar(t, plane, info) {
        const c = t.ctx, W = 512;
        c.fillStyle = "#030805";
        c.fillRect(0, 0, W, W);
        c.strokeStyle = "#1fd36a";
        c.fillStyle = "#1fd36a";
        c.lineWidth = 2;
        const ox = 256, oy = 440, R = 380, range = 8000;
        for (const k of [0.25, 0.5, 0.75, 1]) {
            c.beginPath();
            c.arc(ox, oy, R * k, Math.PI * 1.2, Math.PI * 1.8);
            c.stroke();
        }
        for (const a of [-0.3, 0, 0.3]) {
            c.beginPath();
            c.moveTo(ox, oy);
            c.lineTo(ox + Math.sin(a * Math.PI) * R, oy - Math.cos(a * Math.PI) * R);
            c.stroke();
        }
        const sweep = Math.sin(info.time * 1.6) * 0.3 * Math.PI;
        c.strokeStyle = "rgba(31,211,106,0.55)";
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(ox, oy);
        c.lineTo(ox + Math.sin(sweep) * R, oy - Math.cos(sweep) * R);
        c.stroke();
        const inv = plane.quat.clone().invert(), v = new T.Vector3();
        for (const p of info.planes || []) {
            if (p === plane || !p.alive) continue;
            v.copy(p.pos).sub(plane.pos).applyQuaternion(inv);
            if (v.z > 0) continue;
            const dist = Math.hypot(v.x, v.z);
            if (dist > range) continue;
            const x = ox + v.x / range * R, y = oy + v.z / range * R;
            const friend = plane.team && p.team === plane.team;
            c.fillStyle = friend ? "#38b6ff" : "#ff5a4a";
            c.strokeStyle = c.fillStyle;
            if (friend) {
                c.beginPath();
                c.arc(x, y, 9, Math.PI, 0);
                c.stroke();
            } else c.fillRect(x - 8, y - 8, 16, 16);
            if (info.lock && info.lock.target === p) {
                c.strokeStyle = "#ffd23f";
                c.lineWidth = 3;
                c.strokeRect(x - 15, y - 15, 30, 30);
                label(c, `${(dist / 1000).toFixed(1)}`, x, y - 26, 18, "#ffd23f");
                c.lineWidth = 2;
            }
        }
        c.fillStyle = "#1fd36a";
        c.beginPath();
        c.moveTo(ox, oy - 14);
        c.lineTo(ox - 10, oy + 8);
        c.lineTo(ox + 10, oy + 8);
        c.fill();
        ["RWS", "8", "A4", "CRM", "FCR"].forEach((s, i) => label(c, s, 70 + i * 93, 26, 20, "#1fd36a"));
        ["SWAP", "DCLT", "SMS", "TGP", "HSD"].forEach((s, i) => label(c, s, 70 + i * 93, 492, 18, "#1fd36a"));
        t.tex.needsUpdate = true;
    }

    function drawMfdSystems(t, plane, info) {
        const c = t.ctx, W = 512;
        c.fillStyle = "#030805";
        c.fillRect(0, 0, W, W);
        const g = "#1fd36a";
        label(c, "ENGINE", 256, 30, 22, g);
        const rpm = plane.boosting ? 103 : 68 + 32 * plane.throttle;
        c.strokeStyle = "#0d4a28";
        c.lineWidth = 16;
        c.beginPath();
        c.arc(140, 160, 80, Math.PI * 0.75, Math.PI * 2.25);
        c.stroke();
        c.strokeStyle = plane.boosting ? "#ffb000" : g;
        c.beginPath();
        c.arc(140, 160, 80, Math.PI * 0.75, Math.PI * 0.75 + Math.min(1, rpm / 105) * Math.PI * 1.5);
        c.stroke();
        label(c, `${Math.round(rpm)}%`, 140, 160, 30, "#fff");
        label(c, "RPM", 140, 196, 16, g);
        const ftit = Math.round(620 + 280 * plane.throttle + (plane.boosting ? 120 : 0));
        label(c, "FTIT", 360, 110, 18, g);
        label(c, String(ftit), 360, 140, 30, "#fff");
        label(c, "NOZ", 360, 190, 18, g);
        label(c, `${plane.boosting ? 92 : Math.round(10 + 20 * (1 - plane.throttle))}%`, 360, 220, 28, "#fff");
        c.strokeStyle = g;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(20, 262);
        c.lineTo(492, 262);
        c.stroke();
        label(c, "STORES", 256, 290, 22, g);
        const mis = Math.max(0, plane.missiles || 0), maxM = plane.maxMissiles || 2;
        for (let i = 0; i < maxM; i++) {
            const x = 80 + i * 70, on = i < mis;
            c.fillStyle = on ? "#fff" : "#2a3a30";
            c.fillRect(x - 6, 320, 12, 70);
            c.beginPath();
            c.moveTo(x - 6, 320);
            c.lineTo(x, 300);
            c.lineTo(x + 6, 320);
            c.fill();
        }
        label(c, `GUN ${plane.ammo || 0}`, 380, 330, 22, "#fff");
        label(c, `FLR ${plane.flares || 0}`, 380, 365, 22, "#fff");
        const hp = Math.max(0, Math.round(100 * plane.health / plane.maxHealth));
        label(c, "AIRFRAME", 120, 440, 18, g);
        c.fillStyle = "#0d4a28";
        c.fillRect(200, 428, 280, 24);
        c.fillStyle = hp > 60 ? g : hp > 30 ? "#ffb000" : "#ff3b2a";
        c.fillRect(200, 428, 2.8 * hp, 24);
        label(c, `${hp}%`, 340, 440, 18, "#000");
        t.tex.needsUpdate = true;
    }

    function drawDed(t, plane, d, info) {
        const c = t.ctx;
        c.fillStyle = "#020602";
        c.fillRect(0, 0, 512, 160);
        c.fillStyle = "#b8ff3a";
        c.font = "bold 30px 'Courier New', monospace";
        c.textAlign = "left";
        c.textBaseline = "top";
        const mm = Math.floor((info.timeLeft || 0) / 60), ss = Math.floor((info.timeLeft || 0) % 60);
        c.fillText(`UHF 305.00  STPT  1`, 18, 12);
        c.fillText(`SPD ${String(Math.round(d.kmh)).padStart(4)}  ALT ${String(Math.round(d.alt)).padStart(5)}`, 18, 58);
        c.fillText(`G ${plane.g.toFixed(1)}  HDG ${String(Math.round(d.heading)).padStart(3, "0")}  ${mm}:${String(ss).padStart(2, "0")}`, 18, 104);
        t.tex.needsUpdate = true;
    }

    function drawHud(cp, plane, d, info) {
        const h = cp.hud, c = h.tex.ctx, W = 512;
        c.clearRect(0, 0, W, W);
        c.strokeStyle = "#fff";
        c.fillStyle = "#fff";
        c.lineWidth = 2.5;
        const inv = plane.quat.clone().invert(), eyeY = cp.eyeY, v = new T.Vector3();
        const toHud = dir => {
            v.copy(dir).applyQuaternion(inv);
            if (v.z > -0.05) return null;
            const x = h.d * v.x / -v.z, y = h.d * v.y / -v.z + (eyeY - h.cy);
            return [(x / h.w + 0.5) * W, (0.5 - y / h.h) * W];
        };
        const hd = Math.atan2(plane.forward.x, -plane.forward.z);
        const dirAt = (head, el) => new T.Vector3(Math.sin(head) * Math.cos(el), Math.sin(el), -Math.cos(head) * Math.cos(el));
        c.save();
        c.beginPath();
        c.rect(20, 40, W - 40, W - 80);
        c.clip();
        for (let deg = -60; deg <= 60; deg += 5) {
            const el = deg * Math.PI / 180;
            const a = toHud(dirAt(hd - 0.07, el)), b = toHud(dirAt(hd + 0.07, el));
            if (!a || !b) continue;
            c.setLineDash(deg < 0 ? [10, 8] : []);
            if (deg === 0) {
                const a2 = toHud(dirAt(hd - 0.45, 0)), b2 = toHud(dirAt(hd + 0.45, 0));
                if (a2 && b2) {
                    c.beginPath();
                    c.moveTo(...a2);
                    c.lineTo(a[0] - (b[0] - a[0]) * 0.25, a[1] - (b[1] - a[1]) * 0.25);
                    c.moveTo(b[0] + (b[0] - a[0]) * 0.25, b[1] + (b[1] - a[1]) * 0.25);
                    c.lineTo(...b2);
                    c.stroke();
                }
                continue;
            }
            const gap = 0.3;
            c.beginPath();
            c.moveTo(...a);
            c.lineTo(a[0] + (b[0] - a[0]) * (0.5 - gap / 2), a[1] + (b[1] - a[1]) * (0.5 - gap / 2));
            c.moveTo(a[0] + (b[0] - a[0]) * (0.5 + gap / 2), a[1] + (b[1] - a[1]) * (0.5 + gap / 2));
            c.lineTo(...b);
            const nx = -(b[1] - a[1]), ny = b[0] - a[0], nl = Math.hypot(nx, ny) || 1, tick = deg > 0 ? 10 : -10;
            c.moveTo(...a);
            c.lineTo(a[0] + nx / nl * tick, a[1] + ny / nl * tick);
            c.moveTo(...b);
            c.lineTo(b[0] + nx / nl * tick, b[1] + ny / nl * tick);
            c.stroke();
            c.setLineDash([]);
            label(c, String(Math.abs(deg)), b[0] + 18, b[1], 15, "#fff");
        }
        c.restore();
        c.setLineDash([]);
        const bore = toHud(plane.forward.clone());
        if (bore) {
            const [x, y] = bore;
            c.beginPath();
            c.moveTo(x - 14, y);
            c.lineTo(x - 5, y);
            c.moveTo(x + 5, y);
            c.lineTo(x + 14, y);
            c.moveTo(x, y - 14);
            c.lineTo(x, y - 5);
            c.stroke();
            const aoa = Math.min(0.12, 0.01 + Math.max(0, plane.g - 1) * 0.012);
            const fpm = toHud(plane.forward.clone().applyAxisAngle(plane.right, -aoa));
            if (fpm) {
                c.beginPath();
                c.arc(fpm[0], fpm[1], 9, 0, Math.PI * 2);
                c.moveTo(fpm[0] - 9, fpm[1]);
                c.lineTo(fpm[0] - 22, fpm[1]);
                c.moveTo(fpm[0] + 9, fpm[1]);
                c.lineTo(fpm[0] + 22, fpm[1]);
                c.moveTo(fpm[0], fpm[1] - 9);
                c.lineTo(fpm[0], fpm[1] - 18);
                c.stroke();
            }
        }
        const head = d.heading;
        c.save();
        c.beginPath();
        c.rect(126, 30, 260, 50);
        c.clip();
        for (let k = Math.floor(head / 5) * 5 - 25; k <= head + 25; k += 5) {
            const x = 256 + (k - head) * 5.2;
            c.beginPath();
            c.moveTo(x, 70);
            c.lineTo(x, k % 10 ? 62 : 54);
            c.stroke();
            if (k % 10 === 0) label(c, String(((k % 360) + 360) % 360 / 10 | 0).padStart(2, "0"), x, 42, 15, "#fff");
        }
        c.restore();
        c.beginPath();
        c.moveTo(256, 74);
        c.lineTo(250, 84);
        c.lineTo(262, 84);
        c.closePath();
        c.stroke();
        c.strokeRect(36, 236, 78, 30);
        label(c, String(Math.round(d.kmh)), 75, 251, 20, "#fff");
        c.strokeRect(398, 236, 84, 30);
        label(c, String(Math.round(d.alt)), 440, 251, 20, "#fff");
        label(c, `G ${plane.g.toFixed(1)}`, 60, 300, 17, "#fff", "left");
        label(c, `M ${(plane.speed / 340).toFixed(2)}`, 60, 324, 17, "#fff", "left");
        label(c, `VV ${Math.round(d.climb)}`, 398, 300, 17, "#fff", "left");
        label(c, `ARM  AIM-9 x${Math.max(0, plane.missiles || 0)}`, 60, 448, 16, "#fff", "left");
        label(c, `GUN ${plane.ammo || 0}`, 60, 470, 16, "#fff", "left");
        if (info.lock && info.lock.target && info.lock.target.alive) {
            const tp = toHud(info.lock.target.pos.clone().sub(plane.pos).normalize());
            const locked = info.lock.progress >= 1;
            if (tp) {
                c.lineWidth = 3;
                if (locked) c.strokeRect(tp[0] - 18, tp[1] - 18, 36, 36);
                else {
                    c.beginPath();
                    c.arc(tp[0], tp[1], 22 + 20 * (1 - info.lock.progress), 0, Math.PI * 2);
                    c.stroke();
                }
                const dist = info.lock.target.pos.distanceTo(plane.pos);
                label(c, `${(dist / 1000).toFixed(1)}`, tp[0], tp[1] + 34, 15, "#fff");
            }
            label(c, locked ? "LOCK" : "TRACK", 256, 420, 22, "#fff");
        }
        if (info.threat === "missile" && Math.floor(info.time * 4) % 2 === 0) label(c, "BREAK", 256, 380, 28, "#fff");
        if (plane.stalling) label(c, "STALL", 256, 360, 26, "#fff");
        h.tex.tex.needsUpdate = true;
    }

    function drawPropPanel(cp, plane, d) {
        const c = cp.panelTex.ctx;
        if (!cp.panelBase) {
            const base = document.createElement("canvas");
            base.width = 1024;
            base.height = 512;
            const b = base.getContext("2d");
            b.fillStyle = "#16171a";
            b.fillRect(0, 0, 1024, 512);
            for (let i = 0; i < 9000; i++) {
                b.fillStyle = Math.random() < 0.5 ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.12)";
                b.fillRect(Math.random() * 1024, Math.random() * 512, 2, 2);
            }
            screws(b, 1024, 512, 85);
            [["AIR SPEED", 230, 52], ["ARTIFICIAL HORIZON", 512, 52], ["ALTIMETER", 794, 52], ["R.P.M.", 230, 472], ["TURN & SLIP", 512, 472], ["BOOST", 794, 472], ["OIL °C", 90, 230], ["FUEL", 934, 230]]
                .forEach(([t, x, y]) => {
                    b.fillStyle = "#e8dfc4";
                    b.fillRect(x - t.length * 5 - 8, y - 11, t.length * 10 + 16, 22);
                    label(b, t, x, y, 13, "#111");
                });
            cp.panelBase = base;
        }
        c.drawImage(cp.panelBase, 0, 0);
        const ink = "#f2ead2";
        dialFace(c, 230, 170, 88, {ticks: 10, minor: 5, nums: ["0", "100", "200", "300", "400", "500"], title: "KM/H", ink});
        needle(c, 230, 170, Math.PI * 0.75 + Math.min(1, d.kmh / 500) * Math.PI * 1.5, 78, 4, "#fff");
        dialFace(c, 512, 170, 88, {ticks: 0, minor: 1});
        attitude(c, 512, 170, 84, d.pitch, d.roll, "#3b5a7a", "#3a2a1a");
        dialFace(c, 794, 170, 88, {ticks: 10, minor: 5, from: -Math.PI / 2, sweep: Math.PI * 2, nums: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ""], ink});
        needle(c, 794, 170, -Math.PI / 2 + (d.alt % 1000) / 1000 * Math.PI * 2, 76, 4, "#fff");
        needle(c, 794, 170, -Math.PI / 2 + (d.alt % 10000) / 10000 * Math.PI * 2, 50, 7, "#d8d0b8");
        const rpm = plane.boosting ? 3000 : 1600 + 1300 * plane.throttle;
        dialFace(c, 230, 380, 78, {ticks: 6, minor: 5, nums: ["0", "1", "2", "3", "4", "5", ""], title: "x1000", ink, bands: [[0.4, 0.56, "#3ccf5a"], [0.6, 0.72, "#ff3b2a"]]});
        needle(c, 230, 380, Math.PI * 0.75 + rpm / 6000 * Math.PI * 1.5, 68, 4, "#fff");
        dialFace(c, 512, 380, 78, {ticks: 0, minor: 1, ink});
        const turn = Math.max(-1, Math.min(1, Math.sin(d.roll) * plane.g * 0.6));
        needle(c, 512, 380, -Math.PI / 2 + turn * 0.9, 62, 5, "#fff", 0.05);
        c.strokeStyle = ink;
        c.lineWidth = 3;
        c.beginPath();
        c.arc(512, 300, 140, Math.PI * 0.42, Math.PI * 0.58);
        c.stroke();
        c.fillStyle = "#101010";
        c.beginPath();
        c.arc(512 + Math.cos(Math.PI / 2 - turn * 0.06) * 140, 300 + Math.sin(Math.PI / 2 - turn * 0.06) * 140, 9, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = ink;
        c.stroke();
        dialFace(c, 794, 380, 78, {ticks: 8, minor: 2, nums: ["-4", "0", "+4", "+8", "+12"], title: "LBS", ink});
        needle(c, 794, 380, Math.PI * 0.75 + (0.2 + 0.7 * plane.throttle + (plane.boosting ? 0.1 : 0)) * Math.PI * 1.5, 68, 4, "#fff");
        dialFace(c, 90, 300, 48, {ticks: 4, minor: 2, ink});
        needle(c, 90, 300, Math.PI * 0.75 + (0.45 + 0.25 * plane.throttle) * Math.PI * 1.5, 40, 3, "#fff");
        dialFace(c, 934, 300, 48, {ticks: 4, minor: 2, ink});
        needle(c, 934, 300, Math.PI * 0.75 + 0.7 * Math.PI * 1.5, 40, 3, "#fff");
        cp.panelTex.tex.needsUpdate = true;
    }

    function drawBiPanel(cp, plane, d) {
        const c = cp.panelTex.ctx, W = 1024, H = 384;
        if (!cp.panelBase) {
            const base = document.createElement("canvas");
            base.width = W;
            base.height = H;
            const b = base.getContext("2d");
            const grad = b.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, "#7a4a24");
            grad.addColorStop(1, "#5a3418");
            b.fillStyle = grad;
            b.fillRect(0, 0, W, H);
            for (let i = 0; i < 70; i++) {
                const y = Math.random() * H;
                b.strokeStyle = `rgba(${Math.random() < 0.5 ? "40,20,8" : "150,95,50"},${0.15 + Math.random() * 0.2})`;
                b.lineWidth = 1 + Math.random() * 3;
                b.beginPath();
                b.moveTo(0, y);
                for (let x = 0; x <= W; x += 64) b.lineTo(x, y + Math.sin(x / 90 + i) * 6);
                b.stroke();
            }
            [[360, 40, "MAG 1"], [664, 40, "MAG 2"]].forEach(([x, y, t]) => {
                b.fillStyle = "#c9a03a";
                b.fillRect(x - 40, y - 12, 80, 24);
                label(b, t, x, y, 14, "#2a1a08");
            });
            cp.panelBase = base;
        }
        c.drawImage(cp.panelBase, 0, 0);
        const face = "#f0e6c8", ink = "#1a140c";
        dialFace(c, 200, 190, 100, {face, ink, ticks: 8, minor: 5, nums: ["0", "50", "100", "150", "200", "250", "300", "350", ""], title: "KM/H"});
        needle(c, 200, 190, Math.PI * 0.75 + Math.min(1, d.kmh / 320) * Math.PI * 1.5, 86, 4, "#111");
        dialFace(c, 512, 170, 110, {face, ink, ticks: 8, minor: 5, nums: ["0", "4", "8", "12", "16", "20", "24", "28", ""], title: "R.P.M. x100"});
        needle(c, 512, 170, Math.PI * 0.75 + (plane.boosting ? 0.95 : 0.35 + 0.55 * plane.throttle) * Math.PI * 1.5, 96, 5, "#111");
        dialFace(c, 824, 190, 100, {face, ink, ticks: 10, minor: 5, from: -Math.PI / 2, sweep: Math.PI * 2, nums: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", ""], title: "ALT x100M"});
        needle(c, 824, 190, -Math.PI / 2 + (d.alt % 1000) / 1000 * Math.PI * 2, 84, 4, "#111");
        dialFace(c, 360, 320, 46, {face: "#202a30", ink: "#eee", ticks: 0, minor: 1});
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
        c.fillStyle = `rgba(200,140,40,${0.4 + 0.5 * pulse * plane.throttle})`;
        c.beginPath();
        c.arc(360, 320, 26, 0, Math.PI * 2);
        c.fill();
        label(c, "OIL", 360, 320, 13, "#fff");
        dialFace(c, 664, 320, 46, {face: "#e8e0c8", ink, ticks: 0, minor: 1});
        c.save();
        c.translate(664, 320);
        c.rotate(-d.heading * Math.PI / 180);
        ["N", "E", "S", "W"].forEach((t, i) => {
            const a = -Math.PI / 2 + i * Math.PI / 2;
            label(c, t, Math.cos(a) * 30, Math.sin(a) * 30, 15, t === "N" ? "#b01010" : ink);
        });
        c.restore();
        c.strokeStyle = "#b01010";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(664, 286);
        c.lineTo(664, 300);
        c.stroke();
        cp.panelTex.tex.needsUpdate = true;
    }

    D.buildCockpit = function (shape, color, eye, opts = {}) {
        T = D.THREE;
        const g = new T.Group();
        const [ex, ey, ez] = eye;
        const mats = {
            panel: std(0x2a2e33, 0.8, 0.2), bezel: std(0x1a1c1f, 0.5, 0.4), button: std(0x3a3d42, 0.6, 0.3),
            glare: std(0x15171a, 0.95, 0), console: std(0x2a2e33, 0.8, 0.2), pad: std(0x2b2b28, 0.9, 0),
            frame: std(new T.Color(color).multiplyScalar(0.35).getHex(), 0.6, 0.3), mirror: std(0xffffff, 0.04, 1),
            metal: std(0x8c9096, 0.35, 0.85), dark: std(0x1e2124, 0.6, 0.4), grip: std(0x18191b, 0.9, 0),
            red: std(0xc8202a, 0.5, 0.1), white: std(0xeeeeee, 0.6, 0), knob: std(0x111214, 0.5, 0.2),
            interior: std(0x6b7558, 0.85, 0.05), interiorDark: std(0x4a523e, 0.9, 0.05), brass: std(0xb58a3a, 0.35, 0.9),
            wood: std(0x6a3e1c, 0.65, 0), leather: std(0x5a3518, 0.75, 0), gunmetal: std(0x2b2e31, 0.45, 0.8),
            tub: std(0x33383d, 0.85, 0.15), fabric: std(new T.Color(color).multiplyScalar(0.55).getHex(), 0.9, 0),
        };
        const ctx = {g, ex, ey, ez, mats, color, glass: [], gaugeGlass: glassMat(0xbcd4e0, 0.9, 0.35)};
        ctx.glass.push(ctx.gaugeGlass);
        const kind = shape === "jet" || shape === "bomber" ? "jet" : shape === "prop" ? "prop" : "bi";
        const parts = kind === "jet" ? buildJet(ctx) : kind === "prop" ? buildProp(ctx) : buildBiplane(ctx);
        addPilot(ctx, opts.skin);
        if (D.shadows) g.traverse(o => {
            if (o.isMesh && !(o.material && o.material.isShaderMaterial)) o.castShadow = o.receiveShadow = true;
        });
        const cp = Object.assign({group: g, kind, eyeY: ey, frame: 0}, parts);
        cp.setSkin = skin => {
            if (skin && skin.pants) ctx.suitMat.color.set(skin.pants);
            if (skin && skin.gloves) ctx.gloveMat.color.set(skin.gloves);
        };
        cp.update = (plane, info = {}) => {
            const m = ctx.moving, i = plane.input || {}, k = Math.min(1, 0.2 + (info.dt || 0.016) * 12);
            const travel = m.stickTravel || 0.22;
            m.stick.rotation.x += ((i.pitch || 0) * -travel - m.stick.rotation.x) * k;
            m.stick.rotation.z += ((i.roll || 0) * -travel - m.stick.rotation.z) * k;
            const [z0, z1] = m.leverRange;
            m.lever.position.z = z0 + (z1 - z0) * (plane.boosting ? 1 : plane.throttle * 0.85);
            if (info.sky) {
                const s = info.sky, dir = new T.Vector3(...s.sun).normalize();
                for (const mat of ctx.glass) {
                    mat.uniforms.sunDir.value.copy(dir);
                    mat.uniforms.sunColor.value.set(s.sunColor).multiplyScalar(s.sunI || 1);
                    mat.uniforms.sky.value.set(s.horizon);
                }
            }
            const d = flightData(plane);
            const f = cp.frame++;
            if (kind === "jet") {
                drawHud(cp, plane, d, info);
                if (f % 4 === 0) drawMfdRadar(cp.mfds[0], plane, info);
                if (f % 4 === 1) drawMfdSystems(cp.mfds[1], plane, info);
                if (f % 4 === 2) drawJetPanel(cp, plane, d, info);
                if (f % 8 === 3) drawDed(cp.dedTex, plane, d, info);
            } else if (f % 2 === 0) {
                if (kind === "prop") drawPropPanel(cp, plane, d);
                else drawBiPanel(cp, plane, d);
            }
        };
        return cp;
    };
})();
