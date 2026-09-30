// The Hangar screen: shows planes and upgrades and handles the buy buttons.
(function () {
    const shop = window.BitShop;

    function planeImage(p) {
        return window.bitPlaneImage ? window.bitPlaneImage(p.color, true, p.skin) : "";
    }

    function statBar(value) {
        const pct = Math.max(5, Math.min(100, value * 100));
        return `<span class="stat-bar"><span style="width: ${pct}%"></span></span>`;
    }

    function planeCard(p, state) {
        const owned = state.owned.includes(p.id);
        const selected = state.selected === p.id;
        let action;
        if (selected) action = `<button type="button" class="shop-btn equipped" disabled>Equipped</button>`;
        else if (owned) action = `<button type="button" class="shop-btn" data-select="${p.id}">Select</button>`;
        else action = `<button type="button" class="shop-btn buy" data-buy-plane="${p.id}" ${state.coins < p.price ? "disabled" : ""}>${p.price.toLocaleString()} <i class="coin"></i></button>`;
        const classes = ["shop-plane", selected && "selected", p.special && "special"].filter(Boolean).join(" ");
        return `
            <div class="${classes}">
                ${p.special ? '<span class="special-badge">Special</span>' : ""}
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
                ${p.flares ? `<div class="plane-perk"><i class="flare"></i> ${p.flares} flares <kbd>Q</kbd></div>` : ""}
                ${action}
            </div>`;
    }

    function upgradeRow(u, state) {
        const lvl = shop.level(u.id);
        const maxed = lvl >= u.max;
        const cost = shop.upgradeCost(u);
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
    }

    function render() {
        const state = shop.state();
        document.querySelectorAll(".coin-count").forEach(el => el.textContent = state.coins.toLocaleString());
        const planes = document.querySelector(".shop-planes");
        if (planes) planes.innerHTML = shop.planes.map(p => planeCard(p, state)).join("");
        const upgrades = document.querySelector(".shop-upgrades");
        if (upgrades) upgrades.innerHTML = shop.upgrades.map(u => upgradeRow(u, state)).join("");
    }

    function init() {
        const panel = document.querySelector(".shop");
        const open = document.querySelector(".open-shop");
        const close = document.querySelector(".close-shop");
        if (open && panel) open.addEventListener("click", () => {
            render();
            panel.hidden = false;
        });
        if (close && panel) close.addEventListener("click", () => panel.hidden = true);
        if (panel) panel.addEventListener("click", e => {
            if (e.target === panel) return panel.hidden = true;
            const btn = e.target.closest("button");
            if (!btn) return;
            if (btn.dataset.select) shop.selectPlane(btn.dataset.select);
            if (btn.dataset.buyPlane) shop.buyPlane(btn.dataset.buyPlane);
            if (btn.dataset.buyUpgrade) shop.buyUpgrade(btn.dataset.buyUpgrade);
        });
        document.addEventListener("keydown", e => {
            if (e.key === "Escape" && panel) panel.hidden = true;
        });
        render();
    }

    shop.onChange(render);
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
