// Loads the whole activity from wherever this script is hosted, for example
// jsDelivr serving the GitHub repo:
//
//   <script src="https://cdn.jsdelivr.net/gh/aanzodev/bitplanes@main/js/loader.js"></script>
//
// It reads index.html from the same place, adds its page markup and styles to
// this page, then loads every script in the same order. So a page with just
// that one line always runs the latest activity from GitHub (see play.html).
(function () {
    // Where this script was loaded from. Some editors add scripts in ways where
    // document.currentScript is empty, so fall back to searching for it.
    const DEFAULT = "https://cdn.jsdelivr.net/gh/aanzodev/bitplanes@main/js/loader.js";
    const me = document.currentScript ||
        [...document.querySelectorAll("script[src]")].find(s => /js\/loader\.js(\?.*)?$/.test(s.src));
    let base = ((me && me.src) || DEFAULT).replace(/js\/loader\.js(\?.*)?$/, "");

    // Everything loads from the same place as this script (jsDelivr's copy of
    // the repo), with no GitHub lookups. jsDelivr refreshes its copy of a
    // branch like @main within about 12 hours of a push.

    function loadOnce(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement("script");
            s.src = src;
            // A script can't safely be fetched twice at once, so a slow file is
            // waited for (and the screen says so) rather than restarted.
            const name = src.replace(/^.*\//, "").replace(/\?.*$/, "");
            const slowTimer = setTimeout(() => slow(`Slow connection: still downloading ${name}…`), 8000);
            s.onload = () => {
                clearTimeout(slowTimer);
                slow("");
                resolve();
            };
            s.onerror = () => {
                clearTimeout(slowTimer);
                slow("");
                s.remove();
                reject(new Error("Could not load " + src));
            };
            document.body.appendChild(s);
        });
    }

    // A download can fail now and then (a busy CDN, a dropped connection):
    // try each file up to three times before giving up.
    async function loadScript(src) {
        for (let attempt = 1; ; attempt++) {
            try {
                return await loadOnce(attempt === 1 ? src : src + (src.includes("?") ? "&" : "?") + "retry=" + attempt);
            } catch (e) {
                if (attempt >= 3) throw e;
                step(`Download failed, trying again (${attempt + 1} of 3)…`, src.replace(/^.*\//, "").replace(/\?.*$/, ""));
                await new Promise(r => setTimeout(r, 600 * attempt));
            }
        }
    }

    // Files only the Flight Sessions (3D) mode needs. If one of them won't load,
    // the rest of Bit Planes still starts, with Flight Sessions switched off.
    const OPTIONAL = /js\/airbattle\//;

    function dropAirBattle(missing) {
        console.warn("Flight Sessions is off: these files didn't load:", missing);
        const radio = document.querySelector('input[name="mode"][value="airbattle"]');
        if (radio) {
            if (radio.checked) {
                const first = document.querySelector('input[name="mode"]');
                if (first) first.checked = true;
            }
            (radio.closest("div") || radio).remove();
        }
        const note = document.querySelector(".online-status");
        if (note) note.textContent = "Flight Sessions (3D) couldn't load here. Bit Planes works as usual.";
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
        const msg = err && err.name === "AbortError" ? "the download took too long" : (err && err.message) || String(err);
        p.textContent = "Bit Planes could not load: " + msg;
        // Show it on the loading screen if that's up, so the error isn't hidden behind it.
        const box = document.querySelector(".bit-load-box");
        if (box) {
            p.style.padding = "12px 0 0";
            box.appendChild(p);
            step("Stopped.");
        } else (document.body || document.documentElement).appendChild(p);
    }

    // Until every script has loaded, hide the activity and show a loading
    // screen with real progress: which step it's on, how many files are done,
    // and which file it's waiting for (clicking Start too early would just
    // reload the page).
    let ui = null;
    function showLoading() {
        const style = document.createElement("style");
        style.textContent = `html.bit-loading main, html.bit-loading .ui, html.bit-loading .shop, html.bit-loading .pause-menu {visibility: hidden}
.bit-load {position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(#a6e3ff, #f3f4f6); font: 15px/1.4 system-ui, sans-serif; color: #1f2933}
.bit-load-box {width: min(420px, calc(100vw - 32px)); background: #fff; border-radius: 14px; padding: 22px 24px;
    box-shadow: 0 10px 30px rgba(0,0,0,.12)}
.bit-load h1 {margin: 0 0 4px; font-size: 22px}
.bit-load-step {margin: 0 0 14px; color: #52606d}
.bit-load-track {height: 12px; border-radius: 6px; background: #e4e7eb; overflow: hidden}
.bit-load-fill {height: 100%; width: 0; background: linear-gradient(90deg, #2f80ed, #56ccf2); transition: width .25s}
.bit-load-row {display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; font-size: 13px; color: #52606d}
.bit-load-file {overflow: hidden; text-overflow: ellipsis; white-space: nowrap}
.bit-load-pct {font-weight: 700; color: #1f2933}
.bit-load-slow {margin: 10px 0 0; font-size: 13px; color: #b54708}`;
        document.head.appendChild(style);
        document.documentElement.classList.add("bit-loading");
        const el = document.createElement("div");
        el.className = "bit-load";
        el.innerHTML = `<div class="bit-load-box" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <h1>Loading Bit Planes</h1><p class="bit-load-step">Starting…</p>
            <div class="bit-load-track"><div class="bit-load-fill"></div></div>
            <div class="bit-load-row"><span class="bit-load-file"></span><span class="bit-load-pct">0%</span></div>
            <p class="bit-load-slow" hidden></p></div>`;
        document.body.appendChild(el);
        const $ = c => el.querySelector(c);
        let pct = 0;
        ui = {
            step(text, file) {
                $(".bit-load-step").textContent = text;
                $(".bit-load-file").textContent = file || "";
            },
            // Never goes backwards, so a retry doesn't make the bar jump back.
            progress(p) {
                pct = Math.max(pct, Math.min(100, Math.round(p)));
                $(".bit-load-fill").style.width = pct + "%";
                $(".bit-load-pct").textContent = pct + "%";
                $(".bit-load-box").setAttribute("aria-valuenow", pct);
            },
            slow(text) {
                $(".bit-load-slow").hidden = !text;
                $(".bit-load-slow").textContent = text || "";
            },
        };
        const block = ev => document.documentElement.classList.contains("bit-loading") && ev.preventDefault();
        document.addEventListener("submit", block, true);
        return () => {
            el.remove();
            ui = null;
            document.documentElement.classList.remove("bit-loading");
            document.removeEventListener("submit", block, true);
        };
    }
    const step = (text, file) => ui && ui.step(text, file);
    const progress = p => ui && ui.progress(p);
    const slow = text => ui && ui.slow(text);

    // fetch() that gives up after a while instead of hanging forever.
    async function fetchWithin(url, ms, opts) {
        const ctrl = typeof AbortController === "function" ? new AbortController() : null;
        const timer = ctrl && setTimeout(() => ctrl.abort(), ms);
        try {
            return await fetch(url, Object.assign({}, opts, ctrl ? {signal: ctrl.signal} : {}));
        } finally {
            clearTimeout(timer);
        }
    }

    async function start() {
        await bodyReady();
        const done = showLoading();
        window.BitBase = base; // asset paths (sprites, maps) are resolved against this
        step("Downloading the page…", "index.html");
        progress(5);
        const res = await fetchWithin(base + "index.html", 30000);
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

        // The activity's scripts, one after another like in index.html.
        const missing = [];
        const scripts = [...doc.querySelectorAll("script[src]")];
        progress(10);
        for (const [i, s] of scripts.entries()) {
            const src = s.getAttribute("src");
            // Once one Flight Sessions file is missing, skip the rest of them.
            if (OPTIONAL.test(src) && missing.length) continue;
            step(`Loading ${OPTIONAL.test(src) ? "Flight Sessions (3D)" : "Bit Planes"}: file ${i + 1} of ${scripts.length}`,
                src.replace(/^.*\//, ""));
            try {
                await loadScript(/^https?:/.test(src) ? src : base + src);
            } catch (e) {
                if (!OPTIONAL.test(src)) throw e;
                missing.push(src);
            }
            progress(10 + 90 * (i + 1) / scripts.length);
        }
        step("Ready!");
        progress(100);
        if (missing.length) {
            window.BitAirBattle = null;
            dropAirBattle(missing);
        }
        done();
    }

    start().catch(fail);
})();
