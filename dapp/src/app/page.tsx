import { WalletStatusCard } from "@/components/WalletStatusCard";

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center gap-12 px-4 py-20 sm:px-6 sm:py-28">
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
    </section>
  );
}
