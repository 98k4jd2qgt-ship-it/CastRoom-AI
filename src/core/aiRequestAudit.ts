import type { ConsoleTurnController, ConsoleTurnStage } from "./chatTurnEngine";
import type { AiTokenUsage } from "./types";

export type AiRequestAuditScope = "console" | "room" | "config";
export type AiRequestPurpose =
  | "config_test"
  | "console_chat"
  | "vision_caption"
  | "room_planner"
  | "room_speaker"
  | "room_director";
export type AiRequestAuditOutcome = "started" | "success" | "failed" | "stale" | "cancelled";

export interface AiRequestAuditEntry {
  turnId: string;
  executorId?: string;
  requestId: string;
  providerId: string;
  scope: AiRequestAuditScope;
  purpose: AiRequestPurpose;
  startedAt: string;
  finishedAt?: string;
  outcome: AiRequestAuditOutcome;
  errorCode?: string;
  responseShape?: string;
  usage?: AiTokenUsage;
}

export interface AiRequestAuditHandle {
  requestId: string;
  executorId?: string;
  startedAt: number;
  providerId: string;
  scope: AiRequestAuditScope;
  purpose: AiRequestPurpose;
  turnId: string;
}

export interface AiRequestAuditDuplicate {
  turnId: string;
  providerId: string;
  existingRequestIds: string[];
  purpose: AiRequestPurpose;
}

export type BeginAiRequestAuditResult =
  | { ok: true; audit: AiRequestAuditHandle; duplicate?: undefined }
  | { ok: false; audit: null; duplicate: AiRequestAuditDuplicate };

export class AiRequestAuditLog {
  readonly consoleChatRequestStage: ConsoleTurnStage = "cloud_request_started";
  private sequence = 0;
  private entries: AiRequestAuditEntry[] = [];

  constructor(private readonly maxEntries = 20) {}

  get latest(): AiRequestAuditEntry | null {
    return this.entries.at(-1) ?? null;
  }

  snapshot(): AiRequestAuditEntry[] {
    return [...this.entries];
  }

  begin(input: {
    turn?: ConsoleTurnController | null;
    providerId: string;
    scope: AiRequestAuditScope;
    purpose: AiRequestPurpose;
    contextId?: string;
    updateTurnStage?: (turn: ConsoleTurnController, stage: ConsoleTurnStage) => void;
    nowMs?: number;
  }): BeginAiRequestAuditResult {
    if (input.turn && input.purpose === "console_chat" && input.turn.consoleCloudRequestStarted) {
      return {
        ok: false,
        audit: null,
        duplicate: {
          turnId: input.turn.id,
          providerId: input.providerId,
          existingRequestIds: [...input.turn.requestIds],
          purpose: input.purpose,
        },
      };
    }

    const startedAt = input.nowMs ?? Date.now();
    const turnId = input.turn?.id ?? input.contextId ?? `${input.scope}-${input.purpose}-${startedAt}`;
    const executorId = input.turn?.executorId;
    const requestPrefix = executorId ?? turnId;
    const requestId = `${requestPrefix}-${input.purpose}-${++this.sequence}`;
    if (input.turn && input.purpose === "console_chat") {
      input.turn.consoleCloudRequestStarted = true;
      input.turn.requestIds.push(requestId);
      input.updateTurnStage?.(input.turn, this.consoleChatRequestStage);
    } else if (input.turn && input.purpose === "vision_caption") {
      input.turn.requestIds.push(requestId);
    }

    this.entries.push({
      turnId,
      ...(executorId ? { executorId } : {}),
      requestId,
      providerId: input.providerId,
      scope: input.scope,
      purpose: input.purpose,
      startedAt: new Date(startedAt).toISOString(),
      outcome: "started",
    });
    this.entries.splice(0, Math.max(0, this.entries.length - this.maxEntries));

    return {
      ok: true,
      audit: {
        requestId,
        executorId,
        startedAt,
        providerId: input.providerId,
        scope: input.scope,
        purpose: input.purpose,
        turnId,
      },
    };
  }

  finish(
    audit: AiRequestAuditHandle | null | undefined,
    outcome: Exclude<AiRequestAuditOutcome, "started">,
    details: Record<string, unknown> = {},
    nowMs = Date.now(),
  ): AiRequestAuditEntry | null {
    if (!audit) {
      return null;
    }

    const entry = this.entries.find((item) => item.requestId === audit.requestId);
    if (!entry) {
      return null;
    }

    entry.finishedAt = new Date(nowMs).toISOString();
    entry.outcome = outcome;
    if (typeof details.errorCode === "string") {
      entry.errorCode = details.errorCode;
    }
    if (typeof details.responseShape === "string") {
      entry.responseShape = details.responseShape;
    }
    if (isAiTokenUsage(details.usage)) {
      entry.usage = details.usage;
    }
    return entry;
  }
}

function isAiTokenUsage(value: unknown): value is AiTokenUsage {
  if (!value || typeof value !== "object") {
    return false;
  }
  const usage = value as Partial<AiTokenUsage>;
  return typeof usage.promptChars === "number" && typeof usage.completionChars === "number";
}
