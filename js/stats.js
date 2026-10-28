// Lifetime stats and the Stats page (button on the start screen). Builds on
// the counters the engine already saves (bullets, missiles, kills, deaths,
// cows) and adds hits, kill streaks, time flown per plane, matches and coins.
// Online guests count kills and deaths from the host's scoreboard.
window.BitStats = (function () {
    const COINS_PER_KILL = 10;
    let el, lastKilled = null, lastDeaths = null, uiShown = false;

    // The engine's saved stats object (written to localStorage every second).
    function S() {
        const s = window.BitEngine && window.BitEngine.require(7).c;
        if (!s) return null;
        for (const [k, v] of Object.entries({hits: 0, streak: 0, bestStreak: 0, flySeconds: 0, matches: 0, onlineMatches: 0,
            coinsEarned: 0, planeSeconds: {}, planeKills: {}})) if (s[k] === undefined) s[k] = v;
        return s;
    }

    function myPlane() {
        const O = window.BitOnline;
        if (O && O.role === "guest") return O.prediction && O.prediction.plane();
        const player = window.BitEngine && window.BitEngine.player;
        return player && player.hasPlane();
    }

    let lastPlaneId = "";

    // Once a second: time flown, new kills/deaths (streaks, kills per plane), matches.
    function tick() {
        const s = S();
        if (!s) return;
        const plane = myPlane();
        if (plane && plane.planeId) {
            lastPlaneId = plane.planeId;
            s.flySeconds++;
            s.planeSeconds[plane.planeId] = (s.planeSeconds[plane.planeId] || 0) + 1;
        }
        if (lastKilled === null) [lastKilled, lastDeaths] = [s.killed, s.deaths];
        const kills = s.killed - lastKilled, deaths = s.deaths - lastDeaths;
        if (kills > 0) {
            s.streak += kills;
            s.bestStreak = Math.max(s.bestStreak, s.streak);
            s.coinsEarned += kills * COINS_PER_KILL;
            if (lastPlaneId) s.planeKills[lastPlaneId] = (s.planeKills[lastPlaneId] || 0) + kills;
        }
        if (deaths > 0) s.streak = 0;
        [lastKilled, lastDeaths] = [s.killed, s.deaths];

        const ui = document.querySelector(".ui"), shown = !!ui && ui.style.display === "block";
        if (shown && !uiShown) {
            s.matches++;
            if (window.BitOnline && window.BitOnline.role) s.onlineMatches++;
        }
        uiShown = shown;
    }

    // Online guests: the host's scoreboard says how many kills and deaths we have.
    let guestRow = null;
    function guestScore(kills, deaths) {
        const s = S();
        if (!s) return;
        if (guestRow) {
            s.killed += Math.max(0, kills - guestRow.kills);
            s.deaths += Math.max(0, deaths - guestRow.deaths);
        }
        guestRow = {kills, deaths};
    }

    // ------------------------------------------------------------------ page

    function time(sec) {
        const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
        return h ? `${h}h ${m}m` : m ? `${m}m ${sec % 60}s` : `${sec}s`;
    }

    function planeImg(p) {
        const shop = window.BitShop;
        return window.bitPlaneImage ? window.bitPlaneImage(shop.colorOf(p), true, p.skin, shop.patternOf(p)) : "";
    }

    function render() {
        const s = S(), shop = window.BitShop;
        if (!s || !shop) return;
        const n = v => (v || 0).toLocaleString();
        const kd = s.deaths ? (s.killed / s.deaths).toFixed(2) : n(s.killed);
        const acc = s.bullets ? Math.round(100 * s.hits / s.bullets) + "%" : "–";
        const daily = window.BitDaily ? window.BitDaily.status() : {streak: 0, best: 0};
        const planes = Object.entries(s.planeSeconds).sort((a, b) => b[1] - a[1])
            .map(([id, sec]) => ({p: shop.planes.find(x => x.id === id), sec, kills: s.planeKills[id] || 0})).filter(x => x.p);
        const fav = planes[0];
        const card = (label, value, sub = "") => `<div class="stat-card"><b>${value}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ""}</div>`;
        el.querySelector(".stats-body").innerHTML = `
            <div class="stat-grid">
                ${card("Kills", n(s.killed))}
                ${card("Deaths", n(s.deaths))}
                ${card("K/D ratio", kd)}
                ${card("Best kill streak", n(s.bestStreak), s.streak ? `now: ${s.streak}` : "")}
                ${card("Accuracy", acc, `${n(s.hits)} hits / ${n(s.bullets)} shots`)}
                ${card("Missiles fired", n(s.missiles))}
                ${card("Matches", n(s.matches), `${n(s.onlineMatches)} online`)}
                ${card("Time flying", time(s.flySeconds))}
                ${card("Coins earned", n(s.coinsEarned))}
                ${card("Daily streak", n(daily.streak), `best: ${n(daily.best)}`)}
                ${card("Cows hit", n(s.cowKilled), "oops")}
            </div>
            ${fav ? `<h3>Favorite plane</h3>
            <div class="stat-fav"><img src="${planeImg(fav.p)}" alt=""><div><b>${fav.p.name}</b>
                <span>${time(fav.sec)} flown · ${n(fav.kills)} kills</span></div></div>
            <h3>Your planes</h3>
            <table class="stat-planes"><tr><th></th><th>Plane</th><th>Time</th><th>Kills</th></tr>
                ${planes.slice(0, 8).map(x => `<tr><td><img src="${planeImg(x.p)}" alt=""></td><td>${x.p.name}</td><td>${time(x.sec)}</td><td>${n(x.kills)}</td></tr>`).join("")}
            </table>` : `<p class="shop-note">Fly a few matches and your favorite planes show up here.</p>`}
            <p class="shop-note">Accuracy and missiles count single player and hosting.</p>`;
    }

    function reset() {
        const s = S();
        if (!s) return;
        Object.assign(s, {bullets: 0, missiles: 0, killed: 0, deaths: 0, cowKilled: 0, hits: 0, streak: 0, bestStreak: 0,
            flySeconds: 0, matches: 0, onlineMatches: 0, coinsEarned: 0, planeSeconds: {}, planeKills: {}});
        [lastKilled, lastDeaths] = [0, 0];
    }

    function init() {
        el = document.createElement("div");
        el.className = "stats-page panel-backdrop";
        el.hidden = true;
        el.innerHTML = `<div class="panel" role="dialog" aria-label="Stats">
            <div class="shop-header"><h2>Stats</h2><button type="button" class="close-shop stats-close" aria-label="Close">×</button></div>
            <div class="stats-body"></div>
            <button type="button" class="stats-reset">Reset stats</button>
        </div>`;
        document.body.appendChild(el);
        el.addEventListener("click", ev => {
            if (ev.target === el || ev.target.closest(".stats-close")) el.hidden = true;
            if (ev.target.closest(".stats-reset") && confirm("Reset all your stats? Coins and planes stay.")) {
                reset();
                render();
            }
        });
        document.addEventListener("keydown", ev => ev.key === "Escape" && (el.hidden = true));
        const btn = document.querySelector(".open-stats");
        if (btn) btn.addEventListener("click", () => {
            render();
            el.hidden = false;
        });
        setInterval(tick, 1000);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    return {
        get: S,
        guestScore,
        resetGuest: () => (guestRow = null),
        addEarned: coins => {
            const s = S();
            if (s) s.coinsEarned += coins;
        },
        show: () => (render(), (el.hidden = false)),
        reset,
    };
})();
