import Link from "next/link";
import { TokensClient } from "@/components/tokens/TokensClient";

export default function TokensPage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20">
      <div className="flex flex-col gap-5">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to home
        </Link>

        <div className="flex flex-col gap-3">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-700 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Tokens
          </span>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl dark:text-zinc-50">
            Mint <span className="text-gradient">stable coins</span> and{" "}
            <span className="text-gradient">debt bonds</span>.
          </h1>
          <p className="max-w-2xl text-pretty text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Each create flow ships a single SPL token mint, your wallet&apos;s
            associated token account, and the initial supply in one
            transaction. The connected wallet is the mint authority.
          </p>
        </div>
      </div>

      <TokensClient />
    </section>
  );
}
