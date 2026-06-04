import fs from "node:fs";

const ai = fs.readFileSync("src/core/ai.ts", "utf8");

const failures = [];

function mustInclude(source, text, label) {
  if (!source.includes(text)) {
    failures.push(`${label}: missing ${text}`);
  }
}

function mustNotInclude(source, text, label) {
  if (source.includes(text)) {
    failures.push(`${label}: unexpected ${text}`);
  }
}

function mustMatch(source, pattern, label) {
  if (!pattern.test(source)) {
    failures.push(`${label}: missing pattern ${pattern}`);
  }
}

mustInclude(ai, '{"text":"character line","emotion":"idle|happy|sad|angry|surprised|curious|calm|thinking"}', "cloud prompt JSON contract");
const chatWithConfigStart = ai.indexOf("async chatWithConfig(");
const visionStart = ai.indexOf("async vision(", chatWithConfigStart);
const chatWithConfig = chatWithConfigStart >= 0 && visionStart > chatWithConfigStart ? ai.slice(chatWithConfigStart, visionStart) : "";
mustInclude(chatWithConfig, "requestChatCompletion(", "one-on-one cloud chat request");
mustInclude(chatWithConfig, '"chat"', "one-on-one cloud chat use");
mustInclude(chatWithConfig, "buildUserPrompt(context)", "one-on-one prompt context");
mustMatch(chatWithConfig, /signal,\s*true,\s*\)/, "one-on-one cloud chat uses JSON mode");
mustInclude(ai, "explicitEmotion", "provider parser marks explicit emotion");
mustInclude(ai, "extractLooseEmotionResult", "loose JSON emotion fallback");
mustInclude(ai, "withInferredEmotion(parseProviderContent(content, context.activeCharacter.name), context)", "cloud fallback emotion inference");
mustInclude(ai, "normalizeLocalModelReplySafe", "local model normalization path");
mustInclude(ai, "inferCharacterEmotionFromReply", "shared emotion inference helper");
mustInclude(ai, "happy: emotionScore", "happy inference");
mustInclude(ai, "angry: emotionScore", "angry inference");
mustInclude(ai, "sad: emotionScore", "sad inference");
mustInclude(ai, "surprised: emotionScore", "surprised inference");
mustInclude(ai, "curious: emotionScore", "curious inference");
mustInclude(ai, "calm: emotionScore", "calm inference");
mustInclude(ai, "thinking: emotionScore", "thinking inference");
mustInclude(ai, "开心|高兴", "real Chinese happy inference keywords");
mustInclude(ai, "思考|想想", "real Chinese thinking inference keywords");
mustNotInclude(ai, "\u5bee\u20ac\u8e47", "mojibake happy inference keyword");
mustNotInclude(ai, "\u9422\u7197\u76b5", "mojibake angry inference keyword");

if (failures.length > 0) {
  console.error("validate-one-on-one-emotion-output failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-one-on-one-emotion-output passed");
