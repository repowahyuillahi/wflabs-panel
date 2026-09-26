import React, { useState, useEffect, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api, UsageDetailItem, UsageProvidersResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RefreshCw, ChevronLeft, ChevronRight, Loader2, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import { nf, humanProvider, getCachedTokens, getCacheCreation, getInputTokens, latencyLabel } from "./usage-helpers";

export function UsageDetails() {
  const [details, setDetails] = useState<UsageDetailItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, totalItems: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<UsageProvidersResponse["providers"]>([]);

  const [filters, setFilters] = useState({ provider: "", startDate: "", endDate: "" });

  const [detailItem, setDetailItem] = useState<UsageDetailItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    api
      .getUsageProviders()
      .then((res) => setProviders(res.providers || []))
      .catch(() => {});
  }, []);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getUsageDetails(
        pagination.page,
        pagination.pageSize,
        filters.provider,
        filters.startDate,
        filters.endDate
      );
      setDetails(res.details || []);
      setPagination((p) => ({ ...p, ...res.pagination }));
    } catch (err: any) {
      toast.error(err.message || "Failed to load request details");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize, filters]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const rangeStart = pagination.totalItems > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const rangeEnd = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

  const pageNumbers = (() => {
    const total = pagination.totalPages;
    let start = Math.max(1, pagination.page - 2);
    let end = Math.min(total, start + 4);
    if (end - start + 1 < 5) start = Math.max(1, end - 4);
    const arr = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  })();

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Filters */}
      <Card className="shadow-2xs border-border">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="provider-filter" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Provider
              </label>
              <select
                id="provider-filter"
                value={filters.provider}
                onChange={(e) => setFilters((f) => ({ ...f, provider: e.target.value }))}
                className="h-9 px-3 rounded-lg border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 w-full min-w-0 cursor-pointer"
              >
                <option value="">All Providers</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.count})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="start-date-filter" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Start Date
              </label>
              <input
                id="start-date-filter"
                type="datetime-local"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
                className="h-9 px-3 rounded-lg border border-input bg-background w-full min-w-0 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="end-date-filter" className="text-xs font-bold text-foreground uppercase tracking-wider">
                End Date
              </label>
              <input
                id="end-date-filter"
                type="datetime-local"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
                className="h-9 px-3 rounded-lg border border-input bg-background w-full min-w-0 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <div className="flex min-w-0 flex-col gap-2 sm:col-span-2 lg:col-span-1">
              <span className="hidden text-xs font-bold uppercase tracking-wider opacity-0 lg:block" aria-hidden="true">
                Clear
              </span>
              <Button
                variant="ghost"
                onClick={() => setFilters({ provider: "", startDate: "", endDate: "" })}
                disabled={!filters.provider && !filters.startDate && !filters.endDate}
                className="w-full h-9 text-xs font-semibold"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details table */}
      <Card className="shadow-2xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase text-[10px]">
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 font-bold">Timestamp</th>
                <th className="text-left px-4 py-3 font-bold">Model</th>
                <th className="text-left px-4 py-3 font-bold">Provider</th>
                <th className="text-right px-4 py-3 font-bold">Input Tokens</th>
                <th className="text-right px-4 py-3 font-bold">Cached</th>
                <th className="text-right px-4 py-3 font-bold">Cache Creation</th>
                <th className="text-right px-4 py-3 font-bold">Output Tokens</th>
                <th className="text-left px-4 py-3 font-bold">Latency</th>
                <th className="text-center px-4 py-3 font-bold">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : details.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-muted-foreground text-xs">
                    No request details found
                  </td>
                </tr>
              ) : (
                details.map((d, i) => {
                  const lat = latencyLabel(d.latency?.ttft, d.latency?.total);
                  return (
                    <tr
                      key={`${d.id}-${i}`}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-foreground font-mono">
                        {new Date(d.timestamp).toLocaleString()}
                      </td>
                      <td className="max-w-[240px] truncate px-4 py-3 font-mono text-xs text-foreground" title={d.model}>
                        {d.model}
                      </td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-xs">
                        <span className="font-semibold text-foreground">{humanProvider(d.provider)}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground text-right font-mono">
                        {nf(getInputTokens(d.tokens))}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground text-right font-mono">
                        {getCachedTokens(d.tokens) > 0 ? nf(getCachedTokens(d.tokens)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground text-right font-mono">
                        {getCacheCreation(d.tokens) > 0 ? nf(getCacheCreation(d.tokens)) : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground text-right font-mono">
                        {nf(d.tokens?.completion_tokens)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex flex-col gap-0.5 font-mono text-[10px]">
                          <div>
                            TTFT: <span className="text-foreground">{lat.ttft !== null ? `${lat.ttft}ms` : "—"}</span>
                          </div>
                          <div>
                            Total: <span className="text-foreground">{lat.total !== null ? `${lat.total}ms` : "—"}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Badge
                            variant={d.status === "success" ? "success" : "destructive"}
                            className="text-[10px] font-mono font-bold"
                          >
                            {d.status}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setDetailItem(d);
                              setDetailOpen(true);
                            }}
                            className="h-6 px-2 text-[10px] font-semibold gap-1"
                          >
                            <Eye className="w-2.5 h-2.5" />
                            Detail
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && details.length > 0 && (
          <div className="border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 py-3.5 px-4">
            <div className="text-xs text-muted-foreground font-mono">
              Showing <span className="font-bold text-foreground">{rangeStart}</span> to{" "}
              <span className="font-bold text-foreground">{rangeEnd}</span> of{" "}
              <span className="font-bold text-foreground">{pagination.totalItems}</span> results
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Rows:</span>
                <select
                  value={pagination.pageSize}
                  onChange={(e) =>
                    setPagination((p) => ({ ...p, pageSize: Number(e.target.value), page: 1 }))
                  }
                  className="h-8 px-2 rounded-lg border border-input bg-background text-xs text-foreground focus:outline-none cursor-pointer"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="w-8 h-8 px-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  {pageNumbers[0] > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPagination((p) => ({ ...p, page: 1 }))}
                        className="w-8 h-8 px-0 text-xs hidden sm:inline-flex"
                      >
                        1
                      </Button>
                      {pageNumbers[0] > 2 && <span className="text-muted-foreground px-1 text-xs">...</span>}
                    </>
                  )}

                  {pageNumbers.map((n) => (
                    <Button
                      key={n}
                      variant={pagination.page === n ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setPagination((p) => ({ ...p, page: n }))}
                      className={cn("w-8 h-8 px-0 text-xs", pagination.page === n ? "inline-flex" : "hidden sm:inline-flex")}
                    >
                      {n}
                    </Button>
                  ))}

                  {pageNumbers[pageNumbers.length - 1] < pagination.totalPages && (
                    <>
                      {pageNumbers[pageNumbers.length - 1] < pagination.totalPages - 1 && (
                        <span className="text-muted-foreground px-1 text-xs">...</span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPagination((p) => ({ ...p, page: pagination.totalPages }))}
                        className="w-8 h-8 px-0 text-xs hidden sm:inline-flex"
                      >
                        {pagination.totalPages}
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="w-8 h-8 px-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Detail drawer */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Request Details
            </DialogTitle>
            <DialogDescription>Full telemetry record captured by the gateway.</DialogDescription>
          </DialogHeader>

          {detailItem && (
            <div className="space-y-5 py-1">
              <div className="grid min-w-0 grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <InfoRow label="ID" value={String(detailItem.id)} mono />
                <InfoRow label="Timestamp" value={new Date(detailItem.timestamp).toLocaleString()} />
                <InfoRow label="Provider" value={humanProvider(detailItem.provider)} />
                <InfoRow label="Model" value={detailItem.model} mono />
                <InfoRow label="Status" value={detailItem.status} highlight={detailItem.status === "success"} />
                <InfoRow label="Connection ID" value={detailItem.connectionId || "-"} mono />
                <InfoRow label="Input Tokens" value={nf(getInputTokens(detailItem.tokens))} />
                <InfoRow label="Cached Tokens" value={getCachedTokens(detailItem.tokens) > 0 ? nf(getCachedTokens(detailItem.tokens)) : "—"} />
                <InfoRow label="Cache Creation" value={getCacheCreation(detailItem.tokens) > 0 ? nf(getCacheCreation(detailItem.tokens)) : "—"} />
                <InfoRow label="Output Tokens" value={nf(detailItem.tokens?.completion_tokens)} />
                <InfoRow label="Latency (TTFT / Total)" value={`${detailItem.latency?.ttft || 0}ms / ${detailItem.latency?.total || 0}ms`} />
                <InfoRow label="Cost (USD)" value={`$${(detailItem.cost || 0).toFixed(6)}`} />
              </div>

              <div className="rounded-lg border border-border p-4 bg-muted/20">
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Raw Telemetry Payload
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 text-slate-100 p-3 font-mono text-[11px] leading-relaxed border border-slate-800">
{JSON.stringify(detailItem, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0">
      <span className="text-muted-foreground text-[10px] uppercase font-bold block">{label}</span>
      <span
        className={cn(
          "break-all text-xs",
          mono && "font-mono",
          highlight ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-foreground"
        )}
      >
        {value}
      </span>
    </div>
  );
}
