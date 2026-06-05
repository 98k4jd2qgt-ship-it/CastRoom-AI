import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const root = process.cwd();
const failures = [];

mustInclude("src/core/types.ts", [
  "RoomPromptProfile",
  "RoomAutoSpeechPolicy",
  "RoomAutoSpeechState",
  "RoomScheduleReason",
  "RoomScheduleResult",
  "RoomMessageVisibility",
  "RoomPrivateWhisperMode",
  "DirectorTurnPlan",
  "JudgementCheck",
  "JudgementOutcome",
  "RoomSpeechIntent",
  "RoomSpeechDecision",
  "RoomCollaborationMode",
  "RoomFloorOwner",
  "RoomTurnPhase",
  "RoomTerminationReason",
  "RoomPlannerMode",
  "RoomInputIntent",
  "RoomDiscussionPlan",
  "RoomPlannedTurn",
  "RoomPlannerResult",
  "RoomFlowMode",
  "RoomFreedomLevel",
  "SimulationObjective",
  "RoomPlanIntent",
  "RoomSchedulerPhase",
  "RoomSimulationFocus",
  "SimulationBeatType",
  "SimulationBeatPlan",
  "RoomSimulationState",
  "RoomUncertaintyProfile",
  "RoomMatchState",
  "SimulationStyle",
  "uncertaintyProfile",
  "RoomStopReason",
  "DirectorDraftCheck",
  "RoomChannel",
  "RoomActiveChannelId",
  "RoomObserverMemoryScope",
  "RoomObservationEntry",
  "RoomIdentityCard",
  "RoomIdentityCardField",
  "flowMode",
  "freedomLevel",
  "simulationObjective",
  "simulation",
  "match",
  "activeDiscussionPlan",
  "activeChannelId",
  "activeRoomId",
  "rooms: RoomState[]",
  "factionHuddles",
  "listening",
]);
mustInclude("src/core/types.ts", [
  '"role_action_attempt"',
  '"role_challenge_claim"',
  '"role_reveal_known_fact"',
  '"role_hide_or_mislead"',
  '"developer"',
  "RoomFactStatus",
]);

mustInclude("src/core/appState.ts", [
  "getActiveRoom",
  "syncActiveRoom",
  "switchActiveRoom",
  "updateRoomById",
  "includeInitialRole",
  "includeInitialRole: false",
  "room.create",
  "room.switch",
  "room.duplicate",
  "room.delete",
  "room.setIdentityCardEnabled",
  "room.setIdentityCardField",
  "room.restoreIdentityCardTemplate",
  "prepareRoomForBackground",
]);
mustNotInclude("src/core/appState.ts", ["return createInitialRoomParticipants(packs);"]);
mustNotInclude("src/main.ts", ["shouldDirectorJudgeUserInput"]);
mustInclude("src/main.ts", [
  "User and role claims are not automatically true.",
  "publicText must not say Director ruling",
  "If a claim seems doubtful, challenge it naturally in character",
]);

mustInclude("src/core/prompts.ts", [
  "roomPromptTargetId",
  "directorPromptTargetId",
  "roomRolePromptTargetId",
  "resolveRoomPrompt(room",
  "resolveDirectorPrompt(room",
]);

mustIncludeSchedulerSurface([
  "scheduleRoomTurn",
  "scheduleRoomDirectorTurn",
  "resolveRoomFlowMode",
  "resolveSimulationObjective",
  "resolveRoomFreedomLevel",
  "resolveSimulationFocus",
  "resolveRoomCollaborationMode",
  "classifyRoomInputIntent",
  "createDirectorRoomPlan",
  "createRuleDirectorPlan",
  "createCloudDirectorPlan",
  "validateDirectorRoomPlan",
  "validateDraftWithDirectorRules",
  "commitRoomTurnResult",
  "advanceDirectorSchedulerState",
  "buildRoomInspectorSchedulerState",
  "advanceRoomSimulationState",
  "resolveSimulationStyle",
  "createRuleBasedRoomPlan",
  "createCloudRoomPlan",
  "validateRoomPlan",
  "executeRoomPlannedTurn",
  "terminateRoomPlan",
  "collectRoomTurnIntents",
  "selectRoomFloorOwner",
  "validateDraftWithDirector",
  "resolveRoomMessageVisibility",
  "deriveRoomChannels",
  "filterRoomTimelineForChannel",
  "resolveRoomInputVisibility",
  "getChannelVisibleRoleIds",
  "getVisibleContextForParticipant",
  "recordVisibleObservations",
  "canStartFactionHuddle",
  "recentlyUsedFactionHuddle",
  "createFactionStrategyEntries",
  "next public move",
  "resolveFactionHuddleVisibility",
  "auto_simulation",
  "SimulationBeat",
  "SimulationBeatCandidate",
  "chooseSimulationBeatCandidate",
  "weightedPickSimulationBeat",
  "candidateScoring",
  "role_action",
  "score_update",
  "DirectorModePolicy",
  "DIRECTOR_MODE_POLICIES",
  "resolveDirectorMode(",
  "resolveDirectorModeIntent",
  "classifyDirectorModeIntent",
  "buildModeInspectorState",
  "buildModeRoleTask",
  "getDefaultIdentityCardForMode",
  "resolveVisibleIdentityCardForRole",
  "buildIdentityCardPromptBlock",
  "buildDirectorIdentityCardSummary",
  "inspectorState",
  "memoryWriteRules",
  "stopRules",
  "study_check_understanding",
  "planning_decision_needed",
  "team_channel_strategy",
  "createModeDirectorPublicText",
  "createModeRoleTurnGoal",
  "fails, but it reveals a new obstacle",
  "player_reactive",
  "你们怎么看",
]);

mustInclude("src/main.ts", [
  "applyRoomScheduleResultAsync",
  "runRoomProviderTurn",
  "resolveRoomTurnProviders",
  "resolveRoomRoleApiProfile",
  "resolveRoomDefaultApi",
  "setRoomRoleApiStatus",
  "buildRoomProviderPrompt",
  "advanceRoomFlowState",
  "resolveRoomCollaborationMode",
  "advanceRoomDiscussionPlanAfterTurn",
  "completeRoomDiscussionPlan",
  "recordRoomObservations",
  "recordFactionHuddleMemory",
  "getFactionPromptMemory",
  "getRoomObserverPromptMemory",
  "queueRoomParticipantListeningIdle",
  "applyRoomDirectorTurn",
  "applyRoomDirectorTurnAsync",
  "roomRuntime.executeDirectorTurn",
  "AI.runtime.room_director.blocked",
  "room_director_runtime_blocked",
  "createLiveDirectorTurnPlan",
  "isPollutedLocalDirectorSpeech",
  "RoomDirector.local.polluted",
  "parseLiveDirectorTurnPlan",
  "sanitizeDirectorTurnPlan",
  "createRoomPlannerResult",
  "requestCloudRoomPlan",
  "shouldUseCloudRoomPlanner",
  "liveChatProvider.rawChat",
  "createCloudDirectorPlan(input.room",
  "createDirectorRoomPlan({",
  "recordPassiveDirectorObservation",
  "buildDirectorModePromptGuidance",
  "buildRoomModeProviderGuidance",
  "buildIdentityCardPromptBlock(consoleState.room",
  "buildDirectorIdentityCardSummary(room)",
  "Do not repeat the user's instruction or setup wording",
  "syncRoomAutoTimer",
  "runRoomAutoTurn",
  "room.setPrivateWhispers",
  "reachedPrivateWhisperLimit",
  "recordAppMemoryEvent",
]);

mustInclude("src/ui/roomSurface.ts", [
  "renderRoomListRail",
  "openRoomQuickSwitch",
  "renderRoomInspectorStatus",
  "renderRoomInspectorContext",
  "renderRoomInspectorActions",
  "renderRoomInspectorDetails",
  "renderRoomFreedomSelect",
  "buildRoomInspectorSchedulerState",
  "buildModeInspectorState",
  "resolveRoomCollaborationMode",
  "roomFlowModeLabel",
  "freedomLevelLabel",
  "simulationObjectiveLabel",
  "roomPlanLabel",
  "roomPlanDetail",
  "terminationReasonLabel",
  "room.selectPromptProfile",
  "room.setFreedomLevel",
  "developerFreedom",
  "room.setSpeed",
  "room.setPrivateWhispers",
  "room.setFactionHuddles",
  "room.setActiveChannel",
  "room.openUserFactionChannel",
  "room.setRoleFaction",
  "room.setIdentityCardEnabled",
  "room.setIdentityCardField",
  "room.restoreIdentityCardTemplate",
  "room.switch",
  "room.create",
  "autoSpeechState.status",
  'event.key === "PageDown"',
  'event.key === "PageUp"',
  'event.key === "Enter"',
  "suggestionIndex",
  "applyCommandSuggestion(input, command)",
  "pickCommandSuggestion(suggestions[suggestionIndex].command)",
  'button.dataset.active = String(index === activeIndex)',
  "applyMentionSuggestion(input, mentionSuggestions[mentionIndex].insert)",
]);
const roomSurfaceSource = read("src/ui/roomSurface.ts");
const roomInputBlock = functionBlock(roomSurfaceSource, "renderRoomInput");
mustIncludeText(roomInputBlock, [
  "row.requestSubmit()",
  "!event.shiftKey",
  "!event.isComposing",
]);
assertOrderText(roomInputBlock, "pickCommandSuggestion(suggestions[suggestionIndex].command)", "row.requestSubmit()");
assertOrderText(roomInputBlock, "applyMentionSuggestion(input, mentionSuggestions[mentionIndex].insert)", "row.requestSubmit()");
const roomMentionSuggestionsBlock = functionBlock(roomSurfaceSource, "roomMentionSuggestions");
mustIncludeText(roomMentionSuggestionsBlock, [
  "...props.state.room.participants.map",
  "return entries.filter((entry) => entry.label.toLowerCase().includes",
]);
if (/\.slice\(0,\s*\d+\)/.test(roomMentionSuggestionsBlock)) {
  failures.push("roomMentionSuggestions must not cap @ candidates; every room participant must be selectable.");
}

mustInclude("src/core/commands.ts", [
  "/debug room",
  "/ai status",
  "/ai trace",
]);
mustNotInclude("src/core/commands.ts", [
  "/room prompt",
  "/room whispers on",
  "/room whispers off",
  "/room factions on",
  "/room faction set",
  "/room channel public",
]);

mustNotInclude("src/core/roomScheduler.ts", ["scheduleDemoRoomReply", "room.participants.length < 2"]);
mustNotInclude("src/main.ts", ["scheduleDemoRoomReply"]);
mustInclude("src/core/ai.ts", ["rawChat(", 'requestChatCompletion(config, "chat", messages']);

const mainSource = read("src/main.ts");
const roomTurnProviderBlock = functionBlock(mainSource, "resolveRoomTurnProviders");
mustIncludeText(roomTurnProviderBlock, [
  "const localDiagnostics = localAiRuntime.diagnostics()",
  "const localCandidate",
  'id: "local-chat-model"',
  "localFallbackAiProvider",
  "resolveRoomRoleApiProfile(participant)",
  "providerResolver.resolve({",
  'purpose: "room_speaker"',
  "resolution.providerIds",
  "resolution.blockReasons",
]);
assertOrderText(roomTurnProviderBlock, "const localCandidate", "resolveRoomRoleApiProfile(participant)");
const directorApiBlock = functionBlock(mainSource, "resolveDirectorApiProfile");
mustIncludeText(directorApiBlock, [
  "if (localAiRuntime.diagnostics().enabled)",
  "return localRoomApiResult(localChatModelRoomApiStatus())",
]);
assertOrderText(directorApiBlock, "if (localAiRuntime.diagnostics().enabled)", 'if (directorApi.mode === "use_room")');

assertRoomIdleEmotionFallback();
await validateSchedulerBehavior();

if (failures.length > 0) {
  console.error(`Room scheduler validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Room scheduler validation passed");

function mustInclude(file, markers) {
  const content = read(file);
  for (const marker of markers) {
    if (!content.includes(marker)) {
      failures.push(`${file} is missing ${marker}`);
    }
  }
}

function mustIncludeSchedulerSurface(markers) {
  const content = [
    "src/core/roomScheduler.ts",
    "src/core/roomProfiles.ts",
    "src/core/roomVisibility.ts",
    "src/core/debatePolicy.ts",
    "src/core/directorModePolicy.ts",
    "src/core/roomCollaborationPolicy.ts",
    "src/core/inputInterpretation.ts",
    "src/core/roomRuleGuards.ts",
  ].map(read).join("\n");
  for (const marker of markers) {
    if (!content.includes(marker)) {
      failures.push(`roomScheduler facade/modules are missing ${marker}`);
    }
  }
}

function mustNotInclude(file, markers) {
  const content = read(file);
  for (const marker of markers) {
    if (content.includes(marker)) {
      failures.push(`${file} still contains removed marker ${marker}`);
    }
  }
}

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function mustIncludeText(content, markers) {
  for (const marker of markers) {
    if (!content.includes(marker)) {
      failures.push(`Missing required text: ${marker}`);
    }
  }
}

function assertOrderText(content, first, second) {
  const firstIndex = content.indexOf(first);
  const secondIndex = content.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1) {
    failures.push(`Cannot verify order: ${first} before ${second}`);
    return;
  }
  if (firstIndex > secondIndex) {
    failures.push(`Wrong order: ${first} should appear before ${second}`);
  }
}

function functionBlock(text, functionName) {
  const start = text.indexOf(`function ${functionName}`);
  if (start === -1) {
    failures.push(`Missing function ${functionName}`);
    return "";
  }
  const next = text.indexOf("\nfunction ", start + 1);
  return next === -1 ? text.slice(start) : text.slice(start, next);
}

function assertRoomIdleEmotionFallback() {
  const source = read("src/main.ts");
  const idleStart = source.indexOf("function queueRoomParticipantIdle");
  const listeningStart = source.indexOf("function queueRoomParticipantListeningIdle");
  const listeningEnd = source.indexOf("async function handlePetInput", listeningStart);
  const idleBlock = idleStart >= 0 && listeningStart > idleStart ? source.slice(idleStart, listeningStart) : "";
  const listeningBlock = listeningStart >= 0 && listeningEnd > listeningStart ? source.slice(listeningStart, listeningEnd) : "";

  if (!idleBlock.includes('nextViewportState === "idle" ? "idle" : participant.currentEmotion')) {
    failures.push("queueRoomParticipantIdle must keep speaking emotion only during cooldown and reset direct idle transitions to idle.");
  }
  if (!idleBlock.includes('emotion: "idle"')) {
    failures.push("queueRoomParticipantIdle must reset cooling_down participants to idle emotion.");
  }
  if (!listeningBlock.includes('emotion: "idle"')) {
    failures.push("queueRoomParticipantListeningIdle must reset listening participants to idle emotion.");
  }
}

async function validateSchedulerBehavior() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "castroom-room-scheduler-"));
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
    const source = read(file);
    const js = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022,
        importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      },
    }).outputText.replace(/from "(\.\/[^"]+)";/g, 'from "$1.js";');
    fs.writeFileSync(path.join(tempDir, `${path.basename(file, ".ts")}.js`), js, "utf8");
  }
  const scheduler = await import(pathToFileURL(path.join(tempDir, "roomScheduler.js")).href);
  const room = createRoomFixture();

  const groupPlan = scheduler.createDirectorRoomPlan({
    room,
    trigger: "user",
    userInput: "你们怎么看",
    nowIso: "2026-05-16T01:00:00.000Z",
  });
  expect(groupPlan.intent === "group_opinion", "group opinion input should classify as group_opinion");
  expect(groupPlan.plan?.turns.length === 2, "group opinion should schedule two local turns");
  expect(new Set(groupPlan.plan?.turns.map((turn) => turn.speakerId)).size === 2, "group opinion should use two different speakers");

  const mentionPlan = scheduler.createDirectorRoomPlan({
    room,
    trigger: "user",
    userInput: "@Mio 你怎么看",
    nowIso: "2026-05-16T01:01:00.000Z",
  });
  expect(mentionPlan.intent === "direct_mention", "@Mio should classify as a direct mention");
  expect(mentionPlan.plan?.turns[0]?.speakerId === "mio", "@Mio should give Mio the first planned turn");

  const ambientChat = scheduler.scheduleRoomTurn({
    room: { ...room, autoChat: false, flowMode: "player_reactive" },
    trigger: "user",
    userInput: "The weather is nice today. Maybe we can go out for a walk.",
    nowMs: Date.parse("2026-05-16T01:01:30.000Z"),
    nowLabel: "01:01",
  });
  expect(ambientChat.type === "turn", "ordinary public chat should create one visible role reply even when Room Flow is off");
  expect(ambientChat.message?.target === "all", "ordinary public chat should reply to All, not @You");
  expect(ambientChat.message?.mentions?.length === 0, "ordinary public chat should not mention @You");
  expect(ambientChat.nextTurnAt === null, "ordinary one-shot chat should not enable continuous autoplay");
  expect(ambientChat.responseObligation?.reason === "user_message", "ordinary public chat should record a light response obligation");
  expect(ambientChat.engagementDecision?.kind === "optional", "ordinary public chat should remain optional engagement, not a forced mention");

  const autoPlan = scheduler.createDirectorRoomPlan({
    room: { ...room, autoChat: true, flowMode: "auto_simulation", advancePolicy: "continuous" },
    trigger: "auto",
    userInput: "",
    nowIso: "2026-05-16T01:02:00.000Z",
  });
  expect(autoPlan.intent === "auto_simulation", "continuous Room Flow should create auto_simulation intent");
  expect((autoPlan.plan?.turns.length ?? 0) <= 1, "local auto simulation should schedule at most one turn per tick");
  expect(Boolean(autoPlan.plan?.turns[0]?.beatType), "auto simulation should plan a Simulation Beat");
  expect(autoPlan.plan?.turns[0]?.target === "all", "auto simulation beats should not target the user by default");

  const fillGapPlan = scheduler.createDirectorRoomPlan({
    room: { ...room, autoChat: true, flowMode: "auto_simulation", advancePolicy: "fill_gap" },
    trigger: "auto",
    userInput: "",
    nowIso: "2026-05-16T01:02:10.000Z",
  });
  expect(fillGapPlan.intent !== "auto_simulation", "fill-gap Room Flow should not enter continuous auto_simulation mode");

  const fillGapTurn = scheduler.scheduleRoomTurn({
    room: { ...room, autoChat: true, flowMode: "auto_simulation", advancePolicy: "fill_gap" },
    trigger: "auto",
    userInput: "",
    nowMs: Date.parse("2026-05-16T01:02:15.000Z"),
    nowLabel: "01:02",
  });
  expect(fillGapTurn.type === "turn", "fill-gap Room Flow should fill one visible beat");
  expect(fillGapTurn.nextTurnAt === null, "fill-gap Room Flow should stop after one beat");

  const storyPlan = scheduler.createDirectorRoomPlan({
    room: {
      ...room,
      autoChat: true,
      flowMode: "auto_simulation",
      advancePolicy: "continuous",
      promptProfileId: "story",
      simulationObjective: "scene_play",
      simulation: { ...room.simulation, style: "story", beatIndex: 0 },
    },
    trigger: "auto",
    userInput: "",
    nowIso: "2026-05-16T01:02:30.000Z",
  });
  expect(
    ["role_action", "role_action_attempt", "role_challenge_claim", "role_reveal_known_fact", "role_hide_or_mislead", "director_cue", "director_twist", "role_speak"].includes(storyPlan.plan?.turns[0]?.beatType ?? ""),
    "story autoplay should create a story-style beat",
  );

  const matchPlan = scheduler.createDirectorRoomPlan({
    room: {
      ...room,
      autoChat: true,
      flowMode: "auto_simulation",
      advancePolicy: "continuous",
      promptProfileId: "debate",
      simulationObjective: "debate",
      simulation: { ...room.simulation, style: "match", beatIndex: 2 },
    },
    trigger: "auto",
    userInput: "",
    nowIso: "2026-05-16T01:02:45.000Z",
  });
  expect(matchPlan.plan?.turns[0]?.beatType === "score_update", "match autoplay should schedule score update beats");

  const teamRoom = {
    ...room,
    activeChannelId: "faction:team-a",
    factionHuddles: "on",
    userProfile: { ...room.userProfile, factionId: "team-a" },
  };
  const teamPlan = scheduler.createDirectorRoomPlan({
    room: teamRoom,
    trigger: "user",
    userInput: "我们下一步怎么办",
    nowIso: "2026-05-16T01:03:00.000Z",
  });
  const teamSpeakers = teamPlan.plan?.turns.map((turn) => turn.speakerId) ?? [];
  expect(teamPlan.intent === "team_strategy", "faction channel input should classify as team_strategy");
  expect(teamSpeakers.every((speakerId) => ["mio", "rin"].includes(speakerId)), "team channel should only schedule visible faction roles");

  const factChange = scheduler.evaluateRoomAction({
    room,
    message: userMessage("门已经打开"),
    userInput: "门已经打开",
  });
  expect(factChange.result === "needs_director_override", "fact rewrite should require @Director override");

  const strictAction = scheduler.evaluateRoomAction({
    room: { ...room, freedomLevel: "strict" },
    message: userMessage("我检查门锁"),
    userInput: "我检查门锁",
  });
  expect(strictAction.result === "needs_player_choice", "strict freedom should judge ordinary player actions");

  const looseAction = scheduler.evaluateRoomAction({
    room: { ...room, freedomLevel: "loose" },
    message: userMessage("我检查门锁"),
    userInput: "我检查门锁",
  });
  expect(looseAction.result === "allowed", "loose freedom should allow non-fact-changing ordinary checks");

  const developerFactChange = scheduler.evaluateRoomAction({
    room: { ...room, freedomLevel: "developer" },
    message: userMessage("门已经打开"),
    userInput: "门已经打开",
  });
  expect(developerFactChange.result === "allowed", "developer freedom should accept user fact changes as authoritative");

  const developerAction = scheduler.evaluateRoomAction({
    room: { ...room, freedomLevel: "developer" },
    message: userMessage("我检查门锁"),
    userInput: "我检查门锁",
  });
  expect(developerAction.result === "allowed", "developer freedom should not require judgement for player actions");

  const directorEchoRoom = {
    ...room,
    promptProfileId: "debate",
    director: {
      ...room.director,
      profileId: "debate-referee",
      recipeId: "debate",
    },
    messages: [userMessage("@director 你没有分辩手")],
  };
  const directorEchoResult = scheduler.scheduleRoomDirectorTurn({
    room: directorEchoRoom,
    nowLabel: "01:05",
    userInput: "@director 你没有分辩手",
    reason: "mentioned",
  });
  const directorText = directorEchoResult.type === "turn" ? directorEchoResult.message.text : "";
  expect(!/You\s*[:：]|User\s*[:：]|用户\s*[:：]/i.test(directorText), "Director fallback ruling must not echo transcript speaker labels.");
  expect(!/->\s*(?:success|partial_success|fail|blocked|needs_player_choice)/i.test(directorText), "Director fallback ruling must not expose internal outcome arrows.");
  expect(!/Director\s*(?:裁定|ruling|choice|cue|twist|pause|recap)|导演\s*(?:裁定|判定|选择|线索|转折|暂停|总结)/i.test(directorText), "Director fallback text must not expose Director move labels.");
  expect(!/系统\s*(?:裁定|判断|判定)|需要\s*(?:Director|导演|系统).{0,8}(?:裁定|判断|判定)/i.test(directorText), "Director fallback text must not mention backend judgement.");
  expect(!/理由\s*[:：]|后果\s*[:：]|Reason\s*:|Consequence\s*:/i.test(directorText), "Director fallback text must not expose debug reason/consequence labels.");
  expect(directorText.length <= 180, "Director fallback ruling should stay short.");

  const debateSetupInput = "@director \u73b0\u5728\u4f60\u6765\u7ec4\u7ec7\u4e0e\u4e3e\u529e\u4e00\u573a\u8fa9\u8bba\u8d5b\uff0c\u8981\u9075\u4ece\u8fa9\u8bba\u8d5b\u89c4\u5219\uff0c\u5728\u5f00\u59cb\u524d\u4f60\u8981\u5206\u4e00\u8fa9\u4e8c\u8fa9\u4e09\u8fa9\uff0c\u6700\u540e\u4f60\u8981\u5206\u51fa\u80dc\u8d1f\uff0c\u6211\u5df2\u7ecf\u5206\u4e86AB\u961f\uff0c\u8fa9\u9898\u4e3a\u5982\u679c\u65f6\u95f4\u65c5\u884c\u6210\u4e3a\u53ef\u80fd\u662f\u5426\u8981\u88ab\u653f\u5e9c\u7ba1\u63a7";
  const debateSetupResult = scheduler.scheduleRoomDirectorTurn({
    room: directorEchoRoom,
    nowLabel: "01:06",
    userInput: debateSetupInput,
    reason: "mentioned",
  });
  const debateSetupText = debateSetupResult.type === "turn" ? debateSetupResult.message.text : "";
  expect(debateSetupText.includes("\u8fa9\u9898\u786e\u8ba4") || /Motion confirmed/i.test(debateSetupText), "Debate setup should produce moderator setup text, not a judgement.");
  expect(debateSetupText.includes("\u65f6\u95f4\u65c5\u884c") || /time travel/i.test(debateSetupText), "Debate setup should extract the debate motion.");
  expect(/Team A|\u7b2c\u4e00\u65b9|A\u961f/i.test(debateSetupText), "Debate setup should name the opening side.");
  expect(!/(\u884c\u52a8\u6210\u529f|\u623f\u95f4\u53ef\u4ee5\u7ee7\u7eed\u63a8\u8fdb|success|works|Director\s*ruling|\u88c1\u5b9a)/i.test(debateSetupText), "Debate setup must not be routed through judgement wording.");

  const debateRoundPlan = scheduler.createDirectorRoomPlan({
    room: directorEchoRoom,
    trigger: "user",
    userInput: "\u4f60\u4eec\u600e\u4e48\u770b\u8fd9\u4e2a\u8fa9\u9898",
    nowIso: "2026-05-16T01:06:30.000Z",
  });
  expect(debateRoundPlan.intent === "debate_round", "Debate room ordinary input should schedule debate_round turns.");
  expect(
    (debateRoundPlan.plan?.turns ?? []).every((turn) => /setup wording|opening argument|rebuttal|supporting point/i.test(turn.goal)),
    "Debate role goals should speak by side and avoid repeating setup wording.",
  );

  const modeDirectorRoom = (profileId, directorProfileId, recipeId = profileId) => ({
    ...room,
    promptProfileId: profileId,
    director: {
      ...room.director,
      profileId: directorProfileId,
      recipeId,
    },
  });

  const storyDirectorResult = scheduler.scheduleRoomDirectorTurn({
    room: modeDirectorRoom("story", "story-director"),
    nowLabel: "01:07",
    userInput: "@director \u6211\u6253\u5f00\u95e8",
    reason: "mentioned",
  });
  const storyDirectorText = storyDirectorResult.type === "turn" ? storyDirectorResult.message.text : "";
  expect(storyDirectorResult.type === "turn" && storyDirectorResult.move === "judge", "Story action attempts should route to judge.");
  expect(!/Director\s*ruling|Reason:|Consequence:|\u9700\u8981.*(?:Director|\u5bfc\u6f14|\u7cfb\u7edf).*(?:\u88c1\u5b9a|\u5224\u65ad)/i.test(storyDirectorText), "Story Director text must stay immersive, not debug-style.");

  const mysteryDirectorResult = scheduler.scheduleRoomDirectorTurn({
    room: modeDirectorRoom("mystery", "mystery-director"),
    nowLabel: "01:08",
    userInput: "@director \u7ed9\u4e00\u4e2a\u7ebf\u7d22",
    reason: "mentioned",
  });
  expect(mysteryDirectorResult.type === "turn" && mysteryDirectorResult.move === "cue", "Mystery clue requests should route to cue.");
  expect(mysteryDirectorResult.type === "turn" && mysteryDirectorResult.message, "Mystery cue should publish a narrator beat in the public room.");
  expect(
    mysteryDirectorResult.type === "turn" && mysteryDirectorResult.message?.target === "all" && mysteryDirectorResult.message?.visibility === "public",
    "Mystery cue narration should land in the public room timeline.",
  );
  expect(
    mysteryDirectorResult.type === "turn" && /(\u7ebf\u7d22|clue)/i.test(mysteryDirectorResult.plan?.publicText ?? ""),
    "Mystery Director should keep clue-oriented narration wording.",
  );
  expect(
    mysteryDirectorResult.type === "turn" && (mysteryDirectorResult.plan?.privateDirectives?.length ?? 0) >= 1,
    "Mystery public narration should still drive a private role directive.",
  );

  const studyDirectorResult = scheduler.scheduleRoomDirectorTurn({
    room: modeDirectorRoom("study", "study-moderator"),
    nowLabel: "01:09",
    userInput: "@director \u51fa\u4e00\u9053\u7ec3\u4e60",
    reason: "mentioned",
  });
  const studyDirectorText = studyDirectorResult.type === "turn" ? studyDirectorResult.message.text : "";
  expect(studyDirectorResult.type === "turn" && studyDirectorResult.move === "choice", "Study practice requests should wait for learner response.");
  expect(/\u590d\u8ff0|\u7ec3\u4e60|restating|practice/i.test(studyDirectorText), "Study Director should prompt a learner check instead of generic room choice text.");

  const planningDirectorResult = scheduler.scheduleRoomDirectorTurn({
    room: modeDirectorRoom("planning", "planning-facilitator"),
    nowLabel: "01:10",
    userInput: "@director \u4e0b\u4e00\u6b65\u600e\u4e48\u5b9a",
    reason: "mentioned",
  });
  const planningDirectorText = planningDirectorResult.type === "turn" ? planningDirectorResult.message.text : "";
  expect(planningDirectorResult.type === "turn" && planningDirectorResult.move === "choice", "Planning decision requests should route to choice, not default judgement.");
  expect(/\u51b3\u7b56|\u9009\u9879|\u98ce\u9669|decision|options|risks/i.test(planningDirectorText), "Planning Director should discuss options, risks, and decision criteria.");

  const teamDirectorResult = scheduler.scheduleRoomDirectorTurn({
    room: { ...modeDirectorRoom("debate", "debate-referee"), factionHuddles: "on", activeChannelId: "faction:team-a" },
    nowLabel: "01:11",
    userInput: "@director \u6574\u7406\u6211\u4eec\u7684\u7b56\u7565",
    reason: "mentioned",
  });
  const teamDirectorText = teamDirectorResult.type === "turn" ? teamDirectorResult.message.text : "";
  expect(teamDirectorResult.type === "turn" && teamDirectorResult.move === "recap", "Team channel Director should summarize strategy inside the faction channel.");
  expect(/\u9635\u8425|\u7b56\u7565|faction|strategy/i.test(teamDirectorText), "Team channel Director should use strategy-boundary wording.");

  const secretDraft = scheduler.evaluateAiDraftAgainstDirectorRules({
    room,
    role: room.participants[0],
    draft: "公开秘密：钥匙其实在桌上。",
  });
  expect(secretDraft.result !== "allowed", "AI drafts must not reveal hidden secrets directly");
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
    createParticipant("mio", "Mio", "team-a", apiProfile),
    createParticipant("rin", "Rin", "team-a", apiProfile),
    createParticipant("kai", "Kai", "team-b", apiProfile),
  ];
  return {
    id: "test-room",
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
      scoreboard: [
        { id: "team-a", label: "Team A", score: 0 },
        { id: "team-b", label: "Team B", score: 0 },
      ],
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
    apiProfile: {
      mode: "demo",
      providerId: "local-model",
      secretRef: null,
      keyPreview: "",
      baseUrl: "",
      chatModel: "local",
      visionModel: "",
      temperature: 0.7,
      maxTokens: 300,
      status: "ready",
      lastTestMessage: "",
      lastTestedAt: null,
    },
    expandedApiRoleId: null,
    expandedInspectorSection: null,
    promptProfileId: "casual-chat",
    autoSpeechPolicy: {
      maxUserTriggeredFollowUps: 2,
      maxIdleBurstTurns: 3,
      cooldownTurns: 1,
      speedDelaysMs: {
        slow: 12000,
        normal: 7000,
        fast: 4000,
      },
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
    factions: [
      { id: "team-a", name: "Team A", color: "#8fe8c2" },
      { id: "team-b", name: "Team B", color: "#9fb8ff" },
    ],
    activeChannelId: "public",
    hiddenFactionHuddleCount: 0,
    factionHuddleThreads: [],
    userFactionHuddle: null,
    userProfile: { userId: "local-user", displayName: "You", aliases: ["You", "me", "我"] },
    director: {
      enabled: true,
      directorId: "room-director",
      displayName: "Director",
      aliases: ["director", "gm", "system", "导演", "主持人"],
      profileId: "host",
      recipeId: "casual",
      apiProfile: {
        mode: "use_room",
        providerId: "local-model",
        secretRef: null,
        keyPreview: "",
        baseUrl: "",
        chatModel: "local",
        visionModel: "",
        temperature: 0.5,
        maxTokens: 300,
        status: "ready",
        lastTestMessage: "",
        lastTestedAt: null,
      },
      memoryScope: "room:test-room:system",
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

function createParticipant(id, name, factionId, apiProfile) {
  return {
    id,
    roleId: id,
    packId: `demo-${id}`,
    name,
    displayName: name,
    factionId,
    apiProfile,
    memoryScope: "room:test-room",
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
