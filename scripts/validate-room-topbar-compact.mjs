import fs from "node:fs";

const roomSurface = fs.readFileSync("src/ui/roomSurface.ts", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");
const failures = [];

const topbar = sliceFunction(roomSurface, "renderRoomTopbar");
mustNotInclude(topbar, "renderRoomCompactStatus(props)", "topbar must not render room open/pause status");
mustNotInclude(topbar, "room-surface-status", "topbar must not create the old status pill container");
mustNotInclude(topbar, "statusPill(t(language, \"roomStatusRoom\")", "topbar must not render room status pill");
mustNotInclude(topbar, "statusPill(t(language, \"roomStatusAuto\")", "topbar must not render auto status pill");
mustNotInclude(topbar, "statusPill(t(language, \"roomStatusApi\")", "topbar must not render AI status pill");
mustNotInclude(topbar, "statusPill(t(language, \"roomStatusPrompt\")", "topbar must not render prompt status pill");
mustNotInclude(topbar, "statusPill(t(language, \"roomStatusWhispers\")", "topbar must not render private whisper status pill");
mustNotInclude(topbar, "statusPill(t(language, \"roomFactionTitle\")", "topbar must not render faction status pill");

mustInclude(styles, "grid-template-columns: 34px minmax(90px, 1fr);", "role chips use compact grid");
mustInclude(styles, "min-width: 150px;", "role chips use compact min width");
mustInclude(styles, "padding: 6px 10px;", "role strip uses compact padding");
mustInclude(styles, ".room-faction-dot", "role chip uses compact faction dot");

const roleViewport = sliceFunction(roomSurface, "renderRoleViewport");
mustInclude(roleViewport, "card.title =", "role details move to title");
mustInclude(roleViewport, "room-faction-dot", "role chip shows faction dot");
mustNotInclude(roleViewport, "<span>${escapeHtml(participant.packId)} / ${escapeHtml(participant.currentEmotion)}</span>", "role chip must not show pack id and emotion as primary text");

if (failures.length) {
  console.error(failures.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log("validate-room-topbar-compact: ok");

function sliceFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) {
    failures.push(`missing function ${name}`);
    return "";
  }
  const next = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, next > start ? next : undefined);
}

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
