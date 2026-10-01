// HUD: scoreboards, kill log, cockpit, minimap.
BitModules[9] = function (M, j, t) {
    "use strict";
    (t.d(j, "f", function () {
        return e;
    }),
        t.d(j, "h", function () {
            return I;
        }),
        t.d(j, "g", function () {
            return D;
        }),
        t.d(j, "b", function () {
            return g;
        }),
        t.d(j, "a", function () {
            return a;
        }),
        t.d(j, "d", function () {
            return T;
        }),
        t.d(j, "c", function () {
            return A;
        }),
        t.d(j, "i", function () {
            return z;
        }),
        t.d(j, "e", function () {
            return r;
        }));
    var L = t(1),
        N = t(2),
        i = t(7),
        u = t(3);

    function e(M, j) {
        j.sort((M, j) => M.points() - j.points());
        for (let t = 0; t < j.length; t++) {
            let L = 10 + 28 * t;
            const i = j[j.length - t - 1];
            ((M.textBaseline = "top"),
                (M.font = "20px monospace"),
                (M.fillStyle = "#454545"),
                M.drawImage(N.b.ui.targetMark.canvas, 10, L, 20, 20),
                M.fillText(i.kills.toString(), 33, L + 1),
                M.drawImage(N.b.ui.skull.canvas, 60, L, 20, 20),
                M.fillText(i.deaths.toString(), 83, L + 1),
                (M.font =
                    'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'));
            let e = M.measureText(i.name);
            ((M.fillStyle = "rgba(255, 255, 255, 0.3)"),
                Object(u.d)(M, 112, L - 1, e.width + 6, 25, 5),
                M.fill(),
                (M.fillStyle = "rgb(82, 161, 255)"),
                M.fillText(i.name, 115, L + 1),
                (M.fillStyle = i.color),
                M.fillText(i.name, 115, L));
        }
    }

    function I(M, j, t) {
        const L = (j, t = 0) => {
            ((M.font = "bold 22px monospace"),
                (M.fillStyle = "" + j.color),
                M.fillText(j.points.toString(), 20 + t, 10));
        };
        (L(j, 10), L(t, 60));
        const i = (j, t = 0) => {
            j.members.sort((M, j) => j.points() - M.points());
            for (let L = 0; L < j.members.length; L++) {
                let i = t + 28 * L;
                const e = j.members[L];
                ((M.textBaseline = "top"),
                    (M.font = "20px monospace"),
                    (M.fillStyle = "#454545"),
                    M.drawImage(N.b.ui.targetMark.canvas, 10, i, 20, 20),
                    M.fillText(e.kills.toString(), 33, i + 1),
                    M.drawImage(N.b.ui.skull.canvas, 60, i, 20, 20),
                    M.fillText(e.deaths.toString(), 83, i + 1),
                    (M.font =
                        'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'));
                let I = M.measureText(e.name);
                ((M.fillStyle = "rgba(255, 255, 255, 0.3)"),
                    Object(u.d)(M, 112, i - 1, I.width + 6, 25, 5),
                    M.fill(),
                    (M.fillStyle = "rgb(82, 161, 255)"),
                    M.fillText(e.name, 115, i + 1),
                    (M.fillStyle = e.color),
                    M.fillText(e.name, 115, i));
            }
        };
        (i(j, 42), i(t, 62 + 28 * j.members.length));
    }

    function D(M, j, t) {
        const L = (j, t = 0) => {
            for (let L = 0; L < j.members.length; L++) {
                let i = t + 28 * L;
                const e = j.members[L];
                ((M.textBaseline = "top"),
                    (M.font = "20px monospace"),
                    (M.fillStyle = "#454545"),
                    M.drawImage(N.b.ui.targetMark.canvas, 10, i, 20, 20),
                    M.fillText(e.kills.toString(), 33, i + 1),
                    e.inActivity() || M.drawImage(N.b.ui.skull.canvas, 60, i, 20, 20),
                    (M.font =
                        'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'));
                let I = M.measureText(e.name);
                ((M.fillStyle = "rgba(255, 255, 255, 0.3)"),
                    Object(u.d)(M, 92, i - 1, I.width + 6, 25, 5),
                    M.fill(),
                    (M.fillStyle = "rgb(82, 161, 255)"),
                    M.fillText(e.name, 95, i + 1),
                    (M.fillStyle = e.color),
                    M.fillText(e.name, 95, i));
            }
        };
        (L(j, 10), L(t, 20 + 28 * j.members.length));
    }
    const g = '<div class="icon skull"></div>',
        a = '<div class="icon missile"></div>';

    function y(M) {
        (setTimeout(() => {
            M.classList.add("hide");
        }, 7e3),
            setTimeout(() => {
                M.remove();
            }, 7300));
    }

    function T(M, j, t = '<div class="icon target"></div>') {
        const L = document.createElement("div");
        ((L.innerHTML = `<span class="message">${M.html()} ${t} ${j.html()}</span>`),
            Object(u.a)(".log").appendChild(L),
            y(L),
            window.bitOnLog && window.bitOnLog(L.innerHTML),
            (j.team && j.team == M.team) || M == j
                ? M.kills--
                : (M.kills++, window.BitShop && window.BitShop.onKill(M)),
            j.deaths++,
            M.isHuman && i.c.killed++,
            j.isHuman && i.c.deaths++);
    }

    function A(M) {
        const j = document.createElement("div");
        ((j.innerHTML = `<span class="message">${g} ${M.html()}</span>`),
            Object(u.a)(".log").appendChild(j),
            y(j),
            window.bitOnLog && window.bitOnLog(j.innerHTML),
            M.deaths++,
            M.isHuman && i.c.deaths++);
    }
    let n, c, o, S;

    function z(M) {
        const j = o.offsetHeight - S.offsetHeight;
        if (2 == M.maxMissiles) {
            c.querySelectorAll(".missile").length < 2 &&
                (c.innerHTML = '<div class="missile"></div><div class="missile"></div>');
            let j = [...c.querySelectorAll(".missile")];
            for (let t = 0; t < L.i - M.missiles; t++) j[t].classList.add("hidden");
            for (let t = L.i - M.missiles; t < L.i; t++) j[t].classList.remove("hidden");
        } else c.innerText = "" + M.missiles;
        if (
            ((S.style.transform = `translateY(-${j * Math.min(1, M.thrust / (M.maxThrust || L.k))}px)`),
            M.maxAmmo > L.f)
        )
            n.innerText = "" + M.ammo;
        else {
            n.querySelectorAll(".ammo").length < M.maxAmmo &&
                (n.innerHTML = '<div class="ammo"></div>'.repeat(M.maxAmmo));
            let j = [...n.querySelectorAll(".ammo")];
            for (let t = 0; t < M.ammo; t++) j[t].classList.remove("hidden");
            for (let t = M.ammo; t < M.maxAmmo; t++) j[t].classList.add("hidden");
        }
        // Flares (Q), only on planes that carry them.
        const f = document.querySelector(".flare-capacity");
        f &&
            ((f.hidden = !(M.maxFlares > 0)),
            M.maxFlares > 0 &&
                (f.innerHTML = Array.from(
                    { length: M.maxFlares },
                    (_, k) => `<i class="flare${k < M.flares ? "" : " hidden"}"></i>`,
                ).join("")));
    }

    function r(M) {
        const j = Object(u.a)(".minimap"),
            t = j.getContext("2d");
        let L, N;

        function i() {
            const M = window.devicePixelRatio || 1,
                i = j.getBoundingClientRect();
            ((j.width = i.width * M),
                (j.height = i.height * M),
                (L = j.width / M),
                (N = j.height / M),
                t.scale(M, M));
        }
        (i(),
            window.addEventListener(
                "resize",
                function () {
                    i();
                },
                !1,
            ),
            setInterval(function () {
                (t.clearRect(0, 0, L, N),
                    (t.globalAlpha = 0.4),
                    (t.fillStyle = "grey"),
                    t.fillRect(0, 0, L, N),
                    (t.globalAlpha = 1));
                for (let j of M.players) {
                    let i = j.hasPlane();
                    i &&
                        ((t.fillStyle = j.color),
                        t.fillRect(
                            (L * i.position.x) / M.width - 2,
                            (N * i.position.y) / M.height - 2,
                            4,
                            4,
                        ));
                }
            }, 300));
    }
    Object(u.b)(() => {
        ((n = Object(u.a)(".ammo-capacity")),
            (c = Object(u.a)(".missile-capacity")),
            (o = Object(u.a)(".thrust")),
            (S = Object(u.a)(".thrust-level")));
    });
};
