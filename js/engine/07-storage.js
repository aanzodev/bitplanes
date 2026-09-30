// localStorage helpers and lifetime stats.
BitModules[7] = function (M, j, t) {
    "use strict";

    function L(M) {
        try {
            return localStorage.getItem(M);
        } catch (M) {
            return null;
        }
    }

    function N(M, j) {
        try {
            return localStorage.setItem(M, j);
        } catch (M) {
            return null;
        }
    }
    (t.d(j, "a", function () {
        return L;
    }),
        t.d(j, "b", function () {
            return N;
        }),
        t.d(j, "c", function () {
            return i;
        }));
    let i = {
        bullets: 0,
        missiles: 0,
        killed: 0,
        deaths: 0,
        cowKilled: 0,
    };
    try {
        let M = JSON.parse(L("stats") || "{}");
        i = Object.assign(Object.assign({}, i), M);
    } catch (M) {}
    setInterval(() => {
        N("stats", JSON.stringify(i));
    }, 1e3);
};
