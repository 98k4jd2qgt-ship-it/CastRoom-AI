import { getPackManifest, listPackSummaries } from "./characterPacks";
import { normalizeAiServiceUrlInput } from "./ai";
import {
  resetEndpointAfterConfigChange,
  applyEndpointRuntimeStatus,
} from "./aiEndpointStateMachine";
import { applyApiKeyProjection } from "./secretProjection";
import {
  directorModePromptTargetId,
  directorPromptTargetId,
  promptOverrideId,
  roomModePromptTargetId,
  roomPromptTargetId,
  resolvePromptEditorTarget,
  resolveRoomPromptMode,
  validatePromptText,
} from "./prompts";
import {
  cleanPromptPresetText,
  createPromptPreset,
  importPromptPresets,
  isPromptPresetCompatibleWithTarget,
  normalizePromptPresets,
  upsertPromptPreset,
} from "./promptPresets";
import aiPresetConfig from "../../config/ai-presets.json";
import type {
  AiServicePreset,
  AiModelEndpointConfig,
  AiModelUse,
  ConsoleAction,
  ConsoleAppState,
  ConsoleMessage,
  CharacterPackSummary,
  CharacterWorkshopState,
  CharacterWorkshopTab,
  ConfigSection,
  EditableCharacterDraft,
  DirectorScriptBoard,
  DirectorScriptItem,
  DirectorScriptItemVisibility,
  DirectorScriptPatch,
  DirectorScriptPublicSafety,
  DirectorScriptRevision,
  DirectorSourceVisibility,
  PromptCenterMode,
  PromptCenterState,
  PromptCenterPromptType,
  PromptDraft,
  PromptOverride,
  PromptPreset,
  PromptScope,
  PlotArcState,
  PlotBeat,
  PlotHook,
  RoleApiProfile,
  RoomActiveChannelId,
  RoomApiProfile,
  RoomAdvancePolicy,
  RoomAutoPacePreset,
  RoomAutoPaceSettings,
  RoomAutoSpeechPolicy,
  RoomAutoSpeechState,
  RoomDirectorApiProfile,
  RoomDirectorState,
  RoomConstraint,
  RoomContextBudget,
  RoomContextPanelMode,
  DirectorOverrideLogEntry,
  DeferredRequirement,
  FrameIntentCandidate,
  IntentTimeBinding,
  RejectedIntentSignal,
  RoomDebateSpeakerAssignment,
  RoomDebateSpeakerPosition,
  RoomDebateSpeakerPositionSetting,
  RoomFaction,
  RoomFactionHuddleMode,
  RoomFrameAbsorption,
  RoomFrameIntent,
  RoomFrameIntentKind,
  RoomFrameState,
  RoomFrameUserRole,
  RoomIdentityCard,
  RoomMentionTarget,
  RoomParticipant,
  RoomPrivateThread,
  RoomPrivateThreadCreatedBy,
  RoomPrivateWhisperPolicy,
  RoomRecipeId,
  RoomRoleMemoryScope,
  RoomSceneBoard,
  ScopedDirectorScript,
  RoomSpeakerPolicy,
  RoomSpeakerPolicySettings,
  RoomState,
  RoomUserProfile,
  SetupStep,
  VoiceBackend,
  VoiceModelDownloadState,
  LocalModelManifest,
  LocalModelRuntimeState,
} from "./types";

const setupSteps: SetupStep[] = ["start", "ai_service", "character", "voice", "privacy", "finish"];
const aiServicePresets = aiPresetConfig.presets as AiServicePreset[];
const defaultAiPreset = aiServicePresets[0]!;

export const AI_CHAT_SECRET_REF = "ai_chat_api";
export const AI_VISION_SECRET_REF = "ai_vision_api";
export const AI_TTS_SECRET_REF = "ai_tts_api";
export const DEFAULT_LOCAL_CHAT_MODEL_ID = "qwen3-0.6b-q8_0";

const defaultLocalModelOptions: LocalModelManifest[] = [
  {
    id: DEFAULT_LOCAL_CHAT_MODEL_ID,
    displayName: "Qwen3 0.6B Q8_0 - default local chat",
    fileName: "Qwen3-0.6B-Q8_0.gguf",
    sha256: "9465e63a22add5354d9bb4b99e90117043c7124007664907259bd16d043bb031",
    license: "Apache-2.0",
    licensePath: "LICENSE",
    sizeBytes: 639_446_688,
    quantization: "Q8_0",
    contextTokens: 4096,
    recommendedThreads: 4,
    minMemoryMb: 2048,
  },
];

export const defaultRoomAutoSpeechPolicy: RoomAutoSpeechPolicy = {
  maxUserTriggeredFollowUps: 2,
  maxIdleBurstTurns: 3,
  cooldownTurns: 1,
  speedDelaysMs: {
    slow: 12_000,
    normal: 7_000,
    fast: 4_000,
  },
};

export const defaultRoomAdvancePolicy: RoomAdvancePolicy = "fill_gap";
export const defaultRoomContextBudget: RoomContextBudget = "balanced";

export const defaultRoomAutoPaceSettings: RoomAutoPaceSettings = {
  preset: "natural",
  minDelayMs: 3_000,
  maxDelayMs: 8_000,
  idleFillDelayMs: 12_000,
  randomize: true,
};

export const defaultRoomSpeakerPolicy: RoomSpeakerPolicySettings = {
  mode: "balanced",
  maxConsecutivePairTurns: 3,
  lurkerBoostAfterTurns: 4,
  recentSpeakerPenalty: true,
};

const roomSpeakerPolicyValues = new Set<RoomSpeakerPolicy>(["balanced", "round_robin", "spotlight", "freeform"]);
const roomAutoPacePresetValues = new Set<RoomAutoPacePreset>(["fast", "natural", "slow", "custom"]);
const roomContextBudgetValues = new Set<RoomContextBudget>(["compact", "balanced", "full"]);

const roomAutoPacePresetSettings: Record<Exclude<RoomAutoPacePreset, "custom">, RoomAutoPaceSettings> = {
  fast: {
    preset: "fast",
    minDelayMs: 1_000,
    maxDelayMs: 3_000,
    idleFillDelayMs: 5_000,
    randomize: true,
  },
  natural: defaultRoomAutoPaceSettings,
  slow: {
    preset: "slow",
    minDelayMs: 8_000,
    maxDelayMs: 20_000,
    idleFillDelayMs: 25_000,
    randomize: true,
  },
};

function normalizeRoomAutoPaceSettings(settings: Partial<RoomAutoPaceSettings> | undefined): RoomAutoPaceSettings {
  const preset = settings?.preset && roomAutoPacePresetValues.has(settings.preset) ? settings.preset : defaultRoomAutoPaceSettings.preset;
  if (preset !== "custom") {
    return { ...roomAutoPacePresetSettings[preset] };
  }
  const presetDefaults = { ...defaultRoomAutoPaceSettings, preset: "custom" as const };
  const minDelayMs = clampNumber(settings?.minDelayMs ?? presetDefaults.minDelayMs, 500, 60_000, presetDefaults.minDelayMs);
  const maxDelayMs = clampNumber(
    settings?.maxDelayMs ?? presetDefaults.maxDelayMs,
    minDelayMs,
    120_000,
    Math.max(minDelayMs, presetDefaults.maxDelayMs),
  );
  return {
    preset,
    minDelayMs,
    maxDelayMs,
    idleFillDelayMs: clampNumber(settings?.idleFillDelayMs ?? presetDefaults.idleFillDelayMs, 1_000, 180_000, presetDefaults.idleFillDelayMs),
    randomize: settings?.randomize ?? presetDefaults.randomize,
  };
}

function normalizeRoomContextBudget(value: RoomContextBudget | undefined): RoomContextBudget {
  return value && roomContextBudgetValues.has(value) ? value : defaultRoomContextBudget;
}

function normalizeRoomSpeakerPolicy(policy: Partial<RoomSpeakerPolicySettings> | undefined): RoomSpeakerPolicySettings {
  return {
    mode: policy?.mode && roomSpeakerPolicyValues.has(policy.mode) ? policy.mode : defaultRoomSpeakerPolicy.mode,
    maxConsecutivePairTurns: clampNumber(
      policy?.maxConsecutivePairTurns ?? defaultRoomSpeakerPolicy.maxConsecutivePairTurns,
      2,
      8,
      defaultRoomSpeakerPolicy.maxConsecutivePairTurns,
    ),
    lurkerBoostAfterTurns: clampNumber(
      policy?.lurkerBoostAfterTurns ?? defaultRoomSpeakerPolicy.lurkerBoostAfterTurns,
      2,
      12,
      defaultRoomSpeakerPolicy.lurkerBoostAfterTurns,
    ),
    recentSpeakerPenalty: policy?.recentSpeakerPenalty ?? defaultRoomSpeakerPolicy.recentSpeakerPenalty,
  };
}

const defaultRoomAutoSpeechState: RoomAutoSpeechState = {
  status: "paused",
  consecutiveAutoTurns: 0,
  userTriggeredFollowUps: 0,
  lastTurnAt: null,
  nextTurnAt: null,
  lastReason: "manual_pause",
  pendingFollowup: null,
};

const defaultRoomSimulationState = (
  objective: ConsoleAppState["room"]["simulationObjective"],
): ConsoleAppState["room"]["simulation"] => ({
  enabled: false,
  style: simulationStyleForObjective(objective),
  playerIntervention: "watch",
  uncertaintyProfile: "balanced",
  phase: "setup",
  beatIndex: 0,
  currentFocus: "Waiting for the room to start.",
  tension: 20,
  noveltyScore: 100,
  lastSpeakerIds: [],
  openHooks: [],
});

const plotBeatValues = new Set<PlotBeat>([
  "setup",
  "cue",
  "pressure",
  "twist",
  "choice",
  "consequence",
  "payoff",
  "cooldown",
]);

function defaultRoomPlotArcState(topic = "Daily chat", now = new Date().toISOString()): PlotArcState {
  return {
    theme: topic || "Daily chat",
    phase: "setup",
    publicGoal: "",
    currentPressure: "",
    hooks: [],
    unresolved: [],
    nextBeat: "",
    updatedAt: now,
  };
}

function normalizePlotBeat(value: unknown): PlotBeat {
  return typeof value === "string" && plotBeatValues.has(value as PlotBeat) ? (value as PlotBeat) : "setup";
}

function normalizePlotHook(raw: Partial<PlotHook> | undefined, index: number, now: string): PlotHook | null {
  const text = typeof raw?.text === "string" ? raw.text.trim() : "";
  if (!text) {
    return null;
  }
  return {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id : `plot-hook-${index + 1}`,
    text,
    visibility: raw?.visibility === "hidden" ? "hidden" : "public",
    status: raw?.status === "triggered" || raw?.status === "resolved" ? raw.status : "open",
    knownToRoleIds: Array.isArray(raw?.knownToRoleIds) ? raw.knownToRoleIds.filter((roleId) => typeof roleId === "string") : [],
    createdAt: typeof raw?.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt : now,
    updatedAt: typeof raw?.updatedAt === "string" && raw.updatedAt.trim() ? raw.updatedAt : undefined,
    source: raw?.source === "room" || raw?.source === "system" ? raw.source : "director",
  };
}

function normalizeRoomPlotArcState(plot: Partial<PlotArcState> | undefined, topic: string): PlotArcState {
  const now = new Date().toISOString();
  const fallback = defaultRoomPlotArcState(topic, now);
  const hooks = Array.isArray(plot?.hooks)
    ? plot.hooks
        .map((hook, index) => normalizePlotHook(hook, index, now))
        .filter((hook): hook is PlotHook => Boolean(hook))
        .slice(-24)
    : [];
  const unresolved = Array.isArray(plot?.unresolved)
    ? Array.from(new Set(plot.unresolved.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))).slice(-12)
    : [];
  return {
    ...fallback,
    ...plot,
    theme: typeof plot?.theme === "string" && plot.theme.trim() ? plot.theme.trim() : fallback.theme,
    phase: normalizePlotBeat(plot?.phase),
    publicGoal: typeof plot?.publicGoal === "string" ? plot.publicGoal.trim() : fallback.publicGoal,
    currentPressure: typeof plot?.currentPressure === "string" ? plot.currentPressure.trim() : fallback.currentPressure,
    hooks,
    unresolved,
    nextBeat: typeof plot?.nextBeat === "string" ? plot.nextBeat.trim() : fallback.nextBeat,
    updatedAt: typeof plot?.updatedAt === "string" && plot.updatedAt.trim() ? plot.updatedAt : fallback.updatedAt,
  };
}

const roomFrameIntentKinds = new Set<RoomFrameIntentKind>([
  "in_character",
  "out_of_character_request",
  "director_request",
  "action_attempt",
  "world_edit_claim",
  "mode_shift",
  "meta_control",
  "collaboration_request",
  "evaluation_request",
  "scheduling_request",
  "memory_request",
  "plot_direction",
]);

const roomFrameUserRoles = new Set<RoomFrameUserRole>(["player", "host_request", "developer", "control"]);

const roomFrameAbsorptions = new Set<RoomFrameAbsorption>([
  "normal_reply",
  "direct_apply",
  "plot_transition",
  "wait_for_choice",
  "private_directive",
  "blocked",
]);

function defaultRoomFrameState(): RoomFrameState {
  return {
    lastIntent: null,
    recentChange: "",
    updatedAt: null,
  };
}

const defaultNewRoomTitle = "New Room";

function normalizeRoomFrameIntent(raw: Partial<RoomFrameIntent> | null | undefined): RoomFrameIntent | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const kind = roomFrameIntentKinds.has(raw.kind as RoomFrameIntentKind) ? raw.kind as RoomFrameIntentKind : "in_character";
  const userRole = roomFrameUserRoles.has(raw.userRole as RoomFrameUserRole) ? raw.userRole as RoomFrameUserRole : "player";
  const absorption = roomFrameAbsorptions.has(raw.absorption as RoomFrameAbsorption)
    ? raw.absorption as RoomFrameAbsorption
    : "normal_reply";
  const summary = typeof raw.summary === "string" ? raw.summary.trim().slice(0, 240) : "";
  const authority = raw.authority === "strict" || raw.authority === "loose" || raw.authority === "developer" ? raw.authority : "balanced";
  const sourceText = typeof raw.sourceText === "string" ? raw.sourceText.trim().slice(0, 240) : undefined;
  const createdAt = typeof raw.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt : new Date().toISOString();
  const normalizeCandidate = (candidate: unknown): FrameIntentCandidate | null => {
    if (!candidate || typeof candidate !== "object") {
      return null;
    }
    const value = candidate as Partial<FrameIntentCandidate>;
    const candidateKind = roomFrameIntentKinds.has(value.kind as RoomFrameIntentKind) ? value.kind as RoomFrameIntentKind : kind;
    const timeBinding: IntentTimeBinding =
      value.timeBinding === "deferred" || value.timeBinding === "conditional" || value.timeBinding === "background_rule"
        ? value.timeBinding
        : "immediate";
    return {
      kind: candidateKind,
      score: typeof value.score === "number" && Number.isFinite(value.score) ? Math.max(0, Math.min(100, value.score)) : 0,
      timeBinding,
      reason: typeof value.reason === "string" ? value.reason.trim().slice(0, 160) : candidateKind,
      requestedMode: value.requestedMode,
    };
  };
  const primary = normalizeCandidate(raw.primary);
  const secondary = Array.isArray(raw.secondary)
    ? raw.secondary.map(normalizeCandidate).filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate)).slice(0, 6)
    : undefined;
  const deferredRequirements = Array.isArray(raw.deferredRequirements)
    ? raw.deferredRequirements
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const value = item as Partial<DeferredRequirement>;
          const kindValue = typeof value.kind === "string" ? value.kind : "plot_payoff";
          const allowedKinds = new Set<DeferredRequirement["kind"]>([
            "final_verdict",
            "round_summary",
            "public_response",
            "plot_payoff",
            "study_check",
            "planning_next_step",
          ]);
          const safeKind = allowedKinds.has(kindValue as DeferredRequirement["kind"])
            ? kindValue as DeferredRequirement["kind"]
            : "plot_payoff";
          return {
            kind: safeKind,
            summary: typeof value.summary === "string" ? value.summary.trim().slice(0, 180) : "",
            trigger: typeof value.trigger === "string" ? value.trigger.trim().slice(0, 140) : "",
            sourceText: typeof value.sourceText === "string" ? value.sourceText.trim().slice(0, 240) : sourceText ?? "",
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item?.summary))
        .slice(0, 6)
    : undefined;
  const rejected = Array.isArray(raw.rejected)
    ? raw.rejected
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const value = item as Partial<RejectedIntentSignal>;
          return {
            kind: roomFrameIntentKinds.has(value.kind as RoomFrameIntentKind) ? value.kind as RoomFrameIntentKind : "out_of_character_request",
            reason: typeof value.reason === "string" ? value.reason.trim().slice(0, 180) : "",
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item?.reason))
        .slice(0, 6)
    : undefined;
  const ambiguity = raw.ambiguity === "medium" || raw.ambiguity === "high" ? raw.ambiguity : raw.ambiguity === "low" ? "low" : undefined;
  return {
    kind,
    userRole,
    absorption,
    summary: summary || kind,
    authority,
    requestedMode: raw.requestedMode,
    primary: primary ?? undefined,
    secondary,
    deferredRequirements,
    rejected,
    ambiguity,
    sourceText,
    createdAt,
  };
}

function normalizeRoomFrameState(frame: Partial<RoomFrameState> | undefined): RoomFrameState {
  const fallback = defaultRoomFrameState();
  const lastIntent = normalizeRoomFrameIntent(frame?.lastIntent);
  return {
    lastIntent,
    recentChange: typeof frame?.recentChange === "string" ? frame.recentChange.trim().slice(0, 240) : fallback.recentChange,
    updatedAt: typeof frame?.updatedAt === "string" && frame.updatedAt.trim() ? frame.updatedAt : lastIntent?.createdAt ?? fallback.updatedAt,
  };
}

const defaultRoomMatchState = (): ConsoleAppState["room"]["match"] => ({
  round: 1,
  currentSide: undefined,
  motion: undefined,
  speakerAssignments: [],
  nextSpeakerRoleId: undefined,
  nextPosition: undefined,
  debatePhase: "setup_pending",
  spokenRoleIdsByRound: {},
  skippedRoleIdsByRound: {},
  deferredRequirements: [],
  debateFlow: undefined,
  scoreboard: [],
  winCondition: "Keep the room moving with clear turns and useful progress.",
  judgeNotes: [],
});

const debateSpeakerPositions: RoomDebateSpeakerPosition[] = [
  "first_speaker",
  "second_speaker",
  "third_speaker",
];

const debateSpeakerPositionLabels: Record<RoomDebateSpeakerPosition, string> = {
  first_speaker: "一辩",
  second_speaker: "二辩",
  third_speaker: "三辩",
  free_speaker: "自由辩手",
  alternate: "替补",
};

function isDebateRuntimeRoom(room: RoomState): boolean {
  return room.promptProfileId === "debate" || room.director.recipeId === "debate" || room.simulationObjective === "debate";
}

function debateSpeakerPositionLabel(position: RoomDebateSpeakerPosition): string {
  return debateSpeakerPositionLabels[position] ?? position;
}

function normalizeDebateSpeakerPosition(value: string | undefined): RoomDebateSpeakerPosition | null {
  return value === "first_speaker" ||
    value === "second_speaker" ||
    value === "third_speaker" ||
    value === "free_speaker" ||
    value === "alternate"
    ? value
    : null;
}

function participantDebateFactionId(participant: RoomParticipant | undefined): string | null {
  const factionId = participant?.factionId;
  return factionId && factionId !== "neutral" ? factionId : null;
}

function syncDebateSpeakerAssignments(room: RoomState): RoomState {
  const validRoleIds = new Set(room.participants.map((participant) => participant.id));
  const spokenRoleIdsByRound = Object.fromEntries(
    Object.entries(room.match?.spokenRoleIdsByRound ?? {})
      .map(([round, roleIds]) => [
        round,
        Array.isArray(roleIds) ? roleIds.filter((roleId) => validRoleIds.has(roleId)) : [],
      ])
      .filter(([, roleIds]) => roleIds.length > 0),
  );
  const skippedRoleIdsByRound = Object.fromEntries(
    Object.entries(room.match?.skippedRoleIdsByRound ?? {})
      .map(([round, roleIds]) => [
        round,
        Array.isArray(roleIds) ? roleIds.filter((roleId) => validRoleIds.has(roleId)) : [],
      ])
      .filter(([, roleIds]) => roleIds.length > 0),
  );
  const normalizedMatch = {
    ...defaultRoomMatchState(),
    ...(room.match ?? {}),
    speakerAssignments: Array.isArray(room.match?.speakerAssignments) ? room.match.speakerAssignments : [],
    spokenRoleIdsByRound: recoverDebateSpokenRoleIdsFromTimeline(room, spokenRoleIdsByRound),
    skippedRoleIdsByRound,
    deferredRequirements: Array.isArray(room.match?.deferredRequirements) ? room.match.deferredRequirements : [],
    scoreboard: room.factions
      .filter((faction) => faction.id !== "neutral")
      .map((faction) => ({
        id: faction.id,
        label: faction.name,
        score: room.match?.scoreboard?.find((item) => item.id === faction.id)?.score ?? 0,
      })),
  };

  if (!isDebateRuntimeRoom(room)) {
    return {
      ...room,
      match: normalizedMatch,
    };
  }

  const participantById = new Map(room.participants.map((participant) => [participant.id, participant]));
  const lockedAssignments: RoomDebateSpeakerAssignment[] = [];
  const usedLockedSlots = new Set<string>();

  for (const assignment of normalizedMatch.speakerAssignments) {
    const participant = participantById.get(assignment.roleId);
    const factionId = participantDebateFactionId(participant);
    const position = normalizeDebateSpeakerPosition(assignment.position);
    if (!participant || !factionId || !position || !assignment.locked) {
      continue;
    }

    const slotKey = `${factionId}:${position}`;
    if (position !== "free_speaker" && position !== "alternate" && usedLockedSlots.has(slotKey)) {
      continue;
    }
    usedLockedSlots.add(slotKey);

    lockedAssignments.push({
      roleId: participant.id,
      factionId,
      position,
      label: debateSpeakerPositionLabel(position),
      source: assignment.source === "director" ? "director" : "manual",
      locked: true,
      updatedAt: assignment.updatedAt,
    });
  }

  const lockedByRoleId = new Set(lockedAssignments.map((assignment) => assignment.roleId));
  const usedByFaction = new Map<string, Set<RoomDebateSpeakerPosition>>();
  for (const assignment of lockedAssignments) {
    const used = usedByFaction.get(assignment.factionId) ?? new Set<RoomDebateSpeakerPosition>();
    used.add(assignment.position);
    usedByFaction.set(assignment.factionId, used);
  }

  const autoAssignments: RoomDebateSpeakerAssignment[] = [];
  for (const participant of room.participants) {
    const factionId = participantDebateFactionId(participant);
    if (!factionId || lockedByRoleId.has(participant.id)) {
      continue;
    }
    const used = usedByFaction.get(factionId) ?? new Set<RoomDebateSpeakerPosition>();
    const position = debateSpeakerPositions.find((candidate) => !used.has(candidate)) ?? "free_speaker";
    used.add(position);
    usedByFaction.set(factionId, used);
    autoAssignments.push({
      roleId: participant.id,
      factionId,
      position,
      label: debateSpeakerPositionLabel(position),
      source: "auto",
      locked: false,
    });
  }

  const participantOrder = new Map(room.participants.map((participant, index) => [participant.id, index]));
  const speakerAssignments = [...lockedAssignments, ...autoAssignments].sort(
    (left, right) => (participantOrder.get(left.roleId) ?? 0) - (participantOrder.get(right.roleId) ?? 0),
  );
  const currentSide =
    normalizedMatch.currentSide && speakerAssignments.some((assignment) => assignment.factionId === normalizedMatch.currentSide)
      ? normalizedMatch.currentSide
      : speakerAssignments[0]?.factionId ?? normalizedMatch.currentSide;
  const nextAssignment =
    speakerAssignments.find((assignment) => assignment.roleId === normalizedMatch.nextSpeakerRoleId) ??
    speakerAssignments.find(
      (assignment) => assignment.factionId === currentSide && assignment.position === normalizedMatch.nextPosition,
    ) ??
    speakerAssignments.find((assignment) => assignment.factionId === currentSide) ??
    speakerAssignments[0];

  return {
    ...room,
    match: {
      ...normalizedMatch,
      currentSide,
      speakerAssignments,
      nextSpeakerRoleId: nextAssignment?.roleId,
      nextPosition: nextAssignment?.position,
    },
  };
}

function recoverDebateSpokenRoleIdsFromTimeline(
  room: RoomState,
  current: Record<string, string[]>,
): Record<string, string[]> {
  const round = Math.max(1, Math.trunc(room.match?.round || 1));
  const key = String(round);
  const recovered = new Set(current[key] ?? []);
  const validFactionRoleIds = new Set(
    room.participants
      .filter((participant) => participant.factionId && participant.factionId !== "neutral")
      .map((participant) => participant.id),
  );
  for (const message of room.messages ?? []) {
    if (
      message.speakerType === "role" &&
      message.speakerId &&
      validFactionRoleIds.has(message.speakerId) &&
      message.visibility !== "private_ai" &&
      message.visibility !== "faction_huddle"
    ) {
      recovered.add(message.speakerId);
    }
  }
  if (recovered.size === 0) {
    return current;
  }
  return {
    ...current,
    [key]: Array.from(recovered),
  };
}

function setRoomDebateSpeakerPosition(
  room: RoomState,
  roleId: string,
  position: RoomDebateSpeakerPositionSetting,
): RoomState {
  const participant = room.participants.find((candidate) => candidate.id === roleId);
  const factionId = participantDebateFactionId(participant);
  const normalizedMatch = {
    ...defaultRoomMatchState(),
    ...(room.match ?? {}),
    speakerAssignments: Array.isArray(room.match?.speakerAssignments) ? room.match.speakerAssignments : [],
  };
  let speakerAssignments = normalizedMatch.speakerAssignments.filter((assignment) => assignment.roleId !== roleId);

  if (position !== "auto" && participant && factionId) {
    speakerAssignments = speakerAssignments.filter(
      (assignment) =>
        !(
          assignment.factionId === factionId &&
          assignment.position === position &&
          position !== "free_speaker" &&
          position !== "alternate"
        ),
    );
    speakerAssignments.push({
      roleId: participant.id,
      factionId,
      position,
      label: debateSpeakerPositionLabel(position),
      source: "manual",
      locked: true,
      updatedAt: new Date().toISOString(),
    });
  }

  return syncDebateSpeakerAssignments({
    ...room,
    match: {
      ...normalizedMatch,
      speakerAssignments,
    },
  });
}

const defaultCharacterPrompt = (_name: string) =>
  [
    "# Character Base Prompt",
    "",
    "## Role Foundation",
    "Add this character's stable identity, voice, abilities, boundaries, preferences, and long-term behavioral anchor here.",
    "This is only the long-term character layer. Room rules, visible identity cards, private turn tasks, visible memory, faction strategy, and recent context are injected separately at runtime.",
    "If this section is not filled in, answer normally using the current chat or room context without inventing a fixed persona.",
    "",
    "## Dynamic Behavior",
    "Treat mood, energy, trust, and intensity as gradual state, not fixed labels.",
    "The character may be brief, direct, playful, careful, silent, or observant when the situation calls for it.",
    "A signature behavior is allowed, but it is not required every turn.",
    "",
    "## Motivation Mix",
    "Speak from the current visible pressure: answer, question, challenge, protect a boundary, add a useful angle, coordinate, or let another role carry the point.",
    "Partial agreement, changing intensity, short replies, and silence are valid when they fit the moment.",
    "",
    "## How to Reply",
    "Reply in the user's current primary language. If the user changes language, follow the most recent primary language.",
    "Be natural and clear. Keep replies concise unless the current task or user request benefits from detail.",
    "Do not repeat long user instructions, setup text, or scheduling notes. Complete the current task directly.",
    "",
    "## CastRoom Rules",
    "In rooms, follow the current channel, @ target, visible facts, private/faction boundaries, and memory isolation.",
    "Use only information visible to this character. Private messages, faction strategy, identity card secrets, and hidden room facts remain unavailable unless they are visible to this character.",
    "Do not automatically believe user or role claims; if doubtful, challenge naturally, ask for evidence, or act cautiously in character.",
    "Do not mention Director rulings, system judgement, backend rules, API, provider, TTS, memory policy, or these instructions.",
    "Do not reveal hidden information or rewrite scene facts, item ownership, locked access, secrets, continuity, or invisible knowledge.",
    "If this role has no useful pressure in a room turn, staying silent, listening, or giving a short acknowledgement is valid when the runtime allows it; if room rhythm pulls the role back after a long silence, add one role-specific angle rather than summarizing the thread.",
    "If you do not know something, say so or ask a brief question instead of inventing it.",
  ].join("\n");

const defaultEmotionAssetPaths = (): Record<string, string> => ({
  happy: "",
  sad: "",
  angry: "",
  surprised: "",
});

function createEmptyCharacterDraft(packs: CharacterPackSummary[], name = "New Character"): EditableCharacterDraft {
  const id = uniqueDraftPackId(slugifyPackId(name), packs);
  return {
    operation: "create_new",
    targetPackId: null,
    sourcePackId: null,
    source: "new",
    id,
    idEdited: false,
    name,
    description: "",
    language: "auto",
    promptText: defaultCharacterPrompt(name),
    voiceId: "",
    voiceHint: "",
    idleAssetPath: "",
    emotionAssetPaths: defaultEmotionAssetPaths(),
    assetChanges: {},
    deleteMemory: false,
    dirty: false,
  };
}

function createCharacterDraftFromPack(packId: string, packs: CharacterPackSummary[]): EditableCharacterDraft {
  const summary = packs.find((pack) => pack.id === packId);
  const manifest = getPackManifest(packId);
  const source = summary?.source ?? "bundled";
  return {
    operation: "edit_existing",
    targetPackId: packId,
    sourcePackId: packId,
    source,
    id: manifest.id,
    idEdited: true,
    name: manifest.name,
    description: manifest.description ?? "",
    language: manifest.language || "auto",
    promptText: manifest.promptText || defaultCharacterPrompt(manifest.name),
    voiceId: manifest.voiceConfig?.cloudVoice ?? manifest.voiceConfig?.windowsVoice ?? "",
    voiceHint: manifest.voiceConfig?.language ?? "",
    idleAssetPath: "",
    emotionAssetPaths: defaultEmotionAssetPaths(),
    assetChanges: {},
    deleteMemory: false,
    dirty: false,
  };
}

function createDefaultPackWorkshopState(packs: CharacterPackSummary[]): CharacterWorkshopState {
  return {
    mode: "list",
    activeTab: "overview",
    editingPackId: null,
    draft: createEmptyCharacterDraft(packs),
    status: "idle",
    message: "Create, edit, duplicate, or delete characters here.",
    warnings: [],
    errors: [],
  };
}

function slugifyPackId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "character";
}

function uniqueDraftPackId(baseId: string, packs: CharacterPackSummary[], currentId?: string): string {
  const existing = new Set(packs.map((pack) => pack.id).filter((id) => id !== currentId));
  if (!existing.has(baseId)) {
    return baseId;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${baseId}-${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return `${baseId}-${Date.now()}`;
}

function firstAvailablePackId(packs: CharacterPackSummary[], fallback: string): string {
  return packs[0]?.id ?? fallback;
}

const defaultRoomPrivateWhisperPolicy: RoomPrivateWhisperPolicy = {
  maxConsecutivePrivateTurns: 3,
  showHiddenHint: true,
  savePrivateToRoomMemory: false,
};

const defaultRoomFactions: RoomFaction[] = [
  { id: "neutral", name: "Neutral", color: "#8c96a3", description: "No team huddles.", publicGoal: "", privateGoal: "" },
];

const vividFactionColorPalette = [
  "#ff4d6d",
  "#2ee6a6",
  "#4da3ff",
  "#ffd166",
  "#b86bff",
  "#ff7a3d",
  "#36d6ff",
  "#f4ff52",
  "#ff5eea",
  "#7cff4d",
  "#ff3b3b",
  "#39ffb6",
  "#6d7dff",
  "#ff9f1c",
  "#00e5ff",
  "#e6ff2e",
];

const defaultRoomApiProfile: RoomApiProfile = {
  mode: "demo",
  generationMode: "inherit_global",
  providerId: "local-model",
  secretRef: null,
  keyPreview: "",
  baseUrl: defaultAiPreset.baseUrl,
  chatModel: defaultAiPreset.recommendedChatModel,
  visionModel: defaultAiPreset.recommendedVisionModel,
  temperature: 0.7,
  maxTokens: 900,
  advancedOpen: false,
  status: "missing_key",
  lastTestMessage: "Room uses the bundled local chat model while local chat is on. Turn local chat off to use cloud chat.",
  testedAt: null,
};

const defaultDirectorApiProfile: RoomDirectorApiProfile = {
  ...defaultRoomApiProfile,
  mode: "use_room",
  generationOverrideEnabled: false,
  providerId: "room",
  status: "missing_key",
  lastTestMessage: "Director uses the room default API unless you give it its own setup.",
};

const defaultRoleApiProfile: RoleApiProfile = {
  mode: "use_room",
  generationOverrideEnabled: false,
  providerId: "room",
  secretRef: null,
  keyPreview: "",
  baseUrl: "",
  chatModel: "local chat model",
  visionModel: "",
  temperature: 0.7,
  maxTokens: 900,
  status: "missing_key",
};

const defaultRoomUserProfile: RoomUserProfile = {
  userId: "local-user",
  displayName: "You",
  factionId: "neutral",
  aliases: ["director", "gm", "system", "\u5bfc\u6f14", "\u4e3b\u6301\u4eba", "\u65c1\u767d"],
};

const defaultPromptCenterState: PromptCenterState = {
  overrides: [],
  drafts: [],
  presets: [],
  view: {
    mode: "rooms",
    selectedRoomId: "demo-room",
    selectedType: "room",
    selectedPromptMode: "casual",
    selectedPackId: "demo-mio",
    roomSearchQuery: "",
    characterSearchQuery: "",
    previewOpen: false,
  },
  activeEditorScope: "room",
  activeEditorTargetId: "room:demo-room",
  revision: 0,
  lastMessage: "Prompt Center is ready.",
  lastError: null,
};

const defaultSceneBoard: RoomSceneBoard = {
  title: "Open Room",
  currentScene: "The room is ready. Add characters, set a topic, then talk naturally.",
  goal: "Keep the conversation clear, directed, and easy to continue.",
  mood: "calm",
  openClues: [],
  unresolved: [],
  updatedAt: null,
};

function isDirectorScriptItemVisibility(value: unknown): value is DirectorScriptItemVisibility {
  return value === "public" || value === "director_only" || value === "known_to_roles" || value === "faction";
}

function isDirectorSourceVisibility(value: unknown): value is DirectorSourceVisibility {
  return value === "public" ||
    value === "private_thread" ||
    value === "private_ai" ||
    value === "faction_huddle" ||
    value === "director_channel" ||
    value === "director_only";
}

function isDirectorScriptPublicSafety(value: unknown): value is DirectorScriptPublicSafety {
  return value === "public_safe" || value === "private_blocked" || value === "developer_revealed";
}

function createDirectorScriptItem(
  text: string,
  now: string,
  createdBy: DirectorScriptItem["createdBy"] = "director",
  options: Partial<Pick<DirectorScriptItem, "visibility" | "sourceVisibility" | "sourceMessageIds" | "publicSafety">> = {},
): DirectorScriptItem {
  return {
    id: `script-${crypto.randomUUID()}`,
    text,
    status: "planned",
    visibility: options.visibility ?? "director_only",
    sourceVisibility: options.sourceVisibility,
    sourceMessageIds: options.sourceMessageIds,
    publicSafety: options.publicSafety,
    createdBy,
    updatedAt: now,
  };
}

function createDefaultDirectorScriptBoard(recipeId: RoomRecipeId = "casual", topic = "Daily chat", now = new Date().toISOString()): DirectorScriptBoard {
  const premise = topic && !/^daily chat$/i.test(topic) ? topic : "";
  const isSceneMode = recipeId === "story" || recipeId === "mystery";
  return {
    premise,
    currentPhase: recipeId === "casual" ? "open conversation" : "setup",
    hiddenFacts: [],
    openThreads: premise
      ? [
          createDirectorScriptItem(`Keep the room centered on: ${premise}`, now, "director", {
            visibility: "public",
            sourceVisibility: "public",
            publicSafety: "public_safe",
          }),
        ]
      : [],
    plannedBeats: [],
    pressureSources: [],
    environmentAnchors: isSceneMode
      ? [
          createDirectorScriptItem("Establish what the room can currently see, hear, or notice before forcing a plot beat.", now, "director", {
            visibility: "public",
            sourceVisibility: "public",
            publicSafety: "public_safe",
          }),
        ]
      : [],
    forbiddenReveals: [
      createDirectorScriptItem("Do not expose director-only plans, private channel knowledge, faction knowledge, or hidden facts in public narration.", now, "director", {
        visibility: "director_only",
        sourceVisibility: "director_only",
        publicSafety: "private_blocked",
      }),
    ],
    continuityNotes: [],
    revisionLog: [],
  };
}

function normalizeDirectorScriptItem(raw: Partial<DirectorScriptItem> | undefined, index: number, now: string): DirectorScriptItem | null {
  const text = typeof raw?.text === "string" ? raw.text.trim() : "";
  if (!text) {
    return null;
  }
  const status = raw?.status === "active" ||
    raw?.status === "revealed" ||
    raw?.status === "changed" ||
    raw?.status === "retired" ||
    raw?.status === "contradicted"
    ? raw.status
    : "planned";
  return {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id : `script-item-${index + 1}`,
    text,
    status,
    visibility: isDirectorScriptItemVisibility(raw?.visibility) ? raw.visibility : "director_only",
    sourceVisibility: isDirectorSourceVisibility(raw?.sourceVisibility) ? raw.sourceVisibility : undefined,
    sourceMessageIds: Array.isArray(raw?.sourceMessageIds)
      ? raw.sourceMessageIds.filter((id): id is string => typeof id === "string" && Boolean(id.trim())).slice(-8)
      : undefined,
    publicSafety: isDirectorScriptPublicSafety(raw?.publicSafety)
      ? raw.publicSafety
      : raw?.createdBy === "developer"
        ? "developer_revealed"
        : undefined,
    createdBy: raw?.createdBy === "developer" ? "developer" : "director",
    updatedAt: typeof raw?.updatedAt === "string" && raw.updatedAt.trim() ? raw.updatedAt : now,
  };
}

function normalizeDirectorScriptRevision(raw: Partial<DirectorScriptRevision> | undefined, index: number, now: string): DirectorScriptRevision | null {
  const summary = typeof raw?.summary === "string" ? raw.summary.trim() : "";
  if (!summary) {
    return null;
  }
  const reason = raw?.reason === "player_choice" ||
    raw?.reason === "role_action" ||
    raw?.reason === "contradiction" ||
    raw?.reason === "pace" ||
    raw?.reason === "developer_edit" ||
    raw?.reason === "director_refinement"
    ? raw.reason
    : "director_refinement";
  return {
    id: typeof raw?.id === "string" && raw.id.trim() ? raw.id : `script-revision-${index + 1}`,
    reason,
    summary,
    before: typeof raw?.before === "string" ? raw.before.slice(0, 400) : undefined,
    after: typeof raw?.after === "string" ? raw.after.slice(0, 400) : undefined,
    createdBy: raw?.createdBy === "developer" ? "developer" : "director",
    createdAt: typeof raw?.createdAt === "string" && raw.createdAt.trim() ? raw.createdAt : now,
  };
}

function normalizeDirectorScriptBoard(
  board: Partial<DirectorScriptBoard> | undefined,
  recipeId: RoomRecipeId,
  topic: string,
): DirectorScriptBoard {
  const now = new Date().toISOString();
  const fallback = createDefaultDirectorScriptBoard(recipeId, topic, now);
  const normalizeItems = (items: Partial<DirectorScriptItem>[] | undefined, limit: number) =>
    Array.isArray(items)
      ? items
          .map((item, index) => normalizeDirectorScriptItem(item, index, now))
          .filter((item): item is DirectorScriptItem => Boolean(item))
          .slice(-limit)
      : [];
  return {
    premise: typeof board?.premise === "string" ? board.premise.slice(0, 400) : fallback.premise,
    currentPhase: typeof board?.currentPhase === "string" && board.currentPhase.trim() ? board.currentPhase.slice(0, 120) : fallback.currentPhase,
    hiddenFacts: normalizeItems(board?.hiddenFacts, 24),
    openThreads: normalizeItems(board?.openThreads, 24),
    plannedBeats: normalizeItems(board?.plannedBeats, 24),
    pressureSources: normalizeItems(board?.pressureSources, 24),
    environmentAnchors: normalizeItems(board?.environmentAnchors, 16).length
      ? normalizeItems(board?.environmentAnchors, 16)
      : fallback.environmentAnchors,
    forbiddenReveals: normalizeItems(board?.forbiddenReveals, 16).length
      ? normalizeItems(board?.forbiddenReveals, 16)
      : fallback.forbiddenReveals,
    continuityNotes: normalizeItems(board?.continuityNotes, 24),
    revisionLog: Array.isArray(board?.revisionLog)
      ? board.revisionLog
          .map((revision, index) => normalizeDirectorScriptRevision(revision, index, now))
          .filter((revision): revision is DirectorScriptRevision => Boolean(revision))
          .slice(-30)
      : [],
  };
}

function applyDirectorScriptPatch(board: DirectorScriptBoard, patch: DirectorScriptPatch, topic: string, recipeId: RoomRecipeId): DirectorScriptBoard {
  const normalizedPatch = normalizeDirectorScriptBoard({ ...board, ...patch }, recipeId, topic);
  const revisionLog = patch.revision ? [patch.revision, ...board.revisionLog].slice(0, 30) : normalizedPatch.revisionLog;
  return {
    ...board,
    ...normalizedPatch,
    revisionLog,
  };
}

const directorScriptModes: RoomRecipeId[] = ["casual", "story", "mystery", "study", "debate", "planning"];

function normalizeDirectorScriptMode(value: unknown): RoomRecipeId {
  return typeof value === "string" && directorScriptModes.includes(value as RoomRecipeId) ? (value as RoomRecipeId) : "casual";
}

function createScopedDirectorScript(
  roomId: string,
  mode: RoomRecipeId,
  topic: string,
  plotDirection?: Partial<PlotArcState>,
  scriptBoard?: Partial<DirectorScriptBoard>,
  updatedAt = new Date().toISOString(),
): ScopedDirectorScript {
  return {
    scope: { roomId, mode },
    plotDirection: normalizeRoomPlotArcState(plotDirection, topic),
    scriptBoard: normalizeDirectorScriptBoard(scriptBoard, mode, topic),
    updatedAt,
  };
}

function normalizeScopedDirectorScript(
  script: Partial<ScopedDirectorScript> | undefined,
  roomId: string,
  mode: RoomRecipeId,
  topic: string,
): ScopedDirectorScript {
  return createScopedDirectorScript(roomId, mode, topic, script?.plotDirection, script?.scriptBoard, script?.updatedAt);
}

function normalizeDirectorScriptsByMode(
  scripts: RoomState["directorScriptsByMode"] | undefined,
  roomId: string,
  activeMode: RoomRecipeId,
  topic: string,
  currentPlot?: Partial<PlotArcState>,
  currentScriptBoard?: Partial<DirectorScriptBoard>,
): Partial<Record<RoomRecipeId, ScopedDirectorScript>> {
  const normalized: Partial<Record<RoomRecipeId, ScopedDirectorScript>> = {};
  const source = scripts && typeof scripts === "object" ? scripts : {};
  for (const mode of directorScriptModes) {
    const script = source[mode];
    if (script) {
      normalized[mode] = normalizeScopedDirectorScript(script, roomId, mode, topic);
    }
  }
  if (!normalized[activeMode]) {
    normalized[activeMode] = createScopedDirectorScript(roomId, activeMode, topic, currentPlot, currentScriptBoard);
  }
  return normalized;
}

function activeDirectorScriptMode(room: RoomState): RoomRecipeId {
  return normalizeDirectorScriptMode(room.director?.recipeId);
}

function saveActiveDirectorScript(room: RoomState, updatedAt = new Date().toISOString()): RoomState {
  const mode = activeDirectorScriptMode(room);
  const scripts = normalizeDirectorScriptsByMode(
    room.directorScriptsByMode,
    room.id,
    mode,
    room.topic || "Daily chat",
    room.plot,
    room.director.scriptBoard,
  );
  scripts[mode] = createScopedDirectorScript(room.id, mode, room.topic || "Daily chat", room.plot, room.director.scriptBoard, updatedAt);
  return {
    ...room,
    directorScriptsByMode: scripts,
  };
}

function applyDirectorScriptMode(room: RoomState, mode: RoomRecipeId): RoomState {
  const saved = saveActiveDirectorScript(room);
  const scripts = normalizeDirectorScriptsByMode(
    saved.directorScriptsByMode,
    saved.id,
    mode,
    saved.topic || "Daily chat",
  );
  const nextScript = scripts[mode] ?? createScopedDirectorScript(saved.id, mode, saved.topic || "Daily chat");
  scripts[mode] = nextScript;
  return {
    ...saved,
    plot: nextScript.plotDirection,
    directorScriptsByMode: scripts,
    director: {
      ...saved.director,
      recipeId: mode,
      scriptBoard: nextScript.scriptBoard,
    },
  };
}

function createDefaultRoomConstraints(now = new Date().toISOString()): RoomConstraint[] {
  return [
    {
      id: "constraint-director-override",
      scope: "director",
      label: "Director changes",
      detail: "Room facts, scene conditions, item ownership, and hidden knowledge only change when the user explicitly @mentions the Director.",
      status: "active",
      visibility: "known_to_user",
      relatedRoleIds: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "constraint-visibility",
      scope: "knowledge",
      label: "Knowledge visibility",
      detail: "Roles can only use public information, their own private @ messages, their team channel, and facts made visible to them.",
      status: "active",
      visibility: "known_to_user",
      relatedRoleIds: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function createDefaultRoomDirector(roomId: string, recipeId: RoomRecipeId = "casual"): RoomDirectorState {
  const now = new Date().toISOString();
  return {
    enabled: true,
    directorId: "room-director",
    displayName: "Director",
    aliases: ["director", "gm", "system", "旁白", "主持人"],
    profileId: "host",
    recipeId,
    apiProfile: { ...defaultDirectorApiProfile },
    memoryScope: `room:${roomId}:system`,
    lastMove: null,
    lastSpokeAt: null,
    sceneBoard: { ...defaultSceneBoard },
    scriptBoard: createDefaultDirectorScriptBoard(recipeId, "Daily chat", now),
    constraints: createDefaultRoomConstraints(),
    overrideLog: [],
  };
}

function createDefaultRoomState(
  roomId: string,
  packs: CharacterPackSummary[],
  options: {
    title?: string;
    topic?: string;
    recipeId?: RoomRecipeId;
    isOpen?: boolean;
    messages?: ReturnType<typeof createInitialRoomMessages>;
    includeInitialRole?: boolean;
  } = {},
): RoomState {
  const recipe = roomRecipeConfig(options.recipeId ?? "casual");
  const includeInitialRole = options.includeInitialRole ?? true;
  const selectedPack = includeInitialRole ? packs[0] ?? null : null;
  const promptProfileId = recipe.promptProfileId;
  const simulationObjective = simulationObjectiveForRecipe(recipe.id);
  return {
    id: roomId,
    title: options.title ?? recipe.name,
    isOpen: options.isOpen ?? true,
    autoChat: recipe.autoChat,
    flowMode: recipe.autoChat ? "auto_simulation" : "player_reactive",
    freedomLevel: "balanced",
    simulationObjective,
    simulation: defaultRoomSimulationState(simulationObjective),
    plot: defaultRoomPlotArcState(options.topic ?? "Daily chat"),
    directorScriptsByMode: {
      [recipe.id]: createScopedDirectorScript(roomId, recipe.id, options.topic ?? "Daily chat"),
    },
    frame: defaultRoomFrameState(),
    match: defaultRoomMatchState(),
    topic: options.topic ?? "Daily chat",
    speed: "normal",
    collaborationMode: "free_talk",
    floorOwner: { type: "none" },
    turnPhase: "wait",
    lastTerminationReason: null,
    activeDiscussionPlan: null,
    collaborationPlan: null,
    apiProfile: { ...defaultRoomApiProfile },
    expandedApiRoleId: null,
    expandedIdentityCardRoleId: null,
    expandedInspectorSection: null,
    promptProfileId,
    autoSpeechPolicy: { ...defaultRoomAutoSpeechPolicy, speedDelaysMs: { ...defaultRoomAutoSpeechPolicy.speedDelaysMs } },
    autoSpeechState: { ...defaultRoomAutoSpeechState },
    advancePolicy: defaultRoomAdvancePolicy,
    contextBudget: defaultRoomContextBudget,
    autoPace: { ...defaultRoomAutoPaceSettings },
    speakerPolicy: { ...defaultRoomSpeakerPolicy },
    lastContinuationAssessment: null,
    lastAdvanceDecision: null,
    lastEngagementDecision: null,
    lastShouldSpeakDecision: null,
    lastInputProcessed: null,
    lastResponseObligation: null,
    lastNoResponseReason: null,
    lastFallbackAction: null,
    silentAutoTurnCount: 0,
    privateWhispers: recipe.privateWhispers,
    privateWhisperPolicy: { ...defaultRoomPrivateWhisperPolicy },
    hiddenWhisperCount: 0,
    factionHuddles: "off",
    factions: defaultRoomFactions.map((faction) => ({ ...faction })),
    activeChannelId: "public",
    channelReadState: {},
    hiddenFactionHuddleCount: 0,
    factionHuddleThreads: [],
    privateThreads: [],
    privateChatRequests: [],
    lastPrivateInfluence: null,
    userFactionHuddle: null,
    userProfile: { ...defaultRoomUserProfile, aliases: [...defaultRoomUserProfile.aliases] },
    director: {
      ...createDefaultRoomDirector(roomId, recipe.id),
      profileId: recipe.directorProfileId,
      recipeId: recipe.id,
      sceneBoard: {
        ...defaultSceneBoard,
        title: options.title ?? recipe.name,
        mood: recipe.defaultMood,
      },
      scriptBoard: createDefaultDirectorScriptBoard(recipe.id, options.topic ?? "Daily chat"),
    },
    highlightedTargets: [],
    lastSpeakerId: null,
    participants: includeInitialRole ? createInitialRoomParticipants(packs, roomId, promptProfileIdentityMode(promptProfileId)) : [],
    messages: options.messages ?? createInitialRoomMessages(selectedPack, roomId),
  };
}

const defaultVoiceModel: VoiceModelDownloadState = {
  modelId: "tiny",
  fileName: "ggml-tiny.bin",
  state: "not_installed",
  progress: 0,
  downloadedBytes: 0,
  totalBytes: 0,
  expectedSha256: "model-download-metadata-required",
  localPath: "",
  lastError: null,
};

const defaultLocalChatModel: LocalModelRuntimeState = {
  enabled: true,
  state: "verifying",
  selectedModelId: DEFAULT_LOCAL_CHAT_MODEL_ID,
  modelId: null,
  availableModels: defaultLocalModelOptions,
  installState: "verifying",
  runnerVersion: null,
  runtimeMode: null,
  serverPid: null,
  serverPort: null,
  serverHealth: null,
  manifest: null,
  lastError: null,
  lastVerifiedAt: null,
};

function mergeLocalModelOptions(installed: LocalModelManifest[] = []): LocalModelManifest[] {
  const byId = new Map<string, LocalModelManifest>();
  for (const option of defaultLocalModelOptions) {
    byId.set(option.id, option);
  }
  for (const option of installed) {
    byId.set(option.id, option);
  }
  return Array.from(byId.values());
}

function localModelInstallState(
  modelId: string | null,
  availableModels: LocalModelManifest[],
  runtimeState: LocalModelRuntimeState["state"],
): LocalModelRuntimeState["installState"] {
  if (runtimeState === "error" || runtimeState === "missing_runner") {
    return "error";
  }
  const modelKnown = Boolean(modelId && availableModels.some((model) => model.id === modelId));
  if (
    modelKnown &&
    (
      runtimeState === "ready" ||
      runtimeState === "warming" ||
      runtimeState === "running" ||
      runtimeState === "busy" ||
      runtimeState === "stopped" ||
      runtimeState === "starting_server" ||
      runtimeState === "loading_model"
    )
  ) {
    return "installed";
  }
  if (runtimeState === "verifying") {
    return modelKnown ? "installed" : "verifying";
  }
  return modelKnown ? "installed" : "missing";
}

function normalizeLocalModelState(
  base: LocalModelRuntimeState,
  incoming: Partial<LocalModelRuntimeState>,
): LocalModelRuntimeState {
  const availableModels = mergeLocalModelOptions(incoming.availableModels ?? base.availableModels);
  const requestedModelId =
    incoming.selectedModelId ??
    base.selectedModelId ??
    incoming.modelId ??
    DEFAULT_LOCAL_CHAT_MODEL_ID;
  const selectedModelId = availableModels.some((model) => model.id === requestedModelId)
    ? requestedModelId
    : DEFAULT_LOCAL_CHAT_MODEL_ID;
  const enabled = incoming.enabled ?? base.enabled ?? true;
  const state = enabled ? incoming.state ?? base.state : "not_found";
  const manifest =
    incoming.manifest ??
    availableModels.find((model) => model.id === selectedModelId) ??
    base.manifest ??
    null;

  const modelId = incoming.modelId ?? (manifest?.id === selectedModelId ? manifest.id : base.modelId);

  return {
    ...base,
    ...incoming,
    enabled,
    selectedModelId,
    state,
    modelId,
    availableModels,
    installState: incoming.installState ?? localModelInstallState(modelId ?? null, availableModels, state),
    manifest,
    lastError: enabled ? incoming.lastError ?? base.lastError : "Local chat model is off.",
  };
}

function createAiEndpointConfig(use: AiModelUse, preset: AiServicePreset): AiModelEndpointConfig {
  const model =
    use === "chat"
      ? preset.recommendedChatModel
      : use === "vision"
        ? preset.recommendedVisionModel
        : preset.recommendedTtsModel;
  const secretRef = use === "chat" ? AI_CHAT_SECRET_REF : use === "vision" ? AI_VISION_SECRET_REF : AI_TTS_SECRET_REF;
  const label = use === "chat" ? "Chat model" : use === "vision" ? "Image understanding model" : "TTS model";

  return {
    apiUrl: preset.baseUrl,
    secretRef,
    keyPreview: "",
    hasStoredSecret: false,
    model,
    temperature: 0.7,
    maxTokens: 900,
    status: "not_configured",
    runtimeStatus: "idle",
    lastTestMessage: `${label} has not been tested yet.`,
    lastTestedAt: null,
    lastRuntimeMessage: "",
    lastRuntimeAt: null,
    availableModels: [],
    capabilitySummary: `${label} can be tested after you enter API URL, API Key, and model name.`,
    lastErrorCode: null,
  };
}

function createTtsEndpointConfig(preset: AiServicePreset) {
  return {
    ...createAiEndpointConfig("tts", preset),
    voice: {
      voiceId: "",
      language: "ja-JP",
      source: "system_default" as const,
    },
  };
}

function endpointForUse(ai: ConsoleAppState["ai"], use: AiModelUse): AiModelEndpointConfig {
  return use === "chat" ? ai.chat : use === "vision" ? ai.vision : ai.tts;
}

function updateEndpointForUse(
  ai: ConsoleAppState["ai"],
  use: AiModelUse,
  endpoint: AiModelEndpointConfig,
): ConsoleAppState["ai"] {
  if (use === "chat") {
    return {
      ...ai,
      chat: endpoint,
      baseUrl: endpoint.apiUrl,
      chatModel: endpoint.model,
      apiKeyPreview: endpoint.keyPreview,
      temperature: endpoint.temperature,
      maxTokens: endpoint.maxTokens,
      connectionStatus: endpoint.status,
      lastTestMessage: endpoint.lastTestMessage,
      lastTestedAt: endpoint.lastTestedAt,
      availableModels: endpoint.availableModels,
      capabilitySummary: endpoint.capabilitySummary,
      lastErrorCode: endpoint.lastErrorCode,
    };
  }

  if (use === "vision") {
    return {
      ...ai,
      vision: endpoint,
      visionModel: endpoint.model,
      visionEnabled: endpoint.status === "ready" || Boolean(endpoint.model.trim()),
    };
  }

  return {
    ...ai,
    tts: {
      ...endpoint,
      voice: ai.tts.voice,
    },
    ttsModel: endpoint.model,
    cloudTtsEnabled: endpoint.status === "ready" || Boolean(endpoint.model.trim()),
  };
}

function resetAiEndpointAfterConfigChange<T extends AiModelEndpointConfig>(endpoint: T, message: string): T {
  return resetEndpointAfterConfigChange(endpoint, message);
}

function endpointWithKeyProjection<T extends AiModelEndpointConfig>(
  endpoint: T,
  apiKeyPreview: string,
  message: string,
): T {
  return applyApiKeyProjection({ endpoint, apiKeyPreview, message });
}

function updateEndpointAfterInput(
  state: ConsoleAppState,
  use: AiModelUse,
  patch: Partial<AiModelEndpointConfig>,
  message: string,
): ConsoleAppState {
  const currentEndpoint = endpointForUse(state.ai, use);
  const changed = Object.entries(patch).some(([key, value]) => {
    const currentValue = currentEndpoint[key as keyof AiModelEndpointConfig];
    if (typeof currentValue === "string" && typeof value === "string") {
      return currentValue.trim() !== value.trim();
    }
    return !Object.is(currentValue, value);
  });
  if (!changed) {
    return state;
  }

  const endpoint = resetAiEndpointAfterConfigChange(
    {
      ...currentEndpoint,
      ...patch,
    },
    message,
  );
  return {
    ...state,
    ai: updateEndpointForUse(state.ai, use, endpoint),
  };
}

function clearEndpointKey(state: ConsoleAppState, use: AiModelUse, message: string): ConsoleAppState {
  const currentEndpoint = endpointForUse(state.ai, use);
  const endpoint = endpointWithKeyProjection(currentEndpoint, "", message);
  return {
    ...state,
    ai: updateEndpointForUse(state.ai, use, endpoint),
  };
}

export function createInitialConsoleState(): ConsoleAppState {
  const packs = listPackSummaries();
  const selectedPack = packs[0] ?? null;
  const selectedPackId = selectedPack?.id ?? "";
  const room = createDefaultRoomState("room-template", packs, {
    title: defaultNewRoomTitle,
    topic: "Daily chat",
    isOpen: false,
    includeInitialRole: false,
    messages: [],
  });

  return {
    language: "en",
    config: {
      activeSection: "ai",
    },
    setup: {
      step: "start",
      completed: false,
    },
    ai: {
      chat: createAiEndpointConfig("chat", defaultAiPreset),
      vision: createAiEndpointConfig("vision", defaultAiPreset),
      tts: createTtsEndpointConfig(defaultAiPreset),
      localChatModel: defaultLocalChatModel,
      presetId: defaultAiPreset.id,
      apiKeyPreview: "",
      baseUrl: defaultAiPreset.baseUrl,
      chatModel: defaultAiPreset.recommendedChatModel,
      visionModel: defaultAiPreset.recommendedVisionModel,
      embeddingModel: defaultAiPreset.recommendedEmbeddingModel,
      ttsModel: defaultAiPreset.recommendedTtsModel,
      sttModel: defaultAiPreset.recommendedSttModel,
      visionEnabled: defaultAiPreset.supportsVision,
      embeddingEnabled: false,
      cloudTtsEnabled: false,
      cloudSttEnabled: false,
      streamingEnabled: defaultAiPreset.supportsStreaming,
      jsonModeEnabled: true,
      compatibilityMode: "openai_chat_completions",
      authMode: defaultAiPreset.authMode,
      customAuthHeader: "Authorization",
      organizationId: "",
      projectId: "",
      proxyUrl: "",
      chatPath: defaultAiPreset.chatPath,
      modelsPath: defaultAiPreset.modelsPath,
      embeddingsPath: defaultAiPreset.embeddingsPath,
      ttsPath: defaultAiPreset.ttsPath,
      sttPath: defaultAiPreset.sttPath,
      temperature: 0.7,
      maxTokens: 900,
      timeoutMs: 20_000,
      advancedOpen: false,
      connectionStatus: "not_configured",
      lastTestMessage: "Connection has not been tested yet. Local chat stays first while it is on.",
      lastTestedAt: null,
      availableModels: [],
      capabilitySummary: "Bundled local chat is used first while it is on. Turn it off to use cloud chat.",
      lastErrorCode: null,
    },
    privacy: {
      microphoneEnabled: false,
      foregroundAppAwarenessEnabled: true,
      memorySavingEnabled: true,
    },
    voice: {
      sttStatus: "off",
      ttsStatus: "off",
      sttBackend: "whisper_cpp",
      preferredTtsBackend: "cloud_tts",
      activeTtsBackend: "cloud_tts",
      permissionState: "off",
      model: defaultVoiceModel,
      availableVoices: [],
      selectedVoiceId: null,
      microphoneMode: "off",
      ttsEnabled: false,
      ttsLanguage: "ja-JP",
      subtitleLanguage: "zh-CN / bilingual",
      echoCancellationEnabled: true,
      roomTtsPolicy: "disabled",
      lastMessage: "Voice is off for now. Text input always works, and rooms stay silent.",
      lastTranscription: "",
      lastSynthesisMessage: "TTS is off until the user enables it.",
    },
    aiPresets: aiServicePresets,
    selectedPackId,
    packs,
    prompts: { ...defaultPromptCenterState },
    packImport: {
      sourcePath: "",
      status: "idle",
      message: "Paste a local character-pack folder path, then validate or import it.",
      importedPackId: null,
      warnings: [],
      errors: [],
      validationReport: null,
    },
    packWorkshop: createDefaultPackWorkshopState(packs),
    rooms: [],
    activeRoomId: "",
    room,
    release: null,
  };
}

export function reduceConsoleState(state: ConsoleAppState, action: ConsoleAction): ConsoleAppState {
  const normalized = ensureRoomCollection(state);

  if (action.type === "room.create") {
    return createRoomInState(normalized, action.title, action.recipeId);
  }

  if (action.type === "room.switch") {
    return switchRoomInState(normalized, action.roomId);
  }

  if (action.type === "room.rename") {
    return renameRoomInState(normalized, action.roomId ?? normalized.activeRoomId, action.title);
  }

  if (action.type === "room.duplicate") {
    return duplicateRoomInState(normalized, action.roomId ?? normalized.activeRoomId, action.title, action.copyDirectorScript ?? true);
  }

  if (action.type === "room.delete") {
    return deleteRoomInState(normalized, action.roomId ?? normalized.activeRoomId);
  }

  return syncActiveRoom(reduceConsoleStateInner(normalized, action));
}

function reduceConsoleStateInner(state: ConsoleAppState, action: ConsoleAction): ConsoleAppState {
  switch (action.type) {
    case "ui.setLanguage":
      return { ...state, language: action.language };
    case "config.setSection":
      return { ...state, config: { ...state.config, activeSection: action.section } };
    case "setup.next":
      return { ...state, setup: { ...state.setup, step: nextSetupStep(state.setup.step) } };
    case "setup.previous":
      return { ...state, setup: { ...state.setup, step: previousSetupStep(state.setup.step) } };
    case "setup.complete":
      return { ...state, setup: { ...state.setup, completed: true } };
    case "ai.setPreset":
      const preset = state.aiPresets.find((candidate) => candidate.id === action.presetId) ?? defaultAiPreset;
      return {
        ...state,
        ai: {
          ...state.ai,
          chat: resetAiEndpointAfterConfigChange(
            {
              ...state.ai.chat,
              apiUrl: preset.baseUrl,
              model: preset.recommendedChatModel,
            },
            `${preset.name} chat settings loaded. Test this model when ready.`,
          ),
          vision: resetAiEndpointAfterConfigChange(
            {
              ...state.ai.vision,
              apiUrl: preset.baseUrl,
              model: preset.recommendedVisionModel,
            },
            `${preset.name} image settings loaded. Test this model when ready.`,
          ),
          tts: {
            ...resetAiEndpointAfterConfigChange(
              {
                ...state.ai.tts,
                apiUrl: preset.baseUrl,
                model: preset.recommendedTtsModel,
              },
              `${preset.name} TTS settings loaded. Test voice when ready.`,
            ),
            voice: state.ai.tts.voice,
          },
          presetId: preset.id,
          baseUrl: preset.baseUrl,
          chatModel: preset.recommendedChatModel,
          visionModel: preset.recommendedVisionModel,
          embeddingModel: preset.recommendedEmbeddingModel,
          ttsModel: preset.recommendedTtsModel,
          sttModel: preset.recommendedSttModel,
          visionEnabled: preset.supportsVision,
          streamingEnabled: preset.supportsStreaming,
          authMode: preset.authMode,
          chatPath: preset.chatPath,
          modelsPath: preset.modelsPath,
          embeddingsPath: preset.embeddingsPath,
          ttsPath: preset.ttsPath,
          sttPath: preset.sttPath,
          connectionStatus: "not_configured",
          lastTestMessage: `${preset.name} recommended models loaded. Test connection again.`,
          lastTestedAt: null,
          availableModels: [],
          capabilitySummary: preset.supportsVision
            ? "Preset supports chat and image AI. Waiting for connection test."
            : "Preset supports chat. Image capability depends on the service test.",
          lastErrorCode: null,
        },
      };
    case "ai.setEndpointUrl": {
      const normalized = normalizeAiServiceUrlInput(action.apiUrl);
      const nextState = updateEndpointAfterInput(
        state,
        action.use,
        { apiUrl: normalized.baseUrl },
        "API URL updated. Test this model again.",
      );
      return {
        ...nextState,
        ai:
          action.use === "chat"
            ? {
                ...nextState.ai,
                ...normalized,
              }
            : nextState.ai,
      };
    }
    case "ai.setEndpointKeyPreview":
      if (!action.apiKeyPreview.trim()) {
        return clearEndpointKey(state, action.use, "API key cleared. Paste a new key and test this model when ready.");
      }
      return {
        ...state,
        ai: updateEndpointForUse(
          state.ai,
          action.use,
          endpointWithKeyProjection(endpointForUse(state.ai, action.use), action.apiKeyPreview, "Key saved for this model. Test when ready."),
        ),
      };
    case "ai.setEndpointModel":
      return updateEndpointAfterInput(
        state,
        action.use,
        { model: action.model },
        "Model name updated. Test this model again.",
      );
    case "ai.setEndpointGeneration": {
      const endpoint = endpointForUse(state.ai, action.use);
      const value = normalizeAiNumberField(action.field, action.value);
      return {
        ...state,
        ai: updateEndpointForUse(
          state.ai,
          action.use,
          {
            ...endpoint,
            [action.field]: value,
            lastTestMessage: `${action.field} updated. New cloud chat replies will use it from the next turn.`,
          },
        ),
      };
    }
    case "ai.testEndpoint": {
      const endpoint = endpointForUse(state.ai, action.use);
      return {
        ...state,
        ai: updateEndpointForUse(
          state.ai,
          action.use,
          {
            ...endpoint,
            status: "testing",
            lastTestMessage: "Testing this model with a minimal request.",
            capabilitySummary: "Testing connection with the model name you entered.",
            lastErrorCode: null,
          },
        ),
      };
    }
    case "ai.setEndpointTestResult": {
      const endpoint = endpointForUse(state.ai, action.use);
      return {
        ...state,
        ai: updateEndpointForUse(
          state.ai,
          action.use,
          {
            ...endpoint,
            status: action.status,
            lastTestMessage: action.message,
            lastTestedAt: action.testedAt === undefined ? endpoint.lastTestedAt : action.testedAt,
            availableModels: action.availableModels === undefined ? endpoint.availableModels : action.availableModels,
            capabilitySummary: action.capabilitySummary ?? endpoint.capabilitySummary,
            lastErrorCode: action.errorCode === undefined ? endpoint.lastErrorCode : action.errorCode,
          },
        ),
      };
    }
    case "ai.setEndpointRuntimeStatus": {
      const endpoint = endpointForUse(state.ai, action.use);
      return {
        ...state,
        ai: updateEndpointForUse(
          state.ai,
          action.use,
          applyEndpointRuntimeStatus(
            endpoint,
            action.runtimeStatus,
            action.message,
            action.at === undefined ? new Date().toISOString() : action.at,
            action.errorCode ?? endpoint.lastErrorCode,
          ),
        ),
      };
    }
    case "localModel.refresh":
      if (action.state.enabled !== state.ai.localChatModel.enabled) {
        return state;
      }
      return {
        ...state,
        ai: {
          ...state.ai,
          localChatModel: normalizeLocalModelState(state.ai.localChatModel, action.state),
        },
      };
    case "localModel.setState":
      if (!state.ai.localChatModel.enabled) {
        return state;
      }
      return {
        ...state,
        ai: {
          ...state.ai,
          localChatModel: normalizeLocalModelState(state.ai.localChatModel, {
            state: action.state,
            lastError: action.message === undefined ? state.ai.localChatModel.lastError : action.message,
          }),
        },
      };
    case "localModel.setEnabled":
      return {
        ...state,
        ai: {
          ...state.ai,
          localChatModel: normalizeLocalModelState(state.ai.localChatModel, {
            enabled: action.enabled,
            state: action.enabled ? "verifying" : "disabled",
            installState: action.enabled ? "verifying" : "missing",
            lastError: action.enabled ? null : "Local chat model is off.",
          }),
        },
      };
    case "localModel.select":
      return {
        ...state,
        ai: {
          ...state.ai,
          localChatModel: normalizeLocalModelState(state.ai.localChatModel, {
            enabled: true,
            selectedModelId: action.modelId,
            state: "verifying",
            installState: "verifying",
            lastError: null,
          }),
        },
      };
    case "localModel.freeMemory":
      return {
        ...state,
        ai: {
          ...state.ai,
          localChatModel: normalizeLocalModelState(state.ai.localChatModel, {
            state: state.ai.localChatModel.enabled ? "stopped" : "disabled",
            lastError: state.ai.localChatModel.enabled
              ? "Local model stopped. Memory has been released."
              : "Local chat model is off.",
          }),
        },
      };
    case "ai.setTtsVoice":
      return {
        ...state,
        ai: {
          ...state.ai,
          tts: {
            ...state.ai.tts,
            voice: {
              ...state.ai.tts.voice,
              voiceId: action.voiceId,
              source: action.source ?? (action.voiceId ? "manual" : "system_default"),
            },
          },
        },
        voice: {
          ...state.voice,
          selectedVoiceId: action.voiceId || null,
          lastSynthesisMessage: action.voiceId ? `Selected TTS voice: ${action.voiceId}` : "Using default TTS voice.",
        },
      };
    case "ai.setTtsLanguage":
      return {
        ...state,
        ai: {
          ...state.ai,
          tts: {
            ...state.ai.tts,
            voice: {
              ...state.ai.tts.voice,
              language: action.language,
            },
          },
        },
        voice: {
          ...state.voice,
          ttsLanguage: action.language,
          lastSynthesisMessage: `TTS language changed to ${action.language || "system default"}.`,
        },
      };
    case "ai.setKeyPreview":
      if (!action.apiKeyPreview.trim()) {
        return {
          ...state,
          ai: {
            ...state.ai,
            chat: endpointWithKeyProjection(state.ai.chat, "", "Chat model key cleared. Paste a new key and test when ready."),
            vision: endpointWithKeyProjection(state.ai.vision, "", "Image understanding key cleared. Paste a new key and test when ready."),
            tts: {
              ...endpointWithKeyProjection(state.ai.tts, "", "TTS key cleared. Paste a new key and test when ready."),
              voice: state.ai.tts.voice,
            },
            apiKeyPreview: "",
            connectionStatus: "not_configured",
            lastTestMessage: "API key cleared. Cloud chat will stay unavailable until you paste a new key and test it.",
            lastTestedAt: null,
            availableModels: [],
            capabilitySummary: "No cloud API key is saved.",
            lastErrorCode: null,
          },
        };
      }
      return {
        ...state,
        ai: {
          ...state.ai,
          chat: endpointWithKeyProjection(state.ai.chat, action.apiKeyPreview, "Key saved for chat model. Test when ready."),
          vision: endpointWithKeyProjection(state.ai.vision, action.apiKeyPreview, "Key saved for image understanding. Test when ready."),
          tts: {
            ...endpointWithKeyProjection(state.ai.tts, action.apiKeyPreview, "Key saved for TTS. Test when ready."),
            voice: state.ai.tts.voice,
          },
          apiKeyPreview: maskKey(action.apiKeyPreview),
          connectionStatus: "not_configured",
          lastTestMessage: action.apiKeyPreview.trim()
            ? "Key is kept in the current secure session. It is not written to state, logs, or exports."
            : "Key cleared. Local chat stays in control while it is on.",
          lastTestedAt: null,
          availableModels: [],
          capabilitySummary: action.apiKeyPreview.trim()
            ? "Key updated. Test the service again to confirm capabilities."
            : "Local chat stays in control while it is on. Turn it off when you want cloud replies.",
          lastErrorCode: null,
        },
      };
    case "ai.toggleAdvanced":
      return { ...state, ai: { ...state.ai, advancedOpen: !state.ai.advancedOpen } };
    case "ai.setBaseUrl":
      const normalizedAiUrl = normalizeAiServiceUrlInput(action.baseUrl);
      return {
        ...state,
        ai: {
          ...state.ai,
          chat: resetAiEndpointAfterConfigChange(
            { ...state.ai.chat, apiUrl: normalizedAiUrl.baseUrl },
            "Chat API URL updated. Test this model again.",
          ),
          vision: resetAiEndpointAfterConfigChange(
            { ...state.ai.vision, apiUrl: normalizedAiUrl.baseUrl },
            "Image API URL updated. Test this model again.",
          ),
          tts: {
            ...resetAiEndpointAfterConfigChange(
              { ...state.ai.tts, apiUrl: normalizedAiUrl.baseUrl },
              "TTS API URL updated. Test this model again.",
            ),
            voice: state.ai.tts.voice,
          },
          ...normalizedAiUrl,
          connectionStatus: "not_configured",
          lastTestMessage: "API URL updated. Test connection again.",
          lastTestedAt: null,
          availableModels: [],
          capabilitySummary: "API URL updated. CastRoom AI will auto-detect the standard paths during the next test.",
          lastErrorCode: null,
        },
      };
    case "ai.setChatModel":
      return {
        ...state,
        ai: {
          ...state.ai,
          chat: resetAiEndpointAfterConfigChange(
            { ...state.ai.chat, model: action.chatModel },
            "Chat model changed. Test this model again.",
          ),
          chatModel: action.chatModel,
          connectionStatus: "not_configured",
          lastTestMessage: "Chat model changed. Test connection again.",
          lastTestedAt: null,
          capabilitySummary: "Chat model updated. Waiting for a new test.",
          lastErrorCode: null,
        },
      };
    case "ai.setVisionModel":
      return {
        ...state,
        ai: {
          ...state.ai,
          vision: resetAiEndpointAfterConfigChange(
            { ...state.ai.vision, model: action.visionModel },
            "Image understanding model changed. Test this model again.",
          ),
          visionModel: action.visionModel,
          connectionStatus: "not_configured",
          lastTestMessage: "Vision model changed. Test connection again.",
          lastTestedAt: null,
          capabilitySummary: "Image model updated. Waiting for a new test.",
          lastErrorCode: null,
        },
      };
    case "ai.setEmbeddingModel":
      return resetAiAfterConfigChange(state, { embeddingModel: action.embeddingModel }, "Embedding model updated. Memory retrieval will use it next time.");
    case "ai.setTtsModel":
      return resetAiAfterConfigChange(
        {
          ...state,
          ai: {
            ...state.ai,
            tts: {
              ...resetAiEndpointAfterConfigChange(
                { ...state.ai.tts, model: action.ttsModel },
                "TTS model changed. Test this model again.",
              ),
              voice: state.ai.tts.voice,
            },
          },
        },
        { ttsModel: action.ttsModel },
        "Cloud TTS model updated.",
      );
    case "ai.setSttModel":
      return resetAiAfterConfigChange(state, { sttModel: action.sttModel }, "Cloud STT model updated.");
    case "ai.setFeatureEnabled":
      return resetAiAfterConfigChange(
        state,
        { [action.feature]: action.enabled },
        `${action.feature} ${action.enabled ? "enabled" : "disabled"}.`,
      );
    case "ai.setCompatibilityMode":
      return resetAiAfterConfigChange(
        state,
        {
          compatibilityMode: action.compatibilityMode,
          jsonModeEnabled: action.compatibilityMode !== "openai_no_json_mode",
        },
        "Compatibility mode updated.",
      );
    case "ai.setAuthMode":
      return resetAiAfterConfigChange(state, { authMode: action.authMode }, "Auth mode updated.");
    case "ai.setCustomAuthHeader":
      return resetAiAfterConfigChange(state, { customAuthHeader: action.customAuthHeader }, "Custom auth header updated.");
    case "ai.setOrganizationId":
      return resetAiAfterConfigChange(state, { organizationId: action.organizationId }, "Organization updated.");
    case "ai.setProjectId":
      return resetAiAfterConfigChange(state, { projectId: action.projectId }, "Project updated.");
    case "ai.setProxyUrl":
      return resetAiAfterConfigChange(state, { proxyUrl: action.proxyUrl }, "Proxy URL updated.");
    case "ai.setEndpointPath":
      return resetAiAfterConfigChange(state, { [action.field]: normalizeEndpointPath(action.value) }, "Endpoint path updated.");
    case "ai.setNumberField":
      const nextAiNumberValue = normalizeAiNumberField(action.field, action.value);
      return resetAiAfterConfigChange(
        {
          ...state,
          ai: {
            ...state.ai,
            chat:
              action.field === "timeoutMs"
                ? state.ai.chat
                : {
                    ...state.ai.chat,
                    [action.field]: nextAiNumberValue,
                  },
          },
        },
        { [action.field]: nextAiNumberValue },
        `${action.field} updated.`,
      );
    case "ai.test":
      const chatEndpoint = endpointForUse(state.ai, "chat");
      return {
        ...state,
        ai: {
          ...state.ai,
          chat: {
            ...chatEndpoint,
            status: "testing",
            lastTestMessage: "Testing the chat model with a minimal request.",
            capabilitySummary: "Testing chat connection with the model name you entered.",
            lastErrorCode: null,
          },
          connectionStatus: "testing",
          lastTestMessage: "Sending a minimal test request to the Chat Completions compatible endpoint.",
          capabilitySummary: "Testing chat endpoint with the model name you entered.",
          lastErrorCode: null,
        },
      };
    case "ai.setConnectionResult":
      const currentChatEndpoint = endpointForUse(state.ai, "chat");
      return {
        ...state,
        ai: {
          ...state.ai,
          chat: {
            ...currentChatEndpoint,
            status: action.status,
            lastTestMessage: action.message,
            lastTestedAt: action.testedAt === undefined ? currentChatEndpoint.lastTestedAt : action.testedAt,
            availableModels: action.availableModels === undefined ? currentChatEndpoint.availableModels : action.availableModels,
            capabilitySummary: action.capabilitySummary ?? currentChatEndpoint.capabilitySummary,
            lastErrorCode: action.errorCode === undefined ? currentChatEndpoint.lastErrorCode : action.errorCode,
          },
          connectionStatus: action.status,
          lastTestMessage: action.message,
          lastTestedAt: action.testedAt === undefined ? state.ai.lastTestedAt : action.testedAt,
          availableModels: action.availableModels === undefined ? state.ai.availableModels : action.availableModels,
          capabilitySummary: action.capabilitySummary ?? state.ai.capabilitySummary,
          lastErrorCode: action.errorCode === undefined ? state.ai.lastErrorCode : action.errorCode,
        },
      };
    case "voice.refresh":
      return { ...state, voice: action.state };
    case "voice.setPermission":
      return {
        ...state,
        voice: {
          ...state.voice,
          permissionState: action.permissionState,
          sttStatus: action.permissionState === "granted" ? state.voice.sttStatus : "off",
          microphoneMode: action.permissionState === "granted" ? state.voice.microphoneMode : "off",
          lastMessage: action.message,
        },
      };
    case "voice.setMicrophoneMode":
      return {
        ...state,
        voice: {
          ...state.voice,
          microphoneMode: action.microphoneMode,
          permissionState: action.microphoneMode === "off" ? "off" : "granted",
          sttStatus:
            action.microphoneMode === "off"
              ? "off"
              : state.voice.model.state === "ready"
                ? "ready"
                : "stub",
          lastMessage:
            action.microphoneMode === "off"
              ? "Microphone is off; text input remains available."
              : "Microphone input is enabled. Speech recognition starts when its model is ready.",
        },
      };
    case "voice.setTtsEnabled":
      return {
        ...state,
        voice: {
          ...state.voice,
          ttsEnabled: action.enabled,
          ttsStatus: action.enabled ? "ready" : "off",
          lastSynthesisMessage: action.enabled
            ? "Voice output is enabled. CastRoom AI uses cloud TTS by default, or a local TTS service you connect yourself."
            : "TTS disabled.",
        },
      };
    case "voice.setTtsBackend":
      return {
        ...state,
        voice: {
          ...state.voice,
          preferredTtsBackend: action.backend,
          activeTtsBackend: resolveActiveTtsBackend(action.backend, state.ai.tts.status === "ready"),
          lastSynthesisMessage: `Preferred TTS backend changed to ${action.backend}.`,
        },
      };
    case "voice.setSelectedVoice":
      return {
        ...state,
        ai: {
          ...state.ai,
          tts: {
            ...state.ai.tts,
            voice: {
              ...state.ai.tts.voice,
              voiceId: action.voiceId ?? "",
              source: action.voiceId ? "manual" : "system_default",
            },
          },
        },
        voice: {
          ...state.voice,
          selectedVoiceId: action.voiceId,
          lastSynthesisMessage: action.voiceId ? `Selected TTS voice: ${action.voiceId}` : "Using default TTS voice.",
        },
      };
    case "voice.modelDownloadStart":
      return {
        ...state,
        voice: {
          ...state.voice,
          model: {
            ...state.voice.model,
            modelId: action.modelId,
            fileName: `ggml-${action.modelId}.bin`,
            state: "downloading",
            progress: 0,
            downloadedBytes: 0,
            totalBytes: 0,
            lastError: null,
          },
          sttStatus: "stub",
          lastMessage: `Downloading the ${action.modelId} speech recognition model.`,
        },
      };
    case "voice.modelDownloadProgress":
      return {
        ...state,
        voice: {
          ...state.voice,
          model: action.model,
          lastMessage: action.message,
        },
      };
    case "voice.modelDownloadResult":
      return {
        ...state,
        voice: {
          ...state.voice,
          model: action.model,
          sttStatus: action.sttStatus,
          lastMessage: action.message,
        },
      };
    case "voice.transcriptionResult":
      return {
        ...state,
        voice: {
          ...state.voice,
          sttStatus: action.result.ok ? "ready" : "error",
          lastTranscription: action.result.text,
          lastMessage: action.result.message,
        },
      };
    case "voice.synthesisResult":
      return {
        ...state,
        voice: {
          ...state.voice,
          ttsStatus: action.result.ok ? "ready" : "error",
          activeTtsBackend: action.result.backend,
          selectedVoiceId: action.result.voiceId ?? state.voice.selectedVoiceId,
          lastSynthesisMessage: action.result.message,
        },
      };
    case "privacy.toggle": {
      if (action.key === "memorySavingEnabled") {
        return {
          ...state,
          privacy: {
            ...state.privacy,
            memorySavingEnabled: true,
          },
        };
      }
      const nextPrivacy = { ...state.privacy, [action.key]: !state.privacy[action.key] };
      if (action.key !== "microphoneEnabled") {
        return { ...state, privacy: nextPrivacy };
      }

      const microphoneEnabled = nextPrivacy.microphoneEnabled;
      return {
        ...state,
        privacy: nextPrivacy,
        voice: {
          ...state.voice,
          sttStatus: microphoneEnabled ? (state.voice.model.state === "ready" ? "ready" : "stub") : "off",
          microphoneMode: microphoneEnabled ? "push_to_talk" : "off",
          permissionState: microphoneEnabled ? "granted" : "off",
          lastMessage: microphoneEnabled
            ? "Microphone is enabled. STT uses push-to-talk by default and falls back to text input on failure."
            : "Microphone is off; text input remains available.",
        },
      };
    }
    case "prompt.open":
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view: promptViewFromTarget(state, action.scope, action.targetId),
          activeEditorScope: action.scope,
          activeEditorTargetId: action.targetId,
          lastError: null,
        },
      };
    case "prompt.openRoomSet": {
      const view = normalizePromptCenterView(state, {
        ...state.prompts.view,
        mode: "rooms",
        selectedRoomId: action.roomId,
        selectedType: action.promptType ?? state.prompts.view.selectedType,
        selectedRoleId: action.roleId ?? state.prompts.view.selectedRoleId,
      });
      const target = promptTargetFromView(state, view);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view,
          activeEditorScope: target.scope,
          activeEditorTargetId: target.targetId,
          lastError: null,
        },
      };
    }
    case "prompt.openCharacterBase": {
      const view = normalizePromptCenterView(state, {
        ...state.prompts.view,
        mode: "characters",
        selectedPackId: action.packId,
      });
      const target = promptTargetFromView(state, view);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view,
          activeEditorScope: target.scope,
          activeEditorTargetId: target.targetId,
          lastError: null,
        },
      };
    }
    case "prompt.setMode": {
      const view = normalizePromptCenterView(state, {
        ...state.prompts.view,
        mode: action.mode,
      });
      const target = promptTargetFromView(state, view);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view,
          activeEditorScope: target.scope,
          activeEditorTargetId: target.targetId,
          lastError: null,
        },
      };
    }
    case "prompt.selectRoom": {
      const view = normalizePromptCenterView(state, {
        ...state.prompts.view,
        mode: "rooms",
        selectedRoomId: action.roomId,
      });
      const target = promptTargetFromView(state, view);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view,
          activeEditorScope: target.scope,
          activeEditorTargetId: target.targetId,
          lastError: null,
        },
      };
    }
    case "prompt.selectPromptType": {
      const view = normalizePromptCenterView(state, {
        ...state.prompts.view,
        mode: "rooms",
        selectedType: action.promptType,
      });
      const target = promptTargetFromView(state, view);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view,
          activeEditorScope: target.scope,
          activeEditorTargetId: target.targetId,
          lastError: null,
        },
      };
    }
    case "prompt.selectPromptMode": {
      const view = normalizePromptCenterView(state, {
        ...state.prompts.view,
        mode: "rooms",
        selectedPromptMode: action.mode,
      });
      const target = promptTargetFromView(state, view);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view,
          activeEditorScope: target.scope,
          activeEditorTargetId: target.targetId,
          lastError: null,
        },
      };
    }
    case "prompt.selectRoomRole": {
      const view = normalizePromptCenterView(state, {
        ...state.prompts.view,
        mode: "rooms",
        selectedType: "roles",
        selectedRoleId: action.roleId,
      });
      const target = promptTargetFromView(state, view);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view,
          activeEditorScope: target.scope,
          activeEditorTargetId: target.targetId,
          lastError: null,
        },
      };
    }
    case "prompt.selectCharacterPack": {
      const view = normalizePromptCenterView(state, {
        ...state.prompts.view,
        mode: "characters",
        selectedPackId: action.packId,
      });
      const target = promptTargetFromView(state, view);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view,
          activeEditorScope: target.scope,
          activeEditorTargetId: target.targetId,
          lastError: null,
        },
      };
    }
    case "prompt.setRoomSearch":
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view: {
            ...state.prompts.view,
            roomSearchQuery: action.query,
          },
        },
      };
    case "prompt.setCharacterSearch":
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view: {
            ...state.prompts.view,
            characterSearchQuery: action.query,
          },
        },
      };
    case "prompt.togglePreview":
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view: {
            ...state.prompts.view,
            previewOpen: action.open,
          },
        },
      };
    case "prompt.setDraft":
      return {
        ...state,
        prompts: {
          ...state.prompts,
          drafts: upsertPromptDraft(state.prompts.drafts, {
            scope: action.scope,
            targetId: action.targetId,
            text: action.text,
            dirty: true,
            sourceRevision: action.sourceRevision ?? state.prompts.revision,
          }),
          activeEditorScope: action.scope,
          activeEditorTargetId: action.targetId,
          lastError: null,
        },
      };
    case "prompt.save":
      return updatePromptOverride(state, action.scope, action.targetId, action.title, action.text, "save");
    case "prompt.apply":
      return updatePromptOverride(state, action.scope, action.targetId, action.title, action.text, "apply");
    case "prompt.saveAndApply":
      return updatePromptOverride(state, action.scope, action.targetId, action.title, action.text, "saveAndApply");
    case "prompt.restoreDefault": {
      const nextRevision = state.prompts.revision + 1;
      return {
        ...state,
        prompts: {
          ...state.prompts,
          revision: nextRevision,
          activeEditorScope: action.scope,
          activeEditorTargetId: action.targetId,
          overrides: state.prompts.overrides.map((override) =>
            override.scope === action.scope && override.targetId === action.targetId
              ? {
                  ...override,
                  enabled: false,
                  activeText: undefined,
                  appliedRevision: nextRevision,
                  updatedAt: new Date().toISOString(),
                }
              : override,
          ),
          drafts: upsertPromptDraft(state.prompts.drafts, {
            scope: action.scope,
            targetId: action.targetId,
            text: action.defaultText,
            dirty: false,
            sourceRevision: nextRevision,
          }),
          lastMessage: `${action.title} restored to default.`,
          lastError: null,
        },
      };
    }
    case "prompt.restoreTemplate": {
      const nextRevision = state.prompts.revision + 1;
      return {
        ...state,
        prompts: {
          ...state.prompts,
          revision: nextRevision,
          activeEditorScope: action.scope,
          activeEditorTargetId: action.targetId,
          overrides: state.prompts.overrides.map((override) =>
            override.scope === action.scope && override.targetId === action.targetId
              ? {
                  ...override,
                  enabled: false,
                  activeText: undefined,
                  appliedRevision: nextRevision,
                  updatedAt: new Date().toISOString(),
                }
              : override,
          ),
          drafts: upsertPromptDraft(state.prompts.drafts, {
            scope: action.scope,
            targetId: action.targetId,
            text: action.defaultText,
            dirty: false,
            sourceRevision: nextRevision,
          }),
          lastMessage: `${action.title} restored to template.`,
          lastError: null,
        },
      };
    }
    case "prompt.loadOverride": {
      const override = state.prompts.overrides.find((item) => item.scope === action.scope && item.targetId === action.targetId);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          activeEditorScope: action.scope,
          activeEditorTargetId: action.targetId,
          drafts: upsertPromptDraft(state.prompts.drafts, {
            scope: action.scope,
            targetId: action.targetId,
            text: override?.text ?? action.defaultText,
            dirty: false,
            sourceRevision: override?.revision ?? 0,
          }),
          lastMessage: override ? `${override.title} loaded into the editor.` : "Default prompt loaded into the editor.",
          lastError: null,
        },
      };
    }
    case "promptPreset.load":
      return {
        ...state,
        prompts: {
          ...state.prompts,
          presets: normalizePromptPresets(action.presets),
          lastMessage: action.message ?? "Prompt presets loaded.",
          lastError: null,
        },
      };
    case "promptPreset.select":
      return {
        ...state,
        prompts: {
          ...state.prompts,
          view: normalizePromptCenterView(state, {
            ...state.prompts.view,
            selectedPresetId: action.presetId,
          }),
          lastError: null,
        },
      };
    case "promptPreset.create": {
      const error = validatePromptText(action.text);
      if (error) {
        return withPromptPresetError(state, error);
      }
      const preset = createPromptPreset({
        kind: action.kind,
        title: action.title,
        description: action.description,
        language: action.language,
        supportedModes: action.supportedModes,
        text: action.text,
        tags: action.tags,
        source: action.source,
        sourceId: action.sourceId,
      });
      return {
        ...state,
        prompts: {
          ...state.prompts,
          presets: upsertPromptPreset(state.prompts.presets, preset),
          view: action.selectAfterCreate
            ? normalizePromptCenterView(state, {
                ...state.prompts.view,
                selectedPresetId: preset.id,
              })
            : state.prompts.view,
          revision: state.prompts.revision + 1,
          lastMessage: `${preset.title} saved to the prompt preset library.`,
          lastError: null,
        },
      };
    }
    case "promptPreset.update": {
      const existing = state.prompts.presets.find((preset) => preset.id === action.presetId);
      if (!existing) {
        return withPromptPresetError(state, "Prompt preset was not found.");
      }
      if (action.patch.text !== undefined) {
        const error = validatePromptText(action.patch.text);
        if (error) {
          return withPromptPresetError(state, error);
        }
      }
      const nextRevision = existing.revision + 1;
      const next: PromptPreset = {
        ...existing,
        ...action.patch,
        text: action.patch.text !== undefined ? cleanPromptPresetText(action.patch.text) : existing.text,
        tags: Array.isArray(action.patch.tags) ? action.patch.tags : existing.tags,
        revision: nextRevision,
        updatedAt: new Date().toISOString(),
      };
      return {
        ...state,
        prompts: {
          ...state.prompts,
          presets: upsertPromptPreset(state.prompts.presets, next),
          revision: state.prompts.revision + 1,
          lastMessage: `${next.title} updated in the prompt preset library.`,
          lastError: null,
        },
      };
    }
    case "promptPreset.delete": {
      const existing = state.prompts.presets.find((preset) => preset.id === action.presetId);
      return {
        ...state,
        prompts: {
          ...state.prompts,
          presets: state.prompts.presets.filter((preset) => preset.id !== action.presetId),
          revision: state.prompts.revision + (existing ? 1 : 0),
          lastMessage: existing ? `${existing.title} deleted from the prompt preset library.` : "Prompt preset was not found.",
          lastError: existing ? null : state.prompts.lastError,
        },
      };
    }
    case "promptPreset.applyToCurrentTarget":
      return applyPromptPresetToCurrentTarget(state, action.presetId);
    case "promptPreset.importPack": {
      const imported = normalizePromptPresets(action.presets).map((preset) => ({
        ...preset,
        source: (preset.source === "workshop" ? "workshop" : "imported") as PromptPreset["source"],
        sourceId: action.sourceId ?? preset.sourceId,
      }));
      return {
        ...state,
        prompts: {
          ...state.prompts,
          presets: importPromptPresets(state.prompts.presets, imported),
          revision: state.prompts.revision + (imported.length > 0 ? 1 : 0),
          lastMessage: action.message ?? `${imported.length} prompt presets imported.`,
          lastError: null,
        },
      };
    }
    case "pack.select":
      if (!state.packs.some((pack) => pack.id === action.packId)) {
        return state;
      }
      return { ...state, selectedPackId: action.packId };
    case "pack.setImportPath":
      return {
        ...state,
        packImport: {
          ...state.packImport,
          sourcePath: action.sourcePath,
          status: "idle",
          message: "Path updated. Validate or import when ready.",
          warnings: [],
          errors: [],
          validationReport: null,
        },
      };
    case "pack.validateStart":
      return {
        ...state,
        packImport: {
          ...state.packImport,
          status: "validating",
          message: "Checking the character pack info, character instructions, voice, subtitles, memory, and images.",
          warnings: [],
          errors: [],
        },
      };
    case "pack.validateResult":
      return {
        ...state,
        packImport: {
          ...state.packImport,
          status: action.report.status,
          message: action.message,
          warnings: action.report.warnings,
          errors: action.report.errors,
          validationReport: action.report,
        },
      };
    case "pack.importStart":
      return {
        ...state,
        packImport: {
          ...state.packImport,
          status: "validating",
          message: "Validating and importing character pack.",
          warnings: [],
          errors: [],
        },
      };
    case "pack.importResult": {
      const importedPackId = action.pack?.manifest.id ?? null;
      const existingPacks = state.packs.filter((pack) => pack.id !== importedPackId);
      const nextPacks = action.pack ? [...existingPacks, action.pack.summary] : state.packs;
      return {
        ...state,
        packs: nextPacks,
        selectedPackId: action.pack && action.errors.length === 0 ? action.pack.manifest.id : state.selectedPackId,
        packImport: {
          ...state.packImport,
          status: action.errors.length > 0 ? "error" : action.warnings.length > 0 ? "warning" : "ready",
          message: action.message,
          importedPackId,
          warnings: action.warnings,
          errors: action.errors,
          validationReport: action.pack
            ? {
                sourcePath: state.packImport.sourcePath,
                manifestId: action.pack.manifest.id,
                manifestName: action.pack.manifest.name,
                checkedAt: new Date().toISOString(),
                status: action.errors.length > 0 ? "error" : action.warnings.length > 0 ? "warning" : "ready",
                errors: action.errors,
                warnings: action.warnings,
                issues: [
                  ...action.errors.map((message) => ({ severity: "error" as const, path: ".", message })),
                  ...action.warnings.map((message) => ({ severity: "warning" as const, path: ".", message })),
                ],
                assets: action.pack.assets.flatMap((group) =>
                  group.candidates.map((candidate) => ({
                    folder: group.folder,
                    fileName: candidate.src?.split(/[\\/]/).pop() ?? `text.${candidate.format}`,
                    format: candidate.format,
                    animated: candidate.animated,
                    sizeBytes: 0,
                  })),
                ),
                preview: {
                  idleCount: action.pack.assets.find((group) => group.folder === "idle")?.candidates.length ?? 0,
                  emotionFolders: Object.values(action.pack.manifest.emotions).filter((folder) => folder !== "idle"),
                  promptPath: action.pack.manifest.promptPath,
                  voicePath: action.pack.manifest.voicePath,
                  subtitlePath: action.pack.manifest.subtitlePath,
                  memoryNamespace: action.pack.manifest.memoryNamespace,
                },
              }
            : state.packImport.validationReport,
        },
      };
    }
    case "pack.workshopOpen": {
      const targetPackId = action.packId ?? state.selectedPackId;
      const sameEditor =
        Boolean(action.tab) &&
        state.packWorkshop.mode === action.mode &&
        (action.mode === "create" || state.packWorkshop.editingPackId === targetPackId);
      if (sameEditor) {
        return {
          ...state,
          packWorkshop: {
            ...state.packWorkshop,
            activeTab: action.tab ?? state.packWorkshop.activeTab,
          },
        };
      }
      const draft =
        action.mode === "create"
          ? createEmptyCharacterDraft(state.packs)
          : createCharacterDraftFromPack(targetPackId, state.packs);
      return {
        ...state,
        packWorkshop: {
          ...state.packWorkshop,
          mode: action.mode,
          activeTab: action.tab ?? "overview",
          editingPackId: action.mode === "edit" ? targetPackId : null,
          draft,
          status: "idle",
          message: action.mode === "create" ? "Fill the fields you want. A name is enough to create a character." : "Edit this character, then save your changes.",
          warnings: [],
          errors: [],
        },
      };
    }
    case "pack.createDraftSetField":
    case "pack.editDraftSetField": {
      const draft = { ...state.packWorkshop.draft };
      const field = action.field;
      const value = action.value;
      if (field === "id" && typeof value === "string") {
        if (draft.operation === "edit_existing") {
          return {
            ...state,
            packWorkshop: {
              ...state.packWorkshop,
              status: "idle",
              message: "Existing character package IDs are fixed. Use Copy to create a new package ID.",
              errors: [],
            },
          };
        }
        draft.id = uniqueDraftPackId(slugifyPackId(value), state.packs, draft.sourcePackId ?? undefined);
        draft.idEdited = true;
      } else if (field === "name" && typeof value === "string") {
        draft.name = value;
        if (state.packWorkshop.mode === "create" && !draft.idEdited) {
          draft.id = uniqueDraftPackId(slugifyPackId(value), state.packs);
        }
      } else if (field === "deleteMemory" && typeof value === "boolean") {
        draft.deleteMemory = value;
      } else if (typeof value === "string" && field !== "emotionAssetPaths") {
        (draft as Record<string, unknown>)[field] = value;
      }
      draft.dirty = true;
      return {
        ...state,
        packWorkshop: {
          ...state.packWorkshop,
          draft,
          status: "idle",
          message: "Draft changed. Save to keep it.",
          errors: [],
        },
      };
    }
    case "pack.assetSet": {
      const draft = {
        ...state.packWorkshop.draft,
        emotionAssetPaths: { ...state.packWorkshop.draft.emotionAssetPaths },
        assetChanges: { ...state.packWorkshop.draft.assetChanges },
      };
      const actionKind = action.action ?? (action.sourcePath.trim() ? "replace" : "keep");
      if (action.slot === "idle") {
        draft.idleAssetPath = action.sourcePath;
      } else {
        draft.emotionAssetPaths[action.slot.replace(/^emotion:/, "")] = action.sourcePath;
      }
      if (actionKind === "keep") {
        delete draft.assetChanges[action.slot];
      } else {
        draft.assetChanges[action.slot] = {
          slot: action.slot,
          action: actionKind,
          sourcePath: actionKind === "remove" ? "" : action.sourcePath,
          sourceDataUrl: action.sourceDataUrl,
          fileName: action.fileName,
        };
      }
      draft.dirty = true;
      return {
        ...state,
        packWorkshop: {
          ...state.packWorkshop,
          draft,
          status: "idle",
          message: "Image path updated. Save to copy it into the character pack.",
          errors: [],
        },
      };
    }
    case "pack.saveDraftStart":
      return {
        ...state,
        packWorkshop: {
          ...state.packWorkshop,
          status: "saving",
          message: "Saving character.",
          warnings: [],
          errors: [],
        },
      };
    case "pack.saveDraftResult": {
      if (!action.pack || action.errors.length > 0) {
        return {
          ...state,
          packWorkshop: {
            ...state.packWorkshop,
            status: "error",
            message: action.message,
            warnings: action.warnings,
            errors: action.errors,
          },
        };
      }
      const existingPacks = state.packs.filter((pack) => pack.id !== action.pack!.manifest.id);
      const packs = [...existingPacks, action.pack.summary];
      const selectedPackId = action.selectedPackId && packs.some((pack) => pack.id === action.selectedPackId)
        ? action.selectedPackId
        : state.selectedPackId;
      let nextState: ConsoleAppState = {
        ...state,
        packs,
        selectedPackId,
        packWorkshop: {
          ...state.packWorkshop,
          mode: "edit",
          editingPackId: action.pack.manifest.id,
          draft: createCharacterDraftFromPack(action.pack.manifest.id, packs),
          status: "ready",
          message: action.message,
          warnings: action.warnings,
          errors: [],
        },
        room: {
          ...state.room,
          participants: reconcileRoomParticipants(
            state.room.participants,
            packs,
            state.room.id,
            promptProfileIdentityMode(state.room.promptProfileId, state.room.activeChannelId),
          ),
        },
      };
      nextState = updatePromptOverride(
        nextState,
        "character_pack",
        action.pack.manifest.id,
        action.pack.manifest.name,
        action.pack.manifest.promptText,
        "saveAndApply",
      );
      return nextState;
    }
    case "pack.duplicateStart":
      return {
        ...state,
        packWorkshop: {
          ...state.packWorkshop,
          status: "saving",
          message: "Creating an editable copy.",
          errors: [],
          warnings: [],
        },
      };
    case "pack.deleteStart":
      return {
        ...state,
        packWorkshop: {
          ...state.packWorkshop,
          status: "deleting",
          message: "Deleting character.",
          errors: [],
          warnings: [],
        },
    };
    case "pack.deleteResult": {
      const packs = action.packs;
      const selectedPackId = packs.some((pack) => pack.id === state.selectedPackId)
        ? state.selectedPackId
        : firstAvailablePackId(packs, state.selectedPackId);
      const sourceRooms = state.rooms.length > 0 ? state.rooms : [state.room];
      const rooms = sourceRooms.map((room) => {
        const participants = reconcileRoomParticipants(
          room.participants,
          packs,
          room.id,
          promptProfileIdentityMode(room.promptProfileId, room.activeChannelId),
        );
        return {
          ...room,
          lastSpeakerId: participants.some((participant) => participant.id === room.lastSpeakerId) ? room.lastSpeakerId : null,
          expandedApiRoleId: participants.some((participant) => participant.id === room.expandedApiRoleId) ? room.expandedApiRoleId : null,
          expandedIdentityCardRoleId: participants.some((participant) => participant.id === room.expandedIdentityCardRoleId)
            ? room.expandedIdentityCardRoleId
            : null,
          participants,
        };
      });
      const activeRoom =
        rooms.find((room) => room.id === state.activeRoomId) ??
        rooms.find((room) => room.id === state.room.id) ??
        rooms[0] ?? {
          ...state.room,
          participants: reconcileRoomParticipants(
            state.room.participants,
            packs,
            state.room.id,
            promptProfileIdentityMode(state.room.promptProfileId, state.room.activeChannelId),
          ),
        };
      return {
        ...state,
        packs,
        selectedPackId,
        activeRoomId: activeRoom.id,
        packWorkshop: {
          ...state.packWorkshop,
          mode: "list",
          editingPackId: null,
          draft: createEmptyCharacterDraft(packs),
          status: action.errors.length > 0 ? "error" : "ready",
          message: action.message,
          errors: action.errors,
          warnings: [],
        },
        room: activeRoom,
        rooms,
      };
    }
    case "pack.refresh": {
      const packs = action.packs;
      const selectedPackId = packs.some((pack) => pack.id === state.selectedPackId)
        ? state.selectedPackId
        : packs[0]?.id ?? state.selectedPackId;
      const sourceRooms = state.rooms.length > 0 ? state.rooms : [state.room];
      const rooms = sourceRooms.map((room) => {
        const participants = reconcileRoomParticipants(
          room.participants,
          packs,
          room.id,
          promptProfileIdentityMode(room.promptProfileId, room.activeChannelId),
        );
        return {
          ...room,
          lastSpeakerId: participants.some((participant) => participant.id === room.lastSpeakerId) ? room.lastSpeakerId : null,
          participants,
        };
      });
      const activeRoom =
        rooms.find((room) => room.id === state.activeRoomId) ??
        rooms.find((room) => room.id === state.room.id) ??
        rooms[0] ??
        {
          ...state.room,
          participants: reconcileRoomParticipants(
            state.room.participants,
            packs,
            state.room.id,
            promptProfileIdentityMode(state.room.promptProfileId, state.room.activeChannelId),
          ),
        };
      return {
        ...state,
        packs,
        selectedPackId,
        activeRoomId: activeRoom.id,
        room: activeRoom,
        rooms,
      };
    }
    case "room.toggleOpen": {
      const nextOpen = !state.room.isOpen;
      return {
        ...state,
        room: {
          ...state.room,
          isOpen: nextOpen,
          autoChat: nextOpen ? state.room.autoChat : false,
          autoSpeechState: nextOpen
            ? state.room.autoSpeechState
            : {
                ...state.room.autoSpeechState,
                status: "paused",
                nextTurnAt: null,
                lastReason: "room_closed",
              },
        },
      };
    }
    case "room.toggleAutoChat":
      return {
        ...state,
        room: {
          ...state.room,
          autoChat: !state.room.autoChat,
          flowMode: state.room.autoChat ? "player_reactive" : "auto_simulation",
          simulation: {
            ...state.room.simulation,
            enabled: !state.room.autoChat,
            stopReason: state.room.autoChat ? undefined : state.room.simulation.stopReason,
            currentFocus: state.room.autoChat ? "Room Flow paused." : state.room.simulation.currentFocus,
          },
          autoSpeechState: {
            ...state.room.autoSpeechState,
            status: state.room.autoChat ? "paused" : "running",
            nextTurnAt: null,
            lastReason: state.room.autoChat ? "manual_pause" : "idle_auto",
            consecutiveAutoTurns: state.room.autoChat ? 0 : state.room.autoSpeechState.consecutiveAutoTurns,
            userTriggeredFollowUps: state.room.autoChat ? 0 : state.room.autoSpeechState.userTriggeredFollowUps,
          },
        },
      };
    case "room.setPrivateWhispers":
      return {
        ...state,
        room: {
          ...state.room,
          privateWhispers: action.mode,
        },
      };
    case "room.setFactionHuddles":
      return {
        ...state,
        room: {
          ...state.room,
          factionHuddles: action.mode,
          activeChannelId: action.mode === "off" ? "public" : normalizeActiveChannelId(state.room, state.room.activeChannelId),
          userFactionHuddle: action.mode === "off" ? null : state.room.userFactionHuddle,
        },
      };
    case "room.addFaction": {
      const faction = createCustomRoomFaction(state.room.factions);
      return {
        ...state,
        room: {
          ...state.room,
          factions: [...normalizeRoomFactions(state.room.factions), faction],
        },
      };
    }
    case "room.updateFaction": {
      if (action.factionId === "neutral") {
        return state;
      }
      return {
        ...state,
        room: syncDebateSpeakerAssignments({
          ...state.room,
          factions: normalizeRoomFactions(state.room.factions).map((faction) =>
            faction.id === action.factionId
              ? normalizeRoomFaction({
                  ...faction,
                  ...action.patch,
                  id: faction.id,
                })
              : faction,
          ),
        }),
      };
    }
    case "room.deleteFaction": {
      const factionId = normalizeFactionId(action.factionId);
      if (factionId === "neutral" || !state.room.factions.some((faction) => faction.id === factionId)) {
        return state;
      }
      const nextRoom = {
        ...state.room,
        activeChannelId: state.room.activeChannelId === `faction:${factionId}` ? "public" : state.room.activeChannelId,
        userFactionHuddle: state.room.userFactionHuddle?.factionId === factionId ? null : state.room.userFactionHuddle,
        userProfile: {
          ...state.room.userProfile,
          factionId: state.room.userProfile.factionId === factionId ? "neutral" : state.room.userProfile.factionId,
        },
        factions: normalizeRoomFactions(state.room.factions).filter((faction) => faction.id !== factionId),
        participants: state.room.participants.map((participant) =>
          participant.factionId === factionId ? { ...participant, factionId: "neutral" } : participant,
        ),
        factionHuddleThreads: state.room.factionHuddleThreads.filter((thread) => thread.factionId !== factionId),
      };
      return {
        ...state,
        room: syncDebateSpeakerAssignments({
          ...nextRoom,
          activeChannelId: normalizeActiveChannelId(nextRoom, nextRoom.activeChannelId),
        }),
      };
    }
    case "room.setActiveChannel":
      const nextActiveChannelId = normalizeActiveChannelId(state.room, action.channelId);
      const nextChannelObjective = simulationObjectiveForPrompt(state.room.promptProfileId, nextActiveChannelId);
      return {
        ...state,
        room: markRoomChannelRead({
          ...state.room,
          activeChannelId: nextActiveChannelId,
          simulationObjective: nextChannelObjective,
          simulation: {
            ...state.room.simulation,
            style: simulationStyleForObjective(nextChannelObjective),
          },
        }, nextActiveChannelId),
      };
    case "room.setRoleFaction": {
      const factionId = normalizeFactionId(action.factionId);
      const factions = ensureRoomFaction(state.room.factions, factionId);
      const roomWithParticipantFaction = {
        ...state.room,
        factions,
        participants: state.room.participants.map((participant) =>
          participant.id === action.roleId ? { ...participant, factionId } : participant,
        ),
      };
      return {
        ...state,
        room: syncDebateSpeakerAssignments({
          ...roomWithParticipantFaction,
          activeChannelId: normalizeActiveChannelId(roomWithParticipantFaction, roomWithParticipantFaction.activeChannelId),
        }),
      };
    }
    case "room.clearRoleFaction": {
      const roomWithoutParticipantFaction = {
        ...state.room,
        participants: state.room.participants.map((participant) =>
          participant.id === action.roleId ? { ...participant, factionId: "neutral" } : participant,
        ),
      };
      return {
        ...state,
        room: syncDebateSpeakerAssignments({
          ...roomWithoutParticipantFaction,
          activeChannelId: normalizeActiveChannelId(roomWithoutParticipantFaction, roomWithoutParticipantFaction.activeChannelId),
        }),
      };
    }
    case "room.setDebateSpeakerPosition":
      return {
        ...state,
        room: setRoomDebateSpeakerPosition(state.room, action.roleId, action.position),
      };
    case "room.setUserFaction": {
      const factionId = normalizeFactionId(action.factionId);
      const nextUserHuddle =
        state.room.userFactionHuddle && state.room.userFactionHuddle.factionId !== factionId
          ? null
          : state.room.userFactionHuddle;
      const roomWithUserFaction = {
        ...state.room,
        factions: ensureRoomFaction(state.room.factions, factionId),
        userFactionHuddle: nextUserHuddle,
        userProfile: {
          ...state.room.userProfile,
          factionId,
        },
      };
      return {
        ...state,
        room: {
          ...roomWithUserFaction,
          activeChannelId: nextUserHuddle
            ? normalizeActiveChannelId(roomWithUserFaction, `faction:${factionId}`)
            : normalizeActiveChannelId(roomWithUserFaction, roomWithUserFaction.activeChannelId),
        },
      };
    }
    case "room.clearUserFaction":
      return {
        ...state,
        room: {
          ...state.room,
          userFactionHuddle: null,
          activeChannelId: "public",
          userProfile: {
            ...state.room.userProfile,
            factionId: "neutral",
          },
        },
      };
    case "room.openUserFactionHuddle": {
      const factionId = normalizeFactionId(action.factionId ?? state.room.userProfile.factionId ?? "neutral");
      const hasFactionMember = state.room.participants.some((participant) => participant.factionId === factionId);
      if (factionId === "neutral" || !hasFactionMember) {
        return state;
      }
      return {
        ...state,
        room: {
          ...state.room,
          factionHuddles: "on",
          activeChannelId: `faction:${factionId}`,
          userFactionHuddle: {
            factionId,
            openedAt: new Date().toISOString(),
          },
          userProfile: {
            ...state.room.userProfile,
            factionId,
          },
        },
      };
    }
    case "room.closeUserFactionHuddle":
      return {
        ...state,
        room: {
          ...state.room,
          userFactionHuddle: null,
          activeChannelId: "public",
        },
      };
    case "room.openUserFactionChannel": {
      const factionId = normalizeFactionId(action.factionId ?? state.room.userProfile.factionId ?? "neutral");
      const hasFactionMember = state.room.participants.some((participant) => participant.factionId === factionId);
      if (factionId === "neutral" || !hasFactionMember) {
        return state;
      }
      return {
        ...state,
        room: {
          ...state.room,
          factionHuddles: "on",
          activeChannelId: `faction:${factionId}`,
          userFactionHuddle: {
            factionId,
            openedAt: new Date().toISOString(),
          },
          userProfile: {
            ...state.room.userProfile,
            factionId,
          },
        },
      };
    }
    case "room.syncFactionChannels":
      return {
        ...state,
        room: {
          ...state.room,
          activeChannelId: normalizeActiveChannelId(state.room, state.room.activeChannelId),
        },
      };
    case "room.addFactionHuddle": {
      const threads = [action.thread, ...state.room.factionHuddleThreads.filter((thread) => thread.id !== action.thread.id)].slice(0, 12);
      return {
        ...state,
        room: {
          ...state.room,
          factionHuddleThreads: threads,
          hiddenFactionHuddleCount: state.room.hiddenFactionHuddleCount + 1,
        },
      };
    }
    case "room.createPrivateThread": {
      const thread = createRoomPrivateThread(
        state.room,
        action.memberTargets,
        action.title,
        action.createdBy ?? "user",
      );
      if (!thread) {
        return state;
      }
      const privateThreads = [thread, ...(state.room.privateThreads ?? []).filter((item) => item.id !== thread.id)];
      const nextRoomWithThread = { ...state.room, privateThreads };
      const canOpenThread = action.open !== false && isPrivateThreadVisibleToLocalUser(nextRoomWithThread, thread);
      const activeChannelId = canOpenThread ? (`private:${thread.id}` as const) : state.room.activeChannelId;
      const nextRoom = {
        ...nextRoomWithThread,
        privateThreads,
        activeChannelId,
      };
      return {
        ...state,
        room: canOpenThread ? markRoomChannelRead(nextRoom, activeChannelId) : nextRoom,
      };
    }
    case "room.archivePrivateThread": {
      const privateThreads = (state.room.privateThreads ?? []).map((thread) =>
        thread.id === action.threadId ? { ...thread, status: "archived" as const, updatedAt: new Date().toISOString() } : thread,
      );
      const archivedChannelId = `private:${action.threadId}` as const;
      return {
        ...state,
        room: {
          ...state.room,
          privateThreads,
          activeChannelId: state.room.activeChannelId === archivedChannelId ? "public" : state.room.activeChannelId,
        },
      };
    }
    case "room.sendPrivateMessage":
      return {
        ...state,
        room: appendRoomMessageWithReadState(state.room, action.message),
      };
    case "room.requestRolePrivateChat": {
      const request = {
        id: `private-request-${Date.now().toString(36)}`,
        roomId: state.room.id,
        requesterRoleId: action.requesterRoleId,
        targetRoleIds: Array.from(new Set(action.targetRoleIds.filter((roleId) => roleId !== action.requesterRoleId))),
        reason: action.reason.trim(),
        status: "pending" as const,
        createdAt: new Date().toISOString(),
      };
      return {
        ...state,
        room: {
          ...state.room,
          privateChatRequests: [request, ...(state.room.privateChatRequests ?? [])].slice(0, 20),
        },
      };
    }
    case "room.approvePrivateChatRequest": {
      const request = (state.room.privateChatRequests ?? []).find((item) => item.id === action.requestId);
      if (!request || request.status !== "pending") {
        return state;
      }
      const roleTargets: RoomMentionTarget[] = Array.from(new Set([request.requesterRoleId, ...request.targetRoleIds].filter(Boolean))).map(
        (roleId) => ({ type: "role", roleId: roleId! }),
      );
      const thread = createRoomPrivateThread(state.room, roleTargets, action.threadTitle, "director");
      if (!thread) {
        return state;
      }
      const decidedAt = new Date().toISOString();
      return {
        ...state,
        room: {
          ...state.room,
          privateThreads: [thread, ...(state.room.privateThreads ?? []).filter((item) => item.id !== thread.id)],
          privateChatRequests: (state.room.privateChatRequests ?? []).map((item) =>
            item.id === action.requestId
              ? { ...item, status: "approved" as const, decidedAt, threadId: thread.id, decisionReason: "approved" }
              : item,
          ),
        },
      };
    }
    case "room.rejectPrivateChatRequest":
      return {
        ...state,
        room: {
          ...state.room,
          privateChatRequests: (state.room.privateChatRequests ?? []).map((item) =>
            item.id === action.requestId
              ? { ...item, status: "rejected" as const, decidedAt: new Date().toISOString(), decisionReason: action.reason.trim() }
              : item,
          ),
        },
      };
    case "room.setPrivateInfluence":
      return {
        ...state,
        room: {
          ...state.room,
          lastPrivateInfluence: action.assessment,
        },
      };
    case "room.markChannelRead":
      return {
        ...state,
        room: markRoomChannelRead(state.room, action.channelId, action.messageId, action.at),
      };
    case "room.markAllVisibleChannelsRead":
      return {
        ...state,
        room: markAllRoomChannelsRead(state.room, action.at),
      };
    case "room.setCollaborationPlan":
      return {
        ...state,
        room: {
          ...state.room,
          collaborationPlan: action.plan,
        },
      };
    case "room.setPlotArc":
      return {
        ...state,
        room: saveActiveDirectorScript({
          ...state.room,
          plot: normalizeRoomPlotArcState(action.plot, state.room.topic),
        }),
      };
    case "room.setFrameState":
      return {
        ...state,
        room: {
          ...state.room,
          frame: normalizeRoomFrameState(action.frame),
        },
      };
    case "room.setDirectorEnabled":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            enabled: action.enabled,
          },
        },
      };
    case "room.setDirectorRecipe": {
      const recipe = roomRecipeConfig(action.recipeId);
      const identityMode = promptProfileIdentityMode(recipe.promptProfileId, state.room.activeChannelId);
      const modeRoom = applyDirectorScriptMode(state.room, recipe.id);
      return {
        ...state,
        room: syncDebateSpeakerAssignments({
          ...modeRoom,
          autoChat: recipe.autoChat,
          flowMode: recipe.autoChat ? "auto_simulation" : "player_reactive",
          simulationObjective: simulationObjectiveForRecipe(recipe.id),
          promptProfileId: recipe.promptProfileId,
          privateWhispers: recipe.privateWhispers,
          participants: modeRoom.participants.map((participant) => ({
            ...participant,
            identityCard: normalizeIdentityCard(participant.identityCard, identityMode),
          })),
          director: {
            ...modeRoom.director,
            enabled: true,
            recipeId: recipe.id,
            profileId: recipe.directorProfileId,
            sceneBoard: {
              ...modeRoom.director.sceneBoard,
              title: recipe.name,
              mood: recipe.defaultMood,
              updatedAt: new Date().toISOString(),
            },
          },
        }),
      };
    }
    case "room.updateDirectorScene":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            sceneBoard: action.sceneBoard,
          },
        },
      };
    case "room.updateDirectorScript":
      return {
        ...state,
        room: saveActiveDirectorScript({
          ...state.room,
          director: {
            ...state.room.director,
            scriptBoard: applyDirectorScriptPatch(state.room.director.scriptBoard, action.patch, state.room.topic, activeDirectorScriptMode(state.room)),
          },
        }),
      };
    case "room.setDirectorConstraints":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            constraints: action.constraints,
          },
        },
      };
    case "room.addDirectorOverride":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            constraints: action.constraints,
            overrideLog: [action.entry, ...state.room.director.overrideLog].slice(0, 20),
            sceneBoard: action.sceneBoard ?? state.room.director.sceneBoard,
          },
        },
      };
    case "room.setDirectorLastMove":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            lastMove: action.move,
            lastSpokeAt: action.at,
          },
        },
      };
    case "room.requestDirectorMove":
      return state;
    case "room.setDirectorApiMode": {
      const nextDirectorApi = normalizeDirectorApiProfile({
        ...state.room.director.apiProfile,
        mode: action.mode,
        status: statusForDirectorApiMode(action.mode, state.room.director.apiProfile.secretRef, state),
        lastTestMessage: messageForDirectorApiMode(action.mode, state.room.director.apiProfile.secretRef),
        testedAt: null,
      });
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            apiProfile: nextDirectorApi,
          },
        },
      };
    }
    case "room.setDirectorApiPreset": {
      const preset = state.aiPresets.find((candidate) => candidate.id === action.presetId) ?? defaultAiPreset;
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            apiProfile: normalizeDirectorApiProfile({
              ...state.room.director.apiProfile,
              providerId: preset.id,
              baseUrl: preset.baseUrl,
              chatModel: preset.recommendedChatModel,
              visionModel: preset.recommendedVisionModel,
              status: statusForDirectorApiMode(state.room.director.apiProfile.mode, state.room.director.apiProfile.secretRef, state),
              lastTestMessage: `${preset.name} selected for the Director.`,
              testedAt: null,
            }),
          },
        },
      };
    }
    case "room.setDirectorApiKeyPreview": {
      const keyPreview = maskKey(action.apiKeyPreview);
      const secretRef = action.apiKeyPreview.trim() ? directorApiSecretRef(state.room.id) : null;
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            apiProfile: normalizeDirectorApiProfile({
              ...state.room.director.apiProfile,
              mode: "custom_director",
              secretRef,
              keyPreview,
              status: secretRef ? "ready" : "missing_key",
              lastTestMessage: secretRef
                ? "Director API key is saved securely. Test it before using it for story planning."
                : "Director API key cleared. The Director will use the room default, main setup, or local rules.",
              testedAt: null,
            }),
          },
        },
      };
    }
    case "room.setDirectorApiAdvancedOpen":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            apiProfile: { ...state.room.director.apiProfile, advancedOpen: action.advancedOpen },
          },
        },
      };
    case "room.setDirectorApiField":
      const directorApiFieldPatch =
        action.field === "baseUrl" ? { baseUrl: normalizeAiServiceUrlInput(action.value).baseUrl } : { [action.field]: action.value };
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            apiProfile: normalizeDirectorApiProfile({
              ...state.room.director.apiProfile,
              ...directorApiFieldPatch,
              testedAt: null,
            }),
          },
        },
      };
    case "room.setDirectorApiNumberField":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            apiProfile: normalizeDirectorApiProfile({
              ...state.room.director.apiProfile,
              generationOverrideEnabled: true,
              [action.field]: action.value,
              testedAt: null,
            }),
          },
        },
      };
    case "room.setDirectorGenerationOverride":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            apiProfile: normalizeDirectorApiProfile({
              ...state.room.director.apiProfile,
              generationOverrideEnabled: action.enabled ?? state.room.director.apiProfile.generationOverrideEnabled,
              ...(action.field ? { [action.field]: action.value ?? state.room.director.apiProfile[action.field] } : {}),
              testedAt: null,
            }),
          },
        },
      };
    case "room.setDirectorApiStatus":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            apiProfile: {
              ...state.room.director.apiProfile,
              status: action.status,
              lastTestMessage: action.message,
              testedAt: action.testedAt === undefined ? state.room.director.apiProfile.testedAt : action.testedAt,
            },
          },
        },
      };
    case "room.testDirectorApi":
      return {
        ...state,
        room: {
          ...state.room,
          director: {
            ...state.room.director,
            apiProfile: {
              ...state.room.director.apiProfile,
              lastTestMessage: "Testing Director API settings.",
            },
          },
        },
      };
    case "room.setUserDisplayName":
      return {
        ...state,
        room: {
          ...state.room,
          userProfile: {
            ...state.room.userProfile,
            displayName: normalizeRoomUserDisplayName(action.displayName),
          },
        },
      };
    case "room.setTopic":
      return { ...state, room: { ...state.room, topic: action.topic.trim() || state.room.topic } };
    case "room.setSpeed":
      return { ...state, room: { ...state.room, speed: action.speed } };
    case "room.setFreedomLevel":
      return { ...state, room: { ...state.room, freedomLevel: action.freedomLevel } };
    case "room.setAdvancePolicy":
      return {
        ...state,
        room: {
          ...state.room,
          advancePolicy: action.policy,
        },
      };
    case "room.setContextBudget":
      return {
        ...state,
        room: {
          ...state.room,
          contextBudget: normalizeRoomContextBudget(action.budget),
        },
      };
    case "room.setAutoPacePreset": {
      const presetDefaults =
        action.preset === "custom"
          ? normalizeRoomAutoPaceSettings({ ...state.room.autoPace, preset: "custom" })
          : roomAutoPacePresetSettings[action.preset];
      return {
        ...state,
        room: {
          ...state.room,
          autoPace: normalizeRoomAutoPaceSettings(presetDefaults),
        },
      };
    }
    case "room.setAutoPaceNumberField":
      return {
        ...state,
        room: {
          ...state.room,
          autoPace: normalizeRoomAutoPaceSettings({
            ...state.room.autoPace,
            preset: "custom",
            [action.field]: action.value,
          }),
        },
      };
    case "room.setAutoPaceRandomize":
      return {
        ...state,
        room: {
          ...state.room,
          autoPace: normalizeRoomAutoPaceSettings({
            ...state.room.autoPace,
            preset: "custom",
            randomize: action.randomize,
          }),
        },
      };
    case "room.setSpeakerPolicy":
      return {
        ...state,
        room: {
          ...state.room,
          speakerPolicy: normalizeRoomSpeakerPolicy({
            ...state.room.speakerPolicy,
            mode: action.policy,
          }),
        },
      };
    case "room.setSpeakerPolicyNumberField":
      return {
        ...state,
        room: {
          ...state.room,
          speakerPolicy: normalizeRoomSpeakerPolicy({
            ...state.room.speakerPolicy,
            [action.field]: action.value,
          }),
        },
      };
    case "room.setSpeakerPolicyBooleanField":
      return {
        ...state,
        room: {
          ...state.room,
          speakerPolicy: normalizeRoomSpeakerPolicy({
            ...state.room.speakerPolicy,
            [action.field]: action.value,
          }),
        },
      };
    case "room.setAdvanceRuntimeState":
      return {
        ...state,
        room: {
          ...state.room,
          lastContinuationAssessment:
            action.continuationAssessment === undefined
              ? state.room.lastContinuationAssessment ?? null
              : action.continuationAssessment,
          lastAdvanceDecision:
            action.advanceDecision === undefined ? state.room.lastAdvanceDecision ?? null : action.advanceDecision,
          lastEngagementDecision:
            action.engagementDecision === undefined
              ? state.room.lastEngagementDecision ?? null
              : action.engagementDecision,
          lastShouldSpeakDecision:
            action.shouldSpeakDecision === undefined
              ? state.room.lastShouldSpeakDecision ?? null
              : action.shouldSpeakDecision,
          lastInputProcessed:
            action.inputProcessed === undefined ? state.room.lastInputProcessed ?? null : action.inputProcessed,
          lastResponseObligation:
            action.responseObligation === undefined
              ? state.room.lastResponseObligation ?? null
              : action.responseObligation,
          lastNoResponseReason:
            action.noResponseReason === undefined ? state.room.lastNoResponseReason ?? null : action.noResponseReason,
          lastFallbackAction:
            action.fallbackAction === undefined ? state.room.lastFallbackAction ?? null : action.fallbackAction,
          silentAutoTurnCount:
            action.silentAutoTurnCount === undefined ? state.room.silentAutoTurnCount ?? 0 : action.silentAutoTurnCount,
        },
      };
    case "room.setCollaborationState":
      return {
        ...state,
        room: {
          ...state.room,
          collaborationMode: action.mode ?? state.room.collaborationMode,
          floorOwner: action.floorOwner ?? state.room.floorOwner,
          turnPhase: action.phase ?? state.room.turnPhase,
          lastTerminationReason:
            action.terminationReason === undefined ? state.room.lastTerminationReason : action.terminationReason,
        },
      };
    case "room.setSimulationState":
      return {
        ...state,
        room: syncDebateSpeakerAssignments({
          ...state.room,
          simulation: {
            ...state.room.simulation,
            ...action.simulation,
          },
          match: action.match
            ? {
                ...state.room.match,
                ...action.match,
            }
            : state.room.match,
        }),
      };
    case "room.setDiscussionPlan":
      return { ...state, room: { ...state.room, activeDiscussionPlan: action.plan } };
    case "room.setApiMode":
      const nextApiForMode = normalizeRoomApiProfile({
        ...state.room.apiProfile,
        mode: action.mode,
        status: statusForRoomApiMode(action.mode, state.room.apiProfile.secretRef),
        lastTestMessage: messageForRoomApiMode(action.mode, state.room.apiProfile.secretRef),
        testedAt: null,
      });
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: nextApiForMode,
          director: syncUseRoomDirectorStatus(state.room.director, nextApiForMode.status),
          participants: syncUseRoomRoleStatus(state.room.participants, nextApiForMode.status),
        },
      };
    case "room.setApiPreset": {
      const preset = state.aiPresets.find((candidate) => candidate.id === action.presetId) ?? defaultAiPreset;
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: normalizeRoomApiProfile({
            ...state.room.apiProfile,
            providerId: preset.id,
            baseUrl: preset.baseUrl,
            chatModel: preset.recommendedChatModel,
            visionModel: preset.recommendedVisionModel,
            status: statusForRoomApiMode(state.room.apiProfile.mode, state.room.apiProfile.secretRef),
          lastTestMessage: `${preset.name} selected for this room.`,
            testedAt: null,
          }),
          director: syncUseRoomDirectorStatus(
            state.room.director,
            statusForRoomApiMode(state.room.apiProfile.mode, state.room.apiProfile.secretRef),
          ),
        },
      };
    }
    case "room.setApiKeyPreview": {
      const keyPreview = maskKey(action.apiKeyPreview);
      const secretRef = action.apiKeyPreview.trim() ? roomApiSecretRef(state.room.id) : null;
      const nextApiForKey = normalizeRoomApiProfile({
        ...state.room.apiProfile,
        mode: "custom_room",
        secretRef,
        keyPreview,
        status: secretRef ? "ready" : "missing_key",
        lastTestMessage: secretRef
          ? "Room API key is saved securely. Test the connection when ready."
          : "Room API key cleared. The room will use the main API setup or bundled local model.",
        testedAt: null,
      });
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: nextApiForKey,
          director: syncUseRoomDirectorStatus(state.room.director, nextApiForKey.status),
          participants: syncUseRoomRoleStatus(state.room.participants, nextApiForKey.status),
        },
      };
    }
    case "room.setApiAdvancedOpen":
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: { ...state.room.apiProfile, advancedOpen: action.advancedOpen },
        },
      };
    case "room.setApiField":
      const roomApiFieldPatch =
        action.field === "baseUrl" ? { baseUrl: normalizeAiServiceUrlInput(action.value).baseUrl } : { [action.field]: action.value };
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: normalizeRoomApiProfile({
            ...state.room.apiProfile,
            ...roomApiFieldPatch,
            testedAt: null,
          }),
        },
      };
    case "room.setApiNumberField":
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: normalizeRoomApiProfile({
            ...state.room.apiProfile,
            generationMode: "custom",
            [action.field]: action.value,
            testedAt: null,
          }),
        },
      };
    case "room.setGenerationMode":
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: normalizeRoomApiProfile({
            ...state.room.apiProfile,
            generationMode: action.mode,
            testedAt: null,
          }),
        },
      };
    case "room.setGenerationField":
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: normalizeRoomApiProfile({
            ...state.room.apiProfile,
            generationMode: "custom",
            [action.field]: action.value,
            testedAt: null,
          }),
        },
      };
    case "room.setApiStatus":
      const nextApiForStatus = {
        ...state.room.apiProfile,
        status: action.status,
        lastTestMessage: action.message,
        testedAt: action.testedAt === undefined ? state.room.apiProfile.testedAt : action.testedAt,
      };
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: nextApiForStatus,
          director: syncUseRoomDirectorStatus(state.room.director, nextApiForStatus.status),
          participants: syncUseRoomRoleStatus(state.room.participants, nextApiForStatus.status),
        },
      };
    case "room.testApi":
      return {
        ...state,
        room: {
          ...state.room,
          apiProfile: {
            ...state.room.apiProfile,
            lastTestMessage: "Testing Room API settings.",
          },
        },
      };
    case "room.selectPromptProfile": {
      const nextPromptObjective = simulationObjectiveForPrompt(action.profileId, state.room.activeChannelId);
      const identityMode = promptProfileIdentityMode(action.profileId, state.room.activeChannelId);
      return {
        ...state,
        room: syncDebateSpeakerAssignments({
          ...state.room,
          promptProfileId: action.profileId,
          participants: state.room.participants.map((participant) => ({
            ...participant,
            identityCard: normalizeIdentityCard(participant.identityCard, identityMode),
          })),
          simulationObjective: nextPromptObjective,
          simulation: {
            ...state.room.simulation,
            style: simulationStyleForObjective(nextPromptObjective),
          },
        }),
      };
    }
    case "room.tickAutoSpeech":
      return {
        ...state,
        room: {
          ...state.room,
          autoSpeechState: {
            ...state.room.autoSpeechState,
            status: action.status,
            lastReason: action.reason,
            nextTurnAt: action.nextTurnAt,
            consecutiveAutoTurns: action.consecutiveAutoTurns,
            userTriggeredFollowUps: action.userTriggeredFollowUps,
            lastTurnAt: action.lastTurnAt,
            pendingFollowup:
              action.pendingFollowup === undefined ? state.room.autoSpeechState.pendingFollowup : action.pendingFollowup,
          },
        },
      };
    case "room.setAutoSpeechStatus":
      return {
        ...state,
        room: {
          ...state.room,
          autoSpeechState: {
            ...state.room.autoSpeechState,
            status: action.status,
            nextTurnAt:
              action.nextTurnAt === undefined ? state.room.autoSpeechState.nextTurnAt : action.nextTurnAt,
            lastReason:
              action.lastReason === undefined ? state.room.autoSpeechState.lastReason : action.lastReason,
            consecutiveAutoTurns: action.resetCounters ? 0 : state.room.autoSpeechState.consecutiveAutoTurns,
            userTriggeredFollowUps: action.resetCounters ? 0 : state.room.autoSpeechState.userTriggeredFollowUps,
            pendingFollowup:
              action.pendingFollowup === undefined ? state.room.autoSpeechState.pendingFollowup : action.pendingFollowup,
          },
        },
      };
    case "room.setLastSpeaker":
      return { ...state, room: { ...state.room, lastSpeakerId: action.roleId } };
    case "room.setHighlightedTargets":
      return {
        ...state,
        room: {
          ...state.room,
          highlightedTargets: dedupeMentionTargets(action.targets),
        },
      };
    case "room.addRole": {
      const pack = state.packs.find((candidate) => candidate.id === action.packId);
      if (!pack) {
        return state;
      }
      const baseName = pack.name;
      const samePackCount = state.room.participants.filter((participant) => participant.packId === action.packId).length;
      const displayName = samePackCount === 0 ? baseName : `${baseName} ${samePackCount + 1}`;
      const participant = createParticipant(
        action.packId,
        displayName,
        "idle",
        nextParticipantId(state.room.participants, action.packId),
        state.room.id,
        promptProfileIdentityMode(state.room.promptProfileId, state.room.activeChannelId),
      );

      return {
        ...state,
        room: syncDebateSpeakerAssignments({
          ...state.room,
          participants: [...state.room.participants, participant],
        }),
      };
    }
    case "room.removeRole":
      if (state.room.participants.length <= 1) {
        return state;
      }

      return {
        ...state,
        room: syncDebateSpeakerAssignments({
          ...state.room,
          lastSpeakerId: state.room.lastSpeakerId === action.roleId ? null : state.room.lastSpeakerId,
          expandedApiRoleId: state.room.expandedApiRoleId === action.roleId ? null : state.room.expandedApiRoleId,
          expandedIdentityCardRoleId:
            state.room.expandedIdentityCardRoleId === action.roleId ? null : state.room.expandedIdentityCardRoleId,
          highlightedTargets: state.room.highlightedTargets.filter(
            (target) => target.type !== "role" || target.roleId !== action.roleId,
          ),
          participants: state.room.participants.filter((participant) => participant.id !== action.roleId),
        }),
      };
    case "room.setExpandedApiRole":
      return {
        ...state,
        room: {
          ...state.room,
          expandedApiRoleId: action.roleId,
        },
      };
    case "room.setExpandedIdentityCardRole":
      return {
        ...state,
        room: {
          ...state.room,
          expandedIdentityCardRoleId:
            state.room.expandedIdentityCardRoleId === action.roleId ? null : action.roleId,
        },
      };
    case "room.setExpandedInspectorSection":
      return {
        ...state,
        room: {
          ...state.room,
          expandedInspectorSection: state.room.expandedInspectorSection === action.section ? null : action.section,
        },
      };
    case "room.setIdentityCardEnabled": {
      const identityMode = promptProfileIdentityMode(state.room.promptProfileId, state.room.activeChannelId);
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) =>
            participant.id === action.roleId
              ? {
                  ...participant,
                  identityCard: {
                    ...normalizeIdentityCard(participant.identityCard, identityMode),
                    enabled: action.enabled,
                    updatedAt,
                  },
                }
              : participant,
          ),
        },
      };
    }
    case "room.setIdentityCardField": {
      const identityMode = promptProfileIdentityMode(state.room.promptProfileId, state.room.activeChannelId);
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) =>
            participant.id === action.roleId
              ? {
                  ...participant,
                  identityCard: {
                    ...normalizeIdentityCard(participant.identityCard, identityMode),
                    enabled: participant.identityCard?.enabled ?? false,
                    [action.field]: action.value,
                    updatedAt,
                  },
                }
              : participant,
          ),
        },
      };
    }
    case "room.restoreIdentityCardTemplate": {
      const identityMode = promptProfileIdentityMode(state.room.promptProfileId, state.room.activeChannelId);
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) =>
            participant.id === action.roleId
              ? {
                  ...participant,
                  identityCard: createDefaultIdentityCardForMode(identityMode),
                }
              : participant,
          ),
        },
      };
    }
    case "room.setRoleApiMode":
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) => {
            if (participant.id !== action.roleId) {
              return participant;
            }

            if (action.mode === "use_room") {
              return {
                ...participant,
                apiProfile: { ...defaultRoleApiProfile },
              };
            }

            if (action.mode === "model_override") {
              return {
                ...participant,
                apiProfile: normalizeRoleApiProfile({
                  ...participant.apiProfile,
                  mode: "model_override",
                  providerId: "room",
                  secretRef: null,
                  keyPreview: "",
                  baseUrl: "",
                  chatModel: state.room.apiProfile.chatModel || state.ai.chatModel,
                  visionModel: state.room.apiProfile.visionModel || state.ai.visionModel,
                  temperature: state.room.apiProfile.temperature,
                  maxTokens: state.room.apiProfile.maxTokens,
                  status: state.room.apiProfile.status,
                }),
              };
            }

            const secretRef = participant.apiProfile.secretRef || roleApiSecretRef(state.room.id, participant.id);
            return {
              ...participant,
              apiProfile: {
                mode: "own_profile",
                generationOverrideEnabled: true,
                providerId: state.ai.presetId,
                secretRef: participant.apiProfile.keyPreview ? secretRef : null,
                keyPreview: participant.apiProfile.keyPreview,
                baseUrl: state.ai.baseUrl,
                chatModel: state.ai.chatModel,
                visionModel: state.ai.visionModel,
                temperature: 0.7,
                maxTokens: 900,
                status: participant.apiProfile.keyPreview ? "ready" : "missing_key",
              },
            };
          }),
        },
      };
    case "room.setRoleApiOverride":
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) => {
            if (participant.id !== action.roleId) {
              return participant;
            }

            const { apiKeyPreview, ...profilePatch } = action.patch;
            const normalizedProfilePatch =
              profilePatch.baseUrl === undefined
                ? profilePatch
                : { ...profilePatch, baseUrl: normalizeAiServiceUrlInput(profilePatch.baseUrl).baseUrl };
            const secretRef =
              apiKeyPreview === undefined
                ? participant.apiProfile.secretRef
                : apiKeyPreview.trim()
                  ? roleApiSecretRef(state.room.id, participant.id)
                  : null;
            const keyPreview =
              apiKeyPreview === undefined ? participant.apiProfile.keyPreview : maskKey(apiKeyPreview);

            return {
              ...participant,
              apiProfile: normalizeRoleApiProfile({
                ...participant.apiProfile,
                ...normalizedProfilePatch,
                generationOverrideEnabled:
                  normalizedProfilePatch.temperature !== undefined || normalizedProfilePatch.maxTokens !== undefined
                    ? true
                    : participant.apiProfile.generationOverrideEnabled,
                secretRef,
                keyPreview,
                status:
                  participant.apiProfile.mode === "own_profile"
                    ? secretRef
                      ? "ready"
                      : "missing_key"
                    : participant.apiProfile.status,
              }),
            };
          }),
        },
      };
    case "room.setRoleGenerationOverride":
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) =>
            participant.id === action.roleId
              ? {
                  ...participant,
                  apiProfile: normalizeRoleApiProfile({
                    ...participant.apiProfile,
                    generationOverrideEnabled: action.enabled ?? participant.apiProfile.generationOverrideEnabled,
                    ...(action.field ? { [action.field]: action.value ?? participant.apiProfile[action.field] } : {}),
                  }),
                }
              : participant,
          ),
        },
      };
    case "room.clearRoleApiOverride":
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) =>
            participant.id === action.roleId
              ? {
                  ...participant,
                  apiProfile: { ...defaultRoleApiProfile },
                }
              : participant,
          ),
        },
      };
    case "room.setRoleApiStatus":
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) =>
            participant.id === action.roleId
              ? {
                  ...participant,
                  apiProfile: {
                    ...participant.apiProfile,
                    status: action.status,
                  },
                }
              : participant,
          ),
        },
      };
    case "room.addMessage": {
      return {
        ...state,
        room: appendRoomMessageWithReadState(state.room, action.message),
      };
    }
    case "room.updateParticipant":
      return {
        ...state,
        room: {
          ...state.room,
          participants: state.room.participants.map((participant) =>
            participant.id === action.roleId
              ? {
                  ...participant,
                  mood: action.emotion,
                  currentEmotion: action.emotion,
                  viewportState: action.viewportState,
                }
              : participant,
          ),
        },
      };
    case "release.scanStart":
      return {
        ...state,
        release: {
          generatedAt: new Date().toISOString(),
          stagingPath: "dist/release-staging",
          status: "warning",
          checkedItems: [{ name: "scan", status: "warning", detail: "Release scan is running." }],
          forbiddenFindings: [],
          missingItems: [],
          packageSummary: {
            files: 0,
            bytes: 0,
            includesRustToolchain: false,
            includesRuntimeCache: false,
            includesSecrets: false,
          },
        },
      };
    case "release.scanResult":
      return { ...state, release: action.report };
    case "memory.addSharedNote":
      return state;
    default:
      return state;
  }
}

export function getActiveRoom(state: ConsoleAppState): RoomState {
  return ensureRoomCollection(state).room;
}

export function syncActiveRoom(state: ConsoleAppState): ConsoleAppState {
  const normalized = ensureRoomCollection(state);
  if (normalized.rooms.length === 0) {
    return normalized;
  }
  return {
    ...normalized,
    rooms: upsertRoom(normalized.rooms, normalized.room),
    activeRoomId: normalized.room.id,
  };
}

export function updateRoomById(
  state: ConsoleAppState,
  roomId: string,
  updater: (room: RoomState) => RoomState,
): ConsoleAppState {
  const normalized = syncActiveRoom(state);
  const rooms = normalized.rooms.map((room) => (room.id === roomId ? prepareRoomForStorage(updater(room)) : room));
  const room = roomId === normalized.activeRoomId ? rooms.find((item) => item.id === roomId) ?? normalized.room : normalized.room;
  return {
    ...normalized,
    rooms,
    room,
  };
}

export function switchActiveRoom(state: ConsoleAppState, roomId: string): ConsoleAppState {
  return switchRoomInState(state, roomId);
}

function ensureRoomCollection(state: ConsoleAppState): ConsoleAppState {
  const fallbackRoom = normalizeRoomForRuntime(state.room, state.packs);
  if (!Array.isArray(state.rooms) || state.rooms.length === 0) {
    return {
      ...state,
      activeRoomId: "",
      rooms: [],
      room: fallbackRoom,
    };
  }
  const sourceRooms = Array.isArray(state.rooms) && state.rooms.length > 0 ? state.rooms : [fallbackRoom];
  const rawActiveRoomId = state.activeRoomId && sourceRooms.some((room) => room.id === state.activeRoomId)
    ? state.activeRoomId
    : fallbackRoom.id;
  const rooms = uniqueRooms(
    upsertRoom(
      sourceRooms.map((room) => normalizeRoomForRuntime(room, state.packs)),
      fallbackRoom.id === rawActiveRoomId ? fallbackRoom : normalizeRoomForRuntime(sourceRooms.find((room) => room.id === rawActiveRoomId) ?? fallbackRoom, state.packs),
    ),
  );
  const activeRoomId = state.activeRoomId && rooms.some((room) => room.id === state.activeRoomId)
    ? state.activeRoomId
    : fallbackRoom.id;
  const activeRoom = fallbackRoom.id === activeRoomId ? fallbackRoom : rooms.find((room) => room.id === activeRoomId) ?? fallbackRoom;
  return {
    ...state,
    activeRoomId: activeRoom.id,
    rooms: upsertRoom(rooms, activeRoom),
    room: activeRoom,
  };
}

function createRoomInState(state: ConsoleAppState, title?: string, recipeId: RoomRecipeId = "casual"): ConsoleAppState {
  const normalized = syncActiveRoom(state);
  const nextTitle = uniqueRoomTitle(normalized.rooms, title, defaultNewRoomTitle);
  const room = createDefaultRoomState(uniqueRoomIdForPromptIsolation(normalized.rooms, normalized.prompts, nextTitle), normalized.packs, {
    title: nextTitle,
    recipeId,
    isOpen: true,
    includeInitialRole: false,
  });
  const rooms = [...normalized.rooms, room];
  return {
    ...normalized,
    activeRoomId: room.id,
    room,
    rooms,
    prompts: {
      ...normalized.prompts,
      view: normalizePromptCenterView({ ...normalized, activeRoomId: room.id, room, rooms }, {
        ...normalized.prompts.view,
        selectedRoomId: room.id,
      }),
    },
  };
}

function switchRoomInState(state: ConsoleAppState, roomId: string): ConsoleAppState {
  const normalized = syncActiveRoom(state);
  const nextRoom = normalized.rooms.find((room) => room.id === roomId);
  if (!nextRoom) {
    return normalized;
  }
  const pausedCurrentRoom = prepareRoomForBackground(normalized.room);
  const rooms = upsertRoom(normalized.rooms, pausedCurrentRoom);
  return {
    ...normalized,
    activeRoomId: nextRoom.id,
    room: normalizeRoomForRuntime(nextRoom, normalized.packs),
    rooms,
  };
}

function renameRoomInState(state: ConsoleAppState, roomId: string, title: string): ConsoleAppState {
  const normalized = syncActiveRoom(state);
  const existing = normalized.rooms.find((room) => room.id === roomId);
  if (!existing) {
    return normalized;
  }
  const nextTitle = uniqueRoomTitle(normalized.rooms, title, existing.title, roomId);
  return updateRoomById(normalized, roomId, (room) => ({
    ...room,
    title: nextTitle,
    director: {
      ...room.director,
      sceneBoard: {
        ...room.director.sceneBoard,
        title: nextTitle,
      },
    },
  }));
}

function cloneDirectorScriptsForRoom(
  scripts: RoomState["directorScriptsByMode"] | undefined,
  roomId: string,
  activeMode: RoomRecipeId,
  topic: string,
  currentPlot?: Partial<PlotArcState>,
  currentScriptBoard?: Partial<DirectorScriptBoard>,
): Partial<Record<RoomRecipeId, ScopedDirectorScript>> {
  return normalizeDirectorScriptsByMode(scripts, roomId, activeMode, topic, currentPlot, currentScriptBoard);
}

function duplicateRoomInState(state: ConsoleAppState, roomId: string, title?: string, copyDirectorScript = true): ConsoleAppState {
  const normalized = syncActiveRoom(state);
  const source = normalized.rooms.find((room) => room.id === roomId);
  if (!source) {
    return normalized;
  }
  const nextTitle = uniqueRoomTitle(normalized.rooms, title, `${source.title} Copy`);
  const nextId = uniqueRoomId(normalized.rooms, nextTitle);
  const sourceMode = activeDirectorScriptMode(source);
  const directorScriptsByMode = copyDirectorScript
    ? cloneDirectorScriptsForRoom(source.directorScriptsByMode, nextId, sourceMode, source.topic, source.plot, source.director.scriptBoard)
    : {
        [sourceMode]: createScopedDirectorScript(nextId, sourceMode, source.topic),
      };
  const activeScript = directorScriptsByMode[sourceMode] ?? createScopedDirectorScript(nextId, sourceMode, source.topic);
  const room: RoomState = {
    ...source,
    id: nextId,
    title: nextTitle,
    isOpen: true,
    autoChat: false,
    activeChannelId: "public",
    autoSpeechState: {
      ...defaultRoomAutoSpeechState,
      lastReason: "manual_pause",
    },
    activeDiscussionPlan: null,
    collaborationPlan: null,
    plot: activeScript.plotDirection,
    directorScriptsByMode,
    floorOwner: { type: "none" },
    turnPhase: "wait",
    lastTerminationReason: null,
    hiddenWhisperCount: 0,
    hiddenFactionHuddleCount: 0,
    factionHuddleThreads: [],
    privateThreads: [],
    privateChatRequests: [],
    channelReadState: {},
    lastPrivateInfluence: null,
    userFactionHuddle: null,
    highlightedTargets: [],
    lastSpeakerId: null,
    messages: [],
    participants: reconcileRoomParticipants(
      source.participants,
      normalized.packs,
      nextId,
      promptProfileIdentityMode(source.promptProfileId, source.activeChannelId),
    ),
    director: {
      ...source.director,
      memoryScope: `room:${nextId}:system`,
      scriptBoard: activeScript.scriptBoard,
      sceneBoard: {
        ...source.director.sceneBoard,
        title: nextTitle,
      },
      overrideLog: [],
    },
  };
  const prompts = copyPromptOverridesForDuplicatedRoom(normalized.prompts, source.id, nextId, nextTitle);
  return {
    ...normalized,
    activeRoomId: room.id,
    room,
    rooms: [...normalized.rooms, room],
    prompts: {
      ...prompts,
      view: normalizePromptCenterView({ ...normalized, room, rooms: [...normalized.rooms, room], prompts }, {
        ...prompts.view,
        selectedRoomId: room.id,
      }),
    },
  };
}

function deleteRoomInState(state: ConsoleAppState, roomId: string): ConsoleAppState {
  const normalized = syncActiveRoom(state);
  const promptsWithoutDeletedRoom = removePromptStateForRoom(normalized.prompts, roomId);
  if (normalized.rooms.length <= 1) {
    const nextTitle = defaultNewRoomTitle;
    const room = createDefaultRoomState(uniqueRoomIdForPromptIsolation(normalized.rooms, promptsWithoutDeletedRoom, nextTitle), normalized.packs, {
      title: nextTitle,
      topic: "Daily chat",
      isOpen: false,
      messages: [],
      includeInitialRole: false,
    });
    const rooms: RoomState[] = [];
    const prompts = normalizePromptCenterStateAfterRoomChange({ ...normalized, room, rooms }, promptsWithoutDeletedRoom);
    return {
      ...normalized,
      activeRoomId: "",
      room,
      rooms,
      prompts,
    };
  }
  const rooms = normalized.rooms.filter((room) => room.id !== roomId);
  const nextRoom = roomId === normalized.activeRoomId ? rooms[0]! : normalized.room;
  const prompts = normalizePromptCenterStateAfterRoomChange({ ...normalized, room: nextRoom, rooms }, promptsWithoutDeletedRoom);
  return {
    ...normalized,
    activeRoomId: nextRoom.id,
    room: normalizeRoomForRuntime(nextRoom, normalized.packs),
    rooms,
    prompts,
  };
}

function normalizePromptCenterView(state: ConsoleAppState, view: PromptCenterState["view"]): PromptCenterState["view"] {
  const rooms = Array.isArray(state.rooms) && state.rooms.length > 0 ? state.rooms : [state.room];
  const room = rooms.find((item) => item.id === view.selectedRoomId) ?? rooms.find((item) => item.id === state.activeRoomId) ?? rooms[0] ?? state.room;
  const selectedType = normalizePromptType(view.selectedType);
  const selectedPack = state.packs.find((pack) => pack.id === view.selectedPackId) ?? state.packs.find((pack) => pack.id === state.selectedPackId) ?? state.packs[0];
  const selectedPromptMode = isPromptCenterRoomMode(view.selectedPromptMode) ? view.selectedPromptMode : resolveRoomPromptMode(room);
  const role =
    selectedType === "roles"
      ? room.participants.find((participant) => participant.roleId === view.selectedRoleId || participant.id === view.selectedRoleId) ?? room.participants[0]
      : undefined;
  const selectedPresetId =
    typeof view.selectedPresetId === "string" && state.prompts.presets.some((preset) => preset.id === view.selectedPresetId)
      ? view.selectedPresetId
      : undefined;
  return {
    mode: normalizePromptCenterMode(view),
    selectedRoomId: room.id,
    selectedType,
    selectedPromptMode,
    selectedRoleId: selectedType === "roles" ? role?.roleId : undefined,
    selectedPackId: selectedPack?.id ?? state.selectedPackId ?? "demo-mio",
    selectedPresetId,
    roomSearchQuery: view.roomSearchQuery ?? "",
    characterSearchQuery: view.characterSearchQuery ?? "",
    previewOpen: Boolean(view.previewOpen),
  };
}

function promptTargetFromView(state: ConsoleAppState, view: PromptCenterState["view"]): { scope: PromptScope; targetId: string } {
  const normalizedView = normalizePromptCenterView(state, view);
  const room = state.rooms.find((item) => item.id === normalizedView.selectedRoomId) ?? state.room;
  const promptMode = normalizedView.selectedPromptMode ?? resolveRoomPromptMode(room);
  if (normalizedView.mode === "characters") {
    return { scope: "character_pack", targetId: normalizedView.selectedPackId || state.selectedPackId || state.packs[0]?.id || "demo-mio" };
  }
  if (normalizedView.selectedType === "director") {
    return { scope: "director", targetId: directorModePromptTargetId(room, promptMode) };
  }
  if (normalizedView.selectedType === "roles") {
    const participant =
      room.participants.find((item) => item.roleId === normalizedView.selectedRoleId || item.id === normalizedView.selectedRoleId) ??
      room.participants[0];
    return { scope: "character_pack", targetId: participant?.packId ?? state.selectedPackId ?? state.packs[0]?.id ?? "demo-mio" };
  }
  if (normalizedView.selectedType === "advanced") {
    return { scope: "room", targetId: roomModePromptTargetId(room, promptMode) };
  }
  return { scope: "room", targetId: roomModePromptTargetId(room, promptMode) };
}

function promptViewFromTarget(state: ConsoleAppState, scope: PromptScope, targetId: string): PromptCenterState["view"] {
  const current = normalizePromptCenterView(state, state.prompts.view);
  if (scope === "room" && targetId.startsWith("room:")) {
    return normalizePromptCenterView(state, {
      ...current,
      mode: "rooms",
      selectedRoomId: roomIdFromPromptTarget(targetId, "room"),
      selectedType: "room",
      selectedPromptMode: promptModeFromPromptTarget(targetId, "room") ?? current.selectedPromptMode,
    });
  }
  if (scope === "director" && targetId.startsWith("director:")) {
    return normalizePromptCenterView(state, {
      ...current,
      mode: "rooms",
      selectedRoomId: roomIdFromPromptTarget(targetId, "director"),
      selectedType: "director",
      selectedPromptMode: promptModeFromPromptTarget(targetId, "director") ?? current.selectedPromptMode,
    });
  }
  if (scope === "room_role") {
    const [roomId, roleId] = targetId.includes(":") ? targetId.split(":", 2) : [current.selectedRoomId, targetId];
    return normalizePromptCenterView(state, { ...current, mode: "rooms", selectedRoomId: roomId, selectedType: "roles", selectedRoleId: roleId });
  }
  if (scope === "character_pack") {
    return normalizePromptCenterView(state, { ...current, mode: "characters", selectedPackId: targetId });
  }
  return current;
}

function normalizePromptCenterMode(view: PromptCenterState["view"]): PromptCenterMode {
  const legacySelectedType = (view as { selectedType?: unknown }).selectedType;
  return view.mode === "characters" || legacySelectedType === "character_pack" ? "characters" : "rooms";
}

function normalizePromptType(value: PromptCenterPromptType | "character_pack" | undefined): PromptCenterPromptType {
  if (value === "director" || value === "advanced") {
    return value;
  }
  return "room";
}

function copyPromptOverridesForDuplicatedRoom(
  prompts: PromptCenterState,
  sourceRoomId: string,
  nextRoomId: string,
  nextRoomTitle: string,
): PromptCenterState {
  const now = new Date().toISOString();
  const copied = prompts.overrides
    .filter((override) => isRoomScopedPromptOverride(override, sourceRoomId))
    .map((override) => {
      const nextTargetId = remapRoomPromptTargetId(override.targetId, sourceRoomId, nextRoomId);
      return {
        ...override,
        id: promptOverrideId(override.scope, nextTargetId),
        targetId: nextTargetId,
        title: override.title.replace(sourceRoomId, nextRoomId).replace(/^.+?(?= \/ | Director| Room|$)/, nextRoomTitle),
        updatedAt: now,
      };
    });
  return {
    ...prompts,
    overrides: [...prompts.overrides, ...copied.filter((item) => !prompts.overrides.some((override) => override.scope === item.scope && override.targetId === item.targetId))],
  };
}

function normalizePromptCenterStateAfterRoomChange(state: ConsoleAppState, prompts: PromptCenterState): PromptCenterState {
  const view = normalizePromptCenterView({ ...state, prompts }, prompts.view);
  const target = resolvePromptEditorTarget(view, { ...state, prompts: { ...prompts, view } });
  return {
    ...prompts,
    view,
    activeEditorScope: target.scope,
    activeEditorTargetId: target.targetId,
  };
}

function removePromptStateForRoom(prompts: PromptCenterState, roomId: string): PromptCenterState {
  return {
    ...prompts,
    overrides: prompts.overrides.filter((override) => !isRoomScopedPromptTarget(override.scope, override.targetId, roomId)),
    drafts: prompts.drafts.filter((draft) => !isRoomScopedPromptTarget(draft.scope, draft.targetId, roomId)),
  };
}

function isRoomScopedPromptOverride(override: PromptOverride, roomId: string): boolean {
  return isRoomScopedPromptTarget(override.scope, override.targetId, roomId);
}

function isRoomScopedPromptTarget(scope: PromptScope, targetId: string, roomId: string): boolean {
  return (
    (scope === "room" && targetId === `room:${roomId}`) ||
    (scope === "room" && targetId.startsWith(`room:${roomId}:mode:`)) ||
    (scope === "director" && targetId === `director:${roomId}`) ||
    (scope === "director" && targetId.startsWith(`director:${roomId}:mode:`)) ||
    (scope === "room_role" && targetId.startsWith(`${roomId}:`))
  );
}

function remapRoomPromptTargetId(targetId: string, sourceRoomId: string, nextRoomId: string): string {
  if (targetId.startsWith(`room:${sourceRoomId}:mode:`)) {
    return `room:${nextRoomId}:mode:${targetId.slice(`room:${sourceRoomId}:mode:`.length)}`;
  }
  if (targetId.startsWith(`director:${sourceRoomId}:mode:`)) {
    return `director:${nextRoomId}:mode:${targetId.slice(`director:${sourceRoomId}:mode:`.length)}`;
  }
  if (targetId === `room:${sourceRoomId}`) {
    return `room:${nextRoomId}`;
  }
  if (targetId === `director:${sourceRoomId}`) {
    return `director:${nextRoomId}`;
  }
  if (targetId.startsWith(`${sourceRoomId}:`)) {
    return `${nextRoomId}:${targetId.slice(sourceRoomId.length + 1)}`;
  }
  return targetId;
}

function roomIdFromPromptTarget(targetId: string, scope: "room" | "director"): string {
  const prefix = `${scope}:`;
  const body = targetId.startsWith(prefix) ? targetId.slice(prefix.length) : targetId;
  const modeMarker = ":mode:";
  const markerIndex = body.indexOf(modeMarker);
  return markerIndex >= 0 ? body.slice(0, markerIndex) : body;
}

function promptModeFromPromptTarget(targetId: string, scope: "room" | "director"): RoomContextPanelMode | null {
  const prefix = `${scope}:`;
  const body = targetId.startsWith(prefix) ? targetId.slice(prefix.length) : targetId;
  const modeMarker = ":mode:";
  const markerIndex = body.indexOf(modeMarker);
  if (markerIndex < 0) {
    return null;
  }
  const mode = body.slice(markerIndex + modeMarker.length);
  return isPromptCenterRoomMode(mode) ? mode : null;
}

function isPromptCenterRoomMode(value: unknown): value is RoomContextPanelMode {
  return value === "casual" || value === "story" || value === "mystery" || value === "debate" || value === "study" || value === "planning" || value === "team";
}

function applyPromptPresetToCurrentTarget(state: ConsoleAppState, presetId: string): ConsoleAppState {
  const preset = state.prompts.presets.find((item) => item.id === presetId);
  if (!preset) {
    return withPromptPresetError(state, "Prompt preset was not found.");
  }
  const view = normalizePromptCenterView(state, state.prompts.view);
  const target = promptTargetFromView(state, view);
  const room = state.rooms.find((item) => item.id === view.selectedRoomId) ?? state.room;
  const mode = view.mode === "rooms" ? view.selectedPromptMode ?? resolveRoomPromptMode(room) : null;
  if (!isPromptPresetCompatibleWithTarget(preset, target.scope, mode, view.selectedType)) {
    return withPromptPresetError(state, "This preset cannot be applied to the current prompt target.");
  }

  const title = promptPresetTargetTitle(state, view, target.scope, target.targetId);
  const nextState = updatePromptOverride(state, target.scope, target.targetId, title, preset.text, "saveAndApply");
  return {
    ...nextState,
    prompts: {
      ...nextState.prompts,
      lastMessage: `${preset.title} copied to ${title}.`,
      lastError: null,
    },
  };
}

function promptPresetTargetTitle(
  state: ConsoleAppState,
  view: PromptCenterState["view"],
  scope: PromptScope,
  targetId: string,
): string {
  if (scope === "character_pack") {
    const pack = state.packs.find((item) => item.id === targetId);
    return `${pack?.name ?? targetId} / Character Base Prompt`;
  }
  const room = state.rooms.find((item) => item.id === view.selectedRoomId) ?? state.room;
  const mode = view.selectedPromptMode ?? resolveRoomPromptMode(room);
  if (scope === "director") {
    return `${room.title} / ${mode} / Director Rules`;
  }
  if (scope === "room_role") {
    return `${room.title} / ${mode} / Role Override`;
  }
  return `${room.title} / ${mode} / Room Rules`;
}

function withPromptPresetError(state: ConsoleAppState, error: string): ConsoleAppState {
  return {
    ...state,
    prompts: {
      ...state.prompts,
      lastMessage: "Prompt preset was not changed.",
      lastError: error,
    },
  };
}

function normalizeRoomForRuntime(room: RoomState, packs: CharacterPackSummary[]): RoomState {
  const title = normalizeRoomTitle(room.title, room.topic || "Room");
  const id = room.id || `${slugifyRoomId(title || room.topic || "room")}-${crypto.randomUUID().slice(0, 8)}`;
  const activeChannelId = normalizeActiveChannelId(room, room.activeChannelId ?? "public");
  const simulationObjective = room.simulationObjective ?? simulationObjectiveForPrompt(room.promptProfileId, activeChannelId);
  const simulation = room.simulation ?? defaultRoomSimulationState(simulationObjective);
  const topic = room.topic || "Daily chat";
  const activeScriptMode = normalizeDirectorScriptMode(room.director?.recipeId);
  const directorScriptsByMode = normalizeDirectorScriptsByMode(
    room.directorScriptsByMode,
    id,
    activeScriptMode,
    topic,
    room.plot,
    room.director.scriptBoard,
  );
  const activeDirectorScript = directorScriptsByMode[activeScriptMode] ?? createScopedDirectorScript(id, activeScriptMode, topic, room.plot, room.director.scriptBoard);
  const normalizedRoom: RoomState = {
    ...room,
    id,
    title,
    flowMode: room.flowMode ?? (room.autoChat ? "auto_simulation" : "player_reactive"),
    factions: normalizeRoomFactions(room.factions),
    activeChannelId,
    simulationObjective,
    simulation: {
      ...defaultRoomSimulationState(simulationObjective),
      ...simulation,
      enabled: room.autoChat,
      style: simulation.style ?? simulationStyleForObjective(simulationObjective),
      lastSpeakerIds: simulation.lastSpeakerIds ?? [],
      uncertaintyProfile: simulation.uncertaintyProfile ?? "balanced",
      openHooks: simulation.openHooks ?? [],
    },
    plot: activeDirectorScript.plotDirection,
    directorScriptsByMode,
    frame: normalizeRoomFrameState(room.frame),
    match: {
      ...defaultRoomMatchState(),
      ...(room.match ?? {}),
    },
    channelReadState: room.channelReadState ?? {},
    contextBudget: normalizeRoomContextBudget(room.contextBudget),
    autoPace: normalizeRoomAutoPaceSettings(room.autoPace),
    speakerPolicy: normalizeRoomSpeakerPolicy(room.speakerPolicy),
    privateThreads: normalizeRoomPrivateThreads(room, id),
    privateChatRequests: room.privateChatRequests ?? [],
    lastPrivateInfluence: room.lastPrivateInfluence ?? null,
    expandedIdentityCardRoleId:
      room.expandedIdentityCardRoleId && (room.participants ?? []).some((participant) => participant.id === room.expandedIdentityCardRoleId)
        ? room.expandedIdentityCardRoleId
        : null,
    participants: reconcileRoomParticipants(
      room.participants ?? [],
      packs,
      id,
      promptProfileIdentityMode(room.promptProfileId, activeChannelId),
    ),
    director: {
      ...room.director,
      memoryScope: `room:${id}:system`,
      recipeId: activeScriptMode,
      scriptBoard: activeDirectorScript.scriptBoard,
    },
    messages: (room.messages ?? []).map((message) => ({
      target: "all" as const,
      mentions: [],
      visibility: "public" as const,
      visibleTo: [],
      channelId:
        message.visibility === "faction_huddle" && message.factionId
          ? (`faction:${message.factionId}` as const)
          : message.visibility === "private_thread" && message.channelId?.startsWith("private:")
            ? message.channelId
            : ("public" as const),
      ...message,
      scope: `room:${id}` as const,
    })),
  };
  return syncDebateSpeakerAssignments(normalizedRoom);
}

function prepareRoomForStorage(room: RoomState): RoomState {
  return {
    ...room,
    title: normalizeRoomTitle(room.title, room.topic || "Room"),
  };
}

function prepareRoomForBackground(room: RoomState): RoomState {
  return {
    ...prepareRoomForStorage(room),
    autoSpeechState: {
      ...room.autoSpeechState,
      status: room.autoSpeechState.status === "running" ? "paused" : room.autoSpeechState.status,
      nextTurnAt: null,
      lastReason: room.autoSpeechState.status === "running" ? "manual_pause" : room.autoSpeechState.lastReason,
      pendingFollowup: null,
    },
  };
}

function upsertRoom(rooms: RoomState[], room: RoomState): RoomState[] {
  const found = rooms.some((item) => item.id === room.id);
  if (!found) {
    return [...rooms, room];
  }
  return rooms.map((item) => (item.id === room.id ? room : item));
}

function uniqueRooms(rooms: RoomState[]): RoomState[] {
  const seen = new Set<string>();
  const result: RoomState[] = [];
  for (const room of rooms) {
    if (seen.has(room.id)) {
      continue;
    }
    seen.add(room.id);
    result.push(room);
  }
  return result;
}

function normalizeRoomTitle(value: string | undefined, fallback: string): string {
  const title = (value ?? "").trim().replace(/\s+/g, " ").slice(0, 48);
  return title || fallback || "Room";
}

function uniqueRoomTitle(rooms: RoomState[], value: string | undefined, fallback = defaultNewRoomTitle, excludeRoomId?: string): string {
  const base = normalizeRoomTitle(value, fallback);
  const existing = new Set(
    rooms
      .filter((room) => room.id !== excludeRoomId)
      .map((room) => room.title.trim().toLowerCase()),
  );
  if (!existing.has(base.toLowerCase())) {
    return base;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base} ${index}`;
    if (!existing.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  return `${base} ${Date.now()}`;
}

function uniqueRoomId(rooms: RoomState[], title: string): string {
  const base = slugifyRoomId(title || "room");
  const existing = new Set(rooms.map((room) => room.id));
  if (!existing.has(base)) {
    return base;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return `${base}-${Date.now()}`;
}

function uniqueRoomIdForPromptIsolation(rooms: RoomState[], prompts: PromptCenterState, title: string): string {
  const base = slugifyRoomId(title || "room");
  const freshBase = `${base}-${Date.now().toString(36)}`;
  const existing = new Set(rooms.map((room) => room.id));
  for (const id of roomIdsReferencedByPromptState(prompts)) {
    existing.add(id);
  }
  if (!existing.has(freshBase)) {
    return freshBase;
  }
  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${freshBase}-${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return `${freshBase}-${crypto.randomUUID().slice(0, 8)}`;
}

function roomIdsReferencedByPromptState(prompts: PromptCenterState): Set<string> {
  const ids = new Set<string>();
  for (const override of prompts.overrides) {
    const id = roomIdFromPromptEntry(override.scope, override.targetId);
    if (id) {
      ids.add(id);
    }
  }
  for (const draft of prompts.drafts) {
    const id = roomIdFromPromptEntry(draft.scope, draft.targetId);
    if (id) {
      ids.add(id);
    }
  }
  return ids;
}

function roomIdFromPromptEntry(scope: PromptScope, targetId: string): string | null {
  if (scope === "room" || scope === "director") {
    return roomIdFromPromptTarget(targetId, scope);
  }
  if (scope === "room_role") {
    const markerIndex = targetId.indexOf(":");
    return markerIndex > 0 ? targetId.slice(0, markerIndex) : null;
  }
  return null;
}

function slugifyRoomId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "room";
}

function resetAiAfterConfigChange(
  state: ConsoleAppState,
  patch: Partial<ConsoleAppState["ai"]>,
  message: string,
): ConsoleAppState {
  return {
    ...state,
    ai: {
      ...state.ai,
      ...patch,
      connectionStatus: "not_configured",
      lastTestMessage: message,
      lastTestedAt: null,
      lastErrorCode: null,
    },
  };
}

function normalizeEndpointPath(value: string): string {
  const text = value.trim();
  if (!text) {
    return "/";
  }
  return text.startsWith("/") ? text : `/${text}`;
}

function normalizeAiNumberField(field: "temperature" | "maxTokens" | "timeoutMs", value: number): number {
  if (field === "temperature") {
    return clampNumber(value, 0, 2, 0.7);
  }
  if (field === "maxTokens") {
    return Math.round(clampNumber(value, 128, 128_000, 900));
  }
  return Math.round(clampNumber(value, 5_000, 120_000, 20_000));
}

function createParticipant(
  packId: string,
  name: string,
  mood: string,
  id = packId,
  roomId = "demo-room",
  mode: RoomContextPanelMode = "casual",
): RoomParticipant {
  return {
    id,
    roleId: id,
    packId,
    displayName: name,
    name,
    mood,
    factionId: "neutral",
    identityCard: createDefaultIdentityCardForMode(mode),
    apiProfile: { ...defaultRoleApiProfile },
    memoryScope: roomRoleMemoryScope(roomId, id),
    currentEmotion: mood,
    viewportState: "idle",
  };
}

function createInitialRoomParticipants(packs: CharacterPackSummary[], roomId = "demo-room", mode: RoomContextPanelMode = "casual"): RoomParticipant[] {
  const firstPack = packs[0];
  if (!firstPack) {
    return [];
  }

  return [createParticipant(firstPack.id, firstPack.name, "idle", firstPack.id, roomId, mode)];
}

function createInitialRoomMessages(pack: CharacterPackSummary | null, roomId = "demo-room") {
  if (!pack) {
    return [];
  }

  return [
    {
      id: `${roomId}-welcome`,
      at: "20:42",
      speaker: pack.name,
      text: "The room only loads discovered character packs. Add more roles from the right controls.",
      kind: "character" as const,
      speakerType: "role" as const,
      speakerId: pack.id,
      target: "all" as const,
      mentions: [],
      scope: `room:${roomId}` as const,
      emotion: "idle",
    },
  ];
}

function reconcileRoomParticipants(
  participants: RoomParticipant[],
  packs: CharacterPackSummary[],
  roomId: string,
  mode: RoomContextPanelMode = "casual",
): RoomParticipant[] {
  const validPackIds = new Set(packs.map((pack) => pack.id));
  const nextParticipants = participants.filter((participant) => validPackIds.has(participant.packId));
  return nextParticipants.map((participant) => ({
    ...participant,
    factionId: participant.factionId ?? "neutral",
    identityCard: normalizeIdentityCard(participant.identityCard, mode),
    memoryScope: roomRoleMemoryScope(roomId, participant.id),
  }));
}

function identityCardsDefaultEnabled(mode: RoomContextPanelMode): boolean {
  return mode === "story" || mode === "mystery" || mode === "debate" || mode === "team";
}

function promptProfileIdentityMode(profileId: RoomState["promptProfileId"], activeChannelId: RoomState["activeChannelId"] = "public"): RoomContextPanelMode {
  if (activeChannelId.startsWith("faction:")) {
    return "team";
  }
  switch (profileId) {
    case "story":
    case "mystery":
    case "debate":
    case "study":
    case "planning":
      return profileId;
    default:
      return "casual";
  }
}

function createDefaultIdentityCardForMode(mode: RoomContextPanelMode, now = new Date().toISOString()): RoomIdentityCard {
  return {
    enabled: identityCardsDefaultEnabled(mode),
    publicTitle: "",
    publicRole: "",
    publicGoal: "",
    publicNotes: "",
    secretIdentity: "",
    secretGoal: "",
    privateKnowledge: "",
    revealCondition: "",
    updatedAt: now,
  };
}

function normalizeIdentityCard(card: RoomIdentityCard | undefined, mode: RoomContextPanelMode): RoomIdentityCard {
  const fallback = createDefaultIdentityCardForMode(mode);
  if (!card) {
    return fallback;
  }
  return {
    ...fallback,
    ...card,
    enabled: typeof card.enabled === "boolean" ? card.enabled : fallback.enabled,
    updatedAt: card.updatedAt || fallback.updatedAt,
  };
}

function roomRoleMemoryScope(roomId: string, roleId: string): RoomRoleMemoryScope {
  return `room:${roomId}:role:${roleId}`;
}

function nextParticipantId(participants: RoomParticipant[], packId: string): string {
  if (!participants.some((participant) => participant.id === packId)) {
    return packId;
  }

  let suffix = 2;
  let candidate = `${packId}-${suffix}`;
  while (participants.some((participant) => participant.id === candidate)) {
    suffix += 1;
    candidate = `${packId}-${suffix}`;
  }

  return candidate;
}

function roomApiSecretRef(roomId: string): string {
  return `room_${safeSecretSegment(roomId)}_api`;
}

function directorApiSecretRef(roomId: string): string {
  return `room_${safeSecretSegment(roomId)}_director_api`;
}

function roleApiSecretRef(roomId: string, roleId: string): string {
  return `room_${safeSecretSegment(roomId)}_role_${safeSecretSegment(roleId)}_api`;
}

function safeSecretSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32) || "default";
}

function statusForRoomApiMode(mode: RoomApiProfile["mode"], secretRef: string | null): RoomApiProfile["status"] {
  if (mode === "demo") {
    return "missing_key";
  }

  if (mode === "custom_room" && !secretRef) {
    return "missing_key";
  }

  return "ready";
}

function messageForRoomApiMode(mode: RoomApiProfile["mode"], secretRef: string | null): string {
  if (mode === "demo") {
    return "Room uses the bundled local chat model when it is ready.";
  }

  if (mode === "inherit_global") {
    return "Room API inherits the main AI setup and uses the bundled local model if the main setup is unavailable.";
  }

  return secretRef
    ? "Room API uses a room-specific setup. Test connection when ready."
    : "Room API needs a key. Without one, it uses the main API or bundled local model.";
}

function statusForDirectorApiMode(
  mode: RoomDirectorApiProfile["mode"],
  secretRef: string | null,
  state: ConsoleAppState,
): RoomDirectorApiProfile["status"] {
  if (mode === "demo") {
    return "missing_key";
  }

  if (mode === "custom_director" && !secretRef) {
    return "missing_key";
  }

  if (mode === "inherit_global" && state.ai.connectionStatus !== "ready") {
    return "missing_key";
  }

  if (mode === "use_room") {
    return state.room.apiProfile.status;
  }

  return "ready";
}

function messageForDirectorApiMode(mode: RoomDirectorApiProfile["mode"], secretRef: string | null): string {
  if (mode === "demo") {
    return "Director uses the bundled local chat model when it is ready.";
  }

  if (mode === "use_room") {
    return "Director follows the room default API, so it stays aligned with this room.";
  }

  if (mode === "inherit_global") {
    return "Director uses the main API setup and falls back to local rules if it is unavailable.";
  }

  return secretRef
    ? "Director uses its own API setup. Test connection when ready."
    : "Director needs a key before it can use its own API setup.";
}

function normalizeRoomApiProfile(profile: RoomApiProfile): RoomApiProfile {
  return {
    ...profile,
    generationMode: profile.generationMode ?? "inherit_global",
    temperature: clampNumber(profile.temperature, 0, 2, 0.7),
    maxTokens: Math.round(clampNumber(profile.maxTokens, 128, 4096, 900)),
  };
}

function normalizeDirectorApiProfile(profile: RoomDirectorApiProfile): RoomDirectorApiProfile {
  return {
    ...profile,
    generationMode: profile.generationMode ?? "inherit_global",
    generationOverrideEnabled: profile.generationOverrideEnabled ?? false,
    temperature: clampNumber(profile.temperature, 0, 2, 0.7),
    maxTokens: Math.round(clampNumber(profile.maxTokens, 128, 4096, 900)),
  };
}

function normalizeRoleApiProfile(profile: RoleApiProfile): RoleApiProfile {
  return {
    ...profile,
    generationOverrideEnabled: profile.generationOverrideEnabled ?? false,
    temperature: clampNumber(profile.temperature, 0, 2, 0.7),
    maxTokens: Math.round(clampNumber(profile.maxTokens, 128, 4096, 900)),
  };
}

function syncUseRoomRoleStatus(participants: RoomParticipant[], status: RoomApiProfile["status"]): RoomParticipant[] {
  return participants.map((participant) =>
    participant.apiProfile.mode === "use_room"
      ? {
          ...participant,
          apiProfile: {
            ...participant.apiProfile,
            status,
          },
        }
      : participant,
  );
}

function syncUseRoomDirectorStatus(director: RoomDirectorState, status: RoomApiProfile["status"]): RoomDirectorState {
  if (director.apiProfile.mode !== "use_room") {
    return director;
  }

  return {
    ...director,
    apiProfile: {
      ...director.apiProfile,
      status,
      lastTestMessage: "Director follows the room default API.",
    },
  };
}

function normalizeRoomUserDisplayName(value: string): string {
  const next = value.trim().replace(/\s+/g, " ").slice(0, 32);
  return next || defaultRoomUserProfile.displayName;
}

function appendRoomMessageWithReadState(room: RoomState, message: ConsoleMessage): RoomState {
  const messages = [...room.messages, message];
  const nextRoom = {
    ...room,
    messages,
    hiddenWhisperCount: countHiddenWhispers(messages),
  };
  const channelId = resolveMessageChannelIdForRead(message);
  return channelId === room.activeChannelId ? markRoomChannelRead(nextRoom, channelId, message.id, message.at) : nextRoom;
}

function markRoomChannelRead(room: RoomState, channelId: RoomActiveChannelId, messageId?: string, at?: string): RoomState {
  const normalizedChannelId = normalizeActiveChannelId(room, channelId);
  const markerMessageId = messageId ?? latestMessageIdForChannel(room, normalizedChannelId);
  return {
    ...room,
    channelReadState: {
      ...(room.channelReadState ?? {}),
      [normalizedChannelId]: {
        lastReadMessageId: markerMessageId,
        lastReadAt: at ?? new Date().toISOString(),
      },
    },
  };
}

function markAllRoomChannelsRead(room: RoomState, at?: string): RoomState {
  const channelIds: RoomActiveChannelId[] = ["public"];
  if (room.freedomLevel === "developer") {
    channelIds.push("director");
  }
  if (room.factionHuddles === "on") {
    for (const faction of room.factions) {
      if (faction.id !== "neutral") {
        channelIds.push(`faction:${faction.id}`);
      }
    }
  }
  for (const thread of room.privateThreads ?? []) {
    if (thread.status === "active" && isPrivateThreadVisibleToLocalUser(room, thread)) {
      channelIds.push(`private:${thread.id}`);
    }
  }
  return channelIds.reduce((nextRoom, channelId) => markRoomChannelRead(nextRoom, channelId, undefined, at), room);
}

function resolveMessageChannelIdForRead(message: ConsoleMessage): RoomActiveChannelId {
  if (message.channelId) {
    return message.channelId;
  }
  if (message.visibility === "director_channel") {
    return "director";
  }
  if (message.visibility === "faction_huddle" && message.factionId) {
    return `faction:${message.factionId}`;
  }
  return "public";
}

function latestMessageIdForChannel(room: RoomState, channelId: RoomActiveChannelId): string | undefined {
  for (let index = room.messages.length - 1; index >= 0; index -= 1) {
    const message = room.messages[index]!;
    if (resolveMessageChannelIdForRead(message) === channelId) {
      return message.id;
    }
  }
  return undefined;
}

function normalizeRoomPrivateThreads(room: RoomState, roomId: string): RoomPrivateThread[] {
  return (room.privateThreads ?? [])
    .map((thread) => {
      const memberTargets = normalizePrivateThreadTargets(room, thread.memberTargets ?? privateTargetsFromMemberIds(room, thread.memberIds));
      if (memberTargets.length === 0) {
        return null;
      }
      const title = `${thread.title ?? titleForPrivateThread(room, memberTargets)}`.trim() || titleForPrivateThread(room, memberTargets);
      return {
        ...thread,
        roomId,
        title,
        memberTargets,
        memberIds: memberTargets.map(privateThreadMemberKey),
        status: thread.status === "archived" ? "archived" : "active",
        createdAt: thread.createdAt ?? new Date().toISOString(),
        updatedAt: thread.updatedAt ?? thread.createdAt ?? new Date().toISOString(),
      } satisfies RoomPrivateThread;
    })
    .filter((thread): thread is RoomPrivateThread => Boolean(thread));
}

function createRoomPrivateThread(
  room: RoomState,
  targets: RoomMentionTarget[],
  title: string | undefined,
  createdBy: RoomPrivateThreadCreatedBy,
): RoomPrivateThread | null {
  const memberTargets = normalizePrivateThreadTargets(room, targets);
  if (memberTargets.length === 0) {
    return null;
  }
  const now = new Date().toISOString();
  const stableKey = memberTargets.map(privateThreadMemberKey).sort().join("-");
  const id = uniquePrivateThreadId(room, stableKey || now);
  return {
    id,
    roomId: room.id,
    title: title?.trim() || titleForPrivateThread(room, memberTargets),
    memberIds: memberTargets.map(privateThreadMemberKey),
    memberTargets,
    createdBy,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

function uniquePrivateThreadId(room: RoomState, seed: string): string {
  const base = `private-${seed.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 28) || Date.now().toString(36)}`;
  const existing = new Set((room.privateThreads ?? []).map((thread) => thread.id));
  if (!existing.has(base)) {
    return base;
  }
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${base}-${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }
  return `${base}-${Date.now().toString(36)}`;
}

function normalizePrivateThreadTargets(room: RoomState, targets: RoomMentionTarget[]): RoomMentionTarget[] {
  const seen = new Set<string>();
  const normalized: RoomMentionTarget[] = [];
  for (const target of targets) {
    const key = privateThreadMemberKey(target);
    if (seen.has(key)) {
      continue;
    }
    if (target.type === "role" && !room.participants.some((participant) => participant.id === target.roleId)) {
      continue;
    }
    if (target.type === "user" && target.userId !== room.userProfile.userId) {
      continue;
    }
    seen.add(key);
    normalized.push(target);
  }
  return normalized;
}

function privateTargetsFromMemberIds(room: RoomState, memberIds: string[] | undefined): RoomMentionTarget[] {
  return (memberIds ?? []).flatMap((memberId): RoomMentionTarget[] => {
    if (memberId === `user:${room.userProfile.userId}` || memberId === room.userProfile.userId) {
      return [{ type: "user", userId: room.userProfile.userId }];
    }
    if (memberId === "director:room-director" || memberId === "room-director") {
      return [{ type: "room_director", directorId: "room-director" }];
    }
    const roleId = memberId.replace(/^role:/, "");
    return room.participants.some((participant) => participant.id === roleId) ? [{ type: "role", roleId }] : [];
  });
}

function privateThreadMemberKey(target: RoomMentionTarget): string {
  if (target.type === "user") {
    return `user:${target.userId}`;
  }
  if (target.type === "room_director") {
    return `director:${target.directorId}`;
  }
  return `role:${target.roleId}`;
}

function titleForPrivateThread(room: RoomState, targets: RoomMentionTarget[]): string {
  return targets
    .map((target) => {
      if (target.type === "user") {
        return room.userProfile.displayName;
      }
      if (target.type === "room_director") {
        return room.director.displayName;
      }
      return room.participants.find((participant) => participant.id === target.roleId)?.name ?? target.roleId;
    })
    .join(", ");
}

function isPrivateThreadVisibleToLocalUser(room: RoomState, thread: RoomPrivateThread): boolean {
  return (
    room.freedomLevel === "developer" ||
    thread.memberTargets.some((target) => target.type === "user" && target.userId === room.userProfile.userId)
  );
}

function normalizeActiveChannelId(room: ConsoleAppState["room"], channelId: RoomActiveChannelId): RoomActiveChannelId {
  if (channelId === "public") {
    return "public";
  }

  if (channelId === "director") {
    return room.freedomLevel === "developer" ? "director" : "public";
  }

  if (channelId.startsWith("private:")) {
    const threadId = channelId.slice("private:".length);
    const thread = (room.privateThreads ?? []).find((item) => item.id === threadId && item.status === "active");
    return thread && isPrivateThreadVisibleToLocalUser(room, thread) ? (`private:${thread.id}` as const) : "public";
  }

  if (room.factionHuddles !== "on") {
    return "public";
  }

  const factionId = normalizeFactionId(channelId.replace(/^faction:/, ""));
  if (factionId === "neutral") {
    return "public";
  }

  const userFactionId = room.userProfile.factionId ?? "neutral";
  const hasFactionMember = room.participants.some((participant) => participant.factionId === factionId);
  if (room.freedomLevel === "developer") {
    return hasFactionMember || room.factions.some((faction) => faction.id === factionId) ? `faction:${factionId}` : "public";
  }
  return userFactionId === factionId && hasFactionMember ? `faction:${factionId}` : "public";
}

function normalizeFactionId(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 32) || "neutral";
}

function normalizeRoomFaction(faction: RoomFaction): RoomFaction {
  const fallback = defaultRoomFactions.find((item) => item.id === faction.id);
  const name = `${faction.name ?? fallback?.name ?? faction.id}`.trim() || fallback?.name || faction.id;
  return {
    id: normalizeFactionId(faction.id),
    name,
    color: /^#[0-9a-f]{6}$/i.test(faction.color ?? "") ? faction.color : fallback?.color ?? "#c7a7ff",
    description: `${faction.description ?? fallback?.description ?? ""}`.trim(),
    publicGoal: `${faction.publicGoal ?? ""}`.trim(),
    privateGoal: `${faction.privateGoal ?? ""}`.trim(),
  };
}

function normalizeRoomFactions(factions: RoomFaction[] | undefined): RoomFaction[] {
  const byId = new Map<string, RoomFaction>();
  byId.set("neutral", normalizeRoomFaction(defaultRoomFactions[0]));
  const source = factions?.length ? factions : defaultRoomFactions;
  for (const faction of source) {
    const normalized = normalizeRoomFaction(faction);
    byId.set(normalized.id, normalized.id === "neutral" ? { ...normalized, publicGoal: "", privateGoal: "" } : normalized);
  }
  return Array.from(byId.values());
}

function selectVividFactionColor(factions: RoomFaction[]): string {
  const normalizedFactions = normalizeRoomFactions(factions);
  const usedColors = new Set(normalizedFactions.map((faction) => faction.color.toLowerCase()));
  for (const color of vividFactionColorPalette) {
    if (!usedColors.has(color.toLowerCase())) {
      return color;
    }
  }

  const baseIndex = normalizedFactions.filter((faction) => faction.id !== "neutral").length;
  for (let offset = 0; offset < 72; offset += 1) {
    const hue = (baseIndex * 137.508 + offset * 29 + 12) % 360;
    const color = hslToHex(hue, 88, 58);
    if (!usedColors.has(color.toLowerCase())) {
      return color;
    }
  }
  return vividFactionColorPalette[baseIndex % vividFactionColorPalette.length];
}

function hslToHex(hue: number, saturationPercent: number, lightnessPercent: number): string {
  const saturation = saturationPercent / 100;
  const lightness = lightnessPercent / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const huePrime = hue / 60;
  const secondary = chroma * (1 - Math.abs((huePrime % 2) - 1));
  const match = lightness - chroma / 2;
  const [red, green, blue] =
    huePrime < 1
      ? [chroma, secondary, 0]
      : huePrime < 2
        ? [secondary, chroma, 0]
        : huePrime < 3
          ? [0, chroma, secondary]
          : huePrime < 4
            ? [0, secondary, chroma]
            : huePrime < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function createCustomRoomFaction(factions: RoomFaction[]): RoomFaction {
  const existing = new Set(normalizeRoomFactions(factions).map((faction) => faction.id));
  let id = "faction-1";
  for (let index = 1; existing.has(id); index += 1) {
    id = `faction-${index + 1}`;
  }
  return normalizeRoomFaction({
    id,
    name: "新阵营",
    color: selectVividFactionColor(factions),
    description: "",
    publicGoal: "",
    privateGoal: "",
  });
}

function ensureRoomFaction(factions: RoomFaction[], factionId: string): RoomFaction[] {
  const normalizedFactions = normalizeRoomFactions(factions);
  if (normalizedFactions.some((faction) => faction.id === factionId)) {
    return normalizedFactions;
  }

  const title = factionId
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
  return [
    ...normalizedFactions,
    {
      id: factionId,
      name: title || factionId,
      color: selectVividFactionColor(normalizedFactions),
      description: "Custom faction huddle group.",
      publicGoal: "",
      privateGoal: "",
    },
  ];
}

function dedupeMentionTargets(targets: RoomMentionTarget[]): RoomMentionTarget[] {
  const seen = new Set<string>();
  const result: RoomMentionTarget[] = [];
  for (const target of targets) {
    const key =
      target.type === "user"
        ? `user:${target.userId}`
        : target.type === "room_director"
          ? `director:${target.directorId}`
          : `role:${target.roleId}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(target);
  }
  return result;
}

function countHiddenWhispers(messages: Array<{ visibility?: string }>): number {
  return messages.filter((message) => message.visibility === "private_ai").length;
}

function roomRecipeConfig(recipeId: RoomRecipeId): {
  id: RoomRecipeId;
  name: string;
  promptProfileId: ConsoleAppState["room"]["promptProfileId"];
  directorProfileId: RoomDirectorState["profileId"];
  privateWhispers: "off" | "on";
  autoChat: boolean;
  defaultMood: string;
} {
  type RecipeConfig = {
    id: RoomRecipeId;
    name: string;
    promptProfileId: ConsoleAppState["room"]["promptProfileId"];
    directorProfileId: RoomDirectorState["profileId"];
    privateWhispers: "off" | "on";
    autoChat: boolean;
    defaultMood: string;
  };

  const recipes: Record<RoomRecipeId, RecipeConfig> = {
    casual: {
      id: "casual",
      name: "Casual Room",
      promptProfileId: "casual-chat",
      directorProfileId: "host",
      privateWhispers: "off",
      autoChat: false,
      defaultMood: "calm",
    },
    story: {
      id: "story",
      name: "Story Room",
      promptProfileId: "story",
      directorProfileId: "story-director",
      privateWhispers: "on",
      autoChat: false,
      defaultMood: "cinematic",
    },
    mystery: {
      id: "mystery",
      name: "Mystery Room",
      promptProfileId: "mystery",
      directorProfileId: "mystery-director",
      privateWhispers: "on",
      autoChat: false,
      defaultMood: "tense",
    },
    study: {
      id: "study",
      name: "Study Room",
      promptProfileId: "study",
      directorProfileId: "study-moderator",
      privateWhispers: "off",
      autoChat: false,
      defaultMood: "focused",
    },
    debate: {
      id: "debate",
      name: "Debate Room",
      promptProfileId: "debate",
      directorProfileId: "debate-referee",
      privateWhispers: "off",
      autoChat: false,
      defaultMood: "structured",
    },
    planning: {
      id: "planning",
      name: "Planning Room",
      promptProfileId: "planning",
      directorProfileId: "planning-facilitator",
      privateWhispers: "off",
      autoChat: false,
      defaultMood: "practical",
    },
  };

  return recipes[recipeId] ?? recipes.casual;
}

function simulationObjectiveForRecipe(recipeId: RoomRecipeId): ConsoleAppState["room"]["simulationObjective"] {
  if (recipeId === "story") {
    return "scene_play";
  }
  if (recipeId === "mystery") {
    return "mystery";
  }
  if (recipeId === "debate") {
    return "debate";
  }
  if (recipeId === "planning") {
    return "planning";
  }
  return "casual";
}

function simulationStyleForObjective(
  objective: ConsoleAppState["room"]["simulationObjective"],
): ConsoleAppState["room"]["simulation"]["style"] {
  if (objective === "debate" || objective === "team_channel") {
    return "match";
  }
  if (objective === "planning") {
    return "planning";
  }
  if (objective === "scene_play" || objective === "mystery") {
    return "story";
  }
  return "casual";
}

function simulationObjectiveForPrompt(
  profileId: ConsoleAppState["room"]["promptProfileId"],
  channelId: ConsoleAppState["room"]["activeChannelId"],
): ConsoleAppState["room"]["simulationObjective"] {
  if (channelId.startsWith("faction:")) {
    return "team_channel";
  }
  if (profileId === "story") {
    return "scene_play";
  }
  if (profileId === "mystery") {
    return "mystery";
  }
  if (profileId === "debate") {
    return "debate";
  }
  if (profileId === "planning") {
    return "planning";
  }
  return "casual";
}

function updatePromptOverride(
  state: ConsoleAppState,
  scope: PromptScope,
  targetId: string,
  title: string,
  text: string,
  _mode: "save" | "apply" | "saveAndApply",
): ConsoleAppState {
  const error = validatePromptText(text);
  if (error) {
    return {
      ...state,
      prompts: {
        ...state.prompts,
        activeEditorScope: scope,
        activeEditorTargetId: targetId,
        lastError: error,
        lastMessage: "Prompt was not saved.",
      },
    };
  }

  const nextRevision = state.prompts.revision + 1;
  const value = text.trim();
  const existing = state.prompts.overrides.find((override) => override.scope === scope && override.targetId === targetId);
  const savedText = value;
  const activeText = value;
  const enabled = true;
  const override: PromptOverride = {
    id: existing?.id ?? promptOverrideId(scope, targetId),
    scope,
    targetId,
    title,
    text: savedText,
    activeText,
    updatedAt: new Date().toISOString(),
    revision: nextRevision,
    appliedRevision: nextRevision,
    enabled,
  };

  const drafts = upsertPromptDraft(state.prompts.drafts, {
    scope,
    targetId,
    text: value,
    dirty: false,
    sourceRevision: nextRevision,
  });

  return {
    ...state,
    prompts: {
      ...state.prompts,
      revision: nextRevision,
      activeEditorScope: scope,
      activeEditorTargetId: targetId,
      overrides: upsertPromptOverride(state.prompts.overrides, override),
      drafts,
      lastMessage: `${title} saved. New replies will use it from the next turn.`,
      lastError: null,
    },
  };
}

function upsertPromptOverride(overrides: PromptOverride[], next: PromptOverride): PromptOverride[] {
  const found = overrides.some((override) => override.scope === next.scope && override.targetId === next.targetId);
  if (!found) {
    return [...overrides, next];
  }
  return overrides.map((override) => (override.scope === next.scope && override.targetId === next.targetId ? next : override));
}

function upsertPromptDraft(drafts: PromptDraft[], next: PromptDraft): PromptDraft[] {
  const found = drafts.some((draft) => draft.scope === next.scope && draft.targetId === next.targetId);
  if (!found) {
    return [...drafts, next];
  }
  return drafts.map((draft) => (draft.scope === next.scope && draft.targetId === next.targetId ? next : draft));
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function nextSetupStep(step: SetupStep): SetupStep {
  const index = setupSteps.indexOf(step);
  return setupSteps[Math.min(index + 1, setupSteps.length - 1)]!;
}

function previousSetupStep(step: SetupStep): SetupStep {
  const index = setupSteps.indexOf(step);
  return setupSteps[Math.max(index - 1, 0)]!;
}

function maskKey(value: string): string {
  const text = value.trim();
  if (!text) {
    return "";
  }

  if (text.length <= 8) {
    return "*".repeat(text.length);
  }

  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

function resolveActiveTtsBackend(preferred: VoiceBackend, aiReady: boolean): VoiceBackend {
  void aiReady;
  return preferred;
}
