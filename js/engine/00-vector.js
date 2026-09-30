// Vector math helpers.
BitModules[0] = function (M, j, t) {
    "use strict";

    function L(M, j) {
        return {
            x: M,
            y: j,
        };
    }

    function N(M) {
        return L(M.x, M.y);
    }
    (t.d(j, "s", function () {
        return L;
    }),
        t.d(j, "c", function () {
            return N;
        }),
        t.d(j, "g", function () {
            return i;
        }),
        t.d(j, "d", function () {
            return u;
        }),
        t.d(j, "f", function () {
            return e;
        }),
        t.d(j, "a", function () {
            return I;
        }),
        t.d(j, "r", function () {
            return D;
        }),
        t.d(j, "e", function () {
            return g;
        }),
        t.d(j, "l", function () {
            return a;
        }),
        t.d(j, "n", function () {
            return y;
        }),
        t.d(j, "m", function () {
            return T;
        }),
        t.d(j, "o", function () {
            return A;
        }),
        t.d(j, "k", function () {
            return n;
        }),
        t.d(j, "j", function () {
            return c;
        }),
        t.d(j, "b", function () {
            return o;
        }),
        t.d(j, "p", function () {
            return S;
        }),
        t.d(j, "h", function () {
            return z;
        }),
        t.d(j, "i", function () {
            return r;
        }),
        t.d(j, "q", function () {
            return s;
        }));
    const i = () => L(0, 0);

    function u(M, j) {
        return 0 == j ? i() : L(M.x / j, M.y / j);
    }

    function e(M) {
        return L(-M.x, -M.y);
    }

    function I(...M) {
        let j = 0,
            t = 0;
        for (let L of M) ((j += L.x), (t += L.y));
        return L(j, t);
    }

    function D(M, j) {
        return L(M.x - j.x, M.y - j.y);
    }

    function g(M, j) {
        return L(M.x * j, M.y * j);
    }
    const a = c(3),
        y = c(5),
        T = (c(10), c(30)),
        A = c(50),
        n = (c(60), c(90), c(130), c(150), c(180));

    function c(M) {
        return (M * Math.PI) / 180;
    }

    function o(M, j) {
        let t = Math.atan2(M.y, M.x) - Math.atan2(j.y, j.x);
        return (t > Math.PI ? (t -= 2 * Math.PI) : t <= -Math.PI && (t += 2 * Math.PI), t);
    }

    function S(M, j) {
        const t = Math.cos(j),
            N = Math.sin(j);
        return L(M.x * t - M.y * N, M.x * N + M.y * t);
    }

    function z(M) {
        return Math.sqrt(M.x ** 2 + M.y ** 2);
    }

    function r(M) {
        return u(M, z(M));
    }

    function s(M, j) {
        const t = M.x - j.x,
            L = M.y - j.y;
        return Math.sqrt(t * t + L * L);
    }
};
