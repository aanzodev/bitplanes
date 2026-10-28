// Daily quests: three new goals every day (same three for everyone on a
// given date), tracked from your stats. Finish one and claim its coins in
// the Quests tab of the lobby.
window.BitQuests = (function () {
    const KEY = "quests";
    const PER_DAY = 3;
    // stat: a counter in BitStats; "max": reach the value once (e.g. a streak).
    const POOL = [
        {id: "kills5", text: "Shoot down 5 planes", stat: "killed", goal: 5, coins: 250},
        {id: "kills15", text: "Shoot down 15 planes", stat: "killed", goal: 15, coins: 600},
        {id: "fly5", text: "Fly for 5 minutes", stat: "flySeconds", goal: 300, coins: 200, time: true},
        {id: "fly15", text: "Fly for 15 minutes", stat: "flySeconds", goal: 900, coins: 500, time: true},
        {id: "mp1", text: "Play a Multiplayer match", stat: "onlineMatches", goal: 1, coins: 300},
        {id: "matches3", text: "Play 3 matches", stat: "matches", goal: 3, coins: 250},
        {id: "missiles10", text: "Fire 10 missiles", stat: "missiles", goal: 10, coins: 200},
        {id: "hits50", text: "Land 50 hits with your gun", stat: "hits", goal: 50, coins: 250},
        {id: "cows3", text: "Hit 3 cows (oops)", stat: "cowKilled", goal: 3, coins: 150},
        {id: "streak3", text: "Get a 3 kill streak", stat: "streak", goal: 3, coins: 400, max: true},
        {id: "streak5", text: "Get a 5 kill streak", stat: "streak", goal: 5, coins: 800, max: true},
    ];
    let el, state;

    function today() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    // Pick today's quests from the date, so they're the same all day.
    function pick(date) {
        let seed = [...date].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
        const pool = POOL.slice(), out = [];
        while (out.length < PER_DAY && pool.length) {
            seed = (seed * 1103515245 + 12345) >>> 0;
            out.push(pool.splice(seed % pool.length, 1)[0]);
        }
        return out;
    }

    function stats() {
        return window.BitStats && window.BitStats.get();
    }

    function load() {
        try {
            state = JSON.parse(localStorage.getItem(KEY) || "null");
        } catch (e) {
            state = null;
        }
        const s = stats();
        if (!s) return state;
        if (!state || state.date !== today()) {
            // New day: new quests, counting from your stats right now.
            state = {date: today(), list: pick(today()).map(q => ({id: q.id, base: q.max ? 0 : (s[q.stat] || 0), best: 0, claimed: false}))};
            save();
        }
        return state;
    }

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {}
    }

    // Each quest with its progress.
    function list() {
        const s = stats();
        if (!load() || !s) return [];
        return state.list.map(q => {
            const def = POOL.find(x => x.id === q.id);
            if (!def) return null;
            if (def.max) q.best = Math.max(q.best || 0, s[def.stat] || 0);
            const progress = Math.min(def.goal, def.max ? q.best : (s[def.stat] || 0) - q.base);
            return Object.assign({}, def, {progress: Math.max(0, progress), done: progress >= def.goal, claimed: q.claimed});
        }).filter(Boolean);
    }

    function claim(id) {
        const q = list().find(x => x.id === id);
        if (!q || !q.done || q.claimed) return;
        state.list.find(x => x.id === id).claimed = true;
        save();
        window.BitShop && window.BitShop.addCoins(q.coins);
        window.BitStats && window.BitStats.addEarned(q.coins);
        render();
    }

    function fmt(q, v) {
        return q.time ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}` : String(v);
    }

    function render() {
        const quests = list();
        // Yellow dot on the Quests tab when a reward is waiting.
        const dot = document.querySelector(".open-quests .nav-dot");
        if (dot) dot.hidden = !quests.some(q => q.done && !q.claimed);
        if (!el || el.hidden) return;
        const end = new Date();
        end.setHours(24, 0, 0, 0);
        const hours = Math.max(1, Math.ceil((end - new Date()) / 3600000));
        el.querySelector(".quest-list").innerHTML = quests.length ? quests.map(q => `
            <div class="quest${q.done ? " done" : ""}${q.claimed ? " claimed" : ""}">
                <div class="quest-main"><b>${q.text}</b>
                    <div class="quest-bar"><span style="width: ${100 * q.progress / q.goal}%"></span></div>
                    <small>${fmt(q, q.progress)} / ${fmt(q, q.goal)}</small></div>
                ${q.claimed ? `<span class="quest-claimed">Claimed ✓</span>`
                    : `<button type="button" class="btn quest-claim" data-quest="${q.id}" ${q.done ? "" : "disabled"}>${q.coins} <i class="coin"></i></button>`}
            </div>`).join("") : `<p class="shop-note">Quests are loading…</p>`;
        el.querySelector(".quest-reset").textContent = `New quests in ${hours} hour${hours === 1 ? "" : "s"}`;
    }

    function init() {
        el = document.createElement("div");
        el.className = "quests panel-backdrop";
        el.hidden = true;
        el.innerHTML = `<div class="panel" role="dialog" aria-label="Quests">
            <div class="shop-header"><h2>Daily quests</h2><button type="button" class="close-shop quest-close" aria-label="Close">×</button></div>
            <p class="shop-note quest-reset"></p>
            <div class="quest-list"></div>
        </div>`;
        document.body.appendChild(el);
        el.addEventListener("click", ev => {
            if (ev.target === el || ev.target.closest(".quest-close")) el.hidden = true;
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

    return {list, claim, show: () => ((el.hidden = false), render()), pool: POOL};
})();
