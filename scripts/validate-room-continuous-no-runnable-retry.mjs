import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const syncRoomAutoTimer = extractFunction(main, "syncRoomAutoTimer");
const ensureRoomAutoProgress = extractFunction(main, "ensureRoomAutoProgress");
const runRoomAutoTurn = extractFunction(main, "runRoomAutoTurn");

mustInclude(main, "function scheduleContinuousRetry", "continuous soft idle should have a dedicated retry helper");
mustInclude(main, "continuous_soft_retry_queued", "continuous soft retries should be diagnosed");
mustInclude(syncRoomAutoTimer, "if (!canRunRoomAutoHardGate())", "timer sync should check hard gates before clearing timers");
mustInclude(syncRoomAutoTimer, "reason: \"no_runnable_work_timer_sync\"", "timer sync should convert soft no-runnable work into a retry");
mustInclude(syncRoomAutoTimer, "roomAutoTimer = window.setTimeout(runRoomAutoTurn, delay)", "soft retry should register a real timer");

const ensureFirstGuardStart = ensureRoomAutoProgress.indexOf("if (");
const ensureFirstGuardEnd = ensureRoomAutoProgress.indexOf(") {", ensureFirstGuardStart);
const ensureEarlyGuard = ensureRoomAutoProgress.slice(ensureFirstGuardStart, ensureFirstGuardEnd);
mustNotInclude(
  ensureEarlyGuard,
  "!hasRunnableRoomAutoWork()",
  "watchdog must not return early on transient no-runnable work in continuous flow",
);
mustInclude(ensureRoomAutoProgress, "scheduleContinuousRetry(\"watchdog_no_runnable_work\")", "watchdog should repair no-runnable work with a short retry");

const noRunnableBranch = extractIfBlock(runRoomAutoTurn, "if (!hasRunnableRoomAutoWork())");
mustInclude(noRunnableBranch, "if (isContinuousRoomFlow(consoleState.room))", "auto turn no-runnable branch should special-case continuous");
mustInclude(noRunnableBranch, "scheduleContinuousRetry(\"no_runnable_work\")", "continuous no-runnable work should queue a retry instead of clearing timers");

const runtimeBusyBranch = extractIfBlock(runRoomAutoTurn, "if (consoleTurnEngine.activeTurn?.status === \"pending\")");
mustInclude(runtimeBusyBranch, "scheduleContinuousRetry(\"runtime_busy\", 250)", "continuous runtime busy should queue a short retry");

if (failures.length > 0) {
  console.error(`validate-room-continuous-no-runnable-retry failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-room-continuous-no-runnable-retry passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  failures.push(`unterminated function ${name}`);
  return source.slice(start);
}

function extractIfBlock(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) {
    failures.push(`missing branch ${marker}`);
    return "";
  }
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) {
      return source.slice(start, index + 1);
    }
  }
  failures.push(`unterminated branch ${marker}`);
  return source.slice(start);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}

function mustNotInclude(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`${label}: unexpected ${marker}`);
  }
}
