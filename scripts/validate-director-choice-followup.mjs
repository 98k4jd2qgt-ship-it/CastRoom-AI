import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

const timerAction = sliceFunction(main, "directorFollowupTimerAction");
mustIncludeIn(timerAction, "hasExecutableDirectorFollowup(result)", "Director timer action checks executable follow-up before wait-user handling");
mustIncludeIn(timerAction, 'return "schedule_once"', "Executable Director follow-up schedules one finite continuation");
mustNotIncludeIn(timerAction, 'result.move === "choice"', "Director timer action must not treat every choice move as wait-user");
mustIncludeIn(timerAction, "shouldWaitForUserAfterDirector(result)", "Director timer action waits only through explicit wait helper");

const createFollowup = sliceFunction(main, "createDirectorPendingFollowup");
mustIncludeIn(createFollowup, "hasExecutableDirectorFollowup(result)", "Director pending follow-up is created from executable target/directive");
mustNotIncludeIn(createFollowup, 'result.move === "choice"', "Choice move with a target role must still create follow-up");
mustIncludeIn(createFollowup, "normalizeDirectorContinuationPlan(result)", "Director follow-up normalizes next speaker/directive into execution state");

const waitHelper = sliceFunction(main, "shouldWaitForUserAfterDirector");
mustIncludeIn(waitHelper, "result.plan?.waitForUser", "Wait helper respects explicit waitForUser");
mustIncludeIn(waitHelper, 'result.move === "pause"', "Wait helper pauses only on pause move");
mustNotIncludeIn(waitHelper, 'result.move === "choice"', "Wait helper must not pause merely because move is choice");

const executableHelper = sliceFunction(main, "hasExecutableDirectorFollowup");
mustIncludeIn(executableHelper, "normalizeDirectorContinuationPlan(result)", "Executable helper delegates target/directive extraction");
mustIncludeIn(executableHelper, "targetRoleId", "Executable helper recognizes next speaker role");
mustIncludeIn(executableHelper, "privateDirective", "Executable helper recognizes private directive");

if (failures.length) {
  console.error(`Director choice follow-up validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("[director-choice-followup] ok");

function sliceFunction(source, name) {
  const match = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  const start = match?.index ?? -1;
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nasync function ", "\ninterface ", "\nconst "]
    .map((marker) => source.indexOf(marker, start + 1))
    .filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next < 0 ? source.slice(start) : source.slice(start, next);
}

function mustIncludeIn(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}

function mustNotIncludeIn(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`unexpected ${label}: ${marker}`);
  }
}
