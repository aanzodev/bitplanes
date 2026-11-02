// Dogfights (3D): plane models, cockpits and flight. Every plane is built
// from simple shapes in its Hangar colors: biplane, propeller fighter, jet
// (twin tails for the big ones, the A-10's own shape) or the B-2 flying wing,
// with navigation lights. The cockpit view has a working instrument panel.
//
// Flight is arcade with real energy: planes turn best near their corner speed,
// hard turns bleed speed, climbing costs speed and diving gains it, too slow
// stalls, and the afterburner (or a prop's emergency power) gives a burst.
(function () {
    const D = window.BitDogfight = window.BitDogfight || {};

    // Speeds by shape in m/s (before the plane's own engine), and how big it is.
    const SHAPES = {
        "": {top: 80, min: 32, radius: 9, roll: 2.2, pitch: 1.0, eye: [0, 1.95, 1.6], boost: 1.18},
        prop: {top: 125, min: 45, radius: 9, roll: 2.3, pitch: 0.8, eye: [0, 1.45, -0.9], boost: 1.2},
        jet: {top: 210, min: 65, radius: 10, roll: 2.5, pitch: 0.64, eye: [0, 1.35, -3.6], boost: 1.35},
        bomber: {top: 180, min: 60, radius: 16, roll: 1.3, pitch: 0.46, eye: [0, 2.3, -5.6], boost: 1.25},
    };
    const TWIN_TAIL = ["f15", "f22", "su27", "mig29", "f35"];

    function shade(hex, f) {
        return new D.THREE.Color(hex).multiplyScalar(f);
    }

    // Paint: physically based with sky reflections on High/Ultra (D.pbr),
    // simple flat shading otherwise.
    function lambert(color) {
        if (D.pbr) return new D.THREE.MeshStandardMaterial({color, roughness: 0.5, metalness: 0.28});
        return new D.THREE.MeshLambertMaterial({color, flatShading: true});
    }

    // Unlit glowing things (flames, lights) are extra bright on High/Ultra so they bloom.
    function glowColor(hex, k = 1) {
        return new D.THREE.Color(hex).multiplyScalar(1 + ((D.glow || 1) - 1) * k);
    }

    // A smooth body of revolution along the plane's length: [[z, radius], ...].
    function lathe(profile, mat, segments = 18) {
        const T = D.THREE;
        const g = new T.LatheGeometry(profile.map(([z, r]) => new T.Vector2(r, -z)), segments);
        g.rotateX(-Math.PI / 2);
        return new T.Mesh(g, mat);
    }

    // A flat shape in the x/z plane (points as [x, z]), given some thickness.
    function slab(points, thick) {
        const T = D.THREE, s = new T.Shape();
        points.forEach(([x, z], i) => (i ? s.lineTo(x, z) : s.moveTo(x, z)));
        const g = new T.ExtrudeGeometry(s, {depth: thick, bevelEnabled: false});
        g.rotateX(Math.PI / 2);
        g.translate(0, thick / 2, 0);
        return g;
    }

    function box(w, h, l, mat, x = 0, y = 0, z = 0) {
        const m = new D.THREE.Mesh(new D.THREE.BoxGeometry(w, h, l), mat);
        m.position.set(x, y, z);
        return m;
    }

    function light(color, x, y, z, size = 0.35) {
        const m = new D.THREE.Mesh(new D.THREE.SphereGeometry(size, 6, 4), new D.THREE.MeshBasicMaterial({color: glowColor(color, 1.5)}));
        m.position.set(x, y, z);
        return m;
    }

    // Forward is -Z, up is +Y, right is +X.
    function buildModel(shape, color, planeId) {
        const T = D.THREE, g = new T.Group();
        const body = lambert(color), dark = lambert(shade(color, 0.6)), glass = D.pbr
            ? new T.MeshStandardMaterial({color: 0x24384a, roughness: 0.05, metalness: 0.9, transparent: true, opacity: 0.85, envMapIntensity: 1.8})
            : new T.MeshPhongMaterial({color: 0x6fa8c8, shininess: 90, transparent: true, opacity: 0.75});
        const metal = lambert(0x3a3a3a), under = lambert(shade(color, 0.85));
        let prop = null, burners = [], canopy = null, tips = [[-8, 0, 2], [8, 0, 2]], tail = [0, 2, 7];
        const propeller = (z, blades, r = 3.5) => {
            prop = new T.Group();
            for (let i = 0; i < blades; i++) {
                const b = box(0.35, r * 2, 0.25, metal);
                b.rotation.z = (i * Math.PI) / blades;
                prop.add(b);
            }
            // A see-through blur disc when the prop spins fast.
            const disc = new T.Mesh(new T.CircleGeometry(r, 20), new T.MeshBasicMaterial({color: 0x222222, transparent: true, opacity: 0.12, side: T.DoubleSide, depthWrite: false}));
            prop.add(disc);
            prop.add(box(1, 1, 1.2, dark));
            prop.position.z = z;
            g.add(prop);
        };
        const flame = (x, y, z) => {
            const f = new T.Mesh(new T.ConeGeometry(0.75, 3, 8), new T.MeshBasicMaterial({color: glowColor(0xffa040), transparent: true, opacity: 0.85, depthWrite: false}));
            f.rotation.x = -Math.PI / 2;
            f.position.set(x, y, z);
            f.userData.z = z;
            g.add(f);
            burners.push(f);
        };

        if (shape === "jet" && planeId === "a10") {
            const fus = new T.Mesh(new T.CylinderGeometry(1.2, 0.8, 15, 8), body);
            fus.rotation.x = Math.PI / 2;
            g.add(fus);
            const nose = new T.Mesh(new T.ConeGeometry(1.2, 3, 8), body);
            nose.rotation.x = -Math.PI / 2;
            nose.position.z = -9;
            g.add(nose);
            g.add(box(0.25, 0.25, 2.5, metal, 0, -0.3, -11)); // the big gun
            g.add(new T.Mesh(slab([[-1, -2.5], [-9, -1.5], [-9, 0.5], [9, 0.5], [9, -1.5], [1, -2.5], [1, 0], [-1, 0]], 0.4), body).translateY(-0.5));
            [-2.2, 2.2].forEach(x => {
                const e = new T.Mesh(new T.CylinderGeometry(1, 1, 4, 8), dark);
                e.rotation.x = Math.PI / 2;
                e.position.set(x, 1.4, 3.8);
                g.add(e);
            });
            g.add(box(7, 0.25, 1.8, body, 0, 0.6, 7));
            [-3.5, 3.5].forEach(x => g.add(box(0.3, 3, 2, dark, x, 1.8, 7.2)));
            canopy = new T.Mesh(new T.SphereGeometry(0.85, 8, 6), glass);
            canopy.scale.set(1, 0.85, 1.8);
            canopy.position.set(0, 1.1, -5);
            g.add(canopy);
            tips = [[-9, -0.3, -0.5], [9, -0.3, -0.5]];
            tail = [0, 3.2, 7.6];
        } else if (shape === "jet") {
            const twin = TWIN_TAIL.includes(planeId);
            if (D.pbr) {
                // One smooth fuselage from the pointed nose to the jet pipes.
                g.add(lathe([[-12.2, 0], [-11.4, 0.28], [-10, 0.6], [-8, 0.95], [-5.5, 1.22], [-2.5, 1.38], [2, 1.38], [5.5, 1.2], [7.6, 1.0], [7.9, 0.85]], body));
                g.add(lathe([[7.6, 0.95], [8.6, 0.9], [8.6, 0.55]], dark, 14));
            } else {
                const fus = new T.Mesh(new T.CylinderGeometry(1.35, 1.0, 14, 10), body);
                fus.rotation.x = Math.PI / 2;
                g.add(fus);
                const nose = new T.Mesh(new T.ConeGeometry(1.0, 5, 10), body);
                nose.rotation.x = -Math.PI / 2;
                nose.position.z = -9.5;
                g.add(nose);
            }
            // Intakes on the sides.
            [-1.5, 1.5].forEach(x => g.add(box(0.9, 1.2, 4.5, dark, x, -0.3, -2.5)));
            g.add(new T.Mesh(slab([[-1, -3], [-8.6, 3.2], [-8.6, 4.6], [8.6, 4.6], [8.6, 3.2], [1, -3]], 0.35), body));
            g.add(new T.Mesh(slab([[-0.6, 4.6], [-4.4, 7.6], [-4.4, 8.4], [4.4, 8.4], [4.4, 7.6], [0.6, 4.6]], 0.25), dark));
            const fins = twin ? [-1.6, 1.6] : [0];
            fins.forEach(x => {
                const fin = new T.Mesh(slab([[0, 2.8], [0, 7.6], [3.6, 8], [3.3, 5.9]], 0.28), dark);
                fin.rotation.z = Math.PI / 2 + (twin ? Math.sign(x) * -0.25 : 0);
                fin.position.set(x, 0.7, 0);
                g.add(fin);
            });
            canopy = new T.Mesh(new T.SphereGeometry(0.95, 10, 8), glass);
            canopy.scale.set(1, 0.85, 2.6);
            canopy.position.set(0, 1.15, -3.6);
            g.add(canopy);
            g.add(box(0.5, 0.3, 3, lambert(0xeeeeee), -7.2, -0.6, 3)); // wing missiles
            g.add(box(0.5, 0.3, 3, lambert(0xeeeeee), 7.2, -0.6, 3));
            if (twin) [-0.9, 0.9].forEach(x => flame(x, 0, 8.6));
            else flame(0, 0, 8.6);
            tips = [[-8.6, 0, 4], [8.6, 0, 4]];
            tail = twin ? [1.6, 4.2, 7.6] : [0, 4.3, 7.6];
        } else if (shape === "bomber") {
            g.add(new T.Mesh(slab([[0, -9], [18, 4], [17, 6], [11, 3.5], [6, 6], [0, 3.5], [-6, 6], [-11, 3.5], [-17, 6], [-18, 4]], 1.6), body));
            const hump = new T.Mesh(new T.SphereGeometry(2.2, 10, 6), body);
            hump.scale.set(1.2, 0.7, 2.2);
            hump.position.set(0, 0.8, -2.5);
            g.add(hump);
            canopy = box(2.4, 0.5, 1.2, glass, 0, 1.6, -5.2);
            g.add(canopy);
            [-4.5, 4.5].forEach(x => g.add(box(1.6, 0.6, 2.5, dark, x, 0.9, -0.5)));
            [-4.5, 4.5].forEach(x => flame(x, 0.6, 5.2));
            tips = [[-18, 0, 4], [18, 0, 4]];
            tail = [0, 0.9, 4];
        } else if (shape === "prop") {
            if (D.pbr) {
                g.add(lathe([[-6.4, 1.3], [-5, 1.45], [-2, 1.42], [1, 1.25], [4, 0.85], [6.5, 0.45], [6.9, 0]], body));
                const spinner = lathe([[-7.6, 0], [-7.2, 0.35], [-6.6, 0.6], [-6.3, 0.62]], dark, 12);
                g.add(spinner);
            } else {
                const fus = new T.Mesh(new T.CylinderGeometry(1.4, 0.6, 12, 10), body);
                fus.rotation.x = Math.PI / 2;
                fus.position.z = 0.5;
                g.add(fus);
            }
            const cowl = new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 2.2, 10), dark);
            cowl.rotation.x = Math.PI / 2;
            cowl.position.z = -5.4;
            g.add(cowl);
            // Tapered wings with rounded-ish tips.
            g.add(new T.Mesh(slab([[-1, -2.4], [-6, -1.8], [-8.2, -1], [-8.4, 0.4], [-7, 1], [7, 1], [8.4, 0.4], [8.2, -1], [6, -1.8], [1, -2.4], [1, 1.6], [-1, 1.6]], 0.4), body).translateY(-0.6));
            g.add(new T.Mesh(slab([[-0.5, 4.8], [-3.6, 5.6], [-3.4, 6.6], [3.4, 6.6], [3.6, 5.6], [0.5, 4.8]], 0.25), body).translateY(0.2));
            const fin = new T.Mesh(slab([[0, 4.2], [0, 6.8], [2.6, 6.6], [2.2, 5.2]], 0.25), body);
            fin.rotation.z = Math.PI / 2;
            fin.position.y = 0.4;
            g.add(fin);
            canopy = new T.Mesh(new T.SphereGeometry(0.85, 10, 8), glass);
            canopy.scale.set(0.9, 0.8, 1.9);
            canopy.position.set(0, 1.2, -1);
            g.add(canopy);
            // Roundels.
            [-5.5, 5.5].forEach(x => {
                const r = new T.Mesh(new T.CircleGeometry(0.8, 12), new T.MeshBasicMaterial({color: 0xffffff}));
                r.rotation.x = -Math.PI / 2;
                r.position.set(x, -0.38, -0.6);
                g.add(r);
            });
            propeller(-6.7, planeId === "p51" || planeId === "mustang" || planeId === "p47" || planeId === "corsair" ? 4 : 3);
            tips = [[-8.4, -0.6, -0.4], [8.4, -0.6, -0.4]];
            tail = [0, 3, 6.6];
        } else {
            // Biplane: two wings with struts and wires.
            g.add(box(2, 2, 11, body, 0, 0, 0.5));
            g.add(box(17, 0.35, 3, body, 0, 2.2, -1.2));
            g.add(box(15, 0.35, 2.8, under, 0, -1, -1));
            [-5.5, 5.5].forEach(x => {
                g.add(box(0.25, 3.2, 0.25, metal, x, 0.6, -2));
                g.add(box(0.25, 3.2, 0.25, metal, x, 0.6, -0.3));
            });
            [-1, 1].forEach(s => g.add(box(0.2, 1.5, 0.2, metal, s * 0.9, 1.4, -1.6)));
            g.add(box(6, 0.25, 1.6, dark, 0, 0.4, 5.3));
            g.add(box(0.25, 2.2, 1.6, dark, 0, 1.4, 5.4));
            g.add(box(2.1, 2.1, 1.2, dark, 0, 0, -5.2));
            canopy = box(1.2, 0.6, 0.15, glass, 0, 1.25, -0.6);
            g.add(canopy);
            [-0.45, 0.45].forEach(x => g.add(box(0.18, 0.18, 2.2, metal, x, 1.15, -3)));
            propeller(-5.9, 2, 3.4);
            tips = [[-8.5, 2.2, -1.2], [8.5, 2.2, -1.2]];
            tail = [0, 2.5, 6];
        }
        // The pilot's helmet under the canopy.
        let helmet = null;
        if (canopy && shape !== "bomber") {
            helmet = new T.Mesh(new T.SphereGeometry(0.42, 10, 8), lambert(0x333333));
            helmet.position.copy(canopy.position).add(new T.Vector3(0, shape === "" ? 0.35 : -0.05, shape === "" ? 1.3 : 0.4));
            g.add(helmet);
        }
        // Navigation lights: red left, green right, white tail.
        const navs = [light(0xff2a2a, ...tips[0]), light(0x2aff5a, ...tips[1]), light(0xffffff, ...tail, 0.3)];
        navs.forEach(l => g.add(l));
        if (D.shadows) g.traverse(o => {
            if (o.isMesh && !(o.material && o.material.isMeshBasicMaterial)) o.castShadow = o.receiveShadow = true;
        });
        return {group: g, prop, burners, canopy, tips, navs, helmet};
    }

    // ------------------------------------------------------------- cockpit

    // The view from the pilot's seat: instrument panel (drawn live onto a
    // canvas), canopy frame, and the nose ahead.
    function buildCockpit(shape, color, eye) {
        const T = D.THREE, g = new T.Group();
        const [ex, ey, ez] = eye;
        const frame = lambert(0x2b2f33), body = lambert(color), metal = lambert(0x1e2124);
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 200;
        const tex = new T.CanvasTexture(canvas);
        tex.encoding = T.sRGBEncoding;
        const panelW = shape === "" ? 1.5 : 2.2, panelH = 0.62;
        const panel = new T.Mesh(new T.PlaneGeometry(panelW, panelH), new T.MeshBasicMaterial({map: tex, color: 0xdddddd}));
        panel.position.set(ex, ey - (shape === "jet" || shape === "bomber" ? 0.5 : 0.62), ez - 1.0);
        panel.rotation.x = -0.25;
        g.add(panel);
        // The panel's housing (glare shield on top).
        g.add(box(panelW + 0.2, 0.08, 0.45, frame, ex, ey - 0.16, ez - 1.22));
        g.add(box(panelW + 0.3, 0.5, 0.1, metal, ex, ey - 0.88, ez - 0.98));
        if (shape === "jet" || shape === "bomber") {
            // HUD glass and the canopy frame arching over your head.
            const hud = new T.Mesh(new T.PlaneGeometry(0.62, 0.5), new T.MeshBasicMaterial({color: 0x7dffa0, transparent: true, opacity: 0.08, depthWrite: false}));
            hud.position.set(ex, ey - 0.02, ez - 1.25);
            g.add(hud);
            g.add(box(0.05, 0.6, 0.05, frame, ex - 0.32, ey - 0.08, ez - 1.27));
            g.add(box(0.05, 0.6, 0.05, frame, ex + 0.32, ey - 0.08, ez - 1.27));
            [-1, 1].forEach(s => {
                const rail = box(0.08, 0.08, 4.5, frame, ex + s * 0.85, ey - 0.25, ez + 0.6);
                g.add(rail);
            });
            const bow = new T.Mesh(new T.TorusGeometry(0.95, 0.045, 4, 16, Math.PI), frame);
            bow.position.set(ex, ey - 0.3, ez - 1.5);
            g.add(bow);
            const bow2 = bow.clone();
            bow2.position.z = ez + 0.9;
            g.add(bow2);
        } else if (shape === "prop") {
            // Framed canopy and a reflector gunsight.
            [-1, 1].forEach(s => g.add(box(0.06, 0.06, 2.2, frame, ex + s * 0.7, ey - 0.3, ez + 0.2)));
            const bow = new T.Mesh(new T.TorusGeometry(0.75, 0.05, 4, 14, Math.PI), frame);
            bow.position.set(ex, ey - 0.35, ez - 0.9);
            g.add(bow);
            [-0.38, 0.38].forEach(x => {
                const ws = box(0.04, 0.55, 0.04, frame, ex + x, ey - 0.12, ez - 1.0);
                ws.rotation.x = -0.4;
                ws.rotation.z = x > 0 ? -0.35 : 0.35;
                g.add(ws);
            });
            g.add(box(0.07, 0.06, 0.1, metal, ex, ey - 0.3, ez - 1.05));
            const glass = new T.Mesh(new T.PlaneGeometry(0.12, 0.1), new T.MeshBasicMaterial({color: 0xffc040, transparent: true, opacity: 0.2, depthWrite: false}));
            glass.position.set(ex, ey - 0.22, ez - 1.05);
            g.add(glass);
            // Engine cowling stretching ahead.
            const cowl = new T.Mesh(new T.CylinderGeometry(1.2, 1.4, 4.6, 12, 1, true, -Math.PI / 2, Math.PI), new T.MeshLambertMaterial({color, side: T.DoubleSide}));
            cowl.rotation.x = Math.PI / 2;
            cowl.position.set(ex, ey - 1.85, ez - 3.6);
            g.add(cowl);
        } else {
            // Open cockpit: a small windscreen and the guns on the cowling.
            const ws = new T.Mesh(new T.PlaneGeometry(0.9, 0.35), new T.MeshBasicMaterial({color: 0xbfe8ff, transparent: true, opacity: 0.25, depthWrite: false, side: T.DoubleSide}));
            ws.position.set(ex, ey - 0.32, ez - 1.0);
            ws.rotation.x = -0.35;
            g.add(ws);
            g.add(box(1.6, 0.08, 1.0, body, ex, ey - 0.5, ez - 1.25));
        }
        return {group: g, canvas, tex, ctx: canvas.getContext("2d")};
    }

    // Draws the instruments: airspeed, altitude, artificial horizon, compass, throttle, G.
    function drawInstruments(cp, plane) {
        const c = cp.ctx, W = 512, H = 200;
        c.fillStyle = "#1b1e21";
        c.fillRect(0, 0, W, H);
        const dial = (x, y, r, label, value, max, text) => {
            c.fillStyle = "#0b0c0d";
            c.beginPath();
            c.arc(x, y, r, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = "#9aa1a8";
            c.lineWidth = 3;
            c.stroke();
            c.strokeStyle = "#e8e8e8";
            c.lineWidth = 2;
            for (let i = 0; i <= 10; i++) {
                const a = Math.PI * 0.75 + i / 10 * Math.PI * 1.5;
                c.beginPath();
                c.moveTo(x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78);
                c.lineTo(x + Math.cos(a) * r * 0.92, y + Math.sin(a) * r * 0.92);
                c.stroke();
            }
            const a = Math.PI * 0.75 + Math.min(1, Math.max(0, value / max)) * Math.PI * 1.5;
            c.strokeStyle = "#ffcf3a";
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(x, y);
            c.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
            c.stroke();
            c.fillStyle = "#cfd5da";
            c.font = "bold 15px sans-serif";
            c.textAlign = "center";
            c.fillText(label, x, y + r * 0.45);
            c.fillStyle = "#7dffa0";
            c.font = "bold 17px monospace";
            c.fillText(text, x, y - r * 0.25);
        };
        dial(70, 100, 62, "KM/H", plane.speed, plane.topSpeed * 1.4, String(Math.round(plane.speed * 3.6)));
        dial(442, 100, 62, "ALT M", plane.pos.y, 5000, String(Math.round(plane.pos.y)));
        // Artificial horizon.
        const f = plane.forward, r = plane.right;
        const pitch = Math.asin(Math.max(-1, Math.min(1, f.y))), roll = Math.atan2(r.y, plane.up.y);
        c.save();
        c.beginPath();
        c.arc(256, 92, 70, 0, Math.PI * 2);
        c.clip();
        c.translate(256, 92);
        c.rotate(roll);
        const off = pitch * 120;
        c.fillStyle = "#3a7bd5";
        c.fillRect(-120, -200 + off, 240, 200);
        c.fillStyle = "#8a5a2b";
        c.fillRect(-120, off, 240, 200);
        c.strokeStyle = "#fff";
        c.lineWidth = 2;
        for (let k = -3; k <= 3; k++) {
            if (!k) continue;
            c.beginPath();
            c.moveTo(-18, off - k * 21);
            c.lineTo(18, off - k * 21);
            c.stroke();
        }
        c.beginPath();
        c.moveTo(-120, off);
        c.lineTo(120, off);
        c.stroke();
        c.restore();
        c.strokeStyle = "#ffcf3a";
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(220, 92);
        c.lineTo(246, 92);
        c.lineTo(256, 100);
        c.lineTo(266, 92);
        c.lineTo(292, 92);
        c.stroke();
        c.strokeStyle = "#9aa1a8";
        c.lineWidth = 3;
        c.beginPath();
        c.arc(256, 92, 70, 0, Math.PI * 2);
        c.stroke();
        // Heading, throttle and G.
        const heading = (Math.atan2(f.x, -f.z) * 180 / Math.PI + 360) % 360;
        c.fillStyle = "#cfd5da";
        c.font = "bold 16px monospace";
        c.textAlign = "center";
        c.fillText(`HDG ${String(Math.round(heading)).padStart(3, "0")}°   G ${plane.g.toFixed(1)}`, 256, 186);
        c.fillStyle = "#333";
        c.fillRect(150, 172, 8, -150);
        c.fillStyle = plane.boosting ? "#ff7a2a" : "#7dffa0";
        c.fillRect(150, 172, 8, -150 * plane.throttle);
        c.fillStyle = "#333";
        c.fillRect(354, 172, 8, -150);
        c.fillStyle = plane.health / plane.maxHealth > 0.35 ? "#7dffa0" : "#ff4d4d";
        c.fillRect(354, 172, 8, -150 * Math.max(0, plane.health / plane.maxHealth));
        cp.tex.needsUpdate = true;
    }

    // ------------------------------------------------------------- plane

    class Aircraft {
        // opts: {name, label, color, shape, planeId, isPlayer, team, stats: {...}, gun}
        constructor(scene, opts) {
            const T = D.THREE;
            Object.assign(this, opts);
            const kind = SHAPES[opts.shape] || SHAPES[""];
            this.kind = kind;
            // Engine and handling upgrades count half as much here as in 2D.
            this.topSpeed = kind.top * (1 + ((opts.stats.thrust || 1) - 1) * 0.5);
            this.minSpeed = kind.min;
            this.cornerSpeed = this.minSpeed + (this.topSpeed - this.minSpeed) * 0.5;
            this.radius = kind.radius;
            this.agility = 1 + ((opts.stats.turn || 1) - 1) * 0.5;
            this.maxHealth = Math.round((100 + 18 * (opts.stats.life || 0)) * (1 + 0.1 * (opts.stats.airframe || 0)));
            this.maxAmmo = Math.max(150, 260 + (opts.stats.ammo || 0) * 10);
            this.maxMissiles = 2 + (opts.stats.missiles || 0);
            // Everyone has some countermeasures in 3D; planes that carry flares have more.
            this.maxFlares = 2 + (opts.stats.flares || 0);
            this.maxBoost = 4 * (1 + 0.25 * (opts.stats.boost || 0));
            const model = buildModel(opts.shape, opts.color, opts.planeId);
            this.mesh = model.group;
            this.prop = model.prop;
            this.burners = model.burners;
            this.canopy = model.canopy;
            this.helmet = model.helmet;
            this.tips = model.tips.map(t => new T.Vector3(...t));
            this.navs = model.navs;
            this.scale = opts.shape === "bomber" ? 1.2 : 1;
            this.mesh.scale.setScalar(this.scale);
            scene.add(this.mesh);
            this.eye = new T.Vector3(...kind.eye).multiplyScalar(this.scale);
            this.pos = new T.Vector3();
            this.quat = new T.Quaternion();
            this.input = {pitch: 0, roll: 0, yaw: 0, throttle: 0.75, boost: false};
            this.kills = 0;
            this.deaths = 0;
            this.score = 0;
            this.g = 1;
            this._f = new T.Vector3();
            this._r = new T.Vector3();
            this._u = new T.Vector3();
            this._q = new T.Quaternion();
            this._e = new T.Euler();
            this._axis = new T.Vector3();
            this.alive = false;
            this.navT = Math.random();
        }

        // The cockpit (made the first time you look from inside).
        cockpit() {
            if (!this._cockpit) {
                this._cockpit = buildCockpit(this.shape, this.color, this.kind.eye);
                this.mesh.add(this._cockpit.group);
            }
            return this._cockpit;
        }

        // The helmet in the canopy takes the pilot skin's color.
        setPilot(skin) {
            this.skin = skin;
            if (this.helmet && skin && skin.capColor) this.helmet.material.color.set(skin.capColor);
        }

        setCockpit(on) {
            if (this.helmet) this.helmet.visible = !on;
            if (on) this.cockpit();
            if (this._cockpit) this._cockpit.group.visible = on;
            if (this.canopy) this.canopy.visible = !on;
            this.inCockpit = on;
        }

        updateInstruments() {
            if (this._cockpit && this.inCockpit) drawInstruments(this._cockpit, this);
        }

        spawn(pos, lookAt) {
            this.pos.copy(pos);
            this.mesh.position.copy(pos);
            this.mesh.quaternion.identity();
            this.mesh.lookAt(lookAt);
            // lookAt points +Z at the target; our nose is -Z, so turn around.
            this.mesh.rotateY(Math.PI);
            this.quat.copy(this.mesh.quaternion);
            this.speed = this.cornerSpeed * 1.15;
            this.throttle = 0.8;
            this.health = this.maxHealth;
            this.ammo = this.maxAmmo;
            this.missiles = this.maxMissiles;
            this.flares = this.maxFlares;
            this.boost = this.maxBoost;
            this.reloadAt = 0;
            this.missileReloadAt = 0;
            this.flareReloadAt = 0;
            this.alive = true;
            this.burning = false;
            this.mesh.visible = true;
            this.lastHitBy = null;
            this.damageBy = new Map();
            this.spawnedAt = performance.now();
            this.g = 1;
        }

        get forward() {
            return this._f.set(0, 0, -1).applyQuaternion(this.quat);
        }

        get right() {
            return this._r.set(1, 0, 0).applyQuaternion(this.quat);
        }

        get up() {
            return this._u.set(0, 1, 0).applyQuaternion(this.quat);
        }

        get velocity() {
            return this.forward.clone().multiplyScalar(this.speed);
        }

        // Wingtip positions in the world (for vapor trails).
        tipWorld(i, out) {
            return out.copy(this.tips[i]).multiplyScalar(this.scale).applyQuaternion(this.quat).add(this.pos);
        }

        // How well the plane turns at this speed: best at corner speed.
        turnFactor() {
            const s = this.speed, lo = this.minSpeed * 0.6;
            if (s < this.cornerSpeed) return Math.max(0.3, (s - lo) / (this.cornerSpeed - lo));
            return Math.max(0.62, 1 - 0.38 * (s - this.cornerSpeed) / (this.topSpeed - this.cornerSpeed));
        }

        // Returns "crash" if the plane hit the ground, water or a building.
        update(dt, world) {
            if (!this.alive) return null;
            const T = D.THREE, i = this.input, k = this.kind;
            this.throttle = Math.max(0, Math.min(1, this.throttle + (i.throttleDelta || 0) * dt));
            if (i.throttle !== undefined && i.throttleDelta === undefined) this.throttle = i.throttle;
            // Afterburner / emergency power while there is some left.
            this.boosting = !!i.boost && this.boost > 0 && this.throttle > 0.3;
            if (this.boosting) this.boost = Math.max(0, this.boost - dt);
            else this.boost = Math.min(this.maxBoost, this.boost + dt * 0.35);

            const a = this.agility * (this.pilotBonus || 1) * this.turnFactor();
            const pitchRate = k.pitch * a * i.pitch;
            this._e.set(pitchRate * dt, -0.42 * a * i.yaw * dt, -k.roll * Math.min(1.2, this.agility) * Math.max(0.45, this.turnFactor()) * i.roll * dt, "XYZ");
            this.quat.multiply(this._q.setFromEuler(this._e));
            // Banking turns the plane a little by itself (the lift tilts sideways).
            const bank = this.right.y;
            this._q.setFromAxisAngle(this._axis.set(0, 1, 0), bank * 0.32 * this.agility * dt);
            this.quat.premultiply(this._q);
            // Stall: the nose drops.
            const f = this.forward;
            if (this.speed < this.minSpeed) {
                const drop = (this.minSpeed - this.speed) / this.minSpeed;
                this._q.setFromAxisAngle(this.right, -drop * 1.8 * dt * Math.sign(f.y + 0.2));
                this.quat.premultiply(this._q);
                this.stalling = true;
            } else this.stalling = false;
            // Too high: the thin air pushes the nose down.
            if (this.pos.y > 7000) {
                this._q.setFromAxisAngle(this.right, -0.6 * dt);
                this.quat.premultiply(this._q);
            }
            this.quat.normalize();
            // G load, for the vapor trails, the blackout and the G meter.
            const gNow = 1 + Math.abs(pitchRate) * this.speed / 33;
            this.g += (gNow - this.g) * Math.min(1, dt * 6);
            // Speed: the engine pulls toward the throttle's speed; pulling hard
            // bleeds speed; climbing costs speed, diving gains it.
            const top = this.topSpeed * (this.burning ? 0.8 : 1) * (this.boosting ? k.boost : 1);
            const target = this.minSpeed * 0.75 + (top - this.minSpeed * 0.75) * (this.boosting ? 1 : this.throttle);
            this.speed += (target - this.speed) * (this.boosting ? 0.9 : 0.42) * dt;
            this.speed -= Math.abs(i.pitch) * this.turnFactor() * 0.11 * this.speed * dt;
            this.speed -= this.forward.y * 9.8 * 1.6 * dt;
            this.speed = Math.max(18, Math.min(this.topSpeed * 1.6, this.speed));
            this.pos.addScaledVector(this.forward, this.speed * dt);
            this.mesh.position.copy(this.pos);
            this.mesh.quaternion.copy(this.quat);
            if (this.prop) this.prop.rotation.z += dt * (25 + 45 * this.throttle);
            for (const b of this.burners) {
                const s = (this.boosting ? 1.5 : 0.35 + this.throttle * 0.5) + Math.random() * 0.15;
                b.scale.set(this.boosting ? 1.2 : 1, s, this.boosting ? 1.2 : 1);
                b.position.z = b.userData.z + 1.5 * s;
                b.material.color.set(glowColor(this.boosting ? 0x7fb6ff : 0xffa040, this.boosting ? 1.6 : 1));
            }
            // The white tail light blinks.
            this.navT += dt;
            if (this.navs[2]) this.navs[2].visible = this.navT % 1.2 < 0.12;
            return this.pos.y < world.ground(this.pos.x, this.pos.z) + 2.5 ? "crash" : null;
        }

        hide() {
            this.alive = false;
            this.mesh.visible = false;
        }
    }

    D.Aircraft = Aircraft;
    D.SHAPES = SHAPES;
})();
