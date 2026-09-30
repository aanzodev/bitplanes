// Small helpers: time, shuffle, DOM ready, rounded rects.
BitModules[3] = function (M, j, t) {
    "use strict";
    (t.d(j, "g", function () {
        return N;
    }),
        t.d(j, "h", function () {
            return i;
        }),
        t.d(j, "f", function () {
            return u;
        }),
        t.d(j, "c", function () {
            return e;
        }),
        t.d(j, "e", function () {
            return D;
        }),
        t.d(j, "a", function () {
            return g;
        }),
        t.d(j, "b", function () {
            return a;
        }),
        t.d(j, "d", function () {
            return y;
        }));
    var L = t(0);

    function N() {
        return window.performance && window.performance.now ? window.performance.now() : Date.now();
    }

    function i(M, j) {
        return M < j && M > -j ? M : 0;
    }

    function u(M, j) {
        let t;
        const L = () => {
            (M(), (t = null));
        };
        return function () {
            t || (t = window.setTimeout(L, j));
        };
    }

    function e(M, j, t) {
        if (M.x < t.width / 2) {
            return I(M, j, Object(L.s)(j.x - t.width, j.y));
        }
        return I(M, j, Object(L.s)(j.x + t.width, j.y));
    }

    function I(M, j, t) {
        return Object(L.q)(M, t) < Object(L.q)(M, j) ? t : j;
    }

    function D(M) {
        let j,
            t,
            L = M.length;
        for (; 0 !== L;)
            ((t = Math.floor(Math.random() * L)), (L -= 1), (j = M[L]), (M[L] = M[t]), (M[t] = j));
        return M;
    }

    function g(M) {
        return document.querySelector(M);
    }

    function a(M) {
        "complete" === document.readyState || "interactive" === document.readyState
            ? M()
            : document.addEventListener("DOMContentLoaded", M);
    }

    function y(M, j, t, L, N, i) {
        (M.beginPath(),
            M.moveTo(j + i, t),
            M.lineTo(j + L - i, t),
            M.quadraticCurveTo(j + L, t, j + L, t + i),
            M.lineTo(j + L, t + N - i),
            M.quadraticCurveTo(j + L, t + N, j + L - i, t + N),
            M.lineTo(j + i, t + N),
            M.quadraticCurveTo(j, t + N, j, t + N - i),
            M.lineTo(j, t + i),
            M.quadraticCurveTo(j, t, j + i, t),
            M.closePath());
    }
};
