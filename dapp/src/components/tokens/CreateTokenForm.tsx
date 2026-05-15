"use client";

import { FormEvent, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { createSplToken } from "@/lib/createToken";
import {
  StoredToken,
  TokenKind,
  addToken,
  computeBondTerms,
  formatAmount,
  formatDate,
} from "@/lib/tokens";

type Props = {
  onCreated: (created: StoredToken) => void;
  onCancel: () => void;
};

type FormState = {
  kind: TokenKind;
  name: string;
  symbol: string;
  decimals: string;
  initialSupply: string;
  nominalValue: string;
  interestRatePct: string;
  durationYears: string;
};

const initialState: FormState = {
  kind: "stable",
  name: "",
  symbol: "",
  decimals: "6",
  initialSupply: "",
  nominalValue: "1000",
  interestRatePct: "5",
  durationYears: "4",
};

function parseNumber(value: string): number {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function CreateTokenForm({ onCreated, onCancel }: Props) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [state, setState] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const update =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) =>
      setState((prev) => ({ ...prev, [key]: value }));

  const bondPreview = useMemo(() => {
    if (state.kind !== "bond") return null;
    const nominalValue = parseNumber(state.nominalValue);
    const interestRatePct = parseNumber(state.interestRatePct);
    const durationYears = parseNumber(state.durationYears);
    const { annualCoupon, totalCoupons, maturityDate } = computeBondTerms({
      nominalValue,
      interestRatePct,
      durationYears,
    });
    return {
      annualCoupon,
      totalCoupons,
      maturityDate,
      nominalValue,
      interestRatePct,
      durationYears,
    };
  }, [state.kind, state.nominalValue, state.interestRatePct, state.durationYears]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!wallet.publicKey) {
      setError("Connect a wallet first.");
      return;
    }

    const name = state.name.trim();
    const symbol = state.symbol.trim().toUpperCase();
    if (!name) return setError("Name is required.");
    if (!symbol) return setError("Symbol is required.");
    if (symbol.length > 10) return setError("Symbol must be 10 chars or fewer.");

    const initialSupply = parseNumber(state.initialSupply);
    if (!(initialSupply > 0)) return setError("Initial supply must be > 0.");

    const decimals =
      state.kind === "stable" ? parseInt(state.decimals, 10) : 0;
    if (state.kind === "stable") {
      if (!Number.isInteger(decimals) || decimals < 0 || decimals > 9) {
        return setError("Decimals must be an integer between 0 and 9.");
      }
    }

    let bondTerms: ReturnType<typeof computeBondTerms> | null = null;
    let bondInputs: {
      nominalValue: number;
      interestRatePct: number;
      durationYears: number;
    } | null = null;
    if (state.kind === "bond") {
      const nominalValue = parseNumber(state.nominalValue);
      const interestRatePct = parseNumber(state.interestRatePct);
      const durationYears = parseNumber(state.durationYears);
      if (!(nominalValue > 0)) return setError("Nominal value must be > 0.");
      if (interestRatePct < 0)
        return setError("Interest rate cannot be negative.");
      if (!(durationYears > 0)) return setError("Duration must be > 0 years.");
      bondInputs = { nominalValue, interestRatePct, durationYears };
      bondTerms = computeBondTerms(bondInputs);
    }

    setPending(true);
    try {
      const { mint, signature } = await createSplToken(connection, wallet, {
        decimals,
        initialSupply,
      });

      const createdAt = Date.now();
      const base = {
        mint: mint.toBase58(),
        name,
        symbol,
        decimals,
        initialSupply,
        issuer: wallet.publicKey.toBase58(),
        signature,
        createdAt,
      } as const;

      const token: StoredToken =
        state.kind === "bond" && bondInputs && bondTerms
          ? {
              ...base,
              kind: "bond",
              nominalValue: bondInputs.nominalValue,
              interestRatePct: bondInputs.interestRatePct,
              durationYears: bondInputs.durationYears,
              annualCoupon: bondTerms.annualCoupon,
              totalCoupons: bondTerms.totalCoupons,
              maturityDate: bondTerms.maturityDate,
            }
          : { ...base, kind: "stable" };

      addToken(token);
      onCreated(token);
      setState(initialState);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create the token.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  if (!wallet.publicKey) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white/70 p-6 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect a wallet to create tokens.
        </p>
        <div className="mt-4 flex justify-center">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-2xl border border-black/10 bg-white/70 p-6 shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_40px_-20px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Create token
          </h3>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Choose a type and fill in the details. The mint authority is your
            connected wallet.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-xs font-medium text-zinc-500 transition hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Close
        </button>
      </div>

      <div className="mt-5 inline-flex rounded-xl border border-black/10 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
        {(["stable", "bond"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => update("kind")(kind)}
            disabled={pending}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
              state.kind === kind
                ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {kind === "stable" ? "Stable coin" : "Debt bond"}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Token name" htmlFor="name">
          <Input
            id="name"
            value={state.name}
            onChange={(v) => update("name")(v)}
            placeholder="Euro Stable Coin"
            disabled={pending}
          />
        </Field>
        <Field label="Symbol" htmlFor="symbol">
          <Input
            id="symbol"
            value={state.symbol}
            onChange={(v) => update("symbol")(v.toUpperCase())}
            placeholder="EURC"
            disabled={pending}
            maxLength={10}
          />
        </Field>

        {state.kind === "stable" ? (
          <>
            <Field label="Decimals" htmlFor="decimals">
              <Input
                id="decimals"
                type="number"
                min={0}
                max={9}
                step={1}
                value={state.decimals}
                onChange={(v) => update("decimals")(v)}
                disabled={pending}
              />
            </Field>
            <Field label="Initial supply" htmlFor="initialSupply">
              <Input
                id="initialSupply"
                type="number"
                min={0}
                step="any"
                value={state.initialSupply}
                onChange={(v) => update("initialSupply")(v)}
                placeholder="1000000"
                disabled={pending}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Initial supply (bonds)" htmlFor="initialSupply">
              <Input
                id="initialSupply"
                type="number"
                min={0}
                step={1}
                value={state.initialSupply}
                onChange={(v) => update("initialSupply")(v)}
                placeholder="100"
                disabled={pending}
              />
            </Field>
            <Field label="Nominal value" htmlFor="nominalValue">
              <Input
                id="nominalValue"
                type="number"
                min={0}
                step="any"
                value={state.nominalValue}
                onChange={(v) => update("nominalValue")(v)}
                disabled={pending}
              />
            </Field>
            <Field label="Interest rate (%/yr)" htmlFor="interestRatePct">
              <Input
                id="interestRatePct"
                type="number"
                min={0}
                step="any"
                value={state.interestRatePct}
                onChange={(v) => update("interestRatePct")(v)}
                disabled={pending}
              />
            </Field>
            <Field label="Duration (years)" htmlFor="durationYears">
              <Input
                id="durationYears"
                type="number"
                min={0}
                step="any"
                value={state.durationYears}
                onChange={(v) => update("durationYears")(v)}
                disabled={pending}
              />
            </Field>
          </>
        )}
      </div>

      {state.kind === "bond" && bondPreview && (
        <div className="mt-6 rounded-xl border border-black/10 bg-zinc-50/80 p-4 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            Bond summary (per unit)
          </p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <SummaryRow
              label="Annual coupon"
              value={formatAmount(bondPreview.annualCoupon)}
            />
            <SummaryRow
              label="Total coupons"
              value={formatAmount(bondPreview.totalCoupons)}
            />
            <SummaryRow
              label="Maturity date"
              value={formatDate(bondPreview.maturityDate)}
            />
          </dl>
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {pending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
              Minting…
            </>
          ) : (
            "Create token"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="text-sm font-medium text-zinc-500 transition hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500"
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Input({
  id,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
  min,
  max,
  step,
  maxLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number | string;
  maxLength?: number;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      maxLength={maxLength}
      className="w-full rounded-xl border border-black/10 bg-white/80 px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
    />
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
        {value}
      </dd>
    </div>
  );
}
