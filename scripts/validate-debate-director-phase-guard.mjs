import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[debate-director-phase-guard] ${message}`);
    process.exitCode = 1;
  }
}

const scheduler = read("src/core/roomScheduler.ts");
const debate = read("src/core/debatePolicy.ts");

assert(
  scheduler.includes("validateDirectorPublicTextAgainstSituation"),
  "Director public text must pass through a situation guard",
);
assert(
  scheduler.includes("stale_debate_setup_text") &&
    scheduler.includes("先确认辩题") &&
    scheduler.includes("再按阵营分轮发言"),
  "Situation guard must explicitly block stale debate setup wording",
);
assert(
  scheduler.includes("isDebateFinalVerdictDue(input.room)") &&
    scheduler.includes("forceFinal: forceFinalVerdict"),
  "Director structured outcome must force final verdict when deferred verdict is due",
);
assert(
  scheduler.includes("createDebateSituationSafePublicText") &&
    scheduler.includes("不需要重新确认流程"),
  "Stale setup text must be replaced with phase-aware debate continuation text",
);
assert(
  debate.includes("spokenRoleIdsByRound") &&
    debate.includes("debateLifecyclePhase") &&
    debate.includes("verdict_due"),
  "Debate policy must track spoken roles and expose verdict_due phase",
);
assert(
  debate.includes("addDeferredFinalVerdict") &&
    debate.includes("all_relevant_speakers_done"),
  "Deferred final verdict must be preserved until all required speakers are done",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[debate-director-phase-guard] ok");
