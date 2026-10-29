export type UnitState='registered'|'in_distribution'|'in_transit'|'at_retailer'|'sold'|'returned';
export type Intent='buying'|'own';
export interface Ev{ id:string; unit_id:string; actor_id:string; actor_name?:string; actor_role?:string; type:string; server_time:string; effective_time:string; note:string|null; provenance:string; linked_event_id:string|null; from_state:string|null; to_state:string|null }
export interface Unit{ id:string; token:string; batch_id:string; product_name:string; brand:string; batch_code:string; state:UnitState; custodian_id:string|null; evidence_version:number; scenario:string|null }
export interface Finding{ code:string; title:string; detail:string; severity:'info'|'warn' }
export const TRANSITIONS:Record<string,{from:UnitState[];to:UnitState;roles:string[];label:string}> = {
  dispatch:{from:['registered'],to:'in_distribution',roles:['manufacturer'],label:'Dispatch to distributor'},
  transfer_dispatch:{from:['in_distribution','at_retailer'],to:'in_transit',roles:['manufacturer','distributor','retailer'],label:'Dispatch transfer'},
  transfer_receive:{from:['in_transit','in_distribution'],to:'at_retailer',roles:['distributor','retailer'],label:'Acknowledge receipt'},
  sell:{from:['at_retailer'],to:'sold',roles:['retailer'],label:'Sell item'},
  return:{from:['sold'],to:'returned',roles:['retailer'],label:'Authorized return'},
  restock:{from:['returned'],to:'at_retailer',roles:['retailer'],label:'Restock'},
};
export function canTransition(state:UnitState,type:string,role:string){ const t=TRANSITIONS[type]; return !!t && t.from.includes(state) && t.roles.includes(role); }
