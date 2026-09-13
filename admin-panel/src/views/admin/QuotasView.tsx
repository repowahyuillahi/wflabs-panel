import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, MembersResponse, QuotaPackage, CdKeyItem } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/utils";
import {
  Sliders,
  Settings2,
  RefreshCw,
  Ticket,
  Plus,
  Copy,
  Check,
  Trash2,
  Sparkles,
  Gift,
  CheckCircle2,
  Clock,
  Layers
} from "lucide-react";
import { toast } from "sonner";

export function QuotasView() {
  const [activeTab, setActiveTab] = useState<"members" | "packages" | "cdkeys">("members");

  // Members data
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [maxTokens, setMaxTokens] = useState<number>(10000000);
  const [maxCost, setMaxCost] = useState<number>(50);
  const [memberPlan, setMemberPlan] = useState<string>("Starter Tier");

  // Packages data
  const [packages, setPackages] = useState<QuotaPackage[]>([
    { id: "free", name: "Free Trial", maxTokens: 2000000, maxCost: 10, description: "2M trial tokens" },
    { id: "starter", name: "Starter Tier", maxTokens: 10000000, maxCost: 35, description: "10M tokens / month" },
    { id: "developer", name: "Developer Tier", maxTokens: 50000000, maxCost: 120, description: "50M tokens / month" },
    { id: "pro", name: "Pro Studio", maxTokens: 200000000, maxCost: 350, description: "200M tokens / month" },
    { id: "enterprise", name: "Enterprise Ultra", maxTokens: 1000000000, maxCost: 1500, description: "1B tokens / month" }
  ]);

  // CD Keys data
  const [cdkeys, setCdkeys] = useState<CdKeyItem[]>([]);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [keyFilter, setKeyFilter] = useState("all");

  const [genForm, setGenForm] = useState({
    count: 1,
    plan: "Starter Tier",
    tokens: 10000000,
    maxCost: 35,
    prefix: "WFLABS",
  });

  const loadAll = async () => {
    try {
      setLoading(true);
      const [mRes, pRes, cRes] = await Promise.all([
        api.getMembers(),
        api.getQuotaPackages().catch(() => ({ ok: false, packages: [] })),
        api.getCdKeys().catch(() => ({ ok: false, cdkeys: [] })),
      ]);
      setData(mRes);
      if (pRes.ok && pRes.packages?.length) setPackages(pRes.packages);
      if (cRes.ok && cRes.cdkeys) setCdkeys(cRes.cdkeys);
    } catch (err: any) {
      toast.error(err.message || "Failed to load quota and voucher data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const openConfig = (m: any) => {
    setSelectedMember(m);
    const curQuota = m.quota || {};
    setMaxTokens(curQuota.maxTokens || m.maxTokens || 10000000);
    setMaxCost(curQuota.maxCost || m.maxCost || 50);
    setMemberPlan(curQuota.plan || "Starter Tier");
    setModalOpen(true);
  };

  const handleApplyPackagePreset = (pkg: QuotaPackage) => {
    setMaxTokens(pkg.maxTokens);
    setMaxCost(pkg.maxCost);
    setMemberPlan(pkg.name);
    toast.info(`Loaded preset: ${pkg.name}`);
  };

  const handleSaveQuota = async () => {
    if (!selectedMember) return;
    try {
      await api.updateMemberQuota(selectedMember.id, {
        maxTokens,
        maxCost,
        plan: memberPlan
      } as any);
      toast.success(`Quota limits updated for ${selectedMember.name}`);
      setModalOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to update quota limits");
    }
  };

  // Generate CD Keys
  const handleSelectPackageForGen = (pkg: QuotaPackage) => {
    setGenForm({
      ...genForm,
      plan: pkg.name,
      tokens: pkg.maxTokens,
      maxCost: pkg.maxCost,
    });
  };

  const handleGenerateKeys = async () => {
    try {
      const res = await api.generateCdKeys(genForm);
      toast.success(`Generated ${res.count} CD Key voucher(s)`);
      setGenModalOpen(false);
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to generate CD Keys");
    }
  };

  const handleDeleteKey = async (code: string) => {
    if (!confirm(`Revoke and delete CD Key voucher "${code}"?`)) return;
    try {
      await api.deleteCdKey(code);
      toast.success("CD Key deleted");
      loadAll();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete CD key");
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("CD Key copied to clipboard");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredCdKeys = cdkeys.filter((k) => {
    if (keyFilter === "active" && k.status !== "active") return false;
    if (keyFilter === "claimed" && k.status !== "claimed") return false;
    return true;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* 1. Header with View Tabs & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Quota Limits &amp; Tier Vouchers</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage client consumption caps, predefined tier packages, and CD Key redeem vouchers
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Tabs */}
          <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
            <button
              onClick={() => setActiveTab("members")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "members" ? "bg-background text-foreground shadow-2xs" : "hover:text-foreground"
              }`}
            >
              Member Quotas
            </button>
            <button
              onClick={() => setActiveTab("packages")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "packages" ? "bg-background text-foreground shadow-2xs" : "hover:text-foreground"
              }`}
            >
              Tier Packages
            </button>
            <button
              onClick={() => setActiveTab("cdkeys")}
              className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                activeTab === "cdkeys" ? "bg-background text-foreground shadow-2xs" : "hover:text-foreground"
              }`}
            >
              CD Key Vouchers
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadAll}
            className="gap-1.5 text-xs font-semibold h-9"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>

          {activeTab === "cdkeys" && (
            <Button
              variant="success"
              size="sm"
              onClick={() => setGenModalOpen(true)}
              className="gap-1.5 text-xs font-semibold h-9"
            >
              <Ticket className="w-3.5 h-3.5" />
              Generate CD Keys
            </Button>
          )}
        </div>
      </div>

      {/* 2. TAB 1: MEMBER QUOTAS & CONSUMPTION GAUGE */}
      {activeTab === "members" && (
        <Card className="shadow-2xs border-border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-bold text-foreground text-xs uppercase py-3 w-52">Member / Consumer</TableHead>
                  <TableHead className="font-bold text-foreground text-xs uppercase w-36">Current Plan</TableHead>
                  <TableHead className="font-bold text-foreground text-xs uppercase">Token Usage / Allowance</TableHead>
                  <TableHead className="font-bold text-foreground text-xs uppercase w-48">Spend Limit (USD)</TableHead>
                  <TableHead className="font-bold text-foreground text-xs uppercase w-60">Usage Gauge</TableHead>
                  <TableHead className="font-bold text-foreground text-xs uppercase text-right w-28">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.members?.map((m) => {
                  const quota = m.quota || {};
                  const allowance = quota.maxTokens || m.maxTokens || 10000000;
                  const pct = Math.min(100, Math.round((m.totalTokens / allowance) * 100));
                  const plan = quota.plan || "Starter Tier";

                  return (
                    <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-bold text-xs text-foreground flex items-center gap-2 py-3">
                        <Sliders className="w-4 h-4 text-primary shrink-0" />
                        <span>{m.name || "Unnamed"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="cyan" className="font-mono text-[10px] font-semibold">
                          {plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        <span>{formatNumber(m.totalTokens)}</span>
                        <span className="text-muted-foreground font-normal"> / {formatNumber(allowance)} tok</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(m.totalCost)}</span>
                        <span className="text-muted-foreground font-normal"> / {formatCurrency(quota.maxCost || m.maxCost || 50)}</span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
                            <span className="font-bold text-foreground">{pct}% Used</span>
                            <span>{100 - pct}% Left</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-emerald-600"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openConfig(m)}
                          className="h-7 px-2.5 text-xs font-semibold gap-1"
                        >
                          <Settings2 className="w-3 h-3 text-primary" />
                          Set Caps
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!data?.members || data.members.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12 text-xs">
                      No consumer member profiles available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* 3. TAB 2: TIER PACKAGES MATRIX */}
      {activeTab === "packages" && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="shadow-2xs border-border flex flex-col justify-between hover:border-primary/50 transition-colors">
              <CardHeader className="p-4 pb-2 space-y-1">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono text-[10px] uppercase font-semibold">
                    {pkg.id}
                  </Badge>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle className="text-base font-bold text-foreground pt-1">{pkg.name}</CardTitle>
                <CardDescription className="text-xs text-muted-foreground">{pkg.description}</CardDescription>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-3">
                <div className="p-2.5 rounded-lg bg-muted/40 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tokens:</span>
                    <span className="font-bold text-foreground">{formatNumber(pkg.maxTokens)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Spend Cap:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(pkg.maxCost)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Available for CD Key generation</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 4. TAB 3: CD KEY VOUCHER MANAGER */}
      {activeTab === "cdkeys" && (
        <div className="space-y-3">
          {/* Sub filter bar */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-card text-xs">
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-muted-foreground">Filter Status:</span>
              <select
                value={keyFilter}
                onChange={(e) => setKeyFilter(e.target.value)}
                className="h-8 px-2.5 rounded border border-input bg-background font-medium focus:outline-none"
              >
                <option value="all">All Vouchers ({cdkeys.length})</option>
                <option value="active">Active / Unclaimed ({cdkeys.filter((k) => k.status === "active").length})</option>
                <option value="claimed">Claimed ({cdkeys.filter((k) => k.status === "claimed").length})</option>
              </select>
            </div>

            <span className="font-mono text-muted-foreground">
              Total Vouchers: <strong className="text-foreground">{cdkeys.length}</strong>
            </span>
          </div>

          <Card className="shadow-2xs border-border overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-bold text-foreground text-xs uppercase py-3 w-64">Voucher CD Key</TableHead>
                    <TableHead className="font-bold text-foreground text-xs uppercase w-36">Tier Package</TableHead>
                    <TableHead className="font-bold text-foreground text-xs uppercase w-36">Tokens Added</TableHead>
                    <TableHead className="font-bold text-foreground text-xs uppercase w-32">Spend Cap</TableHead>
                    <TableHead className="font-bold text-foreground text-xs uppercase w-28 text-center">Status</TableHead>
                    <TableHead className="font-bold text-foreground text-xs uppercase">Claimed By</TableHead>
                    <TableHead className="font-bold text-foreground text-xs uppercase text-right w-20">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCdKeys.map((k) => (
                    <TableRow key={k.code} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-2.5">
                        <div className="flex items-center gap-2 group">
                          <span className="font-mono text-xs font-bold text-foreground select-all">{k.code}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleCopyCode(k.code)}
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Copy CD Key"
                          >
                            {copiedCode === k.code ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="cyan" className="font-mono text-[10px] font-semibold">
                          {k.plan}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-mono text-xs font-bold text-foreground">
                        +{formatNumber(k.tokens)}
                      </TableCell>

                      <TableCell className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(k.maxCost)}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant={k.status === "active" ? "success" : "secondary"}
                          className="font-mono text-[10px] font-bold"
                        >
                          {k.status === "active" ? "ACTIVE / UNUSED" : "CLAIMED"}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs font-mono">
                        {k.claimedBy ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{k.claimedBy}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {k.claimedAt ? new Date(k.claimedAt).toLocaleString() : "-"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic">Not claimed yet</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteKey(k.code)}
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          title="Revoke / Delete CD Key"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}

                  {filteredCdKeys.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-12 text-xs">
                        No voucher CD keys found. Click "Generate CD Keys" to issue new codes.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 1: EDIT MEMBER QUOTA & ASSIGN PRESET TIER */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configure Quotas: {selectedMember?.name}</DialogTitle>
            <DialogDescription>
              Assign a preset package tier or customize exact token allowances.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1.5">
                Quick Apply Preset Package Tier
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => handleApplyPackagePreset(pkg)}
                    className={`p-2 rounded-md border text-left text-xs transition-all ${
                      memberPlan === pkg.name ? "border-primary bg-primary/10 font-bold" : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="font-bold">{pkg.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{formatNumber(pkg.maxTokens)} tok</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Plan Label</label>
              <Input
                value={memberPlan}
                onChange={(e) => setMemberPlan(e.target.value)}
                className="mt-1 text-xs font-medium"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Token Allowance Limit</label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 0)}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Spending Limit Cap (USD)</label>
              <Input
                type="number"
                value={maxCost}
                onChange={(e) => setMaxCost(parseFloat(e.target.value) || 0)}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleSaveQuota}>
              Save Limits
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: GENERATE CD KEYS */}
      <Dialog open={genModalOpen} onOpenChange={setGenModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate CD Key Vouchers</DialogTitle>
            <DialogDescription>
              Create redeemable voucher codes that members can claim via the Member Portal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase block mb-1">
                Choose Plan / Package
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    type="button"
                    onClick={() => handleSelectPackageForGen(pkg)}
                    className={`p-2 rounded-md border text-left text-xs transition-all ${
                      genForm.plan === pkg.name ? "border-primary bg-primary/10 font-bold" : "border-border hover:bg-muted"
                    }`}
                  >
                    <div className="font-bold">{pkg.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">+{formatNumber(pkg.maxTokens)} tok</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Number of Vouchers to Generate</label>
              <select
                value={genForm.count}
                onChange={(e) => setGenForm({ ...genForm, count: Number(e.target.value) })}
                className="w-full h-9 mt-1 px-3 rounded-md border border-input bg-background text-xs font-semibold focus:outline-none"
              >
                <option value={1}>1 Single Code</option>
                <option value={5}>Batch of 5 Codes</option>
                <option value={10}>Batch of 10 Codes</option>
                <option value={25}>Batch of 25 Codes</option>
                <option value={50}>Batch of 50 Codes</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Tokens to Credit</label>
              <Input
                type="number"
                value={genForm.tokens}
                onChange={(e) => setGenForm({ ...genForm, tokens: Number(e.target.value) })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Spending Limit Cap ($)</label>
              <Input
                type="number"
                value={genForm.maxCost}
                onChange={(e) => setGenForm({ ...genForm, maxCost: Number(e.target.value) })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Code Prefix</label>
              <Input
                value={genForm.prefix}
                onChange={(e) => setGenForm({ ...genForm, prefix: e.target.value.toUpperCase() })}
                placeholder="WFLABS"
                className="mt-1 font-mono text-xs uppercase"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleGenerateKeys}>
              Generate Codes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
