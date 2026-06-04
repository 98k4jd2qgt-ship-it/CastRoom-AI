import type {
  LocalModelChatRequest,
  LocalModelChatResult,
  LocalModelRuntimeState,
} from "./types";

export type LocalAiAvailability =
  | "ready"
  | "disabled"
  | "checking"
  | "missing_runner"
  | "missing_model"
  | "timeout"
  | "error";

export type LocalAiReadinessReason = "console_chat" | "room_speaker" | "room_director" | "status";

export interface LocalAiAvailabilityResult {
  availability: LocalAiAvailability;
  ready: boolean;
  state: LocalModelRuntimeState;
  message: string | null;
  timedOut: boolean;
  checkedAt: string;
}

export interface LocalAiDiagnostics {
  enabled: boolean;
  selectedModelId: string | null;
  modelId: string | null;
  installState: LocalModelRuntimeState["installState"];
  state: LocalModelRuntimeState["state"];
  runnerReady: boolean;
  runtimeMode: LocalModelRuntimeState["runtimeMode"];
  serverPid: number | null;
  serverPort: number | null;
  serverHealth: string | null;
  lastError: string | null;
  checkedAt: string | null;
  availability: LocalAiAvailability;
}

type LocalModelStateCommand = "local_model_get_state" | "local_model_verify" | "local_model_warmup";

interface LocalAiRuntimeDeps {
  timeoutMs: number;
  getSnapshot: () => LocalModelRuntimeState;
  invokeState: (command: LocalModelStateCommand, args: Record<string, unknown>) => Promise<LocalModelRuntimeState>;
  invokeChat: (request: LocalModelChatRequest, signal?: AbortSignal) => Promise<LocalModelChatResult>;
  invokeCancel?: () => Promise<void>;
  onState?: (state: LocalModelRuntimeState) => void;
  onDiagnostic?: (level: "info" | "warn" | "error", label: string, detail: unknown) => void;
}

class LocalAiTimeoutError extends Error {
  constructor(command: LocalModelStateCommand, timeoutMs: number) {
    super(`${command} timed out after ${timeoutMs}ms.`);
    this.name = "LocalAiTimeoutError";
  }
}

export function isLocalAiReady(state: LocalModelRuntimeState): boolean {
  return (
    state.enabled &&
    state.installState === "installed" &&
    (state.state === "ready" || state.state === "stopped" || state.state === "warming" || state.state === "running" || state.state === "busy")
  );
}

export function classifyLocalAiAvailability(
  state: LocalModelRuntimeState,
  options: { timedOut?: boolean } = {},
): LocalAiAvailability {
  if (!state.enabled) {
    return "disabled";
  }
  if (options.timedOut) {
    return "timeout";
  }
  if (isLocalAiReady(state)) {
    return "ready";
  }
  if (state.state === "missing_runner") {
    return "missing_runner";
  }
  if (state.installState === "missing" || state.state === "not_found" || state.state === "missing_model") {
    return "missing_model";
  }
  if (state.installState === "error" || state.state === "error") {
    const error = (state.lastError ?? "").toLowerCase();
    return error.includes("runner") || error.includes("llama-cli") ? "missing_runner" : "error";
  }
  return "checking";
}

export function localAiAvailabilityMessage(availability: LocalAiAvailability, state: LocalModelRuntimeState): string | null {
  if (availability === "ready" || availability === "disabled") {
    return null;
  }
  if (availability === "missing_model") {
    return "Local chat model file is missing or has not been verified.";
  }
  if (availability === "missing_runner") {
    return "Local chat runner is missing or could not start.";
  }
  if (availability === "timeout") {
    return "Local chat readiness check timed out. The app will try another provider if one is available.";
  }
  if (availability === "checking") {
    if (state.state === "stopped") {
      return "Local model is not loaded. It will reload next time local AI is used.";
    }
    return "Local chat model is still checking readiness.";
  }
  return state.lastError || "Local chat model is not ready.";
}

export class LocalAiRuntime {
  private readonly deps: LocalAiRuntimeDeps;
  private lastCheckedAt: string | null = null;

  constructor(deps: LocalAiRuntimeDeps) {
    this.deps = deps;
  }

  diagnostics(): LocalAiDiagnostics {
    const state = this.deps.getSnapshot();
    const availability = classifyLocalAiAvailability(state);
    return {
      enabled: state.enabled,
      selectedModelId: state.selectedModelId,
      modelId: state.modelId,
      installState: state.installState,
      state: state.state,
      runnerReady: Boolean(state.runnerVersion),
      runtimeMode: state.runtimeMode ?? null,
      serverPid: state.serverPid ?? null,
      serverPort: state.serverPort ?? null,
      serverHealth: state.serverHealth ?? null,
      lastError: state.lastError,
      checkedAt: this.lastCheckedAt ?? state.lastVerifiedAt,
      availability,
    };
  }

  async resolveAvailability(reason: LocalAiReadinessReason = "status"): Promise<LocalAiAvailabilityResult> {
    let state = this.deps.getSnapshot();
    const checkedAt = new Date().toISOString();
    this.lastCheckedAt = checkedAt;

    if (!state.enabled) {
      return this.result(state, "disabled", false, null, false, checkedAt);
    }
    if (isLocalAiReady(state)) {
      return this.result(state, "ready", true, null, false, checkedAt);
    }

    try {
      state = await this.invokeStateWithTimeout("local_model_get_state", {
        selectedModelId: state.selectedModelId,
        enabled: true,
      });
      this.deps.onState?.(state);

      if (isLocalAiReady(state)) {
        return this.result(state, "ready", true, null, false, checkedAt);
      }

      const availability = classifyLocalAiAvailability(state);
      if (availability === "missing_model" || availability === "checking") {
        state = await this.invokeStateWithTimeout("local_model_verify", {
          selectedModelId: state.selectedModelId,
        });
        this.deps.onState?.(state);
      }
    } catch (error) {
      const timedOut = error instanceof LocalAiTimeoutError;
      const latest = this.deps.getSnapshot();
      const availability = classifyLocalAiAvailability(latest, { timedOut });
      const message = timedOut
        ? localAiAvailabilityMessage("timeout", latest)
        : error instanceof Error
          ? error.message
          : String(error);
      this.deps.onDiagnostic?.("warn", `localAi.readiness.${reason}`, message);
      return this.result(latest, availability, false, message, timedOut, checkedAt);
    }

    state = this.deps.getSnapshot();
    const availability = classifyLocalAiAvailability(state);
    return this.result(state, availability, availability === "ready", localAiAvailabilityMessage(availability, state), false, checkedAt);
  }

  async warmup(): Promise<LocalAiAvailabilityResult> {
    const readiness = await this.resolveAvailability("status");
    if (!readiness.ready) {
      return readiness;
    }
    const checkedAt = new Date().toISOString();
    try {
      const state = await this.invokeStateWithTimeout("local_model_warmup", {
        selectedModelId: readiness.state.selectedModelId,
      });
      this.deps.onState?.(state);
      const availability = classifyLocalAiAvailability(state);
      return this.result(state, availability, availability === "ready", localAiAvailabilityMessage(availability, state), false, checkedAt);
    } catch (error) {
      const latest = this.deps.getSnapshot();
      const timedOut = error instanceof LocalAiTimeoutError;
      const availability = classifyLocalAiAvailability(latest, { timedOut });
      const message = error instanceof Error ? error.message : String(error);
      this.deps.onDiagnostic?.("warn", "localAi.warmup", message);
      return this.result(latest, availability, false, message, timedOut, checkedAt);
    }
  }

  async chat(request: LocalModelChatRequest, signal?: AbortSignal): Promise<LocalModelChatResult> {
    return this.deps.invokeChat(request, signal);
  }

  async cancel(): Promise<void> {
    await this.deps.invokeCancel?.();
  }

  private async invokeStateWithTimeout(
    command: LocalModelStateCommand,
    args: Record<string, unknown>,
  ): Promise<LocalModelRuntimeState> {
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        reject(new LocalAiTimeoutError(command, this.deps.timeoutMs));
      }, this.deps.timeoutMs);

      this.deps.invokeState(command, args)
        .then((state) => {
          window.clearTimeout(timeoutId);
          resolve(state);
        })
        .catch((error) => {
          window.clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  private result(
    state: LocalModelRuntimeState,
    availability: LocalAiAvailability,
    ready: boolean,
    message: string | null,
    timedOut: boolean,
    checkedAt: string,
  ): LocalAiAvailabilityResult {
    return {
      availability,
      ready,
      state,
      message,
      timedOut,
      checkedAt,
    };
  }
}
