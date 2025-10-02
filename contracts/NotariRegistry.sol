// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title NotariRegistry
 * @notice Simple registry for anchoring evidence hashes to the blockchain
 * @dev Stores hash -> timestamp mappings for tamper-evident evidence
 */
contract NotariRegistry {
    /// @notice Emitted when a hash is anchored
    event HashAnchored(
        bytes32 indexed hash,
        address indexed anchorer,
        uint256 timestamp,
        uint256 blockNumber
    );

    /// @notice Mapping of hash to anchor timestamp
    mapping(bytes32 => uint256) public anchors;

    /// @notice Mapping of hash to anchorer address
    mapping(bytes32 => address) public anchorers;

    /**
     * @notice Anchor a hash to the blockchain
     * @param hash The hash to anchor (typically SHA256 of evidence manifest)
     */
    function anchor(bytes32 hash) external {
        require(anchors[hash] == 0, "Hash already anchored");
        
        anchors[hash] = block.timestamp;
        anchorers[hash] = msg.sender;
        
        emit HashAnchored(hash, msg.sender, block.timestamp, block.number);
    }

    /**
     * @notice Batch anchor multiple hashes (gas efficient)
     * @param hashes Array of hashes to anchor
     */
    function batchAnchor(bytes32[] calldata hashes) external {
        for (uint256 i = 0; i < hashes.length; i++) {
            bytes32 hash = hashes[i];
            require(anchors[hash] == 0, "Hash already anchored");
            
            anchors[hash] = block.timestamp;
            anchorers[hash] = msg.sender;
            
            emit HashAnchored(hash, msg.sender, block.timestamp, block.number);
        }
    }

    /**
     * @notice Check if a hash is anchored
     * @param hash The hash to check
     * @return timestamp The timestamp when anchored (0 if not anchored)
     */
    function isAnchored(bytes32 hash) external view returns (uint256) {
        return anchors[hash];
    }

    /**
     * @notice Get anchor details
     * @param hash The hash to query
     * @return timestamp When the hash was anchored
     * @return anchorer Who anchored the hash
     */
    function getAnchor(bytes32 hash) external view returns (uint256 timestamp, address anchorer) {
        return (anchors[hash], anchorers[hash]);
    }

    /**
     * @notice Verify a hash was anchored before a certain time
     * @param hash The hash to verify
     * @param beforeTimestamp The timestamp to check against
     * @return True if hash was anchored before the given timestamp
     */
    function verifyAnchoredBefore(bytes32 hash, uint256 beforeTimestamp) external view returns (bool) {
        uint256 anchorTime = anchors[hash];
        return anchorTime > 0 && anchorTime < beforeTimestamp;
    }
}

