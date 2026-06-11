import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const scheduler = read("src/core/roomScheduler.ts");

mustInclude(main, 'knowledgeVisibility !== "public"', "Director public text should be blocked when knowledge visibility is not public");
mustInclude(main, 'publicText = ""', "Director public text gate should clear unsafe text");
mustInclude(main, 'publicTextReason = "none"', "Director public text gate should clear unsafe reason");
mustInclude(main, "sanitizeDirectorInspectorPatchForPublic", "Director inspector patch should be sanitized before public state");
mustInclude(scheduler, "publicSafe", "Director tick should mark public safety on inspector patches");
mustInclude(scheduler, "sourceVisibility", "Director tick should mark source visibility on inspector patches");
mustInclude(scheduler, "narrationBarrier", "Director tick should mark narration barrier state");
mustInclude(scheduler, "activePublicDirectorScriptTexts(room.director.scriptBoard.environmentAnchors)", "public narration should read public-safe environment anchors");
mustInclude(scheduler, "activePublicDirectorScriptTexts(room.director.scriptBoard.pressureSources)", "public narration should read public-safe pressure sources");
mustInclude(main, "completeDirectorNarrationBarrier(\"public_narration_blocked\", tick)", "unsafe or scheduling-flavored narration should be blocked through the barrier path");
mustInclude(scheduler, "lastRuling: input.room.simulation.lastRuling", "invalid public ruling should not leave ruling state behind");
mustInclude(scheduler, "lastTurnOutcome: null", "invalid public ruling should clear inspector outcome");
mustInclude(scheduler, "phase: input.room.simulation.phase", "invalid public ruling should not force payoff phase");

if (failures.length > 0) {
  console.error(`validate-director-public-output-source-gate failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-public-output-source-gate passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
