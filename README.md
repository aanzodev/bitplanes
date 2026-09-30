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
| <kbd>M</kbd> | Sound on / off (also the 🔊 button in game) |

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

**Paint** any plane you own with one of 16 colors in the Hangar (free).

Upgrades (engine, handling, armor, ammo belt, reload, missile rack) apply to
whichever plane you fly. Coins and purchases are saved in your browser.

### Sound

Every plane has its own engine sound, synthesized live with the Web Audio API
(no audio files): each propeller plane has its own pitch, cylinder rhythm and
tone (the Spitfire and P-51 get a smooth Merlin growl, the P-51 its air-scoop
whistle, the Sopwith Camel a sputtering rotary). The special jets get turbine
roar and whine: F-16 with afterburner, the A-10's high "hair dryer" whistle and
GAU-8 *BRRRT*, the F-22's deep afterburner rumble. Guns, missiles, flares and
explosions from other planes get quieter and pan with distance. Tweak the
sounds in `js/audio/profiles.js`.

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
made them. Players who join see their ping to the host under the room code
(the host runs the game, so it has no ping). Green is under 80 ms, yellow
under 160 ms, red above. The host's browser runs the game, so the host should have the best
connection. Each guest flies their own plane in their own browser, so turning,
thrust and bullets react instantly; the host decides hits and deaths. If the host closes the page the room ends.

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
  audio/
    profiles.js         How each plane sounds (edit to tweak)
    sound.js            Synthesized engine, guns, missiles, flares, explosions
  shop/
    catalog.js          Planes and upgrades for sale (edit prices/stats here)
    shop.js             Coins, purchases, applying a plane in game
    hangar.js           The Hangar screen
  online/
    common.js           Settings and helpers
    sync.js             Turning game objects into network messages
    host.js             Hosting a room
    guest.js            Joining a room
    prediction.js       Guests fly their own plane locally (no input lag)
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
