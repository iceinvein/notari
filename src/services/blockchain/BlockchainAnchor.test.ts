import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Tauri invoke function
vi.mock("@tauri-apps/api/core");

import { invoke } from "@tauri-apps/api/core";
import {
  type AnchorMetadata,
  BlockchainAnchor,
  BlockchainNetwork,
  type TransactionConfig,
  TransactionPriority,
} from "./BlockchainAnchor";

const mockInvoke = vi.mocked(invoke);

describe("BlockchainAnchor", () => {
  let blockchainAnchor: BlockchainAnchor;

  beforeEach(() => {
    blockchainAnchor = new BlockchainAnchor();
    mockInvoke.mockClear();
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      mockInvoke.mockResolvedValueOnce(
        "Blockchain anchor service initialized successfully",
      );

      await blockchainAnchor.initialize();

      expect(mockInvoke).toHaveBeenCalledWith("initialize_blockchain_anchor");
    });

    it("should not initialize twice", async () => {
      mockInvoke.mockResolvedValueOnce(
        "Blockchain anchor service initialized successfully",
      );

      await blockchainAnchor.initialize();
      await blockchainAnchor.initialize();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it("should handle initialization errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Initialization failed"));

      await expect(blockchainAnchor.initialize()).rejects.toThrow(
        "Failed to initialize blockchain anchor: Error: Initialization failed",
      );
    });
  });

  describe("anchorHash", () => {
    const mockMetadata: AnchorMetadata = {
      proof_pack_id: "test_pack_123",
      creator: "test_user",
      timestamp: Date.now(),
      content_hash: "test_hash",
      tags: { type: "test" },
    };

    it("should anchor a hash successfully", async () => {
      const mockResult = {
        transaction_id: "tx_123",
        timestamp: Date.now(),
        network_id: "arweave",
        cost: 1000,
        confirmation_url: "https://arweave.net/tx/tx_123",
      };

      mockInvoke
        .mockResolvedValueOnce("initialized") // initialization
        .mockResolvedValueOnce(mockResult); // anchor_hash

      const result = await blockchainAnchor.anchorHash(
        "test_hash",
        mockMetadata,
      );

      expect(result).toEqual(mockResult);
      expect(mockInvoke).toHaveBeenCalledWith("anchor_hash", {
        request: {
          hash: "test_hash",
          metadata: mockMetadata,
          config: undefined,
        },
      });
    });

    it("should anchor with custom config", async () => {
      const config: TransactionConfig = {
        network: BlockchainNetwork.Ethereum,
        max_retries: 5,
        retry_delay_ms: 2000,
        max_fee: 500000,
        priority: TransactionPriority.High,
      };

      mockInvoke.mockResolvedValueOnce("initialized").mockResolvedValueOnce({
        transaction_id: "eth_tx_123",
        timestamp: Date.now(),
        network_id: "ethereum",
        cost: 50000,
        confirmation_url: "https://etherscan.io/tx/eth_tx_123",
      });

      await blockchainAnchor.anchorHash("test_hash", mockMetadata, config);

      expect(mockInvoke).toHaveBeenCalledWith("anchor_hash", {
        request: {
          hash: "test_hash",
          metadata: mockMetadata,
          config,
        },
      });
    });

    it("should handle anchor errors", async () => {
      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockRejectedValueOnce(new Error("Network error"));

      await expect(
        blockchainAnchor.anchorHash("test_hash", mockMetadata),
      ).rejects.toThrow("Failed to anchor hash: Error: Network error");
    });
  });

  describe("anchorBatch", () => {
    const mockMetadata: AnchorMetadata = {
      proof_pack_id: "batch_pack_123",
      creator: "test_user",
      timestamp: Date.now(),
      content_hash: "batch_hash",
      tags: { type: "batch" },
    };

    it("should anchor multiple hashes successfully", async () => {
      const hashes = ["hash1", "hash2", "hash3"];
      const mockResult = {
        transaction_id: "batch_tx_123",
        timestamp: Date.now(),
        network_id: "arweave",
        cost: 3000,
        confirmation_url: "https://arweave.net/tx/batch_tx_123",
      };
      const mockMerkleRoot = "merkle_root_abc123";

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce([mockResult, mockMerkleRoot]);

      const result = await blockchainAnchor.anchorBatch(hashes, mockMetadata);

      expect(result).toEqual({
        result: mockResult,
        merkleRoot: mockMerkleRoot,
      });
      expect(mockInvoke).toHaveBeenCalledWith("anchor_batch", {
        request: {
          hashes,
          metadata: mockMetadata,
          config: undefined,
        },
      });
    });

    it("should reject empty batch", async () => {
      await expect(
        blockchainAnchor.anchorBatch([], mockMetadata),
      ).rejects.toThrow("Cannot anchor empty batch");
    });
  });

  describe("verifyAnchor", () => {
    it("should verify an anchor successfully", async () => {
      const mockVerification = {
        is_valid: true,
        transaction_id: "tx_123",
        block_number: 12345,
        confirmations: 10,
        timestamp: Date.now(),
        network_id: "arweave",
      };

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(mockVerification);

      const result = await blockchainAnchor.verifyAnchor(
        "tx_123",
        BlockchainNetwork.Arweave,
      );

      expect(result).toEqual(mockVerification);
      expect(mockInvoke).toHaveBeenCalledWith("verify_anchor", {
        request: {
          anchor_id: "tx_123",
          network: BlockchainNetwork.Arweave,
        },
      });
    });

    it("should handle verification errors", async () => {
      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockRejectedValueOnce(new Error("Transaction not found"));

      await expect(
        blockchainAnchor.verifyAnchor("invalid_tx", BlockchainNetwork.Arweave),
      ).rejects.toThrow(
        "Failed to verify anchor: Error: Transaction not found",
      );
    });
  });

  describe("generateMerkleProof", () => {
    it("should generate Merkle proof successfully", async () => {
      const mockProof = {
        root: "merkle_root",
        leaf: "leaf_hash",
        path: [
          { hash: "sibling1", is_left: false },
          { hash: "sibling2", is_left: true },
        ],
        index: 2,
      };

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(mockProof);

      const result = await blockchainAnchor.generateMerkleProof(
        "test_hash",
        "anchor_123",
      );

      expect(result).toEqual(mockProof);
      expect(mockInvoke).toHaveBeenCalledWith("generate_merkle_proof", {
        request: {
          hash: "test_hash",
          anchor_id: "anchor_123",
        },
      });
    });
  });

  describe("verifyMerkleProof", () => {
    it("should verify Merkle proof successfully", async () => {
      const mockProof = {
        root: "merkle_root",
        leaf: "leaf_hash",
        path: [{ hash: "sibling", is_left: false }],
        index: 1,
      };

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(true);

      const result = await blockchainAnchor.verifyMerkleProof(mockProof);

      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("verify_merkle_proof", {
        proof: mockProof,
      });
    });
  });

  describe("getSupportedNetworks", () => {
    it("should return supported networks", async () => {
      const mockNetworks = [
        BlockchainNetwork.Arweave,
        BlockchainNetwork.Ethereum,
        BlockchainNetwork.EthereumTestnet,
        BlockchainNetwork.ArweaveTestnet,
      ];

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(mockNetworks);

      const result = await blockchainAnchor.getSupportedNetworks();

      expect(result).toEqual(mockNetworks);
      expect(mockInvoke).toHaveBeenCalledWith("get_supported_networks");
    });
  });

  describe("getNetworkStats", () => {
    it("should return network statistics", async () => {
      const mockStats = {
        network: BlockchainNetwork.Arweave,
        block_height: 12345,
        avg_confirmation_time: 600,
        current_fee: 1000,
        congestion_level: 0.3,
      };

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(mockStats);

      const result = await blockchainAnchor.getNetworkStats(
        BlockchainNetwork.Arweave,
      );

      expect(result).toEqual(mockStats);
      expect(mockInvoke).toHaveBeenCalledWith("get_network_stats", {
        network: BlockchainNetwork.Arweave,
      });
    });
  });

  describe("estimateTransactionCost", () => {
    it("should estimate transaction cost", async () => {
      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(5000);

      const result = await blockchainAnchor.estimateTransactionCost(
        BlockchainNetwork.Ethereum,
        1024,
        TransactionPriority.High,
      );

      expect(result).toBe(5000);
      expect(mockInvoke).toHaveBeenCalledWith("estimate_transaction_cost", {
        network: BlockchainNetwork.Ethereum,
        dataSize: 1024,
        priority: TransactionPriority.High,
      });
    });

    it("should use default priority", async () => {
      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(3000);

      await blockchainAnchor.estimateTransactionCost(
        BlockchainNetwork.Arweave,
        512,
      );

      expect(mockInvoke).toHaveBeenCalledWith("estimate_transaction_cost", {
        network: BlockchainNetwork.Arweave,
        dataSize: 512,
        priority: TransactionPriority.Medium,
      });
    });
  });

  describe("getOptimalNetwork", () => {
    it("should return optimal network based on priority", async () => {
      const mockNetworks = [
        BlockchainNetwork.Arweave,
        BlockchainNetwork.Ethereum,
      ];
      const mockArweaveStats = {
        network: BlockchainNetwork.Arweave,
        block_height: 12345,
        avg_confirmation_time: 600,
        current_fee: 1000,
        congestion_level: 0.2,
      };
      const mockEthereumStats = {
        network: BlockchainNetwork.Ethereum,
        block_height: 54321,
        avg_confirmation_time: 15,
        current_fee: 5000,
        congestion_level: 0.8,
      };

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(mockNetworks)
        .mockResolvedValueOnce(mockArweaveStats)
        .mockResolvedValueOnce(mockEthereumStats);

      const result = await blockchainAnchor.getOptimalNetwork(
        TransactionPriority.Low,
      );

      // Should prefer Arweave for low priority (cost-focused)
      expect(result).toBe(BlockchainNetwork.Arweave);
    });

    it("should respect cost constraints", async () => {
      const mockNetworks = [
        BlockchainNetwork.Arweave,
        BlockchainNetwork.Ethereum,
      ];
      const mockArweaveStats = {
        network: BlockchainNetwork.Arweave,
        block_height: 12345,
        avg_confirmation_time: 600,
        current_fee: 10000, // Too expensive
        congestion_level: 0.2,
      };
      const mockEthereumStats = {
        network: BlockchainNetwork.Ethereum,
        block_height: 54321,
        avg_confirmation_time: 15,
        current_fee: 5000, // Within budget
        congestion_level: 0.8,
      };

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(mockNetworks)
        .mockResolvedValueOnce(mockArweaveStats)
        .mockResolvedValueOnce(mockEthereumStats);

      const result = await blockchainAnchor.getOptimalNetwork(
        TransactionPriority.Medium,
        8000,
      );

      expect(result).toBe(BlockchainNetwork.Ethereum);
    });

    it("should throw error when no networks are affordable", async () => {
      const mockNetworks = [BlockchainNetwork.Arweave];
      const mockArweaveStats = {
        network: BlockchainNetwork.Arweave,
        block_height: 12345,
        avg_confirmation_time: 600,
        current_fee: 10000,
        congestion_level: 0.2,
      };

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(mockNetworks)
        .mockResolvedValueOnce(mockArweaveStats);

      await expect(
        blockchainAnchor.getOptimalNetwork(TransactionPriority.Medium, 5000),
      ).rejects.toThrow("No networks available within cost constraints");
    });
  });

  describe("getStatus", () => {
    it("should return service status", async () => {
      const mockStatus =
        "Blockchain anchor service active with 4 supported networks";

      mockInvoke
        .mockResolvedValueOnce("initialized")
        .mockResolvedValueOnce(mockStatus);

      const result = await blockchainAnchor.getStatus();

      expect(result).toBe(mockStatus);
      expect(mockInvoke).toHaveBeenCalledWith("get_blockchain_status");
    });
  });
});
