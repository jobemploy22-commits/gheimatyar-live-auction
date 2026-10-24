(()=>{
'use strict';
const $=s=>document.querySelector(s);
const state={client:null,user:null,profile:null,requests:[],mode:'all',signup:true,channel:null,recovery:false};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fa=n=>Number(n).toLocaleString('fa-IR');
function friendlyError(err){
 const code=err?.code||'',raw=String(err?.message||err||'');
 if(code==='email_not_confirmed'||/email not confirmed/i.test(raw))return 'حساب شما ساخته شده ولی ایمیل هنوز تأیید نشده. صندوق ورودی و پوشه Spam را بررسی کنید؛ سپس از بخش «ورود» استفاده کنید.';
 if(code==='over_email_send_rate_limit'||/only request this after|rate limit/i.test(raw))return 'درخواست ایمیل زیاد بوده است. کمی صبر کنید و دوباره درخواست ارسال بدهید.';
 if(/already registered/i.test(raw))return 'این ایمیل قبلاً ثبت شده است. از بخش «ورود» استفاده کنید.';
 if(/invalid login credentials/i.test(raw))return 'ایمیل یا رمز عبور صحیح نیست، یا حساب هنوز تأیید نشده است.';
 return raw;
}
function message(t,bad=false){$('#message').textContent=t;$('#message').className='live-alert '+(bad?'live-error':'live-success');}
// Signup/login tabs work even when the external Supabase library fails to load.
function setAuthMode(signup){
 state.signup=signup;
 $('#tabLogin').classList.toggle('active',!signup);
 $('#tabSignup').classList.toggle('active',signup);
 $('#extraSignup').classList.toggle('live-hidden',!signup);
 $('#authSubmit').textContent=signup?'ساخت حساب':'ورود';
}
$('#tabLogin').addEventListener('click',()=>setAuthMode(false));
$('#tabSignup').addEventListener('click',()=>setAuthMode(true));
setAuthMode(true);
const config=window.GHEIMATYAR_SUPABASE||{};
if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url||'')||!config.key||!window.supabase){
 message('زیرساخت نسخه واقعی هنوز متصل نشده است. پس از ایجاد پروژه Supabase، آدرس و کلید عمومی در supabase-config.js تنظیم می‌شود.',true);$('#authSubmit').disabled=true;return;
}
state.client=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const db=state.client;
async function getProfile(){
 if(!state.user){state.profile=null;return;}
 const {data,error}=await db.from('market_profiles').select('id,display_name,city,role').eq('id',state.user.id).single();
 if(error){message('خواندن حساب کاربری ممکن نشد: '+error.message,true);return;}
 state.profile=data;
}
async function sessionChanged(){
 const {data:{session},error}=await db.auth.getSession();
 if(error)message(error.message,true);
 state.user=session?.user||null;
 await getProfile();
 $('#authPanel').classList.toggle('live-hidden',!!state.user||state.recovery);
 $('#marketPanel').classList.toggle('live-hidden',!state.user||state.recovery);
 $('#logout').classList.toggle('live-hidden',!state.user||state.recovery);
 $('#identity').textContent=state.profile ? state.profile.display_name+' | '+(state.profile.role==='seller'?'فروشنده':'خریدار') : 'مهمان';
 $('#buyerComposer').classList.toggle('live-hidden',state.profile?.role!=='buyer');
 if(state.channel){await db.removeChannel(state.channel);state.channel=null;}
 if(state.recovery){message('رمز عبور جدید را وارد کنید.');return;}
 if(state.user){
  if(new URLSearchParams(location.search).has('afterAuth')){history.replaceState(null,'',location.pathname);message('ایمیل شما تأیید شد؛ به بازار واقعی قیمت‌یار خوش آمدید.');}
  await loadRequests();
  state.channel=db.channel('market-changes-'+state.user.id)
   .on('postgres_changes',{event:'*',schema:'public',table:'market_requests'},()=>loadRequests())
   .on('postgres_changes',{event:'INSERT',schema:'public',table:'market_offers'},()=>loadRequests())
   .subscribe();
  message('حساب متصل شد. فهرست از پایگاه داده خوانده می‌شود.');
 }else message('برای ثبت درخواست یا پیشنهاد واقعی، وارد حساب شوید.');
}
const categories={digital:'موبایل و دیجیتال',car:'خودرو',gold:'طلا',property:'ملک',construction:'مصالح ساختمانی',service:'خدمات'};
const due=x=>{const n=new Date(x).getTime()-Date.now();return n<=0?'مهلت تمام شده':Math.ceil(n/86400000)+' روز باقی مانده';};
async function loadRequests(){
 if(!state.user)return;
 let q=db.from('market_requests').select('id,buyer_id,title,category,city,description,budget,deadline,status,created_at').order('created_at',{ascending:false}).limit(80);
 if(state.mode==='mine'&&state.profile?.role==='buyer') q=q.eq('buyer_id',state.user.id);
 else q=q.eq('status','open').gt('deadline',new Date().toISOString());
 const {data,error}=await q;
 if(error){message('خطای دریافت درخواست‌ها: '+error.message,true);return;}
 state.requests=data||[];
 const list=$('#requestList');list.replaceChildren();
 if(!state.requests.length){list.textContent='فعلاً درخواستی در این بخش وجود ندارد.';return;}
 const term=($('#marketSearch')?.value||'').trim().toLocaleLowerCase('fa');
 const visible=state.requests.filter(r=>!term||[r.title,r.city,r.description,categories[r.category]].some(v=>String(v||'').toLocaleLowerCase('fa').includes(term)));
 if(!visible.length){list.textContent='درخواستی مطابق جست‌وجوی شما پیدا نشد.';return;}
 for(const r of visible){
  const card=document.createElement('article');card.className='live-card';
  card.innerHTML='<div class="live-status">'+esc(categories[r.category]||r.category)+' | '+esc(r.city)+' | '+esc(due(r.deadline))+'</div><h3>'+esc(r.title)+'</h3><p>'+esc(r.description)+'</p><p class="live-price">'+fa(r.budget)+' تومان <small class="live-muted">سقف بودجه</small></p><div class="live-actions"></div><div class="offer-area"></div>';
  const actions=card.querySelector('.live-actions');
  const btn=document.createElement('button');btn.className='live-btn live-outline';btn.textContent=state.profile?.role==='seller'?'ثبت پیشنهاد':'بررسی پیشنهادهای من';
  const owner=r.buyer_id===state.user.id;
  if(state.profile?.role==='seller'||owner){btn.addEventListener('click',()=>openOffers(r,card.querySelector('.offer-area')));actions.appendChild(btn);}
  if(owner&&r.status==='open'){
   const close=document.createElement('button');close.className='live-btn live-outline';close.textContent='بستن درخواست';
   close.onclick=async()=>{if(!confirm('این درخواست بسته شود؟'))return;const {error}=await db.rpc('market_close_request',{p_request_id:r.id});if(error)message(error.message,true);else{message('درخواست بسته شد.');loadRequests();}};actions.appendChild(close);
  }
  list.appendChild(card);
 }
}
async function openOffers(r,el){
 el.replaceChildren();
 const seller=state.profile?.role==='seller';
 const {data,error}=await db.from('market_offers').select('id,seller_id,seller_name,seller_city,price,delivery_days,notes,created_at').eq('request_id',r.id).order('price',{ascending:true});
 if(error){message('دریافت پیشنهادها ناموفق بود: '+error.message,true);return;}
 const list=document.createElement('div');
 if(!(data||[]).length){const p=document.createElement('p');p.className='live-muted';p.textContent='هنوز پیشنهادی برای این حساب قابل مشاهده نیست.';list.appendChild(p);}
 for(const o of data||[]){
  const row=document.createElement('div');row.className='live-offer';
  row.innerHTML='<strong>'+esc(o.seller_name)+'</strong> · '+esc(o.seller_city)+' <div class="live-price">'+fa(o.price)+' تومان</div><span class="live-muted">تحویل: '+fa(o.delivery_days)+' روز · '+esc(o.notes)+'</span>';
  list.appendChild(row);
 }
 el.appendChild(list);
 if(seller&&r.status==='open'&&new Date(r.deadline)>new Date()){
  if((data||[]).some(x=>x.seller_id===state.user.id)){const p=document.createElement('p');p.textContent='شما قبلاً یک پیشنهاد برای این درخواست ثبت کرده‌اید.';el.appendChild(p);return;}
  const form=document.createElement('form');form.innerHTML='<h4>پیشنهاد قیمت جدید</h4><label class="live-label">قیمت به تومان</label><input name="price" type="number" min="1000" step="1" required class="live-input"><label class="live-label">تحویل چند روزه</label><input name="days" type="number" min="0" max="180" required class="live-input"><label class="live-label">شرایط پیشنهاد</label><textarea name="notes" maxlength="750" class="live-input"></textarea><button class="live-btn">ارسال پیشنهاد</button>';
  form.onsubmit=async ev=>{ev.preventDefault();const fd=new FormData(form),price=Number(fd.get('price')),days=Number(fd.get('days'));if(!Number.isSafeInteger(price)||price<1000||price>1e15||!Number.isInteger(days)||days<0||days>180){message('قیمت یا مهلت تحویل معتبر نیست.',true);return;}
    const b=form.querySelector('button');b.disabled=true;const {error}=await db.from('market_offers').insert({request_id:r.id,seller_id:state.user.id,price,delivery_days:days,notes:String(fd.get('notes')||'').trim()});
    if(error){b.disabled=false;message('خطا در ثبت پیشنهاد: '+error.message,true);}else{message('پیشنهاد با موفقیت ثبت شد.');await openOffers(r,el);}
  };
  el.appendChild(form);
 }
}


$('#authForm').onsubmit=async ev=>{
 ev.preventDefault();const email=$('#email').value.trim(),password=$('#password').value;
 const button=$('#authSubmit');button.disabled=true;
 try{
  if(state.signup){
   const name=$('#displayName').value.trim(),city=$('#accountCity').value.trim(),role=$('#accountRole').value;
   if(name.length<2||city.length<2){message('نام و شهر را وارد کنید.',true);return;}
   const {data,error}=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname+'?afterAuth=1',data:{name,city,role}}});
   if(error)throw error;
   message(data.session?'حساب ساخته شد؛ در حال ورود به صفحه اصلی…':'ثبت‌نام انجام شد. لینک تأیید ایمیل را بررسی کنید و سپس وارد شوید.');
   if(data.session){await sessionChanged();return;}
  }else{
   const {error}=await db.auth.signInWithPassword({email,password});if(error)throw error;
   await sessionChanged();return;
  }
  await sessionChanged();
 }catch(err){message(friendlyError(err),true);}finally{button.disabled=false;}
};
const resend=document.createElement('button');resend.type='button';resend.id='resendVerification';resend.className='live-btn live-outline';resend.textContent='ارسال مجدد ایمیل تأیید';resend.style.marginTop='12px';
$('#authForm').appendChild(resend);
resend.onclick=async()=>{const email=$('#email').value.trim();if(!email){message('ابتدا ایمیل حساب را وارد کنید.',true);return;}resend.disabled=true;
try{const {error}=await db.auth.resend({type:'signup',email,options:{emailRedirectTo:location.origin+location.pathname+'?afterAuth=1'}});
if(error)throw error;message('اگر این حساب نیاز به تأیید داشته باشد، ایمیل ارسال می‌شود. صندوق ورودی و Spam را بررسی کنید.');}
catch(err){message(friendlyError(err),true);}
finally{setTimeout(()=>{resend.disabled=false;},45000);}
};
$('#logout').onclick=async()=>{const {error}=await db.auth.signOut();if(error)message(error.message,true);else await sessionChanged();};
$('#tabAll').onclick=()=>{state.mode='all';$('#tabAll').classList.add('active');$('#tabMine').classList.remove('active');loadRequests();};
$('#tabMine').onclick=()=>{state.mode='mine';$('#tabMine').classList.add('active');$('#tabAll').classList.remove('active');loadRequests();};
$('#reload').onclick=loadRequests;
$('#marketSearch').addEventListener('input',()=>loadRequests());
$('#requestForm').onsubmit=async ev=>{
 ev.preventDefault();if(state.profile?.role!=='buyer'){message('فقط خریدار می‌تواند درخواست ثبت کند.',true);return;}
 const f=new FormData(ev.currentTarget),budget=Number(f.get('budget'));if(!Number.isSafeInteger(budget)||budget<1000||budget>1e15){message('مبلغ بودجه نامعتبر است.',true);return;}
 const title=String(f.get('title')||'').trim(),description=String(f.get('description')||'').trim(),city=String(f.get('city')||'').trim();
 if(title.length<4||description.length<8||city.length<2){message('جزئیات درخواست کافی نیست.',true);return;}
 const btn=ev.currentTarget.querySelector('button');btn.disabled=true;
 const {error}=await db.from('market_requests').insert({buyer_id:state.user.id,title,category:f.get('category'),city,description,budget,deadline:new Date(Date.now()+Number(f.get('days'))*86400000).toISOString()});
 btn.disabled=false;
 if(error){message('ثبت درخواست ناموفق بود: '+error.message,true);return;}
 ev.currentTarget.reset();message('درخواست واقعی ثبت شد. فروشندگان عضو می‌توانند برای آن پیشنهاد بدهند.');await loadRequests();
};

$('#forgotPassword').onclick=async()=>{
 const email=$('#email').value.trim();
 if(!email||!$('#email').checkValidity()){message('ابتدا آدرس ایمیل حساب را به‌درستی وارد کنید.',true);$('#email').focus();return;}
 const btn=$('#forgotPassword');btn.disabled=true;
 try{
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname+'?reset=1'});
  if(error)throw error;
  message('اگر این ایمیل حساب داشته باشد، لینک تغییر رمز ارسال می‌شود. صندوق ورودی و Spam را بررسی کنید.');
 }catch(err){message(friendlyError(err),true);}
 finally{btn.disabled=false;}
};
function showRecovery(){
 state.recovery=true;
 $('#recoveryPanel').classList.remove('live-hidden');
 $('#authPanel').classList.add('live-hidden');
 $('#marketPanel').classList.add('live-hidden');
 $('#logout').classList.add('live-hidden');
 message('لینک بازیابی معتبر دریافت شد. رمز جدید را انتخاب کنید.');
}
$('#recoveryForm').onsubmit=async ev=>{
 ev.preventDefault();
 const password=$('#newPassword').value;
 if(password!==$('#confirmPassword').value){message('تکرار رمز عبور یکسان نیست.',true);return;}
 const btn=ev.currentTarget.querySelector('button');btn.disabled=true;
 try{
  const {error}=await db.auth.updateUser({password});
  if(error)throw error;
  state.recovery=false;
  $('#recoveryPanel').classList.add('live-hidden');
  history.replaceState(null,'',location.pathname);
  $('#recoveryForm').reset();
  await sessionChanged();
  message('رمز عبور با موفقیت تغییر کرد و وارد حساب شدید.');
 }catch(err){message(friendlyError(err),true);}
 finally{btn.disabled=false;}
};
db.auth.onAuthStateChange((event)=>{
 if(event==='PASSWORD_RECOVERY'){showRecovery();return;}
 setTimeout(sessionChanged,0);
});
if(new URLSearchParams(location.search).has('reset')){
 db.auth.getSession().then(({data})=>{if(data.session)showRecovery();else message('در حال بررسی لینک بازیابی رمز عبور…');});
}
sessionChanged();
})();