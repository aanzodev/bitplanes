# ✈️ Bit Planes

A small browser dogfighting activity. Fly biplanes, WWII fighters and jets, shoot
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

### One-line version (loads from GitHub)

`play.html` is a single line that runs the newest activity from this GitHub repo
through the [jsDelivr](https://www.jsdelivr.com) CDN. It asks GitHub for the
newest commit on `main` and loads exactly that version, so every push shows up
the next time the page is opened (no waiting for jsDelivr's cache). Save it
anywhere, or paste it into an online editor like OneCompiler.

The short form also works:

```html
<script src="https://cdn.jsdelivr.net/gh/aanzodev/bitplanes@main/js/loader.js"></script>
```

`js/loader.js` does the same newest-commit lookup, then reads `index.html` and
loads its page, styles, scripts and images. If GitHub can't be reached it falls
back to jsDelivr's copy of `main`.

## Controls

| Key | Action |
|---|---|
| <kbd>↑</kbd> <kbd>↓</kbd> | Thrust up / down |
| <kbd>←</kbd> <kbd>→</kbd> | Pitch (elevator) |
| <kbd>Space</kbd> | Fire the gun |
| <kbd>X</kbd> | Fire a missile |
| <kbd>Q</kbd> | Drop flares: missiles chase the flares instead of you (special jets, the B-2, or any plane with the Flare pod upgrade) |
| <kbd>C</kbd> | Eject / open parachute. Land at the barn for a new plane |
| <kbd>M</kbd> | Sound on / off (also the 🔊 button in activity) |
| <kbd>Esc</kbd> | Menu (also the ⏸ button): resume, change plane, paint, leave to home. Pauses single player; online activities keep running |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> or <kbd>`</kbd> | Activity console (see below) |

## Hangar

Every kill earns **10 coins**. Spend them in the **Hangar** on the start screen.

![Hangar](docs/screenshots/hangar.png)

| Plane | Price | Notes |
|---|---:|---|
| Classic | free | Balanced starter biplane |
| Swift | 300 | Fast and agile, fewer bullets |
| Gunship | 600 | Big ammo belt, quick reload |
| Fortress | 1,000 | Heavy armor, extra missiles, slow |
| Sopwith Camel | 1,500 | Turns on a dime |
| Phantom | 2,000 | Better at everything (biplane) |
| A6M Zero | 2,500 | Light and nimble prop fighter |
| Hurricane | 2,800 | Sturdy workhorse with eight guns |
| Spitfire | 3,000 | Quick climber, eight guns |
| Yak-3 | 3,200 | Tightest turner of the props |
| Bf 109 | 3,500 | Fast climber, hard-hitting cannon |
| P-51 Mustang | 4,000 | Fast escort fighter |
| Fw 190 | 4,500 | Armored, heavy cannons |
| F4U Corsair | 5,000 | Tough navy fighter with rockets |
| P-47 Thunderbolt | 5,500 | Huge, tough, loaded with rockets |
| P-38 Lightning | 6,000 | Fast twin-engine fighter |
| **MiG-21 Fishbed** ★ | 7,000 | Cheap fast jet, 2 flares |
| **F-16 Falcon** ★ | 9,000 | Fast gun, 3 flares |
| **MiG-29 Fulcrum** ★ | 12,000 | Agile twin-engine jet |
| **A-10 Warthog** ★ | 15,000 | Flying tank, huge cannon belt |
| **F-15 Eagle** ★ | 20,000 | Powerful air superiority fighter |
| **Su-27 Flanker** ★ | 24,000 | Long range, turns hard |
| **F-35 Lightning** ★ | 30,000 | Stealth, second only to the Raptor |
| **F-22 Raptor** ★ | 40,000 | The best jet: 3 smart missiles, fastest bullets |
| **B-2 Spirit** ◆ | 100,000 | Exclusive stealth bomber: massive armor, 6 missiles, 4 flares |

In single player the computer pilots fly random planes from this list (never
a special ★ or exclusive ◆ one), picked again every time they get a new plane.

The F-22's **smart missiles** lock on as soon as they launch (any direction,
twice the range), fly faster, turn harder, aim ahead of the target, explode
when they pass close by and see through flares 60% of the time.

◆ Exclusive planes have a gold border in the Hangar.

★ Special jets have a black border in the Hangar and carry flares: press
<kbd>Q</kbd> and missiles chasing you turn toward the flares and explode on them.

## Maps

Every activity picks a random map (never the same one twice in a row):
Countryside, Desert, Arctic, Sunset and Night. Online, everyone who joins
plays on the host's map. Map art is in `assets/sprites/maps/` and the list is
in `js/maps.js`.

**Paint** any plane you own with one of 28 colors in the Hangar (free).

Upgrades (engine, handling, armor, ammo belt, reload, missile rack, gun barrels,
missile loader, flare pod, repair kit) apply to
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

### Activity console

A secret console: press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>K</kbd> or <kbd>`</kbd>
and type `help`. Firefox and online code editors keep Ctrl+Shift+K for
themselves, so use <kbd>`</kbd> there (click on the activity first). <kbd>↑</kbd>/<kbd>↓</kbd> go through history, <kbd>Tab</kbd> completes.

| Command | What it does |
|---|---|
| `coins`, `addcoins <n>`, `setcoins <n>` | Show / add / set coins |
| `planes`, `give <plane>`, `plane <plane>` | List planes, own one free, fly one you own |
| `paint <color>` | Paint your plane (`red`, `blue`, `factory`…) |
| `unlockall`, `reset` | Own everything / start over |
| `heal`, `refill`, `god` | Repair, reload, bullets can't shoot you down (single player) |
| `maps`, `map <map>` | List maps / switch map now (single player) |
| `mute`, `unmute`, `fps` | Sound off/on, FPS counter |
| `room`, `ping` | Online room code, your ping |
| `js <code>` | Run JavaScript |

### Test commands

Open the browser console (F12) on the activity page:

| Command | What it does |
|---|---|
| `addCoins(1000)` | Add coins |
| `setCoins(10000)` | Set your coins to an exact amount |
| `unlockAll()` | Own every plane and max every upgrade |
| `resetShop()` | Back to 0 coins and the Classic plane |

Or add `?coins=10000` to the page URL to add coins once.

## Online play

![In activity](docs/screenshots/activity.png)

1. One player presses **Host a room**. A death match starts and a 5 character
   room code appears at the top of the screen.
2. Friends type the code under **Play online with friends** and press **Join**.
   They can join at any time during the match.

Everyone flies their own plane and upgrades, and kills earn coins for whoever
made them. Players who join see their ping to the host under the room code
(the host runs the activity, so it has no ping). Green is under 80 ms, yellow
under 160 ms, red above. The host's browser runs the activity, so the host should have the best
connection. Each guest flies their own plane in their own browser, so turning,
thrust and bullets react instantly; the host decides hits and deaths. If the host closes the page the room ends.

**Stuck on "Connecting to the host…"?** After 20 seconds the join stops and
says why. Usually the network blocks player-to-player connections (common on
school and office Wi-Fi). The activity then tries free relay servers, including
some on port 443, but those can be blocked or busy too. Put both computers on
the same Wi-Fi or a phone hotspot and join again. You can also use your own
relay (TURN) server: `?turn=turn:example.com:3478&turnuser=name&turnpass=secret`.

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
  activity.css              In-activity HUD
  pause.css             In-activity menu
js/
  quality.js            Lowers render resolution when frames get slow
  pause.js              In-activity menu (Esc): resume, plane, paint, leave
  console.js            Built-in console (Ctrl+Shift+K)
  maps.js               Maps (random each activity)
  audio/
    profiles.js         How each plane sounds (edit to tweak)
    sound.js            Synthesized engine, guns, missiles, flares, explosions
  shop/
    catalog.js          Planes and upgrades for sale (edit prices/stats here)
    shop.js             Coins, purchases, applying a plane in activity
    hangar.js           The Hangar screen
  online/
    common.js           Settings and helpers
    sync.js             Turning activity objects into network messages
    host.js             Hosting a room
    guest.js            Joining a room
    prediction.js       Guests fly their own plane locally (no input lag)
    lobby.js            Host / Join buttons
  engine/               The activity itself, one module per file
    registry.js         Modules register here…
    00-vector.js …      …vector math, constants, sprites, plane, missile,
    87-main.js          controls, physics, rendering, AI, activity modes…
    assets.js           Sprite file paths
    boot.js             …and boot.js starts the activity
  vendor/peerjs.min.js
assets/
  sprites/              Activity sprites (units, effects, scenery, ui)
  icons/                HUD and logo icons
docs/screenshots/       Images for this README
```

The engine files come from the original minified webpack build of
[antonmedv/bit-planes](https://github.com/antonmedv/bit-planes), split into
modules and formatted, so variable names are short. Each file starts with a
comment saying what it does.
