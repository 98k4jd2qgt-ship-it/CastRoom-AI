import fs from "node:fs";

const failures = [];
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const guards = fs.readFileSync("src/core/roomRuleGuards.ts", "utf8");

const narration = sliceFunction(scheduler, "createDirectorTickNarration");
const publicGate = sliceFunction(scheduler, "containsDirectorBackstageLeakText");

mustInclude(
  guards,
  "function roleMessageMayNeedPublicRuling",
  "concrete role action precheck exists",
);
mustInclude(
  guards,
  "looksLikeCasualActionQuestion(text)",
  "casual questions are excluded from role public rulings",
);
mustInclude(
  guards,
  "ROOM_FACT_REWRITE_PATTERN.test(text)",
  "fact rewrite claims can still reach Director ruling",
);
mustInclude(
  guards,
  "ROOM_FACT_REWRITE_CN_PATTERN.test(text)",
  "Chinese fact rewrite claims can still reach Director ruling",
);
mustNotInclude(
  narration,
  "The attempted action changes the room's attention",
  "generic attempted-action public ruling text",
);
mustInclude(
  publicGate,
  "\\battempted\\s+action\\b",
  "public output gate blocks attempted-action status text",
);
mustInclude(
  publicGate,
  "needs\\s+a\\s+clear\\s+ruling\\s+before\\s+it\\s+becomes\\s+fact",
  "public output gate blocks needs-ruling status text",
);

if (failures.length) {
  console.error(`Director concrete action ruling validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Director concrete action ruling validation passed.");

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
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
