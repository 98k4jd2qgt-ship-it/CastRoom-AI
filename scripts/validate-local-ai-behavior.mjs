import fs from "node:fs";

const failures = [];
const ai = fs.readFileSync("src/core/ai.ts", "utf8");
const appState = fs.readFileSync("src/core/appState.ts", "utf8");
const types = fs.readFileSync("src/core/types.ts", "utf8");
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const rust = fs.readFileSync("src-tauri/src/lib.rs", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const localRuntime = fs.readFileSync("src/core/localAiRuntime.ts", "utf8");

mustInclude(ai, "buildLocalPromptAdapter", "local prompt adapter");
mustInclude(ai, "buildLocalModelSystemPrompt", "local system prompt builder");
mustInclude(ai, "buildLocalModelRetrySystemPrompt", "local retry prompt builder");
mustInclude(ai, "extractTextFieldFromLooseJson", "loose JSON text extraction");
mustInclude(ai, "isGenericLocalModelRefusalSafe", "generic refusal rejection");
mustInclude(ai, "isLocalModelPromptLeakRawSafe", "raw prompt leak rejection");
mustInclude(ai, "isLocalModelSafetyEchoLine", "safety echo stripping");
mustInclude(ai, "escapedName +", "speaker identity echo stripping");
mustInclude(ai, "Local chat model returned an unusable reply.", "safe local failure message");
mustInclude(ai, "Try again, or turn off Local chat model in Config and use a cloud chat model.", "safe local failure next step");
mustInclude(ai, "继续。", "clean Chinese fallback prompt");

const localPromptBlock = sliceBetween(ai, "function buildLocalModelSystemPrompt", "function buildLocalModelRetrySystemPrompt");
mustNotInclude(localPromptBlock, "Return valid JSON", "local model JSON instruction");
mustNotInclude(localPromptBlock, "plain text or compact JSON", "local model JSON fallback instruction");
mustInclude(localPromptBlock, "Output only the character line", "plain-text local output instruction");
mustInclude(localPromptBlock, "\\u53ea\\u8f93\\u51fa\\u89d2\\u8272\\u53f0\\u8bcd", "Chinese plain-text local output instruction");

mustInclude(rust, "removes_thinking_and_prompt_echo_lines", "Rust local output cleanup test");
mustInclude(rust, "removes_chinese_prompt_labels", "Rust Chinese prompt label cleanup test");
mustInclude(rust, "removes_rule_echo_and_keeps_final_reply", "Rust rule echo cleanup test");
mustInclude(rust, "strips_llama_chat_template_echo", "Rust chat template echo cleanup test");
mustInclude(rust, "[Start thinking]", "thinking marker cleanup fixture");
mustInclude(rust, "Do not pretend you can run system commands", "safety rule cleanup fixture");

mustInclude(
  appState,
  "action.state.enabled !== state.ai.localChatModel.enabled",
  "stale local model refresh guard",
);
mustInclude(
  appState,
  'runtimeState === "starting_server"',
  "local model install state treats server startup as installed",
);
mustInclude(
  appState,
  "localModelInstallState(modelId ?? null, availableModels, state)",
  "local model install state uses preserved model id",
);
mustInclude(
  petConsole,
  "props.state.ai.chat.status === \"ready\"",
  "cloud status display when local chat is off",
);
const characterAiStatusBlock = sliceBetween(petConsole, "function resolveCharacterAiStatus", "function characterStatusRow");
mustInclude(characterAiStatusBlock, "if (local.enabled)", "character status honors enabled local model before cloud status");
mustInclude(characterAiStatusBlock, 'local.state === "starting_server"', "character status shows local loading before cloud status");
mustInclude(characterAiStatusBlock, 'local.state === "loading_model"', "character status shows local model loading before cloud status");
mustInclude(characterAiStatusBlock, 'local.state === "missing_model"', "character status shows local model problems before cloud status");
mustInclude(characterAiStatusBlock, 'return { value: t(language, "statusLocal"), tone: "ok" };', "character status displays local when local is selected and usable");
mustInclude(localRuntime, "export class LocalAiRuntime", "local AI runtime layer");
mustInclude(localRuntime, "resolveAvailability", "local availability resolver");
mustInclude(localRuntime, "diagnostics()", "local diagnostics resolver");
mustInclude(localRuntime, "local_model_get_state", "local runtime owns get_state");
mustInclude(localRuntime, "local_model_verify", "local runtime owns verify");
mustInclude(localRuntime, "local_model_warmup", "local runtime owns warmup");
mustInclude(localRuntime, "LocalAiTimeoutError", "local runtime bounded readiness timeout");
mustInclude(localRuntime, "The app will try another provider if one is available.", "local timeout does not block cloud fallback");
mustInclude(localRuntime, 'state.state === "missing_runner"', "local runtime classifies missing server/runner distinctly");
mustInclude(localRuntime, "runtimeMode", "local diagnostics expose server versus legacy runtime mode");
mustInclude(localRuntime, 'state.state === "stopped"', "stopped local server is treated as available without loading");
mustInclude(types, '"stopped"', "local model stopped state");
mustInclude(appState, 'runtimeState === "stopped"', "stopped local runtime still counts as installed");
mustInclude(main, "const localAiRuntime = new LocalAiRuntime", "main wires local AI runtime");
mustInclude(main, 'await refreshLocalAiAvailability("console_chat")', "console local availability before provider selection");
mustInclude(main, 'await refreshLocalAiAvailability("room_speaker")', "room speaker local availability before provider selection");
mustInclude(main, 'await refreshLocalAiAvailability("room_director")', "director local availability before provider selection");
mustInclude(main, "local_lock=enabled", "Room provider resolution records local-only lock");
mustInclude(main, "cloud: null", "Room speaker provider resolver excludes cloud while local chat is enabled");
mustInclude(main, "cloud fallback is locked while local chat is on", "Director local lock blocks cloud fallback");
mustInclude(main, "localAiRuntime.diagnostics()", "AI status reads local runtime diagnostics");
mustInclude(main, "localSelectedModelId", "AI status includes selected local model");
mustInclude(main, "localRunnerReady", "AI status includes local runner readiness");
mustInclude(main, "localRuntimeMode", "AI status includes local runtime mode");
mustInclude(main, "localServerPort", "AI status includes local server port");
mustInclude(main, "localServerHealth", "AI status includes local server health");
mustInclude(main, "localLastError", "AI status includes local error reason");
mustInclude(main, 'action.type === "localModel.freeMemory"', "Config can free local runtime memory");
mustInclude(main, "const LOCAL_MODEL_IDLE_RELEASE_MS = 120_000", "local runtime auto-release idle timeout");
mustInclude(main, "scheduleLocalModelIdleRelease", "local runtime schedules idle memory release after use");
mustInclude(main, "releaseLocalModelIfIdle", "local runtime releases memory when idle");
mustInclude(main, "function shouldAvoidFullRender(", "console chat suppresses full render during AI turn");
mustInclude(main, "renderUnlessConsoleChatHotPath", "local model status updates use render gate");
mustInclude(main, 'renderUnlessConsoleChatHotPath("local_model_running")', "local model running state does not force full chat rerender");
mustInclude(main, "refreshLocalChatModelState({ render: !shouldAvoidFullRender() })", "local model final refresh avoids full chat rerender");
mustInclude(main, "suppressedFullRenderCount", "suppressed full renders are visible in debug state");
mustInclude(main, "if (result.ready) {\n    scheduleLocalModelIdleRelease();", "local readiness also arms idle memory release");
mustInclude(main, 'void stopLocalModelRuntime("disabled")', "turning local chat off stops local runtime");
mustInclude(petConsole, 'type: "localModel.freeMemory"', "Local model Config card exposes free memory action");
mustInclude(copy, "localModelFreeMemory: \"Free memory\"", "English local memory release label");
mustInclude(copy, "localModelFreeMemory: \"释放内存\"", "Chinese local memory release label");
mustInclude(copy, "Stops the current local AI runtime", "local memory release explanation");
mustInclude(copy, "2 分钟内未使用本地回复", "Chinese local auto-release explanation");
mustNotInclude(copy, "Unload local model", "misleading unload local model copy");
mustInclude(rust, "struct LocalModelServerProcess", "Rust owns persistent local server process state");
mustInclude(rust, "llama-server.exe", "Rust prefers llama.cpp server runner");
mustInclude(rust, ".arg(\"-t\")", "Rust limits local server CPU threads");
mustInclude(rust, "local_model_thread_count(&bundle.manifest).to_string()", "Rust applies manifest thread cap to local server");
mustInclude(rust, ".arg(\"-c\")", "Rust limits local server context size");
mustInclude(rust, "local_model_context_tokens(&bundle.manifest).to_string()", "Rust applies local server context cap");
mustInclude(rust, "manifest.context_tokens.clamp(512, 2048)", "Rust caps local context to reduce CPU and memory pressure");
mustInclude(rust, "/v1/chat/completions", "Rust local chat uses OpenAI-compatible local server endpoint");
mustInclude(rust, "/health", "Rust local readiness checks local server health");
mustInclude(rust, "tauri::WindowEvent::CloseRequested", "window close stops local model server");
mustInclude(rust, "tauri::RunEvent::ExitRequested", "app exit stops local model server");
mustInclude(rust, '"stopped".to_string()', "Rust reports stopped local server state");
mustInclude(rust, "local_model_cli_chat_blocking", "Rust keeps legacy CLI fallback for short-term compatibility");
mustInclude(rust, "LOCAL_MODEL_GENERATION_LOCK", "Rust serializes local generation requests");
mustNotInclude(main, "function ensureLocalChatReadiness", "old scattered local readiness helper");
mustNotInclude(main, "function invokeLocalReadinessCommand", "old scattered local readiness command wrapper");

const verifyBlock = sliceBetween(rust, "fn local_model_verify", "#[tauri::command]\nfn local_model_warmup");
mustNotInclude(verifyBlock, "ensure_local_model_server_ready", "local verify must not start llama-server");

if (failures.length > 0) {
  console.error(`Local AI behavior validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Local AI behavior validation passed");

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

function sliceBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) {
    failures.push(`cannot find source range ${startMarker} -> ${endMarker}`);
    return "";
  }
  return text.slice(start, end);
}
