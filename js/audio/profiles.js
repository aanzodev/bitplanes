// How each plane sounds. All sounds are synthesized live with the Web Audio
// API, so these numbers are the whole "recording".
//
// Propeller engines ("prop"):
//   base, range  engine note in Hz at idle and how much it rises at full throttle
//   wave         oscillator shape; "sawtooth" is raspy, "triangle" smooth
//   pulse        cylinder firing rhythm in Hz (more cylinders = faster, smoother)
//   tone         brightness (low-pass cutoff in Hz)
//   whistle      optional high whistle in Hz (the P-51's air scoop)
//   sputter      optional 0..1 chance of a rotary-engine stutter
// Jet engines ("jet"):
//   roar         [idle, full] low-pass cutoff of the exhaust roar
//   whine        [idle, full] turbine whine pitch
//   whineVol     how loud the turbine whine is
//   burner       afterburner rumble volume at full throttle (0 = none)
// Any plane:
//   volume       overall engine loudness (1 = normal)
//   idleSilent   engine makes no sound at zero throttle
// engine: the real engine behind the sound (see audio/engines.js):
//   piston: type (rotary | radial | inline | v8 | v12 | flat4), cyl (cylinders),
//     rpm [idle, max], blades and gear (propeller), lump (how lumpy it runs),
//     rough (timing wobble), exhaust (exhaust resonance Hz), bright, drive,
//     blower (supercharger / turbo whine), sputter (rotary blip), engines (twins)
//   jet: type (turbojet | turbofan | tf34 | stealth), whine [Hz], whineVol,
//     roar [Hz], fan [Hz] and buzz (fan buzzsaw), crackle, burner, engines
// gun: the plane's real gun, from the GUNS table in sound.js (e.g. "vickers",
//      "m2" .50 cal, "mg151" 20 mm, "m61" Vulcan, "gau8" the A-10's BRRRT)
window.BitSoundProfiles = {
    classic: {kind: "prop", base: 55, range: 45, wave: "sawtooth", pulse: 18, tone: 900, gun: "vickers", engine: {type: "rotary", cyl: 9, rpm: [650, 1250], blades: 2, gear: 1, lump: 0.25, rough: 0.25, exhaust: 900, sputter: 0.08}},
    cub: {kind: "prop", base: 72, range: 40, wave: "square", pulse: 16, tone: 1300, gun: "lewis", engine: {type: "flat4", cyl: 4, rpm: [800, 2350], blades: 2, gear: 1, lump: 0.35, rough: 0.2, exhaust: 1400, bright: 0.9}},
    tigermoth: {kind: "prop", base: 60, range: 38, wave: "square", pulse: 15, tone: 1000, gun: "lewis", engine: {type: "inline", cyl: 4, rpm: [700, 2350], blades: 2, gear: 1, lump: 0.3, rough: 0.2, exhaust: 1200}},
    duster: {kind: "prop", base: 44, range: 34, wave: "sawtooth", pulse: 12, tone: 750, gun: "vickers", engine: {type: "radial", cyl: 7, rpm: [600, 2075], blades: 2, gear: 1, lump: 0.5, rough: 0.3, exhaust: 800}},
    fokker: {kind: "prop", base: 58, range: 42, wave: "square", pulse: 20, tone: 1050, sputter: 0.12, gun: "spandau", engine: {type: "rotary", cyl: 9, rpm: [650, 1200], blades: 2, gear: 1, lump: 0.25, rough: 0.3, exhaust: 950, sputter: 0.15}},
    spad: {kind: "prop", base: 52, range: 46, wave: "sawtooth", pulse: 22, tone: 1100, gun: "vickers", engine: {type: "v8", cyl: 8, rpm: [700, 2300], blades: 2, gear: 0.58, lump: 0.15, rough: 0.2, exhaust: 1150, drive: 4}},
    i16: {kind: "prop", base: 46, range: 50, wave: "sawtooth", pulse: 26, tone: 1150, gun: "shkas", engine: {type: "radial", cyl: 9, rpm: [650, 2300], blades: 2, gear: 0.68, lump: 0.4, rough: 0.25, exhaust: 950, blower: 0.5}},
    swift: {kind: "prop", base: 78, range: 62, wave: "sawtooth", pulse: 26, tone: 1500, gun: "browning303", engine: {type: "inline", cyl: 6, rpm: [900, 3200], blades: 2, gear: 1, lump: 0.1, rough: 0.12, exhaust: 1600, bright: 1}},
    gunship: {kind: "prop", base: 46, range: 36, wave: "sawtooth", pulse: 14, tone: 800, gun: "m2", engine: {type: "radial", cyl: 9, rpm: [600, 2200], blades: 3, gear: 0.7, lump: 0.45, rough: 0.25, exhaust: 850}},
    fortress: {kind: "prop", base: 36, range: 26, wave: "sawtooth", pulse: 10, tone: 650, gun: "m2", engine: {type: "radial", cyl: 9, rpm: [550, 2000], blades: 3, gear: 0.6, lump: 0.45, rough: 0.25, exhaust: 750, engines: 2}},
    camel: {kind: "prop", base: 62, range: 40, wave: "square", pulse: 21, tone: 1100, sputter: 0.18, gun: "vickers", engine: {type: "rotary", cyl: 9, rpm: [650, 1250], blades: 2, gear: 1, lump: 0.3, rough: 0.3, exhaust: 950, sputter: 0.18}},
    phantom: {kind: "prop", base: 70, range: 55, wave: "triangle", pulse: 24, tone: 1400, gun: "hispano", engine: {type: "v12", cyl: 12, rpm: [800, 3000], blades: 3, gear: 0.5, lump: 0.08, rough: 0.1, exhaust: 1400, blower: 1}},
    zero: {kind: "prop", base: 66, range: 58, wave: "sawtooth", pulse: 25, tone: 1600, gun: "type99", engine: {type: "radial", cyl: 14, rpm: [700, 2750], blades: 3, gear: 0.58, lump: 0.3, rough: 0.2, exhaust: 1100, blower: 1}},
    spitfire: {kind: "prop", base: 52, range: 52, wave: "triangle", pulse: 34, tone: 1300, gun: "browning303", engine: {type: "v12", cyl: 12, rpm: [800, 3000], blades: 4, gear: 0.477, lump: 0.08, rough: 0.1, exhaust: 1250, blower: 1.5}},
    mustang: {kind: "prop", base: 48, range: 56, wave: "triangle", pulse: 36, tone: 1200, whistle: 1250, gun: "m2", engine: {type: "v12", cyl: 12, rpm: [800, 3000], blades: 4, gear: 0.479, lump: 0.08, rough: 0.1, exhaust: 1200, blower: 1.5}},
    bf109: {kind: "prop", base: 56, range: 58, wave: "sawtooth", pulse: 33, tone: 1350, gun: "mg151", engine: {type: "v12", cyl: 12, rpm: [800, 2800], blades: 3, gear: 0.6, lump: 0.12, rough: 0.28, exhaust: 1300, blower: 1, drive: 4}},
    corsair: {kind: "prop", base: 40, range: 44, wave: "sawtooth", pulse: 28, tone: 900, gun: "m2", engine: {type: "radial", cyl: 18, rpm: [600, 2700], blades: 3, gear: 0.5, lump: 0.35, rough: 0.2, exhaust: 800, blower: 1}},
    hurricane: {kind: "prop", base: 50, range: 48, wave: "triangle", pulse: 32, tone: 1150, gun: "browning303", engine: {type: "v12", cyl: 12, rpm: [800, 3000], blades: 3, gear: 0.477, lump: 0.1, rough: 0.12, exhaust: 1150, blower: 1.5}},
    yak3: {kind: "prop", base: 60, range: 56, wave: "sawtooth", pulse: 30, tone: 1450, gun: "shvak", engine: {type: "v12", cyl: 12, rpm: [800, 2700], blades: 3, gear: 0.6, lump: 0.12, rough: 0.25, exhaust: 1350, blower: 1}},
    fw190: {kind: "prop", base: 42, range: 46, wave: "sawtooth", pulse: 29, tone: 1000, gun: "mg151", engine: {type: "radial", cyl: 14, rpm: [700, 2700], blades: 3, gear: 0.54, lump: 0.3, rough: 0.2, exhaust: 950, blower: 1.5}},
    p47: {kind: "prop", base: 36, range: 42, wave: "sawtooth", pulse: 30, tone: 850, gun: "m2", engine: {type: "radial", cyl: 18, rpm: [600, 2700], blades: 4, gear: 0.5, lump: 0.35, rough: 0.18, exhaust: 750, blower: 2}},
    p38: {kind: "prop", base: 50, range: 54, wave: "triangle", pulse: 40, tone: 1250, gun: "hispano", engine: {type: "v12", cyl: 12, rpm: [800, 3000], blades: 3, gear: 0.5, lump: 0.1, rough: 0.12, exhaust: 1050, blower: 2, engines: 2}},
    mig21: {kind: "jet", roar: [600, 3000], whine: [2600, 5600], whineVol: 0.04, burner: 0.25, volume: 0.35, gun: "gsh23", engine: {type: "turbojet", whine: [2400, 5800], whineVol: 0.05, roar: [500, 2800], crackle: 0.6, burner: 1.1}},
    f16: {kind: "jet", roar: [500, 2800], whine: [2200, 5200], whineVol: 0.05, burner: 0.25, volume: 0.35, gun: "m61", engine: {type: "turbofan", whine: [2200, 5200], whineVol: 0.045, roar: [450, 2600], fan: [120, 260], buzz: 0.05, burner: 0.9}},
    mig29: {kind: "jet", roar: [450, 2600], whine: [2000, 4800], whineVol: 0.045, burner: 0.25, volume: 0.35, gun: "gsh301", engine: {type: "turbofan", whine: [2000, 4800], whineVol: 0.045, roar: [420, 2500], fan: [110, 240], buzz: 0.05, crackle: 0.35, burner: 1, engines: 2}},
    a10: {kind: "jet", roar: [400, 1600], whine: [3200, 6200], whineVol: 0.07, burner: 0, volume: 0.35, gun: "gau8", engine: {type: "tf34", whine: [3200, 6400], whineVol: 0.11, roar: [300, 1400], fan: [140, 230], buzz: 0.07, burner: 0, engines: 2}},
    f15: {kind: "jet", roar: [350, 2400], whine: [1800, 4200], whineVol: 0.04, burner: 0.3, volume: 0.35, gun: "m61", engine: {type: "turbofan", whine: [1900, 4400], whineVol: 0.04, roar: [380, 2400], fan: [110, 230], buzz: 0.05, burner: 1, engines: 2}},
    su27: {kind: "jet", roar: [330, 2300], whine: [1700, 4000], whineVol: 0.04, burner: 0.3, volume: 0.35, gun: "gsh301", engine: {type: "turbofan", whine: [1800, 4100], whineVol: 0.04, roar: [340, 2300], fan: [100, 220], buzz: 0.05, burner: 1, engines: 2}},
    f35: {kind: "jet", roar: [320, 2200], whine: [1600, 3800], whineVol: 0.035, burner: 0.25, volume: 0.3, idleSilent: true, gun: "gau22", engine: {type: "turbofan", whine: [1600, 3800], whineVol: 0.035, roar: [300, 2000], fan: [90, 200], buzz: 0.06, burner: 1.2, volume: 1.15}},
    f22: {kind: "jet", roar: [300, 2200], whine: [1500, 3600], whineVol: 0.035, burner: 0.2, volume: 0.25, idleSilent: true, gun: "m61", engine: {type: "turbofan", whine: [1500, 3600], whineVol: 0.03, roar: [300, 2100], fan: [95, 210], buzz: 0.04, burner: 0.9, engines: 2}},
    // B-2: four buried turbofans, a deep quiet hum with no afterburner.
    b2: {kind: "jet", roar: [200, 1200], whine: [1100, 2400], whineVol: 0.02, burner: 0, volume: 0.25, idleSilent: true, gun: "m61", engine: {type: "stealth", whine: [1100, 2400], whineVol: 0.02, roar: [180, 1100], burner: 0, engines: 4, volume: 0.7}},
};
