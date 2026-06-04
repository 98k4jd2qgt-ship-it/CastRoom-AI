import { invoke } from "@tauri-apps/api/core";

import type { AiRequestPurpose } from "./aiRequestAudit";
import type { AiProviderErrorCode } from "./types";

export interface CloudTransportErrorResponse {
  code: AiProviderErrorCode | string;
  message: string;
  nextStep: string;
}

export interface CloudHttpRequestPayload {
  endpoint: string;
  requestId?: string;
  purpose?: AiRequestPurpose;
  turnId?: string | null;
  secretRef?: string | null;
  authMode?: "bearer" | "x_api_key" | "custom_header" | "none";
  customAuthHeader?: string;
  organizationId?: string;
  projectId?: string;
  timeoutMs?: number;
  body?: Record<string, unknown>;
}

export interface CloudHttpResponse {
  ok: boolean;
  status: number;
  contentType: string;
  bodyText: string;
  requestId?: string | null;
  purpose?: AiRequestPurpose | null;
  turnId?: string | null;
  transportError?: CloudTransportErrorResponse | null;
}

export interface CloudTtsResponse extends CloudHttpResponse {
  bodyBase64: string;
}

export class AiGateway {
  chat(request: CloudHttpRequestPayload): Promise<CloudHttpResponse> {
    this.recordUnscopedRequest(request, "cloud_chat_request");
    return invoke<CloudHttpResponse>("cloud_chat_request", { request });
  }

  vision(request: CloudHttpRequestPayload): Promise<CloudHttpResponse> {
    this.recordUnscopedRequest(request, "cloud_vision_request");
    return invoke<CloudHttpResponse>("cloud_vision_request", { request });
  }

  tts(request: CloudHttpRequestPayload): Promise<CloudTtsResponse> {
    this.recordUnscopedRequest(request, "cloud_tts_request");
    return invoke<CloudTtsResponse>("cloud_tts_request", { request });
  }

  endpointTest(request: CloudHttpRequestPayload): Promise<CloudHttpResponse> {
    this.recordUnscopedRequest(request, "cloud_endpoint_test");
    return invoke<CloudHttpResponse>("cloud_endpoint_test", { request });
  }

  private recordUnscopedRequest(request: CloudHttpRequestPayload, command: string) {
    if (request.purpose) {
      return;
    }
    console.warn("[CastRoom AI] unscoped_cloud_request", {
      command,
      requestId: request.requestId ?? null,
      turnId: request.turnId ?? null,
    });
  }
}

export const tauriAiGateway = new AiGateway();
