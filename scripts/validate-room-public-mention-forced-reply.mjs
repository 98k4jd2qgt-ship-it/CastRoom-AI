import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const fail = (message) => {
  console.error(`[validate-room-public-mention-forced-reply] ${message}`);
  process.exit(1);
};

const visibility = read("src/core/roomVisibility.ts");
const scheduler = read("src/core/roomScheduler.ts");
const surface = read("src/ui/roomSurface.ts");
const copy = read("src/ui/copy.ts");

if (!visibility.includes("export function hasRoomDirectorMention")) {
  fail("roomVisibility must expose hasRoomDirectorMention.");
}
if (!visibility.includes("if (hasRoomDirectorMention(input, room.director))")) {
  fail("@Director input must be routed before normal public mention handling.");
}
if (!visibility.includes('visibility: "director_channel"') || !visibility.includes('channelId: "director"')) {
  fail("@Director input must route to the Director channel.");
}
if (!scheduler.includes('if (intent === "direct_mention") {') || !scheduler.includes("return 3;")) {
  fail("direct mention planning must allow a bounded multi-role forced reply queue.");
}
if (!scheduler.includes("slice(0, Math.min(maxTurns, 3))")) {
  fail("direct mention planning must cap forced replies.");
}
if (!scheduler.includes('return { targets: [{ type: "user", userId: room.userProfile.userId }] };')) {
  fail("direct mention turns must target the user so the mentioned role answers the user's question.");
}
if (
  !scheduler.includes("Answer the user's question or request first") ||
  !scheduler.includes("Do not use @mentions")
) {
  fail("direct mention turn goal must force the selected role to answer the user without visible @mentions.");
}
if (
  !copy.includes("roomAddressDirectorBackstage") ||
  !copy.includes("roomAddressPublicRoleMention") ||
  !copy.includes("roomAddressPublicMentionHelp")
) {
  fail("room input hint copy must explain public @role and backstage @Director semantics.");
}
if (
  !surface.includes('"roomAddressDirectorBackstage"') ||
  !surface.includes('"roomAddressPublicRoleMention"') ||
  !surface.includes('"roomAddressPublicMentionHelp"')
) {
  fail("room input hint must use localized public @role and backstage @Director copy.");
}
if (!surface.includes('{ mentionStyle: "plain" }')) {
  fail("room timeline/address labels must render plain target names instead of @ labels.");
}
if (!copy.includes("{target} answers you next") || !copy.includes("下一轮由 {target} 回答你")) {
  fail("room input hint copy must say public @role answers the user next.");
}

console.log("[validate-room-public-mention-forced-reply] ok");
