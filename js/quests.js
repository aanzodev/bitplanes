window.BitQuests = (function () {
    const KEY = "quests";
    const DAILY = [
        {id: "kills5", text: "Shoot down 5 planes", stat: "killed", goal: 5, coins: 250},
        {id: "kills15", text: "Shoot down 15 planes", stat: "killed", goal: 15, coins: 600},
        {id: "fly5", text: "Fly for 5 minutes", stat: "flySeconds", goal: 300, coins: 200, time: true},
        {id: "fly15", text: "Fly for 15 minutes", stat: "flySeconds", goal: 900, coins: 500, time: true},
        {id: "mp1", text: "Play an Online Mode session", stat: "onlineMatches", goal: 1, coins: 300},
        {id: "matches3", text: "Play 3 sessions", stat: "matches", goal: 3, coins: 250},
        {id: "missiles10", text: "Fire 10 missiles", stat: "missiles", goal: 10, coins: 200},
        {id: "hits50", text: "Land 50 hits with your gun", stat: "hits", goal: 50, coins: 250},
        {id: "cows3", text: "Hit 3 cows (oops)", stat: "cowKilled", goal: 3, coins: 150},
        {id: "streak3", text: "Get a 3 score streak", stat: "streak", goal: 3, coins: 400, max: true},
        {id: "streak5", text: "Get a 5 score streak", stat: "streak", goal: 5, coins: 800, max: true},
        {id: "df5", text: "Shoot down 5 planes in Flight Sessions", stat: "dfKills", goal: 5, coins: 450},
        {id: "dfmatch", text: "Play a Flight Session", stat: "dfMatches", goal: 1, coins: 250},
        {id: "dfmissile3", text: "Get 3 missile eliminations in Flight Sessions", stat: "dfMissileKills", goal: 3, coins: 450},
        {id: "dfflare2", text: "Dodge 2 missiles with countermeasures in Flight Sessions", stat: "dfFlareSaves", goal: 2, coins: 400},
    ];
    const WEEKLY = [
        {id: "w-kills75", text: "Shoot down 75 planes", stat: "killed", goal: 75, coins: 2500},
        {id: "w-fly60", text: "Fly for 1 hour", stat: "flySeconds", goal: 3600, coins: 2000, time: true},
        {id: "w-mp5", text: "Play 5 Online Mode sessions", stat: "onlineMatches", goal: 5, coins: 2000},
        {id: "w-matches15", text: "Play 15 sessions", stat: "matches", goal: 15, coins: 1800},
        {id: "w-hits500", text: "Land 500 hits", stat: "hits", goal: 500, coins: 2000},
        {id: "w-streak8", text: "Get an 8 score streak", stat: "streak", goal: 8, coins: 3000, max: true},
        {id: "w-df30", text: "Shoot down 30 planes in Flight Sessions", stat: "dfKills", goal: 30, coins: 3000},
        {id: "w-dfwin3", text: "Win 3 Team Flight sessions", stat: "dfWins", goal: 3, coins: 3000},
        {id: "w-dfmissile10", text: "Get 10 missile eliminations in Flight Sessions", stat: "dfMissileKills", goal: 10, coins: 2500},
        {id: "w-dfgun15", text: "Get 15 gun eliminations in Flight Sessions", stat: "dfGunKills", goal: 15, coins: 2500},
    ];
    const ALL = DAILY.concat(WEEKLY);
    for (const q of ALL) q.xp = Math.round(q.coins / 2);
    let el, state, tab = "daily";

    function dateKey(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function today() {
        return dateKey(new Date());
    }

    function week() {
        const d = new Date();
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return dateKey(d);
    }

    function pick(pool, key, n) {
        let seed = [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
        const rest = pool.slice(), out = [];
        while (out.length < n && rest.length) {
            seed = (seed * 1103515245 + 12345) >>> 0;
            out.push(rest.splice(seed % rest.length, 1)[0]);
        }
        return out;
    }

    function stats() {
        return window.BitStats && window.BitStats.get();
    }

    function fresh(pool, key, s) {
        return pick(pool, key, 3).map(q => ({id: q.id, base: q.max ? 0 : (s[q.stat] || 0), best: 0, claimed: false}));
    }

    function load() {
        try {
            state = JSON.parse(localStorage.getItem(KEY) || "null");
        } catch (e) {
            state = null;
        }
        const s = stats();
        if (!s) return state;
        state = state || {};
        let changed = false;
        if (state.date !== today() || !Array.isArray(state.list)) {
            Object.assign(state, {date: today(), list: fresh(DAILY, today(), s)});
            changed = true;
        }
        if (state.week !== week() || !Array.isArray(state.weekly)) {
            Object.assign(state, {week: week(), weekly: fresh(WEEKLY, "w" + week(), s)});
            changed = true;
        }
        if (changed) save();
        return state;
    }

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {}
    }

    function progressOf(entries, s) {
        return entries.map(q => {
            const def = ALL.find(x => x.id === q.id);
            if (!def) return null;
            if (def.max) q.best = Math.max(q.best || 0, s[def.stat] || 0);
            const progress = Math.min(def.goal, def.max ? q.best : (s[def.stat] || 0) - q.base);
            return Object.assign({}, def, {progress: Math.max(0, progress), done: progress >= def.goal, claimed: q.claimed});
        }).filter(Boolean);
    }

    function list(which = "daily") {
        const s = stats();
        if (!load() || !s) return [];
        if (which === "weekly") return progressOf(state.weekly, s);
        if (which === "all") return progressOf(state.list, s).concat(progressOf(state.weekly, s));
        return progressOf(state.list, s);
    }

    function claim(id) {
        const q = list("all").find(x => x.id === id);
        if (!q || !q.done || q.claimed) return;
        const entry = state.list.concat(state.weekly).find(x => x.id === id);
        entry.claimed = true;
        save();
        window.BitShop && window.BitShop.addCoins(q.coins);
        window.BitStats && window.BitStats.addEarned(q.coins);
        window.BitProgress && window.BitProgress.addXp(q.xp, "quest complete");
        render();
    }

    function fmt(q, v) {
        if (!q.time) return String(v);
        return v >= 3600 ? `${Math.floor(v / 3600)}h ${Math.floor((v % 3600) / 60)}m` : `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
    }

    function render() {
        const all = list("all");
        const dot = document.querySelector(".open-quests .nav-dot");
        if (dot) dot.hidden = !all.some(q => q.done && !q.claimed);
        if (!el || el.hidden) return;
        const quests = tab === "weekly" ? list("weekly") : list("daily");
        el.querySelectorAll(".set-tab").forEach(b => {
            b.classList.toggle("active", b.dataset.tab === tab);
            const ready = list(b.dataset.tab).some(q => q.done && !q.claimed);
            b.querySelector("i").hidden = !ready;
        });
        el.querySelector(".quest-list").innerHTML = quests.length ? quests.map(q => `
            <div class="quest${q.done ? " done" : ""}${q.claimed ? " claimed" : ""}">
                <div class="quest-main"><b>${q.text}</b>
                    <div class="quest-bar"><span style="width: ${100 * q.progress / q.goal}%"></span></div>
                    <small>${fmt(q, q.progress)} / ${fmt(q, q.goal)} · +${q.xp} XP</small></div>
                ${q.claimed ? `<span class="quest-claimed">Claimed ✓</span>`
                    : `<button type="button" class="btn quest-claim" data-quest="${q.id}" ${q.done ? "" : "disabled"}>${q.coins.toLocaleString()} <i class="coin"></i></button>`}
            </div>`).join("") : `<p class="shop-note">Quests are loading…</p>`;
        let note;
        if (tab === "weekly") {
            const end = new Date(week() + "T00:00:00");
            end.setDate(end.getDate() + 7);
            const days = Math.max(1, Math.ceil((end - new Date()) / 86400000));
            note = `New weekly quests in ${days} day${days === 1 ? "" : "s"}`;
        } else {
            const end = new Date();
            end.setHours(24, 0, 0, 0);
            const hours = Math.max(1, Math.ceil((end - new Date()) / 3600000));
            note = `New quests in ${hours} hour${hours === 1 ? "" : "s"}`;
        }
        el.querySelector(".quest-reset").textContent = note;
    }

    function init() {
        el = document.createElement("div");
        el.className = "quests panel-backdrop";
        el.hidden = true;
        el.innerHTML = `<div class="panel" role="dialog" aria-label="Quests">
            <div class="shop-header"><h2>Quests</h2><button type="button" class="close-shop quest-close" aria-label="Close">×</button></div>
            <div class="set-tabs">
                <button type="button" class="set-tab" data-tab="daily">Daily <i class="nav-dot" hidden></i></button>
                <button type="button" class="set-tab" data-tab="weekly">Weekly <i class="nav-dot" hidden></i></button>
            </div>
            <p class="shop-note quest-reset"></p>
            <div class="quest-list"></div>
        </div>`;
        document.body.appendChild(el);
        el.addEventListener("click", ev => {
            if (ev.target === el || ev.target.closest(".quest-close")) el.hidden = true;
            const t = ev.target.closest(".set-tab");
            if (t) {
                tab = t.dataset.tab;
                render();
            }
            const b = ev.target.closest(".quest-claim");
            if (b) claim(b.dataset.quest);
        });
        document.addEventListener("keydown", ev => ev.key === "Escape" && (el.hidden = true));
        const btn = document.querySelector(".open-quests");
        if (btn) btn.addEventListener("click", () => {
            el.hidden = false;
            render();
        });
        setInterval(render, 2000);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    return {list, claim, show: (t) => ((tab = t || tab), (el.hidden = false), render()), pool: DAILY, weeklyPool: WEEKLY};
})();
