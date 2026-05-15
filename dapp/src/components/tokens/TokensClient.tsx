"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { CreateTokenForm } from "@/components/tokens/CreateTokenForm";
import { TokensTable } from "@/components/tokens/TokensTable";
import {
  StoredToken,
  getTokensServerSnapshot,
  getTokensSnapshot,
  subscribeTokens,
  truncateMiddle,
} from "@/lib/tokens";

type TabId = "all" | "stable" | "bond";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "stable", label: "Stable coins" },
  { id: "bond", label: "Debt bonds" },
];

export function TokensClient() {
  const tokens = useSyncExternalStore(
    subscribeTokens,
    getTokensSnapshot,
    getTokensServerSnapshot,
  );
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [justCreated, setJustCreated] = useState<StoredToken | null>(null);

  const counts = useMemo(
    () => ({
      all: tokens.length,
      stable: tokens.filter((t) => t.kind === "stable").length,
      bond: tokens.filter((t) => t.kind === "bond").length,
    }),
    [tokens],
  );

  const visible = useMemo(() => {
    if (activeTab === "all") return tokens;
    return tokens.filter((t) => t.kind === activeTab);
  }, [tokens, activeTab]);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-black/10 bg-white/60 p-1 dark:border-white/10 dark:bg-white/5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeTab === tab.id
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeTab === tab.id
                    ? "bg-white/20 text-white dark:bg-zinc-900/20 dark:text-zinc-900"
                    : "bg-black/5 text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
                }`}
              >
                {counts[tab.id]}
              </span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            setFormOpen((open) => !open);
            setJustCreated(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {formOpen ? "Close form" : "Create token"}
        </button>
      </div>

      {justCreated && !formOpen && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">
            Minted {justCreated.name} ({justCreated.symbol}).
          </p>
          <p className="mt-1 font-mono text-xs text-emerald-700/80 dark:text-emerald-200/80">
            Mint {truncateMiddle(justCreated.mint, 6, 6)}
          </p>
        </div>
      )}

      {formOpen && (
        <CreateTokenForm
          onCreated={(created) => {
            setFormOpen(false);
            setJustCreated(created);
            setActiveTab(created.kind === "stable" ? "stable" : "bond");
          }}
          onCancel={() => setFormOpen(false)}
        />
      )}

      <TokensTable tokens={visible} />
    </div>
  );
}
