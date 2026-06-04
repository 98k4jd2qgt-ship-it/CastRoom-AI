export type ConsoleTurnStatus = "pending" | "completed" | "failed" | "cancelled";

export type ConsoleTurnStage =
  | "received"
  | "command_routed"
  | "turn_created"
  | "user_message_committed"
  | "provider_selected"
  | "cloud_request_started"
  | "result_committed"
  | "error_committed"
  | "cancelled";

export interface ConsoleTurnController {
  id: string;
  executorId?: string;
  key: string;
  status: ConsoleTurnStatus;
  startedAt: number;
  requestIds: string[];
  consoleCloudRequestStarted: boolean;
  visibleTerminalCommitted: boolean;
  stage: ConsoleTurnStage;
  lastStageAt: number;
  providerIds: string[];
  lastError?: string;
}

export interface ConsoleSubmitTrace {
  valuePreview: string;
  at: number;
}

export interface ConsoleAcceptedTurnTrace {
  turnId: string;
  executorId?: string;
  keyPreview: string;
  stage: ConsoleTurnStage;
  at: number;
  providerIds: string[];
  requestIds: string[];
  cloudRequestWasStarted: boolean;
  status: ConsoleTurnStatus;
  lastError?: string;
}

export interface ConsoleBlockedSubmitTrace {
  reason: string;
  valuePreview: string;
  at: number;
  activeTurnId?: string;
  activeTurnStage?: ConsoleTurnStage;
}

export type ConsoleSubmitStartResult =
  | {
      status: "accepted";
      turn: ConsoleTurnController;
      cancelledStaleTurn?: ConsoleTurnController;
    }
  | {
      status: "blocked";
      reason: "pending_turn" | "duplicate_submit";
      activeTurn: ConsoleTurnController | null;
    };

export class ChatTurnEngine {
  private sequence = 0;
  private active: ConsoleTurnController | null = null;
  private lastSubmitTrace: { key: string; at: number } | null = null;

  constructor(
    private readonly options: {
      dedupeMs: number;
      staleMs: number;
    },
  ) {}

  get activeTurn(): ConsoleTurnController | null {
    return this.active;
  }

  get lastSubmit(): { key: string; at: number } | null {
    return this.lastSubmitTrace;
  }

  hasPendingTurn(nowMs = Date.now()): boolean {
    return Boolean(this.active?.status === "pending" && !this.isStale(this.active, nowMs));
  }

  isDuplicateSubmit(key: string, nowMs = Date.now()): boolean {
    return Boolean(
      this.active?.key === key ||
        (this.lastSubmitTrace?.key === key && nowMs - this.lastSubmitTrace.at < this.options.dedupeMs),
    );
  }

  isStale(turn: ConsoleTurnController | null | undefined, nowMs = Date.now()): boolean {
    return Boolean(turn?.status === "pending" && nowMs - turn.startedAt > this.options.staleMs);
  }

  begin(key: string, nowMs = Date.now()): ConsoleTurnController {
    const turn: ConsoleTurnController = {
      id: `console-turn-${nowMs}-${++this.sequence}`,
      key,
      status: "pending",
      startedAt: nowMs,
      requestIds: [],
      consoleCloudRequestStarted: false,
      visibleTerminalCommitted: false,
      stage: "received",
      lastStageAt: nowMs,
      providerIds: [],
    };
    this.active = turn;
    this.lastSubmitTrace = { key, at: nowMs };
    return turn;
  }

  startSubmit(key: string, nowMs = Date.now()): ConsoleSubmitStartResult {
    let cancelledStaleTurn: ConsoleTurnController | undefined;
    if (this.active?.status === "pending") {
      if (!this.isStale(this.active, nowMs)) {
        return {
          status: "blocked",
          reason: "pending_turn",
          activeTurn: this.active,
        };
      }
      cancelledStaleTurn = this.active;
      cancelledStaleTurn.status = "cancelled";
      this.updateStage(cancelledStaleTurn, "cancelled", "stale_timeout", nowMs);
      this.active = null;
    }

    if (this.isDuplicateSubmit(key, nowMs)) {
      return {
        status: "blocked",
        reason: "duplicate_submit",
        activeTurn: this.active,
      };
    }

    return {
      status: "accepted",
      turn: this.begin(key, nowMs),
      cancelledStaleTurn,
    };
  }

  markLastSubmit(key: string, at = Date.now()) {
    this.lastSubmitTrace = { key, at };
  }

  updateStage(turn: ConsoleTurnController, stage: ConsoleTurnStage, error?: string, at = Date.now()) {
    turn.stage = stage;
    turn.lastStageAt = at;
    if (error) {
      turn.lastError = error;
    }
  }

  selectProviders(turn: ConsoleTurnController, providerIds: string[], at = Date.now()) {
    turn.providerIds = [...providerIds];
    this.updateStage(turn, "provider_selected", undefined, at);
  }

  commitResult(turn: ConsoleTurnController, at = Date.now()) {
    turn.visibleTerminalCommitted = true;
    turn.status = "completed";
    this.updateStage(turn, "result_committed", undefined, at);
  }

  commitError(turn: ConsoleTurnController, error: string, at = Date.now()) {
    turn.visibleTerminalCommitted = true;
    turn.status = "failed";
    this.updateStage(turn, "error_committed", error, at);
  }

  markCancelled(turn: ConsoleTurnController, reason: string, at = Date.now()) {
    turn.status = "cancelled";
    this.updateStage(turn, "cancelled", reason, at);
  }

  isCurrent(turn: ConsoleTurnController | null | undefined): boolean {
    return Boolean(turn && this.active?.id === turn.id);
  }

  cancelActive(reason: string): ConsoleTurnController | null {
    if (!this.active || this.active.status !== "pending") {
      return null;
    }
    const turn = this.active;
    turn.status = "cancelled";
    this.updateStage(turn, "cancelled", reason);
    this.active = null;
    return turn;
  }

  clearIfCurrent(turn: ConsoleTurnController | null | undefined) {
    if (this.isCurrent(turn)) {
      this.active = null;
    }
  }

  createAcceptedTrace(turn: ConsoleTurnController, valuePreview: string): ConsoleAcceptedTurnTrace {
    return {
      turnId: turn.id,
      executorId: turn.executorId,
      keyPreview: valuePreview,
      stage: turn.stage,
      at: Date.now(),
      providerIds: [...turn.providerIds],
      requestIds: [...turn.requestIds],
      cloudRequestWasStarted: turn.consoleCloudRequestStarted,
      status: turn.status,
      lastError: turn.lastError,
    };
  }

  updateAcceptedTrace(
    trace: ConsoleAcceptedTurnTrace | null,
    turn: ConsoleTurnController,
  ): ConsoleAcceptedTurnTrace | null {
    if (!trace || trace.turnId !== turn.id) {
      return trace;
    }
    return {
      ...trace,
      executorId: turn.executorId,
      stage: turn.stage,
      providerIds: [...turn.providerIds],
      requestIds: [...turn.requestIds],
      cloudRequestWasStarted: turn.consoleCloudRequestStarted,
      status: turn.status,
      lastError: turn.lastError,
    };
  }
}
