import fs from "node:fs";

const types = fs.readFileSync("src/core/types.ts", "utf8");
const scheduler = fs.readFileSync("src/core/roomScheduler.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const failures = [];

mustInclude(types, "export interface RoomResponseObligation", "response obligation type");
mustInclude(types, 'source: "user"', "user obligation source");
mustInclude(types, "responseObligation?: RoomResponseObligation", "schedule result carries obligation");
mustInclude(types, "lastResponseObligation?: RoomResponseObligation | null", "room keeps last obligation diagnosis");

mustInclude(scheduler, "function createResponseObligation", "obligation creator");
mustInclude(scheduler, 'input.trigger !== "user"', "only user messages create obligation");
mustInclude(scheduler, 'engagement?.kind !== "required"', "only required Room engagement creates obligation");
mustInclude(scheduler, "ensureScheduleResultHasOutcome", "schedule result outcome guard");
mustInclude(scheduler, "responseObligation: obligation", "schedule result records obligation");
mustInclude(scheduler, "resolveFallbackResponseAction", "fallback action resolver");

mustInclude(main, "responseObligation: result.responseObligation", "main records obligation diagnostics");
mustInclude(main, "result.pendingFollowup !== undefined", "main preserves scheduler follow-up");

if (failures.length) {
  console.error(`Room user response obligation validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room user response obligation validation passed.");

function mustInclude(text, marker, label) {
  if (!text.includes(marker)) {
    failures.push(`missing ${label}: ${marker}`);
  }
}
