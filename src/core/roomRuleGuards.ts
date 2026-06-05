import type {
  ConsoleMessage,
  DirectorOverrideLogEntry,
  DirectorOverrideRequest,
  DirectorTurnPlan,
  RoomActionCheck,
  RoomConstraint,
  RoomDirectorMemorySnapshot,
  DeferredRequirement,
  FrameIntentCandidate,
  RoomFrameAbsorption,
  RoomFrameAmbiguity,
  RoomFrameIntent,
  RoomFrameInterpretation,
  RoomFrameIntentKind,
  RoomFrameRequestedMode,
  RoomFrameUserRole,
  RoomFreedomLevel,
  RoomParticipant,
  RoomSceneBoard,
  RoomState,
  SceneDelta,
} from "./types";
import {
  collectRoomFrameIntentCandidates as collectFlexibleRoomFrameIntentCandidates,
  resolveRoomFrameIntent as resolveFlexibleRoomFrameIntent,
  resolveRoomFrameInterpretation as resolveFlexibleRoomFrameInterpretation,
} from "./inputInterpretation";

export { collectInputIntentCandidates, interpretUserInput, resolveInputInterpretation } from "./inputInterpretation";

const ROOM_APP_SAFETY_TERMS = [
  String.raw`api\s*key`,
  "password",
  String.raw`private\s*key`,
  String.raw`seed\s*phrase`,
  String.raw`verification\s*code`,
  "payment",
  String.raw`bank\s*card`,
  "shell",
  "powershell",
  String.raw`cmd\.exe`,
  "screenshot",
  "microphone",
  "tts",
  "\u5bc6\u94a5",
  "\u5bc6\u7801",
  "\u79c1\u94a5",
  "\u52a9\u8bb0\u8bcd",
  "\u9a8c\u8bc1\u7801",
  "\u94f6\u884c\u5361",
  "\u652f\u4ed8",
  "\u6267\u884c\u547d\u4ee4",
  "\u7cfb\u7edf\u547d\u4ee4",
  "\u622a\u56fe",
  "\u9ea6\u514b\u98ce",
  "\u8bed\u97f3\u6743\u9650",
];
const ROOM_APP_SAFETY_PATTERN = new RegExp(`(${ROOM_APP_SAFETY_TERMS.join("|")})`, "i");
const ROOM_FACT_REWRITE_PATTERN =
  /(actually|retcon|change|make it|set|override|ignore the condition|allow access|reveal the secret|knows the secret|has the key|is now open|door is open|unlock(?:ed)?|opened\s+(?:the\s+)?(?:lock|locked door|locked gate)|(?:lock|locked door|locked gate|door lock)\s+(?:is|was|has been)\s+(?:open|opened|unlocked))/i;
const ROOM_FACT_REWRITE_CN_TERMS = [
  "\u5176\u5b9e",
  "\u6539\u6210",
  "\u8bbe\u5b9a\u4e3a",
  "\u4fee\u6539",
  "\u8986\u76d6",
  "\u65e0\u89c6\u6761\u4ef6",
  "\u89e3\u9664\u9650\u5236",
  String.raw`\u73b0\u5728.*(?:\u6253\u5f00|\u89e3\u9501|\u77e5\u9053|\u6301\u6709|\u62e5\u6709)`,
  String.raw`\u95e8(?:\u5df2\u7ecf|\u73b0\u5728|\u88ab)?(?:\u6253\u5f00|\u89e3\u9501)`,
  String.raw`(?:\u9501|\u95e8\u9501|\u6302\u9501)(?:\u5df2\u7ecf|\u73b0\u5728|\u88ab)?(?:\u6253\u5f00|\u89e3\u9501)`,
  String.raw`\u6211.*(?:\u6253\u5f00\u4e86|\u89e3\u5f00\u4e86|\u64ac\u5f00\u4e86).*(?:\u9501|\u95e8\u9501|\u6302\u9501)`,
  String.raw`\u94a5\u5319(?:\u5728|\u5f52|\u5c5e\u4e8e)`,
  "\u77e5\u9053\u79d8\u5bc6",
  "\u516c\u5f00\u79d8\u5bc6",
  "\u63ed\u793a\u79d8\u5bc6",
  String.raw`\u5141\u8bb8.*(?:\u8fdb\u5165|\u901a\u8fc7|\u901a\u884c)`,
];
const ROOM_FACT_REWRITE_CN_PATTERN = new RegExp(`(${ROOM_FACT_REWRITE_CN_TERMS.join("|")})`);
const ROOM_ACTION_REQUIRES_JUDGE_PATTERN =
  /(force|steal|attack|break|destroy|teleport|instantly|without permission|pick.*lock|unlock|open.*lock|lock.*open|persuade|sneak|inspect|search|try to|attempt to|judge whether)/i;
const ROOM_ACTION_REQUIRES_JUDGE_CN_TERMS = [
  "\u5f3a\u884c",
  "\u5077\u8d70",
  "\u5077\u53d6",
  "\u653b\u51fb",
  "\u7834\u574f",
  "\u6467\u6bc1",
  "\u77ac\u79fb",
  "\u7acb\u523b\u5b8c\u6210",
  "\u4e0d\u7ecf\u5141\u8bb8",
  "\u64ac",
  "\u5f00\u9501",
  "\u89e3\u9501",
  String.raw`\u6253\u5f00.*\u9501`,
  String.raw`\u9501.*\u6253\u5f00`,
  "\u8bf4\u670d",
  "\u6f5c\u5165",
  "\u68c0\u67e5",
  "\u641c\u7d22",
  "\u8c03\u67e5",
  "\u5c1d\u8bd5",
  "\u8bd5\u56fe",
  "\u88c1\u5b9a",
  "\u5224\u5b9a",
  "\u662f\u5426\u6210\u529f",
];
const ROOM_ACTION_REQUIRES_JUDGE_CN_PATTERN = new RegExp(`(${ROOM_ACTION_REQUIRES_JUDGE_CN_TERMS.join("|")})`);
const HIDDEN_KNOWLEDGE_TERMS = [
  "hidden secret",
  "private whisper",
  "team channel",
  "director-only",
  "secret says",
  "unrevealed",
  "not shown to user",
  "\u9690\u85cf\u79d8\u5bc6",
  "\u79c1\u4e0b\u6d88\u606f",
  "\u9635\u8425\u9891\u9053",
  "\u5bfc\u6f14\u4e13\u7528",
  "\u672a\u516c\u5f00",
  "\u672a\u63ed\u793a",
  "\u73a9\u5bb6\u4e0d\u53ef\u89c1",
];
const HIDDEN_KNOWLEDGE_PATTERN = new RegExp(`(${HIDDEN_KNOWLEDGE_TERMS.join("|")})`, "i");
const DIRECTOR_OVERRIDE_SCENE_PATTERN = new RegExp(
  `(scene|location|place|setting|\u573a\u666f|\u5730\u70b9|\u4f4d\u7f6e|\u5207\u5230|\u6765\u5230|\u53d1\u751f\u5728)`,
  "i",
);
const DIRECTOR_OVERRIDE_KNOWLEDGE_PATTERN = new RegExp(
  `(secret|know|reveal|public|visibility|\u79d8\u5bc6|\u77e5\u9053|\u63ed\u793a|\u516c\u5f00|\u53ef\u89c1|\u4e0d\u53ef\u89c1)`,
  "i",
);
const DIRECTOR_OVERRIDE_ITEM_PATTERN = new RegExp(
  `(key|item|own|owns|has|hold|give|\u7269\u54c1|\u9053\u5177|\u94a5\u5319|\u6301\u6709|\u62e5\u6709|\u4ea4\u7ed9|\u62ff\u7740|\u4fdd\u7ba1)`,
  "i",
);
const DIRECTOR_OVERRIDE_CONDITION_PATTERN = new RegExp(
  `(condition|rule|lock|door|allow|unlock|\u6761\u4ef6|\u89c4\u5219|\u9501|\u95e8|\u5141\u8bb8|\u89e3\u9501|\u901a\u884c|\u9650\u5236)`,
  "i",
);

const FRAME_MODE_PATTERNS: Array<[RoomFrameRequestedMode, RegExp]> = [
  ["debate", /(debate|argument|辩论|辩题|正方|反方|一辩|二辩|三辩)/i],
  ["story", /(story|scene|剧情|故事|逃生|扮演|场景|转场)/i],
  ["mystery", /(mystery|clue|case|推理|解谜|线索|案件|真相)/i],
  ["study", /(study|learn|quiz|学习|讲解|练习|知识点|复习)/i],
  ["planning", /(plan|roadmap|decision|计划|方案|规划|风险|下一步)/i],
  ["team_channel", /(team channel|faction|huddle|阵营|私下商量|阵营频道|队内)/i],
  ["casual", /(casual|chat|日常|闲聊|聊天)/i],
];

const FRAME_META_CONTROL_PATTERN =
  /(pause|stop|continue|resume|recap|summarize|fast[- ]?forward|huddle|switch channel|reassign|assign|暂停|停一下|继续|恢复|总结|快进|跳过|私下商量|进入阵营|阵营频道|切到|切换|重排|分配|让.+发言|让.+当)/i;
const FRAME_MODE_SHIFT_PATTERN =
  /(change to|switch to|turn this into|make this a|now it is|改成|换成|变成|切到|进入.+模式|开始.+剧情|现在.+玩法)/i;
const FRAME_OUT_OF_CHARACTER_PATTERN =
  /(i want|please make|prefer|rules?|pacing|style|tone|希望|我想|请你|帮我|规则|玩法|节奏|风格|不要|更|安排|组织)/i;
const FRAME_WIN_CLAIM_PATTERN = /(i win|we win|you lose|winner|胜负|赢了|获胜|输赢|分出胜负|判.+赢|哪队赢)/i;

function requestedModeFromText(text: string): RoomFrameRequestedMode | undefined {
  return FRAME_MODE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
}

const FRAME_DEFERRED_PATTERN =
  /(after|afterward|afterwards|later|finally|at\s+the\s+end|when\s+.+(?:finish|ends?)|最后|结束后|完成后|发言结束后|赛后|之后|等.+(?:结束|完成)|届时)/i;
const FRAME_CONDITIONAL_PATTERN = /(if|when|once|unless|如果|若|当.+时|一旦|除非|满足.+后)/i;
const FRAME_BACKGROUND_RULE_PATTERN = /(rule|always|never|from now on|以后|之后都|默认|规则|要求|必须|不要|不得|应当|保持)/i;
const FRAME_SETUP_SIGNAL_PATTERN =
  /(organize|host|start|run|set up|setup|assign|arrange|schedule|motion|side|speaker|组织|主持|开始|安排|分配|调度|辩题|正方|反方|一辩|二辩|三辩|赛制|流程)/i;
const FRAME_EVALUATION_SIGNAL_PATTERN =
  /(judge|evaluate|verdict|winner|who won|advantage|score|评判|评价|裁判|胜负|谁赢|哪队赢|获胜|分出胜负|判.+赢|优势|打分|评分)/i;
const FRAME_IMMEDIATE_SIGNAL_PATTERN = /(now|right now|immediately|现在|立即|马上|立刻|此刻)/i;
const FRAME_COLLABORATION_SIGNAL_PATTERN =
  /(collaborate|huddle|discuss privately|team up|work together|分工|协作|合作|商量|私下商量|队内|阵营商量|联合|配合|派人回应)/i;
const FRAME_MEMORY_SIGNAL_PATTERN = /(remember|memorize|note that|记住|记下来|记忆|以后记得|保存为记忆)/i;
const FRAME_PLOT_SIGNAL_PATTERN =
  /(plot|arc|foreshadow|twist|scene transition|剧情|伏笔|转折|转场|改成.+剧情|逃生|故事走向|下一幕|阶段推进)/i;
const FRAME_USER_WIN_CLAIM_PATTERN = /(i win|we win|you lose|我赢了|我们赢了|比赛结束|已经赢|获胜了)/i;

function candidate(
  kind: RoomFrameIntentKind,
  score: number,
  reason: string,
  timeBinding: FrameIntentCandidate["timeBinding"] = "immediate",
  requestedMode?: RoomFrameRequestedMode,
): FrameIntentCandidate {
  return { kind, score: Math.max(0, Math.min(100, score)), timeBinding, reason, requestedMode };
}

function resolveTimeBinding(text: string): FrameIntentCandidate["timeBinding"] {
  if (FRAME_DEFERRED_PATTERN.test(text)) {
    return "deferred";
  }
  if (FRAME_CONDITIONAL_PATTERN.test(text)) {
    return "conditional";
  }
  if (FRAME_BACKGROUND_RULE_PATTERN.test(text)) {
    return "background_rule";
  }
  return "immediate";
}

function addCandidate(candidates: FrameIntentCandidate[], next: FrameIntentCandidate): void {
  const existing = candidates.find((candidate) => candidate.kind === next.kind && candidate.timeBinding === next.timeBinding);
  if (!existing) {
    candidates.push(next);
    return;
  }
  if (next.score > existing.score) {
    existing.score = next.score;
    existing.reason = next.reason;
    existing.requestedMode = next.requestedMode ?? existing.requestedMode;
  }
}

export function collectRoomFrameIntentCandidates(input: {
  room: RoomState;
  userInput: string;
  targetingDirector?: boolean;
}): FrameIntentCandidate[] {
  return collectFlexibleRoomFrameIntentCandidates(input);
}

function collectDeferredRequirements(text: string): DeferredRequirement[] {
  const compact = text.trim().replace(/\s+/g, " ").slice(0, 240);
  const requirements: DeferredRequirement[] = [];
  if (FRAME_DEFERRED_PATTERN.test(text) && FRAME_EVALUATION_SIGNAL_PATTERN.test(text)) {
    requirements.push({
      kind: "final_verdict",
      summary: "在相关发言或证据结束后再给出最终评判。",
      trigger: "all_relevant_speakers_done",
      sourceText: compact,
    });
  }
  if (FRAME_DEFERRED_PATTERN.test(text) && /(summarize|recap|总结|复盘)/i.test(text)) {
    requirements.push({
      kind: "round_summary",
      summary: "在当前阶段结束后总结。",
      trigger: "stage_complete",
      sourceText: compact,
    });
  }
  if (FRAME_DEFERRED_PATTERN.test(text) && /(next step|下一步|方案|计划)/i.test(text)) {
    requirements.push({
      kind: "planning_next_step",
      summary: "在收集风险和约束后给出下一步。",
      trigger: "planning_inputs_collected",
      sourceText: compact,
    });
  }
  if (FRAME_DEFERRED_PATTERN.test(text) && FRAME_PLOT_SIGNAL_PATTERN.test(text)) {
    requirements.push({
      kind: "plot_payoff",
      summary: "将该剧情要求作为后续伏笔或回收点。",
      trigger: "plot_condition_met",
      sourceText: compact,
    });
  }
  return requirements;
}

function roomFrameUserRoleFor(kind: RoomFrameIntentKind, freedomLevel: RoomFreedomLevel): RoomFrameUserRole {
  if (freedomLevel === "developer") {
    return "developer";
  }
  if (kind === "meta_control") {
    return "control";
  }
  if (kind === "in_character") {
    return "player";
  }
  return "host_request";
}

function roomFrameAbsorptionFor(
  kind: RoomFrameIntentKind,
  freedomLevel: RoomFreedomLevel,
  text: string,
  primary?: FrameIntentCandidate,
): RoomFrameAbsorption {
  if (ROOM_APP_SAFETY_PATTERN.test(text)) {
    return "blocked";
  }
  if (freedomLevel === "developer") {
    return "direct_apply";
  }
  if (kind === "in_character") {
    return "normal_reply";
  }
  if (kind === "meta_control") {
    return /(私下商量|阵营频道|huddle|让.+发言|重排|分配|assign|reassign)/i.test(text) ? "private_directive" : "direct_apply";
  }
  if (kind === "director_request" || kind === "scheduling_request" || kind === "collaboration_request") {
    return "private_directive";
  }
  if (kind === "evaluation_request") {
    return primary?.timeBinding === "deferred" ? "private_directive" : freedomLevel === "strict" ? "wait_for_choice" : "plot_transition";
  }
  if (kind === "memory_request") {
    return "direct_apply";
  }
  if (kind === "mode_shift") {
    return freedomLevel === "strict" ? "wait_for_choice" : "plot_transition";
  }
  if (kind === "world_edit_claim" || kind === "action_attempt") {
    return freedomLevel === "loose" ? "plot_transition" : "wait_for_choice";
  }
  return "plot_transition";
}

function roomFrameSummary(
  kind: RoomFrameIntentKind,
  absorption: RoomFrameAbsorption,
  text: string,
  requestedMode?: RoomFrameRequestedMode,
  deferredRequirements: DeferredRequirement[] = [],
): string {
  const compact = text.trim().replace(/\s+/g, " ").slice(0, 140);
  const deferred = deferredRequirements.length > 0 ? `; deferred: ${deferredRequirements.map((item) => item.kind).join(", ")}` : "";
  if (kind === "scheduling_request") {
    return `Scheduling/setup request routed as ${absorption}${deferred}: ${compact}`;
  }
  if (kind === "evaluation_request") {
    return `Evaluation request routed as ${absorption}${deferred}: ${compact}`;
  }
  if (kind === "collaboration_request") {
    return `Collaboration request routed as ${absorption}${deferred}: ${compact}`;
  }
  if (kind === "memory_request") {
    return `Memory request routed as ${absorption}: ${compact}`;
  }
  if (kind === "plot_direction") {
    return `Plot direction routed as ${absorption}${deferred}: ${compact}`;
  }
  if (kind === "action_attempt") {
    return `Action attempt routed as ${absorption}: ${compact}`;
  }
  if (requestedMode && kind === "mode_shift") {
    return `Mode shift request to ${requestedMode}${deferred}: ${compact}`;
  }
  if (kind === "world_edit_claim") {
    return `Room-state claim routed as ${absorption}${deferred}: ${compact}`;
  }
  if (kind === "meta_control") {
    return `Room control intent routed as ${absorption}${deferred}: ${compact}`;
  }
  if (kind === "director_request") {
    return `Director request routed as ${absorption}${deferred}: ${compact}`;
  }
  if (kind === "out_of_character_request") {
    return `Out-of-character preference routed as ${absorption}${deferred}: ${compact}`;
  }
  return `In-character room input: ${compact}`;
}

export function isRoomAppSafetyText(value: string): boolean {
  return ROOM_APP_SAFETY_PATTERN.test(value);
}

export function resolveRoomFrameInterpretation(input: {
  room: RoomState;
  userInput: string;
  targetingDirector?: boolean;
  now?: string;
}): RoomFrameInterpretation {
  return resolveFlexibleRoomFrameInterpretation(input);
}

export function resolveRoomFrameIntent(input: {
  room: RoomState;
  userInput: string;
  targetingDirector?: boolean;
  now?: string;
}): RoomFrameIntent {
  return resolveFlexibleRoomFrameIntent(input);
}

export function evaluateRoomAction(input: {
  room: RoomState;
  message: ConsoleMessage;
  userInput: string;
}): RoomActionCheck {
  const text = input.userInput.trim();
  if (!text) {
    return { result: "allowed", reason: "Empty input has no room action.", matchedConstraintIds: [] };
  }

  const activeConstraintIds = input.room.director.constraints
    .filter((constraint) => constraint.status === "active")
    .map((constraint) => constraint.id);

  if (ROOM_APP_SAFETY_PATTERN.test(text)) {
    return {
      result: "blocked",
      reason: "This would affect app safety, private data, or permissions. Director cannot approve it.",
      matchedConstraintIds: activeConstraintIds,
      suggestedDirectorMove: "judge",
    };
  }

  if (!input.room.director.enabled) {
    return { result: "allowed", reason: "Director is off; only app safety rules apply.", matchedConstraintIds: [] };
  }

  const freedomLevel = resolveRoomFreedomLevel(input.room);
  if (freedomLevel === "developer") {
    return {
      result: "allowed",
      reason: "Developer freedom accepts user room-state statements as authoritative unless they affect app safety or private data.",
      matchedConstraintIds: [],
    };
  }

  const changesRoomFacts = ROOM_FACT_REWRITE_PATTERN.test(text) || ROOM_FACT_REWRITE_CN_PATTERN.test(text);
  if (changesRoomFacts) {
    return {
      result: "needs_director_override",
      reason: "This changes room facts, conditions, item ownership, or knowledge visibility. Mention @Director to change room state.",
      matchedConstraintIds: activeConstraintIds,
      suggestedDirectorMove: "judge",
    };
  }

  const needsJudgement = ROOM_ACTION_REQUIRES_JUDGE_PATTERN.test(text) || ROOM_ACTION_REQUIRES_JUDGE_CN_PATTERN.test(text);
  if (needsJudgement && freedomLevel !== "loose") {
    return {
      result: "needs_player_choice",
      reason: "This action needs a grounded result before it changes the scene.",
      matchedConstraintIds: activeConstraintIds,
      suggestedDirectorMove: "judge",
    };
  }

  if (freedomLevel === "strict" && looksLikePlayerActionAttempt(text)) {
    return {
      result: "needs_player_choice",
      reason: "Strict rooms require player actions to produce a grounded result before they affect the scene.",
      matchedConstraintIds: activeConstraintIds,
      suggestedDirectorMove: "judge",
    };
  }

  return { result: "allowed", reason: "No Director constraint blocks this input.", matchedConstraintIds: [] };
}

export function evaluateAiDraftAgainstDirectorRules(input: {
  draft: string;
  role: RoomParticipant;
  room: RoomState;
}): RoomActionCheck {
  const text = input.draft.trim();
  if (!text) {
    return { result: "blocked", reason: "The role produced an empty reply.", matchedConstraintIds: [] };
  }

  const constraintIds = input.room.director.constraints
    .filter((constraint) => constraint.status === "active")
    .map((constraint) => constraint.id);

  if (ROOM_APP_SAFETY_PATTERN.test(text)) {
    return {
      result: "blocked",
      reason: "The draft attempts to mention app safety, private data, or permissions.",
      matchedConstraintIds: constraintIds,
      suggestedDirectorMove: "judge",
    };
  }

  if (HIDDEN_KNOWLEDGE_PATTERN.test(text)) {
    return {
      result: "blocked",
      reason: "The draft uses private or hidden information that should not be revealed here.",
      matchedConstraintIds: constraintIds,
      suggestedDirectorMove: "judge",
    };
  }

  const rewritesFacts = ROOM_FACT_REWRITE_PATTERN.test(text) || ROOM_FACT_REWRITE_CN_PATTERN.test(text);
  if (rewritesFacts) {
    return {
      result: "needs_director_override",
      reason: "AI roles cannot rewrite room facts, conditions, item ownership, or knowledge visibility.",
      matchedConstraintIds: constraintIds,
      suggestedDirectorMove: "judge",
    };
  }

  return { result: "allowed", reason: "The draft follows visible room constraints.", matchedConstraintIds: [] };
}

export function validateDraftWithDirector(input: {
  draft: string;
  role: RoomParticipant;
  room: RoomState;
}): RoomActionCheck {
  return evaluateAiDraftAgainstDirectorRules(input);
}

export function validateDraftWithDirectorRules(input: {
  draft: string;
  role: RoomParticipant;
  room: RoomState;
}): RoomActionCheck {
  return validateDraftWithDirector(input);
}

export function parseDirectorOverrideRequest(input: {
  room: RoomState;
  userId: string;
  text: string;
  nowIso: string;
}): DirectorOverrideRequest {
  const cleanText = stripDirectorMention(input.text);
  const lower = cleanText.toLowerCase();
  const action: DirectorOverrideRequest["action"] =
    DIRECTOR_OVERRIDE_SCENE_PATTERN.test(cleanText)
      ? "modify_scene"
      : DIRECTOR_OVERRIDE_KNOWLEDGE_PATTERN.test(cleanText)
        ? "modify_knowledge"
        : DIRECTOR_OVERRIDE_ITEM_PATTERN.test(cleanText)
          ? "modify_item"
          : DIRECTOR_OVERRIDE_CONDITION_PATTERN.test(cleanText) || lower.includes("@director")
            ? "modify_condition"
            : "other";
  return {
    id: crypto.randomUUID(),
    userId: input.userId,
    text: trimForReply(cleanText || input.text, 240),
    requestedAt: input.nowIso,
    action,
  };
}

export function applyDirectorOverride(input: {
  room: RoomState;
  request: DirectorOverrideRequest;
  nowIso: string;
  nowLabel: string;
}): { entry: DirectorOverrideLogEntry; constraints: RoomConstraint[]; sceneBoard?: RoomSceneBoard; plan: DirectorTurnPlan } {
  const summary = trimForReply(input.request.text || "Director override", 180);
  const scope =
    input.request.action === "modify_knowledge"
      ? "knowledge"
      : input.request.action === "modify_item"
        ? "item"
        : input.request.action === "modify_condition"
          ? "director"
          : "scene";
  const constraint: RoomConstraint = {
    id: `constraint-override-${input.request.id}`,
    scope,
    label: "User Director override",
    detail: summary,
    status: "active",
    visibility: "known_to_user",
    relatedRoleIds: [],
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  };
  const constraints = [constraint, ...input.room.director.constraints].slice(0, 20);
  const sceneBoard = createOverrideSceneBoard(input.room.director.sceneBoard, input.request, summary, input.nowIso);
  const entry: DirectorOverrideLogEntry = {
    id: crypto.randomUUID(),
    requestId: input.request.id,
    userId: input.request.userId,
    text: input.request.text,
    appliedAt: input.nowIso,
    changedConstraintIds: [constraint.id],
    summary,
  };
  const chinese = prefersChinese(input.request.text);
  const plan: DirectorTurnPlan = {
    move: "judge",
    publicText: chinese ? `Director 已更新：${summary}` : `Director updated: ${summary}`,
    publicTextReason: "ruling",
    privateDirectives: [],
    nextSpeakerRoleId: null,
    sceneDelta: sceneDeltaForOverride(input.request, summary),
    continuityWrites: [
      {
        label: "Director override",
        detail: summary,
        visibility: "known_to_user",
        ownerRoleIds: [],
        status: "active",
      },
    ],
    secretWrites: [],
    knowledgeVisibility: "known_to_user",
    waitForUser: false,
    judgement: {
      actor: input.room.userProfile.displayName,
      action: "Director override",
      intent: "Modify room conditions",
      knownFacts: directorKnownFacts(input.room),
      difficulty: "normal",
      evidence: ["The user explicitly @mentioned the Director."],
      outcome: "success",
      consequence: "The room state uses this update from the next turn.",
    },
  };
  return { entry, constraints, sceneBoard, plan };
}

function resolveRoomFreedomLevel(room: RoomState): RoomFreedomLevel {
  return room.freedomLevel ?? "balanced";
}

function looksLikePlayerActionAttempt(text: string): boolean {
  return /(?:\bi\s+(?:try|attempt|open|take|give|move|enter|leave|use|check|look|ask|tell|push|pull)\b|\bwe\s+(?:try|attempt|open|take|give|move|enter|leave|use|check|look|ask|tell)\b|\u6211(?:\u5c1d\u8bd5|\u8981|\u53bb|\u6253\u5f00|\u62ff|\u7ed9|\u8fdb\u5165|\u79bb\u5f00|\u4f7f\u7528|\u67e5\u770b|\u95ee|\u544a\u8bc9)|\u6211\u4eec(?:\u5c1d\u8bd5|\u8981|\u53bb|\u6253\u5f00|\u62ff|\u7ed9|\u8fdb\u5165|\u79bb\u5f00|\u4f7f\u7528|\u67e5\u770b|\u95ee|\u544a\u8bc9))/i.test(text);
}

function stripDirectorMention(value: string): string {
  return value.replace(/@(?:director|gm|system|导演|主持|裁判|旁白)/gi, " ").trim();
}

function sceneDeltaForOverride(request: DirectorOverrideRequest, summary: string): SceneDelta {
  if (request.action === "modify_scene") {
    return { currentScene: summary };
  }
  if (request.action === "modify_condition") {
    return { addUnresolved: [summary] };
  }
  return {};
}

function createOverrideSceneBoard(
  current: RoomSceneBoard,
  request: DirectorOverrideRequest,
  summary: string,
  nowIso: string,
): RoomSceneBoard | undefined {
  if (request.action === "modify_scene") {
    return { ...current, currentScene: summary, updatedAt: nowIso };
  }
  if (request.action === "modify_condition") {
    return { ...current, unresolved: dedupeTextList([summary, ...current.unresolved]).slice(0, 5), updatedAt: nowIso };
  }
  return undefined;
}

function directorKnownFacts(room: RoomState, directorMemory?: RoomDirectorMemorySnapshot): string[] {
  return dedupeTextList([
    room.director.sceneBoard.currentScene,
    room.director.sceneBoard.goal,
    ...room.director.sceneBoard.openClues,
    ...room.director.sceneBoard.unresolved,
    ...room.director.constraints
      .filter((item) => item.status === "active" || item.status === "needs_review")
      .map((item) => `${item.label}: ${item.detail}`),
    ...(directorMemory?.sceneBoard.openClues ?? []),
    ...(directorMemory?.continuity.entries.map((entry) => entry.detail) ?? []),
    ...(directorMemory?.entries.filter((entry) => entry.status !== "archived").map((entry) => entry.text) ?? []),
    ...(directorMemory?.secrets.map((secret) => `${secret.title}: ${secret.detail}`) ?? []),
    ...room.messages
      .slice(-6)
      .filter((message) => message.visibility !== "private_ai")
      .map((message) => `${message.speaker}: ${message.text}`),
  ]);
}

function prefersChinese(value: string): boolean {
  return /[\u4e00-\u9fff]/.test(value);
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
