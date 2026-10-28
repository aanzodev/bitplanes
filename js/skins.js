// Pilot skins: the character who stands in the lobby (and in your profile
// circle). Buy them with coins in the Skins tab; one is equipped at a time.
// Each skin is drawn from a few colors and options (no image files).
window.BitSkins = (function () {
    const KEY = "skins";
    const RARITY = {
        common: {name: "Common", color: "#8f969c"},
        rare: {name: "Rare", color: "#2a7de1"},
        epic: {name: "Epic", color: "#8e44ad"},
        legendary: {name: "Legendary", color: "#e5a50a"},
    };
    // cap: "leather" (flying cap + goggles) or "jet" (helmet + visor)
    const SKINS = [
        {id: "rookie", name: "Rookie", rarity: "common", price: 0, desc: "Fresh out of flight school.",
            cap: "leather", capColor: "#7b4a2a", jacket: "#6b7a4b", pants: "#4a4f3a", scarf: "#f2f2f2", collar: "#d9cbb0", lens: "#9fdcff", skin: "#f1c27d", gloves: "#5a3b22"},
        {id: "ace", name: "Ace", rarity: "common", price: 500, desc: "Classic bomber jacket and a red scarf.",
            cap: "leather", capColor: "#5a3b22", jacket: "#8b5a2b", pants: "#3e3a35", scarf: "#e8202e", collar: "#efe4cf", lens: "#9fdcff", skin: "#e0ac69", gloves: "#3b2a1a"},
        {id: "redbaron", name: "Red Baron", rarity: "rare", price: 1500, desc: "The most famous ace of them all.",
            cap: "leather", capColor: "#222", jacket: "#b0102a", pants: "#2b2b2b", scarf: "#ffffff", collar: "#3b2a1a", lens: "#f5c400", skin: "#ffdbac", gloves: "#222", mustache: true},
        {id: "nightowl", name: "Night Owl", rarity: "rare", price: 2500, desc: "Flies best after dark.",
            cap: "jet", capColor: "#1d2433", visor: "#4fe3ff", jacket: "#1f2a44", pants: "#141a2a", scarf: "#7b2ff7", collar: "#2c3a5c", skin: "#8d5524", gloves: "#111"},
        {id: "arcticfox", name: "Arctic Fox", rarity: "rare", price: 3000, desc: "Warm fur for cold skies.",
            cap: "leather", capColor: "#f4f4f4", jacket: "#dfe9f5", pants: "#9fb3c8", scarf: "#3aa7f0", collar: "#ffffff", lens: "#bfe9ff", skin: "#ffdbac", gloves: "#9fb3c8"},
        {id: "deserthawk", name: "Desert Hawk", rarity: "rare", price: 3000, desc: "Sand-proof from cap to boots.",
            cap: "leather", capColor: "#c9a46a", jacket: "#d8c08a", pants: "#a0855b", scarf: "#8b3a2b", collar: "#efe4cf", lens: "#f5a623", skin: "#c68642", gloves: "#6b4226"},
        {id: "moo", name: "Moo Pilot", rarity: "epic", price: 4000, desc: "Avenges every cow you ever hit.",
            cap: "leather", capColor: "#222", jacket: "#f7f7f7", pants: "#3a3a3a", scarf: "#ff8fb8", collar: "#ffd1e2", lens: "#9fdcff", skin: "#f1c27d", gloves: "#222", spots: true},
        {id: "topgun", name: "Top Gun", rarity: "epic", price: 5000, desc: "Feels the need for speed.",
            cap: "jet", capColor: "#f4f4f4", stripe: "#d0202e", visor: "#f5a623", jacket: "#556b2f", pants: "#4a5d29", scarf: "#1f4fd1", collar: "#3b4a20", skin: "#e0ac69", gloves: "#222"},
        {id: "neon", name: "Neon Rider", rarity: "epic", price: 8000, desc: "Glows in the dark.",
            cap: "jet", capColor: "#111", visor: "#ff4fa3", jacket: "#141414", pants: "#111", scarf: "#18d4f0", collar: "#222", skin: "#c68642", gloves: "#18d4f0", neon: "#18d4f0"},
        {id: "stealth", name: "Stealth", rarity: "legendary", price: 12000, desc: "Radar never saw them coming.",
            cap: "jet", capColor: "#2b2f33", visor: "#1a1d20", jacket: "#3b4148", pants: "#2b2f33", scarf: "#4a5560", collar: "#2b2f33", skin: "#8d5524", gloves: "#111"},
        {id: "golden", name: "Golden Ace", rarity: "legendary", price: 25000, desc: "Only for the very best pilots.",
            cap: "leather", capColor: "#b8860b", jacket: "#d4a017", pants: "#8a6d1f", scarf: "#ffffff", collar: "#fff6d6", lens: "#ffd66b", skin: "#f1c27d", gloves: "#fff6d6", shine: true},
    ];

    let state = {owned: ["rookie"], selected: "rookie"};
    const listeners = [];
    try {
        state = Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}"));
    } catch (e) {}

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {}
        listeners.forEach(fn => fn());
    }

    function selected() {
        return SKINS.find(s => s.id === state.selected) || SKINS[0];
    }

    // ------------------------------------------------------------- drawing

    // The character, standing with hands on hips. bust: just head and shoulders.
    function image(skin, bust) {
        const s = skin, o = 'stroke="#1b1b1b" stroke-width="2.2" stroke-linejoin="round"';
        const torso = "M36 70 Q60 62 84 70 L82 130 L38 130 Z";
        const head = s.cap === "jet"
            ? `<path d="M40 48 Q38 18 60 18 Q82 18 80 48 L80 54 L40 54 Z" fill="${s.capColor}" ${o}/>
               ${s.stripe ? `<path d="M56 18.5 Q60 18 64 18.5 L64 34 L56 34 Z" fill="${s.stripe}"/>` : ""}
               <path d="M43 38 Q60 31 77 38 L77 50 Q60 57 43 50 Z" fill="${s.visor}" ${o}/>
               <path d="M48 39 Q55 36 61 37" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
            : `<path d="M42 46 Q41 22 60 22 Q79 22 78 46 L78 56 Q75 60 72 55 L72 41 Q60 35 48 41 L48 55 Q45 60 42 56 Z" fill="${s.capColor}" ${o}/>
               <path d="M44 33 L76 33" stroke="#3b2a1a" stroke-width="3"/>
               <circle cx="52" cy="33" r="6.5" fill="#6b6b6b" ${o}/><circle cx="52" cy="33" r="4" fill="${s.lens}"/>
               <circle cx="68" cy="33" r="6.5" fill="#6b6b6b" ${o}/><circle cx="68" cy="33" r="4" fill="${s.lens}"/>
               <circle cx="50.5" cy="31.5" r="1.3" fill="#fff"/><circle cx="66.5" cy="31.5" r="1.3" fill="#fff"/>`;
        const face = s.cap === "jet"
            ? `<path d="M54 58 Q60 61 66 58" stroke="#3b2a1a" stroke-width="1.8" fill="none" stroke-linecap="round"/>`
            : `<ellipse cx="53" cy="47" rx="2.2" ry="2.8" fill="#222"/><ellipse cx="67" cy="47" rx="2.2" ry="2.8" fill="#222"/>
               <path d="M54 55 Q60 59 66 55" stroke="#3b2a1a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
               ${s.mustache ? `<path d="M51 53 Q55 50 60 52 Q65 50 69 53 Q64 55 60 54 Q56 55 51 53 Z" fill="#5a3b22"/>` : ""}`;
        const spots = s.spots ? `<g clip-path="url(#torso)"><ellipse cx="46" cy="84" rx="7" ry="5" fill="#222"/><ellipse cx="72" cy="98" rx="8" ry="6" fill="#222"/>
            <ellipse cx="52" cy="116" rx="6" ry="4" fill="#222"/><ellipse cx="78" cy="78" rx="4" ry="3" fill="#222"/></g>` : "";
        const neon = s.neon ? `<g clip-path="url(#torso)" stroke="${s.neon}" stroke-width="3" fill="none"><path d="M38 96 L82 88"/><path d="M38 112 L82 104"/></g>
            <path d="M44 132 L41 196 M76 132 L79 196" stroke="${s.neon}" stroke-width="2.5"/>` : "";
        const shine = s.shine ? `<path d="M44 76 Q50 72 54 74 L48 124 Q44 124 42 120 Z" fill="#fff" opacity=".35"/>` : "";
        const body = `
            <rect x="36" y="194" width="21" height="17" rx="5" fill="#2b2b2b" ${o}/>
            <rect x="63" y="194" width="21" height="17" rx="5" fill="#2b2b2b" ${o}/>
            <path d="M40 130 L59 130 L58 198 L39 198 Z" fill="${s.pants}" ${o}/>
            <path d="M61 130 L80 130 L81 198 L62 198 Z" fill="${s.pants}" ${o}/>
            <rect x="44" y="150" width="9" height="12" rx="2" fill="#000" opacity=".15"/>
            <rect x="67" y="150" width="9" height="12" rx="2" fill="#000" opacity=".15"/>
            <path d="M37 74 L22 104 L38 122" stroke="#1b1b1b" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M37 74 L22 104 L38 122" stroke="${s.jacket}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M83 74 L98 104 L82 122" stroke="#1b1b1b" stroke-width="16" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M83 74 L98 104 L82 122" stroke="${s.jacket}" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="${torso}" fill="${s.jacket}" ${o}/>
            ${spots}${neon}${shine}
            <path d="M60 72 L60 126" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/>
            <rect x="37" y="122" width="46" height="9" rx="2" fill="#3b2a1a" ${o}/>
            <rect x="56" y="123" width="8" height="7" rx="1" fill="#d9b44a"/>
            <circle cx="38" cy="122" r="7" fill="${s.gloves}" ${o}/>
            <circle cx="82" cy="122" r="7" fill="${s.gloves}" ${o}/>`;
        const neck = `
            <rect x="54" y="58" width="12" height="12" fill="${s.skin}"/>
            <path d="M42 68 Q60 80 78 68 L80 76 Q60 88 40 76 Z" fill="${s.collar}" ${o}/>
            <path d="M46 70 Q60 80 74 70 L75 75 Q60 85 45 75 Z" fill="${s.scarf}" ${o}/>
            <path d="M70 77 Q86 84 98 76 Q92 92 72 87 Z" fill="${s.scarf}" ${o}/>
            <ellipse cx="60" cy="44" rx="17" ry="19" fill="${s.skin}" ${o}/>`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${bust ? 60 : 120}" height="${bust ? 60 : 220}" viewBox="${bust ? "28 12 64 64" : "0 0 120 220"}">
            <defs><clipPath id="torso"><path d="${torso}"/></clipPath></defs>
            ${bust ? "" : body}${neck}${face}${head}</svg>`;
        return "data:image/svg+xml;base64," + btoa(svg);
    }

    // --------------------------------------------------------------- shop

    function buy(id) {
        const s = SKINS.find(x => x.id === id);
        if (!s || state.owned.includes(id) || !window.BitShop || !window.BitShop.spend(s.price)) return false;
        state.owned.push(id);
        state.selected = id;
        save();
        return true;
    }

    function equip(id) {
        if (!state.owned.includes(id)) return false;
        state.selected = id;
        save();
        return true;
    }

    let el;

    function render() {
        if (!el || el.hidden) return;
        const coins = window.BitShop ? window.BitShop.state().coins : 0;
        el.querySelector(".skin-grid").innerHTML = SKINS.map(s => {
            const r = RARITY[s.rarity], owned = state.owned.includes(s.id), on = state.selected === s.id;
            const action = on ? `<button type="button" class="shop-btn equipped" disabled>Equipped</button>`
                : owned ? `<button type="button" class="shop-btn" data-equip="${s.id}">Equip</button>`
                : `<button type="button" class="shop-btn buy" data-buy="${s.id}" ${coins < s.price ? "disabled" : ""}>${s.price.toLocaleString()} <i class="coin"></i></button>`;
            return `<div class="skin-card${on ? " selected" : ""}" style="--rarity: ${r.color}">
                <div class="skin-art"><img src="${image(s)}" alt="${s.name}"></div>
                <strong>${s.name}</strong>
                <span class="skin-rarity">${r.name}</span>
                <small>${s.desc}</small>
                ${action}
            </div>`;
        }).join("");
        el.querySelectorAll(".coin-count").forEach(c => (c.textContent = coins.toLocaleString()));
    }

    function open() {
        el.hidden = false;
        render();
    }

    function init() {
        el = document.createElement("div");
        el.className = "skins panel-backdrop";
        el.hidden = true;
        el.innerHTML = `<div class="panel skins-panel" role="dialog" aria-label="Skins">
            <div class="shop-header"><h2>Skins</h2>
                <span class="wallet"><i class="coin"></i> <span class="coin-count">0</span></span>
                <button type="button" class="close-shop skins-close" aria-label="Close">×</button></div>
            <p class="shop-note">Your pilot in the lobby. Rarer skins cost more coins.</p>
            <div class="skin-grid"></div>
        </div>`;
        document.body.appendChild(el);
        el.addEventListener("click", ev => {
            const t = ev.target;
            if (t === el || t.closest(".skins-close")) return (el.hidden = true);
            const b = t.closest("button");
            if (b && b.dataset.buy) buy(b.dataset.buy);
            if (b && b.dataset.equip) equip(b.dataset.equip);
        });
        document.addEventListener("keydown", ev => ev.key === "Escape" && (el.hidden = true));
        document.querySelectorAll(".open-skins").forEach(b => b.addEventListener("click", open));
        listeners.push(render);
        if (window.BitShop) window.BitShop.onChange(render);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    return {
        list: SKINS, rarity: RARITY, image, buy, equip, selected, open,
        state: () => state,
        onChange: fn => listeners.push(fn),
        unlockAll: () => {
            state.owned = SKINS.map(s => s.id);
            save();
        },
    };
})();
