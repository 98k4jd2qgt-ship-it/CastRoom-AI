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
    'const invoke = async () => { throw new Error("Tauri invoke is unavailable in memory validation."); };',
  );
const extractionSource = fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-memory-validation-"));
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
const {
  MemoryStore,
  classifySensitivity,
  classifyMemorySensitivity,
  compressMemoryFact,
  extractMemoryAtoms,
  trimMemoryToBudget,
} = await import(moduleUrl);
const failures = [];

const base = new Date("2026-05-09T08:00:00.000Z");

validateNonMemoryIsIgnored();
validateSemanticShortTerm();
validatePromotion();
validateExplicitRemember();
validateMutableLongTerm();
validateForbiddenSensitivity();
validateSevenDayRetention();
validateRoomIsolationAndDeletion();
validateAutomaticPromotionAndSerialization();
validateDirectorMemoryWrites();
validateRoomObserverMemoryWrites();
validateRoomRoleMemoryRestoreScopeIsolation();
validateSameRoomSamePackRoleInstanceIsolation();
validateRecordMemoryEventAlwaysOn();
validateCompressedLongTermMemory();
validateSensitiveNoAutoPromotion();
validateConflictDisputed();
validateRoomRollingSummaryBudget();
validatePromptMemoryBudget();

if (failures.length > 0) {
  console.error(`Memory policy validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory policy validation passed");

function validateNonMemoryIsIgnored() {
  const store = new MemoryStore();
  const scope = "character:demo-mio";
  store.recordShortTermMention({ scope, text: "你好", source: "user", now: base });
  store.recordShortTermMention({ scope, text: "一加一等于几", source: "user", now: base });
  store.recordShortTermMention({ scope, text: "test", source: "user", now: base });
  expect(store.listShortTerm(scope).length === 0, "greetings, tests, and simple questions should not become memory");
}

function validateSemanticShortTerm() {
  const store = new MemoryStore();
  const scope = "character:demo-mio";
  store.recordShortTermMention({ scope, text: "我希望你以后回复短一点", source: "user", now: base });
  const rows = store.listShortTerm(scope);
  expect(rows.length === 1, "preference should create one semantic short-term atom");
  expect(rows[0]?.kind === "preference", "short-term atom should be typed as preference");
  expect(rows[0]?.normalizedText === "用户偏好简短自然回复。", "short-term memory should store compressed semantic text, not the raw sentence");
}

function validatePromotion() {
  const store = new MemoryStore();
  const scope = "character:demo-mio";
  const facts = ["我希望你回复短一点", "以后回答短一点", "请尽量一两句说完"];

  store.recordShortTermMention({ scope, text: facts[0], source: "user", now: base });
  store.recordShortTermMention({ scope, text: facts[1], source: "user", now: addDays(base, 1) });
  const candidate = store.recordShortTermMention({ scope, text: facts[2], source: "user", now: addDays(base, 2) });

  expect(Boolean(candidate), "third equivalent semantic mention should create long-term memory");
  expect(candidate?.confirmed === true, "promoted memory should be active immediately");
  expect(candidate?.requiresConfirmation === false, "promoted memory should not wait for manual confirmation");
  expect(store.listCandidateMemories(scope).length === 1, "long-term memory should stay inside character scope");
  expect(store.listCandidateMemories("room:demo-room").length === 0, "character long-term memory must not leak into room scope");
}

function validateExplicitRemember() {
  const store = new MemoryStore();
  const candidate = store.recordShortTermMention({
    scope: "character:demo-rin",
    text: "记住我喜欢安静的节奏",
    source: "user",
    now: base,
  });

  expect(Boolean(candidate), "explicit remember phrase should create long-term memory before three mentions");
  expect(candidate?.confirmed === true, "explicit remember should be active immediately");
  expect(candidate?.requiresConfirmation === false, "explicit remember should not wait for manual confirmation");

  const directPreference = store.recordShortTermMention({
    scope: "character:demo-rin",
    text: "记住喜好是67",
    source: "user",
    now: addDays(base, 1),
  });
  expect(Boolean(directPreference), "explicit preference assignment should create long-term memory");
  expect(
    store.listCompressedMemories("character:demo-rin").some((entry) => entry.text.includes("67")),
    "explicit preference assignment should preserve the preference value",
  );
}

function validateMutableLongTerm() {
  const store = new MemoryStore();
  const scope = "character:demo-mio";
  recordThreeTimes(store, scope, "我希望你回复短一点", base);
  const [first] = store.listCompressedMemories(scope);
  recordThreeTimes(store, scope, "我希望你回复得更详细一点", addDays(base, 3));
  const entries = store.listCompressedMemories(scope);
  expect(Boolean(first), "initial long-term memory should exist");
  expect(entries.some((entry) => entry.text.includes("详细")), "updated preference should create or refine a long-term memory");
  expect(entries.every((entry) => entry.sourceMessageIds.length === 0 || Array.isArray(entry.sourceMessageIds)), "long-term memory should preserve source message reference arrays");
}

function validateForbiddenSensitivity() {
  const store = new MemoryStore();
  const candidate = store.recordShortTermMention({
    scope: "character:demo-mio",
    text: "记住 API Key 是 sk-test-secret",
    source: "user",
    now: base,
  });

  expect(candidate === null, "forbidden secret text must not create a candidate");
  expect(store.listShortTerm("character:demo-mio").length === 0, "forbidden secret text must not stay in short-term memory");
  expect(classifySensitivity("支付密码是 123456") === "forbidden", "payment password should be classified as forbidden");
}

function validateSevenDayRetention() {
  const store = new MemoryStore();
  store.recordShortTermMention({
    scope: "character:demo-mio",
    text: "我希望你回复短一点",
    source: "user",
    now: addDays(base, -8),
  });
  store.recordShortTermMention({
    scope: "character:demo-mio",
    text: "我希望你回复得更详细一点",
    source: "user",
    now: base,
  });

  const rows = store.listShortTerm("character:demo-mio");
  expect(rows.length === 1, "short-term memory older than seven days should be pruned on write");
  expect(rows[0]?.normalizedText === "用户偏好更详细的解释。", "recent semantic short-term memory should remain after pruning");
}

function validateRoomIsolationAndDeletion() {
  const store = new MemoryStore();
  const roomScope = "room:demo-room";
  const characterScope = "character:demo-mio";

  store.recordRoomMessage({
    scope: roomScope,
    speaker: "Rin",
    text: "钥匙交给 Mio",
    source: "room",
    now: base,
  });
  store.recordShortTermMention({
    scope: characterScope,
    text: "我希望 Mio 回答短一点",
    source: "user",
    now: base,
  });

  expect(store.getRoomMemorySnapshot(roomScope).recentMessages.length === 1, "room message should appear in room message history");
  expect(store.listShortTerm(roomScope).some((item) => item.normalizedText === "钥匙在 Mio 手里。"), "room memory should store semantic item continuity");
  expect(store.listShortTerm(characterScope).length === 1, "character memory should remain separate from room memory");
  store.deleteScopeMemory(roomScope);
  expect(store.getRoomMemorySnapshot(roomScope).recentMessages.length === 0, "clearing room scope should delete room messages");
  expect(store.listShortTerm(characterScope).length === 1, "clearing room scope must not delete character memory");
}

function validateAutomaticPromotionAndSerialization() {
  const store = new MemoryStore();
  const candidate = store.recordShortTermMention({
    scope: "character:demo-kai",
    text: "记住我喜欢安静的节奏",
    source: "user",
    now: base,
  });

  expect(Boolean(candidate), "long-term memory should exist after explicit remember");
  expect(candidate?.confirmed === true, "long-term memory should be active without manual confirmation");
  expect(candidate?.requiresConfirmation === false, "long-term memory should not require manual confirmation");

  const data = store.serialize();
  expect(data.candidates.some((item) => item.confirmed && item.requiresConfirmation === false), "serialized data should preserve active long-term memory state");
  expect(data.compressedMemories.some((item) => item.status === "active"), "serialized data should include compressed long-term memory");

  store.deleteCandidate(candidate.id);
  expect(store.listCandidateMemories("character:demo-kai").length === 0, "deleteCandidate should remove long-term memory");
  expect(store.listCompressedMemories("character:demo-kai").length === 0, "deleteCandidate should remove compressed long-term memory");
}

function validateDirectorMemoryWrites() {
  const store = new MemoryStore();
  const directorScope = "room:demo-room:system";
  const characterScope = "character:demo-mio";

  store.recordDirectorMemory({
    scope: directorScope,
    text: "钥匙在 Mio 手里",
    move: "judge",
    visibility: "public",
    now: base,
    continuityWrites: [
      {
        label: "物品归属",
        detail: "钥匙在 Mio 手里",
        visibility: "public",
        ownerRoleIds: ["demo-mio"],
        status: "active",
      },
    ],
  });

  store.recordDirectorMemory({
    scope: directorScope,
    text: "Rin 知道侧门没有锁",
    move: "whisper",
    visibility: "hidden_from_user",
    now: base,
    secretWrites: [
      {
        id: "secret-side-door",
        title: "侧门线索",
        detail: "侧门没有锁",
        knownToRoleIds: ["demo-rin"],
        revealedToUser: false,
        status: "hidden",
        createdAt: base.toISOString(),
      },
    ],
  });

  store.recordDirectorMemory({
    scope: directorScope,
    text: "钥匙在 Mio 手里",
    move: "judge",
    visibility: "public",
    now: base,
    continuityWrites: [
      {
        label: "物品归属",
        detail: "钥匙在 Mio 手里",
        visibility: "public",
        ownerRoleIds: ["demo-mio"],
        status: "active",
      },
    ],
  });

  const directorMemory = store.getRoomDirectorMemorySnapshot(directorScope);
  expect(
    directorMemory.continuity.entries.some((entry) => entry.detail === "钥匙在 Mio 手里"),
    "director continuity writes should be stored in director memory",
  );
  expect(
    directorMemory.secrets.some((secret) => secret.detail === "侧门没有锁" && secret.knownToRoleIds.includes("demo-rin")),
    "director secret writes should preserve role visibility",
  );
  expect(
    directorMemory.entries.some((entry) => entry.category === "item" && entry.text === "钥匙在 Mio 手里" && entry.status === "active"),
    "director continuity should also create structured item facts",
  );
  expect(
    directorMemory.entries.some((entry) => entry.category === "secret" && entry.knownToRoleIds.includes("demo-rin")),
    "director secrets should also create structured hidden facts",
  );
  expect(
    store.getRoomDirectorPromptMemory(directorScope, "demo-rin").some((line) => line.startsWith("secret:") || line.startsWith("private:")),
    "role-visible director prompt memory should include secrets known by that role",
  );
  expect(
    !store.getRoomDirectorPromptMemory(directorScope, "demo-mio").some((line) => line.startsWith("secret:") || line.startsWith("private:")),
    "director prompt memory should hide secrets from roles that do not know them",
  );
  for (let index = 0; index < 22; index += 1) {
    store.recordDirectorMemory({
      scope: directorScope,
      text: `Debate point ${index}: side A claim ${index}`,
      move: "recap",
      visibility: "public",
      now: addDays(base, 0.01 + index / 1000),
      continuityWrites: [
        {
          label: "Debate point",
          detail: `Debate point ${index}: side A claim ${index}`,
          visibility: "public",
          ownerRoleIds: [],
          status: "active",
        },
      ],
    });
  }
  const directorPromptMemory = store.getRoomDirectorPromptMemory(directorScope).join("\n");
  expect(
    directorPromptMemory.includes("Debate point 21"),
    "director prompt memory should include enough recent room observations for judging multi-turn rooms",
  );

  store.recordDirectorMemory({
    scope: directorScope,
    text: "钥匙在 Rin 手里",
    move: "judge",
    visibility: "public",
    now: addDays(base, 1),
    continuityWrites: [
      {
        label: "物品归属",
        detail: "钥匙在 Rin 手里",
        visibility: "public",
        ownerRoleIds: ["demo-rin"],
        status: "active",
      },
    ],
  });
  const disputedMemory = store.getRoomDirectorMemorySnapshot(directorScope);
  expect(
    disputedMemory.entries.some((entry) => entry.category === "item" && entry.status === "disputed" && entry.text === "钥匙在 Rin 手里"),
    "conflicting director facts should become disputed instead of silently replacing active facts",
  );

  store.recordDirectorMemory({
    scope: directorScope,
    text: "钥匙现在在 Rin 手里",
    move: "judge",
    sourceType: "director_override",
    visibility: "public",
    now: addDays(base, 2),
    continuityWrites: [
      {
        label: "物品归属",
        detail: "钥匙现在在 Rin 手里",
        visibility: "public",
        ownerRoleIds: ["demo-rin"],
        status: "active",
      },
    ],
  });
  const overrideMemory = store.getRoomDirectorMemorySnapshot(directorScope);
  expect(
    overrideMemory.overrides.some((entry) => entry.sourceType === "director_override"),
    "@director overrides should be recorded in the override ledger",
  );
  expect(
    overrideMemory.entries.some((entry) => entry.category === "item" && entry.status === "active" && entry.text === "钥匙现在在 Rin 手里"),
    "@director overrides should create a new active version for the changed fact",
  );
  expect(
    overrideMemory.entries.some((entry) => entry.category === "item" && entry.status === "archived" && entry.text === "钥匙在 Mio 手里"),
    "@director overrides should archive the previous active item fact",
  );
  expect(store.listShortTerm(characterScope).length === 0, "director memory must not leak into character short-term memory");
  expect(store.listCandidateMemories(characterScope).length === 0, "director memory must not create character long-term candidates");
}

function validateRoomObserverMemoryWrites() {
  const store = new MemoryStore();
  const roomScope = "room:demo-room";
  const observerScope = "room:demo-room:observer:demo-rin";
  const characterScope = "character:demo-rin";

  store.recordRoomObservation({
    scope: observerScope,
    roomScope,
    roleId: "demo-rin",
    speaker: "Mio",
    speakerId: "demo-mio",
    speakerType: "role",
    target: { targets: [{ type: "role", roleId: "demo-kai" }] },
    text: "Mio argues that Kai should defend the first point.",
    now: base,
    importance: 72,
    strategyTags: ["argument", "stance"],
    visibility: "public",
    sourceMessageId: "msg-1",
  });

  const promptMemory = store.getRoomObserverPromptMemory(roomScope, "demo-rin");
  expect(promptMemory.some((item) => item.includes("Mio argues")), "observer memory should be available in role prompt memory");
  expect(store.listShortTerm(characterScope).length === 0, "observer memory must not leak into character short-term memory");
  expect(store.listCandidateMemories(characterScope).length === 0, "observer memory must not create character long-term candidates");

  const data = store.serialize();
  expect(data.roomObserverMemories.length === 1, "serialized data should include observer memory");
  store.deleteRoomMemory(roomScope);
  expect(store.getRoomObserverPromptMemory(roomScope, "demo-rin").length === 0, "deleting room memory should delete observer memory");
}

function validateRoomRoleMemoryRestoreScopeIsolation() {
  const store = new MemoryStore();
  const scopeA = "room:room-a:role:mio";
  const scopeB = "room:room-b:role:mio";
  const legacyId = "legacy-shared-memory-id";
  const createEntry = (scope, text) => ({
    id: legacyId,
    scope,
    memoryKey: "preference:user-number",
    kind: "preference",
    text,
    sourceIds: ["legacy-mention"],
    sourceMessageIds: ["legacy-message"],
    evidenceCount: 3,
    confidence: 0.9,
    firstSeenAt: base.toISOString(),
    lastSeenAt: base.toISOString(),
    status: "active",
    sensitivity: "normal",
  });
  const createCandidate = (scope, text) => ({
    id: legacyId,
    sourceScope: scope,
    scope,
    fact: text,
    text,
    evidenceCount: 3,
    mentionCount: 3,
    firstSeenAt: base.toISOString(),
    lastSeenAt: base.toISOString(),
    createdAt: base.toISOString(),
    sensitivity: "normal",
    requiresConfirmation: false,
    confirmed: true,
  });

  store.restoreScope(scopeA, {
    compressedMemories: [createEntry(scopeA, "Room A remembers Mio prefers 67.")],
    candidates: [createCandidate(scopeA, "Room A remembers Mio prefers 67.")],
  });
  store.restoreScope(scopeB, {
    compressedMemories: [createEntry(scopeB, "Room B remembers Mio prefers 42.")],
    candidates: [createCandidate(scopeB, "Room B remembers Mio prefers 42.")],
  });

  const roomA = store.listCompressedMemories(scopeA);
  const roomB = store.listCompressedMemories(scopeB);
  expect(roomA.length === 1, "restoring same role in Room B must not overwrite Room A role memory");
  expect(roomB.length === 1, "Room B role memory should restore independently");
  expect(roomA[0]?.text.includes("67"), "Room A prompt memory should keep Room A fact");
  expect(roomB[0]?.text.includes("42"), "Room B prompt memory should keep Room B fact");
  expect(roomA[0]?.id !== roomB[0]?.id, "restored room role memory ids must be scope-bound");

  store.deleteCandidate(roomA[0]?.id ?? "");
  expect(store.listCompressedMemories(scopeA).length === 0, "deleting Room A memory should remove Room A entry");
  expect(store.listCompressedMemories(scopeB).length === 1, "deleting Room A memory must not delete Room B entry");
}

function validateSameRoomSamePackRoleInstanceIsolation() {
  const store = new MemoryStore();
  const firstInstanceScope = "room:same-room:role:mio";
  const secondInstanceScope = "room:same-room:role:mio-2";

  recordThreeTimes(store, firstInstanceScope, "记住这个房间里的第一个 Mio 喜欢蓝色", base);
  recordThreeTimes(store, secondInstanceScope, "记住这个房间里的第二个 Mio 喜欢红色", addDays(base, 0.25));

  const firstPromptMemory = store.getPromptMemory(firstInstanceScope).join("\n");
  const secondPromptMemory = store.getPromptMemory(secondInstanceScope).join("\n");

  expect(firstPromptMemory.includes("蓝色"), "first same-pack role instance should keep its own room memory");
  expect(!firstPromptMemory.includes("红色"), "first same-pack role instance must not read second instance memory");
  expect(secondPromptMemory.includes("红色"), "second same-pack role instance should keep its own room memory");
  expect(!secondPromptMemory.includes("蓝色"), "second same-pack role instance must not read first instance memory");
}

function validateRecordMemoryEventAlwaysOn() {
  const store = new MemoryStore();
  const result = store.recordMemoryEvent({
    kind: "mention",
    memorySavingEnabled: false,
    scope: "character:demo-mio",
    text: "记住我喜欢简短回复",
    source: "user",
    now: base,
  });

  expect(result.saved === true, "recordMemoryEvent should ignore legacy disabled flags because memory is always on");
  expect(store.listCompressedMemories("character:demo-mio").length === 1, "graph-first explicit memory should appear in long-term list even with legacy disabled flag");
  expect(store.listShortTerm("character:demo-mio").length === 0, "graph-first explicit memory should not create a duplicate short-term row");
}

function validateCompressedLongTermMemory() {
  const store = new MemoryStore();
  const scope = "character:demo-mio";
  const fact = "记住 <think>do not show this</think> Assistant: 我喜欢简短回复";

  store.recordShortTermMention({ scope, text: fact, source: "user", now: base });
  store.recordShortTermMention({ scope, text: "以后短一点", source: "user", now: addDays(base, 1) });
  store.recordShortTermMention({ scope, text: "一两句说完", source: "user", now: addDays(base, 2) });

  const [entry] = store.listCompressedMemories(scope);
  expect(Boolean(entry), "compressed memory should be created with long-term memory");
  expect(entry.text.length <= 160, "compressed memory should stay within 160 English characters / short fact budget");
  expect(!/<think>|assistant:/i.test(entry.text), "compressed memory should remove think blocks and speaker labels");
  expect(store.getPromptMemory(scope).some((item) => item.includes(entry.text)), "prompt memory should inject compressed long-term facts");

  const direct = compressMemoryFact({
    id: "memory-direct",
    scope,
    text: "analysis: 用户喜欢简短回复",
    sourceIds: ["mention-1"],
    evidenceCount: 3,
    firstSeenAt: base.toISOString(),
    lastSeenAt: base.toISOString(),
    sensitivity: "normal",
  });
  expect(!/^analysis:/i.test(direct.text), "compressMemoryFact should clean analysis labels");
}

function validateSensitiveNoAutoPromotion() {
  const store = new MemoryStore();
  const scope = "character:demo-mio";
  const fact = "我的邮箱是 user@example.com";

  store.recordShortTermMention({ scope, text: fact, source: "user", now: base });
  store.recordShortTermMention({ scope, text: fact, source: "user", now: addDays(base, 1) });
  store.recordShortTermMention({ scope, text: fact, source: "user", now: addDays(base, 2) });

  expect(classifyMemorySensitivity(fact) === "sensitive", "email text should be classified as sensitive");
  expect(store.listShortTerm(scope).length === 0, "sensitive incidental text should not create semantic memory without a supported rule");
  expect(store.listCompressedMemories(scope).length === 0, "sensitive facts must not auto-promote to long-term memory");
}

function validateConflictDisputed() {
  const store = new MemoryStore();
  const scope = "room:demo-room";

  recordThreeTimes(store, scope, "钥匙交给 Mio", base);
  recordThreeTimes(store, scope, "钥匙交给 Rin", addDays(base, 3));

  const entries = store.listCompressedMemories(scope);
  expect(entries.some((entry) => entry.status === "active" && /mio/i.test(entry.text)), "first item continuity fact should stay active");
  expect(entries.some((entry) => entry.status === "disputed" && /rin/i.test(entry.text)), "conflicting item fact should be disputed instead of silently overwriting");
}

function validateRoomRollingSummaryBudget() {
  const store = new MemoryStore();
  const scope = "room:demo-room";

  for (let index = 0; index < 50; index += 1) {
    store.recordMemoryEvent({
      kind: "room_message",
      memorySavingEnabled: true,
      input: {
        scope,
        speaker: index % 2 === 0 ? "Mio" : "Rin",
        text: index % 2 === 0 ? `钥匙交给 Mio 第 ${index} 次` : `Rin 认为方案 ${index} 风险较高`,
        source: "room",
        now: addDays(base, index / 24),
        visibility: "public",
        channelId: "public",
      },
    });
  }

  const snapshot = store.getRoomMemorySnapshot(scope);
  expect(snapshot.summary.length <= 500, "room rolling summary should stay within 500 Chinese characters");
  expect(snapshot.recentMessages.length <= 12, "room prompt snapshot should not inject full long history");
  expect(!snapshot.summary.includes("第 49 次"), "room summary should be semantic memory, not raw latest messages");
}

function validatePromptMemoryBudget() {
  const store = new MemoryStore();
  const scope = "character:demo-mio";

  for (let index = 0; index < 12; index += 1) {
    store.recordShortTermMention({
      scope,
      text: index % 2 === 0 ? "我希望你回复短一点" : "请尽量一两句说完",
      source: "user",
      now: addDays(base, index / 24),
    });
  }

  const localPromptMemory = store.getPromptMemory(scope, { localModel: true });
  expect(localPromptMemory.join("\n").length <= 480, "local model prompt memory should be trimmed to a smaller budget");
  expect(!localPromptMemory.join("\n").includes("请尽量"), "local prompt memory should contain semantic facts instead of raw user sentences");
  expect(trimMemoryToBudget(["a".repeat(200), "b".repeat(200), "c".repeat(200)], 320).join("").length <= 320, "trimMemoryToBudget should enforce prompt budget");
}

function recordThreeTimes(store, scope, text, startDate) {
  store.recordShortTermMention({ scope, text, source: "room", now: startDate });
  store.recordShortTermMention({ scope, text, source: "room", now: addDays(startDate, 1) });
  return store.recordShortTermMention({ scope, text, source: "room", now: addDays(startDate, 2) });
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
