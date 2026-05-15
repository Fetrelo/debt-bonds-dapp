import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
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
 * Creates a brand-new debt bond in two steps wrapped in one transaction:
 *   1. Pre-funds the mint account (rent-exempt) via the System program.
 *   2. Calls the Anchor `create_bond` instruction which initialises the mint
 *      (decimals=0, authority = BondConfig PDA) and the BondConfig PDA.
 *
 * Bonds have `decimals = 0` (whole-bond units) by program invariant.
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

  const program = getProgram(connection, wallet);
  const mintKeypair = Keypair.generate();
  const [bondConfig] = findBondConfigPda(mintKeypair.publicKey);

  // Convert whole-percent → basis points (1% = 100bps).
  const interestRateBps = interestRatePct * 100;

  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    await program.methods
      .createBond(new BN(nominalValue), interestRateBps, durationYears)
      .accountsPartial({
        issuer: payer,
        bondMint: mintKeypair.publicKey,
        bondConfig,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction(),
  );

  const latestBlockhash = await connection.getLatestBlockhash();
  tx.recentBlockhash = latestBlockhash.blockhash;
  tx.feePayer = payer;

  const signature = await wallet.sendTransaction(tx, connection, {
    signers: [mintKeypair],
  });
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
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

  const signature = await wallet.sendTransaction(tx, connection);
  await connection.confirmTransaction(
    {
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    },
    "confirmed",
  );

  return { bondConfig, signature };
}

export { PROGRAM_ID };
