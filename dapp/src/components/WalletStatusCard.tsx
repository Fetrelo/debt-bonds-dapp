"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function WalletStatusCard() {
  const { connection } = useConnection();
  const { publicKey, wallet, connecting } = useWallet();
  const [balanceEntry, setBalanceEntry] = useState<{
    pk: string;
    sol: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const pkBase58 = publicKey?.toBase58() ?? null;
  const balance =
    pkBase58 && balanceEntry?.pk === pkBase58 ? balanceEntry.sol : null;

  useEffect(() => {
    if (!publicKey) return;
    let cancelled = false;
    const pk = publicKey.toBase58();

    connection
      .getBalance(publicKey, "confirmed")
      .then((lamports) => {
        if (!cancelled) {
          setBalanceEntry({ pk, sol: lamports / LAMPORTS_PER_SOL });
        }
      })
      .catch(() => {
        // leave previous balance; the cache key check will hide it
      });

    const subscriptionId = connection.onAccountChange(
      publicKey,
      (account) => {
        if (!cancelled) {
          setBalanceEntry({ pk, sol: account.lamports / LAMPORTS_PER_SOL });
        }
      },
      { commitment: "confirmed" },
    );

    return () => {
      cancelled = true;
      connection.removeAccountChangeListener(subscriptionId).catch(() => {
        // best-effort cleanup
      });
    };
  }, [publicKey, connection]);

  const onCopy = async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-black/10 bg-white/70 p-6 shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_40px_-20px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              publicKey
                ? "bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.18)]"
                : "bg-zinc-400"
            }`}
          />
          <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Wallet
          </h2>
        </div>
        <span className="rounded-full border border-black/10 bg-white/60 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
          {publicKey ? "Connected" : connecting ? "Connecting…" : "Not connected"}
        </span>
      </div>

      <div className="mt-5">
        {publicKey ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  Address
                </p>
                <p className="mt-1 truncate font-mono text-sm text-zinc-900 dark:text-zinc-100">
                  {truncateAddress(publicKey.toBase58())}
                </p>
              </div>
              <button
                type="button"
                onClick={onCopy}
                className="shrink-0 rounded-md border border-black/10 bg-white/80 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-black/5 pt-4 dark:border-white/5">
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  Balance
                </p>
                <p className="mt-1 font-mono text-sm text-zinc-900 dark:text-zinc-100">
                  {balance === null ? "—" : `${balance.toFixed(4)} SOL`}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
                  Wallet
                </p>
                <p className="mt-1 text-sm text-zinc-900 dark:text-zinc-100">
                  {wallet?.adapter.name ?? "—"}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Connect a Solana wallet to view your address and balance.
            </p>
            <WalletMultiButton />
          </div>
        )}
      </div>
    </div>
  );
}
