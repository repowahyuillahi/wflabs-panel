import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, ErrorsResponse } from "@/lib/api";
import { ShieldAlert, RefreshCw, CheckCircle2, Search, Copy, Check, Eye } from "lucide-react";
import { toast } from "sonner";

export function ErrorsView() {
  const [data, setData] = useState<ErrorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterProv, setFilterProv] = useState("all");
  const [selectedError, setSelectedError] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadErrors = async () => {
    try {
      setLoading(true);
      const res = await api.getErrors();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load error log stream");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadErrors();
  }, []);

  const filteredErrors = useMemo(() => {
    return (data?.errors || []).filter((e) => {
      if (filterProv !== "all" && e.provider !== filterProv) return false;
      if (
        search &&
        !e.model.toLowerCase().includes(search.toLowerCase()) &&
        !e.provider.toLowerCase().includes(search.toLowerCase()) &&
        !e.errorSnippet.toLowerCase().includes(search.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [data, filterProv, search]);

  const providers = Array.from(new Set(data?.errors?.map((e) => e.provider) || []));

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Error payload copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInspect = (err: any) => {
    setSelectedError(err);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Upstream Error Stream</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Audit log of upstream provider HTTP 403, 429 rate-limit, and timeout failure events
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadErrors}
          className="gap-1.5 text-xs font-semibold h-9"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh Stream
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="shadow-2xs border-border">
        <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={filterProv}
              onChange={(e) => setFilterProv(e.target.value)}
              className="h-8.5 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="all">All Providers ({providers.length})</option>
              {providers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search error snippet or model..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 h-8.5 pl-8 text-xs font-medium bg-background"
              />
            </div>
          </div>

          <span className="text-xs font-mono text-muted-foreground">
            Showing <strong className="text-foreground font-semibold">{filteredErrors.length}</strong> / {data?.errors?.length || 0} recorded errors
          </span>
        </div>
      </Card>

      {/* Table */}
      <Card className="shadow-2xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-bold text-foreground text-xs uppercase py-3 w-44">Timestamp</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-32">Provider</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-48">Target Model</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-28 text-center">HTTP Status</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Error Snippet Payload</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-24">Inspect</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredErrors.map((err) => (
                <TableRow key={err.id || Math.random()} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap py-3">
                    {err.timestamp}
                  </TableCell>
                  <TableCell className="font-bold text-xs text-foreground flex items-center gap-1.5 py-3">
                    <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0" />
                    <span className="capitalize">{err.provider}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-foreground">{err.model}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="destructive" className="font-mono text-[10px] font-bold">
                      HTTP {err.httpStatus || 500}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2 group max-w-[500px]">
                      <span className="font-mono text-xs text-destructive dark:text-red-400 font-medium truncate select-all" title={err.errorSnippet}>
                        {err.errorSnippet}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopy(err.errorSnippet, err.id)}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        title="Copy Snippet"
                      >
                        {copiedId === err.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInspect(err)}
                      className="h-7 px-2 text-xs font-semibold gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredErrors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-16 text-xs">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                      <span className="font-semibold text-foreground text-sm">No Matching Errors Found</span>
                      <span className="text-muted-foreground text-xs">All upstream connections operating within normal parameters.</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Inspector Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Error Details // {selectedError?.provider} - {selectedError?.model}</DialogTitle>
            <DialogDescription>
              Recorded at {selectedError?.timestamp}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">HTTP Status:</span>
              <Badge variant="destructive" className="font-mono text-xs">
                HTTP {selectedError?.httpStatus}
              </Badge>
            </div>

            <div>
              <span className="text-xs font-bold text-muted-foreground block mb-1">Payload / Error Response:</span>
              <pre className="p-3 rounded-lg bg-slate-950 text-red-300 font-mono text-xs overflow-x-auto max-h-72 border border-slate-800">
                {selectedError?.errorSnippet}
              </pre>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleCopy(selectedError?.errorSnippet || "", "modal")}
              className="gap-1.5"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy Payload
            </Button>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
