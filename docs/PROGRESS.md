# Verity — progress & provenance log (hackathon-built)
- 2026-10-29: Fresh project scaffolded in this repo (no prior code reused). React+Vite+TS, Hono Worker, D1.
- Implemented: D1 migrations, isolated demo sessions (HttpOnly cookie), seeded actors/products/units, lifecycle state machine with conditional atomic updates + idempotency, deterministic rule engine, bounded Meta investigator (3 read-only tools, ≤2 rounds/≤6 calls, citation validation, versioned cache), simulated AI provider (labelled), consumer/partner/demo screens, camera+upload QR (jsQR) and QR labels (qrcode).
- Tests: 12 unit tests passing; API smoke + agent-browser UI run against local wrangler dev (see README).
- Third-party deps: hono, react, vite, wrangler, zod, qrcode, jsqr, vitest, typescript (all npm, MIT/Apache — see package-lock.json).
- 2026-10-29: Deployed via Wrangler CLI (logged-in account): created D1 `verity-db` (6bd07d0a-7f67-46e3-9420-efd4890c9a2c), remote migrations applied, Worker `verity` live at https://verity.eziamakanv.workers.dev; remote smoke tests passed. Fixed SPA deep-link fallback in Worker.
- Not done: live Meta run (needs MODEL_API_KEY secret + AI_MODE=live), GitHub push/commit (owner's repo, not pushed automatically).
