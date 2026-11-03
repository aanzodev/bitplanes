(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};
    const KEY = "dfSetup";

    const GRADIENTS = {
        alpine: "linear-gradient(160deg, #9fd3ff 0%, #e9f4ff 38%, #5f8f55 70%, #2f5a33 100%)",
        canyon: "linear-gradient(160deg, #f6b26b 0%, #f9d8a0 35%, #c0623a 70%, #7a2f1c 100%)",
        islands: "linear-gradient(160deg, #6ec8ff 0%, #bff0ff 35%, #2fb0c0 62%, #1f6f8f 100%)",
        fjords: "linear-gradient(160deg, #aab6c2 0%, #dfe6ee 40%, #6f7f8f 70%, #2c3e50 100%)",
        harbor: "linear-gradient(160deg, #1d2a55 0%, #c77a6a 45%, #5a6070 70%, #1f2733 100%)",
        farmlands: "linear-gradient(160deg, #f7c59a 0%, #ffe6c4 35%, #9ccb5a 65%, #d8c25a 100%)",
    };

    function load() {
        const def = {map: "alpine", sky: "", mode: "team", size: 6, difficulty: ""};
        try {
            return Object.assign(def, JSON.parse(localStorage.getItem(KEY) || "{}"));
        } catch (e) {
            return def;
        }
    }

    function save(s) {
        try {
            localStorage.setItem(KEY, JSON.stringify(s));
        } catch (e) {}
    }

    D.showDeploy = function (go) {
        const setup = load();
        const S = window.BitSettings;
        if (!setup.difficulty) setup.difficulty = (S && S.get("dfDifficulty")) || "normal";
        const el = document.createElement("div");
        el.className = "df-deploy";
        document.body.appendChild(el);
        const shop = window.BitShop, plane = shop && shop.selected();

        function chips(name, list, value) {
            return `<div class="df-chips" data-name="${name}">${list.map(([v, t]) =>
                `<button type="button" class="df-chip${String(v) === String(value) ? " on" : ""}" data-v="${v}">${t}</button>`).join("")}</div>`;
        }

        function render() {
            const sizes = setup.mode === "team" ? [[4, "4 v 4"], [6, "6 v 6"], [8, "8 v 8"]] : [[6, "6 pilots"], [10, "10 pilots"], [14, "14 pilots"]];
            if (!sizes.some(([v]) => v === setup.size)) setup.size = sizes[1][0];
            el.innerHTML = `<div class="df-deploy-box">
                <div class="df-deploy-head"><h2>Flight Sessions <span class="beta-tag">Beta</span></h2>
                    <button type="button" class="df-x" aria-label="Back to the lobby">×</button></div>
                <h3>Environment</h3>
                <div class="df-maps">
                    ${D.MAPS.map(m => `<button type="button" class="df-map${setup.map === m.id ? " on" : ""}" data-map="${m.id}" style="background: ${GRADIENTS[m.id]}">
                        <span class="df-map-icon">${m.icon}</span><b>${m.name}</b><small>${m.desc}</small>
                        <em>${D.SKIES[m.sky].name}</em></button>`).join("")}
                    <button type="button" class="df-map random${setup.map === "random" ? " on" : ""}" data-map="random"><span class="df-map-icon">🎲</span><b>Random Environment</b><small>Any environment, any lighting.</small></button>
                </div>
                <div class="df-opts">
                    <div><h3>Session</h3>${chips("mode", [["team", "Team Flight"], ["ffa", "Open Flight"]], setup.mode)}</div>
                    <div><h3>Participants</h3>${chips("size", sizes, setup.size)}</div>
                    <div><h3>Lighting</h3>${chips("sky", [["", "Environment's own"], ["day", "Day"], ["dawn", "Dawn"], ["sunset", "Sunset"], ["overcast", "Overcast"], ["dusk", "Dusk"], ["night", "Night"]], setup.sky)}</div>
                    <div><h3>AI Pilots</h3>${chips("difficulty", [["easy", "Beginner"], ["normal", "Standard"], ["hard", "Advanced"], ["ace", "Expert"]], setup.difficulty)}</div>
                </div>
                <div class="df-deploy-foot">
                    <div class="df-your-plane">${plane ? `<img src="${window.bitPlaneImage ? window.bitPlaneImage(shop.colorOf(plane), true, plane.skin, shop.patternOf(plane)) : ""}" alt="">
                        <div><small>Selected Aircraft</small><b>${plane.name}</b></div>` : ""}
                        <button type="button" class="pill df-hangar">Aircraft Selection</button>
                        <button type="button" class="pill df-set">⚙ Settings</button></div>
                    <p class="df-tip">${setup.mode === "team" ? "Blue team vs red team. First team to the score goal wins, or the most points in 10 minutes." : "Everyone against everyone. First to 15 points wins."}</p>
                    <button type="button" class="btn df-go">Enter Session</button>
                </div>
            </div>`;
        }

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
            const m = t.closest(".df-map");
            if (m) setup.map = m.dataset.map;
            const c = t.closest(".df-chip");
            if (c) {
                const name = c.parentElement.dataset.name;
                setup[name] = name === "size" ? Number(c.dataset.v) : c.dataset.v;
            }
            if (t.closest(".df-hangar")) {
                close();
                const h = document.querySelector(".open-shop");
                if (h) h.click();
                return;
            }
            if (t.closest(".df-set") && S) return S.show("general");
            if (t.closest(".df-go")) {
                save(setup);
                close();
                const s = Object.assign({}, setup);
                if (s.map === "random") {
                    s.map = D.MAPS[Math.floor(Math.random() * D.MAPS.length)].id;
                    if (!s.sky) s.sky = Object.keys(D.SKIES)[Math.floor(Math.random() * Object.keys(D.SKIES).length)];
                }
                return go(s);
            }
            render();
        });
        document.addEventListener("keydown", onKey, true);
        render();
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
