import Link from "next/link";
import { WalletStatusCard } from "@/components/WalletStatusCard";

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-16 px-4 py-20 sm:px-6 sm:py-24">
      <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-medium text-zinc-700 backdrop-blur-md dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Solana Localnet
        </span>

        <h1 className="text-balance text-5xl font-semibold tracking-tight text-zinc-950 sm:text-6xl dark:text-zinc-50">
          Issue and trade <span className="text-gradient">debt bonds</span> on
          Solana.
        </h1>

        <p className="max-w-xl text-pretty text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          A minimal dApp scaffold built with Next.js and Anchor. Connect a
          wallet to get started — the rest of the program is on its way.
        </p>
      </div>

      <WalletStatusCard />

      <div className="w-full max-w-3xl">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-500">
            Quick actions
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/airdrop"
            className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_40px_-20px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-emerald-400 text-base font-bold text-white shadow-sm">
                ◎
              </span>
              <span className="text-xs text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
                →
              </span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Request SOL
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Top up the connected wallet with test SOL from the faucet.
              </p>
            </div>
          </Link>

          <Link
            href="/tokens"
            className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-black/10 bg-white/70 p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_1px_0_rgba(0,0,0,0.02),0_20px_40px_-20px_rgba(0,0,0,0.2)] dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
          >
            <div className="flex items-center justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-400 to-violet-500 text-base font-bold text-white shadow-sm">
                ◈
              </span>
              <span className="text-xs text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700 dark:group-hover:text-zinc-200">
                →
              </span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Create tokens
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Mint stable coins and debt bonds, browse what you&apos;ve
                created.
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
