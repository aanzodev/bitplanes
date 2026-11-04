(function () {
    const MODES = {
        "combat": {name: "Combat Mode", desc: "Free-for-all combat"},
        "multiplayer": {name: "Online Multiplayer", desc: "Real players online · 10 min sessions"},
        "flightmode": {name: "3D Flight Mode", desc: "BETA · 3D flights over real terrain", beta: true},
        "swarm": {name: "Swarm", desc: "Two big teams"},
    };

    function short(n) {
        n = Math.floor(n || 0);
        const units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
        for (const [v, u] of units) {
            if (n >= v) {
                const x = n / v;
                return (x >= 100 ? Math.floor(x) : Math.floor(x * 10) / 10) + u;
            }
        }
        return String(n);
    }

    function planeImage(p) {
        const shop = window.BitMarket;
        return window.bitPlaneImage ? window.bitPlaneImage(shop.colorOf(p), true, p.skin, shop.patternOf(p)) : "";
    }

    function update() {
        const shop = window.BitMarket;
        if (!shop) return;
        const st = shop.state(), p = shop.selected();
        document.querySelectorAll(".coin-short").forEach(el => {
            el.textContent = short(st.coins);
            el.parentElement.title = st.coins.toLocaleString() + " credits";
        });
        const chip = document.querySelector(".lobby-plane-chip");
        if (chip) {
            const img = planeImage(p);
            if (chip.querySelector("img").src !== img) chip.querySelector("img").src = img;
            chip.querySelector("span").textContent = p.name;
        }
        const S = window.BitCustomization;
        if (S) {
            const skin = S.selected(), r = S.rarity[skin.rarity];
            const hero = document.querySelector(".lobby-hero img"), face = document.querySelector(".lobby-avatar img");
            const full = S.image(skin), bust = S.image(skin, true);
            if (hero && hero.dataset.skin !== skin.id) (hero.src = full), (hero.dataset.skin = skin.id);
            if (face && face.dataset.skin !== skin.id) (face.src = bust), (face.dataset.skin = skin.id);
            const name = document.querySelector(".lobby-hero-name");
            if (name) name.innerHTML = `${skin.name} <span class="badge-rarity" style="background: ${r.color}">${r.name}</span>`;
        }
    }

    function radios() {
        return [...document.querySelectorAll('input[name="mode"]')];
    }

    function showMode() {
        const r = radios().find(x => x.checked) || radios()[0];
        if (!r) return;
        const m = MODES[r.value] || {name: r.value, desc: ""};
        const D = window.BitFlightMode;
        const locked = r.value === "flightmode" && D && D.access && !D.access().ok;
        document.querySelector(".mode-title").innerHTML = (locked ? "🔒 " : "") + m.name + (m.beta ? ' <span class="beta-tag">Beta</span>' : "");
        document.querySelector(".mode-name").textContent = m.name;
        document.querySelector(".mode-desc").textContent = locked ? "Unlocks at level 10, or with a special plane" : m.desc;
        const play = document.querySelector(".play-btn");
        if (play) play.textContent = locked ? "🔒 Locked" : "Play";
    }

    function nextMode() {
        const list = radios(), i = list.findIndex(x => x.checked);
        list[(i + 1) % list.length].checked = true;
        showMode();
    }

    function renderControls() {
        const S = window.BitSettings, table = document.querySelector(".controls-list");
        if (!S || !table) return;
        const keys = (set, id) => S.keys(set)[id].filter(Boolean).map(k => `<kbd>${S.keyName(k)}</kbd>`).join(" ") || "–";
        const rows = (set, list) => list.map(a => `<tr><td>${keys(set, a.id)}</td><td>${a.name}</td></tr>`).join("");
        table.innerHTML = `<tr><th colspan="2">BitPlanes</th></tr>${rows("keys2d", S.actions2d)}
            <tr><td><kbd>M</kbd></td><td>Sound on / off</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Menu: resume, change plane or paint, settings, leave</td></tr>
            <tr><th colspan="2">3D Flight Mode</th></tr>${rows("keysDf", S.actionsDf)}
            <tr><td>Mouse</td><td>${S.get("dfMouse") ? "Pitch and roll (click the screen first)" : "Mouse flying is off (Settings)"}</td></tr>`;
    }

    function popup(sel, show) {
        const el = document.querySelector(sel);
        if (el) el.hidden = !show;
    }

    function init() {
        const shop = window.BitMarket;
        if (shop) shop.onChange(update);
        if (window.BitCustomization) window.BitCustomization.onChange(update);
        update();
        showMode();
        setInterval(showMode, 500);

        document.querySelector(".mode-switch").addEventListener("click", nextMode);
        document.querySelector(".open-controls").addEventListener("click", () => {
            renderControls();
            popup(".controls-pop", true);
        });
        if (window.BitSettings) window.BitSettings.onChange(renderControls);
        document.querySelector(".open-friends").addEventListener("click", () => popup(".friends", true));
        document.querySelectorAll(".controls-pop, .friends").forEach(el => el.addEventListener("click", ev => {
            if (ev.target === el || ev.target.closest(".close-panel")) el.hidden = true;
        }));
        document.querySelectorAll(".host-activity, .join-activity").forEach(b => b.addEventListener("click", () => popup(".friends", false)));
        document.addEventListener("keydown", ev => {
            if (ev.key === "Escape") ["controls-pop", "friends"].forEach(c => popup("." + c, false));
        });

        const nick = document.querySelector('input[name="nickname"]');
        nick.addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                nick.blur();
            }
        });
        nick.addEventListener("blur", () => {
            try {
                localStorage.setItem("nickname", nick.value.trim());
            } catch (e) {}
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    window.BitMenu = {short, update};
})();
