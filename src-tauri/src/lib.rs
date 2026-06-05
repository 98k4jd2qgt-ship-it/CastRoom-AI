use std::ffi::c_void;
use std::fs::{self, OpenOptions};
use std::hash::{Hash, Hasher};
use std::io::{BufRead, BufReader, Write};
use std::net::TcpListener;
use std::path::{Component, Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::ptr;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose, Engine as _};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use reqwest::Client;
use rusqlite::{params, Connection};
use tauri::{AppHandle, Manager};

const MAX_PROMPT_TEXT_BYTES: usize = 32 * 1024;
const MAX_PROMPT_PRESETS_BYTES: u64 = 512 * 1024;
const MAX_CHARACTER_TEXT_ASSET_BYTES: u64 = 32 * 1024;
const MAX_SECRET_NAME_LEN: usize = 96;
const MAX_VOICE_MODEL_BYTES: u64 = 256 * 1024 * 1024;
const MAX_CHARACTER_ASSET_BYTES: u64 = 25 * 1024 * 1024;
const FALLBACK_PROMPT_TEXT: &str = "# Character Base Prompt\n\n## Role Content\nAdd this character's identity, voice, abilities, boundaries, and preferences here.\nIf this section is not filled in, answer normally using the current chat or room context.\n\n## How to Reply\nReply in the user's current primary language. If the user changes language, follow the most recent primary language.\nBe natural and clear. Keep replies concise unless the user asks for detail.\n\n## CastRoom Rules\nIn rooms, follow the current channel, @ target, Director rulings, visibility rules, and memory isolation.\nDo not reveal hidden information or rewrite scene facts, item ownership, locked access, secrets, or continuity facts without Director approval.\nIf you do not know something, say so or ask a brief question instead of inventing it.";
const DEFAULT_LOCAL_CHAT_MODEL_ID: &str = "qwen3-0.6b-q8_0";
const LOCAL_MODEL_SERVER_HOST: &str = "127.0.0.1";
const LOCAL_MODEL_SERVER_START_TIMEOUT_MS: u64 = 45_000;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopContext {
    current_time_unix_ms: u128,
    focused_app_name: String,
    focused_window_title: String,
    focused_process_id: Option<u32>,
    is_fullscreen_or_borderless: bool,
    foreground_app_awareness_enabled: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimePermissionState {
    microphone_enabled: bool,
    image_vision_user_upload_only: bool,
    shell_enabled: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowModeState {
    mode: String,
    pass_through_by_default: bool,
    always_on_top_requested: bool,
    fullscreen_avoidance_enabled: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SecretStoreState {
    key_name: String,
    exists: bool,
    preview: String,
    storage: String,
    status: String,
    format: String,
}

#[derive(serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CloudHttpRequestDto {
    endpoint: String,
    request_id: Option<String>,
    purpose: Option<String>,
    turn_id: Option<String>,
    secret_ref: Option<String>,
    auth_mode: Option<String>,
    custom_auth_header: Option<String>,
    organization_id: Option<String>,
    project_id: Option<String>,
    timeout_ms: Option<u64>,
    body: Option<serde_json::Value>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CloudTransportErrorDto {
    code: String,
    message: String,
    next_step: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CloudHttpResponseDto {
    ok: bool,
    status: u16,
    content_type: String,
    body_text: String,
    request_id: Option<String>,
    purpose: Option<String>,
    turn_id: Option<String>,
    transport_error: Option<CloudTransportErrorDto>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct CloudTtsResponseDto {
    ok: bool,
    status: u16,
    content_type: String,
    body_text: String,
    body_base64: String,
    request_id: Option<String>,
    purpose: Option<String>,
    turn_id: Option<String>,
    transport_error: Option<CloudTransportErrorDto>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CharacterPackManifestDto {
    id: String,
    name: String,
    description: Option<String>,
    language: String,
    default_render: String,
    prompt_path: String,
    prompt_text: String,
    voice_path: String,
    subtitle_path: String,
    memory_namespace: String,
    supported_asset_formats: Vec<String>,
    emotions: std::collections::BTreeMap<String, String>,
    voice_config: Option<CharacterPackVoiceConfigDto>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct CharacterPackVoiceConfigDto {
    preferred_backend: Option<String>,
    windows_voice: Option<String>,
    cloud_voice: Option<String>,
    language: Option<String>,
    subtitle_language: Option<String>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct CharacterPackSummaryDto {
    id: String,
    name: String,
    status: String,
    detail: String,
    supported_formats: Vec<String>,
    source: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImportedAssetCandidateDto {
    src: Option<String>,
    text: Option<String>,
    format: String,
    animated: bool,
    kind: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImportedAssetGroupDto {
    folder: String,
    candidates: Vec<ImportedAssetCandidateDto>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ImportedCharacterPackDto {
    manifest: CharacterPackManifestDto,
    summary: CharacterPackSummaryDto,
    assets: Vec<ImportedAssetGroupDto>,
    warnings: Vec<String>,
    errors: Vec<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CharacterAssetDraftDto {
    slot: String,
    source_path: String,
    action: Option<String>,
    source_data_url: Option<String>,
    file_name: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCharacterPackRequestDto {
    id: String,
    name: String,
    description: String,
    language: String,
    prompt_text: String,
    voice_id: String,
    voice_hint: String,
    assets: Vec<CharacterAssetDraftDto>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct SaveCharacterPackDraftRequestDto {
    source_pack_id: Option<String>,
    id: String,
    name: String,
    description: String,
    language: String,
    prompt_text: String,
    voice_id: String,
    voice_hint: String,
    assets: Vec<CharacterAssetDraftDto>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DeletedCharacterPackDto {
    pack_id: String,
    deleted_path: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct VoiceModelDownloadStateDto {
    model_id: String,
    file_name: String,
    state: String,
    progress: f32,
    downloaded_bytes: u64,
    total_bytes: u64,
    expected_sha256: String,
    local_path: String,
    last_error: Option<String>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TtsVoiceInfoDto {
    id: String,
    name: String,
    locale: String,
    backend: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct VoiceServiceStateDto {
    stt_status: String,
    tts_status: String,
    stt_backend: String,
    preferred_tts_backend: String,
    active_tts_backend: String,
    permission_state: String,
    model: VoiceModelDownloadStateDto,
    available_voices: Vec<TtsVoiceInfoDto>,
    selected_voice_id: Option<String>,
    microphone_mode: String,
    tts_enabled: bool,
    tts_language: String,
    subtitle_language: String,
    echo_cancellation_enabled: bool,
    room_tts_policy: String,
    last_message: String,
    last_transcription: String,
    last_synthesis_message: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct TtsRequestDto {
    text: String,
    language: String,
    preferred_voice_id: Option<String>,
    backend: Option<String>,
    allow_cloud: bool,
    room_mode: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TtsResultDto {
    ok: bool,
    backend: String,
    voice_id: Option<String>,
    message: String,
    audio_path: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct SttResultDto {
    ok: bool,
    text: String,
    backend: String,
    model_id: String,
    message: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LocalModelManifestDto {
    id: String,
    display_name: String,
    file_name: String,
    sha256: String,
    license: String,
    license_path: String,
    size_bytes: u64,
    quantization: String,
    context_tokens: u32,
    recommended_threads: u32,
    min_memory_mb: u32,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LocalModelRuntimeStateDto {
    enabled: bool,
    state: String,
    selected_model_id: Option<String>,
    model_id: Option<String>,
    available_models: Vec<LocalModelManifestDto>,
    install_state: String,
    runner_version: Option<String>,
    runtime_mode: Option<String>,
    server_pid: Option<u32>,
    server_port: Option<u16>,
    server_health: Option<String>,
    manifest: Option<LocalModelManifestDto>,
    last_error: Option<String>,
    last_verified_at: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct LocalModelChatRequestDto {
    model_id: Option<String>,
    system_prompt: String,
    prompt: String,
    max_tokens: u32,
    temperature: f32,
    stop: Vec<String>,
    timeout_ms: u64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalModelChatResultDto {
    text: String,
    tokens: u32,
    elapsed_ms: u128,
    model_id: String,
    finish_reason: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PackValidationIssueDto {
    severity: String,
    path: String,
    message: String,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PackValidationAssetDto {
    folder: String,
    file_name: String,
    format: String,
    animated: bool,
    size_bytes: u64,
    warning: Option<String>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PackValidationPreviewDto {
    idle_count: usize,
    emotion_folders: Vec<String>,
    prompt_path: Option<String>,
    voice_path: Option<String>,
    subtitle_path: Option<String>,
    memory_namespace: Option<String>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct PackValidationReportDto {
    source_path: String,
    manifest_id: Option<String>,
    manifest_name: Option<String>,
    checked_at: String,
    status: String,
    errors: Vec<String>,
    warnings: Vec<String>,
    issues: Vec<PackValidationIssueDto>,
    assets: Vec<PackValidationAssetDto>,
    preview: PackValidationPreviewDto,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ReleaseCheckedItemDto {
    name: String,
    status: String,
    detail: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ReleasePackageSummaryDto {
    files: usize,
    bytes: u64,
    includes_rust_toolchain: bool,
    includes_runtime_cache: bool,
    includes_secrets: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct ReleaseReadinessReportDto {
    generated_at: String,
    staging_path: String,
    status: String,
    checked_items: Vec<ReleaseCheckedItemDto>,
    forbidden_findings: Vec<String>,
    missing_items: Vec<String>,
    package_summary: ReleasePackageSummaryDto,
}

#[tauri::command]
fn get_desktop_context() -> DesktopContext {
    let current_time_unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let foreground = read_foreground_window_context();

    DesktopContext {
        current_time_unix_ms,
        focused_app_name: foreground.app_name,
        focused_window_title: foreground.window_title,
        focused_process_id: foreground.process_id,
        is_fullscreen_or_borderless: foreground.is_fullscreen_or_borderless,
        foreground_app_awareness_enabled: true,
    }
}

#[tauri::command]
fn get_current_time_unix_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[tauri::command]
fn get_runtime_permission_state() -> RuntimePermissionState {
    RuntimePermissionState {
        microphone_enabled: false,
        image_vision_user_upload_only: true,
        shell_enabled: false,
    }
}

#[tauri::command]
fn get_window_mode_state() -> WindowModeState {
    WindowModeState {
        mode: "pass_through".to_string(),
        pass_through_by_default: true,
        always_on_top_requested: true,
        fullscreen_avoidance_enabled: true,
    }
}

#[tauri::command]
fn save_api_secret(app: AppHandle, key_name: String, secret: String) -> Result<SecretStoreState, String> {
    let safe_name = validate_secret_name(&key_name)?;
    write_secret(&app, &safe_name, &secret)
}

#[tauri::command]
fn read_api_secret(app: AppHandle, key_name: String) -> Result<Option<String>, String> {
    let safe_name = validate_secret_name(&key_name)?;
    read_secret(&app, &safe_name).map(|result| result.map(|item| item.value))
}

#[tauri::command]
fn delete_api_secret(app: AppHandle, key_name: String) -> Result<(), String> {
    let safe_name = validate_secret_name(&key_name)?;
    let path = secret_file_path(&app, &safe_name)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn has_api_secret(app: AppHandle, key_name: String) -> Result<SecretStoreState, String> {
    let safe_name = validate_secret_name(&key_name)?;
    let path = secret_file_path(&app, &safe_name)?;
    if !path.exists() {
        return Ok(secret_store_state(&safe_name, false, "", "missing", "missing"));
    }
    match read_secret(&app, &safe_name) {
        Ok(Some(result)) => Ok(secret_store_state(
            &safe_name,
            true,
            &mask_secret(&result.value),
            result.status_code(),
            result.format.code(),
        )),
        Ok(None) => Ok(secret_store_state(&safe_name, false, "", "missing", "missing")),
        Err(_) => Ok(secret_store_state(&safe_name, true, "", "read_error", "unknown")),
    }
}

fn secret_store_state(key_name: &str, exists: bool, preview: &str, status: &str, format: &str) -> SecretStoreState {
    SecretStoreState {
        key_name: key_name.to_string(),
        exists,
        preview: preview.to_string(),
        storage: secret_storage_label(),
        status: status.to_string(),
        format: format.to_string(),
    }
}

struct SecretReadResult {
    value: String,
    format: SecretProtectionFormat,
}

impl SecretReadResult {
    fn status_code(&self) -> &'static str {
        match self.format {
            SecretProtectionFormat::Dpapi => "compatible_decode_ok",
            SecretProtectionFormat::LegacyXor => "legacy_xor",
            SecretProtectionFormat::LegacyPlain => "legacy_plain",
        }
    }
}

fn write_secret(app: &AppHandle, key_name: &str, secret: &str) -> Result<SecretStoreState, String> {
    let trimmed = secret.trim();
    if trimmed.is_empty() {
        let path = secret_file_path(app, key_name)?;
        if path.exists() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
        return Ok(secret_store_state(key_name, false, "", "deleted", "missing"));
    }

    let protected = protect_secret(trimmed.as_bytes())?;
    let path = secret_file_path(app, key_name)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(&path, protected).map_err(|error| error.to_string())?;
    Ok(secret_store_state(
        key_name,
        true,
        &mask_secret(trimmed),
        "saved",
        current_secret_format_code(),
    ))
}

fn read_secret(app: &AppHandle, key_name: &str) -> Result<Option<SecretReadResult>, String> {
    let path = secret_file_path(app, key_name)?;
    if !path.exists() {
        return Ok(None);
    }

    let protected = fs::read(&path).map_err(|error| error.to_string())?;
    let plain = unprotect_secret_compat(&protected)?;
    if matches!(plain.format, SecretProtectionFormat::LegacyXor | SecretProtectionFormat::LegacyPlain) {
        let migrated = protect_secret(&plain.bytes)?;
        fs::write(&path, migrated).map_err(|error| error.to_string())?;
    }
    let value = String::from_utf8(plain.bytes).map_err(|_| "SecretStore contained invalid UTF-8".to_string())?;
    Ok(Some(SecretReadResult {
        value,
        format: plain.format,
    }))
}

#[tauri::command]
async fn cloud_chat_request(app: AppHandle, request: CloudHttpRequestDto) -> Result<CloudHttpResponseDto, String> {
    perform_cloud_json_request(&app, request, "POST").await
}

#[tauri::command]
async fn cloud_vision_request(app: AppHandle, request: CloudHttpRequestDto) -> Result<CloudHttpResponseDto, String> {
    perform_cloud_json_request(&app, request, "POST").await
}

#[tauri::command]
async fn cloud_endpoint_test(app: AppHandle, request: CloudHttpRequestDto) -> Result<CloudHttpResponseDto, String> {
    perform_cloud_json_request(&app, request, "POST").await
}

#[tauri::command]
async fn cloud_tts_request(app: AppHandle, request: CloudHttpRequestDto) -> Result<CloudTtsResponseDto, String> {
    let request_id = request.request_id.clone();
    let purpose = request.purpose.clone();
    let turn_id = request.turn_id.clone();
    let endpoint = validate_cloud_endpoint(&request.endpoint)?;
    let client = build_cloud_client(request.timeout_ms)?;
    let headers = build_cloud_headers(&app, &request, true)?;
    let body = request.body.unwrap_or_else(|| serde_json::json!({}));

    let response = match client.post(endpoint).headers(headers).json(&body).send().await {
        Ok(response) => response,
        Err(error) => {
            return Ok(CloudTtsResponseDto {
                ok: false,
                status: 0,
                content_type: String::new(),
                body_text: String::new(),
                body_base64: String::new(),
                request_id,
                purpose,
                turn_id,
                transport_error: Some(cloud_transport_error_readable(error)),
            });
        }
    };

    let status = response.status().as_u16();
    let ok = response.status().is_success();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();

    if ok {
        let bytes = response.bytes().await.map_err(|error| error.to_string())?;
        return Ok(CloudTtsResponseDto {
            ok,
            status,
            content_type,
            body_text: String::new(),
            body_base64: general_purpose::STANDARD.encode(bytes),
            request_id,
            purpose,
            turn_id,
            transport_error: None,
        });
    }

    let body_text = response.text().await.unwrap_or_default();
    Ok(CloudTtsResponseDto {
        ok,
        status,
        content_type,
        body_text: body_text.chars().take(2000).collect(),
        body_base64: String::new(),
        request_id,
        purpose,
        turn_id,
        transport_error: None,
    })
}

async fn perform_cloud_json_request(
    app: &AppHandle,
    request: CloudHttpRequestDto,
    method: &str,
) -> Result<CloudHttpResponseDto, String> {
    let request_id = request.request_id.clone();
    let purpose = request.purpose.clone();
    let turn_id = request.turn_id.clone();
    let endpoint = validate_cloud_endpoint(&request.endpoint)?;
    let client = build_cloud_client(request.timeout_ms)?;
    let headers = build_cloud_headers(app, &request, method != "GET")?;
    let send_result = if method == "GET" {
        client.get(endpoint).headers(headers).send().await
    } else {
        let body = request.body.unwrap_or_else(|| serde_json::json!({}));
        client.post(endpoint).headers(headers).json(&body).send().await
    };

    let response = match send_result {
        Ok(response) => response,
        Err(error) => {
            return Ok(CloudHttpResponseDto {
                ok: false,
                status: 0,
                content_type: String::new(),
                body_text: String::new(),
                request_id,
                purpose,
                turn_id,
                transport_error: Some(cloud_transport_error_readable(error)),
            });
        }
    };

    let status = response.status().as_u16();
    let ok = response.status().is_success();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or("")
        .to_string();
    let body_text = response.text().await.unwrap_or_default();

    Ok(CloudHttpResponseDto {
        ok,
        status,
        content_type,
        body_text: body_text.chars().take(64 * 1024).collect(),
        request_id,
        purpose,
        turn_id,
        transport_error: None,
    })
}

fn build_cloud_client(timeout_ms: Option<u64>) -> Result<Client, String> {
    let timeout = Duration::from_millis(timeout_ms.unwrap_or(60_000).clamp(5_000, 120_000));
    Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| error.to_string())
}

fn build_cloud_headers(
    app: &AppHandle,
    request: &CloudHttpRequestDto,
    include_content_type: bool,
) -> Result<HeaderMap, String> {
    let mut headers = HeaderMap::new();
    if include_content_type {
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    }

    let api_key = read_cloud_secret(app, request)?;
    let auth_mode = request.auth_mode.as_deref().unwrap_or("bearer");
    if !api_key.is_empty() {
        if auth_mode == "x_api_key" {
            headers.insert(
                HeaderName::from_static("x-api-key"),
                HeaderValue::from_str(&api_key).map_err(|_| "API key contains invalid header characters.".to_string())?,
            );
        } else if auth_mode == "custom_header" {
            let name = request
                .custom_auth_header
                .as_deref()
                .unwrap_or("Authorization")
                .trim();
            let header_name = HeaderName::from_bytes(name.as_bytes())
                .map_err(|_| "Custom auth header name is invalid.".to_string())?;
            headers.insert(
                header_name,
                HeaderValue::from_str(&api_key).map_err(|_| "API key contains invalid header characters.".to_string())?,
            );
        } else if auth_mode != "none" {
            let value = format!("Bearer {api_key}");
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&value).map_err(|_| "API key contains invalid header characters.".to_string())?,
            );
        }
    }

    if let Some(org) = request.organization_id.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        headers.insert(
            HeaderName::from_static("openai-organization"),
            HeaderValue::from_str(org).map_err(|_| "Organization ID contains invalid header characters.".to_string())?,
        );
    }
    if let Some(project) = request.project_id.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        headers.insert(
            HeaderName::from_static("openai-project"),
            HeaderValue::from_str(project).map_err(|_| "Project ID contains invalid header characters.".to_string())?,
        );
    }

    Ok(headers)
}

fn read_cloud_secret(app: &AppHandle, request: &CloudHttpRequestDto) -> Result<String, String> {
    if request.auth_mode.as_deref() == Some("none") {
        return Ok(String::new());
    }
    let Some(secret_ref) = request.secret_ref.as_deref().map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(String::new());
    };
    let safe_name = validate_secret_name(secret_ref)?;
    Ok(read_secret(app, &safe_name)?.map(|item| item.value).unwrap_or_default())
}

fn validate_cloud_endpoint(value: &str) -> Result<String, String> {
    let endpoint = value.trim();
    if endpoint.is_empty() {
        return Err("Cloud AI endpoint is empty.".to_string());
    }
    if !(endpoint.starts_with("https://") || endpoint.starts_with("http://")) {
        return Err("Cloud AI endpoint must start with http:// or https://.".to_string());
    }
    Ok(endpoint.to_string())
}

fn cloud_transport_error_readable(error: reqwest::Error) -> CloudTransportErrorDto {
    if error.is_timeout() {
        return CloudTransportErrorDto {
            code: "timeout".to_string(),
            message: "The AI service response timed out.".to_string(),
            next_step: "Check the API URL, model name, network connection, proxy, and service status.".to_string(),
        };
    }
    if error.is_connect() {
        return CloudTransportErrorDto {
            code: "network".to_string(),
            message: "Could not connect to the AI service.".to_string(),
            next_step: "Check the API URL, network connection, proxy, firewall, and service status.".to_string(),
        };
    }
    if error.is_request() {
        return CloudTransportErrorDto {
            code: "network".to_string(),
            message: "The AI service request could not be sent.".to_string(),
            next_step: "Check the API URL format and request compatibility for this service.".to_string(),
        };
    }
    CloudTransportErrorDto {
        code: "network".to_string(),
        message: "The AI service connection failed.".to_string(),
        next_step: "Check the API URL, network connection, proxy, TLS settings, and service status.".to_string(),
    }
}

#[allow(dead_code)]
fn cloud_transport_error(error: reqwest::Error) -> CloudTransportErrorDto {
    cloud_transport_error_readable(error)
}

#[tauri::command]
fn import_character_pack_from_path(app: AppHandle, source_path: String) -> Result<ImportedCharacterPackDto, String> {
    let source_dir = canonicalize_existing_directory(&source_path, "Character pack source path")?;
    let pack = read_character_pack(&source_dir)?;
    if !pack.errors.is_empty() {
        return Ok(pack);
    }

    let target_dir = imported_pack_dir(&app)?.join(&pack.manifest.id);
    if let Some(parent) = target_dir.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir).map_err(|error| error.to_string())?;
    }
    copy_dir_recursive(&source_dir, &target_dir)?;
    remove_character_pack_private_dirs(&target_dir)?;
    read_character_pack(&target_dir)
}

#[tauri::command]
fn create_character_pack(app: AppHandle, request: CreateCharacterPackRequestDto) -> Result<ImportedCharacterPackDto, String> {
    let root = imported_pack_dir(&app)?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let pack_id = unique_pack_id(&root, &safe_pack_id(&request.id), None);
    let target_dir = root.join(pack_id);
    write_character_pack_draft(&target_dir, &request.name, &request.description, &request.language, &request.prompt_text, &request.voice_id, &request.voice_hint, &request.assets)?;
    read_character_pack(&target_dir)
}

#[tauri::command]
fn duplicate_character_pack(app: AppHandle, pack_id: String, new_name: Option<String>) -> Result<ImportedCharacterPackDto, String> {
    let root = imported_pack_dir(&app)?;
    let source_dir = resolve_character_pack_source_dir(&app, &pack_id)?;
    let source_pack = read_character_pack(&source_dir)?;
    let base_name = new_name
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("{} Copy", source_pack.manifest.name));
    let target_id = unique_pack_id(&root, &safe_pack_id(&base_name), None);
    let target_dir = root.join(&target_id);
    copy_dir_recursive(&source_dir, &target_dir)?;
    remove_character_pack_private_dirs(&target_dir)?;
    let mut pack = read_character_pack(&target_dir)?;
    write_character_pack_draft(
        &target_dir,
        &base_name,
        pack.manifest.description.as_deref().unwrap_or(""),
        &pack.manifest.language,
        &pack.manifest.prompt_text,
        pack.manifest
            .voice_config
            .as_ref()
            .and_then(|config| config.cloud_voice.clone().or_else(|| config.windows_voice.clone()))
            .as_deref()
            .unwrap_or(""),
        pack.manifest
            .voice_config
            .as_ref()
            .and_then(|config| config.language.clone())
            .as_deref()
            .unwrap_or(""),
        &[],
    )?;
    pack = read_character_pack(&target_dir)?;
    Ok(pack)
}

#[tauri::command]
fn save_character_pack_draft(app: AppHandle, request: SaveCharacterPackDraftRequestDto) -> Result<ImportedCharacterPackDto, String> {
    let root = imported_pack_dir(&app)?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let source_id = request
        .source_pack_id
        .as_deref()
        .map(safe_pack_id)
        .filter(|value| !value.is_empty());
    let target_id = if let Some(source_id) = source_id.as_ref() {
        source_id.clone()
    } else {
        unique_pack_id(&root, &safe_pack_id(&request.id), None)
    };
    let target_dir = root.join(&target_id);
    if !target_dir.exists() {
        if let Some(source_id) = source_id.as_ref() {
            let source_dir = resolve_character_pack_source_dir(&app, source_id)?;
            if source_dir != target_dir {
                copy_dir_recursive(&source_dir, &target_dir)?;
                remove_character_pack_private_dirs(&target_dir)?;
            } else {
                fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;
            }
        } else {
            fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;
        }
    }
    write_character_pack_draft(
        &target_dir,
        &request.name,
        &request.description,
        &request.language,
        &request.prompt_text,
        &request.voice_id,
        &request.voice_hint,
        &request.assets,
    )?;
    read_character_pack(&target_dir)
}

#[tauri::command]
fn delete_character_pack(app: AppHandle, pack_id: String) -> Result<DeletedCharacterPackDto, String> {
    let source_id = safe_pack_id(&pack_id);
    let root = imported_pack_dir(&app)?;
    let source_dir = assert_path_inside_root(&root.join(&source_id), &root)?;
    if !source_dir.exists() {
        return Err("Only project character packs can be deleted. Packaged built-in resources are read-only.".to_string());
    }
    delete_character_private_data(&app, &source_id)?;
    remove_character_pack_dir(&source_dir)?;
    Ok(DeletedCharacterPackDto {
        pack_id: source_id,
        deleted_path: String::new(),
    })
}

#[tauri::command]
fn load_character_pack_memory(app: AppHandle, pack_id: String) -> Result<Vec<serde_json::Value>, String> {
    let root = character_pack_memory_root(&app, &pack_id)?;
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    collect_memory_json_files(&root, &mut files)?;
    let mut values = Vec::new();
    for path in files {
        let text = fs::read_to_string(&path).map_err(|error| error.to_string())?;
        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
            values.push(value);
        }
    }
    Ok(values)
}

#[tauri::command]
fn save_character_pack_memory(app: AppHandle, pack_id: String, scope: String, data: serde_json::Value) -> Result<(), String> {
    let root = character_pack_memory_root(&app, &pack_id)?;
    let path = character_pack_memory_file_path(&root, &safe_pack_id(&pack_id), &scope)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let text = serde_json::to_string_pretty(&data).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| error.to_string())
}

#[tauri::command]
fn list_character_pack_memory_files(app: AppHandle, pack_id: String) -> Result<Vec<String>, String> {
    let root = character_pack_memory_root(&app, &pack_id)?;
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut files = Vec::new();
    collect_memory_json_files(&root, &mut files)?;
    Ok(files
        .into_iter()
        .filter_map(|path| path.strip_prefix(&root).ok().map(|relative| relative.to_string_lossy().replace('\\', "/")))
        .collect())
}

#[tauri::command]
fn load_character_chat_history(app: AppHandle, pack_id: String) -> Result<serde_json::Value, String> {
    let source_id = safe_pack_id(&pack_id);
    let path = character_pack_history_file_path(&app, &source_id, false)?;
    if !path.exists() {
        return Ok(serde_json::json!({
            "packId": source_id,
            "schemaVersion": 1,
            "directRoomId": format!("dm:{}", source_id),
            "messages": [],
            "updatedAt": current_unix_ms_string()
        }));
    }
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str::<serde_json::Value>(&text).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_character_chat_history(app: AppHandle, pack_id: String, data: serde_json::Value) -> Result<(), String> {
    let source_id = safe_pack_id(&pack_id);
    let path = character_pack_history_file_path(&app, &source_id, true)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let text = serde_json::to_string_pretty(&data).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| error.to_string())
}

#[tauri::command]
fn move_character_chat_history_to_deleted(app: AppHandle, pack_id: String) -> Result<(), String> {
    let source_id = safe_pack_id(&pack_id);
    let history_dir = character_pack_history_dir(&app, &source_id, false)?;
    if !history_dir.exists() {
        return Ok(());
    }
    let deleted_root = deleted_pack_dir(&app)?;
    fs::create_dir_all(&deleted_root).map_err(|error| error.to_string())?;
    let target_dir = deleted_root.join(format!("{}-history-{}", source_id, current_unix_ms_string()));
    move_character_pack_to_deleted(&history_dir, &target_dir)
}

#[tauri::command]
fn load_direct_room_history(app: AppHandle, pack_id: String) -> Result<serde_json::Value, String> {
    let source_id = safe_pack_id(&pack_id);
    let path = direct_room_history_file_path(&app, &source_id, false)?;
    let messages = if path.exists() {
        read_jsonl_messages(&path)?
    } else {
        Vec::new()
    };
    Ok(serde_json::json!({
        "packId": source_id,
        "schemaVersion": 1,
        "directRoomId": format!("dm:{}", source_id),
        "messages": messages,
        "updatedAt": current_unix_ms_string()
    }))
}

#[tauri::command]
fn append_direct_room_message(app: AppHandle, pack_id: String, message: serde_json::Value) -> Result<(), String> {
    let source_id = safe_pack_id(&pack_id);
    let path = direct_room_history_file_path(&app, &source_id, true)?;
    append_jsonl_message(&path, &message)
}

#[tauri::command]
fn rewrite_direct_room_history(app: AppHandle, pack_id: String, messages: Vec<serde_json::Value>) -> Result<(), String> {
    let source_id = safe_pack_id(&pack_id);
    let path = direct_room_history_file_path(&app, &source_id, true)?;
    write_jsonl_messages(&path, &messages)
}

#[tauri::command]
fn load_memory_scope(app: AppHandle, scope: String) -> Result<serde_json::Value, String> {
    let path = memory_scope_file_path(&app, &scope, false)?;
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str::<serde_json::Value>(&text).map_err(|error| error.to_string())
}

#[tauri::command]
fn save_memory_scope(app: AppHandle, scope: String, data: serde_json::Value) -> Result<(), String> {
    let path = memory_scope_file_path(&app, &scope, true)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let text = serde_json::to_string_pretty(&data).map_err(|error| error.to_string())?;
    fs::write(path, text).map_err(|error| error.to_string())
}

#[tauri::command]
fn memory_graph_migrate(app: AppHandle) -> Result<(), String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)
}

#[tauri::command]
fn memory_graph_upsert_node(app: AppHandle, node: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    upsert_memory_graph_node(&connection, &node)
}

#[tauri::command]
fn memory_graph_merge_claim(app: AppHandle, claim: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    let tx = connection.transaction().map_err(|error| error.to_string())?;
    let merged = merge_memory_graph_claim(&tx, &claim)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(merged)
}

#[tauri::command]
fn memory_graph_query_visible_claims(app: AppHandle, context: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    query_memory_graph_visible_claims(&connection, &context)
}

#[tauri::command]
fn memory_graph_query_view(app: AppHandle, context: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    query_memory_graph_view(&connection, &context)
}

#[tauri::command]
fn memory_graph_query_issues(app: AppHandle, context: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    query_memory_graph_issues(&connection, &context)
}

#[tauri::command]
fn memory_graph_query_neighbors(app: AppHandle, context: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    let mut next_context = context.clone();
    if let Some(node_id) = memory_graph_json_optional_string(&context, "nodeId") {
        next_context["expandedNodeIds"] = serde_json::json!([node_id]);
    }
    query_memory_graph_view(&connection, &next_context)
}

#[tauri::command]
fn memory_graph_update_claim(app: AppHandle, patch: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    let tx = connection.transaction().map_err(|error| error.to_string())?;
    let updated = update_memory_graph_claim(&tx, &patch)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(updated)
}

#[tauri::command]
fn memory_graph_update_visibility(app: AppHandle, input: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    let tx = connection.transaction().map_err(|error| error.to_string())?;
    let updated = update_memory_graph_visibility(&tx, &input)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(updated)
}

#[tauri::command]
fn memory_graph_create_claim(app: AppHandle, claim: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    let tx = connection.transaction().map_err(|error| error.to_string())?;
    let created = merge_memory_graph_claim(&tx, &claim)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(created)
}

#[tauri::command]
fn memory_graph_merge_claims(app: AppHandle, input: serde_json::Value) -> Result<serde_json::Value, String> {
    let mut connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    let tx = connection.transaction().map_err(|error| error.to_string())?;
    let merged = merge_memory_graph_duplicate_claims(&tx, &input)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(merged)
}

#[tauri::command]
fn memory_graph_archive_claim(app: AppHandle, claim_id: String) -> Result<(), String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    set_memory_graph_claim_status(&connection, &claim_id, "archived", "archive")
}

#[tauri::command]
fn memory_graph_delete_claim(app: AppHandle, claim_id: String) -> Result<(), String> {
    let mut connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    let tx = connection.transaction().map_err(|error| error.to_string())?;
    delete_memory_graph_claim(&tx, &claim_id)?;
    tx.commit().map_err(|error| error.to_string())
}

#[tauri::command]
fn memory_graph_create_edge(app: AppHandle, edge: serde_json::Value) -> Result<serde_json::Value, String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    create_memory_graph_edge(&connection, &edge)
}

#[tauri::command]
fn memory_graph_delete_edge(app: AppHandle, edge_id: String) -> Result<(), String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    connection
        .execute("DELETE FROM memory_edges WHERE id = ?1", params![edge_id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn memory_graph_query_conflicts(app: AppHandle, scope: String, claim_id: String) -> Result<serde_json::Value, String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    query_memory_graph_conflicts(&connection, &scope, &claim_id)
}

#[tauri::command]
fn memory_graph_mark_disputed(app: AppHandle, claim_ids: Vec<String>, reason: String) -> Result<(), String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    for claim_id in claim_ids {
        set_memory_graph_claim_status(&connection, &claim_id, "disputed", &reason)?;
    }
    Ok(())
}

#[tauri::command]
fn memory_graph_resolve_conflict(app: AppHandle, input: serde_json::Value) -> Result<(), String> {
    let mut connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    let tx = connection.transaction().map_err(|error| error.to_string())?;
    resolve_memory_graph_conflict(&tx, &input)?;
    tx.commit().map_err(|error| error.to_string())
}

#[tauri::command]
fn memory_graph_delete_scope(app: AppHandle, scope: String) -> Result<(), String> {
    let mut connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    let tx = connection.transaction().map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM memory_versions WHERE claim_id IN (SELECT id FROM memory_claims WHERE scope = ?1)", params![scope])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM memory_visibility WHERE claim_id IN (SELECT id FROM memory_claims WHERE scope = ?1)", params![scope])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM memory_sources WHERE claim_id IN (SELECT id FROM memory_claims WHERE scope = ?1)", params![scope])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM memory_edges WHERE scope = ?1", params![scope])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM memory_claims WHERE scope = ?1", params![scope])
        .map_err(|error| error.to_string())?;
    tx.execute("DELETE FROM memory_nodes WHERE scope = ?1", params![scope])
        .map_err(|error| error.to_string())?;
    tx.commit().map_err(|error| error.to_string())
}

#[tauri::command]
fn memory_graph_export_neo4j(app: AppHandle, scope: Option<String>) -> Result<serde_json::Value, String> {
    let connection = open_memory_graph_connection(&app)?;
    migrate_memory_graph(&connection)?;
    export_memory_graph_neo4j(&connection, scope.as_deref())
}

#[tauri::command]
fn load_prompt_presets(app: AppHandle) -> Result<serde_json::Value, String> {
    let path = prompt_presets_file_path(&app, false)?;
    if !path.exists() {
        return Ok(serde_json::json!([]));
    }
    ensure_file_size(&path, MAX_PROMPT_PRESETS_BYTES, "Prompt presets")?;
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let value = serde_json::from_str::<serde_json::Value>(&text).map_err(|error| error.to_string())?;
    validate_prompt_preset_payload(&value)?;
    Ok(value)
}

#[tauri::command]
fn save_prompt_presets(app: AppHandle, presets: serde_json::Value) -> Result<(), String> {
    validate_prompt_preset_payload(&presets)?;
    let path = prompt_presets_file_path(&app, true)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let text = serde_json::to_string_pretty(&presets).map_err(|error| error.to_string())?;
    if text.len() as u64 > MAX_PROMPT_PRESETS_BYTES {
        return Err("Prompt preset library is too large.".to_string());
    }
    fs::write(path, text).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_prompt_pack_from_path(_app: AppHandle, source_path: String) -> Result<serde_json::Value, String> {
    let path = prompt_pack_source_file_path(&source_path)?;
    ensure_file_size(&path, MAX_PROMPT_PRESETS_BYTES, "Prompt pack")?;
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let value = serde_json::from_str::<serde_json::Value>(&text).map_err(|error| error.to_string())?;
    validate_prompt_preset_payload(&value)?;
    if let Some(presets) = value.get("presets") {
        validate_prompt_preset_payload(presets)?;
        return Ok(presets.clone());
    }
    Ok(value)
}

#[tauri::command]
fn list_deleted_character_packs(app: AppHandle) -> Result<Vec<DeletedCharacterPackDto>, String> {
    let root = deleted_pack_dir(&app)?;
    if !root.exists() {
        return Ok(Vec::new());
    }
    let mut packs = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            let pack_id = name.rsplit_once('-').map(|(id, _)| id).unwrap_or(&name).to_string();
            packs.push(DeletedCharacterPackDto {
                pack_id,
                deleted_path: entry.path().to_string_lossy().to_string(),
            });
        }
    }
    Ok(packs)
}

#[tauri::command]
fn restore_deleted_character_pack(app: AppHandle, deleted_path: String) -> Result<ImportedCharacterPackDto, String> {
    let deleted_root = deleted_pack_dir(&app)?;
    fs::create_dir_all(&deleted_root).map_err(|error| error.to_string())?;
    let source_dir = assert_path_under_root(&deleted_root, &deleted_path, "Deleted character folder")?;
    if !source_dir.exists() {
        return Err("Deleted character folder was not found.".to_string());
    }
    let root = imported_pack_dir(&app)?;
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    let pack = read_character_pack(&source_dir)?;
    let target_id = unique_pack_id(&root, &safe_pack_id(&pack.manifest.id), None);
    let target_dir = root.join(target_id);
    fs::rename(&source_dir, &target_dir).map_err(|error| error.to_string())?;
    read_character_pack(&target_dir)
}

#[tauri::command]
fn list_imported_character_packs(app: AppHandle) -> Result<Vec<ImportedCharacterPackDto>, String> {
    let root = imported_pack_dir(&app)?;
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut packs = Vec::new();
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            packs.push(read_character_pack(&entry.path())?);
        }
    }
    Ok(packs)
}

#[tauri::command]
fn pack_validate_path(source_path: String) -> Result<PackValidationReportDto, String> {
    let root = canonicalize_existing_directory(&source_path, "Character pack source path")?;
    let checked_at = current_unix_ms_string();
    let pack = read_character_pack(&root)?;
    let assets = pack
        .assets
        .iter()
        .flat_map(|group| {
            group.candidates.iter().map(|candidate| PackValidationAssetDto {
                folder: group.folder.clone(),
                file_name: PathBuf::from(candidate.src.as_deref().unwrap_or(""))
                    .file_name()
                    .and_then(|value| value.to_str())
                    .unwrap_or_else(|| if candidate.kind == "text" { "text" } else { "" })
                    .to_string(),
                format: candidate.format.clone(),
                animated: candidate.animated,
                size_bytes: candidate
                    .src
                    .as_deref()
                    .and_then(|src| fs::metadata(src).ok())
                    .map(|meta| meta.len())
                    .unwrap_or(0),
                warning: if candidate.format == "jpg" || candidate.format == "jpeg" {
                    Some("JPG/JPEG has no alpha channel.".to_string())
                } else if candidate.format == "gif" && candidate.animated {
                    Some("Large GIF may hurt UI responsiveness.".to_string())
                } else if candidate.format == "ansi" {
                    Some("ANSI character art is displayed as plain text; colors are not parsed in this version.".to_string())
                } else {
                    None
                },
            })
        })
        .collect::<Vec<_>>();
    let issues = pack
        .errors
        .iter()
        .map(|message| PackValidationIssueDto {
            severity: "error".to_string(),
            path: root.to_string_lossy().to_string(),
            message: message.clone(),
        })
        .chain(pack.warnings.iter().map(|message| PackValidationIssueDto {
            severity: "warning".to_string(),
            path: root.to_string_lossy().to_string(),
            message: message.clone(),
        }))
        .collect::<Vec<_>>();
    Ok(PackValidationReportDto {
        source_path: root.to_string_lossy().to_string(),
        manifest_id: Some(pack.manifest.id),
        manifest_name: Some(pack.manifest.name),
        checked_at,
        status: if pack.errors.is_empty() { "ready".to_string() } else { "error".to_string() },
        errors: pack.errors,
        warnings: pack.warnings,
        issues,
        assets,
        preview: PackValidationPreviewDto {
            idle_count: pack
                .assets
                .iter()
                .find(|group| group.folder == "idle")
                .map(|group| group.candidates.len())
                .unwrap_or(0),
            emotion_folders: pack
                .assets
                .iter()
                .filter(|group| group.folder.starts_with("emotions/"))
                .map(|group| group.folder.clone())
                .collect(),
            prompt_path: Some(pack.manifest.prompt_path),
            voice_path: Some(pack.manifest.voice_path),
            subtitle_path: Some(pack.manifest.subtitle_path),
            memory_namespace: Some(pack.manifest.memory_namespace),
        },
    })
}

#[tauri::command]
fn release_scan_staging(staging_path: String) -> Result<ReleaseReadinessReportDto, String> {
    let root = PathBuf::from(staging_path.trim());
    let mut files = 0usize;
    let mut bytes = 0u64;
    let mut forbidden_findings = Vec::new();
    if root.exists() {
        scan_release_dir(&root, &mut files, &mut bytes, &mut forbidden_findings)?;
    }
    let missing_items = if root.exists() {
        Vec::new()
    } else {
        vec!["Staging folder was not found.".to_string()]
    };
    Ok(ReleaseReadinessReportDto {
        generated_at: current_unix_ms_string(),
        staging_path: root.to_string_lossy().to_string(),
        status: if missing_items.is_empty() && forbidden_findings.is_empty() {
            "ready".to_string()
        } else {
            "needs_attention".to_string()
        },
        checked_items: vec![
            ReleaseCheckedItemDto {
                name: "Local chat model".to_string(),
                status: "checked".to_string(),
                detail: "resources/models/chat is allowed for test builds.".to_string(),
            },
            ReleaseCheckedItemDto {
                name: "Sensitive files".to_string(),
                status: if forbidden_findings.is_empty() { "clear".to_string() } else { "found".to_string() },
                detail: "API keys, logs, caches, rustc.exe, and cargo.exe should not be staged.".to_string(),
            },
        ],
        forbidden_findings,
        missing_items,
        package_summary: ReleasePackageSummaryDto {
            files,
            bytes,
            includes_rust_toolchain: false,
            includes_runtime_cache: false,
            includes_secrets: false,
        },
    })
}

#[tauri::command]
fn voice_get_state(app: AppHandle) -> Result<VoiceServiceStateDto, String> {
    Ok(default_voice_state(&app)?)
}

#[tauri::command]
fn voice_download_model(app: AppHandle, model_id: String) -> Result<VoiceModelDownloadStateDto, String> {
    let model = normalize_voice_model_id(&model_id)?;
    let path = voice_model_path(&app, &model)?;
    let source_env_name = format!("CMDPET_WHISPER_MODEL_SOURCE_{}", model.to_ascii_uppercase());
    let source_value = std::env::var(&source_env_name)
        .or_else(|_| std::env::var("CMDPET_WHISPER_MODEL_SOURCE"))
        .ok();

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    if let Some(source_value) = source_value {
        let source_path = PathBuf::from(source_value.trim())
            .canonicalize()
            .map_err(|error| format!("Configured whisper.cpp model source is not accessible: {error}"))?;
        if !voice_model_file_is_usable(&source_path) {
            return Ok(VoiceModelDownloadStateDto {
                model_id: model.clone(),
                file_name: format!("ggml-{model}.bin"),
                state: "error".to_string(),
                progress: 0.0,
                downloaded_bytes: 0,
                total_bytes: fs::metadata(&source_path).map(|meta| meta.len()).unwrap_or(0),
                expected_sha256: voice_model_expected_sha256(&model),
                local_path: path.to_string_lossy().to_string(),
                last_error: Some("Configured whisper.cpp model source is missing or too small to be a real ggml model.".to_string()),
            });
        }
        fs::copy(&source_path, &path).map_err(|error| error.to_string())?;
    } else {
        let tmp_path = path.with_extension("bin.download");
        let output = run_command_with_timeout(
            std::process::Command::new("curl.exe")
                .arg("-L")
                .arg("--fail")
                .arg("--output")
                .arg(&tmp_path)
                .arg(voice_model_download_url(&model)),
            Duration::from_secs(900),
        );
        if let Err(message) = output {
            let _ = fs::remove_file(&tmp_path);
            return Ok(VoiceModelDownloadStateDto {
                model_id: model.clone(),
                file_name: format!("ggml-{model}.bin"),
                state: "error".to_string(),
                progress: 0.0,
                downloaded_bytes: fs::metadata(&tmp_path).map(|meta| meta.len()).unwrap_or(0),
                total_bytes: voice_model_expected_size(&model),
                expected_sha256: voice_model_expected_sha256(&model),
                local_path: path.to_string_lossy().to_string(),
                last_error: Some(format!("Could not download whisper.cpp model. {message}")),
            });
        }
        fs::rename(&tmp_path, &path).map_err(|error| error.to_string())?;
    }

    if let Err(message) = verify_voice_model_file(&path, &model) {
        let _ = fs::remove_file(&path);
        return Ok(VoiceModelDownloadStateDto {
            model_id: model.clone(),
            file_name: format!("ggml-{model}.bin"),
            state: "error".to_string(),
            progress: 0.0,
            downloaded_bytes: 0,
            total_bytes: voice_model_expected_size(&model),
            expected_sha256: voice_model_expected_sha256(&model),
            local_path: path.to_string_lossy().to_string(),
            last_error: Some(message),
        });
    }

    let model_size = fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);

    Ok(VoiceModelDownloadStateDto {
        model_id: model.clone(),
        file_name: format!("ggml-{model}.bin"),
        state: "ready".to_string(),
        progress: 1.0,
        downloaded_bytes: model_size,
        total_bytes: model_size,
        expected_sha256: voice_model_expected_sha256(&model),
        local_path: path.to_string_lossy().to_string(),
        last_error: None,
    })
}

#[tauri::command]
fn voice_cancel_model_download(app: AppHandle) -> Result<VoiceModelDownloadStateDto, String> {
    let model = "tiny".to_string();
    Ok(VoiceModelDownloadStateDto {
        model_id: model.clone(),
        file_name: "ggml-tiny.bin".to_string(),
        state: "not_installed".to_string(),
        progress: 0.0,
        downloaded_bytes: 0,
        total_bytes: 0,
        expected_sha256: voice_model_expected_sha256(&model),
        local_path: voice_model_path(&app, &model)?.to_string_lossy().to_string(),
        last_error: Some("Model download was cancelled.".to_string()),
    })
}

#[tauri::command]
fn voice_transcribe_file(app: AppHandle, audio_path: String) -> Result<SttResultDto, String> {
    let audio = PathBuf::from(audio_path.trim());
    if !audio.exists() {
        return Ok(SttResultDto {
            ok: false,
            text: String::new(),
            backend: "whisper_cpp".to_string(),
            model_id: "tiny".to_string(),
            message: "Audio file was not found; text input remains available.".to_string(),
        });
    }

    let model_path = voice_model_path(&app, "tiny")?;
    if !voice_model_file_is_verified(&model_path, "tiny") {
        return Ok(SttResultDto {
            ok: false,
            text: String::new(),
            backend: "whisper_cpp".to_string(),
            model_id: "tiny".to_string(),
            message: "whisper.cpp model is not installed or failed validation; text input remains available.".to_string(),
        });
    }

    let runner = match whisper_runner_path(&app) {
        Ok(path) => path,
        Err(message) => {
            return Ok(SttResultDto {
                ok: false,
                text: String::new(),
                backend: "whisper_cpp".to_string(),
                model_id: "tiny".to_string(),
                message,
            });
        }
    };
    let output = run_command_with_timeout(
        std::process::Command::new(runner)
            .arg("-m")
            .arg(&model_path)
            .arg("-f")
            .arg(&audio)
            .arg("-nt")
            .arg("-np"),
        Duration::from_secs(90),
    );
    let output = match output {
        Ok(output) => output,
        Err(message) => {
            return Ok(SttResultDto {
                ok: false,
                text: String::new(),
                backend: "whisper_cpp".to_string(),
                model_id: "tiny".to_string(),
                message,
            });
        }
    };
    if !output.status.success() {
        return Ok(SttResultDto {
            ok: false,
            text: String::new(),
            backend: "whisper_cpp".to_string(),
            model_id: "tiny".to_string(),
            message: format!("whisper.cpp runner failed: {}", String::from_utf8_lossy(&output.stderr).trim()),
        });
    }
    let text = parse_whisper_output(&String::from_utf8_lossy(&output.stdout));
    if text.is_empty() {
        return Ok(SttResultDto {
            ok: false,
            text,
            backend: "whisper_cpp".to_string(),
            model_id: "tiny".to_string(),
            message: "whisper.cpp returned no transcription text.".to_string(),
        });
    }

    Ok(SttResultDto {
        ok: true,
        text,
        backend: "whisper_cpp".to_string(),
        model_id: "tiny".to_string(),
        message: "Transcription completed with whisper.cpp.".to_string(),
    })
}

#[tauri::command]
fn voice_list_tts_voices() -> Vec<TtsVoiceInfoDto> {
    default_tts_voices()
}

#[tauri::command]
fn voice_synthesize(app: AppHandle, request: TtsRequestDto) -> TtsResultDto {
    if request.room_mode {
        return TtsResultDto {
            ok: false,
            backend: "cloud_tts".to_string(),
            voice_id: None,
            message: "Room mode disables TTS by policy.".to_string(),
            audio_path: None,
        };
    }

    if request.text.trim().is_empty() {
        return TtsResultDto {
            ok: false,
            backend: "cloud_tts".to_string(),
            voice_id: None,
            message: "No TTS text provided.".to_string(),
            audio_path: None,
        };
    }

    let requested_backend = request.backend.as_deref().unwrap_or("cloud_tts");
    let voice_id = request.preferred_voice_id.unwrap_or_else(|| {
        match requested_backend {
            "windows_speech" if request.language.to_ascii_lowercase().starts_with("ja") => "windows-speech-ja-jp".to_string(),
            "windows_speech" => "windows-speech-default".to_string(),
            "piper_external" => "external-local-default".to_string(),
            _ => "default".to_string(),
        }
    });

    if requested_backend == "cloud_tts" {
        return TtsResultDto {
            ok: false,
            backend: "cloud_tts".to_string(),
            voice_id: Some(voice_id),
            message: if request.allow_cloud {
                "Cloud TTS is configured in the TTS model section. This local voice command does not synthesize cloud audio yet.".to_string()
            } else {
                "Cloud TTS is not configured yet. Fill in the TTS model API URL, Key, model, and voice first.".to_string()
            },
            audio_path: None,
        };
    }

    if requested_backend == "piper_external" {
        return TtsResultDto {
            ok: false,
            backend: "piper_external".to_string(),
            voice_id: Some(voice_id),
            message: "External local TTS is user-provided. Configure a local TTS API in the TTS model section instead of using a bundled engine.".to_string(),
            audio_path: None,
        };
    }

    if requested_backend != "windows_speech" {
        return TtsResultDto {
            ok: false,
            backend: requested_backend.to_string(),
            voice_id: Some(voice_id),
            message: "This TTS backend is not bundled. Use cloud TTS, or connect your own local TTS service.".to_string(),
            audio_path: None,
        };
    }

    synthesize_with_windows_speech(&app, &request.text, &voice_id, requested_backend)
}

#[tauri::command]
fn local_model_get_state(app: AppHandle, selected_model_id: Option<String>, enabled: Option<bool>) -> Result<LocalModelRuntimeStateDto, String> {
    Ok(resolve_local_model_state_for_selection(&app, selected_model_id.as_deref(), enabled.unwrap_or(true)))
}

#[tauri::command]
fn local_model_verify(app: AppHandle, selected_model_id: Option<String>) -> Result<LocalModelRuntimeStateDto, String> {
    let bundle = selected_local_model_bundle(&app, selected_model_id.as_deref())
        .ok_or_else(|| "No bundled local chat model manifest was found.".to_string())?;
    ensure_local_model_bundle_file(&bundle)?;
    if llama_server_path(&app).is_err() {
        let _ = llama_runner_path(&app)?;
    }
    let mut state = resolve_local_model_state_for_selection(&app, selected_model_id.as_deref(), true);
    if state.state == "stopped" {
        state.last_error = Some("Local model is installed but not loaded. It will reload next time local AI is used.".to_string());
    }
    state.last_verified_at = Some(current_unix_ms_string());
    Ok(state)
}

#[tauri::command]
fn local_model_warmup(app: AppHandle, selected_model_id: Option<String>) -> Result<LocalModelRuntimeStateDto, String> {
    if llama_server_path(&app).is_ok() {
        let _ = ensure_local_model_server_ready(
            &app,
            selected_model_id.as_deref(),
            Duration::from_millis(LOCAL_MODEL_SERVER_START_TIMEOUT_MS),
        )?;
    } else {
        ensure_local_model_runtime_for(&app, selected_model_id.as_deref())?;
    }
    let mut state = resolve_local_model_state_for_selection(&app, selected_model_id.as_deref(), true);
    if state.state == "ready" {
        state.state = "ready".to_string();
        state.last_error = None;
        state.last_verified_at = Some(current_unix_ms_string());
    }
    Ok(state)
}

#[tauri::command]
fn local_model_cancel() -> Result<(), String> {
    stop_local_model_server();
    Ok(())
}

#[tauri::command]
fn local_model_list(app: AppHandle) -> Result<Vec<LocalModelManifestDto>, String> {
    Ok(read_local_model_manifests(&app)
        .into_iter()
        .map(|bundle| bundle.manifest)
        .collect())
}

#[tauri::command]
fn local_model_select(app: AppHandle, model_id: String) -> Result<LocalModelRuntimeStateDto, String> {
    Ok(resolve_local_model_state_for_selection(&app, Some(model_id.trim()), true))
}

#[tauri::command]
fn local_model_enable(app: AppHandle, selected_model_id: Option<String>) -> Result<LocalModelRuntimeStateDto, String> {
    Ok(resolve_local_model_state_for_selection(&app, selected_model_id.as_deref(), true))
}

#[tauri::command]
fn local_model_disable(app: AppHandle, selected_model_id: Option<String>) -> Result<LocalModelRuntimeStateDto, String> {
    stop_local_model_server();
    Ok(resolve_local_model_state_for_selection(&app, selected_model_id.as_deref(), false))
}

#[tauri::command]
async fn local_model_chat(app: AppHandle, request: LocalModelChatRequestDto) -> Result<LocalModelChatResultDto, String> {
    tauri::async_runtime::spawn_blocking(move || local_model_chat_blocking(app, request))
        .await
        .map_err(|error| format!("Local model worker failed: {error}"))?
}

fn local_model_chat_blocking(app: AppHandle, request: LocalModelChatRequestDto) -> Result<LocalModelChatResultDto, String> {
    let _generation_guard = local_model_generation_lock()
        .lock()
        .map_err(|_| "Local model generation lock is poisoned.".to_string())?;
    match local_model_server_chat_blocking(&app, &request) {
        Ok(result) => Ok(result),
        Err(server_error) => {
            if llama_server_path(&app).is_ok() {
                return Err(server_error);
            }
            local_model_cli_chat_blocking(app, request)
        }
    }
}

fn local_model_server_chat_blocking(app: &AppHandle, request: &LocalModelChatRequestDto) -> Result<LocalModelChatResultDto, String> {
    let started = SystemTime::now();
    let timeout = Duration::from_millis(request.timeout_ms.clamp(5_000, 120_000));
    let endpoint = ensure_local_model_server_ready(app, request.model_id.as_deref(), timeout)?;
    let system_prompt = sanitize_local_model_prompt(&request.system_prompt);
    let user_prompt = sanitize_local_model_prompt(&request.prompt);
    let messages = serde_json::json!([
        { "role": "system", "content": system_prompt },
        { "role": "user", "content": user_prompt },
    ]);
    let body = serde_json::json!({
        "model": endpoint.model_id,
        "messages": messages,
        "stream": false,
        "temperature": request.temperature.clamp(0.0, 1.5),
        "max_tokens": request.max_tokens.clamp(32, 768),
        "stop": request.stop.iter().take(24).filter(|stop| !stop.trim().is_empty()).collect::<Vec<_>>(),
    });
    let client = reqwest::blocking::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| format!("Local model server HTTP client failed: {error}"))?;
    let response = client
        .post(format!("http://{LOCAL_MODEL_SERVER_HOST}:{}/v1/chat/completions", endpoint.port))
        .header(CONTENT_TYPE, "application/json")
        .json(&body)
        .send()
        .map_err(|error| format!("Local model server request failed: {error}"))?;
    let status = response.status();
    let body_text = response
        .text()
        .map_err(|error| format!("Local model server response failed: {error}"))?;
    if !status.is_success() {
        return Err(format!("Local model server returned HTTP {}: {}", status.as_u16(), clean_local_model_error(&body_text)));
    }
    let value = serde_json::from_str::<serde_json::Value>(&body_text)
        .map_err(|error| format!("Local model server returned invalid JSON: {error}"))?;
    let text = extract_openai_chat_text(&value)
        .or_else(|| Some(extract_llama_cli_text(&body_text, &user_prompt)).filter(|text| !text.trim().is_empty()))
        .unwrap_or_default();
    let text = clean_local_model_output(&text);
    if is_local_model_input_format_error(&text) {
        return Err("Local model server could not read the prompt text. The app cleaned the input; please try again.".to_string());
    }
    if text.is_empty() {
        return Err("Local model server returned an empty response.".to_string());
    }
    Ok(LocalModelChatResultDto {
        tokens: estimate_token_count(&text),
        text,
        elapsed_ms: started.elapsed().map(|duration| duration.as_millis()).unwrap_or_default(),
        model_id: endpoint.model_id,
        finish_reason: "stop".to_string(),
    })
}

fn extract_openai_chat_text(value: &serde_json::Value) -> Option<String> {
    if let Some(text) = value.get("output_text").and_then(|item| item.as_str()) {
        return Some(text.to_string());
    }
    let choice = value.get("choices")?.as_array()?.first()?;
    if let Some(text) = choice.get("text").and_then(|item| item.as_str()) {
        return Some(text.to_string());
    }
    let content = choice.get("message")?.get("content")?;
    if let Some(text) = content.as_str() {
        return Some(text.to_string());
    }
    if let Some(items) = content.as_array() {
        let text = items
            .iter()
            .filter_map(|item| item.get("text").and_then(|text| text.as_str()))
            .collect::<Vec<_>>()
            .join("\n");
        if !text.trim().is_empty() {
            return Some(text);
        }
    }
    None
}

fn local_model_cli_chat_blocking(app: AppHandle, request: LocalModelChatRequestDto) -> Result<LocalModelChatResultDto, String> {
    let runtime = ensure_local_model_runtime_for(&app, request.model_id.as_deref())?;
    let bundle = runtime.bundle;
    let runner = runtime.runner_path;
    let (model_arg, command_cwd) = local_model_model_arg(&bundle.model_path);
    let started = SystemTime::now();
    let system_prompt = sanitize_local_model_prompt(&request.system_prompt);
    let user_prompt = sanitize_local_model_prompt(&request.prompt);
    let prompt_files = write_local_model_prompt_files(&system_prompt, &user_prompt)?;

    let mut command = std::process::Command::new(&runner);
    if let Some(command_cwd) = command_cwd {
        command.current_dir(command_cwd);
    } else if let Some(runner_dir) = runner.parent() {
        command.current_dir(runner_dir);
    }
    command
        .arg("-m")
        .arg(&model_arg)
        .arg("-sysf")
        .arg(&prompt_files.0)
        .arg("-f")
        .arg(&prompt_files.1)
        .arg("-n")
        .arg(request.max_tokens.clamp(32, 768).to_string())
        .arg("-t")
        .arg(local_model_thread_count(&bundle.manifest).to_string())
        .arg("--temp")
        .arg(format!("{:.2}", request.temperature.clamp(0.0, 1.5)))
        .arg("--conversation")
        .arg("--single-turn")
        .arg("--jinja")
        .arg("--reasoning")
        .arg("off")
        .arg("--no-display-prompt")
        .arg("--simple-io")
        .arg("--log-disable")
        .arg("--no-perf")
        .arg("--no-warmup");
    for stop in request.stop.iter().take(24) {
        if !stop.trim().is_empty() {
            command.arg("--reverse-prompt").arg(stop);
        }
    }

    let mut child = match command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            remove_local_model_prompt_files(&prompt_files);
            return Err(format!("Local model runner could not start: {error}"));
        }
    };
    let timeout = Duration::from_millis(request.timeout_ms.clamp(5_000, 120_000));
    loop {
        match child.try_wait() {
            Ok(Some(_)) => break,
            Ok(None) => {}
            Err(error) => {
                remove_local_model_prompt_files(&prompt_files);
                return Err(error.to_string());
            }
        }
        if started.elapsed().unwrap_or_default() > timeout {
            let _ = child.kill();
            remove_local_model_prompt_files(&prompt_files);
            return Err("Local model request timed out.".to_string());
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    let output = child.wait_with_output().map_err(|error| error.to_string())?;
    remove_local_model_prompt_files(&prompt_files);
    let elapsed_ms = started.elapsed().map(|duration| duration.as_millis()).unwrap_or_default();

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let cleaned_error = clean_local_model_error(&stderr);
        return Err(format!("Local model runner failed: {cleaned_error}"));
    }

    let text = extract_llama_cli_text(&String::from_utf8_lossy(&output.stdout), &user_prompt);
    if is_local_model_input_format_error(&text) {
        return Err("Local model runner failed: The local model could not read the prompt text. The app cleaned the input; please try again.".to_string());
    }
    if text.is_empty() {
        return Err("Local model returned an empty response.".to_string());
    }

    Ok(LocalModelChatResultDto {
        tokens: estimate_token_count(&text),
        text,
        elapsed_ms,
        model_id: bundle.manifest.id,
        finish_reason: "stop".to_string(),
    })
}

fn local_model_thread_count(manifest: &LocalModelManifestDto) -> u32 {
    manifest.recommended_threads.clamp(1, 2)
}

fn local_model_context_tokens(manifest: &LocalModelManifestDto) -> u32 {
    manifest.context_tokens.clamp(512, 2048)
}

fn local_model_model_arg(model_path: &Path) -> (PathBuf, Option<PathBuf>) {
    if let Ok(cwd) = std::env::current_dir() {
        if let Ok(relative) = model_path.strip_prefix(&cwd) {
            let relative_text = relative.to_string_lossy();
            if relative_text.is_ascii() {
                return (relative.to_path_buf(), Some(cwd));
            }
        }
    }
    for ancestor in model_path.ancestors() {
        if ancestor.file_name().and_then(|name| name.to_str()) == Some("resources") {
            if let Ok(relative) = model_path.strip_prefix(ancestor) {
                let relative_text = relative.to_string_lossy();
                if relative_text.is_ascii() {
                    return (relative.to_path_buf(), Some(ancestor.to_path_buf()));
                }
            }
        }
    }
    (model_path.to_path_buf(), None)
}

fn write_local_model_prompt_files(system_prompt: &str, user_prompt: &str) -> Result<(PathBuf, PathBuf), String> {
    let dir = std::env::temp_dir().join("castroom-ai-local-model-prompts");
    fs::create_dir_all(&dir).map_err(|error| format!("Local model prompt temp directory failed: {error}"))?;
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let base = format!("prompt-{}-{stamp}", std::process::id());
    let system_path = dir.join(format!("{base}-system.txt"));
    let user_path = dir.join(format!("{base}-user.txt"));
    fs::write(&system_path, system_prompt.as_bytes())
        .map_err(|error| format!("Local model system prompt file failed: {error}"))?;
    fs::write(&user_path, user_prompt.as_bytes())
        .map_err(|error| format!("Local model user prompt file failed: {error}"))?;
    Ok((system_path, user_path))
}

fn remove_local_model_prompt_files(paths: &(PathBuf, PathBuf)) {
    let _ = fs::remove_file(&paths.0);
    let _ = fs::remove_file(&paths.1);
}

fn extract_llama_cli_text(stdout: &str, displayed_prompt: &str) -> String {
    let mut lines = Vec::new();
    let mut collecting = false;

    for raw_line in stdout.lines() {
        let line = raw_line.trim_end();
        let trimmed = line.trim();

        if trimmed.starts_with('>') {
            collecting = true;
            continue;
        }
        if trimmed.eq_ignore_ascii_case("Assistant:") {
            collecting = true;
            continue;
        }
        if trimmed.eq_ignore_ascii_case("<|im_start|>assistant") {
            collecting = true;
            continue;
        }
        if trimmed.eq_ignore_ascii_case("System:") || trimmed.eq_ignore_ascii_case("User:") {
            collecting = false;
            continue;
        }
        if trimmed.starts_with("<|im_start|>") || trimmed.eq_ignore_ascii_case("<|im_end|>") {
            collecting = false;
            continue;
        }
        if trimmed.starts_with('[') && trimmed.contains("Generation:") {
            break;
        }
        if trimmed.eq_ignore_ascii_case("Exiting...") {
            break;
        }
        if trimmed.starts_with("Loading model")
            || trimmed.starts_with("build")
            || trimmed.starts_with("model")
            || trimmed.starts_with("modalities")
            || trimmed.starts_with("available commands")
            || trimmed.starts_with("/exit")
            || trimmed.starts_with("/regen")
            || trimmed.starts_with("/clear")
            || trimmed.starts_with("/read")
            || trimmed.starts_with("/glob")
        {
            continue;
        }
        if collecting && !trimmed.is_empty() {
            lines.push(line.to_string());
        }
    }

    let joined = lines.join("\n").trim().to_string();
    let extracted = if joined.is_empty() {
        stdout
            .lines()
            .filter(|line| {
                let trimmed = line.trim();
                !trimmed.is_empty()
                    && !trimmed.starts_with('[')
                    && !trimmed.starts_with('>')
                    && !trimmed.eq_ignore_ascii_case("Exiting...")
                    && !trimmed.eq_ignore_ascii_case("System:")
                    && !trimmed.eq_ignore_ascii_case("User:")
                    && !trimmed.eq_ignore_ascii_case("Assistant:")
                    && !trimmed.starts_with("<|im_start|>")
                    && !trimmed.eq_ignore_ascii_case("<|im_end|>")
                    && !trimmed.starts_with("Loading model")
            })
            .last()
            .unwrap_or("")
            .trim()
            .to_string()
    } else {
        joined
    };

    clean_local_model_output(&strip_displayed_llama_prompt(&extracted, displayed_prompt))
}

fn strip_displayed_llama_prompt(value: &str, displayed_prompt: &str) -> String {
    let prompt_lines = displayed_prompt.lines().map(str::trim_end).collect::<Vec<_>>();
    if prompt_lines.len() <= 1 {
        return value.trim().to_string();
    }

    let displayed_after_prompt_marker = prompt_lines
        .iter()
        .skip(1)
        .copied()
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string();
    let text = value.trim_start();
    if displayed_after_prompt_marker.is_empty() || !text.starts_with(&displayed_after_prompt_marker) {
        return strip_displayed_llama_prompt_line_by_line(value, &prompt_lines);
    }

    text[displayed_after_prompt_marker.len()..].trim_start().to_string()
}

fn strip_displayed_llama_prompt_line_by_line(value: &str, prompt_lines: &[&str]) -> String {
    let mut remaining = value.trim_start().to_string();
    for prompt_line in prompt_lines.iter().skip(1) {
        let prompt = prompt_line.trim();
        if prompt.is_empty() {
            remaining = remaining.trim_start().to_string();
            continue;
        }

        let current = remaining.trim_start().to_string();
        if current.starts_with(prompt) {
            remaining = current[prompt.len()..].trim_start().to_string();
            continue;
        }

        let relaxed_prompt = prompt.trim_end_matches(|ch| ch == '"' || ch == '\'' || ch == '.' || ch == '。');
        if relaxed_prompt.len() >= 8 && current.starts_with(relaxed_prompt) {
            remaining = current[relaxed_prompt.len()..].trim_start().to_string();
        }
    }

    remaining.trim_start().to_string()
}

fn sanitize_local_model_prompt(value: &str) -> String {
    value
        .chars()
        .filter(|ch| {
            let code = *ch as u32;
            (*ch == '\n' || *ch == '\t' || !ch.is_control())
                && !(0xD800..=0xDFFF).contains(&code)
                && !(0xFDD0..=0xFDEF).contains(&code)
                && code != 0xFFFE
                && code != 0xFFFF
                && code != 0xFFFD
        })
        .collect::<String>()
        .lines()
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_string()
}

fn clean_local_model_error(stderr: &str) -> String {
    if is_local_model_input_format_error(stderr) {
        return "The local model could not read the prompt text. The app cleaned the input; please try again.".to_string();
    }

    let mut lines = stderr
        .lines()
        .map(str::trim)
        .filter(|line| {
            !line.is_empty()
                && !line.starts_with(">")
                && !line.starts_with("User:")
                && !line.starts_with("Assistant:")
                && !line.starts_with("System:")
                && !line.starts_with("Character:")
                && !line.starts_with("Character instructions")
        })
        .take(4)
        .collect::<Vec<_>>();

    if lines.is_empty() {
        lines.push("unknown runner error");
    }

    lines.join(" ")
}

fn clean_local_model_output(value: &str) -> String {
    let mut text = value.trim().to_string();
    for marker in [
        "\n<|im_start|>assistant",
        "\r\n<|im_start|>assistant",
        "<|im_start|>assistant",
        "\nAssistant:",
        "\r\nAssistant:",
        "Assistant:",
    ] {
        if let Some(index) = text.rfind(marker) {
            text = text[index + marker.len()..].trim().to_string();
            break;
        }
    }

    text = remove_ascii_tag_block(text, "<think>", "</think>");
    text = remove_ascii_tag_block(text, "<thinking>", "</thinking>");
    text = remove_ascii_tag_block(text, "[start thinking]", "[end thinking]");
    text = remove_ascii_tag_block(text, "[start reasoning]", "[end reasoning]");
    text = text
        .replace("<|im_start|>system", "")
        .replace("<|im_start|>user", "")
        .replace("<|im_start|>assistant", "")
        .replace("<|im_end|>", "");

    let mut cleaned_lines = Vec::new();
    for line in text.lines() {
        let trimmed = line.trim();
        let lower = trimmed.to_ascii_lowercase();
        if is_local_model_prompt_echo_line(&lower) {
            continue;
        }

        cleaned_lines.push(line);
    }

    cleaned_lines
        .join("\n")
        .replace("<|im_end|>", "")
        .replace("<|endoftext|>", "")
        .trim()
        .to_string()
}

fn is_local_model_prompt_echo_line(line: &str) -> bool {
    let normalized = line
        .trim()
        .trim_start_matches(|c: char| c == '-' || c == '*' || c == '\u{2022}' || c.is_whitespace())
        .to_string();
    let lower = normalized.to_ascii_lowercase();
    lower.starts_with("<|im_start|>")
        || lower.starts_with("<|im_end|>")
        || lower.starts_with("system:")
        || lower.starts_with("developer:")
        || lower.starts_with("assistant:")
        || lower.starts_with("user:")
        || lower.starts_with("/no_think")
        || lower.starts_with("you are a castroom ai local fallback chat model")
        || lower.starts_with("answer the user directly")
        || lower.starts_with("answer ordinary safe chat directly")
        || lower.starts_with("speak naturally and keep replies short")
        || lower.starts_with("normal greetings, tests")
        || lower.starts_with("refuse only requests for passwords")
        || lower.starts_with("output one short plain-text reply only")
        || normalized.starts_with("do not pretend you can run system commands")
        || normalized.starts_with("do not claim that you can see images")
        || normalized.starts_with("do not reveal private memories")
        || normalized.starts_with("in rooms, only use the current channel")
        || lower.starts_with("this is a one-on-one chat")
        || lower.starts_with("do not refuse greetings")
        || lower.starts_with("style:")
        || lower.starts_with("memory:")
        || lower.starts_with("stay concise")
        || lower.starts_with("return either plain text")
        || lower.starts_with("return only the character reply")
        || lower.starts_with("never reveal api keys")
        || lower.starts_with("do not wrap replies")
        || lower.starts_with("do not describe yourself")
        || lower.starts_with("you are speaking")
        || lower.starts_with("character:")
        || lower.starts_with("character instructions")
        || lower.starts_with("current emotion:")
        || lower.starts_with("mood:")
        || lower.starts_with("time:")
        || lower.starts_with("foreground app context:")
        || lower.starts_with("room:")
        || lower.starts_with("recent memory:")
        || lower.starts_with("voice hint:")
        || lower.starts_with("room topic:")
        || lower.starts_with("character name:")
        || lower.starts_with("character style:")
        || lower.starts_with("safety rules:")
        || lower.starts_with("user says:")
        || lower.starts_with("now write")
        || lower.starts_with("image context is untrusted")
        || lower.starts_with("no image caption is available")
        || lower.starts_with("user message:")
        || lower.starts_with("reply in character")
        || normalized.starts_with("\u{98ce}\u{683c}\u{ff1a}")
        || normalized.starts_with("\u{8bb0}\u{5fc6}\u{ff1a}")
        || normalized.starts_with("\u{623f}\u{95f4}\u{ff1a}")
        || normalized.starts_with("\u{56fe}\u{7247}\u{5907}\u{6ce8}\u{ff1a}")
        || normalized.starts_with("\u{7528}\u{6237}\u{8bf4}\u{ff1a}")
        || normalized.starts_with("\u{8bed}\u{6c14}\u{53c2}\u{8003}\u{ff1a}")
        || normalized.starts_with("\u{8fd1}\u{671f}\u{8bb0}\u{5fc6}\u{ff1a}")
        || normalized.starts_with("\u{623f}\u{95f4}\u{8bdd}\u{9898}\u{ff1a}")
        || normalized.starts_with("\u{53ea}\u{8f93}\u{51fa}\u{89d2}\u{8272}\u{53f0}\u{8bcd}")
        || normalized.starts_with("\u{8fd9}\u{662f}\u{804a}\u{5929}\u{5ba4}")
        || normalized.starts_with("\u{8fd9}\u{662f}\u{4e00}\u{5bf9}\u{4e00}\u{804a}\u{5929}")
        || lower == "assistant:"
        || lower == "user:"
}

fn is_local_model_input_format_error(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("failed to format input") || lower.contains("invalid codepoint")
}

fn remove_ascii_tag_block(mut text: String, open: &str, close: &str) -> String {
    loop {
        let lower = text.to_ascii_lowercase();
        let Some(start) = lower.find(open) else {
            break;
        };
        let Some(relative_end) = lower[start + open.len()..].find(close) else {
            text.replace_range(start.., "");
            break;
        };
        let end = start + open.len() + relative_end + close.len();
        text.replace_range(start..end, "");
    }
    text
}

struct ForegroundWindowContext {
    app_name: String,
    window_title: String,
    process_id: Option<u32>,
    is_fullscreen_or_borderless: bool,
}

#[derive(Clone)]
struct LocalModelBundle {
    manifest: LocalModelManifestDto,
    model_path: PathBuf,
}

struct LocalModelRuntime {
    bundle: LocalModelBundle,
    runner_path: PathBuf,
}

struct LocalModelServerProcess {
    model_id: String,
    model_path: PathBuf,
    port: u16,
    child: Child,
}

#[derive(Clone)]
struct LocalModelServerEndpoint {
    model_id: String,
    port: u16,
    pid: u32,
    health: String,
}

static LOCAL_MODEL_SERVER: OnceLock<Mutex<Option<LocalModelServerProcess>>> = OnceLock::new();
static LOCAL_MODEL_GENERATION_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn read_foreground_window_context() -> ForegroundWindowContext {
    // Windows foreground app implementation points: GetForegroundWindow, QueryFullProcessImageNameW, MonitorFromWindow.
    ForegroundWindowContext {
        app_name: "Unavailable".to_string(),
        window_title: "Foreground app awareness is not enabled in this test build.".to_string(),
        process_id: None,
        is_fullscreen_or_borderless: false,
    }
}

fn validate_secret_name(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err("Secret name is empty.".to_string());
    }
    if trimmed.len() > MAX_SECRET_NAME_LEN {
        return Err("Secret name is too long.".to_string());
    }
    let safe: String = trimmed
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' || ch == '.' {
                ch
            } else {
                '_'
            }
        })
        .collect();
    let safe = safe.trim_matches('_').to_string();
    if safe.is_empty() {
        return Err("Secret name has no safe characters.".to_string());
    }
    Ok(safe)
}

fn secret_storage_label() -> String {
    #[cfg(windows)]
    {
        "windows-dpapi".to_string()
    }
    #[cfg(not(windows))]
    {
        "local-obfuscated-file-legacy".to_string()
    }
}

fn protect_secret(bytes: &[u8]) -> Result<Vec<u8>, String> {
    protect_secret_dpapi(bytes)
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SecretProtectionFormat {
    Dpapi,
    LegacyXor,
    LegacyPlain,
}

impl SecretProtectionFormat {
    fn code(self) -> &'static str {
        match self {
            SecretProtectionFormat::Dpapi => "windows_dpapi",
            SecretProtectionFormat::LegacyXor => "legacy_xor",
            SecretProtectionFormat::LegacyPlain => "legacy_plain",
        }
    }
}

fn current_secret_format_code() -> &'static str {
    #[cfg(windows)]
    {
        "windows_dpapi"
    }
    #[cfg(not(windows))]
    {
        "legacy_xor"
    }
}

struct SecretUnprotectResult {
    bytes: Vec<u8>,
    format: SecretProtectionFormat,
}

fn unprotect_secret_compat(bytes: &[u8]) -> Result<SecretUnprotectResult, String> {
    match unprotect_secret_dpapi(bytes) {
        Ok(plain) => Ok(SecretUnprotectResult {
            bytes: plain,
            format: SecretProtectionFormat::Dpapi,
        }),
        Err(dpapi_error) => {
            let legacy = legacy_xor_secret(bytes);
            if String::from_utf8(legacy.clone()).is_ok() {
                Ok(SecretUnprotectResult {
                    bytes: legacy,
                    format: SecretProtectionFormat::LegacyXor,
                })
            } else if String::from_utf8(bytes.to_vec()).is_ok() {
                Ok(SecretUnprotectResult {
                    bytes: bytes.to_vec(),
                    format: SecretProtectionFormat::LegacyPlain,
                })
            } else {
                Err(dpapi_error)
            }
        }
    }
}

fn legacy_xor_secret(bytes: &[u8]) -> Vec<u8> {
    bytes.iter().map(|byte| byte ^ 0xA5).collect()
}

#[cfg(windows)]
#[repr(C)]
struct DataBlob {
    cb_data: u32,
    pb_data: *mut u8,
}

#[cfg(windows)]
#[link(name = "crypt32")]
extern "system" {
    fn CryptProtectData(
        data_in: *mut DataBlob,
        data_description: *const u16,
        optional_entropy: *mut DataBlob,
        reserved: *mut c_void,
        prompt_struct: *mut c_void,
        flags: u32,
        data_out: *mut DataBlob,
    ) -> i32;

    fn CryptUnprotectData(
        data_in: *mut DataBlob,
        data_description: *mut *mut u16,
        optional_entropy: *mut DataBlob,
        reserved: *mut c_void,
        prompt_struct: *mut c_void,
        flags: u32,
        data_out: *mut DataBlob,
    ) -> i32;
}

#[cfg(windows)]
#[link(name = "kernel32")]
extern "system" {
    fn LocalFree(memory: *mut c_void) -> *mut c_void;
}

#[cfg(windows)]
const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

#[cfg(windows)]
fn protect_secret_dpapi(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let mut input = DataBlob {
        cb_data: bytes.len() as u32,
        pb_data: bytes.as_ptr() as *mut u8,
    };
    let mut output = DataBlob {
        cb_data: 0,
        pb_data: ptr::null_mut(),
    };

    let ok = unsafe {
        CryptProtectData(
            &mut input,
            ptr::null(),
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!("Could not protect secret with Windows DPAPI: {}", std::io::Error::last_os_error()));
    }
    data_blob_to_vec(output)
}

#[cfg(not(windows))]
fn protect_secret_dpapi(bytes: &[u8]) -> Result<Vec<u8>, String> {
    Ok(legacy_xor_secret(bytes))
}

#[cfg(windows)]
fn unprotect_secret_dpapi(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let mut input = DataBlob {
        cb_data: bytes.len() as u32,
        pb_data: bytes.as_ptr() as *mut u8,
    };
    let mut output = DataBlob {
        cb_data: 0,
        pb_data: ptr::null_mut(),
    };
    let ok = unsafe {
        CryptUnprotectData(
            &mut input,
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            ptr::null_mut(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if ok == 0 {
        return Err(format!("Could not read secret with Windows DPAPI: {}", std::io::Error::last_os_error()));
    }
    data_blob_to_vec(output)
}

#[cfg(not(windows))]
fn unprotect_secret_dpapi(_bytes: &[u8]) -> Result<Vec<u8>, String> {
    Err("This build does not support OS-protected secret storage.".to_string())
}

#[cfg(windows)]
fn data_blob_to_vec(blob: DataBlob) -> Result<Vec<u8>, String> {
    if blob.pb_data.is_null() {
        return Err("Windows DPAPI returned an empty buffer.".to_string());
    }
    let value = unsafe { std::slice::from_raw_parts(blob.pb_data, blob.cb_data as usize).to_vec() };
    unsafe {
        LocalFree(blob.pb_data as *mut c_void);
    }
    Ok(value)
}

fn secret_file_path(app: &AppHandle, key_name: &str) -> Result<PathBuf, String> {
    let base = app_data_dir(app)?.join("secrets");
    assert_path_inside_root(&base.join(format!("{key_name}.secret")), &base)
}

fn mask_secret(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() <= 8 {
        return "****".to_string();
    }
    format!("{}...{}", &trimmed[..4], &trimmed[trimmed.len() - 4..])
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(path) = app.path().app_data_dir() {
        return Ok(path);
    }
    Ok(std::env::current_dir()
        .map_err(|error| error.to_string())?
        .join("runtime")
        .join("app-data"))
}

fn project_runtime_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(pack_dir) = project_character_pack_dir(app) {
        if let Some(project_dir) = pack_dir.parent() {
            return Ok(project_dir.join("runtime-data"));
        }
    }
    Ok(app_data_dir(app)?.join("project-runtime-data"))
}

fn assert_path_inside_root(path: &Path, root: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(root).map_err(|error| error.to_string())?;
    let root = root.canonicalize().map_err(|error| error.to_string())?;
    let parent = path
        .parent()
        .ok_or_else(|| "Path has no parent directory.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let parent = parent.canonicalize().map_err(|error| error.to_string())?;
    let file_name = path
        .file_name()
        .ok_or_else(|| "Path has no file name.".to_string())?;
    let candidate = parent.join(file_name);
    if !candidate.starts_with(&root) {
        return Err("Path is outside the allowed application data directory.".to_string());
    }
    Ok(candidate)
}

fn canonicalize_existing_directory(value: &str, label: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} is missing."));
    }
    let path = PathBuf::from(trimmed);
    if !path.exists() {
        return Err(format!("{label} was not found."));
    }
    if !path.is_dir() {
        return Err(format!("{label} is not a directory."));
    }
    path.canonicalize().map_err(|error| format!("Invalid {label}: {error}"))
}

fn assert_path_under_root(root: &Path, raw_path: &str, field: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err(format!("{field} is missing."));
    }
    let path = canonicalize_existing_directory(trimmed, field)?;
    let root = root.canonicalize().map_err(|error| format!("Invalid root path: {error}"))?;
    if !path.starts_with(&root) {
        return Err(format!("{field} is outside the allowed directory."));
    }
    Ok(path)
}

fn safe_pack_file_path(root: &Path, value: &str, field: &str) -> Result<PathBuf, String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(format!("{field} is missing."));
    }
    let value_path = Path::new(trimmed);
    if value_path.is_absolute() {
        return Err(format!("{field} must be a relative path."));
    }
    if value_path
        .components()
        .any(|component| matches!(component, Component::ParentDir))
    {
        return Err(format!("{field} must not use '..' path segments."));
    }
    Ok(root.join(value_path))
}

fn imported_pack_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(project_character_pack_dir(app).unwrap_or(app_data_dir(app)?.join("character-packs")))
}

fn deleted_pack_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(pack_dir) = project_character_pack_dir(app) {
        if let Some(parent) = pack_dir.parent() {
            return Ok(parent.join("deleted-character-packs"));
        }
    }
    Ok(app_data_dir(app)?.join("deleted-character-packs"))
}

fn bundled_character_pack_roots(app: &AppHandle) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    if let Ok(resource_dir) = app.path().resource_dir() {
        roots.push(resource_dir.join("character-packs"));
    }
    if let Ok(current_dir) = std::env::current_dir() {
        roots.push(current_dir.join("character-packs"));
        if let Some(parent) = current_dir.parent() {
            roots.push(parent.join("character-packs"));
        }
    }
    roots
}

fn project_character_pack_dir(_app: &AppHandle) -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(current_dir) = std::env::current_dir() {
        candidates.push(current_dir.join("character-packs"));
        if let Some(parent) = current_dir.parent() {
            candidates.push(parent.join("character-packs"));
        }
        if let Some(grandparent) = current_dir.parent().and_then(|parent| parent.parent()) {
            candidates.push(grandparent.join("character-packs"));
        }
    }
    candidates
        .into_iter()
        .find(|candidate| candidate.exists() && candidate.is_dir())
}

fn resolve_character_pack_source_dir(app: &AppHandle, pack_id: &str) -> Result<PathBuf, String> {
    let source_id = safe_pack_id(pack_id);
    if source_id.is_empty() {
        return Err("Character package id is missing.".to_string());
    }

    let imported = imported_pack_dir(app)?.join(&source_id);
    if imported.exists() && imported.is_dir() {
        return Ok(imported);
    }

    for root in bundled_character_pack_roots(app) {
        let candidate = root.join(&source_id);
        if candidate.exists() && candidate.is_dir() {
            return Ok(candidate);
        }
    }

    Err(format!("Character package was not found: {source_id}"))
}

fn read_character_pack(root: &Path) -> Result<ImportedCharacterPackDto, String> {
    let manifest_path = root.join("manifest.toml");
    let manifest_text = fs::read_to_string(&manifest_path).unwrap_or_default();
    let id = toml_value(&manifest_text, "id").unwrap_or_else(|| {
        root.file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("imported-pack")
            .to_string()
    });
    let name = toml_value(&manifest_text, "name").unwrap_or_else(|| id.clone());
    let prompt_path = toml_value(&manifest_text, "prompt_path")
        .unwrap_or_else(|| "prompt/system.md".to_string());
    let voice_path = toml_value(&manifest_text, "voice_path").unwrap_or_else(|| "voice.toml".to_string());
    let subtitle_path = toml_value(&manifest_text, "subtitle_path").unwrap_or_else(|| "subtitle.toml".to_string());
    let description = toml_value(&manifest_text, "description");
    let memory_namespace = toml_value(&manifest_text, "memory_namespace")
        .unwrap_or_else(|| format!("character:{id}"));
    let prompt_text = read_pack_prompt_text(root, &prompt_path);
    let voice_config = read_pack_voice_config(root, &voice_path);
    let assets = scan_character_assets(root)?;
    let emotions = build_character_emotion_map(&manifest_text, &assets);
    let errors = if manifest_path.exists() {
        Vec::new()
    } else {
        vec!["manifest.toml was not found.".to_string()]
    };
    let warnings = if prompt_text == FALLBACK_PROMPT_TEXT {
        vec!["Prompt file was not found; fallback prompt is used at runtime.".to_string()]
    } else {
        Vec::new()
    };
    let manifest = CharacterPackManifestDto {
        id: id.clone(),
        name: name.clone(),
        description: description.clone(),
        language: toml_value(&manifest_text, "language").unwrap_or_else(|| "auto".to_string()),
        default_render: toml_value(&manifest_text, "default_render").unwrap_or_else(|| "image".to_string()),
        prompt_path,
        prompt_text,
        voice_path,
        subtitle_path,
        memory_namespace,
        supported_asset_formats: vec![
            "png".to_string(),
            "jpg".to_string(),
            "jpeg".to_string(),
            "gif".to_string(),
            "txt".to_string(),
            "art".to_string(),
            "ansi".to_string(),
        ],
        emotions,
        voice_config,
    };
    Ok(ImportedCharacterPackDto {
        manifest,
        summary: CharacterPackSummaryDto {
            id,
            name,
            status: if errors.is_empty() { "ready".to_string() } else { "error".to_string() },
            detail: description.filter(|value| !value.trim().is_empty()).unwrap_or_else(|| root.to_string_lossy().to_string()),
            supported_formats: vec![
                "png".to_string(),
                "jpg".to_string(),
                "jpeg".to_string(),
                "gif".to_string(),
                "txt".to_string(),
                "art".to_string(),
                "ansi".to_string(),
            ],
            source: "imported".to_string(),
        },
        assets,
        warnings,
        errors,
    })
}

fn toml_value(text: &str, key: &str) -> Option<String> {
    let prefix = format!("{key} =");
    text.lines()
        .find_map(|line| {
            let line = line.trim();
            if !line.starts_with(&prefix) {
                return None;
            }
            Some(line[prefix.len()..].trim().trim_matches('"').to_string())
        })
        .filter(|value| !value.is_empty())
}

fn toml_section_values(text: &str, section: &str) -> std::collections::BTreeMap<String, String> {
    let mut values = std::collections::BTreeMap::new();
    let mut in_section = false;
    for line in text.lines() {
        let line = line.trim();
        if line.starts_with('[') && line.ends_with(']') {
            in_section = line.trim_matches(&['[', ']'][..]).trim() == section;
            continue;
        }
        if !in_section || line.is_empty() || line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let key = key.trim().trim_matches('"').to_string();
        let value = value.trim().trim_matches('"').to_string();
        if !key.is_empty() && !value.is_empty() {
            values.insert(key, value);
        }
    }
    values
}

fn emotion_entries_from_assets(assets: &[ImportedAssetGroupDto]) -> Vec<(String, String)> {
    let mut entries = Vec::new();
    for group in assets {
        if group.folder == "idle" {
            entries.push(("idle".to_string(), "idle".to_string()));
            continue;
        }
        let Some(name) = group.folder.strip_prefix("emotions/") else {
            continue;
        };
        let key = safe_pack_id(name);
        if key.is_empty() {
            continue;
        }
        entries.push((key, group.folder.clone()));
    }
    entries
}

fn build_character_emotion_map(
    manifest_text: &str,
    assets: &[ImportedAssetGroupDto],
) -> std::collections::BTreeMap<String, String> {
    let mut emotions = std::collections::BTreeMap::new();
    emotions.insert("idle".to_string(), "idle".to_string());
    for (key, folder) in toml_section_values(manifest_text, "emotions") {
        emotions.insert(key, folder);
    }
    for (key, folder) in emotion_entries_from_assets(assets) {
        emotions.entry(key).or_insert(folder);
    }
    emotions
}

fn read_pack_prompt_text(root: &Path, prompt_path: &str) -> String {
    let Ok(path) = safe_pack_file_path(root, prompt_path, "Prompt path") else {
        return FALLBACK_PROMPT_TEXT.to_string();
    };
    let Ok(text) = fs::read_to_string(path) else {
        return FALLBACK_PROMPT_TEXT.to_string();
    };
    let trimmed = text.trim();
    if trimmed.is_empty() {
        FALLBACK_PROMPT_TEXT.to_string()
    } else {
        trimmed.chars().take(MAX_PROMPT_TEXT_BYTES).collect()
    }
}

fn read_pack_voice_config(root: &Path, voice_path: &str) -> Option<CharacterPackVoiceConfigDto> {
    let path = safe_pack_file_path(root, voice_path, "Voice config path").ok()?;
    let text = fs::read_to_string(path).ok()?;
    let cloud_voice = toml_value(&text, "cloudVoice").or_else(|| toml_value(&text, "cloud_voice"));
    let windows_voice = toml_value(&text, "windowsVoice")
        .or_else(|| toml_value(&text, "windows_voice"))
        .or_else(|| toml_value(&text, "voice_id"));
    let language = toml_value(&text, "language").or_else(|| toml_value(&text, "locale"));
    let subtitle_language = toml_value(&text, "subtitleLanguage").or_else(|| toml_value(&text, "subtitle_language"));
    if cloud_voice.is_none() && windows_voice.is_none() && language.is_none() && subtitle_language.is_none() {
        return None;
    }
    Some(CharacterPackVoiceConfigDto {
        preferred_backend: toml_value(&text, "preferredBackend").or_else(|| toml_value(&text, "preferred_backend")),
        windows_voice,
        cloud_voice,
        language,
        subtitle_language,
    })
}

fn write_character_pack_draft(
    target_dir: &Path,
    name: &str,
    description: &str,
    language: &str,
    prompt_text: &str,
    voice_id: &str,
    voice_hint: &str,
    assets: &[CharacterAssetDraftDto],
) -> Result<(), String> {
    let pack_id = target_dir
        .file_name()
        .and_then(|value| value.to_str())
        .map(safe_pack_id)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| "character".to_string());
    fs::create_dir_all(target_dir.join("prompt")).map_err(|error| error.to_string())?;
    fs::create_dir_all(target_dir.join("idle")).map_err(|error| error.to_string())?;
    for emotion in ["happy", "sad", "angry", "surprised"] {
        fs::create_dir_all(target_dir.join("emotions").join(emotion)).map_err(|error| error.to_string())?;
    }

    let safe_name = if name.trim().is_empty() { "New Character" } else { name.trim() };
    let safe_prompt = if prompt_text.trim().is_empty() {
        FALLBACK_PROMPT_TEXT
    } else {
        prompt_text.trim()
    };
    fs::write(target_dir.join("prompt").join("system.md"), safe_prompt).map_err(|error| error.to_string())?;

    let voice = [
        "preferredBackend = \"cloud_tts\"".to_string(),
        format!("cloudVoice = \"{}\"", toml_escape(voice_id.trim())),
        format!("language = \"{}\"", toml_escape(voice_hint.trim())),
        "subtitleLanguage = \"auto\"".to_string(),
        String::new(),
    ]
    .join("\n");
    fs::write(target_dir.join("voice.toml"), voice).map_err(|error| error.to_string())?;
    fs::write(target_dir.join("subtitle.toml"), "language = \"auto\"\n").map_err(|error| error.to_string())?;

    for asset in assets {
        copy_character_asset(target_dir, asset)?;
    }

    let existing_manifest_text = fs::read_to_string(target_dir.join("manifest.toml")).unwrap_or_default();
    let scanned_assets = scan_character_assets(target_dir)?;
    let emotions = build_character_emotion_map(&existing_manifest_text, &scanned_assets);
    let mut manifest = vec![
        format!("id = \"{}\"", toml_escape(&pack_id)),
        format!("name = \"{}\"", toml_escape(safe_name)),
        format!("description = \"{}\"", toml_escape(description.trim())),
        format!("language = \"{}\"", toml_escape(default_if_blank(language, "auto"))),
        "default_render = \"image\"".to_string(),
        "prompt_path = \"prompt/system.md\"".to_string(),
        "voice_path = \"voice.toml\"".to_string(),
        "subtitle_path = \"subtitle.toml\"".to_string(),
        format!("memory_namespace = \"character:{}\"", toml_escape(&pack_id)),
        String::new(),
        "[emotions]".to_string(),
    ];
    for (key, folder) in emotions {
        manifest.push(format!("\"{}\" = \"{}\"", toml_escape(&key), toml_escape(&folder)));
    }
    manifest.push(String::new());
    fs::write(target_dir.join("manifest.toml"), manifest.join("\n")).map_err(|error| error.to_string())?;
    Ok(())
}

fn character_pack_memory_root(app: &AppHandle, pack_id: &str) -> Result<PathBuf, String> {
    let source_id = safe_pack_id(pack_id);
    if source_id.is_empty() {
        return Err("Character package id is missing.".to_string());
    }
    let pack_dir = imported_pack_dir(app)?.join(&source_id);
    fs::create_dir_all(pack_dir.join("memory")).map_err(|error| error.to_string())?;
    Ok(pack_dir.join("memory"))
}

fn character_pack_history_dir(app: &AppHandle, pack_id: &str, create: bool) -> Result<PathBuf, String> {
    let source_id = safe_pack_id(pack_id);
    if source_id.is_empty() {
        return Err("Character package id is missing.".to_string());
    }
    let pack_dir = imported_pack_dir(app)?.join(&source_id);
    let history_dir = pack_dir.join("history");
    if create {
        fs::create_dir_all(&history_dir).map_err(|error| error.to_string())?;
    }
    assert_path_inside_root(&history_dir, &pack_dir)
}

fn character_pack_history_file_path(app: &AppHandle, pack_id: &str, create: bool) -> Result<PathBuf, String> {
    let history_dir = character_pack_history_dir(app, pack_id, create)?;
    assert_path_inside_root(&history_dir.join("one-on-one.json"), &history_dir)
}

fn direct_room_history_dir(app: &AppHandle, pack_id: &str, create: bool) -> Result<PathBuf, String> {
    let source_id = safe_pack_id(pack_id);
    if source_id.is_empty() {
        return Err("Character package id is missing.".to_string());
    }
    let root = project_runtime_data_dir(app)?.join("direct-rooms");
    let dir = assert_path_inside_root(&root.join(source_id), &root)?;
    if create {
        fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    }
    Ok(dir)
}

fn direct_room_history_file_path(app: &AppHandle, pack_id: &str, create: bool) -> Result<PathBuf, String> {
    let dir = direct_room_history_dir(app, pack_id, create)?;
    assert_path_inside_root(&dir.join("messages.jsonl"), &dir)
}

fn read_jsonl_messages(path: &Path) -> Result<Vec<serde_json::Value>, String> {
    let file = fs::File::open(path).map_err(|error| error.to_string())?;
    let reader = BufReader::new(file);
    let mut messages = Vec::new();
    for (index, line) in reader.lines().enumerate() {
        let line = line.map_err(|error| error.to_string())?;
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let value = serde_json::from_str::<serde_json::Value>(trimmed)
            .map_err(|error| format!("Invalid direct room JSONL at line {}: {error}", index + 1))?;
        messages.push(value);
    }
    Ok(messages)
}

fn write_jsonl_messages(path: &Path, messages: &[serde_json::Value]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut file = fs::File::create(path).map_err(|error| error.to_string())?;
    for message in messages {
        let line = serde_json::to_string(message).map_err(|error| error.to_string())?;
        writeln!(file, "{line}").map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn append_jsonl_message(path: &Path, message: &serde_json::Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    let line = serde_json::to_string(message).map_err(|error| error.to_string())?;
    writeln!(file, "{line}").map_err(|error| error.to_string())
}

fn prompt_presets_file_path(app: &AppHandle, create: bool) -> Result<PathBuf, String> {
    let root = app_data_dir(app)?.join("prompt-presets");
    if create {
        fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    }
    assert_path_inside_root(&root.join("presets.json"), &root)
}

fn prompt_pack_source_file_path(source_path: &str) -> Result<PathBuf, String> {
    let trimmed = source_path.trim();
    if trimmed.is_empty() {
        return Err("Prompt pack path is missing.".to_string());
    }
    let path = PathBuf::from(trimmed);
    if !path.exists() {
        return Err("Prompt pack path was not found.".to_string());
    }
    let path = path.canonicalize().map_err(|error| format!("Invalid prompt pack path: {error}"))?;
    let file_path = if path.is_dir() {
        let candidates = ["prompt-pack.json", "castroom-workshop.json", "presets.json"];
        candidates
            .iter()
            .map(|name| path.join(name))
            .find(|candidate| candidate.exists())
            .ok_or_else(|| "Prompt pack directory must contain prompt-pack.json, castroom-workshop.json, or presets.json.".to_string())?
    } else {
        path
    };
    if !file_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("json"))
        .unwrap_or(false)
    {
        return Err("Prompt pack v1 must be a JSON file.".to_string());
    }
    Ok(file_path)
}

fn ensure_file_size(path: &Path, max_bytes: u64, label: &str) -> Result<(), String> {
    let size = fs::metadata(path).map_err(|error| error.to_string())?.len();
    if size > max_bytes {
        return Err(format!("{label} is too large."));
    }
    Ok(())
}

fn validate_prompt_preset_payload(value: &serde_json::Value) -> Result<(), String> {
    reject_prompt_preset_sensitive_keys(value, "$")?;
    let presets = value.get("presets").unwrap_or(value);
    if !presets.is_array() {
        return Err("Prompt preset payload must be an array or an object with a presets array.".to_string());
    }
    Ok(())
}

fn reject_prompt_preset_sensitive_keys(value: &serde_json::Value, path: &str) -> Result<(), String> {
    match value {
        serde_json::Value::Object(map) => {
            for (key, child) in map {
                let lower = key.to_ascii_lowercase();
                if lower.contains("apikey")
                    || lower.contains("api_key")
                    || lower.contains("secret")
                    || lower == "history"
                    || lower == "memory"
                    || lower == "diagnostics"
                    || lower == "logs"
                    || lower == "log"
                    || lower == "keypreview"
                {
                    return Err(format!("Prompt preset payload contains forbidden private data key: {path}.{key}"));
                }
                reject_prompt_preset_sensitive_keys(child, &format!("{path}.{key}"))?;
            }
        }
        serde_json::Value::Array(items) => {
            for (index, child) in items.iter().enumerate() {
                reject_prompt_preset_sensitive_keys(child, &format!("{path}[{index}]"))?;
            }
        }
        _ => {}
    }
    Ok(())
}

fn memory_scope_file_path(app: &AppHandle, scope: &str, create: bool) -> Result<PathBuf, String> {
    let root = project_runtime_data_dir(app)?.join("memory");
    let trimmed = scope.trim();
    if trimmed.is_empty() {
        return Err("Memory scope is missing.".to_string());
    }

    let path = if trimmed == "global" {
        root.join("global.json")
    } else if let Some(pack_id) = trimmed.strip_prefix("character:") {
        root.join("characters").join(format!("{}.json", safe_pack_id(pack_id)))
    } else if let Some(rest) = trimmed.strip_prefix("room:") {
        memory_room_scope_file_path(&root, rest)?
    } else {
        return Err("Unsupported memory scope.".to_string());
    };

    if create {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
    }
    assert_path_inside_root(&path, &root)
}

fn memory_room_scope_file_path(root: &Path, rest: &str) -> Result<PathBuf, String> {
    let parts = rest.split(':').collect::<Vec<_>>();
    if parts.is_empty() || parts[0].trim().is_empty() {
        return Err("Room memory scope is missing a room id.".to_string());
    }
    let room_id = safe_pack_id(parts[0]);
    if parts.len() == 1 {
        return Ok(root.join("rooms").join(room_id).join("room.json"));
    }
    if parts.len() == 2 && parts[1] == "system" {
        return Ok(root.join("rooms").join(room_id).join("director.json"));
    }
    if parts.len() == 3 && parts[1] == "role" {
        return Ok(root
            .join("rooms")
            .join(room_id)
            .join("roles")
            .join(format!("{}.json", safe_pack_id(parts[2]))));
    }
    if parts.len() == 3 && parts[1] == "observer" {
        return Ok(root
            .join("rooms")
            .join(room_id)
            .join("observers")
            .join(format!("{}.json", safe_pack_id(parts[2]))));
    }
    if parts.len() == 3 && parts[1] == "faction" {
        return Ok(root
            .join("rooms")
            .join(room_id)
            .join("factions")
            .join(format!("{}.json", safe_pack_id(parts[2]))));
    }
    Err("Unsupported room memory scope.".to_string())
}

fn memory_graph_file_path(app: &AppHandle, create: bool) -> Result<PathBuf, String> {
    let root = project_runtime_data_dir(app)?.join("memory-graph");
    if create {
        fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    }
    assert_path_inside_root(&root.join("memory-graph.sqlite"), &root)
}

fn open_memory_graph_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = memory_graph_file_path(app, true)?;
    let connection = Connection::open(path).map_err(|error| error.to_string())?;
    connection
        .pragma_update(None, "foreign_keys", "ON")
        .map_err(|error| error.to_string())?;
    Ok(connection)
}

fn migrate_memory_graph(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            r#"
CREATE TABLE IF NOT EXISTS schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memory_nodes (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  kind TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(scope, kind, canonical_key)
);

CREATE TABLE IF NOT EXISTS memory_claims (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  kind TEXT NOT NULL,
  subject_node_id TEXT NOT NULL,
  predicate TEXT NOT NULL,
  object_node_id TEXT,
  text TEXT NOT NULL,
  canonical_key TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence REAL NOT NULL,
  authority TEXT NOT NULL,
  sensitivity TEXT NOT NULL,
  visibility TEXT NOT NULL,
  evidence_count INTEGER NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  version INTEGER NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  FOREIGN KEY(subject_node_id) REFERENCES memory_nodes(id),
  FOREIGN KEY(object_node_id) REFERENCES memory_nodes(id),
  UNIQUE(scope, canonical_key, visibility)
);

CREATE TABLE IF NOT EXISTS memory_edges (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  type TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  confidence REAL NOT NULL,
  visibility TEXT NOT NULL,
  properties_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(from_node_id) REFERENCES memory_nodes(id),
  FOREIGN KEY(to_node_id) REFERENCES memory_nodes(id),
  UNIQUE(scope, from_node_id, type, to_node_id, visibility)
);

CREATE TABLE IF NOT EXISTS memory_sources (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  message_id TEXT,
  source_scope TEXT NOT NULL,
  room_id TEXT,
  participant_id TEXT,
  faction_id TEXT,
  speaker_id TEXT,
  speaker_type TEXT,
  source_text_hash TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(claim_id) REFERENCES memory_claims(id)
);

CREATE TABLE IF NOT EXISTS memory_visibility (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  visibility TEXT NOT NULL,
  role_id TEXT,
  faction_id TEXT,
  director_visible INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(claim_id) REFERENCES memory_claims(id)
);

CREATE TABLE IF NOT EXISTS memory_versions (
  id TEXT PRIMARY KEY,
  claim_id TEXT NOT NULL,
  previous_text TEXT NOT NULL,
  next_text TEXT NOT NULL,
  change_type TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  source_ids_json TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY(claim_id) REFERENCES memory_claims(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_nodes_scope_kind ON memory_nodes(scope, kind);
CREATE INDEX IF NOT EXISTS idx_memory_claims_scope_status ON memory_claims(scope, status);
CREATE INDEX IF NOT EXISTS idx_memory_claims_scope_kind ON memory_claims(scope, kind);
CREATE INDEX IF NOT EXISTS idx_memory_claims_confidence ON memory_claims(scope, confidence DESC);
CREATE INDEX IF NOT EXISTS idx_memory_claims_updated ON memory_claims(scope, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_edges_from ON memory_edges(scope, from_node_id, type);
CREATE INDEX IF NOT EXISTS idx_memory_edges_to ON memory_edges(scope, to_node_id, type);
CREATE INDEX IF NOT EXISTS idx_memory_visibility_claim ON memory_visibility(claim_id);
CREATE INDEX IF NOT EXISTS idx_memory_visibility_role ON memory_visibility(role_id, visibility);
CREATE INDEX IF NOT EXISTS idx_memory_visibility_faction ON memory_visibility(faction_id, visibility);
CREATE INDEX IF NOT EXISTS idx_memory_sources_claim ON memory_sources(claim_id);
"#,
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT INTO schema_meta(key, value) VALUES('memory_graph_schema_version', '1')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute(
            "INSERT OR IGNORE INTO schema_meta(key, value) VALUES('created_at', ?1)",
            params![current_unix_ms_string()],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn memory_graph_stable_id(prefix: &str, seed: &str) -> String {
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    seed.hash(&mut hasher);
    format!("{prefix}-{:016x}", hasher.finish())
}

fn memory_graph_json_string(value: &serde_json::Value, key: &str, fallback: &str) -> String {
    value
        .get(key)
        .and_then(|item| item.as_str())
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn memory_graph_json_optional_string(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(|item| item.as_str())
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
}

fn memory_graph_json_f64(value: &serde_json::Value, key: &str, fallback: f64) -> f64 {
    value.get(key).and_then(|item| item.as_f64()).unwrap_or(fallback)
}

fn memory_graph_json_i64(value: &serde_json::Value, key: &str, fallback: i64) -> i64 {
    value.get(key).and_then(|item| item.as_i64()).unwrap_or(fallback)
}

fn memory_graph_json_blob(value: &serde_json::Value, key: &str) -> Result<String, String> {
    serde_json::to_string(value.get(key).unwrap_or(&serde_json::json!({}))).map_err(|error| error.to_string())
}

fn memory_graph_json_string_array(value: &serde_json::Value, key: &str) -> Vec<String> {
    value
        .get(key)
        .and_then(|item| item.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn memory_graph_hash_text(value: &str) -> String {
    memory_graph_stable_id("hash", value)
}

fn upsert_memory_graph_node(connection: &Connection, node: &serde_json::Value) -> Result<serde_json::Value, String> {
    let now = current_unix_ms_string();
    let scope = memory_graph_json_string(node, "scope", "global");
    let kind = memory_graph_json_string(node, "kind", "unknown");
    let canonical_key = memory_graph_json_string(node, "canonicalKey", "unknown");
    let display_name = memory_graph_json_string(node, "displayName", &canonical_key);
    let id = memory_graph_json_optional_string(node, "id")
        .unwrap_or_else(|| memory_graph_stable_id("node", &format!("{scope}:{kind}:{canonical_key}")));
    let created_at = memory_graph_json_string(node, "createdAt", &now);
    let updated_at = memory_graph_json_string(node, "updatedAt", &now);
    let properties_json = memory_graph_json_blob(node, "properties")?;

    connection
        .execute(
            "INSERT INTO memory_nodes(id, scope, kind, canonical_key, display_name, properties_json, created_at, updated_at)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(scope, kind, canonical_key) DO UPDATE SET
               display_name = excluded.display_name,
               properties_json = excluded.properties_json,
               updated_at = excluded.updated_at",
            params![id, scope, kind, canonical_key, display_name, properties_json, created_at, updated_at],
        )
        .map_err(|error| error.to_string())?;

    read_memory_graph_node(connection, &scope, &kind, &canonical_key)
}

fn read_memory_graph_node(connection: &Connection, scope: &str, kind: &str, canonical_key: &str) -> Result<serde_json::Value, String> {
    connection
        .query_row(
            "SELECT id, scope, kind, canonical_key, display_name, properties_json, created_at, updated_at
             FROM memory_nodes WHERE scope = ?1 AND kind = ?2 AND canonical_key = ?3",
            params![scope, kind, canonical_key],
            |row| {
                let properties_json: String = row.get(5)?;
                let properties = serde_json::from_str::<serde_json::Value>(&properties_json).unwrap_or_else(|_| serde_json::json!({}));
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "scope": row.get::<_, String>(1)?,
                    "kind": row.get::<_, String>(2)?,
                    "canonicalKey": row.get::<_, String>(3)?,
                    "displayName": row.get::<_, String>(4)?,
                    "properties": properties,
                    "createdAt": row.get::<_, String>(6)?,
                    "updatedAt": row.get::<_, String>(7)?
                }))
            },
        )
        .map_err(|error| error.to_string())
}

fn merge_memory_graph_claim(connection: &Connection, claim: &serde_json::Value) -> Result<serde_json::Value, String> {
    let now = current_unix_ms_string();
    let scope = memory_graph_json_string(claim, "scope", "global");
    let kind = memory_graph_json_string(claim, "kind", "fact");
    let predicate = memory_graph_json_string(claim, "predicate", "mentions");
    let text = memory_graph_json_string(claim, "text", "");
    if text.is_empty() {
        return Err("Memory graph claim text is missing.".to_string());
    }
    let visibility = memory_graph_json_string(claim, "visibility", "public");
    let canonical_key = memory_graph_json_string(
        claim,
        "canonicalKey",
        &format!("{}:{}:{}", kind, predicate, text.to_lowercase()),
    );
    let subject_node_id = memory_graph_json_optional_string(claim, "subjectNodeId")
        .ok_or_else(|| "Memory graph claim subjectNodeId is missing.".to_string())?;
    let object_node_id = memory_graph_json_optional_string(claim, "objectNodeId");
    let status = memory_graph_json_string(claim, "status", "active");
    let authority = memory_graph_json_string(claim, "authority", "system");
    let sensitivity = memory_graph_json_string(claim, "sensitivity", "normal");
    let mut confidence = memory_graph_json_f64(claim, "confidence", 0.6);
    if authority == "developer" {
        confidence = 1.0;
    }
    let evidence_count = memory_graph_json_i64(claim, "evidenceCount", 1).max(1);
    let first_seen_at = memory_graph_json_string(claim, "firstSeenAt", &now);
    let last_seen_at = memory_graph_json_string(claim, "lastSeenAt", &now);
    let properties_json = memory_graph_json_blob(claim, "properties")?;
    let id = memory_graph_json_optional_string(claim, "id")
        .unwrap_or_else(|| memory_graph_stable_id("claim", &format!("{scope}:{canonical_key}:{visibility}")));

    connection
        .execute(
            "INSERT INTO memory_claims(
               id, scope, kind, subject_node_id, predicate, object_node_id, text, canonical_key, status,
               confidence, authority, sensitivity, visibility, evidence_count, first_seen_at, last_seen_at, version, properties_json
             )
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 1, ?17)
             ON CONFLICT(scope, canonical_key, visibility) DO UPDATE SET
               text = excluded.text,
               status = CASE
                 WHEN excluded.authority = 'developer' THEN 'active'
                 WHEN memory_claims.status = 'archived' THEN memory_claims.status
                 ELSE excluded.status
               END,
               confidence = MAX(memory_claims.confidence, excluded.confidence),
               authority = CASE
                 WHEN excluded.authority = 'developer' THEN 'developer'
                 ELSE memory_claims.authority
               END,
               sensitivity = excluded.sensitivity,
               evidence_count = memory_claims.evidence_count + excluded.evidence_count,
               last_seen_at = excluded.last_seen_at,
               version = memory_claims.version + 1,
               properties_json = excluded.properties_json",
            params![
                id,
                scope,
                kind,
                subject_node_id,
                predicate,
                object_node_id,
                text,
                canonical_key,
                status,
                confidence,
                authority,
                sensitivity,
                visibility,
                evidence_count,
                first_seen_at,
                last_seen_at,
                properties_json
            ],
        )
        .map_err(|error| error.to_string())?;

    let merged = read_memory_graph_claim(connection, &scope, &canonical_key, &visibility)?;
    let merged_id = memory_graph_json_string(&merged, "id", "");
    record_memory_graph_source(connection, &merged_id, claim)?;
    record_memory_graph_visibility(connection, &merged_id, claim)?;
    Ok(merged)
}

fn read_memory_graph_claim(connection: &Connection, scope: &str, canonical_key: &str, visibility: &str) -> Result<serde_json::Value, String> {
    connection
        .query_row(
            "SELECT id, scope, kind, subject_node_id, predicate, object_node_id, text, canonical_key, status,
                    confidence, authority, sensitivity, visibility, evidence_count, first_seen_at, last_seen_at, version, properties_json
             FROM memory_claims WHERE scope = ?1 AND canonical_key = ?2 AND visibility = ?3",
            params![scope, canonical_key, visibility],
            memory_graph_claim_row_to_json,
        )
        .map_err(|error| error.to_string())
}

fn read_memory_graph_claim_by_id(connection: &Connection, claim_id: &str) -> Result<serde_json::Value, String> {
    connection
        .query_row(
            "SELECT id, scope, kind, subject_node_id, predicate, object_node_id, text, canonical_key, status,
                    confidence, authority, sensitivity, visibility, evidence_count, first_seen_at, last_seen_at, version, properties_json
             FROM memory_claims WHERE id = ?1",
            params![claim_id],
            memory_graph_claim_row_to_json,
        )
        .map_err(|error| error.to_string())
}

fn update_memory_graph_claim(connection: &Connection, patch: &serde_json::Value) -> Result<serde_json::Value, String> {
    let now = current_unix_ms_string();
    let claim_id = memory_graph_json_string(patch, "claimId", "");
    if claim_id.is_empty() {
        return Err("Memory graph claimId is missing.".to_string());
    }
    let existing = read_memory_graph_claim_by_id(connection, &claim_id)?;
    let previous_text = memory_graph_json_string(&existing, "text", "");
    let text = memory_graph_json_string(patch, "text", &previous_text);
    let kind = memory_graph_json_string(patch, "kind", &memory_graph_json_string(&existing, "kind", "fact"));
    let predicate = memory_graph_json_string(patch, "predicate", &memory_graph_json_string(&existing, "predicate", "mentions"));
    let status = memory_graph_json_string(patch, "status", &memory_graph_json_string(&existing, "status", "active"));
    let confidence = memory_graph_json_f64(patch, "confidence", memory_graph_json_f64(&existing, "confidence", 0.6)).clamp(0.0, 1.0);
    let authority = memory_graph_json_string(patch, "authority", &memory_graph_json_string(&existing, "authority", "system"));
    let sensitivity = memory_graph_json_string(patch, "sensitivity", &memory_graph_json_string(&existing, "sensitivity", "normal"));
    let visibility = memory_graph_json_string(patch, "visibility", &memory_graph_json_string(&existing, "visibility", "public"));
    let properties_json = if patch.get("properties").is_some() {
        memory_graph_json_blob(patch, "properties")?
    } else {
        serde_json::to_string(existing.get("properties").unwrap_or(&serde_json::json!({}))).map_err(|error| error.to_string())?
    };

    connection
        .execute(
            "UPDATE memory_claims
             SET kind = ?1, predicate = ?2, text = ?3, status = ?4, confidence = ?5,
                 authority = ?6, sensitivity = ?7, visibility = ?8, last_seen_at = ?9,
                 version = version + 1, properties_json = ?10
             WHERE id = ?11",
            params![kind, predicate, text, status, confidence, authority, sensitivity, visibility, now, properties_json, claim_id],
        )
        .map_err(|error| error.to_string())?;

    let changed_by = memory_graph_json_string(patch, "changedBy", "user");
    record_memory_graph_version(connection, &claim_id, &previous_text, &text, "edit", &changed_by)?;
    read_memory_graph_claim_by_id(connection, &claim_id)
}

fn update_memory_graph_visibility(connection: &Connection, input: &serde_json::Value) -> Result<serde_json::Value, String> {
    let claim_id = memory_graph_json_string(input, "claimId", "");
    if claim_id.is_empty() {
        return Err("Memory graph claimId is missing.".to_string());
    }
    let existing = read_memory_graph_claim_by_id(connection, &claim_id)?;
    let previous_text = memory_graph_json_string(&existing, "text", "");
    let visibility = memory_graph_json_string(input, "visibility", &memory_graph_json_string(&existing, "visibility", "public"));
    connection
        .execute(
            "UPDATE memory_claims SET visibility = ?1, last_seen_at = ?2, version = version + 1 WHERE id = ?3",
            params![visibility, current_unix_ms_string(), claim_id],
        )
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM memory_visibility WHERE claim_id = ?1", params![claim_id])
        .map_err(|error| error.to_string())?;
    let next = read_memory_graph_claim_by_id(connection, &claim_id)?;
    let mut visibility_claim = next.clone();
    if let Some(role_ids) = input.get("knownToRoleIds") {
        visibility_claim["knownToRoleIds"] = role_ids.clone();
    }
    if let Some(faction_id) = input.get("factionId") {
        visibility_claim["factionId"] = faction_id.clone();
    }
    if let Some(director_visible) = input.get("directorVisible") {
        visibility_claim["directorVisible"] = director_visible.clone();
    }
    record_memory_graph_visibility(connection, &claim_id, &visibility_claim)?;
    let changed_by = memory_graph_json_string(input, "changedBy", "user");
    record_memory_graph_version(connection, &claim_id, &previous_text, &previous_text, "visibility", &changed_by)?;
    read_memory_graph_claim_by_id(connection, &claim_id)
}

fn merge_memory_graph_duplicate_claims(connection: &Connection, input: &serde_json::Value) -> Result<serde_json::Value, String> {
    let winner_claim_id = memory_graph_json_string(input, "winnerClaimId", "");
    if winner_claim_id.is_empty() {
        return Err("Memory graph winnerClaimId is missing.".to_string());
    }
    let duplicate_claim_ids = memory_graph_json_string_array(input, "duplicateClaimIds");
    let winner = read_memory_graph_claim_by_id(connection, &winner_claim_id)?;
    let previous_text = memory_graph_json_string(&winner, "text", "");
    let mut evidence_count = memory_graph_json_i64(&winner, "evidenceCount", 1).max(1);
    let mut confidence = memory_graph_json_f64(&winner, "confidence", 0.0);

    for duplicate_id in duplicate_claim_ids {
        if duplicate_id == winner_claim_id {
            continue;
        }
        if let Ok(duplicate) = read_memory_graph_claim_by_id(connection, &duplicate_id) {
            evidence_count += memory_graph_json_i64(&duplicate, "evidenceCount", 1).max(1);
            confidence = confidence.max(memory_graph_json_f64(&duplicate, "confidence", 0.0));
            set_memory_graph_claim_status(connection, &duplicate_id, "archived", "merge_duplicate")?;
        }
    }

    connection
        .execute(
            "UPDATE memory_claims
             SET evidence_count = ?1, confidence = ?2, last_seen_at = ?3, version = version + 1
             WHERE id = ?4",
            params![evidence_count, confidence.clamp(0.0, 1.0), current_unix_ms_string(), winner_claim_id],
        )
        .map_err(|error| error.to_string())?;
    let changed_by = memory_graph_json_string(input, "changedBy", "user");
    record_memory_graph_version(connection, &winner_claim_id, &previous_text, &previous_text, "merge_duplicate", &changed_by)?;
    read_memory_graph_claim_by_id(connection, &winner_claim_id)
}

fn set_memory_graph_claim_status(connection: &Connection, claim_id: &str, status: &str, change_type: &str) -> Result<(), String> {
    let existing = read_memory_graph_claim_by_id(connection, claim_id)?;
    let previous_text = memory_graph_json_string(&existing, "text", "");
    connection
        .execute(
            "UPDATE memory_claims SET status = ?1, last_seen_at = ?2, version = version + 1 WHERE id = ?3",
            params![status, current_unix_ms_string(), claim_id],
        )
        .map_err(|error| error.to_string())?;
    record_memory_graph_version(connection, claim_id, &previous_text, &previous_text, change_type, "user")
}

fn delete_memory_graph_claim(connection: &Connection, claim_id: &str) -> Result<(), String> {
    connection
        .execute("DELETE FROM memory_versions WHERE claim_id = ?1", params![claim_id])
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM memory_visibility WHERE claim_id = ?1", params![claim_id])
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM memory_sources WHERE claim_id = ?1", params![claim_id])
        .map_err(|error| error.to_string())?;
    connection
        .execute("DELETE FROM memory_claims WHERE id = ?1", params![claim_id])
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn record_memory_graph_version(
    connection: &Connection,
    claim_id: &str,
    previous_text: &str,
    next_text: &str,
    change_type: &str,
    changed_by: &str,
) -> Result<(), String> {
    let id = memory_graph_stable_id("version", &format!("{claim_id}:{change_type}:{}", current_unix_ms_string()));
    connection
        .execute(
            "INSERT INTO memory_versions(id, claim_id, previous_text, next_text, change_type, changed_by, changed_at, source_ids_json)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, '[]')",
            params![id, claim_id, previous_text, next_text, change_type, changed_by, current_unix_ms_string()],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn memory_graph_claim_row_to_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<serde_json::Value> {
    let properties_json: String = row.get(17)?;
    let properties = serde_json::from_str::<serde_json::Value>(&properties_json).unwrap_or_else(|_| serde_json::json!({}));
    Ok(serde_json::json!({
        "id": row.get::<_, String>(0)?,
        "scope": row.get::<_, String>(1)?,
        "kind": row.get::<_, String>(2)?,
        "subjectNodeId": row.get::<_, String>(3)?,
        "predicate": row.get::<_, String>(4)?,
        "objectNodeId": row.get::<_, Option<String>>(5)?,
        "text": row.get::<_, String>(6)?,
        "canonicalKey": row.get::<_, String>(7)?,
        "status": row.get::<_, String>(8)?,
        "confidence": row.get::<_, f64>(9)?,
        "authority": row.get::<_, String>(10)?,
        "sensitivity": row.get::<_, String>(11)?,
        "visibility": row.get::<_, String>(12)?,
        "evidenceCount": row.get::<_, i64>(13)?,
        "firstSeenAt": row.get::<_, String>(14)?,
        "lastSeenAt": row.get::<_, String>(15)?,
        "version": row.get::<_, i64>(16)?,
        "properties": properties
    }))
}

fn record_memory_graph_source(connection: &Connection, claim_id: &str, claim: &serde_json::Value) -> Result<(), String> {
    let source = claim.get("source").unwrap_or(claim);
    let excerpt = memory_graph_json_string(source, "excerpt", &memory_graph_json_string(claim, "text", ""));
    if excerpt.is_empty() {
        return Ok(());
    }
    let now = current_unix_ms_string();
    let source_scope = memory_graph_json_string(source, "sourceScope", &memory_graph_json_string(claim, "scope", "global"));
    let message_id = memory_graph_json_optional_string(source, "messageId");
    let room_id = memory_graph_json_optional_string(source, "roomId");
    let participant_id = memory_graph_json_optional_string(source, "participantId");
    let faction_id = memory_graph_json_optional_string(source, "factionId");
    let speaker_id = memory_graph_json_optional_string(source, "speakerId");
    let speaker_type = memory_graph_json_optional_string(source, "speakerType");
    let hash = memory_graph_json_optional_string(source, "sourceTextHash").unwrap_or_else(|| memory_graph_hash_text(&excerpt));
    let id = memory_graph_stable_id("source", &format!("{claim_id}:{hash}:{source_scope}"));
    connection
        .execute(
            "INSERT OR IGNORE INTO memory_sources(
               id, claim_id, message_id, source_scope, room_id, participant_id, faction_id, speaker_id, speaker_type,
               source_text_hash, excerpt, created_at
             )
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![id, claim_id, message_id, source_scope, room_id, participant_id, faction_id, speaker_id, speaker_type, hash, excerpt, now],
        )
        .map_err(|error| error.to_string())?;
    Ok(())
}

fn record_memory_graph_visibility(connection: &Connection, claim_id: &str, claim: &serde_json::Value) -> Result<(), String> {
    let now = current_unix_ms_string();
    let visibility = memory_graph_json_string(claim, "visibility", "public");
    let director_visible = if claim.get("directorVisible").and_then(|value| value.as_bool()).unwrap_or(false) {
        1
    } else {
        0
    };
    let faction_id = memory_graph_json_optional_string(claim, "factionId");
    let known_roles = claim
        .get("knownToRoleIds")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    if known_roles.is_empty() {
        let id = memory_graph_stable_id("visibility", &format!("{claim_id}:{visibility}:{:?}:{director_visible}", faction_id));
        connection
            .execute(
                "INSERT OR IGNORE INTO memory_visibility(id, claim_id, visibility, role_id, faction_id, director_visible, created_at)
                 VALUES(?1, ?2, ?3, NULL, ?4, ?5, ?6)",
                params![id, claim_id, visibility, faction_id, director_visible, now],
            )
            .map_err(|error| error.to_string())?;
        return Ok(());
    }
    for role_id in known_roles {
        let id = memory_graph_stable_id("visibility", &format!("{claim_id}:{visibility}:{role_id}:{director_visible}"));
        connection
            .execute(
                "INSERT OR IGNORE INTO memory_visibility(id, claim_id, visibility, role_id, faction_id, director_visible, created_at)
                 VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![id, claim_id, visibility, role_id, faction_id, director_visible, now],
            )
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn create_memory_graph_edge(connection: &Connection, edge: &serde_json::Value) -> Result<serde_json::Value, String> {
    let now = current_unix_ms_string();
    let scope = memory_graph_json_string(edge, "scope", "global");
    let from_node_id = memory_graph_json_string(edge, "fromNodeId", "");
    let to_node_id = memory_graph_json_string(edge, "toNodeId", "");
    if from_node_id.is_empty() || to_node_id.is_empty() {
        return Err("Memory graph edge endpoints are missing.".to_string());
    }
    let edge_type = memory_graph_json_string(edge, "type", "ABOUT");
    let visibility = memory_graph_json_string(edge, "visibility", "public");
    let confidence = memory_graph_json_f64(edge, "confidence", 0.6).clamp(0.0, 1.0);
    let properties_json = memory_graph_json_blob(edge, "properties")?;
    let id = memory_graph_json_optional_string(edge, "id")
        .unwrap_or_else(|| memory_graph_stable_id("edge", &format!("{scope}:{from_node_id}:{edge_type}:{to_node_id}:{visibility}")));
    connection
        .execute(
            "INSERT INTO memory_edges(id, scope, from_node_id, type, to_node_id, confidence, visibility, properties_json, created_at, updated_at)
             VALUES(?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(scope, from_node_id, type, to_node_id, visibility) DO UPDATE SET
               confidence = MAX(memory_edges.confidence, excluded.confidence),
               properties_json = excluded.properties_json,
               updated_at = excluded.updated_at",
            params![id, scope, from_node_id, edge_type, to_node_id, confidence, visibility, properties_json, now, now],
        )
        .map_err(|error| error.to_string())?;
    read_memory_graph_edge_by_id(connection, &id)
}

fn read_memory_graph_edge_by_id(connection: &Connection, edge_id: &str) -> Result<serde_json::Value, String> {
    connection
        .query_row(
            "SELECT id, scope, from_node_id, type, to_node_id, confidence, visibility, properties_json, created_at, updated_at
             FROM memory_edges WHERE id = ?1",
            params![edge_id],
            memory_graph_edge_row_to_json,
        )
        .map_err(|error| error.to_string())
}

fn query_memory_graph_conflicts(connection: &Connection, scope: &str, claim_id: &str) -> Result<serde_json::Value, String> {
    let claim = read_memory_graph_claim_by_id(connection, claim_id)?;
    let subject_node_id = memory_graph_json_string(&claim, "subjectNodeId", "");
    let predicate = memory_graph_json_string(&claim, "predicate", "");
    let mut statement = connection
        .prepare(
            "SELECT id, scope, kind, subject_node_id, predicate, object_node_id, text, canonical_key, status,
                    confidence, authority, sensitivity, visibility, evidence_count, first_seen_at, last_seen_at, version, properties_json
             FROM memory_claims
             WHERE scope = ?1 AND id <> ?2 AND subject_node_id = ?3 AND predicate = ?4
               AND status IN ('active', 'disputed')",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![scope, claim_id, subject_node_id, predicate], memory_graph_claim_row_to_json)
        .map_err(|error| error.to_string())?;
    let claims = rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?;
    Ok(serde_json::json!({ "claims": claims }))
}

fn resolve_memory_graph_conflict(connection: &Connection, input: &serde_json::Value) -> Result<(), String> {
    let winner_claim_id = memory_graph_json_string(input, "winnerClaimId", "");
    if winner_claim_id.is_empty() {
        return Err("Memory graph conflict winnerClaimId is missing.".to_string());
    }
    let action = memory_graph_json_string(input, "action", "supersede");
    set_memory_graph_claim_status(connection, &winner_claim_id, "active", "resolve")?;
    let loser_ids = input
        .get("loserClaimIds")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    for loser_id in loser_ids {
        let status = match action.as_str() {
            "archive" => "archived",
            "dispute" => "disputed",
            _ => "superseded",
        };
        set_memory_graph_claim_status(connection, &loser_id, status, &action)?;
    }
    Ok(())
}

fn query_memory_graph_visible_claims(connection: &Connection, context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let scope = memory_graph_json_string(context, "scope", "global");
    let limit = memory_graph_json_i64(context, "limit", 16).clamp(1, 64);
    let include_disputed = context
        .get("includeDisputed")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let include_archived = context
        .get("includeArchived")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let include_needs_review = context
        .get("includeNeedsReview")
        .and_then(|value| value.as_bool())
        .unwrap_or(false);
    let viewer = context.get("viewer").unwrap_or(&serde_json::Value::Null);
    let viewer_type = memory_graph_json_string(viewer, "type", "global");
    let pack_id = memory_graph_json_optional_string(viewer, "packId");
    let participant_id = memory_graph_json_optional_string(viewer, "participantId");
    let faction_id = memory_graph_json_optional_string(viewer, "factionId");
    let director_can_see = viewer_type == "director";
    let mut statement = connection
        .prepare(
            "SELECT DISTINCT c.id, c.scope, c.kind, c.subject_node_id, c.predicate, c.object_node_id, c.text, c.canonical_key, c.status,
                    c.confidence, c.authority, c.sensitivity, c.visibility, c.evidence_count, c.first_seen_at, c.last_seen_at, c.version, c.properties_json
             FROM memory_claims c
             LEFT JOIN memory_visibility v ON v.claim_id = c.id
             WHERE c.scope = ?1
               AND (c.status = 'active' OR (?2 = 1 AND c.status = 'disputed') OR (?7 = 1 AND c.status IN ('archived', 'superseded', 'rejected')) OR (?9 = 1 AND c.status = 'needs_review'))
               AND (
                 c.visibility IN ('public', 'global')
                 OR (?3 = 1 AND (v.director_visible = 1 OR c.visibility = 'director_only'))
                 OR (?4 IS NOT NULL AND v.role_id = ?4 AND c.visibility IN ('known_to_roles', 'private_character'))
                 OR (?5 IS NOT NULL AND v.faction_id = ?5 AND c.visibility = 'faction')
                 OR (?8 IS NOT NULL AND c.scope = ('character:' || ?8) AND c.visibility = 'private_character')
               )
             ORDER BY c.confidence DESC, c.evidence_count DESC, c.last_seen_at DESC
             LIMIT ?6",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(
            params![
                scope,
                if include_disputed { 1 } else { 0 },
                if director_can_see { 1 } else { 0 },
                participant_id,
                faction_id,
                limit,
                if include_archived { 1 } else { 0 },
                pack_id,
                if include_needs_review { 1 } else { 0 }
            ],
            memory_graph_claim_row_to_json,
        )
        .map_err(|error| error.to_string())?;
    let claims = rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?;
    Ok(serde_json::json!({ "claims": claims }))
}

fn query_memory_graph_view(connection: &Connection, context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let scope = memory_graph_json_string(context, "scope", "global");
    let max_nodes = memory_graph_json_i64(context, "maxNodes", 120).clamp(12, 500) as usize;
    let mode = memory_graph_json_string(context, "mode", "browse");
    let filters = context.get("filters").cloned().unwrap_or_else(|| serde_json::json!({}));
    let expanded_node_ids = memory_graph_json_string_array(context, "expandedNodeIds");
    let mut query_context = context.clone();
    query_context["limit"] = serde_json::json!(500);
    query_context["includeDisputed"] = serde_json::json!(true);
    query_context["includeNeedsReview"] = serde_json::json!(true);
    let claims_value = query_memory_graph_visible_claims(connection, &query_context)?;
    let all_claims = claims_value
        .get("claims")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|claim| {
            memory_graph_claim_matches_view_filters(claim, &filters, connection)
                || memory_graph_claim_connected_to_expanded_node(claim, &expanded_node_ids)
        })
        .collect::<Vec<_>>();
    let visible_claim_count = all_claims.len();
    let pending_review_count = all_claims
        .iter()
        .filter(|claim| memory_graph_json_string(claim, "status", "active") == "needs_review")
        .count();
    let has_status_filter = filters
        .get("statuses")
        .and_then(|value| value.as_array())
        .map(|values| !values.is_empty())
        .unwrap_or(false);
    let issues = build_memory_graph_issues(&all_claims, connection)?;
    let issue_claim_ids = memory_graph_issue_claim_ids_for_mode(&issues, &mode);
    let claims = if mode == "browse" {
        all_claims
            .into_iter()
            .filter(|claim| {
                let status = memory_graph_json_string(claim, "status", "active");
                status != "needs_review"
                    || has_status_filter
                    || memory_graph_json_f64(claim, "confidence", 0.0) >= 0.8
                    || memory_graph_json_i64(claim, "evidenceCount", 1) >= 3
                    || memory_graph_claim_connected_to_expanded_node(claim, &expanded_node_ids)
            })
            .collect::<Vec<_>>()
    } else {
        all_claims
            .into_iter()
            .filter(|claim| {
                let claim_id = memory_graph_json_string(claim, "id", "");
                issue_claim_ids.contains(&claim_id) || memory_graph_claim_connected_to_expanded_node(claim, &expanded_node_ids)
            })
            .collect::<Vec<_>>()
    };
    let mode_claim_count = claims.len();
    let mut nodes: Vec<serde_json::Value> = Vec::new();
    let mut edges: Vec<serde_json::Value> = Vec::new();
    let mut node_ids = std::collections::HashSet::<String>::new();
    let mut edge_ids = std::collections::HashSet::<String>::new();
    let mut truncated = false;

    for claim in claims {
        let claim_id = memory_graph_json_string(&claim, "id", "");
        if claim_id.is_empty() {
            continue;
        }
        let claim_scope = memory_graph_json_string(&claim, "scope", &scope);
        let visibility = memory_graph_json_string(&claim, "visibility", "public");
        let scope_node_id = format!("scope:{claim_scope}");
        let claim_node_id = format!("claim:{claim_id}");
        if !memory_graph_push_view_node(
            &mut nodes,
            &mut node_ids,
            max_nodes,
            serde_json::json!({
                "id": scope_node_id,
                "kind": "scope",
                "label": memory_graph_scope_label(&claim_scope),
                "subtitle": claim_scope,
                "scope": claim_scope
            }),
        ) {
            truncated = true;
            break;
        }
        let subject_node_id = memory_graph_json_string(&claim, "subjectNodeId", "");
        let mut rendered_as_relationship = false;
        if let Some(subject) = read_memory_graph_node_by_id(connection, &subject_node_id)? {
            let subject_view_id = format!("entity:{subject_node_id}");
            if memory_graph_push_view_node(
                &mut nodes,
                &mut node_ids,
                max_nodes,
                memory_graph_entity_view_node_with_role(&subject, "subject", None),
            ) {
                memory_graph_push_view_edge(
                    &mut edges,
                    &mut edge_ids,
                    &node_ids,
                    serde_json::json!({
                        "id": memory_graph_stable_id("view-edge", &format!("{scope_node_id}:ABOUT:{subject_view_id}")),
                        "from": scope_node_id,
                        "to": subject_view_id,
                        "type": "ABOUT",
                        "label": "scope",
                        "visibility": visibility,
                        "dashed": memory_graph_visibility_is_private(&visibility)
                    }),
                );
                if let Some(object_node_id) = memory_graph_json_optional_string(&claim, "objectNodeId") {
                    if let Some(object) = read_memory_graph_node_by_id(connection, &object_node_id)? {
                        if !memory_graph_should_hide_object_node(&claim, &object) {
                            let object_view_id = format!("entity:{object_node_id}");
                            if memory_graph_push_view_node(
                                &mut nodes,
                                &mut node_ids,
                                max_nodes,
                                memory_graph_entity_view_node_with_role(&object, "object", Some(&claim)),
                            ) {
                                let predicate = memory_graph_json_string(&claim, "predicate", "states");
                                memory_graph_push_view_edge(
                                    &mut edges,
                                    &mut edge_ids,
                                    &node_ids,
                                    serde_json::json!({
                                        "id": memory_graph_stable_id("view-edge", &format!("{subject_view_id}:{predicate}:{object_view_id}:{claim_id}")),
                                        "from": subject_view_id,
                                        "to": object_view_id,
                                        "type": memory_graph_relationship_view_edge_type(&claim),
                                        "label": predicate,
                                        "visibility": memory_graph_json_string(&claim, "visibility", "public"),
                                        "dashed": memory_graph_visibility_is_private(&memory_graph_json_string(&claim, "visibility", "public")),
                                        "sourceClaimId": claim_id
                                    }),
                                );
                                rendered_as_relationship = true;
                            } else {
                                truncated = true;
                            }
                        }
                    }
                }
            } else {
                truncated = true;
            }
        }
        if !rendered_as_relationship {
            if !memory_graph_push_view_node(&mut nodes, &mut node_ids, max_nodes, memory_graph_claim_view_node(&claim)) {
                truncated = true;
                break;
            }
            memory_graph_push_view_edge(
                &mut edges,
                &mut edge_ids,
                &node_ids,
                serde_json::json!({
                    "id": memory_graph_stable_id("view-edge", &format!("{scope_node_id}:ABOUT:{claim_node_id}")),
                    "from": scope_node_id,
                    "to": claim_node_id,
                    "type": "ABOUT",
                    "label": "scope",
                    "visibility": visibility,
                    "dashed": memory_graph_visibility_is_private(&memory_graph_json_string(&claim, "visibility", "public"))
                }),
            );
        }
        if truncated {
            break;
        }
    }

    append_memory_graph_stored_edges_for_view(
        connection,
        &scope,
        context,
        max_nodes,
        &mut nodes,
        &mut edges,
        &mut node_ids,
        &mut edge_ids,
        &mut truncated,
    )?;

    Ok(serde_json::json!({
        "nodes": nodes,
        "edges": edges,
        "filters": filters,
        "mode": mode,
        "issues": issues,
        "truncated": truncated,
        "hiddenPrivateCount": count_hidden_private_memory_graph_claims(connection, &scope, context)?,
        "visibleClaimCount": visible_claim_count,
        "modeClaimCount": mode_claim_count,
        "pendingReviewCount": pending_review_count
    }))
}

fn query_memory_graph_issues(connection: &Connection, context: &serde_json::Value) -> Result<serde_json::Value, String> {
    let mut query_context = context.clone();
    query_context["limit"] = serde_json::json!(500);
    query_context["includeDisputed"] = serde_json::json!(true);
    query_context["includeNeedsReview"] = serde_json::json!(true);
    let claims_value = query_memory_graph_visible_claims(connection, &query_context)?;
    let claims = claims_value
        .get("claims")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    Ok(serde_json::json!({ "issues": build_memory_graph_issues(&claims, connection)? }))
}

fn build_memory_graph_issues(claims: &[serde_json::Value], connection: &Connection) -> Result<Vec<serde_json::Value>, String> {
    let mut issues: Vec<serde_json::Value> = Vec::new();
    let mut conflict_groups = std::collections::HashMap::<String, Vec<serde_json::Value>>::new();
    let mut duplicate_groups = std::collections::HashMap::<String, Vec<serde_json::Value>>::new();

    for claim in claims {
        let claim_id = memory_graph_json_string(claim, "id", "");
        if claim_id.is_empty() {
            continue;
        }
        let scope = memory_graph_json_string(claim, "scope", "global");
        let subject_node_id = memory_graph_json_string(claim, "subjectNodeId", "");
        let object_node_id = memory_graph_json_optional_string(claim, "objectNodeId").unwrap_or_default();
        let predicate = memory_graph_json_string(claim, "predicate", "mentions");
        let text = memory_graph_json_string(claim, "text", "");
        let kind = memory_graph_json_string(claim, "kind", "fact");
        let status = memory_graph_json_string(claim, "status", "active");
        let visibility = memory_graph_json_string(claim, "visibility", "public");
        let sensitivity = memory_graph_json_string(claim, "sensitivity", "normal");
        let authority = memory_graph_json_string(claim, "authority", "system");
        let confidence = memory_graph_json_f64(claim, "confidence", 0.0);
        let evidence_count = memory_graph_json_i64(claim, "evidenceCount", 1);

        let conflict_key = format!("{scope}:{subject_node_id}:{predicate}");
        conflict_groups.entry(conflict_key).or_default().push(claim.clone());

        let canonical_key = memory_graph_json_string(claim, "canonicalKey", "");
        let duplicate_key = memory_graph_issue_key(&format!(
            "{}:{}:{}:{}:{}",
            scope,
            if canonical_key.is_empty() { &kind } else { &canonical_key },
            subject_node_id,
            predicate,
            if object_node_id.is_empty() { memory_graph_issue_key(&text) } else { object_node_id.clone() }
        ));
        duplicate_groups.entry(duplicate_key).or_default().push(claim.clone());

        if visibility == "public" && (kind == "secret" || sensitivity == "private") {
            issues.push(serde_json::json!({
                "id": memory_graph_stable_id("issue", &format!("visibility:{claim_id}")),
                "kind": "visibility_leak",
                "severity": "error",
                "claimIds": [claim_id],
                "summary": format!("公开可见的私密事实：{text}")
            }));
        }
        if memory_graph_claim_is_low_quality(&text, &kind, &authority, confidence, evidence_count) {
            issues.push(serde_json::json!({
                "id": memory_graph_stable_id("issue", &format!("quality:{claim_id}")),
                "kind": "low_quality",
                "severity": "warn",
                "claimIds": [claim_id],
                "summary": format!("低质量或低置信度记忆：{text}")
            }));
        }
        if read_memory_graph_node_by_id(connection, &subject_node_id)?.is_none()
            || (!object_node_id.is_empty() && read_memory_graph_node_by_id(connection, &object_node_id)?.is_none())
        {
            issues.push(serde_json::json!({
                "id": memory_graph_stable_id("issue", &format!("orphan:{claim_id}")),
                "kind": "orphan",
                "severity": "warn",
                "claimIds": [claim_id],
                "summary": format!("记忆缺少可连接实体：{text}")
            }));
        }
        if status == "disputed" {
            issues.push(serde_json::json!({
                "id": memory_graph_stable_id("issue", &format!("conflict-status:{claim_id}")),
                "kind": "conflict",
                "severity": "error",
                "claimIds": [claim_id],
                "summary": format!("存在争议记忆：{text}")
            }));
        }
    }

    for group in conflict_groups.values() {
        let active_items = group
            .iter()
            .filter(|claim| {
                let status = memory_graph_json_string(claim, "status", "active");
                status == "active" || status == "disputed"
            })
            .cloned()
            .collect::<Vec<_>>();
        let object_keys = active_items
            .iter()
            .map(|claim| {
                memory_graph_json_optional_string(claim, "objectNodeId")
                    .unwrap_or_else(|| memory_graph_issue_key(&memory_graph_json_string(claim, "text", "")))
            })
            .collect::<std::collections::HashSet<_>>();
        if active_items.len() > 1
            && (object_keys.len() > 1 || active_items.iter().any(|claim| memory_graph_json_string(claim, "status", "active") == "disputed"))
        {
            let claim_ids = active_items.iter().map(|claim| memory_graph_json_string(claim, "id", "")).collect::<Vec<_>>();
            let predicate = memory_graph_json_string(&active_items[0], "predicate", "mentions");
            issues.push(serde_json::json!({
                "id": memory_graph_stable_id("issue", &format!("conflict:{}", claim_ids.join(":"))),
                "kind": "conflict",
                "severity": "error",
                "claimIds": claim_ids,
                "summary": format!("同一主体和谓词存在冲突：{predicate}")
            }));
        }
    }

    for group in duplicate_groups.values() {
        let active_items = group
            .iter()
            .filter(|claim| memory_graph_json_string(claim, "status", "active") == "active")
            .cloned()
            .collect::<Vec<_>>();
        if active_items.len() > 1 {
            let claim_ids = active_items.iter().map(|claim| memory_graph_json_string(claim, "id", "")).collect::<Vec<_>>();
            let text = memory_graph_json_string(&active_items[0], "text", "");
            issues.push(serde_json::json!({
                "id": memory_graph_stable_id("issue", &format!("duplicate:{}", claim_ids.join(":"))),
                "kind": "duplicate",
                "severity": "warn",
                "claimIds": claim_ids,
                "summary": format!("重复记忆：{text}")
            }));
        }
    }

    let mut seen = std::collections::HashSet::<String>::new();
    Ok(issues
        .into_iter()
        .filter(|issue| seen.insert(memory_graph_json_string(issue, "id", "")))
        .collect())
}

fn memory_graph_issue_claim_ids_for_mode(issues: &[serde_json::Value], mode: &str) -> std::collections::HashSet<String> {
    let accepted = match mode {
        "conflicts" => vec!["conflict"],
        "duplicates" => vec!["duplicate"],
        "visibility" => vec!["visibility_leak"],
        "quality" => vec!["low_quality", "orphan"],
        _ => Vec::new(),
    };
    issues
        .iter()
        .filter(|issue| accepted.iter().any(|kind| *kind == memory_graph_json_string(issue, "kind", "")))
        .flat_map(|issue| memory_graph_json_string_array(issue, "claimIds"))
        .collect()
}

fn memory_graph_issue_key(value: &str) -> String {
    value
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn memory_graph_claim_is_low_quality(text: &str, kind: &str, authority: &str, confidence: f64, evidence_count: i64) -> bool {
    if authority == "developer" || authority == "director" {
        return false;
    }
    let clean = text.split_whitespace().collect::<Vec<_>>().join(" ");
    if confidence < 0.5 || (evidence_count <= 1 && authority == "character" && confidence < 0.68) {
        return true;
    }
    if kind == "fact" && clean.chars().count() < 5 && evidence_count <= 1 {
        return true;
    }
    if clean.is_empty() {
        return true;
    }
    let lower = clean.to_lowercase();
    let repeated_prefix = ["房间相关事实", "角色相关事实", "用户相关事实"]
        .iter()
        .any(|prefix| clean.matches(prefix).count() > 1);
    if repeated_prefix {
        return true;
    }
    if lower.starts_with("room summary:")
        || lower.starts_with("summary:")
        || lower.contains("director choice: pick a role to act")
        || lower.contains("waiting for player")
        || lower.contains("model_unavailable")
        || lower.contains("local_error")
        || lower.contains("cloud_error")
        || clean.contains("等待玩家")
        || clean.contains("等待用户")
        || clean.contains("模型不可用")
    {
        return true;
    }
    false
}

fn memory_graph_claim_connected_to_expanded_node(claim: &serde_json::Value, expanded_node_ids: &[String]) -> bool {
    if expanded_node_ids.is_empty() {
        return false;
    }
    let claim_id = memory_graph_json_string(claim, "id", "");
    let claim_view_id = format!("claim:{claim_id}");
    if expanded_node_ids.iter().any(|node_id| node_id == &claim_view_id) {
        return true;
    }
    let subject_node_id = memory_graph_json_string(claim, "subjectNodeId", "");
    let subject_view_id = format!("entity:{subject_node_id}");
    if expanded_node_ids.iter().any(|node_id| node_id == &subject_view_id) {
        return true;
    }
    if let Some(object_node_id) = memory_graph_json_optional_string(claim, "objectNodeId") {
        let object_view_id = format!("entity:{object_node_id}");
        return expanded_node_ids.iter().any(|node_id| node_id == &object_view_id);
    }
    false
}

fn append_memory_graph_stored_edges_for_view(
    connection: &Connection,
    scope: &str,
    context: &serde_json::Value,
    max_nodes: usize,
    nodes: &mut Vec<serde_json::Value>,
    edges: &mut Vec<serde_json::Value>,
    node_ids: &mut std::collections::HashSet<String>,
    edge_ids: &mut std::collections::HashSet<String>,
    truncated: &mut bool,
) -> Result<(), String> {
    let mut statement = connection
        .prepare(
            "SELECT id, scope, from_node_id, type, to_node_id, confidence, visibility, properties_json, created_at, updated_at
             FROM memory_edges WHERE scope = ?1",
        )
        .map_err(|error| error.to_string())?;
    let rows = statement
        .query_map(params![scope], memory_graph_edge_row_to_json)
        .map_err(|error| error.to_string())?;
    let stored_edges = rows.collect::<Result<Vec<_>, _>>().map_err(|error| error.to_string())?;
    for edge in stored_edges {
        let visibility = edge
            .get("visibility")
            .and_then(|value| value.as_str())
            .or_else(|| edge.get("properties").and_then(|props| props.get("visibility")).and_then(|value| value.as_str()))
            .unwrap_or("public")
            .to_string();
        if !memory_graph_viewer_can_read_edge_visibility(&visibility, context) {
            continue;
        }
        let from_node_id = memory_graph_json_string(&edge, "fromNodeId", &memory_graph_json_string(&edge, "from", ""));
        let to_node_id = memory_graph_json_string(&edge, "toNodeId", &memory_graph_json_string(&edge, "to", ""));
        let Some(from_node) = read_memory_graph_node_by_id(connection, &from_node_id)? else {
            continue;
        };
        let Some(to_node) = read_memory_graph_node_by_id(connection, &to_node_id)? else {
            continue;
        };
        if !memory_graph_push_view_node(
            nodes,
            node_ids,
            max_nodes,
            memory_graph_entity_view_node_with_role(&from_node, "related", None),
        ) {
            *truncated = true;
            break;
        }
        if !memory_graph_push_view_node(
            nodes,
            node_ids,
            max_nodes,
            memory_graph_entity_view_node_with_role(&to_node, "related", None),
        ) {
            *truncated = true;
            break;
        }
        let from_view_id = format!("entity:{from_node_id}");
        let to_view_id = format!("entity:{to_node_id}");
        let edge_type = memory_graph_json_string(&edge, "type", "ABOUT");
        memory_graph_push_view_edge(
            edges,
            edge_ids,
            node_ids,
            serde_json::json!({
                "id": format!("edge:{}", memory_graph_json_string(&edge, "id", "")),
                "from": from_view_id,
                "to": to_view_id,
                "type": memory_graph_view_edge_type(&edge_type),
                "label": edge_type,
                "visibility": visibility,
                "dashed": memory_graph_visibility_is_private(&visibility)
            }),
        );
    }
    Ok(())
}

fn memory_graph_viewer_can_read_edge_visibility(visibility: &str, context: &serde_json::Value) -> bool {
    if visibility == "public" || visibility == "global" {
        return true;
    }
    let viewer = context.get("viewer").unwrap_or(&serde_json::Value::Null);
    let viewer_type = memory_graph_json_string(viewer, "type", "global");
    if viewer_type == "director" {
        return true;
    }
    if viewer_type == "room_faction" || viewer_type == "room_role" {
        return visibility == "faction";
    }
    viewer_type == "one_on_one" && visibility == "private_character"
}

fn memory_graph_view_edge_type(edge_type: &str) -> String {
    match edge_type {
        "CONFLICTS_WITH" | "SUPERSEDES" | "MEMBER_OF" | "HAS_GOAL" | "KNOWN_BY" | "ASSERTED_BY" | "OWNS" | "LOCATED_IN" | "TARGETS" | "SUPPORTS" | "MENTIONS" => edge_type.to_string(),
        _ => "ABOUT".to_string(),
    }
}

fn memory_graph_relationship_view_edge_type(claim: &serde_json::Value) -> String {
    let predicate = memory_graph_json_string(claim, "predicate", "mentions");
    let kind = memory_graph_json_string(claim, "kind", "fact");
    match (predicate.as_str(), kind.as_str()) {
        ("has_goal", _) | (_, "goal") => "HAS_GOAL".to_string(),
        ("located_in", _) => "LOCATED_IN".to_string(),
        ("has_item", _) | (_, "item") => "OWNS".to_string(),
        ("asserts_stance", _) | (_, "stance") | (_, "argument") => "SUPPORTS".to_string(),
        (_, "secret") | (_, "clue") => "MENTIONS".to_string(),
        _ => "ABOUT".to_string(),
    }
}

fn read_memory_graph_node_by_id(connection: &Connection, id: &str) -> Result<Option<serde_json::Value>, String> {
    if id.is_empty() {
        return Ok(None);
    }
    match connection.query_row(
        "SELECT id, scope, kind, canonical_key, display_name, properties_json FROM memory_nodes WHERE id = ?1",
        params![id],
        |row| {
            let properties_json: String = row.get(5)?;
            let properties = serde_json::from_str::<serde_json::Value>(&properties_json).unwrap_or_else(|_| serde_json::json!({}));
            Ok(serde_json::json!({
                "id": row.get::<_, String>(0)?,
                "scope": row.get::<_, String>(1)?,
                "kind": row.get::<_, String>(2)?,
                "canonicalKey": row.get::<_, String>(3)?,
                "displayName": row.get::<_, String>(4)?,
                "properties": properties
            }))
        },
    ) {
        Ok(node) => Ok(Some(node)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

fn memory_graph_claim_view_node(claim: &serde_json::Value) -> serde_json::Value {
    let id = memory_graph_json_string(claim, "id", "");
    let kind = memory_graph_json_string(claim, "kind", "fact");
    let status = memory_graph_json_string(claim, "status", "active");
    let confidence = memory_graph_json_f64(claim, "confidence", 0.0);
    let caption = memory_graph_claim_semantic_caption(claim);
    let category_group = memory_graph_claim_category_group(claim);
    serde_json::json!({
        "id": format!("claim:{id}"),
        "kind": "claim",
        "label": caption.clone(),
        "subtitle": format!("{kind} · {status} · {}%", (confidence * 100.0).round() as i64),
        "scope": memory_graph_json_string(claim, "scope", "global"),
        "claimKind": kind,
        "status": status,
        "visibility": memory_graph_json_string(claim, "visibility", "public"),
        "authority": memory_graph_json_string(claim, "authority", "system"),
        "confidence": confidence,
        "evidenceCount": memory_graph_json_i64(claim, "evidenceCount", 1),
        "text": memory_graph_json_string(claim, "text", ""),
        "redacted": false,
        "sourceClaimId": id,
        "nodeCaption": caption,
        "semanticKind": memory_graph_json_string(claim, "kind", "fact"),
        "categoryGroup": category_group,
        "graphSyncState": "ready"
    })
}

fn memory_graph_claim_semantic_caption(claim: &serde_json::Value) -> String {
    let kind = memory_graph_json_string(claim, "kind", "fact");
    let text = memory_graph_json_string(claim, "text", "");
    let body = if kind == "preference" {
        memory_graph_preference_caption_value(claim)
            .unwrap_or_else(|| memory_graph_compact_claim_body(&text, &kind))
    } else {
        memory_graph_compact_claim_body(&text, &kind)
    };
    memory_graph_short_concept(
        &format!("{} · {}", memory_graph_claim_kind_label(&kind), if body.is_empty() { "-" } else { body.as_str() }),
        34,
    )
}

fn memory_graph_claim_kind_label(kind: &str) -> &'static str {
    match kind {
        "preference" => "偏好",
        "judgement" => "裁定",
        "constraint" => "限制",
        "secret" => "秘密",
        "clue" => "线索",
        "goal" => "目标",
        "plan" => "计划",
        "task" => "任务",
        "stance" => "观点",
        "argument" => "论点",
        "relationship" => "关系",
        "identity" => "身份",
        "item" => "物品",
        "scene" => "场景",
        "conflict" => "冲突",
        _ => "事实",
    }
}

fn memory_graph_claim_category_group(claim: &serde_json::Value) -> &'static str {
    let kind = memory_graph_json_string(claim, "kind", "fact");
    let status = memory_graph_json_string(claim, "status", "active");
    let visibility = memory_graph_json_string(claim, "visibility", "public");
    let confidence = memory_graph_json_f64(claim, "confidence", 1.0);
    if status == "disputed" || kind == "conflict" {
        return "conflict";
    }
    if status == "needs_review" || confidence < 0.45 || status == "rejected" || status == "archived" {
        return "quality";
    }
    if kind == "judgement" {
        return "judgement";
    }
    if matches!(kind.as_str(), "constraint" | "scene" | "item") {
        return "continuity";
    }
    if kind == "secret" || visibility == "director_only" || visibility == "known_to_roles" {
        return "hidden";
    }
    if visibility == "faction" || kind == "goal" || kind == "plan" {
        return "faction_strategy";
    }
    "fact"
}

fn memory_graph_preference_caption_value(claim: &serde_json::Value) -> Option<String> {
    for candidate in [
        memory_graph_json_string(claim, "canonicalKey", ""),
        memory_graph_json_string(claim, "text", ""),
    ] {
        for value in memory_graph_preference_value_candidates(&candidate) {
            if memory_graph_is_concise_preference_value(&value) {
                return Some(value);
            }
        }
    }
    None
}

fn memory_graph_compact_claim_body(text: &str, kind: &str) -> String {
    let mut output = text.trim().to_string();
    for prefix in [
        format!("{kind}:"),
        format!("{kind}："),
        "用户相关事实:".to_string(),
        "用户相关事实：".to_string(),
        "房间相关事实:".to_string(),
        "房间相关事实：".to_string(),
        "事实:".to_string(),
        "事实：".to_string(),
        "记忆:".to_string(),
        "记忆：".to_string(),
    ] {
        if let Some(stripped) = output.strip_prefix(&prefix) {
            output = stripped.trim().to_string();
            break;
        }
    }
    output
        .split(|ch| matches!(ch, '。' | '.' | '!' | '?' | '？' | '；' | ';'))
        .next()
        .unwrap_or("")
        .trim()
        .to_string()
}

fn memory_graph_short_concept(value: &str, max_chars: usize) -> String {
    let clean = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let char_count = clean.chars().count();
    if char_count <= max_chars {
        return if clean.is_empty() { "-".to_string() } else { clean };
    }
    let keep = max_chars.saturating_sub(1).max(1);
    format!("{}…", clean.chars().take(keep).collect::<String>())
}

fn memory_graph_entity_view_node_with_role(
    node: &serde_json::Value,
    entity_role: &str,
    claim: Option<&serde_json::Value>,
) -> serde_json::Value {
    let id = memory_graph_json_string(node, "id", "");
    let object_label = if entity_role == "object" {
        claim.and_then(|claim| memory_graph_preference_object_label(claim, node))
    } else {
        None
    };
    let node_kind = memory_graph_json_string(node, "kind", "unknown");
    serde_json::json!({
        "id": format!("entity:{id}"),
        "kind": "entity",
        "label": object_label.clone().unwrap_or_else(|| memory_graph_json_string(node, "displayName", &id)),
        "subtitle": if entity_role == "object" && object_label.is_some() { format!("{node_kind} 路 value") } else { node_kind.clone() },
        "scope": memory_graph_json_string(node, "scope", "global"),
        "entityRole": entity_role,
        "nodeKind": node_kind
    })
}

fn memory_graph_should_hide_object_node(claim: &serde_json::Value, object: &serde_json::Value) -> bool {
    if let Some(preference_value) = memory_graph_preference_object_label(claim, object) {
        let claim_text = memory_graph_normalized_text(&memory_graph_json_string(claim, "text", ""));
        let value_text = memory_graph_normalized_text(&preference_value);
        return !value_text.is_empty() && claim_text.contains(&value_text);
    }
    let object_text = memory_graph_normalized_text(&memory_graph_json_string(object, "displayName", ""));
    let object_key = memory_graph_normalized_text(&memory_graph_json_string(object, "canonicalKey", ""));
    let claim_text = memory_graph_normalized_text(&memory_graph_json_string(claim, "text", ""));
    let claim_key = memory_graph_normalized_text(&memory_graph_json_string(claim, "canonicalKey", ""));
    if object_text.is_empty() || claim_text.is_empty() {
        return false;
    }
    object_text == claim_text || object_key == claim_key
}

fn memory_graph_preference_object_label(claim: &serde_json::Value, object: &serde_json::Value) -> Option<String> {
    if memory_graph_json_string(claim, "kind", "") != "preference" {
        return None;
    }
    for candidate in [
        memory_graph_json_string(object, "canonicalKey", ""),
        memory_graph_json_string(object, "displayName", ""),
        memory_graph_json_string(claim, "text", ""),
    ] {
        for value in memory_graph_preference_value_candidates(&candidate) {
            if memory_graph_is_concise_preference_value(&value) {
                return Some(value);
            }
        }
    }
    None
}

fn memory_graph_preference_value_candidates(source: &str) -> Vec<String> {
    let mut values = Vec::new();
    let clean = source.trim();
    if !clean.is_empty() {
        values.push(clean.to_string());
    }
    for separator in [":", "：", "=", "是", "为"] {
        if let Some((_, value)) = clean.rsplit_once(separator) {
            let next = value
                .split(|ch| matches!(ch, '。' | '，' | ',' | ';' | '；' | '|' | '\n' | '\r'))
                .next()
                .unwrap_or("")
                .trim();
            if !next.is_empty() {
                values.push(next.to_string());
            }
        }
    }
    values
}

fn memory_graph_is_concise_preference_value(value: &str) -> bool {
    let clean = value.trim_matches(|ch: char| ch == '"' || ch == '\'' || ch.is_whitespace());
    if clean.is_empty() || clean.chars().count() > 32 {
        return false;
    }
    let lower = clean.to_lowercase();
    !(lower.contains("preference") || lower.contains("prefer") || clean.contains("用户偏好") || clean.contains("偏好") || clean.contains("喜欢"))
}

fn memory_graph_normalized_text(value: &str) -> String {
    value
        .chars()
        .filter(|ch| !ch.is_whitespace() && !matches!(ch, '。' | '，' | ',' | ';' | '；' | ':' | '：' | '=' | '|'))
        .flat_map(|ch| ch.to_lowercase())
        .collect()
}

fn memory_graph_push_view_node(
    nodes: &mut Vec<serde_json::Value>,
    node_ids: &mut std::collections::HashSet<String>,
    max_nodes: usize,
    node: serde_json::Value,
) -> bool {
    let id = memory_graph_json_string(&node, "id", "");
    if id.is_empty() || node_ids.contains(&id) {
        return true;
    }
    if node_ids.len() >= max_nodes {
        return false;
    }
    node_ids.insert(id);
    nodes.push(node);
    true
}

fn memory_graph_push_view_edge(
    edges: &mut Vec<serde_json::Value>,
    edge_ids: &mut std::collections::HashSet<String>,
    node_ids: &std::collections::HashSet<String>,
    edge: serde_json::Value,
) {
    let id = memory_graph_json_string(&edge, "id", "");
    let from = memory_graph_json_string(&edge, "from", "");
    let to = memory_graph_json_string(&edge, "to", "");
    if id.is_empty() || edge_ids.contains(&id) || !node_ids.contains(&from) || !node_ids.contains(&to) {
        return;
    }
    edge_ids.insert(id);
    edges.push(edge);
}

fn memory_graph_scope_label(scope: &str) -> String {
    if scope == "global" {
        "Global".to_string()
    } else if let Some(room_id) = scope.strip_prefix("room:") {
        format!("Room {room_id}")
    } else if let Some(pack_id) = scope.strip_prefix("character:") {
        format!("Character {pack_id}")
    } else {
        scope.to_string()
    }
}

fn memory_graph_visibility_is_private(visibility: &str) -> bool {
    matches!(visibility, "known_to_roles" | "faction" | "director_only" | "private_character")
}

fn memory_graph_claim_matches_view_filters(
    claim: &serde_json::Value,
    filters: &serde_json::Value,
    connection: &Connection,
) -> bool {
    if let Some(kinds) = filters.get("kinds").and_then(|value| value.as_array()) {
        if !kinds.is_empty() && !kinds.iter().any(|value| value.as_str() == Some(&memory_graph_json_string(claim, "kind", ""))) {
            return false;
        }
    }
    if let Some(statuses) = filters.get("statuses").and_then(|value| value.as_array()) {
        if !statuses.is_empty() && !statuses.iter().any(|value| value.as_str() == Some(&memory_graph_json_string(claim, "status", ""))) {
            return false;
        }
    }
    if let Some(visibilities) = filters.get("visibilities").and_then(|value| value.as_array()) {
        if !visibilities.is_empty() && !visibilities.iter().any(|value| value.as_str() == Some(&memory_graph_json_string(claim, "visibility", ""))) {
            return false;
        }
    }
    let search = filters
        .get("search")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .trim()
        .to_lowercase();
    if search.is_empty() {
        return true;
    }
    let subject = memory_graph_json_string(claim, "subjectNodeId", "");
    let object = memory_graph_json_optional_string(claim, "objectNodeId").unwrap_or_default();
    let subject_name = read_memory_graph_node_by_id(connection, &subject)
        .ok()
        .flatten()
        .map(|node| memory_graph_json_string(&node, "displayName", ""))
        .unwrap_or_default();
    let object_name = read_memory_graph_node_by_id(connection, &object)
        .ok()
        .flatten()
        .map(|node| memory_graph_json_string(&node, "displayName", ""))
        .unwrap_or_default();
    [
        memory_graph_json_string(claim, "text", ""),
        memory_graph_json_string(claim, "kind", ""),
        memory_graph_json_string(claim, "status", ""),
        memory_graph_json_string(claim, "visibility", ""),
        subject_name,
        object_name,
    ]
    .join("\n")
    .to_lowercase()
    .contains(&search)
}

fn count_hidden_private_memory_graph_claims(
    connection: &Connection,
    scope: &str,
    context: &serde_json::Value,
) -> Result<i64, String> {
    let viewer = context.get("viewer").unwrap_or(&serde_json::Value::Null);
    if memory_graph_json_string(viewer, "type", "global") == "director" {
        return Ok(0);
    }
    connection
        .query_row(
            "SELECT COUNT(*) FROM memory_claims WHERE scope = ?1 AND visibility IN ('known_to_roles', 'faction', 'director_only', 'private_character')",
            params![scope],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| error.to_string())
}

fn export_memory_graph_neo4j(connection: &Connection, scope: Option<&str>) -> Result<serde_json::Value, String> {
    let mut nodes_statement = if scope.is_some() {
        connection
            .prepare("SELECT id, scope, kind, canonical_key, display_name, properties_json FROM memory_nodes WHERE scope = ?1")
            .map_err(|error| error.to_string())?
    } else {
        connection
            .prepare("SELECT id, scope, kind, canonical_key, display_name, properties_json FROM memory_nodes")
            .map_err(|error| error.to_string())?
    };
    let nodes_iter = if let Some(scope) = scope {
        nodes_statement
            .query_map(params![scope], |row| {
                let properties_json: String = row.get(5)?;
                let properties = serde_json::from_str::<serde_json::Value>(&properties_json).unwrap_or_else(|_| serde_json::json!({}));
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "labels": [row.get::<_, String>(2)?],
                    "properties": {
                        "scope": row.get::<_, String>(1)?,
                        "canonicalKey": row.get::<_, String>(3)?,
                        "displayName": row.get::<_, String>(4)?,
                        "extra": properties
                    }
                }))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    } else {
        nodes_statement
            .query_map([], |row| {
                let properties_json: String = row.get(5)?;
                let properties = serde_json::from_str::<serde_json::Value>(&properties_json).unwrap_or_else(|_| serde_json::json!({}));
                Ok(serde_json::json!({
                    "id": row.get::<_, String>(0)?,
                    "labels": [row.get::<_, String>(2)?],
                    "properties": {
                        "scope": row.get::<_, String>(1)?,
                        "canonicalKey": row.get::<_, String>(3)?,
                        "displayName": row.get::<_, String>(4)?,
                        "extra": properties
                    }
                }))
            })
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };

    let mut relationships_statement = if scope.is_some() {
        connection
            .prepare("SELECT id, from_node_id, type, to_node_id, confidence, visibility, properties_json FROM memory_edges WHERE scope = ?1")
            .map_err(|error| error.to_string())?
    } else {
        connection
            .prepare("SELECT id, from_node_id, type, to_node_id, confidence, visibility, properties_json FROM memory_edges")
            .map_err(|error| error.to_string())?
    };
    let relationships = if let Some(scope) = scope {
        relationships_statement
            .query_map(params![scope], memory_graph_edge_row_to_json)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    } else {
        relationships_statement
            .query_map([], memory_graph_edge_row_to_json)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?
    };
    Ok(serde_json::json!({ "nodes": nodes_iter, "relationships": relationships }))
}

fn memory_graph_edge_row_to_json(row: &rusqlite::Row<'_>) -> rusqlite::Result<serde_json::Value> {
    let properties_json: String = row.get(6)?;
    let properties = serde_json::from_str::<serde_json::Value>(&properties_json).unwrap_or_else(|_| serde_json::json!({}));
    Ok(serde_json::json!({
        "id": row.get::<_, String>(0)?,
        "fromNodeId": row.get::<_, String>(1)?,
        "from": row.get::<_, String>(1)?,
        "type": row.get::<_, String>(2)?,
        "toNodeId": row.get::<_, String>(3)?,
        "to": row.get::<_, String>(3)?,
        "confidence": row.get::<_, f64>(4)?,
        "visibility": row.get::<_, String>(5)?,
        "properties": {
            "confidence": row.get::<_, f64>(4)?,
            "visibility": row.get::<_, String>(5)?,
            "extra": properties
        }
    }))
}

fn character_pack_memory_file_path(root: &Path, pack_id: &str, scope: &str) -> Result<PathBuf, String> {
    if scope == format!("character:{pack_id}") {
        return assert_path_inside_root(&root.join("character.json"), root);
    }
    if let Some(rest) = scope.strip_prefix("room:") {
        let parts = rest.split(':').collect::<Vec<_>>();
        if parts.len() == 3 && parts[1] == "role" {
            let path = root
                .join("rooms")
                .join(safe_pack_id(parts[0]))
                .join(format!("{}.json", safe_pack_id(parts[2])));
            return assert_path_inside_root(&path, root);
        }
    }
    Err("Only character and room role memory can be stored in character packs.".to_string())
}

fn collect_memory_json_files(root: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            collect_memory_json_files(&path, files)?;
        } else if path.extension().and_then(|value| value.to_str()).map(|value| value.eq_ignore_ascii_case("json")).unwrap_or(false) {
            files.push(path);
        }
    }
    Ok(())
}

fn copy_character_asset(target_dir: &Path, asset: &CharacterAssetDraftDto) -> Result<(), String> {
    let folder = character_asset_slot_folder(target_dir, &asset.slot)?;
    if asset.action.as_deref() == Some("keep") {
        return Ok(());
    }
    if asset.action.as_deref() == Some("remove") {
        remove_character_asset_image_files(&folder)?;
        return Ok(());
    }

    if let Some(data_url) = asset
        .source_data_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return write_character_asset_data_url(&folder, asset, data_url);
    }

    let source = PathBuf::from(asset.source_path.trim());
    if asset.source_path.trim().is_empty() {
        return Ok(());
    }
    if !source.exists() || !source.is_file() {
        return Err(format!("Image file was not found: {}", asset.source_path));
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "gif") {
        return Err("Only png, jpg, jpeg, and gif images are supported.".to_string());
    }
    let metadata = fs::metadata(&source).map_err(|error| error.to_string())?;
    if metadata.len() > MAX_CHARACTER_ASSET_BYTES {
        return Err("Image file is too large.".to_string());
    }
    let bytes = fs::read(&source).map_err(|error| error.to_string())?;
    fs::create_dir_all(&folder).map_err(|error| error.to_string())?;
    remove_character_asset_image_files(&folder)?;
    let target = folder.join(format!("custom.{}", extension));
    fs::write(target, bytes).map_err(|error| error.to_string())?;
    Ok(())
}

fn write_character_asset_data_url(folder: &Path, asset: &CharacterAssetDraftDto, data_url: &str) -> Result<(), String> {
    let extension = character_asset_upload_extension(asset, data_url)?;
    let bytes = decode_data_url(data_url)?;
    if bytes.len() as u64 > MAX_CHARACTER_ASSET_BYTES {
        return Err("Image file is too large.".to_string());
    }
    fs::create_dir_all(folder).map_err(|error| error.to_string())?;
    remove_character_asset_image_files(folder)?;
    fs::write(folder.join(format!("custom.{extension}")), bytes).map_err(|error| error.to_string())?;
    Ok(())
}

fn remove_character_asset_image_files(folder: &Path) -> Result<(), String> {
    if !folder.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(folder).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().map_err(|error| error.to_string())?.is_file() {
            continue;
        }
        let path = entry.path();
        let extension = path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "gif") {
            fs::remove_file(path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn character_asset_upload_extension(asset: &CharacterAssetDraftDto, data_url: &str) -> Result<String, String> {
    if let Some(extension) = asset
        .file_name
        .as_deref()
        .and_then(|name| Path::new(name).extension())
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .filter(|value| matches!(value.as_str(), "png" | "jpg" | "jpeg" | "gif"))
    {
        return Ok(extension);
    }

    let header = data_url
        .split_once(',')
        .map(|(header, _)| header)
        .ok_or_else(|| "Selected image data is not valid.".to_string())?;
    let extension = if header.contains("image/png") {
        "png"
    } else if header.contains("image/jpeg") || header.contains("image/jpg") {
        "jpg"
    } else if header.contains("image/gif") {
        "gif"
    } else {
        return Err("Only png, jpg, jpeg, and gif images are supported.".to_string());
    };
    Ok(extension.to_string())
}

fn decode_data_url(data_url: &str) -> Result<Vec<u8>, String> {
    let (header, payload) = data_url
        .split_once(',')
        .ok_or_else(|| "Selected image data is not valid.".to_string())?;
    if !header.contains(";base64") {
        return Err("Selected image data must be base64 encoded.".to_string());
    }
    decode_base64_payload(payload)
}

fn decode_base64_payload(payload: &str) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::with_capacity(payload.len() * 3 / 4);
    let mut buffer: u32 = 0;
    let mut bits = 0u8;
    for byte in payload.bytes().filter(|byte| !byte.is_ascii_whitespace()) {
        if byte == b'=' {
            break;
        }
        let value = base64_value(byte).ok_or_else(|| "Selected image data is not valid base64.".to_string())?;
        buffer = (buffer << 6) | u32::from(value);
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            bytes.push(((buffer >> bits) & 0xff) as u8);
        }
    }
    Ok(bytes)
}

fn base64_value(byte: u8) -> Option<u8> {
    match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

fn character_asset_slot_folder(target_dir: &Path, slot: &str) -> Result<PathBuf, String> {
    if slot == "idle" {
        return Ok(target_dir.join("idle"));
    }
    if let Some(emotion) = slot.strip_prefix("emotion:") {
        return Ok(target_dir.join("emotions").join(safe_pack_id(emotion)));
    }
    Err(format!("Unknown character image slot: {slot}"))
}

fn safe_pack_id(value: &str) -> String {
    let mut result = String::new();
    let mut last_dash = false;
    for ch in value.trim().to_ascii_lowercase().chars() {
        if ch.is_ascii_alphanumeric() {
            result.push(ch);
            last_dash = false;
        } else if !last_dash {
            result.push('-');
            last_dash = true;
        }
    }
    let result = result.trim_matches('-').to_string();
    if result.is_empty() { "character".to_string() } else { result }
}

fn unique_pack_id(root: &Path, desired: &str, current: Option<&str>) -> String {
    let base = safe_pack_id(desired);
    if current == Some(base.as_str()) || !root.join(&base).exists() {
        return base;
    }
    for index in 2..10_000 {
        let candidate = format!("{base}-{index}");
        if current == Some(candidate.as_str()) || !root.join(&candidate).exists() {
            return candidate;
        }
    }
    format!("{}-{}", base, current_unix_ms_string())
}

fn toml_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

fn default_if_blank<'a>(value: &'a str, fallback: &'a str) -> &'a str {
    if value.trim().is_empty() {
        fallback
    } else {
        value.trim()
    }
}

fn scan_character_assets(root: &Path) -> Result<Vec<ImportedAssetGroupDto>, String> {
    let mut groups = Vec::new();
    for folder in ["idle", "icons", "preview"] {
        let path = root.join(folder);
        if path.exists() {
            groups.push(ImportedAssetGroupDto {
                folder: folder.to_string(),
                candidates: scan_asset_candidates(&path)?,
            });
        }
    }
    let emotions = root.join("emotions");
    if emotions.exists() {
        for entry in fs::read_dir(emotions).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            if entry.file_type().map_err(|error| error.to_string())?.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                groups.push(ImportedAssetGroupDto {
                    folder: format!("emotions/{name}"),
                    candidates: scan_asset_candidates(&entry.path())?,
                });
            }
        }
    }
    Ok(groups)
}

fn scan_asset_candidates(path: &Path) -> Result<Vec<ImportedAssetCandidateDto>, String> {
    let mut candidates = Vec::new();
    for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        if !entry.file_type().map_err(|error| error.to_string())?.is_file() {
            continue;
        }
        let extension = entry
            .path()
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "gif") {
            candidates.push(ImportedAssetCandidateDto {
                src: Some(entry.path().to_string_lossy().to_string()),
                text: None,
                animated: extension == "gif",
                format: extension,
                kind: "image".to_string(),
            });
        } else if matches!(extension.as_str(), "txt" | "art" | "ansi") {
            let metadata = fs::metadata(entry.path()).map_err(|error| error.to_string())?;
            if metadata.len() > MAX_CHARACTER_TEXT_ASSET_BYTES {
                continue;
            }
            let raw = fs::read_to_string(entry.path()).map_err(|error| error.to_string())?;
            candidates.push(ImportedAssetCandidateDto {
                src: Some(entry.path().to_string_lossy().to_string()),
                text: Some(sanitize_character_text_asset(&raw)),
                animated: false,
                format: extension,
                kind: "text".to_string(),
            });
        }
    }
    Ok(candidates)
}

fn sanitize_character_text_asset(text: &str) -> String {
    let mut output = String::new();
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '\u{1b}' && chars.peek() == Some(&'[') {
            chars.next();
            for next in chars.by_ref() {
                if ('@'..='~').contains(&next) {
                    break;
                }
            }
            continue;
        }
        if ch == '\n' || ch == '\r' || ch == '\t' || (!ch.is_control() && ch != '\u{7f}') {
            output.push(ch);
        }
    }
    output.trim_end().to_string()
}

fn copy_dir_recursive(from: &Path, to: &Path) -> Result<(), String> {
    fs::create_dir_all(to).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(from).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let target = to.join(entry.file_name());
        if entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            copy_dir_recursive(&entry.path(), &target)?;
        } else {
            fs::copy(entry.path(), target).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn remove_character_pack_private_dirs(pack_dir: &Path) -> Result<(), String> {
    for name in ["history", "memory"] {
        let path = pack_dir.join(name);
        if path.exists() {
            fs::remove_dir_all(path).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn move_character_pack_to_deleted(source_dir: &Path, target_dir: &Path) -> Result<(), String> {
    match fs::rename(source_dir, target_dir) {
        Ok(()) => Ok(()),
        Err(rename_error) => {
            copy_dir_recursive(source_dir, target_dir).map_err(|copy_error| {
                format!(
                    "Character pack could not be moved to the deleted backup. Rename failed: {rename_error}; copy fallback failed: {copy_error}"
                )
            })?;
            clear_readonly_recursive(source_dir).map_err(|clear_error| {
                format!(
                    "Character pack was copied to the deleted backup, but its original folder could not be unlocked for removal: {clear_error}"
                )
            })?;
            fs::remove_dir_all(source_dir).map_err(|remove_error| {
                format!(
                    "Character pack was copied to the deleted backup, but its original folder could not be removed. Close any app using its files and try again. Error: {remove_error}"
                )
            })?;
            Ok(())
        }
    }
}

fn delete_character_private_data(app: &AppHandle, source_id: &str) -> Result<(), String> {
    let direct_room_dir = direct_room_history_dir(app, source_id, false)?;
    remove_dir_if_exists(&direct_room_dir)?;

    let memory_scope = format!("character:{source_id}");
    let memory_path = memory_scope_file_path(app, &memory_scope, false)?;
    remove_file_if_exists(&memory_path)?;

    Ok(())
}

fn remove_character_pack_dir(source_dir: &Path) -> Result<(), String> {
    clear_readonly_recursive(source_dir).map_err(|error| {
        format!("Character pack could not be unlocked for deletion. Close any app using its files and try again. Error: {error}")
    })?;
    fs::remove_dir_all(source_dir).map_err(|error| {
        format!("Character pack could not be deleted. Close any app using its files and try again. Error: {error}")
    })
}

fn remove_dir_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn clear_readonly_recursive(path: &Path) -> Result<(), String> {
    if path.is_dir() {
        for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            clear_readonly_recursive(&entry.path())?;
        }
    }
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    let mut permissions = metadata.permissions();
    if permissions.readonly() {
        permissions.set_readonly(false);
        fs::set_permissions(path, permissions).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn scan_release_dir(
    root: &Path,
    files: &mut usize,
    bytes: &mut u64,
    forbidden_findings: &mut Vec<String>,
) -> Result<(), String> {
    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if entry.file_type().map_err(|error| error.to_string())?.is_dir() {
            scan_release_dir(&path, files, bytes, forbidden_findings)?;
            continue;
        }
        *files += 1;
        *bytes += fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
        let lower = path.to_string_lossy().to_ascii_lowercase();
        if lower.contains("api_key")
            || lower.contains("secret")
            || lower.contains("diagnostic")
            || lower.contains("runtime/cache")
            || lower.ends_with("rustc.exe")
            || lower.ends_with("cargo.exe")
        {
            forbidden_findings.push(path.to_string_lossy().to_string());
        }
    }
    Ok(())
}

fn default_voice_state(app: &AppHandle) -> Result<VoiceServiceStateDto, String> {
    Ok(VoiceServiceStateDto {
        stt_status: "off".to_string(),
        tts_status: "user_configured_api_only".to_string(),
        stt_backend: "whisper_cpp".to_string(),
        preferred_tts_backend: "cloud_tts".to_string(),
        active_tts_backend: "cloud_tts".to_string(),
        permission_state: "off".to_string(),
        model: voice_cancel_model_download(app.clone())?,
        available_voices: default_tts_voices(),
        selected_voice_id: None,
        microphone_mode: "push_to_talk".to_string(),
        tts_enabled: false,
        tts_language: "auto".to_string(),
        subtitle_language: "auto".to_string(),
        echo_cancellation_enabled: true,
        room_tts_policy: "disabled".to_string(),
        last_message: "Voice input is off. TTS uses the configured TTS API only.".to_string(),
        last_transcription: String::new(),
        last_synthesis_message: String::new(),
    })
}

fn normalize_voice_model_id(value: &str) -> Result<String, String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "" | "tiny" => Ok("tiny".to_string()),
        "base" => Ok("base".to_string()),
        other => Err(format!("Unsupported STT model: {other}")),
    }
}

fn voice_model_path(app: &AppHandle, model: &str) -> Result<PathBuf, String> {
    let root = app_data_dir(app)?.join("voice-models");
    fs::create_dir_all(&root).map_err(|error| error.to_string())?;
    assert_path_inside_root(&root.join(format!("ggml-{model}.bin")), &root)
}

fn voice_model_file_is_usable(path: &Path) -> bool {
    path.exists()
        && fs::metadata(path)
            .map(|meta| {
                let len = meta.len();
                len > 1_000_000 && len <= MAX_VOICE_MODEL_BYTES
            })
            .unwrap_or(false)
}

fn voice_model_file_is_verified(path: &Path, _model: &str) -> bool {
    voice_model_file_is_usable(path)
}

fn verify_voice_model_file(path: &Path, model: &str) -> Result<(), String> {
    if voice_model_file_is_verified(path, model) {
        Ok(())
    } else {
        Err("Downloaded STT model is missing or too small.".to_string())
    }
}

fn voice_model_expected_sha256(_model: &str) -> String {
    "manual-download-required".to_string()
}

fn voice_model_expected_size(model: &str) -> u64 {
    if model == "base" { 148_000_000 } else { 75_000_000 }
}

fn voice_model_download_url(model: &str) -> String {
    format!("https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{model}.bin")
}

fn whisper_runner_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = resource_root(app)?;
    let candidates = [
        root.join("runners").join("whisper.cpp").join("Release").join("whisper-cli.exe"),
        root.join("runners").join("whisper.cpp").join("Release").join("main.exe"),
    ];
    candidates
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| "whisper.cpp runner was not found.".to_string())
}

fn parse_whisper_output(value: &str) -> String {
    value
        .lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .filter(|line| !line.starts_with('['))
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .to_string()
}

fn default_tts_voices() -> Vec<TtsVoiceInfoDto> {
    vec![
        TtsVoiceInfoDto {
            id: "default".to_string(),
            name: "Service default".to_string(),
            locale: "auto".to_string(),
            backend: "cloud_tts".to_string(),
        },
        TtsVoiceInfoDto {
            id: "manual".to_string(),
            name: "Manual Voice ID".to_string(),
            locale: "auto".to_string(),
            backend: "cloud_tts".to_string(),
        },
    ]
}

fn synthesize_with_windows_speech(
    _app: &AppHandle,
    _text: &str,
    voice_id: &str,
    backend: &str,
) -> TtsResultDto {
    TtsResultDto {
        ok: false,
        backend: backend.to_string(),
        voice_id: Some(voice_id.to_string()),
        message: "Bundled local TTS is disabled. Configure a cloud or user-provided local TTS API instead.".to_string(),
        audio_path: None,
    }
}

fn run_command_with_timeout(
    command: &mut std::process::Command,
    timeout: Duration,
) -> Result<std::process::Output, String> {
    let started = SystemTime::now();
    let mut child = command
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;
    loop {
        if let Some(_status) = child.try_wait().map_err(|error| error.to_string())? {
            return child.wait_with_output().map_err(|error| error.to_string());
        }
        if started.elapsed().unwrap_or_default() > timeout {
            let _ = child.kill();
            return Err("Command timed out.".to_string());
        }
        std::thread::sleep(Duration::from_millis(25));
    }
}

fn current_unix_ms_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn resource_root(app: &AppHandle) -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|error| error.to_string())?;
    let app_resource_dir = app.path().resource_dir().ok();
    let candidates = resource_root_candidates(&cwd, app_resource_dir.as_deref());
    for candidate in &candidates {
        if resource_root_has_local_runtime(candidate) {
            return Ok(candidate.to_path_buf());
        }
    }
    for candidate in candidates {
        if candidate.is_dir() {
            return Ok(candidate);
        }
    }
    Ok(cwd.join("resources"))
}

fn resource_root_candidates(cwd: &Path, app_resource_dir: Option<&Path>) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    for ancestor in cwd.ancestors() {
        candidates.push(ancestor.join("resources"));
    }
    if let Some(resource_dir) = app_resource_dir {
        candidates.push(resource_dir.to_path_buf());
        candidates.push(resource_dir.join("resources"));
    }

    let mut unique = Vec::new();
    for candidate in candidates {
        if !unique.iter().any(|existing: &PathBuf| existing == &candidate) {
            unique.push(candidate);
        }
    }
    unique
}

fn resource_root_has_local_runtime(root: &Path) -> bool {
    root.join("models").join("chat").is_dir()
        && root.join("runners").join("llama.cpp").join("llama-cli.exe").is_file()
}

fn read_local_model_manifests(app: &AppHandle) -> Vec<LocalModelBundle> {
    let Ok(root) = resource_root(app) else {
        return Vec::new();
    };
    let model_root = root.join("models").join("chat");
    let Ok(entries) = fs::read_dir(model_root) else {
        return Vec::new();
    };
    entries
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().map(|kind| kind.is_dir()).unwrap_or(false))
        .filter_map(|entry| {
            let dir = entry.path();
            let text = fs::read_to_string(dir.join("manifest.json")).ok()?;
            let manifest = serde_json::from_str::<LocalModelManifestDto>(&text).ok()?;
            let model_path = dir.join(&manifest.file_name);
            Some(LocalModelBundle { manifest, model_path })
        })
        .collect()
}

fn selected_local_model_bundle(app: &AppHandle, selected_model_id: Option<&str>) -> Option<LocalModelBundle> {
    let bundles = read_local_model_manifests(app);
    let selected = selected_model_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(DEFAULT_LOCAL_CHAT_MODEL_ID);
    bundles
        .iter()
        .find(|bundle| bundle.manifest.id == selected)
        .cloned()
        .or_else(|| bundles.into_iter().next())
}

fn llama_runner_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = resource_root(app)?;
    let path = root.join("runners").join("llama.cpp").join("llama-cli.exe");
    if path.exists() {
        Ok(path)
    } else {
        Err("llama.cpp runner was not found.".to_string())
    }
}

fn llama_server_path(app: &AppHandle) -> Result<PathBuf, String> {
    let root = resource_root(app)?;
    let path = root.join("runners").join("llama.cpp").join("llama-server.exe");
    if path.exists() {
        Ok(path)
    } else {
        Err("llama.cpp server runner was not found.".to_string())
    }
}

fn local_model_server_lock() -> &'static Mutex<Option<LocalModelServerProcess>> {
    LOCAL_MODEL_SERVER.get_or_init(|| Mutex::new(None))
}

fn local_model_generation_lock() -> &'static Mutex<()> {
    LOCAL_MODEL_GENERATION_LOCK.get_or_init(|| Mutex::new(()))
}

fn reserve_local_model_server_port() -> Result<u16, String> {
    let listener = TcpListener::bind((LOCAL_MODEL_SERVER_HOST, 0))
        .map_err(|error| format!("Local model server could not reserve a port: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Local model server port lookup failed: {error}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn local_model_server_health(port: u16, timeout: Duration) -> Result<(bool, String), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(timeout)
        .build()
        .map_err(|error| format!("Local model health client failed: {error}"))?;
    let url = format!("http://{LOCAL_MODEL_SERVER_HOST}:{port}/health");
    match client.get(url).send() {
        Ok(response) => {
            let status = response.status();
            if status.is_success() {
                Ok((true, "ready".to_string()))
            } else if status.as_u16() == 503 {
                Ok((false, "loading_model".to_string()))
            } else {
                Ok((false, format!("health_http_{}", status.as_u16())))
            }
        }
        Err(error) => Ok((false, format!("health_unreachable:{error}"))),
    }
}

fn local_model_server_snapshot(model_id: Option<&str>) -> Option<LocalModelServerEndpoint> {
    let mut guard = local_model_server_lock().lock().ok()?;
    let process = guard.as_mut()?;
    if let Some(expected) = model_id {
        if process.model_id != expected {
            return None;
        }
    }
    match process.child.try_wait() {
        Ok(Some(_)) => {
            *guard = None;
            None
        }
        Ok(None) => {
            let (ready, health) = local_model_server_health(process.port, Duration::from_millis(700)).ok()?;
            Some(LocalModelServerEndpoint {
                model_id: process.model_id.clone(),
                port: process.port,
                pid: process.child.id(),
                health: if ready { "ready".to_string() } else { health },
            })
        }
        Err(_) => None,
    }
}

fn stop_local_model_server() {
    if let Ok(mut guard) = local_model_server_lock().lock() {
        if let Some(mut process) = guard.take() {
            let _ = process.child.kill();
            let _ = process.child.wait();
        }
    }
}

fn ensure_local_model_server_ready(
    app: &AppHandle,
    selected_model_id: Option<&str>,
    wait_timeout: Duration,
) -> Result<LocalModelServerEndpoint, String> {
    let bundle = selected_local_model_bundle(app, selected_model_id)
        .ok_or_else(|| "No bundled local chat model manifest was found.".to_string())?;
    ensure_local_model_bundle_file(&bundle)?;
    let server_path = llama_server_path(app)?;
    let deadline = SystemTime::now() + wait_timeout;

    {
        let mut guard = local_model_server_lock()
            .lock()
            .map_err(|_| "Local model server lock is poisoned.".to_string())?;
        let reuse_existing = guard
            .as_mut()
            .and_then(|process| {
                if process.model_id != bundle.manifest.id || process.model_path != bundle.model_path {
                    let _ = process.child.kill();
                    let _ = process.child.wait();
                    return None;
                }
                match process.child.try_wait() {
                    Ok(Some(_)) => None,
                    Ok(None) => Some((process.port, process.child.id())),
                    Err(_) => None,
                }
            });

        if reuse_existing.is_none() {
            let port = reserve_local_model_server_port()?;
            let (model_arg, command_cwd) = local_model_model_arg(&bundle.model_path);
            let mut command = Command::new(&server_path);
            if let Some(command_cwd) = command_cwd {
                command.current_dir(command_cwd);
            } else if let Some(server_dir) = server_path.parent() {
                command.current_dir(server_dir);
            }
            command
                .arg("-m")
                .arg(&model_arg)
                .arg("--host")
                .arg(LOCAL_MODEL_SERVER_HOST)
                .arg("--port")
                .arg(port.to_string())
                .arg("-t")
                .arg(local_model_thread_count(&bundle.manifest).to_string())
                .arg("-c")
                .arg(local_model_context_tokens(&bundle.manifest).to_string())
                .arg("--jinja")
                .arg("--reasoning")
                .arg("off")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .stdin(Stdio::null());

            let child = command
                .spawn()
                .map_err(|error| format!("Local model server could not start: {error}"))?;
            *guard = Some(LocalModelServerProcess {
                model_id: bundle.manifest.id.clone(),
                model_path: bundle.model_path.clone(),
                port,
                child,
            });
        }
    }

    loop {
        let endpoint = {
            let mut guard = local_model_server_lock()
                .lock()
                .map_err(|_| "Local model server lock is poisoned.".to_string())?;
            let process = guard.as_mut().ok_or_else(|| "Local model server did not start.".to_string())?;
            match process.child.try_wait() {
                Ok(Some(status)) => {
                    *guard = None;
                    return Err(format!("Local model server exited before it was ready: {status}"));
                }
                Ok(None) => {
                    let (ready, health) = local_model_server_health(process.port, Duration::from_millis(900))?;
                    if ready {
                        Some(LocalModelServerEndpoint {
                            model_id: process.model_id.clone(),
                            port: process.port,
                            pid: process.child.id(),
                            health,
                        })
                    } else {
                        None
                    }
                }
                Err(error) => return Err(format!("Local model server status failed: {error}")),
            }
        };
        if let Some(endpoint) = endpoint {
            return Ok(endpoint);
        }
        if SystemTime::now() > deadline {
            let health = local_model_server_snapshot(Some(&bundle.manifest.id))
                .map(|snapshot| snapshot.health)
                .unwrap_or_else(|| "starting_server".to_string());
            return Err(format!("Local model server is not ready yet: {health}"));
        }
        std::thread::sleep(Duration::from_millis(200));
    }
}

fn ensure_local_model_runtime_for(
    app: &AppHandle,
    selected_model_id: Option<&str>,
) -> Result<LocalModelRuntime, String> {
    let bundle = selected_local_model_bundle(app, selected_model_id)
        .ok_or_else(|| "No bundled local chat model manifest was found.".to_string())?;
    ensure_local_model_bundle_file(&bundle)?;
    Ok(LocalModelRuntime {
        bundle,
        runner_path: llama_runner_path(app)?,
    })
}

fn ensure_local_model_bundle_file(bundle: &LocalModelBundle) -> Result<(), String> {
    if !bundle.model_path.exists() {
        return Err(format!("Local chat model file is missing: {}", bundle.manifest.file_name));
    }
    let min_size = bundle.manifest.size_bytes.saturating_div(2).max(1_000_000);
    if fs::metadata(&bundle.model_path).map(|meta| meta.len()).unwrap_or(0) < min_size {
        return Err("Local chat model file is incomplete or damaged.".to_string());
    }
    Ok(())
}

fn resolve_local_model_state_for_selection(
    app: &AppHandle,
    selected_model_id: Option<&str>,
    enabled: bool,
) -> LocalModelRuntimeStateDto {
    let available = read_local_model_manifests(app);
    let selected = selected_model_id
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| available.first().map(|bundle| bundle.manifest.id.clone()))
        .or_else(|| Some(DEFAULT_LOCAL_CHAT_MODEL_ID.to_string()));
    let selected_bundle = selected
        .as_deref()
        .and_then(|id| available.iter().find(|bundle| bundle.manifest.id == id))
        .or_else(|| available.first());
    let cli_ready = llama_runner_path(app).is_ok();
    let server_ready = llama_server_path(app).is_ok();
    let model_ready = selected_bundle
        .map(|bundle| bundle.model_path.exists())
        .unwrap_or(false);
    let selected_id = selected_bundle.map(|bundle| bundle.manifest.id.as_str());
    let server_snapshot = selected_id.and_then(|id| local_model_server_snapshot(Some(id)));
    let (state, runtime_mode, server_pid, server_port, server_health, runner_version, last_error) = if !enabled {
        (
            "disabled".to_string(),
            None,
            None,
            None,
            None,
            None,
            Some("Local chat model is off.".to_string()),
        )
    } else if !model_ready {
        (
            "missing_model".to_string(),
            Some("missing".to_string()),
            None,
            None,
            None,
            None,
            Some("Local chat model file is missing.".to_string()),
        )
    } else if let Some(snapshot) = server_snapshot {
        let ready = snapshot.health == "ready";
        (
            if ready { "ready".to_string() } else { "loading_model".to_string() },
            Some("server".to_string()),
            Some(snapshot.pid),
            Some(snapshot.port),
            Some(snapshot.health),
            Some("llama.cpp server sidecar".to_string()),
            if ready { None } else { Some("Local model server is loading.".to_string()) },
        )
    } else if server_ready {
        (
            "stopped".to_string(),
            Some("server".to_string()),
            None,
            None,
            Some("not_started".to_string()),
            Some("llama.cpp server sidecar".to_string()),
            Some("Local model is not loaded. It will reload next time local AI is used.".to_string()),
        )
    } else if cli_ready {
        (
            "ready".to_string(),
            Some("legacy_cli".to_string()),
            None,
            None,
            None,
            Some("llama.cpp legacy CLI fallback".to_string()),
            None,
        )
    } else {
        (
            "missing_runner".to_string(),
            Some("missing".to_string()),
            None,
            None,
            None,
            None,
            Some("Local model server and legacy CLI runner are missing.".to_string()),
        )
    };
    LocalModelRuntimeStateDto {
        enabled,
        state: state.clone(),
        selected_model_id: selected.clone(),
        model_id: selected_bundle.map(|bundle| bundle.manifest.id.clone()),
        available_models: available.iter().map(|bundle| bundle.manifest.clone()).collect(),
        install_state: if model_ready { "installed" } else { "missing" }.to_string(),
        runner_version,
        runtime_mode,
        server_pid,
        server_port,
        server_health,
        manifest: selected_bundle.map(|bundle| bundle.manifest.clone()),
        last_error,
        last_verified_at: if state == "ready" { Some(current_unix_ms_string()) } else { None },
    }
}

fn estimate_token_count(value: &str) -> u32 {
    let chars = value.chars().count() as u32;
    chars.saturating_div(3).max(1)
}

#[cfg(test)]
mod tests {
    use super::{
        clean_local_model_output, extract_llama_cli_text, resource_root_candidates,
        resource_root_has_local_runtime,
    };
    use std::{fs, path::PathBuf};

    #[test]
    fn extracts_generated_text_without_echoed_prompt() {
        let stdout = r#"
llama.cpp starting

System:
You are Mio.

User:
Say exactly: local ai ready

Assistant:

local ai ready

[ Prompt: 350.9 t/s | Generation: 81.7 t/s ]

Exiting...
"#;

        assert_eq!(extract_llama_cli_text(stdout, "Say exactly: local ai ready"), "local ai ready");
    }

    #[test]
    fn removes_multiline_prompt_display_from_llama_output() {
        let prompt = r#"Character name: Mio

Character style:
Speak naturally.

User says: hello

Now write Mio's next reply."#;
        let stdout = r#"
Loading model...

> Character name: Mio

Character style:
Speak naturally.

User says: hello

Now write Mio's next reply.

Hello!

[ Prompt: 200.0 t/s | Generation: 60.0 t/s ]

Exiting...
"#;

        assert_eq!(extract_llama_cli_text(stdout, prompt), "Hello!");
    }

    #[test]
    fn removes_thinking_and_prompt_echo_lines() {
        let value = concat!(
            "/no_think\n",
            "[Start thinking]\n",
            "I should not show this.\n",
            "[End thinking]\n",
            "- Do not pretend you can run system commands.\n",
            "- Do not claim that you can see images unless an image caption is provided.\n",
            "Voice hint: keep it short\n",
            "Room topic: testing\n",
            "\u{4f60}\u{597d}\u{ff0c}\u{6211}\u{5728}\u{3002}"
        );

        assert_eq!(
            clean_local_model_output(value),
            "\u{4f60}\u{597d}\u{ff0c}\u{6211}\u{5728}\u{3002}"
        );
    }

    #[test]
    fn removes_chinese_prompt_labels() {
        let value = "\u{8bed}\u{6c14}\u{53c2}\u{8003}\u{ff1a}\u{7b80}\u{77ed}\n\u{8fd1}\u{671f}\u{8bb0}\u{5fc6}\u{ff1a}\u{65e0}\n\u{623f}\u{95f4}\u{8bdd}\u{9898}\u{ff1a}\u{6d4b}\u{8bd5}\n\u{6211}\u{89c9}\u{5f97}\u{53ef}\u{4ee5}\u{3002}";

        assert_eq!(clean_local_model_output(value), "\u{6211}\u{89c9}\u{5f97}\u{53ef}\u{4ee5}\u{3002}");
    }

    #[test]
    fn removes_rule_echo_and_keeps_final_reply() {
        let value = concat!(
            "/no_think\n",
            "Speak naturally and keep replies short.\n",
            "Safety rules:\n",
            "- Do not reveal private memories, room secrets, API keys, passwords, verification codes, or payment data.\n",
            "- In rooms, only use the current channel, visible information, and @ mention rules.\n",
            "\u{4f60}\u{597d}\u{ff0c}\u{6211}\u{5728}\u{3002}"
        );

        assert_eq!(
            clean_local_model_output(value),
            "\u{4f60}\u{597d}\u{ff0c}\u{6211}\u{5728}\u{3002}"
        );
    }

    #[test]
    fn strips_llama_chat_template_echo() {
        let stdout = r#"
<|im_start|>system
You are Mio.
<|im_end|>
<|im_start|>user
hello
<|im_end|>
<|im_start|>assistant
Hello, I am here.
<|im_end|>
"#;

        assert_eq!(extract_llama_cli_text(stdout, "hello"), "Hello, I am here.");
    }

    #[test]
    fn finds_project_resources_from_nested_tauri_debug_cwd() {
        let root = std::env::temp_dir().join(format!(
            "castroom-resource-root-test-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&root);
        let nested_cwd = root.join("src-tauri").join("target").join("debug");
        let resources = root.join("resources");
        fs::create_dir_all(resources.join("models").join("chat")).unwrap();
        fs::create_dir_all(resources.join("runners").join("llama.cpp")).unwrap();
        fs::create_dir_all(&nested_cwd).unwrap();
        fs::write(resources.join("runners").join("llama.cpp").join("llama-cli.exe"), b"").unwrap();

        let app_resource_dir = root.join("src-tauri").join("target").join("debug").join("resources");
        let candidates = resource_root_candidates(&nested_cwd, Some(&app_resource_dir));
        let selected = candidates
            .iter()
            .find(|candidate| resource_root_has_local_runtime(candidate))
            .cloned();

        assert_eq!(selected, Some(PathBuf::from(&resources)));
        let _ = fs::remove_dir_all(&root);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_desktop_context,
            get_current_time_unix_ms,
            get_runtime_permission_state,
            get_window_mode_state,
            save_api_secret,
            read_api_secret,
            delete_api_secret,
            has_api_secret,
            cloud_chat_request,
            cloud_vision_request,
            cloud_tts_request,
            cloud_endpoint_test,
            import_character_pack_from_path,
            create_character_pack,
            duplicate_character_pack,
            save_character_pack_draft,
            delete_character_pack,
            load_character_pack_memory,
            save_character_pack_memory,
            list_character_pack_memory_files,
            load_character_chat_history,
            save_character_chat_history,
            move_character_chat_history_to_deleted,
            load_direct_room_history,
            append_direct_room_message,
            rewrite_direct_room_history,
            load_memory_scope,
            save_memory_scope,
            memory_graph_migrate,
            memory_graph_upsert_node,
            memory_graph_merge_claim,
            memory_graph_query_visible_claims,
            memory_graph_query_view,
            memory_graph_query_issues,
            memory_graph_query_neighbors,
            memory_graph_update_claim,
            memory_graph_update_visibility,
            memory_graph_create_claim,
            memory_graph_merge_claims,
            memory_graph_archive_claim,
            memory_graph_delete_claim,
            memory_graph_create_edge,
            memory_graph_delete_edge,
            memory_graph_query_conflicts,
            memory_graph_mark_disputed,
            memory_graph_resolve_conflict,
            memory_graph_delete_scope,
            memory_graph_export_neo4j,
            load_prompt_presets,
            save_prompt_presets,
            import_prompt_pack_from_path,
            list_deleted_character_packs,
            restore_deleted_character_pack,
            list_imported_character_packs,
            pack_validate_path,
            release_scan_staging,
            voice_get_state,
            voice_download_model,
            voice_cancel_model_download,
            voice_transcribe_file,
            voice_list_tts_voices,
            voice_synthesize,
            local_model_get_state,
            local_model_verify,
            local_model_warmup,
            local_model_cancel,
            local_model_list,
            local_model_select,
            local_model_enable,
            local_model_disable,
            local_model_chat,
        ])
        .on_window_event(|_window, event| {
            if matches!(
                event,
                tauri::WindowEvent::CloseRequested { .. } | tauri::WindowEvent::Destroyed
            ) {
                stop_local_model_server();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building CastRoom AI")
        .run(|_app_handle, event| {
            if matches!(
                event,
                tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
            ) {
                stop_local_model_server();
            }
        });
}
