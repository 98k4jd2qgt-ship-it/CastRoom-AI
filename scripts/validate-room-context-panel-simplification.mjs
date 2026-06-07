import fs from "node:fs";

const failures = [];
const surface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");

const statusBlock = blockBetween("function renderRoomInspectorStatus", "function renderRoomInspectorActions");
const contextBlock = blockBetween("function buildRoomContextPanel", "function compactList");

mustInclude(statusBlock, 'statusPill(t(language, "roomInspectorFlow")', "status shows flow");
mustInclude(statusBlock, 'statusPill(t(language, "roomInspectorDirector")', "status shows director");
mustInclude(statusBlock, 'statusPill(t(language, "roomInspectorChannel")', "status shows channel");
mustInclude(statusBlock, "const showModelWarning =", "model warning is conditional");
mustInclude(statusBlock, "if (showModelWarning)", "model pill only appears on warning");

for (const hiddenDefaultPill of [
  'statusPill(roomUiText(language, "mode")',
  'statusPill(roomUiText(language, "show")',
  'statusPill(roomUiText(language, "freedom")',
  'statusPill(roomUiText(language, "objective")',
  'statusPill(roomUiText(language, "turn")',
  'statusPill(roomUiText(language, "plan")',
]) {
  mustNotInclude(statusBlock, hiddenDefaultPill, `default status pill ${hiddenDefaultPill}`);
}

mustInclude(contextBlock, 'const showDiagnostics = room.freedomLevel === "developer" || activeChannel.type === "director";', "developer/director diagnostics gate");
mustInclude(contextBlock, "const modeSections = sectionsByMode[mode] ?? sectionsByMode.casual;", "mode sections are the default panel");
mustInclude(contextBlock, "!showDiagnostics && needsReviewConstraints.length > 0", "public warning constraints remain visible");
mustInclude(contextBlock, "const diagnosticSections", "diagnostic section collection");
mustInclude(contextBlock, 'id: "simulation"', "diagnostics keep simulation");
mustInclude(contextBlock, 'id: "plot"', "diagnostics keep plot");
mustInclude(contextBlock, 'id: "frame"', "diagnostics keep frame");
mustInclude(contextBlock, 'id: "collaboration"', "diagnostics keep collaboration");
mustInclude(contextBlock, 'id: "director-script"', "diagnostics keep director script");
mustInclude(contextBlock, 'id: "continuity"', "diagnostics keep continuity");
mustInclude(contextBlock, "sections: [...modeSections, ...publicWarningSections, ...diagnosticSections]", "default sections precede optional diagnostics");
mustNotInclude(contextBlock, 'sections: [\n      {\n        id: "simulation"', "old always-on simulation-first panel");
mustInclude(contextBlock, "team: teamSections", "team mode uses the shared section path");

if (failures.length) {
  console.error(`Room context panel simplification validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room context panel simplification validation passed.");

function blockBetween(startMarker, endMarker) {
  const start = surface.indexOf(startMarker);
  const end = surface.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    failures.push(`missing block ${startMarker} -> ${endMarker}`);
    return "";
  }
  return surface.slice(start, end);
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
