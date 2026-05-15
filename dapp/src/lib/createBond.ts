import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  PROGRAM_ID,
  findBondConfigPda,
  getProgram,
} from "@/lib/program/client";

export type CreateBondParams = {
  /** Whole abstract units (e.g. 1000 means $1000-equivalent). */
  nominalValue: number;
  /** Whole percent, e.g. 5 = 5%. Converted to basis points on-chain. */
  interestRatePct: number;
  /** Whole years. */
  durationYears: number;
};

export type CreateBondResult = {
  mint: PublicKey;
  bondConfig: PublicKey;
  signature: TransactionSignature;
};

/**
 * Creates a brand-new bond. The program allocates the mint keypair as an SPL
 * mint (one `InitializeMint2` CPI) — we avoid Anchor `init` + `mint::*` on the
 * mint because it can double-invoke `InitializeMint2` when mint authority is
 * `bond_config`.
 */
export async function createBondToken(
  connection: Connection,
  wallet: WalletContextState,
  { nominalValue, interestRatePct, durationYears }: CreateBondParams,
): Promise<CreateBondResult> {
  const payer = wallet.publicKey;
  if (!payer || !wallet.sendTransaction) {
    throw new Error("Wallet is not connected.");
  }
  if (!Number.isInteger(nominalValue) || nominalValue <= 0) {
    throw new Error("Nominal value must be a positive whole number.");
  }
  if (
    !Number.isInteger(interestRatePct) ||
    interestRatePct <= 0 ||
    interestRatePct > 655
  ) {
    throw new Error("Interest rate must be a whole percent between 1 and 655.");
  }
  if (
    !Number.isInteger(durationYears) ||
    durationYears <= 0 ||
    durationYears > 255
  ) {
    throw new Error("Duration must be a whole number of years (1–255).");
  }

  // Pre-flight: make sure the program is actually deployed at our ID, so
  // we can surface a clear error instead of Phantom's opaque "Unexpected
  // error" if the user forgot to run `anchor deploy`.
  const programAccount = await connection.getAccountInfo(PROGRAM_ID);
  if (!programAccount || !programAccount.executable) {
    throw new Error(
      `Debt-bonds program is not deployed at ${PROGRAM_ID.toBase58()} on this cluster. Run \`anchor deploy\` first.`,
    );
  }

  const program = getProgram(connection, wallet);
  const mintKeypair = Keypair.generate();
  const [bondConfig] = findBondConfigPda(mintKeypair.publicKey);

  const interestRateBps = interestRatePct * 100;

  const ix = await program.methods
    .createBond(new BN(nominalValue), interestRateBps, durationYears)
    .accountsPartial({
      issuer: payer,
      bondMint: mintKeypair.publicKey,
      bondConfig,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.feePayer = payer;

  // The mint keypair must sign because it's the account being created by
  // the System CPI inside `init`.
  const signature = await sendWithSimulation(
    connection,
    wallet,
    tx,
    [mintKeypair],
    latestBlockhash,
  );

  return { mint: mintKeypair.publicKey, bondConfig, signature };
}

/**
 * Migrates a legacy bond mint (issuer-controlled) onto the on-chain
 * registry. The current mint authority is reassigned to the BondConfig
 * PDA inside the `register_bond` instruction.
 */
export async function registerExistingBond(
  connection: Connection,
  wallet: WalletContextState,
  params: CreateBondParams & { mint: PublicKey },
): Promise<{ bondConfig: PublicKey; signature: TransactionSignature }> {
  const payer = wallet.publicKey;
  if (!payer || !wallet.sendTransaction) {
    throw new Error("Wallet is not connected.");
  }

  const program = getProgram(connection, wallet);
  const [bondConfig] = findBondConfigPda(params.mint);
  const interestRateBps = params.interestRatePct * 100;

  const ix = await program.methods
    .registerBond(
      new BN(params.nominalValue),
      interestRateBps,
      params.durationYears,
    )
    .accountsPartial({
      issuer: payer,
      bondMint: params.mint,
      bondConfig,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();

  const tx = new Transaction().add(ix);
  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.feePayer = payer;

  const signature = await sendWithSimulation(
    connection,
    wallet,
    tx,
    [],
    latestBlockhash,
  );

  return { bondConfig, signature };
}

/**
 * Signs and sends a transaction, but first runs it through
 * `simulateTransaction` so any on-chain failure surfaces with its full
 * log output instead of being swallowed by the wallet adapter's generic
 * "Unexpected error".
 */
async function sendWithSimulation(
  connection: Connection,
  wallet: WalletContextState,
  tx: Transaction,
  extraSigners: { publicKey: PublicKey; secretKey: Uint8Array }[],
  latestBlockhash: { blockhash: string; lastValidBlockHeight: number },
): Promise<TransactionSignature> {
  if (!wallet.signTransaction || !wallet.publicKey) {
    throw new Error("Wallet cannot sign transactions.");
  }

  // The mint keypair (or any extra ephemeral signers) must sign before the
  // wallet, otherwise the wallet would refuse to add additional signatures.
  for (const signer of extraSigners) {
    tx.partialSign(signer as never);
  }
  const signedTx = await wallet.signTransaction(tx);

  const sim = await connection.simulateTransaction(signedTx);
  if (sim.value.err) {
    const logs = sim.value.logs?.join("\n") ?? "(no program logs)";
    throw new Error(
      `On-chain simulation failed: ${JSON.stringify(sim.value.err)}\n\n${logs}`,
    );
  }

  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );
  return signature;
}

export { PROGRAM_ID };
