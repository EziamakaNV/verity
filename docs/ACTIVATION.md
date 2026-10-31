# Live-Meta activation — executed 2026-10-31 (bounded)

Status: **live, restricted**. Worker `verity`, D1 `verity-db`, https://verity.eziamakanv.workers.dev

## What was done
1. `MODEL_API_KEY` installed as a Worker secret (name only verified via `wrangler secret list`; value never printed, never in frontend/`VITE_*`/vars/source).
2. Account confirmed via `wrangler whoami` (existing deployment account); no new infrastructure, no billing changes.
3. Docs verified against Meta: `POST https://api.meta.ai/v1/chat/completions`, Bearer key, model `muse-wonder-1.0` listed, OpenAI-style tool calling, `reasoning_effort` counts toward `max_tokens` (provider now sends `reasoning_effort:'low'`, `max_tokens:1500`).
4. `AI_MODE=live` deployed only after simulated suites passed. Health distinguishes configured mode (`configured_mode`), key presence (boolean), allowlist state and configured model; an actual successful investigation reports the response model, tools, provider requests, latency and usage.
5. Temporary server-side restriction: `LIVE_TEST_SESSIONS` (secret) allowlists the evaluation session(s). Other visitors get the explicitly labelled simulated investigation (`live_restricted:true`) — never presented as live, never a silent downgrade of a failed live call. Failed live calls return explicit unavailability with deterministic checks retained, and are not cached.

## Bounded live usage (cap: 20 provider HTTP requests for this run)
- 3 early investigations failed at final-output parsing (empty content before the reasoning fix) — counted conservatively as 9 requests.
- Paired smoke + hostile-text case after the fix: 3 investigations × 3 requests = 9, all with correct assessments (see PROGRESS / eval notes). Conservative total: **18 / 20**. No further live calls were made; remaining eval cases are listed as unrun in `eval/FIXTURES.md`.
- No cost figure is claimed: credit accounting for the key could not be verified from the Worker; usage tokens are reported from provider responses only.

## How the owner can test the live path
Option A (restricted, recommended): open the app (your browser session), then allowlist that session server-side and reload — session IDs are HttpOnly, so the practical route is Option B for a short test window.
Option B (short open window): `npx wrangler secret delete LIVE_TEST_SESSIONS`, test promptly, then restore restriction or roll back. While unrestricted, any visitor can consume investigation budget (app caps still apply).
Option C: keep the existing allowlisted evaluation session (expires 24h after creation on 2026-10-31).

## Rollback to simulation
Set `"AI_MODE": "simulated"` in `wrangler.jsonc` vars and `npx wrangler deploy`. No data migration needed. Cached rows are separated by mode/model/prompt version/snapshot, so simulated answers never serve as live. To also remove the key: `npx wrangler secret delete MODEL_API_KEY`.
