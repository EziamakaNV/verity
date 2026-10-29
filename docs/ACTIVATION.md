# Future live-Meta activation checklist (do NOT execute until access returns and owner authorizes)
1. `npx wrangler secret put MODEL_API_KEY` (server-side only; never in repo/frontend).
2. Set `AI_MODE=live` in wrangler vars; keep `META_MODEL=muse-wonder-1.0` unless docs say otherwise.
3. Verify mode-safe cache: simulated rows (mode='simulated', model='simulated:sim-v2') must never serve as live; health endpoint must report live.
4. Run paired live evaluation (copied-code vs valid return, plus unknown/incomplete/owner), mocked-protocol suite unchanged; record latency, token usage, cost per investigation.
5. Deployed smoke test on the real URL; keep the deterministic findings visible as fallback.
6. Rollback: set AI_MODE back to simulated and redeploy (no data migration needed).
Budget note: app-level reservations/caps in code reduce runaway use but do not replace provider billing limits.
