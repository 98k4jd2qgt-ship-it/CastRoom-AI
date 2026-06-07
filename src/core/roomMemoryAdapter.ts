import {
  recordVisibleObservations,
  resolveRoomMessageVisibility,
} from "./roomScheduler";
import type {
  ConsoleMessage,
  ContinuityWrite,
  MemoryCompressionResult,
  MemoryEvent,
  MemoryScope,
  RoomDirectorMove,
  RoomFactionHuddleThread,
  RoomFactionMemoryScope,
  RoomKnowledgeVisibility,
  RoomObservationTag,
  RoomObserverMemoryScope,
  RoomParticipant,
  RoomScheduleResult,
  RoomSceneBoard,
  RoomSecretEntry,
  RoomState,
} from "./types";

export interface RoomMemoryAdapterDeps {
  record(event: MemoryEvent): MemoryCompressionResult;
  persist(): void;
  now(): Date;
  diagnostics?: (level: "info" | "warn" | "error", event: string, detail?: unknown) => void;
}

export interface RoomMemoryAdapterResult {
  results: MemoryCompressionResult[];
  observerRoleIds: string[];
  writtenScopes: MemoryScope[];
}

export interface RoomMemoryRoomMessageInput {
  room: RoomState;
  message: ConsoleMessage;
  source: "user" | "room";
  excludeRoleIds?: string[];
  recordObservations?: boolean;
}

export interface RoomMemorySpeakerMessageInput {
  room: RoomState;
  message: ConsoleMessage;
  participant: RoomParticipant;
  excludeRoleIds?: string[];
}

export interface RoomMemoryDirectorPublicResultInput {
  room: RoomState;
  message: ConsoleMessage;
  move: RoomDirectorMove;
  sceneBoard?: RoomSceneBoard;
  continuityWrites?: ContinuityWrite[];
  secretWrites?: RoomSecretEntry[];
}

export interface RoomMemoryPrivateMessageInput {
  room: RoomState;
  message: ConsoleMessage;
  title?: string;
}

export interface RoomMemoryObservationInput {
  room: RoomState;
  message: ConsoleMessage;
  excludeRoleIds?: string[];
}

export interface RoomMemoryPassiveDirectorObservationInput {
  room: RoomState;
  input: string;
  speaker: string;
  move: RoomDirectorMove;
  visibility?: RoomKnowledgeVisibility;
  continuityWrites?: ContinuityWrite[];
  secretWrites?: RoomSecretEntry[];
}

export class RoomMemoryAdapter {
  constructor(private readonly deps: RoomMemoryAdapterDeps) {}

  recordRoomMessage(input: RoomMemoryRoomMessageInput): RoomMemoryAdapterResult {
    const results: MemoryCompressionResult[] = [];
    const { room, message, source } = input;
    const shouldRecordObservations = input.recordObservations ?? true;

    if (message.visibility === "private_ai" || message.visibility === "private_thread") {
      return this.recordPrivateMessage({
        room,
        message,
        title: message.visibility === "private_thread" ? "Private channel thread" : undefined,
      });
    }

    if (message.visibility === "faction_huddle") {
      if (message.factionId) {
        results.push(...this.recordFactionHuddleFromMessage(room, message, message.factionId));
        results.push(
          ...this.recordDirectorHiddenRoomMemory(
            room,
            message,
            this.factionRoleIds(room, message.factionId),
            "Faction channel thread",
          ),
        );
      }
      const observation = shouldRecordObservations
        ? this.recordObservations({ room, message, excludeRoleIds: input.excludeRoleIds })
        : emptyRoomMemoryAdapterResult();
      return {
        results: [...results, ...observation.results],
        observerRoleIds: observation.observerRoleIds,
        writtenScopes: uniqueScopes([roomScope(room), room.director.memoryScope, ...observation.writtenScopes]),
      };
    }

    results.push(this.record({
      kind: "room_message",
      input: {
        scope: roomScope(room),
        speaker: message.speaker,
        speakerId: message.speakerId,
        speakerType: message.speakerType,
        text: message.text,
        source,
        now: this.deps.now(),
        visibility: message.visibility,
        visibleTo: message.visibleTo,
        privateReason: message.privateReason,
        channelId: message.channelId,
        factionId: message.factionId,
      },
    }));
    results.push(...this.recordDirectorRoomObservationMemory(room, message));
    const observation = shouldRecordObservations
      ? this.recordObservations({ room, message, excludeRoleIds: input.excludeRoleIds })
      : emptyRoomMemoryAdapterResult();
    return {
      results: [...results, ...observation.results],
      observerRoleIds: observation.observerRoleIds,
      writtenScopes: uniqueScopes([roomScope(room), room.director.memoryScope, ...observation.writtenScopes]),
    };
  }

  recordSpeakerMessage(input: RoomMemorySpeakerMessageInput): RoomMemoryAdapterResult {
    const { room, message, participant } = input;
    if (message.visibility === "private_ai" || message.visibility === "private_thread") {
      return this.recordPrivateMessage({
        room,
        message,
        title: message.visibility === "private_thread" ? "Private channel thread" : undefined,
      });
    }

    if (message.visibility === "faction_huddle") {
      const results: MemoryCompressionResult[] = [];
      if (participant.factionId) {
        results.push(...this.recordFactionHuddleFromMessage(room, message, participant.factionId));
        results.push(
          ...this.recordDirectorHiddenRoomMemory(
            room,
            message,
            this.factionRoleIds(room, participant.factionId),
            "Faction channel thread",
          ),
        );
      }
      const observation = this.recordObservations({ room, message, excludeRoleIds: input.excludeRoleIds ?? [participant.id] });
      return {
        results: [...results, ...observation.results],
        observerRoleIds: observation.observerRoleIds,
        writtenScopes: uniqueScopes([
          participant.factionId ? (`${roomScope(room)}:faction:${participant.factionId}` as MemoryScope) : undefined,
          room.director.memoryScope,
          ...observation.writtenScopes,
        ]),
      };
    }

    const publicMessage = this.recordRoomMessage({
      room,
      message,
      source: "room",
      excludeRoleIds: input.excludeRoleIds ?? [participant.id],
    });
    const mention = this.record({
      kind: "mention",
      scope: participant.memoryScope,
      text: message.text,
      source: "room",
      now: this.deps.now(),
      sourceMessageId: message.id,
    });
    return {
      results: [...publicMessage.results, mention],
      observerRoleIds: publicMessage.observerRoleIds,
      writtenScopes: uniqueScopes([participant.memoryScope, ...publicMessage.writtenScopes]),
    };
  }

  recordDirectorPublicResult(input: RoomMemoryDirectorPublicResultInput): RoomMemoryAdapterResult {
    const { room, message } = input;
    const visibleRoleIds =
      message.visibleTo?.filter((target) => target.type === "role").map((target) => target.roleId) ??
      (message.target !== "all"
        ? message.target?.targets.filter((target) => target.type === "role").map((target) => target.roleId) ?? []
        : []);
    const visibility: RoomKnowledgeVisibility =
      message.visibility === "private_ai" || message.visibility === "private_thread" || message.visibility === "faction_huddle"
        ? "known_to_roles"
        : message.knowledgeVisibility ?? "public";
    const director = this.record({
      kind: "director",
      input: {
        scope: room.director.memoryScope,
        roomScope: roomScope(room),
        speaker: message.speaker,
        text: message.text,
        move: input.move,
        now: this.deps.now(),
        visibility,
        visibleToRoleIds: visibleRoleIds,
        sourceMessageId: message.id,
        sceneBoard: input.sceneBoard,
        continuityWrites: input.continuityWrites,
        secretWrites: input.secretWrites,
      },
    });
    const roomResult = this.recordRoomMessage({ room, message, source: "room" });
    return {
      results: [director, ...roomResult.results],
      observerRoleIds: roomResult.observerRoleIds,
      writtenScopes: uniqueScopes([room.director.memoryScope, ...roomResult.writtenScopes]),
    };
  }

  recordPrivateMessage(input: RoomMemoryPrivateMessageInput): RoomMemoryAdapterResult {
    const { room, message } = input;
    const knownToRoleIds = this.privateMemoryRoleIds(room, message);
    if (knownToRoleIds.length === 0) {
      return emptyRoomMemoryAdapterResult();
    }

    const now = this.deps.now();
    const tags = classifyObservationTags(message.text, room);
    const importance = observationImportance(message, room);
    const results = knownToRoleIds.map((roleId) =>
      this.record({
        kind: "room_observation",
        input: {
          scope: `${roomScope(room)}:observer:${roleId}` as RoomObserverMemoryScope,
          roomScope: roomScope(room),
          roleId,
          speaker: message.speaker,
          speakerId: message.speakerId,
          speakerType: message.speakerType,
          target: message.target,
          text: message.text,
          now,
          importance,
          strategyTags: tags,
          visibility: "private_participant",
          sourceMessageId: message.id,
        },
      }),
    );
    results.push(...this.recordDirectorHiddenRoomMemory(room, message, knownToRoleIds, input.title ?? "Private AI thread", now));
    return {
      results,
      observerRoleIds: knownToRoleIds,
      writtenScopes: uniqueScopes([
        ...knownToRoleIds.map((roleId) => `${roomScope(room)}:observer:${roleId}` as MemoryScope),
        room.director.memoryScope,
      ]),
    };
  }

  recordFactionHuddle(thread: NonNullable<RoomScheduleResult["factionHuddle"]>): RoomMemoryAdapterResult {
    return {
      results: [
        this.record({
          kind: "faction_huddle",
          input: {
            scope: `${roomScopeById(thread.roomId)}:faction:${thread.factionId}` as RoomFactionMemoryScope,
            roomScope: roomScopeById(thread.roomId),
            factionId: thread.factionId,
            thread,
            now: this.deps.now(),
          },
        }),
      ],
      observerRoleIds: [],
      writtenScopes: [`${roomScopeById(thread.roomId)}:faction:${thread.factionId}` as MemoryScope],
    };
  }

  recordPassiveDirectorObservation(input: RoomMemoryPassiveDirectorObservationInput): RoomMemoryAdapterResult {
    return {
      results: [
        this.record({
          kind: "director",
          input: {
            scope: input.room.director.memoryScope,
            roomScope: roomScope(input.room),
            speaker: input.speaker,
            text: input.input,
            move: input.move,
            now: this.deps.now(),
            visibility: input.visibility,
            continuityWrites: input.continuityWrites,
            secretWrites: input.secretWrites,
          },
        }),
      ],
      observerRoleIds: [],
      writtenScopes: [input.room.director.memoryScope],
    };
  }

  recordObservations(input: RoomMemoryObservationInput): RoomMemoryAdapterResult {
    const { room, message } = input;
    const resolvedVisibility = message.visibility ?? resolveRoomMessageVisibility(message, room).visibility;
    if (resolvedVisibility === "public") {
      return emptyRoomMemoryAdapterResult();
    }
    const observerRoleIds = recordVisibleObservations(message, room, input.excludeRoleIds ?? []);
    if (observerRoleIds.length === 0) {
      return emptyRoomMemoryAdapterResult();
    }

    const visibility = "private_participant";
    const tags = classifyObservationTags(message.text, room);
    const importance = observationImportance(message, room);
    const now = this.deps.now();
    return {
      results: observerRoleIds.map((roleId) =>
        this.record({
          kind: "room_observation",
          input: {
            scope: `${roomScope(room)}:observer:${roleId}` as RoomObserverMemoryScope,
            roomScope: roomScope(room),
            roleId,
            speaker: message.speaker,
            speakerId: message.speakerId,
            speakerType: message.speakerType,
            target: message.target,
            text: message.text,
            now,
            importance,
            strategyTags: tags,
            visibility,
            sourceMessageId: message.id,
          },
        }),
      ),
      observerRoleIds,
      writtenScopes: observerRoleIds.map((roleId) => `${roomScope(room)}:observer:${roleId}` as MemoryScope),
    };
  }

  private recordDirectorRoomObservationMemory(room: RoomState, message: ConsoleMessage): MemoryCompressionResult[] {
    if (!room.director.enabled || message.speakerType === "room_system") {
      return [];
    }
    if (message.visibility === "private_ai" || message.visibility === "private_thread" || message.visibility === "faction_huddle") {
      return [];
    }

    const write = createDirectorObservationContinuityWrite(message, room);
    if (!write) {
      return [];
    }

    return [
      this.record({
        kind: "director",
        input: {
          scope: room.director.memoryScope,
          roomScope: roomScope(room),
          speaker: message.speaker,
          text: write.detail,
          move: "recap",
          now: this.deps.now(),
          visibility: write.visibility,
          sourceType: "system_event",
          sourceMessageId: message.id,
          continuityWrites: [write],
          secretWrites: [],
        },
      }),
    ];
  }

  private recordDirectorHiddenRoomMemory(
    room: RoomState,
    message: ConsoleMessage,
    knownToRoleIds: string[],
    title: string,
    now = this.deps.now(),
  ): MemoryCompressionResult[] {
    const visibleRoleIds = Array.from(new Set(knownToRoleIds)).filter((roleId) =>
      room.participants.some((participant) => participant.id === roleId),
    );
    if (visibleRoleIds.length === 0) {
      return [];
    }

    return [
      this.record({
        kind: "director",
        input: {
          scope: room.director.memoryScope,
          roomScope: roomScope(room),
          speaker: message.speaker,
          text: message.text,
          move: "whisper",
          now,
          visibility: "known_to_roles",
          visibleToRoleIds: visibleRoleIds,
          sourceType: "system_event",
          sourceMessageId: message.id,
          secretWrites: [
            {
              id: `hidden-room-${message.id}`,
              title,
              detail: `${message.speaker}: ${message.text}`,
              knownToRoleIds: visibleRoleIds,
              revealedToUser: false,
              visibility: "known_to_roles",
              sourceMessageId: message.id,
              createdAt: now.toISOString(),
            },
          ],
        },
      }),
    ];
  }

  private recordFactionHuddleFromMessage(room: RoomState, message: ConsoleMessage, factionId: string): MemoryCompressionResult[] {
    const faction = room.factions.find((item) => item.id === factionId);
    const thread: RoomFactionHuddleThread = {
      id: `user-huddle-${message.id}`,
      roomId: room.id,
      factionId,
      factionName: faction?.name ?? factionId,
      memberRoleIds: this.factionRoleIds(room, factionId),
      entries: [
        {
          id: message.id,
          roleId: message.speakerId ?? room.userProfile.userId,
          speaker: message.speaker,
          text: message.text,
          at: message.at,
        },
      ],
      summary: `${message.speaker} in ${faction?.name ?? factionId}: ${trimRoomPromptLine(message.text, 160)}`,
      createdAt: this.deps.now().toISOString(),
    };
    return this.recordFactionHuddle(thread).results;
  }

  private privateMemoryRoleIds(room: RoomState, message: ConsoleMessage): string[] {
    const visibility = resolveRoomMessageVisibility(message, room);
    const roleIds = [
      ...(visibility.visibleTo ?? [])
        .filter((target) => target.type === "role")
        .map((target) => target.roleId),
      message.speakerType === "role" && message.speakerId ? message.speakerId : "",
    ].filter(Boolean);
    const validRoleIds = new Set(room.participants.map((participant) => participant.id));
    return Array.from(new Set(roleIds)).filter((roleId) => validRoleIds.has(roleId));
  }

  private factionRoleIds(room: RoomState, factionId: string): string[] {
    return room.participants
      .filter((participant) => participant.factionId === factionId)
      .map((participant) => participant.id);
  }

  private record(event: MemoryEvent): MemoryCompressionResult {
    const result = this.deps.record({
      ...event,
      memorySavingEnabled: true,
    } as MemoryEvent);
    if (result.saved) {
      try {
        this.deps.persist();
      } catch (error) {
        this.deps.diagnostics?.("warn", "RoomMemoryAdapter.persist", error);
      }
    }
    return result;
  }
}

function createDirectorObservationContinuityWrite(message: ConsoleMessage, room: RoomState): ContinuityWrite | null {
  const text = trimRoomPromptLine(stripRoomMentionsForMemory(message.text), 180);
  if (!shouldRecordDirectorObservationText(text, message, room)) {
    return null;
  }
  const tags = classifyObservationTags(text, room);
  return {
    label: directorObservationLabel(tags, room),
    detail: `${message.speaker}: ${text}`,
    visibility: "public",
    ownerRoleIds: message.speakerType === "role" && message.speakerId ? [message.speakerId] : [],
    status: tags.includes("contradiction") || tags.includes("open_question") ? "needs_review" : "active",
  };
}

function stripRoomMentionsForMemory(text: string): string {
  return text.replace(/@\w[\w-]*/g, "").replace(/\s+/g, " ").trim();
}

function shouldRecordDirectorObservationText(text: string, message: ConsoleMessage, room: RoomState): boolean {
  if (text.length < 4 || isLowValueRoomMemoryText(text)) {
    return false;
  }
  const importantMode = ["story", "mystery", "debate", "planning", "team_channel"].includes(room.promptProfileId);
  const hasFactSignal =
    /(claim|argue|argument|evidence|stance|plan|goal|risk|constraint|decision|clue|secret|item|door|key|win|lose|believe|doubt|声明|主张|论点|证据|立场|计划|目标|风险|约束|决策|线索|秘密|物品|道具|门|钥匙|赢|输|相信|怀疑|反驳|行动|尝试)/i.test(text);
  const targeted = Boolean(message.target && message.target !== "all");
  return importantMode || hasFactSignal || targeted;
}

function isLowValueRoomMemoryText(text: string): boolean {
  return /^(?:继续|好的|好|嗯|可以|收到|谢谢|你好|哈哈|hi|hello|ok|okay|yes|no|continue)[。?!！？\s]*$/i.test(text);
}

function directorObservationLabel(tags: RoomObservationTag[], room: RoomState): string {
  if (room.promptProfileId === "debate" || tags.includes("argument")) {
    return "Debate point";
  }
  if (tags.includes("stance")) {
    return "Stance";
  }
  if (tags.includes("clue")) {
    return "Clue";
  }
  if (tags.includes("intent")) {
    return "Intent";
  }
  if (tags.includes("open_question")) {
    return "Open question";
  }
  if (tags.includes("contradiction")) {
    return "Dispute";
  }
  if (room.promptProfileId === "planning") {
    return "Planning note";
  }
  return "Room observation";
}

function classifyObservationTags(text: string, room: RoomState): RoomObservationTag[] {
  const tags: RoomObservationTag[] = [];
  if (room.promptProfileId === "debate" || /(反驳|论点|证据|观点|agree|disagree|argument)/i.test(text)) {
    tags.push("argument");
  }
  if (/(立场|认为|主张|stance|position)/i.test(text)) {
    tags.push("stance");
  }
  if (/[?？]\s*$/.test(text) || /(问题|怎么做|how|why|what)/i.test(text)) {
    tags.push("open_question");
  }
  if (/(但是|冲突|矛盾|contradict|conflict)/i.test(text)) {
    tags.push("contradiction");
  }
  if (room.promptProfileId === "story" || room.promptProfileId === "mystery" || /(线索|钥匙|门|秘密|clue|secret)/i.test(text)) {
    tags.push("clue");
  }
  if (/(关系|信任|讨厌|喜欢|relationship|trust)/i.test(text)) {
    tags.push("relationship");
  }
  if (/(想要|打算|准备|intent|plan)/i.test(text)) {
    tags.push("intent");
  }
  if (tags.length === 0) {
    tags.push("scene_fact");
  }
  return Array.from(new Set(tags)).slice(0, 4);
}

function observationImportance(message: ConsoleMessage, room: RoomState): number {
  let score = message.speakerType === "room_system" ? 72 : 48;
  if (message.target && message.target !== "all") {
    score += 12;
  }
  if (room.promptProfileId === "debate" || room.promptProfileId === "story" || room.promptProfileId === "mystery") {
    score += 10;
  }
  if (/[?？]\s*$/.test(message.text)) {
    score += 8;
  }
  return Math.min(100, score);
}

function trimRoomPromptLine(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function roomScope(room: RoomState): `room:${string}` {
  return roomScopeById(room.id);
}

function roomScopeById(roomId: string): `room:${string}` {
  return `room:${roomId}`;
}

function uniqueScopes(scopes: Array<MemoryScope | undefined>): MemoryScope[] {
  return Array.from(new Set(scopes.filter((scope): scope is MemoryScope => typeof scope === "string")));
}

function emptyRoomMemoryAdapterResult(): RoomMemoryAdapterResult {
  return { results: [], observerRoleIds: [], writtenScopes: [] };
}
