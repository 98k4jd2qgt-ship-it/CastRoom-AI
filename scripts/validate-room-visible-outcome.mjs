import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const localRuntime = fs.readFileSync("src/core/localAiRuntime.ts", "utf8");
const failures = [];

mustInclude('await refreshLocalAiAvailability("room_speaker")', "room speaker refreshes local availability");
mustInclude('await refreshLocalAiAvailability("room_director")', "room director refreshes local availability");
mustInclude("LOCAL_READINESS_TIMEOUT_MS", "local readiness cannot block room turns indefinitely");
mustIncludeIn(localRuntime, "export class LocalAiRuntime", "room local readiness uses LocalAiRuntime");
mustIncludeIn(localRuntime, "LocalAiTimeoutError", "room local readiness uses bounded local model calls");
mustInclude('return localRoomApiResult(localChatModelRoomApiStatus());', "room default API resolves the real local model status");
mustInclude('live: status === "ready" && shouldAttemptLocalChatModel()', "local room API is live when local model is ready");
mustInclude(
  "Director local chat model is unavailable and cloud fallback is locked while local chat is on",
  "director local AI unavailable state is visible and does not fall through to cloud",
);
mustInclude("const localEnabled = localDiagnostics.enabled", "director checks whether local chat is enabled");
mustInclude("const localReady = shouldAttemptLocalChatModel()", "director checks local readiness separately from the local enable switch");
mustInclude("if (localEnabled && !localReady)", "director blocks cloud fallback while local chat is enabled but unavailable");
mustInclude("const directorConfig = !localReady && directorApi.live", "director can use cloud only when local chat is off");
mustInclude("buildLocalDirectorSpeechPrompt(request, localPlan)", "local director uses compact speech prompt instead of cloud JSON planner prompt");
mustInclude("applyLocalDirectorSpeechToPlan(turn.result.text, localPlan)", "local director applies text to publicText instead of parsing JSON");
mustInclude("if (localReady) {\n    return applyLocalDirectorSpeechToPlan", "local director returns before JSON plan parsing only when local is ready");
mustInclude("Do not output JSON", "local director prompt explicitly avoids JSON output");
mustInclude("Director AI replied through the local chat model.", "director local AI success is visible");
mustInclude("Director AI failed:", "director AI failure is visible");
mustInclude("Director AI replied, but the plan format was not usable.", "director AI parse fallback is visible");
mustInclude('terminationReason: "model_unavailable"', "room provider failure writes model unavailable termination");
mustInclude('lastReason: "api_unavailable"', "room provider failure writes api unavailable reason");
mustInclude("Room.ai.provider_blocked", "room provider unavailable diagnostic is recorded");
mustInclude("currentFocus: lastProviderError", "room provider failure writes visible focus");
mustInclude("stopReason: \"model_unavailable\"", "room provider failure writes simulation stop reason");
mustInclude("localChatModelRoomApiMessage()", "room local unavailable focus uses local diagnostics");
mustInclude("localAvailability: localReadiness.availability", "room provider diagnostics include local readiness");
mustInclude("resolveRoomTurnProviders", "room provider resolution returns policy-owned candidates");
mustInclude("local_lock=enabled", "room provider resolution records local-only lock");
mustInclude("cloud: null", "room provider resolver excludes cloud while local chat is enabled");
mustInclude("providerSelections = resolveRoomTurnProviders", "room provider turn uses shared provider candidates");
mustInclude("message.speaker !== participant.name", "local room prompt excludes the speaker's own recent replies");
mustInclude("Room topic is background only", "local room prompt treats topic as background instead of identity");
mustInclude("\\u623f\\u95f4\\u8bdd\\u9898\\u53ea\\u662f\\u80cc\\u666f", "Chinese local room prompt treats topic as background");
mustInclude("Do not repeat the user's exact words", "local room prompt discourages exact user echo");
mustInclude('await refreshLocalAiAvailability("room_speaker");\n    const status = localChatModelRoomApiStatus();', "room API test refreshes local readiness before reporting status");
mustInclude('await refreshLocalAiAvailability("room_director");\n    const status = localChatModelRoomApiStatus();', "director API test refreshes local readiness before reporting status");
mustInclude("requestConversationInputFocus(\"room\");\n    requestRender(\"room_provider_unavailable\"", "room stop/no participant branch requests a visible terminal update");

const roomDefaultApi = sliceBetween("function resolveRoomDefaultApi()", "function resolveDirectorApiProfile()");
mustAppearBefore(
  roomDefaultApi,
  "if (localAiRuntime.diagnostics().enabled)",
  'if (roomApi.mode === "custom_room")',
  "room default API locks enabled local model before room/cloud API",
);
mustAppearBefore(
  roomDefaultApi,
  "if (localAiRuntime.diagnostics().enabled)",
  "if (canAttemptGlobalCloudChat())",
  "room default API keeps enabled local model above global cloud",
);

const fallbackRoomApi = sliceBetween("function fallbackRoomApi", "function resolveGlobalGenerationSettings");
mustAppearBefore(
  fallbackRoomApi,
  "if (localAiRuntime.diagnostics().enabled)",
  "if (canAttemptGlobalCloudChat())",
  "room fallback keeps enabled local model above global cloud",
);

const localStatus = sliceBetween("function localChatModelRoomApiStatus()", "function setRoomRoleApiStatus");
mustIncludeIn(localStatus, 'diagnostics.availability === "missing_model"', "local room status treats missing model as local error, not missing key");
mustIncludeIn(localStatus, 'diagnostics.availability === "checking"', "local room status treats checking as local error, not missing key");

if (failures.length > 0) {
  console.error(`Room visible outcome validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room visible outcome validation passed");

function mustInclude(marker, label) {
  if (!main.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}

function mustIncludeIn(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}

function mustAppearBefore(text, first, second, label) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex > secondIndex) {
    failures.push(`order failed ${label}: expected ${first} before ${second}`);
  }
}

function sliceBetween(startMarker, endMarker) {
  const start = main.indexOf(startMarker);
  const end = main.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    failures.push(`could not slice ${startMarker} -> ${endMarker}`);
    return "";
  }
  return main.slice(start, end);
}
