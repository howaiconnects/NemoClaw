# NemoClaw — 3-Tier Degraded Mode

> **Relevance**: On-call runbook. When NemoClaw has issues, this table tells you exactly what to do.

## Decision Table

| # | Condition | Your tools | Autonomous? |
|---|-----------|-----------|-------------|
| **Tier 1** — Full | `GET /health` → 200, `POST /dispatch` → 202 | Full autonomous dispatch via NemoClaw plugin | Yes |
| **Tier 2** — Routing only | `GET /health` → 200; `/dispatch` returns error or port closed | Human reviews `GET /teams`, runs `dispatch.ps1` manually | No — human step |
| **Tier 3** — Manual | `pnpm build` exits non-zero; server won't start | `dispatch.ps1` + `claude -p` exclusively | No — full manual |

---

## Tier 1 — Full Autonomous

NemoClaw plugin server is running and all three endpoints are healthy.

**Verify**:
```bash
curl -sf http://127.0.0.1:18788/health | jq .
# → { "status": "ok", "version": "0.1.0", "uptime": ... }

curl -sf http://127.0.0.1:18788/teams | jq .teams[].id
# → "inference", "sandbox", "human"

curl -sf -X POST http://127.0.0.1:18788/dispatch \
  -H "Content-Type: application/json" \
  -d '{"team": "inference", "task": "smoke-test"}' | jq .status
# → "queued"
```

No manual intervention needed.

---

## Tier 2 — Routing Only

`/health` responds but `/dispatch` is unavailable or returning errors.

**Steps**:
1. Fetch team table manually:
   ```bash
   curl -sf http://127.0.0.1:18788/teams | jq .
   ```
2. Identify the target team from `teams[].dispatch` field.
3. Run dispatch script directly:
   ```powershell
   # Windows
   .\scripts\dispatch.ps1 -Team inference -Task "your-task-description"
   ```
   ```bash
   # Linux / macOS
   bash scripts/dispatch.sh --team inference --task "your-task-description"
   ```
4. Monitor stdout — the dispatch script logs to `nemoclaw/dispatch.log`.

---

## Tier 3 — Full Manual

`pnpm build` fails or the Node process won't start.

**Steps**:
1. Confirm the failure:
   ```bash
   cd nemoclaw && pnpm build 2>&1 | tail -20
   ```
2. Do NOT attempt to fix TypeScript blindly under time pressure.
3. Use `claude -p` to triage the exact error:
   ```bash
   claude -p "NemoClaw tsc errors: $(pnpm build 2>&1 | tail -20) — identify root cause in one sentence"
   ```
4. Run dispatch manually via `dispatch.ps1` on Windows or `dispatch.sh` on Linux.
5. File an incident note in `docs/incidents/` with:
   - Timestamp
   - tsc error summary
   - Dispatches performed manually
   - Fix PR reference

---

## Recovery Checklist (Tier 2 → Tier 1)

- [ ] `pnpm build` exits 0
- [ ] `node dist/server.js` starts without error (or plugin loads in OpenClaw)
- [ ] `curl -sf http://127.0.0.1:18788/health` → 200
- [ ] Check `scripts/debug.sh` (MAX_RUNTIME=1800s) does not trigger early exit
- [ ] Confirm teams table is current: `curl -sf http://127.0.0.1:18788/teams`

---

## Port Reference

| Port | Component | Notes |
|------|-----------|-------|
| 18788 | NemoClaw plugin HTTP server | Default; override via `serverPort` in `openclaw.plugin.json` |
| 18789 | OpenShell sandbox | Forwarded by blueprint |
