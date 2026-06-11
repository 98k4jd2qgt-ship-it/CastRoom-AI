import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const visibility = read("src/core/roomVisibility.ts");

const inputBlock = sliceFunction(main, "executeRoomInput");
const moveBlock = sliceFunction(main, "inferDeveloperDirectorChannelMove");

mustInclude(inputBlock, 'inputVisibility.visibility === "director_channel"', "room input should detect developer director channel");
mustInclude(inputBlock, 'target: effectiveTarget', "developer director channel input should retarget to Director");
mustInclude(inputBlock, "shouldApplyDirectorOverride(input)", "developer director channel should reuse override handling");
mustInclude(inputBlock, "Developer Director Channel", "Director prompt should receive developer-channel context");
mustInclude(inputBlock, "Developer Director Channel Public Narration Request", "explicit public narration requests should be marked before Director planning");
mustInclude(inputBlock, "requestedMove: inferDeveloperDirectorChannelMove(input)", "developer director channel should steer Director move");
mustInclude(inputBlock, "recordRoomMessageMemory(userMessage", "normal room messages should still record memory after director-channel early return");
expect(
  inputBlock.indexOf("if (isDirectorChannelInput)") < inputBlock.indexOf("recordRoomMessageMemory(userMessage"),
  "developer director channel must return before normal room memory recording",
);
mustInclude(moveBlock, 'return "twist"', "narration-like developer channel input should request a public narration move");
mustInclude(moveBlock, 'return "judge"', "fact/override developer channel input should request judgement");
mustInclude(moveBlock, 'return "cue"', "scheduling developer channel input should default to cue");
mustInclude(visibility, 'channelId === "director" && room.freedomLevel === "developer"', "director channel input visibility should require developer mode");
mustInclude(visibility, 'privateReason: "director_channel"', "developer director channel user input should be hidden from roles");

if (failures.length > 0) {
  console.error(`validate-director-channel-developer-override failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-channel-developer-override passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function sliceFunction(text, name) {
  const start = text.indexOf(`function ${name}`);
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const next = text.indexOf("\nfunction ", start + 1);
  return next < 0 ? text.slice(start) : text.slice(start, next);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
