# Encryption Bug Fix - January 2025

## Summary

Fixed critical bug in chunked encryption where chunk offsets were calculated in plaintext space instead of ciphertext space, causing multi-chunk encrypted videos to fail playback.

## Problem

### Symptoms

- Encrypted videos with single chunk (< 1MB) played correctly
- Encrypted videos with multiple chunks (> 1MB) failed with "MEDIA_ERR_SRC_NOT_SUPPORTED"
- Decryption appeared to work (no errors), but video wouldn't play
- Issue was intermittent - worked for some files, failed for others

### Root Cause

The `offset` field in `ChunkInfo` was being calculated in **plaintext space** (position in original file) instead of **ciphertext space** (position in encrypted file).

When decrypting a chunk, the code seeks to `chunk_info.offset` in the encrypted file. If this offset is in plaintext space, it seeks to the wrong position and reads garbage data.

**Example**:
```
Chunk 0:
  Plaintext: 0-1048575 (1MB)
  Ciphertext: 0-1048591 (1MB + 16 bytes)
  Offset: 0 (same in both spaces) ✅

Chunk 1:
  Plaintext: 1048576-1781652
  Ciphertext: 1048592-1781684
  Offset: 1048576 (plaintext) ❌ Should be 1048592 (ciphertext)
```

When trying to decrypt chunk 1:
1. Seek to offset 1048576 in encrypted file
2. Read 733093 bytes
3. This reads bytes 1048576-1781668 instead of 1048592-1781684
4. Decryption fails because we're reading the wrong bytes

### Why It Was Confusing

1. **Chunk 0 worked by coincidence** - offset is 0 in both plaintext and ciphertext space
2. **Single-chunk files always worked** - only chunk 0 exists
3. **Decryption didn't error** - it successfully decrypted garbage data
4. **Video player failed silently** - just showed "format not supported"

## Bug History

### Version 1: Original Bug

```rust
// WRONG - offset in plaintext space
let mut offset = 0u64;

while offset < file_size {
    let current_chunk_size = std::cmp::min(CHUNK_SIZE, remaining);
    
    // ... encrypt chunk ...
    
    chunks.push(ChunkInfo {
        index: chunk_index,
        offset,  // ❌ Plaintext offset
        size: ciphertext.len() as u64,
        nonce: encode_nonce(&nonce_bytes),
    });
    
    offset += current_chunk_size as u64;  // ❌ Increment by plaintext size
    chunk_index += 1;
}
```

**Result**: Multi-chunk files failed to decrypt

### Version 2: First Fix Attempt (Still Wrong)

```rust
// STILL WRONG - confusing variable name
let mut offset = 0u64;

while offset < file_size {
    // ... encrypt chunk ...
    
    chunks.push(ChunkInfo {
        index: chunk_index,
        offset,  // ❌ Still plaintext offset
        size: ciphertext.len() as u64,
        nonce: encode_nonce(&nonce_bytes),
    });
    
    // Move offset by ciphertext size (not plaintext size!)
    // Ciphertext is larger due to AES-GCM authentication tag
    offset += ciphertext.len() as u64;  // ❌ Incrementing ciphertext but storing plaintext
    chunk_index += 1;
}
```

**Result**: Same bug, just with misleading comments

### Version 3: Revert (Still Wrong)

```rust
// REVERTED - back to plaintext offset
let mut offset = 0u64;

while offset < file_size {
    // ... encrypt chunk ...
    
    chunks.push(ChunkInfo {
        index: chunk_index,
        offset,  // ❌ Plaintext offset
        size: ciphertext.len() as u64,
        nonce: encode_nonce(&nonce_bytes),
    });
    
    offset += current_chunk_size as u64;  // ❌ Plaintext size
    chunk_index += 1;
}
```

**Result**: Only single-chunk files worked

### Version 4: Final Fix (Correct)

```rust
// CORRECT - separate plaintext and ciphertext offsets
let mut plaintext_offset = 0u64;
let mut ciphertext_offset = 0u64;
let mut chunk_index = 0;

while plaintext_offset < file_size {
    let remaining = file_size - plaintext_offset;
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
        offset: ciphertext_offset,  // ✅ Ciphertext offset for file seeking
        size: ciphertext.len() as u64,
        nonce: encode_nonce(&nonce_bytes),
    });
    
    // Advance both offsets
    plaintext_offset += current_chunk_size as u64;
    ciphertext_offset += ciphertext.len() as u64;
    chunk_index += 1;
}
```

**Result**: All files work correctly

## Key Insights

### 1. Separate Concerns

Using separate `plaintext_offset` and `ciphertext_offset` variables makes the code self-documenting and prevents confusion.

### 2. Offset Semantics

The `offset` field in `ChunkInfo` must be in **ciphertext space** because:
- It's used for seeking in the encrypted file
- `input_file.seek(SeekFrom::Start(chunk_info.offset))`
- The encrypted file is organized by ciphertext positions

### 3. Plaintext Space for Calculation

Plaintext space is still used for calculating which chunks to decrypt:
```rust
let start_chunk = (start / chunk_size) as usize;
let end_chunk = (end / chunk_size) as usize;
```

This works because:
- Frontend requests bytes in plaintext space (e.g., "bytes 0-1048575 of the decrypted video")
- We divide by plaintext chunk_size to find which chunks contain those bytes
- Then we use ciphertext offsets to actually read the chunks

### 4. Size Difference

Each chunk's ciphertext is 16 bytes larger than plaintext due to AES-GCM authentication tag:
```
Plaintext:  1048576 bytes
Ciphertext: 1048592 bytes (+16 bytes)
```

This difference accumulates:
```
Chunk 0: plaintext offset 0, ciphertext offset 0
Chunk 1: plaintext offset 1048576, ciphertext offset 1048592 (+16)
Chunk 2: plaintext offset 2097152, ciphertext offset 2097184 (+32)
```

## Testing

### Test Cases Added

1. **Single-chunk file** (< 1MB)
   - Verifies basic encryption/decryption
   - Offset is 0 in both spaces

2. **Two-chunk file** (~1.5MB)
   - Tests offset calculation for chunk 1
   - Verifies chunk boundary handling

3. **Three-chunk file** (~2.5MB)
   - Tests multiple chunk offsets
   - Verifies offset accumulation

4. **Exact chunk boundary** (exactly 1MB)
   - Edge case where last byte of chunk 0 is at position 1048575
   - Chunk 1 starts at 1048576

### Manual Testing

```bash
# Create test recordings of different sizes
1. Record 1-2 seconds (< 1MB, single chunk)
2. Record 3-5 seconds (~1-2MB, two chunks)
3. Record 10+ seconds (> 2MB, multiple chunks)

# Test playback
1. Play each recording with correct password
2. Verify video plays correctly
3. Seek to different positions
4. Check logs for any errors

# Verify chunk metadata
unzip -q recording.notari -d /tmp/test
cat /tmp/test/evidence/*.json | jq '.recording.encryption.chunked.chunks'

# Expected output:
[
  {
    "index": 0,
    "offset": 0,           # Ciphertext offset
    "size": 1048592,       # Ciphertext size
    "nonce": "..."
  },
  {
    "index": 1,
    "offset": 1048592,     # Ciphertext offset (not 1048576!)
    "size": 733093,
    "nonce": "..."
  }
]
```

## Impact

### Before Fix

- ❌ Multi-chunk encrypted videos failed to play
- ❌ Users couldn't play recordings > 1MB
- ❌ Confusing error messages
- ❌ Data appeared corrupted

### After Fix

- ✅ All encrypted videos play correctly
- ✅ No file size limitations
- ✅ Clear error messages
- ✅ Reliable encryption/decryption

## Lessons Learned

### 1. Name Variables Clearly

Bad:
```rust
let mut offset = 0u64;  // Offset in which space?
```

Good:
```rust
let mut plaintext_offset = 0u64;
let mut ciphertext_offset = 0u64;
```

### 2. Document Assumptions

Add comments explaining which space offsets are in:
```rust
pub struct ChunkInfo {
    pub index: usize,
    pub offset: u64,      // Position in CIPHERTEXT file (for seeking)
    pub size: u64,        // Size of CIPHERTEXT (plaintext + 16 byte tag)
    pub nonce: String,
}
```

### 3. Test Edge Cases

- Single-chunk files (offset 0)
- Multi-chunk files (offset accumulation)
- Exact chunk boundaries
- Large files (many chunks)

### 4. Verify Assumptions

When debugging:
1. Check actual file offsets with hexdump
2. Verify chunk metadata matches file structure
3. Test with files of different sizes
4. Don't assume single-chunk behavior generalizes

### 5. Separate Concerns

Keep plaintext and ciphertext logic separate:
- Use plaintext offsets for chunk calculation
- Use ciphertext offsets for file seeking
- Never mix the two

## Related Issues

### Issue #1: File Size Reporting

Initially tried to report plaintext size to frontend, but this was unnecessary. The frontend just needs to know how many bytes to request, and the backend handles the translation.

**Solution**: Report encrypted file size, backend handles decryption transparently.

### Issue #2: Blob MIME Type

Tried changing from "video/mp4" to "video/quicktime" thinking it was a format issue, but the real problem was the offset bug.

**Solution**: Keep "video/mp4" MIME type, fix offset calculation.

### Issue #3: Flaky Behavior

Sometimes videos worked, sometimes they didn't. This was because:
- Small videos (< 1MB) always worked (single chunk)
- Large videos (> 1MB) always failed (multiple chunks)

**Solution**: Fix offset calculation to work for all file sizes.

## References

- [AES-GCM Specification](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [docs/encryption.md](../encryption.md) - User-facing documentation
- [docs/dev/encryption-implementation.md](encryption-implementation.md) - Implementation guide
- [src-tauri/src/evidence/encryption.rs](../../src-tauri/src/evidence/encryption.rs) - Fixed code

## Commit

**Commit message**:
```
fix(encryption): use ciphertext offsets for chunk seeking

The offset field in ChunkInfo must be in ciphertext space (position
in encrypted file) not plaintext space. This fixes multi-chunk
encrypted videos failing to play.

- Separate plaintext_offset and ciphertext_offset variables
- Store ciphertext_offset in ChunkInfo for file seeking
- Increment ciphertext_offset by ciphertext.len() (includes 16-byte tag)
- Add detailed comments explaining offset semantics

Fixes playback of encrypted videos > 1MB.
```

**Files changed**:
- `src-tauri/src/evidence/encryption.rs` - Fixed offset calculation

**Date**: January 10, 2025

