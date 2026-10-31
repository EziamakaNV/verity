# Verity — 3-minute demo script & recording checklist
Target ~3:00. Use the actual running app at https://verity.eziamakanv.workers.dev with a fresh demo session. Rehearse the paired cases with fresh sessions; do not spend model calls on repeated takes — record the investigation once per case, and say so if waiting time is edited.

- 0:00–0:20 The buyer's problem: "You are about to buy this BrightSmile toothpaste in a Lagos shop. The label looks perfect — but labels can be copied. This code is fictional; the records behind it are what matter." Show the pack and code.
- 0:20–1:15 Wrong-document case: open the "Seller says it was returned" sample. Check records → the result card at the top immediately shows the deterministic finding. Press **Review evidence** and let the real Meta investigation run. Land on the decisive comparison: the seller's document claims a different unit serial and sale than the records; verdict "Check with the retailer before buying"; next step: ask for the return document linked to this exact unit and sale. Open "View seller's document" and "View sale record" from the card.
- 1:15–2:05 Legitimate-return contrast: open "A return that checks out". Same prior-sale shape, different conclusion: a linked authorized return and restock explain the earlier sale, and the document matches that chain. Verdict: "The recorded return explains the earlier sale." Point out that metadata alone never did this — the linked records did.
- 2:05–2:35 Evidence + engineering: scroll the retrieved evidence and developer panel: live mode, actual model, tools used, provider requests, latency. State the most meaningful evaluation result from `eval/live.mjs` output (executed cases only). Briefly show the partner console refusing a wrong-retailer return.
- 2:35–3:00 Users, adoption, limits: "For Nigerian consumers checking before they pay, and for one participating manufacturer with a small retailer network to supply trustworthy records — that adoption path is a hypothesis, not yet tested." Limits: Verity never certifies the physical item; records can be incomplete; partner records in this demo are fictional/simulated. Close with the live URL and repository link.

## Recording checklist
- [ ] Fresh demo session; test (allowlisted) session for live investigation, restriction still on for other visitors.
- [ ] Record the actual UI and a real model execution; never present simulation or a replay as fresh live execution. Disclose any edited waiting time.
- [ ] Screenshots: wrong-document card, legitimate-return card, evidence dialog, developer panel (desktop + mobile widths).
- [ ] Camera/deep link checked on deployed HTTPS; sample pack printable from Demo control.
- [ ] No secrets, keys or personal data on screen; repo link + live URL ready.
- [ ] If video capture is unavailable, use the screenshot set above with this script as narration; do not claim a video exists.

## Screenshot set (fallback if no video)
1. `wrong-document-desktop` — result card with mismatch rows and next step.
2. `legitimate-return-desktop` — result card with corroborated rows.
3. `evidence-dialog` — a cited record opened from the card.
4. `developer-panel` — mode/model/tools/latency after a live run.
5. `wrong-document-mobile` — same card stacked without horizontal scrolling.
