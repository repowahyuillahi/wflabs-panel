import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, PricingResponse } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { Plus, DollarSign, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function PricingView() {
  const [data, setData] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    model: "",
    promptPricePerM: 3.0,
    completionPricePerM: 15.0,
    cachedPricePerM: 0.75,
  });

  const loadPricing = async () => {
    try {
      setLoading(true);
      const res = await api.getPricing();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load pricing table");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPricing();
  }, []);

  const handleSave = async () => {
    if (!formData.model.trim()) {
      toast.error("Model identifier is required");
      return;
    }
    try {
      await api.savePricing(formData);
      toast.success("Pricing rate saved successfully");
      setModalOpen(false);
      setFormData({ model: "", promptPricePerM: 3.0, completionPricePerM: 15.0, cachedPricePerM: 0.75 });
      loadPricing();
    } catch (err: any) {
      toast.error(err.message || "Failed to save rate");
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Token Pricing Matrix</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define token billing rates applied per 1,000,000 (1M) tokens in USD
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPricing}
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
            Custom Rate
          </Button>
        </div>
      </div>

      <Card className="shadow-2xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-bold text-foreground text-xs uppercase py-3">Model Key Pattern</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-44">Prompt / 1M</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-44">Completion / 1M</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-44">Cached Read / 1M</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-center w-28">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.rates?.map((r) => (
                <TableRow key={r.model} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold text-xs text-foreground flex items-center gap-2 py-3">
                    <DollarSign className="w-4 h-4 text-primary shrink-0" />
                    <span className="font-mono text-xs">{r.model}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(r.promptPricePerM)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400">
                    {formatCurrency(r.completionPricePerM)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-medium text-muted-foreground">
                    {formatCurrency(r.cachedPricePerM)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={r.isCustom ? "cyan" : "outline"} className="font-mono text-[10px] font-semibold">
                      {r.isCustom ? "CUSTOM" : "SYSTEM DEFAULT"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.rates || data.rates.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12 text-xs">
                    No custom pricing overrides configured. Default gateway rates active.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set Custom Model Pricing</DialogTitle>
            <DialogDescription>
              Configure custom USD rates per 1,000,000 tokens for specific models.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Model Pattern ID</label>
              <Input
                placeholder="e.g. claude-3-5-sonnet-20241022"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Prompt Rate / 1M Tokens ($)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.promptPricePerM}
                onChange={(e) => setFormData({ ...formData, promptPricePerM: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Completion Rate / 1M Tokens ($)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.completionPricePerM}
                onChange={(e) => setFormData({ ...formData, completionPricePerM: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Cached Rate / 1M Tokens ($)</label>
              <Input
                type="number"
                step="0.01"
                value={formData.cachedPricePerM}
                onChange={(e) => setFormData({ ...formData, cachedPricePerM: parseFloat(e.target.value) || 0 })}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleSave}>
              Save Pricing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
