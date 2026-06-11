import { getPackManifest } from "./characterPacks";
import { getDirectorPromptProfile, getRoomPromptProfile } from "./roomScheduler";
import type {
  CharacterViewModel,
  CompiledPromptPreview,
  ConsoleAppState,
  DirectorRulesFields,
  DirectorTurnPlan,
  EffectivePrompt,
  PromptAssemblyContext,
  PromptGuardFeedback,
  PromptMemoryCapsule,
  PromptStateCapsule,
  PromptTaskCard,
  PromptTemplateField,
  PromptCenterPromptType,
  PromptCenterViewState,
  PromptDraft,
  PromptOverride,
  PromptScope,
  RoomContextPanelMode,
  RoomModePromptTemplate,
  RoomParticipant,
  RoomRoleOverrideFields,
  RoomRulesFields,
  RoomState,
  SituationAssessmentSummary,
} from "./types";

export const maxPromptOverrideChars = 12_000;

export interface RoomPromptSet {
  roomId: string;
  roomPromptTargetId: string;
  directorPromptTargetId: string;
  characterPromptTargetIds: string[];
}

export interface PromptEditorTarget {
  scope: PromptScope;
  targetId: string;
  title: string;
  room: RoomState | null;
  participant: RoomParticipant | null;
}

export interface PromptEditorSource {
  label: "Template" | "Room custom" | "Legacy custom" | "Character pack" | "Role custom";
  detail: string;
}

const directorModeResponsibilities: Record<RoomContextPanelMode, string[]> = {
  casual: [
    "Casual mode responsibility: keep the room readable with minimal intervention and avoid turning light chat into a plot, debate, lesson, or planning session unless the user asks.",
    "Step in only for repetition, confusion, a user-requested recap, stalled conversation, or unsafe visibility risk; otherwise let roles answer naturally.",
  ],
  story: [
    "Story mode responsibility: maintain current scene, action consequences, pressure, choices, continuity, and transitions.",
    "Judge user actions as success, partial success, failure, blocked, or needs choice; update scene state when facts change, and keep unsupported user claims as claims unless developer freedom is active.",
  ],
  mystery: [
    "Mystery mode responsibility: control clue visibility, hidden truths, theories, contradictions, and reveal timing.",
    "Reveal only what visible clues support; track public clues, hidden facts, contradictions, and unresolved questions while keeping private truth out of public output until visibility changes.",
  ],
  debate: [
    "Debate mode responsibility: maintain motion, sides, speaker positions, round phase, next speaker, advantage changes, and final verdict timing.",
    "Setup, round control, advantage checks, and final judgement are separate; never restart setup after debate has begun, and defer future verdict requests until enough required speakers have finished.",
  ],
  study: [
    "Study mode responsibility: maintain learning goal, current concept, explanation depth, practice state, correction needs, and waiting-for-answer state.",
    "Decide whether the next move is explain, example, exercise, correction, recap, or wait; do not run ahead when the user needs to answer.",
  ],
  planning: [
    "Planning mode responsibility: maintain goal, constraints, options, risks, decision criteria, current decision point, and next action.",
    "Identify whether the room has enough information to decide; ask the smallest useful question when blocked and converge toward actionable next steps when enough material exists.",
  ],
  team: [
    "Team Channel responsibility: maintain faction goal, private strategy, secrecy boundary, division of labor, and public return plan.",
    "Start faction huddles when private coordination is useful, keep faction strategy out of public memory and timeline, and ensure each huddle returns one safe public action.",
  ],
};

const roomModePromptTemplates: RoomModePromptTemplate[] = [
  {
    mode: "casual",
    name: "Casual",
    roomFields: [
      field("commonTopic", "Common topic", "What this room usually talks about.", "This room is for natural conversation. Roles may respond, ask questions, react, lightly extend the topic, or introduce a fresh topic when the room goes quiet or repetitive. Follow the Room Rules for how far topic shifts may jump; do not force a plot, debate, lesson, or planning structure unless the user asks."),
      field("atmosphere", "Atmosphere", "The feel of the room.", "Follow the user's current topic and tone. Keep the room neutral and functional when no specific atmosphere is provided."),
      field("interactionPace", "Interaction pace", "How often roles should speak.", "Use short, distinct turns. Roles may speak, stay silent, observe, react, or wait when they have no fresh pressure. A long-silent role may naturally re-enter with a distinct question, objection, reaction, or small new angle. Do not make multiple roles repeat the same idea or speak when another role already handled the point."),
      field("modeTechnique", "Mode technique", "Small operating guidance for this mode.", "Roles should add new information, answer directly, ask one useful question, or let the current point stand. Do not treat greetings, jokes, or passing comments as long-term facts."),
      field("simulationGoal", "Room Flow goal", "What autoplay should try to create.", "Keep casual room flow alive with short natural replies. If there is no visible next step, a role may bring in one fresh topic according to Room Rules and role style. Do not invent a premise or convert casual chat into a structured scenario."),
      field("stopConditions", "Stop conditions", "When the room should pause.", "Pause on unavailable model, direct player choice, safety or visibility risk, or explicit user instruction to stop. Repetition or a lack of a visible next step may become a fresh-topic turn before pausing."),
    ],
    directorFields: commonDirectorFields("casual", "Keep the room readable with minimal intervention. Step in only for repetition, confusion, user-requested recap, stalled conversation, or unsafe visibility risk."),
    roleFields: commonRoleFields(),
  },
  {
    mode: "story",
    name: "Story",
    roomFields: [
      field("worldSetting", "World setting", "The world, era, genre, and basic premise.", "This room is for scene-based roleplay and narrative progression. Use supplied world details only; if none are supplied, rely on visible context and established room facts instead of inventing a large setting."),
      field("currentScene", "Current scene", "Where everyone is and what is happening now.", "Roles should speak or act from their visible position in the current scene. Infer only from visible messages, Director state, and established room facts."),
      field("storyGoal", "Story goal", "Where this segment should move.", "Move through visible actions, reactions, choices, and consequences. If no clear goal exists, respond to the current user action or visible beat rather than forcing a plot."),
      field("worldRules", "World rules", "Facts that cannot be casually rewritten.", "Non-developer user claims do not automatically become facts; they need action results, visible support, or Director ruling. Continuity, access, item ownership, secrets, and harm require confirmed room facts before they change."),
      field("actionJudgement", "Action consequences", "Which actions may change room facts.", "Actions that change scene facts, access, item ownership, secrets, harm, or continuity must create consequences through the room fact system, not by user claim alone."),
      field("modeTechnique", "Mode technique", "Small operating guidance for this mode.", "Roles should act, question, react, investigate, negotiate, resist, stay silent, or let another role carry the moment naturally. Do not narrate internal system logic or Director planning, and do not reveal hidden facts, private motives, or private channel information."),
      field("autoplayPace", "Room Flow pace", "How autoplay should push the story.", "Use short visible beats. At major choices, uncertainty, or high-risk turns, pause for the user or let Director resolve the situation."),
      field("stopConditions", "Stop conditions", "When the room should pause.", "Pause on major choices, repeated beats, fact conflicts, high-risk irreversible actions, or when the player is directly asked to decide."),
    ],
    directorFields: commonDirectorFields("story", "Maintain scene continuity, action consequences, pressure, choices, and transitions. Judge actions through immersive results and pause before major irreversible choices."),
    roleFields: commonRoleFields(),
  },
  {
    mode: "mystery",
    name: "Mystery",
    roomFields: [
      field("centralMystery", "Central mystery", "The question this room is trying to solve.", "This room is for clues, theories, hidden facts, contradiction handling, and controlled reveals. If no mystery question is supplied, do not invent a hidden case."),
      field("publicClues", "Public clues", "Clues visible to the player and public channel.", "Roles may reason from visible clues, memories, testimony, and scene facts. If no public clues are supplied, use only clues already visible in messages or Director memory."),
      field("hiddenTruth", "Hidden truth", "Truth managed by Director only.", "Do not reveal hidden truth unless it has become visible or Director authorizes it. If no hidden truth is supplied, do not create hidden truth automatically."),
      field("revealPace", "Reveal pace", "How quickly clues should surface.", "When evidence is insufficient, ask for more investigation or present a limited visible clue. Do not solve the entire mystery prematurely."),
      field("secretRules", "Secret protection rules", "Who may know what.", "Private clues, identity-card secrets, faction strategy, and observer-only facts must not leak into public replies. Keep public replies grounded in what the speaker can know."),
      field("misdirection", "Misdirection rules", "Whether misleading clues are allowed.", "Theories are not facts until confirmed by evidence or ruling. If misdirection is not explicitly enabled, prefer clear uncertainty over misleading facts."),
      field("modeTechnique", "Mode technique", "Small operating guidance for this mode.", "Work through clues, hypotheses, contradictions, and visibility boundaries. Roles may hold back, doubt, or observe when speaking would reveal unsupported or non-visible information. Reveal private facts only when the room state makes them visible."),
      field("stopConditions", "Stop conditions", "When the room should pause.", "Pause before major truth reveals, clue contradictions, unsupported accusations, or player-facing choices."),
    ],
    directorFields: commonDirectorFields("mystery", "Control clue visibility, hidden facts, theory handling, contradictions, and reveal timing without inventing or spoiling private truth."),
    roleFields: commonRoleFields(),
  },
  {
    mode: "debate",
    name: "Debate",
    roomFields: [
      field("topic", "Debate topic", "The question being argued.", "This room is for structured argument on a user-provided motion. Do not invent a debate topic if none is supplied."),
      field("speakingRules", "Speaking rules", "How turns should work.", "Follow assigned side, speaker position, and current round. Each role should complete only the current speaking task: opening, argument, rebuttal, summary, or answer."),
      field("judgingCriteria", "Judging criteria", "How arguments are evaluated.", "If no judging criteria are supplied, track relevance, clarity, evidence, direct response, and decisive clash. Final judgement should happen only after enough debate material exists or the required speakers have finished."),
      field("roundRules", "Round rules", "How many speakers and follow-ups per round.", "The motion, sides, speaker assignments, and judging criteria may come from the user, room prompt, or Director setup. Do not let the same role occupy multiple required speaking slots in the same round unless explicitly required."),
      field("scoring", "Scoring", "Whether score or advantage should be shown.", "If no scoring rules are supplied, summarize advantages without treating subjective claims as objective truth. Free debate must still have an ending condition."),
      field("modeTechnique", "Mode technique", "Small operating guidance for this mode.", "Use the assigned side and speaking position. Give one argument, rebuttal, or summary per turn; silent observation is valid for roles without the current floor. Do not repeat the user's long debate setup or rules."),
      field("stopConditions", "Stop conditions", "When the room should pause.", "Pause on repeated claims, completed round, missing topic, insufficient judging material, or Director summary."),
    ],
    directorFields: commonDirectorFields("debate", "Control motion, sides, speaker positions, rounds, next speaker, phase summaries, and verdict timing without restarting setup after debate has begun."),
    roleFields: commonRoleFields(),
  },
  {
    mode: "study",
    name: "Study",
    roomFields: [
      field("learningGoal", "Learning goal", "What the room is trying to learn.", "This room is for explanation, practice, correction, and checking understanding. If no learning goal is supplied, ask for or infer only the immediate topic."),
      field("difficulty", "Difficulty", "How deep the explanations should be.", "Start simple when difficulty is unknown, then adapt to the user's responses and visible understanding."),
      field("explanationStyle", "Explanation style", "How ideas should be explained.", "Explain in small steps, with examples when useful. Do not overload the user with too much content at once."),
      field("practiceStyle", "Practice style", "How to check understanding.", "If the user is expected to answer, wait instead of continuing automatically. If the user asks to be tested later, treat the test as a deferred requirement."),
      field("summaryFrequency", "Summary frequency", "When to summarize.", "Summarize after a completed point, when the user asks, or when a correction changes the current understanding."),
      field("modeTechnique", "Mode technique", "Small operating guidance for this mode.", "Roles should avoid repeating the same explanation. A role may ask, correct, demonstrate, stay quiet, or wait for the learner when that is the natural next step. Corrections should be clear, specific, and tied to the user's answer."),
      field("stopConditions", "Stop conditions", "When the room should pause.", "Pause when the user needs to answer, choose the next focus, provide missing information, or confirm readiness for practice."),
    ],
    directorFields: commonDirectorFields("study", "Manage learning goal, current concept, explanation pace, practice, correction, and waiting for learner answers."),
    roleFields: commonRoleFields(),
  },
  {
    mode: "planning",
    name: "Planning",
    roomFields: [
      field("projectGoal", "Project goal", "What the room is trying to achieve.", "This room is for goals, constraints, risks, options, decisions, and next actions. If no concrete goal is supplied, ask for or wait for one."),
      field("constraints", "Constraints", "Limits that matter.", "Separate facts, assumptions, constraints, risks, preferences, and missing information. Do not invent missing constraints."),
      field("decisionCriteria", "Decision criteria", "How options should be judged.", "If no decision criteria are supplied, compare practical tradeoffs, user impact, risk, cost, and next steps."),
      field("discussionMode", "Discussion mode", "How the room should think.", "Different roles should contribute different angles such as strategy, risk, execution, counterexample, or user impact. A role without a useful new angle should not speak just to stay active."),
      field("outputFormat", "Output format", "What the room should produce.", "When enough information exists, converge toward a concrete next step with risks and assumptions clearly separated."),
      field("modeTechnique", "Mode technique", "Small operating guidance for this mode.", "Keep discussion tied to the user-provided goal. Do not keep brainstorming forever."),
      field("stopConditions", "Stop conditions", "When the room should pause.", "Pause after a decision, when key information is missing, when user confirmation is needed, or when the next step is clear."),
    ],
    directorFields: commonDirectorFields("planning", "Facilitate goal clarity, constraints, options, risks, decision points, and next actions around the user-provided goal."),
    roleFields: commonRoleFields(),
  },
  {
    mode: "team",
    name: "Team Channel",
    roomFields: [
      field("teamGoal", "Team channel goal", "What this private channel should solve.", "This room is for faction coordination, private strategy, risk review, role assignment, and deciding what can be said publicly."),
      field("visibilityRules", "Visibility rules", "Who can read this channel.", "Only same-faction members, the player if they belong to this faction, and Director can see this channel. Non-faction roles cannot know private faction content."),
      field("confidentialBoundary", "Confidential boundary", "What cannot be carried to Public.", "Use faction channels for goals, risks, secrets, division of work, and public return plans. Do not leak faction strategy or private facts into public replies."),
      field("collaborationStyle", "Collaboration style", "How the team should work together.", "A huddle should be short and complete: goal, risk, boundary, assigned public speaker, and public-safe point. Roles may stay silent when another teammate already covers their concern."),
      field("modeTechnique", "Mode technique", "Small operating guidance for this mode.", "Public channel actions should only use public-safe conclusions. Main actions and public claims should happen in the public channel."),
      field("returnConditions", "Return to Public", "When to leave the channel.", "Return when the faction has a strategy, needs a public response, or Director requests it."),
    ],
    directorFields: commonDirectorFields("team", "Maintain faction visibility, collaboration opportunities, private boundaries, and public return plans without leaking private channel contents."),
    roleFields: commonRoleFields(),
  },
];

function field(key: string, label: string, description: string, defaultValue: string, kind: PromptTemplateField["kind"] = "textarea"): PromptTemplateField {
  return { key, label, description, kind, defaultValue };
}

function commonDirectorFields(mode: RoomContextPanelMode, style: string): PromptTemplateField[] {
  return [
    field(
      "coreRole",
      "Core Role",
      "What the Director is in this room.",
      [
        "You are the current room's background host, public narrator, pacing controller, fact ledger, visibility gatekeeper, and backstage scheduler.",
        "You are not a normal character, do not take a character side, and do not replace character dialogue.",
        style,
      ].join("\n"),
    ),
    field(
      "modeResponsibility",
      "Mode Responsibility",
      "Mode-specific Director responsibilities for this room.",
      directorModeResponsibilities[mode].join("\n"),
    ),
    field(
      "publicSpeech",
      "Public Speech",
      "When and how the Director may speak publicly.",
      [
        "Public speech is for immersive narration, environment changes, action results, scene pressure, setup confirmation, phase recaps, choices, and necessary rulings.",
        "Public narration may create an open-ended situation for the room to answer.",
        "Public speech must not schedule the next speaker, target role, private task, faction plan, or backend follow-up.",
        "Do not output success, partial_success, Reason, Consequence, Director ruling, system judgement, backend judgement, or other debug-style text.",
        "Public speech should use the user's current primary language.",
      ].join("\n"),
    ),
    field(
      "privateScheduling",
      "Private Scheduling",
      "How the Director should guide roles privately.",
      [
        "Role assignments, next speaker selection, target roles, faction strategy, debate position tasks, and action goals must use runtime private directives.",
        "If a role needs a cue, send it backstage through privateDirectives, pending follow-up, Inspector state, or private whisper when that channel is enabled.",
        "Faction channels are strategy spaces for goals, risks, secrets, division of labor, and the next public move; they are not the main public stage.",
        "When faction coordination is useful, organize a short internal discussion, then send one clear public action back to the public channel.",
        "Do not write private directives into the public timeline.",
        "After a role receives a task, it should speak or act directly instead of repeating scheduling instructions.",
      ].join("\n"),
    ),
    field(
      "factsAndVisibility",
      "Facts And Visibility",
      "How the Director treats claims, facts, secrets, and visibility.",
      [
        "User and role statements are claims by default; they do not automatically become room facts.",
        "Changes to scene facts, item ownership, locks, access, secrets, harm, victory, or continuity require visible support, Director judgement, or explicit developer authority before they enter the room fact ledger.",
        "Blocked, failed, uncertain, or needs-choice actions may be narrated as attempts or consequences, but they are not established success facts.",
        "Private chats, faction channels, private identity-card fields, and hidden facts are only available to authorized roles and the Director.",
        "Do not leak non-visible information to unrelated roles or public channels.",
      ].join("\n"),
    ),
    field(
      "modeBehavior",
      "Mode Behavior",
      "How the Director should adapt to the current room mode.",
      [
        "Follow the current room mode policy injected at runtime.",
        "Casual: intervene lightly, organize pace, and prevent repetition.",
        "Story: judge action consequences, preserve scene continuity, and maintain choices.",
        "Mystery: manage clues, hidden truth, misdirection boundaries, and gradual reveals.",
        "Debate: maintain motion, sides, speaker positions, rounds, next speaker, and advantage changes.",
        "Study: maintain learning goal, current concept, practice, and waiting-for-user-answer state.",
        "Planning: maintain goal, constraints, risks, decision points, and next steps.",
        "Team Channel: maintain faction strategy, secrecy boundaries, and timing for public response.",
      ].join("\n"),
    ),
    field(
      "stopRules",
      "Stop Rules",
      "When autoplay should pause.",
      [
        "Pause on major choices, missing information, repeated output, unavailable model, fact conflicts, or when the user truly needs to answer.",
        "When autoplay stalls without a required user choice, prefer a private directive, speaker change, or open public narration before waiting.",
        "Stop reasons belong in Room Inspector, not the normal timeline.",
      ].join("\n"),
    ),
  ];
}

function commonRoleFields(): PromptTemplateField[] {
  return [
    field("roomIdentity", "Room foundation", "This role's stable position only inside this room.", "Fill in this role's temporary room foundation if needed: position, responsibility, boundary, or room-only identity. If empty, use the character pack base prompt."),
    field("roomGoal", "Current pressure", "Why this role might speak now.", "Fill in the current visible pressure if needed: question, risk, conflict, task, missing information, or reason to wait. If empty, respond only to the current visible context."),
    field("factionStance", "Motivation mix", "What may drive this role's room behavior.", "Fill in possible motivations if needed: answer, question, challenge, coordinate, protect a boundary, advance the scene, support a teammate, or stay neutral. Motivations may mix and change by context."),
    field("speakingActivity", "Dampers", "When this role should reduce output.", "Fill in dampers if needed. Short replies, partial agreement, silence, observation, and letting another role carry the point are valid when they fit the moment. After a long silence, this role can re-enter with one role-specific angle instead of summarizing the whole thread. If selected to revive a quiet room, introduce one topic in this role's own style and within Room Rules."),
    field("visibleKnowledge", "Visibility boundary", "What this role is allowed to know here.", "Use only public facts, this role's visible private notes, its faction channel memory, and facts visible to this role. Do not repeat long user instructions or room setup text."),
    field("toneAddon", "Room voice note", "Temporary voice guidance only for this room.", "Fill in room-only voice notes if needed. Avoid turning one trait into a repeated catchphrase; adjust length, intensity, and directness to the current visible pressure."),
  ];
}

export function promptOverrideId(scope: PromptScope, targetId: string): string {
  return `${scope}:${targetId}`;
}

export function findPromptOverride(
  prompts: ConsoleAppState["prompts"],
  scope: PromptScope,
  targetId: string,
): PromptOverride | null {
  return prompts.overrides.find((override) => override.scope === scope && override.targetId === targetId) ?? null;
}

export function findPromptDraft(
  prompts: ConsoleAppState["prompts"],
  scope: PromptScope,
  targetId: string,
): PromptDraft | null {
  return prompts.drafts.find((draft) => draft.scope === scope && draft.targetId === targetId) ?? null;
}

export function resolveEffectivePrompt(
  scope: PromptScope,
  targetId: string,
  state: ConsoleAppState,
): EffectivePrompt {
  const override = findPromptOverride(state.prompts, scope, targetId);
  const overrideText = override?.enabled ? (override.activeText ?? override.text).trim() : "";
  if (override && overrideText) {
    return {
      scope,
      targetId,
      text: overrideText,
      source: "override",
      revision: override.appliedRevision ?? override.revision,
    };
  }

  return {
    scope,
    targetId,
    text: defaultPromptText(scope, targetId, state),
    source: "default",
    revision: 0,
  };
}

export function resolveCharacterPackPrompt(packId: string, state: ConsoleAppState): EffectivePrompt {
  return resolveEffectivePrompt("character_pack", packId, state);
}

export function resolveRoomRolePrompt(participant: RoomParticipant, state: ConsoleAppState): EffectivePrompt {
  return resolveCharacterPackPrompt(participant.packId, state);
}

export function resolveRoomPrompt(room: RoomState, state: ConsoleAppState): EffectivePrompt {
  const mode = resolveRoomPromptMode(room);
  const roomPrompt = resolveEffectivePrompt("room", roomModePromptTargetId(room, mode), state);
  if (roomPrompt.source === "override") {
    return roomPrompt;
  }

  const legacyRoomPrompt = findLegacyRoomPromptFallback(state, "room", room.id);
  if (legacyRoomPrompt) {
    return {
      ...legacyRoomPrompt,
      targetId: roomPrompt.targetId,
    };
  }

  const legacyProfilePrompt = resolveEffectivePrompt("room", room.promptProfileId, state);
  if (legacyProfilePrompt.source === "override") {
    return {
      ...legacyProfilePrompt,
      targetId: roomPrompt.targetId,
    };
  }

  return roomPrompt;
}

export function resolveDirectorPrompt(room: RoomState, state: ConsoleAppState): EffectivePrompt {
  const mode = resolveRoomPromptMode(room);
  const directorPrompt = resolveEffectivePrompt("director", directorModePromptTargetId(room, mode), state);
  if (directorPrompt.source === "override") {
    return directorPrompt;
  }

  const legacyDirectorPrompt = findLegacyRoomPromptFallback(state, "director", room.id);
  if (legacyDirectorPrompt) {
    return {
      ...legacyDirectorPrompt,
      targetId: directorPrompt.targetId,
    };
  }

  const legacyProfilePrompt = resolveEffectivePrompt("director", room.director.profileId, state);
  if (legacyProfilePrompt.source === "override") {
    return {
      ...legacyProfilePrompt,
      targetId: directorPrompt.targetId,
    };
  }

  return directorPrompt;
}

export function roomPromptTargetId(room: RoomState): string {
  return `room:${room.id}`;
}

export function directorPromptTargetId(room: RoomState): string {
  return `director:${room.id}`;
}

export function roomModePromptTargetId(room: RoomState, mode: RoomContextPanelMode = resolveRoomPromptMode(room)): string {
  return `${roomPromptTargetId(room)}:mode:${mode}`;
}

export function directorModePromptTargetId(room: RoomState, mode: RoomContextPanelMode = resolveRoomPromptMode(room)): string {
  return `${directorPromptTargetId(room)}:mode:${mode}`;
}

export function roomRolePromptTargetId(participant: RoomParticipant): string {
  const roomId = participant.memoryScope.startsWith("room:")
    ? participant.memoryScope.slice("room:".length)
    : "unknown-room";
  return `${roomId}:${participant.roleId}`;
}

export function getPromptSetForRoom(room: RoomState, state: ConsoleAppState): RoomPromptSet {
  return {
    roomId: room.id,
    roomPromptTargetId: roomModePromptTargetId(room),
    directorPromptTargetId: directorModePromptTargetId(room),
    characterPromptTargetIds: [...new Set(room.participants.map((participant) => participant.packId))],
  };
}

export function getRoomModeTemplate(mode: RoomContextPanelMode): RoomModePromptTemplate {
  return roomModePromptTemplates.find((template) => template.mode === mode) ?? roomModePromptTemplates[0]!;
}

export function resolveRoomPromptMode(room: RoomState): RoomContextPanelMode {
  if (room.activeChannelId.startsWith("faction:")) {
    return "team";
  }
  if (room.promptProfileId === "casual-chat") {
    return "casual";
  }
  if (room.promptProfileId === "story") {
    return "story";
  }
  if (room.promptProfileId === "mystery") {
    return "mystery";
  }
  if (room.promptProfileId === "debate") {
    return "debate";
  }
  if (room.promptProfileId === "study") {
    return "study";
  }
  if (room.promptProfileId === "planning") {
    return "planning";
  }
  return "casual";
}

export function buildRoomRulesFields(room: RoomState, state: ConsoleAppState): RoomRulesFields {
  const mode = resolveRoomPromptMode(room);
  const template = getRoomModeTemplate(mode);
  const targetId = roomModePromptTargetId(room, mode);
  const text = promptEditorText("room", targetId, state);
  return { mode, values: extractPromptFieldValues(text, template.roomFields) };
}

export function buildDirectorRulesFields(room: RoomState, state: ConsoleAppState): DirectorRulesFields {
  const mode = resolveRoomPromptMode(room);
  const template = getRoomModeTemplate(mode);
  const targetId = directorModePromptTargetId(room, mode);
  const text = promptEditorText("director", targetId, state);
  return { mode, values: extractPromptFieldValues(text, template.directorFields) };
}

export function buildRoleOverrideFields(room: RoomState, participant: RoomParticipant, state: ConsoleAppState): RoomRoleOverrideFields {
  const mode = resolveRoomPromptMode(room);
  const template = getRoomModeTemplate(mode);
  const targetId = roomRolePromptTargetId(participant);
  const text = promptEditorText("room_role", targetId, state);
  return { mode, values: extractPromptFieldValues(text, template.roleFields) };
}

export function compileRoomRulesPrompt(fields: RoomRulesFields, mode: RoomContextPanelMode = fields.mode): string {
  const template = getRoomModeTemplate(mode);
  return compilePromptFromFields("Room Rules", template.name, template.roomFields, fields.values, [
    "Layer: static Room Rules. Runtime identity cards, faction strategy, private directives, visible memory, and recent context are injected separately by scope and visibility.",
    "This is a multi-character Room, not a one-on-one chat box.",
    "This prompt defines the room stage, rules, scheduling, visibility, collaboration habits, and stop conditions.",
    "It must not define character identity, personality, private motives, or speaking style.",
    "Character-specific behavior belongs in character pack prompts.",
    "Roles should not repeat long user instructions; they should complete the current visible task.",
    "Roles may speak, stay silent, observe, challenge, add one useful angle, or wait when they have no fresh pressure; a long-silent role may naturally re-enter when it has a distinct question, objection, reaction, or supplement.",
    "Each turn should answer the current visible pressure instead of restating the room setup.",
    "Faction channels may be used for short strategy discussion, risk checks, secrecy boundaries, and deciding who returns to the public channel.",
    "User and role claims are unconfirmed until supported by visible facts or room continuity.",
    "Long-term facts require visible support, Director judgement, or explicit developer authority.",
    "All room-facing replies should use the user's current primary language.",
  ]);
}

export function compileDirectorRulesPrompt(fields: DirectorRulesFields, mode: RoomContextPanelMode = fields.mode): string {
  const template = getRoomModeTemplate(mode);
  return compilePromptFromFields("Director Rules", template.name, template.directorFields, fields.values, [
    "Layer: static Director Rules. Mode policy, room state, collaboration plan, Director memory, and visible private facts are injected separately at runtime.",
    "This prompt defines the Director's static responsibility only: hosting, pacing, fact ledger, visibility, private scheduling, and stop conditions.",
    "Mode-specific behavior, speaker order, collaboration state, identity cards, and memory are runtime layers, not static template content.",
    "The Director is not a normal character and must not replace character dialogue or rewrite app safety rules.",
    "Public Director text may be immersive narration for environment, pressure, action results, scene transitions, choices, recaps, or necessary rulings.",
    "Public narration is scene-facing prose: write only what the public room can observe, in 1-3 natural sentences.",
    "When asked to narrate publicly, output only the narration text that should appear in the public timeline.",
    "Do not write labels, fields, Current scene, Goal, Open clues, Reason, Move, Next beat, Backstage, Focus, target role, or scheduling notes as public narration.",
    "If no concrete scene exists, use a light neutral room beat instead of a status summary.",
    "Public Director text must not schedule the next speaker, target role, private task, faction plan, or backend follow-up.",
    "Role scheduling belongs in private directives, pending follow-up, private whispers, or Room Inspector state.",
    "Public narration may create an open-ended situation, but it must not establish unsupported key facts.",
    "Keep technical judgement state in Room Inspector, not the timeline.",
    "Do not expose success, partial_success, Reason, Consequence, Director ruling, system judgement, backend judgement, or internal planning text in public output.",
    "Director-facing public output should use the user's current primary language.",
  ]);
}

export function compileRoomRoleOverridePrompt(fields: RoomRoleOverrideFields, mode: RoomContextPanelMode = fields.mode): string {
  const template = getRoomModeTemplate(mode);
  return compilePromptFromFields("Room Role Notes", template.name, template.roleFields, fields.values, [
    "This prompt only affects this role inside this room.",
    "It supplements the character pack prompt and does not edit the original character pack.",
    "Use Room foundation, Current pressure, Motivation mix, Dampers, and Visibility boundary as room-only reasoning aids.",
    "Runtime private tasks, visible identity card fields, and visible memory may be injected after this layer.",
    "Use only visible information and do not repeat long user instructions or room setup text.",
    "When the room rhythm pulls this role back in after a long silence, add one role-specific angle instead of summarizing the whole thread.",
    "Short replies, partial agreement, silence, observation, and letting another role carry the point are valid when they fit the moment.",
    "The role should speak from the current visible pressure, not from a fixed trait checklist.",
    "When useful, the role may suggest same-faction coordination, but public-channel action should stay concise and should not reveal private huddle details.",
    "Roles may doubt unsupported claims naturally without naming backend judgement.",
    "The role should reply in the user's current primary language.",
  ]);
}

export function compilePromptPreview(title: string, text: string): CompiledPromptPreview {
  const compactLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .slice(0, 6);
  return {
    title,
    text,
    compactText: compactLines.join("\n").slice(0, 520),
  };
}

export function extractPromptFieldValues(text: string, fields: PromptTemplateField[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    values[field.key] = extractPromptFieldValue(text, field) ?? field.defaultValue;
  }
  return values;
}

export function compilePromptFromFields(
  title: string,
  modeName: string,
  fields: PromptTemplateField[],
  values: Record<string, string>,
  notes: string[],
): string {
  const parts = [`# CastRoom AI ${title}`, `Mode: ${modeName}`, "", ...notes.map((note) => `- ${note}`), ""];
  for (const field of fields) {
    const value = (values[field.key] ?? field.defaultValue).trim() || field.defaultValue;
    parts.push(`## ${field.label}`, value, "");
  }
  return parts.join("\n").trim();
}

export function compileLayeredPrompt(context: PromptAssemblyContext): string {
  const parts = [
    "# CastRoom AI Layered Prompt",
    `Target: ${context.target}`,
    `Mode: ${getRoomModeTemplate(context.mode).name}`,
    "",
    "Layer order: system default template -> current mode policy -> runtime override -> state capsule -> memory capsule -> current turn task card -> guard feedback.",
    "Static templates describe stable behavior. Runtime capsules describe this turn only and must not be treated as permanent facts unless the fact ledger says so.",
  ];

  appendPromptLayer(parts, "System Default Template", context.defaultTemplate);
  appendPromptLayer(parts, "Runtime Override", context.overrideText);
  appendPromptLayer(parts, context.stateCapsule?.title ?? "State Capsule", renderPromptCapsule(context.stateCapsule));
  appendPromptLayer(parts, context.memoryCapsule?.title ?? "Memory Capsule", renderPromptCapsule(context.memoryCapsule));
  appendPromptLayer(parts, context.taskCard?.title ?? "Current Turn Task Card", renderPromptCapsule(context.taskCard));
  appendPromptLayer(parts, context.guardFeedback?.title ?? "Guard Feedback", renderPromptCapsule(context.guardFeedback));

  return parts.join("\n").trim();
}

export function buildRoomStateCapsule(
  room: RoomState,
  assessment?: SituationAssessmentSummary | null,
): PromptStateCapsule {
  const mode = resolveRoomPromptMode(room);
  const pendingFollowup = room.autoSpeechState.pendingFollowup;
  const match = room.match;
  const spokenThisRound = match.spokenRoleIdsByRound?.[String(match.round)] ?? [];
  const skippedThisRound = match.skippedRoleIdsByRound?.[String(match.round)] ?? [];
  const requiredDebateSpeakers = match.speakerAssignments.length;
  const visibleHooks = room.plot?.hooks.filter((hook) => hook.visibility === "public" && hook.status !== "resolved").length ?? 0;
  const hiddenHooks = room.plot?.hooks.filter((hook) => hook.visibility === "hidden" && hook.status !== "resolved").length ?? 0;
  const lines = [
    `Mode: ${mode}`,
    `Topic: ${trimPromptLine(room.topic || room.plot?.publicGoal || room.director.sceneBoard.goal || "none", 180)}`,
    `Active channel: ${room.activeChannelId}`,
    `Turn phase: ${room.turnPhase}`,
    `Auto status: ${room.autoSpeechState.status}`,
    pendingFollowup
      ? `Pending follow-up: ${pendingFollowup.nextMove}${pendingFollowup.targetRoleId ? ` -> ${pendingFollowup.targetRoleId}` : ""}; reason=${pendingFollowup.reason}; run=${pendingFollowup.runCount}/${pendingFollowup.maxRuns}`
      : "Pending follow-up: none",
    room.lastTerminationReason ? `Last guard stop: ${room.lastTerminationReason}` : "",
    assessment
      ? `Situation: phase=${assessment.phase}; nextMove=${assessment.nextMove}; material=${assessment.materialSufficiency}; conflict=${assessment.conflictLevel}; visibilityRisk=${assessment.visibilityRisk}`
      : "",
    assessment?.reason ? `Situation reason: ${trimPromptLine(assessment.reason, 180)}` : "",
    assessment?.blockers?.length ? `Situation blockers: ${assessment.blockers.map((item) => trimPromptLine(item, 80)).join(" / ")}` : "",
    `Debate state: phase=${match.debatePhase ?? "none"}; round=${match.round}; spoken=${spokenThisRound.length}/${requiredDebateSpeakers}; skipped=${skippedThisRound.length}; next=${match.nextSpeakerRoleId ?? "none"}; deferredVerdict=${(match.deferredRequirements ?? []).length}`,
    room.simulation
      ? `Simulation: phase=${room.simulation.phase}; tension=${room.simulation.tension}; focus=${trimPromptLine(room.simulation.currentFocus || "none", 120)}`
      : "",
    room.plot
      ? `Plot: phase=${room.plot.phase}; pressure=${trimPromptLine(room.plot.currentPressure || "none", 120)}; publicHooks=${visibleHooks}; hiddenHooks=${hiddenHooks}; next=${trimPromptLine(room.plot.nextBeat || "none", 120)}`
      : "",
  ];
  return { title: "State Capsule", lines: lines.filter(Boolean) };
}

export function buildDirectorTaskCard(
  plan: DirectorTurnPlan,
  assessment?: SituationAssessmentSummary | null,
): PromptTaskCard {
  const directives = plan.privateDirectives ?? [];
  const lines = [
    `Move: ${plan.move}`,
    `Public text reason: ${plan.publicTextReason ?? "none"}`,
    `Wait for user: ${String(plan.waitForUser)}`,
    `Next speaker: ${plan.nextSpeakerRoleId ?? "none"}`,
    assessment ? `Recommended next move: ${assessment.nextMove}` : "",
    plan.publicText ? `Draft public text: ${trimPromptLine(plan.publicText, 180)}` : "",
    directives.length
      ? `Private directives: ${directives
          .map((directive) => `${directive.roleId}: ${trimPromptLine(directive.task, 120)}`)
          .join(" / ")}`
      : "Private directives: none",
    "If public text is not needed, keep publicText empty and use private directives or state patch.",
    "Do not restart setup, reschedule completed speakers, reveal private directives, or describe backend judgement.",
  ];
  return { title: "Current Turn Task Card", lines: lines.filter(Boolean) };
}

export interface PromptRoleTaskInput {
  modeTask?: string;
  turnGoal?: string;
  targetLabel?: string;
  schedulerReason?: string;
  schedulerIntent?: string;
  privateDirective?: string;
  collaboration?: string;
  forbiddenMoves?: string[];
}

export function buildRoleTaskCard(
  role: RoomParticipant,
  plan: PromptRoleTaskInput,
  visibilityContext?: string | string[],
): PromptTaskCard {
  const visibilityLines = Array.isArray(visibilityContext) ? visibilityContext : visibilityContext ? [visibilityContext] : [];
  const lines = [
    `Speaker: ${role.displayName || role.name}`,
    plan.targetLabel ? `Target: ${plan.targetLabel}` : "",
    plan.modeTask ? `Mode task: ${trimPromptLine(plan.modeTask, 180)}` : "",
    plan.turnGoal ? `Turn goal: ${trimPromptLine(plan.turnGoal, 180)}` : "",
    plan.privateDirective ? `Private task: ${trimPromptLine(plan.privateDirective, 180)}` : "",
    plan.collaboration ? `Collaboration: ${trimPromptLine(plan.collaboration, 180)}` : "",
    plan.schedulerReason ? `Scheduler reason: ${plan.schedulerReason}` : "",
    plan.schedulerIntent ? `Scheduler intent: ${trimPromptLine(plan.schedulerIntent, 120)}` : "",
    ...visibilityLines.map((line) => `Visibility: ${trimPromptLine(line, 180)}`),
    plan.forbiddenMoves?.length ? `Do not: ${plan.forbiddenMoves.map((item) => trimPromptLine(item, 80)).join(" / ")}` : "",
    "Speak or act directly for this turn. Do not host the room, schedule another speaker, repeat setup instructions, or mention backend rules.",
  ];
  return { title: "Current Turn Task Card", lines: lines.filter(Boolean) };
}

export function buildPromptMemoryCapsule(
  queryResult: string[] | string | null | undefined,
  title = "Memory Capsule",
): PromptMemoryCapsule {
  const rawLines = Array.isArray(queryResult)
    ? queryResult
    : typeof queryResult === "string"
      ? queryResult.split(/\r?\n/)
      : [];
  const lines = rawLines
    .map((line) => line.replace(/^[-\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 16)
    .map((line) => trimPromptLine(line, 180));
  return { title, lines: lines.length ? lines : ["none"] };
}

export function buildPromptGuardFeedback(room: RoomState): PromptGuardFeedback {
  const assessment = room.simulation.situationAssessment;
  const debateStarted = room.match.debatePhase && room.match.debatePhase !== "setup_pending";
  const lines = [
    room.lastTerminationReason ? `Last stop reason: ${room.lastTerminationReason}` : "",
    room.simulation.stopReason ? `Simulation stop reason: ${room.simulation.stopReason}` : "",
    room.simulation.nextPressure ? `Next pressure: ${trimPromptLine(room.simulation.nextPressure, 160)}` : "",
    assessment?.blockers?.length ? `Recent blockers: ${assessment.blockers.map((item) => trimPromptLine(item, 80)).join(" / ")}` : "",
    debateStarted ? "Debate has already started. Do not restart setup unless the user explicitly resets the room." : "",
    room.match.debatePhase === "verdict_due" ? "Debate verdict is due. Do not assign another required speaker for the completed round." : "",
  ];
  return { title: "Guard Feedback", lines: lines.filter(Boolean).length ? lines.filter(Boolean) : ["none"] };
}

function appendPromptLayer(parts: string[], title: string, text?: string): void {
  const trimmed = text?.trim();
  if (!trimmed) {
    return;
  }
  parts.push("", `## ${title}`, trimmed);
}

function renderPromptCapsule(capsule?: PromptStateCapsule | PromptMemoryCapsule | PromptTaskCard | PromptGuardFeedback): string {
  if (!capsule || capsule.lines.length === 0) {
    return "";
  }
  return capsule.lines.map((line) => `- ${line}`).join("\n");
}

function trimPromptLine(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxChars ? `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...` : normalized;
}

export function resolvePromptEditorTarget(viewState: PromptCenterViewState, state: ConsoleAppState): PromptEditorTarget {
  const room = findRoomById(state, viewState.selectedRoomId) ?? state.room;
  const selectedMode = viewState.selectedPromptMode ?? resolveRoomPromptMode(room);
  if (viewState.mode === "characters") {
    const pack = state.packs.find((item) => item.id === viewState.selectedPackId) ?? state.packs.find((item) => item.id === state.selectedPackId) ?? state.packs[0] ?? null;
    return {
      scope: "character_pack",
      targetId: pack?.id ?? viewState.selectedPackId ?? state.selectedPackId,
      title: pack?.name ?? "Character Pack",
      room: null,
      participant: null,
    };
  }
  const selectedType = viewState.selectedType;
  if (selectedType === "director") {
    const mode = selectedMode;
    const template = getRoomModeTemplate(mode);
    return {
      scope: "director",
      targetId: directorModePromptTargetId(room, mode),
      title: `${room.title} / ${template.name} / Director Rules`,
      room,
      participant: null,
    };
  }

  if (selectedType === "roles") {
    const participant = room.participants.find((item) => item.roleId === viewState.selectedRoleId || item.id === viewState.selectedRoleId) ?? room.participants[0] ?? null;
    return {
      scope: "character_pack",
      targetId: participant ? participant.packId : "",
      title: participant ? `${participant.displayName} Character Prompt` : "Character Prompt",
      room,
      participant,
    };
  }

  const mode = selectedMode;
  const template = getRoomModeTemplate(mode);
  return {
    scope: "room",
    targetId: roomModePromptTargetId(room, mode),
    title: `${room.title} / ${template.name} / Room Rules`,
    room,
    participant: null,
  };
}

export function resolvePromptEditorPreview(scope: PromptScope, targetId: string, state: ConsoleAppState): EffectivePrompt {
  if (scope === "room") {
    const room = findRoomByPromptTarget(state, targetId);
    return room && promptModeFromTarget(targetId)
      ? promptEditorEffective(scope, targetId, state)
      : room ? resolveRoomPrompt(room, state) : resolveEffectivePrompt(scope, targetId, state);
  }

  if (scope === "director") {
    const room = findRoomByDirectorTarget(state, targetId);
    return room && promptModeFromTarget(targetId)
      ? promptEditorEffective(scope, targetId, state)
      : room ? resolveDirectorPrompt(room, state) : resolveEffectivePrompt(scope, targetId, state);
  }

  if (scope === "room_role") {
    const participant = findRoomRoleByPromptTarget(state, targetId);
    return participant ? resolveRoomRolePrompt(participant, state) : resolveEffectivePrompt(scope, targetId, state);
  }

  return resolveEffectivePrompt(scope, targetId, state);
}

export function resolvePromptEditorSource(scope: PromptScope, targetId: string, state: ConsoleAppState): PromptEditorSource {
  const directOverride = findPromptOverride(state.prompts, scope, targetId);
  const directText = directOverride?.enabled ? (directOverride.activeText ?? directOverride.text).trim() : "";
  if (directOverride && directText) {
    if (scope === "room_role") {
      return { label: "Role custom", detail: directOverride.title };
    }
    if (scope === "character_pack") {
      return { label: "Character pack", detail: directOverride.title };
    }
    const mode = promptModeFromTarget(targetId);
    const modeDetail = mode ? getRoomModeTemplate(mode).name : null;
    return { label: "Room custom", detail: modeDetail ? `${directOverride.title} · ${modeDetail}` : directOverride.title };
  }

  if (scope === "room") {
    const room = findRoomByPromptTarget(state, targetId);
    const legacy = room ? findLegacyRoomPromptFallback(state, "room", room.id) : null;
    if (legacy && room) {
      return { label: "Legacy custom", detail: legacy.targetId === roomPromptTargetId(room) ? "Old room prompt" : legacy.targetId };
    }
    const mode = promptModeFromTarget(targetId) ?? (room ? resolveRoomPromptMode(room) : null);
    return { label: "Template", detail: mode ? `${getRoomModeTemplate(mode).name} template` : targetId };
  }

  if (scope === "director") {
    const room = findRoomByDirectorTarget(state, targetId);
    const legacy = room ? findLegacyRoomPromptFallback(state, "director", room.id) : null;
    if (legacy && room) {
      return { label: "Legacy custom", detail: legacy.targetId === directorPromptTargetId(room) ? "Old director prompt" : legacy.targetId };
    }
    const mode = promptModeFromTarget(targetId) ?? (room ? resolveRoomPromptMode(room) : null);
    return { label: "Template", detail: mode ? `${getRoomModeTemplate(mode).name} Director template` : targetId };
  }

  if (scope === "room_role") {
    const participant = findRoomRoleByPromptTarget(state, targetId);
    const legacy = participant ? findPromptOverride(state.prompts, "room_role", participant.roleId) : null;
    const legacyText = legacy?.enabled ? (legacy.activeText ?? legacy.text).trim() : "";
    if (legacy && legacyText) {
      return { label: "Legacy custom", detail: legacy.title };
    }
    return { label: "Character pack", detail: participant?.packId ?? targetId };
  }

  return { label: "Character pack", detail: targetId };
}

export function hasPromptChangedSinceApply(draft: PromptDraft | null, state: ConsoleAppState): boolean {
  if (!draft) {
    return false;
  }
  const override = findPromptOverride(state.prompts, draft.scope, draft.targetId);
  const activeText = override?.enabled ? (override.activeText ?? override.text).trim() : "";
  return draft.text.trim() !== activeText;
}

export function characterWithEffectivePrompt(
  character: CharacterViewModel,
  state: ConsoleAppState,
): CharacterViewModel {
  return {
    ...character,
    promptText: resolveCharacterPackPrompt(character.id, state).text,
  };
}

export function defaultPromptText(scope: PromptScope, targetId: string, state: ConsoleAppState): string {
  if (scope === "room") {
    const room = findRoomByPromptTarget(state, targetId);
    if (room) {
      const mode = promptModeFromTarget(targetId) ?? resolveRoomPromptMode(room);
      const template = getRoomModeTemplate(mode);
      return compileRoomRulesPrompt({
        mode,
        values: Object.fromEntries(template.roomFields.map((field) => [field.key, field.defaultValue])),
      });
    }
    return getRoomPromptProfile(targetId as ConsoleAppState["room"]["promptProfileId"]).systemPrompt;
  }

  if (scope === "director") {
    const room = findRoomByDirectorTarget(state, targetId);
    if (room) {
      const mode = promptModeFromTarget(targetId) ?? resolveRoomPromptMode(room);
      const template = getRoomModeTemplate(mode);
      return compileDirectorRulesPrompt({
        mode,
        values: Object.fromEntries(template.directorFields.map((field) => [field.key, field.defaultValue])),
      });
    }
    const profile = getDirectorPromptProfile(targetId as ConsoleAppState["room"]["director"]["profileId"]);
    return [profile.systemPrompt, ...profile.decisionRules.map((rule) => `- ${rule}`)].join("\n");
  }

  if (scope === "room_role") {
    const participant = findRoomRoleByPromptTarget(state, targetId);
    if (participant) {
      const room = findRoomForParticipant(state, participant);
      const mode = room ? resolveRoomPromptMode(room) : "casual";
      const template = getRoomModeTemplate(mode);
      return compileRoomRoleOverridePrompt({
        mode,
        values: Object.fromEntries(template.roleFields.map((field) => [field.key, field.defaultValue])),
      });
    }
  }

  return getPackManifest(targetId).promptText.trim();
}

function promptEditorText(scope: PromptScope, targetId: string, state: ConsoleAppState): string {
  const draft = findPromptDraft(state.prompts, scope, targetId);
  if (draft) {
    return draft.text;
  }
  const override = findPromptOverride(state.prompts, scope, targetId);
  if (override) {
    return override.text;
  }
  if (scope === "room" || scope === "director") {
    const parsed = parseModePromptTarget(targetId, scope);
    if (parsed) {
      const legacy = findLegacyRoomPromptFallback(state, scope, parsed.roomId);
      if (legacy) {
        return legacy.text;
      }
    }
  }
  return defaultPromptText(scope, targetId, state);
}

function promptEditorEffective(scope: PromptScope, targetId: string, state: ConsoleAppState): EffectivePrompt {
  const draft = findPromptDraft(state.prompts, scope, targetId);
  if (draft) {
    return {
      scope,
      targetId,
      text: draft.text,
      source: "override",
      revision: draft.sourceRevision,
    };
  }
  const override = findPromptOverride(state.prompts, scope, targetId);
  const overrideText = override?.enabled ? (override.activeText ?? override.text).trim() : "";
  if (override && overrideText) {
    return {
      scope,
      targetId,
      text: overrideText,
      source: "override",
      revision: override.appliedRevision ?? override.revision,
    };
  }
  if (scope === "room" || scope === "director") {
    const parsed = parseModePromptTarget(targetId, scope);
    if (parsed) {
      const legacy = findLegacyRoomPromptFallback(state, scope, parsed.roomId);
      if (legacy) {
        return legacy;
      }
    }
  }
  return resolveEffectivePrompt(scope, targetId, state);
}

function findLegacyRoomPromptFallback(
  state: ConsoleAppState,
  scope: "room" | "director",
  roomId: string,
): EffectivePrompt | null {
  if (hasAnyModePromptOverride(state, scope, roomId)) {
    return null;
  }

  const targetId = scope === "room" ? `room:${roomId}` : `director:${roomId}`;
  const override = findPromptOverride(state.prompts, scope, targetId);
  const overrideText = override?.enabled ? (override.activeText ?? override.text).trim() : "";
  if (!override || !overrideText) {
    return null;
  }

  return {
    scope,
    targetId,
    text: overrideText,
    source: "override",
    revision: override.appliedRevision ?? override.revision,
  };
}

function hasAnyModePromptOverride(state: ConsoleAppState, scope: "room" | "director", roomId: string): boolean {
  const prefix = `${scope}:${roomId}:mode:`;
  return state.prompts.overrides.some((override) => {
    const text = override.enabled ? (override.activeText ?? override.text).trim() : "";
    return override.scope === scope && override.targetId.startsWith(prefix) && Boolean(text);
  });
}

function promptModeFromTarget(targetId: string): RoomContextPanelMode | null {
  return parseModePromptTarget(targetId, "room")?.mode ?? parseModePromptTarget(targetId, "director")?.mode ?? null;
}

function parseModePromptTarget(
  targetId: string,
  scope: "room" | "director",
): { roomId: string; mode: RoomContextPanelMode } | null {
  const prefix = `${scope}:`;
  if (!targetId.startsWith(prefix)) {
    return null;
  }
  const body = targetId.slice(prefix.length);
  const marker = ":mode:";
  const markerIndex = body.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }
  const roomId = body.slice(0, markerIndex);
  const mode = body.slice(markerIndex + marker.length);
  if (!roomId || !isRoomPromptMode(mode)) {
    return null;
  }
  return { roomId, mode };
}

function isRoomPromptMode(value: string): value is RoomContextPanelMode {
  return roomModePromptTemplates.some((template) => template.mode === value);
}

function extractPromptFieldValue(text: string, field: PromptTemplateField): string | null {
  const escaped = field.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`(?:^|\\n)## ${escaped}\\n([\\s\\S]*?)(?=\\n## |$)`).exec(text);
  return match?.[1]?.trim() || null;
}

function findRoomByPromptTarget(state: ConsoleAppState, targetId: string): RoomState | null {
  if (!targetId.startsWith("room:")) {
    return null;
  }
  const parsed = parseModePromptTarget(targetId, "room");
  const roomId = parsed?.roomId ?? targetId.slice("room:".length);
  return state.rooms?.find((room) => room.id === roomId) ?? (state.room.id === roomId ? state.room : null);
}

function findRoomById(state: ConsoleAppState, roomId: string): RoomState | null {
  return state.rooms?.find((room) => room.id === roomId) ?? (state.room.id === roomId ? state.room : null);
}

function findRoomByDirectorTarget(state: ConsoleAppState, targetId: string): RoomState | null {
  if (!targetId.startsWith("director:")) {
    return null;
  }
  const parsed = parseModePromptTarget(targetId, "director");
  const roomId = parsed?.roomId ?? targetId.slice("director:".length);
  return state.rooms?.find((room) => room.id === roomId) ?? (state.room.id === roomId ? state.room : null);
}

function findRoomRoleByPromptTarget(state: ConsoleAppState, targetId: string): RoomParticipant | null {
  const [roomId, roleId] = targetId.includes(":") ? targetId.split(":", 2) : ["", targetId];
  const room = roomId ? state.rooms?.find((item) => item.id === roomId) ?? (state.room.id === roomId ? state.room : null) : state.room;
  return room?.participants.find((item) => item.roleId === roleId || item.id === roleId) ?? null;
}

function findRoomForParticipant(state: ConsoleAppState, participant: RoomParticipant): RoomState | null {
  const roomId = participant.memoryScope.startsWith("room:") ? participant.memoryScope.slice("room:".length) : "";
  return roomId ? findRoomById(state, roomId) : null;
}

export function validatePromptText(text: string): string | null {
  const value = text.trim();
  if (!value) {
    return "Prompt cannot be empty.";
  }
  if (value.length > maxPromptOverrideChars) {
    return `Prompt is too long. Keep it under ${maxPromptOverrideChars} characters.`;
  }
  return null;
}
