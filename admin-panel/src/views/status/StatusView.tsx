import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Server,
  Database,
  Radio,
  Cpu,
  ExternalLink,
  Sparkles,
  Zap
} from "lucide-react";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface StatusViewProps {
  isStandalone?: boolean;
}

export function StatusView({ isStandalone = false }: StatusViewProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProv, setFilterProv] = useState("all");

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getPublicStatus();
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    const interval = setInterval(loadStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const models = data?.models || [];
  const providers = Array.from(new Set(models.map((m: any) => m.provider)));

  const filteredModels = models.filter((m: any) => {
    if (filterProv !== "all" && m.provider !== filterProv) return false;
    if (search && !m.id.toLowerCase().includes(search.toLowerCase()) && !m.provider.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  const operationalCount = models.filter((m: any) => m.status === "operational").length;
  const isGatewayOnline = data?.platform?.gateway?.online ?? false;
  const gatewayLatency = data?.platform?.gateway?.latencyMs ?? 0;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16 font-sans">
      {/* Standalone Header Bar */}
      {isStandalone && (
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/60 backdrop-blur-sm -mx-6 -mt-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-background border border-border shadow-xs">
              <img src="/wflabs-logo-black-256.png" alt="WFLabs" className="w-6 h-6 object-contain dark:hidden" />
              <img src="/wflabs-logo-white-256.png" alt="WFLabs" className="w-6 h-6 object-contain hidden dark:block" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-foreground">WFLABS STATUS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                SYSTEM TELEMETRY
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a href="/docs" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Documentation
            </a>
            <a href="/member" className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
              Member Portal
            </a>
            <a href="/" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
              Admin Panel
            </a>
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* Hero Header */}
      <div className="space-y-2 border-b border-border pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="success" className="font-mono text-[10px] font-bold">
              SYSTEM STATUS
            </Badge>
            <span className="text-xs text-muted-foreground font-mono">
              Live Probe • Updated {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : "just now"}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Platform &amp; Model Health
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time latency, operational uptime checks, and live catalog probe across all provider clusters.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadStatus}
          disabled={loading}
          className="gap-1.5 text-xs font-semibold h-9 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Probing..." : "Refresh Status"}
        </Button>
      </div>

      {/* Platform Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Gateway Core */}
        <Card className="p-4 space-y-2 shadow-2xs border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-bold text-foreground">9Router Gateway :20128</span>
            </div>
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isGatewayOnline ? "bg-emerald-400" : "bg-destructive"
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isGatewayOnline ? "bg-emerald-500" : "bg-destructive"
              }`} />
            </span>
          </div>
          <div className="flex items-center justify-between text-xs font-mono pt-1">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={isGatewayOnline ? "success" : "destructive"} className="text-[10px] font-bold">
              {isGatewayOnline ? "OPERATIONAL" : "OFFLINE"}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">Probe Latency:</span>
            <span className="font-bold text-foreground">{gatewayLatency}ms</span>
          </div>
        </Card>

        {/* Database SQLite */}
        <Card className="p-4 space-y-2 shadow-2xs border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Local SQLite Database</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-center justify-between text-xs font-mono pt-1">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant="success" className="text-[10px] font-bold">OPERATIONAL</Badge>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">File Size:</span>
            <span className="font-bold text-foreground">{data?.platform?.database?.size ? formatBytes(data.platform.database.size) : "-"}</span>
          </div>
        </Card>

        {/* API Server */}
        <Card className="p-4 space-y-2 shadow-2xs border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span className="text-sm font-bold text-foreground">Admin API &amp; Web Server</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
          </div>
          <div className="flex items-center justify-between text-xs font-mono pt-1">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant="success" className="text-[10px] font-bold">OPERATIONAL</Badge>
          </div>
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">Port:</span>
            <span className="font-bold text-foreground">:20110</span>
          </div>
        </Card>
      </div>

      {/* Model Catalog Health Matrix */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              Live Models Status Matrix ({operationalCount} / {models.length} Operational)
            </h2>
            <p className="text-xs text-muted-foreground">
              Read-only probe checks across all live upstream AI models.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterProv}
              onChange={(e) => setFilterProv(e.target.value)}
              className="h-8.5 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="all">All Providers ({providers.length})</option>
              {providers.map((p: any) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <div className="relative w-56">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8.5 pl-8 text-xs bg-background"
              />
            </div>
          </div>
        </div>

        <Card className="shadow-2xs border-border overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-bold text-foreground py-2.5">Model Identifier</TableHead>
                  <TableHead className="text-xs font-bold text-foreground w-32">Provider</TableHead>
                  <TableHead className="text-xs font-bold text-foreground w-32 text-center">Status</TableHead>
                  <TableHead className="text-xs font-bold text-foreground w-28 text-center">Latency</TableHead>
                  <TableHead className="text-xs font-bold text-foreground w-28 text-center">Context</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((m: any) => (
                  <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-foreground py-2.5 select-all">
                      {m.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase font-semibold">
                        {m.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={m.status === "operational" ? "success" : "destructive"}
                        className="font-mono text-[10px] font-bold"
                      >
                        {m.status === "operational" ? "OPERATIONAL" : "DEGRADED"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      ~{m.latencyMs}ms
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {m.contextLength ? `${Math.round(m.contextLength / 1000)}k` : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredModels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-xs text-muted-foreground">
                      No models matching search
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {/* Status Legend Section */}
      <Card className="p-4 border-border bg-muted/20 text-xs space-y-2">
        <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">Status Legend</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span><strong>Operational</strong> — Gateway probes and health checks passing</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span><strong>Degraded</strong> — Model blocked or elevated latency</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            <span><strong>Outage</strong> — Service unreachable</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
