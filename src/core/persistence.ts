import type {
  ConsoleAppState,
  ConsoleMessage,
  ConsoleView,
  PromptCenterState,
  PromptDraft,
  PromptOverride,
  RoomInspectorSection,
} from "./types";
import { normalizePromptPresets } from "./promptPresets";

const APP_STATE_STORAGE_KEY = "cmdpet.app-state.v1";
const APP_ACTIVE_VIEW_STORAGE_KEY = "cmdpet.active-console-view.v1";

export interface PersistedAppState {
  version: 1;
  savedAt: string;
  activeConsoleView: ConsoleView;
  /**
   * Legacy one-on-one transcript. New builds keep per-character Direct Room
   * history in character-pack files and only read this field for migration.
   */
  consoleMessages?: ConsoleMessage[];
  commandHistory: string[];
  consoleState: Omit<ConsoleAppState, "aiPresets" | "packs"> & {
    ai: Omit<ConsoleAppState["ai"], "apiKeyPreview"> & {
      apiKeyPreview: "";
    };
  };
}

export function loadPersistedAppState(): PersistedAppState | null {
  try {
    const raw = window.localStorage.getItem(APP_STATE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    if (parsed.version !== 1 || !parsed.consoleState) {
      return null;
    }
    return {
      version: 1,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date(0).toISOString(),
      activeConsoleView: loadPersistedActiveConsoleView() ?? (isConsoleView(parsed.activeConsoleView) ? parsed.activeConsoleView : "config"),
      consoleMessages: Array.isArray(parsed.consoleMessages) ? parsed.consoleMessages : [],
      commandHistory: Array.isArray(parsed.commandHistory) ? parsed.commandHistory.filter((item) => typeof item === "string") : [],
      consoleState: parsed.consoleState as PersistedAppState["consoleState"],
    };
  } catch {
    window.localStorage.removeItem(APP_STATE_STORAGE_KEY);
    return null;
  }
}

export function loadPersistedActiveConsoleView(): ConsoleView | null {
  try {
    const value = window.localStorage.getItem(APP_ACTIVE_VIEW_STORAGE_KEY);
    return isConsoleView(value) ? value : null;
  } catch {
    return null;
  }
}

export function savePersistedAppState(input: {
  activeConsoleView: ConsoleView;
  commandHistory: string[];
  consoleState: ConsoleAppState;
}) {
  try {
    window.localStorage.setItem(APP_ACTIVE_VIEW_STORAGE_KEY, input.activeConsoleView);
  } catch {
    // The full state save below is still attempted.
  }

  const payload: PersistedAppState = {
    version: 1,
    savedAt: new Date().toISOString(),
    activeConsoleView: input.activeConsoleView,
    commandHistory: input.commandHistory.slice(0, 50),
    consoleState: sanitizeConsoleState(input.consoleState),
  };

  try {
    window.localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Runtime state still works if localStorage is unavailable.
  }
}

export function restoreConsoleState(base: ConsoleAppState, persisted: PersistedAppState | null): ConsoleAppState {
  if (!persisted) {
    return base;
  }

  const persistedConfig = persisted.consoleState.config ?? base.config;
  const persistedRooms = Array.isArray(persisted.consoleState.rooms) && persisted.consoleState.rooms.length > 0
    ? persisted.consoleState.rooms
    : [persisted.consoleState.room ?? base.room];
  const activeRoomId = typeof persisted.consoleState.activeRoomId === "string" &&
    persistedRooms.some((room) => room.id === persisted.consoleState.activeRoomId)
    ? persisted.consoleState.activeRoomId
    : persistedRooms[0]?.id ?? base.room.id;
  const persistedRoom = persistedRooms.find((room) => room.id === activeRoomId) ?? persistedRooms[0] ?? base.room;
  const persistedPackImport = persisted.consoleState.packImport ?? base.packImport;
  const roomMessages = Array.isArray(persistedRoom.messages) ? persistedRoom.messages : [];
  const restoredAi = sanitizeRestoredAiState(base, persisted.consoleState.ai);

  return {
    ...base,
    ...persisted.consoleState,
    config: {
      ...base.config,
      ...persistedConfig,
      activeSection: persistedConfig.activeSection === "voice" || persistedConfig.activeSection === "privacy"
        ? persistedConfig.activeSection
        : "ai",
    },
    privacy: {
      ...base.privacy,
      ...persisted.consoleState.privacy,
      memorySavingEnabled: true,
    },
    voice: sanitizeRestoredVoiceState(base.voice, persisted.consoleState.voice),
    aiPresets: base.aiPresets,
    packs: base.packs,
    activeRoomId,
    rooms: persistedRooms.map((room) => sanitizeRestoredRoomForCollection(base.room, room)),
    room: {
      ...base.room,
      ...persistedRoom,
      title: persistedRoom.title ?? persistedRoom.topic ?? base.room.title,
      apiProfile: {
        ...base.room.apiProfile,
        ...persistedRoom.apiProfile,
        generationMode: persistedRoom.apiProfile?.generationMode ?? base.room.apiProfile.generationMode,
      },
      flowMode: persistedRoom.flowMode ?? (persistedRoom.autoChat ? "auto_simulation" : "player_reactive"),
      freedomLevel: persistedRoom.freedomLevel ?? base.room.freedomLevel,
      simulationObjective: persistedRoom.simulationObjective ?? base.room.simulationObjective,
      collaborationMode: persistedRoom.collaborationMode ?? base.room.collaborationMode,
      floorOwner: persistedRoom.floorOwner ?? base.room.floorOwner,
      turnPhase: persistedRoom.turnPhase ?? base.room.turnPhase,
      lastTerminationReason: persistedRoom.lastTerminationReason ?? base.room.lastTerminationReason,
      activeDiscussionPlan: persistedRoom.activeDiscussionPlan ?? null,
      privateWhispers: persistedRoom.privateWhispers ?? base.room.privateWhispers,
      privateWhisperPolicy: {
        ...base.room.privateWhisperPolicy,
        ...persistedRoom.privateWhisperPolicy,
      },
      factionHuddles: persistedRoom.factionHuddles ?? base.room.factionHuddles,
      factions: persistedRoom.factions?.length ? persistedRoom.factions : base.room.factions,
      activeChannelId:
        persistedRoom.activeChannelId ??
        (persistedRoom.userFactionHuddle?.factionId
          ? `faction:${persistedRoom.userFactionHuddle.factionId}`
          : base.room.activeChannelId),
      hiddenFactionHuddleCount: persistedRoom.hiddenFactionHuddleCount ?? 0,
      factionHuddleThreads: persistedRoom.factionHuddleThreads ?? [],
      userFactionHuddle: persistedRoom.userFactionHuddle ?? null,
      expandedInspectorSection: isRoomInspectorSection(persistedRoom.expandedInspectorSection)
        ? persistedRoom.expandedInspectorSection
        : base.room.expandedInspectorSection,
      director: {
        ...base.room.director,
        ...persistedRoom.director,
        apiProfile: {
          ...base.room.director.apiProfile,
          ...persistedRoom.director?.apiProfile,
          generationMode: persistedRoom.director?.apiProfile?.generationMode ?? base.room.director.apiProfile.generationMode,
          generationOverrideEnabled:
            persistedRoom.director?.apiProfile?.generationOverrideEnabled ?? base.room.director.apiProfile.generationOverrideEnabled,
        },
        aliases: persistedRoom.director?.aliases?.length
          ? persistedRoom.director.aliases
          : base.room.director.aliases,
        sceneBoard: {
          ...base.room.director.sceneBoard,
          ...persistedRoom.director?.sceneBoard,
        },
        constraints: persistedRoom.director?.constraints?.length
          ? persistedRoom.director.constraints
          : base.room.director.constraints,
        overrideLog: persistedRoom.director?.overrideLog ?? [],
      },
      userProfile: {
        ...base.room.userProfile,
        ...persistedRoom.userProfile,
        aliases: persistedRoom.userProfile?.aliases?.length
          ? persistedRoom.userProfile.aliases
          : base.room.userProfile.aliases,
      },
      participants: Array.isArray(persistedRoom.participants)
        ? persistedRoom.participants.map((participant) => ({
            ...participant,
            apiProfile: {
              ...base.room.participants[0]?.apiProfile,
              ...participant.apiProfile,
              generationOverrideEnabled: participant.apiProfile?.generationOverrideEnabled ?? false,
            },
            memoryScope: roomRoleMemoryScope(persistedRoom.id ?? base.room.id, participant.id ?? participant.roleId ?? participant.packId),
            factionId: participant.factionId ?? "neutral",
          }))
        : base.room.participants,
      highlightedTargets: persistedRoom.highlightedTargets ?? [],
      messages: roomMessages.map((message) => normalizeRestoredMessage(message)),
      hiddenWhisperCount: roomMessages.filter((message) => message.visibility === "private_ai").length,
    },
    prompts: sanitizeRestoredPrompts(base.prompts, persisted.consoleState.prompts),
    ai: {
      ...base.ai,
      ...restoredAi,
      apiKeyPreview: "",
      connectionStatus: restoredAi.connectionStatus,
      lastTestMessage: restoredAi.lastTestMessage,
    },
    packImport: {
      ...base.packImport,
      ...persistedPackImport,
      status: "idle",
      message: "Import settings restored. You can continue importing or switch character packs.",
      warnings: [],
      errors: [],
    },
  };
}

export function clearPersistedAppState() {
  window.localStorage.removeItem(APP_STATE_STORAGE_KEY);
}

function sanitizeConsoleState(state: ConsoleAppState): PersistedAppState["consoleState"] {
  return {
    ...state,
    privacy: {
      ...state.privacy,
      memorySavingEnabled: true,
    },
    prompts: sanitizeRestoredPrompts(state.prompts, state.prompts),
    packWorkshop: {
      ...state.packWorkshop,
      draft: sanitizeCharacterDraftForPersistence(state.packWorkshop.draft),
    },
    ai: {
      ...state.ai,
      localChatModel: {
        ...state.ai.localChatModel,
        state: state.ai.localChatModel.enabled
          ? state.ai.localChatModel.state === "ready"
            ? "verifying"
            : state.ai.localChatModel.state
          : "not_found",
        installState: state.ai.localChatModel.enabled ? "verifying" : "missing",
        availableModels: [],
        manifest: null,
        modelId: null,
        lastError: null,
      },
      chat: sanitizeEndpointForPersistence(state.ai.chat),
      vision: sanitizeEndpointForPersistence(state.ai.vision),
      tts: {
        ...sanitizeEndpointForPersistence(state.ai.tts),
        voice: state.ai.tts.voice,
      },
      apiKeyPreview: "",
    },
  };
}

function sanitizeCharacterDraftForPersistence(
  draft: ConsoleAppState["packWorkshop"]["draft"],
): ConsoleAppState["packWorkshop"]["draft"] {
  const assetChanges = Object.fromEntries(
    Object.entries(draft.assetChanges).map(([slot, change]) => [
      slot,
      {
        ...change,
        sourceDataUrl: undefined,
      },
    ]),
  );
  return {
    ...draft,
    assetChanges,
  };
}

function isRoomInspectorSection(value: unknown): value is RoomInspectorSection {
  return value === "members" || value === "room_ai" || value === "director_ai" || value === "packs" || value === "rules";
}

function sanitizeRestoredRoomForCollection(
  baseRoom: ConsoleAppState["room"],
  room: Partial<ConsoleAppState["room"]>,
): ConsoleAppState["room"] {
  const roomId = typeof room.id === "string" && room.id.trim() ? room.id : baseRoom.id;
  const messages = Array.isArray(room.messages) ? room.messages : [];
  return {
    ...baseRoom,
    ...room,
    id: roomId,
    title: room.title ?? room.topic ?? baseRoom.title,
    flowMode: room.flowMode ?? (room.autoChat ? "auto_simulation" : "player_reactive"),
    activeDiscussionPlan: room.activeDiscussionPlan ?? null,
    activeChannelId: room.activeChannelId ?? "public",
    director: {
      ...baseRoom.director,
      ...room.director,
      memoryScope: `room:${roomId}:system`,
      apiProfile: {
        ...baseRoom.director.apiProfile,
        ...room.director?.apiProfile,
        generationMode: room.director?.apiProfile?.generationMode ?? baseRoom.director.apiProfile.generationMode,
        generationOverrideEnabled:
          room.director?.apiProfile?.generationOverrideEnabled ?? baseRoom.director.apiProfile.generationOverrideEnabled,
      },
      aliases: room.director?.aliases?.length ? room.director.aliases : baseRoom.director.aliases,
      sceneBoard: {
        ...baseRoom.director.sceneBoard,
        ...room.director?.sceneBoard,
        title: room.title ?? room.director?.sceneBoard?.title ?? baseRoom.director.sceneBoard.title,
      },
      constraints: room.director?.constraints?.length ? room.director.constraints : baseRoom.director.constraints,
      overrideLog: room.director?.overrideLog ?? [],
    },
    userProfile: {
      ...baseRoom.userProfile,
      ...room.userProfile,
      aliases: room.userProfile?.aliases?.length ? room.userProfile.aliases : baseRoom.userProfile.aliases,
    },
    participants: Array.isArray(room.participants)
      ? room.participants.map((participant) => ({
          ...participant,
          apiProfile: {
            ...baseRoom.participants[0]?.apiProfile,
            ...participant.apiProfile,
            generationOverrideEnabled: participant.apiProfile?.generationOverrideEnabled ?? false,
          },
          memoryScope: roomRoleMemoryScope(roomId, participant.id ?? participant.roleId ?? participant.packId),
          factionId: participant.factionId ?? "neutral",
        }))
      : baseRoom.participants,
    messages: messages.map((message) => normalizeRestoredMessage(message, `room:${roomId}` as const)),
  };
}

function normalizeRestoredMessage(message: ConsoleMessage, scope?: ConsoleMessage["scope"]): ConsoleMessage {
  const visibility = message.visibility ?? "public";
  const channelId =
    message.channelId ??
    (visibility === "faction_huddle" && message.factionId
      ? (`faction:${message.factionId}` as const)
      : "public");

  return {
    ...message,
    target: message.target ?? "all",
    mentions: Array.isArray(message.mentions) ? message.mentions : [],
    visibility,
    visibleTo: Array.isArray(message.visibleTo) ? message.visibleTo : [],
    channelId,
    ...(scope ? { scope } : {}),
  };
}

function sanitizeEndpointForPersistence<T extends ConsoleAppState["ai"]["chat"]>(endpoint: T): T {
  return {
    ...endpoint,
    keyPreview: "",
    hasStoredSecret: Boolean(endpoint.hasStoredSecret),
    runtimeStatus: "idle",
    lastRuntimeMessage: "",
    lastRuntimeAt: null,
  };
}

function sanitizeRestoredPrompts(base: PromptCenterState, prompts: PromptCenterState | undefined): PromptCenterState {
  if (!prompts) {
    return base;
  }
  return {
    ...base,
    ...prompts,
    overrides: Array.isArray(prompts.overrides) ? prompts.overrides.filter(isPromptOverride) : base.overrides,
    drafts: Array.isArray(prompts.drafts) ? prompts.drafts.filter(isPromptDraft) : base.drafts,
    presets: normalizePromptPresets((prompts as { presets?: unknown }).presets ?? base.presets),
    view: sanitizeRestoredPromptView(base.view, prompts.view),
    activeEditorScope: isPromptScope(prompts.activeEditorScope) ? prompts.activeEditorScope : base.activeEditorScope,
    activeEditorTargetId:
      typeof prompts.activeEditorTargetId === "string" && prompts.activeEditorTargetId.trim()
        ? prompts.activeEditorTargetId
        : base.activeEditorTargetId,
    revision: Number.isFinite(prompts.revision) ? prompts.revision : base.revision,
    lastMessage: typeof prompts.lastMessage === "string" ? prompts.lastMessage : base.lastMessage,
    lastError: typeof prompts.lastError === "string" ? prompts.lastError : null,
  };
}

function sanitizeRestoredPromptView(
  base: PromptCenterState["view"],
  view: PromptCenterState["view"] | undefined,
): PromptCenterState["view"] {
  if (!view) {
    return base;
  }
  const restoredMode = view.mode === "characters" || (view as { selectedType?: unknown }).selectedType === "character_pack" ? "characters" : "rooms";
  return {
    mode: restoredMode,
    selectedRoomId: typeof view.selectedRoomId === "string" && view.selectedRoomId.trim() ? view.selectedRoomId : base.selectedRoomId,
    selectedType: isPromptCenterPromptType(view.selectedType) ? view.selectedType : base.selectedType,
    selectedPromptMode: isPromptCenterRoomMode((view as { selectedPromptMode?: unknown }).selectedPromptMode)
      ? (view as { selectedPromptMode: PromptCenterState["view"]["selectedPromptMode"] }).selectedPromptMode
      : base.selectedPromptMode,
    selectedRoleId: typeof view.selectedRoleId === "string" && view.selectedRoleId.trim() ? view.selectedRoleId : undefined,
    selectedPackId: typeof view.selectedPackId === "string" && view.selectedPackId.trim() ? view.selectedPackId : base.selectedPackId,
    roomSearchQuery: typeof view.roomSearchQuery === "string" ? view.roomSearchQuery : base.roomSearchQuery,
    characterSearchQuery: typeof view.characterSearchQuery === "string" ? view.characterSearchQuery : base.characterSearchQuery,
    previewOpen: typeof view.previewOpen === "boolean" ? view.previewOpen : base.previewOpen,
  };
}

function isPromptOverride(value: unknown): value is PromptOverride {
  const override = value as PromptOverride;
  return (
    Boolean(override) &&
    typeof override.id === "string" &&
    isPromptScope(override.scope) &&
    typeof override.targetId === "string" &&
    typeof override.title === "string" &&
    typeof override.text === "string" &&
    (override.activeText === undefined || typeof override.activeText === "string") &&
    typeof override.updatedAt === "string" &&
    Number.isFinite(override.revision) &&
    (override.appliedRevision === undefined || Number.isFinite(override.appliedRevision)) &&
    typeof override.enabled === "boolean"
  );
}

function isPromptDraft(value: unknown): value is PromptDraft {
  const draft = value as PromptDraft;
  return (
    Boolean(draft) &&
    isPromptScope(draft.scope) &&
    typeof draft.targetId === "string" &&
    typeof draft.text === "string" &&
    typeof draft.dirty === "boolean" &&
    Number.isFinite(draft.sourceRevision)
  );
}

function isPromptScope(value: unknown): value is PromptCenterState["activeEditorScope"] {
  return value === "room" || value === "director" || value === "character_pack" || value === "room_role";
}

function isPromptCenterPromptType(value: unknown): value is PromptCenterState["view"]["selectedType"] {
  return value === "room" || value === "director" || value === "advanced";
}

function isPromptCenterRoomMode(value: unknown): value is NonNullable<PromptCenterState["view"]["selectedPromptMode"]> {
  return value === "casual" || value === "story" || value === "mystery" || value === "debate" || value === "study" || value === "planning" || value === "team";
}

function isConsoleView(value: unknown): value is ConsoleView {
  return (
    value === "chat" ||
    value === "help" ||
    value === "commands" ||
    value === "config" ||
    value === "setup" ||
    value === "ai" ||
    value === "voice" ||
    value === "pack" ||
    value === "prompts" ||
    value === "room" ||
    value === "memory" ||
    value === "privacy" ||
    value === "diagnostics" ||
    value === "release"
  );
}

function sanitizeRestoredAiState(
  base: ConsoleAppState,
  ai: Partial<PersistedAppState["consoleState"]["ai"]> | undefined,
): PersistedAppState["consoleState"]["ai"] {
  const safeAi = ai ?? base.ai;
  const presetExists = base.aiPresets.some((preset) => preset.id === safeAi.presetId);
  const preset = presetExists ? base.aiPresets.find((candidate) => candidate.id === safeAi.presetId)! : base.aiPresets[0]!;
  const baseUrl = safeAi.baseUrl ?? base.ai.baseUrl;
  const chatModel = safeAi.chatModel ?? base.ai.chatModel;
  const visionModel = safeAi.visionModel ?? base.ai.visionModel;
  const embeddingModel = safeAi.embeddingModel ?? base.ai.embeddingModel;
  const ttsModel = safeAi.ttsModel ?? base.ai.ttsModel;
  const sttModel = safeAi.sttModel ?? base.ai.sttModel;
  const restoredChat = sanitizeRestoredEndpoint(base.ai.chat, safeAi.chat, {
    apiUrl: baseUrl,
    model: chatModel,
  });
  const restoredVision = sanitizeRestoredEndpoint(base.ai.vision, safeAi.vision, {
    apiUrl: baseUrl,
    model: visionModel,
  });
  const restoredTtsBase = sanitizeRestoredEndpoint(base.ai.tts, safeAi.tts, {
    apiUrl: baseUrl,
    model: ttsModel,
  });

  return {
    ...base.ai,
    ...safeAi,
    chat: restoredChat,
    vision: restoredVision,
    tts: {
      ...restoredTtsBase,
      voice: {
        ...base.ai.tts.voice,
        ...safeAi.tts?.voice,
      },
    },
    localChatModel: {
      ...base.ai.localChatModel,
      ...safeAi.localChatModel,
      enabled: safeAi.localChatModel?.enabled ?? base.ai.localChatModel.enabled,
      selectedModelId: safeAi.localChatModel?.selectedModelId ?? base.ai.localChatModel.selectedModelId,
      state: safeAi.localChatModel?.enabled === false ? "not_found" : "verifying",
      installState: safeAi.localChatModel?.enabled === false ? "missing" : "verifying",
      availableModels: base.ai.localChatModel.availableModels,
      manifest: null,
      modelId: null,
      lastError: null,
      lastVerifiedAt: null,
    },
    presetId: preset.id,
    apiKeyPreview: "",
    connectionStatus: safeAi.connectionStatus ?? base.ai.connectionStatus,
    lastTestMessage: safeAi.lastTestMessage ?? base.ai.lastTestMessage,
    baseUrl: baseUrl === "https://api.openai.com/v1" ? preset.baseUrl : baseUrl,
    chatModel: chatModel === "gpt-4.1-mini" ? preset.recommendedChatModel : chatModel,
    visionModel:
      visionModel === "gpt-4.1-mini" || visionModel === preset.recommendedChatModel
        ? preset.recommendedVisionModel
        : visionModel,
    embeddingModel: embeddingModel === "text-embedding-3-small" ? preset.recommendedEmbeddingModel : embeddingModel,
    ttsModel: ttsModel === "gpt-4o-mini-tts" ? preset.recommendedTtsModel : ttsModel,
    sttModel: sttModel === "gpt-4o-mini-transcribe" ? preset.recommendedSttModel : sttModel,
    availableModels: Array.isArray(safeAi.availableModels) ? safeAi.availableModels : base.ai.availableModels,
    capabilitySummary: safeAi.capabilitySummary ?? base.ai.capabilitySummary,
    lastErrorCode: safeAi.lastErrorCode ?? base.ai.lastErrorCode,
  };
}

function sanitizeRestoredVoiceState(
  base: ConsoleAppState["voice"],
  voice: ConsoleAppState["voice"] | undefined,
): ConsoleAppState["voice"] {
  if (!voice) {
    return base;
  }
  const preferred = normalizeRestoredVoiceBackend(voice.preferredTtsBackend);
  const active = normalizeRestoredVoiceBackend(voice.activeTtsBackend);
  return {
    ...base,
    ...voice,
    preferredTtsBackend: preferred,
    activeTtsBackend: active,
    availableVoices: (voice.availableVoices ?? base.availableVoices).filter((item) => isSupportedVoiceBackend(item.backend)),
    lastSynthesisMessage: base.lastSynthesisMessage,
  };
}

function normalizeRestoredVoiceBackend(value: string): ConsoleAppState["voice"]["preferredTtsBackend"] {
  return value === "piper_external" ? value : "cloud_tts";
}

function isSupportedVoiceBackend(value: string): value is ConsoleAppState["voice"]["preferredTtsBackend"] {
  return value === "cloud_tts" || value === "piper_external";
}

function roomRoleMemoryScope(roomId: string, roleId: string): `room:${string}:role:${string}` {
  return `room:${roomId}:role:${roleId}`;
}

function sanitizeRestoredEndpoint<T extends ConsoleAppState["ai"]["chat"]>(
  base: T,
  endpoint: T | undefined,
  fallback: Pick<T, "apiUrl" | "model">,
): T {
  return {
    ...base,
    ...endpoint,
    apiUrl: endpoint?.apiUrl?.trim() || fallback.apiUrl || base.apiUrl,
    model: endpoint?.model?.trim() || fallback.model || base.model,
    temperature: Number.isFinite(endpoint?.temperature) ? endpoint!.temperature : base.temperature,
    maxTokens: Number.isFinite(endpoint?.maxTokens) ? endpoint!.maxTokens : base.maxTokens,
    keyPreview: "",
    hasStoredSecret: Boolean(endpoint?.hasStoredSecret),
    runtimeStatus: "idle",
    lastRuntimeMessage: "",
    lastRuntimeAt: null,
  };
}
