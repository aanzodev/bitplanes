// Air Battle (3D): computer pilots. Each one picks an enemy to hunt (the one
// that shot at it, the closest, or you), flies a lead pursuit, fires short
// bursts when lined up, locks on and launches missiles, drops flares and
// breaks hard when a missile comes, uses the afterburner to catch up or
// escape, and never flies into hills, buildings or other planes. skill (0..1)
// sets how well it aims, how fast it reacts and how often it gets it right.
(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};

    D.makePilot = function (THREE, plane, skill = 0.7) {
        // Good pilots get a little more out of the same plane.
        plane.pilotBonus = 1 + 0.12 * skill;
        const tmp = new THREE.Vector3(), inv = new THREE.Quaternion(), goal = new THREE.Vector3(), look = new THREE.Vector3();
        const aimQ = new THREE.Quaternion(), idQ = new THREE.Quaternion();
        const ai = {
            plane, skill, target: null, retarget: 0, breakT: 0, breakDir: 1, pullUpT: 0, wobble: Math.random() * 10,
            lockT: 0, missileCd: 6 + Math.random() * 6, burstT: 0, pauseT: 0, flareCd: 0, react: 0,
        };

        const enemyOf = p => p !== plane && p.alive && (!plane.team || p.team !== plane.team);

        function pickTarget(ctx) {
            const {planes, player} = ctx;
            const foes = planes.filter(enemyOf);
            if (!foes.length) return null;
            // Whoever shot us recently.
            if (plane.lastHitBy && plane.lastHitBy.alive && enemyOf(plane.lastHitBy) && ctx.time - (plane.lastHitAt || 0) < 6 && Math.random() < 0.7) return plane.lastHitBy;
            if (enemyOf(player) && Math.random() < ctx.focusPlayer) return player;
            // Otherwise the easiest one: close, and already in front of us.
            const f = plane.forward;
            const cost = p => {
                tmp.copy(p.pos).sub(plane.pos);
                const d = tmp.length();
                return d * (1.6 - tmp.normalize().dot(f));
            };
            foes.sort((a, b) => cost(a) - cost(b));
            return foes[Math.random() < 0.8 ? 0 : Math.min(foes.length - 1, 1)];
        }

        // Steer so that `goalPos` ends up straight ahead. Returns how lined up we are (1 = dead ahead).
        function steerTo(goalPos, out) {
            inv.copy(plane.quat).invert();
            tmp.copy(goalPos).sub(plane.pos).normalize().applyQuaternion(inv);
            // tmp is now in the plane's own frame: x right, y up, -z ahead.
            const ahead = -tmp.z;
            // Roll so the goal is "above" us, then pull toward it.
            let roll = Math.atan2(tmp.x, Math.max(0.05, tmp.y));
            if (ahead > 0.97) roll *= 0.3;
            out.roll = Math.max(-1, Math.min(1, roll * 1.8));
            out.pitch = Math.max(-0.4, Math.min(1, tmp.y * 3.2 + (ahead < 0 ? 1 : 0)));
            out.yaw = Math.max(-1, Math.min(1, tmp.x * 2.5));
            return ahead;
        }

        ai.think = function (dt, ctx) {
            const {planes, world, combat, time} = ctx;
            const i = plane.input, f = plane.forward;
            i.throttle = 1;
            i.boost = false;
            delete i.throttleDelta;
            ai.wantFire = false;
            ai.flareCd -= dt;
            ai.missileCd -= dt;

            // 1. Don't hit the ground: look 1 to 4 seconds ahead, then pull up and level the wings.
            const gNow = world.ground(plane.pos.x, plane.pos.z);
            let danger = plane.pos.y - gNow < 180;
            for (let s = 1; s <= 4 && !danger; s++) {
                look.copy(plane.pos).addScaledVector(f, plane.speed * s);
                danger = look.y - world.ground(look.x, look.z) < 110 + 45 * s;
            }
            if (danger || ai.pullUpT > 0) {
                ai.pullUpT = danger ? 1.3 : ai.pullUpT - dt;
                i.roll = Math.max(-1, Math.min(1, plane.right.y * 4));
                i.pitch = plane.up.y > 0 ? 1 : 0.2;
                i.yaw = 0;
                i.boost = plane.speed < plane.cornerSpeed;
                return;
            }
            // 2. Missile coming: flares when it gets close, and break hard.
            const incoming = combat.missilesAt(plane);
            if (incoming.length) {
                const m = incoming[0], d = m.mesh.position.distanceTo(plane.pos);
                if (d < 650 && ai.flareCd <= 0 && plane.flares > 0 && Math.random() < 0.25 + 0.65 * skill) {
                    ctx.flare(plane);
                    ai.flareCd = 2.5;
                }
                if (d < 1200 && ai.breakT <= 0 && Math.random() < 0.3 + 0.6 * skill) {
                    ai.breakT = 1.2 + Math.random();
                    ai.breakDir = m.vel.dot(plane.right) > 0 ? 1 : -1;
                }
            }
            // 3. Too far out: head back to the middle.
            if (Math.hypot(plane.pos.x, plane.pos.z) > world.size * 0.4) {
                steerTo(goal.set(0, Math.max(1200, gNow + 900), 0), i);
                return;
            }
            // 4. About to fly into another plane: swerve.
            for (const p of planes) {
                if (p === plane || !p.alive) continue;
                tmp.copy(p.pos).sub(plane.pos);
                const d = tmp.length();
                if (d < 110 && tmp.dot(f) > 0) {
                    i.roll = tmp.dot(plane.right) > 0 ? -1 : 1;
                    i.pitch = tmp.dot(plane.up) > 0 ? -1 : 1;
                    return;
                }
            }
            // 5. Breaking: a hard turn away (someone on our tail, or a missile).
            if (ai.breakT > 0) {
                ai.breakT -= dt;
                i.roll = ai.breakDir * (plane.right.y * ai.breakDir > 0.8 ? 0 : 1);
                i.pitch = 1;
                i.yaw = ai.breakDir * 0.5;
                i.throttle = plane.speed > plane.cornerSpeed * 1.2 ? 0.4 : 1;
                return;
            }
            ai.retarget -= dt;
            if (!ai.target || !ai.target.alive || !enemyOf(ai.target) || ai.retarget <= 0) {
                ai.target = pickTarget(ctx);
                ai.retarget = 6 + Math.random() * 8;
                ai.lockT = 0;
            }
            const t = ai.target;
            if (!t) {
                steerTo(goal.set(Math.sin(time * 0.1) * 3000, Math.max(1400, gNow + 900), Math.cos(time * 0.1) * 3000), i);
                return;
            }
            // Someone right behind us: now and then, break (better pilots
            // notice sooner), then fight again for a while.
            ai.breakCd = (ai.breakCd || 0) - dt;
            if (ai.breakCd <= 0) for (const p of planes) {
                if (!enemyOf(p)) continue;
                tmp.copy(plane.pos).sub(p.pos);
                const d = tmp.length();
                if (d < 600 && p.forward.dot(tmp.normalize()) > 0.95 && Math.random() < dt * (0.12 + 0.4 * skill)) {
                    ai.breakT = 1 + Math.random() * 1.2;
                    ai.breakDir = Math.random() < 0.5 ? -1 : 1;
                    ai.breakCd = 5 + Math.random() * 4;
                    break;
                }
            }
            // 6. Lead the target: aim where it will be when the bullets arrive.
            const dist = t.pos.distanceTo(plane.pos);
            goal.copy(t.pos).addScaledVector(t.velocity, dist / 1000);
            ai.wobble += dt;
            // Aim error is an angle: worse pilots miss by more, further away.
            const wob = (0.6 + (1 - skill) * 2.4) * Math.min(dist, 1500) / 100;
            goal.x += Math.sin(ai.wobble * 1.7) * wob;
            goal.y += Math.cos(ai.wobble * 1.3) * wob;
            goal.z += Math.sin(ai.wobble * 0.9 + 2) * wob;
            // Stay above the ground while chasing.
            goal.y = Math.max(goal.y, world.ground(goal.x, goal.z) + 150);
            const ahead = steerTo(goal, i);
            if (dist < 300 && ahead > 0.9) i.throttle = 0.45; // don't overshoot
            if (dist > 1800 && ahead > 0.8 && plane.boost > plane.maxBoost * 0.5) i.boost = true;
            // 7. Guns: short bursts when the aim point is on the target (bigger
            //    and closer targets are easier). A practiced pilot finishes the
            //    last few degrees of tracking smoothly (the nose eases onto the aim point).
            let err = Math.acos(Math.min(1, ahead));
            if (err < 0.35 && dist < 1100) {
                const rate = (0.2 + 0.45 * skill) * dt;
                tmp.copy(goal).sub(plane.pos).normalize();
                aimQ.setFromUnitVectors(f.clone(), tmp);
                const turn = Math.min(1, rate / Math.max(err, 1e-4));
                plane.quat.premultiply(idQ.identity().slerp(aimQ, turn)).normalize();
                err = Math.max(0, err - rate);
            }
            const tol = Math.atan2(t.radius * 2.4, dist) + 0.012 + (1 - skill) * 0.012;
            const lined = err < tol && dist < 950;
            if (ai.burstT > 0) {
                ai.burstT -= dt;
                ai.wantFire = err < tol * 1.8 && dist < 1100;
            } else if (ai.pauseT > 0) ai.pauseT -= dt;
            else if (lined) {
                ai.burstT = 0.5 + Math.random() * 0.9;
                ai.pauseT = 0.3 + Math.random() * 0.6;
                ai.wantFire = true;
            }
            // 8. Missiles: hold the target in front to lock, then fire.
            const inCone = ahead > 0.9 && dist > 350 && dist < 2600;
            if (inCone && plane.missiles > 0 && ai.missileCd <= 0) {
                ai.lockT += dt;
                t.lockedBy = plane;
                t.lockedAt = time;
                if (ai.lockT > 2.6 - 1.2 * skill) {
                    ctx.launch(plane, t);
                    ai.lockT = 0;
                    ai.missileCd = 10 + Math.random() * 10 - 4 * skill;
                }
            } else ai.lockT = Math.max(0, ai.lockT - dt * 2);
            ai.locking = ai.lockT > 0 ? t : null;
        };
        return ai;
    };
})();
