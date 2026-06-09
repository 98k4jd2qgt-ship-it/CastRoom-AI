import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const isHardRoomAutoBlock = sliceFunction(scheduler, "isHardRoomAutoBlock");
const resolveAdvanceDecision = sliceFunction(scheduler, "resolveAdvanceDecision");
const policyBlockedAutoResult = sliceFunction(scheduler, "policyBlockedAutoResult");
const directorHardInput = sliceFunction(main, "directorResultRequiresHardUserInput");
const shouldWaitForUserAfterDirector = sliceFunction(main, "shouldWaitForUserAfterDirector");

mustInclude(isHardRoomAutoBlock, 'blockingNeed === "privacy_or_safety"', "privacy/safety is hard blocker");
mustInclude(isHardRoomAutoBlock, 'blockingNeed === "provider_failure"', "provider failure is hard blocker");
mustInclude(isHardRoomAutoBlock, "isContinuousRoomFlow(room)", "continuous soft blockers are not hard stops");
mustInclude(isHardRoomAutoBlock, 'blockingNeed === "irreversible_decision"', "irreversible decision can stop non-continuous modes");
mustInclude(isHardRoomAutoBlock, 'blockingNeed === "explicit_user_choice"', "explicit user choice can stop non-continuous modes");
mustInclude(isHardRoomAutoBlock, 'blockingNeed === "user_answer_expected" && resolveDirectorMode(room) === "study"', "study answer waits remain hard outside continuous");

mustInclude(resolveAdvanceDecision, "isHardRoomAutoBlock(room, continuation.blockingNeed)", "advance decisions use centralized hard blocker helper");
mustInclude(policyBlockedAutoResult, "continuousSoftBlock", "policy can override only soft blockers");
mustInclude(policyBlockedAutoResult, "!isHardRoomAutoBlock(room, blockingNeed)", "policy does not override hard blockers");

mustInclude(shouldWaitForUserAfterDirector, "if (continuousRoomFlow)", "Director wait helper handles continuous first");
mustInclude(shouldWaitForUserAfterDirector, "return false", "Director wait helper never waits for user in continuous");
mustInclude(directorHardInput, "isContinuousRoomFlow(consoleState.room)", "Director hard-input helper has a continuous branch");
mustInclude(directorHardInput, 'blockingNeed === "privacy_or_safety"', "Director safety blockers remain hard");
mustInclude(directorHardInput, 'blockingNeed === "provider_failure"', "Director provider failures remain hard");
mustInclude(directorHardInput, 'blockingNeed === "irreversible_decision"', "Director irreversible decisions can stop non-continuous modes");
mustInclude(directorHardInput, 'blockingNeed === "user_answer_expected" && resolveDirectorMode(consoleState.room) === "study"', "Director study answer waits remain hard outside continuous");

if (failures.length) {
  console.error(`Room continuous hard-blocker validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room continuous hard-blocker validation passed.");

function sliceFunction(source, name) {
  const start = Math.max(source.indexOf(`function ${name}`), source.indexOf(`export function ${name}`));
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const nextExport = source.indexOf("\nexport function ", start + 1);
  const nextPlain = source.indexOf("\nfunction ", start + 1);
  const candidates = [nextExport, nextPlain].filter((index) => index >= 0);
  return candidates.length ? source.slice(start, Math.min(...candidates)) : source.slice(start);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
