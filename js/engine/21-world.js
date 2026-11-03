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
            ((this.participants = []),
                (this.worldEntities = new Set()),
                (this.aircraftOperators = new Set()),
                (this.projectiles = new Set()),
                (this.structures = new Set()),
                (this.effects = new Set()),
                (this.atmosphere = []),
                (this.terrainEntities = new Set()),
                (this.onImpact = (M) => {}),
                (this.onTargetDestroyed = (M) => {}),
                (this.width = M.width),
                (this.height = M.height),
                (this.ground = M.ground),
                (this.stratosphere = M.stratosphere));
        }
        *[Symbol.iterator]() {
            (yield* this.structures, yield* this.worldEntities, yield* this.projectiles, yield* this.aircraftOperators);
        }
        add(M) {
            M instanceof L.a
                ? this.projectiles.add(M)
                : M instanceof i.b
                  ? this.aircraftOperators.add(M)
                  : M instanceof N.a
                    ? this.structures.add(M)
                    : this.worldEntities.add(M);
        }
        has(M) {
            return M instanceof L.a
                ? this.projectiles.has(M)
                : M instanceof i.b
                  ? this.aircraftOperators.has(M)
                  : M instanceof N.a
                    ? this.structures.has(M)
                    : this.worldEntities.has(M);
        }
        delete(M) {
            (M instanceof L.a
                ? this.projectiles.delete(M)
                : M instanceof i.b
                  ? this.aircraftOperators.delete(M)
                  : M instanceof N.a
                    ? this.structures.delete(M)
                    : this.worldEntities.delete(M),
                M.destroy());
        }
    }
};
