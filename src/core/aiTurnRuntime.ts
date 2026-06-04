import type { AiRequestPurpose } from "./aiRequestAudit";

export type AiTurnRuntimeScope = "console" | "room" | "director" | "config";
export type AiTurnRuntimeOutcome = "success" | "failure" | "cancelled" | "stale";

export interface AiTurnRuntimeTurn {
  id: string;
  scope: string;
  purpose: AiRequestPurpose;
  area: AiTurnRuntimeScope;
  startedAt: number;
  providerIds: string[];
  requestIds: string[];
  chatRequestStarted: boolean;
  visionRequestStarted: boolean;
  visibleTerminalCommitted: boolean;
  outcome?: AiTurnRuntimeOutcome;
  blockReason?: string;
}

export type AiTurnRuntimeBeginResult =
  | { ok: true; turn: AiTurnRuntimeTurn }
  | { ok: false; reason: "active_turn"; activeTurn: AiTurnRuntimeTurn };

export interface AiTurnRuntimeSubmitRequest<T> {
  scope: string;
  purpose: AiRequestPurpose;
  area: AiTurnRuntimeScope;
  turnId?: string;
  providerIds?: string[];
  execute: (turn: AiTurnRuntimeTurn) => Promise<T>;
  outcome?: (result: T, turn: AiTurnRuntimeTurn) => AiTurnRuntimeOutcome;
  visibleTerminalCommitted?: (result: T, turn: AiTurnRuntimeTurn) => boolean;
  onFailure?: (error: unknown, turn: AiTurnRuntimeTurn) => void;
  failureVisibleTerminalCommitted?: (error: unknown, turn: AiTurnRuntimeTurn) => boolean;
  failureBlockReason?: (error: unknown, turn: AiTurnRuntimeTurn) => string | undefined;
  nowMs?: number;
}

export type AiTurnRuntimeSubmitResult<T> =
  | { ok: true; turn: AiTurnRuntimeTurn; result: T }
  | { ok: false; reason: "active_turn"; activeTurn: AiTurnRuntimeTurn };

export class AiTurnRuntime {
  private sequence = 0;
  private readonly activeByScope = new Map<string, AiTurnRuntimeTurn>();
  private readonly completedTurns: AiTurnRuntimeTurn[] = [];

  begin(input: {
    scope: string;
    purpose: AiRequestPurpose;
    area: AiTurnRuntimeScope;
    providerIds?: string[];
    turnId?: string;
    nowMs?: number;
  }): AiTurnRuntimeBeginResult {
    const activeTurn = this.activeByScope.get(input.scope);
    if (activeTurn) {
      return {
        ok: false,
        reason: "active_turn",
        activeTurn,
      };
    }

    const startedAt = input.nowMs ?? Date.now();
    const turn: AiTurnRuntimeTurn = {
      id: input.turnId ?? `${input.area}-turn-${startedAt}-${++this.sequence}`,
      scope: input.scope,
      purpose: input.purpose,
      area: input.area,
      startedAt,
      providerIds: [...(input.providerIds ?? [])],
      requestIds: [],
      chatRequestStarted: false,
      visionRequestStarted: false,
      visibleTerminalCommitted: false,
    };
    this.activeByScope.set(input.scope, turn);
    return { ok: true, turn };
  }

  async submit<T>(request: AiTurnRuntimeSubmitRequest<T>): Promise<AiTurnRuntimeSubmitResult<T>> {
    const begin = this.begin({
      scope: request.scope,
      purpose: request.purpose,
      area: request.area,
      turnId: request.turnId,
      providerIds: request.providerIds,
      nowMs: request.nowMs,
    });
    if (!begin.ok) {
      return begin;
    }

    try {
      const result = await request.execute(begin.turn);
      this.finish(begin.turn, {
        outcome: request.outcome?.(result, begin.turn) ?? "success",
        visibleTerminalCommitted: request.visibleTerminalCommitted?.(result, begin.turn) ?? true,
      });
      return { ok: true, turn: begin.turn, result };
    } catch (error) {
      request.onFailure?.(error, begin.turn);
      this.finish(begin.turn, {
        outcome: "failure",
        visibleTerminalCommitted: request.failureVisibleTerminalCommitted?.(error, begin.turn) ?? false,
        blockReason: request.failureBlockReason?.(error, begin.turn),
      });
      throw error;
    }
  }

  markProviders(turn: AiTurnRuntimeTurn, providerIds: string[]) {
    if (!this.isActive(turn)) {
      return;
    }
    turn.providerIds = [...providerIds];
  }

  beginRequest(
    turn: AiTurnRuntimeTurn,
    input: { purpose: AiRequestPurpose; requestId: string },
  ): { ok: true } | { ok: false; reason: "duplicate_chat_request" | "inactive_turn" } {
    if (!this.isActive(turn)) {
      return { ok: false, reason: "inactive_turn" };
    }
    if (input.purpose === "console_chat" || input.purpose === "room_speaker" || input.purpose === "room_director") {
      if (turn.chatRequestStarted) {
        return { ok: false, reason: "duplicate_chat_request" };
      }
      turn.chatRequestStarted = true;
    }
    if (input.purpose === "vision_caption") {
      if (turn.visionRequestStarted) {
        return { ok: false, reason: "duplicate_chat_request" };
      }
      turn.visionRequestStarted = true;
    }
    turn.requestIds.push(input.requestId);
    return { ok: true };
  }

  finish(
    turn: AiTurnRuntimeTurn,
    input: { outcome: AiTurnRuntimeOutcome; visibleTerminalCommitted: boolean; blockReason?: string },
  ) {
    const active = this.activeByScope.get(turn.scope);
    if (active?.id !== turn.id) {
      return;
    }
    turn.outcome = input.outcome;
    turn.visibleTerminalCommitted = input.visibleTerminalCommitted;
    turn.blockReason = input.blockReason;
    this.activeByScope.delete(turn.scope);
    this.completedTurns.push({ ...turn, providerIds: [...turn.providerIds], requestIds: [...turn.requestIds] });
    this.completedTurns.splice(0, Math.max(0, this.completedTurns.length - 50));
  }

  cancelScope(scope: string, reason: string): AiTurnRuntimeTurn | null {
    const turn = this.activeByScope.get(scope);
    if (!turn) {
      return null;
    }
    this.finish(turn, {
      outcome: "cancelled",
      visibleTerminalCommitted: false,
      blockReason: reason,
    });
    return turn;
  }

  getActive(scope: string): AiTurnRuntimeTurn | null {
    return this.activeByScope.get(scope) ?? null;
  }

  snapshot() {
    return {
      active: Array.from(this.activeByScope.values()).map((turn) => ({ ...turn })),
      completed: this.completedTurns.map((turn) => ({ ...turn })),
    };
  }

  private isActive(turn: AiTurnRuntimeTurn): boolean {
    return this.activeByScope.get(turn.scope)?.id === turn.id;
  }
}
