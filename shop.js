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
        {id: "f16", name: "F-16 Falcon", price: 2500, color: "#9aa7b4", skin: "jet", desc: "Light jet fighter with a fast gun.",
            thrust: 1.3, turn: 1.25, life: 1, ammo: 5, missiles: 0, reload: 0.85, bulletSpeed: 1.25},
        {id: "a10", name: "A-10 Warthog", price: 5000, color: "#6b7a4b", skin: "jet", desc: "Flying tank with a huge cannon belt.",
            thrust: 1.05, turn: 0.95, life: 4, ammo: 20, missiles: 1, reload: 0.7, bulletSpeed: 1.2},
        {id: "f22", name: "F-22 Raptor", price: 10000, color: "#4a5560", skin: "jet", desc: "Stealth fighter. 3 missiles and faster bullets built in.",
            thrust: 1.4, turn: 1.35, life: 2, ammo: 5, missiles: 1, reload: 0.8, bulletSpeed: 1.6},
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

    // Final stats of the selected plane plus upgrades. Sent to the host in online games.
    function loadout() {
        const p = selectedPlane();
        return {
            color: p.color,
            skin: p.skin || "",
            thrust: p.thrust * (1 + 0.08 * level("engine")),
            turn: p.turn * (1 + 0.08 * level("handling")),
            reload: p.reload * (1 - 0.1 * level("reload")),
            bulletSpeed: p.bulletSpeed || 1,
            life: p.life + level("armor"),
            ammo: p.ammo + 3 * level("ammo"),
            missiles: p.missiles + level("missiles"),
        };
    }

    // Called by the physics loop for every plane; applies the loadout once per pilot.
    // Local humans use this browser's shop; remote players bring their own loadout.
    function apply(plane) {
        const player = plane.player;
        if (!player || plane.shopPlayer === player) return;
        const l = player.loadout || (player.isHuman && loadout());
        if (!l) return;
        plane.shopPlayer = player;
        plane.maxThrust = Math.round(BASE_THRUST * l.thrust);
        plane.turnRate = l.turn;
        plane.reloadRate = l.reload;
        plane.bulletSpeed = l.bulletSpeed;
        plane.life = Math.max(1, plane.life + l.life);
        plane.maxAmmo = Math.max(1, plane.maxAmmo + l.ammo);
        plane.ammo = Math.max(0, Math.min(plane.maxAmmo, plane.ammo + l.ammo));
        plane.maxMissiles += l.missiles;
        plane.missiles += l.missiles;
        if (plane.thrust > plane.maxThrust) plane.thrust = plane.maxThrust;
        if (plane.setSkin) {
            // In team modes the plane keeps its team colors.
            const color = player.team ? plane.color : (player.loadoutColor || l.color);
            if (color !== plane.color || l.skin !== (plane.skin || "")) plane.setSkin(color, l.skin);
            player.color = color;
        }
    }

    function onKill(player) {
        if (player.isHuman) reward();
        else if (player.remote && window.BitNet) window.BitNet.rewardRemote(player);
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

    function planeImage(p) {
        return window.bitPlaneImage ? window.bitPlaneImage(p.color, true, p.skin) : "";
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
                        <img src="${planeImage(p)}" alt="${p.name}">
                        <strong>${p.name}</strong>
                        <small>${p.desc}</small>
                        <div class="stats-list">
                            <span>Speed</span>${statBar(p.thrust / 1.4)}
                            <span>Turn</span>${statBar(p.turn / 1.4)}
                            <span>Armor</span>${statBar((3 + p.life) / 7)}
                            <span>Ammo</span>${statBar((15 + p.ammo) / 35)}
                            <span>Missiles</span>${statBar((2 + p.missiles) / 4)}
                            <span>Bullets</span>${statBar((p.bulletSpeed || 1) / 1.6)}
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

    function addCoins(amount = 1000) {
        state.coins = Math.max(0, state.coins + Math.floor(Number(amount) || 0));
        save();
        return state.coins;
    }

    function setCoins(amount) {
        state.coins = Math.max(0, Math.floor(Number(amount) || 0));
        save();
        return state.coins;
    }

    function resetShop() {
        state = {coins: 0, owned: ["classic"], selected: "classic", upgrades: {}};
        save();
        return "Shop reset";
    }

    function unlockAll() {
        state.owned = PLANES.map(p => p.id);
        UPGRADES.forEach(u => state.upgrades[u.id] = u.max);
        save();
        return "Everything unlocked";
    }

    // Test commands, usable from the browser console.
    window.addCoins = addCoins;
    window.setCoins = setCoins;
    window.resetShop = resetShop;
    window.unlockAll = unlockAll;
    console.info("Shop test commands: addCoins(1000), setCoins(10000), unlockAll(), resetShop(). " +
        "Or open the page with ?coins=10000");

    // ?coins=N adds N coins, e.g. index.html?coins=10000
    const params = new URLSearchParams(location.search);
    if (params.has("coins")) {
        addCoins(params.get("coins"));
        // Drop the param so a refresh doesn't add the coins again.
        params.delete("coins");
        const query = params.toString();
        history.replaceState(null, "", location.pathname + (query ? "?" + query : "") + location.hash);
    }

    window.BitShop = {apply, reward, onKill, loadout, addCoins, setCoins, planes: PLANES, selected: selectedPlane};

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
