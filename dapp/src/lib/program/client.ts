import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import idl from "./idl.json";
import type { DebtBonds } from "./idl";

const BOND_CONFIG_SEED = Buffer.from("bond_config");
const LISTING_SEED = Buffer.from("listing");
const HOLDER_SEED = Buffer.from("holder");
const ESCROW_SEED = Buffer.from("listing_escrow");

export const PROGRAM_ID = new PublicKey(
  (idl as unknown as { address: string }).address,
);

export type DebtBondsProgram = Program<DebtBonds>;

type WalletForProvider = {
  publicKey: PublicKey;
  signTransaction: NonNullable<WalletContextState["signTransaction"]>;
  signAllTransactions: NonNullable<WalletContextState["signAllTransactions"]>;
};

function asProviderWallet(wallet: WalletContextState): WalletForProvider {
  if (
    !wallet.publicKey ||
    !wallet.signTransaction ||
    !wallet.signAllTransactions
  ) {
    throw new Error("Wallet is not connected.");
  }
  return {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  };
}

export function getProgram(
  connection: Connection,
  wallet: WalletContextState,
): DebtBondsProgram {
  const provider = new AnchorProvider(connection, asProviderWallet(wallet), {
    commitment: "confirmed",
  });
  return new Program<DebtBonds>(idl as unknown as DebtBonds, provider);
}

export function getReadonlyProgram(connection: Connection): DebtBondsProgram {
  // Anchor needs a provider, but we'll never sign with it for reads.
  const dummy = {
    publicKey: PublicKey.default,
    signTransaction: async <T>(t: T) => t,
    signAllTransactions: async <T>(t: T[]) => t,
  } as unknown as WalletForProvider;
  const provider = new AnchorProvider(connection, dummy, {
    commitment: "confirmed",
  });
  return new Program<DebtBonds>(idl as unknown as DebtBonds, provider);
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

export type ListingStatus =
  (typeof LISTING_STATUS)[keyof typeof LISTING_STATUS];

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
