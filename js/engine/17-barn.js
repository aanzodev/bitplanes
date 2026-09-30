// Barn: land here to get a new plane.
BitModules[17] = function (M, j, t) {
    "use strict";
    t.d(j, "a", function () {
        return I;
    });
    var L = t(13),
        N = t(1),
        i = t(2),
        u = t(0),
        e = t(4);
    class I extends L.a {
        constructor(M, j) {
            (super(i.b.barn, Object(u.s)(1, 0), Object(u.s)(0, 1)),
                (this.radius = 100),
                (this.circles = [
                    {
                        v: Object(u.s)(0, 50),
                        r: 90,
                    },
                ]),
                this.move(Object(u.s)(M, j - this.sprite.height / 2 + 2)));
        }
        newPlane(M, j) {
            j.waitingForPlane ||
                (j.waitingForPlane = window.setTimeout(() => {
                    let t = j.player;
                    if (!M.has(j)) return;
                    if (!t) return;
                    const L = new e.a(t.color);
                    ((L.life = N.h),
                        (L.ammo = L.maxAmmo = t.maxAmmo),
                        (L.missiles = L.maxMissiles = t.maxMissiles),
                        (L.landed = !0),
                        L.move(Object(u.s)(j.position.x, M.ground)),
                        (j.player = void 0),
                        j.destroy(),
                        M.delete(j),
                        t.control(L),
                        M.add(L));
                }, N.n));
        }
    }
};
