import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const failures = [];

mustInclude(scheduler, 'mode === "planning"', "planning mode is considered");
mustInclude(scheduler, '"Use a reversible low-cost assumption and surface it for confirmation."', "planning low-cost assumption");
mustInclude(scheduler, 'return "recap";', "planning can continue with recap/default proposal");
mustInclude(scheduler, 'return "missing_context";', "planning wait maps to missing context");
mustInclude(copy, 'advancePolicy_fill_gap', "UI copy exists for fill-gap policy");

if (failures.length) {
  console.error(`Planning delegated continuation validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Planning delegated continuation validation passed.");

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
