// Desired-behavior regressions converted from the second review's observed-fault reproductions.
import { it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from '../src/worker/index';
import { runProvider } from '../src/shared/provider';
const answer = (ids: string[]) => JSON.stringify({ assessment: 'verify_before_purchase', summary: 'Check this record.', supported_findings: [{ claim: 'Recorded sale', evidence_ids: ids }], possible_explanations: [], recommended_checks: [], limitations: [] });
it('provider deadline covers a stalled response body', async () => {
  const work = runProvider({ apiKey: 'mock', model: 'mock', system: 's', user: 'u', timeoutMs: 30, transport: async () => ({ ok: true, status: 200, text: () => new Promise<string>(() => {}) }), execTool: async () => ({ records: [], payload: {} }) });
  await expect(work).rejects.toThrow(/timeout/);
});
it('citation to a record cut from the transmitted payload is rejected', async () => {
  let calls = 0;
  const work = runProvider({ apiKey: 'mock', model: 'mock', system: 's', user: 'u', transport: async () => { calls++; const msg = calls === 1 ? { tool_calls: [{ id: 't', function: { name: 'get_unit_history', arguments: '{}' } }] } : { content: answer(['hidden']) }; return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: msg }] }) }; }, execTool: async () => ({ records: [{ id: 'keep' }, { id: 'hidden' }], payload: { records: [{ id: 'keep', note: 'x'.repeat(7100) }, { id: 'hidden' }] } }) });
  await expect(work).rejects.toThrow(/fabricated/);
});
it('competing sales sharing one pre-read version produce exactly one event (SQLite scheduling harness)', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync('migrations/0001_init.sql', 'utf8')); sqlite.exec(readFileSync('migrations/0002_integrity.sql', 'utf8')); sqlite.exec(readFileSync('migrations/0003_documents.sql', 'utf8'));
  let release!: () => void; const barrier = new Promise<void>(r => release = r); let waiting = 0, synchronize = false;
  const db: any = { prepare: (sql: string) => { let values: any[] = []; const q: any = { bind: (...v: any[]) => { values = v; return q; }, first: async () => sqlite.prepare(sql).get(...values), all: async () => ({ results: sqlite.prepare(sql).all(...values) }), run: async () => { const r = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(r.changes) } }; } }; return q; } };
  let tail = Promise.resolve();
  db.batch = async (qs: any[]) => { if (synchronize) { waiting++; if (waiting === 2) release(); await barrier; } const job = tail.then(async () => { sqlite.exec('BEGIN'); try { const out = []; for (const q of qs) out.push(await q.run()); sqlite.exec('COMMIT'); return out; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } }); tail = job.then(() => {}, () => {}); return job; };
  // Synchronize only advisory pre-reads through batch entry is not possible; instead hold both requests at demo/start boundary is unnecessary:
  // app.request calls run sequentially in JS, so instead directly race two actions after seeding.
  const env: any = { DB: db, AI_MODE: 'simulated' }; let cookie = '';
  const call = async (p: string, b?: any) => { const r = await app.request(p, { method: b ? 'POST' : 'GET', headers: { cookie, 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined }, env); const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0]; return { status: r.status, body: await r.json() as any }; };
  await call('/api/demo/start', {}); const st = (await call('/api/state')).body; const unit = st.units.find((u: any) => u.scenario === 'normal');
  synchronize = true;
  const sell = (k: string) => call('/api/partner/action', { actorId: unit.custodian_id, unitId: unit.id, type: 'sell', idempotencyKey: k });
  const out = await Promise.all([sell('one'), sell('two')]);
  const events = sqlite.prepare("SELECT * FROM events WHERE unit_id=? AND type='sell'").all(unit.id);
  const finalUnit: any = sqlite.prepare('SELECT state, evidence_version FROM units WHERE id=?').get(unit.id);
  expect(out.map(r => r.status).sort()).toEqual([200, 409]);
  expect(events.length).toBe(1);
  expect(finalUnit.state).toBe('sold');
  sqlite.close();
});
