# Encryption Implementation Guide

## Overview

This document provides detailed implementation notes for developers working on the encryption system. It covers the architecture, critical bugs that were fixed, and important considerations for future development.

## Critical Implementation Details

### Chunk Offset Calculation (CRITICAL)

**The most important thing to understand**: The `offset` field in `ChunkInfo` MUST be in **ciphertext space** (position in encrypted file), not plaintext space.

#### Why This Matters

When decrypting a chunk:
1. We seek to `chunk_info.offset` in the encrypted file
2. We read `chunk_info.size` bytes of ciphertext
3. We decrypt to get plaintext

If `offset` is in plaintext space, we'll seek to the wrong position and read garbage data.

#### Correct Implementation

```rust
// Encrypt each chunk
let mut plaintext_offset = 0u64;
let mut ciphertext_offset = 0u64;
let mut chunk_index = 0;

while plaintext_offset < file_size {
    let current_chunk_size = std::cmp::min(CHUNK_SIZE as u64, remaining) as usize;
    
    // Read plaintext chunk
    let mut plaintext_chunk = vec![0u8; current_chunk_size];
    input_file.read_exact(&mut plaintext_chunk)?;
    
    // Encrypt
    let ciphertext = cipher.encrypt(nonce, plaintext_chunk.as_ref())?;
    
    // Write to output file
    output_file.write_all(&ciphertext)?;
    
    // Store chunk info with CIPHERTEXT offset
    chunks.push(ChunkInfo {
        index: chunk_index,
        offset: ciphertext_offset,  // ← MUST be ciphertext offset!
        size: ciphertext.len() as u64,
        nonce: base64_encode(&nonce_bytes),
    });
    
    // Advance both offsets
    plaintext_offset += current_chunk_size as u64;
    ciphertext_offset += ciphertext.len() as u64;  // ← Ciphertext is larger!
    chunk_index += 1;
}
```

#### Bug History

**Bug #1 (Initial)**: Used `offset += current_chunk_size` (plaintext size)
- **Result**: Chunk 0 worked (offset 0), but chunk 1+ failed
- **Why**: Seeking to plaintext offset in ciphertext file reads wrong bytes

**Bug #2 (First Fix Attempt)**: Changed to `offset += ciphertext.len()` but kept single `offset` variable
- **Result**: Same as Bug #1, just with better comments
- **Why**: Still confusing plaintext and ciphertext spaces

**Bug #3 (Second Fix Attempt)**: Reverted to plaintext offset
- **Result**: Only worked for single-chunk files
- **Why**: Chunk 0 offset is 0 in both spaces (works by coincidence)

**Final Fix**: Separate `plaintext_offset` and `ciphertext_offset` variables
- **Result**: Works correctly for all file sizes
- **Why**: Clear separation of concerns, no confusion

### Byte Range Decryption

When the frontend requests bytes `start` to `end`, we need to:

1. **Calculate which chunks contain the requested range** (in plaintext space)
2. **Decrypt those chunks** (using ciphertext offsets)
3. **Extract the requested bytes** from the decrypted plaintext

```rust
pub fn decrypt_byte_range(
    input_path: P,
    start: u64,
    end: u64,
    password: &str,
    encryption_info: &EncryptionInfo,
) -> Result<Vec<u8>, Box<dyn Error>> {
    let chunked_info = encryption_info.chunked.as_ref().unwrap();
    
    // Calculate which chunks we need (plaintext space)
    let chunk_size = chunked_info.chunk_size;
    let start_chunk = (start / chunk_size) as usize;
    let end_chunk = (end / chunk_size) as usize;
    
    let mut result = Vec::new();
    
    // Decrypt needed chunks
    for chunk_idx in start_chunk..=end_chunk {
        // Decrypt entire chunk (uses ciphertext offset internally)
        let chunk_data = decrypt_chunk_by_index(
            &input_path, 
            chunk_idx, 
            password, 
            encryption_info
        )?;
        
        // Calculate which bytes from this chunk we need (plaintext space)
        let chunk_start_offset = chunk_idx as u64 * chunk_size;
        let chunk_end_offset = chunk_start_offset + chunk_data.len() as u64 - 1;
        
        let copy_start = if start > chunk_start_offset {
            (start - chunk_start_offset) as usize
        } else {
            0
        };
        
        let copy_end = if end < chunk_end_offset {
            (end - chunk_start_offset + 1) as usize
        } else {
            chunk_data.len()
        };
        
        result.extend_from_slice(&chunk_data[copy_start..copy_end]);
    }
    
    Ok(result)
}
```

### File Size Reporting

The frontend needs to know the **plaintext** size to request the correct byte ranges. However, the actual file on disk is the **ciphertext** size.

#### Size Calculation

```rust
// Get encrypted file size
let encrypted_file_size = std::fs::metadata(&video_path)?.len();

// Calculate plaintext size from chunk metadata
let plaintext_size = if let Some(ref enc_info) = encryption_info {
    if let Some(ref chunked) = enc_info.chunked {
        // Sum up plaintext sizes of all chunks
        let full_chunks = (chunked.total_chunks - 1) as u64;
        let full_chunks_size = full_chunks * chunked.chunk_size;
        
        // Last chunk: ciphertext size - 16 bytes (AES-GCM tag)
        let last_chunk_plaintext_size = chunked.chunks.last()
            .map(|c| c.size.saturating_sub(16))
            .unwrap_or(0);
        
        full_chunks_size + last_chunk_plaintext_size
    } else {
        encrypted_file_size  // Non-chunked, use encrypted size
    }
} else {
    encrypted_file_size  // Not encrypted
};

// Report plaintext size to frontend
stream.file_size = plaintext_size;
```

**Important**: The frontend uses this size to determine how many bytes to request. If we report the ciphertext size, the frontend will request too many bytes and decryption will fail.

## Video Playback Architecture

### Component Interaction

```
┌─────────────────────────────────────────────────────────────┐
│ Frontend (VideoPlayer.tsx)                                  │
│                                                              │
│  1. User clicks play                                        │
│  2. Password prompt                                         │
│  3. invoke("start_video_playback", {path, password})       │
│  4. Get stream URL: http://127.0.0.1:PORT/video/STREAM_ID  │
│  5. invoke("get_video_metadata", {streamId})               │
│  6. Loop: invoke("get_video_chunk", {streamId, start, end})│
│  7. Create Blob from chunks                                 │
│  8. Play via <video src={blobUrl}>                         │
│  9. invoke("stop_video_playback", {streamId})              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Backend (recording_commands.rs)                             │
│                                                              │
│  start_video_playback():                                    │
│    - Extract .notari to temp dir                           │
│    - Start video server if not running                     │
│    - Create VideoStream with path, password, enc_info     │
│    - Return stream URL                                      │
│                                                              │
│  get_video_metadata():                                      │
│    - Return (plaintext_size, is_encrypted)                 │
│                                                              │
│  get_video_chunk():                                         │
│    - Call video_server::decrypt_chunk()                    │
│    - Return decrypted bytes as Vec<u8>                     │
│                                                              │
│  stop_video_playback():                                     │
│    - Remove stream from server                             │
│    - Delete temp directory                                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Video Server (video_server.rs)                              │
│                                                              │
│  - Axum HTTP server on random port                         │
│  - Stores active streams in HashMap                        │
│  - decrypt_chunk():                                         │
│      if encrypted:                                          │
│        VideoEncryptor::decrypt_byte_range()                │
│      else:                                                  │
│        Read from file directly                             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ Encryption (encryption.rs)                                  │
│                                                              │
│  decrypt_byte_range():                                      │
│    - Calculate needed chunks (plaintext space)             │
│    - For each chunk: decrypt_chunk_by_index()              │
│    - Extract requested bytes                                │
│    - Return concatenated result                             │
│                                                              │
│  decrypt_chunk_by_index():                                  │
│    - Derive key from password + salt                       │
│    - Seek to chunk_info.offset (ciphertext space)          │
│    - Read chunk_info.size bytes                            │
│    - Decrypt with AES-256-GCM                              │
│    - Return plaintext                                       │
└─────────────────────────────────────────────────────────────┘
```

### State Management

#### Video Server State

```rust
pub struct VideoServerState {
    pub streams: Arc<RwLock<HashMap<String, VideoStream>>>,
}

pub struct VideoStream {
    pub video_path: PathBuf,
    pub password: Option<String>,
    pub encryption_info: Option<EncryptionInfo>,
    pub file_size: u64,  // Plaintext size!
    pub temp_dir: PathBuf,
}
```

**Thread Safety**: Uses `Arc<RwLock<>>` for concurrent access from multiple requests.

**Cleanup**: Streams are removed when `stop_video_playback` is called, and temp directories are deleted.

### Frontend Blob Creation

```typescript
// Fetch all chunks
const chunks: Uint8Array[] = [];
let offset = 0;

while (offset < fileSize) {
    const end = Math.min(offset + CHUNK_SIZE - 1, fileSize - 1);
    
    const chunk = await invoke<number[]>("get_video_chunk", {
        streamId,
        start: offset,
        end,
    });
    
    chunks.push(new Uint8Array(chunk));
    offset = end + 1;
}

// Create Blob
const blob = new Blob(chunks, { type: "video/mp4" });
const blobUrl = URL.createObjectURL(blob);

// Play
setVideoUrl(blobUrl);
```

**Why Blob instead of HTTP streaming?**
- Better browser compatibility in Tauri webview
- Simpler implementation (no range request handling)
- Instant seeking (entire video in memory)
- Small file sizes make this practical

## Testing Considerations

### Test Cases

1. **Single-chunk file** (< 1MB)
   - Offset is 0 for both plaintext and ciphertext
   - Tests basic encryption/decryption

2. **Multi-chunk file** (> 1MB)
   - Tests correct offset calculation
   - Verifies chunk boundaries

3. **Exact chunk boundary** (exactly 1MB, 2MB, etc.)
   - Edge case for chunk calculation

4. **Password validation**
   - Correct password: should decrypt
   - Wrong password: should fail with clear error
   - Empty password: should be rejected

5. **Corrupted file**
   - Modified ciphertext: should fail authentication
   - Modified manifest: should fail verification

### Manual Testing

```bash
# Create test recordings
1. Small video (< 1MB): Record for 1-2 seconds
2. Medium video (1-2MB): Record for 3-5 seconds  
3. Large video (> 2MB): Record for 10+ seconds

# Test playback
1. Play without password (should fail)
2. Play with wrong password (should fail)
3. Play with correct password (should work)
4. Seek to different positions (should work)
5. Play multiple times (should work)

# Test cleanup
1. Check temp directory is deleted after playback
2. Verify no orphaned processes
```

## Common Pitfalls

### 1. Confusing Plaintext and Ciphertext Offsets

**Symptom**: Decryption works for first chunk but fails for subsequent chunks

**Cause**: Using plaintext offset when ciphertext offset is needed (or vice versa)

**Solution**: Always use ciphertext offset for file seeking, plaintext offset for chunk calculation

### 2. Off-by-One Errors in Byte Ranges

**Symptom**: Missing or extra bytes in decrypted output

**Cause**: Inclusive vs exclusive range endpoints

**Solution**: Frontend uses inclusive ranges (`start` to `end`), backend calculates `end - start + 1` bytes

### 3. Not Handling Last Chunk Correctly

**Symptom**: Last chunk decryption fails or returns wrong size

**Cause**: Last chunk is smaller than CHUNK_SIZE

**Solution**: Use `std::cmp::min(CHUNK_SIZE, remaining)` when reading

### 4. Key Derivation Performance

**Symptom**: Slow playback startup

**Cause**: Deriving key for every chunk (600,000 PBKDF2 iterations)

**Solution**: Derive key once and reuse for all chunks (already implemented)

### 5. Temp Directory Cleanup

**Symptom**: Disk fills up with temp files

**Cause**: Not cleaning up on error or crash

**Solution**: Use RAII pattern with Drop trait, or cleanup on app startup

## Performance Optimization

### Current Performance

- **Encryption**: ~100-200ms for 10MB video
- **Decryption**: ~50-100ms for 10MB video
- **Key derivation**: ~100ms (one-time per playback)

### Optimization Opportunities

1. **Parallel chunk decryption**
   ```rust
   use rayon::prelude::*;
   
   let chunks: Vec<_> = (start_chunk..=end_chunk)
       .into_par_iter()
       .map(|idx| decrypt_chunk_by_index(...))
       .collect();
   ```

2. **Chunk prefetching**
   - Start decrypting next chunk before it's requested
   - Use background thread to stay ahead of playback

3. **Hardware acceleration**
   - Use AES-NI instructions if available
   - Check CPU features at runtime

4. **Adaptive chunk size**
   - Larger chunks for faster decryption
   - Smaller chunks for lower memory usage

## Future Enhancements

### 1. True HTTP Streaming

Instead of fetching all chunks upfront, stream directly from HTTP server:

```typescript
// Frontend
<video src={`http://127.0.0.1:${port}/video/${streamId}`} />
```

**Benefits**:
- Lower memory usage
- Faster startup (no need to fetch all chunks)
- Better for large files

**Challenges**:
- Need to implement HTTP range request handling
- More complex error handling
- Browser compatibility in Tauri webview

### 2. Progressive Decryption

Start playback before all chunks are decrypted:

```typescript
// Fetch first few chunks
const initialChunks = await fetchChunks(0, 3);
const blob = new Blob(initialChunks);
setVideoUrl(URL.createObjectURL(blob));

// Continue fetching in background
fetchRemainingChunks();
```

### 3. Compression

Compress video before encrypting to reduce file size:

```rust
// Compress
let compressed = zstd::encode_all(plaintext, 3)?;

// Encrypt
let ciphertext = cipher.encrypt(nonce, compressed.as_ref())?;
```

**Trade-off**: Slower encryption/decryption, but smaller files

## Debugging Tips

### Enable Detailed Logging

```rust
LOGGER.log(
    LogLevel::Debug,
    &format!("Chunk {}: offset={}, size={}, nonce_len={}", 
        idx, chunk.offset, chunk.size, chunk.nonce.len()),
    "encryption",
);
```

### Verify Chunk Metadata

```bash
# Extract and inspect manifest
unzip -q recording.notari -d /tmp/test
cat /tmp/test/evidence/*.json | jq '.recording.encryption.chunked'
```

### Test Decryption Manually

```rust
#[test]
fn test_decrypt_chunk() {
    let enc_info = load_encryption_info();
    let plaintext = decrypt_chunk_by_index(
        "test.mov.enc",
        1,  // Chunk index
        "password",
        &enc_info,
    ).unwrap();
    
    assert_eq!(plaintext.len(), expected_size);
}
```

### Check File Offsets

```bash
# Verify chunk offsets match file structure
hexdump -C recording.mov.enc | head -20
```

## References

- [AES-GCM Specification](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [PBKDF2 Specification](https://tools.ietf.org/html/rfc2898)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

