# Blockchain Anchoring

## Overview

Blockchain anchoring provides cryptographic proof that a recording existed at a specific point in time. By storing a hash of the recording's manifest on an immutable blockchain, Notari creates tamper-evident timestamps that can be independently verified.

## What Anchoring Proves

Blockchain anchoring establishes:

1. **Temporal Proof**: The recording existed at or before the blockchain timestamp
2. **Immutability**: The manifest hash is permanently recorded on-chain
3. **Independence**: Verification doesn't require trusting Notari - anyone can verify against the blockchain
4. **Cryptographic Ordering**: Proves the relative ordering of recordings

### What Anchoring Does NOT Prove

- **Content authenticity**: Anchoring timestamps the manifest, not the video content itself (use signature verification for that)
- **Recording accuracy**: It doesn't prove the recording accurately represents what happened
- **Legal validity**: Blockchain timestamps may not be legally recognized in all jurisdictions

## How It Works

### Recording Phase

1. Video is recorded and optionally encrypted
2. Manifest is created with:
   - `plaintext_hash` - SHA-256 of original video
   - `encrypted_hash` - SHA-256 of encrypted file (if encrypted)
   - Recording metadata, system info, timestamps
3. Manifest is **signed** with Ed25519 signature
4. Signature covers all manifest data (including both video hashes)

### Anchoring Phase

1. Manifest hash is computed (SHA-256 of entire manifest JSON)
2. Manifest hash is submitted to blockchain smart contract
3. Smart contract stores: `hash → (timestamp, anchorer_address, block_number)`
4. Transaction is confirmed and proof is obtained
5. `blockchain_anchor` field is added to manifest with:
   - `anchored_at` - Timestamp when anchored
   - `manifest_hash` - The hash that was anchored (pre-anchor manifest)
   - `proof` - Blockchain proof (tx hash, contract address, chain ID, block number)
6. Manifest is **re-signed** to include the anchor in the signature

### Verification Phase

Notari provides multiple verification levels:

#### Level 1: Signature Verification (Offline)
- Verifies Ed25519 signature on manifest
- Proves manifest hasn't been tampered with
- Includes verification of anchor metadata (since anchor is now signed)
- **No network required**

#### Level 2: Hash Verification (Offline)
- Computes hash of video file
- Compares against `encrypted_hash` (if encrypted) or `plaintext_hash`
- Proves video file matches manifest
- **No network required**

#### Level 3: Anchor Metadata Verification (Offline)
- Checks that `blockchain_anchor` field exists
- Signature verification proves anchor metadata is authentic
- **No network required**

#### Level 4: On-Chain Verification (Online)
- Queries blockchain smart contract with `manifest_hash`
- Confirms hash was actually anchored at claimed time
- Provides absolute proof of temporal ordering
- **Requires RPC connection to blockchain**

## Encryption and Anchoring

When encryption is enabled, the manifest contains both hashes:

```rust
{
  "recording": {
    "plaintext_hash": {
      "algorithm": "SHA-256",
      "value": "abc123..."  // Hash of original video
    },
    "encrypted_hash": {
      "algorithm": "SHA-256", 
      "value": "def456..."  // Hash of encrypted file
    },
    "encrypted": true
  }
}
```

**Key properties:**
- Both hashes are included in the manifest
- Both hashes are protected by the signature
- The manifest hash (which includes both) is anchored on-chain
- Even though only the encrypted file exists, we have cryptographic proof of the plaintext hash
- Verification checks the encrypted file against `encrypted_hash`

## Smart Contract

Notari uses a simple, gas-efficient registry contract:

```solidity
contract NotariRegistry {
    mapping(bytes32 => Anchor) public anchors;
    
    struct Anchor {
        uint256 timestamp;
        address anchorer;
    }
    
    function anchor(bytes32 hash) external {
        require(anchors[hash].timestamp == 0, "Already anchored");
        anchors[hash] = Anchor(block.timestamp, msg.sender);
        emit HashAnchored(hash, msg.sender, block.timestamp, block.number);
    }
    
    function isAnchored(bytes32 hash) external view returns (uint256) {
        return anchors[hash].timestamp;
    }
}
```

**Security properties:**
- Immutable once deployed (no admin functions)
- No upgradability
- No external calls (reentrancy-safe)
- Simple, auditable code surface

## Supported Blockchains

### Testnets (for development)
- **Polygon Amoy** - Recommended for testing
- **Ethereum Sepolia**
- **Arbitrum Sepolia**

### Mainnets (for production)
- **Polygon** - ~$0.001 per anchor (recommended)
- **Arbitrum One** - ~$0.0001 per anchor
- **Base** - ~$0.00005 per anchor
- **Ethereum** - ~$1.00 per anchor (expensive)

### Mock Environment
- Local-only anchoring for development
- No blockchain interaction
- Instant, free anchoring

## Configuration

Blockchain anchoring is configured in Settings → Blockchain:

- **Enable/Disable**: Toggle anchoring on/off
- **Environment**: Mock, Testnet, or Mainnet
- **Chain**: Select blockchain network
- **Auto-anchor**: Automatically anchor recordings after capture
- **Wallet**: Configure wallet for paying gas fees

## Verification Examples

### Via Notari App
1. Open recording in library
2. Click "Verify" button
3. View verification report with all checks

### Via Block Explorer
1. Get transaction hash from manifest's `blockchain_anchor.proof.tx_hash`
2. Visit block explorer (e.g., polygonscan.com)
3. View transaction details and contract call
4. Confirm hash was anchored at claimed timestamp

### Programmatically
```rust
use ethers::prelude::*;

// Query contract
let contract = NotariRegistry::new(contract_address, provider);
let timestamp = contract.is_anchored(manifest_hash).call().await?;

if timestamp > 0 {
    println!("Anchored at: {}", timestamp);
} else {
    println!("Not anchored");
}
```

## Trust Model

### What You Must Trust
- **Blockchain security**: The chosen blockchain is secure and immutable
- **Smart contract**: The contract code is correct (open source, auditable)
- **RPC provider**: For on-chain verification (can use your own node)

### What You Don't Need to Trust
- **Notari**: Verification is independent - anyone can verify against blockchain
- **Centralized servers**: No central authority required
- **Notari's signature**: Blockchain provides independent timestamp proof

## Cost Considerations

Anchoring costs vary by blockchain:

| Chain | Cost per Anchor | Confirmation Time |
|-------|----------------|-------------------|
| Polygon | ~$0.001 | ~2 seconds |
| Arbitrum | ~$0.0001 | ~1 second |
| Base | ~$0.00005 | ~2 seconds |
| Ethereum | ~$1.00 | ~12 seconds |

**Batch anchoring** (future feature) can reduce costs by ~30% when anchoring multiple recordings.

## Privacy Considerations

- **Manifest hash is public**: Anyone can see the hash on-chain
- **Content is private**: The hash reveals nothing about the video content
- **Metadata is private**: Recording details are not stored on-chain
- **Anchorer address is public**: Your wallet address is visible on-chain

To enhance privacy:
- Use a dedicated wallet for anchoring (separate from other activities)
- Consider using privacy-focused chains (future support)

## Future Enhancements

- **OpenTimestamps support**: Bitcoin-based timestamping
- **Batch anchoring**: Anchor multiple recordings in one transaction
- **Merkle tree proofs**: More efficient batch verification
- **Cross-chain anchoring**: Anchor to multiple chains simultaneously
- **Privacy-preserving anchoring**: Zero-knowledge proofs for private anchoring

## Troubleshooting

### "Failed to anchor: insufficient funds"
- Check wallet balance in Settings → Blockchain
- Add funds to your wallet for gas fees

### "Failed to anchor: RPC error"
- Check internet connection
- Try different RPC endpoint in chain configuration
- Verify blockchain network is operational

### "Anchor verification failed"
- Ensure you're connected to the correct network
- Check that the contract address matches
- Verify the manifest hasn't been tampered with

## References

- [Smart Contract Source](../contracts/NotariRegistry.sol)
- [Contract Deployment Guide](../contracts/README.md)
- [Architecture Overview](ARCHITECTURE.md)
- [Encryption System](encryption.md)

