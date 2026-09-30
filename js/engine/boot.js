// Starts the game: the module loader (from the original webpack build).
// Every engine file registers itself in window.BitModules first.
!(function (M) {
    var j = {};

    function t(L) {
        if (j[L]) return j[L].exports;
        var N = (j[L] = {
            i: L,
            l: !1,
            exports: {},
        });
        return (M[L].call(N.exports, N, N.exports, t), (N.l = !0), N.exports);
    }
    ((t.m = M),
        (t.c = j),
        (t.d = function (M, j, L) {
            t.o(M, j) ||
                Object.defineProperty(M, j, {
                    enumerable: !0,
                    get: L,
                });
        }),
        (t.r = function (M) {
            ("undefined" != typeof Symbol &&
                Symbol.toStringTag &&
                Object.defineProperty(M, Symbol.toStringTag, {
                    value: "Module",
                }),
                Object.defineProperty(M, "__esModule", {
                    value: !0,
                }));
        }),
        (t.t = function (M, j) {
            if ((1 & j && (M = t(M)), 8 & j)) return M;
            if (4 & j && "object" == typeof M && M && M.__esModule) return M;
            var L = Object.create(null);
            if (
                (t.r(L),
                Object.defineProperty(L, "default", {
                    enumerable: !0,
                    value: M,
                }),
                2 & j && "string" != typeof M)
            )
                for (var N in M)
                    t.d(
                        L,
                        N,
                        function (j) {
                            return M[j];
                        }.bind(null, N),
                    );
            return L;
        }),
        (t.n = function (M) {
            var j =
                M && M.__esModule
                    ? function () {
                          return M.default;
                      }
                    : function () {
                          return M;
                      };
            return (t.d(j, "a", j), j);
        }),
        (t.o = function (M, j) {
            return Object.prototype.hasOwnProperty.call(M, j);
        }),
        (t.p = (window.BitBase || "") + "assets/sprites/"),
        t((t.s = 87)));
})(window.BitModules);
