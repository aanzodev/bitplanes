// Online play, guest side: fly the guest's own plane right here in the
// browser so turning, thrust and bullets react instantly, instead of waiting
// for the host. The guest tells the host where its plane is ~30 times a
// second; the host still decides hits, damage and deaths, and when it says
// the plane is gone (shot down, crashed, ejected) the local copy goes too.
(function () {
    const O = window.BitOnline;
    const {engine, engineClasses, SNAPSHOT_MS} = O;
    const STEP = 1 / 60;

    const p = {
        view: null,        // the world the guest sees (host snapshots)
        sim: null,         // a small world that only holds our plane and its bullets
        plane: null,       // our locally simulated plane
        hostId: 0,         // the host's id for the plane we are flying
        acc: 0,
        last: 0,
        sentAt: 0,
        input: {},
        send: null,
        shown: new Set(),  // local objects currently drawn in the view world
    };

    function start(view, send) {
        const e = engine();
        const sim = new e.World({width: view.width, height: view.height, ground: 0, stratosphere: view.stratosphere});
        sim.ground = view.ground;
        sim.players = [];
        sim.particles = view.particles; // smoke and explosions show up in the guest's view
        Object.assign(p, {view, sim, send, last: performance.now()});
        setInterval(controlTick, e.consts.c);
    }

    function flying() {
        return p.plane && p.sim.has(p.plane) ? p.plane : undefined;
    }

    // Same rules as the keyboard controls in single player.
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
        // React to a fresh press right away instead of on the next control tick.
        const plane = flying(), e = engine();
        if (!plane) return;
        if (input.fire && !before.fire) e.controls.d(p.sim, plane);
        if (input.up && !before.up) plane.thrust = Math.min(plane.maxThrust || e.consts.k, plane.thrust + 2);
        if (input.down && !before.down) plane.thrust = Math.max(0, plane.thrust - 2);
        e.cockpit(plane);
    }

    // Called with every snapshot: start, keep or stop flying locally.
    // ghost: the host's copy of our current object; hud: host's cockpit numbers.
    function sync(ghost, hud) {
        const isPlane = ghost && ghost.constructor === engineClasses().Plane;
        if (!isPlane) return stop();
        if (ghost.netId !== p.hostId) begin(ghost, hud);
        const plane = flying();
        if (plane && hud) {
            // Missiles and flares are fired by the host; show its counts.
            [plane.missiles, plane.maxMissiles] = [hud[2], hud[3]];
            [plane.flares, plane.maxFlares] = [hud[6], hud[7]];
            // Health comes from the host, which decides hits.
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
        // Apply this browser's Hangar plane and upgrades, then detach the
        // temporary player so local crashes don't write to the kill log.
        plane.player = {isHuman: true, loadoutColor: color};
        window.BitShop && window.BitShop.apply(plane);
        plane.player = undefined;
        p.sim.add(plane);
        p.plane = plane;
        p.hostId = ghost.netId;
        p.ghost = ghost;
        p.view.bodies.delete(ghost); // draw our local plane instead of the host's copy
        p.acc = 0;
        p.last = performance.now();
    }

    function stop() {
        if (p.plane) p.sim.delete(p.plane);
        p.plane = null;
        // Show the host's copy again (for example after ejecting, the empty plane keeps flying).
        if (p.ghost && p.ghost.goneAt === undefined) p.view.add(p.ghost);
        p.ghost = null;
        p.hostId = 0;
    }

    // Called every frame by the guest's render loop. Returns how far we are
    // between the last physics step and the next (0..1), for smooth drawing.
    function step() {
        if (!p.sim) return 1;
        const e = engine(), now = performance.now();
        p.acc += Math.min(0.1, (now - p.last) / 1000);
        p.last = now;
        const wasFlying = flying();
        for (; p.acc >= STEP; p.acc -= STEP) e.physicsStep(p.sim, STEP);

        // Mirror our plane and bullets into the world the guest sees.
        for (const o of [...p.sim.bodies, ...p.sim.bullets]) {
            if (!p.shown.has(o)) {
                p.shown.add(o);
                p.view.add(o);
            }
        }
        for (const o of p.shown) {
            if (!p.sim.has(o)) {
                p.view.bodies.delete(o);
                p.view.bullets.delete(o);
                p.shown.delete(o);
            }
        }

        const plane = flying();
        if (wasFlying && !plane) report(wasFlying); // crashed locally: tell the host where
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
