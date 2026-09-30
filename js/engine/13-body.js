// Base class for everything that moves.
BitModules[13] = function (M, j, t) {
    "use strict";
    t.d(j, "a", function () {
        return N;
    });
    var L = t(0);
    class N {
        constructor(M, j = Object(L.s)(1, 0), t = Object(L.s)(0, 1)) {
            ((this.sprite = M),
                (this.forward = j),
                (this.normal = t),
                (this.mass = 1),
                (this.angle = 0),
                (this.radius = 1),
                (this.previous = Object(L.g)()),
                (this.position = Object(L.g)()),
                (this.velocity = Object(L.g)()),
                (this.force = Object(L.g)()),
                (this.circles = []),
                (this.timeouts = []),
                (this.intervals = []));
        }
        move(M) {
            ((this.position = M), (this.previous = Object(L.c)(M)));
        }
        getX(M) {
            return this.position.x * M + this.previous.x * (1 - M);
        }
        getY(M) {
            return this.position.y * M + this.previous.y * (1 - M);
        }
        setTimeout(M, j) {
            const t = window.setTimeout(M, j);
            return (this.timeouts.push(t), t);
        }
        timeout(M, j) {
            return this.setTimeout(j, M);
        }
        setInterval(M, j) {
            const t = window.setInterval(M, j);
            return (this.intervals.push(t), t);
        }
        interval(M, j) {
            return this.setInterval(j, M);
        }
        destroy() {
            for (let M of this.timeouts) clearTimeout(M);
            for (let M of this.intervals) clearInterval(M);
        }
    }
};
