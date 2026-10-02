// Health bar for the plane you're flying, bottom right of the screen.
// Green, then yellow, then red as armor runs out. Online guests get their
// plane's health from the host.
(function () {
    let el, fill, text, name;

    function myPlane() {
        const O = window.BitOnline;
        if (O && O.role === "guest") return O.prediction && O.prediction.plane();
        const player = window.BitEngine && window.BitEngine.player;
        return player && player.hasPlane();
    }

    function planeName(plane) {
        const p = window.BitShop && window.BitShop.planes.find(x => x.id === plane.planeId);
        return p ? p.name : "Plane";
    }

    function update() {
        requestAnimationFrame(update);
        const ui = document.querySelector(".ui");
        const plane = ui && ui.style.display === "block" ? myPlane() : null;
        el.hidden = !plane;
        if (!plane) return;
        const max = plane.maxLife || (window.BitEngine && window.BitEngine.consts.h) || 3;
        const god = plane.life > max * 10;
        const life = god ? max : Math.max(0, Math.min(max, plane.life));
        const pct = life / max;
        fill.style.width = (pct * 100) + "%";
        el.className = "health-bar " + (god ? "god" : pct > 0.6 ? "good" : pct > 0.3 ? "ok" : "bad");
        const label = god ? "GOD" : `${Math.ceil(life)} / ${max}`;
        if (text.textContent !== label) text.textContent = label;
        const n = planeName(plane);
        if (name.textContent !== n) name.textContent = n;
    }

    function init() {
        el = document.createElement("div");
        el.className = "health-bar";
        el.hidden = true;
        el.innerHTML = `<div class="health-top"><span class="health-name"></span><span class="health-text"></span></div>
            <div class="health-track"><div class="health-fill"></div></div>`;
        (document.querySelector(".ui") || document.body).appendChild(el);
        fill = el.querySelector(".health-fill");
        text = el.querySelector(".health-text");
        name = el.querySelector(".health-name");
        requestAnimationFrame(update);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
