import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const { InMemoryMemoryGraphRepository } = await loadMemoryGraphModule();
const failures = [];

const repo = new InMemoryMemoryGraphRepository();

const normal = repo.mergeClaimSync({
  scope: "room:debate-room",
  kind: "judgement",
  subject: { kind: "room", canonicalKey: "debate-room", displayName: "Debate Room" },
  predicate: "won",
  object: { kind: "faction", canonicalKey: "team-a", displayName: "Team A" },
  text: "A 队暂时占优。",
  visibility: "public",
  confidence: 0.55,
  authority: "character",
  sensitivity: "normal",
  source: { sourceScope: "room:debate-room", excerpt: "A 队暂时占优。" },
  conflictPolicy: "merge",
});

const developer = repo.mergeClaimSync({
  scope: "room:debate-room",
  kind: "judgement",
  subject: { kind: "room", canonicalKey: "debate-room", displayName: "Debate Room" },
  predicate: "won",
  object: { kind: "faction", canonicalKey: "team-b", displayName: "Team B" },
  text: "开发者确认：B 队获胜。",
  visibility: "public",
  confidence: 0.4,
  authority: "developer",
  sensitivity: "normal",
  source: { sourceScope: "room:debate-room", excerpt: "B 队赢了" },
  conflictPolicy: "supersede",
});

const visible = repo.queryVisibleClaimsSync({
  scope: "room:debate-room",
  viewer: { type: "room_public", roomId: "debate-room" },
  limit: 10,
});

expect(developer.confidence === 1, `developer confidence should be 1.0, got ${developer.confidence}`, failures);
expect(developer.authority === "developer", "developer authority should be preserved", failures);
expect(developer.status === "active", `developer claim should stay active, got ${developer.status}`, failures);
expect(repo.listAllClaimsSync("room:debate-room").some((claim) => claim.id === normal.id && claim.status === "superseded"), "developer supersede should mark previous active judgement superseded", failures);
expect(visible.some((claim) => claim.id === developer.id), "developer active claim should be visible", failures);

if (failures.length > 0) {
  console.error(`Memory developer authority validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory developer authority validation passed.");
