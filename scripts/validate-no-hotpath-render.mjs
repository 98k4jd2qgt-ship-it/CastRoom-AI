import fs from "node:fs";

const main = fs.readFileSync("src/main.ts", "utf8");
const renderGate = fs.readFileSync("src/core/renderGate.ts", "utf8");
const indexHtml = fs.readFileSync("index.html", "utf8");
const failures = [];

mustInclude(renderGate, "export class RenderGate", "RenderGate module");
mustInclude(main, "renderGate.request({", "central requestRender gate");
mustInclude(main, "function shouldAvoidFullRender(", "global hot-path check");
mustInclude(main, "function resolveRenderWorkspace(", "workspace-aware render decisions");
mustInclude(main, "function createRenderLocalUpdate(", "local update render fallback");
mustInclude(main, "suppressedFullRenderCount += 1", "suppressed render diagnostics");
mustInclude(main, "lastSuppressedFullRenderReason = reason", "last suppressed render reason");
mustInclude(main, 'document.getElementById("app")', "explicit app root lookup");
mustInclude(main, "missing #app root element", "visible missing-root startup error");
mustInclude(indexHtml, "function escapeHtml(value)", "boot error HTML escaping helper");
mustInclude(indexHtml, "escapeHtml(message)", "boot error renders escaped message");
mustNotInclude(indexHtml, "'<code style=\"display:block;white-space:pre-wrap;overflow-wrap:anywhere;color:#ffb4b4;\">' +\n              return", "broken inline boot script fragment");

const requestRenderBlock = sliceFunction(main, "requestRender");
mustInclude(requestRenderBlock, "renderGate.request({", "requestRender uses RenderGate");
mustInclude(requestRenderBlock, "workspace,", "requestRender passes workspace");
mustInclude(requestRenderBlock, "localUpdate: createRenderLocalUpdate", "requestRender passes local update callback");
mustInclude(requestRenderBlock, "if (!decision.allow)", "requestRender suppresses denied decisions");
mustInclude(requestRenderBlock, "render();", "requestRender remains the full-render escape hatch");
validateDirectRenderCalls(main);

const appendConsoleMessageBlock = sliceFunction(main, "appendConsoleMessage");
mustNotInclude(appendConsoleMessageBlock, "render();", "appendConsoleMessage must not full-render");
mustInclude(appendConsoleMessageBlock, "appendConsoleMessageToCurrentStream", "appendConsoleMessage uses local append");
mustInclude(appendConsoleMessageBlock, "messageCommitter.commit", "appendConsoleMessage reports commit visibility");

const runCharacterTurnBlock = sliceFunction(main, "runCharacterTurn");
mustNotInclude(runCharacterTurnBlock, "\n    render();", "runCharacterTurn should not directly full-render during AI hot path");
mustInclude(runCharacterTurnBlock, "renderUnlessConsoleChatHotPath", "runtime status render uses hot-path guard");
mustInclude(runCharacterTurnBlock, "attemptedLiveChatProvider", "console chat attempts only one live chat provider");
mustInclude(runCharacterTurnBlock, "aiTurnRuntime.beginRequest(runtimeTurn", "local console requests are gated by AiTurnRuntime");

const runRoomProviderTurnBlock = sliceFunction(main, "runRoomProviderTurn");
mustNotInclude(runRoomProviderTurnBlock, "render();", "runRoomProviderTurn should not directly full-render during room AI hot path");
mustInclude(runRoomProviderTurnBlock, "roomRuntime.executeSpeakerTurn<", "room speaker turns execute through RoomRuntime");
mustNotInclude(runRoomProviderTurnBlock, "roomRuntime.submitSpeaker({", "room speaker hot path should not call low-level RoomRuntime submit");
mustInclude(runRoomProviderTurnBlock, "scheduleResult: result", "room speaker wrapper passes schedule payload to RoomRuntime");
mustInclude(runRoomProviderTurnBlock, "runtimeState", "room speaker wrapper delegates terminal-state tracking to runtime handler");
mustNotInclude(runRoomProviderTurnBlock, "execute: async", "room speaker wrapper should not own provider execution body");
const executeRoomProviderTurnBodyBlock = sliceFunction(main, "executeRoomProviderTurnBody");
mustNotInclude(executeRoomProviderTurnBodyBlock, "render();", "executeRoomProviderTurnBody should not directly full-render during room AI hot path");
mustInclude(executeRoomProviderTurnBodyBlock, "resolveRoomTurnProviders", "room speaker handler uses unified provider list");
mustInclude(executeRoomProviderTurnBodyBlock, "createCloudTurnAuditHooks(null, \"room\", runtimeTurn)", "room cloud requests are bound to the runtime turn");
mustInclude(executeRoomProviderTurnBodyBlock, "aiTurnRuntime.beginRequest(runtimeTurn", "room local requests are gated by AiTurnRuntime");
mustInclude(main, "commitRoomTimelineMessage(message, \"room_speaker_message\")", "room speaker commits through MessageCommitter");

const applyRoomDirectorTurnAsyncBlock = sliceFunction(main, "applyRoomDirectorTurnAsync");
mustNotInclude(applyRoomDirectorTurnAsyncBlock, "render();", "applyRoomDirectorTurnAsync should not directly full-render during director hot path");
mustInclude(applyRoomDirectorTurnAsyncBlock, "roomRuntime.executeDirectorTurn<", "director turns execute through RoomRuntime");
mustNotInclude(applyRoomDirectorTurnAsyncBlock, "roomRuntime.submitDirector({", "director hot path should not call low-level RoomRuntime submit");
mustInclude(applyRoomDirectorTurnAsyncBlock, "directorRequest: request", "director wrapper passes request payload to RoomRuntime");
mustNotInclude(applyRoomDirectorTurnAsyncBlock, "execute: async", "director wrapper should not own Director execution body");
const executeRoomDirectorTurnBodyBlock = sliceFunction(main, "executeRoomDirectorTurnBody");
mustNotInclude(executeRoomDirectorTurnBodyBlock, "render();", "executeRoomDirectorTurnBody should not directly full-render during director hot path");
mustInclude(executeRoomDirectorTurnBodyBlock, "createLiveDirectorTurnPlan(request, localResult.plan, runtimeTurn)", "director live plan receives the runtime turn");

const runRoomAutoTurnBlock = sliceFunction(main, "runRoomAutoTurn");
mustNotInclude(runRoomAutoTurnBlock, "render();", "runRoomAutoTurn should not directly full-render during room auto hot path");
mustInclude(runRoomAutoTurnBlock, "requestRender(\"room_auto_turn_scheduled\"", "room auto turn uses RenderGate");

if (failures.length) {
  console.error(`No-hotpath-render validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("No-hotpath-render validation passed.");

function validateDirectRenderCalls(text) {
  const lines = text.split(/\r?\n/);
  const requestRenderStart = lines.findIndex((line) => line.includes("function requestRender("));
  const requestRenderEnd = requestRenderStart >= 0
    ? findFunctionEnd(lines, requestRenderStart)
    : -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^\s*render\(\);/.test(lines[index])) {
      continue;
    }
    const lineNo = index + 1;
    const localContext = lines.slice(Math.max(0, index - 12), Math.min(lines.length, index + 2)).join("\n");
    const inRequestRender = requestRenderStart >= 0 && index >= requestRenderStart && index <= requestRenderEnd;
    const isStartupRender = index > lines.length - 25;
    const isRequestRenderEscapeHatch = localContext.includes("renderGuardBypassDepth += 1");
    if (!inRequestRender && !isRequestRenderEscapeHatch && !isStartupRender) {
      failures.push(`direct render() must go through requestRender at src/main.ts:${lineNo}`);
    }
  }
}

function findFunctionEnd(lines, startIndex) {
  let depth = 0;
  let seenOpen = false;
  for (let index = startIndex; index < lines.length; index += 1) {
    for (const char of lines[index]) {
      if (char === "{") {
        depth += 1;
        seenOpen = true;
      } else if (char === "}") {
        depth -= 1;
        if (seenOpen && depth === 0) {
          return index;
        }
      }
    }
  }
  return startIndex;
}

function sliceFunction(text, name) {
  const start = text.indexOf(`function ${name}`);
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const next = text.indexOf("\nfunction ", start + 1);
  return next < 0 ? text.slice(start) : text.slice(start, next);
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
