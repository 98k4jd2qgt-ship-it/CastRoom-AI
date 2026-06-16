import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const failures = [];

const publicGate = sliceFunction(scheduler, "containsDirectorBackstageLeakText");
const roleFastPath = sliceFunction(scheduler, "shouldUseRoleFastPathForAutoDirectorPlan");

mustInclude(publicGate, "The\\s+room\\s+is\\s+ready", "default scene template is blocked from public Director output");
mustInclude(publicGate, "visible\\s+details\\s+settle\\s+into\\s+place", "scene-opening state dump is blocked from public Director output");
mustInclude(publicGate, "giving\\s+everyone\\s+something\\s+concrete\\s+to\\s+respond\\s+to", "template response-target text is blocked from public Director output");
mustInclude(publicGate, "\\u623f\\u95f4\\u5df2\\u7ecf\\u51c6\\u5907\\u597d", "Chinese default scene template is blocked from public Director output");
mustInclude(roleFastPath, "return true;", "ordinary Director cue is downgraded to a role fast path");
mustNotInclude(roleFastPath, 'mode !== "story" && mode !== "mystery"', "story/mystery cue-only exception");

if (failures.length) {
  console.error(`Director template public-output validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Director template public-output validation passed.");

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

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`unexpected ${label}: ${marker}`);
  }
}
