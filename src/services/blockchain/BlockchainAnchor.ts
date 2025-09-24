// Blockchain Anchor interface
import type {
  AnchorMetadata,
  AnchorResult,
  AnchorVerification,
  BlockchainNetwork,
  MerkleProof,
} from "../../types";

export interface BlockchainAnchor {
  anchorHash(hash: string, metadata: AnchorMetadata): Promise<AnchorResult>;
  verifyAnchor(anchorId: string): Promise<AnchorVerification>;
  generateMerkleProof(hash: string, anchorId: string): Promise<MerkleProof>;
  getSupportedNetworks(): BlockchainNetwork[];
  getNetworkStatus(network: BlockchainNetwork): Promise<NetworkStatus>;
}

export interface NetworkStatus {
  network: BlockchainNetwork;
  isOnline: boolean;
  blockHeight: number;
  avgConfirmationTime: number;
  currentGasPrice?: number;
  congestionLevel: "low" | "medium" | "high";
}
