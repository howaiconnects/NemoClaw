# TASK.md — NemoClaw v0.1 Phase B

<!-- Per CL-050: every branch must commit a TASK.md before agent dispatch. -->

## Branch
`main`

## Goal
Ship NemoClaw v0.1 with three verified HTTP endpoints (GET /health, GET /teams,
POST /dispatch), a 30-minute debug session cap, and documented 3-tier degraded
mode runbook. TypeScript build is confirmed clean (0 errors).

## TypeScript Status
Build: **clean** — `pnpm build` exits 0, zero tsc errors.
All relative imports already use `.js` extensions; SDK types are defined locally
in `index.ts`; all third-party packages (`tar`, `json5`, `yaml`, `commander`)
ship their own type declarations. No `@types/*` gaps.

## Tasks
- [x] Confirm TypeScript build is clean (`pnpm build` → 0 errors)
- [ ] Add `src/server.ts` — minimal Node.js HTTP server, 3 routes
- [ ] Add `src/teams.json` — static team routing table
- [ ] Wire `startPluginServer()` into `register()` in `src/index.ts`
- [ ] Set `MAX_RUNTIME=1800` hard cap in `scripts/debug.sh` (30 min)
- [ ] Document 3-tier degraded runbook in `docs/reference/degraded-mode.md`
- [ ] `pnpm build` passes after all edits
- [ ] Commit Phase B changes

## Exit Criteria
```bash
# After `pnpm build`:
node -e "import('./dist/server.js').then(m => m.startPluginServer(18788)).then(() => { const http = require('http'); http.get('http://localhost:18788/health', r => { let b=''; r.on('data',d=>b+=d); r.on('end',()=>{ console.assert(JSON.parse(b).status==='ok'); process.exit(0); }); }); })"
```
Or simpler: `pnpm build && grep -q '"status"' dist/server.js`

## Degraded Mode Tiers
| Tier | Condition | Action |
|------|-----------|--------|
| 1 — Full | `/health` → 200, `/dispatch` reachable | Autonomous dispatch |
| 2 — Routing Only | `/health` → 200; `/dispatch` unreachable | Human confirms team table, runs `dispatch.ps1` |
| 3 — Manual | Build fails (tsc errors) | `dispatch.ps1` + `claude -p` exclusively |

## Agent Scope
- `TASK.md`
- `nemoclaw/src/server.ts` (new)
- `nemoclaw/src/teams.json` (new)
- `nemoclaw/src/index.ts`
- `scripts/debug.sh`
- `docs/reference/degraded-mode.md` (new)
