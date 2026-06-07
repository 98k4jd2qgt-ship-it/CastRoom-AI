import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

mustInclude("src/core/types.ts", [
  "RoomDirectorPrivateDirective",
  "RoomDirectorPublicTextReason",
  "privateDirectives?: RoomDirectorPrivateDirective[]",
  "publicTextReason?: RoomDirectorPublicTextReason",
]);

mustInclude("src/core/roomScheduler.ts", [
  "buildPrivateRoleDirective",
  "createDirectorPrivateDirectives",
  "directorPublicTextReason",
  "shouldCommitDirectorPublicText",
  "privateDirective",
  "shouldCommitDirectorPublicText(plan)",
  "publicTextReason: \"none\"",
  "isExplicitPublicDirectorTextRequest",
]);

mustInclude("src/core/roomScheduler.ts", [
  'target: "all"',
]);

mustNotIncludeInFunction("src/core/roomScheduler.ts", "createDirectorPrivateDirectives", [
  'type: "user"',
  "shouldTargetUserForDirectorDirective(",
]);

mustInclude("src/main.ts", [
  "injectPrivateDirectiveIntoRolePrompt",
  "roomPrivateDirectiveInline",
  "privateDirectives are private scheduling instructions",
  "shouldCommitDirectorPublicText(localPlan)",
  "shouldPreserveScheduledAllRoomTarget",
  "stripLeadingUserMentionFromRoomText",
  "sanitizeDirectorPrivateDirectives",
  "fallbackReason === \"none\"",
  "isPlannerLikeRoleOutput",
  "Room.role.plannerLikeBlocked",
]);

mustNotInclude("src/main.ts", [
  "publicText is shown in the room timeline. Write it as immersive narration or host speech, not as debug output.",
]);

if (failures.length > 0) {
  console.error("validate-director-private-directives failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-director-private-directives passed");

function mustInclude(relativePath, markers) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  for (const marker of markers) {
    if (!source.includes(marker)) {
      failures.push(`${relativePath} missing marker: ${marker}`);
    }
  }
}

function mustNotInclude(relativePath, markers) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  for (const marker of markers) {
    if (source.includes(marker)) {
      failures.push(`${relativePath} still includes retired marker: ${marker}`);
    }
  }
}

function mustNotIncludeInFunction(relativePath, functionName, markers) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  const fn = sliceFunction(source, functionName);
  for (const marker of markers) {
    if (fn.includes(marker)) {
      failures.push(`${relativePath} ${functionName} still includes retired marker: ${marker}`);
    }
  }
}

function sliceFunction(source, name) {
  const match = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`).exec(source);
  const start = match?.index ?? -1;
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const candidates = ["\nfunction ", "\nexport function ", "\nasync function ", "\ninterface "]
    .map((marker) => source.indexOf(marker, start + 1))
    .filter((index) => index >= 0);
  const next = candidates.length ? Math.min(...candidates) : -1;
  return next < 0 ? source.slice(start) : source.slice(start, next);
}
