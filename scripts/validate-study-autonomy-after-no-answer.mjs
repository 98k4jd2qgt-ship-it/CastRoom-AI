import fs from "node:fs";

const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const failures = [];

mustInclude(scheduler, 'mode === "study"', "study mode is considered");
mustInclude(scheduler, '"Offer a hint or one small explanation before waiting again."', "study hint default assumption");
mustInclude(scheduler, 'return "user_answer_expected";', "study wait maps to answer expected");
mustInclude(scheduler, 'blockingNeed === "user_answer_expected"', "answer expected has dedicated continuation handling");
mustInclude(copy, 'advancePolicy_continuous', "continuous policy copy exists");

if (failures.length) {
  console.error(`Study autonomy after no answer validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Study autonomy after no answer validation passed.");

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
