import React, { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, UsageSummaryResponse, RequestLogsResponse } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/utils";
import {
  shortLabel,
  maskKey,
  matchMemberId,
  provIdFor,
  provLabelsMatch,
  activeReqsSignature,
  timeAgo,
} from "@/lib/graph-helpers";
import {
  Activity,
  Radio,
  RefreshCw,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Coins,
  Layers,
} from "lucide-react";
import { UsageTimelineChart } from "@/components/ui/usage-timeline-chart";
import { HubGraph } from "@/components/graph/HubGraph";

interface LiveFeedItem {
  id: string;
  timestamp: string;
  /** Epoch ms — untuk kolom "When" relatif ala native. */
  ts: number;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  status: string;
  latencyMs?: number;
}

const GRAPH_COLORS = [
  { bg: "#f1f5f9", fg: "#64748b" },
  { bg: "#18181b", fg: "#fafafa" },
  { bg: "#fdf2f8", fg: "#db2777" },
  { bg: "#fff7ed", fg: "#ea580c" },
  { bg: "#ede9fe", fg: "#7c3aed" },
  { bg: "#eff6ff", fg: "#2563eb" },
];

const RIGHT_COLORS = [
  { bg: "#ecfeff", fg: "#0e7490" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fef9c3", fg: "#a16207" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#f1f5f9", fg: "#475569" },
];

export function DashboardView() {
  const [period, setPeriod] = useState("today");
  const [subTab, setSubTab] = useState<"overview" | "logs">("overview");
  const [showFlow, setShowFlow] = useState(true);
  const [chartMetric, setChartMetric] = useState<"tokens" | "cost">("tokens");
  const [summary, setSummary] = useState<UsageSummaryResponse | null>(null);
  const [logsData, setLogsData] = useState<RequestLogsResponse | null>(null);
  const [logsFilter, setLogsFilter] = useState("all");
  const [logsSearch, setLogsSearch] = useState("");
  const [logsPage, setLogsPage] = useState(1);

  // Equalizer & Realtime State
  const [eqBars, setEqBars] = useState<number[]>(() => new Array(36).fill(12));
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const [streamSpeed, setStreamSpeed] = useState("0 req/min");
  const [streamTokSpeed, setStreamTokSpeed] = useState("0 tok/5s");

  // In-flight & Flow state (satu-satunya driver highlight: activatePath)
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [activeLeftId, setActiveLeftId] = useState<string | null>(null);
  const [activeRightId, setActiveRightId] = useState<string | null>(null);
  const [metaVersion, setMetaVersion] = useState(0);

  // Activity-window registries: only providers/keys with recent traffic are shown
  const provMetaRef = useRef(new Map<string, { label: string; sub: string; short: string; bg: string; fg: string }>());
  const provSeenRef = useRef(new Map<string, number>());
  const keyMetaRef = useRef(new Map<string, { label: string; sub: string; short: string; bg: string; fg: string; fullKey: string }>());
  const keySeenRef = useRef(new Map<string, number>());
  const memberKeysRef = useRef<{ id: string; fullKey: string }[]>([]);
  const lastLogIdRef = useRef("");
  const activeSigRef = useRef("");
  const colorIdxRef = useRef(0);

  const speedCountRef = useRef(0);
  const tokenCountRef = useRef(0);
  const seenKeysRef = useRef(new Set<string>());

  // Cari box provider yang sudah ada (dipakai seed + touch biar tidak dobel)
  const findProvId = (name: string): string | null => {
    const clean = (name || "").trim();
    if (!clean) return null;
    for (const [id, meta] of provMetaRef.current.entries()) {
      if (provLabelsMatch(meta.label || "", clean)) return id;
    }
    return null;
  };

  const touchProvider = (name: string, sub?: string) => {
    const clean = (name || "").trim();
    if (!clean) return null;
    const existing = findProvId(clean);
    if (existing) {
      provSeenRef.current.set(existing, Date.now());
      return existing;
    }
    const id = provIdFor(clean);
    if (!provMetaRef.current.has(id)) {
      const c = GRAPH_COLORS[colorIdxRef.current++ % GRAPH_COLORS.length];
      provMetaRef.current.set(id, { label: clean, sub: sub || "live", short: shortLabel(clean), bg: c.bg, fg: c.fg });
    }
    provSeenRef.current.set(id, Date.now());
    return id;
  };

  const touchKey = (id: string, label: string, sub: string, fullKey = "") => {
    if (!keyMetaRef.current.has(id)) {
      const c = RIGHT_COLORS[colorIdxRef.current++ % RIGHT_COLORS.length];
      keyMetaRef.current.set(id, { label, sub, short: shortLabel(label), bg: c.bg, fg: c.fg, fullKey });
    }
    keySeenRef.current.set(id, Date.now());
    return id;
  };

  // Jalur client -> hub -> pool menyala bareng ala 9Router.
  // Dipanggil dari poll live (activeRequests + byApiKey) maupun realtime item.
  const pathTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activatePath = (provider: string, poolAccount = "", clientLabel = "", clientSub = "", clientFullKey = "") => {
    const leftId = provider ? touchProvider(provider, poolAccount || undefined) : null;
    let rightId: string | null = null;
    if (clientLabel) {
      const mid = clientFullKey ? matchMemberId(memberKeysRef.current, clientSub || clientFullKey) : null;
      if (mid) {
        const meta = keyMetaRef.current.get(mid);
        touchKey(mid, meta?.label || clientLabel, meta?.sub || clientSub || clientLabel);
        rightId = mid;
      } else {
        const dynId = `key-live-${(clientSub || clientLabel).replace(/[^a-z0-9]+/gi, "-").slice(0, 24)}`;
        touchKey(dynId, clientLabel, clientSub || "customer key", clientFullKey);
        rightId = dynId;
      }
    }
    if (leftId) setActiveLeftId(leftId);
    if (rightId) setActiveRightId(rightId);
    if (pathTimeoutRef.current) clearTimeout(pathTimeoutRef.current);
    pathTimeoutRef.current = setTimeout(() => {
      if (leftId) setActiveLeftId((prev) => (prev === leftId ? null : prev));
      if (rightId) setActiveRightId((prev) => (prev === rightId ? null : prev));
    }, 2600);
  };

  // 1. SSE Realtime Stream Connection (/api/usage/stream)
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/usage/stream");
      es.onmessage = (e) => {
        if (!e.data || e.data.startsWith(":")) return;
        try {
          const item = JSON.parse(e.data);
          handleRealtimeItem(item);
        } catch {}
      };
      es.onerror = () => {
        try { es?.close(); } catch {}
        es = null;
      };
    } catch {
      es = null;
    }

    const ticker = setInterval(() => {
      setStreamSpeed(`${speedCountRef.current * 12} req/min`);
      setStreamTokSpeed(`${tokenCountRef.current.toLocaleString()} tok/5s`);
      speedCountRef.current = 0;
      tokenCountRef.current = 0;

      setEqBars((prev) => {
        const next = [...prev.slice(1)];
        next.push(Math.floor(Math.random() * 8) + 8);
        return next;
      });
    }, 5000);

    return () => {
      if (es) es.close();
      clearInterval(ticker);
    };
  }, []);

  const handleRealtimeItem = (item: any) => {
    const key = `${item.timestamp || ""}|${item.model || ""}|${item.provider || ""}|${item.promptTokens || 0}|${item.completionTokens || 0}`;
    if (seenKeysRef.current.has(key)) return;
    seenKeysRef.current.add(key);
    if (seenKeysRef.current.size > 250) {
      const first = seenKeysRef.current.values().next().value;
      if (first) seenKeysRef.current.delete(first);
    }

    speedCountRef.current += 1;
    const totalTok = (item.promptTokens || 0) + (item.completionTokens || 0);
    tokenCountRef.current += totalTok;

    const pct = Math.min(100, Math.max(18, Math.round((totalTok / 3500) * 100)));
    setEqBars((prev) => {
      const next = [...prev.slice(1)];
      next.push(pct);
      return next;
    });

    // Highlight kiri langsung (responsif), kaki kanan menyusul dari poll live.
    // Satu pintu via activatePath biar tidak rebutan timeout.
    if (item.provider) activatePath(item.provider, item.account || "", "", "", "");

    const feedItem: LiveFeedItem = {
      id: String(Date.now()) + Math.random(),
      timestamp: item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
      ts: (() => {
        const t = item.timestamp ? new Date(item.timestamp).getTime() : NaN;
        return Number.isFinite(t) ? (t as number) : Date.now();
      })(),
      provider: item.provider || "AI",
      model: item.model || "unknown",
      promptTokens: item.promptTokens || 0,
      completionTokens: item.completionTokens || 0,
      costUsd: item.cost || 0,
      status: item.status || "ok",
      latencyMs: item.latencyMs || item.duration || 0,
    };

    setLiveFeed((prev) => [feedItem, ...prev.slice(0, 24)]);
  };

  const fetchSummary = async (p = period) => {
    try {
      const data = await api.getUsageSummary(p);
      setSummary(data);
    } catch {}
  };

  const fetchLogs = async (page = logsPage, filter = logsFilter, search = logsSearch) => {
    try {
      const data = await api.getRequestLogs(page, 25, filter, search);
      setLogsData(data);
    } catch {}
  };

  useEffect(() => {
    const pollLive = async () => {
      try {
        const res = await fetch(`/api/live/usage?period=${period}`).then((r) => r.json());
        if (res.ok && res.live) {
          const actives = res.live.activeRequests || [];
          // Bail-out: jangan re-render dashboard kalau set in-flight tidak berubah
          const sig = activeReqsSignature(actives);
          if (sig !== activeSigRef.current) {
            activeSigRef.current = sig;
            setActiveRequests(actives);
          }
          const recents = res.live.recentRequests || [];
          for (const item of recents.slice(0, 5)) {
            handleRealtimeItem(item);
          }
          // Nyalakan jalur client -> hub -> pool dari data in-flight.
          // activeRequests: [{ provider, account, model }], byApiKey: { "mask|model|prov": { keyName, apiKeyMasked, provider, lastUsed } }
          const byApiKey = res.live.byApiKey || {};
          const apiEntries = Object.values(byApiKey) as any[];
          for (const a of actives.slice(0, 3)) {
            const provider = a.provider || "";
            const poolAccount = a.account || a.accountName || "";
            const sameProv = apiEntries
              .filter((e) => !provider || (e.provider || "").toLowerCase() === provider.toLowerCase())
              .sort((x, y) => new Date(y.lastUsed || 0).getTime() - new Date(x.lastUsed || 0).getTime());
            const best = sameProv[0] || apiEntries.sort((x, y) => new Date(y.lastUsed || 0).getTime() - new Date(x.lastUsed || 0).getTime())[0];
            const clientLabel = best?.keyName || best?.apiKeyKey || "client";
            const clientSub = best?.apiKeyMasked || best?.apiKeyKey || "";
            if (provider || clientLabel) activatePath(provider, poolAccount, clientLabel, clientSub, clientSub);
          }
          // Kalau tidak ada in-flight tapi ada traffic <60s, tetap pulskan jalur terakhir biar tidak gelap total.
          if (actives.length === 0 && apiEntries.length > 0) {
            const fresh = apiEntries
              .map((e) => ({ e, age: Date.now() - new Date(e.lastUsed || 0).getTime() }))
              .filter((x) => x.age < 60000)
              .sort((a, b) => a.age - b.age)[0];
            if (fresh && recents.length > 0) {
              const provider = fresh.e.provider || recents[0].provider || "";
              const clientLabel = fresh.e.keyName || fresh.e.apiKeyKey || "client";
              const clientSub = fresh.e.apiKeyMasked || "";
              activatePath(provider, "", clientLabel, clientSub, clientSub);
            }
          }
        }
      } catch {}
    };

    pollLive();
    const interval = setInterval(pollLive, 2000);
    return () => clearInterval(interval);
  }, [period]);

  useEffect(() => {
    fetchSummary(period);
    fetchLogs();
  }, [period]);

  // Register provider rack (left, selalu tampil semua) + customer key metadata (right, dinamis)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let changed = false;
      try {
        const p = await api.getProviders();
        if (!cancelled && p.nodes && p.nodes.length > 0) {
          for (const n of p.nodes) {
            const name = n.name || n.prefix || n.id;
            const sub = `${n.accountActive ?? 0}/${n.accountCount ?? 0} keys`;
            const eid = findProvId(name);
            if (eid) {
              // Refresh info keys; tidak bikin box baru (dedupe sama seperti touch)
              const m = provMetaRef.current.get(eid);
              if (m && m.sub !== sub) {
                m.sub = sub;
                changed = true;
              }
              continue;
            }
            const id = provIdFor(name);
            if (!provMetaRef.current.has(id)) {
              const c = GRAPH_COLORS[colorIdxRef.current++ % GRAPH_COLORS.length];
              provMetaRef.current.set(id, {
                label: name,
                sub,
                short: shortLabel(name),
                bg: c.bg,
                fg: c.fg,
              });
              changed = true;
            }
          }
        }
      } catch {}
      try {
        const m = await api.getMembers();
        if (!cancelled && m.members && m.members.length > 0) {
          memberKeysRef.current = m.members.map((x) => ({ id: `key-${x.id}`, fullKey: x.key || "" }));
          for (const x of m.members) {
            const id = `key-${x.id}`;
            if (!keyMetaRef.current.has(id)) {
              const c = RIGHT_COLORS[colorIdxRef.current++ % RIGHT_COLORS.length];
              const nm = x.name || "Unnamed";
              keyMetaRef.current.set(id, {
                label: nm,
                sub: maskKey(x.key || ""),
                short: shortLabel(nm),
                bg: c.bg,
                fg: c.fg,
                fullKey: x.key || "",
              });
              changed = true;
            }
          }
        }
      } catch {}
      if (changed && !cancelled) setMetaVersion((v) => v + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Backup highlight dari request log (5s poll) — satu pintu via activatePath,
  // tidak pernah clear paksa; timeout activatePath yang mematikan.
  useEffect(() => {
    const pollKeys = async () => {
      try {
        const data = await api.getRequestLogs(1, 5, "all", "");
        const top = data.logs && data.logs[0];
        if (!top || top.id === lastLogIdRef.current) return;
        lastLogIdRef.current = top.id;
        const masked = (top as any).apiKey || "";
        const label = masked && masked !== "-" ? maskKey(masked) : "";
        activatePath(top.provider || "", "", label, masked || "", masked || "");
      } catch {}
    };
    pollKeys();
    const interval = setInterval(pollKeys, 5000);
    return () => clearInterval(interval);
  }, []);

  // Max calculations for progress distribution
  const maxModelTokens = Math.max(...(summary?.models || []).map((m) => m.promptTokens + m.completionTokens), 1);
  const maxAccountTokens = Math.max(...(summary?.accounts || []).map((a) => a.promptTokens + a.completionTokens), 1);

  // Feed selalu newest-first (batch poll datang newest-first tapi di-prepend satu-satu,
  // jadi tanpa sort ini urutannya kebalik).
  const sortedFeed = useMemo(() => [...liveFeed].sort((a, b) => b.ts - a.ts), [liveFeed]);

  // LEFT rack: SELALU tampil semua provider (tanpa cap; fade dihitung lokal di HubGraph).
  // Kanan (client/API key) yang dinamis ganti-ganti.
  // NOTE: opacity/fade TIDAK dihitung di sini supaya dashboard tidak re-render tiap detik —
  // parent hanya kirim seenAt, HubGraph yang men-tick fade-nya sendiri (murah).
  const leftNodes = useMemo(() => {
    const all = [...provMetaRef.current.entries()].map(([id, meta]) => {
      const ts = provSeenRef.current.get(id) ?? 0;
      return {
        id,
        label: meta.label,
        sub: meta.sub,
        short: meta.short,
        bg: meta.bg,
        fg: meta.fg,
        seenAt: ts,
        dimOpacity: 0.6,
        _ts: ts,
      };
    });
    // Aktif (paling baru) dulu, lalu sisanya urutan daftar
    all.sort((a, b) => b._ts - a._ts);
    const nodes = all.map(({ _ts, ...n }) => n);
    if (nodes.length === 0) {
      nodes.push({
        id: "prov-idle",
        label: "No providers",
        sub: "gateway offline?",
        short: "...",
        bg: "#f1f5f9",
        fg: "#94a3b8",
        opacity: 0.85,
        ghost: true,
      } as any);
    }
    return nodes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaVersion, activeLeftId]);

  // RIGHT rack: dinamis client/API keys. Idle tetap tampil (redup), tidak kosong:
  // terakhir terlihat dulu, lalu member yang belum pernah traffic.
  const rightNodes = useMemo(() => {
    const all = [...keyMetaRef.current.entries()].map(([id, meta]) => {
      const ts = keySeenRef.current.get(id) ?? 0;
      return {
        id,
        label: meta.label,
        sub: meta.sub,
        short: meta.short,
        bg: meta.bg,
        fg: meta.fg,
        seenAt: ts,
        dimOpacity: ts > 0 ? 0.55 : 0.75,
        _ts: ts,
      };
    });
    all.sort((a, b) => b._ts - a._ts);
    const nodes = all.map(({ _ts, ...n }) => n);
    if (nodes.length === 0) {
      nodes.push({
        id: "key-idle",
        label: "No client keys",
        sub: "buat member dulu",
        short: "...",
        bg: "#f1f5f9",
        fg: "#94a3b8",
        opacity: 0.85,
        ghost: true,
      } as any);
    }
    return nodes;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metaVersion, activeRightId]);

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-6 font-sans">
      {/* 1. COMPACT COMMAND BAR (Period Selector, Sub-tabs & Wire Toggle) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
        <div className="flex items-center gap-3">
          {/* Sub-Tabs */}
          <div className="inline-flex h-8 items-center rounded-lg bg-muted p-1 text-muted-foreground">
            <button
              onClick={() => setSubTab("overview")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-0.5 text-xs font-semibold transition-all ${
                subTab === "overview" ? "bg-background text-foreground shadow-2xs font-bold" : "hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => {
                setSubTab("logs");
                fetchLogs();
              }}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-0.5 text-xs font-semibold transition-all ${
                subTab === "logs" ? "bg-background text-foreground shadow-2xs font-bold" : "hover:text-foreground"
              }`}
            >
              Request Logs
            </button>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* Period Selector Pills */}
          <div className="inline-flex h-8 items-center rounded-lg bg-muted p-1 text-muted-foreground">
            {["today", "24h", "7d", "30d", "60d"].map((p) => (
              <button
                key={p}
                onClick={() => {
                  setPeriod(p);
                  fetchSummary(p);
                }}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-0.5 text-xs font-semibold uppercase transition-all ${
                  period === p ? "bg-background text-foreground shadow-2xs font-bold" : "hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Realtime Badges & Wire Toggle */}
        <div className="flex items-center gap-2">
          <Badge variant="success" className="font-mono text-xs font-medium py-1 px-2.5">
            ⚡ {streamSpeed}
          </Badge>
          <Badge variant="cyan" className="font-mono text-xs font-medium py-1 px-2.5">
            🌊 {streamTokSpeed}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFlow(!showFlow)}
            className="h-8 text-xs font-semibold gap-1.5"
          >
            <Radio className="w-3.5 h-3.5 text-primary" />
            {showFlow ? "Hide Wire" : "Usage Wire"}
          </Button>
        </div>
      </div>

      {/* 2. 5 HIGH-DENSITY KPI CARDS (moved to top) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card className="shadow-2xs border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-4">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatNumber(summary?.totalRequests)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 font-medium">
              <TrendingUp className="w-3 h-3 text-emerald-600" />
              Completed requests
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-4">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Prompt Tokens</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatNumber(summary?.promptTokens)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Input context tokens</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-4">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cached Read</CardTitle>
            <Layers className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-cyan-600 dark:text-cyan-400 font-mono">
              {formatNumber(summary?.cachedTokens)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Cache read hits</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-4">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Completion</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {formatNumber(summary?.completionTokens)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Generated output tokens</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs border-emerald-500/40">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 space-y-0 p-4">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Est. Spend</CardTitle>
            <Coins className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
              {formatCurrency(summary?.totalCostUsd)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">Total billed in USD</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. NODE GRAPH (:20128 Gateway Pipeline) */}
      {showFlow && (
        <Card className="shadow-2xs overflow-hidden border-border">
          <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/20 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-bold text-foreground">Interactive Routing Wire</span>
              <span className="text-muted-foreground font-mono text-[11px]">(:20128 Gateway Pipeline)</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Mini Inline Audio Equalizer */}
              <div className="flex items-end gap-0.5 h-5 w-28 bg-muted/60 p-0.5 rounded overflow-hidden">
                {eqBars.slice(0, 24).map((val, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-xs transition-all duration-300"
                    style={{
                      height: `${val}%`,
                      backgroundColor: val > 60 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.4)",
                    }}
                  />
                ))}
              </div>

              {activeRequests.length > 0 ? (
                <Badge variant="success" className="font-mono text-[10px] py-0.5">
                  {activeRequests.length} IN-FLIGHT
                </Badge>
              ) : (
                <span className="text-[11px] font-mono text-muted-foreground">IDLE LISTENING</span>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFlow(false)}
                className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                ×
              </Button>
            </div>
          </div>

          <CardContent className="p-0 relative">
            <div className="flex flex-col lg:flex-row">
              <div
                className="flex-1 min-w-0 h-[360px] relative overflow-hidden select-none bg-white dark:bg-[#0c0c0e]"
              >
                <HubGraph
                  left={leftNodes}
                  right={rightNodes}
                  activeLeft={activeLeftId}
                  activeRight={activeRightId}
                  activeCount={activeRequests.length}
                  hubHot={activeRequests.length > 0 || activeLeftId !== null || activeRightId !== null}
                />

                {/* Hub status chip */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-3 z-20">
                  <span className="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-card/90 border border-border rounded-md px-2 py-1">
                    {activeRequests.length > 0 ? `${activeRequests.length} Running` : "Healthy Idle"}
                  </span>
                </div>
              </div>

              {/* Recent Requests — ala 9Router native */}
              <aside className="lg:w-[300px] shrink-0 border-t lg:border-t-0 lg:border-l border-border bg-white dark:bg-zinc-950 flex flex-col lg:h-[360px] min-h-0">
                <div className="px-4 pt-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Recent Requests
                </div>
                <div className="px-4 pb-1.5 grid grid-cols-[1fr_auto_auto] gap-2 text-[10px] font-semibold text-muted-foreground border-b border-border">
                  <span>Model</span>
                  <span className="text-right">In / Out</span>
                  <span className="text-right w-14">When</span>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto max-h-[240px] lg:max-h-none">
                  {sortedFeed.slice(0, 14).map((item) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-4 py-[7px] border-b border-border/50 last:border-0"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-xs font-mono text-foreground truncate" title={item.model}>
                          {item.model}
                        </span>
                      </div>
                      <div className="text-xs font-mono whitespace-nowrap">
                        <span className="font-semibold text-orange-700 dark:text-orange-400">
                          {formatNumber(item.promptTokens)}↑
                        </span>{" "}
                        <span className="text-orange-400 dark:text-orange-500">
                          {formatNumber(item.completionTokens)}↓
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground text-right w-14">
                        {timeAgo(item.ts)}
                      </div>
                    </div>
                  ))}
                  {liveFeed.length === 0 && (
                    <div className="text-center text-muted-foreground text-xs py-10">
                      Waiting for requests...
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. OVERVIEW SUB-TAB: FULL-WIDTH ANALYTICS CHART + FEED/SIDEBAR TABLES */}
      {subTab === "overview" && (
        <div className="space-y-4">
          {/* Token / Cost Analytics Bar Chart (full width) */}
          <Card className="shadow-2xs border-border">
            <CardHeader className="flex flex-row items-center justify-between py-3 px-5 border-b space-y-0">
              <div>
                <CardTitle className="text-sm font-bold text-foreground">Usage &amp; Token Chart</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">Aggregated activity over {period}</CardDescription>
              </div>
              <div className="inline-flex h-7 items-center rounded-lg bg-muted p-0.5 text-xs">
                <button
                  onClick={() => setChartMetric("tokens")}
                  className={`px-2.5 py-0.5 rounded-md font-semibold transition-all ${
                    chartMetric === "tokens" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                  }`}
                >
                  Tokens
                </button>
                <button
                  onClick={() => setChartMetric("cost")}
                  className={`px-2.5 py-0.5 rounded-md font-semibold transition-all ${
                    chartMetric === "cost" ? "bg-background text-foreground shadow-2xs" : "text-muted-foreground"
                  }`}
                >
                  Cost
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <UsageTimelineChart
                timeline={summary?.timeline || []}
                metric={chartMetric}
                period={period}
              />
            </CardContent>
          </Card>

          {/* 5. LIVE STREAM + BREAKDOWN TABLES SIDE BY SIDE */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Compact Live Request Stream */}
            <Card className="shadow-2xs border-border flex flex-col">
              <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold text-foreground">Live Feed Stream</CardTitle>
                <Badge variant="cyan" className="font-mono text-[10px] font-semibold py-0.5">
                  REALTIME
                </Badge>
              </CardHeader>
              <div className="p-2 max-h-[320px] overflow-y-auto space-y-1.5 flex-1">
                {sortedFeed.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-md border border-border bg-card flex items-center justify-between text-xs shadow-2xs hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-semibold text-foreground truncate max-w-[150px]">{item.model}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        <span className="text-foreground font-medium">{item.provider}</span> • {item.timestamp}
                      </div>
                    </div>
                    <div className="text-right whitespace-nowrap">
                      <div className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[11px]">
                        +{formatNumber(item.promptTokens + item.completionTokens)}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">{formatCurrency(item.costUsd)}</div>
                    </div>
                  </div>
                ))}
                {liveFeed.length === 0 && (
                  <div className="text-center text-muted-foreground text-xs py-12">
                    Listening for incoming gateway calls...
                  </div>
                )}
              </div>
            </Card>

            {/* By Model */}
            <Card className="shadow-2xs border-border">
              <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold text-foreground">Top Models by Consumption</CardTitle>
                <Badge variant="outline" className="text-xs font-semibold">{summary?.models?.length || 0} Models</Badge>
              </CardHeader>
              <div className="overflow-x-auto max-h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground font-semibold text-xs">Model</TableHead>
                      <TableHead className="text-foreground font-semibold text-xs w-24">Share</TableHead>
                      <TableHead className="text-right text-foreground font-semibold text-xs">Requests</TableHead>
                      <TableHead className="text-right text-foreground font-semibold text-xs">Tokens</TableHead>
                      <TableHead className="text-right text-foreground font-semibold text-xs">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.models?.map((m) => {
                      const totalTokens = m.promptTokens + m.completionTokens;
                      const pct = Math.min(100, Math.round((totalTokens / maxModelTokens) * 100));
                      return (
                        <TableRow key={m.model}>
                          <TableCell className="font-mono font-medium text-xs text-foreground max-w-[150px] truncate" title={m.model}>
                            {m.model}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono text-foreground">{formatNumber(m.totalRequests)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-foreground">{formatNumber(totalTokens)}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(m.totalCostUsd)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!summary?.models || summary.models.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs">
                          No model activity recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* By Account */}
            <Card className="shadow-2xs border-border">
              <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold text-foreground">Top Accounts by Activity</CardTitle>
                <Badge variant="outline" className="text-xs font-semibold">{summary?.accounts?.length || 0} Accounts</Badge>
              </CardHeader>
              <div className="overflow-x-auto max-h-[320px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-foreground font-semibold text-xs">Account Identifier</TableHead>
                      <TableHead className="text-foreground font-semibold text-xs w-24">Share</TableHead>
                      <TableHead className="text-right text-foreground font-semibold text-xs">Requests</TableHead>
                      <TableHead className="text-right text-foreground font-semibold text-xs">Tokens</TableHead>
                      <TableHead className="text-right text-foreground font-semibold text-xs">Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary?.accounts?.map((a) => {
                      const totalTokens = a.promptTokens + a.completionTokens;
                      const pct = Math.min(100, Math.round((totalTokens / maxAccountTokens) * 100));
                      return (
                        <TableRow key={a.accountId}>
                          <TableCell className="font-mono text-xs font-medium truncate max-w-[160px] text-foreground" title={a.accountId}>
                            {a.accountId}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div className="h-full bg-cyan-600 rounded-full" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="text-[10px] font-mono text-muted-foreground">{pct}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-xs font-mono text-foreground">{formatNumber(a.totalRequests)}</TableCell>
                          <TableCell className="text-right text-xs font-mono text-foreground">{formatNumber(totalTokens)}</TableCell>
                          <TableCell className="text-right text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(a.totalCostUsd)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!summary?.accounts || summary.accounts.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs">
                          No account activity recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* 6. REQUEST LOGS SUB-TAB */}
      {subTab === "logs" && (
        <Card className="shadow-2xs border-border">
          <CardHeader className="py-3 px-5 border-b flex flex-wrap items-center justify-between gap-3 space-y-0">
            <div className="flex items-center gap-3">
              <select
                value={logsFilter}
                onChange={(e) => {
                  setLogsFilter(e.target.value);
                  fetchLogs(1, e.target.value, logsSearch);
                }}
                className="h-8 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground"
              >
                <option value="all">All Statuses</option>
                <option value="ok">Success (200 OK)</option>
                <option value="error">Errors Only</option>
              </select>

              <Input
                placeholder="Search model, provider..."
                value={logsSearch}
                onChange={(e) => {
                  setLogsSearch(e.target.value);
                  fetchLogs(1, logsFilter, e.target.value);
                }}
                className="w-60 h-8 text-xs font-medium"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchLogs()}
              className="gap-1.5 text-xs font-semibold h-8"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Logs
            </Button>
          </CardHeader>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-foreground font-semibold">Timestamp</TableHead>
                <TableHead className="text-foreground font-semibold">Provider</TableHead>
                <TableHead className="text-foreground font-semibold">Model</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Prompt</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Cached</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Output</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Cost</TableHead>
                <TableHead className="text-right text-foreground font-semibold">Latency</TableHead>
                <TableHead className="text-center text-foreground font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsData?.logs?.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    {l.timestamp}
                  </TableCell>
                  <TableCell className="font-semibold text-xs text-foreground">{l.provider}</TableCell>
                  <TableCell className="font-mono text-xs text-foreground">{l.model}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-foreground">{formatNumber(l.promptTokens)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-cyan-600 dark:text-cyan-400 font-medium">
                    {formatNumber(l.cachedTokens)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-foreground">{formatNumber(l.completionTokens)}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    {formatCurrency(l.costUsd)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-foreground">{l.latencyMs}ms</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={l.status === "ok" || l.status === "200" ? "success" : "destructive"} className="font-mono text-[10px]">
                      {l.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(!logsData?.logs || logsData.logs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-10 text-xs">
                    No request logs found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
