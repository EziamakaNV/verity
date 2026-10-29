# Verity — submission checklist (sources: Participant Guide via cerebralvalley.ai, verified 2026-10-29)
Deadline: **November 4, 2026, 9 p.m. ET (America/New_York)**. Submit at cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit — never submit automatically; solo entry unless teammates added.

- [ ] Public repository (event work only, created during event; provenance in docs/PROGRESS.md)
- [ ] Three-minute demo video (duration rule unverified: strict max vs exact — confirm on final form)
- [ ] Live product access for judges (hosted URL recommended in guide; whether it is a hard rule is unverified — confirm)
- [ ] Actual Meta model usage at runtime: `muse-wonder-1.0` via Meta Model API, server-side (coding assistance alone may not satisfy the gate)
- [ ] $150 Meta API credits: claim individually by deadline; requires payment card — do not claim/enter payment automatically
- [ ] Unverified: repository-timing rule & mixed-provider allowance (only automated-helper Discord answers seen, not human-confirmed). Conservative stance taken: fresh repo, Meta-only runtime models.
- [ ] Confirm final form fields before submitting.

## Product description (submission-ready)
Verity helps Nigerian consumers check an individual product before buying: scan its code, see the recorded journey from maker to shelf, and — when the record is inconsistent, such as a code already sold in Abuja being offered as new in Lagos — get an evidence-based investigation that retrieves linked sale/return records, separates partner records from unverified consumer reports, and recommends the next concrete check. A documented return produces a different, grounded explanation than an unexplained prior sale. Verity never claims an item is genuine or safe; it shows what the records support and what is missing.

## Model-usage description (based on actual implementation)
A bounded investigator uses Meta `muse-wonder-1.0` (server-side Worker call to api.meta.ai). It receives rule findings + intent, retrieves evidence only through three server-authorized read-only tools (unit history, linked sale/return/handoff records, bounded redacted related reports; ≤2 rounds, ≤6 calls), then returns schema-validated JSON whose cited evidence IDs are verified against retrieved records. Rule findings remain visible independently; invalid/unsupported model output falls back to an explicit unavailable state. A deterministic Simulated AI provider (labelled in UI/dev panel) backs keyless dev and automated tests — simulated runs are never reported as live evaluation.
- [x] Simulated build verified Oct 29: 24 unit/protocol tests, 19 D1 integration tests, eval 6/6 structural (simulated, not live accuracy); live Meta evaluation PENDING key access (see docs/ACTIVATION.md). Real-device camera test pending.
