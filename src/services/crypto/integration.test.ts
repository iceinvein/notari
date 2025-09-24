import { beforeEach, describe, expect, it, vi } from "vitest";
import { cryptoManager } from "./CryptoManager";

// Mock Tauri invoke function for integration tests
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = vi.mocked(invoke);

describe("CryptoManager Integration Tests", () => {
  beforeEach(() => {
    mockInvoke.mockClear();
  });
  it("should perform a complete encryption/decryption workflow", async () => {
    // Mock device key generation
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: {
          id: "device-key-123",
          publicKey: Array.from(new Uint8Array(32).fill(1)),
          algorithm: "Ed25519",
          created: Date.now(),
          lastUsed: Date.now(),
          isHardwareBacked: true,
        },
      }),
    );

    // Mock encryption
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: [
          {
            encryptedData: Array.from(new Uint8Array([1, 2, 3, 4, 5])),
            iv: Array.from(new Uint8Array(12).fill(2)),
            keyId: "device-key-123",
            algorithm: "AES-256-GCM",
          },
          "device-key-123",
        ],
      }),
    );

    // Mock decryption
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: Array.from(new TextEncoder().encode("Hello, World!")),
      }),
    );

    // Generate device key
    const deviceKey = await cryptoManager.generateDeviceKey();
    expect(deviceKey.id).toBe("device-key-123");

    // Encrypt data
    const testData = new TextEncoder().encode("Hello, World!").buffer;
    const encryptionResult = await cryptoManager.encrypt(
      testData,
      deviceKey.id,
    );
    expect(encryptionResult.keyId).toBe(deviceKey.id);
    expect(encryptionResult.algorithm).toBe("AES-256-GCM");

    // Decrypt data
    const decryptionParams = {
      encryptedData: encryptionResult.encryptedData,
      iv: encryptionResult.iv,
      keyId: encryptionResult.keyId,
      algorithm: encryptionResult.algorithm,
    };

    const decryptedData = await cryptoManager.decrypt(decryptionParams);
    const decryptedText = new TextDecoder().decode(decryptedData);
    expect(decryptedText).toBe("Hello, World!");
  });

  it("should perform a complete signing/verification workflow", async () => {
    // Mock key pair generation
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: {
          publicKey: Array.from(new Uint8Array(32).fill(3)),
          privateKey: Array.from(new Uint8Array(64).fill(4)),
          algorithm: "Ed25519",
        },
      }),
    );

    // Mock device key generation
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: {
          id: "signing-key-456",
          publicKey: Array.from(new Uint8Array(32).fill(3)),
          algorithm: "Ed25519",
          created: Date.now(),
          lastUsed: Date.now(),
          isHardwareBacked: true,
        },
      }),
    );

    // Mock signing
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: {
          signature: Array.from(new Uint8Array(64).fill(5)),
          algorithm: "Ed25519",
          keyId: "signing-key-456",
          timestamp: Date.now(),
        },
      }),
    );

    // Mock verification
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: true,
      }),
    );

    // Generate key pair and device key
    const keyPair = await cryptoManager.generateKeyPair();
    const deviceKey = await cryptoManager.generateDeviceKey();

    // Store the key pair for signing
    cryptoManager.storeKeyPair(deviceKey.id, keyPair);

    // Sign data
    const testData = new TextEncoder().encode("Test message").buffer;
    const signature = await cryptoManager.sign(testData, deviceKey.id);
    expect(signature.keyId).toBe(deviceKey.id);
    expect(signature.algorithm).toBe("Ed25519");

    // Verify signature
    const isValid = await cryptoManager.verify(testData, signature);
    expect(isValid).toBe(true);
  });

  it("should handle keychain operations workflow", async () => {
    const keyId = "keychain-test-key";
    const testKeyData = new Uint8Array([10, 20, 30, 40, 50]).buffer;

    // Mock store operation
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
      }),
    );

    // Mock retrieve operation
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
        data: Array.from(new Uint8Array(testKeyData)),
      }),
    );

    // Mock delete operation
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: true,
      }),
    );

    // Store key in keychain
    await cryptoManager.storeKeyInKeychain(keyId, testKeyData);

    // Retrieve key from keychain
    const retrievedData = await cryptoManager.retrieveKeyFromKeychain(keyId);
    expect(Array.from(new Uint8Array(retrievedData))).toEqual(
      Array.from(new Uint8Array(testKeyData)),
    );

    // Delete key from keychain
    await cryptoManager.deleteKeyFromKeychain(keyId);

    expect(mockInvoke).toHaveBeenCalledTimes(3);
  });

  it("should handle error scenarios gracefully", async () => {
    // Mock failed device key generation
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: false,
        error: "Hardware security module not available",
      }),
    );

    await expect(cryptoManager.generateDeviceKey()).rejects.toThrow(
      "Hardware security module not available",
    );

    // Mock failed encryption
    mockInvoke.mockImplementationOnce(() =>
      Promise.resolve({
        success: false,
        error: "Encryption key not found",
      }),
    );

    const testData = new ArrayBuffer(10);
    await expect(
      cryptoManager.encrypt(testData, "invalid-key"),
    ).rejects.toThrow("Encryption key not found");
  });
});
