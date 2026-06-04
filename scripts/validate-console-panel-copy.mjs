import fs from "node:fs";

const source = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const failures = [];

function mustInclude(marker, message) {
  if (!source.includes(marker)) {
    failures.push(message);
  }
}

function mustNotInclude(marker, message) {
  if (source.includes(marker)) {
    failures.push(message);
  }
}

function mustNotMatch(pattern, message) {
  if (pattern.test(source)) {
    failures.push(message);
  }
}

mustInclude('panelHeader(t(language, "chatTitle"))', "Chat panel header should render only the page title.");
mustInclude('const root = panel(t(language, "helpTitle"));', "Help panel should render only the page title.");
mustInclude('const root = panel(t(language, "commandsTitle"));', "Commands panel should render only the page title.");
mustInclude('const root = panel(t(language, "configTitle"));', "Config panel should render only the page title.");
mustInclude('const root = panel(t(language, "memoryPanelTitle"));', "Memory dashboard should render only the page title.");
mustInclude('const root = panel(uiText(language, "Diagnostics", "诊断"));', "Diagnostics panel should render only the page title.");
mustInclude('const root = panel(uiText(language, "Release check", "发布检查"));', "Release panel should render only the page title.");

mustNotInclude('panelHeader(t(language, "chatTitle"), t(language, "chatDescription"))', "Chat page must not show a title subtitle.");
mustNotInclude('panel(t(language, "helpTitle"), t(language, "helpDescription"))', "Help page must not show a title subtitle.");
mustNotInclude('panel(t(language, "commandsTitle"), t(language, "commandsDescription"))', "Commands page must not show a title subtitle.");
mustNotInclude('panel(t(language, "setupTitle"), t(language, "setupDescription"))', "Setup page must not show a title subtitle.");
mustNotInclude('panel(t(language, "configTitle"), t(language, "configDescription"))', "Config page must not show a title subtitle.");
mustNotInclude('t(language, "memoryPanelDescription") : t(language, "memoryNone")', "Memory page must not show a title subtitle.");
mustNotInclude('Memory saving is on.', "Compact memory page must not use a page-level status subtitle.");
mustNotInclude('Review local status and export diagnostics.', "Diagnostics page must not show a title subtitle.");
mustNotInclude('Local release readiness summary.', "Release page must not show a title subtitle.");

mustNotMatch(
  /panelHeader\(\s*t\(language,\s*"chatTitle"\)\s*,/s,
  "Chat panel header should not receive a description argument.",
);
mustNotMatch(
  /panel\(\s*t\(language,\s*"(?:helpTitle|commandsTitle|setupTitle|configTitle|memoryPanelTitle)"\)\s*,/s,
  "Main Console panels should not receive page-level description copy.",
);

for (const marker of ["璋冭瘯", "鎵撳紑", "缂栬緫", "鈻?", "鏈湴妯"]) {
  mustNotInclude(marker, `petConsole.ts contains likely mojibake fallback: ${marker}`);
}

if (failures.length > 0) {
  console.error(`Console panel copy validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Console panel copy validation passed.");
