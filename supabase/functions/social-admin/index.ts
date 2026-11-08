// Direct Instagram API. No publishing/inbox intermediary. All privileged data stays server-side.
const ORIGIN = 'https://unio.today';
const PATH = '/functions/v1/social-admin';
const env = (name) => Deno.env.get(name) || '';
const base = () => env('SUPABASE_URL');
const service = () => env('SUPABASE_SERVICE_ROLE_KEY');
const enc = new TextEncoder();
const now = () => new Date().toISOString();
const eq = (x) => encodeURIComponent(String(x));
const hex = (b) => [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
const hash = async x => hex(await crypto.subtle.digest('SHA-256',enc.encode(x)));
function fail(message, status=400) { throw Object.assign(new Error(message),{status}); }
async function request(url, init={}) {
 const r=await fetch(url,{...init,signal:AbortSignal.timeout(18000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok) throw Object.assign(new Error('Upstream service rejected the request'), {upstream:data,status:502});
 return data;
}
async function db(table, method='GET', body, query='') {
 return request(`${base()}/rest/v1/${table}${query?'?'+query:''}`,{method,headers:{apikey:service(),Authorization:`Bearer ${service()}`,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
async function audit(actor,action,details={}) { await db('social_audit','POST',{actor,action,details}); }
async function secret(id) { return (await db('social_secrets','GET',undefined,`id=eq.${eq(id)}&select=value`))[0]?.value; }
async function saveSecret(id,value) {
 const existing=await secret(id);
 return db('social_secrets',existing?'PATCH':'POST',existing?{value,updated_at:now()}:{id,value},existing?`id=eq.${eq(id)}`:'');
}
async function aesKey() {
 const raw=await crypto.subtle.digest('SHA-256',enc.encode('unio-social-v1:'+ (env('UNIO_SOCIAL_ENCRYPTION_KEY')||service())));
 return crypto.subtle.importKey('raw',raw,'AES-GCM',false,['encrypt','decrypt']);
}
export async function seal(value) {
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const bytes=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await aesKey(),enc.encode(JSON.stringify(value))));
 return btoa(String.fromCharCode(...iv,...bytes));
}
export async function unseal(value) {
 const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
 return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await aesKey(),bytes.slice(12))));
}
async function app() { const v=await secret('meta-app'); if(!v)fail('Complete Meta app setup first',409); return unseal(v.cipher); }
async function settings() { return (await db('social_settings'))[0]; }
async function owner(req) {
 const auth=req.headers.get('authorization')||'';
 if(!auth.startsWith('Bearer ')||auth===`Bearer ${service()}`)fail('Sign in required',401);
 const r=await fetch(`${base()}/auth/v1/user`,{headers:{apikey:service(),Authorization:auth},signal:AbortSignal.timeout(10000)});
 if(!r.ok)fail('Session expired. Sign in again.',401);
 const user=await r.json();
 if(!user.email_confirmed_at||!user.email)fail('Verified owner login required',403);
 const allowed=await db('social_admins','GET',undefined,`email=eq.${eq(user.email.toLowerCase())}&select=email`);
 if(!allowed.length)fail('Owner access required',403);
 return user.email.toLowerCase();
}
async function account(id) { const a=(await db('social_accounts','GET',undefined,`id=eq.${eq(id)}`))[0];if(!a)fail('Connect this Instagram account first',409);if(Date.parse(a.expires_at)<=Date.now())fail('Instagram access expired. Reconnect the account.',409);return a; }
async function graph(a,path,method='GET',body) {
 const cfg=await app(); const token=await unseal(a.token_cipher);
 const url=new URL(`https://graph.instagram.com/${cfg.version}/${path}`);
 const r=await fetch(url,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(18000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(new Error(`Instagram request failed${data.error?.code?' (code '+data.error.code+')':''}. Check permissions or reconnect.`),{status:502});
 return data;
}
export function validatePost(body) {
 if(!body.account_id||typeof body.caption!=='string'||!body.caption.trim()||body.caption.length>2200)fail('Choose an account and a caption of 1–2,200 characters');
 let u;try{u=new URL(body.image_url)}catch{fail('Use a public HTTPS JPEG image URL')}
 // Only UNIO's own approved media locations; the function never fetches arbitrary admin-supplied URLs.
 if(u.protocol!=='https:'||(u.hostname!=='unio.today'&&!u.hostname.endsWith('.public.blob.vercel-storage.com'))||u.username||u.password||u.port)fail('Use a public JPEG hosted by UNIO or its Blob store');
 if(!/\.jpe?g$/i.test(u.pathname))fail('Instagram photo publishing requires a JPEG URL');
 if(body.scheduled_at&&(!Number.isFinite(Date.parse(body.scheduled_at))||Date.parse(body.scheduled_at)<Date.now()+60000))fail('Choose a schedule at least one minute in the future');
 return {account_id:String(body.account_id),caption:body.caption.trim(),image_url:u.href,scheduled_at:body.scheduled_at?new Date(body.scheduled_at).toISOString():null,status:body.scheduled_at?'scheduled':'draft'};
}
export function suggestedReply(text) {
 const t=text.toLowerCase().trim();
 if(/complaint|refund|lawyer|invest|guarantee|payout|payment|scam|angry|hate|lost|privacy|delete|unsubscribe|queja|reembolso|invers|garant|estafa|datos|borrar|denuncia/.test(t))return null;
 const es=/\b(qué|cómo|dónde|unirme|registrarme|funciona|unio es|es unio)\b/.test(t)||/[¿]/.test(t);
 if(/^(what is unio\??|tell me about unio\.?|¿?qu[eé] es unio\??)$/i.test(t))return es?'UNIO es una iniciativa en desarrollo para crear un negocio que comparta su éxito con clientes y trabajadores. Más información: https://unio.today/es.html':'UNIO is an initiative in development to build a business that shares its success with customers and workers. Learn more: https://unio.today/about.html';
 if(/^(how (can|do) i (join|register)\??|where (can|do) i (join|register)\??|¿?c[oó]mo (puedo )?(registrarme|unirme)\??)$/i.test(t))return es?'Puedes registrar tu interés en https://unio.today/es.html. No crea una membresía ni un derecho a beneficios.':'You can register your interest at https://unio.today/#register. This does not create membership or a right to profits.';
 if(/^(is unio (live|operating|open)( yet)?\??|¿?unio (ya )?funciona\??)$/i.test(t))return es?'UNIO está en desarrollo. Los servicios y el reparto de beneficios todavía no están operativos.':'UNIO is in development. Services and profit-sharing arrangements are not yet operating.';
 return null;
}
async function inboxInsert(item) {
 // Unique keys make webhook redelivery and manual synchronization idempotent.
 const r=await fetch(`${base()}/rest/v1/social_inbox?on_conflict=id`,{method:'POST',headers:{apikey:service(),Authorization:`Bearer ${service()}`,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(item),signal:AbortSignal.timeout(10000)});
 if(!r.ok)fail('Could not store inbox event',503);
}
async function webhook(req) {
 const cfg=await app();
 if(req.method==='GET') {
  const q=new URL(req.url).searchParams;
  if(q.get('hub.mode')==='subscribe'&&q.get('hub.verify_token')===cfg.verify_token)return new Response(q.get('hub.challenge')||'',{headers:{'Content-Type':'text/plain'}});
  fail('Webhook verification failed',403);
 }
 const raw=await req.text(); if(enc.encode(raw).length>1048576)fail('Webhook too large',413);
 const key=await crypto.subtle.importKey('raw',enc.encode(cfg.secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
 const sig=req.headers.get('x-hub-signature-256')||'';if(!/^sha256=[a-f0-9]{64}$/.test(sig))fail('Invalid webhook signature',401);
 const sigBytes=Uint8Array.from(sig.slice(7).match(/../g),h=>parseInt(h,16));
 if(!await crypto.subtle.verify('HMAC',key,sigBytes,enc.encode(raw)))fail('Invalid webhook signature',401);
 const data=JSON.parse(raw);if(data.object!=='instagram')return json({ok:true});
 for(const entry of (data.entry||[]).slice(0,50)) {
  if(!(await db('social_accounts','GET',undefined,`id=eq.${eq(entry.id)}&select=id`)).length)continue;
  for(const change of (entry.changes||[]).slice(0,100)) {
   const v=change.value;if(!['comments','live_comments'].includes(change.field)||!v?.id||!v.text||!v.from?.id||String(v.from.id)===String(entry.id))continue;
   await inboxInsert({id:`${entry.id}:comment:${v.id}`,account_id:String(entry.id),kind:'comment',external_id:String(v.id),sender_id:String(v.from.id),sender_name:v.from.username||null,text:String(v.text).slice(0,10000),received_at:new Date(Number(entry.time)<1e12?entry.time*1000:entry.time).toISOString()});
  }
  for(const m of (entry.messaging||[]).slice(0,100)) {
   if(!m.message?.mid||!m.message?.text||m.message.is_echo||String(m.sender?.id)===String(entry.id))continue;
   await inboxInsert({id:`${entry.id}:message:${m.message.mid}`,account_id:String(entry.id),kind:'message',external_id:m.message.mid,sender_id:String(m.sender.id),sender_name:null,text:String(m.message.text).slice(0,10000),received_at:new Date(m.timestamp).toISOString()});
  }
 }
 return json({ok:true});
}
async function sendReply(itemId,text,actor) {
 if(typeof text!=='string'||!text.trim()||text.length>1000)fail('Reply must contain 1–1,000 characters');
 const s=await settings();if(s.paused)fail('Automation is paused. Resume operations first.',409);
 const item=(await db('social_inbox','GET',undefined,`id=eq.${eq(itemId)}`))[0];if(!item)fail('Conversation not found',404);
 const a=await account(item.account_id);
 if(item.kind==='message'&&Date.now()-Date.parse(item.received_at)>23*3600000)fail('This message is outside the supported reply window. Reply in Instagram.',409);
 const claimed=await db('rpc/social_claim_reply','POST',{item_id:itemId});if(!claimed.length)fail('This item has already been handled or needs review',409);
 try {
  await db('social_inbox','PATCH',{reply:text,updated_at:now()},`id=eq.${eq(itemId)}&status=eq.replying`);
  const result= item.kind==='comment'?await graph(a,`${eq(item.external_id)}/replies`,'POST',{message:text}):await graph(a,`${eq(a.id)}/messages`,'POST',{recipient:{id:item.sender_id},message:{text}});
  await db('social_inbox','PATCH',{status:'replied',reply:text,sent_id:String(result.id||result.message_id||''),updated_at:now()},`id=eq.${eq(itemId)}`);
  await audit(actor,'reply_sent',{item_id:itemId,kind:item.kind});return result;
 }catch(e){await db('social_inbox','PATCH',{status:'needs_review',reply:text,updated_at:now()},`id=eq.${eq(itemId)}`);throw e;}
}
async function syncInbox(id,actor) {
 const a=await account(id);let count=0;
 const media=await graph(a,`${eq(a.id)}/media?fields=id&limit=10`);
 for(const p of media.data||[]) {
  const comments=await graph(a,`${eq(p.id)}/comments?fields=id,text,from,timestamp&limit=50`);
  for(const c of comments.data||[])if(c.from?.id&&String(c.from.id)!==a.id){await inboxInsert({id:`${a.id}:comment:${c.id}`,account_id:a.id,kind:'comment',external_id:c.id,sender_id:String(c.from.id),sender_name:c.from.username||null,text:c.text||'',received_at:c.timestamp});count++;}
 }
 const conversations=await graph(a,`${eq(a.id)}/conversations?platform=instagram&fields=id&limit=20`);
 for(const c of conversations.data||[]) {
  const messages=await graph(a,`${eq(c.id)}/messages?fields=id,message,from,created_time&limit=20`);
  for(const m of messages.data||[])if(m.from?.id&&String(m.from.id)!==a.id&&m.message){await inboxInsert({id:`${a.id}:message:${m.id}`,account_id:a.id,kind:'message',external_id:m.id,sender_id:String(m.from.id),sender_name:m.from.username||null,text:m.message,received_at:m.created_time});count++;}
 }
 await audit(actor,'inbox_synced',{account_id:id,items_seen:count});return {items_seen:count};
}
async function worker(actor) {
 const lease=await db('rpc/social_claim_worker','POST',{});if(!lease.length)return {busy:true};
 try {
  const started=Date.now();
  const deadline=()=>Date.now()-started>80000;
  await db('social_oauth','DELETE',undefined,`expires_at=lt.${eq(new Date(Date.now()-86400000).toISOString())}`);
  await db('social_inbox','DELETE',undefined,`received_at=lt.${eq(new Date(Date.now()-90*86400000).toISOString())}`);
  await db('social_audit','DELETE',undefined,`created_at=lt.${eq(new Date(Date.now()-180*86400000).toISOString())}`);
  await db('social_secrets','DELETE',undefined,`id=like.otp:*&updated_at=lt.${eq(new Date(Date.now()-86400000).toISOString())}`);
  const s=await settings();if(s.paused)return {paused:true};
  // Renew long-lived account access before expiry. Tokens are never returned to clients.
  const expiring=await db('social_accounts','GET',undefined,`expires_at=lt.${eq(new Date(Date.now()+7*86400000).toISOString())}&expires_at=gt.${eq(now())}&limit=2`);
  for(const a of expiring){
   if(deadline())break;
   try{const u=new URL('https://graph.instagram.com/refresh_access_token');u.search=new URLSearchParams({grant_type:'ig_refresh_token',access_token:await unseal(a.token_cipher)}).toString();const refreshed=await request(u);if(!refreshed.access_token||!refreshed.expires_in)fail('Token refresh failed',502);await db('social_accounts','PATCH',{token_cipher:await seal(refreshed.access_token),expires_at:new Date(Date.now()+refreshed.expires_in*1000).toISOString()},`id=eq.${eq(a.id)}`);await audit(actor,'account_access_renewed',{account_id:a.id});}catch{await audit(actor,'account_reconnection_needed',{account_id:a.id});}
  }
  let posts=0,replies=0;
  // Queue one item per account per UTC day from the owner's approved library.
  // Each library item has a 30-day reuse cooldown. No model or external content service is required.
  if(s.auto_create&&new Date().getUTCHours()>=s.daily_hour){
   const day=new Date();day.setUTCHours(0,0,0,0);const tomorrow=new Date(day.getTime()+86400000);
   const accounts=await db('social_accounts','GET',undefined,'select=id,language&limit=10');
   for(const a of accounts){
    if(deadline()||(await settings()).paused)break;
    const queued=await db('social_posts','GET',undefined,`account_id=eq.${eq(a.id)}&scheduled_at=gte.${eq(day.toISOString())}&scheduled_at=lt.${eq(tomorrow.toISOString())}&status=in.(scheduled,publishing,published,needs_review)&select=id&limit=1`);if(queued.length)continue;
    const available=await db('social_library','GET',undefined,`enabled=eq.true&language=eq.${eq(a.language)}&or=(used_at.is.null,used_at.lt.${eq(new Date(Date.now()-30*86400000).toISOString())})&order=used_at.asc.nullsfirst,created_at.asc&limit=1`);if(!available.length)continue;
    const item=available[0];
    const created=await db('social_posts','POST',{account_id:a.id,caption:item.caption,image_url:item.image_url,scheduled_at:new Date(Date.now()+60000).toISOString(),status:'scheduled'});
    await db('social_library','PATCH',{used_at:now()},`id=eq.${eq(item.id)}`);await audit(actor,'approved_content_queued',{post_id:created[0].id,library_id:item.id,account_id:a.id});
   }
  }
  // A function timeout never causes a blind second send.
  const stale=new Date(Date.now()-10*60000).toISOString();
  await db('social_inbox','PATCH',{status:'needs_review',updated_at:now()},`status=eq.replying&updated_at=lt.${eq(stale)}`);
  if(s.auto_publish) {
   const day=new Date();day.setUTCHours(0,0,0,0);
   const published=await db('social_posts','GET',undefined,`status=eq.published&updated_at=gte.${eq(day.toISOString())}&select=id`);
   const due=await db('social_posts','GET',undefined,`or=(and(status.eq.scheduled,scheduled_at.lte.${eq(now())}),status.eq.publishing)&order=scheduled_at.asc&limit=2`);
   for(let p of due) {
    if(deadline()||published.length+posts>=s.daily_post_limit)break;
    if((await settings()).paused)break;
    if(p.status==='scheduled'){const rows=await db('rpc/social_claim_post','POST',{post_id:p.id});if(!rows.length)continue;p=rows[0];}
    try {
     const a=await account(p.account_id);
     if(!p.container_id) {
      // Only a newly claimed record may create a container. A stale claim requires operator review.
      if(Date.now()-Date.parse(p.updated_at)>120000){await db('social_posts','PATCH',{status:'needs_review',last_error:'Interrupted before container ID was saved. Review Instagram before scheduling again.',updated_at:now()},`id=eq.${p.id}`);continue;}
      const created=await graph(a,`${eq(a.id)}/media`,'POST',{image_url:p.image_url,caption:p.caption});
      await db('social_posts','PATCH',{container_id:created.id,updated_at:now()},`id=eq.${p.id}`);continue;
     }
     const container=await graph(a,`${eq(p.container_id)}?fields=status_code`);
     if(container.status_code==='IN_PROGRESS'){if(Date.now()-Date.parse(p.updated_at)>30*60000)fail('Media processing exceeded 30 minutes');continue;}
     if(container.status_code!=='FINISHED')fail('Instagram media is not ready. Review before retrying.',409);
     // Mark the side-effect boundary before sending. If this process dies, later runs do not publish again.
     await db('social_posts','PATCH',{status:'needs_review',last_error:'Publication in progress; verify outcome before retrying.',updated_at:now()},`id=eq.${p.id}`);
     const result=await graph(a,`${eq(a.id)}/media_publish`,'POST',{creation_id:p.container_id});
     await db('social_posts','PATCH',{status:'published',media_id:result.id,last_error:null,updated_at:now()},`id=eq.${p.id}`);posts++;
     await audit(actor,'post_published',{post_id:p.id,media_id:result.id});
    }catch(e){await db('social_posts','PATCH',{status:'needs_review',last_error:e.message,updated_at:now()},`id=eq.${p.id}`);await audit(actor,'post_needs_review',{post_id:p.id});}
   }
  }
  if(s.auto_reply) {
   const items=await db('social_inbox','GET',undefined,`status=eq.open&received_at=gte.${eq(new Date(Date.now()-23*3600000).toISOString())}&order=received_at.desc&limit=5`);
   for(const item of items) {
    if(deadline()||(await settings()).paused)break;
    const reply=suggestedReply(item.text);
    if(!reply){await db('social_inbox','PATCH',{status:'needs_review',updated_at:now()},`id=eq.${eq(item.id)}&status=eq.open`);continue;}
    try{await sendReply(item.id,reply,actor);replies++;}catch{await audit(actor,'reply_needs_review',{item_id:item.id});}
   }
  }
  return {posts_published:posts,replies_sent:replies};
 }finally{await db('social_worker_lock','PATCH',{until_at:now()},'id=eq.true');}
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin'}})}
export async function handle(req) {
 try {
  const url=new URL(req.url);const route=url.pathname.split('/').filter(Boolean).at(-1)||'';
  if(req.method==='OPTIONS')return json({ok:true});
  if(req.method==='POST'&&req.headers.get('origin')&&req.headers.get('origin')!==ORIGIN)fail('Origin not allowed',403);
  if(route==='webhook'&&['GET','POST'].includes(req.method))return await webhook(req);
  if(route==='callback'&&req.method==='GET') {
   const state=url.searchParams.get('state')||'';if(state.length<32)fail('Invalid connection state',403);
   const rows=await db('social_oauth','PATCH',{used_at:now()},`id=eq.${await hash(state)}&used_at=is.null&expires_at=gt.${eq(now())}`);if(!rows.length)fail('Connection link expired or already used',403);
   if(url.searchParams.has('error'))return Response.redirect(ORIGIN+'/admin.html?instagram=cancelled',303);
   const cfg=await app();const code=url.searchParams.get('code');if(!code)fail('Instagram did not supply a connection code');
   const form=new URLSearchParams({client_id:cfg.id,client_secret:cfg.secret,grant_type:'authorization_code',redirect_uri:base()+PATH+'/callback',code});
   const short=await request('https://api.instagram.com/oauth/access_token',{method:'POST',body:form});
   const exchange=new URL('https://graph.instagram.com/access_token');exchange.search=new URLSearchParams({grant_type:'ig_exchange_token',client_secret:cfg.secret,access_token:short.access_token}).toString();
   const long=await request(exchange);const profile=await request(`https://graph.instagram.com/${cfg.version}/me?fields=user_id,username`,{headers:{Authorization:`Bearer ${long.access_token}`}});
   const id=String(profile.user_id||short.user_id);if(!/^\d+$/.test(id))fail('Invalid Instagram account',502);
   const record={id,username:profile.username,token_cipher:await seal(long.access_token),expires_at:new Date(Date.now()+long.expires_in*1000).toISOString()};
   const existing=await db('social_accounts','GET',undefined,`id=eq.${id}&select=id`);await db('social_accounts',existing.length?'PATCH':'POST',record,existing.length?`id=eq.${id}`:'');
   // Subscribe this account to signed inbox notifications.
   let subscribed=true;try{await graph(record,`${id}/subscribed_apps`,'POST',{subscribed_fields:'comments,messages'});}catch{subscribed=false;}
   await audit(rows[0].actor,'account_connected',{account_id:id,webhook_subscription:subscribed});
   return Response.redirect(ORIGIN+'/admin.html?instagram='+ (subscribed?'connected':'subscription-needed'),303);
  }
  if(route==='worker'&&req.method==='POST') {
   const token=req.headers.get('authorization')?.replace('Bearer ','');const stored=await secret('worker');
   if(!stored||!token||await hash(token)!==stored.hash)fail('Unauthorized',401);
   const result=await worker('scheduler');await saveSecret('worker-heartbeat',{at:now(),...result});return json(result);
  }
  if(route==='request-code'&&req.method==='POST') {
   const b=await req.json();const email=String(b.email||'').trim().toLowerCase();
   const admins=await db('social_admins','GET',undefined,`email=eq.${eq(email)}&select=email`);
   if(admins.length){
    let allowed=false;
    try{await db('social_secrets','POST',{id:'otp:'+await hash(email)+':'+Math.floor(Date.now()/60000),value:{}});allowed=true;}catch{}
    if(allowed)await request(`${base()}/auth/v1/otp?redirect_to=${eq(ORIGIN+'/admin.html')}`,{method:'POST',headers:{apikey:service(),'Content-Type':'application/json'},body:JSON.stringify({email,create_user:true})});
   }
   return json({ok:true,message:'If this email has owner access, a sign-in email has been requested.'});
  }
  const actor=await owner(req);
  if(route==='authorize'&&req.method==='GET')return json({ok:true,actor});
  if(route==='state'&&req.method==='GET') {
   const [s,accounts,posts,inbox,log,configured,library,heartbeat]=await Promise.all([settings(),db('social_accounts','GET',undefined,'select=id,username,expires_at,language&order=created_at'),db('social_posts','GET',undefined,'order=created_at.desc&limit=100'),db('social_inbox','GET',undefined,'order=received_at.desc&limit=100'),db('social_audit','GET',undefined,'order=created_at.desc&limit=50'),secret('meta-app'),db('social_library','GET',undefined,'order=created_at.desc&limit=100'),secret('worker-heartbeat')]);
   return json({settings:s,accounts,posts,inbox,audit:log,library,heartbeat:heartbeat?{at:heartbeat.at,paused:heartbeat.paused,busy:heartbeat.busy,posts_published:heartbeat.posts_published,replies_sent:heartbeat.replies_sent}:null,app_configured:!!configured,actor,callback_url:base()+PATH+'/callback',webhook_url:base()+PATH+'/webhook'});
  }
  if(req.method!=='POST')fail('Method not allowed',405);
  if(Number(req.headers.get('content-length')||0)>32000)fail('Request too large',413);
  const b=await req.json();
  if(route==='setup') {
   if(!/^\d{5,40}$/.test(b.app_id)||typeof b.app_secret!=='string'||b.app_secret.length<16||!/^v\d{2}\.0$/.test(b.version)||typeof b.verify_token!=='string'||b.verify_token.length<24)fail('Enter the Instagram App ID, app secret, Graph API version and a verification token of at least 24 characters');
   await saveSecret('meta-app',{cipher:await seal({id:b.app_id,secret:b.app_secret,version:b.version,verify_token:b.verify_token})});
   await audit(actor,'meta_app_configured');return json({ok:true});
  }
  if(route==='connect') {
   const cfg=await app();const state=hex(crypto.getRandomValues(new Uint8Array(32)));await db('social_oauth','POST',{id:await hash(state),actor,expires_at:new Date(Date.now()+600000).toISOString()});
   const u=new URL('https://www.instagram.com/oauth/authorize');u.search=new URLSearchParams({enable_fb_login:'0',force_authentication:'1',client_id:cfg.id,redirect_uri:base()+PATH+'/callback',response_type:'code',scope:'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_comments,instagram_business_manage_messages',state}).toString();return json({url:u.href});
  }
  if(route==='settings') {
   if(typeof b.paused!=='boolean'||typeof b.auto_publish!=='boolean'||typeof b.auto_reply!=='boolean'||typeof b.auto_create!=='boolean'||!Number.isInteger(b.daily_hour)||b.daily_hour<0||b.daily_hour>23||!Number.isInteger(b.daily_post_limit)||b.daily_post_limit<1||b.daily_post_limit>10)fail('Invalid automation settings');
   if(!b.paused&&!(await db('social_accounts','GET',undefined,'select=id&limit=1')).length)fail('Connect Instagram before resuming operations',409);
   await db('social_settings','PATCH',{paused:b.paused,auto_publish:b.auto_publish,auto_reply:b.auto_reply,auto_create:b.auto_create,daily_hour:b.daily_hour,daily_post_limit:b.daily_post_limit,updated_at:now()},'id=eq.true');await audit(actor,'settings_changed',{paused:b.paused,auto_publish:b.auto_publish,auto_reply:b.auto_reply});return json({ok:true});
  }
  if(route==='library') {const validated=validatePost({account_id:'library',caption:b.caption,image_url:b.image_url});if(!['en','es'].includes(b.language))fail('Choose English or Spanish');const rows=await db('social_library','POST',{language:b.language,caption:validated.caption,image_url:validated.image_url});await audit(actor,'content_library_added',{library_id:rows[0].id});return json({ok:true});}
  if(route==='library-toggle') {if(typeof b.enabled!=='boolean')fail('Invalid library setting');await db('social_library','PATCH',{enabled:b.enabled},`id=eq.${eq(b.id)}`);await audit(actor,'content_library_changed',{library_id:b.id,enabled:b.enabled});return json({ok:true});}
  if(route==='account-language') {if(!['en','es'].includes(b.language))fail('Invalid account language');await db('social_accounts','PATCH',{language:b.language},`id=eq.${eq(b.account_id)}`);await audit(actor,'account_language_changed',{account_id:b.account_id,language:b.language});return json({ok:true});}
  if(route==='post') {const post=validatePost(b);await account(post.account_id);const result=await db('social_posts',b.id?'PATCH':'POST',{...post,updated_at:now()},b.id?`id=eq.${eq(b.id)}&status=eq.draft`:'');if(!result.length)fail('Only drafts can be edited',409);await audit(actor,b.id?'post_updated':'post_created',{post_id:result[0].id,status:post.status});return json({ok:true});}
  if(route==='cancel-post') {const rows=await db('social_posts','PATCH',{status:'draft',scheduled_at:null,updated_at:now()},`id=eq.${eq(b.id)}&status=eq.scheduled`);if(!rows.length)fail('Only scheduled posts can be cancelled',409);await audit(actor,'post_unscheduled',{post_id:b.id});return json({ok:true});}
  if(route==='reply')return json(await sendReply(b.id,b.text,actor));
  if(route==='reopen') {const rows=await db('social_inbox','PATCH',{status:'open',updated_at:now()},`id=eq.${eq(b.id)}&status=eq.needs_review&reply=is.null&sent_id=is.null`);if(!rows.length)fail('Check uncertain delivery directly in Instagram. This item cannot be reopened.',409);await audit(actor,'conversation_reviewed',{item_id:b.id});return json({ok:true});}
  if(route==='disconnect') {await db('social_inbox','DELETE',undefined,`account_id=eq.${eq(b.account_id)}`);await db('social_posts','DELETE',undefined,`account_id=eq.${eq(b.account_id)}`);await db('social_accounts','DELETE',undefined,`id=eq.${eq(b.account_id)}`);await audit(actor,'account_disconnected',{account_id:b.account_id});return json({ok:true});}
  if(route==='dismiss') {await db('social_inbox','PATCH',{status:'dismissed',updated_at:now()},`id=eq.${eq(b.id)}&status=in.(open,needs_review)`);await audit(actor,'inbox_dismissed',{item_id:b.id});return json({ok:true});}
  if(route==='sync')return json(await syncInbox(b.account_id,actor));
  if(route==='run') {await audit(actor,'worker_requested');return json(await worker(actor));}
  fail('Not found',404);
 }catch(e){console.error('social-admin operation failed',{status:e.status||500});return json({error:e.status?e.message:'Operation failed. Check the connection and try again.'},e.status||500);}
}
if(typeof Deno!=='undefined'&&typeof Deno.serve==='function')Deno.serve(handle);
