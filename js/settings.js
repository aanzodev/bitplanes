window.BitSettings = (function () {
    const KEY = "settings";

    const KEYS_2D = [
        {id: "thrustUp", name: "Speed up", keys: ["ArrowUp", "KeyW"]},
        {id: "thrustDown", name: "Slow down", keys: ["ArrowDown", "KeyS"]},
        {id: "pitchUp", name: "Turn ⟲ (nose up when flying right)", keys: ["ArrowLeft", "KeyA"]},
        {id: "pitchDown", name: "Turn ⟳ (nose down when flying right)", keys: ["ArrowRight", "KeyD"]},
        {id: "fire", name: "Fire the gun", keys: ["Space", ""]},
        {id: "missile", name: "Fire a guided missile", keys: ["KeyX", ""]},
        {id: "flare", name: "Drop countermeasures", keys: ["KeyQ", ""]},
        {id: "eject", name: "Eject / parachute", keys: ["KeyC", ""]},
    ];
    const KEYS_DF = [
        {id: "pitchUp", name: "Pitch: nose up", keys: ["ArrowUp", ""]},
        {id: "pitchDown", name: "Pitch: nose down", keys: ["ArrowDown", ""]},
        {id: "rollLeft", name: "Roll left", keys: ["ArrowLeft", ""]},
        {id: "rollRight", name: "Roll right", keys: ["ArrowRight", ""]},
        {id: "yawLeft", name: "Rudder left", keys: ["KeyA", ""]},
        {id: "yawRight", name: "Rudder right", keys: ["KeyD", ""]},
        {id: "throttleUp", name: "Throttle up", keys: ["KeyW", ""]},
        {id: "throttleDown", name: "Throttle down", keys: ["KeyS", ""]},
        {id: "boost", name: "Afterburner / boost (hold)", keys: ["ShiftLeft", "ShiftRight"]},
        {id: "fire", name: "Guns", keys: ["Space", "Mouse0"]},
        {id: "missile", name: "Guided missile", keys: ["KeyX", "Mouse2"]},
        {id: "flare", name: "Countermeasures", keys: ["KeyQ", ""]},
        {id: "camera", name: "Switch camera (cockpit / chase)", keys: ["KeyV", ""]},
        {id: "look", name: "Free look (hold, then move the mouse)", keys: ["KeyC", ""]},
        {id: "lookBack", name: "Look behind (hold)", keys: ["KeyB", ""]},
        {id: "repair", name: "Repair (hold)", keys: ["KeyR", ""]},
        {id: "eject", name: "Eject", keys: ["KeyE", ""]},
        {id: "scores", name: "Scoreboard (hold)", keys: ["Tab", ""]},
    ];

    const DEFAULTS = {
        volume: 0.8,
        engineVolume: 0.6,
        gunVolume: 0.6,
        dfQuality: "high",
        dfView: "chase",
        dfFov: 72,
        dfMouse: true,
        dfMouseSens: 1,
        dfInvertPitch: false,
        dfInvertMouse: false,
        dfShake: true,
        dfAutoRes: true,
        dfShowFps: false,
        keys2d: {},
        keysDf: {},
    };
    for (const a of KEYS_2D) DEFAULTS.keys2d[a.id] = a.keys.slice();
    for (const a of KEYS_DF) DEFAULTS.keysDf[a.id] = a.keys.slice();

    let state = JSON.parse(JSON.stringify(DEFAULTS));
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
        for (const k of Object.keys(DEFAULTS)) {
            if (saved[k] === undefined) continue;
            if (k === "keys2d" || k === "keysDf") {
                for (const [id, keys] of Object.entries(saved[k] || {})) {
                    if (state[k][id] && Array.isArray(keys)) state[k][id] = [String(keys[0] || ""), String(keys[1] || "")];
                }
            } else state[k] = saved[k];
        }
    } catch (e) {}

    const listeners = [];

    function save() {
        try {
            localStorage.setItem(KEY, JSON.stringify(state));
        } catch (e) {}
        applyVolume();
        listeners.forEach(fn => {
            try {
                fn(state);
            } catch (e) {}
        });
    }

    function get(k) {
        return state[k];
    }

    function set(k, v) {
        state[k] = v;
        save();
    }

    function applyVolume() {
        if (window.BitSound && window.BitSound.setVolume) window.BitSound.setVolume(state.volume);
    }


    function keyName(code) {
        if (!code) return "–";
        const special = {
            ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→", Space: "Space",
            ShiftLeft: "L Shift", ShiftRight: "R Shift", ControlLeft: "L Ctrl", ControlRight: "R Ctrl",
            AltLeft: "L Alt", AltRight: "R Alt", Enter: "Enter", Tab: "Tab", Backquote: "`", Minus: "-", Equal: "=",
            BracketLeft: "[", BracketRight: "]", Semicolon: ";", Quote: "'", Comma: ",", Period: ".", Slash: "/", Backslash: "\\",
            Mouse0: "Left mouse", Mouse1: "Middle mouse", Mouse2: "Right mouse", Mouse3: "Mouse 4", Mouse4: "Mouse 5",
            CapsLock: "Caps", Backspace: "Backspace",
        };
        if (special[code]) return special[code];
        if (/^Key[A-Z]$/.test(code)) return code.slice(3);
        if (/^Digit\d$/.test(code)) return code.slice(5);
        if (/^Numpad/.test(code)) return "Num " + code.slice(6);
        return code;
    }

    function actionOf(set, code) {
        const map = state[set];
        for (const id of Object.keys(map)) if (map[id].includes(code)) return id;
        return null;
    }


    const ENGINE_KEYS = {
        thrustUp: ["ArrowUp", "KeyW"], thrustDown: ["ArrowDown", "KeyS"],
        pitchUp: ["ArrowLeft", "KeyA"], pitchDown: ["ArrowRight", "KeyD"],
        fire: ["Space"], missile: ["KeyX"], flare: ["KeyQ"], eject: ["KeyC"],
    };
    const ENGINE_ALL = new Set(Object.values(ENGINE_KEYS).flat());
    const KEY_TEXT = {ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight", Space: " ", KeyX: "x", KeyQ: "q", KeyC: "c", KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d"};
    const KEY_CODES = {ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39, Space: 32, KeyX: 88, KeyQ: 81, KeyC: 67, KeyW: 87, KeyA: 65, KeyS: 83, KeyD: 68};

    function in2D() {
        const ui = document.querySelector(".ui");
        return ui && ui.style.display === "block" && !(window.BitAirBattle && window.BitAirBattle.state && window.BitAirBattle.state());
    }

    function translate(ev) {
        if (!ev.isTrusted || capturing || !in2D()) return;
        if (/INPUT|TEXTAREA|SELECT/.test((ev.target && ev.target.tagName) || "")) return;
        const code = ev.code, action = actionOf("keys2d", code);
        if (action) {
            if (ENGINE_KEYS[action].includes(code)) return;
            const send = ENGINE_KEYS[action][0];
            ev.preventDefault();
            ev.stopImmediatePropagation();
            const fake = new KeyboardEvent(ev.type, {code: send, key: KEY_TEXT[send] || send, bubbles: true, cancelable: true, repeat: ev.repeat});
            try {
                Object.defineProperty(fake, "keyCode", {get: () => KEY_CODES[send] || 0});
                Object.defineProperty(fake, "which", {get: () => KEY_CODES[send] || 0});
            } catch (e) {}
            (document.activeElement && document.activeElement !== document.body ? document.activeElement : document).dispatchEvent(fake);
        } else if (ENGINE_ALL.has(code)) {
            ev.preventDefault();
            ev.stopImmediatePropagation();
        }
    }

    window.addEventListener("keydown", translate, true);
    window.addEventListener("keyup", translate, true);


    let el, tab = "general", capturing = null;

    function row(set, a) {
        const keys = state[set][a.id];
        return `<tr><td>${a.name}</td>${[0, 1].map(i => `<td><button type="button" class="key-bind${capturing && capturing.set === set && capturing.id === a.id && capturing.slot === i ? " listening" : ""}"
            data-set="${set}" data-id="${a.id}" data-slot="${i}">${capturing && capturing.set === set && capturing.id === a.id && capturing.slot === i ? "Press a key…" : keyName(keys[i])}</button></td>`).join("")}</tr>`;
    }

    function option(k, label, choices) {
        return `<label class="set-row"><span>${label}</span><select data-setting="${k}">${choices.map(([v, t]) =>
            `<option value="${v}"${String(state[k]) === String(v) ? " selected" : ""}>${t}</option>`).join("")}</select></label>`;
    }

    function check(k, label) {
        return `<label class="set-row"><span>${label}</span><input type="checkbox" data-setting="${k}"${state[k] ? " checked" : ""}></label>`;
    }

    function slider(k, label, min, max, step, fmt) {
        return `<label class="set-row"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${state[k]}" data-setting="${k}">
            <output>${fmt(state[k])}</output></label>`;
    }

    function render() {
        if (!el || el.hidden) return;
        const body = el.querySelector(".settings-body");
        el.querySelectorAll(".set-tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
        if (tab === "general") {
            body.innerHTML = `
                <h3>Sound</h3>
                ${slider("volume", "Volume", 0, 1, 0.05, v => Math.round(v * 100) + "%")}
                ${slider("engineVolume", "Engines", 0, 1, 0.05, v => Math.round(v * 100) + "%")}
                ${slider("gunVolume", "Guns", 0, 1, 0.05, v => Math.round(v * 100) + "%")}
                <p class="shop-note"><kbd>M</kbd> turns the sound on and off at any time.</p>
                <h3>Flight Sessions (3D)</h3>
                ${option("dfQuality", "Graphics", [["low", "Low (fastest)"], ["medium", "Medium"], ["high", "High (shadows, reflections, cinematic look)"], ["ultra", "Ultra (strong graphics card)"]])}
                ${option("dfView", "Starting camera", [["chase", "Chase (third person)"], ["cockpit", "Cockpit (first person)"]])}
                ${slider("dfFov", "Field of view", 55, 100, 1, v => v + "°")}
                ${check("dfMouse", "Fly with the mouse (Battlefield style: mouse pitches and rolls)")}
                ${slider("dfMouseSens", "Mouse sensitivity", 0.3, 2.5, 0.05, v => Number(v).toFixed(2) + "×")}
                ${check("dfInvertMouse", "Invert mouse up / down")}
                ${check("dfInvertPitch", "Invert pitch keys (↑ = nose down)")}
                ${check("dfShake", "Camera shake")}
                ${check("dfAutoRes", "Keep it smooth (lower the resolution when frames get slow)")}
                ${check("dfShowFps", "Show the frame rate")}`;
        } else {
            const set = tab === "keys2d" ? "keys2d" : "keysDf", list = set === "keys2d" ? KEYS_2D : KEYS_DF;
            body.innerHTML = `
                <p class="shop-note">Click a key, then press the new key${set === "keysDf" ? " or mouse button" : ""}. <kbd>Esc</kbd> cancels, <kbd>Backspace</kbd> clears.</p>
                <table class="key-table"><tr><th>Action</th><th>Key</th><th>Second key</th></tr>${list.map(a => row(set, a)).join("")}</table>
                <button type="button" class="pill set-reset" data-set="${set}">Reset ${set === "keys2d" ? "Bit Planes" : "Flight Sessions"} keys</button>`;
        }
    }

    function bind(code) {
        const c = capturing;
        capturing = null;
        if (!c) return;
        const map = state[c.set];
        if (code !== null) {
            if (code) for (const id of Object.keys(map)) map[id] = map[id].map(k => (k === code ? "" : k));
            map[c.id][c.slot] = code;
            save();
        }
        render();
    }

    function onCaptureKey(ev) {
        if (!capturing) return;
        ev.preventDefault();
        ev.stopImmediatePropagation();
        if (ev.type !== "keydown") return;
        if (ev.code === "Escape") return bind(null);
        if (ev.code === "Backspace" || ev.code === "Delete") return bind("");
        if (ev.code === "KeyM" || !ev.code) return;
        bind(ev.code);
    }

    function onCaptureMouse(ev) {
        if (!capturing || capturing.set !== "keysDf") return;
        if (ev.target.closest && ev.target.closest(".key-bind.listening")) {
            if (ev.button === 0) return;
        }
        ev.preventDefault();
        ev.stopImmediatePropagation();
        bind("Mouse" + ev.button);
    }

    function show(startTab) {
        if (!el) return;
        if (startTab) tab = startTab;
        el.hidden = false;
        render();
    }

    function hide() {
        if (!el) return;
        capturing = null;
        el.hidden = true;
    }

    function init() {
        el = document.createElement("div");
        el.className = "settings panel-backdrop";
        el.hidden = true;
        el.innerHTML = `<div class="panel" role="dialog" aria-label="Settings">
            <div class="shop-header"><h2>Settings</h2><button type="button" class="close-shop set-close" aria-label="Close">×</button></div>
            <div class="set-tabs">
                <button type="button" class="set-tab" data-tab="general">General</button>
                <button type="button" class="set-tab" data-tab="keys2d">Bit Planes keys</button>
                <button type="button" class="set-tab" data-tab="keysDf">Flight Sessions keys</button>
            </div>
            <div class="settings-body"></div>
        </div>`;
        document.body.appendChild(el);
        el.addEventListener("click", ev => {
            if (ev.target === el || ev.target.closest(".set-close")) return hide();
            const t = ev.target.closest(".set-tab");
            if (t) {
                tab = t.dataset.tab;
                capturing = null;
                return render();
            }
            const b = ev.target.closest(".key-bind");
            if (b) {
                capturing = {set: b.dataset.set, id: b.dataset.id, slot: Number(b.dataset.slot)};
                return render();
            }
            const r = ev.target.closest(".set-reset");
            if (r) {
                state[r.dataset.set] = JSON.parse(JSON.stringify(DEFAULTS[r.dataset.set]));
                save();
                render();
            }
        });
        el.addEventListener("input", ev => {
            const k = ev.target.dataset.setting;
            if (!k) return;
            const v = ev.target.type === "checkbox" ? ev.target.checked : ev.target.type === "range" ? Number(ev.target.value) : ev.target.value;
            state[k] = v;
            const out = ev.target.parentElement.querySelector("output");
            if (out) out.textContent = /olume$/.test(k) ? Math.round(v * 100) + "%" : k === "dfFov" ? v + "°" : Number(v).toFixed(2) + "×";
            save();
        });
        el.addEventListener("contextmenu", ev => capturing && ev.preventDefault());
        window.addEventListener("keydown", onCaptureKey, true);
        window.addEventListener("keyup", onCaptureKey, true);
        window.addEventListener("mousedown", onCaptureMouse, true);
        document.addEventListener("keydown", ev => {
            if (ev.key === "Escape" && !el.hidden && !capturing) {
                hide();
                ev.stopImmediatePropagation();
            }
        }, true);
        document.querySelectorAll(".open-settings").forEach(b => b.addEventListener("click", () => show()));
        applyVolume();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    return {
        get, set, show, hide, keyName, actionOf,
        isOpen: () => !!el && !el.hidden,
        keys: set => state[set],
        actions2d: KEYS_2D, actionsDf: KEYS_DF,
        onChange: fn => listeners.push(fn),
        defaults: DEFAULTS,
    };
})();
