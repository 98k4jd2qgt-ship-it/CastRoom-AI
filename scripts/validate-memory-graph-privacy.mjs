import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const { InMemoryMemoryGraphRepository } = await loadMemoryGraphModule();
const failures = [];

const repo = new InMemoryMemoryGraphRepository();

repo.mergeClaimSync({
  scope: "room:mystery",
  kind: "secret",
  subject: { kind: "clue", canonicalKey: "side-door", displayName: "side door" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "kitchen", displayName: "kitchen" },
  text: "侧门钥匙在厨房。",
  visibility: "known_to_roles",
  knownToRoleIds: ["mio", "rin"],
  directorVisible: true,
  confidence: 0.8,
  authority: "character",
  sensitivity: "private",
  source: { sourceScope: "room:mystery:observer:mio", roomId: "mystery", participantId: "mio", excerpt: "钥匙在厨房" },
  conflictPolicy: "merge",
});

repo.mergeClaimSync({
  scope: "room:mystery",
  kind: "plan",
  subject: { kind: "faction", canonicalKey: "team-a", displayName: "Team A" },
  predicate: "has_goal",
  object: { kind: "goal", canonicalKey: "delay-vote", displayName: "delay vote" },
  text: "A 队准备拖延投票。",
  visibility: "faction",
  factionId: "team-a",
  directorVisible: true,
  confidence: 0.7,
  authority: "character",
  sensitivity: "private",
  source: { sourceScope: "room:mystery:faction:team-a", roomId: "mystery", factionId: "team-a", excerpt: "拖延投票" },
  conflictPolicy: "merge",
});

const publicClaims = repo.queryVisibleClaimsSync({
  scope: "room:mystery",
  viewer: { type: "room_public", roomId: "mystery" },
  limit: 10,
});
const mioClaims = repo.queryVisibleClaimsSync({
  scope: "room:mystery",
  viewer: { type: "room_role", roomId: "mystery", participantId: "mio", factionId: "team-a" },
  limit: 10,
});
const outsiderClaims = repo.queryVisibleClaimsSync({
  scope: "room:mystery",
  viewer: { type: "room_role", roomId: "mystery", participantId: "outsider", factionId: "team-b" },
  limit: 10,
});
const directorClaims = repo.queryVisibleClaimsSync({
  scope: "room:mystery",
  viewer: { type: "director", roomId: "mystery" },
  limit: 10,
});

expect(publicClaims.every((claim) => !claim.text.includes("厨房") && !claim.text.includes("拖延投票")), "public room query must not see private observer or faction claims", failures);
expect(mioClaims.some((claim) => claim.text.includes("厨房")), "known role should see observer claim", failures);
expect(mioClaims.some((claim) => claim.text.includes("拖延投票")), "same faction role should see faction claim", failures);
expect(outsiderClaims.every((claim) => !claim.text.includes("厨房") && !claim.text.includes("拖延投票")), "unrelated role must not see private/faction claims", failures);
expect(directorClaims.some((claim) => claim.text.includes("厨房")) && directorClaims.some((claim) => claim.text.includes("拖延投票")), "Director should see private and faction claims marked directorVisible", failures);

if (failures.length > 0) {
  console.error(`Memory graph privacy validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph privacy validation passed.");
