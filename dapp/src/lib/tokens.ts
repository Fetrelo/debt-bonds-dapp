export type TokenKind = "stable" | "bond";

type StoredTokenBase = {
  mint: string;
  kind: TokenKind;
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: number;
  issuer: string;
  signature: string;
  createdAt: number;
};

export type StoredStableCoin = StoredTokenBase & {
  kind: "stable";
};

export type StoredDebtBond = StoredTokenBase & {
  kind: "bond";
  nominalValue: number;
  interestRatePct: number;
  durationYears: number;
  maturityDate: number;
  annualCoupon: number;
  totalCoupons: number;
  /**
   * `true` once the bond has a `BondConfig` PDA on-chain. Bonds created
   * before the on-chain registry feature shipped will have this `false`
   * and must be migrated via the `register_bond` instruction before they
   * can be listed/purchased.
   */
  onChainRegistered: boolean;
  /** Cached `BondConfig` PDA address, set after registration/creation. */
  bondConfigPda?: string;
};

export type StoredToken = StoredStableCoin | StoredDebtBond;

const STORAGE_KEY = "debt-bonds.tokens.v1";
const EMPTY: StoredToken[] = [];

let cache: StoredToken[] | null = null;
const listeners = new Set<() => void>();

function readFromStorage(): StoredToken[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed as StoredToken[];
  } catch {
    return EMPTY;
  }
}

function writeToStorage(tokens: StoredToken[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

export function getTokensSnapshot(): StoredToken[] {
  if (cache === null) cache = readFromStorage();
  return cache;
}

export function getTokensServerSnapshot(): StoredToken[] {
  return EMPTY;
}

export function subscribeTokens(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function addToken(token: StoredToken): void {
  const next = [token, ...getTokensSnapshot()];
  cache = next;
  writeToStorage(next);
  listeners.forEach((l) => l());
}

export function getTokenByMint(mint: string): StoredToken | undefined {
  return getTokensSnapshot().find((t) => t.mint === mint);
}

export function updateToken(
  mint: string,
  patch: Partial<StoredToken>,
): StoredToken | undefined {
  const tokens = getTokensSnapshot();
  const idx = tokens.findIndex((t) => t.mint === mint);
  if (idx === -1) return undefined;
  const merged = { ...tokens[idx], ...patch } as StoredToken;
  const next = [...tokens.slice(0, idx), merged, ...tokens.slice(idx + 1)];
  cache = next;
  writeToStorage(next);
  listeners.forEach((l) => l());
  return merged;
}

export function computeBondTerms(input: {
  nominalValue: number;
  interestRatePct: number;
  durationYears: number;
  createdAt?: number;
}) {
  const { nominalValue, interestRatePct, durationYears } = input;
  const createdAt = input.createdAt ?? Date.now();
  const annualCoupon = (interestRatePct / 100) * nominalValue;
  const totalCoupons = annualCoupon * durationYears;

  const maturity = new Date(createdAt);
  const wholeYears = Math.floor(durationYears);
  const fractionalDays = Math.round((durationYears - wholeYears) * 365.25);
  maturity.setFullYear(maturity.getFullYear() + wholeYears);
  maturity.setDate(maturity.getDate() + fractionalDays);

  return {
    annualCoupon,
    totalCoupons,
    maturityDate: maturity.getTime(),
  };
}

export function formatAmount(value: number, maxFractionDigits = 4): string {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: maxFractionDigits,
  }).format(value);
}

export function formatDate(timestamp: number): string {
  if (!Number.isFinite(timestamp)) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(timestamp));
}

export function truncateMiddle(value: string, head = 4, tail = 4): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}
