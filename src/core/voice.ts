import { invoke } from "@tauri-apps/api/core";
import type {
  SttResult,
  TtsRequest,
  TtsResult,
  TtsVoiceInfo,
  VoiceModelDownloadState,
  VoicePipelineState,
} from "./types";

export interface SttProvider {
  transcribeFile(audioPath: string): Promise<SttResult>;
}

export interface TtsProvider {
  listVoices(): Promise<TtsVoiceInfo[]>;
  synthesize(request: TtsRequest): Promise<TtsResult>;
}

export interface VoiceModelManager {
  downloadModel(modelId: VoiceModelDownloadState["modelId"]): Promise<VoiceModelDownloadState>;
  cancelModelDownload(): Promise<VoiceModelDownloadState>;
}

export interface VoicePlaybackController {
  testSynthesis(request: TtsRequest): Promise<TtsResult>;
}

export interface VoiceService extends SttProvider, TtsProvider, VoiceModelManager, VoicePlaybackController {
  getState(): Promise<VoicePipelineState>;
}

export class TauriVoiceService implements VoiceService {
  getState(): Promise<VoicePipelineState> {
    return invoke<VoicePipelineState>("voice_get_state");
  }

  downloadModel(modelId: VoiceModelDownloadState["modelId"]): Promise<VoiceModelDownloadState> {
    return invoke<VoiceModelDownloadState>("voice_download_model", { modelId });
  }

  cancelModelDownload(): Promise<VoiceModelDownloadState> {
    return invoke<VoiceModelDownloadState>("voice_cancel_model_download");
  }

  transcribeFile(audioPath: string): Promise<SttResult> {
    return invoke<SttResult>("voice_transcribe_file", { audioPath });
  }

  listVoices(): Promise<TtsVoiceInfo[]> {
    return invoke<TtsVoiceInfo[]>("voice_list_tts_voices");
  }

  synthesize(request: TtsRequest): Promise<TtsResult> {
    return invoke<TtsResult>("voice_synthesize", { request });
  }

  testSynthesis(request: TtsRequest): Promise<TtsResult> {
    return this.synthesize(request);
  }
}
