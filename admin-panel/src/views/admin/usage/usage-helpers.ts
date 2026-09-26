// Shared helpers for the Usage & Analytics page (mirrors 9Router dashboard/usage)

export const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
  { value: "all", label: "All" },
];

export const GROUP_MODES = [
  { value: "model", label: "Usage by Model" },
  { value: "account", label: "Usage by Account" },
  { value: "apiKey", label: "Usage by API Key" },
  { value: "endpoint", label: "Usage by Endpoint" },
];

export const nf = (n?: number) => new Intl.NumberFormat().format(n || 0);
export const usd = (n?: number) => `$${(n || 0).toFixed(2)}`;

/** "3m ago" style relative time, ticking every second via caller re-render */
export function timeAgo(ts?: string): string {
  if (!ts) return "Never";
  const diffSec = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diffSec < 10) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** Long form used in group summary columns */
export function lastUsed(ts?: string): string {
  if (!ts) return "Never";
  const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export function getCachedTokens(tokens: any): number {
  return tokens?.cached_tokens || tokens?.cache_read_input_tokens || 0;
}

export function getCacheCreation(tokens: any): number {
  return tokens?.cache_creation_input_tokens || 0;
}

/** Input token normaliser: uses the larger of prompt_tokens vs cached */
export function getInputTokens(tokens: any): number {
  const prompt = tokens?.prompt_tokens || tokens?.input_tokens || 0;
  const cached = getCachedTokens(tokens);
  return cached > prompt ? cached : prompt;
}

/** Enrich a raw bucket entry with derived cost splits */
export function enrichEntry(key: string, v: any, pending = 0, sortBy = "rawModel", sortOrder = "asc") {
  const totalTokens = (v.promptTokens || 0) + (v.completionTokens || 0);
  const totalCost = v.cost || 0;
  const cachedTokens = v.cachedTokens || 0;
  const uncached = Math.max(0, (v.promptTokens || 0) - cachedTokens);
  const outputCost = totalTokens > 0 ? (v.completionTokens || 0) * (totalCost / totalTokens) : 0;

  return {
    ...v,
    key,
    totalTokens,
    totalCost,
    inputCost: totalTokens > 0 ? (totalCost / totalTokens) * uncached : 0,
    cachedCost: totalTokens > 0 ? (totalCost / totalTokens) * cachedTokens : 0,
    outputCost,
    pending,
  };
}

export function sortEntries(entries: any[], sortBy: string, sortOrder: string) {
  return entries.sort((a, b) => {
    let x = a[sortBy];
    let y = b[sortBy];
    if (typeof x === "string") x = x.toLowerCase();
    if (typeof y === "string") y = y.toLowerCase();
    if (x < y) return sortOrder === "asc" ? -1 : 1;
    if (x > y) return sortOrder === "asc" ? 1 : -1;
    return 0;
  });
}

export function humanProvider(id?: string): string {
  if (!id) return "unknown";
  const PRETTY: Record<string, string> = {
    kiro: "Kiro AI",
    antigravity: "Antigravity",
    fireworks: "Fireworks AI",
    openai: "OpenAI",
    "codebuddy-intl": "CodeBuddy Intl",
  };
  return PRETTY[id] || id;
}

/** Human-readable latency: null means no timing data captured */
export function latencyLabel(ttft?: number, total?: number): { ttft: number | null; total: number | null } {
  return {
    ttft: ttft && ttft > 0 ? ttft : null,
    total: total && total > 0 ? total : null,
  };
}
