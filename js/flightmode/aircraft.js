(function () {
    const D = window.BitFlightMode = window.BitFlightMode || {};

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
            this.flight = D.makeFlight ? D.makeFlight(opts.planeId, opts.shape || "", this.topSpeed, this.minSpeed, kind.boost) : null;
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
                this._cockpit = D.buildCockpit(this.shape, this.color, this.eyeLocal, {skin: this.skin});
                this.mesh.add(this._cockpit.group);
            }
            return this._cockpit;
        }

        setPilot(skin) {
            this.skin = skin;
            if (this.helmet && skin && skin.capColor) this.helmet.material.color.set(skin.capColor);
            if (this._cockpit) this._cockpit.setSkin(skin);
        }

        setCockpit(on) {
            if (this.helmet) this.helmet.visible = !on;
            if (on) this.cockpit();
            if (this._cockpit) this._cockpit.group.visible = on;
            if (this.canopy) this.canopy.visible = !on;
            this.inCockpit = on;
        }

        updateInstruments(info) {
            if (this._cockpit && this.inCockpit) this._cockpit.update(this, info);
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
            const stallSpeed = this.flight ? this.flight.stall(this.pos.y, this.g) : this.minSpeed;
            this.stallSpeed = stallSpeed;
            if (this.speed < stallSpeed) {
                const drop = Math.min(1, (stallSpeed - this.speed) / stallSpeed);
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
            if (this.flight) {
                this.speed = this.flight.step(this.speed, this.throttle, this.boosting, !!this.burning, this.pos.y, this.forward.y, this.g, dt);
            } else {
                const top = this.topSpeed * (this.burning ? 0.8 : 1) * (this.boosting ? k.boost : 1);
                const target = this.minSpeed * 0.75 + (top - this.minSpeed * 0.75) * (this.boosting ? 1 : this.throttle);
                this.speed += (target - this.speed) * (this.boosting ? 0.9 : 0.42) * dt;
                this.speed -= Math.abs(i.pitch) * this.turnFactor() * 0.11 * this.speed * dt;
                this.speed -= this.forward.y * 9.8 * 1.6 * dt;
            }
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
