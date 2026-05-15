import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import type { SigningWallet } from "../wallet.js";
import idl from "./idl.json" with { type: "json" };
import { getProgramId } from "../config.js";

const BOND_CONFIG_SEED = Buffer.from("bond_config");
const LISTING_SEED = Buffer.from("listing");
const HOLDER_SEED = Buffer.from("holder");
const ESCROW_SEED = Buffer.from("listing_escrow");

export const PROGRAM_ID = getProgramId();

export type DebtBondsProgram = Program<Idl>;

export function getProgram(
  connection: Connection,
  wallet: SigningWallet,
): DebtBondsProgram {
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new Program(idl as Idl, provider);
}

export function getReadonlyProgram(connection: Connection): DebtBondsProgram {
  const dummy = {
    publicKey: PublicKey.default,
    signTransaction: async <T>(t: T) => t,
    signAllTransactions: async <T>(t: T[]) => t,
  };
  const provider = new AnchorProvider(connection, dummy, {
    commitment: "confirmed",
  });
  return new Program(idl as Idl, provider);
}

export function findBondConfigPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [BOND_CONFIG_SEED, mint.toBuffer()],
    PROGRAM_ID,
  );
}

export function findListingPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [LISTING_SEED, mint.toBuffer()],
    PROGRAM_ID,
  );
}

export function findEscrowPda(mint: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, mint.toBuffer()],
    PROGRAM_ID,
  );
}

export function findHolderPda(
  mint: PublicKey,
  owner: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [HOLDER_SEED, mint.toBuffer(), owner.toBuffer()],
    PROGRAM_ID,
  );
}

export const LISTING_STATUS = {
  Active: 0,
  SoldOut: 1,
  Closed: 2,
} as const;

export function listingStatusLabel(status: number): string {
  switch (status) {
    case LISTING_STATUS.Active:
      return "Active";
    case LISTING_STATUS.SoldOut:
      return "Sold out";
    case LISTING_STATUS.Closed:
      return "Closed";
    default:
      return "Unknown";
  }
}
