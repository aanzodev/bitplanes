// Hangar shop: earn coins for kills, buy planes and upgrades.
(function () {
    const STORAGE_KEY = "shop";
    const COINS_PER_KILL = 10;
    const BASE_THRUST = 17;

    const PLANES = [
        {id: "classic", name: "Classic", price: 0, color: "#ff0015", desc: "Balanced starter plane.",
            thrust: 1, turn: 1, life: 0, ammo: 0, missiles: 0, reload: 1},
        {id: "swift", name: "Swift", price: 150, color: "#f5b700", desc: "Fast and agile, but fragile.",
            thrust: 1.2, turn: 1.25, life: 0, ammo: -3, missiles: 0, reload: 1},
        {id: "gunship", name: "Gunship", price: 300, color: "#2e9e44", desc: "Big ammo belt and quick reload.",
            thrust: 1, turn: 0.95, life: 1, ammo: 10, missiles: 0, reload: 0.75},
        {id: "fortress", name: "Fortress", price: 500, color: "#5b6b8c", desc: "Heavy armor and extra missiles. Slow.",
            thrust: 0.9, turn: 0.85, life: 3, ammo: 5, missiles: 2, reload: 1},
        {id: "phantom", name: "Phantom", price: 1000, color: "#7b2ff7", desc: "Elite fighter, better at everything.",
            thrust: 1.2, turn: 1.2, life: 2, ammo: 5, missiles: 1, reload: 0.8},
    ];

    const UPGRADES = [
        {id: "engine", name: "Engine", desc: "+8% top speed", max: 5, base: 40},
        {id: "handling", name: "Handling", desc: "+8% turn rate", max: 5, base: 40},
        {id: "armor", name: "Armor", desc: "+1 hit point", max: 3, base: 60},
        {id: "ammo", name: "Ammo belt", desc: "+3 rounds", max: 5, base: 30},
        {id: "reload", name: "Reload", desc: "-10% reload time", max: 5, base: 40},
        {id: "missiles", name: "Missile rack", desc: "+1 missile", max: 3, base: 80},
    ];

    let state = {coins: 0, owned: ["classic"], selected: "classic", upgrades: {}};
    try {
        state = Object.assign(state, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (e) {}

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {}
        render();
    }

    function level(id) {
        return state.upgrades[id] || 0;
    }

    function upgradeCost(u) {
        return u.base * (level(u.id) + 1);
    }

    function selectedPlane() {
        return PLANES.find(p => p.id === state.selected) || PLANES[0];
    }

    // Called by the physics loop for every plane; applies the loadout once per pilot.
    function apply(plane) {
        const player = plane.player;
        if (!player || !player.isHuman || plane.shopPlayer === player) return;
        plane.shopPlayer = player;
        const p = selectedPlane();
        plane.maxThrust = Math.round(BASE_THRUST * p.thrust * (1 + 0.08 * level("engine")));
        plane.turnRate = p.turn * (1 + 0.08 * level("handling"));
        plane.reloadRate = p.reload * (1 - 0.1 * level("reload"));
        plane.life = Math.max(1, plane.life + p.life + level("armor"));
        const ammo = p.ammo + 3 * level("ammo");
        plane.maxAmmo = Math.max(1, plane.maxAmmo + ammo);
        plane.ammo = Math.max(0, Math.min(plane.maxAmmo, plane.ammo + ammo));
        const missiles = p.missiles + level("missiles");
        plane.maxMissiles += missiles;
        plane.missiles += missiles;
        if (plane.thrust > plane.maxThrust) plane.thrust = plane.maxThrust;
        // In team modes the plane keeps its team colors.
        if (!player.team && plane.setColor) {
            plane.setColor(p.color);
            player.color = p.color;
        }
    }

    function reward() {
        state.coins += COINS_PER_KILL;
        save();
        const log = document.querySelector(".log");
        if (log) {
            const div = document.createElement("div");
            div.innerHTML = `<span class="message coin-message">+${COINS_PER_KILL} <i class="coin"></i></span>`;
            log.appendChild(div);
            setTimeout(() => div.classList.add("hide"), 3000);
            setTimeout(() => div.remove(), 3300);
        }
    }

    function buyPlane(id) {
        const p = PLANES.find(p => p.id === id);
        if (!p || state.owned.includes(id) || state.coins < p.price) return;
        state.coins -= p.price;
        state.owned.push(id);
        state.selected = id;
        save();
    }

    function selectPlane(id) {
        if (!state.owned.includes(id)) return;
        state.selected = id;
        save();
    }

    function buyUpgrade(id) {
        const u = UPGRADES.find(u => u.id === id);
        if (!u || level(id) >= u.max) return;
        const cost = upgradeCost(u);
        if (state.coins < cost) return;
        state.coins -= cost;
        state.upgrades[id] = level(id) + 1;
        save();
    }

    function planeImage(color) {
        return window.bitPlaneImage ? window.bitPlaneImage(color) : "";
    }

    function statBar(value) {
        const pct = Math.max(5, Math.min(100, value * 100));
        return `<span class="stat-bar"><span style="width: ${pct}%"></span></span>`;
    }

    function render() {
        document.querySelectorAll(".coin-count").forEach(el => el.textContent = state.coins.toLocaleString());

        const planes = document.querySelector(".shop-planes");
        if (planes) {
            planes.innerHTML = PLANES.map(p => {
                const owned = state.owned.includes(p.id);
                const selected = state.selected === p.id;
                let action;
                if (selected) action = `<button type="button" class="shop-btn equipped" disabled>Equipped</button>`;
                else if (owned) action = `<button type="button" class="shop-btn" data-select="${p.id}">Select</button>`;
                else action = `<button type="button" class="shop-btn buy" data-buy-plane="${p.id}" ${state.coins < p.price ? "disabled" : ""}>${p.price} <i class="coin"></i></button>`;
                return `
                    <div class="shop-plane${selected ? " selected" : ""}">
                        <img src="${planeImage(p.color)}" alt="${p.name}">
                        <strong>${p.name}</strong>
                        <small>${p.desc}</small>
                        <div class="stats-list">
                            <span>Speed</span>${statBar(p.thrust / 1.25)}
                            <span>Turn</span>${statBar(p.turn / 1.25)}
                            <span>Armor</span>${statBar((3 + p.life) / 6)}
                            <span>Ammo</span>${statBar((15 + p.ammo) / 25)}
                        </div>
                        ${action}
                    </div>`;
            }).join("");
        }

        const upgrades = document.querySelector(".shop-upgrades");
        if (upgrades) {
            upgrades.innerHTML = UPGRADES.map(u => {
                const lvl = level(u.id);
                const maxed = lvl >= u.max;
                const cost = upgradeCost(u);
                const pips = Array.from({length: u.max}, (_, i) => `<i class="pip${i < lvl ? " on" : ""}"></i>`).join("");
                const action = maxed
                    ? `<button type="button" class="shop-btn equipped" disabled>Max</button>`
                    : `<button type="button" class="shop-btn buy" data-buy-upgrade="${u.id}" ${state.coins < cost ? "disabled" : ""}>${cost} <i class="coin"></i></button>`;
                return `
                    <div class="shop-upgrade">
                        <div><strong>${u.name}</strong> <small>${u.desc}</small></div>
                        <div class="pips">${pips}</div>
                        ${action}
                    </div>`;
            }).join("");
        }
    }

    function init() {
        const shop = document.querySelector(".shop");
        const open = document.querySelector(".open-shop");
        const close = document.querySelector(".close-shop");
        if (open && shop) open.addEventListener("click", () => {
            render();
            shop.hidden = false;
        });
        if (close && shop) close.addEventListener("click", () => shop.hidden = true);
        if (shop) shop.addEventListener("click", e => {
            if (e.target === shop) return shop.hidden = true;
            const btn = e.target.closest("button");
            if (!btn) return;
            if (btn.dataset.select) selectPlane(btn.dataset.select);
            if (btn.dataset.buyPlane) buyPlane(btn.dataset.buyPlane);
            if (btn.dataset.buyUpgrade) buyUpgrade(btn.dataset.buyUpgrade);
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && shop) shop.hidden = true;
        });
        render();
    }

    window.BitShop = {apply, reward};

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
