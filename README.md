# Verity — Know the story behind your product.

Verity is a product-verification demo for Nigerian consumers, built for the Meta Global AI Developer Hackathon (Indie track, *Build for Your World*). Scan an individual product's code, see its recorded journey, and get evidence-based guidance when the history is inconsistent. Verity investigates counterfeit *risk from records* — it does not certify the physical contents of a product. A recognized code means a registry record exists; codes can be copied.

> Persistent badge in-app: **Demo: simulated partner records.** All brands, retailers, people and prices are fictional. No affiliation with NAFDAC or any real brand/retailer.

## Live demo
**https://verity.eziamakanv.workers.dev** — deployed 2026-10-29 (Worker `verity`, D1 `verity-db`), smoke-tested end-to-end (demo start, scan, investigation, partner sale, session isolation, SPA deep links). AI mode is **Simulated AI, development mode** by design in this build. `muse-wonder-1.0` is the planned live model, listed separately and not used yet. See docs/ACTIVATION.md for the future switch; live mode without a key returns explicit unavailability and never silently downgrades.

## Run it locally
```bash
npm install
npm run build
npx wrangler d1 migrations apply DB --local
npx wrangler dev --port 8787        # serves UI + /api on one origin
```
Open http://127.0.0.1:8787 in a browser. A fresh isolated demo session auto-starts; use **Demo control** to pick a scenario, **Check a product** to scan/paste its code, **Partner console** to sell/return/restock as a named (simulated) role.

Dev split mode (optional): `npm run dev` (Vite, proxies /api to :8787) alongside `wrangler dev`.

## Tests & evaluation
```bash
npm test                                   # 12 unit tests: rules, state machine, citation validation
BASE=http://127.0.0.1:8787 npm run eval    # 6-scenario runner; reports SIMULATED unless server is live
```

## Live Meta model
Default is a deterministic, explicitly labelled **Simulated AI** provider (keyless dev/tests). For the real `muse-wonder-1.0` via `https://api.meta.ai/v1`:
```bash
cp .dev.vars.example .dev.vars   # set MODEL_API_KEY, AI_MODE=live  (server-side secret, never in frontend)
```
The Worker calls Meta server-to-server with three read-only tools (`get_unit_history`, `get_linked_records`, `get_related_reports`), at most 2 retrieval rounds / 6 calls, validates the structured response and every cited evidence ID, and falls back to "AI investigation unavailable; recorded checks still shown" on any failure. Muse Wonder itself does not run on Cloudflare; Cloudflare hosts the app, API, and D1 data.

## Deploy (Cloudflare — confirm account/resources first)
```bash
npx wrangler whoami                              # confirm the deployment account
npx wrangler d1 create verity-db                 # then put its database_id in wrangler.jsonc
npm run build
npx wrangler d1 migrations apply DB --remote
npx wrangler secret put MODEL_API_KEY            # and set AI_MODE=live + PUBLIC_ORIGIN vars
npx wrangler deploy
```
Resource names above are proposals — confirm against the deployment account before creating. After deploy, smoke-test SPA deep links, `/api/health`, one sale/return, one live investigation, and session isolation on the real HTTPS URL. Migrations/seeding are explicit repeatable operations, never a reset on deploy.

## Architecture
One Cloudflare Worker (Hono) serves the built React SPA (Workers Static Assets, SPA fallback; `/api/*` always returns JSON) and the API. D1 is authoritative: `demo_sessions, actors, products, batches, units, events (append-only), reports, investigations, rate_limits` — every record scoped to an isolated demo session. Lifecycle: `registered → in distribution → in transit → at retailer → sold → returned → at retailer`, enforced server-side with custodian/role checks, conditional atomic state updates, idempotency keys, and evidence-version bumps that invalidate cached investigations. Consumer scans/reports never move custody. See [docs/SUBMISSION.md](docs/SUBMISSION.md), [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md), [docs/PROGRESS.md](docs/PROGRESS.md).

## Known limitations
Simulated partner access is not real manufacturer authentication; records show who *asserted* an event, not that it is true in the real world. Missing acknowledgment = incomplete history, not an accusation. No payments, blockchain, or reporting to authorities. Live-provider numbers must be measured, not promised.

## Sample links, snapshots and trust model
`/?sample=copied` (also returned/normal/owner/incomplete) opens that fictional scenario inside the visitor's OWN isolated session, so a phone and a laptop see the same story without sharing write access. A QR printed for a specific unit in the Partner console only resolves inside the session that created it, and says so. Lifecycle truth comes only from validated, linked partner events (dispatch/receipt pairs, sale/return/restock chains); consumer reports and seller claims are unverified evidence shown beside them. Cross-session reads/writes through foreign IDs fail.

## Adoption hypothesis (untested)
A plausible first deployment is one participating manufacturer onboarding a small network of its retailers, so journey records exist for the products consumers most often check. No interviews, usage metrics or partnerships are claimed yet.
