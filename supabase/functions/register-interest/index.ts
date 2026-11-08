import { createClient } from "npm:@supabase/supabase-js@2.57.0";
const sources = new Set(['landing','website_en','website_es','instagram_en','instagram_es']);
const allowedOrigins = new Set(['https://unio.today','https://www.unio.today','https://unio-website-iota.vercel.app']);
Deno.serve(async (req) => {
 const origin=req.headers.get('origin');
 const headers: Record<string,string>={'Access-Control-Allow-Headers':'content-type, apikey, authorization','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 if(origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin']=origin;
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin && !allowedOrigins.has(origin)) return reply({error:'Origin not permitted'},403);
 if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
 if(req.method!=='POST') return reply({error:'Method not allowed'},405);
 try {
  const length=Number(req.headers.get('content-length') || 0);
  if(length>12000) return reply({error:'Request too large'},413);
  if(!req.headers.get('content-type')?.startsWith('application/json')) return reply({error:'JSON required'},415);
  // Bound the streamed body before decoding, including chunked requests.
  const reader=req.body?.getReader(); const chunks:Uint8Array[]=[]; let size=0;
  if(!reader) return reply({error:'Invalid request'},400);
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>12000){await reader.cancel();return reply({error:'Request too large'},413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const data=JSON.parse(new TextDecoder().decode(bytes));
  if(!data || typeof data!=='object' || Array.isArray(data)) return reply({error:'Invalid request'},400);
  if(typeof data.website==='string' && data.website.trim()) return reply({ok:true});
  const name=typeof data.name==='string'?data.name.trim():'';
  const email=typeof data.email==='string'?data.email.trim().toLowerCase():'';
  const role=typeof data.role==='string'?data.role.trim():'';
  const detail=typeof data.detail==='string'?data.detail.trim():'';
  if(name.length<1||name.length>120||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||detail.length>1000||!['customer','provider','builder','partner','supporter'].includes(role)||data.consent!==true||typeof data.updates!=='boolean') return reply({error:'Please check your details and consent.'},400);
  const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!secret)return reply({error:'Service not configured'},503);
  const db=createClient(url,secret,{auth:{persistSession:false}});
  const source=sources.has(data.source)?data.source:'landing';
  const notice_version=data.notice_version==='2026-11-08'?'2026-11-08':null;
  const {error}=await db.from('interest_registrations').insert({full_name:name,email,participation:role,details:detail||null,updates_opt_in:data.updates,contact_consent:true,source,notice_version});
  if(error){console.error('Registration insert failed',error.code);return reply({error:'Unable to save registration'},500);}
  return reply({ok:true});
 }catch{return reply({error:'Invalid request'},400);}
});
