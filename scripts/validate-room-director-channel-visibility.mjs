import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const types = read("src/core/types.ts");
const visibility = read("src/core/roomVisibility.ts");
const appState = read("src/core/appState.ts");
const roomSurface = read("src/ui/roomSurface.ts");
const main = read("src/main.ts");

mustInclude(types, '"director_channel"', "RoomMessageVisibility should include director_channel");
mustInclude(types, '"director"', "RoomActiveChannelId and RoomChannelType should include director");
mustInclude(visibility, 'message.visibility === "director_channel"', "room visibility should resolve director channel messages");
mustInclude(visibility, 'channelId === "director"', "room visibility should recognize the director channel");
mustInclude(visibility, 'room.freedomLevel === "developer"', "director channel should be gated by developer freedom");
mustInclude(visibility, 'message.visibility !== "director_channel"', "normal user timeline filtering should hide director channel messages");
mustInclude(appState, 'channelIds.push("director")', "developer read-state should include director channel");
mustInclude(appState, 'message.visibility === "director_channel"', "read marker should resolve director channel messages");
mustInclude(appState, 'room.freedomLevel === "developer" ? "director" : "public"', "active director channel should normalize to public outside developer mode");
mustInclude(roomSurface, 'channel.type === "director"', "room UI should render director channel type");
mustInclude(roomSurface, 'directorChannelNote', "room UI should label director channel as backstage");
mustInclude(main, 'director_channel_role_speaker_blocked', "timeline commit guard should block role speakers in director channel");
mustInclude(main, 'director_message_channel_missing', "timeline commit guard should require director channel id");

if (failures.length > 0) {
  console.error(`validate-room-director-channel-visibility failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-room-director-channel-visibility passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
