"use client";

import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { StoredDebtBond, truncateMiddle } from "@/lib/tokens";
import { useHolders } from "@/lib/program/useDetails";

export function BondholdersTable({
  token,
  mint,
}: {
  token: StoredDebtBond;
  mint: PublicKey;
}) {
  const wallet = useWallet();
  const { data: holders, loading, error } = useHolders(mint);

  const rows = useMemo(() => {
    if (!holders) return [];
    return holders
      .map((h) => {
        const owner = h.account.owner.toBase58();
        const bondsHeld = BigInt(h.account.bondsHeld.toString());
        const paid = BigInt(h.account.couponsPaid.toString());
        const owed =
          (BigInt(token.nominalValue) *
            BigInt(token.interestRatePct) *
            BigInt(token.durationYears) *
            bondsHeld) /
          100n;
        const pending = owed > paid ? owed - paid : 0n;
        return {
          pda: h.publicKey.toBase58(),
          owner,
          bondsHeld,
          owed,
          paid,
          pending,
          isMe: wallet.publicKey?.toBase58() === owner,
        };
      })
      .sort((a, b) => {
        if (a.bondsHeld === b.bondsHeld) return 0;
        return a.bondsHeld > b.bondsHeld ? -1 : 1;
      });
  }, [holders, token, wallet.publicKey]);

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Bondholders
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {rows.length} holder{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading holders…
        </p>
      ) : error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Nobody has purchased these bonds yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-black/10 text-[11px] uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              <tr>
                <th className="py-2 pr-4 font-medium">Holder</th>
                <th className="py-2 pr-4 text-right font-medium">
                  Bonds held
                </th>
                <th className="py-2 pr-4 text-right font-medium">
                  Coupons owed
                </th>
                <th className="py-2 pr-4 text-right font-medium">
                  Coupons paid
                </th>
                <th className="py-2 pr-4 text-right font-medium">Pending</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5 dark:divide-white/5">
              {rows.map((row) => (
                <tr
                  key={row.pda}
                  className="text-zinc-700 dark:text-zinc-300"
                >
                  <td className="py-2 pr-4 font-mono text-xs">
                    <span className="flex items-center gap-2">
                      <span title={row.owner}>
                        {truncateMiddle(row.owner, 6, 6)}
                      </span>
                      {row.isMe && (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          You
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {row.bondsHeld.toString()}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {row.owed.toString()}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    {row.paid.toString()}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono">
                    <span
                      className={
                        row.pending > 0n
                          ? "text-amber-700 dark:text-amber-300"
                          : "text-zinc-400"
                      }
                    >
                      {row.pending.toString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            Coupon amounts are in abstract units. The actual coin and amount
            paid depend on the coin the issuer picks at pay time.
          </p>
        </div>
      )}
    </div>
  );
}
