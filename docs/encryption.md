# Encryption System

## Overview

Notari provides two encryption methods to protect recorded videos:

1. **Password-based encryption**: Uses a password with PBKDF2 key derivation
2. **Public key encryption**: Uses X25519 elliptic curve cryptography for key exchange

Both methods use AES-256-GCM encryption with chunked streaming, allowing secure storage while maintaining the ability to play videos without fully decrypting them to disk.

## Encryption Methods

### 1. Password-Based Encryption

**Use case**: Simple encryption when you want to protect a video with a password that you'll share separately.

**How it works**:
- User provides a password during recording
- Password is validated for strength (min 8 chars, uppercase, lowercase, number)
- Key is derived using PBKDF2-HMAC-SHA256 with 600,000 iterations
- Video is encrypted with AES-256-GCM
- To play: User must enter the same password

**Pros**:
- Simple and familiar
- No key management required
- Works offline

**Cons**:
- Password must be shared separately (insecure channel risk)
- If password is lost, video cannot be decrypted
- Password strength depends on user choice

### 2. Public Key Encryption

**Use case**: Secure sharing where recipients can decrypt without password exchange.

**How it works**:
- Each user generates an X25519 key pair (one-time setup)
- Public keys can be shared openly (via QR code, file, or copy/paste)
- When recording, select recipients by their public keys
- A random video encryption key is generated
- Video is encrypted with AES-256-GCM using the video key
- The video key is encrypted separately for each recipient using X25519-XSalsa20-Poly1305
- To play: Recipient's private key automatically decrypts the video key, then the video

**Pros**:
- No password to remember or share
- Recipients can decrypt automatically if they have the private key
- Can encrypt for multiple recipients
- Forward secrecy: Each video has a unique encryption key

**Cons**:
- Requires one-time key generation
- Private key must be kept secure
- If private key is lost, videos cannot be decrypted

**Key Management**:
- Private keys are stored securely in the system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Public keys can be exported and shared via:
  - QR code (for mobile scanning)
  - File download (`.txt` file)
  - Copy to clipboard
- "Add Myself" button automatically adds your own public key as a recipient

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

Each encrypted video has associated metadata stored in the evidence manifest.

**Password-based encryption**:

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

**Public key encryption**:

```json
{
  "algorithm": "AES-256-GCM-CHUNKED-PUBKEY",
  "encrypted_keys": [
    {
      "recipient_id": "Alice",
      "recipient_public_key": "u4vcja29n4pk/iqWwWFZ9wkVq7ZgumVB9JiYwZ4D3lI=",
      "ephemeral_public_key": "fUqsp9XvohhWu9y3RrkUZ9amaNzzRk3s/jgP66MQaVA=",
      "encrypted_video_key": "kUMcngLluBxaU0gXQ0QoqWMEZNhQ8u1xpGseTZEfYy54+HKFbp1goMlZ7R/UqD/E...",
      "algorithm": "X25519-XSalsa20-Poly1305"
    },
    {
      "recipient_id": "Bob",
      "recipient_public_key": "xYz123...",
      "ephemeral_public_key": "aBc456...",
      "encrypted_video_key": "dEf789...",
      "algorithm": "X25519-XSalsa20-Poly1305"
    }
  ],
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

#### 2. Key Derivation (Password-Based)

- **Algorithm**: PBKDF2-HMAC-SHA256
- **Iterations**: 600,000 (OWASP 2024 recommendation)
- **Salt**: 32 bytes, randomly generated per file
- **Output**: 256-bit key for AES-256

#### 2b. Key Exchange (Public Key)

**Hybrid Encryption Scheme**:

1. **Video Encryption Key**: 256-bit random key generated for each video
2. **Key Encapsulation**: Video key is encrypted for each recipient using:
   - **Algorithm**: X25519-XSalsa20-Poly1305 (via `crypto_box`)
   - **Ephemeral Key Pair**: New X25519 key pair generated per recipient
   - **Shared Secret**: Derived via X25519 Diffie-Hellman key exchange
   - **Encryption**: XSalsa20-Poly1305 authenticated encryption
   - **Nonce**: 24 bytes, randomly generated

**Why Hybrid Encryption?**

- **Efficiency**: Symmetric encryption (AES-256-GCM) is much faster for large videos
- **Multiple Recipients**: Video key can be encrypted separately for each recipient
- **Forward Secrecy**: Each video has a unique encryption key
- **Standard Practice**: Same approach used by PGP, Signal, WhatsApp

**Cryptographic Primitives**:

- **X25519**: Elliptic curve Diffie-Hellman key exchange (Curve25519)
- **XSalsa20**: Stream cipher with 192-bit nonce
- **Poly1305**: Message authentication code
- **crypto_box**: NaCl/libsodium construction combining X25519 + XSalsa20 + Poly1305

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

#### Password-Based Encryption

1. **User clicks play** on encrypted recording
2. **Frontend reads manifest** from .notari file to check encryption type
3. **Password prompt** appears (no `encrypted_keys` in manifest)
4. **User enters password**
5. **Backend extracts** .notari file to temp directory
6. **Video server starts** on random port (e.g., `http://127.0.0.1:57835`)
7. **Stream created** with video path, password, encryption info
8. **Frontend fetches** video in 1MB chunks via `get_video_chunk` command
9. **Backend decrypts** each chunk on-demand using password-derived key
10. **Frontend creates** Blob URL from decrypted chunks
11. **Video plays** using standard HTML5 `<video>` element
12. **Cleanup** when player closes: delete temp files, stop stream

#### Public Key Encryption

1. **User clicks play** on encrypted recording
2. **Frontend reads manifest** from .notari file to check encryption type
3. **Detects `encrypted_keys`** in manifest → no password needed
4. **Backend extracts** .notari file to temp directory
5. **Backend retrieves private key** from system keychain
6. **Backend decrypts video key** using private key and ephemeral public key
7. **Video server starts** on random port
8. **Stream created** with video path, decrypted video key, encryption info
9. **Frontend fetches** video in 1MB chunks via `get_video_chunk` command
10. **Backend decrypts** each chunk on-demand using video key
11. **Frontend creates** Blob URL from decrypted chunks
12. **Video plays** using standard HTML5 `<video>` element
13. **Cleanup** when player closes: delete temp files, stop stream

**Key difference**: Public key encryption requires no user interaction during playback - the private key is retrieved automatically from the keychain.

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

### Public Key Security

**Private Key Storage**:
- Private keys are stored in the system keychain/credential manager
- **macOS**: Keychain Access with ACL protection
- **Windows**: Windows Credential Manager
- **Linux**: Secret Service API (GNOME Keyring, KWallet)
- Keys are encrypted at rest by the OS
- Access requires user authentication (password, biometric)

**Key Generation**:
- Uses cryptographically secure random number generator (CSPRNG)
- X25519 keys are 32 bytes (256 bits)
- Generated once per user, reused for all recordings

**Public Key Distribution**:
- Public keys can be shared openly (not secret)
- QR codes use standard format for easy scanning
- Recipient verification is user's responsibility

**Threat Model**:
- ✅ **Protects against**: Unauthorized access to encrypted videos
- ✅ **Protects against**: Password interception during sharing
- ✅ **Protects against**: Brute force attacks (no password to guess)
- ❌ **Does NOT protect against**: Compromised private key
- ❌ **Does NOT protect against**: Malicious recipient (they can decrypt)
- ❌ **Does NOT protect against**: Man-in-the-middle during key exchange (verify public keys out-of-band)

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
- **Key management**: `src-tauri/src/evidence/keychain.rs`
- **Video server**: `src-tauri/src/video_server.rs`
- **Recording commands**: `src-tauri/src/recording_commands.rs`
- **Video player**: `src/components/VideoPlayer.tsx`
- **Encryption settings**: `src/components/EncryptionSettings.tsx`
- **Key management UI**: `src/components/KeyManagement.tsx`

### Key Functions

#### Backend - Password Encryption

- `VideoEncryptor::encrypt_file_chunked()`: Encrypt video in chunks with password
- `VideoEncryptor::decrypt_chunk_by_index()`: Decrypt a specific chunk with password
- `VideoEncryptor::decrypt_byte_range()`: Decrypt arbitrary byte range with password
- `derive_key_from_password()`: PBKDF2 key derivation

#### Backend - Public Key Encryption

- `VideoEncryptor::encrypt_file_with_public_keys()`: Encrypt video for multiple recipients
- `VideoEncryptor::decrypt_file_with_private_key()`: Decrypt video using private key
- `VideoEncryptor::decrypt_byte_range_with_private_key()`: Decrypt byte range with private key
- `EncryptionKeyManager::generate()`: Generate X25519 key pair
- `EncryptionKeyManager::from_bytes()`: Load key pair from bytes
- `keychain::store_encryption_key()`: Store private key in system keychain
- `keychain::retrieve_encryption_key()`: Retrieve private key from keychain

#### Backend - Playback

- `start_video_playback()`: Initialize streaming session (detects encryption type)
- `get_video_chunk()`: Fetch and decrypt chunk for frontend
- `read_manifest_from_notari()`: Extract manifest from .notari file

#### Frontend

- `VideoPlayer`: React component for playback
- `EncryptionSettings`: UI for choosing encryption method and recipients
- `KeyManagement`: UI for managing encryption keys (generate, export, delete)
- `RecordingsLibrary`: Detects encryption type and handles playback flow
- Fetches chunks in 1MB increments
- Creates Blob URL from decrypted data
- Handles playback controls and cleanup

## Common Issues and Solutions

### Issue: "Decryption failed for chunk X"

**Cause**: Incorrect password, missing private key, or corrupted file

**Solution**:
- **Password encryption**: Verify password is correct
- **Public key encryption**: Ensure private key exists in keychain
- Check if file was created with compatible version
- Ensure file wasn't modified after creation
- For public key: Verify you were added as a recipient when the video was recorded

### Issue: "No encryption key found" or "Failed to retrieve encryption key"

**Cause**: Private key not found in system keychain

**Solution**:
- Go to Settings → Security → Key Management
- Check if encryption key exists
- If not, generate a new key (note: cannot decrypt old videos)
- If key was deleted, restore from backup if available

### Issue: Public key encrypted video asks for password

**Cause**: Frontend not detecting `encrypted_keys` in manifest

**Solution**:
- Ensure app is up to date (bug fixed in recent version)
- Check logs in Settings → Dev/Logging for manifest reading errors
- Verify manifest contains `encrypted_keys` field
- Try rebuilding the app

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

