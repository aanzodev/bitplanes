// Players and teams.
BitModules[12] = function (M, j, t) {
    "use strict";
    (t.d(j, "b", function () {
        return u;
    }),
        t.d(j, "a", function () {
            return e;
        }));
    var L = t(8),
        N = t(4),
        i = t(1);
    class u {
        constructor(M) {
            ((this.color = M),
                (this.name = ""),
                (this.members = []),
                (this.startingPosition = 0),
                (this.points = 100),
                (this.count = 6));
        }
    }
    class e {
        constructor(M, j, t) {
            ((this.name = M),
                (this.color = j),
                (this.object = t),
                (this.kills = 0),
                (this.deaths = 0),
                (this.maxAmmo = i.f),
                (this.maxMissiles = i.i),
                (this.number = 0),
                (this.isHuman = !1),
                (this.disableAI = () => {}));
        }
        join(M) {
            ((this.team = M), M.members.push(this));
        }
        toString() {
            return this.name;
        }
        html() {
            return `<span style="color: ${this.color};">${this.name}</span>`;
        }
        points() {
            return this.kills;
        }
        control(M) {
            ((this.object = M), (M.player = this));
        }
        hasPlane() {
            if (this.object && this.object instanceof N.a) return this.object;
        }
        hasPilot() {
            if (this.object && this.object instanceof L.b) return this.object;
        }
        inActivity() {
            return void 0 !== this.object;
        }
        detach() {
            this.object = void 0;
        }
    }
};
