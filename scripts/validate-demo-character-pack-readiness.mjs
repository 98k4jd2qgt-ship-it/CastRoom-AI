import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredSlots = ["idle", "happy", "sad", "angry", "surprised", "thinking"];
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif"]);
const packsDir = path.join(root, "character-packs");
const requireVisualDemo = process.env.CASTROOM_REQUIRE_DEMO_CHARACTER_VISUALS === "1";
const failures = [];
const warnings = [];

if (!fs.existsSync(packsDir)) {
  failures.push("Missing character-packs directory.");
} else {
  const packs = fs.readdirSync(packsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const readyPacks = [];
  for (const pack of packs) {
    const packDir = path.join(packsDir, pack.name);
    const missingSlots = getMissingSlots(packDir);
    if (missingSlots.length === 0) {
      readyPacks.push(pack.name);
    } else {
      warnings.push(`${normalize(path.relative(root, packDir))} is not demo-visual-ready; missing ${missingSlots.join(", ")}.`);
    }
  }
  if (readyPacks.length === 0) {
    const message = "No character pack has complete Room demo visuals (idle, happy, sad, angry, surprised, thinking).";
    if (requireVisualDemo) {
      failures.push(message);
    } else {
      warnings.push(`${message} Set CASTROOM_REQUIRE_DEMO_CHARACTER_VISUALS=1 to make this a hard release gate.`);
    }
  }
}

if (warnings.length > 0) {
  console.warn(`Demo character readiness warnings:\n${warnings.map((item) => `- ${item}`).join("\n")}`);
}

if (failures.length > 0) {
  console.error(`Demo character readiness validation failed:\n${failures.map((item) => `- ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("Demo character readiness validation passed");

function getMissingSlots(packDir) {
  return requiredSlots.filter((slot) => !hasImageForSlot(packDir, slot));
}

function hasImageForSlot(packDir, slot) {
  const dirs =
    slot === "idle"
      ? [path.join(packDir, "idle")]
      : [path.join(packDir, "emotions", slot), path.join(packDir, slot)];
  return dirs.some((dir) => directoryHasImage(dir));
}

function directoryHasImage(dir) {
  if (!fs.existsSync(dir)) {
    return false;
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .some((entry) => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()));
}

function normalize(value) {
  return value.split(path.sep).join("/");
}
