// Daily reward: free coins the first time you open the activity each day.
// Coming back on the next day grows a 7-day streak (day 7 pays the most);
// missing a day starts over at day 1.
window.BitDaily = (function () {
    const KEY = "daily";
    const REWARDS = [100, 150, 200, 300, 400, 500, 1000];
    let el;

    function load() {
        try {
            return Object.assign({last: "", streak: 0, best: 0}, JSON.parse(localStorage.getItem(KEY) || "{}"));
        } catch (e) {
            return {last: "", streak: 0, best: 0};
        }
    }

    function save(d) {
        try {
            localStorage.setItem(KEY, JSON.stringify(d));
        } catch (e) {}
    }

    // Local calendar dates, e.g. "2026-10-03".
    function dateKey(offsetDays = 0) {
        const d = new Date();
        d.setDate(d.getDate() + offsetDays);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    // What claiming today would give (null if already claimed today).
    function today() {
        const d = load();
        if (d.last === dateKey()) return null;
        const streak = d.last === dateKey(-1) ? d.streak + 1 : 1;
        const day = ((streak - 1) % 7) + 1;
        return {streak, day, coins: REWARDS[day - 1]};
    }

    function claim() {
        const t = today();
        if (!t) return null;
        const d = load();
        save({last: dateKey(), streak: t.streak, best: Math.max(d.best || 0, t.streak)});
        if (window.BitShop) window.BitShop.addCoins(t.coins);
        if (window.BitStats) window.BitStats.addEarned(t.coins);
        return t;
    }

    function render(t) {
        el.querySelector(".daily-days").innerHTML = REWARDS.map((coins, i) => {
            const day = i + 1, state = day < t.day ? "done" : day === t.day ? "today" : "";
            return `<div class="daily-day ${state}"><small>Day ${day}</small><b>${coins.toLocaleString()}</b><i class="coin"></i>${day < t.day ? "<span>✓</span>" : ""}</div>`;
        }).join("");
        el.querySelector(".daily-title").textContent = t.streak > 1 ? `Daily reward · ${t.streak} day streak!` : "Daily reward";
        el.querySelector(".daily-claim").innerHTML = `Claim ${t.coins.toLocaleString()} <i class="coin"></i>`;
    }

    // Show the reward window on the start screen if today's reward is waiting.
    function offer() {
        const t = today();
        const ui = document.querySelector(".ui");
        if (!t || !el || (ui && ui.style.display === "block")) return false;
        render(t);
        el.hidden = false;
        return true;
    }

    function init() {
        el = document.createElement("div");
        el.className = "daily panel-backdrop";
        el.hidden = true;
        el.innerHTML = `<div class="panel daily-panel" role="dialog" aria-label="Daily reward">
            <h2 class="daily-title">Daily reward</h2>
            <p class="shop-note">Come back every day for bigger rewards. Day 7 pays the most!</p>
            <div class="daily-days"></div>
            <button type="button" class="btn daily-claim">Claim</button>
        </div>`;
        document.body.appendChild(el);
        el.querySelector(".daily-claim").addEventListener("click", () => {
            const t = claim();
            el.querySelector(".daily-claim").disabled = true;
            if (t) el.querySelector(".daily-title").textContent = `+${t.coins.toLocaleString()} coins!`;
            setTimeout(() => {
                el.hidden = true;
                el.querySelector(".daily-claim").disabled = false;
            }, 900);
        });
        setTimeout(offer, 600);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    return {
        today, claim, offer, rewards: REWARDS,
        status: () => Object.assign(load(), {next: today()}),
        // Console: make today's reward claimable again (for testing).
        reset: () => {
            const d = load();
            save(Object.assign(d, {last: d.last === dateKey() ? dateKey(-1) : d.last}));
        },
    };
})();
