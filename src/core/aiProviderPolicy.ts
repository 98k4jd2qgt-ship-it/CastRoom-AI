import type { AiProvider } from "./types";
import type { AiRequestPurpose } from "./aiRequestAudit";

export interface AiProviderCandidate {
  id: string;
  provider: AiProvider;
  live?: boolean;
  blockReason?: string | null;
  sourceLabel?: string;
  chatConfig?: unknown;
  visionConfig?: unknown;
  status?: string | null;
}

export interface AiProviderCascadeInput {
  local?: AiProviderCandidate | null;
  cloud?: AiProviderCandidate | null;
}

export interface ProviderResolverContext extends AiProviderCascadeInput {
  localEnabled?: boolean;
  purpose?: AiRequestPurpose;
  scope?: string;
}

export type ProviderCandidateInput<T extends AiProviderCandidate> = Omit<T, "live" | "blockReason"> & {
  live?: boolean;
  blockReason?: string | null;
  enabled?: boolean;
  ready?: boolean;
  unavailableReason?: string | null;
};

export interface ProviderResolution {
  purpose?: AiRequestPurpose;
  scope?: string;
  candidates: AiProviderCandidate[];
  providerIds: string[];
  liveProviderIds: string[];
  blockReasons: Record<string, string>;
  selectedSourceLabel: string | null;
  canAttempt: boolean;
  debugSummary: string;
}

export class ProviderResolver {
  candidate<T extends AiProviderCandidate>(input: ProviderCandidateInput<T>): T | null {
    if (input.enabled === false) {
      return null;
    }
    const blockReason = input.blockReason
      ?? (input.ready === false ? input.unavailableReason ?? `${input.id} is unavailable.` : null);
    const live = input.live ?? !blockReason;
    return {
      ...input,
      live,
      blockReason,
    } as T;
  }

  resolve(input: ProviderResolverContext): ProviderResolution {
    const providers: AiProviderCandidate[] = [];
    if (input.local) {
      providers.push(input.local);
    }
    if (input.cloud) {
      providers.push(input.cloud);
    }
    const blockReasons = Object.fromEntries(
      providers
        .filter((provider) => provider.blockReason)
        .map((provider) => [provider.id, provider.blockReason ?? "blocked"]),
    );
    const liveProviders = providers.filter((provider) => provider.live !== false && !provider.blockReason);
    const providerIds = providers.map((provider) => provider.id);
    const liveProviderIds = liveProviders.map((provider) => provider.id);
    const selectedSourceLabel = liveProviders[0]?.sourceLabel ?? liveProviders[0]?.id ?? null;
    const debugSummary = [
      input.purpose ? `purpose=${input.purpose}` : null,
      input.scope ? `scope=${input.scope}` : null,
      `providers=${providerIds.join(",") || "none"}`,
      Object.keys(blockReasons).length ? `blocked=${JSON.stringify(blockReasons)}` : null,
      selectedSourceLabel ? `selected=${selectedSourceLabel}` : null,
    ]
      .filter((item): item is string => Boolean(item))
      .join(" ");

    return {
      purpose: input.purpose,
      scope: input.scope,
      candidates: providers,
      providerIds,
      liveProviderIds,
      blockReasons,
      selectedSourceLabel,
      canAttempt: liveProviders.length > 0,
      debugSummary,
    };
  }

  providerIds(input: ProviderResolverContext): string[] {
    return this.resolve(input).providerIds;
  }
}

export function buildAiProviderCascade(input: AiProviderCascadeInput): AiProviderCandidate[] {
  return new ProviderResolver().resolve(input).candidates;
}
