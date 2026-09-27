import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, UpstreamStatus } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  ShieldAlert,
  XCircle,
  KeyRound,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  Server,
  Trash2,
  ArrowRight,
  Cpu,
  Route,
} from "lucide-react";
import { toast } from "sonner";

export function ConnectView() {
  const [status, setStatus] = useState<UpstreamStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState("https://api.wflabs.web.id");
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadStatus = async () => {
    try {
      const res = await api.getUpstreamStatus();
      setStatus(res);
      if (res.baseUrl) setBaseUrl(res.baseUrl);
      if (res.label) setLabel(res.label);
    } catch {
      // not configured yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim() && !status?.configured) {
      toast.error("Upstream API key is required");
      return;
    }
    try {
      setSaving(true);
      const res = await api.configureUpstream(baseUrl.trim(), apiKey.trim(), label.trim() || undefined);
      if (res.ok) {
        toast.success(res.message || "Upstream connected");
        setApiKey("");
      } else {
        toast.error(res.message || "Upstream test failed");
      }
      if (res.status) setStatus(res.status);
    } catch (err: any) {
      toast.error(err.message || "Failed to save upstream configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      setTesting(true);
      const res = await api.testUpstream();
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      if (res.status) setStatus(res.status);
    } catch (err: any) {
      toast.error(err.message || "Upstream test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Remove the stored upstream API key? Clients will not be able to reach the provider.")) return;
    try {
      await api.disconnectUpstream();
      toast.success("Upstream API key cleared");
      setApiKey("");
      await loadStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to clear upstream key");
    }
  };

  const configured = !!status?.configured;
  const healthy = !!status?.lastTestOk;

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-8 font-sans">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Connect Upstream Provider</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Point this panel at an OpenAI-compatible upstream. The panel then acts as a router: clients use
          panel-issued keys, and this upstream key stays private.
        </p>
      </div>

      {/* Status banner */}
      <Card
        className={cn(
          "shadow-2xs border-2",
          configured && healthy ? "border-emerald-500/40" : configured ? "border-amber-500/40" : "border-destructive/40"
        )}
      >
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={cn(
                  "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                  configured && healthy
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : configured
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    : "bg-destructive/10 text-destructive"
                )}
              >
                {configured && healthy ? (
                  <ShieldCheck className="w-6 h-6" />
                ) : configured ? (
                  <ShieldAlert className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">
                    {configured && healthy
                      ? `${status?.label || "Upstream"} — Healthy`
                      : configured
                      ? "Configured — Test Failed"
                      : "Not Configured"}
                  </span>
                  <Badge
                    variant={configured && healthy ? "success" : configured ? "warning" : "destructive"}
                    className="font-mono text-[10px] font-bold"
                  >
                    {configured && healthy ? "ROUTING ACTIVE" : configured ? "UNVERIFIED" : "OFFLINE"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-3 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Server className="w-3 h-3" />
                    {status?.baseUrl || baseUrl}
                  </span>
                  {healthy && (
                    <>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {status?.lastTestMs}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <Cpu className="w-3 h-3" />
                        {status?.modelCount} models
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTest}
                disabled={testing || !configured}
                className="gap-1.5 text-xs font-semibold h-9"
              >
                {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Test Upstream
              </Button>
              {configured && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClear}
                  className="gap-1.5 text-xs font-semibold h-9 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Key
                </Button>
              )}
            </div>
          </div>

          {status?.lastError && !healthy && (
            <div className="mt-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive font-mono">
              {status.lastError}
            </div>
          )}

          {configured && (
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Upstream Key</span>
                <span className="text-foreground font-mono font-semibold">{status?.keyPreview || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Last Test</span>
                <span className="text-foreground font-mono font-semibold">
                  {status?.lastTestAt ? new Date(status.lastTestAt).toLocaleTimeString() : "never"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Label</span>
                <span className="text-foreground font-mono font-semibold">{status?.label || "—"}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuration form */}
      <Card className="shadow-2xs border-border">
        <CardHeader className="py-4 px-6 border-b space-y-0">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-bold">
              {configured ? "Update Upstream Credentials" : "Upstream Credentials"}
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Stored encrypted (AES-256-GCM) on this machine only. It is used for outbound calls and never returned
            to clients.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSave}>
          <CardContent className="p-6 space-y-4">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Upstream Base URL</label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.wflabs.web.id"
                className="mt-1 font-mono text-xs"
              />
              <span className="text-[10px] text-muted-foreground font-mono">
                Local gateway: http://127.0.0.1:20128 · Remote: https://api.wflabs.web.id
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Upstream API Key</label>
              <div className="relative mt-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={configured ? "Enter new key to replace" : "sk-..."}
                  className="font-mono text-xs pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                  title={showKey ? "Hide key" : "Show key"}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Used as <code className="font-mono">Authorization: Bearer</code> on every upstream call.
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase">Label (Optional)</label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. WFLabs Production"
                className="mt-1 text-xs"
              />
            </div>

            <Button
              type="submit"
              variant="success"
              disabled={saving || (!apiKey.trim() && !configured)}
              className="w-full text-xs font-semibold h-9.5 gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Route className="w-3.5 h-3.5" />}
              {saving ? "Saving & testing..." : configured ? "Update & Test" : "Connect Upstream"}
            </Button>
          </CardContent>
        </form>
      </Card>

      {/* How routing works */}
      <Card className="shadow-2xs border-border">
        <CardHeader className="py-4 px-6 border-b space-y-0">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-bold">How routing works</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Flow diagram */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
            <span className="px-2.5 py-1.5 rounded-md bg-muted border border-border text-foreground font-semibold">
              Client
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="px-2.5 py-1.5 rounded-md bg-primary/10 border border-primary/30 text-primary font-bold">
              Panel :20110
            </span>
            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="px-2.5 py-1.5 rounded-md bg-muted border border-border text-foreground font-semibold">
              Upstream
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {[
              { label: "Client → Panel", desc: "Client sends its panel-issued key (sk-wflabs-…)" },
              { label: "Panel validates", desc: "Key checked, quota and allowed models enforced" },
              { label: "Panel → Upstream", desc: "Forwarded with the private upstream key" },
              { label: "Usage recorded", desc: "Tokens and cost logged to the panel database" },
            ].map((s, i) => (
              <div key={s.label} className="flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <div>
                  <div className="font-bold text-foreground">{s.label}</div>
                  <div className="text-muted-foreground text-[11px] mt-0.5">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Your upstream key never leaves this machine. Clients only ever see keys issued by the panel, each
              with its own quota and model restrictions.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
