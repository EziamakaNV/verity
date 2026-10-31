# Verity — 3-minute demo script & recording checklist
Target ~3:00. Use the actual running deployed app with a fresh demo session. Rehearse the paired cases with fresh sessions; do not spend model calls on repeated takes — record the investigation once per case, and say so if waiting time is edited.

- 0:00–0:20 The buyer's problem: "You are about to buy this BrightSmile toothpaste in a Lagos shop. The label looks perfect — but labels can be copied. This code is fictional; the records behind it are what matter." Show the pack and code.
- 0:20–1:15 Wrong-document case: open the "Seller says it was returned" sample. Check records → the result card at the top immediately shows the deterministic finding. Press **Review evidence** and let the real Meta investigation run. Land on the decisive comparison: the seller's document claims a different unit serial and sale than the records; verdict "Check with the retailer before buying"; next step: ask for the return document linked to this exact unit and sale. Open "View seller's document" and "View sale record" from the card.
- 1:15–2:05 Legitimate-return contrast: open "A return that checks out". Same prior-sale shape, different conclusion: a linked authorized return and restock explain the earlier sale, and the document matches that chain. Verdict: "The recorded return explains the earlier sale." Point out that metadata alone never did this — the linked records did.
- 2:05–2:35 Evidence + engineering: scroll the retrieved evidence and developer panel: live mode, actual model, tools used, provider requests, latency. State the most meaningful evaluation result from `eval/live.mjs` output (executed cases only). Briefly show the partner console refusing a wrong-retailer return.
- 2:35–3:00 Users, adoption, limits: "For Nigerian consumers checking before they pay, and for one participating manufacturer with a small retailer network to supply trustworthy records — that adoption path is a hypothesis, not yet tested." Limits: Verity never certifies the physical item; records can be incomplete; partner records in this demo are fictional/simulated. Close with the live URL and repository link.

## 35-second judges' segment (wrong-document sample; adjust to the actual run)

Rehearse with the simulated provider first; record live only with the allowlisted presenter session and confirmed budget (see `docs/ACTIVATION.md`). Never narrate retrieval steps that the trace did not show.

- 0:00–0:08 Show the seller's claim and the preliminary record check: "The seller says this BrightSmile was returned. The records already flag a prior sale with no linked return — that check is Verity's, before any model runs."
- 0:08–0:20 Start capture, then click **Review evidence**. Show the real live mode/model and the observed retrieval steps in the Investigation trace, naming only the tools the trace lists as fulfilled and the document reference actually sent back.
- 0:20–0:30 Open **View seller's document** from the top card. Point to its full claimed serial and claimed sale reference, then to the corresponding product/sale records in the comparison: "These exact comparisons are Verity's record checks. The document claims a different unit and a different sale."
- 0:30–0:35 End on the buyer's next action and Muse's part: "Before buying, ask for the return record for this exact unit and sale. Muse retrieved and reconciled the evidence; Verity's records supplied the verdict." Replace the model-statement wording with what Muse actually said in the recorded run, and label any retake trace as a replay of that run.

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
