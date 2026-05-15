"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import {
  StoredDebtBond,
  StoredStableCoin,
  StoredToken,
  formatAmount,
  formatDate,
  getTokensServerSnapshot,
  getTokensSnapshot,
  subscribeTokens,
  truncateMiddle,
} from "@/lib/tokens";
import { useBondConfig } from "@/lib/program/useDetails";
import { BondActions } from "@/components/tokens/details/BondActions";
import { BondholdersTable } from "@/components/tokens/details/BondholdersTable";
import { RegisterBondCard } from "@/components/tokens/details/RegisterBondCard";
import { StableCoinActions } from "@/components/tokens/details/StableCoinActions";

function tryPubkey(value: string): PublicKey | null {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

export function TokenDetailsClient({ mint }: { mint: string }) {
  const tokens = useSyncExternalStore(
    subscribeTokens,
    getTokensSnapshot,
    getTokensServerSnapshot,
  );
  const wallet = useWallet();

  const token = useMemo(
    () => tokens.find((t) => t.mint === mint) ?? null,
    [tokens, mint],
  );
  const mintPk = useMemo(() => tryPubkey(mint), [mint]);

  // Always probe BondConfig on-chain so we can show real status even if the
  // local `onChainRegistered` flag is stale.
  const bondConfig = useBondConfig(token?.kind === "bond" ? mintPk : null);

  if (!mintPk) {
    return (
      <ErrorState
        title="Invalid mint"
        description="The mint address in the URL is not a valid public key."
      />
    );
  }

  if (!token) {
    return (
      <ErrorState
        title="Token not found"
        description="No record of this token exists in this browser. It may have been created on another device."
      />
    );
  }

  const isIssuer =
    !!wallet.publicKey && wallet.publicKey.toBase58() === token.issuer;
  const isBond = token.kind === "bond";

  return (
    <div className="flex flex-col gap-8">
      <Header token={token} isIssuer={isIssuer} />
      <ConfigCard token={token} isIssuer={isIssuer} />

      {isBond && bondConfig.loading && (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-6 text-sm text-zinc-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-zinc-400">
          Loading on-chain data…
        </div>
      )}

      {isBond && !bondConfig.loading && !bondConfig.data && (
        <RegisterBondCard
          token={token as StoredDebtBond}
          isIssuer={isIssuer}
          onRegistered={() => bondConfig.refresh()}
        />
      )}

      {isBond && !bondConfig.loading && bondConfig.data && (
        <>
          <BondActions
            token={token as StoredDebtBond}
            mint={mintPk}
            isIssuer={isIssuer}
          />
          <BondholdersTable token={token as StoredDebtBond} mint={mintPk} />
        </>
      )}

      {!isBond && (
        <StableCoinActions
          token={token as StoredStableCoin}
          isIssuer={isIssuer}
        />
      )}
    </div>
  );
}

function Header({ token, isIssuer }: { token: StoredToken; isIssuer: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
            token.kind === "bond"
              ? "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          }`}
        >
          {token.kind === "bond" ? "Debt bond" : "Stable coin"}
        </span>
        {isIssuer && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
            You are the issuer
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl dark:text-zinc-50">
          {token.name}{" "}
          <span className="text-zinc-400 dark:text-zinc-500">
            ({token.symbol})
          </span>
        </h1>
        <p className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          {token.mint}
        </p>
      </div>
    </div>
  );
}

function ConfigCard({ token, isIssuer }: { token: StoredToken; isIssuer: boolean }) {
  const isBond = token.kind === "bond";
  const bond = isBond ? (token as StoredDebtBond) : null;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Token configuration
        </h2>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Item label="Mint address" mono>
          <span title={token.mint}>{truncateMiddle(token.mint, 6, 6)}</span>
        </Item>
        <Item label="Decimals" mono>
          {token.decimals}
        </Item>
        <Item label="Issuer" mono>
          <span className="flex items-center gap-2">
            <span title={token.issuer}>
              {truncateMiddle(token.issuer, 6, 6)}
            </span>
            {isIssuer && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                You
              </span>
            )}
          </span>
        </Item>
        <Item label={isBond ? "Initial mint" : "Initial supply"} mono>
          {isBond ? "—" : formatAmount(token.initialSupply)}
        </Item>
        <Item label="Created at">{formatDate(token.createdAt)}</Item>

        {bond && (
          <>
            <Item label="Nominal value" mono>
              {formatAmount(bond.nominalValue)}
            </Item>
            <Item label="Interest rate" mono>
              {formatAmount(bond.interestRatePct)}%
            </Item>
            <Item label="Duration" mono>
              {formatAmount(bond.durationYears)} yr
            </Item>
            <Item label="Annual coupon" mono>
              {formatAmount(bond.annualCoupon)}
            </Item>
            <Item label="Issue date">{formatDate(bond.createdAt)}</Item>
            <Item label="Maturity date">{formatDate(bond.maturityDate)}</Item>
          </>
        )}
      </dl>
    </div>
  );
}

function Item({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd
        className={`text-sm text-zinc-900 dark:text-zinc-50 ${
          mono ? "font-mono" : ""
        }`}
      >
        {children}
      </dd>
    </div>
  );
}

function ErrorState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-12 text-center dark:border-white/10 dark:bg-white/[0.02]">
      <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        {description}
      </p>
    </div>
  );
}
