window.BitProgress = (function () {
    const KEY = "progress";
    const MAX_LEVEL = 100;
    const XP_FOR = {killed: 100, hits: 2, matches: 50, flySeconds: 1 / 6};
    const UPGRADE_TIERS = [10, 25, 50];

    let state = {xp: 0, seen: null, rewardedLevel: 1};
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
            const tier = UPGRADE_TIERS.includes(after) ? "<br><small>New upgrade levels unlocked in the Aircraft Market!</small>" : "";
            toast(`<span class="toast-big">LEVEL UP!</span> Level ${after}${coins ? ` · +${coins.toLocaleString()} <i class="coin"></i>` : ""}${tier}`, "level", 4200);
            window.BitSoundFx && window.BitSoundFx.fanfare();
        }
        save();
    }

    function tick() {
        const s = window.BitStats && window.BitStats.get();
        if (!s) return;
        const now = {};
        for (const k of Object.keys(XP_FOR)) now[k] = s[k] || 0;
        if (!state.seen) {
            state.seen = Object.fromEntries(Object.keys(XP_FOR).map(k => [k, 0]));
        }
        let xp = 0;
        for (const k of Object.keys(XP_FOR)) {
            const d = now[k] - (state.seen[k] || 0);
            if (d > 0) xp += d * XP_FOR[k];
            if (d !== 0) state.seen[k] = now[k];
        }
        state.carry = (state.carry || 0) + xp;
        if (state.carry >= 1) {
            const whole = Math.floor(state.carry);
            state.carry -= whole;
            addXp(whole);
        } else if (xp) save();
    }


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


    function renderBadge() {
        const info = levelInfo();
        document.querySelectorAll(".lobby-level").forEach(el => {
            el.querySelector("b").textContent = info.level;
            el.querySelector(".level-fill").style.width = Math.round(info.frac * 100) + "%";
            el.title = info.need ? `Pilot Level ${info.level} · ${info.into.toLocaleString()} / ${info.need.toLocaleString()} XP to level ${info.level + 1}` : `Pilot Level ${info.level} (max)`;
        });
    }

    function init() {
        listeners.push(renderBadge);
        renderBadge();
        setInterval(tick, 1000);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    return {
        addXp, levelInfo, needFor, levelReward, upgradeBonus, nextTier, tiers: UPGRADE_TIERS,
        toast, onChange: fn => listeners.push(fn),
        xp: () => state.xp,
    };
})();
