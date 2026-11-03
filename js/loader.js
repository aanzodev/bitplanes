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
    // screen with real progress: a checklist of the stages, which file it's
    // on, how long it has taken and roughly how long is left (clicking Start
    // too early would just reload the page).
    const TIPS = [
        "Press <b>Space</b> to fire and <b>X</b> for a guided missile.",
        "Press <b>Q</b> to drop countermeasures when a guided missile is on your tail.",
        "Press <b>C</b> to eject. Land at the barn to get a new plane.",
        "Every takedown earns <b>50 credits</b> to spend in Aircraft Selection.",
        "Claim your <b>daily reward</b> every day: day 7 pays 1,000 credits.",
        "Reach <b>level 10</b> or own a special jet to unlock Flight Sessions (3D).",
        "Change any key in <b>⚙ Settings</b>, for both Bit Planes and Flight Sessions.",
        "Quests reset every day and every week. Check them for extra credits and XP.",
        "In Flight Sessions, press <b>V</b> for the cockpit view.",
    ];
    const PLANE_SVG = `<svg viewBox="0 0 40 24" aria-hidden="true"><path d="M3 12h27c4 0 7 1.5 7 3s-3 2-7 2H9z" fill="#e8483b"/>
        <rect x="12" y="4" width="10" height="3" rx="1.5" fill="#c23a2f"/><rect x="11" y="17" width="12" height="3" rx="1.5" fill="#c23a2f"/>
        <path d="M15 7v5M19 7v5" stroke="#5a2a20" stroke-width="1.2"/><path d="M3 12 1 6h4l4 6z" fill="#c23a2f"/>
        <circle cx="31" cy="13" r="2.2" fill="#9be1ff"/><rect x="37" y="8" width="1.6" height="12" rx=".8" fill="#5a5a5a" class="bit-load-prop"/></svg>`;
    let ui = null;
    function showLoading() {
        const style = document.createElement("style");
        style.textContent = `html.bit-loading main, html.bit-loading .ui, html.bit-loading .shop, html.bit-loading .pause-menu {visibility: hidden}
.bit-load {position: fixed; inset: 0; z-index: 99999; display: flex; align-items: center; justify-content: center; overflow: hidden;
    background: linear-gradient(#7fd3ff 0%, #b9e8ff 45%, #eef7fb 100%); font: 15px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif;
    color: #1f2933; transition: opacity .35s}
.bit-load.bit-load-out {opacity: 0}
.bit-load-cloud {position: absolute; width: 220px; height: 70px; border-radius: 50px; background: #fff; opacity: .75;
    filter: blur(1px); animation: bit-load-drift linear infinite}
.bit-load-cloud::before, .bit-load-cloud::after {content: ""; position: absolute; background: #fff; border-radius: 50%}
.bit-load-cloud::before {width: 100px; height: 100px; left: 30px; top: -45px}
.bit-load-cloud::after {width: 80px; height: 80px; left: 110px; top: -30px}
@keyframes bit-load-drift {from {transform: translateX(-260px)} to {transform: translateX(calc(100vw + 260px))}}
.bit-load-box {position: relative; width: min(440px, calc(100vw - 32px)); background: rgba(255,255,255,.94); border-radius: 18px;
    padding: 24px 26px 20px; box-shadow: 0 18px 50px rgba(20,60,90,.18), 0 2px 6px rgba(20,60,90,.08)}
.bit-load-head {display: flex; align-items: center; gap: 12px; margin-bottom: 16px}
.bit-load-logo {width: 46px; height: 46px; border-radius: 12px; background: linear-gradient(135deg, #2f80ed, #56ccf2);
    display: grid; place-items: center; flex: none}
.bit-load-logo svg {width: 32px; height: 20px}
.bit-load h1 {margin: 0; font-size: 21px; line-height: 1.2}
.bit-load-step {margin: 2px 0 0; color: #52606d; font-size: 14px}
.bit-load-track {position: relative; height: 14px; border-radius: 7px; background: #e4e9ee; margin-top: 30px}
.bit-load-fill {position: relative; height: 100%; width: 0; border-radius: 7px; overflow: hidden; transition: width .3s ease-out;
    background: linear-gradient(90deg, #2f80ed, #56ccf2)}
.bit-load-fill::after {content: ""; position: absolute; inset: 0; width: 60px;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.45), transparent); animation: bit-load-shine 1.4s ease-in-out infinite}
@keyframes bit-load-shine {from {transform: translateX(-60px)} to {transform: translateX(440px)}}
.bit-load-plane {position: absolute; top: -24px; left: 0; width: 34px; height: 20px; margin-left: -17px; transition: left .3s ease-out;
    animation: bit-load-bob 1.2s ease-in-out infinite}
@keyframes bit-load-bob {50% {transform: translateY(-3px) rotate(-3deg)}}
.bit-load-prop {transform-origin: 37.8px 14px; animation: bit-load-spin .12s linear infinite}
@keyframes bit-load-spin {50% {transform: scaleY(.15)}}
.bit-load-row {display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; font-size: 13px; color: #52606d}
.bit-load-file {overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px}
.bit-load-pct {font-weight: 700; color: #1f2933; font-variant-numeric: tabular-nums}
.bit-load-stages {list-style: none; margin: 16px 0 0; padding: 0; display: grid; gap: 6px; font-size: 14px}
.bit-load-stages li {display: flex; align-items: center; gap: 10px; color: #9aa5b1}
.bit-load-stages li::before {content: ""; width: 18px; height: 18px; border-radius: 50%; border: 2px solid #cbd2d9; box-sizing: border-box; flex: none}
.bit-load-stages li[data-state="active"] {color: #1f2933; font-weight: 600}
.bit-load-stages li[data-state="active"]::before {border-color: #2f80ed; border-right-color: transparent; animation: bit-load-turn .8s linear infinite}
.bit-load-stages li[data-state="done"] {color: #3e4c59}
.bit-load-stages li[data-state="done"]::before {content: "✓"; border: 0; background: #27ae60; color: #fff; font-size: 12px; font-weight: 700;
    display: grid; place-items: center}
.bit-load-stages li[data-state="failed"] {color: #b54708}
.bit-load-stages li[data-state="failed"]::before {content: "!"; border: 0; background: #f79009; color: #fff; font-size: 12px; font-weight: 700;
    display: grid; place-items: center}
.bit-load-stages small {margin-left: auto; font-weight: 400; color: #7b8794; font-variant-numeric: tabular-nums}
@keyframes bit-load-turn {to {transform: rotate(360deg)}}
.bit-load-time {display: flex; justify-content: space-between; margin-top: 14px; font-size: 12px; color: #7b8794; font-variant-numeric: tabular-nums}
.bit-load-slow {margin: 10px 0 0; padding: 8px 10px; border-radius: 8px; background: #fff4e5; font-size: 13px; color: #b54708}
.bit-load-tip {margin: 14px 0 0; padding-top: 12px; border-top: 1px solid #e4e9ee; font-size: 13px; color: #52606d; min-height: 2.9em;
    transition: opacity .3s}
.bit-load-tip b {color: #1f2933}
@media (prefers-reduced-motion: reduce) {.bit-load *, .bit-load *::before {animation: none !important; transition: none !important}}`;
        document.head.appendChild(style);
        document.documentElement.classList.add("bit-loading");
        const el = document.createElement("div");
        el.className = "bit-load";
        const clouds = [[12, 38, 0], [30, 52, -20], [62, 44, -9], [80, 60, -33]]
            .map(([top, secs, delay]) => `<div class="bit-load-cloud" style="top: ${top}%; animation-duration: ${secs}s; animation-delay: ${delay}s"></div>`).join("");
        el.innerHTML = `${clouds}<div class="bit-load-box" role="progressbar" aria-label="Loading Bit Planes" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="bit-load-head"><div class="bit-load-logo">${PLANE_SVG}</div>
                <div><h1>Loading Bit Planes</h1><p class="bit-load-step" aria-live="polite">Starting…</p></div></div>
            <div class="bit-load-track"><div class="bit-load-fill"></div><div class="bit-load-plane">${PLANE_SVG}</div></div>
            <div class="bit-load-row"><span class="bit-load-file"></span><span class="bit-load-pct">0%</span></div>
            <ul class="bit-load-stages">
                <li data-stage="page">Page and styles<small></small></li>
                <li data-stage="core">Bit Planes<small></small></li>
                <li data-stage="air">Flight Sessions (3D)<small></small></li>
            </ul>
            <p class="bit-load-slow" hidden></p>
            <div class="bit-load-time"><span class="bit-load-elapsed">0 s</span><span class="bit-load-left"></span></div>
            <p class="bit-load-tip"></p></div>`;
        document.body.appendChild(el);
        const $ = c => el.querySelector(c);
        let pct = 0;
        const began = performance.now();
        // Elapsed time, and an estimate of what's left once there's enough to go on.
        const clock = setInterval(() => {
            const secs = (performance.now() - began) / 1000;
            $(".bit-load-elapsed").textContent = `${Math.floor(secs)} s`;
            const left = pct >= 15 && pct < 100 ? secs * (100 - pct) / pct : 0;
            $(".bit-load-left").textContent = left ? `about ${left < 60 ? Math.max(1, Math.round(left)) + " s" : Math.round(left / 60) + " min"} left` : "";
        }, 250);
        // A new tip every few seconds.
        let tip = Math.floor(Math.random() * TIPS.length);
        const showTip = () => {
            $(".bit-load-tip").innerHTML = "💡 " + TIPS[tip++ % TIPS.length];
        };
        showTip();
        const tipper = setInterval(() => {
            $(".bit-load-tip").style.opacity = 0;
            setTimeout(() => {
                if (!ui) return;
                showTip();
                $(".bit-load-tip").style.opacity = 1;
            }, 300);
        }, 4500);
        ui = {
            step(text, file) {
                $(".bit-load-step").textContent = text;
                $(".bit-load-file").textContent = file || "";
            },
            // Never goes backwards, so a retry doesn't make the bar jump back.
            progress(p) {
                pct = Math.max(pct, Math.min(100, Math.round(p)));
                $(".bit-load-fill").style.width = pct + "%";
                $(".bit-load-plane").style.left = pct + "%";
                $(".bit-load-pct").textContent = pct + "%";
                $(".bit-load-box").setAttribute("aria-valuenow", pct);
            },
            // stage: "page" | "core" | "air"; state: "active" | "done" | "failed"
            stage(name, state, note) {
                const li = el.querySelector(`[data-stage="${name}"]`);
                if (!li) return;
                if (state) li.dataset.state = state;
                if (note !== undefined) li.querySelector("small").textContent = note;
            },
            slow(text) {
                $(".bit-load-slow").hidden = !text;
                $(".bit-load-slow").textContent = text || "";
            },
        };
        const block = ev => document.documentElement.classList.contains("bit-loading") && ev.preventDefault();
        document.addEventListener("submit", block, true);
        return () => {
            clearInterval(clock);
            clearInterval(tipper);
            ui = null;
            document.documentElement.classList.remove("bit-loading");
            document.removeEventListener("submit", block, true);
            // Fade out, then remove.
            el.classList.add("bit-load-out");
            setTimeout(() => el.remove(), 380);
        };
    }
    const stage = (name, state, note) => ui && ui.stage(name, state, note);
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
        stage("page", "active");
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
        const total = {core: 0, air: 0}, loaded = {core: 0, air: 0};
        for (const s of scripts) total[OPTIONAL.test(s.getAttribute("src")) ? "air" : "core"]++;
        stage("page", "done", "");
        stage("core", null, `0 / ${total.core}`);
        stage("air", null, total.air ? `0 / ${total.air}` : "");
        progress(10);
        for (const [i, s] of scripts.entries()) {
            const src = s.getAttribute("src");
            const part = OPTIONAL.test(src) ? "air" : "core";
            // Once one Flight Sessions file is missing, skip the rest of them.
            if (part === "air" && missing.length) continue;
            stage(part, "active");
            step(`${part === "air" ? "Flight Sessions (3D)" : "Bit Planes"}: file ${i + 1} of ${scripts.length}`,
                src.replace(/^.*\//, ""));
            try {
                await loadScript(/^https?:/.test(src) ? src : base + src);
            } catch (e) {
                if (!OPTIONAL.test(src)) {
                    stage(part, "failed");
                    throw e;
                }
                missing.push(src);
                stage(part, "failed", "couldn't load: skipped");
            }
            if (!missing.length || part === "core") {
                loaded[part]++;
                stage(part, loaded[part] === total[part] ? "done" : null, `${loaded[part]} / ${total[part]}`);
            }
            progress(10 + 90 * (i + 1) / scripts.length);
        }
        if (!total.air) stage("air", "done", "");
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
