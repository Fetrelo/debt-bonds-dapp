"use client";

import {
  StoredDebtBond,
  StoredToken,
  formatAmount,
  formatDate,
  truncateMiddle,
} from "@/lib/tokens";

const DASH = "—";

export function TokensTable({ tokens }: { tokens: StoredToken[] }) {
  if (tokens.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          No tokens yet. Click <span className="font-medium">Create token</span>{" "}
          to mint your first one.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-black/10 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="max-w-full overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-black/10 bg-white/40 text-[11px] uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-400">
            <tr>
              <Th>Token</Th>
              <Th>Kind</Th>
              <Th>Mint</Th>
              <Th align="right">Decimals</Th>
              <Th align="right">Initial supply</Th>
              <Th align="right">Nominal</Th>
              <Th align="right">Interest</Th>
              <Th align="right">Duration</Th>
              <Th>Maturity</Th>
              <Th>Created</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 dark:divide-white/5">
            {tokens.map((token) => (
              <Row key={token.mint} token={token} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`px-4 py-3 font-medium ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

function Row({ token }: { token: StoredToken }) {
  const isBond = token.kind === "bond";
  const bond = isBond ? (token as StoredDebtBond) : null;

  return (
    <tr className="text-zinc-700 transition hover:bg-zinc-50/60 dark:text-zinc-300 dark:hover:bg-white/[0.03]">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {token.name}
          </span>
          <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
            {token.symbol}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <KindBadge kind={token.kind} />
      </td>
      <td className="px-4 py-3 font-mono text-xs">
        {truncateMiddle(token.mint, 4, 4)}
      </td>
      <td className="px-4 py-3 text-right font-mono text-xs">
        {token.decimals}
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {formatAmount(token.initialSupply)}
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {bond ? formatAmount(bond.nominalValue) : DASH}
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {bond ? `${formatAmount(bond.interestRatePct)}%` : DASH}
      </td>
      <td className="px-4 py-3 text-right font-mono">
        {bond ? `${formatAmount(bond.durationYears)} yr` : DASH}
      </td>
      <td className="px-4 py-3 text-xs">
        {bond ? formatDate(bond.maturityDate) : DASH}
      </td>
      <td className="px-4 py-3 text-xs">{formatDate(token.createdAt)}</td>
    </tr>
  );
}

function KindBadge({ kind }: { kind: "stable" | "bond" }) {
  if (kind === "bond") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">
        Debt bond
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
      Stable coin
    </span>
  );
}
