# Bit Planes

A small browser dogfighting game. Open `index.html` through any static web server
(for example `python3 -m http.server`) and press **Start**.

## Hangar (shop)

Every kill earns 10 coins. Spend them in the **Hangar** on the start screen:

- **Planes**: Classic (free), Swift, Gunship, Fortress, Phantom, and the jets
  F-16 Falcon, A-10 Warthog and **F-22 Raptor** (10,000 coins; 3 missiles and
  faster bullets built in).
- **Upgrades**: engine, handling, armor, ammo belt, reload and missile rack.
  They apply to whichever plane you fly.

Coins, planes and upgrades are saved in your browser (localStorage).

### Test commands

Open the browser console (F12) on the game page:

| Command | What it does |
|---|---|
| `addCoins(1000)` | Add coins (any amount) |
| `setCoins(10000)` | Set your coins to an exact amount |
| `unlockAll()` | Own every plane and max every upgrade |
| `resetShop()` | Back to 0 coins and the Classic plane |

Or open the page with `?coins=10000` in the URL to add coins once.

## Online play

1. One player presses **Host a room**. A death match starts and a 5 character
   room code appears at the top of the screen.
2. Friends type the code under **Play online with friends** and press **Join**.
   They can join at any time during the match.

Each player flies with their own plane and upgrades, and kills earn coins for
whoever made them. The host's browser runs the game, so the host should have
the best connection. If the host closes the page the room ends.

Players connect directly to each other (WebRTC via [PeerJS](https://peerjs.com),
bundled as `peerjs.min.js`). The free PeerJS cloud server is only used to find
each other. To use your own server instead (for example on a local network
without internet), run a [PeerJS server](https://github.com/peers/peerjs-server)
and add `?peerhost=<ip>&peerport=9000` to the URL for everyone.
