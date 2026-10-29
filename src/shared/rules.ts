import type {Ev,Finding,Intent,Unit} from './types';
export function evaluate(unit:Unit|null, events:Ev[], intent:Intent, scanCountSameSession:number):Finding[]{
  if(!unit) return [{code:'unknown_code',title:'No registry record',detail:'This code is not in the Verity registry. That does not prove the item is counterfeit, it may be from a maker not on Verity, or the code may be mistyped.',severity:'warn'}];
  const f:Finding[]=[];
  const sales=events.filter(e=>e.type==='sell');
  const returns=events.filter(e=>e.type==='return');
  const restocks=events.filter(e=>e.type==='restock');
  const dispatched=events.filter(e=>e.type==='transfer_dispatch');
  const received=events.filter(e=>e.type==='transfer_receive'||e.type==='receipt');
  const unresolvedSale = sales.length>0 && !(returns.length>=sales.length && restocks.length>0) && unit.state==='sold';
  const explainedSale = sales.length>0 && returns.length>0 && restocks.length>0;
  if(unit.state==='in_transit' || (dispatched.length>received.length && unit.state!=='sold'))
    f.push({code:'incomplete_history',title:'Incomplete history',detail:'A transfer was dispatched but the recipient has not acknowledged receipt. Custody is not confirmed.',severity:'warn'});
  if(intent==='buying' && unresolvedSale)
    f.push({code:'prior_sale_unresolved',title:'Verification needed',detail:'Records show this item was already sold and there is no linked authorized return/restock explaining it being offered again. Ask the seller to explain and verify with the retailer before buying.',severity:'warn'});
  if(intent==='buying' && explainedSale)
    f.push({code:'prior_sale_explained',title:'Prior sale has a documented explanation',detail:'A sale is recorded, followed by an authorized return and restock linked to it. This explains the earlier sale in the records; it does not certify the physical item.',severity:'info'});
  if(intent==='own' && unit.state==='sold')
    f.push({code:'owner_recheck',title:'Recorded as sold, consistent with you owning it',detail:'A repeat scan by the same owner/session is not a new fraud signal.',severity:'info'});
  // duplicate sightings: consumer reports in different cities after sale
  if(f.length===0) f.push({code:'no_issues',title:'No issues found in available records',detail:'The recorded journey is internally consistent. This is not a guarantee the physical item is genuine, codes can be copied.',severity:'info'});
  return f;
}
export function fingerprint(unit:Unit,events:Ev[],reports:{id:string}[]){ return `${unit.id}:${unit.evidence_version}:${events.length}:${reports.length}`; }
export const FORBIDDEN_CLAIMS=['100% genuine','safe to use','certified genuine','guaranteed authentic'];
export function containsForbiddenClaim(text:string){ const t=text.toLowerCase(); return FORBIDDEN_CLAIMS.some(c=>t.includes(c)); }
