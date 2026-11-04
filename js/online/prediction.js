(function () {
    const O = window.BitOnline;
    const {engine, engineClasses, SNAPSHOT_MS} = O;
    const STEP = 1 / 60;

    const p = {
        view: null,
        sim: null,
        plane: null,
        hostId: 0,
        acc: 0,
        last: 0,
        sentAt: 0,
        input: {},
        send: null,
        shown: new Set(),
    };

    function start(view, send) {
        const e = engine();
        const sim = new e.World({width: view.width, height: view.height, ground: 0, stratosphere: view.stratosphere});
        sim.ground = view.ground;
        sim.participants = [];
        sim.effects = view.effects;
        Object.assign(p, {view, sim, send, last: performance.now()});
        setInterval(controlTick, e.consts.c);
    }

    function flying() {
        return p.plane && p.sim.has(p.plane) ? p.plane : undefined;
    }

    function controlTick() {
        const plane = flying();
        if (!plane) return;
        const e = engine(), i = p.input;
        if (i.fire) e.controls.d(p.sim, plane);
        if (i.down) plane.thrust = Math.max(0, plane.thrust - 2);
        if (i.up) plane.thrust = Math.min(plane.maxThrust || e.consts.k, plane.thrust + 2);
        steer();
        e.cockpit(plane);
    }

    function steer() {
        const plane = flying(), i = p.input;
        if (plane) plane.elevator = i.left && !i.right ? -1 : !i.left && i.right ? 1 : 0;
    }

    function setInput(input) {
        const before = p.input;
        p.input = input;
        steer();
        const plane = flying(), e = engine();
        if (!plane) return;
        if (input.fire && !before.fire) e.controls.d(p.sim, plane);
        if (input.up && !before.up) plane.thrust = Math.min(plane.maxThrust || e.consts.k, plane.thrust + 2);
        if (input.down && !before.down) plane.thrust = Math.max(0, plane.thrust - 2);
        e.cockpit(plane);
    }

    function sync(ghost, hud) {
        const isPlane = ghost && ghost.constructor === engineClasses().Plane;
        if (!isPlane) return stop();
        if (ghost.netId !== p.hostId) begin(ghost, hud);
        const plane = flying();
        if (plane && hud) {
            [plane.missiles, plane.maxMissiles] = [hud[2], hud[3]];
            [plane.flares, plane.maxFlares] = [hud[6], hud[7]];
            if (typeof hud[9] === "number") [plane.life, plane.maxLife] = [hud[9], hud[10]];
        }
    }

    function begin(ghost, hud) {
        stop();
        const e = engine();
        const last = ghost.hist && ghost.hist[ghost.hist.length - 1];
        if (!last) return;
        const color = String(ghost.look || "").split("|")[1] || "#145ece";
        const plane = new e.Plane(color);
        plane.life = e.consts.h;
        plane.maxAmmo = plane.ammo = e.consts.f;
        plane.move(e.vec(last[1], last[2]));
        plane.angle = last[3];
        plane.landed = !!(hud && hud[8]);
        plane.player = {isHuman: true, loadoutColor: color};
        window.BitMarket && window.BitMarket.apply(plane);
        plane.player = undefined;
        p.sim.add(plane);
        p.plane = plane;
        p.hostId = ghost.netId;
        p.ghost = ghost;
        p.view.worldEntities.delete(ghost);
        p.acc = 0;
        p.last = performance.now();
    }

    function stop() {
        if (p.plane) p.sim.delete(p.plane);
        p.plane = null;
        if (p.ghost && p.ghost.goneAt === undefined) p.view.add(p.ghost);
        p.ghost = null;
        p.hostId = 0;
    }

    function step() {
        if (!p.sim) return 1;
        const e = engine(), now = performance.now();
        if (O.match && O.match.frozen()) {
            p.last = now;
            p.acc = 0;
            return 1;
        }
        p.acc += Math.min(0.1, (now - p.last) / 1000);
        p.last = now;
        const wasFlying = flying();
        for (; p.acc >= STEP; p.acc -= STEP) e.physicsStep(p.sim, STEP);

        for (const o of [...p.sim.worldEntities, ...p.sim.projectiles]) {
            if (!p.shown.has(o)) {
                p.shown.add(o);
                p.view.add(o);
            }
        }
        for (const o of p.shown) {
            if (!p.sim.has(o)) {
                p.view.worldEntities.delete(o);
                p.view.projectiles.delete(o);
                p.shown.delete(o);
            }
        }

        const plane = flying();
        if (wasFlying && !plane) report(wasFlying);
        else if (plane && now - p.sentAt >= SNAPSHOT_MS - 4) report(plane);
        return p.acc / STEP;
    }

    function report(plane) {
        p.sentAt = performance.now();
        const r = v => Math.round(v * 100) / 100;
        p.send({t: "st", s: [p.hostId, r(plane.position.x), r(plane.position.y), r(plane.velocity.x), r(plane.velocity.y),
            r(plane.angle), r(plane.thrust), plane.elevator, plane.landed ? 1 : 0, Math.round(p.sentAt * 10) / 10]});
    }

    O.prediction = {start, sync, step, setInput, plane: flying};
})();
