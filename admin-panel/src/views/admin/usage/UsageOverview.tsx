import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, UsageStatsResponse, UsageDetailItem } from "@/lib/api";
import { cn, formatNumber, formatCurrency } from "@/lib/utils";
import {
  RefreshCw,
  ChevronRight,
  Search,
  Eye,
  Loader2,
  Activity,
  Radio,
  Server,
  Zap,
  TrendingUp,
  Cpu,
  Layers,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import {
  PERIODS,
  GROUP_MODES,
  nf,
  usd,
  timeAgo,
  lastUsed,
  enrichEntry,
  sortEntries,
  humanProvider,
} from "./usage-helpers";

interface UsageOverviewProps {
  period: string;
  setPeriod: (p: string) => void;
}

export function UsageOverview({ period, setPeriod }: UsageOverviewProps) {
  const [stats, setStats] = useState<UsageStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [periodLoading, setPeriodLoading] = useState(false);

  // Grouped table controls
  const [groupMode, setGroupMode] = useState("model");
  const [viewMode, setViewMode] = useState<"costs" | "tokens">("costs");
  const [sortBy, setSortBy] = useState("rawModel");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Detail drawer
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const isFirstLoad = useRef(true);
  const hasLoadedOnce = useRef(false);

  // --- Fetch stats ---
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      setLoading(true);
    } else {
      setPeriodLoading(true);
    }

    api
      .getUsageStats(period)
      .then((res) => {
        setStats(res);
        hasLoadedOnce.current = true;
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
        setPeriodLoading(false);
      });
  }, [period]);

  // --- SSE live stream ---
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/usage/stream");
      es.onmessage = (e) => {
        if (!e.data || e.data.startsWith(":")) return;
        try {
          const payload = JSON.parse(e.data);
          setStats((prev) =>
            prev
              ? {
                  ...prev,
                  activeRequests: payload.activeRequests ?? prev.activeRequests,
                  recentRequests: payload.recentRequests ?? prev.recentRequests,
                  errorProvider: payload.errorProvider ?? prev.errorProvider,
                  pending: payload.pending ?? prev.pending,
                }
              : prev
          );
        } catch {}
      };
    } catch {}
    return () => {
      if (es) es.close();
    };
  }, []);

  // --- 1s ticker so relative times stay fresh ---
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`usage-stats:expanded-${groupMode}`);
      setExpanded(new Set(raw ? JSON.parse(raw) : []));
    } catch {
      setExpanded(new Set());
    }
  }, [groupMode]);

  useEffect(() => {
    try {
      localStorage.setItem(`usage-stats:expanded-${groupMode}`, JSON.stringify([...expanded]));
    } catch {}
  }, [expanded, groupMode]);

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleToggleSort = (tableType: string, field: string) => {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  };

  // --- Build grouped table model (mirrors upstream logic) ---
  const tableModel = useMemo(() => {
    if (!stats) return null;

    const groupBy = (record: Record<string, any> | undefined, fieldFn: (v: any) => string) => {
      const groups: Record<string, any> = {};
      for (const [key, raw] of Object.entries(record || {})) {
        const groupKey = fieldFn(raw);
        if (!groups[groupKey]) {
          groups[groupKey] = {
            groupKey,
            summary: {
              requests: 0,
              promptTokens: 0,
              completionTokens: 0,
              cachedTokens: 0,
              totalTokens: 0,
              cost: 0,
              inputCost: 0,
              cachedCost: 0,
              outputCost: 0,
              lastUsed: null,
              pending: 0,
            },
            items: [],
          };
        }
        const item = enrichEntry(key, raw, 0, sortBy, sortOrder);
        const s = groups[groupKey].summary;
        s.requests += item.requests || 0;
        s.promptTokens += item.promptTokens || 0;
        s.completionTokens += item.completionTokens || 0;
        s.cachedTokens += item.cachedTokens || 0;
        s.totalTokens += item.totalTokens || 0;
        s.cost += item.cost || 0;
        s.inputCost += item.inputCost || 0;
        s.cachedCost += item.cachedCost || 0;
        s.outputCost += item.outputCost || 0;
        if (item.lastUsed && (!s.lastUsed || new Date(item.lastUsed) > new Date(s.lastUsed))) {
          s.lastUsed = item.lastUsed;
        }
        groups[groupKey].items.push(item);
      }
      return Object.values(groups).sort((a: any, b: any) => {
        const x = String(a.groupKey).toLowerCase();
        const y = String(b.groupKey).toLowerCase();
        return x < y ? -1 : x > y ? 1 : 0;
      });
    };

    switch (groupMode) {
      case "model":
        return {
          columns: [
            { field: "rawModel", label: "Model" },
            { field: "provider", label: "Provider" },
            { field: "requests", label: "Requests", align: "right" },
            { field: "lastUsed", label: "Last Used", align: "right" },
          ],
          groupedData: groupBy(stats.byModel, (v) => v.rawModel || "Unknown Model"),
          emptyMessage: "No usage recorded yet.",
        };
      case "account":
        return {
          columns: [
            { field: "accountName", label: "Account" },
            { field: "rawModel", label: "Model" },
            { field: "provider", label: "Provider" },
            { field: "requests", label: "Requests", align: "right" },
            { field: "lastUsed", label: "Last Used", align: "right" },
          ],
          groupedData: groupBy(stats.byAccount, (v) => v.accountName || `Account ${String(v.connectionId).slice(0, 8)}...`),
          emptyMessage: "No account-specific usage recorded yet.",
        };
      case "apiKey":
        return {
          columns: [
            { field: "keyName", label: "API Key Name" },
            { field: "rawModel", label: "Model" },
            { field: "provider", label: "Provider" },
            { field: "requests", label: "Requests", align: "right" },
            { field: "lastUsed", label: "Last Used", align: "right" },
          ],
          groupedData: groupBy(stats.byApiKey, (v) => v.keyName || v.apiKeyMasked || "Unknown Key"),
          emptyMessage: "No API key usage recorded yet.",
        };
      default:
        return {
          columns: [
            { field: "endpoint", label: "Endpoint" },
            { field: "rawModel", label: "Model" },
            { field: "provider", label: "Provider" },
            { field: "requests", label: "Requests", align: "right" },
            { field: "lastUsed", label: "Last Used", align: "right" },
          ],
          groupedData: groupBy(stats.byEndpoint, (v) => v.endpoint || "Unknown Endpoint"),
          emptyMessage: "No endpoint usage recorded yet.",
        };
    }
  }, [stats, groupMode, sortBy, sortOrder]);

  const loadingSpinner = (
    <div className="flex items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Period selector */}
      <div className="flex w-full items-center gap-2 sm:w-auto sm:self-end">
        <div className="grid flex-1 grid-cols-6 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 sm:flex sm:flex-none">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              disabled={periodLoading}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                period === p.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodLoading && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
      </div>

      {/* 5 stat cards */}
      {loading || !stats ? (
        loadingSpinner
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 sm:gap-4">
          <StatCard label="Total Requests" value={nf(stats.totalRequests)} />
          <StatCard label="Total Input Tokens" value={nf(stats.totalPromptTokens)} tone="primary" />
          <StatCard label="Cached Tokens" value={nf(stats.totalCachedTokens)} tone="info" />
          <StatCard label="Output Tokens" value={nf(stats.totalCompletionTokens)} tone="success" />
          <StatCard
            label="Est. Cost"
            value={`~${usd(stats.totalCost)}`}
            tone="warning"
            hint="Estimated, not actual billing"
          />
        </div>
      )}

      {/* Usage wire + recent requests */}
      {loading || !stats ? (
        loadingSpinner
      ) : (
        <div className="grid min-w-0 grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <UsageWire
            stats={stats}
            activeRequests={stats.activeRequests || []}
            errorProvider={stats.errorProvider || ""}
          />
          <RecentRequests requests={stats.recentRequests || []} />
        </div>
      )}

      {/* Grouped breakdown table */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <select
            value={groupMode}
            onChange={(e) => setGroupMode(e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 sm:w-auto"
          >
            {GROUP_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1 sm:flex">
            {(["costs", "tokens"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors",
                  viewMode === m
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {loading || !tableModel ? (
          loadingSpinner
        ) : (
          <GroupedTable
            columns={tableModel.columns}
            groupedData={tableModel.groupedData}
            tableType={groupMode}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onToggleSort={handleToggleSort}
            viewMode={viewMode}
            expanded={expanded}
            onToggleGroup={toggleExpanded}
            emptyMessage={tableModel.emptyMessage}
            onOpenDetail={(item) => {
              setDetailItem(item as any);
              setDetailOpen(true);
            }}
          />
        )}
      </div>

      {/* Request detail drawer */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Usage Entry Detail</DialogTitle>
            <DialogDescription>Aggregated bucket from the live gateway telemetry.</DialogDescription>
          </DialogHeader>
          {detailItem && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs py-2">
              <DetailRow label="Record Key" value={String(detailItem.id ?? (detailItem as any).key ?? "-")} mono />
              <DetailRow
                label="Last Used"
                value={(detailItem as any).lastUsed ? new Date((detailItem as any).lastUsed).toLocaleString() : "-"}
              />
              <DetailRow label="Provider" value={humanProvider(detailItem.provider)} />
              <DetailRow label="Model" value={detailItem.model || (detailItem as any).rawModel || "-"} mono />
              <DetailRow label="Requests" value={nf(detailItem.requests)} />
              <DetailRow label="Total Cost" value={usd(detailItem.totalCost ?? detailItem.cost)} />
              <DetailRow label="Input Tokens" value={nf(detailItem.promptTokens)} />
              <DetailRow label="Cached Tokens" value={detailItem.cachedTokens ? nf(detailItem.cachedTokens) : "—"} />
              <DetailRow label="Output Tokens" value={nf(detailItem.completionTokens)} />
              <DetailRow label="Total Tokens" value={nf(detailItem.totalTokens)} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "primary" | "info" | "success" | "warning";
  hint?: string;
}) {
  const toneCls = {
    default: "text-foreground",
    primary: "text-primary",
    info: "text-cyan-600 dark:text-cyan-400",
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
  }[tone];

  return (
    <Card className="flex min-w-0 flex-col items-center text-center gap-1 px-4 py-4 shadow-2xs border-border">
      <span className="text-muted-foreground text-[11px] uppercase font-bold tracking-wider">{label}</span>
      <span className={cn("w-full truncate text-xl font-bold font-mono", toneCls)} title={value}>
        {value}
      </span>
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </Card>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground block text-[11px] uppercase font-semibold">{label}</span>
      <span className={cn("break-all text-foreground", mono && "font-mono")}>{value}</span>
    </div>
  );
}

/* ---------------------- Usage Wire (SVG topology) ---------------------- */

function UsageWire({
  stats,
  activeRequests,
  errorProvider,
}: {
  stats: UsageStatsResponse;
  activeRequests: any[];
  errorProvider: string;
}) {
  const hasError = !!errorProvider;
  const isActive = activeRequests.length > 0;
  const lastProvider = stats.recentRequests?.[0]?.provider || "gateway";

  const providerCount = Object.keys(stats.byProvider || {}).length;
  const modelCount = Object.keys(stats.byModel || {}).length;

  return (
    <Card className="flex min-w-0 flex-col overflow-hidden shadow-2xs border-border">
      <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/20">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Usage Wire
        </span>
        <Badge
          variant={hasError ? "destructive" : isActive ? "success" : "outline"}
          className="font-mono text-[10px] font-bold"
        >
          {hasError ? "UPSTREAM ERROR" : isActive ? `${activeRequests.length} IN-FLIGHT` : "IDLE"}
        </Badge>
      </div>

      <CardContent className="p-0 flex-1">
        <div
          className="h-[440px] w-full relative overflow-hidden bg-[#fafafa] dark:bg-[#0c0c0e]"
          style={{
            backgroundImage: "radial-gradient(circle, rgba(160,160,160,0.18) 1.2px, transparent 1.2px)",
            backgroundSize: "18px 18px",
          }}
        >
          <div className="w-full h-full flex items-center justify-between px-8 relative">
            {/* Client node */}
            <div className="w-40 p-3 rounded-xl border border-border bg-card shadow-2xs z-10">
              <div className="flex items-center gap-2 pb-2 border-b border-border/70">
                <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <Server className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-foreground">Clients</span>
              </div>
              <div className="pt-2 text-[10px] font-mono text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Ready</span>
                  <span className="text-emerald-600 font-bold">Yes</span>
                </div>
              </div>
            </div>

            {/* Gateway core */}
            <div
              className={cn(
                "w-48 p-4 rounded-2xl border-2 bg-card shadow-md z-10 text-center transition-all",
                hasError
                  ? "border-destructive ring-4 ring-destructive/20"
                  : isActive
                  ? "border-primary ring-4 ring-primary/20"
                  : "border-primary/70"
              )}
            >
              <Radio
                className={cn(
                  "w-6 h-6 mx-auto",
                  hasError ? "text-destructive" : "text-primary",
                  isActive && "animate-pulse"
                )}
              />
              <div className="text-xs font-bold text-foreground mt-1.5">9Router Gateway</div>
              <div className="text-[10px] text-muted-foreground font-mono">:20128</div>
              <div className="mt-2 py-1 px-2 rounded bg-muted/60 text-[10px] font-mono flex justify-between">
                <span className="text-muted-foreground">Requests</span>
                <span className="font-bold text-foreground">{nf(stats.totalRequests)}</span>
              </div>
            </div>

            {/* Upstream node */}
            <div className="w-40 p-3 rounded-xl border border-border bg-card shadow-2xs z-10">
              <div className="flex items-center gap-2 pb-2 border-b border-border/70">
                <div className="w-6 h-6 rounded bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-foreground">Upstream</span>
              </div>
              <div className="pt-2 text-[10px] font-mono text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Providers</span>
                  <span className="text-foreground font-bold">{providerCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Models</span>
                  <span className="text-cyan-600 font-bold">{modelCount}</span>
                </div>
              </div>
            </div>

            {/* Connecting wires */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" strokeWidth={2}>
              <line x1="21%" y1="50%" x2="36%" y2="50%" className="stroke-border" />
              <line x1="65%" y1="50%" x2="79%" y2="50%" className="stroke-border" />
              {(isActive || hasError) && (
                <>
                  <line
                    x1="21%"
                    y1="50%"
                    x2="36%"
                    y2="50%"
                    className={cn("rf-edge-flow-active", hasError ? "stroke-destructive" : "stroke-emerald-500")}
                    strokeWidth={2.5}
                  />
                  <line
                    x1="65%"
                    y1="50%"
                    x2="79%"
                    y2="50%"
                    className={cn("rf-edge-flow-cyan", hasError ? "stroke-destructive" : "stroke-cyan-500")}
                    strokeWidth={2.5}
                  />
                </>
              )}
            </svg>

            {/* Provider label */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-muted-foreground">
              last: <span className="text-foreground font-semibold">{humanProvider(lastProvider)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------- Recent requests list ------------------------- */

function RecentRequests({ requests }: { requests: any[] }) {
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden shadow-2xs border-border" style={{ height: 480 }}>
      <div className="px-4 py-2.5 border-b border-border shrink-0">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Recent Requests
        </span>
      </div>

      {requests.length ? (
        <div className="flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="py-2 px-3 text-left font-semibold text-muted-foreground w-2"></th>
                <th className="py-2 text-left font-semibold text-muted-foreground">Model</th>
                <th className="py-2 text-right font-semibold text-muted-foreground whitespace-nowrap pr-3">In / Out</th>
                <th className="py-2 text-right font-semibold text-muted-foreground pr-3">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {requests.map((r, i) => {
                const ok = !r.status || r.status === "ok" || r.status === "success";
                return (
                  <tr key={i} className="hover:bg-muted/40 transition-colors">
                    <td className="py-1.5 px-3">
                      <span className={cn("block w-1.5 h-1.5 rounded-full", ok ? "bg-emerald-500" : "bg-destructive")} />
                    </td>
                    <td className="py-1.5 font-mono truncate max-w-[130px] text-foreground" title={r.model}>
                      {r.model}
                    </td>
                    <td className="py-1.5 text-right whitespace-nowrap">
                      <span className="text-primary">{nf(r.promptTokens)}↑</span>{" "}
                      <span className="text-emerald-600 dark:text-emerald-400">{nf(r.completionTokens)}↓</span>
                    </td>
                    <td className="py-1.5 text-right text-muted-foreground whitespace-nowrap pr-3">
                      {timeAgo(r.timestamp)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No requests yet.
        </div>
      )}
    </Card>
  );
}

/* ------------------------ Grouped expandable table ------------------------ */

function SortIndicator({
  field,
  sortBy,
  sortOrder,
}: {
  field: string;
  sortBy: string;
  sortOrder: string;
}) {
  if (sortBy !== field) return <span className="ml-1 opacity-20">↕</span>;
  return <span className="ml-1">{sortOrder === "asc" ? "↑" : "↓"}</span>;
}

function MetricCells({
  item,
  viewMode,
  isSummary,
}: {
  item: any;
  viewMode: "costs" | "tokens";
  isSummary?: boolean;
}) {
  if (viewMode === "tokens") {
    return (
      <>
        <TableCell className="px-6 py-2.5 text-right text-muted-foreground font-mono text-xs">
          {isSummary && item.promptTokens === undefined ? "—" : nf(item.promptTokens)}
        </TableCell>
        <TableCell className="px-6 py-2.5 text-right text-muted-foreground font-mono text-xs">
          {item.cachedTokens ? nf(item.cachedTokens) : "—"}
        </TableCell>
        <TableCell className="px-6 py-2.5 text-right text-muted-foreground font-mono text-xs">
          {isSummary && item.completionTokens === undefined ? "—" : nf(item.completionTokens)}
        </TableCell>
        <TableCell className="px-6 py-2.5 text-right font-medium font-mono text-xs text-foreground">
          {nf(item.totalTokens)}
        </TableCell>
      </>
    );
  }

  return (
    <>
      <TableCell className="px-6 py-2.5 text-right text-muted-foreground font-mono text-xs">
        {isSummary && item.inputCost === undefined ? "—" : usd(item.inputCost)}
      </TableCell>
      <TableCell className="px-6 py-2.5 text-right text-muted-foreground font-mono text-xs">
        {item.cachedCost ? usd(item.cachedCost) : "—"}
      </TableCell>
      <TableCell className="px-6 py-2.5 text-right text-muted-foreground font-mono text-xs">
        {isSummary && item.outputCost === undefined ? "—" : usd(item.outputCost)}
      </TableCell>
      <TableCell className="px-6 py-2.5 text-right font-bold font-mono text-xs text-amber-600 dark:text-amber-400">
        {usd(item.totalCost || item.cost)}
      </TableCell>
    </>
  );
}

function GroupedTable({
  columns,
  groupedData,
  tableType,
  sortBy,
  sortOrder,
  onToggleSort,
  viewMode,
  expanded,
  onToggleGroup,
  emptyMessage,
  onOpenDetail,
}: {
  columns: any[];
  groupedData: any[];
  tableType: string;
  sortBy: string;
  sortOrder: string;
  onToggleSort: (t: string, f: string) => void;
  viewMode: "costs" | "tokens";
  expanded: Set<string>;
  onToggleGroup: (k: string) => void;
  emptyMessage: string;
  onOpenDetail: (item: any) => void;
}) {
  const metricCols =
    viewMode === "tokens"
      ? [
          { field: "promptTokens", label: "Input Tokens" },
          { field: "cachedTokens", label: "Cached" },
          { field: "completionTokens", label: "Output Tokens" },
          { field: "totalTokens", label: "Total Tokens" },
        ]
      : [
          { field: "promptTokens", label: "Input Cost" },
          { field: "cachedCost", label: "Cached Cost" },
          { field: "completionTokens", label: "Output Cost" },
          { field: "cost", label: "Total Cost" },
        ];

  const totalCols = columns.length + metricCols.length + 1;

  const renderDetailCells = (item: any) => {
    switch (tableType) {
      case "model":
        return (
          <>
            <TableCell className={cn("px-6 py-2.5 font-medium text-xs", item.pending > 0 ? "text-primary" : "text-foreground")}>
              {item.rawModel}
            </TableCell>
            <TableCell className="px-6 py-2.5">
              <Badge variant={item.pending > 0 ? "default" : "outline"} className="text-[10px] font-mono font-semibold">
                {humanProvider(item.provider)}
              </Badge>
            </TableCell>
            <TableCell className="px-6 py-2.5 text-right font-mono text-xs text-foreground">{nf(item.requests)}</TableCell>
            <TableCell className="px-6 py-2.5 text-right text-muted-foreground whitespace-nowrap text-xs">
              {lastUsed(item.lastUsed)}
            </TableCell>
          </>
        );
      case "account":
        return (
          <>
            <TableCell className={cn("px-6 py-2.5 font-medium text-xs", item.pending > 0 ? "text-primary" : "text-foreground")}>
              {item.accountName || `Account ${String(item.connectionId).slice(0, 8)}...`}
            </TableCell>
            <TableCell className="px-6 py-2.5 font-medium text-xs text-foreground">{item.rawModel}</TableCell>
            <TableCell className="px-6 py-2.5">
              <Badge variant="outline" className="text-[10px] font-mono font-semibold">
                {humanProvider(item.provider)}
              </Badge>
            </TableCell>
            <TableCell className="px-6 py-2.5 text-right font-mono text-xs text-foreground">{nf(item.requests)}</TableCell>
            <TableCell className="px-6 py-2.5 text-right text-muted-foreground whitespace-nowrap text-xs">
              {lastUsed(item.lastUsed)}
            </TableCell>
          </>
        );
      case "apiKey":
        return (
          <>
            <TableCell className="px-6 py-2.5 font-medium text-xs text-foreground">{item.keyName || item.apiKeyMasked}</TableCell>
            <TableCell className="px-6 py-2.5 text-xs text-foreground">{item.rawModel}</TableCell>
            <TableCell className="px-6 py-2.5">
              <Badge variant="outline" className="text-[10px] font-mono font-semibold">
                {humanProvider(item.provider)}
              </Badge>
            </TableCell>
            <TableCell className="px-6 py-2.5 text-right font-mono text-xs text-foreground">{nf(item.requests)}</TableCell>
            <TableCell className="px-6 py-2.5 text-right text-muted-foreground whitespace-nowrap text-xs">
              {lastUsed(item.lastUsed)}
            </TableCell>
          </>
        );
      default:
        return (
          <>
            <TableCell className="px-6 py-2.5 font-medium font-mono text-xs text-foreground">{item.endpoint}</TableCell>
            <TableCell className="px-6 py-2.5 text-xs text-foreground">{item.rawModel}</TableCell>
            <TableCell className="px-6 py-2.5">
              <Badge variant="outline" className="text-[10px] font-mono font-semibold">
                {humanProvider(item.provider)}
              </Badge>
            </TableCell>
            <TableCell className="px-6 py-2.5 text-right font-mono text-xs text-foreground">{nf(item.requests)}</TableCell>
            <TableCell className="px-6 py-2.5 text-right text-muted-foreground whitespace-nowrap text-xs">
              {lastUsed(item.lastUsed)}
            </TableCell>
          </>
        );
    }
  };

  return (
    <Card className="overflow-hidden shadow-2xs border-border">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px]">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.field}
                  onClick={() => onToggleSort(tableType, c.field)}
                  className={cn(
                    "px-6 py-3 cursor-pointer hover:bg-muted/60 font-bold whitespace-nowrap",
                    c.align === "right" && "text-right"
                  )}
                >
                  {c.label} <SortIndicator field={c.field} sortBy={sortBy} sortOrder={sortOrder} />
                </th>
              ))}
              {metricCols.map((c) => (
                <th
                  key={c.field + c.label}
                  onClick={() => onToggleSort(tableType, c.field)}
                  className="px-6 py-3 text-right cursor-pointer hover:bg-muted/60 font-bold whitespace-nowrap"
                >
                  {c.label} <SortIndicator field={c.field} sortBy={sortBy} sortOrder={sortOrder} />
                </th>
              ))}
              <th className="px-6 py-3 text-right font-bold whitespace-nowrap">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {groupedData.map((group) => (
              <React.Fragment key={group.groupKey}>
                {/* Summary row */}
                <tr
                  className="cursor-pointer hover:bg-muted/50 transition-colors bg-muted/20"
                  onClick={() => onToggleGroup(group.groupKey)}
                >
                  <TableCell className="px-6 py-3" colSpan={columns.length}>
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={cn(
                          "w-4 h-4 text-muted-foreground transition-transform",
                          expanded.has(group.groupKey) && "rotate-90"
                        )}
                      />
                      <span
                        className={cn(
                          "font-semibold text-xs",
                          group.summary.pending > 0 ? "text-primary" : "text-foreground"
                        )}
                      >
                        {group.groupKey}
                      </span>
                      <Badge variant="outline" className="text-[9px] font-mono ml-1">
                        {group.items.length}
                      </Badge>
                    </div>
                  </TableCell>
                  <MetricCells item={group.summary} viewMode={viewMode} isSummary />
                  <TableCell className="px-6 py-3 text-right">
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {lastUsed(group.summary.lastUsed)}
                    </span>
                  </TableCell>
                </tr>

                {/* Detail rows */}
                {expanded.has(group.groupKey) &&
                  group.items.map((item: any) => (
                    <tr key={String(item.key)} className="hover:bg-muted/30 transition-colors">
                      {renderDetailCells(item)}
                      <MetricCells item={item} viewMode={viewMode} />
                      <TableCell className="px-6 py-2.5 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenDetail(item)}
                          className="h-6 px-2 text-[10px] font-semibold gap-1"
                        >
                          <Eye className="w-2.5 h-2.5" />
                          View
                        </Button>
                      </TableCell>
                    </tr>
                  ))}
              </React.Fragment>
            ))}

            {groupedData.length === 0 && (
              <tr>
                <TableCell colSpan={totalCols} className="px-6 py-10 text-center text-muted-foreground text-xs">
                  {emptyMessage}
                </TableCell>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
