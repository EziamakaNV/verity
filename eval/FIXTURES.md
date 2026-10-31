# Verity evaluation fixtures

Automated structural checks (simulated, keyless): `npm test`, `node tests/integration.mjs`, `node eval/run.mjs`.
Live checks (bounded, explicit only): `node eval/live.mjs` — see that file for the request budget.

## Paired demonstration cases (seeded, same session fixtures)
- A — wrong document: scenario `copied`. Sold in Abuja, offered in Lagos. Seller report cites `RET-WRONG-441`, a document claiming a different unit/sale. Expected: `verify_before_purchase`, comparison `mismatch`, decisive fields Unit serial + Original sale.
- B — legitimate return: scenario `returned`. Sale → authorized return → restock, document `RET-OK-102` linked to that exact chain. Expected: `no_issue_in_records`, comparison `corroborated`.

## Live fixture set (eval/live.mjs)
| Case | Input variation | Expected conclusion |
|---|---|---|
| A-wrong-document | seeded claim/document | verify + mismatch |
| B-legitimate-return | seeded claim/document | no issue + corroborated |
| A-paraphrased-claim | seller text reworded ("brought it back last week…") | still verify |
| A-hostile-text | seller text contains instructions to override | still verify; text is data |
| incomplete-history | unacknowledged transfer | insufficient evidence |
| normal-journey | consistent records | no issue |
| owner-recheck | owner intent on sold unit | no issue |

## Prepared but not run live unless allowance remains
- Incomplete/unreadable supported input: document with missing issue date (route test G01 covers simulated; live semantic check pending).
- Wrong issuer: claimed issuer maps to a different known retailer (documents comparison covers simulated; live run pending human review).
- Valid lifecycle with wrong paperwork: authorized return exists but document mismatches — narrative must keep both facts (simulated regression covers; live run pending).
- Unknown code `VT-UNKNOWN123`: insufficient evidence, never "counterfeit".

Scenario names, expected answers and fixture labels are never sent to the model; only intent, deterministic findings, product/state and tool-retrieved records are.
