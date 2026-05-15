import {
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import type { SigningWallet } from "../wallet.js";
import { sendAndConfirmInstructions } from "./tx.js";

/**
 * SPL-only bond transfer. Does NOT update the on-chain Holder PDA; coupon
 * rights remain with the original purchaser until a program transfer exists.
 */
export async function transferBondSpl(
  connection: Connection,
  wallet: SigningWallet,
  params: {
    bondMint: PublicKey;
    recipient: PublicKey;
    amount: bigint;
  },
): Promise<string> {
  if (params.amount <= BigInt(0)) {
    throw new Error("Amount must be greater than zero.");
  }

  const sender = wallet.publicKey;
  const senderAta = getAssociatedTokenAddressSync(params.bondMint, sender);
  const recipientAta = getAssociatedTokenAddressSync(
    params.bondMint,
    params.recipient,
  );

  const ixs = [
    createAssociatedTokenAccountIdempotentInstruction(
      sender,
      recipientAta,
      params.recipient,
      params.bondMint,
    ),
    createTransferInstruction(
      senderAta,
      recipientAta,
      sender,
      params.amount,
      [],
      TOKEN_PROGRAM_ID,
    ),
  ];

  return sendAndConfirmInstructions(connection, wallet, ixs);
}
