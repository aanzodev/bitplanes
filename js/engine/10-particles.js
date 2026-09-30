// Particle classes and their update step.
BitModules[10] = function (M, j, t) {
    "use strict";
    (t.d(j, "e", function () {
        return u;
    }),
        t.d(j, "f", function () {
            return e;
        }),
        t.d(j, "b", function () {
            return I;
        }),
        t.d(j, "d", function () {
            return D;
        }),
        t.d(j, "a", function () {
            return g;
        }),
        t.d(j, "c", function () {
            return a;
        }),
        t.d(j, "g", function () {
            return y;
        }));
    var L = t(0),
        N = t(3),
        i = t(1);
    class u {
        constructor() {
            ((this.color = "#000000"),
                (this.size = 1),
                (this.position = Object(L.g)()),
                (this.velocity = Object(L.g)()));
        }
        getX() {
            return this.position.x;
        }
        getY() {
            return this.position.y;
        }
    }
    class e extends u {
        constructor(M) {
            (super(),
                (this.sprite = M),
                (this.angle = 0),
                (this.opacity = 1),
                (this.scale = 1),
                (this.scaleRate = 0.8),
                (this.opacityRate = 0.3),
                (this.size = 0));
        }
    }
    class I extends u {
        constructor(M) {
            (super(), (this.sprite = M));
        }
    }
    class D extends u {
        constructor(M) {
            (super(), (this.sprite = M));
        }
    }
    class g extends u {
        constructor(M) {
            (super(),
                (this.sprites = M),
                (this.frame = 0),
                (this.frameDuration = 100),
                (this.size = 0),
                (this.timeSinceFrameShown = Object(N.g)()));
        }
    }
    class a extends u {
        constructor(M) {
            (super(),
                (this.sprite = M),
                (this.duration = i.n),
                (this.size = 0),
                (this.createdAt = Object(N.g)()));
        }
    }

    function y(M, j) {
        for (let t of M.particles) {
            const u = Object(L.s)(0, t.size);
            ((t.velocity.x += i.m * u.x * j),
                (t.velocity.y += i.m * u.y * j),
                (t.position.x += i.m * t.velocity.x * j),
                (t.position.y += i.m * t.velocity.y * j),
                t instanceof e &&
                    ((t.angle += j),
                    (t.scale += i.m * t.scaleRate * j),
                    (t.opacity -= i.m * t.opacityRate * j),
                    t.opacity < 0 && M.particles.delete(t)),
                t instanceof g &&
                    Object(N.g)() - t.timeSinceFrameShown >= t.frameDuration &&
                    (t.frame++,
                    (t.timeSinceFrameShown = Object(N.g)()),
                    t.frame >= t.sprites.length && M.particles.delete(t)),
                t instanceof a && Object(N.g)() - t.createdAt >= t.duration && M.particles.delete(t),
                t.position.x < 0 && (t.position.x = M.width),
                t.position.x > M.width && (t.position.x = 0),
                t.position.y > M.ground && M.particles.delete(t));
        }
    }
};
