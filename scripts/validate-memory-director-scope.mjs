import fs from "node:fs";

const uiSource = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const memoryGraphSource = fs.readFileSync("src/core/memoryGraph.ts", "utf8");
const failures = [];

expect(uiSource.includes("function createDirectorMemoryScope"), "Memory module should keep Director as a memory scope");
expect(uiSource.includes("directorGraphViewer(room)"), "Director scope should use director viewer context");
expect(uiSource.includes('type: "director"'), "Director viewer context should exist");
expect(uiSource.includes('kind: "director"'), "Director memory scope should be typed as director");
expect(!uiSource.includes("Director Graph"), "implementation should not add a separate Director Graph page");
expect(memoryGraphSource.includes('type: "director"; roomId: string'), "memory graph query context should model Director as a viewer");
expect(memoryGraphSource.includes("directorVisible"), "Director visibility should remain explicit on claims");

if (failures.length > 0) {
  console.error(`validate-memory-director-scope failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-director-scope passed");

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
