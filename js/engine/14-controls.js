// Keyboard controls, guns, missiles, flares, catapult.
BitModules[14] = function (M, j, t) {
    "use strict";
    (t.d(j, "a", function () {
        return y;
    }),
        t.d(j, "c", function () {
            return T;
        }),
        t.d(j, "d", function () {
            return c;
        }),
        t.d(j, "e", function () {
            return o;
        }),
        t.d(j, "b", function () {
            return S;
        }));
    var L = t(1),
        N = t(0),
        i = t(3),
        u = t(4);
    var e = t(15),
        I = t(5),
        D = t(8),
        g = t(7),
        a = t(9);

    function y(M, j, t) {
        let N = Object(i.f)(() => {
                let M = j.hasPlane();
                M && Object(a.i)(M);
            }, 30),
            u = !1,
            e = !1,
            I = !1,
            D = !1,
            y = !1;
        return (
            setInterval(() => {
                let t = j.hasPlane();
                if (t)
                    (u && (c(M, t), g.c.bullets++, N()),
                        e && ((t.thrust -= 2), t.thrust < 0 && (t.thrust = 0), N()),
                        I &&
                            ((t.thrust += 2),
                            t.thrust > (t.maxThrust || L.k) && (t.thrust = t.maxThrust || L.k),
                            N()),
                        (t.elevator = D && !y ? -1 : !D && y ? 1 : 0));
                else {
                    const M = j.hasPilot();
                    M &&
                        (M.landed && (D && !y ? (M.velocity.x = -10) : !D && y && (M.velocity.x = 10)),
                        M.parachute && (D && !y ? (M.velocity.x = -20) : !D && y && (M.velocity.x = 20)),
                        M.landed && I && ((M.landed = !1), (M.velocity.y = -10)));
                }
            }, L.c),
            document.addEventListener(
                "keydown",
                (L) => {
                    if (t.thrustLevers.up.includes(L.code)) I = !0;
                    else if (t.thrustLevers.down.includes(L.code)) e = !0;
                    else if (t.elevator.up.includes(L.code)) D = !0;
                    else if (t.elevator.down.includes(L.code)) y = !0;
                    else if (L.code === t.fire) u = !0;
                    else if (L.code === t.missile) {
                        let t = j.hasPlane();
                        t && (o(M, t), g.c.missiles++, N());
                    } else {
                        if (L.code !== t.catapult) return;
                        if (j.hasPlane()) S(M, j);
                        else {
                            let t = j.hasPilot();
                            t && t.deployParachute(M);
                        }
                    }
                    L.preventDefault();
                },
                !0,
            ),
            document.addEventListener(
                "keyup",
                (M) => {
                    if (t.thrustLevers.up.includes(M.code)) I = !1;
                    else if (t.thrustLevers.down.includes(M.code)) e = !1;
                    else if (t.elevator.up.includes(M.code)) D = !1;
                    else if (t.elevator.down.includes(M.code)) y = !1;
                    else {
                        if (M.code !== t.fire) return;
                        u = !1;
                    }
                    M.preventDefault();
                },
                !0,
            ),
            function (M) {
                j = M;
            }
        );
    }

    function T(M, j) {
        for (let t of M) t instanceof u.a ? A(t, j) : t instanceof I.a && n(t, j);
    }

    function A(M, j) {
        const t = Object(N.h)(M.velocity);
        let i = 1 - t / (L.l * L.d);
        (t > L.l && (i = 1 - 1 / L.d),
            (M.angle += i * L.e * (M.turnRate || 1) * M.elevator * j),
            M.angle < 0 && (M.angle += 2 * Math.PI),
            M.angle > 2 * Math.PI && (M.angle -= 2 * Math.PI));
    }

    function n(M, j) {
        const t = Object(N.h)(M.velocity);
        let i = 1 - t / (L.l * L.d);
        (t > L.l && (i = 1 - 1 / 1.5), (M.angle += 10 * i * M.elevator * j));
    }

    function c(M, j) {
        if (M.has(j)) {
            if (j.ammo > 0) {
                j.ammo--;
                const t = (function (M) {
                    const j = new e.a(M);
                    return (
                        j.move(Object(N.a)(M.position, Object(N.e)(M.forward, M.radius + 5))),
                        (j.velocity = Object(N.a)(
                            Object(N.c)(M.velocity),
                            Object(N.e)(M.forward, 120 * (M.bulletSpeed || 1)),
                        )),
                        j
                    );
                })(j);
                M.add(t);
            }
            0 !== j.ammo ||
                j.gunReloading ||
                ((j.gunReloading = !0),
                j.setTimeout(
                    () => {
                        ((j.ammo = j.maxAmmo), (j.gunReloading = !1));
                    },
                    3 * L.n * (j.reloadRate || 1),
                ));
        }
    }

    function o(M, j) {
        if (M.has(j)) {
            if (j.missiles > 0) {
                j.missiles--;
                const t = (function (M) {
                    const j = new I.a(M);
                    return (
                        j.move(Object(N.a)(M.position, Object(N.e)(M.normal, -12))),
                        (j.angle = M.angle),
                        (j.velocity = Object(N.a)(Object(N.c)(M.velocity), Object(N.e)(M.normal, -20))),
                        (j.forward = Object(N.c)(M.forward)),
                        (j.normal = Object(N.c)(M.normal)),
                        j
                    );
                })(j);
                (j.timeout(L.n, () => (t.justDeployed = !1)),
                    (function (M, j) {
                        function t() {
                            var t, L;
                            if (M.has(j))
                                if (void 0 !== j.target)
                                    if (M.has(j.target)) {
                                        const t = Object(i.c)(j.position, j.target.position, M),
                                            L = Object(N.b)(Object(N.r)(t, j.position), j.forward);
                                        ((j.elevator = Math.sign(L) > 0 ? 1 : -1),
                                            Object(N.a)(j.position, Object(N.e)(j.velocity, 4)).y >
                                                M.ground &&
                                                (j.elevator = Math.sign(j.forward.x) > 0 ? -1 : 1));
                                    } else ((j.target = void 0), (j.elevator = 0));
                                else {
                                    let i,
                                        e = 700;
                                    for (let I of M)
                                        if (I instanceof u.a) {
                                            if (I === j.source) continue;
                                            if (
                                                void 0 !==
                                                    (null === (t = I.player) || void 0 === t
                                                        ? void 0
                                                        : t.team) &&
                                                void 0 !==
                                                    (null === (L = j.source.player) || void 0 === L
                                                        ? void 0
                                                        : L.team) &&
                                                I.player.team === j.source.player.team
                                            )
                                                continue;
                                            const M = Object(N.q)(j.position, I.position);
                                            M < e && ((i = I), (e = M));
                                        }
                                    if (i) {
                                        const M = Object(N.b)(Object(N.r)(i.position, j.position), j.forward);
                                        (Math.abs(M) < Math.PI / 5 || e < 100) && (j.target = i);
                                    }
                                }
                        }
                        (j.setTimeout(function () {
                            j.thrust = 8;
                            const M = j.setInterval(t, 30);
                            setTimeout(() => {
                                (clearInterval(M), (j.thrust = 0));
                            }, 12 * L.n);
                        }, 500),
                            (j.target = void 0));
                    })(M, t),
                    M.add(t));
            }
            0 !== j.missiles ||
                j.missileReloading ||
                ((j.missileReloading = !0),
                j.setTimeout(
                    () => {
                        ((j.missiles = j.maxMissiles), (j.missileReloading = !1));
                    },
                    10 * L.n * (j.reloadRate || 1),
                ));
        }
    }

    function S(M, j) {
        let t = j.hasPlane();
        if (t) {
            t.catapultPilot();
            let L = new D.b(t);
            ((L.color = j.color),
                (L.player = j),
                L.move(Object(N.a)(t.position, Object(N.e)(t.normal, 5))),
                (L.velocity = Object(N.a)(t.velocity, Object(N.p)(Object(N.e)(t.normal, 20), N.m))),
                M.add(L),
                j.control(L));
        }
    }
};
