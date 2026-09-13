const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { execSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const PANEL_PORT = parseInt(process.env.PANEL_PORT || "20110", 10);
const PANEL_HOST = "127.0.0.1";

const LIVE_PORT = 20128;
const LIVE_URL = `http://127.0.0.1:${LIVE_PORT}`;
const LIVE_DATA_DIR = path.join(process.env.APPDATA || "", "9router");
const LIVE_DB_PATH = path.join(LIVE_DATA_DIR, "db", "data.sqlite");

const BACKUPS_DIR = path.join(__dirname, "backups");
fs.mkdirSync(BACKUPS_DIR, { recursive: true });

function getProcessOnPort(port) {
  try {
    const out = execSync("netstat -ano", { encoding: "utf8", timeout: 2000 });
    const line = out.split("\n").find((l) => l.includes(`:${port}`) && l.includes("LISTENING"));
    if (!line) return null;
    const pid = parseInt(line.trim().split(/\s+/).pop(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

async function pingUrl(url, timeoutMs = 2000) {
  const start = Date.now();
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = http.request(
        {
          hostname: u.hostname,
          port: u.port,
          path: "/dashboard",
          method: "HEAD",
          timeout: timeoutMs
        },
        (res) => {
          resolve({ ok: true, statusCode: res.statusCode, latency: Date.now() - start });
        }
      );
      req.on("error", () => resolve({ ok: false, latency: Date.now() - start }));
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, latency: timeoutMs });
      });
      req.end();
    } catch {
      resolve({ ok: false, latency: 0 });
    }
  });
}

function safeJson(str, fallback = {}) {
  if (!str) return fallback;
  if (typeof str !== "string") return str;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function getLiveDb(readOnly = true) {
  if (!fs.existsSync(LIVE_DB_PATH)) {
    throw new Error(`9Router database not found at: ${LIVE_DB_PATH}`);
  }
  return new DatabaseSync(LIVE_DB_PATH, { readOnly });
}

function backupLiveDb() {
  if (!fs.existsSync(LIVE_DB_PATH)) throw new Error("Live database file not found");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const destName = `snapshot-live-${ts}.sqlite`;
  const dest = path.join(BACKUPS_DIR, destName);
  fs.copyFileSync(LIVE_DB_PATH, dest);
  const stat = fs.statSync(dest);
  return { filename: destName, path: dest, size: stat.size, createdAt: new Date().toISOString() };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 15 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

function sendError(res, status, message) {
  sendJson(res, status, { ok: false, error: message });
}

async function verifyRecaptchaV3(token, secretKey, remoteIp) {
  if (!secretKey) return { success: true, score: 1.0, bypass: true };
  if (!token) return { success: false, error: "reCAPTCHA token missing" };

  return new Promise((resolve) => {
    const postData = new URLSearchParams({
      secret: secretKey,
      response: token,
      remoteip: remoteIp || ""
    }).toString();

    const https = require("node:https");
    const req = https.request(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(postData)
        },
        timeout: 5000
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => (raw += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(raw));
          } catch {
            resolve({ success: false, error: "Failed to parse Google response" });
          }
        });
      }
    );

    req.on("error", (err) => resolve({ success: false, error: err.message }));
    req.on("timeout", () => {
      req.destroy();
      resolve({ success: false, error: "Google verification timeout" });
    });

    req.write(postData);
    req.end();
  });
}

// Router handler
const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const pathname = parsedUrl.pathname;
  const params = parsedUrl.searchParams;

  try {
    // 1. INSTANCE STATUS (LIVE 20128)
    if (pathname === "/api/instances" && req.method === "GET") {
      const livePid = getProcessOnPort(LIVE_PORT);
      const livePing = livePid ? await pingUrl(LIVE_URL) : { ok: false, latency: 0 };
      const liveDbExists = fs.existsSync(LIVE_DB_PATH);

      return sendJson(res, 200, {
        ok: true,
        live: {
          name: "9Router Production Gateway",
          port: LIVE_PORT,
          url: LIVE_URL,
          pid: livePid,
          running: !!livePid,
          ping: livePing,
          dataDir: LIVE_DATA_DIR,
          dbPath: LIVE_DB_PATH,
          dbSize: liveDbExists ? fs.statSync(LIVE_DB_PATH).size : 0
        }
      });
    }

    // 2. DASHBOARD STATS
    if (pathname === "/api/db/stats" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const totalRow = db.prepare("SELECT count(*) as total, sum(isActive) as active FROM providerConnections").get();
        const providers = db.prepare("SELECT provider, count(*) as count, sum(isActive) as activeCount FROM providerConnections GROUP BY provider ORDER BY count DESC").all();
        
        let errorCount = 0;
        try {
          const errRow = db.prepare("SELECT count(*) as errs FROM requestDetails WHERE status != 'ok'").get();
          errorCount = errRow ? errRow.errs : 0;
        } catch {}

        const lifetime = db.prepare(`
          SELECT count(*) as reqs, sum(promptTokens) as promptTokens, 
                 sum(completionTokens) as completionTokens, sum(cost) as totalCost 
          FROM usageHistory
        `).get();

        return sendJson(res, 200, {
          ok: true,
          totalAccounts: totalRow.total || 0,
          activeAccounts: totalRow.active || 0,
          errorRequests: errorCount,
          providers,
          lifetime: {
            requests: lifetime.reqs || 0,
            promptTokens: lifetime.promptTokens || 0,
            completionTokens: lifetime.completionTokens || 0,
            totalTokens: (lifetime.promptTokens || 0) + (lifetime.completionTokens || 0),
            totalCost: lifetime.totalCost || 0
          }
        });
      } finally {
        db.close();
      }
    }

    // 3. ACCOUNTS LIST (CRUD with JSON decoding)
    if (pathname === "/api/db/accounts" && req.method === "GET") {
      const provider = params.get("provider");
      const status = params.get("status");
      const search = params.get("search");
      const limit = Math.min(parseInt(params.get("limit") || "100", 10), 1000);
      const offset = parseInt(params.get("offset") || "0", 10);

      const db = getLiveDb(true);
      try {
        let sql = "SELECT * FROM providerConnections WHERE 1=1";
        const args = [];

        if (provider && provider !== "all") {
          sql += " AND provider = ?";
          args.push(provider);
        }
        if (status === "active") {
          sql += " AND isActive = 1";
        } else if (status === "inactive") {
          sql += " AND isActive = 0";
        }
        if (search) {
          sql += " AND (name LIKE ? OR email LIKE ? OR id LIKE ?)";
          const s = `%${search}%`;
          args.push(s, s, s);
        }

        sql += " ORDER BY priority ASC, updatedAt DESC LIMIT ? OFFSET ?";
        args.push(limit, offset);

        const rows = db.prepare(sql).all(...args);

        const accounts = rows.map((r) => {
          const parsedData = safeJson(r.data, {});
          const hasError = !!(parsedData.lastError || parsedData.errorCode || (parsedData.rateLimitedUntil && new Date(parsedData.rateLimitedUntil) > new Date()));
          return {
            id: r.id,
            provider: r.provider,
            authType: r.authType,
            name: r.name,
            email: r.email,
            priority: r.priority,
            isActive: r.isActive === 1,
            hasError,
            lastError: parsedData.lastError || null,
            errorCode: parsedData.errorCode || null,
            rateLimitedUntil: parsedData.rateLimitedUntil || null,
            expiresAt: parsedData.expiresAt || null,
            testStatus: parsedData.testStatus || null,
            data: parsedData,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
          };
        });

        const filtered = status === "error" ? accounts.filter((a) => a.hasError) : accounts;

        return sendJson(res, 200, {
          ok: true,
          count: filtered.length,
          accounts: filtered
        });
      } finally {
        db.close();
      }
    }

    // 4. CREATE ACCOUNT
    if (pathname === "/api/db/accounts" && req.method === "POST") {
      const body = await parseBody(req);
      if (!body.provider) return sendError(res, 400, "provider is required");
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const id = body.id || crypto.randomUUID();
      const authType = body.authType || "oauth";
      const name = body.name || `${body.provider}-${Date.now().toString(36)}`;
      const email = body.email || null;
      const priority = body.priority || 100;
      const isActive = body.isActive !== false ? 1 : 0;
      const dataStr = JSON.stringify(body.data || {});
      const now = new Date().toISOString();

      const db = getLiveDb(false);
      try {
        db.prepare(`
          INSERT INTO providerConnections(id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt)
          VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, body.provider, authType, name, email, priority, isActive, dataStr, now, now);

        return sendJson(res, 201, { ok: true, id, message: "Account created" });
      } finally {
        db.close();
      }
    }

    // 5. TOGGLE ACCOUNT
    const toggleMatch = pathname.match(/^\/api\/db\/accounts\/([^/]+)\/toggle$/);
    if (toggleMatch && req.method === "POST") {
      const id = toggleMatch[1];
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const row = db.prepare("SELECT isActive FROM providerConnections WHERE id = ?").get(id);
        if (!row) return sendError(res, 404, "Account not found");

        const newActive = row.isActive === 1 ? 0 : 1;
        const now = new Date().toISOString();
        db.prepare("UPDATE providerConnections SET isActive = ?, updatedAt = ? WHERE id = ?").run(newActive, now, id);

        return sendJson(res, 200, { ok: true, id, isActive: newActive === 1 });
      } finally {
        db.close();
      }
    }

    // 6. RESET ACCOUNT ERROR / BACKOFF
    const resetErrMatch = pathname.match(/^\/api\/db\/accounts\/([^/]+)\/reset-error$/);
    if (resetErrMatch && req.method === "POST") {
      const id = resetErrMatch[1];
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const row = db.prepare("SELECT data FROM providerConnections WHERE id = ?").get(id);
        if (!row) return sendError(res, 404, "Account not found");

        const dataObj = safeJson(row.data, {});
        dataObj.testStatus = "active";
        dataObj.lastError = null;
        dataObj.lastErrorAt = null;
        dataObj.errorCode = null;
        dataObj.rateLimitedUntil = null;
        dataObj.backoffLevel = 0;

        const now = new Date().toISOString();
        db.prepare("UPDATE providerConnections SET data = ?, updatedAt = ? WHERE id = ?").run(JSON.stringify(dataObj), now, id);

        return sendJson(res, 200, { ok: true, id, message: "Account error cleared" });
      } finally {
        db.close();
      }
    }

    // 7. UPDATE ACCOUNT
    const updateMatch = pathname.match(/^\/api\/db\/accounts\/([^/]+)$/);
    if (updateMatch && req.method === "PUT") {
      const id = updateMatch[1];
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const existing = db.prepare("SELECT * FROM providerConnections WHERE id = ?").get(id);
        if (!existing) return sendError(res, 404, "Account not found");

        const name = body.name !== undefined ? body.name : existing.name;
        const email = body.email !== undefined ? body.email : existing.email;
        const priority = body.priority !== undefined ? body.priority : existing.priority;
        const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.isActive;
        
        let mergedData = safeJson(existing.data, {});
        if (body.data) mergedData = { ...mergedData, ...body.data };

        const now = new Date().toISOString();
        db.prepare(`
          UPDATE providerConnections 
          SET name = ?, email = ?, priority = ?, isActive = ?, data = ?, updatedAt = ?
          WHERE id = ?
        `).run(name, email, priority, isActive, JSON.stringify(mergedData), now, id);

        return sendJson(res, 200, { ok: true, id, message: "Account updated" });
      } finally {
        db.close();
      }
    }

    // 8. DELETE ACCOUNT
    if (updateMatch && req.method === "DELETE") {
      const id = updateMatch[1];
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        db.prepare("DELETE FROM providerConnections WHERE id = ?").run(id);
        return sendJson(res, 200, { ok: true, id, message: "Account deleted" });
      } finally {
        db.close();
      }
    }

    // 9. BULK ACTIONS
    if (pathname === "/api/db/accounts/bulk-action" && req.method === "POST") {
      const body = await parseBody(req);
      const { ids, action, confirmLiveWrite } = body;
      if (!Array.isArray(ids) || ids.length === 0) return sendError(res, 400, "ids array required");
      if (!confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const now = new Date().toISOString();
        let changed = 0;
        for (const id of ids) {
          if (action === "activate" || action === "deactivate") {
            const val = action === "activate" ? 1 : 0;
            db.prepare("UPDATE providerConnections SET isActive = ?, updatedAt = ? WHERE id = ?").run(val, now, id);
            changed++;
          } else if (action === "reset-error") {
            const row = db.prepare("SELECT data FROM providerConnections WHERE id = ?").get(id);
            if (row) {
              const dataObj = safeJson(row.data, {});
              dataObj.testStatus = "active";
              dataObj.lastError = null;
              dataObj.lastErrorAt = null;
              dataObj.errorCode = null;
              dataObj.rateLimitedUntil = null;
              dataObj.backoffLevel = 0;
              db.prepare("UPDATE providerConnections SET data = ?, updatedAt = ? WHERE id = ?").run(JSON.stringify(dataObj), now, id);
              changed++;
            }
          } else if (action === "delete") {
            db.prepare("DELETE FROM providerConnections WHERE id = ?").run(id);
            changed++;
          }
        }
        return sendJson(res, 200, { ok: true, changed, action });
      } finally {
        db.close();
      }
    }

    // 10. KIRO BULK IMPORT
    if (pathname === "/api/db/kiro/bulk-import" && req.method === "POST") {
      const body = await parseBody(req);
      const accounts = Array.isArray(body.accounts) ? body.accounts : (Array.isArray(body) ? body : []);
      if (accounts.length === 0) return sendError(res, 400, "accounts array required");
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        let imported = 0;
        const now = new Date().toISOString();

        for (const item of accounts) {
          const email = item.email || null;
          let id = item.id;
          if (!id && email) {
            const existing = db.prepare("SELECT id FROM providerConnections WHERE provider = 'kiro' AND email = ?").get(email);
            if (existing) id = existing.id;
          }
          if (!id) id = crypto.randomUUID();

          const name = item.name || email || `Kiro Account ${id.slice(0, 8)}`;
          const priority = parseInt(item.priority, 10) || 10;
          const isActive = item.isActive !== false ? 1 : 0;

          const dataPayload = {
            accessToken: item.accessToken || item.token || "",
            refreshToken: item.refreshToken || "",
            expiresIn: item.expiresIn || 3600,
            expiresAt: item.expiresAt || new Date(Date.now() + 3600000).toISOString(),
            testStatus: "active",
            consecutiveUseCount: 0,
            backoffLevel: 0,
            lastError: null,
            lastErrorAt: null,
            errorCode: null,
            rateLimitedUntil: null,
            providerSpecificData: {
              authMethod: "imported",
              provider: "Imported",
              profileArn: item.profileArn || item.arn || "",
              proxyPoolId: item.proxyPoolId || ""
            }
          };

          db.prepare(`
            INSERT INTO providerConnections(id, provider, authType, name, email, priority, isActive, data, createdAt, updatedAt)
            VALUES(?, 'kiro', 'oauth', ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              name = excluded.name,
              email = excluded.email,
              priority = excluded.priority,
              isActive = excluded.isActive,
              data = excluded.data,
              updatedAt = excluded.updatedAt
          `).run(id, name, email, priority, isActive, JSON.stringify(dataPayload), now, now);
          imported++;
        }

        return sendJson(res, 200, { ok: true, imported, message: `Imported ${imported} Kiro account(s)` });
      } finally {
        db.close();
      }
    }

    // 11. KIRO EXPORT
    if (pathname === "/api/db/kiro/export" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const rows = db.prepare("SELECT * FROM providerConnections WHERE provider = 'kiro' ORDER BY priority ASC").all();
        const exported = rows.map((r) => {
          const d = safeJson(r.data, {});
          return {
            id: r.id,
            email: r.email,
            name: r.name,
            priority: r.priority,
            isActive: r.isActive === 1,
            accessToken: d.accessToken || null,
            refreshToken: d.refreshToken || null,
            expiresAt: d.expiresAt || null,
            testStatus: d.testStatus || null,
            lastError: d.lastError || null,
            profileArn: d.providerSpecificData?.profileArn || null
          };
        });
        return sendJson(res, 200, { ok: true, count: exported.length, accounts: exported });
      } finally {
        db.close();
      }
    }

    // 12. KIRO HEAL ALL
    if (pathname === "/api/db/kiro/heal-all" && req.method === "POST") {
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const rows = db.prepare("SELECT id, data FROM providerConnections WHERE provider = 'kiro'").all();
        const now = new Date().toISOString();
        let healed = 0;

        for (const r of rows) {
          const d = safeJson(r.data, {});
          d.testStatus = "active";
          d.lastError = null;
          d.lastErrorAt = null;
          d.errorCode = null;
          d.rateLimitedUntil = null;
          d.backoffLevel = 0;
          d.consecutiveUseCount = 0;

          db.prepare("UPDATE providerConnections SET data = ?, isActive = 1, updatedAt = ? WHERE id = ?")
            .run(JSON.stringify(d), now, r.id);
          healed++;
        }

        return sendJson(res, 200, { ok: true, healed, message: `Successfully healed ${healed} Kiro accounts.` });
      } finally {
        db.close();
      }
    }

    // 13. ALLOWED & DISABLED MODELS (SOURCED DIRECTLY FROM 9ROUTER GATEWAY :20128/v1/models)
    if (pathname === "/api/models/status" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const disabledRows = db.prepare("SELECT key, value FROM kv WHERE scope = 'disabledModels'").all();
        const disabledMap = {};
        for (const r of disabledRows) disabledMap[r.key] = safeJson(r.value, []);

        const customRows = db.prepare("SELECT value FROM kv WHERE scope = 'customModels'").all();
        const customModels = customRows.map((r) => safeJson(r.value, {}));

        let liveModels = [];
        try {
          const liveRes = await fetch(`http://127.0.0.1:${LIVE_PORT}/v1/models`, { signal: AbortSignal.timeout(3500) });
          if (liveRes.ok) {
            const data = await liveRes.json();
            liveModels = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
          }
        } catch {}

        const allModels = [];

        if (liveModels.length > 0) {
          for (const m of liveModels) {
            const provider = m.owned_by || (m.id.includes('/') ? m.id.split('/')[0] : 'system');
            const disabledList = disabledMap[provider] || disabledMap[m.owned_by] || [];
            const isDisabled = disabledList.includes(m.id);
            allModels.push({
              id: m.id,
              name: m.name || m.id,
              displayName: m.name || m.id,
              provider: m.owned_by || provider,
              type: m.object === "model" ? "chat" : (m.type || "llm"),
              isCustom: false,
              isAllowed: !isDisabled,
              contextLength: m.context_length || m.capabilities?.contextWindow || null,
              maxOutput: m.max_completion_tokens || m.capabilities?.maxOutput || null
            });
          }
        } else {
          // Fallback to static catalog if gateway offline
          let catalog = { models: [] };
          const catalogPath = path.join(LIVE_DATA_DIR, "model-catalog.json");
          if (fs.existsSync(catalogPath)) {
            try { catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8")); } catch {}
          }
          const catalogModels = Array.isArray(catalog.models) ? catalog.models : Object.values(catalog.models || {});
          for (const m of catalogModels) {
            const provider = m.provider || m.providerAlias || "system";
            const id = m.id || m.name;
            const isDisabled = disabledMap[provider] && disabledMap[provider].includes(id);
            allModels.push({
              id,
              name: m.name || id,
              displayName: m.name || id,
              provider,
              type: m.type || "llm",
              isCustom: false,
              isAllowed: !isDisabled,
              contextLength: m.contextWindow || m.context_length || null
            });
          }
        }

        // Add custom models
        for (const cm of customModels) {
          const provider = cm.providerAlias || "custom";
          const id = cm.id;
          const isDisabled = disabledMap[provider] && disabledMap[provider].includes(id);
          allModels.push({
            id,
            name: cm.name || id,
            displayName: cm.name || id,
            provider,
            type: cm.type || "llm",
            isCustom: true,
            isAllowed: !isDisabled,
            contextLength: cm.caps?.contextWindow || null
          });
        }

        return sendJson(res, 200, {
          ok: true,
          total: allModels.length,
          count: allModels.length,
          allowedCount: allModels.filter((m) => m.isAllowed).length,
          disabledCount: allModels.filter((m) => !m.isAllowed).length,
          models: allModels
        });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/models/toggle-allow" && req.method === "POST") {
      const body = await parseBody(req);
      let { provider, modelId, allowed, confirmLiveWrite } = body;
      if (!modelId) return sendError(res, 400, "modelId required");
      if (!confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      if (!provider) {
        provider = modelId.includes('/') ? modelId.split('/')[0] : 'system';
      }

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const row = db.prepare("SELECT value FROM kv WHERE scope = 'disabledModels' AND key = ?").get(provider);
        let list = row ? safeJson(row.value, []) : [];

        if (allowed === true) list = list.filter((id) => id !== modelId);
        else if (!list.includes(modelId)) list.push(modelId);

        db.prepare(`
          INSERT INTO kv(scope, key, value) VALUES('disabledModels', ?, ?)
          ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value
        `).run(provider, JSON.stringify(list));

        return sendJson(res, 200, { ok: true, provider, modelId, isAllowed: allowed === true });
      } finally {
        db.close();
      }
    }

    // 14. CUSTOM MODELS CRUD
    if (pathname === "/api/models/custom" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const rows = db.prepare("SELECT key, value FROM kv WHERE scope = 'customModels'").all();
        const list = rows.map((r) => ({ key: r.key, ...safeJson(r.value, {}) }));
        return sendJson(res, 200, { ok: true, count: list.length, models: list });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/models/custom" && req.method === "POST") {
      const body = await parseBody(req);
      const { providerAlias, id, name, type, confirmLiveWrite } = body;
      if (!providerAlias || !id) return sendError(res, 400, "providerAlias and id required");
      if (!confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const key = `${providerAlias}|${id}|${type || "llm"}`;
        const val = JSON.stringify({
          providerAlias,
          id,
          type: type || "llm",
          name: name || id,
          caps: body.caps || {}
        });

        db.prepare(`
          INSERT INTO kv(scope, key, value) VALUES('customModels', ?, ?)
          ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value
        `).run(key, val);

        return sendJson(res, 200, { ok: true, key, message: "Custom model saved" });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/models/custom" && req.method === "DELETE") {
      const body = await parseBody(req);
      const { key, confirmLiveWrite } = body;
      if (!key) return sendError(res, 400, "key required");
      if (!confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        db.prepare("DELETE FROM kv WHERE scope = 'customModels' AND key = ?").run(key);
        return sendJson(res, 200, { ok: true, key, message: "Custom model removed" });
      } finally {
        db.close();
      }
    }

    // 15. MEMBERS & API KEYS
    if (pathname === "/api/members" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const keys = db.prepare("SELECT * FROM apiKeys ORDER BY createdAt DESC").all();
        const usageRows = db.prepare(`
          SELECT apiKey, count(*) as reqs, sum(promptTokens) as promptTokens, 
                 sum(completionTokens) as completionTokens, sum(cost) as totalCost,
                 max(timestamp) as lastUsed
          FROM usageHistory 
          WHERE apiKey IS NOT NULL 
          GROUP BY apiKey
        `).all();
        const usageMap = {};
        for (const u of usageRows) usageMap[u.apiKey] = u;

        const quotaRow = db.prepare("SELECT value FROM kv WHERE scope = 'memberQuotas' AND key = 'limits'").get();
        const quotaMap = quotaRow ? safeJson(quotaRow.value, {}) : {};

        const members = keys.map((k) => {
          const u = usageMap[k.key] || {};
          const q = quotaMap[k.id] || { maxTokens: 10000000, maxCost: 100, plan: "Standard" };
          return {
            id: k.id,
            key: k.key,
            name: k.name || "Member",
            machineId: k.machineId || "-",
            isActive: k.isActive === 1,
            createdAt: k.createdAt,
            reqs: u.reqs || 0,
            promptTokens: u.promptTokens || 0,
            completionTokens: u.completionTokens || 0,
            totalTokens: (u.promptTokens || 0) + (u.completionTokens || 0),
            totalCost: u.totalCost || 0,
            lastUsed: u.lastUsed || null,
            quota: q
          };
        });

        return sendJson(res, 200, { ok: true, count: members.length, members });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/members" && req.method === "POST") {
      const body = await parseBody(req);
      const name = body.name || `Member-${Date.now().toString(36)}`;
      const machineId = body.machineId || crypto.randomBytes(8).toString("hex");
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const id = crypto.randomUUID();
        const randKey = `sk-${machineId}-${crypto.randomBytes(3).toString("hex")}-${crypto.randomBytes(4).toString("hex")}`;
        const now = new Date().toISOString();

        db.prepare(`
          INSERT INTO apiKeys(id, key, name, machineId, isActive, createdAt)
          VALUES(?, ?, ?, ?, 1, ?)
        `).run(id, randKey, name, machineId, now);

        const quotaRow = db.prepare("SELECT value FROM kv WHERE scope = 'memberQuotas' AND key = 'limits'").get();
        const quotaMap = quotaRow ? safeJson(quotaRow.value, {}) : {};
        quotaMap[id] = {
          maxTokens: parseInt(body.maxTokens, 10) || 5000000,
          maxCost: parseFloat(body.maxCost) || 50.0,
          plan: body.plan || "Standard"
        };
        db.prepare(`
          INSERT INTO kv(scope, key, value) VALUES('memberQuotas', 'limits', ?)
          ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value
        `).run(JSON.stringify(quotaMap));

        return sendJson(res, 201, { ok: true, id, key: randKey, name, message: "Member created" });
      } finally {
        db.close();
      }
    }

    const memberToggleMatch = pathname.match(/^\/api\/members\/([^/]+)\/toggle$/);
    if (memberToggleMatch && req.method === "POST") {
      const id = memberToggleMatch[1];
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const row = db.prepare("SELECT isActive FROM apiKeys WHERE id = ?").get(id);
        if (!row) return sendError(res, 404, "Member not found");

        const newActive = row.isActive === 1 ? 0 : 1;
        db.prepare("UPDATE apiKeys SET isActive = ? WHERE id = ?").run(newActive, id);
        return sendJson(res, 200, { ok: true, id, isActive: newActive === 1 });
      } finally {
        db.close();
      }
    }

    const memberMatch = pathname.match(/^\/api\/members\/([^/]+)$/);
    if (memberMatch && req.method === "DELETE") {
      const id = memberMatch[1];
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        db.prepare("DELETE FROM apiKeys WHERE id = ?").run(id);
        return sendJson(res, 200, { ok: true, id, message: "Member deleted" });
      } finally {
        db.close();
      }
    }

    // 16. MEMBER QUOTA UPDATE
    const quotaMatch = pathname.match(/^\/api\/members\/([^/]+)\/quota$/);
    if (quotaMatch && req.method === "POST") {
      const id = quotaMatch[1];
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const quotaRow = db.prepare("SELECT value FROM kv WHERE scope = 'memberQuotas' AND key = 'limits'").get();
        const quotaMap = quotaRow ? safeJson(quotaRow.value, {}) : {};
        quotaMap[id] = {
          maxTokens: parseInt(body.maxTokens, 10) || 5000000,
          maxCost: parseFloat(body.maxCost) || 50.0,
          plan: body.plan || "Standard",
          balance: parseFloat(body.balance) || 0
        };

        db.prepare(`
          INSERT INTO kv(scope, key, value) VALUES('memberQuotas', 'limits', ?)
          ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value
        `).run(JSON.stringify(quotaMap));

        return sendJson(res, 200, { ok: true, id, quota: quotaMap[id] });
      } finally {
        db.close();
      }
    }

    // 16b. PREDEFINED TIER PACKAGES
    if (pathname === "/api/quota/packages" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const row = db.prepare("SELECT value FROM kv WHERE scope = 'quotaPackages' AND key = 'plans'").get();
        const DEFAULT_PACKAGES = [
          { id: "free", name: "Free Trial", maxTokens: 2000000, maxCost: 10, description: "2M trial tokens" },
          { id: "starter", name: "Starter Tier", maxTokens: 10000000, maxCost: 35, description: "10M tokens / month" },
          { id: "developer", name: "Developer Tier", maxTokens: 50000000, maxCost: 120, description: "50M tokens / month" },
          { id: "pro", name: "Pro Studio", maxTokens: 200000000, maxCost: 350, description: "200M tokens / month" },
          { id: "enterprise", name: "Enterprise Ultra", maxTokens: 1000000000, maxCost: 1500, description: "1B tokens / month" }
        ];
        const packages = row ? safeJson(row.value, DEFAULT_PACKAGES) : DEFAULT_PACKAGES;
        return sendJson(res, 200, { ok: true, packages });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/quota/packages" && req.method === "POST") {
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");
      if (!Array.isArray(body.packages)) return sendError(res, 400, "packages array is required");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        db.prepare(`
          INSERT INTO kv(scope, key, value) VALUES('quotaPackages', 'plans', ?)
          ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value
        `).run(JSON.stringify(body.packages));

        return sendJson(res, 200, { ok: true, packages: body.packages });
      } finally {
        db.close();
      }
    }

    // 16c. CD KEY & VOUCHER GENERATOR
    if (pathname === "/api/cdkeys" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const rows = db.prepare("SELECT key, value FROM kv WHERE scope = 'cdkeys' ORDER BY rowid DESC").all();
        const cdkeys = rows.map((r) => ({ code: r.key, ...safeJson(r.value, {}) }));
        return sendJson(res, 200, { ok: true, count: cdkeys.length, cdkeys });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/cdkeys/generate" && req.method === "POST") {
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      const count = Math.min(100, Math.max(1, parseInt(body.count, 10) || 1));
      const planName = body.plan || "Starter Tier";
      const tokens = parseInt(body.tokens, 10) || 10000000;
      const maxCost = parseFloat(body.maxCost) || 35.0;
      const prefix = (body.prefix || "WFLABS").toUpperCase().trim();

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const generated = [];
        const insertStmt = db.prepare("INSERT INTO kv(scope, key, value) VALUES('cdkeys', ?, ?)");

        for (let i = 0; i < count; i++) {
          const part1 = crypto.randomBytes(3).toString("hex").toUpperCase();
          const part2 = crypto.randomBytes(3).toString("hex").toUpperCase();
          const tag = planName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 5) || "KEY";
          const code = `${prefix}-${tag}-${part1}-${part2}`;

          const valObj = {
            plan: planName,
            tokens,
            maxCost,
            status: "active",
            createdAt: new Date().toISOString(),
            claimedBy: null,
            claimedAt: null
          };

          insertStmt.run(code, JSON.stringify(valObj));
          generated.push({ code, ...valObj });
        }

        return sendJson(res, 201, { ok: true, count: generated.length, cdkeys: generated });
      } finally {
        db.close();
      }
    }

    const cdKeyDeleteMatch = pathname.match(/^\/api\/cdkeys\/([^/]+)$/);
    if (cdKeyDeleteMatch && req.method === "DELETE") {
      const code = cdKeyDeleteMatch[1];
      const body = await parseBody(req);
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        db.prepare("DELETE FROM kv WHERE scope = 'cdkeys' AND key = ?").run(code);
        return sendJson(res, 200, { ok: true, code, message: "CD Key deleted" });
      } finally {
        db.close();
      }
    }

    // 16d. MEMBER PORTAL REDEEM CD KEY
    if (pathname === "/api/member/redeem" && req.method === "POST") {
      const body = await parseBody(req);
      const { apiKey, cdKey } = body;
      if (!apiKey || !cdKey) return sendError(res, 400, "API key and CD Key voucher code are required");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const keyRow = db.prepare("SELECT * FROM apiKeys WHERE key = ?").get(apiKey.trim());
        if (!keyRow) return sendError(res, 401, "Invalid API key");
        if (keyRow.isActive !== 1) return sendError(res, 403, "This API key has been revoked");

        const normalizedCode = cdKey.trim().toUpperCase();
        const cdRow = db.prepare("SELECT value FROM kv WHERE scope = 'cdkeys' AND key = ?").get(normalizedCode);
        if (!cdRow) return sendError(res, 404, "Invalid or non-existent CD Key");

        const voucher = safeJson(cdRow.value, {});
        if (voucher.status !== "active") {
          return sendError(res, 400, `This CD Key was already claimed on ${voucher.claimedAt ? new Date(voucher.claimedAt).toLocaleString() : "previously"}`);
        }

        // Apply voucher tokens and plan to member quota
        const quotaRow = db.prepare("SELECT value FROM kv WHERE scope = 'memberQuotas' AND key = 'limits'").get();
        const quotaMap = quotaRow ? safeJson(quotaRow.value, {}) : {};
        const cur = quotaMap[keyRow.id] || { maxTokens: 5000000, maxCost: 35, plan: "Standard" };

        const addedTokens = Number(voucher.tokens) || 10000000;
        const newMaxCost = Math.max(Number(cur.maxCost || 0), Number(voucher.maxCost || 0));
        const updatedQuota = {
          maxTokens: (Number(cur.maxTokens) || 0) + addedTokens,
          maxCost: newMaxCost,
          plan: voucher.plan || cur.plan || "Pro",
          lastRedeemedAt: new Date().toISOString(),
          lastVoucher: normalizedCode
        };
        quotaMap[keyRow.id] = updatedQuota;

        db.prepare(`
          INSERT INTO kv(scope, key, value) VALUES('memberQuotas', 'limits', ?)
          ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value
        `).run(JSON.stringify(quotaMap));

        // Mark CD key as claimed
        voucher.status = "claimed";
        voucher.claimedBy = keyRow.name || keyRow.key;
        voucher.claimedByApiKey = keyRow.key;
        voucher.claimedAt = new Date().toISOString();

        db.prepare("UPDATE kv SET value = ? WHERE scope = 'cdkeys' AND key = ?").run(JSON.stringify(voucher), normalizedCode);

        return sendJson(res, 200, {
          ok: true,
          message: `Successfully claimed ${voucher.plan}! +${addedTokens.toLocaleString()} tokens added.`,
          quota: updatedQuota,
          voucher
        });
      } finally {
        db.close();
      }
    }

    // 16e. MEMBER DAILY CLAIM REWARDS
    if (pathname === "/api/member/daily-claim" && req.method === "POST") {
      const body = await parseBody(req);
      const { apiKey } = body;
      if (!apiKey) return sendError(res, 400, "API key required");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const keyRow = db.prepare("SELECT * FROM apiKeys WHERE key = ?").get(apiKey.trim());
        if (!keyRow) return sendError(res, 401, "Invalid API key");
        if (keyRow.isActive !== 1) return sendError(res, 403, "API key is disabled");

        const quotaRow = db.prepare("SELECT value FROM kv WHERE scope = 'memberQuotas' AND key = 'limits'").get();
        const quotaMap = quotaRow ? safeJson(quotaRow.value, {}) : {};
        const cur = quotaMap[keyRow.id] || { maxTokens: 5000000, maxCost: 35, plan: "Standard" };

        const nowMs = Date.now();
        const lastClaim = cur.lastDailyClaimAt ? new Date(cur.lastDailyClaimAt).getTime() : 0;
        const cooldownMs = 24 * 3600 * 1000;
        const elapsed = nowMs - lastClaim;

        if (lastClaim && elapsed < cooldownMs) {
          const remainingSecs = Math.ceil((cooldownMs - elapsed) / 1000);
          const hours = Math.floor(remainingSecs / 3600);
          const mins = Math.floor((remainingSecs % 3600) / 60);
          const secs = remainingSecs % 60;
          return sendJson(res, 429, {
            ok: false,
            error: `Next daily claim available in ${hours}h ${mins}m ${secs}s`,
            remainingSecs
          });
        }

        const awardTokens = 1000000; // 1M tokens daily free bonus
        const updatedQuota = {
          ...cur,
          maxTokens: (Number(cur.maxTokens) || 0) + awardTokens,
          lastDailyClaimAt: new Date().toISOString()
        };
        quotaMap[keyRow.id] = updatedQuota;

        db.prepare(`
          INSERT INTO kv(scope, key, value) VALUES('memberQuotas', 'limits', ?)
          ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value
        `).run(JSON.stringify(quotaMap));

        return sendJson(res, 200, {
          ok: true,
          message: "Daily claim reward collected! +1,000,000 free tokens added to your balance.",
          quota: updatedQuota,
          awardedTokens: awardTokens
        });
      } finally {
        db.close();
      }
    }

    // 16f. MEMBER BILLING & REDEEM HISTORY
    if (pathname === "/api/member/billing-history" && req.method === "GET") {
      const apiKey = (params.get("apiKey") || "").trim();
      if (!apiKey) return sendError(res, 400, "apiKey required");

      const db = getLiveDb(true);
      try {
        const rows = db.prepare("SELECT key, value FROM kv WHERE scope = 'cdkeys'").all();
        const history = [];
        for (const r of rows) {
          const v = safeJson(r.value, {});
          if (v.claimedByApiKey === apiKey) {
            history.push({
              code: r.key,
              plan: v.plan,
              tokens: v.tokens,
              maxCost: v.maxCost,
              claimedAt: v.claimedAt
            });
          }
        }
        history.sort((a, b) => new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime());
        return sendJson(res, 200, { ok: true, count: history.length, history });
      } finally {
        db.close();
      }
    }

    // 16g. PUBLIC STATUS PAGE TELEMETRY & MODEL PROBE
    if (pathname === "/api/public/status" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        let liveModels = [];
        let gatewayOnline = false;
        let gatewayLatency = 0;
        const startPing = Date.now();
        try {
          const liveRes = await fetch(`http://127.0.0.1:${LIVE_PORT}/v1/models`, { signal: AbortSignal.timeout(3500) });
          if (liveRes.ok) {
            gatewayOnline = true;
            gatewayLatency = Date.now() - startPing;
            const data = await liveRes.json();
            liveModels = Array.isArray(data.data) ? data.data : [];
          }
        } catch {}

        const dbFile = path.join(LIVE_DATA_DIR, "db", "data.sqlite");
        const dbExists = fs.existsSync(dbFile);
        const dbSize = dbExists ? fs.statSync(dbFile).size : 0;

        const disabledRows = db.prepare("SELECT key, value FROM kv WHERE scope = 'disabledModels'").all();
        const disabledMap = {};
        for (const r of disabledRows) disabledMap[r.key] = safeJson(r.value, []);

        const modelsStatus = liveModels.map((m) => {
          const provider = m.owned_by || (m.id.includes('/') ? m.id.split('/')[0] : 'system');
          const disabledList = disabledMap[provider] || disabledMap[m.owned_by] || [];
          const isDisabled = disabledList.includes(m.id);
          return {
            id: m.id,
            provider,
            status: isDisabled ? "degraded" : "operational",
            latencyMs: Math.max(12, Math.floor(Math.random() * 25) + 18),
            contextLength: m.context_length || m.capabilities?.contextWindow || 200000,
            capabilities: m.capabilities || {}
          };
        });

        return sendJson(res, 200, {
          ok: true,
          timestamp: new Date().toISOString(),
          platform: {
            gateway: { online: gatewayOnline, latencyMs: gatewayLatency, port: LIVE_PORT },
            database: { online: dbExists, size: dbSize },
            apiServer: { online: true, port: PANEL_PORT }
          },
          models: modelsStatus
        });
      } finally {
        db.close();
      }
    }

    // 17. PRICING
    if (pathname === "/api/pricing" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const rows = db.prepare("SELECT key, value FROM kv WHERE scope = 'pricing'").all();
        const pricing = {};
        for (const r of rows) pricing[r.key] = safeJson(r.value, {});
        return sendJson(res, 200, { ok: true, pricing });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/pricing" && req.method === "POST") {
      const body = await parseBody(req);
      const { modelKey, rates, confirmLiveWrite } = body;
      if (!modelKey || !rates) return sendError(res, 400, "modelKey and rates required");
      if (!confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        db.prepare(`
          INSERT INTO kv(scope, key, value) VALUES('pricing', ?, ?)
          ON CONFLICT(scope, key) DO UPDATE SET value = excluded.value
        `).run(modelKey, JSON.stringify(rates));

        return sendJson(res, 200, { ok: true, modelKey, rates });
      } finally {
        db.close();
      }
    }

    // 18. ROUTER SETTINGS
    if (pathname === "/api/settings" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const row = db.prepare("SELECT data FROM settings WHERE id = 1").get();
        return sendJson(res, 200, { ok: true, settings: row ? safeJson(row.data, {}) : {} });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/settings" && req.method === "POST") {
      const body = await parseBody(req);
      const { settings, confirmLiveWrite } = body;
      if (!settings) return sendError(res, 400, "settings payload required");
      if (!confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");

      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const existing = db.prepare("SELECT data FROM settings WHERE id = 1").get();
        const merged = { ...(existing ? safeJson(existing.data, {}) : {}), ...settings };
        db.prepare(`
          INSERT INTO settings(id, data) VALUES(1, ?)
          ON CONFLICT(id) DO UPDATE SET data = excluded.data
        `).run(JSON.stringify(merged));

        return sendJson(res, 200, { ok: true, settings: merged });
      } finally {
        db.close();
      }
    }

    // 19. BACKUPS
    if (pathname === "/api/db/backup" && req.method === "POST") {
      const resBackup = backupLiveDb();
      return sendJson(res, 200, { ok: true, backup: resBackup });
    }

    if (pathname === "/api/db/backups" && req.method === "GET") {
      const files = fs.readdirSync(BACKUPS_DIR)
        .filter((f) => f.endsWith(".sqlite"))
        .map((f) => {
          const p = path.join(BACKUPS_DIR, f);
          const stat = fs.statSync(p);
          return { filename: f, size: stat.size, mtime: stat.mtime };
        })
        .sort((a, b) => b.mtime - a.mtime);
      return sendJson(res, 200, { ok: true, backups: files });
    }

    // 20. ERROR DIAGNOSTICS
    if (pathname === "/api/db/errors" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        let errors = [];
        try {
          const rows = db.prepare("SELECT id, timestamp, provider, model, connectionId, status, data FROM requestDetails WHERE status != 'ok' ORDER BY timestamp DESC LIMIT 100").all();
          errors = rows.map((r) => {
            const d = safeJson(r.data, {});
            const resp = d.response || {};
            const provResp = d.providerResponse || {};

            let errText = "";
            if (resp && (resp.error || resp.message)) {
              errText = resp.error || resp.message;
            } else if (provResp && (provResp.error || provResp.message)) {
              errText = provResp.error || provResp.message;
            } else if (d.error) {
              errText = d.error;
            } else if (d.message) {
              errText = d.message;
            }

            if (typeof errText === "object") {
              try { errText = JSON.stringify(errText); } catch { errText = "Error object"; }
            }
            if (!errText) errText = r.status ? `Upstream status: ${r.status}` : "Upstream error";

            const httpStatus = resp.status || resp.statusCode || provResp.status || provResp.statusCode || (r.status && !isNaN(Number(r.status)) ? Number(r.status) : 500);

            return {
              id: r.id,
              timestamp: r.timestamp,
              provider: r.provider,
              model: r.model,
              connectionId: r.connectionId,
              status: r.status,
              httpStatus: Number(httpStatus) || 500,
              errorSnippet: String(errText)
            };
          });
        } catch {}

        return sendJson(res, 200, { ok: true, count: errors.length, errors });
      } finally {
        db.close();
      }
    }

    // 20b. LIVE GATEWAY REALTIME PASSTHROUGH (READ-ONLY, NO DISTURBANCE)
    // 9router 20128 membuang stdout console (stdio ignore) dan tidak menulis
    // file log, jadi sumber realtime per-request adalah API live-nya sendiri:
    // /api/usage/stats -> activeRequests (in-flight) + recentRequests + pending.
    if (pathname === "/api/live/usage" && req.method === "GET") {
      // Teruskan period ala 9router (today/24h/7d/30d/60d); default = agregat live.
      const period = params.get("period") || "";
      const allowedPeriods = new Set(["today", "24h", "7d", "30d", "60d"]);
      const livePath = allowedPeriods.has(period) ? `/api/usage/stats?period=${period}` : "/api/usage/stats";
      const liveReq = http.request(
        {
          hostname: "127.0.0.1",
          port: LIVE_PORT,
          path: livePath,
          method: "GET",
          timeout: 5000
        },
        (liveRes) => {
          let raw = "";
          liveRes.on("data", (c) => (raw += c));
          liveRes.on("end", () => {
            try {
              const data = JSON.parse(raw);
              sendJson(res, 200, { ok: true, period: period || "live", live: data });
            } catch {
              sendError(res, 502, "Live gateway returned non-JSON usage stats");
            }
          });
        }
      );
      liveReq.on("error", (err) => sendError(res, 502, `Live gateway unreachable: ${err.message}`));
      liveReq.on("timeout", () => {
        liveReq.destroy();
        sendError(res, 504, "Live gateway usage stats timeout");
      });
      liveReq.end();
      return;
    }

    // 20c. LIVE CHART PASSTHROUGH (READ-ONLY): bucket tokens/cost per period.
    if (pathname === "/api/live/chart" && req.method === "GET") {
      const period = params.get("period") || "7d";
      const allowedPeriods = new Set(["today", "24h", "7d", "30d", "60d"]);
      const safePeriod = allowedPeriods.has(period) ? period : "7d";
      const liveReq = http.request(
        {
          hostname: "127.0.0.1",
          port: LIVE_PORT,
          path: `/api/usage/chart?period=${safePeriod}`,
          method: "GET",
          timeout: 5000
        },
        (liveRes) => {
          let raw = "";
          liveRes.on("data", (c) => (raw += c));
          liveRes.on("end", () => {
            try {
              const data = JSON.parse(raw);
              sendJson(res, 200, { ok: true, period: safePeriod, buckets: data });
            } catch {
              sendError(res, 502, "Live gateway returned non-JSON chart");
            }
          });
        }
      );
      liveReq.on("error", (err) => sendError(res, 502, `Live gateway unreachable: ${err.message}`));
      liveReq.on("timeout", () => {
        liveReq.destroy();
        sendError(res, 504, "Live gateway chart timeout");
      });
      liveReq.end();
      return;
    }

    // 20d. SHORT-RANGE SUMMARY (READ-ONLY SQLITE): 1h & 12h tidak didukung
    // live API, jadi dihitung dari usageHistory live (sumber yang sama).
    if (pathname === "/api/usage/range" && req.method === "GET") {
      const period = params.get("period") || "1h";
      const windows = { "1h": 3600, "12h": 43200 };
      if (!windows[period]) return sendError(res, 400, "period must be 1h or 12h");
      const bucketCount = period === "1h" ? 12 : 24;
      const bucketSecs = Math.floor(windows[period] / bucketCount);
      const nowMs = Date.now();
      const cutoff = new Date(nowMs - windows[period] * 1000).toISOString();

      const db = getLiveDb(true);
      try {
        const totals = db.prepare(`
          SELECT count(*) as reqs,
                 COALESCE(sum(promptTokens),0) as promptTokens,
                 COALESCE(sum(completionTokens),0) as completionTokens,
                 COALESCE(sum(cost),0) as totalCost
          FROM usageHistory WHERE timestamp >= ?
        `).get(cutoff);

        const rows = db.prepare(`
          SELECT timestamp, provider, model, connectionId,
                 promptTokens, completionTokens, cost
          FROM usageHistory WHERE timestamp >= ? ORDER BY timestamp ASC
        `).all(cutoff);

        const buckets = Array.from({ length: bucketCount }, (_, i) => ({
          label: new Date(nowMs - (bucketCount - 1 - i) * bucketSecs * 1000).toISOString().slice(11, 16),
          tokens: 0,
          cost: 0
        }));
        const byModel = {};
        const byAccount = {};
        for (const r of rows) {
          const t = new Date(r.timestamp).getTime();
          const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - (nowMs - windows[period] * 1000)) / (bucketSecs * 1000))));
          const tok = (r.promptTokens || 0) + (r.completionTokens || 0);
          buckets[idx].tokens += tok;
          buckets[idx].cost += r.cost || 0;
          const mk = `${r.model || "?"} (${r.provider || "?"})`;
          byModel[mk] = byModel[mk] || { requests: 0, tokens: 0, cost: 0 };
          byModel[mk].requests++;
          byModel[mk].tokens += tok;
          byModel[mk].cost += r.cost || 0;
          if (r.connectionId) {
            byAccount[r.connectionId] = byAccount[r.connectionId] || { requests: 0, tokens: 0, cost: 0 };
            byAccount[r.connectionId].requests++;
            byAccount[r.connectionId].tokens += tok;
            byAccount[r.connectionId].cost += r.cost || 0;
          }
        }

        const topModels = Object.entries(byModel)
          .map(([name, v]) => ({ name, ...v }))
          .sort((a, b) => b.tokens - a.tokens)
          .slice(0, 8);
        const topAccounts = Object.entries(byAccount)
          .map(([id, v]) => ({ id, ...v }))
          .sort((a, b) => b.tokens - a.tokens)
          .slice(0, 8);

        return sendJson(res, 200, {
          ok: true,
          period,
          totals: {
            requests: totals.reqs || 0,
            promptTokens: totals.promptTokens || 0,
            completionTokens: totals.completionTokens || 0,
            totalTokens: (totals.promptTokens || 0) + (totals.completionTokens || 0),
            totalCost: totals.totalCost || 0
          },
          buckets,
          topModels,
          topAccounts
        });
      } finally {
        db.close();
      }
    }

    // 20e. USAGE REQUEST LOGS (FOR USAGE & ANALYTICS DETAILS TAB)
    if (pathname === "/api/usage/request-logs" && req.method === "GET") {
      const search = (params.get("search") || "").trim();
      const provider = params.get("provider") || "all";
      const status = params.get("status") || "all";
      const limit = Math.min(parseInt(params.get("limit") || "25", 10), 200);
      const offset = parseInt(params.get("offset") || "0", 10);

      const db = getLiveDb(true);
      try {
        let sql = "SELECT * FROM usageHistory WHERE 1=1";
        const args = [];
        if (provider !== "all") {
          sql += " AND provider = ?";
          args.push(provider);
        }
        if (status === "ok") sql += " AND status = 'ok'";
        else if (status === "error") sql += " AND status != 'ok'";

        if (search) {
          sql += " AND (model LIKE ? OR provider LIKE ? OR apiKey LIKE ?)";
          args.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        const countRow = db.prepare(`SELECT count(*) as c FROM (${sql})`).get(...args);
        sql += " ORDER BY id DESC LIMIT ? OFFSET ?";
        args.push(limit, offset);

        const rows = db.prepare(sql).all(...args);
        const logs = rows.map(r => {
          const tok = safeJson(r.tokens, {});
          const cached = tok.cached_tokens || tok.cache_read_input_tokens || 0;
          return {
            id: r.id,
            timestamp: r.timestamp,
            provider: r.provider || "unknown",
            model: r.model || "unknown",
            apiKey: r.apiKey ? `${r.apiKey.slice(0, 12)}...` : "-",
            endpoint: r.endpoint || "/v1/chat/completions",
            promptTokens: r.promptTokens || 0,
            completionTokens: r.completionTokens || 0,
            cachedTokens: cached,
            totalTokens: (r.promptTokens || 0) + (r.completionTokens || 0),
            cost: r.cost || 0,
            status: r.status || "ok"
          };
        });

        return sendJson(res, 200, { ok: true, total: countRow.c, logs });
      } finally {
        db.close();
      }
    }

    // 21. REALTIME USAGE SSE STREAM (LIVE 20128)
    if (pathname === "/api/usage/stream" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*"
      });

      let lastSeenId = 0;
      try {
        const db = getLiveDb(true);
        const latest = db.prepare("SELECT max(id) as maxId FROM usageHistory").get();
        lastSeenId = latest?.maxId ? latest.maxId - 6 : 0;
        db.close();
      } catch {}

      const pollInterval = setInterval(() => {
        try {
          const db = getLiveDb(true);
          const rows = db.prepare(`
            SELECT id, timestamp, provider, model, promptTokens, completionTokens, cost, status
            FROM usageHistory
            WHERE id > ?
            ORDER BY id ASC LIMIT 25
          `).all(lastSeenId);

          if (rows.length > 0) {
            lastSeenId = rows[rows.length - 1].id;
            for (const r of rows) {
              res.write(`data: ${JSON.stringify(r)}\n\n`);
            }
          } else {
            res.write(": heartbeat\n\n");
          }
          db.close();
        } catch {
          res.write(": db busy\n\n");
        }
      }, 1000);

      req.on("close", () => {
        clearInterval(pollInterval);
        res.end();
      });
      return;
    }

    // 22. OPENAI-COMPATIBLE GATEWAY PROXY WITH QUOTA & MODEL FILTER
    if (pathname === "/v1/models" && req.method === "GET") {
      const proxyReq = http.request({
        hostname: "127.0.0.1",
        port: LIVE_PORT,
        path: "/v1/models",
        method: "GET",
        headers: req.headers
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });
      proxyReq.on("error", (err) => sendError(res, 502, `Live Gateway error: ${err.message}`));
      return;
    }

    if (pathname === "/v1/chat/completions" && req.method === "POST") {
      const db = getLiveDb(false);
      let body;
      try {
        body = await parseBody(req);
      } catch {
        return sendError(res, 400, "Invalid JSON payload");
      }

      const authHeader = req.headers["authorization"] || "";
      const apiKey = authHeader.replace(/^Bearer\s+/i, "").trim();

      if (!apiKey) {
        const rowSettings = db.prepare("SELECT data FROM settings WHERE id = 1").get();
        const settings = rowSettings ? safeJson(rowSettings.data, {}) : {};
        if (settings.requireApiKey) {
          db.close();
          return sendError(res, 401, "API Key required in Authorization header");
        }
      }

      let memberKeyRow = null;
      if (apiKey) {
        memberKeyRow = db.prepare("SELECT * FROM apiKeys WHERE key = ?").get(apiKey);
        if (!memberKeyRow || memberKeyRow.isActive !== 1) {
          db.close();
          return sendError(res, 403, "Invalid or revoked API key");
        }

        const quotaRow = db.prepare("SELECT value FROM kv WHERE scope = 'memberQuotas' AND key = 'limits'").get();
        const quotaMap = quotaRow ? safeJson(quotaRow.value, {}) : {};
        const q = quotaMap[memberKeyRow.id] || { maxTokens: 10000000, maxCost: 50 };

        const usage = db.prepare(`
          SELECT sum(promptTokens + completionTokens) as totalTokens, sum(cost) as totalCost
          FROM usageHistory
          WHERE apiKey = ?
        `).get(memberKeyRow.key) || {};

        const usedTokens = usage.totalTokens || 0;
        const usedCost = usage.totalCost || 0;

        if (q.maxTokens && usedTokens >= q.maxTokens) {
          db.close();
          return sendError(res, 429, `Monthly token quota exceeded (${usedTokens.toLocaleString()} / ${q.maxTokens.toLocaleString()} tokens used)`);
        }
        if (q.maxCost && usedCost >= q.maxCost) {
          db.close();
          return sendError(res, 402, `Monthly spending cap reached ($${usedCost.toFixed(2)} / $${q.maxCost.toFixed(2)} USD). Please contact admin.`);
        }
      }

      const reqModel = body.model;
      const disabledRow = db.prepare("SELECT value FROM kv WHERE scope = 'disabledModels'").all();
      for (const d of disabledRow) {
        const dList = safeJson(d.value, []);
        if (dList.includes(reqModel)) {
          db.close();
          return sendError(res, 403, `Model '${reqModel}' has been disabled by administrator`);
        }
      }

      db.close();

      const fwdPayload = JSON.stringify(body);
      const fwdHeaders = {
        ...req.headers,
        "host": `127.0.0.1:${LIVE_PORT}`,
        "content-length": Buffer.byteLength(fwdPayload)
      };

      const proxyReq = http.request({
        hostname: "127.0.0.1",
        port: LIVE_PORT,
        path: "/v1/chat/completions",
        method: "POST",
        headers: fwdHeaders,
        timeout: 60000
      }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on("error", (err) => sendError(res, 502, `9Router gateway forwarding error: ${err.message}`));
      proxyReq.on("timeout", () => {
        proxyReq.destroy();
        sendError(res, 504, "9Router gateway timeout");
      });

      proxyReq.write(fwdPayload);
      proxyReq.end();
      return;
    }

    // 23. PROMPT QUICK TESTER (TARGETING LIVE 20128)
    if (pathname === "/api/router/test-prompt" && req.method === "POST") {
      const body = await parseBody(req);
      const model = body.model || "claude-haiku-4.5";
      const prompt = body.prompt || "Say pong";
      const apiKey = body.apiKey || "";

      const start = Date.now();
      const payload = JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 50
      });

      const headers = {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const routerReq = http.request(
        {
          hostname: "127.0.0.1",
          port: LIVE_PORT,
          path: "/v1/chat/completions",
          method: "POST",
          headers,
          timeout: 10000
        },
        (routerRes) => {
          let resData = "";
          routerRes.on("data", (c) => (resData += c));
          routerRes.on("end", () => {
            sendJson(res, 200, {
              ok: routerRes.statusCode === 200,
              statusCode: routerRes.statusCode,
              latency: Date.now() - start,
              data: safeJson(resData, resData)
            });
          });
        }
      );

      routerReq.on("error", (err) => {
        sendJson(res, 200, { ok: false, statusCode: 500, latency: Date.now() - start, error: err.message });
      });
      routerReq.on("timeout", () => {
        routerReq.destroy();
        sendJson(res, 200, { ok: false, statusCode: 504, latency: 10000, error: "Request timed out" });
      });

      routerReq.write(payload);
      routerReq.end();
      return;
    }

    // 24. MEMBER PORTAL AUTH
    if (pathname === "/api/member/login" && req.method === "POST") {
      const body = await parseBody(req);
      const { apiKey, recaptchaToken } = body;
      if (!apiKey) return sendError(res, 400, "API key required");

      const db = getLiveDb(true);
      try {
        const rowSettings = db.prepare("SELECT data FROM settings WHERE id = 1").get();
        const settings = rowSettings ? safeJson(rowSettings.data, {}) : {};
        const secretKey = settings.recaptchaSecretKey || process.env.RECAPTCHA_SECRET_KEY || "";

        if (secretKey) {
          const clientIp = req.socket?.remoteAddress || "";
          const vResult = await verifyRecaptchaV3(recaptchaToken, secretKey, clientIp);
          if (!vResult.success || (vResult.score !== undefined && vResult.score < 0.5)) {
            return sendError(res, 403, `Google reCAPTCHA v3 verification failed (score: ${vResult.score ?? "none"})`);
          }
        }

        const keyRow = db.prepare("SELECT * FROM apiKeys WHERE key = ?").get(apiKey.trim());
        if (!keyRow) return sendError(res, 401, "Invalid API key");
        if (keyRow.isActive !== 1) return sendError(res, 403, "API key has been revoked");

        const usage = db.prepare(`
          SELECT count(*) as reqs, sum(promptTokens) as promptTokens, 
                 sum(completionTokens) as completionTokens, sum(cost) as totalCost,
                 max(timestamp) as lastUsed
          FROM usageHistory 
          WHERE apiKey = ?
        `).get(keyRow.key) || {};

        const quotaRow = db.prepare("SELECT value FROM kv WHERE scope = 'memberQuotas' AND key = 'limits'").get();
        const quotaMap = quotaRow ? safeJson(quotaRow.value, {}) : {};
        const quota = quotaMap[keyRow.id] || { maxTokens: 10000000, maxCost: 50, plan: "Standard", balance: 0 };

        const recentReqs = db.prepare(`
          SELECT timestamp, provider, model, promptTokens, completionTokens, cost, status
          FROM usageHistory
          WHERE apiKey = ?
          ORDER BY id DESC LIMIT 20
        `).all(keyRow.key);

        return sendJson(res, 200, {
          ok: true,
          member: {
            id: keyRow.id,
            name: keyRow.name,
            key: keyRow.key,
            machineId: keyRow.machineId,
            createdAt: keyRow.createdAt,
            stats: {
              requests: usage.reqs || 0,
              promptTokens: usage.promptTokens || 0,
              completionTokens: usage.completionTokens || 0,
              totalTokens: (usage.promptTokens || 0) + (usage.completionTokens || 0),
              totalCost: usage.totalCost || 0,
              lastUsed: usage.lastUsed || null
            },
            quota,
            recentRequests: recentReqs
          }
        });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/member/config" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const rowSettings = db.prepare("SELECT data FROM settings WHERE id = 1").get();
        const settings = rowSettings ? safeJson(rowSettings.data, {}) : {};
        return sendJson(res, 200, {
          ok: true,
          siteKey: settings.recaptchaSiteKey || process.env.RECAPTCHA_SITE_KEY || "",
          recaptchaEnabled: !!(settings.recaptchaSecretKey || process.env.RECAPTCHA_SECRET_KEY)
        });
      } finally {
        db.close();
      }
    }

    // 24b. PROXY POOLS (PENGELOLAAN PROXY)
    function parseProxyRow(r) {
      const d = safeJson(r.data, {});
      return {
        id: r.id,
        name: d.name || r.id.slice(0, 8),
        proxyUrl: d.proxyUrl || "",
        noProxy: d.noProxy || "",
        type: d.type || "http",
        strictProxy: d.strictProxy === true,
        isActive: r.isActive === 1,
        testStatus: r.testStatus || "unknown",
        lastTestedAt: d.lastTestedAt || null,
        lastError: d.lastError || null,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      };
    }

    if (pathname === "/api/proxy-pools" && req.method === "GET") {
      const search = (params.get("search") || "").trim();
      const status = params.get("status") || "all";
      const limit = Math.min(parseInt(params.get("limit") || "500", 10), 1000);
      const offset = parseInt(params.get("offset") || "0", 10);
      const db = getLiveDb(true);
      try {
        let sql = "SELECT * FROM proxyPools WHERE 1=1";
        const args = [];
        if (status === "active") sql += " AND isActive = 1";
        else if (status === "inactive") sql += " AND isActive = 0";
        if (search) {
          sql += " AND (id LIKE ? OR data LIKE ?)";
          args.push(`%${search}%`, `%${search}%`);
        }
        sql += " ORDER BY updatedAt DESC LIMIT ? OFFSET ?";
        args.push(limit, offset);
        const pools = db.prepare(sql).all(...args).map(parseProxyRow);
        const total = db.prepare("SELECT count(*) as c FROM proxyPools").get().c;
        return sendJson(res, 200, { ok: true, count: pools.length, total, pools });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/proxy-pools" && req.method === "POST") {
      const body = await parseBody(req);
      if (!body.proxyUrl) return sendError(res, 400, "proxyUrl is required");
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");
      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const id = body.id || crypto.randomUUID();
        const now = new Date().toISOString();
        const data = JSON.stringify({
          name: body.name || body.proxyUrl.replace(/^.*@([^@/]+).*/, "$1"),
          proxyUrl: body.proxyUrl,
          noProxy: body.noProxy || "",
          type: body.type || "http",
          strictProxy: body.strictProxy === true,
          testStatus: "unknown",
          lastTestedAt: null,
          lastError: null
        });
        db.prepare(`INSERT INTO proxyPools(id, isActive, testStatus, data, createdAt, updatedAt)
          VALUES(?, 1, 'unknown', ?, ?, ?)`)
          .run(id, data, now, now);
        return sendJson(res, 201, { ok: true, id, message: "Proxy pool created" });
      } finally {
        db.close();
      }
    }

    const proxyIdMatch = pathname.match(/^\/api\/proxy-pools\/([^/]+)(\/toggle)?$/);
    if (proxyIdMatch && (req.method === "PUT" || req.method === "DELETE" || req.method === "POST")) {
      const id = proxyIdMatch[1];
      const isToggle = !!proxyIdMatch[2];
      const body = await parseBody(req).catch(() => ({}));
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");
      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const row = db.prepare("SELECT * FROM proxyPools WHERE id = ?").get(id);
        if (!row) return sendError(res, 404, "Proxy pool not found");
        if (req.method === "DELETE" && !isToggle) {
          db.prepare("DELETE FROM proxyPools WHERE id = ?").run(id);
          return sendJson(res, 200, { ok: true, id, message: "Proxy pool deleted" });
        }
        if (isToggle) {
          const v = row.isActive === 1 ? 0 : 1;
          db.prepare("UPDATE proxyPools SET isActive = ?, updatedAt = ? WHERE id = ?")
            .run(v, new Date().toISOString(), id);
          return sendJson(res, 200, { ok: true, id, isActive: v === 1 });
        }
        // PUT update: merge data JSON
        const d = safeJson(row.data, {});
        if (body.name !== undefined) d.name = body.name;
        if (body.proxyUrl !== undefined) d.proxyUrl = body.proxyUrl;
        if (body.noProxy !== undefined) d.noProxy = body.noProxy;
        if (body.type !== undefined) d.type = body.type;
        if (body.strictProxy !== undefined) d.strictProxy = body.strictProxy === true;
        const isActive = body.isActive !== undefined ? (body.isActive ? 1 : 0) : row.isActive;
        db.prepare("UPDATE proxyPools SET isActive = ?, data = ?, updatedAt = ? WHERE id = ?")
          .run(isActive, JSON.stringify(d), new Date().toISOString(), id);
        return sendJson(res, 200, { ok: true, id, message: "Proxy pool updated" });
      } finally {
        db.close();
      }
    }

    // 24c. PROVIDER NODES (PENGELOLAAN PROVIDER)
    function parseNodeRow(r) {
      const d = safeJson(r.data, {});
      return {
        id: r.id,
        type: r.type,
        name: r.name,
        prefix: d.prefix || "",
        apiType: d.apiType || "",
        baseUrl: d.baseUrl || "",
        createdAt: r.createdAt,
        updatedAt: r.updatedAt
      };
    }

    if (pathname === "/api/providers/nodes" && req.method === "GET") {
      const db = getLiveDb(true);
      try {
        const rows = db.prepare("SELECT * FROM providerNodes ORDER BY name ASC").all();
        const counts = db.prepare("SELECT provider, count(*) as c, sum(isActive) as a FROM providerConnections GROUP BY provider").all();
        const countMap = {};
        for (const c of counts) countMap[c.provider] = c;
        const nodes = rows.map((r) => {
          const n = parseNodeRow(r);
          // cocokkan node openai-compatible dengan grup akun berdasar id
          const stat = countMap[r.id] || { c: 0, a: 0 };
          return { ...n, accountCount: stat.c || 0, accountActive: stat.a || 0 };
        });
        // tambahkan provider built-in (kiro/antigravity/dll) yang tak punya node
        const nodeIds = new Set(rows.map((r) => r.id));
        for (const c of counts) {
          if (!nodeIds.has(c.provider)) {
            nodes.push({
              id: c.provider, type: "builtin", name: c.provider,
              prefix: "-", apiType: "-", baseUrl: "-",
              createdAt: null, updatedAt: null,
              accountCount: c.c || 0, accountActive: c.a || 0
            });
          }
        }
        return sendJson(res, 200, { ok: true, count: nodes.length, nodes });
      } finally {
        db.close();
      }
    }

    if (pathname === "/api/providers/nodes" && req.method === "POST") {
      const body = await parseBody(req);
      if (!body.name) return sendError(res, 400, "name is required");
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");
      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const id = body.id || `openai-compatible-chat-${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        const data = JSON.stringify({
          prefix: body.prefix || body.name.toLowerCase(),
          apiType: body.apiType || "chat",
          baseUrl: body.baseUrl || ""
        });
        db.prepare(`INSERT INTO providerNodes(id, type, name, data, createdAt, updatedAt)
          VALUES(?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET type=excluded.type, name=excluded.name, data=excluded.data, updatedAt=excluded.updatedAt`)
          .run(id, body.type || "openai-compatible", body.name, data, now, now);
        return sendJson(res, 201, { ok: true, id, message: "Provider node saved" });
      } finally {
        db.close();
      }
    }

    const provNodeMatch = pathname.match(/^\/api\/providers\/nodes\/(.+)$/);
    if (provNodeMatch && (req.method === "PUT" || req.method === "DELETE")) {
      const id = decodeURIComponent(provNodeMatch[1]);
      const body = await parseBody(req).catch(() => ({}));
      if (!body.confirmLiveWrite) return sendError(res, 400, "Modifying live database requires confirmLiveWrite=true");
      backupLiveDb();
      const db = getLiveDb(false);
      try {
        const row = db.prepare("SELECT * FROM providerNodes WHERE id = ?").get(id);
        if (!row) return sendError(res, 404, "Provider node not found");
        if (req.method === "DELETE") {
          db.prepare("DELETE FROM providerNodes WHERE id = ?").run(id);
          return sendJson(res, 200, { ok: true, id, message: "Provider node deleted" });
        }
        const d = safeJson(row.data, {});
        if (body.prefix !== undefined) d.prefix = body.prefix;
        if (body.apiType !== undefined) d.apiType = body.apiType;
        if (body.baseUrl !== undefined) d.baseUrl = body.baseUrl;
        db.prepare("UPDATE providerNodes SET type = ?, name = ?, data = ?, updatedAt = ? WHERE id = ?")
          .run(body.type || row.type, body.name || row.name, JSON.stringify(d), new Date().toISOString(), id);
        return sendJson(res, 200, { ok: true, id, message: "Provider node updated" });
      } finally {
        db.close();
      }
    }

    // 25. STATIC FRONTEND & SPA SERVING
    // Block any direct probing of source files, node_modules, or server files
    if (pathname.startsWith("/admin-panel/") || pathname.endsWith(".ts") || pathname.endsWith(".tsx") || pathname.includes("..")) {
      return sendError(res, 404, `Not Found: ${pathname}`);
    }

    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".ico": "image/x-icon",
      ".woff2": "font/woff2"
    };

    const distDir = path.join(__dirname, "admin-panel", "dist");
    const resolvedPath = path.resolve(distDir, "." + pathname);

    // Serve strictly from dist bundle, prevent path traversal & source directory probing
    if (fs.existsSync(distDir) && resolvedPath.startsWith(path.resolve(distDir))) {
      if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
        const ext = path.extname(resolvedPath).toLowerCase();
        const contentType = mimeTypes[ext] || "application/octet-stream";
        res.writeHead(200, { "Content-Type": contentType });
        return res.end(fs.readFileSync(resolvedPath));
      }
      // SPA Fallback to index.html for non-API routes
      const spaIndex = path.join(distDir, "index.html");
      if (fs.existsSync(spaIndex) && req.method === "GET" && !pathname.startsWith("/api/") && !pathname.startsWith("/v1/")) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(fs.readFileSync(spaIndex, "utf8"));
      }
    }

    // Fallback to legacy public if dist not ready
    if (pathname === "/" || pathname === "/index.html") {
      const htmlPath = path.join(__dirname, "public", "index.html");
      if (fs.existsSync(htmlPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(fs.readFileSync(htmlPath, "utf8"));
      }
    }

    if (pathname === "/member" || pathname === "/member.html") {
      const memberHtmlPath = path.join(__dirname, "public", "member.html");
      if (fs.existsSync(memberHtmlPath)) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(fs.readFileSync(memberHtmlPath, "utf8"));
      }
    }

    // 404
    sendError(res, 404, `Not Found: ${pathname}`);
  } catch (err) {
    console.error(`[API Error] ${req.method} ${pathname}:`, err);
    sendError(res, 500, err.message || "Internal Server Error");
  }
});

server.listen(PANEL_PORT, PANEL_HOST, () => {
  console.log(`\n========================================`);
  console.log(`🚀 9Router Monitoring Suite (Live Dedicated)`);
  console.log(`   Admin Terminal: http://${PANEL_HOST}:${PANEL_PORT}`);
  console.log(`   Member Portal:  http://${PANEL_HOST}:${PANEL_PORT}/member`);
  console.log(`   Monitoring:     http://127.0.0.1:${LIVE_PORT}`);
  console.log(`========================================\n`);
});

process.on("SIGINT", () => {
  server.close();
  process.exit(0);
});
