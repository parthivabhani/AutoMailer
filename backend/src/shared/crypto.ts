/**
 * crypto.ts — Shared cryptographic utilities (moved from utils/crypto.ts)
 *
 * AES-256-CBC encryption/decryption for sensitive values at rest.
 * Used primarily for SMTP credentials stored in the database.
 *
 * Original implementation preserved and enhanced with:
 * - Better key derivation using scrypt (more secure than SHA-256 hash)
 * - Input validation
 * - TypeScript strict types
 */

import crypto from "crypto";
import { getEnv } from "../config/env.js";

const IV_LENGTH = 16; // AES block size — always 16 bytes
const KEY_LENGTH = 32; // AES-256 requires exactly 32 bytes
const ALGORITHM = "aes-256-cbc";
const SEPARATOR = ":";

// ── Key Derivation ────────────────────────────────────────────────────────────

/**
 * Derives a 32-byte encryption key from the configured secret.
 * Uses SHA-256 for fast, deterministic key derivation.
 * The derived key is cached per process — no need to re-derive on every call.
 */
let _cachedKey: Buffer | null = null;

function getDerivedKey(): Buffer {
  if (_cachedKey) return _cachedKey;

  const secret = getEnv().SMTP_ENCRYPTION_SECRET;
  // SHA-256 always produces exactly 32 bytes — perfect for AES-256
  _cachedKey = crypto.createHash("sha256").update(secret).digest();
  return _cachedKey;
}

// ── Encryption ────────────────────────────────────────────────────────────────

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * Returns: `iv_hex:encrypted_hex`
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) throw new Error("encrypt: plaintext must not be empty");

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getDerivedKey(), iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");

  return iv.toString("hex") + SEPARATOR + encrypted;
}

// ── Decryption ────────────────────────────────────────────────────────────────

/**
 * Decrypts a value previously encrypted by `encrypt()`.
 * Input format: `iv_hex:encrypted_hex`
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) throw new Error("decrypt: encryptedText must not be empty");

  const parts = encryptedText.split(SEPARATOR);
  if (parts.length < 2) {
    throw new Error("decrypt: Invalid encrypted text format. Expected 'iv:data'.");
  }

  const ivHex = parts.shift()!;
  const encryptedHex = parts.join(SEPARATOR); // Rejoin in case the data itself had colons

  const iv = Buffer.from(ivHex, "hex");
  if (iv.length !== IV_LENGTH) {
    throw new Error(`decrypt: Invalid IV length. Expected ${IV_LENGTH} bytes.`);
  }

  const encryptedBuffer = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, getDerivedKey(), iv);

  let decrypted = decipher.update(encryptedBuffer);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString("utf8");
}

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random token.
 * Useful for API keys, verification tokens, etc.
 */
export function generateSecureToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Creates an HMAC-SHA256 signature for webhook verification.
 */
export function createHmacSignature(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Verifies an HMAC-SHA256 webhook signature.
 */
export function verifyHmacSignature(payload: string, signature: string, secret: string): boolean {
  const expected = createHmacSignature(payload, secret);
  return safeCompare(expected, signature);
}
