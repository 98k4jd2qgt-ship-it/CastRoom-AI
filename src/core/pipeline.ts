import type {
  AiProvider,
  AiProviderError,
  AiProviderResult,
  CharacterViewModel,
  ChatImageAttachment,
  DesktopContextState,
  InteractionPipelineContext,
  MemoryScope,
  RoomState,
  UntrustedContextBlock,
} from "./types";
import type { MemoryStore } from "./memory";
import { normalizeAiProviderError, withProviderTimeout } from "./ai";

export interface RunPipelineInput {
  provider: AiProvider;
  memoryStore: MemoryStore;
  userInput: string;
  activeCharacter: CharacterViewModel;
  desktopContext: DesktopContextState;
  activeRoom: RoomState | null;
  memoryScope: MemoryScope;
  imageAttachment?: ChatImageAttachment | null;
}

export interface PipelineTurnResult {
  ok: true;
  context: InteractionPipelineContext;
  result: AiProviderResult;
}

export interface PipelineTurnFailure {
  ok: false;
  context: InteractionPipelineContext;
  error: AiProviderError;
}

export async function runOneOnOneTurn(
  input: RunPipelineInput,
): Promise<PipelineTurnResult | PipelineTurnFailure> {
  const context = createInteractionContext(input);
  let finalContext = context;

  try {
    const result = await withProviderTimeout(async (signal) => {
      if (!context.imageContext) {
        return input.provider.chat(context, signal);
      }

      const visionResult = await input.provider.vision(context.imageContext, signal);
      finalContext = {
        ...context,
        imageContext: createImageCaptionContext(context.imageContext, visionResult.text),
      };

      return input.provider.chat(finalContext, signal);
    });
    return { ok: true, context: finalContext, result };
  } catch (error) {
    return { ok: false, context: finalContext, error: normalizeAiProviderError(error) };
  }
}

export function createInteractionContext(input: RunPipelineInput): InteractionPipelineContext {
  return {
    time: input.desktopContext.currentTime,
    foregroundApp: input.desktopContext.foregroundAppAwarenessEnabled
      ? input.desktopContext.focusedAppName
      : "foreground app awareness is off",
    imageContext: input.imageAttachment ? createImageContext(input.imageAttachment, input.userInput) : null,
    memorySnippets: input.memoryStore.getPromptMemory(input.memoryScope, {
      localModel: input.provider.constructor.name === "LocalModelProvider",
    }),
    activeCharacter: input.activeCharacter,
    activeRoom: input.activeRoom,
    userInput: input.userInput,
  };
}

function createImageContext(attachment: ChatImageAttachment, userInput: string): UntrustedContextBlock {
  return {
    source: "image_upload",
    capturedAt: new Date().toISOString(),
    trusted: false,
    attachment,
    text: [
      `userPrompt=${userInput || "Describe this image"}`,
      `fileName=${attachment.fileName}`,
      `mimeType=${attachment.mimeType}`,
      `format=${attachment.format}`,
      `sizeBytes=${attachment.sizeBytes}`,
      "source=user_selected_chat_attachment",
    ].join("; "),
  };
}

function createImageCaptionContext(source: UntrustedContextBlock, caption: string): UntrustedContextBlock {
  return {
    source: "image_caption",
    capturedAt: new Date().toISOString(),
    trusted: false,
    attachment: source.attachment,
    text: [
      "source=user_selected_chat_attachment_vision_caption",
      `original=${source.text}`,
      `caption=${caption}`,
      "policy=untrusted_context_for_character_llm",
    ].join("; "),
  };
}
