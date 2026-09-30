// Coins, owned planes and upgrades (saved in localStorage), and applying the
// chosen plane to the player's aircraft in game.
(function () {
    const STORAGE_KEY = "shop";
    const COINS_PER_KILL = 10;
    const BASE_THRUST = 17;
    const {planes: PLANES, upgrades: UPGRADES} = window.BitCatalog;

    let state = {coins: 0, owned: ["classic"], selected: "classic", upgrades: {}};
    try {
        state = Object.assign(state, JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"));
    } catch (e) {}

    const listeners = [];

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {}
        listeners.forEach(fn => fn());
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
            flares: p.flares || 0,
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
        plane.maxFlares = plane.flares = l.flares || 0;
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

    // ------------------------------------------------ test commands (console)

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

    window.BitShop = {
        apply, reward, onKill, loadout, addCoins, setCoins,
        buyPlane, selectPlane, buyUpgrade, level, upgradeCost,
        planes: PLANES,
        upgrades: UPGRADES,
        selected: selectedPlane,
        state: () => state,
        onChange: fn => listeners.push(fn),
    };
})();
