// Online play: the "Host a room" / "Join" buttons on the start screen.
(function () {
    const O = window.BitOnline;
    const {status} = O;

    function init() {
        const hostBtn = document.querySelector(".host-game");
        const joinBtn = document.querySelector(".join-game");
        const codeInput = document.querySelector(".room-code");
        if (typeof Peer === "undefined") {
            status("Online play is unavailable (PeerJS failed to load).");
            if (hostBtn) hostBtn.disabled = true;
            if (joinBtn) joinBtn.disabled = true;
            return;
        }
        hostBtn && hostBtn.addEventListener("click", O.startHost);
        joinBtn && joinBtn.addEventListener("click", () => O.join(codeInput.value));
        codeInput && codeInput.addEventListener("keydown", ev => {
            if (ev.key === "Enter") {
                ev.preventDefault();
                O.join(codeInput.value);
            }
        });
        const q = new URLSearchParams(location.search).get("room");
        if (q && codeInput) codeInput.value = q.toUpperCase();
    }

    window.BitNet = {onWorld: O.onWorld, rewardRemote: O.rewardRemote, host: O.startHost, join: O.join};

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
