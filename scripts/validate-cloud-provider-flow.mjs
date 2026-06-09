import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const ai = read("src/core/ai.ts");
const aiGateway = read("src/core/aiGateway.ts");
const endpointMachine = read("src/core/aiEndpointStateMachine.ts");
const secretProjection = read("src/core/secretProjection.ts");
const providerPolicy = read("src/core/aiProviderPolicy.ts");
const audit = read("src/core/aiRequestAudit.ts");
const executor = read("src/core/consoleChatExecutor.ts");
const main = read("src/main.ts");
const appState = read("src/core/appState.ts");
const persistence = read("src/core/persistence.ts");
const petConsole = read("src/ui/petConsole.ts");
const commands = read("src/core/commands.ts");
const rust = read("src-tauri/src/lib.rs");
const cargo = read("src-tauri/Cargo.toml");

mustInclude(aiGateway, [
  "cloud_chat_request",
  "cloud_vision_request",
  "cloud_tts_request",
  "cloud_endpoint_test",
  "export class AiGateway",
  "export const tauriAiGateway",
]);

mustInclude(ai, [
  "createCloudHttpRequest",
  "tauriAiGateway.chat",
  "tauriAiGateway.vision",
  "tauriAiGateway.tts",
  "throwIfCloudTransportFailed",
  "canUseTauriCloudBridge",
  'Return only a JSON object: {"text":"character line","emotion":"idle|happy|sad|angry|surprised|curious|calm|thinking"}.',
  "The text field must contain only the character reply, with no labels, metadata, Markdown, or code fences.",
  'requestChatCompletionResult(\n      config,\n      "chat",',
  "signal,\n      true,",
  "canUseTauriCloudBridge() && Boolean(config.secretRef?.trim())",
  "function extractCompletionContent",
  "function describeCompletionResponseShape",
  "The AI service returned an empty or incompatible chat response.",
  "Image understanding ready.",
  "The image understanding service rejected the test image or does not support the current image request format.",
  "supports OpenAI-style chat image_url data URLs",
  "responseShape",
  "stringValue(firstChoice?.text)",
  "stringValue(firstChoice?.delta?.content)",
  "stringValue(payload.output_text)",
  "extractResponsesOutputText(payload.output)",
]);

mustInclude(endpointMachine, [
  "export function resetEndpointAfterConfigChange",
  "export function projectEndpointKey",
  "export function applyEndpointRuntimeStatus",
  "status: \"not_configured\"",
  "runtimeStatus: \"idle\"",
  "hasStoredSecret: Boolean(trimmed)",
]);

mustInclude(secretProjection, [
  "export function applyApiKeyProjection",
  "export const SecretProjection",
  "projectEndpointKey",
]);

mustInclude(providerPolicy, [
  "export function buildAiProviderCascade",
  "input.local",
  "input.cloud",
]);
assertOrder(providerPolicy, "input.local", "input.cloud");

mustInclude(audit, [
  "export class AiRequestAuditLog",
  "export type AiRequestAuditScope",
  "export type AiRequestPurpose",
  "export interface AiRequestAuditEntry",
  "begin(input",
  "finish(",
  "consoleCloudRequestStarted",
  "executorId",
]);

mustInclude(executor, [
  "export class ConsoleChatExecutor",
  "activeQueuedTurn",
  "hasActiveTurn",
  "submit(input",
  "completedDedupeMs",
  "lastFinished?.turnKey === input.turnKey",
  "console-exec-",
  "turn.executorId = executorId",
  "clearIfCurrent",
]);

mustInclude(main, [
  "secretRef: endpoint.secretRef",
  "secretRef: profile.secretRef",
  "consoleTurnEngine",
  "consoleChatExecutor",
  "consoleTurnEngine.activeTurn",
  "const aiRequestAuditLog = new AiRequestAuditLog(20);",
  "createConsoleTurnKey",
  "consoleChatExecutor.submit",
  "isCurrentConsoleTurn",
  "AI.console.duplicate_request_blocked",
  "beginAiRequestAudit",
  "cloudTurnRuntime.run",
  "createCloudTurnAuditHooks",
  "createProviderWithAuditedVision",
  "resolveConsoleTurnProviders",
  "consoleCloudRequestStarted",
  "executorId",
  'scope: "console"',
  'chatPurpose: "console_chat"',
  'visionPurpose: "vision_caption"',
  'scope: "config"',
  'purpose: "config_test"',
  'scope: "room"',
  'purpose: "room_planner"',
  'chatPurpose: "room_speaker"',
  'chatPurpose: "room_director"',
  "visibleTerminalCommitted",
  "commitConsoleTurnSystemMessage",
  "formatLastAiRequestDiagnostics",
  "AI reply ended without a visible result.",
  "markCloudChatRuntimeRequesting",
  "hasUsableCloudSecret",
  "canUseNativeSecretRef",
  "restoreSecretsAndReconcile",
  "canRunForegroundRoomFlow",
  'activeSurface === "room"',
  "consoleState.room.id === consoleState.activeRoomId",
  'consoleTurnEngine.activeTurn?.status !== "pending"',
]);
mustInclude(read("src/core/types.ts"), [
  'export type AiRuntimeStatus = "idle" | "requesting" | "last_success" | "last_error";',
  "runtimeStatus: AiRuntimeStatus;",
  "hasStoredSecret: boolean;",
  "lastRuntimeMessage: string;",
  "lastRuntimeAt: string | null;",
  'type: "ai.setEndpointRuntimeStatus";',
]);
mustInclude(appState, [
  "runtimeStatus: \"idle\"",
  "case \"ai.setEndpointRuntimeStatus\"",
  "endpointWithKeyProjection",
  "const changed = Object.entries(patch).some",
  "if (!action.apiKeyPreview.trim())",
]);
mustInclude(petConsole, [
  "isConsoleTurnPending: boolean;",
  "let submitLocked = false;",
  "props.state.ai.chat.runtimeStatus === \"requesting\"",
  "props.state.ai.chat.hasStoredSecret",
  "Boolean((props.state.ai.chat.apiUrl || props.state.ai.baseUrl).trim())",
  "Boolean((props.state.ai.chat.model || props.state.ai.chatModel).trim())",
]);
mustNotInclude(petConsole, [
  "const submitBlocked = props.activeView !== \"room\" && props.isConsoleTurnPending;",
  "send.disabled = submitBlocked;",
  "if (submitBlocked || submitLocked)",
]);
mustInclude(persistence, [
  "function sanitizeEndpointForPersistence",
  "function sanitizeRestoredEndpoint",
  "hasStoredSecret: Boolean",
  "runtimeStatus: \"idle\"",
]);
mustInclude(commands, [
  "/ai status",
  "/ai test",
  "/ai last",
  "/ai trace",
  "/ai cancel",
  "Show the latest AI request summary",
]);
mustNotInclude(commands, ["/ai setup", "/ai models", "/room", "/pack", "/voice"]);

mustInclude(rust, [
  "cloud_chat_request",
  "cloud_vision_request",
  "cloud_tts_request",
  "cloud_endpoint_test",
  "read_cloud_secret",
  "write_secret",
  "read_secret(app, &safe_name)",
  "LegacyPlain",
]);

mustInclude(cargo, ["reqwest", "rustls-tls", "base64"]);

mustNotInclude(ai, [
  'request: createCloudHttpRequest(config, endpoint, { apiKey',
  "apiKey: config.apiKey",
  "Reply only as the current character. Return valid JSON and choose an appropriate emotion.",
  "const fallback = await fetch(endpoint",
  "throw response.transportError",
  'content: \'Return only this JSON object: {"text":"ok","emotion":"idle"}.\'',
  "Local chat remains available if the bundled model is ready.",
]);
mustInclude(rust, [
  "The AI service response timed out.",
  "Could not connect to the AI service.",
]);
mustNotInclude(main, [
  "CONSOLE_TURN_VISIBLE_TIMEOUT_MS",
  "function runOneOnOneTurnWithVisibleTimeout",
  "markCloudChatRuntimeFailure(turn.error);\n      const localPrompt",
  "Generating reply",
  "cloudRequestStarted: boolean;",
  'type: "ai.setConnectionResult",\n      status: "not_configured"',
]);
mustInclude(main, [
  'use === "vision" ? "vision" : "chat"',
]);
mustNotInclude(petConsole, [
  'commitOn: "change"',
]);
mustNotInclude(functionBlock(persistence, "sanitizeEndpointForPersistence"), [
  'status: "not_configured",\n    runtimeStatus: "idle"',
  'status: "not_configured",\r\n    runtimeStatus: "idle"',
  "lastTestMessage: \"Settings saved locally. Your API Key is kept out of regular app data.\"",
]);
mustNotInclude(functionBlock(persistence, "sanitizeRestoredEndpoint"), [
  'status: "not_configured",\n    runtimeStatus: "idle"',
  'status: "not_configured",\r\n    runtimeStatus: "idle"',
  "lastTestMessage: \"Local settings were restored. Your API Key is loaded separately from secure storage.\"",
]);

if (failures.length) {
  console.error("Cloud provider flow validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Cloud provider flow validation passed.");

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
