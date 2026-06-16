import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");

const failures = [];

function mustInclude(source, needle, label) {
  if (!source.includes(needle)) {
    failures.push(`${label}: missing ${needle}`);
  }
}

const toggleBlock = main.slice(main.indexOf('if (action.type === "room.toggleAutoChat")'), main.indexOf('if (action.type === "room.requestDirectorMove")'));
const advanceBlock = main.slice(main.indexOf('if (action.type === "room.setAdvancePolicy")'), main.indexOf("const deletedRoomId"));
const forceBlock = main.slice(main.indexOf("function shouldForceRoomInspectorStablePatch"), main.indexOf("function createRoomInspectorStableSnapshot"));

mustInclude(toggleBlock, 'requestRender("room_control_change"', "auto toggle uses immediate control patch");
mustInclude(advanceBlock, "primeRoomAutoTimer", "advance policy change reprimes active auto flow");
mustInclude(advanceBlock, 'delayMode: "base"', "advance policy change uses base pace instead of idle gap");
mustInclude(advanceBlock, 'requestRender("room_control_change"', "advance policy change uses immediate control patch");
mustInclude(forceBlock, '"room_control_change"', "room control patch bypasses inspector throttle");

if (failures.length) {
  console.error(`Room control immediate UI validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room control immediate UI validation passed.");
