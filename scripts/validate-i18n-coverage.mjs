import fs from "node:fs";

const requiredLanguages = ["en", "zh-CN", "ja-JP", "ko-KR", "de-DE", "ru-RU"];
const failures = [];

const typesText = fs.readFileSync("src/core/types.ts", "utf8");
const copyText = fs.readFileSync("src/ui/copy.ts", "utf8");
const petConsoleText = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const roomSurfaceText = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const expandableText = fs.existsSync("src/ui/expandableText.ts") ? fs.readFileSync("src/ui/expandableText.ts", "utf8") : "";

for (const language of requiredLanguages) {
  if (!typesText.includes(`"${language}"`)) {
    failures.push(`AppLanguage is missing ${language}`);
  }
  if (!copyText.includes(`${JSON.stringify(language)}:`) && !copyText.includes(`${language}:`)) {
    failures.push(`copy.ts does not define locale entry or override for ${language}`);
  }
}

if (!copyText.includes("const localeCopy: Record<AppLanguage, Record<LocaleCopyKey, string>>")) {
  failures.push("copy.ts must expose a complete localeCopy record for every AppLanguage");
}

if (!copyText.includes("export function languageOptions")) {
  failures.push("languageOptions() is required for the multi-language switcher");
}

if (!copyText.includes("export function uiText(")) {
  failures.push("copy.ts must expose uiText() while legacy inline UI strings migrate to full copy keys");
}

if (!petConsoleText.includes("languageOptions(props.state.language)")) {
  failures.push("Header language switcher must use languageOptions()");
}

if (!copyText.includes("roomUi:") || !roomSurfaceText.includes('localizeEnum(language, "roomUi"')) {
  failures.push("Room surface labels must use the shared roomUi i18n table");
}

assertEnglishLocaleHasNoNonEnglishText();
assertNoMojibakeInUiCopy();
assertNoDirectZhBranches();
assertNoReplaceAllLocalization();
assertUsedUiCopyDoesNotSilentlyFallbackToEnglish();
assertSecondaryUiTablesCoverAllLanguages();
assertProductTermsAreLocalizedAtUiBoundary();
assertRoomOpenHooksUsesUserFacingLabel();

if (failures.length > 0) {
  console.error(`i18n coverage validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("i18n coverage validation passed");

function assertEnglishLocaleHasNoNonEnglishText() {
  const start = copyText.indexOf("const baseLocaleCopy = {\n  en:");
  const end = copyText.indexOf('  "zh-CN":', start);
  if (start < 0 || end < 0) {
    failures.push("copy.ts must keep baseLocaleCopy.en before baseLocaleCopy.zh-CN for validation");
    return;
  }
  const englishBlock = copyText.slice(start, end);
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}]/u.test(englishBlock)) {
    failures.push("baseLocaleCopy.en contains non-English UI text");
  }
}

function assertNoMojibakeInUiCopy() {
  const patterns = [
    /鍏|涓|瑙|鏃|頃|袪|鐨|銆|\ufffd/,
    /[\u00c0-\u00ff\u0100-\u017f\ufffd]|[\u201a-\u201e\u2020-\u2021\u2026\u2030\u20ac\u2122]/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(copyText)) {
      failures.push(`copy.ts contains likely mojibake or stray Latin-1 UI text: ${pattern}`);
    }
  }
}

function assertNoDirectZhBranches() {
  const forbiddenUiBranchPattern = /language\s*[!=]==\s*"zh-CN"|props\.state\.language\s*[!=]==\s*"zh-CN"/;
  for (const [file, text] of [
    ["src/ui/petConsole.ts", petConsoleText],
    ["src/ui/roomSurface.ts", roomSurfaceText],
    ["src/ui/expandableText.ts", expandableText],
  ]) {
    if (forbiddenUiBranchPattern.test(text)) {
      failures.push(`${file} still contains direct zh-CN UI branching; use t(), uiText(), or localizeEnum()`);
    }
  }
}

function assertNoReplaceAllLocalization() {
  const forbidden = ['replaceAll("English"', 'replaceAll("Room facts', 'replaceAll("The room is ready'];
  for (const marker of forbidden) {
    if (roomSurfaceText.includes(marker)) {
      failures.push("roomSurface.ts must not localize UI text with replaceAll(); use localizeEnum/t");
    }
  }
}

function assertUsedUiCopyDoesNotSilentlyFallbackToEnglish() {
  const usedTKeys = collectUsedTKeys();
  const englishCopy = extractEnglishCopy();
  const overrideBlockStart = copyText.indexOf("const localeOverrides");
  const overrideBlockEnd = copyText.indexOf("const localeCopy", overrideBlockStart);
  const overrideBlock = overrideBlockStart >= 0 && overrideBlockEnd >= 0 ? copyText.slice(overrideBlockStart, overrideBlockEnd) : "";
  const generatedKeyBlockStart = copyText.indexOf("const generatedCopyByKey");
  const generatedKeyBlockEnd = copyText.indexOf("function generatedLocaleCopy", generatedKeyBlockStart);
  const generatedKeyBlock = generatedKeyBlockStart >= 0 && generatedKeyBlockEnd >= 0 ? copyText.slice(generatedKeyBlockStart, generatedKeyBlockEnd) : "";
  const generatedEnglishBlockStart = copyText.indexOf("const generatedCopyByEnglish");
  const generatedEnglishBlockEnd = copyText.indexOf("const generatedCopyByKey", generatedEnglishBlockStart);
  const generatedEnglishBlock =
    generatedEnglishBlockStart >= 0 && generatedEnglishBlockEnd >= 0
      ? copyText.slice(generatedEnglishBlockStart, generatedEnglishBlockEnd)
      : "";

  if (!copyText.includes("generatedLocaleCopy(language, key, englishTemplate)")) {
    failures.push("t() must call generatedLocaleCopy() before falling back to English");
  }

  for (const key of usedTKeys) {
    const english = englishCopy.get(key);
    if (!english) {
      continue;
    }
    const isLongUiText =
      english.length > 28 ||
      /[.!?。]/.test(english) ||
      /\{[^}]+\}/.test(english) ||
      /(Description|Help|Placeholder|Line|Note|Policy|Conflict|Topline|Empty|Hidden|Locked|Disabled|Ready|Error|Failed)/.test(key);
    if (!isLongUiText) {
      continue;
    }
    const hasExplicitKeyFallback = new RegExp(`\\b${key}:\\s*\\{`).test(generatedKeyBlock);
    const hasExplicitEnglishFallback = generatedEnglishBlock.includes(`${JSON.stringify(english)}:`);
    const missingLanguages = requiredLanguages
      .filter((language) => !["en", "zh-CN"].includes(language))
      .filter((language) => {
        const languageStart = overrideBlock.indexOf(`  "${language}": {`);
        const languageEnd = overrideBlock.indexOf("\n  },", languageStart);
        const languageBlock = languageStart >= 0 && languageEnd >= 0 ? overrideBlock.slice(languageStart, languageEnd) : "";
        return !new RegExp(`\\b${key}:`).test(languageBlock);
      });
    if (missingLanguages.length > 0 && !hasExplicitKeyFallback && !hasExplicitEnglishFallback) {
      failures.push(`Long UI copy key "${key}" can still fall back to English for ${missingLanguages.join(", ")}`);
    }
  }
}

function assertSecondaryUiTablesCoverAllLanguages() {
  const tables = [
    {
      name: "setupStepCopy entries",
      start: "export function setupStepCopy",
      end: "export function normalizeSetupStep",
      keys: ["start", "ai_service", "character", "voice", "privacy", "finish"],
    },
    {
      name: "commandDescriptions",
      start: "const commandDescriptions",
      end: "export function categoryLabel",
      keys: ["/help", "/commands", "/ai status", "/ai test", "/ai last", "/ai trace", "/ai cancel", "/debug state", "/debug room", "/debug memory", "/debug export"],
    },
  ];

  for (const table of tables) {
    const start = copyText.indexOf(table.start);
    const end = copyText.indexOf(table.end, start);
    const block = start >= 0 && end >= 0 ? copyText.slice(start, end) : "";
    if (!block) {
      failures.push(`Could not find ${table.name} for i18n coverage validation`);
      continue;
    }
    for (const language of requiredLanguages) {
      const languageMarker = language === "en" ? "en:" : `${JSON.stringify(language)}:`;
      const languageStart = block.indexOf(languageMarker);
      if (languageStart < 0) {
        failures.push(`${table.name} is missing ${language}`);
        continue;
      }
      const nextLanguageIndexes = requiredLanguages
        .filter((candidate) => candidate !== language)
        .map((candidate) => block.indexOf(candidate === "en" ? "en:" : `${JSON.stringify(candidate)}:`, languageStart + languageMarker.length))
        .filter((index) => index > languageStart);
      const languageEnd = nextLanguageIndexes.length > 0 ? Math.min(...nextLanguageIndexes) : block.length;
      const languageBlock = block.slice(languageStart, languageEnd);
      for (const key of table.keys) {
        const keyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/.test(key)
          ? new RegExp(`\\b${key}\\s*:`)
          : new RegExp(`${escapeRegExp(JSON.stringify(key))}\\s*:`);
        if (!keyPattern.test(languageBlock)) {
          failures.push(`${table.name} ${language} is missing ${key}`);
        }
      }
    }
  }
}

function assertProductTermsAreLocalizedAtUiBoundary() {
  if (!copyText.includes("function localizeProductTerms(")) {
    failures.push("copy.ts must define localizeProductTerms() so Room/Director are localized outside English");
  }
  if (!copyText.includes("function normalizeUiCopy(")) {
    failures.push("copy.ts must define normalizeUiCopy() as the shared UI copy normalization boundary");
  }

  const termsStart = copyText.indexOf("const terms: Record<Exclude<AppLanguage");
  const termsEnd = copyText.indexOf("  };", termsStart);
  const termsBlock = termsStart >= 0 && termsEnd >= 0 ? copyText.slice(termsStart, termsEnd) : "";
  const expectedTerms = {
    "zh-CN": ["房间", "导演"],
    "ja-JP": ["ルーム", "ディレクター"],
    "ko-KR": ["방", "디렉터"],
    "de-DE": ["Raum", "Raeume", "Regie"],
    "ru-RU": ["комната", "комнаты", "режиссёр"],
  };
  for (const [language, terms] of Object.entries(expectedTerms)) {
    if (!termsBlock.includes(`${JSON.stringify(language)}:`)) {
      failures.push(`localizeProductTerms() is missing ${language}`);
      continue;
    }
    for (const term of terms) {
      if (!termsBlock.includes(term)) {
        failures.push(`localizeProductTerms() ${language} is missing term "${term}"`);
      }
    }
  }

  const boundaryChecks = [
    {
      name: "t()",
      start: "export function t(",
      end: "const inlineUiCopy",
      marker: "return normalizeUiCopy(language, result);",
    },
    {
      name: "uiText()",
      start: "export function uiText(",
      end: "Object.assign(inlineUiCopy",
      marker: "normalizeUiCopy(language, english)",
    },
    {
      name: "localizeEnum()",
      start: "export function localizeEnum(",
      end: "export function categoryLabel",
      marker:
        "return normalizeUiCopy(language, localizedSupplement?.[value] ?? localized[value] ?? englishSupplement?.[value] ?? english[value] ?? fallback);",
    },
    {
      name: "viewCopy()",
      start: "export function viewCopy(",
      end: "export function setupStepCopy",
      marker: "repairCopyObject(",
    },
    {
      name: "setupStepCopy()",
      start: "export function setupStepCopy",
      end: "export function normalizeSetupStep",
      marker: "repairSetupCopy(",
    },
    {
      name: "commandDescription()",
      start: "export function commandDescription(",
      end: "const commandDescriptions",
      marker: "return normalizeUiCopy(language,",
    },
  ];

  for (const check of boundaryChecks) {
    const start = copyText.indexOf(check.start);
    const end = copyText.indexOf(check.end, start);
    const block = start >= 0 && end >= 0 ? copyText.slice(start, end) : "";
    if (!block) {
      failures.push(`Could not find ${check.name} for product term localization validation`);
      continue;
    }
    if (!block.includes(check.marker)) {
      failures.push(`${check.name} must pass UI copy through normalizeUiCopy()/repairCopyObject() so Room/Director are localized`);
    }
  }
}

function assertRoomOpenHooksUsesUserFacingLabel() {
  const expectedOpenHooksLabels = {
    en: "Progress points",
    "zh-CN": "可推进点",
    "ja-JP": "進行ポイント",
    "ko-KR": "진행 포인트",
    "de-DE": "Fortsetzungspunkte",
    "ru-RU": "точки развития",
  };
  for (const [language, label] of Object.entries(expectedOpenHooksLabels)) {
    if (!copyText.includes(`openHooks: ${JSON.stringify(label)}`)) {
      failures.push(`roomUi.openHooks ${language} must use user-facing label "${label}" instead of hook terminology`);
    }
  }
  if (/openHooks:\s*"(?:Open hooks|开放钩子|.*Hook|.*Hooks|.*フック|.*훅)/.test(copyText)) {
    failures.push("roomUi.openHooks must not expose hook terminology in the UI");
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collectUsedTKeys() {
  const keys = new Set();
  const texts = [petConsoleText, roomSurfaceText, fs.existsSync("src/ui/petMode.ts") ? fs.readFileSync("src/ui/petMode.ts", "utf8") : ""];
  const tCallPattern =
    /\bt\(\s*(?:props\.state\.language|state\.language|language|consoleState\.language|appState\.language)\s*,\s*"([A-Za-z0-9_]+)"/g;
  for (const text of texts) {
    let match;
    while ((match = tCallPattern.exec(text))) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function extractEnglishCopy() {
  const start = copyText.indexOf("  en: {", copyText.indexOf("const baseLocaleCopy"));
  const end = copyText.indexOf('  "zh-CN": {', start);
  const block = start >= 0 && end >= 0 ? copyText.slice(start, end) : "";
  const values = new Map();
  const entryPattern = /^\s{4}([A-Za-z0-9_]+):\s*"([^"]*)"/gm;
  let match;
  while ((match = entryPattern.exec(block))) {
    values.set(match[1], match[2]);
  }
  return values;
}
