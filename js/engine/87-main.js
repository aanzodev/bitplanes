// Start screen and game modes. Entry point.
BitModules[87] = function (M, j, t) {
    "use strict";
    t.r(j);
    var L = t(19),
        N = t(23),
        i = t(20),
        u = t(16),
        e = t(1),
        I = t(22),
        D = t(14),
        g = t(17),
        a = t(18),
        y = t(4),
        T = t(12),
        A = t(2),
        n = t(7),
        c = t(9),
        o = t(0),
        S = t(21);
    var z = t(3);
    window.BitEngine = {
        require: t,
        World: S.a,
        Plane: y.a,
        Player: T.a,
        sprites: A.b,
        Sprite: A.a,
        decorate: a.b,
        camera: u.b,
        follow: u.a,
        loop: I.a,
        physicsStep: I.b,
        scoreboard: c.f,
        minimap: c.e,
        cockpit: c.i,
        controls: D,
        vec: o.s,
        consts: e,
    };
    Object(z.b)(function () {
        if (n.c.killed > 1 && n.c.deaths > 1 && n.c.cowKilled > 1) {
            if (
                ((document.querySelector(".stats").innerHTML =
                    `\n        You fired <em>${n.c.bullets.toLocaleString()}</em> <i class="ammo"></i> bullets \n        and <em>${n.c.missiles.toLocaleString()}</em> <i class="missile"></i> missiles\n        and destroyed <i class="target"></i> <em>${n.c.killed.toLocaleString()}</em> planes,\n        and unfortunately died <i class="skull"></i> <em>${n.c.deaths.toLocaleString()}</em> times. <br>\n        Also inadvertently you killed <em>${n.c.cowKilled.toLocaleString()}</em> <img src="${t(25)}" alt="cow" style="height: 14px"> cows. \n    `),
                n.c.killed > 1e3)
            ) {
                let M = document.createElement("div");
                M.innerHTML =
                    '\n        <label title="Two big teams against each other."><input type="radio" name="mode" value="swarm"> Swarm</label>\n      ';
                let j = document.querySelector(".game-modes");
                j && j.appendChild(M);
            }
        }
        let M = document.getElementsByName("nickname")[0];
        ((M.value = Object(n.a)("nickname") || ""),
            M.addEventListener("keyup", (j) => Object(n.b)("nickname", M.value)));
        let j = location.search.match(/mode=([\w-]+)/);
        if (j) {
            let M = j[1],
                t = document.getElementsByName("mode");
            for (let j = 0, L = t.length; j < L; j++) {
                let L = t[j];
                if (L.value == M) {
                    L.checked = !0;
                    break;
                }
            }
        }
        let r = (function () {
            const M = new S.a({
                width: 5e3,
                height: 5e3,
                ground: 0,
                stratosphere: 50,
            });
            ((M.ground = M.height - A.b.ground.height),
                (M.players = []),
                (M.onCrash = function (j) {
                    (j.player && j.player.detach(),
                        setTimeout(() => {
                            const t = j.player;
                            if (!t) return;
                            const L = new y.a(t.color);
                            ((L.life = e.h),
                                (L.ammo = L.maxAmmo = t.maxAmmo),
                                (L.landed = !0),
                                (L.ammo = 0),
                                L.move(Object(o.s)(M.width / 2 + (1200 * Math.random() - 600), M.ground)),
                                t.control(L),
                                M.add(L));
                        }, 2e3));
                }),
                Object(a.b)(M));
            let j = Object(N.a)();
            for (let t = 0; t < e.j; t++) {
                const t = i.a.pop() || "no name",
                    N = j.pop() || "black",
                    u = new y.a(N),
                    I = new T.a(t, N, u);
                ((u.player = I),
                    M.players.push(I),
                    (u.ammo = u.maxAmmo = I.maxAmmo = e.b),
                    u.move(Object(o.s)(M.width * Math.random(), M.ground * Math.random())),
                    M.add(u),
                    (I.disableAI = Object(L.a)(M, I)));
            }
            const t = document.querySelector(".demo"),
                [D, g] = Object(u.b)(1.25, t);
            let n = Object(I.a)(
                D,
                g,
                M,
                (j, t) => {
                    Object(u.a)(j, M, M.players[0], t);
                },
                (M) => {},
            );
            return function () {
                n();
                for (let j of M.players) j.disableAI();
            };
        })();
        window.BitEngine.stopDemo = r;
        Object(z.a)("#game").addEventListener("submit", (M) => {
            M.preventDefault();
            let j = "death-match",
                t = document.getElementsByName("mode");
            for (let M = 0, L = t.length; M < L; M++) {
                let L = t[M];
                if (L.checked) {
                    j = L.value;
                    break;
                }
            }
            (r(),
                (Object(z.a)(".log").innerHTML = ""),
                (function (M) {
                    switch (
                        ((Object(z.a)("main").style.display = "none"),
                        (Object(z.a)("#canvas").style.display = "block"),
                        (Object(z.a)(".ui").style.display = "block"),
                        M)
                    ) {
                        case "death-match":
                            !(function () {
                                const M = new S.a({
                                    width: 15e3,
                                    height: 4e3,
                                    ground: 0,
                                    stratosphere: 50,
                                });
                                ((M.ground = M.height - A.b.ground.height),
                                    (M.players = []),
                                    (M.onCrash = function (j) {
                                        j.player &&
                                            (j.player.detach(),
                                            setTimeout(() => {
                                                const t = j.player;
                                                if (!t) return;
                                                if (t.inGame()) return;
                                                const L = new y.a(t.color);
                                                ((L.life = e.h),
                                                    (L.ammo = L.maxAmmo = t.maxAmmo),
                                                    (L.landed = !0),
                                                    L.move(Object(o.s)(M.width * Math.random(), M.ground)),
                                                    t.control(L),
                                                    M.add(L));
                                            }, 2e3));
                                    }),
                                    Object(a.b)(M),
                                    Object(a.a)(M));
                                let j = new g.a(M.width / 2 + 110, M.ground);
                                M.add(j);
                                const t = new y.a("#ff0015"),
                                    z = new T.a(Object(n.a)("nickname") || "YOU", "#ff0015", t);
                                ((z.isHuman = !0),
                                    z.control(t),
                                    M.players.push(z),
                                    (z.maxAmmo = e.f),
                                    (t.maxAmmo = e.f),
                                    (t.ammo = e.f),
                                    (t.landed = !0),
                                    t.move(Object(o.s)(M.width / 2, M.ground)),
                                    M.add(t),
                                    Object(D.a)(M, z, {
                                        thrustLevers: {
                                            up: ["ArrowUp", "KeyW"],
                                            down: ["ArrowDown", "KeyS"],
                                        },
                                        elevator: {
                                            up: ["ArrowLeft", "KeyA"],
                                            down: ["ArrowRight", "KeyD"],
                                        },
                                        fire: "Space",
                                        missile: "KeyX",
                                        catapult: "KeyC",
                                    }));
                                let r = Object(N.a)();
                                for (let j = 0; j < e.j; j++) {
                                    const t = i.a.pop() || "no name",
                                        N = r.pop() || "black",
                                        u = new y.a(N),
                                        I = new T.a(t, N, u);
                                    ((u.player = I),
                                        M.players.push(I),
                                        (I.maxAmmo = u.maxAmmo = u.ammo = j <= 1 ? e.f : e.b),
                                        (u.landed = !0),
                                        u.move(Object(o.s)((j * M.width) / e.j - 800, M.ground)),
                                        M.add(u),
                                        (I.disableAI = Object(L.a)(M, I)));
                                }
                                (window.BitEngine.world = M), (window.BitEngine.player = z);
                                window.BitSound && window.BitSound.setListener(() => z.hasPlane() || z.hasPilot());
                                window.BitNet && window.BitNet.onWorld(M, z);
                                const s = document.querySelector("#canvas"),
                                    [x, w] = Object(u.b)(1.25, s);
                                (Object(I.a)(
                                    x,
                                    w,
                                    M,
                                    (j, t) => {
                                        Object(u.a)(j, M, z, t);
                                    },
                                    (j) => {
                                        Object(c.f)(j, M.players);
                                    },
                                ),
                                    Object(c.e)(M));
                            })();
                            break;
                        case "swarm":
                            !(function () {
                                const M = new S.a({
                                    width: 15e3,
                                    height: 4e3,
                                    ground: 0,
                                    stratosphere: 50,
                                });
                                let j, t;
                                ((M.ground = M.height - A.b.ground.height),
                                    (M.players = []),
                                    Object(a.b)(M),
                                    Object(a.a)(M));
                                const N = new URLSearchParams(window.location.search);
                                j = t = parseInt(N.get("size") || "50");
                                const g = new T.b("#ff0015"),
                                    z = new T.b("#145ece");
                                let r = new y.a(g.color),
                                    s = new T.a(Object(n.a)("nickname") || "YOU", g.color, r);
                                ((r.thrust = e.k),
                                    (s.isHuman = !0),
                                    s.join(g),
                                    (g.leader = s),
                                    (r.player = s),
                                    M.players.push(s),
                                    (s.maxAmmo = e.f),
                                    (r.maxAmmo = e.f),
                                    (r.ammo = e.f),
                                    r.move(Object(o.s)((3 * M.width) / 4, M.height / 2)),
                                    M.add(r));
                                const x = Object(D.a)(M, s, {
                                        thrustLevers: {
                                            up: ["ArrowUp", "KeyW"],
                                            down: ["ArrowDown", "KeyS"],
                                        },
                                        elevator: {
                                            up: ["ArrowLeft", "KeyA"],
                                            down: ["ArrowRight", "KeyD"],
                                        },
                                        fire: "Space",
                                        missile: "KeyX",
                                        catapult: "KeyC",
                                    }),
                                    w = [];
                                let l;
                                M.onCrash = function (M) {
                                    if (M.player) {
                                        let j = M.player;
                                        if ((j.detach(), j.isHuman)) {
                                            let M;
                                            for (; (M = w.shift());)
                                                if (M.hasPlane()) {
                                                    (M.disableAI(),
                                                        x(M),
                                                        (M.isHuman = !0),
                                                        (g.leader = M),
                                                        (s = M));
                                                    break;
                                                }
                                        }
                                    }
                                    (clearTimeout(l),
                                        (l = window.setTimeout(() => {
                                            let M = g.members.filter((M) => M.hasPlane()).length,
                                                j = z.members.filter((M) => M.hasPlane()).length;
                                            (0 != M && 0 != j) ||
                                                (0 != M && 0 == j && alert("You won! 🎉"),
                                                0 == M && 0 != j && alert("You lose."),
                                                0 == M && 0 == j && alert("¯\\_(ツ)_/¯"),
                                                (location.href = "?mode=swarm"));
                                        }, 5 * e.n)));
                                };
                                for (let t = 1; t < j; t++) {
                                    const j = i.a.pop() || "no name",
                                        N = new y.a(g.color),
                                        u = new T.a(j, g.color, N);
                                    ((u.number = t),
                                        u.join(g),
                                        (N.player = u),
                                        M.players.push(u),
                                        (u.maxAmmo = e.f),
                                        (N.maxAmmo = e.f),
                                        (N.ammo = e.f),
                                        N.move(
                                            Object(o.s)(
                                                (3 * M.width) / 4 + 100 * Math.random(),
                                                M.height / 2 + 100 * Math.random(),
                                            ),
                                        ),
                                        M.add(N),
                                        (u.disableAI = Object(L.a)(M, u)),
                                        w.push(u));
                                }
                                for (let j = 0; j < t; j++) {
                                    const t = i.a.pop() || "no name",
                                        N = new y.a(z.color),
                                        u = new T.a(t, z.color, N);
                                    ((u.number = j),
                                        u.join(z),
                                        0 === j && (z.leader = u),
                                        (N.player = u),
                                        M.players.push(u),
                                        (u.maxAmmo = e.f),
                                        (N.maxAmmo = e.f),
                                        (N.ammo = e.f),
                                        N.move(
                                            Object(o.s)(
                                                (1 * M.width) / 4 + 100 * Math.random(),
                                                M.height / 2 + 100 * Math.random(),
                                            ),
                                        ),
                                        (N.angle = 2 * Math.PI * Math.random()),
                                        M.add(N),
                                        (u.disableAI = Object(L.a)(M, u)));
                                }
                                const O = document.querySelector("#canvas"),
                                    [C, E] = Object(u.b)(1.25, O);
                                (Object(I.a)(
                                    C,
                                    E,
                                    M,
                                    (j, t) => {
                                        Object(u.a)(j, M, s, t);
                                    },
                                    (M) => {},
                                ),
                                    Object(c.e)(M));
                            })();
                            break;
                        case "playground":
                            !(function () {
                                const M = new S.a({
                                    width: 15e3,
                                    height: 4e3,
                                    ground: 0,
                                    stratosphere: 50,
                                });
                                ((M.ground = M.height - A.b.ground.height), (M.players = []), Object(a.b)(M));
                                const j = new y.a("#ff0015"),
                                    t = new T.a("YOU", "#ff0015", j);
                                (M.players.push(t),
                                    t.control(j),
                                    j.move(Object(o.s)(M.width / 2 - 200, 500)),
                                    M.add(j),
                                    Object(D.a)(M, t, {
                                        thrustLevers: {
                                            up: ["ArrowUp", "KeyW"],
                                            down: ["ArrowDown", "KeyS"],
                                        },
                                        elevator: {
                                            up: ["ArrowLeft", "KeyA"],
                                            down: ["ArrowRight", "KeyD"],
                                        },
                                        fire: "Space",
                                        missile: "KeyX",
                                        catapult: "KeyC",
                                    }),
                                    (j.thrust = e.k));
                                {
                                    const j = i.a.pop() || "no name",
                                        t = "#e2e2e2",
                                        N = new y.a(t),
                                        u = new T.a(j, t, N);
                                    (M.players.push(u),
                                        u.control(N),
                                        N.move(Object(o.s)(M.width / 2, 500)),
                                        M.add(N),
                                        (N.thrust = e.k),
                                        setInterval(() => {
                                            N.pointTo = Object(L.b)(M, N, o.o);
                                        }, 100));
                                }
                                const N = document.querySelector("#canvas"),
                                    [g, n] = Object(u.b)(1.25, N);
                                Object(I.a)(
                                    g,
                                    n,
                                    M,
                                    (j, L) => {
                                        Object(u.a)(j, M, t, L);
                                    },
                                    (M) => {},
                                );
                            })();
                    }
                })(j));
        });
    });
};
