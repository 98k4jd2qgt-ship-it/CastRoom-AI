import fs from "node:fs";

const packs = fs.readFileSync("src/core/characterPacks.ts", "utf8");

const failures = [];

function mustInclude(source, text, label) {
  if (!source.includes(text)) {
    failures.push(`${label}: missing ${text}`);
  }
}

function mustMatch(source, pattern, label) {
  if (!pattern.test(source)) {
    failures.push(`${label}: missing pattern ${pattern}`);
  }
}

mustInclude(
  packs,
  'const roomEmotionAvatarSlots = ["idle", "happy", "sad", "angry", "surprised", "thinking"] as const',
  "standard room avatar emotion slots",
);
mustInclude(packs, "export function isRoomEmotionAvatarPackReady", "room avatar readiness helper");
mustInclude(packs, "export function getMissingRoomEmotionAvatarSlots", "missing room avatar slots helper");
mustInclude(packs, "export function resolveRoomEmotionAvatarAsset", "room avatar asset resolver");
mustMatch(
  packs,
  /function hasRoomEmotionAvatarImage[\s\S]*candidate\.kind === "image"/,
  "room avatar readiness requires real image candidates",
);
mustMatch(
  packs,
  /resolveRoomEmotionAvatarAsset[\s\S]*!isRoomEmotionAvatarPackReady\(pack\)[\s\S]*return null/,
  "room avatar resolver refuses incomplete packs",
);
mustMatch(
  packs,
  /function normalizeRoomEmotionAvatarSlot[\s\S]*requested === "curious"[\s\S]*return "thinking"[\s\S]*requested === "calm"[\s\S]*return "idle"/,
  "room avatar emotion aliases",
);

if (failures.length > 0) {
  console.error("validate-room-emotion-avatar-readiness failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Room emotion avatar readiness validation passed.");
