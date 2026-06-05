import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];
const scheduler = await loadScheduler();

const room = createRoomFixture();
const chineseLockClaim = userMessage("\u6211\u6253\u5f00\u4e86\u9501");
const chineseCheck = scheduler.evaluateRoomAction({
  room,
  message: chineseLockClaim,
  userInput: chineseLockClaim.text,
});
expect(chineseCheck.result !== "allowed", "Chinese lock-open outcome claims should require Director judgement.");
expect(chineseCheck.suggestedDirectorMove === "judge", "Lock-open outcome claims should route to judge.");

const unsupportedClaim = userMessage("I opened the lock.");
const unsupportedRoom = { ...room, messages: [unsupportedClaim] };
const unsupportedCheck = scheduler.evaluateRoomAction({
  room: unsupportedRoom,
  message: unsupportedClaim,
  userInput: unsupportedClaim.text,
});
const unsupportedResult = scheduler.scheduleRoomDirectorTurn({
  room: unsupportedRoom,
  nowLabel: "01:00",
  userInput: `${unsupportedClaim.text}\nDirector check: ${unsupportedCheck.result}. ${unsupportedCheck.reason}`,
  requestedMove: unsupportedCheck.suggestedDirectorMove ?? "judge",
  reason: "recipe",
});

expect(unsupportedResult.type === "turn", "Unsupported lock claim should produce a Director turn.");
expect(
  unsupportedResult.type === "turn" && unsupportedResult.plan?.judgement?.outcome === "fail",
  "Unsupported lock claim should fail when no key, tool, permission, skill, or scene condition supports it.",
);
expect(
  unsupportedResult.type === "turn" && (unsupportedResult.plan?.continuityWrites?.length ?? 0) === 0,
  "Unsupported lock claim must not write continuity facts.",
);
expect(
  unsupportedResult.type === "turn" && (unsupportedResult.plan?.structuredOutcome?.memoryWrites?.continuityWrites?.length ?? 0) === 0,
  "Unsupported lock claim must not mirror continuity facts into memory writes.",
);

const supportedClaim = userMessage("I opened the lock.");
const supportedRoom = { ...room, messages: [supportedClaim] };
const supportedCheck = scheduler.evaluateRoomAction({
  room: supportedRoom,
  message: supportedClaim,
  userInput: supportedClaim.text,
});
const supportedResult = scheduler.scheduleRoomDirectorTurn({
  room: supportedRoom,
  nowLabel: "01:01",
  userInput: `${supportedClaim.text}\nDirector check: ${supportedCheck.result}. ${supportedCheck.reason}`,
  requestedMove: supportedCheck.suggestedDirectorMove ?? "judge",
  reason: "recipe",
  directorMemory: createDirectorMemorySnapshot("You has the brass key for the lock."),
});

expect(supportedResult.type === "turn", "Supported lock claim should produce a Director turn.");
expect(
  supportedResult.type === "turn" && supportedResult.plan?.judgement?.outcome === "success",
  "Supported lock claim should succeed when visible Director memory contains a matching key.",
);
expect(
  supportedResult.type === "turn" && (supportedResult.plan?.continuityWrites?.length ?? 0) > 0,
  "Supported lock claim may write continuity after a successful judgement.",
);

if (failures.length > 0) {
  console.error(`validate-room-action-fact-gate failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-room-action-fact-gate passed");

async function loadScheduler() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-action-fact-gate-"));
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

function createDirectorMemorySnapshot(detail) {
  return {
    summary: "",
    entries: [],
    judgements: [],
    constraints: [],
    secrets: [],
    sceneBoard: {
      title: "Test Scene",
      currentScene: "A quiet room",
      goal: "Open the locked cabinet only if supported.",
      mood: "tense",
      openClues: [],
      unresolved: [],
      updatedAt: null,
    },
    continuity: {
      entries: [
        {
          id: "key-fact",
          label: "Continuity",
          detail,
          visibility: "public",
          ownerRoleIds: [],
          status: "active",
          updatedAt: "01:00",
        },
      ],
    },
  };
}

function createRoomFixture() {
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
  const participants = [createParticipant("archive", "Archive-3", apiProfile)];
  return {
    id: "fact-gate-room",
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
    promptProfileId: "story",
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
      profileId: "story-director",
      recipeId: "story",
      apiProfile,
      memoryScope: "room:fact-gate-room:system",
      lastMove: null,
      lastSpokeAt: null,
      sceneBoard: {
        title: "Test Scene",
        currentScene: "A quiet room with a locked cabinet.",
        goal: "Open the lock only with support.",
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
    memoryScope: "room:fact-gate-room",
    currentEmotion: "idle",
    viewportState: "idle",
    mood: "idle",
  };
}

function userMessage(text) {
  return {
    id: `msg-${text}`,
    at: "01:00",
    speaker: "You",
    text,
    kind: "user",
    speakerType: "user",
    speakerId: "local-user",
    target: "all",
    channelId: "public",
    visibility: "public",
  };
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
