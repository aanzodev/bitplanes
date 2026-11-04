(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};
    const LAST = "dfLastMap";

    function pickSetup() {
        let last = "";
        try {
            last = localStorage.getItem(LAST) || "";
        } catch (e) {}
        const pool = D.MAPS.filter(m => m.id !== last);
        const map = pool[Math.floor(Math.random() * pool.length)] || D.MAPS[0];
        try {
            localStorage.setItem(LAST, map.id);
        } catch (e) {}
        const skies = Object.keys(D.SKIES);
        return {map: map.id, sky: skies[Math.floor(Math.random() * skies.length)], mode: "team", size: 6, difficulty: "normal"};
    }
    D.pickSetup = pickSetup;

    D.showDeploy = function (go) {
        const S = window.BitSettings;
        const el = document.createElement("div");
        el.className = "df-deploy";
        document.body.appendChild(el);
        const shop = window.BitShop, plane = shop && shop.selected();
        el.innerHTML = `<div class="df-deploy-box">
            <div class="df-deploy-head"><h2>Flight Sessions <span class="beta-tag">Beta</span></h2>
                <button type="button" class="df-x" aria-label="Back to the lobby">×</button></div>
            <div class="df-summary">
                <div><span>🛩</span><b>Team Flight</b><small>Blue vs red</small></div>
                <div><span>👥</span><b>6 v 6</b><small>You and 5 wingmen</small></div>
                <div><span>🎲</span><b>Random environment</b><small>One of ${D.MAPS.length}</small></div>
                <div><span>🌗</span><b>Random lighting</b><small>Dawn to night</small></div>
            </div>
            <div class="df-pool">${D.MAPS.map(m => `<span title="${m.name}: ${m.desc}">${m.icon} ${m.name}</span>`).join("")}</div>
            <div class="df-deploy-foot">
                <div class="df-your-plane">${plane ? `<img src="${window.bitPlaneImage ? window.bitPlaneImage(shop.colorOf(plane), true, plane.skin, shop.patternOf(plane)) : ""}" alt="">
                    <div><small>Selected Aircraft</small><b>${plane.name}</b></div>` : ""}
                    <button type="button" class="pill df-hangar">Aircraft Selection</button>
                    <button type="button" class="pill df-set">⚙ Settings</button></div>
                <p class="df-tip">Blue team vs red team. First team to the score goal wins, or the most points in 10 minutes.</p>
                <button type="button" class="btn df-go">Enter Session</button>
            </div>
        </div>`;

        function close() {
            el.remove();
            document.removeEventListener("keydown", onKey, true);
        }
        function onKey(ev) {
            if (ev.key === "Escape" && !(S && S.isOpen())) {
                ev.stopImmediatePropagation();
                close();
            }
            if (ev.key === "Enter" && !(S && S.isOpen())) {
                ev.preventDefault();
                el.querySelector(".df-go").click();
            }
        }
        el.addEventListener("click", ev => {
            const t = ev.target;
            if (t === el || t.closest(".df-x")) return close();
            if (t.closest(".df-hangar")) {
                close();
                const h = document.querySelector(".open-shop");
                if (h) h.click();
                return;
            }
            if (t.closest(".df-set") && S) return S.show("general");
            if (t.closest(".df-go")) {
                close();
                return go(pickSetup());
            }
        });
        document.addEventListener("keydown", onKey, true);
        return close;
    };
    D.makeChute = function (THREE, skin) {
        const s = skin || {jacket: "#6b7a4b", pants: "#4a4f3a", capColor: "#7b4a2a", skin: "#f1c27d", scarf: "#f2f2f2", gloves: "#5a3b22"};
        const mat = c => new THREE.MeshLambertMaterial({color: c, flatShading: true});
        const g = new THREE.Group(), pilot = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.5), mat(s.jacket));
        body.position.y = 1.3;
        pilot.add(body);
        const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.55), mat(s.scarf));
        scarf.position.y = 1.82;
        pilot.add(scarf);
        [-0.22, 0.22].forEach(x => {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.95, 0.38), mat(s.pants));
            leg.position.set(x, 0.42, 0);
            pilot.add(leg);
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.9, 0.26), mat(s.jacket));
            arm.position.set(x * 2.6, 1.95, 0);
            arm.rotation.z = -Math.sign(x) * 0.25;
            pilot.add(arm);
            const hand = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.26), mat(s.gloves));
            hand.position.set(x * 2.9, 2.45, 0);
            pilot.add(hand);
        });
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 8, 6), mat(s.skin));
        head.position.y = 2.15;
        pilot.add(head);
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(s.capColor));
        helmet.position.y = 2.2;
        pilot.add(helmet);
        if (s.visor) {
            const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.1), mat(s.visor));
            visor.position.set(0, 2.18, -0.34);
            pilot.add(visor);
        }
        g.add(pilot);
        const canopy = new THREE.Group();
        const colors = [0xffffff, 0xe8202e];
        for (let i = 0; i < 8; i++) {
            const panel = new THREE.Mesh(new THREE.SphereGeometry(5, 3, 4, i * Math.PI / 4, Math.PI / 4, 0, Math.PI * 0.42),
                new THREE.MeshLambertMaterial({color: colors[i % 2], side: THREE.DoubleSide, flatShading: true}));
            canopy.add(panel);
        }
        canopy.position.y = 9;
        g.add(canopy);
        const lineGeo = new THREE.BufferGeometry();
        const pts = [];
        for (let i = 0; i < 8; i++) {
            const a = i * Math.PI / 4;
            pts.push(Math.cos(a) * 4.8, 10.3, Math.sin(a) * 4.8, 0, 2.5, 0);
        }
        lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
        g.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({color: 0x333333})));
        g.userData.canopy = canopy;
        return g;
    };
})();
