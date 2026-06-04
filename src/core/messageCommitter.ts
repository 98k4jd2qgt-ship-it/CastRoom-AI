export type MessageCommitTarget = "direct_room" | "room_timeline" | "room_inspector";

export interface MessageCommitResult {
  ok: boolean;
  target: MessageCommitTarget;
  messageId?: string;
  visible: boolean;
  reason?: string;
  error?: unknown;
}

export interface MessageCommitApplyResult {
  messageId?: string;
  visible?: boolean;
  reason?: string;
}

export class MessageCommitter {
  commit(input: {
    target: MessageCommitTarget;
    messageId?: string;
    visible?: boolean;
    reason?: string;
    apply?: () => MessageCommitApplyResult | void;
    onCommitFailure?: (reason: string, error?: unknown) => MessageCommitApplyResult | void;
  }): MessageCommitResult {
    let applied: MessageCommitApplyResult | void;
    try {
      applied = input.apply?.();
    } catch (error) {
      const reason = input.reason ?? errorToMessage(error) ?? "commit_failed";
      try {
        const fallback = input.onCommitFailure?.(reason, error);
        return {
          ok: false,
          target: input.target,
          messageId: fallback?.messageId ?? input.messageId,
          visible: fallback?.visible ?? true,
          reason: fallback?.reason ?? reason,
          error,
        };
      } catch (fallbackError) {
        return {
          ok: false,
          target: input.target,
          messageId: input.messageId,
          visible: true,
          reason,
          error: fallbackError,
        };
      }
    }
    const messageId = applied?.messageId ?? input.messageId;
    const reason = applied?.reason ?? input.reason;
    const visible = applied?.visible ?? input.visible ?? Boolean(messageId);
    return {
      ok: Boolean(messageId || visible),
      target: input.target,
      messageId,
      visible,
      reason,
    };
  }

  visibleError(target: MessageCommitTarget, reason: string): MessageCommitResult {
    return {
      ok: false,
      target,
      visible: true,
      reason,
    };
  }
}

function errorToMessage(error: unknown): string | null {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return null;
}
