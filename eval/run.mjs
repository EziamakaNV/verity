// Verity evaluation runner (deterministic simulation; NOT live-model accuracy).
// Usage: BASE=http://127.0.0.1:8787 node eval/run.mjs
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let cookie = '';
async function call(p, body) { const r = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, j: await r.json().catch(() => ({})) }; }
const health = (await call('/api/health')).j;
await call('/api/demo/start', {});
const state = (await call('/api/state')).j;
const units = Object.fromEntries(state.units.map(u => [u.scenario, u]));
const rows = []; let pass = 0;
function check(scenario, cond, detail) { rows.push({ scenario, ok: !!cond, detail }); if (cond) pass++; }
for (const [sc, intent, exp] of [['normal','buying','no_issue_in_records'],['copied','buying','verify_before_purchase'],['returned','buying','no_issue_in_records'],['owner','own','no_issue_in_records'],['incomplete','buying','insufficient_evidence']]) {
  const t0 = Date.now(); const scan = await call('/api/scan', { token: units[sc].token, intent, location: 'Lagos' });
  const { j } = await call('/api/investigate', { token: units[sc].token, intent });
  const evIds = new Set([...scan.j.events.map(e => e.id), ...(scan.j.reports || []).map(r => r.id)]);
  const cited = [...(j.investigation?.supported_findings || []), ...(j.investigation?.recommended_checks || [])].flatMap(f => f.evidence_ids || []);
  const relOk = sc !== 'returned' || scan.j.events.some(e => e.type === 'return' && scan.j.events.some(s => s.type === 'sell' && s.id === e.linked_event_id));
  check(sc, j.investigation?.assessment === exp && cited.every(id => evIds.has(id)) && relOk && j.mode === 'simulated' && !/100% genuine|certified genuine/i.test(JSON.stringify(j.investigation || {})), `assessment=${j.investigation?.assessment} expected=${exp} citations_valid=${cited.every(id => evIds.has(id))} return_link_valid=${relOk} ms=${Date.now() - t0}`);
}
const unk = await call('/api/investigate', { token: 'VT-UNKNOWN123', intent: 'buying' });
check('unknown', unk.j.investigation?.assessment === 'insufficient_evidence' && !/counterfeit/i.test(unk.j.investigation?.summary || ''), 'unknown stays insufficient_evidence, never counterfeit');
// Paired contrast + graceful failure are covered by unit/integration suites; semantic review remains human.
console.log(JSON.stringify({ run_mode: health.ai_mode === 'live' ? 'LIVE (unexpected in this build)' : 'SIMULATED AI, deterministic, not live-model accuracy', planned_model: health.planned_model, pass, total: rows.length, rows, semantic_review: 'PENDING human review (separate from structural checks)' }, null, 2));
