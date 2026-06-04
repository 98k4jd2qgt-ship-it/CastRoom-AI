import type { DesktopContextState } from "./types";

export function createDemoDesktopContext(): DesktopContextState {
  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    currentTime: now.toLocaleString("zh-CN", {
      hour12: false,
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    timezone,
    focusedAppName: "foreground awareness disabled",
    focusedWindowTitle: "",
    focusedProcessId: null,
    isFullscreenOrBorderless: false,
    foregroundAppAwarenessEnabled: true,
  };
}
