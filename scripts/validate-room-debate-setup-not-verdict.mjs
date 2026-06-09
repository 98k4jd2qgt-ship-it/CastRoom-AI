import fs from "node:fs";

const debatePolicy = fs.readFileSync("src/core/debatePolicy.ts", "utf8");
const failures = [];

mustInclude("export function classifyDebateDirectorInput");
mustInclude('"strict_setup"');
mustInclude('"immediate_verdict"');
mustInclude('"deferred_verdict"');
mustInclude("isStrictDebateSetupText(text)");
mustInclude('classification === "strict_setup"');
mustInclude('classification === "immediate_verdict"');
mustInclude("inputClassification === \"strict_setup\"");
mustInclude("!options.forceFinal && inputClassification === \"strict_setup\"");
mustInclude("论赛配置");

const classifierFunction = sliceFunction("export function classifyDebateDirectorInput");
mustOrderIn(classifierFunction, "isStrictDebateSetupText(text)", '"strict_setup"');
mustOrderIn(classifierFunction, '"strict_setup"', "isDebateDeferredVerdictRequest(room, text)");
mustOrderIn(classifierFunction, '"deferred_verdict"', "isImmediateDebateVerdictText(compact)");
mustOrderIn(classifierFunction, "isImmediateDebateVerdictText(compact)", '"immediate_verdict"');

const verdictFunction = sliceFunction("export function createDebateDirectorVerdictOutcome");
if (!/inputClassification\s*===\s*"strict_setup"[\s\S]{0,120}return null/.test(verdictFunction)) {
  failures.push("createDebateDirectorVerdictOutcome must ignore strict setup unless forceFinal is set");
}
if (/finalVerdict\s*=\s*Boolean\(options\.forceFinal\)\s*\|\|\s*isDebateVerdictRequest/.test(verdictFunction)) {
  failures.push("verdict outcome must use unified input classification, not direct broad verdict detection");
}

const verdictRequestFunction = sliceFunction("export function isDebateVerdictRequest");
if (!/classification\s*===\s*"strict_setup"[\s\S]{0,120}return false/.test(verdictRequestFunction)) {
  failures.push("isDebateVerdictRequest must reject strict setup before judging verdict words");
}

if (failures.length > 0) {
  console.error("validate-room-debate-setup-not-verdict failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-room-debate-setup-not-verdict passed");

function mustInclude(marker) {
  if (!debatePolicy.includes(marker)) {
    failures.push(`missing marker: ${marker}`);
  }
}

function mustOrder(first, second) {
  const firstIndex = debatePolicy.indexOf(first);
  const secondIndex = debatePolicy.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    failures.push(`expected "${first}" before "${second}"`);
  }
}

function mustOrderIn(source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  if (firstIndex < 0 || secondIndex < 0 || firstIndex >= secondIndex) {
    failures.push(`expected classifier to check "${first}" before "${second}"`);
  }
}

function sliceFunction(marker) {
  const start = debatePolicy.indexOf(marker);
  if (start < 0) {
    return "";
  }
  const next = debatePolicy.indexOf("\nexport function ", start + marker.length);
  return debatePolicy.slice(start, next > start ? next : undefined);
}
