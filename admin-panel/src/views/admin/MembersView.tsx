import React, { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, MembersResponse } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/utils";
import {
  Plus,
  Trash2,
  Copy,
  KeyRound,
  Check,
  RefreshCw,
  ShieldCheck,
  Lock,
  Unlock,
  Search,
  Cpu,
  SlidersHorizontal,
  X
} from "lucide-react";
import { toast } from "sonner";

export function MembersView() {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // All models catalog for restriction picker
  const [catalog, setCatalog] = useState<{ id: string; provider: string }[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [modelProvFilter, setModelProvFilter] = useState("all");

  // Create form
  const [formData, setFormData] = useState({
    name: "",
    machineId: "",
    maxTokens: 10000000,
    maxCost: 50,
    plan: "Starter Tier",
    allowedModels: [] as string[],
  });

  // Permission editor dialog
  const [permOpen, setPermOpen] = useState(false);
  const [permMember, setPermMember] = useState<any>(null);
  const [permModels, setPermModels] = useState<string[]>([]);
  const [permMaxTokens, setPermMaxTokens] = useState(10000000);
  const [permMaxCost, setPermMaxCost] = useState(50);
  const [savingPerm, setSavingPerm] = useState(false);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const res = await api.getMembers();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load members");
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = async () => {
    try {
      const res = await api.getModels();
      setCatalog((res.models || []).map((m) => ({ id: m.id, provider: m.provider })));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadMembers();
    loadCatalog();
  }, []);

  const catalogProviders = useMemo(
    () => Array.from(new Set(catalog.map((c) => c.provider))).sort(),
    [catalog]
  );

  const filteredCatalog = useMemo(() => {
    return catalog.filter((c) => {
      if (modelProvFilter !== "all" && c.provider !== modelProvFilter) return false;
      if (modelSearch && !c.id.toLowerCase().includes(modelSearch.toLowerCase())) return false;
      return true;
    });
  }, [catalog, modelSearch, modelProvFilter]);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Member label/name is required");
      return;
    }
    try {
      await api.createMember({
        name: formData.name,
        machineId: formData.machineId,
        maxTokens: formData.maxTokens,
        maxCost: formData.maxCost,
        plan: formData.plan,
        allowedModels: formData.allowedModels,
      });
      toast.success(
        formData.allowedModels.length > 0
          ? `Key created with ${formData.allowedModels.length} allowed model(s)`
          : "Member key created — all models allowed"
      );
      setModalOpen(false);
      setFormData({
        name: "",
        machineId: "",
        maxTokens: 10000000,
        maxCost: 50,
        plan: "Starter Tier",
        allowedModels: [],
      });
      setModelSearch("");
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create member");
    }
  };

  const handleToggle = async (id: string, currentActive: number) => {
    const nextState = currentActive === 1 ? 0 : 1;
    setData((prev) =>
      prev
        ? {
            ...prev,
            members: prev.members.map((m) =>
              m.id === id ? { ...m, isActive: nextState } : m
            ),
          }
        : prev
    );
    try {
      await api.toggleMember(id);
      toast.success("Member access status toggled");
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle member");
      loadMembers();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to revoke and delete this consumer API key?")) return;
    try {
      await api.deleteMember(id);
      toast.success("Member key revoked");
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete member");
    }
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    toast.success("API Key copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Open the model permission editor for a member
  const openPermissions = (m: any) => {
    setPermMember(m);
    setPermModels(Array.isArray(m.quota?.allowedModels) ? [...m.quota.allowedModels] : []);
    setPermMaxTokens(m.quota?.maxTokens || m.maxTokens || 10000000);
    setPermMaxCost(m.quota?.maxCost || m.maxCost || 50);
    setModelSearch("");
    setModelProvFilter("all");
    setPermOpen(true);
  };

  const togglePermModel = (id: string) => {
    setPermModels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAllowAllInView = () => {
    const ids = filteredCatalog.map((c) => c.id);
    setPermModels((prev) => Array.from(new Set([...prev, ...ids])));
    toast.info(`Added ${ids.length} model(s) to allow-list`);
  };

  const handleClearAll = () => {
    setPermModels([]);
    toast.info("Allow-list cleared — all models permitted");
  };

  const handleSavePermissions = async () => {
    if (!permMember) return;
    try {
      setSavingPerm(true);
      await api.updateMemberQuota(permMember.id, {
        maxTokens: permMaxTokens,
        maxCost: permMaxCost,
        plan: permMember.quota?.plan || "Standard",
        allowedModels: permModels,
      });
      toast.success(
        permModels.length > 0
          ? `Restricted to ${permModels.length} model(s)`
          : "All models now permitted for this key"
      );
      setPermOpen(false);
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to save model permissions");
    } finally {
      setSavingPerm(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Members &amp; Consumer Keys</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Issue client API keys, govern consumption limits, and restrict per-key model access
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadMembers();
              loadCatalog();
            }}
            className="gap-1.5 text-xs font-semibold h-9"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>

          <Button
            variant="success"
            size="sm"
            onClick={() => setModalOpen(true)}
            className="gap-1.5 text-xs font-semibold h-9"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Member Key
          </Button>
        </div>
      </div>

      <Card className="shadow-2xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-bold text-foreground text-xs uppercase py-3 w-48">Member Label</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Gateway API Key</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-36">Model Access</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-28 text-center">State</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-24">Requests</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-32">Tokens Billed</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-28">Total USD</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.members?.map((m) => {
                const allowed = m.quota?.allowedModels || [];
                const restricted = allowed.length > 0;
                return (
                  <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-bold text-xs text-foreground flex items-center gap-2 py-3">
                      <KeyRound className="w-4 h-4 text-primary shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{m.name || "Unnamed Consumer"}</span>
                        {m.machineId && m.machineId !== "-" && (
                          <span className="font-mono text-[10px] text-muted-foreground font-normal truncate">
                            {m.machineId}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 group max-w-[240px]">
                        <span className="font-mono text-xs text-foreground truncate select-all">{m.key}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyKey(m.key, m.id)}
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="Copy Key"
                        >
                          {copiedId === m.id ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {restricted ? (
                        <Badge variant="warning" className="font-mono text-[10px] font-bold gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          {allowed.length} MODEL{allowed.length > 1 ? "S" : ""}
                        </Badge>
                      ) : (
                        <Badge variant="success" className="font-mono text-[10px] font-bold gap-1">
                          <Unlock className="w-2.5 h-2.5" />
                          ALL MODELS
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={m.isActive === 1}
                          onCheckedChange={() => handleToggle(m.id, m.isActive)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                      {formatNumber(m.totalRequests)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                      {formatNumber(m.totalTokens)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(m.totalCost)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPermissions(m)}
                          className="h-7 px-2 text-[11px] font-semibold gap-1"
                          title="Restrict Allowed Models"
                        >
                          <ShieldCheck className="w-3 h-3 text-primary" />
                          Models
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(m.id)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Revoke Key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!data?.members || data.members.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12 text-xs">
                    No consumer members or client keys issued yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* CREATE MEMBER KEY MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Issue Consumer Gateway Key</DialogTitle>
            <DialogDescription>
              Create an API key for developers, Cursor, Cline, or external client applications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 max-h-[55vh] overflow-y-auto pr-1">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Member / Client Label</label>
              <Input
                placeholder="e.g. Workstation Studio #1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Machine Identifier Binding (Optional)</label>
              <Input
                placeholder="Leave blank for unrestricted machine access"
                value={formData.machineId}
                onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Token Allowance</label>
                <Input
                  type="number"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData({ ...formData, maxTokens: Number(e.target.value) })}
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Spend Cap (USD)</label>
                <Input
                  type="number"
                  value={formData.maxCost}
                  onChange={(e) => setFormData({ ...formData, maxCost: Number(e.target.value) })}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>

            {/* Model access scope */}
            <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-foreground">Allowed Model Scope</span>
                </div>
                <Badge variant={formData.allowedModels.length > 0 ? "warning" : "success"} className="text-[10px] font-mono font-bold">
                  {formData.allowedModels.length > 0
                    ? `${formData.allowedModels.length} SELECTED`
                    : "ALL MODELS"}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Leave empty to permit every model. Selecting specific models restricts this key to a whitelist.
              </p>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter models..."
                    value={modelSearch}
                    onChange={(e) => setModelSearch(e.target.value)}
                    className="h-8.5 pl-8 text-xs bg-background"
                  />
                </div>
                <select
                  value={modelProvFilter}
                  onChange={(e) => setModelProvFilter(e.target.value)}
                  className="h-8.5 px-2 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
                >
                  <option value="all">All ({catalog.length})</option>
                  {catalogProviders.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background p-1.5 space-y-0.5">
                {filteredCatalog.slice(0, 200).map((c) => {
                  const selected = formData.allowedModels.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          allowedModels: selected
                            ? prev.allowedModels.filter((x) => x !== c.id)
                            : [...prev.allowedModels, c.id],
                        }))
                      }
                      className={`w-full flex items-center justify-between px-2 py-1 rounded text-left text-[11px] font-mono transition-colors ${
                        selected ? "bg-primary/10 text-primary font-bold" : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="truncate">{c.id}</span>
                      <span className="flex items-center gap-2 shrink-0 pl-2">
                        <span className="text-[9px] uppercase text-muted-foreground">{c.provider}</span>
                        {selected && <Check className="w-3 h-3" />}
                      </span>
                    </button>
                  );
                })}
                {filteredCatalog.length === 0 && (
                  <div className="text-center text-muted-foreground text-[11px] py-4">No models match filter</div>
                )}
              </div>

              {formData.allowedModels.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {formData.allowedModels.slice(0, 8).map((id) => (
                    <Badge key={id} variant="outline" className="font-mono text-[9px] gap-1 pr-1">
                      <span className="truncate max-w-[120px]">{id}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            allowedModels: prev.allowedModels.filter((x) => x !== id),
                          }))
                        }
                        className="hover:text-destructive"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </Badge>
                  ))}
                  {formData.allowedModels.length > 8 && (
                    <Badge variant="secondary" className="text-[9px] font-mono">
                      +{formData.allowedModels.length - 8} more
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleCreate}>
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODEL PERMISSION EDITOR DIALOG */}
      <Dialog open={permOpen} onOpenChange={setPermOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Allowed Models — {permMember?.name}</DialogTitle>
            <DialogDescription>
              Whitelist which models this API key may call. Empty list = unrestricted access.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* Status banner */}
            <div className={`flex items-center justify-between p-3 rounded-lg border text-xs ${
              permModels.length > 0
                ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                : "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
            }`}>
              <div className="flex items-center gap-2 font-semibold">
                {permModels.length > 0 ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                <span>
                  {permModels.length > 0
                    ? `Restricted to ${permModels.length} model(s) — other models return HTTP 403`
                    : "Unrestricted — all gateway models are callable"}
                </span>
              </div>
            </div>

            {/* Quota quick edit */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Token Allowance</label>
                <Input
                  type="number"
                  value={permMaxTokens}
                  onChange={(e) => setPermMaxTokens(Number(e.target.value))}
                  className="mt-1 font-mono text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Spend Cap (USD)</label>
                <Input
                  type="number"
                  value={permMaxCost}
                  onChange={(e) => setPermMaxCost(Number(e.target.value))}
                  className="mt-1 font-mono text-xs"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search models..."
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  className="h-8.5 pl-8 text-xs"
                />
              </div>
              <select
                value={modelProvFilter}
                onChange={(e) => setModelProvFilter(e.target.value)}
                className="h-8.5 px-2.5 rounded-md border border-input bg-background text-xs font-semibold text-foreground focus:outline-none"
              >
                <option value="all">All Providers</option>
                {catalogProviders.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Bulk actions */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleAllowAllInView} className="h-7 text-[11px] font-semibold">
                Allow All In View ({filteredCatalog.length})
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearAll} className="h-7 text-[11px] font-semibold">
                Clear — Allow Everything
              </Button>
            </div>

            {/* Model list */}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-card p-1.5 space-y-0.5">
              {filteredCatalog.slice(0, 400).map((c) => {
                const selected = permModels.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => togglePermModel(c.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-left transition-colors ${
                      selected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                        selected ? "bg-primary border-primary" : "border-input"
                      }`}>
                        {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                      <span className={`font-mono text-[11px] truncate ${selected ? "font-bold text-primary" : "text-foreground"}`}>
                        {c.id}
                      </span>
                    </div>
                    <Badge variant="outline" className="font-mono text-[9px] uppercase shrink-0 ml-2">
                      {c.provider}
                    </Badge>
                  </button>
                );
              })}
              {filteredCatalog.length === 0 && (
                <div className="text-center text-muted-foreground text-xs py-8">No models match current filter</div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleSavePermissions} disabled={savingPerm}>
              {savingPerm ? "Saving..." : "Save Permissions"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
