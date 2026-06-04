import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    console.error(`[frame-intent-mojibake] ${message}`);
    process.exitCode = 1;
  }
}

const guards = read("src/core/roomRuleGuards.ts");
const interpretation = read("src/core/inputInterpretation.ts");
const roomSurface = read("src/ui/roomSurface.ts");
const guardBlock = guards.slice(guards.indexOf("const FRAME_MODE_PATTERNS"), guards.indexOf("export function isRoomAppSafetyText"));
const interpretationBlock = interpretation.slice(interpretation.indexOf("const MODE_PATTERNS"), interpretation.indexOf("export function interpretUserInput"));
const labelBlock = roomSurface.slice(roomSurface.indexOf("function frameIntentKindLabel"), roomSurface.indexOf("function frameUserRoleLabel"));

const mojibakeTokens = [
  [0x95c3],
  [0x7ec9],
  [0x93c6],
  [0x6748],
  [0x5bee, 0x20ac],
  [0x6d93],
  [0x5ff6],
  [0xfffd],
].map((codes) => String.fromCodePoint(...codes));

for (const bad of mojibakeTokens) {
  assert(!guardBlock.includes(bad), `roomRuleGuards frame-intent block contains mojibake token ${bad}`);
  assert(!interpretationBlock.includes(bad), `inputInterpretation frame-intent block contains mojibake token ${bad}`);
  assert(!labelBlock.includes(bad), `roomSurface frame-intent labels contain mojibake token ${bad}`);
}

for (const expected of ["辩论", "剧情", "阵营", "记住", "评判", "行动尝试", "调度请求"]) {
  assert(guards.includes(expected) || interpretation.includes(expected) || roomSurface.includes(expected), `expected readable Chinese marker ${expected}`);
}

for (const expected of ["覚えて", "기억", "merk dir", "запомни"]) {
  assert(interpretation.includes(expected), `expected readable multilingual marker ${expected}`);
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log("[frame-intent-mojibake] ok");
