import type {
  CandidateMemory,
  CharacterPackMemoryFile,
  CompressedMemoryEntry,
  CompressedMemoryKind,
  DirectorMemoryCategory,
  DirectorMemoryEntry,
  DirectorMemorySourceType,
  MemoryAtomKind,
  MemoryEditPatch,
  MemoryRetentionPolicy,
  MemoryCompressionResult,
  MemoryEvent,
  MemoryRollingSummary,
  MemoryScope,
  MemorySensitivity,
  MemoryVersionEntry,
  ContinuityWrite,
  RoomObservationEntry,
  RoomObservationTag,
  RoomObserverMemoryScope,
  RoomContinuityEntry,
  RoomDirectorMemorySnapshot,
  RoomFactionHuddleThread,
  RoomFactionMemoryScope,
  RoomFactionMemorySnapshot,
  RoomDirectorMove,
  RoomKnowledgeVisibility,
  RoomMemoryMessage,
  RoomMemorySnapshot,
  RoomObserverMemorySnapshot,
  RoomSceneBoard,
  RoomSecretEntry,
  RoomSystemMemoryScope,
  SemanticMemoryEpistemicStatus,
  SemanticMemoryObservation,
  SemanticMemoryObservationKind,
  SemanticMemorySubjectType,
  SemanticMemoryVisibility,
  ShortTermMention,
} from "./types";
import {
  InMemoryMemoryGraphRepository,
  memoryGraphClaimFromCompressedEntry,
  shouldInjectMemoryGraphClaimIntoPrompt,
  memoryGraphClaimTextForPrompt,
  type MemoryGraphClaim,
  type MemoryGraphQueryContext,
  type MemoryGraphViewContext,
  type MemoryGraphViewModel,
  type MemoryClaimInput,
} from "./memoryGraph";
import { extractMemoryClaimsFromEvent, type MemoryExtractionSourceType } from "./memoryExtractionPipeline";

export interface RecordMentionInput {
  scope: MemoryScope;
  text: string;
  source: ShortTermMention["source"];
  now: Date;
  sourceMessageId?: string;
}

export interface RecordRoomMessageInput {
  scope: `room:${string}`;
  speaker: string;
  speakerId?: string;
  speakerType?: RoomMemoryMessage["speakerType"];
  text: string;
  source: "user" | "room";
  now: Date;
  visibility?: RoomMemoryMessage["visibility"];
  visibleTo?: RoomMemoryMessage["visibleTo"];
  privateReason?: RoomMemoryMessage["privateReason"];
  channelId?: RoomMemoryMessage["channelId"];
  factionId?: RoomMemoryMessage["factionId"];
}

export interface RecordRoomObservationInput {
  scope: RoomObserverMemoryScope;
  roomScope: `room:${string}`;
  roleId: string;
  speaker: string;
  speakerId?: string;
  speakerType?: RoomObservationEntry["speakerType"];
  target?: RoomObservationEntry["target"];
  text: string;
  now: Date;
  importance: number;
  strategyTags: RoomObservationTag[];
  visibility: RoomObservationEntry["visibility"];
  sourceMessageId?: string;
}

export interface RecordDirectorMemoryInput {
  scope: RoomSystemMemoryScope;
  roomScope: `room:${string}`;
  speaker: string;
  text: string;
  move: RoomDirectorMove;
  now: Date;
  visibility?: RoomKnowledgeVisibility;
  visibleToRoleIds?: string[];
  sourceMessageId?: string;
  sourceType?: DirectorMemorySourceType;
  sceneBoard?: RoomSceneBoard;
  continuityWrites?: ContinuityWrite[];
  secretWrites?: RoomSecretEntry[];
}

export interface RecordFactionHuddleInput {
  scope: RoomFactionMemoryScope;
  roomScope: `room:${string}`;
  factionId: string;
  thread: RoomFactionHuddleThread;
  now: Date;
}

export interface MemoryStoreData {
  mentions: ShortTermMention[];
  candidates: CandidateMemory[];
  compressedMemories?: CompressedMemoryEntry[];
  rollingSummaries?: MemoryRollingSummary[];
  semanticObservations?: SemanticMemoryObservation[];
  versionHistory?: MemoryVersionEntry[];
  roomMessages: Array<{ scope: `room:${string}`; messages: RoomMemoryMessage[] }>;
  roomDirectorMemories: RoomDirectorMemorySnapshot[];
  roomObserverMemories: Array<{ scope: RoomObserverMemoryScope; entries: RoomObservationEntry[] }>;
  roomFactionMemories?: RoomFactionMemorySnapshot[];
}

interface MemoryAtomDraft {
  kind: MemoryAtomKind;
  subject: string;
  text: string;
  normalizedKey: string;
  confidence: number;
}

interface SemanticObservationDraft {
  scope: MemoryScope;
  subjectId?: string;
  subjectType: SemanticMemorySubjectType;
  subjectName?: string;
  kind: SemanticMemoryObservationKind;
  text: string;
  epistemicStatus: SemanticMemoryEpistemicStatus;
  confidence: number;
  sourceMessageIds: string[];
  visibility: SemanticMemoryVisibility;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ROOM_MESSAGES = 80;
const MAX_OBSERVER_ENTRIES = 80;
const MAX_FACTION_HUDDLES = 40;
const MAX_COMPRESSED_FACT_CHARS = 160;
const MAX_ROOM_SUMMARY_CHARS = 500;
const MAX_SEMANTIC_OBSERVATIONS_PER_SCOPE = 120;
const editableMemoryKinds: MemoryAtomKind[] = [
  "preference",
  "fact",
  "relationship",
  "plan",
  "constraint",
  "scene",
  "item",
  "clue",
  "stance",
  "argument",
  "task",
  "conflict",
];
const editableMemoryStatuses: CompressedMemoryEntry["status"][] = ["active", "needs_review", "disputed", "superseded", "archived"];
const MEMORY_ARTIFACT_PREFIX_PATTERN = /(?:房间相关事实|角色相关事实|用户相关事实)\s*[：:]/g;
const MEMORY_ARTIFACT_SUMMARY_PATTERN = /^(?:room summary|summary)\s*:/i;
const MEMORY_ARTIFACT_CHAIN_PATTERN = /\b(?:preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict)\s*:\s*[^|]+\|\s*(?:preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict)\s*:/i;
const MEMORY_STATUS_NOISE_PATTERN = /(director choice:\s*pick a role to act|continue a clue|let the room flow|director pause:|director recap:|waiting for player|等待玩家|等待用户|已停止\s*\/\s*等待玩家|no chat model is available|could not connect to the ai service|the ai service returned an error|failed to use|model_unavailable|local_error|cloud_error|模型不可用|云端聊天服务连接失败|本地模型.*失败|generating reply)/i;

const EXPLICIT_MEMORY_REQUEST_PATTERN =
  /\b(?:remember|memorize|note that|save this|keep this in mind|keep in mind)\b|\u8bf7\u8bb0\u4f4f|\u8bb0\u4f4f|\u5e2e\u6211\u8bb0|\u8bb0\u4e00\u4e0b|\u8bb0\u5f55\u4e00\u4e0b|\u8bb0\u5f55|\u8bb0\u4e0b\u6765|\u4ee5\u540e\u8bb0\u5f97|\u4f60\u8981\u8bb0\u5f97|(^|[\s,\uFF0C\u3002.!！?\uFF1F])\u8bb0\u5f97|\u4fdd\u5b58\u4e3a\u8bb0\u5fc6|\u4fdd\u5b58\u4e00\u4e0b|\u8fd9\u5f88\u91cd\u8981|\u4ee5\u540e\u90fd/i;
const EXPLICIT_MEMORY_REQUEST_PREFIX_PATTERN =
  /^\s*(?:please|\u8bf7|\u9ebb\u70e6|\u5e2e\u6211)?\s*(?:remember(?:\s+that)?|memorize|note that|save this|keep this in mind|keep in mind|\u8bf7\u8bb0\u4f4f|\u8bb0\u4f4f|\u8bb0\u4e00\u4e0b|\u8bb0\u5f55\u4e00\u4e0b|\u8bb0\u5f55|\u8bb0\u4e0b\u6765|\u8bb0\u5f97|\u4ee5\u540e\u8bb0\u5f97|\u4f60\u8981\u8bb0\u5f97|\u4fdd\u5b58\u4e3a\u8bb0\u5fc6|\u4fdd\u5b58\u4e00\u4e0b|\u8fd9\u5f88\u91cd\u8981|\u4ee5\u540e\u90fd)\s*[:\uff1a,\uFF0C\u3002.!！?\uFF1F]?\s*/i;
const MEMORY_ACTION_SIGNAL_PATTERN =
  /\b(?:remember|memorize|note that|save this|keep this in mind|keep in mind)\b|\u8bb0\u4f4f|\u8bb0\u4e00\u4e0b|\u8bb0\u5f55|\u8bb0\u4e0b\u6765|\u8bb0\u5f97|\u4fdd\u5b58|\u7559\u5b58|\u5b58\u4e00\u4e0b/i;
const MEMORY_PERSISTENCE_SIGNAL_PATTERN =
  /\b(?:always|from now on|next time|long[- ]?term|keep)\b|\u4ee5\u540e|\u4e0b\u6b21|\u957f\u671f|\u4e00\u76f4|\u4ee5\u540e\u90fd|\u522b\u5fd8|\u4e0d\u8981\u5fd8/i;
const MEMORY_RECALL_QUESTION_PATTERN =
  /\b(?:do you remember|did you remember|can you remember|have you remembered|remember when)\b|(?:\u4f60|\u4f60\u8fd8)?\u8bb0\u5f97.{0,80}(?:\u5417|\u4e48|\u6ca1\u6709|\u4e86\u5417|[?？])|\u8bb0\u4e0d\u8bb0\u5f97|\u6211\u8bb0\u5f97|\u8fd8\u8bb0\u5f97/i;

export class MemoryStore {
  readonly policy: MemoryRetentionPolicy = {
    shortTermDays: 7,
    promotionMentionThreshold: 3,
    semanticDedupEnabled: true,
    requireUserConfirmation: true,
    autoWriteLongTermEnabled: true,
    sensitiveAutoPromoteEnabled: false,
  };

  private readonly mentions = new Map<string, ShortTermMention>();
  private readonly candidates = new Map<string, CandidateMemory>();
  private readonly compressedMemories = new Map<string, CompressedMemoryEntry>();
  private readonly rollingSummaries = new Map<MemoryScope, MemoryRollingSummary>();
  private readonly semanticObservations = new Map<string, SemanticMemoryObservation>();
  private readonly versionHistory: MemoryVersionEntry[] = [];
  private readonly roomMessages = new Map<`room:${string}`, RoomMemoryMessage[]>();
  private readonly roomDirectorMemories = new Map<RoomSystemMemoryScope, RoomDirectorMemorySnapshot>();
  private readonly roomObserverMemories = new Map<RoomObserverMemoryScope, RoomObservationEntry[]>();
  private readonly roomFactionMemories = new Map<RoomFactionMemoryScope, RoomFactionMemorySnapshot>();
  private readonly graph = new InMemoryMemoryGraphRepository();

  recordMemoryEvent(event: MemoryEvent): MemoryCompressionResult {
    if (event.kind === "mention") {
      const normalizedText = normalizeForMemory(event.text);
      if (!normalizedText || classifySensitivity(event.text) === "forbidden") {
        return { ok: true, saved: false, reason: "filtered" };
      }
      const entry = this.recordShortTermMention({
        scope: event.scope,
        text: event.text,
        source: event.source,
        now: event.now,
        sourceMessageId: event.sourceMessageId,
      });
      return entry
        ? { ok: true, saved: true, reason: "saved", entry: this.compressedMemories.get(entry.id) }
        : { ok: true, saved: false, reason: "not_promoted" };
    }

    if (event.kind === "room_message") {
      const entry = this.recordRoomMessage(event.input);
      const summary = this.updateRollingSummary(event.input.scope);
      return entry
        ? { ok: true, saved: true, reason: "saved", entry: this.compressedMemories.get(entry.id), summary }
        : { ok: true, saved: true, reason: "updated_summary", summary };
    }

    if (event.kind === "room_observation") {
      const entry = this.recordRoomObservation(event.input);
      if (entry) {
        this.syncExtractionEventToGraph(event);
      }
      return { ok: true, saved: Boolean(entry), reason: entry ? "saved" : "filtered" };
    }

    if (event.kind === "director") {
      this.recordDirectorMemory(event.input as unknown as RecordDirectorMemoryInput);
      this.syncExtractionEventToGraph(event);
      return { ok: true, saved: true, reason: "saved" };
    }

    if (event.kind === "faction_huddle") {
      const snapshot = this.recordFactionHuddle(event.input as unknown as RecordFactionHuddleInput);
      if (snapshot) {
        this.syncExtractionEventToGraph(event);
      }
      return { ok: true, saved: Boolean(snapshot), reason: snapshot ? "saved" : "filtered" };
    }

    return { ok: true, saved: false, reason: "skipped" };
  }

  recordShortTermMention(input: RecordMentionInput): CandidateMemory | null {
    this.pruneExpired(input.now);

    const sensitivity = classifySensitivity(input.text);
    if (sensitivity === "forbidden" || isMemoryArtifactText(input.text)) {
      return null;
    }

    const atom = extractMemoryAtoms(input.text, {
      scope: input.scope,
      source: input.source,
    })[0];
    if (!atom) {
      return null;
    }

    const key = `${input.scope}:${atom.normalizedKey}`;
    const timestamp = input.now.toISOString();
    const expiresAt = new Date(input.now.getTime() + this.policy.shortTermDays * DAY_MS).toISOString();
    let mention = this.mentions.get(key);

    if (mention) {
      mention.count += 1;
      mention.normalizedText = refineShortMemoryText(mention.normalizedText, atom.text);
      mention.kind = atom.kind;
      mention.subject = atom.subject;
      mention.lastSeenAt = timestamp;
      mention.expiresAt = expiresAt;
      mention.confidence = Math.max(mention.confidence ?? 0, atom.confidence);
      mention.sensitivity = strongestSensitivity(mention.sensitivity, sensitivity);
      mention.sourceMessageIds = mergeSourceIds(mention.sourceMessageIds, input.sourceMessageId ?? mention.id);
    } else {
      mention = {
        id: stableId("mention", key),
        scope: input.scope,
        kind: atom.kind,
        subject: atom.subject,
        normalizedText: atom.text,
        normalizedKey: atom.normalizedKey,
        source: input.source,
        count: 1,
        confidence: atom.confidence,
        sensitivity,
        sourceMessageIds: input.sourceMessageId ? [input.sourceMessageId] : [],
        firstSeenAt: timestamp,
        lastSeenAt: timestamp,
        expiresAt,
      };
      this.mentions.set(key, mention);
    }

    if (sensitivity !== "sensitive" && sensitivity !== "private" && shouldPromote(input.text, mention.count)) {
      return this.createCandidate(mention, sensitivity);
    }

    return null;
  }

  recordRoomMessage(input: RecordRoomMessageInput): CandidateMemory | null {
    const sensitivity = classifySensitivity(input.text);
    if (sensitivity === "forbidden") {
      return null;
    }

    const messageId = stableId("room-message", `${input.scope}:${input.speaker}:${input.now.toISOString()}:${input.text}`);
    const candidate =
      input.visibility && input.visibility !== "public"
        ? null
        : shouldAcceptRoomMemoryText(input.text, input.source)
          ? this.recordShortTermMention({
            scope: input.scope,
            text: input.text,
            source: input.source,
            now: input.now,
            sourceMessageId: messageId,
          })
          : null;
    const messages = this.roomMessages.get(input.scope) ?? [];
    messages.push({
      id: messageId,
      scope: input.scope,
      speaker: input.speaker,
      speakerId: input.speakerId,
      speakerType: input.speakerType,
      source: input.source,
      text: sanitizeMessageHistoryText(input.text),
      at: input.now.toISOString(),
      visibility: input.visibility ?? "public",
      visibleTo: input.visibleTo,
      privateReason: input.privateReason,
      channelId: input.channelId,
      factionId: input.factionId,
    });
    this.roomMessages.set(input.scope, messages.slice(-MAX_ROOM_MESSAGES));

    return candidate;
  }

  recordRoomObservation(input: RecordRoomObservationInput): RoomObservationEntry | null {
    const normalizedText = normalizeForMemory(input.text);
    const displayText = input.text.trim().replace(/\s+/g, " ").replace(/[。！？!?.,，]+$/u, "");
    if (!normalizedText || !displayText || classifySensitivity(input.text) === "forbidden") {
      return null;
    }

    const entry: RoomObservationEntry = {
      id: stableId("room-observation", `${input.scope}:${input.sourceMessageId ?? input.now.toISOString()}:${normalizedText}`),
      scope: input.scope,
      roomScope: input.roomScope,
      roleId: input.roleId,
      speaker: input.speaker,
      speakerId: input.speakerId,
      speakerType: input.speakerType,
      target: input.target,
      text: displayText,
      observedAt: input.now.toISOString(),
      importance: clampNumber(input.importance, 1, 100),
      strategyTags: dedupeTags(input.strategyTags).slice(0, 4),
      visibility: input.visibility,
      sourceMessageId: input.sourceMessageId,
    };

    const entries = this.roomObserverMemories.get(input.scope) ?? [];
    const next = [entry, ...entries.filter((item) => item.id !== entry.id)].slice(0, MAX_OBSERVER_ENTRIES);
    this.roomObserverMemories.set(input.scope, next);
    return entry;
  }

  listShortTerm(scope?: MemoryScope): ShortTermMention[] {
    return [...this.mentions.values()].filter((mention) => !scope || mention.scope === scope);
  }

  listCandidateMemories(scope?: MemoryScope): CandidateMemory[] {
    return [...this.candidates.values()].filter((candidate) => !scope || candidate.scope === scope);
  }

  listCompressedMemories(scope?: MemoryScope): CompressedMemoryEntry[] {
    return dedupeCompressedMemoryEntries([
      ...this.graph.listAllClaimsSync(scope).map(compressedEntryFromGraphClaim),
      ...[...this.compressedMemories.values()].filter((entry) => !scope || entry.scope === scope).map(normalizeCompressedEntry),
    ]);
  }

  listSemanticObservations(scope?: MemoryScope): SemanticMemoryObservation[] {
    return [...this.semanticObservations.values()]
      .filter((entry) => !scope || entry.scope === scope)
      .sort((left, right) => new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime());
  }

  processSemanticObservationsForScope(scope: MemoryScope): SemanticMemoryObservation[] {
    if (isPlainRoomMemoryScope(scope)) {
      return this.processRoomSemanticObservations(scope as `room:${string}`);
    }
    if (isRoomObserverMemoryScope(scope)) {
      const entries = this.roomObserverMemories.get(scope) ?? [];
      return this.mergeSemanticObservationDrafts(entries.flatMap((entry) => semanticObservationDraftsFromObserverEntry(entry)));
    }
    if (isRoomFactionMemoryScope(scope)) {
      const snapshot = this.roomFactionMemories.get(scope);
      return this.mergeSemanticObservationDrafts(
        (snapshot?.entries ?? []).flatMap((thread) => semanticObservationDraftsFromFactionThread(scope, thread)),
      );
    }
    if (isRoomSystemMemoryScope(scope)) {
      const snapshot = this.roomDirectorMemories.get(scope);
      return this.mergeSemanticObservationDrafts((snapshot?.entries ?? []).flatMap((entry) => semanticObservationDraftsFromDirectorEntry(scope, entry)));
    }
    return [];
  }

  processSemanticObservationsForScopes(scopes: MemoryScope[]): SemanticMemoryObservation[] {
    const saved: SemanticMemoryObservation[] = [];
    for (const scope of Array.from(new Set(scopes))) {
      saved.push(...this.processSemanticObservationsForScope(scope));
    }
    return saved;
  }

  processRoomSemanticObservations(scope: `room:${string}`): SemanticMemoryObservation[] {
    const messages = (this.roomMessages.get(scope) ?? [])
      .filter((message) => (message.visibility ?? "public") === "public")
      .slice(-24);
    return this.mergeSemanticObservationDrafts(messages.flatMap((message) => semanticObservationDraftsFromRoomMessage(scope, message)));
  }

  private mergeSemanticObservationDrafts(drafts: SemanticObservationDraft[]): SemanticMemoryObservation[] {
    const saved: SemanticMemoryObservation[] = [];
    const now = new Date().toISOString();
    for (const draft of drafts) {
      const normalizedText = semanticObservationText(draft.text);
      if (!normalizedText || classifySensitivity(normalizedText) === "forbidden" || isMemoryArtifactText(normalizedText)) {
        continue;
      }
      const id = stableId(
        "semantic-observation",
        `${draft.scope}:${draft.subjectType}:${draft.subjectId ?? draft.subjectName ?? "unknown"}:${draft.kind}:${draft.epistemicStatus}:${semanticObservationKey(normalizedText)}`,
      );
      const current = this.semanticObservations.get(id);
      const sourceMessageIds = Array.from(new Set([...(current?.sourceMessageIds ?? []), ...draft.sourceMessageIds.filter(Boolean)]));
      const next: SemanticMemoryObservation = {
        id,
        scope: draft.scope,
        subjectId: draft.subjectId,
        subjectType: draft.subjectType,
        subjectName: draft.subjectName,
        kind: draft.kind,
        text: normalizedText,
        epistemicStatus: strongestSemanticStatus(current?.epistemicStatus, draft.epistemicStatus),
        confidence: Math.max(current?.confidence ?? 0, clampNumber(draft.confidence, 0.1, 0.98)),
        evidenceCount: Math.max(current?.evidenceCount ?? 0, sourceMessageIds.length, 1),
        sourceMessageIds,
        visibility: draft.visibility,
        createdAt: current?.createdAt ?? now,
        lastUpdatedAt: now,
      };
      this.semanticObservations.set(id, next);
      saved.push(next);
    }
    this.trimSemanticObservationsByScope();
    return saved;
  }

  private trimSemanticObservationsByScope() {
    const byScope = new Map<MemoryScope, SemanticMemoryObservation[]>();
    for (const entry of this.semanticObservations.values()) {
      byScope.set(entry.scope, [...(byScope.get(entry.scope) ?? []), entry]);
    }
    for (const entries of byScope.values()) {
      const overflow = entries
        .sort((left, right) => new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime())
        .slice(MAX_SEMANTIC_OBSERVATIONS_PER_SCOPE);
      for (const entry of overflow) {
        this.semanticObservations.delete(entry.id);
      }
    }
  }

  private memoryGraphScopes(): MemoryScope[] {
    const scopes = new Set<MemoryScope>();
    for (const claim of this.graph.listAllClaimsSync()) {
      scopes.add(claim.scope);
    }
    for (const entry of this.compressedMemories.values()) {
      scopes.add(entry.scope);
    }
    for (const candidate of this.candidates.values()) {
      scopes.add(candidate.scope);
    }
    for (const mention of this.mentions.values()) {
      scopes.add(mention.scope);
    }
    if (scopes.size === 0) {
      scopes.add("global");
    }
    return [...scopes].sort();
  }

  listGraphClaims(scope?: MemoryScope): MemoryGraphClaim[] {
    return this.listGraphClaimsForViewer(scope);
  }

  listGraphClaimsForViewer(scope?: MemoryScope, viewer?: MemoryGraphQueryContext["viewer"]): MemoryGraphClaim[] {
    const scopes = scope ? [scope] : this.memoryGraphScopes();
    return scopes.flatMap((entryScope) =>
      this.graph.queryVisibleClaimsSync({
        scope: entryScope,
        viewer: viewer ?? defaultMemoryGraphViewer(entryScope),
        limit: 256,
        includeDisputed: true,
        includeNeedsReview: true,
      }),
    );
  }

  getGraphView(context?: Partial<MemoryGraphViewContext>): MemoryGraphViewModel {
    const scopes = context?.scope ? [context.scope] : this.memoryGraphScopes();
    const mergedNodes = new Map<string, MemoryGraphViewModel["nodes"][number]>();
    const mergedEdges = new Map<string, MemoryGraphViewModel["edges"][number]>();
    let truncated = false;
    let hiddenPrivateCount = 0;
    let visibleClaimCount = 0;
    let modeClaimCount = 0;
    for (const scope of scopes) {
      const view = this.graph.queryGraphViewSync({
        scope,
        viewer: context?.viewer ?? defaultMemoryGraphViewer(scope),
        limit: context?.limit ?? 256,
        includeDisputed: context?.includeDisputed ?? true,
        maxNodes: context?.maxNodes ?? 120,
        includeArchived: context?.includeArchived,
        redactPrivate: context?.redactPrivate,
        filters: context?.filters,
        expandedNodeIds: context?.expandedNodeIds,
        mode: context?.mode,
      });
      for (const node of view.nodes) {
        mergedNodes.set(node.id, node);
      }
      for (const edge of view.edges) {
        mergedEdges.set(edge.id, edge);
      }
      truncated = truncated || Boolean(view.truncated);
      hiddenPrivateCount += view.hiddenPrivateCount ?? 0;
      visibleClaimCount += view.visibleClaimCount ?? 0;
      modeClaimCount += view.modeClaimCount ?? 0;
    }
    const maxNodes = context?.maxNodes ?? 120;
    const nodes = [...mergedNodes.values()].slice(0, maxNodes);
    const nodeIds = new Set(nodes.map((node) => node.id));
    return {
      nodes,
      edges: [...mergedEdges.values()].filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to)),
      filters: context?.filters ?? {},
      truncated: truncated || mergedNodes.size > nodes.length,
      hiddenPrivateCount,
      visibleClaimCount,
      modeClaimCount,
    };
  }

  listGraphClaimInputs(scope?: MemoryScope): MemoryClaimInput[] {
    const graphInputs = this.graph.listClaimInputsSync(scope);
    const legacyInputs = [...this.compressedMemories.values()]
      .filter((entry) => !scope || entry.scope === scope)
      .filter((entry) => entry.sensitivity !== "forbidden")
      .map((entry) => ({
        ...memoryGraphClaimFromCompressedEntry(entry),
        id: entry.id,
      }));
    return dedupeMemoryClaimInputs([...graphInputs, ...legacyInputs]);
  }

  getPromptMemory(scope: MemoryScope, options: { localModel?: boolean } = {}): string[] {
    const longTermLimit = options.localModel ? 3 : 8;
    const shortTermLimit = options.localModel ? 1 : 4;
    const graphLongTerm = this.graph
      .queryVisibleClaimsSync({
        scope,
        viewer: scope === "global" ? { type: "global" } : scope.startsWith("room:") ? { type: "room_public", roomId: scope.slice("room:".length).split(":")[0] } : { type: "one_on_one", packId: scope.slice("character:".length) },
        localModel: options.localModel,
        limit: longTermLimit,
      })
      .filter(shouldInjectMemoryGraphClaimIntoPrompt)
      .map(memoryGraphClaimTextForPrompt);
    const legacyLongTerm = graphLongTerm.length > 0 ? [] : this.listCompressedMemories(scope)
        .filter((entry) => entry.status === "active")
        .sort((left, right) => {
          if (right.evidenceCount !== left.evidenceCount) {
            return right.evidenceCount - left.evidenceCount;
          }
          return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
        })
        .slice(0, longTermLimit)
        .map((entry) => entry.text);
    const longTerm = dedupePromptMemoryLines([...graphLongTerm, ...legacyLongTerm]).slice(0, longTermLimit);
    const semantic = this.listSemanticObservations(scope)
      .filter(shouldInjectSemanticObservationIntoPrompt)
      .slice(0, options.localModel ? 2 : 5)
      .map(semanticObservationTextForPrompt);
    const shortTerm = this.listShortTerm(scope)
      .sort((left, right) => new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime())
      .slice(0, shortTermLimit)
      .map((mention) => `${mention.kind}: ${mention.normalizedText}`);
    return trimMemoryToBudget(dedupePromptMemoryLines([...longTerm, ...semantic, ...shortTerm]), options.localModel ? 480 : 900);
  }

  getRoomMemorySnapshot(scope: `room:${string}`): RoomMemorySnapshot {
    const shortTerm = this.listShortTerm(scope);
    const candidates = this.listCandidateMemories(scope);
    const confirmedLongTerm = candidates.filter((candidate) => candidate.confirmed);
    const recentMessages = (this.roomMessages.get(scope) ?? []).filter((message) => (message.visibility ?? "public") === "public").slice(-12);
    const rollingSummary = this.rollingSummaries.get(scope);

    return {
      scope,
      shortTerm,
      candidates,
      confirmedLongTerm,
      recentMessages,
      summary: rollingSummary?.text || buildRoomSummary(recentMessages, confirmedLongTerm),
    };
  }

  getRoomPromptMemory(scope: `room:${string}`, options: { budget?: "compact" | "balanced" | "full" } = {}): string[] {
    const budget = options.budget ?? "balanced";
    const limits = budget === "compact"
      ? { graph: 2, semantic: 1, shortTerm: 1, memory: 2, output: 3 }
      : budget === "full"
        ? { graph: 6, semantic: 4, shortTerm: 5, memory: 7, output: 8 }
        : { graph: 4, semantic: 2, shortTerm: 2, memory: 4, output: 5 };
    const snapshot = this.getRoomMemorySnapshot(scope);
    const graphMemory = this.graph.queryVisibleClaimsSync({
      scope,
      viewer: { type: "room_public", roomId: scope.slice("room:".length).split(":")[0] },
      limit: limits.graph,
    })
      .filter(shouldInjectMemoryGraphClaimIntoPrompt)
      .map(memoryGraphClaimTextForPrompt);
    const legacyMemory = graphMemory.length > 0 ? [] : this.listCompressedMemories(scope)
      .filter((entry) => entry.status === "active")
      .slice(-limits.graph)
      .map((entry) => entry.text);
    const semanticMemory = this.listSemanticObservations(scope)
      .filter((entry) => entry.visibility === "public" || entry.visibility === "global")
      .filter(shouldInjectSemanticObservationIntoPrompt)
      .slice(0, limits.semantic)
      .map(semanticObservationTextForPrompt);
    const shortTerm = snapshot.shortTerm.slice(-limits.shortTerm).map((mention) => `${mention.kind}: ${mention.normalizedText}`);
    const memoryLines = dedupePromptMemoryLines([...graphMemory, ...legacyMemory, ...semanticMemory, ...shortTerm]).slice(0, limits.memory);
    return [
      snapshot.summary,
      ...memoryLines,
    ].filter((item) => item.trim().length > 0).slice(0, limits.output);
  }

  getRoomObserverPromptMemory(roomScope: `room:${string}`, roleId: string): string[] {
    const scope = observerScope(roomScope, roleId);
    const entries = this.roomObserverMemories.get(scope) ?? [];
    return entries
      .slice(0, 5)
      .map((entry) => {
        const tags = entry.strategyTags.length > 0 ? ` [${entry.strategyTags.join(", ")}]` : "";
        return trimMemoryText(`heard${tags}: ${entry.speaker} -> ${formatObservationTarget(entry.target)}: ${entry.text}`, 160);
      })
      .filter((item) => item.trim().length > 0);
  }

  getRoomObserverMemorySnapshot(roomScope: `room:${string}`, roleId: string): RoomObserverMemorySnapshot {
    const scope = observerScope(roomScope, roleId);
    const entries = this.roomObserverMemories.get(scope) ?? [];
    return {
      scope,
      roomScope,
      roleId,
      entries,
      summary: entries.slice(0, 5).map((entry) => `${entry.speaker}: ${entry.text}`).join(" | ") || "No observer memory yet.",
    };
  }

  listRoomObserverMemorySnapshots(roomScope: `room:${string}`): RoomObserverMemorySnapshot[] {
    return [...this.roomObserverMemories.entries()]
      .filter(([scope]) => scope.startsWith(`${roomScope}:observer:`))
      .map(([scope, entries]) => {
        const roleId = scope.slice(`${roomScope}:observer:`.length);
        return {
          scope,
          roomScope,
          roleId,
          entries,
          summary: entries.slice(0, 5).map((entry) => `${entry.speaker}: ${entry.text}`).join(" | ") || "No observer memory yet.",
        };
      });
  }

  recordFactionHuddle(input: RecordFactionHuddleInput): RoomFactionMemorySnapshot | null {
    const normalizedSummary = normalizeForMemory(input.thread.summary);
    if (!normalizedSummary || classifySensitivity(input.thread.summary) === "forbidden") {
      return null;
    }

    const existing = this.getFactionMemorySnapshot(input.roomScope, input.factionId);
    const timestamp = input.now.toISOString();
    const thread: RoomFactionHuddleThread = {
      ...input.thread,
      summary: input.thread.summary.trim().replace(/\s+/g, " "),
    };
    const entries = [thread, ...existing.entries.filter((item) => item.id !== thread.id)].slice(0, MAX_FACTION_HUDDLES);
    const snapshot: RoomFactionMemorySnapshot = {
      scope: input.scope,
      roomScope: input.roomScope,
      factionId: input.factionId,
      entries,
      summary: buildFactionSummary(entries),
      updatedAt: timestamp,
    };
    this.roomFactionMemories.set(input.scope, snapshot);
    return snapshot;
  }

  getFactionMemorySnapshot(roomScope: `room:${string}`, factionId: string): RoomFactionMemorySnapshot {
    const scope = factionScope(roomScope, factionId);
    return (
      this.roomFactionMemories.get(scope) ?? {
        scope,
        roomScope,
        factionId,
        entries: [],
        summary: "No faction huddles yet.",
        updatedAt: null,
      }
    );
  }

  listFactionMemorySnapshots(roomScope: `room:${string}`): RoomFactionMemorySnapshot[] {
    return [...this.roomFactionMemories.values()].filter((snapshot) => snapshot.roomScope === roomScope);
  }

  getFactionPromptMemory(roomScope: `room:${string}`, factionId?: string): string[] {
    if (!factionId || factionId === "neutral") {
      return [];
    }

    const snapshot = this.getFactionMemorySnapshot(roomScope, factionId);
    return [
      `faction memory: ${snapshot.summary}`,
      ...snapshot.entries.slice(0, 5).map((thread) => `huddle: ${trimMemoryText(thread.summary, 160)}`),
    ].filter((item) => item.trim().length > 0);
  }

  recordDirectorMemoryEvent(input: RecordDirectorMemoryInput): RoomDirectorMemorySnapshot {
    return this.recordDirectorMemory(input);
  }

  recordDirectorMemory(input: RecordDirectorMemoryInput): RoomDirectorMemorySnapshot {
    const existing = this.getRoomDirectorMemorySnapshot(input.scope);
    const timestamp = input.now.toISOString();
    const sensitivity = classifySensitivity(input.text);
    const snapshot: RoomDirectorMemorySnapshot = {
      ...existing,
      sceneBoard: input.sceneBoard ?? existing.sceneBoard,
      updatedAt: timestamp,
    };

    if (sensitivity === "forbidden") {
      this.roomDirectorMemories.set(input.scope, snapshot);
      return snapshot;
    }

    const sourceType = input.sourceType ?? inferDirectorSourceType(input.move);
    let incomingEntries: DirectorMemoryEntry[] = [];

    if (input.sceneBoard) {
      incomingEntries.push(createSceneBoardEntry(input, input.sceneBoard, sourceType, timestamp));
    }

    if (input.secretWrites?.length) {
      snapshot.secrets = mergeSecrets(snapshot.secrets, input.secretWrites, timestamp);
      incomingEntries.push(...input.secretWrites.map((secret) => createSecretMemoryEntry(input, secret, sourceType, timestamp)));
    } else if (input.visibility === "hidden_from_user" || input.move === "whisper") {
      const secret = createSecretEntry(input, timestamp);
      snapshot.secrets = [secret, ...snapshot.secrets.filter((item) => item.detail !== normalizeForMemory(input.text))].slice(0, 20);
      incomingEntries.push(createSecretMemoryEntry(input, secret, sourceType, timestamp));
    }

    if (input.continuityWrites?.length) {
      const continuityEntries = createContinuityEntries(input.continuityWrites, input, timestamp);
      snapshot.continuity = {
        entries: mergeContinuityEntries(snapshot.continuity.entries, continuityEntries),
      };
      incomingEntries.push(...continuityEntries.map((entry) => createDirectorEntryFromContinuity(input, entry, sourceType, timestamp)));
    } else {
      const continuity = createContinuityEntry(input, timestamp);
      if (continuity) {
        snapshot.continuity = {
          entries: [continuity, ...snapshot.continuity.entries.filter((entry) => entry.detail !== continuity.detail)].slice(0, 40),
        };
        incomingEntries.push(createDirectorEntryFromContinuity(input, continuity, sourceType, timestamp));
      }
    }

    if (input.move === "judge" && incomingEntries.every((entry) => entry.category !== "judgement")) {
      incomingEntries.push(createJudgementMemoryEntry(input, sourceType, timestamp));
    }

    if (sourceType === "director_override") {
      incomingEntries.push(createOverrideMemoryEntry(input, timestamp));
    }

    if (incomingEntries.length > 0) {
      snapshot.entries = mergeDirectorMemoryEntries(snapshot.entries, incomingEntries).slice(0, 120);
    }

    syncDirectorSnapshotLedgers(snapshot);
    snapshot.summary = buildDirectorSummary(snapshot);
    this.roomDirectorMemories.set(input.scope, snapshot);
    return snapshot;
  }

  getRoomDirectorMemorySnapshot(scope: RoomSystemMemoryScope): RoomDirectorMemorySnapshot {
    const snapshot =
      this.roomDirectorMemories.get(scope) ?? {
        scope,
        sceneBoard: {
          title: "Open Room",
          currentScene: "No Director scene has been recorded yet.",
          goal: "Keep the room easy to continue.",
          mood: "calm",
          openClues: [],
          unresolved: [],
          updatedAt: null,
        },
        continuity: { entries: [] },
        secrets: [],
        entries: [],
        knowledgeMap: [],
        constraints: [],
        judgements: [],
        overrides: [],
        summary: "Director memory is empty.",
        updatedAt: null,
      };
    return normalizeDirectorSnapshot(snapshot);
  }

  getRoomDirectorPromptMemory(scope: RoomSystemMemoryScope, roleId?: string): string[] {
    const snapshot = this.getRoomDirectorMemorySnapshot(scope);
    const directorView = !roleId;
    const visibleEntries = snapshot.entries
      .filter((entry) => entry.status !== "archived")
      .filter((entry) => directorView || (entry.status === "active" && isDirectorEntryVisibleToRole(entry, roleId)))
      .slice(0, directorView ? 32 : 6);
    const visibleSecrets = snapshot.secrets.filter((secret) => roleId && secret.knownToRoleIds.includes(roleId));
    const lines = [
      `scene: ${snapshot.sceneBoard.currentScene}`,
      `goal: ${snapshot.sceneBoard.goal}`,
      ...snapshot.sceneBoard.openClues.slice(0, 5).map((clue) => `clue: ${clue}`),
      ...visibleEntries.map((entry) => `${entry.category}: ${entry.text}`),
      ...visibleSecrets.slice(0, 3).map((secret) => `private: ${secret.detail}`),
    ].filter((item) => item.trim().length > 0);
    return trimMemoryToBudget(lines, directorView ? 2800 : 520);
  }

  buildDirectorPromptMemory(scope: RoomSystemMemoryScope, roleId?: string): string[] {
    return this.getRoomDirectorPromptMemory(scope, roleId);
  }

  buildRoomInspectorDirectorState(scope: RoomSystemMemoryScope): RoomDirectorMemorySnapshot {
    return this.getRoomDirectorMemorySnapshot(scope);
  }

  deleteRoomMemory(scope: `room:${string}`): MemoryScope[] {
    const relatedScopes = this.collectRoomMemoryScopes(scope);
    for (const relatedScope of relatedScopes) {
      this.deleteScopeMemoryRecords(relatedScope);
    }
    for (const relatedScope of relatedScopes) {
      void this.graph.deleteScope(relatedScope);
    }
    return relatedScopes;
  }

  deleteScopeMemory(scope: MemoryScope) {
    if (isPlainRoomMemoryScope(scope)) {
      this.deleteRoomMemory(scope as `room:${string}`);
      return;
    }

    this.deleteScopeMemoryRecords(scope);
    void this.graph.deleteScope(scope);
  }

  private deleteScopeMemoryRecords(scope: MemoryScope) {
    for (const [key, mention] of this.mentions.entries()) {
      if (mention.scope === scope) {
        this.mentions.delete(key);
      }
    }

    for (const [key, candidate] of this.candidates.entries()) {
      if (candidate.scope === scope) {
        this.candidates.delete(key);
      }
    }

    for (const [key, entry] of this.compressedMemories.entries()) {
      if (entry.scope === scope) {
        this.compressedMemories.delete(key);
      }
    }

    for (const [key, entry] of this.semanticObservations.entries()) {
      if (entry.scope === scope) {
        this.semanticObservations.delete(key);
      }
    }

    this.rollingSummaries.delete(scope);
    for (let index = this.versionHistory.length - 1; index >= 0; index -= 1) {
      if (this.versionHistory[index]?.scope === scope) {
        this.versionHistory.splice(index, 1);
      }
    }

    if (isPlainRoomMemoryScope(scope)) {
      this.roomMessages.delete(scope as `room:${string}`);
    }
    if (isRoomSystemMemoryScope(scope)) {
      this.roomDirectorMemories.delete(scope);
    }
    if (isRoomObserverMemoryScope(scope)) {
      this.roomObserverMemories.delete(scope);
    }
    if (isRoomFactionMemoryScope(scope)) {
      this.roomFactionMemories.delete(scope);
    }
  }

  deleteShortTermMention(mentionId: string): boolean {
    for (const [key, mention] of this.mentions.entries()) {
      if (mention.id === mentionId) {
        this.mentions.delete(key);
        return true;
      }
    }

    return false;
  }

  deleteCandidate(candidateId: string): boolean {
    const deletedCandidate = this.candidates.delete(candidateId);
    const deletedCompressed = this.compressedMemories.delete(candidateId);
    this.graph.deleteClaimSync(candidateId);
    return deletedCandidate || deletedCompressed;
  }

  archiveMemory(memoryId: string): boolean {
    const entry = this.compressedMemories.get(memoryId);
    if (!entry) {
      return false;
    }
    const archived: CompressedMemoryEntry = {
      ...entry,
      status: "archived",
      lastSeenAt: new Date().toISOString(),
    };
    this.compressedMemories.set(memoryId, archived);
    this.syncCompressedMemoryToGraph(archived);
    return true;
  }

  createCompressedMemory(input: {
    scope: MemoryScope;
    text: string;
    kind?: MemoryAtomKind;
    status?: CompressedMemoryEntry["status"];
  }): CompressedMemoryEntry | null {
    const text = trimMemoryText(stripRepeatedMemoryPrefixes(stripMemoryNoise(input.text)), MAX_COMPRESSED_FACT_CHARS);
    if (!text || classifySensitivity(text) === "forbidden") {
      return null;
    }
    if (isMemoryArtifactText(input.text) || isMemoryArtifactText(text)) {
      return null;
    }
    const kind = isEditableMemoryKind(input.kind) ? input.kind : inferMemoryKind(text);
    const status = isEditableMemoryStatus(input.status) ? input.status : "active";
    const now = new Date().toISOString();
    const memoryKey = stableMemoryKey(input.scope, text, kind, inferMemorySubject(text, input.scope));
    const id = stableId("memory-manual", `${input.scope}:${memoryKey}:${now}`);
    const entry: CompressedMemoryEntry = {
      id,
      scope: input.scope,
      memoryKey,
      kind,
      text,
      sourceIds: [],
      sourceMessageIds: [],
      evidenceCount: 1,
      confidence: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      status,
      sensitivity: classifySensitivity(text),
    };
    this.compressedMemories.set(entry.id, entry);
    this.syncCompressedMemoryToGraph(entry);
    this.candidates.set(entry.id, candidateFromCompressedEntry(entry));
    return entry;
  }

  editCompressedMemory(patch: MemoryEditPatch): CompressedMemoryEntry | null {
    const current = this.compressedMemories.get(patch.memoryId);
    if (!current || current.scope !== patch.scope) {
      return null;
    }

    const nextText = patch.text === undefined
      ? current.text
      : trimMemoryText(stripMemoryNoise(patch.text), MAX_COMPRESSED_FACT_CHARS);
    if (!nextText) {
      return null;
    }

    const nextKind = isEditableMemoryKind(patch.kind) ? patch.kind : current.kind;
    const nextStatus = isEditableMemoryStatus(patch.status) ? patch.status : current.status;
    const updatedAt = new Date().toISOString();
    const changed = nextText !== current.text || nextKind !== current.kind || nextStatus !== current.status;
    const nextEntry: CompressedMemoryEntry = {
      ...current,
      text: nextText,
      kind: nextKind,
      status: nextStatus,
      memoryKey: stableMemoryKey(current.scope, nextText, nextKind, inferMemorySubject(nextText, current.scope)),
      lastSeenAt: updatedAt,
    };

    if (changed) {
      this.versionHistory.unshift(createMemoryVersionEntry(current, nextText, "replace", updatedAt, current.sourceIds));
    }

    this.compressedMemories.set(nextEntry.id, nextEntry);
    this.syncCompressedMemoryToGraph(nextEntry);
    const candidate = this.candidates.get(nextEntry.id);
    if (candidate) {
      candidate.fact = nextText;
      candidate.text = nextText;
      candidate.lastSeenAt = updatedAt;
      candidate.confirmed = nextStatus === "active";
      candidate.requiresConfirmation = nextStatus === "needs_review" || nextStatus === "disputed";
    }
    return nextEntry;
  }

  editShortTermMention(patch: MemoryEditPatch): ShortTermMention | null {
    let currentKey: string | null = null;
    let current: ShortTermMention | null = null;
    for (const [key, mention] of this.mentions.entries()) {
      if (mention.id === patch.memoryId && mention.scope === patch.scope) {
        currentKey = key;
        current = mention;
        break;
      }
    }
    if (!current || !currentKey) {
      return null;
    }

    const nextText = patch.text === undefined
      ? current.normalizedText
      : trimMemoryText(stripMemoryNoise(patch.text), MAX_COMPRESSED_FACT_CHARS);
    if (!nextText) {
      return null;
    }

    const nextKind = isEditableMemoryKind(patch.kind) ? patch.kind : current.kind;
    const nextSubject = inferMemorySubject(nextText, current.scope);
    const nextMention: ShortTermMention = {
      ...current,
      kind: nextKind,
      subject: nextSubject,
      normalizedText: nextText,
      normalizedKey: stableMemoryKey(current.scope, nextText, nextKind, nextSubject),
      lastSeenAt: new Date().toISOString(),
    };

    this.mentions.delete(currentKey);
    this.mentions.set(`${nextMention.scope}:${nextMention.normalizedKey}`, nextMention);
    return nextMention;
  }

  promoteShortTermMention(mentionId: string): CompressedMemoryEntry | null {
    const mention = [...this.mentions.values()].find((item) => item.id === mentionId);
    if (!mention || mention.sensitivity === "forbidden") {
      return null;
    }
    const candidate = this.createCandidate(mention, mention.sensitivity);
    return this.compressedMemories.get(candidate.id) ?? null;
  }

  serializeScope(scope: MemoryScope): MemoryStoreData {
    return {
      mentions: [...this.mentions.values()].filter((item) => item.scope === scope),
      candidates: [...this.candidates.values()].filter((item) => item.scope === scope),
      compressedMemories: [...this.compressedMemories.values()].filter((item) => item.scope === scope),
      rollingSummaries: [...this.rollingSummaries.values()].filter((item) => item.scope === scope),
      semanticObservations: [...this.semanticObservations.values()].filter((item) => item.scope === scope),
      versionHistory: this.versionHistory.filter((item) => item.scope === scope),
      roomMessages: [...this.roomMessages.entries()]
        .filter(([entryScope]) => entryScope === scope)
        .map(([entryScope, messages]) => ({ scope: entryScope, messages })),
      roomDirectorMemories: [...this.roomDirectorMemories.values()].filter((item) => item.scope === scope),
      roomObserverMemories: [...this.roomObserverMemories.entries()]
        .filter(([entryScope]) => entryScope === scope)
        .map(([entryScope, entries]) => ({ scope: entryScope, entries })),
      roomFactionMemories: [...this.roomFactionMemories.values()].filter((item) => item.scope === scope),
    };
  }

  serializeCharacterPackMemoryFile(packId: string, scope: MemoryScope): CharacterPackMemoryFile {
    const data = this.serializeScope(scope);
    return {
      packId,
      scope,
      entries: data.compressedMemories ?? [],
      shortTerm: data.mentions,
      candidates: data.candidates,
      versionHistory: data.versionHistory ?? [],
      updatedAt: new Date().toISOString(),
    };
  }

  restoreScope(scope: MemoryScope, data: Partial<MemoryStoreData> | Partial<CharacterPackMemoryFile>) {
    this.deleteScopeMemory(scope);

    const fileData = data as Partial<CharacterPackMemoryFile>;
    const storeData = data as Partial<MemoryStoreData>;
    const mentions = fileData.shortTerm ?? storeData.mentions;
    const compressed = fileData.entries ?? storeData.compressedMemories;
    for (const mention of mentions ?? []) {
      if (isValidMention(mention) && mention.scope === scope) {
        const normalized = normalizeShortTermMention(mention);
        if (!normalized.normalizedText || isMemoryArtifactText(normalized.normalizedText)) {
          continue;
        }
        this.mentions.set(`${normalized.scope}:${normalized.normalizedKey}`, normalized);
      }
    }
    for (const candidate of data.candidates ?? []) {
      if (isValidCandidate(candidate) && candidate.scope === scope) {
        const normalized = {
          ...normalizeLongTermCandidate(candidate),
          id: scopeBoundRestoredMemoryId(scope, candidate.id),
          sourceScope: scope,
          scope,
        };
        if (isMemoryArtifactText(normalized.text) || isMemoryArtifactText(normalized.fact)) {
          continue;
        }
        this.candidates.set(normalized.id, normalized);
      }
    }
    for (const entry of compressed ?? []) {
      if (isValidCompressedMemory(entry) && entry.scope === scope) {
        const normalized = {
          ...normalizeCompressedEntry(entry),
          id: scopeBoundRestoredMemoryId(scope, entry.id),
          scope,
        };
        if (!normalized.text || isMemoryArtifactText(normalized.text)) {
          continue;
        }
        this.compressedMemories.set(normalized.id, normalized);
        this.syncCompressedMemoryToGraph(normalized);
        if (!this.candidates.has(normalized.id)) {
          this.candidates.set(normalized.id, candidateFromCompressedEntry(normalized));
        }
      }
    }
    for (const version of data.versionHistory ?? []) {
      if (isValidMemoryVersion(version) && version.scope === scope) {
        const memoryId = scopeBoundRestoredMemoryId(scope, version.memoryId);
        this.versionHistory.push({
          ...version,
          id: stableId("memory-version", `${scope}:${version.id}`),
          memoryId,
          scope,
        });
      }
    }
    for (const observation of storeData.semanticObservations ?? []) {
      const normalized = normalizeSemanticObservation({ ...observation, scope });
      if (normalized && normalized.scope === scope) {
        this.semanticObservations.set(normalized.id, normalized);
      }
    }
  }

  serialize(): MemoryStoreData {
    return {
      mentions: [...this.mentions.values()],
      candidates: [...this.candidates.values()],
      compressedMemories: [...this.compressedMemories.values()],
      rollingSummaries: [...this.rollingSummaries.values()],
      semanticObservations: [...this.semanticObservations.values()],
      versionHistory: [...this.versionHistory],
      roomMessages: [...this.roomMessages.entries()].map(([scope, messages]) => ({ scope, messages })),
      roomDirectorMemories: [...this.roomDirectorMemories.values()],
      roomObserverMemories: [...this.roomObserverMemories.entries()].map(([scope, entries]) => ({ scope, entries })),
      roomFactionMemories: [...this.roomFactionMemories.values()],
    };
  }

  restore(data: Partial<MemoryStoreData>) {
    const cleanData = cleanCorruptedRoomMemoryData(data);
    this.mentions.clear();
    this.candidates.clear();
    this.compressedMemories.clear();
    this.rollingSummaries.clear();
    this.semanticObservations.clear();
    this.versionHistory.length = 0;
    this.roomMessages.clear();
    this.roomDirectorMemories.clear();
    this.roomObserverMemories.clear();
    this.roomFactionMemories.clear();
    this.graph.clearSync();

    for (const mention of cleanData.mentions) {
      if (isValidMention(mention)) {
        const normalized = normalizeShortTermMention(mention);
        if (!normalized.normalizedText || isMemoryArtifactText(normalized.normalizedText)) {
          continue;
        }
        this.mentions.set(`${normalized.scope}:${normalized.normalizedKey}`, normalized);
      }
    }

    for (const candidate of cleanData.candidates) {
      if (isValidCandidate(candidate)) {
        const normalized = normalizeLongTermCandidate(candidate);
        if (isMemoryArtifactText(normalized.text) || isMemoryArtifactText(normalized.fact)) {
          continue;
        }
        this.candidates.set(normalized.id, normalized);
        if (!this.compressedMemories.has(normalized.id)) {
          const compressed = compressedEntryFromCandidate(normalized);
          this.compressedMemories.set(normalized.id, compressed);
          this.syncCompressedMemoryToGraph(compressed);
        }
      }
    }

    for (const entry of cleanData.compressedMemories ?? []) {
      if (isValidCompressedMemory(entry)) {
        const normalized = normalizeCompressedEntry(entry);
        if (!normalized.text || isMemoryArtifactText(normalized.text)) {
          continue;
        }
        this.compressedMemories.set(normalized.id, normalized);
        this.syncCompressedMemoryToGraph(normalized);
        if (!this.candidates.has(entry.id)) {
          this.candidates.set(normalized.id, candidateFromCompressedEntry(normalized));
        }
      }
    }

    for (const summary of cleanData.rollingSummaries ?? []) {
      if (isValidRollingSummary(summary)) {
        this.rollingSummaries.set(summary.scope, summary);
      }
    }

    for (const observation of cleanData.semanticObservations ?? []) {
      const normalized = normalizeSemanticObservation(observation);
      if (normalized) {
        this.semanticObservations.set(normalized.id, normalized);
      }
    }

    for (const version of cleanData.versionHistory ?? []) {
      if (isValidMemoryVersion(version)) {
        this.versionHistory.push(version);
      }
    }

    for (const entry of cleanData.roomMessages) {
      if (entry.scope.startsWith("room:") && Array.isArray(entry.messages)) {
        this.roomMessages.set(entry.scope, entry.messages.filter(isValidRoomMessage).slice(-MAX_ROOM_MESSAGES));
      }
    }

    for (const snapshot of cleanData.roomDirectorMemories) {
      if (isValidRoomDirectorMemory(snapshot)) {
        this.roomDirectorMemories.set(snapshot.scope, normalizeDirectorSnapshot(snapshot));
      }
    }

    for (const observer of cleanData.roomObserverMemories) {
      if (typeof observer.scope === "string" && observer.scope.includes(":observer:") && Array.isArray(observer.entries)) {
        this.roomObserverMemories.set(observer.scope, observer.entries.filter(isValidObservationEntry).slice(0, MAX_OBSERVER_ENTRIES));
      }
    }

    for (const faction of cleanData.roomFactionMemories ?? []) {
      if (isValidFactionMemory(faction)) {
        this.roomFactionMemories.set(faction.scope, {
          ...faction,
          entries: faction.entries.slice(0, MAX_FACTION_HUDDLES),
        });
      }
    }
  }

  confirmCandidate(candidateId: string): CandidateMemory | null {
    const candidate = [...this.candidates.values()].find((item) => item.id === candidateId);
    if (!candidate) {
      return null;
    }
    candidate.confirmed = true;
    candidate.requiresConfirmation = false;
    const current = this.compressedMemories.get(candidate.id) ?? compressedEntryFromCandidate(candidate);
    const activeEntry: CompressedMemoryEntry = {
      ...current,
      status: "active",
      text: trimMemoryText(candidate.fact, MAX_COMPRESSED_FACT_CHARS),
      lastSeenAt: new Date().toISOString(),
    };
    this.compressedMemories.set(activeEntry.id, activeEntry);
    this.syncCompressedMemoryToGraph(activeEntry);
    return candidate;
  }

  private createCandidate(mention: ShortTermMention, sensitivity: MemorySensitivity): CandidateMemory {
    const candidateId = stableId("candidate", `${mention.scope}:${mention.normalizedKey}`);
    const compressed = compressMemoryFact({
      id: candidateId,
      scope: mention.scope,
      text: mention.normalizedText,
      sourceIds: [mention.id],
      sourceMessageIds: mention.sourceMessageIds,
      evidenceCount: mention.count,
      firstSeenAt: mention.firstSeenAt,
      lastSeenAt: mention.lastSeenAt,
      sensitivity,
      memoryKey: mention.normalizedKey,
      confidence: mention.confidence,
    });
    const existing = this.candidates.get(candidateId);
    if (existing) {
      existing.evidenceCount = mention.count;
      existing.mentionCount = mention.count;
      existing.lastSeenAt = mention.lastSeenAt;
      const current = this.compressedMemories.get(candidateId);
      const conflictIds = findMemoryConflictIds(
        this.listCompressedMemories(mention.scope).filter((entry) => entry.id !== candidateId),
        compressed,
      );
      const requiresConfirmation = this.policy.requireUserConfirmation || conflictIds.length > 0;
      existing.requiresConfirmation = requiresConfirmation && !existing.confirmed;
      existing.confirmed = existing.confirmed && conflictIds.length === 0;
      const nextText = refineLongTermText(current?.text, compressed.text);
      if (current && current.text !== nextText) {
        this.versionHistory.unshift(createMemoryVersionEntry(current, nextText, "refine", mention.lastSeenAt, [mention.id]));
      }
      const nextStatus: CompressedMemoryEntry["status"] = conflictIds.length > 0
        ? "disputed"
        : existing.confirmed
          ? "active"
          : "needs_review";
      this.compressedMemories.set(candidateId, {
        ...(current ?? compressed),
        text: nextText,
        kind: compressed.kind,
        sourceIds: Array.from(new Set([...(current?.sourceIds ?? []), mention.id])),
        sourceMessageIds: mergeSourceIds(current?.sourceMessageIds ?? [], ...mention.sourceMessageIds),
        evidenceCount: mention.count,
        confidence: Math.max(current?.confidence ?? 0, compressed.confidence),
        lastSeenAt: mention.lastSeenAt,
        status: nextStatus,
        conflictWithIds: conflictIds.length > 0 ? conflictIds : current?.conflictWithIds,
      });
      this.syncCompressedMemoryToGraph(this.compressedMemories.get(candidateId));
      return existing;
    }

    const conflictIds = findMemoryConflictIds(this.listCompressedMemories(mention.scope), compressed);
    const entry: CompressedMemoryEntry = {
      ...compressed,
      status: conflictIds.length > 0 ? "disputed" : this.policy.requireUserConfirmation ? "needs_review" : "active",
      conflictWithIds: conflictIds.length > 0 ? conflictIds : undefined,
    };
    this.compressedMemories.set(entry.id, entry);
    this.syncCompressedMemoryToGraph(entry);
    if (conflictIds.length > 0) {
      this.versionHistory.unshift({
        id: stableId("memory-version", `${entry.id}:conflict:${entry.lastSeenAt}`),
        memoryId: entry.id,
        scope: entry.scope,
        previousText: conflictIds.join(", "),
        nextText: entry.text,
        reason: "conflict",
        createdAt: entry.lastSeenAt,
        sourceIds: entry.sourceIds,
      });
    }

    const candidate: CandidateMemory = {
      id: candidateId,
      sourceScope: mention.scope,
      scope: mention.scope,
      fact: entry.text,
      text: entry.text,
      evidenceCount: mention.count,
      mentionCount: mention.count,
      firstSeenAt: mention.firstSeenAt,
      lastSeenAt: mention.lastSeenAt,
      createdAt: new Date().toISOString(),
      sensitivity,
      requiresConfirmation: entry.status === "needs_review" || entry.status === "disputed",
      confirmed: entry.status === "active",
    };

    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  private syncCompressedMemoryToGraph(entry: CompressedMemoryEntry | undefined) {
    if (!entry || entry.sensitivity === "forbidden") {
      return;
    }
    const input = memoryGraphClaimFromCompressedEntry(entry);
    const inputKey = memoryClaimInputDedupeKey(input);
    const hasHigherQualityEquivalent = this.graph
      .listClaimInputsSync(entry.scope)
      .some((claim) => claim.authority !== "system" && memoryClaimInputDedupeKey(claim) === inputKey);
    if (hasHigherQualityEquivalent) {
      return;
    }
    this.graph.mergeClaimSync({
      ...input,
      id: entry.id,
    });
  }

  private syncExtractionEventToGraph(event: MemoryEvent): number {
    const claims = extractGraphClaimsFromMemoryEvent(event);
    for (const claim of claims) {
      this.graph.mergeClaimSync(claim);
    }
    return claims.length;
  }

  private pruneExpired(now: Date) {
    const cutoff = now.getTime() - this.policy.shortTermDays * DAY_MS;
    for (const [key, mention] of this.mentions.entries()) {
      if (new Date(mention.lastSeenAt).getTime() < cutoff) {
        this.mentions.delete(key);
      }
    }
  }

  private updateRollingSummary(scope: `room:${string}`): MemoryRollingSummary {
    const messages = (this.roomMessages.get(scope) ?? []).filter((message) => (message.visibility ?? "public") === "public");
    const compressed = this.listCompressedMemories(scope)
      .filter((entry) => entry.status === "active")
      .slice(-6)
      .map((entry) => entry.text);
    const shortFacts = this.listShortTerm(scope)
      .sort((left, right) => new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime())
      .slice(0, 8)
      .map((mention) => `${mention.kind}: ${mention.normalizedText}`);
    const text = updateRollingSummary(scope, [...compressed, ...shortFacts]);
    const summary: MemoryRollingSummary = {
      scope,
      text,
      sourceIds: messages.slice(-10).map((message) => message.id),
      messageCount: messages.length,
      updatedAt: new Date().toISOString(),
    };
    this.rollingSummaries.set(scope, summary);
    return summary;
  }

  private deleteRoomObserverMemories(roomScope: `room:${string}`) {
    const prefix = `${roomScope}:observer:`;
    for (const scope of this.roomObserverMemories.keys()) {
      if (scope.startsWith(prefix)) {
        this.roomObserverMemories.delete(scope);
      }
    }
  }

  private deleteRoomFactionMemories(roomScope: `room:${string}`) {
    const prefix = `${roomScope}:faction:`;
    for (const scope of this.roomFactionMemories.keys()) {
      if (scope.startsWith(prefix)) {
        this.roomFactionMemories.delete(scope);
      }
    }
  }

  private collectRoomMemoryScopes(roomScope: `room:${string}`): MemoryScope[] {
    const prefix = `${roomScope}:`;
    const scopes = new Set<MemoryScope>([roomScope, `${roomScope}:system` as MemoryScope]);
    const addIfRelated = (scope: MemoryScope) => {
      if (scope === roomScope || scope.startsWith(prefix)) {
        scopes.add(scope);
      }
    };

    for (const mention of this.mentions.values()) addIfRelated(mention.scope);
    for (const candidate of this.candidates.values()) addIfRelated(candidate.scope);
    for (const memory of this.compressedMemories.values()) addIfRelated(memory.scope);
    for (const observation of this.semanticObservations.values()) addIfRelated(observation.scope);
    for (const summaryScope of this.rollingSummaries.keys()) addIfRelated(summaryScope);
    for (const version of this.versionHistory) addIfRelated(version.scope);
    for (const messageScope of this.roomMessages.keys()) addIfRelated(messageScope);
    for (const directorScope of this.roomDirectorMemories.keys()) addIfRelated(directorScope);
    for (const observerScope of this.roomObserverMemories.keys()) addIfRelated(observerScope);
    for (const factionScope of this.roomFactionMemories.keys()) addIfRelated(factionScope);
    for (const claim of this.graph.listAllClaimsSync()) addIfRelated(claim.scope);

    return [...scopes];
  }
}

function extractGraphClaimsFromMemoryEvent(event: MemoryEvent): MemoryClaimInput[] {
  if (event.kind === "mention") {
    const sourceType: MemoryExtractionSourceType = isExplicitMemoryRequest(event.text)
      ? "user_explicit_remember"
      : event.source === "room"
        ? "character_public_message"
        : "room_public_result";
    return extractMemoryClaimsFromEvent({
      scope: event.scope,
      text: event.text,
      sourceType,
      source: {
        sourceScope: event.scope,
        messageId: event.sourceMessageId,
        speakerType: event.source,
        excerpt: event.text,
        createdAt: event.now.toISOString(),
      },
      visibility: event.scope === "global" ? "global" : event.scope.startsWith("character:") ? "private_character" : "public",
      now: event.now,
    });
  }

  if (event.kind === "room_message") {
    const input = event.input;
    return extractMemoryClaimsFromEvent({
      scope: input.scope,
      text: input.text,
      sourceType: input.visibility === "faction_huddle" ? "faction_huddle" : input.source === "room" ? "character_public_message" : "room_public_result",
      source: {
        sourceScope: input.scope,
        speakerId: input.speaker,
        speakerType: input.source,
        factionId: input.factionId,
        excerpt: input.text,
        createdAt: input.now.toISOString(),
      },
      visibility: input.visibility === "faction_huddle" ? "faction" : input.visibility === "private_ai" ? "known_to_roles" : "public",
      knownToRoleIds: input.visibleTo?.filter((target) => target.type === "role").map((target) => target.roleId),
      factionId: input.factionId,
      directorVisible: input.visibility === "private_ai" || input.visibility === "faction_huddle",
      now: input.now,
    });
  }

  if (event.kind === "room_observation") {
    const input = event.input;
    return extractMemoryClaimsFromEvent({
      scope: input.scope as MemoryScope,
      text: input.text,
      sourceType: input.visibility === "private_participant" ? "private_ai" : "character_public_message",
      source: {
        sourceScope: input.scope as MemoryScope,
        messageId: input.sourceMessageId,
        roomId: input.roomScope.slice("room:".length),
        participantId: input.roleId,
        speakerId: input.speakerId,
        speakerType: input.speakerType,
        excerpt: input.text,
        createdAt: input.now.toISOString(),
      },
      visibility: input.visibility === "private_participant" ? "known_to_roles" : "public",
      knownToRoleIds: [input.roleId],
      directorVisible: input.visibility === "private_participant",
      subject: {
        kind: "room_participant",
        canonicalKey: `${input.roomScope}:${input.roleId}`,
        displayName: input.roleId,
      },
      now: input.now,
    });
  }

  if (event.kind === "director") {
    const input = event.input as Partial<RecordDirectorMemoryInput>;
    const scope = (typeof input.scope === "string" ? input.scope : "global") as MemoryScope;
    const text = typeof input.text === "string" ? input.text : "";
    const now = input.now instanceof Date ? input.now : new Date();
    return extractMemoryClaimsFromEvent({
      scope,
      text,
      sourceType: input.move === "judge" ? "director_ruling" : "director_plot_state",
      source: {
        sourceScope: scope,
        messageId: input.sourceMessageId,
        roomId: input.roomScope?.slice("room:".length),
        speakerId: input.speaker,
        speakerType: "director",
        excerpt: text,
        createdAt: now.toISOString(),
      },
      visibility: directorKnowledgeToGraphVisibility(input.visibility),
      knownToRoleIds: input.visibleToRoleIds,
      directorVisible: true,
      authority: "director",
      now,
    });
  }

  if (event.kind === "faction_huddle") {
    const input = event.input as Partial<RecordFactionHuddleInput>;
    const scope = (typeof input.scope === "string" ? input.scope : "global") as MemoryScope;
    const thread = input.thread;
    const text = typeof thread?.summary === "string"
      ? thread.summary
      : (thread?.entries ?? []).map((entry) => entry.text).join(" ");
    const now = input.now instanceof Date ? input.now : new Date();
    return extractMemoryClaimsFromEvent({
      scope,
      text,
      sourceType: "faction_huddle",
      source: {
        sourceScope: scope,
        roomId: input.roomScope?.slice("room:".length),
        factionId: input.factionId,
        speakerType: "faction",
        excerpt: text,
        createdAt: now.toISOString(),
      },
      visibility: "faction",
      factionId: input.factionId,
      directorVisible: true,
      now,
    });
  }

  return [];
}

function directorKnowledgeToGraphVisibility(visibility: RoomKnowledgeVisibility | undefined) {
  if (visibility === "known_to_roles" || visibility === "known_to_user") {
    return "known_to_roles";
  }
  if (visibility === "hidden_from_user") {
    return "director_only";
  }
  return "public";
}

function isEditableMemoryKind(value: MemoryAtomKind | undefined): value is MemoryAtomKind {
  return typeof value === "string" && editableMemoryKinds.includes(value);
}

function isEditableMemoryStatus(value: CompressedMemoryEntry["status"] | undefined): value is CompressedMemoryEntry["status"] {
  return typeof value === "string" && editableMemoryStatuses.includes(value);
}

function isPlainRoomMemoryScope(scope: MemoryScope): boolean {
  return (
    scope.startsWith("room:") &&
    !scope.includes(":system") &&
    !scope.includes(":observer:") &&
    !scope.includes(":faction:") &&
    !scope.includes(":role:")
  );
}

function isRoomSystemMemoryScope(scope: MemoryScope): scope is RoomSystemMemoryScope {
  return scope.startsWith("room:") && scope.endsWith(":system");
}

function isRoomObserverMemoryScope(scope: MemoryScope): scope is RoomObserverMemoryScope {
  return scope.startsWith("room:") && scope.includes(":observer:");
}

function isRoomFactionMemoryScope(scope: MemoryScope): scope is RoomFactionMemoryScope {
  return scope.startsWith("room:") && scope.includes(":faction:");
}

function isValidMention(value: ShortTermMention): boolean {
  return typeof value.id === "string" && typeof value.scope === "string" && typeof value.normalizedText === "string";
}

function isValidRoomDirectorMemory(value: RoomDirectorMemorySnapshot): boolean {
  return (
    typeof value.scope === "string" &&
    value.scope.startsWith("room:") &&
    value.scope.endsWith(":system") &&
    Boolean(value.sceneBoard) &&
    Boolean(value.continuity) &&
    Array.isArray(value.secrets)
  );
}

function isValidObservationEntry(value: RoomObservationEntry): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.scope === "string" &&
    value.scope.includes(":observer:") &&
    typeof value.roleId === "string" &&
    typeof value.text === "string"
  );
}

function isValidFactionMemory(value: RoomFactionMemorySnapshot): boolean {
  return (
    typeof value.scope === "string" &&
    value.scope.includes(":faction:") &&
    typeof value.factionId === "string" &&
    Array.isArray(value.entries)
  );
}

function isValidCandidate(value: CandidateMemory): boolean {
  return typeof value.id === "string" && typeof value.scope === "string" && typeof value.fact === "string";
}

function isValidCompressedMemory(value: CompressedMemoryEntry): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.scope === "string" &&
    typeof value.text === "string" &&
    typeof value.evidenceCount === "number" &&
    Array.isArray(value.sourceIds)
  );
}

function isValidRollingSummary(value: MemoryRollingSummary): boolean {
  return typeof value.scope === "string" && typeof value.text === "string" && Array.isArray(value.sourceIds);
}

function normalizeSemanticObservation(value: Partial<SemanticMemoryObservation>): SemanticMemoryObservation | null {
  if (typeof value.id !== "string" || typeof value.scope !== "string" || typeof value.text !== "string") {
    return null;
  }
  const text = semanticObservationText(value.text);
  if (!text || classifySensitivity(text) === "forbidden" || isMemoryArtifactText(text)) {
    return null;
  }
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString();
  const lastUpdatedAt = typeof value.lastUpdatedAt === "string" ? value.lastUpdatedAt : createdAt;
  const sourceMessageIds = Array.isArray(value.sourceMessageIds)
    ? value.sourceMessageIds.filter((item): item is string => typeof item === "string")
    : [];
  return {
    id: value.id,
    scope: value.scope as MemoryScope,
    subjectId: typeof value.subjectId === "string" ? value.subjectId : undefined,
    subjectType: semanticSubjectType(value.subjectType),
    subjectName: typeof value.subjectName === "string" ? trimMemoryText(value.subjectName, 80) : undefined,
    kind: semanticObservationKind(value.kind),
    text,
    epistemicStatus: semanticEpistemicStatus(value.epistemicStatus),
    confidence: clampNumber(value.confidence ?? 0.45, 0.1, 0.98),
    evidenceCount: Math.max(1, Math.round(value.evidenceCount ?? sourceMessageIds.length ?? 1)),
    sourceMessageIds,
    visibility: semanticVisibility(value.visibility),
    createdAt,
    lastUpdatedAt,
  };
}

function isValidMemoryVersion(value: MemoryVersionEntry): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.memoryId === "string" &&
    typeof value.scope === "string" &&
    typeof value.previousText === "string" &&
    typeof value.nextText === "string" &&
    Array.isArray(value.sourceIds)
  );
}

function normalizeLongTermCandidate(candidate: CandidateMemory): CandidateMemory {
  return {
    ...candidate,
    requiresConfirmation: false,
    confirmed: true,
  };
}

function normalizeShortTermMention(mention: ShortTermMention): ShortTermMention {
  const text = semanticMemoryText(mention.normalizedText, mention.scope, mention.source);
  const kind = mention.kind ?? inferMemoryKind(text);
  const subject = mention.subject ?? inferMemorySubject(text, mention.scope);
  const normalizedKey = mention.normalizedKey ?? stableMemoryKey(mention.scope, text, kind, subject);
  const firstSeenAt = mention.firstSeenAt || new Date().toISOString();
  const lastSeenAt = mention.lastSeenAt || firstSeenAt;
  return {
    ...mention,
    kind,
    subject,
    normalizedText: text,
    normalizedKey,
    confidence: mention.confidence ?? 0.45,
    sensitivity: mention.sensitivity ?? classifySensitivity(text),
    sourceMessageIds: mention.sourceMessageIds ?? [],
    firstSeenAt,
    lastSeenAt,
    expiresAt: mention.expiresAt ?? new Date(new Date(lastSeenAt).getTime() + 7 * DAY_MS).toISOString(),
  };
}

function normalizeCompressedEntry(entry: CompressedMemoryEntry): CompressedMemoryEntry {
  const kind = entry.kind ?? inferMemoryKind(entry.text);
  return {
    ...entry,
    kind,
    memoryKey: entry.memoryKey ?? stableMemoryKey(entry.scope, entry.text, kind, inferMemorySubject(entry.text, entry.scope)),
    text: trimMemoryText(stripMemoryNoise(entry.text), MAX_COMPRESSED_FACT_CHARS),
    sourceMessageIds: entry.sourceMessageIds ?? [],
    confidence: entry.confidence ?? Math.min(1, Math.max(0.45, entry.evidenceCount / 3)),
    status: isEditableMemoryStatus(entry.status) ? entry.status : "active",
  };
}

function scopeBoundRestoredMemoryId(scope: MemoryScope, id: string): string {
  const prefix = `scoped-${stableId("memory-scope", scope)}-`;
  return id.startsWith(prefix) ? id : `${prefix}${id}`;
}

function compressedEntryFromCandidate(candidate: CandidateMemory): CompressedMemoryEntry {
  return {
    id: candidate.id,
    scope: candidate.scope,
    memoryKey: stableMemoryKey(candidate.scope, candidate.fact),
    kind: inferMemoryKind(candidate.fact),
    text: trimMemoryText(candidate.fact, MAX_COMPRESSED_FACT_CHARS),
    sourceIds: [candidate.id],
    sourceMessageIds: [],
    evidenceCount: candidate.evidenceCount,
    confidence: Math.min(1, Math.max(0.45, candidate.evidenceCount / 3)),
    firstSeenAt: candidate.firstSeenAt,
    lastSeenAt: candidate.lastSeenAt,
    status: candidate.confirmed ? "active" : "needs_review",
    sensitivity: candidate.sensitivity,
  };
}

function compressedEntryFromGraphClaim(claim: MemoryGraphClaim): CompressedMemoryEntry {
  const kind = editableMemoryKinds.includes(claim.kind as MemoryAtomKind) ? (claim.kind as MemoryAtomKind) : "fact";
  const status = editableMemoryStatuses.includes(claim.status as CompressedMemoryEntry["status"])
    ? (claim.status as CompressedMemoryEntry["status"])
    : "active";
  return normalizeCompressedEntry({
    id: claim.id,
    scope: claim.scope,
    memoryKey: claim.canonicalKey || stableMemoryKey(claim.scope, claim.text, kind, inferMemorySubject(claim.text, claim.scope)),
    kind,
    text: claim.text,
    sourceIds: Array.isArray(claim.properties.sourceIds) ? claim.properties.sourceIds.filter((item): item is string => typeof item === "string") : [claim.id],
    sourceMessageIds: Array.isArray(claim.properties.sourceMessageIds)
      ? claim.properties.sourceMessageIds.filter((item): item is string => typeof item === "string")
      : [],
    evidenceCount: claim.evidenceCount,
    confidence: claim.confidence,
    firstSeenAt: claim.firstSeenAt,
    lastSeenAt: claim.lastSeenAt,
    status,
    sensitivity: claim.sensitivity,
    previousVersionId: typeof claim.properties.previousVersionId === "string" ? claim.properties.previousVersionId : undefined,
    supersededById: typeof claim.properties.supersededById === "string" ? claim.properties.supersededById : undefined,
    conflictWithIds: Array.isArray(claim.properties.conflictWithIds)
      ? claim.properties.conflictWithIds.filter((item): item is string => typeof item === "string")
      : undefined,
  });
}

function dedupeCompressedMemoryEntries(entries: CompressedMemoryEntry[]): CompressedMemoryEntry[] {
  const bestByKey = new Map<string, CompressedMemoryEntry>();
  for (const entry of entries) {
    const normalized = normalizeCompressedEntry(entry);
    const key = `${normalized.scope}:${normalized.status}:${normalized.kind}:${normalizedMemoryFactDedupeKey(normalized.text)}`;
    const existing = bestByKey.get(key);
    if (!existing || compressedMemoryEntryQualityScore(normalized) > compressedMemoryEntryQualityScore(existing)) {
      bestByKey.set(key, normalized);
    }
  }
  return [...bestByKey.values()].sort((left, right) => {
    const statusDelta = memoryStatusSortWeight(right.status) - memoryStatusSortWeight(left.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }
    if (right.evidenceCount !== left.evidenceCount) {
      return right.evidenceCount - left.evidenceCount;
    }
    return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
  });
}

function compressedMemoryEntryQualityScore(entry: CompressedMemoryEntry): number {
  return entry.confidence * 100 + entry.evidenceCount * 5 + memoryStatusSortWeight(entry.status);
}

function memoryStatusSortWeight(status: CompressedMemoryEntry["status"]): number {
  if (status === "active") {
    return 30;
  }
  if (status === "disputed") {
    return 20;
  }
  if (status === "superseded") {
    return 10;
  }
  return 0;
}

function candidateFromCompressedEntry(entry: CompressedMemoryEntry): CandidateMemory {
  return {
    id: entry.id,
    sourceScope: entry.scope,
    scope: entry.scope,
    fact: entry.text,
    text: entry.text,
    evidenceCount: entry.evidenceCount,
    mentionCount: entry.evidenceCount,
    firstSeenAt: entry.firstSeenAt,
    lastSeenAt: entry.lastSeenAt,
    createdAt: entry.firstSeenAt,
    sensitivity: entry.sensitivity,
    requiresConfirmation: false,
    confirmed: entry.status === "active",
  };
}

function isValidRoomMessage(value: RoomMemoryMessage): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.scope === "string" &&
    value.scope.startsWith("room:") &&
    typeof value.text === "string"
  );
}

function buildRoomSummary(messages: RoomMemoryMessage[], confirmed: CandidateMemory[]): string {
  const confirmedFacts = confirmed.map((candidate) => candidate.fact).slice(-3);

  if (confirmedFacts.length === 0 && messages.length === 0) {
    return "No room memory yet.";
  }

  return confirmedFacts.length > 0
    ? confirmedFacts.map((fact) => `confirmed: ${fact}`).join(" | ")
    : `Room has ${messages.length} message${messages.length === 1 ? "" : "s"}, but no semantic memory yet.`;
}

function buildDirectorSummary(snapshot: RoomDirectorMemorySnapshot): string {
  const clues = snapshot.sceneBoard.openClues.slice(0, 3).join(" / ") || "no open clues";
  const continuity = snapshot.continuity.entries.slice(0, 3).map((entry) => entry.detail).join(" / ") || "no continuity entries";
  const secrets = snapshot.secrets.length;
  const constraints = snapshot.constraints.filter((entry) => entry.status === "active").length;
  const judgements = snapshot.judgements.length;
  return `Scene: ${snapshot.sceneBoard.currentScene} | Clues: ${clues} | Continuity: ${continuity} | Constraints: ${constraints} | Judgements: ${judgements} | Secrets: ${secrets}`;
}

function buildFactionSummary(entries: RoomFactionHuddleThread[]): string {
  const recent = entries.slice(0, 4).map((thread) => thread.summary).filter(Boolean);
  return recent.length > 0 ? recent.join(" | ") : "No faction huddles yet.";
}

function normalizeDirectorSnapshot(snapshot: RoomDirectorMemorySnapshot): RoomDirectorMemorySnapshot {
  const normalized: RoomDirectorMemorySnapshot = {
    ...snapshot,
    continuity: snapshot.continuity ?? { entries: [] },
    secrets: snapshot.secrets ?? [],
    entries: snapshot.entries ?? [],
    knowledgeMap: snapshot.knowledgeMap ?? [],
    constraints: snapshot.constraints ?? [],
    judgements: snapshot.judgements ?? [],
    overrides: snapshot.overrides ?? [],
    summary: snapshot.summary || "Director memory is empty.",
    updatedAt: snapshot.updatedAt ?? null,
  };

  if (normalized.entries.length === 0) {
    normalized.entries = [
      ...normalized.continuity.entries.map((entry) => createDirectorEntryFromLegacyContinuity(snapshot.scope, entry)),
      ...normalized.secrets.map((secret) => createDirectorEntryFromLegacySecret(snapshot.scope, secret)),
    ];
  }

  syncDirectorSnapshotLedgers(normalized);
  normalized.summary = buildDirectorSummary(normalized);
  return normalized;
}

function syncDirectorSnapshotLedgers(snapshot: RoomDirectorMemorySnapshot): RoomDirectorMemorySnapshot {
  snapshot.entries = (snapshot.entries ?? []).slice(0, 120);
  snapshot.knowledgeMap = snapshot.entries.filter((entry) => entry.category === "knowledge");
  snapshot.constraints = snapshot.entries.filter((entry) => entry.category === "constraint");
  snapshot.judgements = snapshot.entries.filter((entry) => entry.category === "judgement");
  snapshot.overrides = snapshot.entries.filter((entry) => entry.category === "override");
  return snapshot;
}

function inferDirectorSourceType(move: RoomDirectorMove): DirectorMemorySourceType {
  if (move === "judge") {
    return "director_judge";
  }
  return "director_move";
}

function createSceneBoardEntry(
  input: RecordDirectorMemoryInput,
  sceneBoard: RoomSceneBoard,
  sourceType: DirectorMemorySourceType,
  timestamp: string,
): DirectorMemoryEntry {
  const text = trimMemoryText(
    `${sceneBoard.currentScene || "Scene"} | goal: ${sceneBoard.goal || "keep the room moving"}`,
    MAX_COMPRESSED_FACT_CHARS,
  );
  return createDirectorMemoryEntry({
    input,
    category: "scene",
    key: "scene_board",
    text,
    visibility: "public",
    knownToRoleIds: [],
    sourceType,
    timestamp,
    confidence: 0.9,
  });
}

function createSecretMemoryEntry(
  input: RecordDirectorMemoryInput,
  secret: RoomSecretEntry,
  sourceType: DirectorMemorySourceType,
  timestamp: string,
): DirectorMemoryEntry {
  return createDirectorMemoryEntry({
    input,
    category: "secret",
    key: `secret:${stableMemorySegment(secret.title || secret.detail)}`,
    text: secret.detail,
    visibility: secret.visibility ?? "hidden_from_user",
    knownToRoleIds: secret.knownToRoleIds,
    sourceType,
    timestamp,
    confidence: 0.82,
  });
}

function createDirectorEntryFromContinuity(
  input: RecordDirectorMemoryInput,
  entry: RoomContinuityEntry,
  sourceType: DirectorMemorySourceType,
  timestamp: string,
): DirectorMemoryEntry {
  const category = inferDirectorCategory(entry.label, entry.detail, input.move);
  return createDirectorMemoryEntry({
    input,
    category,
    key: directorFactKey(category, entry.label, entry.detail),
    text: entry.detail,
    visibility: entry.visibility,
    knownToRoleIds: entry.ownerRoleIds,
    sourceType,
    timestamp,
    confidence: entry.status === "needs_review" || entry.status === "conflict" ? 0.48 : 0.78,
    status: entry.status === "resolved" ? "resolved" : entry.status === "needs_review" || entry.status === "conflict" ? "disputed" : "active",
  });
}

function createJudgementMemoryEntry(
  input: RecordDirectorMemoryInput,
  sourceType: DirectorMemorySourceType,
  timestamp: string,
): DirectorMemoryEntry {
  return createDirectorMemoryEntry({
    input,
    category: "judgement",
    key: `judgement:${stableMemorySegment(input.sourceMessageId ?? input.text)}`,
    text: normalizeForMemory(input.text),
    visibility: input.visibility ?? "public",
    knownToRoleIds: input.visibleToRoleIds ?? [],
    sourceType,
    timestamp,
    confidence: 0.75,
  });
}

function createOverrideMemoryEntry(input: RecordDirectorMemoryInput, timestamp: string): DirectorMemoryEntry {
  return createDirectorMemoryEntry({
    input,
    category: "override",
    key: `override:${stableMemorySegment(input.sourceMessageId ?? input.text)}`,
    text: normalizeForMemory(input.text),
    visibility: input.visibility ?? "public",
    knownToRoleIds: input.visibleToRoleIds ?? [],
    sourceType: "director_override",
    timestamp,
    confidence: 1,
  });
}

function createDirectorMemoryEntry(input: {
  input: RecordDirectorMemoryInput;
  category: DirectorMemoryCategory;
  key: string;
  text: string;
  visibility: RoomKnowledgeVisibility;
  knownToRoleIds: string[];
  sourceType: DirectorMemorySourceType;
  timestamp: string;
  confidence: number;
  status?: DirectorMemoryEntry["status"];
}): DirectorMemoryEntry {
  const sourceMessageIds = input.input.sourceMessageId ? [input.input.sourceMessageId] : [];
  return {
    id: stableId("director-memory", `${input.input.scope}:${input.category}:${input.key}:${input.text}:${input.timestamp}`),
    roomId: roomIdFromSystemScope(input.input.scope),
    category: input.category,
    key: input.key,
    text: trimMemoryText(stripMemoryNoise(input.text), MAX_COMPRESSED_FACT_CHARS),
    status: input.status ?? "active",
    visibility: input.visibility,
    knownToRoleIds: input.knownToRoleIds,
    sourceMessageIds,
    sourceType: input.sourceType,
    confidence: clampNumber(input.confidence, 0, 1),
    firstSeenAt: input.timestamp,
    lastUpdatedAt: input.timestamp,
    version: 1,
  };
}

function mergeDirectorMemoryEntries(current: DirectorMemoryEntry[], incoming: DirectorMemoryEntry[]): DirectorMemoryEntry[] {
  let next = [...current];
  for (const entry of incoming.filter((item) => item.text.trim().length > 0)) {
    next = upsertDirectorEntry(next, entry);
  }
  return next.sort((left, right) => new Date(right.lastUpdatedAt).getTime() - new Date(left.lastUpdatedAt).getTime());
}

function upsertDirectorEntry(current: DirectorMemoryEntry[], incoming: DirectorMemoryEntry): DirectorMemoryEntry[] {
  const sameKeyEntries = current.filter((entry) => entry.category === incoming.category && entry.key === incoming.key && entry.status !== "archived");
  const sameKey = sameKeyEntries.find((entry) => entry.status === "active") ?? sameKeyEntries[0];
  if (!sameKey) {
    const conflicts = detectDirectorMemoryConflict(incoming, current);
    return conflicts.length > 0
      ? [{ ...incoming, status: "disputed", conflictWithIds: conflicts.map((entry) => entry.id) }, ...current]
      : [incoming, ...current];
  }

  if (normalizeForMemory(sameKey.text) === normalizeForMemory(incoming.text)) {
    return current.map((entry) =>
      entry.id === sameKey.id
        ? {
            ...entry,
            confidence: Math.max(entry.confidence, incoming.confidence),
            sourceMessageIds: mergeSourceIds(entry.sourceMessageIds, ...incoming.sourceMessageIds),
            lastUpdatedAt: incoming.lastUpdatedAt,
          }
        : entry,
    );
  }

  if (incoming.sourceType === "director_override") {
    const nextIncoming: DirectorMemoryEntry = {
      ...incoming,
      id: stableId("director-memory", `${incoming.id}:v${sameKey.version + 1}`),
      status: "active",
      previousEntryId: sameKey.id,
      version: sameKey.version + 1,
    };
    return [
      nextIncoming,
      ...current.map((entry): DirectorMemoryEntry =>
        entry.category === incoming.category && entry.key === incoming.key && entry.status !== "archived"
          ? { ...entry, status: "archived", conflictWithIds: [nextIncoming.id] }
          : entry,
      ),
    ];
  }

  const disputed: DirectorMemoryEntry = {
    ...incoming,
    status: "disputed",
    conflictWithIds: [sameKey.id],
  };
  return [disputed, ...current];
}

export function detectDirectorMemoryConflict(incoming: DirectorMemoryEntry, existing: DirectorMemoryEntry[]): DirectorMemoryEntry[] {
  if (!["item", "constraint", "knowledge", "secret", "scene"].includes(incoming.category)) {
    return [];
  }
  return existing.filter(
    (entry) =>
      entry.status === "active" &&
      entry.category === incoming.category &&
      entry.key === incoming.key &&
      normalizeForMemory(entry.text) !== normalizeForMemory(incoming.text),
  );
}

function createDirectorEntryFromLegacyContinuity(scope: RoomSystemMemoryScope, entry: RoomContinuityEntry): DirectorMemoryEntry {
  const category = inferDirectorCategory(entry.label, entry.detail, "recap");
  const timestamp = entry.updatedAt || new Date().toISOString();
  return {
    id: stableId("director-memory", `${scope}:legacy:${entry.id}`),
    roomId: roomIdFromSystemScope(scope),
    category,
    key: directorFactKey(category, entry.label, entry.detail),
    text: entry.detail,
    status: entry.status === "resolved" ? "resolved" : entry.status === "conflict" || entry.status === "needs_review" ? "disputed" : "active",
    visibility: entry.visibility,
    knownToRoleIds: entry.ownerRoleIds,
    sourceMessageIds: entry.sourceMessageId ? [entry.sourceMessageId] : [],
    sourceType: "system_event",
    confidence: 0.68,
    firstSeenAt: timestamp,
    lastUpdatedAt: timestamp,
    version: 1,
  };
}

function createDirectorEntryFromLegacySecret(scope: RoomSystemMemoryScope, secret: RoomSecretEntry): DirectorMemoryEntry {
  const timestamp = secret.createdAt || new Date().toISOString();
  return {
    id: stableId("director-memory", `${scope}:legacy:${secret.id}`),
    roomId: roomIdFromSystemScope(scope),
    category: "secret",
    key: `secret:${stableMemorySegment(secret.title || secret.detail)}`,
    text: secret.detail,
    status: secret.revealedToUser ? "resolved" : "active",
    visibility: secret.visibility ?? "hidden_from_user",
    knownToRoleIds: secret.knownToRoleIds,
    sourceMessageIds: secret.sourceMessageId ? [secret.sourceMessageId] : [],
    sourceType: "system_event",
    confidence: 0.68,
    firstSeenAt: timestamp,
    lastUpdatedAt: timestamp,
    version: 1,
  };
}

function isDirectorEntryVisibleToRole(entry: DirectorMemoryEntry, roleId?: string): boolean {
  if (entry.visibility === "public") {
    return true;
  }
  if (!roleId) {
    return false;
  }
  return entry.visibility === "known_to_roles" || entry.visibility === "hidden_from_user"
    ? entry.knownToRoleIds.includes(roleId)
    : false;
}

export function resolveDirectorMemoryVisibility(
  entry: DirectorMemoryEntry,
  viewer: { type: "director" } | { type: "role"; roleId: string } | { type: "user" },
): boolean {
  if (viewer.type === "director") {
    return true;
  }
  if (viewer.type === "user") {
    return entry.visibility === "public" || entry.visibility === "known_to_user";
  }
  return isDirectorEntryVisibleToRole(entry, viewer.roleId);
}

export function upsertDirectorContinuity(entries: DirectorMemoryEntry[], incoming: DirectorMemoryEntry): DirectorMemoryEntry[] {
  return upsertDirectorEntry(entries, incoming.category === "item" || incoming.category === "scene" ? incoming : { ...incoming, category: "knowledge" });
}

export function upsertDirectorConstraint(entries: DirectorMemoryEntry[], incoming: DirectorMemoryEntry): DirectorMemoryEntry[] {
  return upsertDirectorEntry(entries, { ...incoming, category: "constraint" });
}

function createSecretEntry(input: RecordDirectorMemoryInput, timestamp: string): RoomSecretEntry {
  const detail = normalizeForMemory(input.text);
  return {
    id: stableId("room-secret", `${input.scope}:${timestamp}:${detail}`),
    title: moveTitle(input.move),
    detail,
    knownToRoleIds: input.visibleToRoleIds ?? [],
    revealedToUser: false,
    visibility: "hidden_from_user",
    sourceMessageId: input.sourceMessageId,
    createdAt: timestamp,
  };
}

function mergeSecrets(current: RoomSecretEntry[], writes: RoomSecretEntry[], timestamp: string): RoomSecretEntry[] {
  const next = writes.map((write) => ({
    ...write,
    id: write.id || stableId("room-secret", `${timestamp}:${write.title}:${write.detail}`),
    createdAt: write.createdAt || timestamp,
  }));
  const writeKeys = new Set(next.map((secret) => normalizeForMemory(secret.detail)));
  return [...next, ...current.filter((secret) => !writeKeys.has(normalizeForMemory(secret.detail)))].slice(0, 20);
}

function createContinuityEntries(
  writes: ContinuityWrite[],
  input: RecordDirectorMemoryInput,
  timestamp: string,
): RoomContinuityEntry[] {
  return writes.map((write) => ({
    id: stableId("room-continuity", `${input.scope}:${write.label}:${write.detail}`),
    label: write.label,
    detail: write.detail.trim().replace(/\s+/g, " ").replace(/[。！？!?.,，]+$/u, ""),
    visibility: write.visibility,
    ownerRoleIds: write.ownerRoleIds,
    status: write.status,
    sourceMessageId: input.sourceMessageId,
    updatedAt: timestamp,
  }));
}

function mergeContinuityEntries(current: RoomContinuityEntry[], entries: RoomContinuityEntry[]): RoomContinuityEntry[] {
  const writeKeys = new Set(entries.map((entry) => normalizeForMemory(entry.detail)));
  return [...entries, ...current.filter((entry) => !writeKeys.has(normalizeForMemory(entry.detail)))].slice(0, 40);
}

function createContinuityEntry(input: RecordDirectorMemoryInput, timestamp: string): RoomContinuityEntry | null {
  const detail = normalizeForMemory(input.text);
  if (!detail || input.move === "pause") {
    return null;
  }

  const visibility = input.visibility ?? "public";
  return {
    id: stableId("room-continuity", `${input.scope}:${input.move}:${detail}`),
    label: moveTitle(input.move),
    detail,
    visibility,
    ownerRoleIds: input.visibleToRoleIds ?? inferOwnerRoleIds(input.text),
    status: detail.includes("conflict") || detail.includes("冲突") ? "needs_review" : "active",
    sourceMessageId: input.sourceMessageId,
    updatedAt: timestamp,
  };
}

function moveTitle(move: RoomDirectorMove): string {
  const titles: Record<RoomDirectorMove, string> = {
    cue: "Clue",
    twist: "Twist",
    choice: "Choice",
    judge: "Judgement",
    recap: "Recap",
    whisper: "Secret",
    pause: "Pause",
  };
  return titles[move];
}

function inferOwnerRoleIds(text: string): string[] {
  const match = text.match(/@([a-zA-Z0-9_-]+)/);
  return match?.[1] ? [match[1]] : [];
}

function inferDirectorCategory(label: string, detail: string, move: RoomDirectorMove): DirectorMemoryCategory {
  const text = `${label} ${detail}`;
  if (/(secret|hidden|秘密|不可见)/i.test(text)) {
    return "secret";
  }
  if (/(constraint|condition|locked|permission|door|floor|限制|条件|锁|门|权限|通行|二楼)/i.test(text)) {
    return "constraint";
  }
  if (/(item|owner|key|card|map|物品|归属|钥匙|门禁卡|地图|道具)/i.test(text)) {
    return "item";
  }
  if (/(scene|clue|goal|location|场景|目标|线索|地点)/i.test(text)) {
    return "scene";
  }
  if (move === "judge" || /(judgement|judge|裁判|判定|结果)/i.test(text)) {
    return "judgement";
  }
  return "knowledge";
}

function directorFactKey(category: DirectorMemoryCategory, label: string, detail: string): string {
  return `${category}:${stableMemorySegment(`${label}:${directorConflictSubject(detail) || detail}`)}`;
}

function directorConflictSubject(text: string): string {
  if (/钥匙|key/i.test(text)) {
    return "key_owner";
  }
  if (/二楼|second floor/i.test(text)) {
    return "second_floor";
  }
  if (/门|door/i.test(text)) {
    return "door_state";
  }
  const role = text.match(/\b(Mio|Rin|Kai)\b/i)?.[1] ?? text.match(/@([a-zA-Z0-9_-]+)/)?.[1];
  return role ? role.toLowerCase() : normalizeForMemory(text).slice(0, 32);
}

function stableMemorySegment(value: string): string {
  return normalizeForMemory(value)
    .toLowerCase()
    .replace(/[^a-z0-9_\-\u4e00-\u9fff]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || "fact";
}

function roomIdFromSystemScope(scope: RoomSystemMemoryScope): string {
  return scope.replace(/^room:/, "").replace(/:system$/, "");
}

function observerScope(roomScope: `room:${string}`, roleId: string): RoomObserverMemoryScope {
  return `${roomScope}:observer:${roleId}` as RoomObserverMemoryScope;
}

function factionScope(roomScope: `room:${string}`, factionId: string): RoomFactionMemoryScope {
  return `${roomScope}:faction:${safeFactionSegment(factionId)}` as RoomFactionMemoryScope;
}

function safeFactionSegment(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 32) || "neutral";
}

function formatObservationTarget(target: RoomObservationEntry["target"]): string {
  if (!target || target === "all") {
    return "All";
  }
  return target.targets
    .map((item) => {
      if (item.type === "user") {
        return "@user";
      }
      if (item.type === "room_director") {
        return "@director";
      }
      return `@${item.roleId}`;
    })
    .join(" ");
}

function dedupeTags(tags: RoomObservationTag[]): RoomObservationTag[] {
  return Array.from(new Set(tags));
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function semanticObservationDraftsFromRoomMessage(roomScope: `room:${string}`, message: RoomMemoryMessage): SemanticObservationDraft[] {
  const clean = semanticObservationSourceText(message.text);
  if (!clean || !hasSemanticObservationSignal(clean, message)) {
    return [];
  }
  const kind = inferSemanticObservationKind(clean, message);
  const epistemicStatus = inferSemanticEpistemicStatus(clean, kind, message);
  const subjectType = semanticSubjectTypeFromSpeaker(message.speakerType);
  const subjectName = message.speaker || subjectType;
  const baseText = semanticObservationSentence(subjectName, kind, epistemicStatus, clean);
  const roomDraft: SemanticObservationDraft = {
    scope: roomScope,
    subjectId: message.speakerId,
    subjectType,
    subjectName,
    kind,
    text: baseText,
    epistemicStatus,
    confidence: semanticObservationConfidence(kind, epistemicStatus, clean),
    sourceMessageIds: [message.id],
    visibility: "public",
  };
  if (message.speakerType === "role" && message.speakerId) {
    const roleScope = `${roomScope}:role:${message.speakerId}` as MemoryScope;
    return [
      roomDraft,
      {
        ...roomDraft,
        scope: roleScope,
        subjectType: "role",
        subjectId: message.speakerId,
        text: semanticRoleObservationSentence(subjectName, kind, epistemicStatus, clean),
      },
    ];
  }
  return [roomDraft];
}

function semanticObservationDraftsFromObserverEntry(entry: RoomObservationEntry): SemanticObservationDraft[] {
  const clean = semanticObservationSourceText(entry.text);
  if (!clean || !hasSemanticObservationSignal(clean, { speakerType: entry.speakerType, source: "room" } as RoomMemoryMessage)) {
    return [];
  }
  const kind = inferSemanticObservationKind(clean, { speakerType: entry.speakerType, source: "room" } as RoomMemoryMessage);
  const subjectType = semanticSubjectTypeFromSpeaker(entry.speakerType);
  return [
    {
      scope: entry.scope,
      subjectId: entry.speakerId,
      subjectType,
      subjectName: entry.speaker,
      kind,
      text: semanticObservationSentence(entry.speaker, kind, inferSemanticEpistemicStatus(clean, kind), clean),
      epistemicStatus: inferSemanticEpistemicStatus(clean, kind),
      confidence: Math.max(0.45, entry.importance / 120),
      sourceMessageIds: entry.sourceMessageId ? [entry.sourceMessageId] : [],
      visibility: "private_character",
    },
  ];
}

function semanticObservationDraftsFromFactionThread(scope: RoomFactionMemoryScope, thread: RoomFactionHuddleThread): SemanticObservationDraft[] {
  const clean = semanticObservationSourceText(thread.summary);
  if (!clean) {
    return [];
  }
  return [
    {
      scope,
      subjectId: thread.factionId,
      subjectType: "faction",
      subjectName: thread.factionId,
      kind: "event",
      text: `Faction ${thread.factionId} formed an internal understanding: ${trimMemoryText(clean, 140)}`,
      epistemicStatus: "observed",
      confidence: 0.65,
      sourceMessageIds: [thread.id],
      visibility: "faction",
    },
  ];
}

function semanticObservationDraftsFromDirectorEntry(scope: RoomSystemMemoryScope, entry: DirectorMemoryEntry): SemanticObservationDraft[] {
  const clean = semanticObservationSourceText(entry.text);
  if (!clean) {
    return [];
  }
  return [
    {
      scope,
      subjectId: "director",
      subjectType: "director",
      subjectName: "Director",
      kind: semanticObservationKind(entry.category as SemanticMemoryObservationKind),
      text: `Director recorded ${entry.category}: ${trimMemoryText(clean, 140)}`,
      epistemicStatus: entry.status === "disputed" ? "disputed" : "confirmed",
      confidence: clampNumber(entry.confidence ?? 0.75, 0.1, 0.98),
      sourceMessageIds: entry.sourceMessageIds,
      visibility: "director_only",
    },
  ];
}

function semanticObservationSourceText(text: string): string {
  const clean = stripRepeatedMemoryPrefixes(stripMemoryNoise(text));
  if (!clean || isMemoryArtifactText(clean) || classifySensitivity(clean) === "forbidden") {
    return "";
  }
  return trimMemoryText(clean, 220);
}

function hasSemanticObservationSignal(text: string, message: Pick<RoomMemoryMessage, "speakerType" | "source">): boolean {
  const clean = normalizeForMemory(text);
  if (clean.length < 8) {
    return false;
  }
  if (MEMORY_STATUS_NOISE_PATTERN.test(clean)) {
    return false;
  }
  if (semanticSignalPattern().test(clean)) {
    return true;
  }
  return message.speakerType === "role" && clean.length >= 24 && /[。.!?！？；;]/u.test(text);
}

function semanticSignalPattern(): RegExp {
  return /(喜欢|不喜欢|偏好|希望|更想|习惯|经常|总是|倾向|回避|沉默|观察|质疑|相信|怀疑|信任|不信任|反对|支持|主张|认为|立场|观点|目标|计划|打算|接下来|准备|钥匙|锁|门|物品|拿到|拥有|知道|秘密|冲突|矛盾|关系|朋友|敌人|合作|背叛|可靠|不可靠|like|dislike|prefer|habit|trust|doubt|believe|support|oppose|stance|goal|plan|claim|key|lock|door|item|secret|conflict|reliable)/i;
}

function inferSemanticObservationKind(text: string, message?: Pick<RoomMemoryMessage, "speakerType" | "source">): SemanticMemoryObservationKind {
  const clean = normalizeForMemory(text);
  if (/(冲突|矛盾|争执|反驳|conflict|contradict|dispute)/i.test(clean)) return "conflict";
  if (/(信任|不信任|可靠|不可靠|怀疑.*可靠|trust|reliable)/i.test(clean)) return "reliability";
  if (/(怀疑|质疑|不确定|doubt|suspect)/i.test(clean)) return "doubt";
  if (/(相信|认同|belief|believe)/i.test(clean)) return "belief";
  if (/(关系|朋友|敌人|合作|背叛|relationship|friend|enemy|ally)/i.test(clean)) return "relationship";
  if (/(支持|反对|主张|认为|立场|观点|agree|disagree|stance|position)/i.test(clean)) return "stance";
  if (/(喜欢|不喜欢|偏好|希望|更想|prefer|like|dislike)/i.test(clean)) return "preference";
  if (/(习惯|经常|总是|倾向|回避|沉默|观察|habit|tend|avoid|silent)/i.test(clean)) return "habit";
  if (/(目标|计划|打算|接下来|准备|goal|plan|next)/i.test(clean)) return "goal";
  if (/(钥匙|锁|门|物品|拿到|拥有|key|lock|door|item|has|own)/i.test(clean)) return "item";
  if (/(地点|房间|位置|location|place)/i.test(clean)) return "location";
  if (/(声称|说自己|我有|我知道|claim)/i.test(clean)) return "claim";
  if (message?.speakerType === "role") return "trait";
  return "event";
}

function inferSemanticEpistemicStatus(
  text: string,
  kind: SemanticMemoryObservationKind = "event",
  message?: Pick<RoomMemoryMessage, "speakerType" | "source">,
): SemanticMemoryEpistemicStatus {
  const clean = normalizeForMemory(text);
  if (/(冲突|矛盾|contradict|dispute)/i.test(clean) || kind === "conflict") return "disputed";
  if (/(怀疑|质疑|doubt|suspect)/i.test(clean) || kind === "doubt") return "doubted";
  if (/(相信|认同|believe)/i.test(clean) || kind === "belief") return "believed";
  if (/(声称|说自己|claim|我有|我知道)/i.test(clean) || kind === "claim" || kind === "item") return "claimed";
  if (kind === "trait" || kind === "habit" || kind === "preference" || kind === "reliability") return "inferred";
  if (message?.speakerType === "room_system") return "observed";
  return "observed";
}

function semanticObservationConfidence(kind: SemanticMemoryObservationKind, status: SemanticMemoryEpistemicStatus, text: string): number {
  let score = 0.46;
  if (status === "confirmed") score += 0.3;
  if (status === "claimed" || status === "believed" || status === "doubted") score += 0.12;
  if (kind === "trait" || kind === "habit" || kind === "reliability") score += 0.08;
  if (normalizeForMemory(text).length >= 32) score += 0.05;
  return clampNumber(score, 0.35, 0.86);
}

function semanticObservationSentence(
  subjectName: string,
  kind: SemanticMemoryObservationKind,
  status: SemanticMemoryEpistemicStatus,
  text: string,
): string {
  const compressed = trimMemoryText(text, 140);
  if (status === "claimed") return `${subjectName} claims or implies: ${compressed}`;
  if (status === "believed") return `${subjectName} appears to believe: ${compressed}`;
  if (status === "doubted") return `${subjectName} doubts or questions: ${compressed}`;
  if (status === "disputed") return `${subjectName} is part of a disputed memory: ${compressed}`;
  if (kind === "trait" || kind === "habit" || kind === "preference" || kind === "reliability") {
    return `${subjectName} shows an observed tendency: ${compressed}`;
  }
  return `${subjectName} contributed a semantic room observation: ${compressed}`;
}

function semanticRoleObservationSentence(
  subjectName: string,
  kind: SemanticMemoryObservationKind,
  status: SemanticMemoryEpistemicStatus,
  text: string,
): string {
  const compressed = trimMemoryText(text, 140);
  if (status === "claimed") return `${subjectName}'s room claim: ${compressed}`;
  if (status === "believed") return `${subjectName}'s current belief signal: ${compressed}`;
  if (status === "doubted") return `${subjectName}'s doubt signal: ${compressed}`;
  if (kind === "trait" || kind === "habit" || kind === "preference" || kind === "reliability") {
    return `${subjectName}'s room-only observed tendency: ${compressed}`;
  }
  return `${subjectName}'s room-only semantic activity: ${compressed}`;
}

function semanticObservationText(text: string): string {
  return trimMemoryText(stripRepeatedMemoryPrefixes(stripMemoryNoise(text)), MAX_COMPRESSED_FACT_CHARS);
}

function semanticObservationKey(text: string): string {
  return normalizeForMemory(text).slice(0, 96);
}

function semanticSubjectTypeFromSpeaker(value?: RoomMemoryMessage["speakerType"]): SemanticMemorySubjectType {
  if (value === "user") return "user";
  if (value === "role") return "role";
  if (value === "room_system") return "director";
  return "unknown";
}

function semanticSubjectType(value: unknown): SemanticMemorySubjectType {
  return ["room", "user", "role", "director", "faction", "item", "unknown"].includes(String(value))
    ? (value as SemanticMemorySubjectType)
    : "unknown";
}

function semanticObservationKind(value: unknown): SemanticMemoryObservationKind {
  const allowed: SemanticMemoryObservationKind[] = [
    "trait", "preference", "habit", "relationship", "trust", "stance", "goal", "event", "item", "location", "claim", "belief", "doubt", "conflict", "reliability",
  ];
  return allowed.includes(value as SemanticMemoryObservationKind) ? (value as SemanticMemoryObservationKind) : "event";
}

function semanticEpistemicStatus(value: unknown): SemanticMemoryEpistemicStatus {
  const allowed: SemanticMemoryEpistemicStatus[] = ["observed", "inferred", "claimed", "believed", "doubted", "confirmed", "disputed", "refuted"];
  return allowed.includes(value as SemanticMemoryEpistemicStatus) ? (value as SemanticMemoryEpistemicStatus) : "observed";
}

function semanticVisibility(value: unknown): SemanticMemoryVisibility {
  const allowed: SemanticMemoryVisibility[] = ["public", "known_to_roles", "faction", "director_only", "private_character", "global"];
  return allowed.includes(value as SemanticMemoryVisibility) ? (value as SemanticMemoryVisibility) : "public";
}

function strongestSemanticStatus(
  current: SemanticMemoryEpistemicStatus | undefined,
  next: SemanticMemoryEpistemicStatus,
): SemanticMemoryEpistemicStatus {
  if (!current) return next;
  const rank: Record<SemanticMemoryEpistemicStatus, number> = {
    refuted: 7,
    disputed: 6,
    confirmed: 5,
    doubted: 4,
    believed: 3,
    claimed: 2,
    inferred: 1,
    observed: 0,
  };
  return rank[next] >= rank[current] ? next : current;
}

function shouldInjectSemanticObservationIntoPrompt(entry: SemanticMemoryObservation): boolean {
  if (entry.epistemicStatus === "disputed" || entry.epistemicStatus === "refuted") {
    return false;
  }
  if (classifySensitivity(entry.text) === "forbidden") {
    return false;
  }
  return entry.confidence >= 0.42;
}

function semanticObservationTextForPrompt(entry: SemanticMemoryObservation): string {
  const subject = entry.subjectName || entry.subjectId || entry.subjectType;
  if (entry.epistemicStatus === "confirmed") {
    return `${entry.kind}: ${entry.text}`;
  }
  if (entry.epistemicStatus === "claimed") {
    return `${subject} claims: ${entry.text}`;
  }
  if (entry.epistemicStatus === "believed") {
    return `${subject} currently believes: ${entry.text}`;
  }
  if (entry.epistemicStatus === "doubted") {
    return `${subject} doubts: ${entry.text}`;
  }
  if (entry.epistemicStatus === "inferred") {
    return `Observed tendency for ${subject}: ${entry.text}`;
  }
  return `Observed memory for ${subject}: ${entry.text}`;
}

export function extractMemoryAtoms(
  text: string,
  context: { scope: MemoryScope; source: ShortTermMention["source"] },
): MemoryAtomDraft[] {
  const sensitivity = classifySensitivity(text);
  if (sensitivity === "forbidden") {
    return [];
  }

  const clean = stripRepeatedMemoryPrefixes(stripMemoryNoise(text));
  if (!clean || isMemoryArtifactText(text) || isMemoryArtifactText(clean) || !isWorthRemembering(clean)) {
    return [];
  }

  const explicit = isExplicitMemoryRequest(text);
  const itemText = extractItemContinuity(clean);
  const preferenceText = extractPreferenceFact(clean);
  const identityText = extractIdentityFact(clean);
  const planText = extractPlanFact(clean);
  const stanceText = extractStanceFact(clean);
  const sceneText = extractSceneFact(clean);

  const semantic =
    itemText ??
    preferenceText ??
    identityText ??
    planText ??
    stanceText ??
    sceneText ??
    (explicit ? semanticMemoryText(clean, context.scope, context.source) : "");

  if (!semantic || !isWorthRemembering(semantic)) {
    return [];
  }

  const kind = inferMemoryKind(semantic);
  const subject = inferMemorySubject(semantic, context.scope);
  return [
    {
      kind,
      subject,
      text: trimMemoryText(semantic, MAX_COMPRESSED_FACT_CHARS),
      normalizedKey: stableMemoryKey(context.scope, semantic, kind, subject),
      confidence: explicit ? 0.95 : confidenceForKind(kind, context.source),
    },
  ];
}

export function normalizeForMemory(text: string): string {
  return text
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[。！？!?.,，]+$/u, "");
}

export function classifyMemorySensitivity(text: string): MemorySensitivity {
  return classifySensitivity(text);
}

export function classifySensitivity(text: string): MemorySensitivity {
  if (/(api\s*key|sk-[a-z0-9]|\u5bc6\u7801|\u9a8c\u8bc1\u7801|\u79c1\u94a5|\u52a9\u8bb0\u8bcd|\u94f6\u884c\u5361|\u652f\u4ed8\u5bc6\u7801)/i.test(text)) {
    return "forbidden";
  }
  if (/(\u5730\u5740|\u8eab\u4efd\u8bc1|\u7535\u8bdd|\u90ae\u7bb1|\u533b\u7597|\u6cd5\u5f8b|\u91d1\u878d)/i.test(text)) {
    return "sensitive";
  }
  if (/(\u9690\u79c1|\u79d8\u5bc6|\u4e0d\u8981\u544a\u8bc9)/i.test(text)) {
    return "private";
  }
  return "normal";
}
export function shouldPromoteMemory(_scope: MemoryScope, text: string, count: number): boolean {
  return shouldPromote(text, count);
}

function shouldPromote(text: string, count: number): boolean {
  return count >= 3 || memoryRequestSignalScore(text) >= 3;
}

export function compressMemoryFact(input: {
  id: string;
  scope: MemoryScope;
  text: string;
  sourceIds: string[];
  sourceMessageIds?: string[];
  evidenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  sensitivity: MemorySensitivity;
  memoryKey?: string;
  confidence?: number;
}): CompressedMemoryEntry {
  const cleaned = stripRepeatedMemoryPrefixes(stripMemoryNoise(input.text));
  const kind = inferMemoryKind(cleaned);
  const subject = inferMemorySubject(cleaned, input.scope);
  const text = trimMemoryText(semanticMemoryText(cleaned, input.scope, "user") || cleaned, MAX_COMPRESSED_FACT_CHARS);
  return {
    id: input.id,
    scope: input.scope,
    memoryKey: input.memoryKey ?? stableMemoryKey(input.scope, text, kind, subject),
    kind,
    text,
    sourceIds: input.sourceIds,
    sourceMessageIds: input.sourceMessageIds ?? [],
    evidenceCount: input.evidenceCount,
    confidence: input.confidence ?? Math.min(1, Math.max(0.45, input.evidenceCount / 3)),
    firstSeenAt: input.firstSeenAt,
    lastSeenAt: input.lastSeenAt,
    status: "active",
    sensitivity: input.sensitivity,
  };
}

export function updateRollingSummary(scope: MemoryScope, lines: string[]): string {
  const unique = Array.from(
    new Set(
      lines
        .map((line) => stripMemoryNoise(line))
        .filter((line) => line.length > 0 && classifySensitivity(line) !== "forbidden" && !isMemoryArtifactText(line)),
    ),
  );
  const prefix = scope.startsWith("room:") ? "Room summary" : "Summary";
  return trimMemoryText(prefix + ": " + (unique.slice(-8).join(" | ") || "No memory yet."), MAX_ROOM_SUMMARY_CHARS);
}

export function detectMemoryConflict(existing: CompressedMemoryEntry[], incoming: CompressedMemoryEntry): boolean {
  return findMemoryConflictIds(existing, incoming).length > 0;
}

export function cleanCorruptedRoomMemoryData(data: Partial<MemoryStoreData>): MemoryStoreData {
  const keepText = (text: string | undefined) => Boolean(text && !isMemoryArtifactText(text));
  const removedCompressedIds = new Set(
    (data.compressedMemories ?? [])
      .filter((entry) => !keepText(entry.text))
      .map((entry) => entry.id),
  );

  return {
    mentions: (data.mentions ?? []).filter((mention) => keepText(mention.normalizedText)),
    candidates: (data.candidates ?? []).filter(
      (candidate) => keepText(candidate.text) && keepText(candidate.fact) && !removedCompressedIds.has(candidate.id),
    ),
    compressedMemories: (data.compressedMemories ?? []).filter((entry) => keepText(entry.text)),
    rollingSummaries: (data.rollingSummaries ?? []).filter((summary) => keepText(summary.text)),
    semanticObservations: (data.semanticObservations ?? []).filter((entry) => keepText(entry.text)),
    versionHistory: (data.versionHistory ?? []).filter(
      (version) => keepText(version.previousText) && keepText(version.nextText) && !removedCompressedIds.has(version.memoryId),
    ),
    roomMessages: data.roomMessages ?? [],
    roomDirectorMemories: data.roomDirectorMemories ?? [],
    roomObserverMemories: data.roomObserverMemories ?? [],
    roomFactionMemories: data.roomFactionMemories ?? [],
  };
}

function findMemoryConflictIds(existing: CompressedMemoryEntry[], incoming: CompressedMemoryEntry): string[] {
  if (!["item", "scene", "relationship"].includes(incoming.kind)) {
    return [];
  }
  const key = conflictSubject(incoming.text);
  if (!key) {
    return [];
  }
  return existing
    .filter((entry) => entry.status === "active" && entry.kind === incoming.kind && conflictSubject(entry.text) === key && normalizeForMemory(entry.text) !== normalizeForMemory(incoming.text))
    .map((entry) => entry.id);
}

export function trimMemoryToBudget(entries: string[], budgetChars: number): string[] {
  const output: string[] = [];
  let used = 0;
  for (const entry of entries) {
    const text = trimMemoryText(entry, Math.min(MAX_COMPRESSED_FACT_CHARS, budgetChars));
    if (!text) {
      continue;
    }
    if (used + text.length > budgetChars) {
      break;
    }
    output.push(text);
    used += text.length;
  }
  return output;
}

function dedupePromptMemoryLines(entries: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const entry of entries) {
    const text = entry.trim();
    if (!text) {
      continue;
    }
    const key = normalizedMemoryFactDedupeKey(text);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    output.push(text);
  }
  return output;
}

function dedupeMemoryClaimInputs(inputs: MemoryClaimInput[]): MemoryClaimInput[] {
  const bestByKey = new Map<string, MemoryClaimInput>();
  for (const input of inputs) {
    const key = memoryClaimInputDedupeKey(input);
    const existing = bestByKey.get(key);
    if (!existing || memoryClaimInputQualityScore(input) > memoryClaimInputQualityScore(existing)) {
      bestByKey.set(key, input);
    }
  }
  return [...bestByKey.values()];
}

function memoryClaimInputDedupeKey(input: Pick<MemoryClaimInput, "scope" | "kind" | "visibility" | "text">): string {
  return `${input.scope}:${input.visibility}:${input.kind}:${normalizedMemoryFactDedupeKey(input.text)}`;
}

function memoryClaimInputQualityScore(input: MemoryClaimInput): number {
  let score = input.confidence * 100 + (input.evidenceCount ?? 1);
  if (input.authority === "developer") {
    score += 500;
  } else if (input.authority !== "system") {
    score += 250;
  }
  if (typeof input.properties?.extractionSourceType === "string") {
    score += 100;
  }
  if (input.status === "active" || !input.status) {
    score += 10;
  }
  if (/^(?:preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict|judgement|secret|identity|goal)\s*[：:]/i.test(input.text.trim())) {
    score -= 25;
  }
  return score;
}

function normalizedMemoryFactDedupeKey(text: string): string {
  const original = stripRepeatedMemoryPrefixes(stripMemoryNoise(text));
  let clean = original;
  let previous = "";
  while (clean && clean !== previous) {
    previous = clean;
    clean = clean
      .replace(/^(?:preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict|judgement|secret|identity|goal)\s*[：:]\s*/i, "")
      .replace(/^\[开发者确认\]\s*/i, "")
      .trim();
  }
  if (isPreferenceMemoryText(original) || isPreferenceMemoryText(clean)) {
    const preferenceValue = normalizePreferenceValueForMemoryKey(clean);
    if (preferenceValue) {
      return `preference:${normalizeMemoryKeyText(preferenceValue)}`;
    }
  }
  return normalizeForMemory(clean)
    .replace(/[。.!?！？]+$/u, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function normalizeMemoryFactDedupeKey(text: string): string {
  return normalizedMemoryFactDedupeKey(text);
}

function stripMemoryNoise(text: string): string {
  return normalizeForMemory(text)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/\[start thinking\][\s\S]*?\[end thinking\]/gi, "")
    .replace(EXPLICIT_MEMORY_REQUEST_PREFIX_PATTERN, "")
    .replace(/\u8bf7\u8bb0\u4f4f|\u8bb0\u4f4f|\u8bb0\u4e00\u4e0b|\u8bb0\u5f55\u4e00\u4e0b|\u8bb0\u5f55|\u8bb0\u4e0b\u6765|\u8bb0\u5f97|\u8fd9\u5f88\u91cd\u8981|\u4ee5\u540e\u90fd|remember(?:\s+that)?|memorize|note that|save this|keep this in mind|keep in mind/gi, "")
    .replace(/^\s*(analysis|reasoning|thoughts?|assistant|system|user)\s*[:\uFF1A-]\s*/i, "")
    .replace(/\b(analysis|reasoning|thoughts?|assistant|system|user)\s*[:\uFF1A-]\s*/gi, "")
    .replace(/^(?:do not|never reveal|safety rules|character instructions|return only|you are a castroom ai).*$/gim, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripRepeatedMemoryPrefixes(text: string): string {
  let clean = normalizeForMemory(text);
  let previous = "";
  while (clean && clean !== previous) {
    previous = clean;
    clean = clean
      .replace(/^(?:房间相关事实|角色相关事实|用户相关事实)\s*[：:]\s*/i, "")
      .replace(/^(?:room summary|summary)\s*:\s*/i, "")
      .trim();
  }
  return clean;
}

export function isMemoryArtifactText(text: string): boolean {
  const clean = normalizeForMemory(text);
  if (!clean) {
    return false;
  }
  const memoryPrefixCount = clean.match(MEMORY_ARTIFACT_PREFIX_PATTERN)?.length ?? 0;
  if (memoryPrefixCount >= 2) {
    return true;
  }
  if (MEMORY_ARTIFACT_SUMMARY_PATTERN.test(clean) || MEMORY_ARTIFACT_CHAIN_PATTERN.test(clean)) {
    return true;
  }
  if (/^(?:preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict)\s*:\s*(?:房间相关事实|角色相关事实|用户相关事实)/i.test(clean)) {
    return true;
  }
  if (MEMORY_STATUS_NOISE_PATTERN.test(clean)) {
    return true;
  }
  const stripped = stripRepeatedMemoryPrefixes(clean);
  return /^(?:房间相关事实|角色相关事实|用户相关事实)\s*[：:]*$/i.test(stripped);
}

export function shouldAcceptRoomMemoryText(text: string, source: RecordRoomMessageInput["source"]): boolean {
  const clean = stripRepeatedMemoryPrefixes(stripMemoryNoise(text));
  if (!clean || isMemoryArtifactText(text) || isMemoryArtifactText(clean)) {
    return false;
  }
  if (source === "room" && MEMORY_STATUS_NOISE_PATTERN.test(clean)) {
    return false;
  }
  return isWorthRemembering(clean);
}

function sanitizeMessageHistoryText(text: string): string {
  return text.trim().replace(/\s+/g, " ").slice(0, 2000);
}


function semanticMemoryText(text: string, scope: MemoryScope, source: ShortTermMention["source"]): string {
  const clean = stripRepeatedMemoryPrefixes(stripMemoryNoise(text));
  if (!clean || isMemoryArtifactText(clean)) {
    return "";
  }
  const semantic =
    extractPreferenceFact(clean) ??
    extractIdentityFact(clean) ??
    extractPlanFact(clean) ??
    extractItemContinuity(clean) ??
    extractSceneFact(clean) ??
    extractStanceFact(clean) ??
    clean;
  return trimMemoryText(semantic, MAX_COMPRESSED_FACT_CHARS);
}

function isWorthRemembering(text: string): boolean {
  const clean = text.trim();
  if (clean.length < 4) {
    return false;
  }
  if (isMemoryArtifactText(clean)) {
    return false;
  }
  if (/^(hi|hello|hey|ok|okay|test|ping|yes|no|thanks?|\u4f60\u597d|\u60a8\u597d|\u4f60\u5728\u5417|\u6d4b\u8bd5|\u884c|\u597d|\u55ef|\u54e6|\u8c22\u8c22|\u518d\u89c1)$/i.test(clean)) {
    return false;
  }
  if (/^[\d\s+\-*/=\uff1f?.,\uff0c\u3002]+$/.test(clean)) {
    return false;
  }
  if (/(local chat model returned an unusable reply|\u5f53\u524d\u6ca1\u6709\u53ef\u7528\u804a\u5929\u6a21\u578b|\u672c\u5730\u6a21\u578b\u8fd9\u8f6e\u56de\u590d\u5931\u8d25)/i.test(clean)) {
    return false;
  }
  return Boolean(
    isExplicitMemoryRequest(clean) ||
      extractPreferenceFact(clean) ||
      extractIdentityFact(clean) ||
      extractPlanFact(clean) ||
      extractItemContinuity(clean) ||
      extractSceneFact(clean) ||
      extractStanceFact(clean),
  );
}

function isExplicitMemoryRequest(text: string): boolean {
  return memoryRequestSignalScore(text) >= 3;
}

function memoryRequestSignalScore(text: string): number {
  const clean = normalizeForMemory(text);
  if (!clean || MEMORY_RECALL_QUESTION_PATTERN.test(clean)) {
    return 0;
  }

  let score = 0;
  if (EXPLICIT_MEMORY_REQUEST_PATTERN.test(clean)) score += 3;
  if (MEMORY_ACTION_SIGNAL_PATTERN.test(clean)) score += 2;
  if (MEMORY_PERSISTENCE_SIGNAL_PATTERN.test(clean)) score += 1;
  if (/^(?:\u8bf7|\u9ebb\u70e6|\u5e2e\u6211|\u4f60\u8981|\u4ee5\u540e|\u4e0b\u6b21)/i.test(clean)) score += 1;
  if (extractPreferenceFact(clean) || extractIdentityFact(clean) || extractPlanFact(clean)) score += 1;
  if (/[?？]$/.test(clean)) score -= 2;
  return score;
}

function extractPreferenceFact(text: string): string | null {
  const explicitPreference =
    text.match(/(?:\u6211(?:\u7684)?|\u7528\u6237(?:\u7684)?)?\s*(?:\u559c\u597d|\u504f\u597d)\s*(?:\u662f|\u4e3a|=|:|\uff1a)\s*(.{1,60})/i)?.[1] ??
    text.match(/(?:my|user(?:'s)?)\s*(?:preference|favorite|favourite)\s*(?:is|=|:)\s*(.{1,60})/i)?.[1];
  if (explicitPreference) {
    const value = normalizePreferenceValueForMemoryKey(explicitPreference);
    return trimMemoryText("\u7528\u6237\u504f\u597d\uff1a" + value + "\u3002", MAX_COMPRESSED_FACT_CHARS);
  }
  if (/(\u7b80\u77ed|\u77ed\u4e00\u70b9|\u5c11\u8bf4|\u4e00\u4e24\u53e5|concise|short replies?)/i.test(text)) {
    return "\u7528\u6237\u504f\u597d\u7b80\u77ed\u81ea\u7136\u56de\u590d\u3002";
  }
  if (/(\u8be6\u7ec6|\u591a\u8bf4|\u89e3\u91ca\u6e05\u695a|step by step|more detail)/i.test(text)) {
    return "\u7528\u6237\u504f\u597d\u66f4\u8be6\u7ec6\u7684\u89e3\u91ca\u3002";
  }
  const match = text.match(/(?:\u6211|\u7528\u6237|\bI\b|\buser\b).{0,16}(?:\u559c\u6b22|\u504f\u597d|\u5e0c\u671b|\u60f3\u8981|\u4e0d\u559c\u6b22|\u8ba8\u538c|prefer|like|dislike)(.{2,60})/i);
  if (match?.[1]) {
    const value = normalizePreferenceValueForMemoryKey(match[1]);
    return trimMemoryText("\u7528\u6237\u504f\u597d\uff1a" + value + "\u3002", MAX_COMPRESSED_FACT_CHARS);
  }
  return null;
}

function extractIdentityFact(text: string): string | null {
  const name = text.match(/(?:\u6211\u53eb|\u6211\u7684\u540d\u5b57\u662f|\u53eb\u6211|my name is|call me)\s*([a-zA-Z0-9_\-\u4e00-\u9fff]{1,24})/i)?.[1];
  if (name) {
    return "\u7528\u6237\u540d\u5b57\u662f " + name + "\u3002";
  }
  return null;
}

function extractPlanFact(text: string): string | null {
  if (!/(\u8ba1\u5212|\u6253\u7b97|\u51c6\u5907|\u4e0b\u6b21|\u4ee5\u540e|\u660e\u5929|todo|plan|next time)/i.test(text)) {
    return null;
  }
  return trimMemoryText("\u8ba1\u5212\uff1a" + text.replace(/^(\u8bb0\u4f4f|\u8bf7\u8bb0\u4f4f|remember)[:\uff1a\s]*/i, ""), MAX_COMPRESSED_FACT_CHARS);
}

function extractItemContinuity(text: string): string | null {
  const keyToRole = text.match(/(\u94a5\u5319|\u95e8\u7981\u5361|\u5730\u56fe|\u9053\u5177|key|card|map).{0,12}(?:\u7ed9|\u4ea4\u7ed9|\u5728|\u5f52|\u62ff\u7740|with|to)\s*@?([a-zA-Z0-9_\-\u4e00-\u9fff]{1,32})/i);
  if (keyToRole?.[1] && keyToRole?.[2]) {
    return keyToRole[1] + "\u5728 " + keyToRole[2] + " \u624b\u91cc\u3002";
  }
  const roleHasKey = text.match(/@?([a-zA-Z0-9_\-\u4e00-\u9fff]{1,32}).{0,8}(?:\u62ff\u7740|\u6301\u6709|\u6709|\u83b7\u5f97).{0,8}(\u94a5\u5319|\u95e8\u7981\u5361|\u5730\u56fe|\u9053\u5177|key|card|map)/i);
  if (roleHasKey?.[1] && roleHasKey?.[2]) {
    return roleHasKey[2] + "\u5728 " + roleHasKey[1] + " \u624b\u91cc\u3002";
  }
  return null;
}

function extractSceneFact(text: string): string | null {
  if (isMemoryArtifactText(text)) {
    return null;
  }
  if (/(\u573a\u666f|\u5730\u70b9|\u4ed3\u5e93|\u623f\u95f4|\u4e8c\u697c|\u95e8|\u9501|\u6253\u5f00|\u8fdb\u5165|scene|location|door|locked|unlocked)/i.test(text)) {
    return trimMemoryText("\u573a\u666f\u4e8b\u5b9e\uff1a" + text.replace(/^(\u8bb0\u4f4f|\u8bf7\u8bb0\u4f4f|remember)[:\uff1a\s]*/i, ""), MAX_COMPRESSED_FACT_CHARS);
  }
  return null;
}

function extractStanceFact(text: string): string | null {
  if (/(\u8ba4\u4e3a|\u53cd\u5bf9|\u652f\u6301|\u8d28\u7591|\u540c\u610f|argues?|opposes?|supports?|stance)/i.test(text)) {
    return trimMemoryText("\u7acb\u573a\uff1a" + text, MAX_COMPRESSED_FACT_CHARS);
  }
  return null;
}

function inferMemorySubject(text: string, scope: MemoryScope): string {
  if (/\u7528\u6237|\u6211|my name|\u504f\u597d|preference/i.test(text)) {
    return "user";
  }
  const role = text.match(/@([a-zA-Z0-9_-]+)/)?.[1] ?? text.match(/\b(Mio|Rin|Kai)\b/i)?.[1];
  if (role) {
    return role.toLowerCase();
  }
  if (scope.includes(":system")) {
    return "director";
  }
  if (scope.includes(":faction:")) {
    return "faction";
  }
  return scope;
}

function stableMemoryKey(scope: MemoryScope, text: string, kind: MemoryAtomKind = inferMemoryKind(text), subject = inferMemorySubject(text, scope)): string {
  const normalized = normalizeForMemory(text)
    .replace(/^(preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict):\s*/i, "")
    .replace(/[。.!！?？]/g, "")
    .replace(/\d{4}-\d{2}-\d{2}/g, "")
    .trim();
  const semanticKey = semanticKeyForText(normalized, kind);
  return `${kind}:${subject}:${semanticKey}`;
}

function semanticKeyForText(text: string, kind: MemoryAtomKind): string {
  if (kind === "preference" && /(简短|短一点|少说|一两句|concise|short)/i.test(text)) {
    return "reply_length_short";
  }
  if (kind === "preference" && /(详细|多说|detail)/i.test(text)) {
    return "reply_detail_high";
  }
  if (kind === "preference") {
    const preferenceValue = normalizePreferenceValueForMemoryKey(text);
    if (preferenceValue) {
      return `preference_${normalizeMemoryKeyText(preferenceValue)}`;
    }
  }
  const item = text.match(/(钥匙|门禁卡|地图|道具|key|card|map)/i)?.[1];
  if (item) {
    return `item_${item.toLowerCase()}`;
  }
  const scene = text.match(/(门|锁|二楼|仓库|场景|地点|door|scene|location)/i)?.[1];
  if (scene) {
    return `scene_${scene.toLowerCase()}`;
  }
  return normalizeForMemory(text).slice(0, 64);
}

function isPreferenceMemoryText(text: string): boolean {
  const clean = stripRepeatedMemoryPrefixes(stripMemoryNoise(text));
  return /^(?:preference)\s*[：:]/i.test(clean) || /(?:用户(?:的)?|我(?:的)?)?\s*(?:喜好|偏好)\s*(?:是|为|=|:|：)?/i.test(clean) || /(?:my|user(?:'s)?)\s*(?:preference|favorite|favourite)\b/i.test(clean);
}

function normalizePreferenceValueForMemoryKey(value: string): string {
  let clean = stripRepeatedMemoryPrefixes(stripMemoryNoise(value));
  let previous = "";
  while (clean && clean !== previous) {
    previous = clean;
    clean = clean
      .replace(/^(?:preference)\s*[：:]\s*/i, "")
      .replace(/^\[开发者确认\]\s*/i, "")
      .replace(/^(?:用户(?:的)?|我(?:的)?)?\s*(?:喜好|偏好)\s*(?:是|为|=|:|：)?\s*/i, "")
      .replace(/^(?:my|user(?:'s)?)\s*(?:preference|favorite|favourite)\s*(?:is|=|:)?\s*/i, "")
      .replace(/^(?:is|=|:|：)\s*/i, "")
      .trim();
  }
  return stripPreferenceValueDescriptor(clean);
}

function stripPreferenceValueDescriptor(value: string): string {
  const clean = normalizeForMemory(value).replace(/[。.!?！？]+$/u, "").trim();
  const numericWithDescriptor = clean.match(/^([+-]?\d+(?:[.,]\d+)?)(?:\s*(?:这个|这一个|那个)?(?:数字|数值|号码|数|number))$/iu);
  if (numericWithDescriptor?.[1]) {
    return numericWithDescriptor[1].trim();
  }
  const chineseDescriptor = clean.match(/^(.+?)(?:这个|这一个|那个)(?:数字|数值|号码|数)$/u);
  if (chineseDescriptor?.[1] && /[0-9０-９一二三四五六七八九十百千万零〇两]/u.test(chineseDescriptor[1])) {
    return chineseDescriptor[1].trim();
  }
  const englishDescriptor = clean.match(/^(.+?)\s+(?:this\s+|the\s+)?number$/iu);
  if (englishDescriptor?.[1] && /\d/.test(englishDescriptor[1])) {
    return englishDescriptor[1].trim();
  }
  return clean;
}

function normalizeMemoryKeyText(text: string): string {
  return normalizeForMemory(text)
    .replace(/[。.!?！？]+$/u, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function confidenceForKind(kind: MemoryAtomKind, source: ShortTermMention["source"]): number {
  if (kind === "item" || kind === "scene") {
    return source === "room" ? 0.76 : 0.82;
  }
  if (kind === "preference") {
    return 0.86;
  }
  if (kind === "stance" || kind === "argument") {
    return 0.72;
  }
  return 0.68;
}

function strongestSensitivity(left: MemorySensitivity, right: MemorySensitivity): MemorySensitivity {
  const order: MemorySensitivity[] = ["normal", "private", "sensitive", "forbidden"];
  return order.indexOf(right) > order.indexOf(left) ? right : left;
}

function mergeSourceIds(current: string[] = [], ...next: string[]): string[] {
  return Array.from(new Set([...current, ...next.filter(Boolean)])).slice(0, 20);
}

function refineShortMemoryText(current: string, incoming: string): string {
  if (isMemoryArtifactText(incoming)) {
    return current;
  }
  if (isMemoryArtifactText(current)) {
    return incoming;
  }
  if (incoming.length < current.length && incoming.length > 0) {
    return incoming;
  }
  return current;
}

function refineLongTermText(current: string | undefined, incoming: string): string {
  if (!current) {
    return incoming;
  }
  if (isMemoryArtifactText(incoming)) {
    return current;
  }
  if (isMemoryArtifactText(current) || (incoming.length < current.length && incoming.length > 0)) {
    return incoming;
  }
  return current;
}

function createMemoryVersionEntry(
  current: CompressedMemoryEntry,
  nextText: string,
  reason: MemoryVersionEntry["reason"],
  createdAt: string,
  sourceIds: string[],
): MemoryVersionEntry {
  return {
    id: stableId("memory-version", `${current.id}:${reason}:${createdAt}:${nextText}`),
    memoryId: current.id,
    scope: current.scope,
    previousText: current.text,
    nextText,
    reason,
    createdAt,
    sourceIds,
  };
}

function inferMemoryKind(text: string): CompressedMemoryKind {
  if (/(\u559c\u6b22|\u504f\u597d|prefer|likes?|\u7231\u597d)/i.test(text)) {
    return "preference";
  }
  if (/(\u670b\u53cb|\u5173\u7cfb|\u4fe1\u4efb|\u8ba8\u538c|\u559c\u6b22.*\u89d2\u8272|relationship)/i.test(text)) {
    return "relationship";
  }
  if (/(\u8ba1\u5212|\u6253\u7b97|\u51c6\u5907|\u4e0b\u4e00\u6b65|plan)/i.test(text)) {
    return "plan";
  }
  if (/(\u4e0d\u8981|\u4e0d\u80fd|\u5fc5\u987b|\u9650\u5236|\u7981\u5fcc|constraint)/i.test(text)) {
    return "constraint";
  }
  if (/(\u573a\u666f|\u5730\u70b9|\u4ed3\u5e93|\u623f\u95f4|scene)/i.test(text)) {
    return "scene";
  }
  if (/(\u94a5\u5319|\u7269\u54c1|\u9053\u5177|\u62ff\u7740|\u4ea4\u7ed9|\u5728.+\u624b\u91cc|item|key)/i.test(text)) {
    return "item";
  }
  if (/(\u7ebf\u7d22|\u7591\u70b9|clue)/i.test(text)) {
    return "clue";
  }
  if (/(\u8ba4\u4e3a|\u53cd\u5bf9|\u652f\u6301|\u8d28\u7591|stance)/i.test(text)) {
    return "stance";
  }
  if (/(\u8bba\u70b9|\u8fa9\u8bba|argument|argues?)/i.test(text)) {
    return "argument";
  }
  if (/(\u4efb\u52a1|\u5f85\u529e|todo|task)/i.test(text)) {
    return "task";
  }
  if (/(\u51b2\u7a81|\u77db\u76fe|conflict)/i.test(text)) {
    return "conflict";
  }
  return "fact";
}

function kindLabel(kind: CompressedMemoryKind): string {
  const labels: Record<CompressedMemoryKind, string> = {
    preference: "preference",
    fact: "fact",
    relationship: "relationship",
    plan: "plan",
    constraint: "constraint",
    scene: "scene",
    item: "item",
    clue: "clue",
    stance: "stance",
    argument: "argument",
    task: "task",
    conflict: "conflict",
  };
  return labels[kind];
}

function conflictSubject(text: string): string | null {
  const normalized = normalizeForMemory(text);
  const item = normalized.match(/(\u94a5\u5319|key|\u95e8\u7981\u5361|\u5730\u56fe|\u7269\u54c1|\u9053\u5177)/i)?.[1];
  if (item) {
    return item.toLocaleLowerCase();
  }
  const scene = normalized.match(/(\u573a\u666f|\u5730\u70b9|scene|location)/i)?.[1];
  if (scene) {
    return scene.toLocaleLowerCase();
  }
  const relationship = normalized.match(/(\u5173\u7cfb|relationship|\u4fe1\u4efb|\u8ba8\u538c)/i)?.[1];
  return relationship?.toLocaleLowerCase() ?? null;
}

function defaultMemoryGraphViewer(scope: MemoryScope): MemoryGraphViewContext["viewer"] {
  if (scope === "global") {
    return { type: "global" };
  }
  if (scope.startsWith("character:")) {
    return { type: "one_on_one", packId: scope.slice("character:".length) };
  }
  if (scope.startsWith("room:")) {
    return { type: "room_public", roomId: scope.slice("room:".length).split(":")[0] ?? scope };
  }
  return { type: "global" };
}

function trimMemoryText(text: string, maxChars: number): string {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length <= maxChars ? clean : `${clean.slice(0, Math.max(0, maxChars - 3)).trim()}...`;
}

function stableId(prefix: string, value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  return `${prefix}-${Math.abs(hash).toString(36)}`;
}
