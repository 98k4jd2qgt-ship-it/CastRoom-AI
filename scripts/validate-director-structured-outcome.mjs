import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

mustInclude("src/core/types.ts", [
  "DirectorStructuredOutcome",
  "DirectorStatePatch",
  "SituationAssessment",
  "SituationAssessmentSummary",
  "statePatch",
  "matchPatch?: Partial<RoomMatchState>",
  "simulationPatch?: Partial<RoomSimulationState>",
  "inspectorPatch?:",
  "situationAssessment?: SituationAssessmentSummary",
  "structuredOutcome?: DirectorStructuredOutcome",
]);

mustInclude("src/core/roomScheduler.ts", [
  "createDirectorStructuredOutcomeFromPlan",
  "createSituationAssessment",
  "mergeSituationStatePatch",
  "structuredOutcome.statePatch",
  "structuredOutcome.publicText",
  "structuredOutcome.publicTextReason",
  "structuredOutcome.statePatch.simulationPatch",
  "structuredOutcome.statePatch.inspectorPatch",
  "structuredOutcome.statePatch.matchPatch",
  "situationMaterialSufficiency",
  "situationNextMove",
]);

mustInclude("src/main.ts", [
  "result.simulation",
  "result.inspectorPatch",
  "result.collaborationPlan",
  "lastTurnOutcome",
  "situationAssessment",
  "room.setSimulationState",
]);

mustInclude("src/ui/roomSurface.ts", [
  "room.match.lastVerdict",
  "lastVerdict.winnerLabel",
  "lastVerdict.summary",
  "room.simulation.situationAssessment",
  "situationReason",
]);

if (failures.length > 0) {
  console.error("validate-director-structured-outcome failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-director-structured-outcome passed");

function mustInclude(relativePath, markers) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`${relativePath} missing marker: ${marker}`);
    }
  }
}
