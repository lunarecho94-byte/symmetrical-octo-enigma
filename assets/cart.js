/* ==========================================================
   WarmHome UA — КОШИК (спільний для всіх сторінок)
   - кнопки: .js-cart-open (відкрити кошик), .js-cart-count (лічильник),
             [data-add-to-cart="<slug>"] (додати товар)
   - товари беруться з window.PRODUCTS (assets/products.js)
   - оформлення надсилається в Google-таблицю + Telegram (той самий LEADS_URL)
   ========================================================== */
(function () {
  const LEADS_URL = 'https://script.google.com/macros/s/AKfycbxV8jAtsjSV5_v5c-Ut88A3b4ymgJSWugq5SjGMv-I1SX_I65oECgysxCKZsab6ERq4/exec';
  const NP_API_KEY = '';
  const CODES = ['050','066','095','099','067','068','096','097','098','063','073','093'];
  const KEY = 'wh_cart_v1';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('uk-UA').replace(/ /g, ' ');
  const products = () => window.PRODUCTS || [];
  const bySlug = (slug) => products().find(p => p.slug === slug);

  /* ---------- UTM: запамʼятовуємо мітки реклами на весь візит ---------- */
  try {
    const q = new URLSearchParams(location.search);
    const utm = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].filter(k => q.get(k)).map(k => `${k}: ${q.get(k)}`).join('\n');
    if (utm) sessionStorage.setItem('wh_utm', utm);
  } catch (e) {}
  window.getStoredUTM = () => { try { return sessionStorage.getItem('wh_utm') || ''; } catch (e) { return ''; } };

  /* ---------- Сховище ---------- */
  let items = [];
  try { items = JSON.parse(localStorage.getItem(KEY) || '[]').filter(i => i && i.slug && i.qty > 0); } catch (e) { items = []; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} };
  const lines = () => items.map(i => ({ ...i, p: bySlug(i.slug) })).filter(i => i.p);
  const count = () => lines().reduce((s, i) => s + i.qty, 0);
  const total = () => lines().reduce((s, i) => s + i.qty * i.p.price, 0);

  function updateBadges() {
    const n = count();
    $$('.js-cart-count').forEach(el => { el.textContent = n; el.classList.toggle('hidden', !n); });
  }

  /* ---------- Розмітка панелі ---------- */
  const INP = 'w-full rounded-xl border border-slate-300 px-4 py-3 text-base bg-white focus:outline-none focus:ring-2 focus:ring-fire-500 disabled:bg-slate-100';
  document.body.insertAdjacentHTML('beforeend', `
    <div id="cartOverlay" class="fixed inset-0 z-[60] bg-black/60 hidden"></div>
    <aside id="cartDrawer" class="fixed top-0 right-0 z-[61] h-full w-full max-w-md bg-white text-slate-800 shadow-2xl translate-x-full transition-transform duration-300 flex flex-col" aria-hidden="true" aria-label="Кошик">
      <div class="flex items-center justify-between px-5 h-16 border-b border-slate-200 shrink-0">
        <h2 class="font-display font-extrabold text-xl text-graphite flex items-center gap-2"><i data-lucide="shopping-cart" class="w-5 h-5 text-fire-600"></i><span id="cartTitle">Кошик</span></h2>
        <button type="button" id="cartClose" class="grid place-items-center w-10 h-10 rounded-lg hover:bg-slate-100 text-graphite" aria-label="Закрити кошик"><i data-lucide="x" class="w-6 h-6"></i></button>
      </div>

      <div id="cartStepItems" class="flex-1 flex flex-col min-h-0">
        <div id="cartItems" class="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-3"></div>
        <div id="cartEmpty" class="hidden flex-1 flex flex-col items-center justify-center text-center px-6">
          <div class="w-16 h-16 rounded-full bg-orange-100 text-fire-600 grid place-items-center"><i data-lucide="shopping-cart" class="w-8 h-8"></i></div>
          <p class="mt-4 font-semibold text-graphite">Кошик порожній</p>
          <a href="/" class="mt-4 inline-flex items-center gap-2 font-semibold text-fire-600 hover:text-fire-700">Перейти до каталогу <i data-lucide="arrow-right" class="w-4 h-4"></i></a>
        </div>
        <div id="cartFooter" class="shrink-0 border-t border-slate-200 px-5 py-4" style="padding-bottom:max(1rem,env(safe-area-inset-bottom))">
          <div class="flex items-end justify-between"><span class="text-slate-500">Разом</span><span class="font-display font-extrabold text-2xl text-fire-600"><span class="js-cart-total">0</span> грн</span></div>
          <button type="button" id="cartCheckout" class="mt-3 w-full min-h-[52px] rounded-xl bg-buy-600 hover:bg-buy-700 text-white font-bold text-lg transition">Оформити замовлення</button>
          <p class="mt-2 text-center text-xs text-slate-500">Без передоплати • Оплата при отриманні</p>
        </div>
      </div>

      <form id="cartForm" class="hidden flex-1 flex flex-col min-h-0" novalidate>
        <div class="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <button type="button" id="cartBack" class="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-fire-600"><i data-lucide="chevron-left" class="w-4 h-4"></i>До кошика</button>
          <input type="text" name="website" tabindex="-1" autocomplete="off" class="hidden" aria-hidden="true">
          <label class="block mt-4"><span class="text-sm font-semibold text-slate-700">Імʼя <span class="text-fire-600">*</span></span>
            <input type="text" name="firstName" autocomplete="given-name" class="${INP} mt-1" placeholder="Олена">
            <span class="c-err hidden text-sm text-red-600" data-for="firstName">Вкажіть імʼя</span></label>
          <label class="block mt-4"><span class="text-sm font-semibold text-slate-700">Прізвище <span class="text-fire-600">*</span></span>
            <input type="text" name="lastName" autocomplete="family-name" class="${INP} mt-1" placeholder="Коваленко">
            <span class="c-err hidden text-sm text-red-600" data-for="lastName">Вкажіть прізвище</span></label>
          <label class="block mt-4"><span class="text-sm font-semibold text-slate-700">Номер телефону <span class="text-fire-600">*</span></span>
            <input type="tel" name="phone" inputmode="tel" autocomplete="tel" class="${INP} mt-1" placeholder="+38 (0__) ___-__-__">
            <span class="c-err hidden text-sm text-red-600" data-for="phone">Введіть коректний український номер</span></label>
          <div class="mt-4"><span class="text-sm font-semibold text-slate-700">Доставка Новою Поштою <span class="text-fire-600">*</span></span>
            <div class="relative mt-1"><input type="text" name="city" autocomplete="off" class="${INP}" placeholder="Почніть вводити місто">
              <ul class="c-np hidden absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl text-sm" data-for="city"></ul></div>
            <div class="relative mt-2"><input type="text" name="warehouse" autocomplete="off" disabled class="${INP}" placeholder="Спершу оберіть місто">
              <ul class="c-np hidden absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl text-sm" data-for="warehouse"></ul></div>
            <span class="c-err hidden text-sm text-red-600" data-for="np">Оберіть місто та відділення</span>
          </div>
          <label class="mt-4 flex items-start gap-3 cursor-pointer select-none">
            <input type="checkbox" name="noCall" class="mt-0.5 w-5 h-5 shrink-0 rounded accent-fire-600">
            <span class="text-sm text-slate-700 font-semibold">Можна мені не телефонувати</span>
          </label>
        </div>
        <div class="shrink-0 border-t border-slate-200 px-5 py-4" style="padding-bottom:max(1rem,env(safe-area-inset-bottom))">
          <button type="submit" id="cartSubmit" class="w-full min-h-[52px] flex items-center justify-center gap-2 rounded-xl bg-buy-600 hover:bg-buy-700 disabled:opacity-70 text-white font-bold text-lg transition"><span class="c-btn">Підтвердити на <span class="js-cart-total">0</span> грн</span></button>
          <p class="c-form-err hidden mt-2 text-center text-sm text-red-600">Не вдалося надіслати. Спробуйте ще раз або зателефонуйте: <a href="tel:+380990227684" class="underline">+38 (099) 022-76-84</a></p>
        </div>
      </form>

      <div id="cartDone" class="hidden flex-1 flex flex-col items-center justify-center text-center px-6">
        <div class="w-16 h-16 rounded-full bg-buy-600/10 text-buy-600 grid place-items-center"><i data-lucide="check" class="w-9 h-9"></i></div>
        <h3 class="mt-4 font-display font-extrabold text-2xl text-graphite">Дякуємо!</h3>
        <p id="cartDoneText" class="mt-2 text-slate-600"></p>
        <button type="button" class="js-cart-close mt-6 px-6 min-h-[48px] rounded-xl bg-fire-600 hover:bg-fire-700 text-white font-bold">Добре</button>
      </div>
    </aside>

    <div id="cartToast" class="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-[59] hidden">
      <div class="flex items-center gap-3 bg-graphite text-white rounded-2xl shadow-2xl pl-4 pr-2 py-2">
        <i data-lucide="check" class="w-5 h-5 text-buy-500"></i><span class="text-sm font-semibold">Додано в кошик</span>
        <button type="button" class="js-cart-open ml-1 px-3 min-h-[36px] rounded-xl bg-fire-600 hover:bg-fire-700 text-sm font-bold">Оформити</button>
      </div>
    </div>`);

  const drawer = $('#cartDrawer'), overlay = $('#cartOverlay'), form = $('#cartForm');

  function show(step) {
    $('#cartStepItems').classList.toggle('hidden', step !== 'items');
    form.classList.toggle('hidden', step !== 'form');
    $('#cartDone').classList.toggle('hidden', step !== 'done');
    $('#cartTitle').textContent = step === 'form' ? 'Оформлення' : 'Кошик';
  }

  function render() {
    const ls = lines();
    $('#cartItems').innerHTML = ls.map(i => `
      <div class="flex gap-3 p-3 rounded-2xl border border-slate-200 bg-white">
        <a href="${esc(i.p.url)}" class="shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-white"><img src="${esc(i.p.image)}" alt="" class="w-full h-full object-cover scale-[1.06]"></a>
        <div class="flex-1 min-w-0">
          <a href="${esc(i.p.url)}" class="block font-semibold text-sm text-graphite leading-snug hover:text-fire-600">${esc(i.p.name)}</a>
          <div class="mt-2 flex items-center justify-between gap-2">
            <div class="flex items-center rounded-lg border border-slate-200">
              <button type="button" class="w-9 h-9 grid place-items-center text-graphite hover:text-fire-600" data-dec="${esc(i.slug)}" aria-label="Менше"><i data-lucide="minus" class="w-4 h-4"></i></button>
              <span class="w-7 text-center font-semibold text-graphite">${i.qty}</span>
              <button type="button" class="w-9 h-9 grid place-items-center text-graphite hover:text-fire-600" data-inc="${esc(i.slug)}" aria-label="Більше"><i data-lucide="plus" class="w-4 h-4"></i></button>
            </div>
            <span class="font-display font-extrabold text-fire-600 whitespace-nowrap">${fmt(i.qty * i.p.price)} грн</span>
          </div>
        </div>
        <button type="button" class="self-start w-8 h-8 grid place-items-center rounded-lg text-slate-400 hover:text-red-600" data-del="${esc(i.slug)}" aria-label="Видалити"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
      </div>`).join('');
    const empty = !ls.length;
    $('#cartItems').classList.toggle('hidden', empty);
    $('#cartFooter').classList.toggle('hidden', empty);
    $('#cartEmpty').classList.toggle('hidden', !empty);
    $$('.js-cart-total').forEach(el => el.textContent = fmt(total()));
    updateBadges();
    if (window.lucide) lucide.createIcons();
  }

  function open(step = 'items') {
    if (step === 'items' && !$('#cartDone').classList.contains('hidden')) step = 'items';
    show(step); render();
    overlay.classList.remove('hidden'); drawer.classList.remove('translate-x-full'); drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    $('#cartToast').classList.add('hidden');
  }
  function close() {
    overlay.classList.add('hidden'); drawer.classList.add('translate-x-full'); drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  function add(slug, qty = 1) {
    const p = bySlug(slug); if (!p) return;
    const it = items.find(i => i.slug === slug);
    if (it) it.qty += qty; else items.push({ slug, qty });
    save(); render();
    if (typeof fbq === 'function') fbq('track', 'AddToCart', { content_ids: [p.sku || p.slug], content_type: 'product', value: p.price, currency: 'UAH' });
    const t = $('#cartToast'); t.classList.remove('hidden'); clearTimeout(add._t); add._t = setTimeout(() => t.classList.add('hidden'), 3500);
  }
  function setQty(slug, d) {
    const it = items.find(i => i.slug === slug); if (!it) return;
    it.qty += d; if (it.qty <= 0) items = items.filter(i => i !== it);
    save(); render();
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-add-to-cart]'); if (a) { e.preventDefault(); add(a.dataset.addToCart); return; }
    if (e.target.closest('.js-cart-open')) { e.preventDefault(); open('items'); return; }
    if (e.target.closest('.js-cart-close') || e.target === overlay || e.target.closest('#cartClose')) { close(); return; }
    const inc = e.target.closest('[data-inc]'); if (inc) return setQty(inc.dataset.inc, 1);
    const dec = e.target.closest('[data-dec]'); if (dec) return setQty(dec.dataset.dec, -1);
    const del = e.target.closest('[data-del]'); if (del) { items = items.filter(i => i.slug !== del.dataset.del); save(); render(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !drawer.classList.contains('translate-x-full')) close(); });
  $('#cartCheckout').addEventListener('click', () => {
    show('form');
    if (typeof fbq === 'function') fbq('track', 'InitiateCheckout', { content_ids: lines().map(i => i.p.sku || i.slug), content_type: 'product', value: total(), currency: 'UAH', num_items: count() });
  });
  $('#cartBack').addEventListener('click', () => show('items'));

  /* ---------- Телефон ---------- */
  const digits = (v) => { let d = v.replace(/\D/g, ''); if (d.startsWith('38')) d = d.slice(2); if (d && d[0] !== '0') d = '0' + d; return d.slice(0, 10); };
  const fmtPhone = (v) => { const d = digits(v); if (!d) return ''; let o = '+38 (' + d.slice(0, 3); if (d.length > 3) o += ') ' + d.slice(3, 6); if (d.length > 6) o += '-' + d.slice(6, 8); if (d.length > 8) o += '-' + d.slice(8, 10); return o; };
  const phoneOk = (v) => { const d = digits(v); return d.length === 10 && CODES.includes(d.slice(0, 3)); };
  const ph = form.phone;
  ph.addEventListener('input', () => { ph.value = fmtPhone(ph.value); });
  ph.addEventListener('focus', () => { if (!ph.value) ph.value = '+38 (0'; });
  ph.addEventListener('blur', () => { if (digits(ph.value).length <= 1) ph.value = ''; });

  /* ---------- Нова Пошта ---------- */
  let cityRef = '', whPicked = false, npOk = true;
  async function np(modelName, calledMethod, methodProperties) {
    const r = await fetch('https://api.novaposhta.ua/v2.0/json/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: NP_API_KEY, modelName, calledMethod, methodProperties }) });
    const j = await r.json(); if (!j.success) throw new Error('NP'); return j.data;
  }
  function auto(input, search, pick) {
    const list = $(`.c-np[data-for="${input.name}"]`, form); let t, seq = 0, res = [];
    const hide = () => list.classList.add('hidden');
    async function run() {
      const my = ++seq;
      try {
        res = await search(input.value.trim()); if (my !== seq) return;
        list.innerHTML = res.length ? res.map((r, i) => `<li data-i="${i}" class="px-4 py-3 cursor-pointer hover:bg-orange-50 border-b border-slate-100 last:border-0">${r.html}</li>`).join('') : '<li class="px-4 py-3 text-slate-400">Нічого не знайдено</li>';
        list.classList.remove('hidden');
      } catch (e) { npOk = false; hide(); form.warehouse.disabled = false; form.warehouse.placeholder = 'Номер відділення або адреса'; }
    }
    input.addEventListener('input', () => {
      if (!npOk) return; clearTimeout(t);
      if (input === form.city) { cityRef = ''; whPicked = false; form.warehouse.value = ''; form.warehouse.disabled = true; form.warehouse.placeholder = 'Спершу оберіть місто'; if (input.value.trim().length < 2) return hide(); }
      else whPicked = false;
      t = setTimeout(run, 300);
    });
    input.addEventListener('focus', () => { if (npOk && input === form.warehouse && cityRef) run(); });
    list.addEventListener('pointerdown', e => { const li = e.target.closest('li[data-i]'); if (!li) return; e.preventDefault(); pick(res[+li.dataset.i]); hide(); });
    input.addEventListener('blur', () => setTimeout(hide, 150));
  }
  auto(form.city, async q => {
    const d = await np('Address', 'searchSettlements', { CityName: q, Limit: '20', Page: '1' });
    return ((d[0] && d[0].Addresses) || []).filter(a => +a.Warehouses > 0).map(a => ({ ref: a.DeliveryCity, value: a.Present, html: `<div class="font-semibold text-graphite">${esc(a.MainDescription)}</div><div class="text-xs text-slate-500">${esc(a.Present)}</div>` }));
  }, r => { form.city.value = r.value; cityRef = r.ref; whPicked = false; form.warehouse.disabled = false; form.warehouse.value = ''; form.warehouse.placeholder = 'Номер або адреса відділення / поштомату'; form.warehouse.focus(); });
  auto(form.warehouse, async q => {
    const p = { CityRef: cityRef, Limit: '50', Page: '1', Language: 'UA' }; if (q) p.FindByString = q;
    const d = await np('AddressGeneral', 'getWarehouses', p);
    return d.map(w => ({ value: w.Description, html: `<span class="text-graphite">${esc(w.Description)}</span>` }));
  }, r => { form.warehouse.value = r.value; whPicked = true; });

  /* ---------- Відправка ---------- */
  const err = (k, on) => { const el = $(`.c-err[data-for="${k}"]`, form); if (el) el.classList.toggle('hidden', !on); };
  let busy = false;
  form.addEventListener('submit', async e => {
    e.preventDefault(); if (busy || form.website.value) return;
    const firstName = form.firstName.value.trim(), lastName = form.lastName.value.trim(), name = `${firstName} ${lastName}`, phone = form.phone.value.trim(), city = form.city.value.trim(), wh = form.warehouse.value.trim(), noCall = form.noCall.checked;
    const ok = { firstName: firstName.length >= 2, lastName: lastName.length >= 2, phone: phoneOk(phone), np: city.length >= 2 && wh.length >= 1 && (!npOk || (cityRef && whPicked)) };
    Object.entries(ok).forEach(([k, v]) => err(k, !v));
    if (!ok.firstName) return form.firstName.focus(); if (!ok.lastName) return form.lastName.focus(); if (!ok.phone) return form.phone.focus(); if (!ok.np) return (cityRef ? form.warehouse : form.city).focus();
    const ls = lines(); if (!ls.length) return show('items');
    const sum = total();
    const list = ls.map(i => `• ${i.p.name} (арт. ${i.p.sku || i.slug}) × ${i.qty} = ${i.qty * i.p.price} грн`).join('\n');
    const utm = window.getStoredUTM();
    const text = ['🛒 <b>Нове замовлення (кошик)</b>', '', esc(list), '', `💰 <b>Разом:</b> ${sum} грн`, '', `👤 <b>Імʼя:</b> ${esc(name)}`, `📞 <b>Телефон:</b> ${esc(phone)}`, `🚚 <b>НП:</b> ${esc(city)}, ${esc(wh)}`,
      noCall ? '\n📵 <b>НЕ ТЕЛЕФОНУВАТИ</b> — клієнт підтвердив дані, відправляти без дзвінка' : '☎️ Потрібен дзвінок-підтвердження',
      '', `🕒 ${new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}`, utm ? `\n📊 <b>UTM:</b>\n${esc(utm)}` : ''].join('\n');
    busy = true; const btn = $('#cartSubmit'), lbl = $('.c-btn', btn), orig = lbl.innerHTML;
    btn.disabled = true; lbl.textContent = 'Відправляємо...'; $('.c-form-err', form).classList.add('hidden');
    try {
      const r = await fetch(LEADS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ text, page: location.href, fields: { type: 'Замовлення (кошик)', name, phone, city, warehouse: wh, message: list + (noCall ? '\nНе телефонувати — відправити без дзвінка' : ''), product: ls.map(i => `${i.p.name} × ${i.qty}`).join('; '), price: sum, utm } }) });
      const j = await r.json().catch(() => ({})); if (!r.ok || !j.ok) throw new Error(j.error || 'send');
      const eid = 'cart_' + Date.now();
      if (typeof fbq === 'function') {
        const data = { value: sum, currency: 'UAH', content_ids: ls.map(i => i.p.sku || i.slug), content_type: 'product', num_items: count() };
        fbq('track', 'Lead', data, { eventID: 'lead_' + eid });
        fbq('track', 'Purchase', data, { eventID: 'purchase_' + eid });
      }
      items = []; save(); form.reset(); cityRef = ''; whPicked = false; form.warehouse.disabled = npOk;
      $('#cartDoneText').textContent = noCall ? 'Замовлення прийнято. Ми відправимо його без дзвінка — номер ТТН надійде вам у SMS від Нової Пошти.' : 'Замовлення прийнято. Наш менеджер звʼяжеться з вами найближчим часом.';
      render(); show('done');
    } catch (e2) { console.error(e2); $('.c-form-err', form).classList.remove('hidden'); }
    finally { setTimeout(() => { busy = false; btn.disabled = false; lbl.innerHTML = orig; $$('.js-cart-total').forEach(el => el.textContent = fmt(total())); }, 1200); }
  });

  window.Cart = { add, open, close, count };
  updateBadges();
  if (window.lucide) lucide.createIcons(); else window.addEventListener('DOMContentLoaded', () => window.lucide && lucide.createIcons());
})();
