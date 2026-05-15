import { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import type { DebtBondsProgram } from "./client.js";

/** Anchor Idl typing is generic; cast once for account accessors. */
export function accounts(program: DebtBondsProgram) {
  return program.account as unknown as {
    bondConfig: {
      fetchNullable: (pda: PublicKey) => Promise<{
        mint: PublicKey;
        issuer: PublicKey;
        nominalValue: BN;
        interestRateBps: number;
        durationYears: number;
        createdAt: BN;
      } | null>;
      all: (
        filters: Array<{ memcmp: { offset: number; bytes: string } }>,
      ) => Promise<
        Array<{
          publicKey: PublicKey;
          account: { mint: PublicKey };
        }>
      >;
    };
    listing: {
      fetchNullable: (pda: PublicKey) => Promise<{
        bondMint: PublicKey;
        paymentMint: PublicKey;
        unitPrice: BN;
        available: BN;
        totalSold: BN;
        status: number;
        escrow: PublicKey;
      } | null>;
    };
    holder: {
      fetchNullable: (pda: PublicKey) => Promise<{
        bondMint: PublicKey;
        owner: PublicKey;
        bondsHeld: BN;
        couponsPaid: BN;
      } | null>;
      all: (
        filters: Array<{ memcmp: { offset: number; bytes: string } }>,
      ) => Promise<
        Array<{
          publicKey: PublicKey;
          account: {
            bondMint: PublicKey;
            owner: PublicKey;
            bondsHeld: BN;
            couponsPaid: BN;
          };
        }>
      >;
    };
  };
}
