import type { ConsoleMessage } from "./types";

export interface ConsoleMessageCommitTrace {
  turnId: string | null;
  messageId: string;
  kind: ConsoleMessage["kind"];
  at: number;
}

export class ConsoleMessageStore {
  private messages: ConsoleMessage[];
  private readonly commits: ConsoleMessageCommitTrace[] = [];
  private revisionNumber = 0;

  constructor(initialMessages: ConsoleMessage[] = []) {
    this.messages = [...initialMessages];
  }

  snapshot(): ConsoleMessage[] {
    return [...this.messages];
  }

  snapshotForHistory(): ConsoleMessage[] {
    return this.snapshot();
  }

  getById(messageId: string): ConsoleMessage | null {
    return this.messages.find((message) => message.id === messageId) ?? null;
  }

  get revision(): number {
    return this.revisionNumber;
  }

  replace(messages: ConsoleMessage[]): void {
    this.messages = [...messages];
    this.commits.splice(0);
    this.revisionNumber += 1;
  }

  commit(
    input: Omit<ConsoleMessage, "id" | "at">,
    options: {
      turnId?: string | null;
      atLabel: string;
      idFactory?: () => string;
    },
  ): ConsoleMessage {
    const message: ConsoleMessage = {
      id: options.idFactory?.() ?? crypto.randomUUID(),
      at: options.atLabel,
      ...input,
    };
    this.messages.push(message);
    this.commits.push({
      turnId: options.turnId ?? null,
      messageId: message.id,
      kind: message.kind,
      at: Date.now(),
    });
    this.revisionNumber += 1;
    return message;
  }

  hasCommitForTurn(turnId: string, kind?: ConsoleMessage["kind"]): boolean {
    return this.commits.some((commit) => commit.turnId === turnId && (!kind || commit.kind === kind));
  }

  latestCommitForTurn(turnId: string): ConsoleMessageCommitTrace | null {
    for (let index = this.commits.length - 1; index >= 0; index -= 1) {
      const commit = this.commits[index];
      if (commit?.turnId === turnId) {
        return commit;
      }
    }
    return null;
  }

  updateLatestUserAttachmentCaptionForTurn(turnId: string, caption: string): boolean {
    const commit = [...this.commits]
      .reverse()
      .find((item) => item.turnId === turnId && item.kind === "user");
    if (!commit) {
      return false;
    }
    const messageIndex = this.messages.findIndex((message) => message.id === commit.messageId);
    const message = this.messages[messageIndex];
    if (!message?.attachments?.length) {
      return false;
    }
    this.messages[messageIndex] = {
      ...message,
      attachments: message.attachments.map((attachment) => ({
        ...attachment,
        caption,
      })),
    };
    this.revisionNumber += 1;
    return true;
  }
}
