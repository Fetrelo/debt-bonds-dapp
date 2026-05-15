"use client";

import { FormEvent, useMemo, useState, useSyncExternalStore } from "react";
import { BN } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import {
  StoredDebtBond,
  StoredStableCoin,
  StoredToken,
  formatAmount,
  getTokensServerSnapshot,
  getTokensSnapshot,
  subscribeTokens,
  truncateMiddle,
} from "@/lib/tokens";
import {
  listingStatusLabel,
  LISTING_STATUS,
} from "@/lib/program/client";
import {
  ListingAccount,
  useHolders,
  useListing,
} from "@/lib/program/useDetails";
import {
  addSupplyToListing,
  closeListing,
  initListing,
  payAllCoupons,
  purchaseBond,
} from "@/lib/program/bondActions";

function isStableCoin(t: StoredToken): t is StoredStableCoin {
  return t.kind === "stable";
}

function tryPubkey(value: string): PublicKey | null {
  try {
    return new PublicKey(value);
  } catch {
    return null;
  }
}

export function BondActions({
  token,
  mint,
  isIssuer,
}: {
  token: StoredDebtBond;
  mint: PublicKey;
  isIssuer: boolean;
}) {
  const wallet = useWallet();
  const listing = useListing(mint);
  const holders = useHolders(mint);

  return (
    <div className="flex flex-col gap-6">
      <ListingCard
        listing={listing.data}
        loading={listing.loading}
      />

      {isIssuer && (
        <IssuerActions
          token={token}
          mint={mint}
          listing={listing.data}
          onListingChanged={() => {
            listing.refresh();
            holders.refresh();
          }}
          onPaidCoupons={() => holders.refresh()}
          holders={holders.data ?? []}
        />
      )}

      {!isIssuer && wallet.publicKey && listing.data && (
        <PurchaseForm
          token={token}
          mint={mint}
          listing={listing.data}
          onPurchased={() => {
            listing.refresh();
            holders.refresh();
          }}
        />
      )}

      {!isIssuer && !wallet.publicKey && listing.data && (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white/40 p-6 text-center dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Connect a wallet to purchase bonds.
          </p>
          <div className="mt-3 flex justify-center">
            <WalletMultiButton />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Listing card (visible to everyone)
// ============================================================================

function ListingCard({
  listing,
  loading,
}: {
  listing: ListingAccount | null;
  loading: boolean;
}) {
  const tokens = useSyncExternalStore(
    subscribeTokens,
    getTokensSnapshot,
    getTokensServerSnapshot,
  );

  const paymentToken = useMemo(() => {
    if (!listing) return null;
    return (
      tokens.find((t) => t.mint === listing.paymentMint.toBase58()) ?? null
    );
  }, [tokens, listing]);

  const paymentDecimals = paymentToken?.decimals ?? 0;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Active listing
        </h2>
        {listing && <StatusBadge status={listing.status} />}
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          Loading listing…
        </p>
      ) : !listing ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          No listing yet. The issuer can open one to start selling bonds.
        </p>
      ) : (
        <dl className="mt-4 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Item label="Available">
            <span className="font-mono">{listing.available.toString()}</span>
          </Item>
          <Item label="Total sold">
            <span className="font-mono">{listing.totalSold.toString()}</span>
          </Item>
          <Item label="Unit price">
            <span className="font-mono">
              {atomicToHuman(listing.unitPrice, paymentDecimals)}{" "}
              {paymentToken?.symbol ?? ""}
            </span>
          </Item>
          <Item label="Payment coin">
            <span className="flex items-center gap-2">
              {paymentToken ? (
                <span>
                  {paymentToken.name}{" "}
                  <span className="text-zinc-400">({paymentToken.symbol})</span>
                </span>
              ) : (
                <span className="font-mono text-xs">
                  {truncateMiddle(listing.paymentMint.toBase58(), 4, 4)}
                </span>
              )}
            </span>
          </Item>
        </dl>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: number }) {
  const label = listingStatusLabel(status);
  const cls =
    status === LISTING_STATUS.Active
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === LISTING_STATUS.SoldOut
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-zinc-500/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// ============================================================================
// Issuer actions
// ============================================================================

function IssuerActions({
  token,
  mint,
  listing,
  onListingChanged,
  onPaidCoupons,
  holders,
}: {
  token: StoredDebtBond;
  mint: PublicKey;
  listing: ListingAccount | null;
  onListingChanged: () => void;
  onPaidCoupons: () => void;
  holders: import("@/lib/program/useDetails").HolderAccount[];
}) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6 dark:border-amber-400/30 dark:bg-amber-400/[0.04]">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
        Issuer actions
      </h2>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Only the bond&apos;s issuer can use these controls.
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {!listing ? (
          <InitListingForm mint={mint} onDone={onListingChanged} />
        ) : (
          <ManageListingPanel
            mint={mint}
            listing={listing}
            onDone={onListingChanged}
          />
        )}

        <PayCouponsPanel
          token={token}
          mint={mint}
          holders={holders}
          onDone={onPaidCoupons}
        />
      </div>
    </div>
  );
}

function InitListingForm({
  mint,
  onDone,
}: {
  mint: PublicKey;
  onDone: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const tokens = useSyncExternalStore(
    subscribeTokens,
    getTokensSnapshot,
    getTokensServerSnapshot,
  );
  const stables = useMemo(() => tokens.filter(isStableCoin), [tokens]);

  const [paymentMint, setPaymentMint] = useState<string>("");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const paymentToken = stables.find((s) => s.mint === paymentMint) ?? null;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!paymentToken) return setError("Pick a stable coin.");
    const priceNum = parseFloat(unitPrice);
    if (!(priceNum > 0))
      return setError("Unit price must be greater than zero.");
    const atomic = humanToAtomic(priceNum, paymentToken.decimals);
    if (atomic === null) return setError("Unit price has too many decimals.");

    setPending(true);
    try {
      await initListing(connection, wallet, {
        bondMint: mint,
        paymentMint: new PublicKey(paymentToken.mint),
        unitPrice: atomic,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Open a listing
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Buyers pay in the chosen stable coin. You can top up the supply
        afterwards.
      </p>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Payment coin
        </span>
        <select
          value={paymentMint}
          onChange={(e) => setPaymentMint(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
        >
          <option value="">— Pick a stable coin —</option>
          {stables.map((s) => (
            <option key={s.mint} value={s.mint}>
              {s.name} ({s.symbol}) — {truncateMiddle(s.mint, 4, 4)}
            </option>
          ))}
        </select>
        {stables.length === 0 && (
          <span className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            No stable coins in this browser yet. Create one from the tokens
            page first.
          </span>
        )}
      </label>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Unit price ({paymentToken?.symbol ?? "—"})
        </span>
        <input
          type="number"
          min={0}
          step="any"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          disabled={pending}
          placeholder="1000"
          className="rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-zinc-900"
        />
      </label>

      {error && <ErrorBox>{error}</ErrorBox>}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Opening…" : "Open listing"}
      </button>
    </form>
  );
}

function ManageListingPanel({
  mint,
  listing,
  onDone,
}: {
  mint: PublicKey;
  listing: ListingAccount;
  onDone: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState<string>("");
  const [pending, setPending] = useState<"add" | "close" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isClosed = listing.status === LISTING_STATUS.Closed;

  const onAdd = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const n = parseInt(amount, 10);
    if (!Number.isInteger(n) || n <= 0) return setError("Amount must be > 0.");

    setPending("add");
    try {
      await addSupplyToListing(connection, wallet, {
        bondMint: mint,
        amount: new BN(n),
      });
      setAmount("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  };

  const onClose = async () => {
    setError(null);
    setPending("close");
    try {
      await closeListing(connection, wallet, { bondMint: mint });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5">
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Manage listing
      </p>

      <form onSubmit={onAdd} className="mt-3 flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Add supply (whole bonds)
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={pending !== null || isClosed}
            placeholder="100"
            className="rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={pending !== null || isClosed}
          className="inline-flex w-fit items-center gap-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending === "add" ? "Adding…" : "Add to listing"}
        </button>
      </form>

      <hr className="my-4 border-black/5 dark:border-white/5" />

      <button
        type="button"
        onClick={onClose}
        disabled={pending !== null || isClosed}
        className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-500/50 disabled:opacity-50 dark:text-red-300"
      >
        {pending === "close"
          ? "Closing…"
          : isClosed
            ? "Listing closed"
            : "Close listing (terminal)"}
      </button>

      {error && <ErrorBox>{error}</ErrorBox>}
    </div>
  );
}

function PayCouponsPanel({
  token,
  mint,
  holders,
  onDone,
}: {
  token: StoredDebtBond;
  mint: PublicKey;
  holders: import("@/lib/program/useDetails").HolderAccount[];
  onDone: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const tokens = useSyncExternalStore(
    subscribeTokens,
    getTokensSnapshot,
    getTokensServerSnapshot,
  );
  const stables = useMemo(() => tokens.filter(isStableCoin), [tokens]);
  const [paymentMint, setPaymentMint] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const paymentToken = stables.find((s) => s.mint === paymentMint) ?? null;

  const pendingAbstract = useMemo(() => {
    let total = 0n;
    for (const h of holders) {
      const bondsHeld = BigInt(h.account.bondsHeld.toString());
      const paid = BigInt(h.account.couponsPaid.toString());
      const owed =
        (BigInt(token.nominalValue) *
          BigInt(token.interestRatePct) *
          BigInt(token.durationYears) *
          bondsHeld) /
        100n;
      const pending = owed > paid ? owed - paid : 0n;
      total += pending;
    }
    return total;
  }, [holders, token]);

  const holdersWithPending = useMemo(
    () =>
      holders.filter((h) => {
        const bondsHeld = BigInt(h.account.bondsHeld.toString());
        const paid = BigInt(h.account.couponsPaid.toString());
        const owed =
          (BigInt(token.nominalValue) *
            BigInt(token.interestRatePct) *
            BigInt(token.durationYears) *
            bondsHeld) /
          100n;
        return owed > paid;
      }),
    [holders, token],
  );

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!paymentToken) return setError("Pick a coin to pay coupons with.");
    if (holdersWithPending.length === 0)
      return setError("No holders have a pending coupon.");

    setPending(true);
    try {
      const { paidHolders } = await payAllCoupons(connection, wallet, {
        bondMint: mint,
        paymentMint: new PublicKey(paymentToken.mint),
        holders: holdersWithPending,
      });
      setDone(`Paid ${paidHolders} holder(s).`);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/5"
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Pay all coupons
      </p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Owed amounts are in abstract units. The chosen coin&apos;s decimals
        scale the on-chain transfer. Pending across all holders:{" "}
        <span className="font-mono text-zinc-700 dark:text-zinc-200">
          {pendingAbstract.toString()}
        </span>{" "}
        {paymentToken?.symbol ? `≈ ${pendingAbstract.toString()} ${paymentToken.symbol}` : ""}
      </p>

      <label className="mt-3 flex flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Pay with
        </span>
        <select
          value={paymentMint}
          onChange={(e) => setPaymentMint(e.target.value)}
          disabled={pending}
          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-900"
        >
          <option value="">— Pick a stable coin —</option>
          {stables.map((s) => (
            <option key={s.mint} value={s.mint}>
              {s.name} ({s.symbol})
            </option>
          ))}
        </select>
      </label>

      {error && <ErrorBox>{error}</ErrorBox>}
      {done && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-300">
          {done}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || holdersWithPending.length === 0}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending
          ? "Paying…"
          : `Pay ${holdersWithPending.length} holder(s)`}
      </button>
    </form>
  );
}

// ============================================================================
// Purchase form
// ============================================================================

function PurchaseForm({
  token,
  mint,
  listing,
  onPurchased,
}: {
  token: StoredDebtBond;
  mint: PublicKey;
  listing: ListingAccount;
  onPurchased: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokens = useSyncExternalStore(
    subscribeTokens,
    getTokensSnapshot,
    getTokensServerSnapshot,
  );
  const paymentToken =
    tokens.find((t) => t.mint === listing.paymentMint.toBase58()) ?? null;

  const max = Number(listing.available.toString());
  const isActive = listing.status === LISTING_STATUS.Active;

  const n = parseInt(amount || "0", 10);
  const totalAtomicStr =
    Number.isInteger(n) && n > 0
      ? listing.unitPrice.muln(n).toString()
      : "0";
  const totalHuman =
    paymentToken && Number.isInteger(n) && n > 0
      ? atomicToHuman(listing.unitPrice.muln(n), paymentToken.decimals)
      : "0";

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!isActive) return setError("Listing is not active.");
    if (!Number.isInteger(n) || n <= 0)
      return setError("Amount must be a positive whole number.");
    if (n > max) return setError(`Only ${max} bonds available.`);

    const issuerPk = tryPubkey(token.issuer);
    if (!issuerPk) return setError("Invalid issuer address in local record.");

    setPending(true);
    try {
      await purchaseBond(connection, wallet, {
        bondMint: mint,
        paymentMint: listing.paymentMint,
        issuer: issuerPk,
        amount: new BN(n),
      });
      setAmount("");
      onPurchased();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6 dark:border-emerald-400/30 dark:bg-emerald-400/[0.04]"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
        Purchase bonds
      </h2>
      {!isActive ? (
        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
          Listing is not currently accepting purchases ({listingStatusLabel(listing.status)}).
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
            Up to {max} bonds available at{" "}
            {paymentToken
              ? `${atomicToHuman(listing.unitPrice, paymentToken.decimals)} ${paymentToken.symbol}`
              : "the listing's price"}{" "}
            each.
          </p>

          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Number of bonds
            </span>
            <input
              type="number"
              min={1}
              max={max}
              step={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={pending}
              placeholder="1"
              className="rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-zinc-900"
            />
          </label>

          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
            Total cost:{" "}
            <span className="font-mono text-zinc-900 dark:text-zinc-100">
              {totalHuman} {paymentToken?.symbol ?? ""}
            </span>{" "}
            <span className="text-zinc-400">
              ({totalAtomicStr} atomic units)
            </span>
          </p>

          {error && <ErrorBox>{error}</ErrorBox>}

          <button
            type="submit"
            disabled={pending}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            {pending ? "Purchasing…" : "Purchase"}
          </button>
        </>
      )}
    </form>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="text-sm text-zinc-900 dark:text-zinc-50">{children}</dd>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
      {children}
    </p>
  );
}

/** Convert a `BN` atomic amount to a human string using `decimals`. */
function atomicToHuman(amount: BN, decimals: number): string {
  if (decimals === 0) return amount.toString();
  const s = amount.toString();
  if (s.length <= decimals) {
    const padded = s.padStart(decimals + 1, "0");
    const intPart = padded.slice(0, -decimals);
    const frac = padded.slice(-decimals).replace(/0+$/, "");
    return frac ? `${intPart}.${frac}` : intPart;
  }
  const intPart = s.slice(0, -decimals);
  const frac = s.slice(-decimals).replace(/0+$/, "");
  return frac ? `${intPart}.${frac}` : intPart;
}

/** Parse a human number to a BN atomic amount, or `null` if it has too many decimals. */
function humanToAtomic(value: number, decimals: number): BN | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  const str = String(value);
  const [intPart, fracPartRaw = ""] = str.split(".");
  if (fracPartRaw.length > decimals) return null;
  const fracPart = fracPartRaw.padEnd(decimals, "0");
  const combined = `${intPart}${fracPart}`.replace(/^0+(?=\d)/, "");
  if (combined === "") return new BN(0);
  return new BN(combined);
}

void formatAmount;
