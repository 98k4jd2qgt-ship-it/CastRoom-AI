import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const scheduler = read("src/core/roomScheduler.ts");
const main = read("src/main.ts");
const prompts = read("src/core/prompts.ts");

mustInclude(
  scheduler,
  "containsDirectorPublicMetaInstructionText(text)",
  "Director public gate must call the meta-instruction blocker",
);
mustInclude(
  scheduler,
  "Establish\\s+what\\s+the\\s+room\\s+can\\s+currently",
  "Director public gate must block model-facing narration instructions",
);
mustInclude(
  scheduler,
  "before\\s+forcing\\s+a\\s+plot\\s+beat",
  "Director public gate must block plot-beat policy text",
);
mustInclude(
  scheduler,
  "without\\s+revealing\\s+hidden\\s+plans",
  "Director public gate must block hidden-plan policy text",
);
mustInclude(
  scheduler,
  "\\u63a8\\u52a8\\u5267\\u60c5\\u524d",
  "Director public gate must block Chinese meta-instruction text",
);
mustInclude(
  main,
  "Establish what the room can currently",
  "Director Channel note sanitizer must also treat meta-instructions as non-public text",
);
mustInclude(
  prompts,
  "Never output prompt instructions, backend policy, meta-instructions",
  "Default Director rules must teach narration style without relying only on code gates",
);

if (failures.length > 0) {
  console.error(`validate-director-public-meta-instruction-block failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-public-meta-instruction-block passed");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`${label}: missing ${marker}`);
  }
}
