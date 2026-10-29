import type {Ev,Finding,Intent,Unit} from './types';
/** Deterministic findings from validated sale->return->restock chains (linked_event_id), ordered by insertion (array order). */
export function evaluate(unit:Unit|null, events:Ev[], intent:Intent):Finding[]{
  if(!unit) return [{code:'unknown_code',title:'No registry record',detail:'This code is not in the Verity registry. That does not prove the item is counterfeit. It may be from a maker not on Verity, or the code may be mistyped.',severity:'warn'}];
  const f:Finding[]=[];
  const byId=new Map(events.map(e=>[e.id,e]));
  const returns=events.filter(e=>e.type==='return');
  const restocks=events.filter(e=>e.type==='restock');
  const returnedSaleIds=new Set(returns.map(r=>r.linked_event_id).filter(Boolean) as string[]);
  const restockedReturnIds=new Set(restocks.map(r=>r.linked_event_id).filter(Boolean) as string[]);
  const sales=events.filter(e=>e.type==='sell');
  const unresolvedSales=sales.filter(s=>!returnedSaleIds.has(s.id));
  const fullyExplained=sales.length>0 && unresolvedSales.length===0 && sales.every(s=>{const r=returns.find(x=>x.linked_event_id===s.id); return r && restockedReturnIds.has(r.id);});
  const dispatched=events.filter(e=>e.type==='transfer_dispatch');
  const receivedIds=new Set(events.filter(e=>e.type==='transfer_receive').map(e=>e.linked_event_id).filter(Boolean) as string[]);
  const unacked=dispatched.filter(d=>!receivedIds.has(d.id));
  if(unacked.length && unit.state==='in_transit')
    f.push({code:'incomplete_history',title:'Incomplete history',detail:'A transfer was dispatched but the intended recipient has not acknowledged receipt. Custody is not confirmed.',severity:'warn'});
  if(intent==='buying' && unresolvedSales.length && unit.state==='sold')
    f.push({code:'prior_sale_unresolved',title:'Verification needed',detail:'Records show this item was already sold, and no authorized return linked to that sale explains it being offered again. Ask the seller to explain, and verify with the retailer named in the record before buying.',severity:'warn'});
  if(intent==='buying' && fullyExplained && unit.state==='at_retailer')
    f.push({code:'prior_sale_explained',title:'Prior sale has a documented explanation',detail:'The recorded sale is followed by an authorized return and restock linked to that same sale. This explains the earlier sale in the records. It does not certify the physical item.',severity:'info'});
  if(intent==='own' && unit.state==='sold')
    f.push({code:'owner_recheck',title:'Recorded as sold, consistent with you owning it',detail:'A repeat check by the same owner is not a new warning signal on its own.',severity:'info'});
  void byId;
  if(f.length===0) f.push({code:'no_issues',title:'No issues found in available records',detail:'The recorded journey is internally consistent. This is not a guarantee the physical item is genuine. Codes can be copied.',severity:'info'});
  return f;
}
export function fingerprint(unit:Unit,events:Ev[],reports:{id:string}[]){ return `${unit.id}:${unit.evidence_version}:${events.length}:${reports.length}:${events.at(-1)?.id||''}`; }
export const FORBIDDEN_CLAIMS=['100% genuine','certified genuine','guaranteed authentic','proven safe','is safe to use'];
export function containsForbiddenClaim(text:string){
  // Do not reject negated caveats such as "does not prove safe to use" / "not safe to use" disclaimers.
  const cleaned=text.toLowerCase().replace(/(does not|do not|not|never|no guarantee[^\"]{0,40})(prove|certif|guarantee|confirm)?[^.\"]{0,30}(safe to use|genuine|authentic)/g,'');
  return FORBIDDEN_CLAIMS.some(c=>cleaned.includes(c));
}
