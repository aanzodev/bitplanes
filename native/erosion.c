
typedef unsigned int u32;

static u32 rng;

static float rnd(void) {
    rng ^= rng << 13;
    rng ^= rng >> 17;
    rng ^= rng << 5;
    return (rng >> 8) * (1.0f / 16777216.0f);
}

static inline float fsqrt(float x) {
    return __builtin_sqrtf(x);
}

static inline float fmaxf_(float a, float b) {
    return a > b ? a : b;
}

static inline float fminf_(float a, float b) {
    return a < b ? a : b;
}

extern unsigned char __heap_base;
static unsigned long heap_top = 0;

__attribute__((export_name("alloc")))
void *alloc(unsigned long bytes) {
    if (!heap_top) heap_top = (unsigned long)&__heap_base;
    unsigned long p = (heap_top + 15) & ~15UL;
    unsigned long end = p + bytes;
    unsigned long have = __builtin_wasm_memory_size(0) * 65536UL;
    if (end > have) {
        unsigned long pages = (end - have + 65535) / 65536;
        if (__builtin_wasm_memory_grow(0, pages) == (unsigned long)-1) return 0;
    }
    heap_top = end;
    return (void *)p;
}

__attribute__((export_name("reset")))
void reset(void) {
    heap_top = 0;
}

static void sample(const float *h, int w, float x, float y, float *height, float *gx, float *gy) {
    int ix = (int)x, iy = (int)y;
    float u = x - ix, v = y - iy;
    int i = iy * w + ix;
    float a = h[i], b = h[i + 1], c = h[i + w], d = h[i + w + 1];
    *gx = (b - a) * (1 - v) + (d - c) * v;
    *gy = (c - a) * (1 - u) + (d - b) * u;
    *height = a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

static void take(float *h, int w, int x, int y, float amount) {
    static const float k[9] = {0.05f, 0.1f, 0.05f, 0.1f, 0.4f, 0.1f, 0.05f, 0.1f, 0.05f};
    int n = 0;
    for (int dy = -1; dy <= 1; dy++)
        for (int dx = -1; dx <= 1; dx++, n++) {
            int px = x + dx, py = y + dy;
            if (px < 0 || py < 0 || px >= w || py >= w) continue;
            h[py * w + px] -= amount * k[n];
        }
}

__attribute__((export_name("erode")))
void erode(float *h, int w, int drops, u32 seed, float strength, float seaLevel) {
    const float inertia = 0.05f, capacityK = 4.0f, minCapacity = 0.01f;
    const float erodeK = 0.3f * strength, depositK = 0.3f, evaporate = 0.015f, gravity = 4.0f;
    const int maxSteps = 64;
    rng = seed ? seed : 1u;
    for (int d = 0; d < drops; d++) {
        float x = 1 + rnd() * (w - 3), y = 1 + rnd() * (w - 3);
        float dx = 0, dy = 0, speed = 1, water = 1, sediment = 0;
        for (int s = 0; s < maxSteps; s++) {
            int ix = (int)x, iy = (int)y;
            float u = x - ix, v = y - iy;
            float height, gx, gy;
            sample(h, w, x, y, &height, &gx, &gy);
            if (height < seaLevel) {
                if (sediment > 0) {
                    int i = iy * w + ix;
                    h[i] += sediment * 0.25f;
                }
                break;
            }
            dx = dx * inertia - gx * (1 - inertia);
            dy = dy * inertia - gy * (1 - inertia);
            float len = fsqrt(dx * dx + dy * dy);
            if (len < 1e-6f) {
                float a = rnd() * 6.2831853f;
                dx = a < 3.14159f ? 1 - a / 1.5708f : -3 + a / 1.5708f;
                dy = 1 - (dx < 0 ? -dx : dx);
                len = fsqrt(dx * dx + dy * dy);
            }
            dx /= len;
            dy /= len;
            float nx = x + dx, ny = y + dy;
            if (nx < 1 || ny < 1 || nx >= w - 2 || ny >= w - 2) break;
            float newHeight, t1, t2;
            sample(h, w, nx, ny, &newHeight, &t1, &t2);
            float drop = newHeight - height;
            float capacity = fmaxf_(-drop * speed * water * capacityK, minCapacity);
            int i = iy * w + ix;
            if (sediment > capacity || drop > 0) {
                float amount = drop > 0 ? fminf_(drop, sediment) : (sediment - capacity) * depositK;
                sediment -= amount;
                h[i] += amount * (1 - u) * (1 - v);
                h[i + 1] += amount * u * (1 - v);
                h[i + w] += amount * (1 - u) * v;
                h[i + w + 1] += amount * u * v;
            } else {
                float amount = fminf_((capacity - sediment) * erodeK, -drop);
                take(h, w, ix, iy, amount);
                sediment += amount;
            }
            float sp2 = speed * speed + drop * gravity;
            speed = fsqrt(sp2 > 0 ? sp2 : 0);
            water *= 1 - evaporate;
            x = nx;
            y = ny;
        }
    }
}

__attribute__((export_name("smooth")))
void smooth(float *h, float *tmp, int w) {
    for (int y = 1; y < w - 1; y++)
        for (int x = 1; x < w - 1; x++) {
            int i = y * w + x;
            float avg = (h[i - 1] + h[i + 1] + h[i - w] + h[i + w]) * 0.25f;
            tmp[i] = h[i] * 0.7f + avg * 0.3f;
        }
    for (int y = 1; y < w - 1; y++)
        for (int x = 1; x < w - 1; x++) h[y * w + x] = tmp[y * w + x];
}
