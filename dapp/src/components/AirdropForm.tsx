"use client";

import { FormEvent, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { RPC_ENDPOINT } from "@/lib/cluster";

const QUICK_AMOUNTS = [1, 2, 5];
const MAX_AMOUNT = 10;

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "success"; signature: string; sol: number }
  | { kind: "error"; message: string };

function buildExplorerUrl(signature: string, endpoint: string): string | null {
  const lower = endpoint.toLowerCase();
  if (lower.includes("devnet")) {
    return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
  }
  if (lower.includes("testnet")) {
    return `https://explorer.solana.com/tx/${signature}?cluster=testnet`;
  }
  if (lower.includes("mainnet") || lower.includes("api.solana.com")) {
    return `https://explorer.solana.com/tx/${signature}`;
  }
  if (
    lower.includes("localhost") ||
    lower.includes("127.0.0.1") ||
    lower.includes("0.0.0.0")
  ) {
    return `https://explorer.solana.com/tx/${signature}?cluster=custom&customUrl=${encodeURIComponent(
      endpoint,
    )}`;
  }
  return null;
}

export function AirdropForm() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [amount, setAmount] = useState<number>(1);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const explorerUrl = useMemo(() => {
    if (status.kind !== "success") return null;
    return buildExplorerUrl(status.signature, RPC_ENDPOINT);
  }, [status]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!publicKey) return;
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus({ kind: "error", message: "Amount must be greater than 0." });
      return;
    }
    if (amount > MAX_AMOUNT) {
      setStatus({
        kind: "error",
        message: `Amount must be at most ${MAX_AMOUNT} SOL.`,
      });
      return;
    }

    setStatus({ kind: "pending" });
    try {
      const lamports = Math.round(amount * LAMPORTS_PER_SOL);
      const signature = await connection.requestAirdrop(publicKey, lamports);
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed",
      );
      setStatus({ kind: "success", signature, sol: amount });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Airdrop failed. The faucet may be rate-limited.";
      setStatus({ kind: "error", message });
    }
  };

  if (!publicKey) {
    return (
      <div className="w-full max-w-xl rounded-2xl border border-black/10 bg-white/70 p-6 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connect a wallet to request an airdrop.
        </p>
        <div className="mt-4 flex justify-center">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  const pending = status.kind === "pending";

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-xl space-y-5 rounded-2xl border border-black/10 bg-white/70 p-6 shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_40px_-20px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5"
    >
      <div>
        <label
          htmlFor="amount"
          className="block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-500"
        >
          Amount (SOL)
        </label>
        <input
          id="amount"
          type="number"
          min={0.1}
          max={MAX_AMOUNT}
          step={0.1}
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          disabled={pending}
          className="mt-2 w-full rounded-xl border border-black/10 bg-white/80 px-4 py-3 font-mono text-base text-zinc-900 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/30 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {QUICK_AMOUNTS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              disabled={pending}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition disabled:opacity-50 ${
                amount === value
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-black/10 bg-white/60 text-zinc-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              {value} SOL
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
            Requesting…
          </>
        ) : (
          <>Request airdrop</>
        )}
      </button>

      {status.kind === "success" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
            Airdropped {status.sol} SOL.
          </p>
          <p className="mt-2 break-all font-mono text-xs text-emerald-700/80 dark:text-emerald-200/80">
            {status.signature}
          </p>
          {explorerUrl && (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
              View on Solana Explorer ↗
            </a>
          )}
        </div>
      )}

      {status.kind === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {status.message}
          </p>
          <p className="mt-1 text-xs text-red-700/80 dark:text-red-300/80">
            Tip: localnet faucets are unlimited; devnet is rate-limited to 2
            SOL per request and a few requests per hour.
          </p>
        </div>
      )}
    </form>
  );
}
