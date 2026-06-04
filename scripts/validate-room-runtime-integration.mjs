import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const roomRuntime = fs.readFileSync("src/core/roomRuntime.ts", "utf8");
const failures = [];

mustInclude(roomRuntime, "export type RoomRuntimeSource", "RoomRuntime source type");
mustInclude(roomRuntime, "export interface RoomRuntimeEffect", "RoomRuntime effect contract");
mustInclude(roomRuntime, "export interface RoomRuntimeDeps", "RoomRuntime dependency contract");
mustInclude(roomRuntime, "export type RoomRuntimeResult", "RoomRuntime result contract");
mustInclude(roomRuntime, "export interface RoomRuntimeResultEffectFields", "RoomRuntime flattened result effect contract");
mustInclude(roomRuntime, "export interface RoomRuntimeRoomInput", "RoomRuntime room input contract");
mustInclude(roomRuntime, "submit<T>(input: RoomRuntimeSubmitInput<T>)", "RoomRuntime submit entry");
mustInclude(roomRuntime, "submitRoomInput<T>", "RoomRuntime semantic room input entry");
mustInclude(roomRuntime, "applySchedule<T>(input: RoomRuntimeSubmitInput<T>)", "RoomRuntime schedule entry");
mustInclude(roomRuntime, "applyScheduleResult<T>", "RoomRuntime schedule result entry");
mustInclude(roomRuntime, "executeSpeakerTurn<T>", "RoomRuntime speaker execution entry");
mustInclude(roomRuntime, "executeDirectorTurn<T>", "RoomRuntime director execution entry");
mustInclude(roomRuntime, "commitTimelineMessage", "RoomRuntime timeline commit entry");
mustInclude(roomRuntime, "commitInspectorPatch", "RoomRuntime Inspector commit entry");
mustInclude(roomRuntime, "activeRoomOperations", "RoomRuntime guards input/schedule operations");
mustInclude(roomRuntime, "diagnostics?: (diagnostic: RoomRuntimeDiagnostic) => void", "RoomRuntime owns diagnostics adapter");
mustInclude(roomRuntime, "roomInputHandler?:", "RoomRuntime owns room input handler seam");
mustInclude(roomRuntime, "scheduleResultHandler?:", "RoomRuntime owns schedule result handler seam");
mustInclude(roomRuntime, "speakerTurnHandler?:", "RoomRuntime owns speaker turn handler seam");
mustInclude(roomRuntime, "directorTurnHandler?:", "RoomRuntime owns director turn handler seam");
mustInclude(roomRuntime, "callRoomInputHandler", "RoomRuntime invokes room input handler internally");
mustInclude(roomRuntime, "callScheduleResultHandler", "RoomRuntime invokes schedule result handler internally");
mustInclude(roomRuntime, "callSpeakerTurnHandler", "RoomRuntime invokes speaker turn handler internally");
mustInclude(roomRuntime, "callDirectorTurnHandler", "RoomRuntime invokes director turn handler internally");
mustInclude(main, "const roomRuntime = new RoomRuntime({", "RoomRuntime is constructed with explicit deps");
mustInclude(main, "memoryAdapter: roomMemoryAdapter", "RoomRuntime receives RoomMemoryAdapter dependency");
mustInclude(main, "roomInputHandler: (input) => executeRoomInput(input.inputText ?? \"\")", "RoomRuntime receives room input executor");
mustInclude(main, "scheduleResultHandler: (input) => applyRoomScheduleResultAsync", "RoomRuntime receives schedule result executor");
mustInclude(main, "speakerTurnHandler: (input, turn) =>", "RoomRuntime receives speaker turn executor");
mustInclude(main, "directorTurnHandler: (input, turn) => executeRoomDirectorTurnBody", "RoomRuntime receives director turn executor");
mustNotInclude(main, "roomRuntime.submit({", "main must use semantic submitRoomInput instead of generic RoomRuntime.submit");
mustNotInclude(main, "activeRoomDirectorTurn", "main must not keep a parallel Director turn lock");

const handleRoomInput = sliceFunction("handleRoomInput");
mustIncludeIn(handleRoomInput, "roomRuntime.submitRoomInput({", "handleRoomInput routes through RoomRuntime.submitRoomInput");
mustIncludeIn(handleRoomInput, "inputPreview: input.trim().slice(0, 120)", "handleRoomInput sends a redacted input preview to RoomRuntime");
mustIncludeIn(handleRoomInput, "inputText: input", "handleRoomInput passes raw input payload to RoomRuntime");
mustNotIncludeIn(handleRoomInput, "executeRoomInput(input)", "handleRoomInput must not directly execute room input body");
mustNotIncludeIn(handleRoomInput, "commitRoomTimelineMessage(userMessage", "handleRoomInput wrapper should not write timeline directly");
mustNotIncludeIn(handleRoomInput, "scheduleRoomTurn({", "handleRoomInput wrapper should not schedule directly");

const executeRoomInput = sliceFunction("executeRoomInput");
mustIncludeIn(executeRoomInput, "commitRoomTimelineMessage(userMessage, \"room_user_message\")", "executeRoomInput still commits accepted user message");
mustIncludeIn(executeRoomInput, "applyRoomScheduleResultViaRuntime(scheduled, input, \"user\")", "user schedule result goes through RoomRuntime");

const scheduleViaRuntime = sliceFunction("applyRoomScheduleResultViaRuntime");
mustIncludeIn(scheduleViaRuntime, "roomRuntime.applyScheduleResult({", "schedule wrapper routes through RoomRuntime.applyScheduleResult");
mustIncludeIn(scheduleViaRuntime, "scheduleType: result.type", "schedule wrapper sends schedule type metadata to RoomRuntime");
mustIncludeIn(scheduleViaRuntime, "scheduleResult: result", "schedule wrapper passes schedule payload to RoomRuntime");
mustIncludeIn(scheduleViaRuntime, "userInput", "schedule wrapper passes user input payload to RoomRuntime");
mustNotIncludeIn(scheduleViaRuntime, "applyRoomScheduleResultAsync(result, userInput)", "schedule wrapper must not directly execute schedule body");
mustIncludeIn(scheduleViaRuntime, "applyRoomRuntimeResult(runtimeResult)", "schedule wrapper applies runtime effects");
mustNotIncludeIn(scheduleViaRuntime, "roomRuntime.applySchedule({", "schedule wrapper should not call low-level RoomRuntime.applySchedule");

const runRoomAutoTurn = sliceFunction("runRoomAutoTurn");
mustIncludeIn(runRoomAutoTurn, "applyRoomScheduleResultViaRuntime(", "auto room turn uses RoomRuntime schedule wrapper");
mustNotIncludeIn(runRoomAutoTurn, "applyRoomScheduleResultAsync(", "auto room turn must not call schedule body directly");

const roomProviderTurn = sliceFunction("runRoomProviderTurn");
mustIncludeIn(roomProviderTurn, "roomRuntime.executeSpeakerTurn<", "room provider turn routes through RoomRuntime.executeSpeakerTurn");
mustIncludeIn(roomProviderTurn, "scheduleResult: result", "room provider turn passes schedule payload to RoomRuntime");
mustIncludeIn(roomProviderTurn, "runtimeState", "room provider turn passes runtime terminal-state adapter");
mustIncludeIn(roomProviderTurn, "applyRoomRuntimeResult(runtimeResult)", "room provider turn applies runtime effects");
mustNotIncludeIn(roomProviderTurn, "execute: async", "room provider wrapper must not own the provider execution body");
mustNotIncludeIn(roomProviderTurn, "roomRuntime.submitSpeaker({", "room provider turn should not call low-level RoomRuntime.submitSpeaker");
const roomProviderBody = sliceFunction("executeRoomProviderTurnBody");
mustIncludeIn(roomProviderBody, "resolveRoomTurnProviders", "RoomRuntime speaker handler owns provider resolution body");
mustIncludeIn(roomProviderBody, "createCloudTurnAuditHooks(null, \"room\", runtimeTurn)", "RoomRuntime speaker handler binds cloud requests to runtime turn");
mustIncludeIn(roomProviderBody, "aiTurnRuntime.beginRequest(runtimeTurn", "RoomRuntime speaker handler gates local requests by runtime turn");

const directorTurn = sliceFunction("applyRoomDirectorTurnAsync");
mustIncludeIn(directorTurn, "roomRuntime.executeDirectorTurn<", "director turn routes through RoomRuntime.executeDirectorTurn");
mustIncludeIn(directorTurn, "directorRequest: request", "director wrapper passes request payload to RoomRuntime");
mustIncludeIn(directorTurn, "applyRoomRuntimeResult(runtimeResult)", "director turn applies runtime effects");
mustNotIncludeIn(directorTurn, "execute: async", "director wrapper must not own the director execution body");
mustNotIncludeIn(directorTurn, "roomRuntime.submitDirector({", "director turn should not call low-level RoomRuntime.submitDirector");
mustNotIncludeIn(directorTurn, "activeRoomDirectorTurn", "director turn should rely on RoomRuntime/AiTurnRuntime single-flight");
const directorBody = sliceFunction("executeRoomDirectorTurnBody");
mustIncludeIn(directorBody, "scheduleRoomDirectorTurn(request)", "RoomRuntime director handler owns local Director planning body");
mustIncludeIn(directorBody, "createLiveDirectorTurnPlan(request, localResult.plan, runtimeTurn)", "RoomRuntime director handler binds live plan to runtime turn");
mustIncludeIn(directorBody, "applyRoomDirectorTurn(result)", "RoomRuntime director handler applies public/private Director plan");

const applyEffect = sliceFunction("applyRoomRuntimeEffect");
mustIncludeIn(applyEffect, "requestConversationInputFocus(\"room\")", "RoomRuntime effects can request room focus");
mustIncludeIn(applyEffect, "syncRoomAutoTimer()", "RoomRuntime effects can sync room timer");
mustIncludeIn(applyEffect, "requestRender(effect.renderReason", "RoomRuntime effects route rendering through RenderGate wrapper");

const applyResult = sliceFunction("applyRoomRuntimeResult");
mustIncludeIn(applyResult, "result.effect.timelineMessages ?? result.timelineMessages", "RoomRuntime result applies flattened timeline messages");
mustIncludeIn(applyResult, "result.effect.inspectorPatch ?? result.inspectorPatch", "RoomRuntime result applies flattened Inspector patch");
mustIncludeIn(applyResult, "result.effect.renderKind ?? result.renderKind", "RoomRuntime result applies flattened render kind");

const commitRoomTimeline = sliceFunction("commitRoomTimelineMessage");
mustIncludeIn(commitRoomTimeline, "roomRuntime.commitTimelineMessage({", "Room timeline helper delegates to RoomRuntime");
mustIncludeIn(commitRoomTimeline, "type: \"room.addMessage\"", "Room timeline helper still owns reducer write through runtime adapter");

const commitRoomInspector = sliceFunction("commitRoomInspectorPatch");
mustIncludeIn(commitRoomInspector, "roomRuntime.commitInspectorPatch({", "Room Inspector helper delegates to RoomRuntime");
mustIncludeIn(commitRoomInspector, "type: \"room.setSimulationState\"", "Room Inspector helper writes visible stop reason through runtime adapter");

if (failures.length) {
  console.error(`Room runtime integration validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room runtime integration validation passed.");

function sliceFunction(name) {
  const start = Math.max(main.indexOf(`function ${name}`), main.indexOf(`async function ${name}`));
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nasync function "]
    .map((marker) => main.indexOf(marker, start + 1))
    .filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next < 0 ? main.slice(start) : main.slice(start, next);
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

function mustIncludeIn(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}

function mustNotIncludeIn(text, marker, label) {
  if (text.includes(marker)) {
    failures.push(`unexpected ${label}: ${marker}`);
  }
}
