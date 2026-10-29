// Verity evaluation runner. Usage: BASE=http://127.0.0.1:8787 node eval/run.mjs
// Mode is reported honestly: simulated unless server health says ai_mode=live.
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let cookie = '';
async function call(p, body) {
  const r = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
  return { status: r.status, j: await r.json().catch(() => ({})) };
}
const health = (await call('/api/health')).j;
await call('/api/demo/start', {});
const state = (await call('/api/state')).j;
const units = Object.fromEntries(state.units.map(u => [u.scenario, u]));
const cases = [
  ['normal', 'buying', 'no_issue_in_records'], ['copied', 'buying', 'verify_before_purchase'],
  ['returned', 'buying', 'no_issue_in_records'], ['owner', 'own', 'no_issue_in_records'],
  ['incomplete', 'buying', 'insufficient_evidence'],
];
let pass = 0, total = 0; const rows = [];
for (const [sc, intent, exp] of cases) {
  total++; const t0 = Date.now();
  await call('/api/scan', { token: units[sc].token, intent, location: 'Lagos' });
  const { j } = await call('/api/investigate', { token: units[sc].token, intent });
  const ok = j.investigation?.assessment === exp && !/100% genuine|safe to use/i.test(JSON.stringify(j.investigation || {}));
  if (ok) pass++; rows.push({ scenario: sc, expected: exp, got: j.investigation?.assessment, ok, ms: Date.now() - t0 });
}
total++; const unk = await call('/api/investigate', { token: 'VT-UNKNOWN123', intent: 'buying' });
const unkOk = unk.j.investigation?.assessment === 'insufficient_evidence'; if (unkOk) pass++;
rows.push({ scenario: 'unknown', expected: 'insufficient_evidence', got: unk.j.investigation?.assessment, ok: unkOk });
console.log(JSON.stringify({ run_mode: health.ai_mode === 'live' ? 'LIVE Meta' : 'SIMULATED AI (not a live model evaluation)', model: health.model, pass, total, rows }, null, 2));
