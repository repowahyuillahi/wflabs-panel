import { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { MaterialIcon } from "@/components/ui/material-icon";
import { toast } from "sonner";

export function ConsoleLogView() {
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState<"all" | "info" | "warn" | "error">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async () => {
    try {
      const res = await api.getConsoleLogs();
      if (res.ok) {
        setLogs(res.logs || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch console logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((line) => {
    if (search.trim()) {
      if (!line.toLowerCase().includes(search.toLowerCase().trim())) {
        return false;
      }
    }
    if (filterLevel === "info") return line.includes("ℹ️") || line.toLowerCase().includes("info");
    if (filterLevel === "warn") return line.includes("⚠️") || line.toLowerCase().includes("warn");
    if (filterLevel === "error") return line.includes("❌") || line.toLowerCase().includes("error") || line.includes("err");
    return true;
  });

  const getLineClass = (line: string) => {
    if (line.includes("❌") || line.toLowerCase().includes("error")) {
      return "text-rose-400 bg-rose-950/20";
    }
    if (line.includes("⚠️") || line.toLowerCase().includes("warn")) {
      return "text-amber-400 bg-amber-950/20";
    }
    if (line.includes("TOKEN_REFRESH") || line.includes("BG_TOKEN_REFRESH")) {
      return "text-cyan-400";
    }
    if (line.includes("ℹ️")) {
      return "text-slate-300";
    }
    return "text-slate-400";
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Console Log</h2>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              Live Gateway Stream (:20128)
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Realtime background events, token refresh worker, and upstream proxy telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLogs}
            disabled={loading}
            className="gap-1.5 text-xs font-semibold h-9"
          >
            <MaterialIcon name="refresh" size={16} />
            Refresh
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setLogs([])}
            className="gap-1.5 text-xs font-semibold h-9 text-muted-foreground hover:text-foreground"
          >
            <MaterialIcon name="clear_all" size={16} />
            Clear View
          </Button>
        </div>
      </div>

      {/* Control Bar */}
      <Card className="shadow-2xs border-border">
        <CardContent className="p-3 flex flex-wrap items-center justify-between gap-3 bg-muted/20">
          <div className="flex flex-wrap items-center gap-2.5">
            <Input
              placeholder="Search in log lines..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 h-8 text-xs font-mono"
            />

            <div className="inline-flex h-8 items-center rounded-lg bg-muted p-1 text-muted-foreground text-xs font-medium">
              {(["all", "info", "warn", "error"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setFilterLevel(lvl)}
                  className={`px-2.5 py-0.5 rounded-md uppercase text-[11px] font-semibold transition-all ${
                    filterLevel === lvl
                      ? "bg-background text-foreground shadow-2xs font-bold"
                      : "hover:text-foreground"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground select-none">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-input text-primary focus:ring-primary h-3.5 w-3.5"
              />
              <span>Auto-scroll</span>
            </label>

            <span className="text-muted-foreground">
              {filteredLogs.length} / {logs.length} lines
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Terminal View */}
      <Card className="shadow-2xs border-border overflow-hidden bg-slate-950 text-slate-100">
        <div
          ref={scrollRef}
          className="p-4 font-mono text-xs overflow-y-auto h-[620px] space-y-1 select-text leading-relaxed"
        >
          {filteredLogs.map((line, idx) => (
            <div
              key={idx}
              className={`px-2 py-0.5 rounded font-mono break-all whitespace-pre-wrap ${getLineClass(line)}`}
            >
              {line}
            </div>
          ))}

          {filteredLogs.length === 0 && !loading && (
            <div className="text-center py-20 text-slate-500 italic">
              No log lines match the current search or filter.
            </div>
          )}

          {loading && logs.length === 0 && (
            <div className="text-center py-20 text-slate-500 italic">
              Connecting to 9Router gateway live console stream...
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
