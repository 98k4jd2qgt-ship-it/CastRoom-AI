import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const store = read("src/core/consoleMessageStore.ts");
const trace = read("src/core/chatTurnTrace.ts");

mustInclude(store, [
  "export class ConsoleMessageStore",
  "commit(",
  "hasCommitForTurn",
  "latestCommitForTurn",
  "this.messages.push(message)",
]);

mustInclude(trace, [
  "export class ChatTurnTraceLog",
  "input_component_submit",
  "main_onSubmitInput",
  "ui_submit_received",
  "ui_submit",
  "turn_created",
  "user_message_committed",
  "provider_selected",
  "request_started",
  "vision_request_started",
  "chat_request_started",
  "vision_caption_committed",
  "response_received",
  "result_parsed",
  "message_committed",
  "rendered",
  "formatLatest",
]);

mustInclude(main, [
  'from "./core/consoleMessageStore"',
  'from "./core/chatTurnTrace"',
  "const consoleMessageStore = new ConsoleMessageStore",
  "const chatTurnTraceLog = new ChatTurnTraceLog",
  "function appendConsoleMessage(input: Omit<ConsoleMessage, \"id\" | \"at\">, traceContext?",
  "appendConsoleMessageToCurrentStream",
  "queueConsoleHistorySaveForPack",
  "function commitConsoleTurnExpiredMessage",
  "consoleMessageStore.commit",
  "chatTurnTraceLog.record",
  "chatTurnTraceLog.markRendered",
  "function formatLastAiTraceDiagnostics",
  'if (input === "/ai trace")',
  "AI reply returned but could not be written to the chat window.",
]);

mustNotInclude(main, [
  "consoleMessages.push",
  "Generating reply",
]);

const handleConsoleInput = functionBlock(main, "handleConsoleInput");
mustInclude(handleConsoleInput, [
  'stage: "ui_submit"',
  'stage: "turn_created"',
  'stage: "user_message_committed"',
  "runCharacterTurn",
  "markSubmittedConversationInput(\"console\", value)",
  "isConsoleChatDomReady()",
]);

const runCharacterTurn = functionBlock(main, "runCharacterTurn");
mustInclude(runCharacterTurn, [
  'stage: "provider_selected"',
  'detail: "local_provider"',
  'requestId: `${turn.id}-${selection.id}`',
  "commitConsoleTurnExpiredMessage(turn, \"stale_before_provider\")",
  "commitConsoleTurnExpiredMessage(turn, \"stale_result\")",
  'detail: `failed:${turnResult.error.code}`',
  'stage: "result_parsed"',
  "applyCharacterResult(turnResult.result, writeMemory, turn)",
  'consoleMessageStore.hasCommitForTurn(turn.id, "character")',
  "commitConsoleTurnSystemMessage(turn, \"AI reply returned but could not be written to the chat window.\")",
]);

const auditBegin = functionBlock(main, "beginAiRequestAudit");
mustInclude(auditBegin, ["traceStage", "vision_request_started", "chat_request_started", "request_started", "requestId: audit.requestId"]);

const auditFinish = functionBlock(main, "finishAiRequestAudit");
mustInclude(auditFinish, ['stage: "response_received"', "detail: outcome"]);

if (failures.length) {
  console.error("Chat visible outcome validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Chat visible outcome validation passed.");

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

function functionBlock(text, functionName) {
  const start = text.indexOf(`function ${functionName}`);
  if (start === -1) {
    failures.push(`Missing function: ${functionName}`);
    return "";
  }
  const nextFunction = text.indexOf("\nfunction ", start + 1);
  return nextFunction === -1 ? text.slice(start) : text.slice(start, nextFunction);
}
