// Upstream AI provider connection
//
// The panel acts as a router in front of a single upstream OpenAI-compatible
// endpoint (local 9Router on :20128, or a remote host such as
// https://api.wflabs.web.id). Clients authenticate to the PANEL with their own
// key; the panel validates quota/model access, then forwards to the upstream
// using the one upstream key. The upstream key never reaches clients.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULTS = {
  baseUrl: "http://127.0.0.1:20128",
  apiKey: "",
  label: "9Router Local",
};

const state = {
  baseUrl: "",
  apiKey: "",
  label: "",
  lastTestAt: 0,
  lastTestOk: false,
  lastTestMs: 0,
  lastError: "",
  modelCount: 0,
};

/* ------------------------------- encryption ------------------------------ */

function defaultSecret() {
  return crypto
    .createHash("sha256")
    .update("wflabs-panel::" + (process.env.COMPUTERNAME || "local"))
    .digest();
}

function getSecret() {
  if (process.env.WFLABS_SECRET) {
    return crypto.createHash("sha256").update(process.env.WFLABS_SECRET).digest();
  }
  return defaultSecret();
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecret(), iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: data.toString("base64"),
  };
}

function decrypt(blob) {
  if (!blob || !blob.iv || !blob.tag || !blob.data) return "";
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", getSecret(), Buffer.from(blob.iv, "base64"));
    decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(blob.data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

/* ------------------------------ persistence ------------------------------ */

const CONN_FILE = path.join(__dirname, "..", "data", "upstream.json");

function load() {
  try {
    if (!fs.existsSync(CONN_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(CONN_FILE, "utf8"));
    state.baseUrl = raw.baseUrl || "";
    state.label = raw.label || "";
    state.apiKey = raw.apiKeyEnc ? decrypt(raw.apiKeyEnc) : "";
  } catch {
    // start clean on corrupt file
  }
}

function save() {
  try {
    fs.mkdirSync(path.dirname(CONN_FILE), { recursive: true });
    fs.writeFileSync(
      CONN_FILE,
      JSON.stringify(
        {
          baseUrl: state.baseUrl,
          label: state.label,
          apiKeyEnc: state.apiKey ? encrypt(state.apiKey) : null,
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
  } catch {
    // non-fatal
  }
}

/* --------------------------------- access -------------------------------- */

function base() {
  return (state.baseUrl || DEFAULTS.baseUrl).replace(/\/+$/, "");
}

function key() {
  return state.apiKey;
}

function configured() {
  return !!state.apiKey;
}

/** Headers the panel uses when talking to the upstream provider. */
function authHeaders(extra = {}) {
  const h = { "Content-Type": "application/json", ...extra };
  if (state.apiKey) h["Authorization"] = `Bearer ${state.apiKey}`;
  return h;
}

/* ------------------------------- operations ------------------------------ */

/**
 * Forward a chat completion request to the upstream provider.
 * `raw` may be a JSON string or an object. Returns the upstream Response.
 */
async function chatCompletion(payload, { stream = false, signal } = {}) {
  if (!configured()) {
    throw new Error("Upstream API key is not configured");
  }
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  return fetch(`${base()}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders({ Accept: stream ? "text/event-stream" : "application/json" }),
    body,
    signal: signal || AbortSignal.timeout(300_000),
  });
}

/** List models available on the upstream provider. */
async function listModels() {
  const res = await fetch(`${base()}/v1/models`, {
    headers: authHeaders(),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Upstream returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.data) ? data.data : [];
}

/** Verify the upstream is reachable and the key is accepted. */
async function test() {
  const started = Date.now();
  state.lastTestAt = Date.now();
  try {
    const models = await listModels();
    state.lastTestOk = true;
    state.lastTestMs = Date.now() - started;
    state.modelCount = models.length;
    state.lastError = "";
    return { ok: true, latency: state.lastTestMs, modelCount: models.length };
  } catch (err) {
    state.lastTestOk = false;
    state.lastTestMs = Date.now() - started;
    state.modelCount = 0;
    state.lastError = err.message;
    return { ok: false, error: err.message, latency: state.lastTestMs };
  }
}

function configure({ baseUrl, apiKey, label }) {
  if (baseUrl !== undefined && baseUrl !== "") state.baseUrl = String(baseUrl).trim().replace(/\/+$/, "");
  if (label !== undefined) state.label = String(label);
  if (apiKey !== undefined && apiKey !== "") state.apiKey = String(apiKey).trim();
  save();
}

function clear() {
  state.apiKey = "";
  state.lastTestOk = false;
  state.lastError = "";
  state.modelCount = 0;
  save();
}

/** Safe status for the UI. Never exposes the full upstream key. */
function getStatus() {
  return {
    baseUrl: base(),
    label: state.label || DEFAULTS.label,
    configured: configured(),
    keyPreview: state.apiKey
      ? state.apiKey.slice(0, 10) + "..." + (state.apiKey.length > 20 ? state.apiKey.slice(-6) : "")
      : null,
    lastTestAt: state.lastTestAt,
    lastTestOk: state.lastTestOk,
    lastTestMs: state.lastTestMs,
    lastError: state.lastError,
    modelCount: state.modelCount,
  };
}

load();

module.exports = {
  configure,
  clear,
  getStatus,
  base,
  key,
  authHeaders,
  configured,
  chatCompletion,
  listModels,
  test,
};
