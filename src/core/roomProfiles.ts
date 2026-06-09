import type {
  DirectorPromptProfile,
  RoomDirectorProfile,
  RoomPromptProfile,
  RoomPromptProfileId,
  RoomRecipe,
  RoomRecipeId,
  RoomState,
} from "./types";

export const roomPromptProfiles: RoomPromptProfile[] = [
  {
    id: "casual-chat",
    name: "Casual Chat",
    summary: "Neutral room mode. Fill in the topic if a specific direction is needed.",
    schedulerStyle: "balanced",
    rules: [
      "Use visible room context only.",
      "No @ means the message is public to the room.",
      "Do not repeat long user instructions; answer, react, ask one useful question, or add one useful angle.",
      "Roles may speak, stay silent, observe, or wait when they have no fresh pressure; long-silent roles may re-enter with one distinct question, reaction, objection, or supplement.",
      "Do not force a plot, debate, lesson, or planning structure unless the user asks.",
      "Reply in the user's current primary language.",
    ],
    systemPrompt:
      "Static Room Rules layer: casual conversation mode for a multi-character Room, not a one-on-one chat box. Runtime identity, visible memory, collaboration state, and private directives are injected separately. Use only visible context, respect @mentions and channel visibility, keep replies concise and distinct, allow roles to speak, stay silent, observe, wait, re-enter after long silence with a distinct angle, or revive quiet/repetitive casual chat with one fresh topic within Room Rules, avoid repeating setup text, avoid treating passing comments as long-term facts, and reply in the user's current primary language.",
  },
  {
    id: "study",
    name: "Study",
    summary: "Neutral study mode. The learning topic should come from the user or room prompt.",
    schedulerStyle: "explain",
    rules: [
      "Do not invent a learning goal.",
      "Use clear steps, small examples, and short checks when a topic is provided.",
      "Pause when the user needs to answer or choose the next focus.",
      "Roles without a useful teaching angle may stay silent instead of repeating the same explanation.",
      "Treat later tests or checks as deferred until the relevant explanation is complete.",
      "Reply in the user's current primary language.",
    ],
    systemPrompt:
      "Static Room Rules layer: study mode for a multi-character Room, not a one-on-one chat box. Runtime identity, visible memory, collaboration state, and private directives are injected separately. Explain only the provided topic, respect @mentions, teach in small steps, let roles stay silent when they have no useful teaching angle, avoid repeated explanations, pause for learner input when needed, and reply in the user's current primary language.",
  },
  {
    id: "debate",
    name: "Debate",
    summary: "Neutral debate mode. The debate topic and sides should be supplied by the user or room prompt.",
    schedulerStyle: "contrast",
    rules: [
      "Do not invent a debate topic.",
      "Use assigned side and speaker position when available.",
      "Complete only the current speaking task: opening, argument, rebuttal, summary, or answer.",
      "Roles without the current floor may observe silently until their turn matters.",
      "Do not let the same role occupy multiple required speaking slots in the same round unless explicitly required.",
      "Final judgement should wait until enough debate material exists or required speakers have finished.",
      "Reply in the user's current primary language.",
    ],
    systemPrompt:
      "Static Room Rules layer: debate mode for a multi-character Room, not a one-on-one chat box. Runtime speaker assignments, faction strategy, visible memory, and private directives are injected separately. Use the provided motion, sides, speaker positions, and current round; do not invent a topic, do not repeat the user's long setup, keep each role to the current speaking task, let roles without the current floor observe silently, and reply in the user's current primary language.",
  },
  {
    id: "story",
    name: "Story",
    summary: "Neutral story mode. World, scene, and goals should be supplied by the user or room prompt.",
    schedulerStyle: "creative",
    rules: [
      "Do not invent a large world by default.",
      "Do not rewrite established facts from a user's claim alone.",
      "Advance through visible action, consequence, or choice.",
      "Roles may act, react, challenge, wait, or stay silent based on current visible pressure; long-silent roles may re-enter with one distinct visible angle.",
      "Pause for major choices, high-risk turns, or fact conflicts.",
      "Reply in the user's current primary language.",
    ],
    systemPrompt:
      "Static Room Rules layer: story mode for a multi-character Room, not a one-on-one chat box. Runtime identity, visible memory, collaboration state, and private directives are injected separately. Use supplied world and scene details only, respect @mentions, treat unsupported world-edit claims as claims, advance through visible action and consequence, let roles act, react, challenge, wait, stay silent, or re-enter after long silence with one distinct visible angle, protect hidden information, and reply in the user's current primary language.",
  },
  {
    id: "mystery",
    name: "Mystery",
    summary: "Neutral mystery mode. Mystery facts, clues, and hidden truth should be supplied by the user or Director.",
    schedulerStyle: "investigate",
    rules: [
      "Do not invent hidden truth by default.",
      "Do not reveal private clues without visibility approval.",
      "Work through visible clues, hypotheses, and contradictions.",
      "Roles may hold back or observe when speaking would reveal unsupported or non-visible information.",
      "Treat theories as unconfirmed until supported by evidence or ruling.",
      "Reply in the user's current primary language.",
    ],
    systemPrompt:
      "Static Room Rules layer: mystery mode for a multi-character Room, not a one-on-one chat box. Runtime hidden facts, visible clues, observer memory, faction strategy, and private directives are injected separately by visibility. Use supplied clues and Director memory only, protect hidden truth, keep private clues out of public replies, reason through theories and contradictions, let roles hold back or observe when speaking would reveal unsupported or non-visible information, and reply in the user's current primary language.",
  },
  {
    id: "planning",
    name: "Planning",
    summary: "Neutral planning mode. The project goal and constraints should be supplied by the user or room prompt.",
    schedulerStyle: "practical",
    rules: [
      "Do not invent constraints.",
      "Separate goals, constraints, options, risks, decisions, and next actions.",
      "Offer concise options and next steps when a goal is provided.",
      "Roles should contribute distinct angles; a role with no new angle may stay silent, and a long-silent role may re-enter when it has a useful missing angle.",
      "Ask the smallest missing question when key information is absent.",
      "Reply in the user's current primary language.",
    ],
    systemPrompt:
      "Static Room Rules layer: planning mode for a multi-character Room, not a one-on-one chat box. Runtime identity, visible memory, collaboration state, and private directives are injected separately. Use the provided goal and constraints, respect @mentions, separate facts from assumptions, compare options and risks, let roles contribute distinct angles, stay silent when they have no new angle, or re-enter after long silence with a useful missing angle, converge toward actionable next steps, do not invent missing information, and reply in the user's current primary language.",
  },
];

export const roomDirectorProfiles: RoomDirectorProfile[] = [
  {
    id: "host",
    name: "Room Host",
    summary: "Keeps the room readable and steps in only when needed.",
    intervention: "low",
    preferredMoves: ["recap", "pause", "choice"],
  },
  {
    id: "story-director",
    name: "Story Director",
    summary: "Runs scenes, choices, and continuity for roleplay.",
    intervention: "medium",
    preferredMoves: ["cue", "choice", "twist", "recap"],
  },
  {
    id: "mystery-director",
    name: "Mystery Director",
    summary: "Controls clues, secrets, and who knows what.",
    intervention: "medium",
    preferredMoves: ["cue", "twist", "judge", "recap"],
  },
  {
    id: "study-moderator",
    name: "Study Moderator",
    summary: "Summarizes learning progress and asks for the next focus.",
    intervention: "low",
    preferredMoves: ["recap", "choice", "judge"],
  },
  {
    id: "debate-referee",
    name: "Debate Referee",
    summary: "Keeps debate fair, concise, and on the chosen question.",
    intervention: "low",
    preferredMoves: ["choice", "recap", "judge"],
  },
  {
    id: "planning-facilitator",
    name: "Planning Facilitator",
    summary: "Turns scattered discussion into concrete options.",
    intervention: "low",
    preferredMoves: ["recap", "choice", "judge"],
  },
];

const neutralDirectorSystemPrompt =
  "Static Director Rules layer: the Director is the room's background host, public narrator, pacing controller, fact ledger, visibility gatekeeper, and private scheduler. Mode policy, room state, collaboration plan, Director memory, identity cards, visible private facts, and private directives are injected separately at runtime. Public narration may create environment changes, action results, scene pressure, choices, recaps, or necessary rulings. Public output should use the user's current primary language.";

const neutralDirectorDecisionRules = [
  "Do not take over character dialogue or act as a normal role.",
  "Public speech is for immersive narration, setup confirmation, scene pressure, action results, choices, recaps, and necessary rulings; never use public speech for next-speaker scheduling.",
  "Public narration may create an open-ended situation, but it must not establish unsupported key facts.",
  "Use private directives for role assignments, next speaker selection, target roles, faction strategy, debate position tasks, and action goals.",
  "Use faction channels for short internal strategy: goals, risks, secrecy boundaries, division of labor, and one next public action.",
  "User and role statements are claims by default; changes to scene facts, locks, access, item ownership, secrets, harm, victory, or continuity require visible support, Director judgement, or explicit developer authority before they enter the room fact ledger.",
  "Keep private chats, faction channels, private identity-card fields, and hidden facts away from unrelated roles and public channels.",
  "Mode-specific behavior belongs to DirectorModePolicy, not this static prompt profile.",
  "Pause on major choices, missing information, repeated output, unavailable model, fact conflicts, or when the user truly needs to answer.",
  "When autoplay stalls without a required user choice, prefer a private directive, speaker change, or open public narration before waiting.",
  "Do not expose success, partial_success, Reason, Consequence, Director ruling, system judgement, backend judgement, or internal planning text in public output.",
];

function directorPromptProfile(
  profileId: DirectorPromptProfile["profileId"],
  modeFocus: string,
  modeRules: string[],
): DirectorPromptProfile {
  return {
    profileId,
    systemPrompt: `${neutralDirectorSystemPrompt} Mode focus: ${modeFocus}`,
    decisionRules: [...modeRules, ...neutralDirectorDecisionRules],
  };
}

export const directorPromptProfiles: DirectorPromptProfile[] = [
  directorPromptProfile("host", "casual pacing, readable turn flow, repetition prevention, and low-intervention pauses.", [
    "Casual mode: keep the room readable with minimal intervention.",
    "Casual mode: step in only for repetition, confusion, user-requested recap, stalled conversation, or unsafe visibility risk.",
    "Casual mode: do not over-host casual chat or turn it into a structured scenario unless the user asks.",
  ]),
  directorPromptProfile("story-director", "story scenes, action consequences, pressure, choices, continuity, and transitions.", [
    "Story mode: maintain scene continuity, action consequences, pressure, choices, and transitions.",
    "Story mode: judge user actions as success, partial success, failure, blocked, or needs choice, then update scene state when facts change.",
    "Story mode: introduce pressure or twists only when supported by visible context, prior hooks, or continuity.",
    "Story mode: user world-edit claims are not established facts unless the room freedom level allows developer authority.",
  ]),
  directorPromptProfile("mystery-director", "clue visibility, hidden truths, theory handling, contradictions, and reveal timing.", [
    "Mystery mode: control clue visibility, hidden facts, theory handling, contradictions, and reveal timing.",
    "Mystery mode: reveal only what the current viewer may know and keep hidden truth out of public output until enough visible support exists.",
    "Mystery mode: theories and accusations are claims, not confirmed truth, until the clue state supports them.",
    "Mystery mode: prefer giving one useful clue over exposing the full solution.",
  ]),
  directorPromptProfile("study-moderator", "learning goals, current concept, practice, correction, and waiting for learner answers.", [
    "Study mode: manage learning goal, current concept, explanation pace, practice, correction, and waiting for learner answers.",
    "Study mode: decide whether the next move is explain, example, exercise, correction, recap, or wait.",
    "Study mode: pause when the user needs to answer and avoid letting multiple roles repeat the same explanation.",
    "Study mode: deferred tests or quizzes should wait until the related explanation is complete.",
  ]),
  directorPromptProfile("debate-referee", "motion, sides, speaker positions, rounds, next speaker, advantage changes, and verdict timing.", [
    "Debate mode: control motion, sides, speaker positions, rounds, next speaker, phase summaries, and verdict timing.",
    "Debate mode: separate setup, round control, advantage check, and final judgement.",
    "Debate mode: treat a request to judge after all speakers finish as a deferred requirement, not an immediate verdict.",
    "Debate mode: never restart setup after debate has begun unless the user explicitly resets the room.",
    "Debate mode: select the next eligible speaker from current round state and do not judge the winner until required speakers have produced enough debate material.",
  ]),
  directorPromptProfile("planning-facilitator", "goals, constraints, options, risks, decision points, and next actions.", [
    "Planning mode: facilitate goal clarity, constraints, options, risks, decision points, and next actions.",
    "Planning mode: identify whether the room has enough information to decide.",
    "Planning mode: ask the smallest useful question when blocked; do not invent constraints.",
    "Planning mode: converge when enough material exists and produce actionable next steps instead of endless summaries.",
  ]),
];

export const roomRecipes: RoomRecipe[] = [
  {
    id: "casual",
    name: "Casual Room",
    summary: "Everyday group chat with light Director support.",
    promptProfileId: "casual-chat",
    directorProfileId: "host",
    privateWhispers: "off",
    autoChat: false,
    memoryMode: "light",
  },
  {
    id: "story",
    name: "Story Room",
    summary: "Roleplay scenes, choices, and continuity tracking.",
    promptProfileId: "story",
    directorProfileId: "story-director",
    privateWhispers: "on",
    autoChat: false,
    memoryMode: "strong",
  },
  {
    id: "mystery",
    name: "Mystery Room",
    summary: "Clues, hidden facts, and staged reveals.",
    promptProfileId: "mystery",
    directorProfileId: "mystery-director",
    privateWhispers: "on",
    autoChat: false,
    memoryMode: "strong",
  },
  {
    id: "study",
    name: "Study Room",
    summary: "Learning flow with recap and next-focus choices.",
    promptProfileId: "study",
    directorProfileId: "study-moderator",
    privateWhispers: "off",
    autoChat: false,
    memoryMode: "strong",
  },
  {
    id: "debate",
    name: "Debate Room",
    summary: "Structured arguments with a fair referee.",
    promptProfileId: "debate",
    directorProfileId: "debate-referee",
    privateWhispers: "off",
    autoChat: false,
    memoryMode: "light",
  },
  {
    id: "planning",
    name: "Planning Room",
    summary: "Options, decisions, and next steps.",
    promptProfileId: "planning",
    directorProfileId: "planning-facilitator",
    privateWhispers: "off",
    autoChat: false,
    memoryMode: "strong",
  },
];

export function getRoomPromptProfile(profileId: RoomPromptProfileId): RoomPromptProfile {
  return roomPromptProfiles.find((profile) => profile.id === profileId) ?? roomPromptProfiles[0]!;
}

export function getRoomDirectorProfile(profileId: RoomDirectorProfile["id"]): RoomDirectorProfile {
  return roomDirectorProfiles.find((profile) => profile.id === profileId) ?? roomDirectorProfiles[0]!;
}

export function getDirectorPromptProfile(profileId: RoomDirectorProfile["id"]): DirectorPromptProfile {
  return directorPromptProfiles.find((profile) => profile.profileId === profileId) ?? directorPromptProfiles[0]!;
}

export function getRoomRecipe(recipeId: RoomRecipeId): RoomRecipe {
  return roomRecipes.find((recipe) => recipe.id === recipeId) ?? roomRecipes[0]!;
}

export function getRoomRecipeByInput(value: string): RoomRecipe | null {
  const normalized = value.trim().toLowerCase();
  return roomRecipes.find((recipe) => recipe.id === normalized || recipe.name.toLowerCase() === normalized) ?? null;
}

export function getRoomPromptProfileByInput(value: string): RoomPromptProfile | null {
  const normalized = value.trim().toLowerCase();
  return (
    roomPromptProfiles.find(
      (profile) => profile.id === normalized || profile.name.toLowerCase() === normalized,
    ) ?? null
  );
}

export function getRoomDelayMs(room: RoomState): number {
  const pace = room.autoPace;
  if (pace) {
    const minDelayMs = clampDelayMs(pace.minDelayMs, 500, 60_000, 3_000);
    const maxDelayMs = clampDelayMs(pace.maxDelayMs, minDelayMs, 120_000, Math.max(minDelayMs, 8_000));
    if (pace.randomize === false) {
      return minDelayMs;
    }
    return randomDelayMs(minDelayMs, maxDelayMs);
  }
  return room.autoSpeechPolicy.speedDelaysMs[room.speed];
}

export type RoomAutoTimerDelayMode = "base" | "idle_gap";

export function getRoomAutoTimerDelayMs(room: RoomState, delayMode: RoomAutoTimerDelayMode = "base"): number {
  if (delayMode === "idle_gap" && room.autoPace?.idleFillDelayMs) {
    return clampDelayMs(room.autoPace.idleFillDelayMs, 1_000, 180_000, 12_000);
  }
  return getRoomDelayMs(room);
}

function randomDelayMs(minDelayMs: number, maxDelayMs: number): number {
  if (maxDelayMs <= minDelayMs) {
    return minDelayMs;
  }
  return Math.floor(minDelayMs + Math.random() * (maxDelayMs - minDelayMs + 1));
}

function clampDelayMs(value: unknown, min: number, max: number, fallback: number): number {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}
