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
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { WalletContextState } from "@solana/wallet-adapter-react";

export type CreateTokenParams = {
  decimals: number;
  initialSupply: number;
};

export type CreateTokenResult = {
  mint: PublicKey;
  signature: TransactionSignature;
};

export async function createSplToken(
  connection: Connection,
  wallet: WalletContextState,
  { decimals, initialSupply }: CreateTokenParams,
): Promise<CreateTokenResult> {
  const payer = wallet.publicKey;
  if (!payer || !wallet.sendTransaction) {
    throw new Error("Wallet is not connected.");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error("Decimals must be an integer between 0 and 9.");
  }
  if (!(initialSupply > 0)) {
    throw new Error("Initial supply must be greater than 0.");
  }

  const mintKeypair = Keypair.generate();
  const ata = getAssociatedTokenAddressSync(mintKeypair.publicKey, payer);

  const lamports = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  const rawAmount =
    BigInt(Math.round(initialSupply * 10 ** Math.min(decimals, 6))) *
    BigInt(10) ** BigInt(Math.max(0, decimals - 6));

  const transaction = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintKeypair.publicKey,
      space: MINT_SIZE,
      lamports,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mintKeypair.publicKey,
      decimals,
      payer,
      payer,
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountInstruction(
      payer,
      ata,
      payer,
      mintKeypair.publicKey,
    ),
    createMintToInstruction(
      mintKeypair.publicKey,
      ata,
      payer,
      rawAmount,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  const latestBlockhash = await connection.getLatestBlockhash();
  transaction.recentBlockhash = latestBlockhash.blockhash;
  transaction.feePayer = payer;

  const signature = await wallet.sendTransaction(transaction, connection, {
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

  return { mint: mintKeypair.publicKey, signature };
}

export type MintStableCoinParams = {
  mint: PublicKey;
  /** Wallet that will receive the freshly-minted tokens. */
  recipient: PublicKey;
  /** Human amount (will be scaled by `decimals`). */
  amount: number;
  /** Stable coin decimals (read from the local store). */
  decimals: number;
};

/**
 * Mints additional stable coin units to `recipient`. The connected wallet
 * must be the stable coin's mint authority (i.e. the original issuer).
 * Creates the recipient's associated token account idempotently so this
 * is the only call needed end-to-end.
 */
export async function mintStableCoin(
  connection: Connection,
  wallet: WalletContextState,
  { mint, recipient, amount, decimals }: MintStableCoinParams,
): Promise<TransactionSignature> {
  const payer = wallet.publicKey;
  if (!payer || !wallet.sendTransaction) {
    throw new Error("Wallet is not connected.");
  }
  if (!(amount > 0)) {
    throw new Error("Amount must be greater than zero.");
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
    throw new Error("Invalid decimals for this token.");
  }

  const recipientAta = getAssociatedTokenAddressSync(mint, recipient);

  // Same scaling as createSplToken to avoid precision loss for high decimals.
  const rawAmount =
    BigInt(Math.round(amount * 10 ** Math.min(decimals, 6))) *
    BigInt(10) ** BigInt(Math.max(0, decimals - 6));
  if (rawAmount <= BigInt(0)) {
    throw new Error("Amount is too small to mint at this decimal precision.");
  }

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      recipientAta,
      recipient,
      mint,
    ),
    createMintToInstruction(mint, recipientAta, payer, rawAmount, [], TOKEN_PROGRAM_ID),
  );

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
  return signature;
}
