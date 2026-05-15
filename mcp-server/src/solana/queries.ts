import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { accounts } from "./accounts.js";
import {
  findBondConfigPda,
  findHolderPda,
  findListingPda,
  getReadonlyProgram,
  listingStatusLabel,
} from "./client.js";

const BOND_CONFIG_ISSUER_MEMCMP_OFFSET = 40;

export type BondConfigView = {
  mint: string;
  issuer: string;
  nominalValue: string;
  interestRateBps: number;
  interestRatePct: number;
  durationYears: number;
  createdAt: string;
};

export type ListingView = {
  bondMint: string;
  paymentMint: string;
  unitPrice: string;
  available: string;
  totalSold: string;
  status: number;
  statusLabel: string;
  escrow: string;
} | null;

export type HolderView = {
  pda: string;
  bondMint: string;
  owner: string;
  bondsHeld: string;
  couponsPaid: string;
} | null;

function bnToString(v: BN): string {
  return v.toString();
}

export async function fetchBondConfig(
  connection: Connection,
  bondMint: PublicKey,
): Promise<BondConfigView | null> {
  const program = getReadonlyProgram(connection);
  const [pda] = findBondConfigPda(bondMint);
  const account = await accounts(program).bondConfig.fetchNullable(pda);
  if (!account) return null;
  return {
    mint: account.mint.toBase58(),
    issuer: account.issuer.toBase58(),
    nominalValue: bnToString(account.nominalValue),
    interestRateBps: account.interestRateBps,
    interestRatePct: account.interestRateBps / 100,
    durationYears: account.durationYears,
    createdAt: bnToString(account.createdAt),
  };
}

export async function fetchListing(
  connection: Connection,
  bondMint: PublicKey,
): Promise<ListingView> {
  const program = getReadonlyProgram(connection);
  const [pda] = findListingPda(bondMint);
  const account = await accounts(program).listing.fetchNullable(pda);
  if (!account) return null;
  return {
    bondMint: account.bondMint.toBase58(),
    paymentMint: account.paymentMint.toBase58(),
    unitPrice: bnToString(account.unitPrice),
    available: bnToString(account.available),
    totalSold: bnToString(account.totalSold),
    status: account.status,
    statusLabel: listingStatusLabel(account.status),
    escrow: account.escrow.toBase58(),
  };
}

export async function fetchHolder(
  connection: Connection,
  bondMint: PublicKey,
  owner: PublicKey,
): Promise<HolderView> {
  const program = getReadonlyProgram(connection);
  const [pda] = findHolderPda(bondMint, owner);
  const account = await accounts(program).holder.fetchNullable(pda);
  if (!account) return null;
  return {
    pda: pda.toBase58(),
    bondMint: account.bondMint.toBase58(),
    owner: account.owner.toBase58(),
    bondsHeld: bnToString(account.bondsHeld),
    couponsPaid: bnToString(account.couponsPaid),
  };
}

export async function listBondHolders(
  connection: Connection,
  bondMint: PublicKey,
): Promise<HolderView[]> {
  const program = getReadonlyProgram(connection);
  const rows = await accounts(program).holder.all([
    {
      memcmp: {
        offset: 8,
        bytes: bondMint.toBase58(),
      },
    },
  ]);
  return rows.map(({ publicKey, account }) => ({
    pda: publicKey.toBase58(),
    bondMint: account.bondMint.toBase58(),
    owner: account.owner.toBase58(),
    bondsHeld: bnToString(account.bondsHeld),
    couponsPaid: bnToString(account.couponsPaid),
  }));
}

export async function fetchBondWalletBalance(
  connection: Connection,
  bondMint: PublicKey,
  owner: PublicKey,
): Promise<{ ata: string | null; balance: string; uiAmount: number | null }> {
  const ata = getAssociatedTokenAddressSync(bondMint, owner);
  const info = await connection.getTokenAccountBalance(ata).catch(() => null);
  if (!info) {
    return { ata: ata.toBase58(), balance: "0", uiAmount: 0 };
  }
  return {
    ata: ata.toBase58(),
    balance: info.value.amount,
    uiAmount: info.value.uiAmount,
  };
}

export async function listBondsByIssuer(
  connection: Connection,
  issuer: PublicKey,
): Promise<Array<{ bondConfigPda: string; bondMint: string }>> {
  const program = getReadonlyProgram(connection);
  const rows = await accounts(program).bondConfig.all([
    {
      memcmp: {
        offset: BOND_CONFIG_ISSUER_MEMCMP_OFFSET,
        bytes: issuer.toBase58(),
      },
    },
  ]);
  return rows.map(({ publicKey, account }) => ({
    bondConfigPda: publicKey.toBase58(),
    bondMint: account.mint.toBase58(),
  }));
}

export async function fetchStablecoinBalance(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
): Promise<{ ata: string | null; balance: string; uiAmount: number | null }> {
  const ata = getAssociatedTokenAddressSync(mint, owner);
  const info = await connection.getTokenAccountBalance(ata).catch(() => null);
  if (!info) {
    return { ata: null, balance: "0", uiAmount: 0 };
  }
  return {
    ata: ata.toBase58(),
    balance: info.value.amount,
    uiAmount: info.value.uiAmount,
  };
}

export async function getBondSummary(
  connection: Connection,
  bondMint: PublicKey,
) {
  const [config, listing] = await Promise.all([
    fetchBondConfig(connection, bondMint),
    fetchListing(connection, bondMint),
  ]);
  return { bondMint: bondMint.toBase58(), config, listing };
}
