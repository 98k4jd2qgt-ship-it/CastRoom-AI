import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const failures = [];

mustInclude(main, "conversationInputStability", "global input stability state");
mustInclude(main, "function updateConversationInputComposition(", "composition state updater");
mustInclude(main, "function updateConversationInputFocus(", "focus state updater");
mustInclude(main, "function isWorkspaceInputRenderSensitive(", "render suppression checks input stability");
mustInclude(main, "conversationInputStability[latestTarget].composing", "restore avoids value overwrite during IME composition");

mustInclude(roomSurface, "onInputCompositionChange", "Room input exposes composition callback");
mustInclude(roomSurface, 'input.addEventListener("compositionstart"', "Room input tracks compositionstart");
mustInclude(roomSurface, 'input.addEventListener("compositionend"', "Room input tracks compositionend");
mustInclude(roomSurface, "isComposing || event.isComposing", "Room input keydown respects IME composition");
mustInclude(roomSurface, "if (isComposing) {\n      return;\n    }\n    const value = input.value.trim();", "Room submit does not fire while composing");

mustInclude(petConsole, "onInputCompositionChange", "Console input exposes composition callback");
mustInclude(petConsole, 'input.addEventListener("compositionstart"', "Console input tracks compositionstart");
mustInclude(petConsole, 'input.addEventListener("compositionend"', "Console input tracks compositionend");
mustInclude(petConsole, "isComposing || event.isComposing", "Console input keydown respects IME composition");
mustInclude(petConsole, 'props.onInputComponentEvent("submit_locked", input.value, pendingAttachment, "composition_active")', "Console submit is blocked while composing");

if (failures.length) {
  console.error(`Input IME stability validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Input IME stability validation passed.");

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
