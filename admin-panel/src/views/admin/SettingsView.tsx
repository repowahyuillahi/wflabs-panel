import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, SettingsResponse } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { Database, ShieldCheck, Download, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";

export function SettingsView() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [config, setConfig] = useState({
    requireApiKey: true,
    requireLogin: false,
    recaptchaSiteKey: "",
    recaptchaSecretKey: "",
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getSettings();
      setData(res);
      if (res.config) {
        setConfig({
          requireApiKey: res.config.requireApiKey ?? true,
          requireLogin: res.config.requireLogin ?? false,
          recaptchaSiteKey: res.config.recaptchaSiteKey ?? "",
          recaptchaSecretKey: res.config.recaptchaSecretKey ?? "",
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      await api.saveSettings(config);
      toast.success("Gateway security configuration saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateSnapshot = async () => {
    try {
      setBackingUp(true);
      const res = await api.createBackup();
      toast.success(`SQLite snapshot created: ${res.backup?.filename || "Success"}`);
      loadSettings();
    } catch (err: any) {
      toast.error(err.message || "Failed to create snapshot");
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">System Settings &amp; Backups</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure gateway security rules, reCAPTCHA v3 keys, and SQLite database snapshot archives
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadSettings}
          className="gap-1.5 text-xs font-semibold h-9"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Core Gateway Security */}
        <Card className="shadow-2xs border-border">
          <CardHeader className="py-4 px-6 border-b space-y-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <CardTitle className="text-sm font-bold">Core Gateway Security</CardTitle>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Authentication and client challenge requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Require API Key on Gateway</label>
              <select
                value={config.requireApiKey ? "true" : "false"}
                onChange={(e) => setConfig({ ...config, requireApiKey: e.target.value === "true" })}
                className="w-full h-9 mt-1 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground"
              >
                <option value="true">YES - ENFORCE BEARER API KEY</option>
                <option value="false">NO - PERMIT LOCAL DIRECT CALLS</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Web UI Portal Login</label>
              <select
                value={config.requireLogin ? "true" : "false"}
                onChange={(e) => setConfig({ ...config, requireLogin: e.target.value === "true" })}
                className="w-full h-9 mt-1 px-3 rounded-md border border-input bg-background text-xs font-semibold text-foreground"
              >
                <option value="true">ENABLED - REQUIRE AUTHENTICATION</option>
                <option value="false">DISABLED - OPEN ACCESS</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Google reCAPTCHA v3 Site Key</label>
              <Input
                placeholder="6L..."
                value={config.recaptchaSiteKey}
                onChange={(e) => setConfig({ ...config, recaptchaSiteKey: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Google reCAPTCHA v3 Secret Key</label>
              <Input
                type="password"
                placeholder="6L..."
                value={config.recaptchaSecretKey}
                onChange={(e) => setConfig({ ...config, recaptchaSecretKey: e.target.value })}
                className="mt-1 font-mono text-xs"
              />
            </div>

            <Button
              variant="success"
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full text-xs font-semibold h-9 mt-2 gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving Changes..." : "Save Security Configuration"}
            </Button>
          </CardContent>
        </Card>

        {/* SQLite Database Snapshots */}
        <Card className="shadow-2xs border-border flex flex-col">
          <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between space-y-0">
            <div>
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold">SQLite Snapshot Archives</CardTitle>
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                On-demand database snapshots stored in /backups
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateSnapshot}
              disabled={backingUp}
              className="text-xs font-semibold gap-1.5 h-8"
            >
              <Database className="w-3.5 h-3.5 text-primary" />
              {backingUp ? "Creating..." : "Create Snapshot"}
            </Button>
          </CardHeader>

          <CardContent className="p-0 flex-1 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-bold text-foreground text-xs uppercase py-3">Snapshot Filename</TableHead>
                  <TableHead className="font-bold text-foreground text-xs uppercase w-28 text-right">Size</TableHead>
                  <TableHead className="font-bold text-foreground text-xs uppercase w-44 text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.backups?.map((b) => (
                  <TableRow key={b.filename} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs text-foreground font-semibold truncate max-w-[220px]" title={b.filename}>
                      {b.filename}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-medium text-foreground">
                      {formatBytes(b.size)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.backups || data.backups.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-14 text-xs">
                      No database snapshots created yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
