import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {spawn, execSync} from "node:child_process";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

function loadPlaywright() {
    try {
        return require("playwright");
    } catch (e) {
        return require(path.join(execSync("npm root -g").toString().trim(), "playwright"));
    }
}
const {chromium} = loadPlaywright();


const TYPES = {".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml",
    ".png": "image/png", ".wasm": "application/wasm", ".json": "application/json", ".mp3": "audio/mpeg", ".ico": "image/x-icon"};

function staticServer() {
    return new Promise(resolve => {
        const srv = http.createServer((req, res) => {
            const url = decodeURIComponent(req.url.split("?")[0]);
            let file = path.join(ROOT, url === "/" ? "index.html" : url);
            if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                return res.end();
            }
            res.writeHead(200, {"Content-Type": TYPES[path.extname(file)] || "application/octet-stream"});
            fs.createReadStream(file).pipe(res);
        });
        srv.listen(0, "127.0.0.1", () => resolve(srv));
    });
}

async function relayServer() {
    if (!fs.existsSync(path.join(ROOT, "server/node_modules/ws"))) return null;
    const port = 20000 + Math.floor(Math.random() * 20000);
    const data = path.join(os.tmpdir(), `bitplanes-test-${process.pid}.json`);
    const proc = spawn(process.execPath, ["index.js"], {cwd: path.join(ROOT, "server"), env: {...process.env, PORT: String(port), DATA_FILE: data}, stdio: "ignore"});
    for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 100));
        const ok = await new Promise(r => http.get(`http://127.0.0.1:${port}/`, res => r(res.statusCode === 200)).on("error", () => r(false)));
        if (ok) return {proc, url: `ws://127.0.0.1:${port}`};
    }
    proc.kill();
    return null;
}


const GL = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"];
let browser, base, relay;
const results = [];

async function page(opts = {}) {
    const ctx = await browser.newContext({viewport: opts.viewport || {width: 1100, height: 700}});
    await ctx.addInitScript(init => {
        localStorage.setItem("daily", JSON.stringify({last: new Date().toLocaleDateString("en-CA"), streak: 1}));
        for (const [k, v] of Object.entries(init)) localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
    }, opts.storage || {});
    const p = await ctx.newPage();
    p.errors = [];
    p.on("pageerror", e => p.errors.push(e.message));
    await p.goto(base + (opts.query || "?server=off"));
    await p.waitForFunction(() => window.BitShop && window.BitEngine && window.BitSettings);
    await p.waitForTimeout(300);
    return p;
}

function check(cond, what) {
    if (!cond) throw new Error(what);
}

async function test(group, name, fn) {
    if (only.length && !only.includes(group)) return;
    const t0 = Date.now();
    const pages = [];
    const open = async opts => {
        const p = await page(opts);
        pages.push(p);
        return p;
    };
    try {
        await fn(open);
        const errs = pages.flatMap(p => p.errors);
        check(!errs.length, "page errors: " + errs.join(" | "));
        results.push({group, name, ok: true, ms: Date.now() - t0});
        console.log(`  ✓ ${group}: ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    } catch (e) {
        results.push({group, name, ok: false, error: e.message});
        console.log(`  ✗ ${group}: ${name}\n      ${e.message.split("\n")[0]}`);
    } finally {
        for (const p of pages) await p.context().close().catch(() => {});
    }
}

const only = process.argv.slice(2);


async function run() {
    const word = "ga" + "me";
    await test("source", `the word "${word}" appears nowhere`, async () => {
        const out = execSync(`grep -rIli "${word}" --exclude-dir=.git --exclude-dir=node_modules --exclude=three.min.js . || true`, {cwd: ROOT}).toString().trim();
        check(!out, "found in: " + out);
    });

    await test("lobby", "every panel opens and closes", async open => {
        const p = await open();
        for (const sel of [".nav-tab.open-stats", ".nav-tab.open-shop", ".nav-tab.open-skins", ".open-quests", ".nav-tab.open-achievements",
            ".lobby-corner .open-settings", ".lobby-corner .open-friends-list", ".open-controls"]) {
            await p.click(sel);
            await p.waitForTimeout(150);
            const shown = await p.evaluate(() => [...document.querySelectorAll(".panel-backdrop, .shop")].some(e => !e.hidden));
            check(shown, sel + " didn't open a panel");
            await p.keyboard.press("Escape");
            await p.waitForTimeout(100);
            await p.evaluate(() => document.querySelectorAll(".panel-backdrop, .shop").forEach(e => (e.hidden = true)));
        }
    });

    await test("lobby", "the mode card cycles through every mode", async open => {
        const p = await open();
        const seen = new Set();
        for (let i = 0; i < 4; i++) {
            seen.add(await p.evaluate(() => document.querySelector('input[name="mode"]:checked').value));
            await p.click(".mode-switch");
        }
        check(seen.size === 3, "modes seen: " + [...seen]);
    });

    async function oneLine(blockAirBattle) {
        const ctx = await browser.newContext({viewport: {width: 1100, height: 700}});
        await ctx.addInitScript(() => localStorage.setItem("daily", JSON.stringify({last: new Date().toLocaleDateString("en-CA"), streak: 1})));
        await ctx.route(/one-line-test\.html/, r => r.fulfill({contentType: "text/html",
            body: `<!doctype html><html><head><meta charset="utf-8"></head><body><script src="${base}js/loader.js"></script></body></html>`}));
        if (blockAirBattle) await ctx.route(/js\/airbattle\/deploy\.js/, r => r.abort());
        const p = await ctx.newPage();
        p.errors = [];
        p.on("pageerror", e => p.errors.push(e.message));
        await p.goto(base + "one-line-test.html?server=off");
        await p.waitForFunction(() => (window.BitShop && document.querySelector(".play-btn") && !document.documentElement.classList.contains("bit-loading")) ||
            document.body.textContent.includes("could not load"), null, {timeout: 60000});
        await p.waitForTimeout(500);
        return p;
    }

    await test("one-line", "the one-line loader builds the whole page", async () => {
        const p = await oneLine(false);
        try {
            const r = await p.evaluate(() => ({failed: document.body.textContent.includes("could not load"), shop: !!window.BitShop,
                airBattle: !!(window.BitAirBattle && window.BitAirBattle.open), modes: document.querySelectorAll('input[name="mode"]').length}));
            check(!r.failed && r.shop && r.airBattle && r.modes === 3 && !p.errors.length, JSON.stringify(r) + p.errors);
        } finally {
            await p.context().close();
        }
    });

    await test("one-line", "the loading screen shows real progress", async () => {
        const ctx = await browser.newContext({viewport: {width: 1100, height: 700}});
        try {
            await ctx.route(/one-line-test\.html/, r => r.fulfill({contentType: "text/html",
                body: `<!doctype html><html><head><meta charset="utf-8"></head><body><script src="${base}js/loader.js"></script></body></html>`}));
            await ctx.route(/\/js\/(?!loader).*\.js/, async r => { await new Promise(t => setTimeout(t, 40)); await r.continue(); });
            const p = await ctx.newPage();
            await p.goto(base + "one-line-test.html?server=off");
            const seen = [];
            for (let i = 0; i < 400 && await p.$(".bit-load"); i++) {
                seen.push(await p.evaluate(() => {
                    const el = document.querySelector(".bit-load");
                    return el ? [parseInt(el.querySelector(".bit-load-pct").textContent), el.querySelector(".bit-load-step").textContent] : null;
                }));
                await p.waitForTimeout(25);
            }
            const pcts = seen.filter(Boolean).map(x => x[0]);
            const steps = new Set(seen.filter(Boolean).map(x => x[1]));
            const rising = pcts.every((v, i) => !i || v >= pcts[i - 1]);
            const ended = await p.evaluate(() => !document.querySelector(".bit-load") && !document.documentElement.classList.contains("bit-loading"));
            check(rising && new Set(pcts).size >= 5 && [...steps].some(x => /file \d+ of \d+/.test(x)) && ended,
                JSON.stringify({pcts: [...new Set(pcts)], steps: [...steps].slice(0, 4), ended}));
        } finally {
            await ctx.close();
        }
    });

    await test("one-line", "a blocked Flight Sessions file doesn't stop Bit Planes", async () => {
        const p = await oneLine(true);
        try {
            const r = await p.evaluate(() => ({failed: document.body.textContent.includes("could not load"), shop: !!window.BitShop,
                modes: [...document.querySelectorAll('input[name="mode"]')].map(x => x.value), note: document.querySelector(".online-status").textContent}));
            check(!r.failed && r.shop && !r.modes.includes("airbattle") && /Flight Sessions/.test(r.note), JSON.stringify(r));
            await p.click(".play-btn");
            await p.waitForTimeout(800);
            check(await p.evaluate(() => document.querySelector(".ui").style.display === "block"), "Bit Planes didn't start");
        } finally {
            await p.context().close();
        }
    });

    await test("source", "every file index.html loads exists", async () => {
        const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
        const missing = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map(m => m[1]).filter(f => !/^https?:/.test(f) && !fs.existsSync(path.join(ROOT, f)));
        check(!missing.length, "missing: " + missing.join(", "));
    });

    await test("2d", "take off, shoot, eject in your pilot skin", async open => {
        const p = await open({storage: {skins: {owned: ["rookie", "neon"], selected: "neon"}}});
        await p.click(".play-btn");
        await p.waitForTimeout(800);
        await p.keyboard.down("ArrowUp");
        await p.waitForTimeout(1200);
        const before = await p.evaluate(() => BitEngine.require(7).c.bullets);
        await p.keyboard.down("Space");
        await p.waitForTimeout(700);
        await p.keyboard.up("Space");
        const after = await p.evaluate(() => BitEngine.require(7).c.bullets);
        check(after > before, "no bullets fired");
        await p.keyboard.press("KeyC");
        await p.waitForTimeout(300);
        const skin = await p.evaluate(() => {
            const pl = BitEngine.player.hasPilot();
            return pl && pl.sprite && pl.sprite.pilotKey;
        });
        check(skin === "neon", "ejected pilot skin: " + skin);
    });

    await test("2d", "a remapped key fires the gun", async open => {
        const p = await open({storage: {settings: {keys2d: {fire: ["Space", "KeyF"]}}}});
        await p.click(".play-btn");
        await p.waitForTimeout(800);
        await p.keyboard.down("ArrowUp");
        await p.waitForTimeout(1000);
        const before = await p.evaluate(() => BitEngine.require(7).c.bullets);
        await p.keyboard.down("KeyF");
        await p.waitForTimeout(600);
        await p.keyboard.up("KeyF");
        check((await p.evaluate(() => BitEngine.require(7).c.bullets)) > before, "F didn't fire");
    });

    await test("2d", "flares: 24 per press over about a second, burning about 4 seconds", async open => {
        const p = await open();
        await p.evaluate(() => (BitShop.give("f16"), BitShop.selectPlane("f16")));
        await p.click(".play-btn");
        await p.waitForTimeout(800);
        await p.keyboard.down("ArrowUp");
        await p.waitForTimeout(1200);
        await p.evaluate(() => {
            const pl = BitEngine.player.hasPlane();
            pl.position.y = BitEngine.world.ground - 1400;
            pl.previous.y = pl.position.y;
            pl.landed = false;
            BitEngine.require(14).f(BitEngine.world, pl);
        });
        const count = () => p.evaluate(() => [...BitEngine.world.effects].filter(x => x.sprite === BitEngine.sprites.flare).length);
        await p.waitForTimeout(1300);
        check((await count()) >= 20, "flares out after 1.3 s: " + (await count()));
        await p.waitForTimeout(2300);
        check((await count()) >= 14, "flares still burning at 3.6 s: " + (await count()));
    });

    await test("career", "XP levels you up, pays coins, unlocks achievements", async open => {
        const p = await open();
        const r = await p.evaluate(() => {
            const c0 = BitShop.state().coins;
            BitProgress.addXp(5000);
            return {level: BitProgress.levelInfo().level, coins: BitShop.state().coins - c0, bonus: BitProgress.upgradeBonus()};
        });
        check(r.level >= 6 && r.coins > 0, JSON.stringify(r));
    });

    await test("career", "Air Battle stays locked until level 10 or a special plane", async open => {
        const a = await open();
        check(!(await a.evaluate(() => BitAirBattle.access().ok)), "new player can play Air Battle");
        const b = await open({storage: {shop: {coins: 0, owned: ["classic", "mig21"], selected: "classic", upgrades: {}, paint: {}, pattern: {}}}});
        check(await b.evaluate(() => BitAirBattle.access().ok), "MiG-21 owner is locked out");
    });

    await test("sound", "every plane's guns sound different", async open => {
        const p = await open();
        const prints = await p.evaluate(async () => {
            const out = [];
            for (const id of Object.keys(BitSoundProfiles)) {
                const sr = 22050, ctx = new OfflineAudioContext(2, sr * 0.6, sr);
                const nb = ctx.createBuffer(1, sr, sr), d = nb.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
                const m = ctx.createGain();
                m.connect(ctx.destination);
                Object.assign(BitSound.state, {ctx, master: m, noise: nb, muted: false});
                BitSound.volleyInto(id, m, 1, 0, 0.4);
                const buf = await ctx.startRendering(), x = buf.getChannelData(0);
                let e = 0, z = 0;
                for (let i = 1; i < x.length; i++) {
                    e += x[i] * x[i];
                    if ((x[i] > 0) !== (x[i - 1] > 0)) z++;
                }
                if (x.some(Number.isNaN)) return ["NaN in " + id];
                out.push(Math.sqrt(e / x.length).toFixed(4) + "/" + z);
            }
            return out;
        });
        p.errors = p.errors.filter(e => !/resume|suspend/i.test(e));
        check(new Set(prints).size === prints.length, "duplicates: " + prints.join(" "));
    });

    await test("sound", "every engine renders without NaN", async open => {
        const p = await open();
        const bad = await p.evaluate(async () => {
            const bad = [];
            for (const [id, prof] of Object.entries(BitSoundProfiles)) {
                const sr = 22050, ctx = new OfflineAudioContext(1, sr * 0.5, sr);
                const nb = ctx.createBuffer(1, sr, sr), d = nb.getChannelData(0);
                for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
                const eng = BitEngines.create(ctx, ctx.destination, prof, nb);
                eng.set(1, {boost: true, speed: 1});
                const x = (await ctx.startRendering()).getChannelData(0);
                if (x.some(Number.isNaN) || !x.some(v => Math.abs(v) > 0.001)) bad.push(id);
            }
            return bad;
        });
        check(!bad.length, "silent or broken: " + bad);
    });

    await test("airbattle", "erosion (WebAssembly and the JavaScript fallback)", async open => {
        const p = await open();
        const r = await p.evaluate(async () => {
            const D = BitAirBattle, w = 129, step = 100, make = () => {
                const g = new Float32Array(w * w);
                for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) g[y * w + x] = 600 * Math.sin(x / 9) * Math.cos(y / 7) + 600;
                return g;
            };
            const a = make(), b = make();
            const js = D.erode(b, w, step, {seed: 3});
            await D.loadErosion();
            const wasm = D.erode(a, w, step, {seed: 3});
            const changed = g => g.some((v, i) => Math.abs(v - make()[i]) > 1);
            return {wasm, js, changedWasm: changed(a), changedJs: changed(b), nan: a.some(Number.isNaN) || b.some(Number.isNaN)};
        });
        check(r.wasm === "wasm" && r.js === "js" && r.changedWasm && r.changedJs && !r.nan, JSON.stringify(r));
    });

    await test("airbattle", "a match: guns, missile lock, flares, eject, results", async open => {
        const p = await open({viewport: {width: 480, height: 270}, storage: {settings: {dfQuality: "low"}}});
        await p.evaluate(() => (BitShop.give("f16"), BitShop.selectPlane("f16")));
        await p.evaluate(() => BitAirBattle.start({map: "alpine", mode: "team", size: 4, difficulty: "normal"}));
        await p.waitForFunction(() => window.BitAirBattle.state() && !document.querySelector(".df-loading"), null, {timeout: 120000});
        const r = await p.evaluate(() => {
            const D = BitAirBattle, g = D.state(), pl = g.player;
            g.paused = true;
            const still = e => {
                e.pilot.think = function () {
                    this.wantFire = false;
                };
                e.input = {pitch: 0, roll: 0, yaw: 0, throttle: 0.7};
            };
            const park = (o, i) => o.pos.set(9000, 7000, -9000 + i * 400);
            g.others.forEach((o, i) => (still(o), park(o, i)));
            pl.quat.identity();
            pl.pos.set(0, 2500, 3000);
            pl.speed = pl.cornerSpeed;
            const foes = g.others.filter(x => x.team !== pl.team), out = {};
            const e = foes[0];
            g.held.add("fire");
            let t = 0;
            while (e.alive && t < 8) {
                e.pos.copy(pl.pos).addScaledVector(pl.forward, 200);
                e.quat.copy(pl.quat);
                D.advance(0.1);
                t += 0.1;
            }
            g.held.delete("fire");
            out.gunKill = !e.alive;
            g.respawnAt.delete(e);
            const e2 = foes.find(f => f !== e && f.alive);
            e2.flares = 0;
            for (let i = 0; i < 40 && g.lock.progress < 1; i++) {
                foes.forEach((f, k) => f !== e2 && f.alive && park(f, k));
                e2.pos.copy(pl.pos).addScaledVector(pl.forward, 900);
                e2.quat.copy(pl.quat);
                D.advance(0.1);
            }
            out.locked = !!g.lock.target && g.lock.progress >= 1;
            const h = e2.health;
            g.combat.launch(pl, e2);
            for (let i = 0; i < 60 && e2.alive && e2.health === h; i++) D.advance(0.1);
            out.missileHit = e2.health < h || !e2.alive;
            const shooter = foes.find(f => f !== e && f !== e2 && f.alive) || e2;
            shooter.pos.copy(pl.pos).addScaledVector(pl.forward, -1500);
            shooter.quat.copy(pl.quat);
            pl.health = pl.maxHealth;
            pl.flares = 3;
            g.combat.launch(shooter, pl);
            D.advance(0.3);
            g.combat.dropFlares(pl, 1);
            D.advance(4);
            out.flareSaved = pl.alive && pl.health === pl.maxHealth;
            const deaths = pl.deaths;
            g.paused = false;
            g.onKey({type: "keydown", code: g.binds.eject[0], repeat: false, target: document.body, preventDefault() {}, stopImmediatePropagation() {}});
            g.paused = true;
            D.advance(0.3);
            out.ejected = pl.deaths === deaths + 1 && g.chutes.length > 0;
            D.advance(6);
            out.respawned = pl.alive;
            g.match.blue = g.match.goal;
            D.advance(0.1);
            out.results = !document.querySelector(".df-results").hidden;
            return out;
        });
        for (const [k, v] of Object.entries(r)) check(v, k + " failed: " + JSON.stringify(r));
    });

    await test("airbattle", "computer pilots fight (kills in 60 s, few crashes)", async open => {
        const p = await open({viewport: {width: 480, height: 270}, storage: {settings: {dfQuality: "low"}}});
        await p.evaluate(() => BitAirBattle.start({map: "canyon", mode: "team", size: 6, difficulty: "hard"}));
        await p.waitForFunction(() => window.BitAirBattle.state() && !document.querySelector(".df-loading"), null, {timeout: 120000});
        const r = await p.evaluate(() => {
            const D = BitAirBattle, g = D.state(), pl = g.player;
            g.paused = true;
            pl.pilot = D.makePilot(g.THREE, pl, 0.8);
            g.others.push(pl);
            const feed = [];
            const orig = g.hud.feed;
            g.hud.feed = h => (feed.push(h.replace(/<[^>]+>/g, "")), orig(h));
            D.advance(60);
            return {kills: g.planes.reduce((a, x) => a + x.kills, 0), crashes: feed.filter(f => /crashed/.test(f)).length};
        });
        check(r.kills >= 3 && r.crashes <= 3, JSON.stringify(r));
    });

    if (!relay) {
        console.log("  - online tests skipped (run npm install in server/)");
        return;
    }
    const q = `?server=${relay.url}&direct=off`;

    await test("online", "private room through the relay server", async open => {
        const h = await open({query: q});
        await h.click(".open-friends");
        await h.click(".host-activity");
        await h.waitForFunction(() => /[A-Z0-9]{5}/.test((document.querySelector(".room-banner") || {}).textContent || ""), null, {timeout: 20000});
        const code = (await h.textContent(".room-banner")).match(/Room code: ([A-Z0-9]{5})/)[1];
        const g = await open({query: q});
        await g.click(".open-friends");
        await g.fill(".room-code", code);
        await g.click(".join-activity");
        await g.waitForFunction(() => window.BitOnline.guestState.world, null, {timeout: 20000});
    });

    await test("online", "Multiplayer: matchmaking, 10 planes, [PLAYER] tags", async open => {
        const a = await open({query: q});
        await a.evaluate(() => (document.querySelector('input[value="multiplayer"]').checked = true));
        await a.click(".play-btn");
        await a.waitForFunction(() => BitOnline.role === "host" && BitOnline.match.state.phase, null, {timeout: 20000});
        const b = await open({query: q});
        await b.evaluate(() => (document.querySelector('input[value="multiplayer"]').checked = true));
        await b.click(".play-btn");
        await b.waitForFunction(() => BitOnline.role === "guest" && BitOnline.match.state.phase, null, {timeout: 20000});
        await b.waitForTimeout(1000);
        const r = await a.evaluate(() => {
            const ps = BitEngine.world.participants;
            return [ps.length, ps.filter(x => /^\[PLAYER\]/.test(x.name)).length];
        });
        check(r[0] === 10 && r[1] === 2, JSON.stringify(r));
    });

    await test("online", "friends: request, accept, see each other online", async open => {
        const a = await open({query: q, storage: {nickname: "Ann"}}), b = await open({query: q, storage: {nickname: "Ben"}});
        await a.waitForFunction(() => BitSocial.connected(), null, {timeout: 15000});
        await b.waitForFunction(() => BitSocial.connected(), null, {timeout: 15000});
        const code = await b.evaluate(() => BitSocial.code());
        await a.evaluate(c => BitSocial._send({op: "fadd", code: c}), code);
        await b.waitForTimeout(600);
        await b.evaluate(() => BitSocial.openFriends());
        await b.click(".friend-accept");
        await a.waitForFunction(() => BitSocial.friends().some(f => f.name === "Ben"), null, {timeout: 10000});
    });
}


const files = await staticServer();
base = `http://127.0.0.1:${files.address().port}/`;
relay = await relayServer();
browser = await chromium.launch({args: GL});
console.log("Bit Planes tests\n");
try {
    await run();
} finally {
    await browser.close();
    files.close();
    if (relay) relay.proc.kill();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
