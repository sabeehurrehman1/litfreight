(() => {
  const cfg = window.LITFREIGHT_CONFIG || {};
  const configured = cfg.SUPABASE_URL?.startsWith('https://') && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes('PASTE_');
  const sb = configured ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const say = msg => { const el=$('#toast'); if(!el) return; el.textContent=msg; el.classList.add('show'); clearTimeout(window._litToast); window._litToast=setTimeout(()=>el.classList.remove('show'),5000); };
  window.openModal = (id, product) => { if(product && $('#quoteProductNote')) $('#quoteProductNote').textContent='Product: '+product+'. Share your contact details and requirements.'; $('#'+id)?.classList.add('show'); };
  window.closeModal = id => $('#'+id)?.classList.remove('show');
  window.toggleMenu = () => $('#navlinks')?.classList.toggle('open');
  window.showPage = () => { $('#homePage').style.display='block'; $('#dashboard')?.classList.remove('active'); window.scrollTo({top:0,behavior:'smooth'}); };
  window.showDashboard = () => say('Please sign in with an authorised LITFREIGHT account.');
  $$('.modalback').forEach(m=>m.addEventListener('click',e=>{if(e.target===m)m.classList.remove('show')}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape') $$('.modalback.show').forEach(m=>m.classList.remove('show'));});
  if(!sb) say('Website preview mode: add your Supabase URL and anon key in config.js to activate forms and live tracking.');
  const requireDb = () => { if(!sb){say('Backend is not connected yet. Complete the Supabase setup in README.md.');return false;} return true; };
  const values = form => Object.fromEntries(new FormData(form).entries());
  const controls = form => $$('input,select,textarea',form).filter(x=>x.type!=='submit' && x.type!=='button');
  const valueList = form => controls(form).map(x=>x.value.trim());

  // Search and category filters for the featured catalogue.
  window.searchProducts = () => { const q=($('#searchInput')?.value||'').toLowerCase().trim(), cat=$('#searchCategory')?.value||'all'; let count=0; $$('.product').forEach(p=>{const ok=(!q||p.textContent.toLowerCase().includes(q))&&(cat==='all'||p.dataset.category===cat);p.style.display=ok?'':'none';if(ok)count++;});if($('#noResults'))$('#noResults').style.display=count?'none':'block';$('#marketplace')?.scrollIntoView({behavior:'smooth'}); };
  window.filterCategory = cat => { if($('#searchCategory'))$('#searchCategory').value=cat; if($('#searchInput'))$('#searchInput').value=''; window.searchProducts(); };

  // Tracking: guests can track without an account. The RPC only returns public-safe fields.
  async function track(number){
    const out=$('#trackingResult'); if(out)out.innerHTML='<p class="modalnote">Checking shipment…</p>';
    if(!requireDb())return;
    const {data,error}=await sb.rpc('track_litfreight_shipment',{p_tracking_no:number.trim()});
    if(error){if(out)out.textContent='Unable to retrieve tracking at this time. Please try again later.';return;}
    const shipment=Array.isArray(data)?data[0]:data;
    if(!shipment){if(out)out.innerHTML='<p class="modalnote">No shipment was found for that reference. Please check the number and try again.</p>';return;}
    const events=shipment.events||[];
    const safe=document.createElement('div');
    const head=document.createElement('div');head.className='modalnote';head.textContent=`Reference: ${shipment.tracking_no} · Current status: ${shipment.status}`;safe.append(head);
    const route=document.createElement('p');route.textContent=[shipment.origin,shipment.destination].filter(Boolean).join(' → ');safe.append(route);
    const list=document.createElement('div');list.style.cssText='border-left:2px solid #d6ad62;margin:18px 0 8px 8px;padding-left:16px';
    events.forEach(ev=>{const item=document.createElement('div');item.style.cssText='margin:0 0 16px';const b=document.createElement('strong');b.textContent=ev.status;const d=document.createElement('div');d.style.cssText='font-size:11px;color:#68758b;margin-top:4px';d.textContent=[new Date(ev.created_at).toLocaleString(),ev.location,ev.note].filter(Boolean).join(' · ');item.append(b,d);list.append(item);});safe.append(list);if(out){out.replaceChildren(safe);}
  }
  $('#trackingFrontForm')?.addEventListener('submit',e=>{e.preventDefault();const n=$('input',e.currentTarget).value.trim();if(!n)return;$('#trackModal').classList.add('show');const inp=$('#trackingModalForm input');if(inp)inp.value=n;track(n);});
  $('#trackingModalForm')?.addEventListener('submit',e=>{e.preventDefault();track($('input',e.currentTarget).value.trim());});

  $('#requestForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!requireDb())return;const d=values(e.currentTarget);const {error}=await sb.from('buying_requests').insert({name:d.name,email:d.email,phone:d.phone,country:d.country,product:d.product,category:d.category,quantity:d.quantity||null,target_price:d.price||null,destination:d.destination||null,details:d.details||null});if(error){say('Request could not be submitted. Please try again or contact us.');return;}e.currentTarget.reset();closeModal('requestModal');say('Your buying request has been submitted for admin review. Your contact details are private.');});

  $('#freightQuoteForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!requireDb())return;const v=valueList(e.currentTarget);const [name,email,origin,destination,mode,weight,details]=v;const {error}=await sb.from('freight_quotes').insert({name,email,origin,destination,freight_mode:mode,weight,details});if(error){say('Quote request could not be submitted. Please try again.');return;}e.currentTarget.reset();closeModal('freightModal');say('Your freight quote request has been received.');});

  $('#productEnquiryForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!requireDb())return;const v=valueList(e.currentTarget);const [name,email,message]=v;const product=$('#quoteProductNote')?.textContent||'Marketplace product';const {error}=await sb.from('product_enquiries').insert({name,email,message,product_reference:product});if(error){say('Enquiry could not be sent. Please try again.');return;}e.currentTarget.reset();closeModal('quoteModal');say('Your product enquiry has been sent.');});

  $('#registerForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!requireDb())return;const v=valueList(e.currentTarget);const [full_name,business_name,email,phone,country,account_type,password]=v;const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name,business_name,phone,country,account_type}}});if(error){say(error.message);return;}closeModal('registerModal');say('Registration submitted. Check your email to verify your account.');e.currentTarget.reset();});
  $('#loginForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!requireDb())return;const [email,password]=valueList(e.currentTarget);const {error}=await sb.auth.signInWithPassword({email,password});if(error){say(error.message);return;}closeModal('loginModal');say('You are signed in. Account workspace permissions are applied by your LITFREIGHT admin.');});
  $('#sellerProductForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!requireDb())return;const {data:{user}}=await sb.auth.getUser();if(!user){say('Please log in before submitting a supplier product listing.');return;}const v=valueList(e.currentTarget);const [name,category,moq,price,description]=v;const {error}=await sb.from('products').insert({seller_id:user.id,name,category,moq,price,description,status:'pending'});if(error){say('Product listing could not be submitted. Check your seller account permissions.');return;}e.currentTarget.reset();closeModal('sellerModal');say('Product submitted for admin approval.');});
})();
