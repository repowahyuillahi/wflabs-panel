import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatCurrency } from "@/lib/utils";
import {
  Copy,
  LogOut,
  Terminal,
  Gift,
  Ticket,
  Sparkles,
  BookOpen,
  LayoutDashboard,
  Play,
  Calculator,
  ListOrdered,
  BarChart3,
  CreditCard,
  History,
  Key,
  Check,
  Send,
  Loader2,
  Clock,
  TrendingUp,
  Coins,
  Cpu,
  ShieldCheck,
  ExternalLink,
  Activity,
  ChevronRight,
  Gauge,
  Workflow
} from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { api, QuotaPackage } from "@/lib/api";

interface MemberDashboardProps {
  token: string;
  member: any;
  onLogout: () => void;
}

type MemberMenu =
  | "overview"
  | "playground"
  | "calculator"
  | "logs"
  | "usage"
  | "buy"
  | "rewards"
  | "billing"
  | "keys";

interface NavSection {
  group: string;
  items: {
    id: MemberMenu;
    label: string;
    icon: React.ReactNode;
  }[];
}

export function MemberDashboard({ member: initialMember, onLogout }: MemberDashboardProps) {
  const [member, setMember] = useState(initialMember);
  const [activeMenu, setActiveMenu] = useState<MemberMenu>("overview");
  const [cdKeyInput, setCdKeyInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [dailyClaiming, setDailyClaiming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Daily claim countdown timer
  const [claimCountdown, setClaimCountdown] = useState<string | null>(null);
  const [canDailyClaim, setCanDailyClaim] = useState(true);

  // Billing history
  const [billingHistory, setBillingHistory] = useState<any[]>([]);

  // Packages for Buy Credits
  const [packages, setPackages] = useState<QuotaPackage[]>([]);

  // Playground state
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState("a/amanai/glm-5.3");
  const [promptInput, setPromptInput] = useState("Explain quantum computing in three simple sentences.");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful and concise AI assistant.");
  const [playgroundOutput, setPlaygroundOutput] = useState("");
  const [playgroundLoading, setPlaygroundLoading] = useState(false);
  const [playgroundStats, setPlaygroundStats] = useState<any>(null);

  // Calculator state
  const [calcModel, setCalcModel] = useState("claude-sonnet-4.5");
  const [calcPromptTok, setCalcPromptTok] = useState(15000);
  const [calcCompTok, setCalcCompTok] = useState(3000);
  const [pricingRates, setPricingRates] = useState<any[]>([]);

  const allowance = member?.quota?.maxTokens || member?.maxTokens || 10000000;
  const consumedTokens = member?.stats?.totalTokens || member?.totalTokens || 0;
  const pct = Math.min(100, Math.round((consumedTokens / allowance) * 100));
  const planName = member?.quota?.plan || "Standard";

  const gatewayUrl = "http://127.0.0.1:20128";
  const baseUrl = `${gatewayUrl}/v1`;

  // Countdown ticker for daily claim
  useEffect(() => {
    const checkDailyClaim = () => {
      const last = member?.quota?.lastDailyClaimAt ? new Date(member.quota.lastDailyClaimAt).getTime() : 0;
      if (!last) {
        setCanDailyClaim(true);
        setClaimCountdown(null);
        return;
      }
      const now = Date.now();
      const diff = 24 * 3600 * 1000 - (now - last);
      if (diff <= 0) {
        setCanDailyClaim(true);
        setClaimCountdown(null);
      } else {
        setCanDailyClaim(false);
        const hours = Math.floor(diff / (3600 * 1000));
        const mins = Math.floor((diff % (3600 * 1000)) / (60 * 1000));
        const secs = Math.floor((diff % (60 * 1000)) / 1000);
        setClaimCountdown(`${hours}h ${mins}m ${secs}s`);
      }
    };

    checkDailyClaim();
    const interval = setInterval(checkDailyClaim, 1000);
    return () => clearInterval(interval);
  }, [member]);

  // Load models, billing history & pricing
  useEffect(() => {
    api.getModels().then((res) => {
      if (res && res.models) {
        setModels(res.models);
        if (res.models.length > 0) setSelectedModel(res.models[0].id);
      }
    }).catch(() => {});

    api.getBillingHistory(member.key).then((res) => {
      if (res && res.history) setBillingHistory(res.history);
    }).catch(() => {});

    api.getQuotaPackages().then((res) => {
      if (res && res.packages) setPackages(res.packages);
    }).catch(() => {});

    api.getPricing().then((res) => {
      if (res && res.rates) setPricingRates(res.rates);
    }).catch(() => {});
  }, [member.key]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRedeemCdKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cdKeyInput.trim()) return;

    try {
      setRedeeming(true);
      const res = await api.redeemCdKey(member.key, cdKeyInput.trim());
      toast.success(res.message || "CD Key claimed successfully!");
      setCdKeyInput("");

      setMember((prev: any) => ({
        ...prev,
        quota: res.quota,
        maxTokens: res.quota.maxTokens,
        maxCost: res.quota.maxCost,
      }));

      api.getBillingHistory(member.key).then((b) => b && setBillingHistory(b.history));
    } catch (err: any) {
      toast.error(err.message || "Failed to redeem CD Key");
    } finally {
      setRedeeming(false);
    }
  };

  const handleClaimDailyReward = async () => {
    try {
      setDailyClaiming(true);
      const res = await api.claimDailyReward(member.key);
      toast.success(res.message || "Daily reward claimed!");
      setMember((prev: any) => ({
        ...prev,
        quota: res.quota,
        maxTokens: res.quota.maxTokens,
      }));
    } catch (err: any) {
      toast.error(err.message || "Daily claim not available yet");
    } finally {
      setDailyClaiming(false);
    }
  };

  const runPlayground = async () => {
    if (!promptInput.trim()) return;
    try {
      setPlaygroundLoading(true);
      setPlaygroundOutput("");
      setPlaygroundStats(null);
      const startTime = Date.now();

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${member.key}`,
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: promptInput },
          ],
          max_tokens: 300,
        }),
      });

      const data = await res.json();
      const duration = Date.now() - startTime;

      if (!res.ok) {
        throw new Error(data.error?.message || data.message || `Error ${res.status}`);
      }

      const answer = data.choices?.[0]?.message?.content || JSON.stringify(data, null, 2);
      setPlaygroundOutput(answer);
      setPlaygroundStats({
        durationMs: duration,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        model: data.model || selectedModel,
      });

      if (data.usage?.total_tokens) {
        setMember((prev: any) => ({
          ...prev,
          totalTokens: (prev.totalTokens || 0) + data.usage.total_tokens,
          stats: {
            ...prev.stats,
            totalTokens: (prev.stats?.totalTokens || 0) + data.usage.total_tokens,
            requests: (prev.stats?.requests || 0) + 1,
          },
        }));
      }
    } catch (err: any) {
      toast.error(err.message || "Playground request failed");
      setPlaygroundOutput(`Error: ${err.message}`);
    } finally {
      setPlaygroundLoading(false);
    }
  };

  // Calculator price computation
  const calcRate = pricingRates.find((r) => r.model === calcModel) || { promptPricePerM: 3.0, completionPricePerM: 15.0 };
  const promptCost = (calcPromptTok / 1000000) * (calcRate.promptPricePerM || 3.0);
  const compCost = (calcCompTok / 1000000) * (calcRate.completionPricePerM || 15.0);
  const totalCalcCost = promptCost + compCost;

  // Sidebar Grouped Navigation Definition
  const sidebarSections: NavSection[] = [
    {
      group: "Workspace",
      items: [
        { id: "overview", label: "Overview", icon: <LayoutDashboard className="w-4 h-4 stroke-[1.75]" /> },
        { id: "playground", label: "Playground", icon: <Play className="w-4 h-4 stroke-[1.75]" /> },
        { id: "calculator", label: "Calculator", icon: <Calculator className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
    {
      group: "Analytics & Logs",
      items: [
        { id: "logs", label: "Request Logs", icon: <ListOrdered className="w-4 h-4 stroke-[1.75]" /> },
        { id: "usage", label: "Usage Stats", icon: <BarChart3 className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
    {
      group: "Billing & Rewards",
      items: [
        { id: "buy", label: "Buy Credits", icon: <CreditCard className="w-4 h-4 stroke-[1.75]" /> },
        { id: "rewards", label: "Rewards & Claim", icon: <Gift className="w-4 h-4 stroke-[1.75]" /> },
        { id: "billing", label: "Billing History", icon: <History className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
    {
      group: "Security & Access",
      items: [
        { id: "keys", label: "API Keys", icon: <Key className="w-4 h-4 stroke-[1.75]" /> },
      ],
    },
  ];

  const getActiveTitle = () => {
    switch (activeMenu) {
      case "overview": return "Console Overview";
      case "playground": return "Interactive AI Playground";
      case "calculator": return "Token & Cost Calculator";
      case "logs": return "Recent Request Logs";
      case "usage": return "Consumption Telemetry";
      case "buy": return "Buy Credits & Tier Plans";
      case "rewards": return "Rewards & Daily Claim";
      case "billing": return "Billing & Voucher History";
      case "keys": return "API Keys & Integrations";
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
      {/* 1. MEMBER SIDEBAR */}
      <aside className="w-64 min-w-[16rem] bg-sidebar border-r border-sidebar-border flex flex-col h-screen select-none font-sans">
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-sidebar-border flex items-center gap-3.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-background border border-border shadow-xs">
            <img src="/wflabs-logo-black-256.png" alt="WFLabs" className="w-6 h-6 object-contain dark:hidden" />
            <img src="/wflabs-logo-white-256.png" alt="WFLabs" className="w-6 h-6 object-contain hidden dark:block" />
          </div>
          <div className="flex flex-col">
            <div className="text-sm font-bold tracking-tight text-sidebar-foreground flex items-center gap-2">
              <span>WFLABS MEMBER</span>
            </div>
            <div className="text-xs text-muted-foreground font-normal">Consumer Portal</div>
          </div>
        </div>

        {/* Member Credit Gauge Widget */}
        <div className="mx-3 my-2.5 p-3 rounded-lg border border-border bg-card shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground truncate max-w-[120px]">{member?.name || "Member"}</span>
            <Badge variant="cyan" className="font-mono text-[9px] px-1.5 py-0 font-bold">
              {planName.toUpperCase()}
            </Badge>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-emerald-600"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-muted-foreground">
            <span>{pct}% Used</span>
            <span>{formatNumber(allowance - consumedTokens)} tok left</span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          {sidebarSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider font-mono">
                {sec.group}
              </div>
              {sec.items.map((item) => {
                const active = activeMenu === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveMenu(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium transition-all group ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-xs"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`transition-colors ${active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground"}`}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {active && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                );
              })}
            </div>
          ))}

          {/* External Docs & Status Links */}
          <div className="space-y-1 pt-1">
            <div className="px-3 py-1 text-[11px] font-bold text-muted-foreground/80 uppercase tracking-wider font-mono">
              Resources
            </div>
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-4 h-4 text-primary stroke-[1.75]" />
                <span>API Docs</span>
              </div>
              <ExternalLink className="w-3 h-3 text-muted-foreground" />
            </a>

            <a
              href="/status"
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs font-medium text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all group"
            >
              <div className="flex items-center gap-2.5">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400 stroke-[1.75]" />
                <span>System Status</span>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                live
              </span>
            </a>
          </div>
        </nav>

        {/* Member Sidebar Footer */}
        <div className="p-3 border-t border-sidebar-border bg-sidebar text-xs text-muted-foreground flex items-center justify-between">
          <div className="flex flex-col min-w-0 pr-2">
            <span className="font-semibold text-sidebar-foreground text-xs truncate">{member?.name || "User"}</span>
            <span className="font-mono text-[10px] text-muted-foreground truncate">{member?.key?.slice(0, 14)}...</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
            title="Sign out of Member Portal"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </aside>

      {/* 2. MAIN WORKSPACE CONTAINER */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-border bg-card/60 backdrop-blur-sm px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium">Member Portal</span>
            <span className="text-muted-foreground/40 font-mono">/</span>
            <span className="font-semibold text-foreground tracking-tight">{getActiveTitle()}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge variant="outline" className="font-mono text-[11px] font-semibold hidden sm:inline-flex">
              Tokens: {formatNumber(allowance - consumedTokens)} Left
            </Badge>

            <ThemeToggle />

            <Button variant="outline" size="sm" onClick={onLogout} className="gap-1 text-xs h-8">
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        {/* Scrollable View Contents */}
        <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* 1. OVERVIEW */}
            {activeMenu === "overview" && (
              <div className="space-y-6">
                {/* Credit Gauge Banner */}
                <div className="p-5 rounded-xl border border-border bg-card shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground">{member?.name || "Consumer User"}</h2>
                      <Badge variant="success">ACTIVE KEY</Badge>
                      <Badge variant="cyan" className="font-mono text-[10px] font-semibold">
                        {planName.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      Machine ID Binding: {member?.machineId && member?.machineId !== "-" ? member.machineId : "Unrestricted (All Workstations)"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyText(member?.key || "", "api-key")}
                      className="text-xs font-mono gap-1.5 h-9"
                    >
                      {copiedId === "api-key" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy Key
                    </Button>

                    <Button
                      variant="success"
                      size="sm"
                      onClick={() => setActiveMenu("rewards")}
                      className="text-xs font-semibold gap-1.5 h-9"
                    >
                      <Gift className="w-3.5 h-3.5" />
                      Claim Daily
                    </Button>
                  </div>
                </div>

                {/* 4 Summary Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="shadow-2xs border-border">
                    <CardContent className="p-5">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Credits Allowance</div>
                      <div className="text-2xl font-black mt-1 font-mono text-foreground">
                        {formatNumber(allowance)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{pct}% total used</div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-2xs border-border">
                    <CardContent className="p-5">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Consumed Tokens</div>
                      <div className="text-2xl font-black mt-1 font-mono text-foreground">
                        {formatNumber(consumedTokens)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">tokens billed</div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-2xs border-border">
                    <CardContent className="p-5">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Spending Value</div>
                      <div className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
                        {formatCurrency(member?.stats?.totalCost || member?.totalCost || 0)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Cap: {formatCurrency(member?.quota?.maxCost || member?.maxCost || 50)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="shadow-2xs border-border">
                    <CardContent className="p-5">
                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Completed Calls</div>
                      <div className="text-2xl font-black mt-1 font-mono text-foreground">
                        {formatNumber(member?.stats?.requests || member?.totalRequests || 0)}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">routed requests</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress Gauge */}
                <Card className="p-5 space-y-2 shadow-2xs border-border">
                  <div className="flex justify-between text-xs font-semibold">
                    <span>Monthly Token Quota Gauge</span>
                    <span className="font-mono text-foreground">{pct}% Consumed ({formatNumber(allowance - consumedTokens)} remaining)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-emerald-600"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </Card>

                {/* Campaign & Daily Rewards Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Daily Claim Countdown Card */}
                  <Card className="p-5 space-y-3 border-border shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-sm font-bold text-foreground">Daily Free Credits</span>
                      </div>
                      <Badge variant={canDailyClaim ? "success" : "outline"} className="text-[10px] font-mono">
                        {canDailyClaim ? "READY TO CLAIM" : "COOLDOWN"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {canDailyClaim
                        ? "Claim your +1,000,000 free daily token bonus for active development."
                        : `Next daily claim available in ${claimCountdown}`}
                    </p>
                    <Button
                      variant="success"
                      size="sm"
                      disabled={!canDailyClaim || dailyClaiming}
                      onClick={handleClaimDailyReward}
                      className="w-full text-xs font-semibold h-8.5"
                    >
                      {dailyClaiming ? "Claiming..." : canDailyClaim ? "Claim 1M Free Tokens" : `Next Claim in ${claimCountdown}`}
                    </Button>
                  </Card>

                  {/* Shared Campaign Credits (DEEPSEEK10B) */}
                  <Card className="p-5 space-y-3 border-cyan-500/30 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-sm font-bold text-foreground">DEEPSEEK10B Campaign</span>
                      </div>
                      <Badge variant="cyan" className="text-[10px] font-mono font-semibold">
                        ELIGIBLE
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-muted-foreground">Shared Pool Pool:</span>
                      <strong className="text-foreground">9.3B / 10B Tokens (7% used)</strong>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Shared credits active for all connected developers on DeepSeek V3 and R1 endpoints.
                    </p>
                  </Card>
                </div>
              </div>
            )}

            {/* 2. PLAYGROUND */}
            {activeMenu === "playground" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Interactive AI Playground</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Test prompts, observe streaming completions, latency, and token consumption directly with your member key
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {/* Controls Left Column */}
                  <Card className="p-4 space-y-4 border-border shadow-2xs">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Target Model</label>
                      <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full h-9 mt-1 px-2.5 rounded-md border border-input bg-background font-mono text-xs text-foreground focus:outline-none"
                      >
                        {models.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.id} ({m.provider})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">System Prompt</label>
                      <textarea
                        rows={3}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        className="w-full mt-1 p-2 rounded-md border border-input bg-background text-xs font-sans focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">User Prompt</label>
                      <textarea
                        rows={5}
                        value={promptInput}
                        onChange={(e) => setPromptInput(e.target.value)}
                        className="w-full mt-1 p-2 rounded-md border border-input bg-background text-xs font-sans focus:outline-none"
                      />
                    </div>

                    <Button
                      variant="success"
                      onClick={runPlayground}
                      disabled={playgroundLoading || !promptInput.trim()}
                      className="w-full text-xs font-semibold gap-1.5 h-9"
                    >
                      {playgroundLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      {playgroundLoading ? "Running Completion..." : "Send Prompt"}
                    </Button>
                  </Card>

                  {/* Output Right Column */}
                  <Card className="lg:col-span-2 flex flex-col border-border shadow-2xs overflow-hidden">
                    <CardHeader className="py-3 px-4 border-b flex flex-row items-center justify-between space-y-0 bg-muted/20">
                      <span className="text-xs font-bold text-foreground">Completion Output</span>
                      {playgroundStats && (
                        <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                          <span>{playgroundStats.durationMs}ms</span>
                          <span>•</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">{playgroundStats.totalTokens} tokens</span>
                        </div>
                      )}
                    </CardHeader>
                    <div className="p-4 flex-1 bg-slate-950 text-slate-100 font-mono text-xs overflow-y-auto min-h-[300px] leading-relaxed whitespace-pre-wrap">
                      {playgroundOutput || (
                        <span className="text-slate-500 italic">
                          Click "Send Prompt" to run a live chat completion test against the gateway.
                        </span>
                      )}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* 3. CALCULATOR */}
            {activeMenu === "calculator" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Token &amp; Cost Calculator</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Estimate exact token consumption costs based on live 1M token rate cards
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="p-5 space-y-4 border-border shadow-2xs">
                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Select AI Model</label>
                      <select
                        value={calcModel}
                        onChange={(e) => setCalcModel(e.target.value)}
                        className="w-full h-9 mt-1 px-3 rounded-md border border-input bg-background font-mono text-xs text-foreground focus:outline-none"
                      >
                        {pricingRates.map((r) => (
                          <option key={r.model} value={r.model}>
                            {r.model} (${r.promptPricePerM}/1M prompt, ${r.completionPricePerM}/1M comp)
                          </option>
                        ))}
                        {pricingRates.length === 0 && <option value="claude-sonnet-4.5">claude-sonnet-4.5</option>}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Expected Prompt / Input Tokens</label>
                      <Input
                        type="number"
                        value={calcPromptTok}
                        onChange={(e) => setCalcPromptTok(Number(e.target.value))}
                        className="mt-1 font-mono text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">e.g. 15,000 tokens</span>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-muted-foreground uppercase">Expected Output Tokens</label>
                      <Input
                        type="number"
                        value={calcCompTok}
                        onChange={(e) => setCalcCompTok(Number(e.target.value))}
                        className="mt-1 font-mono text-xs"
                      />
                      <span className="text-[10px] text-muted-foreground font-mono">e.g. 3,000 tokens</span>
                    </div>
                  </Card>

                  <Card className="p-5 border-emerald-500/30 shadow-2xs flex flex-col justify-between bg-card">
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estimated Cost Breakdown</span>
                      <div className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(totalCalcCost)}
                      </div>
                      <div className="space-y-2 pt-2 border-t border-border text-xs font-mono">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Prompt Cost ({formatNumber(calcPromptTok)} tok):</span>
                          <span className="font-semibold text-foreground">{formatCurrency(promptCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Completion Cost ({formatNumber(calcCompTok)} tok):</span>
                          <span className="font-semibold text-foreground">{formatCurrency(compCost)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/40 text-[11px] text-muted-foreground mt-4 font-sans">
                      Billing rates apply per 1M tokens. Cached reads reduce prompt token cost automatically.
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* 4. REQUEST LOGS */}
            {activeMenu === "logs" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Recent Request Logs</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Audit trail of API completions routed through your consumer key
                  </p>
                </div>

                <Card className="shadow-2xs border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="text-xs font-bold text-foreground py-2.5">Timestamp</TableHead>
                          <TableHead className="text-xs font-bold text-foreground">Model</TableHead>
                          <TableHead className="text-xs font-bold text-foreground text-right">Prompt</TableHead>
                          <TableHead className="text-xs font-bold text-foreground text-right">Completion</TableHead>
                          <TableHead className="text-xs font-bold text-foreground text-right">Cost</TableHead>
                          <TableHead className="text-xs font-bold text-foreground text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(member?.recentRequests || []).map((r: any, idx: number) => (
                          <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap py-2.5">
                              {r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold text-foreground">{r.model}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(r.promptTokens)}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatNumber(r.completionTokens)}</TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                              {formatCurrency(r.cost)}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={r.status === "ok" || r.status === "200" ? "success" : "destructive"} className="text-[10px] font-mono">
                                {r.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!member?.recentRequests || member.recentRequests.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-10 text-xs">
                              No recent request logs for this API key
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            )}

            {/* 5. USAGE */}
            {activeMenu === "usage" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Consumption Telemetry</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Aggregated token volume and billing summary for your account
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="p-5 shadow-2xs border-border">
                    <div className="text-xs font-bold text-muted-foreground uppercase">Total Inbound Prompt Tokens</div>
                    <div className="text-2xl font-black font-mono text-foreground mt-1">
                      {formatNumber(member?.stats?.promptTokens || 0)}
                    </div>
                  </Card>

                  <Card className="p-5 shadow-2xs border-border">
                    <div className="text-xs font-bold text-muted-foreground uppercase">Total Output Tokens</div>
                    <div className="text-2xl font-black font-mono text-foreground mt-1">
                      {formatNumber(member?.stats?.completionTokens || 0)}
                    </div>
                  </Card>

                  <Card className="p-5 shadow-2xs border-emerald-500/30">
                    <div className="text-xs font-bold text-muted-foreground uppercase">Total Incurred Cost</div>
                    <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatCurrency(member?.stats?.totalCost || 0)}
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {/* 6. BUY CREDITS */}
            {activeMenu === "buy" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Buy Credits &amp; Tier Packages</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Choose a plan and redeem a WFLabs CD Key voucher code to instantly top up your allowance
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {packages.map((pkg) => (
                    <Card key={pkg.id} className="p-5 flex flex-col justify-between border-border shadow-2xs hover:border-primary/50 transition-colors">
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs font-bold text-primary uppercase">{pkg.id}</span>
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        <h3 className="text-lg font-bold text-foreground">{pkg.name}</h3>
                        <p className="text-xs text-muted-foreground">{pkg.description}</p>
                        <div className="py-2 border-y border-border space-y-1 text-xs font-mono">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Allowance:</span>
                            <strong className="text-foreground">{formatNumber(pkg.maxTokens)} tok</strong>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Spending Cap:</span>
                            <strong className="text-emerald-600 dark:text-emerald-400">{formatCurrency(pkg.maxCost)}</strong>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActiveMenu("rewards")}
                        className="w-full text-xs font-semibold mt-4 gap-1.5"
                      >
                        <Ticket className="w-3.5 h-3.5" />
                        Redeem with CD Key
                      </Button>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 7. REWARDS */}
            {activeMenu === "rewards" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Rewards &amp; CD Key Vouchers</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Claim daily developer bonuses and enter CD Key voucher codes
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Daily Claim Box */}
                  <Card className="p-5 space-y-3 border-emerald-500/40 shadow-xs bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h3 className="text-sm font-bold text-foreground">Daily Free Credits Bonus</h3>
                      </div>
                      <Badge variant={canDailyClaim ? "success" : "outline"} className="text-[10px] font-mono">
                        {canDailyClaim ? "READY TO CLAIM" : "COOLDOWN"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Get +1,000,000 tokens every 24 hours to keep your development workflow active.
                    </p>
                    <Button
                      variant="success"
                      onClick={handleClaimDailyReward}
                      disabled={!canDailyClaim || dailyClaiming}
                      className="w-full text-xs font-semibold h-9 gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {dailyClaiming ? "Claiming..." : canDailyClaim ? "Claim 1,000,000 Free Tokens" : `Next Claim in ${claimCountdown}`}
                    </Button>
                  </Card>

                  {/* Redeem CD Key Box */}
                  <Card className="p-5 space-y-3 border-border shadow-xs bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Ticket className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-bold text-foreground">Redeem Voucher CD Key</h3>
                      </div>
                      <Badge variant="cyan" className="text-[10px] font-mono">
                        INSTANT VOUCHER
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enter your purchased or distributed WFLabs CD Key code:
                    </p>
                    <form onSubmit={handleRedeemCdKey} className="flex gap-2 pt-1">
                      <Input
                        placeholder="e.g. WFLABS-STARTER-XXXX-XXXX"
                        value={cdKeyInput}
                        onChange={(e) => setCdKeyInput(e.target.value.toUpperCase())}
                        className="font-mono text-xs uppercase h-9"
                        disabled={redeeming}
                      />
                      <Button
                        type="submit"
                        variant="success"
                        disabled={redeeming || !cdKeyInput.trim()}
                        className="text-xs font-semibold shrink-0 gap-1.5 h-9"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {redeeming ? "Claiming..." : "Redeem Key"}
                      </Button>
                    </form>
                  </Card>
                </div>
              </div>
            )}

            {/* 8. BILLING HISTORY */}
            {activeMenu === "billing" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Billing &amp; Voucher History</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Record of claimed CD Keys, plan tier upgrades, and token grants
                  </p>
                </div>

                <Card className="shadow-2xs border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="text-xs font-bold text-foreground py-2.5">Date Claimed</TableHead>
                          <TableHead className="text-xs font-bold text-foreground">Voucher Code</TableHead>
                          <TableHead className="text-xs font-bold text-foreground">Package Plan</TableHead>
                          <TableHead className="text-xs font-bold text-foreground text-right">Tokens Credited</TableHead>
                          <TableHead className="text-xs font-bold text-foreground text-right">Spend Limit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {billingHistory.map((item: any, idx: number) => (
                          <TableRow key={idx} className="hover:bg-muted/30 transition-colors">
                            <TableCell className="text-xs text-muted-foreground font-mono whitespace-nowrap py-2.5">
                              {item.claimedAt ? new Date(item.claimedAt).toLocaleString() : "-"}
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold text-foreground">{item.code}</TableCell>
                            <TableCell>
                              <Badge variant="cyan" className="text-[10px] font-mono">
                                {item.plan}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              +{formatNumber(item.tokens)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                              {formatCurrency(item.maxCost)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {billingHistory.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-10 text-xs">
                              No voucher redemptions recorded for this account yet.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              </div>
            )}

            {/* 9. API KEYS */}
            {activeMenu === "keys" && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">API Credentials</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your bearer key and quick terminal integration snippets
                  </p>
                </div>

                <Card className="p-5 space-y-4 border-border shadow-2xs">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase">Your Gateway API Key</label>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/60 border border-border mt-1 font-mono text-xs">
                      <span className="select-all text-foreground font-bold">{member?.key}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyText(member?.key || "", "key-copy")}
                        className="h-7 px-2.5 text-xs font-sans gap-1"
                      >
                        {copiedId === "key-copy" ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        Copy Key
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase">Machine Identifier Binding</label>
                    <div className="p-2.5 rounded bg-muted/40 font-mono text-xs text-foreground mt-1">
                      {member?.machineId && member?.machineId !== "-" ? member.machineId : "Unrestricted (Usable across any device)"}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase">Quick Terminal Test (cURL)</label>
                    <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 font-mono text-xs overflow-x-auto mt-1 border border-slate-800">
{`curl ${baseUrl}/chat/completions \\
  -H "Authorization: Bearer ${member?.key}" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "a/amanai/glm-5.3", "messages": [{"role": "user", "content": "Hi!"}]}'`}
                    </pre>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
