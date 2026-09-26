// Pure helpers for the Interactive Routing Wire (HubGraph + DashboardView).
// Dependency-free and erasable-syntax only so they can also be unit-tested
// directly with `node --test` via Node type-stripping (no build step needed).

export const ACTIVE_WINDOW_MS = 60000;

export interface MemberKeyRef {
  id: string;
  fullKey: string;
}

export interface ActiveReq {
  provider?: string;
  account?: string;
  accountName?: string;
  model?: string;
  count?: number;
}

export function shortLabel(name: string): string {
  const clean = (name || "?").trim();
  if (clean.length <= 2) return clean.toUpperCase();
  const parts = clean.split(/[\s\-_\/]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

export function maskKey(key: string): string {
  const k = (key || "").trim();
  if (!k || k === "-") return "-";
  if (k.endsWith("...")) return k;
  if (k.length <= 12) return k;
  return `${k.slice(0, 10)}...`;
}

export function matchMemberId(members: MemberKeyRef[], masked: string): string | null {
  if (!masked || masked === "-") return null;
  const prefix = masked.replace(/(\.{3}|\*{3})$/, "").replace(/\*+$/, "");
  if (!prefix || prefix.length < 6) return null;
  const m = members.find((x) => x.fullKey.startsWith(prefix));
  return m ? m.id : null;
}

/** Normalized provider name: lowercase alphanumeric only ("Kiro AI" -> "kiroai"). */
export function normProv(name: string): string {
  return (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function provIdFor(name: string): string {
  const slug = (name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `prov-${slug || "unknown"}`;
}

/**
 * Do two provider labels refer to the same box? Exact normalized match, or
 * one is a prefix of the other with the shorter side >= 4 chars.
 * ("kiro" vs "Kiro AI" match; "ant" vs "antigravity" do not.)
 */
export function provLabelsMatch(a: string, b: string): boolean {
  const na = normProv(a);
  const nb = normProv(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const short = na.length <= nb.length ? na : nb;
  const long = na.length <= nb.length ? nb : na;
  return short.length >= 4 && long.startsWith(short);
}

export function fadeOpacity(ageMs: number): number {
  if (ageMs < 40000) return 1;
  return Math.max(0.3, 1 - ((ageMs - 40000) / 20000) * 0.7);
}

/** Relative time like 9Router native: "just now", "8m ago", "1h ago", "2d ago". */
export function timeAgo(ts: number, nowMs?: number): string {
  const now = nowMs ?? Date.now();
  const s = Math.max(0, Math.floor((now - ts) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Stable signature of the in-flight set, for bail-out comparisons. */
export function activeReqsSignature(list: ActiveReq[]): string {
  if (!Array.isArray(list)) return "";
  return list
    .map((a) => [a.provider || "", a.account || a.accountName || "", a.model || "", a.count || 0].join("|"))
    .sort()
    .join(";");
}

export function sameActiveReqs(a: ActiveReq[], b: ActiveReq[]): boolean {
  return activeReqsSignature(a) === activeReqsSignature(b);
}
