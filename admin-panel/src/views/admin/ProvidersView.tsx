import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, ProvidersResponse } from "@/lib/api";
import { Plus, Trash2, Server, Globe, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function ProvidersView() {
  const [data, setData] = useState<ProvidersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    prefix: "",
    apiType: "chat",
    baseUrl: "",
  });

  const loadProviders = async () => {
    try {
      setLoading(true);
      const res = await api.getProviders();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load provider nodes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Provider name is required");
      return;
    }
    try {
      await api.saveProvider(formData);
      toast.success("Provider node saved successfully");
      setModalOpen(false);
      setFormData({ name: "", prefix: "", apiType: "chat", baseUrl: "" });
      loadProviders();
    } catch (err: any) {
      toast.error(err.message || "Failed to save provider node");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Are you sure you want to delete provider node "${id}"?`)) return;
    try {
      await api.deleteProvider(id);
      toast.success("Provider node deleted");
      loadProviders();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete provider");
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Provider Nodes</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Upstream OpenAI-compatible endpoints, custom clusters, and model prefix routing
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProviders}
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
            Add Provider
          </Button>
        </div>
      </div>

      {/* Main Card & Table */}
      <Card className="shadow-2xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-bold text-foreground text-xs uppercase py-3">Provider Name</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Node Identifier</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-28">Type</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-28">Prefix</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Target Base URL</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-center w-32">Accounts</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.nodes?.map((node) => (
                <TableRow key={node.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold text-xs text-foreground flex items-center gap-2 py-3">
                    <Server className="w-4 h-4 text-primary shrink-0" />
                    <span>{node.name}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground select-all">{node.id}</TableCell>
                  <TableCell>
                    <Badge variant={node.type === "builtin" ? "outline" : "cyan"} className="font-mono text-[10px] font-semibold">
                      {node.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-foreground">
                    {node.prefix || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground max-w-[280px] truncate" title={node.baseUrl}>
                    {node.baseUrl || "-"}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded bg-emerald-500/10">
                      {node.accountActive} / {node.accountCount} active
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {node.type !== "builtin" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(node.id)}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="Delete Provider Node"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.nodes || data.nodes.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12 text-xs">
                    No provider nodes registered
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
            <DialogTitle>Add Custom Provider Node</DialogTitle>
            <DialogDescription>
              Connect an OpenAI-compatible upstream endpoint to route models through 9Router.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Provider Label Name</label>
              <Input
                placeholder="e.g. DeepSeek Official"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 font-medium text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Routing Model Prefix</label>
              <Input
                placeholder="e.g. deepseek"
                value={formData.prefix}
                onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Target Base URL Endpoint</label>
              <Input
                placeholder="https://api.deepseek.com/v1"
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleCreate}>
              Save Provider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
