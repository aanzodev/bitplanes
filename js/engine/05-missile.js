// Missile body.
BitModules[5] = function (M, j, t) {
    "use strict";
    t.d(j, "a", function () {
        return u;
    });
    var L = t(13),
        N = t(2),
        i = t(0);
    class u extends L.a {
        constructor(M) {
            (super(N.b.missile, Object(i.s)(-1, 0), Object(i.s)(0, -1)),
                (this.source = M),
                (this.elevator = 0),
                (this.thrust = 0),
                (this.justDeployed = !0),
                (this.radius = 8),
                (this.mass = 0.1),
                (this.circles = [
                    {
                        v: Object(i.s)(-5, 0),
                        r: 2,
                    },
                    {
                        v: Object(i.s)(-2, 0),
                        r: 2,
                    },
                    {
                        v: Object(i.s)(2, 0),
                        r: 2,
                    },
                    {
                        v: Object(i.s)(5, 0),
                        r: 2,
                    },
                ]));
        }
    }
};
