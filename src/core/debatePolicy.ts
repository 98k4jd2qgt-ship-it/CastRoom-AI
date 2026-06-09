import type {
  DeferredRequirement,
  RoomDebateLifecyclePhase,
  RoomDebateFlow,
  RoomDebateFlowStep,
  RoomDebateSpeakerAssignment,
  RoomDebateSpeakerPosition,
  RoomDebateVerdict,
  DirectorStructuredOutcome,
  RoomParticipant,
  RoomState,
} from "./types";
import { getChannelVisibleRoleIds } from "./roomVisibility";

export function isDebateRoom(room: RoomState): boolean {
  return room.promptProfileId === "debate" || room.director.recipeId === "debate";
}

export function isDebateSetupRequest(room: RoomState, text: string): boolean {
  if (!isDebateRoom(room)) {
    return false;
  }
  const compact = stripMentions(text).replace(/\s+/g, " ").trim().toLowerCase();
  if (!compact) {
    return false;
  }
  return /(?:\u7ec4\u7ec7|\u4e3e\u529e|\u5f00\u59cb|\u4e3b\u6301|\u5b89\u6392|\u5206).{0,16}(?:\u8fa9\u8bba|\u8fa9\u8bba\u8d5b|\u8fa9\u624b|\u56de\u5408)|(?:\u8fa9\u9898|\u4e00\u8fa9|\u4e8c\u8fa9|\u4e09\u8fa9|\u6b63\u65b9|\u53cd\u65b9)|(?:organize|host|start|run|set up|setup|assign).{0,24}debate|debate\s+(?:setup|round|motion|speaker|moderator|host)/i.test(compact);
}

export function isDebateDeferredVerdictRequest(room: RoomState, text: string): boolean {
  if (!isDebateRoom(room)) {
    return false;
  }
  const compact = stripMentions(text).replace(/\s+/g, " ").trim().toLowerCase();
  return /(\u6700\u540e|\u7ed3\u675f\u540e|\u53d1\u8a00\u7ed3\u675f\u540e|\u8d5b\u540e|after|afterward|afterwards|finally|at\s+the\s+end|when\s+.+(?:finish|ends?)).{0,32}(\u5206\u51fa\u80dc\u8d1f|\u5224\u5b9a\u80dc\u8d1f|\u8bc4\u5224|\u88c1\u5224|\u8c01\u8d62|\u54ea\u961f\u8d62|winner|verdict|who\s+won)/i.test(compact);
}

export type DebateDirectorInputClassification =
  | "strict_setup"
  | "immediate_verdict"
  | "deferred_verdict"
  | "normal_debate_message";

function normalizedDirectorDebateInput(text: string): string {
  return stripMentions(text).replace(/\s+/g, " ").trim().toLowerCase();
}

function isImmediateDebateVerdictText(compact: string): boolean {
  const verdictWords = /(\u5206\u51fa\u80dc\u8d1f|\u5224\u5b9a\u80dc\u8d1f|\u88c1\u5224|\u8bc4\u5224|\u8c01\u8d62|\u54ea\u961f\u8d62|\u80dc\u65b9|\u83b7\u80dc|verdict|who\s+won|winner|decide\s+(?:the\s+)?winner)/i;
  const immediateWords = /(\u73b0\u5728|\u7acb\u5373|\u9a6c\u4e0a|\u5f53\u524d|\u672c\u8f6e|\u6b64\u523b|\u5148|now|right\s+now|immediately|current|this\s+round)/i;
  return (
    (immediateWords.test(compact) && verdictWords.test(compact)) ||
    /(\u88c1\u5224\u4e00\u4e0b|\u8bc4\u5224\u4e00\u4e0b|\u73b0\u5728\u8c01\u8d62|\u5f53\u524d\u8c01\u8d62|\u672c\u8f6e\u8c01\u8d62|judge\s+now|verdict\s+now)/i.test(compact)
  );
}

export function classifyDebateDirectorInput(text: string, room: RoomState): DebateDirectorInputClassification {
  if (!isDebateRoom(room)) {
    return "normal_debate_message";
  }
  const compact = normalizedDirectorDebateInput(text);
  if (!compact) {
    return "normal_debate_message";
  }
  if (isStrictDebateSetupText(text)) {
    return "strict_setup";
  }
  if (isDebateDeferredVerdictRequest(room, text)) {
    return "deferred_verdict";
  }
  if (isImmediateDebateVerdictText(compact)) {
    return "immediate_verdict";
  }
  return "normal_debate_message";
}

export function isDebateVerdictRequest(room: RoomState, text: string): boolean {
  if (!isDebateRoom(room)) {
    return false;
  }
  const classification = classifyDebateDirectorInput(text, room);
  if (classification === "strict_setup" || classification === "deferred_verdict") {
    return false;
  }
  const compact = normalizedDirectorDebateInput(text);
  const setupWithFutureVerdict =
    /(\u7ec4\u7ec7|\u4e3e\u529e|\u5f00\u59cb|\u4e3b\u6301|\u5b89\u6392|\u5206\u4e00\u8fa9|\u4e8c\u8fa9|\u4e09\u8fa9|organize|host|start|setup)/i.test(compact) &&
    /(\u6700\u540e|\u7ed3\u675f\u540e|\u8d5b\u540e|finally|at\s+the\s+end).{0,16}(\u5206\u51fa\u80dc\u8d1f|\u5224\u5b9a\u80dc\u8d1f|winner|verdict)/i.test(compact);
  if (setupWithFutureVerdict) {
    return false;
  }
  return classification === "immediate_verdict";
}

export function isDebateAdvantageRequest(room: RoomState, text: string): boolean {
  if (!isDebateRoom(room)) {
    return false;
  }
  if (classifyDebateDirectorInput(text, room) === "strict_setup") {
    return false;
  }
  if (isDebateVerdictRequest(room, text)) {
    return false;
  }
  const compact = normalizedDirectorDebateInput(text);
  return /(\u5360\u4f18|\u4f18\u52bf|\u6253\u5206|\u8bc4\u5206|\u672c\u8f6e|score|advantage|judge\s+this\s+round)/i.test(compact);
}

export function getDebateSides(room: RoomState): Array<{ id: string; name: string; count: number }> {
  const sides = room.factions
    .filter((faction) => faction.id !== "neutral")
    .map((faction) => ({
      id: faction.id,
      name: faction.name,
      count: room.participants.filter((participant) => participant.factionId === faction.id).length,
    }))
    .filter((side) => side.count > 0 || room.match.scoreboard.some((entry) => entry.id === side.id));

  if (sides.length > 0) {
    return sides;
  }

  const ids = Array.from(new Set(room.participants.map((participant) => participant.factionId).filter((id): id is string => Boolean(id) && id !== "neutral")));
  return ids.map((id) => ({ id, name: id, count: room.participants.filter((participant) => participant.factionId === id).length }));
}

export function participantDebateSide(room: RoomState, participant: RoomParticipant): string {
  return getDebateSides(room).find((side) => side.id === participant.factionId)?.name ?? participant.factionId ?? "neutral";
}

const debateSpeakerPositionOrder: RoomDebateSpeakerPosition[] = [
  "first_speaker",
  "second_speaker",
  "third_speaker",
  "free_speaker",
  "alternate",
];

const debateRequiredSpeakerPositions = new Set<RoomDebateSpeakerPosition>([
  "first_speaker",
  "second_speaker",
  "third_speaker",
  "free_speaker",
]);

function roundKey(round: number | undefined): string {
  return String(Math.max(1, Math.trunc(round || 1)));
}

function hasDeferredFinalVerdict(requirements: DeferredRequirement[] | undefined): boolean {
  return (requirements ?? []).some((requirement) => requirement.kind === "final_verdict");
}

function addDeferredFinalVerdict(requirements: DeferredRequirement[] | undefined, sourceText: string): DeferredRequirement[] {
  if (hasDeferredFinalVerdict(requirements)) {
    return requirements ?? [];
  }
  return [
    ...(requirements ?? []),
    {
      kind: "final_verdict",
      summary: "All assigned debate speakers finish before the final verdict.",
      trigger: "all_relevant_speakers_done",
      sourceText,
    },
  ];
}

const debateSpeakerPositionLabelZh: Record<RoomDebateSpeakerPosition, string> = {
  first_speaker: "一辩",
  second_speaker: "二辩",
  third_speaker: "三辩",
  free_speaker: "自由辩手",
  alternate: "替补",
};

const debateSpeakerPositionLabelEn: Record<RoomDebateSpeakerPosition, string> = {
  first_speaker: "first speaker",
  second_speaker: "second speaker",
  third_speaker: "third speaker",
  free_speaker: "free speaker",
  alternate: "alternate",
};

export function debateSpeakerPositionLabel(position: RoomDebateSpeakerPosition, language: "zh-CN" | string = "en"): string {
  return language === "zh-CN" ? debateSpeakerPositionLabelZh[position] : debateSpeakerPositionLabelEn[position];
}

export function getDebateSpeakerAssignment(
  room: RoomState,
  participant: RoomParticipant | null | undefined,
): RoomDebateSpeakerAssignment | null {
  if (!participant) {
    return null;
  }
  return (room.match.speakerAssignments ?? []).find((assignment) => assignment.roleId === participant.id) ?? null;
}

export function debateSpeakerSequence(room: RoomState): RoomDebateSpeakerAssignment[] {
  const assignments = room.match.speakerAssignments ?? [];
  const roleOrder = new Map(room.participants.map((participant, index) => [participant.id, index]));
  const sideOrder = getDebateSides(room).map((side) => side.id);
  const sequence: RoomDebateSpeakerAssignment[] = [];

  for (const position of debateSpeakerPositionOrder) {
    for (const sideId of sideOrder) {
      const sideAssignments = assignments
        .filter((assignment) => assignment.factionId === sideId && assignment.position === position)
        .sort((left, right) => (roleOrder.get(left.roleId) ?? 0) - (roleOrder.get(right.roleId) ?? 0));
      sequence.push(...sideAssignments);
    }
  }

  const sequencedIds = new Set(sequence.map((assignment) => assignment.roleId));
  const remainder = assignments
    .filter((assignment) => !sequencedIds.has(assignment.roleId))
    .sort((left, right) => (roleOrder.get(left.roleId) ?? 0) - (roleOrder.get(right.roleId) ?? 0));
  return [...sequence, ...remainder];
}

export function orderedDebateAssignments(room: RoomState): RoomDebateSpeakerAssignment[] {
  return debateSpeakerSequence(room);
}

export function requiredDebateSpeakerAssignments(room: RoomState): RoomDebateSpeakerAssignment[] {
  return debateSpeakerSequence(room).filter((assignment) => debateRequiredSpeakerPositions.has(assignment.position));
}

export function debateSpokenRoleIdsForRound(room: RoomState, round = room.match.round || 1): string[] {
  const key = roundKey(round);
  const validRoleIds = new Set(room.participants.map((participant) => participant.id));
  return Array.from(new Set(room.match.spokenRoleIdsByRound?.[key] ?? [])).filter((roleId) => validRoleIds.has(roleId));
}

export function debateSkippedRoleIdsForRound(room: RoomState, round = room.match.round || 1): string[] {
  const key = roundKey(round);
  const validRoleIds = new Set(room.participants.map((participant) => participant.id));
  return Array.from(new Set(room.match.skippedRoleIdsByRound?.[key] ?? [])).filter((roleId) => validRoleIds.has(roleId));
}

export function debateMaterialStats(room: RoomState): {
  activeSideCount: number;
  publicRoleMessageCount: number;
  requiredSpeakerCount: number;
  spokenRequiredSpeakerCount: number;
  skippedRequiredSpeakerCount: number;
} {
  const requiredAssignments = requiredDebateSpeakerAssignments(room);
  const requiredRoleIds = new Set(requiredAssignments.map((assignment) => assignment.roleId));
  const spokenRoleIds = new Set(debateSpokenRoleIdsForRound(room));
  const skippedRoleIds = new Set(debateSkippedRoleIdsForRound(room));
  const participantById = new Map(room.participants.map((participant) => [participant.id, participant]));
  const activeSideIds = new Set<string>();
  let publicRoleMessageCount = 0;

  for (const message of room.messages) {
    if (message.speakerType !== "role" || message.visibility === "private_ai" || message.visibility === "faction_huddle" || !message.speakerId) {
      continue;
    }
    const factionId = participantById.get(message.speakerId)?.factionId;
    if (factionId && factionId !== "neutral") {
      activeSideIds.add(factionId);
      publicRoleMessageCount += 1;
    }
  }

  return {
    activeSideCount: activeSideIds.size,
    publicRoleMessageCount,
    requiredSpeakerCount: requiredAssignments.length,
    spokenRequiredSpeakerCount: requiredAssignments.filter((assignment) => requiredRoleIds.has(assignment.roleId) && spokenRoleIds.has(assignment.roleId)).length,
    skippedRequiredSpeakerCount: requiredAssignments.filter((assignment) => requiredRoleIds.has(assignment.roleId) && skippedRoleIds.has(assignment.roleId)).length,
  };
}

export function debateLifecyclePhase(room: RoomState): RoomDebateLifecyclePhase {
  if (!isDebateRoom(room)) {
    return room.match.debatePhase ?? "cooldown";
  }
  if (room.match.lastVerdict?.scope === "final") {
    return "verdict_recorded";
  }
  const sides = getDebateSides(room);
  const requiredAssignments = requiredDebateSpeakerAssignments(room);
  const motion = (room.match.motion || room.topic || "").trim();
  const stats = debateMaterialStats(room);
  const allRequiredSpeakersDone =
    requiredAssignments.length > 0 &&
    stats.spokenRequiredSpeakerCount + stats.skippedRequiredSpeakerCount >= requiredAssignments.length;
  const strictFlow = room.match.debateFlow;
  const strictFlowDone =
    Boolean(strictFlow?.steps.length) &&
    strictFlow!.steps
      .filter((step) => !step.requiresDirector)
      .every((step) => strictFlow!.completedStepIds.includes(step.id));
  if (strictFlowDone) {
    return "verdict_due";
  }
  if (hasDeferredFinalVerdict(room.match.deferredRequirements) && allRequiredSpeakersDone && stats.activeSideCount >= 2) {
    return "verdict_due";
  }
  if (!motion || sides.length < 2 || requiredAssignments.length === 0) {
    return stats.publicRoleMessageCount > 0 ? "round_active" : "setup_pending";
  }
  return "round_active";
}

function pendingDebateSpeakerAssignmentsForRound(
  room: RoomState,
  visibleRoleIds = getChannelVisibleRoleIds(room, room.activeChannelId),
): RoomDebateSpeakerAssignment[] {
  const visible = new Set(visibleRoleIds);
  const spoken = new Set(debateSpokenRoleIdsForRound(room));
  const skipped = new Set(debateSkippedRoleIdsForRound(room));
  return debateSpeakerSequence(room).filter((assignment) => {
    const participant = room.participants.find((candidate) => candidate.id === assignment.roleId);
    return Boolean(participant && visible.has(assignment.roleId) && !spoken.has(assignment.roleId) && !skipped.has(assignment.roleId));
  });
}

function advanceDebateMatchAfterRoundProgress(room: RoomState, nextMatch: RoomState["match"]): RoomState["match"] {
  const updatedRoom: RoomState = { ...room, match: nextMatch };
  const lifecyclePhase = debateLifecyclePhase(updatedRoom);
  if (lifecyclePhase === "verdict_due" || lifecyclePhase === "verdict_recorded") {
    return {
      ...nextMatch,
      debatePhase: lifecyclePhase,
      nextSpeakerRoleId: undefined,
      nextPosition: undefined,
    };
  }

  const strictFlowRoom: RoomState = { ...room, match: nextMatch };
  const strictFlowStep = resolveNextDebateFlowStep(strictFlowRoom);
  if (strictFlowStep?.roleId) {
    const strictAssignment = nextMatch.speakerAssignments.find((assignment) => assignment.roleId === strictFlowStep.roleId);
    return {
      ...nextMatch,
      debatePhase: "round_active",
      currentSide: strictAssignment?.factionId ?? strictFlowStep.sideId ?? nextMatch.currentSide,
      nextSpeakerRoleId: strictFlowStep.roleId,
      nextPosition: strictAssignment?.position ?? strictFlowStep.position,
    };
  }
  if (strictFlowStep?.requiresDirector) {
    return {
      ...nextMatch,
      debatePhase: strictFlowStep.type === "director_verdict" ? "verdict_due" : "round_active",
      nextSpeakerRoleId: undefined,
      nextPosition: undefined,
    };
  }
  if (nextMatch.debateFlow?.steps.length && !strictFlowStep) {
    return {
      ...nextMatch,
      debatePhase: "verdict_due",
      nextSpeakerRoleId: undefined,
      nextPosition: undefined,
    };
  }

  const pendingForRound = pendingDebateSpeakerAssignmentsForRound(updatedRoom);
  const nextAssignment = pendingForRound[0] ?? null;
  if (nextAssignment) {
    return {
      ...nextMatch,
      debatePhase: "round_active",
      currentSide: nextAssignment.factionId,
      nextSpeakerRoleId: nextAssignment.roleId,
      nextPosition: nextAssignment.position,
    };
  }

  const nextRound = (nextMatch.round || 1) + 1;
  const nextRoundRoom: RoomState = {
    ...room,
    match: {
      ...nextMatch,
      round: nextRound,
      debatePhase: "round_active",
      nextSpeakerRoleId: undefined,
      nextPosition: undefined,
    },
  };
  const firstNextRoundAssignment = pendingDebateSpeakerAssignmentsForRound(nextRoundRoom)[0] ?? debateSpeakerSequence(nextRoundRoom)[0] ?? null;
  return {
    ...nextMatch,
    debatePhase: "round_active",
    round: nextRound,
    currentSide: firstNextRoundAssignment?.factionId ?? nextMatch.currentSide,
    nextSpeakerRoleId: firstNextRoundAssignment?.roleId,
    nextPosition: firstNextRoundAssignment?.position,
  };
}

export function advanceDebateMatchAfterSkippedSpeaker(room: RoomState, speakerRoleId: string): RoomState["match"] {
  if (!isDebateRoom(room)) {
    return room.match;
  }
  const assignments = debateSpeakerSequence(room);
  if (assignments.length === 0) {
    return room.match;
  }
  const currentRound = room.match.round || 1;
  const key = roundKey(currentRound);
  const skippedForRound = Array.from(new Set([...(room.match.skippedRoleIdsByRound?.[key] ?? []), speakerRoleId]));
  const skippedRoleIdsByRound = {
    ...(room.match.skippedRoleIdsByRound ?? {}),
    [key]: skippedForRound,
  };
  const matchWithSkipped: RoomState["match"] = {
    ...room.match,
    skippedRoleIdsByRound,
  };
  return advanceDebateMatchAfterRoundProgress(room, matchWithSkipped);
}

export function isDebateFinalVerdictDue(room: RoomState): boolean {
  return debateLifecyclePhase(room) === "verdict_due";
}

export function resolveNextDebateSpeakerAssignment(
  room: RoomState,
  visibleRoleIds = getChannelVisibleRoleIds(room, room.activeChannelId),
): RoomDebateSpeakerAssignment | null {
  const flowStep = resolveNextDebateFlowStep(room, visibleRoleIds);
  if (flowStep?.roleId) {
    return (room.match.speakerAssignments ?? []).find((assignment) => assignment.roleId === flowStep.roleId) ?? null;
  }

  const visible = new Set(visibleRoleIds);
  const sequence = debateSpeakerSequence(room).filter((assignment) => {
    const participant = room.participants.find((candidate) => candidate.id === assignment.roleId);
    return participant && visible.has(assignment.roleId);
  });
  if (sequence.length === 0) {
    return null;
  }

  const configuredNext = room.match.nextSpeakerRoleId
    ? sequence.find((assignment) => assignment.roleId === room.match.nextSpeakerRoleId)
    : null;
  const pending = pendingDebateSpeakerAssignmentsForRound(room, visibleRoleIds);
  if (configuredNext && pending.some((assignment) => assignment.roleId === configuredNext.roleId)) {
    return configuredNext;
  }
  if (pending.length > 0) {
    return pending[0];
  }

  return null;
}

export function isStrictDebateFlow(room: RoomState): boolean {
  const flow = room.match.debateFlow;
  return Boolean(flow && flow.steps.length > 0 && flow.currentStepIndex >= 0);
}

export function resolveNextDebateFlowStep(
  room: RoomState,
  visibleRoleIds = getChannelVisibleRoleIds(room, room.activeChannelId),
): RoomDebateFlowStep | null {
  const flow = room.match.debateFlow;
  if (!flow?.steps.length) {
    return null;
  }
  const visible = new Set(visibleRoleIds);
  const completed = new Set(flow.completedStepIds ?? []);
  for (let index = Math.max(0, flow.currentStepIndex || 0); index < flow.steps.length; index += 1) {
    const step = flow.steps[index];
    if (completed.has(step.id)) {
      continue;
    }
    if (step.requiresDirector) {
      return step;
    }
    if (step.roleId && visible.has(step.roleId)) {
      return step;
    }
    if (step.roleId && !visible.has(step.roleId)) {
      return step;
    }
  }
  return null;
}

export function strictDebateFlowTurnTask(room: RoomState, participant: RoomParticipant, language: "zh-CN" | string = "en"): string | null {
  const step = resolveNextDebateFlowStep(room);
  if (!step || step.requiresDirector || step.roleId !== participant.id) {
    return null;
  }
  const assignment = getDebateSpeakerAssignment(room, participant);
  const side = participantDebateSide(room, participant);
  if (language === "zh-CN") {
    return [
      `严格辩论环节：${step.publicLabel}。`,
      `你是${side}${assignment ? debateSpeakerPositionLabel(assignment.position, "zh-CN") : "辩手"}。`,
      step.task,
      "只能完成当前环节任务，不要主持比赛、安排下一位、复述赛制配置或替其他辩位总结。",
    ].join(" ");
  }
  return [
    `Strict debate step: ${step.publicLabel}.`,
    `You are ${side} ${assignment ? debateSpeakerPositionLabel(assignment.position, "en") : "speaker"}.`,
    step.task,
    "Complete only this step. Do not host, schedule the next speaker, repeat the setup, or speak for another position.",
  ].join(" ");
}

export function parseDebateFlowSetup(text: string, room: RoomState): RoomDebateFlow | null {
  if (!isDebateRoom(room) || !isStrictDebateSetupText(text)) {
    return null;
  }
  const language = prefersChinese(text) ? "zh-CN" : "en";
  const motion = extractStrictDebateMotion(room, text);
  const steps = buildStandardChineseDebateSteps(room, language);
  if (!motion || steps.filter((step) => step.type === "role_speech" || step.type === "free_debate").length === 0) {
    return null;
  }
  return {
    format: language === "zh-CN" ? "standard_cn" : "custom",
    language,
    motion,
    steps,
    currentStepIndex: steps.findIndex((step) => !step.requiresDirector),
    completedStepIds: steps.filter((step) => step.type === "director_opening").map((step) => step.id),
    sourceText: trimForReply(text, 240),
    updatedAt: new Date().toISOString(),
  };
}

export function advanceDebateFlowAfterMessage(room: RoomState, speakerRoleId: string): RoomDebateFlow | undefined {
  const flow = room.match.debateFlow;
  if (!flow?.steps.length) {
    return flow;
  }
  const completed = new Set(flow.completedStepIds ?? []);
  let currentStepIndex = Math.max(0, flow.currentStepIndex || 0);
  for (let index = currentStepIndex; index < flow.steps.length; index += 1) {
    const step = flow.steps[index];
    if (completed.has(step.id)) {
      continue;
    }
    if (step.roleId === speakerRoleId) {
      completed.add(step.id);
      currentStepIndex = index + 1;
    }
    break;
  }
  while (currentStepIndex < flow.steps.length && completed.has(flow.steps[currentStepIndex].id)) {
    currentStepIndex += 1;
  }
  return {
    ...flow,
    currentStepIndex,
    completedStepIds: Array.from(completed),
    updatedAt: new Date().toISOString(),
  };
}

function isStrictDebateSetupText(text: string): boolean {
  return /(?:标准辩论赛|中文标准|严格赛制|辩论配置|论赛配置|赛制|流程|一辩|二辩|三辩|四辩|裁判|主持开场|自由辩|结辩)/i.test(text) &&
    /(?:辩题|正方|反方|affirmative|negative|motion|流程|一辩|二辩|三辩)/i.test(text);
}

function extractStrictDebateMotion(room: RoomState, text: string): string {
  const stripped = stripMentions(text).replace(/\s+/g, " ").trim();
  const explicit = stripped.match(/(?:辩题|议题|主题)\s*(?:为|是|:|：)\s*(.+?)(?=(?:正方立场|反方立场|正方|反方|赛制|流程|Director|导演任务|$))/i)?.[1]?.trim();
  if (explicit) {
    return trimForReply(explicit.replace(/[。.!?？]+$/g, ""), 120);
  }
  return extractDebateMotion(room, text);
}

function buildStandardChineseDebateSteps(room: RoomState, language: "zh-CN" | "en"): RoomDebateFlowStep[] {
  const assignments = debateSpeakerSequence(room);
  const sides = getDebateSides(room);
  const sideName = (sideId?: string) => sides.find((side) => side.id === sideId)?.name ?? sideId ?? "";
  const by = (sideIndex: number, position: RoomDebateSpeakerPosition) =>
    assignments.find((assignment) => assignment.factionId === sides[sideIndex]?.id && assignment.position === position);
  const freeBy = (sideIndex: number) =>
    by(sideIndex, "free_speaker") ?? by(sideIndex, "second_speaker") ?? by(sideIndex, "third_speaker") ?? by(sideIndex, "first_speaker");
  const roleStep = (
    id: string,
    assignment: RoomDebateSpeakerAssignment | undefined,
    labelZh: string,
    labelEn: string,
    taskZh: string,
    taskEn: string,
    type: RoomDebateFlowStep["type"] = "role_speech",
  ): RoomDebateFlowStep | null => assignment ? {
    id,
    type,
    sideId: assignment.factionId,
    position: assignment.position,
    roleId: assignment.roleId,
    publicLabel: language === "zh-CN" ? `${sideName(assignment.factionId)}${labelZh}` : `${sideName(assignment.factionId)} ${labelEn}`,
    task: language === "zh-CN" ? taskZh : taskEn,
    maxWords: type === "free_debate" ? 100 : 180,
    requiresDirector: false,
  } : null;

  return [
    {
      id: "director-opening",
      type: "director_opening",
      publicLabel: language === "zh-CN" ? "主持开场" : "Opening moderation",
      task: language === "zh-CN" ? "简短宣布辩题、双方和发言顺序。" : "Briefly announce the motion, sides, and speaking order.",
      maxWords: 90,
      requiresDirector: true,
    },
    roleStep("pro-first", by(0, "first_speaker"), "一辩立论", "first constructive", "定义辩题，提出本方核心立场和二到三个主论点。", "Define the motion and present the side's core position with two or three main reasons."),
    roleStep("con-first", by(1, "first_speaker"), "一辩立论", "first constructive", "定义反方判断标准，回应正方框架并提出本方核心立场。", "Set the negative standard, answer the affirmative frame, and present the side's core position."),
    roleStep("pro-second", by(0, "second_speaker"), "二辩补充", "second constructive", "补充论据或案例，优先回应反方一辩的核心攻击。", "Add evidence or examples and answer the opponent's strongest first-speaker attack."),
    roleStep("con-second", by(1, "second_speaker"), "二辩补充", "second constructive", "补充反方论据，拆解正方二辩或一辩留下的关键支点。", "Add negative evidence and dismantle the affirmative's key support."),
    roleStep("pro-free", freeBy(0), "攻辩/自由辩", "cross examination/free debate", "提出一个尖锐质询或直接反驳，不要总结全场。", "Ask one pointed question or give a direct rebuttal; do not summarize the whole match.", "free_debate"),
    roleStep("con-free", freeBy(1), "攻辩/自由辩", "cross examination/free debate", "回应上一问并反抛一个争点，保持交锋。", "Answer the last challenge and return one clash point.", "free_debate"),
    roleStep("pro-third", by(0, "third_speaker"), "三辩总结", "third summary", "整理主要争点，压缩本方最强反驳，不要引入过多新论点。", "Organize the clash and compress the strongest rebuttal without adding many new points."),
    roleStep("con-third", by(1, "third_speaker"), "三辩总结", "third summary", "总结反方争点，指出正方论证链最薄弱处。", "Summarize the negative clash and identify the weakest link in the affirmative case."),
  ].filter((step): step is RoomDebateFlowStep => Boolean(step));
}

export function describeDebateAssignment(room: RoomState, assignment: RoomDebateSpeakerAssignment, language: "zh-CN" | string = "en"): string {
  const participant = room.participants.find((candidate) => candidate.id === assignment.roleId);
  const name = participant?.name ?? assignment.roleId;
  return language === "zh-CN"
    ? `${name}（${debateSpeakerPositionLabel(assignment.position, language)}）`
    : `${name} (${debateSpeakerPositionLabel(assignment.position, language)})`;
}

export function formatDebateAssignments(room: RoomState, language: "zh-CN" | string = "en"): string {
  const sides = getDebateSides(room);
  const assignments = orderedDebateAssignments(room);
  return sides
    .map((side) => {
      const sideAssignments = assignments.filter((assignment) => assignment.factionId === side.id);
      if (sideAssignments.length === 0) {
        return "";
      }
      return `${side.name}: ${sideAssignments.map((assignment) => describeDebateAssignment(room, assignment, language)).join(language === "zh-CN" ? "、" : ", ")}`;
    })
    .filter(Boolean)
    .join(language === "zh-CN" ? "；" : "; ");
}

export function debateSpeakerRoleDescription(
  room: RoomState,
  participant: RoomParticipant,
  language: "zh-CN" | string = "en",
): string {
  const assignment = getDebateSpeakerAssignment(room, participant);
  if (!assignment) {
    return language === "zh-CN" ? "自动辩手" : "auto speaker";
  }
  return debateSpeakerPositionLabel(assignment.position, language);
}

export function extractDebateMotion(room: RoomState, text: string): string {
  const cleaned = stripMentions(text).replace(/\s+/g, " ").trim();
  const explicitPatterns = [
    /(?:\u8fa9\u9898|\u8bae\u9898|\u4e3b\u9898)\s*(?:\u4e3a|\u662f|:|\uff1a)\s*(.+)$/i,
    /(?:motion|topic)\s*(?:is|:)\s*(.+)$/i,
  ];
  for (const pattern of explicitPatterns) {
    const match = cleaned.match(pattern);
    const value = match?.[1]?.trim();
    if (value) {
      return trimForReply(value.replace(/[。.!?？]+$/g, ""), 96);
    }
  }

  if (!isGenericDebateTopic(room.topic)) {
    return trimForReply(room.topic, 96);
  }

  const question = cleaned.match(/(?:\u662f\u5426|\u8981\u4e0d\u8981|\u5e94\u4e0d\u5e94\u8be5|whether|should)\s*(.+)$/i)?.[0];
  return question ? trimForReply(question, 96) : "";
}

export function createDebateTurnGoal(room: RoomState, participant: RoomParticipant, index: number): string {
  const side = participantDebateSide(room, participant);
  const assignment = getDebateSpeakerAssignment(room, participant);
  if (assignment?.position === "first_speaker") {
    return `first speaker for ${side}; open with the side's core position and strongest reason, not the user's setup wording`;
  }
  if (assignment?.position === "second_speaker") {
    return `second speaker for ${side}; extend evidence or dismantle the opponent's core point without repeating the first speaker`;
  }
  if (assignment?.position === "third_speaker") {
    return `third speaker for ${side}; summarize the clash, compress the strongest rebuttal, and close the round`;
  }
  if (assignment?.position === "free_speaker") {
    return `free speaker for ${side}; add one new angle or targeted rebuttal without repeating prior speakers`;
  }
  if (assignment?.position === "alternate") {
    return `alternate for ${side}; speak only if needed with one concise support or correction`;
  }
  return index === 0
    ? `opening argument for ${side}; address the debate motion, not the user's setup wording`
    : `rebuttal or distinct supporting point for ${side}; avoid repeating the setup wording or prior speaker`;
}

export function createDebateDirectorSetupText(room: RoomState, userInput: string, chinese: boolean): string {
  const motion = extractDebateMotion(room, userInput);
  const sides = getDebateSides(room);
  const firstSide = sides[0]?.name ?? (chinese ? "\u7b2c\u4e00\u65b9" : "the first side");
  const secondSide = sides[1]?.name ?? (chinese ? "\u7b2c\u4e8c\u65b9" : "the second side");
  const assignments = formatDebateAssignments(room, chinese ? "zh-CN" : "en");

  if (!motion) {
    return chinese
      ? "\u5148\u786e\u8ba4\u8fa9\u9898\uff0c\u518d\u6309\u9635\u8425\u5206\u8f6e\u53d1\u8a00\u3002"
      : "First confirm the motion, then the sides can speak in rounds.";
  }

  if (sides.length < 2) {
    return chinese
      ? `\u8fa9\u9898\u786e\u8ba4\uff1a${motion}\u3002\u5148\u81f3\u5c11\u5206\u51fa\u4e24\u4e2a\u9635\u8425\uff0c\u518d\u5f00\u59cb\u9996\u8f6e\u53d1\u8a00\u3002`
      : `Motion confirmed: ${motion}. Assign at least two sides before the first round begins.`;
  }

  return chinese
    ? `\u8fa9\u9898\u786e\u8ba4\uff1a${motion}\u3002${assignments ? `${assignments}\u3002` : ""}\u53d1\u8a00\u987a\u5e8f\uff1a${firstSide}\u4e00\u8fa9\u5f00\u7bc7\uff0c${secondSide}\u4e00\u8fa9\u56de\u5e94\uff1b\u4e8c\u8fa9\u8865\u5145\u653b\u9632\uff0c\u4e09\u8fa9\u603b\u7ed3\u4e89\u70b9\u3002`
    : `Motion confirmed: ${motion}. ${assignments ? `${assignments}. ` : ""}Speaking order: ${firstSide} first speaker opens, ${secondSide} first speaker responds; second speakers extend the clash, third speakers summarize it.`;
}

export function createDebateDirectorMatchPatch(room: RoomState, userInput: string): Partial<RoomState["match"]> | undefined {
  if (!isDebateSetupRequest(room, userInput) && !/一辩|一辯|二辩|二辯|三辩|三辯|first\s*speaker|second\s*speaker|third\s*speaker/i.test(userInput)) {
    return undefined;
  }

  const motion = extractDebateMotion(room, userInput) || room.match.motion;
  const position = parseDebatePositionRequest(userInput);
  const requestedParticipant = position ? findDebatePositionRequestParticipant(room, userInput) : null;
  let speakerAssignments = room.match.speakerAssignments ?? [];
  const deferredRequirements = isDebateDeferredVerdictRequest(room, userInput) || isStrictDebateSetupText(userInput)
    ? addDeferredFinalVerdict(room.match.deferredRequirements, userInput)
    : room.match.deferredRequirements;

  if (position && requestedParticipant && requestedParticipant.factionId && requestedParticipant.factionId !== "neutral") {
    const existingManualForRole = speakerAssignments.find(
      (assignment) => assignment.roleId === requestedParticipant.id && assignment.locked && assignment.source === "manual",
    );
    const existingManualForSlot = speakerAssignments.find(
      (assignment) =>
        assignment.factionId === requestedParticipant.factionId &&
        assignment.position === position &&
        assignment.locked &&
        assignment.source === "manual" &&
        assignment.roleId !== requestedParticipant.id,
    );
    if (!existingManualForRole && !existingManualForSlot) {
      speakerAssignments = [
        ...speakerAssignments.filter(
          (assignment) =>
            assignment.roleId !== requestedParticipant.id &&
            !(
              assignment.factionId === requestedParticipant.factionId &&
              assignment.position === position &&
              position !== "free_speaker" &&
              position !== "alternate"
            ),
        ),
        {
          roleId: requestedParticipant.id,
          factionId: requestedParticipant.factionId,
          position,
          label: debateSpeakerPositionLabel(position, "zh-CN"),
          source: "director" as const,
          locked: true,
          updatedAt: new Date().toISOString(),
        },
      ];
    }
  }

  const roomWithMatch: RoomState = {
    ...room,
    match: {
      ...room.match,
      motion,
      speakerAssignments,
    },
  };
  const debateFlow = parseDebateFlowSetup(userInput, roomWithMatch) ?? room.match.debateFlow;
  const flowStep = debateFlow ? debateFlow.steps.find((step, index) => index >= debateFlow.currentStepIndex && !debateFlow.completedStepIds.includes(step.id) && step.roleId) : undefined;
  const firstAssignment =
    (flowStep?.roleId ? speakerAssignments.find((assignment) => assignment.roleId === flowStep.roleId) : undefined) ??
    speakerAssignments[0] ??
    room.match.speakerAssignments?.[0];
  return {
    motion,
    speakerAssignments,
    currentSide: room.match.currentSide ?? firstAssignment?.factionId,
    nextSpeakerRoleId: room.match.nextSpeakerRoleId ?? firstAssignment?.roleId,
    nextPosition: room.match.nextPosition ?? firstAssignment?.position,
    debatePhase: "round_active",
    deferredRequirements,
    debateFlow,
  };
}

export function createDebateDirectorVerdictOutcome(
  room: RoomState,
  userInput: string,
  nowLabel: string,
  options: { forceFinal?: boolean } = {},
): DirectorStructuredOutcome | null {
  const inputClassification = classifyDebateDirectorInput(userInput, room);
  if (!options.forceFinal && inputClassification === "strict_setup") {
    return null;
  }
  const finalVerdict = Boolean(options.forceFinal) || inputClassification === "immediate_verdict";
  const advantageCheck = isDebateAdvantageRequest(room, userInput);
  if (!finalVerdict && !advantageCheck) {
    return null;
  }

  const chinese = prefersChinese(`${userInput} ${room.topic}`);
  const verdict = createDebateVerdict(room, nowLabel, finalVerdict ? "final" : "round", chinese);
  const matchPatch = createDebateVerdictMatchPatch(room, verdict);
  const publicText = createDebateVerdictPublicText(verdict, chinese);
  const verdictResolved = Boolean(verdict.winnerFactionId) || verdict.winnerLabel === (chinese ? "\u5e73\u5c40" : "Tie");

  return {
    publicText,
    publicTextReason: "ruling",
    privateDirectives: [],
    plotPatch: {
      phase: verdictResolved ? "payoff" : "choice",
      publicGoal: room.match.motion || room.topic,
      currentPressure: verdict.summary,
      addUnresolved: verdictResolved ? [] : [verdict.summary],
      nextBeat: verdictResolved
        ? chinese
          ? "\u6839\u636e\u88c1\u5224\u7ed3\u679c\u5f00\u542f\u4e0b\u4e00\u8f6e\u6216\u603b\u7ed3\u3002"
          : "Use the verdict to start the next round or summarize the debate."
        : chinese
          ? "\u7ee7\u7eed\u6536\u96c6\u66f4\u660e\u786e\u7684\u8bba\u70b9\u540e\u518d\u8bc4\u5224\u3002"
          : "Gather clearer arguments before judging again.",
    },
    statePatch: {
      matchPatch,
      simulationPatch: {
        phase: "payoff",
        currentFocus: verdict.summary,
        lastRuling: verdict.summary,
        nextPressure: verdictResolved
          ? chinese
            ? "\u6839\u636e\u88c1\u5224\u7ed3\u679c\u8fdb\u5165\u4e0b\u4e00\u8f6e\u3002"
            : "Continue from the verdict into the next round."
          : chinese
            ? "\u9700\u8981\u66f4\u591a\u6709\u6548\u53d1\u8a00\u624d\u80fd\u5224\u5b9a\u80dc\u8d1f\u3002"
            : "More substantive debate is needed before a winner can be called.",
        stopReason: verdictResolved ? undefined : "waiting_user",
      },
      inspectorPatch: {
        currentFocus: verdict.summary,
        stopReason: verdictResolved ? undefined : "waiting_user",
        lastTurnOutcome: verdict.summary,
      },
    },
  };
}

function createDebateVerdict(
  room: RoomState,
  nowLabel: string,
  scope: RoomDebateVerdict["scope"],
  chinese: boolean,
): RoomDebateVerdict {
  const sideStats = scoreDebateSides(room);
  const activeSides = sideStats.filter((side) => side.messageCount > 0);
  const round = room.match.round || 1;
  const insufficient = sideStats.length < 2 || activeSides.length < 2 || activeSides.reduce((sum, side) => sum + side.messageCount, 0) < 2;

  if (insufficient) {
    const summary = chinese
      ? "\u6709\u6548\u8fa9\u8bba\u6750\u6599\u4e0d\u8db3\uff0c\u6682\u65f6\u4e0d\u5224\u5b9a\u80dc\u8d1f\u3002"
      : "There is not enough substantive debate material to call a winner yet.";
    return {
      id: `verdict-${Date.now()}`,
      scope,
      round,
      winnerLabel: chinese ? "\u6682\u672a\u5224\u5b9a" : "Undecided",
      summary,
      criteriaNotes: [
        chinese ? "\u81f3\u5c11\u9700\u8981\u4e24\u4e2a\u9635\u8425\u7684\u6709\u6548\u53d1\u8a00\u3002" : "At least two sides need substantive arguments.",
      ],
      scores: sideStats.map((side) => ({ factionId: side.id, label: side.label, qualityScore: side.qualityScore, delta: 0 })),
      decidedAt: nowLabel,
      source: "director",
    };
  }

  const sorted = [...sideStats].sort((left, right) => right.qualityScore - left.qualityScore);
  const leader = sorted[0];
  const runnerUp = sorted[1];
  const tied = !leader || !runnerUp || Math.abs(leader.qualityScore - runnerUp.qualityScore) <= 1;
  const alreadyJudgedRound = room.match.lastVerdict?.round === round && room.match.lastVerdict.scope === scope;
  const winnerFactionId = tied ? undefined : leader.id;
  const winnerLabel = tied ? (chinese ? "\u5e73\u5c40" : "Tie") : leader.label;
  const summary = tied
    ? chinese
      ? "\u672c\u8f6e\u53cc\u65b9\u63a5\u8fd1\uff0c\u6682\u5224\u5e73\u5c40\uff1a\u4e00\u65b9\u6709\u8bba\u70b9\uff0c\u53e6\u4e00\u65b9\u4e5f\u6709\u6709\u6548\u56de\u5e94\u3002"
      : "This round is close enough to call a tie: both sides made usable points and responses."
    : chinese
      ? `${leader.label}\u5360\u4f18\uff1a${leader.bestReason}`
      : `${leader.label} has the edge: ${leader.bestReason}`;

  return {
    id: `verdict-${Date.now()}`,
    scope,
    round,
    winnerFactionId,
    winnerLabel,
    summary,
    criteriaNotes: buildDebateCriteriaNotes(sideStats, chinese),
    scores: sideStats.map((side) => ({
      factionId: side.id,
      label: side.label,
      qualityScore: side.qualityScore,
      delta: !alreadyJudgedRound && winnerFactionId === side.id ? 1 : 0,
    })),
    decidedAt: nowLabel,
    source: "director",
  };
}

function createDebateVerdictMatchPatch(room: RoomState, verdict: RoomDebateVerdict): Partial<RoomState["match"]> {
  const sides = getDebateSides(room);
  const knownScoreIds = new Set(room.match.scoreboard.map((entry) => entry.id));
  const baseScoreboard = [
    ...room.match.scoreboard,
    ...sides
      .filter((side) => !knownScoreIds.has(side.id))
      .map((side) => ({ id: side.id, label: side.name, score: 0 })),
  ];
  const scoreboard = baseScoreboard.map((entry) => {
    const verdictScore = verdict.scores.find((score) => score.factionId === entry.id);
    return verdictScore ? { ...entry, label: verdictScore.label, score: entry.score + verdictScore.delta } : entry;
  });
  const unresolvedFinalVerdict =
    verdict.winnerLabel === "Undecided" || verdict.winnerLabel === "\u6682\u672a\u5224\u5b9a";
  const finalVerdictResolved = verdict.scope === "final" && !unresolvedFinalVerdict;

  return {
    scoreboard,
    judgeNotes: [verdict.summary, ...room.match.judgeNotes.filter((note) => note !== verdict.summary)].slice(0, 8),
    lastVerdict: verdict,
    debatePhase: finalVerdictResolved ? "verdict_recorded" : room.match.debatePhase,
    deferredRequirements: finalVerdictResolved
      ? (room.match.deferredRequirements ?? []).filter((requirement) => requirement.kind !== "final_verdict")
      : room.match.deferredRequirements,
  };
}

function createDebateVerdictPublicText(verdict: RoomDebateVerdict, chinese: boolean): string {
  if (!verdict.winnerFactionId && verdict.winnerLabel !== (chinese ? "\u5e73\u5c40" : "Tie")) {
    return verdict.summary;
  }
  const criteria = verdict.criteriaNotes.slice(0, 2).join(chinese ? "\u3002" : " ");
  if (chinese) {
    return `${verdict.summary}${criteria ? `\u3002${criteria}` : ""}`;
  }
  return `${verdict.summary}${criteria ? ` ${criteria}` : ""}`;
}

function scoreDebateSides(room: RoomState): Array<{
  id: string;
  label: string;
  qualityScore: number;
  messageCount: number;
  speakerCount: number;
  bestReason: string;
}> {
  const sides = getDebateSides(room);
  const recentMessages = room.messages
    .filter((message) => message.speakerType === "role" && message.visibility !== "private_ai" && message.visibility !== "faction_huddle")
    .slice(-30);

  return sides.map((side) => {
    const sideRoleIds = new Set(room.participants.filter((participant) => participant.factionId === side.id).map((participant) => participant.id));
    const sideMessages = recentMessages.filter((message) => message.speakerId && sideRoleIds.has(message.speakerId));
    const speakerCount = new Set(sideMessages.map((message) => message.speakerId).filter(Boolean)).size;
    const text = sideMessages.map((message) => message.text).join(" ");
    const uniqueTexts = new Set(sideMessages.map((message) => normalizeDebateText(message.text)).filter(Boolean));
    const repetitionPenalty = Math.max(0, sideMessages.length - uniqueTexts.size);
    const evidenceHits = countMatches(text, /(\u56e0\u4e3a|\u4f8b\u5982|\u8bc1\u636e|\u5386\u53f2|\u79d1\u5b66|\u6570\u636e|\u903b\u8f91|because|for example|evidence|data|history|science|logic)/gi);
    const rebuttalHits = countMatches(text, /(\u4f46\u662f|\u7136\u800c|\u53cd\u9a73|\u5ffd\u7565|\u56de\u5e94|\u95ee\u9898\u5728\u4e8e|however|but|rebut|respond|fails to|ignores)/gi);
    const lengthScore = Math.min(8, Math.floor(text.length / 120));
    const qualityScore = Math.max(0, sideMessages.length * 2 + speakerCount * 2 + evidenceHits + rebuttalHits + lengthScore - repetitionPenalty * 2);
    return {
      id: side.id,
      label: side.name,
      qualityScore,
      messageCount: sideMessages.length,
      speakerCount,
      bestReason: bestDebateReason({ evidenceHits, rebuttalHits, speakerCount, sideMessages: sideMessages.length }),
    };
  });
}

function buildDebateCriteriaNotes(
  sideStats: Array<{ label: string; qualityScore: number; messageCount: number; speakerCount: number }>,
  chinese: boolean,
): string[] {
  return sideStats
    .slice()
    .sort((left, right) => right.qualityScore - left.qualityScore)
    .slice(0, 3)
    .map((side) =>
      chinese
        ? `${side.label}\uff1a\u6709\u6548\u53d1\u8a00 ${side.messageCount}\uff0c\u53c2\u4e0e\u8fa9\u624b ${side.speakerCount}\uff0c\u8d28\u91cf\u5206 ${side.qualityScore}`
        : `${side.label}: ${side.messageCount} useful messages, ${side.speakerCount} speakers, quality ${side.qualityScore}`,
    );
}

function bestDebateReason(input: { evidenceHits: number; rebuttalHits: number; speakerCount: number; sideMessages: number }): string {
  if (input.rebuttalHits >= input.evidenceHits && input.rebuttalHits > 0) {
    return "\u56de\u5e94\u548c\u53cd\u9a73\u66f4\u76f4\u63a5";
  }
  if (input.evidenceHits > 0) {
    return "\u8bba\u636e\u548c\u4f8b\u5b50\u66f4\u5145\u5206";
  }
  if (input.speakerCount > 1) {
    return "\u591a\u540d\u8fa9\u624b\u5f62\u6210\u4e86\u66f4\u5b8c\u6574\u7684\u914d\u5408";
  }
  if (input.sideMessages > 0) {
    return "\u8868\u8fbe\u66f4\u96c6\u4e2d";
  }
  return "\u6682\u65e0\u660e\u663e\u4f18\u52bf";
}

export function advanceDebateMatchAfterSpeaker(room: RoomState, speakerRoleId: string): RoomState["match"] {
  if (!isDebateRoom(room)) {
    return room.match;
  }
  const assignments = debateSpeakerSequence(room);
  if (assignments.length === 0) {
    return room.match;
  }
  const currentRound = room.match.round || 1;
  const key = roundKey(currentRound);
  const spokenForRound = Array.from(new Set([...(room.match.spokenRoleIdsByRound?.[key] ?? []), speakerRoleId]));
  const spokenRoleIdsByRound = {
    ...(room.match.spokenRoleIdsByRound ?? {}),
    [key]: spokenForRound,
  };
  const matchWithSpoken: RoomState["match"] = {
    ...room.match,
    spokenRoleIdsByRound,
    debateFlow: advanceDebateFlowAfterMessage(room, speakerRoleId),
  };
  return advanceDebateMatchAfterRoundProgress(room, matchWithSpoken);
}

function isGenericDebateTopic(topic: string): boolean {
  const compact = topic.trim().toLowerCase();
  return !compact || /^(daily chat|new room|room topic|topic|casual|general)$/i.test(compact) || compact.includes("\u8f7b\u91cf\u684c\u9762\u966a\u4f34");
}

function parseDebatePositionRequest(text: string): RoomDebateSpeakerPosition | null {
  if (/一辩|一辯|first\s*speaker/i.test(text)) {
    return "first_speaker";
  }
  if (/二辩|二辯|second\s*speaker/i.test(text)) {
    return "second_speaker";
  }
  if (/三辩|三辯|third\s*speaker/i.test(text)) {
    return "third_speaker";
  }
  if (/自由辩手|自由辯手|free\s*speaker/i.test(text)) {
    return "free_speaker";
  }
  if (/替补|替補|alternate/i.test(text)) {
    return "alternate";
  }
  return null;
}

function findDebatePositionRequestParticipant(room: RoomState, text: string): RoomParticipant | null {
  const compact = text.replace(/\s+/g, " ").toLowerCase();
  return [...room.participants]
    .sort((left, right) => right.name.length - left.name.length)
    .find((participant) => compact.includes(participant.name.toLowerCase()) || compact.includes(participant.roleId.toLowerCase())) ?? null;
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

function normalizeDebateText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .slice(0, 180);
}

function prefersChinese(text: string): boolean {
  const chinese = text.match(/[\u3400-\u9fff]/g)?.length ?? 0;
  const latin = text.match(/[a-z]/gi)?.length ?? 0;
  return chinese >= Math.max(1, latin / 2);
}

function stripMentions(value: string): string {
  return value.replace(/(^|\s)@[\w\u4e00-\u9fff-]+/g, " ").trim();
}

function trimForReply(value: string, maxLength = 80): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}
