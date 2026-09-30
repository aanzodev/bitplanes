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
// gun: "mg" (machine gun), "cannon" (M61 Vulcan buzz) or "brrt" (A-10's GAU-8)
window.BitSoundProfiles = {
    classic: {kind: "prop", base: 55, range: 45, wave: "sawtooth", pulse: 18, tone: 900, gun: "mg"},
    swift: {kind: "prop", base: 78, range: 62, wave: "sawtooth", pulse: 26, tone: 1500, gun: "mg"},
    gunship: {kind: "prop", base: 46, range: 36, wave: "sawtooth", pulse: 14, tone: 800, gun: "mg"},
    fortress: {kind: "prop", base: 36, range: 26, wave: "sawtooth", pulse: 10, tone: 650, gun: "mg"},
    camel: {kind: "prop", base: 62, range: 40, wave: "square", pulse: 21, tone: 1100, sputter: 0.18, gun: "mg"},
    phantom: {kind: "prop", base: 70, range: 55, wave: "triangle", pulse: 24, tone: 1400, gun: "mg"},
    zero: {kind: "prop", base: 66, range: 58, wave: "sawtooth", pulse: 25, tone: 1600, gun: "mg"},
    spitfire: {kind: "prop", base: 52, range: 52, wave: "triangle", pulse: 34, tone: 1300, gun: "mg"},
    mustang: {kind: "prop", base: 48, range: 56, wave: "triangle", pulse: 36, tone: 1200, whistle: 1250, gun: "mg"},
    bf109: {kind: "prop", base: 56, range: 58, wave: "sawtooth", pulse: 33, tone: 1350, gun: "mg"},
    corsair: {kind: "prop", base: 40, range: 44, wave: "sawtooth", pulse: 28, tone: 900, gun: "mg"},
    mig21: {kind: "jet", roar: [600, 3000], whine: [2600, 5600], whineVol: 0.04, burner: 0.25, volume: 0.35, gun: "cannon"},
    f16: {kind: "jet", roar: [500, 2800], whine: [2200, 5200], whineVol: 0.05, burner: 0.25, volume: 0.35, gun: "cannon"},
    mig29: {kind: "jet", roar: [450, 2600], whine: [2000, 4800], whineVol: 0.045, burner: 0.25, volume: 0.35, gun: "cannon"},
    a10: {kind: "jet", roar: [400, 1600], whine: [3200, 6200], whineVol: 0.07, burner: 0, volume: 0.35, gun: "brrt"},
    f15: {kind: "jet", roar: [350, 2400], whine: [1800, 4200], whineVol: 0.04, burner: 0.3, volume: 0.35, gun: "cannon"},
    su27: {kind: "jet", roar: [330, 2300], whine: [1700, 4000], whineVol: 0.04, burner: 0.3, volume: 0.35, gun: "cannon"},
    f35: {kind: "jet", roar: [320, 2200], whine: [1600, 3800], whineVol: 0.035, burner: 0.25, volume: 0.3, idleSilent: true, gun: "cannon"},
    f22: {kind: "jet", roar: [300, 2200], whine: [1500, 3600], whineVol: 0.035, burner: 0.2, volume: 0.25, idleSilent: true, gun: "cannon"},
};
