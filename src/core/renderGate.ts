export type RenderRequestKind = "structural" | "status" | "message" | "diagnostic";
export type RenderWorkspace =
  | "console_chat"
  | "console_memory"
  | "console_prompt"
  | "console_config"
  | "room"
  | "pet"
  | "other";

export interface RenderGateRequest {
  reason: string;
  kind: RenderRequestKind;
  workspace?: RenderWorkspace;
  force?: boolean;
  structural?: boolean;
  hotPathActive?: boolean;
  localUpdate?: () => boolean;
}

export interface RenderGateDecision {
  allow: boolean;
  reason: string;
  kind: RenderRequestKind;
  workspace: RenderWorkspace;
  suppressed: boolean;
  localUpdated: boolean;
}

export class RenderGate {
  request(input: RenderGateRequest): RenderGateDecision {
    const workspace = input.workspace ?? "other";
    const structural = input.structural || input.kind === "structural";
    if (input.force || structural) {
      return {
        allow: true,
        reason: input.reason,
        kind: input.kind,
        workspace,
        suppressed: false,
        localUpdated: false,
      };
    }

    const localUpdated = input.localUpdate?.() === true;
    if (localUpdated) {
      return {
        allow: false,
        reason: input.reason,
        kind: input.kind,
        workspace,
        suppressed: true,
        localUpdated: true,
      };
    }

    if (input.hotPathActive) {
      return {
        allow: false,
        reason: input.reason,
        kind: input.kind,
        workspace,
        suppressed: true,
        localUpdated: false,
      };
    }

    return {
      allow: true,
      reason: input.reason,
      kind: input.kind,
      workspace,
      suppressed: false,
      localUpdated: false,
    };
  }
}
