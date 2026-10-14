// Shared authenticated session header for the original PriceYar design.
(async()=>{const b=document.querySelector('#demoLoginBtn');if(!b)return;
const config=window.GHEIMATYAR_SUPABASE;
if(!window.supabase||!config?.url||!config?.key){b.onclick=()=>location.assign('./live.html');return;}
const sb=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
async function update(){const {data:{user}}=await sb.auth.getUser();if(!user){b.innerHTML='<span>ورود / عضویت</span>';b.onclick=()=>location.assign('./live.html');return;}
const {data:p}=await sb.from('market_profiles').select('display_name,role').eq('id',user.id).maybeSingle();
const name=p?.display_name||user.email?.split('@')[0]||'حساب من';
b.textContent='سلام، '+name;b.title='پنل واقعی قیمت‌یار';b.onclick=()=>location.assign('./live.html');
const strip=document.querySelector('.demo-strip');if(strip){let x=document.querySelector('#realSessionBadge');if(!x){x=document.createElement('a');x.id='realSessionBadge';x.href='./live.html';x.style='color:#fff;font-weight:800;text-decoration:underline;margin-inline-start:9px';strip.append(x);}x.textContent='حساب شما فعال است — ورود به پنل واقعی';}}
sb.auth.onAuthStateChange(()=>setTimeout(update,0));await update();
})();