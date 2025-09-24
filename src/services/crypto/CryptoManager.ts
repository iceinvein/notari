// Crypto Manager interface
import type {
  CryptoSignature,
  DecryptionParams,
  DeviceKey,
  EncryptionResult,
  HashResult,
  KeyPair,
} from "../../types";

export interface CryptoManager {
  generateDeviceKey(): Promise<DeviceKey>;
  generateKeyPair(): Promise<KeyPair>;
  encrypt(data: ArrayBuffer, keyId: string): Promise<EncryptionResult>;
  decrypt(params: DecryptionParams): Promise<ArrayBuffer>;
  sign(data: ArrayBuffer, keyId: string): Promise<CryptoSignature>;
  verify(data: ArrayBuffer, signature: CryptoSignature): Promise<boolean>;
  hash(data: ArrayBuffer, algorithm?: string): Promise<HashResult>;
  rotateKeys(oldKeyId: string): Promise<DeviceKey>;
  getKeyInfo(keyId: string): Promise<KeyInfo>;
}

export interface KeyInfo {
  id: string;
  algorithm: string;
  created: number;
  lastUsed: number;
  isHardwareBacked: boolean;
  status: "active" | "revoked" | "expired";
}
