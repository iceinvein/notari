# Encryption Quick Reference

## Key Concepts

### Offset Spaces

```
Plaintext Space:  [0-1048575][1048576-1781652]
                   Chunk 0     Chunk 1

Ciphertext Space: [0-1048591][1048592-1781684]
                   Chunk 0     Chunk 1
                   (+16 bytes) (+16 bytes)
```

**Rule**: `chunk_info.offset` is ALWAYS in ciphertext space (for file seeking)

### Size Relationships

```
Plaintext chunk:  1048576 bytes
Ciphertext chunk: 1048592 bytes (plaintext + 16-byte AES-GCM tag)
```

## Code Snippets

### Encrypting a Video

```rust
use crate::evidence::VideoEncryptor;

let encryption_info = VideoEncryptor::encrypt_file_chunked(
    "input.mov",
    "output.mov.enc",
    "password123",
)?;

// encryption_info contains:
// - algorithm: "AES-256-GCM-CHUNKED"
// - key_derivation: salt, iterations
// - chunked: chunk_size, total_chunks, chunks[]
```

### Decrypting a Chunk

```rust
let plaintext = VideoEncryptor::decrypt_chunk_by_index(
    "video.mov.enc",
    1,  // Chunk index
    "password123",
    &encryption_info,
)?;
```

### Decrypting a Byte Range

```rust
let bytes = VideoEncryptor::decrypt_byte_range(
    "video.mov.enc",
    1048576,  // Start (plaintext space)
    1781652,  // End (plaintext space)
    "password123",
    &encryption_info,
)?;
```

### Starting Video Playback

```rust
// Backend
let url = start_video_playback(
    "/path/to/recording.notari",
    "password123",
).await?;

// Returns: "http://127.0.0.1:57835/video/stream-id"
```

```typescript
// Frontend
const url = await invoke<string>("start_video_playback", {
    recordingPath: "/path/to/recording.notari",
    password: "password123",
});
```

### Fetching Video Chunks

```typescript
const [fileSize, isEncrypted] = await invoke<[number, boolean]>(
    "get_video_metadata",
    { streamId }
);

const chunk = await invoke<number[]>("get_video_chunk", {
    streamId,
    start: 0,
    end: 1048575,
});

const bytes = new Uint8Array(chunk);
```

### Creating Blob for Playback

```typescript
const chunks: Uint8Array[] = [];
let offset = 0;

while (offset < fileSize) {
    const end = Math.min(offset + 1048575, fileSize - 1);
    const chunk = await invoke<number[]>("get_video_chunk", {
        streamId,
        start: offset,
        end,
    });
    chunks.push(new Uint8Array(chunk));
    offset = end + 1;
}

const blob = new Blob(chunks, { type: "video/mp4" });
const url = URL.createObjectURL(blob);
```

## Common Calculations

### Calculate Chunk Index from Byte Offset

```rust
let chunk_index = (byte_offset / CHUNK_SIZE) as usize;
```

### Calculate Plaintext Size from Chunk Metadata

```rust
let plaintext_size = if let Some(chunked) = &enc_info.chunked {
    let full_chunks = (chunked.total_chunks - 1) as u64;
    let full_chunks_size = full_chunks * chunked.chunk_size;
    
    let last_chunk_size = chunked.chunks.last()
        .map(|c| c.size.saturating_sub(16))
        .unwrap_or(0);
    
    full_chunks_size + last_chunk_size
} else {
    encrypted_file_size
};
```

### Calculate Ciphertext Offset

```rust
let mut ciphertext_offset = 0u64;

for chunk in &chunks {
    // Store offset
    chunk.offset = ciphertext_offset;
    
    // Advance by ciphertext size
    ciphertext_offset += chunk.size;
}
```

## Debugging Commands

### Extract and Inspect Manifest

```bash
unzip -q recording.notari -d /tmp/test
cat /tmp/test/evidence/*.json | jq '.recording.encryption'
```

### Check Chunk Metadata

```bash
cat /tmp/test/evidence/*.json | jq '.recording.encryption.chunked.chunks'
```

### Verify File Size

```bash
ls -lh /tmp/test/evidence/*.mov.enc
```

### Check Temp Directory

```bash
ls -la /var/folders/*/T/notari_temp_*
```

## Error Messages

### "Decryption failed for chunk X: incorrect password or corrupted file"

**Causes**:
- Wrong password
- Corrupted ciphertext
- Wrong chunk offset (seeking to wrong position)
- Wrong nonce

**Debug**:
1. Verify password is correct
2. Check chunk offset matches file structure
3. Verify nonce is valid base64
4. Check file hasn't been modified

### "Chunk index X out of bounds"

**Causes**:
- Requesting chunk beyond total_chunks
- Byte range calculation error

**Debug**:
1. Check requested byte range
2. Verify chunk_size in metadata
3. Calculate expected chunk index

### "Failed to read chunk X at offset Y"

**Causes**:
- File truncated
- Wrong offset in metadata
- File not fully written

**Debug**:
1. Check file size matches expected
2. Verify offset + size <= file_size
3. Check if encryption completed successfully

## Testing Checklist

- [ ] Single-chunk file (< 1MB)
- [ ] Multi-chunk file (> 1MB)
- [ ] Exact chunk boundary (1MB, 2MB)
- [ ] Correct password
- [ ] Wrong password
- [ ] Empty password
- [ ] Corrupted ciphertext
- [ ] Modified manifest
- [ ] Playback and seeking
- [ ] Multiple playback sessions
- [ ] Temp directory cleanup

## Performance Benchmarks

| Operation | Time | Notes |
|-----------|------|-------|
| Key derivation | ~100ms | One-time per playback |
| Encrypt 1MB chunk | ~10-20ms | Per chunk |
| Decrypt 1MB chunk | ~5-10ms | Per chunk |
| Full 10MB video encryption | ~100-200ms | Total |
| Full 10MB video decryption | ~50-100ms | Total |

## File Format Reference

### .notari Structure

```
recording.notari (ZIP)
├── evidence/
│   ├── recording.mov.enc      (encrypted video)
│   ├── recording.mov.json     (evidence manifest)
│   └── public_key.txt         (Ed25519 public key)
├── metadata.json              (proof pack metadata)
└── README.txt                 (human-readable info)
```

### Encryption Info JSON

```json
{
  "algorithm": "AES-256-GCM-CHUNKED",
  "key_derivation": {
    "algorithm": "PBKDF2-HMAC-SHA256",
    "iterations": 600000,
    "salt": "base64-encoded-32-bytes"
  },
  "chunked": {
    "chunk_size": 1048576,
    "total_chunks": 2,
    "chunks": [
      {
        "index": 0,
        "offset": 0,
        "size": 1048592,
        "nonce": "base64-encoded-12-bytes"
      },
      {
        "index": 1,
        "offset": 1048592,
        "size": 733093,
        "nonce": "base64-encoded-12-bytes"
      }
    ]
  }
}
```

## Constants

```rust
const SALT_SIZE: usize = 32;           // 256 bits
const NONCE_SIZE: usize = 12;          // 96 bits (AES-GCM standard)
const KEY_SIZE: usize = 32;            // 256 bits
const PBKDF2_ITERATIONS: u32 = 600_000; // OWASP 2024
const CHUNK_SIZE: usize = 1024 * 1024; // 1MB
const TAG_SIZE: usize = 16;            // 128 bits (AES-GCM tag)
```

## Quick Fixes

### Fix: Chunk offset in wrong space

```rust
// WRONG
offset += current_chunk_size as u64;  // Plaintext size

// RIGHT
offset += ciphertext.len() as u64;    // Ciphertext size
```

### Fix: Not reporting plaintext size

```rust
// WRONG
stream.file_size = encrypted_file_size;

// RIGHT
stream.file_size = calculate_plaintext_size(&encryption_info);
```

### Fix: Off-by-one in byte range

```rust
// WRONG
let bytes_needed = end - start;

// RIGHT
let bytes_needed = end - start + 1;  // Inclusive range
```

## Related Files

- `src-tauri/src/evidence/encryption.rs` - Core encryption logic
- `src-tauri/src/evidence/manifest.rs` - Manifest structures
- `src-tauri/src/video_server.rs` - HTTP streaming server
- `src-tauri/src/recording_commands.rs` - Tauri commands
- `src/components/VideoPlayer.tsx` - Frontend player
- `docs/encryption.md` - User-facing documentation
- `docs/dev/encryption-implementation.md` - Detailed implementation guide

