import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

const main = read("src/main.ts");
const types = read("src/core/types.ts");
const roomSurface = read("src/ui/roomSurface.ts");

expect(main.includes("interface DirectorMemoryContext"), "main.ts should define DirectorMemoryContext for graph-first Director memory.");
expect(main.includes("async function queryDirectorMemoryContext"), "main.ts should query Director graph memory before Director turns.");
expect(main.includes("directorMemoryGraphScopes(room"), "Director graph memory query should derive room-only graph scopes.");
expect(main.includes("memoryGraphRepository.queryVisibleClaims"), "Director graph memory should use graph queryVisibleClaims.");
expect(main.includes('viewer: { type: "director", roomId: room.id }'), "Director graph query should use the director viewer.");
expect(main.includes("room.director.memoryScope"), "Director graph query should include the room system scope.");
expect(main.includes(":observer:"), "Director graph query should include observer/private room scopes.");
expect(main.includes(":faction:"), "Director graph query should include faction scopes.");
expect(!/directorMemoryGraphScopes[\s\S]{0,900}character:/.test(main), "Director graph scopes must not include one-on-one character memory.");
expect(main.includes("const directorMemoryContext = request.directorMemoryContext ?? await queryDirectorMemoryContext(request.room);"), "Director runtime should resolve graph memory before scheduling.");
expect(main.includes("directorMemory: directorMemoryContext.snapshot"), "Director scheduler should receive the graph-first snapshot.");
expect(main.includes("buildDirectorGraphMemoryBlock(request.directorMemoryContext)"), "Live Director prompt should include grouped graph memory.");
expect(main.indexOf("directorGraphMemoryBlock") < main.indexOf("`Director memory: ${JSON.stringify"), "Graph memory block should be injected before legacy Director memory JSON.");
expect(main.includes("directorMemoryInspectorPatch(directorMemoryContext)"), "Director turn should commit memory source diagnostics to Inspector state.");

expect(types.includes("directorMemorySource?:"), "RoomSimulationState should expose Director memory source diagnostics.");
expect(types.includes("directorMemoryLoadedClaims?:"), "RoomSimulationState should expose loaded graph claim count.");
expect(types.includes("directorMemoryHiddenClaims?:"), "RoomSimulationState should expose hidden graph claim count.");
expect(types.includes("directorMemoryDisputedClaims?:"), "RoomSimulationState should expose disputed graph claim count.");

expect(roomSurface.includes("directorMemorySource"), "Room Inspector should render Director memory source.");
expect(roomSurface.includes("directorMemoryLoadedClaims"), "Room Inspector should render loaded claim count.");
expect(roomSurface.includes("directorMemoryHiddenClaims"), "Room Inspector should render hidden claim count.");
expect(roomSurface.includes("directorMemoryDisputedClaims"), "Room Inspector should render disputed claim count.");

if (failures.length > 0) {
  console.error(`Director graph memory validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Director graph memory validation passed.");
