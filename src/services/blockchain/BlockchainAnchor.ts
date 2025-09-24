import { invoke } from "@tauri-apps/api/core";

export interface AnchorMetadata {
  proof_pack_id: string;
  creator: string;
  timestamp: number;
  content_hash: string;
  tags: Record<string, string>;
}

export interface AnchorResult {
  transaction_id: string;
  block_number?: number;
  timestamp: number;
  network_id: string;
  cost: number;
  confirmation_url: string;
}

export interface AnchorVerification {
  is_valid: boolean;
  transaction_id: string;
  block_number?: number;
  confirmations: number;
  timestamp: number;
  network_id: string;
  merkle_proof?: MerkleProof;
}

export interface MerkleProof {
  root: string;
  leaf: string;
  path: MerkleNode[];
  index: number;
}

export interface MerkleNode {
  hash: string;
  is_left: boolean;
}

export enum BlockchainNetwork {
  Arweave = "Arweave",
  Ethereum = "Ethereum",
  EthereumTestnet = "EthereumTestnet",
  ArweaveTestnet = "ArweaveTestnet",
}

export enum TransactionPriority {
  Low = "Low",
  Medium = "Medium",
  High = "High",
  Urgent = "Urgent",
}

export interface TransactionConfig {
  network: BlockchainNetwork;
  max_retries: number;
  retry_delay_ms: number;
  max_fee?: number;
  priority: TransactionPriority;
}

export interface NetworkStats {
  network: BlockchainNetwork;
  block_height: number;
  avg_confirmation_time: number;
  current_fee: number;
  congestion_level: number;
}

export interface AnchorRequest {
  hash: string;
  metadata: AnchorMetadata;
  config?: TransactionConfig;
}

export interface BatchAnchorRequest {
  hashes: string[];
  metadata: AnchorMetadata;
  config?: TransactionConfig;
}

export interface VerificationRequest {
  anchor_id: string;
  network: BlockchainNetwork;
}

export interface MerkleProofRequest {
  hash: string;
  anchor_id: string;
}

/**
 * Blockchain anchoring service for securing proof packs on distributed ledgers
 */
export class BlockchainAnchor {
  private initialized = false;

  /**
   * Initialize the blockchain anchor service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await invoke<string>("initialize_blockchain_anchor");
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize blockchain anchor: ${error}`);
    }
  }

  /**
   * Anchor a single hash on blockchain
   */
  async anchorHash(
    hash: string,
    metadata: AnchorMetadata,
    config?: TransactionConfig,
  ): Promise<AnchorResult> {
    await this.ensureInitialized();

    const request: AnchorRequest = {
      hash,
      metadata,
      config,
    };

    try {
      return await invoke<AnchorResult>("anchor_hash", { request });
    } catch (error) {
      throw new Error(`Failed to anchor hash: ${error}`);
    }
  }

  /**
   * Anchor multiple hashes using Merkle tree for efficiency
   */
  async anchorBatch(
    hashes: string[],
    metadata: AnchorMetadata,
    config?: TransactionConfig,
  ): Promise<{ result: AnchorResult; merkleRoot: string }> {
    await this.ensureInitialized();

    if (hashes.length === 0) {
      throw new Error("Cannot anchor empty batch");
    }

    const request: BatchAnchorRequest = {
      hashes,
      metadata,
      config,
    };

    try {
      const [result, merkleRoot] = await invoke<[AnchorResult, string]>(
        "anchor_batch",
        { request },
      );
      return { result, merkleRoot };
    } catch (error) {
      throw new Error(`Failed to anchor batch: ${error}`);
    }
  }

  /**
   * Verify an anchor on blockchain
   */
  async verifyAnchor(
    anchorId: string,
    network: BlockchainNetwork,
  ): Promise<AnchorVerification> {
    await this.ensureInitialized();

    const request: VerificationRequest = {
      anchor_id: anchorId,
      network,
    };

    try {
      return await invoke<AnchorVerification>("verify_anchor", { request });
    } catch (error) {
      throw new Error(`Failed to verify anchor: ${error}`);
    }
  }

  /**
   * Generate Merkle proof for a hash in a batch anchor
   */
  async generateMerkleProof(
    hash: string,
    anchorId: string,
  ): Promise<MerkleProof> {
    await this.ensureInitialized();

    const request: MerkleProofRequest = {
      hash,
      anchor_id: anchorId,
    };

    try {
      return await invoke<MerkleProof>("generate_merkle_proof", { request });
    } catch (error) {
      throw new Error(`Failed to generate Merkle proof: ${error}`);
    }
  }

  /**
   * Verify a Merkle proof
   */
  async verifyMerkleProof(proof: MerkleProof): Promise<boolean> {
    await this.ensureInitialized();

    try {
      return await invoke<boolean>("verify_merkle_proof", { proof });
    } catch (error) {
      throw new Error(`Failed to verify Merkle proof: ${error}`);
    }
  }

  /**
   * Get supported blockchain networks
   */
  async getSupportedNetworks(): Promise<BlockchainNetwork[]> {
    await this.ensureInitialized();

    try {
      return await invoke<BlockchainNetwork[]>("get_supported_networks");
    } catch (error) {
      throw new Error(`Failed to get supported networks: ${error}`);
    }
  }

  /**
   * Get network statistics
   */
  async getNetworkStats(network: BlockchainNetwork): Promise<NetworkStats> {
    await this.ensureInitialized();

    try {
      return await invoke<NetworkStats>("get_network_stats", { network });
    } catch (error) {
      throw new Error(`Failed to get network stats: ${error}`);
    }
  }

  /**
   * Get blockchain service status
   */
  async getStatus(): Promise<string> {
    await this.ensureInitialized();

    try {
      return await invoke<string>("get_blockchain_status");
    } catch (error) {
      throw new Error(`Failed to get blockchain status: ${error}`);
    }
  }

  /**
   * Estimate transaction cost
   */
  async estimateTransactionCost(
    network: BlockchainNetwork,
    dataSize: number,
    priority: TransactionPriority = TransactionPriority.Medium,
  ): Promise<number> {
    await this.ensureInitialized();

    try {
      return await invoke<number>("estimate_transaction_cost", {
        network,
        dataSize,
        priority,
      });
    } catch (error) {
      throw new Error(`Failed to estimate transaction cost: ${error}`);
    }
  }

  /**
   * Create transaction configuration
   */
  async createTransactionConfig(
    network: BlockchainNetwork,
    options: {
      maxRetries?: number;
      retryDelayMs?: number;
      maxFee?: number;
      priority?: TransactionPriority;
    } = {},
  ): Promise<TransactionConfig> {
    return await invoke<TransactionConfig>("create_transaction_config", {
      network,
      maxRetries: options.maxRetries,
      retryDelayMs: options.retryDelayMs,
      maxFee: options.maxFee,
      priority: options.priority,
    });
  }

  /**
   * Create anchor metadata
   */
  async createAnchorMetadata(
    proofPackId: string,
    creator: string,
    timestamp: number,
    contentHash: string,
    tags: Record<string, string> = {},
  ): Promise<AnchorMetadata> {
    return await invoke<AnchorMetadata>("create_anchor_metadata", {
      proofPackId,
      creator,
      timestamp,
      contentHash,
      tags,
    });
  }

  /**
   * Get optimal network for anchoring based on cost and confirmation time
   */
  async getOptimalNetwork(
    priority: TransactionPriority = TransactionPriority.Medium,
    maxCost?: number,
  ): Promise<BlockchainNetwork> {
    const networks = await this.getSupportedNetworks();
    const networkStats = await Promise.all(
      networks.map(async (network) => ({
        network,
        stats: await this.getNetworkStats(network),
      })),
    );

    // Filter by cost if specified
    const affordableNetworks = maxCost
      ? networkStats.filter(({ stats }) => stats.current_fee <= maxCost)
      : networkStats;

    if (affordableNetworks.length === 0) {
      throw new Error("No networks available within cost constraints");
    }

    // Sort by priority criteria
    const sortedNetworks = affordableNetworks.sort((a, b) => {
      switch (priority) {
        case TransactionPriority.Low:
          // Prioritize cost over speed
          return a.stats.current_fee - b.stats.current_fee;
        case TransactionPriority.Urgent:
          // Prioritize speed over cost
          return a.stats.avg_confirmation_time - b.stats.avg_confirmation_time;
        default: {
          // Balance cost and speed
          const aScore =
            a.stats.current_fee * 0.6 + a.stats.avg_confirmation_time * 0.4;
          const bScore =
            b.stats.current_fee * 0.6 + b.stats.avg_confirmation_time * 0.4;
          return aScore - bScore;
        }
      }
    });

    return sortedNetworks[0].network;
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// Export singleton instance
export const blockchainAnchor = new BlockchainAnchor();
