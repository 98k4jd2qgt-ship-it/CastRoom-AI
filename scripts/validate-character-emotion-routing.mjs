import fs from "node:fs";
import path from "node:path";

const types = fs.readFileSync("src/core/types.ts", "utf8");
const ai = fs.readFileSync("src/core/ai.ts", "utf8");
const main = fs.readFileSync("src/main.ts", "utf8");
const packs = fs.readFileSync("src/core/characterPacks.ts", "utf8");
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");

const failures = [];

function mustInclude(source, text, label) {
  if (!source.includes(text)) {
    failures.push(`${label}: missing ${text}`);
  }
}

function mustMatch(source, pattern, label) {
  if (!pattern.test(source)) {
    failures.push(`${label}: missing pattern ${pattern}`);
  }
}

mustInclude(types, "explicitEmotion?: boolean", "EmotionResult explicit emotion marker");
mustInclude(ai, "export function inferCharacterEmotionFromReply", "exported emotion inference");
mustInclude(ai, 'const supportedEmotions = new Set(["idle", "happy", "sad", "angry", "surprised", "curious", "calm", "thinking"])', "thinking supported emotion");
mustInclude(ai, "thinking: emotionScore", "thinking inference branch");
mustInclude(petConsole, "export function renderConsoleCharacterDeck", "one-on-one character deck partial renderer");
mustInclude(main, "renderConsoleCharacterDeck", "main imports character deck partial renderer");
mustInclude(main, "function refreshConsoleCharacterDeck()", "one-on-one character deck refresh helper");
mustMatch(
  main,
  /applyCharacterResult[\s\S]*createEffectiveCharacterViewModel\([\s\S]*result\.emotion[\s\S]*result\.text[\s\S]*refreshConsoleCharacterDeck\(\)/,
  "one-on-one applies result emotion to active character view model",
);
mustMatch(
  main,
  /function scheduleIdleEmotion\(\)[\s\S]*createEffectiveCharacterViewModel\([\s\S]*"idle"[\s\S]*refreshConsoleCharacterDeck\(\)/,
  "one-on-one idle emotion refreshes character deck",
);
mustMatch(
  main,
  /emotion:\s*providerResult\?\.emotion \?\? result\.emotion/,
  "room speaker uses provider or inferred emotion before scheduler hint",
);
mustMatch(
  main,
  /type:\s*"room\.updateParticipant"[\s\S]*emotion,/,
  "room participant state receives final emotion",
);
mustMatch(
  packs,
  /createCharacterViewModel[\s\S]*resolveEmotionAsset\(pack, emotion\)/,
  "character view model resolves emotion asset",
);
mustMatch(
  packs,
  /mergeAssetCandidates\([\s\S]*createEmotionAssetCandidates\(pack\.id, folder\)[\s\S]*createEmotionAssetCandidates\(pack\.id, idleFolder\)/,
  "emotion assets fall back to idle candidates",
);
mustInclude(packs, 'curious: ["thinking"]', "curious emotion can use thinking assets");
mustInclude(packs, 'thinking: ["curious"]', "thinking emotion can use curious assets");

const manifestPath = "character-packs/new-character-2/manifest.toml";
if (fs.existsSync(manifestPath)) {
  const manifest = fs.readFileSync(manifestPath, "utf8");
  const declared = [...manifest.matchAll(/^"([^"]+)"\s*=\s*"([^"]+)"/gm)].map((match) => ({
    emotion: match[1],
    folder: match[2],
  }));
  const missing = declared.filter(({ folder }) => {
    const folderPath = path.join("character-packs/new-character-2", folder);
    if (!fs.existsSync(folderPath)) {
      return true;
    }
    return fs.readdirSync(folderPath).filter((entry) => /\.(png|jpe?g|gif|txt|art|ansi)$/i.test(entry)).length === 0;
  });
  if (!declared.some((item) => item.emotion === "happy") || !fs.existsSync("character-packs/new-character-2/emotions/happy/custom.png")) {
    failures.push("new-character-2 fixture should keep a real happy image for emotion routing checks");
  }
  if (missing.length === 0) {
    failures.push("new-character-2 fixture should expose missing emotion assets so fallback diagnostics remain testable");
  }
}

if (failures.length > 0) {
  console.error("validate-character-emotion-routing failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("validate-character-emotion-routing passed");
