import type { MemoryScope, MemorySensitivity } from "./types";
import type {
  MemoryClaimInput,
  MemoryEntityRef,
  MemoryGraphAuthority,
  MemoryGraphClaimKind,
  MemoryGraphVisibility,
  MemorySourceInput,
} from "./memoryGraph";

export type MemoryExtractionSourceType =
  | "user_explicit_remember"
  | "developer_statement"
  | "director_ruling"
  | "director_plot_state"
  | "room_public_result"
  | "character_public_message"
  | "private_ai"
  | "faction_huddle"
  | "identity_card"
  | "manual_edit";

export interface MemoryExtractionEvent {
  scope: MemoryScope;
  text: string;
  sourceType: MemoryExtractionSourceType;
  source?: Partial<MemorySourceInput>;
  visibility?: MemoryGraphVisibility;
  knownToRoleIds?: string[];
  factionId?: string;
  directorVisible?: boolean;
  subject?: MemoryEntityRef;
  authority?: MemoryGraphAuthority;
  developerMode?: boolean;
  now?: Date;
}

export interface MemoryCompressionContext {
  scope: MemoryScope;
  sourceType: MemoryExtractionSourceType;
  recentContext?: string[];
  roomMode?: string;
  channelId?: string;
  factionId?: string;
}

export interface SemanticMemoryClaim extends MemoryClaimInput {
  properties?: MemoryClaimInput["properties"] & {
    compressionReason?: string;
    originalExcerpt?: string;
  };
}

export interface MemoryWritePlan {
  claims: SemanticMemoryClaim[];
  affectedScopes: MemoryScope[];
  skippedReason?: "filtered" | "low_information" | "recall_question" | "no_semantic_claim";
}

interface ExtractedMemoryAtom {
  kind: MemoryGraphClaimKind;
  subject: MemoryEntityRef;
  predicate: string;
  object?: MemoryEntityRef;
  text: string;
  confidence: number;
  sensitivity: MemorySensitivity;
  conflictPolicy: MemoryClaimInput["conflictPolicy"];
  compressionReason: string;
}

const MAX_CLAIMS_PER_EVENT = 3;
const MAX_EXCERPT_CHARS = 180;
const MAX_VALUE_CHARS = 96;

const GREETING_PATTERN =
  /^(?:你好|您好|嗨|哈喽|hello|hi|hey|早上好|晚上好|谢谢|多谢|ok|okay|好的|嗯|测试|test|こんにちは|안녕|hallo|привет)[。！？?.\s]*$/i;
const LOW_INFO_PATTERN = /^[\p{N}\p{P}\p{S}\s]+$/u;
const PROVIDER_ERROR_PATTERN =
  /(no chat model is available|model_unavailable|local_error|cloud_error|provider error|request failed|timeout|模型不可用|本地模型.*失败|云端聊天服务.*失败|请求超时|连接失败)/i;
const PRIVATE_DIRECTIVE_PATTERN =
  /(private directive|privateDirectives|next speaker|target role|planner-like|私有调度|后台调度|下一位发言|发言顺序|先确认.*再|接下来.*发言|请.*发言)/i;
const MEMORY_ARTIFACT_PATTERN =
  /(?:房间相关事实|角色相关事实|用户相关事实)\s*[:：].*(?:房间相关事实|角色相关事实|用户相关事实)\s*[:：]|^(?:room summary|summary)\s*:|\b(?:preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict)\s*:\s*[^|]+\|\s*(?:preference|fact|relationship|plan|constraint|scene|item|clue|stance|argument|task|conflict)\s*:/i;
const SENSITIVE_SECRET_PATTERN =
  /(api\s*key|apikey|access\s*token|secret\s*key|private\s*key|password|passwd|bearer\s+[a-z0-9._-]+|sk-[a-z0-9_-]{16,}|验证码|校验码|密码|私钥|助记词|银行卡|信用卡|支付密码)/i;
const SPECULATIVE_PATTERN = /(也许|可能|大概|猜测|似乎|maybe|probably|might|could be|かもしれない|아마|vielleicht|может быть)/i;
const RECALL_QUESTION_PATTERN =
  /(?:你记得|你还记得|记不记得|do you remember|did you remember|覚えてる|覚えていますか|기억나|erinnerst du dich|weisst du noch|помнишь|ты помнишь).{0,80}[?？吗么]?$|我记得/i;
const MEMORY_REQUEST_PATTERN =
  /(记住|请记住|记一下|记录一下|记下来|保存为记忆|以后记得|remember(?: that)?|keep in mind|note that|save this|memorize|覚えて|記憶して|メモして|기억해줘|기억해|저장해|메모해|merk dir|merken|notiere|speichere|запомни|сохрани|запиши|помни)/i;
const MEMORY_REQUEST_PREFIX_PATTERN =
  /^\s*(?:please|请|麻烦|帮我)?\s*(?:记住|请记住|记一下|记录一下|记下来|保存为记忆|以后记得|remember(?:\s+that)?|keep in mind|note that|save this|memorize|覚えて|記憶して|メモして|기억해줘|기억해|저장해|메모해|merk dir|merken|notiere|speichere|запомни|сохрани|запиши|помни)\s*[:：,，。.!！？]?\s*/i;

export class MemoryExtractionPipeline {
  extract(event: MemoryExtractionEvent): MemoryClaimInput[] {
    return extractMemoryClaimsFromEvent(event);
  }
}

export function buildMemoryWritePlan(event: MemoryExtractionEvent, _context?: MemoryCompressionContext): MemoryWritePlan {
  const claims = extractMemoryClaimsFromEvent(event) as SemanticMemoryClaim[];
  if (claims.length > 0) {
    return {
      claims,
      affectedScopes: Array.from(new Set(claims.map((claim) => claim.scope))),
    };
  }
  const text = normalizeMemoryExtractionText(event.text);
  return {
    claims: [],
    affectedScopes: [event.scope],
    skippedReason: skippedReasonForText(text, event),
  };
}

export function compressMemoryClaim(event: MemoryExtractionEvent, context?: MemoryCompressionContext): SemanticMemoryClaim[] {
  return buildMemoryWritePlan(event, context).claims;
}

export function extractMemoryClaimsFromEvent(event: MemoryExtractionEvent): MemoryClaimInput[] {
  const text = normalizeMemoryExtractionText(event.text);
  if (!shouldAttemptMemoryExtraction(text, event)) {
    return [];
  }

  const authority = resolveAuthority(event);
  const visibility = resolveVisibility(event);
  const source = createMemorySource(event, text);
  const atoms = extractAtoms(text, event, authority).slice(0, MAX_CLAIMS_PER_EVENT);

  return atoms.map((atom) => ({
    scope: event.scope,
    kind: atom.kind,
    subject: atom.subject,
    predicate: atom.predicate,
    object: atom.object,
    text: atom.text,
    visibility,
    knownToRoleIds: event.knownToRoleIds,
    factionId: event.factionId,
    directorVisible: event.directorVisible ?? (visibility === "known_to_roles" || visibility === "faction" || visibility === "director_only"),
    confidence: authority === "developer" ? 1 : atom.confidence,
    authority,
    sensitivity: atom.sensitivity,
    source,
    conflictPolicy: authority === "developer" ? "supersede" : atom.conflictPolicy,
    evidenceCount: 1,
    properties: {
      extractionSourceType: event.sourceType,
      compressionReason: atom.compressionReason,
      originalExcerpt: source.excerpt,
    },
  }));
}

function shouldAttemptMemoryExtraction(text: string, event: MemoryExtractionEvent): boolean {
  if (!text || text.length < 2) {
    return false;
  }
  if (RECALL_QUESTION_PATTERN.test(text)) {
    return false;
  }
  if (LOW_INFO_PATTERN.test(text) || GREETING_PATTERN.test(text)) {
    return false;
  }
  if (PROVIDER_ERROR_PATTERN.test(text) || PRIVATE_DIRECTIVE_PATTERN.test(text) || MEMORY_ARTIFACT_PATTERN.test(text)) {
    return false;
  }
  if (SENSITIVE_SECRET_PATTERN.test(text)) {
    return false;
  }
  if (event.sourceType === "character_public_message" && text.length < 12 && !hasStableFactSignal(text)) {
    return false;
  }
  return true;
}

function skippedReasonForText(text: string, event: MemoryExtractionEvent): MemoryWritePlan["skippedReason"] {
  if (!text || LOW_INFO_PATTERN.test(text) || GREETING_PATTERN.test(text)) {
    return "low_information";
  }
  if (RECALL_QUESTION_PATTERN.test(text)) {
    return "recall_question";
  }
  if (!shouldAttemptMemoryExtraction(text, event)) {
    return "filtered";
  }
  return "no_semantic_claim";
}

function extractAtoms(text: string, event: MemoryExtractionEvent, authority: MemoryGraphAuthority): ExtractedMemoryAtom[] {
  const atoms: ExtractedMemoryAtom[] = [];
  const defaultSubject = event.subject ?? defaultSubjectForEvent(event);

  const identity = extractIdentity(text, defaultSubject);
  if (identity) atoms.push(identity);

  const explicitPreference = extractExplicitPreference(text, defaultSubject);
  if (explicitPreference) atoms.push(explicitPreference);

  const goal = extractGoal(text, defaultSubject, event);
  if (goal) atoms.push(goal);

  const developerJudgement = authority === "developer" ? extractDeveloperJudgement(text, defaultSubject) : null;
  if (developerJudgement) atoms.push(developerJudgement);

  if (event.sourceType === "director_ruling" || event.sourceType === "director_plot_state") {
    atoms.push({
      kind: "judgement",
      subject: defaultSubject,
      predicate: "ruled_as",
      object: conceptEntity(text),
      text: createClaimText("裁定", text),
      confidence: 0.9,
      sensitivity: event.visibility === "director_only" ? "private" : "normal",
      conflictPolicy: "supersede",
      compressionReason: "director_ruling",
    });
  }

  const locatedItem = extractItemLocation(text);
  if (locatedItem) atoms.push(locatedItem);

  const secret = extractSecret(text, defaultSubject, event);
  if (secret) atoms.push(secret);

  const stance = extractStance(text, defaultSubject, event);
  if (stance) atoms.push(stance);

  return dedupeAtoms(atoms);
}

function extractIdentity(text: string, subject: MemoryEntityRef): ExtractedMemoryAtom | null {
  const candidate = firstMatchValue(text, [
    /(?:记住|请记住|记一下|以后记得)?\s*(?:我叫|我的名字是|叫我)\s*([a-zA-Z0-9_\-\u4e00-\u9fff]{1,32})/i,
    /(?:remember(?: that)?|note that)?\s*(?:my name is|call me)\s*([a-zA-Z0-9_-]{1,32})/i,
  ]);
  if (!candidate) {
    return null;
  }
  return {
    kind: "identity",
    subject,
    predicate: "is_named",
    object: conceptEntity(candidate),
    text: `用户名字是：${candidate}。`,
    confidence: 0.95,
    sensitivity: "normal",
    conflictPolicy: "supersede",
    compressionReason: "explicit_identity",
  };
}

function extractExplicitPreference(text: string, subject: MemoryEntityRef): ExtractedMemoryAtom | null {
  const normalized = stripMemoryRequestPrefix(text);
  const dislike = extractPreferenceValue(normalized, true);
  if (dislike) {
    return {
      kind: "preference",
      subject,
      predicate: "dislikes",
      object: conceptEntity(dislike),
      text: `用户不喜欢：${dislike}。`,
      confidence: MEMORY_REQUEST_PATTERN.test(text) ? 0.95 : 0.86,
      sensitivity: "normal",
      conflictPolicy: "merge",
      compressionReason: "explicit_preference",
    };
  }

  const value = extractPreferenceValue(normalized, false);
  if (!value) {
    return null;
  }
  return {
    kind: "preference",
    subject,
    predicate: "prefers",
    object: conceptEntity(value),
    text: `用户偏好：${value}。`,
    confidence: MEMORY_REQUEST_PATTERN.test(text) ? 0.95 : 0.86,
    sensitivity: "normal",
    conflictPolicy: "merge",
    compressionReason: "explicit_preference",
  };
}

function extractPreferenceValue(text: string, negative: boolean): string | null {
  const patterns = negative
    ? [
        /(?:我|用户)\s*(?:不喜欢|讨厌|反感)\s*([^\n。！？；;.!?]{1,80})/i,
        /(?:I|user)\s*(?:dislike|hate)\s*([^\n.!?;]{1,80})/i,
      ]
    : [
        /(?:我(?:的)?|用户(?:的)?)?\s*(?:偏好|喜好|喜欢|爱好)\s*(?:是|为|=|:|：)?\s*([^\n。！？；;.!?]{1,80})/i,
        /(?:我|用户)\s*(?:喜欢|偏好|偏爱|想要|希望)\s*([^\n。！？；;.!?]{1,80})/i,
        /(?:my|user(?:'s)?)\s*(?:preference|favorite|favourite|like)\s*(?:is|=|:)?\s*([^\n.!?;]{1,80})/i,
        /(?:I|user)\s*(?:like|prefer|love)\s*([^\n.!?;]{1,80})/i,
        /(?:私|僕|ユーザー)は?\s*([^。！？?]{1,40})\s*(?:が好き|を好む)/i,
        /(?:나는|내가|사용자는)?\s*([^\n.!?。！？]{1,40})\s*(?:좋아해|선호해)/i,
        /(?:ich|benutzer)\s*(?:mag|bevorzuge)\s*([^\n.!?;]{1,80})/i,
        /(?:мне|пользователь)\s*(?:нравится|нравятся)\s*([^\n.!?;]{1,80})/i,
      ];
  const value = firstMatchValue(text, patterns);
  if (!value) {
    return null;
  }
  const normalized = normalizeExplicitValue(value);
  return normalized && isSemanticValue(normalized) ? normalized : null;
}

function extractGoal(text: string, subject: MemoryEntityRef, event: MemoryExtractionEvent): ExtractedMemoryAtom | null {
  const candidate = firstMatchValue(stripMemoryRequestPrefix(text), [
    /(?:目标|任务|计划|策略)\s*(?:是|为|=|:|：)\s*([^\n。！？；;]{1,120})/i,
    /(?:my|our|user(?:'s)?)\s*(?:goal|plan|task|strategy)\s*(?:is|=|:)\s*([^\n.!?;]{1,120})/i,
  ]);
  if (!candidate) {
    return null;
  }
  const value = normalizeExplicitValue(candidate);
  const label = event.sourceType === "faction_huddle" ? "阵营策略" : "目标";
  return {
    kind: event.sourceType === "faction_huddle" ? "plan" : "goal",
    subject,
    predicate: "has_goal",
    object: conceptEntity(value),
    text: `${label}：${value}。`,
    confidence: event.sourceType === "faction_huddle" ? 0.72 : 0.86,
    sensitivity: event.visibility === "faction" || event.visibility === "known_to_roles" ? "private" : "normal",
    conflictPolicy: "merge",
    compressionReason: event.sourceType === "faction_huddle" ? "faction_strategy" : "goal",
  };
}

function extractDeveloperJudgement(text: string, subject: MemoryEntityRef): ExtractedMemoryAtom | null {
  const winner = firstMatchValue(text, [
    /(?:我|用户|玩家|(.{1,24}?))\s*(?:赢了|获胜|胜出|won)/i,
    /(?:winner|winning side)\s*(?:is|=|:)\s*([^\n.!?;。！？；]{1,40})/i,
  ]);
  if (!winner) {
    return null;
  }
  const value = normalizeExplicitValue(winner);
  return {
    kind: "judgement",
    subject,
    predicate: "won",
    object: conceptEntity(value),
    text: `${value}获胜。`,
    confidence: 1,
    sensitivity: "normal",
    conflictPolicy: "supersede",
    compressionReason: "developer_override",
  };
}

function extractItemLocation(text: string): ExtractedMemoryAtom | null {
  const match = text.match(/(钥匙|门禁卡|地图|线索|证据|道具|物品|key|card|map|clue|evidence|item)\s*(?:在|位于|放在|藏在|located in|is in|with)\s*([^\n。！？；;]{1,60})/i);
  if (!match) {
    return null;
  }
  const item = normalizeExplicitValue(match[1]);
  const location = normalizeExplicitValue(match[2]);
  if (!item || !location) {
    return null;
  }
  const itemKind: MemoryGraphClaimKind = /线索|证据|clue|evidence/i.test(item) ? "clue" : "item";
  return {
    kind: itemKind,
    subject: {
      kind: itemKind === "clue" ? "clue" : "item",
      canonicalKey: normalizeKey(item),
      displayName: item,
    },
    predicate: "located_in",
    object: {
      kind: "location",
      canonicalKey: normalizeKey(location),
      displayName: location,
    },
    text: `${item}在${location}。`,
    confidence: 0.78,
    sensitivity: "normal",
    conflictPolicy: "dispute",
    compressionReason: "item_location",
  };
}

function extractSecret(text: string, subject: MemoryEntityRef, event: MemoryExtractionEvent): ExtractedMemoryAtom | null {
  const candidate = firstMatchValue(text, [
    /(?:秘密|暗线|隐藏事实|私密目标|真实身份)\s*(?:是|为|=|:|：)\s*([^\n。！？；;]{1,140})/i,
    /(?:secret|hidden fact|private goal|true identity)\s*(?:is|=|:)\s*([^\n.!?;]{1,140})/i,
  ]);
  if (!candidate) {
    return null;
  }
  const value = normalizeExplicitValue(candidate);
  return {
    kind: "secret",
    subject,
    predicate: "has_secret",
    object: conceptEntity(value),
    text: `隐藏事实：${value}。`,
    confidence: event.sourceType === "director_ruling" ? 0.9 : 0.78,
    sensitivity: "private",
    conflictPolicy: "merge",
    compressionReason: "secret",
  };
}

function extractStance(text: string, subject: MemoryEntityRef, event: MemoryExtractionEvent): ExtractedMemoryAtom | null {
  if (event.sourceType !== "character_public_message" && event.sourceType !== "room_public_result") {
    return null;
  }
  const match = text.match(/(?:我方|正方|反方|我|用户|[^，。！？；;]{1,32})\s*(?:认为|主张|反对|支持|质疑|argues?|opposes?|supports?)\s*([^\n。！？；;.!?]{4,140})/i);
  if (!match?.[0]) {
    return null;
  }
  const value = normalizeExplicitValue(match[0]);
  if (!value) {
    return null;
  }
  return {
    kind: "stance",
    subject,
    predicate: "asserts_stance",
    object: conceptEntity(value),
    text: `立场：${value}。`,
    confidence: 0.58,
    sensitivity: "normal",
    conflictPolicy: SPECULATIVE_PATTERN.test(text) ? "dispute" : "merge",
    compressionReason: "stance",
  };
}

function hasStableFactSignal(text: string): boolean {
  return /(位于|在.+(?:里|中|手里)|属于|持有|获得|失去|目标|任务|秘密|暗线|身份|线索|证据|门|锁|钥匙|胜负|赢|输|裁定|确认|事实|约束|规则|located in|belongs to|has goal|secret|clue|evidence|ruling)/i.test(text);
}

function resolveAuthority(event: MemoryExtractionEvent): MemoryGraphAuthority {
  if (event.developerMode || event.authority === "developer") {
    return "developer";
  }
  if (event.authority) {
    return event.authority;
  }
  if (event.sourceType === "director_ruling" || event.sourceType === "director_plot_state") {
    return "director";
  }
  if (event.sourceType === "character_public_message" || event.sourceType === "private_ai" || event.sourceType === "faction_huddle") {
    return "character";
  }
  return "user";
}

function resolveVisibility(event: MemoryExtractionEvent): MemoryGraphVisibility {
  if (event.visibility) {
    return event.visibility;
  }
  if (event.scope === "global") {
    return "global";
  }
  if (event.sourceType === "private_ai") {
    return "known_to_roles";
  }
  if (event.sourceType === "faction_huddle") {
    return "faction";
  }
  if (event.scope.startsWith("character:")) {
    return "private_character";
  }
  return "public";
}

function createMemorySource(event: MemoryExtractionEvent, text: string): MemorySourceInput {
  const createdAt = event.source?.createdAt ?? (event.now ?? new Date()).toISOString();
  const excerpt = trimToLength(event.source?.excerpt ?? text, MAX_EXCERPT_CHARS);
  return {
    ...event.source,
    sourceScope: event.source?.sourceScope ?? event.scope,
    sourceTextHash: event.source?.sourceTextHash ?? stableExtractionId("source", text),
    excerpt,
    createdAt,
  };
}

function defaultSubjectForEvent(event: MemoryExtractionEvent): MemoryEntityRef {
  if (event.sourceType === "user_explicit_remember" || event.sourceType === "developer_statement" || event.sourceType === "manual_edit") {
    return { kind: "user", canonicalKey: "user", displayName: "User" };
  }
  if (event.sourceType === "director_ruling" || event.sourceType === "director_plot_state" || event.scope.endsWith(":system")) {
    return { kind: "director", canonicalKey: event.scope, displayName: "Director" };
  }
  if (event.source?.speakerId && event.sourceType === "character_public_message") {
    return { kind: "room_participant", canonicalKey: `${event.scope}:${event.source.speakerId}`, displayName: event.source.speakerId };
  }
  if (event.scope === "global") {
    return { kind: "user", canonicalKey: "global-user", displayName: "User" };
  }
  if (event.scope.startsWith("character:")) {
    const packId = event.scope.slice("character:".length);
    return { kind: "character_pack", canonicalKey: packId, displayName: packId };
  }
  if (event.scope.startsWith("room:")) {
    const parts = event.scope.split(":");
    if (parts[2] === "observer" && parts[3]) {
      return { kind: "room_participant", canonicalKey: `${parts[1]}:${parts[3]}`, displayName: parts[3] };
    }
    if (parts[2] === "faction" && parts[3]) {
      return { kind: "faction", canonicalKey: `${parts[1]}:${parts[3]}`, displayName: parts[3] };
    }
    return { kind: "room", canonicalKey: parts[1] ?? event.scope, displayName: parts[1] ?? event.scope };
  }
  return { kind: "unknown", canonicalKey: normalizeKey(event.scope), displayName: event.scope };
}

function conceptEntity(text: string): MemoryEntityRef {
  const value = trimToLength(stripMemoryTrailingNoise(text), MAX_VALUE_CHARS);
  return {
    kind: "concept",
    canonicalKey: normalizeKey(value),
    displayName: value,
  };
}

function createClaimText(prefix: string, text: string): string {
  const value = stripMemoryTrailingNoise(text);
  return value.endsWith("。") ? `${prefix}：${value}` : `${prefix}：${value}。`;
}

function firstMatchValue(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) {
      return value;
    }
  }
  return null;
}

function stripMemoryRequestPrefix(text: string): string {
  return text.replace(MEMORY_REQUEST_PREFIX_PATTERN, "").trim();
}

function normalizeExplicitValue(value: string): string {
  const clean = stripMemoryTrailingNoise(value)
    .replace(/^(?:is|=|:|：)\s*/i, "")
    .replace(/^(?:是|为)\s*/u, "")
    .replace(/^(?:that\s+)?(?:I|user)\s+(?:like|prefer|love|dislike|hate)\s+/i, "")
    .trim();
  return stripValueDescriptor(clean);
}

function stripValueDescriptor(value: string): string {
  const clean = stripMemoryTrailingNoise(value);
  const numericWithDescriptor = clean.match(/^([+-]?\d+(?:[.,]\d+)?)(?:\s*(?:这个|这一个|那个)?(?:数字|数值|号码|number))$/iu);
  if (numericWithDescriptor?.[1]) {
    return numericWithDescriptor[1].trim();
  }
  const chineseDescriptor = clean.match(/^(.+?)(?:这个|这一个|那个)(?:数字|数值|号码)$/u);
  if (chineseDescriptor?.[1] && /[0-9０-９一二三四五六七八九十百千万零〇两]/u.test(chineseDescriptor[1])) {
    return chineseDescriptor[1].trim();
  }
  const englishDescriptor = clean.match(/^(.+?)\s+(?:this\s+|the\s+)?number$/iu);
  if (englishDescriptor?.[1] && /\d/.test(englishDescriptor[1])) {
    return englishDescriptor[1].trim();
  }
  return clean;
}

function isSemanticValue(value: string): boolean {
  return value.length > 0 && !(LOW_INFO_PATTERN.test(value) && value.length > 12) && !SENSITIVE_SECRET_PATTERN.test(value);
}

function dedupeAtoms(atoms: ExtractedMemoryAtom[]): ExtractedMemoryAtom[] {
  const seen = new Set<string>();
  const result: ExtractedMemoryAtom[] = [];
  for (const atom of atoms) {
    const key = `${atom.kind}:${atom.subject.canonicalKey}:${atom.predicate}:${atom.object?.canonicalKey ?? normalizeKey(atom.text)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(atom);
  }
  return result;
}

function normalizeMemoryExtractionText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function stripMemoryTrailingNoise(text: string): string {
  const clean = text.trim();
  const unwrapped = clean.replace(/^(["'\u2018\u2019\u201c\u201d「」『』]+)(.*?)(["'\u2018\u2019\u201c\u201d「」『』]+)$/u, "$2").trim();
  return unwrapped.replace(/[。！？?,，；;]+$/u, "").trim();
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}:._ -]+/gu, "")
    .slice(0, 180) || "unknown";
}

function trimToLength(text: string, maxLength: number): string {
  const clean = text.trim();
  return clean.length <= maxLength ? clean : `${clean.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
}

function stableExtractionId(prefix: string, seed: string): string {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
