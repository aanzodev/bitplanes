// Pilot and parachute bodies.
BitModules[8] = function (M, j, t) {
    "use strict";
    (t.d(j, "b", function () {
        return u;
    }),
        t.d(j, "a", function () {
            return e;
        }));
    var L = t(13),
        N = t(2),
        i = t(0);
    class u extends L.a {
        constructor(M) {
            (super(N.b.pilot, Object(i.s)(0, -1), Object(i.s)(0, -1)),
                (this.plane = M),
                (this.landed = !1),
                (this.color = "black"),
                (this.mass = 0.5),
                (this.hasParachute = !0),
                (this.radius = 5),
                (this.circles = [
                    {
                        v: Object(i.s)(0, 0),
                        r: 3,
                    },
                    {
                        v: Object(i.s)(0, 3),
                        r: 2,
                    },
                ]));
        }
        deployParachute(M) {
            this.hasParachute &&
                !this.landed &&
                ((this.hasParachute = !1),
                (this.parachute = new e(this)),
                this.updateParachute(),
                M.add(this.parachute));
        }
        updateParachute() {
            this.parachute &&
                (this.parachute.move(
                    Object(i.a)(this.position, Object(i.s)(this.velocity.x > 0 ? -1 : 1, -22)),
                ),
                (this.parachute.angle = this.velocity.x > 0 ? -i.l : i.l));
        }
    }
    class e extends L.a {
        constructor(M) {
            (super(N.b.parachute, Object(i.s)(0, -1), Object(i.s)(0, -1)),
                (this.load = M),
                (this.radius = 25),
                (this.circles = [
                    {
                        v: Object(i.s)(0, -8),
                        r: 9,
                    },
                    {
                        v: Object(i.s)(-10, -8),
                        r: 8,
                    },
                    {
                        v: Object(i.s)(10, -8),
                        r: 8,
                    },
                    {
                        v: Object(i.s)(-20, -5),
                        r: 6,
                    },
                    {
                        v: Object(i.s)(20, -5),
                        r: 6,
                    },
                ]));
        }
    }
};
