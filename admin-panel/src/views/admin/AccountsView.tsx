import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, AccountsResponse, DbStatsResponse } from "@/lib/api";
import {
  Plus,
  Upload,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  Search,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Check,
  Pencil,
  Key,
  Layers,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

export function AccountsView() {
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [dbStats, setDbStats] = useState<DbStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterProv, setFilterProv] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [jsonText, setJsonText] = useState("");

  const [formData, setFormData] = useState({
    provider: "kiro",
    identifier: "",
    priority: 100,
    isActive: 1,
  });

  const [editFormData, setEditFormData] = useState({
    id: "",
    provider: "",
    name: "",
    email: "",
    priority: 100,
    isActive: 1,
  });

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const [res, stats] = await Promise.all([
        api.getAccounts(page, pageSize, filterProv, filterStatus, search),
        api.getDbStats().catch(() => null),
      ]);
      setData(res);
      if (stats) setDbStats(stats);
      setSelectedIds([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to load keys");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, [page, pageSize, filterProv, filterStatus, search]);

  const totalPages = Math.ceil((data?.total || 0) / pageSize) || 1;

  const handleSelectAll = (checked: boolean) => {
    if (checked && data?.accounts) {
      setSelectedIds(data.accounts.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleToggleActive = async (id: string, current: number) => {
    try {
      setData((prev) =>
        prev
          ? {
              ...prev,
              accounts: prev.accounts.map((a) =>
                a.id === id ? { ...a, isActive: current === 1 ? 0 : 1 } : a
              ),
            }
          : prev
      );
      await api.toggleAccount(id);
      toast.success("Key active status updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle key");
      loadAccounts();
    }
  };

  const handleResetError = async (id: string) => {
    try {
      await api.resetAccountError(id);
      toast.success("Error count reset to 0");
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset error");
    }
  };

  const handleBulkAction = async (action: "activate" | "deactivate" | "reset-error" | "delete") => {
    if (!selectedIds.length) return;
    if (action === "delete" && !confirm(`Permanently delete ${selectedIds.length} provider key(s)?`)) {
      return;
    }
    try {
      await api.bulkAccounts(action, selectedIds);
      toast.success(`Action '${action}' applied to ${selectedIds.length} key(s)`);
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || "Bulk operation failed");
    }
  };

  const handleCreate = async () => {
    if (!formData.identifier.trim()) {
      toast.error("API key or credential identifier is required");
      return;
    }
    try {
      await api.createAccount(formData);
      toast.success("Provider key registered successfully");
      setCreateOpen(false);
      setFormData({ provider: "kiro", identifier: "", priority: 100, isActive: 1 });
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to create key");
    }
  };

  const openEditModal = (acc: any) => {
    setEditFormData({
      id: acc.id,
      provider: acc.provider,
      name: acc.identifier,
      email: acc.identifier,
      priority: acc.priority || 100,
      isActive: acc.isActive ?? 1,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    try {
      await api.updateAccount(editFormData.id, {
        priority: Number(editFormData.priority) || 100,
        isActive: editFormData.isActive,
      });
      toast.success("Key priority and configuration updated");
      setEditOpen(false);
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to update key");
    }
  };

  const handleImport = async () => {
    try {
      const parsed = JSON.parse(jsonText);
      await api.importAccounts(parsed);
      toast.success("Keys imported successfully");
      setImportOpen(false);
      setJsonText("");
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || "Invalid JSON or import failed");
    }
  };

  const handleExportKiro = async () => {
    try {
      const res = await api.exportKiroAccounts();
      if (!res.accounts || !res.accounts.length) {
        toast.info("No Kiro keys found to export");
        return;
      }
      const jsonBlob = new Blob([JSON.stringify(res.accounts, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kiro-keys-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.count} Kiro keys`);
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this provider key?")) return;
    try {
      await api.deleteAccount(id);
      toast.success("Provider key deleted");
      loadAccounts();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete key");
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* 1. TOP HEADER & PRIMARY ACTIONS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Key Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and rotate upstream provider API keys, credentials, and priority routing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportKiro}
            className="gap-1.5 text-xs font-semibold h-9"
          >
            <Download className="w-3.5 h-3.5" />
            Export Keys
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="gap-1.5 text-xs font-semibold h-9"
          >
            <Upload className="w-3.5 h-3.5" />
            Import JSON
          </Button>

          <Button
            variant="success"
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="gap-1.5 text-xs font-semibold h-9"
          >
            <Plus className="w-3.5 h-3.5" />
            New Key
          </Button>
        </div>
      </div>

      {/* 2. STAT CHIPS STRIP */}
      {dbStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl border border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Keys</div>
              <div className="text-xl font-bold font-mono text-foreground">{dbStats.totalAccounts}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Key className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Keys</div>
              <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{dbStats.activeAccounts}</div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Disabled / Backoff</div>
              <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400">
                {dbStats.totalAccounts - dbStats.activeAccounts}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border bg-card shadow-2xs flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Provider Clusters</div>
              <div className="text-xl font-bold font-mono text-cyan-600 dark:text-cyan-400">
                {dbStats.providers?.length || 0}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* 3. FILTER & SEARCH CONTROLS BAR */}
      <Card className="shadow-2xs border-border">
        <div className="p-3.5 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Dynamic Provider Filter */}
            <select
              value={filterProv}
              onChange={(e) => {
                setFilterProv(e.target.value);
                setPage(1);
              }}
              className="h-8.5 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="all">All Providers ({dbStats?.totalAccounts || data?.total || 0})</option>
              {dbStats?.providers?.map((p) => {
                const label = p.provider.startsWith("openai-compatible-chat-")
                  ? `Custom Node (${p.count})`
                  : `${p.provider} (${p.count})`;
                return (
                  <option key={p.provider} value={p.provider}>
                    {label}
                  </option>
                );
              })}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="h-8.5 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
            >
              <option value="all">All States</option>
              <option value="active">Active Only</option>
              <option value="inactive">Disabled Only</option>
              <option value="error">Error / Backoff (429)</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                placeholder="Search identifier or email..."
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
              Showing <strong className="text-foreground font-semibold">{data?.accounts?.length || 0}</strong> of{" "}
              <strong className="text-foreground font-semibold">{data?.total || 0}</strong> keys
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

      {/* 4. BULK ACTION TOOLBAR (VISIBLE WHEN 1+ ROWS SELECTED) */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-primary/40 shadow-xs">
          <div className="flex items-center gap-2">
            <Badge variant="success" className="font-mono text-xs font-bold">
              {selectedIds.length} Selected
            </Badge>
            <span className="text-xs text-muted-foreground">Apply batch action:</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("activate")}
              className="text-xs font-semibold h-7 text-emerald-700 dark:text-emerald-400 gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Activate
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("deactivate")}
              className="text-xs font-semibold h-7 text-muted-foreground gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              Deactivate
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction("reset-error")}
              className="text-xs font-semibold h-7 gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Errors
            </Button>

            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction("delete")}
              className="text-xs font-semibold h-7 gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* 5. ACCOUNTS DATA TABLE */}
      <Card className="shadow-2xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10 text-center py-3">
                  <input
                    type="checkbox"
                    className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                    checked={data?.accounts?.length ? selectedIds.length === data.accounts.length : false}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                  />
                </TableHead>
                <TableHead className="w-24 font-bold text-foreground text-xs uppercase">Priority</TableHead>
                <TableHead className="w-36 font-bold text-foreground text-xs uppercase">Provider</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Identifier / API Key / Email</TableHead>
                <TableHead className="w-28 font-bold text-foreground text-xs uppercase text-center">State</TableHead>
                <TableHead className="w-36 font-bold text-foreground text-xs uppercase">Health</TableHead>
                <TableHead className="w-40 font-bold text-foreground text-xs uppercase">Last Updated</TableHead>
                <TableHead className="w-28 font-bold text-foreground text-xs uppercase text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.accounts?.map((acc) => {
                const isSelected = selectedIds.includes(acc.id);
                const isHighPrio = (acc.priority || 100) > 100;
                return (
                  <TableRow
                    key={acc.id}
                    className={`transition-colors hover:bg-muted/30 ${
                      isSelected ? "bg-muted/50" : ""
                    }`}
                  >
                    {/* Checkbox */}
                    <TableCell className="text-center py-2.5">
                      <input
                        type="checkbox"
                        className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(acc.id)}
                      />
                    </TableCell>

                    {/* Priority Badge */}
                    <TableCell className="font-mono text-xs">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        isHighPrio ? "bg-primary/20 text-primary border border-primary/30" : "bg-muted text-foreground"
                      }`}>
                        {acc.priority ?? 100}
                      </span>
                    </TableCell>

                    {/* Provider Tag */}
                    <TableCell>
                      <Badge
                        variant={
                          acc.provider === "kiro"
                            ? "success"
                            : acc.provider === "antigravity"
                            ? "cyan"
                            : "outline"
                        }
                        className="font-semibold text-[11px] capitalize max-w-[130px] truncate"
                        title={acc.provider}
                      >
                        {acc.provider.startsWith("openai-compatible-chat-") ? "custom node" : acc.provider}
                      </Badge>
                    </TableCell>

                    {/* Identifier with Copy Button */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-2 group max-w-[420px]">
                        <span
                          className="font-mono text-xs font-medium text-foreground truncate select-all"
                          title={acc.identifier}
                        >
                          {acc.identifier}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCopy(acc.identifier, acc.id)}
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Copy Identifier"
                        >
                          {copiedId === acc.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </TableCell>

                    {/* Active Switch Toggle */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={acc.isActive === 1}
                          onCheckedChange={() => handleToggleActive(acc.id, acc.isActive)}
                        />
                        <span className={`text-[11px] font-mono font-semibold ${
                          acc.isActive === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                        }`}>
                          {acc.isActive === 1 ? "ON" : "OFF"}
                        </span>
                      </div>
                    </TableCell>

                    {/* Health Status */}
                    <TableCell>
                      {acc.errorCount > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="destructive" className="font-mono text-[10px] font-semibold py-0.5">
                            {acc.errorCount} ERRORS
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResetError(acc.id)}
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Reset Error Count"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          HEALTHY
                        </span>
                      )}
                    </TableCell>

                    {/* Updated Timestamp */}
                    <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {acc.updatedAt ? new Date(acc.updatedAt).toLocaleString() : "-"}
                    </TableCell>

                    {/* Actions: Edit + Delete */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(acc)}
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          title="Edit Key Priority"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(acc.id)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Delete Key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {(!data?.accounts || data.accounts.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12 text-xs">
                    No keys matching current filter or search criteria
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* 6. PAGINATION FOOTER */}
        <div className="p-3.5 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-muted/15 font-mono">
          <div className="text-muted-foreground">
            Showing Page <strong className="text-foreground">{page}</strong> of{" "}
            <strong className="text-foreground">{totalPages}</strong> ({data?.total || 0} total keys)
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

      {/* CREATE MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Upstream Key</DialogTitle>
            <DialogDescription>
              Register a new provider API key, service token, or connection.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Provider Cluster</label>
              <select
                value={formData.provider}
                onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                className="w-full h-9 mt-1 px-3 rounded-md border border-input bg-background text-sm font-medium"
              >
                <option value="kiro">kiro</option>
                <option value="antigravity">antigravity</option>
                <option value="fireworks">fireworks</option>
                <option value="openai">openai</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">API Key / Token / Identifier</label>
              <Input
                value={formData.identifier}
                onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                placeholder="sk-... or email or session token"
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Priority Weight (Higher = Picked First)</label>
              <Input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value, 10) || 100 })}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleCreate}>
              Save Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EDIT MODAL */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Key Routing Priority</DialogTitle>
            <DialogDescription>
              Adjust load balancer priority weight and active status for this key.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Provider</label>
              <div className="mt-1 font-mono text-xs font-bold capitalize text-foreground px-3 py-2 bg-muted/60 rounded">
                {editFormData.provider}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Identifier / Credential</label>
              <div className="mt-1 font-mono text-xs truncate text-foreground px-3 py-2 bg-muted/60 rounded" title={editFormData.name}>
                {editFormData.name}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Priority Weight (Higher = Picked First)</label>
              <Input
                type="number"
                value={editFormData.priority}
                onChange={(e) => setEditFormData({ ...editFormData, priority: parseInt(e.target.value, 10) || 100 })}
                className="mt-1 font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleSaveEdit}>
              Update Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* IMPORT MODAL */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Batch Import Keys (JSON)</DialogTitle>
            <DialogDescription>
              Paste an array of provider keys in JSON format to register them in bulk.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <textarea
              rows={9}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='[{"provider": "kiro", "identifier": "user@example.com", "priority": 100}]'
              className="w-full rounded-md border border-input bg-background p-3 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleImport}>
              Run Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
