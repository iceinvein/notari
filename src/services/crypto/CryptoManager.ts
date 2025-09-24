import { invoke } from "@tauri-apps/api/core";
import type {
  CryptoSignature,
  DecryptionParams,
  DeviceKey,
  EncryptionResult,
  HashResult,
  KeyPair,
} from "../../types";

export interface KeyInfo {
  id: string;
  algorithm: string;
  created: number;
  lastUsed: number;
  isHardwareBacked: boolean;
  status: "active" | "revoked" | "expired";
}

interface CryptoResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CryptoManager {
  generateDeviceKey(): Promise<DeviceKey>;
  generateKeyPair(): Promise<KeyPair>;
  encrypt(data: ArrayBuffer, keyId: string): Promise<EncryptionResult>;
  decrypt(params: DecryptionParams): Promise<ArrayBuffer>;
  sign(data: ArrayBuffer, keyId: string): Promise<CryptoSignature>;
  verify(data: ArrayBuffer, signature: CryptoSignature): Promise<boolean>;
  hash(data: ArrayBuffer, algorithm?: string): Promise<HashResult>;
  rotateKeys(oldKeyId: string): Promise<DeviceKey>;
  getKeyInfo(keyId: string, deviceKey: DeviceKey): Promise<KeyInfo>;
  storeKeyInKeychain(keyId: string, keyData: ArrayBuffer): Promise<void>;
  retrieveKeyFromKeychain(keyId: string): Promise<ArrayBuffer>;
  deleteKeyFromKeychain(keyId: string): Promise<void>;
}

export class TauriCryptoManager implements CryptoManager {
  private deviceKeys = new Map<string, DeviceKey>();
  private keyPairs = new Map<string, KeyPair>();

  async generateDeviceKey(): Promise<DeviceKey> {
    const response: CryptoResponse<DeviceKey> = await invoke(
      "generate_device_key",
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to generate device key");
    }

    const deviceKey = response.data;
    this.deviceKeys.set(deviceKey.id, deviceKey);
    return deviceKey;
  }

  async generateKeyPair(): Promise<KeyPair> {
    const response: CryptoResponse<KeyPair> = await invoke("generate_keypair");

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to generate key pair");
    }

    const keyPair = response.data;

    // Convert Vec<u8> back to ArrayBuffer for TypeScript interface
    return {
      ...keyPair,
      publicKey: new Uint8Array(keyPair.publicKey as unknown as number[])
        .buffer,
      privateKey: new Uint8Array(keyPair.privateKey as unknown as number[])
        .buffer,
    };
  }

  async encrypt(data: ArrayBuffer, keyId: string): Promise<EncryptionResult> {
    const dataArray = Array.from(new Uint8Array(data));
    const response: CryptoResponse<[EncryptionResult, string]> = await invoke(
      "encrypt_data",
      {
        data: dataArray,
        keyId,
      },
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to encrypt data");
    }

    const [encryptionResult] = response.data;

    // Convert Vec<u8> back to ArrayBuffer for TypeScript interface
    return {
      ...encryptionResult,
      encryptedData: new Uint8Array(encryptionResult.encryptedData).buffer,
      iv: new Uint8Array(encryptionResult.iv).buffer,
    };
  }

  async decrypt(params: DecryptionParams): Promise<ArrayBuffer> {
    // Convert ArrayBuffer to Vec<u8> for Rust
    const rustParams = {
      encryptedData: Array.from(new Uint8Array(params.encryptedData)),
      iv: Array.from(new Uint8Array(params.iv)),
      keyId: params.keyId,
      algorithm: params.algorithm,
    };

    const response: CryptoResponse<number[]> = await invoke("decrypt_data", {
      params: rustParams,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to decrypt data");
    }

    return new Uint8Array(response.data).buffer;
  }

  async sign(data: ArrayBuffer, keyId: string): Promise<CryptoSignature> {
    // Get the private key for this keyId (in production, this would be retrieved securely)
    const keyPair = this.keyPairs.get(keyId);
    if (!keyPair) {
      throw new Error(`Private key not found for keyId: ${keyId}`);
    }

    const dataArray = Array.from(new Uint8Array(data));
    const privateKeyArray = Array.from(new Uint8Array(keyPair.privateKey));

    const response: CryptoResponse<CryptoSignature> = await invoke(
      "sign_data",
      {
        data: dataArray,
        privateKey: privateKeyArray,
        keyId,
      },
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to sign data");
    }

    const signature = response.data;

    // Convert Vec<u8> back to ArrayBuffer
    return {
      ...signature,
      signature: new Uint8Array(signature.signature).buffer,
    };
  }

  async verify(
    data: ArrayBuffer,
    signature: CryptoSignature,
  ): Promise<boolean> {
    // Get the public key for this signature's keyId
    const deviceKey = this.deviceKeys.get(signature.keyId);
    if (!deviceKey) {
      throw new Error(`Public key not found for keyId: ${signature.keyId}`);
    }

    const dataArray = Array.from(new Uint8Array(data));
    const signatureArray = Array.from(new Uint8Array(signature.signature));
    const publicKeyArray = Array.from(new Uint8Array(deviceKey.publicKey));

    // Convert signature for Rust
    const rustSignature = {
      signature: signatureArray,
      algorithm: signature.algorithm,
      keyId: signature.keyId,
      timestamp: signature.timestamp,
    };

    const response: CryptoResponse<boolean> = await invoke("verify_signature", {
      data: dataArray,
      signature: rustSignature,
      publicKey: publicKeyArray,
    });

    if (!response.success) {
      throw new Error(response.error || "Failed to verify signature");
    }

    return response.data || false;
  }

  async hash(data: ArrayBuffer, algorithm?: string): Promise<HashResult> {
    const dataArray = Array.from(new Uint8Array(data));

    const response: CryptoResponse<HashResult> = await invoke("hash_data", {
      data: dataArray,
      algorithm,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to hash data");
    }

    return response.data;
  }

  async rotateKeys(oldKeyId: string): Promise<DeviceKey> {
    // Generate a new device key
    const newDeviceKey = await this.generateDeviceKey();

    // In production, this would:
    // 1. Migrate encrypted data from old key to new key
    // 2. Update key references in the database
    // 3. Revoke the old key
    // 4. Store the new key securely

    // For now, just remove the old key from memory
    this.deviceKeys.delete(oldKeyId);
    this.keyPairs.delete(oldKeyId);

    return newDeviceKey;
  }

  async getKeyInfo(keyId: string, deviceKey: DeviceKey): Promise<KeyInfo> {
    const response: CryptoResponse<KeyInfo> = await invoke("get_key_info", {
      keyId,
      deviceKey,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to get key info");
    }

    return response.data;
  }

  async storeKeyInKeychain(keyId: string, keyData: ArrayBuffer): Promise<void> {
    const keyDataArray = Array.from(new Uint8Array(keyData));

    const response: CryptoResponse<void> = await invoke(
      "store_key_in_keychain",
      {
        keyId,
        keyData: keyDataArray,
      },
    );

    if (!response.success) {
      throw new Error(response.error || "Failed to store key in keychain");
    }
  }

  async retrieveKeyFromKeychain(keyId: string): Promise<ArrayBuffer> {
    const response: CryptoResponse<number[]> = await invoke(
      "retrieve_key_from_keychain",
      {
        keyId,
      },
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || "Failed to retrieve key from keychain");
    }

    return new Uint8Array(response.data).buffer;
  }

  async deleteKeyFromKeychain(keyId: string): Promise<void> {
    const response: CryptoResponse<void> = await invoke(
      "delete_key_from_keychain",
      {
        keyId,
      },
    );

    if (!response.success) {
      throw new Error(response.error || "Failed to delete key from keychain");
    }
  }

  // Helper method to store a key pair for later use
  storeKeyPair(keyId: string, keyPair: KeyPair): void {
    this.keyPairs.set(keyId, keyPair);
  }

  // Helper method to get available device keys
  getDeviceKeys(): DeviceKey[] {
    return Array.from(this.deviceKeys.values());
  }
}

// Export a singleton instance
export const cryptoManager = new TauriCryptoManager();
