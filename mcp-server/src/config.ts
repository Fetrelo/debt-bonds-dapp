import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./solana/idl.json" with { type: "json" };
import { loadKeypairWallet } from "./wallet.js";

const DEFAULT_RPC = "http://127.0.0.1:8899";

export function getRpcUrl(): string {
  return process.env.SOLANA_RPC_URL?.trim() || DEFAULT_RPC;
}

export function getProgramId(): PublicKey {
  const override = process.env.DEBT_BONDS_PROGRAM_ID?.trim();
  if (override) return new PublicKey(override);
  return new PublicKey((idl as { address: string }).address);
}

export function getConnection(): Connection {
  return new Connection(getRpcUrl(), "confirmed");
}

export function getSigningWalletOrThrow() {
  const path = process.env.SOLANA_KEYPAIR_PATH?.trim();
  if (!path) {
    throw new Error(
      "SOLANA_KEYPAIR_PATH is required for write operations. Set it to a Solana JSON keypair file.",
    );
  }
  return loadKeypairWallet(path);
}

export function getOptionalSigningWallet() {
  const path = process.env.SOLANA_KEYPAIR_PATH?.trim();
  if (!path) return null;
  return loadKeypairWallet(path);
}
