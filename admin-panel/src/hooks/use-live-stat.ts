import { useEffect, useState } from "react";
import { api, LiveInstanceResponse } from "@/lib/api";

export function useLiveStat(intervalMs = 3500) {
  const [live, setLive] = useState<LiveInstanceResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStat = async () => {
    try {
      const res = await api.getInstances();
      setLive(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStat();
    const interval = setInterval(fetchStat, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return { live, loading, refetch: fetchStat };
}
