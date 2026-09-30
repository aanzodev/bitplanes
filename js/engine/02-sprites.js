// Sprite class and the sprite sheet used by the renderer.
BitModules[2] = function (M, j, t) {
    "use strict";
    t.d(j, "a", function () {
        return L;
    });
    class L {
        constructor(M, j, t, L = 1, N = window.devicePixelRatio || 1) {
            ((this.width = j),
                (this.height = t),
                (this.scale = L),
                (this.dpr = N),
                (this.width *= this.scale),
                (this.height *= this.scale),
                (this.canvas = document.createElement("canvas")),
                (this.canvas.width = this.width * this.dpr),
                (this.canvas.height = this.height * this.dpr));
            const i = new Image();
            ((i.onload = () => {
                this.canvas
                    .getContext("2d")
                    .drawImage(i, 0, 0, this.width * this.dpr, this.height * this.dpr);
            }),
                (i.src = M));
        }
        drawMiddle(M) {
            M.drawImage(this.canvas, -this.width / 2, -this.height / 2, this.width, this.height);
        }
        draw(M) {
            M.drawImage(this.canvas, 0, 0, this.width, this.height);
        }
    }
    j.b = {
        pointerUp: new L(t(26), 12, 6),
        pointerDown: new L(t(27), 12, 6),
        bullet: new L(t(28), 5, 5),
        plane1: new L(t(29), 36, 22),
        plane2: new L(t(30), 36, 22),
        pilot: new L(t(31), 8, 11),
        puff: new L(t(32), 10, 8),
        explosion: [
            new L(t(33), 20, 21),
            new L(t(34), 42, 40),
            new L(t(35), 86, 72),
            new L(t(36), 130, 120),
            new L(t(37), 173, 137),
            new L(t(38), 100, 95),
            new L(t(39), 94, 84),
            new L(t(40), 86, 78),
            new L(t(41), 76, 69),
        ],
        ground: new L(t(42), 192, 32),
        groundObjects: [new L(t(43), 36, 25), new L(t(44), 43, 28)],
        clouds: [
            new L(t(45), 310, 100),
            new L(t(46), 169, 81),
            new L(t(47), 459, 119),
            new L(t(48), 214, 111),
            new L(t(49), 272, 165),
            new L(t(50), 385, 177),
            new L(t(51), 508, 148),
            new L(t(52), 187, 99),
            new L(t(53), 213, 133),
        ],
        groundhit: [
            new L(t(54), 30, 31),
            new L(t(55), 30, 31),
            new L(t(56), 30, 31),
            new L(t(57), 30, 31),
            new L(t(58), 30, 31),
            new L(t(59), 30, 31),
            new L(t(60), 30, 31),
            new L(t(61), 30, 31),
            new L(t(62), 30, 31),
            new L(t(63), 30, 31),
            new L(t(64), 30, 31),
            new L(t(65), 30, 31),
        ],
        missile: new L(t(66), 17, 9),
        missileFire: [new L(t(67), 5, 6), new L(t(68), 5, 5)],
        barn: new L(t(69), 100, 42, 2),
        forest: new L(t(70), 1367, 392, 1, 1),
        forest2: new L(t(71), 1367, 392, 1, 1),
        cow: new L(t(25), 66, 62, 0.3),
        cowRunning: [
            new L(t(72), 68, 59, 0.3),
            new L(t(73), 67, 62, 0.3),
            new L(t(74), 68, 65, 0.3),
            new L(t(75), 73, 59, 0.3),
        ],
        cowDead: new L(t(76), 70, 40, 0.3),
        ui: {
            targetMark: new L(t(77), 16, 16),
            skull: new L(t(78), 16, 16),
        },
        parachute: new L(t(79), 53, 36),
        angel: new L(t(80), 13, 11),
        flare: new L(t(88), 12, 12),
    };
};
