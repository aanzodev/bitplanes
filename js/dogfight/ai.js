// Dogfights (3D beta): computer pilots. Each one picks someone to chase
// (often you), flies to where its target is going to be, fires when lined
// up, breaks hard when someone is on its tail, and never flies into a hill.
(function () {
    const D = window.BitDogfight = window.BitDogfight || {};

    D.makePilot = function (THREE, plane, skill = 0.7) {
        const tmp = new THREE.Vector3(), inv = new THREE.Quaternion();
        const ai = {plane, target: null, retarget: 0, breakT: 0, breakDir: 1, pullUpT: 0, missileT: 4 + Math.random() * 6, wobble: Math.random() * 10};

        function pickTarget(planes, player) {
            const others = planes.filter(p => p !== plane && p.alive);
            if (!others.length) return null;
            // Prefer the player a bit, otherwise the closest plane.
            if (player.alive && Math.random() < 0.45) return player;
            others.sort((a, b) => a.pos.distanceTo(plane.pos) - b.pos.distanceTo(plane.pos));
            return others[0];
        }

        // Steer so that the point `goal` ends up straight ahead.
        function steerTo(goal, out) {
            inv.copy(plane.quat).invert();
            tmp.copy(goal).sub(plane.pos).normalize().applyQuaternion(inv);
            // tmp is now in the plane's own frame: x right, y up, -z ahead.
            const ahead = -tmp.z;
            // Roll so the goal is "above" us, then pull up toward it.
            let roll = Math.atan2(tmp.x, Math.max(0.05, tmp.y));
            if (ahead > 0.97) roll *= 0.3; // almost lined up: small corrections
            out.roll = Math.max(-1, Math.min(1, roll * 1.6));
            out.pitch = Math.max(-0.4, Math.min(1, tmp.y * 3 + (ahead < 0 ? 1 : 0)));
            out.yaw = Math.max(-1, Math.min(1, tmp.x * 2));
            return ahead;
        }

        ai.think = function (dt, ctx) {
            const {planes, player, world, combat, time} = ctx;
            const i = plane.input, f = plane.forward;
            i.throttle = 1;
            delete i.throttleDelta;

            // 1. Don't hit the ground: check 1, 2, 3 and 4 seconds ahead, then
            //    pull up and level the wings.
            let danger = plane.pos.y - world.ground(plane.pos.x, plane.pos.z) < 220;
            for (let s = 1; s <= 4 && !danger; s++) {
                const look = plane.pos.clone().addScaledVector(f, plane.speed * s);
                danger = look.y - world.ground(look.x, look.z) < 120 + 40 * s;
            }
            if (danger || ai.pullUpT > 0) {
                // Keep climbing a moment after the danger has passed.
                ai.pullUpT = danger ? 1.2 : ai.pullUpT - dt;
                i.roll = Math.max(-1, Math.min(1, plane.right.y * 4));
                i.pitch = 1;
                i.yaw = 0;
                return;
            }
            // 2. Too far out: head back to the middle.
            if (Math.hypot(plane.pos.x, plane.pos.z) > world.size * 0.38) {
                steerTo(new THREE.Vector3(0, 1100, 0), i);
                return;
            }
            // 3. About to fly into another plane: swerve.
            for (const p of planes) {
                if (p === plane || !p.alive) continue;
                const to = p.pos.clone().sub(plane.pos), d = to.length();
                if (d < 90 && to.dot(f) > 0) {
                    i.roll = to.dot(plane.right) > 0 ? -1 : 1;
                    i.pitch = to.dot(plane.up) > 0 ? -1 : 1;
                    return;
                }
            }
            // 4. Someone on our tail: break turn.
            if (ai.breakT > 0) {
                ai.breakT -= dt;
                i.roll = ai.breakDir;
                i.pitch = 1;
                i.yaw = ai.breakDir * 0.5;
                return;
            }
            ai.retarget -= dt;
            if (!ai.target || !ai.target.alive || ai.retarget <= 0) {
                ai.target = pickTarget(planes, player);
                ai.retarget = 6 + Math.random() * 6;
            }
            const t = ai.target;
            if (!t) {
                steerTo(new THREE.Vector3(Math.sin(time * 0.1) * 1500, 1200, Math.cos(time * 0.1) * 1500), i);
                return;
            }
            for (const p of planes) {
                if (p === plane || !p.alive) continue;
                const toUs = plane.pos.clone().sub(p.pos);
                const d = toUs.length();
                if (d < 350 && p.forward.dot(toUs.normalize()) > 0.96 && Math.random() < 0.02) {
                    ai.breakT = 1 + Math.random() * 1.5;
                    ai.breakDir = Math.random() < 0.5 ? -1 : 1;
                }
            }
            // 5. Lead the target: aim where it will be when the bullets arrive.
            const dist = t.pos.distanceTo(plane.pos);
            const lead = t.pos.clone().addScaledVector(t.velocity, dist / 900);
            // A less skilled pilot aims worse.
            ai.wobble += dt;
            lead.x += Math.sin(ai.wobble * 1.7) * (1 - skill) * 60;
            lead.y += Math.cos(ai.wobble * 1.3) * (1 - skill) * 60;
            const ahead = steerTo(lead, i);
            if (dist < 260 && ahead > 0.9) i.throttle = 0.55; // don't overshoot
            // 6. Shoot when lined up.
            ai.wantFire = ahead > 0.996 && dist < 1000;
            ai.missileT -= dt;
            if (ai.missileT <= 0 && plane.missiles > 0 && ahead > 0.97 && dist > 400 && dist < 2200) {
                combat.launch(plane, t);
                plane.missiles--;
                ai.missileT = 12 + Math.random() * 10;
            }
        };
        return ai;
    };
})();
