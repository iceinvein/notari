// Blockchain integration types
export type BlockchainNetwork = "arweave" | "ethereum" | "polygon";

export interface BlockchainAnchor {
  network: BlockchainNetwork;
  transactionId: string;
  blockNumber: number;
  timestamp: number;
  merkleRoot: string;
  cost: number;
  confirmations: number;
}

export interface AnchorMetadata {
  proofPackId: string;
  contentHash: string;
  timestamp: number;
  userAddress?: string;
}

export interface AnchorResult {
  transactionId: string;
  blockNumber: number;
  timestamp: number;
  networkId: string;
  cost: number;
  estimatedConfirmationTime: number;
}

export interface AnchorVerification {
  isValid: boolean;
  confirmations: number;
  blockTimestamp: number;
  networkStatus: "confirmed" | "pending" | "failed";
  verificationTime: number;
}

export interface MerkleNode {
  hash: string;
  isLeft: boolean;
}

export interface MerkleProof {
  root: string;
  leaf: string;
  path: MerkleNode[];
  index: number;
}

export interface TransactionStatus {
  id: string;
  status: "pending" | "confirmed" | "failed";
  confirmations: number;
  gasUsed?: number;
  gasPrice?: number;
  error?: string;
}
