// The lobby (start screen): your plane on its pad, coins and profile up top,
// the mode card with PLAY, and the Controls / Servers / friends pop-ups.
(function () {
    const MODES = {
        "death-match": {name: "Death match", desc: "Everyone against everyone"},
        "multiplayer": {name: "Multiplayer", desc: "Real players online · 10 min matches"},
        "dogfights": {name: "Dogfights", desc: "BETA · 3D dogfights over real terrain", beta: true},
        "swarm": {name: "Swarm", desc: "Two big teams"},
    };

    // 950 -> "950", 1500 -> "1.5K", 100000 -> "100K", 2500000 -> "2.5M"
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
        const shop = window.BitShop;
        return window.bitPlaneImage ? window.bitPlaneImage(shop.colorOf(p), true, p.skin, shop.patternOf(p)) : "";
    }

    function update() {
        const shop = window.BitShop;
        if (!shop) return;
        const st = shop.state(), p = shop.selected();
        document.querySelectorAll(".coin-short").forEach(el => {
            el.textContent = short(st.coins);
            el.parentElement.title = st.coins.toLocaleString() + " coins";
        });
        // Your plane: the chip under the pad (opens the Hangar).
        const chip = document.querySelector(".lobby-plane-chip");
        if (chip) {
            const img = planeImage(p);
            if (chip.querySelector("img").src !== img) chip.querySelector("img").src = img;
            chip.querySelector("span").textContent = p.name;
        }
        // Your pilot: on the pad and in the profile circle.
        const S = window.BitSkins;
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

    // The mode card cycles through the (hidden) mode radios.
    function radios() {
        return [...document.querySelectorAll('input[name="mode"]')];
    }

    function showMode() {
        const r = radios().find(x => x.checked) || radios()[0];
        if (!r) return;
        const m = MODES[r.value] || {name: r.value, desc: ""};
        document.querySelector(".mode-title").innerHTML = m.name + (m.beta ? ' <span class="beta-tag">Beta</span>' : "");
        document.querySelector(".mode-name").textContent = m.name;
        document.querySelector(".mode-desc").textContent = m.desc;
    }

    function nextMode() {
        const list = radios(), i = list.findIndex(x => x.checked);
        list[(i + 1) % list.length].checked = true;
        showMode();
    }

    // The Controls pop-up lists your current keys (change them in Settings).
    function renderControls() {
        const S = window.BitSettings, table = document.querySelector(".controls-list");
        if (!S || !table) return;
        const keys = (set, id) => S.keys(set)[id].filter(Boolean).map(k => `<kbd>${S.keyName(k)}</kbd>`).join(" ") || "–";
        const rows = (set, list) => list.map(a => `<tr><td>${keys(set, a.id)}</td><td>${a.name}</td></tr>`).join("");
        table.innerHTML = `<tr><th colspan="2">Bit Planes</th></tr>${rows("keys2d", S.actions2d)}
            <tr><td><kbd>M</kbd></td><td>Sound on / off</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Menu: resume, change plane or paint, settings, leave</td></tr>
            <tr><th colspan="2">Dogfights (3D)</th></tr>${rows("keysDf", S.actionsDf)}
            <tr><td>Mouse</td><td>${S.get("dfMouse") ? "Pitch and roll (click the screen first)" : "Mouse flying is off (Settings)"}</td></tr>`;
    }

    function popup(sel, show) {
        const el = document.querySelector(sel);
        if (el) el.hidden = !show;
    }

    function init() {
        const shop = window.BitShop;
        if (shop) shop.onChange(update);
        if (window.BitSkins) window.BitSkins.onChange(update);
        update();
        showMode();
        // The Multiplayer link back after a host leaves (?multiplayer=1) checks a radio later.
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
        // Starting a private room or joining one closes the friends pop-up.
        document.querySelectorAll(".host-activity, .join-activity").forEach(b => b.addEventListener("click", () => popup(".friends", false)));
        document.addEventListener("keydown", ev => {
            if (ev.key === "Escape") ["controls-pop", "friends"].forEach(c => popup("." + c, false));
        });

        // Name: click it to edit; Enter or clicking away saves (Enter must not start a match).
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
