import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const {
  InMemoryMemoryGraphRepository,
  memoryGraphClaimEpistemicStatus,
  memoryGraphClaimPromptUse,
  shouldInjectMemoryGraphClaimIntoPrompt,
} = await loadMemoryGraphModule();

const failures = [];
const repo = new InMemoryMemoryGraphRepository();
const source = {
  sourceScope: "room:test",
  excerpt: "Archive-3 says the key is in its hand.",
  createdAt: "2026-06-05T00:00:00.000Z",
};

const claimed = repo.mergeClaimSync({
  scope: "room:test",
  kind: "item",
  subject: { kind: "room_participant", canonicalKey: "archive-3", displayName: "Archive-3" },
  predicate: "has_item",
  object: { kind: "item", canonicalKey: "key", displayName: "key" },
  text: "Archive-3 has the key.",
  visibility: "public",
  confidence: 0.86,
  authority: "character",
  sensitivity: "normal",
  source,
  conflictPolicy: "merge",
  status: "needs_review",
  epistemicStatus: "claimed",
  properties: { sourceSpeaker: "Archive-3" },
});

expect(memoryGraphClaimEpistemicStatus(claimed) === "claimed", "character statement should stay claimed", failures);
expect(memoryGraphClaimPromptUse(claimed) === "none", "claimed memory should not be used as prompt fact", failures);
expect(!shouldInjectMemoryGraphClaimIntoPrompt(claimed), "claimed memory should not pass prompt injection boundary", failures);

const believed = repo.mergeClaimSync({
  scope: "room:test:observer:care-4",
  kind: "item",
  subject: { kind: "room_participant", canonicalKey: "care-4", displayName: "Care-4" },
  predicate: "believes_item",
  object: { kind: "item", canonicalKey: "key", displayName: "key" },
  text: "Archive-3 has the key.",
  visibility: "known_to_roles",
  knownToRoleIds: ["care-4"],
  directorVisible: true,
  confidence: 0.78,
  authority: "character",
  sensitivity: "private",
  source: { ...source, sourceScope: "room:test:observer:care-4" },
  conflictPolicy: "merge",
  status: "active",
  epistemicStatus: "believed",
});

expect(memoryGraphClaimEpistemicStatus(believed) === "believed", "role-local belief should keep believed truth status", failures);
expect(memoryGraphClaimPromptUse(believed) === "belief", "active belief should be injectable only as belief", failures);
expect(shouldInjectMemoryGraphClaimIntoPrompt(believed), "active belief should pass prompt boundary as belief", failures);

const confirmed = repo.mergeClaimSync({
  scope: "room:test:system",
  kind: "item",
  subject: { kind: "item", canonicalKey: "key", displayName: "key" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "drawer", displayName: "drawer" },
  text: "The key is in the drawer.",
  visibility: "director_only",
  directorVisible: true,
  confidence: 0.92,
  authority: "director",
  sensitivity: "private",
  source: { ...source, sourceScope: "room:test:system", excerpt: "Director ruling: key is in the drawer." },
  conflictPolicy: "supersede",
  status: "active",
  epistemicStatus: "confirmed",
});

expect(memoryGraphClaimEpistemicStatus(confirmed) === "confirmed", "Director ruling should be confirmed", failures);
expect(memoryGraphClaimPromptUse(confirmed) === "fact", "Director confirmed memory should be prompt fact for authorized viewers", failures);

const publicClaims = repo.queryVisibleClaimsSync({
  scope: "room:test",
  viewer: { type: "room_public", roomId: "test" },
  includeNeedsReview: true,
});
expect(publicClaims.some((claim) => claim.id === claimed.id), "public view should show public claimed memory for governance", failures);
expect(publicClaims.every((claim) => claim.id !== confirmed.id), "public room view must not see director-only fact", failures);

const view = repo.queryGraphViewSync({
  scope: "room:test",
  viewer: { type: "room_public", roomId: "test" },
  filters: { epistemicStatuses: ["claimed"] },
});
expect(view.edges.some((edge) => edge.type === "CLAIMS" && edge.sourceClaimId === claimed.id), "graph view should expose claimed memory as a CLAIMS relationship", failures);

if (failures.length > 0) {
  console.error(`validate-memory-belief-status failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-belief-status passed");
