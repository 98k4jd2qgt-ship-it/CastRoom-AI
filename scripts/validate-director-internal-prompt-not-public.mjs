import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];
const scheduler = await loadScheduler();

const mainSource = fs.readFileSync("src/main.ts", "utf8");
expect(
  !mainSource.includes("userInput: userInput || result.speechIntent.reason"),
  "ask_director handoff must not pass internal speechIntent.reason as public userInput.",
);

const room = createRoomFixture({
  promptProfileId: "casual-chat",
  directorProfileId: "host",
  recipeId: "casual",
});
room.topic = "Daily chat";
room.messages.push(roomMessage("user", "You", "那就坐吧", "user"));

const internalPrompt = "Naturally settle the current pace and give the next cue. Reason: idle_auto.";
const result = scheduler.scheduleRoomDirectorTurn({
  room,
  nowLabel: "01:00",
  userInput: internalPrompt,
  requestedMove: "cue",
  reason: "recipe",
});

expect(result.type === "turn", "Internal handoff should still produce a Director turn plan.");
expect(result.type === "turn" && !result.message, "Internal casual handoff should stay backstage and not publish to the main channel.");
expect(
  result.type === "turn" && !containsInternalPrompt(result.plan?.publicText ?? ""),
  "Director public narration must not expose internal handoff wording.",
);
expect(
  result.type === "turn" && result.plan?.publicTextReason === "none",
  "Safe replacement narration should not be classified as scheduling text.",
);
expect(
  result.type === "turn" && (result.plan?.privateDirectives?.length ?? 0) > 0,
  "Blocking internal public text must not remove backstage role directives.",
);

const leakedChinese = "新的线索浮了出来：请自然地收束当前节奏，给出下一步提示；原因：idle_auto。";
expect(
  scheduler.isDirectorPublicSchedulingText(leakedChinese),
  "Scheduling detector should block Chinese internal handoff text if a model echoes it.",
);
expect(
  scheduler.isDirectorPublicSchedulingText("Director check: repetition_guard; give the next cue."),
  "Scheduling detector should block English internal Director debug text.",
);

if (failures.length > 0) {
  console.error(`validate-director-internal-prompt-not-public failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-internal-prompt-not-public passed");

function containsInternalPrompt(text) {
  return /(?:Naturally settle the current pace|give the next cue|Reason:\s*idle_auto|idle_auto|请自然地收束当前节奏|给出下一步提示|原因：idle_auto)/i.test(text);
}

async function loadScheduler() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-director-internal-"));
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
    id: "internal-prompt-room",
    isOpen: true,
    autoChat: true,
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
      currentFocus: "Waiting for the room to continue.",
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
    topic: "Daily chat",
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
      memoryScope: "room:internal-prompt-room:system",
      lastMove: null,
      lastSpokeAt: null,
      sceneBoard: {
        title: "Casual Room",
        currentScene: "A casual room",
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
    memoryScope: "room:internal-prompt-room",
    currentEmotion: "idle",
    viewportState: "idle",
    mood: "idle",
  };
}

function roomMessage(roleId, speaker, text, speakerType = "role") {
  return {
    id: `msg-${roleId}`,
    at: "01:00",
    speaker,
    text,
    kind: speakerType === "user" ? "user" : "character",
    speakerType,
    speakerId: roleId,
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
