
/* Gheimatyar: isolated, static, Persian RTL product prototype.
   All records are DEMO data in the visitor's localStorage; no backend, real bidding, login or payment. */
(() => {
  'use strict';
  const STORE_KEY = 'gheimatyar-auction-demo-v1';
  const CATEGORIES = {
    digital: {label:'موبایل و دیجیتال',emoji:'📱'},
    car: {label:'خودرو و موتورسیکلت',emoji:'🚙'},
    gold: {label:'طلا و سکه',emoji:'🪙'},
    property: {label:'ملک و اجاره',emoji:'🏠'},
    construction: {label:'مصالح ساختمانی',emoji:'🏗️'},
    service: {label:'خدمات تخصصی',emoji:'🛠️'}
  };
  const now = Date.now();
  const hour = 3_600_000, day = 24 * hour;
  const SEED_REQUESTS = [
    {id:'GY-1001',title:'آیفون ۱۶ پرو ۲۵۶ گیگ',category:'digital',city:'تهران',description:'پلمپ، رجیسترشده، رنگ مشکی یا تیتانیوم طبیعی؛ گارانتی معتبر و فاکتور رسمی.',budget:105_000_000,ageHours:3,durationDays:5,offers:30},
    {id:'GY-1002',title:'خودرو تویوتا کرولا کراس',category:'car',city:'تهران',description:'مدل ۲۰۲۵ یا ۲۰۲۶، کم‌کارکرد یا صفر؛ مدارک کامل و امکان کارشناسی.',budget:5_900_000_000,ageHours:7,durationDays:9,offers:12},
    {id:'GY-1003',title:'میلگرد آجدار سایز ۱۸',category:'construction',city:'تهران',description:'۲۵ تن میلگرد آجدار A3؛ قیمت در محل پروژه همراه با کرایه و زمان بارگیری.',budget:990_000_000,ageHours:10,durationDays:4,offers:8},
    {id:'GY-1004',title:'آپارتمان ۱۲۰ متری برای اجاره',category:'property',city:'تهران، سعادت‌آباد',description:'دوخوابه، پارکینگ و آسانسور، نورگیر؛ طبقه دوم به بالا.',budget:2_000_000_000,ageHours:23,durationDays:13,offers:6},
    {id:'GY-1005',title:'سکه تمام بهار آزادی',category:'gold',city:'کرج',description:'سکه بانکی معتبر با امکان استعلام و تحویل حضوری در محل امن.',budget:180_000_000,ageHours:26,durationDays:3,offers:7},
    {id:'GY-1006',title:'اجرای نازک‌کاری واحد مسکونی',category:'service',city:'تهران، منطقه ۱',description:'اجرای صفر تا صد نازک‌کاری واحد ۱۶۰ متری، ارائه رزومه و زمان‌بندی.',budget:740_000_000,ageHours:31,durationDays:7,offers:9}
  ];
  const SAMPLE_SELLERS = ['تک استور','دیجیتال پلاس','موبایل سنتر','بازار نو','مجموعه آریا','انتخاب برتر','فروشگاه سپهر','پیشگامان فروش','تجارت پارس','فروشگاه اطمینان','بازرگانی پرهام','تیم پاسارگاد','بازارستان','کیان کالا','بهینه خرید','نمایندگی البرز'];
  const $ = (s,root=document) => (typeof root === 'string' ? document.querySelector(root) : root)?.querySelector(s);
  const $$ = (s,root=document) => [...(typeof root === 'string' ? document.querySelector(root) : root)?.querySelectorAll(s) || []];
  const fmt = n => Number(n).toLocaleString('fa-IR');
  const e = str => String(str??'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const faToEn = str => String(str).replace(/[۰-۹]/g,d=>String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d=>String(d.charCodeAt(0)-1632));
  const amount = value => Number(faToEn(value).replace(/[\s,٬،]/g,''));
  const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const cat = key => CATEGORIES[key] || CATEGORIES.service;
  const freshStore = () => ({requests:[],offers:{},selected:{},notifications:[],sequence:1007});
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (_) {saved=null;}
  let store = saved && Array.isArray(saved.requests) && saved.offers && saved.selected ? saved : freshStore();
  const save = () => {try{localStorage.setItem(STORE_KEY,JSON.stringify(store));}catch(_){toast('حافظه مرورگر در دسترس نیست؛ تغییرات ذخیره نمی‌شوند.',true);}};
  let role = 'buyer', filter = 'all', query = '';
  let notificationsOpen = false;

  const requestById = id => allRequests().find(r => r.id === id);
  function allRequests(){
    return [...store.requests, ...SEED_REQUESTS.map(s => ({...s,createdAt:now-s.ageHours*hour,deadline:now-s.ageHours*hour+s.durationDays*day,isSeed:true}))];
  }
  function getOffers(r){
    let base = [];
    if(r.isSeed){
      const range = {digital:.14,car:.08,construction:.20,property:.24,gold:.06,service:.30}[r.category] || .15;
      const count = r.offers || 0;
      base = Array.from({length:count},(_,i)=> {
        const factor = (r.id === 'GY-1001' ? .945 : .91) + (i*37 % 29)/29 * range;
        const price = Math.round((r.budget * factor) / 1000)*1000;
        return {id:r.id+'-S'+i,seller:SAMPLE_SELLERS[i % SAMPLE_SELLERS.length]+(i >= SAMPLE_SELLERS.length ? ' '+fmt(Math.floor(i/SAMPLE_SELLERS.length)+1):''),price,city:i%3===1?'کرج':'تهران',delivery:i%3===0?'تحویل فوری':'۲ تا ۵ روز کاری',warranty:i%2===0?'با تضمین اصالت':'طبق توافق',createdAt:r.createdAt+(i+1)*50_000,isSeed:true};
      });
      if(r.id === 'GY-1001'){
        base[0]={...base[0],seller:'دیجیتال پلاس',price:98_500_000};
        base[1]={...base[1],seller:'تک استور',price:96_800_000};
        base[2]={...base[2],seller:'موبایل سنتر',price:99_200_000};
      }
    }
    return [...base,...(store.offers[r.id]||[])].sort((a,b)=>a.price-b.price);
  }
  function toast(msg,error=false){
    const el=document.createElement('div');el.className='toast'+(error?' error':'');el.innerHTML=icon(error?'x':'check')+`<span>${e(msg)}</span>`;
    $('#toastContainer').appendChild(el);
    setTimeout(()=>{el.remove();},3800);
  }
  function notify(title,message){
    store.notifications.unshift({id:String(Date.now())+'-'+Math.random().toString(36).slice(2,6),title,message,at:Date.now()});
    if(store.notifications.length>40)store.notifications=store.notifications.slice(0,40);
    save();renderNotifications();
  }
  function past(ts){
    const diff=Math.max(0,Date.now()-ts);const h=Math.floor(diff/hour);
    return h<1?'چند دقیقه پیش':h<24?`${fmt(h)} ساعت پیش`:`${fmt(Math.floor(h/24))} روز پیش`;
  }
  function remaining(ts){
    const diff=ts-Date.now();if(diff<=0)return 'پایان‌یافته';const d=Math.floor(diff/day),h=Math.ceil((diff%day)/hour);
    return d>0?`${fmt(d)} روز مانده`:`${fmt(h)} ساعت مانده`;
  }
  function changeRole(next){
    role=next==='seller'?'seller':'buyer';
    $$('[data-role]').forEach(b=>b.classList.toggle('active',b.dataset.role===role));
    $('#requestsHeading').innerHTML=role==='buyer'?'درخواست‌های خرید <span class="title-soft">فعال</span>':'فرصت‌های فروش <span class="title-soft">فعال</span>';
    $('#requestsSubtitle').textContent=role==='buyer'?'درخواست‌های نمونه رو ببین و برای هرکدوم پیشنهاد ثبت کن.':'درخواست‌های مرتبط رو پیدا کن و قیمت پیشنهادی خودت رو وارد کن.';
    renderRequests();
    toast(role==='seller'?'پنل فروشنده فعال شد (نسخه آزمایشی).':'پنل خریدار فعال شد (نسخه آزمایشی).');
  }
  function requestCard(r){
    const count = getOffers(r).length;
    const action = role === 'seller' ? 'ثبت پیشنهاد' : 'مشاهده پیشنهادها';
    return `<article class="request-card"><div class="request-card-top"><span class="request-icon">${cat(r.category).emoji}</span><span class="tag">${r.isSeed?'درخواست نمونه':'درخواست من'}</span></div><h3>${e(r.title)}</h3><p>${e(r.description)}</p><div class="request-meta"><span>${icon('pin')}${e(r.city)}</span><span>${icon('clock')}${past(r.createdAt)}</span></div><div class="request-details"><div><span class="budget-label">بودجه پیشنهادی</span><strong class="budget-value">${fmt(r.budget)} <small>تومان</small></strong></div><div class="offers-pill"><b>${fmt(count)}</b> پیشنهاد</div></div><div class="request-card-bottom"><span class="time">${icon('clock')}${remaining(r.deadline)}</span><button type="button" class="request-action" data-open-id="${e(r.id)}">${action} ${icon('arrow')}</button></div></article>`;
  }
  function renderRequests(){
    let items=allRequests().filter(r=>r.deadline>Date.now());
    if(filter!=='all')items=items.filter(r=>r.category===filter);
    if(query){const needle=faToEn(query).toLowerCase();items=items.filter(r=>faToEn(`${r.title} ${r.description} ${r.city} ${cat(r.category).label}`).toLowerCase().includes(needle));}
    const sort=$('#sortSelect').value;
    items.sort((a,b)=>sort==='offers'?getOffers(b).length-getOffers(a).length:sort==='budget'?b.budget-a.budget:b.createdAt-a.createdAt);
    $('#requestsGrid').innerHTML=items.map(requestCard).join('');
    $('#emptyState').hidden=items.length!==0;
    $$('.filter-pill').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));
    $$('.category-card').forEach(b=>b.classList.toggle('active',b.dataset.category===filter));
    $('#metricRequests').textContent=fmt(allRequests().length);
    $$('[data-open-id]').forEach(btn=>btn.addEventListener('click',()=>openRequest(btn.dataset.openId)));
  }
  function goRequests(){document.getElementById('requests').scrollIntoView({behavior:'smooth'});}
  function setFilter(f){filter=f;query='';$('#heroSearchInput').value='';renderRequests();goRequests();}
  function showModal(kicker,title,html,large=false){
    $('#modalKicker').textContent=kicker;$('#modalTitle').textContent=title;
    $('#modalContent').innerHTML=html;$('#modal').classList.toggle('large',large);
    $('#modalBackdrop').hidden=false;document.body.classList.add('no-scroll');
    const first=$('#modalContent input, #modalContent button');if(first)setTimeout(()=>first.focus(),20);
  }
  function closeModal(){
    $('#modalBackdrop').hidden=true;if(!notificationsOpen)document.body.classList.remove('no-scroll');
  }
  function newRequest(){
    const categoryOptions=Object.entries(CATEGORIES).map(([k,v])=>`<option value="${k}">${v.label}</option>`).join('');
    showModal('شروع رایگان','درخواست خرید جدید',`<p class="modal-desc">دقیق بنویس دنبال چه محصول یا خدمتی هستی. این نسخه درخواست را فقط در مرورگر خودت ذخیره می‌کند.</p>
      <form id="newRequestForm"><div class="field-grid"><label class="field-full">عنوان درخواست <input name="title" maxlength="110" required placeholder="مثلاً: خرید ۲۰ تن میلگرد سایز ۱۸"></label><label class="field">دسته‌بندی <select name="category" required>${categoryOptions}</select></label><label class="field">شهر <input name="city" required maxlength="55" placeholder="تهران"></label><label class="field">حداکثر بودجه (تومان) <input name="budget" inputmode="numeric" required placeholder="مثلاً: ۱۰۰۰۰۰۰۰۰"></label><label class="field">مهلت دریافت پیشنهاد <select name="days"><option value="3">۳ روز</option><option value="7" selected>۷ روز</option><option value="14">۱۴ روز</option><option value="30">۳۰ روز</option></select></label><label class="field-full">مشخصات و شرایط خرید <textarea name="description" required maxlength="1500" placeholder="مدل، تعداد، کیفیت، زمان تحویل و شرایط مهم رو بنویس..."></textarea></label></div><div class="form-notice">برای عرضه عمومی، ثبت‌نام و اعتبارسنجی فروشندگان، سرور و پایگاه‌داده جداگانه لازم است.</div><button type="submit" class="primary-btn form-submit">${icon('plus')} ثبت درخواست در نسخه نمایشی</button></form>`);
    $('#newRequestForm').addEventListener('submit',ev=>{
      ev.preventDefault();const data=new FormData(ev.currentTarget);
      const budget=amount(data.get('budget'));
      if(!Number.isSafeInteger(budget)||budget<1000||budget>10**15){toast('بودجه را به تومان و به‌صورت عدد معتبر وارد کن.',true);return;}
      const title=String(data.get('title')||'').trim(),desc=String(data.get('description')||'').trim(),city=String(data.get('city')||'').trim();
      if(title.length<4||desc.length<8||city.length<2){toast('عنوان، شهر و توضیحات را کامل‌تر وارد کن.',true);return;}
      const r={id:`GY-${store.sequence++}`,title:title.slice(0,110),description:desc.slice(0,1500),city:city.slice(0,55),category:String(data.get('category')),budget,createdAt:Date.now(),deadline:Date.now()+Number(data.get('days'))*day,isSeed:false};
      store.requests.unshift(r);save();notify('درخواست شما ثبت شد',`درخواست «${r.title}» در همین مرورگر ساخته شد.`);closeModal();filter='all';query='';$('#heroSearchInput').value='';renderRequests();goRequests();toast('درخواست آزمایشی با موفقیت ثبت شد.');
    });
  }
  function offerRow(o,best,selected){
    const initials=e(o.seller.slice(0,1));const isSelected=selected===o.id;
    const actions=role==='buyer'?`<button class="select-offer" data-select-offer="${e(o.id)}" ${isSelected?'disabled':''}>${isSelected?'انتخاب شده ✓':'انتخاب آزمایشی'}</button>`:'';
    return `<div class="offer-row ${best?'best-offer':''} ${isSelected?'selected-offer':''}"><div class="seller-mark ${best?'green':'purple'}">${initials}</div><div class="offer-info"><b>${e(o.seller)} ${best?'<span class="mini-best">کمترین قیمت</span>':''}</b><small>${e(o.city)} · ${e(o.delivery)} · ${e(o.warranty)}</small></div><div class="offer-price"><b>${fmt(o.price)}</b><small>تومان</small></div>${actions}</div>`;
  }
  function openRequest(id){
    const r=requestById(id);if(!r)return;
    const offers=getOffers(r),selected=store.selected[id];
    const rows=offers.length?`<div class="offer-list-scroll">${offers.map((o,i)=>offerRow(o,i===0,selected)).join('')}</div>`:'<div class="empty-state"><span>💬</span><h3>هنوز پیشنهادی نیست</h3><p>اولین فروشنده‌ای باش که قیمت می‌ده.</p></div>';
    showModal('مشاهده جزئیات درخواست',r.title,
      `<div class="modal-price-head"><div><small>بودجه خریدار</small><strong>${fmt(r.budget)} تومان</strong></div><span class="modal-tag">${r.isSeed?'داده نمونه':'درخواست من'}</span></div><p class="modal-desc">${e(r.description)}</p><div class="detail-line"><span>${icon('pin')}${e(r.city)}</span><span>${icon('clock')}${remaining(r.deadline)}</span><span>${icon('message')}${fmt(offers.length)} پیشنهاد</span></div><div class="detail-divider"></div><div class="detail-section-heading"><h3>پیشنهادهای فروشندگان</h3><small>مرتب‌شده از کمترین قیمت</small></div>${rows}
       <div class="detail-cta"><button type="button" class="primary-btn" id="openBidForm">${icon('plus')} ثبت پیشنهاد قیمت</button><button type="button" class="secondary-btn" id="copyRequestLink">${icon('copy')} کپی شناسه</button></div><div class="form-notice">توجه: قیمت‌ها و فروشندگان اولیه ساختگی هستند. هیچ معامله یا تعهد حقوقی در این نسخه ایجاد نمی‌شود.</div>`,true);
    $('#openBidForm').addEventListener('click',()=>openBidForm(id));
    $('#copyRequestLink').addEventListener('click',()=>{
      const copy=()=>toast('شناسه درخواست: '+id);
      if(navigator.clipboard?.writeText){navigator.clipboard.writeText(id).then(copy,copy);}else{copy();}
    });
    $$('[data-select-offer]','#modalContent').forEach(btn=>btn.addEventListener('click',()=>{
      store.selected[id]=btn.dataset.selectOffer;save();notify('پیشنهاد به‌صورت آزمایشی انتخاب شد',`درخواست «${r.title}»؛ این انتخاب معامله واقعی نیست.`);toast('پیشنهاد انتخاب شد (فقط نسخه نمایشی).');openRequest(id);
    }));
  }
  function openBidForm(id){
    const r=requestById(id);if(!r)return;
    if(r.deadline<=Date.now()){toast('مهلت این درخواست تمام شده.',true);return;}
    showModal('پنل فروشنده','پیشنهاد قیمت برای: '+r.title,
      `<p class="modal-desc">پیشنهادت رو ثبت کن تا در فهرست همین مرورگر نمایش داده بشه. در نسخه نهایی فقط فروشنده احرازشده می‌تونه پیشنهاد واقعی ارسال کنه.</p>
      <form id="bidForm"><div class="field-grid"><label class="field-full">نام فروشگاه یا شرکت <input name="seller" maxlength="65" required placeholder="مثلاً: بازرگانی آریا"></label><label class="field">قیمت پیشنهادی (تومان) <input name="price" inputmode="numeric" required placeholder="مثلاً: ۹۵۰۰۰۰۰۰"></label><label class="field">شهر فروشنده <input name="city" required maxlength="50" value="تهران"></label><label class="field">زمان تحویل <select name="delivery"><option>تحویل فوری</option><option>۱ تا ۳ روز کاری</option><option>۳ تا ۷ روز کاری</option><option>طبق توافق</option></select></label><label class="field">شرایط تضمین <select name="warranty"><option>با تضمین اصالت</option><option>با ضمانت کتبی</option><option>طبق توافق</option></select></label></div><div class="form-notice">این پیشنهاد فقط برای مشاهده عملکرد برنامه است؛ ارسال یا اعلان برای شخص دیگری انجام نمی‌شود.</div><button type="submit" class="primary-btn form-submit">${icon('check')} ثبت پیشنهاد آزمایشی</button></form>`);
    $('#bidForm').addEventListener('submit',ev=>{
      ev.preventDefault();const d=new FormData(ev.currentTarget);const price=amount(d.get('price'));
      if(!Number.isSafeInteger(price)||price<1000||price>10**15){toast('یک قیمت معتبر به تومان وارد کن.',true);return;}
      const seller=String(d.get('seller')||'').trim(),city=String(d.get('city')||'').trim();
      if(seller.length<2||city.length<2){toast('نام فروشنده و شهر رو کامل کن.',true);return;}
      const offer={id:'O-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6),seller:seller.slice(0,65),city:city.slice(0,50),price,delivery:String(d.get('delivery')),warranty:String(d.get('warranty')),createdAt:Date.now()};
      if(!Array.isArray(store.offers[id]))store.offers[id]=[];
      store.offers[id].push(offer);save();notify('پیشنهاد آزمایشی ثبت شد',`${seller} برای «${r.title}» قیمت ${fmt(price)} تومان ثبت کرد.`);renderRequests();openRequest(id);toast('قیمت پیشنهادی در همین مرورگر ثبت شد.');
    });
  }
  function renderNotifications(){
    const items=store.notifications;
    $('#notificationList').innerHTML=items.length?items.map(n=>`<div class="notification-item"><div class="nicon">🔔</div><div><strong>${e(n.title)}</strong><p>${e(n.message)}</p><small>${past(n.at)}</small></div></div>`).join(''):`<div class="empty-state" style="margin-top:20px"><span>🔔</span><h3>اعلان جدیدی نداری</h3><p>بعد از ثبت درخواست یا پیشنهاد، اعلان نمایشی اینجا نمایش داده می‌شه.</p></div>`;
    $('#notificationDot').style.display=items.length?'block':'none';
  }
  function showNotifications(){
    notificationsOpen=true;$('#drawerBackdrop').hidden=false;$('#notificationsDrawer').classList.add('open');$('#notificationsDrawer').setAttribute('aria-hidden','false');document.body.classList.add('no-scroll');renderNotifications();
  }
  function closeNotifications(){
    notificationsOpen=false;$('#drawerBackdrop').hidden=true;$('#notificationsDrawer').classList.remove('open');$('#notificationsDrawer').setAttribute('aria-hidden','true');if($('#modalBackdrop').hidden)document.body.classList.remove('no-scroll');
  }
  function showVip(){
    showModal('قیمت‌یار حرفه‌ای','امکانات عضویت VIP',`<p class="modal-desc">بخش VIP از فاز اول در طراحی محصول دیده شده؛ فعال‌سازی اشتراک و پرداخت در نسخه نمایشی وجود ندارد.</p><div class="vip-modal-feature"><span>⚡</span><div><b>اعلان‌های اولویت‌دار</b><small>در نسخه عملیاتی با سیستم Push و اعلان درون‌برنامه‌ای</small></div></div><div class="vip-modal-feature"><span>📊</span><div><b>مقایسه عمیق قیمت‌ها</b><small>جدول مقایسه قیمت، زمان تحویل و شرایط فروش</small></div></div><div class="vip-modal-feature"><span>🎯</span><div><b>فیلترهای تخصصی</b><small>مرتب‌سازی فرصت‌ها و پیشنهادها براساس نیاز</small></div></div><div class="form-notice">پلن‌ها و تعرفه‌ها هنوز نهایی نشده‌اند؛ دکمه پرداخت واقعی در این پیش‌نمایش قرار ندارد.</div><button type="button" class="primary-btn form-submit" id="vipClose">متوجه شدم ${icon('check')}</button>`);
    $('#vipClose').addEventListener('click',closeModal);
  }
  function showLogin(){
    showModal('نسخه آزمایشی','حساب کاربری قیمت‌یار',`<p class="modal-desc">این نسخه برای بررسی تجربه کاربری ساخته شده و هنوز ثبت‌نام، رمز عبور، پیامک یا هویت‌سنجی به سرور متصل نیست.</p><div class="vip-modal-feature"><span>🛒</span><div><b>پنل خریدار</b><small>ثبت درخواست، مشاهده و انتخاب آزمایشی پیشنهادها</small></div></div><div class="vip-modal-feature"><span>🏪</span><div><b>پنل فروشنده</b><small>دیدن فرصت‌ها و ثبت پیشنهاد قیمت در همین دستگاه</small></div></div><div class="detail-cta"><button class="primary-btn" data-choose-role="buyer">ورود به پنل خریدار</button><button class="secondary-btn" data-choose-role="seller">پنل فروشنده</button></div><div class="detail-divider"></div><button type="button" class="secondary-btn" id="resetDemo">پاک‌کردن داده‌های آزمایشی همین مرورگر</button>`);
    $$('[data-choose-role]','#modalContent').forEach(b=>b.addEventListener('click',()=>{changeRole(b.dataset.chooseRole);closeModal();}));
    $('#resetDemo').addEventListener('click',()=>{if(!window.confirm('درخواست‌ها، پیشنهادها و اعلان‌های آزمایشی این مرورگر حذف شوند؟'))return;store=freshStore();save();closeModal();filter='all';query='';$('#heroSearchInput').value='';renderRequests();renderNotifications();toast('داده‌های نمایشی مرورگر بازنشانی شدند.');});
  }
  function setSearch(search){
    query=search.trim().slice(0,100);filter='all';renderRequests();goRequests();
    if(!query)toast('همه درخواست‌ها نمایش داده شدند.');
  }
  function bind(){
    $$('.role-btn').forEach(b=>b.addEventListener('click',()=>changeRole(b.dataset.role)));
    $$('.mobile-role button').forEach(b=>b.addEventListener('click',()=>{changeRole(b.dataset.role);$('#mobileNav').classList.remove('open');}));
    $$('.filter-pill').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.filter)));
    $$('.category-card').forEach(b=>b.addEventListener('click',()=>setFilter(b.dataset.category)));
    $('#sortSelect').addEventListener('change',renderRequests);
    $('#heroSearchForm').addEventListener('submit',ev=>{ev.preventDefault();setSearch($('#heroSearchInput').value);});
    $$('.quick-query').forEach(b=>b.addEventListener('click',()=>{$('#heroSearchInput').value=b.dataset.query;setSearch(b.dataset.query);}));
    ['#newRequestHero','#newRequestSection','#newRequestBottom','#emptyNewRequest','#mobileNewRequest'].forEach(id=>$(id).addEventListener('click',newRequest));
    $('#heroOffersBtn').addEventListener('click',()=>openRequest('GY-1001'));
    $('#vipBtn').addEventListener('click',showVip);
    $('#demoLoginBtn').addEventListener('click',showLogin);
    $('#mobileProfile').addEventListener('click',showLogin);
    $('#notificationsBtn').addEventListener('click',showNotifications);
    $('#mobileNotifications').addEventListener('click',showNotifications);
    $$('[data-close-drawer]').forEach(b=>b.addEventListener('click',closeNotifications));
    $('#drawerBackdrop').addEventListener('click',closeNotifications);
    $('#modalClose').addEventListener('click',closeModal);
    $('#modalBackdrop').addEventListener('click',ev=>{if(ev.target===$('#modalBackdrop'))closeModal();});
    document.addEventListener('keydown',ev=>{if(ev.key==='Escape'){closeModal();closeNotifications();$('#mobileNav').classList.remove('open');}});
    $('#mobileMenuBtn').addEventListener('click',()=>$('#mobileNav').classList.toggle('open'));
    $$('.mobile-nav a').forEach(a=>a.addEventListener('click',()=>$('#mobileNav').classList.remove('open')));
  }
  bind();renderRequests();renderNotifications();
})();

