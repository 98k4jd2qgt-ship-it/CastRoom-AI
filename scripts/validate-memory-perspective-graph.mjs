import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const {
  InMemoryMemoryGraphRepository,
  memoryGraphClaimPromptUse,
} = await loadMemoryGraphModule();

const failures = [];
const repo = new InMemoryMemoryGraphRepository();
const source = {
  sourceScope: "room:perspective",
  excerpt: "Archive-3 claims it has the key, but nobody has verified it.",
  createdAt: "2026-06-06T00:00:00.000Z",
};

const claim = repo.mergeClaimSync({
  scope: "room:perspective",
  kind: "item",
  subject: { kind: "room_participant", canonicalKey: "archive-3", displayName: "Archive-3" },
  predicate: "has_item",
  object: { kind: "item", canonicalKey: "key", displayName: "key" },
  text: "Archive-3 has the key.",
  visibility: "public",
  confidence: 0.74,
  authority: "character",
  sensitivity: "normal",
  source,
  conflictPolicy: "merge",
  status: "needs_review",
  epistemicStatus: "claimed",
  relationCategory: "cognition",
  reasonChain: [
    { type: "observation", text: "Archive-3 said it has the key." },
    { type: "interpretation", text: "The statement is a claim, not a verified world fact." },
  ],
});

const detailClaim = repo.mergeClaimSync({
  scope: "room:perspective",
  kind: "stance",
  subject: { kind: "room_participant", canonicalKey: "care-4", displayName: "Care-4" },
  predicate: "takes_stance",
  text: "Care-4 doubts Archive-3's claim about the key.",
  visibility: "public",
  confidence: 0.69,
  authority: "character",
  sensitivity: "normal",
  source: {
    ...source,
    excerpt: "Care-4 doubts Archive-3's claim about the key.",
  },
  conflictPolicy: "merge",
  status: "needs_review",
  epistemicStatus: "doubted",
  relationCategory: "cognition",
  reasonChain: [
    { type: "observation", text: "Care-4 challenged Archive-3's claim." },
    { type: "interpretation", text: "The challenge is a doubt from Care-4's perspective." },
  ],
});

expect(claim.epistemicStatus === "claimed", "perspective graph should preserve claimed truth status", failures);
expect(claim.relationCategory === "cognition", "claim should preserve relation category", failures);
expect(claim.reasonChain?.length === 2, "claim should preserve reason chain", failures);
expect(memoryGraphClaimPromptUse(claim) === "none", "unconfirmed claim should not be injected as a fact", failures);

const view = repo.queryGraphViewSync({
  scope: "room:perspective",
  viewer: { type: "room_public", roomId: "perspective" },
  includeNeedsReview: true,
  filters: { statuses: ["needs_review"] },
});
const detailNode = view.nodes.find((node) => node.sourceClaimId === detailClaim.id);
expect(detailNode?.epistemicStatus === "doubted", "claim detail node should expose epistemic status", failures);
expect(detailNode?.relationCategory === "cognition", "claim detail node should expose relation category", failures);
expect(detailNode?.reasonChain?.length === 2, "claim detail node should expose reason chain", failures);
expect(view.edges.some((edge) => edge.sourceClaimId === claim.id && edge.type === "CLAIMS"), "claimed relation should render as CLAIMS edge", failures);

if (failures.length > 0) {
  console.error(`validate-memory-perspective-graph failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-perspective-graph passed");
