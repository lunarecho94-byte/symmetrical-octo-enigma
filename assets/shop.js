/* HomeNest UA — картки товарів для каталогу і блоку «Дивіться також» */
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString('uk-UA').replace(/ /g, ' ');

  function productCard(p) {
    const discount = p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    return `
      <div class="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition">
        <a href="${esc(p.url)}" class="relative block aspect-square bg-white overflow-hidden">
          <img src="${esc(p.image)}" alt="${esc(p.name)}" width="600" height="600" loading="lazy" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
          ${(p.badge || discount) ? `
          <div class="product-badges">
            ${p.badge ? `<span class="badge-tag">${esc(p.badge)}</span>` : ''}
            ${discount ? `<span class="badge-discount">-${discount}%</span>` : ''}
          </div>` : ''}
        </a>
        <div class="flex flex-col flex-1 p-4 sm:p-5">
          <a href="${esc(p.url)}" class="font-display font-bold text-base sm:text-lg text-graphite leading-snug hover:text-fire-600 line-clamp-2 min-h-[2.5rem] sm:min-h-[3.25rem]">${esc(p.name)}</a>
          <div class="mt-auto pt-4 flex items-end gap-2 flex-wrap">
            <span class="font-display font-extrabold text-2xl text-fire-600">${fmt(p.price)} грн</span>
            ${discount ? `<span class="text-sm text-slate-400 line-through mb-1">${fmt(p.oldPrice)} грн</span>` : ''}
          </div>
          <div class="mt-4 flex gap-2">
            <a href="${esc(p.url)}" class="flex-1 flex items-center justify-center min-h-[44px] rounded-xl bg-buy-600 hover:bg-buy-700 text-white font-bold transition text-sm sm:text-base">Детальніше</a>
            <button type="button" data-add-to-cart="${esc(p.slug)}" class="shrink-0 grid place-items-center w-11 min-h-[44px] rounded-xl border border-slate-200 text-graphite hover:text-fire-600 hover:border-fire-500 transition" aria-label="Додати в кошик" title="Додати в кошик"><i data-lucide="shopping-cart" class="w-5 h-5"></i></button>
          </div>
        </div>
      </div>`;
  }

  // Вивести картки в контейнер; повертає кількість показаних товарів
  window.renderProducts = function (container, { exclude = null, limit = 0 } = {}) {
    if (!container) return 0;
    let list = (window.PRODUCTS || []).filter(p => p.slug !== exclude);
    if (limit) list = list.slice(0, limit);
    container.innerHTML = list.map(productCard).join('');
    if (window.lucide) lucide.createIcons();
    return list.length;
  };

  /* ==========================================================
     ГЛОБАЛЬНА ПІДТРИМКА ТЕМИ (СВІТЛА / СИНЯ)
     ========================================================== */
  window.applyTheme = function (isDark) {
    document.documentElement.classList.toggle('dark', isDark);
    try { localStorage.setItem('theme', isDark ? 'dark' : 'light'); } catch (e) {}
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = isDark ? '#070D1E' : '#FFFFFF';
    const metaScheme = document.querySelector('meta[name="color-scheme"]');
    if (metaScheme) metaScheme.content = isDark ? 'dark' : 'only light';
    document.querySelectorAll('.js-theme-btn').forEach(btn => {
      const isThisDark = (btn.dataset.theme === 'dark');
      btn.setAttribute('aria-pressed', String(isThisDark === isDark));
    });
    if (window.lucide) lucide.createIcons();
  };

  function syncThemeUi() {
    const isDark = document.documentElement.classList.contains('dark');
    document.querySelectorAll('.js-theme-btn').forEach(btn => {
      const isThisDark = (btn.dataset.theme === 'dark');
      btn.setAttribute('aria-pressed', String(isThisDark === isDark));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncThemeUi);
  } else {
    syncThemeUi();
  }

  document.addEventListener('click', function (e) {
    const btn = e.target.closest('.js-theme-btn');
    if (btn) {
      window.applyTheme(btn.dataset.theme === 'dark');
      return;
    }
    const sw = e.target.closest('.theme-switch');
    if (sw) {
      window.applyTheme(!document.documentElement.classList.contains('dark'));
    }
  });
})();

