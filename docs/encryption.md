# Encryption System

## Overview

Notari uses AES-256-GCM encryption with chunked streaming to protect recorded videos. This allows secure storage while maintaining the ability to play videos without fully decrypting them to disk.

## Architecture

### Chunked Encryption

Videos are encrypted in 1MB chunks rather than as a single block. This provides several benefits:

1. **Streaming Playback**: Videos can be decrypted on-demand as they're played
2. **Memory Efficiency**: Only decrypt the chunks needed for the current playback position
3. **Partial Access**: Can decrypt specific byte ranges without processing the entire file

### Encryption Process

```
Plaintext Video (1.7MB)
    ↓
Split into 1MB chunks
    ↓
Chunk 0: 1MB plaintext → 1MB + 16 bytes ciphertext (AES-GCM tag)
Chunk 1: 0.7MB plaintext → 0.7MB + 16 bytes ciphertext
    ↓
Write to encrypted file sequentially
    ↓
Store metadata: chunk offsets, sizes, nonces
```

### Key Components

#### 1. Encryption Metadata

Each encrypted video has associated metadata stored in the evidence manifest:

```json
{
  "algorithm": "AES-256-GCM-CHUNKED",
  "key_derivation": {
    "algorithm": "PBKDF2-HMAC-SHA256",
    "iterations": 600000,
    "salt": "base64-encoded-salt"
  },
  "chunked": {
    "chunk_size": 1048576,
    "total_chunks": 2,
    "chunks": [
      {
        "index": 0,
        "offset": 0,
        "size": 1048592,
        "nonce": "base64-encoded-nonce"
      },
      {
        "index": 1,
        "offset": 1048592,
        "size": 733093,
        "nonce": "base64-encoded-nonce"
      }
    ]
  }
}
```

**Important**: The `offset` field represents the position in the **encrypted file** (ciphertext space), not the plaintext. This is critical for seeking to the correct position when reading chunks.

#### 2. Key Derivation

- **Algorithm**: PBKDF2-HMAC-SHA256
- **Iterations**: 600,000 (OWASP 2024 recommendation)
- **Salt**: 32 bytes, randomly generated per file
- **Output**: 256-bit key for AES-256

#### 3. Chunk Structure

Each chunk:
- **Plaintext size**: Up to 1MB (last chunk may be smaller)
- **Ciphertext size**: Plaintext size + 16 bytes (AES-GCM authentication tag)
- **Nonce**: 12 bytes, unique per chunk, randomly generated
- **Offset**: Position in encrypted file where this chunk starts

### Decryption Process

#### Byte Range Decryption

When the video player requests bytes `start` to `end`:

1. **Calculate needed chunks**:
   ```rust
   start_chunk = start / chunk_size
   end_chunk = end / chunk_size
   ```

2. **For each chunk**:
   - Seek to `chunk_info.offset` in encrypted file
   - Read `chunk_info.size` bytes of ciphertext
   - Decrypt using stored nonce and derived key
   - Extract the requested byte range from decrypted plaintext

3. **Concatenate results** and return to player

#### Example

Request: bytes 1048576-1781652 (733077 bytes)

```
Plaintext space: [0-1048575][1048576-1781652]
                  Chunk 0    Chunk 1 (needed)

Encrypted file:  [0-1048591][1048592-1781684]
                  Chunk 0    Chunk 1 (seek here)

1. Calculate: start_chunk = 1048576 / 1048576 = 1
2. Seek to offset 1048592 in encrypted file
3. Read 733093 bytes of ciphertext
4. Decrypt to get 733077 bytes of plaintext
5. Return all bytes (entire chunk needed)
```

## Video Playback

### Streaming Architecture

```
Frontend (React)
    ↓ Request video playback
Backend (Rust)
    ↓ Extract .notari file
    ↓ Start HTTP server on random port
    ↓ Return stream URL
Frontend
    ↓ Fetch video in 1MB chunks
    ↓ Create Blob from chunks
    ↓ Play via <video> element
```

### Playback Flow

1. **User clicks play** on encrypted recording
2. **Password prompt** appears
3. **Backend extracts** .notari file to temp directory
4. **Video server starts** on random port (e.g., `http://127.0.0.1:57835`)
5. **Stream created** with video path, password, encryption info
6. **Frontend fetches** video in 1MB chunks via `get_video_chunk` command
7. **Backend decrypts** each chunk on-demand
8. **Frontend creates** Blob URL from decrypted chunks
9. **Video plays** using standard HTML5 `<video>` element
10. **Cleanup** when player closes: delete temp files, stop stream

### Why Blob URLs Instead of HTTP Streaming?

We fetch all chunks and create a Blob URL rather than streaming directly from the HTTP server because:

1. **Browser compatibility**: Blob URLs work reliably in Tauri's webview
2. **Seeking support**: Full video in memory allows instant seeking
3. **Simplicity**: No need to handle HTTP range requests in the player
4. **Small files**: Screen recordings are typically small enough to fit in memory

## Security Considerations

### Password Strength

Passwords are validated to ensure:
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number

### Key Derivation

- **High iteration count** (600,000) makes brute-force attacks computationally expensive
- **Unique salt per file** prevents rainbow table attacks
- **PBKDF2-HMAC-SHA256** is a proven, standardized algorithm

### Authentication

- **AES-GCM** provides authenticated encryption
- **Authentication tag** (16 bytes per chunk) ensures data integrity
- **Tampering detection**: Any modification to ciphertext will fail decryption

### Temporary Files

- Extracted videos are stored in system temp directory
- **Automatic cleanup** when playback stops
- **Unique temp directories** per playback session prevent conflicts

## File Format

### .notari File Structure

```
notari_recording_20251001_061224.mov.notari (ZIP archive)
├── evidence/
│   ├── notari_recording_20251001_061224.mov.enc  (encrypted video)
│   ├── notari_recording_20251001_061224.mov.json (evidence manifest)
│   └── public_key.txt                             (signature verification)
├── metadata.json                                  (proof pack metadata)
└── README.txt                                     (human-readable info)
```

### Evidence Manifest

Contains:
- **Recording metadata**: session ID, timestamps, duration, window info
- **Encryption info**: algorithm, key derivation, chunk metadata
- **Hash info**: SHA-256 hashes of plaintext and ciphertext
- **Signature info**: Ed25519 digital signature
- **System info**: OS, device ID, app version
- **Custom metadata**: title, description, tags (optional)

## Implementation Details

### Code Locations

- **Encryption**: `src-tauri/src/evidence/encryption.rs`
- **Video server**: `src-tauri/src/video_server.rs`
- **Recording commands**: `src-tauri/src/recording_commands.rs`
- **Video player**: `src/components/VideoPlayer.tsx`

### Key Functions

#### Backend

- `VideoEncryptor::encrypt_file_chunked()`: Encrypt video in chunks
- `VideoEncryptor::decrypt_chunk_by_index()`: Decrypt a specific chunk
- `VideoEncryptor::decrypt_byte_range()`: Decrypt arbitrary byte range
- `start_video_playback()`: Initialize streaming session
- `get_video_chunk()`: Fetch and decrypt chunk for frontend

#### Frontend

- `VideoPlayer`: React component for playback
- Fetches chunks in 1MB increments
- Creates Blob URL from decrypted data
- Handles playback controls and cleanup

## Common Issues and Solutions

### Issue: "Decryption failed for chunk X"

**Cause**: Incorrect password or corrupted file

**Solution**: 
- Verify password is correct
- Check if file was created with compatible version
- Ensure file wasn't modified after creation

### Issue: Video won't play (MEDIA_ERR_SRC_NOT_SUPPORTED)

**Cause**: Blob creation or video format issue

**Solution**:
- Check that all chunks were fetched successfully
- Verify Blob MIME type is `video/mp4`
- Ensure video codec is H.264 (supported by browsers)

### Issue: Playback works for small videos but fails for large ones

**Cause**: Chunk offset calculation bug (fixed in current version)

**Solution**:
- Ensure using latest version with correct offset calculation
- Re-encrypt old videos with current version
- Verify `chunk_info.offset` is in ciphertext space

## Performance

### Encryption Speed

- **1MB chunk**: ~10-20ms to encrypt
- **Full video (10MB)**: ~100-200ms total
- **Bottleneck**: PBKDF2 key derivation (~100ms)

### Decryption Speed

- **1MB chunk**: ~5-10ms to decrypt
- **Streaming**: Negligible overhead, decrypts on-demand
- **Memory**: Only active chunks in memory

### Optimization Opportunities

1. **Cache derived key**: Reuse key for multiple chunks (already implemented)
2. **Parallel decryption**: Decrypt multiple chunks concurrently
3. **Prefetching**: Start decrypting next chunk before it's needed
4. **Adaptive chunk size**: Larger chunks for faster networks

## Future Enhancements

### Potential Improvements

1. **Hardware acceleration**: Use AES-NI instructions if available
2. **Streaming decryption**: True HTTP range request support
3. **Progressive loading**: Start playback before all chunks are fetched
4. **Compression**: Compress before encrypting to reduce file size
5. **Key rotation**: Support re-encrypting with new password

### Compatibility

- **Forward compatibility**: New versions can read old formats
- **Backward compatibility**: Old versions cannot read new formats with breaking changes
- **Version detection**: Check `algorithm` field in manifest

