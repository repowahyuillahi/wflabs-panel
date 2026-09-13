import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { api, MembersResponse } from "@/lib/api";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Copy, KeyRound, Check, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export function MembersView() {
  const [data, setData] = useState<MembersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    machineId: "",
  });

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

  useEffect(() => {
    loadMembers();
  }, []);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Member label/name is required");
      return;
    }
    try {
      await api.createMember(formData);
      toast.success("Member key created successfully");
      setModalOpen(false);
      setFormData({ name: "", machineId: "" });
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to create member");
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await api.toggleMember(id);
      toast.success("Member access status toggled");
      loadMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle member");
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

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Members &amp; Consumer Keys</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Issue and govern client API keys, machine bindings, and consumption limits
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMembers}
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
                <TableHead className="font-bold text-foreground text-xs uppercase w-40">Machine Binding</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase w-28 text-center">State</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-28">Requests</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-36">Tokens Billed</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-32">Total USD</TableHead>
                <TableHead className="font-bold text-foreground text-xs uppercase text-right w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.members?.map((m) => (
                <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-bold text-xs text-foreground flex items-center gap-2 py-3">
                    <KeyRound className="w-4 h-4 text-primary shrink-0" />
                    <span>{m.name || "Unnamed Consumer"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 group max-w-[260px]">
                      <span className="font-mono text-xs text-foreground truncate select-all">{m.key}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyKey(m.key, m.id)}
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  <TableCell className="font-mono text-xs">
                    {m.machineId ? (
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {m.machineId}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">Unbound (Any)</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Switch
                        checked={m.isActive === 1}
                        onCheckedChange={() => handleToggle(m.id)}
                      />
                      <span className={`text-[11px] font-mono font-bold ${
                        m.isActive === 1 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                      }`}>
                        {m.isActive === 1 ? "ACTIVE" : "OFF"}
                      </span>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(m.id)}
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      title="Revoke Key"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
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

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Consumer Gateway Key</DialogTitle>
            <DialogDescription>
              Create an API key for developers, Cursor, Cline, or external client applications.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
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
                placeholder="Leave blank for unrestricted client machine access"
                value={formData.machineId}
                onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
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
    </div>
  );
}
