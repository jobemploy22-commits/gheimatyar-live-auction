/* Gheimatyar public homepage: real open requests only. No demo writes. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const labels = {
    digital: ['موبایل و دیجیتال', '📱'],
    car: ['خودرو و موتورسیکلت', '🚙'],
    construction: ['مصالح ساختمانی', '🏗️'],
    property: ['ملک و اجاره', '🏠'],
    gold: ['طلا و سکه', '🪙'],
    service: ['خدمات تخصصی', '🛠️']
  };
  const state = { requests: [], count: 0, filter: 'all', query: '', loading: true, error: '' };
  const fmt = (n) => Number(n).toLocaleString('fa-IR');
  const goMarket = (role, requestId) => {
    const params = new URLSearchParams();
    if (role === 'seller' || role === 'buyer') params.set('role', role);
    if (requestId && /^[0-9a-f-]{36}$/i.test(requestId)) params.set('request', requestId);
    window.location.assign('./live.html' + (params.toString() ? '?' + params.toString() : ''));
  };
  const elem = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content != null) node.textContent = String(content);
    return node;
  };
  function add(node, ...children) {
    for (const child of children) if (child) node.appendChild(child);
    return node;
  }
  function requestCard(request) {
    const item = elem('article', 'request-card');
    const category = labels[request.category] || ['سایر', '📋'];
    const top = elem('div', 'request-card-top');
    add(top, elem('span', 'request-icon', category[1]), elem('span', 'tag', category[0]));
    const title = elem('h3', '', request.title);
    const summary = elem('p', '', request.description.length > 165 ? request.description.slice(0, 165) + '…' : request.description);
    const meta = elem('div', 'request-meta');
    add(meta, elem('span', '', '📍 ' + request.city), elem('span', '', '📅 ' + new Date(request.created_at).toLocaleDateString('fa-IR')));
    const detail = elem('div', 'request-details');
    const budget = elem('div', '');
    add(budget, elem('span', 'budget-label', 'سقف بودجه'), elem('strong', 'budget-value', fmt(request.budget) + ' تومان'));
    const note = elem('div', 'offers-pill', 'دریافت پیشنهاد در پنل');
    add(detail, budget, note);
    const bottom = elem('div', 'request-card-bottom');
    const days = Math.max(0, Math.ceil((new Date(request.deadline).getTime() - Date.now()) / 86400000));
    const button = elem('button', 'primary-btn', 'مشاهده و ثبت پیشنهاد');
    button.type = 'button';
    button.addEventListener('click', () => goMarket('seller', request.id));
    add(bottom, elem('span', 'time', fmt(days) + ' روز تا پایان'), button);
    return add(item, top, title, summary, meta, detail, bottom);
  }
  function render() {
    const grid = $('#requestsGrid');
    const empty = $('#emptyState');
    if (!grid || !empty) return;
    grid.replaceChildren();
    const title = empty.querySelector('h3');
    const info = empty.querySelector('p');
    const btn = $('#emptyNewRequest');
    if (state.loading) {
      empty.hidden = false;
      if (title) title.textContent = 'در حال دریافت درخواست‌ها';
      if (info) info.textContent = 'فهرست درخواست‌های واقعی در حال بارگذاری است.';
      if (btn) btn.hidden = true;
      return;
    }
    if (state.error) {
      empty.hidden = false;
      if (title) title.textContent = 'دریافت درخواست‌ها ممکن نشد';
      if (info) info.textContent = state.error + ' لطفاً دوباره تلاش کنید.';
      if (btn) { btn.hidden = false; btn.textContent = 'ورود به بازار'; }
      $('#metricRequests').textContent = '—';
      return;
    }
    let items = state.requests.filter(r => state.filter === 'all' || r.category === state.filter);
    if (state.query) {
      const text = state.query.toLocaleLowerCase('fa');
      items = items.filter(r => [r.title,r.city,r.description,labels[r.category]?.[0]].some(v => String(v||'').toLocaleLowerCase('fa').includes(text)));
    }
    const sort = $('#sortSelect')?.value || 'latest';
    items = items.slice().sort((a,b) => sort === 'budget' ? Number(b.budget) - Number(a.budget) : new Date(b.created_at) - new Date(a.created_at));
    const fragment = document.createDocumentFragment();
    for (const item of items) fragment.appendChild(requestCard(item));
    grid.appendChild(fragment);
    empty.hidden = items.length > 0;
    if (title) title.textContent = state.count === 0 ? 'هنوز درخواست فعالی ثبت نشده است' : 'درخواستی با این جست‌وجو پیدا نشد';
    if (info) info.textContent = state.count === 0 ? 'اولین درخواست خرید را ثبت کنید تا فروشندگان بتوانند پیشنهاد بدهند.' : 'دسته‌بندی یا عبارت جست‌وجو را تغییر دهید.';
    if (btn) { btn.hidden = false; btn.textContent = 'ثبت درخواست خرید'; }
    $('#metricRequests').textContent = fmt(state.count);
    $$('.filter-pill').forEach(b => b.classList.toggle('active',b.dataset.filter === state.filter));
    $$('.category-card').forEach(b => b.classList.toggle('active',b.dataset.category === state.filter));
  }
  async function load() {
    state.loading = true;
    render();
    try {
      const config = window.GHEIMATYAR_SUPABASE;
      if (!window.supabase || !config?.url || !config?.key) throw new Error('سرویس بازار در دسترس نیست.');
      const client = window.supabase.createClient(config.url, config.key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const {data, count, error} = await client.from('market_requests')
        .select('id,title,category,city,description,budget,deadline,created_at', {count: 'exact'})
        .eq('status', 'open').gt('deadline', new Date().toISOString())
        .order('created_at', {ascending:false}).limit(60);
      if (error) throw error;
      state.requests = Array.isArray(data) ? data : [];
      state.count = typeof count === 'number' ? count : state.requests.length;
      state.error = '';
    } catch (error) {
      state.requests = [];
      state.count = 0;
      state.error = 'اتصال به سرویس بازار برقرار نشد.';
      console.error('Gheimatyar public requests:', error);
    } finally {
      state.loading = false;
      render();
    }
  }
  function goRequests() {
    $('#requests')?.scrollIntoView({behavior:'smooth'});
  }
  $$('.filter-pill').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.filter || 'all';
    render(); goRequests();
  }));
  $$('.category-card').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.category || 'all';
    render(); goRequests();
  }));
  $$('.quick-query').forEach(button => button.addEventListener('click', () => {
    const input = $('#heroSearchInput');
    input.value = button.dataset.query || button.textContent.trim();
    state.query = input.value.trim();
    render(); goRequests();
  }));
  $('#heroSearchForm')?.addEventListener('submit', e => {
    e.preventDefault();
    state.query = ($('#heroSearchInput')?.value || '').trim();
    render(); goRequests();
  });
  $('#sortSelect')?.addEventListener('change', render);
  for (const id of ['demoLoginBtn','notificationsBtn','mobileNotifications','mobileProfile']) {
    $('#' + id)?.addEventListener('click', () => goMarket());
  }
  for (const id of ['newRequestHero','newRequestSection','newRequestBottom','mobileNewRequest','emptyNewRequest']) {
    $('#' + id)?.addEventListener('click', () => goMarket('buyer'));
  }
  for (const id of ['heroOffersBtn','vipBtn']) {
    $('#' + id)?.addEventListener('click', () => goMarket('seller'));
  }
  $$('[data-role]').forEach(button => button.addEventListener('click', () => goMarket(button.dataset.role)));
  $('#mobileMenuBtn')?.addEventListener('click', () => $('.mobile-nav')?.classList.toggle('open'));
  $$('.mobile-nav a').forEach(a => a.addEventListener('click', () => $('.mobile-nav')?.classList.remove('open')));
  render();
  load();
})();
