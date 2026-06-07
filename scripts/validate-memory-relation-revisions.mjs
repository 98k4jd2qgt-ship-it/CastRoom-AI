import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const { InMemoryMemoryGraphRepository } = await loadMemoryGraphModule();
const failures = [];
const repo = new InMemoryMemoryGraphRepository();
const baseSource = {
  sourceScope: "room:revision",
  excerpt: "Care-4 believed Archive-3 had the key.",
  createdAt: "2026-06-06T00:00:00.000Z",
};

const original = repo.mergeClaimSync({
  scope: "room:revision:observer:care-4",
  kind: "item",
  subject: { kind: "room_participant", canonicalKey: "care-4", displayName: "Care-4" },
  predicate: "believes_item",
  object: { kind: "item", canonicalKey: "key", displayName: "key" },
  text: "Care-4 believes Archive-3 has the key.",
  visibility: "known_to_roles",
  knownToRoleIds: ["care-4"],
  directorVisible: true,
  confidence: 0.68,
  authority: "character",
  sensitivity: "private",
  source: baseSource,
  conflictPolicy: "merge",
  status: "active",
  epistemicStatus: "believed",
  relationCategory: "cognition",
});

const revision = repo.mergeClaimSync({
  scope: "room:revision:observer:care-4",
  kind: "conflict",
  subject: { kind: "room_participant", canonicalKey: "care-4", displayName: "Care-4" },
  predicate: "doubts_item",
  text: "Care-4 now doubts that Archive-3 has the key.",
  visibility: "known_to_roles",
  knownToRoleIds: ["care-4"],
  directorVisible: true,
  confidence: 0.82,
  authority: "director",
  sensitivity: "private",
  source: {
    ...baseSource,
    excerpt: "Director confirmed the key is in a drawer.",
  },
  conflictPolicy: "dispute",
  status: "disputed",
  epistemicStatus: "doubted",
  relationCategory: "cognition",
  revisionOf: original.id,
  reasonChain: [
    { type: "observation", text: "Director confirmed conflicting evidence." },
    { type: "effect", text: "The old belief is now doubtful from Care-4's perspective." },
  ],
});

expect(revision.revisionOf === original.id, "revision relation should keep revisionOf pointer", failures);
expect(revision.status === "disputed", "revision should not silently overwrite the old belief", failures);
expect(revision.epistemicStatus === "doubted", "revision should keep doubted status", failures);

const view = repo.queryGraphViewSync({
  scope: "room:revision:observer:care-4",
  viewer: { type: "room_role", roomId: "revision", participantId: "care-4" },
  includeDisputed: true,
});
const revisionNode = view.nodes.find((node) => node.sourceClaimId === revision.id);
expect(revisionNode?.revisionOf === original.id, "view node should expose revisionOf", failures);
expect(view.edges.some((edge) => edge.type === "ASSERTED_BY" && edge.sourceClaimId === revision.id), "doubted revision without object should remain selectable as a claim node", failures);

if (failures.length > 0) {
  console.error(`validate-memory-relation-revisions failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-relation-revisions passed");
