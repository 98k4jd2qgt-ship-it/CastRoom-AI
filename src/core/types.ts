export type PetInputState = "hidden" | "focused" | "submitting" | "fading";

export type AppLanguage = "en" | "zh-CN" | "ja-JP" | "ko-KR" | "de-DE" | "ru-RU";

export type WindowResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

export type WindowFrameAction =
  | "minimize"
  | "maximize"
  | "close"
  | "startDrag"
  | `resize:${WindowResizeDirection}`;

export type PetWindowMode =
  | "pass_through"
  | "input"
  | "move"
  | "context_menu"
  | "hidden_for_fullscreen";

export type PetWindowInteractionState = PetWindowMode;

export type RoomRoleMemoryScope = `room:${string}:role:${string}`;
export type RoomPrivateMemoryScope = `room:${string}:private:${string}`;
export type RoomFactionMemoryScope = `room:${string}:faction:${string}`;
export type RoomObserverMemoryScope = `room:${string}:observer:${string}`;
export type RoomSystemMemoryScope = `room:${string}:system`;

export type MemoryScope =
  | "global"
  | `character:${string}`
  | RoomRoleMemoryScope
  | RoomPrivateMemoryScope
  | RoomFactionMemoryScope
  | RoomObserverMemoryScope
  | RoomSystemMemoryScope
  | `room:${string}`
  | `session:${string}`;

export interface MemoryRetentionPolicy {
  shortTermDays: 7;
  promotionMentionThreshold: 3;
  semanticDedupEnabled: true;
  requireUserConfirmation: true;
  autoWriteLongTermEnabled: true;
  sensitiveAutoPromoteEnabled: false;
}

export type MemorySensitivity = "normal" | "private" | "sensitive" | "forbidden";
export type MemoryAtomKind =
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
  | "conflict";
export type CompressedMemoryKind = MemoryAtomKind;
export type MemoryEntryStatus = "active" | "needs_review" | "disputed" | "superseded" | "archived";

export interface DesktopContextState {
  currentTime: string;
  timezone: string;
  focusedAppName: string;
  focusedWindowTitle: string;
  focusedProcessId: number | null;
  isFullscreenOrBorderless: boolean;
  foregroundAppAwarenessEnabled: boolean;
}

export type SupportedCharacterImageAssetFormat = "png" | "jpg" | "jpeg" | "gif";
export type SupportedCharacterTextAssetFormat = "txt" | "art" | "ansi";
export type SupportedCharacterAssetFormat = SupportedCharacterImageAssetFormat | SupportedCharacterTextAssetFormat;

export interface EmotionAssetCandidate {
  kind: "image" | "text";
  src?: string;
  text?: string;
  format: SupportedCharacterAssetFormat;
  animated: boolean;
}

export interface EmotionAsset {
  emotion: string;
  src?: string;
  text?: string;
  format: SupportedCharacterAssetFormat | "text";
  animated: boolean;
  fallbackLabel: string;
  candidates: EmotionAssetCandidate[];
}

export interface CharacterPackManifest {
  id: string;
  name: string;
  description?: string;
  language: string;
  defaultRender: "image" | "blocks" | "braille" | "ascii" | "mini";
  promptPath: string;
  promptText: string;
  voicePath: string;
  subtitlePath: string;
  memoryNamespace: `character:${string}`;
  supportedAssetFormats: SupportedCharacterAssetFormat[];
  emotions: Record<string, string>;
  voiceConfig?: CharacterPackVoiceConfig;
  encodingIssues?: TextEncodingIssue[];
}

export type DecodedTextEncoding = "utf-8" | "utf-8-repaired-latin1" | "utf-8-repaired-gbk" | "unknown";

export interface TextEncodingIssue {
  sourceLabel: string;
  detectedEncoding: DecodedTextEncoding;
  confidence: number;
  message: string;
}

export interface DecodedTextResult {
  rawSha256: string;
  detectedEncoding: DecodedTextEncoding;
  decodedText: string;
  confidence: number;
  warnings: TextEncodingIssue[];
}

export interface CharacterPackDecodedManifest extends CharacterPackManifest {
  encodingIssues: TextEncodingIssue[];
}

export interface CharacterPackVoiceConfig {
  preferredBackend?: VoiceBackend | "system_default";
  windowsVoice?: string;
  cloudVoice?: string;
  language?: string;
  subtitleLanguage?: string;
}

export interface CharacterPackSummary {
  id: string;
  name: string;
  status: "ready" | "warning" | "error";
  detail: string;
  supportedFormats: SupportedCharacterAssetFormat[];
  source?: "bundled" | "imported";
}

export interface ImportedCharacterAssetGroup {
  folder: string;
  candidates: EmotionAssetCandidate[];
}

export interface ImportedCharacterPack {
  manifest: CharacterPackManifest;
  summary: CharacterPackSummary;
  assets: ImportedCharacterAssetGroup[];
  warnings: string[];
  errors: string[];
}

export interface PackImportState {
  sourcePath: string;
  status: "idle" | "validating" | "ready" | "warning" | "error";
  message: string;
  importedPackId: string | null;
  warnings: string[];
  errors: string[];
  validationReport: PackValidationReport | null;
}

export type CharacterWorkshopMode = "list" | "create" | "edit";
export type CharacterWorkshopTab = "overview" | "persona" | "images" | "voice" | "export";
export type CharacterAssetSlot = "idle" | `emotion:${string}`;
export type CharacterWorkshopOperation = "create_new" | "edit_existing" | "copy_from_source";
export type CharacterAssetDraftAction = "keep" | "replace" | "remove";
export type CharacterWorkshopStatus = "idle" | "saving" | "deleting" | "error" | "ready";

export interface CharacterAssetDraftChange {
  slot: CharacterAssetSlot;
  action: CharacterAssetDraftAction;
  sourcePath: string;
  sourceDataUrl?: string;
  fileName?: string;
}

export interface EditableCharacterDraft {
  operation: CharacterWorkshopOperation;
  targetPackId: string | null;
  sourcePackId: string | null;
  source: CharacterPackSummary["source"] | "new";
  id: string;
  idEdited: boolean;
  name: string;
  description: string;
  language: string;
  promptText: string;
  voiceId: string;
  voiceHint: string;
  idleAssetPath: string;
  emotionAssetPaths: Record<string, string>;
  assetChanges: Record<string, CharacterAssetDraftChange>;
  deleteMemory: boolean;
  dirty: boolean;
}

export interface CharacterWorkshopState {
  mode: CharacterWorkshopMode;
  activeTab: CharacterWorkshopTab;
  editingPackId: string | null;
  draft: EditableCharacterDraft;
  status: CharacterWorkshopStatus;
  message: string;
  warnings: string[];
  errors: string[];
}

export type PackValidationSeverity = "error" | "warning" | "info";

export interface PackValidationIssue {
  severity: PackValidationSeverity;
  path: string;
  message: string;
}

export interface PackValidationAsset {
  folder: string;
  fileName: string;
  format: SupportedCharacterAssetFormat;
  animated: boolean;
  sizeBytes: number;
  warning?: string;
}

export interface PackValidationReport {
  sourcePath: string;
  manifestId: string | null;
  manifestName: string | null;
  checkedAt: string;
  status: "ready" | "warning" | "error";
  errors: string[];
  warnings: string[];
  issues: PackValidationIssue[];
  assets: PackValidationAsset[];
  preview: {
    idleCount: number;
    emotionFolders: string[];
    promptPath: string | null;
    voicePath: string | null;
    subtitlePath: string | null;
    memoryNamespace: string | null;
  };
}

export interface CharacterViewModel {
  id: string;
  name: string;
  mood: string;
  voice: string;
  language: string;
  render: CharacterPackManifest["defaultRender"];
  pack: string;
  promptText: string;
  art: string;
  imageSrc?: string;
  imageCandidates?: EmotionAssetCandidate[];
  imageAlt?: string;
  subtitle: string;
  subtitleSource?: string;
  isSpeaking: boolean;
  emotionAsset: EmotionAsset;
  memoryNamespace: `character:${string}`;
}

export interface ConsoleMessage {
  id: string;
  at: string;
  speaker: string;
  text: string;
  kind: "user" | "character" | "system";
  speakerType?: "user" | "role" | "room_system";
  speakerId?: string;
  target?: RoomMessageTarget;
  mentions?: RoomMention[];
  visibility?: RoomMessageVisibility;
  visibleTo?: RoomMentionTarget[];
  privateReason?: "ai_to_ai_mention" | "system_directed" | "faction_huddle" | "private_thread" | "director_channel";
  channelId?: RoomActiveChannelId;
  factionId?: string;
  directorMove?: RoomDirectorMove;
  knowledgeVisibility?: RoomKnowledgeVisibility;
  isStreaming?: boolean;
  scope?: MemoryScope;
  emotion?: string;
  attachments?: ChatImageAttachment[];
}

export interface PersistedChatImageAttachmentSummary {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  format: SupportedChatImageFormat;
  hasImage: true;
  caption?: string;
  uploadedAt?: string;
}

export interface CharacterChatHistoryFile {
  packId: string;
  schemaVersion: 1;
  directRoomId?: `dm:${string}`;
  messages: ConsoleMessage[];
  updatedAt: string;
  migratedFromGlobal?: boolean;
}

export type ConsoleView =
  | "chat"
  | "help"
  | "commands"
  | "config"
  | "setup"
  | "ai"
  | "voice"
  | "pack"
  | "prompts"
  | "room"
  | "memory"
  | "privacy"
  | "diagnostics"
  | "release";

export interface CommandDefinition {
  command: string;
  description: string;
  category: "help" | "ai" | "debug";
  view: ConsoleView;
}

export interface CommandSuggestion {
  command: string;
  description: string;
  category: CommandDefinition["category"];
}

export interface CommandResult {
  kind: "handled" | "suggestion" | "blocked" | "chat";
  message: string;
  view?: ConsoleView;
  command?: string;
}

export type ConfigSection = "ai" | "voice" | "privacy";

export interface ConfigState {
  activeSection: ConfigSection;
}

export interface ConsoleCommandRouter {
  route(input: string): CommandResult;
  suggestions(prefix: string): CommandSuggestion[];
  definitions(): CommandDefinition[];
}

export type SetupStep = "start" | "ai_service" | "character" | "voice" | "privacy" | "finish";

export interface SetupState {
  step: SetupStep;
  completed: boolean;
}

export type AiConnectionStatus = "not_configured" | "ready" | "testing" | "error";
export type AiRuntimeStatus = "idle" | "requesting" | "last_success" | "last_error";
export type AiAuthMode = "bearer" | "x_api_key" | "custom_header" | "none";
export type AiCompatibilityMode = "openai_chat_completions" | "openai_no_json_mode";
export type AiModelUse = "chat" | "vision" | "tts";
export type TtsVoiceSource = "manual" | "provider_list" | "character_pack" | "system_default";
export type LocalModelState =
  | "disabled"
  | "not_found"
  | "missing_runner"
  | "missing_model"
  | "verifying"
  | "stopped"
  | "starting_server"
  | "loading_model"
  | "ready"
  | "warming"
  | "running"
  | "busy"
  | "error";
export type LocalModelInstallState = "installed" | "missing" | "downloading" | "verifying" | "error";
export type ModelCapabilityStatus =
  | "ready"
  | "missing_key"
  | "url_unreachable"
  | "model_not_found"
  | "unsupported_response"
  | "error";

export interface LocalModelManifest {
  id: string;
  displayName: string;
  fileName: string;
  sha256: string;
  license: string;
  licensePath: string;
  sizeBytes: number;
  quantization: string;
  contextTokens: number;
  recommendedThreads: number;
  minMemoryMb: number;
}

export interface LocalModelRuntimeState {
  enabled: boolean;
  state: LocalModelState;
  selectedModelId: string | null;
  modelId: string | null;
  availableModels: LocalModelManifest[];
  installState: LocalModelInstallState;
  runnerVersion: string | null;
  runtimeMode?: "server" | "legacy_cli" | "missing" | null;
  serverPid?: number | null;
  serverPort?: number | null;
  serverHealth?: string | null;
  manifest: LocalModelManifest | null;
  lastError: string | null;
  lastVerifiedAt: string | null;
}

export interface LocalModelChatRequest {
  modelId?: string | null;
  systemPrompt: string;
  prompt: string;
  maxTokens: number;
  temperature: number;
  stop: string[];
  timeoutMs: number;
}

export interface LocalModelChatResult {
  text: string;
  tokens: number;
  elapsedMs: number;
  modelId: string;
  finishReason: "stop" | "length" | "error";
}

export interface AiModelEndpointConfig {
  apiUrl: string;
  secretRef: string;
  keyPreview: string;
  hasStoredSecret: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  status: AiConnectionStatus;
  runtimeStatus: AiRuntimeStatus;
  lastTestMessage: string;
  lastTestedAt: string | null;
  lastRuntimeMessage: string;
  lastRuntimeAt: string | null;
  availableModels: string[];
  capabilitySummary: string;
  lastErrorCode: AiProviderErrorCode | null;
}

export interface GenerationSettings {
  temperature: number;
  maxTokens: number;
}

export interface RoomGenerationProfile extends GenerationSettings {
  mode: "inherit_global" | "custom";
}

export interface RoleGenerationOverride extends GenerationSettings {
  enabled: boolean;
}

export interface TtsVoiceConfig {
  voiceId: string;
  language: string;
  source: TtsVoiceSource;
}

export interface TtsModelEndpointConfig extends AiModelEndpointConfig {
  voice: TtsVoiceConfig;
}

export interface ResolvedEndpointPaths {
  baseUrl: string;
  chatPath: string;
  modelsPath: string;
  embeddingsPath: string;
  ttsPath: string;
  sttPath: string;
}

export interface EndpointProbeResult {
  use: AiModelUse;
  status: ModelCapabilityStatus;
  message: string;
  resolved: ResolvedEndpointPaths;
  availableModels: string[];
  testedAt: string;
}

export interface AiServicePreset {
  id: string;
  name: string;
  tutorialUrl: string;
  baseUrl: string;
  recommendedChatModel: string;
  recommendedVisionModel: string;
  recommendedEmbeddingModel: string;
  recommendedTtsModel: string;
  recommendedSttModel: string;
  supportsVision: boolean;
  supportsStreaming: boolean;
  supportsEmbeddings: boolean;
  supportsTts: boolean;
  supportsStt: boolean;
  authMode: AiAuthMode;
  chatPath: string;
  modelsPath: string;
  embeddingsPath: string;
  ttsPath: string;
  sttPath: string;
  notes: string;
}

export interface AiServiceState {
  chat: AiModelEndpointConfig;
  vision: AiModelEndpointConfig;
  tts: TtsModelEndpointConfig;
  localChatModel: LocalModelRuntimeState;
  presetId: string;
  apiKeyPreview: string;
  baseUrl: string;
  chatModel: string;
  visionModel: string;
  embeddingModel: string;
  ttsModel: string;
  sttModel: string;
  visionEnabled: boolean;
  embeddingEnabled: boolean;
  cloudTtsEnabled: boolean;
  cloudSttEnabled: boolean;
  streamingEnabled: boolean;
  jsonModeEnabled: boolean;
  compatibilityMode: AiCompatibilityMode;
  authMode: AiAuthMode;
  customAuthHeader: string;
  organizationId: string;
  projectId: string;
  proxyUrl: string;
  chatPath: string;
  modelsPath: string;
  embeddingsPath: string;
  ttsPath: string;
  sttPath: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  advancedOpen: boolean;
  connectionStatus: AiConnectionStatus;
  lastTestMessage: string;
  lastTestedAt: string | null;
  availableModels: string[];
  capabilitySummary: string;
  lastErrorCode: AiProviderErrorCode | null;
}

export interface PrivacySettings {
  microphoneEnabled: boolean;
  foregroundAppAwarenessEnabled: boolean;
  memorySavingEnabled: boolean;
}

export type VoicePipelineStatus = "off" | "stub" | "ready" | "error";

export type VoiceBackend = "cloud_tts" | "windows_speech" | "piper_external";
export type SttBackend = "whisper_cpp";
export type VoiceModelState = "not_installed" | "downloading" | "ready" | "error";
export type VoicePermissionState = "off" | "requesting" | "granted" | "denied" | "error";

export interface VoiceModelDownloadState {
  modelId: "tiny" | "base";
  fileName: string;
  state: VoiceModelState;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  expectedSha256: string;
  localPath: string;
  lastError: string | null;
}

export interface TtsVoiceInfo {
  id: string;
  name: string;
  locale: string;
  backend: VoiceBackend;
}

export interface TtsRequest {
  text: string;
  language: string;
  preferredVoiceId?: string;
  backend?: VoiceBackend;
  allowCloud: boolean;
  roomMode: boolean;
}

export interface TtsResult {
  ok: boolean;
  backend: VoiceBackend;
  voiceId: string | null;
  message: string;
  audioPath?: string;
}

export interface SttRequest {
  audioPath: string;
  language?: string;
  backend: SttBackend;
}

export interface SttResult {
  ok: boolean;
  text: string;
  backend: SttBackend;
  modelId: "tiny" | "base";
  message: string;
}

export interface VoicePipelineState {
  sttStatus: VoicePipelineStatus;
  ttsStatus: VoicePipelineStatus;
  sttBackend: SttBackend;
  preferredTtsBackend: VoiceBackend;
  activeTtsBackend: VoiceBackend;
  permissionState: VoicePermissionState;
  model: VoiceModelDownloadState;
  availableVoices: TtsVoiceInfo[];
  selectedVoiceId: string | null;
  microphoneMode: "off" | "push_to_talk" | "vad";
  ttsEnabled: boolean;
  ttsLanguage: string;
  subtitleLanguage: string;
  echoCancellationEnabled: boolean;
  roomTtsPolicy: "disabled";
  lastMessage: string;
  lastTranscription: string;
  lastSynthesisMessage: string;
}

export type RoomApiMode = "demo" | "inherit_global" | "custom_room";
export type RoomDirectorApiMode = "demo" | "use_room" | "inherit_global" | "custom_director";
export type RoleApiMode = "use_room" | "model_override" | "own_profile";
export type RoomApiStatus = "demo" | "ready" | "missing_key" | "model_unsupported" | "error";

export interface RoomApiProfile {
  mode: RoomApiMode;
  generationMode: RoomGenerationProfile["mode"];
  providerId: string;
  secretRef: string | null;
  keyPreview: string;
  baseUrl: string;
  chatModel: string;
  visionModel: string;
  temperature: number;
  maxTokens: number;
  advancedOpen: boolean;
  status: RoomApiStatus;
  lastTestMessage: string;
  testedAt: string | null;
}

export interface RoomDirectorApiProfile extends Omit<RoomApiProfile, "mode"> {
  mode: RoomDirectorApiMode;
  generationOverrideEnabled: boolean;
}

export interface RoleApiProfile {
  mode: RoleApiMode;
  generationOverrideEnabled: boolean;
  providerId: string;
  secretRef: string | null;
  keyPreview: string;
  baseUrl: string;
  chatModel: string;
  visionModel: string;
  temperature: number;
  maxTokens: number;
  status: RoomApiStatus;
}

export interface ResolvedRoomRoleApiProfile {
  roleId: string;
  source: "demo" | "global" | "room" | "role_model_override" | "role_own_profile";
  providerId: string;
  secretRef: string | null;
  baseUrl: string;
  chatModel: string;
  visionModel: string;
  temperature: number;
  maxTokens: number;
  status: RoomApiStatus;
  live: boolean;
}

export type RoomRoleViewportState =
  | "idle"
  | "mentioned"
  | "listening"
  | "speaking"
  | "thinking"
  | "cooling_down"
  | "api_error"
  | "missing_asset";

export type RoomIdentityCardVisibility = "public" | "private";

export interface RoomIdentityCard {
  enabled: boolean;
  publicTitle: string;
  publicRole: string;
  publicGoal: string;
  publicNotes: string;
  secretIdentity: string;
  secretGoal: string;
  privateKnowledge: string;
  revealCondition: string;
  updatedAt: string;
}

export type RoomIdentityCardField = Exclude<keyof RoomIdentityCard, "enabled" | "updatedAt">;

export interface RoomRoleConfig {
  roleId: string;
  packId: string;
  displayName: string;
  factionId?: string;
  identityCard?: RoomIdentityCard;
  apiProfile: RoleApiProfile;
  memoryScope: RoomRoleMemoryScope;
  currentEmotion: string;
  viewportState: RoomRoleViewportState;
}

export interface RoomParticipant extends RoomRoleConfig {
  id: string;
  name: string;
  mood: string;
}

export interface RoomUserProfile {
  userId: "local-user";
  displayName: string;
  aliases: string[];
  factionId?: string;
}

export type RoomMentionTarget =
  | { type: "user"; userId: string }
  | { type: "role"; roleId: string }
  | { type: "room_director"; directorId: "room-director" };

export interface RoomMention {
  raw: string;
  target: RoomMentionTarget;
  displayName: string;
}

export type RoomMessageTarget = "all" | { targets: RoomMentionTarget[] };

export type RoomMessageVisibility = "public" | "private_ai" | "faction_huddle" | "private_thread" | "director_channel";

export type DirectorSourceVisibility =
  | "public"
  | "private_thread"
  | "private_ai"
  | "faction_huddle"
  | "director_channel"
  | "director_only";

export type DirectorScriptPublicSafety = "public_safe" | "private_blocked" | "developer_revealed";

export type DirectorScriptItemVisibility = "public" | "director_only" | "known_to_roles" | "faction";

export type RoomPrivateWhisperMode = "off" | "on";

export type RoomFactionHuddleMode = "off" | "on";

export type RoomChannelType = "public" | "faction" | "private" | "director";

export type RoomActiveChannelId = "public" | "direct" | "director" | `faction:${string}` | `private:${string}`;

export interface RoomChannel {
  id: RoomActiveChannelId;
  type: RoomChannelType;
  label: string;
  factionId?: string;
  threadId?: string;
  memberTargets?: RoomMentionTarget[];
  memberRoleIds: string[];
  unreadCount: number;
  private: boolean;
}

export interface RoomFaction {
  id: string;
  name: string;
  color: string;
  description?: string;
  publicGoal?: string;
  privateGoal?: string;
}

export type RoomPrivateThreadCreatedBy = "user" | "role" | "director" | "system";
export type RoomPrivateThreadStatus = "active" | "archived";

export interface RoomPrivateThread {
  id: string;
  roomId: string;
  title: string;
  memberIds: string[];
  memberTargets: RoomMentionTarget[];
  createdBy: RoomPrivateThreadCreatedBy;
  status: RoomPrivateThreadStatus;
  createdAt: string;
  updatedAt: string;
}

export type RoomPrivateChatRequestStatus = "pending" | "approved" | "rejected";

export interface RoomPrivateChatRequest {
  id: string;
  roomId: string;
  requesterRoleId?: string;
  targetRoleIds: string[];
  reason: string;
  status: RoomPrivateChatRequestStatus;
  createdAt: string;
  decidedAt?: string;
  decisionReason?: string;
  threadId?: string;
}

export type PrivateInfluenceEffect =
  | "no_public_effect"
  | "role_intent"
  | "director_cue"
  | "public_event"
  | "faction_strategy";

export interface PrivateInfluenceAssessment {
  threadId: string;
  effect: PrivateInfluenceEffect;
  publicSafeSummary?: string;
  targetRoleIds?: string[];
  statePatch?: DirectorStatePatch;
  memoryWrites?: {
    continuityWrites?: ContinuityWrite[];
    secretWrites?: RoomSecretEntry[];
  };
  reason: string;
  assessedAt?: string;
}

export interface RoomChannelReadMarker {
  lastReadMessageId?: string;
  lastReadAt?: string;
}

export type RoomChannelReadState = Partial<Record<RoomActiveChannelId, RoomChannelReadMarker>>;

export interface RoomFactionHuddleEntry {
  id: string;
  roleId: string;
  speaker: string;
  text: string;
  at: string;
  publicSafePoints?: string[];
  privateNotes?: string[];
}

export type FactionCollaborationInitiator = "director" | "role" | "user" | "system";

export interface FactionCollaborationOpportunity {
  factionId: string;
  initiator: FactionCollaborationInitiator;
  reason: string;
  urgency: number;
  privacyNeed: number;
  goal: string;
  suggestedRoleIds: string[];
  publicReturnPlan: string;
  cooldownKey: string;
}

export interface RoomFactionHuddleThread {
  id: string;
  roomId: string;
  factionId: string;
  factionName: string;
  memberRoleIds: string[];
  entries: RoomFactionHuddleEntry[];
  summary: string;
  objective?: string;
  plan?: string;
  risks?: string[];
  publicPoints?: string[];
  nextPublicSpeakerRoleId?: string;
  nextPublicAction?: string;
  publicReturnPlan?: string;
  opportunity?: FactionCollaborationOpportunity;
  createdAt: string;
}

export interface RoomUserFactionHuddleState {
  factionId: string;
  openedAt: string;
}

export interface RoomPrivateWhisperPolicy {
  maxConsecutivePrivateTurns: number;
  showHiddenHint: boolean;
  savePrivateToRoomMemory: boolean;
}

export interface RoomAddressing {
  target: RoomMessageTarget;
  mentions: RoomMention[];
  isBroadcast: boolean;
}

export type RoomSpeechDecision = "speak" | "listen" | "defer" | "ask_director" | "start_huddle";

export type RoomCollaborationMode = "free_talk" | "scene_play" | "debate" | "team_strategy" | "planning";

export type RoomCollaborationStage = "assess" | "huddle" | "assign" | "act" | "review";

export type RoomCollaborationTaskStatus = "pending" | "active" | "done" | "blocked";

export type RoomCollaborationTaskVisibility = "public" | "faction" | "private";

export interface RoomCollaborationTask {
  id: string;
  roleId: string;
  factionId?: string;
  title: string;
  detail: string;
  status: RoomCollaborationTaskStatus;
  targetChannelId: RoomActiveChannelId;
  dependsOnTaskIds: string[];
  visibility: RoomCollaborationTaskVisibility;
  source: "director" | "faction_huddle" | "scheduler";
  updatedAt: string;
}

export interface FactionStrategyState {
  factionId: string;
  objective: string;
  approach: string;
  risks: string[];
  publicPoints: string[];
  nextPublicAction: string;
  publicReturnPlan?: string;
  privateBoundary?: string;
  nextSpeakerRoleId?: string;
  updatedAt: string;
  sourceThreadId?: string;
}

export interface RoomCollaborationPlan {
  id: string;
  objective: string;
  stage: RoomCollaborationStage;
  participantRoleIds: string[];
  tasks: RoomCollaborationTask[];
  factionStrategies: FactionStrategyState[];
  nextPublicAction: string;
  lastOutcome: string;
  updatedAt: string;
}

export type RoomFloorOwner =
  | { type: "none" }
  | { type: "user"; userId: string }
  | { type: "role"; roleId: string }
  | { type: "director"; directorId: "room-director" }
  | { type: "channel"; channelId: RoomActiveChannelId };

export type RoomTurnPhase = "observe" | "intent" | "select" | "draft" | "validate" | "commit" | "wait";

export type RoomTurnDecision = RoomSpeechDecision | "wait_user";

export type RoomPlannerMode = "rule" | "cloud";

export type RoomFlowMode = "player_reactive" | "auto_simulation";

export type RoomFreedomLevel = "strict" | "balanced" | "loose" | "developer";

export type RoomFrameIntentKind =
  | "in_character"
  | "out_of_character_request"
  | "director_request"
  | "action_attempt"
  | "world_edit_claim"
  | "mode_shift"
  | "meta_control"
  | "collaboration_request"
  | "evaluation_request"
  | "scheduling_request"
  | "memory_request"
  | "plot_direction";

export type RoomFrameUserRole = "player" | "host_request" | "developer" | "control";

export type RoomFrameAbsorption =
  | "normal_reply"
  | "direct_apply"
  | "plot_transition"
  | "wait_for_choice"
  | "private_directive"
  | "blocked";

export type RoomFrameRequestedMode = "casual" | "story" | "mystery" | "debate" | "study" | "planning" | "team_channel";

export type IntentTimeBinding = "immediate" | "deferred" | "conditional" | "background_rule";

export type RoomFrameAmbiguity = "low" | "medium" | "high";

export type DeferredRequirementKind =
  | "final_verdict"
  | "round_summary"
  | "public_response"
  | "plot_payoff"
  | "study_check"
  | "planning_next_step";

export interface FrameIntentCandidate {
  kind: RoomFrameIntentKind;
  score: number;
  timeBinding: IntentTimeBinding;
  reason: string;
  requestedMode?: RoomFrameRequestedMode;
}

export interface DeferredRequirement {
  kind: DeferredRequirementKind;
  summary: string;
  trigger: string;
  sourceText: string;
}

export interface RejectedIntentSignal {
  kind: RoomFrameIntentKind;
  reason: string;
}

export interface RoomFrameIntent {
  kind: RoomFrameIntentKind;
  userRole: RoomFrameUserRole;
  absorption: RoomFrameAbsorption;
  summary: string;
  authority: RoomFreedomLevel;
  requestedMode?: RoomFrameRequestedMode;
  primary?: FrameIntentCandidate;
  secondary?: FrameIntentCandidate[];
  deferredRequirements?: DeferredRequirement[];
  rejected?: RejectedIntentSignal[];
  ambiguity?: RoomFrameAmbiguity;
  sourceText?: string;
  createdAt: string;
}

export interface RoomFrameInterpretation extends RoomFrameIntent {
  primary: FrameIntentCandidate;
  secondary: FrameIntentCandidate[];
  deferredRequirements: DeferredRequirement[];
  rejected: RejectedIntentSignal[];
  ambiguity: RoomFrameAmbiguity;
}

export type IntentCandidate = FrameIntentCandidate;
export type InputInterpretation = RoomFrameInterpretation;
export type AbsorptionPlan = RoomFrameAbsorption;

export interface ChatActionPlan {
  interpretation: InputInterpretation;
  shouldReply: boolean;
  shouldWriteMemory: boolean;
  memoryWrites?: unknown[];
}

export interface RoomActionPlan {
  interpretation: InputInterpretation;
  publicText?: string;
  privateDirectives: RoomDirectorPrivateDirective[];
  statePatch?: DirectorStatePatch;
  deferredRequirements: DeferredRequirement[];
  waitForUser?: boolean;
}

export interface DirectorActionPlan {
  interpretation: InputInterpretation;
  publicText?: string;
  publicTextReason: RoomDirectorPublicTextReason;
  privateDirectives: RoomDirectorPrivateDirective[];
  statePatch: DirectorStatePatch;
  deferredRequirements: DeferredRequirement[];
  memoryWrites?: DirectorStructuredOutcome["memoryWrites"];
  waitForUser?: boolean;
}

export interface MemoryWritePlan {
  interpretation: InputInterpretation;
  shouldWrite: boolean;
  scope: string;
  authority: "user" | "developer" | "director" | "character" | "system" | "imported";
  confidence: number;
  visibility: string;
  reason: string;
}

export interface RoomFrameState {
  lastIntent: RoomFrameIntent | null;
  recentChange: string;
  updatedAt: string | null;
}

export interface RoomFramePatch {
  intent?: RoomFrameIntent | null;
  recentChange?: string;
}

export type SimulationObjective =
  | "casual"
  | "scene_play"
  | "mystery"
  | "debate"
  | "planning"
  | "team_channel";

export type SimulationStyle = "story" | "match" | "planning" | "casual";

export type PlayerInterventionMode = "watch" | "pause_on_choice" | "manual";

export type RoomSimulationPhase = "setup" | "build" | "conflict" | "payoff" | "cooldown";

export type RoomUncertaintyProfile = "stable" | "balanced" | "volatile" | "mystery";

export type SimulationBeatType =
  | "role_speak"
  | "role_action"
  | "role_action_attempt"
  | "role_challenge_claim"
  | "role_reveal_known_fact"
  | "role_hide_or_mislead"
  | "director_judge"
  | "director_cue"
  | "director_twist"
  | "team_channel"
  | "score_update"
  | "scene_shift"
  | "cooldown";

export type RoomFactStatus =
  | "asserted"
  | "established"
  | "disputed"
  | "rejected"
  | "hidden"
  | "superseded";

export type RoomInputIntent =
  | "single_reply"
  | "group_opinion"
  | "direct_mention"
  | "director_request"
  | "debate_round"
  | "team_strategy"
  | "auto_simulation";

export type RoomPlanIntent = RoomInputIntent;

export type RoomSchedulerPhase = RoomTurnPhase;

export type RoomDiscussionStatus = "running" | "completed" | "paused" | "blocked";

export interface RoomPlannedTurn {
  id: string;
  speakerType: "role" | "director";
  speakerId: string;
  target: RoomMessageTarget;
  goal: string;
  maxWords: number;
  source: RoomPlannerMode;
  beatType?: SimulationBeatType;
  expectedStateChange?: string;
  visibleToUser?: boolean;
  stopAfterBeat?: boolean;
}

export interface SimulationBeatPlan {
  beatId: string;
  type: SimulationBeatType;
  channelId: RoomActiveChannelId;
  speakerId?: string;
  target?: RoomMessageTarget;
  goal: string;
  expectedStateChange: string;
  visibleToUser: boolean;
  maxWords: number;
  stopAfterBeat: boolean;
  scoring?: {
    novelty: number;
    risk: number;
    continuityCost: number;
    visibilityRisk: number;
    tensionDelta: number;
    weight: number;
    reason: string;
  };
}

export interface RoomDiscussionPlan {
  id: string;
  plannerMode: RoomPlannerMode;
  intent: RoomInputIntent;
  triggerMessageId: string | null;
  turns: RoomPlannedTurn[];
  activeTurnIndex: number;
  maxTurns: number;
  completedTurns: number;
  stopAfterTurns: boolean;
  needsDirector: boolean;
  status: RoomDiscussionStatus;
  createdAt: string;
  updatedAt: string;
  lastStopReason: RoomTerminationReason | null;
}

export interface RoomPlannerResult {
  mode: RoomPlannerMode;
  intent: RoomInputIntent;
  plan: RoomDiscussionPlan | null;
  fallbackReason?: string;
}

export type RoomPlan = RoomDiscussionPlan;

export type RoomTerminationReason =
  | "repeated"
  | "question_loop"
  | "waiting_user"
  | "director_choice"
  | "no_candidate"
  | "model_unavailable"
  | "private_leak_blocked"
  | "no_change"
  | "budget_limit";

export type RoomStopReason = RoomTerminationReason;

export interface RoomSimulationFocus {
  objective: SimulationObjective;
  speakerId: string | null;
  target: RoomMessageTarget;
  goal: string;
}

export interface RoomSpeechIntent {
  roleId: string;
  decision: RoomSpeechDecision;
  target: RoomMessageTarget;
  delayMs: number;
  priority: number;
  reason: string;
  emotionHint: string;
  maxLength: number;
}

export type RoomObservationTag =
  | "argument"
  | "stance"
  | "open_question"
  | "contradiction"
  | "clue"
  | "relationship"
  | "intent"
  | "scene_fact";

export type RoomObservationVisibility = "public" | "private_participant";

export interface RoomObservationEntry {
  id: string;
  scope: RoomObserverMemoryScope;
  roomScope: `room:${string}`;
  roleId: string;
  speaker: string;
  speakerId?: string;
  speakerType?: ConsoleMessage["speakerType"];
  target?: RoomMessageTarget;
  text: string;
  observedAt: string;
  importance: number;
  strategyTags: RoomObservationTag[];
  visibility: RoomObservationVisibility;
  sourceMessageId?: string;
}

export type RoomPromptProfileId = "casual-chat" | "study" | "debate" | "story" | "mystery" | "planning";

export interface RoomPromptProfile {
  id: RoomPromptProfileId;
  name: string;
  summary: string;
  schedulerStyle: string;
  rules: string[];
  systemPrompt: string;
}

export type RoomAutoSpeechStatus = "paused" | "running" | "cooling_down" | "waiting_user" | "blocked";

export type RoomScheduleReason =
  | "user_reply"
  | "user_follow_up"
  | "idle_auto"
  | "manual_pause"
  | "cooldown"
  | "waiting_user"
  | "director_followup"
  | "burst_limit"
  | "room_closed"
  | "not_enough_roles"
  | "question_loop"
  | "no_candidate"
  | "casual_topic_shift"
  | "repetition_guard"
  | "api_unavailable";

export type RoomAdvancePolicy = "wait_for_instruction" | "fill_gap" | "continuous";

export type RoomSpeakerPolicy = "balanced" | "round_robin" | "spotlight" | "freeform";

export type RoomContextBudget = "compact" | "balanced" | "full";

export type RoomAutoPacePreset = "fast" | "natural" | "slow" | "custom";

export interface RoomAutoPaceSettings {
  preset: RoomAutoPacePreset;
  minDelayMs: number;
  maxDelayMs: number;
  idleFillDelayMs: number;
  randomize: boolean;
}

export interface RoomSpeakerPolicySettings {
  mode: RoomSpeakerPolicy;
  maxConsecutivePairTurns: number;
  lurkerBoostAfterTurns: number;
  recentSpeakerPenalty: boolean;
}

export type RoomBlockingNeed =
  | "none"
  | "soft_user_preference"
  | "missing_context"
  | "user_answer_expected"
  | "explicit_user_choice"
  | "irreversible_decision"
  | "privacy_or_safety"
  | "provider_failure";

export interface ContinuationAssessment {
  blockingNeed: RoomBlockingNeed;
  canContinueWithoutUser: boolean;
  defaultAssumption?: string;
  safeNextMove?: "role_turn" | "director_cue" | "recap" | "faction_huddle" | "pause";
  waitReason?: string;
}

export type RoomAdvanceDecisionAction = "continue" | "fill_gap" | "pause";

export interface RoomAdvanceDecision {
  policy: RoomAdvancePolicy;
  action: RoomAdvanceDecisionAction;
  blockingNeed: RoomBlockingNeed;
  canContinueWithoutUser: boolean;
  reason: string;
  defaultAssumption?: string;
  safeNextMove?: ContinuationAssessment["safeNextMove"];
  waitReason?: string;
}

export type RoomEngagementDecisionKind = "required" | "optional" | "silent_allowed" | "blocked";

export interface RoomEngagementDecision {
  kind: RoomEngagementDecisionKind;
  reason: string;
  requiresVisibleOutcome: boolean;
  explicitMention: boolean;
  explicitTask: boolean;
  createdAt: number;
}

export type RoomShouldSpeakAction = "speak_public" | "private_directive" | "update_state_only" | "wait" | "no_action";

export interface RoomShouldSpeakDecision {
  action: RoomShouldSpeakAction;
  reason: string;
  promptConstrained: boolean;
  requiresVisibleOutcome: boolean;
}

export interface RoomInputProcessedRecord {
  id: string;
  createdAt: number;
  inputPreview: string;
  engagement: RoomEngagementDecisionKind;
  shouldSpeak: RoomShouldSpeakAction;
  reason: string;
}

export interface RoomResponseObligation {
  id: string;
  source: "user";
  createdAt: number;
  inputPreview: string;
  reason: "user_message";
}

export interface RoomFallbackAction {
  action: "pending_followup" | "director_handoff" | "pause";
  reason: string;
  targetRoleId?: string;
  summary?: string;
}

export interface RoomAutoSpeechPolicy {
  maxUserTriggeredFollowUps: number;
  maxIdleBurstTurns: number;
  cooldownTurns: number;
  speedDelaysMs: Record<"slow" | "normal" | "fast", number>;
}

export interface RoomAutoSpeechState {
  status: RoomAutoSpeechStatus;
  consecutiveAutoTurns: number;
  userTriggeredFollowUps: number;
  lastTurnAt: number | null;
  nextTurnAt: number | null;
  lastReason: RoomScheduleReason | null;
  pendingFollowup?: RoomPendingFollowup | null;
}

export type RoomPendingFollowupSource = "director" | "role" | "huddle" | "system";
export type RoomPendingFollowupMode = "one_shot" | "continuous" | "wait_user";
export type RoomPendingFollowupMove =
  | "role_turn"
  | "director_public"
  | "faction_huddle"
  | "judge"
  | "recap"
  | "choice"
  | "pause"
  | "close";

export interface RoomPendingFollowup {
  id: string;
  source: RoomPendingFollowupSource;
  mode: RoomPendingFollowupMode;
  nextMove: RoomPendingFollowupMove;
  targetRoleId?: string;
  privateDirective?: RoomDirectorPrivateDirective;
  reason: RoomScheduleReason | string;
  createdAt: number;
  expiresAt: number;
  runCount: number;
  maxRuns: number;
  summary?: string;
}

export interface RoomScheduleResult {
  type: "turn" | "stop" | "huddle";
  reason: RoomScheduleReason;
  status: RoomAutoSpeechStatus;
  nextTurnAt: number | null;
  consecutiveAutoTurns: number;
  userTriggeredFollowUps: number;
  participant?: RoomParticipant;
  message?: ConsoleMessage;
  emotion?: string;
  intent?: string;
  target?: RoomMessageTarget;
  speechIntent?: RoomSpeechIntent;
  observerRoleIds?: string[];
  factionHuddle?: RoomFactionHuddleThread;
  plannedTurn?: RoomPlannedTurn;
  simulationBeat?: SimulationBeatPlan;
  discussionPlan?: RoomDiscussionPlan;
  plannerResult?: RoomPlannerResult;
  privateDirective?: RoomDirectorPrivateDirective;
  collaborationPlan?: RoomCollaborationPlan;
  collaborationTask?: RoomCollaborationTask;
  factionStrategy?: FactionStrategyState;
  continuationAssessment?: ContinuationAssessment;
  advanceDecision?: RoomAdvanceDecision;
  engagementDecision?: RoomEngagementDecision;
  shouldSpeakDecision?: RoomShouldSpeakDecision;
  inputProcessedRecord?: RoomInputProcessedRecord;
  responseObligation?: RoomResponseObligation;
  pendingFollowup?: RoomPendingFollowup | null;
  noResponseReason?: string;
  fallbackAction?: RoomFallbackAction;
}

export interface RoomSimulationState {
  enabled: boolean;
  style: SimulationStyle;
  playerIntervention: PlayerInterventionMode;
  uncertaintyProfile: RoomUncertaintyProfile;
  phase: RoomSimulationPhase;
  beatIndex: number;
  currentFocus: string;
  tension: number;
  noveltyScore: number;
  lastBeatType?: SimulationBeatType;
  lastSpeakerIds: string[];
  openHooks: string[];
  nextPressure?: string;
  lastRuling?: string;
  stopReason?: RoomStopReason;
  directorMemorySource?: "graph" | "graph+fallback" | "fallback";
  directorMemoryLoadedClaims?: number;
  directorMemoryHiddenClaims?: number;
  directorMemoryDisputedClaims?: number;
  situationAssessment?: SituationAssessmentSummary;
}

export type PlotBeat =
  | "setup"
  | "cue"
  | "pressure"
  | "twist"
  | "choice"
  | "consequence"
  | "payoff"
  | "cooldown";

export type PlotHookVisibility = "public" | "hidden";

export type PlotHookStatus = "open" | "triggered" | "resolved";

export interface PlotHook {
  id: string;
  text: string;
  visibility: PlotHookVisibility;
  status: PlotHookStatus;
  knownToRoleIds: string[];
  createdAt: string;
  updatedAt?: string;
  source: "director" | "room" | "system";
}

export interface PlotArcState {
  theme: string;
  phase: PlotBeat;
  publicGoal: string;
  currentPressure: string;
  hooks: PlotHook[];
  unresolved: string[];
  nextBeat: string;
  updatedAt: string;
}

export interface PlotPatch {
  theme?: string;
  phase?: PlotBeat;
  publicGoal?: string;
  currentPressure?: string;
  addHooks?: Array<Partial<Pick<PlotHook, "id" | "createdAt" | "updatedAt" | "source" | "knownToRoleIds">> & Pick<PlotHook, "text"> & {
    visibility?: PlotHookVisibility;
    status?: PlotHookStatus;
  }>;
  triggerHookIds?: string[];
  resolveHookIds?: string[];
  addUnresolved?: string[];
  resolveUnresolved?: string[];
  nextBeat?: string;
}

export interface ScoreEntry {
  id: string;
  label: string;
  score: number;
}

export interface RoomDebateVerdictScore {
  factionId: string;
  label: string;
  qualityScore: number;
  delta: number;
}

export interface RoomDebateVerdict {
  id: string;
  scope: "round" | "final";
  round: number;
  winnerFactionId?: string;
  winnerLabel: string;
  summary: string;
  criteriaNotes: string[];
  scores: RoomDebateVerdictScore[];
  decidedAt: string;
  source: "director";
}

export type RoomDebateSpeakerPosition =
  | "first_speaker"
  | "second_speaker"
  | "third_speaker"
  | "free_speaker"
  | "alternate";

export type RoomDebateSpeakerPositionSetting = "auto" | RoomDebateSpeakerPosition;

export type RoomDebateSpeakerAssignmentSource = "auto" | "manual" | "director";

export interface RoomDebateSpeakerAssignment {
  roleId: string;
  factionId: string;
  position: RoomDebateSpeakerPosition;
  label: string;
  source: RoomDebateSpeakerAssignmentSource;
  locked: boolean;
  updatedAt?: string;
}

export type RoomDebateFlowStepType =
  | "director_opening"
  | "role_speech"
  | "cross_examination"
  | "free_debate"
  | "director_summary"
  | "director_verdict";

export interface RoomDebateFlowStep {
  id: string;
  type: RoomDebateFlowStepType;
  sideId?: string;
  position?: RoomDebateSpeakerPosition;
  roleId?: string;
  publicLabel: string;
  task: string;
  maxWords?: number;
  requiresDirector?: boolean;
}

export interface RoomDebateFlow {
  format: "standard_cn" | "custom";
  language: "zh-CN" | "en";
  motion: string;
  steps: RoomDebateFlowStep[];
  currentStepIndex: number;
  completedStepIds: string[];
  sourceText?: string;
  updatedAt?: string;
}

export type RoomDebateLifecyclePhase =
  | "setup_pending"
  | "round_active"
  | "verdict_due"
  | "verdict_recorded"
  | "cooldown";

export interface RoomMatchState {
  round: number;
  currentSide?: string;
  motion?: string;
  speakerAssignments: RoomDebateSpeakerAssignment[];
  nextSpeakerRoleId?: string;
  nextPosition?: RoomDebateSpeakerPosition;
  debatePhase?: RoomDebateLifecyclePhase;
  spokenRoleIdsByRound?: Record<string, string[]>;
  skippedRoleIdsByRound?: Record<string, string[]>;
  deferredRequirements?: DeferredRequirement[];
  debateFlow?: RoomDebateFlow;
  scoreboard: ScoreEntry[];
  winCondition: string;
  judgeNotes: string[];
  lastVerdict?: RoomDebateVerdict;
}

export type RoomDirectorMove = "cue" | "twist" | "choice" | "judge" | "recap" | "whisper" | "pause";

export type RoomKnowledgeVisibility = "public" | "known_to_user" | "known_to_roles" | "hidden_from_user";

export type RoomDirectorProfileId =
  | "host"
  | "story-director"
  | "mystery-director"
  | "study-moderator"
  | "debate-referee"
  | "planning-facilitator";

export type RoomRecipeId = "casual" | "story" | "mystery" | "study" | "debate" | "planning";

export interface RoomDirectorProfile {
  id: RoomDirectorProfileId;
  name: string;
  summary: string;
  intervention: "low" | "medium";
  preferredMoves: RoomDirectorMove[];
}

export interface RoomRecipe {
  id: RoomRecipeId;
  name: string;
  summary: string;
  promptProfileId: RoomPromptProfileId;
  directorProfileId: RoomDirectorProfileId;
  privateWhispers: RoomPrivateWhisperMode;
  autoChat: boolean;
  memoryMode: "light" | "strong";
}

export interface RoomSceneBoard {
  title: string;
  currentScene: string;
  goal: string;
  mood: string;
  openClues: string[];
  unresolved: string[];
  updatedAt: string | null;
}

export type DirectorScriptItemStatus = "planned" | "active" | "revealed" | "changed" | "retired" | "contradicted";

export type DirectorScriptRevisionReason =
  | "player_choice"
  | "role_action"
  | "contradiction"
  | "pace"
  | "developer_edit"
  | "director_refinement";

export interface DirectorScriptItem {
  id: string;
  text: string;
  status: DirectorScriptItemStatus;
  visibility: DirectorScriptItemVisibility;
  sourceVisibility?: DirectorSourceVisibility;
  sourceMessageIds?: string[];
  publicSafety?: DirectorScriptPublicSafety;
  createdBy: "director" | "developer";
  updatedAt: string;
}

export interface DirectorScriptRevision {
  id: string;
  reason: DirectorScriptRevisionReason;
  summary: string;
  before?: string;
  after?: string;
  createdBy: "director" | "developer";
  createdAt: string;
}

export interface DirectorScriptBoard {
  premise?: string;
  currentPhase?: string;
  hiddenFacts: DirectorScriptItem[];
  openThreads: DirectorScriptItem[];
  plannedBeats: DirectorScriptItem[];
  pressureSources: DirectorScriptItem[];
  environmentAnchors: DirectorScriptItem[];
  forbiddenReveals: DirectorScriptItem[];
  continuityNotes: DirectorScriptItem[];
  revisionLog: DirectorScriptRevision[];
}

export type DirectorScriptPatch = Partial<Omit<DirectorScriptBoard, "revisionLog">> & {
  revision?: DirectorScriptRevision;
  revisionLog?: DirectorScriptRevision[];
};

export interface DirectorScriptScope {
  roomId: string;
  mode: RoomRecipeId;
}

export interface ScopedDirectorScript {
  scope: DirectorScriptScope;
  plotDirection: PlotArcState;
  scriptBoard: DirectorScriptBoard;
  updatedAt: string;
}

export type RoomConstraintScope = "scene" | "role" | "user" | "item" | "knowledge" | "channel" | "director";
export type RoomConstraintStatus = "active" | "resolved" | "suspended" | "needs_review";
export type RoomActionCheckResult =
  | "allowed"
  | "blocked"
  | "needs_condition"
  | "needs_director_override"
  | "needs_player_choice";

export interface RoomConstraint {
  id: string;
  scope: RoomConstraintScope;
  label: string;
  detail: string;
  status: RoomConstraintStatus;
  visibility: RoomKnowledgeVisibility;
  relatedRoleIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomActionCheck {
  result: RoomActionCheckResult;
  reason: string;
  matchedConstraintIds: string[];
  suggestedDirectorMove?: RoomDirectorMove;
}

export type DirectorDraftCheck = RoomActionCheck;

export interface DirectorOverrideRequest {
  id: string;
  userId: string;
  text: string;
  requestedAt: string;
  action: "modify_scene" | "modify_condition" | "modify_knowledge" | "modify_item" | "other";
}

export interface DirectorOverrideLogEntry {
  id: string;
  requestId: string;
  userId: string;
  text: string;
  appliedAt: string;
  changedConstraintIds: string[];
  summary: string;
}

export interface RoomContinuityEntry {
  id: string;
  label: string;
  detail: string;
  visibility: RoomKnowledgeVisibility;
  ownerRoleIds: string[];
  status: "active" | "resolved" | "conflict" | "needs_review";
  sourceMessageId?: string;
  updatedAt: string;
}

export interface RoomContinuityLedger {
  entries: RoomContinuityEntry[];
}

export type JudgementOutcome = "success" | "partial_success" | "fail" | "blocked" | "needs_player_choice";

export type JudgementDifficulty = "easy" | "normal" | "hard" | "blocked";

export interface JudgementCheck {
  actor: string;
  action: string;
  intent: string;
  knownFacts: string[];
  difficulty: JudgementDifficulty;
  evidence: string[];
  outcome: JudgementOutcome;
  consequence: string;
}

export interface SceneDelta {
  currentScene?: string;
  goal?: string;
  mood?: string;
  addClues?: string[];
  resolveClues?: string[];
  addUnresolved?: string[];
  resolveUnresolved?: string[];
}

export interface ContinuityWrite {
  label: string;
  detail: string;
  visibility: RoomKnowledgeVisibility;
  ownerRoleIds: string[];
  status: RoomContinuityEntry["status"];
}

export interface DirectorPromptProfile {
  profileId: RoomDirectorProfileId;
  systemPrompt: string;
  decisionRules: string[];
}

export type RoomDirectorPublicTextReason =
  | "setup"
  | "narration"
  | "round_transition"
  | "ruling"
  | "recap"
  | "choice"
  | "none";

export type RoomDirectorPrivateDirectiveReason =
  | "debate_turn"
  | "mode_turn"
  | "round_transition"
  | "role_action"
  | "follow_up";

export interface RoomDirectorPrivateDirective {
  roleId: string;
  task: string;
  target?: RoomMessageTarget;
  maxLength?: number;
  reason: RoomDirectorPrivateDirectiveReason;
  sourceMove?: RoomDirectorMove;
  visibleToRoleIds: string[];
  createdAt?: string;
}

export interface DirectorTurnPlan {
  move: RoomDirectorMove;
  publicText: string;
  publicTextReason?: RoomDirectorPublicTextReason;
  privateDirectives?: RoomDirectorPrivateDirective[];
  nextSpeakerRoleId: string | null;
  sceneDelta: SceneDelta;
  continuityWrites: ContinuityWrite[];
  secretWrites: RoomSecretEntry[];
  knowledgeVisibility: RoomKnowledgeVisibility;
  waitForUser: boolean;
  judgement?: JudgementCheck;
  structuredOutcome?: DirectorStructuredOutcome;
}

export type SituationAssessmentMode =
  | "casual"
  | "story"
  | "mystery"
  | "debate"
  | "study"
  | "planning"
  | "team_channel";

export type SituationMaterialSufficiency = "none" | "low" | "enough" | "strong";

export type SituationConflictLevel = "none" | "minor" | "active" | "critical";

export type SituationRiskLevel = "low" | "medium" | "high";

export type SituationNextMove = "continue" | "judge" | "cue" | "twist" | "choice" | "recap" | "pause" | "close";

export interface SituationAssessment {
  mode: SituationAssessmentMode;
  phase: string;
  pressure: number;
  materialSufficiency: SituationMaterialSufficiency;
  conflictLevel: SituationConflictLevel;
  continuityRisk: SituationRiskLevel;
  visibilityRisk: SituationRiskLevel;
  nextMove: SituationNextMove;
  reason: string;
  blockers: string[];
  statePatch: DirectorStatePatch;
}

export type SituationAssessmentSummary = Omit<SituationAssessment, "statePatch">;

export interface DirectorStatePatch {
  matchPatch?: Partial<RoomMatchState>;
  simulationPatch?: Partial<RoomSimulationState>;
  sceneDelta?: SceneDelta;
  collaborationPatch?: RoomCollaborationPlan | null;
  inspectorPatch?: {
    currentFocus?: string;
    stopReason?: RoomStopReason;
    nextPressure?: string;
    lastTurnOutcome?: string | null;
    sourceVisibility?: DirectorSourceVisibility;
    publicSafe?: boolean;
    directorMemorySource?: "graph" | "graph+fallback" | "fallback";
    directorMemoryLoadedClaims?: number;
    directorMemoryHiddenClaims?: number;
    directorMemoryDisputedClaims?: number;
    situationAssessment?: SituationAssessmentSummary;
  };
}

export interface DirectorStructuredOutcome {
  publicText: string;
  publicTextReason: RoomDirectorPublicTextReason;
  privateDirectives: RoomDirectorPrivateDirective[];
  statePatch: DirectorStatePatch;
  plotPatch?: PlotPatch;
  framePatch?: RoomFramePatch;
  memoryWrites?: {
    continuityWrites?: ContinuityWrite[];
    secretWrites?: RoomSecretEntry[];
  };
}

export interface RoomSecretEntry {
  id: string;
  title: string;
  detail: string;
  knownToRoleIds: string[];
  revealedToUser: boolean;
  visibility: RoomKnowledgeVisibility;
  sourceMessageId?: string;
  createdAt: string;
}

export type DirectorMemoryCategory =
  | "scene"
  | "item"
  | "knowledge"
  | "secret"
  | "constraint"
  | "judgement"
  | "override";

export type DirectorMemoryEntryStatus = "active" | "resolved" | "disputed" | "archived";

export type DirectorMemorySourceType = "director_judge" | "director_override" | "director_move" | "system_event";

export interface DirectorMemoryEntry {
  id: string;
  roomId: string;
  category: DirectorMemoryCategory;
  key: string;
  text: string;
  status: DirectorMemoryEntryStatus;
  visibility: RoomKnowledgeVisibility;
  knownToRoleIds: string[];
  sourceMessageIds: string[];
  sourceType: DirectorMemorySourceType;
  confidence: number;
  firstSeenAt: string;
  lastUpdatedAt: string;
  version: number;
  previousEntryId?: string;
  conflictWithIds?: string[];
}

export interface RoomDirectorState {
  enabled: boolean;
  directorId: "room-director";
  displayName: string;
  aliases: string[];
  profileId: RoomDirectorProfileId;
  recipeId: RoomRecipeId;
  apiProfile: RoomDirectorApiProfile;
  memoryScope: RoomSystemMemoryScope;
  lastMove: RoomDirectorMove | null;
  lastSpokeAt: string | null;
  sceneBoard: RoomSceneBoard;
  scriptBoard: DirectorScriptBoard;
  constraints: RoomConstraint[];
  overrideLog: DirectorOverrideLogEntry[];
}

export type DirectorNarrationTrigger =
  | "scene_opening"
  | "scene_transition"
  | "environment_change"
  | "time_passage"
  | "action_consequence"
  | "atmosphere_shift"
  | "ambient_pressure"
  | "phase_summary";

export type DirectorRequiredIntervention =
  | "action_ruling"
  | "visibility_guard"
  | "stuck_recovery"
  | "memory_conflict"
  | "debate_ruling"
  | "study_judgement"
  | "planning_summary"
  | "script_revision";

export interface DirectorTickResult {
  publicNarration?: string | null;
  narrationTrigger?: DirectorNarrationTrigger | null;
  directorChannelNote?: string | null;
  privateDirectives?: RoomDirectorPrivateDirective[];
  inspectorPatch?: DirectorStatePatch["inspectorPatch"];
  sceneStatePatch?: Partial<RoomSimulationState>;
  memoryCandidates?: unknown[];
  scriptPatch?: DirectorScriptPatch | null;
  requiredIntervention?: DirectorRequiredIntervention | null;
  hardPause?: RoomStopReason | null;
}

export interface RoomDirectorScheduleResult {
  type: "turn" | "stop";
  move: RoomDirectorMove;
  reason: "mentioned" | "command" | "recipe" | "whisper_limit" | "disabled";
  plan?: DirectorTurnPlan;
  message?: ConsoleMessage;
  sceneBoard?: RoomSceneBoard;
  match?: Partial<RoomMatchState>;
  simulation?: Partial<RoomSimulationState>;
  collaborationPlan?: RoomCollaborationPlan | null;
  plot?: PlotArcState;
  frame?: RoomFrameState;
  inspectorPatch?: DirectorStatePatch["inspectorPatch"];
}

export type PromptScope = "room" | "director" | "character_pack" | "room_role";

export type RoomPromptArea = "room_rules" | "director_rules" | "role_overrides" | "advanced";

export type RoomContextPanelMode = "casual" | "story" | "mystery" | "debate" | "study" | "planning" | "team";

export interface RoomContextPanelItem {
  id?: string;
  label: string;
  value: string;
  tone?: "neutral" | "good" | "warning" | "danger";
}

export interface RoomContextPanelSection {
  id: string;
  title: string;
  items: RoomContextPanelItem[];
}

export interface RoomContextPanelViewModel {
  mode: RoomContextPanelMode;
  title: string;
  description: string;
  sections: RoomContextPanelSection[];
}

export interface PromptOverride {
  id: string;
  scope: PromptScope;
  targetId: string;
  title: string;
  text: string;
  activeText?: string;
  updatedAt: string;
  revision: number;
  appliedRevision?: number;
  enabled: boolean;
}

export type PromptPresetKind = "character_base" | "room_rules" | "director_rules" | "room_role_override";

export type PromptPresetSource = "user" | "imported" | "workshop" | "bundled";

export interface PromptPreset {
  id: string;
  kind: PromptPresetKind;
  title: string;
  description: string;
  language: "auto" | AppLanguage;
  supportedModes?: Array<RoomContextPanelMode | "any">;
  text: string;
  tags: string[];
  source: PromptPresetSource;
  sourceId?: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface PromptDraft {
  scope: PromptScope;
  targetId: string;
  text: string;
  dirty: boolean;
  sourceRevision: number;
}

export interface EffectivePrompt {
  scope: PromptScope;
  targetId: string;
  text: string;
  source: "default" | "override";
  revision: number;
}

export type PromptTemplateFieldKind = "text" | "textarea";

export interface PromptTemplateField {
  key: string;
  label: string;
  description: string;
  kind: PromptTemplateFieldKind;
  defaultValue: string;
}

export interface RoomModePromptTemplate {
  mode: RoomContextPanelMode;
  name: string;
  roomFields: PromptTemplateField[];
  directorFields: PromptTemplateField[];
  roleFields: PromptTemplateField[];
}

export interface RoomRulesFields {
  mode: RoomContextPanelMode;
  values: Record<string, string>;
}

export interface DirectorRulesFields {
  mode: RoomContextPanelMode;
  values: Record<string, string>;
}

export interface RoomRoleOverrideFields {
  mode: RoomContextPanelMode;
  values: Record<string, string>;
}

export type PromptAssemblyTarget = "room" | "director" | "role";

export interface PromptStateCapsule {
  title: string;
  lines: string[];
}

export interface PromptMemoryCapsule {
  title: string;
  lines: string[];
}

export interface PromptTaskCard {
  title: string;
  lines: string[];
}

export interface PromptGuardFeedback {
  title: string;
  lines: string[];
}

export interface PromptAssemblyContext {
  mode: RoomContextPanelMode;
  target: PromptAssemblyTarget;
  defaultTemplate: string;
  overrideText?: string;
  stateCapsule?: PromptStateCapsule;
  memoryCapsule?: PromptMemoryCapsule;
  taskCard?: PromptTaskCard;
  guardFeedback?: PromptGuardFeedback;
}

export interface CompiledPromptPreview {
  title: string;
  text: string;
  compactText: string;
}

export type PromptCenterMode = "rooms" | "characters";
export type PromptCenterPromptType = "room" | "director" | "roles" | "advanced";

export interface PromptCenterViewState {
  mode: PromptCenterMode;
  selectedRoomId: string;
  selectedType: PromptCenterPromptType;
  selectedPromptMode?: RoomContextPanelMode;
  selectedRoleId?: string;
  selectedPackId?: string;
  selectedPresetId?: string;
  roomSearchQuery?: string;
  characterSearchQuery?: string;
  previewOpen?: boolean;
}

export interface PromptCenterState {
  overrides: PromptOverride[];
  drafts: PromptDraft[];
  presets: PromptPreset[];
  view: PromptCenterViewState;
  activeEditorScope: PromptScope;
  activeEditorTargetId: string;
  revision: number;
  lastMessage: string;
  lastError: string | null;
}

export type RoomInspectorSection = "members" | "room_ai" | "director_ai" | "packs" | "rules";

export interface RoomState {
  id: string;
  title: string;
  isOpen: boolean;
  autoChat: boolean;
  flowMode: RoomFlowMode;
  freedomLevel: RoomFreedomLevel;
  simulationObjective: SimulationObjective;
  simulation: RoomSimulationState;
  plot: PlotArcState;
  directorScriptsByMode?: Partial<Record<RoomRecipeId, ScopedDirectorScript>>;
  frame: RoomFrameState;
  match: RoomMatchState;
  topic: string;
  speed: "slow" | "normal" | "fast";
  collaborationMode: RoomCollaborationMode;
  floorOwner: RoomFloorOwner;
  turnPhase: RoomTurnPhase;
  lastTerminationReason: RoomTerminationReason | null;
  activeDiscussionPlan: RoomDiscussionPlan | null;
  collaborationPlan: RoomCollaborationPlan | null;
  apiProfile: RoomApiProfile;
  expandedApiRoleId: string | null;
  expandedIdentityCardRoleId: string | null;
  expandedInspectorSection: RoomInspectorSection | null;
  promptProfileId: RoomPromptProfileId;
  autoSpeechPolicy: RoomAutoSpeechPolicy;
  autoSpeechState: RoomAutoSpeechState;
  advancePolicy?: RoomAdvancePolicy;
  contextBudget?: RoomContextBudget;
  autoPace?: RoomAutoPaceSettings;
  speakerPolicy?: RoomSpeakerPolicySettings;
  lastContinuationAssessment?: ContinuationAssessment | null;
  lastAdvanceDecision?: RoomAdvanceDecision | null;
  lastEngagementDecision?: RoomEngagementDecision | null;
  lastShouldSpeakDecision?: RoomShouldSpeakDecision | null;
  lastInputProcessed?: RoomInputProcessedRecord | null;
  lastResponseObligation?: RoomResponseObligation | null;
  lastNoResponseReason?: string | null;
  lastFallbackAction?: RoomFallbackAction | null;
  silentAutoTurnCount?: number;
  privateWhispers: RoomPrivateWhisperMode;
  privateWhisperPolicy: RoomPrivateWhisperPolicy;
  hiddenWhisperCount: number;
  factionHuddles: RoomFactionHuddleMode;
  factions: RoomFaction[];
  activeChannelId: RoomActiveChannelId;
  channelReadState?: RoomChannelReadState;
  hiddenFactionHuddleCount: number;
  factionHuddleThreads: RoomFactionHuddleThread[];
  privateThreads?: RoomPrivateThread[];
  privateChatRequests?: RoomPrivateChatRequest[];
  lastPrivateInfluence?: PrivateInfluenceAssessment | null;
  userFactionHuddle: RoomUserFactionHuddleState | null;
  userProfile: RoomUserProfile;
  director: RoomDirectorState;
  highlightedTargets: RoomMentionTarget[];
  lastSpeakerId: string | null;
  participants: RoomParticipant[];
  messages: ConsoleMessage[];
}

export interface ConsoleAppState {
  language: AppLanguage;
  config: ConfigState;
  setup: SetupState;
  ai: AiServiceState;
  privacy: PrivacySettings;
  voice: VoicePipelineState;
  aiPresets: AiServicePreset[];
  selectedPackId: string;
  packs: CharacterPackSummary[];
  prompts: PromptCenterState;
  packImport: PackImportState;
  packWorkshop: CharacterWorkshopState;
  rooms: RoomState[];
  activeRoomId: string;
  room: RoomState;
  release: ReleaseReadinessReport | null;
}

export type ConsoleAction =
  | { type: "ui.setLanguage"; language: AppLanguage }
  | { type: "config.setSection"; section: ConfigSection }
  | { type: "setup.next" }
  | { type: "setup.previous" }
  | { type: "setup.complete" }
  | { type: "ai.setPreset"; presetId: string }
  | { type: "ai.setKeyPreview"; apiKeyPreview: string }
  | { type: "ai.setEndpointUrl"; use: AiModelUse; apiUrl: string }
  | { type: "ai.setEndpointKeyPreview"; use: AiModelUse; apiKeyPreview: string }
  | { type: "ai.setEndpointModel"; use: AiModelUse; model: string }
  | { type: "ai.setEndpointGeneration"; use: "chat"; field: keyof GenerationSettings; value: number }
  | { type: "ai.testEndpoint"; use: AiModelUse }
  | {
      type: "ai.setEndpointTestResult";
      use: AiModelUse;
      status: AiConnectionStatus;
      message: string;
      testedAt?: string | null;
      availableModels?: string[];
      capabilitySummary?: string;
      errorCode?: AiProviderErrorCode | null;
    }
  | {
      type: "ai.setEndpointRuntimeStatus";
      use: AiModelUse;
      runtimeStatus: AiRuntimeStatus;
      message: string;
      at?: string | null;
      errorCode?: AiProviderErrorCode | null;
    }
  | { type: "localModel.refresh"; state: LocalModelRuntimeState }
  | { type: "localModel.setState"; state: LocalModelState; message?: string | null }
  | { type: "localModel.setEnabled"; enabled: boolean }
  | { type: "localModel.select"; modelId: string }
  | { type: "localModel.freeMemory" }
  | { type: "ai.setTtsVoice"; voiceId: string; source?: TtsVoiceSource }
  | { type: "ai.setTtsLanguage"; language: string }
  | { type: "ai.toggleAdvanced" }
  | { type: "ai.setBaseUrl"; baseUrl: string }
  | { type: "ai.setChatModel"; chatModel: string }
  | { type: "ai.setVisionModel"; visionModel: string }
  | { type: "ai.setEmbeddingModel"; embeddingModel: string }
  | { type: "ai.setTtsModel"; ttsModel: string }
  | { type: "ai.setSttModel"; sttModel: string }
  | {
      type: "ai.setFeatureEnabled";
      feature: "visionEnabled" | "embeddingEnabled" | "cloudTtsEnabled" | "cloudSttEnabled" | "streamingEnabled" | "jsonModeEnabled";
      enabled: boolean;
    }
  | { type: "ai.setCompatibilityMode"; compatibilityMode: AiCompatibilityMode }
  | { type: "ai.setAuthMode"; authMode: AiAuthMode }
  | { type: "ai.setCustomAuthHeader"; customAuthHeader: string }
  | { type: "ai.setOrganizationId"; organizationId: string }
  | { type: "ai.setProjectId"; projectId: string }
  | { type: "ai.setProxyUrl"; proxyUrl: string }
  | {
      type: "ai.setEndpointPath";
      field: "chatPath" | "modelsPath" | "embeddingsPath" | "ttsPath" | "sttPath";
      value: string;
    }
  | { type: "ai.setNumberField"; field: "temperature" | "maxTokens" | "timeoutMs"; value: number }
  | { type: "ai.test" }
  | {
      type: "ai.setConnectionResult";
      status: AiConnectionStatus;
      message: string;
      testedAt?: string | null;
      availableModels?: string[];
      capabilitySummary?: string;
      errorCode?: AiProviderErrorCode | null;
    }
  | { type: "voice.refresh"; state: VoicePipelineState }
  | { type: "voice.setPermission"; permissionState: VoicePermissionState; message: string }
  | { type: "voice.setMicrophoneMode"; microphoneMode: VoicePipelineState["microphoneMode"] }
  | { type: "voice.setTtsEnabled"; enabled: boolean }
  | { type: "voice.setTtsBackend"; backend: VoiceBackend }
  | { type: "voice.setSelectedVoice"; voiceId: string | null }
  | { type: "voice.test" }
  | { type: "voice.modelDownloadStart"; modelId: VoiceModelDownloadState["modelId"] }
  | { type: "voice.modelDownloadProgress"; model: VoiceModelDownloadState; message: string }
  | { type: "voice.modelDownloadResult"; model: VoiceModelDownloadState; message: string; sttStatus: VoicePipelineStatus }
  | { type: "voice.transcriptionResult"; result: SttResult }
  | { type: "voice.synthesisResult"; result: TtsResult }
  | { type: "privacy.toggle"; key: keyof PrivacySettings }
  | { type: "prompt.open"; scope: PromptScope; targetId: string }
  | { type: "prompt.openRoomSet"; roomId: string; promptType?: PromptCenterPromptType; roleId?: string }
  | { type: "prompt.openCharacterBase"; packId: string }
  | { type: "prompt.setMode"; mode: PromptCenterMode }
  | { type: "prompt.selectRoom"; roomId: string }
  | { type: "prompt.selectPromptType"; promptType: PromptCenterPromptType }
  | { type: "prompt.selectPromptMode"; mode: RoomContextPanelMode }
  | { type: "prompt.selectRoomRole"; roleId: string }
  | { type: "prompt.selectCharacterPack"; packId: string }
  | { type: "prompt.setRoomSearch"; query: string }
  | { type: "prompt.setCharacterSearch"; query: string }
  | { type: "prompt.togglePreview"; open: boolean }
  | { type: "prompt.setDraft"; scope: PromptScope; targetId: string; text: string; sourceRevision?: number }
  | { type: "prompt.save"; scope: PromptScope; targetId: string; title: string; text: string }
  | { type: "prompt.apply"; scope: PromptScope; targetId: string; title: string; text: string }
  | { type: "prompt.saveAndApply"; scope: PromptScope; targetId: string; title: string; text: string }
  | { type: "prompt.restoreDefault"; scope: PromptScope; targetId: string; title: string; defaultText: string }
  | { type: "prompt.restoreTemplate"; scope: PromptScope; targetId: string; title: string; defaultText: string }
  | { type: "prompt.loadOverride"; scope: PromptScope; targetId: string; defaultText: string }
  | { type: "promptPreset.select"; presetId?: string }
  | { type: "promptPreset.load"; presets: PromptPreset[]; message?: string }
  | {
      type: "promptPreset.create";
      kind: PromptPresetKind;
      title: string;
      description?: string;
      language?: "auto" | AppLanguage;
      supportedModes?: Array<RoomContextPanelMode | "any">;
      text: string;
      tags?: string[];
      source?: PromptPresetSource;
      sourceId?: string;
      selectAfterCreate?: boolean;
    }
  | {
      type: "promptPreset.update";
      presetId: string;
      patch: Partial<Pick<PromptPreset, "title" | "description" | "language" | "supportedModes" | "text" | "tags">>;
    }
  | { type: "promptPreset.delete"; presetId: string }
  | { type: "promptPreset.applyToCurrentTarget"; presetId: string }
  | { type: "promptPreset.importPack"; presets: PromptPreset[]; sourceId?: string; message?: string }
  | { type: "pack.select"; packId: string }
  | { type: "pack.setImportPath"; sourcePath: string }
  | { type: "pack.validateStart" }
  | { type: "pack.validateResult"; report: PackValidationReport; message: string }
  | { type: "pack.importStart" }
  | { type: "pack.importResult"; pack: ImportedCharacterPack | null; message: string; warnings: string[]; errors: string[] }
  | { type: "pack.refresh"; packs: CharacterPackSummary[] }
  | { type: "pack.workshopOpen"; mode: CharacterWorkshopMode; packId?: string; tab?: CharacterWorkshopTab }
  | { type: "pack.createDraftSetField"; field: keyof EditableCharacterDraft; value: string | boolean }
  | { type: "pack.editDraftSetField"; field: keyof EditableCharacterDraft; value: string | boolean }
  | { type: "pack.assetSet"; slot: CharacterAssetSlot; sourcePath: string; action?: CharacterAssetDraftAction; sourceDataUrl?: string; fileName?: string }
  | { type: "pack.saveDraftStart" }
  | { type: "pack.saveDraftResult"; pack: ImportedCharacterPack | null; message: string; warnings: string[]; errors: string[]; selectedPackId?: string | null; runtimeRefreshRequired?: boolean }
  | { type: "pack.duplicateStart"; packId: string }
  | { type: "pack.deleteStart"; packId: string; deleteMemory: boolean }
  | { type: "pack.deleteResult"; packId: string; packs: CharacterPackSummary[]; message: string; errors: string[] }
  | { type: "room.create"; title?: string; recipeId?: RoomRecipeId }
  | { type: "room.switch"; roomId: string }
  | { type: "room.rename"; roomId?: string; title: string }
  | { type: "room.duplicate"; roomId?: string; title?: string; copyDirectorScript?: boolean }
  | { type: "room.delete"; roomId?: string }
  | { type: "room.toggleOpen" }
  | { type: "room.toggleAutoChat" }
  | { type: "room.setPrivateWhispers"; mode: RoomPrivateWhisperMode }
  | { type: "room.setFactionHuddles"; mode: RoomFactionHuddleMode }
  | { type: "room.addFaction" }
  | {
      type: "room.updateFaction";
      factionId: string;
      patch: Partial<Pick<RoomFaction, "name" | "color" | "description" | "publicGoal" | "privateGoal">>;
    }
  | { type: "room.deleteFaction"; factionId: string }
  | { type: "room.setActiveChannel"; channelId: RoomActiveChannelId }
  | { type: "room.setRoleFaction"; roleId: string; factionId: string }
  | { type: "room.clearRoleFaction"; roleId: string }
  | { type: "room.setDebateSpeakerPosition"; roleId: string; position: RoomDebateSpeakerPositionSetting }
  | { type: "room.setUserFaction"; factionId: string }
  | { type: "room.clearUserFaction" }
  | { type: "room.openUserFactionHuddle"; factionId?: string }
  | { type: "room.closeUserFactionHuddle" }
  | { type: "room.openUserFactionChannel"; factionId?: string }
  | { type: "room.syncFactionChannels" }
  | { type: "room.addFactionHuddle"; thread: RoomFactionHuddleThread }
  | {
      type: "room.createPrivateThread";
      memberTargets: RoomMentionTarget[];
      title?: string;
      createdBy?: RoomPrivateThreadCreatedBy;
      open?: boolean;
    }
  | { type: "room.archivePrivateThread"; threadId: string }
  | { type: "room.sendPrivateMessage"; message: ConsoleMessage }
  | { type: "room.requestRolePrivateChat"; requesterRoleId: string; targetRoleIds: string[]; reason: string }
  | { type: "room.approvePrivateChatRequest"; requestId: string; threadTitle?: string }
  | { type: "room.rejectPrivateChatRequest"; requestId: string; reason: string }
  | { type: "room.setPrivateInfluence"; assessment: PrivateInfluenceAssessment | null }
  | { type: "room.markChannelRead"; channelId: RoomActiveChannelId; messageId?: string; at?: string }
  | { type: "room.markAllVisibleChannelsRead"; at?: string }
  | { type: "room.setCollaborationPlan"; plan: RoomCollaborationPlan | null }
  | { type: "room.setPlotArc"; plot: PlotArcState }
  | { type: "room.setFrameState"; frame: RoomFrameState }
  | { type: "room.setDirectorEnabled"; enabled: boolean }
  | { type: "room.setDirectorRecipe"; recipeId: RoomRecipeId }
  | { type: "room.updateDirectorScene"; sceneBoard: RoomSceneBoard }
  | { type: "room.updateDirectorScript"; patch: DirectorScriptPatch }
  | { type: "room.setDirectorConstraints"; constraints: RoomConstraint[] }
  | { type: "room.addDirectorOverride"; entry: DirectorOverrideLogEntry; constraints: RoomConstraint[]; sceneBoard?: RoomSceneBoard }
  | { type: "room.setDirectorLastMove"; move: RoomDirectorMove; at: string }
  | { type: "room.requestDirectorMove"; move: RoomDirectorMove }
  | { type: "room.setDirectorApiMode"; mode: RoomDirectorApiMode }
  | { type: "room.setDirectorApiPreset"; presetId: string }
  | { type: "room.setDirectorApiKeyPreview"; apiKeyPreview: string }
  | { type: "room.setDirectorApiAdvancedOpen"; advancedOpen: boolean }
  | { type: "room.setDirectorApiField"; field: "baseUrl" | "chatModel" | "visionModel"; value: string }
  | { type: "room.setDirectorApiNumberField"; field: "temperature" | "maxTokens"; value: number }
  | { type: "room.setDirectorGenerationOverride"; enabled?: boolean; field?: keyof GenerationSettings; value?: number }
  | { type: "room.setDirectorApiStatus"; status: RoomApiStatus; message: string; testedAt?: string | null }
  | { type: "room.testDirectorApi" }
  | { type: "room.setUserDisplayName"; displayName: string }
  | { type: "room.setTopic"; topic: string }
  | { type: "room.setSpeed"; speed: RoomState["speed"] }
  | { type: "room.setFreedomLevel"; freedomLevel: RoomFreedomLevel }
  | { type: "room.setAdvancePolicy"; policy: RoomAdvancePolicy }
  | { type: "room.setContextBudget"; budget: RoomContextBudget }
  | { type: "room.setAutoPacePreset"; preset: RoomAutoPacePreset }
  | { type: "room.setAutoPaceNumberField"; field: "minDelayMs" | "maxDelayMs" | "idleFillDelayMs"; value: number }
  | { type: "room.setAutoPaceRandomize"; randomize: boolean }
  | { type: "room.setSpeakerPolicy"; policy: RoomSpeakerPolicy }
  | { type: "room.setSpeakerPolicyNumberField"; field: "maxConsecutivePairTurns" | "lurkerBoostAfterTurns"; value: number }
  | { type: "room.setSpeakerPolicyBooleanField"; field: "recentSpeakerPenalty"; value: boolean }
  | {
      type: "room.setAdvanceRuntimeState";
      continuationAssessment?: ContinuationAssessment | null;
      advanceDecision?: RoomAdvanceDecision | null;
      engagementDecision?: RoomEngagementDecision | null;
      shouldSpeakDecision?: RoomShouldSpeakDecision | null;
      inputProcessed?: RoomInputProcessedRecord | null;
      responseObligation?: RoomResponseObligation | null;
      noResponseReason?: string | null;
      fallbackAction?: RoomFallbackAction | null;
      silentAutoTurnCount?: number;
    }
  | {
      type: "room.setCollaborationState";
      mode?: RoomCollaborationMode;
      floorOwner?: RoomFloorOwner;
      phase?: RoomTurnPhase;
      terminationReason?: RoomTerminationReason | null;
    }
  | {
      type: "room.setSimulationState";
      simulation: Partial<RoomSimulationState>;
      match?: Partial<RoomMatchState>;
    }
  | { type: "room.setDiscussionPlan"; plan: RoomDiscussionPlan | null }
  | { type: "room.setApiMode"; mode: RoomApiMode }
  | { type: "room.setApiPreset"; presetId: string }
  | { type: "room.setApiKeyPreview"; apiKeyPreview: string }
  | { type: "room.setApiAdvancedOpen"; advancedOpen: boolean }
  | { type: "room.setApiField"; field: "baseUrl" | "chatModel" | "visionModel"; value: string }
  | { type: "room.setApiNumberField"; field: "temperature" | "maxTokens"; value: number }
  | { type: "room.setGenerationMode"; mode: RoomGenerationProfile["mode"] }
  | { type: "room.setGenerationField"; field: keyof GenerationSettings; value: number }
  | { type: "room.setApiStatus"; status: RoomApiStatus; message: string; testedAt?: string | null }
  | { type: "room.testApi" }
  | { type: "room.setExpandedInspectorSection"; section: RoomInspectorSection | null }
  | { type: "room.selectPromptProfile"; profileId: RoomPromptProfileId }
  | {
      type: "room.tickAutoSpeech";
      status: RoomAutoSpeechStatus;
      reason: RoomScheduleReason;
      nextTurnAt: number | null;
      consecutiveAutoTurns: number;
      userTriggeredFollowUps: number;
      lastTurnAt: number | null;
      pendingFollowup?: RoomPendingFollowup | null;
    }
  | {
      type: "room.setAutoSpeechStatus";
      status: RoomAutoSpeechStatus;
      nextTurnAt?: number | null;
      lastReason?: RoomScheduleReason | null;
      resetCounters?: boolean;
      pendingFollowup?: RoomPendingFollowup | null;
    }
  | { type: "room.setLastSpeaker"; roleId: string | null }
  | { type: "room.setHighlightedTargets"; targets: RoomMentionTarget[] }
  | { type: "room.addRole"; packId: string }
  | { type: "room.removeRole"; roleId: string }
  | { type: "room.setExpandedApiRole"; roleId: string | null }
  | { type: "room.setExpandedIdentityCardRole"; roleId: string | null }
  | { type: "room.setIdentityCardEnabled"; roleId: string; enabled: boolean }
  | { type: "room.setIdentityCardField"; roleId: string; field: RoomIdentityCardField; value: string }
  | { type: "room.restoreIdentityCardTemplate"; roleId: string }
  | { type: "room.setRoleApiMode"; roleId: string; mode: RoleApiMode }
  | {
      type: "room.setRoleApiOverride";
      roleId: string;
      patch: Partial<
        Pick<RoleApiProfile, "providerId" | "baseUrl" | "chatModel" | "visionModel" | "temperature" | "maxTokens">
      > & { apiKeyPreview?: string };
    }
  | { type: "room.setRoleGenerationOverride"; roleId: string; enabled?: boolean; field?: keyof GenerationSettings; value?: number }
  | { type: "room.clearRoleApiOverride"; roleId: string }
  | { type: "room.setRoleApiStatus"; roleId: string; status: RoomApiStatus }
  | { type: "room.updateParticipant"; roleId: string; emotion: string; viewportState: RoomRoleViewportState }
  | { type: "room.addMessage"; message: ConsoleMessage }
  | { type: "release.scanStart" }
  | { type: "release.scanResult"; report: ReleaseReadinessReport }
  | { type: "memory.addSharedNote"; text: string };

export interface ShortTermMention {
  id: string;
  scope: MemoryScope;
  kind: MemoryAtomKind;
  subject: string;
  normalizedText: string;
  normalizedKey: string;
  source: "user" | "character" | "room";
  count: number;
  confidence: number;
  sensitivity: MemorySensitivity;
  sourceMessageIds: string[];
  firstSeenAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface CandidateMemory {
  id: string;
  sourceScope: MemoryScope;
  scope: MemoryScope;
  fact: string;
  text: string;
  evidenceCount: number;
  mentionCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  createdAt: string;
  sensitivity: MemorySensitivity;
  requiresConfirmation: boolean;
  confirmed: boolean;
}

export interface CompressedMemoryEntry {
  id: string;
  scope: MemoryScope;
  memoryKey: string;
  kind: CompressedMemoryKind;
  text: string;
  sourceIds: string[];
  sourceMessageIds: string[];
  evidenceCount: number;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
  status: MemoryEntryStatus;
  sensitivity: MemorySensitivity;
  previousVersionId?: string;
  supersededById?: string;
  conflictWithIds?: string[];
}

export interface MemoryVersionEntry {
  id: string;
  memoryId: string;
  scope: MemoryScope;
  previousText: string;
  nextText: string;
  reason: "reinforce" | "refine" | "replace" | "conflict" | "archive";
  createdAt: string;
  sourceIds: string[];
}

export interface CharacterPackMemoryFile {
  packId: string;
  scope: MemoryScope;
  entries: CompressedMemoryEntry[];
  shortTerm: ShortTermMention[];
  candidates: CandidateMemory[];
  versionHistory: MemoryVersionEntry[];
  updatedAt: string;
}

export interface MemoryEditPatch {
  memoryId: string;
  scope: MemoryScope;
  text?: string;
  kind?: MemoryAtomKind;
  status?: MemoryEntryStatus;
}

export interface MemoryRollingSummary {
  scope: MemoryScope;
  text: string;
  sourceIds: string[];
  messageCount: number;
  updatedAt: string | null;
}

export type SemanticMemoryObservationKind =
  | "trait"
  | "preference"
  | "habit"
  | "relationship"
  | "trust"
  | "stance"
  | "goal"
  | "event"
  | "item"
  | "location"
  | "claim"
  | "belief"
  | "doubt"
  | "conflict"
  | "reliability"
  | "scene_pressure";

export type SemanticMemoryEpistemicStatus =
  | "observed"
  | "inferred"
  | "claimed"
  | "believed"
  | "doubted"
  | "confirmed"
  | "disputed"
  | "refuted";

export type SemanticMemorySubjectType = "room" | "user" | "role" | "director" | "faction" | "item" | "unknown";
export type SemanticMemoryVisibility =
  | "public"
  | "known_to_roles"
  | "faction"
  | "director_only"
  | "private_character"
  | "global";

export interface SemanticMemoryObservation {
  id: string;
  scope: MemoryScope;
  subjectId?: string;
  subjectType: SemanticMemorySubjectType;
  subjectName?: string;
  kind: SemanticMemoryObservationKind;
  text: string;
  epistemicStatus: SemanticMemoryEpistemicStatus;
  confidence: number;
  evidenceCount: number;
  sourceMessageIds: string[];
  visibility: SemanticMemoryVisibility;
  createdAt: string;
  lastUpdatedAt: string;
}

export interface MemoryCompressionJob {
  id: string;
  scope: MemoryScope;
  sourceIds: string[];
  sourceText: string;
  reason: "promotion" | "explicit" | "rolling_summary" | "observer" | "faction" | "director";
  createdAt: string;
}

export interface MemoryCompressionResult {
  ok: boolean;
  saved: boolean;
  reason: "saved" | "memory_disabled" | "filtered" | "not_promoted" | "updated_summary" | "skipped";
  entry?: CompressedMemoryEntry;
  summary?: MemoryRollingSummary;
}

export type MemoryEvent =
  | {
      kind: "mention";
      memorySavingEnabled?: boolean;
      scope: MemoryScope;
      text: string;
      source: ShortTermMention["source"];
      now: Date;
      sourceMessageId?: string;
    }
  | {
      kind: "room_message";
      memorySavingEnabled?: boolean;
      input: {
        scope: `room:${string}`;
        speaker: string;
        speakerId?: string;
        speakerType?: ConsoleMessage["speakerType"];
        text: string;
        source: "user" | "room";
        now: Date;
        visibility?: RoomMemoryMessage["visibility"];
        visibleTo?: RoomMentionTarget[];
        privateReason?: RoomMemoryMessage["privateReason"];
        channelId?: RoomActiveChannelId;
        factionId?: string;
      };
    }
  | {
      kind: "room_observation";
      memorySavingEnabled?: boolean;
      input: {
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
      };
    }
  | { kind: "director"; memorySavingEnabled?: boolean; input: Record<string, unknown> }
  | { kind: "faction_huddle"; memorySavingEnabled?: boolean; input: Record<string, unknown> };

export interface RoomMemoryMessage {
  id: string;
  scope: `room:${string}`;
  speaker: string;
  speakerId?: string;
  speakerType?: ConsoleMessage["speakerType"];
  source: "user" | "room";
  text: string;
  at: string;
  visibility?: RoomMessageVisibility;
  visibleTo?: RoomMentionTarget[];
  privateReason?: "ai_to_ai_mention" | "system_directed" | "faction_huddle" | "private_thread" | "director_channel";
  channelId?: RoomActiveChannelId;
  factionId?: string;
}

export interface RoomObserverMemorySnapshot {
  scope: RoomObserverMemoryScope;
  roomScope: `room:${string}`;
  roleId: string;
  entries: RoomObservationEntry[];
  summary: string;
}

export interface RoomFactionMemorySnapshot {
  scope: RoomFactionMemoryScope;
  roomScope: `room:${string}`;
  factionId: string;
  entries: RoomFactionHuddleThread[];
  summary: string;
  updatedAt: string | null;
}

export interface RoomMemorySnapshot {
  scope: `room:${string}`;
  shortTerm: ShortTermMention[];
  candidates: CandidateMemory[];
  confirmedLongTerm: CandidateMemory[];
  recentMessages: RoomMemoryMessage[];
  summary: string;
}

export interface RoomDirectorMemorySnapshot {
  scope: RoomSystemMemoryScope;
  sceneBoard: RoomSceneBoard;
  continuity: RoomContinuityLedger;
  secrets: RoomSecretEntry[];
  entries: DirectorMemoryEntry[];
  knowledgeMap: DirectorMemoryEntry[];
  constraints: DirectorMemoryEntry[];
  judgements: DirectorMemoryEntry[];
  overrides: DirectorMemoryEntry[];
  summary: string;
  updatedAt: string | null;
}

export type SupportedChatImageFormat = "png" | "jpg" | "jpeg" | "gif" | "webp" | "gpj";

export interface ChatImageAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  format: SupportedChatImageFormat;
  dataUrl: string;
  hasImage?: boolean;
  caption?: string;
  uploadedAt?: string;
}

export interface UntrustedContextBlock {
  source: "image_upload" | "image_caption" | "web_text" | "imported_file" | "room_message";
  text: string;
  capturedAt: string;
  trusted: false;
  attachment?: ChatImageAttachment;
}

export interface InteractionPipelineContext {
  time: string;
  foregroundApp: string;
  imageContext: UntrustedContextBlock | null;
  memorySnippets: string[];
  activeCharacter: CharacterViewModel;
  activeRoom: RoomState | null;
  userInput: string;
}

export interface EmotionResult {
  text: string;
  subtitleSource?: string;
  emotion: string;
  explicitEmotion?: boolean;
}

export interface AiTokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedPromptTokens?: number;
  estimatedCompletionTokens?: number;
  promptChars: number;
  completionChars: number;
}

export interface AiProviderResult extends EmotionResult {
  provider: string;
  usedContext: Array<keyof InteractionPipelineContext>;
  usage?: AiTokenUsage;
}

export type AiProviderErrorCode = "not_configured" | "timeout" | "cancelled" | "network" | "unsupported" | "unknown";

export interface AiProviderError {
  code: AiProviderErrorCode;
  message: string;
  nextStep: string;
}

export interface AiProvider {
  chat(context: InteractionPipelineContext, signal?: AbortSignal): Promise<AiProviderResult>;
  vision(block: UntrustedContextBlock, signal?: AbortSignal): Promise<AiProviderResult>;
  embed(text: string, signal?: AbortSignal): Promise<number[]>;
}

export interface ReleaseReadinessReport {
  generatedAt: string;
  stagingPath: string;
  status: "ready" | "warning" | "error";
  checkedItems: Array<{
    name: string;
    status: "pass" | "warning" | "fail";
    detail: string;
  }>;
  forbiddenFindings: string[];
  missingItems: string[];
  packageSummary: {
    files: number;
    bytes: number;
    includesRustToolchain: boolean;
    includesRuntimeCache: boolean;
    includesSecrets: boolean;
  };
}
