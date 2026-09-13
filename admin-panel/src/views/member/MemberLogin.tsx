import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { KeyRound, Shield, Laptop } from "lucide-react";
import { toast } from "sonner";

interface MemberLoginProps {
  onLoginSuccess: (token: string, member: any) => void;
}

export function MemberLogin({ onLoginSuccess }: MemberLoginProps) {
  const [apiKey, setApiKey] = useState("");
  const [machineId, setMachineId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      toast.error("API Key is required");
      return;
    }
    try {
      setLoading(true);
      const res = await api.memberLogin(apiKey.trim(), machineId.trim() || undefined);
      toast.success("Welcome back!");
      onLoginSuccess(res.token, res.member);
    } catch (err: any) {
      toast.error(err.message || "Invalid API key or machine mismatch");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md shadow-xl border-border">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden bg-background border border-border shadow-xs">
            <img src="/wflabs-logo-black-256.png" alt="WFLabs" className="w-9 h-9 object-contain dark:hidden" />
            <img src="/wflabs-logo-white-256.png" alt="WFLabs" className="w-9 h-9 object-contain hidden dark:block" />
          </div>
          <CardTitle className="text-lg font-bold">WFLABS MEMBER PORTAL</CardTitle>
          <CardDescription className="text-xs">
            Authenticate using your gateway API key and optional machine identifier
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" />
                Gateway API Key
              </label>
              <Input
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="mt-1 font-mono text-xs"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5" />
                Machine ID Binding (Optional)
              </label>
              <Input
                type="text"
                placeholder="Device machine identifier"
                value={machineId}
                onChange={(e) => setMachineId(e.target.value)}
                className="mt-1 font-mono text-xs"
              />
            </div>
          </CardContent>

          <CardFooter>
            <Button
              type="submit"
              variant="success"
              disabled={loading}
              className="w-full text-xs font-semibold"
            >
              <Shield className="w-3.5 h-3.5 mr-1" />
              {loading ? "Authenticating..." : "Access Member Dashboard"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
