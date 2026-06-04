import type {
  DeferredRequirement,
  FrameIntentCandidate,
  InputInterpretation,
  IntentTimeBinding,
  RejectedIntentSignal,
  RoomFrameAbsorption,
  RoomFrameAmbiguity,
  RoomFrameIntent,
  RoomFrameIntentKind,
  RoomFrameRequestedMode,
  RoomFrameUserRole,
  RoomFreedomLevel,
  RoomState,
} from "./types";

export interface InputInterpretationContext {
  room?: RoomState;
  userInput: string;
  targetingDirector?: boolean;
  now?: string;
  freedomLevel?: RoomFreedomLevel;
  surface?: "direct_chat" | "room" | "director" | "memory" | "graph";
}

const APP_SAFETY_PATTERN =
  /(api\s*key|password|private\s*key|seed\s*phrase|verification\s*code|payment|bank\s*card|shell|powershell|cmd\.exe|密钥|密码|私钥|助记词|验证码|银行卡|支付|执行命令|系统命令)/i;

const MODE_PATTERNS: Array<[RoomFrameRequestedMode, RegExp]> = [
  ["debate", /(debate|argument|motion|辩论|辩题|正方|反方|一辩|二辩|三辩|討論|ディベート|토론|찬성|반대|debatte|streitgespraech|дебат|спор)/i],
  ["story", /(story|scene|roleplay|剧情|故事|逃生|扮演|场景|转场|物語|シーン|脱出|이야기|장면|탈출|geschichte|szene|сюжет|сцена)/i],
  ["mystery", /(mystery|clue|case|推理|解谜|线索|案件|真相|謎|手がかり|事件|단서|사건|진실|raetsel|hinweis|fall|тайн|улика|дело)/i],
  ["study", /(study|learn|quiz|学习|讲解|练习|知识点|复习|学習|説明|練習|勉強|학습|설명|연습|lernen|uebung|обуч|учеб|практик)/i],
  ["planning", /(plan|roadmap|decision|计划|方案|规划|风险|下一步|計画|方針|リスク|계획|방안|위험|planen|entscheidung|risiko|план|решени|риск)/i],
  ["team_channel", /(team channel|faction|huddle|阵营|私下商量|阵营频道|队内|陣営|チーム|派閥|진영|팀|세력|fraktion|team|фракц|команд)/i],
  ["casual", /(casual|chat|日常|闲聊|聊天|雑談|日常|수다|일상|plaudern|чат|разговор)/i],
];

const DEFERRED_PATTERN =
  /(after|afterward|afterwards|later|finally|at\s+the\s+end|when\s+.+(?:finish|ends?)|最后|结束后|完成后|发言结束后|赛后|之后|等.+(?:结束|完成)|届时|後で|あとで|最後|終わったら|終了後|나중에|끝나면|마지막에|spaeter|danach|am ende|wenn .+ fertig|после|позже|в конце|когда .+ законч)/i;
const CONDITIONAL_PATTERN = /(if|when|once|unless|如果|若|当.+时|一旦|除非|满足.+后|もし|なら|때|면|wenn|falls|если|когда)/i;
const BACKGROUND_RULE_PATTERN =
  /(rule|always|never|from now on|以后|之后都|默认|规则|要求|必须|不要|不得|应当|保持|ルール|必ず|しないで|규칙|항상|하지 마|regel|immer|nie|правил|всегда|никогда)/i;

const IMMEDIATE_PATTERN = /(now|right now|immediately|现在|立即|马上|立刻|此刻|今すぐ|ただちに|지금|즉시|sofort|jetzt|сейчас|немедленно)/i;
const SETUP_PATTERN =
  /(organize|host|start|run|set up|setup|assign|arrange|schedule|motion|side|speaker|no\s+speaker\s+assignment|not\s+assigned|组织|主持|开始|安排|分配|调度|辩题|正方|反方|一辩|二辩|三辩|赛制|流程|分辩手|没.{0,8}分.{0,8}辩手|没有.{0,8}分.{0,8}辩手|未.{0,8}分配.{0,8}辩手|開催|割り当て|進行|주최|시작|배정|진행|organisieren|moderieren|zuweisen|starten|организ|назнач|начать|провести)/i;
const EVALUATION_PATTERN =
  /(judge|evaluate|verdict|winner|who won|advantage|score|评判|评价|裁判|胜负|谁赢|哪队赢|获胜|分出胜负|判.+赢|优势|打分|评分|判定|評価|勝敗|勝者|판정|평가|승부|누가 이겼|bewerte|urteil|gewinner|wer hat gewonnen|оцени|судья|победитель|кто победил)/i;
const COLLABORATION_PATTERN =
  /(collaborate|huddle|discuss privately|team up|work together|分工|协作|合作|商量|私下商量|队内|阵营商量|联合|配合|派人回应|相談|協力|チーム内|협력|상담|회의|zusammenarbeit|absprechen|команд|совмест|обсуд)/i;
const MEMORY_WRITE_PATTERN =
  /(remember(?: that)?|memorize|note that|save this|keep in memory|记住|记一下|记下来|帮我记|记忆|以后记得|保存为记忆|覚えて|記憶して|メモして|忘れないで|기억해|기억해줘|메모해|저장해|merk dir|speichere|notiere|behalte|запомни|запиши|сохрани)/i;
const MEMORY_RECALL_PATTERN =
  /(do you remember|did you remember|你记得|还记得|覚えてる|覚えていますか|기억해\??|기억나|erinnerst du dich|weisst du noch|ты помнишь|помнишь)/i;
const PREFERENCE_STATEMENT_PATTERN =
  /(i like|i prefer|my preference is|我喜欢|我偏好|我的偏好是|好き|好み|좋아해|선호|ich mag|ich bevorzuge|мне нравится|я предпочитаю)/i;
const PLOT_PATTERN =
  /(plot|arc|foreshadow|twist|scene transition|剧情|伏笔|转折|转场|改成.+剧情|逃生|故事走向|下一幕|阶段推进|伏線|転換|반전|전환|plot|wendung|сюжет|поворот)/i;
const MODE_SHIFT_PATTERN =
  /(change to|switch to|turn this into|make this a|now it is|改成|换成|变成|切到|进入.+模式|开始.+剧情|现在.+玩法|に変えて|切り替え|바꿔|전환|wechsel|mach daraus|переключ|измени)/i;
const META_CONTROL_PATTERN =
  /(pause|stop|continue|resume|recap|summarize|fast[- ]?forward|switch channel|reassign|暂停|停一下|继续|恢复|总结|快进|跳过|切到|切换|重排|分配|一時停止|続けて|要約|계속|멈춰|요약|paus|weiter|zusammenfass|пауза|продолж|резюм)/i;
const WORLD_EDIT_PATTERN =
  /(i win|we win|you lose|winner|actually|retcon|change|make it|set|override|has the key|door is open|我赢了|我们赢了|比赛结束|已经赢|获胜了|其实|改成|设定为|修改|覆盖|门.*打开|钥匙.*(?:在|归|属于)|勝った|勝利|이겼|승리|ich habe gewonnen|мы выиграли|я выиграл)/i;
const ACTION_ATTEMPT_PATTERN =
  /(try to|attempt to|open|take|enter|attack|inspect|search|persuade|sneak|unlock|尝试|试图|打开|拿|进入|攻击|检查|搜索|说服|潜入|撬|試す|開ける|入る|시도|열다|들어가|versuche|oeffne|betrete|пытаюсь|открываю|вхожу)/i;
const OOC_PATTERN =
  /(i want|please make|prefer|rules?|pacing|style|tone|希望|我想|请你|帮我|规则|玩法|节奏|风格|不要|更|安排|组织|お願い|ルール|스타일|규칙|bitte|regel|stil|пожалуйста|правил|стиль)/i;

export function interpretUserInput(context: InputInterpretationContext): InputInterpretation {
  return resolveInputInterpretation(context);
}

export function collectInputIntentCandidates(context: InputInterpretationContext): FrameIntentCandidate[] {
  const text = context.userInput.trim();
  const requestedMode = requestedModeFromText(text);
  const timeBinding = resolveTimeBinding(text);
  const candidates: FrameIntentCandidate[] = [];

  if (context.targetingDirector) {
    addCandidate(candidates, candidate("director_request", 72, "@Director target", "immediate", requestedMode));
  }
  if (SETUP_PATTERN.test(text)) {
    addCandidate(candidates, candidate("scheduling_request", 86, "setup/scheduling signal", "immediate", requestedMode));
  }
  if (EVALUATION_PATTERN.test(text)) {
    const evaluationTime = IMMEDIATE_PATTERN.test(text) ? "immediate" : timeBinding;
    addCandidate(candidates, candidate("evaluation_request", evaluationTime === "deferred" ? 64 : 80, "evaluation signal", evaluationTime, requestedMode));
  }
  if (COLLABORATION_PATTERN.test(text)) {
    addCandidate(candidates, candidate("collaboration_request", 72, "collaboration signal", timeBinding, requestedMode));
  }
  if (META_CONTROL_PATTERN.test(text)) {
    addCandidate(candidates, candidate("meta_control", 66, "control signal", timeBinding, requestedMode));
  }
  if (MODE_SHIFT_PATTERN.test(text) || (requestedMode && !SETUP_PATTERN.test(text))) {
    addCandidate(candidates, candidate("mode_shift", 64, "mode shift signal", timeBinding, requestedMode));
  }
  if (PLOT_PATTERN.test(text)) {
    addCandidate(candidates, candidate("plot_direction", 68, "plot direction signal", timeBinding, requestedMode));
  }
  if ((MEMORY_WRITE_PATTERN.test(text) || PREFERENCE_STATEMENT_PATTERN.test(text)) && !isRecallQuestion(text)) {
    addCandidate(candidates, candidate("memory_request", MEMORY_WRITE_PATTERN.test(text) ? 78 : 56, "memory/preference signal", "immediate", requestedMode));
  }
  if (WORLD_EDIT_PATTERN.test(text)) {
    addCandidate(candidates, candidate("world_edit_claim", 58, "room-state claim signal", timeBinding, requestedMode));
  }
  if (ACTION_ATTEMPT_PATTERN.test(text)) {
    addCandidate(candidates, candidate("action_attempt", 58, "action attempt signal", timeBinding, requestedMode));
  }
  if (OOC_PATTERN.test(text)) {
    addCandidate(candidates, candidate("out_of_character_request", 52, "preference/rules signal", timeBinding, requestedMode));
  }

  if (candidates.length === 0) {
    addCandidate(candidates, candidate("in_character", 40, "fallback in-character input", "immediate", requestedMode));
  }

  return candidates.sort((left, right) => right.score - left.score);
}

export function resolveInputInterpretation(context: InputInterpretationContext): InputInterpretation {
  const text = context.userInput.trim();
  const authority = context.freedomLevel ?? context.room?.freedomLevel ?? "balanced";
  const candidates = collectInputIntentCandidates(context);
  const deferredRequirements = collectDeferredRequirements(text);
  const primary = candidates[0] ?? candidate("in_character", 40, "fallback in-character input");
  const secondary = candidates.slice(1, 7);
  const kind = primary.kind;
  const requestedMode = primary.requestedMode ?? requestedModeFromText(text);
  const userRole = userRoleFor(kind, authority);
  const absorption = absorptionFor(kind, authority, text, primary);
  const rejected = collectRejectedSignals(kind, text);
  const ambiguity = resolveAmbiguity(primary, secondary);
  return {
    kind,
    userRole,
    absorption,
    summary: summarizeInterpretation(kind, absorption, text, requestedMode, deferredRequirements),
    authority,
    requestedMode,
    primary,
    secondary,
    deferredRequirements,
    rejected,
    ambiguity,
    sourceText: text.slice(0, 240),
    createdAt: context.now ?? new Date().toISOString(),
  };
}

export function collectRoomFrameIntentCandidates(input: {
  room: RoomState;
  userInput: string;
  targetingDirector?: boolean;
}): FrameIntentCandidate[] {
  return collectInputIntentCandidates({ ...input, surface: "room" });
}

export function resolveRoomFrameInterpretation(input: {
  room: RoomState;
  userInput: string;
  targetingDirector?: boolean;
  now?: string;
}): InputInterpretation {
  return resolveInputInterpretation({ ...input, surface: "room" });
}

export function resolveRoomFrameIntent(input: {
  room: RoomState;
  userInput: string;
  targetingDirector?: boolean;
  now?: string;
}): RoomFrameIntent {
  return resolveRoomFrameInterpretation(input);
}

function requestedModeFromText(text: string): RoomFrameRequestedMode | undefined {
  return MODE_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
}

function resolveTimeBinding(text: string): IntentTimeBinding {
  if (DEFERRED_PATTERN.test(text)) {
    return "deferred";
  }
  if (CONDITIONAL_PATTERN.test(text)) {
    return "conditional";
  }
  if (BACKGROUND_RULE_PATTERN.test(text)) {
    return "background_rule";
  }
  return "immediate";
}

function candidate(
  kind: RoomFrameIntentKind,
  score: number,
  reason: string,
  timeBinding: IntentTimeBinding = "immediate",
  requestedMode?: RoomFrameRequestedMode,
): FrameIntentCandidate {
  return { kind, score: Math.max(0, Math.min(100, score)), timeBinding, reason, requestedMode };
}

function addCandidate(candidates: FrameIntentCandidate[], next: FrameIntentCandidate): void {
  const existing = candidates.find((item) => item.kind === next.kind && item.timeBinding === next.timeBinding);
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

function collectDeferredRequirements(text: string): DeferredRequirement[] {
  const compact = text.trim().replace(/\s+/g, " ").slice(0, 240);
  const requirements: DeferredRequirement[] = [];
  if (DEFERRED_PATTERN.test(text) && EVALUATION_PATTERN.test(text)) {
    requirements.push({
      kind: "final_verdict",
      summary: "在相关发言或证据结束后再给出最终评判。",
      trigger: "all_relevant_speakers_done",
      sourceText: compact,
    });
  }
  if (DEFERRED_PATTERN.test(text) && /(summarize|recap|总结|复盘|要約|요약|zusammenfass|резюм)/i.test(text)) {
    requirements.push({
      kind: "round_summary",
      summary: "在当前阶段结束后总结。",
      trigger: "stage_complete",
      sourceText: compact,
    });
  }
  if (DEFERRED_PATTERN.test(text) && /(next step|下一步|方案|计划|次のステップ|다음 단계|naechster schritt|следующий шаг)/i.test(text)) {
    requirements.push({
      kind: "planning_next_step",
      summary: "在收集风险和约束后给出下一步。",
      trigger: "planning_inputs_collected",
      sourceText: compact,
    });
  }
  if (DEFERRED_PATTERN.test(text) && PLOT_PATTERN.test(text)) {
    requirements.push({
      kind: "plot_payoff",
      summary: "将该剧情要求作为后续伏笔或回收点。",
      trigger: "plot_condition_met",
      sourceText: compact,
    });
  }
  return requirements;
}

function userRoleFor(kind: RoomFrameIntentKind, freedomLevel: RoomFreedomLevel): RoomFrameUserRole {
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

function absorptionFor(
  kind: RoomFrameIntentKind,
  freedomLevel: RoomFreedomLevel,
  text: string,
  primary: FrameIntentCandidate,
): RoomFrameAbsorption {
  if (APP_SAFETY_PATTERN.test(text)) {
    return "blocked";
  }
  if (freedomLevel === "developer") {
    return "direct_apply";
  }
  if (kind === "in_character") {
    return "normal_reply";
  }
  if (kind === "meta_control") {
    return /(私下商量|阵营频道|huddle|让.+发言|重排|分配|assign|reassign|팀|회의|zuweisen|назнач)/i.test(text)
      ? "private_directive"
      : "direct_apply";
  }
  if (kind === "director_request" || kind === "scheduling_request" || kind === "collaboration_request") {
    return "private_directive";
  }
  if (kind === "evaluation_request") {
    return primary.timeBinding === "deferred" ? "private_directive" : freedomLevel === "strict" ? "wait_for_choice" : "plot_transition";
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

function collectRejectedSignals(kind: RoomFrameIntentKind, text: string): RejectedIntentSignal[] {
  return APP_SAFETY_PATTERN.test(text) ? [{ kind, reason: "app safety signal blocked this input" }] : [];
}

function resolveAmbiguity(primary: FrameIntentCandidate, secondary: FrameIntentCandidate[]): RoomFrameAmbiguity {
  if (secondary.length > 2 || (secondary[0] && Math.abs(primary.score - secondary[0].score) < 12)) {
    return "high";
  }
  return secondary.length > 0 ? "medium" : "low";
}

function summarizeInterpretation(
  kind: RoomFrameIntentKind,
  absorption: RoomFrameAbsorption,
  text: string,
  requestedMode?: RoomFrameRequestedMode,
  deferredRequirements: DeferredRequirement[] = [],
): string {
  const compact = text.trim().replace(/\s+/g, " ").slice(0, 140);
  const deferred = deferredRequirements.length > 0 ? `；延期要求：${deferredRequirements.map((item) => item.kind).join(", ")}` : "";
  if (kind === "scheduling_request") {
    return `识别为组织/调度请求，处理方式：${absorption}${deferred}。${compact}`;
  }
  if (kind === "evaluation_request") {
    return `识别为评判请求，处理方式：${absorption}${deferred}。${compact}`;
  }
  if (kind === "collaboration_request") {
    return `识别为协作请求，处理方式：${absorption}${deferred}。${compact}`;
  }
  if (kind === "memory_request") {
    return `识别为记忆请求，处理方式：${absorption}。${compact}`;
  }
  if (kind === "plot_direction") {
    return `识别为剧情方向，处理方式：${absorption}${deferred}。${compact}`;
  }
  if (kind === "action_attempt") {
    return `识别为行动尝试，处理方式：${absorption}。${compact}`;
  }
  if (requestedMode && kind === "mode_shift") {
    return `识别为模式切换到 ${requestedMode}，处理方式：${absorption}${deferred}。${compact}`;
  }
  if (kind === "world_edit_claim") {
    return `识别为事实声明，处理方式：${absorption}${deferred}。${compact}`;
  }
  if (kind === "meta_control") {
    return `识别为控制指令，处理方式：${absorption}${deferred}。${compact}`;
  }
  if (kind === "director_request") {
    return `识别为导演请求，处理方式：${absorption}${deferred}。${compact}`;
  }
  if (kind === "out_of_character_request") {
    return `识别为玩法偏好，处理方式：${absorption}${deferred}。${compact}`;
  }
  return `识别为房间内发言。${compact}`;
}

function isRecallQuestion(text: string): boolean {
  return MEMORY_RECALL_PATTERN.test(text) && /[?？か吗嘛呢]/.test(text);
}
