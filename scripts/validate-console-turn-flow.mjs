import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");
const engine = read("src/core/chatTurnEngine.ts");
const executor = read("src/core/consoleChatExecutor.ts");
const audit = read("src/core/aiRequestAudit.ts");
const trace = read("src/core/chatTurnTrace.ts");
const appState = read("src/core/appState.ts");
const petConsole = read("src/ui/petConsole.ts");
const styles = read("src/styles.css");
const viteConfig = read("vite.config.ts");

mustInclude(engine, [
  "export class ChatTurnEngine",
  "private active",
  "private lastSubmitTrace",
  "hasPendingTurn",
  "isDuplicateSubmit",
  "isStale",
  "startSubmit",
  "begin(key",
  "updateStage",
  "selectProviders",
  "commitResult",
  "commitError",
  "markCancelled",
  "provider_selected",
  "result_committed",
  "error_committed",
  "cancelActive",
  "clearIfCurrent",
  "createAcceptedTrace",
  "updateAcceptedTrace",
  "export interface ConsoleTurnController",
  "executorId?: string;",
  "consoleCloudRequestStarted: boolean;",
  "visibleTerminalCommitted: boolean;",
]);

mustInclude(executor, [
  "export class ConsoleChatExecutor",
  "export interface ConsoleQueuedTurn",
  "ConsoleExecutorSubmitResult",
  "hasActiveTurn",
  "submit(input",
  "completedDedupeMs",
  "lastFinished?.turnKey === input.turnKey",
  "this.turnEngine.startSubmit",
  "turn.executorId = executorId",
  "clearIfCurrent",
  "this.lastFinished =",
]);

mustInclude(audit, [
  "export class AiRequestAuditLog",
  "private sequence",
  "private entries",
  "get latest",
  "snapshot()",
  "begin(input",
  "finish(",
  "consoleCloudRequestStarted",
  "cloud_request_started",
  "export interface AiRequestAuditEntry",
  "export interface AiRequestAuditHandle",
  "export interface AiRequestAuditDuplicate",
  "executorId",
]);

mustInclude(main, [
  'from "./core/chatTurnEngine"',
  'from "./core/consoleChatExecutor"',
  'from "./core/aiRequestAudit"',
  'from "./core/chatTurnTrace"',
  "const consoleTurnEngine = new ChatTurnEngine({ dedupeMs: 750, staleMs: 60_000 });",
  "const consoleChatExecutor = new ConsoleChatExecutor(consoleTurnEngine);",
  "const aiRequestAuditLog = new AiRequestAuditLog(20);",
  "let lastConsoleUiSubmitTrace",
  "let lastChatConsoleUiSubmitTrace",
  "let lastCommandConsoleUiSubmitTrace",
  "let lastAnySubmit",
  "let lastConsoleInputEvent",
  "let lastChatInputDraft",
  "let lastCommandInputDraft",
  "let lastChatSubmit",
  "let lastCommandSubmit",
  "let lastAcceptedConsoleTurn",
  "let lastBlockedConsoleSubmit",
  "function recordConsoleUiSubmitStage",
  "function recordConsoleInputComponentEvent",
  "markSubmittedConversationInput",
  "isRecentlySubmittedConversationInput",
  "function linkConsoleUiSubmitToTurn",
  "function beginAiRequestAudit",
  "aiRequestAuditLog.begin",
  "AI.console.duplicate_request_blocked",
  "aiRequestAuditLog.finish",
  "function canRunForegroundRoomFlow",
  'activeSurface === "room"',
  'activeConsoleView === "room"',
  "consoleState.room.id === consoleState.activeRoomId",
  'consoleTurnEngine.activeTurn?.status !== "pending"',
  "function syncRoomAutoTimer",
  "function runRoomAutoTurn",
  'purpose: "config_test"',
  'chatPurpose: "console_chat"',
  'purpose: "room_planner"',
  'chatPurpose: "room_speaker"',
  'chatPurpose: "room_director"',
  "hasUsableCloudSecret",
  "canUseNativeSecretRef",
  "formatLastAiRequestDiagnostics",
  "formatLastAiTraceDiagnostics",
  "Latest console UI submit:",
  "lastChatInputDraft:",
  "lastCommandInputDraft:",
  "lastInputEvent:",
  "Last input submits:",
  "lastChatSubmit:",
  "lastCommandSubmit:",
  "Last accepted console turn:",
  "appendPendingTurnNotice",
  "cancelActiveConsoleTurn",
  "captureConsoleAiEligibility",
  "AI.console.no_provider",
  "queued_turn_created",
]);

mustNotInclude(main, [
  "interface ConsoleTurnController",
  "interface ConsoleSubmitTrace",
  "interface ConsoleAcceptedTurnTrace",
  "interface ConsoleBlockedSubmitTrace",
  "let activeConsoleTurn",
  "let lastConsoleSubmit",
  "let consoleTurnSequence",
  "let consoleRequestSequence",
  "const consoleAiRequestAuditEntries",
  "CONSOLE_SUBMIT_DEDUPE_MS",
  "CONSOLE_TURN_STALE_MS",
  "Generating reply",
  "CONSOLE_TURN_VISIBLE_TIMEOUT_MS",
  "runOneOnOneTurnWithVisibleTimeout",
  "lastUiSubmitAgeMs",
  "lastUiSubmitPreview",
  "CONSOLE_INPUT_DIAGNOSTIC_REVISION",
  "lastAnyInputDraftActivity",
  "lastNonEmptyInputDraftActivity",
  "lastCommandDraftActivity",
  "lastChatDraftActivity",
  "lastConsoleRawInputEvent",
  "recordConsoleInputDraftActivity",
  "recordConsoleRawInputEvent",
  "recordConsoleSubmitAttempt",
  "registerConsoleInputFallbackHandlers",
  "scheduleConsoleInputFallbackSubmit",
  "onSubmitAttempt:",
  "lastAnyDraft:",
  "lastNonEmptyDraft:",
  "lastCommandDraft:",
  "lastChatDraft:",
  "lastRawInputEvent:",
  "lastRawConsoleSubmit",
  "lastRawChatSubmit",
  "lastRawCommandSubmit",
  "lastDomConsoleInputEvent",
  "lastDomChatInputDraft",
  "lastDomCommandInputDraft",
  "registerConsoleInputCaptureDiagnostics",
  "recordDomConsoleInputEvent",
  "isConsoleChatInputElement",
]);

const syncRoomAutoTimer = functionBlock(main, "syncRoomAutoTimer");
mustInclude(syncRoomAutoTimer, ["!canRunRoomAutoHardGate()", "clearRoomAutoScheduledTimer()", "window.setTimeout"]);
mustInclude(functionBlock(main, "canRunRoomAutoHardGate"), ["canRunForegroundRoomFlow()", "consoleState.room.isOpen"]);
mustNotInclude(syncRoomAutoTimer, ["window.clearTimeout(roomAutoImmediateDispatchTimer)"]);

const runRoomAutoTurn = functionBlock(main, "runRoomAutoTurn");
mustInclude(runRoomAutoTurn, ["!canRunForegroundRoomFlow()", "pauseRoomAutoOutsideForeground()", "return;"]);
assertOrder(runRoomAutoTurn, "!canRunForegroundRoomFlow()", "createRoomPlannerResult");

const openConsole = functionBlock(main, "openConsole");
mustInclude(openConsole, ["clearRoomAutoTimer()"]);

const openPetMode = functionBlock(main, "openPetMode");
mustInclude(openPetMode, ["clearRoomAutoTimer()"]);

const handleConsoleInput = functionBlock(main, "handleConsoleInput");
mustInclude(handleConsoleInput, [
  'const isCommand = input.startsWith("/")',
  "if (!isCommand)",
  'recordConsoleUiSubmitStage("submit_handler_entered"',
  "lastCommandSubmit",
  "lastChatSubmit",
  "recordBlockedConsoleSubmit",
  "consoleChatExecutor.submit",
  'submitStart.status === "blocked"',
  'submitStart.reason === "pending_turn"',
  "appendPendingTurnNotice",
  "const queuedTurn = submitStart.queuedTurn",
  "const turn = queuedTurn.turn",
  "linkConsoleUiSubmitToTurn(turn.id, valuePreview)",
  'stage: "queued_turn_created"',
  "lastAcceptedConsoleTurn = createAcceptedTurnTrace",
  "runCharacterTurn",
]);
mustInclude(handleConsoleInput, ["if (isCommand)"]);
assertOrder(handleConsoleInput, 'const isCommand = input.startsWith("/")', 'recordConsoleUiSubmitStage("submit_handler_entered"');
assertOrder(handleConsoleInput, 'const isCommand = input.startsWith("/")', "if (isCommand)");
assertOrder(handleConsoleInput, "consoleChatExecutor.submit", "runCharacterTurn");

const runCharacterTurn = functionBlock(main, "runCharacterTurn");
mustInclude(runCharacterTurn, [
  "const providers = resolveConsoleTurnProviders()",
  "AI.console.no_provider",
  "captureConsoleAiEligibility(providers)",
  "cloudTurnRuntime.run",
  "createProviderWithAuditedVision",
]);
mustNotInclude(runCharacterTurn, [
  "AI reply was cancelled before it could be shown",
  "AI reply expired before it could be shown",
]);

const aiProviderCascade = functionBlock(main, "aiProviderCascade");
mustInclude(aiProviderCascade, [
  "resolveConsoleTurnProviders",
]);

const resolveConsoleTurnProviders = functionBlock(main, "resolveConsoleTurnProviders");
mustInclude(resolveConsoleTurnProviders, [
  "resolveAiTurnProviders",
  'purpose: "console_chat"',
]);

const resolveAiTurnProviders = functionBlock(main, "resolveAiTurnProviders");
mustInclude(resolveAiTurnProviders, [
  "providerResolver.resolve({",
  "localDiagnostics.enabled",
  "shouldAttemptLocalChatModel()",
  "blockReason",
  "consoleCloudProviderBlockReason()",
  "sourceLabel: \"Global Chat model\"",
  "chatConfig: !cloudBlockReason ? readLiveAiConfig(\"chat\") : undefined",
  "visionConfig: !cloudBlockReason && canAttemptVisionCaption() ? readLiveAiConfig(\"vision\") : null",
  "resolution.providerIds",
  "resolution.liveProviderIds",
  "resolution.blockReasons",
]);
assertOrder(
  resolveAiTurnProviders,
  "local: localCandidate",
  "cloud: cloudCandidate",
);

const diagnostics = functionBlock(main, "formatLastAiRequestDiagnostics");
mustInclude(diagnostics, [
  "Last input submits:",
  "lastAnySubmit:",
  "lastChatSubmit:",
  "lastCommandSubmit:",
  "lastBlockedSubmit:",
  "Last accepted console turn:",
  "Active console turn:",
  "cloudRequestStarted",
  "cancel: /ai cancel",
  "Recent request audits:",
  "formatRecentAiRequestAuditLines()",
  "Current chat eligibility:",
  "providers:",
]);

const traceDiagnostics = functionBlock(main, "formatLastAiTraceDiagnostics");
mustInclude(traceDiagnostics, [
  "Latest submit summary:",
  "lastChatInputDraft:",
  "lastCommandInputDraft:",
  "lastChatSubmit:",
  "lastCommandSubmit:",
  "lastBlockedSubmit:",
  "lastInputEvent:",
  "chat input was observed, but no chat submit has been recorded after it.",
  "Latest console UI submit:",
  "lastConsoleUiSubmitTrace",
  "Latest chat UI submit:",
  "lastChatConsoleUiSubmitTrace",
  "chatTurnTraceLog.formatLatest()",
  "Latest request audit:",
  "Recent request audits:",
  "formatRecentAiRequestAuditLines()",
]);

const recentAuditLines = functionBlock(main, "formatRecentAiRequestAuditLines");
mustInclude(recentAuditLines, [
  "aiRequestAuditLog.snapshot().slice(-limit)",
  "scope=${entry.scope}",
  "purpose",
  "executor=${entry.executorId",
  "request=${entry.requestId}",
]);

const handlePetInput = functionBlock(main, "handlePetInput");
mustInclude(handlePetInput, [
  'if (!input.startsWith("/"))',
  'recordConsoleUiSubmitStage("ui_submit_received", valuePreview, "pet_input")',
  'recordConsoleUiSubmitStage("ui_form_submit", valuePreview, "pet_input")',
  'recordConsoleUiSubmitStage("submit_dispatched_to_console", valuePreview, "pet_input")',
  "await handleConsoleInput(input)",
]);
assertOrder(handlePetInput, 'recordConsoleUiSubmitStage("submit_dispatched_to_console"', "await handleConsoleInput(input)");

const renderPetConsoleSubmit = main.slice(main.indexOf("renderPetConsole({"));
mustInclude(renderPetConsoleSubmit, [
  "onInputDraftChange:",
  'recordConsoleUiSubmitStage("ui_submit_received"',
  'recordConsoleUiSubmitStage("ui_form_submit"',
  'recordConsoleUiSubmitStage("submit_dispatched_to_console"',
  "void handleConsoleInput(value, attachment)",
]);
assertOrder(
  renderPetConsoleSubmit,
  'recordConsoleUiSubmitStage("ui_submit_received"',
  'recordConsoleUiSubmitStage("ui_form_submit"',
);
assertOrder(
  renderPetConsoleSubmit,
  'recordConsoleUiSubmitStage("ui_form_submit"',
  'recordConsoleUiSubmitStage("submit_dispatched_to_console"',
);
assertOrder(renderPetConsoleSubmit, 'recordConsoleUiSubmitStage("submit_dispatched_to_console"', "void handleConsoleInput");

mustInclude(styles, [
  ".console-input-row",
  ".console-input",
  ".console-input-wrap",
  ".console-attach",
  "-webkit-app-region: no-drag;",
]);

const restoreConversationInputState = functionBlock(main, "restoreConversationInputState");
mustInclude(restoreConversationInputState, [
  "snapshotWasJustSubmitted",
  "isRecentlySubmittedConversationInput",
  "shouldRestoreSnapshotValue",
  "!snapshotWasJustSubmitted",
  "!latestFocusRequest",
  "latestDraftSnapshot?.target === latestTarget",
  "const draftValue = shouldRestoreSnapshotValue ? latestDraftSnapshot.value : savedDraft.value;",
]);
mustNotInclude(restoreConversationInputState, [
  "latestDraftSnapshot?.target === latestTarget ? latestDraftSnapshot.value : savedDraft.value",
]);

mustInclude(trace, [
  '"ui_submit_received"',
  '"ui_form_submit"',
  '"submit_handler_entered"',
  '"submit_dispatched_to_console"',
  '"queued_turn_created"',
  'parts.join(" | ")',
]);
mustNotInclude(trace, ["\u00e8\u00b7\u00af"]);

const keyPreviewBlock = caseBlock(appState, 'case "ai.setEndpointKeyPreview"');
mustInclude(keyPreviewBlock, [
  "if (!action.apiKeyPreview.trim())",
  "return clearEndpointKey",
  "API key cleared",
]);

const legacyKeyPreviewBlock = caseBlock(appState, 'case "ai.setKeyPreview"');
mustInclude(legacyKeyPreviewBlock, [
  "if (!action.apiKeyPreview.trim())",
  'apiKeyPreview: ""',
  "API key cleared",
]);

const endpointInput = functionBlock(appState, "updateEndpointAfterInput");
mustInclude(endpointInput, ["currentValue.trim()", "value.trim()"]);

const aiStatus = functionBlock(petConsole, "resolveCharacterAiStatus");
mustInclude(aiStatus, [
  'runtimeStatus === "requesting"',
  'runtimeStatus === "last_success"',
  'runtimeStatus === "last_error"',
  'status === "ready"',
]);
assertOrder(aiStatus, 'runtimeStatus === "requesting"', 'status === "ready"');

const renderInputRow = functionBlock(petConsole, "renderInputRow");
mustInclude(renderInputRow, [
  "let submitLocked = false",
  'input.type = "text"',
  "let commandSuggestions = commandSuggestionsForDraft(props.inputDraft)",
  "props.onInputComponentEvent(",
  "let renderCommandSuggestions = () => {}",
  "const refreshCommandSuggestions = (resetIndex = false) =>",
  "commandSuggestions",
  "renderCommandSuggestions();",
  "suggestions.replaceChildren();",
  "wrap.insertBefore(suggestions",
  "suggestions.remove();",
  "const submitFormValue = () =>",
  'props.onInputComponentEvent("submit_attempt"',
  'props.onInputComponentEvent("submit_locked"',
  'props.onInputComponentEvent("submit_empty"',
  "if (event.repeat)",
  '"input_change"',
  "refreshCommandSuggestions(true)",
  'event.key === "PageDown"',
  'event.key === "PageUp"',
  'event.key === "Enter"',
  'props.onInputComponentEvent("keydown_enter_submit"',
  'send.type = "button"',
  'send.addEventListener("click"',
  'props.onInputComponentEvent("send_click_submit"',
  "completeCommandSuggestion(commandSuggestions[commandSuggestionIndex].command)",
  'props.onInputComponentEvent("command_suggestion_select"',
  'chip.dataset.active = String(index === commandSuggestionIndex)',
  'form.addEventListener("submit"',
  "submitFormValue();",
]);
mustNotInclude(renderInputRow, [
  "submitBlocked",
  "send.disabled =",
  'input.addEventListener("keyup"',
  "const submitOnce = () =>",
  "props.onPendingSubmitBlocked(value, attachment)",
  "form.requestSubmit()",
]);
assertOrder(renderInputRow, 'props.onInputDraftChange("", 0, 0)', "props.onSubmitInput(value, attachment)");

mustInclude(viteConfig, [
  "watch:",
  "**/character-packs/**/memory/**",
  "**/deleted-character-packs/**",
]);

if (failures.length) {
  console.error("Console turn flow validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Console turn flow validation passed.");

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

function caseBlock(text, caseLabel) {
  const start = text.indexOf(caseLabel);
  if (start === -1) {
    failures.push(`Missing case: ${caseLabel}`);
    return "";
  }
  const nextCase = text.indexOf("\n    case ", start + 1);
  return nextCase === -1 ? text.slice(start) : text.slice(start, nextCase);
}
