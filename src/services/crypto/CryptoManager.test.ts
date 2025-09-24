import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DeviceKey, KeyPair, CryptoSignature } from "../../types";

// Mock Tauri invoke function
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { TauriCryptoManager } from "./CryptoManager";
import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

describe("TauriCryptoManager", () => {
  let cryptoManager: TauriCryptoManager;

  beforeEach(() => {
    cryptoManager = new TauriCryptoManager();
    mockInvoke.mockClear();
  });

  describe("generateDeviceKey", () => {
    it("should generate a device key successfully", async () => {
      const mockDeviceKey: DeviceKey = {
        id: "test-device-key-123",
        publicKey: new ArrayBuffer(32),
        algorithm: "Ed25519",
        created: Date.now(),
        lastUsed: Date.now(),
        isHardwareBacked: true,
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          ...mockDeviceKey,
          publicKey: Array.from(new Uint8Array(mockDeviceKey.publicKey)),
        },
      });

      const result = await cryptoManager.generateDeviceKey();

      expect(mockInvoke).toHaveBeenCalledWith("generate_device_key");
      expect(result.id).toBe(mockDeviceKey.id);
      expect(result.algorithm).toBe("Ed25519");
      expect(result.isHardwareBacked).toBe(true);
    });

    it("should throw error when generation fails", async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: "Key generation failed",
      });

      await expect(cryptoManager.generateDeviceKey()).rejects.toThrow(
        "Key generation failed"
      );
    });
  });

  describe("generateKeyPair", () => {
    it("should generate a key pair successfully", async () => {
      const mockKeyPair: KeyPair = {
        publicKey: new ArrayBuffer(32),
        privateKey: new ArrayBuffer(64),
        algorithm: "Ed25519",
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          ...mockKeyPair,
          publicKey: Array.from(new Uint8Array(mockKeyPair.publicKey)),
          privateKey: Array.from(new Uint8Array(mockKeyPair.privateKey)),
        },
      });

      const result = await cryptoManager.generateKeyPair();

      expect(mockInvoke).toHaveBeenCalledWith("generate_keypair");
      expect(result.algorithm).toBe("Ed25519");
      expect(result.publicKey).toBeInstanceOf(ArrayBuffer);
      expect(result.privateKey).toBeInstanceOf(ArrayBuffer);
    });
  });

  describe("encrypt", () => {
    it("should encrypt data successfully", async () => {
      const testData = new TextEncoder().encode("Hello, World!").buffer;
      const keyId = "test-key-123";

      mockInvoke.mockResolvedValue({
        success: true,
        data: [
          {
            encryptedData: [1, 2, 3, 4, 5],
            iv: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
            keyId,
            algorithm: "AES-256-GCM",
          },
          keyId,
        ],
      });

      const result = await cryptoManager.encrypt(testData, keyId);

      expect(mockInvoke).toHaveBeenCalledWith("encrypt_data", {
        data: Array.from(new Uint8Array(testData)),
        keyId,
      });
      expect(result.keyId).toBe(keyId);
      expect(result.algorithm).toBe("AES-256-GCM");
      expect(result.encryptedData).toBeInstanceOf(ArrayBuffer);
      expect(result.iv).toBeInstanceOf(ArrayBuffer);
    });

    it("should throw error when encryption fails", async () => {
      const testData = new ArrayBuffer(10);
      const keyId = "test-key";

      mockInvoke.mockResolvedValue({
        success: false,
        error: "Encryption failed",
      });

      await expect(cryptoManager.encrypt(testData, keyId)).rejects.toThrow(
        "Encryption failed"
      );
    });
  });

  describe("decrypt", () => {
    it("should decrypt data successfully", async () => {
      const decryptionParams = {
        encryptedData: new Uint8Array([1, 2, 3, 4, 5]).buffer,
        iv: new Uint8Array([6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]).buffer,
        keyId: "test-key",
        algorithm: "AES-256-GCM",
      };

      const mockDecryptedData = [72, 101, 108, 108, 111]; // "Hello" in bytes

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockDecryptedData,
      });

      const result = await cryptoManager.decrypt(decryptionParams);

      expect(mockInvoke).toHaveBeenCalledWith("decrypt_data", {
        params: {
          encryptedData: Array.from(new Uint8Array(decryptionParams.encryptedData)),
          iv: Array.from(new Uint8Array(decryptionParams.iv)),
          keyId: decryptionParams.keyId,
          algorithm: decryptionParams.algorithm,
        },
      });
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(Array.from(new Uint8Array(result))).toEqual(mockDecryptedData);
    });
  });

  describe("sign", () => {
    it("should sign data successfully", async () => {
      const testData = new TextEncoder().encode("Test data").buffer;
      const keyId = "test-key";
      const mockKeyPair: KeyPair = {
        publicKey: new ArrayBuffer(32),
        privateKey: new ArrayBuffer(64),
        algorithm: "Ed25519",
      };

      // Store the key pair first
      cryptoManager.storeKeyPair(keyId, mockKeyPair);

      const mockSignature: CryptoSignature = {
        signature: new ArrayBuffer(64),
        algorithm: "Ed25519",
        keyId,
        timestamp: Date.now(),
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          ...mockSignature,
          signature: Array.from(new Uint8Array(mockSignature.signature)),
        },
      });

      const result = await cryptoManager.sign(testData, keyId);

      expect(mockInvoke).toHaveBeenCalledWith("sign_data", {
        data: Array.from(new Uint8Array(testData)),
        privateKey: Array.from(new Uint8Array(mockKeyPair.privateKey)),
        keyId,
      });
      expect(result.keyId).toBe(keyId);
      expect(result.algorithm).toBe("Ed25519");
      expect(result.signature).toBeInstanceOf(ArrayBuffer);
    });

    it("should throw error when private key not found", async () => {
      const testData = new ArrayBuffer(10);
      const keyId = "nonexistent-key";

      await expect(cryptoManager.sign(testData, keyId)).rejects.toThrow(
        "Private key not found for keyId: nonexistent-key"
      );
    });
  });

  describe("verify", () => {
    it("should verify signature successfully", async () => {
      const testData = new TextEncoder().encode("Test data").buffer;
      const keyId = "test-key";
      
      // Create mock device key
      const mockDeviceKey: DeviceKey = {
        id: keyId,
        publicKey: new ArrayBuffer(32),
        algorithm: "Ed25519",
        created: Date.now(),
        lastUsed: Date.now(),
        isHardwareBacked: true,
      };

      // Store device key
      cryptoManager["deviceKeys"].set(keyId, mockDeviceKey);

      const mockSignature: CryptoSignature = {
        signature: new ArrayBuffer(64),
        algorithm: "Ed25519",
        keyId,
        timestamp: Date.now(),
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: true,
      });

      const result = await cryptoManager.verify(testData, mockSignature);

      expect(mockInvoke).toHaveBeenCalledWith("verify_signature", {
        data: Array.from(new Uint8Array(testData)),
        signature: {
          signature: Array.from(new Uint8Array(mockSignature.signature)),
          algorithm: mockSignature.algorithm,
          keyId: mockSignature.keyId,
          timestamp: mockSignature.timestamp,
        },
        publicKey: Array.from(new Uint8Array(mockDeviceKey.publicKey)),
      });
      expect(result).toBe(true);
    });

    it("should throw error when public key not found", async () => {
      const testData = new ArrayBuffer(10);
      const mockSignature: CryptoSignature = {
        signature: new ArrayBuffer(64),
        algorithm: "Ed25519",
        keyId: "nonexistent-key",
        timestamp: Date.now(),
      };

      await expect(cryptoManager.verify(testData, mockSignature)).rejects.toThrow(
        "Public key not found for keyId: nonexistent-key"
      );
    });
  });

  describe("hash", () => {
    it("should hash data successfully", async () => {
      const testData = new TextEncoder().encode("Test data").buffer;
      const algorithm = "SHA-256";

      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          hash: "base64-encoded-hash",
          algorithm,
          timestamp: Date.now(),
        },
      });

      const result = await cryptoManager.hash(testData, algorithm);

      expect(mockInvoke).toHaveBeenCalledWith("hash_data", {
        data: Array.from(new Uint8Array(testData)),
        algorithm,
      });
      expect(result.hash).toBe("base64-encoded-hash");
      expect(result.algorithm).toBe(algorithm);
      expect(typeof result.timestamp).toBe("number");
    });
  });

  describe("keychain operations", () => {
    it("should store key in keychain successfully", async () => {
      const keyId = "test-key";
      const keyData = new Uint8Array([1, 2, 3, 4, 5]).buffer;

      mockInvoke.mockResolvedValue({
        success: true,
      });

      await cryptoManager.storeKeyInKeychain(keyId, keyData);

      expect(mockInvoke).toHaveBeenCalledWith("store_key_in_keychain", {
        keyId,
        keyData: Array.from(new Uint8Array(keyData)),
      });
    });

    it("should retrieve key from keychain successfully", async () => {
      const keyId = "test-key";
      const mockKeyData = [1, 2, 3, 4, 5];

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockKeyData,
      });

      const result = await cryptoManager.retrieveKeyFromKeychain(keyId);

      expect(mockInvoke).toHaveBeenCalledWith("retrieve_key_from_keychain", {
        keyId,
      });
      expect(result).toBeInstanceOf(ArrayBuffer);
      expect(Array.from(new Uint8Array(result))).toEqual(mockKeyData);
    });

    it("should delete key from keychain successfully", async () => {
      const keyId = "test-key";

      mockInvoke.mockResolvedValue({
        success: true,
      });

      await cryptoManager.deleteKeyFromKeychain(keyId);

      expect(mockInvoke).toHaveBeenCalledWith("delete_key_from_keychain", {
        keyId,
      });
    });
  });

  describe("rotateKeys", () => {
    it("should rotate keys successfully", async () => {
      const oldKeyId = "old-key";
      const newDeviceKey: DeviceKey = {
        id: "new-key",
        publicKey: new ArrayBuffer(32),
        algorithm: "Ed25519",
        created: Date.now(),
        lastUsed: Date.now(),
        isHardwareBacked: true,
      };

      // Store old keys
      cryptoManager["deviceKeys"].set(oldKeyId, {
        id: oldKeyId,
        publicKey: new ArrayBuffer(32),
        algorithm: "Ed25519",
        created: Date.now() - 1000,
        lastUsed: Date.now() - 1000,
        isHardwareBacked: true,
      });
      cryptoManager["keyPairs"].set(oldKeyId, {
        publicKey: new ArrayBuffer(32),
        privateKey: new ArrayBuffer(64),
        algorithm: "Ed25519",
      });

      mockInvoke.mockResolvedValue({
        success: true,
        data: {
          ...newDeviceKey,
          publicKey: Array.from(new Uint8Array(newDeviceKey.publicKey)),
        },
      });

      const result = await cryptoManager.rotateKeys(oldKeyId);

      expect(result.id).toBe(newDeviceKey.id);
      expect(cryptoManager["deviceKeys"].has(oldKeyId)).toBe(false);
      expect(cryptoManager["keyPairs"].has(oldKeyId)).toBe(false);
    });
  });

  describe("getKeyInfo", () => {
    it("should get key info successfully", async () => {
      const keyId = "test-key";
      const deviceKey: DeviceKey = {
        id: keyId,
        publicKey: new ArrayBuffer(32),
        algorithm: "Ed25519",
        created: Date.now(),
        lastUsed: Date.now(),
        isHardwareBacked: true,
      };

      const mockKeyInfo = {
        id: keyId,
        algorithm: "Ed25519",
        created: deviceKey.created,
        lastUsed: deviceKey.lastUsed,
        isHardwareBacked: true,
        status: "active" as const,
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockKeyInfo,
      });

      const result = await cryptoManager.getKeyInfo(keyId, deviceKey);

      expect(mockInvoke).toHaveBeenCalledWith("get_key_info", {
        keyId,
        deviceKey,
      });
      expect(result).toEqual(mockKeyInfo);
    });
  });

  describe("helper methods", () => {
    it("should store and retrieve key pairs", () => {
      const keyId = "test-key";
      const keyPair: KeyPair = {
        publicKey: new ArrayBuffer(32),
        privateKey: new ArrayBuffer(64),
        algorithm: "Ed25519",
      };

      cryptoManager.storeKeyPair(keyId, keyPair);
      expect(cryptoManager["keyPairs"].get(keyId)).toBe(keyPair);
    });

    it("should get device keys", () => {
      const deviceKey1: DeviceKey = {
        id: "key1",
        publicKey: new ArrayBuffer(32),
        algorithm: "Ed25519",
        created: Date.now(),
        lastUsed: Date.now(),
        isHardwareBacked: true,
      };

      const deviceKey2: DeviceKey = {
        id: "key2",
        publicKey: new ArrayBuffer(32),
        algorithm: "Ed25519",
        created: Date.now(),
        lastUsed: Date.now(),
        isHardwareBacked: false,
      };

      cryptoManager["deviceKeys"].set("key1", deviceKey1);
      cryptoManager["deviceKeys"].set("key2", deviceKey2);

      const keys = cryptoManager.getDeviceKeys();
      expect(keys).toHaveLength(2);
      expect(keys).toContain(deviceKey1);
      expect(keys).toContain(deviceKey2);
    });
  });
});