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
  TransactionInstruction,
} from "@solana/web3.js";
import type { SigningWallet } from "../wallet.js";
import {
  findBondConfigPda,
  findEscrowPda,
  findHolderPda,
  findListingPda,
  getProgram,
} from "./client.js";
import { sendAndConfirmInstructions } from "./tx.js";

export async function initListing(
  connection: Connection,
  wallet: SigningWallet,
  params: {
    bondMint: PublicKey;
    paymentMint: PublicKey;
    unitPrice: BN;
  },
): Promise<string> {
  const program = getProgram(connection, wallet);
  const [bondConfig] = findBondConfigPda(params.bondMint);
  const [listing] = findListingPda(params.bondMint);
  const [escrow] = findEscrowPda(params.bondMint);

  const ix = await program.methods
    .initListing(params.unitPrice)
    .accountsPartial({
      issuer: wallet.publicKey,
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
  return sendAndConfirmInstructions(connection, wallet, [ix]);
}

export async function addSupplyToListing(
  connection: Connection,
  wallet: SigningWallet,
  params: { bondMint: PublicKey; amount: BN },
): Promise<string> {
  const program = getProgram(connection, wallet);
  const [bondConfig] = findBondConfigPda(params.bondMint);
  const [listing] = findListingPda(params.bondMint);
  const [escrow] = findEscrowPda(params.bondMint);

  const ix = await program.methods
    .addSupplyToListing(params.amount)
    .accountsPartial({
      issuer: wallet.publicKey,
      bondMint: params.bondMint,
      bondConfig,
      listing,
      escrow,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
  return sendAndConfirmInstructions(connection, wallet, [ix]);
}

export async function purchaseBond(
  connection: Connection,
  wallet: SigningWallet,
  params: {
    bondMint: PublicKey;
    paymentMint: PublicKey;
    issuer: PublicKey;
    amount: BN;
  },
): Promise<string> {
  const buyer = wallet.publicKey;
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

  return sendAndConfirmInstructions(connection, wallet, [
    ...preIxs,
    purchaseIx,
  ]);
}
