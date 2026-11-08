(() => {
 const form = document.getElementById('interest'); if (!form) return;
 const es = document.documentElement.lang.startsWith('es');
 const status = document.getElementById('formStatus');
 const words = es ? {sending:'Enviando tu interés…',ok:'Gracias. Registramos tu interés. Si autorizaste las novedades, podremos enviarte noticias de UNIO. Para consultar o retirar tus datos, escribe a hello@unio.today.',error:'No pudimos guardar tu registro. Inténtalo de nuevo o escribe a hello@unio.today.'} : {sending:'Submitting your interest…',ok:'Thank you. Your interest has been registered. If you opted into updates, we may send you UNIO news. To ask about or withdraw your details, contact hello@unio.today.',error:'Registration could not be saved. Please try again or contact hello@unio.today.'};
 const params = new URLSearchParams(location.search);
 const tagged = params.get('utm_source') === 'instagram';
 const source = tagged ? (es ? 'instagram_es' : 'instagram_en') : (es ? 'website_es' : 'website_en');
 const roles = {'Customer':'customer','Service provider':'provider','Venture builder':'builder','Partner':'partner','Supporter':'supporter'};
 form.addEventListener('submit',async event => {
  event.preventDefault(); if (!form.reportValidity()) return;
  const submit = form.querySelector('button[type=submit]'); if (submit.disabled) return;
  const role = form.querySelector('input[name=role]:checked').value;
  const data = {name:form.elements.name.value,email:form.elements.email.value,role:roles[role] || role,detail:form.elements.detail.value,updates:document.getElementById('updates').checked,consent:document.getElementById('consent').checked,website:form.elements.website.value,source,notice_version:'2026-11-08'};
  submit.disabled=true; submit.setAttribute('aria-busy','true'); status.textContent=words.sending;
  const controller = new AbortController(); const timeout=setTimeout(()=>controller.abort(),20000);
  try {
   const res=await fetch('https://zqllqmjcjozjphixcmvn.supabase.co/functions/v1/register-interest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
   const result=await res.json(); if(!res.ok || !result.ok) throw new Error('Unable to save');
   status.textContent=words.ok; form.reset();
  } catch { status.textContent=words.error; }
  finally {clearTimeout(timeout);submit.disabled=false;submit.removeAttribute('aria-busy');}
 });
})();
