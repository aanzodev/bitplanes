// Adaptive render resolution: if frames get slow, render the game canvas at a
// lower pixel density so the game stays smooth.
(function () {
    const steps = [1.5, 1.25, 1, 0.75];
    let index = 0;
    let average = 1 / 60;
    let frames = 0;

    window.bitRenderScale = steps[index];

    window.bitAdaptQuality = function (dt) {
        // Ignore pauses such as switching tabs.
        if (dt <= 0 || dt > 0.25) return;
        average = average * 0.95 + dt * 0.05;
        frames++;
        if (frames < 90 || index >= steps.length - 1) return;
        // Going below 1x only when things are really slow (under ~28 fps).
        const limit = steps[index + 1] < 1 ? 1 / 28 : 1 / 50;
        if (average <= limit) return;

        const dpr = window.devicePixelRatio || 1;
        const before = Math.min(dpr, steps[index]);
        index++;
        window.bitRenderScale = steps[index];
        if (Math.min(dpr, steps[index]) < before) {
            window.dispatchEvent(new Event("resize"));
            frames = 0;
            average = 1 / 60;
        }
    };
})();
