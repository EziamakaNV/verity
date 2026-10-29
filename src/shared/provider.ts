import {validateInvestigation, type Investigation} from './investigator';
export type Transport=(req:{url:string;method:string;headers:Record<string,string>;body:string;signal?:AbortSignal})=>Promise<{ok:boolean;status:number;text:()=>Promise<string>}>;
export interface ToolDef{name:string;description:string}
export const TOOL_DEFS:ToolDef[]=[
 {name:'get_unit_history',description:'Lifecycle events and observations for the current unit'},
 {name:'get_linked_records',description:'Relevant sale, return and handoff records reachable from the current unit'},
 {name:'get_related_reports',description:'Bounded, redacted reports for the same unit in this session'}];
export interface ProviderOpts{transport:Transport;apiKey:string;model:string;timeoutMs?:number;system:string;user:string;execTool:(name:string)=>Promise<{records:{id:string}[];payload:unknown}>}
export interface ProviderResult{investigation:Investigation;toolsUsed:string[];retrievedIds:string[];providerRequests:number}
/** Bounded Meta protocol: max 2 retrieval rounds, max 6 tool executions, then a separate final synthesis request (no tools offered). Mockable transport; never cached by caller on failure. */
export async function runProvider(opts:ProviderOpts):Promise<ProviderResult>{
  const timeoutMs=opts.timeoutMs??20000; const retrieved=new Set<string>(); const toolsUsed:string[]=[]; let requests=0, executed=0;
  const call=async(messages:unknown[],withTools:boolean)=>{
    requests++; if(requests>4) throw new Error('provider request budget exceeded');
    const ctrl=new AbortController(); const timer=setTimeout(()=>ctrl.abort(),timeoutMs);
    try{
      const aborted=new Promise<never>((_,rej)=>ctrl.signal.addEventListener('abort',()=>rej(new Error('provider timeout'))));
      const res=await Promise.race([opts.transport({url:'https://api.meta.ai/v1/chat/completions',method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${opts.apiKey}`},body:JSON.stringify({model:opts.model,messages,temperature:0.2,max_tokens:900,...(withTools?{tools:TOOL_DEFS.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:{type:'object',properties:{}}}}))}:{})}),signal:ctrl.signal}),aborted]);
      const text=await res.text(); if(!res.ok) throw new Error('provider '+res.status);
      return JSON.parse(text);
    } finally{ clearTimeout(timer); }
  };
  const messages:any[]=[{role:'system',content:opts.system},{role:'user',content:opts.user}];
  for(let round=0; round<2; round++){
    const data=await call(messages,true); const msg=data?.choices?.[0]?.message; if(!msg) throw new Error('no provider message');
    messages.push(msg);
    const calls=Array.isArray(msg.tool_calls)?msg.tool_calls.slice(0,8):[];
    if(!calls.length){ return finish(msg,retrieved,toolsUsed,requests); }
    for(const tc of calls){
      const name=tc?.function?.name; let argsOk=true; try{ if(tc?.function?.arguments) JSON.parse(tc.function.arguments); }catch{ argsOk=false; }
      if(executed>=6 || !TOOL_DEFS.some(t=>t.name===name) || !argsOk){
        messages.push({role:'tool',tool_call_id:tc?.id||'invalid',content:JSON.stringify({error:!argsOk?'invalid arguments':executed>=6?'tool budget exhausted':'unknown tool refused'})}); continue;
      }
      executed++; toolsUsed.push(name);
      const out=await opts.execTool(name); out.records.forEach(r=>retrieved.add(r.id));
      messages.push({role:'tool',tool_call_id:tc.id,content:JSON.stringify(out.payload).slice(0,7000)});
    }
  }
  // Retrieval budget ended: bounded final synthesis with no tools offered.
  messages.push({role:'user',content:'Retrieval budget ended. Answer now with only the final JSON object, citing only evidence IDs already retrieved.'});
  const data=await call(messages,false); const msg=data?.choices?.[0]?.message; if(!msg) throw new Error('no final provider message');
  return finish(msg,retrieved,toolsUsed,requests);
}
function finish(msg:any,retrieved:Set<string>,toolsUsed:string[],requests:number):ProviderResult{
  const txt=typeof msg?.content==='string'?msg.content:''; const start=txt.indexOf('{'), end=txt.lastIndexOf('}');
  if(start<0||end<start) throw new Error('malformed final output');
  const v=validateInvestigation(JSON.parse(txt.slice(start,end+1)),retrieved);
  if(!v.ok) throw new Error(v.error);
  return {investigation:v.data,toolsUsed,retrievedIds:[...retrieved],providerRequests:requests};
}
export const SIM_VERSION='sim-v2';
