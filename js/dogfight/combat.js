// Dogfights (3D beta): bullets (drawn as glowing tracers), homing missiles,
// flares, explosions, and smoke and fire from damaged planes.
(function () {
    const D = window.BitDogfight = window.BitDogfight || {};
    const MAX_BULLETS = 900;

    D.makeCombat = function (THREE, scene, world, events) {
        // ---- bullets: one line segment each, all in one mesh
        const bullets = [];
        const tracerPos = new Float32Array(MAX_BULLETS * 6);
        const tracerGeo = new THREE.BufferGeometry();
        tracerGeo.setAttribute("position", new THREE.BufferAttribute(tracerPos, 3));
        const tracers = new THREE.LineSegments(tracerGeo, new THREE.LineBasicMaterial({color: 0xffd25a, transparent: true, opacity: 0.95}));
        tracers.frustumCulled = false;
        scene.add(tracers);

        function fire(plane) {
            if (bullets.length >= MAX_BULLETS) return false;
            const f = plane.forward, spread = 0.006;
            const dir = f.clone().add(new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
            const muzzle = plane.pos.clone().addScaledVector(f, 9).addScaledVector(plane.up, -0.5);
            bullets.push({
                pos: muzzle, prev: muzzle.clone(), owner: plane, life: 1.6,
                vel: dir.multiplyScalar(820 * (plane.stats.bulletSpeed || 1) + plane.speed),
                dmg: plane.heavyGun ? 2 : 1,
            });
            return true;
        }

        // Closest distance from point c to the segment a-b.
        const ab = new THREE.Vector3(), ac = new THREE.Vector3();
        function segDist(a, b, c) {
            ab.subVectors(b, a);
            ac.subVectors(c, a);
            const t = Math.max(0, Math.min(1, ac.dot(ab) / (ab.lengthSq() || 1)));
            return ac.sub(ab.multiplyScalar(t)).length();
        }

        function updateBullets(dt, planes) {
            let n = 0;
            for (let i = bullets.length - 1; i >= 0; i--) {
                const b = bullets[i];
                b.prev.copy(b.pos);
                b.pos.addScaledVector(b.vel, dt);
                b.life -= dt;
                let gone = b.life <= 0;
                if (!gone && b.pos.y < world.ground(b.pos.x, b.pos.z)) {
                    puff(b.pos, 0x8a7a60, 3, 0.5);
                    gone = true;
                }
                if (!gone) {
                    for (const p of planes) {
                        if (!p.alive || p === b.owner) continue;
                        if (segDist(b.prev, b.pos, p.pos) < p.radius) {
                            sparks(b.pos);
                            events.hit(b.owner, p, b.dmg);
                            gone = true;
                            break;
                        }
                    }
                }
                if (gone) bullets.splice(i, 1);
            }
            for (const b of bullets) {
                if (n >= MAX_BULLETS) break;
                const tail = b.pos.clone().addScaledVector(b.vel, -0.022);
                tracerPos.set([b.pos.x, b.pos.y, b.pos.z, tail.x, tail.y, tail.z], n * 6);
                n++;
            }
            tracerGeo.setDrawRange(0, n * 2);
            tracerGeo.attributes.position.needsUpdate = true;
        }

        // ---- missiles and flares
        const missiles = [], flares = [];
        const missileGeo = new THREE.CylinderGeometry(0.35, 0.35, 4, 6);
        missileGeo.rotateX(Math.PI / 2);
        const missileMat = new THREE.MeshLambertMaterial({color: 0xe8e8e8});

        function launch(plane, target) {
            const m = new THREE.Mesh(missileGeo, missileMat);
            m.position.copy(plane.pos).addScaledVector(plane.up, -2);
            scene.add(m);
            missiles.push({mesh: m, owner: plane, target, vel: plane.forward.clone().multiplyScalar(plane.speed + 40), life: 7, smokeT: 0});
        }

        function dropFlares(plane) {
            for (let k = 0; k < 6; k++) {
                // Shot out behind and below the plane, fanning sideways.
                const out = plane.forward.multiplyScalar(-70).addScaledVector(plane.up, -35)
                    .add(new THREE.Vector3((Math.random() - 0.5) * 60, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 60));
                const f = {pos: plane.pos.clone().addScaledVector(plane.forward, -10), vel: plane.velocity.multiplyScalar(0.4).add(out), life: 3, owner: plane};
                f.mesh = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 4), new THREE.MeshBasicMaterial({color: 0xfff1a8}));
                scene.add(f.mesh);
                flares.push(f);
            }
            // Missiles chasing this plane go for the flares instead.
            for (const m of missiles) if (m.target === plane && Math.random() < 0.9) m.target = flares[flares.length - 1 - (Math.random() * 3 | 0)];
        }

        function updateMissiles(dt, planes) {
            for (let i = flares.length - 1; i >= 0; i--) {
                const f = flares[i];
                f.vel.y -= 25 * dt;
                f.pos.addScaledVector(f.vel, dt);
                f.mesh.position.copy(f.pos);
                f.life -= dt;
                if (Math.random() < 0.5) puff(f.pos, 0xdddddd, 2.5, 0.8);
                if (f.life <= 0) {
                    scene.remove(f.mesh);
                    flares.splice(i, 1);
                }
            }
            for (let i = missiles.length - 1; i >= 0; i--) {
                const m = missiles[i], t = m.target;
                m.life -= dt;
                const speed = Math.min(520, m.vel.length() + 260 * dt);
                const dir = m.vel.clone().normalize();
                const tpos = t && (t.alive !== false) && (t.life === undefined || t.life > 0) ? t.pos : null;
                if (tpos) {
                    const want = tpos.clone().sub(m.mesh.position).normalize();
                    dir.lerp(want, Math.min(1, 2.4 * dt)).normalize();
                }
                m.vel.copy(dir).multiplyScalar(speed);
                m.mesh.position.addScaledVector(m.vel, dt);
                m.mesh.lookAt(m.mesh.position.clone().add(m.vel));
                m.smokeT -= dt;
                if (m.smokeT <= 0) {
                    puff(m.mesh.position, 0xe0e0e0, 3, 1.4);
                    m.smokeT = 0.03;
                }
                let boom = m.life <= 0 || m.mesh.position.y < world.ground(m.mesh.position.x, m.mesh.position.z);
                if (tpos && tpos.distanceTo(m.mesh.position) < 14) {
                    boom = true;
                    if (t.radius) events.hit(m.owner, t, 10);
                }
                // A missile fooled by a flare only explodes on the flare.
                if (!boom && (!t || t.radius)) {
                    for (const p of planes) if (p.alive && p !== m.owner && p.pos.distanceTo(m.mesh.position) < p.radius + 4) {
                        events.hit(m.owner, p, 10);
                        boom = true;
                        break;
                    }
                }
                if (boom) {
                    explosion(m.mesh.position, 0.6);
                    scene.remove(m.mesh);
                    missiles.splice(i, 1);
                }
            }
        }

        // ---- effects: puffs of smoke, fire, sparks and explosions
        const fx = [];
        const puffGeo = new THREE.IcosahedronGeometry(1, 0);

        function puff(pos, color, size, life, rise = 4) {
            if (fx.length > 700) return;
            const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0.8, depthWrite: false}));
            m.position.copy(pos);
            m.scale.setScalar(size);
            scene.add(m);
            fx.push({m, life, max: life, grow: size * 1.8, rise});
        }

        function sparks(pos) {
            for (let k = 0; k < 3; k++) puff(pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3)), 0xffe08a, 1.2, 0.25, 0);
        }

        function explosion(pos, scale = 1) {
            for (let k = 0; k < 14; k++) {
                const o = new THREE.Vector3((Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16).multiplyScalar(scale);
                puff(pos.clone().add(o), [0xffd23f, 0xff7a00, 0xff3d00][k % 3], (5 + Math.random() * 5) * scale, 0.7 + Math.random() * 0.4, 8);
            }
            for (let k = 0; k < 10; k++) {
                const o = new THREE.Vector3((Math.random() - 0.5) * 20, Math.random() * 10, (Math.random() - 0.5) * 20).multiplyScalar(scale);
                puff(pos.clone().add(o), 0x3a3a3a, (6 + Math.random() * 6) * scale, 2 + Math.random(), 10);
            }
            events.boom && events.boom(pos, scale);
        }

        // Damaged planes trail smoke; badly damaged ones burn.
        let trailT = 0;
        function trails(dt, planes) {
            trailT -= dt;
            if (trailT > 0) return;
            trailT = 0.05;
            for (const p of planes) {
                if (!p.alive) continue;
                const dmg = 1 - p.health / p.maxHealth;
                if (dmg < 0.3) continue;
                const back = p.pos.clone().addScaledVector(p.forward, -7);
                puff(back, dmg > 0.6 ? 0x2b2b2b : 0x8a8a8a, 2 + dmg * 3, 1.6, 2);
                if (dmg > 0.6) puff(back, 0xff7a00, 1.8, 0.3, 0);
            }
        }

        function updateFx(dt) {
            for (let i = fx.length - 1; i >= 0; i--) {
                const f = fx[i];
                f.life -= dt;
                if (f.life <= 0) {
                    scene.remove(f.m);
                    f.m.material.dispose();
                    fx.splice(i, 1);
                    continue;
                }
                const k = f.life / f.max;
                f.m.material.opacity = 0.85 * k;
                f.m.scale.addScalar(f.grow * dt);
                f.m.position.y += f.rise * dt;
            }
        }

        return {
            fire, launch, dropFlares, explosion, puff,
            update(dt, planes) {
                updateBullets(dt, planes);
                updateMissiles(dt, planes);
                trails(dt, planes);
                updateFx(dt);
            },
            missilesAt: plane => missiles.filter(m => m.target === plane).length,
            bulletCount: () => bullets.length,
        };
    };
})();
