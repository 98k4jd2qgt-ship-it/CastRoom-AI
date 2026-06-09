import fs from "node:fs";

const ui = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const failures = [];

const dedupeSemanticObservations = sliceFunction(ui, "dedupeSemanticObservations");
const semanticObservationDashboardDedupeKey = sliceFunction(ui, "semanticObservationDashboardDedupeKey");
const preferredSemanticObservation = sliceFunction(ui, "preferredSemanticObservation");
const buildMemoryDashboardFacts = sliceFunction(ui, "buildMemoryDashboardFacts");

mustInclude(dedupeSemanticObservations, "semanticObservationDashboardDedupeKey(observation)", "semantic observations should dedupe by dashboard key, not only id");
mustInclude(dedupeSemanticObservations, "preferredSemanticObservation(current, observation)", "semantic dedupe should choose the preferred scoped observation");
mustInclude(semanticObservationDashboardDedupeKey, "sourceMessageIds", "semantic dedupe key should use source messages");
mustInclude(semanticObservationDashboardDedupeKey, "subjectId ?? observation.subjectName", "semantic dedupe key should keep subjects separate");
mustInclude(semanticObservationDashboardDedupeKey, "observation.kind", "semantic dedupe key should keep kinds separate");
mustInclude(preferredSemanticObservation, 'scope.includes(":role:")', "role-scoped observation should win over public duplicate in merged role views");

mustInclude(buildMemoryDashboardFacts, "semanticSourceMessageIds", "dashboard facts should track semantic-covered sources");
mustInclude(buildMemoryDashboardFacts, "mention.sourceMessageIds.some((sourceMessageId) => semanticSourceMessageIds.has(sourceMessageId))", "short-term facts should not duplicate semantic observations from the same message");
mustInclude(buildMemoryDashboardFacts, "persistentDedupeKeys.add(key)", "short-term dedupe keys should be recorded after rendering");

if (failures.length) {
  console.error(`Memory dashboard semantic dedup validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory dashboard semantic dedup validation passed.");

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
