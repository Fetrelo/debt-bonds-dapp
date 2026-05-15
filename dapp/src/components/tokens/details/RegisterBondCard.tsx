"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { StoredDebtBond, updateToken } from "@/lib/tokens";
import { registerExistingBond } from "@/lib/createBond";

export function RegisterBondCard({
  token,
  isIssuer,
  onRegistered,
}: {
  token: StoredDebtBond;
  isIssuer: boolean;
  onRegistered: () => void;
}) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setError(null);
    setPending(true);
    try {
      const { bondConfig } = await registerExistingBond(connection, wallet, {
        mint: new PublicKey(token.mint),
        nominalValue: token.nominalValue,
        interestRatePct: token.interestRatePct,
        durationYears: token.durationYears,
      });
      updateToken(token.mint, {
        onChainRegistered: true,
        bondConfigPda: bondConfig.toBase58(),
      });
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 dark:border-amber-400/30 dark:bg-amber-400/[0.04]">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
        Bond not registered on-chain
      </h2>
      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
        This bond&apos;s mint exists, but it pre-dates the on-chain bond
        registry. Trading, listings, and coupon payments are disabled until
        the original issuer re-registers it.
      </p>

      {!wallet.publicKey ? (
        <div className="mt-4">
          <WalletMultiButton />
        </div>
      ) : !isIssuer ? (
        <p className="mt-3 rounded-lg border border-black/10 bg-white/60 p-3 text-xs text-zinc-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-400">
          Only the original issuer ({token.issuer.slice(0, 6)}…
          {token.issuer.slice(-6)}) can register this bond. Connected wallet
          doesn&apos;t match.
        </p>
      ) : (
        <>
          {error && (
            <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={onClick}
            disabled={pending}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {pending ? "Registering…" : "Register on-chain"}
          </button>
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            This signs a single transaction that hands the mint authority
            over to the program PDA and writes the on-chain BondConfig.
          </p>
        </>
      )}
    </div>
  );
}
