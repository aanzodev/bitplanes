// Air Battle (3D): guns, missiles, flares and everything that burns. Effects
// use one particle system per blend mode, drawn by a small GLSL shader (soft
// round sprites that grow, fade and change color), so a big explosion is
// hundreds of particles in a single draw call.
//   Bullets: glowing tracers; hits spark, miss into dust or water splashes.
//   Missiles: chase a locked target (lead pursuit, limited turn, motor burns
//   out); without a lock they fly straight. Flares fool most missiles.
(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};
    const MAX_BULLETS = 1400;

    const PART_VERT = `
        attribute float size;
        attribute float alpha;
        attribute vec3 tint;
        varying float vAlpha;
        varying vec3 vTint;
        uniform float scale;
        #include <fog_pars_vertex>
        void main() {
            vAlpha = alpha;
            vTint = tint;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = min(512.0, size * scale / max(1.0, -mvPosition.z));
            gl_Position = projectionMatrix * mvPosition;
            #include <fog_vertex>
        }`;
    const PART_FRAG = `
        varying float vAlpha;
        varying vec3 vTint;
        uniform float soft, boost;
        #include <fog_pars_fragment>
        void main() {
            vec2 p = gl_PointCoord * 2.0 - 1.0;
            float d = dot(p, p);
            if (d > 1.0) discard;
            float a = vAlpha * pow(1.0 - d, soft);
            gl_FragColor = vec4(vTint * boost, a);
            #include <tonemapping_fragment>
            #include <encodings_fragment>
            #include <fog_fragment>
        }`;

    // A pool of particles drawn as one THREE.Points.
    function makeParticles(THREE, scene, max, additive) {
        const pos = new Float32Array(max * 3), tint = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        geo.setAttribute("tint", new THREE.BufferAttribute(tint, 3));
        geo.setAttribute("size", new THREE.BufferAttribute(size, 1));
        geo.setAttribute("alpha", new THREE.BufferAttribute(alpha, 1));
        const mat = new THREE.ShaderMaterial({
            vertexShader: PART_VERT, fragmentShader: PART_FRAG, transparent: true, depthWrite: false, fog: !additive,
            blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {scale: {value: 600}, soft: {value: additive ? 1.6 : 1.1},
                // Fire, sparks and flares shine brighter than white on High/Ultra, so they glow.
                boost: {value: additive ? (D.glow || 1) : 1}}]),
        });
        const points = new THREE.Points(geo, mat);
        points.frustumCulled = false;
        points.renderOrder = additive ? 3 : 2;
        scene.add(points);
        const list = []; // {x,y,z, vx,vy,vz, life, max, s0, s1, c0:[r,g,b], c1, a0, drag, rise}
        const tmp = new THREE.Color(), tmp2 = new THREE.Color();
        return {
            mat,
            add(p, opts) {
                if (list.length >= max) list.shift();
                tmp.setHex(opts.color || 0xffffff);
                tmp2.setHex(opts.to === undefined ? opts.color || 0xffffff : opts.to);
                list.push({
                    x: p.x, y: p.y, z: p.z,
                    vx: opts.vx || 0, vy: opts.vy || 0, vz: opts.vz || 0,
                    life: opts.life || 1, max: opts.life || 1, s0: opts.size || 4, s1: opts.grow === undefined ? (opts.size || 4) * 2 : opts.grow,
                    c0: [tmp.r, tmp.g, tmp.b], c1: [tmp2.r, tmp2.g, tmp2.b], a0: opts.alpha === undefined ? 1 : opts.alpha,
                    drag: opts.drag || 0, rise: opts.rise || 0, fadeIn: opts.fadeIn || 0,
                });
            },
            update(dt) {
                let n = 0;
                for (let i = list.length - 1; i >= 0; i--) {
                    const q = list[i];
                    q.life -= dt;
                    if (q.life <= 0) {
                        list.splice(i, 1);
                        continue;
                    }
                    const k = Math.max(0, 1 - q.drag * dt);
                    q.vx *= k;
                    q.vy = q.vy * k + q.rise * dt;
                    q.vz *= k;
                    q.x += q.vx * dt;
                    q.y += q.vy * dt;
                    q.z += q.vz * dt;
                }
                for (const q of list) {
                    const t = 1 - q.life / q.max;
                    pos[n * 3] = q.x;
                    pos[n * 3 + 1] = q.y;
                    pos[n * 3 + 2] = q.z;
                    tint[n * 3] = q.c0[0] + (q.c1[0] - q.c0[0]) * t;
                    tint[n * 3 + 1] = q.c0[1] + (q.c1[1] - q.c0[1]) * t;
                    tint[n * 3 + 2] = q.c0[2] + (q.c1[2] - q.c0[2]) * t;
                    size[n] = q.s0 + (q.s1 - q.s0) * t;
                    const fade = q.fadeIn ? Math.min(1, t / q.fadeIn) : 1;
                    alpha[n] = q.a0 * (1 - t) * fade;
                    n++;
                }
                geo.setDrawRange(0, n);
                for (const a of ["position", "tint", "size", "alpha"]) geo.attributes[a].needsUpdate = true;
            },
            count: () => list.length,
        };
    }

    D.makeCombat = function (THREE, scene, world, events, opts = {}) {
        const quality = opts.quality || "high";
        const cap = {low: 1800, medium: 3500, high: 6000}[quality] || 6000;
        const smoke = makeParticles(THREE, scene, cap, false);
        const glow = makeParticles(THREE, scene, Math.round(cap * 0.6), true);
        const V = () => new THREE.Vector3();
        const rnd = s => (Math.random() - 0.5) * s;

        // ---- bullets: glowing line segments, bright at the head
        const bullets = [];
        const tracerPos = new Float32Array(MAX_BULLETS * 6), tracerCol = new Float32Array(MAX_BULLETS * 6);
        const tracerGeo = new THREE.BufferGeometry();
        tracerGeo.setAttribute("position", new THREE.BufferAttribute(tracerPos, 3));
        tracerGeo.setAttribute("color", new THREE.BufferAttribute(tracerCol, 3));
        const tracers = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false}));
        tracers.frustumCulled = false;
        tracers.renderOrder = 4;
        scene.add(tracers);

        // Guns sit in the wings or nose; tracers come from there.
        function fire(plane) {
            if (bullets.length >= MAX_BULLETS) return false;
            const f = plane.forward, spread = plane.heavyGun ? 0.007 : 0.009;
            const side = (plane.gunSide = -(plane.gunSide || 1));
            const dir = f.clone().add(V().set(rnd(spread), rnd(spread), rnd(spread))).normalize();
            const muzzle = plane.pos.clone().addScaledVector(f, 9 * plane.scale).addScaledVector(plane.right, side * (plane.shape === "jet" ? 1.4 : 2.6)).addScaledVector(plane.up, -0.4);
            const speed = 1000 * (plane.stats.bulletSpeed || 1);
            bullets.push({
                pos: muzzle, prev: muzzle.clone(), owner: plane, life: 1.7, tracer: (plane.tracerN = ((plane.tracerN || 0) + 1) % 2) === 0,
                vel: dir.multiplyScalar(speed).addScaledVector(plane.forward, plane.speed),
                dmg: plane.heavyGun ? 5 : 3.5,
            });
            glow.add(muzzle, {color: 0xffe0a0, to: 0xff7a20, size: 5, grow: 2, life: 0.05});
            return true;
        }

        // Closest distance from point c to the segment a-b.
        const ab = V(), ac = V();
        function segDist(a, b, c) {
            ab.subVectors(b, a);
            ac.subVectors(c, a);
            const t = Math.max(0, Math.min(1, ac.dot(ab) / (ab.lengthSq() || 1)));
            return ac.sub(ab.multiplyScalar(t)).length();
        }

        function impact(p) {
            if (world.water > -1000 && p.y <= world.water + 1) {
                for (let k = 0; k < 4; k++) smoke.add(p, {color: 0xe8f4ff, to: 0xffffff, size: 3, grow: 9, life: 0.9, vx: rnd(6), vy: 10 + Math.random() * 14, vz: rnd(6), rise: -25, alpha: 0.8});
            } else {
                smoke.add(p, {color: 0x9a8a6a, to: 0x7a6e5a, size: 3, grow: 12, life: 1.4, vy: 3, alpha: 0.7, drag: 1});
                glow.add(p, {color: 0xffd080, size: 2.5, grow: 0.5, life: 0.08});
            }
        }

        function updateBullets(dt, planes) {
            let n = 0;
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                b.prev.copy(b.pos);
                b.vel.y -= 9.8 * dt;
                b.pos.addScaledVector(b.vel, dt);
                b.life -= dt;
                let gone = b.life <= 0;
                if (!gone && b.pos.y < world.ground(b.pos.x, b.pos.z)) {
                    impact(b.pos);
                    gone = true;
                }
                if (!gone) {
                    for (const p of planes) {
                        if (!p.alive || p === b.owner || (p.team && p.team === b.owner.team)) continue;
                        if (Math.abs(p.pos.x - b.pos.x) > 80 || Math.abs(p.pos.z - b.pos.z) > 80) continue;
                        if (segDist(b.prev, b.pos, p.pos) < p.radius * p.scale * 0.85) {
                            for (let k = 0; k < 4; k++) glow.add(b.pos, {color: 0xfff0b0, to: 0xff6a00, size: 2.2, grow: 0.4, life: 0.25, vx: rnd(40) + p.velocity.x, vy: rnd(40) + p.velocity.y, vz: rnd(40) + p.velocity.z});
                            smoke.add(b.pos, {color: 0x555555, size: 2, grow: 6, life: 0.6, alpha: 0.6});
                            events.hit(b.owner, p, b.dmg, "gun", b.pos);
                            gone = true;
                            break;
                        }
                    }
                }
                if (gone) bullets.splice(i, 1);
            }
            const tail = V();
            for (const b of bullets) {
                if (!b.tracer) continue;
                tail.copy(b.pos).addScaledVector(b.vel, -0.03);
                tracerPos.set([b.pos.x, b.pos.y, b.pos.z, tail.x, tail.y, tail.z], n * 6);
                const hot = b.owner.team === "red" ? [1, 0.45, 0.25] : [1, 0.85, 0.4];
                const k = D.glow || 1;
                tracerCol.set([hot[0] * k, hot[1] * k, hot[2] * k, 0, 0, 0], n * 6);
                n++;
            }
            tracerGeo.setDrawRange(0, n * 2);
            tracerGeo.attributes.position.needsUpdate = true;
            tracerGeo.attributes.color.needsUpdate = true;
        }

        // ---- missiles and flares
        const missiles = [], flares = [];
        const missileGeo = new THREE.CylinderGeometry(0.3, 0.3, 3.6, 6);
        missileGeo.rotateX(Math.PI / 2);
        const missileMat = new THREE.MeshLambertMaterial({color: 0xf0f0f0});
        const finGeo = new THREE.BoxGeometry(1.4, 0.08, 0.6);

        function launch(plane, target) {
            const m = new THREE.Group();
            m.add(new THREE.Mesh(missileGeo, missileMat));
            const fin = new THREE.Mesh(finGeo, missileMat);
            fin.position.z = 1.5;
            m.add(fin);
            const fin2 = fin.clone();
            fin2.rotation.z = Math.PI / 2;
            m.add(fin2);
            const side = (plane.missileSide = -(plane.missileSide || 1));
            m.position.copy(plane.pos).addScaledVector(plane.up, -1.5).addScaledVector(plane.right, side * 3);
            scene.add(m);
            const smart = plane.smartMissiles;
            missiles.push({
                mesh: m, owner: plane, target: target || null, life: 9, burn: 4.5, smokeT: 0,
                vel: plane.forward.clone().multiplyScalar(plane.speed + 30), turn: smart ? 3.2 : 2.4, max: smart ? 720 : 620, armed: 0.25,
            });
            for (let k = 0; k < 6; k++) smoke.add(m.position, {color: 0xdddddd, size: 3, grow: 14, life: 1.5, vx: rnd(10), vy: rnd(10), vz: rnd(10), alpha: 0.7});
        }

        // 16 flares fired in pairs over about a second and a half, each burning
        // for about 6 seconds.
        function dropFlares(plane, chance = 0.85) {
            for (let k = 0; k < 16; k++) {
                // Shot out behind, below and to the sides.
                const out = plane.forward.clone().multiplyScalar(-55).addScaledVector(plane.up, -30).addScaledVector(plane.right, (k % 2 ? 1 : -1) * (25 + Math.random() * 35))
                    .add(V().set(rnd(20), rnd(12), rnd(20)));
                flares.push({pos: null, vel: out, life: 5.5 + Math.random() * 1.5, owner: plane, delay: Math.floor(k / 2) * 0.17 + (k % 2) * 0.035});
            }
            // Missiles chasing this plane go for the flares instead (most of the time).
            let fooled = 0;
            for (const m of missiles) {
                if (m.target !== plane) continue;
                if (Math.random() < chance) {
                    m.target = flares[flares.length - 1 - (Math.random() * 4 | 0)];
                    m.fooledFrom = plane;
                    fooled++;
                }
            }
            return fooled;
        }

        const tmpV = V(), want = V(), lead = V();
        function updateMissiles(dt, planes) {
            for (let i = flares.length - 1; i >= 0; i--) {
                const f = flares[i];
                if (f.delay > 0) {
                    f.delay -= dt;
                    continue;
                }
                // Leaves the plane when its turn comes (from where the plane is then).
                if (!f.pos) {
                    const p = f.owner;
                    f.pos = p.pos.clone().addScaledVector(p.forward, -8);
                    f.vel = p.velocity.multiplyScalar(0.55).add(f.vel);
                }
                f.life -= dt;
                f.vel.y -= 30 * dt;
                f.vel.multiplyScalar(1 - 0.9 * dt);
                f.pos.addScaledVector(f.vel, dt);
                const fade = Math.min(1, f.life / 1.5); // dims as it burns out
                glow.add(f.pos, {color: 0xffffff, to: 0xffd070, size: 8 * fade + 2, grow: 3, life: 0.08});
                smoke.add(f.pos, {color: 0xf2f2f2, to: 0xcccccc, size: 2, grow: 12, life: 2.6, alpha: 0.55 * fade});
                if (f.life <= 0) flares.splice(i, 1);
            }
            for (let i = missiles.length - 1; i >= 0; i--) {
                const m = missiles[i], t = m.target, mp = m.mesh.position;
                m.life -= dt;
                m.burn -= dt;
                m.armed -= dt;
                let speed = m.vel.length();
                speed = m.burn > 0 ? Math.min(m.max, speed + 320 * dt) : speed * (1 - 0.18 * dt);
                const dir = tmpV.copy(m.vel).normalize();
                const alive = t && t.pos && (t.alive !== false) && (t.life === undefined || t.life > 0);
                if (alive) {
                    // Lead pursuit: aim where the target will be.
                    const tgo = Math.min(2, t.pos.distanceTo(mp) / Math.max(200, speed));
                    lead.copy(t.pos);
                    if (t.velocity) lead.addScaledVector(t.velocity, tgo * 0.8);
                    want.copy(lead).sub(mp).normalize();
                    const ang = dir.angleTo(want), maxTurn = m.turn * dt;
                    if (ang > 1e-4) dir.lerp(want, Math.min(1, maxTurn / ang)).normalize();
                }
                m.vel.copy(dir).multiplyScalar(speed);
                mp.addScaledVector(m.vel, dt);
                m.mesh.lookAt(tmpV.copy(mp).add(m.vel));
                m.mesh.rotateY(Math.PI);
                m.smokeT -= dt;
                if (m.burn > 0 && m.smokeT <= 0) {
                    m.smokeT = 0.018;
                    smoke.add(mp, {color: 0xf0f0f0, to: 0xc8c8c8, size: 2.5, grow: 13, life: 2.6, alpha: 0.6, drag: 0.6, vx: rnd(3), vy: rnd(3), vz: rnd(3)});
                    glow.add(tmpV.copy(mp).addScaledVector(dir, -2.2), {color: 0xffffff, to: 0xff9a30, size: 4.5, grow: 1, life: 0.06});
                }
                let boom = m.life <= 0 || mp.y < world.ground(mp.x, mp.z);
                if (alive && t.radius && m.armed <= 0 && t.pos.distanceTo(mp) < 14) {
                    boom = true;
                    events.hit(m.owner, t, 55, "missile", mp);
                }
                if (alive && !t.radius && t.pos.distanceTo(mp) < 10) {
                    boom = true; // a flare
                    if (m.fooledFrom && events.flareSave) events.flareSave(m.fooledFrom, m.owner);
                }
                // Fly into a plane that isn't the target (not your own team, armed).
                if (!boom && m.armed <= 0 && (!t || t.radius)) {
                    for (const p of planes) if (p.alive && p !== m.owner && !(p.team && p.team === m.owner.team) && p.pos.distanceTo(mp) < p.radius * p.scale + 3) {
                        events.hit(m.owner, p, 55, "missile", mp);
                        boom = true;
                        break;
                    }
                }
                if (boom) {
                    explosion(mp, 0.5);
                    scene.remove(m.mesh);
                    missiles.splice(i, 1);
                }
            }
        }

        // ---- explosions, debris, smoke trails and vapor
        const debris = [];
        const debrisGeo = new THREE.BoxGeometry(1, 1, 1);

        function explosion(pos, scale = 1, color) {
            const n = Math.round(26 * scale + 6);
            for (let k = 0; k < n; k++) {
                const v = V().set(rnd(2), rnd(2), rnd(2)).normalize().multiplyScalar((15 + Math.random() * 45) * scale);
                glow.add(pos, {color: 0xfff0c0, to: 0x8a1a00, size: (8 + Math.random() * 10) * scale, grow: (22 + Math.random() * 16) * scale, life: 0.5 + Math.random() * 0.5, vx: v.x, vy: v.y, vz: v.z, drag: 3});
            }
            for (let k = 0; k < n; k++) {
                const v = V().set(rnd(2), rnd(2), rnd(2)).normalize().multiplyScalar((8 + Math.random() * 25) * scale);
                smoke.add(pos, {color: 0x2e2a28, to: 0x5a5856, size: (10 + Math.random() * 10) * scale, grow: (40 + Math.random() * 30) * scale, life: 3 + Math.random() * 2.5, vx: v.x, vy: v.y, vz: v.z, drag: 1.5, rise: 3, alpha: 0.85, fadeIn: 0.08});
            }
            for (let k = 0; k < 18 * scale; k++) {
                const v = V().set(rnd(2), rnd(2), rnd(2)).normalize().multiplyScalar(80 + Math.random() * 120);
                glow.add(pos, {color: 0xffe6a0, to: 0xff5000, size: 2, grow: 0.5, life: 0.5 + Math.random() * 0.6, vx: v.x, vy: v.y, vz: v.z, drag: 1});
            }
            events.boom && events.boom(pos, scale);
        }

        // A plane breaks apart: pieces fly off trailing smoke and fire.
        function breakUp(plane) {
            explosion(plane.pos, plane.radius > 12 ? 1.8 : 1.3);
            const color = new THREE.Color(plane.color);
            for (let k = 0; k < 7; k++) {
                const m = new THREE.Mesh(debrisGeo, new THREE.MeshLambertMaterial({color: k < 4 ? color : 0x333333, flatShading: true}));
                m.scale.set(1 + Math.random() * 3, 0.3 + Math.random() * 0.8, 1 + Math.random() * 3);
                m.position.copy(plane.pos);
                scene.add(m);
                debris.push({m, vel: plane.velocity.multiplyScalar(0.5).add(V().set(rnd(80), rnd(60) + 10, rnd(80))), spin: V().set(rnd(10), rnd(10), rnd(10)), life: 4 + Math.random() * 2, fire: k < 3});
            }
        }

        function updateDebris(dt) {
            for (let i = debris.length - 1; i >= 0; i--) {
                const d = debris[i];
                d.life -= dt;
                d.vel.y -= 9.8 * dt;
                d.vel.multiplyScalar(1 - 0.3 * dt);
                d.m.position.addScaledVector(d.vel, dt);
                d.m.rotation.x += d.spin.x * dt;
                d.m.rotation.y += d.spin.y * dt;
                d.m.rotation.z += d.spin.z * dt;
                if (Math.random() < 0.6) smoke.add(d.m.position, {color: 0x222222, to: 0x555555, size: 3, grow: 14, life: 2, alpha: 0.7, rise: 2});
                if (d.fire && Math.random() < 0.6) glow.add(d.m.position, {color: 0xffc040, to: 0xff2000, size: 4, grow: 1, life: 0.25});
                const g = world.ground(d.m.position.x, d.m.position.z);
                if (d.m.position.y < g || d.life <= 0) {
                    if (d.m.position.y < g + 5) impact(d.m.position);
                    scene.remove(d.m);
                    d.m.material.dispose();
                    debris.splice(i, 1);
                }
            }
        }

        // Every frame for every plane: damage smoke and fire, vapor off the
        // wingtips in hard turns, contrails up high, afterburner glow.
        const tip = V();
        let trailT = 0;
        function trails(dt, planes, camPos) {
            trailT -= dt;
            const emit = trailT <= 0;
            if (emit) trailT = quality === "low" ? 0.06 : 0.03;
            for (const p of planes) {
                if (!p.alive) continue;
                const far = camPos && p.pos.distanceTo(camPos) > 5000;
                if (!emit || far) continue;
                const dmg = 1 - p.health / p.maxHealth;
                const back = tip.copy(p.pos).addScaledVector(p.forward, -6 * p.scale);
                if (dmg > 0.4) smoke.add(back, {color: dmg > 0.7 ? 0x1e1e1e : 0x6a6a6a, to: 0x8a8a8a, size: 3 + dmg * 3, grow: 16 + dmg * 10, life: 2.4, alpha: 0.75, rise: 2});
                if (p.burning || dmg > 0.75) {
                    glow.add(back, {color: 0xffd060, to: 0xff2a00, size: 5, grow: 2, life: 0.3, vx: rnd(4), vy: rnd(4), vz: rnd(4)});
                    glow.add(back, {color: 0xff9a30, to: 0x801000, size: 6, grow: 3, life: 0.45});
                }
                if (p.g > 5 && p.speed > p.cornerSpeed * 0.8) {
                    for (let i = 0; i < 2; i++) smoke.add(p.tipWorld(i, tip), {color: 0xffffff, size: 0.8, grow: 2.2, life: 0.55, alpha: 0.5 * Math.min(1, (p.g - 5) / 3)});
                }
                if (p.pos.y > 3200 && p.shape !== "" ) {
                    for (let i = 0; i < 2; i++) smoke.add(p.tipWorld(i, tip), {color: 0xffffff, size: 1.2, grow: 9, life: 3, alpha: 0.4, fadeIn: 0.05});
                }
            }
        }

        return {
            fire, launch, dropFlares, explosion, breakUp,
            puff: (pos, color, size, life) => smoke.add(pos, {color, size, grow: size * 3, life}),
            spark: (pos, color = 0xffe0a0, size = 3, life = 0.2) => glow.add(pos, {color, size, grow: 0.5, life}),
            update(dt, planes, camera) {
                updateBullets(dt, planes);
                updateMissiles(dt, planes);
                updateDebris(dt);
                trails(dt, planes, camera && camera.position);
                if (camera) {
                    // Particle sizes are in meters: scale by the screen height and field of view.
                    const sc = window.innerHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
                    smoke.mat.uniforms.scale.value = sc;
                    glow.mat.uniforms.scale.value = sc;
                }
                smoke.update(dt);
                glow.update(dt);
            },
            missilesAt: plane => missiles.filter(m => m.target === plane),
            missiles: () => missiles,
            bulletCount: () => bullets.length,
            particleCount: () => smoke.count() + glow.count(),
        };
    };
})();
