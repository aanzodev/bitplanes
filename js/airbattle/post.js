// Air Battle (3D): the cinematic look (High and Ultra graphics). The scene is
// drawn into a high dynamic range image (brighter than white is allowed),
// then GLSL passes add bloom (the sun, afterburners, tracers, fire and
// explosions glow), filmic tone mapping (ACES, like film cameras),
// a light color grade, a vignette, a touch of lens color fringing at the
// edges and fine film grain.
(function () {
    const D = window.BitAirBattle = window.BitAirBattle || {};

    const QUAD_VERT = `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = vec4(position.xy, 0.0, 1.0);
        }`;

    // Keep only the bright parts (soft knee), for the glow.
    const BRIGHT_FRAG = `
        uniform sampler2D tex;
        uniform float threshold;
        varying vec2 vUv;
        void main() {
            vec3 c = texture2D(tex, vUv).rgb;
            float l = max(c.r, max(c.g, c.b));
            float k = clamp((l - threshold) / (threshold * 0.6 + 1e-4), 0.0, 1.0);
            gl_FragColor = vec4(c * k * k, 1.0);
        }`;

    // One direction of a 9-tap Gaussian blur.
    const BLUR_FRAG = `
        uniform sampler2D tex;
        uniform vec2 dir;
        varying vec2 vUv;
        void main() {
            vec3 c = texture2D(tex, vUv).rgb * 0.2270270270;
            c += texture2D(tex, vUv + dir * 1.3846153846).rgb * 0.3162162162;
            c += texture2D(tex, vUv - dir * 1.3846153846).rgb * 0.3162162162;
            c += texture2D(tex, vUv + dir * 3.2307692308).rgb * 0.0702702703;
            c += texture2D(tex, vUv - dir * 3.2307692308).rgb * 0.0702702703;
            gl_FragColor = vec4(c, 1.0);
        }`;

    const FINAL_FRAG = `
        uniform sampler2D scene, bloom1, bloom2;
        uniform float bloomStrength, exposure, time, grain, fringe;
        uniform vec2 res;
        varying vec2 vUv;
        vec3 aces(vec3 x) {
            // ACES filmic curve (Narkowicz fit).
            return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
        }
        float rand(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            vec2 d = vUv - 0.5;
            float r2 = dot(d, d);
            // Lens fringing: red and blue shift apart a little toward the edges.
            vec2 off = d * fringe * r2;
            vec3 c;
            c.r = texture2D(scene, vUv + off).r;
            c.g = texture2D(scene, vUv).g;
            c.b = texture2D(scene, vUv - off).b;
            c += (texture2D(bloom1, vUv).rgb * 0.6 + texture2D(bloom2, vUv).rgb * 0.9) * bloomStrength;
            c = aces(c * exposure);
            // Grade: a little more contrast and saturation, cool shadows, warm highlights.
            float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
            c = mix(vec3(l), c, 0.96);
            c = mix(c * vec3(0.97, 0.99, 1.04), c * vec3(1.03, 1.0, 0.96), smoothstep(0.2, 0.8, l));
            c = pow(c, vec3(1.0 / 2.2)); // to the screen's sRGB
            c = (c - 0.5) * 1.04 + 0.5;
            c *= 1.0 - smoothstep(0.18, 0.75, r2) * 0.45; // vignette
            c += (rand(vUv * res + time) - 0.5) * grain;
            gl_FragColor = vec4(c, 1.0);
        }`;

    D.makePost = function (THREE, renderer, opts = {}) {
        const msaa = renderer.capabilities.isWebGL2 ? (opts.samples || 4) : 0;
        const hdr = {type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: false};
        const sceneRT = new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType, samples: msaa});
        const rtA = new THREE.WebGLRenderTarget(1, 1, hdr), rtB = new THREE.WebGLRenderTarget(1, 1, hdr);
        const rtC = new THREE.WebGLRenderTarget(1, 1, hdr), rtD = new THREE.WebGLRenderTarget(1, 1, hdr);
        [rtA, rtB, rtC, rtD].forEach(t => (t.texture.minFilter = t.texture.magFilter = THREE.LinearFilter));

        const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const quadScene = new THREE.Scene();
        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
        quad.frustumCulled = false;
        quadScene.add(quad);
        const mat = (frag, uniforms) => new THREE.ShaderMaterial({vertexShader: QUAD_VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false});
        const bright = mat(BRIGHT_FRAG, {tex: {value: null}, threshold: {value: opts.threshold || 1.0}});
        const blur = mat(BLUR_FRAG, {tex: {value: null}, dir: {value: new THREE.Vector2()}});
        const final = mat(FINAL_FRAG, {
            scene: {value: null}, bloom1: {value: null}, bloom2: {value: null}, bloomStrength: {value: opts.bloom || 0.85},
            exposure: {value: opts.exposure || 1.0}, time: {value: 0}, grain: {value: opts.grain === undefined ? 0.025 : opts.grain},
            fringe: {value: opts.fringe === undefined ? 0.012 : opts.fringe}, res: {value: new THREE.Vector2(1, 1)},
        });

        function pass(material, target) {
            quad.material = material;
            renderer.setRenderTarget(target);
            renderer.render(quadScene, cam);
        }

        let w = 1, h = 1;
        return {
            setSize(width, height) {
                const pr = renderer.getPixelRatio();
                w = Math.max(1, Math.floor(width * pr));
                h = Math.max(1, Math.floor(height * pr));
                sceneRT.setSize(w, h);
                rtA.setSize(w >> 1, h >> 1);
                rtB.setSize(w >> 1, h >> 1);
                rtC.setSize(w >> 2, h >> 2);
                rtD.setSize(w >> 2, h >> 2);
                final.uniforms.res.value.set(w, h);
            },
            render(scene, camera, dt) {
                renderer.setRenderTarget(sceneRT);
                renderer.render(scene, camera);
                // Bright parts at half size, blurred; then again at a quarter size for a wider glow.
                bright.uniforms.tex.value = sceneRT.texture;
                pass(bright, rtA);
                blur.uniforms.tex.value = rtA.texture;
                blur.uniforms.dir.value.set(1 / (w >> 1), 0);
                pass(blur, rtB);
                blur.uniforms.tex.value = rtB.texture;
                blur.uniforms.dir.value.set(0, 1 / (h >> 1));
                pass(blur, rtA);
                blur.uniforms.tex.value = rtA.texture;
                blur.uniforms.dir.value.set(2 / (w >> 2), 0);
                pass(blur, rtC);
                blur.uniforms.tex.value = rtC.texture;
                blur.uniforms.dir.value.set(0, 2 / (h >> 2));
                pass(blur, rtD);
                final.uniforms.scene.value = sceneRT.texture;
                final.uniforms.bloom1.value = rtA.texture;
                final.uniforms.bloom2.value = rtD.texture;
                final.uniforms.time.value = (final.uniforms.time.value + dt) % 100;
                pass(final, null);
            },
            set exposure(v) {
                final.uniforms.exposure.value = v;
            },
            dispose() {
                [sceneRT, rtA, rtB, rtC, rtD].forEach(t => t.dispose());
                [bright, blur, final].forEach(m => m.dispose());
                quad.geometry.dispose();
            },
        };
    };
})();
