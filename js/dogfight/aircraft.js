// Dogfights (3D beta): plane models and flight. Every plane is built from
// simple shapes in its Hangar colors: biplane, propeller fighter, jet or the
// B-2 flying wing. Flight is arcade-style: pitch, roll and rudder, banking
// turns the plane, climbing costs speed, diving gains it, and too slow = stall.
(function () {
    const D = window.BitDogfight = window.BitDogfight || {};

    // Top speed by shape (units per second) before the plane's own speed.
    const SHAPES = {
        "": {top: 85, min: 34, radius: 9},
        prop: {top: 120, min: 42, radius: 9},
        jet: {top: 210, min: 60, radius: 10},
        bomber: {top: 170, min: 55, radius: 16},
    };

    function shade(hex, f) {
        const c = new D.THREE.Color(hex);
        return c.multiplyScalar(f);
    }

    function lambert(color) {
        return new D.THREE.MeshLambertMaterial({color, flatShading: true});
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

    // Forward is -Z, up is +Y, right is +X.
    function buildModel(shape, color) {
        const T = D.THREE, g = new T.Group();
        const body = lambert(color), dark = lambert(shade(color, 0.6)), glass = lambert(0x9fdcff), metal = lambert(0x3a3a3a);
        let prop = null, burner = null;
        const propeller = (z, blades) => {
            prop = new T.Group();
            for (let i = 0; i < blades; i++) {
                const b = box(0.35, 7, 0.25, metal);
                b.rotation.z = (i * Math.PI) / blades;
                prop.add(b);
            }
            prop.add(box(1, 1, 1, dark));
            prop.position.z = z;
            g.add(prop);
        };
        if (shape === "jet") {
            const fus = new T.Mesh(new T.CylinderGeometry(1.3, 0.9, 13, 8), body);
            fus.rotation.x = Math.PI / 2;
            g.add(fus);
            const nose = new T.Mesh(new T.ConeGeometry(0.9, 4.5, 8), body);
            nose.rotation.x = -Math.PI / 2;
            nose.position.z = -8.7;
            g.add(nose);
            g.add(new T.Mesh(slab([[-0.8, -2], [-8.5, 3.5], [-8.5, 5], [8.5, 5], [8.5, 3.5], [0.8, -2]], 0.35), body));
            g.add(new T.Mesh(slab([[-0.5, 4.5], [-4, 7.2], [-4, 7.8], [4, 7.8], [4, 7.2], [0.5, 4.5]], 0.25), dark));
            const fin = new T.Mesh(slab([[0, 2.5], [0, 7], [3.8, 7.5], [3.5, 5.5]], 0.3), dark);
            fin.rotation.z = Math.PI / 2;
            fin.position.y = 0.6;
            g.add(fin);
            const canopy = new T.Mesh(new T.SphereGeometry(0.9, 8, 6), glass);
            canopy.scale.set(1, 0.8, 2.4);
            canopy.position.set(0, 1.1, -3.5);
            g.add(canopy);
            burner = new T.Mesh(new T.ConeGeometry(0.8, 3, 8), new T.MeshBasicMaterial({color: 0xffa040, transparent: true, opacity: 0.85}));
            burner.rotation.x = -Math.PI / 2;
            burner.position.z = 8;
            g.add(burner);
        } else if (shape === "bomber") {
            g.add(new T.Mesh(slab([[0, -9], [18, 4], [17, 6], [11, 3.5], [6, 6], [0, 3.5], [-6, 6], [-11, 3.5], [-17, 6], [-18, 4]], 1.6), body));
            const hump = new T.Mesh(new T.SphereGeometry(2.2, 8, 6), body);
            hump.scale.set(1.2, 0.7, 2.2);
            hump.position.set(0, 0.8, -2.5);
            g.add(hump);
            const glassB = box(2.4, 0.5, 1.2, glass, 0, 1.6, -5.2);
            g.add(glassB);
            [-4.5, 4.5].forEach(x => g.add(box(1.6, 0.6, 2.5, dark, x, 0.9, -0.5)));
        } else if (shape === "prop") {
            const fus = new T.Mesh(new T.CylinderGeometry(1.4, 0.6, 12, 8), body);
            fus.rotation.x = Math.PI / 2;
            fus.position.z = 0.5;
            g.add(fus);
            const cowl = new T.Mesh(new T.CylinderGeometry(1.5, 1.5, 2, 8), dark);
            cowl.rotation.x = Math.PI / 2;
            cowl.position.z = -5.5;
            g.add(cowl);
            g.add(new T.Mesh(slab([[-1, -2.2], [-8, -1.2], [-8, 1.2], [8, 1.2], [8, -1.2], [1, -2.2], [1, 1.6], [-1, 1.6]], 0.4), body).translateY(-0.6));
            g.add(box(7, 0.25, 1.6, body, 0, 0.2, 5.6));
            g.add(box(0.25, 2.4, 1.8, body, 0, 1.3, 5.7));
            const canopy = new T.Mesh(new T.SphereGeometry(0.85, 8, 6), glass);
            canopy.scale.set(0.9, 0.8, 1.8);
            canopy.position.set(0, 1.2, -1);
            g.add(canopy);
            propeller(-6.7, 3);
        } else {
            // Biplane: two wings with struts.
            g.add(box(2, 2, 11, body, 0, 0, 0.5));
            g.add(box(17, 0.35, 3, body, 0, 2.2, -1.2));
            g.add(box(15, 0.35, 2.8, body, 0, -1, -1));
            [-5.5, 5.5].forEach(x => {
                g.add(box(0.25, 3.2, 0.25, metal, x, 0.6, -2));
                g.add(box(0.25, 3.2, 0.25, metal, x, 0.6, -0.3));
            });
            g.add(box(6, 0.25, 1.6, dark, 0, 0.4, 5.3));
            g.add(box(0.25, 2.2, 1.6, dark, 0, 1.4, 5.4));
            g.add(box(2.1, 2.1, 1.2, dark, 0, 0, -5.2));
            g.add(box(1.2, 0.6, 1.2, metal, 0, 1.3, 0.5));
            propeller(-5.9, 2);
        }
        return {group: g, prop, burner};
    }

    class Aircraft {
        // opts: {name, color, shape, planeId, isPlayer, stats: {thrust, turn, life, reload, bulletSpeed, ammo, missiles, flares}, gun}
        constructor(scene, opts) {
            const T = D.THREE;
            Object.assign(this, opts);
            const kind = SHAPES[opts.shape] || SHAPES[""];
            this.kind = kind;
            this.topSpeed = kind.top * (opts.stats.thrust || 1);
            this.minSpeed = kind.min;
            this.radius = kind.radius;
            this.agility = opts.stats.turn || 1;
            this.maxHealth = 10 + 2 * (opts.stats.life || 0);
            this.maxAmmo = Math.max(20, 40 + (opts.stats.ammo || 0) * 2);
            this.maxMissiles = 2 + (opts.stats.missiles || 0);
            this.maxFlares = opts.stats.flares || 0;
            const model = buildModel(opts.shape, opts.color);
            this.mesh = model.group;
            this.prop = model.prop;
            this.burner = model.burner;
            this.mesh.scale.setScalar(opts.shape === "bomber" ? 1.2 : 1);
            scene.add(this.mesh);
            this.pos = new T.Vector3();
            this.quat = new T.Quaternion();
            this.input = {pitch: 0, roll: 0, yaw: 0, throttle: 0.75};
            this.kills = 0;
            this.deaths = 0;
            this._f = new T.Vector3();
            this._r = new T.Vector3();
            this._u = new T.Vector3();
            this._q = new T.Quaternion();
            this._e = new T.Euler();
            this.alive = false;
        }

        spawn(pos, lookAt) {
            this.pos.copy(pos);
            this.mesh.position.copy(pos);
            this.mesh.lookAt(lookAt);
            // lookAt points +Z at the target; our nose is -Z, so turn around.
            this.mesh.rotateY(Math.PI);
            this.quat.copy(this.mesh.quaternion);
            this.speed = (this.topSpeed + this.minSpeed) / 2;
            this.throttle = 0.75;
            this.health = this.maxHealth;
            this.ammo = this.maxAmmo;
            this.missiles = this.maxMissiles;
            this.flares = this.maxFlares;
            this.reloadAt = 0;
            this.missileReloadAt = 0;
            this.alive = true;
            this.mesh.visible = true;
            this.lastHitBy = null;
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

        // Returns "crash" if the plane hit the ground or water.
        update(dt, world) {
            if (!this.alive) return null;
            const T = D.THREE, i = this.input;
            this.throttle = Math.max(0, Math.min(1, this.throttle + (i.throttleDelta || 0) * dt));
            if (i.throttle !== undefined && i.throttleDelta === undefined) this.throttle = i.throttle;
            // Controls bite harder at speed, and are mushy near a stall.
            const authority = Math.min(1, Math.max(0.35, (this.speed - this.minSpeed * 0.6) / (this.minSpeed * 1.4)));
            const a = this.agility * authority;
            this._e.set(0.85 * a * i.pitch * dt, -0.4 * a * i.yaw * dt, -2.1 * a * i.roll * dt, "XYZ");
            this.quat.multiply(this._q.setFromEuler(this._e));
            // Banking turns the plane (the lift tilts sideways).
            const bank = this.right.y;
            this._q.setFromAxisAngle(new T.Vector3(0, 1, 0), bank * 0.5 * this.agility * dt);
            this.quat.premultiply(this._q);
            // Stall: the nose drops.
            const f = this.forward;
            if (this.speed < this.minSpeed) {
                const drop = (this.minSpeed - this.speed) / this.minSpeed;
                this._q.setFromAxisAngle(this.right, -drop * 1.6 * dt * Math.sign(f.y + 0.2));
                this.quat.premultiply(this._q);
            }
            // Too high: the thin air pushes the nose down.
            if (this.pos.y > 4200) {
                this._q.setFromAxisAngle(this.right, -0.6 * dt);
                this.quat.premultiply(this._q);
            }
            this.quat.normalize();
            // Speed: engine pulls toward the throttle's speed; climbing slows, diving speeds up.
            const target = this.minSpeed * 0.8 + (this.topSpeed - this.minSpeed * 0.8) * this.throttle;
            this.speed += (target - this.speed) * 0.55 * dt;
            this.speed -= this.forward.y * 55 * dt;
            this.speed = Math.max(15, Math.min(this.topSpeed * 1.45, this.speed));
            this.pos.addScaledVector(this.forward, this.speed * dt);
            this.mesh.position.copy(this.pos);
            this.mesh.quaternion.copy(this.quat);
            if (this.prop) this.prop.rotation.z += dt * (20 + 40 * this.throttle);
            if (this.burner) {
                const s = 0.4 + this.throttle * 0.9 + Math.random() * 0.15;
                this.burner.scale.set(1, s, 1);
                this.burner.position.z = 8 + 1.5 * s;
            }
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
