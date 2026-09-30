// The world: holds every body, pilot, bullet and particle.
BitModules[21] = function (M, j, t) {
    "use strict";
    t.d(j, "a", function () {
        return u;
    });
    var L = t(15),
        N = t(17),
        i = t(8);
    class u {
        constructor(M) {
            ((this.players = []),
                (this.bodies = new Set()),
                (this.pilots = new Set()),
                (this.bullets = new Set()),
                (this.barns = new Set()),
                (this.particles = new Set()),
                (this.clouds = []),
                (this.groundObjects = new Set()),
                (this.onCrash = (M) => {}),
                (this.onCowKill = (M) => {}),
                (this.width = M.width),
                (this.height = M.height),
                (this.ground = M.ground),
                (this.stratosphere = M.stratosphere));
        }
        *[Symbol.iterator]() {
            (yield* this.barns, yield* this.bodies, yield* this.bullets, yield* this.pilots);
        }
        add(M) {
            M instanceof L.a
                ? this.bullets.add(M)
                : M instanceof i.b
                  ? this.pilots.add(M)
                  : M instanceof N.a
                    ? this.barns.add(M)
                    : this.bodies.add(M);
        }
        has(M) {
            return M instanceof L.a
                ? this.bullets.has(M)
                : M instanceof i.b
                  ? this.pilots.has(M)
                  : M instanceof N.a
                    ? this.barns.has(M)
                    : this.bodies.has(M);
        }
        delete(M) {
            (M instanceof L.a
                ? this.bullets.delete(M)
                : M instanceof i.b
                  ? this.pilots.delete(M)
                  : M instanceof N.a
                    ? this.barns.delete(M)
                    : this.bodies.delete(M),
                M.destroy());
        }
    }
};
