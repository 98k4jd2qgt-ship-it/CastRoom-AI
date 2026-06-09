import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

mustInclude(main, "capturedAt: number;", "conversation input snapshots include capture time");
mustInclude(main, "const capturedAt = Date.now();", "captureConversationInputSnapshot records capture time");
mustInclude(main, "stability.lastInputAt > latestDraftSnapshot.capturedAt", "restore skips stale snapshots after newer input");
mustInclude(main, "function shouldDeferInputSensitiveRender(", "input-sensitive structural render guard");
mustInclude(main, "function scheduleDeferredInputSensitiveRender(", "deferred input-sensitive render scheduler");
mustInclude(main, "UI.render.deferred_input_sensitive", "diagnostic for deferred input-sensitive renders");

const requestRender = sliceFunction(main, "requestRender");
mustInclude(requestRender, "shouldDeferInputSensitiveRender(workspace, options)", "requestRender checks input-sensitive structural renders before RenderGate");
mustInclude(requestRender, "scheduleDeferredInputSensitiveRender(reason, workspace, options)", "requestRender defers structural renders while input is active");
mustInclude(requestRender, "return false;", "deferred input-sensitive render does not replace DOM immediately");

const deferGuard = sliceFunction(main, "shouldDeferInputSensitiveRender");
mustInclude(deferGuard, "if (options.force)", "forced renders remain available");
mustInclude(deferGuard, "if (!options.structural && options.kind !== \"structural\")", "non-structural local updates are not delayed");
mustInclude(deferGuard, "stability.composing", "composition is protected");
mustInclude(deferGuard, "activeEditable", "focused editable room input is protected");
mustInclude(deferGuard, "recentComposition", "recent IME composition is protected");

const restoreInput = sliceFunction(main, "restoreConversationInputState");
mustInclude(restoreInput, "snapshotIsStale", "restoreConversationInputState detects stale snapshots");
mustInclude(restoreInput, "!snapshotIsStale", "stale snapshots cannot overwrite newer DOM/draft input");

if (failures.length) {
  console.error(`Conversation input IME stability validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Conversation input IME stability validation passed.");

function sliceFunction(text, name) {
  const start = Math.max(text.indexOf(`function ${name}`), text.indexOf(`async function ${name}`));
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nasync function "]
    .map((marker) => text.indexOf(marker, start + 1))
    .filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next < 0 ? text.slice(start) : text.slice(start, next);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
