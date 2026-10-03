# Online relay server

School and office Wi-Fi usually block the direct player-to-player connections
online play uses by default. This small server fixes that: everyone connects to
it over a normal secure WebSocket on port 443 (like any website), and it passes
messages between the host and the guests. The host's browser still runs the
activity, so the server does very little work.

## Deploy it for free on Render (about 5 minutes)

1. Go to <https://render.com> and sign up with your GitHub account.
2. Click **New** → **Blueprint**, pick the `bitplanes` repository and click
   **Apply**. Render reads `render.yaml` and creates a free web service called
   `bitplanes-relay`.
3. Wait until it says **Live**, then copy its address at the top of the page,
   for example `https://bitplanes-relay.onrender.com`. Opening it in a browser
   shows "Bit Planes relay server is running."
4. In the repository, edit `js/online/config.js` and put the address in with
   `wss://` instead of `https://`:

   ```js
   window.BitOnlineServer = "wss://bitplanes-relay.onrender.com";
   ```

5. Commit. Everyone who loads the activity now goes through the server.

Players connect directly when their network allows it and only use the
server when it doesn't, so the server is only busy for players who need it.

When you change `server/`, Render redeploys it by itself after the change is
merged into `main` (a few minutes). Browsers work with both the old and the new
server in the meantime.

The free plan goes to sleep after about 15 minutes without players. The first
room after that takes up to a minute while it wakes up (the page says so).

To try a server without changing `config.js`, add `?server=wss://...` to the
page address. `?server=off` goes back to direct connections.

## Run it on your own computer

```sh
cd server
npm install
npm start            # listens on port 8787 (or $PORT)
```

Then open the activity with `?server=ws://localhost:8787`.
