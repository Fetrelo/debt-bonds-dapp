"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  findBondConfigPda,
  findHolderPda,
  findListingPda,
  getReadonlyProgram,
} from "@/lib/program/client";

/** Raw on-chain shape of the `BondConfig` PDA. */
export type BondConfigAccount = {
  mint: PublicKey;
  issuer: PublicKey;
  nominalValue: BN;
  interestRateBps: number;
  durationYears: number;
  createdAt: BN;
  bump: number;
};

/** Raw on-chain shape of the `Listing` PDA. */
export type ListingAccount = {
  bondMint: PublicKey;
  paymentMint: PublicKey;
  unitPrice: BN;
  available: BN;
  totalSold: BN;
  status: number;
  escrow: PublicKey;
  bump: number;
};

/** Raw on-chain shape of a `Holder` PDA, plus its address. */
export type HolderAccount = {
  publicKey: PublicKey;
  account: {
    bondMint: PublicKey;
    owner: PublicKey;
    bondsHeld: BN;
    couponsPaid: BN;
    bump: number;
  };
};

type Loadable<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

type FetcherState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

function useFetcher<T>(
  fetchFn: () => Promise<T | null>,
  deps: ReadonlyArray<unknown>,
): Loadable<T> {
  // Single state bag so the effect only mutates it once when the request
  // settles. Initial render has loading=true; subsequent refetches keep
  // stale data visible until the next response lands, which is fine for
  // PDA reads (they're cheap and converge quickly).
  const [state, setState] = useState<FetcherState<T>>({
    data: null,
    loading: true,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchFn()
      .then((value) => {
        if (cancelled) return;
        setState({ data: value, loading: false, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, refresh };
}

export function useBondConfig(mint: PublicKey | null): Loadable<BondConfigAccount> {
  const { connection } = useConnection();
  const program = useMemo(() => getReadonlyProgram(connection), [connection]);
  const mintBase = mint?.toBase58() ?? null;

  return useFetcher<BondConfigAccount>(
    async () => {
      if (!mint) return null;
      const [pda] = findBondConfigPda(mint);
      const account = await program.account.bondConfig.fetchNullable(pda);
      return (account as BondConfigAccount | null) ?? null;
    },
    [mintBase, program],
  );
}

export function useListing(mint: PublicKey | null): Loadable<ListingAccount> {
  const { connection } = useConnection();
  const program = useMemo(() => getReadonlyProgram(connection), [connection]);
  const mintBase = mint?.toBase58() ?? null;

  return useFetcher<ListingAccount>(
    async () => {
      if (!mint) return null;
      const [pda] = findListingPda(mint);
      const account = await program.account.listing.fetchNullable(pda);
      return (account as ListingAccount | null) ?? null;
    },
    [mintBase, program],
  );
}

/**
 * Returns the list of all `Holder` PDAs for a given bond mint. Uses
 * `getProgramAccounts` with a memcmp on the `bond_mint` field (offset 8
 * because Anchor prepends an 8-byte discriminator before account data).
 */
export function useHolders(mint: PublicKey | null): Loadable<HolderAccount[]> {
  const { connection } = useConnection();
  const program = useMemo(() => getReadonlyProgram(connection), [connection]);
  const mintBase = mint?.toBase58() ?? null;

  return useFetcher<HolderAccount[]>(
    async () => {
      if (!mint) return [];
      const accounts = await program.account.holder.all([
        {
          memcmp: {
            offset: 8,
            bytes: mint.toBase58(),
          },
        },
      ]);
      return accounts.map((a) => ({
        publicKey: a.publicKey,
        account: a.account as HolderAccount["account"],
      }));
    },
    [mintBase, program],
  );
}

/** Convenience: derives the per-holder PDA for the currently connected wallet. */
export function useConnectedHolderPda(
  mint: PublicKey | null,
): { pda: PublicKey; owner: PublicKey } | null {
  const wallet = useWallet();
  return useMemo(() => {
    if (!mint || !wallet.publicKey) return null;
    const [pda] = findHolderPda(mint, wallet.publicKey);
    return { pda, owner: wallet.publicKey };
  }, [mint, wallet.publicKey]);
}
