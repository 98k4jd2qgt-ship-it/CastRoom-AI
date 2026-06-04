import type { AiModelEndpointConfig } from "./types";
import { projectEndpointKey } from "./aiEndpointStateMachine";

export interface SecretProjectionInput<T extends AiModelEndpointConfig> {
  endpoint: T;
  apiKeyPreview: string;
  message: string;
}

export function applyApiKeyProjection<T extends AiModelEndpointConfig>({
  endpoint,
  apiKeyPreview,
  message,
}: SecretProjectionInput<T>): T {
  return projectEndpointKey(endpoint, apiKeyPreview, message);
}

export const SecretProjection = {
  applyApiKeyProjection,
};
