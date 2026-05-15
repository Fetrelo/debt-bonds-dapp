"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { mintStableCoin } from "@/lib/createToken";
import { StoredStableCoin, formatAmount, truncateMiddle } from "@/lib/tokens";

export function StableCoinActions({
  token,
  isIssuer,
}: {
  token: StoredStableCoin;
  isIssuer: boolean;
}) {
  const wallet = useWallet();
  const { connection } = useConnection();
  const mintPk = useMemo(() => new PublicKey(token.mint), [token.mint]);
  const walletPkBase = wallet.publicKey?.toBase58() ?? null;

  const [balance, setBalance] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!walletPkBase) {
        if (!cancelled) setBalance(null);
        return;
      }
      const ata = getAssociatedTokenAddressSync(
        mintPk,
        new PublicKey(walletPkBase),
      );
      const info = await connection
        .getTokenAccountBalance(ata)
        .catch(() => null);
      if (cancelled) return;
      setBalance(info ? Number(info.value.uiAmountString ?? "0") : 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [walletPkBase, connection, mintPk, tick]);

  const onMinted = () => setTick((t) => t + 1);

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-6 backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Your balance
        </h2>
        <button
          type="button"
          onClick={() => setTick((t) => t + 1)}
          disabled={!wallet.publicKey}
          className="text-xs font-medium text-zinc-500 transition hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          Refresh
        </button>
      </div>
      <p className="mt-2 font-mono text-2xl tracking-tight text-zinc-900 dark:text-zinc-50">
        {wallet.publicKey
          ? balance === null
            ? "—"
            : `${formatAmount(balance, token.decimals)} ${token.symbol}`
          : "Connect a wallet"}
      </p>

      <hr className="my-5 border-black/5 dark:border-white/5" />

      {isIssuer ? (
        <MintPanel token={token} onMinted={onMinted} />
      ) : (
        <NonIssuerPanel token={token} />
      )}
    </div>
  );
}

function MintPanel({
  token,
  onMinted,
}: {
  token: StoredStableCoin;
  onMinted: () => void;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState<string>("");
  const [recipient, setRecipient] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const useMyAddress = () => {
    if (wallet.publicKey) setRecipient(wallet.publicKey.toBase58());
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const amountNum = parseFloat(amount);
    if (!(amountNum > 0)) return setError("Amount must be greater than zero.");

    const recipientStr = recipient.trim() || wallet.publicKey?.toBase58() || "";
    let recipientPk: PublicKey;
    try {
      recipientPk = new PublicKey(recipientStr);
    } catch {
      return setError("Recipient is not a valid public key.");
    }

    setPending(true);
    try {
      await mintStableCoin(connection, wallet, {
        mint: new PublicKey(token.mint),
        recipient: recipientPk,
        amount: amountNum,
        decimals: token.decimals,
      });
      setSuccess(
        `Minted ${formatAmount(amountNum, token.decimals)} ${token.symbol} to ${truncateMiddle(
          recipientPk.toBase58(),
          4,
          4,
        )}.`,
      );
      setAmount("");
      onMinted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Airdrop / mint
      </h3>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        You hold the mint authority for this stable coin. Send any amount to
        any address — defaults to your own wallet.
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Amount
          </span>
          <input
            type="number"
            min={0}
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={pending}
            placeholder="1000"
            className="rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-sm dark:border-white/10 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="flex items-center justify-between text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Recipient
            <button
              type="button"
              onClick={useMyAddress}
              disabled={pending || !wallet.publicKey}
              className="text-[11px] font-medium text-zinc-500 underline-offset-2 transition hover:text-zinc-900 hover:underline disabled:opacity-50 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Use my address
            </button>
          </span>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={pending}
            placeholder={wallet.publicKey?.toBase58() ?? "Recipient public key"}
            className="rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-xs dark:border-white/10 dark:bg-zinc-900"
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-xs text-emerald-700 dark:text-emerald-300">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
      >
        {pending ? "Minting…" : "Airdrop"}
      </button>
    </form>
  );
}

function NonIssuerPanel({ token }: { token: StoredStableCoin }) {
  const wallet = useWallet();
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Airdrop / mint
      </h3>
      {!wallet.publicKey ? (
        <div className="mt-3 flex flex-col items-start gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Connect a wallet to view your balance.
          </p>
          <WalletMultiButton />
        </div>
      ) : (
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          Only the issuer ({truncateMiddle(token.issuer, 6, 6)}) holds the
          mint authority for this coin. Ask them to airdrop you some, or
          switch wallets if you are the issuer.
        </p>
      )}
    </div>
  );
}
