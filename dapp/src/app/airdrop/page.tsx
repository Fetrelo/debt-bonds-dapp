import Link from "next/link";
import { AirdropForm } from "@/components/AirdropForm";
import { WalletStatusCard } from "@/components/WalletStatusCard";

export default function AirdropPage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center gap-10 px-4 py-16 sm:px-6 sm:py-20">
      <div className="flex w-full max-w-xl flex-col gap-5">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to home
        </Link>

        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-700 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Faucet
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
            Request <span className="text-gradient">SOL</span> for your wallet.
          </h1>
          <p className="text-pretty text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Drop test SOL into the connected wallet. Works on localnet (with
            <code className="mx-1 rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs dark:bg-white/10">
              solana-test-validator
            </code>
            running) and on devnet, where the faucet is rate-limited.
          </p>
        </div>
      </div>

      <WalletStatusCard />
      <AirdropForm />
    </section>
  );
}
