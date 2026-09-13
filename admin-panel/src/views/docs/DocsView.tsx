import React, { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Copy,
  Check,
  Terminal,
  Code2,
  Cpu,
  Sparkles,
  ExternalLink,
  BookOpen,
  ArrowRight,
  ChevronRight,
  Zap,
  Layers,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { api, ModelsCatalogResponse } from "@/lib/api";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

interface DocsViewProps {
  initialApiKey?: string;
  isStandalone?: boolean;
}

export function DocsView({ initialApiKey = "", isStandalone = false }: DocsViewProps) {
  const [apiKey, setApiKey] = useState(initialApiKey || "sk-wflabs-your-api-key");
  const [activeTab, setActiveTab] = useState<"python" | "typescript" | "curl" | "claude">("python");
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const [copiedModel, setCopiedModel] = useState<string | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [modelSearch, setModelSearch] = useState("");

  const gatewayUrl = "http://127.0.0.1:20128";
  const baseUrl = `${gatewayUrl}/v1`;

  useEffect(() => {
    api.getModels().then((res) => {
      if (res && res.models) setModels(res.models);
    }).catch(() => {});
  }, []);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSnippet(id);
    toast.success("Code snippet copied to clipboard");
    setTimeout(() => setCopiedSnippet(null), 2000);
  };

  const copyModelId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedModel(id);
    toast.success("Model ID copied");
    setTimeout(() => setCopiedModel(null), 2000);
  };

  const sampleModel = models.find((m) => m.isAllowed)?.id || "a/amanai/glm-5.3";

  // Code snippets dynamically populated with apiKey
  const snippets = {
    python: `from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key="${apiKey}",
)

# Standard chat completion
response = client.chat.completions.create(
    model="${sampleModel}",
    messages=[{"role": "user", "content": "Hello! Explain quantum computing simply."}],
    max_tokens=250,
)
print(response.choices[0].message.content)

# Streaming response
stream = client.chat.completions.create(
    model="${sampleModel}",
    messages=[{"role": "user", "content": "Write a short poem about code."}],
    max_tokens=100,
    stream=True,
)
for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)`,

    typescript: `import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: "${apiKey}",
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: "${sampleModel}",
    messages: [{ role: "user", content: "Hello! What are your capabilities?" }],
  });
  console.log(completion.choices[0].message.content);
}

main();`,

    curl: `curl ${baseUrl}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${sampleModel}",
    "messages": [
      {"role": "user", "content": "Hello from terminal!"}
    ],
    "max_tokens": 150
  }'`,

    claude: `# 1. Set environment variables for Claude Code CLI
export ANTHROPIC_BASE_URL="${gatewayUrl}"
export ANTHROPIC_AUTH_TOKEN="${apiKey}"

# 2. Run claude directly
claude

# Or configure ~/.claude/settings.json:
{
  "env": {
    "ANTHROPIC_BASE_URL": "${gatewayUrl}",
    "ANTHROPIC_AUTH_TOKEN": "${apiKey}"
  }
}`
  };

  const filteredModels = models.filter((m) => {
    if (!modelSearch) return true;
    return (
      m.id.toLowerCase().includes(modelSearch.toLowerCase()) ||
      (m.provider && m.provider.toLowerCase().includes(modelSearch.toLowerCase()))
    );
  });

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16 font-sans">
      {/* Standalone Header Bar if accessed as root docs */}
      {isStandalone && (
        <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-card/60 backdrop-blur-sm -mx-6 -mt-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden bg-background border border-border shadow-xs">
              <img src="/wflabs-logo-black-256.png" alt="WFLabs" className="w-6 h-6 object-contain dark:hidden" />
              <img src="/wflabs-logo-white-256.png" alt="WFLabs" className="w-6 h-6 object-contain hidden dark:block" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-foreground">WFLABS DOCS</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold">
                AI GATEWAY
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Admin Panel
            </a>
            <a
              href="/member"
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Member Portal
            </a>
            <ThemeToggle />
          </div>
        </header>
      )}

      {/* Hero Header */}
      <div className="space-y-2 border-b border-border pb-6">
        <div className="flex items-center gap-2">
          <Badge variant="success" className="font-mono text-[10px] font-bold">
            QUICKSTART GUIDE
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">v1 / Chat &amp; Messages API</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          WFLabs AI Gateway Documentation
        </h1>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          Get your first AI request running in under a minute. The WFLabs gateway natively supports both the{" "}
          <strong className="text-foreground">OpenAI Chat Completions API</strong> and the{" "}
          <strong className="text-foreground">Anthropic Messages API</strong>. Point your client at the local base URL and pass your Bearer key.
        </p>
      </div>

      {/* Interactive API Key Variable Bar */}
      <Card className="p-4 border-emerald-500/30 bg-card shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Interactive API Key Injector</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Paste your key here to automatically populate all code snippets below.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:w-80">
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="h-8.5 font-mono text-xs"
            />
          </div>
        </div>
      </Card>

      {/* 1. Base URL Section */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-muted text-foreground flex items-center justify-center text-xs font-mono font-bold">
            1
          </span>
          Gateway Base URL Endpoint
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Point any standard OpenAI or Anthropic client to your gateway endpoint:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-lg border border-border bg-card flex items-center justify-between font-mono text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground font-sans">OpenAI API Base</div>
              <div className="font-bold text-foreground mt-0.5">{baseUrl}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyCode(baseUrl, "base-url")}
              className="h-7 w-7"
            >
              {copiedSnippet === "base-url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>

          <div className="p-3.5 rounded-lg border border-border bg-card flex items-center justify-between font-mono text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-muted-foreground font-sans">Anthropic API Base</div>
              <div className="font-bold text-foreground mt-0.5">{gatewayUrl}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyCode(gatewayUrl, "anthropic-url")}
              className="h-7 w-7"
            >
              {copiedSnippet === "anthropic-url" ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Code Examples (Python / TS / cURL / Claude Code) */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-muted text-foreground flex items-center justify-center text-xs font-mono font-bold">
              2
            </span>
            Code Examples &amp; SDK Quickstart
          </h2>

          {/* Snippet Tabs */}
          <div className="inline-flex h-8 items-center rounded-lg bg-muted p-0.5 text-xs font-medium">
            {(["python", "typescript", "curl", "claude"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md capitalize transition-all ${
                  activeTab === tab ? "bg-background text-foreground font-bold shadow-2xs" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "typescript" ? "TypeScript / Node" : tab === "claude" ? "Claude Code" : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Code Box */}
        <div className="relative rounded-xl border border-border overflow-hidden bg-slate-950 text-slate-100 shadow-sm">
          <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>{activeTab === "python" ? "main.py" : activeTab === "typescript" ? "client.ts" : activeTab === "curl" ? "terminal cURL" : "shell environment"}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyCode(snippets[activeTab], activeTab)}
              className="h-7 px-2 text-xs font-sans text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5"
            >
              {copiedSnippet === activeTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSnippet === activeTab ? "Copied" : "Copy Code"}
            </Button>
          </div>
          <pre className="p-4 text-xs font-mono leading-relaxed overflow-x-auto selection:bg-emerald-500/30">
            <code>{snippets[activeTab]}</code>
          </pre>
        </div>
      </div>

      {/* 3. Developer Coding Assistants Integration Guides */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-muted text-foreground flex items-center justify-center text-xs font-mono font-bold">
            3
          </span>
          Coding Assistants &amp; IDE Tool Setup
        </h2>
        <p className="text-xs text-muted-foreground">
          Seamlessly plug the WFLabs gateway into Cursor, Continue.dev, Cline, and terminal agents:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cursor */}
          <Card className="p-4 space-y-2 border-border shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Cursor IDE</span>
              <Badge variant="outline" className="text-[10px] font-mono">OpenAI Compatible</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Open <strong>Cursor Settings → Models</strong> and enable OpenAI API:
            </p>
            <div className="p-2.5 rounded bg-muted/50 font-mono text-xs space-y-1">
              <div><span className="text-muted-foreground">Base URL:</span> <strong className="text-foreground">{baseUrl}</strong></div>
              <div><span className="text-muted-foreground">API Key:</span> <span className="text-emerald-600 dark:text-emerald-400">{apiKey}</span></div>
            </div>
          </Card>

          {/* Continue.dev */}
          <Card className="p-4 space-y-2 border-border shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Continue (VS Code / JetBrains)</span>
              <Badge variant="outline" className="text-[10px] font-mono">~/.continue/config.json</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Add provider entry to your <code>config.json</code>:
            </p>
            <pre className="p-2.5 rounded bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto">
{`{
  "title": "WFLabs Gateway",
  "provider": "openai",
  "model": "${sampleModel}",
  "apiBase": "${baseUrl}",
  "apiKey": "${apiKey}"
}`}
            </pre>
          </Card>

          {/* Cline / Roo Code */}
          <Card className="p-4 space-y-2 border-border shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Cline / Roo Code (VS Code)</span>
              <Badge variant="outline" className="text-[10px] font-mono">Custom OpenAI</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Select <strong>OpenAI Compatible</strong> in API Provider options:
            </p>
            <div className="p-2.5 rounded bg-muted/50 font-mono text-xs space-y-1">
              <div><span className="text-muted-foreground">Base URL:</span> <strong className="text-foreground">{baseUrl}</strong></div>
              <div><span className="text-muted-foreground">API Key:</span> <span className="text-emerald-600 dark:text-emerald-400">{apiKey}</span></div>
              <div><span className="text-muted-foreground">Model ID:</span> <span className="text-foreground">{sampleModel}</span></div>
            </div>
          </Card>

          {/* Aider CLI */}
          <Card className="p-4 space-y-2 border-border shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground">Aider CLI</span>
              <Badge variant="outline" className="text-[10px] font-mono">Terminal</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Export variables in your bash / zsh session:
            </p>
            <pre className="p-2.5 rounded bg-slate-950 text-slate-200 font-mono text-[11px] overflow-x-auto">
{`export OPENAI_API_BASE="${baseUrl}"
export OPENAI_API_KEY="${apiKey}"
aider --model ${sampleModel}`}
            </pre>
          </Card>
        </div>
      </div>

      {/* 4. Reasoning Effort Levels Guide */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-muted text-foreground flex items-center justify-center text-xs font-mono font-bold">
            4
          </span>
          Reasoning Effort &amp; Thinking Levels
        </h2>
        <p className="text-xs text-muted-foreground">
          Select models support adjustable reasoning depth. Pass <code>reasoning.effort</code> (OpenAI) or <code>thinking</code> (Anthropic):
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-1">
            <div className="font-bold text-foreground flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-mono text-[10px]">L</span>
              low
            </div>
            <p className="text-[11px] text-muted-foreground">Fastest latency, lighter reasoning. Ideal for small edits and lookups.</p>
          </div>

          <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-1">
            <div className="font-bold text-foreground flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-sky-500/20 text-sky-700 dark:text-sky-400 flex items-center justify-center font-mono text-[10px]">M</span>
              medium
            </div>
            <p className="text-[11px] text-muted-foreground">Balances depth and speed. Default for coding tasks and debugging.</p>
          </div>

          <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-1">
            <div className="font-bold text-foreground flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-purple-500/20 text-purple-700 dark:text-purple-400 flex items-center justify-center font-mono text-[10px]">H</span>
              high
            </div>
            <p className="text-[11px] text-muted-foreground">Deeper reasoning for architecture, math, and complex refactors.</p>
          </div>

          <div className="p-3 rounded-lg border border-border bg-card text-xs space-y-1">
            <div className="font-bold text-foreground flex items-center gap-1">
              <span className="w-4 h-4 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center font-mono text-[10px]">X</span>
              xhigh
            </div>
            <p className="text-[11px] text-muted-foreground">Maximum chain-of-thought exploration for hardest problems.</p>
          </div>
        </div>
      </div>

      {/* 5. Live Models Catalog Browser */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-muted text-foreground flex items-center justify-center text-xs font-mono font-bold">
                5
              </span>
              Live Available Models ({models.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Directly queried from <code>GET /v1/models</code>:
            </p>
          </div>

          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search live models..."
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              className="h-8.5 pl-8 text-xs bg-background"
            />
          </div>
        </div>

        <Card className="shadow-2xs border-border overflow-hidden">
          <div className="max-h-80 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-xs font-bold text-foreground py-2.5">Model ID</TableHead>
                  <TableHead className="text-xs font-bold text-foreground w-28">Provider</TableHead>
                  <TableHead className="text-xs font-bold text-foreground w-28 text-center">Context</TableHead>
                  <TableHead className="text-xs font-bold text-foreground text-right w-24">Copy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.slice(0, 30).map((m) => (
                  <TableRow key={m.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-foreground py-2 select-all">
                      {m.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {m.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {m.contextLength ? `${Math.round(m.contextLength / 1000)}k` : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyModelId(m.id)}
                        className="h-6 w-6"
                        title="Copy Model ID"
                      >
                        {copiedModel === m.id ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-muted-foreground" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredModels.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-xs text-muted-foreground">
                      No models matching search
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
