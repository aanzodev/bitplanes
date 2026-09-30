// Everything the Hangar sells.
//
// Plane stats are multipliers or bonuses on top of the base plane:
//   thrust, turn, reload, bulletSpeed  multipliers (1 = normal)
//   life, ammo, missiles, flares       extra hit points / rounds / missiles / flares
// skin: "" (biplane), "prop" (WWII fighter) or "jet".
// special: shown with a black border in the Hangar.
window.BitCatalog = {
    planes: [
        {id: "classic", name: "Classic", price: 0, color: "#ff0015",
            desc: "Balanced starter plane.",
            thrust: 1, turn: 1, life: 0, ammo: 0, missiles: 0, reload: 1},
        {id: "swift", name: "Swift", price: 150, color: "#f5b700",
            desc: "Fast and agile, but fragile.",
            thrust: 1.2, turn: 1.25, life: 0, ammo: -3, missiles: 0, reload: 1},
        {id: "gunship", name: "Gunship", price: 300, color: "#2e9e44",
            desc: "Big ammo belt and quick reload.",
            thrust: 1, turn: 0.95, life: 1, ammo: 10, missiles: 0, reload: 0.75},
        {id: "fortress", name: "Fortress", price: 500, color: "#5b6b8c",
            desc: "Heavy armor and extra missiles. Slow.",
            thrust: 0.9, turn: 0.85, life: 3, ammo: 5, missiles: 2, reload: 1},
        {id: "camel", name: "Sopwith Camel", price: 750, color: "#8b6a3e",
            desc: "Old biplane that turns on a dime.",
            thrust: 0.95, turn: 1.4, life: 0, ammo: 3, missiles: 0, reload: 0.9},
        {id: "phantom", name: "Phantom", price: 1000, color: "#7b2ff7",
            desc: "Elite fighter, better at everything.",
            thrust: 1.2, turn: 1.2, life: 2, ammo: 5, missiles: 1, reload: 0.8},
        {id: "zero", name: "A6M Zero", price: 1200, color: "#d9d4bd", skin: "prop",
            desc: "Light and nimble prop fighter.",
            thrust: 1.2, turn: 1.4, life: 0, ammo: 5, missiles: 0, reload: 0.9},
        {id: "spitfire", name: "Spitfire", price: 1500, color: "#6f8f5a", skin: "prop",
            desc: "Quick climber with eight guns.",
            thrust: 1.25, turn: 1.3, life: 1, ammo: 8, missiles: 0, reload: 0.85},
        {id: "mustang", name: "P-51 Mustang", price: 2000, color: "#b9c1c9", skin: "prop",
            desc: "Fast long-range escort fighter.",
            thrust: 1.3, turn: 1.15, life: 1, ammo: 10, missiles: 1, reload: 0.85, bulletSpeed: 1.1},
        {id: "f16", name: "F-16 Falcon", price: 2500, color: "#9aa7b4", skin: "jet", special: true,
            desc: "Light jet fighter with a fast gun and flares.",
            thrust: 1.3, turn: 1.25, life: 1, ammo: 5, missiles: 0, reload: 0.85, bulletSpeed: 1.25, flares: 3},
        {id: "a10", name: "A-10 Warthog", price: 5000, color: "#6b7a4b", skin: "jet", special: true,
            desc: "Flying tank with a huge cannon belt and flares.",
            thrust: 1.05, turn: 0.95, life: 4, ammo: 20, missiles: 1, reload: 0.7, bulletSpeed: 1.2, flares: 3},
        {id: "f22", name: "F-22 Raptor", price: 10000, color: "#4a5560", skin: "jet", special: true,
            desc: "Stealth fighter. 3 missiles, faster bullets and flares.",
            thrust: 1.4, turn: 1.35, life: 2, ammo: 5, missiles: 1, reload: 0.8, bulletSpeed: 1.6, flares: 3},
    ],

    // Paint colors for any plane (free). The first entry means "factory colors".
    paints: [
        {name: "Factory", color: null},
        {name: "Red", color: "#e8202e"}, {name: "Orange", color: "#ff7a00"}, {name: "Yellow", color: "#f5c400"},
        {name: "Lime", color: "#7ccc1a"}, {name: "Green", color: "#2e9e44"}, {name: "Olive", color: "#6b7a4b"},
        {name: "Teal", color: "#00a8b5"}, {name: "Sky", color: "#3aa7f0"}, {name: "Blue", color: "#1f4fd1"},
        {name: "Purple", color: "#7b2ff7"}, {name: "Pink", color: "#ff4fa3"}, {name: "Brown", color: "#8b5a2b"},
        {name: "Silver", color: "#c0c6cc"}, {name: "Gunmetal", color: "#4a5560"}, {name: "White", color: "#f4f4f4"},
        {name: "Black", color: "#222222"},
    ],

    upgrades: [
        {id: "engine", name: "Engine", desc: "+8% top speed", max: 5, base: 40},
        {id: "handling", name: "Handling", desc: "+8% turn rate", max: 5, base: 40},
        {id: "armor", name: "Armor", desc: "+1 hit point", max: 3, base: 60},
        {id: "ammo", name: "Ammo belt", desc: "+3 rounds", max: 5, base: 30},
        {id: "reload", name: "Reload", desc: "-10% reload time", max: 5, base: 40},
        {id: "missiles", name: "Missile rack", desc: "+1 missile", max: 3, base: 80},
    ],
};
