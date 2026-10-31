# Live-Meta activation — executed 2026-10-31 (bounded)

Status: **live, restricted**. Worker `verity`, D1 `verity-db` (deployed URL withheld from docs)

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

## Recording readiness (judges' video, one wrong-document investigation)

Status: **recording-ready rehearsal achieved; fresh live run pending allowance.** No trustworthy prior sanitized live trace exists to replay: earlier live work is summarised above (assessments and request counts only, without the model's validated statement or the transmitted evidence IDs), so it must not be presented as a trace. The UI now renders a sanitized trace from the provider/tool boundary (actual response model, fresh/cached state, ordered fulfilled tool steps with transmitted evidence IDs/document references, duration, provider-request count, token counts when returned, one evidence-backed model statement distinguished from the final Verity verdict). Rehearsed end-to-end with the keyless simulated provider and an injected mocked provider transport; routine tests remain keyless.

Budget: conservative total remains **18 / 20** provider HTTP requests, leaving **2**. One observed live investigation needs **3** provider requests. Shortfall is **1 request minimum**; every attempt, including failures, counts and automatic retries stay off. Do not re-run `eval/live.mjs` for this (its counter restarts and it would spend on many cases). **Requested additional allowance: +3 provider HTTP requests** (one full investigation plus minimal failure headroom) before any fresh paid call.

Presenter session (specific, allowlisted, never in a URL or doc): sessions live 24 hours, so create it inside the recording window.

1. In the recording browser, open the deployed app and start a fresh demo so that browser holds its own session cookie.
2. In that browser's developer tools, open Network, find the `POST /api/demo/start` response, and copy its `session_id` value privately. Never put it in a demo/sample URL, chat, screenshot or repo file.
3. With Wrangler on the deployment account, update the existing restriction in place: `npx wrangler secret put LIVE_TEST_SESSIONS` and enter the comma-separated allowlist containing the existing evaluation entry plus this presenter session ID (keep the restriction; do not delete the secret). The secret value is entered interactively and never printed.
4. Reload the presenter browser, open the wrong-document sample, and confirm health/investigation reports live mode for that session before recording. Other visitors remain on the labelled restricted simulation.
5. Start capture before clicking **Review evidence**, record exactly one fresh investigation, and keep the on-screen sanitized trace from that same run for retakes as a clearly labelled replay.

If the live request fails, keep the explicit "AI investigation unavailable" state on screen and report the failure; do not substitute a simulation.

## Rollback to simulation
Set `"AI_MODE": "simulated"` in `wrangler.jsonc` vars and `npx wrangler deploy`. No data migration needed. Cached rows are separated by mode/model/prompt version/snapshot, so simulated answers never serve as live. To also remove the key: `npx wrangler secret delete MODEL_API_KEY`.
