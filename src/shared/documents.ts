export interface ReturnDocument{ id:string; reference:string; claimed_unit_serial:string|null; claimed_sale_ref:string|null; claimed_issuer_name:string|null; issuer_actor_id:string|null; issue_date:string|null; return_date:string|null; referenced_return_event_id:string|null; provenance:string; verification_status:string; revision:number; note:string|null }
export interface CompareField{ field:string; expected:string; document_value:string; status:'match'|'mismatch'|'unknown'; evidence_ids:string[]; explanation:string }
export interface Comparison{ document_id:string|null; reference:string|null; complete:boolean; scope_note:string; fields:CompareField[]; outcome:'corroborated'|'mismatch'|'metadata_only'|'unavailable'|'incomplete' }
/** Strict calendar date (YYYY-MM-DD, no rollover). Returns the string when real, else null. */
export function validDate(s:string|null|undefined):string|null{ if(!s) return null; const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s); if(!m) return null; const y=+m[1],mo=+m[2],d=+m[3]; if(mo<1||mo>12||d<1||d>31) return null; const dt=new Date(Date.UTC(y,mo-1,d)); return (dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d)?s:null; }
export function validateDocument(doc:ReturnDocument):string[]{ const errs:string[]=[]; if(!doc.id||!doc.reference) errs.push('document identity missing'); if(doc.issue_date&&!validDate(doc.issue_date)) errs.push('issue_date is not a real calendar date'); if(doc.return_date&&!validDate(doc.return_date)) errs.push('return_date is not a real calendar date'); if(!['seller_supplied_fixture','simulated_partner_record','unverified_claim'].includes(doc.provenance)) errs.push('unknown provenance'); return errs; }
/**
 * Deterministic metadata comparison against retrieved lifecycle records.
 * Identifiers match exactly (abbreviations are display-only). Corroboration
 * requires every mandatory check to match: unit, exact sale, issuer mapped to
 * the recorded seller, valid chronology agreeing with the referenced return
 * event, and that exact return (linked to this sale) restocked. Anything
 * missing is unknown/incomplete, never a fabricated match. This compares
 * metadata and lifecycle linkage; it does not verify document authenticity.
 */
export function compareDocument(doc:ReturnDocument|null, unit:{token:string}|null, events:{id:string;type:string;actor_id?:string;actor_name?:string;server_time:string;linked_event_id?:string|null}[], lookupEvidenceId?:string):Comparison{
  const scope='Checked authorized sale/return/restock records retrieved for this unit in this session.';
  if(!doc) return {document_id:null,reference:null,complete:true,scope_note:scope,fields:[],outcome:'unavailable'};
  const errs=validateDocument(doc);
  if(errs.length) return {document_id:doc.id,reference:doc.reference,complete:false,scope_note:scope,fields:[{field:'Document validity',expected:'Well-formed document metadata',document_value:errs.join('; '),status:'unknown',evidence_ids:[doc.id],explanation:'Malformed evidence cannot corroborate anything. It is reported as incomplete, not as a match or an accusation.'}],outcome:'incomplete'};
  const sales=events.filter(e=>e.type==='sell'); const sale=sales[sales.length-1];
  const returns=events.filter(e=>e.type==='return'); const restocks=events.filter(e=>e.type==='restock');
  const linkedReturn=sale?returns.find(r=>r.linked_event_id===sale.id):undefined;
  const linkedRestock=linkedReturn?restocks.find(r=>r.linked_event_id===linkedReturn.id):undefined;
  const ev=(...ids:(string|undefined|null)[])=>[...new Set(ids.filter(Boolean) as string[])];
  const f:CompareField[]=[];
  f.push({field:'Unit serial',expected:unit?.token||'unknown',document_value:doc.claimed_unit_serial||'not stated',status:!doc.claimed_unit_serial?'unknown':doc.claimed_unit_serial===(unit?.token)?'match':'mismatch',evidence_ids:ev(doc.id),explanation:!doc.claimed_unit_serial?'The document does not state a unit serial.':doc.claimed_unit_serial===(unit?.token)?'Document serial exactly matches the unit being checked.':'Document serial refers to a different unit than the one being checked.'});
  const saleMatch=!!sale&&!!doc.claimed_sale_ref&&doc.claimed_sale_ref===sale.id;
  f.push({field:'Original sale',expected:sale?`Sale recorded ${sale.server_time.slice(0,10)} (ref ${sale.id.slice(0,8)}…)`:'No sale retrieved in scope',document_value:doc.claimed_sale_ref?`Ref ${String(doc.claimed_sale_ref).slice(0,8)}…`:'not stated',status:!doc.claimed_sale_ref||!sale?'unknown':saleMatch?'match':'mismatch',evidence_ids:ev(sale?.id,doc.id),explanation:!sale?'No sale was retrieved in the checked scope, so the sale reference cannot be compared.':!doc.claimed_sale_ref?'The document does not reference a sale.':saleMatch?'Document sale reference exactly matches the current sale cycle.':'Document sale reference does not exactly match the current sale cycle. Abbreviated references are not accepted as matches.'});
  let issuerStatus:'match'|'mismatch'|'unknown'='unknown'; let issuerWhy='Issuer is only a typed name on the document; that does not verify identity, so this stays unknown.';
  if(doc.issuer_actor_id&&sale?.actor_id){ if(doc.issuer_actor_id===sale.actor_id){issuerStatus='match';issuerWhy='Claimed issuer maps to the retailer who recorded this sale.';} else {issuerStatus='mismatch';issuerWhy='Claimed issuer is a different known retailer than the one who recorded this sale.';} }
  if(doc.claimed_issuer_name&&sale?.actor_name&&doc.claimed_issuer_name!==sale.actor_name){ if(issuerStatus==='match'){ issuerStatus='unknown'; issuerWhy='The issuer ID maps to the recorded seller, but the claimed issuer name conflicts with the recorded seller name, so the issuer assertion is not a clean match.'; } else issuerWhy+=' The claimed issuer name also differs from the recorded seller name.'; }
  f.push({field:'Issuer / retailer',expected:sale?.actor_name||'recorded seller',document_value:doc.claimed_issuer_name||'not stated',status:issuerStatus,evidence_ids:ev(sale?.id,doc.id),explanation:issuerWhy});
  const rd=validDate(doc.return_date), saleDate=sale?sale.server_time.slice(0,10):null, retEvent=doc.referenced_return_event_id?returns.find(r=>r.id===doc.referenced_return_event_id):undefined;
  let chronStatus:'match'|'mismatch'|'unknown'='unknown'; let chronWhy='Return date is missing or invalid, so chronology cannot be established.';
  if(rd&&saleDate&&!validDate(doc.issue_date)){ chronStatus='unknown'; chronWhy='Document issue date is missing or invalid, so issuance chronology cannot be established.'; }
  else if(rd&&saleDate){ if(rd<saleDate){chronStatus='mismatch';chronWhy='Document return date is before the recorded sale, which is impossible for this sale cycle.';} else if(retEvent&&rd!==retEvent.server_time.slice(0,10)){chronStatus='mismatch';chronWhy='Document return date does not agree with the referenced return event date.';} else if(validDate(doc.issue_date)&&(validDate(doc.issue_date) as string)<rd){chronStatus='mismatch';chronWhy='Document issue date is before its own return date.';} else {chronStatus='match';chronWhy='Document return date is on or after the sale and agrees with the referenced return event where one is identified.';} }
  f.push({field:'Return chronology',expected:sale?('Sale '+(saleDate||'')):'unknown',document_value:doc.return_date||'not stated',status:chronStatus,evidence_ids:ev(sale?.id,retEvent?.id,doc.id),explanation:chronWhy});
  const refMatch=!!doc.referenced_return_event_id&&!!linkedReturn&&doc.referenced_return_event_id===linkedReturn.id;
  let chainStatus:'match'|'mismatch'|'unknown'='unknown'; let chainWhy='No referenced return event was identified, so lifecycle corroboration is incomplete.';
  if(doc.referenced_return_event_id){ if(refMatch&&linkedRestock){chainStatus='match';chainWhy='The document references the exact authorized return linked to this sale, and that return has a linked restock.';} else if(refMatch){chainStatus='unknown';chainWhy='The referenced return is linked to this sale, but no linked restock was retrieved in scope.';} else {chainStatus='mismatch';chainWhy='The document references a return that is not the authorized return linked to this sale.';} }
  else if(linkedReturn){ chainWhy='An authorized return linked to this sale exists, but the document does not reference it, so the document itself is uncorroborated.'; }
  f.push({field:'Authorized return chain',expected:'Document references the return linked to this sale, restocked in turn',document_value:doc.referenced_return_event_id?`Ref ${doc.referenced_return_event_id.slice(0,8)}…`:'none referenced',status:chainStatus,evidence_ids:ev(linkedReturn?.id,linkedRestock?.id,doc.id,lookupEvidenceId),explanation:chainWhy});
  const statuses=f.map(x=>x.status); const hasMismatch=statuses.includes('mismatch');
  const allMatch=statuses.every(s=>s==='match');
  const identityMatch=f[0].status==='match'&&f[1].status==='match';
  const outcome:Comparison['outcome']=hasMismatch?'mismatch':allMatch?'corroborated':identityMatch?'metadata_only':'incomplete';
  return {document_id:doc.id,reference:doc.reference,complete:!statuses.includes('unknown'),scope_note:scope,fields:f,outcome};
}
export function documentsFingerprint(docs:ReturnDocument[]){ return (docs||[]).map(d=>[d.id,d.revision,d.reference,d.claimed_unit_serial,d.claimed_sale_ref,d.claimed_issuer_name,d.issuer_actor_id,d.issue_date,d.return_date,d.referenced_return_event_id,d.provenance,d.verification_status,d.note].join(':')).join('|')||'nodocs'; }
