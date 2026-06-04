import type {
  CharacterViewModel,
  DesktopContextState,
  EmotionAssetCandidate,
  AppLanguage,
  PetInputState,
  PetWindowMode,
} from "../core/types";
import { t } from "./copy";

export interface PetModeProps {
  character: CharacterViewModel;
  desktopContext: DesktopContextState;
  language: AppLanguage;
  inputState: PetInputState;
  interactionState: PetWindowMode;
  onOpenConsole: () => void;
  onRequestInput: () => void;
  onCancelInput: () => void;
  onSubmitInput: (value: string) => void;
  onEnterMoveMode: () => void;
  onExitMoveMode: () => void;
}

export function renderPetMode(props: PetModeProps): HTMLElement {
  const root = document.createElement("section");
  root.className = "pet-layer";
  root.dataset.interaction = props.interactionState;
  root.dataset.input = props.inputState;
  root.dataset.speaking = String(props.character.isSpeaking);
  root.ariaLabel = t(props.language, "petAria");

  const character = renderCharacter(props.character, props.desktopContext, props.language);
  character.addEventListener("click", () => {
    if (props.interactionState !== "move") {
      props.onRequestInput();
    }
  });
  character.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showContextMenu(root, props);
  });

  root.append(character, renderSubtitle(props.character));

  if (props.inputState === "focused" || props.inputState === "submitting") {
    root.append(renderInput(props));
  }

  if (props.interactionState === "move") {
    root.append(renderMoveHint(props));
  }

  return root;
}

function renderCharacter(
  character: CharacterViewModel,
  desktopContext: DesktopContextState,
  language: AppLanguage,
): HTMLElement {
  const frame = document.createElement("div");
  frame.className = "pet-character";
  frame.title = t(language, "petTitle", {
    name: character.name,
    time: desktopContext.currentTime,
    app: desktopContext.focusedAppName,
  });

  const imageCandidates =
    character.imageCandidates ?? (character.imageSrc ? [{ kind: "image" as const, src: character.imageSrc, format: "png" as const, animated: false }] : []);
  if (imageCandidates.length > 0) {
    frame.append(renderCharacterAssetCandidate(character, imageCandidates, 0));
    return frame;
  }

  frame.append(renderCharacterArt(character));
  return frame;
}

function renderCharacterAssetCandidate(
  character: CharacterViewModel,
  candidates: EmotionAssetCandidate[],
  index: number,
): HTMLElement {
  const candidate = candidates[index];
  if (!candidate) {
    return renderCharacterArt(character);
  }
  if (candidate.kind === "text") {
    return renderCharacterTextArt(candidate.text ?? character.art, "pet-character-art");
  }

  const image = document.createElement("img");
  image.alt = character.imageAlt ?? character.name;
  image.src = candidate.src ?? "";
  image.addEventListener("error", () => {
    image.replaceWith(renderCharacterAssetCandidate(character, candidates, index + 1));
  });
  return image;
}

function renderCharacterArt(character: CharacterViewModel): HTMLElement {
  return renderCharacterTextArt(character.art, "pet-character-art");
}

function renderCharacterTextArt(text: string, className: string): HTMLElement {
  const art = document.createElement("pre");
  art.className = className;
  art.textContent = text;
  return art;
}

function renderSubtitle(character: CharacterViewModel): HTMLElement {
  const subtitle = document.createElement("div");
  subtitle.className = "pet-subtitle";
  subtitle.dataset.hidden = String(!character.isSpeaking);

  if (character.subtitleSource) {
    const source = document.createElement("span");
    source.className = "pet-subtitle-source";
    source.textContent = character.subtitleSource;
    const translated = document.createElement("strong");
    translated.textContent = character.subtitle;
    subtitle.append(source, translated);
  } else {
    subtitle.textContent = character.subtitle;
  }

  return subtitle;
}

function renderInput(props: PetModeProps): HTMLElement {
  const input = document.createElement("input");
  input.className = "pet-input";
  input.placeholder = t(props.language, "petInputPlaceholder");
  input.autocomplete = "off";
  input.disabled = props.inputState === "submitting";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      props.onCancelInput();
      return;
    }

    if (event.key === "Enter") {
      const value = input.value.trim();
      if (value) {
        props.onSubmitInput(value);
      } else {
        props.onCancelInput();
      }
    }
  });
  input.addEventListener("blur", () => props.onCancelInput());
  window.setTimeout(() => input.focus(), 0);
  return input;
}

function renderMoveHint(props: PetModeProps): HTMLElement {
  const hint = document.createElement("div");
  hint.className = "pet-move-hint";
  hint.tabIndex = 0;
  hint.textContent = t(props.language, "petMoveHint");
  hint.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === "Escape") {
      props.onExitMoveMode();
    }
  });
  window.setTimeout(() => hint.focus(), 0);
  return hint;
}

function showContextMenu(root: HTMLElement, props: PetModeProps) {
  root.querySelector(".pet-context-menu")?.remove();

  const menu = document.createElement("div");
  menu.className = "pet-context-menu";

  const openConsole = menuItem(t(props.language, "petMenuOpenConsole"), () => {
    menu.remove();
    props.onOpenConsole();
  });
  const moveMode = menuItem(t(props.language, "petMenuMove"), () => {
    menu.remove();
    props.onEnterMoveMode();
  });

  menu.append(openConsole, moveMode);
  root.append(menu);
}

function menuItem(label: string, onClick: () => void): HTMLButtonElement {
  const item = document.createElement("button");
  item.className = "pet-menu-item";
  item.type = "button";
  item.textContent = label;
  item.addEventListener("click", onClick);
  return item;
}
