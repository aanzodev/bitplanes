window.BitMaps = (function () {
    const BASE = (window.BitBase || "") + "assets/sprites/maps/";
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

    function announce(map) {
        const log = document.querySelector(".log");
        if (!log || !map) return;
        const W = window.BitWeather;
        if (W) W.start(map);
        const div = document.createElement("div");
        const weather = W && W.current() !== "clear" ? ` · ${W.icon()} ${W.name()}` : "";
        div.innerHTML = `<span class="message">🗺️ Environment: ${map.name}${weather}</span>`;
        log.appendChild(div);
        setTimeout(() => div.classList.add("hide"), 6000);
        setTimeout(() => div.remove(), 6300);
    }

    return {list: LIST, get, pick, announce};
})();
