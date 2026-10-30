// Independent review-only desired-behavior tests; no external model/network calls.
import { it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from '../src/worker/index';
import { compareDocument, type ReturnDocument } from '../src/shared/documents';
import { runProvider } from '../src/shared/provider';

afterEach(() => vi.restoreAllMocks());
const events = [
 {id:'sale-1',type:'sell',actor_id:'seller',actor_name:'Shop',server_time:'2026-10-20T12:00:00Z'},
 {id:'return-1',type:'return',actor_id:'seller',server_time:'2026-10-22T12:00:00Z',linked_event_id:'sale-1'},
 {id:'restock-1',type:'restock',actor_id:'seller',server_time:'2026-10-23T12:00:00Z',linked_event_id:'return-1'},
];
const doc:ReturnDocument={id:'doc-1',reference:'RET-OK',claimed_unit_serial:'VT-123456',claimed_sale_ref:'sale-1',claimed_issuer_name:'Shop',issuer_actor_id:'seller',issue_date:'2026-10-22',return_date:'2026-10-22',referenced_return_event_id:'return-1',provenance:'simulated_partner_record',verification_status:'metadata_checked',revision:1,note:null};
it('F01 missing issue date cannot be fully corroborated',()=>{
 expect(compareDocument({...doc,issue_date:null},{token:'VT-123456'},events).outcome).not.toBe('corroborated');
});
it('F02 conflicting issuer name cannot be displayed as a complete match merely because its ID matches',()=>{
 expect(compareDocument({...doc,claimed_issuer_name:'Different shop'},{token:'VT-123456'},events).outcome).not.toBe('corroborated');
});

async function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 for(const name of ['0001_init.sql','0002_integrity.sql','0003_documents.sql'])sqlite.exec(readFileSync('migrations/'+name,'utf8'));
 let before:(sql:string,kind:string)=>void=()=>{};
 const db:any={prepare:(sql:string)=>{let values:any[]=[];const q:any={bind:(...v:any[])=>{values=v;return q},first:async()=>{before(sql,'first');return sqlite.prepare(sql).get(...values)},all:async()=>{before(sql,'all');return{results:sqlite.prepare(sql).all(...values)}},run:async()=>{before(sql,'run');const r=sqlite.prepare(sql).run(...values);return{meta:{changes:Number(r.changes)}}}};return q}};
 let tail=Promise.resolve();db.batch=async(qs:any[])=>{const job=tail.then(async()=>{sqlite.exec('BEGIN');try{const out=[];for(const q of qs)out.push(await q.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}});tail=job.then(()=>{},()=>{});return job};
 let cookie='';const call=async(path:string,body?:any)=>{const r=await app.request(path,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined},{DB:db,AI_MODE:'simulated'});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return{status:r.status,body:await r.json().catch(()=>({})) as any}};
 await call('/api/demo/start',{});const state=(await call('/api/state')).body;
 return{sqlite,call,state,hook:(f:typeof before)=>{before=f},unit:(scenario:string)=>state.units.find((u:any)=>u.scenario===scenario)};
}
it('F03 malformed document does not disappear from the overall assessment',async()=>{
 const f=await fixture();try{
  const u=f.unit('returned');f.sqlite.prepare("UPDATE documents SET issue_date='not-a-date',revision=revision+1 WHERE reference='RET-OK-102'").run();
  const scan=await f.call('/api/scan',{token:u.token,intent:'buying'});
  const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:scan.body.request.snapshot});
  expect(r.body.investigation.comparison.outcome).toBe('incomplete');
  expect(r.body.investigation.assessment).not.toBe('no_issue_in_records');
 }finally{f.sqlite.close()}
});
it('F04 wrong document does not erase an existing authorized return from the narrative',async()=>{
 const f=await fixture();try{
  const u=f.unit('returned');f.sqlite.prepare("UPDATE documents SET claimed_unit_serial='VT-WRONG',revision=revision+1 WHERE reference='RET-OK-102'").run();
  const scan=await f.call('/api/scan',{token:u.token,intent:'buying'});
  const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:scan.body.request.snapshot});
  expect(r.body.findings.some((x:any)=>x.code==='prior_sale_explained')).toBe(true);
  expect(r.body.investigation.assessment).toBe('verify_before_purchase');
  expect(r.body.investigation.summary).not.toContain('the prior sale remains unresolved');
 }finally{f.sqlite.close()}
});
it('F05 claim text changes invalidate the displayed snapshot',async()=>{
 const f=await fixture();try{
  const u=f.unit('returned');const scan=await f.call('/api/scan',{token:u.token,intent:'buying'});
  f.sqlite.prepare('UPDATE document_claims SET claim_text=? WHERE unit_id=?').run('The seller withdraws this claim.',u.id);
  const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:scan.body.request.snapshot});
  expect(r.status).toBe(409);
 }finally{f.sqlite.close()}
});
it('F06 reset failure preserves the previous complete session',async()=>{
 const f=await fixture();try{
  vi.spyOn(console,'error').mockImplementation(()=>{});
  f.hook((sql,kind)=>{if(kind==='run'&&sql.startsWith('INSERT INTO actors'))throw new Error('injected local seed failure')});
  const r=await f.call('/api/demo/reset',{});expect(r.status).toBe(500);
  const units=f.sqlite.prepare('SELECT id FROM units ORDER BY id').all().map((x:any)=>x.id);
  expect(units).toEqual(f.state.units.map((x:any)=>x.id).sort());
 }finally{f.sqlite.close()}
});
it('F07 stale completion always releases its concurrency lease',async()=>{
 const f=await fixture();try{
  const u=f.unit('returned');const scan=await f.call('/api/scan',{token:u.token,intent:'buying'});let changed=false;
  f.hook((sql,kind)=>{if(!changed&&kind==='first'&&sql==='SELECT evidence_version FROM units WHERE id=?'){changed=true;f.sqlite.prepare('UPDATE units SET evidence_version=evidence_version+1 WHERE id=?').run(u.id)}});
  const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:scan.body.request.snapshot});
  expect(r.body.stale).toBe(true);
  expect(f.sqlite.prepare('SELECT COUNT(*) AS n FROM leases').get()?.n).toBe(0);
 }finally{f.sqlite.close()}
});
const answer=JSON.stringify({assessment:'insufficient_evidence',summary:'More records needed.',supported_findings:[],possible_explanations:[],recommended_checks:[],limitations:[]});
const response=(msg:any)=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:msg}]})});
it('F08 whole single-record payload stays bounded even with multiple large fields',async()=>{
 let n=0,bytes=0;
 const big:any={id:'one'};for(let i=0;i<8;i++)big['field'+i]='x'.repeat(5000);
 await runProvider({apiKey:'mock',model:'mock',system:'s',user:'u',transport:async(req)=>{if(++n===2)bytes=JSON.parse(req.body).messages.find((m:any)=>m.role==='tool').content.length;return response(n===1?{tool_calls:[{id:'t',function:{name:'get_unit_history',arguments:'{}'}}]}:{content:answer})},execTool:async()=>({records:[{id:'one'}],payload:{records:[big]}})});
 expect(bytes).toBeLessThanOrEqual(7000);
});
