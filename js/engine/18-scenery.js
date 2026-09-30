// Clouds, ground decorations and cows.
BitModules[18] = function (M, j, t) {
    "use strict";
    (t.d(j, "b", function () {
        return a;
    }),
        t.d(j, "a", function () {
            return y;
        }));
    var L = t(10),
        N = t(2),
        i = t(0),
        u = t(4),
        e = t(11);

    function I(M, j) {
        let t;
        (j.setInterval(() => {
            ((t = (function (t) {
                let L,
                    N = t;
                for (let t of M)
                    if (t instanceof u.a) {
                        const M = Object(i.q)(j.position, t.position);
                        M < N && ((L = t), (N = M));
                    }
                return L;
            })(500)),
                t && ((j.running = !0), (j.direction = j.position.x < t.position.x ? e.b.Left : e.b.Right)));
        }, 1e3),
            j.setInterval(
                () => {
                    t || (j.running = Math.random() < 0.1);
                },
                1e3 + 2e3 * Math.random(),
            ),
            j.setInterval(
                () => {
                    t || (j.direction = Math.random() < 0.5 ? e.b.Left : e.b.Right);
                },
                1e3 + 4e3 * Math.random(),
            ));
    }
    var D = t(1),
        g = t(6);

    function a(M) {
        for (let j = 0; j < 120; j++) {
            const t = new L.b(N.b.clouds[j % 9]);
            let u = M.height;
            for (; u > M.height - 500;) u = M.height * Math.random();
            let e = 1e3;
            ((t.position = Object(i.s)((e + M.width) * Math.random() - e / 2, u)), M.clouds.push(t));
        }
        for (let j = 0, t = 10; t < M.width;) {
            const u = new L.d(N.b.groundObjects[j++ % N.b.groundObjects.length]);
            ((u.position = Object(i.s)(t, M.ground - u.sprite.height + 0.5)),
                (t += u.sprite.width + 30 + 800 * Math.random()),
                M.groundObjects.add(u));
        }
    }

    function y(M) {
        function j() {
            let j = new e.a();
            (j.move(Object(i.s)(Math.random() * M.width, M.ground - j.sprite.height / 2)), I(M, j), M.add(j));
        }
        for (let M = D.g; M >= 0; M--) j();
        M.onCowKill = (t) => {
            if (t.dead) return;
            (t.destroy(), (t.dead = !0));
            let i = new L.d(N.b.cowDead);
            ((i.position = t.position),
                (i.position.y = M.ground - i.sprite.height + 2),
                M.groundObjects.add(i),
                setTimeout(j, 10 * D.n),
                setTimeout(() => M.groundObjects.delete(i), 30 * D.n),
                Object(g.a)(M, t));
        };
    }
};
