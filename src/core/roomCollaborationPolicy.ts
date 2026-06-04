import type {
  FactionCollaborationOpportunity,
  FactionStrategyState,
  RoomActiveChannelId,
  RoomCollaborationMode,
  RoomCollaborationPlan,
  RoomCollaborationTask,
  RoomFaction,
  RoomFactionHuddleThread,
  RoomParticipant,
  RoomSpeechIntent,
  RoomState,
  SimulationObjective,
} from "./types";
import { canStartFactionHuddle, getActiveRoomChannel } from "./roomVisibility";

type RoomTurnTrigger = "user" | "auto";

export function resolveRoomCollaborationMode(room: RoomState): RoomCollaborationMode {
  const activeChannel = getActiveRoomChannel(room);
  if (activeChannel.type === "faction") {
    return "team_strategy";
  }

  if (room.promptProfileId === "debate" || room.director.recipeId === "debate") {
    return "debate";
  }

  if (room.promptProfileId === "planning" || room.director.recipeId === "planning") {
    return "planning";
  }

  if (
    room.promptProfileId === "story" ||
    room.promptProfileId === "mystery" ||
    room.director.recipeId === "story" ||
    room.director.recipeId === "mystery"
  ) {
    return "scene_play";
  }

  return "free_talk";
}

function resolveCollaborationNeedLegacy(
  room: RoomState,
  trigger: RoomTurnTrigger,
  text: string,
): {
  needsHuddle: boolean;
  needsAssignment: boolean;
  objective: string;
  reason: string;
} {
  const objective = resolveCollaborationObjective(room);
  const mode = resolveRoomCollaborationMode(room);
  const compactText = trimForReply(text || room.topic || "room activity", 140);
  const coordinationText =
    /(strategy|plan|secret|clue|debate|argument|team|goal|objective|next move|coordinate|position|rebuttal|opening|assign|task|risk|协作|分工|策略|计划|目标|下一步|线索|秘密|辩论|反驳|立场|任务|风险)/i.test(
      text,
    );
  const collaborationMode =
    mode === "debate" ||
    mode === "planning" ||
    mode === "team_strategy" ||
    objective === "team_channel" ||
    ["story", "mystery", "debate", "planning"].includes(room.promptProfileId);
  const hasTeams = room.participants.some((participant) => participant.factionId && participant.factionId !== "neutral");
  const needsHuddle =
    trigger === "auto" &&
    room.factionHuddles === "on" &&
    hasTeams &&
    collaborationMode &&
    (coordinationText || mode === "debate" || mode === "team_strategy" || objective === "team_channel");
  return {
    needsHuddle,
    needsAssignment: collaborationMode && (coordinationText || Boolean(room.collaborationPlan?.tasks.some((task) => task.status !== "done"))),
    objective: compactText,
    reason: needsHuddle
      ? "team strategy needs a private huddle before public action"
      : collaborationMode
        ? "room mode benefits from role-level task assignment"
        : "single response is enough",
  };
}

export function resolveCollaborationNeed(
  room: RoomState,
  trigger: RoomTurnTrigger,
  text: string,
): {
  needsHuddle: boolean;
  needsAssignment: boolean;
  objective: string;
  reason: string;
  opportunity?: FactionCollaborationOpportunity;
} {
  const objective = resolveCollaborationObjective(room);
  const mode = resolveRoomCollaborationMode(room);
  const compactText = trimForReply(text || room.topic || "room activity", 140);
  const collaborationMode =
    mode === "debate" ||
    mode === "planning" ||
    mode === "team_strategy" ||
    objective === "team_channel" ||
    ["story", "mystery", "debate", "planning"].includes(room.promptProfileId);
  const hasTeams = room.participants.some((participant) => participant.factionId && participant.factionId !== "neutral");
  const opportunity = resolveFactionCollaborationOpportunity(room, trigger, text);
  const needsHuddle = Boolean(opportunity) && room.factionHuddles === "on" && hasTeams;
  return {
    needsHuddle,
    needsAssignment:
      collaborationMode &&
      (hasCoordinationSignal(text) ||
        Boolean(opportunity) ||
        Boolean(room.collaborationPlan?.tasks.some((task) => task.status !== "done"))),
    objective: compactText,
    reason: needsHuddle
      ? opportunity?.reason ?? "team strategy needs a private huddle before public action"
      : collaborationMode
        ? "room mode benefits from role-level task assignment"
        : "single response is enough",
    opportunity: opportunity ?? undefined,
  };
}

export function resolveFactionCollaborationOpportunity(
  room: RoomState,
  trigger: RoomTurnTrigger,
  text: string,
  preferredFactionId?: string,
): FactionCollaborationOpportunity | null {
  if (room.factionHuddles !== "on") {
    return null;
  }

  const factions = room.factions.filter((faction) => faction.id !== "neutral");
  if (factions.length === 0) {
    return null;
  }

  const mode = resolveRoomCollaborationMode(room);
  const objective = resolveCollaborationObjective(room);
  const activeChannel = getActiveRoomChannel(room);
  const targetFaction =
    factions.find((faction) => faction.id === preferredFactionId) ??
    (activeChannel.type === "faction" ? factions.find((faction) => faction.id === activeChannel.factionId) : undefined) ??
    chooseFactionForOpportunity(room, factions);
  if (!targetFaction || !canStartFactionHuddle(room, targetFaction.id)) {
    return null;
  }

  const members = room.participants.filter((participant) => participant.factionId === targetFaction.id);
  if (members.length < 2) {
    return null;
  }

  const compactText = trimForReply(text || room.topic || "room activity", 140);
  const textScore = hasCoordinationSignal(text) ? 34 : 0;
  const privacyScore = privacyNeedScore(text, targetFaction, mode);
  const modeScore = modeOpportunityScore(mode, objective, room.promptProfileId);
  const goalScore = targetFaction.publicGoal || targetFaction.privateGoal ? 12 : 0;
  const taskScore = room.collaborationPlan?.tasks.some((task) => task.factionId === targetFaction.id && task.status !== "done")
    ? 10
    : 0;
  const triggerScore = trigger === "user" ? 18 : 8;
  const urgency = clampScore(textScore + privacyScore + modeScore + goalScore + taskScore + triggerScore);
  if (urgency < 46 && mode !== "team_strategy") {
    return null;
  }

  const reason = opportunityReason(mode, text, targetFaction);
  const goal = opportunityGoal(room, targetFaction, compactText);
  return {
    factionId: targetFaction.id,
    initiator: trigger === "user" ? "user" : mode === "team_strategy" ? "role" : "director",
    reason,
    urgency,
    privacyNeed: clampScore(privacyScore + (targetFaction.privateGoal ? 18 : 0)),
    goal,
    suggestedRoleIds: members.slice(0, 4).map((member) => member.id),
    publicReturnPlan: createFactionNextPublicAction(room, targetFaction.name, goal),
    cooldownKey: `${targetFaction.id}:${mode}:${normalizeCooldownReason(reason)}`,
  };
}

export function getActiveRoomCollaborationTask(room: RoomState, roleId: string): RoomCollaborationTask | null {
  const tasks = room.collaborationPlan?.tasks ?? [];
  return (
    tasks.find((task) => task.roleId === roleId && (task.status === "active" || task.status === "pending")) ??
    null
  );
}

export function buildFactionStrategyState(thread: RoomFactionHuddleThread): FactionStrategyState {
  return {
    factionId: thread.factionId,
    objective: thread.objective ?? thread.summary,
    approach: thread.plan ?? thread.summary,
    risks: thread.risks ?? [],
    publicPoints: thread.publicPoints ?? [],
    nextPublicAction: thread.nextPublicAction ?? thread.summary,
    publicReturnPlan: thread.publicReturnPlan ?? thread.nextPublicAction ?? thread.summary,
    privateBoundary: thread.entries.flatMap((entry) => entry.privateNotes ?? [])[0] ?? "Keep faction-only reasoning inside the faction channel.",
    nextSpeakerRoleId: thread.nextPublicSpeakerRoleId,
    updatedAt: thread.createdAt,
    sourceThreadId: thread.id,
  };
}

export function createCollaborationTasksFromHuddle(room: RoomState, thread: RoomFactionHuddleThread): RoomCollaborationTask[] {
  const nowIso = thread.createdAt;
  const publicChannel: RoomActiveChannelId = "public";
  const members = thread.memberRoleIds
    .map((roleId) => room.participants.find((participant) => participant.id === roleId))
    .filter((participant): participant is RoomParticipant => Boolean(participant));
  const nextSpeakerId = thread.nextPublicSpeakerRoleId ?? members[0]?.id;
  return members.slice(0, 3).map((participant, index) => {
    const isNextSpeaker = participant.id === nextSpeakerId;
    return {
      id: `${thread.id}:task:${participant.id}`,
      roleId: participant.id,
      factionId: thread.factionId,
      title: isNextSpeaker ? "Public action" : "Support the team line",
      detail: isNextSpeaker
        ? `${thread.publicReturnPlan ?? thread.nextPublicAction ?? `Make the next public move for ${thread.factionName}.`} Speak in the public channel and do not expose the private huddle.`
        : thread.publicPoints?.[index] ?? `Support ${thread.factionName}'s strategy without exposing the full huddle.`,
      status: isNextSpeaker ? "active" : "pending",
      targetChannelId: publicChannel,
      dependsOnTaskIds: isNextSpeaker ? [] : [`${thread.id}:task:${nextSpeakerId}`].filter(Boolean),
      visibility: "faction",
      source: "faction_huddle",
      updatedAt: nowIso,
    } satisfies RoomCollaborationTask;
  });
}

export function buildCollaborationPlanFromHuddle(room: RoomState, thread: RoomFactionHuddleThread): RoomCollaborationPlan {
  const strategy = buildFactionStrategyState(thread);
  const tasks = createCollaborationTasksFromHuddle(room, thread);
  return {
    id: `collab:${thread.id}`,
    objective: strategy.objective,
    stage: "act",
    participantRoleIds: thread.memberRoleIds,
    tasks,
    factionStrategies: [strategy],
    nextPublicAction: strategy.nextPublicAction,
    lastOutcome: thread.summary,
    updatedAt: thread.createdAt,
  };
}

export function chooseCollaborationDirectiveParticipant(
  room: RoomState,
): { participant: RoomParticipant; task: RoomCollaborationTask } | null {
  const tasks = room.collaborationPlan?.tasks ?? [];
  const task =
    tasks.find((item) => item.status === "active" && item.targetChannelId === "public") ??
    tasks.find((item) => item.status === "pending" && item.targetChannelId === "public") ??
    null;
  if (!task) {
    return null;
  }
  const participant = room.participants.find((item) => item.id === task.roleId) ?? null;
  return participant ? { participant, task } : null;
}

export function createFactionHuddleThread(
  room: RoomState,
  intent: RoomSpeechIntent,
  nowLabel: string,
  userInput: string,
  opportunity?: FactionCollaborationOpportunity | null,
): RoomFactionHuddleThread | null {
  const participant = room.participants.find((candidate) => candidate.id === intent.roleId);
  const factionId = participant?.factionId ?? "neutral";
  if (!participant || !canStartFactionHuddle(room, factionId)) {
    return null;
  }

  const faction = room.factions.find((item) => item.id === factionId) ?? {
    id: factionId,
    name: factionId,
    color: "#c7a7ff",
  };
  const members = room.participants.filter((candidate) => candidate.factionId === factionId).slice(0, 6);
  const topic = trimForReply(userInput || room.messages.at(-1)?.text || room.topic);
  const goalContext = formatFactionGoalContext(faction);
  const resolvedOpportunity = opportunity ?? resolveFactionCollaborationOpportunity(room, "auto", userInput, factionId);
  const strategyTopic = [resolvedOpportunity?.goal ?? topic, goalContext].filter(Boolean).join(" / ");
  const publicReturnPlan = resolvedOpportunity?.publicReturnPlan ?? createFactionNextPublicAction(room, faction.name, strategyTopic);
  const entries = createFactionStrategyEntries(room, members, strategyTopic, nowLabel, publicReturnPlan);
  const names = members.map((member) => member.name).join(", ");
  const summary = createFactionStrategySummary(room, faction.name, names, topic);
  const objective = createFactionStrategyObjective(room, faction.name, strategyTopic);
  const plan = createFactionStrategyPlan(room, faction.name, strategyTopic);
  const publicPoints = createFactionStrategyPublicPoints(room, strategyTopic);
  const risks = createFactionStrategyRisks(room, strategyTopic);
  const nextPublicSpeakerRoleId =
    members.find((member) => member.id !== room.lastSpeakerId)?.id ?? members[0]?.id;
  const nextPublicAction = createFactionNextPublicAction(room, faction.name, strategyTopic);

  return {
    id: crypto.randomUUID(),
    roomId: room.id,
    factionId,
    factionName: faction.name,
    memberRoleIds: members.map((member) => member.id),
    entries,
    summary,
    objective,
    plan,
    risks,
    publicPoints,
    nextPublicSpeakerRoleId,
    nextPublicAction,
    publicReturnPlan,
    opportunity: resolvedOpportunity ?? undefined,
    createdAt: new Date().toISOString(),
  };
}

function formatFactionGoalContext(faction: { publicGoal?: string; privateGoal?: string }): string {
  const publicGoal = trimForReply(faction.publicGoal ?? "");
  const privateGoal = trimForReply(faction.privateGoal ?? "");
  return [
    publicGoal ? `public goal: ${publicGoal}` : "",
    privateGoal ? `private goal: ${privateGoal}` : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function createFactionStrategyObjective(room: RoomState, factionName: string, topic: string): string {
  if (room.promptProfileId === "debate") {
    return `${factionName} agrees on the next claim or rebuttal for the debate topic: ${topic}.`;
  }
  if (room.promptProfileId === "planning") {
    return `${factionName} chooses the next practical step, owner, and risk around: ${topic}.`;
  }
  if (room.promptProfileId === "mystery") {
    return `${factionName} compares visible clues and decides what can be safely revealed next.`;
  }
  if (room.promptProfileId === "story") {
    return `${factionName} coordinates one scene action while keeping private reasoning inside the team.`;
  }
  return `${factionName} sets a private goal and one public follow-up.`;
}

function createFactionStrategyPlan(room: RoomState, factionName: string, topic: string): string {
  if (room.promptProfileId === "debate") {
    return `${factionName} should return to the public channel with one concise argument, then let the other side respond.`;
  }
  if (resolveCollaborationObjective(room) === "team_channel") {
    return `${factionName} should keep strategy private and expose only the public move.`;
  }
  return `${factionName} should pick one member to act or speak publicly, while others support with different angles.`;
}

function createFactionStrategyRisks(room: RoomState, topic: string): string[] {
  const base = ["Do not reveal private strategy in public.", "Do not repeat the setup request."];
  if (room.promptProfileId === "mystery") {
    return [...base, "Do not expose hidden truth before a clue supports it."];
  }
  if (room.promptProfileId === "debate") {
    return [...base, "Do not let multiple speakers repeat the same opening point."];
  }
  return base;
}

function createFactionStrategyPublicPoints(room: RoomState, topic: string): string[] {
  if (room.promptProfileId === "debate") {
    return [
      `Make one clear point about "${topic}".`,
      "Answer the other side instead of restating setup rules.",
      "Leave room for the next teammate to add a different angle.",
    ];
  }
  if (room.promptProfileId === "planning") {
    return ["State the next step.", "Name one risk.", "Ask for one missing constraint if needed."];
  }
  return ["Take one visible action.", "Support with one reason.", "Keep private reasoning out of public text."];
}

function createFactionNextPublicAction(room: RoomState, factionName: string, topic: string): string {
  if (room.promptProfileId === "debate") {
    return `${factionName} sends the next assigned speaker to make one public argument on "${topic}".`;
  }
  if (room.promptProfileId === "planning") {
    return `${factionName} states the next practical step and one risk.`;
  }
  return `${factionName} turns the private strategy into one public action or statement.`;
}

function createFactionStrategyEntriesLegacy(
  room: RoomState,
  members: RoomParticipant[],
  topic: string,
  nowLabel: string,
): RoomFactionHuddleThread["entries"] {
  const chinese = /[\u3400-\u9fff]/u.test(`${topic} ${room.topic}`);
  const debate = room.promptProfileId === "debate";
  const texts = chinese
    ? debate
      ? [
          `目标：明确本阵营下一轮要证明或反驳什么，辩题是：${topic}`,
          "打法：选一个公开论点、证据或反驳点，回到公开频道由下一位辩手说清楚。",
          "边界：阵营频道只商讨目标和方法，不泄露完整私下策略。",
        ]
      : [
          `目标：确认本阵营接下来要达成什么，当前焦点是：${topic}`,
          "打法：决定谁在公开频道采取主要行动或发言，阵营频道只做内部协商。",
          "边界：保留内部推理，公开频道只呈现可见行动和必要理由。",
        ]
    : debate
      ? [
          `Goal: decide what this side needs to prove or rebut next on "${topic}".`,
          "Plan: choose one public claim, evidence point, or rebuttal, then send it back to the main channel through the next speaker.",
          "Boundary: use the faction channel for goals and method, not for exposing the whole private strategy.",
        ]
      : [
          `Goal: decide what this faction wants to achieve next around "${topic}".`,
          "Plan: choose who will take the main public action or statement; keep the huddle as internal coordination.",
          "Boundary: keep private reasoning inside the faction and show only visible action in the main channel.",
        ];

  return members.slice(0, 3).map((member, index) => ({
    id: crypto.randomUUID(),
    roleId: member.id,
    speaker: member.name,
    at: nowLabel,
    text: texts[index] ?? texts[texts.length - 1],
  }));
}

function createFactionStrategyEntries(
  room: RoomState,
  members: RoomParticipant[],
  topic: string,
  nowLabel: string,
  publicReturnPlan: string,
): RoomFactionHuddleThread["entries"] {
  const chinese = /[\u3400-\u9fff]/u.test(`${topic} ${room.topic}`);
  const mode = resolveRoomCollaborationMode(room);
  const privateBoundary = chinese
    ? "不要把阵营内部推理、秘密目标或完整策略直接发到公开频道。"
    : "Do not expose internal reasoning, secret goals, or the full strategy in public.";
  const publicSafePoints = createFactionStrategyPublicPoints(room, topic);
  const lines = chinese
    ? [
        `目标：先统一本阵营下一步要达成什么。当前焦点：${topic}`,
        room.promptProfileId === "mystery"
          ? "风险：只共享本阵营可见线索；隐藏真相和私密身份不要提前公开。"
          : mode === "debate"
            ? "风险：避免多人重复同一个开场观点，把论点、反驳和例子分开。"
            : "风险：先分清哪些内容能公开，哪些只能留在阵营频道。",
        `分工：指定一位成员回公开频道执行；公开回流：${publicReturnPlan}`,
        `可公开点：${publicSafePoints.slice(0, 2).join("；")}`,
      ]
    : [
        `Goal: align this faction's next objective around: ${topic}`,
        room.promptProfileId === "mystery"
          ? "Risk: share only visible clues inside the faction; do not reveal hidden truth or private identity too early."
          : mode === "debate"
            ? "Risk: avoid repeating the same opening point; split claims, rebuttals, and examples."
            : "Risk: separate what can be said publicly from what must stay inside the faction.",
        `Assignment: send one member back to the public channel. Public return: ${publicReturnPlan}`,
        `Public-safe points: ${publicSafePoints.slice(0, 2).join("; ")}`,
      ];

  return members.slice(0, 4).map((member, index) => ({
    id: crypto.randomUUID(),
    roleId: member.id,
    speaker: member.name,
    at: nowLabel,
    text: lines[index] ?? lines[lines.length - 1],
    publicSafePoints,
    privateNotes: [privateBoundary],
  }));
}

function createFactionStrategySummaryLegacy(room: RoomState, factionName: string, names: string, topic: string): string {
  const chinese = /[\u3400-\u9fff]/u.test(`${topic} ${room.topic}`);
  if (chinese) {
    return `${factionName} 阵营商讨：${names} 确认了内部目标和下一步公开行动；主要行动应回到公开频道。`;
  }
  return `${factionName} strategy huddle: ${names} set the private goal and next public move for "${topic}". Main action should return to the public channel.`;
}

function createFactionStrategySummary(room: RoomState, factionName: string, names: string, topic: string): string {
  const chinese = /[\u3400-\u9fff]/u.test(`${topic} ${room.topic}`);
  if (chinese) {
    return `${factionName} 阵营短讨论：${names} 已确认内部目标、风险边界和下一步公开行动；主要行动回到公开频道执行。`;
  }
  return `${factionName} strategy huddle: ${names} aligned on the internal goal, risk boundary, and next public move. Main action returns to the public channel.`;
}

function resolveCollaborationObjective(room: RoomState): SimulationObjective {
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

function chooseFactionForOpportunity(room: RoomState, factions: RoomFaction[]): RoomFaction | undefined {
  const activeTaskFaction = room.collaborationPlan?.tasks.find((task) => task.factionId && task.status !== "done")?.factionId;
  const lastFactionMessage = [...room.messages]
    .reverse()
    .map((message) => message.factionId)
    .find((factionId) => factionId && factionId !== "neutral");
  return (
    factions.find((faction) => faction.id === activeTaskFaction) ??
    factions.find((faction) => faction.id === lastFactionMessage) ??
    factions
      .map((faction) => ({
        faction,
        members: room.participants.filter((participant) => participant.factionId === faction.id).length,
      }))
      .sort((left, right) => right.members - left.members)[0]?.faction
  );
}

function hasCoordinationSignal(text: string): boolean {
  return /(?:strategy|plan|secret|clue|team|faction|goal|objective|next move|coordinate|position|rebuttal|opening|assign|task|risk|huddle|discuss|collaborate|private|协作|分工|策略|计划|目标|下一步|线索|秘密|阵营|队伍|私下|商量|讨论|风险|反驳|立场|任务|配合|掩护|可公开|不可公开)/i.test(
    text,
  );
}

function privacyNeedScore(text: string, faction: RoomFaction, mode: RoomCollaborationMode): number {
  const explicitPrivacy = /(?:secret|private|hidden|confidential|do not reveal|秘密|私下|隐藏|不能公开|不可公开|保密|暗线|线索)/i.test(text)
    ? 28
    : 0;
  const modePrivacy = mode === "team_strategy" || mode === "scene_play" ? 16 : mode === "debate" ? 8 : 4;
  const goalPrivacy = faction.privateGoal ? 16 : 0;
  return explicitPrivacy + modePrivacy + goalPrivacy;
}

function modeOpportunityScore(mode: RoomCollaborationMode, objective: SimulationObjective, promptProfileId: string): number {
  if (mode === "team_strategy" || objective === "team_channel") {
    return 42;
  }
  if (mode === "debate") {
    return 28;
  }
  if (mode === "planning") {
    return 24;
  }
  if (mode === "scene_play" || promptProfileId === "mystery" || promptProfileId === "story") {
    return 22;
  }
  return 8;
}

function opportunityReason(mode: RoomCollaborationMode, text: string, faction: RoomFaction): string {
  if (hasCoordinationSignal(text)) {
    return "visible coordination signal needs faction-only planning";
  }
  if (faction.privateGoal) {
    return "faction private goal needs a safe huddle before public action";
  }
  if (mode === "debate") {
    return "debate round benefits from a short faction strategy huddle";
  }
  if (mode === "team_strategy") {
    return "current faction channel is the strategy workspace";
  }
  return "room situation benefits from faction coordination";
}

function opportunityGoal(room: RoomState, faction: RoomFaction, fallback: string): string {
  const privateGoal = trimForReply(faction.privateGoal ?? "");
  const publicGoal = trimForReply(faction.publicGoal ?? "");
  if (privateGoal) {
    return `${faction.name}: ${privateGoal}`;
  }
  if (publicGoal) {
    return `${faction.name}: ${publicGoal}`;
  }
  return fallback || trimForReply(room.topic || "next public move");
}

function normalizeCooldownReason(reason: string): string {
  return reason
    .toLowerCase()
    .replace(/[^a-z0-9\u3400-\u9fff]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function trimForReply(value: string, maxLength = 80): string {
  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}
