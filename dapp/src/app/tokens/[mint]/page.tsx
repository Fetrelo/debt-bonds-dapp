import Link from "next/link";
import { TokenDetailsClient } from "@/components/tokens/details/TokenDetailsClient";

type Props = {
  params: Promise<{ mint: string }>;
};

export default async function TokenDetailsPage({ params }: Props) {
  const { mint } = await params;
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex items-center gap-3">
        <Link
          href="/tokens"
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to tokens
        </Link>
      </div>
      <TokenDetailsClient mint={mint} />
    </section>
  );
}
