import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];
const scheduler = await loadScheduler();

const room = createRoomFixture({
  promptProfileId: "mystery",
  directorProfileId: "mystery-director",
  recipeId: "mystery",
});

const narration = scheduler.scheduleRoomDirectorTurn({
  room,
  nowLabel: "01:00",
  userInput: "A faint scrape comes from behind the cabinet.",
  requestedMove: "cue",
  reason: "recipe",
});

expect(narration.type === "turn", "Director cue should produce a turn.");
expect(narration.type === "turn" && narration.plan?.publicTextReason === "narration", "Director cue should be classified as public narration.");
expect(narration.type === "turn" && narration.message, "Director narration should publish directly to the room timeline.");
expect(narration.type === "turn" && narration.message?.target === "all", "Director narration should target the whole room.");
expect(narration.type === "turn" && narration.message?.visibility === "public", "Director narration should be public in the active room channel.");
expect(narration.type === "turn" && (narration.plan?.privateDirectives?.length ?? 0) > 0, "Director narration should still create backstage role scheduling.");
expect(
  narration.type === "turn" && !scheduler.isDirectorPublicSchedulingText(narration.message?.text ?? ""),
  "Director public narration must not expose next-speaker scheduling.",
);

const schedulingText = "Care-4 acts next. Ask Archive-3 to reply after that.";
expect(scheduler.isDirectorPublicSchedulingText(schedulingText), "Scheduling-language detector should catch public next-speaker text.");
const blocked = scheduler.scheduleRoomDirectorTurn({
  room,
  nowLabel: "01:01",
  reason: "recipe",
  planOverride: {
    move: "cue",
    publicText: schedulingText,
    publicTextReason: "narration",
    privateDirectives: [],
    nextSpeakerRoleId: null,
    sceneDelta: {},
    continuityWrites: [],
    secretWrites: [],
    knowledgeVisibility: "public",
    waitForUser: false,
  },
});

expect(blocked.type === "turn" && !blocked.message, "Scheduling text must not be committed as public narration.");

const casualChoiceRoom = createRoomFixture({
  promptProfileId: "casual-chat",
  directorProfileId: "host",
  recipeId: "casual",
});
casualChoiceRoom.topic = "Daily chat";
const casualChoice = scheduler.scheduleRoomDirectorTurn({
  room: casualChoiceRoom,
  nowLabel: "01:02",
  userInput: "",
  requestedMove: "choice",
  reason: "recipe",
});

expect(casualChoice.type === "turn", "Casual Director choice should still produce a backstage turn plan.");
expect(casualChoice.type === "turn" && !casualChoice.message, "Casual Director choice must not publish a host scheduling line to the public timeline.");
expect(casualChoice.type === "turn" && casualChoice.plan?.publicTextReason === "none", "Casual Director choice without a required user choice should keep publicTextReason none.");
expect(casualChoice.type === "turn" && (casualChoice.plan?.privateDirectives?.length ?? 0) > 0, "Casual Director choice should keep role scheduling in private directives.");
expect(scheduler.isDirectorPublicSchedulingText("先把话题收一下：Daily chat。接下来只补一个有用方向。"), "Chinese generic recap scheduling text should be blocked.");
expect(scheduler.isDirectorPublicSchedulingText("Light recap: Daily chat. Add only one useful next direction."), "English generic recap scheduling text should be blocked.");

if (failures.length > 0) {
  console.error(`validate-director-narration-vs-scheduling failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-narration-vs-scheduling passed");

async function loadScheduler() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-director-narration-"));
  for (const file of [
    "src/core/roomProfiles.ts",
    "src/core/roomVisibility.ts",
    "src/core/debatePolicy.ts",
    "src/core/directorModePolicy.ts",
    "src/core/roomCollaborationPolicy.ts",
    "src/core/inputInterpretation.ts",
    "src/core/roomRuleGuards.ts",
    "src/core/roomScheduler.ts",
  ]) {
    const source = fs.readFileSync(file, "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      },
    }).outputText.replace(/from "(\.\/[^"]+)";/g, 'from "$1.js";');
    fs.writeFileSync(path.join(tempDir, `${path.basename(file, ".ts")}.js`), js, "utf8");
  }
  return import(pathToFileURL(path.join(tempDir, "roomScheduler.js")).href);
}

function createRoomFixture(overrides = {}) {
  const apiProfile = {
    mode: "use_room",
    providerId: "local-model",
    secretRef: null,
    keyPreview: "",
    baseUrl: "",
    chatModel: "local",
    visionModel: "",
    temperature: 0.7,
    maxTokens: 300,
    status: "ready",
  };
  const participants = [
    createParticipant("archive", "Archive-3", apiProfile),
    createParticipant("care", "Care-4", apiProfile),
  ];
  return {
    id: "narration-room",
    isOpen: true,
    autoChat: false,
    flowMode: "player_reactive",
    freedomLevel: "balanced",
    simulationObjective: "casual",
    simulation: {
      enabled: false,
      style: "casual",
      playerIntervention: "watch",
      uncertaintyProfile: "balanced",
      phase: "setup",
      beatIndex: 0,
      currentFocus: "Waiting for the room to start.",
      tension: 20,
      noveltyScore: 100,
      lastSpeakerIds: [],
      openHooks: [],
    },
    match: {
      round: 1,
      currentSide: undefined,
      scoreboard: [],
      winCondition: "Keep the room moving.",
      judgeNotes: [],
    },
    topic: "A locked cabinet sits in a quiet room.",
    speed: "normal",
    collaborationMode: "free_talk",
    floorOwner: { type: "none" },
    turnPhase: "wait",
    lastTerminationReason: null,
    activeDiscussionPlan: null,
    apiProfile,
    expandedApiRoleId: null,
    expandedInspectorSection: null,
    promptProfileId: overrides.promptProfileId ?? "casual-chat",
    autoSpeechPolicy: {
      speed: "normal",
      maxUserTriggeredFollowUps: 2,
      maxIdleBurstTurns: 3,
      minDelayMs: 1000,
      maxDelayMs: 3000,
      allowDirectorIntervention: true,
    },
    autoSpeechState: {
      status: "paused",
      nextTurnAt: null,
      consecutiveAutoTurns: 0,
      userTriggeredFollowUps: 0,
      lastTurnAt: null,
      lastStopReason: null,
    },
    privateWhispers: "off",
    privateWhisperPolicy: {
      maxConsecutivePrivateTurns: 3,
      showHiddenHint: true,
      savePrivateToRoomMemory: true,
    },
    hiddenWhisperCount: 0,
    factionHuddles: "off",
    factions: [],
    activeChannelId: "public",
    hiddenFactionHuddleCount: 0,
    factionHuddleThreads: [],
    userFactionHuddle: null,
    userProfile: { userId: "local-user", displayName: "You", aliases: ["You", "me"] },
    director: {
      enabled: true,
      directorId: "room-director",
      displayName: "Director",
      aliases: ["director", "gm", "system"],
      profileId: overrides.directorProfileId ?? "host",
      recipeId: overrides.recipeId ?? "casual",
      apiProfile,
      memoryScope: "room:narration-room:system",
      lastMove: null,
      lastSpokeAt: null,
      sceneBoard: {
        title: "Test Scene",
        currentScene: "A quiet room",
        goal: "Keep the room moving",
        mood: "calm",
        openClues: [],
        unresolved: [],
        updatedAt: null,
      },
      constraints: [],
      overrideLog: [],
    },
    highlightedTargets: [],
    lastSpeakerId: null,
    participants,
    messages: [],
  };
}

function createParticipant(id, name, apiProfile) {
  return {
    id,
    roleId: id,
    packId: `demo-${id}`,
    name,
    displayName: name,
    factionId: null,
    apiProfile,
    memoryScope: "room:narration-room",
    currentEmotion: "idle",
    viewportState: "idle",
    mood: "idle",
  };
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
