// Online play: turning activity objects, sprites and particles into small
// messages and back again.
(function () {
    const O = window.BitOnline;
    const {engine, round} = O;

    let classes;

    function engineClasses() {
        if (classes) return classes;
        const r = engine().require;
        const p = r(10);
        classes = {
            // plane, missile, bullet, pilot, parachute, barn, cow
            bodies: [r(4).a, r(5).a, r(15).a, r(8).b, r(8).a, r(17).a, r(11).a],
            particles: [p.f, p.a, p.c, p.b, p.d, p.e],
        };
        classes.Plane = classes.bodies[0];
        classes.Pilot = classes.bodies[3];
        classes.Cow = classes.bodies[6];
        return classes;
    }

    // Sprites are sent by name ("explosion.3") or, for planes, by their look.
    let spriteKeys, spritesByKey;

    function indexSprites() {
        if (spriteKeys) return;
        spriteKeys = new Map();
        spritesByKey = new Map();
        const Sprite = engine().Sprite;
        (function walk(obj, path) {
            for (const k of Object.keys(obj)) {
                const v = obj[k];
                const p = path ? path + "." + k : k;
                if (v instanceof Sprite) {
                    spriteKeys.set(v, p);
                    spritesByKey.set(p, v);
                } else if (v && typeof v === "object") {
                    walk(v, p);
                }
            }
        })(engine().sprites, "");
    }

    function spriteKey(sprite) {
        if (!sprite) return null;
        if (sprite.planeKey) return "plane|" + sprite.planeKey.join("|");
        return spriteKeys.get(sprite) || null;
    }

    function spriteFromKey(key) {
        if (spritesByKey.has(key)) return spritesByKey.get(key);
        if (typeof key === "string" && key.startsWith("plane|")) {
            const [, color, pilot, skin] = key.split("|");
            if (!/^#[0-9a-f]{3,8}$/i.test(color)) return null;
            const sprite = new (engine().Sprite)(window.bitPlaneImage(color, pilot === "1", skin || undefined), 36, 22);
            spritesByKey.set(key, sprite);
            return sprite;
        }
        return null;
    }

    function lookKey(o) {
        let key = spriteKey(o.sprite) || "";
        if (o.constructor === classes.Cow) key += "~" + [o.running ? 1 : 0, o.direction, o.dead ? 1 : 0].join(",");
        return key;
    }

    function applyLook(o, key) {
        o.look = key;
        const [sprite, cow] = String(key).split("~");
        const s = spriteFromKey(sprite);
        if (s) o.sprite = s;
        if (cow) {
            const [running, direction, dead] = cow.split(",").map(Number);
            o.running = !!running;
            o.direction = direction;
            o.dead = !!dead;
        }
    }

    function isVector(v) {
        return v && typeof v === "object" && typeof v.x === "number" && typeof v.y === "number" && Object.keys(v).length === 2;
    }

    const TIME_FIELDS = ["createdAt", "timeSinceFrameShown"];

    function serializeParticle(p) {
        const cls = classes.particles.indexOf(p.constructor);
        if (cls < 0) return null;
        const now = performance.now();
        const f = {};
        for (const [k, v] of Object.entries(p)) {
            if (typeof v === "number") f[k] = TIME_FIELDS.includes(k) ? now - v : round(v, 3);
            else if (typeof v === "string" || typeof v === "boolean") f[k] = v;
            else if (k === "sprite") {
                const s = spriteKey(v);
                if (!s) return null;
                f.sprite = s;
            } else if (k === "sprites" && Array.isArray(v)) {
                const s = v.map(spriteKey);
                if (s.some(x => !x)) return null;
                f.sprites = s;
            } else if (isVector(v)) f[k] = {x: round(v.x, 1), y: round(v.y, 1)};
        }
        return [cls, f];
    }

    function spawnParticle(world, [cls, f]) {
        const C = classes.particles[cls];
        if (!C) return;
        const p = Object.create(C.prototype);
        const now = performance.now();
        for (const [k, v] of Object.entries(f)) {
            if (k === "sprite") p.sprite = spriteFromKey(v);
            else if (k === "sprites") p.sprites = v.map(spriteFromKey);
            else if (TIME_FIELDS.includes(k)) p[k] = now - v;
            else if (v && typeof v === "object") p[k] = {x: v.x, y: v.y};
            else p[k] = v;
        }
        if (("sprite" in f && !p.sprite) || (p.sprites && p.sprites.some(s => !s))) return;
        world.particles.add(p);
        const S = window.BitSound;
        if (S && p.position) {
            if (f.sprites && String(f.sprites[0]).startsWith("explosion")) S.explosion(p.position);
            if (f.sprite === "flare") S.flaresAt(p.position);
        }
    }

    Object.assign(O, {engineClasses, indexSprites, spriteKey, spriteFromKey, lookKey, applyLook, serializeParticle, spawnParticle});
})();
