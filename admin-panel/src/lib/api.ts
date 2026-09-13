// Centralized API Client for 9Router Admin Panel & Member Portal

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || (data.ok === false && (data.error || data.message))) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export interface LiveInstanceResponse {
  ok: boolean;
  live: {
    name: string;
    port: number;
    url: string;
    pid: number | null;
    running: boolean;
    ping: {
      ok: boolean;
      latency: number;
    };
    dataDir: string;
    dbPath: string;
    dbSize: number;
  };
}

export interface UsageSummaryResponse {
  ok: boolean;
  period: string;
  totalRequests: number;
  promptTokens: number;
  cachedTokens: number;
  completionTokens: number;
  totalCostUsd: number;
  timeline: Array<{
    timestamp: string;
    tokens: number;
    costUsd: number;
    totalCostUsd: number;
    promptTokens?: number;
    cachedTokens?: number;
    completionTokens?: number;
  }>;
  models: Array<{
    model: string;
    totalRequests: number;
    promptTokens: number;
    completionTokens: number;
    totalCostUsd: number;
  }>;
  accounts: Array<{
    accountId: string;
    totalRequests: number;
    promptTokens: number;
    completionTokens: number;
    totalCostUsd: number;
  }>;
  inFlight?: {
    active: number;
    pools: number;
    apis: number;
    poolNames?: string[];
  };
}

export interface RequestLogsResponse {
  ok: boolean;
  page: number;
  limit: number;
  total: number;
  logs: Array<{
    id: string;
    timestamp: string;
    provider: string;
    model: string;
    promptTokens: number;
    cachedTokens: number;
    completionTokens: number;
    costUsd: number;
    status: string;
    latencyMs: number;
    memberKey?: string;
  }>;
}

export interface AccountsResponse {
  ok: boolean;
  page: number;
  limit: number;
  total: number;
  accounts: Array<{
    id: string;
    provider: string;
    identifier: string;
    isActive: number;
    priority: number;
    errorCount: number;
    lastError?: string;
    updatedAt: string;
    extra?: Record<string, any>;
  }>;
}

export interface ProvidersResponse {
  ok: boolean;
  count: number;
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    prefix: string;
    apiType: string;
    baseUrl: string;
    accountCount: number;
    accountActive: number;
    createdAt?: string;
    updatedAt?: string;
  }>;
}

export interface ProxiesResponse {
  ok: boolean;
  count: number;
  proxies: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    isActive: number;
    latencyMs?: number;
    lastChecked?: string;
    status?: string;
  }>;
}

export interface ModelsCatalogResponse {
  ok: boolean;
  count: number;
  models: Array<{
    id: string;
    provider: string;
    displayName: string;
    type: string;
    contextLength?: number;
    isAllowed: boolean;
  }>;
}

export interface CustomModelsResponse {
  ok: boolean;
  count: number;
  models: Array<{
    id: string;
    provider: string;
    displayName: string;
    type: string;
    mapping: string;
  }>;
}

export interface MembersResponse {
  ok: boolean;
  count: number;
  members: Array<{
    id: string;
    name: string;
    key: string;
    machineId?: string;
    isActive: number;
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    maxTokens?: number;
    maxCost?: number;
    quota?: {
      maxTokens?: number;
      maxCost?: number;
      plan?: string;
    };
    createdAt: string;
  }>;
}

export interface PricingResponse {
  ok: boolean;
  rates: Array<{
    model: string;
    promptPricePerM: number;
    completionPricePerM: number;
    cachedPricePerM: number;
    isCustom?: boolean;
  }>;
}

export interface ErrorsResponse {
  ok: boolean;
  errors: Array<{
    id: string;
    timestamp: string;
    provider: string;
    model: string;
    httpStatus: number;
    errorSnippet: string;
    fullLog?: string;
  }>;
}

export interface SettingsResponse {
  ok: boolean;
  config: {
    requireApiKey: boolean;
    requireLogin: boolean;
    recaptchaSiteKey?: string;
    recaptchaSecretKey?: string;
  };
  backups: Array<{
    filename: string;
    size: number;
    createdAt: string;
  }>;
}

export interface QuotaPackage {
  id: string;
  name: string;
  maxTokens: number;
  maxCost: number;
  description: string;
}

export interface CdKeyItem {
  code: string;
  plan: string;
  tokens: number;
  maxCost: number;
  status: "active" | "claimed";
  createdAt: string;
  claimedBy: string | null;
  claimedAt: string | null;
}

export interface DbStatsResponse {
  ok: boolean;
  totalAccounts: number;
  activeAccounts: number;
  errorRequests: number;
  providers: Array<{
    provider: string;
    count: number;
    activeCount: number;
  }>;
  lifetime: {
    requests: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    totalCost: number;
  };
}

export const api = {
  // 1. Live Instances Status & Ping
  getInstances: () => request<LiveInstanceResponse>("/api/instances"),
  getDbStats: () => request<DbStatsResponse>("/api/db/stats"),

  // 2. Live Heal Kiro
  healAllKiro: () => request<{ ok: boolean; message: string; healedCount: number }>("/api/db/kiro/heal-all", {
    method: "POST",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),

  // 3. Analytics from Live Gateway (:20128)
  getUsageSummary: async (period = "today"): Promise<UsageSummaryResponse> => {
    const res = await request<{ ok: boolean; period: string; live: any }>(`/api/live/usage?period=${period}`);
    const chartRes = await request<{ ok: boolean; buckets: any[] }>(`/api/live/chart?period=${period}`).catch(() => ({ ok: true, buckets: [] }));
    const live = res.live || {};

    const rawChart = Array.isArray(chartRes.buckets) ? chartRes.buckets : [];
    const timeline = rawChart.map((b: any) => ({
      timestamp: b.label || b.time || b.timestamp || "",
      tokens: Number(b.tokens || 0),
      costUsd: Number(b.cost || 0),
      totalCostUsd: Number(b.cost || 0),
      promptTokens: Number(b.tokens || 0),
      cachedTokens: 0,
      completionTokens: 0,
    }));

    // Parse models breakdown from byModel object dictionary or array
    const rawByModel = live.byModel || live.models || {};
    const models = Array.isArray(rawByModel)
      ? rawByModel.map((m: any) => ({
          model: m.model || m.name || "unknown",
          totalRequests: m.requests || m.totalRequests || 0,
          promptTokens: m.promptTokens || m.inputTokens || 0,
          completionTokens: m.completionTokens || m.outputTokens || 0,
          totalCostUsd: m.cost || m.totalCost || 0,
        }))
      : Object.entries(rawByModel).map(([key, val]: [string, any]) => ({
          model: val?.rawModel || key,
          totalRequests: val?.requests || 0,
          promptTokens: val?.promptTokens || 0,
          completionTokens: val?.completionTokens || 0,
          totalCostUsd: val?.cost || 0,
        })).sort((a, b) => b.totalRequests - a.totalRequests).slice(0, 15);

    // Parse accounts breakdown from byAccount object dictionary or array
    const rawByAccount = live.byAccount || live.accounts || {};
    const accounts = Array.isArray(rawByAccount)
      ? rawByAccount.map((a: any) => ({
          accountId: a.accountId || a.id || a.identifier || "unknown",
          totalRequests: a.requests || a.totalRequests || 0,
          promptTokens: a.promptTokens || a.inputTokens || 0,
          completionTokens: a.completionTokens || a.outputTokens || 0,
          totalCostUsd: a.cost || a.totalCost || 0,
        }))
      : Object.entries(rawByAccount).map(([key, val]: [string, any]) => ({
          accountId: val?.accountName || val?.connectionId || key,
          totalRequests: val?.requests || 0,
          promptTokens: val?.promptTokens || 0,
          completionTokens: val?.completionTokens || 0,
          totalCostUsd: val?.cost || 0,
        })).sort((a, b) => b.totalRequests - a.totalRequests).slice(0, 15);

    const activeList = Array.isArray(live.activeRequests) ? live.activeRequests : [];
    
    // Explicit 9router metric mapping:
    // live.totalRequests, live.totalPromptTokens, live.totalCachedTokens, live.totalCompletionTokens, live.totalCost
    const totalRequests = Number(live.totalRequests ?? live.requests ?? 0);
    const promptTokens = Number(live.totalPromptTokens ?? live.promptTokens ?? 0);
    const cachedTokens = Number(live.totalCachedTokens ?? live.cachedTokens ?? 0);
    const completionTokens = Number(live.totalCompletionTokens ?? live.completionTokens ?? 0);
    const totalCostUsd = Number(live.totalCost ?? live.totalCostUsd ?? live.cost ?? 0);

    return {
      ok: true,
      period,
      totalRequests,
      promptTokens,
      cachedTokens,
      completionTokens,
      totalCostUsd,
      timeline,
      models,
      accounts,
      inFlight: {
        active: activeList.length,
        pools: 1,
        apis: activeList.length > 0 ? activeList.length : 0,
      },
    };
  },

  // 4. Request Logs
  getRequestLogs: async (page = 1, limit = 50, filter = "all", search = ""): Promise<RequestLogsResponse> => {
    const res = await request<{ ok: boolean; total: number; page: number; limit: number; logs: any[] }>(
      `/api/usage/request-logs?page=${page}&limit=${limit}&filter=${encodeURIComponent(filter)}&search=${encodeURIComponent(search)}`
    );
    return {
      ok: true,
      page: res.page || page,
      limit: res.limit || limit,
      total: res.total || 0,
      logs: (res.logs || []).map((l: any) => ({
        id: l.id || String(Math.random()),
        timestamp: l.timestamp ? new Date(l.timestamp).toLocaleTimeString() : "-",
        provider: l.provider || "-",
        model: l.model || "-",
        promptTokens: l.promptTokens || 0,
        cachedTokens: l.cachedTokens || 0,
        completionTokens: l.completionTokens || 0,
        costUsd: l.cost || 0,
        status: l.status || "ok",
        latencyMs: l.latencyMs || l.duration || 0,
        memberKey: l.memberKey || "",
      })),
    };
  },

  // 5. Accounts
  getAccounts: async (page = 1, limit = 50, provider = "all", status = "all", search = ""): Promise<AccountsResponse> => {
    const res = await request<{ ok: boolean; total: number; page: number; limit: number; accounts: any[] }>(
      `/api/db/accounts?page=${page}&limit=${limit}&provider=${provider}&status=${status}&search=${encodeURIComponent(search)}`
    );
    return {
      ok: true,
      page: res.page || page,
      limit: res.limit || limit,
      total: res.total || 0,
      accounts: (res.accounts || []).map((a: any) => ({
        id: a.id,
        provider: a.provider,
        identifier: a.identifier || a.email || a.apiKey || a.name || a.id,
        isActive: a.isActive,
        priority: a.priority || 1,
        errorCount: a.errorCount || 0,
        lastError: a.lastError,
        updatedAt: a.updatedAt,
        extra: a.extra,
      })),
    };
  },

  createAccount: (data: any) => request("/api/db/accounts", {
    method: "POST",
    body: JSON.stringify({ ...data, confirmLiveWrite: true }),
  }),
  toggleAccount: (id: string) => request(`/api/db/accounts/${encodeURIComponent(id)}/toggle`, {
    method: "POST",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),
  resetAccountError: (id: string) => request(`/api/db/accounts/${encodeURIComponent(id)}/reset-error`, {
    method: "POST",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),
  updateAccount: (id: string, data: any) => request(`/api/db/accounts/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify({ ...data, confirmLiveWrite: true }),
  }),
  deleteAccount: (id: string) => request(`/api/db/accounts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),
  bulkAccounts: (action: "activate" | "deactivate" | "reset-error" | "delete", ids: string[]) =>
    request("/api/db/accounts/bulk-action", {
      method: "POST",
      body: JSON.stringify({ action, ids, confirmLiveWrite: true }),
    }),
  importAccounts: (jsonPayload: any) => request("/api/db/kiro/bulk-import", {
    method: "POST",
    body: JSON.stringify({ accounts: jsonPayload, confirmLiveWrite: true }),
  }),
  exportKiroAccounts: () => request<{ ok: boolean; count: number; accounts: any[] }>("/api/db/kiro/export"),

  // 6. Providers & Proxies
  getProviders: () => request<ProvidersResponse>("/api/providers/nodes"),
  saveProvider: (data: any) => request("/api/providers/nodes", {
    method: "POST",
    body: JSON.stringify({ ...data, confirmLiveWrite: true }),
  }),
  deleteProvider: (id: string) => request(`/api/providers/nodes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),

  getProxies: () => request<ProxiesResponse>("/api/proxy-pools"),
  saveProxy: (data: any) => request("/api/proxy-pools", {
    method: "POST",
    body: JSON.stringify({ ...data, confirmLiveWrite: true }),
  }),
  deleteProxy: (id: string) => request(`/api/proxy-pools/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),
  testProxy: (id: string) => request<{ ok: boolean; latencyMs: number; status: string }>(`/api/proxy-pools/${encodeURIComponent(id)}/test`, {
    method: "POST",
  }),

  // 7. Models
  getModels: async (): Promise<ModelsCatalogResponse> => {
    const res = await request<{ ok: boolean; count: number; models: any[] }>("/api/models/status");
    return {
      ok: true,
      count: res.count || (res.models ? res.models.length : 0),
      models: (res.models || []).map((m: any) => ({
        id: m.id || m.modelId,
        provider: m.provider || "unknown",
        displayName: m.displayName || m.name || m.id,
        type: m.type || "chat",
        contextLength: m.contextLength || m.contextWindow,
        isAllowed: m.isAllowed !== undefined ? m.isAllowed : (m.allowed !== undefined ? m.allowed : true),
      })),
    };
  },
  toggleModel: (modelId: string, allowed: boolean, provider?: string) => request("/api/models/toggle-allow", {
    method: "POST",
    body: JSON.stringify({ modelId, allowed, provider, confirmLiveWrite: true }),
  }),
  getCustomModels: () => request<CustomModelsResponse>("/api/models/custom"),
  saveCustomModel: (data: any) => request("/api/models/custom", {
    method: "POST",
    body: JSON.stringify({ ...data, confirmLiveWrite: true }),
  }),
  deleteCustomModel: (id: string) => request(`/api/models/custom?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),

  // 8. Members, Quotas & Pricing
  getMembers: () => request<MembersResponse>("/api/members"),
  createMember: (data: any) => request("/api/members", {
    method: "POST",
    body: JSON.stringify({ ...data, confirmLiveWrite: true }),
  }),
  toggleMember: (id: string) => request(`/api/members/${encodeURIComponent(id)}/toggle`, {
    method: "POST",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),
  deleteMember: (id: string) => request(`/api/members/${encodeURIComponent(id)}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),
  updateMemberQuota: (id: string, quota: { maxTokens?: number; maxCost?: number }) =>
    request(`/api/members/${encodeURIComponent(id)}/quota`, {
      method: "POST",
      body: JSON.stringify({ ...quota, confirmLiveWrite: true }),
    }),

  getPricing: () => request<PricingResponse>("/api/pricing"),
  savePricing: (data: any) => request("/api/pricing", {
    method: "POST",
    body: JSON.stringify({ ...data, confirmLiveWrite: true }),
  }),

  // 9. Errors & Settings
  getErrors: async (): Promise<ErrorsResponse> => {
    const res = await request<{ ok: boolean; errors: any[] }>("/api/db/errors");
    return {
      ok: true,
      errors: (res.errors || []).map((e: any) => {
        let snippet = e.errorSnippet || e.snippet || e.message || "-";
        if (typeof snippet === "object") {
          try {
            snippet = JSON.stringify(snippet, null, 2);
          } catch {
            snippet = String(snippet);
          }
        }
        return {
          id: e.id || String(Math.random()),
          timestamp: e.timestamp ? new Date(e.timestamp).toLocaleString() : "-",
          provider: e.provider || "-",
          model: e.model || "-",
          httpStatus: typeof e.httpStatus === "number" ? e.httpStatus : 500,
          errorSnippet: String(snippet),
          fullLog: e.fullLog,
        };
      }),
    };
  },
  getSettings: () => request<SettingsResponse>("/api/settings"),
  saveSettings: (config: any) => request("/api/settings", {
    method: "POST",
    body: JSON.stringify({ config, confirmLiveWrite: true }),
  }),
  createBackup: () => request<{ ok: boolean; backup: any }>("/api/db/backup", {
    method: "POST",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),

  // 10. Member Portal
  memberLogin: (apiKey: string, machineId?: string) => request<{ ok: boolean; token: string; member: any }>("/api/member/login", {
    method: "POST",
    body: JSON.stringify({ apiKey, machineId }),
  }),
  getMemberConfig: (token: string) => request<{ ok: boolean; member: any; stats: any }>("/api/member/config", {
    headers: { Authorization: `Bearer ${token}` },
  }),
  redeemCdKey: (apiKey: string, cdKey: string) => request<{ ok: boolean; message: string; quota: any; voucher: any }>("/api/member/redeem", {
    method: "POST",
    body: JSON.stringify({ apiKey, cdKey }),
  }),
  claimDailyReward: (apiKey: string) => request<{ ok: boolean; message: string; quota: any; awardedTokens: number; remainingSecs?: number }>("/api/member/daily-claim", {
    method: "POST",
    body: JSON.stringify({ apiKey }),
  }),
  getBillingHistory: (apiKey: string) => request<{ ok: boolean; count: number; history: any[] }>(`/api/member/billing-history?apiKey=${encodeURIComponent(apiKey)}`),
  getPublicStatus: () => request<{
    ok: boolean;
    timestamp: string;
    platform: {
      gateway: { online: boolean; latencyMs: number; port: number };
      database: { online: boolean; size: number };
      apiServer: { online: boolean; port: number };
    };
    models: Array<{
      id: string;
      provider: string;
      status: string;
      latencyMs: number;
      contextLength: number;
      capabilities: any;
    }>;
  }>("/api/public/status"),

  // 11. Packages & CD Keys
  getQuotaPackages: () => request<{ ok: boolean; packages: QuotaPackage[] }>("/api/quota/packages"),
  saveQuotaPackages: (packages: QuotaPackage[]) => request("/api/quota/packages", {
    method: "POST",
    body: JSON.stringify({ packages, confirmLiveWrite: true }),
  }),
  getCdKeys: () => request<{ ok: boolean; count: number; cdkeys: CdKeyItem[] }>("/api/cdkeys"),
  generateCdKeys: (data: { count: number; plan: string; tokens: number; maxCost: number; prefix?: string }) =>
    request<{ ok: boolean; count: number; cdkeys: CdKeyItem[] }>("/api/cdkeys/generate", {
      method: "POST",
      body: JSON.stringify({ ...data, confirmLiveWrite: true }),
    }),
  deleteCdKey: (code: string) => request(`/api/cdkeys/${encodeURIComponent(code)}`, {
    method: "DELETE",
    body: JSON.stringify({ confirmLiveWrite: true }),
  }),
};
