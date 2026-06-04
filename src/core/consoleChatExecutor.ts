import {
  ChatTurnEngine,
  type ConsoleSubmitStartResult,
  type ConsoleTurnController,
} from "./chatTurnEngine";

export interface ConsoleQueuedTurn {
  executorId: string;
  turn: ConsoleTurnController;
  turnKey: string;
  valuePreview: string;
  acceptedAt: number;
  hasImage: boolean;
}

export type ConsoleExecutorSubmitResult =
  | {
      status: "accepted";
      queuedTurn: ConsoleQueuedTurn;
      cancelledStaleTurn?: ConsoleTurnController;
    }
  | {
      status: "blocked";
      reason: "pending_turn" | "duplicate_submit";
      activeTurn: ConsoleTurnController | null;
    };

export class ConsoleChatExecutor {
  private sequence = 0;
  private active: ConsoleQueuedTurn | null = null;
  private lastFinished:
    | {
        turnKey: string;
        finishedAt: number;
      }
    | null = null;

  constructor(
    private readonly turnEngine: ChatTurnEngine,
    private readonly options: { completedDedupeMs: number } = { completedDedupeMs: 5_000 },
  ) {}

  get activeQueuedTurn(): ConsoleQueuedTurn | null {
    return this.active;
  }

  hasActiveTurn(nowMs = Date.now()): boolean {
    return Boolean(
      this.active?.turn.status === "pending" &&
        this.turnEngine.isCurrent(this.active.turn) &&
        !this.turnEngine.isStale(this.active.turn, nowMs),
    );
  }

  submit(input: {
    turnKey: string;
    valuePreview: string;
    hasImage: boolean;
    nowMs?: number;
  }): ConsoleExecutorSubmitResult {
    const nowMs = input.nowMs ?? Date.now();
    if (this.hasActiveTurn(nowMs)) {
      return {
        status: "blocked",
        reason: "pending_turn",
        activeTurn: this.active?.turn ?? this.turnEngine.activeTurn,
      };
    }
    if (
      this.lastFinished?.turnKey === input.turnKey &&
      nowMs - this.lastFinished.finishedAt < this.options.completedDedupeMs
    ) {
      return {
        status: "blocked",
        reason: "duplicate_submit",
        activeTurn: this.turnEngine.activeTurn,
      };
    }

    const startResult: ConsoleSubmitStartResult = this.turnEngine.startSubmit(input.turnKey, nowMs);
    if (startResult.status === "blocked") {
      return startResult;
    }

    const executorId = `console-exec-${nowMs}-${++this.sequence}`;
    startResult.turn.executorId = executorId;
    const queuedTurn: ConsoleQueuedTurn = {
      executorId,
      turn: startResult.turn,
      turnKey: input.turnKey,
      valuePreview: input.valuePreview,
      acceptedAt: nowMs,
      hasImage: input.hasImage,
    };
    this.active = queuedTurn;

    return {
      status: "accepted",
      queuedTurn,
      cancelledStaleTurn: startResult.cancelledStaleTurn,
    };
  }

  clearIfCurrent(turn: ConsoleTurnController | null | undefined) {
    if (turn && this.active?.turn.id === turn.id) {
      this.lastFinished = {
        turnKey: this.active.turnKey,
        finishedAt: Date.now(),
      };
      this.active = null;
    }
  }
}
