# ✈️ Bit Planes

A small browser dogfighting game. Fly biplanes, WWII fighters and jets, shoot
down computer pilots, earn coins, upgrade your plane and play with friends
online using a room code.

![Start screen](docs/screenshots/start.png)

## Play

Open `index.html` through any static web server and press **Start**:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

It also works on GitHub Pages as is. There is no build step.

## Controls

| Key | Action |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> | Thrust up / down |
| <kbd>←</kbd> <kbd>→</kbd> | Pitch (elevator) |
| <kbd>Space</kbd> | Fire the gun |
| <kbd>X</kbd> | Fire a missile |
| <kbd>Q</kbd> | Drop flares: breaks missile locks (F-16, A-10 and F-22 only) |
| <kbd>C</kbd> | Eject / open parachute. Land at the barn for a new plane |

## Hangar

Every kill earns **10 coins**. Spend them in the **Hangar** on the start screen.

![Hangar](docs/screenshots/hangar.png)

| Plane | Price | Notes |
|---|---:|---|
| Classic | free | Balanced starter biplane |
| Swift | 150 | Fast and agile, fewer bullets |
| Gunship | 300 | Big ammo belt, quick reload |
| Fortress | 500 | Heavy armor, extra missiles, slow |
| Sopwith Camel | 750 | Turns on a dime |
| Phantom | 1,000 | Better at everything |
| A6M Zero | 1,200 | Light and nimble prop fighter |
| Spitfire | 1,500 | Quick climber, eight guns |
| P-51 Mustang | 2,000 | Fast escort fighter |
| **F-16 Falcon** ★ | 2,500 | Jet, fast gun, 3 flares |
| **A-10 Warthog** ★ | 5,000 | Flying tank, huge cannon belt, 3 flares |
| **F-22 Raptor** ★ | 10,000 | 3 missiles, faster bullets, 3 flares |

★ Special planes have a black border in the Hangar and carry flares.

Upgrades (engine, handling, armor, ammo belt, reload, missile rack) apply to
whichever plane you fly. Coins and purchases are saved in your browser.

### Test commands

Open the browser console (F12) on the game page:

| Command | What it does |
|---|---|
| `addCoins(1000)` | Add coins |
| `setCoins(10000)` | Set your coins to an exact amount |
| `unlockAll()` | Own every plane and max every upgrade |
| `resetShop()` | Back to 0 coins and the Classic plane |

Or add `?coins=10000` to the page URL to add coins once.

## Online play

![In game](docs/screenshots/game.png)

1. One player presses **Host a room**. A death match starts and a 5 character
   room code appears at the top of the screen.
2. Friends type the code under **Play online with friends** and press **Join**.
   They can join at any time during the match.

Everyone flies their own plane and upgrades, and kills earn coins for whoever
made them. The host's browser runs the game, so the host should have the best
connection. If the host closes the page the room ends.

Players connect directly to each other (WebRTC via [PeerJS](https://peerjs.com)).
The free PeerJS cloud server is only used to find each other. To use your own
server instead (for example on a local network), run a
[PeerJS server](https://github.com/peers/peerjs-server) and add
`?peerhost=<ip>&peerport=9000` to the URL for everyone.

## Project layout

```
index.html              Start screen, HUD and script tags
css/
  base.css              Page, buttons, keys
  menu.css              Start screen
  hangar.css            Hangar shop
  online.css            Online play
  game.css              In-game HUD
js/
  quality.js            Lowers render resolution when frames get slow
  shop/
    catalog.js          Planes and upgrades for sale (edit prices/stats here)
    shop.js             Coins, purchases, applying a plane in game
    hangar.js           The Hangar screen
  online/
    common.js           Settings and helpers
    sync.js             Turning game objects into network messages
    host.js             Hosting a room
    guest.js            Joining a room
    lobby.js            Host / Join buttons
  engine/               The game itself, one module per file
    registry.js         Modules register here…
    00-vector.js …      …vector math, constants, sprites, plane, missile,
    87-main.js          controls, physics, rendering, AI, game modes…
    assets.js           Sprite file paths
    boot.js             …and boot.js starts the game
  vendor/peerjs.min.js
assets/
  sprites/              Game sprites (units, effects, scenery, ui)
  icons/                HUD and logo icons
docs/screenshots/       Images for this README
```

The engine files come from the original minified webpack build of
[antonmedv/bit-planes](https://github.com/antonmedv/bit-planes), split into
modules and formatted, so variable names are short. Each file starts with a
comment saying what it does.
