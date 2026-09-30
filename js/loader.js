// Loads the whole game from wherever this script is hosted, for example
// jsDelivr serving the GitHub repo:
//
//   <script src="https://cdn.jsdelivr.net/gh/aanzodev/bitplanes@main/js/loader.js"></script>
//
// It reads index.html from the same place, adds its page markup and styles to
// this page, then loads every script in the same order. So a page with just
// that one line always runs the latest game from GitHub (see play.html).
(function () {
    const me = document.currentScript;
    const base = me.src.replace(/js\/loader\.js(\?.*)?$/, "");
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

    function fail(err) {
        console.error(err);
        const p = document.createElement("p");
        p.style.cssText = "font: bold 16px sans-serif; padding: 20px; color: #b3261e";
        p.textContent = "Bit Planes could not load: " + err.message;
        document.body.appendChild(p);
    }

    async function start() {
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
        for (const node of [...doc.body.childNodes]) {
            if (node.nodeName === "SCRIPT") continue;
            document.body.insertBefore(document.importNode(node, true), me);
        }

        // The game's scripts, one after another like in index.html.
        for (const s of doc.querySelectorAll("script[src]")) {
            const src = s.getAttribute("src");
            await loadScript(/^https?:/.test(src) ? src : base + src);
        }
    }

    start().catch(fail);
})();
