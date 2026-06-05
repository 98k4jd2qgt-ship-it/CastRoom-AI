import { invoke } from "@tauri-apps/api/core";
import type { CompressedMemoryEntry, MemoryAtomKind, MemoryScope, MemorySensitivity } from "./types";

export type MemoryGraphNodeKind =
  | "user"
  | "character_pack"
  | "room_participant"
  | "room"
  | "director"
  | "faction"
  | "item"
  | "location"
  | "clue"
  | "goal"
  | "concept"
  | "event"
  | "unknown";

export type MemoryGraphClaimKind =
  | "preference"
  | "fact"
  | "relationship"
  | "plan"
  | "constraint"
  | "scene"
  | "item"
  | "clue"
  | "stance"
  | "argument"
  | "task"
  | "conflict"
  | "judgement"
  | "secret"
  | "identity"
  | "goal";

export type MemoryGraphClaimStatus = "active" | "needs_review" | "disputed" | "superseded" | "archived" | "rejected";
export type MemoryGraphAuthority = "user" | "developer" | "director" | "character" | "system" | "imported";
export type MemoryGraphVisibility = "public" | "known_to_roles" | "faction" | "director_only" | "private_character" | "global";
export type MemoryGraphGovernanceMode = "browse" | "conflicts" | "duplicates" | "visibility" | "quality";
export type MemoryGraphIssueKind = "conflict" | "duplicate" | "visibility_leak" | "low_quality" | "orphan";
export type MemoryGraphIssueSeverity = "info" | "warn" | "error";

export interface MemoryGraphNode {
  id: string;
  scope: MemoryScope;
  kind: MemoryGraphNodeKind;
  canonicalKey: string;
  displayName: string;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryEntityRef {
  id?: string;
  scope?: MemoryScope;
  kind: MemoryGraphNodeKind;
  canonicalKey: string;
  displayName: string;
  properties?: Record<string, unknown>;
}

export interface MemorySourceInput {
  messageId?: string;
  sourceScope: MemoryScope;
  roomId?: string;
  participantId?: string;
  factionId?: string;
  speakerId?: string;
  speakerType?: string;
  sourceTextHash?: string;
  excerpt: string;
  createdAt?: string;
}

export interface MemoryClaimInput {
  id?: string;
  scope: MemoryScope;
  kind: MemoryGraphClaimKind;
  subject: MemoryEntityRef;
  predicate: string;
  object?: MemoryEntityRef;
  text: string;
  visibility: MemoryGraphVisibility;
  knownToRoleIds?: string[];
  factionId?: string;
  directorVisible?: boolean;
  confidence: number;
  authority: MemoryGraphAuthority;
  sensitivity: MemorySensitivity;
  source: MemorySourceInput;
  conflictPolicy: "merge" | "dispute" | "supersede";
  status?: MemoryGraphClaimStatus;
  evidenceCount?: number;
  properties?: Record<string, unknown>;
}

export interface MemoryGraphClaim {
  id: string;
  scope: MemoryScope;
  kind: MemoryGraphClaimKind;
  subjectNodeId: string;
  predicate: string;
  objectNodeId?: string;
  text: string;
  canonicalKey: string;
  status: MemoryGraphClaimStatus;
  confidence: number;
  authority: MemoryGraphAuthority;
  sensitivity: MemorySensitivity;
  visibility: MemoryGraphVisibility;
  evidenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  version: number;
  properties: Record<string, unknown>;
}

export interface MemoryGraphEdgeInput {
  scope: MemoryScope;
  fromNodeId: string;
  type:
    | "ABOUT"
    | "KNOWN_BY"
    | "ASSERTED_BY"
    | "SUPPORTS"
    | "CONFLICTS_WITH"
    | "SUPERSEDES"
    | "MEMBER_OF"
    | "HAS_GOAL"
    | "OWNS"
    | "LOCATED_IN"
    | "TARGETS"
    | "MENTIONS";
  toNodeId: string;
  confidence: number;
  visibility: MemoryGraphVisibility;
  properties?: Record<string, unknown>;
}

export interface MemoryGraphEdge extends MemoryGraphEdgeInput {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryGraphQueryContext {
  scope: MemoryScope;
  viewer:
    | { type: "one_on_one"; packId: string }
    | { type: "room_public"; roomId: string }
    | { type: "room_role"; roomId: string; participantId: string; factionId?: string }
    | { type: "room_faction"; roomId: string; factionId: string }
    | { type: "director"; roomId: string }
    | { type: "global" };
  localModel?: boolean;
  kinds?: MemoryGraphClaimKind[];
  limit?: number;
  includeDisputed?: boolean;
  includeNeedsReview?: boolean;
}

export interface MemoryGraphNeighborContext extends MemoryGraphQueryContext {
  nodeId: string;
  maxNodes?: number;
  filters?: MemoryGraphFilters;
  includeDisputed?: boolean;
  includeArchived?: boolean;
  redactPrivate?: boolean;
}

export interface MemoryGraphFilters {
  search?: string;
  scopes?: MemoryScope[];
  kinds?: MemoryGraphClaimKind[];
  statuses?: MemoryGraphClaimStatus[];
  visibilities?: MemoryGraphVisibility[];
}

export interface MemoryGraphViewNode {
  id: string;
  kind: "scope" | "entity" | "claim" | "issue" | "group";
  label: string;
  subtitle: string;
  scope: MemoryScope;
  entityRole?: "subject" | "object" | "related";
  nodeKind?: MemoryGraphNodeKind;
  claimKind?: MemoryGraphClaimKind;
  status?: MemoryGraphClaimStatus;
  visibility?: MemoryGraphVisibility;
  authority?: MemoryGraphAuthority;
  confidence?: number;
  evidenceCount?: number;
  text?: string;
  redacted?: boolean;
  sourceClaimId?: string;
  sourceIssueId?: string;
  sourceClaimIds?: string[];
  groupKind?: "judgement" | "continuity" | "hidden" | "faction_strategy" | "conflict" | "quality" | "fact";
  groupCount?: number;
  nodeCaption?: string;
  semanticKind?: string;
  categoryGroup?: string;
  relationshipType?: string;
  graphSyncState?: "ready" | "fallback" | "unsynced";
}

export interface MemoryGraphViewEdge {
  id: string;
  from: string;
  to: string;
  type: "ABOUT" | "KNOWN_BY" | "ASSERTED_BY" | "CONFLICTS_WITH" | "SUPERSEDES" | "MEMBER_OF" | "HAS_GOAL" | "OWNS" | "LOCATED_IN" | "TARGETS" | "SUPPORTS" | "MENTIONS";
  label: string;
  visibility: MemoryGraphVisibility;
  dashed?: boolean;
  sourceClaimId?: string;
}

export interface MemoryGraphViewModel {
  nodes: MemoryGraphViewNode[];
  edges: MemoryGraphViewEdge[];
  selectedNodeId?: string;
  filters: MemoryGraphFilters;
  mode?: MemoryGraphGovernanceMode;
  issues?: MemoryGraphIssue[];
  truncated?: boolean;
  hiddenPrivateCount?: number;
  visibleClaimCount?: number;
  modeClaimCount?: number;
  pendingReviewCount?: number;
}

export type MemoryGraphViewContext = MemoryGraphQueryContext & {
  maxNodes?: number;
  includeArchived?: boolean;
  redactPrivate?: boolean;
  filters?: MemoryGraphFilters;
  expandedNodeIds?: string[];
  mode?: MemoryGraphGovernanceMode;
};

export interface MemoryGraphIssue {
  id: string;
  kind: MemoryGraphIssueKind;
  severity: MemoryGraphIssueSeverity;
  claimIds: string[];
  summary: string;
}

export interface MemoryGraphMergeClaimsInput {
  winnerClaimId: string;
  duplicateClaimIds: string[];
  changedBy?: string;
}

export interface MemoryGraphVisibilityPatch {
  claimId: string;
  visibility: MemoryGraphVisibility;
  knownToRoleIds?: string[];
  factionId?: string;
  directorVisible?: boolean;
  changedBy?: string;
}

export interface MemoryGraphQualityArchiveInput {
  claimIds?: string[];
  scope?: MemoryScope;
  changedBy?: string;
}

export interface Neo4jGraphExport {
  nodes: unknown[];
  relationships: unknown[];
}

export interface MemoryGraphClaimPatch {
  claimId: string;
  text?: string;
  kind?: MemoryGraphClaimKind;
  predicate?: string;
  status?: MemoryGraphClaimStatus;
  confidence?: number;
  visibility?: MemoryGraphVisibility;
  authority?: MemoryGraphAuthority;
  sensitivity?: MemorySensitivity;
  properties?: Record<string, unknown>;
  changedBy?: string;
}

export interface MemoryGraphConflictResolutionInput {
  winnerClaimId: string;
  loserClaimIds: string[];
  action: "supersede" | "archive" | "dispute";
  changedBy?: string;
}

export interface MemoryGraphRepository {
  migrate(): Promise<void>;
  upsertNode(input: MemoryEntityRef & { scope: MemoryScope }): Promise<MemoryGraphNode>;
  mergeClaim(input: MemoryClaimInput): Promise<MemoryGraphClaim>;
  addEdge(input: MemoryGraphEdgeInput): Promise<MemoryGraphEdge>;
  updateClaim(patch: MemoryGraphClaimPatch): Promise<MemoryGraphClaim>;
  createClaim(input: MemoryClaimInput): Promise<MemoryGraphClaim>;
  createEdge(input: MemoryGraphEdgeInput): Promise<MemoryGraphEdge>;
  deleteEdge(edgeId: string): Promise<void>;
  resolveConflict(input: MemoryGraphConflictResolutionInput): Promise<void>;
  queryVisibleClaims(context: MemoryGraphQueryContext): Promise<MemoryGraphClaim[]>;
  queryGraphView(context: MemoryGraphViewContext): Promise<MemoryGraphViewModel>;
  queryNeighbors(context: MemoryGraphNeighborContext): Promise<MemoryGraphViewModel>;
  queryConflicts(scope: MemoryScope, claimId: string): Promise<MemoryGraphClaim[]>;
  queryIssues(context: MemoryGraphViewContext): Promise<MemoryGraphIssue[]>;
  mergeClaims(input: MemoryGraphMergeClaimsInput): Promise<MemoryGraphClaim>;
  mergeDuplicates(input: MemoryGraphMergeClaimsInput): Promise<MemoryGraphClaim>;
  updateVisibility(input: MemoryGraphVisibilityPatch): Promise<MemoryGraphClaim>;
  fixVisibility(input: MemoryGraphVisibilityPatch): Promise<MemoryGraphClaim>;
  archiveLowQuality(input: MemoryGraphQualityArchiveInput): Promise<void>;
  markSuperseded(oldClaimId: string, newClaimId: string): Promise<void>;
  markDisputed(claimIds: string[], reason: string): Promise<void>;
  archiveClaim(claimId: string): Promise<void>;
  deleteClaim(claimId: string): Promise<void>;
  deleteScope(scope: MemoryScope): Promise<void>;
  exportNeo4jGraph(scope?: MemoryScope): Promise<Neo4jGraphExport>;
}

export class InMemoryMemoryGraphRepository implements MemoryGraphRepository {
  private readonly nodes = new Map<string, MemoryGraphNode>();
  private readonly nodeKeys = new Map<string, string>();
  private readonly claims = new Map<string, MemoryGraphClaim>();
  private readonly claimKeys = new Map<string, string>();
  private readonly edges = new Map<string, MemoryGraphEdge>();
  private readonly visibility = new Map<string, { roleIds: Set<string>; factionId?: string; directorVisible: boolean }>();

  clearSync(): void {
    this.nodes.clear();
    this.nodeKeys.clear();
    this.claims.clear();
    this.claimKeys.clear();
    this.edges.clear();
    this.visibility.clear();
  }

  async migrate(): Promise<void> {
    return undefined;
  }

  async upsertNode(input: MemoryEntityRef & { scope: MemoryScope }): Promise<MemoryGraphNode> {
    return this.upsertNodeSync(input);
  }

  upsertNodeSync(input: MemoryEntityRef & { scope: MemoryScope }): MemoryGraphNode {
    const now = new Date().toISOString();
    const key = nodeUniqueKey(input.scope, input.kind, input.canonicalKey);
    const existingId = this.nodeKeys.get(key);
    const id = existingId ?? input.id ?? stableMemoryGraphId("node", key);
    const node: MemoryGraphNode = {
      id,
      scope: input.scope,
      kind: input.kind,
      canonicalKey: input.canonicalKey,
      displayName: input.displayName,
      properties: input.properties ?? {},
      createdAt: existingId ? (this.nodes.get(existingId)?.createdAt ?? now) : now,
      updatedAt: now,
    };
    this.nodes.set(id, node);
    this.nodeKeys.set(key, id);
    return node;
  }

  async mergeClaim(input: MemoryClaimInput): Promise<MemoryGraphClaim> {
    return this.mergeClaimSync(input);
  }

  mergeClaimSync(input: MemoryClaimInput): MemoryGraphClaim {
    if (!input.text.trim()) {
      throw new Error("Memory graph claim text is missing.");
    }
    const now = new Date().toISOString();
    const subject = this.upsertNodeSync({ ...input.subject, scope: input.subject.scope ?? input.scope });
    const object = input.object ? this.upsertNodeSync({ ...input.object, scope: input.object.scope ?? input.scope }) : undefined;
    const canonicalKey = canonicalMemoryGraphClaimKey(input);
    const visibility = input.visibility;
    const uniqueKey = claimUniqueKey(input.scope, canonicalKey, visibility);
    const existingId = this.claimKeys.get(uniqueKey);
    const existing = existingId ? this.claims.get(existingId) : undefined;
    const developerOverride = input.authority === "developer";
    const confidence = developerOverride ? 1 : clamp(input.confidence, 0, 1);
    const id = existing?.id ?? input.id ?? stableMemoryGraphId("claim", uniqueKey);
    const claim: MemoryGraphClaim = {
      id,
      scope: input.scope,
      kind: input.kind,
      subjectNodeId: subject.id,
      predicate: input.predicate,
      objectNodeId: object?.id,
      text: input.text.trim(),
      canonicalKey,
      status: developerOverride ? "active" : (input.status ?? existing?.status ?? "active"),
      confidence: Math.max(existing?.confidence ?? 0, confidence),
      authority: developerOverride ? "developer" : (existing?.authority ?? input.authority),
      sensitivity: input.sensitivity,
      visibility,
      evidenceCount: (existing?.evidenceCount ?? 0) + Math.max(1, input.evidenceCount ?? 1),
      firstSeenAt: existing?.firstSeenAt ?? input.source.createdAt ?? now,
      lastSeenAt: input.source.createdAt ?? now,
      version: (existing?.version ?? 0) + 1,
      properties: input.properties ?? existing?.properties ?? {},
    };
    this.claims.set(id, claim);
    this.claimKeys.set(uniqueKey, id);
    this.visibility.set(id, {
      roleIds: new Set(input.knownToRoleIds ?? []),
      factionId: input.factionId,
      directorVisible: Boolean(input.directorVisible),
    });
    if (input.conflictPolicy === "supersede" || developerOverride) {
      this.supersedeConflictingClaims(claim);
    } else if (input.conflictPolicy === "dispute") {
      this.disputeConflictingClaims(claim);
    }
    return claim;
  }

  async addEdge(input: MemoryGraphEdgeInput): Promise<MemoryGraphEdge> {
    const now = new Date().toISOString();
    const id = stableMemoryGraphId("edge", `${input.scope}:${input.fromNodeId}:${input.type}:${input.toNodeId}:${input.visibility}`);
    const existing = this.edges.get(id);
    const edge: MemoryGraphEdge = {
      ...input,
      id,
      confidence: Math.max(existing?.confidence ?? 0, input.confidence),
      properties: input.properties ?? existing?.properties ?? {},
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.edges.set(id, edge);
    return edge;
  }

  async updateClaim(patch: MemoryGraphClaimPatch): Promise<MemoryGraphClaim> {
    const existing = this.claims.get(patch.claimId);
    if (!existing) {
      throw new Error(`Memory graph claim not found: ${patch.claimId}`);
    }
    const next: MemoryGraphClaim = {
      ...existing,
      text: patch.text?.trim() || existing.text,
      kind: patch.kind ?? existing.kind,
      predicate: patch.predicate?.trim() || existing.predicate,
      status: patch.status ?? existing.status,
      confidence: patch.confidence === undefined ? existing.confidence : clamp(patch.confidence, 0, 1),
      visibility: patch.visibility ?? existing.visibility,
      authority: patch.authority ?? existing.authority,
      sensitivity: patch.sensitivity ?? existing.sensitivity,
      properties: patch.properties ?? existing.properties,
      lastSeenAt: new Date().toISOString(),
      version: existing.version + 1,
    };
    this.claims.set(next.id, next);
    return next;
  }

  async createClaim(input: MemoryClaimInput): Promise<MemoryGraphClaim> {
    return this.mergeClaim(input);
  }

  async createEdge(input: MemoryGraphEdgeInput): Promise<MemoryGraphEdge> {
    return this.addEdge(input);
  }

  async deleteEdge(edgeId: string): Promise<void> {
    this.edges.delete(edgeId);
  }

  async resolveConflict(input: MemoryGraphConflictResolutionInput): Promise<void> {
    const winner = this.claims.get(input.winnerClaimId);
    if (winner) {
      this.claims.set(winner.id, { ...winner, status: "active", version: winner.version + 1 });
    }
    for (const loserId of input.loserClaimIds) {
      const loser = this.claims.get(loserId);
      if (!loser) {
        continue;
      }
      const status: MemoryGraphClaimStatus =
        input.action === "archive" ? "archived" : input.action === "dispute" ? "disputed" : "superseded";
      this.claims.set(loser.id, { ...loser, status, version: loser.version + 1 });
      if (winner && input.action === "supersede") {
        await this.addEdge({
          scope: winner.scope,
          fromNodeId: winner.subjectNodeId,
          type: "SUPERSEDES",
          toNodeId: loser.subjectNodeId,
          confidence: 1,
          visibility: winner.visibility,
        });
      }
    }
  }

  async queryVisibleClaims(context: MemoryGraphQueryContext): Promise<MemoryGraphClaim[]> {
    return this.queryVisibleClaimsSync(context);
  }

  async queryGraphView(context: MemoryGraphViewContext): Promise<MemoryGraphViewModel> {
    return this.queryGraphViewSync(context);
  }

  async queryNeighbors(context: MemoryGraphNeighborContext): Promise<MemoryGraphViewModel> {
    return this.queryGraphViewSync({ ...context, expandedNodeIds: [context.nodeId] });
  }

  queryVisibleClaimsSync(context: MemoryGraphQueryContext): MemoryGraphClaim[] {
    const limit = context.limit ?? (context.localModel ? 3 : 12);
    return [...this.claims.values()]
      .filter((claim) => claim.scope === context.scope)
      .filter((claim) =>
        claim.status === "active" ||
        (context.includeDisputed && claim.status === "disputed") ||
        (context.includeNeedsReview && claim.status === "needs_review")
      )
      .filter((claim) => !context.kinds || context.kinds.includes(claim.kind))
      .filter((claim) => this.canViewerReadClaim(claim, context))
      .sort((left, right) => memoryGraphPromptScore(right) - memoryGraphPromptScore(left))
      .slice(0, limit);
  }

  queryGraphViewSync(context: MemoryGraphViewContext): MemoryGraphViewModel {
    const filters = context.filters ?? {};
    const includeArchived = context.includeArchived ?? false;
    const maxNodes = clamp(context.maxNodes ?? 120, 12, 500);
    const expandedNodeIds = new Set(context.expandedNodeIds ?? []);
    const mode = context.mode ?? "browse";
    const visibleClaims = [...this.claims.values()]
      .filter((claim) => claim.scope === context.scope)
      .filter((claim) => includeArchived || (claim.status !== "archived" && claim.status !== "rejected"))
      .filter((claim) => this.canViewerReadClaim(claim, context))
      .filter((claim) =>
        matchesMemoryGraphFilters(claim, filters, this.nodes.get(claim.subjectNodeId), claim.objectNodeId ? this.nodes.get(claim.objectNodeId) : undefined) ||
        isMemoryGraphClaimConnectedToExpandedNode(claim, expandedNodeIds)
      )
      .sort((left, right) => memoryGraphPromptScore(right) - memoryGraphPromptScore(left));
    const pendingReviewCount = visibleClaims.filter((claim) => claim.status === "needs_review").length;
    const issues = buildMemoryGraphIssues(visibleClaims, (id) => this.nodes.get(id));
    const visibleIssueClaimIds = memoryGraphIssueClaimIdsForMode(issues, mode);
    const modeClaims =
      mode === "browse"
        ? visibleClaims
        : visibleClaims.filter((claim) => visibleIssueClaimIds.has(claim.id) || isMemoryGraphClaimConnectedToExpandedNode(claim, expandedNodeIds));
    const hiddenPrivateCount = [...this.claims.values()]
      .filter((claim) => claim.scope === context.scope)
      .filter((claim) => isPrivateMemoryGraphVisibility(claim.visibility))
      .filter((claim) => !this.canViewerReadClaim(claim, context)).length;
    return buildMemoryGraphViewModel({
      claims: modeClaims,
      edges: [...this.edges.values()].filter((edge) => edge.scope === context.scope),
      nodeById: (id) => this.nodes.get(id),
      filters,
      mode,
      issues,
      maxNodes,
      hiddenPrivateCount,
      visibleClaimCount: visibleClaims.length,
      modeClaimCount: modeClaims.length,
      pendingReviewCount,
    });
  }

  listAllClaimsSync(scope?: string): MemoryGraphClaim[] {
    return [...this.claims.values()].filter((claim) => !scope || claim.scope === scope);
  }

  listClaimInputsSync(scope?: MemoryScope): MemoryClaimInput[] {
    return [...this.claims.values()]
      .filter((claim) => !scope || claim.scope === scope)
      .map((claim) => this.claimToInputSync(claim))
      .filter((input): input is MemoryClaimInput => Boolean(input));
  }

  private claimToInputSync(claim: MemoryGraphClaim): MemoryClaimInput | undefined {
    const subject = this.nodes.get(claim.subjectNodeId);
    if (!subject) {
      return undefined;
    }
    const object = claim.objectNodeId ? this.nodes.get(claim.objectNodeId) : undefined;
    if (claim.objectNodeId && !object) {
      return undefined;
    }
    const visibility = this.visibility.get(claim.id);
    return {
      id: claim.id,
      scope: claim.scope,
      kind: claim.kind,
      subject: memoryGraphEntityRefFromNode(subject),
      predicate: claim.predicate,
      object: object ? memoryGraphEntityRefFromNode(object) : undefined,
      text: claim.text,
      visibility: claim.visibility,
      knownToRoleIds: visibility ? [...visibility.roleIds] : undefined,
      factionId: visibility?.factionId,
      directorVisible: visibility?.directorVisible,
      confidence: claim.confidence,
      authority: claim.authority,
      sensitivity: claim.sensitivity,
      source: {
        sourceScope: claim.scope,
        sourceTextHash: stableMemoryGraphId("hash", `${claim.id}:${claim.text}`),
        excerpt: claim.text,
        createdAt: claim.lastSeenAt,
      },
      conflictPolicy: claim.authority === "developer" ? "supersede" : claim.status === "disputed" ? "dispute" : "merge",
      status: claim.status,
      evidenceCount: claim.evidenceCount,
      properties: claim.properties,
    };
  }

  async queryConflicts(scope: MemoryScope, claimId: string): Promise<MemoryGraphClaim[]> {
    const claim = this.claims.get(claimId);
    if (!claim) {
      return [];
    }
    return [...this.claims.values()].filter(
      (item) =>
        item.scope === scope &&
        item.id !== claimId &&
        item.subjectNodeId === claim.subjectNodeId &&
        item.predicate === claim.predicate &&
        item.status === "disputed",
    );
  }

  async queryIssues(context: MemoryGraphViewContext): Promise<MemoryGraphIssue[]> {
    return this.queryIssuesSync(context);
  }

  queryIssuesSync(context: MemoryGraphViewContext): MemoryGraphIssue[] {
    const filters = context.filters ?? {};
    const visibleClaims = [...this.claims.values()]
      .filter((claim) => claim.scope === context.scope)
      .filter((claim) => claim.status !== "archived" && claim.status !== "rejected")
      .filter((claim) => this.canViewerReadClaim(claim, context))
      .filter((claim) =>
        matchesMemoryGraphFilters(claim, filters, this.nodes.get(claim.subjectNodeId), claim.objectNodeId ? this.nodes.get(claim.objectNodeId) : undefined)
      );
    return buildMemoryGraphIssues(visibleClaims, (id) => this.nodes.get(id));
  }

  async mergeClaims(input: MemoryGraphMergeClaimsInput): Promise<MemoryGraphClaim> {
    const winner = this.claims.get(input.winnerClaimId);
    if (!winner) {
      throw new Error("Memory graph winner claim is missing.");
    }
    let evidenceCount = winner.evidenceCount;
    let confidence = winner.confidence;
    for (const duplicateId of input.duplicateClaimIds) {
      const duplicate = this.claims.get(duplicateId);
      if (!duplicate || duplicate.id === winner.id) {
        continue;
      }
      evidenceCount += duplicate.evidenceCount;
      confidence = Math.max(confidence, duplicate.confidence);
      this.claims.set(duplicate.id, { ...duplicate, status: "archived", version: duplicate.version + 1 });
    }
    const next = {
      ...winner,
      evidenceCount,
      confidence,
      lastSeenAt: new Date().toISOString(),
      version: winner.version + 1,
    };
    this.claims.set(winner.id, next);
    return next;
  }

  async mergeDuplicates(input: MemoryGraphMergeClaimsInput): Promise<MemoryGraphClaim> {
    return this.mergeClaims(input);
  }

  async updateVisibility(input: MemoryGraphVisibilityPatch): Promise<MemoryGraphClaim> {
    const claim = this.claims.get(input.claimId);
    if (!claim) {
      throw new Error("Memory graph claim is missing.");
    }
    const next = {
      ...claim,
      visibility: input.visibility,
      lastSeenAt: new Date().toISOString(),
      version: claim.version + 1,
    };
    this.claims.set(claim.id, next);
    this.visibility.set(claim.id, {
      roleIds: new Set(input.knownToRoleIds ?? []),
      factionId: input.factionId,
      directorVisible: Boolean(input.directorVisible),
    });
    return next;
  }

  async fixVisibility(input: MemoryGraphVisibilityPatch): Promise<MemoryGraphClaim> {
    return this.updateVisibility(input);
  }

  async archiveLowQuality(input: MemoryGraphQualityArchiveInput): Promise<void> {
    const claimIds = input.claimIds?.length
      ? input.claimIds
      : this.queryIssuesSync({
        scope: input.scope ?? "global",
        viewer: input.scope?.startsWith("room:")
          ? { type: "director", roomId: input.scope.slice("room:".length).split(":")[0] }
          : input.scope === "global"
            ? { type: "global" }
            : { type: "one_on_one", packId: (input.scope ?? "character:unknown").slice("character:".length) },
        mode: "quality",
      }).flatMap((issue) => issue.claimIds);
    for (const claimId of new Set(claimIds)) {
      const claim = this.claims.get(claimId);
      if (claim) {
        this.claims.set(claim.id, { ...claim, status: "archived", version: claim.version + 1, lastSeenAt: new Date().toISOString() });
      }
    }
  }

  async markSuperseded(oldClaimId: string, _newClaimId: string): Promise<void> {
    const claim = this.claims.get(oldClaimId);
    if (claim) {
      this.claims.set(oldClaimId, { ...claim, status: "superseded", version: claim.version + 1 });
    }
  }

  async markDisputed(claimIds: string[], _reason: string): Promise<void> {
    for (const claimId of claimIds) {
      const claim = this.claims.get(claimId);
      if (claim) {
        this.claims.set(claimId, { ...claim, status: "disputed", version: claim.version + 1 });
      }
    }
  }

  async archiveClaim(claimId: string): Promise<void> {
    const claim = this.claims.get(claimId);
    if (claim) {
      this.claims.set(claimId, { ...claim, status: "archived", version: claim.version + 1 });
    }
  }

  async deleteClaim(claimId: string): Promise<void> {
    const claim = this.claims.get(claimId);
    if (claim) {
      this.claimKeys.delete(claimUniqueKey(claim.scope, claim.canonicalKey, claim.visibility));
      this.claims.delete(claimId);
      this.visibility.delete(claimId);
    }
  }

  deleteClaimSync(claimId: string): void {
    void this.deleteClaim(claimId);
  }

  async deleteScope(scope: MemoryScope): Promise<void> {
    for (const claim of [...this.claims.values()]) {
      if (claim.scope === scope) {
        await this.deleteClaim(claim.id);
      }
    }
    for (const node of [...this.nodes.values()]) {
      if (node.scope === scope) {
        this.nodes.delete(node.id);
        this.nodeKeys.delete(nodeUniqueKey(node.scope, node.kind, node.canonicalKey));
      }
    }
  }

  async exportNeo4jGraph(scope?: MemoryScope): Promise<Neo4jGraphExport> {
    const nodes = [...this.nodes.values()]
      .filter((node) => !scope || node.scope === scope)
      .map((node) => ({ id: node.id, labels: [node.kind], properties: node }));
    const relationships = [...this.edges.values()]
      .filter((edge) => !scope || edge.scope === scope)
      .map((edge) => ({ id: edge.id, from: edge.fromNodeId, to: edge.toNodeId, type: edge.type, properties: edge }));
    return { nodes, relationships };
  }

  private canViewerReadClaim(claim: MemoryGraphClaim, context: MemoryGraphQueryContext): boolean {
    if (claim.visibility === "public" || claim.visibility === "global") {
      return true;
    }
    const visibility = this.visibility.get(claim.id);
    if (context.viewer.type === "director") {
      return claim.visibility === "director_only" || visibility?.directorVisible === true;
    }
    if (context.viewer.type === "one_on_one") {
      return claim.visibility === "private_character" && claim.scope === `character:${context.viewer.packId}`;
    }
    if (context.viewer.type === "room_role") {
      if ((claim.visibility === "known_to_roles" || claim.visibility === "private_character") && visibility?.roleIds.has(context.viewer.participantId)) {
        return true;
      }
      return claim.visibility === "faction" && Boolean(context.viewer.factionId) && visibility?.factionId === context.viewer.factionId;
    }
    if (context.viewer.type === "room_faction") {
      return claim.visibility === "faction" && visibility?.factionId === context.viewer.factionId;
    }
    return false;
  }

  private supersedeConflictingClaims(next: MemoryGraphClaim) {
    for (const claim of this.claims.values()) {
      if (
        claim.id !== next.id &&
        claim.scope === next.scope &&
        claim.subjectNodeId === next.subjectNodeId &&
        claim.predicate === next.predicate &&
        claim.visibility === next.visibility &&
        claim.status === "active"
      ) {
        this.claims.set(claim.id, { ...claim, status: "superseded", version: claim.version + 1 });
      }
    }
  }

  private disputeConflictingClaims(next: MemoryGraphClaim) {
    for (const claim of this.claims.values()) {
      if (
        claim.id !== next.id &&
        claim.scope === next.scope &&
        claim.subjectNodeId === next.subjectNodeId &&
        claim.predicate === next.predicate &&
        claim.visibility === next.visibility &&
        claim.status === "active"
      ) {
        this.claims.set(claim.id, { ...claim, status: "disputed", version: claim.version + 1 });
        this.claims.set(next.id, { ...next, status: "disputed", version: next.version + 1 });
      }
    }
  }
}

export class TauriSQLiteMemoryGraphRepository implements MemoryGraphRepository {
  async migrate(): Promise<void> {
    await invoke("memory_graph_migrate");
  }

  async upsertNode(input: MemoryEntityRef & { scope: MemoryScope }): Promise<MemoryGraphNode> {
    return invoke<MemoryGraphNode>("memory_graph_upsert_node", { node: serializeNodeInput(input) });
  }

  async mergeClaim(input: MemoryClaimInput): Promise<MemoryGraphClaim> {
    const subjectNode = await this.upsertNode({ ...input.subject, scope: input.subject.scope ?? input.scope });
    const objectNode = input.object ? await this.upsertNode({ ...input.object, scope: input.object.scope ?? input.scope }) : undefined;
    return invoke<MemoryGraphClaim>("memory_graph_merge_claim", {
      claim: {
        ...serializeClaimInput(input),
        subjectNodeId: subjectNode.id,
        objectNodeId: objectNode?.id,
      },
    });
  }

  async addEdge(input: MemoryGraphEdgeInput): Promise<MemoryGraphEdge> {
    return this.createEdge(input);
  }

  async updateClaim(patch: MemoryGraphClaimPatch): Promise<MemoryGraphClaim> {
    return invoke<MemoryGraphClaim>("memory_graph_update_claim", { patch });
  }

  async createClaim(input: MemoryClaimInput): Promise<MemoryGraphClaim> {
    const subjectNode = await this.upsertNode({ ...input.subject, scope: input.subject.scope ?? input.scope });
    const objectNode = input.object ? await this.upsertNode({ ...input.object, scope: input.object.scope ?? input.scope }) : undefined;
    return invoke<MemoryGraphClaim>("memory_graph_create_claim", {
      claim: {
        ...serializeClaimInput(input),
        subjectNodeId: subjectNode.id,
        objectNodeId: objectNode?.id,
      },
    });
  }

  async createEdge(input: MemoryGraphEdgeInput): Promise<MemoryGraphEdge> {
    return invoke<MemoryGraphEdge>("memory_graph_create_edge", {
      edge: {
        ...input,
        id: stableMemoryGraphId("edge", `${input.scope}:${input.fromNodeId}:${input.type}:${input.toNodeId}:${input.visibility}`),
      },
    });
  }

  async deleteEdge(edgeId: string): Promise<void> {
    await invoke("memory_graph_delete_edge", { edgeId });
  }

  async resolveConflict(input: MemoryGraphConflictResolutionInput): Promise<void> {
    await invoke("memory_graph_resolve_conflict", { input });
  }

  async queryVisibleClaims(context: MemoryGraphQueryContext): Promise<MemoryGraphClaim[]> {
    const result = await invoke<{ claims: MemoryGraphClaim[] }>("memory_graph_query_visible_claims", { context });
    return result.claims;
  }

  async queryGraphView(context: MemoryGraphViewContext): Promise<MemoryGraphViewModel> {
    return invoke<MemoryGraphViewModel>("memory_graph_query_view", { context });
  }

  async queryNeighbors(context: MemoryGraphNeighborContext): Promise<MemoryGraphViewModel> {
    return invoke<MemoryGraphViewModel>("memory_graph_query_neighbors", { context });
  }

  async queryConflicts(scope: MemoryScope, claimId: string): Promise<MemoryGraphClaim[]> {
    const result = await invoke<{ claims: MemoryGraphClaim[] }>("memory_graph_query_conflicts", { scope, claimId });
    return result.claims;
  }

  async queryIssues(context: MemoryGraphViewContext): Promise<MemoryGraphIssue[]> {
    const result = await invoke<{ issues: MemoryGraphIssue[] }>("memory_graph_query_issues", { context });
    return result.issues;
  }

  async mergeClaims(input: MemoryGraphMergeClaimsInput): Promise<MemoryGraphClaim> {
    return invoke<MemoryGraphClaim>("memory_graph_merge_claims", { input });
  }

  async mergeDuplicates(input: MemoryGraphMergeClaimsInput): Promise<MemoryGraphClaim> {
    return this.mergeClaims(input);
  }

  async updateVisibility(input: MemoryGraphVisibilityPatch): Promise<MemoryGraphClaim> {
    return invoke<MemoryGraphClaim>("memory_graph_update_visibility", { input });
  }

  async fixVisibility(input: MemoryGraphVisibilityPatch): Promise<MemoryGraphClaim> {
    return this.updateVisibility(input);
  }

  async archiveLowQuality(input: MemoryGraphQualityArchiveInput): Promise<void> {
    for (const claimId of input.claimIds ?? []) {
      await this.archiveClaim(claimId);
    }
  }

  async markSuperseded(oldClaimId: string, newClaimId: string): Promise<void> {
    await invoke("memory_graph_resolve_conflict", {
      input: { winnerClaimId: newClaimId, loserClaimIds: [oldClaimId], action: "supersede" },
    });
  }

  async markDisputed(claimIds: string[], reason: string): Promise<void> {
    if (claimIds.length === 0) {
      return;
    }
    await invoke("memory_graph_mark_disputed", { claimIds, reason });
  }

  async archiveClaim(claimId: string): Promise<void> {
    await invoke("memory_graph_archive_claim", { claimId });
  }

  async deleteClaim(claimId: string): Promise<void> {
    await invoke("memory_graph_delete_claim", { claimId });
  }

  async deleteScope(scope: MemoryScope): Promise<void> {
    await invoke("memory_graph_delete_scope", { scope });
  }

  async exportNeo4jGraph(scope?: MemoryScope): Promise<Neo4jGraphExport> {
    return invoke<Neo4jGraphExport>("memory_graph_export_neo4j", { scope });
  }
}

export function memoryGraphClaimFromCompressedEntry(entry: CompressedMemoryEntry): MemoryClaimInput {
  const subject = defaultMemorySubjectForScope(entry.scope);
  return {
    scope: entry.scope,
    kind: memoryAtomKindToGraphKind(entry.kind),
    subject,
    predicate: memoryAtomKindToPredicate(entry.kind),
    object: {
      kind: "concept",
      canonicalKey: normalizeMemoryGraphKey(entry.text),
      displayName: entry.text,
    },
    text: entry.text,
    visibility: entry.scope === "global" ? "global" : entry.scope.startsWith("room:") ? "public" : "private_character",
    confidence: entry.confidence,
    authority: "system",
    sensitivity: entry.sensitivity,
    source: {
      sourceScope: entry.scope,
      sourceTextHash: stableMemoryGraphId("hash", entry.text),
      excerpt: entry.text,
      createdAt: entry.lastSeenAt,
    },
    conflictPolicy: entry.status === "disputed" ? "dispute" : "merge",
    status: entry.status as MemoryGraphClaimStatus,
    evidenceCount: entry.evidenceCount,
    properties: {
      legacyId: entry.id,
      sourceIds: entry.sourceIds,
      sourceMessageIds: entry.sourceMessageIds,
    },
  };
}

export function memoryGraphClaimTextForPrompt(claim: MemoryGraphClaim): string {
  return claim.authority === "developer" ? `[开发者确认] ${claim.text}` : claim.text;
}

function memoryGraphEntityRefFromNode(node: MemoryGraphNode): MemoryEntityRef {
  return {
    id: node.id,
    scope: node.scope,
    kind: node.kind,
    canonicalKey: node.canonicalKey,
    displayName: node.displayName,
    properties: node.properties,
  };
}

export function canonicalMemoryGraphClaimKey(input: Pick<MemoryClaimInput, "scope" | "kind" | "subject" | "predicate" | "object" | "text">): string {
  const subjectKey = input.subject.canonicalKey;
  const objectKey = input.object?.canonicalKey ?? normalizeMemoryGraphKey(input.text);
  return normalizeMemoryGraphKey(`${input.kind}:${subjectKey}:${input.predicate}:${objectKey}`);
}

export function buildMemoryGraphViewModel(input: {
  claims: MemoryGraphClaim[];
  edges?: MemoryGraphEdge[];
  nodeById: (id: string) => MemoryGraphNode | undefined;
  filters?: MemoryGraphFilters;
  mode?: MemoryGraphGovernanceMode;
  issues?: MemoryGraphIssue[];
  maxNodes?: number;
  hiddenPrivateCount?: number;
  visibleClaimCount?: number;
  modeClaimCount?: number;
  pendingReviewCount?: number;
}): MemoryGraphViewModel {
  const maxNodes = clamp(input.maxNodes ?? 120, 12, 500);
  const nodes = new Map<string, MemoryGraphViewNode>();
  const edges = new Map<string, MemoryGraphViewEdge>();
  let truncated = false;
  const addNode = (node: MemoryGraphViewNode): boolean => {
    if (nodes.has(node.id)) {
      return true;
    }
    if (nodes.size >= maxNodes) {
      truncated = true;
      return false;
    }
    nodes.set(node.id, node);
    return true;
  };
  const addEdge = (edge: MemoryGraphViewEdge) => {
    if (!nodes.has(edge.from) || !nodes.has(edge.to) || edges.has(edge.id)) {
      return;
    }
    edges.set(edge.id, edge);
  };

  const pendingReviewCount = input.pendingReviewCount ?? input.claims.filter((claim) => claim.status === "needs_review").length;
  const statusFilterActive = Boolean(input.filters?.statuses?.length);
  const displayClaims = input.mode === "browse" && !statusFilterActive
    ? input.claims.filter((claim) => claim.status !== "needs_review" || claim.confidence >= 0.8 || claim.evidenceCount >= 3)
    : input.claims;

  for (const claim of displayClaims) {
    const scopeNodeId = memoryGraphScopeViewNodeId(claim.scope);
    addNode({
      id: scopeNodeId,
      kind: "scope",
      label: memoryGraphScopeLabel(claim.scope),
      subtitle: claim.scope,
      scope: claim.scope,
    });
    const claimNodeId = memoryGraphClaimViewNodeId(claim.id);
    const subject = input.nodeById(claim.subjectNodeId);
    let subjectNodeId = "";
    if (subject) {
      subjectNodeId = memoryGraphEntityViewNodeId(subject.id);
      if (addNode(memoryGraphEntityViewNode(subject, "subject"))) {
        addEdge({
          id: stableMemoryGraphId("view-edge", `${scopeNodeId}:ABOUT:${subjectNodeId}`),
          from: scopeNodeId,
          to: subjectNodeId,
          type: "ABOUT",
          label: "scope",
          visibility: claim.visibility,
          dashed: isPrivateMemoryGraphVisibility(claim.visibility),
          sourceClaimId: claim.id,
        });
      }
    }
    let connectedToObject = false;
    if (claim.objectNodeId) {
      const object = input.nodeById(claim.objectNodeId);
      if (object && !shouldHideMemoryGraphObjectNode(claim, object)) {
        const objectNodeId = memoryGraphEntityViewNodeId(object.id);
        if (addNode(memoryGraphEntityViewNode(object, "object", claim)) && subjectNodeId) {
          connectedToObject = true;
          addEdge({
            id: stableMemoryGraphId("view-edge", `${subjectNodeId}:${claim.predicate}:${objectNodeId}:${claim.id}`),
            from: subjectNodeId,
            to: objectNodeId,
            type: memoryGraphRelationshipViewEdgeType(claim),
            label: claim.predicate,
            visibility: claim.visibility,
            dashed: isPrivateMemoryGraphVisibility(claim.visibility),
            sourceClaimId: claim.id,
          });
        }
      }
    }
    if (!connectedToObject) {
      if (!addNode(memoryGraphClaimViewNode(claim))) {
        continue;
      }
      const from = subjectNodeId || scopeNodeId;
      addEdge({
        id: stableMemoryGraphId("view-edge", `${from}:ASSERTED_BY:${claimNodeId}`),
        from,
        to: claimNodeId,
        type: "ASSERTED_BY",
        label: claim.predicate,
        visibility: claim.visibility,
        dashed: isPrivateMemoryGraphVisibility(claim.visibility),
        sourceClaimId: claim.id,
      });
    }
  }

  for (const edge of input.edges ?? []) {
    const from = memoryGraphEntityViewNodeId(edge.fromNodeId);
    const to = memoryGraphEntityViewNodeId(edge.toNodeId);
    addEdge({
      id: memoryGraphEdgeViewId(edge),
      from,
      to,
      type: memoryGraphViewEdgeType(edge.type),
      label: edge.type,
      visibility: edge.visibility,
      dashed: isPrivateMemoryGraphVisibility(edge.visibility),
    });
  }

  const claimsByRelation = new Map<string, MemoryGraphClaim[]>();
  for (const claim of displayClaims) {
    const key = `${claim.scope}:${claim.subjectNodeId}:${claim.predicate}:${claim.visibility}`;
    const items = claimsByRelation.get(key) ?? [];
    items.push(claim);
    claimsByRelation.set(key, items);
  }
  for (const claims of claimsByRelation.values()) {
    const disputed = claims.filter((claim) => claim.status === "disputed");
    for (let index = 0; index < disputed.length - 1; index += 1) {
      const from = memoryGraphClaimViewNodeId(disputed[index].id);
      const to = memoryGraphClaimViewNodeId(disputed[index + 1].id);
      addEdge({
        id: stableMemoryGraphId("view-edge", `${from}:CONFLICTS_WITH:${to}`),
        from,
        to,
        type: "CONFLICTS_WITH",
        label: "conflict",
        visibility: disputed[index].visibility,
        dashed: true,
      });
    }
    const active = claims.find((claim) => claim.status === "active");
    for (const superseded of claims.filter((claim) => claim.status === "superseded")) {
      if (!active) {
        continue;
      }
      const from = memoryGraphClaimViewNodeId(active.id);
      const to = memoryGraphClaimViewNodeId(superseded.id);
      addEdge({
        id: stableMemoryGraphId("view-edge", `${from}:SUPERSEDES:${to}`),
        from,
        to,
        type: "SUPERSEDES",
        label: "supersedes",
        visibility: superseded.visibility,
        dashed: true,
      });
    }
  }

  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    filters: input.filters ?? {},
    mode: input.mode ?? "browse",
    issues: input.issues ?? buildMemoryGraphIssues(input.claims, input.nodeById),
    truncated,
    hiddenPrivateCount: input.hiddenPrivateCount ?? 0,
    visibleClaimCount: input.visibleClaimCount ?? input.claims.length,
    modeClaimCount: input.modeClaimCount ?? displayClaims.length,
    pendingReviewCount,
  };
}

export function buildMemoryGraphIssues(
  claims: MemoryGraphClaim[],
  nodeById: (id: string) => MemoryGraphNode | undefined,
): MemoryGraphIssue[] {
  const issues: MemoryGraphIssue[] = [];
  const byConflictKey = new Map<string, MemoryGraphClaim[]>();
  const byDuplicateKey = new Map<string, MemoryGraphClaim[]>();

  for (const claim of claims) {
    const subject = nodeById(claim.subjectNodeId);
    const object = claim.objectNodeId ? nodeById(claim.objectNodeId) : undefined;
    const conflictKey = `${claim.scope}:${claim.subjectNodeId}:${claim.predicate}`;
    const conflictItems = byConflictKey.get(conflictKey) ?? [];
    conflictItems.push(claim);
    byConflictKey.set(conflictKey, conflictItems);

    const duplicateKey = normalizeMemoryGraphKey([
      claim.scope,
      claim.canonicalKey || claim.kind,
      claim.subjectNodeId,
      claim.predicate,
      claim.objectNodeId ?? normalizeMemoryGraphKey(claim.text),
    ].join(":"));
    const duplicateItems = byDuplicateKey.get(duplicateKey) ?? [];
    duplicateItems.push(claim);
    byDuplicateKey.set(duplicateKey, duplicateItems);

    if (claim.visibility === "public" && (claim.kind === "secret" || claim.sensitivity === "private")) {
      issues.push({
        id: stableMemoryGraphId("issue", `visibility:${claim.id}`),
        kind: "visibility_leak",
        severity: "error",
        claimIds: [claim.id],
        summary: `公开可见的私密事实：${claim.text}`,
      });
    }

    if (isLowQualityMemoryGraphClaim(claim)) {
      issues.push({
        id: stableMemoryGraphId("issue", `quality:${claim.id}`),
        kind: "low_quality",
        severity: "warn",
        claimIds: [claim.id],
        summary: `低质量或低置信度记忆：${claim.text}`,
      });
    }

    if (!subject || (claim.objectNodeId && !object)) {
      issues.push({
        id: stableMemoryGraphId("issue", `orphan:${claim.id}`),
        kind: "orphan",
        severity: "warn",
        claimIds: [claim.id],
        summary: `记忆缺少可连接实体：${claim.text}`,
      });
    }
  }

  for (const items of byConflictKey.values()) {
    const activeItems = items.filter((claim) => claim.status === "active" || claim.status === "disputed");
    const objectKeys = new Set(activeItems.map((claim) => claim.objectNodeId ?? normalizeMemoryGraphKey(claim.text)));
    if (activeItems.length > 1 && (objectKeys.size > 1 || activeItems.some((claim) => claim.status === "disputed"))) {
      issues.push({
        id: stableMemoryGraphId("issue", `conflict:${activeItems.map((claim) => claim.id).sort().join(":")}`),
        kind: "conflict",
        severity: "error",
        claimIds: activeItems.map((claim) => claim.id),
        summary: `同一主体和谓词存在冲突：${activeItems[0].predicate}`,
      });
    }
  }

  for (const items of byDuplicateKey.values()) {
    const activeItems = items.filter((claim) => claim.status === "active");
    if (activeItems.length > 1) {
      issues.push({
        id: stableMemoryGraphId("issue", `duplicate:${activeItems.map((claim) => claim.id).sort().join(":")}`),
        kind: "duplicate",
        severity: "warn",
        claimIds: activeItems.map((claim) => claim.id),
        summary: `重复记忆：${activeItems[0].text}`,
      });
    }
  }

  return dedupeMemoryGraphIssues(issues);
}

function isLowQualityMemoryGraphClaim(claim: MemoryGraphClaim): boolean {
  if (claim.authority === "developer" || claim.authority === "director") {
    return false;
  }
  const text = claim.text.trim();
  if (claim.confidence < 0.5 || (claim.evidenceCount <= 1 && claim.authority === "character" && claim.confidence < 0.68)) {
    return true;
  }
  if (isGenericMemoryGraphClaimText(text)) {
    return true;
  }
  if (claim.kind === "fact" && text.length < 5 && claim.evidenceCount <= 1) {
    return true;
  }
  return false;
}

function isGenericMemoryGraphClaimText(text: string): boolean {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    return true;
  }
  if (/(?:房间相关事实|角色相关事实|用户相关事实)\s*[：:].*(?:房间相关事实|角色相关事实|用户相关事实)\s*[：:]/.test(clean)) {
    return true;
  }
  if (/^(?:房间相关事实|角色相关事实|用户相关事实|事实|preference|fact|scene|summary)\s*[：:]\s*$/i.test(clean)) {
    return true;
  }
  if (/^(?:room summary|summary)\s*:/i.test(clean)) {
    return true;
  }
  if (/\b(?:preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict)\s*:\s*[^|]+\|\s*(?:preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict)\s*:/i.test(clean)) {
    return true;
  }
  if (/(director choice:\s*pick a role to act|waiting for player|等待玩家|等待用户|model_unavailable|local_error|cloud_error|模型不可用|生成回复)/i.test(clean)) {
    return true;
  }
  return false;
}

function dedupeMemoryGraphIssues(issues: MemoryGraphIssue[]): MemoryGraphIssue[] {
  const seen = new Set<string>();
  const result: MemoryGraphIssue[] = [];
  for (const issue of issues) {
    if (seen.has(issue.id)) {
      continue;
    }
    seen.add(issue.id);
    result.push(issue);
  }
  return result;
}

function memoryGraphIssueClaimIdsForMode(issues: MemoryGraphIssue[], mode: MemoryGraphGovernanceMode): Set<string> {
  const acceptedKinds: Record<Exclude<MemoryGraphGovernanceMode, "browse">, MemoryGraphIssueKind[]> = {
    conflicts: ["conflict"],
    duplicates: ["duplicate"],
    visibility: ["visibility_leak"],
    quality: ["low_quality", "orphan"],
  };
  const kinds = mode === "browse" ? [] : acceptedKinds[mode];
  return new Set(
    issues
      .filter((issue) => kinds.includes(issue.kind))
      .flatMap((issue) => issue.claimIds),
  );
}

function memoryGraphClaimViewNode(claim: MemoryGraphClaim): MemoryGraphViewNode {
  const concept = memoryGraphClaimSemanticConcept(claim);
  return {
    id: memoryGraphClaimViewNodeId(claim.id),
    kind: "claim",
    label: concept.caption,
    subtitle: concept.subtitle,
    scope: claim.scope,
    claimKind: claim.kind,
    status: claim.status,
    visibility: claim.visibility,
    authority: claim.authority,
    confidence: claim.confidence,
    evidenceCount: claim.evidenceCount,
    text: claim.text,
    redacted: false,
    sourceClaimId: claim.id,
    nodeCaption: concept.caption,
    semanticKind: concept.semanticKind,
    categoryGroup: concept.categoryGroup,
  };
}

function memoryGraphClaimSemanticConcept(claim: MemoryGraphClaim): {
  caption: string;
  subtitle: string;
  semanticKind: string;
  categoryGroup: string;
} {
  const kindLabel = memoryGraphClaimKindConceptLabel(claim.kind);
  const body = claim.kind === "preference"
    ? memoryGraphPreferenceValueFromClaim(claim) ?? memoryGraphCompactClaimBody(claim.text, claim.kind)
    : memoryGraphCompactClaimBody(claim.text, claim.kind);
  const caption = memoryGraphShortConcept(`${kindLabel} · ${body || "-"}`, 34);
  return {
    caption,
    subtitle: `${claim.kind} · ${claim.status} · ${Math.round(claim.confidence * 100)}%`,
    semanticKind: claim.kind,
    categoryGroup: memoryGraphClaimCategoryGroup(claim),
  };
}

function memoryGraphClaimKindConceptLabel(kind: MemoryGraphClaimKind): string {
  const labels: Partial<Record<MemoryGraphClaimKind, string>> = {
    preference: "偏好",
    judgement: "裁定",
    constraint: "限制",
    secret: "秘密",
    clue: "线索",
    goal: "目标",
    plan: "计划",
    task: "任务",
    stance: "观点",
    argument: "论点",
    relationship: "关系",
    identity: "身份",
    item: "物品",
    scene: "场景",
    conflict: "冲突",
    fact: "事实",
  };
  return labels[kind] ?? kind;
}

function memoryGraphClaimCategoryGroup(claim: MemoryGraphClaim): string {
  if (claim.status === "disputed" || claim.kind === "conflict") {
    return "conflict";
  }
  if (claim.status === "needs_review" || claim.confidence < 0.45 || claim.status === "rejected" || claim.status === "archived") {
    return "quality";
  }
  if (claim.kind === "judgement") {
    return "judgement";
  }
  if (claim.kind === "constraint" || claim.kind === "scene" || claim.kind === "item") {
    return "continuity";
  }
  if (claim.kind === "secret" || claim.visibility === "director_only" || claim.visibility === "known_to_roles") {
    return "hidden";
  }
  if (claim.visibility === "faction" || claim.kind === "goal" || claim.kind === "plan") {
    return "faction_strategy";
  }
  return "fact";
}

function memoryGraphPreferenceValueFromClaim(claim: MemoryGraphClaim): string | undefined {
  for (const source of [claim.canonicalKey, claim.text]) {
    const explicit = source.match(/(?:用户偏好|偏好|喜欢|preference|prefers?|likes?)\s*[：:=是为]?\s*([^。.,，；;|\n]{1,48})/i)?.[1]?.trim();
    if (explicit && isConciseMemoryGraphPreferenceValue(explicit)) {
      return explicit;
    }
    const colonValue = source.match(/[：:]\s*([^。.,，；;|\n]{1,48})/)?.[1]?.trim();
    if (colonValue && isConciseMemoryGraphPreferenceValue(colonValue)) {
      return colonValue;
    }
  }
  return undefined;
}

function memoryGraphCompactClaimBody(text: string, kind: MemoryGraphClaimKind): string {
  const withoutPrefix = text.replace(new RegExp(`^\\s*${kind}\\s*[：:]+\\s*`, "i"), "").trim();
  const clean = withoutPrefix
    .replace(/^\s*(用户相关事实|房间相关事实|事实|记忆)\s*[：:]\s*/i, "")
    .trim();
  return (clean.split(/[。.!?？；;]/)[0]?.trim() || clean || text).trim();
}

function memoryGraphShortConcept(value: string, maxChars: number): string {
  const clean = value.replace(/\s+/g, " ").trim();
  const chars = Array.from(clean);
  if (chars.length <= maxChars) {
    return clean || "-";
  }
  return `${chars.slice(0, Math.max(1, maxChars - 3)).join("")}...`;
}

function memoryGraphEntityViewNode(
  node: MemoryGraphNode,
  entityRole: "subject" | "object" | "related" = "related",
  claim?: MemoryGraphClaim,
): MemoryGraphViewNode {
  const objectLabel = entityRole === "object" && claim ? extractMemoryGraphPreferenceObjectLabel(claim, node) : undefined;
  return {
    id: memoryGraphEntityViewNodeId(node.id),
    kind: "entity",
    label: objectLabel ?? node.displayName,
    subtitle: entityRole === "object" && objectLabel ? `${node.kind} · value` : node.kind,
    scope: node.scope,
    entityRole,
    nodeKind: node.kind,
  };
}

function shouldHideMemoryGraphObjectNode(claim: MemoryGraphClaim, object: MemoryGraphNode): boolean {
  const preferenceValue = extractMemoryGraphPreferenceObjectLabel(claim, object);
  if (preferenceValue) {
    const claimText = normalizeMemoryGraphKey(claim.text);
    const valueText = normalizeMemoryGraphKey(preferenceValue);
    return Boolean(valueText && claimText.includes(valueText));
  }
  const objectText = normalizeMemoryGraphKey(object.displayName);
  const objectKey = normalizeMemoryGraphKey(object.canonicalKey);
  const claimText = normalizeMemoryGraphKey(claim.text);
  const claimKey = normalizeMemoryGraphKey(claim.canonicalKey);
  if (!objectText || !claimText) {
    return false;
  }
  if (objectText === claimText || objectKey === claimKey) {
    return true;
  }
  if (objectText.length > 10 && (claimText.includes(objectText) || objectText.includes(claimText))) {
    return true;
  }
  return false;
}

function extractMemoryGraphPreferenceObjectLabel(claim: MemoryGraphClaim, object: MemoryGraphNode): string | undefined {
  if (claim.kind !== "preference") {
    return undefined;
  }
  const simpleKey = object.canonicalKey.trim();
  if (isConciseMemoryGraphPreferenceValue(simpleKey)) {
    return simpleKey;
  }
  for (const source of [object.displayName, claim.text]) {
    const explicit = source.match(/(?:用户偏好|偏好|喜欢|preference|prefers?)\s*[：:=是为]?\s*([^。.,，；;|\n]{1,48})/i)?.[1]?.trim();
    if (explicit && isConciseMemoryGraphPreferenceValue(explicit)) {
      return explicit;
    }
    const colonValue = source.match(/[：:]\s*([^。.,，；;|\n]{1,48})/)?.[1]?.trim();
    if (colonValue && isConciseMemoryGraphPreferenceValue(colonValue)) {
      return colonValue;
    }
  }
  return undefined;
}

function isConciseMemoryGraphPreferenceValue(value: string): boolean {
  const clean = value.replace(/^["'\s]+|["'\s]+$/g, "");
  if (!clean || clean.length > 32) {
    return false;
  }
  if (/(?:preference|prefers?|用户偏好|偏好|喜欢)/i.test(clean)) {
    return false;
  }
  return true;
}

function memoryGraphScopeViewNodeId(scope: MemoryScope): string {
  return `scope:${scope}`;
}

function memoryGraphEntityViewNodeId(id: string): string {
  return `entity:${id}`;
}

function memoryGraphClaimViewNodeId(id: string): string {
  return `claim:${id}`;
}

function memoryGraphEdgeViewId(edge: MemoryGraphEdge): string {
  return `edge:${edge.id}`;
}

function memoryGraphScopeLabel(scope: MemoryScope): string {
  if (scope === "global") {
    return "Global";
  }
  if (scope.startsWith("room:")) {
    return `Room ${scope.slice("room:".length)}`;
  }
  if (scope.startsWith("character:")) {
    return `Character ${scope.slice("character:".length)}`;
  }
  return scope;
}

function memoryGraphViewEdgeType(type: MemoryGraphEdgeInput["type"]): MemoryGraphViewEdge["type"] {
  if (type === "CONFLICTS_WITH" || type === "SUPERSEDES" || type === "MEMBER_OF" || type === "HAS_GOAL" || type === "OWNS" || type === "LOCATED_IN" || type === "TARGETS" || type === "SUPPORTS" || type === "MENTIONS") {
    return type;
  }
  if (type === "KNOWN_BY" || type === "ASSERTED_BY") {
    return type;
  }
  return "ABOUT";
}

function memoryGraphRelationshipViewEdgeType(claim: MemoryGraphClaim): MemoryGraphViewEdge["type"] {
  if (claim.predicate === "has_goal" || claim.kind === "goal") {
    return "HAS_GOAL";
  }
  if (claim.predicate === "located_in") {
    return "LOCATED_IN";
  }
  if (claim.predicate === "has_item" || claim.kind === "item") {
    return "OWNS";
  }
  if (claim.predicate === "asserts_stance" || claim.kind === "stance" || claim.kind === "argument") {
    return "SUPPORTS";
  }
  if (claim.kind === "secret" || claim.kind === "clue") {
    return "MENTIONS";
  }
  return "ABOUT";
}

function isPrivateMemoryGraphVisibility(visibility: MemoryGraphVisibility): boolean {
  return visibility === "known_to_roles" || visibility === "faction" || visibility === "director_only" || visibility === "private_character";
}

function matchesMemoryGraphFilters(
  claim: MemoryGraphClaim,
  filters: MemoryGraphFilters,
  subject?: MemoryGraphNode,
  object?: MemoryGraphNode,
): boolean {
  if (filters.scopes && filters.scopes.length > 0 && !filters.scopes.includes(claim.scope)) {
    return false;
  }
  if (filters.kinds && filters.kinds.length > 0 && !filters.kinds.includes(claim.kind)) {
    return false;
  }
  if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(claim.status)) {
    return false;
  }
  if (filters.visibilities && filters.visibilities.length > 0 && !filters.visibilities.includes(claim.visibility)) {
    return false;
  }
  const search = filters.search?.trim().toLowerCase();
  if (!search) {
    return true;
  }
  const haystack = [claim.text, claim.kind, claim.status, claim.visibility, claim.authority, subject?.displayName, object?.displayName]
    .filter((item): item is string => Boolean(item))
    .join("\n")
    .toLowerCase();
  return haystack.includes(search);
}

function isMemoryGraphClaimConnectedToExpandedNode(claim: MemoryGraphClaim, expandedNodeIds: Set<string>): boolean {
  if (expandedNodeIds.size === 0) {
    return false;
  }
  if (expandedNodeIds.has(memoryGraphClaimViewNodeId(claim.id))) {
    return true;
  }
  if (expandedNodeIds.has(memoryGraphEntityViewNodeId(claim.subjectNodeId))) {
    return true;
  }
  return Boolean(claim.objectNodeId && expandedNodeIds.has(memoryGraphEntityViewNodeId(claim.objectNodeId)));
}

function serializeNodeInput(input: MemoryEntityRef & { scope: MemoryScope }) {
  return {
    id: input.id,
    scope: input.scope,
    kind: input.kind,
    canonicalKey: input.canonicalKey,
    displayName: input.displayName,
    properties: input.properties ?? {},
  };
}

function serializeClaimInput(input: MemoryClaimInput) {
  return {
    id: input.id,
    scope: input.scope,
    kind: input.kind,
    predicate: input.predicate,
    text: input.text,
    canonicalKey: canonicalMemoryGraphClaimKey(input),
    status: input.status ?? "active",
    visibility: input.visibility,
    knownToRoleIds: input.knownToRoleIds ?? [],
    factionId: input.factionId,
    directorVisible: input.directorVisible ?? false,
    confidence: input.authority === "developer" ? 1 : input.confidence,
    authority: input.authority,
    sensitivity: input.sensitivity,
    evidenceCount: input.evidenceCount ?? 1,
    properties: input.properties ?? {},
    source: input.source,
  };
}

function defaultMemorySubjectForScope(scope: MemoryScope): MemoryEntityRef {
  if (scope === "global") {
    return { kind: "user", canonicalKey: "global-user", displayName: "User" };
  }
  if (scope.startsWith("character:")) {
    const packId = scope.slice("character:".length);
    return { kind: "character_pack", canonicalKey: packId, displayName: packId };
  }
  if (scope.startsWith("room:")) {
    return { kind: "room", canonicalKey: scope, displayName: scope };
  }
  return { kind: "unknown", canonicalKey: scope, displayName: scope };
}

function memoryAtomKindToGraphKind(kind: MemoryAtomKind): MemoryGraphClaimKind {
  if (kind === "plan") {
    return "plan";
  }
  if (kind === "relationship") {
    return "relationship";
  }
  if (kind === "preference") {
    return "preference";
  }
  if (kind === "constraint") {
    return "constraint";
  }
  if (kind === "scene") {
    return "scene";
  }
  if (kind === "item") {
    return "item";
  }
  if (kind === "clue") {
    return "clue";
  }
  if (kind === "stance") {
    return "stance";
  }
  if (kind === "argument") {
    return "argument";
  }
  if (kind === "task") {
    return "task";
  }
  if (kind === "conflict") {
    return "conflict";
  }
  return "fact";
}

function memoryAtomKindToPredicate(kind: MemoryAtomKind): string {
  if (kind === "preference") {
    return "prefers";
  }
  if (kind === "plan" || kind === "task") {
    return "has_goal";
  }
  if (kind === "relationship") {
    return "related_to";
  }
  if (kind === "stance" || kind === "argument") {
    return "supports";
  }
  if (kind === "item") {
    return "mentions_item";
  }
  if (kind === "clue") {
    return "mentions_clue";
  }
  return "states";
}

function memoryGraphPromptScore(claim: MemoryGraphClaim): number {
  const recency = Math.min(1, Math.max(0, Date.now() - new Date(claim.lastSeenAt).getTime()) / (1000 * 60 * 60 * 24 * 30));
  const recencyScore = 1 - recency;
  const evidenceScore = Math.min(1, claim.evidenceCount / 5);
  const kindPriority = ["constraint", "secret", "clue", "item", "goal", "judgement"].includes(claim.kind) ? 1 : claim.kind === "preference" ? 0.75 : 0.55;
  return claim.confidence * 0.45 + recencyScore * 0.2 + evidenceScore * 0.15 + kindPriority * 0.15;
}

function nodeUniqueKey(scope: MemoryScope, kind: MemoryGraphNodeKind, canonicalKey: string): string {
  return `${scope}:${kind}:${canonicalKey}`;
}

function claimUniqueKey(scope: MemoryScope, canonicalKey: string, visibility: MemoryGraphVisibility): string {
  return `${scope}:${canonicalKey}:${visibility}`;
}

function normalizeMemoryGraphKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}:._ -]+/gu, "")
    .slice(0, 180) || "unknown";
}

function stableMemoryGraphId(prefix: string, seed: string): string {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
