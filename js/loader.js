// Loads the whole game from wherever this script is hosted, for example
// jsDelivr serving the GitHub repo:
//
//   <script src="https://cdn.jsdelivr.net/gh/aanzodev/bitplanes@main/js/loader.js"></script>
//
// It reads index.html from the same place, adds its page markup and styles to
// this page, then loads every script in the same order. So a page with just
// that one line always runs the latest game from GitHub (see play.html).
(function () {
    // Where this script was loaded from. Some editors add scripts in ways where
    // document.currentScript is empty, so fall back to searching for it.
    const DEFAULT = "https://cdn.jsdelivr.net/gh/aanzodev/bitplanes@main/js/loader.js";
    const me = document.currentScript ||
        [...document.querySelectorAll("script[src]")].find(s => /js\/loader\.js(\?.*)?$/.test(s.src));
    const base = ((me && me.src) || DEFAULT).replace(/js\/loader\.js(\?.*)?$/, "");
    window.BitBase = base; // asset paths (sprites, maps) are resolved against this

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error("Could not load " + src));
            document.body.appendChild(s);
        });
    }

    // The page body may not exist yet if this script is in <head>.
    function bodyReady() {
        if (document.body) return Promise.resolve();
        return new Promise(r => document.addEventListener("DOMContentLoaded", r, {once: true}));
    }

    function fail(err) {
        console.error(err);
        const p = document.createElement("p");
        p.style.cssText = "font: bold 16px sans-serif; padding: 20px; color: #b3261e";
        p.textContent = "Bit Planes could not load: " + err.message;
        (document.body || document.documentElement).appendChild(p);
    }

    // Until every script has loaded, hide the game and show a loading line
    // (clicking Start too early would just reload the page).
    function showLoading() {
        const style = document.createElement("style");
        style.textContent = "html.bit-loading main, html.bit-loading .ui, html.bit-loading .shop, html.bit-loading .pause-menu" +
            "{visibility: hidden} .bit-loading-note {font: bold 18px sans-serif; text-align: center; padding: 40px}";
        document.head.appendChild(style);
        document.documentElement.classList.add("bit-loading");
        const note = document.createElement("p");
        note.className = "bit-loading-note";
        note.textContent = "Loading Bit Planes…";
        document.body.appendChild(note);
        const block = ev => document.documentElement.classList.contains("bit-loading") && ev.preventDefault();
        document.addEventListener("submit", block, true);
        return () => {
            note.remove();
            document.documentElement.classList.remove("bit-loading");
            document.removeEventListener("submit", block, true);
        };
    }

    async function start() {
        await bodyReady();
        const done = showLoading();
        const res = await fetch(base + "index.html");
        if (!res.ok) throw new Error("index.html " + res.status);
        const doc = new DOMParser().parseFromString(await res.text(), "text/html");

        if (!document.title) document.title = doc.title;
        for (const link of doc.head.querySelectorAll('link[rel="stylesheet"], link[rel="icon"]')) {
            const copy = document.createElement("link");
            copy.rel = link.getAttribute("rel");
            const href = link.getAttribute("href");
            copy.href = /^(data:|https?:)/.test(href) ? href : base + href;
            document.head.appendChild(copy);
        }
        if (!document.querySelector('meta[name="viewport"]')) {
            const vp = doc.querySelector('meta[name="viewport"]');
            if (vp) document.head.appendChild(document.importNode(vp, true));
        }

        // Page markup (start screen, HUD, menus), without index.html's scripts.
        // Goes straight into <body>, wherever the loader's own script tag sits.
        const before = me && me.parentNode === document.body ? me : null;
        for (const node of [...doc.body.childNodes]) {
            if (node.nodeName === "SCRIPT") continue;
            document.body.insertBefore(document.importNode(node, true), before);
        }

        // The game's scripts, one after another like in index.html.
        for (const s of doc.querySelectorAll("script[src]")) {
            const src = s.getAttribute("src");
            await loadScript(/^https?:/.test(src) ? src : base + src);
        }
        done();
    }

    start().catch(fail);
})();
