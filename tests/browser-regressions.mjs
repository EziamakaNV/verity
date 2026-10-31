// Browser regressions for verdict invalidation + document dialog.
// Drives the real consumer UI through agent-browser against a keyless
// simulated wrangler dev server. Deterministic fetch interception holds and
// releases real scan/investigate responses across edits; request bodies are
// captured at the same boundary. No paid/model calls (simulated mode only).
// Usage: BASE=http://127.0.0.1:8787 node tests/browser-regressions.mjs
import { spawnSync } from 'node:child_process';
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
function ab(args, input) {
  const r = spawnSync('agent-browser', ['--session', 'verity-regression', ...args], { input, encoding: 'utf8', timeout: 60000 });
  if (r.error) throw r.error;
  return (r.stdout || '') + (r.stderr || '');
}
function ev(code) {
  const out = ab(['eval', '--stdin'], code).trim();
  try { const once = JSON.parse(out); if (typeof once !== 'string') return once; try { return JSON.parse(once); } catch { return once; } } catch { return out; }
}
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function openSample(sample) { ab(['open', `${BASE}/?sample=${sample}`]); ab(['wait', '--load', 'networkidle']); sleep(400); }
function clickText(text) { return ev(`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===${JSON.stringify(text)}); if(b){b.click(); return true;} return false;})()`); }
function waitFor(code, label, tries = 40) { for (let i = 0; i < tries; i++) { const v = ev(code); if (v) return v; sleep(300); } console.log('TIMEOUT waiting: ' + label); return null; }
const headline = () => ev(`(()=> (document.querySelector('.decision .verdict')?.textContent || ''))()`);
const staleShown = () => ev(`(()=> document.body.textContent.includes('Details changed. Check records again.'))()`);
const dialogText = () => { sleep(500); return ev(`(()=> (document.querySelector('[role="dialog"]')?.textContent || ''))()`); };
function setField(sel, value, kind) {
  return ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)}); if(!el) return 'missing'; const proto=${kind === 'area' ? 'HTMLTextAreaElement' : 'HTMLInputElement'}; Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el,${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true})); el.focus(); return el.value;})()`);
}
function installInterceptor() {
  ev(`(()=>{ window.__reqs=[]; window.__hold=false; window.__release=null; const orig=window.fetch.bind(window); window.fetch=async(...a)=>{ const url=String(a[0]); if(url.includes('/api/scan')||url.includes('/api/investigate')){ let body=null; try{body=a[1]?.body?JSON.parse(a[1].body):null;}catch{} window.__reqs.push({url,body}); if(window.__hold) await new Promise(r=>{window.__release=r;}); } return orig(...a); }; window.__setHold=(v)=>{window.__hold=v; if(!v&&window.__release){const r=window.__release; window.__release=null; r();}}; return 'installed'; })()`);
}
const reqs = () => ev(`(()=> window.__reqs || [])()`);
const scans = () => reqs().filter(r => r.url.includes('/api/scan'));
const invs = () => reqs().filter(r => r.url.includes('/api/investigate'));
try {
  const health = await (await fetch(BASE + '/api/health')).json();
  check('server is keyless simulated (no paid calls)', health.ai_mode === 'simulated', health.ai_mode);
  ab(['close', '--all']);
  // --- Returned sample: claim-only and location-only invalidation ---
  openSample('returned');
  waitFor(`(()=> document.querySelector('.decision .verdict')?.textContent.includes('explains the earlier sale'))()`, 'returned headline');
  check('returned: record-check headline shown', headline().includes('explains'), headline());
  clickText('Review evidence');
  waitFor(`(()=> document.querySelector('.decision .verdict')?.textContent.includes('Investigation'))()`, 'investigation headline');
  check('returned: investigation headline after Review', headline().includes('The recorded return explains the earlier sale'), headline());
  installInterceptor();
  ev(`(()=>{document.querySelector('details.panel summary')?.click(); return true;})()`); sleep(300);
  setField('#rep', 'Edited claim only for regression', 'area');
  check('claim-only edit: stale notice replaces verdict', staleShown() === true);
  check('claim-only edit: old verdict hidden', !headline().includes('explains the earlier sale'), headline());
  check('claim-only edit: draft preserved + focus kept', ev(`(()=> document.querySelector('#rep')?.value)()`) === 'Edited claim only for regression' && ev(`(()=> document.activeElement?.id)()`) === 'rep', `rep=${ev(`(()=> document.querySelector('#rep')?.value)()`)} active=${ev(`(()=> document.activeElement?.id)()`)}`);
  check('typing triggers zero scans/investigations', scans().length === 0 && invs().length === 0, `scans=${scans().length} invs=${invs().length}`);
  check('stale evidence links hidden (no decision card)', ev(`(()=> !!document.querySelector('.decision'))()`) === false);
  clickText('Check records');
  waitFor(`(()=> document.querySelector('.decision .verdict')?.textContent.includes('explains the earlier sale'))()`, 'rescan headline');
  check('explicit rescan restores card', headline().includes('explains the earlier sale'), headline());
  check('new scan carries edited claim', scans().at(-1)?.body?.text === 'Edited claim only for regression', JSON.stringify(scans().at(-1)?.body));
  check('model has not run again after rescan (only after Review)', invs().length === 0, `invs=${invs().length}`);
  // Location-only edit after completed result.
  ev(`(()=>{document.querySelector('details.panel summary')?.click(); return true;})()`); sleep(300);
  setField('#loc', 'Abuja', 'input');
  check('location-only edit: stale notice replaces verdict', staleShown() === true && !headline().includes('explains'));
  check('location-only edit: drafts preserved', ev(`(()=> document.querySelector('#loc')?.value)()`) === 'Abuja' && ev(`(()=> document.querySelector('#rep')?.value)()`) === 'Edited claim only for regression', `loc=${ev(`(()=> document.querySelector('#loc')?.value)()`)} rep=${ev(`(()=> document.querySelector('#rep')?.value)()`)}`);
  check('location typing triggers zero scans', scans().length === 1, `scans=${scans().length}`);
  clickText('Check records');
  waitFor(`(()=> document.querySelector('.decision .verdict')?.textContent.includes('explains the earlier sale'))()`, 'location rescan');
  check('new scan carries edited location', scans().at(-1)?.body?.location === 'Abuja', JSON.stringify(scans().at(-1)?.body));
  // --- Held response across edit-away-and-back must not restore old card ---
  ev(`(()=>{ window.__setHold(true); return true; })()`);
  clickText('Check records');
  sleep(500);
  setField('#rep', 'Held-scan edited claim', 'area');
  setField('#rep', 'Edited claim only for regression', 'area');
  ev(`(()=>{ window.__setHold(false); return true; })()`); sleep(900);
  check('held response released after edit-away-and-back does not restore card', staleShown() === true && ev(`(()=> !!document.querySelector('.decision'))()`) === false);
  check('stale evidence/dialog stays hidden after held release', ev(`(()=> !!document.querySelector('[role="dialog"]'))()`) === false);
  clickText('Check records');
  waitFor(`(()=> document.querySelector('.decision .verdict')?.textContent.includes('explains the earlier sale'))()`, 'post-hold rescan');
  check('next explicit scan completes after hold', headline().includes('explains the earlier sale'), headline());
  check('buyer can submit again (Review available, model runs only then)', ev(`(()=> [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Review evidence'))()`) === true && invs().length === 0, `invs=${invs().length}`);
  clickText('Review evidence');
  waitFor(`(()=> document.querySelector('.decision .verdict')?.textContent.includes('Investigation'))()`, 'post-hold investigation');
  check('model runs after Review evidence click', invs().length === 1, `invs=${invs().length}`);
  check('trace renders ordered fulfilled steps (rehearsal, simulated)', ev(`(()=> [...document.querySelectorAll('details.trace')].some(d=>d.textContent.includes('get_return_document') && d.textContent.includes('fulfilled')))()`) === true);
} catch (e) { fail++; console.log('FAIL returned flow exception ' + String(e).slice(0, 300)); }
try {
  // --- Wrong-document dialog: exact fixture values from the top card ---
  openSample('copied');
  waitFor(`(()=> document.querySelector('.decision .verdict')?.textContent.includes('Check with the retailer'))()`, 'copied headline');
  clickText('Review evidence');
  waitFor(`(()=> !!document.querySelector('.decision .cmp'))()`, 'copied comparison');
  const serial = ev(`(()=> (document.querySelector('.decision')?.textContent.match(/Serial\\s+(VT-[A-Z0-9]{10})/)||[])[1] || '')()`);
  ev(`(()=>{ window.__fx=null; (async()=>{ const r=await fetch('/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({token:'__SERIAL__',intent:'buying',location:'Lagos',text:''})}); const j=await r.json(); const d=(j.documents||[])[0]||{}; const sale=[...(j.events||[])].filter(e=>e.type==='sell').pop()||{}; window.__fx={serial:d.claimed_unit_serial||null,saleRef:d.claimed_sale_ref||null,ref:d.reference||null,id:d.id||null,unitToken:j.unit?.token||null,saleId:sale.id||null}; })(); return 'started'; })()`.replace('__SERIAL__', serial));
  let fx = null;
  for (let i = 0; i < 30 && !fx; i++) { sleep(300); fx = ev(`(()=> window.__fx || null)()`); if (fx && !fx.serial) fx = null; }
  check('wrong-doc fixture loaded (full claimed serial/sale ref)', !!(fx && fx.serial && fx.saleRef && fx.ref && fx.id), JSON.stringify(fx));
  check('fixture is genuinely mismatched (serial and sale differ)', fx.serial !== fx.unitToken && fx.saleRef !== fx.saleId, JSON.stringify(fx));
  check('internal evidence ID distinct from claimed sale ref', fx.id !== fx.saleRef);
  clickText('View seller’s document');
  const dlg = dialogText();
  check('wrong-doc dialog shows document reference', dlg.includes(fx.ref), dlg.slice(0, 200));
  check('wrong-doc dialog shows full claimed serial', dlg.includes(fx.serial), fx.serial);
  check('wrong-doc dialog shows full claimed sale reference', dlg.includes(fx.saleRef), fx.saleRef);
  check('wrong-doc dialog shows full internal evidence ID', dlg.includes(fx.id), fx.id);
  check('wrong-doc dialog preserves issuer/source/status', /Abuja Family Store/.test(dlg) && /unverified/i.test(dlg), dlg.slice(0, 300));
  ab(['press', 'Escape']); sleep(400);
  check('Escape dismisses dialog and focus returns to opener', ev(`(()=> !!document.querySelector('[role="dialog"]'))()`) === false && ev(`(()=> document.activeElement?.textContent?.trim() || '')()`) === 'View seller’s document');
  // Comparison-field entry point identifies the field.
  ev(`(()=>{ const cards=[...document.querySelectorAll('.finding')]; const card=cards.find(c=>c.querySelector('.ftitle')?.textContent.includes('Unit serial')); const b=card?.querySelector('button'); b?.click(); return !!b; })()`); 
  const dlg2 = dialogText();
  check('comparison-field dialog identifies the field', dlg2.includes('Opened from comparison field:') && dlg2.includes('Unit serial'), dlg2.slice(0, 250));
  check('comparison-field dialog still shows full claimed serial', dlg2.includes(fx.serial), fx.serial);
  ab(['press', 'Escape']); sleep(300);
} catch (e) { fail++; console.log('FAIL copied dialog exception ' + String(e).slice(0, 300)); }
try {
  // --- Legitimate-return dialog: matching values ---
  openSample('returned');
  waitFor(`(()=> document.querySelector('.decision .verdict')?.textContent.includes('explains the earlier sale'))()`, 'returned headline 2');
  clickText('Review evidence');
  waitFor(`(()=> !!document.querySelector('.decision .cmp'))()`, 'returned comparison');
  const serial2 = ev(`(()=> (document.querySelector('.decision')?.textContent.match(/Serial\\s+(VT-[A-Z0-9]{10})/)||[])[1] || '')()`);
  ev(`(()=>{ window.__fx2=null; (async()=>{ const r=await fetch('/api/scan',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({token:'__SERIAL__',intent:'buying',location:'',text:''})}); const j=await r.json(); const d=(j.documents||[])[0]||{}; const sale=[...(j.events||[])].filter(e=>e.type==='sell').pop()||{}; window.__fx2={serial:d.claimed_unit_serial||null,saleRef:d.claimed_sale_ref||null,ref:d.reference||null,id:d.id||null,unitToken:j.unit?.token||null,saleId:sale.id||null}; })(); return 'started'; })()`.replace('__SERIAL__', serial2));
  let fx2 = null;
  for (let i = 0; i < 30 && !fx2; i++) { sleep(300); fx2 = ev(`(()=> window.__fx2 || null)()`); if (fx2 && !fx2.serial) fx2 = null; }
  check('returned fixture loaded', !!(fx2 && fx2.serial && fx2.saleRef), JSON.stringify(fx2));
  check('returned fixture genuinely matches (serial + sale)', fx2.serial === fx2.unitToken && fx2.saleRef === fx2.saleId, JSON.stringify(fx2));
  clickText('View return document');
  const dlg3 = dialogText();
  check('returned dialog shows matching claimed serial', dlg3.includes(fx2.serial) && dlg3.includes(fx2.unitToken), fx2.serial);
  check('returned dialog shows matching claimed sale reference', dlg3.includes(fx2.saleRef), fx2.saleRef);
  check('returned dialog shows document reference', dlg3.includes(fx2.ref), fx2.ref);
  ab(['press', 'Escape']); sleep(300);
} catch (e) { fail++; console.log('FAIL returned dialog exception ' + String(e).slice(0, 300)); }
console.log(`\n${pass} passed, ${fail} failed`);
try { ab(['close', '--all']); } catch {}
process.exit(fail ? 1 : 0);
