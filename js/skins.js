window.BitSkins = (function () {
    const KEY = "skins";
    const RARITY = {
        common: {name: "Common", color: "#8f969c"},
        rare: {name: "Rare", color: "#2a7de1"},
        epic: {name: "Epic", color: "#8e44ad"},
        legendary: {name: "Legendary", color: "#e5a50a"},
    };
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
        {id: "cadet", name: "Cadet", rarity: "common", price: 300, desc: "First day at the academy.",
            cap: "leather", capColor: "#2c3e63", jacket: "#34508a", pants: "#25324d", scarf: "#3ec46d", collar: "#dfe6f2", lens: "#9fdcff", skin: "#ffdbac", gloves: "#1d2433"},
        {id: "mechanic", name: "Mechanic", rarity: "common", price: 800, desc: "Fixes the plane, then flies it.",
            cap: "leather", capColor: "#3b3b3b", jacket: "#e8732c", pants: "#c25e22", scarf: "#4a4a4a", collar: "#f3b48a", lens: "#c8f0ff", skin: "#c68642", gloves: "#2b2b2b", chevrons: "#2b2b2b"},
        {id: "jungle", name: "Jungle Ranger", rarity: "rare", price: 2000, desc: "Hard to spot from above.",
            cap: "leather", capColor: "#4b5a2a", jacket: "#5f7a37", pants: "#4b5a2a", scarf: "#2f3a1a", collar: "#8a9a5b", lens: "#c8f08f", skin: "#8d5524", gloves: "#3b2a1a", camo: ["#3e4d22", "#8a7a45", "#2b3318"]},
        {id: "skyracer", name: "Sky Racer", rarity: "rare", price: 3500, desc: "Built for air races.",
            cap: "jet", capColor: "#ffffff", stripe: "#e8202e", visor: "#2b2f33", jacket: "#f4f4f4", pants: "#2b2f33", scarf: "#e8202e", collar: "#e8202e", skin: "#f1c27d", gloves: "#e8202e", chevrons: "#e8202e"},
        {id: "seawolf", name: "Sea Wolf", rarity: "rare", price: 3500, desc: "Thirty years of carrier landings.",
            cap: "leather", capColor: "#f4f4f4", jacket: "#1f2f4a", pants: "#16223a", scarf: "#f4f4f4", collar: "#d7c28a", lens: "#9fdcff", skin: "#e0ac69", gloves: "#111", beard: "#8a8a8a"},
        {id: "firebird", name: "Firebird", rarity: "epic", price: 6000, desc: "Leaves a trail of fire.",
            cap: "jet", capColor: "#1a1a1a", stripe: "#ff6a00", visor: "#ffb000", jacket: "#1e1e1e", pants: "#141414", scarf: "#ff6a00", collar: "#333", skin: "#e0ac69", gloves: "#ff6a00", flames: true},
        {id: "starfighter", name: "Starfighter", rarity: "epic", price: 7000, desc: "From a galaxy far above.",
            cap: "jet", capColor: "#1b2a6b", visor: "#ffd23f", jacket: "#1f3a93", pants: "#14245e", scarf: "#ffd23f", collar: "#2f4fb0", skin: "#ffdbac", gloves: "#ffd23f", stars: "#ffd23f"},
        {id: "admiral", name: "Admiral", rarity: "epic", price: 9000, desc: "Commands the whole fleet.",
            cap: "leather", capColor: "#111a2e", jacket: "#16213e", pants: "#0f1730", scarf: "#ffffff", collar: "#d4a017", lens: "#ffd66b", skin: "#c68642", gloves: "#ffffff", medals: true, beard: "#2b2b2b"},
        {id: "ghost", name: "Phantom Ghost", rarity: "legendary", price: 15000, desc: "Some say it was never there.",
            cap: "jet", capColor: "#e8f1ff", visor: "#7fe3ff", jacket: "#dce8f7", pants: "#b8c8de", scarf: "#a9f0ff", collar: "#f4f8ff", skin: "#f4f8ff", gloves: "#e8f1ff", shine: true, stars: "#a9f0ff"},
        {id: "diamond", name: "Diamond Ace", rarity: "legendary", price: 40000, desc: "The rarest pilot in the sky.",
            cap: "leather", capColor: "#5fd8ff", jacket: "#9fe8ff", pants: "#3fa9d6", scarf: "#ffffff", collar: "#e6faff", lens: "#ffffff", skin: "#ffdbac", gloves: "#e6faff", shine: true, stars: "#ffffff", medals: true},
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
               ${s.mustache ? `<path d="M51 53 Q55 50 60 52 Q65 50 69 53 Q64 55 60 54 Q56 55 51 53 Z" fill="#5a3b22"/>` : ""}
               ${s.beard ? `<path d="M44 50 Q46 66 60 66 Q74 66 76 50 Q72 58 66 56 Q60 60 54 56 Q48 58 44 50 Z" fill="${s.beard}"/>` : ""}`;
        const spots = s.spots ? `<g clip-path="url(#torso)"><ellipse cx="46" cy="84" rx="7" ry="5" fill="#222"/><ellipse cx="72" cy="98" rx="8" ry="6" fill="#222"/>
            <ellipse cx="52" cy="116" rx="6" ry="4" fill="#222"/><ellipse cx="78" cy="78" rx="4" ry="3" fill="#222"/></g>` : "";
        const neon = s.neon ? `<g clip-path="url(#torso)" stroke="${s.neon}" stroke-width="3" fill="none"><path d="M38 96 L82 88"/><path d="M38 112 L82 104"/></g>
            <path d="M44 132 L41 196 M76 132 L79 196" stroke="${s.neon}" stroke-width="2.5"/>` : "";
        const shine = s.shine ? `<path d="M44 76 Q50 72 54 74 L48 124 Q44 124 42 120 Z" fill="#fff" opacity=".35"/>` : "";
        const camo = s.camo ? `<g clip-path="url(#torso)">
            <path d="M36 80 Q46 72 54 80 Q50 90 40 88 Z" fill="${s.camo[0]}"/><path d="M62 74 Q76 70 84 80 Q74 86 64 82 Z" fill="${s.camo[1]}"/>
            <path d="M40 100 Q52 94 60 102 Q52 110 42 108 Z" fill="${s.camo[2]}"/><path d="M64 96 Q78 92 84 104 Q72 112 64 106 Z" fill="${s.camo[0]}"/>
            <path d="M48 116 Q58 112 66 120 Q56 126 46 124 Z" fill="${s.camo[1]}"/></g>` : "";
        const chevrons = s.chevrons ? `<g clip-path="url(#torso)" stroke="${s.chevrons}" stroke-width="4" fill="none">
            <path d="M38 92 L50 100 L38 108"/><path d="M82 92 L70 100 L82 108"/></g>` : "";
        const flames = s.flames ? `<g clip-path="url(#torso)">
            <path d="M36 130 Q38 108 44 112 Q44 96 52 104 Q54 88 60 100 Q64 86 68 102 Q74 92 76 110 Q82 104 84 130 Z" fill="#ff6a00"/>
            <path d="M42 130 Q44 116 50 118 Q52 106 58 114 Q62 104 66 116 Q72 110 74 130 Z" fill="#ffc400"/></g>` : "";
        const star = (x, y, r) => {
            let d = "";
            for (let i = 0; i < 10; i++) {
                const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * 0.45 : r;
                d += (i ? "L" : "M") + (x + q * Math.cos(a)).toFixed(1) + " " + (y + q * Math.sin(a)).toFixed(1);
            }
            return `<path d="${d}Z" fill="${s.stars}"/>`;
        };
        const stars = s.stars ? `<g clip-path="url(#torso)" opacity=".9">${star(46, 84, 4)}${star(74, 92, 5)}${star(52, 108, 3)}${star(70, 116, 3.5)}${star(80, 78, 2.5)}</g>` : "";
        const medals = s.medals ? `<g ${o}><path d="M66 82 L70 82 L69 90 L67 90 Z" fill="#e8202e"/><circle cx="68" cy="92" r="3.6" fill="#ffd23f"/>
            <path d="M73 82 L77 82 L76 90 L74 90 Z" fill="#1f4fd1"/><circle cx="75" cy="92" r="3.6" fill="#d9d9d9"/></g>` : "";
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
            ${spots}${camo}${chevrons}${flames}${stars}${neon}${shine}${medals}
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

    function pilotImage(skin) {
        const s = skin || selected(), o = 'stroke="#111" stroke-width="0.8"';
        const head = s.cap === "jet"
            ? `<path d="M4.6 5.6 Q4.4 1.2 8 1.2 Q11.6 1.2 11.4 5.6 Z" fill="${s.capColor}" ${o}/><rect x="5.2" y="3.6" width="5.6" height="1.9" rx=".9" fill="${s.visor}"/>`
            : `<path d="M4.8 5.4 Q4.6 1.6 8 1.6 Q11.4 1.6 11.2 5.4 Z" fill="${s.capColor}" ${o}/><circle cx="6.5" cy="4" r="1" fill="${s.lens}"/><circle cx="9.5" cy="4" r="1" fill="${s.lens}"/>`;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="44" viewBox="0 0 16 22">
            <path d="M5.6 15 L5.2 21 M10.4 15 L10.8 21" stroke="${s.pants}" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M5 8.4 L3 13 M11 8.4 L13 13" stroke="${s.jacket}" stroke-width="2" stroke-linecap="round"/>
            <rect x="4.6" y="7.6" width="6.8" height="7.8" rx="1.6" fill="${s.jacket}" ${o}/>
            <path d="M5.4 8 Q8 9.4 10.6 8 L10.8 9.2 Q8 10.6 5.2 9.2 Z" fill="${s.scarf}"/>
            <circle cx="3" cy="13.2" r="1.1" fill="${s.gloves}"/><circle cx="13" cy="13.2" r="1.1" fill="${s.gloves}"/>
            <ellipse cx="8" cy="5" rx="3" ry="3.1" fill="${s.skin}" ${o}/>${head}</svg>`;
        return "data:image/svg+xml;base64," + btoa(svg);
    }

    const pilotSprites = {};
    window.bitPilotSprite = function (who) {
        let id = typeof who === "string" ? who : null;
        if (who && typeof who === "object") {
            if (who.loadout) id = who.loadout.pilotSkin;
            else if (who.isHuman) id = selected().id;
        }
        const skin = id && SKINS.find(s => s.id === id);
        const E = window.BitEngine;
        if (!skin || !E || !E.Sprite) return null;
        if (!pilotSprites[id]) {
            pilotSprites[id] = new E.Sprite(pilotImage(skin), 10, 14);
            pilotSprites[id].pilotKey = id;
        }
        return pilotSprites[id];
    };


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
        el.querySelector(".skin-grid").innerHTML = SKINS.slice().sort((a, b) => a.price - b.price).map(s => {
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
        el.innerHTML = `<div class="panel skins-panel" role="dialog" aria-label="Aircraft Customization">
            <div class="shop-header"><h2>Aircraft Customization</h2>
                <span class="wallet"><i class="coin"></i> <span class="coin-count">0</span></span>
                <button type="button" class="close-shop skins-close" aria-label="Close">×</button></div>
            <p class="shop-note">Your pilot in the lobby, and the pilot who bails out when you eject (in BitPlanes and 3D Flight Mode). Rarer skins cost more credits.</p>
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
        list: SKINS, rarity: RARITY, image, pilotImage, buy, equip, selected, open,
        get: id => SKINS.find(s => s.id === id) || null,
        ownedCount: () => state.owned.length,
        state: () => state,
        onChange: fn => listeners.push(fn),
        unlockAll: () => {
            state.owned = SKINS.map(s => s.id);
            save();
        },
    };
})();
