(function () {
    const O = window.BitOnline;
    const LOBBY_MS = 15000, MATCH_MS = 10 * 60 * 1000, RESULTS_MS = 10000;
    const TAG_PLAYER = "[PLAYER] ", TAG_BOT = "[BOTS] ";
    const PHASES = ["lobby", "playing", "results"];
    const ROOM_SIZE = 10;
    const ROOM_HUMANS = 10;

    const m = {phase: null, endsAt: 0, results: [], world: null};
    let timerEl, overlayEl;


    function connect() {
        const url = O.serverUrl();
        return new Promise((resolve, reject) => {
            if (!url) return reject(new Error("Online Multiplayer needs the online server (see js/online/config.js)."));
            let ws, v = 0, opened = false;
            try {
                ws = new WebSocket(url);
            } catch (e) {
                return reject(new Error(O.errorText("server-error")));
            }
            const wake = setTimeout(() => opened || O.status("Waking up the online server… (can take up to a minute)"), 3000);
            const giveUp = setTimeout(() => fail("The online server didn't answer. Try again in a minute."), 75000);
            const fail = text => {
                clearTimeout(wake);
                clearTimeout(giveUp);
                try {
                    ws.close();
                } catch (e) {}
                reject(new Error(text));
            };
            ws.addEventListener("open", () => (opened = true));
            ws.addEventListener("error", () => fail(O.errorText("server-error")));
            ws.addEventListener("message", function hello(ev) {
                const msg = parse(ev.data);
                if (!msg) return;
                if (msg.op === "hello") {
                    v = msg.v || 0;
                    if (v < 3) return fail("The online server needs its update for Online Multiplayer. Render installs it a few minutes after the change is merged.");
                    if (v < 4) return done(null);
                    ws.send(JSON.stringify({op: "ping", t: performance.now()}));
                } else if (msg.op === "pong") done(Math.round(performance.now() - msg.t));
                function done(rtt) {
                    clearTimeout(wake);
                    clearTimeout(giveUp);
                    ws.removeEventListener("message", hello);
                    resolve({ws, v, rtt});
                }
            });
        });
    }

    function parse(text) {
        try {
            return JSON.parse(text);
        } catch (e) {
            return null;
        }
    }

    function ask(ws, req, op) {
        return new Promise(resolve => {
            ws.addEventListener("message", function on(ev) {
                const msg = parse(ev.data);
                if (!msg || msg.op !== op) return;
                ws.removeEventListener("message", on);
                resolve(msg);
            });
            ws.send(JSON.stringify(req));
        });
    }

    async function listRooms(ws, rtt) {
        const {rooms} = await ask(ws, {op: "list"}, "list");
        const at = performance.now();
        return (rooms || []).map(r => Object.assign({}, r, {meta: Object.assign({}, r.meta, {at})}, {
            ping: rtt === null ? null : rtt + (Number(r.meta && r.meta.rtt) || rtt),
            full: r.players >= (r.max || ROOM_HUMANS),
        }));
    }

    function joinRoom(id) {
        O.mode = "multiplayer";
        O.publicRoom = false;
        O.join(String(id).slice(O.PREFIX.length));
    }

    function hostRoom() {
        O.mode = "multiplayer";
        O.publicRoom = true;
        O.startHost();
    }

    async function quickMatch(tries = 0) {
        if (O.role) return;
        O.mode = "multiplayer";
        O.status(tries ? "Still looking for a match…" : "Finding a match…");
        let link;
        try {
            link = await connect();
        } catch (e) {
            O.mode = null;
            return O.status(e.message);
        }
        const {ws, v, rtt} = link;
        try {
            if (v >= 4) {
                const open = (await listRooms(ws, rtt)).filter(r => !r.full);
                open.sort((a, b) => (a.ping || 0) - (b.ping || 0) || b.players - a.players);
                if (open.length) return joinRoom(open[0].id);
            }
            const msg = await ask(ws, {op: "find"}, "found");
            if (msg.id) return joinRoom(msg.id);
            if (msg.retry && tries < 4) return setTimeout(() => quickMatch(tries + 1), msg.retry);
            hostRoom();
        } finally {
            ws.close();
        }
    }


    let browser, browserLink = null;

    async function openBrowser() {
        if (!browser) buildBrowser();
        browser.hidden = false;
        refreshBrowser();
    }

    async function refreshBrowser() {
        const list = browser.querySelector(".srv-list");
        list.innerHTML = `<p class="shop-note">Looking for servers…</p>`;
        let link;
        try {
            link = await connect();
        } catch (e) {
            list.innerHTML = `<p class="shop-note">${esc(e.message)}</p>`;
            return;
        }
        try {
            if (link.v < 4) {
                list.innerHTML = `<p class="shop-note">The online server needs its update for the server list. Press Start to find a match.</p>`;
                return;
            }
            browserLink = {rtt: link.rtt, rooms: await listRooms(link.ws, link.rtt)};
            renderBrowser();
        } finally {
            link.ws.close();
        }
    }

    function pingClass(ms) {
        return ms === null ? "waiting" : ms < 80 ? "good" : ms < 160 ? "ok" : "bad";
    }

    function renderBrowser() {
        const list = browser.querySelector(".srv-list");
        const q = browser.querySelector(".srv-search").value.trim().toLowerCase();
        let rooms = browserLink ? browserLink.rooms.slice() : [];
        const sort = browser.querySelector(".srv-sort").value;
        rooms.sort((a, b) => sort === "players" ? b.players - a.players : (a.ping || 0) - (b.ping || 0));
        const hasFriend = r => q && (r.meta.players || []).some(n => String(n).toLowerCase().includes(q));
        if (q) rooms = rooms.filter(r => hasFriend(r) || String(r.meta.name || "").toLowerCase().includes(q));
        if (!rooms.length) {
            list.innerHTML = `<p class="shop-note">${q ? "Nobody by that name is playing right now." : "No servers yet. Press Start or New server to begin one!"}</p>`;
            return;
        }
        list.innerHTML = rooms.map(r => {
            const m = r.meta || {};
            const phase = m.phase === "playing" ? `${clock(Math.max(0, (m.left || 0) - (performance.now() - (m.at || 0))))} left`
                : m.phase === "results" ? "Showing results" : "Starting soon";
            const names = (m.players || []).map(n => {
                const hit = q && String(n).toLowerCase().includes(q);
                return `<span class="${hit ? "srv-friend" : ""}">${esc(n)}</span>`;
            }).join(", ");
            return `<div class="srv-row${r.full ? " full" : ""}">
                <div class="srv-main"><b>${esc(m.name || "Server")}</b>
                    <small>${esc(m.map || "")}${m.map ? " · " : ""}${phase}</small>
                    <small class="srv-names">${names || "&nbsp;"}</small></div>
                <div class="srv-count">${r.players}/${r.max || ROOM_HUMANS}<small>players</small></div>
                <div class="srv-ping ${pingClass(r.ping)}">${r.ping === null ? "?" : "~" + r.ping}<small>ms</small></div>
                <button type="button" class="btn srv-join" data-room="${esc(r.id)}" ${r.full ? "disabled" : ""}>${r.full ? "Full" : "Join"}</button>
            </div>`;
        }).join("");
    }

    function buildBrowser() {
        browser = document.createElement("div");
        browser.className = "servers panel-backdrop";
        browser.hidden = true;
        browser.innerHTML = `<div class="panel" role="dialog" aria-label="Multiplayer Servers">
            <div class="shop-header"><h2>Multiplayer Servers</h2><button type="button" class="close-shop srv-close" aria-label="Close">×</button></div>
            <p class="shop-note">Up to 10 real players per server; bots fill the empty spots. Ping is an estimate.</p>
            <div class="srv-tools">
                <input type="text" class="srv-search" placeholder="Find a friend or server…" autocomplete="off" spellcheck="false">
                <select class="srv-sort" aria-label="Sort"><option value="ping">Lowest ping</option><option value="players">Most players</option></select>
                <button type="button" class="btn srv-refresh">Refresh</button>
                <button type="button" class="btn srv-new">New server</button>
            </div>
            <div class="srv-list"></div>
        </div>`;
        document.body.appendChild(browser);
        browser.querySelector(".srv-search").addEventListener("input", renderBrowser);
        browser.querySelector(".srv-sort").addEventListener("change", renderBrowser);
        browser.addEventListener("click", ev => {
            const t = ev.target;
            if (t === browser || t.closest(".srv-close")) browser.hidden = true;
            else if (t.closest(".srv-refresh")) refreshBrowser();
            else if (t.closest(".srv-new") && !O.role) {
                browser.hidden = true;
                hostRoom();
            } else if (t.closest(".srv-join") && !O.role) {
                browser.hidden = true;
                joinRoom(t.closest(".srv-join").dataset.room);
            }
        });
        document.addEventListener("keydown", ev => ev.key === "Escape" && (browser.hidden = true));
    }


    function isBot(p) {
        return !p.isHuman && !p.remote;
    }

    function tag(p) {
        const name = String(p.name).replace(/^\[(PLAYER|BOTS)\] /, "");
        p.name = (isBot(p) ? TAG_BOT : TAG_PLAYER) + name;
    }

    function onHostWorld(world) {
        if (O.mode !== "multiplayer") return;
        m.world = world;
        world.participants.forEach(tag);
        fitBots();
        startLobby();
        setInterval(hostTick, 250);
        setInterval(publishMeta, 3000);
        publishMeta();
    }

    function fitBots() {
        const world = m.world;
        if (!world) return;
        const humans = world.participants.filter(p => !isBot(p)).length;
        let bots = world.participants.filter(isBot);
        while (bots.length > Math.max(0, ROOM_SIZE - humans)) removeBot(bots.pop());
        for (let n = bots.length; n < ROOM_SIZE - humans; n++) addBot();
        publishMeta();
    }

    function removeBot(p) {
        const world = m.world;
        p.disableAI();
        const obj = p.object;
        if (obj) {
            obj.player = undefined;
            world.delete(obj);
        }
        p.detach();
        world.participants.splice(world.participants.indexOf(p), 1);
        O.hostLog(`<span class="message">${p.html()} left to make room</span>`);
    }

    function addBot() {
        const world = m.world, e = O.engine(), {Plane, Player, vec, consts} = e;
        const used = new Set(world.participants.map(p => p.color));
        const color = (e.require(23).a() || []).find(c => !used.has(c)) || "#555";
        const names = e.require(20).a;
        const taken = new Set(world.participants.map(p => p.name.replace(/^\[(PLAYER|BOTS)\] /, "")));
        let name = names.find(n => !taken.has(n)) || "Bot " + (world.participants.length + 1);
        const plane = new Plane(color);
        const p = new Player(name, color, plane);
        plane.player = p;
        p.maxAmmo = plane.maxAmmo = plane.ammo = consts.b;
        plane.life = consts.h;
        plane.landed = true;
        plane.move(vec(world.width * Math.random(), world.ground));
        world.participants.push(p);
        world.add(plane);
        p.disableAI = e.require(19).a(world, p);
        tag(p);
    }

    function publishMeta() {
        const world = m.world, peer = O.hostState && O.hostState.peer;
        if (!world || !peer || !peer.setMeta) return;
        const strip = n => String(n).replace(/^\[(PLAYER|BOTS)\] /, "");
        const humans = world.participants.filter(p => !isBot(p));
        const nick = (document.getElementsByName("nickname")[0] || {}).value || "Player";
        peer.setMeta({
            name: strip(nick).slice(0, 16) + "'s server",
            players: humans.map(p => strip(p.name)).slice(0, ROOM_HUMANS),
            bots: world.participants.length - humans.length,
            map: world.map ? world.map.name : "",
            phase: m.phase,
            left: Math.max(0, Math.round(m.endsAt - performance.now())),
            rtt: peer.rtt || null,
        });
    }

    function hostTick() {
        if (!m.world || performance.now() < m.endsAt) return;
        if (m.phase === "lobby") {
            m.phase = "playing";
            m.world.frozen = false;
            m.endsAt = performance.now() + MATCH_MS;
            O.hostLog(`<span class="message">The match has started! 10 minutes on the clock.</span>`);
            publishMeta();
        } else if (m.phase === "playing") {
            m.phase = "results";
            m.world.frozen = true;
            m.results = topFive(m.world);
            m.endsAt = performance.now() + RESULTS_MS;
            O.hostBroadcast({t: "results", r: m.results});
            publishMeta();
        } else startLobby();
    }

    function startLobby() {
        const world = m.world, e = O.engine(), {Plane, vec, consts} = e;
        const C = O.engineClasses();
        m.phase = "lobby";
        world.frozen = true;
        world.projectiles.clear();
        world.effects.clear();
        for (const b of [...world.worldEntities]) if (b instanceof C.bodies[1] || b instanceof C.Pilot || b instanceof C.bodies[4]) world.delete(b);
        world.participants.forEach((p, i) => {
            const old = p.object;
            if (old) {
                old.player = undefined;
                world.delete(old);
            }
            p.detach();
            p.kills = p.deaths = 0;
            const plane = new Plane(p.loadoutColor || p.color);
            plane.life = consts.h;
            plane.maxAmmo = plane.ammo = p.maxAmmo || consts.f;
            plane.landed = true;
            plane.move(vec(world.width * (i + 0.5) / world.participants.length, world.ground));
            p.control(plane);
            world.add(plane);
        });
        if (window.BitMaps) {
            world.map = window.BitMaps.pick();
            world.terrainEntities.clear();
            world.atmosphere.length = 0;
            e.decorate(world);
            window.BitMaps.announce(world.map);
        }
        O.hostBroadcast({t: "map", map: world.map && world.map.id, weather: window.BitWeather ? window.BitWeather.current() : "clear"});
        m.endsAt = performance.now() + LOBBY_MS;
        publishMeta();
    }

    function planeOf(p) {
        const plane = p.hasPlane() || p.lastPlane;
        if (plane) p.lastPlane = plane;
        const key = plane && plane.sprite && plane.sprite.planeKey;
        const info = window.BitShop && plane && window.BitShop.planes.find(x => x.id === plane.planeId);
        return {look: key ? [key[0], key[2], key[3]] : [p.color, "", ""], plane: info ? info.name : "Biplane"};
    }

    function topFive(world) {
        return world.participants.slice()
            .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
            .slice(0, 5)
            .map(p => Object.assign({name: p.name, kills: p.kills, deaths: p.deaths}, planeOf(p)));
    }

    function wire() {
        if (!m.phase) return undefined;
        return [PHASES.indexOf(m.phase), Math.max(0, Math.round(m.endsAt - performance.now()))];
    }


    function onGuestState(w) {
        if (!Array.isArray(w)) return;
        O.mode = "multiplayer";
        const phase = PHASES[w[0]], endsAt = performance.now() + Number(w[1] || 0);
        if (phase !== m.phase || Math.abs(endsAt - m.endsAt) > 400) m.endsAt = endsAt;
        m.phase = phase;
    }

    function onGuestMap(msg) {
        const world = O.guestState && O.guestState.world, e = O.engine();
        if (!world || !window.BitMaps) return;
        world.map = window.BitMaps.get(typeof msg.map === "string" ? msg.map : "countryside");
        world.terrainEntities.clear();
        world.atmosphere.length = 0;
        e.decorate(world);
        window.BitWeather && window.BitWeather.force(msg.weather);
        window.BitMaps.announce(world.map);
    }

    function onGuestResults(rows) {
        if (Array.isArray(rows)) m.results = rows.slice(0, 5);
    }


    function clock(ms) {
        const s = Math.ceil(ms / 1000);
        return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }

    function esc(text) {
        return String(text).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[c]);
    }

    function nameHtml(name) {
        const t = String(name).match(/^\[(PLAYER|BOTS)\] (.*)$/);
        return t ? `<span class="tag tag-${t[1].toLowerCase()}">[${t[1]}]</span> ${esc(t[2])}` : esc(name);
    }

    function players() {
        const w = m.world || (O.guestState && O.guestState.world);
        return (w && w.participants) || [];
    }

    function render() {
        const ui = document.querySelector(".ui");
        const playing = !!ui && ui.style.display === "block";
        if (playing && !m.phase) {
            if (!m.localStart) m.localStart = performance.now();
            const t = Math.floor((performance.now() - m.localStart) / 1000);
            timerEl.hidden = false;
            timerEl.classList.remove("ending");
            timerEl.textContent = `⏱ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
            overlayEl.hidden = true;
            return;
        }
        const on = !!m.phase && playing;
        timerEl.hidden = !on || m.phase !== "playing";
        overlayEl.hidden = !on || m.phase === "playing";
        if (!on) return;
        const left = Math.max(0, m.endsAt - performance.now());
        if (m.phase === "playing") {
            timerEl.textContent = "⏱ " + clock(left);
            timerEl.classList.toggle("ending", left < 30000);
            return;
        }
        let html;
        if (m.phase === "lobby") {
            const list = players();
            const humans = list.filter(p => /^\[PLAYER\]/.test(p.name)).length;
            const map = (m.world || (O.guestState && O.guestState.world) || {}).map;
            html = `<h2>Next match in ${Math.ceil(left / 1000)}</h2>
                <p class="match-sub">${map ? esc(map.name) + " · " : ""}${humans} real ${humans === 1 ? "player" : "players"}, ${list.length - humans} bots</p>
                <ul class="match-players">${list.map(p => `<li>${nameHtml(p.name)}</li>`).join("")}</ul>`;
        } else {
            html = `<h2>Session over</h2>
                <table class="match-top">${m.results.map((r, i) => {
                    const [color, skin, pattern] = Array.isArray(r.look) ? r.look : [];
                    const img = window.bitPlaneImage && /^#[0-9a-f]{3,8}$/i.test(color)
                        ? `<img src="${window.bitPlaneImage(color, true, skin || undefined, pattern || "")}" alt="">` : "";
                    return `<tr class="${i === 0 ? "first" : ""}"><td class="rank">${["🥇", "🥈", "🥉", "4", "5"][i]}</td>
                        <td>${img}</td><td class="who">${nameHtml(r.name)}<small>${esc(r.plane || "")}</small></td>
                        <td class="score"><b>${Number(r.kills) || 0}</b> eliminations<small>${Number(r.deaths) || 0} deaths</small></td></tr>`;
                }).join("")}</table>
                <p class="match-sub">Next lobby in ${Math.ceil(left / 1000)}</p>`;
        }
        if (overlayEl.dataset.html !== html) {
            overlayEl.dataset.html = html;
            overlayEl.querySelector(".match-box").innerHTML = html;
        }
    }

    function init() {
        const ui = document.querySelector(".ui") || document.body;
        timerEl = document.createElement("div");
        timerEl.className = "match-timer";
        timerEl.hidden = true;
        overlayEl = document.createElement("div");
        overlayEl.className = "match-overlay";
        overlayEl.hidden = true;
        overlayEl.innerHTML = `<div class="match-box"></div>`;
        ui.appendChild(timerEl);
        ui.appendChild(overlayEl);
        setInterval(render, 200);
        const srv = document.querySelector(".open-servers");
        if (srv) srv.addEventListener("click", openBrowser);
        document.addEventListener("submit", ev => {
            const form = ev.target;
            if (!form || form.id !== "activity") return;
            const mode = form.querySelector('input[name="mode"]:checked');
            if (!mode || mode.value !== "multiplayer") return;
            ev.preventDefault();
            ev.stopImmediatePropagation();
            quickMatch();
        }, true);
        if (new URLSearchParams(location.search).get("multiplayer") === "1") {
            const radio = document.querySelector('input[name="mode"][value="multiplayer"]');
            if (radio) radio.checked = true;
            setTimeout(() => quickMatch(), 800);
        }
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();

    O.match = {
        quickMatch, onHostWorld, wire, onGuestState, onGuestMap, onGuestResults, tag, fitBots, openBrowser,
        frozen: () => !!m.phase && m.phase !== "playing",
        skip: () => {
            if (!m.world) return false;
            m.endsAt = 0;
            return true;
        },
        state: m,
    };
})();
