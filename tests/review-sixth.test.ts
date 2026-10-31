// Sixth-review boundary checks. Isolated SQLite and pure policy tests; no model calls.
import {it,expect,vi,afterEach} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import app from '../src/worker/index';
import {applyVerdictPolicy, InvestigationSchema} from '../src/shared/investigator';
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

it('H01 cache-hit publication rechecks the complete evidence identity',async()=>{
 const f=await fixture();try{
  const u=f.unit('returned');const scan=await f.call('/api/scan',{token:u.token,intent:'buying'});
  const body={token:u.token,intent:'buying',snapshot:scan.body.request.snapshot};
  const first=await f.call('/api/investigate',body);
  expect(first.body.investigation.comparison.outcome).toBe('corroborated');
  let changed=false;
  f.hook((sql,kind)=>{if(!changed&&kind==='first'&&sql.startsWith('SELECT result_json,mode FROM investigations')){changed=true;f.sqlite.prepare("UPDATE documents SET claimed_unit_serial='VT-WRONG',revision=revision+1 WHERE reference='RET-OK-102'").run()}});
  const r=await f.call('/api/investigate',body);
  expect(r.status,JSON.stringify({cached:r.body.cached,outcome:r.body.investigation?.comparison?.outcome})).toBe(409);
 }finally{f.sqlite.close()}
});

it('H02 verdict policy preserves the published investigation schema bounds',()=>{
 const original={assessment:'no_issue_in_records' as const,summary:'x'.repeat(1200),supported_findings:[],possible_explanations:[],recommended_checks:Array.from({length:6},()=>({action:'Check the record.',reason:'A confirmation may help.',evidence_ids:[]})),limitations:[]};
 expect(InvestigationSchema.safeParse(original).success).toBe(true);
 const adjusted=applyVerdictPolicy(original,[{code:'prior_sale_explained'}],{outcome:'metadata_only',complete:false,fields:[{field:'Return chronology',status:'unknown',evidence_ids:['doc-1']}]},'buying',true);
 expect(adjusted.assessment).toBe('insufficient_evidence');
 expect(InvestigationSchema.safeParse(adjusted).success,JSON.stringify({summaryLength:adjusted.summary.length,checks:adjusted.recommended_checks.length})).toBe(true);
});

