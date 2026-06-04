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
]);

mustInclude("src/main.ts", [
  "injectPrivateDirectiveIntoRolePrompt",
  "roomPrivateDirectiveInline",
  "privateDirectives are private scheduling instructions",
  "shouldCommitDirectorPublicText(localPlan)",
  "sanitizeDirectorPrivateDirectives",
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
