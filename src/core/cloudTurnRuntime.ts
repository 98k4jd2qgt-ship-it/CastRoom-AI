import {
  OpenAiCompatibleProvider,
  normalizeAiProviderError,
  type OpenAiCompatibleProviderConfig,
} from "./ai";
import type { AiRequestAuditHandle, AiRequestAuditOutcome, AiRequestPurpose, AiRequestAuditScope } from "./aiRequestAudit";
import { runOneOnOneTurn, type PipelineTurnFailure, type PipelineTurnResult, type RunPipelineInput } from "./pipeline";
import type { AiProvider, AiProviderError, AiProviderResult } from "./types";

export type CloudTurnResult = PipelineTurnResult | PipelineTurnFailure;

export interface CloudTurnAuditHooks {
  begin(input: {
    providerId: string;
    purpose: AiRequestPurpose;
    scope: AiRequestAuditScope;
  }): AiRequestAuditHandle | null;
  finish(
    audit: AiRequestAuditHandle | null | undefined,
    outcome: Exclude<AiRequestAuditOutcome, "started">,
    details?: Record<string, unknown>,
  ): void;
}

export interface CloudTurnProviderConfigs {
  chatConfig: OpenAiCompatibleProviderConfig;
  visionConfig?: OpenAiCompatibleProviderConfig | null;
}

export interface AuditedCloudProviderOptions extends CloudTurnProviderConfigs {
  audit: CloudTurnAuditHooks;
  scope: AiRequestAuditScope;
  chatProviderId?: string;
  visionProviderId?: string;
  chatPurpose: AiRequestPurpose;
  visionPurpose?: AiRequestPurpose;
}

export interface CloudTurnRuntimeInput extends Omit<RunPipelineInput, "provider">, AuditedCloudProviderOptions {}

export class CloudTurnRuntime {
  async run(input: CloudTurnRuntimeInput): Promise<CloudTurnResult> {
    const provider = createAuditedCloudProvider(input);
    return runOneOnOneTurn({
      provider,
      memoryStore: input.memoryStore,
      userInput: input.userInput,
      activeCharacter: input.activeCharacter,
      desktopContext: input.desktopContext,
      activeRoom: input.activeRoom,
      memoryScope: input.memoryScope,
      imageAttachment: input.imageAttachment,
    });
  }
}

export function createAuditedCloudProvider(options: AuditedCloudProviderOptions): AiProvider {
  const chatProvider = new OpenAiCompatibleProvider(() => options.chatConfig);
  const visionProvider = new OpenAiCompatibleProvider(() => options.visionConfig ?? options.chatConfig);

  return {
    chat: (context, signal) =>
      runAuditedProviderRequest({
        audit: options.audit,
        scope: options.scope,
        providerId: options.chatProviderId ?? "cloud-chat",
        purpose: options.chatPurpose,
        config: options.chatConfig,
        run: (config) => chatProvider.chatWithConfig(config, context, signal),
      }),
    vision: (block, signal) =>
      runAuditedProviderRequest({
        audit: options.audit,
        scope: options.scope,
        providerId: options.visionProviderId ?? "cloud-vision",
        purpose: options.visionPurpose ?? "vision_caption",
        config: options.visionConfig ?? options.chatConfig,
        run: (config) => visionProvider.visionWithConfig(config, block, signal),
      }),
    embed: (text, signal) => chatProvider.embed(text, signal),
  };
}

export function createProviderWithAuditedVision(
  baseProvider: AiProvider,
  options: Omit<AuditedCloudProviderOptions, "chatConfig" | "chatPurpose"> & {
    visionConfig: OpenAiCompatibleProviderConfig;
  },
): AiProvider {
  const visionProvider = new OpenAiCompatibleProvider(() => options.visionConfig);
  return {
    chat: (context, signal) => baseProvider.chat(context, signal),
    vision: (block, signal) =>
      runAuditedProviderRequest({
        audit: options.audit,
        scope: options.scope,
        providerId: options.visionProviderId ?? "cloud-vision",
        purpose: options.visionPurpose ?? "vision_caption",
        config: options.visionConfig,
        run: (config) => visionProvider.visionWithConfig(config, block, signal),
      }),
    embed: (text, signal) => baseProvider.embed(text, signal),
  };
}

export function withAiRequestAuditMetadata(
  config: OpenAiCompatibleProviderConfig,
  audit: AiRequestAuditHandle | null | undefined,
): OpenAiCompatibleProviderConfig {
  if (!audit) {
    return config;
  }
  return {
    ...config,
    requestId: audit.requestId,
    requestPurpose: audit.purpose,
    turnId: audit.turnId,
  };
}

async function runAuditedProviderRequest<T>(input: {
  audit: CloudTurnAuditHooks;
  scope: AiRequestAuditScope;
  providerId: string;
  purpose: AiRequestPurpose;
  config: OpenAiCompatibleProviderConfig;
  run: (config: OpenAiCompatibleProviderConfig) => Promise<T>;
}): Promise<T> {
  const audit = input.audit.begin({
    providerId: input.providerId,
    purpose: input.purpose,
    scope: input.scope,
  });
  if (!audit && input.purpose === "console_chat") {
    throw {
      code: "unknown",
      message: "Cloud chat request was already running for this turn.",
      nextStep: "Wait for the current reply to finish, or cancel it with /ai cancel.",
    } satisfies AiProviderError;
  }

  try {
    const result = await input.run(withAiRequestAuditMetadata(input.config, audit));
    input.audit.finish(audit, "success", usageAuditDetails(result));
    return result;
  } catch (error) {
    const normalized = normalizeAiProviderError(error);
    input.audit.finish(audit, "failed", {
      errorCode: normalized.code,
      responseShape: providerErrorResponseShape(normalized),
    });
    throw normalized;
  }
}

function usageAuditDetails(result: unknown): Record<string, unknown> | undefined {
  const usage = (result as Partial<AiProviderResult> | null | undefined)?.usage;
  return usage ? { usage } : undefined;
}

function providerErrorResponseShape(error: AiProviderError): string | undefined {
  const responseShape = (error as AiProviderError & { responseShape?: unknown }).responseShape;
  return typeof responseShape === "string" && responseShape.trim() ? responseShape.trim() : undefined;
}
