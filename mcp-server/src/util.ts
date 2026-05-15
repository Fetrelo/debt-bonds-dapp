import { PublicKey } from "@solana/web3.js";

export function parsePubkey(value: string, field: string): PublicKey {
  try {
    return new PublicKey(value);
  } catch {
    throw new Error(`Invalid ${field}: must be a base58 public key.`);
  }
}

export function jsonText(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}
