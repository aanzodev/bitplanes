// Career progress: XP and levels, achievements, and the pop-up notices
// ("LEVEL UP!", "Achievement unlocked"). XP comes from your stats as they
// grow (kills, hits, matches, time flying) in Bit Planes and in Dogfights,
// plus bonuses (quests, achievements, Dogfights medals). Every level pays
// coins, and levels 10, 25 and 50 raise every Hangar upgrade's top level by one.
window.BitProgress = (function () {
    const KEY = "progress";
    const MAX_LEVEL = 100;
    // XP for stats: per kill, per hit, per match, per 6 seconds in the air.
    const XP_FOR = {killed: 100, hits: 2, matches: 50, flySeconds: 1 / 6};
    const UPGRADE_TIERS = [10, 25, 50];

    let state = {xp: 0, seen: null, unlocked: {}, rewardedLevel: 1};
    try {
        state = Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}"));
    } catch (e) {}
    const listeners = [];

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {}
        listeners.forEach(fn => {
            try {
                fn();
            } catch (e) {}
        });
    }

    // ------------------------------------------------------------- levels

    // XP from level n to n + 1.
    function needFor(n) {
        return 400 + 150 * (n - 1);
    }

    function levelInfo(xp = state.xp) {
        let level = 1, left = Math.floor(xp);
        while (level < MAX_LEVEL && left >= needFor(level)) {
            left -= needFor(level);
            level++;
        }
        const need = level < MAX_LEVEL ? needFor(level) : 0;
        return {level, into: left, need, frac: need ? left / need : 1, xp: Math.floor(xp)};
    }

    function levelReward(n) {
        return 100 * n + (n % 5 === 0 ? 500 : 0);
    }

    // How many extra upgrade levels your player level has unlocked.
    function upgradeBonus() {
        const l = levelInfo().level;
        return UPGRADE_TIERS.filter(t => l >= t).length;
    }

    function nextTier() {
        const l = levelInfo().level;
        return UPGRADE_TIERS.find(t => l < t) || null;
    }

    function addXp(n, reason) {
        n = Math.max(0, Math.round(n || 0));
        if (!n) return;
        const before = levelInfo().level;
        state.xp += n;
        const after = levelInfo().level;
        if (reason) toast(`<b>+${n} XP</b> ${reason}`, "xp", 1600);
        if (after > before) {
            let coins = 0;
            for (let l = Math.max(before, state.rewardedLevel) + 1; l <= after; l++) coins += levelReward(l);
            state.rewardedLevel = Math.max(state.rewardedLevel, after);
            if (coins) {
                window.BitShop && window.BitShop.addCoins(coins);
                window.BitStats && window.BitStats.addEarned(coins);
            }
            const tier = UPGRADE_TIERS.includes(after) ? "<br><small>New upgrade levels unlocked in the Hangar!</small>" : "";
            toast(`<span class="toast-big">LEVEL UP!</span> Level ${after}${coins ? ` · +${coins.toLocaleString()} <i class="coin"></i>` : ""}${tier}`, "level", 4200);
            window.BitSoundFx && window.BitSoundFx.fanfare();
        }
        save();
    }

    // Watch the stats and turn their growth into XP.
    function tick() {
        const s = window.BitStats && window.BitStats.get();
        if (!s) return;
        const now = {};
        for (const k of Object.keys(XP_FOR)) now[k] = s[k] || 0;
        if (!state.seen) {
            // First time: your past also counts, once.
            state.seen = Object.fromEntries(Object.keys(XP_FOR).map(k => [k, 0]));
        }
        let xp = 0;
        for (const k of Object.keys(XP_FOR)) {
            const d = now[k] - (state.seen[k] || 0);
            // Stats can be reset; only growth counts.
            if (d > 0) xp += d * XP_FOR[k];
            if (d !== 0) state.seen[k] = now[k];
        }
        state.carry = (state.carry || 0) + xp;
        if (state.carry >= 1) {
            const whole = Math.floor(state.carry);
            state.carry -= whole;
            addXp(whole);
        } else if (xp) save();
        checkAchievements();
    }

    // -------------------------------------------------------- achievements

    function st(k) {
        const s = window.BitStats && window.BitStats.get();
        return (s && s[k]) || 0;
    }

    function owned(kind) {
        if (kind === "planes") return window.BitShop ? window.BitShop.state().owned.length : 0;
        if (kind === "skins") return window.BitSkins && window.BitSkins.ownedCount ? window.BitSkins.ownedCount() : 0;
        if (kind === "friends") return window.BitSocial ? window.BitSocial.friendCount() : 0;
        if (kind === "daily") return window.BitDaily ? window.BitDaily.status().best || 0 : 0;
        return 0;
    }

    // value(): how far you are; goal: what it takes.
    const ACHIEVEMENTS = [
        {id: "first", group: "Combat", icon: "🎯", name: "First Blood", desc: "Shoot down your first plane", value: () => st("killed"), goal: 1, coins: 200, xp: 100},
        {id: "k50", group: "Combat", icon: "✈", name: "Ace", desc: "Shoot down 50 planes", value: () => st("killed"), goal: 50, coins: 1000, xp: 500},
        {id: "k250", group: "Combat", icon: "🎖", name: "Double Ace", desc: "Shoot down 250 planes", value: () => st("killed"), goal: 250, coins: 3000, xp: 1500},
        {id: "k1000", group: "Combat", icon: "🏆", name: "Legend of the Skies", desc: "Shoot down 1,000 planes", value: () => st("killed"), goal: 1000, coins: 10000, xp: 5000},
        {id: "s5", group: "Combat", icon: "🔥", name: "On Fire", desc: "Get a 5 kill streak", value: () => st("bestStreak"), goal: 5, coins: 600, xp: 300},
        {id: "s10", group: "Combat", icon: "☄", name: "Unstoppable", desc: "Get a 10 kill streak", value: () => st("bestStreak"), goal: 10, coins: 2000, xp: 1000},
        {id: "s20", group: "Combat", icon: "👑", name: "Untouchable", desc: "Get a 20 kill streak", value: () => st("bestStreak"), goal: 20, coins: 6000, xp: 3000},
        {id: "hits500", group: "Combat", icon: "🔫", name: "Sharpshooter", desc: "Land 500 hits with your guns", value: () => st("hits"), goal: 500, coins: 800, xp: 400},
        {id: "hits5000", group: "Combat", icon: "💥", name: "Bullet Storm", desc: "Land 5,000 hits", value: () => st("hits"), goal: 5000, coins: 4000, xp: 2000},
        {id: "m100", group: "Combat", icon: "🚀", name: "Rocket Man", desc: "Fire 100 missiles", value: () => st("missiles"), goal: 100, coins: 800, xp: 400},
        {id: "cow", group: "Combat", icon: "🐄", name: "Moo-ve Out of the Way", desc: "Hit a cow", value: () => st("cowKilled"), goal: 1, coins: 100, xp: 50},
        {id: "cow25", group: "Combat", icon: "🥩", name: "Farmer's Nightmare", desc: "Hit 25 cows", value: () => st("cowKilled"), goal: 25, coins: 500, xp: 250},

        {id: "fly1h", group: "Flying", icon: "⏱", name: "Frequent Flyer", desc: "Fly for 1 hour", value: () => st("flySeconds"), goal: 3600, time: true, coins: 1000, xp: 500},
        {id: "fly10h", group: "Flying", icon: "🌍", name: "Around the World", desc: "Fly for 10 hours", value: () => st("flySeconds"), goal: 36000, time: true, coins: 6000, xp: 3000},
        {id: "matches10", group: "Flying", icon: "🛫", name: "Regular", desc: "Play 10 matches", value: () => st("matches"), goal: 10, coins: 500, xp: 250},
        {id: "matches100", group: "Flying", icon: "🛬", name: "Veteran", desc: "Play 100 matches", value: () => st("matches"), goal: 100, coins: 3000, xp: 1500},
        {id: "mp10", group: "Flying", icon: "🌐", name: "Online Pilot", desc: "Play 10 Multiplayer matches", value: () => st("onlineMatches"), goal: 10, coins: 1500, xp: 750},

        {id: "df1", group: "Dogfights", icon: "🗻", name: "Into the Third Dimension", desc: "Shoot down a plane in Dogfights", value: () => st("dfKills"), goal: 1, coins: 300, xp: 150},
        {id: "df100", group: "Dogfights", icon: "🦅", name: "Top Gun", desc: "Shoot down 100 planes in Dogfights", value: () => st("dfKills"), goal: 100, coins: 4000, xp: 2000},
        {id: "dfm25", group: "Dogfights", icon: "🎇", name: "Fox Two", desc: "25 missile kills in Dogfights", value: () => st("dfMissileKills"), goal: 25, coins: 2000, xp: 1000},
        {id: "dfg50", group: "Dogfights", icon: "🔩", name: "Guns Guns Guns", desc: "50 gun kills in Dogfights", value: () => st("dfGunKills"), goal: 50, coins: 2500, xp: 1200},
        {id: "dff10", group: "Dogfights", icon: "✨", name: "Chaff and Flares", desc: "Dodge 10 missiles with flares", value: () => st("dfFlareSaves"), goal: 10, coins: 1500, xp: 750},
        {id: "dfw1", group: "Dogfights", icon: "🏁", name: "Team Player", desc: "Win a Dogfights team match", value: () => st("dfWins"), goal: 1, coins: 800, xp: 400},
        {id: "dfw10", group: "Dogfights", icon: "🥇", name: "Squadron Leader", desc: "Win 10 Dogfights matches", value: () => st("dfWins"), goal: 10, coins: 4000, xp: 2000},
        {id: "dfmaps", group: "Dogfights", icon: "🗺", name: "World Tour", desc: "Fly every Dogfights map", value: () => Object.keys(st("dfMaps") || {}).length, goal: 6, coins: 2000, xp: 1000},
        {id: "dfeject", group: "Dogfights", icon: "🪂", name: "Punch Out", desc: "Eject from a burning plane", value: () => st("dfEjects"), goal: 1, coins: 300, xp: 150},

        {id: "lv10", group: "Career", icon: "⭐", name: "Rising Star", desc: "Reach level 10", value: () => levelInfo().level, goal: 10, coins: 1000, xp: 0},
        {id: "lv25", group: "Career", icon: "🌟", name: "Seasoned Pilot", desc: "Reach level 25", value: () => levelInfo().level, goal: 25, coins: 3000, xp: 0},
        {id: "lv50", group: "Career", icon: "💫", name: "Living Legend", desc: "Reach level 50", value: () => levelInfo().level, goal: 50, coins: 10000, xp: 0},
        {id: "planes5", group: "Career", icon: "🛩", name: "Collector", desc: "Own 5 planes", value: () => owned("planes"), goal: 5, coins: 800, xp: 400},
        {id: "planes15", group: "Career", icon: "🏭", name: "Air Force", desc: "Own 15 planes", value: () => owned("planes"), goal: 15, coins: 4000, xp: 2000},
        {id: "skins3", group: "Career", icon: "🧑‍✈️", name: "Dress Up", desc: "Own 3 pilot skins", value: () => owned("skins"), goal: 3, coins: 800, xp: 400},
        {id: "daily7", group: "Career", icon: "📅", name: "Every Day", desc: "Reach a 7 day daily reward streak", value: () => owned("daily"), goal: 7, coins: 1500, xp: 750},
        {id: "friend1", group: "Career", icon: "🤝", name: "Wingman", desc: "Add a friend", value: () => owned("friends"), goal: 1, coins: 500, xp: 250},
        {id: "friend5", group: "Career", icon: "👥", name: "Squadron", desc: "Have 5 friends", value: () => owned("friends"), goal: 5, coins: 1500, xp: 750},
    ];

    function achievements() {
        return ACHIEVEMENTS.map(a => {
            let v = 0;
            try {
                v = a.value() || 0;
            } catch (e) {}
            return Object.assign({}, a, {progress: Math.min(a.goal, v), done: !!state.unlocked[a.id], at: state.unlocked[a.id] || 0});
        });
    }

    function checkAchievements() {
        if (!window.BitStats || !window.BitStats.get()) return;
        for (const a of achievements()) {
            if (a.done || a.progress < a.goal) continue;
            state.unlocked[a.id] = Date.now();
            save();
            if (a.coins) {
                window.BitShop && window.BitShop.addCoins(a.coins);
                window.BitStats && window.BitStats.addEarned(a.coins);
            }
            toast(`<span class="toast-icon">${a.icon}</span><span><small>Achievement unlocked</small><b>${a.name}</b>${a.desc} · +${a.coins.toLocaleString()} <i class="coin"></i>${a.xp ? ` +${a.xp} XP` : ""}</span>`, "ach", 4500);
            if (a.xp) addXp(a.xp);
            renderPanel();
        }
    }

    // --------------------------------------------------------------- toasts

    let toasts;

    function toast(html, kind = "", ms = 2500) {
        if (!toasts) {
            toasts = document.createElement("div");
            toasts.className = "toasts";
            document.body.appendChild(toasts);
        }
        const t = document.createElement("div");
        t.className = "toast " + kind;
        t.innerHTML = html;
        toasts.appendChild(t);
        while (toasts.children.length > 4) toasts.firstChild.remove();
        setTimeout(() => t.classList.add("out"), ms);
        setTimeout(() => t.remove(), ms + 600);
    }

    // ------------------------------------------------------------ the panel

    let panel;

    function fmt(a, v) {
        if (!a.time) return Math.floor(v).toLocaleString();
        const h = Math.floor(v / 3600), m = Math.floor((v % 3600) / 60);
        return h ? `${h}h ${m}m` : `${m}m`;
    }

    function renderPanel() {
        if (!panel || panel.hidden) return;
        const list = achievements(), done = list.filter(a => a.done).length;
        const groups = [...new Set(list.map(a => a.group))];
        panel.querySelector(".ach-count").textContent = `${done} / ${list.length} unlocked`;
        panel.querySelector(".ach-body").innerHTML = groups.map(g => `<h3>${g}</h3><div class="ach-grid">${list.filter(a => a.group === g).map(a => `
            <div class="ach${a.done ? " done" : ""}">
                <span class="ach-icon">${a.icon}</span>
                <div><b>${a.name}</b><small>${a.desc}</small>
                    ${a.done ? `<em>Unlocked ✓</em>` : `<div class="quest-bar"><span style="width: ${100 * a.progress / a.goal}%"></span></div><small>${fmt(a, a.progress)} / ${fmt(a, a.goal)}</small>`}</div>
                <span class="ach-reward">${a.coins.toLocaleString()} <i class="coin"></i>${a.xp ? `<br>${a.xp} XP` : ""}</span>
            </div>`).join("")}</div>`).join("");
    }

    // Level badge in the lobby (top right) and the level bar in Stats.
    function renderBadge() {
        const info = levelInfo();
        document.querySelectorAll(".lobby-level").forEach(el => {
            el.querySelector("b").textContent = info.level;
            el.querySelector(".level-fill").style.width = Math.round(info.frac * 100) + "%";
            el.title = info.need ? `Level ${info.level} · ${info.into.toLocaleString()} / ${info.need.toLocaleString()} XP to level ${info.level + 1}` : `Level ${info.level} (max)`;
        });
    }

    function init() {
        panel = document.createElement("div");
        panel.className = "achievements panel-backdrop";
        panel.hidden = true;
        panel.innerHTML = `<div class="panel" role="dialog" aria-label="Achievements">
            <div class="shop-header"><h2>Achievements</h2><span class="ach-count"></span><button type="button" class="close-shop ach-close" aria-label="Close">×</button></div>
            <div class="ach-body"></div>
        </div>`;
        document.body.appendChild(panel);
        panel.addEventListener("click", ev => {
            if (ev.target === panel || ev.target.closest(".ach-close")) panel.hidden = true;
        });
        document.addEventListener("keydown", ev => ev.key === "Escape" && (panel.hidden = true));
        document.querySelectorAll(".open-achievements").forEach(b => b.addEventListener("click", () => {
            panel.hidden = false;
            renderPanel();
        }));
        listeners.push(renderBadge);
        renderBadge();
        setInterval(tick, 1000);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    return {
        addXp, levelInfo, needFor, levelReward, upgradeBonus, nextTier, tiers: UPGRADE_TIERS,
        achievements, toast, onChange: fn => listeners.push(fn),
        show: () => ((panel.hidden = false), renderPanel()),
        xp: () => state.xp,
    };
})();
