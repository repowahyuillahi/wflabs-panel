import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ModelsCatalogResponse } from "@/lib/api";
import { Cpu, RefreshCw, Search, ChevronLeft, ChevronRight, Check, Copy } from "lucide-react";
import { toast } from "sonner";

export function ModelsView() {
  const [data, setData] = useState<ModelsCatalogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [provFilter, setProvFilter] = useState("all");
  const [allowFilter, setAllowFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadModels = async () => {
    try {
      setLoading(true);
      const res = await api.getModels();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load models catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  const handleToggle = async (modelId: string, currentAllowed: boolean, provider?: string) => {
    try {
      const nextState = !currentAllowed;
      // Optimistic update
      setData((prev) =>
        prev
          ? {
              ...prev,
              models: prev.models.map((m) =>
                m.id === modelId ? { ...m, isAllowed: nextState } : m
              ),
            }
          : prev
      );
      await api.toggleModel(modelId, nextState, provider);
      toast.success(`Model ${modelId} ${nextState ? "enabled" : "blocked"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle model state");
      loadModels();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Model ID copied");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredModels = useMemo(() => {
    return (data?.models || []).filter((m) => {
      if (provFilter !== "all" && m.provider !== provFilter) return false;
      if (allowFilter === "allowed" && !m.isAllowed) return false;
      if (allowFilter === "disabled" && m.isAllowed) return false;
      if (
        search &&
        !m.id.toLowerCase().includes(search.toLowerCase()) &&
        !m.displayName.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [data, provFilter, allowFilter, search]);

  const totalPages = Math.ceil(filteredModels.length / pageSize) || 1;
  const paginatedModels = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredModels.slice(start, start + pageSize);
  }, [filteredModels, page, pageSize]);

  const providers = Array.from(new Set(data?.models?.map((m) => m.provider) || []));

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Allowed Models Catalog</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure gateway permissions and access policies for upstream AI models
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadModels}
          className="gap-1.5 text-xs font-semibold h-9"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Catalog
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-2xs border-border">
        <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={provFilter}
              onChange={(e) => {
                setProvFilter(e.target.value);
                setPage(1);
              }}
              className="h-8.5 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="all">All Providers ({providers.length})</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <select
              value={allowFilter}
              onChange={(e) => {
                setAllowFilter(e.target.value);
                setPage(1);
              }}
              className="h-8.5 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="allowed">Allowed Only</option>
              <option value="disabled">Blocked Only</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search model ID or name..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-64 h-8.5 pl-8 text-xs font-medium bg-background"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground">
              Showing <strong className="text-foreground font-semibold">{filteredModels.length}</strong> / {data?.count || 0} models
            </span>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="h-7 px-2 rounded border border-input bg-background text-xs font-mono text-foreground focus:outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="shadow-2xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-bold text-foreground text-xs uppercase py-3 w-36">Provider</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Model Identifier</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Display Label</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-24">Type</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-28 text-center">Context</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-32 text-right">Gateway Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedModels.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold text-xs text-foreground flex items-center gap-2 py-3">
                    <Cpu className="w-4 h-4 text-primary shrink-0" />
                    <span className="capitalize">{m.provider}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 group max-w-[360px]">
                      <span className="font-mono text-xs font-bold text-foreground truncate select-all" title={m.id}>
                        {m.id}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(m.id, m.id)}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy Model ID"
                      >
                        {copiedId === m.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">
                    {m.displayName || m.id}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono uppercase text-[10px] font-semibold">
                      {m.type || "chat"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs font-medium text-foreground">
                    {m.contextLength ? `${Math.round(m.contextLength / 1000)}k` : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2.5">
                      <span className={`text-[11px] font-mono font-bold ${
                        m.isAllowed ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      }`}>
                        {m.isAllowed ? "ALLOWED" : "BLOCKED"}
                      </span>
                      <Switch
                        checked={m.isAllowed}
                        onCheckedChange={() => handleToggle(m.id, m.isAllowed, m.provider)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {paginatedModels.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-xs">
                    No models matching current filters
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-muted/15 font-mono">
          <div className="text-muted-foreground">
            Showing Page <strong className="text-foreground">{page}</strong> of{" "}
            <strong className="text-foreground">{totalPages}</strong> ({filteredModels.length} models filtered)
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-7 px-2.5 text-xs font-sans gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </Button>

            <span className="px-2 py-1 bg-background rounded border text-xs font-bold text-foreground">
              {page}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-7 px-2.5 text-xs font-sans gap-1"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
