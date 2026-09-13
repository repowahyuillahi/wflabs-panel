import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, UsageSummaryResponse, RequestLogsResponse } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  Activity,
  Server,
  Radio,
  RefreshCw,
  Zap,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  Coins,
  Layers,
  Maximize2,
  Lock,
  Unlock,
  SlidersHorizontal,
} from "lucide-react";
import { UsageTimelineChart } from "@/components/ui/usage-timeline-chart";

interface LiveFeedItem {
  id: string;
  timestamp: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  status: string;
  latencyMs?: number;
}

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
  const [streamConnected, setStreamConnected] = useState(false);
  const [streamSpeed, setStreamSpeed] = useState("0 req/min");
  const [streamTokSpeed, setStreamTokSpeed] = useState("0 tok/5s");

  // In-flight & Flow state
  const [activeRequests, setActiveRequests] = useState<any[]>([]);
  const [hotNodes, setHotNodes] = useState<{ [id: string]: boolean }>({});
  const [activeEdgePool, setActiveEdgePool] = useState(false);
  const [activeEdgeApi, setActiveEdgeApi] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLocked, setIsLocked] = useState(false);

  const speedCountRef = useRef(0);
  const tokenCountRef = useRef(0);
  const seenKeysRef = useRef(new Set<string>());

  // 1. SSE Realtime Stream Connection (/api/usage/stream)
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/usage/stream");
      es.onopen = () => setStreamConnected(true);
      es.onmessage = (e) => {
        if (!e.data || e.data.startsWith(":")) return;
        try {
          const item = JSON.parse(e.data);
          handleRealtimeItem(item);
        } catch {}
      };
      es.onerror = () => setStreamConnected(false);
    } catch {
      setStreamConnected(false);
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

    const provId = item.provider ? `pool-${item.provider}` : "pool-client";
    setHotNodes((prev) => ({ ...prev, [provId]: true, "gw-core": true, "api-upstream": true }));
    setActiveEdgePool(true);
    setActiveEdgeApi(true);

    setTimeout(() => {
      setHotNodes((prev) => ({ ...prev, [provId]: false, "gw-core": false, "api-upstream": false }));
      setActiveEdgePool(false);
      setActiveEdgeApi(false);
    }, 900);

    const feedItem: LiveFeedItem = {
      id: String(Date.now()) + Math.random(),
      timestamp: item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString(),
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
          setActiveRequests(actives);
          const recents = res.live.recentRequests || [];
          for (const item of recents.slice(0, 5)) {
            handleRealtimeItem(item);
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

  // Max calculations for progress distribution
  const maxModelTokens = Math.max(...(summary?.models || []).map((m) => m.promptTokens + m.completionTokens), 1);
  const maxAccountTokens = Math.max(...(summary?.accounts || []).map((a) => a.promptTokens + a.completionTokens), 1);

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

      {/* 2. COMPACT USAGE WIRE & TELEMETRY STRIP (Height reduced from 320px to 175px) */}
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
            <div
              className="h-44 w-full relative overflow-hidden select-none bg-[#fbfbfb] dark:bg-[#0c0c0e]"
              style={{
                backgroundImage: "radial-gradient(circle, rgba(160, 160, 160, 0.18) 1.2px, transparent 1.2px)",
                backgroundSize: "16px 16px",
              }}
            >
              <div
                className="w-full h-full flex items-center justify-between px-10 relative transition-transform duration-200"
                style={{ transform: `scale(${zoomLevel})`, transformOrigin: "center center" }}
              >
                {/* Node 1: Clients */}
                <div
                  className={`w-52 p-2.5 rounded-lg border bg-card shadow-2xs transition-all z-10 ${
                    hotNodes["pool-client"] ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <Server className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-xs font-bold text-foreground">Client Pools</div>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground flex justify-between font-mono">
                    <span>Target:</span>
                    <span className="text-foreground font-semibold">Claude / Cursor</span>
                  </div>
                </div>

                {/* Node 2: 9Router Core Gateway */}
                <div
                  className={`w-64 p-3 rounded-xl border-2 bg-card shadow-sm transition-all z-10 text-center ${
                    hotNodes["gw-core"] ? "border-emerald-500 ring-3 ring-emerald-500/20 shadow-md" : "border-emerald-600/80"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <span className="text-xs font-bold text-foreground">9Router Gateway</span>
                    <Badge variant="outline" className="text-[10px] font-mono px-1 py-0">
                      :20128
                    </Badge>
                  </div>
                  <div className="mt-2 py-1 px-2 rounded bg-muted/60 text-[10px] font-mono flex items-center justify-between">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      {activeRequests.length > 0 ? `${activeRequests.length} Running` : "Healthy Idle"}
                    </span>
                  </div>
                </div>

                {/* Node 3: Upstream Cluster */}
                <div
                  className={`w-52 p-2.5 rounded-lg border bg-card shadow-2xs transition-all z-10 ${
                    hotNodes["api-upstream"] ? "border-cyan-500 ring-2 ring-cyan-500/20" : "border-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
                        <Activity className="w-3.5 h-3.5" />
                      </div>
                      <div className="text-xs font-bold text-foreground">Upstream APIs</div>
                    </div>
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                  </div>
                  <div className="mt-1.5 pt-1.5 border-t border-border/60 text-[10px] text-muted-foreground flex justify-between font-mono">
                    <span>Available:</span>
                    <span className="text-cyan-600 font-bold">{summary?.models?.length || 0} Models</span>
                  </div>
                </div>

                {/* Connecting SVG Animated Wires */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none stroke-2">
                  <line x1="22%" y1="50%" x2="38%" y2="50%" className="stroke-border" strokeWidth={2} />
                  <line x1="62%" y1="50%" x2="78%" y2="50%" className="stroke-border" strokeWidth={2} />
                  <line
                    x1="22%"
                    y1="50%"
                    x2="38%"
                    y2="50%"
                    className={activeEdgePool || hotNodes["gw-core"] ? "stroke-emerald-500 rf-edge-flow-active" : "stroke-transparent"}
                    strokeWidth={2.5}
                  />
                  <line
                    x1="62%"
                    y1="50%"
                    x2="78%"
                    y2="50%"
                    className={activeEdgeApi || hotNodes["api-upstream"] ? "stroke-cyan-500 rf-edge-flow-cyan" : "stroke-transparent"}
                    strokeWidth={2.5}
                  />
                </svg>
              </div>

              {/* Minimal Zoom Controls */}
              <div className="absolute left-3 bottom-3 flex rounded-md border border-border bg-card/90 shadow-2xs overflow-hidden z-20 text-xs">
                <button
                  onClick={() => setZoomLevel((z) => Math.min(1.3, z + 0.1))}
                  className="px-2 py-0.5 hover:bg-muted font-bold border-r border-border"
                  title="Zoom In"
                >
                  +
                </button>
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.1))}
                  className="px-2 py-0.5 hover:bg-muted font-bold border-r border-border"
                  title="Zoom Out"
                >
                  −
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-1.5 py-0.5 hover:bg-muted text-[10px]"
                  title="Reset"
                >
                  100%
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. 5 HIGH-DENSITY KPI CARDS */}
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

      {/* 4. OVERVIEW SUB-TAB: ANALYTICS CHART & COMPACT LIVE STREAM */}
      {subTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Token / Cost Analytics Bar Chart */}
            <Card className="lg:col-span-2 shadow-2xs border-border">
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

            {/* Right: Compact Live Request Stream Table */}
            <Card className="shadow-2xs border-border flex flex-col">
              <CardHeader className="py-3 px-5 border-b flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold text-foreground">Live Feed Stream</CardTitle>
                <Badge variant="cyan" className="font-mono text-[10px] font-semibold py-0.5">
                  REALTIME
                </Badge>
              </CardHeader>
              <div className="p-2 max-h-[295px] overflow-y-auto space-y-1.5 flex-1">
                {liveFeed.map((item) => (
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
          </div>

          {/* 5. INFORMATIVE BREAKDOWN TABLES WITH PERCENTAGE DISTRIBUTION BARS */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

function CartGrid(props: any) {
  return <CartesianGrid {...props} />;
}
