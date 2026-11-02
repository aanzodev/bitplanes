// Dogfights (3D beta): the on-screen display. Gunsight, boxes around enemies
// (with distance, and LOCK for your missile target), arrows to enemies off
// screen, a radar, speed / altitude / throttle, ammo, missiles, flares,
// health, kill feed, warnings and the pause menu.
(function () {
    const D = window.BitDogfight = window.BitDogfight || {};

    D.makeHud = function (root) {
        const hud = document.createElement("div");
        hud.className = "df-hud";
        hud.innerHTML = `
            <div class="df-title">DOGFIGHTS <span>BETA</span></div>
            <div class="df-score"></div>
            <canvas class="df-radar" width="170" height="170"></canvas>
            <div class="df-feed"></div>
            <div class="df-marks"></div>
            <div class="df-cross"><i></i></div>
            <div class="df-hitmark" hidden>✕</div>
            <div class="df-msg"></div>
            <div class="df-warn"></div>
            <div class="df-timer">⏱ 0:00</div>
            <div class="df-panel">
                <div><small>SPEED</small><b class="df-speed">0</b><small>km/h</small></div>
                <div><small>ALT</small><b class="df-alt">0</b><small>m</small></div>
                <div class="df-throttle"><small>THROTTLE</small><span><i></i></span></div>
                <div><small>AMMO</small><b class="df-ammo">0</b></div>
                <div><small>MISSILES</small><b class="df-missiles">0</b></div>
                <div class="df-flares-box"><small>FLARES</small><b class="df-flares">0</b></div>
            </div>
            <div class="df-health"><div class="health-top"><span class="df-plane"></span><span class="df-hp"></span></div>
                <div class="health-track"><div class="health-fill"></div></div></div>
            <div class="df-vignette"></div>
            <div class="df-pause" hidden>
                <div class="df-pause-box">
                    <h2>Paused</h2>
                    <table class="df-keys">
                        <tr><td><kbd>↑</kbd> <kbd>↓</kbd></td><td>Pitch: nose up / down</td></tr>
                        <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Roll (bank, then pull ↑ to turn)</td></tr>
                        <tr><td><kbd>A</kbd> <kbd>D</kbd></td><td>Rudder</td></tr>
                        <tr><td><kbd>W</kbd> <kbd>S</kbd></td><td>Throttle</td></tr>
                        <tr><td><kbd>Space</kbd></td><td>Guns</td></tr>
                        <tr><td><kbd>X</kbd></td><td>Missile (locks on the boxed enemy)</td></tr>
                        <tr><td><kbd>Q</kbd></td><td>Flares (planes that carry them)</td></tr>
                        <tr><td><kbd>Esc</kbd></td><td>Pause</td></tr>
                    </table>
                    <div class="df-pause-buttons">
                        <button type="button" class="btn df-resume">▶ Resume</button>
                        <button type="button" class="btn df-leave">Leave to lobby</button>
                    </div>
                </div>
            </div>`;
        root.appendChild(hud);
        const $ = s => hud.querySelector(s);
        const radar = $(".df-radar").getContext("2d");
        const marks = new Map();
        let hitT = 0, msgUntil = 0;

        function mark(plane) {
            let m = marks.get(plane);
            if (!m) {
                m = document.createElement("div");
                m.className = "df-box";
                m.innerHTML = `<span></span>`;
                $(".df-marks").appendChild(m);
                marks.set(plane, m);
            }
            return m;
        }

        return {
            el: hud,
            pause: show => ($(".df-pause").hidden = !show),
            onResume: fn => $(".df-resume").addEventListener("click", fn),
            onLeave: fn => $(".df-leave").addEventListener("click", fn),

            message(text, ms = 2500) {
                $(".df-msg").textContent = text;
                msgUntil = performance.now() + ms;
            },

            feed(html) {
                const div = document.createElement("div");
                div.innerHTML = html;
                $(".df-feed").prepend(div);
                setTimeout(() => div.remove(), 6000);
                while ($(".df-feed").children.length > 6) $(".df-feed").lastChild.remove();
            },

            hit() {
                hitT = 0.15;
            },

            hurt() {
                const v = $(".df-vignette");
                v.classList.remove("on");
                void v.offsetWidth;
                v.classList.add("on");
            },

            // s: everything the HUD shows this frame.
            update(dt, s) {
                const {player, enemies, camera, width, height, lock, time} = s;
                if (performance.now() > msgUntil) $(".df-msg").textContent = "";
                $(".df-timer").textContent = `⏱ ${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
                $(".df-score").innerHTML = `Kills <b>${player.kills}</b> · Deaths <b>${player.deaths}</b> · <i class="coin"></i> +${s.coins}`;
                $(".df-speed").textContent = Math.round(player.speed * 3.6);
                $(".df-alt").textContent = Math.round(Math.max(0, player.pos.y));
                $(".df-throttle i").style.width = Math.round(player.throttle * 100) + "%";
                $(".df-ammo").textContent = player.reloadAt ? "reloading" : player.ammo;
                $(".df-missiles").textContent = player.missiles || (player.missileReloadAt ? "…" : 0);
                $(".df-flares").textContent = player.flares;
                $(".df-flares-box").hidden = !player.maxFlares;
                const hp = Math.max(0, player.health) / player.maxHealth;
                const hb = $(".df-health");
                hb.className = "df-health health-bar " + (hp > 0.6 ? "good" : hp > 0.3 ? "ok" : "bad");
                $(".df-health .health-fill").style.width = hp * 100 + "%";
                $(".df-hp").textContent = `${Math.max(0, Math.ceil(player.health))} / ${player.maxHealth}`;
                $(".df-plane").textContent = player.label;
                $(".df-warn").innerHTML = s.warning || "";
                hitT -= dt;
                $(".df-hitmark").hidden = hitT <= 0;

                // Gunsight: where the guns point, a little ahead of the nose.
                const v = player.pos.clone().addScaledVector(player.forward, 400).project(camera);
                const cross = $(".df-cross");
                cross.style.transform = `translate(${(v.x + 1) / 2 * width}px, ${(1 - v.y) / 2 * height}px)`;
                cross.style.visibility = player.alive ? "visible" : "hidden";

                // Boxes and arrows for every enemy.
                for (const e of enemies) {
                    const m = mark(e);
                    if (!e.alive || !player.alive) {
                        m.style.display = "none";
                        continue;
                    }
                    m.style.display = "";
                    const p = e.pos.clone().project(camera), dist = e.pos.distanceTo(player.pos);
                    const onScreen = p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
                    m.classList.toggle("lock", e === lock);
                    m.querySelector("span").textContent = `${e === lock ? "LOCK · " : ""}${e.name} ${dist > 999 ? (dist / 1000).toFixed(1) + " km" : Math.round(dist) + " m"}`;
                    if (onScreen) {
                        const size = Math.max(22, Math.min(90, 9000 / dist));
                        m.className = "df-box" + (e === lock ? " lock" : "");
                        m.style.width = m.style.height = size + "px";
                        m.style.transform = `translate(${(p.x + 1) / 2 * width - size / 2}px, ${(1 - p.y) / 2 * height - size / 2}px)`;
                    } else {
                        // Off screen: an arrow at the edge pointing the way to turn.
                        let x = p.x, y = p.y;
                        if (p.z > 1) [x, y] = [-x, -y];
                        const ang = Math.atan2(-y, x), r = Math.min(width, height) * 0.42;
                        m.className = "df-box df-arrow";
                        m.style.width = m.style.height = "";
                        m.style.transform = `translate(${width / 2 + Math.cos(ang) * r}px, ${height / 2 + Math.sin(ang) * r}px) rotate(${ang}rad)`;
                    }
                }

                // Radar: you in the middle, nose up, 3 km across.
                const R = 85, scale = R / 3000;
                radar.clearRect(0, 0, 170, 170);
                radar.fillStyle = "rgba(10, 30, 20, 0.55)";
                radar.beginPath();
                radar.arc(R, R, R - 2, 0, Math.PI * 2);
                radar.fill();
                radar.strokeStyle = "rgba(120, 255, 160, 0.35)";
                [R * 0.33, R * 0.66].forEach(rr => {
                    radar.beginPath();
                    radar.arc(R, R, rr, 0, Math.PI * 2);
                    radar.stroke();
                });
                const f = player.forward, heading = Math.atan2(f.x, -f.z);
                for (const e of enemies) {
                    if (!e.alive) continue;
                    const dx = e.pos.x - player.pos.x, dz = e.pos.z - player.pos.z;
                    const rx = dx * Math.cos(-heading) - (-dz) * Math.sin(-heading);
                    const ry = dx * Math.sin(-heading) + (-dz) * Math.cos(-heading);
                    let px = rx * scale, py = -ry * scale;
                    const d = Math.hypot(px, py);
                    if (d > R - 6) [px, py] = [px / d * (R - 6), py / d * (R - 6)];
                    radar.fillStyle = e === lock ? "#ffe600" : "#ff4d4d";
                    radar.beginPath();
                    radar.arc(R + px, R + py, 3.5, 0, Math.PI * 2);
                    radar.fill();
                }
                radar.fillStyle = "#7dffa0";
                radar.beginPath();
                radar.moveTo(R, R - 7);
                radar.lineTo(R - 5, R + 5);
                radar.lineTo(R + 5, R + 5);
                radar.fill();
            },

            remove(plane) {
                const m = marks.get(plane);
                if (m) m.remove();
                marks.delete(plane);
            },
        };
    };
})();
