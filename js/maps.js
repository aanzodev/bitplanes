// Maps: each game picks one at random (never the same one twice in a row).
// Online, the host picks and everyone who joins gets the host's map.
//
// A map sets the sky colors, the ground tile, two background layers and the
// small objects standing on the ground. Art lives in assets/sprites/maps/<id>/.
window.BitMaps = (function () {
    const BASE = "assets/sprites/maps/";
    const LIST = [
        {id: "countryside", name: "Countryside"},
        {id: "desert", name: "Desert", sky: "#f5d9a3", space: "#3c6ea8", cloudAlpha: 0.5,
            objects: [["cactus", 30, 44], ["rock", 40, 22]]},
        {id: "arctic", name: "Arctic", sky: "#d8eef9", space: "#4a6f90", cloudAlpha: 0.9,
            objects: [["snowy-pine", 28, 40], ["snowman", 24, 36]]},
        {id: "sunset", name: "Sunset", sky: "#ffb07a", space: "#5a2a6e", cloudAlpha: 0.55,
            objects: [["palm", 40, 48], ["bush", 36, 25]]},
        {id: "night", name: "Night", sky: "#1a2748", space: "#060a18", cloudAlpha: 0.2,
            objects: [["bush", 36, 25], ["lamp", 16, 44]]},
    ];
    const cache = {};

    // The theme object the engine reads (world.map).
    function get(id) {
        const def = LIST.find(m => m.id === id) || LIST[0];
        if (cache[def.id]) return cache[def.id];
        const theme = {id: def.id, name: def.name};
        if (def.id !== "countryside") {
            const Sprite = window.BitEngine.Sprite, dir = BASE + def.id + "/";
            Object.assign(theme, {
                sky: def.sky,
                space: def.space,
                cloudAlpha: def.cloudAlpha,
                ground: new Sprite(dir + "ground.svg", 192, 32),
                forest: new Sprite(dir + "forest.svg", 1367, 392, 1, 1),
                forestBack: new Sprite(dir + "forest-back.svg", 1367, 392, 1, 1),
                groundObjects: def.objects.map(([name, w, h]) => new Sprite(dir + name + ".svg", w, h)),
            });
        }
        return (cache[def.id] = theme);
    }

    // A random map, different from the last one you played.
    function pick() {
        let last = null;
        try {
            last = sessionStorage.getItem("lastMap");
        } catch (e) {}
        const choices = LIST.filter(m => m.id !== last);
        const map = choices[Math.floor(Math.random() * choices.length)];
        try {
            sessionStorage.setItem("lastMap", map.id);
        } catch (e) {}
        return get(map.id);
    }

    // "Map: Desert" in the kill log when a match starts.
    function announce(map) {
        const log = document.querySelector(".log");
        if (!log || !map) return;
        const div = document.createElement("div");
        div.innerHTML = `<span class="message">🗺️ Map: ${map.name}</span>`;
        log.appendChild(div);
        setTimeout(() => div.classList.add("hide"), 6000);
        setTimeout(() => div.remove(), 6300);
    }

    return {list: LIST, get, pick, announce};
})();
