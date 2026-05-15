import Link from "next/link";
import { WalletConnectButton } from "@/components/WalletConnectButton";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/5 bg-white/70 backdrop-blur-xl dark:border-white/10 dark:bg-black/40">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-fuchsia-500 via-violet-500 to-emerald-400 text-sm font-bold text-white shadow-sm">
            DB
          </span>
          <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Debt Bonds
          </span>
          <span className="hidden rounded-full border border-black/10 bg-white/60 px-2 py-0.5 text-[11px] font-medium text-zinc-600 sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            Solana · Localnet
          </span>
        </Link>

        <WalletConnectButton />
      </div>
    </header>
  );
}
