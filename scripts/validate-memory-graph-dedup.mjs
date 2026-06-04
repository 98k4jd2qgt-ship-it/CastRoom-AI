import { expect, loadMemoryGraphModule } from "./memory-graph-validation-loader.mjs";

const { InMemoryMemoryGraphRepository } = await loadMemoryGraphModule();
const failures = [];

const repo = new InMemoryMemoryGraphRepository();

const baseClaim = {
  scope: "character:demo",
  kind: "preference",
  subject: { kind: "user", canonicalKey: "user", displayName: "User" },
  predicate: "prefers",
  object: { kind: "concept", canonicalKey: "67", displayName: "67" },
  text: "用户偏好：67。",
  visibility: "private_character",
  confidence: 0.9,
  authority: "user",
  sensitivity: "normal",
  source: {
    sourceScope: "character:demo",
    excerpt: "记住我喜好是67",
  },
  conflictPolicy: "merge",
};

repo.mergeClaimSync(baseClaim);
repo.mergeClaimSync({ ...baseClaim, source: { ...baseClaim.source, excerpt: "记住我喜好是67。" } });

const claims = repo.queryVisibleClaimsSync({
  scope: "character:demo",
  viewer: { type: "one_on_one", packId: "demo" },
  limit: 10,
});

expect(claims.length === 1, `duplicate claim should merge into one row, got ${claims.length}`, failures);
expect(claims[0]?.evidenceCount === 2, `merged claim evidence should be 2, got ${claims[0]?.evidenceCount}`, failures);
expect(claims[0]?.confidence >= 0.9, "merged claim should keep high confidence", failures);

if (failures.length > 0) {
  console.error(`Memory graph dedup validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Memory graph dedup validation passed.");
