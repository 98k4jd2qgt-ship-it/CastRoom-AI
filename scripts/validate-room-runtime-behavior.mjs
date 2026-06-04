import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const failures = [];

const { AiTurnRuntime, RoomRuntime } = await importRuntimeModules();

await validateSpeakerSingleFlight();
await validateSpeakerFailureTerminalState();
await validateDirectorScope();
await validateInputAndScheduleGuards();
await validateSemanticInputAndEffectFields();
await validateHandlerSeams();
await validateRuntimeCommitterAdapters();
validateSourceIntegration();

if (failures.length) {
  console.error(`Room runtime behavior validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room runtime behavior validation passed.");

async function validateSpeakerSingleFlight() {
  const aiTurnRuntime = new AiTurnRuntime();
  const roomRuntime = new RoomRuntime(aiTurnRuntime);
  const hold = roomRuntime.executeSpeakerTurn({
    roomId: "room-a",
    roleId: "role-a",
    turnId: "speaker-held",
    execute: async () => new Promise(() => {}),
  });
  await Promise.resolve();

  const duplicate = await roomRuntime.executeSpeakerTurn({
    roomId: "room-a",
    roleId: "role-a",
    turnId: "speaker-duplicate",
    execute: async () => "should-not-run",
  });
  assert(!duplicate.ok && duplicate.reason === "active_room_runtime", "same room speaker scope should single-flight active turns");
  assert(aiTurnRuntime.getActive("room:room-a:speaker:role-a")?.id === "speaker-held", "speaker active turn should stay registered");

  // Keep the held promise referenced so the test reflects a real pending turn without awaiting forever.
  void hold;
}

async function validateSpeakerFailureTerminalState() {
  const aiTurnRuntime = new AiTurnRuntime();
  const roomRuntime = new RoomRuntime(aiTurnRuntime);
  let failureCallbackRan = false;
  const runtimeResult = await roomRuntime.executeSpeakerTurn({
    roomId: "room-b",
    roleId: "role-b",
    turnId: "speaker-failure",
    execute: async () => {
      throw new Error("provider_failed");
    },
    onFailure: () => {
      failureCallbackRan = true;
    },
    failureVisibleTerminalCommitted: () => true,
    failureBlockReason: () => "room_speaker_failed",
  });
  const completed = aiTurnRuntime.snapshot().completed.find((turn) => turn.id === "speaker-failure");
  assert(!runtimeResult.ok && runtimeResult.reason === "failed", "room speaker runtime should convert provider exceptions into failed runtime results");
  assert(failureCallbackRan, "room speaker failure should run the runtime failure callback");
  assert(completed?.outcome === "failure", "failed room speaker turn should be recorded as failure");
  assert(completed?.visibleTerminalCommitted === true, "failed room speaker turn should still have a visible terminal state");
  assert(completed?.blockReason === "room_speaker_failed", "failed room speaker turn should keep inspector block reason");
}

async function validateDirectorScope() {
  const aiTurnRuntime = new AiTurnRuntime();
  const roomRuntime = new RoomRuntime(aiTurnRuntime);
  const speaker = await roomRuntime.executeSpeakerTurn({
    roomId: "room-c",
    roleId: "role-c",
    turnId: "speaker-success",
    execute: async () => ({ visible: true }),
    visibleTerminalCommitted: (result) => result.visible,
  });
  const director = await roomRuntime.executeDirectorTurn({
    roomId: "room-c",
    turnId: "director-success",
    execute: async () => ({ visible: true }),
    visibleTerminalCommitted: (result) => result.visible,
  });
  assert(speaker.ok && director.ok, "speaker and director turns should complete through their own scopes");
  const completed = aiTurnRuntime.snapshot().completed;
  assert(completed.some((turn) => turn.id === "speaker-success" && turn.scope === "room:room-c:speaker:role-c"), "speaker turn should use room speaker scope");
  assert(completed.some((turn) => turn.id === "director-success" && turn.scope === "room:room-c:director"), "director turn should use room director scope");
}

async function validateInputAndScheduleGuards() {
  const aiTurnRuntime = new AiTurnRuntime();
  const roomRuntime = new RoomRuntime(aiTurnRuntime);
  const holdInput = roomRuntime.submit({
    roomId: "room-d",
    source: "user",
    operationId: "input-held",
    execute: async () => new Promise(() => {}),
  });
  await Promise.resolve();
  const duplicateInput = await roomRuntime.submit({
    roomId: "room-d",
    source: "user",
    operationId: "input-duplicate",
    execute: async () => "should-not-run",
  });
  assert(!duplicateInput.ok && duplicateInput.reason === "active_room_runtime", "same room input operation should be single-flight");

  const schedule = await roomRuntime.applyScheduleResult({
    roomId: "room-e",
    source: "auto",
    operationId: "schedule-ok",
    execute: async () => "scheduled",
    effect: { renderKind: "none", nextTimerAction: "sync" },
  });
  assert(schedule.ok && schedule.result === "scheduled", "room schedule operation should return the schedule result");
  assert(schedule.ok && schedule.effect.nextTimerAction === "sync", "room schedule operation should carry UI effects");

  void holdInput;
}

async function validateSemanticInputAndEffectFields() {
  const aiTurnRuntime = new AiTurnRuntime();
  const diagnostics = [];
  const roomRuntime = new RoomRuntime({
    aiTurnRuntime,
    diagnostics: (diagnostic) => diagnostics.push(diagnostic),
  });

  const input = await roomRuntime.submitRoomInput({
    roomId: "room-semantic",
    source: "user",
    inputPreview: "hello",
    inputText: "hello",
    execute: async () => "accepted",
    effect: {
      renderKind: "message",
      focusTarget: "room",
      nextTimerAction: "sync",
      timelineMessages: [{ id: "user-message" }],
      inspectorPatch: { currentFocus: "accepted" },
    },
  });

  assert(input.ok && input.result === "accepted", "semantic room input should execute accepted input");
  assert(input.ok && input.renderKind === "message", "RoomRuntime result should expose flattened renderKind");
  assert(input.ok && input.focusTarget === "room", "RoomRuntime result should expose flattened focus target");
  assert(input.ok && input.nextTimerAction === "sync", "RoomRuntime result should expose flattened timer action");
  assert(input.ok && input.timelineMessages?.length === 1, "RoomRuntime result should expose flattened timeline messages");
  assert(input.ok && input.inspectorPatch?.currentFocus === "accepted", "RoomRuntime result should expose flattened Inspector patch");

  const schedule = await roomRuntime.applyScheduleResult({
    roomId: "room-semantic",
    source: "scheduler",
    scheduleType: "speaker",
    scheduleResult: { type: "turn" },
    execute: async () => "scheduled",
    effect: { renderKind: "none" },
  });
  assert(schedule.ok && schedule.renderKind === "none", "RoomRuntime schedule result should expose flattened render kind");
  assert(
    diagnostics.some((diagnostic) => diagnostic.event === "RoomRuntime.input" && diagnostic.detail?.inputPreview === "hello"),
    "RoomRuntime should emit semantic input diagnostics without requiring main.ts to inspect internals",
  );
  assert(
    diagnostics.some((diagnostic) => diagnostic.event === "RoomRuntime.schedule" && diagnostic.detail?.scheduleType === "speaker"),
    "RoomRuntime should emit schedule type diagnostics for schedule application",
  );
}

async function validateHandlerSeams() {
  const aiTurnRuntime = new AiTurnRuntime();
  const handled = [];
  const roomRuntime = new RoomRuntime({
    aiTurnRuntime,
    roomInputHandler: async (input) => {
      handled.push(`input:${input.inputText}`);
      return "input-ok";
    },
    scheduleResultHandler: async (input) => {
      handled.push(`schedule:${input.scheduleType}`);
      return "schedule-ok";
    },
    speakerTurnHandler: async (input, turn) => {
      handled.push(`speaker:${input.roleId}:${turn.purpose}`);
      return { text: "speaker-ok" };
    },
    directorTurnHandler: async (input, turn) => {
      handled.push(`director:${input.roomId}:${turn.purpose}`);
      return { visible: true };
    },
  });

  const input = await roomRuntime.submitRoomInput({
    roomId: "room-handler",
    source: "user",
    inputPreview: "hello",
    inputText: "hello",
  });
  const schedule = await roomRuntime.applyScheduleResult({
    roomId: "room-handler",
    source: "scheduler",
    scheduleType: "speaker",
    scheduleResult: { type: "turn" },
  });
  const speaker = await roomRuntime.executeSpeakerTurn({
    roomId: "room-handler",
    roleId: "role-handler",
    turnId: "speaker-handler",
    scheduleResult: { type: "turn" },
    userInput: "hello",
  });
  const director = await roomRuntime.executeDirectorTurn({
    roomId: "room-handler",
    turnId: "director-handler",
    directorRequest: { reason: "test" },
    visibleTerminalCommitted: (result) => result.visible,
  });

  assert(input.ok && input.result === "input-ok", "RoomRuntime should execute roomInputHandler when no input execute closure is provided");
  assert(schedule.ok && schedule.result === "schedule-ok", "RoomRuntime should execute scheduleResultHandler when no schedule execute closure is provided");
  assert(speaker.ok && speaker.result.ok && speaker.result.result.text === "speaker-ok", "RoomRuntime should execute speakerTurnHandler when no speaker execute closure is provided");
  assert(director.ok && director.result.ok && director.result.result.visible, "RoomRuntime should execute directorTurnHandler when no director execute closure is provided");
  assert(
    handled.join(",") === "input:hello,schedule:speaker,speaker:role-handler:room_speaker,director:room-handler:room_director",
    "RoomRuntime handler seams should receive semantic payloads and runtime turns",
  );
}

async function validateRuntimeCommitterAdapters() {
  const aiTurnRuntime = new AiTurnRuntime();
  const writes = [];
  const roomRuntime = new RoomRuntime(aiTurnRuntime, {
    commit: (input) => {
      writes.push(input.target);
      const applied = input.apply?.();
      return {
        ok: Boolean(applied?.messageId || applied?.visible || input.visible),
        target: input.target,
        messageId: applied?.messageId ?? input.messageId,
        visible: applied?.visible ?? input.visible ?? Boolean(applied?.messageId),
        reason: applied?.reason ?? input.reason,
      };
    },
  });

  const timeline = roomRuntime.commitTimelineMessage({
    messageId: "room-message-1",
    reason: "room_speaker_message",
    apply: () => ({ messageId: "room-message-1", visible: true }),
  });
  assert(timeline.ok && timeline.target === "room_timeline" && timeline.visible, "RoomRuntime should commit timeline messages through its committer adapter");

  const inspector = roomRuntime.commitInspectorPatch({
    reason: "room_provider_failed",
    patch: { currentFocus: "provider failed", stopReason: "model_unavailable" },
    apply: () => ({ visible: true, reason: "room_provider_failed" }),
  });
  assert(inspector.ok && inspector.target === "room_inspector" && inspector.visible, "RoomRuntime should commit Inspector patches through its committer adapter");
  assert(writes.join(",") === "room_timeline,room_inspector", "RoomRuntime committer adapter should receive timeline then Inspector writes");
}

function validateSourceIntegration() {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  const roomRuntime = fs.readFileSync(path.join(root, "src/core/roomRuntime.ts"), "utf8");
  mustInclude(roomRuntime, "export interface RoomRuntimeDeps", "RoomRuntime dependency API");
  mustInclude(roomRuntime, "export interface RoomRuntimeResultEffectFields", "RoomRuntime flattened result effect API");
  mustInclude(roomRuntime, "export interface RoomRuntimeRoomInput", "RoomRuntime semantic input API");
  mustInclude(roomRuntime, "submit<T>(input: RoomRuntimeSubmitInput<T>)", "RoomRuntime input submit API");
  mustInclude(roomRuntime, "submitRoomInput<T>", "RoomRuntime semantic room input API");
  mustInclude(roomRuntime, "applySchedule<T>(input: RoomRuntimeSubmitInput<T>)", "RoomRuntime schedule apply API");
  mustInclude(roomRuntime, "applyScheduleResult<T>", "RoomRuntime schedule result API");
  mustInclude(roomRuntime, "submitSpeaker<T>", "RoomRuntime speaker submit API");
  mustInclude(roomRuntime, "submitDirector<T>", "RoomRuntime director submit API");
  mustInclude(roomRuntime, "executeSpeakerTurn<T>", "RoomRuntime speaker execute API");
  mustInclude(roomRuntime, "executeDirectorTurn<T>", "RoomRuntime director execute API");
  mustInclude(roomRuntime, "commitTimelineMessage", "RoomRuntime timeline commit API");
  mustInclude(roomRuntime, "commitInspectorPatch", "RoomRuntime Inspector commit API");
  mustInclude(roomRuntime, "roomInputHandler?:", "RoomRuntime room input handler seam");
  mustInclude(roomRuntime, "scheduleResultHandler?:", "RoomRuntime schedule handler seam");
  mustInclude(roomRuntime, "speakerTurnHandler?:", "RoomRuntime speaker handler seam");
  mustInclude(roomRuntime, "directorTurnHandler?:", "RoomRuntime director handler seam");
  mustInclude(roomRuntime, "callRoomInputHandler", "RoomRuntime owns room input handler execution");
  mustInclude(roomRuntime, "callScheduleResultHandler", "RoomRuntime owns schedule handler execution");
  mustInclude(roomRuntime, "callSpeakerTurnHandler", "RoomRuntime owns speaker handler execution");
  mustInclude(roomRuntime, "callDirectorTurnHandler", "RoomRuntime owns director handler execution");
  mustInclude(main, "const roomRuntime = new RoomRuntime({", "RoomRuntime should be created with explicit dependencies");
  mustInclude(main, "memoryAdapter: roomMemoryAdapter", "RoomRuntime should receive the RoomMemoryAdapter dependency");
  mustInclude(main, "roomInputHandler: (input) => executeRoomInput(input.inputText ?? \"\")", "RoomRuntime should receive room input executor");
  mustInclude(main, "scheduleResultHandler: (input) => applyRoomScheduleResultAsync", "RoomRuntime should receive schedule executor");
  mustInclude(main, "speakerTurnHandler: (input, turn) =>", "RoomRuntime should receive speaker turn executor");
  mustInclude(main, "directorTurnHandler: (input, turn) => executeRoomDirectorTurnBody", "RoomRuntime should receive director turn executor");
  mustInclude(main, "roomRuntime.submitRoomInput({", "room input goes through RoomRuntime semantic input");
  mustInclude(main, "inputPreview: input.trim().slice(0, 120)", "room input sends bounded preview to RoomRuntime");
  mustInclude(main, "inputText: input", "room input payload is passed to RoomRuntime");
  mustInclude(main, "roomRuntime.applyScheduleResult({", "room schedule application goes through RoomRuntime");
  mustInclude(main, "scheduleType: result.type", "room schedule application sends schedule type to RoomRuntime");
  mustInclude(main, "scheduleResult: result", "room schedule payload is passed to RoomRuntime");
  mustInclude(main, "executeRoomProviderTurnBody(", "RoomRuntime speaker handler owns the old provider body");
  mustInclude(main, "executeRoomDirectorTurnBody(", "RoomRuntime director handler owns the old director body");
  mustInclude(main, "roomRuntime.executeSpeakerTurn<", "room provider turn uses RoomRuntime execute API");
  mustInclude(main, "roomRuntime.executeDirectorTurn<", "director turn uses RoomRuntime execute API");
  mustInclude(main, "roomRuntime.commitTimelineMessage({", "room timeline commits go through RoomRuntime");
  mustInclude(main, "roomRuntime.commitInspectorPatch({", "room Inspector commits go through RoomRuntime");
  mustNotInclude(main, "roomRuntime.submit({", "main should not call generic RoomRuntime.submit for Room input");
  mustNotInclude(main, "roomRuntime.applySchedule({", "main should not call RoomRuntime low-level schedule API");
  mustNotInclude(main, "roomRuntime.submitSpeaker({", "main should not call RoomRuntime low-level speaker API");
  mustNotInclude(main, "roomRuntime.submitDirector({", "main should not call RoomRuntime low-level director API");
  mustNotInclude(main, "roomRuntime.beginSpeaker({", "room speaker hot path must not manually begin");
  mustNotInclude(main, "roomRuntime.beginDirector({", "director hot path must not manually begin");
  mustNotInclude(main, "activeRoomDirectorTurn", "main should not keep a second Director single-flight lock");
}

async function importRuntimeModules() {
  const tempDir = path.join(root, "node_modules", ".cache", "castroom-validators", `room-runtime-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const aiTurnRuntimePath = path.join(tempDir, "aiTurnRuntime.mjs");
  const aiTurnRuntimeSource = fs.readFileSync(path.join(root, "src/core/aiTurnRuntime.ts"), "utf8");
  fs.writeFileSync(aiTurnRuntimePath, transpile(aiTurnRuntimeSource, "aiTurnRuntime.ts"), "utf8");

  const roomRuntimePath = path.join(tempDir, "roomRuntime.mjs");
  const roomRuntimeSource = fs.readFileSync(path.join(root, "src/core/roomRuntime.ts"), "utf8");
  const roomRuntimeOutput = transpile(roomRuntimeSource, "roomRuntime.ts")
    .replace(/from "\.\/aiTurnRuntime";/g, `from ${JSON.stringify(pathToFileURL(aiTurnRuntimePath).href)};`);
  fs.writeFileSync(roomRuntimePath, roomRuntimeOutput, "utf8");

  const ai = await import(pathToFileURL(aiTurnRuntimePath).href);
  const room = await import(pathToFileURL(roomRuntimePath).href);
  return {
    AiTurnRuntime: ai.AiTurnRuntime,
    RoomRuntime: room.RoomRuntime,
  };
}

function transpile(source, fileName) {
  return ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: true,
    },
    fileName,
  }).outputText;
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
