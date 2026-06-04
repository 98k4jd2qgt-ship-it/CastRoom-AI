import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = fs.readFileSync("src/core/memoryExtractionPipeline.ts", "utf8");
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-memory-extraction-"));
const compilerOptions = {
  module: ts.ModuleKind.ES2022,
  target: ts.ScriptTarget.ES2022,
  importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
};
const js = ts.transpileModule(source, { compilerOptions }).outputText;
fs.writeFileSync(path.join(tempDir, "memoryExtractionPipeline.mjs"), js);

const {
  MemoryExtractionPipeline,
  extractMemoryClaimsFromEvent,
} = await import(pathToFileURL(path.join(tempDir, "memoryExtractionPipeline.mjs")).href);

const failures = [];
const baseEvent = {
  scope: "character:test",
  sourceType: "user_explicit_remember",
  source: {
    sourceScope: "character:test",
    messageId: "msg-1",
    excerpt: "记住我喜好是67",
    createdAt: "2026-05-28T00:00:00.000Z",
  },
  now: new Date("2026-05-28T00:00:00.000Z"),
};

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function claimsFor(text, patch = {}) {
  return extractMemoryClaimsFromEvent({
    ...baseEvent,
    text,
    ...patch,
    source: {
      ...baseEvent.source,
      excerpt: text,
      ...(patch.source ?? {}),
    },
  });
}

function validateHardFilters() {
  assert(claimsFor("你好").length === 0, "寒暄不应进入图谱抽取");
  assert(claimsFor("12345").length === 0, "纯数字不应进入图谱抽取");
  assert(claimsFor("No chat model is available.").length === 0, "provider error 不应进入图谱抽取");
  assert(claimsFor("private directive: next speaker is A").length === 0, "Director 私有调度不应进入图谱抽取");
  assert(claimsFor("房间相关事实：房间相关事实：等待玩家").length === 0, "memory artifact 不应进入图谱抽取");
  assert(claimsFor("我的 API key 是 sk-1234567890abcdef").length === 0, "敏感凭据不应进入图谱抽取");
}

function validateExplicitRemember() {
  const claims = claimsFor("记住我喜好是67");
  assert(claims.length === 1, "明确记忆请求应只生成一条 claim");
  assert(claims[0]?.kind === "preference", "明确喜好应生成 preference claim");
  assert(claims[0]?.predicate === "prefers", "preference claim predicate 应为 prefers");
  assert(claims[0]?.text === "用户偏好：67。", "preference claim 应压缩成稳定短事实");
  assert(claims[0]?.confidence >= 0.9, "明确记忆请求应有高置信度");
}

function validateDeveloperAuthority() {
  const claims = claimsFor("我赢了", {
    sourceType: "developer_statement",
    developerMode: true,
    authority: "developer",
    scope: "room:debate-room",
  });
  assert(claims.length === 1, "developer 有效声明应生成 claim");
  assert(claims[0]?.authority === "developer", "developer 声明 authority 应为 developer");
  assert(claims[0]?.confidence === 1, "developer 声明置信度应为 1.0");
  assert(claims[0]?.conflictPolicy === "supersede", "developer 声明应覆盖冲突旧事实");
}

function validatePrivateVisibility() {
  const claims = claimsFor("Mio 私下告诉 Rin：钥匙在二楼。", {
    sourceType: "private_ai",
    scope: "room:mystery",
    visibility: "known_to_roles",
    knownToRoleIds: ["mio", "rin"],
  });
  assert(claims.length >= 1, "private_ai 稳定事实应生成私有 claim");
  assert(claims.every((claim) => claim.visibility === "known_to_roles"), "private_ai claim 不应进入 public visibility");
  assert(claims.every((claim) => claim.directorVisible === true), "private_ai claim 应对 Director 可见");
}

function validateClaimLimit() {
  const claims = claimsFor("记住我喜好是67。钥匙在二楼。目标是逃出去。秘密是门后有人。", {
    sourceType: "room_public_result",
    scope: "room:story",
  });
  assert(claims.length <= 3, "每条输入最多抽取 0-3 个 claim");
}

function validateClassWrapper() {
  const pipeline = new MemoryExtractionPipeline();
  const claims = pipeline.extract({ ...baseEvent, text: "记住我喜欢茶" });
  assert(claims.length === 1 && claims[0].kind === "preference", "MemoryExtractionPipeline.extract 应代理纯函数抽取");
}

validateHardFilters();
validateExplicitRemember();
validateDeveloperAuthority();
validatePrivateVisibility();
validateClaimLimit();
validateClassWrapper();

if (failures.length > 0) {
  console.error("Memory extraction pipeline validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Memory extraction pipeline validation passed.");
