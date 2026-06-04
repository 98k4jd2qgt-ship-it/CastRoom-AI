import {
  AiTurnRuntime,
  type AiTurnRuntimeBeginResult,
  type AiTurnRuntimeOutcome,
  type AiTurnRuntimeSubmitResult,
  type AiTurnRuntimeTurn,
} from "./aiTurnRuntime";
import type { RoomPendingFollowup, SituationAssessmentSummary } from "./types";

type RoomRuntimeCommitTarget = "direct_room" | "room_timeline" | "room_inspector";

interface RoomRuntimeCommitResult {
  ok: boolean;
  target: RoomRuntimeCommitTarget;
  messageId?: string;
  visible: boolean;
  reason?: string;
  error?: unknown;
}

interface RoomRuntimeCommitApplyResult {
  messageId?: string;
  visible?: boolean;
  reason?: string;
}

interface RoomRuntimeCommitter {
  commit(input: {
    target: RoomRuntimeCommitTarget;
    messageId?: string;
    visible?: boolean;
    reason?: string;
    apply?: () => RoomRuntimeCommitApplyResult | void;
    onCommitFailure?: (reason: string, error?: unknown) => RoomRuntimeCommitApplyResult | void;
  }): RoomRuntimeCommitResult;
}

export interface RoomRuntimeDeps {
  aiTurnRuntime: AiTurnRuntime;
  providerResolver?: unknown;
  messageCommitter?: RoomRuntimeCommitter;
  memoryAdapter?: unknown;
  roomInputHandler?: (input: RoomRuntimeRoomInput<unknown>) => Promise<unknown>;
  scheduleResultHandler?: (input: RoomRuntimeScheduleResultInput<unknown>) => Promise<unknown>;
  speakerTurnHandler?: (input: RoomRuntimeSpeakerExecuteRequest<unknown>, turn: AiTurnRuntimeTurn) => Promise<unknown>;
  directorTurnHandler?: (input: RoomRuntimeDirectorExecuteRequest<unknown>, turn: AiTurnRuntimeTurn) => Promise<unknown>;
  diagnostics?: (diagnostic: RoomRuntimeDiagnostic) => void;
  clock?: () => Date;
  desktopContext?: () => unknown;
  renderGate?: unknown;
}

interface RoomRuntimeSubmitBase<T> {
  turnId?: string;
  providerIds?: string[];
  execute?: (turn: AiTurnRuntimeTurn) => Promise<T>;
  outcome?: (result: T, turn: AiTurnRuntimeTurn) => AiTurnRuntimeOutcome;
  visibleTerminalCommitted?: (result: T, turn: AiTurnRuntimeTurn) => boolean;
  onFailure?: (error: unknown, turn: AiTurnRuntimeTurn) => void;
  failureVisibleTerminalCommitted?: (error: unknown, turn: AiTurnRuntimeTurn) => boolean;
  failureBlockReason?: (error: unknown, turn: AiTurnRuntimeTurn) => string | undefined;
}

export type RoomRuntimeSource = "user" | "auto" | "director" | "scheduler";
export type RoomRuntimeRenderKind = "message" | "status" | "structural" | "none";
export type RoomRuntimeFocusTarget = "room" | "console" | "none";
export type RoomRuntimeTimerAction =
  | "sync"
  | "clear"
  | "schedule"
  | "schedule_once"
  | "schedule_continuous"
  | "clear_wait_user"
  | "none";

export interface RoomRuntimeDiagnostic {
  level: "info" | "warn" | "error";
  event: string;
  detail?: unknown;
}

export interface RoomRuntimeEffect {
  renderKind?: RoomRuntimeRenderKind;
  renderReason?: string;
  timelineMessages?: unknown[];
  inspectorPatch?: RoomRuntimeInspectorPatch;
  focusTarget?: RoomRuntimeFocusTarget;
  nextTimerAction?: RoomRuntimeTimerAction;
  pendingFollowup?: RoomPendingFollowup | null;
  diagnostics?: RoomRuntimeDiagnostic[];
}

export interface RoomRuntimeResultEffectFields {
  timelineMessages?: unknown[];
  inspectorPatch?: RoomRuntimeInspectorPatch;
  renderKind: RoomRuntimeRenderKind;
  focusTarget?: RoomRuntimeFocusTarget;
  nextTimerAction?: RoomRuntimeTimerAction;
  pendingFollowup?: RoomPendingFollowup | null;
  diagnostics?: RoomRuntimeDiagnostic[];
}

export interface RoomRuntimeInspectorPatch {
  currentFocus?: string;
  stopReason?: string;
  privateDirectiveSummary?: string;
  nextSpeaker?: string | null;
  currentProvider?: string | null;
  lastTurnOutcome?: string | null;
  situationAssessment?: SituationAssessmentSummary;
}

export type RoomRuntimeResult<T = void> =
  | ({
      ok: true;
      roomId: string;
      source: RoomRuntimeSource;
      result: T;
      effect: RoomRuntimeEffect;
    } & RoomRuntimeResultEffectFields)
  | ({
      ok: false;
      roomId: string;
      source: RoomRuntimeSource;
      reason: "active_room_runtime" | "failed";
      activeOperationId?: string;
      effect: RoomRuntimeEffect;
      error?: unknown;
    } & RoomRuntimeResultEffectFields);

export interface RoomRuntimeSubmitInput<T> {
  roomId: string;
  source: RoomRuntimeSource;
  operationId?: string;
  execute?: () => Promise<T>;
  effect?: RoomRuntimeEffect | ((result: T) => RoomRuntimeEffect);
  onFailure?: (error: unknown) => RoomRuntimeEffect | void;
}

export interface RoomRuntimeRoomInput<T> extends RoomRuntimeSubmitInput<T> {
  inputPreview?: string;
  inputText?: string;
}

export interface RoomRuntimeScheduleResultInput<T> extends RoomRuntimeSubmitInput<T> {
  scheduleType?: string;
  scheduleResult?: unknown;
  userInput?: string;
}

export interface RoomRuntimeSpeakerSubmitRequest<T> extends RoomRuntimeSubmitBase<T> {
  roomId: string;
  roleId: string;
}

export interface RoomRuntimeDirectorSubmitRequest<T> extends RoomRuntimeSubmitBase<T> {
  roomId: string;
  turnId: string;
}

export interface RoomRuntimeSpeakerExecuteRequest<T> extends RoomRuntimeSpeakerSubmitRequest<T> {
  source?: RoomRuntimeSource;
  scheduleResult?: unknown;
  userInput?: string;
  roomScope?: string;
  runtimeState?: {
    outcome?: AiTurnRuntimeOutcome;
    visibleTerminalCommitted?: boolean;
  };
  effect?: RoomRuntimeEffect | ((result: AiTurnRuntimeSubmitResult<T>) => RoomRuntimeEffect);
  onBlocked?: (result: Extract<AiTurnRuntimeSubmitResult<T>, { ok: false }>) => RoomRuntimeEffect | void;
  onRuntimeFailure?: (error: unknown) => RoomRuntimeEffect | void;
}

export interface RoomRuntimeDirectorExecuteRequest<T> extends RoomRuntimeDirectorSubmitRequest<T> {
  source?: RoomRuntimeSource;
  directorRequest?: unknown;
  effect?: RoomRuntimeEffect | ((result: AiTurnRuntimeSubmitResult<T>) => RoomRuntimeEffect);
  onBlocked?: (result: Extract<AiTurnRuntimeSubmitResult<T>, { ok: false }>) => RoomRuntimeEffect | void;
  onRuntimeFailure?: (error: unknown) => RoomRuntimeEffect | void;
}

export interface RoomRuntimeTimelineCommitInput {
  messageId?: string;
  reason: string;
  apply: () => RoomRuntimeCommitApplyResult | void;
  onCommitFailure?: (reason: string, error?: unknown) => RoomRuntimeCommitApplyResult | void;
}

export interface RoomRuntimeInspectorCommitInput {
  reason: string;
  patch?: RoomRuntimeInspectorPatch;
  apply: () => RoomRuntimeCommitApplyResult | void;
  onCommitFailure?: (reason: string, error?: unknown) => RoomRuntimeCommitApplyResult | void;
}

export function roomSpeakerRuntimeScope(roomId: string, roleId: string): string {
  return `room:${roomId}:speaker:${roleId}`;
}

export function roomDirectorRuntimeScope(roomId: string): string {
  return `room:${roomId}:director`;
}

export class RoomRuntime {
  private readonly activeRoomOperations = new Map<string, { id: string; source: RoomRuntimeSource }>();
  private sequence = 0;
  private readonly aiTurnRuntime: AiTurnRuntime;
  private readonly messageCommitter?: RoomRuntimeCommitter;
  private readonly deps: RoomRuntimeDeps;

  constructor(deps: RoomRuntimeDeps);
  constructor(aiTurnRuntime: AiTurnRuntime, messageCommitter?: RoomRuntimeCommitter);
  constructor(depsOrAiTurnRuntime: RoomRuntimeDeps | AiTurnRuntime, messageCommitter?: RoomRuntimeCommitter) {
    if (depsOrAiTurnRuntime instanceof AiTurnRuntime) {
      this.aiTurnRuntime = depsOrAiTurnRuntime;
      this.messageCommitter = messageCommitter;
      this.deps = {
        aiTurnRuntime: depsOrAiTurnRuntime,
        messageCommitter,
      };
      return;
    }
    this.aiTurnRuntime = depsOrAiTurnRuntime.aiTurnRuntime;
    this.messageCommitter = depsOrAiTurnRuntime.messageCommitter;
    this.deps = depsOrAiTurnRuntime;
  }

  submit<T>(input: RoomRuntimeSubmitInput<T>): Promise<RoomRuntimeResult<T>> {
    return this.submitRoomInput(input);
  }

  submitRoomInput<T>(input: RoomRuntimeRoomInput<T>): Promise<RoomRuntimeResult<T>> {
    this.deps.diagnostics?.({
      level: "info",
      event: "RoomRuntime.input",
      detail: {
        roomId: input.roomId,
        source: input.source,
        operationId: input.operationId,
        inputPreview: input.inputPreview,
      },
    });
    return this.runRoomOperation("input", {
      ...input,
      execute: input.execute ?? (() => this.callRoomInputHandler(input)),
    });
  }

  applySchedule<T>(input: RoomRuntimeSubmitInput<T>): Promise<RoomRuntimeResult<T>> {
    return this.runRoomOperation("schedule", input);
  }

  applyScheduleResult<T>(input: RoomRuntimeScheduleResultInput<T>): Promise<RoomRuntimeResult<T>> {
    this.deps.diagnostics?.({
      level: "info",
      event: "RoomRuntime.schedule",
      detail: {
        roomId: input.roomId,
        source: input.source,
        operationId: input.operationId,
        scheduleType: input.scheduleType,
      },
    });
    return this.runRoomOperation("schedule", {
      ...input,
      execute: input.execute ?? (() => this.callScheduleResultHandler(input)),
    });
  }

  submitSpeaker<T>(input: RoomRuntimeSpeakerSubmitRequest<T>): Promise<AiTurnRuntimeSubmitResult<T>> {
    return this.aiTurnRuntime.submit({
      scope: roomSpeakerRuntimeScope(input.roomId, input.roleId),
      purpose: "room_speaker",
      area: "room",
      turnId: input.turnId,
      providerIds: input.providerIds,
      execute: input.execute ?? ((turn) => this.callSpeakerTurnHandler(input, turn)),
      outcome: input.outcome,
      visibleTerminalCommitted: input.visibleTerminalCommitted,
      onFailure: input.onFailure,
      failureVisibleTerminalCommitted: input.failureVisibleTerminalCommitted,
      failureBlockReason: input.failureBlockReason,
    });
  }

  async executeSpeakerTurn<T>(
    input: RoomRuntimeSpeakerExecuteRequest<T>,
  ): Promise<RoomRuntimeResult<AiTurnRuntimeSubmitResult<T>>> {
    try {
      const result = await this.submitSpeaker(input);
      if (!result.ok) {
        const effect = this.normalizeEffect(
          input.onBlocked?.(result),
          this.activeTurnEffect(input.roomId, input.source ?? "scheduler", result.activeTurn.id),
        );
        return {
          ok: false,
          roomId: input.roomId,
          source: input.source ?? "scheduler",
          reason: "active_room_runtime",
          activeOperationId: result.activeTurn.id,
          effect,
          ...this.resultEffectFields(effect),
        };
      }
      const effect = typeof input.effect === "function" ? input.effect(result) : input.effect ?? {};
      return {
        ok: true,
        roomId: input.roomId,
        source: input.source ?? "scheduler",
        result,
        effect,
        ...this.resultEffectFields(effect),
      };
    } catch (error) {
      const effect = this.normalizeEffect(
        input.onRuntimeFailure?.(error),
        this.failedTurnEffect(input.roomId, input.source ?? "scheduler", error),
      );
      return {
        ok: false,
        roomId: input.roomId,
        source: input.source ?? "scheduler",
        reason: "failed",
        error,
        effect,
        ...this.resultEffectFields(effect),
      };
    }
  }

  submitDirector<T>(input: RoomRuntimeDirectorSubmitRequest<T>): Promise<AiTurnRuntimeSubmitResult<T>> {
    return this.aiTurnRuntime.submit({
      scope: roomDirectorRuntimeScope(input.roomId),
      purpose: "room_director",
      area: "director",
      turnId: input.turnId,
      providerIds: input.providerIds,
      execute: input.execute ?? ((turn) => this.callDirectorTurnHandler(input, turn)),
      outcome: input.outcome,
      visibleTerminalCommitted: input.visibleTerminalCommitted,
      onFailure: input.onFailure,
      failureVisibleTerminalCommitted: input.failureVisibleTerminalCommitted,
      failureBlockReason: input.failureBlockReason,
    });
  }

  async executeDirectorTurn<T>(
    input: RoomRuntimeDirectorExecuteRequest<T>,
  ): Promise<RoomRuntimeResult<AiTurnRuntimeSubmitResult<T>>> {
    try {
      const result = await this.submitDirector(input);
      if (!result.ok) {
        const effect = this.normalizeEffect(
          input.onBlocked?.(result),
          this.activeTurnEffect(input.roomId, input.source ?? "director", result.activeTurn.id),
        );
        return {
          ok: false,
          roomId: input.roomId,
          source: input.source ?? "director",
          reason: "active_room_runtime",
          activeOperationId: result.activeTurn.id,
          effect,
          ...this.resultEffectFields(effect),
        };
      }
      const effect = typeof input.effect === "function" ? input.effect(result) : input.effect ?? {};
      return {
        ok: true,
        roomId: input.roomId,
        source: input.source ?? "director",
        result,
        effect,
        ...this.resultEffectFields(effect),
      };
    } catch (error) {
      const effect = this.normalizeEffect(
        input.onRuntimeFailure?.(error),
        this.failedTurnEffect(input.roomId, input.source ?? "director", error),
      );
      return {
        ok: false,
        roomId: input.roomId,
        source: input.source ?? "director",
        reason: "failed",
        error,
        effect,
        ...this.resultEffectFields(effect),
      };
    }
  }

  beginSpeaker(input: { roomId: string; roleId: string; turnId?: string }): AiTurnRuntimeBeginResult {
    return this.aiTurnRuntime.begin({
      scope: roomSpeakerRuntimeScope(input.roomId, input.roleId),
      purpose: "room_speaker",
      area: "room",
      turnId: input.turnId,
    });
  }

  beginDirector(input: { roomId: string; turnId: string }): AiTurnRuntimeBeginResult {
    return this.aiTurnRuntime.begin({
      scope: roomDirectorRuntimeScope(input.roomId),
      purpose: "room_director",
      area: "director",
      turnId: input.turnId,
    });
  }

  getActiveDirector(roomId: string): AiTurnRuntimeTurn | null {
    return this.aiTurnRuntime.getActive(roomDirectorRuntimeScope(roomId));
  }

  commitTimelineMessage(input: RoomRuntimeTimelineCommitInput): RoomRuntimeCommitResult {
    if (!this.messageCommitter) {
      return {
        ok: false,
        target: "room_timeline",
        messageId: input.messageId,
        visible: true,
        reason: "room_runtime_missing_message_committer",
      };
    }
    return this.messageCommitter.commit({
      target: "room_timeline",
      messageId: input.messageId,
      reason: input.reason,
      apply: input.apply,
      onCommitFailure: input.onCommitFailure,
    });
  }

  commitInspectorPatch(input: RoomRuntimeInspectorCommitInput): RoomRuntimeCommitResult {
    if (!this.messageCommitter) {
      return {
        ok: false,
        target: "room_inspector",
        visible: true,
        reason: "room_runtime_missing_message_committer",
      };
    }
    return this.messageCommitter.commit({
      target: "room_inspector",
      visible: true,
      reason: input.reason,
      apply: input.apply,
      onCommitFailure: input.onCommitFailure,
    });
  }

  private async runRoomOperation<T>(
    kind: "input" | "schedule",
    input: RoomRuntimeSubmitInput<T>,
  ): Promise<RoomRuntimeResult<T>> {
    const scope = `room:${input.roomId}:${kind}`;
    const active = this.activeRoomOperations.get(scope);
    if (active) {
      this.deps.diagnostics?.({
        level: "warn",
        event: "RoomRuntime.blocked",
        detail: { roomId: input.roomId, source: input.source, activeOperationId: active.id },
      });
      const effect: RoomRuntimeEffect = {
        renderKind: "status",
        renderReason: "room_runtime_blocked",
        diagnostics: [
          {
            level: "warn",
            event: "RoomRuntime.blocked",
            detail: { roomId: input.roomId, source: input.source, activeOperationId: active.id },
          },
        ],
      };
      return {
        ok: false,
        roomId: input.roomId,
        source: input.source,
        reason: "active_room_runtime",
        activeOperationId: active.id,
        effect,
        ...this.resultEffectFields(effect),
      };
    }

    const operationId = input.operationId ?? `${kind}-${Date.now()}-${++this.sequence}`;
    this.activeRoomOperations.set(scope, { id: operationId, source: input.source });
    try {
      if (!input.execute) {
        throw new Error(`RoomRuntime ${kind} handler is not configured.`);
      }
      const result = await input.execute();
      const effect = typeof input.effect === "function" ? input.effect(result) : input.effect ?? {};
      return {
        ok: true,
        roomId: input.roomId,
        source: input.source,
        result,
        effect,
        ...this.resultEffectFields(effect),
      };
    } catch (error) {
      this.deps.diagnostics?.({
        level: "error",
        event: "RoomRuntime.failed",
        detail: { roomId: input.roomId, source: input.source, error },
      });
      const effect = this.normalizeEffect(input.onFailure?.(error), {
        renderKind: "status",
        renderReason: "room_runtime_failed",
        diagnostics: [
          {
            level: "error",
            event: "RoomRuntime.failed",
            detail: { roomId: input.roomId, source: input.source, error },
          },
        ],
      });
      return {
        ok: false,
        roomId: input.roomId,
        source: input.source,
        reason: "failed",
        error,
        effect,
        ...this.resultEffectFields(effect),
      };
    } finally {
      const latest = this.activeRoomOperations.get(scope);
      if (latest?.id === operationId) {
        this.activeRoomOperations.delete(scope);
      }
    }
  }

  private callRoomInputHandler<T>(input: RoomRuntimeRoomInput<T>): Promise<T> {
    if (!this.deps.roomInputHandler) {
      throw new Error("RoomRuntime roomInputHandler is not configured.");
    }
    return this.deps.roomInputHandler(input as RoomRuntimeRoomInput<unknown>) as Promise<T>;
  }

  private callScheduleResultHandler<T>(input: RoomRuntimeScheduleResultInput<T>): Promise<T> {
    if (!this.deps.scheduleResultHandler) {
      throw new Error("RoomRuntime scheduleResultHandler is not configured.");
    }
    return this.deps.scheduleResultHandler(input as RoomRuntimeScheduleResultInput<unknown>) as Promise<T>;
  }

  private callSpeakerTurnHandler<T>(input: RoomRuntimeSpeakerExecuteRequest<T>, turn: AiTurnRuntimeTurn): Promise<T> {
    if (!this.deps.speakerTurnHandler) {
      throw new Error("RoomRuntime speakerTurnHandler is not configured.");
    }
    return this.deps.speakerTurnHandler(input as RoomRuntimeSpeakerExecuteRequest<unknown>, turn) as Promise<T>;
  }

  private callDirectorTurnHandler<T>(input: RoomRuntimeDirectorExecuteRequest<T>, turn: AiTurnRuntimeTurn): Promise<T> {
    if (!this.deps.directorTurnHandler) {
      throw new Error("RoomRuntime directorTurnHandler is not configured.");
    }
    return this.deps.directorTurnHandler(input as RoomRuntimeDirectorExecuteRequest<unknown>, turn) as Promise<T>;
  }

  private activeTurnEffect(roomId: string, source: RoomRuntimeSource, activeOperationId: string): RoomRuntimeEffect {
    return {
      renderKind: "status",
      renderReason: "room_runtime_turn_blocked",
      diagnostics: [
        {
          level: "warn",
          event: "RoomRuntime.turnBlocked",
          detail: { roomId, source, activeOperationId },
        },
      ],
    };
  }

  private failedTurnEffect(roomId: string, source: RoomRuntimeSource, error: unknown): RoomRuntimeEffect {
    return {
      renderKind: "status",
      renderReason: "room_runtime_turn_failed",
      diagnostics: [
        {
          level: "error",
          event: "RoomRuntime.turnFailed",
          detail: { roomId, source, error },
        },
      ],
    };
  }

  private normalizeEffect(effect: RoomRuntimeEffect | void | undefined, fallback: RoomRuntimeEffect = {}): RoomRuntimeEffect {
    return effect ?? fallback;
  }

  private resultEffectFields(effect: RoomRuntimeEffect): RoomRuntimeResultEffectFields {
    return {
      timelineMessages: effect.timelineMessages,
      inspectorPatch: effect.inspectorPatch,
      renderKind: effect.renderKind ?? "none",
      focusTarget: effect.focusTarget,
      nextTimerAction: effect.nextTimerAction,
      pendingFollowup: effect.pendingFollowup,
      diagnostics: effect.diagnostics,
    };
  }
}
