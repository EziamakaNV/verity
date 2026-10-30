// Independent end-to-end boundary checks. Local SQLite and mocked provider only.
import {it,expect,vi,afterEach} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import app from '../src/worker/index';
import {runProvider} from '../src/shared/provider';
afterEach(()=>vi.restoreAllMocks());
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
it('G01 missing issue date produces explicit uncertainty in the actual route assessment',async()=>{
 const f=await fixture();try{
  const u=f.unit('returned');f.sqlite.prepare("UPDATE documents SET issue_date=NULL,revision=revision+1 WHERE reference='RET-OK-102'").run();
  const s=await f.call('/api/scan',{token:u.token,intent:'buying'});
  const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:s.body.request.snapshot});
  expect(r.body.investigation.comparison.complete).toBe(false);
  expect(r.body.investigation.assessment).not.toBe('no_issue_in_records');
 }finally{f.sqlite.close()}
});
it('G02 conflicting issuer name survives real retrieval and cannot corroborate',async()=>{
 const f=await fixture();try{
  const u=f.unit('returned');f.sqlite.prepare("UPDATE documents SET claimed_issuer_name='Different shop',revision=revision+1 WHERE reference='RET-OK-102'").run();
  const s=await f.call('/api/scan',{token:u.token,intent:'buying'});
  const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:s.body.request.snapshot});
  expect(r.body.investigation.comparison.outcome).not.toBe('corroborated');
 }finally{f.sqlite.close()}
});
it('G03 document content mutation without a convention-only revision bump is detected',async()=>{
 const f=await fixture();try{
  const u=f.unit('returned');const s=await f.call('/api/scan',{token:u.token,intent:'buying'});
  f.sqlite.prepare("UPDATE documents SET claimed_unit_serial='VT-WRONG' WHERE reference='RET-OK-102'").run();
  const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:s.body.request.snapshot});
  expect(r.status).toBe(409);
 }finally{f.sqlite.close()}
});
it('G04 a claim changed during investigation is rejected before publishing',async()=>{
 const f=await fixture();try{
  const u=f.unit('returned');const s=await f.call('/api/scan',{token:u.token,intent:'buying'});let changed=false;
  f.hook((sql,kind)=>{if(!changed&&kind==='first'&&sql==='SELECT evidence_version FROM units WHERE id=?'){changed=true;f.sqlite.prepare('UPDATE document_claims SET claim_text=? WHERE unit_id=?').run('This claim was withdrawn.',u.id)}});
  const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:s.body.request.snapshot});
  expect(r.status).toBe(409);
 }finally{f.sqlite.close()}
});
it('G05 cache persistence failure releases the acquired lease',async()=>{
 const f=await fixture();try{
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const u=f.unit('returned');const s=await f.call('/api/scan',{token:u.token,intent:'buying'});
  f.hook((sql,kind)=>{if(kind==='run'&&sql.startsWith('INSERT OR IGNORE INTO investigations'))throw new Error('injected cache-write failure')});
  await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:s.body.request.snapshot});
  expect(f.sqlite.prepare('SELECT COUNT(*) AS n FROM leases').get()?.n).toBe(0);
 }finally{f.sqlite.close()}
});
it('G06 newly added claim-discovery records can be cited after transmission',async()=>{
 let n=0;
 const answer={assessment:'insufficient_evidence',summary:'A document reference is available; its contents still need checking.',supported_findings:[{claim:'A return-document reference is associated with this unit.',evidence_ids:['doc-1']}],possible_explanations:[],recommended_checks:[],limitations:[]};
 const response=(msg:any)=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:msg}]})});
 const result=await runProvider({apiKey:'mock',model:'mock',system:'s',user:'u',transport:async()=>response(++n===1?{tool_calls:[{id:'discover',function:{name:'get_claimed_documents',arguments:'{}'}}]}:{content:JSON.stringify(answer)}),execTool:async()=>({records:[{id:'doc-1'}],payload:{tool:'get_claimed_documents',claimed_documents:[{id:'doc-1',reference:'RET-OK-102',provenance:'simulated_partner_record',verification_status:'metadata_checked'}]}})});
 expect(result.retrievedIds).toContain('doc-1');
});
for(const table of ['products','documents']) it(`G07 reset rollback preserves complete old state on ${table} insert failure`,async()=>{
 const f=await fixture();try{
  f.hook((sql,kind)=>{if(kind==='run'&&sql.startsWith('INSERT INTO '+table))throw new Error('injected '+table+' failure')});
  const r=await f.call('/api/demo/reset',{});expect(r.status).toBe(500);
  expect(f.sqlite.prepare('SELECT id FROM units ORDER BY id').all().map((x:any)=>x.id)).toEqual(f.state.units.map((x:any)=>x.id).sort());
  expect(f.sqlite.prepare('SELECT COUNT(*) AS n FROM documents').get()?.n).toBe(2);
 }finally{f.sqlite.close()}
});
