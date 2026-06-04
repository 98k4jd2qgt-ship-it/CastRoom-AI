import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = fs
  .readFileSync("src/core/memoryGraph.ts", "utf8")
  .replace(
    'import { invoke } from "@tauri-apps/api/core";',
    'const invoke = async () => { throw new Error("Tauri invoke is unavailable in memory graph quality validation."); };',
  );
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-memory-graph-quality-"));
const compilerOptions = {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
  importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
};
const js = ts.transpileModule(source, { compilerOptions }).outputText;
fs.writeFileSync(path.join(tempDir, "memoryGraph.mjs"), js);

const {
  InMemoryMemoryGraphRepository,
  buildMemoryGraphIssues,
} = await import(pathToFileURL(path.join(tempDir, "memoryGraph.mjs")).href);

const failures = [];
const scope = "room:quality-room";
const now = "2026-05-28T00:00:00.000Z";

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function sourceMeta(excerpt) {
  return {
    sourceScope: scope,
    messageId: `msg-${excerpt.length}-${Math.random().toString(16).slice(2)}`,
    sourceTextHash: `hash-${excerpt.length}`,
    excerpt,
    createdAt: now,
  };
}

function claimInput(patch) {
  return {
    scope,
    kind: "fact",
    subject: { kind: "room", canonicalKey: "quality-room", displayName: "Quality Room" },
    predicate: "states",
    object: { kind: "concept", canonicalKey: patch.objectKey ?? patch.text, displayName: patch.objectText ?? patch.text },
    text: patch.text,
    visibility: "public",
    confidence: 0.8,
    authority: "system",
    sensitivity: "normal",
    source: sourceMeta(patch.text),
    conflictPolicy: "merge",
    ...patch,
  };
}

function issueKinds(issues) {
  return new Set(issues.map((issue) => issue.kind));
}

async function validateRepositoryIssuesAndActions() {
  const graph = new InMemoryMemoryGraphRepository();
  const first = await graph.mergeClaim(claimInput({ text: "钥匙在二楼。", predicate: "located_in", objectKey: "二楼", objectText: "二楼" }));
  const conflict = await graph.mergeClaim(claimInput({ text: "钥匙在三楼。", predicate: "located_in", objectKey: "三楼", objectText: "三楼", conflictPolicy: "dispute" }));
  const lowQuality = await graph.mergeClaim(claimInput({
    text: "房间相关事实：房间相关事实：等待玩家",
    authority: "character",
    confidence: 0.9,
  }));
  const leak = await graph.mergeClaim(claimInput({
    text: "隐藏事实：钥匙其实在地下室。",
    kind: "secret",
    visibility: "public",
    sensitivity: "private",
    confidence: 0.82,
  }));

  const issues = await graph.queryIssues({
    scope,
    viewer: { type: "director", roomId: "quality-room" },
    includeDisputed: true,
  });
  const kinds = issueKinds(issues);
  assert(kinds.has("conflict"), "subject + predicate 冲突应进入 conflict 治理问题");
  assert(kinds.has("low_quality"), "泛化/污染文本应进入 low_quality 治理问题");
  assert(kinds.has("visibility_leak"), "public 私密事实应进入 visibility_leak 治理问题");

  const merged = await graph.mergeDuplicates({ winnerClaimId: first.id, duplicateClaimIds: [conflict.id], changedBy: "validation" });
  assert(merged.evidenceCount >= first.evidenceCount + conflict.evidenceCount, "合并重复应保留证据数");
  const archivedConflict = (await graph.queryVisibleClaims({
    scope,
    viewer: { type: "director", roomId: "quality-room" },
    includeDisputed: true,
    limit: 20,
  })).find((claim) => claim.id === conflict.id);
  assert(!archivedConflict, "合并后的重复 claim 不应继续作为 active 可见 claim");

  await graph.archiveLowQuality({ claimIds: [lowQuality.id], changedBy: "validation" });
  const activeAfterArchive = await graph.queryVisibleClaims({
    scope,
    viewer: { type: "director", roomId: "quality-room" },
    includeDisputed: true,
    limit: 20,
  });
  assert(!activeAfterArchive.some((claim) => claim.id === lowQuality.id), "archiveLowQuality 应归档低质量 claim");

  const fixed = await graph.fixVisibility({
    claimId: leak.id,
    visibility: "director_only",
    directorVisible: true,
    changedBy: "validation",
  });
  assert(fixed.visibility === "director_only", "fixVisibility 应更新 claim visibility");
}

function validateStandaloneIssueBuilder() {
  const nodeById = new Map([
    ["node-user", { id: "node-user", scope, kind: "user", canonicalKey: "user", displayName: "User", properties: {}, createdAt: now, updatedAt: now }],
    ["node-a", { id: "node-a", scope, kind: "concept", canonicalKey: "67", displayName: "67", properties: {}, createdAt: now, updatedAt: now }],
  ]);
  const claims = [
    makeClaim("claim-a", "preference: 用户偏好：67", "preference", "prefers"),
    makeClaim("claim-b", "preference: 用户偏好：67", "preference", "prefers"),
  ];
  const issues = buildMemoryGraphIssues(claims, (id) => nodeById.get(id));
  assert(issueKinds(issues).has("duplicate"), "相同 canonical_key 的 active claim 应识别为 duplicate");
}

function makeClaim(id, text, kind, predicate) {
  return {
    id,
    scope,
    kind,
    subjectNodeId: "node-user",
    predicate,
    objectNodeId: "node-a",
    text,
    canonicalKey: "preference:user:prefers:67",
    status: "active",
    confidence: 0.8,
    authority: "system",
    sensitivity: "normal",
    visibility: "private_character",
    evidenceCount: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    version: 1,
    properties: {},
  };
}

await validateRepositoryIssuesAndActions();
validateStandaloneIssueBuilder();

if (failures.length > 0) {
  console.error("Memory graph quality validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Memory graph quality validation passed.");
