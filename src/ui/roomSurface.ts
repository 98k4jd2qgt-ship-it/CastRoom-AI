import type {
  CommandSuggestion,
  ConsoleAction,
  ConsoleAppState,
  ConsoleMessage,
  ConsoleView,
  ConsoleCommandRouter,
  DesktopContextState,
  RoomMentionTarget,
  RoomContextPanelViewModel,
  RoomInspectorSection,
  RoleApiMode,
  RoomDebateSpeakerPositionSetting,
  RoomDirectorApiMode,
  RoomApiMode,
  RoomIdentityCardField,
  RoomParticipant,
  RoomAdvancePolicy,
  RoomAutoPacePreset,
  RoomContextBudget,
  RoomSpeakerPolicy,
  RoomBlockingNeed,
  RoomAdvanceDecision,
  RoomEngagementDecisionKind,
  RoomShouldSpeakAction,
  WindowFrameAction,
  WindowResizeDirection,
  EmotionAssetCandidate,
  DirectorScriptBoard,
  DirectorScriptItem,
  DirectorScriptPatch,
} from "../core/types";
import {
  getMissingRoomEmotionAvatarSlots,
  getPackManifest,
  isRoomEmotionAvatarPackReady,
  resolveRoomEmotionAvatarAsset,
} from "../core/characterPacks";
import {
  buildModeInspectorState,
  buildRoomInspectorSchedulerState,
  debateSpeakerPositionLabel,
  describeDebateAssignment,
  formatDebateAssignments,
  getDebateSpeakerAssignment,
  deriveRoomChannels,
  filterRoomTimelineForChannel,
  formatRoomTarget,
  getActiveRoomChannel,
  getRoomDirectorProfile,
  getRoomPromptProfile,
  hasRoomDirectorMention,
  isStrictDebateFlow,
  isTargetingDirector,
  parseRoomMentions,
  resolveRoomCollaborationMode,
  roomRecipes,
  roomPromptProfiles,
  targetRoleIds,
} from "../core/roomScheduler";
import { categoryLabel, commandDescription, localizeEnum, t, uiText } from "./copy";
import { renderExpandableText } from "./expandableText";

export interface RoomSurfaceProps {
  state: ConsoleAppState;
  desktopContext: DesktopContextState;
  router: ConsoleCommandRouter;
  commandHistory: string[];
  inputDraft: string;
  onInputDraftChange: (value: string, selectionStart: number | null, selectionEnd: number | null) => void;
  onInputFocusChange: (focused: boolean) => void;
  onInputCompositionChange: (composing: boolean, value: string, selectionStart: number | null, selectionEnd: number | null) => void;
  onSubmitInput: (value: string) => void;
  onOpenConsole: (view?: ConsoleView) => void;
  onAction: (action: ConsoleAction) => void;
  onWindowAction: (action: WindowFrameAction) => void;
}

type DirectorScriptItemListKey =
  | "hiddenFacts"
  | "openThreads"
  | "plannedBeats"
  | "environmentAnchors"
  | "forbiddenReveals"
  | "continuityNotes";

interface DirectorScriptDraftState {
  board: DirectorScriptBoard;
  dirty: boolean;
  open: boolean;
  sourceStamp: string;
}

const directorScriptItemListKeys: DirectorScriptItemListKey[] = [
  "hiddenFacts",
  "openThreads",
  "plannedBeats",
  "environmentAnchors",
  "forbiddenReveals",
  "continuityNotes",
];

const directorScriptDrafts = new Map<string, DirectorScriptDraftState>();

function isPublicRoomContextMessage(message: ConsoleMessage): boolean {
  return (message.visibility ?? "public") === "public" && (message.channelId ?? "public") !== "director";
}

function publicRoomContextMessages(room: ConsoleAppState["room"], count: number): ConsoleMessage[] {
  return room.messages.filter(isPublicRoomContextMessage).slice(-count);
}

export function renderRoomSurface(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const shell = document.createElement("section");
  shell.className = "room-surface";
  shell.ariaLabel = t(language, "roomAria");
  shell.tabIndex = -1;

  shell.append(renderResizeHandles(props.onWindowAction), renderRoomTopbar(props), renderRoomMain(props));
  if (hasVisibleRooms(props)) {
    shell.insertBefore(renderRoleStrip(props), shell.querySelector(".room-surface-main"));
    shell.append(renderRoomInput(props));
  }
  shell.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-room-mention]") : null;
    const mention = target?.dataset.roomMention;
    const input = shell.querySelector<HTMLInputElement>(".room-input-row .console-input");
    if (mention && input) {
      insertMention(input, mention);
      props.onInputDraftChange(input.value, input.selectionStart, input.selectionEnd);
      updateAddressHint(shell, input.value, props);
    }
  });
  shell.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openRoomQuickSwitch(props);
    }
  });
  return shell;
}

function renderRoomTopbar(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const topbar = document.createElement("header");
  topbar.className = "room-surface-topbar";
  topbar.dataset.tauriDragRegion = "true";

  const title = document.createElement("div");
  title.className = "room-surface-title";
  title.dataset.tauriDragRegion = "true";
  if (hasVisibleRooms(props)) {
    const activeChannel = getActiveRoomChannel(props.state.room);
    title.innerHTML = `
      <strong>CastRoom AI</strong>
      <button type="button" class="room-title-switch">${escapeHtml(props.state.room.title)} / # ${escapeHtml(displayChannelLabel(props, activeChannel))}</button>
      <span>${escapeHtml(t(language, "roomTopline", { topic: localizedRoomSystemText(props.state.room.topic, language) }))}</span>
    `;
    title.querySelector<HTMLButtonElement>(".room-title-switch")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openRoomQuickSwitch(props);
    });
  } else {
    title.innerHTML = `
      <strong>CastRoom AI</strong>
      <span>${escapeHtml(roomUiText(language, "noRoomsYet", "No rooms yet"))}</span>
    `;
  }
  title.addEventListener("pointerdown", (event) => {
    if (event.target instanceof Element && event.target.closest("button, input, textarea, select, [role='button']")) {
      return;
    }
    if (event.button === 0 && event.detail === 1) {
      props.onWindowAction("startDrag");
    }
  });
  title.addEventListener("dblclick", () => props.onWindowAction("maximize"));

  topbar.append(
    title,
    actionButton(t(language, "roomOpenConsole"), props.onOpenConsole),
    renderWindowControls(language, props.onWindowAction),
  );
  return topbar;
}

function renderWindowControls(
  language: ConsoleAppState["language"],
  onWindowAction: RoomSurfaceProps["onWindowAction"],
): HTMLElement {
  const controls = document.createElement("div");
  controls.className = "window-controls";
  controls.setAttribute("aria-label", roomUiText(language, "windowControls"));

  const items: Array<["minimize" | "maximize" | "close", string, string]> = [
    ["minimize", roomUiText(language, "windowMinimize"), "-"],
    ["maximize", roomUiText(language, "windowMaximize"), "[]"],
    ["close", roomUiText(language, "windowClose"), "x"],
  ];

  for (const [action, label, glyph] of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "window-control";
    button.dataset.action = action;
    button.ariaLabel = label;
    button.title = label;
    button.textContent = glyph;
    button.addEventListener("click", () => onWindowAction(action));
    controls.append(button);
  }

  return controls;
}

function renderRoomCompactStatus(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const summary = roomTopbarSummary(props);
  const status = document.createElement("div");
  status.className = "room-surface-compact-status";
  status.dataset.tone = summary.tone;
  status.title = summary.detail;
  status.innerHTML = `
    <span class="room-status-dot" aria-hidden="true"></span>
    <span>${escapeHtml(summary.label)}</span>
  `;
  status.setAttribute("aria-label", `${roomUiText(language, "roomTopbarStatus")}: ${summary.label}`);
  return status;
}

function roomTopbarSummary(props: RoomSurfaceProps): { label: string; tone: string; detail: string } {
  const language = props.state.language;
  const room = props.state.room;
  const continuousFlowActive = room.isOpen && room.autoChat && room.advancePolicy === "continuous";
  let label = roomUiText(language, "compactRoomStatusPaused");
  let tone = "paused";
  if (!room.isOpen) {
    label = roomUiText(language, "compactRoomStatusClosed");
    tone = "closed";
  } else if (continuousFlowActive || room.autoSpeechState.status === "running" || room.autoSpeechState.status === "cooling_down") {
    label = roomUiText(language, "compactRoomStatusRunning");
    tone = "running";
  } else if (room.autoSpeechState.status === "waiting_user") {
    label = roomUiText(language, "compactRoomStatusWaiting");
    tone = "waiting";
  } else if (room.autoSpeechState.status === "blocked" || room.lastTerminationReason) {
    label = roomUiText(language, "compactRoomStatusStopped");
    tone = "stopped";
  }
  const directorStatus = room.director.enabled
    ? localizedDirectorProfileName(getRoomDirectorProfile(room.director.profileId), language)
    : t(language, "statusOff");
  const details = [
    `${t(language, "roomStatusRoom")}: ${room.isOpen ? t(language, "statusOpen") : t(language, "statusClosed")}`,
    `${t(language, "roomStatusAuto")}: ${autoSpeechStatusLabel(props)}`,
    `${t(language, "roomStatusApi")}: ${roomApiBadge(props)}`,
    `${t(language, "roomStatusPrompt")}: ${localizedRoomPromptProfileName(getRoomPromptProfile(room.promptProfileId), language)}`,
    `${t(language, "roomDirectorTitle")}: ${directorStatus}`,
    `${t(language, "roomStatusWhispers")}: ${privateWhisperStatusLabel(props)}`,
    `${t(language, "roomFactionTitle")}: ${factionHuddleStatusLabel(props)}`,
  ];
  return { label, tone, detail: details.join("\n") };
}

function renderResizeHandles(
  onWindowAction: RoomSurfaceProps["onWindowAction"],
): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "window-resize-handles";
  layer.setAttribute("aria-hidden", "true");

  const handles: Array<[WindowResizeDirection, string]> = [
    ["North", "n"],
    ["East", "e"],
    ["South", "s"],
    ["West", "w"],
    ["NorthEast", "ne"],
    ["NorthWest", "nw"],
    ["SouthEast", "se"],
    ["SouthWest", "sw"],
  ];

  for (const [direction, position] of handles) {
    const handle = document.createElement("div");
    handle.className = "window-resize-handle";
    handle.dataset.position = position;
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      onWindowAction(`resize:${direction}`);
    });
    layer.append(handle);
  }

  return layer;
}

function renderRoleStrip(props: RoomSurfaceProps): HTMLElement {
  const strip = document.createElement("section");
  strip.className = "room-role-strip";
  strip.dataset.scrollRestore = "room-role-strip";

  strip.append(renderUserViewport(props), renderDirectorViewport(props));
  for (const participant of props.state.room.participants) {
    strip.append(renderRoleViewport(props, participant, props.state.room.lastSpeakerId === participant.id));
  }

  return strip;
}

function renderUserViewport(props: RoomSurfaceProps): HTMLElement {
  const user = props.state.room.userProfile;
  const card = document.createElement("article");
  card.className = "room-user-card";
  card.dataset.mentioned = String(isTargetHighlighted(props.state.room.highlightedTargets, { type: "user", userId: user.userId }));
  card.innerHTML = `
    <button type="button" class="room-user-art" data-room-mention="${escapeHtml(user.displayName)}">${escapeHtml(initials(user.displayName))}</button>
    <div class="room-role-copy">
      <strong>${escapeHtml(userDisplayLabel(props))}</strong>
      <span>${escapeHtml(t(props.state.language, "roomUserMember"))}</span>
      <small>${escapeHtml(roomUiText(props.state.language, "roomUserAliases").replace("{name}", user.displayName))}</small>
    </div>
  `;
  return card;
}

function renderDirectorViewport(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const director = props.state.room.director;
  const profile = getRoomDirectorProfile(director.profileId);
  const card = document.createElement("article");
  card.className = "room-director-card";
  card.dataset.enabled = String(director.enabled);
  card.dataset.mentioned = String(
    isTargetHighlighted(props.state.room.highlightedTargets, {
      type: "room_director",
      directorId: director.directorId,
    }),
  );
  card.title = `${director.displayName}\n${localizedDirectorProfileName(profile, language)}\n${
    director.enabled ? localizedDirectorProfileSummary(profile, language) : t(language, "statusOff")
  }`;
  card.innerHTML = `
      <button type="button" class="room-director-art" data-room-mention="director">D</button>
      <div class="room-role-copy">
        <strong>${escapeHtml(director.displayName)}</strong>
        <span>${escapeHtml(localizedDirectorProfileName(profile, language))}</span>
        <small>${escapeHtml(director.enabled ? roomUiText(language, "compactDirectorActive") : t(language, "statusOff"))}</small>
      </div>
  `;
  return card;
}

function renderRoleViewport(props: RoomSurfaceProps, participant: RoomParticipant, active: boolean): HTMLElement {
  const card = document.createElement("article");
  const activeChannel = getActiveRoomChannel(props.state.room);
  card.className = "room-role-card";
  card.dataset.active = String(active);
  card.dataset.state = participant.viewportState;
  card.dataset.faction = participant.factionId ?? "neutral";
  card.dataset.channelMember = String(activeChannel.type !== "faction" || participant.factionId === activeChannel.factionId);
  card.dataset.mentioned = String(isTargetHighlighted(props.state.room.highlightedTargets, { type: "role", roleId: participant.id }));
  const faction = resolveFaction(props, participant.factionId);
  const roleStatus = formatRoleApiStatus(props.state, participant, props.state.language);
  const avatarMissingSlots = roomAvatarMissingSlots(participant);
  card.title = [
    participant.name,
    `${t(props.state.language, "characterStatusPack")}: ${participant.packId}`,
    `${roomUiText(props.state.language, "mood")}: ${participant.currentEmotion}`,
    `${roomUiText(props.state.language, "team")}: ${faction.name}`,
    avatarMissingSlots.length === 0
      ? "Room avatar ready"
      : `Room avatar disabled: missing ${avatarMissingSlots.join(", ")} image`,
    roleStatus,
    participant.viewportState,
  ].join("\n");

  card.innerHTML = `
    <div class="room-role-art"></div>
    <div class="room-role-copy">
      <strong>${escapeHtml(participant.name)}</strong>
      <span><em class="room-faction-dot" style="--faction-color: ${escapeHtml(faction.color)}"></em>${escapeHtml(faction.name)}</span>
      <small>${escapeHtml(roleStatus)} · ${escapeHtml(localizedRoomSystemText(participant.viewportState, props.state.language))}</small>
    </div>
  `;

  const artHolder = card.querySelector<HTMLElement>(".room-role-art");
  if (artHolder) {
    artHolder.dataset.roomMention = participant.name;
    artHolder.title = t(props.state.language, "roomInsertMention", { name: participant.name });
    renderRoomRoleAvatarInto(artHolder, participant, participant.currentEmotion, roomViewportLabel(participant.name));
  }

  return card;
}

function renderRoomRoleAvatarInto(holder: HTMLElement, participant: RoomParticipant, emotion: string, fallbackText: string): void {
  const avatar = renderRoomRoleAvatarImage(participant, emotion, fallbackText);
  holder.replaceChildren(avatar ?? document.createTextNode(fallbackText));
  if (avatar) {
    holder.dataset.image = "true";
  } else {
    delete holder.dataset.image;
  }
}

function renderRoomRoleAvatarImage(participant: RoomParticipant, emotion: string, fallbackText: string): HTMLElement | null {
  const pack = getRoomAvatarPack(participant);
  if (!pack || !isRoomEmotionAvatarPackReady(pack)) {
    return null;
  }
  const asset = resolveRoomEmotionAvatarAsset(pack, emotion);
  const imageCandidates = asset?.candidates.filter((candidate) => candidate.kind === "image") ?? [];
  if (imageCandidates.length === 0) {
    return null;
  }
  return renderRoomAvatarImageCandidate(imageCandidates, 0, `${participant.name} ${asset?.emotion ?? emotion}`, fallbackText);
}

function renderRoomAvatarImageCandidate(
  candidates: EmotionAssetCandidate[],
  index: number,
  alt: string,
  fallbackText: string,
): HTMLElement {
  const candidate = candidates[index];
  if (!candidate || candidate.kind !== "image" || !candidate.src) {
    const fallback = document.createElement("span");
    fallback.className = "room-avatar-fallback";
    fallback.textContent = fallbackText;
    return fallback;
  }

  const image = document.createElement("img");
  image.alt = alt;
  image.src = candidate.src;
  image.addEventListener("error", () => {
    image.replaceWith(renderRoomAvatarImageCandidate(candidates, index + 1, alt, fallbackText));
  });
  return image;
}

function getRoomAvatarPack(participant: RoomParticipant) {
  try {
    return getPackManifest(participant.packId);
  } catch {
    return null;
  }
}

function roomAvatarMissingSlots(participant: RoomParticipant): string[] {
  const pack = getRoomAvatarPack(participant);
  return pack ? getMissingRoomEmotionAvatarSlots(pack) : ["idle", "happy", "sad", "angry", "surprised", "thinking"];
}

function renderRoomMain(props: RoomSurfaceProps): HTMLElement {
  const main = document.createElement("main");
  main.className = "room-surface-main";
  if (!hasVisibleRooms(props)) {
    main.append(renderRoomListRail(props), renderEmptyRoomWorkspace(props));
    return main;
  }

  const timeline = document.createElement("section");
  timeline.className = "room-surface-timeline";
  timeline.dataset.scrollRestore = "room-surface-timeline";
  timeline.append(renderTimelineHeader(props));

  const visibleMessages = filterRoomTimelineForChannel(
    props.state.room.messages,
    props.state.room,
    props.state.room.activeChannelId,
  );
  for (const message of visibleMessages) {
    const item = document.createElement("article");
    item.className = "room-surface-message";
    item.dataset.kind = message.kind;
    item.dataset.speakerType = message.speakerType ?? "";
    item.dataset.directorMove = message.directorMove ?? "";
    item.dataset.visibility = message.visibility ?? "public";
    const targetLabel = formatRoomTarget(
      message.target,
      props.state.room.userProfile,
      props.state.room.participants,
      props.state.room.director,
      { mentionStyle: "plain" },
    );
    item.innerHTML = `
      <span class="room-avatar">${escapeHtml(initials(message.speaker))}</span>
      <div>
        <header>
          <strong>${escapeHtml(message.speaker)}</strong>
          <span class="room-message-target">→ ${escapeHtml(targetLabel)}</span>
          <time>${escapeHtml(message.at)}</time>
          ${message.directorMove ? `<small>${escapeHtml(message.directorMove)}</small>` : ""}
          ${message.emotion ? `<small>${escapeHtml(message.emotion)}</small>` : ""}
        </header>
        <p>${escapeHtml(message.text)}</p>
      </div>
    `;
    const avatar = item.querySelector<HTMLElement>(".room-avatar");
    const participant =
      message.speakerType === "role" && message.speakerId
        ? props.state.room.participants.find((candidate) => candidate.id === message.speakerId)
        : undefined;
    if (avatar && participant) {
      renderRoomRoleAvatarInto(avatar, participant, message.emotion ?? participant.currentEmotion, initials(message.speaker));
    }
    timeline.append(item);
  }

  if (
    props.state.room.activeChannelId === "public" &&
    props.state.room.privateWhispers === "on" &&
    props.state.room.privateWhisperPolicy.showHiddenHint &&
    props.state.room.hiddenWhisperCount > 0
  ) {
    const hiddenNote = document.createElement("div");
    hiddenNote.className = "room-hidden-whisper-note";
    hiddenNote.textContent = t(props.state.language, "roomHiddenWhisperNote", {
      count: props.state.room.hiddenWhisperCount,
    });
    timeline.append(hiddenNote);
  }

  main.append(renderRoomListRail(props), renderRoomChannelRail(props), timeline, renderRoomControlRail(props));
  return main;
}

function renderRoomListRail(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const rail = document.createElement("nav");
  rail.className = "room-list-rail";
  rail.ariaLabel = roomUiText(language, "rooms");

  const header = document.createElement("div");
  header.className = "room-list-header";
  header.innerHTML = `<strong>${escapeHtml(roomUiText(language, "rooms"))}</strong>`;
  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "room-list-add";
  createButton.textContent = "+";
  createButton.title = roomUiText(language, "newRoom");
  createButton.addEventListener("click", () => {
    const title = window.prompt(roomUiText(language, "roomName"), nextDefaultRoomTitle(props.state.rooms));
    if (title !== null) {
      props.onAction({ type: "room.create", title });
    }
  });
  header.append(createButton);
  rail.append(header);

  for (const room of props.state.rooms) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-list-item";
    button.dataset.active = String(room.id === props.state.activeRoomId);
    button.innerHTML = `
      <span class="room-list-dot"></span>
      <span class="room-list-copy">
        <strong>${escapeHtml(room.title)}</strong>
        <small>${escapeHtml(roomListMeta(room, language))}</small>
      </span>
    `;
    button.addEventListener("click", () => props.onAction({ type: "room.switch", roomId: room.id }));
    rail.append(button);
  }

  if (props.state.rooms.length === 0) {
    const empty = document.createElement("p");
    empty.className = "room-list-empty";
    empty.textContent = roomUiText(language, "noRoomsYet", "No rooms yet");
    rail.append(empty);
    return rail;
  }

  const actions = document.createElement("div");
  actions.className = "room-list-actions";
  const rename = compactRoomAction(roomUiText(language, "rename"), () => {
    const title = window.prompt(roomUiText(language, "newRoomName"), props.state.room.title);
    if (title !== null) {
      props.onAction({ type: "room.rename", title });
    }
  });
  const duplicate = compactRoomAction(roomUiText(language, "duplicate"), () => {
    const title = window.prompt(roomUiText(language, "duplicateRoomName"), `${props.state.room.title} Copy`);
    if (title !== null) {
      const copyDirectorScript = window.confirm(
        roomUiText(
          language,
          "duplicateDirectorScriptConfirm",
          "Copy this room's Director Script? Cancel to reset the new room's Director Script.",
        ),
      );
      props.onAction({ type: "room.duplicate", title, copyDirectorScript });
    }
  });
  const remove = compactRoomAction(roomUiText(language, "delete"), () => {
    const ok = window.confirm(
      roomUiText(language, "deleteRoomConfirm").replace("{room}", props.state.room.title),
    );
    if (ok) {
      props.onAction({ type: "room.delete" });
    }
  });
  actions.append(rename, duplicate, remove);
  rail.append(actions);
  return rail;
}

function nextDefaultRoomTitle(rooms: ConsoleAppState["rooms"]): string {
  const base = "New Room";
  const existing = new Set(rooms.map((room) => room.title.trim().toLowerCase()));
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

function compactRoomAction(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "room-list-action";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function renderEmptyRoomWorkspace(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const empty = document.createElement("section");
  empty.className = "room-empty-workspace";
  const content = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = roomUiText(language, "noRoomsYet", "No rooms yet");
  const description = document.createElement("p");
  description.textContent = roomUiText(language, "createRoomToStart", "Create a room to start a clean demo workspace.");
  const createButton = document.createElement("button");
  createButton.type = "button";
  createButton.className = "room-empty-create";
  createButton.textContent = roomUiText(language, "newRoom");
  createButton.addEventListener("click", () => {
    props.onAction({ type: "room.create", title: nextDefaultRoomTitle(props.state.rooms) });
  });
  content.append(title, description, createButton);
  empty.append(content);
  return empty;
}

function hasVisibleRooms(props: RoomSurfaceProps): boolean {
  return props.state.rooms.length > 0;
}

function localizedRoomPromptProfileName(profile: ReturnType<typeof getRoomPromptProfile>, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "roomPromptProfile", profile.id, profile.name);
}

function localizedRoomPromptProfileSummary(profile: ReturnType<typeof getRoomPromptProfile>, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "roomPromptProfileSummary", profile.id, profile.summary);
}

function localizedRoomPromptProfileRule(profile: ReturnType<typeof getRoomPromptProfile>, index: number, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "roomPromptProfileRule", `${profile.id}.${index}`, profile.rules[index] ?? "");
}

function localizedSchedulerStyle(style: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "roomSchedulerStyle", style, style);
}

function localizedRoomRecipeName(recipeId: string, fallback: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "roomRecipe", recipeId, fallback);
}

function localizedDirectorProfileName(profile: ReturnType<typeof getRoomDirectorProfile>, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "directorProfile", profile.id, profile.name);
}

function localizedDirectorProfileSummary(profile: ReturnType<typeof getRoomDirectorProfile>, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "directorProfileSummary", profile.id, profile.summary);
}

function localizedRoomSystemText(text: string, language: ConsoleAppState["language"]): string {
  const replacements = [
    "The room is ready. Add characters, set a topic, then talk naturally.",
    "Keep the conversation clear, directed, and easy to continue.",
    "Room facts, scene conditions, item ownership, and hidden knowledge only change when the user explicitly @mentions the Director.",
    "Roles can only use public information, their own private @ messages, their team channel, and facts made visible to them.",
    "Director changes",
    "Knowledge visibility",
    "Light desktop companion experience",
    "No Director scene has been recorded yet.",
    "No room memory yet.",
    "no open clues yet",
    "no open clues",
    "no continuity entries",
    "calm",
    "opening",
    "local",
  ];
  let result = text;
  for (const source of replacements) {
    result = result.split(source).join(uiText(language, source));
  }
  return result;
}

function roomListMeta(room: ConsoleAppState["room"], language: ConsoleAppState["language"]): string {
  const profile = localizedRoomPromptProfileName(getRoomPromptProfile(room.promptProfileId), language);
  const flow = room.autoChat ? roomUiText(language, "running") : t(language, "statusPaused");
  return `${profile} / ${room.participants.length} ${roomUiText(language, "roles")} / ${flow}`;
}

function openRoomQuickSwitch(props: RoomSurfaceProps): void {
  const language = props.state.language;
  const existing = document.querySelector(".room-switch-overlay");
  existing?.remove();

  const overlay = document.createElement("div");
  overlay.className = "room-switch-overlay";
  const dialog = document.createElement("section");
  dialog.className = "room-switch-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-label", roomUiText(language, "switchRoom"));
  const title = document.createElement("h2");
  title.textContent = roomUiText(language, "switchRoom");
  const input = document.createElement("input");
  input.type = "search";
  input.className = "room-switch-search";
  input.placeholder = roomUiText(language, "searchRooms");
  const list = document.createElement("div");
  list.className = "room-switch-list";
  dialog.append(title, input, list);
  overlay.append(dialog);
  document.body.append(overlay);

  let selectedIndex = 0;
  const renderList = () => {
    const query = input.value.trim().toLowerCase();
    const rooms = props.state.rooms.filter((room) => room.title.toLowerCase().includes(query));
    selectedIndex = Math.min(selectedIndex, Math.max(rooms.length - 1, 0));
    list.replaceChildren();
    for (const [index, room] of rooms.entries()) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "room-switch-item";
      item.dataset.active = String(room.id === props.state.activeRoomId);
      item.dataset.selected = String(index === selectedIndex);
      item.innerHTML = `
        <strong>${escapeHtml(room.title)}</strong>
        <span>${escapeHtml(roomListMeta(room, language))}</span>
      `;
      item.addEventListener("click", () => {
        props.onAction({ type: "room.switch", roomId: room.id });
        overlay.remove();
      });
      list.append(item);
    }
  };
  const selectCurrent = () => {
    const query = input.value.trim().toLowerCase();
    const rooms = props.state.rooms.filter((room) => room.title.toLowerCase().includes(query));
    const room = rooms[selectedIndex];
    if (room) {
      props.onAction({ type: "room.switch", roomId: room.id });
      overlay.remove();
    }
  };
  input.addEventListener("input", () => {
    selectedIndex = 0;
    renderList();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      overlay.remove();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex += 1;
      renderList();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(0, selectedIndex - 1);
      renderList();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      selectCurrent();
    }
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });
  renderList();
  input.focus();
}

function renderTimelineHeader(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const channel = getActiveRoomChannel(props.state.room);
  const header = document.createElement("div");
  header.className = "room-timeline-header";
  const label = displayChannelLabel(props, channel);
  const glyph = channel.type === "private" ? "@" : channel.type === "director" ? "D" : "#";
  header.innerHTML = `
    <div>
      <h2>${escapeHtml(glyph)} ${escapeHtml(label)}</h2>
      <p>${escapeHtml(
        channel.type === "director"
          ? roomUiText(language, "directorChannelNote", "Director backstage scheduling. Roles cannot see this channel.")
          : channel.type === "faction"
          ? t(language, "roomChannelPrivate", { faction: label })
          : channel.type === "private"
            ? roomUiText(language, "privateThreadNote", `Private chat - ${label}`)
            : t(language, "roomTimelineNote"),
      )}</p>
    </div>
  `;
  return header;
}

function renderRoomChannelRail(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const rail = document.createElement("nav");
  rail.className = "room-channel-rail";
  rail.ariaLabel = t(language, "roomChannelNav");
  const channels = deriveRoomChannels(props.state.room);
  const userFactionId = props.state.room.userProfile.factionId ?? "neutral";
  const developerFreedom = props.state.room.freedomLevel === "developer";

  for (const channel of channels) {
    const label = displayChannelLabel(props, channel);
    const glyph = channel.type === "private" ? "@" : channel.type === "director" ? "D" : "#";
    const memberCount =
      channel.type === "director"
        ? 1
        : channel.type === "private"
          ? channel.memberTargets?.length ?? channel.memberRoleIds.length
          : channel.memberRoleIds.length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-channel-button";
    button.dataset.active = String(channel.id === props.state.room.activeChannelId);
    button.dataset.type = channel.type;
    const locked =
      (!developerFreedom && channel.type === "director") ||
      (!developerFreedom && channel.type === "faction" && channel.factionId !== userFactionId);
    button.disabled = locked;
    button.title = locked
      ? t(language, "roomChannelLocked")
      : channel.type === "director"
        ? roomUiText(language, "directorChannelTitle", "Director backstage")
      : channel.type === "faction"
        ? t(language, "roomChannelPrivate", { faction: label })
        : channel.type === "private"
          ? roomUiText(language, "privateThreadTitle", `Private chat - ${label}`)
        : t(language, "roomTimelineNote");
    button.innerHTML = `
      <span class="room-channel-name">${escapeHtml(glyph)} ${escapeHtml(label)}</span>
      <span class="room-channel-meta">
        ${escapeHtml(t(language, "roomChannelMembers", { count: String(memberCount) }))}
        ${
          channel.unreadCount > 0
            ? `<em class="room-channel-badge">${escapeHtml(channel.unreadCount > 99 ? "99+" : String(channel.unreadCount))}</em>`
            : ""
        }
      </span>
    `;
    button.addEventListener("click", () => {
      props.onAction({ type: "room.setActiveChannel", channelId: channel.id });
    });
    rail.append(button);
  }

  return rail;
}

function renderRoomControlRail(props: RoomSurfaceProps): HTMLElement {
  const rail = document.createElement("aside");
  rail.className = "room-control-rail room-inspector";
  rail.dataset.scrollRestore = "room-control-rail";

  rail.append(
    renderRoomInspectorStatus(props),
    renderRoomInspectorContext(props),
    renderRoomInspectorActions(props),
    renderRoomInspectorDetails(props),
  );
  return rail;
}

function renderRoomInspectorStatus(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const room = props.state.room;
  const activeChannel = getActiveRoomChannel(room);
  const scheduler = buildRoomInspectorSchedulerState(room);
  const section = document.createElement("section");
  section.className = "room-inspector-status";
  const showModelWarning = room.apiProfile.mode === "custom_room" && room.apiProfile.status !== "ready";
  section.append(
    statusPill(t(language, "roomInspectorFlow"), roomFlowModeLabel(scheduler.flowMode, language)),
    statusPill(t(language, "roomInspectorDirector"), room.director.enabled ? t(language, "statusOn") : t(language, "statusOff")),
    statusPill(t(language, "roomInspectorChannel"), displayChannelLabel(props, activeChannel)),
  );
  if (showModelWarning) {
    section.append(statusPill(t(language, "roomInspectorModel"), roomApiBadge(props)));
  }
  return section;
}
function renderRoomInspectorActions(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const director = props.state.room.director;
  const section = document.createElement("section");
  section.className = "room-inspector-section room-inspector-actions";
  section.innerHTML = `<h3>${escapeHtml(t(language, "roomInspectorActions"))}</h3>`;

  const recipe = document.createElement("label");
  recipe.className = "room-inline-field room-inspector-mode";
  recipe.innerHTML = `<span>${escapeHtml(t(language, "roomDirectorRecipe"))}</span>`;
  recipe.append(
    renderSelectControl(
      director.recipeId,
      roomRecipes.map((item) => ({ value: item.id, label: localizedRoomRecipeName(item.id, item.name, language) })),
      (recipeId) =>
        props.onAction({
          type: "room.setDirectorRecipe",
          recipeId: recipeId as ConsoleAppState["room"]["director"]["recipeId"],
        }),
      { ariaLabel: t(language, "roomDirectorRecipe"), className: "room-prompt-select" },
    ),
  );

  const freedom = renderRoomFreedomSelect(props);
  const uncertainty = renderRoomUncertaintySelect(props);
  const advancePolicy = renderRoomAdvancePolicyControl(props);
  const contextBudget = renderRoomContextBudgetControl(props);
  const autoPace = renderRoomAutoPaceControl(props);
  const speakerPolicy = renderRoomSpeakerPolicyControl(props);

  const buttons = document.createElement("div");
  buttons.className = "room-inspector-action-grid";
  const editPrompt = actionButton(t(language, "promptEdit"), () =>
    props.onAction({ type: "prompt.openRoomSet", roomId: props.state.room.id, promptType: "room" }),
  );
  editPrompt.classList.add("room-inspector-action-wide");
  buttons.append(
    actionButton(props.state.room.autoChat ? t(language, "roomPauseAuto") : t(language, "roomStartAuto"), () =>
      props.onAction({ type: "room.toggleAutoChat" }),
    ),
    actionButton(director.enabled ? t(language, "roomInspectorDirectorOff") : t(language, "roomInspectorDirectorOn"), () =>
      props.onAction({ type: "room.setDirectorEnabled", enabled: !director.enabled }),
    ),
    editPrompt,
  );

  section.append(recipe, freedom, uncertainty, advancePolicy, contextBudget, autoPace, speakerPolicy, buttons);
  return section;
}

const ROOM_ADVANCE_POLICIES: RoomAdvancePolicy[] = ["wait_for_instruction", "fill_gap", "continuous"];
const ROOM_CONTEXT_BUDGETS: RoomContextBudget[] = ["compact", "balanced", "full"];
const ROOM_AUTO_PACE_PRESETS: RoomAutoPacePreset[] = ["fast", "natural", "slow", "custom"];
const ROOM_SPEAKER_POLICIES: RoomSpeakerPolicy[] = ["balanced", "round_robin", "spotlight", "freeform"];

function renderRoomAdvancePolicyControl(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const current = props.state.room.advancePolicy ?? "fill_gap";
  const wrapper = document.createElement("div");
  wrapper.className = "room-advance-policy";
  const label = document.createElement("span");
  label.className = "room-advance-policy-label";
  label.textContent = roomUiText(language, "advancePolicy");
  const options = document.createElement("div");
  options.className = "room-advance-segmented";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", roomUiText(language, "advancePolicy"));
  for (const policy of ROOM_ADVANCE_POLICIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-advance-option";
    button.dataset.active = String(policy === current);
    button.textContent = roomAdvancePolicyLabel(policy, language);
    button.title = roomAdvancePolicyHint(policy, language);
    button.setAttribute("aria-pressed", String(policy === current));
    button.addEventListener("click", () => {
      if (policy !== current) {
        props.onAction({ type: "room.setAdvancePolicy", policy });
      }
    });
    options.append(button);
  }
  wrapper.append(label, options);
  return wrapper;
}

function renderRoomContextBudgetControl(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const current = props.state.room.contextBudget ?? "balanced";
  const wrapper = document.createElement("label");
  wrapper.className = "room-inline-field room-context-budget";
  wrapper.innerHTML = `<span>${escapeHtml(roomUiText(language, "contextBudget"))}</span>`;
  const select = renderSelectControl(
    current,
    ROOM_CONTEXT_BUDGETS.map((budget) => ({
      value: budget,
      label: roomContextBudgetLabel(budget, language),
    })),
    (budget) => props.onAction({ type: "room.setContextBudget", budget: budget as RoomContextBudget }),
    { ariaLabel: roomUiText(language, "contextBudget"), className: "room-prompt-select" },
  );
  select.title = roomUiText(language, "contextBudgetHint");
  wrapper.append(select);
  return wrapper;
}

function renderRoomAutoPaceControl(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const settings = props.state.room.autoPace ?? {
    preset: "natural" as RoomAutoPacePreset,
    minDelayMs: 3_000,
    maxDelayMs: 8_000,
    idleFillDelayMs: 12_000,
    randomize: true,
  };
  const wrapper = document.createElement("div");
  wrapper.className = "room-advance-policy room-auto-pace";
  const preset = renderSelectField(
    roomUiText(language, "autoPace"),
    settings.preset,
    ROOM_AUTO_PACE_PRESETS.map((item) => [item, roomAutoPacePresetLabel(item, language)]),
    (value) => props.onAction({ type: "room.setAutoPacePreset", preset: value as RoomAutoPacePreset }),
  );
  preset.title = roomUiText(language, "autoPaceHint");
  wrapper.append(preset);
  if (settings.preset === "custom") {
    const advanced = document.createElement("div");
    advanced.className = "room-advance-policy-advanced";
    advanced.append(
      renderNumberField(
        roomUiText(language, "autoPaceMinDelay"),
        msToSeconds(settings.minDelayMs),
        0.5,
        60,
        0.5,
        (value) => props.onAction({ type: "room.setAutoPaceNumberField", field: "minDelayMs", value: secondsToMs(value) }),
      ),
      renderNumberField(
        roomUiText(language, "autoPaceMaxDelay"),
        msToSeconds(settings.maxDelayMs),
        0.5,
        120,
        0.5,
        (value) => props.onAction({ type: "room.setAutoPaceNumberField", field: "maxDelayMs", value: secondsToMs(value) }),
      ),
      renderNumberField(
        roomUiText(language, "autoPaceIdleFill"),
        msToSeconds(settings.idleFillDelayMs),
        1,
        180,
        1,
        (value) => props.onAction({ type: "room.setAutoPaceNumberField", field: "idleFillDelayMs", value: secondsToMs(value) }),
      ),
    );
    wrapper.append(advanced);
  }
  return wrapper;
}

function renderRoomSpeakerPolicyControl(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const settings = props.state.room.speakerPolicy ?? {
    mode: "balanced" as RoomSpeakerPolicy,
    maxConsecutivePairTurns: 3,
    lurkerBoostAfterTurns: 4,
    recentSpeakerPenalty: true,
  };
  const wrapper = document.createElement("div");
  wrapper.className = "room-advance-policy room-speaker-policy";
  const label = document.createElement("span");
  label.className = "room-advance-policy-label";
  label.textContent = roomUiText(language, "speakerPolicy");
  const options = document.createElement("div");
  options.className = "room-advance-segmented";
  options.setAttribute("role", "group");
  options.setAttribute("aria-label", roomUiText(language, "speakerPolicy"));
  for (const policy of ROOM_SPEAKER_POLICIES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "room-advance-option";
    button.dataset.active = String(policy === settings.mode);
    button.textContent = roomSpeakerPolicyLabel(policy, language);
    button.title = roomSpeakerPolicyHint(policy, language);
    button.setAttribute("aria-pressed", String(policy === settings.mode));
    button.addEventListener("click", () => {
      if (policy !== settings.mode) {
        props.onAction({ type: "room.setSpeakerPolicy", policy });
      }
    });
    options.append(button);
  }
  wrapper.append(label, options);
  if (props.state.room.freedomLevel === "developer") {
    const advanced = document.createElement("div");
    advanced.className = "room-advance-policy-advanced";
    advanced.append(
      renderNumberField(
        roomUiText(language, "speakerPolicyMaxPair"),
        settings.maxConsecutivePairTurns,
        2,
        8,
        1,
        (value) =>
          props.onAction({
            type: "room.setSpeakerPolicyNumberField",
            field: "maxConsecutivePairTurns",
            value,
          }),
      ),
      renderNumberField(
        roomUiText(language, "speakerPolicyLurkerBoost"),
        settings.lurkerBoostAfterTurns,
        2,
        12,
        1,
        (value) =>
          props.onAction({
            type: "room.setSpeakerPolicyNumberField",
            field: "lurkerBoostAfterTurns",
            value,
          }),
      ),
      renderSelectField(
        roomUiText(language, "speakerPolicyRecentPenalty"),
        settings.recentSpeakerPenalty ? "on" : "off",
        [
          ["on", roomUiText(language, "speakerPolicyRecentPenaltyOn")],
          ["off", roomUiText(language, "speakerPolicyRecentPenaltyOff")],
        ],
        (value) =>
          props.onAction({
            type: "room.setSpeakerPolicyBooleanField",
            field: "recentSpeakerPenalty",
            value: value === "on",
          }),
      ),
    );
    wrapper.append(advanced);
  }
  return wrapper;
}

function renderRoomFreedomSelect(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  return renderSelectField(
    roomUiText(language, "freedom"),
    props.state.room.freedomLevel,
    [
      ["strict", freedomLevelLabel("strict", language)],
      ["balanced", freedomLevelLabel("balanced", language)],
      ["loose", freedomLevelLabel("loose", language)],
      ["developer", freedomLevelLabel("developer", language)],
    ],
    (value) =>
      props.onAction({
        type: "room.setFreedomLevel",
        freedomLevel: value as ConsoleAppState["room"]["freedomLevel"],
      }),
  );
}

function renderRoomUncertaintySelect(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  return renderSelectField(
    roomUiText(language, "uncertainty"),
    props.state.room.simulation.uncertaintyProfile,
    [
      ["stable", simulationUncertaintyProfileLabel("stable", language)],
      ["balanced", simulationUncertaintyProfileLabel("balanced", language)],
      ["volatile", simulationUncertaintyProfileLabel("volatile", language)],
      ["mystery", simulationUncertaintyProfileLabel("mystery", language)],
    ],
    (value) =>
      props.onAction({
        type: "room.setSimulationState",
        simulation: {
          uncertaintyProfile: value as ConsoleAppState["room"]["simulation"]["uncertaintyProfile"],
        },
      }),
  );
}

function renderRoomInspectorDetails(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const section = document.createElement("section");
  section.className = "room-inspector-section room-inspector-details";
  section.innerHTML = `<h3>${escapeHtml(t(language, "roomInspectorDetails"))}</h3>`;

const details: Array<{ id: RoomInspectorSection; label: string; render: () => HTMLElement }> = [
    { id: "members", label: t(language, "roomInspectorMembers"), render: () => renderFactionPanel(props) },
    { id: "room_ai", label: t(language, "roomAiConnection"), render: () => renderRoomApiPanel(props) },
    { id: "director_ai", label: t(language, "roomInspectorDirectorAi"), render: () => renderDirectorApiDetail(props) },
    { id: "packs", label: t(language, "roomInspectorPacks"), render: () => renderRoleManagement(props) },
    { id: "rules", label: t(language, "roomInspectorRules"), render: () => renderRoomRulesDetail(props) },
  ];

  for (const detail of details) {
    section.append(renderRoomInspectorDetailSection(props, detail.id, detail.label, detail.render));
  }

  return section;
}

function renderRoomInspectorDetailSection(
  props: RoomSurfaceProps,
  sectionId: RoomInspectorSection,
  label: string,
  renderContent: () => HTMLElement,
): HTMLElement {
  const expanded = props.state.room.expandedInspectorSection === sectionId;
  const wrap = document.createElement("div");
  wrap.className = "room-inspector-detail";
  wrap.dataset.expanded = String(expanded);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "room-inspector-detail-trigger";
  trigger.setAttribute("aria-expanded", String(expanded));
  trigger.innerHTML = `<span>${escapeHtml(label)}</span><i aria-hidden="true"></i>`;
  trigger.addEventListener("click", () => props.onAction({ type: "room.setExpandedInspectorSection", section: sectionId }));
  wrap.append(trigger);

  if (expanded) {
    const body = document.createElement("div");
    body.className = "room-inspector-detail-body";
    body.append(renderContent());
    wrap.append(body);
  }

  return wrap;
}

function renderDirectorApiDetail(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const director = props.state.room.director;
  const profile = getRoomDirectorProfile(director.profileId);
  const activeChannel = getActiveRoomChannel(props.state.room);
  const canShowDirectorScript = props.state.room.freedomLevel === "developer" || activeChannel.type === "director";
  const wrap = document.createElement("section");
  wrap.className = "room-control-card room-director-api-detail";
  wrap.innerHTML = `
    <header>
      <div>
        <h3>${escapeHtml(t(language, "roomDirectorApi"))}</h3>
        <p>${escapeHtml(localizedDirectorProfileSummary(profile, language))}</p>
      </div>
    </header>
  `;
  if (canShowDirectorScript) {
    wrap.append(renderDirectorScriptEntry(props));
  }
  wrap.append(renderDirectorApiControls(props));
  return wrap;
}

function renderDirectorScriptEntry(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const room = props.state.room;
  const draft = getDirectorScriptDraft(props);
  const details = document.createElement("details");
  details.className = "room-director-script-entry";
  details.open = draft.open;
  details.addEventListener("toggle", () => {
    draft.open = details.open;
  });

  const summary = document.createElement("summary");
  summary.textContent = roomUiText(language, "directorScript", "导演剧本");

  const panel = renderDirectorScriptPanel(props);
  details.append(summary, panel);
  return details;
}

function renderDirectorScriptPanel(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const room = props.state.room;
  const mode = room.director.recipeId;
  const script = getDirectorScriptDraft(props).board;
  const panel = document.createElement("section");
  panel.className = "room-director-script-panel";

  const scope = document.createElement("div");
  scope.className = "room-director-script-scope";
  scope.innerHTML = `
    <span>${escapeHtml(roomUiText(language, "directorScriptScope", "绑定范围"))}</span>
    <strong>${escapeHtml(room.title)} / ${escapeHtml(recipeName(mode, language))}</strong>
    <code>${escapeHtml(room.id)}:${escapeHtml(mode)}</code>
  `;

  panel.append(
    scope,
    renderDirectorScriptTextArea(
      roomUiText(language, "directorScriptPlotDirection", "剧情走向"),
      script.premise ?? "",
      (value) => updateDirectorScriptDraft(props, (board) => {
        board.premise = value;
      }),
    ),
    renderDirectorScriptTextArea(
      roomUiText(language, "directorScriptCurrentPhase", "当前阶段"),
      script.currentPhase ?? "",
      (value) => updateDirectorScriptDraft(props, (board) => {
        board.currentPhase = value;
      }),
      2,
    ),
    renderDirectorScriptItemGroup(props, "hiddenFacts", roomUiText(language, "directorScriptHiddenFacts", "隐藏事实")),
    renderDirectorScriptItemGroup(props, "openThreads", roomUiText(language, "directorScriptOpenThreads", "公开伏笔")),
    renderDirectorScriptItemGroup(props, "plannedBeats", roomUiText(language, "directorScriptPlannedBeats", "计划节拍")),
    renderDirectorScriptItemGroup(props, "environmentAnchors", roomUiText(language, "directorScriptEnvironmentAnchors", "环境锚点")),
    renderDirectorScriptItemGroup(props, "forbiddenReveals", roomUiText(language, "directorScriptForbiddenReveals", "禁止泄露")),
    renderDirectorScriptItemGroup(props, "continuityNotes", roomUiText(language, "directorScriptContinuityNotes", "连续性备注")),
    renderDirectorScriptDraftActions(props),
    renderDirectorScriptRevisionLog(props),
  );

  return panel;
}

function renderDirectorScriptTextArea(labelText: string, value: string, onChange: (value: string) => void, rows = 3): HTMLElement {
  const label = document.createElement("label");
  label.className = "room-inline-field room-director-script-field";
  label.innerHTML = `<span>${escapeHtml(labelText)}</span>`;

  const textarea = document.createElement("textarea");
  textarea.className = "room-director-script-textarea";
  textarea.rows = rows;
  textarea.value = value;
  textarea.addEventListener("input", () => onChange(textarea.value));
  label.append(textarea);
  return label;
}

function renderDirectorScriptItemGroup(props: RoomSurfaceProps, key: DirectorScriptItemListKey, title: string): HTMLElement {
  const language = props.state.language;
  const script = getDirectorScriptDraft(props).board;
  const items = script[key].filter((item) => item.status !== "retired");
  const group = document.createElement("section");
  group.className = "room-director-script-group";

  const header = document.createElement("header");
  const heading = document.createElement("h4");
  heading.textContent = title;
  const add = actionButton(roomUiText(language, "addDirectorScriptItem", "新增"), () => {
    updateDirectorScriptDraft(props, (board) => {
      board[key] = [...board[key], createDeveloperDirectorScriptItem("", key)];
    });
    rerenderDirectorScriptPanel(props, group);
  });
  header.append(heading, add);

  const list = document.createElement("div");
  list.className = "room-director-script-items";
  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "room-director-script-empty";
    empty.textContent = roomUiText(language, "noneYet", "暂无");
    list.append(empty);
  } else {
    for (const item of items) {
      list.append(renderDirectorScriptItemRow(props, key, item));
    }
  }

  group.append(header, list);
  return group;
}

function renderDirectorScriptItemRow(props: RoomSurfaceProps, key: DirectorScriptItemListKey, item: DirectorScriptItem): HTMLElement {
  const language = props.state.language;
  const row = document.createElement("div");
  row.className = "room-director-script-item";

  const text = document.createElement("textarea");
  text.className = "room-director-script-textarea room-director-script-item-textarea";
  text.rows = 2;
  text.value = item.text;
  text.placeholder = localizedRoomSystemText(roomUiText(language, "addDirectorScriptItem", "新增"), language);
  text.addEventListener("input", () => {
    updateDirectorScriptDraft(props, (board) => {
      board[key] = board[key].map((entry) =>
        entry.id === item.id ? { ...entry, text: text.value, updatedAt: new Date().toISOString() } : entry,
      );
    });
  });

  const meta = document.createElement("span");
  meta.textContent = `${item.status} · ${directorScriptItemSafetyLabels(item, key).join(" · ")} · ${item.updatedAt}`;

  const actions = document.createElement("div");
  actions.className = "room-director-script-actions";
  actions.append(
    actionButton(roomUiText(language, "delete", "删除"), () => {
      updateDirectorScriptDraft(props, (board) => {
        board[key] = board[key].map((entry) =>
          entry.id === item.id ? { ...entry, status: "retired" as const, updatedAt: new Date().toISOString() } : entry,
        );
      });
      rerenderDirectorScriptPanel(props, row);
    }),
  );

  row.append(text, meta, actions);
  return row;
}

function renderDirectorScriptRevisionLog(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const revisions = props.state.room.director.scriptBoard.revisionLog.slice(0, 5);
  const group = document.createElement("section");
  group.className = "room-director-script-group room-director-script-revisions";
  group.innerHTML = `<header><h4>${escapeHtml(roomUiText(language, "directorScriptRevisionLog", "修订记录"))}</h4></header>`;

  const list = document.createElement("div");
  list.className = "room-director-script-items";
  if (revisions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "room-director-script-empty";
    empty.textContent = roomUiText(language, "noneYet", "暂无");
    list.append(empty);
  } else {
    for (const revision of revisions) {
      const item = document.createElement("div");
      item.className = "room-director-script-item";
      item.innerHTML = `
        <p>${escapeHtml(localizedRoomSystemText(revision.summary, language))}</p>
        <span>${escapeHtml(revision.reason)} · ${escapeHtml(revision.createdAt)}</span>
      `;
      list.append(item);
    }
  }

  group.append(list);
  return group;
}

function renderDirectorScriptDraftActions(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const wrap = document.createElement("footer");
  wrap.className = "room-director-script-footer";

  const status = document.createElement("span");
  status.className = "room-director-script-status";
  status.textContent = getDirectorScriptDraft(props).dirty ? roomUiText(language, "directorScriptUnsaved", "未保存草稿") : "";

  const save = actionButton(roomUiText(language, "saveDirectorScript", "保存导演剧本"), () => {
    const patch = createDirectorScriptDraftPatch(props);
    if (!patch) {
      status.textContent = roomUiText(language, "noDirectorScriptChanges", "没有可保存的变更");
      return;
    }
    saveDirectorScriptDraft(props, patch);
    status.textContent = roomUiText(language, "saveDirectorScript", "保存导演剧本");
  });
  const reset = actionButton(roomUiText(language, "resetDirectorScript", "重置"), () => {
    resetDirectorScriptDraft(props);
    rerenderDirectorScriptPanel(props, wrap);
  });
  wrap.append(status, save, reset);
  return wrap;
}

function saveDirectorScriptDraft(props: RoomSurfaceProps, patch: DirectorScriptPatch): void {
  props.onAction({
    type: "room.updateDirectorScript",
    patch,
  });
  const draft = getDirectorScriptDraft(props);
  draft.board = cloneDirectorScriptBoard({ ...draft.board, ...patch });
  draft.dirty = false;
  draft.sourceStamp = directorScriptSourceStamp(draft.board);
}

function createDirectorScriptDraftPatch(props: RoomSurfaceProps): DirectorScriptPatch | null {
  const current = props.state.room.director.scriptBoard;
  const draft = getDirectorScriptDraft(props).board;
  const patch: DirectorScriptPatch = {};
  const changedKeys: string[] = [];
  if ((current.premise ?? "") !== (draft.premise ?? "")) {
    patch.premise = draft.premise;
    changedKeys.push("plot direction");
  }
  if ((current.currentPhase ?? "") !== (draft.currentPhase ?? "")) {
    patch.currentPhase = draft.currentPhase;
    changedKeys.push("phase");
  }
  for (const key of directorScriptItemListKeys) {
    const draftItems = cleanDirectorScriptDraftItems(current[key], draft[key]);
    if (directorScriptItemsStamp(current[key]) !== directorScriptItemsStamp(draftItems)) {
      patch[key] = draftItems;
      changedKeys.push(directorScriptListLabel(key));
    }
  }
  if (changedKeys.length === 0) {
    return null;
  }
  patch.revision = {
    id: `script-revision-${crypto.randomUUID()}`,
    reason: "developer_edit",
    summary: `Updated Director Script: ${changedKeys.join(", ")}`,
    before: summarizeDirectorScriptBoard(current),
    after: summarizeDirectorScriptBoard(draft),
    createdBy: "developer",
    createdAt: new Date().toISOString(),
  };
  return patch;
}

function getDirectorScriptDraft(props: RoomSurfaceProps): DirectorScriptDraftState {
  const room = props.state.room;
  const key = `${room.id}:${room.director.recipeId}`;
  const sourceStamp = directorScriptSourceStamp(room.director.scriptBoard);
  const existing = directorScriptDrafts.get(key);
  if (existing && (existing.dirty || existing.sourceStamp === sourceStamp)) {
    return existing;
  }
  const next: DirectorScriptDraftState = {
    board: cloneDirectorScriptBoard(room.director.scriptBoard),
    dirty: false,
    open: existing?.open ?? getActiveRoomChannel(room).type === "director",
    sourceStamp,
  };
  directorScriptDrafts.set(key, next);
  return next;
}

function updateDirectorScriptDraft(props: RoomSurfaceProps, update: (board: DirectorScriptBoard) => void): void {
  const draft = getDirectorScriptDraft(props);
  update(draft.board);
  draft.dirty = true;
}

function resetDirectorScriptDraft(props: RoomSurfaceProps): void {
  const room = props.state.room;
  const draft = getDirectorScriptDraft(props);
  draft.board = cloneDirectorScriptBoard(room.director.scriptBoard);
  draft.dirty = false;
  draft.sourceStamp = directorScriptSourceStamp(room.director.scriptBoard);
}

function rerenderDirectorScriptPanel(props: RoomSurfaceProps, source: HTMLElement): void {
  const entry = source.closest(".room-director-script-entry");
  const panel = entry?.querySelector(".room-director-script-panel");
  if (panel) {
    panel.replaceWith(renderDirectorScriptPanel(props));
  }
}

function cloneDirectorScriptBoard(board: DirectorScriptBoard): DirectorScriptBoard {
  return {
    premise: board.premise,
    currentPhase: board.currentPhase,
    hiddenFacts: board.hiddenFacts.map((item) => ({ ...item })),
    openThreads: board.openThreads.map((item) => ({ ...item })),
    plannedBeats: board.plannedBeats.map((item) => ({ ...item })),
    pressureSources: board.pressureSources.map((item) => ({ ...item })),
    environmentAnchors: board.environmentAnchors.map((item) => ({ ...item })),
    forbiddenReveals: board.forbiddenReveals.map((item) => ({ ...item })),
    continuityNotes: board.continuityNotes.map((item) => ({ ...item })),
    revisionLog: board.revisionLog.map((revision) => ({ ...revision })),
  };
}

function directorScriptSourceStamp(board: DirectorScriptBoard): string {
  return JSON.stringify({
    premise: board.premise ?? "",
    currentPhase: board.currentPhase ?? "",
    hiddenFacts: directorScriptItemsStamp(board.hiddenFacts),
    openThreads: directorScriptItemsStamp(board.openThreads),
    plannedBeats: directorScriptItemsStamp(board.plannedBeats),
    pressureSources: directorScriptItemsStamp(board.pressureSources),
    environmentAnchors: directorScriptItemsStamp(board.environmentAnchors),
    forbiddenReveals: directorScriptItemsStamp(board.forbiddenReveals),
    continuityNotes: directorScriptItemsStamp(board.continuityNotes),
    revision: board.revisionLog[0]?.id ?? "",
  });
}

function directorScriptItemsStamp(items: DirectorScriptItem[]): string {
  return JSON.stringify(
    items.map((item) => [
      item.id,
      item.text,
      item.status,
      item.updatedAt,
      item.createdBy,
      item.visibility,
      item.sourceVisibility,
      item.publicSafety,
      item.sourceMessageIds?.join(",") ?? "",
    ]),
  );
}

function cleanDirectorScriptDraftItems(current: DirectorScriptItem[], draft: DirectorScriptItem[]): DirectorScriptItem[] {
  const currentIds = new Set(current.map((item) => item.id));
  return draft
    .filter((item) => item.text.trim() || currentIds.has(item.id))
    .map((item) => ({ ...item, text: item.text.trim() }));
}

function directorScriptListLabel(key: DirectorScriptItemListKey): string {
  switch (key) {
    case "hiddenFacts":
      return "hidden facts";
    case "openThreads":
      return "open threads";
    case "plannedBeats":
      return "planned beats";
    case "environmentAnchors":
      return "environment anchors";
    case "forbiddenReveals":
      return "forbidden reveals";
    case "continuityNotes":
      return "continuity notes";
  }
}

function summarizeDirectorScriptBoard(board: DirectorScriptBoard): string {
  const activeCount = (items: DirectorScriptItem[]) => items.filter((item) => item.status !== "retired").length;
  return [
    `phase=${compactDirectorScriptSummaryText(board.currentPhase)}`,
    `plot=${compactDirectorScriptSummaryText(board.premise)}`,
    `hidden=${activeCount(board.hiddenFacts)}`,
    `threads=${activeCount(board.openThreads)}`,
    `beats=${activeCount(board.plannedBeats)}`,
    `anchors=${activeCount(board.environmentAnchors)}`,
  ].join("; ");
}

function compactDirectorScriptSummaryText(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "none";
  }
  return trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed;
}

function isPublicDirectorScriptList(key: DirectorScriptItemListKey): boolean {
  return key === "openThreads" || key === "plannedBeats" || key === "environmentAnchors";
}

function directorScriptItemSafetyLabels(item: DirectorScriptItem, key: DirectorScriptItemListKey): string[] {
  const safety = item.publicSafety ?? (item.createdBy === "developer" ? "developer_revealed" : undefined);
  if (safety === "developer_revealed") {
    return ["DEVELOPER REVEALED"];
  }
  if (safety === "public_safe") {
    return ["PUBLIC"];
  }
  if (safety === "private_blocked") {
    const source = item.sourceVisibility ?? item.visibility ?? "director_only";
    if (source === "faction_huddle" || item.visibility === "faction") {
      return ["FACTION BLOCKED"];
    }
    if (source === "director_channel" || source === "director_only") {
      return ["DIRECTOR ONLY"];
    }
    return ["PRIVATE BLOCKED"];
  }
  if (isPublicDirectorScriptList(key) && item.createdBy !== "developer") {
    return ["PRIVATE BLOCKED"];
  }
  return [item.visibility === "public" ? "PUBLIC" : "DIRECTOR ONLY"];
}

function createDeveloperDirectorScriptItem(text: string, key: DirectorScriptItemListKey): DirectorScriptItem {
  const now = new Date().toISOString();
  const publicList = isPublicDirectorScriptList(key);
  return {
    id: `script-${crypto.randomUUID()}`,
    text,
    status: "planned",
    visibility: publicList ? "public" : "director_only",
    sourceVisibility: publicList ? "public" : "director_only",
    publicSafety: publicList ? "developer_revealed" : "private_blocked",
    createdBy: "developer",
    updatedAt: now,
  };
}

function renderRoomRulesDetail(props: RoomSurfaceProps): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "room-rules-detail";
  wrap.append(renderRoomControls(props), renderRoomPromptControl(props));
  return wrap;
}

function renderRoomControls(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const controls = document.createElement("section");
  controls.className = "room-control-card";
  controls.innerHTML = `<h3>${escapeHtml(t(language, "roomControls"))}</h3>`;
  controls.append(
    renderTextField(t(language, "roomUserName"), props.state.room.userProfile.displayName, (value) =>
      props.onAction({ type: "room.setUserDisplayName", displayName: value }),
    ),
  );
  if (hasUserNameConflict(props)) {
    const warning = document.createElement("p");
    warning.className = "room-user-warning";
    warning.textContent = t(language, "roomUserNameConflict", { name: props.state.room.userProfile.displayName });
    controls.append(warning);
  }
  controls.append(
    actionButton(props.state.room.isOpen ? t(language, "roomClose") : t(language, "roomOpen"), () =>
      props.onAction({ type: "room.toggleOpen" }),
    ),
    actionButton(props.state.room.autoChat ? t(language, "roomPauseAuto") : t(language, "roomStartAuto"), () =>
      props.onAction({ type: "room.toggleAutoChat" }),
    ),
    actionButton(
      props.state.room.privateWhispers === "on" ? t(language, "roomWhispersTurnOff") : t(language, "roomWhispersTurnOn"),
      () =>
        props.onAction({
          type: "room.setPrivateWhispers",
          mode: props.state.room.privateWhispers === "on" ? "off" : "on",
        }),
    ),
  );
  controls.append(renderRoomGenerationControl(props));
  return controls;
}

function renderRoomGenerationControl(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const api = props.state.room.apiProfile;
  const wrap = document.createElement("div");
  wrap.className = "room-generation-control";

  const title = document.createElement("div");
  title.className = "room-generation-control-title";
  title.textContent = roomUiText(language, "roomGenerationSettings");

  const fields = document.createElement("div");
  fields.className = "room-api-fields room-generation-control-fields";
  fields.append(
    renderSelectField(roomUiText(language, "generation"), api.generationMode, [
      ["inherit_global", roomUiText(language, "roomGenerationUseGlobal")],
      ["custom", roomUiText(language, "roomGenerationCustom")],
    ], (value) => props.onAction({ type: "room.setGenerationMode", mode: value as "inherit_global" | "custom" })),
  );

  if (api.generationMode === "custom") {
    fields.append(
      renderNumberField(roomUiText(language, "temperature"), api.temperature, 0, 2, 0.1, (value) =>
        props.onAction({ type: "room.setGenerationField", field: "temperature", value }),
      ),
      renderNumberField(roomUiText(language, "maxOutput"), api.maxTokens, 128, 4096, 64, (value) =>
        props.onAction({ type: "room.setGenerationField", field: "maxTokens", value }),
      ),
    );
  }

  wrap.append(title, fields);
  return wrap;
}

function renderDirectorPanel(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const director = props.state.room.director;
  const profile = getRoomDirectorProfile(director.profileId);
  const card = document.createElement("section");
  card.className = "room-control-card room-director-panel";

  const header = document.createElement("header");
  header.innerHTML = `
    <div>
      <h3>${escapeHtml(t(language, "roomDirectorTitle"))}</h3>
      <p>${escapeHtml(localizedDirectorProfileSummary(profile, language))}</p>
    </div>
  `;
  header.append(
    actionButton(director.enabled ? t(language, "statusOn") : t(language, "statusOff"), () =>
      props.onAction({ type: "room.setDirectorEnabled", enabled: !director.enabled }),
    ),
  );

  const status = document.createElement("div");
  status.className = "room-api-status-row";
  status.append(
    statusPill(t(language, "roomDirectorRecipe"), recipeName(director.recipeId, language)),
    statusPill(t(language, "roomDirectorMove"), localizedRoomSystemText(director.lastMove ?? "idle", language)),
  );

  const recipe = renderSelectControl(
    director.recipeId,
    roomRecipes.map((item) => ({ value: item.id, label: localizedRoomRecipeName(item.id, item.name, language) })),
    (recipeId) =>
      props.onAction({
        type: "room.setDirectorRecipe",
        recipeId: recipeId as ConsoleAppState["room"]["director"]["recipeId"],
      }),
    { ariaLabel: t(language, "roomDirectorRecipe"), className: "room-prompt-select" },
  );

  const actions = document.createElement("div");
  actions.className = "room-director-actions";
  const editDirectorPrompt = actionButton(t(language, "promptEdit"), () =>
    props.onAction({ type: "prompt.openRoomSet", roomId: props.state.room.id, promptType: "director" }),
  );
  editDirectorPrompt.classList.add("room-inspector-action-wide");
  actions.append(editDirectorPrompt);

  card.append(header, status, recipe, actions, renderDirectorApiControls(props));
  return card;
}

function renderDirectorApiControls(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const api = props.state.room.director.apiProfile;
  const wrap = document.createElement("div");
  wrap.className = "room-director-api";

  const status = document.createElement("div");
  status.className = "room-api-status-row";
  status.append(
    statusPill(t(language, "roomDirectorApi"), directorApiBadge(props)),
    statusPill(t(language, "roomEffectiveModel"), resolveEffectiveDirectorModelDisplay(props.state, language).text),
    statusPill(t(language, "roomApiKey"), api.secretRef ? api.keyPreview || t(language, "statusOn") : t(language, "none")),
  );

  const fields = document.createElement("div");
  fields.className = "room-api-fields";
  fields.append(
    renderSelectField(t(language, "roomDirectorApi"), api.mode, [
      ["use_room", t(language, "roomDirectorApiModeRoom")],
      ["inherit_global", t(language, "roomDirectorApiModeGlobal")],
      ["custom_director", t(language, "roomDirectorApiModeCustom")],
      ["demo", t(language, "roomDirectorApiModeDemo")],
    ], (value) => props.onAction({ type: "room.setDirectorApiMode", mode: value as RoomDirectorApiMode })),
  );

  if (api.mode === "custom_director") {
    fields.append(
      renderTextField(t(language, "apiUrl"), api.baseUrl, (value) =>
        props.onAction({ type: "room.setDirectorApiField", field: "baseUrl", value }),
      ),
      renderSecretInput(t(language, "roomDirectorApiKey"), api.keyPreview, language, (value) =>
        props.onAction({ type: "room.setDirectorApiKeyPreview", apiKeyPreview: value }),
      ),
      renderTextField(t(language, "chatModelLabel"), api.chatModel, (value) =>
        props.onAction({ type: "room.setDirectorApiField", field: "chatModel", value }),
      ),
      renderTextField(t(language, "visionModelLabel"), api.visionModel, (value) =>
        props.onAction({ type: "room.setDirectorApiField", field: "visionModel", value }),
      ),
    );
  }

  const actions = document.createElement("div");
  actions.className = "room-api-actions";
  actions.append(
    actionButton(roomUiText(language, "openGlobalAiSettings"), () => props.onOpenConsole("ai")),
    actionButton(t(language, "roomApiTest"), () => props.onAction({ type: "room.testDirectorApi" })),
  );

  wrap.append(status, fields, renderDirectorGenerationFields(props), actions);
  return wrap;
}

function renderDirectorGenerationFields(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const api = props.state.room.director.apiProfile;
  const grid = document.createElement("div");
  grid.className = "room-api-fields room-api-advanced";
  grid.append(
    renderSelectField(roomUiText(language, "directorGeneration"), api.generationOverrideEnabled ? "custom" : "use_room", [
      ["use_room", roomUiText(language, "useRoomSettings")],
      ["custom", roomUiText(language, "customDirectorSettings")],
    ], (value) => props.onAction({ type: "room.setDirectorGenerationOverride", enabled: value === "custom" })),
  );
  if (!api.generationOverrideEnabled) {
    return grid;
  }
  grid.append(
    renderNumberField(roomUiText(language, "temperature"), api.temperature, 0, 2, 0.1, (value) =>
      props.onAction({ type: "room.setDirectorGenerationOverride", field: "temperature", value }),
    ),
    renderNumberField(roomUiText(language, "maxOutput"), api.maxTokens, 128, 4096, 64, (value) =>
      props.onAction({ type: "room.setDirectorGenerationOverride", field: "maxTokens", value }),
    ),
  );
  return grid;
}

function renderRoomInspectorContext(props: RoomSurfaceProps): HTMLElement {
  const viewModel = buildRoomContextPanel(props);
  const card = document.createElement("section");
  card.className = `room-inspector-section room-context-panel room-context-${viewModel.mode}`;
  card.innerHTML = `
    <header class="room-context-header">
      <div>
        <h3>${escapeHtml(viewModel.title)}</h3>
        <p>${escapeHtml(viewModel.description)}</p>
      </div>
      <span>${escapeHtml(viewModel.mode)}</span>
    </header>
  `;

  for (const sectionModel of viewModel.sections) {
    const section = document.createElement("div");
    section.className = "room-context-section";
    section.innerHTML = `<h4>${escapeHtml(sectionModel.title)}</h4>`;
    sectionModel.items.forEach((item, itemIndex) => {
      const row = document.createElement("div");
      row.className = `room-context-row tone-${item.tone ?? "neutral"}`;
      const label = document.createElement("span");
      label.textContent = item.label;
      const expandableKey = [
        "room-context",
        props.state.room.id,
        viewModel.mode,
        sectionModel.id,
        item.id ?? `${itemIndex}-${item.label}`,
      ].join(":");
      row.append(
        label,
        renderExpandableText({
          key: expandableKey,
          text: item.value,
          language: props.state.language,
          collapsedLines: 2,
          className: "room-context-value",
        }),
      );
      section.append(row);
    });
    card.append(section);
  }

  return card;
}

function buildRoomContextPanel(props: RoomSurfaceProps): RoomContextPanelViewModel {
  const language = props.state.language;
  const room = props.state.room;
  const scene = room.director.sceneBoard;
  const activeChannel = getActiveRoomChannel(room);
  const label = (key: string) => roomUiText(language, key);
  const collaborationMode = resolveRoomCollaborationMode(room);
  const directorModeState = buildModeInspectorState(room);
  const mode: RoomContextPanelViewModel["mode"] =
    activeChannel.type === "faction"
      ? "team"
      : room.promptProfileId === "study" || room.director.recipeId === "study"
        ? "study"
        : collaborationMode === "free_talk"
          ? "casual"
          : collaborationMode === "scene_play"
            ? room.director.recipeId === "mystery" || room.promptProfileId === "mystery"
              ? "mystery"
              : "story"
            : collaborationMode === "team_strategy"
              ? "team"
              : collaborationMode;
  const recentJudgement = localizedRoomSystemText(room.director.overrideLog.at(-1)?.summary ?? room.director.lastMove ?? "idle", language);
  const activeConstraints = room.director.constraints.filter(
    (constraint) => constraint.status === "active" || constraint.status === "needs_review",
  );
  const continuityItems = [
    ...scene.openClues.map((item) => ({ label: label("clue"), value: localizedRoomSystemText(item, language) })),
    ...room.director.overrideLog.slice(-2).map((entry) => ({ label: label("override"), value: localizedRoomSystemText(entry.summary, language) })),
  ].slice(-4);
  const situationAssessment = room.simulation.situationAssessment;
  const simulationItems = [
    {
      label: label("directorMode"),
      value: modeTitle(directorModeState.mode === "team_channel" ? "team" : directorModeState.mode, language),
    },
    { label: label("style"), value: simulationStyleLabel(room.simulation.style, language) },
    { label: label("uncertainty"), value: simulationUncertaintyProfileLabel(room.simulation.uncertaintyProfile, language) },
    { label: roomUiText(language, "advancePolicy"), value: roomAdvancePolicyLabel(room.advancePolicy ?? "fill_gap", language) },
    { label: roomUiText(language, "contextBudget"), value: roomContextBudgetLabel(room.contextBudget ?? "balanced", language) },
    { label: roomUiText(language, "speakerPolicy"), value: roomSpeakerPolicyLabel(room.speakerPolicy?.mode ?? "balanced", language) },
    ...(room.lastEngagementDecision
      ? [
          {
            label: roomUiText(language, "lastEngagementDecision"),
            value: roomEngagementDecisionLabel(room.lastEngagementDecision.kind, language),
          },
        ]
      : []),
    ...(room.lastShouldSpeakDecision
      ? [
          {
            label: roomUiText(language, "lastShouldSpeakDecision"),
            value: roomShouldSpeakDecisionLabel(room.lastShouldSpeakDecision.action, language),
          },
        ]
      : []),
    ...(room.lastContinuationAssessment
      ? [
          {
            label: roomUiText(language, "advanceBlockingNeed"),
            value: roomBlockingNeedLabel(room.lastContinuationAssessment.blockingNeed, language),
          },
        ]
      : []),
    ...(room.lastAdvanceDecision
      ? [
          {
            label: roomUiText(language, "advanceHandling"),
            value: roomAdvanceDecisionLabel(room.lastAdvanceDecision.action, language),
          },
        ]
      : []),
    ...(room.lastNoResponseReason
      ? [
          {
            label: roomUiText(language, "lastNoResponseReason"),
            value: localizedRoomSystemText(room.lastNoResponseReason, language),
          },
        ]
      : []),
    ...(room.lastFallbackAction
      ? [
          {
            label: roomUiText(language, "lastFallbackAction"),
            value: room.lastFallbackAction.summary
              ? localizedRoomSystemText(room.lastFallbackAction.summary, language)
              : localizedRoomSystemText(room.lastFallbackAction.reason, language),
          },
        ]
      : []),
    ...(room.lastPrivateInfluence
      ? [
          {
            label: roomUiText(language, "privateInfluence", "Private influence"),
            value: localizedRoomSystemText(
              room.lastPrivateInfluence.publicSafeSummary ?? room.lastPrivateInfluence.reason,
              language,
            ),
          },
        ]
      : []),
    ...((room.privateChatRequests ?? []).filter((request) => request.status === "pending").length > 0
      ? [
          {
            label: roomUiText(language, "privateChatRequests", "Private requests"),
            value: String((room.privateChatRequests ?? []).filter((request) => request.status === "pending").length),
          },
        ]
      : []),
    { label: label("phase"), value: simulationPhaseLabel(room.simulation.phase, language) },
    { label: label("tension"), value: `${room.simulation.tension}/100` },
    ...(situationAssessment
      ? [
          {
            label: roomUiText(language, "situationNextMove"),
            value: `${localizedRoomSystemText(situationAssessment.phase, language)} / ${situationNextMoveLabel(situationAssessment.nextMove, language)}`,
          },
          {
            label: roomUiText(language, "situationMaterial"),
            value: `${situationMaterialLabel(situationAssessment.materialSufficiency, language)} / ${situationConflictLabel(situationAssessment.conflictLevel, language)}`,
          },
          {
            label: roomUiText(language, "situationRisk"),
            value: `${situationRiskLabel(situationAssessment.continuityRisk, language)} / ${situationRiskLabel(situationAssessment.visibilityRisk, language)}`,
          },
          {
            label: roomUiText(language, "situationReason"),
            value: localizedRoomSystemText(situationAssessment.reason, language),
          },
        ]
      : []),
    { label: label("focus"), value: room.simulation.currentFocus ? localizedRoomSystemText(room.simulation.currentFocus, language) : label("waitingNextBeat") },
    { label: label("openHooks"), value: compactLocalizedList(room.simulation.openHooks, label("noneYet"), language) },
    { label: label("nextPressure"), value: room.simulation.nextPressure ? localizedRoomSystemText(room.simulation.nextPressure, language) : roomPlanDetail(room, language) },
    { label: label("lastRuling"), value: room.simulation.lastRuling ? localizedRoomSystemText(room.simulation.lastRuling, language) : recentJudgement },
    { label: label("stop"), value: room.lastTerminationReason ? terminationReasonLabel(room.lastTerminationReason, language) : "-" },
    ...(room.simulation.directorMemorySource
      ? [
          { label: roomUiText(language, "directorMemorySource"), value: directorMemorySourceLabel(room.simulation.directorMemorySource, language) },
          { label: roomUiText(language, "directorMemoryLoadedClaims"), value: String(room.simulation.directorMemoryLoadedClaims ?? 0) },
          { label: roomUiText(language, "directorMemoryHiddenClaims"), value: String(room.simulation.directorMemoryHiddenClaims ?? 0) },
          { label: roomUiText(language, "directorMemoryDisputedClaims"), value: String(room.simulation.directorMemoryDisputedClaims ?? 0) },
        ]
      : []),
  ];
  const publicPlotHooks = room.plot.hooks
    .filter((hook) => hook.visibility === "public" && hook.status !== "resolved")
    .map((hook) => hook.text);
  const hiddenPlotHookCount = room.plot.hooks.filter((hook) => hook.visibility === "hidden" && hook.status !== "resolved").length;
  const plotItems = [
    { label: roomUiText(language, "plotPhase"), value: plotBeatLabel(room.plot.phase, language) },
    {
      label: roomUiText(language, "plotPressure"),
      value: room.plot.currentPressure ? localizedRoomSystemText(room.plot.currentPressure, language) : label("noneYet"),
    },
    {
      label: roomUiText(language, "plotPublicHooks"),
      value: compactLocalizedList(publicPlotHooks, label("noneYet"), language),
    },
    {
      label: roomUiText(language, "plotHiddenHooks"),
      value: hiddenPlotHookCount > 0 ? String(hiddenPlotHookCount) : label("noneYet"),
    },
    {
      label: roomUiText(language, "plotUnresolved"),
      value: compactLocalizedList(room.plot.unresolved, label("noneYet"), language),
    },
    {
      label: roomUiText(language, "plotNextBeat"),
      value: room.plot.nextBeat ? localizedRoomSystemText(room.plot.nextBeat, language) : label("noneYet"),
    },
  ];
  const frameIntent = room.frame?.lastIntent;
  const frameItems = [
    {
      label: roomUiText(language, "frameUserRole"),
      value: frameIntent ? frameUserRoleLabel(frameIntent.userRole, language) : label("noneYet"),
    },
    {
      label: roomUiText(language, "frameIntent"),
      value: frameIntent ? frameIntentKindLabel(frameIntent.kind, language) : label("noneYet"),
    },
    {
      label: roomUiText(language, "frameAbsorption"),
      value: frameIntent ? frameAbsorptionLabel(frameIntent.absorption, language) : label("noneYet"),
    },
    {
      label: roomUiText(language, "frameAmbiguity"),
      value: frameIntent?.ambiguity ? situationRiskLabel(frameIntent.ambiguity, language) : label("noneYet"),
    },
    {
      label: roomUiText(language, "frameDeferred"),
      value: frameIntent?.deferredRequirements?.length
        ? frameIntent.deferredRequirements.map((requirement) => localizedRoomSystemText(requirement.summary, language)).join(" / ")
        : label("noneYet"),
    },
    {
      label: roomUiText(language, "frameRecentChange"),
      value: room.frame?.recentChange ? localizedRoomSystemText(room.frame.recentChange, language) : label("noneYet"),
    },
  ];
  const debateMotion = room.match.motion || (!/^daily chat$/i.test(room.topic.trim()) ? room.topic : "");
  const debateAssignments = formatDebateAssignments(room, language);
  const nextDebateParticipant = room.participants.find((participant) => participant.id === room.match.nextSpeakerRoleId);
  const nextDebateAssignment = getDebateSpeakerAssignment(room, nextDebateParticipant);
  const lastVerdict = room.match.lastVerdict;
  const matchItems = [
    { label: label("motion"), value: debateMotion ? localizedRoomSystemText(debateMotion, language) : label("noneYet") },
    { label: label("round"), value: String(room.match.round) },
    { label: label("currentSide"), value: room.match.currentSide ?? "-" },
    {
      label: label("nextSpeaker"),
      value: nextDebateParticipant
        ? `${nextDebateParticipant.name} / ${nextDebateAssignment ? debateSpeakerPositionLabel(nextDebateAssignment.position, language) : label("auto")}`
        : label("noneYet"),
    },
    { label: label("speakerAssignments"), value: debateAssignments || label("noneYet") },
    { label: label("score"), value: room.match.scoreboard.map((entry) => `${entry.label}: ${entry.score}`).join(" / ") || "-" },
    {
      label: roomUiText(language, "winner"),
      value: lastVerdict ? localizedRoomSystemText(lastVerdict.winnerLabel, language) : label("noneYet"),
    },
    {
      label: label("judgeNote"),
      value: lastVerdict?.summary
        ? localizedRoomSystemText(lastVerdict.summary, language)
        : room.match.judgeNotes[0]
          ? localizedRoomSystemText(room.match.judgeNotes[0], language)
          : label("noneYet"),
    },
  ];
  const collaborationPlan = room.collaborationPlan;
  const activeTasks = collaborationPlan?.tasks.filter((task) => task.status === "pending" || task.status === "active") ?? [];
  const latestHuddle = room.factionHuddleThreads.at(-1);
  const latestHuddleStrategy = collaborationPlan?.factionStrategies.find((strategy) => strategy.sourceThreadId === latestHuddle?.id);
  const showDiagnostics = room.freedomLevel === "developer" || activeChannel.type === "director";
  const directorScript = room.director.scriptBoard;
  const directorScriptItems = [
    { label: roomUiText(language, "directorScriptPhase", "Phase"), value: localizedRoomSystemText(directorScript.currentPhase ?? label("noneYet"), language) },
    { label: roomUiText(language, "directorScriptThreads", "Open threads"), value: compactLocalizedList(directorScript.openThreads.map((item) => item.text), label("noneYet"), language) },
    { label: roomUiText(language, "directorScriptBeats", "Planned beats"), value: compactLocalizedList(directorScript.plannedBeats.map((item) => item.text), label("noneYet"), language) },
    { label: roomUiText(language, "directorScriptEnvironment", "Environment anchors"), value: compactLocalizedList(directorScript.environmentAnchors.map((item) => item.text), label("noneYet"), language) },
    { label: roomUiText(language, "directorScriptHiddenFacts", "Hidden facts"), value: directorScript.hiddenFacts.filter((item) => item.status !== "retired").length ? String(directorScript.hiddenFacts.filter((item) => item.status !== "retired").length) : label("noneYet") },
    { label: roomUiText(language, "directorScriptRevisions", "Revisions"), value: directorScript.revisionLog[0]?.summary ? localizedRoomSystemText(directorScript.revisionLog[0].summary, language) : label("noneYet") },
  ];
  const collaborationItems = [
    {
      label: roomUiText(language, "factionCollaborationOpportunity"),
      value: latestHuddle?.opportunity?.reason
        ? localizedRoomSystemText(latestHuddle.opportunity.reason, language)
        : label("noneYet"),
    },
    {
      label: roomUiText(language, "factionHuddleStage"),
      value: latestHuddle ? localizedRoomSystemText(collaborationPlan?.stage ?? "huddle", language) : label("noneYet"),
    },
    {
      label: roomUiText(language, "collaborationGoal"),
      value: collaborationPlan?.objective ? localizedRoomSystemText(collaborationPlan.objective, language) : label("noneYet"),
    },
    {
      label: roomUiText(language, "collaborationTasks"),
      value: activeTasks.length
        ? activeTasks
            .slice(0, 4)
            .map((task) => {
              const role = room.participants.find((participant) => participant.id === task.roleId);
              return `${role?.name ?? task.roleId}: ${localizedRoomSystemText(task.detail, language)}`;
            })
            .join(" / ")
        : label("noneYet"),
    },
    {
      label: roomUiText(language, "collaborationNextAction"),
      value:
        latestHuddle?.publicReturnPlan || collaborationPlan?.nextPublicAction
          ? localizedRoomSystemText(latestHuddle?.publicReturnPlan ?? collaborationPlan?.nextPublicAction ?? "", language)
          : label("noneYet"),
    },
    {
      label: roomUiText(language, "factionPrivateBoundary"),
      value: latestHuddleStrategy?.privateBoundary
        ? localizedRoomSystemText(latestHuddleStrategy.privateBoundary, language)
        : label("noneYet"),
    },
    {
      label: roomUiText(language, "collaborationFactionStrategy"),
      value:
        collaborationPlan?.factionStrategies
          .slice(0, 3)
          .map((strategy) => {
            const faction = room.factions.find((item) => item.id === strategy.factionId);
            return `${faction?.name ?? strategy.factionId}: ${localizedRoomSystemText(strategy.approach, language)}`;
          })
          .join(" / ") || label("noneYet"),
    },
  ];
  const teamFaction = room.factions.find((item) => item.id === activeChannel.factionId);
  const teamMembers = room.participants.filter((participant) => participant.factionId === activeChannel.factionId);
  const teamSections: RoomContextPanelViewModel["sections"] = [
    {
      id: "team",
      title: label("channel"),
      items: [
        { label: label("team"), value: teamFaction?.name ?? activeChannel.label },
        { label: label("members"), value: teamMembers.map((item) => item.name).join(", ") || label("noRoles") },
        { label: label("goal"), value: localizedRoomSystemText(scene.goal, language) },
      ],
    },
    {
      id: "team-memory",
      title: label("teamSummary"),
      items: [
        {
          label: label("recent"),
          value: compactList(
            room.messages
              .filter((message) => message.factionId === activeChannel.factionId)
              .slice(-3)
              .map((message) => message.speaker + ": " + message.text),
            label("noTeamSummary"),
          ),
        },
      ],
    },
  ];

  const commonScene = [
    { label: label("scene"), value: localizedRoomSystemText(scene.currentScene, language) },
    { label: label("goal"), value: localizedRoomSystemText(scene.goal, language) },
    { label: label("mood"), value: localizedRoomSystemText(scene.mood, language) },
  ];

  const clueItems = [
    { label: label("openClues"), value: compactLocalizedList(scene.openClues, label("noOpenClues"), language) },
    { label: label("openQuestions"), value: compactLocalizedList(scene.unresolved, label("noOpenQuestions"), language) },
    { label: label("secrets"), value: String(room.messages.filter((message) => message.visibility === "private_ai").length) },
  ];

  const sectionsByMode: Record<string, RoomContextPanelViewModel["sections"]> = {
    casual: [
      { id: "topic", title: label("roomState"), items: [{ label: label("topic"), value: localizedRoomSystemText(room.topic, language) }, { label: label("roomFlow"), value: room.autoChat ? label("running") : label("waiting") }, { label: label("currentPlan"), value: roomPlanDetail(room, language) }] },
      { id: "memory", title: label("sharedMemory"), items: [{ label: label("recent"), value: compactList(publicRoomContextMessages(room, 3).map((message) => message.speaker + ": " + message.text), label("noSummary")) }] },
    ],
    story: [
      { id: "scene", title: label("story"), items: commonScene },
      { id: "choice", title: label("nextBeats"), items: [{ label: label("open"), value: compactLocalizedList(scene.unresolved, label("waitingNextStep"), language) }, { label: label("lastRuling"), value: recentJudgement }] },
    ],
    mystery: [
      { id: "mystery-scene", title: localizeEnum(language, "roomPromptProfile", "mystery", "Mystery"), items: commonScene.slice(0, 2) },
      { id: "clues", title: label("clues"), items: clueItems },
    ],
    debate: [
      { id: "debate", title: label("debate"), items: [{ label: label("motion"), value: debateMotion ? localizedRoomSystemText(debateMotion, language) : label("noneYet") }, { label: label("speakerAssignments"), value: debateAssignments || label("noneYet") }, { label: label("teams"), value: room.factions.filter((item) => item.id !== "neutral").map((item) => item.name).join(", ") || label("noTeams") }] },
      { id: "arguments", title: label("argumentSummary"), items: [{ label: label("recent"), value: compactList(publicRoomContextMessages(room, 3).map((message) => message.speaker + ": " + message.text), label("noArgumentSummary")) }] },
    ],
    study: [
      { id: "study", title: label("study"), items: [{ label: label("goal"), value: localizedRoomSystemText(scene.goal, language) }, { label: label("explained"), value: compactLocalizedList(scene.openClues, label("noneYet"), language) }, { label: label("review"), value: compactLocalizedList(scene.unresolved, label("noneYet"), language) }] },
    ],
    planning: [
      { id: "planning", title: label("planning"), items: [{ label: label("goal"), value: localizedRoomSystemText(scene.goal, language) }, { label: label("tasks"), value: compactLocalizedList(scene.unresolved, label("noTasks"), language) }, { label: label("risks"), value: compactLocalizedList(activeConstraints.map((item) => item.label), label("noVisibleRisks"), language) }] },
    ],
    team: teamSections,
  };
  const modeSections = sectionsByMode[mode] ?? sectionsByMode.casual;
  const needsReviewConstraints = activeConstraints.filter((constraint) => constraint.status === "needs_review");
  const publicWarningSections: RoomContextPanelViewModel["sections"] =
    !showDiagnostics && needsReviewConstraints.length > 0
      ? [
          {
            id: "conditions",
            title: label("conditions"),
            items: needsReviewConstraints.slice(0, 3).map((constraint) => ({
              label: localizedRoomSystemText(constraint.label, language),
              value: localizedRoomSystemText(constraint.detail, language),
              tone: "warning",
            })),
          },
        ]
      : [];
  const diagnosticSections: RoomContextPanelViewModel["sections"] = showDiagnostics
    ? [
        {
          id: "simulation",
          title: label("simulation"),
          items: simulationItems,
        },
        {
          id: "plot",
          title: roomUiText(language, "plotArc"),
          items: plotItems,
        },
        {
          id: "frame",
          title: roomUiText(language, "frameControl"),
          items: frameItems,
        },
        {
          id: "collaboration",
          title: roomUiText(language, "collaboration"),
          items: collaborationItems,
        },
        {
          id: "director-script",
          title: roomUiText(language, "directorScriptBoard", "Director Script"),
          items: directorScriptItems,
        },
        ...(room.simulation.style === "match"
          ? [
              {
                id: "match",
                title: label("match"),
                items: matchItems,
              },
            ]
          : []),
        {
          id: "constraints",
          title: label("conditions"),
          items: activeConstraints.slice(0, 4).map((constraint) => ({
            label: localizedRoomSystemText(constraint.label, language),
            value: localizedRoomSystemText(constraint.detail, language),
            tone: constraint.status === "needs_review" ? "warning" : "neutral",
          })),
        },
        {
          id: "continuity",
          title: label("continuity"),
          items: continuityItems.length
            ? continuityItems
            : [{ label: label("ledger"), value: label("noContinuityFacts") }],
        },
      ]
    : [];

  return {
    mode,
    title: modeTitle(mode, language),
    description: modeDescription(mode, language),
    sections: [...modeSections, ...publicWarningSections, ...diagnosticSections],
  };
}

function compactList(items: string[], fallback: string): string {
  return items.length ? items.slice(0, 3).join(" / ") : fallback;
}

function compactLocalizedList(items: string[], fallback: string, language: ConsoleAppState["language"]): string {
  return items.length ? items.slice(0, 3).map((item) => localizedRoomSystemText(item, language)).join(" / ") : fallback;
}

function roomUiText(language: ConsoleAppState["language"], key: string, fallback = key): string {
  return localizeEnum(language, "roomUi", key, fallback);
}

function frameIntentKindLabel(kind: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "frameIntentKind", kind, kind);
}

function frameUserRoleLabel(role: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "frameUserRole", role, role);
}

function frameAbsorptionLabel(absorption: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "frameAbsorption", absorption, absorption);
}

function situationNextMoveLabel(move: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "situationNextMove", move, move);
}

function situationMaterialLabel(material: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "situationMaterialSufficiency", material, material);
}

function situationConflictLabel(level: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "situationConflictLevel", level, level);
}

function situationRiskLabel(level: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "situationRiskLevel", level, level);
}

function plotBeatLabel(beat: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "plotBeat", beat, beat);
}

function directorMemorySourceLabel(source: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "directorMemorySource", source, source);
}

function modeTitle(mode: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "roomContextModeTitle", mode, localizeEnum(language, "roomContextModeTitle", "casual", "casual"));
}

function modeDescription(mode: string, language: ConsoleAppState["language"]): string {
  return localizeEnum(
    language,
    "roomContextModeDescription",
    mode,
    localizeEnum(language, "roomContextModeDescription", "casual", "casual"),
  );
}
function renderRoomApiPanel(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const card = document.createElement("section");
  card.className = "room-control-card room-api-card";
  const api = props.state.room.apiProfile;

  const header = document.createElement("header");
  header.innerHTML = `
      <div>
        <h3>${escapeHtml(t(language, "roomAiConnection"))}</h3>
        <p>${escapeHtml(api.lastTestMessage)}</p>
      </div>
  `;

  const status = document.createElement("div");
  status.className = "room-api-status-row";
  status.append(
    statusPill(t(language, "roomApiDefault"), roomApiBadge(props)),
    statusPill(t(language, "roomEffectiveModel"), resolveEffectiveRoomModelDisplay(props.state, language).text),
    statusPill(t(language, "roomApiKey"), api.secretRef ? api.keyPreview || t(language, "statusOn") : t(language, "none")),
  );

  const modeField = renderSelectField(t(language, "roomApiDefault"), api.mode, [
    ["demo", t(language, "roomApiModeDemo")],
    ["inherit_global", t(language, "roomApiModeGlobal")],
    ["custom_room", t(language, "roomApiModeCustom")],
  ], (value) => props.onAction({ type: "room.setApiMode", mode: value as RoomApiMode }));

  const basicFields = document.createElement("div");
  basicFields.className = "room-api-fields";
  basicFields.append(modeField);

  if (api.mode === "custom_room") {
    basicFields.append(
      renderTextField(t(language, "apiUrl"), api.baseUrl, (value) =>
        props.onAction({ type: "room.setApiField", field: "baseUrl", value }),
      ),
      renderSecretInput(t(language, "roomApiRoomKey"), api.keyPreview, language, (value) =>
        props.onAction({ type: "room.setApiKeyPreview", apiKeyPreview: value }),
      ),
      renderTextField(t(language, "chatModelLabel"), api.chatModel, (value) =>
        props.onAction({ type: "room.setApiField", field: "chatModel", value }),
      ),
      renderTextField(t(language, "visionModelLabel"), api.visionModel, (value) =>
        props.onAction({ type: "room.setApiField", field: "visionModel", value }),
      ),
    );
  }

  const apiActions = document.createElement("div");
  apiActions.className = "room-api-actions";
  apiActions.append(
    actionButton(roomUiText(language, "openGlobalAiSettings"), () => props.onOpenConsole("ai")),
    actionButton(t(language, "roomApiTest"), () => props.onAction({ type: "room.testApi" })),
  );

  card.append(header, status, basicFields, apiActions);

  card.append(renderRoleApiList(props));
  return card;
}

function renderRoleApiList(props: RoomSurfaceProps): HTMLElement {
  const list = document.createElement("div");
  list.className = "room-role-api-list";

  for (const participant of props.state.room.participants) {
    const row = document.createElement("article");
    row.className = "room-role-api-row";
    row.dataset.expanded = String(props.state.room.expandedApiRoleId === participant.id);

    const summary = document.createElement("header");
    summary.innerHTML = `
      <div>
        <strong>${escapeHtml(participant.name)}</strong>
        <small>${escapeHtml(participant.packId)} / ${escapeHtml(formatRoleApiStatus(props.state, participant, props.state.language))}</small>
      </div>
    `;

    const expand = actionButton(props.state.room.expandedApiRoleId === participant.id ? t(props.state.language, "roomApiRoleDone") : t(props.state.language, "roomApiRoleConfig"), () =>
      props.onAction({
        type: "room.setExpandedApiRole",
        roleId: props.state.room.expandedApiRoleId === participant.id ? null : participant.id,
      }),
    );
    summary.append(expand);
    row.append(summary);

    if (props.state.room.expandedApiRoleId === participant.id) {
      row.append(renderRoleApiEditor(props, participant));
    }

    list.append(row);
  }

  return list;
}

function renderRoleApiEditor(props: RoomSurfaceProps, participant: RoomParticipant): HTMLElement {
  const language = props.state.language;
  const editor = document.createElement("div");
  editor.className = "room-role-api-editor";
  const profile = participant.apiProfile;

  editor.append(
    renderSelectField(t(language, "roomApiRoleMode"), profile.mode, [
      ["use_room", t(language, "roomApiUseRoom")],
      ["model_override", t(language, "roomApiModelOnly")],
      ["own_profile", t(language, "roomApiOwnKey")],
    ], (value) =>
      props.onAction({
        type: "room.setRoleApiMode",
        roleId: participant.id,
        mode: value as RoleApiMode,
      }),
    ),
  );

  if (profile.mode === "own_profile") {
    editor.append(
      renderTextField(t(language, "apiUrl"), profile.baseUrl, (value) =>
        props.onAction({
          type: "room.setRoleApiOverride",
          roleId: participant.id,
          patch: { baseUrl: value },
        }),
      ),
      renderSecretInput(t(language, "roomApiRoleKey"), profile.keyPreview, language, (value) =>
        props.onAction({
          type: "room.setRoleApiOverride",
          roleId: participant.id,
          patch: { apiKeyPreview: value },
        }),
      ),
    );
  }

  if (profile.mode !== "use_room") {
    editor.append(
      renderTextField(t(language, "chatModelLabel"), profile.chatModel, (value) =>
        props.onAction({
          type: "room.setRoleApiOverride",
          roleId: participant.id,
          patch: { chatModel: value },
        }),
      ),
      renderTextField(t(language, "visionModelLabel"), profile.visionModel, (value) =>
        props.onAction({
          type: "room.setRoleApiOverride",
          roleId: participant.id,
          patch: { visionModel: value },
        }),
      ),
      actionButton(t(language, "roomApiClearOverride"), () =>
        props.onAction({ type: "room.clearRoleApiOverride", roleId: participant.id }),
      ),
    );
  }

  editor.append(renderRoleGenerationFields(props, participant));
  return editor;
}

function renderRoleGenerationFields(props: RoomSurfaceProps, participant: RoomParticipant): HTMLElement {
  const language = props.state.language;
  const profile = participant.apiProfile;
  const grid = document.createElement("div");
  grid.className = "room-api-fields room-api-advanced";
  grid.append(
    renderSelectField(roomUiText(language, "roleGeneration"), profile.generationOverrideEnabled ? "custom" : "use_room", [
      ["use_room", roomUiText(language, "useRoomSettings")],
      ["custom", roomUiText(language, "customForThisRole")],
    ], (value) =>
      props.onAction({ type: "room.setRoleGenerationOverride", roleId: participant.id, enabled: value === "custom" }),
    ),
  );
  if (!profile.generationOverrideEnabled) {
    return grid;
  }
  grid.append(
    renderNumberField(roomUiText(language, "temperature"), profile.temperature, 0, 2, 0.1, (value) =>
      props.onAction({ type: "room.setRoleGenerationOverride", roleId: participant.id, field: "temperature", value }),
    ),
    renderNumberField(roomUiText(language, "maxOutput"), profile.maxTokens, 128, 4096, 64, (value) =>
      props.onAction({ type: "room.setRoleGenerationOverride", roleId: participant.id, field: "maxTokens", value }),
    ),
  );
  return grid;
}

function renderFactionPanel(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const card = document.createElement("section");
  card.className = "room-control-card room-faction-card";
  const activeChannel = getActiveRoomChannel(props.state.room);
  const debateRoom =
    props.state.room.promptProfileId === "debate" ||
    props.state.room.director.recipeId === "debate" ||
    props.state.room.simulationObjective === "debate";
  const debatePositionOptions: { value: RoomDebateSpeakerPositionSetting; label: string }[] = [
    { value: "auto", label: roomUiText(language, "auto") },
    { value: "first_speaker", label: debateSpeakerPositionLabel("first_speaker", language) },
    { value: "second_speaker", label: debateSpeakerPositionLabel("second_speaker", language) },
    { value: "third_speaker", label: debateSpeakerPositionLabel("third_speaker", language) },
    { value: "free_speaker", label: debateSpeakerPositionLabel("free_speaker", language) },
    { value: "alternate", label: debateSpeakerPositionLabel("alternate", language) },
  ];

  const header = document.createElement("header");
  header.innerHTML = `
    <div>
      <h3>${escapeHtml(t(language, "roomFactionTitle"))}</h3>
      <p>${escapeHtml(t(language, "roomFactionDescription"))}</p>
    </div>
  `;

  const status = document.createElement("div");
  status.className = "room-api-status-row";
  status.append(
    statusPill(t(language, "roomFactionStatus"), factionHuddleStatusLabel(props)),
    statusPill(t(language, "roomChannelCurrent"), displayChannelLabel(props, activeChannel)),
    statusPill(t(language, "roomFactionMyHuddle"), resolveFaction(props, props.state.room.userProfile.factionId).name),
  );

  const toggle = actionButton(
    props.state.room.factionHuddles === "on" ? t(language, "roomFactionTurnOff") : t(language, "roomFactionTurnOn"),
    () =>
      props.onAction({
        type: "room.setFactionHuddles",
        mode: props.state.room.factionHuddles === "on" ? "off" : "on",
      }),
  );
  const factionSettings = renderFactionSettingsPanel(props);

  const list = document.createElement("div");
  list.className = "room-faction-list";

  const userRow = document.createElement("div");
  userRow.className = "room-faction-row";
  userRow.innerHTML = `<strong>${escapeHtml(userDisplayLabel(props))}</strong>`;
  const userSelect = renderSelectControl(
    props.state.room.userProfile.factionId ?? "neutral",
    props.state.room.factions.map((faction) => ({ value: faction.id, label: faction.name })),
    (value) => {
      if (value === "neutral") {
        props.onAction({ type: "room.clearUserFaction" });
        return;
      }
      props.onAction({ type: "room.setUserFaction", factionId: value });
    },
    { ariaLabel: userDisplayLabel(props), className: "room-prompt-select" },
  );
  userRow.append(userSelect);
  list.append(userRow);

  for (const participant of props.state.room.participants) {
    const row = document.createElement("div");
    row.className = debateRoom ? "room-faction-row room-faction-row-debate" : "room-faction-row";
    row.innerHTML = `<strong>${escapeHtml(participant.name)}</strong>`;
    const participantFactionId = participant.factionId ?? "neutral";
    const select = renderSelectControl(
      participantFactionId,
      props.state.room.factions.map((faction) => ({ value: faction.id, label: faction.name })),
      (value) => {
        if (value === "neutral") {
          props.onAction({ type: "room.clearRoleFaction", roleId: participant.id });
          return;
        }
        props.onAction({ type: "room.setRoleFaction", roleId: participant.id, factionId: value });
      },
      { ariaLabel: participant.name, className: "room-prompt-select" },
    );
    if (debateRoom) {
      const factionField = document.createElement("label");
      factionField.className = "room-debate-control";
      factionField.innerHTML = `<span>${escapeHtml(roomUiText(language, "team"))}</span>`;
      factionField.append(select);
      row.append(factionField);
    } else {
      row.append(select);
    }
    if (debateRoom) {
      const assignment = getDebateSpeakerAssignment(props.state.room, participant);
      const positionValue: RoomDebateSpeakerPositionSetting = assignment?.locked ? assignment.position : "auto";
      const positionDisabled = participantFactionId === "neutral";
      const positionSelect = renderSelectControl(
        positionValue,
        debatePositionOptions,
        (value) => {
          props.onAction({
            type: "room.setDebateSpeakerPosition",
            roleId: participant.id,
            position: value as RoomDebateSpeakerPositionSetting,
          });
        },
        {
          ariaLabel: `${participant.name} ${roomUiText(language, "debatePosition")}`,
          className: "room-prompt-select room-debate-position-select",
          disabled: positionDisabled,
        },
      );
      positionSelect.title = positionDisabled
        ? roomUiText(language, "chooseTeamFirst")
        : assignment
          ? describeDebateAssignment(props.state.room, assignment, language)
          : roomUiText(language, "auto");
      const positionField = document.createElement("label");
      positionField.className = "room-debate-control";
      positionField.dataset.disabled = String(positionDisabled);
      positionField.innerHTML = `<span>${escapeHtml(roomUiText(language, "debatePosition"))}</span>`;
      positionField.append(positionSelect);
      row.append(positionField);
    }
    list.append(row);
  }

  const userFactionId = props.state.room.userProfile.factionId ?? "neutral";
  const userFactionMembers = props.state.room.participants.filter((participant) => participant.factionId === userFactionId).length;
  const huddleButton = actionButton(
    activeChannel.type === "faction" ? t(language, "roomFactionCloseMine") : t(language, "roomChannelGoMine"),
    () =>
      props.onAction(
        activeChannel.type === "faction"
          ? { type: "room.closeUserFactionHuddle" }
          : { type: "room.openUserFactionChannel", factionId: userFactionId },
      ),
  );
  huddleButton.disabled = activeChannel.type !== "faction" && (userFactionId === "neutral" || userFactionMembers === 0);

  const help = document.createElement("p");
  help.className = "room-faction-help";
  help.textContent =
    userFactionId === "neutral" || userFactionMembers === 0
      ? t(language, "roomChannelMineDisabled")
      : t(language, "roomChannelMineReady", { faction: resolveFaction(props, userFactionId).name });

  card.append(header, status, toggle, factionSettings, huddleButton, help, list, renderPrivateThreadsPanel(props), renderIdentityCardsPanel(props));
  return card;
}

function renderPrivateThreadsPanel(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const room = props.state.room;
  const panel = document.createElement("section");
  panel.className = "room-private-thread-panel";

  const header = document.createElement("header");
  header.innerHTML = `
    <div>
      <h4>${escapeHtml(roomUiText(language, "privateThreads", "Private chats"))}</h4>
      <p>${escapeHtml(roomUiText(language, "privateThreadsHint", "Private chats affect the room only through Director-safe public outcomes."))}</p>
    </div>
  `;
  panel.append(header);

  const startList = document.createElement("div");
  startList.className = "room-private-thread-start-list";
  for (const participant of room.participants) {
    const button = actionButton(roomUiText(language, "privateThreadWith", `Chat with ${participant.name}`), () =>
      props.onAction({
        type: "room.createPrivateThread",
        memberTargets: [
          { type: "user", userId: room.userProfile.userId },
          { type: "role", roleId: participant.id },
        ],
        title: `${room.userProfile.displayName}, ${participant.name}`,
        createdBy: "user",
        open: true,
      }),
    );
    button.classList.add("room-private-thread-start");
    button.title = roomUiText(language, "privateThreadStartHint", "Open a private channel with this role.");
    startList.append(button);
  }
  panel.append(startList);

  const visibleThreads = (room.privateThreads ?? []).filter((thread) => isPrivateThreadVisibleInUi(props, thread));
  const threadList = document.createElement("div");
  threadList.className = "room-private-thread-list";
  if (visibleThreads.length === 0) {
    const empty = document.createElement("p");
    empty.className = "room-faction-help";
    empty.textContent = roomUiText(language, "privateThreadEmpty", "No private chats yet.");
    threadList.append(empty);
  }
  for (const thread of visibleThreads) {
    const row = document.createElement("div");
    row.className = "room-private-thread-row";
    row.dataset.archived = String(thread.status === "archived");
    const channelId = `private:${thread.id}` as const;
    const open = actionButton(thread.title, () => props.onAction({ type: "room.setActiveChannel", channelId }));
    open.classList.add("room-private-thread-open");
    open.title = privateThreadMemberNames(props, thread.memberTargets);
    const archive = actionButton(roomUiText(language, "privateThreadArchive", "Archive"), () =>
      props.onAction({ type: "room.archivePrivateThread", threadId: thread.id }),
    );
    archive.classList.add("room-private-thread-archive");
    archive.disabled = thread.status === "archived";
    row.append(open, archive);
    threadList.append(row);
  }
  panel.append(threadList);
  return panel;
}

function renderFactionSettingsPanel(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const panel = document.createElement("section");
  panel.className = "room-faction-settings";
  const header = document.createElement("header");
  header.innerHTML = `
    <div>
      <h4>${escapeHtml(roomUiText(language, "factionSettings"))}</h4>
      <p>${escapeHtml(roomUiText(language, "factionSettingsHint"))}</p>
    </div>
  `;
  const addButton = actionButton(roomUiText(language, "addFaction"), () => props.onAction({ type: "room.addFaction" }));
  addButton.title = roomUiText(language, "addFactionHint");
  header.append(addButton);
  panel.append(header);

  const list = document.createElement("div");
  list.className = "room-faction-settings-list";
  for (const faction of props.state.room.factions.filter((item) => item.id !== "neutral")) {
    const row = document.createElement("div");
    row.className = "room-faction-settings-row";
    row.style.setProperty("--faction-color", faction.color);

    const name = factionTextInput({
      label: roomUiText(language, "factionName"),
      value: faction.name,
      placeholder: roomUiText(language, "factionNamePlaceholder"),
      onCommit: (value) => props.onAction({ type: "room.updateFaction", factionId: faction.id, patch: { name: value || faction.name } }),
    });
    const publicGoal = factionTextInput({
      label: roomUiText(language, "factionPublicGoal"),
      value: faction.publicGoal ?? "",
      placeholder: roomUiText(language, "factionPublicGoalPlaceholder"),
      onCommit: (value) => props.onAction({ type: "room.updateFaction", factionId: faction.id, patch: { publicGoal: value } }),
    });
    const privateGoal = factionTextInput({
      label: roomUiText(language, "factionPrivateGoal"),
      value: faction.privateGoal ?? "",
      placeholder: roomUiText(language, "factionPrivateGoalPlaceholder"),
      onCommit: (value) => props.onAction({ type: "room.updateFaction", factionId: faction.id, patch: { privateGoal: value } }),
    });
    const color = document.createElement("input");
    color.type = "color";
    color.className = "room-faction-color";
    color.value = /^#[0-9a-f]{6}$/i.test(faction.color) ? faction.color : "#c7a7ff";
    color.title = roomUiText(language, "factionColor");
    color.addEventListener("change", () =>
      props.onAction({ type: "room.updateFaction", factionId: faction.id, patch: { color: color.value } }),
    );
    const deleteButton = actionButton(roomUiText(language, "deleteFaction"), () => {
      const confirmed = window.confirm(
        roomUiText(language, "deleteFactionConfirm"),
      );
      if (confirmed) {
        props.onAction({ type: "room.deleteFaction", factionId: faction.id });
      }
    });
    deleteButton.classList.add("room-faction-delete");
    deleteButton.title = roomUiText(language, "deleteFactionHint");

    row.append(name, publicGoal, privateGoal, color, deleteButton);
    list.append(row);
  }
  panel.append(list);
  return panel;
}

function factionTextInput(config: { label: string; value: string; placeholder: string; onCommit: (value: string) => void }): HTMLElement {
  const label = document.createElement("label");
  label.className = "room-faction-field";
  const span = document.createElement("span");
  span.textContent = config.label;
  const input = document.createElement("input");
  input.type = "text";
  input.value = config.value;
  input.placeholder = config.placeholder;
  input.title = config.value || config.placeholder;
  input.addEventListener("change", () => config.onCommit(input.value.trim()));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      input.blur();
    }
  });
  label.append(span, input);
  return label;
}

function renderIdentityCardsPanel(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const panel = document.createElement("section");
  panel.className = "room-identity-card-panel";

  const header = document.createElement("header");
  header.innerHTML = `
    <div>
      <h4>${escapeHtml(roomUiText(language, "identityCards"))}</h4>
      <p>${escapeHtml(roomUiText(language, "identityCardDescription"))}</p>
    </div>
  `;
  panel.append(header);

  if (props.state.room.participants.length === 0) {
    const empty = document.createElement("p");
    empty.className = "room-role-empty-hint";
    empty.textContent = roomUiText(language, "noRoles");
    panel.append(empty);
    return panel;
  }

  const list = document.createElement("div");
  list.className = "room-identity-card-list";
  for (const participant of props.state.room.participants) {
    list.append(renderIdentityCardEditor(props, participant));
  }
  panel.append(list);
  return panel;
}

function renderIdentityCardEditor(props: RoomSurfaceProps, participant: RoomParticipant): HTMLElement {
  const language = props.state.language;
  const card = participant.identityCard;
  const enabled = Boolean(card?.enabled);
  const expanded = props.state.room.expandedIdentityCardRoleId === participant.id;
  const summaryText =
    [card?.publicTitle, card?.publicRole, card?.publicGoal].map((value) => value?.trim()).filter(Boolean).join(" / ") ||
    (enabled ? roomUiText(language, "identityEnabled") : roomUiText(language, "identityInactiveHint"));
  const item = document.createElement("article");
  item.className = "room-identity-card-editor";
  item.dataset.enabled = String(enabled);
  item.dataset.expanded = String(expanded);

  const header = document.createElement("header");
  const summary = document.createElement("button");
  summary.type = "button";
  summary.className = "room-identity-card-summary";
  summary.dataset.expanded = String(expanded);
  summary.setAttribute("aria-expanded", String(expanded));
  summary.title = summaryText;
  summary.addEventListener("click", () =>
    props.onAction({ type: "room.setExpandedIdentityCardRole", roleId: expanded ? null : participant.id }),
  );

  const arrow = document.createElement("span");
  arrow.className = "room-identity-card-arrow";
  arrow.textContent = expanded ? "⌄" : "›";
  arrow.setAttribute("aria-hidden", "true");

  const title = document.createElement("div");
  title.className = "room-identity-card-title";
  title.innerHTML = `
    <strong>${escapeHtml(participant.name)}</strong>
    <small>${escapeHtml(summaryText)}</small>
  `;
  const status = document.createElement("span");
  status.className = "room-identity-card-status";
  status.textContent = enabled ? roomUiText(language, "identityEnabled") : roomUiText(language, "identityDisabled");
  summary.append(arrow, title, status);

  const toggle = actionButton(enabled ? roomUiText(language, "identityDisable") : roomUiText(language, "identityEnable"), () =>
    props.onAction({ type: "room.setIdentityCardEnabled", roleId: participant.id, enabled: !enabled }),
  );
  toggle.classList.add("room-identity-card-toggle");
  header.append(summary, toggle);
  item.append(header);

  if (!expanded) {
    return item;
  }

  if (!enabled) {
    const hint = document.createElement("p");
    hint.className = "room-identity-card-hint";
    hint.textContent = roomUiText(language, "identityInactiveHint");
    item.append(hint);
  }

  const updateField = (field: RoomIdentityCardField, value: string) =>
    props.onAction({ type: "room.setIdentityCardField", roleId: participant.id, field, value });
  const publicFields = document.createElement("div");
  publicFields.className = "room-identity-card-fields";
  publicFields.append(
    renderTextField(roomUiText(language, "identityPublicTitle"), card?.publicTitle ?? "", (value) => updateField("publicTitle", value)),
    renderTextField(roomUiText(language, "identityPublicRole"), card?.publicRole ?? "", (value) => updateField("publicRole", value)),
    renderTextField(roomUiText(language, "identityPublicGoal"), card?.publicGoal ?? "", (value) => updateField("publicGoal", value)),
    renderTextField(roomUiText(language, "identityPublicNotes"), card?.publicNotes ?? "", (value) => updateField("publicNotes", value)),
  );

  const privateHint = document.createElement("p");
  privateHint.className = "room-identity-card-hint";
  privateHint.textContent = roomUiText(language, "identityPrivateHint");

  const privateFields = document.createElement("div");
  privateFields.className = "room-identity-card-fields";
  privateFields.append(
    renderTextField(roomUiText(language, "identitySecretIdentity"), card?.secretIdentity ?? "", (value) => updateField("secretIdentity", value)),
    renderTextField(roomUiText(language, "identitySecretGoal"), card?.secretGoal ?? "", (value) => updateField("secretGoal", value)),
    renderTextField(roomUiText(language, "identityPrivateKnowledge"), card?.privateKnowledge ?? "", (value) => updateField("privateKnowledge", value)),
    renderTextField(roomUiText(language, "identityRevealCondition"), card?.revealCondition ?? "", (value) => updateField("revealCondition", value)),
  );

  const actions = document.createElement("div");
  actions.className = "room-api-actions";
  actions.append(
    actionButton(roomUiText(language, "identityRestoreTemplate"), () =>
      props.onAction({ type: "room.restoreIdentityCardTemplate", roleId: participant.id }),
    ),
  );

  item.append(publicFields, privateHint, privateFields, actions);
  return item;
}

function renderRoleManagement(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const roles = document.createElement("section");
  roles.className = "room-control-card";
  roles.innerHTML = `<h3>${escapeHtml(t(language, "roomRolesTitle"))}</h3>`;

  const list = document.createElement("div");
  list.className = "room-role-config-list";
  for (const participant of props.state.room.participants) {
    const item = document.createElement("article");
    item.className = "room-role-config";
    item.innerHTML = `
      <header>
        <strong>${escapeHtml(participant.name)}</strong>
        <small>${escapeHtml(participant.currentEmotion)}</small>
      </header>
    `;

    const actions = document.createElement("div");
    actions.className = "room-role-config-actions";
    const removeButton = actionButton(t(language, "roomRemoveRole"), () =>
      props.onAction({ type: "room.removeRole", roleId: participant.id }),
    );
    removeButton.classList.add("room-role-remove-button");
    removeButton.disabled = props.state.room.participants.length <= 1;
    actions.append(removeButton);
    item.append(actions);
    list.append(item);
  }

  const addRow = document.createElement("div");
  addRow.className = "room-role-add-row";
  const packOptions = props.state.packs.map((pack) => ({ value: pack.id, label: pack.name }));
  let selectedPackId = packOptions.some((option) => option.value === props.state.selectedPackId)
    ? props.state.selectedPackId
    : packOptions[0]?.value ?? "";

  const addSelect = renderSelectControl(
    selectedPackId,
    packOptions,
    (value) => {
      selectedPackId = value;
    },
    {
      ariaLabel: t(language, "roomAddRoleSelect"),
      className: "room-role-add-select",
      disabled: packOptions.length === 0,
    },
  );

  const addButton = actionButton(t(language, "roomAddRole"), () => {
    if (selectedPackId) {
      props.onAction({ type: "room.addRole", packId: selectedPackId });
    }
  });
  addButton.disabled = packOptions.length === 0;
  addRow.append(addSelect, addButton);

  if (packOptions.length === 0) {
    const emptyHint = document.createElement("p");
    emptyHint.className = "room-role-empty-hint";
    emptyHint.textContent = t(language, "roomAddRoleEmpty");
    addRow.append(emptyHint);
  }

  roles.append(list, addRow);
  return roles;
}

function recipeName(recipeId: ConsoleAppState["room"]["director"]["recipeId"], language: ConsoleAppState["language"]): string {
  const recipe = roomRecipes.find((item) => item.id === recipeId);
  return localizedRoomRecipeName(recipeId, recipe?.name ?? recipeId, language);
}

function renderRoomPromptControl(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const card = document.createElement("section");
  card.className = "room-control-card room-prompt-card";
  const activeProfile = getRoomPromptProfile(props.state.room.promptProfileId);

  const header = document.createElement("header");
  header.innerHTML = `
    <div>
      <h3>${escapeHtml(t(language, "roomPromptTitle"))}</h3>
      <p>${escapeHtml(localizedRoomPromptProfileSummary(activeProfile, language))}</p>
    </div>
  `;

  const select = renderSelectControl(
    props.state.room.promptProfileId,
    roomPromptProfiles.map((profile) => ({ value: profile.id, label: localizedRoomPromptProfileName(profile, language) })),
    (profileId) =>
      props.onAction({
        type: "room.selectPromptProfile",
        profileId: profileId as ConsoleAppState["room"]["promptProfileId"],
      }),
    { ariaLabel: t(language, "roomPromptTitle"), className: "room-prompt-select" },
  );

  const details = document.createElement("ul");
  for (const [index] of activeProfile.rules.entries()) {
    const item = document.createElement("li");
    item.textContent = localizedRoomPromptProfileRule(activeProfile, index, language);
    details.append(item);
  }

  const style = document.createElement("p");
  style.className = "room-prompt-style";
  style.textContent = t(language, "roomPromptScheduler", { style: localizedSchedulerStyle(activeProfile.schedulerStyle, language) });

  const actions = document.createElement("div");
  actions.className = "room-api-actions";
  actions.append(
    actionButton(t(language, "promptEdit"), () =>
      props.onAction({ type: "prompt.openRoomSet", roomId: props.state.room.id, promptType: "room" }),
    ),
  );

  card.append(header, select, details, style, actions);
  return card;
}

function renderRoomInput(props: RoomSurfaceProps): HTMLElement {
  const language = props.state.language;
  const row = document.createElement("form");
  row.className = "room-input-row";

  const prompt = document.createElement("span");
  prompt.className = "prompt";
  prompt.textContent = `${roomPromptChannel(props)} ~ >`;

  const wrap = document.createElement("div");
  wrap.className = "console-input-wrap";

  const input = document.createElement("input");
  input.className = "console-input";
  input.placeholder = roomInputPlaceholder(props);
  input.autocomplete = "off";
  input.value = props.inputDraft;

  let historyIndex = -1;
  let suggestions: CommandSuggestion[] = [];
  let suggestionIndex = 0;
  let mentionSuggestions: Array<{ label: string; insert: string; detail: string }> = [];
  let mentionIndex = 0;
  let isComposing = false;
  const addressHint = document.createElement("span");
  addressHint.className = "room-address-hint";
  addressHint.textContent = initialAddressHint(props);

  const pickCommandSuggestion = (command: string) => {
    applyCommandSuggestion(input, command);
    props.onInputDraftChange(input.value, input.selectionStart, input.selectionEnd);
    suggestions = [];
    wrap.querySelector(".command-suggestions")?.remove();
    updateAddressHint(row, input.value, props);
  };
  const commandSuggestionsForDraft = (draft: string): CommandSuggestion[] => {
    const trimmed = draft.trim();
    const isCompletedExactCommand = /\s$/.test(draft) && props.router.definitions().some((item) => item.command === trimmed);
    return isCompletedExactCommand ? [] : props.router.suggestions(draft);
  };

  input.addEventListener("input", () => {
    props.onInputDraftChange(input.value, input.selectionStart, input.selectionEnd);
    updateAddressHint(row, input.value, props);
    if (isComposing) {
      return;
    }
    if (input.value.startsWith("/")) {
      suggestions = commandSuggestionsForDraft(input.value);
      suggestionIndex = 0;
      mentionSuggestions = [];
      renderSuggestions(wrap, suggestions, suggestionIndex, language, pickCommandSuggestion);
      return;
    }

    suggestions = [];
    mentionSuggestions = roomMentionSuggestions(input.value, props);
    mentionIndex = 0;
    renderMentionSuggestions(wrap, mentionSuggestions, mentionIndex, input, props);
  });
  input.addEventListener("focus", () => props.onInputFocusChange(true));
  input.addEventListener("blur", () => props.onInputFocusChange(false));
  input.addEventListener("compositionstart", () => {
    isComposing = true;
    props.onInputCompositionChange(true, input.value, input.selectionStart, input.selectionEnd);
  });
  input.addEventListener("compositionend", () => {
    isComposing = false;
    props.onInputCompositionChange(false, input.value, input.selectionStart, input.selectionEnd);
    props.onInputDraftChange(input.value, input.selectionStart, input.selectionEnd);
    updateAddressHint(row, input.value, props);
    mentionSuggestions = input.value.startsWith("/") ? [] : roomMentionSuggestions(input.value, props);
    mentionIndex = 0;
    renderMentionSuggestions(wrap, mentionSuggestions, mentionIndex, input, props);
  });

  input.addEventListener("keydown", (event) => {
    if (isComposing || event.isComposing) {
      return;
    }
    if ((event.key === "PageDown" || event.key === "PageUp") && suggestions.length > 0) {
      event.preventDefault();
      const pageStep = 5;
      suggestionIndex =
        event.key === "PageDown"
          ? Math.min(suggestionIndex + pageStep, suggestions.length - 1)
          : Math.max(suggestionIndex - pageStep, 0);
      renderSuggestions(wrap, suggestions, suggestionIndex, language, pickCommandSuggestion);
      return;
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && suggestions.length > 0) {
      event.preventDefault();
      suggestionIndex =
        event.key === "ArrowDown"
          ? (suggestionIndex + 1) % suggestions.length
          : (suggestionIndex - 1 + suggestions.length) % suggestions.length;
      renderSuggestions(wrap, suggestions, suggestionIndex, language, pickCommandSuggestion);
      return;
    }

    if ((event.key === "Tab" || event.key === "Enter") && suggestions[suggestionIndex]) {
      event.preventDefault();
      pickCommandSuggestion(suggestions[suggestionIndex].command);
      return;
    }

    if ((event.key === "PageDown" || event.key === "PageUp") && mentionSuggestions.length > 0) {
      event.preventDefault();
      const pageStep = 5;
      mentionIndex =
        event.key === "PageDown"
          ? Math.min(mentionIndex + pageStep, mentionSuggestions.length - 1)
          : Math.max(mentionIndex - pageStep, 0);
      renderMentionSuggestions(wrap, mentionSuggestions, mentionIndex, input, props);
      return;
    }

    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && mentionSuggestions.length > 0) {
      event.preventDefault();
      mentionIndex =
        event.key === "ArrowDown"
          ? (mentionIndex + 1) % mentionSuggestions.length
          : (mentionIndex - 1 + mentionSuggestions.length) % mentionSuggestions.length;
      renderMentionSuggestions(wrap, mentionSuggestions, mentionIndex, input, props);
      return;
    }

    if ((event.key === "Tab" || event.key === "Enter") && mentionSuggestions[mentionIndex]) {
      event.preventDefault();
      applyMentionSuggestion(input, mentionSuggestions[mentionIndex].insert);
      props.onInputDraftChange(input.value, input.selectionStart, input.selectionEnd);
      mentionSuggestions = roomMentionSuggestions(input.value, props);
      mentionIndex = 0;
      renderMentionSuggestions(wrap, mentionSuggestions, mentionIndex, input, props);
      updateAddressHint(row, input.value, props);
      return;
    }

    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.isComposing
    ) {
      event.preventDefault();
      row.requestSubmit();
      return;
    }

    if (event.key === "Escape") {
      suggestions = [];
      mentionSuggestions = [];
      wrap.querySelector(".command-suggestions")?.remove();
      return;
    }

    if (event.key === "ArrowUp" && props.commandHistory.length > 0) {
      event.preventDefault();
      historyIndex = Math.min(historyIndex + 1, props.commandHistory.length - 1);
      input.value = props.commandHistory[historyIndex] ?? "";
      props.onInputDraftChange(input.value, input.selectionStart, input.selectionEnd);
      return;
    }

    if (event.key === "ArrowDown" && props.commandHistory.length > 0) {
      event.preventDefault();
      historyIndex = Math.max(historyIndex - 1, -1);
      input.value = historyIndex === -1 ? "" : props.commandHistory[historyIndex] ?? "";
      props.onInputDraftChange(input.value, input.selectionStart, input.selectionEnd);
    }
  });

  row.addEventListener("submit", (event) => {
    event.preventDefault();
    if (isComposing) {
      return;
    }
    const value = input.value.trim();
    if (value) {
      input.value = "";
      props.onInputDraftChange("", 0, 0);
      updateAddressHint(row, input.value, props);
      wrap.querySelector(".command-suggestions")?.remove();
      props.onSubmitInput(value);
      window.setTimeout(() => input.focus(), 0);
    }
  });

  wrap.append(input);
  row.append(prompt, wrap, addressHint);
  updateAddressHint(row, input.value, props);
  return row;
}

function userDisplayLabel(props: RoomSurfaceProps): string {
  const name = props.state.room.userProfile.displayName;
  return hasUserNameConflict(props) ? `${name} (you)` : name;
}

function hasUserNameConflict(props: RoomSurfaceProps): boolean {
  const userName = props.state.room.userProfile.displayName.trim().toLowerCase();
  return props.state.room.participants.some((participant) => participant.name.trim().toLowerCase() === userName);
}

function isTargetHighlighted(targets: RoomMentionTarget[], target: RoomMentionTarget): boolean {
  if (target.type === "user") {
    return targets.some((item) => item.type === "user" && item.userId === target.userId);
  }
  if (target.type === "room_director") {
    return targets.some((item) => item.type === "room_director" && item.directorId === target.directorId);
  }
  return targets.some((item) => item.type === "role" && item.roleId === target.roleId);
}

function insertMention(input: HTMLInputElement, displayName: string) {
  const cursor = input.selectionStart ?? input.value.length;
  const before = input.value.slice(0, cursor);
  const after = input.value.slice(cursor);
  const prefix = before.length > 0 && !/\s$/.test(before) ? " " : "";
  const mention = `${prefix}@${displayName} `;
  input.value = `${before}${mention}${after}`;
  const nextCursor = before.length + mention.length;
  input.setSelectionRange(nextCursor, nextCursor);
  input.focus();
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function updateAddressHint(root: ParentNode, value: string, props: RoomSurfaceProps) {
  const hint = root.querySelector<HTMLElement>(".room-address-hint");
  if (!hint) {
    return;
  }
  const addressing = parseRoomMentions(
    value,
    props.state.room.participants,
    props.state.room.userProfile,
    props.state.room.director,
  );
  const target = formatRoomTarget(
    addressing.target,
    props.state.room.userProfile,
    props.state.room.participants,
    props.state.room.director,
    { mentionStyle: "plain" },
  );
  const channel = getActiveRoomChannel(props.state.room);
  const forcePublic = /(^|\s)@all(?=$|\s|[,.!?;:，。！？；：])/i.test(value);
  const language = props.state.language;
  if (hasRoomDirectorMention(value, props.state.room.director) || isTargetingDirector(addressing.target)) {
    hint.textContent = t(language, "roomAddressDirectorBackstage");
    return;
  }
  const roleTargets = targetRoleIds(addressing.target);
  if (channel.type === "public" && roleTargets.length > 0) {
    hint.textContent = t(language, "roomAddressPublicRoleMention", { target });
    return;
  }
  hint.textContent =
    channel.type === "faction" && addressing.target === "all" && !forcePublic
      ? t(props.state.language, "roomAddressChannel", { faction: displayChannelLabel(props, channel) })
      : addressing.target === "all"
        ? t(props.state.language, "roomAddressAll")
        : t(props.state.language, "roomAddressTo", { target });
}

function roomMentionSuggestions(value: string, props: RoomSurfaceProps): Array<{ label: string; insert: string; detail: string }> {
  const query = currentMentionQuery(value);
  if (query === null) {
    return [];
  }

  const entries = [
    {
      label: `@${props.state.room.userProfile.displayName}`,
      insert: props.state.room.userProfile.displayName,
      detail: t(props.state.language, "roomUserMember"),
    },
    {
      label: "@director",
      insert: "director",
      detail: t(props.state.language, "roomDirectorTitle"),
    },
    { label: "@all", insert: "all", detail: t(props.state.language, "roomAddressBroadcast") },
    ...props.state.room.participants.map((participant) => ({
      label: `@${participant.name}`,
      insert: participant.name,
      detail: participant.packId,
    })),
  ];
  const normalizedQuery = query.toLowerCase();
  return entries.filter((entry) => entry.label.toLowerCase().includes(`@${normalizedQuery}`));
}

function currentMentionQuery(value: string): string | null {
  const match = value.match(/(^|\s)@([^\s@]*)$/);
  return match ? match[2] ?? "" : null;
}

function applyMentionSuggestion(input: HTMLInputElement, displayName: string) {
  const replaced = input.value.replace(/(^|\s)@[^\s@]*$/, `$1@${displayName} `);
  input.value = replaced === input.value ? `${input.value}${input.value.endsWith(" ") ? "" : " "}@${displayName} ` : replaced;
  input.focus();
}

function renderMentionSuggestions(
  wrap: HTMLElement,
  suggestions: Array<{ label: string; insert: string; detail: string }>,
  activeIndex: number,
  input: HTMLInputElement,
  props: RoomSurfaceProps,
) {
  wrap.querySelector(".command-suggestions")?.remove();
  if (suggestions.length === 0) {
    return;
  }

  const list = document.createElement("div");
  list.className = "command-suggestions mention-suggestions";
  for (const [index, suggestion] of suggestions.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.active = String(index === activeIndex);
    button.innerHTML = `
      <code>${escapeHtml(suggestion.label)}</code>
      <span>${escapeHtml(suggestion.detail)}</span>
      <small>@</small>
    `;
    button.addEventListener("click", () => {
      applyMentionSuggestion(input, suggestion.insert);
      props.onInputDraftChange(input.value, input.selectionStart, input.selectionEnd);
      updateAddressHint(wrap.closest(".room-input-row") ?? wrap, input.value, props);
      list.remove();
      input.focus();
    });
    list.append(button);
  }
  wrap.append(list);
}

function renderSelectField(
  labelText: string,
  value: string,
  entries: Array<[string, string]>,
  onChange: (value: string) => void,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "room-inline-field";
  label.innerHTML = `<span>${escapeHtml(labelText)}</span>`;

  label.append(
    renderSelectControl(
      value,
      entries.map(([entryValue, text]) => ({ value: entryValue, label: text })),
      onChange,
      { ariaLabel: labelText },
    ),
  );
  return label;
}

function renderTextField(labelText: string, value: string, onChange: (value: string) => void): HTMLElement {
  const label = document.createElement("label");
  label.className = "room-inline-field";
  label.innerHTML = `<span>${escapeHtml(labelText)}</span>`;

  const input = document.createElement("input");
  input.value = value;
  input.autocomplete = "off";
  input.addEventListener("change", () => onChange(input.value.trim()));

  label.append(input);
  return label;
}

function renderNumberField(
  labelText: string,
  value: number,
  min: number,
  max: number,
  step: number,
  onChange: (value: number) => void,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "room-inline-field";
  label.innerHTML = `<span>${escapeHtml(labelText)}</span>`;

  const input = document.createElement("input");
  input.type = "number";
  input.value = String(value);
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.addEventListener("change", () => onChange(Number(input.value)));

  label.append(input);
  return label;
}

function msToSeconds(value: number): number {
  return Math.round((value / 1000) * 10) / 10;
}

function secondsToMs(value: number): number {
  return Math.round(value * 1000);
}

function renderSecretInput(
  labelText: string,
  preview: string,
  language: ConsoleAppState["language"],
  onChange: (value: string) => void,
): HTMLElement {
  const label = document.createElement("label");
  label.className = "room-inline-field";
  label.innerHTML = `<span>${escapeHtml(labelText)}</span>`;

  const input = document.createElement("input");
  input.type = "password";
  input.autocomplete = "off";
  input.placeholder = preview ? t(language, "roomSecretSaved", { preview }) : t(language, "roomSecretPaste");
  input.addEventListener("change", () => onChange(input.value));

  label.append(input);
  return label;
}

function renderSuggestions(
  wrap: HTMLElement,
  suggestions: CommandSuggestion[],
  activeIndex: number,
  language: ConsoleAppState["language"] = "en",
  onPick: (command: string) => void,
) {
  wrap.querySelector(".command-suggestions")?.remove();
  if (suggestions.length === 0) {
    return;
  }

  const list = document.createElement("div");
  list.className = "command-suggestions";
  for (const [index, suggestion] of suggestions.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.active = String(index === activeIndex);
    button.innerHTML = `
      <code>${escapeHtml(suggestion.command)}</code>
      <span>${escapeHtml(commandDescription(language, suggestion.command, suggestion.description))}</span>
      <small>${escapeHtml(categoryLabel(language, suggestion.category))}</small>
    `;
    button.addEventListener("click", () => {
      onPick(suggestion.command);
    });
    list.append(button);
  }
  wrap.append(list);
}

function applyCommandSuggestion(input: HTMLInputElement, command: string): void {
  const value = `${command} `;
  input.value = value;
  input.setSelectionRange(value.length, value.length);
  input.focus();
}

function roomApiBadge(props: RoomSurfaceProps): string {
  const language = props.state.language;
  const api = props.state.room.apiProfile;
  if (api.mode === "demo") {
    return t(language, "roomApiBadgeDemo");
  }
  if (api.mode === "inherit_global") {
    return props.state.ai.connectionStatus === "ready" ? t(language, "roomApiBadgeGlobal") : t(language, "roomApiBadgeDemo");
  }
  if (api.status === "ready") {
    return t(language, "roomApiBadgeRoom");
  }
  return api.status === "missing_key" ? t(language, "roomApiMissingKey") : api.status.replace("_", " ");
}

function directorApiBadge(props: RoomSurfaceProps): string {
  const language = props.state.language;
  const api = props.state.room.director.apiProfile;
  if (api.mode === "demo") {
    return t(language, "roomDirectorApiBadgeLocal");
  }
  if (api.mode === "use_room") {
    return `${t(language, "roomDirectorApiBadgeRoom")} / ${roomApiStatusText(api.status, language)}`;
  }
  if (api.mode === "inherit_global") {
    return props.state.ai.connectionStatus === "ready"
      ? t(language, "roomApiBadgeGlobal")
      : `${t(language, "roomApiBadgeGlobal")} / ${t(language, "roomApiMissingKey")}`;
  }
  if (api.status === "ready") {
    return t(language, "roomDirectorApiBadgeOwn");
  }
  return api.status === "missing_key" ? t(language, "roomApiMissingKey") : api.status.replace("_", " ");
}

interface EffectiveModelDisplay {
  source: string;
  model: string;
  text: string;
}

function resolveEffectiveRoomModelDisplay(
  state: ConsoleAppState,
  language: ConsoleAppState["language"],
): EffectiveModelDisplay {
  if (state.ai.localChatModel.enabled || state.room.apiProfile.mode === "demo") {
    return effectiveModelDisplay(t(language, "roomModelSourceLocal"), localChatModelDisplayName(state, language));
  }
  if (state.room.apiProfile.mode === "custom_room") {
    return effectiveModelDisplay(t(language, "roomModelSourceRoom"), configuredModelName(state.room.apiProfile.chatModel, language));
  }
  return effectiveModelDisplay(t(language, "roomModelSourceGlobal"), configuredModelName(state.ai.chatModel, language));
}

function resolveEffectiveDirectorModelDisplay(
  state: ConsoleAppState,
  language: ConsoleAppState["language"],
): EffectiveModelDisplay {
  const api = state.room.director.apiProfile;
  if (state.ai.localChatModel.enabled || api.mode === "demo") {
    return effectiveModelDisplay(t(language, "roomModelSourceLocal"), localChatModelDisplayName(state, language));
  }
  if (api.mode === "custom_director") {
    return effectiveModelDisplay(t(language, "roomModelSourceDirector"), configuredModelName(api.chatModel, language));
  }
  if (api.mode === "inherit_global") {
    return effectiveModelDisplay(t(language, "roomModelSourceGlobal"), configuredModelName(state.ai.chatModel, language));
  }
  return effectiveModelDisplay(t(language, "roomModelSourceRoom"), resolveEffectiveRoomModelDisplay(state, language).model);
}

function resolveEffectiveRoleModelDisplay(
  state: ConsoleAppState,
  participant: RoomParticipant,
  language: ConsoleAppState["language"],
): EffectiveModelDisplay {
  const api = participant.apiProfile;
  if (state.ai.localChatModel.enabled) {
    return effectiveModelDisplay(t(language, "roomModelSourceLocal"), localChatModelDisplayName(state, language));
  }
  if (api.mode === "use_room") {
    return effectiveModelDisplay(t(language, "roomModelSourceRoom"), resolveEffectiveRoomModelDisplay(state, language).model);
  }
  if (api.mode === "model_override") {
    return effectiveModelDisplay(t(language, "roomModelSourceRoleModel"), configuredModelName(api.chatModel, language));
  }
  return effectiveModelDisplay(t(language, "roomModelSourceRoleKey"), configuredModelName(api.chatModel, language));
}

function localChatModelDisplayName(state: ConsoleAppState, language: ConsoleAppState["language"]): string {
  const local = state.ai.localChatModel;
  const selectedModelId = local.selectedModelId ?? local.modelId ?? local.manifest?.id ?? "";
  const selectedModel = local.availableModels.find((model) => model.id === selectedModelId) ?? local.manifest;
  return selectedModel?.displayName || selectedModel?.id || selectedModelId || t(language, "localModelTitle");
}

function configuredModelName(value: string, language: ConsoleAppState["language"]): string {
  return value.trim() || t(language, "notConfigured");
}

function effectiveModelDisplay(source: string, model: string): EffectiveModelDisplay {
  return {
    source,
    model,
    text: `${source} · ${model}`,
  };
}

function formatRoleApiStatus(
  state: ConsoleAppState,
  participant: RoomParticipant,
  language: ConsoleAppState["language"],
): string {
  const effectiveModel = resolveEffectiveRoleModelDisplay(state, participant, language).text;
  const status = roomApiStatusText(participant.apiProfile.status, language);
  if (participant.apiProfile.mode === "use_room") {
    return `${effectiveModel} / ${status}`;
  }
  return `${effectiveModel} / ${status}`;
}

function roomApiStatusText(status: string, language: ConsoleAppState["language"]): string {
  if (status === "missing_key") {
    return t(language, "roomApiMissingKey");
  }
  if (status === "ready") {
    return t(language, "statusOn");
  }
  if (status === "demo") {
    return t(language, "roomApiBadgeDemo");
  }
  return status.replace("_", " ");
}

function autoSpeechCopy(props: RoomSurfaceProps): string {
  const language = props.state.language;
  const { autoSpeechState, autoSpeechPolicy, speed } = props.state.room;
  const delaySeconds = Math.round(autoSpeechPolicy.speedDelaysMs[speed] / 1000);
  const status = autoSpeechStatusLabel(props);
  return `${status}, ${roomUiText(language, "every")} ${delaySeconds}s, ${roomUiText(language, "guard")} ${autoSpeechState.userTriggeredFollowUps}/${autoSpeechPolicy.maxUserTriggeredFollowUps} · ${autoSpeechState.consecutiveAutoTurns}/${autoSpeechPolicy.maxIdleBurstTurns}`;
}

function autoSpeechStatusLabel(props: RoomSurfaceProps): string {
  const language = props.state.language;
  const room = props.state.room;
  if (room.isOpen && room.autoChat && room.advancePolicy === "continuous" && room.autoSpeechState.status === "waiting_user") {
    return t(language, "roomAutoRunning");
  }
  switch (room.autoSpeechState.status) {
    case "running":
      return t(language, "roomAutoRunning");
    case "waiting_user":
      return t(language, "roomAutoWaiting");
    case "cooling_down":
      if (room.isOpen && room.autoChat && room.advancePolicy === "continuous") {
        const nextTurnAt = room.autoSpeechState.nextTurnAt;
        return typeof nextTurnAt === "number" && nextTurnAt > Date.now()
          ? t(language, "roomAutoCooling")
          : t(language, "roomAutoRunning");
      }
      return t(language, "roomAutoCooling");
    case "blocked":
      return t(language, "roomAutoLimited");
    default:
      return t(language, "roomAutoPaused");
  }
}

function privateWhisperStatusLabel(props: RoomSurfaceProps): string {
  return props.state.room.privateWhispers === "on"
    ? t(props.state.language, "roomWhispersOn")
    : t(props.state.language, "roomWhispersOff");
}

function factionHuddleStatusLabel(props: RoomSurfaceProps): string {
  return props.state.room.factionHuddles === "on"
    ? t(props.state.language, "roomFactionOn")
    : t(props.state.language, "roomFactionOff");
}

function initialAddressHint(props: RoomSurfaceProps): string {
  const channel = getActiveRoomChannel(props.state.room);
  if (channel.type === "faction") {
    return t(props.state.language, "roomAddressChannel", { faction: displayChannelLabel(props, channel) });
  }
  if (channel.type === "private") {
    return roomUiText(props.state.language, "privateThreadInputHint", `Private chat - ${displayChannelLabel(props, channel)}`);
  }
  return t(props.state.language, "roomAddressPublicMentionHelp");
}

function roomPromptChannel(props: RoomSurfaceProps): string {
  const channel = getActiveRoomChannel(props.state.room);
  if (channel.type === "faction" && channel.factionId) {
    return `room#${channel.factionId}`;
  }
  if (channel.type === "private" && channel.threadId) {
    return `room@${channel.threadId}`;
  }
  return "room#public";
}

function roomInputPlaceholder(props: RoomSurfaceProps): string {
  const room = props.state.room;
  if (!room.autoChat) {
    return roomUiText(props.state.language, "sayOrAtRole");
  }
  if (room.simulation.playerIntervention === "pause_on_choice" && room.lastTerminationReason === "director_choice") {
    return roomUiText(props.state.language, "waitingChoice");
  }
  return roomUiText(props.state.language, "watchOrJumpIn");
}

function displayChannelLabel(props: RoomSurfaceProps, channel: ReturnType<typeof getActiveRoomChannel>): string {
  return channel.type === "public" ? t(props.state.language, "roomChannelPublic") : channel.label;
}

function isPrivateThreadVisibleInUi(
  props: RoomSurfaceProps,
  thread: NonNullable<ConsoleAppState["room"]["privateThreads"]>[number],
): boolean {
  return (
    thread.status === "active" &&
    (props.state.room.freedomLevel === "developer" ||
      thread.memberTargets.some((target) => target.type === "user" && target.userId === props.state.room.userProfile.userId))
  );
}

function privateThreadMemberNames(props: RoomSurfaceProps, targets: RoomMentionTarget[]): string {
  return targets
    .map((target) => {
      if (target.type === "user") {
        return props.state.room.userProfile.displayName;
      }
      if (target.type === "room_director") {
        return props.state.room.director.displayName;
      }
      return props.state.room.participants.find((participant) => participant.id === target.roleId)?.name ?? target.roleId;
    })
    .join(", ");
}

function collaborationModeLabel(mode: ReturnType<typeof resolveRoomCollaborationMode>, language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "roomCollaborationMode", mode, mode);
}

function roomFlowModeLabel(mode: ConsoleAppState["room"]["flowMode"], language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "roomFlowMode", mode, mode);
}

function freedomLevelLabel(level: ConsoleAppState["room"]["freedomLevel"], language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "roomFreedomLevel", level, level);
}

function simulationObjectiveLabel(objective: ConsoleAppState["room"]["simulationObjective"], language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "simulationObjective", objective, objective);
}

function simulationStyleLabel(style: ConsoleAppState["room"]["simulation"]["style"], language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "simulationStyle", style, style);
}

function simulationUncertaintyProfileLabel(
  profile: ConsoleAppState["room"]["simulation"]["uncertaintyProfile"],
  language: ConsoleAppState["language"],
): string {
  return localizeEnum(language, "simulationUncertaintyProfile", profile, localizeEnum(language, "simulationUncertaintyProfile", "balanced", "balanced"));
}

function roomAdvancePolicyLabel(policy: RoomAdvancePolicy, language: ConsoleAppState["language"]): string {
  return roomUiText(language, `advancePolicy_${policy}`);
}

function roomContextBudgetLabel(budget: RoomContextBudget, language: ConsoleAppState["language"]): string {
  return roomUiText(language, `contextBudget_${budget}`);
}

function roomAdvancePolicyHint(policy: RoomAdvancePolicy, language: ConsoleAppState["language"]): string {
  return roomUiText(language, `advancePolicy_${policy}_hint`);
}

function roomAutoPacePresetLabel(preset: RoomAutoPacePreset, language: ConsoleAppState["language"]): string {
  return roomUiText(language, `autoPace_${preset}`);
}

function roomSpeakerPolicyLabel(policy: RoomSpeakerPolicy, language: ConsoleAppState["language"]): string {
  return roomUiText(language, `speakerPolicy_${policy}`);
}

function roomSpeakerPolicyHint(policy: RoomSpeakerPolicy, language: ConsoleAppState["language"]): string {
  return roomUiText(language, `speakerPolicy_${policy}_hint`);
}

function roomBlockingNeedLabel(blockingNeed: RoomBlockingNeed, language: ConsoleAppState["language"]): string {
  return roomUiText(language, `blocking_${blockingNeed}`);
}

function roomAdvanceDecisionLabel(decision: RoomAdvanceDecision["action"], language: ConsoleAppState["language"]): string {
  return roomUiText(language, `advanceDecision_${decision}`);
}

function roomEngagementDecisionLabel(decision: RoomEngagementDecisionKind, language: ConsoleAppState["language"]): string {
  return roomUiText(language, `engagement_${decision}`);
}

function roomShouldSpeakDecisionLabel(decision: RoomShouldSpeakAction, language: ConsoleAppState["language"]): string {
  return roomUiText(language, `shouldSpeak_${decision}`);
}

function simulationPhaseLabel(phase: ConsoleAppState["room"]["simulation"]["phase"], language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "simulationPhase", phase, phase);
}

function floorOwnerLabel(room: ConsoleAppState["room"], language: ConsoleAppState["language"]): string {
  const owner = room.floorOwner;
  if (owner.type === "role") {
    return room.participants.find((participant) => participant.id === owner.roleId)?.name ?? owner.roleId;
  }
  if (owner.type === "user") {
    return room.userProfile.displayName;
  }
  if (owner.type === "director") {
    return t(language, "roomDirectorTitle");
  }
  if (owner.type === "channel") {
    return owner.channelId.replace("faction:", "#");
  }
  return roomUiText(language, "none");
}

function roomPlanLabel(room: ConsoleAppState["room"], language: ConsoleAppState["language"]): string {
  const plan = room.activeDiscussionPlan;
  if (!plan || plan.status !== "running") {
    return roomUiText(language, "none");
  }
  const current = plan.turns[plan.activeTurnIndex];
  const next = plan.turns[plan.activeTurnIndex + 1];
  const currentName = current ? plannedSpeakerName(room, current.speakerId) : roomUiText(language, "unknown");
  const nextName = next ? plannedSpeakerName(room, next.speakerId) : null;
  return nextName
    ? `${currentName} ${plan.activeTurnIndex + 1}/${plan.turns.length} / ${roomUiText(language, "next")} ${nextName}`
    : `${currentName} ${plan.activeTurnIndex + 1}/${plan.turns.length}`;
}

function roomPlanDetail(room: ConsoleAppState["room"], language: ConsoleAppState["language"]): string {
  const plan = room.activeDiscussionPlan;
  const continuousFlowActive = room.isOpen && room.autoChat && room.advancePolicy === "continuous";
  if (continuousFlowActive && !shouldShowStructuredRoomPlan(room)) {
    return roomFlowDisplayText(room, language);
  }
  if (!plan) {
    if (room.autoChat) {
      return roomFlowDisplayText(room, language);
    }
    return room.lastTerminationReason ? terminationReasonLabel(room.lastTerminationReason, language) : roomUiText(language, "waitingInput");
  }
  if (plan.status !== "running") {
    if (continuousFlowActive && !isHardContinuousUiStopReason(plan.lastStopReason)) {
      return roomUiText(language, "autoWaitingNextTurn");
    }
    return plan.lastStopReason
      ? `${roomUiText(language, "stopped")} / ${terminationReasonLabel(plan.lastStopReason, language)}`
      : roomUiText(language, "completed");
  }
  const current = plan.turns[plan.activeTurnIndex];
  const next = plan.turns[plan.activeTurnIndex + 1];
  const currentName = current ? plannedSpeakerName(room, current.speakerId) : roomUiText(language, "unknown");
  const nextName = next ? plannedSpeakerName(room, next.speakerId) : roomUiText(language, "none");
  return `${currentName} ${plan.activeTurnIndex + 1}/${plan.turns.length} / ${roomUiText(language, "next")} ${nextName}`;
}

function shouldShowStructuredRoomPlan(room: ConsoleAppState["room"]): boolean {
  return isStrictDebateFlow(room) && room.activeDiscussionPlan?.status === "running";
}

function roomFlowDisplayText(room: ConsoleAppState["room"], language: ConsoleAppState["language"]): string {
  if (!room.autoChat) {
    return room.lastTerminationReason ? terminationReasonLabel(room.lastTerminationReason, language) : roomUiText(language, "waitingInput");
  }
  switch (room.autoSpeechState.status) {
    case "running":
      return t(language, "roomAutoRunning");
    case "cooling_down": {
      const nextTurnAt = room.autoSpeechState.nextTurnAt;
      return typeof nextTurnAt === "number" && nextTurnAt > Date.now()
        ? roomUiText(language, "autoWaitingNextTurn")
        : t(language, "roomAutoRunning");
    }
    case "blocked":
      return isHardContinuousUiStopReason(room.autoSpeechState.lastReason)
        ? t(language, "roomAutoLimited")
        : t(language, "roomAutoRunning");
    case "waiting_user":
      return room.advancePolicy === "continuous" ? t(language, "roomAutoRunning") : t(language, "roomAutoWaiting");
    default:
      return t(language, "roomAutoRunning");
  }
}

function isHardContinuousUiStopReason(reason: string | null | undefined): boolean {
  return reason === "model_unavailable" || reason === "private_leak_blocked" || reason === "budget_limit";
}

function terminationReasonLabel(reason: ConsoleAppState["room"]["lastTerminationReason"], language: ConsoleAppState["language"]): string {
  if (!reason) {
    return localizeEnum(language, "terminationReason", "none", roomUiText(language, "waitingInput"));
  }
  return localizeEnum(language, "terminationReason", reason, reason);
}

function plannedSpeakerName(room: ConsoleAppState["room"], speakerId: string): string {
  if (speakerId === room.director.directorId) {
    return room.director.displayName;
  }
  return room.participants.find((participant) => participant.id === speakerId)?.name ?? speakerId;
}

function turnPhaseLabel(phase: ConsoleAppState["room"]["turnPhase"], language: ConsoleAppState["language"]): string {
  return localizeEnum(language, "turnPhase", phase, phase);
}
function resolveFaction(props: RoomSurfaceProps, factionId = "neutral") {
  return (
    props.state.room.factions.find((faction) => faction.id === factionId) ??
    props.state.room.factions.find((faction) => faction.id === "neutral") ?? {
      id: "neutral",
      name: "Neutral",
      color: "#8c96a3",
    }
  );
}

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "console-action";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
}

interface SelectControlOption {
  value: string;
  label: string;
}

function renderSelectControl(
  value: string,
  options: SelectControlOption[],
  onChange: (value: string) => void,
  config: { ariaLabel?: string; className?: string; disabled?: boolean } = {},
): HTMLElement {
  const root = document.createElement("div");
  root.className = ["select-control", config.className].filter(Boolean).join(" ");
  root.dataset.disabled = String(Boolean(config.disabled) || options.length === 0);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.disabled = Boolean(config.disabled) || options.length === 0;
  if (config.ariaLabel) {
    trigger.ariaLabel = config.ariaLabel;
  }

  let selectedValue = options.some((optionItem) => optionItem.value === value) ? value : options[0]?.value ?? "";
  let menu: HTMLElement | null = null;
  let outsideHandler: ((event: PointerEvent) => void) | null = null;
  let keyHandler: ((event: KeyboardEvent) => void) | null = null;
  let cleanupViewportListeners: (() => void) | null = null;

  const selectedLabel = () => options.find((optionItem) => optionItem.value === selectedValue)?.label ?? selectedValue;
  const syncTrigger = () => {
    const label = selectedLabel();
    trigger.innerHTML = `<span>${escapeHtml(label)}</span><i aria-hidden="true"></i>`;
    trigger.title = label;
  };
  const closeMenu = () => {
    trigger.setAttribute("aria-expanded", "false");
    root.dataset.open = "false";
    menu?.remove();
    menu = null;
    if (outsideHandler) {
      document.removeEventListener("pointerdown", outsideHandler, true);
      outsideHandler = null;
    }
    if (keyHandler) {
      document.removeEventListener("keydown", keyHandler, true);
      keyHandler = null;
    }
    if (cleanupViewportListeners) {
      cleanupViewportListeners();
      cleanupViewportListeners = null;
    }
  };
  const positionMenu = () => {
    if (!menu) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    const boundary = selectMenuBoundary(trigger);
    if (rect.width <= 0 || rect.height <= 0 || rect.bottom < boundary.top || rect.top > boundary.bottom) {
      closeMenu();
      return;
    }
    const gap = 6;
    const margin = 8;
    const maxHeight = Math.max(80, Math.min(260, boundary.height - margin * 2));
    const menuHeight = Math.min(maxHeight, Math.max(80, menu.scrollHeight || maxHeight));
    const menuWidth = Math.min(Math.max(140, rect.width), Math.max(140, boundary.width - margin * 2));
    const below = boundary.bottom - rect.bottom;
    const above = rect.top - boundary.top;
    const openAbove = below < Math.min(170, menuHeight + gap) && above > below;
    const rawTop = openAbove ? rect.top - menuHeight - gap : rect.bottom + gap;
    const minTop = boundary.top + margin;
    const maxTop = boundary.bottom - menuHeight - margin;
    const minLeft = boundary.left + margin;
    const maxLeft = boundary.right - menuWidth - margin;
    menu.style.left = `${clampNumber(rect.left, minLeft, Math.max(minLeft, maxLeft))}px`;
    menu.style.top = `${clampNumber(rawTop, minTop, Math.max(minTop, maxTop))}px`;
    menu.style.width = `${menuWidth}px`;
    menu.style.maxHeight = `${maxHeight}px`;
  };
  const openMenu = () => {
    if (trigger.disabled) {
      return;
    }
    closeMenu();
    menu = document.createElement("div");
    menu.className = "select-menu";
    menu.setAttribute("data-select-floating", "true");
    menu.setAttribute("role", "listbox");
    menu.setAttribute("aria-label", config.ariaLabel ?? "");

    for (const optionItem of options) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "select-option";
      item.setAttribute("role", "option");
      item.dataset.selected = String(optionItem.value === selectedValue);
      item.setAttribute("aria-selected", String(optionItem.value === selectedValue));
      item.innerHTML = `<span>${escapeHtml(optionItem.label)}</span>`;
      item.addEventListener("click", () => {
        const changed = optionItem.value !== selectedValue;
        selectedValue = optionItem.value;
        syncTrigger();
        closeMenu();
        if (changed) {
          onChange(optionItem.value);
        }
      });
      menu.append(item);
    }

    document.body.append(menu);
    root.dataset.open = "true";
    trigger.setAttribute("aria-expanded", "true");
    positionMenu();
    menu.querySelector<HTMLElement>('[data-selected="true"]')?.focus();

    outsideHandler = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (!root.contains(target) && !menu?.contains(target)) {
        closeMenu();
      }
    };
    keyHandler = (event) => {
      if (event.key === "Escape") {
        closeMenu();
        trigger.focus();
      }
    };
    cleanupViewportListeners = bindSelectMenuViewportListeners(trigger, () => {
      if (!menu || !trigger.isConnected) {
        closeMenu();
        return;
      }
      positionMenu();
    });
    document.addEventListener("pointerdown", outsideHandler, true);
    document.addEventListener("keydown", keyHandler, true);
  };

  syncTrigger();
  trigger.addEventListener("click", () => {
    if (menu) {
      closeMenu();
    } else {
      openMenu();
    }
  });
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openMenu();
    }
  });

  root.append(trigger);
  return root;
}

function selectMenuBoundary(anchor: HTMLElement): DOMRect {
  const viewport = new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const scrollParent = closestScrollableAncestor(anchor);
  if (!scrollParent) {
    return viewport;
  }
  const parentRect = scrollParent.getBoundingClientRect();
  const left = Math.max(viewport.left, parentRect.left);
  const top = Math.max(viewport.top, parentRect.top);
  const right = Math.min(viewport.right, parentRect.right);
  const bottom = Math.min(viewport.bottom, parentRect.bottom);
  return new DOMRect(left, top, Math.max(0, right - left), Math.max(0, bottom - top));
}

function closestScrollableAncestor(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    const overflow = `${style.overflow}${style.overflowY}${style.overflowX}`;
    if (/(auto|scroll|overlay)/.test(overflow) && (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth)) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function bindSelectMenuViewportListeners(anchor: HTMLElement, onChange: () => void): () => void {
  const targets: EventTarget[] = [window];
  let parent = anchor.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = window.getComputedStyle(parent);
    if (/(auto|scroll|overlay)/.test(`${style.overflow}${style.overflowY}${style.overflowX}`)) {
      targets.push(parent);
    }
    parent = parent.parentElement;
  }
  for (const target of targets) {
    target.addEventListener("resize", onChange, true);
    target.addEventListener("scroll", onChange, true);
  }
  return () => {
    for (const target of targets) {
      target.removeEventListener("resize", onChange, true);
      target.removeEventListener("scroll", onChange, true);
    }
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function statusPill(label: string, value: string): HTMLElement {
  const pill = document.createElement("span");
  pill.className = "status-pill";
  pill.innerHTML = `<span>${escapeHtml(label)}</span><small>${escapeHtml(value)}</small>`;
  return pill;
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function roomViewportLabel(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) {
    return "?";
  }
  const chars = Array.from(clean);
  const hasHan = chars.some((char) => /\p{Script=Han}/u.test(char));
  if (hasHan) {
    return chars.length <= 3 ? clean : chars[0] ?? "?";
  }
  return clean.length <= 6 ? clean : (chars[0] ?? "?").toUpperCase();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

