import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

const main = read("src/main.ts");

mustInclude(main, [
  "function maybePlayOneOnOneTtsForReply",
  "function stopActiveOneOnOneTts",
  "function resolveOneOnOneTtsVoice",
  "function resolveOneOnOneTtsLanguage",
  'activeSurface !== "console" || activeConsoleView !== "chat"',
  "!consoleState.voice.ttsEnabled",
  'committedMessage.kind !== "character"',
  'stopActiveOneOnOneTts("open_room")',
  'stopActiveOneOnOneTts("character_switch")',
  'stopActiveOneOnOneTts("tts_disabled")',
  "requestTtsSpeech(readLiveAiConfig(\"tts\")",
  "maybePlayOneOnOneTtsForReply(result, committedMessage)",
]);

const applyCharacterResult = sliceBetween(
  main,
  "function applyCharacterResult",
  "function markCloudChatRuntimeFailure",
);
mustInclude(applyCharacterResult, [
  'kind: "character"',
  "const committedMessage = appendConsoleMessage",
  "maybePlayOneOnOneTtsForReply(result, committedMessage)",
]);
assertOrder(
  applyCharacterResult,
  "const committedMessage = appendConsoleMessage",
  "maybePlayOneOnOneTtsForReply(result, committedMessage)",
);

const appendConsoleMessage = sliceBetween(
  main,
  "function appendConsoleMessage",
  "function appendConsoleMessageToCurrentStream",
);
mustNotInclude(appendConsoleMessage, [
  "maybePlayOneOnOneTtsForReply",
  "requestTtsSpeech",
  "new Audio(",
]);

const roomProviderTurn = sliceBetween(main, "async function runRoomProviderTurn", "function resolveRoomTurnProvider");
mustNotInclude(roomProviderTurn, [
  "maybePlayOneOnOneTtsForReply",
  "requestTtsSpeech",
  "new Audio(",
]);

const roomDirectorTurn = sliceBetween(main, "async function applyRoomDirectorTurnAsync", "function buildLocalDirectorSpeechPrompt");
mustNotInclude(roomDirectorTurn, [
  "maybePlayOneOnOneTtsForReply",
  "requestTtsSpeech",
  "new Audio(",
]);

if (failures.length) {
  console.error("TTS conversation policy validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("TTS conversation policy validation passed.");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function mustInclude(text, needles) {
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`Missing required text: ${needle}`);
    }
  }
}

function mustNotInclude(text, needles) {
  for (const needle of needles) {
    if (text.includes(needle)) {
      failures.push(`Forbidden text is present: ${needle}`);
    }
  }
}

function sliceBetween(text, start, end) {
  const startIndex = text.indexOf(start);
  if (startIndex === -1) {
    failures.push(`Cannot find start marker: ${start}`);
    return "";
  }
  const endIndex = text.indexOf(end, startIndex + start.length);
  if (endIndex === -1) {
    failures.push(`Cannot find end marker: ${end}`);
    return text.slice(startIndex);
  }
  return text.slice(startIndex, endIndex);
}

function assertOrder(text, first, second) {
  const firstIndex = text.indexOf(first);
  const secondIndex = text.indexOf(second);
  if (firstIndex === -1 || secondIndex === -1) {
    failures.push(`Cannot verify order: ${first} before ${second}`);
    return;
  }
  if (firstIndex > secondIndex) {
    failures.push(`Wrong order: ${first} should appear before ${second}`);
  }
}
