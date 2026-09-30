// Particle effects: smoke, explosions, ground hits.
BitModules[6] = function (M, j, t) {
    "use strict";
    (t.d(j, "g", function () {
        return I;
    }),
        t.d(j, "f", function () {
            return D;
        }),
        t.d(j, "d", function () {
            return g;
        }),
        t.d(j, "e", function () {
            return a;
        }),
        t.d(j, "a", function () {
            return y;
        }),
        t.d(j, "b", function () {
            return T;
        }),
        t.d(j, "c", function () {
            return A;
        }));
    var L = t(1),
        N = t(10),
        i = t(2),
        u = t(3),
        e = t(0);

    function I(M, j) {
        const t = Object(u.g)();
        if (t - j.lastSmoke > 80) {
            j.lastSmoke = t;
            let L = 1;
            (5 == j.life && (L = 0.05),
                4 == j.life && (L = 0.1),
                3 == j.life && (L = 0.2),
                2 == j.life && (L = 0.4),
                1 == j.life && (L = 0.7));
            const u = new N.f(i.b.puff);
            ((u.position = Object(e.c)(j.position)),
                (u.velocity = Object(e.a)(j.velocity, Object(e.e)(Object(e.f)(Object(e.i)(j.forward)), 20))),
                (u.angle = 2 * Math.PI * Math.random()),
                (u.scale = 1 + 0.5 * Math.random()),
                (u.opacity = L + 0.2 * Math.random()),
                M.particles.add(u));
        }
    }

    function D(M, j) {
        const t = new N.f(i.b.puff);
        let L = Object(e.r)(j.position, j.previous),
            u = Object(e.h)(L);
        for (L = Object(e.i)(L); u > 0;)
            ((t.position = Object(e.a)(j.previous, Object(e.e)(L, 0.1), Object(e.e)(j.forward, -10))),
                (t.velocity = Object(e.e)(Object(e.f)(Object(e.i)(j.forward)), 10)),
                (t.angle = 2 * Math.PI * Math.random()),
                (t.scale = 1 + 0.5 * Math.random()),
                (t.scaleRate = 0.3),
                (t.opacity = 0.5 + 0.2 * Math.random()),
                (t.opacityRate = 0.1),
                M.particles.add(t),
                (u -= 1));
    }

    function g(M, j, t = !1) {
        const L = new N.a(i.b.explosion);
        ((L.frameDuration = 50),
            (L.position = Object(e.s)(j.position.x, t ? M.ground : j.position.y)),
            (L.velocity = t ? Object(e.s)(0, -2) : Object(e.e)(j.velocity, 0.5)),
            M.particles.add(L));
    }

    function a(M, j) {
        const t = new N.a(i.b.groundhit);
        ((t.frameDuration = 50), (t.position = Object(e.s)(j.position.x, M.ground - 15)), M.particles.add(t));
    }

    function y(M, j) {
        function t(t = -5, L = 1) {
            const i = new N.e();
            ((i.position = Object(e.c)(j.position)),
                (i.position.x += j.sprite.width / 2),
                (i.velocity = Object(e.p)(
                    Object(e.s)(0, -5),
                    Math.PI / L / 2 - (Math.random() * Math.PI) / L,
                )),
                (i.color = "#d80004"),
                (i.size = 1 + Math.floor(3 * Math.random())),
                M.particles.add(i));
        }
        let L = 20;
        for (; L-- > 0;) t();
        const i = setInterval(() => t(-20, 30), 300);
        setTimeout(() => clearInterval(i), 1e4);
    }

    function T(M, j) {
        function t(t = -5, L = 1) {
            const i = new N.e();
            ((i.position = Object(e.c)(j.position)),
                (i.position.x += j.sprite.width / 2),
                (i.velocity = Object(e.p)(
                    Object(e.s)(0, -5),
                    Math.PI / L / 2 - (Math.random() * Math.PI) / L,
                )),
                (i.velocity = Object(e.a)(i.velocity, j.velocity)),
                (i.color = "#d80004"),
                (i.size = 1 + Math.floor(3 * Math.random())),
                M.particles.add(i));
        }
        let L = 20;
        for (; L-- > 0;) t();
    }

    function A(M, j) {
        const t = new N.c(i.b.angel);
        ((t.duration = 2 * L.n),
            (t.position = Object(e.s)(j.position.x, j.position.y)),
            (t.velocity = Object(e.s)(0, -8)),
            M.particles.add(t));
    }
};
