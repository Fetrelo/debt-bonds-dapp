import { readFileSync } from "node:fs";
import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export type SigningWallet = {
  publicKey: PublicKey;
  keypair: Keypair;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<T[]>;
};

export function loadKeypairWallet(path: string): SigningWallet {
  const raw = readFileSync(path, "utf8");
  const secret = Uint8Array.from(JSON.parse(raw) as number[]);
  const keypair = Keypair.fromSecretKey(secret);
  return keypairWallet(keypair);
}

export function keypairWallet(keypair: Keypair): SigningWallet {
  return {
    publicKey: keypair.publicKey,
    keypair,
    async signTransaction<T extends Transaction | VersionedTransaction>(
      tx: T,
    ): Promise<T> {
      if (tx instanceof Transaction) {
        tx.partialSign(keypair);
      } else {
        tx.sign([keypair]);
      }
      return tx;
    },
    async signAllTransactions<T extends Transaction | VersionedTransaction>(
      txs: T[],
    ): Promise<T[]> {
      return Promise.all(txs.map((tx) => keypairWallet(keypair).signTransaction(tx)));
    },
  };
}
