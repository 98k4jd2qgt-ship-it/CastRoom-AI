import fs from "node:fs";

const uiSource = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const failures = [];

expect(uiSource.includes("graphScopes: MemoryScope[]"), "MemoryDashboardScope should carry merged graph scopes");
expect(uiSource.includes("graphScopes = uniqueMemoryScopes([participant.memoryScope, observerSnapshot.scope, factionSnapshot?.scope])"), "room role scope should merge public role, private observer, and faction scopes");
expect(uiSource.includes("dedupeMemoryGraphClaims(graphScopes.flatMap"), "merged role graph claims should be deduped across scopes");
expect(uiSource.includes("dedupeSemanticObservations(graphScopes.flatMap"), "merged role semantic observations should be deduped across scopes");
expect(uiSource.includes("return mergeMemoryGraphViews(graphScopes().map"), "graph view should merge multiple scopes before rendering");
expect(uiSource.includes('title: uiText(language, "Role perspectives"'), "memory tree should expose role perspectives group");
expect(uiSource.includes('if (node.kind === "room_role") {\n    return node.title;'), "room role tree leaves should show the role display name");
expect(!uiSource.includes('if (node.kind === "room_role") {\n    return uiText(language, "Role"'), "room role tree leaves must not collapse every role to a generic label");
expect(!uiSource.includes("function createObserverMemoryScope("), "old standalone observer scope factory should not remain");
expect(uiSource.includes('if (participant) {\n        continue;'), "legacy observer snapshots should be hidden when a matching role perspective exists");

if (failures.length > 0) {
  console.error(`validate-memory-role-view-merge failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-memory-role-view-merge passed");

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
