// Review-only desired-behavior checks. Failures document remaining bugs; product files are untouched.
import { it, expect, vi, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from '../src/worker/index';
import { compareDocument, type ReturnDocument } from '../src/shared/documents';
import { runProvider } from '../src/shared/provider';

afterEach(() => vi.useRealTimers());
const events = [
  {id:'abcdef12-1111-2222-3333-444444444444',type:'sell',actor_id:'seller',actor_name:'Shop',server_time:'2026-10-20T12:00:00Z'},
  {id:'return-1',type:'return',actor_id:'seller',server_time:'2026-10-22T12:00:00Z',linked_event_id:'abcdef12-1111-2222-3333-444444444444'},
  {id:'restock-1',type:'restock',actor_id:'seller',server_time:'2026-10-23T12:00:00Z',linked_event_id:'return-1'},
];
const doc:ReturnDocument={id:'doc-1',reference:'RET-OK',claimed_unit_serial:'VT-123456',claimed_sale_ref:events[0].id,claimed_issuer_name:'Shop',issuer_actor_id:'seller',issue_date:'2026-10-22',return_date:'2026-10-22',referenced_return_event_id:'return-1',provenance:'simulated_partner_record',verification_status:'metadata_checked',revision:1,note:null};
const compare=(change:Partial<ReturnDocument>)=>compareDocument({...doc,...change},{token:'VT-123456'},events);
it('requires an exact original sale reference rather than a one-character prefix',()=>{expect(compare({claimed_sale_ref:'a'}).fields.find(f=>f.field==='Original sale')?.status).toBe('mismatch');});
it('does not corroborate a document referencing a different return',()=>{expect(compare({referenced_return_event_id:'WRONG-RETURN'}).outcome).not.toBe('corroborated');});
it('recognizes a known issuer mismatch instead of corroborating it',()=>{expect(compare({issuer_actor_id:'other-seller',claimed_issuer_name:'Other shop'}).outcome).not.toBe('corroborated');});
it('does not corroborate an invalid calendar date',()=>{expect(compare({return_date:'not-a-date'}).outcome).not.toBe('corroborated');});
it('can corroborate the complete correct document fixture',()=>{expect(compare({}).outcome).toBe('corroborated');});

async function fixture(){
 const sqlite=new DatabaseSync(':memory:');
 for(const name of ['0001_init.sql','0002_integrity.sql','0003_documents.sql'])sqlite.exec(readFileSync('migrations/'+name,'utf8'));
 const db:any={prepare:(sql:string)=>{let values:any[]=[];const q:any={bind:(...v:any[])=>{values=v;return q},first:async()=>sqlite.prepare(sql).get(...values),all:async()=>({results:sqlite.prepare(sql).all(...values)}),run:async()=>{const r=sqlite.prepare(sql).run(...values);return{meta:{changes:Number(r.changes)}}}};return q}};
 let tail=Promise.resolve();db.batch=async(qs:any[])=>{const job=tail.then(async()=>{sqlite.exec('BEGIN');try{const out=[];for(const q of qs)out.push(await q.run());sqlite.exec('COMMIT');return out}catch(e){sqlite.exec('ROLLBACK');throw e}});tail=job.then(()=>{},()=>{});return job};
 let cookie='';const call=async(path:string,body?:any)=>{const r=await app.request(path,{method:body?'POST':'GET',headers:{cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined},{DB:db,AI_MODE:'simulated'});const sc=r.headers.get('set-cookie');if(sc)cookie=sc.split(';')[0];return {status:r.status,body:await r.json().catch(()=>({})) as any}};
 await call('/api/demo/start',{});const state=(await call('/api/state')).body;
 return{sqlite,call,state,unit:(scenario:string)=>state.units.find((u:any)=>u.scenario===scenario)};
}
it('does not return no_issue_in_records when the attached return document mismatches',async()=>{
 const f=await fixture();try{const u=f.unit('returned');const sc0=await f.call('/api/scan',{token:u.token,intent:'buying'});f.sqlite.prepare("UPDATE documents SET claimed_unit_serial='VT-WRONG',revision=revision+1 WHERE reference='RET-OK-102'").run();const sc1=await f.call('/api/scan',{token:u.token,intent:'buying'});const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:sc1.body.request.snapshot});expect(r.body.investigation.comparison.outcome).toBe('mismatch');expect(r.body.investigation.assessment).not.toBe('no_issue_in_records');}finally{f.sqlite.close()}
});
it('rejects a displayed snapshot after its associated document revision changes',async()=>{
 const f=await fixture();try{const u=f.unit('returned');const scan=await f.call('/api/scan',{token:u.token,intent:'buying'});f.sqlite.prepare("UPDATE documents SET claimed_unit_serial='VT-WRONG',revision=revision+1 WHERE reference='RET-OK-102'").run();const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:scan.body.request.snapshot});expect(r.status).toBe(409);}finally{f.sqlite.close()}
});
it('still investigates after eight routine rescans of the copied sample',async()=>{
 const f=await fixture();try{const u=f.unit('copied');let scan:any;for(let i=0;i<8;i++)scan=await f.call('/api/scan',{token:u.token,intent:'buying'});const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:scan.body.request.snapshot});expect(r.body.investigation?.assessment).toBe('verify_before_purchase');}finally{f.sqlite.close()}
});
it('can reset a session that contains documents',async()=>{
 const f=await fixture();try{const r=await f.call('/api/demo/reset',{});expect(r.status).toBe(200);}finally{f.sqlite.close()}
});
it('keeps the corroborated sample valid on the hackathon submission date',async()=>{
 vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-04T15:00:00Z'));const f=await fixture();try{const u=f.unit('returned');const sc=await f.call('/api/scan',{token:u.token,intent:'buying'});const r=await f.call('/api/investigate',{token:u.token,intent:'buying',snapshot:sc.body.request.snapshot});expect(r.body.investigation?.comparison?.outcome).toBe('corroborated');}finally{f.sqlite.close()}
});

const answer=JSON.stringify({assessment:'insufficient_evidence',summary:'More records needed.',supported_findings:[],possible_explanations:[],recommended_checks:[],limitations:[]});
const response=(msg:any)=>({ok:true,status:200,text:async()=>JSON.stringify({choices:[{message:msg}]})});
it('bounds stalled tool execution by the end-to-end deadline',async()=>{
 const work=runProvider({apiKey:'mock',model:'mock',system:'s',user:'u',timeoutMs:15,transport:async()=>response({tool_calls:[{id:'t',function:{name:'get_unit_history',arguments:'{}'}}]}),execTool:async()=>new Promise(()=>{})});
 const result=await Promise.race([work.then(()=> 'resolved',()=> 'rejected'),new Promise<string>(r=>setTimeout(()=>r('still pending'),80))]);expect(result).toBe('rejected');
});
it('enforces tool argument schemas at runtime',async()=>{
 let called=false,n=0;await runProvider({apiKey:'mock',model:'mock',system:'s',user:'u',transport:async()=>response(++n===1?{tool_calls:[{id:'t',function:{name:'get_unit_history',arguments:'{"unexpected":"value"}'}}]}:{content:answer}),execTool:async()=>{called=true;return{records:[],payload:{records:[]}}}});expect(called).toBe(false);
});
it('bounds a single oversized evidence record as well as record lists',async()=>{
 let n=0,bytes=0;await runProvider({apiKey:'mock',model:'mock',system:'s',user:'u',transport:async(req)=>{if(++n===2)bytes=JSON.parse(req.body).messages.find((m:any)=>m.role==='tool').content.length;return response(n===1?{tool_calls:[{id:'t',function:{name:'get_unit_history',arguments:'{}'}}]}:{content:answer})},execTool:async()=>({records:[{id:'one'}],payload:{records:[{id:'one',note:'x'.repeat(15000)}]}})});expect(bytes).toBeLessThanOrEqual(7000);
});
