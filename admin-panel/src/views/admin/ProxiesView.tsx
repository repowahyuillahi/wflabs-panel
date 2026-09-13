import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, ProxiesResponse } from "@/lib/api";
import { Plus, Trash2, Network, Activity, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function ProxiesView() {
  const [data, setData] = useState<ProxiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    url: "",
    type: "http",
  });

  const loadProxies = async () => {
    try {
      setLoading(true);
      const res = await api.getProxies();
      setData(res);
    } catch (err: any) {
      toast.error(err.message || "Failed to load proxy pools");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProxies();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.url.trim()) {
      toast.error("Proxy name and URL are required");
      return;
    }
    try {
      await api.saveProxy(formData);
      toast.success("Proxy pool saved successfully");
      setModalOpen(false);
      setFormData({ name: "", url: "", type: "http" });
      loadProxies();
    } catch (err: any) {
      toast.error(err.message || "Failed to save proxy");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this proxy pool?")) return;
    try {
      await api.deleteProxy(id);
      toast.success("Proxy deleted");
      loadProxies();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete proxy");
    }
  };

  const handleTest = async (id: string) => {
    try {
      setTestingId(id);
      const res = await api.testProxy(id);
      toast.success(`Proxy Latency: ${res.latencyMs}ms (${res.status})`);
      loadProxies();
    } catch (err: any) {
      toast.error(err.message || "Proxy test failed");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Proxy Pools</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Egress proxy tunnels and IP rotation pools for upstream connections
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProxies}
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
            Add Proxy
          </Button>
        </div>
      </div>

      <Card className="shadow-2xs border-border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="font-bold text-foreground text-xs uppercase py-3">Proxy Name</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase">Endpoint URL</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-24">Type</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-28">State</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-32 text-center">Latency</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-40">Last Checked</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-36">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.proxies?.map((p) => (
                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold text-xs text-foreground flex items-center gap-2 py-3">
                    <Network className="w-4 h-4 text-primary shrink-0" />
                    <span>{p.name}</span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-foreground max-w-[280px] truncate select-all" title={p.url}>
                    {p.url}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono uppercase text-[10px] font-semibold">
                      {p.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.isActive ? "success" : "secondary"} className="font-mono text-[10px]">
                      {p.isActive ? "ACTIVE" : "DISABLED"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs font-bold">
                    {p.latencyMs ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10">
                        {p.latencyMs}ms
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {p.lastChecked ? new Date(p.lastChecked).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(p.id)}
                        disabled={testingId === p.id}
                        className="h-7 px-2.5 text-xs font-semibold gap-1"
                      >
                        <Activity className="w-3 h-3 text-primary" />
                        {testingId === p.id ? "Testing..." : "Test"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(p.id)}
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="Delete Proxy Pool"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!data?.proxies || data.proxies.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12 text-xs">
                    No proxy pools configured. Outbound requests connect directly.
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
            <DialogTitle>Add Proxy Pool Endpoint</DialogTitle>
            <DialogDescription>
              Configure an outbound HTTP or SOCKS5 proxy to route model traffic.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Proxy Label Name</label>
              <Input
                placeholder="e.g. US Residential Pool #1"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 text-xs font-medium"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Proxy Endpoint URL</label>
              <Input
                placeholder="http://user:pass@proxy.example.com:8080"
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Proxy Protocol</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full h-9 mt-1 px-3 rounded-md border border-input bg-background text-sm font-medium"
              >
                <option value="http">HTTP / HTTPS</option>
                <option value="socks5">SOCKS5</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="success" onClick={handleCreate}>
              Save Proxy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
