import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[director-plot-arc] ${message}`);
    process.exitCode = 1;
  }
}

const types = read("src/core/types.ts");
const appState = read("src/core/appState.ts");
const scheduler = read("src/core/roomScheduler.ts");
const debate = read("src/core/debatePolicy.ts");
const main = read("src/main.ts");
const roomSurface = read("src/ui/roomSurface.ts");
const packageJson = read("package.json");

for (const marker of [
  "export type PlotBeat",
  "export interface PlotHook",
  "export interface PlotArcState",
  "export interface PlotPatch",
  "plotPatch?: PlotPatch",
  "plot?: PlotArcState",
  "plot: PlotArcState",
  '{ type: "room.setPlotArc"; plot: PlotArcState }',
]) {
  assert(types.includes(marker), `types.ts missing ${marker}`);
}

for (const marker of [
  "defaultRoomPlotArcState",
  "normalizeRoomPlotArcState",
  "plot: defaultRoomPlotArcState",
  "plot: normalizeRoomPlotArcState",
  'case "room.setPlotArc"',
]) {
  assert(appState.includes(marker), `appState.ts missing ${marker}`);
}

for (const marker of [
  "createPlotPatchFromDirectorPlan",
  "applyPlotPatch",
  "plotBeatFromDirectorPlan",
  "structuredOutcome.plotPatch",
  "plot,",
]) {
  assert(scheduler.includes(marker), `roomScheduler.ts missing ${marker}`);
}

assert(debate.includes("plotPatch"), "debatePolicy.ts must attach plotPatch to verdict outcomes");

for (const marker of [
  "buildDirectorPlotArcPromptBlock",
  "buildVisiblePlotArcPromptBlock",
  "buildCompactPlotArcLine",
  "room.setPlotArc",
]) {
  assert(main.includes(marker), `main.ts missing ${marker}`);
}

for (const marker of [
  "plotItems",
  "plotPublicHooks",
  "plotHiddenHooks",
  "hook.visibility === \"public\"",
]) {
  assert(roomSurface.includes(marker), `roomSurface.ts missing ${marker}`);
}

assert(
  !/hiddenPlotHookCount[\s\S]{0,300}\.text/.test(roomSurface),
  "Room Inspector must not render hidden plot hook text",
);

assert(
  packageJson.includes("node scripts/validate-director-plot-arc.mjs"),
  "package.json check script must include validate-director-plot-arc.mjs",
);

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[director-plot-arc] ok");
