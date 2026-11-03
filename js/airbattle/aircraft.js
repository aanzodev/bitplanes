(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};

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

    function lambert(color) {
        if (D.pbr) return new D.THREE.MeshStandardMaterial({color, roughness: 0.5, metalness: 0.28});
        return new D.THREE.MeshLambertMaterial({color, flatShading: true});
    }

    function glowColor(hex, k = 1) {
        return new D.THREE.Color(hex).multiplyScalar(1 + ((D.glow || 1) - 1) * k);
    }

    function lathe(profile, mat, segments = 18) {
        const T = D.THREE;
        const g = new T.LatheGeometry(profile.map(([z, r]) => new T.Vector2(r, -z)), segments);
        g.rotateX(-Math.PI / 2);
        return new T.Mesh(g, mat);
    }

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
        const m = new D.THREE.Mesh(new D.THREE.SphereGeometry(size, 6, 4), new D.THREE.MeshBasicMaterial({color: glowColor(color, 0.5)}));
        m.position.set(x, y, z);
        return m;
    }

    function buildModel(opts) {
        const T = D.THREE;
        const m = D.buildPlaneModel(opts.shape, opts.color, opts.planeId, {pattern: opts.pattern, team: opts.team, number: opts.number});
        const g = m.group;
        const tail = m.tail || [0, 2, 6];
        const navs = [light(0xff2a2a, ...m.tips[0], 0.14), light(0x2aff5a, ...m.tips[1], 0.14), light(0xffffff, ...tail, 0.12)];
        navs.forEach(l => g.add(l));
        let helmet = null;
        if (m.helmetPos) {
            helmet = new T.Mesh(new T.SphereGeometry(0.26, 12, 10), lambert(0x333333));
            helmet.position.set(...m.helmetPos);
            g.add(helmet);
        }
        return Object.assign(m, {navs, helmet});
    }


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
        g.add(box(panelW + 0.2, 0.08, 0.45, frame, ex, ey - 0.16, ez - 1.22));
        g.add(box(panelW + 0.3, 0.5, 0.1, metal, ex, ey - 0.88, ez - 0.98));
        if (shape === "jet" || shape === "bomber") {
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
            const cowl = new T.Mesh(new T.CylinderGeometry(1.2, 1.4, 4.6, 12, 1, true, -Math.PI / 2, Math.PI), new T.MeshLambertMaterial({color, side: T.DoubleSide}));
            cowl.rotation.x = Math.PI / 2;
            cowl.position.set(ex, ey - 1.85, ez - 3.6);
            g.add(cowl);
        } else {
            const ws = new T.Mesh(new T.PlaneGeometry(0.9, 0.35), new T.MeshBasicMaterial({color: 0xbfe8ff, transparent: true, opacity: 0.25, depthWrite: false, side: T.DoubleSide}));
            ws.position.set(ex, ey - 0.32, ez - 1.0);
            ws.rotation.x = -0.35;
            g.add(ws);
            g.add(box(1.6, 0.08, 1.0, body, ex, ey - 0.5, ez - 1.25));
        }
        return {group: g, canvas, tex, ctx: canvas.getContext("2d")};
    }

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


    class Aircraft {
        constructor(scene, opts) {
            const T = D.THREE;
            Object.assign(this, opts);
            const kind = SHAPES[opts.shape] || SHAPES[""];
            this.kind = kind;
            this.topSpeed = kind.top * (1 + ((opts.stats.thrust || 1) - 1) * 0.5);
            this.minSpeed = kind.min;
            this.cornerSpeed = this.minSpeed + (this.topSpeed - this.minSpeed) * 0.5;
            this.radius = kind.radius;
            this.agility = 1 + ((opts.stats.turn || 1) - 1) * 0.5;
            this.maxHealth = Math.round((100 + 18 * (opts.stats.life || 0)) * (1 + 0.1 * (opts.stats.airframe || 0)));
            this.maxAmmo = Math.max(150, 260 + (opts.stats.ammo || 0) * 10);
            this.maxMissiles = 2 + (opts.stats.missiles || 0);
            this.maxFlares = 3 + (opts.stats.flares || 0);
            this.maxBoost = 4 * (1 + 0.25 * (opts.stats.boost || 0));
            const model = buildModel(opts);
            this.mesh = model.group;
            this.props = model.props;
            this.spinners = model.spinners;
            this.burners = model.burners;
            this.glows = model.glows;
            this.surfaces = {ailerons: model.ailerons, elevators: model.elevators, rudders: model.rudders};
            this.defl = {p: 0, r: 0, y: 0};
            this.canopy = model.canopy;
            this.helmet = model.helmet;
            this.tips = model.tips.map(t => new T.Vector3(...t));
            this.navs = model.navs;
            this.scale = opts.shape === "bomber" ? 1.2 : 1;
            this.mesh.scale.setScalar(this.scale);
            scene.add(this.mesh);
            this.eyeLocal = model.eye || kind.eye;
            this.eye = new T.Vector3(...this.eyeLocal).multiplyScalar(this.scale);
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

        cockpit() {
            if (!this._cockpit) {
                this._cockpit = buildCockpit(this.shape, this.color, this.eyeLocal);
                this.mesh.add(this._cockpit.group);
            }
            return this._cockpit;
        }

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

        tipWorld(i, out) {
            return out.copy(this.tips[i]).multiplyScalar(this.scale).applyQuaternion(this.quat).add(this.pos);
        }

        turnFactor() {
            const s = this.speed, lo = this.minSpeed * 0.6;
            if (s < this.cornerSpeed) return Math.max(0.3, (s - lo) / (this.cornerSpeed - lo));
            return Math.max(0.62, 1 - 0.38 * (s - this.cornerSpeed) / (this.topSpeed - this.cornerSpeed));
        }

        update(dt, world) {
            if (!this.alive) return null;
            const T = D.THREE, i = this.input, k = this.kind;
            this.throttle = Math.max(0, Math.min(1, this.throttle + (i.throttleDelta || 0) * dt));
            if (i.throttle !== undefined && i.throttleDelta === undefined) this.throttle = i.throttle;
            this.boosting = !!i.boost && this.boost > 0 && this.throttle > 0.3;
            if (this.boosting) this.boost = Math.max(0, this.boost - dt);
            else this.boost = Math.min(this.maxBoost, this.boost + dt * 0.35);

            const a = this.agility * (this.pilotBonus || 1) * this.turnFactor();
            const pitchRate = k.pitch * a * i.pitch;
            this._e.set(pitchRate * dt, -0.42 * a * i.yaw * dt, -k.roll * Math.min(1.2, this.agility) * Math.max(0.45, this.turnFactor()) * i.roll * dt, "XYZ");
            this.quat.multiply(this._q.setFromEuler(this._e));
            const bank = this.right.y;
            this._q.setFromAxisAngle(this._axis.set(0, 1, 0), bank * 0.32 * this.agility * dt);
            this.quat.premultiply(this._q);
            const f = this.forward;
            if (this.speed < this.minSpeed) {
                const drop = (this.minSpeed - this.speed) / this.minSpeed;
                this._q.setFromAxisAngle(this.right, -drop * 1.8 * dt * Math.sign(f.y + 0.2));
                this.quat.premultiply(this._q);
                this.stalling = true;
            } else this.stalling = false;
            if (this.pos.y > 7000) {
                this._q.setFromAxisAngle(this.right, -0.6 * dt);
                this.quat.premultiply(this._q);
            }
            this.quat.normalize();
            const gNow = 1 + Math.abs(pitchRate) * this.speed / 33;
            this.g += (gNow - this.g) * Math.min(1, dt * 6);
            const top = this.topSpeed * (this.burning ? 0.8 : 1) * (this.boosting ? k.boost : 1);
            const target = this.minSpeed * 0.75 + (top - this.minSpeed * 0.75) * (this.boosting ? 1 : this.throttle);
            this.speed += (target - this.speed) * (this.boosting ? 0.9 : 0.42) * dt;
            this.speed -= Math.abs(i.pitch) * this.turnFactor() * 0.11 * this.speed * dt;
            this.speed -= this.forward.y * 9.8 * 1.6 * dt;
            this.speed = Math.max(18, Math.min(this.topSpeed * 1.6, this.speed));
            this.pos.addScaledVector(this.forward, this.speed * dt);
            this.mesh.position.copy(this.pos);
            this.mesh.quaternion.copy(this.quat);
            const spin = dt * (25 + 45 * this.throttle);
            for (const p of this.props) p.rotation.z += spin;
            for (const p of this.spinners) p.rotation.z += spin;
            const d = this.defl, k2 = Math.min(1, dt * 10);
            d.p += (i.pitch - d.p) * k2;
            d.r += (i.roll - d.r) * k2;
            d.y += (i.yaw - d.y) * k2;
            for (const e of this.surfaces.elevators) e.rotation.x = -0.32 * d.p;
            for (const a of this.surfaces.ailerons) a.pivot.rotation.x = -0.32 * a.side * d.r + (this.shape === "bomber" ? -0.25 * d.p : 0);
            for (const r of this.surfaces.rudders) r.rotation.y = 0.35 * d.y;
            for (const gl of this.glows) {
                gl.material.color.set(glowColor(this.boosting ? 0xffc890 : 0xff6a20, this.boosting ? 1.4 : 0.3 + this.throttle * 0.5));
                gl.material.opacity = 0.55 + 0.45 * this.throttle;
            }
            for (const b of this.burners) {
                const s = (this.boosting ? 1.3 : 0.25 + this.throttle * 0.3) + Math.random() * 0.12;
                b.scale.y = s;
                b.position.z = b.userData.z + 1.5 * s;
                b.material.opacity = this.boosting ? 0.85 : 0.35;
                b.material.color.set(glowColor(this.boosting ? 0xffb070 : 0xff8a40, this.boosting ? 1.2 : 0.25));
            }
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
