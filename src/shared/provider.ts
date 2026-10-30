import {validateInvestigation, type Investigation} from './investigator';
export type Transport=(req:{url:string;method:string;headers:Record<string,string>;body:string;signal?:AbortSignal})=>Promise<{ok:boolean;status:number;text:()=>Promise<string>}>;
export interface ToolDef{name:string;description:string}
export const TOOL_DEFS:ToolDef[]=[
 {name:'get_unit_history',description:'Lifecycle events and observations for the current unit'},
 {name:'get_linked_records',description:'Relevant sale, return and handoff records reachable from the current unit'},
 {name:'get_related_reports',description:'Bounded, redacted reports for the same unit in this session'},
 {name:'get_return_document',description:'Resolve a return document by reference, scoped to the current unit claim. Args: {reference: string}'},
 {name:'get_claimed_documents',description:'List return-document references explicitly associated with the current unit claim (discovery step before get_return_document)'}];
export interface ProviderOpts{transport:Transport;apiKey:string;model:string;timeoutMs?:number;system:string;user:string;execTool:(name:string,args?:any)=>Promise<{records:{id:string}[];payload:unknown}>}
export function validateToolArgs(name:string,args:any):boolean{ if(!args||typeof args!=='object'||Array.isArray(args)) return false; const keys=Object.keys(args); if(name==='get_claimed_documents'){ return keys.length===0; } if(name==='get_return_document'){ return keys.length===1 && typeof args.reference==='string' && /^[A-Za-z0-9-]{3,40}$/.test(args.reference); } return keys.length===0; }
export function boundValue(v:any):any{ if(typeof v==='string') return v.length>1200?v.slice(0,1200)+'…[truncated]':v; if(Array.isArray(v)) return v.map(boundValue); if(v&&typeof v==='object'){ const o:any={}; for(const k of Object.keys(v)) o[k]=boundValue(v[k]); return o; } return v; }
export interface ProviderResult{investigation:Investigation;toolsUsed:string[];retrievedIds:string[];providerRequests:number}
/** Bounded Meta protocol: max 2 retrieval rounds, max 6 tool executions, then a separate final synthesis request (no tools offered). Mockable transport; never cached by caller on failure. */
export async function runProvider(opts:ProviderOpts):Promise<ProviderResult>{
  const deadline=Date.now()+(opts.timeoutMs??20000); const retrieved=new Set<string>(); const toolsUsed:string[]=[]; let requests=0, executed=0;
  const call=async(messages:unknown[],withTools:boolean)=>{
    requests++; if(requests>4) throw new Error('provider request budget exceeded');
    const remaining=deadline-Date.now(); if(remaining<=0) throw new Error('provider deadline exceeded'); const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),remaining);
    try{
      const aborted=new Promise<never>((_,rej)=>ctrl.signal.addEventListener('abort',()=>rej(new Error('provider timeout'))));
      const res=await Promise.race([opts.transport({url:'https://api.meta.ai/v1/chat/completions',method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${opts.apiKey}`},body:JSON.stringify({model:opts.model,messages,temperature:0.2,max_tokens:900,...(withTools?{tools:TOOL_DEFS.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:{type:'object',properties:t.name==='get_return_document'?{reference:{type:'string',minLength:3,maxLength:40}}:{},additionalProperties:false,...(t.name==='get_return_document'?{required:['reference']}:{})}}}))}:{})}),signal:ctrl.signal}),aborted]);
      const aborted2=new Promise<never>((_,rej)=>ctrl.signal.addEventListener('abort',()=>rej(new Error('provider timeout during body')))); const text=await Promise.race([res.text(),aborted2]); if(text.length>200000) throw new Error('provider response too large'); if(!res.ok) throw new Error('provider '+res.status);
      return JSON.parse(text);
    } finally{ clearTimeout(timer); }
  };
  const messages:any[]=[{role:'system',content:opts.system},{role:'user',content:opts.user}];
  for(let round=0; round<2; round++){
    const data=await call(messages,true); const msg=data?.choices?.[0]?.message; if(!msg) throw new Error('no provider message');
    messages.push(msg);
    if(msg.tool_calls!=null && !Array.isArray(msg.tool_calls)) throw new Error('malformed tool call envelope');
    const calls=Array.isArray(msg.tool_calls)?msg.tool_calls:[];
    if(calls.length>6) throw new Error('tool call array exceeds bound');
    const ids=new Set(); for(const tc of calls){ if(!tc?.id || ids.has(tc.id)) throw new Error('duplicate or missing tool call id'); ids.add(tc.id); }
    if(!calls.length){ return finish(msg,retrieved,toolsUsed,requests); }
    for(const tc of calls){
      const name=tc?.function?.name; let argsOk=true; let parsedArgs:any={}; try{ parsedArgs=tc?.function?.arguments?JSON.parse(tc.function.arguments):{}; argsOk=validateToolArgs(name,parsedArgs); }catch{ argsOk=false; }
      if(executed>=6 || !TOOL_DEFS.some(t=>t.name===name) || !argsOk){
        messages.push({role:'tool',tool_call_id:tc?.id||'invalid',content:JSON.stringify({error:!argsOk?'invalid arguments':executed>=6?'tool budget exhausted':'unknown tool refused'})}); continue;
      }
      executed++; toolsUsed.push(name);
      const out=await Promise.race([opts.execTool(name,parsedArgs), new Promise<never>((_,rej)=>setTimeout(()=>rej(new Error('tool deadline exceeded')), Math.max(1,deadline-Date.now())))]);
      // Select complete records first; citable IDs derive solely from what is actually transmitted.
      const payload:any=boundValue(JSON.parse(JSON.stringify(out.payload))); const arr:any[]=payload.records||payload.reports||payload.claimed_documents||(payload.document?[payload.document]:[]);
      let content=JSON.stringify(payload); let omitted=0; while(content.length>7000 && arr.length>1){ arr.pop(); omitted++; content=JSON.stringify(payload); } if(omitted) payload.omitted_records=omitted;
      // Whole-record bound: shrink the longest string fields until the serialized tool content fits.
      let guard=0; while(content.length>7000 && guard++<60){ let best:{o:any,k:string}|null=null; const walk=(o:any)=>{ if(!o||typeof o!=='object')return; for(const k of Object.keys(o)){ const v=o[k]; if(typeof v==='string'&&v.length>80&&(!best||v.length>(best.o[best.k] as string).length)) best={o,k}; else walk(v); } }; walk(payload); if(!best) break; const b=best as {o:any,k:string}; b.o[b.k]=(b.o[b.k] as string).slice(0,Math.max(80,Math.floor((b.o[b.k] as string).length/2)))+'…[truncated]'; payload.truncated_fields=(payload.truncated_fields||0)+1; content=JSON.stringify(payload); }
      if(payload.records) payload.records=arr; if(payload.reports) payload.reports=arr; if(payload.claimed_documents) payload.claimed_documents=arr; content=JSON.stringify(payload);
      arr.forEach((r:any)=>{ if(r?.id) retrieved.add(r.id); }); if(payload.document?.id && content.includes(payload.document.id)) retrieved.add(payload.document.id);
      messages.push({role:'tool',tool_call_id:tc.id,content});
    }
  }
  // Retrieval budget ended: bounded final synthesis with no tools offered.
  messages.push({role:'user',content:'Retrieval budget ended. Answer now with only the final JSON object, citing only evidence IDs already retrieved.'});
  const data=await call(messages,false); const msg=data?.choices?.[0]?.message; if(!msg) throw new Error('no final provider message'); if(msg.tool_calls?.length) throw new Error('tool calls not allowed in final synthesis');
  return finish(msg,retrieved,toolsUsed,requests);
}
function finish(msg:any,retrieved:Set<string>,toolsUsed:string[],requests:number):ProviderResult{
  const txt=typeof msg?.content==='string'?msg.content:''; const start=txt.indexOf('{'), end=txt.lastIndexOf('}');
  if(start<0||end<start) throw new Error('malformed final output');
  const v=validateInvestigation(JSON.parse(txt.slice(start,end+1)),retrieved);
  if(!v.ok) throw new Error(v.error);
  return {investigation:v.data,toolsUsed,retrievedIds:[...retrieved],providerRequests:requests};
}
export const SIM_VERSION='sim-v3';
