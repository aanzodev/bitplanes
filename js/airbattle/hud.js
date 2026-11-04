(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};

    function esc(s) {
        return String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
    }

    function keyList() {
        const S = window.BitSettings;
        if (!S) return "";
        const keys = id => S.keys("keysDf")[id].filter(Boolean).map(k => `<kbd>${S.keyName(k)}</kbd>`).join(" ") || "–";
        return S.actionsDf.map(a => `<tr><td>${keys(a.id)}</td><td>${a.name}</td></tr>`).join("") +
            `<tr><td>Mouse</td><td>${S.get("dfMouse") ? "Pitch and roll (click the screen to grab the mouse)" : "Off (turn on in Settings)"}</td></tr>`;
    }

    D.makeHud = function (root) {
        const hud = document.createElement("div");
        hud.className = "df-hud";
        hud.innerHTML = `
            <div class="df-top">
                <div class="df-teams">
                    <div class="df-team blue"><b class="df-blue">0</b><span><i class="df-blue-bar"></i></span></div>
                    <div class="df-clock">10:00</div>
                    <div class="df-team red"><span><i class="df-red-bar"></i></span><b class="df-red">0</b></div>
                </div>
                <div class="df-goal"></div>
            </div>
            <div class="df-feed"></div>
            <div class="df-marks"></div>
            <div class="df-dmg"></div>
            <div class="df-cross"><i></i></div>
            <div class="df-lead" hidden></div>
            <div class="df-lockbox" hidden><i></i><span></span></div>
            <div class="df-hitmark" hidden></div>
            <div class="df-warn"></div>
            <div class="df-ribbons"></div>
            <div class="df-msg"></div>
            <div class="df-killcam" hidden></div>
            <canvas class="df-radar" width="200" height="200"></canvas>
            <div class="df-panel">
                <div class="df-hp-row"><span class="df-plane"></span><b class="df-hp">100%</b></div>
                <div class="df-bar df-health"><i></i></div>
                <div class="df-nums">
                    <div><b class="df-speed">0</b><small>KM/H</small></div>
                    <div><b class="df-alt">0</b><small>ALT M</small></div>
                    <div><b class="df-gs">1.0</b><small>G</small></div>
                </div>
                <div class="df-row"><small>THR</small><div class="df-bar df-throttle"><i></i></div></div>
                <div class="df-row"><small>BOOST</small><div class="df-bar df-boost"><i></i></div></div>
                <div class="df-weapons">
                    <div><small>GUNS</small><b class="df-ammo">0</b></div>
                    <div><small>MISSILES</small><b class="df-missiles">0</b></div>
                    <div><small>COUNTER&shy;MEASURES</small><b class="df-flares">0</b></div>
                </div>
                <div class="df-repair"></div>
            </div>
            <div class="df-score"></div>
            <div class="df-fps" hidden></div>
            <div class="df-vignette"></div>
            <div class="df-blackout"></div>
            <div class="df-board" hidden></div>
            <div class="df-pause" hidden>
                <div class="df-pause-box">
                    <h2>Paused</h2>
                    <div class="df-pause-buttons">
                        <button type="button" class="btn df-resume">▶ Resume</button>
                        <button type="button" class="btn df-settings">⚙ Settings</button>
                        <button type="button" class="btn df-leave">Leave to lobby</button>
                    </div>
                    <table class="df-keys"></table>
                </div>
            </div>
            <div class="df-results" hidden></div>`;
        root.appendChild(hud);
        const $ = s => hud.querySelector(s);
        const radar = $(".df-radar").getContext("2d");
        const marks = new Map();
        let hitT = 0, killT = 0, msgUntil = 0;

        function mark(plane) {
            let m = marks.get(plane);
            if (!m) {
                m = document.createElement("div");
                m.className = "df-box";
                m.innerHTML = `<i></i><span></span>`;
                $(".df-marks").appendChild(m);
                marks.set(plane, m);
            }
            return m;
        }

        const project = (v, camera, w, h) => {
            const p = v.clone().project(camera);
            return {x: (p.x + 1) / 2 * w, y: (1 - p.y) / 2 * h, on: p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05, z: p.z, px: p.x, py: p.y};
        };

        const api = {
            el: hud,
            pause(show) {
                $(".df-pause").hidden = !show;
                if (show) $(".df-keys").innerHTML = keyList();
            },
            onResume: fn => $(".df-resume").addEventListener("click", fn),
            onLeave: fn => $(".df-leave").addEventListener("click", fn),
            onSettings: fn => $(".df-settings").addEventListener("click", fn),

            message(text, ms = 2500) {
                $(".df-msg").innerHTML = text;
                msgUntil = performance.now() + ms;
            },

            feed(html) {
                const div = document.createElement("div");
                div.innerHTML = html;
                $(".df-feed").prepend(div);
                setTimeout(() => div.remove(), 7000);
                while ($(".df-feed").children.length > 6) $(".df-feed").lastChild.remove();
            },

            ribbon(points, text, big) {
                const div = document.createElement("div");
                div.className = "df-ribbon" + (big ? " big" : "");
                div.innerHTML = `${points ? `<b>+${points}</b> ` : ""}${esc(text)}`;
                $(".df-ribbons").prepend(div);
                setTimeout(() => div.classList.add("out"), 2600);
                setTimeout(() => div.remove(), 3200);
                while ($(".df-ribbons").children.length > 5) $(".df-ribbons").lastChild.remove();
            },

            hit() {
                hitT = 0.14;
            },

            kill() {
                killT = 0.6;
            },

            hurt(angle) {
                const v = $(".df-vignette");
                v.classList.remove("on");
                void v.offsetWidth;
                v.classList.add("on");
                if (angle === undefined) return;
                const a = document.createElement("i");
                a.style.transform = `rotate(${angle}rad)`;
                $(".df-dmg").appendChild(a);
                setTimeout(() => a.remove(), 900);
            },

            killcam(html) {
                const k = $(".df-killcam");
                k.hidden = !html;
                if (html) k.innerHTML = html;
            },

            scoreboard(show, teams) {
                const b = $(".df-board");
                b.hidden = !show;
                if (!show) return;
                const table = (list, cls, title) => `<div class="df-board-team ${cls}"><h3>${title}</h3><table>
                    <tr><th>Pilot</th><th>Plane</th><th>E</th><th>D</th><th>Score</th></tr>
                    ${list.sort((a, b) => b.score - a.score || b.kills - a.kills).map(p => `<tr class="${p.isPlayer ? "me" : ""}"><td>${esc(p.name)}</td><td>${esc(p.label)}</td><td>${p.kills}</td><td>${p.deaths}</td><td>${p.score}</td></tr>`).join("")}</table></div>`;
                b.innerHTML = teams.length > 1 ? table(teams[0].list, "blue", teams[0].name) + table(teams[1].list, "red", teams[1].name) : table(teams[0].list, "ffa", teams[0].name);
            },

            results(html, onAgain, onLeave) {
                const r = $(".df-results");
                r.hidden = !html;
                if (!html) return;
                r.innerHTML = html;
                r.querySelector(".df-again").addEventListener("click", onAgain);
                r.querySelector(".df-out").addEventListener("click", onLeave);
            },

            update(dt, s) {
                const {player: p, planes, camera, width: W, height: H, lock, time} = s;
                if (performance.now() > msgUntil) $(".df-msg").innerHTML = "";
                hud.classList.toggle("in-cockpit", !!s.cockpit);
                const m = s.match;
                const clock = Math.max(0, Math.ceil(m.timeLeft));
                $(".df-clock").textContent = `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, "0")}`;
                if (m.teams) {
                    $(".df-blue").textContent = m.blue;
                    $(".df-red").textContent = m.red;
                    $(".df-blue-bar").style.width = Math.min(100, 100 * m.blue / m.goal) + "%";
                    $(".df-red-bar").style.width = Math.min(100, 100 * m.red / m.goal) + "%";
                    $(".df-goal").textContent = `First to ${m.goal} eliminations`;
                } else {
                    $(".df-blue").textContent = p.kills;
                    $(".df-red").textContent = m.leader;
                    $(".df-blue-bar").style.width = Math.min(100, 100 * p.kills / m.goal) + "%";
                    $(".df-red-bar").style.width = Math.min(100, 100 * m.leader / m.goal) + "%";
                    $(".df-goal").textContent = `You vs the leader · first to ${m.goal}`;
                }
                $(".df-score").innerHTML = `Score <b>${p.score}</b> · E <b>${p.kills}</b> · D <b>${p.deaths}</b> · <i class="coin"></i> +${s.coins}`;

                const hp = Math.max(0, p.health) / p.maxHealth;
                $(".df-plane").textContent = p.label;
                $(".df-hp").textContent = Math.ceil(hp * 100) + "%";
                $(".df-health i").style.width = hp * 100 + "%";
                $(".df-health").className = "df-bar df-health " + (hp > 0.6 ? "good" : hp > 0.3 ? "ok" : "bad");
                $(".df-speed").textContent = Math.round(p.speed * 3.6);
                $(".df-alt").textContent = Math.round(Math.max(0, p.pos.y));
                $(".df-gs").textContent = p.g.toFixed(1);
                $(".df-gs").className = "df-gs" + (p.g > 7 ? " hot" : "");
                $(".df-throttle i").style.width = Math.round(p.throttle * 100) + "%";
                $(".df-boost i").style.width = Math.round(100 * p.boost / p.maxBoost) + "%";
                $(".df-boost").classList.toggle("on", !!p.boosting);
                $(".df-ammo").textContent = p.reloadAt ? "RELOAD" : p.ammo;
                $(".df-missiles").textContent = p.missiles ? p.missiles : p.missileReloadAt ? `${Math.ceil(p.missileReloadAt - time)}s` : "0";
                $(".df-flares").textContent = p.flares ? p.flares : p.flareReloadAt ? `${Math.ceil(p.flareReloadAt - time)}s` : "0";
                $(".df-repair").innerHTML = s.repair || "";
                $(".df-warn").innerHTML = s.warning || "";

                hitT -= dt;
                killT -= dt;
                const hm = $(".df-hitmark");
                hm.hidden = hitT <= 0 && killT <= 0;
                hm.className = "df-hitmark" + (killT > 0 ? " kill" : "");

                $(".df-blackout").style.opacity = Math.min(0.85, s.blackout || 0);
                hud.classList.toggle("low-hp", p.alive && hp < 0.3);

                const cross = $(".df-cross");
                if (p.alive && !s.deadView) {
                    const c = project(p.pos.clone().addScaledVector(p.forward, 600), camera, W, H);
                    cross.style.transform = `translate(${c.x}px, ${c.y}px)`;
                    cross.style.visibility = c.on ? "visible" : "hidden";
                } else cross.style.visibility = "hidden";

                const lead = $(".df-lead");
                if (s.lead && p.alive && !s.deadView) {
                    const c = project(s.lead, camera, W, H);
                    lead.hidden = !c.on;
                    lead.style.transform = `translate(${c.x}px, ${c.y}px)`;
                } else lead.hidden = true;

                const lb = $(".df-lockbox");
                if (lock && lock.target && p.alive && !s.deadView) {
                    const c = project(lock.target.pos, camera, W, H);
                    lb.hidden = !c.on;
                    const sz = 30 + 70 * (1 - Math.min(1, lock.progress));
                    lb.style.width = lb.style.height = sz + "px";
                    lb.style.transform = `translate(${c.x - sz / 2}px, ${c.y - sz / 2}px)`;
                    lb.classList.toggle("locked", lock.progress >= 1);
                    lb.querySelector("span").textContent = lock.progress >= 1 ? "LOCKED" : "LOCKING";
                } else lb.hidden = true;

                for (const e of planes) {
                    if (e === p) continue;
                    const mk = mark(e);
                    if (!e.alive) {
                        mk.style.display = "none";
                        continue;
                    }
                    const friend = p.team && e.team === p.team;
                    const dist = e.pos.distanceTo(camera.position);
                    if (friend && dist > 4000) {
                        mk.style.display = "none";
                        continue;
                    }
                    mk.style.display = "";
                    const c = project(e.pos, camera, W, H);
                    const label = `${esc(e.name)}${friend ? "" : " · " + (dist > 999 ? (dist / 1000).toFixed(1) + " km" : Math.round(dist) + " m")}`;
                    const span = mk.querySelector("span");
                    if (span.innerHTML !== label) span.innerHTML = label;
                    if (c.on) {
                        mk.className = "df-box" + (friend ? " friend" : " foe") + (lock && lock.target === e ? " target" : "") + (dist > 3000 && !(lock && lock.target === e) ? " far" : "");
                        mk.style.transform = `translate(${c.x}px, ${c.y}px)`;
                    } else if (!friend) {
                        let x = c.px, y = c.py;
                        if (c.z > 1) [x, y] = [-x, -y];
                        const ang = Math.atan2(-y, x), r = Math.min(W, H) * 0.42;
                        mk.className = "df-box df-arrow";
                        mk.style.transform = `translate(${W / 2 + Math.cos(ang) * r}px, ${H / 2 + Math.sin(ang) * r}px) rotate(${ang}rad)`;
                    } else mk.style.display = "none";
                }

                const R = 100, range = s.radarRange || 4000, scale = (R - 8) / range;
                radar.clearRect(0, 0, 200, 200);
                radar.fillStyle = "rgba(8, 24, 18, 0.62)";
                radar.beginPath();
                radar.arc(R, R, R - 2, 0, Math.PI * 2);
                radar.fill();
                radar.strokeStyle = "rgba(120, 255, 160, 0.3)";
                radar.lineWidth = 1;
                [0.33, 0.66, 1].forEach(k => {
                    radar.beginPath();
                    radar.arc(R, R, (R - 8) * k, 0, Math.PI * 2);
                    radar.stroke();
                });
                radar.beginPath();
                radar.moveTo(R, 8);
                radar.lineTo(R, R * 2 - 8);
                radar.moveTo(8, R);
                radar.lineTo(R * 2 - 8, R);
                radar.stroke();
                const f = p.forward, heading = Math.atan2(f.x, -f.z), cs = Math.cos(-heading), sn = Math.sin(-heading);
                const toRadar = v => {
                    const dx = v.x - p.pos.x, dz = v.z - p.pos.z;
                    let x = (dx * cs - dz * sn) * scale, y = (dx * sn + dz * cs) * scale;
                    const d = Math.hypot(x, y);
                    if (d > R - 8) [x, y] = [x / d * (R - 8), y / d * (R - 8)];
                    return [R + x, R + y, d > R - 8];
                };
                radar.strokeStyle = "rgba(255, 200, 60, 0.6)";
                radar.beginPath();
                for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 32) {
                    const [x, y] = toRadar({x: Math.cos(a) * s.area, z: Math.sin(a) * s.area});
                    a ? radar.lineTo(x, y) : radar.moveTo(x, y);
                }
                radar.stroke();
                for (const e of planes) {
                    if (!e.alive || e === p) continue;
                    const [x, y, edge] = toRadar(e.pos);
                    const friend = p.team && e.team === p.team;
                    radar.fillStyle = lock && lock.target === e ? "#ffe600" : friend ? "#4fb3ff" : "#ff4d4d";
                    radar.globalAlpha = edge ? 0.55 : 1;
                    radar.beginPath();
                    radar.arc(x, y, 3.8, 0, Math.PI * 2);
                    radar.fill();
                }
                radar.globalAlpha = 1;
                for (const mm of s.missiles || []) {
                    const [x, y] = toRadar(mm.mesh.position);
                    radar.fillStyle = mm.target === p ? "#ffffff" : "rgba(255,255,255,0.45)";
                    radar.fillRect(x - 1.5, y - 1.5, 3, 3);
                }
                radar.fillStyle = "#7dffa0";
                radar.beginPath();
                radar.moveTo(R, R - 8);
                radar.lineTo(R - 6, R + 6);
                radar.lineTo(R + 6, R + 6);
                radar.fill();
                radar.fillStyle = "#cfe";
                radar.font = "bold 11px sans-serif";
                radar.textAlign = "center";
                radar.fillText("N", R + sn * (R - 14), R - cs * (R - 14) + 4);
            },

            remove(plane) {
                const m = marks.get(plane);
                if (m) m.remove();
                marks.delete(plane);
            },
        };
        return api;
    };
})();
