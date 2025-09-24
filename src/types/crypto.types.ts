// Cryptographic types
export interface DeviceKey {
  id: string;
  publicKey: ArrayBuffer;
  algorithm: string;
  created: number;
  lastUsed: number;
  isHardwareBacked: boolean;
}

export interface CryptoSignature {
  signature: ArrayBuffer;
  algorithm: string;
  keyId: string;
  timestamp: number;
}

export interface EncryptionResult {
  encryptedData: ArrayBuffer;
  iv: ArrayBuffer;
  keyId: string;
  algorithm: string;
}

export interface DecryptionParams {
  encryptedData: ArrayBuffer;
  iv: ArrayBuffer;
  keyId: string;
  algorithm: string;
}

export interface HashResult {
  hash: string;
  algorithm: string;
  timestamp: number;
}

export interface KeyPair {
  publicKey: ArrayBuffer;
  privateKey: ArrayBuffer;
  algorithm: string;
}
