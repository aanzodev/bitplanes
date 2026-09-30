// Cows wandering on the ground.
BitModules[11] = function (M, j, t) {
    "use strict";
    (t.d(j, "b", function () {
        return L;
    }),
        t.d(j, "a", function () {
            return I;
        }));
    var L,
        N = t(2),
        i = t(0),
        u = t(3),
        e = t(13);
    !(function (M) {
        ((M[(M.Left = 0)] = "Left"), (M[(M.Right = 1)] = "Right"));
    })(L || (L = {}));
    class I extends e.a {
        constructor() {
            (super(N.b.cow),
                (this.t2 = 0),
                (this.frame = 0),
                (this.running = !1),
                (this.direction = Math.random() > 0.5 ? L.Left : L.Right),
                (this.dead = !1),
                (this.landed = !1),
                (this.angle = 0),
                (this.radius = 10),
                (this.mass = 20),
                (this.circles = [
                    {
                        v: Object(i.s)(-5, -1),
                        r: 6,
                    },
                    {
                        v: Object(i.s)(5, -1),
                        r: 6,
                    },
                ]));
        }
        draw(M) {
            const j = Object(u.g)();
            (j - this.t2 > 100 && (this.frame++, (this.t2 = j)),
                M.save(),
                this.direction == L.Left && M.scale(-1, 1),
                this.dead
                    ? N.b.cowDead.drawMiddle(M)
                    : this.running
                      ? N.b.cowRunning[this.frame % N.b.cowRunning.length].drawMiddle(M)
                      : this.sprite.drawMiddle(M),
                M.restore());
        }
    }
};
