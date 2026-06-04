import fs from "node:fs";

const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");

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

mustInclude(roomSurface, "isRoomEmotionAvatarPackReady", "room surface uses avatar readiness gate");
mustInclude(roomSurface, "resolveRoomEmotionAvatarAsset", "room surface resolves gated avatar asset");
mustInclude(roomSurface, "getMissingRoomEmotionAvatarSlots", "room surface exposes missing avatar diagnostics");
mustInclude(roomSurface, "function renderRoomRoleAvatarInto", "room avatar render helper");
mustMatch(
  roomSurface,
  /renderRoleViewport[\s\S]*renderRoomRoleAvatarInto\(artHolder, participant, participant\.currentEmotion/,
  "role strip avatar uses participant current emotion",
);
mustMatch(
  roomSurface,
  /message\.speakerType === "role"[\s\S]*message\.speakerId[\s\S]*renderRoomRoleAvatarInto\(avatar, participant, message\.emotion \?\? participant\.currentEmotion/,
  "timeline role avatar uses message emotion first",
);
mustMatch(
  roomSurface,
  /renderRoomRoleAvatarImage[\s\S]*!pack \|\| !isRoomEmotionAvatarPackReady\(pack\)[\s\S]*return null/,
  "incomplete packs keep initials instead of half image fallback",
);
mustMatch(
  roomSurface,
  /renderRoomRoleAvatarImage[\s\S]*asset\?\.candidates\.filter\(\(candidate\) => candidate\.kind === "image"\)/,
  "room avatar renders only image candidates",
);
mustInclude(styles, '.room-avatar[data-image="true"]', "room timeline image avatar style");
mustInclude(styles, '.room-role-art[data-image="true"]', "room role strip image avatar style");
mustInclude(styles, ".room-avatar img", "room timeline avatar image sizing");

if (failures.length > 0) {
  console.error("validate-room-emotion-avatar-routing failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Room emotion avatar routing validation passed.");
