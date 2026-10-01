// Built-in activity console. Open/close with Ctrl+Shift+K (or the ` key).
// Type "help" for the list of commands. ↑/↓ = history, Tab = complete.
(function () {
    const MAX_LINES = 200;
    let open = false, history = [], hpos = 0, el, out, input, fpsBox;

    // ------------------------------------------------------------- helpers

    function print(text, kind = "") {
        const line = document.createElement("div");
        line.className = "con-line " + kind;
        line.textContent = text;
        out.appendChild(line);
        while (out.children.length > MAX_LINES) out.firstChild.remove();
        out.scrollTop = out.scrollHeight;
    }

    function shop() {
        return window.BitShop;
    }

    function online() {
        return window.BitOnline && window.BitOnline.role;
    }

    function inActivity() {
        const ui = document.querySelector(".ui");
        return ui && ui.style.display === "block";
    }

    // The plane you are flying in single player.
    function myPlane() {
        const p = window.BitEngine && window.BitEngine.player;
        return p && p.hasPlane();
    }

    // Cheats only make sense in your own single player activity.
    function needSinglePlayer() {
        if (online()) throw new Error("Not available in online activities.");
        if (!inActivity()) throw new Error("Start an activity first.");
        const plane = myPlane();
        if (!plane) throw new Error("You don't have a plane right now.");
        return plane;
    }

    function findPlane(arg) {
        const q = String(arg || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return shop().planes.find(p => p.id === q || p.name.toLowerCase().replace(/[^a-z0-9]/g, "") === q);
    }

    function number(arg, name) {
        const n = Number(arg);
        if (!Number.isFinite(n)) throw new Error(`Usage: ${name} <number>`);
        return n;
    }

    // ------------------------------------------------------------ commands

    const COMMANDS = {
        help: {
            help: "List commands",
            run() {
                Object.entries(COMMANDS).forEach(([name, c]) => print(`${(name + " " + (c.args || "")).padEnd(22)} ${c.help}`, "dim"));
            },
        },
        clear: {help: "Clear the console", run: () => (out.innerHTML = "")},
        coins: {help: "Show your coins", run: () => print(`${shop().state().coins.toLocaleString()} coins`)},
        addcoins: {
            args: "<n>", help: "Add coins",
            run: a => print(`Coins: ${shop().addCoins(number(a[0], "addcoins")).toLocaleString()}`, "ok"),
        },
        setcoins: {
            args: "<n>", help: "Set your coins",
            run: a => print(`Coins: ${shop().setCoins(number(a[0], "setcoins")).toLocaleString()}`, "ok"),
        },
        planes: {
            help: "List planes (★ = special, ◆ = exclusive, ✓ = owned)",
            run() {
                const st = shop().state();
                shop().planes.forEach(p => print(`${st.owned.includes(p.id) ? "✓" : " "} ${p.special ? "★" : p.exclusive ? "◆" : " "} ${p.id.padEnd(9)} ${p.name.padEnd(16)} ${p.price.toLocaleString()}`, "dim"));
            },
        },
        give: {
            args: "<plane>", help: "Own a plane for free",
            run(a) {
                const p = findPlane(a[0]);
                if (!p) throw new Error("Unknown plane. Type: planes");
                shop().give(p.id);
                print(`You now own the ${p.name}.`, "ok");
            },
        },
        plane: {
            args: "<plane>", help: "Fly a plane you own (from your next plane)",
            run(a) {
                const p = findPlane(a[0]);
                if (!p) throw new Error("Unknown plane. Type: planes");
                if (!shop().state().owned.includes(p.id)) throw new Error(`You don't own the ${p.name}. Try: give ${p.id}`);
                shop().selectPlane(p.id);
                if (online() === "guest") window.BitOnline.sendToHost({t: "loadout", l: shop().loadout()});
                print(`Selected the ${p.name}.`, "ok");
            },
        },
        paint: {
            args: "<color>", help: "Paint your plane (red, blue, black, factory…)",
            run(a) {
                const name = String(a[0] || "").toLowerCase();
                const paint = shop().paints.find(x => x.name.toLowerCase() === name);
                if (!paint) throw new Error("Colors: " + shop().paints.map(x => x.name.toLowerCase()).join(", "));
                window.BitPause.paint(paint.color);
                print(`Painted your ${shop().selected().name} ${paint.name.toLowerCase()}.`, "ok");
            },
        },
        unlockall: {help: "Own every plane, max every upgrade", run: () => print(shop().unlockAll(), "ok")},
        reset: {help: "Reset coins, planes and upgrades", run: () => print(shop().resetShop(), "ok")},
        heal: {
            help: "Repair your plane (single player)",
            run() {
                const plane = needSinglePlayer();
                plane.life = Math.max(plane.life, plane.maxLife || window.BitEngine.consts.h);
                print("Plane repaired.", "ok");
            },
        },
        refill: {
            help: "Full ammo, missiles and flares (single player)",
            run() {
                const plane = needSinglePlayer();
                plane.ammo = plane.maxAmmo;
                plane.missiles = plane.maxMissiles;
                if (plane.maxFlares) plane.flares = plane.maxFlares;
                window.BitEngine.cockpit(plane);
                print("Reloaded.", "ok");
            },
        },
        god: {
            help: "Toggle: bullets can't shoot you down (single player)",
            run() {
                const plane = needSinglePlayer();
                plane.godMode = !plane.godMode;
                if (plane.godMode) {
                    plane.savedLife = plane.life;
                    plane.life = 1e9;
                } else plane.life = plane.maxLife || window.BitEngine.consts.h;
                print(`God mode ${plane.godMode ? "on" : "off"} (until your next plane).`, "ok");
            },
        },
        maps: {help: "List maps", run: () => window.BitMaps.list.forEach(m => print(`${m.id.padEnd(12)} ${m.name}`, "dim"))},
        map: {
            args: "<map>", help: "Switch map now (single player)",
            run(a) {
                needSinglePlayer();
                const def = window.BitMaps.list.find(m => m.id === String(a[0] || "").toLowerCase());
                if (!def) throw new Error("Maps: " + window.BitMaps.list.map(m => m.id).join(", "));
                const W = window.BitEngine.world;
                W.map = window.BitMaps.get(def.id);
                W.groundObjects.clear();
                W.clouds.length = 0;
                window.BitEngine.decorate(W);
                window.BitMaps.announce(W.map);
                print(`Map: ${def.name}`, "ok");
            },
        },
        mute: {help: "Sound off", run: () => (window.BitSound.setMuted(true), print("Sound off.", "ok"))},
        unmute: {help: "Sound on", run: () => (window.BitSound.setMuted(false), print("Sound on.", "ok"))},
        fps: {help: "Toggle the FPS counter", run: () => print(`FPS counter ${toggleFps() ? "on" : "off"}.`, "ok")},
        room: {
            help: "Show the online room code",
            run() {
                const b = document.querySelector(".room-banner");
                print(online() && b ? b.textContent : "Not in an online room.");
            },
        },
        ping: {
            help: "Your ping to the host (guests)",
            run() {
                const g = window.BitOnline && window.BitOnline.guestState;
                print(online() === "guest" && g && typeof g.rtt === "number" ? `${Math.round(g.rtt)} ms` : "Only players who joined a room have a ping.");
            },
        },
        js: {
            args: "<code>", help: "Run JavaScript",
            run(a, raw) {
                const code = raw.replace(/^\s*js\s+/i, "");
                // eslint-disable-next-line no-eval
                const result = (0, eval)(code);
                print(String(result instanceof Object ? JSON.stringify(result) ?? result : result), "dim");
            },
        },
    };

    function run(raw) {
        const text = raw.trim();
        if (!text) return;
        print("> " + text, "cmd");
        history.push(text);
        if (history.length > 50) history.shift();
        hpos = history.length;
        const [name, ...args] = text.split(/\s+/);
        const cmd = COMMANDS[name.toLowerCase()];
        if (!cmd) return print(`Unknown command "${name}". Type: help`, "err");
        try {
            cmd.run(args, text);
        } catch (e) {
            print(e.message, "err");
        }
    }

    // ----------------------------------------------------------------- fps

    let fpsOn = false;

    function toggleFps() {
        fpsOn = !fpsOn;
        fpsBox.hidden = !fpsOn;
        if (fpsOn) {
            let frames = 0, last = performance.now();
            (function tick(t) {
                if (!fpsOn) return;
                frames++;
                if (t - last >= 500) {
                    fpsBox.textContent = Math.round(frames * 1000 / (t - last)) + " FPS";
                    frames = 0;
                    last = t;
                }
                requestAnimationFrame(tick);
            })(last);
        }
        return fpsOn;
    }

    // ---------------------------------------------------------- open/close

    function show() {
        open = true;
        el.hidden = false;
        input.focus();
    }

    function hide() {
        open = false;
        el.hidden = true;
        input.blur();
    }

    function complete() {
        const v = input.value.trim().toLowerCase();
        const matches = Object.keys(COMMANDS).filter(c => c.startsWith(v));
        if (matches.length === 1) input.value = matches[0] + " ";
        else if (matches.length > 1) print(matches.join("  "), "dim");
    }

    function init() {
        el = document.createElement("div");
        el.className = "activity-console";
        el.hidden = true;
        el.innerHTML = `<div class="con-out"></div><div class="con-in"><span>&gt;</span><input type="text" spellcheck="false" autocomplete="off" aria-label="Console command"></div>`;
        document.body.appendChild(el);
        out = el.querySelector(".con-out");
        input = el.querySelector("input");
        fpsBox = document.createElement("div");
        fpsBox.className = "fps-counter";
        fpsBox.hidden = true;
        document.body.appendChild(fpsBox);
        print('Bit Planes console. Type "help". Ctrl+Shift+K or ` to close.', "dim");

        // Registered first on window (capture), so it runs before the activity's keys
        // and the pause menu.
        window.addEventListener("keydown", ev => {
            const toggle = (ev.code === "KeyK" && ev.ctrlKey && ev.shiftKey) || (ev.code === "Backquote" && !ev.ctrlKey && !ev.altKey);
            if (toggle) {
                ev.preventDefault();
                ev.stopImmediatePropagation();
                open ? hide() : show();
                return;
            }
            if (!open) return;
            // While open: keys type into the console, never fly the plane.
            ev.stopImmediatePropagation();
            if (ev.code === "Escape") {
                ev.preventDefault();
                hide();
            } else if (ev.code === "Enter") {
                ev.preventDefault();
                run(input.value);
                input.value = "";
            } else if (ev.code === "ArrowUp" || ev.code === "ArrowDown") {
                ev.preventDefault();
                hpos = Math.max(0, Math.min(history.length, hpos + (ev.code === "ArrowUp" ? -1 : 1)));
                input.value = history[hpos] || "";
            } else if (ev.code === "Tab") {
                ev.preventDefault();
                complete();
            }
            if (document.activeElement !== input) input.focus();
        }, true);
    }

    window.BitConsole = {run, show, hide, isOpen: () => open};

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
