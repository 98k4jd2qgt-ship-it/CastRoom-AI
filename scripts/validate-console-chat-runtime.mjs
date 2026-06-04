import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const petConsole = read("src/ui/petConsole.ts");

const { ChatTurnEngine } = await importTsModule("src/core/chatTurnEngine.ts");
const { ConsoleMessageStore } = await importTsModule("src/core/consoleMessageStore.ts");

runRuntimeAssertions();
runSourceAssertions();

if (failures.length) {
  console.error("Console chat runtime validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Console chat runtime validation passed.");

function runRuntimeAssertions() {
  const engine = new ChatTurnEngine({ dedupeMs: 750, staleMs: 60_000 });
  const store = new ConsoleMessageStore([]);

  const accepted = engine.startSubmit("hello\nno-image", 1_000);
  assert(accepted.status === "accepted", "first normal submit should be accepted");
  if (accepted.status !== "accepted") {
    return;
  }
  const turn = accepted.turn;
  store.commit({ speaker: "you", text: "hello", kind: "user" }, { turnId: turn.id, atLabel: "00:00" });
  assert(store.hasCommitForTurn(turn.id, "user"), "accepted turn should have a user commit");

  store.commit({ speaker: "Mio", text: "hello there", kind: "character", emotion: "idle" }, { turnId: turn.id, atLabel: "00:00" });
  assert(store.hasCommitForTurn(turn.id, "character"), "successful turn should have a character commit");
  engine.commitResult(turn);
  assert(turn.visibleTerminalCommitted, "successful turn should mark visible terminal committed");
  assert(turn.status === "completed", "successful turn should complete");

  const second = engine.startSubmit("second\nno-image", 1_500);
  assert(second.status === "accepted", "new submit after completed turn should be accepted");
  if (second.status === "accepted") {
    const duplicateWhilePending = engine.startSubmit("third\nno-image", 1_600);
    assert(duplicateWhilePending.status === "blocked", "pending turn should block a second submit");
    assert(duplicateWhilePending.status !== "blocked" || duplicateWhilePending.reason === "pending_turn", "pending block should be explicit");

    store.commit({ speaker: "system", text: "visible error", kind: "system" }, { turnId: second.turn.id, atLabel: "00:01" });
    engine.commitError(second.turn, "visible error");
    assert(store.hasCommitForTurn(second.turn.id, "system"), "failed turn should have a visible system commit");
    assert(second.turn.visibleTerminalCommitted, "failed turn should mark visible terminal committed");
  }
}

function runSourceAssertions() {
  mustInclude(main, "function resolveAiTurnProviders", "shared AI turn provider resolver");
  mustInclude(main, "blockReason", "provider candidates carry a blocked reason");
  mustInclude(main, "if (!selection.live)", "console turn skips blocked providers visibly");
  mustInclude(main, "AI.console.provider_blocked", "blocked provider diagnostic is recorded");
  mustInclude(main, "function canReplaceConsoleHistory", "character history replacement is guarded");
  mustInclude(main, "consoleMessageStore.revision === messageRevisionAtStart", "late history loads cannot overwrite newly committed messages");
  mustInclude(main, "queueConsoleHistorySaveForPack", "character history saves are queued off the hot path");
  mustInclude(main, "appendConsoleMessageToCurrentStream", "console chat messages can be appended without a full render");
  mustInclude(main, "historyReplaceSkippedCount", "history replacement skips are visible in diagnostics");
  mustInclude(main, "lastChatInputDraft", "chat input draft is tracked before submit");
  mustInclude(main, "lastConsoleInputEvent", "latest input component event is tracked");
  mustInclude(main, "recordConsoleInputComponentEvent", "input component events are recorded separately from command submits");
  mustInclude(main, "chat input was observed, but no chat submit has been recorded after it.", "trace explains draft-without-submit failures");
  mustInclude(main, "lastChatConsoleUiSubmitTrace", "latest chat UI submit is preserved after command diagnostics");
  mustNotInclude(petConsole, "form.requestSubmit()", "Enter should submit through the same helper without relying on requestSubmit");
  mustInclude(petConsole, 'send.type = "button"', "Send button submits through the same helper without relying on browser form behavior");
  mustInclude(petConsole, 'send.addEventListener("click"', "Send click invokes the console submit helper directly");
  mustInclude(petConsole, "props.onInputComponentEvent(", "input component emits diagnostic events for typing, Enter, Send and blockers");
  mustInclude(petConsole, '"keydown_enter_submit"', "Enter submit is observable");
  mustInclude(petConsole, '"send_click_submit"', "Send click submit is observable");
  mustInclude(petConsole, '"submit_empty"', "empty submit is observable");
  mustInclude(petConsole, '"submit_locked"', "locked submit is observable");
  mustInclude(petConsole, "submitFormValue();", "form submit invokes the single submit helper");
  mustNotInclude(petConsole, "props.onPendingSubmitBlocked(value, attachment)", "UI must not pre-block pending submits before the executor");
  mustNotInclude(petConsole, "const submitOnce = () =>", "legacy submitOnce helper is removed");

  const handleConsoleInput = functionBlock(main, "handleConsoleInput");
  mustInclude(handleConsoleInput, 'submitStart.status === "blocked"', "executor handles pending submits centrally");
  mustInclude(handleConsoleInput, "appendPendingTurnNotice", "pending submit produces a visible notice");

  const resolver = functionBlock(main, "resolveAiTurnProviders");
  mustInclude(resolver, "localDiagnostics.enabled", "console resolver includes enabled local provider even when blocked");
  mustInclude(resolver, "consoleCloudProviderBlockReason()", "console resolver reports global cloud block reason");
  mustInclude(resolver, "sourceLabel: \"Global Chat model\"", "console resolver labels global Chat source");
}

async function importTsModule(relativePath) {
  const fullPath = path.join(root, relativePath);
  const source = fs.readFileSync(fullPath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName: fullPath,
  }).outputText;
  const tempDir = path.join(root, "node_modules", ".cache", "castroom-validators");
  fs.mkdirSync(tempDir, { recursive: true });
  const outPath = path.join(tempDir, `${path.basename(relativePath, ".ts")}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(outPath, output, "utf8");
  return import(pathToFileURL(outPath).href);
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
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

function functionBlock(text, functionName) {
  const start = text.indexOf(`function ${functionName}`);
  if (start === -1) {
    failures.push(`missing function: ${functionName}`);
    return "";
  }
  const nextFunction = text.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? text.slice(start) : text.slice(start, nextFunction);
}

function sliceBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    failures.push(`could not slice ${startMarker} -> ${endMarker}`);
    return "";
  }
  return text.slice(start, end);
}
