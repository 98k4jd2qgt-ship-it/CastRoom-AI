import fs from "node:fs";

const failures = [];

const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const petConsole = fs.readFileSync("src/ui/petConsole.ts", "utf8");
const expandableText = fs.readFileSync("src/ui/expandableText.ts", "utf8");
const css = fs.readFileSync("src/styles.css", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

mustInclude(roomSurface, "renderExpandableText", "Room Inspector must use expandable dynamic text");
mustInclude(petConsole, "renderExpandableText", "Memory page must use expandable dynamic text");
mustInclude(css, ".expandable-text-toggle", "Expandable text toggle styles must exist");
mustInclude(css, ".expandable-text-content[data-expanded=\"false\"]", "Expandable text collapsed styles must exist");
mustInclude(packageJson, "scripts/validate-readable-dynamic-text.mjs", "npm check must run readable dynamic text validation");
mustInclude(expandableText, "requestAnimationFrame", "Expandable text must check real rendered overflow after layout");
mustInclude(expandableText, "ResizeObserver", "Expandable text must re-check overflow when panel width changes");
mustInclude(expandableText, "scrollHeight > content.clientHeight", "Expandable text must reveal toggle when content is actually clipped");
mustNotInclude(expandableText, "鏀惰捣", "Expandable text Chinese labels must not be mojibake");
mustNotInclude(expandableText, "灞曞紑", "Expandable text Chinese labels must not be mojibake");

mustNotInclude(
  roomSurface,
  "row.innerHTML = `<span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong>`;",
  "Room Inspector context values must not be rendered as clamped strong text",
);
mustNotInclude(
  petConsole,
  '<strong title="${escapeHtml(fact.text)}">${escapeHtml(fact.text)}</strong>',
  "Memory fact text must not be rendered as a clamped strong element",
);

for (const selector of [
  ".room-inspector .room-context-row strong",
  ".memory-fact-row strong",
  ".memory-scope-heading small",
]) {
  const block = findCssBlock(css, selector);
  if (block.includes("-webkit-line-clamp")) {
    failures.push(`${selector} must not use non-expandable line clamp`);
  }
}

if (failures.length > 0) {
  console.error(`Readable dynamic text validation failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}`);
  process.exit(1);
}

console.log("Readable dynamic text validation passed");

function mustInclude(source, needle, message) {
  if (!source.includes(needle)) {
    failures.push(message);
  }
}

function mustNotInclude(source, needle, message) {
  if (source.includes(needle)) {
    failures.push(message);
  }
}

function findCssBlock(source, selector) {
  const index = source.indexOf(selector);
  if (index < 0) {
    return "";
  }
  const open = source.indexOf("{", index);
  if (open < 0) {
    return "";
  }
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(index, i + 1);
      }
    }
  }
  return source.slice(index);
}
