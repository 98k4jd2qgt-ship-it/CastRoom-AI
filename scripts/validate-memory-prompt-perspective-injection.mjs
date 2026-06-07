import fs from "node:fs";

const memoryGraphSource = fs.readFileSync("src/core/memoryGraph.ts", "utf8");
const memorySource = fs.readFileSync("src/core/memory.ts", "utf8");
const failures = [];

expect(memoryGraphSource.includes("memoryGraphClaimPromptUse"), "memory graph should classify prompt use separately from confidence");
expect(memoryGraphSource.includes('return "belief";'), "active claimed/believed memories should be injectable only as belief when allowed");
expect(memoryGraphSource.includes('epistemicStatus === "confirmed"'), "confirmed status should be supported for fact prompt use");
expect(memoryGraphSource.includes('if (claim.status !== "active")'), "non-active claims, including disputed/refuted/review, should be blocked from prompt injection");
expect(memoryGraphSource.includes("[claim]"), "claimed prompt text should keep source framing");
expect(memoryGraphSource.includes("[belief]"), "belief prompt text should keep perspective framing");
expect(memoryGraphSource.includes("[doubt]"), "doubt prompt text should keep uncertainty framing");
expect(memorySource.includes("queryVisibleClaimsSync"), "prompt memory should use viewer-aware graph claim queries");
expect(memorySource.includes("shouldInjectMemoryGraphClaimIntoPrompt"), "prompt memory should enforce graph injection boundary");

if (failures.length > 0) {
  console.error(`validate-memory-prompt-perspective-injection failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-prompt-perspective-injection passed");

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
