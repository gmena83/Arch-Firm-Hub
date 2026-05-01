import { randomInt } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Generates a cryptographically secure random string of a given length
 * using the base36 alphabet (0-9, a-z).
 *
 * This replaces the insecure Math.random().toString(36).slice(2, ...) pattern.
 */
export function generateSecureSlug(length: number = 5): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return result;
}
