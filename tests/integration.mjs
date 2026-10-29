// D1-backed route regression tests. Run against a local wrangler dev server:
//   BASE=http://127.0.0.1:8787 node tests/integration.mjs
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let pass = 0, fail = 0; const check = (n, ok, extra='') => { ok ? pass++ : fail++; console.log(`${ok?'PASS':'FAIL'} ${n} ${extra}`); };
async function sess() { const jar = { c: '' }; const call = async (p, body) => { const r = await fetch(BASE + p, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Cookie: jar.c }, body: body ? JSON.stringify(body) : undefined }); const sc = r.headers.get('set-cookie'); if (sc) jar.c = sc.split(';')[0]; return { s: r.status, j: await r.json().catch(() => ({})) }; }; await call('/api/demo/start', {}); return call; }
const call = await sess(); const st = (await call('/api/state')).j;
const U = Object.fromEntries(st.units.map(u => [u.scenario, u])); const A = Object.fromEntries(st.actors.map(a => [a.org.split(' ')[0], a]));
const lag = st.actors.find(a => a.org.startsWith('Lagos Mart')), abj = st.actors.find(a => a.org.startsWith('Abuja')), mfr = st.actors.find(a => a.role === 'manufacturer');
const act = (actorId, unitId, type, key, extra={}) => call('/api/partner/action', { actorId, unitId, type, idempotencyKey: key, ...extra });
// 1 identical retry replays, no second event
let r = await act(lag.id, U.normal.id, 'sell', 'K1'); check('sell ok', r.s === 200);
const evBefore = (await call('/api/scan', { token: U.normal.token, intent: 'own' })).j.events.length;
r = await act(lag.id, U.normal.id, 'sell', 'K1'); check('identical retry replays recorded outcome', r.s === 200 && r.j.replayed === true);
const evAfter = (await call('/api/scan', { token: U.normal.token, intent: 'own' })).j.events.length;
check('retry adds no event', evBefore === evAfter, `${evBefore}->${evAfter}`);
// 2 key reuse on different unit: conflict, no mutation (the original bug)
r = await act(lag.id, U.returned.id, 'sell', 'K1'); check('conflicting key reuse rejected', r.s === 409);
const bState = (await call('/api/state')).j.units.find(u => u.scenario === 'returned'); check('other unit unchanged after key conflict', bState.state === 'at_retailer', bState.state);
// 3 concurrent duplicate sales: exactly one wins
const [c1, c2] = await Promise.all([act(lag.id, U.returned.id, 'sell', 'C1'), act(lag.id, U.returned.id, 'sell', 'C2')]);
check('concurrent sales: exactly one succeeds', [c1.s, c2.s].filter(x => x === 200).length === 1, `${c1.s}/${c2.s}`);
// 4 return must link current unresolved sale; bogus link rejected (returned unit just sold above by winner)
r = await act(lag.id, U.returned.id, 'return', 'R-bogus', { linkedEventId: 'does-not-exist' }); check('nonexistent linked sale rejected', r.s === 400, JSON.stringify(r.j));
r = await act(lag.id, U.returned.id, 'return', 'R1'); check('valid return accepted (server links current sale)', r.s === 200);
r = await act(lag.id, U.returned.id, 'restock', 'RS-bogus', { linkedEventId: 'nope' }); check('bogus restock link rejected', r.s === 400);
r = await act(lag.id, U.returned.id, 'restock', 'RS1'); check('valid restock accepted', r.s === 200 && r.j.new_state === 'at_retailer');
// 5 resale after restock is a new unresolved sale until itself returned
r = await act(lag.id, U.returned.id, 'sell', 'S2'); check('resale ok', r.s === 200);
const scan = await call('/api/scan', { token: U.returned.token, intent: 'buying' });
check('later resale unresolved (earlier return does not explain it)', scan.j.findings.some(f => f.code === 'prior_sale_unresolved'));
// 6 transfer acceptance: only intended recipient (incomplete unit: distributor -> Lagos Mart pending)
const dist = st.actors.find(a => a.role === 'distributor');
r = await act(abj.id, U.incomplete.id, 'transfer_receive', 'TR-wrong'); check('Abuja cannot accept Lagos transfer', r.s === 403, JSON.stringify(r.j));
r = await act(lag.id, U.incomplete.id, 'transfer_receive', 'TR-ok'); check('intended recipient Lagos accepts', r.s === 200);
// 7 manufacturer cannot sell
r = await act(mfr.id, U.owner.id, 'sell', 'BAD1'); check('manufacturer sell refused', r.s === 403 || r.s === 409);
// 8 scan never sells
const before = (await call('/api/state')).j.units.find(u => u.scenario === 'owner');
await call('/api/scan', { token: U.owner.token, intent: 'buying' });
const after = (await call('/api/state')).j.units.find(u => u.scenario === 'owner');
check('scan never changes custody/state', before.state === after.state && before.custodian_id === after.custodian_id);
// 9 sample token resolves in a fresh independent session; cross-session unit id fails
const call2 = await sess(); const s2 = await call2('/api/scan', { token: 'sample:copied', intent: 'buying' });
check('fresh session sample:copied resolves', s2.j.unit?.scenario === 'copied' && s2.j.findings.some(f => f.code === 'prior_sale_unresolved'));
const x = await call2('/api/partner/action', { actorId: lag.id, unitId: U.normal.id, type: 'sell', idempotencyKey: 'X1' });
check('cross-session write through foreign ids fails', x.s === 403 || x.s === 404, `${x.s}`);
// 10 malformed code rejected
check('malformed code 400', (await call('/api/scan', { token: 'hello world' })).s === 400);
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
