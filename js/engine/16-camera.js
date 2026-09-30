// Canvas setup and the follow camera.
BitModules[16] = function (M, j, t) {
    "use strict";

    function L(M, j) {
        const t = j.getContext("2d", {
                alpha: !1,
            }),
            L = {
                offsetX: 0,
                offsetY: 0,
                width: j.width,
                height: j.height,
                cameraScale: M,
            };

        function N() {
            let M = Math.min(window.devicePixelRatio || 1, window.bitRenderScale || 1.5) / L.cameraScale,
                { width: N, height: i } = j.getBoundingClientRect();
            ((N *= L.cameraScale),
                (i *= L.cameraScale),
                (j.width = N * M),
                (j.height = i * M),
                (L.width = N),
                (L.height = i),
                t.scale(M, M));
        }
        return (
            N(),
            window.addEventListener("resize", N, !1),
            window.addEventListener("orientationchange", N, !1),
            [L, t]
        );
    }

    function N(M, j, t, L) {
        const N = Math.floor(M.width / 2),
            i = Math.floor(M.height / 2),
            u = t.hasPlane() || t.hasPilot();
        if (!u) return;
        const e = u.getX(L),
            I = u.getY(L);
        (e > M.offsetX + M.width - N && (M.offsetX = e - M.width + N),
            e < M.offsetX + N && (M.offsetX = e - N),
            I > M.offsetY + i && (M.offsetY = I - i),
            I < M.offsetY + i && (M.offsetY = I - i),
            M.offsetX < 0 && (M.offsetX = 0),
            M.offsetX + M.width > j.width && (M.offsetX = j.width - M.width),
            M.offsetY + M.height > j.height && (M.offsetY = j.height - M.height));
    }
    (t.d(j, "b", function () {
        return L;
    }),
        t.d(j, "a", function () {
            return N;
        }));
};
