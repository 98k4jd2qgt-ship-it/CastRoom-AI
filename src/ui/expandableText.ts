import type { AppLanguage } from "../core/types";

export interface ExpandableTextOptions {
  text: string;
  language: AppLanguage;
  key?: string;
  initialExpanded?: boolean;
  collapsedLines?: 2 | 3 | 4;
  className?: string;
  title?: string;
  preserveLineBreaks?: boolean;
}

export function renderExpandableText(options: ExpandableTextOptions): HTMLElement {
  const text = options.text.trim();
  const collapsedLines = options.collapsedLines ?? 2;
  const wrapper = document.createElement("div");
  wrapper.className = ["expandable-text", options.className].filter(Boolean).join(" ");
  wrapper.title = options.title ?? text;
  if (options.key) {
    wrapper.dataset.expandableKey = options.key;
  }
  const initialExpanded = options.initialExpanded === true;

  const content = document.createElement("div");
  content.className = "expandable-text-content";
  content.textContent = text;
  content.dataset.expanded = String(initialExpanded);
  content.style.setProperty("--collapsed-lines", String(collapsedLines));
  if (options.preserveLineBreaks) {
    content.dataset.preserveLineBreaks = "true";
  }
  wrapper.append(content);

  if (!text) {
    return wrapper;
  }

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "expandable-text-toggle";
  toggle.dataset.expandLabel = expandedLabel(options.language, false);
  toggle.dataset.collapseLabel = expandedLabel(options.language, true);
  toggle.textContent = expandedLabel(options.language, initialExpanded);
  toggle.setAttribute("aria-expanded", String(initialExpanded));
  toggle.hidden = !shouldShowExpandableToggle(text);
  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const expanded = content.dataset.expanded === "true";
    const nextExpanded = !expanded;
    content.dataset.expanded = String(nextExpanded);
    toggle.setAttribute("aria-expanded", String(nextExpanded));
    toggle.textContent = expandedLabel(options.language, nextExpanded);
  });
  wrapper.append(toggle);
  queueOverflowCheck(content, toggle);

  return wrapper;
}

function shouldShowExpandableToggle(text: string): boolean {
  if (!text) {
    return false;
  }
  if (/\r|\n/.test(text)) {
    return true;
  }
  const cjkCount = Array.from(text.matchAll(/[\u3400-\u9fff\uf900-\ufaff]/g)).length;
  const latinLikeCount = text.length - cjkCount;
  return cjkCount > 28 || latinLikeCount > 56 || text.length > 56;
}

function expandedLabel(language: AppLanguage, expanded: boolean): string {
  const labels: Record<AppLanguage, { expand: string; collapse: string }> = {
    en: { expand: "Show more", collapse: "Show less" },
    "zh-CN": { expand: "\u5c55\u5f00", collapse: "\u6536\u8d77" },
    "ja-JP": { expand: "展開", collapse: "閉じる" },
    "ko-KR": { expand: "펼치기", collapse: "접기" },
    "de-DE": { expand: "Mehr anzeigen", collapse: "Weniger anzeigen" },
    "ru-RU": { expand: "Показать", collapse: "Свернуть" },
  };
  return expanded ? labels[language].collapse : labels[language].expand;
}

function queueOverflowCheck(content: HTMLElement, toggle: HTMLButtonElement): void {
  const update = () => {
    if (!content.isConnected || content.dataset.expanded === "true") {
      return;
    }
    const hasOverflow = content.scrollHeight > content.clientHeight + 1 || content.scrollWidth > content.clientWidth + 1;
    if (hasOverflow) {
      toggle.hidden = false;
    }
  };

  window.requestAnimationFrame(() => {
    update();
    window.requestAnimationFrame(update);
  });

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(update);
    observer.observe(content);
  }
}
