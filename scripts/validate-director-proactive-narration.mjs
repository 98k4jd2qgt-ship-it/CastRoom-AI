import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];

const mainSource = fs.readFileSync("src/main.ts", "utf8");
const repetitionGuardBlock = functionBlock(mainSource, "directorMoveForRoomFlow");
expect(repetitionGuardBlock.includes('reason === "repetition_guard"'), "directorMoveForRoomFlow should handle repetition_guard.");
expect(repetitionGuardBlock.includes('return "twist";'), "repetition_guard should request a twist instead of pausing.");

const scheduler = await loadScheduler();
const room = createRoomFixture();
const result = scheduler.scheduleRoomDirectorTurn({
  room,
  nowLabel: "01:00",
  userInput: "repetition_guard: the room is looping on the same question.",
  requestedMove: "twist",
  reason: "recipe",
});

expect(result.type === "turn", "Proactive Director narration should produce a turn.");
expect(result.type === "turn" && result.move === "twist", "Proactive repetition recovery should use twist.");
expect(result.type === "turn" && result.plan?.publicTextReason === "narration", "Proactive twist should be public narration.");
expect(result.type === "turn" && result.message, "Proactive narration should enter the public room timeline.");
expect(result.type === "turn" && result.message?.target === "all", "Proactive narration should address the room, not @You.");
expect(result.type === "turn" && result.message?.visibility === "public", "Proactive narration should be public.");
expect(result.type === "turn" && !result.plan?.waitForUser, "Proactive narration should not force waiting_user.");
expect(
  result.type === "turn" && !scheduler.isDirectorPublicSchedulingText(result.message?.text ?? ""),
  "Proactive narration should not expose private role scheduling.",
);
expect(
  result.type === "turn" && (result.plan?.privateDirectives?.length ?? 0) > 0,
  "Proactive narration should still create backstage follow-up direction.",
);

if (failures.length > 0) {
  console.error(`validate-director-proactive-narration failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-proactive-narration passed");

async function loadScheduler() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-proactive-narration-"));
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
  const participants = [
    createParticipant("archive", "Archive-3", apiProfile),
    createParticipant("care", "Care-4", apiProfile),
  ];
  return {
    id: "proactive-room",
    isOpen: true,
    autoChat: true,
    flowMode: "auto_simulation",
    freedomLevel: "balanced",
    simulationObjective: "story",
    simulation: {
      enabled: true,
      style: "story",
      playerIntervention: "watch",
      uncertaintyProfile: "balanced",
      phase: "rising",
      beatIndex: 3,
      currentFocus: "The room is repeating the same question.",
      tension: 45,
      noveltyScore: 12,
      lastSpeakerIds: ["archive", "care"],
      openHooks: [],
    },
    match: {
      round: 1,
      currentSide: undefined,
      scoreboard: [],
      winCondition: "Keep the room moving.",
      judgeNotes: [],
    },
    topic: "AI characters are stuck in a loop.",
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
      consecutiveAutoTurns: 2,
      userTriggeredFollowUps: 0,
      lastTurnAt: null,
      lastStopReason: "repetition_guard",
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
      memoryScope: "room:proactive-room:system",
      lastMove: null,
      lastSpokeAt: null,
      sceneBoard: {
        title: "Loop Scene",
        currentScene: "A quiet room where everyone keeps circling the same point.",
        goal: "Break the loop with a reversible event.",
        mood: "tense",
        openClues: [],
        unresolved: [],
        updatedAt: null,
      },
      constraints: [],
      overrideLog: [],
    },
    highlightedTargets: [],
    lastSpeakerId: "care",
    participants,
    messages: [
      roomMessage("archive", "Archive-3", "We are repeating the same concern."),
      roomMessage("care", "Care-4", "We are repeating the same concern."),
    ],
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
    memoryScope: "room:proactive-room",
    currentEmotion: "idle",
    viewportState: "idle",
    mood: "idle",
  };
}

function roomMessage(roleId, speaker, text) {
  return {
    id: `msg-${roleId}`,
    at: "01:00",
    speaker,
    text,
    kind: "character",
    speakerType: "role",
    speakerId: roleId,
    target: "all",
    channelId: "public",
    visibility: "public",
  };
}

function functionBlock(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) {
    return "";
  }
  const next = source.indexOf("\nfunction ", start + 1);
  return next < 0 ? source.slice(start) : source.slice(start, next);
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}
