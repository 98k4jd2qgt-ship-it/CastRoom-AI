import type {
  CommandDefinition,
  CommandResult,
  CommandSuggestion,
  ConsoleCommandRouter,
  ConsoleView,
} from "./types";

const UNKNOWN_DEBUG_COMMAND = "未知调试命令。输入 /commands 查看可用调试命令。";

const commandDefinitions: CommandDefinition[] = [
  { command: "/help", description: "Explain that slash commands are only for debug", category: "help", view: "help" },
  { command: "/commands", description: "Show available debug commands", category: "help", view: "commands" },
  { command: "/ai status", description: "Show cloud/local chat eligibility and pending turn state", category: "ai", view: "chat" },
  { command: "/ai test", description: "Send one debug test request with the current Chat model", category: "ai", view: "chat" },
  { command: "/ai last", description: "Show the latest AI request summary", category: "ai", view: "chat" },
  { command: "/ai trace", description: "Show the latest one-on-one chat turn trace", category: "ai", view: "chat" },
  { command: "/ai cancel", description: "Cancel the current pending AI turn", category: "ai", view: "chat" },
  { command: "/debug state", description: "Show current surface, view, character, input, and turn state", category: "debug", view: "chat" },
  { command: "/debug room", description: "Show the active room scheduler snapshot", category: "debug", view: "chat" },
  { command: "/debug memory", description: "Show memory counts and prompt memory budget", category: "debug", view: "chat" },
  { command: "/debug export", description: "Export redacted diagnostics", category: "debug", view: "chat" },
];

export function createCommandRouter(): ConsoleCommandRouter {
  return {
    route(input: string): CommandResult {
      const value = input.trim();

      if (!value.startsWith("/")) {
        return {
          kind: "chat",
          message: "Your message will be sent as chat.",
          view: "chat",
        };
      }

      if (value.startsWith("/shell")) {
        return {
          kind: "blocked",
          message: "CastRoom AI 不执行 shell 命令。请使用系统终端。",
          view: "chat",
        };
      }

      const exact = findExactCommand(value);
      if (exact) {
        return resultForCommand(exact);
      }

      return {
        kind: "suggestion",
        message: UNKNOWN_DEBUG_COMMAND,
        view: "chat",
      };
    },

    suggestions(prefix: string): CommandSuggestion[] {
      const value = prefix.trim();
      if (!value.startsWith("/")) {
        return [];
      }

      return commandDefinitions
        .filter((definition) => definition.command.startsWith(value))
        .slice(0, 8)
        .map((definition) => ({
          command: definition.command,
          description: definition.description,
          category: definition.category,
        }));
    },

    definitions(): CommandDefinition[] {
      return commandDefinitions;
    },
  };
}

export function viewTitle(view: ConsoleView): string {
  const titles: Record<ConsoleView, string> = {
    chat: "Chat",
    help: "Help",
    commands: "Commands",
    config: "Config",
    setup: "Config",
    ai: "Config",
    voice: "Config",
    pack: "Character Pack",
    prompts: "Prompt Center",
    room: "Room",
    memory: "Memory",
    privacy: "Config",
    diagnostics: "Diagnostics",
    release: "Release",
  };

  return titles[view];
}

function resultForCommand(definition: CommandDefinition): CommandResult {
  const messageByCommand: Record<string, string> = {
    "/help": "调试帮助已打开。普通聊天直接输入文字，/ 命令只用于排查问题。",
    "/commands": "调试命令列表已打开。普通配置、房间、角色和记忆请使用界面。",
    "/ai status": "AI 状态会显示在聊天窗口。",
    "/ai test": "AI 调试测试会使用当前 Chat model 配置发送一次纯文本请求。",
    "/ai last": "最近 AI 请求摘要会显示在聊天窗口。",
    "/ai trace": "最近一轮一对一 turn 链路会显示在聊天窗口。",
    "/ai cancel": "正在取消当前 pending AI turn。",
    "/debug state": "当前运行状态会显示在聊天窗口。",
    "/debug room": "当前房间调度快照会显示在聊天窗口。",
    "/debug memory": "当前记忆计数与注入预算会显示在聊天窗口。",
    "/debug export": "正在导出脱敏诊断。",
  };

  return {
    kind: "handled",
    command: definition.command,
    view: definition.view,
    message: messageByCommand[definition.command] ?? `${definition.command} handled.`,
  };
}

function findExactCommand(value: string): CommandDefinition | undefined {
  return commandDefinitions.find((definition) => definition.command === value);
}
