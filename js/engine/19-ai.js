// Computer pilots.
BitModules[19] = function (M, j, t) {
    "use strict";
    (t.d(j, "a", function () {
        return T;
    }),
        t.d(j, "b", function () {
            return n;
        }));
    var L = t(1),
        N = t(14),
        i = t(15),
        u = t(17),
        e = t(5),
        I = t(8),
        D = t(4),
        g = t(3),
        a = t(0);
    const y = {
        missileChance: 0.03,
    };

    function T(M, j, t = {}) {
        let i = Object.assign(Object.assign({}, y), t),
            I = [],
            T = [];
        const o = (M, j) => {
                let t = window.setTimeout(j, M);
                return (I.push(t), t);
            },
            S = (M, j) => {
                let t = window.setInterval(j, M);
                return (T.push(t), t);
            };
        let z = !0;
        const r = (M) => {
                const t = j.hasPlane();
                t && z && (t.elevator = M);
            },
            s = Object(g.f)(() => {
                const t = j.hasPlane();
                t && Object(N.e)(M, t);
            }, 1.5 * L.n);

        function x() {
            j.target = void 0;
            const M = j.hasPlane();
            M && (M.elevator = 0);
        }

        function w(M) {
            ((M.velocity.y = -10), (M.landed = !1));
        }
        let l, O;
        return (
            S(L.c, () => {
                var t, L, I;
                const y = j.hasPilot();
                if (y) {
                    let j;
                    M.ground - y.position.y < 300 && y.deployParachute(M);
                    for (let t of M.barns)
                        (!j ||
                            Math.abs(j.position.x - y.position.x) > Math.abs(t.position.x - y.position.x)) &&
                            (j = t);
                    y.landed &&
                        j &&
                        (y.position.x < j.position.x
                            ? ((y.velocity.x = 10), Math.random() < 0.02 && w(y))
                            : y.position.x > j.position.x
                              ? ((y.velocity.x = -10), Math.random() < 0.02 && w(y))
                              : (y.velocity.x = 0));
                }
                const T = j.hasPlane();
                if (T) {
                    if (1 == T.life && M.barns.size > 0) {
                        let t,
                            L = 1 / 0;
                        for (let j of M.barns) {
                            let M = Object(a.q)(j.position, T.position);
                            M < L && ((L = M), (t = j));
                        }
                        Math.random() < 0.03 && (L < 1300 ? Object(N.b)(M, j) : (j.target = t));
                    }
                    if (void 0 !== j.target)
                        if (M.has(j.target)) {
                            let t = Object(g.c)(T.position, j.target.position, M);
                            j.target instanceof u.a && ((t = Object(a.c)(t)), (t.y -= 300));
                            const L = Object(a.b)(Object(a.r)(t, T.position), T.forward),
                                I = Object(a.q)(T.position, t);
                            if ((Math.abs(L) > a.l && r(Math.sign(L) > 0 ? 1 : -1), j.target instanceof u.a))
                                return;
                            if (
                                (j.target instanceof D.a &&
                                    L < a.n &&
                                    I < 500 &&
                                    Math.random() < i.missileChance &&
                                    s(),
                                L < a.m && I < 400)
                            ) {
                                let t = n(M, T, a.o);
                                (t instanceof e.a && t.source === T && t.thrust > 0) ||
                                    c(t, j.team) ||
                                    Object(N.d)(M, T);
                            }
                            (T.ammo <= 3 && Object(N.d)(M, T),
                                j.target instanceof e.a && 0 === j.target.thrust && x());
                        } else x();
                    else {
                        let N = A(M, T, (M) => c(M, j.team));
                        if (N) {
                            const M = Object(a.b)(Object(a.r)(N.position, T.position), T.forward),
                                t = Object(a.q)(T.position, N.position);
                            ((Math.abs(M) < a.k && t < 1e3) || t < 350) && (j.target = N);
                        }
                        if (
                            (null === (L = null === (t = j.team) || void 0 === t ? void 0 : t.leader) ||
                            void 0 === L
                                ? void 0
                                : L.object) &&
                            (null === (I = j.team) || void 0 === I ? void 0 : I.leader) !== j
                        ) {
                            let t = j.team.leader.object,
                                L = Object(a.a)(
                                    t.position,
                                    Object(a.a)(
                                        Object(a.e)(t.velocity, 10),
                                        Object(a.e)(t.normal, 100 * (j.number - j.team.members.length / 2)),
                                    ),
                                );
                            L = Object(g.c)(T.position, L, M);
                            const N = Object(a.b)(Object(a.r)(L, T.position), T.forward);
                            r(Math.sign(N) > 0 ? 1 : -1);
                        }
                    }
                }
            }),
            S(2 * L.n, () => {
                const t = j.hasPlane();
                if (!t) return;
                let N = S(L.c, () => {
                    if (void 0 !== j.target) {
                        let L = A(M, t, (M) => c(M, j.team));
                        if (L) {
                            const M = Object(a.b)(Object(a.r)(L.position, t.position), t.forward),
                                N = Object(a.q)(t.position, L.position),
                                i = Object(a.q)(t.position, j.target.position);
                            ((Math.abs(M) < a.m && N < i) || N < 300) && (j.target = L);
                        }
                    }
                });
                o(L.n, () => clearInterval(N));
            }),
            S(10 * L.n, () => {
                var t, L, N;
                if (
                    j.hasPlane() &&
                    (!(null === (L = null === (t = j.team) || void 0 === t ? void 0 : t.leader) ||
                    void 0 === L
                        ? void 0
                        : L.hasPlane()) ||
                        (null === (N = j.team) || void 0 === N ? void 0 : N.leader) === j) &&
                    void 0 === j.target
                ) {
                    let t = A(M, j.object, (M) => c(M, j.team), M.width);
                    t && (j.target = t);
                }
            }),
            S(5 * L.n, () => {
                var t, N, i;
                if (!j.object) return;
                let u = j.object;
                if (
                    (void 0 ===
                        (null === (N = null === (t = j.team) || void 0 === t ? void 0 : t.leader) ||
                        void 0 === N
                            ? void 0
                            : N.object) ||
                        (null === (i = j.team) || void 0 === i ? void 0 : i.leader) === j) &&
                    void 0 === j.target
                ) {
                    let j = Object(a.s)(
                            Math.floor(Math.random() * M.width),
                            Math.floor(Math.random() * (M.ground - 100)),
                        ),
                        t = S(30, () => {
                            const M = Object(a.b)(Object(a.r)(j, u.position), u.forward);
                            Math.abs(M) > a.l && r(Math.sign(M) > 0 ? 1 : -1);
                        });
                    o(2 * L.n, () => {
                        clearInterval(t);
                    });
                }
            }),
            S(30, () => {
                const t = j.hasPlane();
                t &&
                    (Object(a.a)(t.position, Object(a.e)(t.velocity, 4)).y > M.ground &&
                        (r(Math.sign(t.forward.x) > 0 ? -1 : 1),
                        clearTimeout(l),
                        (l = o(200, () => (t.elevator = 0)))),
                    t.position.y > M.ground - 30 &&
                        (r(Math.sign(t.forward.x) > 0 ? -1 : 1),
                        clearTimeout(O),
                        (O = o(200, () => (t.elevator = 0)))),
                    t.landed && ((t.elevator = 0), (t.thrust = L.k), z && ((z = !1), o(L.n, () => (z = !0)))),
                    0 === t.thrust && (t.thrust = L.k));
            }),
            function () {
                for (let M of I) clearTimeout(M);
                for (let M of T) clearInterval(M);
            }
        );
    }

    function A(M, j, t, L = 2e3) {
        let N;
        if (void 0 !== j) {
            for (let i of M)
                if (
                    i !== j &&
                    !(i instanceof e.a && i.source === j) &&
                    !t(i) &&
                    (i instanceof D.a ||
                        i instanceof I.b ||
                        (i instanceof e.a && i.target === j && i.thrust > 0))
                ) {
                    const M = Object(a.q)(j.position, i.position);
                    M < L && ((N = i), (L = M));
                }
            return N;
        }
    }

    function n(M, j, t = a.m, L = 500, N = (M) => M instanceof i.a) {
        let u,
            e = L;
        for (let L of M) {
            if (L === j) continue;
            if (N(L)) continue;
            const M = Object(a.q)(j.position, L.position),
                i = Object(a.b)(Object(a.r)(L.position, j.position), j.forward);
            M < e && Math.abs(i) < t && ((u = L), (e = M));
        }
        return u;
    }

    function c(M, j) {
        return (
            void 0 !== j &&
            (!!(M instanceof D.a && M.player && M.player.team === j) ||
                !!(M instanceof D.a && M.team && M.team === j) ||
                !!(M instanceof e.a && M.source.player && M.source.player.team === j) ||
                !!(M instanceof I.b && M.player && M.player.team === j))
        );
    }
};
