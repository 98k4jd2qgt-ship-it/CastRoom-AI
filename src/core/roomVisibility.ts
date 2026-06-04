import type {
  ConsoleMessage,
  RoomAddressing,
  RoomActiveChannelId,
  RoomChannel,
  RoomFactionHuddleThread,
  RoomMention,
  RoomMentionTarget,
  RoomMessageTarget,
  RoomParticipant,
  RoomPrivateThread,
  RoomState,
  RoomUserProfile,
} from "./types";

const ROOM_MENTION_BOUNDARY = String.raw`(?=$|[\s,\uFF0C.\u3002!\uFF01?\uFF1F:\uFF1A;\uFF1B])`;

export type ReplyChannelDecision =
  | {
      action: "same_private_thread";
      channelId: `private:${string}`;
      visibleTo: RoomMentionTarget[];
      reason: string;
    }
  | {
      action: "same_faction_channel";
      channelId: `faction:${string}`;
      factionId: string;
      visibleTo: RoomMentionTarget[];
      reason: string;
    }
  | { action: "public_safe_summary"; reason: string }
  | { action: "public_action"; reason: string }
  | { action: "public"; reason: string }
  | { action: "blocked"; reason: string };

export function parseRoomMentions(
  text: string,
  participants: RoomParticipant[],
  userProfile: RoomUserProfile,
  director: RoomState["director"] | null = null,
): RoomAddressing {
  const mentions: RoomMention[] = [];
  const seenTargets = new Set<string>();
  const hasAllMention = new RegExp(String.raw`(^|\s)@all${ROOM_MENTION_BOUNDARY}`, "i").test(text);
  const candidates = mentionCandidates(participants, userProfile, director);

  for (const candidate of candidates) {
    if (!candidate.name.trim()) {
      continue;
    }

    const pattern = new RegExp(`(^|\\s)@${escapeRegExp(candidate.name)}${ROOM_MENTION_BOUNDARY}`, "i");
    const match = text.match(pattern);
    if (!match) {
      continue;
    }

    const targetKey = mentionTargetKey(candidate.target);
    if (seenTargets.has(targetKey)) {
      continue;
    }

    seenTargets.add(targetKey);
    mentions.push({
      raw: `@${candidate.name}`,
      target: candidate.target,
      displayName: candidate.displayName,
    });
  }

  if (mentions.length === 0 || hasAllMention) {
    return { target: "all", mentions: [], isBroadcast: true };
  }

  return {
    target: { targets: mentions.map((mention) => mention.target) },
    mentions,
    isBroadcast: false,
  };
}

export function formatRoomTarget(
  target: RoomMessageTarget | undefined,
  userProfile: RoomUserProfile,
  participants: RoomParticipant[],
  director: RoomState["director"] | null = null,
): string {
  if (!target || target === "all" || target.targets.length === 0) {
    return "All";
  }

  return target.targets
    .map((item) => {
      if (item.type === "user") {
        return `@${userProfile.displayName}`;
      }
      if (item.type === "room_director") {
        return `@${director?.displayName ?? "Director"}`;
      }
      const role = participants.find((participant) => participant.id === item.roleId);
      return `@${role?.name ?? item.roleId}`;
    })
    .join(" ");
}

export function isTargetingUser(target: RoomMessageTarget | undefined, userProfile: RoomUserProfile): boolean {
  return target !== undefined && target !== "all" && target.targets.some((item) => item.type === "user" && item.userId === userProfile.userId);
}

export function isTargetingDirector(target: RoomMessageTarget | undefined): boolean {
  return target !== undefined && target !== "all" && target.targets.some((item) => item.type === "room_director");
}

export function resolveRoomMessageVisibility(
  message: ConsoleMessage,
  room: RoomState,
): Pick<ConsoleMessage, "visibility" | "visibleTo" | "privateReason"> {
  if (message.visibility === "faction_huddle") {
    return {
      visibility: "faction_huddle",
      visibleTo: message.visibleTo ?? [],
      privateReason: "faction_huddle",
    };
  }

  if (message.visibility === "private_ai") {
    return {
      visibility: "private_ai",
      visibleTo: message.visibleTo ?? privateVisibleTargets(message),
      privateReason: message.privateReason ?? "ai_to_ai_mention",
    };
  }

  if (message.visibility === "private_thread") {
    const thread = message.channelId ? privateThreadForChannel(room, message.channelId) : null;
    return {
      visibility: "private_thread",
      visibleTo: message.visibleTo ?? (thread ? privateThreadVisibleTargets(thread) : []),
      privateReason: "private_thread",
    };
  }

  if (room.privateWhispers !== "on" || !isAiSpeaker(message) || !isRoleOnlyTarget(message.target)) {
    return { visibility: "public", visibleTo: undefined, privateReason: undefined };
  }

  return {
    visibility: "private_ai",
    visibleTo: privateVisibleTargets(message),
    privateReason: message.speakerType === "room_system" ? "system_directed" : "ai_to_ai_mention",
  };
}

export function resolveReplyChannelDecision(input: {
  room: RoomState;
  triggerMessage?: ConsoleMessage | null;
  draftMessage?: ConsoleMessage | null;
}): ReplyChannelDecision {
  const draft = input.draftMessage;
  const trigger = input.triggerMessage;

  const draftPrivateThreadId = draft?.channelId ? privateThreadIdFromChannel(draft.channelId) : null;
  if (draft?.visibility === "private_thread" && draftPrivateThreadId) {
    const thread = privateThreadForChannel(input.room, `private:${draftPrivateThreadId}`);
    return thread
      ? {
          action: "same_private_thread",
          channelId: `private:${thread.id}`,
          visibleTo: privateThreadVisibleTargets(thread),
          reason: "draft_private_thread",
        }
      : { action: "blocked", reason: "draft_private_thread_missing" };
  }

  const draftFactionId = draft?.channelId ? factionIdFromChannel(draft.channelId) : draft ? resolveMessageFactionId(draft) : null;
  if (draft?.visibility === "faction_huddle" && draftFactionId) {
    return {
      action: "same_faction_channel",
      channelId: `faction:${draftFactionId}`,
      factionId: draftFactionId,
      visibleTo: factionChannelVisibleTargets(input.room, draftFactionId),
      reason: "draft_faction_channel",
    };
  }

  const triggerPrivateThreadId = trigger?.channelId ? privateThreadIdFromChannel(trigger.channelId) : null;
  if (trigger?.visibility === "private_thread" && triggerPrivateThreadId) {
    const thread = privateThreadForChannel(input.room, `private:${triggerPrivateThreadId}`);
    return thread
      ? {
          action: "same_private_thread",
          channelId: `private:${thread.id}`,
          visibleTo: privateThreadVisibleTargets(thread),
          reason: "trigger_private_thread",
        }
      : { action: "blocked", reason: "trigger_private_thread_missing" };
  }

  const triggerFactionId = trigger?.channelId
    ? factionIdFromChannel(trigger.channelId)
    : trigger
      ? resolveMessageFactionId(trigger)
      : null;
  if (trigger?.visibility === "faction_huddle" && triggerFactionId) {
    return {
      action: "same_faction_channel",
      channelId: `faction:${triggerFactionId}`,
      factionId: triggerFactionId,
      visibleTo: factionChannelVisibleTargets(input.room, triggerFactionId),
      reason: "trigger_faction_channel",
    };
  }

  const activePrivateThreadId = privateThreadIdFromChannel(input.room.activeChannelId);
  if (activePrivateThreadId) {
    const thread = privateThreadForChannel(input.room, `private:${activePrivateThreadId}`);
    return thread
      ? {
          action: "same_private_thread",
          channelId: `private:${thread.id}`,
          visibleTo: privateThreadVisibleTargets(thread),
          reason: "active_private_thread",
        }
      : { action: "blocked", reason: "active_private_thread_missing" };
  }

  const activeFactionId = factionIdFromChannel(input.room.activeChannelId);
  if (activeFactionId && input.room.factionHuddles === "on") {
    return {
      action: "same_faction_channel",
      channelId: `faction:${activeFactionId}`,
      factionId: activeFactionId,
      visibleTo: factionChannelVisibleTargets(input.room, activeFactionId),
      reason: "active_faction_channel",
    };
  }

  return { action: "public", reason: "public_channel" };
}

export function applyReplyChannelDecisionToMessage(
  message: ConsoleMessage,
  decision: ReplyChannelDecision,
): ConsoleMessage {
  if (decision.action === "same_private_thread") {
    return {
      ...message,
      visibility: "private_thread",
      visibleTo: decision.visibleTo,
      privateReason: "private_thread",
      channelId: decision.channelId,
      factionId: undefined,
    };
  }

  if (decision.action === "same_faction_channel") {
    return {
      ...message,
      visibility: "faction_huddle",
      visibleTo: decision.visibleTo,
      privateReason: "faction_huddle",
      channelId: decision.channelId,
      factionId: decision.factionId,
    };
  }

  if (decision.action === "public" || decision.action === "public_safe_summary" || decision.action === "public_action") {
    return {
      ...message,
      visibility: "public",
      visibleTo: undefined,
      privateReason: undefined,
      channelId: "public",
      factionId: undefined,
    };
  }

  return message;
}

export function validateNoPrivateLeakToPublic(input: {
  message: ConsoleMessage;
  decision: ReplyChannelDecision;
  triggerMessage?: ConsoleMessage | null;
}): { ok: true } | { ok: false; reason: string } {
  if (input.decision.action === "blocked") {
    return { ok: false, reason: input.decision.reason };
  }

  const triggerPrivate =
    input.triggerMessage?.visibility === "private_thread" ||
    input.triggerMessage?.visibility === "faction_huddle" ||
    input.triggerMessage?.visibility === "private_ai";
  const messagePublic = (input.message.visibility ?? "public") === "public";
  const decisionKeepsPrivate =
    input.decision.action === "same_private_thread" || input.decision.action === "same_faction_channel";

  if ((triggerPrivate || decisionKeepsPrivate) && messagePublic) {
    return { ok: false, reason: "private_context_public_message" };
  }

  if (input.message.channelId?.startsWith("private:") && input.message.visibility !== "private_thread") {
    return { ok: false, reason: "private_channel_visibility_mismatch" };
  }

  if (input.message.channelId?.startsWith("faction:") && input.message.visibility !== "faction_huddle") {
    return { ok: false, reason: "faction_channel_visibility_mismatch" };
  }

  return { ok: true };
}

export function isPrivateAiWhisper(message: ConsoleMessage, room: RoomState): boolean {
  return resolveRoomMessageVisibility(message, room).visibility === "private_ai";
}

function unreadCountForChannel(room: RoomState, channelId: RoomActiveChannelId): number {
  const messages = room.messages.filter((message) => messageBelongsToChannel(message, room, channelId));
  if (messages.length === 0 || room.activeChannelId === channelId) {
    return 0;
  }

  const marker = room.channelReadState?.[channelId];
  if (!marker) {
    return messages.length;
  }

  if (marker.lastReadMessageId) {
    const index = messages.findIndex((message) => message.id === marker.lastReadMessageId);
    if (index >= 0) {
      return Math.max(0, messages.length - index - 1);
    }
  }

  if (marker.lastReadAt) {
    const lastReadAt = Date.parse(marker.lastReadAt);
    if (Number.isFinite(lastReadAt)) {
      return messages.filter((message) => Date.parse(message.at) > lastReadAt).length;
    }
  }

  return messages.length;
}

function messageBelongsToChannel(message: ConsoleMessage, room: RoomState, channelId: RoomActiveChannelId): boolean {
  if (channelId === "public") {
    return (message.visibility ?? "public") === "public";
  }

  const privateThreadId = privateThreadIdFromChannel(channelId);
  if (privateThreadId) {
    return message.visibility === "private_thread" && privateThreadIdFromChannel(message.channelId ?? "public") === privateThreadId;
  }

  const factionId = factionIdFromChannel(channelId);
  return Boolean(
    factionId &&
      room.factionHuddles === "on" &&
      message.visibility === "faction_huddle" &&
      resolveMessageFactionId(message) === factionId,
  );
}

export function deriveRoomChannels(room: RoomState): RoomChannel[] {
  const developerFreedom = room.freedomLevel === "developer";
  const channels: RoomChannel[] = [
    {
      id: "public",
      type: "public",
      label: "Public",
      memberRoleIds: room.participants.map((participant) => participant.id),
      unreadCount: unreadCountForChannel(room, "public"),
      private: false,
    },
  ];

  if (room.factionHuddles === "on") {
    for (const faction of room.factions) {
      if (faction.id === "neutral") {
        continue;
      }

      const memberRoleIds = room.participants
        .filter((participant) => participant.factionId === faction.id)
        .map((participant) => participant.id);
      const userInFaction = room.userProfile.factionId === faction.id;
      if (memberRoleIds.length === 0 && !userInFaction && !developerFreedom) {
        continue;
      }

      const channelId = `faction:${faction.id}` as const;
      channels.push({
        id: channelId,
        type: "faction",
        label: faction.name,
        factionId: faction.id,
        memberRoleIds,
        unreadCount: unreadCountForChannel(room, channelId),
        private: true,
      });
    }
  }

  for (const thread of room.privateThreads ?? []) {
    if (thread.status !== "active" || !isPrivateThreadVisibleToUser(room, thread)) {
      continue;
    }
    const channelId = `private:${thread.id}` as const;
    channels.push({
      id: channelId,
      type: "private",
      label: thread.title,
      threadId: thread.id,
      memberTargets: thread.memberTargets,
      memberRoleIds: thread.memberTargets
        .filter((target): target is { type: "role"; roleId: string } => target.type === "role")
        .map((target) => target.roleId),
      unreadCount: unreadCountForChannel(room, channelId),
      private: true,
    });
  }

  return channels;
}

export function getActiveRoomChannel(room: RoomState): RoomChannel {
  const channels = deriveRoomChannels(room);
  return channels.find((channel) => channel.id === room.activeChannelId) ?? channels[0]!;
}

export function filterRoomTimelineForChannel(
  messages: ConsoleMessage[],
  room: RoomState,
  channelId: RoomActiveChannelId,
): ConsoleMessage[] {
  if (channelId === "public") {
    return messages.filter((message) => (message.visibility ?? "public") === "public");
  }

  const privateThreadId = privateThreadIdFromChannel(channelId);
  if (privateThreadId) {
    return messages.filter(
      (message) => message.visibility === "private_thread" && privateThreadIdFromChannel(message.channelId ?? "public") === privateThreadId,
    );
  }

  const factionId = factionIdFromChannel(channelId);
  if (!factionId) {
    return [];
  }

  return messages.filter(
    (message) => message.visibility === "faction_huddle" && resolveMessageFactionId(message) === factionId,
  );
}

export function resolveRoomInputVisibility(
  input: string,
  room: RoomState,
  channelId: RoomActiveChannelId,
): Pick<ConsoleMessage, "visibility" | "visibleTo" | "privateReason" | "channelId" | "factionId"> {
  const forcePublic = new RegExp(String.raw`(^|\s)@all${ROOM_MENTION_BOUNDARY}`, "i").test(input);
  if (forcePublic) {
    return {
      visibility: "public",
      visibleTo: undefined,
      privateReason: undefined,
      channelId: "public",
      factionId: undefined,
    };
  }

  const activePrivateThread = privateThreadForChannel(room, channelId);
  if (activePrivateThread && isPrivateThreadVisibleToUser(room, activePrivateThread)) {
    return {
      visibility: "private_thread",
      visibleTo: privateThreadVisibleTargets(activePrivateThread),
      privateReason: "private_thread",
      channelId: `private:${activePrivateThread.id}`,
      factionId: undefined,
    };
  }

  const activeFactionId = factionIdFromChannel(channelId);
  if (!activeFactionId || room.factionHuddles !== "on") {
    return {
      visibility: "public",
      visibleTo: undefined,
      privateReason: undefined,
      channelId: "public",
      factionId: undefined,
    };
  }

  return {
    visibility: "faction_huddle",
    visibleTo: factionChannelVisibleTargets(room, activeFactionId),
    privateReason: "faction_huddle",
    channelId: `faction:${activeFactionId}`,
    factionId: activeFactionId,
  };
}

export function getChannelVisibleRoleIds(room: RoomState, channelId: RoomActiveChannelId): string[] {
  const privateThread = privateThreadForChannel(room, channelId);
  if (privateThread) {
    return privateThread.memberTargets
      .filter((target): target is { type: "role"; roleId: string } => target.type === "role")
      .map((target) => target.roleId)
      .filter((roleId) => room.participants.some((participant) => participant.id === roleId));
  }

  const factionId = factionIdFromChannel(channelId);
  if (!factionId) {
    return room.participants.map((participant) => participant.id);
  }
  return room.participants.filter((participant) => participant.factionId === factionId).map((participant) => participant.id);
}

export function filterRoomTimelineForUser(
  messages: ConsoleMessage[],
  userProfile: RoomUserProfile,
  privateWhispers: RoomState["privateWhispers"] = "on",
): ConsoleMessage[] {
  return messages.filter(
    (message) =>
      (message.visibility !== "private_ai" && message.visibility !== "faction_huddle" && message.visibility !== "private_thread") ||
      message.visibleTo?.some((target) => target.type === "user" && target.userId === userProfile.userId),
  );
}

export function getVisibleContextForParticipant(participant: RoomParticipant, room: RoomState): ConsoleMessage[] {
  return room.messages.filter((message) => {
    const visibility = resolveRoomMessageVisibility(message, room);
    if (visibility.visibility === "public") {
      return true;
    }
    return visibility.visibleTo?.some((target) => target.type === "role" && target.roleId === participant.id) ?? false;
  });
}

export function recordVisibleObservations(
  message: ConsoleMessage,
  room: RoomState,
  excludeRoleIds: string[] = [],
): string[] {
  const visibility = resolveRoomMessageVisibility(message, room);
  const visibleRoleIds =
    visibility.visibility === "public"
      ? room.participants.map((participant) => participant.id)
      : visibility.visibleTo
          ?.filter((target) => target.type === "role")
          .map((target) => target.roleId)
          .filter((roleId) => room.participants.some((participant) => participant.id === roleId)) ?? [];
  const excluded = new Set(excludeRoleIds);
  if (message.speakerType === "role" && message.speakerId) {
    excluded.add(message.speakerId);
  }
  return visibleRoleIds.filter((roleId) => !excluded.has(roleId));
}

export function canStartFactionHuddle(room: RoomState, factionId: string): boolean {
  if (room.factionHuddles !== "on" || factionId === "neutral") {
    return false;
  }

  const members = room.participants.filter((participant) => participant.factionId === factionId);
  if (members.length < 2) {
    return false;
  }

  const lastThread = room.factionHuddleThreads[0];
  if (lastThread?.factionId === factionId && room.autoSpeechState.status === "cooling_down") {
    return false;
  }

  return room.autoChat && room.autoSpeechState.consecutiveAutoTurns < room.autoSpeechPolicy.maxIdleBurstTurns;
}

export function resolveFactionHuddleVisibility(
  thread: RoomFactionHuddleThread,
  participant: RoomParticipant | RoomState["director"] | RoomUserProfile,
): "visible" | "hidden" {
  if ("directorId" in participant) {
    return "visible";
  }
  if ("userId" in participant) {
    return "hidden";
  }
  return thread.memberRoleIds.includes(participant.id) ? "visible" : "hidden";
}

export function mentionsFromTarget(target: RoomMessageTarget, room: RoomState): RoomMention[] {
  if (target === "all") {
    return [];
  }

  return target.targets.map((item) => {
    if (item.type === "user") {
      return {
        raw: `@${room.userProfile.displayName}`,
        target: item,
        displayName: room.userProfile.displayName,
      };
    }

    if (item.type === "room_director") {
      return {
        raw: `@${room.director.displayName}`,
        target: item,
        displayName: room.director.displayName,
      };
    }

    const role = room.participants.find((participant) => participant.id === item.roleId);
    return {
      raw: `@${role?.name ?? item.roleId}`,
      target: item,
      displayName: role?.name ?? item.roleId,
    };
  });
}

export function targetRoleIds(target: RoomMessageTarget | undefined): string[] {
  if (!target || target === "all") {
    return [];
  }
  return target.targets.filter((item): item is { type: "role"; roleId: string } => item.type === "role").map((item) => item.roleId);
}

export function resolveMessageFactionId(message: ConsoleMessage): string | null {
  if (message.factionId) {
    return message.factionId;
  }
  if (message.channelId?.startsWith("faction:")) {
    return factionIdFromChannel(message.channelId);
  }
  return null;
}

export function privateThreadIdFromChannel(channelId: RoomActiveChannelId): string | null {
  return channelId.startsWith("private:") ? channelId.slice("private:".length) : null;
}

function privateThreadForChannel(room: RoomState, channelId: RoomActiveChannelId): RoomPrivateThread | null {
  const threadId = privateThreadIdFromChannel(channelId);
  if (!threadId) {
    return null;
  }
  return (room.privateThreads ?? []).find((thread) => thread.id === threadId && thread.status === "active") ?? null;
}

function isPrivateThreadVisibleToUser(room: RoomState, thread: RoomPrivateThread): boolean {
  return (
    room.freedomLevel === "developer" ||
    thread.memberTargets.some((target) => target.type === "user" && target.userId === room.userProfile.userId)
  );
}

function privateThreadVisibleTargets(thread: RoomPrivateThread): RoomMentionTarget[] {
  return dedupeTargets([...thread.memberTargets, { type: "room_director", directorId: "room-director" }]);
}

export function factionIdFromChannel(channelId: RoomActiveChannelId): string | null {
  return channelId.startsWith("faction:") ? channelId.slice("faction:".length) : null;
}

function mentionCandidates(
  participants: RoomParticipant[],
  userProfile: RoomUserProfile,
  director: RoomState["director"] | null,
) {
  const candidates: Array<{ name: string; displayName: string; target: RoomMentionTarget }> = [
    userProfile.displayName,
    ...userProfile.aliases,
  ].map((name) => ({
    name,
    displayName: userProfile.displayName,
    target: { type: "user", userId: userProfile.userId } as const,
  }));

  if (director) {
    for (const name of [director.displayName, ...director.aliases]) {
      candidates.push({
        name,
        displayName: director.displayName,
        target: { type: "room_director", directorId: director.directorId },
      });
    }
  }

  for (const participant of participants) {
    const names = [participant.displayName, participant.name, participant.id, participant.packId];
    for (const name of names) {
      candidates.push({
        name,
        displayName: participant.name,
        target: { type: "role", roleId: participant.id },
      });
    }
  }

  const seenNames = new Set<string>();
  return candidates
    .filter((candidate) => {
      const key = `${candidate.name.toLowerCase()}::${mentionTargetKey(candidate.target)}`;
      if (seenNames.has(key)) {
        return false;
      }
      seenNames.add(key);
      return true;
    })
    .sort((left, right) => right.name.length - left.name.length);
}

function isAiSpeaker(message: ConsoleMessage): boolean {
  return message.speakerType === "role" || message.speakerType === "room_system";
}

function isRoleOnlyTarget(target: RoomMessageTarget | undefined): target is { targets: Array<{ type: "role"; roleId: string }> } {
  return Boolean(target && target !== "all" && target.targets.length > 0 && target.targets.every((item) => item.type === "role"));
}

export function privateVisibleTargets(message: ConsoleMessage): RoomMentionTarget[] {
  if (!isRoleOnlyTarget(message.target)) {
    return [];
  }

  const targets: RoomMentionTarget[] = [...message.target.targets];
  if (message.speakerType === "role" && message.speakerId) {
    targets.push({ type: "role", roleId: message.speakerId });
  }
  return dedupeTargets(targets);
}

function factionChannelVisibleTargets(room: RoomState, factionId: string): RoomMentionTarget[] {
  return [
    { type: "user", userId: room.userProfile.userId },
    { type: "room_director", directorId: room.director.directorId },
    ...room.participants
      .filter((participant) => participant.factionId === factionId)
      .map((participant) => ({ type: "role" as const, roleId: participant.id })),
  ];
}

function dedupeTargets(targets: RoomMentionTarget[]): RoomMentionTarget[] {
  const seen = new Set<string>();
  const result: RoomMentionTarget[] = [];
  for (const target of targets) {
    const key = mentionTargetKey(target);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(target);
  }
  return result;
}

function mentionTargetKey(target: RoomMentionTarget): string {
  if (target.type === "user") {
    return `user:${target.userId}`;
  }
  if (target.type === "room_director") {
    return `director:${target.directorId}`;
  }
  return `role:${target.roleId}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
