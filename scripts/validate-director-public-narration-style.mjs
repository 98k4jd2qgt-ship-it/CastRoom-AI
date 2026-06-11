import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const failures = [];
const scheduler = await loadScheduler();

const casualRoom = createRoomFixture({
  id: "casual-style-room",
  promptProfileId: "casual-chat",
  directorProfileId: "host",
  recipeId: "casual",
  topic: "今天天气不错，大家想不想去公园坐一会儿？",
  scene: "大家在普通聊天室里闲聊",
});
const casual = scheduler.scheduleRoomDirectorTurn({
  room: casualRoom,
  nowLabel: "01:00",
  userInput: "今天天气不错，出去走走怎么样？",
  requestedMove: "cue",
  reason: "recipe",
});

expect(casual.type === "turn", "Casual cue should produce a Director turn plan.");
expect(casual.type === "turn" && !casual.message, "Casual cue should stay backstage; normal chat should continue through role replies.");
expect(
  casual.type === "turn" && !/(线索|clue|浮了出来|comes into focus)/i.test(casual.message?.text ?? ""),
  "Casual narration should not use mystery clue wording.",
);
expect(
  casual.type === "turn" && !scheduler.isDirectorPublicSchedulingText(casual.message?.text ?? ""),
  "Casual narration should not expose scheduling language.",
);

const storyRoom = createRoomFixture({
  id: "story-style-room",
  promptProfileId: "story",
  directorProfileId: "story-director",
  recipeId: "story",
  topic: "几个人停在一扇没确认能不能打开的门前。",
  scene: "门前的空气有点紧",
});
const story = scheduler.scheduleRoomDirectorTurn({
  room: storyRoom,
  nowLabel: "01:01",
  userInput: "A faint scrape comes from behind the door.",
  requestedMove: "cue",
  reason: "recipe",
});

expect(story.type === "turn", "Story cue should produce a Director turn plan.");
expect(story.type === "turn" && story.message, "Story cue should publish narration.");
expect(
  story.type === "turn" && /(安静|细节|变化|quiet|detail|change|view)/i.test(story.message?.text ?? ""),
  "Story narration should describe a scene beat or response-worthy change.",
);
expect(
  story.type === "turn" && !/(下一位|接话|发言|acts next|next speaker|Reason:|idle_auto)/i.test(story.message?.text ?? ""),
  "Story narration should not describe role scheduling or internal reasons.",
);

const explicitDirectorChannelRoom = createRoomFixture({
  id: "director-channel-public-narration-room",
  promptProfileId: "casual-chat",
  directorProfileId: "host",
  recipeId: "casual",
});
explicitDirectorChannelRoom.activeChannelId = "director";
const explicitDirectorChannelNarration = scheduler.scheduleRoomDirectorTurn({
  room: explicitDirectorChannelRoom,
  nowLabel: "01:02",
  userInput: "Developer Director Channel Public Narration Request:\n开发者测试任务在主频道发布一条旁白",
  requestedMove: "twist",
  reason: "mentioned",
});

expect(
  explicitDirectorChannelNarration.type === "turn",
  "Explicit Director Channel public narration request should produce a Director turn.",
);
expect(
  explicitDirectorChannelNarration.type === "turn" && explicitDirectorChannelNarration.message,
  "Explicit Director Channel public narration request should publish a public Director message.",
);
expect(
  explicitDirectorChannelNarration.type === "turn" && explicitDirectorChannelNarration.message?.visibility === "public",
  "Explicit Director Channel public narration should be visible in the public room.",
);
expect(
  explicitDirectorChannelNarration.type === "turn" && !explicitDirectorChannelNarration.message?.channelId,
  "Explicit Director Channel public narration should not stay bound to the Director channel.",
);
expect(
  explicitDirectorChannelNarration.type === "turn" &&
    explicitDirectorChannelNarration.plan.publicTextReason === "narration",
  "Explicit Director Channel public narration should keep publicTextReason narration.",
);
expect(
  explicitDirectorChannelNarration.type === "turn" &&
    !scheduler.isDirectorPublicSchedulingText(explicitDirectorChannelNarration.message?.text ?? ""),
  "Explicit Director Channel public narration should pass the public scheduling/leak gate.",
);
expect(
  explicitDirectorChannelNarration.type === "turn" &&
    !/(Backstage|Reason:|Move:|Next beat|Developer Director Channel|public blocked|当前场景|目标|公开线索|下一个|下一位|接话)/i.test(
      explicitDirectorChannelNarration.message?.text ?? "",
    ),
  "Explicit Director Channel public narration should be natural narration, not a status dump or scheduling text.",
);

if (failures.length > 0) {
  console.error(`validate-director-public-narration-style failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("validate-director-public-narration-style passed");

async function loadScheduler() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-director-style-"));
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
  const id = overrides.id ?? "style-room";
  const participants = [
    createParticipant("archive", "Archive-3", apiProfile, id),
    createParticipant("care", "Care-4", apiProfile, id),
  ];
  return {
    id,
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
    topic: overrides.topic ?? "Daily chat",
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
      memoryScope: `room:${id}:system`,
      lastMove: null,
      lastSpokeAt: null,
      sceneBoard: {
        title: "Style Room",
        currentScene: overrides.scene ?? "A quiet room",
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

function createParticipant(id, name, apiProfile, roomId) {
  return {
    id,
    roleId: id,
    packId: `demo-${id}`,
    name,
    displayName: name,
    factionId: null,
    apiProfile,
    memoryScope: `room:${roomId}`,
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
