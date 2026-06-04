export type ChatTurnTraceStage =
  | "input_component_input"
  | "input_component_keydown_enter"
  | "input_component_send_click"
  | "input_component_submit_attempt"
  | "input_component_submit_empty"
  | "input_component_submit_locked"
  | "command_suggestion_select"
  | "input_component_submit"
  | "main_onSubmitInput"
  | "ui_submit_received"
  | "ui_form_submit"
  | "submit_handler_entered"
  | "submit_dispatched_to_console"
  | "ui_submit"
  | "queued_turn_created"
  | "turn_created"
  | "user_message_committed"
  | "provider_selected"
  | "vision_request_started"
  | "vision_caption_committed"
  | "chat_request_started"
  | "request_started"
  | "response_received"
  | "result_parsed"
  | "message_committed"
  | "rendered"
  | "error_committed"
  | "expired"
  | "cancelled";

export interface ChatTurnTraceEvent {
  turnId: string;
  stage: ChatTurnTraceStage;
  at: string;
  detail?: string;
  requestId?: string;
  providerId?: string;
  messageId?: string;
}

export class ChatTurnTraceLog {
  private readonly events: ChatTurnTraceEvent[] = [];
  private renderedTurnIds = new Set<string>();

  constructor(private readonly maxEvents = 120) {}

  record(input: Omit<ChatTurnTraceEvent, "at">) {
    this.events.push({
      ...input,
      at: new Date().toISOString(),
    });
    this.events.splice(0, Math.max(0, this.events.length - this.maxEvents));
  }

  markRendered(turnId: string) {
    if (this.renderedTurnIds.has(turnId)) {
      return;
    }
    this.renderedTurnIds.add(turnId);
    this.record({ turnId, stage: "rendered" });
  }

  latestTurnId(): string | null {
    for (let index = this.events.length - 1; index >= 0; index -= 1) {
      const event = this.events[index];
      if (event?.turnId) {
        return event.turnId;
      }
    }
    return null;
  }

  latestTurnEvents(): ChatTurnTraceEvent[] {
    const turnId = this.latestTurnId();
    return turnId ? this.events.filter((event) => event.turnId === turnId) : [];
  }

  snapshot(): ChatTurnTraceEvent[] {
    return [...this.events];
  }

  formatLatest(): string {
    const events = this.latestTurnEvents();
    if (!events.length) {
      return "No chat turn trace has been recorded in this session.";
    }

    const turnId = events[0]?.turnId ?? "unknown";
    const lines = [`Recent chat turn trace:`, `turnId: ${turnId}`];
    for (const event of events) {
      const parts = [`- ${event.stage}`, event.at];
      if (event.providerId) {
        parts.push(`provider=${event.providerId}`);
      }
      if (event.requestId) {
        parts.push(`request=${event.requestId}`);
      }
      if (event.messageId) {
        parts.push(`message=${event.messageId}`);
      }
      if (event.detail) {
        parts.push(`detail=${event.detail}`);
      }
      lines.push(parts.join(" | "));
    }
    return lines.join("\n");
  }
}
