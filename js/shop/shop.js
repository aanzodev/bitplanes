// Coins, owned planes and upgrades (saved in localStorage), and applying the
// chosen plane to the player's aircraft in activity.
(function () {
    const STORAGE_KEY = "shop";
    const COINS_PER_KILL = 10;
    const BASE_THRUST = 17;
    const {planes: PLANES, upgrades: UPGRADES, paints: PAINTS} = window.BitCatalog;

    let state = {coins: 0, owned: ["classic"], selected: "classic", upgrades: {}, paint: {}};
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

    // A plane's color: its paint job if it has one, otherwise factory colors.
    function colorOf(p) {
        return (state.paint && state.paint[p.id]) || p.color;
    }

    // Final stats of a plane plus upgrade levels (none for computer pilots).
    function statsOf(p, color, lvl = () => 0) {
        return {
            planeId: p.id,
            color,
            skin: p.skin || "",
            thrust: p.thrust * (1 + 0.08 * lvl("engine")),
            turn: p.turn * (1 + 0.08 * lvl("handling")),
            reload: p.reload * (1 - 0.1 * lvl("reload")),
            bulletSpeed: p.bulletSpeed || 1,
            life: p.life + lvl("armor"),
            ammo: p.ammo + 3 * lvl("ammo"),
            missiles: p.missiles + lvl("missiles"),
            flares: p.flares || 0,
        };
    }

    // The selected plane with your upgrades. Sent to the host in online activities.
    function loadout() {
        const p = selectedPlane();
        return statsOf(p, colorOf(p), level);
    }

    // Computer pilots in single player fly a random plane from the whole
    // catalog, picked again every time they get a new plane.
    function botLoadout() {
        const p = PLANES[Math.floor(Math.random() * PLANES.length)];
        return statsOf(p, p.color);
    }

    // Called by the physics loop for every plane; applies the loadout once per pilot.
    // Local humans use this browser's shop; remote players bring their own loadout;
    // computer pilots in single player get a random plane.
    function apply(plane) {
        const player = plane.player;
        if (!player || plane.shopPlayer === player) return;
        const online = window.BitOnline && window.BitOnline.role;
        const l = player.loadout || (player.isHuman ? loadout() : !online && botLoadout());
        if (!l) return;
        plane.shopPlayer = player;
        plane.planeId = l.planeId;
        plane.maxThrust = Math.round(BASE_THRUST * l.thrust);
        plane.turnRate = l.turn;
        plane.reloadRate = l.reload;
        plane.bulletSpeed = l.bulletSpeed;
        plane.life = plane.maxLife = Math.max(1, plane.life + l.life);
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

    function setPaint(color) {
        const p = selectedPlane();
        if (color !== null && !PAINTS.some(x => x.color === color)) return;
        state.paint = state.paint || {};
        if (color) state.paint[p.id] = color;
        else delete state.paint[p.id];
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
        state = {coins: 0, owned: ["classic"], selected: "classic", upgrades: {}, paint: {}};
        save();
        return "Shop reset";
    }

    // Own a plane for free (console "give").
    function give(id) {
        if (!PLANES.some(p => p.id === id)) return false;
        if (!state.owned.includes(id)) state.owned.push(id);
        save();
        return true;
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
        buyPlane, selectPlane, buyUpgrade, setPaint, colorOf, level, upgradeCost, give, unlockAll, resetShop,
        planes: PLANES,
        upgrades: UPGRADES,
        paints: PAINTS,
        selected: selectedPlane,
        state: () => state,
        onChange: fn => listeners.push(fn),
    };
})();
