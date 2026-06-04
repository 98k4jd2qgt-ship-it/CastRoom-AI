import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const executor = read("src/core/consoleChatExecutor.ts");
const audit = read("src/core/aiRequestAudit.ts");
const trace = read("src/core/chatTurnTrace.ts");
const store = read("src/core/consoleMessageStore.ts");
const petConsole = read("src/ui/petConsole.ts");

mustInclude(executor, [
  "export class ConsoleChatExecutor",
  "activeQueuedTurn",
  "hasActiveTurn",
  "submit(input",
  "completedDedupeMs",
  "lastFinished?.turnKey === input.turnKey",
  "pending_turn",
  "this.turnEngine.startSubmit",
  "console-exec-",
  "turn.executorId = executorId",
  "clearIfCurrent",
  "this.lastFinished =",
]);

mustInclude(main, [
  "const consoleChatExecutor = new ConsoleChatExecutor(consoleTurnEngine);",
  "consoleChatExecutor.submit",
  "const queuedTurn = submitStart.queuedTurn",
  "const turn = queuedTurn.turn",
  'stage: "queued_turn_created"',
  "consoleChatExecutor.clearIfCurrent(turn)",
  "commitConsoleTurnSystemMessage",
  "AI reply ended without a visible result.",
  "AI reply returned but could not be written to the chat window.",
]);

mustInclude(audit, [
  "executorId",
  "input.turn?.executorId",
  "const requestPrefix = executorId ?? turnId",
  "if (input.turn && input.purpose === \"console_chat\" && input.turn.consoleCloudRequestStarted)",
]);

const finishAiRequestAudit = functionBlock(main, "finishAiRequestAudit");
mustInclude(finishAiRequestAudit, [
  'audit.scope === "console"',
  'audit.purpose === "console_chat"',
  'audit.purpose === "vision_caption"',
]);

const handleConsoleInput = functionBlock(main, "handleConsoleInput");
assertOrder(handleConsoleInput, "consoleChatExecutor.submit", "appendConsoleMessage({");
assertOrder(handleConsoleInput, "appendConsoleMessage({", "runCharacterTurn");
mustNotInclude(handleConsoleInput, ["consoleTurnEngine.startSubmit(turnKey)"]);

const runCharacterTurn = functionBlock(main, "runCharacterTurn");
mustInclude(runCharacterTurn, [
  "const providers = resolveConsoleTurnProviders()",
  "cloudTurnRuntime.run",
  "createProviderWithAuditedVision",
  "commitConsoleTurnSystemMessage(turn, lastError ?? noChatModelMessage())",
]);
mustInclude(runCharacterTurn, [
  "chatPurpose: \"console_chat\"",
  "visionPurpose: \"vision_caption\"",
]);

mustInclude(trace, [
  '"queued_turn_created"',
  '"vision_request_started"',
  '"vision_caption_committed"',
  '"chat_request_started"',
  '"message_committed"',
  '"rendered"',
]);

mustInclude(store, [
  "commit(",
  "hasCommitForTurn",
  "latestCommitForTurn",
  "updateLatestUserAttachmentCaptionForTurn",
]);

const renderInputRow = functionBlock(petConsole, "renderInputRow");
mustInclude(renderInputRow, [
  'input.type = "text"',
  "const submitFormValue = () =>",
  "if (submitLocked)",
  'props.onInputComponentEvent("submit_attempt"',
  'props.onInputComponentEvent("submit_locked"',
  'props.onInputComponentEvent("submit_empty"',
  'props.onInputComponentEvent("keydown_enter_submit"',
  'send.type = "button"',
  'send.addEventListener("click"',
  'props.onInputComponentEvent("send_click_submit"',
  'form.addEventListener("submit"',
  "submitFormValue();",
  "props.onSubmitInput(value, attachment)",
  'if (!draft.startsWith("/"))',
  "refreshCommandSuggestions(true)",
]);
mustNotInclude(renderInputRow, [
  'input.addEventListener("keyup"',
  "const submitOnce = () =>",
  "send.disabled =",
  "props.onSubmitAttempt(value, attachment)",
  "props.onPendingSubmitBlocked(value, attachment)",
  "form.requestSubmit()",
]);

if (failures.length) {
  console.error("Console room-like submit flow validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Console room-like submit flow validation passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, needles) {
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`Missing required text: ${needle}`);
    }
  }
}

function mustNotInclude(text, needles) {
  for (const needle of needles) {
    if (text.includes(needle)) {
      failures.push(`Forbidden text is present: ${needle}`);
    }
  }
}

function assertOrder(text, first, second) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1) {
    failures.push(`Cannot verify order: ${first} before ${second}`);
    return;
  }
  if (firstIndex > secondIndex) {
    failures.push(`Wrong order: ${first} should appear before ${second}`);
  }
}

function functionBlock(text, functionName) {
  const start = text.indexOf(`function ${functionName}`);
  if (start === -1) {
    failures.push(`Missing function: ${functionName}`);
    return "";
  }
  const nextFunction = text.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? text.slice(start) : text.slice(start, nextFunction);
}
