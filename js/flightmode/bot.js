(function () {
    const D = window.BitFlightMode = window.BitFlightMode || {};

    D.makePilot = function (THREE, plane, skill = 0.7) {
        plane.pilotBonus = 1 + 0.12 * skill;
        const tmp = new THREE.Vector3(), inv = new THREE.Quaternion(), goal = new THREE.Vector3(), look = new THREE.Vector3();
        const aimQ = new THREE.Quaternion(), idQ = new THREE.Quaternion();
        const bot = {
            plane, skill, target: null, retarget: 0, breakT: 0, breakDir: 1, pullUpT: 0, wobble: Math.random() * 10,
            lockT: 0, missileCd: 6 + Math.random() * 6, burstT: 0, pauseT: 0, flareCd: 0, react: 0,
        };

        const enemyOf = p => p !== plane && p.alive && (!plane.team || p.team !== plane.team);

        function pickTarget(ctx) {
            const {planes, player} = ctx;
            const foes = planes.filter(enemyOf);
            if (!foes.length) return null;
            if (plane.lastHitBy && plane.lastHitBy.alive && enemyOf(plane.lastHitBy) && ctx.time - (plane.lastHitAt || 0) < 6 && Math.random() < 0.7) return plane.lastHitBy;
            if (enemyOf(player) && Math.random() < ctx.focusPlayer) return player;
            const f = plane.forward;
            const cost = p => {
                tmp.copy(p.pos).sub(plane.pos);
                const d = tmp.length();
                return d * (1.6 - tmp.normalize().dot(f));
            };
            foes.sort((a, b) => cost(a) - cost(b));
            return foes[Math.random() < 0.8 ? 0 : Math.min(foes.length - 1, 1)];
        }

        function steerTo(goalPos, out) {
            inv.copy(plane.quat).invert();
            tmp.copy(goalPos).sub(plane.pos).normalize().applyQuaternion(inv);
            const ahead = -tmp.z;
            let roll = Math.atan2(tmp.x, Math.max(0.05, tmp.y));
            if (ahead > 0.97) roll *= 0.3;
            out.roll = Math.max(-1, Math.min(1, roll * 1.8));
            out.pitch = Math.max(-0.4, Math.min(1, tmp.y * 3.2 + (ahead < 0 ? 1 : 0)));
            out.yaw = Math.max(-1, Math.min(1, tmp.x * 2.5));
            return ahead;
        }

        bot.think = function (dt, ctx) {
            const {planes, world, combat, time} = ctx;
            const i = plane.input, f = plane.forward;
            i.throttle = 1;
            i.boost = false;
            delete i.throttleDelta;
            bot.wantFire = false;
            bot.flareCd -= dt;
            bot.missileCd -= dt;

            const gNow = world.ground(plane.pos.x, plane.pos.z);
            let danger = plane.pos.y - gNow < 180;
            for (let s = 1; s <= 4 && !danger; s++) {
                look.copy(plane.pos).addScaledVector(f, plane.speed * s);
                danger = look.y - world.ground(look.x, look.z) < 110 + 45 * s;
            }
            if (danger || bot.pullUpT > 0) {
                bot.pullUpT = danger ? 1.3 : bot.pullUpT - dt;
                i.roll = Math.max(-1, Math.min(1, plane.right.y * 4));
                i.pitch = plane.up.y > 0 ? 1 : 0.2;
                i.yaw = 0;
                i.boost = plane.speed < plane.cornerSpeed;
                return;
            }
            const incoming = combat.missilesAt(plane);
            if (incoming.length) {
                const m = incoming[0], d = m.mesh.position.distanceTo(plane.pos);
                if (d < 650 && bot.flareCd <= 0 && plane.flares > 0 && Math.random() < 0.25 + 0.65 * skill) {
                    ctx.flare(plane);
                    bot.flareCd = 2.5;
                }
                if (d < 1200 && bot.breakT <= 0 && Math.random() < 0.3 + 0.6 * skill) {
                    bot.breakT = 1.2 + Math.random();
                    bot.breakDir = m.vel.dot(plane.right) > 0 ? 1 : -1;
                }
            }
            if (Math.hypot(plane.pos.x, plane.pos.z) > world.size * 0.4) {
                steerTo(goal.set(0, Math.max(1200, gNow + 900), 0), i);
                return;
            }
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
            if (bot.breakT > 0) {
                bot.breakT -= dt;
                i.roll = bot.breakDir * (plane.right.y * bot.breakDir > 0.8 ? 0 : 1);
                i.pitch = 1;
                i.yaw = bot.breakDir * 0.5;
                i.throttle = plane.speed > plane.cornerSpeed * 1.2 ? 0.4 : 1;
                return;
            }
            bot.retarget -= dt;
            if (!bot.target || !bot.target.alive || !enemyOf(bot.target) || bot.retarget <= 0) {
                bot.target = pickTarget(ctx);
                bot.retarget = 6 + Math.random() * 8;
                bot.lockT = 0;
            }
            const t = bot.target;
            if (!t) {
                steerTo(goal.set(Math.sin(time * 0.1) * 3000, Math.max(1400, gNow + 900), Math.cos(time * 0.1) * 3000), i);
                return;
            }
            bot.breakCd = (bot.breakCd || 0) - dt;
            if (bot.breakCd <= 0) for (const p of planes) {
                if (!enemyOf(p)) continue;
                tmp.copy(plane.pos).sub(p.pos);
                const d = tmp.length();
                if (d < 600 && p.forward.dot(tmp.normalize()) > 0.95 && Math.random() < dt * (0.12 + 0.4 * skill)) {
                    bot.breakT = 1 + Math.random() * 1.2;
                    bot.breakDir = Math.random() < 0.5 ? -1 : 1;
                    bot.breakCd = 5 + Math.random() * 4;
                    break;
                }
            }
            const dist = t.pos.distanceTo(plane.pos);
            goal.copy(t.pos).addScaledVector(t.velocity, dist / 1000);
            bot.wobble += dt;
            const wob = (0.6 + (1 - skill) * 2.4) * Math.min(dist, 1500) / 100;
            goal.x += Math.sin(bot.wobble * 1.7) * wob;
            goal.y += Math.cos(bot.wobble * 1.3) * wob;
            goal.z += Math.sin(bot.wobble * 0.9 + 2) * wob;
            goal.y = Math.max(goal.y, world.ground(goal.x, goal.z) + 150);
            const ahead = steerTo(goal, i);
            if (dist < 300 && ahead > 0.9) i.throttle = 0.45;
            if (dist > 1800 && ahead > 0.8 && plane.boost > plane.maxBoost * 0.5) i.boost = true;
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
            if (bot.burstT > 0) {
                bot.burstT -= dt;
                bot.wantFire = err < tol * 1.8 && dist < 1100;
            } else if (bot.pauseT > 0) bot.pauseT -= dt;
            else if (lined) {
                bot.burstT = 0.5 + Math.random() * 0.9;
                bot.pauseT = 0.3 + Math.random() * 0.6;
                bot.wantFire = true;
            }
            const inCone = ahead > 0.9 && dist > 350 && dist < 2600;
            if (inCone && plane.missiles > 0 && bot.missileCd <= 0) {
                bot.lockT += dt;
                t.lockedBy = plane;
                t.lockedAt = time;
                if (bot.lockT > 2.6 - 1.2 * skill) {
                    ctx.launch(plane, t);
                    bot.lockT = 0;
                    bot.missileCd = 10 + Math.random() * 10 - 4 * skill;
                }
            } else bot.lockT = Math.max(0, bot.lockT - dt * 2);
            bot.locking = bot.lockT > 0 ? t : null;
        };
        return bot;
    };
})();
