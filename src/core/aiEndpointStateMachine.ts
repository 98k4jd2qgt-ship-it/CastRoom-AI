import type { AiModelEndpointConfig, AiProviderErrorCode, AiRuntimeStatus } from "./types";

export function maskApiKey(value: string): string {
  const text = value.trim();
  if (!text) {
    return "";
  }
  if (text.length <= 8) {
    return "*".repeat(text.length);
  }
  return `${text.slice(0, 4)}...${text.slice(-4)}`;
}

export function resetEndpointAfterConfigChange<T extends AiModelEndpointConfig>(endpoint: T, message: string): T {
  return {
    ...endpoint,
    status: "not_configured",
    runtimeStatus: "idle",
    lastTestMessage: message,
    lastTestedAt: null,
    lastRuntimeMessage: "",
    lastRuntimeAt: null,
    availableModels: [],
    capabilitySummary: "Test this model to confirm it is ready.",
    lastErrorCode: null,
  };
}

export function projectEndpointKey<T extends AiModelEndpointConfig>(
  endpoint: T,
  apiKeyPreview: string,
  message: string,
): T {
  const trimmed = apiKeyPreview.trim();
  return resetEndpointAfterConfigChange(
    {
      ...endpoint,
      keyPreview: trimmed ? maskApiKey(trimmed) : "",
      hasStoredSecret: Boolean(trimmed),
    },
    message,
  );
}

export function applyEndpointRuntimeStatus<T extends AiModelEndpointConfig>(
  endpoint: T,
  runtimeStatus: AiRuntimeStatus,
  message: string,
  at: string | null = null,
  errorCode: AiProviderErrorCode | null = null,
): T {
  return {
    ...endpoint,
    runtimeStatus,
    lastRuntimeMessage: message,
    lastRuntimeAt: at,
    lastErrorCode: errorCode,
  };
}
