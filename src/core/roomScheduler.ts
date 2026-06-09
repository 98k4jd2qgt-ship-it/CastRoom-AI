import type {
  ConsoleMessage,
  ContinuityWrite,
  DirectorOverrideLogEntry,
  DirectorOverrideRequest,
  DirectorScriptItem,
  DirectorScriptPatch,
  DirectorSourceVisibility,
  DirectorTickResult,
  DirectorStructuredOutcome,
  DirectorTurnPlan,
  JudgementCheck,
  JudgementDifficulty,
  JudgementOutcome,
  PlotArcState,
  PlotBeat,
  PlotHook,
  PlotPatch,
  RoomAddressing,
  ContinuationAssessment,
  RoomActiveChannelId,
  RoomAdvanceDecision,
  RoomAdvancePolicy,
  RoomBlockingNeed,
  RoomActionCheck,
  FactionStrategyState,
  RoomCollaborationPlan,
  RoomCollaborationTask,
  RoomCollaborationMode,
  RoomConstraint,
  RoomDebateSpeakerAssignment,
  RoomDebateSpeakerPosition,
  RoomDiscussionPlan,
  RoomDirectorMove,
  RoomDirectorPrivateDirective,
  RoomDirectorPublicTextReason,
  RoomDirectorMemorySnapshot,
  RoomDirectorScheduleResult,
  RoomFloorOwner,
  RoomFlowMode,
  RoomFreedomLevel,
  RoomFactionHuddleThread,
  RoomFramePatch,
  RoomFrameState,
  RoomKnowledgeVisibility,
  RoomIdentityCard,
  RoomMessageTarget,
  RoomParticipant,
  RoomPendingFollowup,
  RoomPlannedTurn,
  RoomPlannerResult,
  RoomResponseObligation,
  RoomFallbackAction,
  RoomEngagementDecision,
  RoomInputProcessedRecord,
  RoomShouldSpeakDecision,
  RoomInputIntent,
  RoomPlan,
  RoomPromptProfile,
  RoomPromptProfileId,
  SceneDelta,
  RoomSecretEntry,
  RoomScheduleReason,
  RoomScheduleResult,
  RoomSceneBoard,
  RoomSimulationPhase,
  RoomSimulationFocus,
  RoomSpeakerPolicySettings,
  RoomUncertaintyProfile,
  RoomSpeechDecision,
  RoomSpeechIntent,
  RoomState,
  RoomTerminationReason,
  RoomTurnPhase,
  RoomUserProfile,
  SimulationBeatPlan,
  SimulationBeatType,
  SimulationObjective,
  SimulationStyle,
  SituationAssessment,
  SituationAssessmentMode,
  SituationAssessmentSummary,
} from "./types";
import type { DirectorModeIntent } from "./directorModePolicy";
import {
  buildModeRoleTask as createModeRoleTurnGoal,
  directorMoveFromLegacyText,
  getDirectorModePolicy,
  resolveDirectorMode,
  resolveDirectorModeIntent,
} from "./directorModePolicy";
import {
  buildCollaborationPlanFromHuddle,
  buildFactionStrategyState,
  chooseCollaborationDirectiveParticipant,
  createFactionHuddleThread,
  getActiveRoomCollaborationTask,
  resolveCollaborationNeed,
  resolveRoomCollaborationMode,
} from "./roomCollaborationPolicy";
import {
  advanceDebateMatchAfterSpeaker,
  advanceDebateMatchAfterSkippedSpeaker,
  createDebateDirectorMatchPatch,
  createDebateDirectorVerdictOutcome,
  createDebateDirectorSetupText,
  createDebateTurnGoal,
  debateLifecyclePhase,
  debateMaterialStats,
  debateSpeakerPositionLabel,
  debateSpeakerRoleDescription,
  extractDebateMotion,
  isDebateAdvantageRequest,
  isDebateFinalVerdictDue,
  isDebateRoom,
  isDebateSetupRequest,
  isDebateVerdictRequest,
  isStrictDebateFlow,
  participantDebateSide,
  requiredDebateSpeakerAssignments,
  resolveNextDebateFlowStep,
  resolveNextDebateSpeakerAssignment,
  strictDebateFlowTurnTask,
} from "./debatePolicy";
import {
  getDirectorPromptProfile,
  getRoomAutoTimerDelayMs,
  getRoomDelayMs,
  getRoomDirectorProfile,
  getRoomPromptProfile,
} from "./roomProfiles";
import {
  canStartFactionHuddle,
  formatRoomTarget,
  getActiveRoomChannel,
  getChannelVisibleRoleIds,
  hasRoomDirectorMention,
  isTargetingDirector,
  isTargetingUser,
  mentionsFromTarget,
  parseRoomMentions,
  privateVisibleTargets,
  resolveMessageFactionId,
  resolveRoomInputVisibility,
  targetRoleIds,
} from "./roomVisibility";
import {
  applyDirectorOverride,
  evaluateAiDraftAgainstDirectorRules,
  evaluateRoomAction,
  isRoomAppSafetyText,
  parseDirectorOverrideRequest,
  resolveRoomFrameIntent,
  resolveRoomFrameInterpretation,
  validateDraftWithDirector,
  validateDraftWithDirectorRules,
} from "./roomRuleGuards";
export {
  advanceDebateMatchAfterSpeaker,
  advanceDebateMatchAfterSkippedSpeaker,
  createDebateDirectorMatchPatch,
  createDebateDirectorVerdictOutcome,
  createDebateDirectorSetupText,
  createDebateTurnGoal,
  debateSpeakerPositionLabel,
  debateSpeakerRoleDescription,
  describeDebateAssignment,
  extractDebateMotion,
  formatDebateAssignments,
  getDebateSpeakerAssignment,
  getDebateSides,
  isDebateAdvantageRequest,
  isDebateRoom,
  isDebateSetupRequest,
  isDebateVerdictRequest,
  isStrictDebateFlow,
  orderedDebateAssignments,
  participantDebateSide,
  resolveNextDebateFlowStep,
  resolveNextDebateSpeakerAssignment,
  strictDebateFlowTurnTask,
} from "./debatePolicy";
export {
  buildDirectorIdentityCardSummary,
  buildIdentityCardPromptBlock,
  buildModeInspectorState,
  buildModeRoleTask,
  classifyDirectorModeIntent,
  DIRECTOR_MODE_POLICIES,
  directorMoveFromLegacyText,
  getDefaultIdentityCardForMode,
  getDirectorModePolicy,
  resolveDirectorMode,
  resolveDirectorModeIntent,
  resolveVisibleIdentityCardForRole,
} from "./directorModePolicy";
export type {
  DirectorModeIntent,
  DirectorModeIntentKey,
  DirectorModeKey,
  DirectorModePolicy,
} from "./directorModePolicy";
export {
  buildCollaborationPlanFromHuddle,
  buildFactionStrategyState,
  chooseCollaborationDirectiveParticipant,
  createCollaborationTasksFromHuddle,
  createFactionHuddleThread,
  getActiveRoomCollaborationTask,
  resolveCollaborationNeed,
  resolveRoomCollaborationMode,
} from "./roomCollaborationPolicy";
export {
  directorPromptProfiles,
  getDirectorPromptProfile,
  getRoomAutoTimerDelayMs,
  getRoomDelayMs,
  getRoomDirectorProfile,
  getRoomPromptProfile,
  getRoomPromptProfileByInput,
  getRoomRecipe,
  getRoomRecipeByInput,
  roomDirectorProfiles,
  roomPromptProfiles,
  roomRecipes,
} from "./roomProfiles";
export {
  canStartFactionHuddle,
  deriveRoomChannels,
  factionIdFromChannel,
  filterRoomTimelineForChannel,
  filterRoomTimelineForUser,
  formatRoomTarget,
  getActiveRoomChannel,
  getChannelVisibleRoleIds,
  getVisibleContextForParticipant,
  hasRoomDirectorMention,
  isPrivateAiWhisper,
  isTargetingDirector,
  isTargetingUser,
  parseRoomMentions,
  recordVisibleObservations,
  applyReplyChannelDecisionToMessage,
  resolveFactionHuddleVisibility,
  resolveReplyChannelDecision,
  resolveMessageFactionId,
  resolveRoomInputVisibility,
  resolveRoomMessageVisibility,
  targetRoleIds,
  validateNoPrivateLeakToPublic,
} from "./roomVisibility";
export {
  applyDirectorOverride,
  evaluateAiDraftAgainstDirectorRules,
  evaluateRoomAction,
  parseDirectorOverrideRequest,
  resolveRoomFrameIntent,
  resolveRoomFrameInterpretation,
  validateDraftWithDirector,
  validateDraftWithDirectorRules,
} from "./roomRuleGuards";

export type RoomTurnTrigger = "user" | "auto";

export interface ScheduleRoomTurnInput {
  room: RoomState;
  trigger: RoomTurnTrigger;
  nowLabel: string;
  nowMs: number;
  userInput?: string;
  addressing?: RoomAddressing;
  memorySnippets?: string[];
  plannerResult?: RoomPlannerResult | null;
}

interface SimulationBeatCandidate {
  type: SimulationBeatType;
  novelty: number;
  risk: number;
  continuityCost: number;
  visibilityRisk: number;
  tensionDelta: number;
  weight: number;
  reason: string;
}

export function resolveRoomFlowMode(room: RoomState): RoomFlowMode {
  return isContinuousRoomFlow(room) ? "auto_simulation" : "player_reactive";
}

export function resolveSimulationObjective(room: RoomState): SimulationObjective {
  const activeChannel = getActiveRoomChannel(room);
  if (activeChannel.type === "faction") {
    return "team_channel";
  }
  if (room.promptProfileId === "debate" || room.director.recipeId === "debate") {
    return "debate";
  }
  if (room.promptProfileId === "planning" || room.director.recipeId === "planning") {
    return "planning";
  }
  if (room.promptProfileId === "mystery" || room.director.recipeId === "mystery") {
    return "mystery";
  }
  if (room.promptProfileId === "story" || room.director.recipeId === "story") {
    return "scene_play";
  }
  return "casual";
}

export function resolveSimulationStyle(room: RoomState): SimulationStyle {
  if (room.simulation?.style) {
    return room.simulation.style;
  }
  return simulationStyleForObjective(resolveSimulationObjective(room));
}

function simulationStyleForObjective(objective: SimulationObjective): SimulationStyle {
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

function nextSimulationPhase(phase: RoomSimulationPhase, beatType: SimulationBeatType): RoomSimulationPhase {
  if (beatType === "cooldown") {
    return "cooldown";
  }
  if (beatType === "director_judge" || beatType === "score_update") {
    return "payoff";
  }
  if (
    beatType === "director_twist" ||
    beatType === "role_action" ||
    beatType === "role_action_attempt" ||
    beatType === "role_challenge_claim" ||
    beatType === "role_reveal_known_fact" ||
    beatType === "role_hide_or_mislead"
  ) {
    return "conflict";
  }
  if (phase === "setup") {
    return "build";
  }
  return phase;
}

export function resolveRoomFreedomLevel(room: RoomState): RoomFreedomLevel {
  return room.freedomLevel ?? "balanced";
}

export function isDeveloperFreedomRoom(room: RoomState): boolean {
  return resolveRoomFreedomLevel(room) === "developer";
}

export function resolveSimulationFocus(room: RoomState, plan: RoomDiscussionPlan | null = room.activeDiscussionPlan): RoomSimulationFocus {
  const objective = resolveSimulationObjective(room);
  const currentTurn = plan?.status === "running" ? plan.turns[plan.activeTurnIndex] : undefined;
  return {
    objective,
    speakerId: currentTurn?.speakerId ?? null,
    target: currentTurn?.target ?? "all",
    goal: currentTurn?.goal ?? simulationGoalForObjective(objective),
  };
}

export function collectRoomTurnIntents(
  room: RoomState,
  trigger: RoomTurnTrigger,
  message?: ConsoleMessage,
  addressing?: RoomAddressing,
  userInput = "",
): RoomSpeechIntent[] {
  return collectRoomSpeechIntents(room, trigger, message, addressing, userInput);
}

export function classifyRoomInputIntent(
  input: string,
  addressing: RoomAddressing,
  room: RoomState,
): RoomInputIntent {
  if (isTargetingDirector(addressing.target)) {
    return "director_request";
  }

  if (targetRoleIds(addressing.target).length > 0) {
    return "direct_mention";
  }

  if (getActiveRoomChannel(room).type === "faction") {
    return "team_strategy";
  }

  if (isGroupOpinionInput(input)) {
    return room.promptProfileId === "debate" || room.director.recipeId === "debate" ? "debate_round" : "group_opinion";
  }

  if (room.promptProfileId === "debate" || room.director.recipeId === "debate") {
    return "debate_round";
  }

  return "single_reply";
}

export function createRuleBasedRoomPlan(input: {
  room: RoomState;
  trigger: RoomTurnTrigger;
  userInput?: string;
  addressing?: RoomAddressing;
  triggerMessageId?: string | null;
  nowIso?: string;
}): RoomPlannerResult {
  const addressing =
    input.addressing ?? parseRoomMentions(input.userInput ?? "", input.room.participants, input.room.userProfile, input.room.director);
  const intent =
    input.trigger === "auto" && resolveRoomFlowMode(input.room) === "auto_simulation"
      ? "auto_simulation"
      : classifyRoomInputIntent(input.userInput ?? "", addressing, input.room);
  const plannerMode = "rule" as const;
  const maxTurns = maxTurnsForIntent(intent, plannerMode);
  const simulationBeat =
    intent === "auto_simulation"
      ? createRuleSimulationBeatPlan({
          room: input.room,
          addressing,
          plannerMode,
        })
      : null;
  const turns = createRuleBasedPlannedTurns({
    room: input.room,
    trigger: input.trigger,
    intent,
    addressing,
    userInput: input.userInput ?? "",
    plannerMode,
    maxTurns,
    simulationBeat,
  });
  const plan =
    turns.length > 0
      ? createDiscussionPlan({
          room: input.room,
          intent,
          plannerMode,
          triggerMessageId: input.triggerMessageId ?? null,
          turns,
          maxTurns,
          stopAfterTurns: simulationBeat?.stopAfterBeat,
          nowIso: input.nowIso ?? new Date().toISOString(),
        })
      : null;
  return {
    mode: plannerMode,
    intent,
    plan,
    fallbackReason: plan ? undefined : "no_candidate",
  };
}

export function createCloudRoomPlan(room: RoomState, rawPlanText: string, fallback: RoomPlannerResult): RoomPlannerResult {
  const parsed = parseCloudPlannerJson(rawPlanText);
  if (!parsed) {
    return { ...fallback, fallbackReason: "cloud_json_invalid" };
  }

  const candidate: RoomDiscussionPlan = {
    id: `cloud-plan-${crypto.randomUUID()}`,
    plannerMode: "cloud",
    intent: parsed.intent,
    triggerMessageId: null,
    turns: parsed.turns.map((turn, index) => ({
      id: `cloud-turn-${index}-${crypto.randomUUID()}`,
      speakerType: turn.speakerId === room.director.directorId ? "director" : "role",
      speakerId: turn.speakerId,
      target: normalizePlannerTarget(turn.target, room),
      goal: trimForReply(turn.goal || "reply briefly", 160),
      maxWords: clampNumber(turn.maxWords, 20, 120, 60),
      source: "cloud",
      beatType: turn.beatType,
      expectedStateChange: turn.expectedStateChange ? trimForReply(turn.expectedStateChange, 120) : undefined,
      visibleToUser: turn.visibleToUser,
      stopAfterBeat: turn.stopAfterBeat,
    })),
    activeTurnIndex: 0,
    maxTurns: clampNumber(parsed.turns.length, 1, 3, 2),
    completedTurns: 0,
    stopAfterTurns: parsed.stopAfterTurns !== false,
    needsDirector: Boolean(parsed.needsDirector),
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastStopReason: null,
  };
  const validated = validateRoomPlan(candidate, room);
  return validated
    ? { mode: "cloud", intent: validated.intent, plan: validated }
    : { ...fallback, fallbackReason: "cloud_plan_invalid" };
}

export function createDirectorRoomPlan(input: {
  room: RoomState;
  trigger: RoomTurnTrigger;
  userInput?: string;
  addressing?: RoomAddressing;
  triggerMessageId?: string | null;
  nowIso?: string;
}): RoomPlannerResult {
  return createRuleDirectorPlan(input);
}

export function createRuleDirectorPlan(input: {
  room: RoomState;
  trigger: RoomTurnTrigger;
  userInput?: string;
  addressing?: RoomAddressing;
  triggerMessageId?: string | null;
  nowIso?: string;
}): RoomPlannerResult {
  return createRuleBasedRoomPlan(input);
}

export function createCloudDirectorPlan(room: RoomState, rawPlanText: string, fallback: RoomPlannerResult): RoomPlannerResult {
  return createCloudRoomPlan(room, rawPlanText, fallback);
}

export function validateDirectorRoomPlan(plan: RoomPlan | null, room: RoomState): RoomPlan | null {
  return validateRoomPlan(plan, room);
}

export function validateRoomPlan(plan: RoomDiscussionPlan | null, room: RoomState): RoomDiscussionPlan | null {
  if (!plan || plan.status !== "running") {
    return null;
  }

  const visibleRoleIds = new Set(getChannelVisibleRoleIds(room, room.activeChannelId));
  const validTurns = plan.turns
    .filter((turn) => {
      if (turn.speakerType === "director") {
        return room.director.enabled && turn.speakerId === room.director.directorId;
      }
      return room.participants.some((participant) => participant.id === turn.speakerId) && visibleRoleIds.has(turn.speakerId);
    })
    .slice(0, Math.max(1, Math.min(plan.maxTurns, 3)));

  if (validTurns.length === 0) {
    return null;
  }

  return {
    ...plan,
    turns: validTurns,
    maxTurns: validTurns.length,
    activeTurnIndex: Math.min(plan.activeTurnIndex, validTurns.length - 1),
    updatedAt: new Date().toISOString(),
  };
}

export function executeRoomPlannedTurn(
  turn: RoomPlannedTurn,
  room: RoomState,
  input: ScheduleRoomTurnInput,
  reason: RoomScheduleReason,
): RoomScheduleResult {
  const simulationBeat = simulationBeatFromTurn(turn, room);
  if (turn.speakerType === "director") {
    return {
      ...directorHandoff(reason, room, input.nowMs + getRoomDelayMs(room)),
      plannedTurn: turn,
      simulationBeat,
    };
  }

  const participant = room.participants.find((item) => item.id === turn.speakerId);
  if (!participant) {
    return stop("not_enough_roles", "blocked", room, null);
  }

  const profile = getRoomPromptProfile(room.promptProfileId);
  const emotion = inferRoomEmotion(turn.expectedStateChange ?? input.userInput ?? room.topic, profile.id);
  const target = turn.target;
  const speechIntent: RoomSpeechIntent = {
    roleId: participant.id,
    decision: "speak",
    target,
    delayMs: 0,
    priority: 100,
    reason: turn.goal,
    emotionHint: emotion,
    maxLength: turn.maxWords * 3,
  };
  const privateDirective = buildPrivateRoleDirective({
    room,
    participant,
    goal: turn.goal,
    target,
    reason: turn.beatType === "role_action_attempt" ? "role_action" : isDebateRoom(room) ? "debate_turn" : "mode_turn",
    sourceMove: "cue",
    maxLength: turn.maxWords * 3,
  });
  const observerRoleIds = room.participants
    .filter((item) => item.id !== participant.id && getChannelVisibleRoleIds(room, room.activeChannelId).includes(item.id))
    .map((item) => item.id);
  const consecutiveAutoTurns = input.trigger === "user" ? 0 : room.autoSpeechState.consecutiveAutoTurns + 1;
  const shouldContinueAuto = shouldContinueRoomAutoAfterBeat(room);
  const nextTurnAt = shouldContinueAuto ? input.nowMs + getRoomDelayMs(room) : null;

  return {
    type: "turn",
    reason,
    status: shouldContinueAuto ? "cooling_down" : "paused",
    nextTurnAt,
    consecutiveAutoTurns,
    userTriggeredFollowUps: room.autoSpeechState.userTriggeredFollowUps,
    participant,
    emotion,
    intent: turn.goal,
    target,
    speechIntent,
    plannedTurn: turn,
    simulationBeat,
    privateDirective,
    observerRoleIds,
    message: {
      id: crypto.randomUUID(),
      at: input.nowLabel,
      speaker: participant.name,
      text: createRoomText({
        room,
        participant,
        profile,
        topic: room.topic,
        userInput: input.userInput,
        memorySnippets: input.memorySnippets ?? [],
        reason,
        intent: turn.goal,
        target,
      }),
      kind: "character",
      speakerType: "role",
      speakerId: participant.id,
      scope: participant.memoryScope,
      emotion,
      target,
      mentions: mentionsFromTarget(target, room),
    },
  };
}

function simulationBeatFromTurn(turn: RoomPlannedTurn, room: RoomState): SimulationBeatPlan | undefined {
  if (!turn.beatType) {
    return undefined;
  }
  return {
    beatId: `beat-from-${turn.id}`,
    type: turn.beatType,
    channelId: room.activeChannelId,
    speakerId: turn.speakerId,
    target: turn.target,
    goal: turn.goal,
    expectedStateChange: turn.expectedStateChange ?? "new room progress",
    visibleToUser: turn.visibleToUser ?? true,
    maxWords: turn.maxWords,
    stopAfterBeat: turn.stopAfterBeat ?? false,
  };
}

export function terminateRoomPlan(plan: RoomDiscussionPlan | null, reason: RoomTerminationReason): RoomDiscussionPlan | null {
  if (!plan) {
    return null;
  }
  return {
    ...plan,
    status: reason === "model_unavailable" || reason === "repeated" ? "blocked" : "completed",
    lastStopReason: reason,
    updatedAt: new Date().toISOString(),
  };
}

function createDiscussionPlan(input: {
  room: RoomState;
  intent: RoomInputIntent;
  plannerMode: "rule" | "cloud";
  triggerMessageId: string | null;
  turns: RoomPlannedTurn[];
  maxTurns: number;
  stopAfterTurns?: boolean;
  nowIso: string;
}): RoomDiscussionPlan {
  return {
    id: `room-plan-${crypto.randomUUID()}`,
    plannerMode: input.plannerMode,
    intent: input.intent,
    triggerMessageId: input.triggerMessageId,
    turns: input.turns.slice(0, input.maxTurns),
    activeTurnIndex: 0,
    maxTurns: input.maxTurns,
    completedTurns: 0,
    stopAfterTurns: input.stopAfterTurns ?? true,
    needsDirector: input.intent === "director_request",
    status: "running",
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
    lastStopReason: null,
  };
}

function createRuleSimulationBeatPlan(input: {
  room: RoomState;
  addressing: RoomAddressing;
  plannerMode: "rule" | "cloud";
}): SimulationBeatPlan | null {
  const room = input.room;
  const visibleRoleIds = getChannelVisibleRoleIds(room, room.activeChannelId);
  if (visibleRoleIds.length === 0) {
    return null;
  }

  const style = resolveSimulationStyle(room);
  const beatIndex = room.simulation?.beatIndex ?? 0;
  const candidate = chooseSimulationBeatCandidate(room, style, beatIndex, visibleRoleIds);
  const beatType = candidate.type;
  if (beatType === "cooldown") {
    return {
      beatId: `beat-${beatIndex + 1}-${crypto.randomUUID()}`,
      type: beatType,
      channelId: room.activeChannelId,
      goal: simulationBeatGoal(room, beatType, style),
      expectedStateChange: simulationBeatExpectedChange(beatType, style),
      visibleToUser: true,
      maxWords: 0,
      stopAfterBeat: true,
      scoring: candidateScoring(candidate),
    };
  }
  const speakerId = beatType.startsWith("director_") || beatType === "score_update"
    ? room.director.directorId
    : chooseSimulationSpeakerId(room, visibleRoleIds, beatType);
  if (!speakerId) {
    return null;
  }
  const speaker = room.participants.find((participant) => participant.id === speakerId);
  const debateRoleGoal = isDebateRoom(room) && speaker && !beatType.startsWith("director_") && beatType !== "score_update"
    ? createDebateTurnGoal(room, speaker, 0)
    : null;

  return {
    beatId: `beat-${beatIndex + 1}-${crypto.randomUUID()}`,
    type: beatType,
    channelId: room.activeChannelId,
    speakerId,
    target: simulationBeatTarget(room, beatType, input.addressing),
    goal: debateRoleGoal ?? simulationBeatGoal(room, beatType, style),
    expectedStateChange: debateRoleGoal ?? simulationBeatExpectedChange(beatType, style),
    visibleToUser: room.activeChannelId === "public" || !beatType.startsWith("team_"),
    maxWords: beatType.startsWith("director_") || beatType === "score_update" ? 70 : 55,
    stopAfterBeat: false,
    scoring: candidateScoring(candidate),
  };
}

function plannedTurnsFromSimulationBeat(
  room: RoomState,
  beat: SimulationBeatPlan,
  plannerMode: "rule" | "cloud",
): RoomPlannedTurn[] {
  if (beat.type === "cooldown") {
    return [];
  }

  if (beat.speakerId === room.director.directorId || beat.type.startsWith("director_") || beat.type === "score_update") {
    if (!room.director.enabled) {
      return [];
    }
    return [
      {
        id: `director-beat-${crypto.randomUUID()}`,
        speakerType: "director",
        speakerId: room.director.directorId,
        target: beat.target ?? "all",
        goal: beat.goal,
        maxWords: beat.maxWords,
        source: plannerMode,
        beatType: beat.type,
        expectedStateChange: beat.expectedStateChange,
        visibleToUser: beat.visibleToUser,
        stopAfterBeat: beat.stopAfterBeat,
      },
    ];
  }

  const speakerId = beat.speakerId;
  if (!speakerId || !getChannelVisibleRoleIds(room, beat.channelId).includes(speakerId)) {
    return [];
  }

  return [
    {
      id: `role-beat-${speakerId}-${crypto.randomUUID()}`,
      speakerType: "role",
      speakerId,
      target: beat.target ?? "all",
      goal: beat.goal,
      maxWords: beat.maxWords,
      source: plannerMode,
      beatType: beat.type,
      expectedStateChange: beat.expectedStateChange,
      visibleToUser: beat.visibleToUser,
      stopAfterBeat: beat.stopAfterBeat,
    },
  ];
}

function chooseSimulationBeatCandidate(
  room: RoomState,
  style: SimulationStyle,
  beatIndex: number,
  visibleRoleIds: string[],
): SimulationBeatCandidate {
  if ((room.simulation?.noveltyScore ?? 100) <= 10) {
    return {
      type: "cooldown",
      novelty: 0,
      risk: 0,
      continuityCost: 0,
      visibilityRisk: 0,
      tensionDelta: -12,
      weight: 100,
      reason: "no recent novelty",
    };
  }

  const candidates = createSimulationBeatCandidates(room, style, beatIndex, visibleRoleIds)
    .map((candidate) => scoreSimulationBeatCandidate(candidate, room, style, beatIndex))
    .filter((candidate) => candidate.weight > 0 && candidate.visibilityRisk < 80 && candidate.continuityCost < 85);

  if (style === "match" && beatIndex % 4 === 2) {
    const scoreUpdate = candidates.find((candidate) => candidate.type === "score_update");
    if (scoreUpdate) {
      return scoreUpdate;
    }
  }

  if (candidates.length === 0) {
    return {
      type: "cooldown",
      novelty: 0,
      risk: 0,
      continuityCost: 0,
      visibilityRisk: 0,
      tensionDelta: -12,
      weight: 100,
      reason: "no legal beat candidate",
    };
  }

  return weightedPickSimulationBeat(candidates, `${room.id}:${style}:${beatIndex}:${room.simulation?.lastBeatType ?? "none"}`);
}

function createSimulationBeatCandidates(
  room: RoomState,
  style: SimulationStyle,
  beatIndex: number,
  visibleRoleIds: string[],
): SimulationBeatCandidate[] {
  const directorAllowed = room.director.enabled;
  const factionChannel = room.activeChannelId.startsWith("faction:");
  const hasVisibleRoles = visibleRoleIds.length > 0;
  const storyForeshadowed = hasTwistForeshadowing(room);
  const candidates: SimulationBeatCandidate[] = [];
  const add = (
    type: SimulationBeatType,
    weight: number,
    novelty: number,
    risk: number,
    continuityCost: number,
    visibilityRisk: number,
    tensionDelta: number,
    reason: string,
  ) => {
    if (!hasVisibleRoles && !type.startsWith("director_") && type !== "score_update" && type !== "cooldown") {
      return;
    }
    if (!directorAllowed && (type.startsWith("director_") || type === "score_update")) {
      return;
    }
    if (type === "team_channel" && !factionChannel) {
      return;
    }
    if (type === "director_twist" && !storyForeshadowed && beatIndex < 2) {
      return;
    }
    candidates.push({ type, weight, novelty, risk, continuityCost, visibilityRisk, tensionDelta, reason });
  };

  if (style === "match") {
    add("role_speak", 38, 45, 20, 5, 5, 2, "advance a side argument");
    add("role_action", 24, 60, 35, 20, 10, 6, "make a concrete move in the match");
    add("role_challenge_claim", 32, 58, 25, 8, 8, 5, "challenge an unsupported claim or weak argument");
    add("role_reveal_known_fact", 18, 55, 18, 10, 12, 4, "reveal one already-visible fact to shift the debate");
    add("score_update", beatIndex % 4 === 2 ? 95 : 28, 55, 20, 5, 5, -2, "update advantage or score");
    add("director_judge", 20, 50, 25, 10, 5, 1, "judge a contested claim");
    return candidates;
  }

  if (style === "planning") {
    add("role_speak", 34, 40, 10, 5, 5, 1, "add a practical perspective");
    add("role_action", 36, 58, 25, 15, 5, 4, "turn talk into a concrete task");
    add("role_challenge_claim", 22, 48, 16, 8, 5, 2, "question an unsupported assumption before planning around it");
    add("role_action_attempt", 24, 52, 22, 12, 5, 3, "try one practical step that may need consequences");
    add("director_judge", 22, 45, 20, 10, 5, 0, "judge tradeoffs and constraints");
    add("scene_shift", 16, 48, 15, 8, 5, -2, "move to the next planning phase");
    return candidates;
  }

  if (style === "story") {
    const mysteryObjective = resolveSimulationObjective(room) === "mystery";
    add("role_action", 38, 65, 35, 20, 10, 7, "let a role try something visible");
    add("role_action_attempt", 34, 64, 36, 22, 10, 7, "let a role attempt an action without declaring it automatically succeeds");
    add("role_challenge_claim", 30, 58, 18, 8, 8, 4, "let a role doubt a claim using visible context");
    add("role_reveal_known_fact", mysteryObjective ? 20 : 14, 58, 18, 12, 16, 5, "let a role reveal only what they already know");
    add("role_hide_or_mislead", mysteryObjective ? 18 : 10, 62, 32, 18, 20, 8, "let a role hide, deflect, or mislead within their own knowledge");
    add("role_speak", 24, 38, 10, 5, 5, 1, "show a reaction without centering the user");
    add("director_cue", mysteryObjective ? 42 : 30, 62, 20, 8, 10, 4, "surface a clue or pressure");
    add("director_judge", 20, 55, 30, 10, 8, 3, "turn uncertainty into a ruling");
    add("director_twist", mysteryObjective ? 12 : 24, 70, 55, storyForeshadowed ? 35 : 82, 12, 12, "complicate an existing hook");
    add("scene_shift", 18, 58, 25, 18, 8, -3, "move the scene to a new phase");
    return candidates;
  }

  add("role_speak", 45, 35, 5, 3, 3, 1, "keep natural interaction alive");
  add("role_action", 18, 45, 20, 12, 5, 3, "add a small concrete action");
  add("role_challenge_claim", 18, 45, 12, 5, 5, 2, "let a role gently question a doubtful claim");
  add("director_cue", 10, 45, 12, 5, 5, 1, "offer a light prompt if the room stalls");
  return candidates;
}

function scoreSimulationBeatCandidate(
  candidate: SimulationBeatCandidate,
  room: RoomState,
  style: SimulationStyle,
  beatIndex: number,
): SimulationBeatCandidate {
  const profile = room.simulation?.uncertaintyProfile ?? "balanced";
  const phase = room.simulation?.phase ?? "setup";
  const lastBeatType = room.simulation?.lastBeatType;
  let weight = candidate.weight;
  let continuityCost = candidate.continuityCost;
  let risk = candidate.risk;
  let reason = candidate.reason;

  if (lastBeatType === candidate.type) {
    weight *= 0.35;
    reason += "; reduced because the last beat used the same move";
  }

  if (phase === "setup") {
    if (candidate.type === "director_twist") weight *= 0.35;
    if (candidate.type === "director_cue" || candidate.type === "role_speak") weight *= 1.25;
  } else if (phase === "conflict") {
    if (candidate.type === "director_judge" || candidate.type === "director_twist" || isFactChangingRoleBeat(candidate.type)) weight *= 1.25;
  } else if (phase === "payoff") {
    if (candidate.type === "scene_shift" || candidate.type === "director_judge" || candidate.type === "score_update") weight *= 1.25;
  } else if (phase === "cooldown") {
    if (candidate.type === "role_speak" || candidate.type === "director_cue") weight *= 1.2;
    if (candidate.type === "director_twist") weight *= 0.3;
  }

  if (profile === "stable") {
    if (candidate.type === "director_twist" || candidate.type === "director_judge" || isFactChangingRoleBeat(candidate.type)) weight *= 0.55;
    if (candidate.type === "role_speak" || candidate.type === "scene_shift") weight *= 1.2;
    risk = Math.max(0, risk - 10);
  } else if (profile === "volatile") {
    if (candidate.type === "director_twist" || candidate.type === "director_judge" || isFactChangingRoleBeat(candidate.type)) weight *= 1.45;
    risk += 10;
  } else if (profile === "mystery") {
    if (candidate.type === "director_cue" || candidate.type === "director_judge" || candidate.type === "scene_shift") weight *= 1.45;
    if (candidate.type === "director_twist") weight *= 0.75;
  }

  const tension = room.simulation?.tension ?? 20;
  if (tension >= 75) {
    if (candidate.type === "director_twist" || isFactChangingRoleBeat(candidate.type)) weight *= 0.6;
    if (candidate.type === "director_judge" || candidate.type === "scene_shift" || candidate.type === "score_update") weight *= 1.35;
  } else if (tension <= 25) {
    if (isFactChangingRoleBeat(candidate.type) || candidate.type === "director_cue") weight *= 1.2;
    if (candidate.type === "director_twist" && beatIndex >= 2) weight *= 1.1;
  }

  if (candidate.type === "director_twist" && !hasTwistForeshadowing(room)) {
    continuityCost += 20;
    reason += "; twist needs a prior clue or unresolved hook";
  }

  if (style === "casual" && candidate.risk >= 40) {
    weight *= 0.45;
  }

  return {
    ...candidate,
    risk,
    continuityCost,
    weight: Math.max(0, Math.round(weight)),
    reason,
  };
}

function weightedPickSimulationBeat(candidates: SimulationBeatCandidate[], seedText: string): SimulationBeatCandidate {
  const total = candidates.reduce((sum, candidate) => sum + candidate.weight, 0);
  if (total <= 0) {
    return candidates.reduce((best, candidate) => (candidate.novelty > best.novelty ? candidate : best), candidates[0]);
  }
  const threshold = seededUnit(seedText) * total;
  let cursor = 0;
  for (const candidate of candidates) {
    cursor += candidate.weight;
    if (cursor >= threshold) {
      return candidate;
    }
  }
  return candidates[candidates.length - 1];
}

function seededUnit(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function candidateScoring(candidate: SimulationBeatCandidate): NonNullable<SimulationBeatPlan["scoring"]> {
  return {
    novelty: candidate.novelty,
    risk: candidate.risk,
    continuityCost: candidate.continuityCost,
    visibilityRisk: candidate.visibilityRisk,
    tensionDelta: candidate.tensionDelta,
    weight: candidate.weight,
    reason: candidate.reason,
  };
}

function hasTwistForeshadowing(room: RoomState): boolean {
  return (
    (room.director.sceneBoard.openClues ?? []).length > 0 ||
    (room.director.sceneBoard.unresolved ?? []).length > 0 ||
    (room.director.overrideLog ?? []).length > 0 ||
    Boolean(room.simulation?.currentFocus && !/waiting|等待/i.test(room.simulation.currentFocus))
  );
}

function isFactChangingRoleBeat(beatType: SimulationBeatType): boolean {
  return (
    beatType === "role_action" ||
    beatType === "role_action_attempt" ||
    beatType === "role_challenge_claim" ||
    beatType === "role_reveal_known_fact" ||
    beatType === "role_hide_or_mislead"
  );
}

function chooseSimulationSpeakerId(
  room: RoomState,
  visibleRoleIds: string[],
  beatType: SimulationBeatType,
): string | undefined {
  if (isDebateRoom(room) && !beatType.startsWith("director_") && beatType !== "score_update") {
    return resolveNextDebateSpeakerAssignment(room, visibleRoleIds)?.roleId;
  }

  const recentSpeakerIds = new Set([...(room.simulation?.lastSpeakerIds ?? []), room.lastSpeakerId].filter(Boolean));
  const visibleParticipants = room.participants.filter((participant) => visibleRoleIds.includes(participant.id));
  const factionPreferred =
    beatType === "team_channel"
      ? visibleParticipants.filter((participant) => participant.factionId && participant.factionId !== "neutral")
      : visibleParticipants;
  const pool = factionPreferred.length > 0 ? factionPreferred : visibleParticipants;
  const fresh = pool.find((participant) => !recentSpeakerIds.has(participant.id));
  return (fresh ?? pool[0])?.id;
}

function simulationBeatTarget(
  room: RoomState,
  beatType: SimulationBeatType,
  addressing: RoomAddressing,
): RoomMessageTarget {
  if (beatType.startsWith("director_") || beatType === "score_update") {
    return "all";
  }
  if (beatType === "team_channel" && room.activeChannelId.startsWith("faction:")) {
    return "all";
  }
  return addressing.target === "all" ? "all" : addressing.target;
}

function simulationBeatGoal(room: RoomState, beatType: SimulationBeatType, style: SimulationStyle): string {
  const objective = resolveSimulationObjective(room);
  const base = simulationGoalForObjective(objective);
  const goals: Record<SimulationBeatType, string> = {
    role_speak: `${base}; add one new stance or reaction, not a reply to the user`,
    role_action: `${base}; attempt one concrete action that can change the room state`,
    role_action_attempt: `${base}; attempt one concrete action without declaring it automatically succeeds`,
    role_challenge_claim: `${base}; question an unsupported claim in character using visible evidence`,
    role_reveal_known_fact: `${base}; reveal only one fact this role can already know`,
    role_hide_or_mislead: `${base}; hide, deflect, or mislead only within this role's visible knowledge`,
    director_judge: "judge the latest action briefly; success, cost, or failure must all move the room forward",
    director_cue: "drop one clue or pressure prompt without exposing hidden secrets",
    director_twist: "complicate an existing clue or unresolved hook without rewriting established facts",
    team_channel: "coordinate one same-team strategy point inside the current channel",
    score_update: "summarize the round advantage or score in one short judge note",
    scene_shift: "move the scene to the next phase with one visible consequence",
    cooldown: "pause because the room needs a new direction",
  };
  return `${goals[beatType]} (${style} autoplay)`;
}

function simulationBeatExpectedChange(beatType: SimulationBeatType, style: SimulationStyle): string {
  const changes: Record<SimulationBeatType, string> = {
    role_speak: "new stance",
    role_action: "new action",
    role_action_attempt: "attempted action",
    role_challenge_claim: "contested claim",
    role_reveal_known_fact: "revealed known fact",
    role_hide_or_mislead: "withheld or distorted information",
    director_judge: "new judgement",
    director_cue: "new clue",
    director_twist: "new conflict",
    team_channel: "new team strategy",
    score_update: "new score or advantage",
    scene_shift: "new scene state",
    cooldown: "no visible message",
  };
  return `${changes[beatType]} for ${style}`;
}

function createRuleBasedPlannedTurns(input: {
  room: RoomState;
  trigger: RoomTurnTrigger;
  intent: RoomInputIntent;
  addressing: RoomAddressing;
  userInput: string;
  plannerMode: "rule" | "cloud";
  maxTurns: number;
  simulationBeat?: SimulationBeatPlan | null;
}): RoomPlannedTurn[] {
  if (input.intent === "auto_simulation" && input.simulationBeat) {
    return plannedTurnsFromSimulationBeat(input.room, input.simulationBeat, input.plannerMode);
  }

  if (input.intent === "director_request") {
    return [
      {
        id: `director-turn-${crypto.randomUUID()}`,
        speakerType: "director",
        speakerId: input.room.director.directorId,
        target: { targets: [{ type: "user", userId: input.room.userProfile.userId }] },
        goal: "summarize, judge, or update the room condition",
        maxWords: 80,
        source: input.plannerMode,
      },
    ];
  }

  const intents = collectRoomSpeechIntents(input.room, input.trigger, latestPublicRoomMessage(input.room), input.addressing, input.userInput);
  const selectedRoleIds = selectPlannedSpeakerIds(input.room, intents, input.intent, input.maxTurns);
  return selectedRoleIds.map((roleId, index) => {
    const participant = input.room.participants.find((item) => item.id === roleId)!;
    return {
      id: `role-turn-${roleId}-${index}-${crypto.randomUUID()}`,
      speakerType: "role",
      speakerId: roleId,
      target: plannedTurnTarget(input.room, input.intent, input.addressing, index),
      goal: plannedTurnGoal(input.intent, participant, index, input.room),
      maxWords: input.intent === "debate_round" ? 90 : 70,
      source: input.plannerMode,
    };
  });
}

function selectPlannedSpeakerIds(
  room: RoomState,
  intents: RoomSpeechIntent[],
  intent: RoomInputIntent,
  maxTurns: number,
): string[] {
  const visibleRoleIds = new Set(getChannelVisibleRoleIds(room, room.activeChannelId));
  const directRoleIds = intents.filter((item) => item.decision === "speak" && item.priority >= 90).map((item) => item.roleId);
  if (intent === "direct_mention" && directRoleIds.length > 0) {
    return directRoleIds.filter((roleId) => visibleRoleIds.has(roleId)).slice(0, Math.min(maxTurns, 3));
  }

  const ranked = intents
    .filter((intentItem) => visibleRoleIds.has(intentItem.roleId))
    .filter((intentItem) => intentItem.decision === "speak" || intentItem.decision === "listen" || intentItem.decision === "defer")
    .sort((left, right) => right.priority - left.priority);

  if (intent === "debate_round") {
    const nextDebater = resolveNextDebateSpeakerAssignment(room, Array.from(visibleRoleIds));
    return nextDebater ? [nextDebater.roleId] : pickDiverseFactionSpeakers(room, ranked, 1);
  }

  return ranked
    .filter((item) => item.roleId !== room.lastSpeakerId || ranked.length === 1)
    .map((item) => item.roleId)
    .filter((roleId, index, all) => all.indexOf(roleId) === index)
    .slice(0, maxTurns);
}

function pickDiverseFactionSpeakers(room: RoomState, ranked: RoomSpeechIntent[], maxTurns: number): string[] {
  const picked: string[] = [];
  const usedFactions = new Set<string>();
  for (const intent of ranked) {
    const factionId = room.participants.find((participant) => participant.id === intent.roleId)?.factionId ?? "neutral";
    if (usedFactions.has(factionId) && picked.length < ranked.length - 1) {
      continue;
    }
    picked.push(intent.roleId);
    usedFactions.add(factionId);
    if (picked.length >= maxTurns) {
      break;
    }
  }
  return picked.length > 0 ? picked : ranked.slice(0, maxTurns).map((intent) => intent.roleId);
}

function plannedTurnTarget(
  room: RoomState,
  intent: RoomInputIntent,
  addressing: RoomAddressing,
  index: number,
): RoomMessageTarget {
  if (intent === "direct_mention") {
    return { targets: [{ type: "user", userId: room.userProfile.userId }] };
  }
  if (intent === "group_opinion" || intent === "debate_round") {
    return "all";
  }
  if (intent === "auto_simulation" || intent === "team_strategy") {
    return "all";
  }
  return addressing.target;
}

function plannedTurnGoal(intent: RoomInputIntent, participant: RoomParticipant, index: number, room: RoomState): string {
  if (intent === "direct_mention") {
    return `${participant.name} was publicly mentioned by the user. Answer the user's question or request first, directly and briefly, then add only one room-relevant note if useful. Do not use @mentions.`;
  }
  if (intent === "group_opinion") {
    return createModeRoleTurnGoal(room, participant, index, intent);
  }
  if (intent === "debate_round") {
    return strictDebateFlowTurnTask(room, participant, room.match.debateFlow?.language ?? "en") ?? createDebateTurnGoal(room, participant, index);
  }
  if (intent === "team_strategy") {
    return createModeRoleTurnGoal(room, participant, index, intent);
  }
  if (intent === "auto_simulation") {
    return `${simulationGoalForObjective(resolveSimulationObjective(room))}; ${participant.name} should move the room forward without centering the user`;
  }
  return createModeRoleTurnGoal(room, participant, index, intent);
}

export function buildPrivateRoleDirective(input: {
  room: RoomState;
  participant: RoomParticipant;
  goal?: string;
  target?: RoomMessageTarget;
  reason?: RoomDirectorPrivateDirective["reason"];
  sourceMove?: RoomDirectorMove;
  maxLength?: number;
}): RoomDirectorPrivateDirective {
  const mode = getDirectorModePolicy(input.room).mode;
  const goal =
    input.goal ??
    (mode === "debate"
      ? strictDebateFlowTurnTask(input.room, input.participant, input.room.match.debateFlow?.language ?? "en") ??
        createDebateTurnGoal(input.room, input.participant, 0)
      : createModeRoleTurnGoal(input.room, input.participant, 0, "single_reply"));
  return {
    roleId: input.participant.id,
    task: trimForReply(goal, 220),
    target: input.target,
    maxLength: input.maxLength ?? (mode === "debate" ? 260 : 180),
    reason: input.reason ?? (mode === "debate" ? "debate_turn" : "mode_turn"),
    sourceMove: input.sourceMove,
    visibleToRoleIds: [input.participant.id],
    createdAt: new Date().toISOString(),
  };
}

function maxTurnsForIntent(intent: RoomInputIntent, plannerMode: "rule" | "cloud"): number {
  if (intent === "direct_mention") {
    return 3;
  }
  if (intent === "group_opinion" || intent === "debate_round") {
    return plannerMode === "cloud" ? 3 : 2;
  }
  if (intent === "auto_simulation") {
    return 1;
  }
  return 1;
}

function simulationGoalForObjective(objective: SimulationObjective): string {
  const goals: Record<SimulationObjective, string> = {
    casual: "create a natural room exchange with a small new angle",
    scene_play: "attempt one scene action or reaction with a visible consequence",
    mystery: "advance one clue, doubt, or unresolved question without revealing hidden secrets",
    debate: "advance one argument, rebuttal, or position shift",
    planning: "advance one task, risk, decision, or owner",
    team_channel: "coordinate one private team strategy point",
  };
  return goals[objective];
}

function isGroupOpinionInput(input: string): boolean {
  return /(?:你们怎么看|大家怎么看|大家说说|都说说|每个人说|所有人说|一起讨论|你们都来|what do you all think|everyone'?s opinion|each of you|all of you|everyone weigh in)/i.test(input);
}

function parseCloudPlannerJson(raw: string):
  | {
      intent: RoomInputIntent;
      turns: Array<{
        speakerId: string;
        target?: string;
        goal?: string;
        maxWords?: number;
        beatType?: SimulationBeatType;
        expectedStateChange?: string;
        visibleToUser?: boolean;
        stopAfterBeat?: boolean;
      }>;
      stopAfterTurns?: boolean;
      needsDirector?: boolean;
    }
  | null {
  try {
    const jsonText = extractPlannerJsonObject(raw);
    if (!jsonText) {
      return null;
    }
    const parsed = JSON.parse(jsonText);
    if (!isRoomInputIntent(parsed.intent) || !Array.isArray(parsed.turns)) {
      return null;
    }
    return {
      intent: parsed.intent,
      turns: parsed.turns
        .filter((turn: unknown): turn is {
          speakerId: string;
          target?: string;
          goal?: string;
          maxWords?: number;
          beatType?: SimulationBeatType;
          expectedStateChange?: string;
          visibleToUser?: boolean;
          stopAfterBeat?: boolean;
        } =>
          Boolean(turn && typeof turn === "object" && typeof (turn as { speakerId?: unknown }).speakerId === "string"),
        )
        .map((turn: {
          speakerId: string;
          target?: string;
          goal?: string;
          maxWords?: number;
          beatType?: unknown;
          expectedStateChange?: unknown;
          visibleToUser?: unknown;
          stopAfterBeat?: unknown;
        }) => ({
          ...turn,
          beatType: isSimulationBeatType(turn.beatType) ? turn.beatType : undefined,
          expectedStateChange: typeof turn.expectedStateChange === "string" ? turn.expectedStateChange : undefined,
          visibleToUser: typeof turn.visibleToUser === "boolean" ? turn.visibleToUser : undefined,
          stopAfterBeat: typeof turn.stopAfterBeat === "boolean" ? turn.stopAfterBeat : undefined,
        }))
        .slice(0, 3),
      stopAfterTurns: parsed.stopAfterTurns,
      needsDirector: parsed.needsDirector,
    };
  } catch {
    return null;
  }
}

function extractPlannerJsonObject(raw: string): string | null {
  const cleaned = raw.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  if (cleaned.startsWith("{") && cleaned.endsWith("}")) {
    return cleaned;
  }
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return start >= 0 && end > start ? cleaned.slice(start, end + 1) : null;
}

function isRoomInputIntent(value: unknown): value is RoomInputIntent {
  return (
    value === "single_reply" ||
    value === "group_opinion" ||
    value === "direct_mention" ||
    value === "director_request" ||
    value === "debate_round" ||
    value === "team_strategy" ||
    value === "auto_simulation"
  );
}

function isSimulationBeatType(value: unknown): value is SimulationBeatType {
  return (
    value === "role_speak" ||
    value === "role_action" ||
    value === "role_action_attempt" ||
    value === "role_challenge_claim" ||
    value === "role_reveal_known_fact" ||
    value === "role_hide_or_mislead" ||
    value === "director_judge" ||
    value === "director_cue" ||
    value === "director_twist" ||
    value === "team_channel" ||
    value === "score_update" ||
    value === "scene_shift" ||
    value === "cooldown"
  );
}

function normalizePlannerTarget(value: string | undefined, room: RoomState): RoomMessageTarget {
  if (!value || value.toLowerCase() === "user") {
    return { targets: [{ type: "user", userId: room.userProfile.userId }] };
  }
  if (value.toLowerCase() === "all") {
    return "all";
  }
  const role = room.participants.find((participant) => participant.id === value || participant.name === value);
  return role ? { targets: [{ type: "role", roleId: role.id }] } : "all";
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function selectRoomFloorOwner(intents: RoomSpeechIntent[], room: RoomState): RoomFloorOwner {
  const selected = selectRoomSpeechTurn(intents, room);
  if (!selected) {
    return { type: "none" };
  }

  if (selected.decision === "ask_director") {
    return { type: "director", directorId: room.director.directorId };
  }

  if (selected.decision === "start_huddle") {
    const participant = room.participants.find((item) => item.id === selected.roleId);
    return participant?.factionId && participant.factionId !== "neutral"
      ? { type: "channel", channelId: `faction:${participant.factionId}` }
      : { type: "none" };
  }

  return selected.decision === "speak" ? { type: "role", roleId: selected.roleId } : { type: "none" };
}

export function advanceRoomFlowState(
  result: RoomScheduleResult,
  room: RoomState,
): {
  mode: RoomCollaborationMode;
  floorOwner: RoomFloorOwner;
  phase: RoomTurnPhase;
  terminationReason: RoomTerminationReason | null;
} {
  const mode = resolveRoomCollaborationMode(room);
  const floorOwner = floorOwnerFromScheduleResult(result, room);
  const terminationReason = terminationReasonFromScheduleResult(result);
  return {
    mode,
    floorOwner,
    phase: result.type === "turn" || result.type === "huddle" ? "draft" : "wait",
    terminationReason,
  };
}

export function commitRoomTurnResult(result: RoomScheduleResult): RoomScheduleResult {
  return result;
}

export function advanceDirectorSchedulerState(result: RoomScheduleResult, room: RoomState): ReturnType<typeof advanceRoomFlowState> & {
  flowMode: RoomFlowMode;
  simulationFocus: RoomSimulationFocus;
} {
  return {
    ...advanceRoomFlowState(result, room),
    flowMode: resolveRoomFlowMode(room),
    simulationFocus: resolveSimulationFocus(room, result.discussionPlan ?? room.activeDiscussionPlan),
  };
}

export function buildRoomInspectorSchedulerState(room: RoomState): {
  flowMode: RoomFlowMode;
  freedomLevel: RoomFreedomLevel;
  objective: SimulationObjective;
  style: SimulationStyle;
  focus: RoomSimulationFocus;
  currentPlan: RoomDiscussionPlan | null;
  stopReason: RoomTerminationReason | null;
} {
  const currentPlan = validateRoomPlan(room.activeDiscussionPlan, room);
  return {
    flowMode: resolveRoomFlowMode(room),
    freedomLevel: resolveRoomFreedomLevel(room),
    objective: resolveSimulationObjective(room),
    style: resolveSimulationStyle(room),
    focus: resolveSimulationFocus(room, currentPlan),
    currentPlan,
    stopReason: room.lastTerminationReason,
  };
}

export function advanceRoomSimulationState(
  result: RoomScheduleResult,
  room: RoomState,
): Pick<RoomState, "simulation" | "match"> {
  const current = room.simulation;
  const beat = result.simulationBeat;
  if (!beat || result.type === "stop") {
    return {
      simulation: {
        ...current,
        enabled: room.autoChat,
        stopReason: terminationReasonFromScheduleResult(result) ?? current.stopReason,
      },
      match: room.match,
    };
  }

  const lastSpeakerIds = result.participant
    ? [result.participant.id, ...current.lastSpeakerIds.filter((id) => id !== result.participant?.id)].slice(0, 4)
    : current.lastSpeakerIds;
  const phase = nextSimulationPhase(current.phase, beat.type);
  const noveltyDelta = beat.scoring ? Math.round((beat.scoring.novelty - 45) / 5) : beat.expectedStateChange ? 2 : -20;
  const noveltyScore = Math.max(0, Math.min(100, current.noveltyScore + noveltyDelta));
  const tensionDelta =
    beat.scoring?.tensionDelta ?? (beat.type === "director_twist" || beat.type === "role_action" ? 8 : beat.type === "cooldown" ? -12 : 2);
  const tension = Math.max(0, Math.min(100, current.tension + tensionDelta));
  const match = advanceMatchState(room, beat);
  const openHooks = simulationOpenHooks(room, beat);
  return {
    simulation: {
      ...current,
      enabled: room.autoChat,
      phase,
      beatIndex: current.beatIndex + 1,
      currentFocus: beat.expectedStateChange || beat.goal,
      tension,
      noveltyScore,
      lastBeatType: beat.type,
      lastSpeakerIds,
      openHooks,
      nextPressure: beat.scoring?.reason ?? beat.goal,
      lastRuling: beat.type === "director_judge" ? beat.expectedStateChange : current.lastRuling,
      stopReason: undefined,
    },
    match,
  };
}

function simulationOpenHooks(room: RoomState, beat: SimulationBeatPlan): string[] {
  return dedupeTextList([
    beat.type === "director_twist" || beat.type === "director_cue" || beat.type === "role_action" ? beat.expectedStateChange : "",
    ...room.director.sceneBoard.unresolved,
    ...room.director.sceneBoard.openClues,
    ...(room.simulation?.openHooks ?? []),
  ].filter(Boolean)).slice(0, 5);
}

function advanceMatchState(room: RoomState, beat: SimulationBeatPlan): RoomState["match"] {
  const style = resolveSimulationStyle(room);
  if (style !== "match") {
    return room.match;
  }
  const currentRound = room.match.round || 1;
  const advancedMatch =
    beat.speakerId && beat.speakerId !== room.director.directorId
      ? advanceDebateMatchAfterSpeaker(room, beat.speakerId)
      : room.match;
  const nextRound = beat.type === "score_update" ? currentRound + 1 : advancedMatch.round;
  const scoreboard =
    beat.type === "score_update"
      ? room.match.scoreboard.map((entry, index) => ({
          ...entry,
          score: entry.score + (index === (currentRound - 1) % Math.max(1, room.match.scoreboard.length) ? 1 : 0),
        }))
      : room.match.scoreboard;
  const judgeNotes =
    beat.type === "score_update"
      ? [`Round ${currentRound}: ${beat.expectedStateChange}`, ...room.match.judgeNotes].slice(0, 5)
      : room.match.judgeNotes;
  return {
    ...advancedMatch,
    round: nextRound,
    scoreboard,
    judgeNotes,
  };
}

export function collectRoomSpeechIntents(
  room: RoomState,
  trigger: RoomTurnTrigger,
  message?: ConsoleMessage,
  addressing: RoomAddressing = parseRoomMentions("", room.participants, room.userProfile, room.director),
  userInput = "",
): RoomSpeechIntent[] {
  const addressedRoleIds = targetRoleIds(addressing.target);
  const lastMessage = message ?? latestPublicRoomMessage(room);
  const lastTargetRoleIds = targetRoleIds(lastMessage?.target);
  const profile = getRoomPromptProfile(room.promptProfileId);
  const collaborationMode = resolveRoomCollaborationMode(room);
  const text = userInput || lastMessage?.text || room.topic;
  const defaultResponder = addressing.isBroadcast ? chooseNextParticipant(room, userInput, addressing, trigger) : null;

  return room.participants.map((participant) => {
    if (
      lastMessage?.visibility === "faction_huddle" &&
      !lastMessage.visibleTo?.some((target) => target.type === "role" && target.roleId === participant.id)
    ) {
      return {
        roleId: participant.id,
        decision: "listen",
        target: "all",
        delayMs: 0,
        priority: -100,
        reason: `${profile.schedulerStyle}: not in this faction huddle`,
        emotionHint: inferRoomEmotion(text, profile.id),
        maxLength: profile.id === "debate" ? 420 : 320,
      };
    }

    const directAddress = addressedRoleIds.includes(participant.id);
    const lastAddress = lastTargetRoleIds.includes(participant.id);
    const recentlySpoke = participant.id === room.lastSpeakerId;
    const topicRelated = isParticipantTopicRelated(participant, text);
    const collaborationTask = getActiveRoomCollaborationTask(room, participant.id);
    let priority = trigger === "user" ? 38 : 26;

    if (directAddress) {
      priority += 58;
    }
    if (lastAddress) {
      priority += 44;
    }
    if (topicRelated) {
      priority += 14;
    }
    if (defaultResponder?.id === participant.id) {
      priority += trigger === "user" ? 22 : 38;
    }
    if (profile.id === "debate" && /(反驳|观点|论点|证据|debate|argument|agree|disagree)/i.test(text)) {
      priority += 12;
    }
    if (collaborationMode === "debate" && participant.factionId && participant.factionId !== "neutral") {
      priority += trigger === "auto" ? 8 : 4;
    }
    if (collaborationMode === "team_strategy" && participant.factionId && participant.factionId !== "neutral") {
      priority += 18;
    }
    if (collaborationMode === "planning" && /(计划|分工|任务|风险|下一步|plan|task|risk|next)/i.test(text)) {
      priority += 8;
    }
    if (profile.id === "story" || profile.id === "mystery") {
      priority += /(线索|秘密|行动|门|钥匙|clue|secret|action)/i.test(text) ? 10 : 0;
    }
    if (collaborationTask) {
      priority += trigger === "auto" ? 64 : 30;
    }
    if (recentlySpoke && !directAddress) {
      priority -= 42;
    }
    if (participant.viewportState === "cooling_down" && !directAddress) {
      priority -= 18;
    }

    let decision = collaborationTask && trigger === "auto" ? "speak" : decideSpeechIntent(priority, directAddress, trigger, room);
    if (!collaborationTask && shouldStartFactionHuddle(room, participant, trigger, addressing, priority, text)) {
      decision = "start_huddle";
    }
    const target = chooseIntentTarget(room, trigger, participant, addressing, lastMessage, decision);
    return {
      roleId: participant.id,
      decision,
      target,
      delayMs: decision === "defer" ? getRoomDelayMs(room) : 0,
      priority,
      reason: collaborationTask
        ? `${collaborationTask.title}: ${collaborationTask.detail}`
        : createSpeechIntentReason(decision, profile, directAddress, lastAddress, topicRelated),
      emotionHint: inferRoomEmotion(text, profile.id),
      maxLength: collaborationMode === "debate" ? 420 : 320,
    };
  });
}

export function selectRoomSpeechTurn(intents: RoomSpeechIntent[], room: RoomState): RoomSpeechIntent | null {
  const directedDebateIntent = selectDirectedDebateSpeechIntent(intents, room);
  if (directedDebateIntent) {
    return directedDebateIntent;
  }

  const huddleIntent = intents
    .filter((intent) => intent.decision === "start_huddle")
    .sort((left, right) => right.priority - left.priority)[0];
  if (huddleIntent) {
    return huddleIntent;
  }

  const speakers = intents
    .filter((intent) => intent.decision === "speak")
    .filter((intent) => validateNextSpeakerEligibility(room, intent).ok)
    .sort((left, right) => rankRoomSpeechIntent(right, room) - rankRoomSpeechIntent(left, room));
  if (speakers[0]) {
    return speakers[0];
  }

  const directorIntent = intents
    .filter((intent) => intent.decision === "ask_director")
    .sort((left, right) => right.priority - left.priority)[0];
  if (directorIntent && room.director.enabled) {
    return directorIntent;
  }

  return null;
}

function resolveRoomSpeakerPolicy(room: RoomState): RoomSpeakerPolicySettings {
  return {
    mode: room.speakerPolicy?.mode ?? "balanced",
    maxConsecutivePairTurns: room.speakerPolicy?.maxConsecutivePairTurns ?? 3,
    lurkerBoostAfterTurns: room.speakerPolicy?.lurkerBoostAfterTurns ?? 4,
    recentSpeakerPenalty: room.speakerPolicy?.recentSpeakerPenalty ?? true,
  };
}

function rankRoomSpeechIntent(intent: RoomSpeechIntent, room: RoomState): number {
  const policy = resolveRoomSpeakerPolicy(room);
  if (policy.mode === "freeform" || isExplicitSpeakerIntent(intent)) {
    return intent.priority;
  }

  const stats = collectRoleParticipationStats(room, intent.roleId);
  const boostTurns = Math.max(0, stats.roleTurnsSinceSpoke - policy.lurkerBoostAfterTurns + 1);
  let score = intent.priority;

  if (policy.mode === "round_robin") {
    score += Math.min(72, boostTurns * 14);
    if (policy.recentSpeakerPenalty) {
      score -= stats.recentRoleTurnCount * 20;
      score -= stats.wasLastSpeaker ? 34 : 0;
    }
    if (isRecentPairLoop(room, intent.roleId, policy.maxConsecutivePairTurns)) {
      score -= 48;
    }
    return score;
  }

  if (policy.mode === "spotlight") {
    score += Math.min(28, boostTurns * 7);
    if (policy.recentSpeakerPenalty) {
      score -= stats.recentRoleTurnCount * 6;
      score -= stats.wasLastSpeaker ? 14 : 0;
    }
    if (isRecentPairLoop(room, intent.roleId, policy.maxConsecutivePairTurns)) {
      score -= 30;
    }
    return score;
  }

  score += Math.min(48, boostTurns * 12);
  if (policy.recentSpeakerPenalty) {
    score -= stats.recentRoleTurnCount * 10;
    score -= stats.wasLastSpeaker ? 24 : 0;
  }
  if (isRecentPairLoop(room, intent.roleId, policy.maxConsecutivePairTurns)) {
    score -= 36;
  }
  return score;
}

function isExplicitSpeakerIntent(intent: RoomSpeechIntent): boolean {
  return intent.priority >= 92 || /direct|explicit|collaboration task|faction huddle/i.test(intent.reason);
}

function collectRoleParticipationStats(room: RoomState, roleId: string): {
  roleTurnsSinceSpoke: number;
  recentRoleTurnCount: number;
  wasLastSpeaker: boolean;
} {
  const recentRoleIds = recentPublicRoomMessages(room, 18)
    .filter((message) => message.speakerType === "role" && message.speakerId)
    .map((message) => message.speakerId as string);
  let roleTurnsSinceSpoke = recentRoleIds.length + 1;
  for (let index = recentRoleIds.length - 1; index >= 0; index -= 1) {
    if (recentRoleIds[index] === roleId) {
      roleTurnsSinceSpoke = recentRoleIds.length - 1 - index;
      break;
    }
  }
  return {
    roleTurnsSinceSpoke,
    recentRoleTurnCount: recentRoleIds.slice(-6).filter((id) => id === roleId).length,
    wasLastSpeaker: room.lastSpeakerId === roleId,
  };
}

function isRecentPairLoop(room: RoomState, roleId: string, maxConsecutivePairTurns: number): boolean {
  const recentRoleIds = recentPublicRoomMessages(room, Math.max(4, maxConsecutivePairTurns + 2))
    .filter((message) => message.speakerType === "role" && message.speakerId)
    .map((message) => message.speakerId as string)
    .slice(-Math.max(2, maxConsecutivePairTurns));
  if (recentRoleIds.length < Math.max(2, maxConsecutivePairTurns)) {
    return false;
  }
  const uniqueRoleIds = new Set(recentRoleIds);
  return uniqueRoleIds.size === 2 && uniqueRoleIds.has(roleId);
}

export function validateNextSpeakerEligibility(
  room: RoomState,
  candidate: Pick<RoomSpeechIntent, "roleId" | "priority" | "reason">,
): { ok: true } | { ok: false; reason: string } {
  const participant = room.participants.find((item) => item.id === candidate.roleId);
  if (!participant) {
    return { ok: false, reason: "missing_role" };
  }
  if (!getChannelVisibleRoleIds(room, room.activeChannelId).includes(candidate.roleId)) {
    return { ok: false, reason: "role_not_visible" };
  }

  if (isDebateRoom(room) && debateLifecyclePhase(room) === "round_active") {
    const nextAssignment = resolveNextDebateSpeakerAssignment(room);
    if (!nextAssignment) {
      return { ok: false, reason: "debate_no_pending_speaker" };
    }
    return nextAssignment.roleId === candidate.roleId
      ? { ok: true }
      : { ok: false, reason: `debate_next_speaker:${nextAssignment.roleId}` };
  }

  const hasAlternative = room.participants.some(
    (item) => item.id !== candidate.roleId && getChannelVisibleRoleIds(room, room.activeChannelId).includes(item.id),
  );
  const explicitUserTarget = candidate.priority >= 90;
  const necessaryContinuation = /\b(?:necessary_continuation|explicit_continuation)\b/i.test(candidate.reason);
  if (hasAlternative && candidate.roleId === room.lastSpeakerId && !explicitUserTarget && !necessaryContinuation) {
    return { ok: false, reason: "same_role_consecutive" };
  }

  return { ok: true };
}

function selectDirectedDebateSpeechIntent(intents: RoomSpeechIntent[], room: RoomState): RoomSpeechIntent | null {
  if (!isDebateRoom(room) || debateLifecyclePhase(room) !== "round_active") {
    return null;
  }
  const nextAssignment = resolveNextDebateSpeakerAssignment(room);
  if (!nextAssignment) {
    return null;
  }
  const intent = intents.find((candidate) => candidate.roleId === nextAssignment.roleId);
  if (!intent) {
    return null;
  }
  return {
    ...intent,
    decision: "speak",
    priority: Math.max(intent.priority, 10_000),
    reason: `debate_next_speaker:${nextAssignment.position}`,
  };
}

function isStaleDebatePlannedTurn(room: RoomState, turn: RoomPlannedTurn | undefined): boolean {
  if (!turn || turn.speakerType !== "role" || !isDebateRoom(room) || debateLifecyclePhase(room) !== "round_active") {
    return false;
  }
  const nextAssignment = resolveNextDebateSpeakerAssignment(room);
  return Boolean(nextAssignment && turn.speakerId !== nextAssignment.roleId);
}

function isStaleSpeakerPlannedTurn(room: RoomState, turn: RoomPlannedTurn | undefined): boolean {
  if (!turn || turn.speakerType !== "role") {
    return false;
  }
  return !validateNextSpeakerEligibility(room, {
    roleId: turn.speakerId,
    priority: 0,
    reason: turn.goal,
  }).ok;
}

function getRunnablePendingFollowup(room: RoomState, nowMs: number): RoomPendingFollowup | null {
  const pending = room.autoSpeechState.pendingFollowup;
  if (!pending || pending.mode !== "one_shot") {
    return null;
  }
  if (pending.expiresAt <= nowMs || pending.runCount >= pending.maxRuns) {
    return null;
  }
  return pending;
}

export function roomAdvancePolicy(room: Pick<RoomState, "advancePolicy">): RoomAdvancePolicy {
  return room.advancePolicy ?? "fill_gap";
}

export function isContinuousRoomFlow(room: Pick<RoomState, "isOpen" | "autoChat" | "advancePolicy">): boolean {
  return room.isOpen && room.autoChat && roomAdvancePolicy(room) === "continuous";
}

export type RoomAutoFlowPhase =
  | "idle"
  | "queued"
  | "dispatching_role"
  | "waiting_director"
  | "cooling_down"
  | "hard_stopped";

export type RoomHardStopReason =
  | "manual_pause"
  | "room_closed"
  | "not_enough_roles"
  | "api_unavailable"
  | "model_unavailable"
  | "private_leak_blocked"
  | "provider_failure"
  | "runtime_error";

export type RoomAutoFlowCommand =
  | { type: "dispatch_role"; roleId: string; target: "all" | RoomMessageTarget; reason: string }
  | { type: "dispatch_director"; move: RoomDirectorMove; reason: string }
  | { type: "schedule_retry"; reason: string; delayMs: number }
  | { type: "hard_stop"; reason: RoomHardStopReason };

export function isHardRoomAutoBlock(room: RoomState, blockingNeed: RoomBlockingNeed): boolean {
  if (blockingNeed === "privacy_or_safety" || blockingNeed === "provider_failure") {
    return true;
  }
  if (isContinuousRoomFlow(room)) {
    return false;
  }
  if (blockingNeed === "irreversible_decision" || blockingNeed === "explicit_user_choice") {
    return true;
  }
  return blockingNeed === "user_answer_expected" && resolveDirectorMode(room) === "study";
}

function hardStopReasonForRoom(room: RoomState, blockingNeed: RoomBlockingNeed): RoomHardStopReason | null {
  if (!room.isOpen) {
    return "room_closed";
  }
  if (room.participants.length < 1) {
    return "not_enough_roles";
  }
  if (blockingNeed === "provider_failure") {
    return "provider_failure";
  }
  if (blockingNeed === "privacy_or_safety") {
    return "private_leak_blocked";
  }
  return null;
}

export function resolveRoomAutoFlowCommand(
  room: RoomState,
  input: {
    blockingNeed?: RoomBlockingNeed;
    reason?: RoomScheduleReason;
    delayMs?: number;
  } = {},
): RoomAutoFlowCommand {
  const blockingNeed = input.blockingNeed ?? "none";
  const hardStop = hardStopReasonForRoom(room, blockingNeed);
  if (hardStop || isHardRoomAutoBlock(room, blockingNeed)) {
    return { type: "hard_stop", reason: hardStop ?? "runtime_error" };
  }
  const delayMs = input.delayMs ?? getRoomDelayMs(room);
  const roleId = room.participants.find((participant) => participant.id !== room.lastSpeakerId)?.id ?? room.participants[0]?.id;
  if (roleId) {
    return { type: "dispatch_role", roleId, target: "all", reason: input.reason ?? "idle_auto" };
  }
  if (room.director.enabled) {
    return { type: "dispatch_director", move: "cue", reason: input.reason ?? "idle_auto" };
  }
  return { type: "schedule_retry", reason: input.reason ?? "no_candidate", delayMs };
}

type ContinuationMode = SituationAssessment["mode"] | RoomCollaborationMode;
type ContinuationSituation = SituationAssessment | SituationAssessmentSummary;

function continuationDefaultAssumption(blockingNeed: RoomBlockingNeed, mode: ContinuationMode): string | undefined {
  if (blockingNeed === "missing_context") {
    if (mode === "planning") {
      return "Use a reversible low-cost assumption and surface it for confirmation.";
    }
    if (mode === "story" || mode === "mystery" || mode === "scene_play") {
      return "Advance with a reversible cue, visible clue, or character reaction.";
    }
    if (mode === "study") {
      return "Offer a hint or one small explanation before waiting again.";
    }
    return "Fill one reversible beat without committing irreversible facts.";
  }
  if (blockingNeed === "soft_user_preference") {
    return "Continue with a low-risk role response or Director cue.";
  }
  if (blockingNeed === "user_answer_expected") {
    return "Give a hint or one small step; do not mark an answer for the user.";
  }
  if (blockingNeed === "explicit_user_choice") {
    return "Suggest a default path without applying an irreversible choice.";
  }
  return undefined;
}

function continuationSafeNextMove(blockingNeed: RoomBlockingNeed, mode: ContinuationMode): ContinuationAssessment["safeNextMove"] {
  if (blockingNeed === "none") {
    return "role_turn";
  }
  if (blockingNeed === "privacy_or_safety" || blockingNeed === "provider_failure" || blockingNeed === "irreversible_decision") {
    return "pause";
  }
  if (mode === "team_channel" || mode === "team_strategy") {
    return "faction_huddle";
  }
  if (mode === "planning" || mode === "study") {
    return "recap";
  }
  if (mode === "story" || mode === "mystery" || mode === "scene_play") {
    return "director_cue";
  }
  return "role_turn";
}

function blockingNeedFromSituation(assessment: ContinuationSituation | null | undefined): RoomBlockingNeed {
  if (!assessment) {
    return "none";
  }
  if (assessment.blockers.includes("provider_failure")) {
    return "provider_failure";
  }
  if (assessment.blockers.includes("hidden_visibility_boundary")) {
    return "privacy_or_safety";
  }
  if (assessment.blockers.includes("continuity_risk")) {
    return "irreversible_decision";
  }
  if (assessment.nextMove === "choice") {
    return "explicit_user_choice";
  }
  if (assessment.nextMove === "pause") {
    return assessment.materialSufficiency === "none" || assessment.materialSufficiency === "low"
      ? "missing_context"
      : "soft_user_preference";
  }
  if (assessment.materialSufficiency === "none" || assessment.materialSufficiency === "low") {
    return "missing_context";
  }
  return "none";
}

function blockingNeedFromPlan(
  room: RoomState,
  plan: Pick<DirectorTurnPlan, "waitForUser" | "move"> | null | undefined,
  assessment: ContinuationSituation | null | undefined,
): RoomBlockingNeed {
  const situationNeed = blockingNeedFromSituation(assessment);
  if (situationNeed !== "none") {
    return situationNeed;
  }
  if (plan?.move === "pause") {
    return "missing_context";
  }
  if (!plan?.waitForUser) {
    return "none";
  }
  const mode = assessment?.mode ?? resolveRoomCollaborationMode(room);
  if (mode === "study") {
    return "user_answer_expected";
  }
  if (mode === "planning") {
    return "missing_context";
  }
  if (mode === "story" || mode === "mystery" || mode === "casual") {
    return "soft_user_preference";
  }
  if (mode === "debate") {
    return resolveNextDebateSpeakerAssignment(room) ? "soft_user_preference" : "missing_context";
  }
  return "soft_user_preference";
}

export function resolveContinuationAssessment(
  room: RoomState,
  plan?: Pick<DirectorTurnPlan, "waitForUser" | "move"> | null,
  assessment?: ContinuationSituation | null,
  fallbackBlockingNeed?: RoomBlockingNeed,
): ContinuationAssessment {
  const mode = assessment?.mode ?? resolveRoomCollaborationMode(room);
  const blockingNeed = fallbackBlockingNeed ?? blockingNeedFromPlan(room, plan, assessment);
  const hardBlocker = isHardRoomAutoBlock(room, blockingNeed);
  const explicitChoice = !isContinuousRoomFlow(room) && blockingNeed === "explicit_user_choice";
  return {
    blockingNeed,
    canContinueWithoutUser: blockingNeed === "none" || (!hardBlocker && !explicitChoice),
    defaultAssumption: continuationDefaultAssumption(blockingNeed, mode),
    safeNextMove: continuationSafeNextMove(blockingNeed, mode),
    waitReason: blockingNeed === "none" ? undefined : assessment?.reason ?? blockingNeed,
  };
}

export function resolveAdvanceDecision(room: RoomState, continuation: ContinuationAssessment): RoomAdvanceDecision {
  const policy = roomAdvancePolicy(room);
  let action: RoomAdvanceDecision["action"] = "continue";
  if (isHardRoomAutoBlock(room, continuation.blockingNeed)) {
    action = "pause";
  } else if (continuation.blockingNeed === "none") {
    action = "continue";
  } else if (policy === "wait_for_instruction") {
    action = "pause";
  } else if (policy === "fill_gap") {
    action = "fill_gap";
  } else if (policy === "continuous") {
    action = "continue";
  } else {
    action = "continue";
  }
  return {
    policy,
    action,
    blockingNeed: continuation.blockingNeed,
    canContinueWithoutUser: action !== "pause",
    reason: action === "pause" ? (continuation.waitReason ?? continuation.blockingNeed) : (continuation.defaultAssumption ?? "continue"),
    defaultAssumption: continuation.defaultAssumption,
    safeNextMove: action === "pause" ? "pause" : continuation.safeNextMove,
    waitReason: action === "pause" ? continuation.waitReason : undefined,
  };
}

export function buildAutonomousContinuation(
  room: RoomState,
  decision: RoomAdvanceDecision,
): Pick<RoomPendingFollowup, "nextMove" | "targetRoleId" | "summary"> | null {
  if (decision.action === "pause") {
    return null;
  }
  const debateSpeaker = isDebateRoom(room) ? resolveNextDebateSpeakerAssignment(room)?.roleId : null;
  const fallbackRole =
    debateSpeaker ??
    room.participants.find((participant) => participant.id !== room.lastSpeakerId)?.id ??
    room.participants[0]?.id ??
    null;
  if (!fallbackRole) {
    return decision.safeNextMove === "director_cue" || decision.safeNextMove === "recap"
      ? { nextMove: "director_public", summary: decision.reason }
      : null;
  }
  return {
    nextMove: "role_turn",
    targetRoleId: fallbackRole,
    summary: decision.defaultAssumption ?? decision.reason,
  };
}

const explicitRoomTaskPattern =
  /(继续|接着|开始|启动|推进|总结|复盘|评判|裁判|分出胜负|安排|组织|规划|计划|记住|记一下|保存|商量|讨论|辩论|发言|怎么看|怎么做|帮我|请你|please|continue|start|begin|summari[sz]e|recap|judge|verdict|evaluate|plan|remember|save|arrange|organize|debate|discuss|what do you think|what should|どう思|続け|覚えて|요약|기억|계속|merken|zusammen|помни|продолж)/i;

function inputPreview(text: string): string {
  return text.replace(/\s+/g, " ").slice(0, 120);
}

function hasExplicitMention(text: string, addressing: RoomAddressing): boolean {
  if (text.includes("@")) {
    return true;
  }
  const maybeAddressing = addressing as Partial<{
    roleIds: string[];
    participantIds: string[];
    targetRoleIds: string[];
    mentionedRoleIds: string[];
    target: string;
    director: boolean;
    all: boolean;
  }>;
  return Boolean(
    maybeAddressing.director ||
      maybeAddressing.all ||
      maybeAddressing.roleIds?.length ||
      maybeAddressing.participantIds?.length ||
      maybeAddressing.targetRoleIds?.length ||
      maybeAddressing.mentionedRoleIds?.length ||
      (maybeAddressing.target && maybeAddressing.target !== "all"),
  );
}

function hasExplicitRoomTask(text: string, room: RoomState): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  if (explicitRoomTaskPattern.test(normalized)) {
    return true;
  }
  if (room.autoSpeechState.status === "waiting_user" || room.simulation.stopReason === "waiting_user") {
    return true;
  }
  return false;
}

function resolveEngagementDecision(
  room: RoomState,
  input: ScheduleRoomTurnInput,
  addressing: RoomAddressing,
): RoomEngagementDecision | null {
  const text = (input.userInput ?? "").trim();
  if (input.trigger !== "user" || !text) {
    return null;
  }
  const explicitMention = hasExplicitMention(text, addressing);
  const explicitTask = hasExplicitRoomTask(text, room);
  if (!room.isOpen) {
    return {
      kind: "blocked",
      reason: "room_closed",
      requiresVisibleOutcome: true,
      explicitMention,
      explicitTask,
      createdAt: input.nowMs,
    };
  }
  if (explicitMention || explicitTask) {
    return {
      kind: "required",
      reason: explicitMention ? "explicit_mention" : "explicit_task",
      requiresVisibleOutcome: true,
      explicitMention,
      explicitTask,
      createdAt: input.nowMs,
    };
  }
  const promptSource = room as Partial<{
    roomPromptOverride: { text?: string };
    director: { promptOverride?: { text?: string } };
  }>;
  const silentByPrompt = /(?:only|just)\s+(?:reply|speak|respond)\s+(?:when|if)\s+(?:mentioned|addressed|asked|@)|只(?:在)?(?:被)?(?:点名|@|提到|询问)时|未(?:被)?(?:点名|@)不(?:要|用)?(?:主动)?(?:发言|回复|回应)/i.test(
    `${promptSource.roomPromptOverride?.text ?? ""}\n${promptSource.director?.promptOverride?.text ?? ""}`,
  );
  return {
    kind: silentByPrompt ? "silent_allowed" : "optional",
    reason: silentByPrompt ? "prompt_allows_silence" : "ambient_room_input",
    requiresVisibleOutcome: false,
    explicitMention,
    explicitTask,
    createdAt: input.nowMs,
  };
}

function buildShouldSpeakDecision(
  engagement: RoomEngagementDecision | null,
  room: RoomState,
): RoomShouldSpeakDecision | null {
  if (!engagement) {
    return null;
  }
  if (engagement.kind === "blocked") {
    return {
      action: "wait",
      reason: engagement.reason,
      promptConstrained: false,
      requiresVisibleOutcome: true,
    };
  }
  if (engagement.kind === "required") {
    return {
      action: "speak_public",
      reason: engagement.reason,
      promptConstrained: false,
      requiresVisibleOutcome: true,
    };
  }
  if (engagement.kind === "silent_allowed") {
    return {
      action: "no_action",
      reason: engagement.reason,
      promptConstrained: true,
      requiresVisibleOutcome: false,
    };
  }
  if (room.advancePolicy === "continuous" || room.autoChat || room.activeDiscussionPlan?.status === "running") {
    return {
      action: "speak_public",
      reason: "optional_autonomous_room_flow",
      promptConstrained: false,
      requiresVisibleOutcome: false,
    };
  }
  return {
    action: "no_action",
    reason: "optional_room_input",
    promptConstrained: false,
    requiresVisibleOutcome: false,
  };
}

function recordInputProcessed(
  input: ScheduleRoomTurnInput,
  engagement: RoomEngagementDecision | null,
  shouldSpeak: RoomShouldSpeakDecision | null,
): RoomInputProcessedRecord | undefined {
  const text = (input.userInput ?? "").trim();
  if (input.trigger !== "user" || !text || !engagement || !shouldSpeak) {
    return undefined;
  }
  return {
    id: crypto.randomUUID(),
    createdAt: input.nowMs,
    inputPreview: inputPreview(text),
    engagement: engagement.kind,
    shouldSpeak: shouldSpeak.action,
    reason: shouldSpeak.reason || engagement.reason,
  };
}

function createResponseObligation(
  room: RoomState,
  input: ScheduleRoomTurnInput,
  engagement: RoomEngagementDecision | null,
): RoomResponseObligation | null {
  const text = (input.userInput ?? "").trim();
  const channel = getActiveRoomChannel(room);
  const shouldEnsureResponse =
    engagement?.kind === "required" ||
    (engagement?.kind === "optional" && engagement.reason === "ambient_room_input" && channel.type === "public");
  if (input.trigger !== "user" || !text || !room.isOpen || !shouldEnsureResponse) {
    return null;
  }
  return {
    id: crypto.randomUUID(),
    source: "user",
    createdAt: input.nowMs,
    inputPreview: inputPreview(text),
    reason: "user_message",
  };
}

function roomHardNoResponseReason(result: RoomScheduleResult): string | null {
  if (result.reason === "room_closed" || result.reason === "not_enough_roles" || result.reason === "api_unavailable") {
    return result.reason;
  }
  return null;
}

function resolveFallbackResponseAction(
  room: RoomState,
  obligation: RoomResponseObligation,
  decision: RoomAdvanceDecision,
  nowMs: number,
): { pendingFollowup: RoomPendingFollowup; fallbackAction: RoomFallbackAction } | null {
  const continuation = buildAutonomousContinuation(room, decision);
  if (!continuation || continuation.nextMove !== "role_turn" || !continuation.targetRoleId) {
    return null;
  }
  const participant = room.participants.find((item) => item.id === continuation.targetRoleId);
  if (!participant) {
    return null;
  }
  const eligibility = validateNextSpeakerEligibility(room, {
    roleId: continuation.targetRoleId,
    priority: 95,
    reason: `explicit_continuation response_obligation ${obligation.id}`,
  });
  if (!eligibility.ok) {
    return null;
  }
  const summary = continuation.summary ?? `Respond to user message: ${obligation.inputPreview}`;
  const pendingFollowup: RoomPendingFollowup = {
    id: crypto.randomUUID(),
    source: "system",
    mode: "one_shot",
    nextMove: "role_turn",
    targetRoleId: continuation.targetRoleId,
    reason: "response_obligation",
    createdAt: nowMs,
    expiresAt: nowMs + Math.max(getRoomDelayMs(room) * 4, 30_000),
    runCount: 0,
    maxRuns: 1,
    summary,
  };
  return {
    pendingFollowup,
    fallbackAction: {
      action: "pending_followup",
      reason: decision.reason,
      targetRoleId: continuation.targetRoleId,
      summary,
    },
  };
}

function scheduleResultHasVisibleOutcome(result: RoomScheduleResult): boolean {
  return Boolean(
    (result.type === "turn" && result.message) ||
      result.type === "huddle" ||
      result.pendingFollowup ||
      (result.speechIntent?.decision === "ask_director" && result.nextTurnAt !== null) ||
      result.noResponseReason,
  );
}

function ensureScheduleResultHasOutcome(
  result: RoomScheduleResult,
  room: RoomState,
  obligation: RoomResponseObligation | null,
  nowMs: number,
): RoomScheduleResult {
  if (!obligation) {
    return result;
  }
  if (scheduleResultHasVisibleOutcome(result)) {
    return {
      ...result,
      responseObligation: obligation,
    };
  }

  const hardReason = roomHardNoResponseReason(result);
  if (hardReason) {
    return {
      ...result,
      responseObligation: obligation,
      noResponseReason: hardReason,
      fallbackAction: { action: "pause", reason: hardReason },
    };
  }

  const continuationAssessment =
    result.continuationAssessment ?? resolveContinuationAssessment(room, null, null, "soft_user_preference");
  const advanceDecision = result.advanceDecision ?? resolveAdvanceDecision(room, continuationAssessment);
  if (advanceDecision.action !== "pause") {
    const fallback = resolveFallbackResponseAction(room, obligation, advanceDecision, nowMs);
    if (fallback) {
      return {
        ...result,
        status: "cooling_down",
        nextTurnAt: nowMs + getRoomDelayMs(room),
        responseObligation: obligation,
        continuationAssessment,
        advanceDecision,
        pendingFollowup: fallback.pendingFollowup,
        fallbackAction: fallback.fallbackAction,
        noResponseReason: undefined,
      };
    }
  }

  const noResponseReason = advanceDecision.waitReason ?? advanceDecision.reason ?? "fallback_unavailable";
  return {
    ...result,
    responseObligation: obligation,
    continuationAssessment,
    advanceDecision,
    noResponseReason,
    fallbackAction: { action: "pause", reason: noResponseReason },
  };
}

function consumeResponseObligationAfterVisibleCommit(result: RoomScheduleResult): RoomScheduleResult {
  if (!result.responseObligation) {
    return result;
  }
  return {
    ...result,
    noResponseReason: undefined,
  };
}

function withContinuationDecision(
  result: RoomScheduleResult,
  continuationAssessment: ContinuationAssessment,
  advanceDecision: RoomAdvanceDecision,
): RoomScheduleResult {
  return {
    ...result,
    continuationAssessment,
    advanceDecision,
  };
}

function waitDecisionFor(
  room: RoomState,
  blockingNeed: RoomBlockingNeed,
): { continuationAssessment: ContinuationAssessment; advanceDecision: RoomAdvanceDecision } {
  const continuationAssessment = resolveContinuationAssessment(room, null, null, blockingNeed);
  return {
    continuationAssessment,
    advanceDecision: resolveAdvanceDecision(room, continuationAssessment),
  };
}

function shouldContinueRoomAutoAfterBeat(room: RoomState): boolean {
  return isContinuousRoomFlow(room);
}

function createPolicyPendingFollowup(
  room: RoomState,
  decision: RoomAdvanceDecision,
  reason: RoomScheduleReason,
  nowMs: number,
): RoomPendingFollowup | null {
  const continuation = buildAutonomousContinuation(room, decision);
  if (!continuation || continuation.nextMove !== "role_turn" || !continuation.targetRoleId) {
    return null;
  }
  const participant = room.participants.find((item) => item.id === continuation.targetRoleId);
  if (!participant) {
    return null;
  }
  const eligibility = validateNextSpeakerEligibility(room, {
    roleId: continuation.targetRoleId,
    priority: 92,
    reason: `policy_followup ${reason}`,
  });
  if (!eligibility.ok) {
    return null;
  }
  return {
    id: crypto.randomUUID(),
    source: "system",
    mode: "one_shot",
    nextMove: "role_turn",
    targetRoleId: participant.id,
    reason,
    createdAt: nowMs,
    expiresAt: nowMs + Math.max(getRoomDelayMs(room) * 4, 30_000),
    runCount: 0,
    maxRuns: 1,
    summary: continuation.summary ?? decision.reason,
  };
}

function policyBlockedAutoResult(
  room: RoomState,
  reason: RoomScheduleReason,
  blockingNeed: RoomBlockingNeed,
  nowMs: number,
  delayMs: number,
  input?: ScheduleRoomTurnInput,
  addressing?: RoomAddressing,
): RoomScheduleResult {
  const { continuationAssessment, advanceDecision } = waitDecisionFor(room, blockingNeed);
  const continuousSoftBlock = isContinuousRoomFlow(room) && !isHardRoomAutoBlock(room, blockingNeed);
  const effectiveDecision: RoomAdvanceDecision = continuousSoftBlock
    ? {
        ...advanceDecision,
        action: "continue",
        canContinueWithoutUser: true,
        reason: advanceDecision.defaultAssumption ?? "continuous_soft_block",
        safeNextMove: advanceDecision.safeNextMove === "pause" ? "role_turn" : advanceDecision.safeNextMove,
        waitReason: undefined,
      }
    : advanceDecision;
  if (advanceDecision.action === "pause" && !continuousSoftBlock) {
    return withContinuationDecision(stop("waiting_user", "waiting_user", room, null), continuationAssessment, advanceDecision);
  }
  if (effectiveDecision.action === "fill_gap" || effectiveDecision.action === "continue") {
    const pendingFollowup = createPolicyPendingFollowup(room, effectiveDecision, reason, nowMs);
    if (pendingFollowup) {
      return withContinuationDecision(
        {
          ...stop(reason, "cooling_down", room, nowMs + delayMs),
          pendingFollowup,
          fallbackAction: {
            action: "pending_followup",
            reason: advanceDecision.reason,
            targetRoleId: pendingFollowup.targetRoleId,
            summary: pendingFollowup.summary,
          },
        },
        continuationAssessment,
        effectiveDecision,
      );
    }
  }
  if (effectiveDecision.action === "continue" && input && addressing) {
    const speechIntent =
      createCasualTopicShiftSpeechIntent(room, input, addressing, reason) ??
      createAutonomousFallbackSpeechIntent(room, input, addressing, reason);
    if (speechIntent?.decision === "speak") {
      return withContinuationDecision(
        {
          type: "turn",
          reason: speechIntent.reason.startsWith("casual_topic_shift") ? "casual_topic_shift" : reason,
          status: "cooling_down",
          nextTurnAt: nowMs + delayMs,
          consecutiveAutoTurns: room.autoSpeechState.consecutiveAutoTurns + 1,
          userTriggeredFollowUps: room.autoSpeechState.userTriggeredFollowUps,
          speechIntent,
          participant: room.participants.find((item) => item.id === speechIntent.roleId),
          intent: speechIntent.reason,
          target: "all",
          observerRoleIds: [],
        },
        continuationAssessment,
        effectiveDecision,
      );
    }
    if (shouldContinueRoomAutoAfterBeat(room)) {
      return withContinuationDecision(stop(reason, "cooling_down", room, nowMs + delayMs), continuationAssessment, effectiveDecision);
    }
  }
  if (continuousSoftBlock) {
    return withContinuationDecision(stop(reason, "cooling_down", room, nowMs + delayMs), continuationAssessment, effectiveDecision);
  }
  return withContinuationDecision(directorHandoff(reason, room, nowMs + delayMs), continuationAssessment, effectiveDecision);
}

function createPendingFollowupSpeechIntent(
  room: RoomState,
  pending: RoomPendingFollowup | null,
): RoomSpeechIntent | null {
  if (!pending || pending.nextMove !== "role_turn" || !pending.targetRoleId) {
    return null;
  }
  const participant = room.participants.find((item) => item.id === pending.targetRoleId);
  if (!participant) {
    return null;
  }
  const candidate = {
    roleId: participant.id,
    priority: 0,
    reason: pending.privateDirective?.task ?? pending.summary ?? "Director follow-up",
  };
  if (!validateNextSpeakerEligibility(room, candidate).ok) {
    return null;
  }
  return {
    roleId: participant.id,
    decision: "speak",
    target: pending.privateDirective?.target ?? "all",
    delayMs: 0,
    priority: Number.MAX_SAFE_INTEGER,
    reason: pending.privateDirective?.task ?? pending.summary ?? "Director follow-up",
    emotionHint: "idle",
    maxLength: pending.privateDirective?.maxLength ?? 420,
  };
}

function createAutonomousFallbackSpeechIntent(
  room: RoomState,
  input: ScheduleRoomTurnInput,
  addressing: RoomAddressing,
  reason: string,
): RoomSpeechIntent | null {
  const participant = chooseNextParticipant(room, input.userInput ?? "", addressing, input.trigger);
  const eligibility = validateNextSpeakerEligibility(room, {
    roleId: participant.id,
    priority: 88,
    reason: `autonomous_role_fallback ${reason}`,
  });
  if (!eligibility.ok) {
    const visibleAlternative = room.participants.find((candidate) => validateNextSpeakerEligibility(room, {
      roleId: candidate.id,
      priority: 88,
      reason: `autonomous_role_fallback ${reason}`,
    }).ok);
    if (!visibleAlternative) {
      return null;
    }
    return {
      roleId: visibleAlternative.id,
      decision: "speak",
      target: "all",
      delayMs: 0,
      priority: 88,
      reason: `autonomous_role_fallback ${reason}`,
      emotionHint: "idle",
      maxLength: isDebateRoom(room) ? 420 : 320,
    };
  }
  return {
    roleId: participant.id,
    decision: "speak",
    target: "all",
    delayMs: 0,
    priority: 88,
    reason: `autonomous_role_fallback ${reason}`,
    emotionHint: "idle",
    maxLength: isDebateRoom(room) ? 420 : 320,
  };
}

function shouldUseCasualTopicShift(room: RoomState, trigger: RoomTurnTrigger): boolean {
  return trigger === "auto" && room.autoChat && resolveDirectorMode(room) === "casual";
}

function createCasualTopicShiftSpeechIntent(
  room: RoomState,
  input: ScheduleRoomTurnInput,
  addressing: RoomAddressing,
  reason: string,
): RoomSpeechIntent | null {
  if (!shouldUseCasualTopicShift(room, input.trigger)) {
    return null;
  }

  const participant = chooseNextParticipant(room, input.userInput ?? "", addressing, input.trigger);
  const eligibility = validateNextSpeakerEligibility(room, {
    roleId: participant.id,
    priority: 90,
    reason: `casual_topic_shift ${reason}`,
  });
  const fallbackParticipant = eligibility.ok
    ? participant
    : room.participants.find((candidate) => validateNextSpeakerEligibility(room, {
        roleId: candidate.id,
        priority: 90,
        reason: `casual_topic_shift ${reason}`,
      }).ok);

  if (!fallbackParticipant) {
    return null;
  }

  return {
    roleId: fallbackParticipant.id,
    decision: "speak",
    target: "all",
    delayMs: 0,
    priority: 90,
    reason: `casual_topic_shift ${reason}`,
    emotionHint: "curious",
    maxLength: 260,
  };
}

function shouldUseRoleFastPathForAutoDirectorPlan(room: RoomState, turn: RoomPlannedTurn | undefined): boolean {
  if (!turn || turn.speakerType !== "director") {
    return false;
  }

  const beatType = turn.beatType;
  if (beatType === "director_judge" || beatType === "director_twist" || beatType === "scene_shift" || beatType === "score_update") {
    return false;
  }

  if (beatType === "director_cue") {
    const mode = resolveDirectorMode(room);
    return mode !== "story" && mode !== "mystery";
  }

  return true;
}

export function scheduleRoomTurn(input: ScheduleRoomTurnInput): RoomScheduleResult {
  const { room, trigger, nowMs } = input;
  const delayMs = getRoomDelayMs(room);
  const addressing = input.addressing ?? parseRoomMentions(input.userInput ?? "", room.participants, room.userProfile, room.director);
  const engagementDecision = resolveEngagementDecision(room, input, addressing);
  const shouldSpeakDecision = buildShouldSpeakDecision(engagementDecision, room);
  const inputProcessedRecord = recordInputProcessed(input, engagementDecision, shouldSpeakDecision);
  const responseObligation = createResponseObligation(room, input, engagementDecision);
  const finalizeScheduleResult = (result: RoomScheduleResult): RoomScheduleResult =>
    ensureScheduleResultHasOutcome(
      {
        ...result,
        engagementDecision: engagementDecision ?? undefined,
        shouldSpeakDecision: shouldSpeakDecision ?? undefined,
        inputProcessedRecord,
      },
      room,
      responseObligation,
      nowMs,
    );
  const activePlan = validateRoomPlan(room.activeDiscussionPlan, room);
  const pendingFollowup = trigger === "auto" ? getRunnablePendingFollowup(room, nowMs) : null;
  const hasActivePlannedTurn = Boolean(
    activePlan && activePlan.status === "running" && activePlan.turns[activePlan.activeTurnIndex],
  );

  if (!room.isOpen) {
    return finalizeScheduleResult(stop("room_closed", "paused", room, null));
  }

  if (room.participants.length < 1) {
    return finalizeScheduleResult(stop("not_enough_roles", "blocked", room, null));
  }

  if (
    trigger === "user" &&
    !responseObligation &&
    shouldSpeakDecision?.action === "no_action" &&
    !hasActivePlannedTurn &&
    !room.autoChat
  ) {
    return finalizeScheduleResult(stop("waiting_user", "paused", room, null));
  }

  if (trigger === "auto") {
    if (!room.autoChat && !hasActivePlannedTurn && !pendingFollowup) {
      return finalizeScheduleResult(stop("manual_pause", "paused", room, null));
    }

    if (room.autoSpeechState.nextTurnAt && nowMs < room.autoSpeechState.nextTurnAt) {
      return finalizeScheduleResult(stop("cooldown", "cooling_down", room, room.autoSpeechState.nextTurnAt));
    }

    if (
      !pendingFollowup &&
      resolveRoomFlowMode(room) === "player_reactive" &&
      isUserChain(room) &&
      room.autoSpeechState.userTriggeredFollowUps >= room.autoSpeechPolicy.maxUserTriggeredFollowUps
    ) {
      if (roomAdvancePolicy(room) !== "continuous") {
        return finalizeScheduleResult(stop("burst_limit", "paused", room, null));
      }
    }

    if (
      !pendingFollowup &&
      resolveRoomFlowMode(room) !== "auto_simulation" &&
      !isUserChain(room) &&
      room.autoSpeechState.consecutiveAutoTurns >= room.autoSpeechPolicy.maxIdleBurstTurns
    ) {
      if (roomAdvancePolicy(room) !== "continuous") {
        return finalizeScheduleResult(stop("burst_limit", "paused", room, null));
      }
    }

    if (!pendingFollowup && hasQuestionLoop(room)) {
      const topicShiftIntent = createCasualTopicShiftSpeechIntent(room, input, addressing, "question_loop");
      if (topicShiftIntent) {
        return finalizeScheduleResult({
          type: "turn",
          reason: "casual_topic_shift",
          status: shouldContinueRoomAutoAfterBeat(room) ? "cooling_down" : "paused",
          nextTurnAt: shouldContinueRoomAutoAfterBeat(room) ? nowMs + delayMs : null,
          consecutiveAutoTurns: room.autoSpeechState.consecutiveAutoTurns + 1,
          userTriggeredFollowUps: room.autoSpeechState.userTriggeredFollowUps,
          speechIntent: topicShiftIntent,
          participant: room.participants.find((item) => item.id === topicShiftIntent.roleId),
          intent: topicShiftIntent.reason,
          target: "all",
          observerRoleIds: [],
        });
      }
      return finalizeScheduleResult(policyBlockedAutoResult(room, "question_loop", "user_answer_expected", nowMs, delayMs, input, addressing));
    }

    if (!pendingFollowup && room.simulation?.playerIntervention !== "watch" && lastMessageTargetsUserQuestion(room)) {
      return finalizeScheduleResult(policyBlockedAutoResult(room, "waiting_user", "user_answer_expected", nowMs, delayMs, input, addressing));
    }
  }

  const reason = chooseReason(room, trigger);
  const plannerResult =
    input.plannerResult ??
    (activePlan
      ? { mode: activePlan.plannerMode, intent: activePlan.intent, plan: activePlan }
      : createRuleBasedRoomPlan({
          room,
          trigger,
          userInput: input.userInput,
          addressing,
          triggerMessageId: latestPublicRoomMessage(room)?.id ?? null,
          nowIso: new Date(nowMs).toISOString(),
        }));
  const discussionPlan = validateRoomPlan(plannerResult.plan, room);
  const plannedTurn = discussionPlan?.turns[discussionPlan.activeTurnIndex];
  const staleDebatePlan = isStaleDebatePlannedTurn(room, plannedTurn);
  const staleSpeakerPlan = isStaleSpeakerPlannedTurn(room, plannedTurn);
  const autoDirectorPlanRoleFastPath =
    trigger === "auto" && !pendingFollowup && shouldUseRoleFastPathForAutoDirectorPlan(room, plannedTurn);
  const stalePlanResult = (staleDebatePlan || staleSpeakerPlan || autoDirectorPlanRoleFastPath) && discussionPlan
    ? terminateRoomPlan(discussionPlan, "no_candidate") ?? undefined
    : undefined;
  if (!pendingFollowup && plannedTurn && !staleDebatePlan && !staleSpeakerPlan && !autoDirectorPlanRoleFastPath) {
    const plannedResult = executeRoomPlannedTurn(plannedTurn, room, input, reason);
    if (plannedResult.type === "turn" && plannedResult.message && isRepetition(room, plannedResult.message.text)) {
      const topicShiftIntent = createCasualTopicShiftSpeechIntent(room, input, addressing, "repetition_guard");
      if (topicShiftIntent) {
        return finalizeScheduleResult({
          type: "turn",
          reason: "casual_topic_shift",
          status: shouldContinueRoomAutoAfterBeat(room) ? "cooling_down" : "paused",
          nextTurnAt: shouldContinueRoomAutoAfterBeat(room) ? nowMs + delayMs : null,
          consecutiveAutoTurns: room.autoSpeechState.consecutiveAutoTurns + 1,
          userTriggeredFollowUps: room.autoSpeechState.userTriggeredFollowUps,
          speechIntent: topicShiftIntent,
          participant: room.participants.find((item) => item.id === topicShiftIntent.roleId),
          intent: topicShiftIntent.reason,
          target: "all",
          plannerResult,
          discussionPlan: terminateRoomPlan(discussionPlan, "repeated") ?? undefined,
          plannedTurn,
          observerRoleIds: [],
        });
      }
      if (trigger === "auto" && room.autoChat) {
        return finalizeScheduleResult({
          ...policyBlockedAutoResult(room, "repetition_guard", "soft_user_preference", nowMs, delayMs, input, addressing),
          plannerResult,
          discussionPlan: terminateRoomPlan(discussionPlan, "repeated") ?? undefined,
          plannedTurn,
        });
      }
      return finalizeScheduleResult({
        ...stop("repetition_guard", "waiting_user", room, null),
        plannerResult,
        discussionPlan: terminateRoomPlan(discussionPlan, "repeated") ?? undefined,
        plannedTurn,
      });
    }
    return finalizeScheduleResult({
      ...plannedResult,
      plannerResult,
      discussionPlan,
      plannedTurn,
    });
  }

  const intents = collectRoomTurnIntents(room, trigger, latestPublicRoomMessage(room), addressing, input.userInput ?? "");
  const pendingSpeechIntent = createPendingFollowupSpeechIntent(room, pendingFollowup);
  const selectedSpeechIntent = pendingSpeechIntent ?? selectRoomSpeechTurn(intents, room);
  const speechIntent =
    selectedSpeechIntent?.decision === "ask_director" && trigger === "auto"
      ? createCasualTopicShiftSpeechIntent(room, input, addressing, selectedSpeechIntent.reason) ??
        createAutonomousFallbackSpeechIntent(room, input, addressing, selectedSpeechIntent.reason) ??
        selectedSpeechIntent
      : selectedSpeechIntent ?? (
          trigger === "auto" && room.autoChat
            ? createCasualTopicShiftSpeechIntent(room, input, addressing, "no_speaker_intent") ??
              createAutonomousFallbackSpeechIntent(room, input, addressing, "no_speaker_intent")
            : null
        );
  if (speechIntent?.decision === "start_huddle") {
    const participant = room.participants.find((candidate) => candidate.id === speechIntent.roleId);
    const collaborationNeed = resolveCollaborationNeed(room, trigger, input.userInput ?? "");
    const huddle = createFactionHuddleThread(
      room,
      speechIntent,
      input.nowLabel,
      input.userInput ?? "",
      collaborationNeed.opportunity?.factionId === participant?.factionId ? collaborationNeed.opportunity : undefined,
    );
    if (huddle) {
      const collaborationPlan = buildCollaborationPlanFromHuddle(room, huddle);
      const factionStrategy = buildFactionStrategyState(huddle);
      const consecutiveAutoTurns = trigger === "user" ? 0 : room.autoSpeechState.consecutiveAutoTurns + 1;
      return finalizeScheduleResult({
        type: "huddle",
        reason,
        status: shouldContinueRoomAutoAfterBeat(room) ? "cooling_down" : "paused",
        nextTurnAt: shouldContinueRoomAutoAfterBeat(room) ? nowMs + delayMs : null,
        consecutiveAutoTurns,
        userTriggeredFollowUps: room.autoSpeechState.userTriggeredFollowUps,
        speechIntent,
        factionHuddle: huddle,
        collaborationPlan,
        factionStrategy,
        discussionPlan: stalePlanResult,
        observerRoleIds: intents.filter((intent) => intent.decision === "listen" || intent.decision === "defer").map((intent) => intent.roleId),
      });
    }
  }

  if (!speechIntent || speechIntent.decision !== "speak") {
    if (trigger === "auto" && shouldContinueRoomAutoAfterBeat(room)) {
      const fallbackIntent =
        createCasualTopicShiftSpeechIntent(room, input, addressing, speechIntent?.reason ?? "no_candidate") ??
        createAutonomousFallbackSpeechIntent(room, input, addressing, speechIntent?.reason ?? "no_candidate");
      if (fallbackIntent?.decision === "speak") {
        return finalizeScheduleResult({
          type: "turn",
          reason: fallbackIntent.reason.startsWith("casual_topic_shift") ? "casual_topic_shift" : "no_candidate",
          status: "cooling_down",
          nextTurnAt: nowMs + delayMs,
          consecutiveAutoTurns: room.autoSpeechState.consecutiveAutoTurns + 1,
          userTriggeredFollowUps: room.autoSpeechState.userTriggeredFollowUps,
          speechIntent: fallbackIntent,
          participant: room.participants.find((item) => item.id === fallbackIntent.roleId),
          intent: fallbackIntent.reason,
          target: "all",
          discussionPlan: stalePlanResult,
          observerRoleIds: intents.filter((intent) => intent.decision === "listen" || intent.decision === "defer").map((intent) => intent.roleId),
        });
      }
      return finalizeScheduleResult({
        ...stop("no_candidate", "cooling_down", room, nowMs + delayMs),
        speechIntent: speechIntent ?? undefined,
        discussionPlan: stalePlanResult,
        observerRoleIds: intents.filter((intent) => intent.decision === "listen" || intent.decision === "defer").map((intent) => intent.roleId),
      });
    }
    if (trigger === "auto" && room.autoChat && room.director.enabled) {
      if (room.simulation?.playerIntervention !== "watch" && recentDirectorWaitingForUser(room)) {
        return finalizeScheduleResult(
          {
            ...policyBlockedAutoResult(room, "waiting_user", "soft_user_preference", nowMs, delayMs, input, addressing),
            discussionPlan: stalePlanResult,
            observerRoleIds: intents.filter((intent) => intent.decision === "listen" || intent.decision === "defer").map((intent) => intent.roleId),
          },
        );
      }
      return finalizeScheduleResult({
        ...stop("waiting_user", "paused", room, null),
        discussionPlan: stalePlanResult,
        observerRoleIds: intents.filter((intent) => intent.decision === "listen" || intent.decision === "defer").map((intent) => intent.roleId),
      });
    }
    return finalizeScheduleResult({
      ...stop("waiting_user", room.director.enabled && speechIntent?.decision === "ask_director" ? "blocked" : "waiting_user", room, null),
      speechIntent: speechIntent ?? undefined,
      discussionPlan: stalePlanResult,
      observerRoleIds: intents.filter((intent) => intent.decision === "listen" || intent.decision === "defer").map((intent) => intent.roleId),
    });
  }
  const participant = room.participants.find((item) => item.id === speechIntent.roleId) ?? chooseNextParticipant(room, input.userInput ?? "", addressing, trigger);
  const collaborationTask = getActiveRoomCollaborationTask(room, participant.id);
  const profile = getRoomPromptProfile(room.promptProfileId);
  const emotion = speechIntent.emotionHint || inferRoomEmotion(input.userInput ?? room.topic, profile.id);
  const strictDebateTask =
    isStrictDebateFlow(room) && isDebateRoom(room)
      ? strictDebateFlowTurnTask(room, participant, room.match.debateFlow?.language ?? "en")
      : null;
  const intent = strictDebateTask ?? (collaborationTask ? `${collaborationTask.title}: ${collaborationTask.detail}` : speechIntent.reason || createIntent(reason, profile));
  const target = speechIntent.target;
  const privateDirective = buildPrivateRoleDirective({
    room,
    participant,
    goal: collaborationTask?.detail ?? intent,
    target,
    reason: isDebateRoom(room) ? "debate_turn" : "mode_turn",
    sourceMove: "cue",
    maxLength: speechIntent.maxLength,
  });
  const text = createRoomText({
    room,
    participant,
    profile,
    topic: room.topic,
    userInput: input.userInput,
    memorySnippets: input.memorySnippets ?? [],
    reason,
    intent,
    target,
  });

  if (isRepetition(room, text)) {
    const topicShiftIntent = createCasualTopicShiftSpeechIntent(room, input, addressing, "repetition_guard");
    if (topicShiftIntent) {
      return finalizeScheduleResult({
        type: "turn",
        reason: "casual_topic_shift",
        status: shouldContinueRoomAutoAfterBeat(room) ? "cooling_down" : "paused",
        nextTurnAt: shouldContinueRoomAutoAfterBeat(room) ? nowMs + delayMs : null,
        consecutiveAutoTurns: room.autoSpeechState.consecutiveAutoTurns + 1,
        userTriggeredFollowUps: room.autoSpeechState.userTriggeredFollowUps,
        speechIntent: topicShiftIntent,
        participant: room.participants.find((item) => item.id === topicShiftIntent.roleId),
        intent: topicShiftIntent.reason,
        target: "all",
        observerRoleIds: [],
      });
    }
    if (trigger === "auto" && room.autoChat) {
      if (room.simulation?.playerIntervention !== "watch" && recentDirectorWaitingForUser(room)) {
        return finalizeScheduleResult(policyBlockedAutoResult(room, "repetition_guard", "soft_user_preference", nowMs, delayMs, input, addressing));
      }
      return finalizeScheduleResult(policyBlockedAutoResult(room, "repetition_guard", "soft_user_preference", nowMs, delayMs, input, addressing));
    }
    return finalizeScheduleResult(stop("repetition_guard", "waiting_user", room, null));
  }

  const userTriggeredFollowUps =
    trigger === "user"
      ? 0
      : reason === "user_follow_up"
        ? room.autoSpeechState.userTriggeredFollowUps + 1
        : room.autoSpeechState.userTriggeredFollowUps;
  const consecutiveAutoTurns = trigger === "user" ? 0 : room.autoSpeechState.consecutiveAutoTurns + 1;
  const nextTurnAt = shouldContinueRoomAutoAfterBeat(room) ? nowMs + delayMs : null;
  const status = shouldContinueRoomAutoAfterBeat(room) ? "cooling_down" : "paused";

  return finalizeScheduleResult(
    consumeResponseObligationAfterVisibleCommit({
    type: "turn",
    reason,
    status,
    nextTurnAt,
    consecutiveAutoTurns,
    userTriggeredFollowUps,
    participant,
    emotion,
    intent,
    target,
    speechIntent,
    privateDirective,
    discussionPlan: stalePlanResult,
    collaborationTask: collaborationTask ?? undefined,
    observerRoleIds: intents
      .filter((item) => item.roleId !== participant.id && (item.decision === "listen" || item.decision === "defer"))
      .map((item) => item.roleId),
    message: {
      id: crypto.randomUUID(),
      at: input.nowLabel,
      speaker: participant.name,
      text,
      kind: "character",
      speakerType: "role",
      speakerId: participant.id,
      scope: participant.memoryScope,
      emotion,
      target,
      mentions: mentionsFromTarget(target, room),
    },
    }),
  );
}

export function scheduleRoomDirectorTurn(input: {
  room: RoomState;
  nowLabel: string;
  userInput?: string;
  requestedMove?: RoomDirectorMove;
  reason: RoomDirectorScheduleResult["reason"];
  directorMemory?: RoomDirectorMemorySnapshot;
  planOverride?: DirectorTurnPlan;
}): RoomDirectorScheduleResult {
  const { room } = input;
  if (!room.director.enabled) {
    return { type: "stop", move: "pause", reason: "disabled" };
  }

  const plan =
    input.planOverride ??
    createDirectorTurnPlan({
      room,
      nowLabel: input.nowLabel,
      userInput: input.userInput ?? "",
      requestedMove: input.requestedMove,
      reason: input.reason,
      directorMemory: input.directorMemory,
    });
  const structuredOutcome = plan.structuredOutcome ?? createDirectorStructuredOutcomeFromPlan({
    room,
    plan,
    userInput: input.userInput ?? "",
    nowLabel: input.nowLabel,
  });
  const sceneDelta = structuredOutcome.statePatch.sceneDelta ?? plan.sceneDelta;
  const sceneBoard = applySceneDelta(room.director.sceneBoard, sceneDelta, input.nowLabel);
  const match = mergeMatchPatches(
    createDebateDirectorMatchPatch(room, input.userInput ?? ""),
    structuredOutcome.statePatch.matchPatch,
  );
  const simulation = structuredOutcome.statePatch.simulationPatch;
  const plot = applyPlotPatch(room.plot, structuredOutcome.plotPatch, input.nowLabel, room);
  const frame = applyFramePatch(room.frame, structuredOutcome.framePatch, input.nowLabel);
  const target: RoomMessageTarget = plan.move === "whisper"
    ? chooseDirectorWhisperTarget(room)
    : "all";
  const isPrivateWhisper = plan.move === "whisper" && room.privateWhispers === "on" && target !== "all";
  const channelVisibility = resolveRoomInputVisibility(input.userInput ?? "", room, room.activeChannelId);
  const factionVisibility = !isPrivateWhisper && channelVisibility.visibility === "faction_huddle" ? channelVisibility : null;
  const planAllowsPublicText = shouldCommitDirectorPublicText(plan);
  const shouldCommitPublicText =
    planAllowsPublicText &&
    Boolean(structuredOutcome.publicText.trim()) &&
    structuredOutcome.publicTextReason !== "none" &&
    !isDirectorPublicSchedulingText(structuredOutcome.publicText);
  const message: ConsoleMessage | undefined = shouldCommitPublicText
    ? {
        id: crypto.randomUUID(),
        at: input.nowLabel,
        speaker: room.director.displayName,
        text: structuredOutcome.publicText,
        kind: "system",
        speakerType: "room_system",
        speakerId: room.director.directorId,
        target,
        mentions: mentionsFromTarget(target, room),
        visibility: isPrivateWhisper ? "private_ai" : factionVisibility?.visibility ?? "public",
        visibleTo: isPrivateWhisper ? privateVisibleTargets({ speakerType: "room_system", target } as ConsoleMessage) : factionVisibility?.visibleTo,
        privateReason: isPrivateWhisper ? "system_directed" : factionVisibility?.privateReason,
        channelId: factionVisibility?.channelId,
        factionId: factionVisibility?.factionId,
        scope: room.director.memoryScope,
        directorMove: plan.move,
        knowledgeVisibility: plan.knowledgeVisibility,
      }
    : undefined;

  return {
    type: "turn",
    move: plan.move,
    reason: input.reason,
    plan,
    message,
    sceneBoard,
    match,
    simulation,
    plot,
    frame,
    collaborationPlan: structuredOutcome.statePatch.collaborationPatch,
    inspectorPatch: structuredOutcome.statePatch.inspectorPatch,
  };
}

export function planDirectorObservation(input: {
  room: RoomState;
  userInput: string;
  directorMemory?: RoomDirectorMemorySnapshot;
}): DirectorTurnPlan | null {
  const continuityWrites = createContinuityWrites(input.room, "recap", input.userInput, undefined);
  if (continuityWrites.length === 0) {
    return null;
  }
  return {
    move: "recap",
    publicText: "",
    publicTextReason: "none",
    privateDirectives: [],
    nextSpeakerRoleId: null,
    sceneDelta: {},
    continuityWrites,
    secretWrites: [],
    knowledgeVisibility: "public",
    waitForUser: false,
  };
}

export function planDirectorTick(input: {
  room: RoomState;
  sourceMessage: ConsoleMessage;
  source: "user" | "role";
  nowLabel: string;
}): DirectorTickResult {
  const { room, sourceMessage, nowLabel } = input;
  if (!room.director.enabled || sourceMessage.visibility === "director_channel") {
    return {};
  }

  const mode = resolveDirectorMode(room);
  const isSceneMode = mode === "story" || mode === "mystery";
  const isCasualMode = mode === "casual";
  const text = stripMentions(sourceMessage.text).trim();
  const actionCheck = evaluateRoomAction({
    room,
    message: sourceMessage,
    userInput: text,
  });
  const requiredIntervention =
    actionCheck.result !== "allowed"
      ? "action_ruling"
      : room.simulation.directorMemoryDisputedClaims && room.simulation.directorMemoryDisputedClaims > 0
        ? "memory_conflict"
        : room.simulation.situationAssessment?.visibilityRisk === "high"
          ? "visibility_guard"
          : isDebateRoom(room) && isDebateFinalVerdictDue(room)
            ? "debate_ruling"
            : (room.silentAutoTurnCount ?? 0) >= 2 || room.lastNoResponseReason
              ? "stuck_recovery"
              : null;

  const sourceVisibility = classifyMessageSourceVisibility(sourceMessage);
  const publicSafe = sourceVisibility === "public";
  const narrationTrigger = directorTickNarrationTrigger(room, sourceMessage, mode, requiredIntervention);
  const publicNarration = narrationTrigger ? createDirectorTickNarration(room, sourceMessage, narrationTrigger) : null;
  const scriptPatch = createDirectorTickScriptPatch(room, sourceMessage, mode, requiredIntervention, narrationTrigger, nowLabel);
  const focus = createDirectorTickFocus(room, sourceMessage, mode, requiredIntervention, narrationTrigger);
  const directorChannelNote = createDirectorTickChannelNote({
    room,
    sourceMessage,
    mode,
    requiredIntervention,
    narrationTrigger,
    scriptPatch,
  });

  return {
    publicNarration,
    narrationTrigger,
    directorChannelNote,
    inspectorPatch: {
      currentFocus: publicSafe ? focus : undefined,
      nextPressure: publicSafe ? (narrationTrigger ? publicNarration ?? undefined : room.simulation.nextPressure) : undefined,
      stopReason: requiredIntervention === "stuck_recovery" ? undefined : room.simulation.stopReason,
      sourceVisibility,
      publicSafe,
    },
    sceneStatePatch: {
      currentFocus: publicSafe ? focus : room.simulation.currentFocus,
      nextPressure: publicSafe ? (narrationTrigger ? publicNarration ?? undefined : room.simulation.nextPressure) : room.simulation.nextPressure,
      stopReason: requiredIntervention === "stuck_recovery" ? undefined : room.simulation.stopReason,
    },
    scriptPatch,
    requiredIntervention,
    hardPause: null,
  };
}

function directorTickNarrationTrigger(
  room: RoomState,
  sourceMessage: ConsoleMessage,
  mode: SituationAssessmentMode,
  requiredIntervention: DirectorTickResult["requiredIntervention"],
): DirectorTickResult["narrationTrigger"] {
  if ((sourceMessage.visibility ?? "public") !== "public") {
    return null;
  }
  if (sourceMessage.speakerType === "room_system") {
    return null;
  }
  if (requiredIntervention === "action_ruling") {
    return "action_consequence";
  }
  const recentNarrations = recentDirectorPublicNarrationCount(room, 6);
  const hasPublicSceneOpening = room.messages.some(
    (message) =>
      message.speakerId === room.director.directorId &&
      message.visibility !== "director_channel" &&
      message.directorMove === "cue",
  );
  if ((mode === "story" || mode === "mystery") && !hasPublicSceneOpening && sourceMessage.speakerType === "user") {
    return "scene_opening";
  }
  if ((mode === "story" || mode === "mystery") && recentNarrations === 0) {
    const anchor = activePublicDirectorScriptTexts(room.director.scriptBoard.environmentAnchors)[0];
    if (anchor && room.messages.length > 2) {
      return "environment_change";
    }
  }
  if (!mode || mode === "casual") {
    return null;
  }
  if (requiredIntervention === "stuck_recovery" && recentNarrations === 0) {
    return mode === "story" || mode === "mystery" ? "ambient_pressure" : "phase_summary";
  }
  if ((mode === "debate" || mode === "planning" || mode === "study") && requiredIntervention) {
    return "phase_summary";
  }
  return null;
}

function recentDirectorPublicNarrationCount(room: RoomState, limit: number): number {
  return room.messages
    .filter((message) => message.visibility !== "director_channel")
    .slice(-limit)
    .filter((message) => message.speakerId === room.director.directorId && message.speakerType === "room_system").length;
}

function classifyMessageSourceVisibility(message: Pick<ConsoleMessage, "visibility"> | null | undefined): DirectorSourceVisibility {
  const visibility = message?.visibility ?? "public";
  if (
    visibility === "public" ||
    visibility === "private_thread" ||
    visibility === "private_ai" ||
    visibility === "faction_huddle" ||
    visibility === "director_channel"
  ) {
    return visibility;
  }
  return "director_only";
}

function isPublicSafeDirectorScriptItem(item: DirectorScriptItem): boolean {
  if (item.status !== "planned" && item.status !== "active") {
    return false;
  }
  if (item.publicSafety === "private_blocked") {
    return false;
  }
  if (item.publicSafety === "developer_revealed") {
    return true;
  }
  if (item.publicSafety === "public_safe") {
    return (item.sourceVisibility ?? "public") === "public";
  }
  return item.createdBy === "developer";
}

function activePublicDirectorScriptTexts(items: DirectorScriptItem[] | undefined): string[] {
  return (items ?? [])
    .filter(isPublicSafeDirectorScriptItem)
    .map((item) => item.text.trim())
    .filter(Boolean);
}

function createDirectorTickNarration(
  room: RoomState,
  sourceMessage: ConsoleMessage,
  trigger: NonNullable<DirectorTickResult["narrationTrigger"]>,
): string {
  const scene = trimForReply(room.director.sceneBoard.currentScene || room.topic || "The room", 120);
  const anchor = activePublicDirectorScriptTexts(room.director.scriptBoard.environmentAnchors)[0];
  const pressure = activePublicDirectorScriptTexts(room.director.scriptBoard.pressureSources)[0];
  const source = trimForReply(stripMentions(sourceMessage.text), 120);
  switch (trigger) {
    case "scene_opening":
      return `${scene}. The visible details settle into place, giving everyone something concrete to respond to.`;
    case "environment_change":
      return `${anchor ?? "Something in the room shifts subtly"}, changing what the room can notice without revealing hidden plans.`;
    case "action_consequence":
      return `The attempted action changes the room's attention, but its result still needs a clear ruling before it becomes fact.`;
    case "ambient_pressure":
      return `${pressure ?? "A small pressure enters the room"}; the pause now has something visible to push against.`;
    case "phase_summary":
      return `${source || scene} becomes the current point to resolve before the room moves on.`;
    case "scene_transition":
      return `${scene} gives way to the next visible beat.`;
    case "time_passage":
      return `A short stretch of time passes, leaving the last exchange hanging in the room.`;
    case "atmosphere_shift":
      return `The mood shifts around the last exchange, making the next response carry more weight.`;
    default:
      return `${scene} remains the shared anchor for the room.`;
  }
}

function createDirectorTickScriptPatch(
  room: RoomState,
  sourceMessage: ConsoleMessage,
  mode: SituationAssessmentMode,
  requiredIntervention: DirectorTickResult["requiredIntervention"],
  narrationTrigger: DirectorTickResult["narrationTrigger"],
  nowLabel: string,
): DirectorScriptPatch | null {
  const board = room.director.scriptBoard;
  const modeNeedsScript = mode !== "casual";
  const openThreads = board.openThreads ?? [];
  const plannedBeats = board.plannedBeats ?? [];
  const pressureSources = board.pressureSources ?? [];
  const environmentAnchors = board.environmentAnchors ?? [];
  const forbiddenReveals = board.forbiddenReveals ?? [];
  const hiddenFacts = board.hiddenFacts ?? [];
  const continuityNotes = board.continuityNotes ?? [];
  const nextOpenThread = trimForReply(stripMentions(sourceMessage.text), 140);
  const sourceVisibility = classifyMessageSourceVisibility(sourceMessage);
  const sourceMessageIds = sourceMessage.id ? [sourceMessage.id] : [];
  const isPublicSource = sourceVisibility === "public";
  const shouldBootstrap = modeNeedsScript && (
    openThreads.length === 0 &&
    plannedBeats.length === 0 &&
    pressureSources.length === 0 &&
    continuityNotes.length === 0
  );
  const patch: DirectorScriptPatch = {};
  if (shouldBootstrap) {
    patch.premise = room.topic && !/^daily chat$/i.test(room.topic) ? room.topic : board.premise;
    patch.currentPhase = mode === "debate" ? "opening" : mode === "study" ? "explain" : mode === "planning" ? "options" : "setup";
    if (isPublicSource) {
      patch.openThreads = [
        ...openThreads,
        createDirectorScriptItemFromText(`Track the visible room thread: ${nextOpenThread || room.topic}`, nowLabel, {
          visibility: "public",
          sourceVisibility,
          sourceMessageIds,
          publicSafety: "public_safe",
        }),
      ].slice(-24);
    } else if (nextOpenThread) {
      patch.hiddenFacts = [
        ...hiddenFacts,
        createDirectorScriptItemFromText(`Backstage-only source (${sourceVisibility}): ${nextOpenThread}`, nowLabel, {
          visibility: "director_only",
          sourceVisibility,
          sourceMessageIds,
          publicSafety: "private_blocked",
        }),
      ].slice(-24);
    }
    patch.plannedBeats = [
      ...plannedBeats,
      createDirectorScriptItemFromText("Let roles respond naturally before forcing a new beat.", nowLabel, {
        visibility: "public",
        sourceVisibility: "public",
        publicSafety: "public_safe",
      }),
    ].slice(-24);
    patch.environmentAnchors = environmentAnchors.length
      ? environmentAnchors
      : [
          createDirectorScriptItemFromText("Describe visible environment changes only when they create a concrete response target.", nowLabel, {
            visibility: "public",
            sourceVisibility: "public",
            publicSafety: "public_safe",
          }),
        ];
    patch.forbiddenReveals = forbiddenReveals.length
      ? forbiddenReveals
      : [
          createDirectorScriptItemFromText("Never reveal director-only plans, private channel content, or hidden facts through public narration.", nowLabel, {
            visibility: "director_only",
            sourceVisibility: "director_only",
            publicSafety: "private_blocked",
          }),
        ];
  }
  if (requiredIntervention === "stuck_recovery" && nextOpenThread) {
    if (isPublicSource) {
      patch.pressureSources = [
        ...pressureSources,
        createDirectorScriptItemFromText(`Recover from a stall by giving the room a visible pressure around: ${nextOpenThread}`, nowLabel, {
          visibility: "public",
          sourceVisibility,
          sourceMessageIds,
          publicSafety: "public_safe",
        }),
      ].slice(-24);
    } else {
      patch.continuityNotes = [
        ...continuityNotes,
        createDirectorScriptItemFromText(`Backstage recovery note (${sourceVisibility}): keep this source private unless a public-safe result appears.`, nowLabel, {
          visibility: "director_only",
          sourceVisibility,
          sourceMessageIds,
          publicSafety: "private_blocked",
        }),
      ].slice(-24);
    }
  }
  if (narrationTrigger) {
    patch.continuityNotes = [
      ...(patch.continuityNotes ?? continuityNotes),
      createDirectorScriptItemFromText(`Narration trigger ${narrationTrigger}: ${isPublicSource ? nextOpenThread || room.topic : "private source blocked"}`, nowLabel, {
        visibility: isPublicSource ? "public" : "director_only",
        sourceVisibility,
        sourceMessageIds,
        publicSafety: isPublicSource ? "public_safe" : "private_blocked",
      }),
    ].slice(-24);
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

function createDirectorScriptItemFromText(
  text: string,
  nowLabel: string,
  options: Partial<Pick<DirectorScriptItem, "visibility" | "sourceVisibility" | "sourceMessageIds" | "publicSafety">> = {},
): DirectorScriptItem {
  return {
    id: crypto.randomUUID(),
    text: trimForReply(text, 220),
    status: "planned",
    visibility: options.visibility ?? "director_only",
    sourceVisibility: options.sourceVisibility,
    sourceMessageIds: options.sourceMessageIds,
    publicSafety: options.publicSafety,
    createdBy: "director",
    updatedAt: nowLabel,
  };
}

function createDirectorTickFocus(
  room: RoomState,
  sourceMessage: ConsoleMessage,
  mode: SituationAssessmentMode,
  requiredIntervention: DirectorTickResult["requiredIntervention"],
  narrationTrigger: DirectorTickResult["narrationTrigger"],
): string {
  if (requiredIntervention) {
    return `Director observing: ${requiredIntervention}`;
  }
  if (narrationTrigger) {
    return `Director narration: ${narrationTrigger}`;
  }
  const source = trimForReply(stripMentions(sourceMessage.text), 120);
  if (mode === "casual") {
    return source ? `Room can continue naturally from: ${source}` : "Room can continue naturally.";
  }
  return source ? `Director observing ${mode}: ${source}` : `Director observing ${mode}.`;
}

function createDirectorTickChannelNote(input: {
  room: RoomState;
  sourceMessage: ConsoleMessage;
  mode: SituationAssessmentMode;
  requiredIntervention: DirectorTickResult["requiredIntervention"];
  narrationTrigger: DirectorTickResult["narrationTrigger"];
  scriptPatch: DirectorScriptPatch | null;
}): string | null {
  if (!input.requiredIntervention && !input.narrationTrigger && !input.scriptPatch) {
    return null;
  }
  const lines = [
    "Director tick",
    `Mode: ${input.mode}`,
    `Observed: ${input.sourceMessage.speaker}: ${trimForReply(stripMentions(input.sourceMessage.text), 160)}`,
  ];
  if (input.narrationTrigger) {
    lines.push(`Public narration trigger: ${input.narrationTrigger}`);
  }
  if (input.requiredIntervention) {
    lines.push(`Required intervention: ${input.requiredIntervention}`);
  }
  if (input.scriptPatch) {
    lines.push("Script board: patched director-only planning state.");
  }
  return lines.join("\n");
}

function createDirectorStructuredOutcomeFromPlan(input: {
  room: RoomState;
  plan: DirectorTurnPlan;
  userInput: string;
  nowLabel: string;
}): DirectorStructuredOutcome {
  const forceFinalVerdict = isDebateFinalVerdictDue(input.room);
  const debateOutcome = createDebateDirectorVerdictOutcome(input.room, input.userInput, input.nowLabel, {
    forceFinal: forceFinalVerdict,
  });
  if (debateOutcome) {
    const situationAssessment = createSituationAssessment({
      room: input.room,
      plan: input.plan,
      userInput: input.userInput,
      focus: trimForReply(debateOutcome.publicText || input.plan.publicText || input.userInput, 160),
    });
    return validateDirectorPublicTextAgainstSituation({
      room: input.room,
      nowLabel: input.nowLabel,
      plan: input.plan,
      assessment: situationAssessment,
      outcome: {
      ...debateOutcome,
      publicText: debateOutcome.publicText,
      publicTextReason: debateOutcome.publicTextReason,
      privateDirectives: input.plan.privateDirectives ?? debateOutcome.privateDirectives,
      statePatch: mergeSituationStatePatch(debateOutcome.statePatch, situationAssessment),
      plotPatch: debateOutcome.plotPatch ?? createPlotPatchFromDirectorPlan(input.room, input.plan, input.userInput, input.nowLabel),
      framePatch: debateOutcome.framePatch ?? createFramePatchFromDirectorPlan(input.room, input.plan, input.userInput, input.nowLabel),
      memoryWrites: {
        continuityWrites: input.plan.continuityWrites,
        secretWrites: input.plan.secretWrites,
      },
      },
    });
  }

  const focus = createDirectorStructuredFocus(input.room, input.plan, input.userInput);
  const plotPatch = createPlotPatchFromDirectorPlan(input.room, input.plan, input.userInput, input.nowLabel, focus);
  const framePatch = createFramePatchFromDirectorPlan(input.room, input.plan, input.userInput, input.nowLabel, focus);
  const situationAssessment = createSituationAssessment({
    room: input.room,
    plan: input.plan,
    userInput: input.userInput,
    focus,
  });
  const directorContinuationAssessment = resolveContinuationAssessment(input.room, input.plan, situationAssessment);
  const directorAdvanceDecision = resolveAdvanceDecision(input.room, directorContinuationAssessment);
  const shouldMarkWaitingForUser =
    input.plan.waitForUser && directorAdvanceDecision.action === "pause" && !isContinuousRoomFlow(input.room);
  const statePatch = mergeSituationStatePatch(
    {
      sceneDelta: input.plan.sceneDelta,
      simulationPatch: {
        currentFocus: focus,
        lastRuling: input.plan.publicTextReason === "ruling" ? focus : input.room.simulation.lastRuling,
        nextPressure: createDirectorNextPressure(input.room, input.plan),
        phase: shouldMarkWaitingForUser ? "cooldown" : input.plan.move === "judge" ? "payoff" : input.room.simulation.phase,
        stopReason: shouldMarkWaitingForUser ? "waiting_user" : undefined,
      },
      inspectorPatch: {
        currentFocus: focus,
        stopReason: shouldMarkWaitingForUser ? "waiting_user" : undefined,
        lastTurnOutcome: focus,
      },
    },
    situationAssessment,
  );
  return validateDirectorPublicTextAgainstSituation({
    room: input.room,
    nowLabel: input.nowLabel,
    plan: input.plan,
    assessment: situationAssessment,
    outcome: {
    publicText: input.plan.publicText,
    publicTextReason: input.plan.publicTextReason ?? "none",
    privateDirectives: input.plan.privateDirectives ?? [],
    plotPatch,
    framePatch,
    statePatch,
    memoryWrites: {
      continuityWrites: input.plan.continuityWrites,
      secretWrites: input.plan.secretWrites,
    },
    },
  });
}

export function validateDirectorPublicTextAgainstSituation(input: {
  room: RoomState;
  nowLabel: string;
  plan: DirectorTurnPlan;
  assessment: SituationAssessment;
  outcome: DirectorStructuredOutcome;
}): DirectorStructuredOutcome {
  if (input.assessment.mode !== "debate") {
    return input.outcome;
  }

  const lifecyclePhase = debateLifecyclePhase(input.room);
  if (lifecyclePhase === "verdict_due") {
    const verdictOutcome = createDebateDirectorVerdictOutcome(input.room, input.outcome.publicText, input.nowLabel, { forceFinal: true });
    if (verdictOutcome) {
      return {
        ...input.outcome,
        ...verdictOutcome,
        statePatch: mergeSituationStatePatch(
          {
            ...input.outcome.statePatch,
            ...verdictOutcome.statePatch,
            inspectorPatch: {
              ...input.outcome.statePatch.inspectorPatch,
              ...verdictOutcome.statePatch.inspectorPatch,
              lastTurnOutcome: verdictOutcome.publicText,
            },
          },
          input.assessment,
        ),
      };
    }
  }

  const staleSetupText =
    input.outcome.publicTextReason === "setup" ||
    /(?:先确认辩题|再按阵营分轮发言|First confirm the motion|Assign at least two sides)/i.test(input.outcome.publicText);
  if (lifecyclePhase !== "setup_pending" && staleSetupText) {
    const safeText = createDebateSituationSafePublicText(input.room, lifecyclePhase, prefersChinese(input.outcome.publicText || input.plan.publicText));
    return {
      ...input.outcome,
      publicText: safeText,
      publicTextReason: "round_transition",
      statePatch: mergeSituationStatePatch(
        {
          ...input.outcome.statePatch,
          inspectorPatch: {
            ...input.outcome.statePatch.inspectorPatch,
            currentFocus: safeText,
            lastTurnOutcome: safeText,
          },
        },
        {
          ...input.assessment,
          reason: "stale debate setup text blocked by current debate phase",
          blockers: Array.from(new Set([...input.assessment.blockers, "stale_debate_setup_text"])),
        },
      ),
    };
  }

  return input.outcome;
}

function createDebateSituationSafePublicText(
  room: RoomState,
  phase: ReturnType<typeof debateLifecyclePhase>,
  chinese: boolean,
): string {
  const nextAssignment = resolveNextDebateSpeakerAssignment(room);
  const nextParticipant = nextAssignment ? room.participants.find((participant) => participant.id === nextAssignment.roleId) : null;
  const nextPosition = nextAssignment ? debateSpeakerPositionLabel(nextAssignment.position, chinese ? "zh-CN" : "en") : "";
  const stats = debateMaterialStats(room);
  if (phase === "verdict_due") {
    return chinese
      ? `本轮必要发言已经完成，现在可以进入裁判。`
      : "The required speeches for this round are complete; the debate can move to judgement.";
  }
  if (nextParticipant) {
    return chinese
      ? `辩论已经进入第 ${room.match.round || 1} 轮，已完成 ${stats.spokenRequiredSpeakerCount}/${Math.max(1, stats.requiredSpeakerCount)} 个必要发言。下一位由 ${nextParticipant.name}${nextPosition ? `（${nextPosition}）` : ""}继续，直接回应已有交锋或补充新论据。`
      : `The debate is already in round ${room.match.round || 1}. ${stats.spokenRequiredSpeakerCount}/${Math.max(1, stats.requiredSpeakerCount)} required speeches are complete. ${nextParticipant.name}${nextPosition ? ` (${nextPosition})` : ""} should continue with a direct response or a new argument.`;
  }
  return chinese
    ? "辩论已经开始，不需要重新确认流程；请围绕已有交锋继续推进。"
    : "The debate has already started; continue from the existing clash instead of resetting the setup.";
}

function mergeMatchPatches(
  base: Partial<RoomState["match"]> | undefined,
  override: Partial<RoomState["match"]> | undefined,
): Partial<RoomState["match"]> | undefined {
  if (!base) {
    return override;
  }
  if (!override) {
    return base;
  }
  return { ...base, ...override };
}

function createDirectorStructuredFocus(room: RoomState, plan: DirectorTurnPlan, userInput: string): string {
  const stripped = trimForReply(stripMentions(userInput || room.topic || plan.publicText || plan.move), 120);
  if (plan.judgement) {
    return `${plan.judgement.actor}: ${plan.judgement.action} -> ${plan.judgement.outcome}. ${plan.judgement.consequence}`;
  }
  if (plan.publicText?.trim()) {
    return trimForReply(plan.publicText, 160);
  }
  if (plan.privateDirectives?.[0]?.task) {
    return trimForReply(plan.privateDirectives[0].task, 160);
  }
  return stripped || plan.move;
}

function createDirectorNextPressure(room: RoomState, plan: DirectorTurnPlan): string | undefined {
  if (plan.waitForUser) {
    return "waiting for user choice";
  }
  if (plan.nextSpeakerRoleId) {
    const participant = room.participants.find((candidate) => candidate.id === plan.nextSpeakerRoleId);
    return participant ? `next: ${participant.name}` : `next role: ${plan.nextSpeakerRoleId}`;
  }
  if (plan.privateDirectives?.[0]?.roleId) {
    const participant = room.participants.find((candidate) => candidate.id === plan.privateDirectives?.[0]?.roleId);
    return participant ? `next: ${participant.name}` : undefined;
  }
  return undefined;
}

function mergeSituationStatePatch(
  base: DirectorStructuredOutcome["statePatch"],
  assessment: SituationAssessment,
): DirectorStructuredOutcome["statePatch"] {
  const summary = summarizeSituationAssessment(assessment);
  return {
    ...base,
    simulationPatch: {
      ...assessment.statePatch.simulationPatch,
      ...base.simulationPatch,
      situationAssessment: summary,
    },
    inspectorPatch: {
      ...assessment.statePatch.inspectorPatch,
      ...base.inspectorPatch,
      situationAssessment: summary,
    },
  };
}

function summarizeSituationAssessment(assessment: SituationAssessment): Omit<SituationAssessment, "statePatch"> {
  return {
    mode: assessment.mode,
    phase: assessment.phase,
    pressure: assessment.pressure,
    materialSufficiency: assessment.materialSufficiency,
    conflictLevel: assessment.conflictLevel,
    continuityRisk: assessment.continuityRisk,
    visibilityRisk: assessment.visibilityRisk,
    nextMove: assessment.nextMove,
    reason: assessment.reason,
    blockers: assessment.blockers,
  };
}

function createSituationAssessment(input: {
  room: RoomState;
  plan: DirectorTurnPlan;
  userInput: string;
  focus: string;
}): SituationAssessment {
  const mode = resolveDirectorMode(input.room);
  const phase = situationPhaseForMode(input.room, mode, input.plan);
  const pressure = clampSituationPressure(input.room.simulation.tension);
  const nextMove = situationNextMove(input.plan);
  const materialSufficiency = situationMaterialSufficiency(input.room, mode, input.plan);
  const conflictLevel = situationConflictLevel(input.room, input.plan, pressure);
  const continuityRisk = situationContinuityRisk(input.room, input.plan, input.userInput);
  const visibilityRisk = situationVisibilityRisk(input.plan);
  const blockers = situationBlockers({
    materialSufficiency,
    continuityRisk,
    visibilityRisk,
    nextMove,
    plan: input.plan,
  });
  const reason = situationReason({
    room: input.room,
    mode,
    plan: input.plan,
    nextMove,
    materialSufficiency,
    blockers,
  });
  const summary = {
    mode,
    phase,
    pressure,
    materialSufficiency,
    conflictLevel,
    continuityRisk,
    visibilityRisk,
    nextMove,
    reason,
    blockers,
  };
  return {
    ...summary,
    statePatch: {
      simulationPatch: {
        situationAssessment: summary,
      },
      inspectorPatch: {
        situationAssessment: summary,
      },
    },
  };
}

function clampSituationPressure(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function situationPhaseForMode(room: RoomState, mode: SituationAssessment["mode"], plan: DirectorTurnPlan): string {
  if (mode === "debate") {
    const lifecyclePhase = debateLifecyclePhase(room);
    return lifecyclePhase === "round_active" && room.match.currentSide
      ? `round_${room.match.round}_${room.match.currentSide}`
      : lifecyclePhase;
  }
  if (mode === "story" || mode === "mystery") {
    return room.plot?.phase || room.simulation.phase || "setup";
  }
  if (mode === "planning") {
    return plan.waitForUser ? "decision_needed" : room.collaborationPlan?.stage ?? "assess";
  }
  if (mode === "study") {
    return plan.waitForUser ? "waiting_answer" : "learning";
  }
  if (mode === "team_channel") {
    return room.collaborationPlan?.stage ?? "strategy";
  }
  return room.simulation.phase || "idle";
}

function situationNextMove(plan: DirectorTurnPlan): SituationAssessment["nextMove"] {
  if (plan.waitForUser) {
    return "choice";
  }
  if (plan.publicTextReason === "round_transition") {
    return "continue";
  }
  if (plan.publicTextReason === "ruling" || plan.move === "judge") {
    return "judge";
  }
  if (plan.move === "choice") {
    return "choice";
  }
  if (plan.move === "cue") {
    return "cue";
  }
  if (plan.move === "twist") {
    return "twist";
  }
  if (plan.move === "recap") {
    return "recap";
  }
  if (plan.move === "pause") {
    return "pause";
  }
  return "continue";
}

function situationMaterialSufficiency(
  room: RoomState,
  mode: SituationAssessment["mode"],
  plan: DirectorTurnPlan,
): SituationAssessment["materialSufficiency"] {
  const messageCount = room.messages.length;
  const hasTopic = Boolean((room.topic || room.director.sceneBoard.goal || room.plot?.publicGoal || "").trim());
  if (mode === "debate") {
    if (room.match.lastVerdict?.scope === "final") {
      return "strong";
    }
    const lifecyclePhase = debateLifecyclePhase(room);
    const stats = debateMaterialStats(room);
    if (lifecyclePhase === "verdict_due") {
      return "strong";
    }
    if (stats.activeSideCount >= 2 && stats.publicRoleMessageCount >= Math.max(2, Math.min(stats.requiredSpeakerCount, room.participants.length))) {
      return "enough";
    }
    return hasTopic ? "low" : "none";
  }
  if (mode === "mystery") {
    const clueCount =
      room.director.sceneBoard.openClues.length + (room.plot?.hooks ?? []).filter((hook) => hook.visibility === "public").length;
    if (clueCount >= 3) {
      return "strong";
    }
    if (clueCount > 0 || hasTopic) {
      return "enough";
    }
    return messageCount > 1 ? "low" : "none";
  }
  if (mode === "story") {
    const hasScene = Boolean((room.director.sceneBoard.currentScene || room.director.sceneBoard.goal || "").trim());
    if (hasScene && ((room.simulation.openHooks ?? []).length > 0 || (room.plot?.hooks ?? []).length > 0)) {
      return "strong";
    }
    if (hasScene || hasTopic || messageCount > 2) {
      return "enough";
    }
    return messageCount > 0 ? "low" : "none";
  }
  if (mode === "planning") {
    return hasTopic && messageCount >= 2 ? "enough" : hasTopic ? "low" : "none";
  }
  if (mode === "study") {
    return hasTopic || messageCount >= 2 ? "enough" : "low";
  }
  if (mode === "team_channel") {
    return room.collaborationPlan || plan.privateDirectives?.length ? "enough" : "low";
  }
  return messageCount > 0 ? "low" : "none";
}

function situationConflictLevel(
  room: RoomState,
  plan: DirectorTurnPlan,
  pressure: number,
): SituationAssessment["conflictLevel"] {
  if (pressure >= 80 || plan.publicTextReason === "choice") {
    return "critical";
  }
  if (plan.move === "judge" || plan.move === "twist" || pressure >= 55) {
    return "active";
  }
  if ((room.simulation.openHooks ?? []).length > 0 || (room.plot?.unresolved ?? []).length > 0 || plan.privateDirectives?.length) {
    return "minor";
  }
  return "none";
}

function situationContinuityRisk(
  room: RoomState,
  plan: DirectorTurnPlan,
  userInput: string,
): SituationAssessment["continuityRisk"] {
  const claimLike = /(already|won|lost|dead|opened|finished|truth|fact|已经|赢了|输了|死了|打开了|结束了|真相|事实)/i.test(userInput);
  if (room.freedomLevel === "developer") {
    return "low";
  }
  if (plan.judgement?.outcome === "blocked" || claimLike) {
    return "high";
  }
  if (
    plan.move === "judge" ||
    plan.sceneDelta.currentScene ||
    plan.sceneDelta.goal ||
    (plan.sceneDelta.addClues ?? []).length > 0 ||
    plan.continuityWrites.length > 0
  ) {
    return "medium";
  }
  return "low";
}

function situationVisibilityRisk(plan: DirectorTurnPlan): SituationAssessment["visibilityRisk"] {
  if (plan.secretWrites.length > 0 || plan.knowledgeVisibility === "hidden_from_user") {
    return "high";
  }
  const privateDirective = (plan.privateDirectives ?? []).some((directive) => directive.visibleToRoleIds.length > 0);
  return privateDirective || plan.knowledgeVisibility !== "public" ? "medium" : "low";
}

function situationBlockers(input: {
  materialSufficiency: SituationAssessment["materialSufficiency"];
  continuityRisk: SituationAssessment["continuityRisk"];
  visibilityRisk: SituationAssessment["visibilityRisk"];
  nextMove: SituationAssessment["nextMove"];
  plan: DirectorTurnPlan;
}): string[] {
  const blockers: string[] = [];
  if (input.plan.waitForUser) {
    blockers.push("waiting_user_choice");
  }
  if (input.nextMove === "judge" && (input.materialSufficiency === "none" || input.materialSufficiency === "low")) {
    blockers.push("insufficient_material");
  }
  if (input.continuityRisk === "high") {
    blockers.push("continuity_risk");
  }
  if (input.visibilityRisk === "high") {
    blockers.push("hidden_visibility_boundary");
  }
  return blockers;
}

function situationReason(input: {
  room: RoomState;
  mode: SituationAssessment["mode"];
  plan: DirectorTurnPlan;
  nextMove: SituationAssessment["nextMove"];
  materialSufficiency: SituationAssessment["materialSufficiency"];
  blockers: string[];
}): string {
  if (input.blockers.includes("waiting_user_choice")) {
    return "waiting for a user choice before the room can advance";
  }
  if (input.blockers.includes("insufficient_material")) {
    return "not enough visible material for a final judgement";
  }
  if (input.mode === "debate" && input.room.match.lastVerdict?.scope === "final") {
    return "debate has a final verdict recorded";
  }
  if (input.mode === "debate" && debateLifecyclePhase(input.room) === "verdict_due") {
    return "all required debate speakers have spoken and a deferred verdict is due";
  }
  if (input.mode === "story" && input.nextMove === "judge") {
    return "a visible action can change the scene and needs an outcome";
  }
  if (input.mode === "mystery" && input.nextMove === "cue") {
    return "mystery should reveal one supported clue at a time";
  }
  if (input.mode === "planning" && input.nextMove === "choice") {
    return "planning needs a decision or missing constraint";
  }
  if (input.mode === "study" && input.nextMove === "choice") {
    return "study flow is waiting for the learner response";
  }
  if (input.plan.privateDirectives?.length) {
    return "next step is private role scheduling before public action";
  }
  return input.materialSufficiency === "none" ? "room lacks enough material to advance" : `next move selected: ${input.nextMove}`;
}

function defaultPlotArcForRoom(room: RoomState, nowLabel: string): PlotArcState {
  return {
    theme: room.plot?.theme || room.topic || room.title || "Room",
    phase: room.plot?.phase ?? "setup",
    publicGoal: room.plot?.publicGoal ?? "",
    currentPressure: room.plot?.currentPressure ?? "",
    hooks: room.plot?.hooks ?? [],
    unresolved: room.plot?.unresolved ?? [],
    nextBeat: room.plot?.nextBeat ?? "",
    updatedAt: room.plot?.updatedAt ?? nowLabel,
  };
}

function plotBeatFromDirectorPlan(plan: DirectorTurnPlan): PlotBeat {
  if (plan.publicTextReason === "choice" || plan.waitForUser) {
    return "choice";
  }
  if (plan.publicTextReason === "ruling" || plan.move === "judge") {
    return "consequence";
  }
  if (plan.publicTextReason === "recap" || plan.move === "recap" || plan.move === "pause") {
    return "cooldown";
  }
  if (plan.move === "twist") {
    return "twist";
  }
  if (plan.move === "cue") {
    return "cue";
  }
  if (plan.privateDirectives?.length) {
    return "pressure";
  }
  if (plan.publicTextReason === "setup") {
    return "setup";
  }
  return "pressure";
}

function createPlotPatchFromDirectorPlan(
  room: RoomState,
  plan: DirectorTurnPlan,
  userInput: string,
  nowLabel: string,
  focus = createDirectorStructuredFocus(room, plan, userInput),
): PlotPatch {
  const phase = plotBeatFromDirectorPlan(plan);
  const publicGoal = room.plot?.publicGoal || room.director.sceneBoard.goal || room.topic || "";
  const currentPressure = createDirectorNextPressure(room, plan) ?? (phase === "choice" ? "waiting for user choice" : focus);
  const visibility = plan.knowledgeVisibility === "public" ? "public" : "hidden";
  const knownToRoleIds = Array.from(new Set((plan.privateDirectives ?? []).flatMap((directive) => directive.visibleToRoleIds ?? [])));
  const addHooks: PlotPatch["addHooks"] = [];
  const hookText = trimForReply(focus || plan.publicText || userInput, 180);
  if (hookText && (phase === "cue" || phase === "twist" || phase === "choice")) {
    addHooks.push({
      text: hookText,
      visibility,
      status: "open",
      knownToRoleIds,
      source: "director",
      createdAt: nowLabel,
    });
  }
  return {
    theme: room.plot?.theme || room.topic || room.title,
    phase,
    publicGoal,
    currentPressure,
    addHooks,
    addUnresolved: phase === "choice" && hookText ? [hookText] : [],
    nextBeat: createPlotNextBeat(room, plan, phase),
  };
}

function createFramePatchFromDirectorPlan(
  room: RoomState,
  plan: DirectorTurnPlan,
  userInput: string,
  nowLabel: string,
  focus = createDirectorStructuredFocus(room, plan, userInput),
): RoomFramePatch {
  const intent = resolveRoomFrameInterpretation({
    room,
    userInput: userInput || plan.publicText || focus,
    targetingDirector: true,
    now: nowLabel,
  });
  const recentChange =
    intent.authority === "developer" && intent.absorption === "direct_apply"
      ? `Developer frame applied: ${focus}`
      : intent.kind === "mode_shift"
        ? `Frame shift absorbed: ${focus}`
        : intent.kind === "world_edit_claim"
          ? `Room-state claim routed: ${focus}`
          : intent.kind === "meta_control"
            ? `Room control routed: ${focus}`
            : intent.summary;
  return {
    intent,
    recentChange,
  };
}

function createPlotNextBeat(room: RoomState, plan: DirectorTurnPlan, phase: PlotBeat): string {
  if (plan.waitForUser) {
    return "Wait for the user to choose or clarify.";
  }
  if (plan.nextSpeakerRoleId) {
    const participant = room.participants.find((candidate) => candidate.id === plan.nextSpeakerRoleId);
    return participant ? `${participant.name} acts next.` : `Role ${plan.nextSpeakerRoleId} acts next.`;
  }
  const directive = plan.privateDirectives?.[0];
  if (directive) {
    const participant = room.participants.find((candidate) => candidate.id === directive.roleId);
    return participant ? `${participant.name}: ${trimForReply(directive.task, 120)}` : trimForReply(directive.task, 140);
  }
  switch (phase) {
    case "setup":
      return "Establish the room direction.";
    case "cue":
      return "Let roles react to the clue.";
    case "pressure":
      return "Push the next visible action.";
    case "twist":
      return "Let the twist create a concrete choice.";
    case "choice":
      return "Wait for a choice before advancing.";
    case "consequence":
      return "Reflect the consequence in the room state.";
    case "payoff":
      return "Summarize the payoff and cool down.";
    case "cooldown":
      return "Pause or recap before the next beat.";
  }
}

function applyFramePatch(
  currentFrame: RoomFrameState | undefined,
  patch: RoomFramePatch | undefined,
  nowLabel: string,
): RoomFrameState {
  const base: RoomFrameState = currentFrame ?? { lastIntent: null, recentChange: "", updatedAt: null };
  if (!patch) {
    return base;
  }
  const intent = patch.intent === undefined ? base.lastIntent : patch.intent;
  const recentChange = patch.recentChange?.trim() ?? base.recentChange;
  return {
    lastIntent: intent,
    recentChange,
    updatedAt: intent?.createdAt ?? nowLabel,
  };
}

function applyPlotPatch(
  currentPlot: PlotArcState | undefined,
  patch: PlotPatch | undefined,
  nowLabel: string,
  room: RoomState,
): PlotArcState {
  const base = defaultPlotArcForRoom({ ...room, plot: currentPlot ?? room.plot }, nowLabel);
  if (!patch) {
    return base;
  }
  const triggerIds = new Set(patch.triggerHookIds ?? []);
  const resolveIds = new Set(patch.resolveHookIds ?? []);
  const existingHookTexts = new Set(base.hooks.map((hook) => normalizeComparableText(hook.text)));
  const updatedHooks = base.hooks.map((hook) => {
    if (resolveIds.has(hook.id)) {
      return { ...hook, status: "resolved" as const, updatedAt: nowLabel };
    }
    if (triggerIds.has(hook.id)) {
      return { ...hook, status: "triggered" as const, updatedAt: nowLabel };
    }
    return hook;
  });
  for (const hook of patch.addHooks ?? []) {
    const text = hook.text.trim();
    const comparable = normalizeComparableText(text);
    if (!text || existingHookTexts.has(comparable)) {
      continue;
    }
    existingHookTexts.add(comparable);
    updatedHooks.push({
      id: hook.id ?? `plot-hook-${crypto.randomUUID()}`,
      text,
      visibility: hook.visibility ?? "public",
      status: hook.status ?? "open",
      knownToRoleIds: hook.knownToRoleIds ?? [],
      createdAt: hook.createdAt ?? nowLabel,
      updatedAt: hook.updatedAt,
      source: hook.source ?? "director",
    });
  }
  const unresolved = new Set(base.unresolved.map((item) => item.trim()).filter(Boolean));
  for (const item of patch.addUnresolved ?? []) {
    const text = item.trim();
    if (text) {
      unresolved.add(text);
    }
  }
  for (const item of patch.resolveUnresolved ?? []) {
    unresolved.delete(item.trim());
  }
  return {
    theme: patch.theme?.trim() || base.theme,
    phase: patch.phase ?? base.phase,
    publicGoal: patch.publicGoal?.trim() ?? base.publicGoal,
    currentPressure: patch.currentPressure?.trim() ?? base.currentPressure,
    hooks: updatedHooks.slice(-24),
    unresolved: Array.from(unresolved).slice(-12),
    nextBeat: patch.nextBeat?.trim() ?? base.nextBeat,
    updatedAt: nowLabel,
  };
}

function normalizeComparableText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function stop(
  reason: RoomScheduleReason,
  status: RoomScheduleResult["status"],
  room: RoomState,
  nextTurnAt: number | null,
): RoomScheduleResult {
  return {
    type: "stop",
    reason,
    status,
    nextTurnAt,
    consecutiveAutoTurns: room.autoSpeechState.consecutiveAutoTurns,
    userTriggeredFollowUps: room.autoSpeechState.userTriggeredFollowUps,
  };
}

function floorOwnerFromScheduleResult(result: RoomScheduleResult, room: RoomState): RoomFloorOwner {
  if (result.type === "turn" && result.participant) {
    return { type: "role", roleId: result.participant.id };
  }

  if (result.type === "huddle" && result.factionHuddle) {
    return { type: "channel", channelId: `faction:${result.factionHuddle.factionId}` };
  }

  if (result.speechIntent?.decision === "ask_director") {
    return { type: "director", directorId: room.director.directorId };
  }

  return { type: "none" };
}

function terminationReasonFromScheduleResult(result: RoomScheduleResult): RoomTerminationReason | null {
  if (result.type !== "stop") {
    return null;
  }

  if (result.speechIntent?.decision === "ask_director") {
    return result.reason === "question_loop" ? "question_loop" : "director_choice";
  }

  switch (result.reason) {
    case "repetition_guard":
      return "repeated";
    case "question_loop":
      return "question_loop";
    case "waiting_user":
      return "waiting_user";
    case "api_unavailable":
      return "model_unavailable";
    case "not_enough_roles":
    case "room_closed":
      return "no_candidate";
    default:
      return null;
  }
}

function directorHandoff(reason: RoomScheduleReason, room: RoomState, nextTurnAt: number | null): RoomScheduleResult {
  const continueAfterDirector = room.director.enabled && nextTurnAt !== null;
  return {
    type: "stop",
    reason,
    status: room.director.enabled ? (continueAfterDirector ? "cooling_down" : "blocked") : "waiting_user",
    nextTurnAt: continueAfterDirector ? nextTurnAt : null,
    consecutiveAutoTurns: 0,
    userTriggeredFollowUps: 0,
    speechIntent: room.director.enabled
      ? {
          roleId: room.director.directorId,
          decision: "ask_director",
          target: { targets: [{ type: "room_director", directorId: room.director.directorId }] },
          delayMs: 0,
          priority: 100,
          reason: directorHandoffPrompt(reason, room),
          emotionHint: "calm",
          maxLength: 280,
        }
      : undefined,
  };
}

function directorHandoffPrompt(reason: RoomScheduleReason, room: RoomState): string {
  const recentText = recentPublicRoomMessages(room, 3).map((message) => message.text).join(" ");
  const chinese = prefersChinese(`${room.topic} ${recentText}`);
  if (isDebateRoom(room)) {
    const nextAssignment = resolveNextDebateSpeakerAssignment(room);
    const nextParticipant = nextAssignment
      ? room.participants.find((participant) => participant.id === nextAssignment.roleId)
      : null;
    const nextLabel =
      nextAssignment && nextParticipant
        ? `${nextParticipant.name} ${debateSpeakerPositionLabel(nextAssignment.position, chinese ? "zh-CN" : "en")}`
        : "";
    return chinese
      ? `请主持辩论节奏：简短收束当前争点，并指定下一位辩手${nextLabel ? `（${nextLabel}）` : ""}继续；不要输出调试标签。`
      : `Host the debate pace: briefly frame the clash and name the next speaker${nextLabel ? ` (${nextLabel})` : ""}; do not output debug labels.`;
  }
  return chinese
    ? `请自然地收束当前节奏，给出下一步提示；原因：${reason}。`
    : `Naturally settle the current pace and give the next cue. Reason: ${reason}.`;
}

function recentDirectorWaitingForUser(room: RoomState): boolean {
  const lastVisible = latestPublicRoomMessage(room);
  return Boolean(
    lastVisible?.speakerType === "room_system" &&
      lastVisible.target !== "all" &&
      lastVisible.target?.targets.some((target) => target.type === "user"),
  );
}

function decideSpeechIntent(
  priority: number,
  directAddress: boolean,
  trigger: RoomTurnTrigger,
  room: RoomState,
): RoomSpeechDecision {
  if (directAddress && priority >= 58) {
    return "speak";
  }
  if (trigger === "user") {
    if (priority >= 52) {
      return "speak";
    }
    return priority >= 34 ? "listen" : "defer";
  }
  if (priority >= 64) {
    return "speak";
  }
  if (priority >= 44) {
    return "defer";
  }
  if (room.director.enabled && ["story", "mystery", "debate", "planning"].includes(room.director.recipeId) && priority >= 30) {
    return "ask_director";
  }
  return "listen";
}

function shouldStartFactionHuddle(
  room: RoomState,
  participant: RoomParticipant,
  trigger: RoomTurnTrigger,
  addressing: RoomAddressing,
  priority: number,
  text: string,
): boolean {
  const factionId = participant.factionId ?? "neutral";
  if (addressing.target !== "all" || !canStartFactionHuddle(room, factionId)) {
    return false;
  }

  const members = room.participants.filter((candidate) => candidate.factionId === factionId);
  const lead = members.find((candidate) => candidate.id !== room.lastSpeakerId) ?? members[0];
  if (lead?.id !== participant.id) {
    return false;
  }

  const collaborationNeed = resolveCollaborationNeed(room, trigger, text);
  const opportunity = collaborationNeed.opportunity;
  if (!opportunity || opportunity.factionId !== factionId || recentlyUsedFactionHuddle(room, factionId, opportunity.cooldownKey)) {
    return false;
  }
  const objective = resolveSimulationObjective(room);
  const debateCadence = room.promptProfileId === "debate" && members.length >= 2 && priority >= 34;
  const teamCadence = objective === "team_channel" && members.length >= 2 && priority >= 30;
  const opportunityReady =
    collaborationNeed.needsHuddle &&
    (opportunity.urgency >= 58 || (trigger === "user" && opportunity.urgency >= 50) || priority >= 34);
  return opportunityReady || debateCadence || teamCadence;
}

function recentlyUsedFactionHuddle(room: RoomState, factionId: string, cooldownKey?: string): boolean {
  const recentThreads = room.factionHuddleThreads.slice(-5);
  if (cooldownKey && recentThreads.some((thread) => thread.factionId === factionId && thread.opportunity?.cooldownKey === cooldownKey)) {
    return true;
  }
  return room.messages
    .slice(-8)
    .some((message) => message.visibility === "faction_huddle" && resolveMessageFactionId(message) === factionId);
}

function chooseIntentTarget(
  room: RoomState,
  trigger: RoomTurnTrigger,
  participant: RoomParticipant,
  addressing: RoomAddressing,
  lastMessage: ConsoleMessage | undefined,
  decision: RoomSpeechDecision,
): RoomMessageTarget {
  if (decision === "ask_director") {
    return { targets: [{ type: "room_director", directorId: room.director.directorId }] };
  }
  if (decision === "start_huddle") {
    const factionId = participant.factionId ?? "neutral";
    const targets = room.participants
      .filter((candidate) => candidate.factionId === factionId && candidate.id !== participant.id)
      .slice(0, 3)
      .map((candidate) => ({ type: "role" as const, roleId: candidate.id }));
    return targets.length > 0 ? { targets } : "all";
  }

  if (trigger === "user") {
    return { targets: [{ type: "user", userId: room.userProfile.userId }] };
  }

  if (lastMessage?.speakerType === "role" && lastMessage.speakerId && targetRoleIds(lastMessage.target).includes(participant.id)) {
    return { targets: [{ type: "role", roleId: lastMessage.speakerId }] };
  }

  const addressedRoleIds = targetRoleIds(addressing.target).filter((roleId) => roleId !== participant.id);
  if (addressedRoleIds.length > 0) {
    return { targets: addressedRoleIds.slice(0, 2).map((roleId) => ({ type: "role", roleId })) };
  }

  return chooseTurnTarget(room, trigger, participant);
}

function createSpeechIntentReason(
  decision: RoomSpeechDecision,
  profile: RoomPromptProfile,
  directAddress: boolean,
  lastAddress: boolean,
  topicRelated: boolean,
): string {
  if (decision === "ask_director") {
    return `${profile.schedulerStyle}: ask Director to move or judge`;
  }
  if (decision === "start_huddle") {
    return `${profile.schedulerStyle}: start a short faction huddle`;
  }
  if (decision === "defer") {
    return `${profile.schedulerStyle}: listen now and respond later`;
  }
  if (decision === "listen") {
    return `${profile.schedulerStyle}: observe without replying`;
  }
  if (directAddress) {
    return `${profile.schedulerStyle}: answer direct @mention`;
  }
  if (lastAddress) {
    return `${profile.schedulerStyle}: respond to the latest directed message`;
  }
  if (topicRelated) {
    return `${profile.schedulerStyle}: join because the topic fits this role`;
  }
  return `${profile.schedulerStyle}: speak briefly`;
}

function isParticipantTopicRelated(participant: RoomParticipant, text: string): boolean {
  const lower = text.toLowerCase();
  return [participant.name, participant.displayName, participant.packId, participant.id]
    .filter(Boolean)
    .some((item) => lower.includes(item.toLowerCase()));
}

function chooseReason(room: RoomState, trigger: RoomTurnTrigger): RoomScheduleReason {
  if (trigger === "user") {
    return "user_reply";
  }

  if (resolveRoomFlowMode(room) === "auto_simulation") {
    return "idle_auto";
  }

  if (isUserChain(room) && room.autoSpeechState.userTriggeredFollowUps < room.autoSpeechPolicy.maxUserTriggeredFollowUps) {
    return "user_follow_up";
  }

  return "idle_auto";
}

function isUserChain(room: RoomState): boolean {
  return room.autoSpeechState.lastReason === "user_reply" || room.autoSpeechState.lastReason === "user_follow_up";
}

function chooseNextParticipant(
  room: RoomState,
  userInput: string,
  addressing: RoomAddressing,
  trigger: RoomTurnTrigger,
): RoomParticipant {
  const speakerPolicy = resolveRoomSpeakerPolicy(room);
  const addressedRoleIds = targetRoleIds(addressing.target);
  if (addressedRoleIds.length > 0) {
    const addressed = pickRoleByIds(room, addressedRoleIds);
    if (addressed) {
      return addressed;
    }
  }

  if (trigger === "auto" && speakerPolicy.mode === "freeform") {
    const lastTargeted = pickRoleByIds(room, targetRoleIds(latestPublicRoomMessage(room)?.target));
    if (lastTargeted) {
      return lastTargeted;
    }
  }

  const lower = userInput.toLowerCase();
  const mentioned = room.participants.find((participant) => lower.includes(participant.name.toLowerCase()));
  if (mentioned && mentioned.id !== room.lastSpeakerId) {
    return mentioned;
  }

  const candidates = room.participants.filter((participant) => participant.id !== room.lastSpeakerId);
  const pool = candidates.length > 0 ? candidates : room.participants;
  const topicHit = pool.find((participant) => lower.includes(participant.packId.toLowerCase()));
  if (topicHit && speakerPolicy.mode !== "round_robin") {
    return topicHit;
  }

  const policyParticipant = chooseParticipantBySpeakerPolicy(room, pool, lower, speakerPolicy);
  if (policyParticipant) {
    return policyParticipant;
  }

  const lastIndex = room.participants.findIndex((participant) => participant.id === room.lastSpeakerId);
  for (let offset = 1; offset <= room.participants.length; offset += 1) {
    const candidate = room.participants[(lastIndex + offset + room.participants.length) % room.participants.length]!;
    if (candidate.id !== room.lastSpeakerId) {
      return candidate;
    }
  }

  return room.participants[0]!;
}

function chooseParticipantBySpeakerPolicy(
  room: RoomState,
  candidates: RoomParticipant[],
  lowerText: string,
  policy: RoomSpeakerPolicySettings,
): RoomParticipant | null {
  if (policy.mode === "freeform") {
    return null;
  }
  const visibleRoleIds = new Set(getChannelVisibleRoleIds(room, room.activeChannelId));
  const ranked = candidates
    .filter((participant) => visibleRoleIds.has(participant.id))
    .map((participant) => {
      const topicBonus =
        lowerText.includes(participant.name.toLowerCase()) || lowerText.includes(participant.packId.toLowerCase()) ? 14 : 0;
      const intent: RoomSpeechIntent = {
        roleId: participant.id,
        decision: "speak",
        target: "all",
        delayMs: 0,
        priority: 50 + topicBonus,
        reason: "speaker_policy_fallback",
        emotionHint: "idle",
        maxLength: isDebateRoom(room) ? 420 : 320,
      };
      return {
        participant,
        score: rankRoomSpeechIntent(intent, room),
      };
    })
    .sort((left, right) => right.score - left.score);
  return ranked[0]?.participant ?? null;
}

function chooseTurnTarget(room: RoomState, trigger: RoomTurnTrigger, participant: RoomParticipant): RoomMessageTarget {
  if (trigger === "user") {
    return { targets: [{ type: "user", userId: room.userProfile.userId }] };
  }

  const last = latestPublicRoomMessage(room);
  if (last?.speakerType === "role" && last.speakerId && targetRoleIds(last.target).includes(participant.id)) {
    return { targets: [{ type: "role", roleId: last.speakerId }] };
  }

  const nextRole = room.participants.find((candidate) => candidate.id !== participant.id && candidate.id !== room.lastSpeakerId);
  if (nextRole) {
    return { targets: [{ type: "role", roleId: nextRole.id }] };
  }

  return "all";
}

function inferRoomEmotion(input: string, profileId: RoomPromptProfileId): string {
  if (/(开心|happy|完成|成功|不错|太好了)/i.test(input)) {
    return "happy";
  }
  if (/(难过|累|sad|困|失败|卡住)/i.test(input)) {
    return "sad";
  }
  if (/(为什么|怎么|吗|？|\?)/i.test(input)) {
    return "curious";
  }
  if (profileId === "debate") {
    return "curious";
  }
  if (profileId === "story") {
    return "surprised";
  }
  return "calm";
}

function createIntent(reason: RoomScheduleReason, profile: RoomPromptProfile): string {
  if (reason === "user_reply") {
    return `${profile.schedulerStyle}: answer user`;
  }
  if (reason === "user_follow_up") {
    return `${profile.schedulerStyle}: add one follow-up`;
  }
  return `${profile.schedulerStyle}: keep room alive`;
}

function createRoomText(input: {
  room: RoomState;
  participant: RoomParticipant;
  profile: RoomPromptProfile;
  topic: string;
  userInput?: string;
  memorySnippets: string[];
  reason: RoomScheduleReason;
  intent: string;
  target: RoomMessageTarget;
}): string {
  const chinese = prefersChinese(input.userInput || input.topic);
  const memoryHint = input.memorySnippets[0]
    ? chinese
      ? ` 参考房间记忆：${input.memorySnippets[0]}。`
      : ` Room memory: ${input.memorySnippets[0]}.`
    : "";
  const userText = input.userInput
    ? chinese
      ? ` 接住用户刚才的话："${trimForReply(input.userInput)}"。`
      : ` Respond to the user's last message: "${trimForReply(input.userInput)}".`
    : "";
  const rule = input.profile.rules[0] ?? (chinese ? "保持简短自然。" : "Keep it short and natural.");
  const lead = roleLead(input.participant, input.profile.id, input.reason, chinese);
  const targetPrefix =
    input.target === "all" ? "" : `${formatRoomTarget(input.target, input.room.userProfile, input.room.participants, input.room.director)} `;

  if (input.profile.id === "debate") {
    const motion = extractDebateMotion(input.room, input.userInput || input.topic) || trimForReply(input.topic, 96);
    const side = participantDebateSide(input.room, input.participant);
    const position = debateSpeakerRoleDescription(input.room, input.participant, chinese ? "zh-CN" : "en");
    return chinese
      ? `${targetPrefix}${input.participant.name}\uff0c\u4f5c\u4e3a ${side} ${position}\uff0c\u56f4\u7ed5\u8fa9\u9898\u201c${motion}\u201d\u53d1\u8a00\u3002\u53ea\u63d0\u51fa\u4e00\u4e2a\u89c2\u70b9\u3001\u7406\u7531\u6216\u53cd\u9a73\uff1b\u4e0d\u8981\u590d\u8bfb\u4e3b\u6301\u8981\u6c42\u6216\u7528\u6237\u539f\u53e5\u3002${memoryHint}`
      : `${targetPrefix}${input.participant.name}, speak as ${side} ${position} on the motion "${motion}". Give one argument, reason, or rebuttal; do not repeat setup instructions or the user's wording.${memoryHint}`;
  }

  const modeGoal = createModeRoleTurnGoal(input.room, input.participant, 0, "single_reply");
  return chinese
    ? `${targetPrefix}${input.participant.name}\uff1a${modeGoal}\u3002\u56f4\u7ed5\u201c${trimForReply(input.topic, 72)}\u201d\u81ea\u7136\u8bf4\u4e00\u53e5\uff1b\u4e0d\u8981\u590d\u8bfb\u7528\u6237\u539f\u53e5\uff0c\u4e0d\u8981\u63d0\u5230\u5bfc\u6f14\u88c1\u5b9a\u6216\u7cfb\u7edf\u5224\u65ad\u3002${memoryHint}`
    : `${targetPrefix}${input.participant.name}: ${modeGoal}. Say one natural line around "${trimForReply(input.topic, 72)}"; do not repeat the user's wording or mention Director rulings or system judgement.${memoryHint}`;

  return chinese
    ? `${targetPrefix}${lead}围绕"${input.topic}"，按 ${input.profile.name} 规则接一轮：${rule}。${userText}${memoryHint}`
    : `${targetPrefix}${lead}Continue around "${input.topic}" using ${input.profile.name}: ${rule}.${userText}${memoryHint}`;
}

function roleLead(participant: RoomParticipant, profileId: RoomPromptProfileId, reason: RoomScheduleReason, chinese = false): string {
  if (reason === "idle_auto") {
    return chinese ? `${participant.name} 主动补一句：` : `${participant.name}: `;
  }
  if (profileId === "debate") {
    return chinese ? `${participant.name} 换个角度说：` : `${participant.name} adds another angle: `;
  }
  if (profileId === "planning") {
    return chinese ? `${participant.name} 先给一个可执行点：` : `${participant.name} gives one practical point: `;
  }
  if (participant.name.includes("Rin")) {
    return chinese ? "我来接一下。" : "I'll add to that. ";
  }
  if (participant.name.includes("Kai")) {
    return chinese ? "换个角度说，" : "From another angle, ";
  }
  return "";
}
function createDirectorTurnPlan(input: {
  room: RoomState;
  nowLabel: string;
  userInput: string;
  requestedMove?: RoomDirectorMove;
  reason: RoomDirectorScheduleResult["reason"];
  directorMemory?: RoomDirectorMemorySnapshot;
}): DirectorTurnPlan {
  const publicUserInput = sanitizeDirectorNarrationSource(input.userInput);
  const frameInterpretation = resolveRoomFrameInterpretation({
    room: input.room,
    userInput: publicUserInput,
    targetingDirector: true,
    now: input.nowLabel,
  });
  const modeIntent = resolveDirectorModeIntent(input.room, publicUserInput, frameInterpretation);
  const policy = getDirectorModePolicy(input.room);
  const verdictDue = isDebateFinalVerdictDue(input.room);
  const requestedMove = verdictDue ? "judge" : input.requestedMove ?? modeIntent.move;
  let move = policy.allowedMoves.includes(requestedMove) ? requestedMove : policy.defaultMove;
  if (move === "judge" && !shouldAllowDirectorJudgement(input.room, publicUserInput, verdictDue)) {
    move = policy.allowedMoves.includes("choice")
      ? "choice"
      : policy.allowedMoves.includes("cue")
        ? "cue"
        : policy.defaultMove;
  }
  const judgement =
    move === "judge"
      ? createJudgementCheck(input.room, extractDirectorJudgementActionText(publicUserInput), input.directorMemory)
      : undefined;
  const sceneDelta = createSceneDelta(input.room, move, publicUserInput, judgement, modeIntent);
  const continuityWrites = createContinuityWrites(input.room, move, publicUserInput, judgement);
  const secretWrites = createSecretWrites(input.room, move, publicUserInput);
  const publicText = createDirectorPlanText(input.room, move, publicUserInput, sceneDelta, judgement, modeIntent);
  const waitForUser = Boolean(modeIntent.waitForUser) || judgement?.outcome === "needs_player_choice";
  const privateDirectives = createDirectorPrivateDirectives(input.room, move, publicUserInput, modeIntent, input.reason);
  const publicTextReason = verdictDue ? "ruling" : directorPublicTextReason(input.room, move, publicUserInput, modeIntent, judgement);

  return {
    move,
    publicText,
    publicTextReason,
    privateDirectives,
    nextSpeakerRoleId: privateDirectives[0]?.roleId ?? chooseSuggestedRoleId(input.room, input.userInput),
    sceneDelta,
    continuityWrites,
    secretWrites,
    knowledgeVisibility: move === "whisper" ? "hidden_from_user" : "public",
    waitForUser,
    judgement,
  };
}

function shouldAllowDirectorJudgement(room: RoomState, userInput: string, verdictDue: boolean): boolean {
  if (verdictDue) {
    return true;
  }
  if (isDebateSetupRequest(room, userInput)) {
    return false;
  }
  if (isDebateVerdictRequest(room, userInput) || isDebateAdvantageRequest(room, userInput)) {
    return true;
  }
  return hasConcreteDirectorJudgementAction(room, userInput);
}

function extractDirectorJudgementActionText(userInput: string): string {
  const withoutInternalChecks = userInput
    .split(/\r?\n/)
    .filter((line) => !/^\s*Director check\s*:/i.test(line.trim()))
    .join(" ");
  return trimForReply(stripMentions(withoutInternalChecks));
}

function hasConcreteDirectorJudgementAction(room: RoomState, userInput: string): boolean {
  const text = extractDirectorJudgementActionText(userInput);
  if (!text || isDebateSetupRequest(room, text)) {
    return false;
  }
  if (text.length < 4 && !/[\u4e00-\u9fff]/.test(text)) {
    return false;
  }
  const englishAction =
    /\b(?:i|we)\s+(?:try|attempt|tried|attempted|open|opened|unlock|unlocked|pick|picked|force|forced|steal|stole|attack|attacked|break|broke|destroy|destroyed|take|took|grab|grabbed|move|moved|enter|entered|leave|left|use|used|inspect|inspected|search|searched|investigate|investigated|persuade|persuaded|sneak|sneaked)\b/i;
  const chineseAction =
    /(?:我|我们).{0,8}(?:尝试|试图|要|去|撬|开锁|解锁|打开|拿|偷|攻击|破坏|摧毁|进入|离开|使用|检查|搜索|调查|说服|潜入)|(?:撬开|开锁|解锁|打开).{0,8}(?:锁|门锁|挂锁|门)|(?:锁|门锁|挂锁|门).{0,8}(?:打开|解锁)|(?:尝试|试图).{0,8}(?:打开|解锁|开锁|撬|拿|偷|进入|使用|攻击|破坏)/;
  return englishAction.test(text) || chineseAction.test(text);
}

function inferDirectorMove(text: string, room: RoomState): RoomDirectorMove {
  const frameInterpretation = resolveRoomFrameInterpretation({ room, userInput: text, targetingDirector: true });
  const modeIntent = resolveDirectorModeIntent(room, text, frameInterpretation);
  const policy = getDirectorModePolicy(room);
  if (policy.allowedMoves.includes(modeIntent.move)) {
    return modeIntent.move;
  }
  const policyFallback = directorMoveFromLegacyText(text, room);
  return policy.allowedMoves.includes(policyFallback) ? policyFallback : policy.defaultMove;
}
function applySceneDelta(current: RoomSceneBoard, delta: SceneDelta, nowLabel: string): RoomSceneBoard {
  return {
    ...current,
    currentScene: delta.currentScene ?? current.currentScene,
    goal: delta.goal ?? current.goal,
    mood: delta.mood ?? current.mood,
    openClues: applyListDelta(current.openClues, delta.addClues, delta.resolveClues).slice(0, 5),
    unresolved: applyListDelta(current.unresolved, delta.addUnresolved, delta.resolveUnresolved).slice(0, 5),
    updatedAt: nowLabel,
  };
}

function createSceneDelta(
  room: RoomState,
  move: RoomDirectorMove,
  userInput: string,
  judgement?: JudgementCheck,
  modeIntent?: DirectorModeIntent,
): SceneDelta {
  const input = trimForReply(userInput || room.topic);

  if (judgement) {
    return {
      mood: judgement.outcome === "success" ? "resolved" : judgement.outcome === "fail" ? "tense" : "uncertain",
      addUnresolved: judgement.outcome === "needs_player_choice" ? [`Choose how to handle: ${judgement.action}`] : [],
      resolveUnresolved: judgement.outcome === "success" ? [judgement.action] : [],
    };
  }

  if (move === "cue") {
    return {
      currentScene: room.director.sceneBoard.currentScene || "The room is following a new clue.",
      addClues: [`Follow up on: ${input}`],
    };
  }
  if (move === "twist") {
    return {
      mood: "tense",
      addUnresolved: [`Complication: ${input}`],
    };
  }
  if (isDebateSetupRequest(room, userInput)) {
    const motion = extractDebateMotion(room, userInput);
    return {
      currentScene: "The debate is being organized.",
      goal: motion ? `Debate motion: ${motion}` : "Confirm the debate motion.",
      mood: "focused",
      addUnresolved: motion ? [`Opening round for: ${motion}`] : ["Confirm debate motion"],
    };
  }
  if (move === "choice") {
    return {
      goal: `Choose the next step for: ${input}`,
    };
  }
  if (move === "recap") {
    return {
      currentScene: room.director.sceneBoard.currentScene || "The room is continuing from the latest shared context.",
    };
  }
  return {};
}

function applyListDelta(current: string[], add: string[] = [], resolve: string[] = []): string[] {
  const resolveText = resolve.map((item) => item.toLowerCase());
  return dedupeTextList([
    ...add,
    ...current.filter((item) => !resolveText.some((resolved) => item.toLowerCase().includes(resolved))),
  ]);
}

function createJudgementCheck(
  room: RoomState,
  userInput: string,
  directorMemory?: RoomDirectorMemorySnapshot,
): JudgementCheck {
  const knownFacts = directorKnownFacts(room, directorMemory);
  const action = trimForReply(extractDirectorJudgementActionText(userInput) || "unspecified action");
  const actor = detectActor(room, userInput);
  const intent = detectIntent(userInput, action);
  const difficulty = detectDifficulty(action, knownFacts, room);
  const relevantFacts = knownFacts
    .filter((fact) => isRelevantFact(action, fact) && !isJudgementEchoEvidence(action, fact))
    .map((fact) => trimForReply(fact, 96))
    .slice(0, 4);
  const evidence = isGatedWorldStateAction(action)
    ? relevantFacts.filter((fact) => isActionSupportEvidence(action, fact))
    : relevantFacts;
  const outcome = judgeOutcome(action, difficulty, evidence, isGatedWorldStateAction(action));

  return {
    actor,
    action,
    intent,
    knownFacts: knownFacts.slice(0, 8),
    difficulty,
    evidence,
    outcome,
    consequence: judgementConsequence(action, outcome, evidence),
  };
}

function createContinuityWrites(
  room: RoomState,
  move: RoomDirectorMove,
  userInput: string,
  judgement?: JudgementCheck,
): ContinuityWrite[] {
  const writes: ContinuityWrite[] = [];
  if (judgement) {
    if (!canWriteFactFromJudgement(judgement)) {
      return writes;
    }
    const ownership = extractOwnershipWrite(room, userInput);
    if (ownership) {
      writes.push(ownership);
    }
    writes.push({
      label: "Judgement",
      detail: `${judgement.actor}: ${judgement.action} -> ${judgement.outcome}. ${judgement.consequence}`,
      visibility: "public",
      ownerRoleIds: [],
      status: judgement.outcome === "blocked" ? "needs_review" : judgement.outcome === "success" ? "resolved" : "active",
    });
  } else if (isDebateSetupRequest(room, userInput)) {
    const motion = extractDebateMotion(room, userInput);
    if (motion) {
      writes.push({
        label: "Debate motion",
        detail: motion,
        visibility: "public",
        ownerRoleIds: [],
        status: "active",
      });
    }
  } else if (move === "cue") {
    writes.push({
      label: "Clue",
      detail: `Open clue: ${trimForReply(userInput || room.topic)}`,
      visibility: "public",
      ownerRoleIds: [],
      status: "active",
    });
  } else if (move === "twist") {
    writes.push({
      label: "Twist",
      detail: `Complication: ${trimForReply(userInput || room.topic)}`,
      visibility: "public",
      ownerRoleIds: [],
      status: "active",
    });
  }
  return writes;
}

function createSecretWrites(room: RoomState, move: RoomDirectorMove, userInput: string): RoomSecretEntry[] {
  if (move !== "whisper") {
    return [];
  }
  const target = chooseDirectorWhisperTarget(room);
  const knownToRoleIds = target === "all" ? [] : target.targets.filter((item) => item.type === "role").map((item) => item.roleId);
  return [
    {
      id: crypto.randomUUID(),
      title: "Director whisper",
      detail: trimForReply(userInput || "private direction for the next role beat"),
      knownToRoleIds,
      revealedToUser: false,
      visibility: "hidden_from_user",
      createdAt: new Date().toISOString(),
    },
  ];
}

function canWriteFactFromJudgement(judgement: JudgementCheck): boolean {
  return judgement.outcome === "success" || judgement.outcome === "partial_success";
}

function createDirectorPrivateDirectives(
  room: RoomState,
  move: RoomDirectorMove,
  userInput: string,
  modeIntent?: DirectorModeIntent,
  reason: RoomDirectorScheduleResult["reason"] = "recipe",
): RoomDirectorPrivateDirective[] {
  if (move === "pause" || modeIntent?.waitForUser) {
    return [];
  }
  const collaborationChoice = chooseCollaborationDirectiveParticipant(room);
  const nextParticipant =
    collaborationChoice?.participant ??
    (isDebateRoom(room)
      ? (() => {
          const assignment = resolveNextDebateSpeakerAssignment(room);
          return assignment ? room.participants.find((participant) => participant.id === assignment.roleId) : null;
        })()
      : room.participants.find((participant) => participant.id === chooseSuggestedRoleId(room, userInput)));
  if (!nextParticipant) {
    return [];
  }
  const collaborationTask = collaborationChoice?.task ?? getActiveRoomCollaborationTask(room, nextParticipant.id);
  const goal = collaborationTask
    ? `${collaborationTask.detail} Complete your own part directly; do not describe the plan or ask another role to speak.`
    : isDebateRoom(room)
      ? strictDebateFlowTurnTask(room, nextParticipant, room.match.debateFlow?.language ?? "en") ?? createDebateTurnGoal(room, nextParticipant, 0)
      : createModeRoleTurnGoal(room, nextParticipant, 0, "single_reply");
  return [
    buildPrivateRoleDirective({
      room,
      participant: nextParticipant,
      goal,
      target: "all",
      reason: collaborationTask ? "follow_up" : isDebateRoom(room) ? "debate_turn" : "mode_turn",
      sourceMove: move,
      maxLength: isDebateRoom(room) ? 260 : 180,
    }),
  ];
}

function directorPublicTextReason(
  room: RoomState,
  move: RoomDirectorMove,
  userInput: string,
  modeIntent: DirectorModeIntent | undefined,
  judgement: JudgementCheck | undefined,
): RoomDirectorPublicTextReason {
  if (judgement) {
    return "ruling";
  }
  if (modeIntent?.mode === "debate") {
    if (modeIntent.key === "debate_setup") {
      return "setup";
    }
    if (modeIntent.key === "debate_final_verdict") {
      return "ruling";
    }
    if (modeIntent.key === "debate_advantage_check") {
      return "ruling";
    }
    return "none";
  }
  if (modeIntent?.waitForUser && move !== "pause") {
    return "choice";
  }
  if (move === "recap" && isPrivateRoomChannelActive(room)) {
    return "recap";
  }
  if (move === "recap" && isExplicitPublicDirectorTextRequest(userInput, move)) {
    return "recap";
  }
  if ((move === "cue" || move === "twist") && isExplicitPublicDirectorTextRequest(userInput, move)) {
    return "narration";
  }
  const narrationMode = modeIntent?.mode ?? resolveDirectorModeIntent(room, userInput).mode;
  const hasScenePressure = Boolean(stripMentions(userInput).trim());
  if (move === "cue" && (narrationMode === "story" || narrationMode === "mystery") && hasScenePressure) {
    return "narration";
  }
  if (move === "twist" && (narrationMode === "story" || narrationMode === "mystery")) {
    return "narration";
  }
  return "none";
}

export function shouldCommitDirectorPublicText(plan: DirectorTurnPlan | undefined): boolean {
  if (!plan?.publicText?.trim()) {
    return false;
  }
  return (plan.publicTextReason ?? "none") !== "none" && !isDirectorPublicSchedulingText(plan.publicText);
}

export function isDirectorPublicSchedulingText(text: string): boolean {
  return (
    isDirectorInternalPromptText(text) ||
    /(?:\bacts\s+next\b|\bnext\s+(?:speaker|role|turn|direction)\b|\bprivate\s*directives?\b|\bschedule(?:s|d|ing)?\b|\bcue\s+(?:the\s+)?(?:next\s+)?role\b|\brole\s+turn\b|\btarget\s+role\b|\bLight\s+recap\b|\bAdd\s+only\s+one\s+useful\s+next\s+direction\b|\u5148\u628a\u8bdd\u9898\u6536\u4e00\u4e0b|\u63a5\u4e0b\u6765\u53ea\u8865|\u6709\u7528\u65b9\u5411|\u4e0b\u4e00(?:\u4f4d|\u4e2a|\u8f6e)|\u8f6e\u5230|\u8bf7.{0,24}(?:\u53d1\u8a00|\u63a5\u8bdd|\u56de\u5e94|\u8865\u4e00\u53e5)|\u8c03\u5ea6|\u79c1\u4e0b\u63d0\u9192|\u540e\u53f0\u6307\u4ee4)/i.test(text)
  );
}

function isDirectorInternalPromptText(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) {
    return false;
  }
  return /(?:\bDirector\s+check\b|\bNaturally\s+settle\s+the\s+current\s+pace\b|\bgive\s+the\s+next\s+cue\b|\bReason\s*:\s*(?:idle_auto|repetition_guard|question_loop|burst_limit|waiting_user|director_followup|cooldown)\b|\b(?:idle_auto|repetition_guard|question_loop|burst_limit|waiting_user|director_followup)\b|\u8bf7\u81ea\u7136\u5730\u6536\u675f\u5f53\u524d\u8282\u594f|\u7ed9\u51fa\u4e0b\u4e00\u6b65\u63d0\u793a|\u539f\u56e0\s*[：:]\s*(?:idle_auto|repetition_guard|question_loop|burst_limit|waiting_user|director_followup|cooldown))/i.test(normalized);
}

function sanitizeDirectorNarrationSource(text: string): string {
  if (!text.trim()) {
    return "";
  }
  const withoutInternalLines = stripMentions(text)
    .split(/\r?\n/)
    .filter((line) => !isDirectorInternalPromptText(line))
    .join(" ")
    .replace(/\bReason\s*:\s*(?:idle_auto|repetition_guard|question_loop|burst_limit|waiting_user|director_followup|cooldown)\b\.?/gi, "")
    .replace(/\u539f\u56e0\s*[：:]\s*(?:idle_auto|repetition_guard|question_loop|burst_limit|waiting_user|director_followup|cooldown)\u3002?/gi, "")
    .trim();
  if (withoutInternalLines) {
    return trimForReply(withoutInternalLines);
  }
  if (isDirectorInternalPromptText(text)) {
    return "";
  }
  return trimForReply(
    stripMentions(text)
      .replace(/\bReason\s*:\s*(?:idle_auto|repetition_guard|question_loop|burst_limit|waiting_user|director_followup|cooldown)\b\.?/gi, "")
      .replace(/\u539f\u56e0\s*[：:]\s*(?:idle_auto|repetition_guard|question_loop|burst_limit|waiting_user|director_followup|cooldown)\u3002?/gi, "")
      .trim(),
  );
}

function directorNarrationPrefersChinese(room: RoomState, userInput: string): boolean {
  const recentText = recentPublicRoomMessages(room, 3).map((message) => message.text).join(" ");
  return prefersChinese(`${userInput} ${room.topic} ${recentText}`);
}

function isExplicitPublicDirectorTextRequest(userInput: string, move: RoomDirectorMove): boolean {
  const normalized = stripMentions(userInput).toLowerCase();
  if (!normalized) {
    return false;
  }
  const asksPublic = /(公开|全员|大家|宣布|播报|告诉大家|向全体|public|announce|all)/i.test(normalized);
  const asksRecap = /(总结|复盘|回顾|收束|recap|summary)/i.test(normalized);
  const asksHostCue = /(主持|开场|下一轮|推进|继续|cue|host|next round|continue)/i.test(normalized);
  if (move === "recap") {
    return asksPublic || asksRecap;
  }
  if (move === "cue" || move === "twist") {
    return asksPublic && asksHostCue;
  }
  return asksPublic;
}

function isPrivateRoomChannelActive(room: RoomState): boolean {
  return room.activeChannelId.startsWith("faction:") || room.activeChannelId.startsWith("private:");
}

function createModeDirectorPublicText(
  room: RoomState,
  move: RoomDirectorMove,
  userInput: string,
  judgement: JudgementCheck | undefined,
  modeIntent: DirectorModeIntent | undefined,
  chinese: boolean,
): string | null {
  const intent = modeIntent ?? resolveDirectorModeIntent(room, userInput);
  const topic = trimForReply(extractDebateMotion(room, userInput) || room.topic || stripMentions(userInput), 96);
  const player = room.userProfile.displayName;

  if (intent.mode === "debate" && (intent.key === "debate_final_verdict" || intent.key === "debate_advantage_check")) {
    const outcome = createDebateDirectorVerdictOutcome(room, userInput, new Date().toISOString());
    if (outcome) {
      return outcome.publicText;
    }
  }

  if (judgement) {
    return immersiveJudgementText(judgement, chinese);
  }

  if (intent.mode === "debate") {
    if (intent.key === "debate_setup") {
      return createDebateDirectorSetupText(room, userInput, chinese);
    }
    if (intent.key === "debate_advantage_check") {
      return chinese
        ? "这一轮先看论点质量、证据和反驳力度；双方完成发言后再给出优势变化。"
        : "This round will be judged on argument quality, evidence, and rebuttal strength after both sides speak.";
    }
    return chinese
      ? "按当前辩题继续轮次：先给出一个清楚观点，再由对方回应；不要复读主持要求。"
      : "Continue the round on the current motion: one clear point first, then the other side responds without repeating setup wording.";
  }

  if (intent.mode === "story") {
    if (move === "choice" || intent.key === "story_choice") {
      return chinese
        ? "@" + player + " 这里出现了分叉：继续推进当前行动，让另一个角色试探，或者先观察现场变化。"
        : "@" + player + " The scene has a fork: push the current action, let another role test it, or pause to observe the change.";
    }
    if (move === "twist") {
      return chinese
        ? "局面多了一层阻力，但它没有推翻已经发生的事；接下来要看角色怎么处理。"
        : "A complication appears without rewriting what already happened; the next step depends on how the roles handle it.";
    }
    if (move === "cue") {
      const scene = trimForReply(room.director.sceneBoard.currentScene || room.topic, 72);
      return chinese
        ? `${scene || "房间"}短暂安静了一下，刚才被忽略的细节重新压回到众人面前。`
        : `${scene || "The room"} falls quiet for a beat, and an overlooked detail presses back into view.`;
    }
    return chinese
      ? "场面继续向前推进，但只有已经看见或确认的内容会成为事实。"
      : "The scene moves forward, but only visible or established details become facts.";
  }

  if (intent.mode === "mystery") {
    if (intent.key === "mystery_reveal_boundary") {
      return chinese
        ? "现在还不能把真相一次性摊开；先确认哪些线索已经公开，哪些仍只属于少数人知道。"
        : "The full truth should not be laid out at once; first separate public clues from what only a few people know.";
    }
    if (move === "cue") {
      if (/(\u7ebf\u7d22|clue)/i.test(userInput)) {
        return chinese
          ? "一条线索被推到明面上：它还不能证明真相，但足够让房间里的判断偏移一下。"
          : "A clue moves into the open: it proves nothing yet, but it is enough to shift the room's attention.";
      }
      return chinese
        ? "有个细节忽然变得不太对劲：它还不能证明什么，但足够让房间里的判断偏移一下。"
        : "One detail starts to feel wrong: it proves nothing yet, but it is enough to shift the room's attention.";
    }
    return chinese
      ? "这条线索能解释一部分，但还缺少动机、时机或证据之间的连接。"
      : "This clue explains part of it, but motive, timing, or the link between evidence is still missing.";
  }

  if (intent.mode === "study") {
    if (intent.key === "study_check_understanding" || move === "choice") {
      return chinese
        ? "先停在这个知识点。你试着用自己的话复述一遍，我再补缺口。"
        : "Pause on this point. Try restating it in your own words, then I will fill the gaps.";
    }
    if (move === "recap") {
      return chinese
        ? "先把当前知识点收束成一句话，再决定要例子、练习还是继续往下。"
        : "First compress the current point into one sentence, then choose an example, practice, or the next step.";
    }
    return chinese
      ? "先讲一个小步骤，确认能跟上后再继续。"
      : "Take one small step first, then continue after it is clear.";
  }

  if (intent.mode === "planning") {
    if (intent.key === "planning_risk_check") {
      return chinese
        ? "当前问题主要在风险、约束和成本，不在目标本身；先把这些拆开再决定。"
        : "The issue is mainly risk, constraints, and cost, not the goal itself; split those before deciding.";
    }
    return chinese
      ? "当前分歧在决策标准和下一步执行方式。先列选项、风险和负责人，再确认。"
      : "The split is in decision criteria and execution. List options, risks, and owners before confirming.";
  }

  if (intent.mode === "team_channel") {
    if (intent.key === "team_channel_public_response") {
      return chinese
        ? "先决定哪些内容可以带回公开频道；内部策略不要直接外泄。"
        : "Decide what can return to the public channel first; do not leak internal strategy directly.";
    }
    return chinese
      ? "先把本阵营的目标、分工和公开回应边界收拢成一个短策略。"
      : "First condense this faction's goal, roles, and public-response boundary into one short strategy.";
  }

  if (move === "pause") {
    return chinese ? "先停一下，等 " + player + " 决定要不要换话题或继续。" : "Pause here until " + player + " decides whether to switch topics or continue.";
  }
  return null;
}

function createDirectorPlanText(
  room: RoomState,
  move: RoomDirectorMove,
  userInput: string,
  sceneDelta: SceneDelta,
  judgement?: JudgementCheck,
  modeIntent?: DirectorModeIntent,
): string {
  const chinese = directorNarrationPrefersChinese(room, userInput);
  const player = room.userProfile.displayName;
  const clues = [...(sceneDelta.addClues ?? []), ...room.director.sceneBoard.openClues].slice(0, 2).join(" / ") || (chinese ? "暂无公开线索" : "no open clues yet");

  if (isDebateSetupRequest(room, userInput)) {
    return createDebateDirectorSetupText(room, userInput, chinese);
  }
  if (judgement) {
    return immersiveJudgementText(judgement, chinese);
  }
  const modeText = createModeDirectorPublicText(room, move, userInput, judgement, modeIntent, chinese);
  if (modeText) {
    return modeText;
  }
  if (move === "cue") {
    const mode = modeIntent?.mode ?? resolveDirectorModeIntent(room, userInput).mode;
    const detail = trimForReply(userInput || room.director.sceneBoard.currentScene || room.topic, 96);
    if (mode === "casual") {
      return chinese
        ? "话题短暂停了一下，刚才那句话还留在房间里，等着有人自然接上。"
        : "The conversation pauses for a beat, leaving the last remark in the room for someone to pick up naturally.";
    }
    if (mode === "story") {
      return chinese
        ? "场面停了一拍，一个可回应的变化从刚才的行动里露出来。"
        : "The scene holds for a beat, and a response-worthy change emerges from the last action.";
    }
    if (mode === "mystery") {
      return chinese
        ? "有个细节开始显得不对劲，但它还没有足够证据变成结论。"
        : "One detail starts to feel wrong, but it is not enough to become a conclusion yet.";
    }
    return chinese
      ? `房间里的注意力重新落到这里：${detail || "还有一件事没有被接住"}。`
      : `The room's attention settles here: ${detail || "one point still needs a response"}.`;
  }
  if (move === "twist") {
    return chinese ? "局面忽然多了一层麻烦，但还没有人看清全部原因。" : "The scene gains a complication, but not everyone can see why yet.";
  }
  if (move === "choice") {
    return chinese
      ? "用户输入保持可选；房间会优先让角色自然接上，除非当前确实需要用户选择。"
      : "User input remains optional; the room should continue through role flow unless a hard choice is required.";
  }
  if (move === "whisper") {
    return chinese ? "有些话只在暗处传了过去，暂时没有进入公开谈话。" : "A private thread moves quietly; it does not enter the public exchange yet.";
  }
  if (move === "pause") {
    return chinese
      ? "场面暂时停在这里，但用户不需要被调度；只有明确分支才等待输入。"
      : "The scene holds here without scheduling the user; only an explicit branch should wait for input.";
  }
  return chinese
    ? `当前场景：${room.director.sceneBoard.currentScene || "还没有明确场景"}。目标：${room.director.sceneBoard.goal || "等待下一步"}。公开线索：${clues}。`
    : `Current scene: ${room.director.sceneBoard.currentScene || "not established yet"}. Goal: ${room.director.sceneBoard.goal || "waiting for the next step"}. Open clues: ${clues}.`;
}

function immersiveJudgementText(judgement: JudgementCheck, chinese: boolean): string {
  const action = trimForReply(judgement.action, 72);
  const consequence = trimForReply(judgement.consequence, 110);
  if (chinese) {
    if (judgement.outcome === "success") {
      return `${action} 成了。${consequence}`;
    }
    if (judgement.outcome === "partial_success") {
      return `${action} 勉强推进了一步，但代价也跟着出现了。${consequence}`;
    }
    if (judgement.outcome === "fail") {
      return `${action} 没能如愿，局面反而多了新的压力。${consequence}`;
    }
    if (judgement.outcome === "blocked") {
      return `${action} 没有成立；眼前的条件不支持这个结果。`;
    }
    return `${action} 牵出了一个必须先选择的分叉。${consequence}`;
  }
  if (judgement.outcome === "success") {
    return `${action} works. ${consequence}`;
  }
  if (judgement.outcome === "partial_success") {
    return `${action} partly works, but it brings a cost. ${consequence}`;
  }
  if (judgement.outcome === "fail") {
    return `${action} does not go as hoped, and the scene gains pressure. ${consequence}`;
  }
  if (judgement.outcome === "blocked") {
    return `${action} does not hold; the visible conditions do not support that result.`;
  }
  return `${action} opens a choice that needs to be made first. ${consequence}`;
}

function chooseSuggestedRoleId(room: RoomState, userInput: string): string | null {
  const lower = userInput.toLowerCase();
  const named = room.participants.find((participant) =>
    [participant.name, participant.displayName, participant.packId].some((name) => lower.includes(name.toLowerCase())),
  );
  if (named) {
    return named.id;
  }
  return room.participants.find((participant) => participant.id !== room.lastSpeakerId)?.id ?? room.participants[0]?.id ?? null;
}

function directorKnownFacts(room: RoomState, directorMemory?: RoomDirectorMemorySnapshot): string[] {
  return dedupeTextList([
    room.director.sceneBoard.currentScene,
    room.director.sceneBoard.goal,
    ...room.director.sceneBoard.openClues,
    ...room.director.sceneBoard.unresolved,
    ...room.director.constraints.filter((item) => item.status === "active" || item.status === "needs_review").map((item) => `${item.label}: ${item.detail}`),
    ...(directorMemory?.sceneBoard.openClues ?? []),
    ...(directorMemory?.continuity.entries.map((entry) => entry.detail) ?? []),
    ...(directorMemory?.entries.filter((entry) => entry.status !== "archived").map((entry) => entry.text) ?? []),
    ...(directorMemory?.secrets.map((secret) => `${secret.title}: ${secret.detail}`) ?? []),
    ...recentPublicRoomMessages(room, 6).map((message) => `${message.speaker}: ${message.text}`),
  ]);
}

function detectActor(room: RoomState, userInput: string): string {
  const lower = userInput.toLowerCase();
  const role = room.participants.find((participant) => lower.includes(participant.name.toLowerCase()) || lower.includes(participant.displayName.toLowerCase()));
  return role?.name ?? room.userProfile.displayName;
}

function detectIntent(userInput: string, action: string): string {
  if (/为了|想要|以便|so that|in order/i.test(userInput)) {
    return trimForReply(userInput);
  }
  if (/怎么|如何|哪一个|which|what should/i.test(userInput)) {
    return "Ask for a concrete next choice";
  }
  return `Resolve action: ${action}`;
}

function detectDifficulty(action: string, facts: string[], room: RoomState): JudgementDifficulty {
  if (isRoomAppSafetyText(action)) {
    return "blocked";
  }
  const matchingConstraint = room.director.constraints.find(
    (constraint) => constraint.status === "active" && isRelevantFact(action, constraint.detail),
  );
  if (matchingConstraint?.scope === "director" || matchingConstraint?.scope === "knowledge") {
    return "hard";
  }
  if (/(撬|破解|攻击|强行|说服|潜入|偷|开锁|进入|lock|force|attack|hack|sneak|steal|persuade)/i.test(action)) {
    return facts.some((fact) => isRelevantFact(action, fact)) ? "normal" : "hard";
  }
  if (facts.some((fact) => isRelevantFact(action, fact))) {
    return "easy";
  }
  return "normal";
}

function judgeOutcome(action: string, difficulty: JudgementDifficulty, evidence: string[], gatedWorldStateAction = false): JudgementOutcome {
  if (difficulty === "blocked") {
    return "blocked";
  }
  if (/(怎么办|选择|哪一个|which|what should)/i.test(action)) {
    return "needs_player_choice";
  }
  if (gatedWorldStateAction && evidence.length === 0) {
    return "fail";
  }
  if (difficulty === "easy") {
    return "success";
  }
  if (difficulty === "normal") {
    return evidence.length > 0 ? "success" : "partial_success";
  }
  return evidence.length > 0 ? "partial_success" : "fail";
}

function judgementConsequence(action: string, outcome: JudgementOutcome, evidence: string[]): string {
  const chinese = prefersChinese(action);
  if (outcome === "blocked") {
    return chinese ? "这个行动被房间安全规则阻止。" : "The action is blocked by room safety rules.";
  }
  if (outcome === "needs_player_choice") {
    return chinese ? "房间等待玩家选择一个具体下一步。" : "The room waits for the player to choose a concrete next action.";
  }
  if (outcome === "success") {
    return evidence[0]
      ? chinese
        ? `行动成立，因为：${trimForReply(evidence[0], 72)}。`
        : `It works because ${trimForReply(evidence[0], 72)}.`
      : chinese
        ? "行动成功，房间可以继续推进。"
        : "The action succeeds and the room can move forward.";
  }
  if (outcome === "partial_success") {
    return chinese ? "行动部分成功，但会带来一个可见代价。" : "The action works, but it creates a visible complication.";
  }
  return chinese
    ? "尝试失败，但会暴露一个新阻碍或可追的下一步。"
    : "The attempt fails, but it reveals a new obstacle or a follow-up opportunity.";
}

function isRelevantFact(action: string, fact: string): boolean {
  const actionTokens = action.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((item) => item.length >= 2);
  const lowerFact = fact.toLowerCase();
  if (actionTokens.some((token) => lowerFact.includes(token))) {
    return true;
  }
  return (
    (/钥匙|key/.test(action) && /钥匙|key/.test(fact)) ||
    (/门|锁|door|lock/.test(action) && /门|锁|door|lock/.test(fact)) ||
    (/秘密|线索|secret|clue/.test(action) && /秘密|线索|secret|clue/.test(fact))
  );
}

function isGatedWorldStateAction(action: string): boolean {
  return /(?:\block\b|\blocked\b|\bunlock\b|\bunlocked\b|\bpick\s+lock\b|\bkey\b|\baccess\b|[\u9501\u94a5]|\u95e8\u9501|\u6302\u9501|\u5f00\u9501|\u89e3\u9501|\u64ac\u9501|\u901a\u884c\u6743|\u6743\u9650)/i.test(action);
}

function isActionSupportEvidence(action: string, fact: string): boolean {
  const lowerFact = fact.toLowerCase();
  if (!isGatedWorldStateAction(action)) {
    return true;
  }
  return /(?:\bkey\b|\btool\b|\bpermission\b|\baccess\b|\bskill\b|\bcan\s+(?:open|unlock|pick)\b|\bhas\s+(?:the\s+)?key\b|\bunlocked\b|\bnot\s+locked\b|[\u94a5\u5de5\u5177]|\u94a5\u5319|\u6743\u9650|\u901a\u884c|\u6388\u6743|\u53ef\u4ee5(?:\u6253\u5f00|\u89e3\u9501|\u901a\u8fc7)|\u672a\u4e0a\u9501|\u6ca1\u4e0a\u9501|\u5df2\u89e3\u9501)/i.test(lowerFact);
}

function isJudgementEchoEvidence(action: string, fact: string): boolean {
  const normalizedFact = normalizeJudgementEvidenceText(fact);
  if (!normalizedFact) {
    return true;
  }
  if (
    /(?:^|\s)(?:you|user|director)\s*[:：]/i.test(normalizedFact) ||
    /(?:^|[。.\s])(?:用户|玩家|导演)\s*[:：]/.test(normalizedFact) ||
    /Director\s*(?:裁定|ruling)|裁定\s*[:：]|理由\s*[:：]|后果\s*[:：]|->\s*(?:success|partial_success|fail|blocked|needs_player_choice)/i.test(normalizedFact)
  ) {
    return true;
  }
  const cleanAction = normalizeJudgementEvidenceText(action);
  const cleanFact = normalizeJudgementEvidenceText(stripMentions(fact).replace(/^[^:：]{1,32}[:：]\s*/, ""));
  if (cleanAction.length < 4 || cleanFact.length < 4) {
    return false;
  }
  return cleanFact.includes(cleanAction) || cleanAction.includes(cleanFact);
}

function normalizeJudgementEvidenceText(value: string): string {
  return stripMentions(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function extractOwnershipWrite(room: RoomState, userInput: string): ContinuityWrite | null {
  for (const role of room.participants) {
    const names = [role.name, role.displayName, role.id].filter(Boolean).map(escapeRegExp).join("|");
    const patterns = [
      new RegExp(`(?:把|将)\\s*([^，。,.!?！？\\s]{1,24})\\s*(?:交给|给|递给|交到|托付给)\\s*(?:${names})`, "i"),
      new RegExp(`([^，。,.!?！？\\s]{1,24})\\s*(?:在|归|属于)\\s*(?:${names})`, "i"),
      new RegExp(`(?:${names})\\s*(?:拿着|持有|拥有|保管|获得|得到了)\\s*([^，。,.!?！？\\s]{1,24})`, "i"),
      new RegExp(`(?:give|hand|pass)\\s+(?:the\\s+)?(.{1,24}?)\\s+to\\s+(?:${names})`, "i"),
      new RegExp(`(?:${names})\\s+(?:has|holds|keeps|owns)\\s+(?:the\\s+)?(.{1,24})`, "i"),
    ];
    for (const pattern of patterns) {
      const match = userInput.match(pattern);
      const item = cleanItemName(match?.[1] ?? "");
      if (!item) {
        continue;
      }
      return {
        label: "Continuity",
        detail: `${item} is with ${role.name}`,
        visibility: "public",
        ownerRoleIds: [role.id],
        status: "active",
      };
    }
  }
  return null;
}

function cleanItemName(value: string): string {
  return value.replace(/^(?:了|一个|一把|the|a|an)\s*/i, "").replace(/(?:交给|给|拿着|持有|拥有)$/g, "").trim().slice(0, 40);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function prefersChinese(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
}

function stripMentions(value: string): string {
  return value.replace(/(^|\s)@[\w\u4e00-\u9fff-]+/g, " ").trim();
}

function chooseDirectorWhisperTarget(room: RoomState): RoomMessageTarget {
  const nextRole = room.participants.find((participant) => participant.id !== room.lastSpeakerId) ?? room.participants[0];
  return nextRole ? { targets: [{ type: "role", roleId: nextRole.id }] } : "all";
}

function dedupeTextList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function trimForReply(value: string, maxLength = 80): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function hasQuestionLoop(room: RoomState): boolean {
  const recentCharacterMessages = room.messages.filter((message) => message.kind === "character").slice(-2);
  return recentCharacterMessages.length === 2 && recentCharacterMessages.every((message) => /[?？]\s*$/.test(message.text));
}

function lastMessageTargetsUserQuestion(room: RoomState): boolean {
  const last = latestPublicRoomMessage(room);
  return Boolean(last && last.kind === "character" && isTargetingUser(last.target, room.userProfile) && /[?？]\s*$/.test(last.text));
}

function isRepetition(room: RoomState, text: string): boolean {
  return room.messages
    .filter((message) => message.kind === "character")
    .slice(-3)
    .some((message) => normalizeRepeat(message.text) === normalizeRepeat(text));
}

function latestPublicRoomMessage(room: RoomState): ConsoleMessage | undefined {
  return [...room.messages].reverse().find(isPublicRoomTimelineMessage);
}

function recentPublicRoomMessages(room: RoomState, count: number): ConsoleMessage[] {
  return room.messages.filter(isPublicRoomTimelineMessage).slice(-count);
}

function isPublicRoomTimelineMessage(message: ConsoleMessage): boolean {
  return (message.visibility ?? "public") === "public";
}

function normalizeRepeat(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function pickRoleByIds(room: RoomState, roleIds: string[]): RoomParticipant | null {
  for (const roleId of roleIds) {
    const participant = room.participants.find((candidate) => candidate.id === roleId && candidate.id !== room.lastSpeakerId);
    if (participant) {
      return participant;
    }
  }
  return roleIds.map((roleId) => room.participants.find((candidate) => candidate.id === roleId)).find(Boolean) ?? null;
}
