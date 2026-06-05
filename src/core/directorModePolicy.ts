import type {
  RoomDirectorMove,
  RoomIdentityCard,
  RoomInputIntent,
  RoomParticipant,
  RoomFrameInterpretation,
  RoomState,
} from "./types";
import { createDebateTurnGoal, isDebateDeferredVerdictRequest, isDebateSetupRequest, isDebateVerdictRequest } from "./debatePolicy";
import { getRoomDirectorProfile } from "./roomProfiles";
import { getActiveRoomChannel } from "./roomVisibility";

export type DirectorModeKey = "casual" | "story" | "mystery" | "debate" | "study" | "planning" | "team_channel";

export type DirectorModeIntentKey =
  | "casual_pace"
  | "casual_recap"
  | "story_action_attempt"
  | "story_choice"
  | "mystery_clue_request"
  | "mystery_reveal_boundary"
  | "debate_setup"
  | "debate_round_control"
  | "debate_final_verdict"
  | "debate_advantage_check"
  | "study_explain"
  | "study_check_understanding"
  | "planning_decision_needed"
  | "planning_risk_check"
  | "team_channel_strategy"
  | "team_channel_public_response";

export interface DirectorModeIntent {
  key: DirectorModeIntentKey;
  mode: DirectorModeKey;
  move: RoomDirectorMove;
  summary: string;
  waitForUser?: boolean;
}

export interface DirectorModePolicy {
  mode: DirectorModeKey;
  allowedMoves: RoomDirectorMove[];
  defaultMove: RoomDirectorMove;
  defaultIntent: DirectorModeIntentKey;
  directorTask: string;
  roleTask: (room: RoomState, participant: RoomParticipant, index: number, intent: RoomInputIntent) => string;
  inspectorState: string[];
  memoryWriteRules: string[];
  stopRules: string[];
}

export const DIRECTOR_MODE_POLICIES: Record<DirectorModeKey, DirectorModePolicy> = {
  casual: {
    mode: "casual",
    allowedMoves: ["recap", "choice", "pause", "cue", "whisper"],
    defaultMove: "recap",
    defaultIntent: "casual_pace",
    directorTask: "Keep the room readable, privately cue roles when useful, lightly recap only when needed, and pause on repetition.",
    roleTask: (_room, participant, index) =>
      index === 0
        ? `${participant.name} gives a short natural reply without forcing drama`
        : `${participant.name} adds a different small angle without repeating`,
    inspectorState: ["topic", "currentPlan", "stopReason"],
    memoryWriteRules: ["do not store greetings or filler", "store only explicit stable preferences or room facts"],
    stopRules: ["pause on repetition", "pause when no useful next angle exists"],
  },
  story: {
    mode: "story",
    allowedMoves: ["judge", "choice", "cue", "twist", "recap", "pause", "whisper"],
    defaultMove: "cue",
    defaultIntent: "story_action_attempt",
    directorTask: "Judge actions, protect continuity, privately assign role tasks, surface consequences, and offer choices in immersive story language.",
    roleTask: (_room, participant) =>
      `${participant.name} reacts from visible scene facts, can act or question claims naturally, and must not rewrite continuity`,
    inspectorState: ["scene", "pendingAction", "lastConsequence", "openChoice"],
    memoryWriteRules: ["write established scene facts", "write item ownership and continuity only after judgement"],
    stopRules: ["pause before major choices", "pause on fact conflict"],
  },
  mystery: {
    mode: "mystery",
    allowedMoves: ["cue", "choice", "twist", "judge", "recap", "pause", "whisper"],
    defaultMove: "cue",
    defaultIntent: "mystery_clue_request",
    directorTask: "Manage clues, hidden truth, false leads, private knowledge, and visibility without spoiling secrets.",
    roleTask: (_room, participant) =>
      `${participant.name} follows visible clues, raises doubts, and never reveals hidden facts they should not know`,
    inspectorState: ["openClues", "hiddenSecretCount", "unresolvedQuestions", "visibilityBoundary"],
    memoryWriteRules: ["public clues go to room memory", "hidden truth stays in Director or observer memory"],
    stopRules: ["pause before revealing truth", "pause when clue visibility is unclear"],
  },
  debate: {
    mode: "debate",
    allowedMoves: ["choice", "recap", "judge", "pause", "whisper"],
    defaultMove: "choice",
    defaultIntent: "debate_round_control",
    directorTask: "Host the motion, sides, speaker positions, rounds, speaking order, private role directives, and advantage changes without debating as a contestant.",
    roleTask: (room, participant, index) => createDebateTurnGoal(room, participant, index),
    inspectorState: ["motion", "speakerAssignments", "nextSpeaker", "advantage"],
    memoryWriteRules: ["store motion, speaker assignments, round notes, and advantage changes"],
    stopRules: ["pause if motion or sides are missing", "pause after repeated arguments"],
  },
  study: {
    mode: "study",
    allowedMoves: ["cue", "choice", "recap", "judge", "pause", "whisper"],
    defaultMove: "cue",
    defaultIntent: "study_explain",
    directorTask: "Keep learning focused, privately assign small teaching tasks, ask checks, and pause for learner answers.",
    roleTask: (_room, participant, index) =>
      index === 0
        ? `${participant.name} explains one useful point or asks one focused question`
        : `${participant.name} adds a different example, correction, or practice prompt`,
    inspectorState: ["learningGoal", "currentPoint", "waitingForAnswer", "reviewQueue"],
    memoryWriteRules: ["store learning preference and confirmed progress", "do not store raw quizzes as facts"],
    stopRules: ["pause when the user needs to answer", "pause when the goal is unclear"],
  },
  planning: {
    mode: "planning",
    allowedMoves: ["recap", "choice", "judge", "pause", "cue", "whisper"],
    defaultMove: "choice",
    defaultIntent: "planning_decision_needed",
    directorTask: "Turn discussion into options, risks, decisions, owners, and private role tasks without inventing constraints.",
    roleTask: (_room, participant, index) =>
      index === 0
        ? `${participant.name} proposes one concrete option, risk, or next step`
        : `${participant.name} adds a different constraint, tradeoff, or action item`,
    inspectorState: ["goal", "constraints", "risks", "decisionPoint", "nextStep"],
    memoryWriteRules: ["store decisions, constraints, owners, and agreed next steps"],
    stopRules: ["pause when a decision is needed", "pause when critical information is missing"],
  },
  team_channel: {
    mode: "team_channel",
    allowedMoves: ["recap", "choice", "whisper", "pause"],
    defaultMove: "recap",
    defaultIntent: "team_channel_strategy",
    directorTask: "Keep faction strategy private, summarize internal plans, privately assign next public action, and decide when a public response is needed.",
    roleTask: (_room, participant) =>
      `${participant.name} contributes one private team strategy point without leaking it to public channels`,
    inspectorState: ["factionGoal", "internalSummary", "publicResponseBoundary"],
    memoryWriteRules: ["store faction strategy only in faction memory", "store Director-visible summaries without leaking to public memory"],
    stopRules: ["pause before returning private strategy to public", "pause when secrecy boundary is unclear"],
  },
};

function resolveDirectorModeKey(room: RoomState): DirectorModeKey {
  if (getActiveRoomChannel(room).type === "faction") {
    return "team_channel";
  }
  if (room.promptProfileId === "debate" || room.director.recipeId === "debate") {
    return "debate";
  }
  if (room.promptProfileId === "study" || room.director.profileId === "study-moderator") {
    return "study";
  }
  if (room.promptProfileId === "planning" || room.director.recipeId === "planning") {
    return "planning";
  }
  if (room.promptProfileId === "mystery" || room.director.recipeId === "mystery") {
    return "mystery";
  }
  if (room.promptProfileId === "story" || room.director.recipeId === "story") {
    return "story";
  }
  return "casual";
}

export function resolveDirectorMode(room: RoomState): DirectorModeKey {
  return resolveDirectorModeKey(room);
}

export function getDirectorModePolicy(room: RoomState): DirectorModePolicy {
  return DIRECTOR_MODE_POLICIES[resolveDirectorModeKey(room)];
}

export function getDefaultIdentityCardForMode(mode: DirectorModeKey | "team"): RoomIdentityCard {
  const enabled = mode === "story" || mode === "mystery" || mode === "debate" || mode === "team_channel" || mode === "team";
  return {
    enabled,
    publicTitle: "",
    publicRole: "",
    publicGoal: "",
    publicNotes: "",
    secretIdentity: "",
    secretGoal: "",
    privateKnowledge: "",
    revealCondition: "",
    updatedAt: new Date().toISOString(),
  };
}

export function resolveVisibleIdentityCardForRole(
  room: RoomState,
  viewerRoleId: string | "director" | null,
  targetRoleId: string,
): RoomIdentityCard | null {
  const participant = room.participants.find((candidate) => candidate.id === targetRoleId || candidate.roleId === targetRoleId);
  if (!participant || !participant.identityCard?.enabled) {
    return null;
  }
  const card = participant.identityCard;
  const canSeePrivate = viewerRoleId === "director" || viewerRoleId === participant.id || viewerRoleId === participant.roleId;
  return {
    ...card,
    secretIdentity: canSeePrivate ? card.secretIdentity : "",
    secretGoal: canSeePrivate ? card.secretGoal : "",
    privateKnowledge: canSeePrivate ? card.privateKnowledge : "",
    revealCondition: canSeePrivate ? card.revealCondition : "",
  };
}

export function buildIdentityCardPromptBlock(
  room: RoomState,
  participant: RoomParticipant,
  viewer: RoomParticipant | "director",
): string {
  const viewerId = viewer === "director" ? "director" : viewer.id;
  const card = resolveVisibleIdentityCardForRole(room, viewerId, participant.id);
  if (!card) {
    return "";
  }
  const publicLines = [
    ["Public title", card.publicTitle],
    ["Public role", card.publicRole],
    ["Public goal", card.publicGoal],
    ["Public notes", card.publicNotes],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `- ${label}: ${value.trim()}`);
  const privateLines = [
    ["Secret identity", card.secretIdentity],
    ["Secret goal", card.secretGoal],
    ["Private knowledge", card.privateKnowledge],
    ["Reveal condition", card.revealCondition],
  ]
    .filter(([, value]) => value.trim())
    .map(([label, value]) => `- ${label}: ${value.trim()}`);

  if (publicLines.length === 0 && privateLines.length === 0) {
    return "";
  }
  const blocks = [`Identity card for ${participant.name}.`];
  if (publicLines.length > 0) {
    blocks.push(["Public fields visible to the room:", ...publicLines].join("\n"));
  }
  if (privateLines.length > 0) {
    blocks.push([
      "Private fields visible only to this role and the Director. Do not reveal them unless the story explicitly makes them public:",
      ...privateLines,
    ].join("\n"));
  }
  return blocks.join("\n");
}

export function buildDirectorIdentityCardSummary(room: RoomState): string {
  const entries = room.participants
    .map((participant) => {
      const block = buildIdentityCardPromptBlock(room, participant, "director");
      return block ? `## ${participant.name}\n${block}` : "";
    })
    .filter(Boolean);
  return entries.join("\n\n");
}

function createDirectorModeIntent(
  room: RoomState,
  key: DirectorModeIntentKey,
  move: RoomDirectorMove,
  summary: string,
  waitForUser = false,
): DirectorModeIntent {
  const policy = getDirectorModePolicy(room);
  const safeMove = policy.allowedMoves.includes(move) ? move : policy.defaultMove;
  return { key, mode: policy.mode, move: safeMove, summary, waitForUser };
}

export function resolveDirectorModeIntent(room: RoomState, text: string, interpretation?: RoomFrameInterpretation): DirectorModeIntent {
  const mode = resolveDirectorModeKey(room);
  const lower = stripMentions(text).replace(/\s+/g, " ").trim().toLowerCase();
  const policy = DIRECTOR_MODE_POLICIES[mode];
  const primary = interpretation?.primary;
  const candidates = interpretation ? [interpretation.primary, ...interpretation.secondary] : [];
  const hasInterpretation = candidates.length > 0;
  const hasCandidate = (kind: RoomFrameInterpretation["primary"]["kind"], timeBinding?: RoomFrameInterpretation["primary"]["timeBinding"]) =>
    candidates.some((candidate) => candidate.kind === kind && (!timeBinding || candidate.timeBinding === timeBinding));
  const hasScheduling = hasCandidate("scheduling_request");
  const hasCollaboration = hasCandidate("collaboration_request");
  const hasActionAttempt = hasCandidate("action_attempt");
  const hasMetaControl = hasCandidate("meta_control");
  const hasImmediateEvaluation = hasCandidate("evaluation_request", "immediate");
  const hasDeferredEvaluation = hasCandidate("evaluation_request", "deferred");
  const hasPlotDirection = hasCandidate("plot_direction") || hasCandidate("mode_shift");
  const hasDeferredVerdict =
    interpretation?.deferredRequirements.some((requirement) => requirement.kind === "final_verdict") ||
    (!hasInterpretation && isDebateDeferredVerdictRequest(room, text));

  if (mode === "debate") {
    if (hasScheduling || (!hasInterpretation && isDebateSetupRequest(room, text))) {
      return createDirectorModeIntent(room, "debate_setup", "choice", "set debate motion, sides, speaker positions, and record any deferred verdict");
    }
    if (hasDeferredVerdict && !hasImmediateEvaluation) {
      return createDirectorModeIntent(room, "debate_round_control", "choice", "keep debate moving and defer final verdict until speeches finish");
    }
    if (hasImmediateEvaluation || (!hasInterpretation && isDebateVerdictRequest(room, text))) {
      return createDirectorModeIntent(room, "debate_final_verdict", "judge", "judge the debate winner and write the result");
    }
    if (hasDeferredEvaluation || (primary?.kind === "evaluation_request" && primary.timeBinding !== "immediate")) {
      return createDirectorModeIntent(room, "debate_round_control", "choice", "record the later verdict request and continue the debate");
    }
    if (!hasInterpretation && /(\u8c01\u8d62|\u80dc\u8d1f|\u5360\u4f18|\u4f18\u52bf|\u6253\u5206|score|winner|advantage|judge this round)/i.test(lower)) {
      return createDirectorModeIntent(room, "debate_advantage_check", "judge", "judge debate advantage for an existing round");
    }
    return createDirectorModeIntent(room, "debate_round_control", "choice", "keep debate rounds and speaker order moving");
  }

  if (mode === "story") {
    if (hasPlotDirection) {
      return createDirectorModeIntent(room, "story_choice", "choice", "absorb the requested story direction as a controlled transition", primary?.timeBinding !== "immediate");
    }
    if (/(\u9009\u62e9|\u600e\u4e48\u529e|\u4e0b\u4e00\u6b65|\u5c94\u8def|option|choice|what should)/i.test(lower)) {
      return createDirectorModeIntent(room, "story_choice", "choice", "offer a story choice", true);
    }
    if (hasActionAttempt || /(\u6253\u5f00|\u649c|\u653b\u51fb|\u68c0\u67e5|\u6f5c\u5165|\u8bf4\u670d|\u62ff\u8d70|\u8fdb\u5165|\u8f6c\u8eab|\u8bd5\u56fe|\u5c1d\u8bd5|open|pick|attack|check|sneak|persuade|take|enter|try)/i.test(lower)) {
      return createDirectorModeIntent(room, "story_action_attempt", "judge", "judge a scene action with consequences");
    }
    return createDirectorModeIntent(room, "story_action_attempt", "cue", "advance the scene from visible facts");
  }

  if (mode === "mystery") {
    if (primary?.kind === "world_edit_claim" || /(\u771f\u76f8|\u51f6\u624b|\u79d8\u5bc6|\u63ed\u5f00|\u516c\u5f00|spoiler|truth|culprit|reveal)/i.test(lower)) {
      return createDirectorModeIntent(room, "mystery_reveal_boundary", "choice", "protect hidden truth and decide what can be revealed", true);
    }
    if (hasActionAttempt || /(\u7ebf\u7d22|\u63d0\u793a|\u8c03\u67e5|\u8bc1\u636e|\u52a8\u673a|clue|hint|investigate|evidence|motive)/i.test(lower)) {
      return createDirectorModeIntent(room, "mystery_clue_request", "cue", "surface or connect one visible clue");
    }
    return createDirectorModeIntent(room, "mystery_clue_request", "cue", "keep mystery pressure without revealing secrets");
  }

  if (mode === "study") {
    if (hasDeferredEvaluation || (primary?.kind === "evaluation_request" && primary.timeBinding !== "immediate")) {
      return createDirectorModeIntent(room, "study_explain", "cue", "teach first and defer the check until the learner has material");
    }
    if (hasImmediateEvaluation || /(\u590d\u8ff0|\u68c0\u67e5|\u7ec3\u4e60|\u5c0f\u9898|\u6d4b\u9a8c|\u56de\u7b54|quiz|exercise|check|repeat back|practice)/i.test(lower)) {
      return createDirectorModeIntent(room, "study_check_understanding", "choice", "ask the learner to answer or practice", true);
    }
    if (hasMetaControl || /(\u603b\u7ed3|\u56de\u987e|recap|summary)/i.test(lower)) {
      return createDirectorModeIntent(room, "study_explain", "recap", "summarize the current learning point");
    }
    return createDirectorModeIntent(room, "study_explain", "cue", "explain the next small learning point");
  }

  if (mode === "planning") {
    if (hasCollaboration) {
      return createDirectorModeIntent(room, "planning_risk_check", "choice", "privately assign planning angles before the public next step");
    }
    if (hasScheduling || /(\u51b3\u5b9a|\u786e\u8ba4|\u62cd\u677f|\u9009\u54ea\u4e2a|\u4e0b\u4e00\u6b65|owner|decision|decide|confirm|next step)/i.test(lower)) {
      return createDirectorModeIntent(room, "planning_decision_needed", "choice", "separate decision from next action", true);
    }
    if (/(\u98ce\u9669|\u7ea6\u675f|\u6210\u672c|\u7f3a\u5c11|\u4e0d\u786e\u5b9a|risk|constraint|cost|missing|unknown)/i.test(lower)) {
      return createDirectorModeIntent(room, "planning_risk_check", "judge", "evaluate risks and missing information");
    }
    return createDirectorModeIntent(room, "planning_decision_needed", "recap", "summarize options and next steps");
  }

  if (mode === "team_channel") {
    if (hasCollaboration || hasScheduling) {
      return createDirectorModeIntent(room, "team_channel_strategy", "recap", "coordinate private faction strategy and defer public action until ready");
    }
    if (/(\u516c\u5f00|\u56de\u5e94|\u53d1\u51fa\u53bb|\u56de\u5230\u516c\u5f00|public|respond|announce)/i.test(lower)) {
      return createDirectorModeIntent(room, "team_channel_public_response", "choice", "decide what can move back to public", true);
    }
    return createDirectorModeIntent(room, "team_channel_strategy", "recap", "summarize private team strategy");
  }

  if (hasMetaControl || /(\u603b\u7ed3|\u56de\u987e|recap|summary)/i.test(lower)) {
    return createDirectorModeIntent(room, "casual_recap", "recap", "light recap");
  }
  if (/(\u505c|\u6682\u505c|\u91cd\u590d|\u51b7\u573a|pause|stop|repeat)/i.test(lower)) {
    return createDirectorModeIntent(room, "casual_pace", "pause", "pause on repetition or low value");
  }
  return createDirectorModeIntent(room, policy.defaultIntent, policy.defaultMove, policy.directorTask);
}

export function classifyDirectorModeIntent(room: RoomState, input: string): DirectorModeIntent {
  return resolveDirectorModeIntent(room, input);
}

export function directorMoveFromLegacyText(text: string, room: RoomState): RoomDirectorMove {
  const lower = text.toLowerCase();
  if (/(\u603b\u7ed3|\u56de\u987e|\u76ee\u524d\u53d1\u751f|recap|summary)/i.test(lower)) {
    return "recap";
  }
  if (/(\u7ebf\u7d22|\u63d0\u793a|cue|clue|hint)/i.test(lower)) {
    return "cue";
  }
  if (/(\u9009\u62e9|\u5206\u652f|\u4e0b\u4e00\u6b65|\u54ea\u4e2a|\u600e\u4e48\u505a|choice|option|next)/i.test(lower)) {
    return "choice";
  }
  if (/(\u88c1\u5b9a|\u5224\u5b9a|\u662f\u5426\u6210\u529f|\u653b\u51fb|\u5c1d\u8bd5|\u68c0\u67e5|\u8bf4\u670d|\u6f5c\u5165|\u5f00\u9501|\u8fdb\u5165|judge|attempt|check|persuade|sneak|unlock|enter)/i.test(lower)) {
    return "judge";
  }
  if (/(\u8f6c\u6298|\u610f\u5916|\u9ebb\u70e6|twist|complication)/i.test(lower)) {
    return "twist";
  }
  if (/(\u79c1\u4e0b|\u8033\u8bed|\u6084\u6084|whisper|private)/i.test(lower)) {
    return "whisper";
  }
  const profile = getRoomDirectorProfile(room.director.profileId);
  return profile.preferredMoves[0] ?? getDirectorModePolicy(room).defaultMove;
}

function createModeRoleTurnGoal(room: RoomState, participant: RoomParticipant, index: number, intent: RoomInputIntent): string {
  if (room.freedomLevel === "developer") {
    return `${participant.name} treats the user's room-state statements as authoritative developer direction and responds within the current mode without challenging those facts`;
  }
  if (intent === "team_strategy" || resolveDirectorModeKey(room) === "team_channel") {
    return DIRECTOR_MODE_POLICIES.team_channel.roleTask(room, participant, index, intent);
  }
  return getDirectorModePolicy(room).roleTask(room, participant, index, intent);
}

export function buildModeRoleTask(room: RoomState, participant: RoomParticipant, index: number, intent: RoomInputIntent): string {
  return createModeRoleTurnGoal(room, participant, index, intent);
}

export function buildModeInspectorState(room: RoomState): {
  mode: DirectorModeKey;
  defaultMove: RoomDirectorMove;
  allowedMoves: RoomDirectorMove[];
  inspectorState: string[];
  memoryWriteRules: string[];
  stopRules: string[];
} {
  const policy = getDirectorModePolicy(room);
  return {
    mode: policy.mode,
    defaultMove: policy.defaultMove,
    allowedMoves: policy.allowedMoves,
    inspectorState: policy.inspectorState,
    memoryWriteRules: policy.memoryWriteRules,
    stopRules: policy.stopRules,
  };
}

function stripMentions(value: string): string {
  return value.replace(/(^|\s)@[\w\u4e00-\u9fff-]+/g, " ").trim();
}
