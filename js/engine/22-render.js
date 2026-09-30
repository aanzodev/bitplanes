// Rendering, physics step and the main loop.
BitModules[22] = function (M, j, t) {
    "use strict";
    (t.d(j, "a", function () {
        return Y;
    }),
        t.d(j, "b", function () {
            return Z;
        }));
    var L = t(14),
        N = t(10),
        i = t(11),
        u = t(5),
        e = t(4),
        I = t(2),
        D = t(3),
        g = t(0);

    function a(M, j, t, L, a) {
        var A;
        // Map theme (sky colors, ground, forest). Falls back to the countryside look.
        const theme = t.map || {},
            mapSky = theme.sky || "#9be2fe",
            mapSpace = theme.space || "#1f4752",
            mapForest = theme.forest || I.b.forest,
            mapForestBack = theme.forestBack || I.b.forest2,
            mapGround = theme.ground || I.b.ground,
            mapClouds = theme.cloudAlpha != null ? theme.cloudAlpha : 0.8;
        let n = t.stratosphere - j.offsetY;
        (n < 0 ? (n = 0) : ((M.fillStyle = mapSpace), M.fillRect(0, 0, j.width, n)),
            (M.fillStyle = mapSky),
            M.fillRect(0, n, j.width, j.height),
            (function (M, j, t) {
                if (t.stratosphere > j.offsetY) {
                    let L = 900;
                    const N = -j.offsetY - L + t.stratosphere + 4;
                    (M.save(), M.translate(0, N));
                    let i = M.createLinearGradient(0, 0, 0, L);
                    (i.addColorStop(0, mapSpace),
                        i.addColorStop(1, mapSky),
                        (M.fillStyle = i),
                        M.fillRect(0, 0, j.width, L),
                        M.restore());
                }
            })(M, j, t),
            y(M, j, t, mapForestBack, 1.05, 50),
            y(M, j, t, mapForest, 1.02, 100),
            (function (M, j, t) {
                for (let L of t.groundObjects) {
                    const t = L.position.x - j.offsetX,
                        N = L.position.y - j.offsetY;
                    t + L.sprite.width < 0 ||
                        t - L.sprite.width > j.width ||
                        (M.save(), M.translate(t, N), L.sprite.draw(M), M.restore());
                }
            })(M, j, t),
            (function (M, j, t) {
                const L = t.height - j.offsetY - mapGround.height;
                if (L < j.height) {
                    (M.save(), M.translate(-j.offsetX % mapGround.width, L));
                    let t = Math.floor((j.width * j.cameraScale) / mapGround.width) + 1;
                    for (; t-- > 0;) (mapGround.draw(M), M.translate(mapGround.width - 1, 0));
                    M.restore();
                }
            })(M, j, t),
            (function (M, j, t) {
                for (let L of t.clouds) {
                    const t = L.position.x - j.offsetX,
                        N = L.position.y - j.offsetY;
                    t + L.sprite.width < 0 ||
                        t - L.sprite.width > j.width ||
                        (M.save(), M.translate(t, N), (M.globalAlpha = mapClouds), L.sprite.draw(M), M.restore());
                }
            })(M, j, t));
        for (let N of t) {
            const t = N.getX(L) - j.offsetX,
                D = N.getY(L) - j.offsetY;
            if (!(t + N.radius < 0 || t - N.radius > j.width)) {
                if ((M.save(), D + N.radius < 0))
                    (N instanceof e.a || N instanceof u.a) &&
                        (M.translate(Math.floor(t), 3), I.b.pointerUp.drawMiddle(M));
                else if (D - N.radius > j.height)
                    (N instanceof e.a || N instanceof u.a) &&
                        (M.translate(Math.floor(t), j.height - 3), I.b.pointerDown.drawMiddle(M));
                else {
                    if (
                        (M.translate(t, D),
                        M.rotate(N.angle),
                        N instanceof i.a ? N.draw(M) : N.sprite.drawMiddle(M),
                        window.showCircles)
                    ) {
                        for (let { v: j, r: t } of N.circles)
                            (M.beginPath(),
                                (M.fillStyle = "rgba(255,45,247,0.5)"),
                                M.arc(j.x, j.y, t, 0, 2 * Math.PI),
                                M.fill());
                        (M.beginPath(), M.arc(0, 0, N.radius, 0, 2 * Math.PI), M.stroke());
                    }
                    if (
                        (window.showVectors &&
                            (M.save(),
                            M.rotate(-N.angle),
                            M.beginPath(),
                            M.moveTo(0, 0),
                            M.lineTo(20 * N.forward.x, 20 * N.forward.y),
                            (M.strokeStyle = "blue"),
                            M.stroke(),
                            M.beginPath(),
                            M.moveTo(0, 0),
                            M.lineTo(20 * N.normal.x, 20 * N.normal.y),
                            (M.strokeStyle = "green"),
                            M.stroke(),
                            M.restore()),
                        N instanceof u.a &&
                            N.thrust > 0 &&
                            (M.translate(10, 0), I.b.missileFire[Math.random() < 0.5 ? 0 : 1].drawMiddle(M)),
                        window.showTarget &&
                            N instanceof e.a &&
                            void 0 !== (null === (A = N.player) || void 0 === A ? void 0 : A.target))
                    ) {
                        (M.save(), M.rotate(-N.angle));
                        let j = Object(g.r)(N.player.target.position, N.position);
                        ((j = Object(g.r)(j, Object(g.e)(Object(g.i)(j), N.player.target.radius))),
                            (M.strokeStyle = "#ff0101"),
                            (M.lineWidth = 2),
                            T(M, 0, 0, j.x, j.y),
                            M.restore());
                    }
                    if (N instanceof e.a && void 0 !== N.pointTo) {
                        (M.save(), M.rotate(-N.angle));
                        let j = Object(g.r)(N.pointTo.position, N.position);
                        ((j = Object(g.r)(j, Object(g.e)(Object(g.i)(j), N.pointTo.radius))),
                            (M.strokeStyle = "#009a04"),
                            (M.lineWidth = 2),
                            T(M, 0, 0, j.x, j.y),
                            M.restore());
                    }
                }
                M.restore();
            }
        }
        for (let L of t.particles) {
            const t = L.getX() - j.offsetX,
                i = L.getY() - j.offsetY;
            if (t < -200 || i < -200 || t > j.width + 200 || i > j.height + 200) continue;
            (M.save(),
                M.translate(t, i),
                L instanceof N.f
                    ? (M.rotate(L.angle),
                      (M.globalAlpha = L.opacity),
                      M.scale(L.scale, L.scale),
                      L.sprite.drawMiddle(M))
                    : L instanceof N.a
                      ? L.sprites[L.frame].drawMiddle(M)
                      : L instanceof N.b
                        ? L.sprite.drawMiddle(M)
                        : L instanceof N.c
                          ? ((M.globalAlpha =
                                1 - Math.min(1, Math.abs((Object(D.g)() - L.createdAt) / L.duration))),
                            L.sprite.drawMiddle(M))
                          : ((M.fillStyle = L.color), M.fillRect(0, 0, L.size, L.size)),
                M.restore());
        }
        a(M);
    }

    function y(M, j, t, L, N, i) {
        const u = t.height - j.offsetY - L.height + i;
        if (u < j.height) {
            (M.save(), (M.globalAlpha = 0.4), M.translate((-j.offsetX / N) % L.width, u));
            let t = Math.floor(j.width / L.width + 2);
            for (; t-- > 0;) (L.draw(M), M.translate(L.width, 0));
            M.restore();
        }
    }

    function T(M, j, t, L, N) {
        M.beginPath();
        const i = L - j,
            u = N - t,
            e = Math.atan2(u, i);
        (M.moveTo(j, t),
            M.lineTo(L, N),
            M.lineTo(L - 10 * Math.cos(e - Math.PI / 6), N - 10 * Math.sin(e - Math.PI / 6)),
            M.moveTo(L, N),
            M.lineTo(L - 10 * Math.cos(e + Math.PI / 6), N - 10 * Math.sin(e + Math.PI / 6)),
            M.stroke());
    }
    Object.assign(window, {
        showCircles: !1,
        showVectors: !1,
        showTarget: !1,
    });
    var A = t(6),
        n = t(15),
        c = t(8),
        o = t(7),
        S = t(9);

    function z(M, j) {
        const t = Object(g.h)(j.velocity);
        if (j.landed) t > 45 && (j.landed = !1);
        else if (s(j, M.ground)) {
            const t = j.angle;
            if (j.velocity.y < 40 && (t < g.o || Math.abs(2 * Math.PI - t) < g.m))
                return void (j.landed = !0);
            (M.delete(j), Object(A.d)(M, j, !0), M.onCrash(j), j.player && Object(S.c)(j.player));
        }
    }

    function r(M, j) {
        (M.delete(j), Object(A.d)(M, j), M.onCrash(j));
    }

    function s(M, j) {
        for (let { v: t, r: L } of M.circles)
            if (((t = Object(g.a)(Object(g.p)(t, M.angle), M.position)), t.y + L >= j)) return !0;
        return !1;
    }

    function x(M, j) {
        if (w(M.position, M.radius, j.position, j.radius))
            for (let { v: t, r: L } of M.circles) {
                t = Object(g.a)(Object(g.p)(t, M.angle), M.position);
                for (let { v: M, r: N } of j.circles)
                    if (((M = Object(g.a)(Object(g.p)(M, j.angle), j.position)), w(t, L, M, N))) return !0;
            }
        return !1;
    }

    function w(M, j, t, L) {
        const N = j + L,
            i = M.x - t.x,
            u = M.y - t.y;
        return N * N > i * i + u * u;
    }
    var l = t(1);

    function O(M, j) {
        !(function (M) {
            var j;
            for (let j of M)
                if (j.position.y + j.radius >= M.ground) {
                    if (j instanceof e.a) {
                        z(M, j);
                        continue;
                    }
                    if (s(j, M.ground)) {
                        if (j instanceof n.a) {
                            (Object(A.e)(M, j), M.delete(j));
                            continue;
                        }
                        if (j instanceof u.a) {
                            (Object(A.d)(M, j, !0), M.delete(j));
                            continue;
                        }
                        (j instanceof i.a && (j.landed = !0),
                            j instanceof c.b &&
                                ((j.landed = !0),
                                Object(g.h)(j.velocity) > 40
                                    ? (Object(A.e)(M, j),
                                      Object(A.c)(M, j),
                                      M.onCrash(j),
                                      M.delete(j),
                                      j.player && Object(S.c)(j.player))
                                    : j.parachute && (M.delete(j.parachute), (j.parachute = void 0))),
                            j instanceof c.a && M.delete(j));
                    }
                }
            for (let j of M.bodies) for (let L of M.bodies) j !== L && x(j, L) && (t(j, L) || t(L, j));

            function t(j, t) {
                var L, N, I, D;
                if (j instanceof u.a && t instanceof u.a)
                    return (Object(A.d)(M, j), Object(A.d)(M, t), M.delete(j), M.delete(t), !0);
                if (j instanceof e.a && t instanceof u.a)
                    return (
                        (!t.justDeployed || t.source !== j) &&
                        (!t.justDeployed ||
                            void 0 === (null === (L = t.source.player) || void 0 === L ? void 0 : L.team) ||
                            void 0 === (null === (N = j.player) || void 0 === N ? void 0 : N.team) ||
                            t.source.player.team !== j.player.team) &&
                        (r(M, j),
                        M.delete(t),
                        t.source.player && j.player && Object(S.d)(t.source.player, j.player, S.a),
                        !0)
                    );
                if (j instanceof e.a && t instanceof i.a)
                    return (
                        (null === (I = j.player) || void 0 === I ? void 0 : I.isHuman) && o.c.cowKilled++,
                        M.onCowKill(t),
                        M.delete(t),
                        !0
                    );
                if (j instanceof u.a && t instanceof i.a)
                    return (
                        (null === (D = j.source.player) || void 0 === D ? void 0 : D.isHuman) &&
                            o.c.cowKilled++,
                        Object(A.d)(M, t),
                        M.onCowKill(t),
                        M.delete(j),
                        M.delete(t),
                        !0
                    );
                if (j instanceof c.a) {
                    if (t instanceof e.a && j.load.plane !== t)
                        return (M.delete(j), (j.load.parachute = void 0), !0);
                    if (t instanceof u.a) return (M.delete(j), (j.load.parachute = void 0), !0);
                }
                return !1;
            }
            let L = [...M.bullets];
            for (let M = 0; M < L.length - 1; M++) {
                const j = L[M];
                for (let t = M + 1; t < L.length; t++) {
                    const M = L[t];
                    if (!x(j, M)) continue;
                    let N = 0.99,
                        i = Object(g.i)(Object(g.r)(j.position, M.position)),
                        u = Object(g.s)(j.velocity.x - M.velocity.x, j.velocity.y - M.velocity.y),
                        e = u.x * i.x + u.y * i.y;
                    if (e > 0) {
                        let t = (2 * N * e) / (j.mass + M.mass);
                        ((j.velocity.x -= t * M.mass * i.x),
                            (j.velocity.y -= t * M.mass * i.y),
                            (M.velocity.x += t * j.mass * i.x),
                            (M.velocity.y += t * j.mass * i.y));
                    }
                    ((j.position = Object(g.a)(j.position, Object(g.e)(i, j.radius / 2))),
                        (M.position = Object(g.a)(M.position, Object(g.e)(i, -M.radius / 2))));
                }
            }
            for (let t of M.bullets) {
                for (let L of M.bodies)
                    x(t, L) &&
                        (L instanceof e.a &&
                            ((L.life -= 1),
                            0 == L.life &&
                                (r(M, L),
                                t.source.player && L.player && Object(S.d)(t.source.player, L.player)),
                            M.bullets.delete(t)),
                        L instanceof u.a && (Object(A.d)(M, L), M.delete(t), M.delete(L)),
                        L instanceof i.a &&
                            ((null === (j = t.source.player) || void 0 === j ? void 0 : j.isHuman) &&
                                o.c.cowKilled++,
                            M.onCowKill(L),
                            M.delete(t),
                            M.delete(L)),
                        L instanceof c.a && (M.delete(L), (L.load.parachute = void 0)));
                for (let j of M.pilots)
                    x(t, j) &&
                        (M.onCrash(j),
                        M.delete(t),
                        M.delete(j),
                        Object(A.b)(M, j),
                        Object(A.c)(M, j),
                        t.source.player && j.player && Object(S.d)(t.source.player, j.player));
            }
            for (let j of M.barns) for (let t of M.pilots) x(j, t) && j.newPlane(M, t);
            for (let j of M.pilots)
                for (let t of M.bodies)
                    x(j, t) &&
                        (t instanceof e.a &&
                            j.plane !== t &&
                            !t.landed &&
                            (M.onCrash(j),
                            M.delete(j),
                            Object(A.b)(M, j),
                            Object(A.c)(M, j),
                            t.player && j.player && Object(S.d)(t.player, j.player, S.b)),
                        t instanceof u.a &&
                            (Object(A.d)(M, t),
                            M.onCrash(j),
                            M.delete(j),
                            M.delete(t),
                            Object(A.b)(M, j),
                            Object(A.c)(M, j),
                            t.source.player && j.player && Object(S.d)(t.source.player, j.player, S.a)));
        })(M);
        for (let t of M) {
            t instanceof e.a && window.BitShop && window.BitShop.apply(t);
            ((t.forward = Object(g.s)(Math.sin(-t.angle - Math.PI / 2), Math.cos(-t.angle - Math.PI / 2))),
                (t.normal = Object(g.s)(Math.sin(-t.angle + Math.PI), Math.cos(-t.angle + Math.PI))),
                t instanceof u.a && (C(t, M), t.thrust > 0 && Object(A.f)(M, t)),
                t instanceof e.a && (E(t, M), t.life < l.h && Object(A.g)(M, t)),
                t instanceof c.b && d(t),
                t instanceof c.a && m(t),
                t instanceof n.a && h(t),
                t instanceof i.a && U(t, M));
            const L = Object(g.d)(t.force, t.mass);
            (t instanceof e.a && t.landed
                ? (0 === t.thrust
                      ? (t.velocity.x += (-t.velocity.x / 2) * j)
                      : (t.velocity.x += l.m * L.x * j),
                  (t.angle = Math.PI / 8),
                  (t.velocity.y = 0),
                  (t.previous.x = t.position.x),
                  (t.previous.y = t.position.y),
                  (t.position.x += l.m * t.velocity.x * j),
                  (t.position.y = M.ground - 7))
                : t instanceof i.a && t.landed
                  ? ((t.velocity.y = 0),
                    (t.previous.x = t.position.x),
                    (t.previous.y = t.position.y),
                    (t.position.x += l.m * t.velocity.x * j),
                    (t.position.y = M.ground - t.sprite.height / 2))
                  : t instanceof c.b && t.landed
                    ? ((t.velocity.y = 0),
                      (t.velocity.x += l.m * L.x * j),
                      (t.previous.x = t.position.x),
                      (t.previous.y = t.position.y),
                      (t.position.x += l.m * t.velocity.x * j),
                      (t.position.y = M.ground - t.sprite.height / 2))
                    : ((t.velocity.x += l.m * L.x * j),
                      (t.velocity.y += l.m * L.y * j),
                      (t.previous.x = t.position.x),
                      (t.previous.y = t.position.y),
                      (t.position.x += l.m * t.velocity.x * j),
                      (t.position.y += l.m * t.velocity.y * j)),
                t.position.x + t.radius < 0 && (t.previous.x = t.position.x = M.width),
                t.position.x - t.radius > M.width && (t.previous.x = t.position.x = 0));
        }
    }

    function C(M, j) {
        const t = Object(g.h)(M.velocity),
            L = Object(g.s)(0, M.mass * l.a),
            N = Object(g.e)(M.forward, M.thrust),
            i = Object(g.e)(Object(g.i)(Object(g.f)(M.velocity)), 2 ** (t - 1.2 * l.l));
        M.force = Object(g.a)(L, N, i);
    }

    function E(M, j) {
        const t = Object(g.h)(M.velocity),
            L = Object(g.b)(M.forward, M.velocity),
            N = Object(g.s)(0, M.mass * l.a);
        let i = Object(g.e)(M.forward, M.thrust),
            u = Object(g.e)(M.normal, t * Object(D.h)(L, Object(g.j)(50))),
            e = Object(g.e)(Object(g.i)(Object(g.f)(M.velocity)), 2 ** (t - l.l));
        (M.position.y < j.stratosphere && ((i = Object(g.g)()), (u = Object(g.g)()), (e = Object(g.g)())),
            (M.force = Object(g.a)(N, i, u, e)));
    }

    function d(M) {
        const j = Object(g.h)(M.velocity),
            t = Object(g.s)(0, M.mass * l.a);
        let L = Object(g.e)(Object(g.i)(Object(g.f)(M.velocity)), 2 ** (j - l.l));
        (M.landed && (L = Object(g.s)(-M.velocity.x, 0)),
            M.parachute &&
                ((L = Object(g.e)(Object(g.i)(Object(g.f)(M.velocity)), j / 4)), M.updateParachute()),
            (M.force = Object(g.a)(t, L)));
    }

    function m(M) {
        const j = Object(g.h)(M.velocity),
            t = Object(g.s)(0, M.mass * l.a);
        let L = Object(g.e)(Object(g.i)(Object(g.f)(M.velocity)), j / 4);
        M.force = Object(g.a)(t, L);
    }

    function h(M) {
        const j = Object(g.s)(0, M.mass * l.a);
        M.force = Object(g.a)(j);
    }

    function U(M, j) {
        ((M.force = Object(g.s)(0, M.mass * l.a)),
            M.running ? (M.velocity.x = M.direction == i.b.Right ? 10 : -10) : (M.velocity.x = 0));
    }

    // One fixed physics step for a world, without drawing. Online guests use
    // it to fly their own plane locally.
    function Z(M, j) {
        (Object(L.c)(M, j), O(M, j));
    }

    function Y(M, j, t, i, u) {
        let e,
            I = 0,
            g = Object(D.g)(),
            y = 1 / 60;
        // One simulation step (fixed 60 Hz physics, catching up on elapsed time).
        function step() {
            const A = Object(D.g)();
            // Paused (single player menu): freeze the world but keep drawing it.
            if (window.bitPaused) return ((g = A), 0);
            let n = (A - g) / 1e3;
            for (n > 0.1 && (n = 0.1), g = A, I += n, t.remote || Object(L.c)(t, n); I >= y;)
                (t.remote || O(t, y), (I -= y));
            return (Object(N.g)(t, y), n);
        }
        // Lets the game keep running while the window is covered or hidden and
        // animation frames stop (used by online hosts).
        t.tick = function () {
            Object(D.g)() - g > 50 && step();
        };
        return (
            (function T() {
                e = requestAnimationFrame(T);
                const n = step();
                window.bitAdaptQuality && window.bitAdaptQuality(n);
                const c = t.remote ? t.remote.alpha() : I / y;
                (i(M, c), a(j, M, t, c, u));
            })(),
            function () {
                (cancelAnimationFrame(e), (t.tick = null));
            }
        );
    }
};
