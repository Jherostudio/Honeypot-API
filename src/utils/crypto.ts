/**
 * Cryptographic Utilities: HMAC-SHA256 Signature Generation
 *
 * SECURITY PURPOSE:
 * - Prevents tampering with log files (anti-forensics protection)
 * - If attacker gains server access, they cannot modify logs without detection
 * - HMAC proves log authenticity and integrity
 */

import crypto from "crypto";

/**
 * Generates HMAC-SHA256 signature for a log entry
 * 
 * @param logData - Object containing attack and analysis data
 * @param secret - HMAC secret key from environment
 * @returns Hexadecimal HMAC signature
 * 
 * SECURITY: The signature is deterministic - same input always produces same output
 */
export function generateHmac(
  logData: Record<string, unknown>,
  secret: string
): string {
  // Serialize consistently to ensure reproducibility
  const jsonString = JSON.stringify(logData, Object.keys(logData).sort());

  // Generate HMAC-SHA256 signature using the secret key
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(jsonString)
    .digest("hex");

  return hmac;
}

/**
 * Verifies integrity of a log entry by comparing HMACs
 * 
 * @param logData - Original log data
 * @param storedHmac - HMAC stored with the log
 * @param secret - HMAC secret key
 * @returns true if HMAC matches (log is authentic)
 * 
 * USAGE: Run periodically to detect if logs have been tampered with
 */
export function verifyHmac(
  logData: Record<string, unknown>,
  storedHmac: string,
  secret: string
): boolean {
  const calculatedHmac = generateHmac(logData, secret);
  // Constant-time comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(calculatedHmac),
    Buffer.from(storedHmac)
  );
}

/**
 * Sanitizes sensitive strings to prevent accidental information leaks
 * Used only for display/analysis - original payload is always preserved
 */
export function sanitizeForDisplay(input: string, maxLength: number = 500): string {
  return input.length > maxLength ? input.substring(0, maxLength) + "..." : input;
}
