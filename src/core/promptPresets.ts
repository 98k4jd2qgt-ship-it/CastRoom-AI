import type {
  AppLanguage,
  PromptCenterPromptType,
  PromptPreset,
  PromptPresetKind,
  PromptPresetSource,
  PromptScope,
  RoomContextPanelMode,
} from "./types";

export const maxPromptPresetTextChars = 12_000;

export function promptPresetKindForTarget(scope: PromptScope, promptType?: PromptCenterPromptType): PromptPresetKind | null {
  if (scope === "character_pack") {
    return "character_base";
  }
  if (scope === "director") {
    return "director_rules";
  }
  if (scope === "room_role") {
    return "room_role_override";
  }
  if (scope === "room") {
    return promptType === "roles" ? "room_role_override" : "room_rules";
  }
  return null;
}

export function isPromptPresetCompatibleWithTarget(
  preset: PromptPreset,
  scope: PromptScope,
  mode: RoomContextPanelMode | null,
  promptType?: PromptCenterPromptType,
): boolean {
  const expectedKind = promptPresetKindForTarget(scope, promptType);
  if (!expectedKind || preset.kind !== expectedKind) {
    return false;
  }
  if (preset.kind === "character_base") {
    return true;
  }
  if (!mode) {
    return true;
  }
  const modes = preset.supportedModes?.length ? preset.supportedModes : ["any"];
  return modes.includes("any") || modes.includes(mode);
}

export function listPromptPresetsForTarget(
  presets: PromptPreset[],
  scope: PromptScope,
  mode: RoomContextPanelMode | null,
  promptType?: PromptCenterPromptType,
): PromptPreset[] {
  return presets
    .filter((preset) => isPromptPresetCompatibleWithTarget(preset, scope, mode, promptType))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.title.localeCompare(b.title));
}

export function createPromptPreset(input: {
  kind: PromptPresetKind;
  title: string;
  description?: string;
  language?: "auto" | AppLanguage;
  supportedModes?: Array<RoomContextPanelMode | "any">;
  text: string;
  tags?: string[];
  source?: PromptPresetSource;
  sourceId?: string;
  now?: string;
  id?: string;
}): PromptPreset {
  const now = input.now ?? new Date().toISOString();
  return {
    id: input.id ?? promptPresetId(input.kind, input.title, now),
    kind: input.kind,
    title: cleanPromptPresetTitle(input.title),
    description: cleanPromptPresetDescription(input.description ?? ""),
    language: input.language ?? "auto",
    supportedModes: normalizePromptPresetModes(input.supportedModes),
    text: cleanPromptPresetText(input.text),
    tags: normalizePromptPresetTags(input.tags),
    source: input.source ?? "user",
    sourceId: input.sourceId,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizePromptPreset(value: unknown): PromptPreset | null {
  const raw = value as Partial<PromptPreset>;
  if (!raw || !isPromptPresetKind(raw.kind) || typeof raw.text !== "string") {
    return null;
  }
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt : new Date(0).toISOString();
  const updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : createdAt;
  const title = typeof raw.title === "string" && raw.title.trim() ? raw.title : "Untitled preset";
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : promptPresetId(raw.kind, title, createdAt),
    kind: raw.kind,
    title: cleanPromptPresetTitle(title),
    description: cleanPromptPresetDescription(typeof raw.description === "string" ? raw.description : ""),
    language: isPromptPresetLanguage(raw.language) ? raw.language : "auto",
    supportedModes: normalizePromptPresetModes(raw.supportedModes),
    text: cleanPromptPresetText(raw.text),
    tags: normalizePromptPresetTags(raw.tags),
    source: isPromptPresetSource(raw.source) ? raw.source : "user",
    sourceId: typeof raw.sourceId === "string" && raw.sourceId.trim() ? raw.sourceId.trim() : undefined,
    revision: Number.isFinite(raw.revision) && Number(raw.revision) > 0 ? Number(raw.revision) : 1,
    createdAt,
    updatedAt,
  };
}

export function normalizePromptPresets(values: unknown): PromptPreset[] {
  const list = Array.isArray(values) ? values : [];
  const seen = new Set<string>();
  const presets: PromptPreset[] = [];
  for (const item of list) {
    const preset = normalizePromptPreset(item);
    if (!preset || seen.has(preset.id)) {
      continue;
    }
    seen.add(preset.id);
    presets.push(preset);
  }
  return presets;
}

export function upsertPromptPreset(presets: PromptPreset[], next: PromptPreset): PromptPreset[] {
  const found = presets.some((preset) => preset.id === next.id);
  if (!found) {
    return [...presets, next];
  }
  return presets.map((preset) => (preset.id === next.id ? next : preset));
}

export function importPromptPresets(existing: PromptPreset[], incoming: PromptPreset[]): PromptPreset[] {
  let result = existing;
  for (const preset of incoming) {
    result = upsertPromptPreset(result, {
      ...preset,
      source: preset.source === "bundled" ? "imported" : preset.source,
    });
  }
  return result;
}

export function cleanPromptPresetText(text: string): string {
  return text.trim().slice(0, maxPromptPresetTextChars);
}

function cleanPromptPresetTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").slice(0, 80) || "Untitled preset";
}

function cleanPromptPresetDescription(description: string): string {
  return description.trim().replace(/\s+/g, " ").slice(0, 240);
}

function normalizePromptPresetTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  return [...new Set(tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean))]
    .slice(0, 12)
    .map((tag) => tag.slice(0, 32));
}

function normalizePromptPresetModes(modes: unknown): Array<RoomContextPanelMode | "any"> | undefined {
  if (!Array.isArray(modes)) {
    return undefined;
  }
  const values = modes.filter(isPromptPresetMode);
  return values.length ? [...new Set(values)] : undefined;
}

function promptPresetId(kind: PromptPresetKind, title: string, now: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36) || "preset";
  return `${kind}:${slug}:${Date.parse(now) || Date.now()}`;
}

function isPromptPresetKind(value: unknown): value is PromptPresetKind {
  return value === "character_base" || value === "room_rules" || value === "director_rules" || value === "room_role_override";
}

function isPromptPresetSource(value: unknown): value is PromptPresetSource {
  return value === "user" || value === "imported" || value === "workshop" || value === "bundled";
}

function isPromptPresetLanguage(value: unknown): value is "auto" | AppLanguage {
  return value === "auto" || value === "en" || value === "zh-CN" || value === "ja-JP" || value === "ko-KR" || value === "de-DE" || value === "ru-RU";
}

function isPromptPresetMode(value: unknown): value is RoomContextPanelMode | "any" {
  return value === "any" || value === "casual" || value === "story" || value === "mystery" || value === "debate" || value === "study" || value === "planning" || value === "team";
}
