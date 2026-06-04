import fs from "node:fs";

const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const copy = fs.readFileSync("src/ui/copy.ts", "utf8");
const failures = [];

const languages = ["en", "zh-CN", "ja-JP", "ko-KR", "de-DE", "ru-RU"];

const mojibakeMarkers = [0x95bc, 0x9420, 0x95c9, 0x741a, 0x95b5, 0x95b9, 0xfffd].map((codePoint) =>
  String.fromCodePoint(codePoint),
);

for (const marker of mojibakeMarkers) {
  mustNotInclude(roomSurface, marker, `roomSurface must not contain mojibake marker ${marker}`);
}

for (const forbidden of [
  'roomUiText(language, "situationNextMove", "Situation")',
  'roomUiText(language, "situationMaterial", "Material")',
  'roomUiText(language, "situationRisk", "Risk")',
  'roomUiText(language, "situationReason", "Reason")',
  'roomUiText(language, "directorMemorySource", "Director memory")',
  'roomUiText(language, "directorMemoryLoadedClaims", "Loaded claims")',
  'roomUiText(language, "directorMemoryHiddenClaims", "Hidden facts")',
  'roomUiText(language, "directorMemoryDisputedClaims", "Disputed facts")',
  'roomUiText(language, "plotPhase", "Plot phase")',
  'roomUiText(language, "plotPressure", "Current pressure")',
  'roomUiText(language, "plotPublicHooks", "Public hooks")',
  'roomUiText(language, "plotHiddenHooks", "Hidden hooks")',
  'roomUiText(language, "plotUnresolved", "Unresolved")',
  'roomUiText(language, "plotNextBeat", "Next beat")',
  'roomUiText(language, "frameUserRole", "User role")',
  'roomUiText(language, "frameIntent", "Frame intent")',
  'roomUiText(language, "frameAbsorption", "Absorption")',
  'roomUiText(language, "frameAmbiguity", "Ambiguity")',
  'roomUiText(language, "frameDeferred", "Deferred")',
  'roomUiText(language, "frameRecentChange", "Recent frame change")',
  'roomUiText(language, "winner", "Winner")',
  'roomUiText(language, "plotArc", "Plot")',
  'roomUiText(language, "frameControl", "Frame")',
  'roomUiText(language, "collaboration", "Collaboration")',
  'roomUiText(language, "openMainAiSettings", "Main AI settings")',
  'roomUiText(language, "openMainAiSettings"',
  'return uiText(language, profile.summary);',
  'activeProfile.summary',
  'for (const rule of activeProfile.rules)',
  'return "Director";',
  '"Casual Room"',
  '"Shared topic, light pacing, and room memory."',
  '"Waiting for input"',
]) {
  mustNotInclude(roomSurface, forbidden, `Room UI visible text must use translated keys`);
}

for (const forbiddenCopy of [
  'roomModelSourceMain',
  'openMainAiSettings',
  'useConfigChatModel',
  'useCustomRoomGeneration',
  'Main setup',
  'Main AI settings',
  'Use main API setup',
  'Use Config chat model',
  '主配置',
  '主 AI 设置',
  '使用主 API 配置',
]) {
  mustNotInclude(copy, forbiddenCopy, `Room copy should avoid old main AI wording`);
}

for (const required of [
  'roomUiText(language, "windowControls")',
  'roomUiText(props.state.language, "roomUserAliases")',
  'localizeEnum(language, "directorProfileSummary", profile.id',
  'localizedRoomPromptProfileSummary(activeProfile, language)',
  'localizedRoomPromptProfileRule(activeProfile, index, language)',
  'localizedSchedulerStyle(activeProfile.schedulerStyle, language)',
  'localizeEnum(language, "frameIntentKind", kind',
  'localizeEnum(language, "frameUserRole", role',
  'localizeEnum(language, "frameAbsorption", absorption',
  'localizeEnum(language, "situationNextMove", move',
  'localizeEnum(language, "situationMaterialSufficiency", material',
  'localizeEnum(language, "situationConflictLevel", level',
  'localizeEnum(language, "situationRiskLevel", level',
  'localizeEnum(language, "plotBeat", beat',
  'localizeEnum(language, "directorMemorySource", source',
  'directorMemorySourceLabel(room.simulation.directorMemorySource, language)',
  'plotBeatLabel(room.plot.phase, language)',
]) {
  mustInclude(roomSurface, required, `Room surface should route through i18n helper`);
}

for (const group of [
  "directorProfileSummary",
  "roomPromptProfileSummary",
  "roomPromptProfileRule",
  "roomSchedulerStyle",
  "frameIntentKind",
  "frameUserRole",
  "frameAbsorption",
  "situationNextMove",
  "situationMaterialSufficiency",
  "situationConflictLevel",
  "situationRiskLevel",
  "plotBeat",
  "directorMemorySource",
]) {
  mustInclude(copy, `${group}: {`, `copy enum group ${group} exists`);
}

for (const language of languages) {
  mustInclude(copy, language === "en" ? "en:" : `"${language}":`, `copy includes language block ${language}`);
}

for (const key of [
  "situationNextMove",
  "situationMaterial",
  "situationRisk",
  "situationReason",
  "directorMemorySource",
  "directorMemoryLoadedClaims",
  "directorMemoryHiddenClaims",
  "directorMemoryDisputedClaims",
  "plotArc",
  "plotPhase",
  "plotPressure",
  "plotPublicHooks",
  "plotHiddenHooks",
  "plotUnresolved",
  "plotNextBeat",
  "frameControl",
  "frameUserRole",
  "frameIntent",
  "frameAbsorption",
  "frameAmbiguity",
  "frameDeferred",
  "frameRecentChange",
  "winner",
  "factionCollaborationOpportunity",
  "factionHuddleStage",
  "factionPrivateBoundary",
  "factionSettings",
  "factionSettingsHint",
  "addFaction",
  "addFactionHint",
  "factionName",
  "factionNamePlaceholder",
  "factionPublicGoal",
  "factionPublicGoalPlaceholder",
  "factionPrivateGoal",
  "factionPrivateGoalPlaceholder",
  "factionColor",
  "deleteFaction",
  "deleteFactionConfirm",
  "deleteFactionHint",
  "roomAiConnection",
  "roomGenerationSettings",
  "roomGenerationUseGlobal",
  "roomGenerationCustom",
  "openGlobalAiSettings",
  "roomModelSourceGlobal",
]) {
  mustInclude(copy, `${key}:`, `roomUi supplement should include ${key}`);
}

for (const phrase of [
  'situationMaterial: "材料"',
  'directorMemoryLoadedClaims: "载入事实"',
  'plotPhase: "剧情阶段"',
  'frameIntent: "框架意图"',
  'factionSettings: "阵营设置"',
  'roomGenerationSettings: "本房间生成参数"',
  'openGlobalAiSettings: "打开全局 AI 配置"',
]) {
  mustInclude(copy, phrase, `Chinese Room UI translation exists`);
}

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("validate-room-ui-i18n: ok");

function mustInclude(source, needle, message) {
  if (!source.includes(needle)) {
    failures.push(`${message}: missing ${needle}`);
  }
}

function mustNotInclude(source, needle, message) {
  if (source.includes(needle)) {
    failures.push(`${message}: found ${needle}`);
  }
}
