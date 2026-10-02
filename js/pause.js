// In-activity menu (Esc or the ⏸ button): resume, change your plane or paint,
// or leave to the start screen. Single player freezes while the menu is
// open; online activities keep running for everyone else.
(function () {
    const shop = window.BitShop;
    let open = false;

    function inActivity() {
        const ui = document.querySelector(".ui");
        return ui && ui.style.display === "block";
    }

    function online() {
        return window.BitOnline && window.BitOnline.role;
    }

    function isGuest() {
        return online() === "guest";
    }

    // The plane you are flying right now, if any.
    function currentPlane() {
        if (isGuest()) return window.BitOnline.prediction && window.BitOnline.prediction.plane();
        const player = window.BitEngine && window.BitEngine.player;
        return player && player.hasPlane();
    }

    function planeImage(p) {
        return window.bitPlaneImage ? window.bitPlaneImage(shop.colorOf(p), true, p.skin, shop.patternOf(p)) : "";
    }

    // ------------------------------------------------------------ open/close

    function show() {
        if (open || !inActivity()) return;
        open = true;
        const paused = !online();
        window.bitPaused = paused;
        const S = window.BitSound && window.BitSound.state;
        if (paused && S && S.ctx) S.ctx.suspend();
        document.querySelector(".pause-title").textContent = paused ? "Paused" : "Menu";
        document.querySelector(".pause-note").textContent = paused
            ? ""
            : "The online activity keeps going while this menu is open.";
        render();
        document.querySelector(".pause-menu").hidden = false;
    }

    function hide() {
        if (!open) return;
        open = false;
        window.bitPaused = false;
        const S = window.BitSound && window.BitSound.state;
        if (S && S.ctx && S.ctx.state === "suspended") S.ctx.resume();
        document.querySelector(".pause-menu").hidden = true;
    }

    function leave() {
        location.href = location.pathname + location.search;
    }

    // ------------------------------------------------------------- content

    function render() {
        const state = shop.state();
        const selected = shop.selected();
        const flying = currentPlane();
        const planes = shop.planes.filter(p => state.owned.includes(p.id));
        document.querySelector(".pause-planes").innerHTML = planes.map(p => `
            <button type="button" class="pause-plane${p.id === selected.id ? " selected" : ""}${p.special ? " special" : ""}${p.exclusive ? " exclusive" : ""}" data-plane="${p.id}">
                <img src="${planeImage(p)}" alt="">
                <span>${p.name}</span>
            </button>`).join("");
        const later = flying && flying.planeId && flying.planeId !== selected.id;
        document.querySelector(".pause-hint").textContent = later
            ? `You'll fly the ${selected.name} with your next plane (after a respawn or at the barn).`
            : "A new plane choice takes effect with your next plane.";

        const current = (state.paint && state.paint[selected.id]) || null;
        document.querySelector(".pause-paint").innerHTML = `
            <div class="paint-preview"><img src="${planeImage(selected)}" alt="${selected.name}"></div>
            <div class="paint-swatches">${shop.paints.map(({name, color}) => `
                <button type="button" class="paint-swatch${color === current ? " active" : ""}${color ? "" : " factory"}"
                    data-paint="${color || ""}" title="${name}" style="${color ? "background: " + color : ""}">${color ? "" : "✕"}</button>`).join("")}
            </div>
            ${window.BitPatternButtons ? window.BitPatternButtons(selected) : ""}`;
    }

    function choosePlane(id) {
        shop.selectPlane(id);
        sendLoadout();
        render();
    }

    // Paint and patterns show on your current plane right away (if it's the selected type).
    function paint(color, pattern) {
        if (color !== undefined) shop.setPaint(color);
        if (pattern !== undefined) shop.setPattern(pattern);
        const selected = shop.selected(), newColor = shop.colorOf(selected), newPattern = shop.patternOf(selected);
        const plane = currentPlane();
        if (plane && plane.setSkin && plane.planeId === selected.id) {
            plane.setSkin(newColor, selected.skin, newPattern);
            if (plane.player) plane.player.color = newColor;
        }
        if (isGuest()) window.BitOnline.sendToHost({t: "paint", c: newColor, p: newPattern});
        sendLoadout();
        render();
    }

    // Online guests tell the host so their next plane uses the new choice.
    function sendLoadout() {
        if (isGuest()) window.BitOnline.sendToHost({t: "loadout", l: shop.loadout()});
    }

    // --------------------------------------------------------------- input

    function init() {
        const menu = document.querySelector(".pause-menu");
        document.querySelector(".pause-toggle").addEventListener("click", ev => {
            ev.currentTarget.blur();
            open ? hide() : show();
        });
        document.querySelector(".resume-activity").addEventListener("click", hide);
        document.querySelector(".leave-activity").addEventListener("click", leave);
        menu.addEventListener("click", ev => {
            if (ev.target === menu) return hide();
            const btn = ev.target.closest("button");
            if (!btn) return;
            if (btn.dataset.plane) choosePlane(btn.dataset.plane);
            if (btn.dataset.paint !== undefined) paint(btn.dataset.paint || null);
            if (btn.dataset.pattern !== undefined) paint(undefined, btn.dataset.pattern);
        });
        // Runs before the activity's own key handlers (window capture comes first).
        window.addEventListener("keydown", ev => {
            if (ev.code === "Escape" && inActivity()) {
                ev.preventDefault();
                ev.stopPropagation();
                open ? hide() : show();
                return;
            }
            // While the menu is open, keys don't fly the plane (M still mutes).
            if (open && ev.code !== "KeyM") ev.stopPropagation();
        }, true);
    }

    window.BitPause = {show, hide, paint, isOpen: () => open};

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
