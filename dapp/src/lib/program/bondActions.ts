import { BN } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import {
  findBondConfigPda,
  findEscrowPda,
  findHolderPda,
  findListingPda,
  getProgram,
} from "@/lib/program/client";
import type { HolderAccount } from "@/lib/program/useDetails";

function requireWallet(wallet: WalletContextState) {
  if (!wallet.publicKey || !wallet.sendTransaction) {
    throw new Error("Wallet is not connected.");
  }
  return wallet.publicKey;
}

async function sendAndConfirm(
  connection: Connection,
  wallet: WalletContextState,
  instructions: TransactionInstruction[],
): Promise<string> {
  const payer = requireWallet(wallet);
  const tx = new Transaction().add(...instructions);
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

export async function initListing(
  connection: Connection,
  wallet: WalletContextState,
  params: {
    bondMint: PublicKey;
    paymentMint: PublicKey;
    /** Per-bond unit price in `paymentMint` atomic units. */
    unitPrice: BN;
  },
): Promise<string> {
  const issuer = requireWallet(wallet);
  const program = getProgram(connection, wallet);
  const [bondConfig] = findBondConfigPda(params.bondMint);
  const [listing] = findListingPda(params.bondMint);
  const [escrow] = findEscrowPda(params.bondMint);

  const ix = await program.methods
    .initListing(params.unitPrice)
    .accountsPartial({
      issuer,
      bondMint: params.bondMint,
      paymentMint: params.paymentMint,
      bondConfig,
      listing,
      escrow,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();
  return sendAndConfirm(connection, wallet, [ix]);
}

export async function addSupplyToListing(
  connection: Connection,
  wallet: WalletContextState,
  params: { bondMint: PublicKey; amount: BN },
): Promise<string> {
  const issuer = requireWallet(wallet);
  const program = getProgram(connection, wallet);
  const [bondConfig] = findBondConfigPda(params.bondMint);
  const [listing] = findListingPda(params.bondMint);
  const [escrow] = findEscrowPda(params.bondMint);

  const ix = await program.methods
    .addSupplyToListing(params.amount)
    .accountsPartial({
      issuer,
      bondMint: params.bondMint,
      bondConfig,
      listing,
      escrow,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  return sendAndConfirm(connection, wallet, [ix]);
}

export async function closeListing(
  connection: Connection,
  wallet: WalletContextState,
  params: { bondMint: PublicKey },
): Promise<string> {
  const issuer = requireWallet(wallet);
  const program = getProgram(connection, wallet);
  const [bondConfig] = findBondConfigPda(params.bondMint);
  const [listing] = findListingPda(params.bondMint);

  const ix = await program.methods
    .closeListing()
    .accountsPartial({
      issuer,
      bondMint: params.bondMint,
      bondConfig,
      listing,
    })
    .instruction();
  return sendAndConfirm(connection, wallet, [ix]);
}

export async function purchaseBond(
  connection: Connection,
  wallet: WalletContextState,
  params: {
    bondMint: PublicKey;
    paymentMint: PublicKey;
    issuer: PublicKey;
    amount: BN;
  },
): Promise<string> {
  const buyer = requireWallet(wallet);
  const program = getProgram(connection, wallet);
  const [bondConfig] = findBondConfigPda(params.bondMint);
  const [listing] = findListingPda(params.bondMint);
  const [escrow] = findEscrowPda(params.bondMint);
  const [holder] = findHolderPda(params.bondMint, buyer);

  const buyerBondAta = getAssociatedTokenAddressSync(params.bondMint, buyer);
  const buyerPaymentAta = getAssociatedTokenAddressSync(
    params.paymentMint,
    buyer,
  );
  const issuerPaymentAta = getAssociatedTokenAddressSync(
    params.paymentMint,
    params.issuer,
  );

  const preIxs: TransactionInstruction[] = [
    // Make sure the issuer's payment ATA exists so the program can deposit
    // the sale proceeds. Idempotent if it already does.
    createAssociatedTokenAccountIdempotentInstruction(
      buyer,
      issuerPaymentAta,
      params.issuer,
      params.paymentMint,
    ),
  ];

  const purchaseIx = await program.methods
    .purchaseBond(params.amount)
    .accountsPartial({
      buyer,
      bondMint: params.bondMint,
      paymentMint: params.paymentMint,
      bondConfig,
      listing,
      escrow,
      holder,
      buyerBondAta,
      buyerPaymentAta,
      issuer: params.issuer,
      issuerPaymentAta,
      systemProgram: SystemProgram.programId,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .instruction();

  return sendAndConfirm(connection, wallet, [...preIxs, purchaseIx]);
}

/**
 * Pays every still-owed coupon to every holder of `bondMint` in the chosen
 * payment coin. Each pay call is one instruction; we batch as many holders
 * as we can per Solana transaction (default 5) and submit them sequentially.
 */
export async function payAllCoupons(
  connection: Connection,
  wallet: WalletContextState,
  params: {
    bondMint: PublicKey;
    paymentMint: PublicKey;
    holders: HolderAccount[];
  },
  options: { holdersPerTx?: number } = {},
): Promise<{ signatures: string[]; paidHolders: number }> {
  const issuer = requireWallet(wallet);
  const program = getProgram(connection, wallet);
  const [bondConfig] = findBondConfigPda(params.bondMint);
  const issuerPaymentAta = getAssociatedTokenAddressSync(
    params.paymentMint,
    issuer,
  );

  const holdersPerTx = options.holdersPerTx ?? 5;
  const signatures: string[] = [];
  let paidHolders = 0;

  for (let i = 0; i < params.holders.length; i += holdersPerTx) {
    const batch = params.holders.slice(i, i + holdersPerTx);
    const ixs: TransactionInstruction[] = [];

    for (const h of batch) {
      const holderPaymentAta = getAssociatedTokenAddressSync(
        params.paymentMint,
        h.account.owner,
      );
      // Make sure the holder has an ATA for the chosen payment coin —
      // the issuer pays the rent so the transfer can land.
      ixs.push(
        createAssociatedTokenAccountIdempotentInstruction(
          issuer,
          holderPaymentAta,
          h.account.owner,
          params.paymentMint,
        ),
      );
      const ix = await program.methods
        .payHolderCoupons()
        .accountsPartial({
          issuer,
          bondMint: params.bondMint,
          paymentMint: params.paymentMint,
          bondConfig,
          holder: h.publicKey,
          issuerPaymentAta,
          holderPaymentAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .instruction();
      ixs.push(ix);
    }

    const signature = await sendAndConfirm(connection, wallet, ixs);
    signatures.push(signature);
    paidHolders += batch.length;
  }

  return { signatures, paidHolders };
}
