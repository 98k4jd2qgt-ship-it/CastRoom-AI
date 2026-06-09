import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const createDirectives = sliceFunction(scheduler, "createDirectorPrivateDirectives");
mustInclude(createDirectives, 'target: "all"', "Director private directives should target the room");
mustNotInclude(createDirectives, 'type: "user"', "Director private directives should not schedule the user");
mustNotInclude(createDirectives, "shouldTargetUserForDirectorDirective(", "Director private directives should not call user-target helper");

const applyPlan = sliceFunction(scheduler, "scheduleRoomDirectorTurn");
mustInclude(applyPlan, 'const target: RoomMessageTarget = plan.move === "whisper"', "Director public target should be computed in scheduleRoomDirectorTurn");
mustNotInclude(applyPlan, 'type: "user"', "Director public messages should not target the user");

const planText = sliceFunction(scheduler, "createDirectorPlanText");
mustNotInclude(planText, "@${player}", "Director generated text should not mention @You");
mustNotInclude(planText, "You can ask", "Director generated text should not tell the user what to do");
mustInclude(planText, "User input remains optional", "Director choice copy should be optional and user-centered");

const channelMessage = sliceFunction(main, "createDirectorChannelMessage");
mustInclude(channelMessage, "neutralizeDirectorUserInstruction", "Director channel should neutralize user scheduling text");
mustInclude(channelMessage, "neutralizeDirectorUserInstruction(directive.task)", "Director channel should neutralize user scheduling inside private directive summaries");
mustInclude(channelMessage, "neutralizeDirectorUserInstruction(focus)", "Director channel should neutralize user scheduling inside focus summaries");
mustNotInclude(channelMessage, "Backstage text blocked from public: ${trimRoomPromptLine(publicText, 220)}", "Director channel should not echo raw user scheduling text");

const waitFn = sliceFunction(main, "shouldWaitForUserAfterDirector");
mustNotInclude(waitFn, 'result.move === "pause"', "Director pause should not automatically wait for the user");

const userInstruction = sliceFunction(main, "isDirectorUserInstructionText");
mustInclude(userInstruction, "You\\s+can\\s+ask", "Director channel should detect English user scheduling text");
mustInclude(userInstruction, "用户.{0,16}(?:可以|现在可以)", "Director channel should detect Chinese user scheduling text");

if (failures.length) {
  console.error(`validate-director-user-not-scheduled failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-user-not-scheduled passed");

function sliceFunction(source, name) {
  const match = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  const start = match?.index ?? -1;
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nexport function ", "\nasync function ", "\ninterface "]
    .map((marker) => source.indexOf(marker, start + 1))
    .filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next < 0 ? source.slice(start) : source.slice(start, next);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`unexpected ${label}: ${marker}`);
  }
}
