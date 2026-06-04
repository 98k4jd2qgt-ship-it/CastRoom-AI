import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const failures = [];
const { ProviderResolver } = await importTs("src/core/aiProviderPolicy.ts");

const provider = noopProvider();

validateLocalPriority();
validateCloudFallback();
validateUnavailableResolution();
validateSourceMetadata();
validateCandidateNormalization();

if (failures.length) {
  console.error(`Provider resolver behavior validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Provider resolver behavior validation passed.");

function validateLocalPriority() {
  const resolution = new ProviderResolver().resolve({
    purpose: "console_chat",
    scope: "console:pack",
    localEnabled: true,
    local: {
      id: "local-chat-model",
      provider,
      live: true,
      sourceLabel: "Local chat model",
    },
    cloud: {
      id: "cloud-chat",
      provider,
      live: true,
      sourceLabel: "Global Chat model",
    },
  });
  assert(resolution.providerIds.join(",") === "local-chat-model,cloud-chat", "local ready provider must be ordered before cloud");
  assert(resolution.liveProviderIds.join(",") === "local-chat-model,cloud-chat", "live provider order must preserve local priority");
  assert(resolution.selectedSourceLabel === "Local chat model", "selected source should be local when local is live");
  assert(resolution.canAttempt, "resolution with live local must be attemptable");
}

function validateCloudFallback() {
  const resolution = new ProviderResolver().resolve({
    purpose: "room_speaker",
    scope: "room:one:role:a",
    localEnabled: true,
    local: {
      id: "local-chat-model",
      provider,
      live: false,
      blockReason: "Local model is loading.",
      sourceLabel: "Local chat model",
    },
    cloud: {
      id: "cloud-chat",
      provider,
      live: true,
      sourceLabel: "Room API",
    },
  });
  assert(resolution.providerIds.join(",") === "local-chat-model,cloud-chat", "blocked local must stay visible before cloud fallback");
  assert(resolution.liveProviderIds.join(",") === "cloud-chat", "cloud should be the only live fallback when local is blocked");
  assert(resolution.blockReasons["local-chat-model"] === "Local model is loading.", "local block reason should be preserved");
  assert(resolution.selectedSourceLabel === "Room API", "selected source should move to cloud fallback");
}

function validateUnavailableResolution() {
  const resolution = new ProviderResolver().resolve({
    purpose: "room_director",
    scope: "room:one:director",
    localEnabled: false,
    cloud: {
      id: "cloud-chat",
      provider,
      live: false,
      blockReason: "Director API key is missing.",
      sourceLabel: "Director API",
    },
  });
  assert(!resolution.canAttempt, "resolution without live providers must not be attemptable");
  assert(resolution.liveProviderIds.length === 0, "unavailable resolution should expose no live providers");
  assert(resolution.blockReasons["cloud-chat"] === "Director API key is missing.", "cloud block reason should be preserved");
}

function validateSourceMetadata() {
  const resolution = new ProviderResolver().resolve({
    purpose: "console_chat",
    scope: "console:pack",
    cloud: {
      id: "cloud-chat",
      provider,
      live: true,
      sourceLabel: "Global Chat model",
    },
  });
  assert(resolution.debugSummary.includes("purpose=console_chat"), "debug summary should include purpose");
  assert(resolution.debugSummary.includes("scope=console:pack"), "debug summary should include scope");
  assert(resolution.debugSummary.includes("providers=cloud-chat"), "debug summary should include provider ids");
}

function validateCandidateNormalization() {
  const resolver = new ProviderResolver();
  const disabled = resolver.candidate({
    id: "local-chat-model",
    provider,
    enabled: false,
    ready: true,
  });
  assert(disabled === null, "disabled local provider should be omitted before resolution");

  const loading = resolver.candidate({
    id: "local-chat-model",
    provider,
    enabled: true,
    ready: false,
    unavailableReason: "Local model is loading.",
    sourceLabel: "Local chat model",
  });
  assert(loading?.live === false, "not-ready provider should normalize to non-live");
  assert(loading?.blockReason === "Local model is loading.", "not-ready provider should expose unavailable reason");

  const ready = resolver.candidate({
    id: "cloud-chat",
    provider,
    ready: true,
    sourceLabel: "Cloud",
  });
  assert(ready?.live === true && ready.blockReason == null, "ready provider should normalize to live without block reason");
}

function noopProvider() {
  return {
    chat: async () => ({ provider: "test", text: "ok", emotion: "idle", usedContext: [] }),
    vision: async () => ({ provider: "test", text: "ok", emotion: "idle", usedContext: [] }),
    embed: async () => [],
  };
}

async function importTs(relativePath) {
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

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
