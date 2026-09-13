# WFLabs Admin Panel (Shadcn UI)

Modern Admin Console for 9Router AI Gateway built with React, TypeScript, Vite, Tailwind CSS, and Shadcn UI.

## Features
- **Overview & Telemetry**: Live Gateway status, real-time SSE stream feed, interactive routing wire, and token equalizer.
- **Key Management**: Upstream provider keys (Kiro, Antigravity, Fireworks, OpenAI) with priority routing and bulk actions.
- **Providers & Proxies**: Custom OpenAI-compatible upstream clusters and egress proxy tunnels.
- **Models & Custom Mappings**: Allowed model permissions and custom alias routes.
- **Consumers & Billing**: Client API keys, token quota allowance limits, and 1M token rate matrix.
- **System & Backups**: Gateway security toggles and SQLite snapshots.
- **Member Portal**: Self-service portal at `/member`.

## Development & Build
```bash
# In root directory:
npm run build       # Builds the admin SPA into admin-panel/dist
npm run dev:admin   # Runs Vite dev server with proxy to backend
npm start           # Starts the backend server (serves API & dist)
```
