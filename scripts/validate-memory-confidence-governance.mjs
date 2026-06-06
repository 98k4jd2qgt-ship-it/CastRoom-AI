import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const {
  InMemoryMemoryGraphRepository,
  memoryGraphClaimPromptUse,
  memoryGraphClaimTextForPrompt,
  shouldInjectMemoryGraphClaimIntoPrompt,
} = await loadMemoryGraphModule();

const failures = [];
const repo = new InMemoryMemoryGraphRepository();
const base = {
  scope: "room:confidence-room",
  kind: "item",
  subject: { kind: "room_participant", canonicalKey: "null-7", displayName: "Null-7" },
  predicate: "has_item",
  object: { kind: "item", canonicalKey: "key", displayName: "key" },
  text: "Null-7 has the key.",
  visibility: "public",
  authority: "character",
  sensitivity: "normal",
  source: {
    sourceScope: "room:confidence-room",
    excerpt: "Null-7 says it has the key.",
    createdAt: "2026-06-05T00:00:00.000Z",
  },
  conflictPolicy: "merge",
};

const highConfidenceClaim = repo.mergeClaimSync({
  ...base,
  confidence: 0.95,
  evidenceCount: 4,
  status: "active",
  epistemicStatus: "claimed",
});

expect(highConfidenceClaim.confidence >= 0.9, "fixture should be high confidence", failures);
expect(memoryGraphClaimPromptUse(highConfidenceClaim) === "none", "high confidence claimed memory must not become prompt fact", failures);
expect(!shouldInjectMemoryGraphClaimIntoPrompt(highConfidenceClaim), "high confidence claimed memory should be blocked by prompt boundary", failures);
expect(memoryGraphClaimTextForPrompt(highConfidenceClaim).startsWith("[claim]"), "claimed prompt text must be labelled if surfaced to governance/debug contexts", failures);

const confirmed = repo.mergeClaimSync({
  ...base,
  text: "The key is in the drawer.",
  subject: { kind: "item", canonicalKey: "key", displayName: "key" },
  predicate: "located_in",
  object: { kind: "location", canonicalKey: "drawer", displayName: "drawer" },
  confidence: 0.72,
  authority: "director",
  status: "active",
  epistemicStatus: "confirmed",
  conflictPolicy: "supersede",
});

expect(memoryGraphClaimPromptUse(confirmed) === "fact", "lower confidence Director confirmed memory can be used as fact", failures);
expect(shouldInjectMemoryGraphClaimIntoPrompt(confirmed), "confirmed memory should pass prompt boundary", failures);

if (failures.length > 0) {
  console.error(`validate-memory-confidence-governance failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-confidence-governance passed");
