use crate::blockchain::types::{BlockchainError, BlockchainResult, MerkleNode, MerkleProof};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;

#[derive(Debug, Clone)]
pub struct MerkleTree {
    pub leaves: Vec<String>,
    tree: Vec<Vec<String>>,
    root: String,
}

impl MerkleTree {
    /// Create a new Merkle tree from a list of data items
    pub fn new(data: Vec<&str>) -> BlockchainResult<Self> {
        if data.is_empty() {
            return Err(BlockchainError::MerkleTreeError(
                "Cannot create Merkle tree from empty data".to_string(),
            ));
        }

        let leaves: Vec<String> = data.iter().map(|d| Self::hash_data(d)).collect();
        let tree = Self::build_tree(&leaves)?;
        let root = tree.last()
            .and_then(|level| level.first())
            .ok_or_else(|| BlockchainError::MerkleTreeError("Failed to get root".to_string()))?
            .clone();

        Ok(Self { leaves, tree, root })
    }

    /// Get the root hash of the Merkle tree
    pub fn root(&self) -> &str {
        &self.root
    }

    /// Generate a Merkle proof for a specific leaf
    pub fn generate_proof(&self, leaf_index: usize) -> BlockchainResult<MerkleProof> {
        if leaf_index >= self.leaves.len() {
            return Err(BlockchainError::MerkleTreeError(
                "Leaf index out of bounds".to_string(),
            ));
        }

        let leaf = &self.leaves[leaf_index];
        let mut path = Vec::new();
        let mut current_index = leaf_index;

        // Traverse from leaf to root, collecting sibling hashes
        for level in 0..self.tree.len() - 1 {
            let sibling_index = if current_index % 2 == 0 {
                current_index + 1
            } else {
                current_index - 1
            };

            if sibling_index < self.tree[level].len() {
                let sibling_hash = &self.tree[level][sibling_index];
                let is_left = current_index % 2 == 1;
                
                path.push(MerkleNode {
                    hash: sibling_hash.clone(),
                    is_left,
                });
            }

            current_index /= 2;
        }

        Ok(MerkleProof {
            root: self.root.clone(),
            leaf: leaf.clone(),
            path,
            index: leaf_index as u64,
        })
    }

    /// Verify a Merkle proof
    pub fn verify_proof(proof: &MerkleProof) -> BlockchainResult<bool> {
        let mut current_hash = proof.leaf.clone();

        for node in &proof.path {
            current_hash = if node.is_left {
                Self::hash_pair(&node.hash, &current_hash)
            } else {
                Self::hash_pair(&current_hash, &node.hash)
            };
        }

        Ok(current_hash == proof.root)
    }

    /// Build the complete Merkle tree from leaves
    fn build_tree(leaves: &[String]) -> BlockchainResult<Vec<Vec<String>>> {
        let mut tree = vec![leaves.to_vec()];
        let mut current_level = leaves.to_vec();

        while current_level.len() > 1 {
            let mut next_level = Vec::new();
            
            for chunk in current_level.chunks(2) {
                let hash = if chunk.len() == 2 {
                    Self::hash_pair(&chunk[0], &chunk[1])
                } else {
                    // Odd number of nodes, duplicate the last one
                    Self::hash_pair(&chunk[0], &chunk[0])
                };
                next_level.push(hash);
            }

            tree.push(next_level.clone());
            current_level = next_level;
        }

        Ok(tree)
    }

    /// Hash a single piece of data
    pub fn hash_data(data: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(data.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Hash a pair of hashes together
    fn hash_pair(left: &str, right: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(left.as_bytes());
        hasher.update(right.as_bytes());
        hex::encode(hasher.finalize())
    }
}

/// Utility function to create a Merkle tree from proof pack hashes
pub fn create_proof_pack_tree(proof_pack_hashes: Vec<&str>) -> BlockchainResult<MerkleTree> {
    MerkleTree::new(proof_pack_hashes)
}

/// Utility function to verify a proof pack is included in a Merkle tree
pub fn verify_proof_pack_inclusion(
    proof_pack_hash: &str,
    merkle_proof: &MerkleProof,
) -> BlockchainResult<bool> {
    if merkle_proof.leaf != MerkleTree::hash_data(proof_pack_hash) {
        return Ok(false);
    }

    MerkleTree::verify_proof(merkle_proof)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_merkle_tree_creation() {
        let data = vec!["data1", "data2", "data3", "data4"];
        let tree = MerkleTree::new(data).unwrap();
        assert!(!tree.root().is_empty());
    }

    #[test]
    fn test_merkle_proof_generation_and_verification() {
        let data = vec!["data1", "data2", "data3", "data4"];
        let tree = MerkleTree::new(data).unwrap();
        
        let proof = tree.generate_proof(0).unwrap();
        assert!(MerkleTree::verify_proof(&proof).unwrap());
        
        let proof = tree.generate_proof(2).unwrap();
        assert!(MerkleTree::verify_proof(&proof).unwrap());
    }

    #[test]
    fn test_merkle_tree_odd_number_of_leaves() {
        let data = vec!["data1", "data2", "data3"];
        let tree = MerkleTree::new(data).unwrap();
        
        let proof = tree.generate_proof(1).unwrap();
        assert!(MerkleTree::verify_proof(&proof).unwrap());
    }

    #[test]
    fn test_merkle_tree_single_leaf() {
        let data = vec!["single_data"];
        let tree = MerkleTree::new(data).unwrap();
        
        let proof = tree.generate_proof(0).unwrap();
        assert!(MerkleTree::verify_proof(&proof).unwrap());
    }

    #[test]
    fn test_invalid_proof_verification() {
        let data = vec!["data1", "data2", "data3", "data4"];
        let tree = MerkleTree::new(data).unwrap();
        
        let mut proof = tree.generate_proof(0).unwrap();
        proof.leaf = "invalid_hash".to_string();
        
        assert!(!MerkleTree::verify_proof(&proof).unwrap());
    }
}