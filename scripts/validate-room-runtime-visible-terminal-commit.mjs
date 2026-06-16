import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runtimePath = path.join(root, "src", "core", "aiTurnRuntime.ts");
const mainPath = path.join(root, "src", "main.ts");
const runtimeSource = fs.readFileSync(runtimePath, "utf8");
const mainSource = fs.readFileSync(mainPath, "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`[validate-room-runtime-visible-terminal-commit] ${message}`);
    process.exit(1);
  }
}

assert(
  runtimeSource.includes("markVisibleTerminalCommitted(turn: AiTurnRuntimeTurn | null | undefined)"),
  "AiTurnRuntime must expose a post-commit visible terminal marker",
);
assert(
  runtimeSource.includes("completed.visibleTerminalCommitted = true;"),
  "post-commit marker must update completed runtime turns",
);
assert(
  mainSource.includes("runtimeTurn?: AiTurnRuntimeTurn"),
  "room provider message result must carry the runtime turn",
);
assert(
  mainSource.includes("runtimeTurn: runtimeSubmit.turn"),
  "runRoomProviderTurn must attach the runtime turn to message results",
);
assert(
  mainSource.includes("visibleTerminalCommitted: false"),
  "room speaker runtime must not default provider success to visible timeline commit",
);
assert(
  mainSource.includes("aiTurnRuntime.markVisibleTerminalCommitted(providerTurn.runtimeTurn);"),
  "speaker finalization must mark visible terminal commit after timeline commit succeeds",
);

console.log("[validate-room-runtime-visible-terminal-commit] ok");
