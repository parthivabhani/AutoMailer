import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const ENCRYPTION_KEY =
  process.env.SMTP_ENCRYPTION_SECRET || "default_encryption_secret_must_be_32_bytes_long!!"; // Must be 32 bytes
const IV_LENGTH = 16; // For AES, this is always 16 bytes

// Helper to ensure key is exactly 32 bytes
const getSecureKey = (): Buffer => {
  if (ENCRYPTION_KEY.length < 32) {
    // Pad or hash to ensure 32 bytes if not long enough
    return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
  }
  return Buffer.from(ENCRYPTION_KEY.slice(0, 32));
};

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", getSecureKey(), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  const textParts = text.split(":");
  const ivPart = textParts.shift();
  if (!ivPart) throw new Error("Invalid encrypted text format");
  const iv = Buffer.from(ivPart, "hex");
  const encryptedText = Buffer.from(textParts.join(":"), "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", getSecureKey(), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf8");
}
