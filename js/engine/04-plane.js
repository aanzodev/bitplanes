// The plane body and its generated sprites (biplane, jet, prop).
BitModules[4] = function (M, j, t) {
    "use strict";
    t.d(j, "a", function () {
        return I;
    });
    var L = t(2);

    function J(M, j) {
        return (
            "data:image/svg+xml;base64," +
            btoa(`<svg width="36px" height="22px" viewBox="0 0 36 22" xmlns="http://www.w3.org/2000/svg">
        <path d="M26.5 10 L30.5 1.5 L34.5 1.5 L34 10 Z" fill="${M}" stroke="#000" stroke-width="1"/>
        <path d="M1 12.5 L7.5 9.5 L30 9 L35 10.5 L35 13.5 L30 14.5 L7.5 14.5 Z" fill="${M}" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M1 12.5 L7.5 9.5 L7.5 14.5 Z" fill="#555" stroke="#000" stroke-width="1" stroke-linejoin="round"/>
        <path d="M12.5 12.5 L23.5 12.5 L29 19.5 L22 19.5 Z" fill="${M}" stroke="#000" stroke-width="1" stroke-linejoin="round"/>
        <path d="M12.5 12.5 L23.5 12.5 L29 19.5 L22 19.5 Z" fill="#000" fill-opacity="0.25"/>
        <path d="M27 12 L33 12" stroke="#000" stroke-opacity="0.35"/>
        <path d="M8.5 9.6 C10 5.5 16 5.2 18.5 9.3 Z" fill="${j ? "#9fdcff" : "#46616e"}" stroke="#000" stroke-width="1"/>
        ${j ? '<circle cx="13.5" cy="8" r="1.8" fill="#8B572A" stroke="#000" stroke-width="0.6"/>' : ""}
        <rect x="34.5" y="10.8" width="1.5" height="2.4" fill="#ff9d00"/>
    </svg>`)
        );
    }

    // WWII style propeller fighter (skin "prop").
    function K(M, j) {
        return (
            "data:image/svg+xml;base64," +
            btoa(`<svg width="36px" height="22px" viewBox="0 0 36 22" xmlns="http://www.w3.org/2000/svg">
    <path d="M26.5 11 L29.5 3.5 L33.8 3.5 L34 11 Z" fill="${M}" stroke="#000" stroke-width="1" stroke-linejoin="round"/>
    <path d="M13 16.5 L12 19" stroke="#000" stroke-width="1"/>
    <circle cx="12" cy="19.6" r="1.6" fill="#D8D8D8" stroke="#000" stroke-width="0.6"/>
    <path d="M4 10.2 Q6 8 11 8 L30 9.5 L34.5 11 L34.2 12.6 L28 14 L11 15.2 Q6 15.2 4 13.2 Z" fill="${M}" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M4 10.2 Q6 8 8.5 8.2 L8.5 15 Q6 15.2 4 13.2 Z" fill="#3a3a3a"/>
    <path d="M27.5 11.8 L35 11.8" stroke="#000" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M10.5 13.2 L22.5 13.2 L20.5 17.2 L12.5 17.2 Z" fill="${M}" stroke="#000" stroke-width="1" stroke-linejoin="round"/>
    <path d="M10.5 13.2 L22.5 13.2 L20.5 17.2 L12.5 17.2 Z" fill="#000" fill-opacity="0.2"/>
    <path d="M13 8.3 C14.2 4.6 19.2 4.6 20.6 8.8 Z" fill="${j ? "#9fdcff" : "#46616e"}" stroke="#000" stroke-width="1"/>
    ${j ? '<circle cx="16.6" cy="7" r="1.7" fill="#8B572A" stroke="#000" stroke-width="0.6"/>' : ""}
    <path d="M2.3 3 L2.3 19.5" stroke="#616161" stroke-opacity="0.9" stroke-linecap="square"/>
    <circle cx="3" cy="11.6" r="1.6" fill="#555" stroke="#000" stroke-width="0.6"/>
</svg>`)
        );
    }

    function P(M, j = !0, t) {
        if ("jet" === t) return J(M, j);
        if ("prop" === t) return K(M, j);
        return (
            "data:image/svg+xml;base64," +
            btoa(
                `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="36px" height="22px" viewBox="0 0 36 22" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">\n    <g id="plane" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">\n        <path d="M9,20 L6.5,14.837989" id="Line-5" stroke="#000000" stroke-linecap="square"></path>\n        <path d="M9,20 L12.5,15" id="Line-6" stroke="#000000" stroke-linecap="square"></path>\n        <path d="M1,10.6473106 L5.5,10.6473106" id="Line-2" stroke="#000000" stroke-width="1.5" stroke-linecap="square"></path>\n        <path d="M1.5,1.5 L1.5,19.5" id="Line-3" stroke="#616161" opacity="0.897600446" stroke-linecap="square"></path>\n        ${j ? '<circle id="Oval" stroke="#000000" fill="#8B572A" cx="18" cy="6" r="3"></circle>' : ""}\n        <circle id="Oval" stroke="#000000" fill="#D8D8D8" cx="9" cy="19" r="2"></circle>\n        <path d="M7,6 C9.64828465,6 12.1482847,6 14.5,6 C16.3325123,8.43421188 19,8.78938418 21,6 C24.1271127,9 26.9158998,8.38196373 29.3663615,4.1458912 C30.796177,0.0888319406 35,1.37620196 35,4.1458912 L35,9.52014093 C27.1897306,13.6293783 18.3448695,15.3528534 14.4693514,16 C11.9889294,16.2076026 9.49914561,15.8742692 7,15 L7,6 Z" id="Path-2" stroke="#000000" fill="${M}"></path>\n        <path d="M15.5,13.5 L11.5,2.57605962" id="Line-4" stroke="#000000" stroke-width="1.5" stroke-linecap="square"></path>\n        <path d="M11.5,13.5 L7.5,2.57605962" id="Line-4" stroke="#000000" stroke-width="1.5" stroke-linecap="square"></path>\n        <path d="M7,6 L4.04141777,6 C2.65286074,8.33959901 2.65286074,12.4359008 4.04141777,15 L7,15 L7,6 Z" id="Path-3" stroke="#000000" fill="#3ED53E"></path>\n        <rect id="Rectangle" stroke="#000000" fill="#F5A623" x="4.5" y="0.5" width="10" height="2" rx="1"></rect>\n        <rect id="Rectangle" stroke-opacity="0.5" stroke="#000000" fill="#F5A623" x="28.5" y="7.5" width="6" height="2" rx="1"></rect>\n        <rect id="Rectangle" stroke-opacity="0.5019941" stroke="#000000" fill="#C28219" x="8.5" y="12.5" width="10" height="2" rx="1"></rect>\n        <polygon id="Path-4" fill-opacity="0.545891608" fill="#FFFFFF" points="7 9.63371095 7 7.5 3.46379584 7.5 3 9.63371095"></polygon>\n    </g>\n</svg>`,
            )
        );
    }

    function N(M, j = !0, t) {
        const i = new L.a(P(M, j, t), 36, 22);
        return ((i.planeKey = [M, j ? 1 : 0, t || ""]), i);
    }
    window.bitPlaneImage = P;
    var i = t(13),
        u = t(1),
        e = t(0);
    class I extends i.a {
        constructor(M) {
            (super(N(M), Object(e.s)(0, -1), Object(e.s)(0, -1)),
                (this.lastSmoke = 0),
                (this.elevator = 0),
                (this.thrust = 0),
                (this.landed = !1),
                (this.life = u.h),
                (this.missiles = u.i),
                (this.maxMissiles = u.i),
                (this.ammo = 0),
                (this.maxAmmo = 0),
                (this.gunReloading = !1),
                (this.missileReloading = !1),
                (this.color = "black"),
                (this.color = M),
                (this.thrust = 0),
                (this.radius = 20),
                (this.circles = [
                    {
                        v: Object(e.s)(-12, -9),
                        r: 2,
                    },
                    {
                        v: Object(e.s)(-8, -9),
                        r: 2,
                    },
                    {
                        v: Object(e.s)(-5, -9),
                        r: 2,
                    },
                    {
                        v: Object(e.s)(-10, 0),
                        r: 5,
                    },
                    {
                        v: Object(e.s)(-5, 0),
                        r: 5,
                    },
                    {
                        v: Object(e.s)(0, 0),
                        r: 4.5,
                    },
                    {
                        v: Object(e.s)(0, -5),
                        r: 3,
                    },
                    {
                        v: Object(e.s)(6, 0),
                        r: 3.5,
                    },
                    {
                        v: Object(e.s)(10, -1),
                        r: 3.5,
                    },
                    {
                        v: Object(e.s)(15, -2),
                        r: 3,
                    },
                    {
                        v: Object(e.s)(14, -5),
                        r: 4,
                    },
                    {
                        v: Object(e.s)(-9, 8),
                        r: 2.5,
                    },
                ]));
        }
        get player() {
            return this._player;
        }
        set player(M) {
            ((this._player = M), (this.team = null == M ? void 0 : M.team));
        }
        catapultPilot() {
            ((this._player = void 0),
                (this.thrust = 0),
                (this.elevator = 0),
                (this.sprite = N(this.color, !1, this.skin)));
        }
        setSkin(M, j) {
            ((this.color = M), (this.skin = j), (this.sprite = N(M, !0, j)));
        }
    }
};
