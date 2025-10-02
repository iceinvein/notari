# Notari Smart Contracts

This directory contains the smart contracts for blockchain anchoring in Notari.

## NotariRegistry.sol

A simple, gas-efficient registry for anchoring evidence hashes to the blockchain.

### Features

- **Immutable Anchoring**: Once a hash is anchored, it cannot be changed
- **Timestamp Proof**: Records block timestamp for each anchor
- **Batch Support**: Anchor multiple hashes in one transaction for gas efficiency
- **Event Emission**: Emits `HashAnchored` events for off-chain indexing
- **Query Functions**: Check if a hash is anchored and retrieve anchor details

### Functions

#### `anchor(bytes32 hash)`
Anchor a single hash to the blockchain.
- **Parameters**: `hash` - The SHA256 hash to anchor
- **Reverts**: If hash is already anchored
- **Emits**: `HashAnchored(hash, msg.sender, timestamp, blockNumber)`

#### `batchAnchor(bytes32[] calldata hashes)`
Anchor multiple hashes in one transaction (gas efficient).
- **Parameters**: `hashes` - Array of SHA256 hashes to anchor
- **Reverts**: If any hash is already anchored
- **Emits**: `HashAnchored` for each hash

#### `isAnchored(bytes32 hash) → uint256`
Check if a hash is anchored.
- **Parameters**: `hash` - The hash to check
- **Returns**: Timestamp when anchored (0 if not anchored)

#### `getAnchor(bytes32 hash) → (uint256, address)`
Get full anchor details.
- **Parameters**: `hash` - The hash to query
- **Returns**: `(timestamp, anchorer)` - When and who anchored it

#### `verifyAnchoredBefore(bytes32 hash, uint256 beforeTimestamp) → bool`
Verify a hash was anchored before a certain time.
- **Parameters**: 
  - `hash` - The hash to verify
  - `beforeTimestamp` - The timestamp to check against
- **Returns**: `true` if anchored before the given timestamp

### Events

```solidity
event HashAnchored(
    bytes32 indexed hash,
    address indexed anchorer,
    uint256 timestamp,
    uint256 blockNumber
);
```

## Deployment

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

### Deploy to Testnet

#### Polygon Amoy (Recommended for testing)

```bash
# Get testnet MATIC from https://faucet.polygon.technology/

# Deploy
forge create contracts/NotariRegistry.sol:NotariRegistry \
  --rpc-url https://rpc-amoy.polygon.technology \
  --private-key $PRIVATE_KEY

# Verify
forge verify-contract \
  --chain-id 80002 \
  --compiler-version v0.8.20 \
  $CONTRACT_ADDRESS \
  contracts/NotariRegistry.sol:NotariRegistry \
  --etherscan-api-key $POLYGONSCAN_API_KEY
```

#### Ethereum Sepolia

```bash
# Get testnet ETH from https://sepoliafaucet.com/

forge create contracts/NotariRegistry.sol:NotariRegistry \
  --rpc-url https://sepolia.infura.io/v3/$INFURA_KEY \
  --private-key $PRIVATE_KEY
```

#### Arbitrum Sepolia

```bash
# Get testnet ETH from https://faucet.quicknode.com/arbitrum/sepolia

forge create contracts/NotariRegistry.sol:NotariRegistry \
  --rpc-url https://sepolia-rollup.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY
```

### Deploy to Mainnet

#### Polygon (Recommended - Low cost)

```bash
forge create contracts/NotariRegistry.sol:NotariRegistry \
  --rpc-url https://polygon-rpc.com \
  --private-key $PRIVATE_KEY \
  --verify \
  --etherscan-api-key $POLYGONSCAN_API_KEY
```

**Cost**: ~$0.001 per anchor

#### Arbitrum One

```bash
forge create contracts/NotariRegistry.sol:NotariRegistry \
  --rpc-url https://arb1.arbitrum.io/rpc \
  --private-key $PRIVATE_KEY
```

**Cost**: ~$0.0001 per anchor

#### Base

```bash
forge create contracts/NotariRegistry.sol:NotariRegistry \
  --rpc-url https://mainnet.base.org \
  --private-key $PRIVATE_KEY
```

**Cost**: ~$0.00005 per anchor

#### Ethereum Mainnet

```bash
forge create contracts/NotariRegistry.sol:NotariRegistry \
  --rpc-url https://mainnet.infura.io/v3/$INFURA_KEY \
  --private-key $PRIVATE_KEY
```

**Cost**: ~$1.00 per anchor (expensive!)

## Testing

```bash
# Run tests
forge test

# Run tests with gas reporting
forge test --gas-report

# Run specific test
forge test --match-test testAnchor
```

## Gas Optimization

The contract is optimized for gas efficiency:

- **Single anchor**: ~50,000 gas
- **Batch anchor (10 hashes)**: ~350,000 gas (~35,000 per hash)
- **Batch savings**: ~30% gas reduction

### Batch Anchoring Example

```solidity
bytes32[] memory hashes = new bytes32[](10);
hashes[0] = 0x1234...;
hashes[1] = 0x5678...;
// ... more hashes

registry.batchAnchor(hashes);
```

## Security

### Audit Status

⚠️ **Not audited** - This contract has not been professionally audited. Use at your own risk.

### Security Features

- ✅ Simple, minimal code surface
- ✅ No admin functions
- ✅ No upgradability (immutable)
- ✅ No external calls
- ✅ No token handling
- ✅ Reentrancy-safe (no external calls)

### Known Limitations

- Once anchored, a hash cannot be removed or updated
- No access control (anyone can anchor)
- No refund mechanism
- Storage grows unbounded (but cheap on L2s)

## Integration

### From Rust (Notari)

```rust
use ethers::prelude::*;

abigen!(
    NotariRegistry,
    r#"[
        function anchor(bytes32 hash) external
        function isAnchored(bytes32 hash) external view returns (uint256)
    ]"#
);

let contract = NotariRegistry::new(contract_address, client);
let hash = [0u8; 32]; // Your SHA256 hash
contract.anchor(hash).send().await?;
```

### From JavaScript

```javascript
const abi = [
  "function anchor(bytes32 hash) external",
  "function isAnchored(bytes32 hash) external view returns (uint256)"
];

const contract = new ethers.Contract(address, abi, signer);
const hash = "0x1234..."; // Your SHA256 hash
await contract.anchor(hash);
```

### From Python

```python
from web3 import Web3

abi = [...]  # Contract ABI
contract = w3.eth.contract(address=address, abi=abi)

hash_bytes = bytes.fromhex("1234...")  # Your SHA256 hash
tx = contract.functions.anchor(hash_bytes).transact()
```

## License

MIT License - See LICENSE file for details

## Support

For issues or questions:
- GitHub Issues: https://github.com/yourusername/notari/issues
- Documentation: https://notari.dev/docs

