import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const failures = [];

const { AiTurnRuntime } = await importTs("src/core/aiTurnRuntime.ts");
const { ProviderResolver } = await importTs("src/core/aiProviderPolicy.ts");
const { MessageCommitter } = await importTs("src/core/messageCommitter.ts");
const { RenderGate } = await importTs("src/core/renderGate.ts");

await validateRuntimeSingleFlight();
validateProviderResolver();
validateMessageCommitter();
validateRenderGate();
validateSourceIntegration();

if (failures.length) {
  console.error(`AI turn runtime validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("AI turn runtime validation passed.");

async function validateRuntimeSingleFlight() {
  const runtime = new AiTurnRuntime();
  const first = runtime.begin({
    scope: "console:alice",
    area: "console",
    purpose: "console_chat",
    turnId: "turn-1",
  });
  assert(first.ok, "first console turn should begin");
  if (!first.ok) {
    return;
  }

  const duplicate = runtime.begin({
    scope: "console:alice",
    area: "console",
    purpose: "console_chat",
    turnId: "turn-2",
  });
  assert(!duplicate.ok && duplicate.reason === "active_turn", "same scope should block a second active turn");

  const otherScope = runtime.begin({
    scope: "room:one:speaker:bob",
    area: "room",
    purpose: "room_speaker",
    turnId: "turn-3",
  });
  assert(otherScope.ok, "different scope should allow a concurrent room turn");

  const chatRequest = runtime.beginRequest(first.turn, { purpose: "console_chat", requestId: "req-1" });
  assert(chatRequest.ok, "first chat request should be accepted");
  const secondChatRequest = runtime.beginRequest(first.turn, { purpose: "console_chat", requestId: "req-2" });
  assert(!secondChatRequest.ok && secondChatRequest.reason === "duplicate_chat_request", "same turn should block duplicate chat requests");

  runtime.finish(first.turn, { outcome: "success", visibleTerminalCommitted: true });
  const afterFinish = runtime.begin({
    scope: "console:alice",
    area: "console",
    purpose: "console_chat",
    turnId: "turn-4",
  });
  assert(afterFinish.ok, "scope should unlock after finish");

  const submitted = await runtime.submit({
    scope: "console:submit",
    area: "console",
    purpose: "console_chat",
    turnId: "submitted-turn",
    execute: async () => ({ messageId: "m1" }),
    outcome: () => "success",
    visibleTerminalCommitted: (result) => Boolean(result.messageId),
  });
  assert(submitted.ok && submitted.turn.id === "submitted-turn" && submitted.turn.visibleTerminalCommitted, "submit helper should record caller turn ids and visible terminal commits");

  let failureCallbackRan = false;
  try {
    await runtime.submit({
      scope: "console:submit-failure",
      area: "console",
      purpose: "console_chat",
      turnId: "failed-turn",
      execute: async () => {
        throw new Error("provider_failed");
      },
      onFailure: () => {
        failureCallbackRan = true;
      },
      failureVisibleTerminalCommitted: () => true,
      failureBlockReason: () => "provider_failed",
    });
  } catch {
    // Expected failure path.
  }
  const failedTurn = runtime.snapshot().completed.find((turn) => turn.id === "failed-turn");
  assert(failureCallbackRan, "submit helper should expose failure callback before finishing the turn");
  assert(failedTurn?.outcome === "failure" && failedTurn.visibleTerminalCommitted && failedTurn.blockReason === "provider_failed", "submit helper should record visible failure terminal state");
}

function validateProviderResolver() {
  const provider = noopProvider();
  const resolver = new ProviderResolver();
  const order = resolver.resolve({
    purpose: "console_chat",
    scope: "console:test",
    local: {
      id: "local-chat-model",
      provider,
      live: true,
      blockReason: null,
    },
    cloud: {
      id: "cloud-chat",
      provider,
      live: true,
      blockReason: null,
    },
  });
  assert(order.providerIds.join(",") === "local-chat-model,cloud-chat", "local provider should stay before cloud");
  assert(order.liveProviderIds.join(",") === "local-chat-model,cloud-chat", "live provider ids should include local before cloud");
  assert(order.canAttempt, "provider resolution should be attemptable when at least one provider is live");
  assert(order.selectedSourceLabel === "local-chat-model", "selected source should default to the first live provider");

  const blockedLocal = resolver.resolve({
    purpose: "console_chat",
    scope: "console:test",
    local: {
      id: "local-chat-model",
      provider,
      live: false,
      blockReason: "loading",
    },
    cloud: {
      id: "cloud-chat",
      provider,
      live: true,
      blockReason: null,
    },
  });
  assert(blockedLocal.candidates[0]?.id === "local-chat-model" && blockedLocal.candidates[0]?.blockReason === "loading", "blocked local candidate should preserve its reason");
  assert(blockedLocal.candidates[1]?.id === "cloud-chat", "cloud should be the single fallback after blocked local");
  assert(blockedLocal.blockReasons["local-chat-model"] === "loading", "blocked local reason should be exposed by id");
  assert(blockedLocal.liveProviderIds.join(",") === "cloud-chat", "blocked local should leave cloud as the only live fallback");
  assert(blockedLocal.debugSummary.includes("purpose=console_chat"), "provider debug summary should include purpose");
}

function validateMessageCommitter() {
  const committer = new MessageCommitter();
  const committed = committer.commit({ target: "direct_room", messageId: "m1", visible: true });
  assert(committed.ok && committed.visible && committed.target === "direct_room", "direct-room commit should be visible");

  const inspector = committer.visibleError("room_inspector", "model_unavailable");
  assert(!inspector.ok && inspector.visible && inspector.reason === "model_unavailable", "room inspector errors should still be visible terminal states");

  let applied = false;
  const appliedResult = committer.commit({
    target: "room_timeline",
    apply: () => {
      applied = true;
      return { messageId: "room-message", visible: true };
    },
  });
  assert(applied && appliedResult.ok && appliedResult.messageId === "room-message", "committer should execute real apply callbacks");

  let fallbackApplied = false;
  const failedResult = committer.commit({
    target: "room_inspector",
    apply: () => {
      throw new Error("write_failed");
    },
    onCommitFailure: (reason) => {
      fallbackApplied = true;
      return { visible: true, reason };
    },
  });
  assert(fallbackApplied && !failedResult.ok && failedResult.visible && failedResult.reason === "write_failed", "committer should expose visible fallback on apply failure");
}

function validateRenderGate() {
  const gate = new RenderGate();
  const suppressed = gate.request({
    reason: "ai_reply",
    kind: "message",
    hotPathActive: true,
  });
  assert(!suppressed.allow && suppressed.suppressed, "message hot path render should be suppressed");

  const structural = gate.request({
    reason: "character_switch",
    kind: "structural",
    hotPathActive: true,
  });
  assert(structural.allow, "structural renders should bypass hot-path suppression");
}

function validateSourceIntegration() {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  mustInclude(main, "const aiTurnRuntime = new AiTurnRuntime();", "main owns one AI turn runtime");
  mustInclude(main, "aiTurnRuntime.submit({", "console hot path submits through AiTurnRuntime");
  mustInclude(main, "roomRuntime.executeSpeakerTurn<", "room speaker hot path executes through RoomRuntime");
  mustInclude(main, "roomRuntime.executeDirectorTurn<", "director hot path executes through RoomRuntime");
  mustNotInclude(main, "roomRuntime.submitSpeaker({", "main should not call low-level RoomRuntime speaker submit");
  mustNotInclude(main, "roomRuntime.submitDirector({", "main should not call low-level RoomRuntime director submit");
  mustNotInclude(main, "aiTurnRuntime.begin({", "main hot paths must not manually begin turns");
  mustNotInclude(main, "aiTurnRuntime.finish(", "main hot paths must not manually finish turns");
  mustInclude(main, "messageCommitter.commit({", "console commits report through MessageCommitter");
  mustInclude(main, "commitRoomTimelineMessage(", "room timeline commits route through MessageCommitter");
  mustInclude(main, "const providerResolver = new ProviderResolver();", "main owns one ProviderResolver");
  mustInclude(main, "providerResolver.resolve({", "provider resolution goes through ProviderResolver");
  mustInclude(main, "providerResolver.candidate", "provider availability is normalized through ProviderResolver");
  mustInclude(main, "renderGate.request({", "requestRender is routed through RenderGate");
  mustInclude(main, "localDiagnostics.enabled", "provider resolution keeps local enabled state explicit");
  mustInclude(main, "blockReason: localBlockReason", "blocked local provider exposes a reason");
  mustInclude(main, "runtimeTurn?: AiTurnRuntimeTurn | null", "request audit can bind non-console runtime turns");
  mustInclude(main, "createCloudTurnAuditHooks(null, \"room\", runtimeTurn)", "room cloud requests bind to active AI runtime turns");
  mustInclude(main, "resolveRoomTurnProviders", "room speaker provider resolution is shared and ordered");
  mustInclude(main, "aiTurnRuntime.beginRequest(runtimeTurn", "room local/director requests are duplicate-gated");
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

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
