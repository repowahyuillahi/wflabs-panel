import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, CustomModelsResponse } from "@/lib/api";
import { Plus, Trash2, Layers, RefreshCw, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export function CustomModelsView() {
  const [data, setData] = useState<CustomModelsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    provider: "openai-compatible",
    displayName: "",
    mapping: "",
  });

  const loadCustomModels = async () => {
    try {
      setLoading(true);
      const res = await api.getCustomModels();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load custom models");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomModels();
  }, []);

  const handleCreate = async () => {
    if (!formData.id.trim() || !formData.mapping.trim()) {
      toast.error("Model ID and Target Mapping are required");
      return;
    }
    try {
      await api.saveCustomModel(formData);
      toast.success("Custom model alias mapping saved");
      setModalOpen(false);
      setFormData({ id: "", provider: "openai-compatible", displayName: "", mapping: "" });
      loadCustomModels();
    } catch (err: any) {
      toast.error(err.message || "Failed to save custom model");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete custom model mapping "${id}"?`)) return;
    try {
      await api.deleteCustomModel(id);
      toast.success("Custom model mapping deleted");
      loadCustomModels();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete custom model");
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Custom Model Mappings</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create friendly alias model names that route internally to upstream target models
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadCustomModels}
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
            Add Custom Model
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="shadow-2xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-bold text-foreground text-xs uppercase py-3 w-44">Provider Cluster</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Alias Model ID</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Display Label</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Target Upstream Route</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.models?.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold text-xs text-foreground flex items-center gap-2 py-3">
                    <Layers className="w-4 h-4 text-primary shrink-0" />
                    <span>{m.provider}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-foreground select-all">{m.id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-medium">{m.displayName || m.id}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-bold">
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>{m.mapping || m.id}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(m.id)}
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      title="Delete Custom Model"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.models || data.models.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12 text-xs">
                    No custom model aliases registered yet
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
            <DialogTitle>Register Custom Model Alias</DialogTitle>
            <DialogDescription>
              Map an exposed incoming model identifier to an actual target upstream model.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Alias Model ID (Incoming)</label>
              <Input
                placeholder="e.g. gpt-4o-mini-fast"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Target Upstream Model ID</label>
              <Input
                placeholder="e.g. gpt-4o-mini"
                value={formData.mapping}
                onChange={(e) => setFormData({ ...formData, mapping: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Display Label Name</label>
              <Input
                placeholder="e.g. GPT-4o Mini Fast Mode"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="mt-1 text-xs font-medium"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleCreate}>
              Save Alias
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
