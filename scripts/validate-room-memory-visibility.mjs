import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = fs.readFileSync("src/core/memory.ts", "utf8");
const graphSource = fs
  .readFileSync("src/core/memoryGraph.ts", "utf8")
  .replace(
    'import { invoke } from "@tauri-apps/api/core";',
    'const invoke = async () => { throw new Error("Tauri invoke is unavailable in room memory validation."); };',
  );
const extractionSource = fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-room-memory-validation-"));
const compilerOptions = {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
  importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
};
const graphJs = ts.transpileModule(graphSource, { compilerOptions }).outputText.replaceAll("./types", "../../src/core/types");
const extractionJs = ts.transpileModule(extractionSource, { compilerOptions }).outputText;
const js = ts
  .transpileModule(source, { compilerOptions })
  .outputText
  .replaceAll("./memoryGraph", "./memoryGraph.mjs")
  .replaceAll("./memoryExtractionPipeline", "./memoryExtractionPipeline.mjs");
fs.writeFileSync(path.join(tempDir, "memoryGraph.mjs"), graphJs);
fs.writeFileSync(path.join(tempDir, "memoryExtractionPipeline.mjs"), extractionJs);
fs.writeFileSync(path.join(tempDir, "memory.mjs"), js);

const moduleUrl = pathToFileURL(path.join(tempDir, "memory.mjs")).href;
const { MemoryStore } = await import(moduleUrl);

const failures = [];
const base = new Date("2026-05-22T08:00:00.000Z");

validatePrivateMessageDoesNotEnterPublicRoomMemory();
validatePrivateObserverMemoryIsScopedByRole();
validateSameRoleObserverMemoryIsScopedByRoom();
validateSamePackObserverMemoryIsScopedByRoleInstance();
validateDirectorHiddenMemoryVisibility();
validateFactionMemoryDoesNotEnterPublicRoomMemory();
validateDeletedRoomMemoryIsFullyRemoved();
validateRuntimeWiring();
validateMemoryDashboardTreeWiring();

if (failures.length > 0) {
  console.error(`Room memory visibility validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room memory visibility validation passed");

function validatePrivateMessageDoesNotEnterPublicRoomMemory() {
  const store = new MemoryStore();
  const scope = "room:private-demo";

  store.recordRoomMessage({
    scope,
    speaker: "Mio",
    text: "Mio tells Rin that the side door is unlocked.",
    source: "room",
    now: base,
    visibility: "private_ai",
    visibleTo: [
      { type: "role", roleId: "mio" },
      { type: "role", roleId: "rin" },
    ],
    privateReason: "private_ai",
    channelId: "public",
  });

  expect(store.listShortTerm(scope).length === 0, "private_ai message must not create public room short-term memory");
  expect(store.getRoomMemorySnapshot(scope).recentMessages.length === 0, "private_ai message must not appear in public room recent messages");
  expect(
    store.getRoomPromptMemory(scope).every((line) => !line.includes("side door")),
    "private_ai message must not appear in public room prompt memory",
  );
}

function validatePrivateObserverMemoryIsScopedByRole() {
  const store = new MemoryStore();
  const roomScope = "room:private-demo";

  store.recordRoomObservation({
    scope: `${roomScope}:observer:mio`,
    roomScope,
    roleId: "mio",
    speaker: "Rin",
    speakerId: "rin",
    speakerType: "role",
    target: { targets: [{ type: "role", roleId: "mio" }] },
    text: "Rin privately tells Mio that the side door is unlocked.",
    now: base,
    importance: 70,
    strategyTags: ["clue"],
    visibility: "private_participant",
    sourceMessageId: "private-msg-1",
  });

  const mioMemory = store.getRoomObserverPromptMemory(roomScope, "mio").join("\n");
  const kaiMemory = store.getRoomObserverPromptMemory(roomScope, "kai").join("\n");

  expect(mioMemory.includes("side door"), "known role should read its own private observer memory");
  expect(!kaiMemory.includes("side door"), "unknown role must not read another role's private observer memory");
}

function validateSameRoleObserverMemoryIsScopedByRoom() {
  const store = new MemoryStore();
  const roomA = "room:room-a";
  const roomB = "room:room-b";

  store.recordRoomObservation({
    scope: `${roomA}:observer:mio`,
    roomScope: roomA,
    roleId: "mio",
    speaker: "Rin",
    speakerId: "rin",
    speakerType: "role",
    target: { targets: [{ type: "role", roleId: "mio" }] },
    text: "Room A private clue: the blue key is under the mat.",
    now: base,
    importance: 72,
    strategyTags: ["clue"],
    visibility: "private_participant",
    sourceMessageId: "room-a-private-msg",
  });
  store.recordRoomObservation({
    scope: `${roomB}:observer:mio`,
    roomScope: roomB,
    roleId: "mio",
    speaker: "Rin",
    speakerId: "rin",
    speakerType: "role",
    target: { targets: [{ type: "role", roleId: "mio" }] },
    text: "Room B private clue: the red key is inside the drawer.",
    now: base,
    importance: 72,
    strategyTags: ["clue"],
    visibility: "private_participant",
    sourceMessageId: "room-b-private-msg",
  });

  const roomAMemory = store.getRoomObserverPromptMemory(roomA, "mio").join("\n");
  const roomBMemory = store.getRoomObserverPromptMemory(roomB, "mio").join("\n");
  expect(roomAMemory.includes("blue key"), "Room A same-role observer memory should keep Room A clue");
  expect(!roomAMemory.includes("red key"), "Room A same-role observer memory must not read Room B clue");
  expect(roomBMemory.includes("red key"), "Room B same-role observer memory should keep Room B clue");
  expect(!roomBMemory.includes("blue key"), "Room B same-role observer memory must not read Room A clue");
}

function validateSamePackObserverMemoryIsScopedByRoleInstance() {
  const store = new MemoryStore();
  const roomScope = "room:same-room";

  store.recordRoomObservation({
    scope: `${roomScope}:observer:mio`,
    roomScope,
    roleId: "mio",
    speaker: "Rin",
    speakerId: "rin",
    speakerType: "role",
    target: { targets: [{ type: "role", roleId: "mio" }] },
    text: "First Mio privately hears that the blue key is fake.",
    now: base,
    importance: 72,
    strategyTags: ["clue"],
    visibility: "private_participant",
    sourceMessageId: "same-room-first-mio",
  });
  store.recordRoomObservation({
    scope: `${roomScope}:observer:mio-2`,
    roomScope,
    roleId: "mio-2",
    speaker: "Rin",
    speakerId: "rin",
    speakerType: "role",
    target: { targets: [{ type: "role", roleId: "mio-2" }] },
    text: "Second Mio privately hears that the red key is real.",
    now: base,
    importance: 72,
    strategyTags: ["clue"],
    visibility: "private_participant",
    sourceMessageId: "same-room-second-mio",
  });

  const firstInstance = store.getRoomObserverPromptMemory(roomScope, "mio").join("\n");
  const secondInstance = store.getRoomObserverPromptMemory(roomScope, "mio-2").join("\n");
  expect(firstInstance.includes("blue key"), "first same-pack role instance should read its own observer memory");
  expect(!firstInstance.includes("red key"), "first same-pack role instance must not read second instance observer memory");
  expect(secondInstance.includes("red key"), "second same-pack role instance should read its own observer memory");
  expect(!secondInstance.includes("blue key"), "second same-pack role instance must not read first instance observer memory");
}

function validateDirectorHiddenMemoryVisibility() {
  const store = new MemoryStore();
  const directorScope = "room:private-demo:system";

  store.recordDirectorMemory({
    scope: directorScope,
    roomScope: "room:private-demo",
    speaker: "Rin",
    text: "Rin privately tells Mio that the side door is unlocked.",
    move: "whisper",
    now: base,
    visibility: "known_to_roles",
    visibleToRoleIds: ["rin", "mio"],
    sourceType: "system_event",
    sourceMessageId: "private-msg-1",
    secretWrites: [
      {
        id: "secret-side-door",
        title: "Private AI thread",
        detail: "Rin privately tells Mio that the side door is unlocked.",
        knownToRoleIds: ["rin", "mio"],
        revealedToUser: false,
        visibility: "known_to_roles",
        sourceMessageId: "private-msg-1",
        createdAt: base.toISOString(),
      },
    ],
  });

  const directorMemory = store.getRoomDirectorPromptMemory(directorScope).join("\n");
  const mioMemory = store.getRoomDirectorPromptMemory(directorScope, "mio").join("\n");
  const kaiMemory = store.getRoomDirectorPromptMemory(directorScope, "kai").join("\n");

  expect(directorMemory.includes("side door"), "Director must read private hidden room memory");
  expect(mioMemory.includes("side door"), "known role should read Director hidden memory marked for it");
  expect(!kaiMemory.includes("side door"), "unknown role must not read Director hidden memory");
}

function validateFactionMemoryDoesNotEnterPublicRoomMemory() {
  const store = new MemoryStore();
  const roomScope = "room:faction-demo";

  store.recordFactionHuddle({
    scope: `${roomScope}:faction:team-a`,
    roomScope,
    factionId: "team-a",
    now: base,
    thread: {
      id: "huddle-1",
      roomId: "faction-demo",
      factionId: "team-a",
      factionName: "Team A",
      memberRoleIds: ["mio", "rin"],
      entries: [
        {
          id: "msg-1",
          roleId: "mio",
          speaker: "Mio",
          text: "Team A plans to delay the vote.",
          at: "08:00",
        },
      ],
      summary: "Team A plans to delay the vote.",
      createdAt: base.toISOString(),
    },
  });

  expect(store.getRoomPromptMemory(roomScope).every((line) => !line.includes("delay the vote")), "faction memory must not enter public room prompt memory");
  expect(store.getFactionPromptMemory(roomScope, "team-a").some((line) => line.includes("delay the vote")), "same faction should read faction memory");
  expect(store.getFactionPromptMemory(roomScope, "team-b").every((line) => !line.includes("delay the vote")), "other faction should not read faction memory");
}

function validateDeletedRoomMemoryIsFullyRemoved() {
  const store = new MemoryStore();
  const roomScope = "room:deleted-demo";
  const otherRoomScope = "room:kept-demo";

  store.createCompressedMemory({
    scope: roomScope,
    text: "Public room fact: the hall door is open.",
    kind: "fact",
  });
  store.createCompressedMemory({
    scope: `${roomScope}:system`,
    text: "Director ruling: the hall door was opened.",
    kind: "judgement",
  });
  store.createCompressedMemory({
    scope: `${roomScope}:observer:mio`,
    text: "Private thread: Mio knows the key is upstairs.",
    kind: "secret",
  });
  store.createCompressedMemory({
    scope: `${roomScope}:faction:red`,
    text: "Faction strategy: Red team delays the vote.",
    kind: "plan",
  });
  store.createCompressedMemory({
    scope: otherRoomScope,
    text: "Other room fact: keep this memory.",
    kind: "fact",
  });
  store.recordRoomMessage({
    scope: roomScope,
    speaker: "Mio",
    text: "The hall door is open.",
    source: "room",
    now: base,
  });
  store.recordDirectorMemory({
    scope: `${roomScope}:system`,
    roomScope,
    speaker: "Director",
    text: "The hall door was opened by ruling.",
    move: "judge",
    now: base,
    visibility: "public",
    sourceType: "system_event",
    sourceMessageId: "deleted-director-ruling",
  });
  store.recordRoomObservation({
    scope: `${roomScope}:observer:mio`,
    roomScope,
    roleId: "mio",
    speaker: "Rin",
    speakerId: "rin",
    speakerType: "role",
    target: { targets: [{ type: "role", roleId: "mio" }] },
    text: "Rin privately tells Mio the key is upstairs.",
    now: base,
    importance: 80,
    strategyTags: ["clue"],
    visibility: "private_participant",
    sourceMessageId: "deleted-private",
  });
  store.recordFactionHuddle({
    scope: `${roomScope}:faction:red`,
    roomScope,
    factionId: "red",
    now: base,
    thread: {
      id: "deleted-huddle-red",
      roomId: "deleted-demo",
      factionId: "red",
      factionName: "Red team",
      memberRoleIds: ["mio"],
      entries: [],
      summary: "Red team delays the vote.",
      createdAt: base.toISOString(),
    },
  });

  expect(store.listGraphClaimInputs(roomScope).length > 0, "setup should create public graph memory for deleted room");
  expect(store.listGraphClaimInputs(`${roomScope}:system`).length > 0, "setup should create system graph memory for deleted room");
  expect(store.listGraphClaimInputs(`${roomScope}:observer:mio`).length > 0, "setup should create observer graph memory for deleted room");
  expect(store.listGraphClaimInputs(`${roomScope}:faction:red`).length > 0, "setup should create faction graph memory for deleted room");

  store.deleteRoomMemory(roomScope);

  for (const scope of [roomScope, `${roomScope}:system`, `${roomScope}:observer:mio`, `${roomScope}:faction:red`]) {
    expect(store.listCompressedMemories(scope).length === 0, `deleting room should remove compressed memory for ${scope}`);
    expect(store.listGraphClaimInputs(scope).length === 0, `deleting room should remove graph claims for ${scope}`);
  }
  expect(store.getRoomMemorySnapshot(roomScope).recentMessages.length === 0, "deleting room should remove public room messages");
  expect(
    store.getRoomDirectorPromptMemory(`${roomScope}:system`).every((line) => !line.includes("hall door")),
    "deleting room should remove Director room memory",
  );
  expect(
    store.getRoomObserverPromptMemory(roomScope, "mio").every((line) => !line.includes("upstairs")),
    "deleting room should remove observer room memory",
  );
  expect(
    store.getFactionPromptMemory(roomScope, "red").every((line) => !line.includes("delay the vote")),
    "deleting room should remove faction room memory",
  );
  expect(store.listGraphClaimInputs(otherRoomScope).length > 0, "deleting one room must not remove another room's memory");
}

function validateRuntimeWiring() {
  const main = fs.readFileSync("src/main.ts", "utf8");
  const adapter = fs.readFileSync("src/core/roomMemoryAdapter.ts", "utf8");

  expect(adapter.includes("class RoomMemoryAdapter"), "Room memory writes should be centralized in RoomMemoryAdapter");
  expect(adapter.includes("recordPrivateMessage("), "adapter should expose private room memory writer");
  expect(adapter.includes('message.visibility === "private_ai"'), "adapter should branch private_ai away from public room memory");
  expect(adapter.includes('visibility: "private_participant"'), "private_ai should write private participant observer memory");
  expect(adapter.includes('visibility: "known_to_roles"'), "private_ai should write Director hidden memory with role visibility");
  expect(adapter.includes("recordFactionHuddle("), "adapter should own faction huddle memory writes");
  expect(!main.includes("scope: `${roomScope}:observer:${roleId}`"), "main.ts should not directly construct observer memory scopes in room hot paths");
  expect(!main.includes("scope: `${roomScope}:faction:${thread.factionId}`"), "main.ts should not directly construct faction memory scopes in room hot paths");
  expect(!main.includes("savePrivateToRoomMemory)"), "runtime should not gate private memory with legacy savePrivateToRoomMemory");
  expect(main.includes("memoryStore.deleteRoomMemory("), "room.delete should delete room memory scopes");
  expect(main.includes("deletedRoomMemoryScopes"), "room.delete should collect deleted room graph scopes before reducer changes state");
  expect(main.includes("graphReplace: true"), "room.delete should replace graph scopes for removed room");
}

function validateMemoryDashboardTreeWiring() {
  const ui = fs.readFileSync("src/ui/petConsole.ts", "utf8");
  const css = fs.readFileSync("src/styles.css", "utf8");

  expect(ui.includes("interface MemoryTreeNode"), "memory UI should define hierarchical MemoryTreeNode view model");
  expect(ui.includes("function buildMemoryTree"), "memory UI should build a tree, not only a flat scope list");
  expect(ui.includes("const rooms = state.rooms.length > 0 ? state.rooms : [state.room]"), "memory tree should include all rooms");
  expect(ui.includes('uiText(language, "Room memory"'), "memory tree should label public room memory");
  expect(ui.includes('uiText(language, "Director memory"'), "memory tree should label Director memory");
  expect(ui.includes('uiText(language, "Role perspectives"'), "memory tree should group merged room role perspectives");
  expect(ui.includes("graphScopes = uniqueMemoryScopes([roomScope, participant.memoryScope, observerSnapshot.scope, factionSnapshot?.scope])"), "role perspective should merge public room, private, and faction scopes");
  expect(ui.includes('uiText(language, "Legacy private perspective"'), "memory tree should keep only legacy unmatched private perspective compatibility");
  expect(ui.includes('uiText(language, "Faction memory"'), "memory tree should group faction memory");
  expect(ui.includes('uiText(language, "One-to-one characters"'), "one-to-one character memory should sit outside rooms");
  expect(/createMemoryTreeLeaf\(\{\s*id: "global"[\s\S]*?uiText\(language, "Global"[\s\S]*?scope: globalScope[\s\S]*?\}\)/.test(ui), "global memory should be a single leaf node, not a parent group");
  expect(!ui.includes("全局 / 全局偏好"), "global memory should not render a parent/child path");
  expect(!ui.includes("Global / Global preferences"), "global memory should not render a parent/child path in English");
  expect(ui.includes("kind: \"room_public\""), "public room memory should use room_public scope kind");
  expect(ui.includes("kind: \"observer\""), "private observer memory should use observer scope kind");
  expect(ui.includes("kind: \"faction\""), "faction memory should use faction scope kind");
  expect(ui.includes("renderMemoryTreeList"), "memory dashboard should render the tree list");
  expect(ui.includes("button.dataset.depth = String(depth)"), "memory tree items should expose depth for hierarchical styling");
  expect(ui.includes("button.dataset.hasChildren = String(hasChildren)"), "memory tree items should expose parent/leaf state");
  expect(ui.includes("button.dataset.expanded = String(isExpanded)"), "memory tree parent nodes should expose expanded state");
  expect(ui.includes('button.setAttribute("aria-expanded", String(isExpanded))'), "memory tree parent nodes should expose aria-expanded");
  expect(ui.includes("expandedNodeIds.add(node.id)"), "memory tree parent click should toggle expansion open");
  expect(ui.includes("expandedNodeIds.delete(node.id)"), "memory tree parent click should toggle expansion closed");
  expect(ui.includes("children.hidden = !nextExpanded"), "collapsed memory tree children should be hidden");
  expect(!ui.includes("const firstChild = firstSelectableMemoryNode(node.children ?? [])"), "parent tree click must not auto-select the first child");
  expect(ui.includes("memory-tree-icon"), "memory tree items should render a hierarchy icon");
  expect(ui.includes("memoryScopeKindLabel(item.kind"), "memory scope labels should remain localized for any compact scope list fallback");
  expect(ui.includes("memoryFileSourceLabel(scope.kind"), "memory details should expose the backing memory source");
  expect(css.includes(".memory-tree-list"), "memory tree should have dedicated CSS");
  expect(css.includes(".memory-tree-children"), "memory tree should show parent-child indentation");
  expect(css.includes(".memory-tree-children[hidden]"), "collapsed memory tree children should remain hidden even when tree CSS sets display");
  expect(css.includes("border-left: 0;"), "memory tree should avoid full-height lines that can imply visibility or data flow");
  expect(css.includes(".memory-tree-children > .memory-tree-node::before"), "memory tree should use node-level vertical file-tree guide lines");
  expect(css.includes(".memory-tree-children > .memory-tree-node::after"), "memory tree should use node-level horizontal file-tree connector lines");
  expect(css.includes(".memory-tree-children > .memory-tree-node:last-child::before"), "memory tree should stop vertical guide lines at the last child");
  expect(!css.includes(".memory-tree-children::after"), "memory tree should not use container background guide lines");
  expect(css.includes("pointer-events: none;"), "memory tree guide lines must be decorative and non-interactive");
  expect(css.includes(".memory-scope-item.memory-tree-item[data-depth=\"2\"]"), "memory tree child nodes should be visually smaller than parent nodes");
  expect(css.includes(".memory-scope-item.memory-tree-item[data-has-children=\"true\"]"), "parent tree rows should use distinct non-card styling");
  expect(css.includes(".memory-scope-item.memory-tree-item[data-active=\"true\"][data-has-children=\"false\"]"), "only selected leaf memory nodes should get strong active styling");
  expect(css.includes(".memory-scope-item.memory-tree-item[data-contains-active=\"true\"]"), "ancestor tree rows should use weak active styling");
  expect(css.includes(".memory-tree-item[data-kind=\"observer\"]"), "private/observer nodes should have distinguishable styling");
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
