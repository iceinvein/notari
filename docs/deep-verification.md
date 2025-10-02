# Deep Verification

## Overview

Deep verification extends standard verification by querying the blockchain to confirm that the anchor metadata in the manifest actually exists on-chain. This provides an additional layer of trust beyond offline signature verification.

## Verification Levels

### Standard Verification (Offline)

**What it checks:**
1. **Manifest structure** - Valid JSON format and required fields
2. **Digital signature** - Ed25519 signature verification
3. **File integrity** - SHA-256 hash match
4. **Anchor metadata** - Presence and format (if anchored)

**What it proves:**
- Recording hasn't been tampered with since signing
- Manifest metadata is authentic (protected by signature)
- Blockchain anchor metadata is authentic (included in signature after re-signing)

**Limitations:**
- Doesn't verify the anchor actually exists on-chain
- Relies solely on the signature for trust

### Deep Verification (Online)

**What it checks:**
- All standard verification checks, PLUS:
- **On-chain verification** - Queries the blockchain smart contract to confirm the manifest hash was actually anchored

**What it proves:**
- Everything from standard verification
- The manifest hash exists in the blockchain registry
- The timestamp claimed in the anchor matches the on-chain record
- The anchorer address matches the on-chain record

**Requirements:**
- Network connectivity
- RPC endpoint access (configured in blockchain settings)
- Smart contract must be accessible

## How It Works

### Recording Flow
1. Record video → Create manifest → Sign manifest (no anchor yet)
2. Compute manifest hash (without anchor field)
3. Anchor manifest hash to blockchain smart contract
4. Add `blockchain_anchor` field to manifest
5. **Re-sign manifest** (signature now covers anchor metadata)

### Standard Verification Flow
```rust
verify_recording(manifest_path, video_path)
  ├─ Load manifest
  ├─ Verify signature (covers entire manifest including anchor)
  ├─ Verify video hash
  └─ Return report with anchor metadata
```

### Deep Verification Flow
```rust
verify_recording_deep(manifest_path, video_path)
  ├─ Perform standard verification
  ├─ If blockchain anchor present:
  │   ├─ Compute pre-anchor manifest hash
  │   ├─ Query blockchain smart contract
  │   ├─ Verify hash exists on-chain
  │   └─ Add on-chain verification result to report
  └─ Return enhanced report
```

## Implementation Details

### Backend

**New Types** (`src-tauri/src/evidence/blockchain/types.rs`):
```rust
pub struct OnChainVerificationResult {
    pub verified: bool,
    pub chain_name: String,
    pub contract_address: String,
    pub error: Option<String>,
}
```

**Extended Verification Report** (`src-tauri/src/evidence/verification.rs`):
```rust
pub struct BlockchainAnchorCheck {
    pub present: bool,
    pub algorithm: String,
    pub anchored_at: String,
    pub explorer_url: Option<String>,
    pub on_chain_verified: Option<OnChainVerificationResult>, // New field
}
```

**New Verification Method** (`src-tauri/src/evidence/verification.rs`):
```rust
pub async fn verify_deep<P: AsRef<Path>>(
    manifest_path: P,
    video_path: P,
    anchorer: &dyn BlockchainAnchorer,
) -> Result<VerificationReport, Box<dyn Error>>
```

**New Tauri Command** (`src-tauri/src/recording_commands.rs`):
```rust
#[tauri::command]
pub async fn verify_recording_deep(
    state: tauri::State<'_, BlockchainState>,
    manifest_path: String,
    video_path: String,
) -> Result<VerificationReport, String>
```

### Frontend

**Verification Mode Selector** (`src/components/tabs/VerifyTab.tsx`):
- Toggle between "Standard" and "Deep" verification modes
- Visual indicator showing what each mode checks
- Calls appropriate backend command based on selection

**On-chain Verification Display** (`src/components/tabs/VerifyTab.tsx`):
- Shows verification status (Verified/Failed)
- Displays chain name and contract address
- Shows error message if verification fails
- Only appears when deep verification is performed

## Usage

### Via UI

1. Open the Verify tab
2. Select a `.notari` proof pack file
3. Choose verification mode:
   - **Standard**: Fast offline verification
   - **Deep**: Includes on-chain blockchain query
4. Click "Verify Recording" or "Deep Verify Recording"
5. View results including on-chain verification status (if deep mode)

### Via API

**Standard Verification:**
```typescript
const report = await invoke<VerificationReport>("verify_recording", {
  manifestPath: "/path/to/file.notari",
  videoPath: "/path/to/file.notari",
});
```

**Deep Verification:**
```typescript
const report = await invoke<VerificationReport>("verify_recording_deep", {
  manifestPath: "/path/to/file.notari",
  videoPath: "/path/to/file.notari",
});

// Check on-chain verification result
if (report.verification.checks.blockchain_anchor?.on_chain_verified) {
  const onChain = report.verification.checks.blockchain_anchor.on_chain_verified;
  console.log(`On-chain verified: ${onChain.verified}`);
  console.log(`Chain: ${onChain.chain_name}`);
  console.log(`Contract: ${onChain.contract_address}`);
}
```

## Security Model

### Defense in Depth

1. **Signature verification** (offline)
   - Proves manifest hasn't been tampered with
   - Protects all metadata including anchor

2. **On-chain verification** (online)
   - Proves anchor actually exists on blockchain
   - Confirms timestamp and anchorer address
   - Detects if anchor metadata was fabricated

### Attack Scenarios

**Scenario 1: Tampered manifest**
- Attacker modifies recording metadata
- ❌ Signature verification fails (standard mode catches this)

**Scenario 2: Fake anchor metadata**
- Attacker adds fake blockchain anchor to manifest
- ❌ Signature verification fails (anchor is signed)

**Scenario 3: Stolen anchor metadata**
- Attacker copies anchor from legitimate recording
- ❌ Signature verification fails (anchor is bound to specific manifest)

**Scenario 4: Replay attack**
- Attacker uses old signed manifest with valid anchor
- ✅ Signature passes, on-chain verification passes
- ⚠️ Mitigation: Check timestamp, verify recording content matches expected

## When to Use Each Mode

### Use Standard Verification When:
- Quick verification needed
- Offline environment
- Trust in signature is sufficient
- Verifying many recordings in batch

### Use Deep Verification When:
- High-stakes verification (legal, compliance)
- Paranoid verification needed
- Verifying anchor authenticity is critical
- Network connectivity available

## Performance Considerations

**Standard Verification:**
- Time: ~100-500ms (depends on video size)
- Network: None required
- Cost: Free

**Deep Verification:**
- Time: ~1-5 seconds (includes RPC call)
- Network: Required (RPC endpoint)
- Cost: Free (read-only blockchain query)

## Mock Environment Behavior

### Development Mode

When using the **Mock** blockchain environment (for development):

**How it works:**
- Anchored hashes are stored in **in-memory global storage**
- Storage persists across different MockAnchorer instances within the same app session
- Simulates real blockchain behavior without network calls
- Deep verification works correctly in Mock mode

**Limitations:**
- Storage is cleared when the app restarts
- Not suitable for production use
- No actual blockchain immutability

**Why this matters:**
In development, you can:
1. Anchor a recording with Mock environment
2. Close and reopen the verification UI
3. Deep verify the recording successfully
4. The verification will show "Verified" because the hash is in memory

This allows full testing of the deep verification flow without needing a real blockchain connection.

## Troubleshooting

### Deep Verification Fails

**Error: "Failed to connect to RPC endpoint"** (Testnet/Mainnet only)
- Check network connectivity
- Verify RPC URL in blockchain settings
- Try different RPC provider

**Error: "Contract not found"** (Testnet/Mainnet only)
- Verify contract address in settings
- Check you're on the correct network
- Ensure contract is deployed

**Error: "Hash not found on-chain"**
- Recording may not be anchored yet
- Anchor transaction may not be confirmed
- Anchor metadata may be incorrect
- **Mock mode:** App was restarted (storage cleared)

### On-chain Verification Shows "Not Verified"

Possible reasons:
1. Recording was never actually anchored
2. Anchor transaction failed or reverted
3. Wrong blockchain network configured
4. Manifest was modified after anchoring (signature would also fail)
5. **Mock mode:** App was restarted since anchoring

## Future Enhancements

Potential improvements:
- Batch deep verification for multiple recordings
- Caching of on-chain verification results
- Support for multiple blockchain networks in one verification
- Verification via light client (trustless)
- Integration with blockchain explorers for detailed transaction info

