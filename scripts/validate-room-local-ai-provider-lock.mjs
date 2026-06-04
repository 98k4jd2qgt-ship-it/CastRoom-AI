import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

function fail(message) {
  failures.push(message);
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    fail(`missing ${label}: ${marker}`);
  }
}

function sliceFunction(name) {
  const start = Math.max(main.indexOf(`function ${name}`), main.indexOf(`async function ${name}`));
  if (start < 0) {
    fail(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nasync function "]
    .map((marker) => main.indexOf(marker, start + 1))
    .filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next < 0 ? main.slice(start) : main.slice(start, next);
}

const resolveRoomTurnProviders = sliceFunction("resolveRoomTurnProviders");
mustInclude(resolveRoomTurnProviders, "if (localDiagnostics.enabled) {", "Room local-lock branch");
mustInclude(resolveRoomTurnProviders, "cloud: null", "Room provider resolver excludes cloud while local chat is enabled");
mustInclude(resolveRoomTurnProviders, "local_lock=enabled", "Room provider diagnostics record local lock");
mustInclude(resolveRoomTurnProviders, "return resolution.candidates as RoomProviderSelection[]", "Room local-lock branch returns immediately");

const roomDefaultApi = sliceFunction("resolveRoomDefaultApi");
mustInclude(
  roomDefaultApi,
  "if (localAiRuntime.diagnostics().enabled) {\n    return localRoomApiResult(localChatModelRoomApiStatus());\n  }",
  "Room default API locks to local status whenever local chat is enabled",
);

const directorApi = sliceFunction("resolveDirectorApiProfile");
mustInclude(
  directorApi,
  "if (localAiRuntime.diagnostics().enabled) {\n    return localRoomApiResult(localChatModelRoomApiStatus());\n  }",
  "Director API locks to local status whenever local chat is enabled",
);

const fallbackRoomApi = sliceFunction("fallbackRoomApi");
mustInclude(
  fallbackRoomApi,
  "if (localAiRuntime.diagnostics().enabled) {\n    return localRoomApiResult(localChatModelRoomApiStatus());\n  }",
  "Room fallback API does not jump to cloud while local chat is enabled",
);

const createLiveDirectorTurnPlan = sliceFunction("createLiveDirectorTurnPlan");
mustInclude(
  createLiveDirectorTurnPlan,
  "cloud fallback is locked while local chat is on",
  "Director live plan refuses cloud fallback while local chat is enabled but unavailable",
);
mustInclude(createLiveDirectorTurnPlan, "if (localEnabled && !localReady) {", "Director checks local lock before cloud path");
mustInclude(createLiveDirectorTurnPlan, "return null;", "Director local-unavailable branch stops instead of falling through to cloud");

if (failures.length > 0) {
  console.error(`Room local AI provider lock validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room local AI provider lock validation passed.");
