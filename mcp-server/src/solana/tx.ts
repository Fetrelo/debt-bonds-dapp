import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
} from "@solana/web3.js";
import type { SigningWallet } from "../wallet.js";

export async function sendWithSimulation(
  connection: Connection,
  wallet: SigningWallet,
  tx: Transaction,
  extraSigners: Keypair[],
  latestBlockhash?: { blockhash: string; lastValidBlockHeight: number },
): Promise<TransactionSignature> {
  const blockhash =
    latestBlockhash ?? (await connection.getLatestBlockhash("confirmed"));
  tx.recentBlockhash = blockhash.blockhash;
  tx.feePayer = wallet.publicKey;

  for (const signer of extraSigners) {
    tx.partialSign(signer);
  }
  const signedTx = await wallet.signTransaction(tx);

  const sim = await connection.simulateTransaction(signedTx);
  if (sim.value.err) {
    const logs = sim.value.logs?.join("\n") ?? "(no program logs)";
    throw new Error(
      `On-chain simulation failed: ${JSON.stringify(sim.value.err)}\n\n${logs}`,
    );
  }

  const signature = await connection.sendRawTransaction(signedTx.serialize(), {
    skipPreflight: true,
  });
  await connection.confirmTransaction(
    {
      signature,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    },
    "confirmed",
  );
  return signature;
}

export async function sendAndConfirmInstructions(
  connection: Connection,
  wallet: SigningWallet,
  instructions: TransactionInstruction[],
  extraSigners: Keypair[] = [],
): Promise<TransactionSignature> {
  const tx = new Transaction().add(...instructions);
  const latestBlockhash = await connection.getLatestBlockhash("confirmed");
  return sendWithSimulation(connection, wallet, tx, extraSigners, latestBlockhash);
}
