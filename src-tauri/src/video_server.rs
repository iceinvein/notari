use axum::{
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Router,
};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::http::{Request as TauriRequest, Response as TauriResponse};

use crate::evidence::{EncryptionInfo, VideoEncryptor};
use crate::logger::{LogLevel, LOGGER};

/// Video stream state
pub struct VideoStream {
    pub video_path: PathBuf,
    pub password: Option<String>,
    pub encryption_info: Option<EncryptionInfo>,
    pub file_size: u64,
    pub temp_dir: PathBuf,
}

/// Server state
#[derive(Clone)]
pub struct VideoServerState {
    pub streams: Arc<RwLock<HashMap<String, VideoStream>>>,
}

impl VideoServerState {
    pub fn new() -> Self {
        Self {
            streams: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

/// Start video server on random port
pub async fn start_video_server() -> Result<(u16, VideoServerState), String> {
    LOGGER.log(
        LogLevel::Info,
        "Starting video server...",
        "video_server",
    );

    let state = VideoServerState::new();

    let app = Router::new()
        .route("/video/:stream_id", get(serve_video))
        .route("/health", get(|| async {
            LOGGER.log(
                LogLevel::Info,
                "Health check endpoint hit",
                "video_server",
            );
            "OK"
        }))
        .with_state(state.clone());

    // Bind to localhost only (security!)
    LOGGER.log(
        LogLevel::Info,
        "Binding to 127.0.0.1:0...",
        "video_server",
    );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| {
            LOGGER.log(
                LogLevel::Error,
                &format!("Failed to bind: {}", e),
                "video_server",
            );
            format!("Failed to bind: {}", e)
        })?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get port: {}", e))?
        .port();

    LOGGER.log(
        LogLevel::Info,
        &format!("Video server bound to port {}", port),
        "video_server",
    );

    // Spawn server
    tokio::spawn(async move {
        LOGGER.log(
            LogLevel::Info,
            &format!("Video server listening on http://127.0.0.1:{}", port),
            "video_server",
        );

        match axum::serve(listener, app).await {
            Ok(_) => {
                LOGGER.log(
                    LogLevel::Info,
                    "Video server stopped gracefully",
                    "video_server",
                );
            }
            Err(e) => {
                LOGGER.log(
                    LogLevel::Error,
                    &format!("Video server error: {}", e),
                    "video_server",
                );
            }
        }
    });

    LOGGER.log(
        LogLevel::Info,
        &format!("Video server started successfully on port {}", port),
        "video_server",
    );

    Ok((port, state))
}

/// Serve video with range request support
async fn serve_video(
    Path(stream_id): Path<String>,
    State(state): State<VideoServerState>,
    headers: axum::http::HeaderMap,
) -> impl IntoResponse {
    LOGGER.log(
        LogLevel::Info,
        &format!("=== VIDEO REQUEST === Stream: {}", stream_id),
        "video_server",
    );

    // Log all headers
    for (name, value) in headers.iter() {
        if let Ok(val_str) = value.to_str() {
            LOGGER.log(
                LogLevel::Debug,
                &format!("Header: {}: {}", name, val_str),
                "video_server",
            );
        }
    }

    let streams = state.streams.read().await;
    let stream = match streams.get(&stream_id) {
        Some(s) => s,
        None => {
            LOGGER.log(
                LogLevel::Error,
                &format!("Stream not found: {}", stream_id),
                "video_server",
            );
            return (StatusCode::NOT_FOUND, "Stream not found").into_response();
        }
    };

    LOGGER.log(
        LogLevel::Info,
        &format!("Stream found - file_size: {}, encrypted: {}",
            stream.file_size,
            stream.encryption_info.is_some()
        ),
        "video_server",
    );

    // Parse Range header
    let range = headers
        .get(header::RANGE)
        .and_then(|v| v.to_str().ok())
        .and_then(parse_range);

    LOGGER.log(
        LogLevel::Debug,
        &format!("Range request: {:?}", range),
        "video_server",
    );

    match range {
        Some((start, end)) => {
            // Serve partial content
            match decrypt_chunk(stream, start, end).await {
                Ok(chunk) => {
                    let content_length = chunk.len();
                    LOGGER.log(
                        LogLevel::Debug,
                        &format!("Serving {} bytes (range {}-{})", content_length, start, end),
                        "video_server",
                    );
                    Response::builder()
                        .status(StatusCode::PARTIAL_CONTENT)
                        .header(header::CONTENT_TYPE, "video/mp4")
                        .header(header::CONTENT_LENGTH, content_length)
                        .header(
                            header::CONTENT_RANGE,
                            format!(
                                "bytes {}-{}/{}",
                                start,
                                start + content_length as u64 - 1,
                                stream.file_size
                            ),
                        )
                        .header(header::ACCEPT_RANGES, "bytes")
                        .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                        .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
                        .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range")
                        .body(axum::body::Body::from(chunk))
                        .unwrap()
                        .into_response()
                }
                Err(e) => {
                    LOGGER.log(
                        LogLevel::Error,
                        &format!("Failed to decrypt chunk: {}", e),
                        "video_server",
                    );
                    (StatusCode::INTERNAL_SERVER_ERROR, e).into_response()
                }
            }
        }
        None => {
            // Serve full file (shouldn't happen with video player, but support it)
            LOGGER.log(
                LogLevel::Debug,
                "Serving full file (no range request)",
                "video_server",
            );
            match decrypt_chunk(stream, 0, stream.file_size - 1).await {
                Ok(chunk) => Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, "video/mp4")
                    .header(header::CONTENT_LENGTH, chunk.len())
                    .header(header::ACCEPT_RANGES, "bytes")
                    .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .header(header::ACCESS_CONTROL_ALLOW_METHODS, "GET, HEAD, OPTIONS")
                    .header(header::ACCESS_CONTROL_ALLOW_HEADERS, "Range")
                    .body(axum::body::Body::from(chunk))
                    .unwrap()
                    .into_response(),
                Err(e) => {
                    LOGGER.log(
                        LogLevel::Error,
                        &format!("Failed to decrypt file: {}", e),
                        "video_server",
                    );
                    (StatusCode::INTERNAL_SERVER_ERROR, e).into_response()
                }
            }
        }
    }
}

/// Read a specific byte range (decrypt if encrypted, or read directly if not)
pub async fn decrypt_chunk(stream: &VideoStream, start: u64, end: u64) -> Result<Vec<u8>, String> {
    LOGGER.log(
        LogLevel::Debug,
        &format!("Reading byte range: {}-{}", start, end),
        "video_server",
    );

    let data = if let (Some(password), Some(encryption_info)) =
        (&stream.password, &stream.encryption_info)
    {
        // Encrypted video - decrypt byte range
        VideoEncryptor::decrypt_byte_range(
            &stream.video_path,
            start,
            end,
            password,
            encryption_info,
        )
        .map_err(|e| format!("Failed to decrypt byte range: {}", e))?
    } else {
        // Unencrypted video - read directly
        use std::io::{Read, Seek, SeekFrom};
        let mut file = std::fs::File::open(&stream.video_path)
            .map_err(|e| format!("Failed to open video file: {}", e))?;

        file.seek(SeekFrom::Start(start))
            .map_err(|e| format!("Failed to seek: {}", e))?;

        let length = (end - start + 1) as usize;
        let mut buffer = vec![0u8; length];
        file.read_exact(&mut buffer)
            .map_err(|e| format!("Failed to read: {}", e))?;

        buffer
    };

    LOGGER.log(
        LogLevel::Debug,
        &format!("Read {} bytes", data.len()),
        "video_server",
    );

    Ok(data)
}

/// Tauri custom protocol handler for video streaming (async version for register_asynchronous_uri_scheme_protocol)
pub fn handle_stream_protocol<R: tauri::Runtime>(
    _ctx: tauri::UriSchemeContext<'_, R>,
    req: TauriRequest<Vec<u8>>,
    responder: tauri::UriSchemeResponder,
) {
    // Spawn async task
    tauri::async_runtime::spawn(async move {
        match handle_stream_request_async(req).await {
            Ok(response) => responder.respond(response),
            Err(e) => {
                LOGGER.log(
                    LogLevel::Error,
                    &format!("Stream protocol error: {}", e),
                    "video_server",
                );
                responder.respond(
                    TauriResponse::builder()
                        .status(500)
                        .body(Vec::new())
                        .unwrap()
                );
            }
        }
    });
}

/// Internal async handler for stream requests
async fn handle_stream_request_async(req: TauriRequest<Vec<u8>>) -> Result<TauriResponse<Vec<u8>>, Box<dyn std::error::Error>> {
    LOGGER.log(
        LogLevel::Info,
        &format!("=== STREAM PROTOCOL REQUEST === URI: {}", req.uri()),
        "video_server",
    );

    // Parse stream ID from URI: stream://localhost/video/STREAM_ID
    let uri_path = req.uri().path();
    let stream_id = uri_path.trim_start_matches("/video/");

    LOGGER.log(
        LogLevel::Info,
        &format!("Stream ID: {}", stream_id),
        "video_server",
    );

    // Get server state from app state
    let server_guard = crate::recording_commands::VIDEO_SERVER.read().await;
    let (_port, state) = server_guard.as_ref().ok_or("Video server not started")?;

    let streams = state.streams.read().await;
    let stream = streams.get(stream_id).ok_or("Stream not found")?;

    // Parse Range header
    let range_header = req.headers().get("range")
        .and_then(|v| v.to_str().ok());

    LOGGER.log(
        LogLevel::Info,
        &format!("Range header: {:?}", range_header),
        "video_server",
    );

    let (start, end) = if let Some(range_str) = range_header {
        parse_range(range_str).unwrap_or((0, stream.file_size - 1))
    } else {
        (0, stream.file_size - 1)
    };

    // Decrypt/read the chunk
    let data = decrypt_chunk(stream, start, end).await?;

    LOGGER.log(
        LogLevel::Info,
        &format!("Serving {} bytes (range {}-{})", data.len(), start, end),
        "video_server",
    );

    let file_size = stream.file_size;

    // Build response
    let mut response = TauriResponse::builder()
        .header("Content-Type", "video/mp4")
        .header("Accept-Ranges", "bytes")
        .header("Access-Control-Allow-Origin", "*");

    if req.headers().contains_key("range") {
        response = response
            .status(206) // Partial Content
            .header("Content-Range", format!("bytes {}-{}/{}", start, end, file_size))
            .header("Content-Length", data.len().to_string());
    } else {
        response = response
            .status(200)
            .header("Content-Length", data.len().to_string());
    }

    Ok(response.body(data)?)
}

/// Parse Range header (e.g., "bytes=0-1023")
fn parse_range(range_header: &str) -> Option<(u64, u64)> {
    let range = range_header.strip_prefix("bytes=")?;

    // Handle "bytes=start-end" or "bytes=start-"
    if let Some(dash_pos) = range.find('-') {
        let start_str = &range[..dash_pos];
        let end_str = &range[dash_pos + 1..];

        let start = start_str.parse().ok()?;

        // If end is empty, return None to indicate "to end of file"
        let end = if end_str.is_empty() {
            return Some((start, u64::MAX));
        } else {
            end_str.parse().ok()?
        };

        Some((start, end))
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_range() {
        assert_eq!(parse_range("bytes=0-1023"), Some((0, 1023)));
        assert_eq!(parse_range("bytes=1024-2047"), Some((1024, 2047)));
        assert_eq!(parse_range("bytes=0-"), Some((0, u64::MAX)));
        assert_eq!(parse_range("invalid"), None);
    }
}
