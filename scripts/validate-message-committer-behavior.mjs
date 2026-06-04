import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const failures = [];
const { MessageCommitter } = await importTs("src/core/messageCommitter.ts");

validateApplyCommit();
validateVisibleFallback();
validateSourceIntegration();

if (failures.length) {
  console.error(`Message committer behavior validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Message committer behavior validation passed.");

function validateApplyCommit() {
  const committer = new MessageCommitter();
  let writes = 0;
  const result = committer.commit({
    target: "direct_room",
    reason: "test_direct_room",
    apply: () => {
      writes += 1;
      return { messageId: "message-1", visible: true };
    },
  });
  assert(writes === 1, "apply callback should run exactly once");
  assert(result.ok && result.messageId === "message-1" && result.visible, "successful apply should return visible commit result");
}

function validateVisibleFallback() {
  const committer = new MessageCommitter();
  let fallbackWrites = 0;
  const result = committer.commit({
    target: "room_inspector",
    reason: "inspector_update",
    apply: () => {
      throw new Error("store write failed");
    },
    onCommitFailure: (reason) => {
      fallbackWrites += 1;
      return { visible: true, reason };
    },
  });
  assert(fallbackWrites === 1, "commit failure fallback should run once");
  assert(!result.ok && result.visible, "failed commit should still expose a visible terminal state");
  assert(result.reason === "inspector_update", "explicit commit reason should be preserved on fallback");
}

function validateSourceIntegration() {
  const main = fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
  mustInclude(main, "function commitRoomTimelineMessage(", "room timeline commit helper");
  mustInclude(main, "commitRoomTimelineMessage(userMessage, \"room_user_message\")", "room user messages go through committer");
  mustInclude(main, "commitRoomTimelineMessage(message, \"room_director_public_text\")", "director public text goes through committer");
  mustInclude(main, "for (const message of createFactionChannelMessages(result.factionHuddle))", "faction huddle timeline messages are expanded before committer");
  mustInclude(main, "commitRoomTimelineMessage(message, \"room_faction_huddle\")", "faction huddle timeline messages go through committer");
  mustInclude(main, "commitRoomTimelineMessage(message, \"room_speaker_message\")", "room speaker messages go through committer");

  const directRoomBlock = sliceFunction(main, "appendConsoleMessage");
  mustInclude(directRoomBlock, "apply: () => {", "direct-room append uses committer apply callback");
  mustInclude(directRoomBlock, "appendConsoleMessageToCurrentStream(message)", "direct-room commit performs local append inside committer");
  mustInclude(directRoomBlock, "onCommitFailure:", "direct-room commit has visible fallback");

  const helperBlock = sliceFunction(main, "commitRoomTimelineMessage");
  mustInclude(helperBlock, "roomRuntime.commitTimelineMessage({", "room timeline helper uses RoomRuntime commit adapter");
  mustInclude(helperBlock, "type: \"room.addMessage\"", "room timeline helper owns the reducer write");
  mustInclude(helperBlock, "type: \"room.setSimulationState\"", "room commit failure writes Inspector stop reason");

  const inspectorBlock = sliceFunction(main, "commitRoomInspectorPatch");
  mustInclude(inspectorBlock, "roomRuntime.commitInspectorPatch({", "room Inspector helper uses RoomRuntime commit adapter");
  mustInclude(inspectorBlock, "type: \"room.setSimulationState\"", "room Inspector helper owns the reducer write");
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

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
