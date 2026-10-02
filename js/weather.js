// Weather: every match rolls clear skies, rain, fog or a thunderstorm (snow on
// the Arctic map, a sandstorm instead of fog in the Desert). Online, everyone
// gets the host's weather. It's drawn over the world every frame and doesn't
// change how planes fly.
window.BitWeather = (function () {
    const CHANCES = [["clear", 0.45], ["rain", 0.2], ["fog", 0.15], ["storm", 0.2]];
    const TYPES = ["clear", "rain", "fog", "storm"];

    let type = "clear", mapId = "", forced = null;
    let drops = [], flash = 0, bolt = null, nextBolt = 0, lastCam = null, time = 0;

    function roll() {
        let r = Math.random();
        for (const [t, chance] of CHANCES) if ((r -= chance) < 0) return t;
        return "clear";
    }

    const snowy = () => mapId === "arctic";
    const sandy = () => mapId === "desert";

    function name() {
        if (type === "rain") return snowy() ? "Snow" : "Rain";
        if (type === "fog") return sandy() ? "Sandstorm" : "Fog";
        if (type === "storm") return snowy() ? "Blizzard" : "Thunderstorm";
        return "Clear skies";
    }

    function icon() {
        return {clear: "☀️", rain: snowy() ? "🌨️" : "🌧️", fog: sandy() ? "🌪️" : "🌫️", storm: snowy() ? "❄️" : "⛈️"}[type];
    }

    function set(t, map) {
        type = TYPES.includes(t) ? t : "clear";
        if (map) mapId = map.id || "";
        drops = [];
        flash = 0;
        bolt = null;
        nextBolt = performance.now() + 3000 + Math.random() * 5000;
    }

    // A match starts: the host's weather when we joined one, otherwise a new roll.
    function start(map) {
        set(forced || roll(), map);
        forced = null;
        return type;
    }

    // Online guests: use this weather for the next start().
    function force(t) {
        forced = TYPES.includes(t) ? t : null;
    }

    // ---------------------------------------------------------------- drawing

    function makeDrops(w, h, count) {
        drops = [];
        for (let i = 0; i < count; i++) {
            drops.push({x: Math.random() * w, y: Math.random() * h, s: 0.6 + Math.random() * 0.8, p: Math.random() * 6.28});
        }
    }

    function precipitation(ctx, w, h, dt, dx, dy, heavy) {
        const count = heavy ? 320 : 170;
        if (drops.length !== count) makeDrops(w, h, count);
        const snow = snowy();
        const fall = snow ? 70 : 900, wind = heavy ? (snow ? 140 : 260) : (snow ? 30 : 110);
        ctx.save();
        if (snow) ctx.fillStyle = "rgba(255,255,255,0.85)";
        else {
            ctx.strokeStyle = heavy ? "rgba(190,205,230,0.5)" : "rgba(200,215,240,0.45)";
            ctx.lineWidth = 1;
            ctx.beginPath();
        }
        for (const d of drops) {
            // Move with the world (camera) so the rain stays put while you fly through it.
            d.x += wind * d.s * dt - dx;
            d.y += fall * d.s * dt - dy;
            if (snow) d.x += Math.sin(time * 1.5 + d.p) * 12 * dt;
            d.x = ((d.x % w) + w) % w;
            d.y = ((d.y % h) + h) % h;
            if (snow) ctx.fillRect(d.x, d.y, 2 * d.s + 1, 2 * d.s + 1);
            else {
                ctx.moveTo(d.x, d.y);
                ctx.lineTo(d.x - wind * d.s * 0.018, d.y - 14 * d.s);
            }
        }
        if (!snow) ctx.stroke();
        ctx.restore();
    }

    function haze(ctx, w, h) {
        const sand = sandy();
        const base = sand ? "214,178,120" : "228,232,236";
        ctx.save();
        ctx.fillStyle = `rgba(${base},${sand ? 0.28 : 0.3})`;
        ctx.fillRect(0, 0, w, h);
        // Slow drifting bands so the fog moves.
        for (let i = 0; i < 3; i++) {
            const y = h * (0.2 + 0.3 * i) + Math.sin(time * 0.3 + i * 2) * 40;
            const g = ctx.createLinearGradient(0, y - 90, 0, y + 90);
            g.addColorStop(0, `rgba(${base},0)`);
            g.addColorStop(0.5, `rgba(${base},${sand ? 0.25 : 0.22})`);
            g.addColorStop(1, `rgba(${base},0)`);
            ctx.fillStyle = g;
            ctx.fillRect(0, y - 90, w, 180);
        }
        ctx.restore();
    }

    function lightning(ctx, w, h, dt) {
        const now = performance.now();
        if (now > nextBolt) {
            nextBolt = now + 5000 + Math.random() * 9000;
            flash = 1;
            const pts = [[w * (0.15 + Math.random() * 0.7), 0]];
            const end = h * (0.55 + Math.random() * 0.3);
            while (pts[pts.length - 1][1] < end) {
                const [x, y] = pts[pts.length - 1];
                pts.push([x + (Math.random() - 0.5) * 60, y + 25 + Math.random() * 35]);
            }
            bolt = pts;
            if (window.BitSound && window.BitSound.thunder) setTimeout(() => window.BitSound.thunder(), 300 + Math.random() * 900);
        }
        if (flash <= 0) return;
        ctx.save();
        ctx.fillStyle = `rgba(235,240,255,${0.55 * flash})`;
        ctx.fillRect(0, 0, w, h);
        if (bolt && flash > 0.45) {
            ctx.strokeStyle = "rgba(255,255,255,0.95)";
            ctx.shadowColor = "#bcd4ff";
            ctx.shadowBlur = 12;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            bolt.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
            ctx.stroke();
        }
        ctx.restore();
        flash -= dt * 2.5;
    }

    // Called after each frame is drawn. cam has width, height, offsetX, offsetY.
    function draw(ctx, cam, world, dt) {
        if (type === "clear" || !ctx || !cam) return;
        dt = Math.min(dt || 0, 0.1);
        time += dt;
        const w = cam.width, h = cam.height;
        const dx = lastCam ? cam.offsetX - lastCam.x : 0, dy = lastCam ? cam.offsetY - lastCam.y : 0;
        lastCam = {x: cam.offsetX, y: cam.offsetY};
        // A big jump means a respawn or the world wrapping around: don't streak.
        const jump = Math.abs(dx) > 300 || Math.abs(dy) > 300;
        if (type === "storm") {
            ctx.save();
            ctx.fillStyle = snowy() ? "rgba(200,210,225,0.25)" : `rgba(15,20,35,${mapId === "night" ? 0.12 : 0.3})`;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
            precipitation(ctx, w, h, dt, jump ? 0 : dx, jump ? 0 : dy, true);
            if (!snowy()) lightning(ctx, w, h, dt);
        } else if (type === "rain") {
            precipitation(ctx, w, h, dt, jump ? 0 : dx, jump ? 0 : dy, false);
        } else if (type === "fog") {
            haze(ctx, w, h);
        }
    }

    return {start, force, set: t => set(t), current: () => type, name, icon, draw, types: TYPES};
})();
