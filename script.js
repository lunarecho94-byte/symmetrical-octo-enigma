// Disable automatic browser scroll clamping/restoration on dynamic catalog pages
if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
    try {
        window.history.scrollRestoration = 'manual';
    } catch (_) {}
}

// Safe Meta Pixel Tracker (Bulletproof against adblockers and missing fbq)
function safeTrackFbq(eventName, eventParams) {
    try {
        if (typeof window.fbq === 'function') {
            window.fbq('track', eventName, eventParams);
        }
    } catch (_) {}
}
window.safeTrackFbq = safeTrackFbq;

// Gallery Image Switcher (Hero)
function switchGalleryImg(thumbElement, imgSrc) {
    const mainImg = document.getElementById('mainGalleryImg');
    if (mainImg) {
        mainImg.src = imgSrc;
    }

    const thumbs = document.querySelectorAll('.thumb-img');
    thumbs.forEach(t => t.classList.remove('active'));
    if (thumbElement) {
        thumbElement.classList.add('active');
    }
}

// Image Fallbacks & Auto-Retry Engine
const FALLBACK_PRODUCT_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <rect width="100%" height="100%" fill="#f8fafc"/>
  <circle cx="250" cy="220" r="85" fill="#e2e8f0"/>
  <path d="M210 230l30-30 40 40 20-20 30 30H170z" fill="#94a3b8"/>
  <circle cx="215" cy="185" r="14" fill="#94a3b8"/>
  <text x="250" y="355" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="22" font-weight="800" fill="#0f172a" text-anchor="middle" letter-spacing="1.5">URBAN</text>
  <text x="250" y="385" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="500" fill="#64748b" text-anchor="middle">Фото оновлюється на складі</text>
</svg>
`)}`;

function getCategoryFallbackImg(cat) {
    if (cat === 'clothing') return 'images/tshirt.webp';
    if (cat === 'pants') return 'images/pants.webp';
    if (cat === 'accessories' || cat === 'bags') return 'images/urbano_logo_full.webp';
    return 'images/sneakers.webp';
}

function handleCardImgError(img, cat) {
    if (!img) return;
    const retryCount = parseInt(img.dataset.retried || '0', 10);
    const originalSrc = img.dataset.srcOrig || img.getAttribute('src') || '';

    // Step 1: Retry original image once after 400ms (handles transient mobile connection hiccups)
    if (retryCount < 1 && originalSrc && originalSrc.startsWith('http')) {
        img.dataset.retried = '1';
        setTimeout(() => {
            const sep = originalSrc.includes('?') ? '&' : '?';
            img.src = `${originalSrc}${sep}_r=${Date.now()}`;
        }, 400);
        return;
    }

    // Step 2: Try category-specific local asset
    if (retryCount < 2) {
        img.dataset.retried = '2';
        img.src = getCategoryFallbackImg(cat);
        return;
    }

    // Step 3: Guaranteed indestructible SVG fallback
    img.onerror = null;
    img.src = FALLBACK_PRODUCT_SVG;
}

function handleCardThumbError(thumb, cat) {
    if (!thumb) return;
    thumb.onerror = null;
    thumb.src = getCategoryFallbackImg(cat);
}

function handlePhotoModalImgError(img, cat) {
    if (!img) return;
    const retryCount = parseInt(img.dataset.retried || '0', 10);
    const originalSrc = img.dataset.srcOrig || img.getAttribute('src') || '';

    if (retryCount < 1 && originalSrc && originalSrc.startsWith('http')) {
        img.dataset.retried = '1';
        setTimeout(() => {
            const sep = originalSrc.includes('?') ? '&' : '?';
            img.src = `${originalSrc}${sep}_r=${Date.now()}`;
        }, 400);
        return;
    }

    img.onerror = null;
    img.src = getCategoryFallbackImg(cat);
}

// Universal Card Image Switcher (Catalog Products)
function switchCardImg(thumbElement, targetImgId, imgSrc, idx) {
    const targetImg = document.getElementById(targetImgId);
    if (targetImg) {
        targetImg.src = imgSrc;
        targetImg.dataset.srcOrig = imgSrc;
        targetImg.dataset.retried = '0';
        if (typeof idx !== 'undefined') {
            targetImg.dataset.currentIndex = idx;
        }
    }
    const container = thumbElement.closest('.card-thumbnails') || thumbElement.parentElement;
    if (container) {
        container.querySelectorAll('.card-thumb-img').forEach(t => t.classList.remove('active'));
    }
    thumbElement.classList.add('active');
}

// Countdown Timer
function startTimer(durationSeconds) {
    let timer = durationSeconds;
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    if (!hoursEl && !minutesEl && !secondsEl) return;

    setInterval(() => {
        const hours = Math.floor(timer / 3600);
        const minutes = Math.floor((timer % 3600) / 60);
        const seconds = Math.floor(timer % 60);

        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minutesEl) minutesEl.textContent = String(minutes).padStart(2, '0');
        if (secondsEl) secondsEl.textContent = String(seconds).padStart(2, '0');

        if (--timer < 0) {
            timer = 15500;
        }
    }, 1000);
}

// Size Selection
function selectSize(btnElement, sizeValue) {
    const parentContainer = btnElement.closest('.size-options');
    if (!parentContainer) return;

    parentContainer.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    // Update size input in order form
    const sizeInput = document.getElementById('selectedSize');
    if (sizeInput) {
        sizeInput.value = sizeValue;
    }
}

// ==========================================
// URBAN SHOPPING CART SYSTEM
// ==========================================

const CART_STORAGE_KEY = 'urbangrid_cart_v1';

// Get Cart from localStorage
function getCart() {
    try {
        const data = localStorage.getItem(CART_STORAGE_KEY);
        const cart = data ? JSON.parse(data) : [];
        if (Array.isArray(cart) && cart.length > 0 && typeof catalogProducts !== 'undefined' && Array.isArray(catalogProducts) && catalogProducts.length > 0) {
            let changed = false;
            cart.forEach(item => {
                if (!item.art) {
                    const found = catalogProducts.find(p => p.id == item.prodId || p.name === item.title || (p.name && item.title && item.title.includes(p.name)));
                    if (found && found.art) {
                        item.art = found.art;
                        item.prodId = item.prodId || found.id;
                        item.mat = item.mat || found.mat;
                        item.origin = item.origin || found.origin;
                        changed = true;
                    }
                }
            });
            if (changed) {
                try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch (e) {}
            }
        }
        return cart;
    } catch (e) {
        return [];
    }
}

// Save Cart to localStorage and update UI
function saveCart(cart) {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (e) {}
    renderCart();
}

// Show animated Toast Notification
function showCartToast(msg) {
    let toast = document.getElementById('cartToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    if (window._cartToastTimeout) clearTimeout(window._cartToastTimeout);
    window._cartToastTimeout = setTimeout(() => {
        toast.classList.remove('visible');
    }, 2800);
}

// Add Item to Cart
function addToCart(item) {
    const cart = getCart();
    const existingIndex = cart.findIndex(i => i.id === item.id);
    if (existingIndex > -1) {
        cart[existingIndex].qty += (item.qty || 1);
        if (!cart[existingIndex].art && item.art) cart[existingIndex].art = item.art;
        if (!cart[existingIndex].prodId && item.prodId) cart[existingIndex].prodId = item.prodId;
        if (!cart[existingIndex].mat && item.mat) cart[existingIndex].mat = item.mat;
        if (!cart[existingIndex].origin && item.origin) cart[existingIndex].origin = item.origin;
    } else {
        cart.push(item);
    }
    saveCart(cart);
    const artBadge = item.art ? ` [Арт: ${item.art}]` : '';
    showCartToast(`"${item.title}"${artBadge} (${item.size}) додано в кошик!`);
    openCart();

    // Ad Conversion Tracking (Meta Pixel & GA4)
    safeTrackFbq('AddToCart', {
        content_name: item.title,
        value: item.price,
        currency: 'UAH'
    });
    if (window.gtag) {
        try {
            gtag('event', 'add_to_cart', {
                currency: 'UAH',
                value: item.price,
                items: [{ item_name: item.title, price: item.price, quantity: item.qty || 1 }]
            });
        } catch (e) {}
    }
}

// Update Item Quantity in Cart
function updateCartQty(id, delta) {
    let cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        cart = cart.filter(i => i.id !== id);
        showCartToast(`Товар видалено з кошика`);
    }
    saveCart(cart);
}

// Remove Item from Cart
function removeFromCart(id) {
    let cart = getCart();
    cart = cart.filter(i => i.id !== id);
    saveCart(cart);
    showCartToast(`Товар видалено з кошика`);
}

// Clear Entire Cart
function clearCart() {
    try {
        localStorage.removeItem(CART_STORAGE_KEY);
    } catch (e) {}
    renderCart();
}

// Open Cart Drawer
function openCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (drawer) drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.classList.add('cart-open');
}

// Close Cart Drawer
function closeCart() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('cart-open');
    hideCartCheckoutForm();
}

// Toggle Cart Drawer
function toggleCart() {
    const drawer = document.getElementById('cartDrawer');
    if (drawer && drawer.classList.contains('active')) {
        closeCart();
    } else {
        openCart();
    }
}

// ==========================================
// FAVORITES (ОБРАНЕ) STORAGE & ENGINE
// ==========================================
const FAVORITES_STORAGE_KEY = 'ug_favorites';

function getFavorites() {
    try {
        const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        return [];
    }
}

function saveFavorites(favs) {
    try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favs));
    } catch (e) {}
    updateFavoritesUI();
}

function isFavorite(productId) {
    if (!productId) return false;
    const favs = getFavorites();
    return favs.some(f => String(f.id) === String(productId));
}

function toggleFavorite(productId, event) {
    if (event && event.stopPropagation) {
        event.stopPropagation();
    }
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    if (!productId) return;

    let favs = getFavorites();
    const existingIndex = favs.findIndex(f => String(f.id) === String(productId));

    if (existingIndex > -1) {
        const removedItem = favs[existingIndex];
        favs.splice(existingIndex, 1);
        saveFavorites(favs);
        showCartToast(`"${removedItem.name || 'Товар'}" видалено з Обраного`);
    } else {
        let item = null;
        if (catalogAllProducts && catalogAllProducts.length) {
            item = catalogAllProducts.find(p => String(p.id) === String(productId));
        }
        if (!item && catalogFilteredProducts && catalogFilteredProducts.length) {
            item = catalogFilteredProducts.find(p => String(p.id) === String(productId));
        }
        if (!item) {
            const card = document.getElementById(`prod-${productId}`);
            if (card) {
                const cardImg = card.querySelector('.product-img-wrapper img');
                item = {
                    id: productId,
                    name: card.dataset.name || 'Товар',
                    brand: card.dataset.brand || '',
                    brand_name: card.dataset.brand || '',
                    art: card.dataset.art || '',
                    cat: card.dataset.category || 'shoes',
                    price: parseInt(card.dataset.price || '0', 10),
                    imgs: cardImg && cardImg.src ? [cardImg.dataset.srcOrig || cardImg.src] : ['images/sneakers.webp'],
                    sizes: []
                };
            }
        }

        if (item) {
            const compactItem = {
                id: String(item.id),
                name: item.name,
                brand: item.brand || item.brand_name || '',
                brand_name: item.brand_name || item.brand || '',
                art: item.art || '',
                cat: item.cat || 'shoes',
                price: item.price,
                old_price: item.old_price || null,
                img: (item.imgs && item.imgs[0]) ? item.imgs[0] : (item.img || 'images/sneakers.webp'),
                sizes: (item.sizes && item.sizes.length) ? item.sizes : []
            };
            favs.push(compactItem);
            saveFavorites(favs);
            showCartToast(`"${compactItem.name}" додано в Обране!`);

            // Meta Pixel Wishlist Tracking
            safeTrackFbq('AddToWishlist', {
                content_name: compactItem.name,
                content_category: compactItem.cat || 'shoes',
                content_ids: [String(compactItem.id)],
                value: compactItem.price || 0,
                currency: 'UAH'
            });
        }
    }

    updateFavoritesUI();

    // If currently filtered by favorites in catalog, re-apply filter to refresh grid
    if (currentCatalogGender === 'favorites') {
        applyCatalogFilters();
    }
}

function updateFavoritesUI() {
    const favs = getFavorites();
    const count = favs.length;

    // Badges
    const headerBadge = document.getElementById('headerFavBadge');
    if (headerBadge) {
        headerBadge.textContent = count;
        headerBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    const bottomBadge = document.getElementById('bottomFavBadge');
    if (bottomBadge) {
        bottomBadge.textContent = count;
        bottomBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }

    const filterBadge = document.getElementById('badgeGender_fav');
    if (filterBadge) {
        filterBadge.textContent = count;
    }

    const drawerCount = document.getElementById('favoritesDrawerTotalCount');
    if (drawerCount) {
        drawerCount.textContent = count;
    }

    // Card buttons
    const favSet = new Set(favs.map(f => String(f.id)));
    document.querySelectorAll('.btn-card-fav').forEach(btn => {
        const prodId = btn.dataset.id;
        if (prodId) {
            const isFav = favSet.has(String(prodId));
            btn.classList.toggle('active', isFav);
            btn.setAttribute('aria-label', isFav ? 'Видалити з обраного' : 'Додати в обране');
            btn.setAttribute('title', isFav ? 'Видалити з обраного' : 'Додати в обране');
            const svg = btn.querySelector('svg');
            if (svg) {
                svg.setAttribute('fill', isFav ? '#ef4444' : '#ffffff');
                svg.setAttribute('stroke', isFav ? '#ef4444' : '#000000');
            }
        }
    });

    // Photo modal favorite button
    const photoFavBtn = document.getElementById('btnPhotoFav');
    if (photoFavBtn && currentPhotoItem) {
        const isFav = favSet.has(String(currentPhotoItem.id));
        photoFavBtn.classList.toggle('active', isFav);
        photoFavBtn.setAttribute('title', isFav ? 'Видалити з обраного' : 'Додати в обране');
        const svg = photoFavBtn.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', isFav ? '#ef4444' : 'none');
            svg.setAttribute('stroke', isFav ? '#ef4444' : 'currentColor');
        }
    }

    // Drawer content if active
    const drawer = document.getElementById('favoritesDrawer');
    if (drawer && drawer.classList.contains('active')) {
        renderFavoritesDrawer();
    }
}

function renderFavoritesDrawer() {
    const body = document.getElementById('favoritesDrawerBody');
    const footer = document.getElementById('favoritesDrawerFooter');
    if (!body) return;

    const favs = getFavorites();

    if (favs.length === 0) {
        body.innerHTML = `
            <div class="fav-empty-state">
                <div class="fav-empty-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg></div>
                <h4>Список обраного порожній</h4>
                <p>Зберігайте вподобані моделі кросівок та одягу, натиснувши на іконку сердечка на картці товару.</p>
                <button type="button" class="btn-primary" onclick="closeFavoritesDrawer(); if (document.getElementById('catalog')) { document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' }); } else { if (typeof returnToCatalogProduct === 'function') { returnToCatalogProduct(); } else { window.location.href = 'index.html'; } }">
                    Перейти до каталогу
                </button>
            </div>
        `;
        if (footer) footer.style.display = 'none';
        return;
    }

    if (footer) footer.style.display = 'flex';

    body.innerHTML = favs.map(item => {
        const displayName = formatProductDisplayName(item);
        const imgUrl = item.img || (item.imgs && item.imgs[0]) || 'images/sneakers.webp';
        const formattedPrice = item.price.toLocaleString('uk-UA') + ' грн';
        const sizes = item.sizes || [];
        const hasSizes = sizes.length > 0;

        let sizeSelectHtml = '';
        if (hasSizes) {
            sizeSelectHtml = `
                <div class="fav-item-size-wrap">
                    <label for="favSize_${item.id}">Розмір:</label>
                    <select id="favSize_${item.id}" class="fav-size-select" onclick="event.stopPropagation()">
                        ${sizes.map(sz => `<option value="${escapeHtml(String(sz).trim())}">${escapeHtml(formatSizeLabel(String(sz).trim()))}</option>`).join('')}
                    </select>
                </div>
            `;
        }

        const prodUrl = getProductUrl(item);

        return `
            <div class="fav-item-card" id="favItem_${item.id}">
                <a href="${prodUrl}" class="fav-item-img-box" onclick="closeFavoritesDrawer(); openProductPage('${item.id}', event, '${prodUrl}', false);" title="Переглянути товар">
                    <img src="${imgUrl}" alt="${escapeHtml(displayName)}" loading="lazy" referrerpolicy="no-referrer" onerror="handleCardThumbError(this, '${item.cat || 'shoes'}')">
                </a>
                <div class="fav-item-info">
                    <div class="fav-item-top">
                        <span class="fav-item-art">АРТ: ${escapeHtml(item.art || '---')}</span>
                        <button type="button" class="btn-fav-remove" onclick="toggleFavorite('${item.id}', event)" aria-label="Видалити з обраного" title="Видалити">✕</button>
                    </div>
                    <a href="${prodUrl}" onclick="closeFavoritesDrawer(); openProductPage('${item.id}', event, '${prodUrl}', false);" style="text-decoration:none; color:inherit;">
                        <h4 class="fav-item-title" title="Переглянути товар">${escapeHtml(displayName)}</h4>
                    </a>
                    <div class="fav-item-price">${formattedPrice}</div>
                    ${sizeSelectHtml}
                    <div class="fav-item-actions">
                        <button type="button" class="btn-fav-to-cart" onclick="addFavoriteItemToCart('${item.id}')">
                            <span>В кошик</span>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function addFavoriteItemToCart(productId) {
    const favs = getFavorites();
    const item = favs.find(f => String(f.id) === String(productId));
    if (!item) return;

    let selectedSize = 'One Size';
    const sizeSelect = document.getElementById(`favSize_${item.id}`);
    if (sizeSelect && sizeSelect.value) {
        selectedSize = sizeSelect.value;
    } else if (item.sizes && item.sizes.length > 0) {
        selectedSize = String(item.sizes[0]).trim();
    }

    addToCart({
        id: `${item.id}_${selectedSize}`,
        prodId: item.id,
        title: item.name,
        art: item.art,
        price: item.price,
        size: selectedSize,
        img: item.img || (item.imgs && item.imgs[0]) || 'images/sneakers.webp',
        qty: 1
    });

    closeFavoritesDrawer();
}

function addAllFavoritesToCart() {
    const favs = getFavorites();
    if (!favs.length) return;

    favs.forEach(item => {
        const sizeSelect = document.getElementById(`favSize_${item.id}`);
        const selectedSize = (sizeSelect && sizeSelect.value) ? sizeSelect.value : ((item.sizes && item.sizes.length) ? String(item.sizes[0]).trim() : 'One Size');
        addToCart({
            id: `${item.id}_${selectedSize}`,
            prodId: item.id,
            title: item.name,
            art: item.art,
            price: item.price,
            size: selectedSize,
            img: item.img || (item.imgs && item.imgs[0]) || 'images/sneakers.webp',
            qty: 1
        });
    });

    closeFavoritesDrawer();
    openCart();
    showCartToast(`Всі товари з Обраного (${favs.length}) додано в кошик!`);
}

function clearFavorites() {
    if (!confirm('Ви дійсно бажаєте очистити весь список обраного?')) return;
    try {
        localStorage.removeItem(FAVORITES_STORAGE_KEY);
    } catch (e) {}
    updateFavoritesUI();
    showCartToast('Список обраного очищено');
}

function openFavoritesDrawer() {
    const drawer = document.getElementById('favoritesDrawer');
    const overlay = document.getElementById('favoritesDrawerOverlay');
    if (drawer) drawer.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.classList.add('fav-open');
    renderFavoritesDrawer();
}

function closeFavoritesDrawer() {
    const drawer = document.getElementById('favoritesDrawer');
    const overlay = document.getElementById('favoritesDrawerOverlay');
    if (drawer) drawer.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
    document.body.classList.remove('fav-open');
}

function toggleFavoritesDrawer() {
    const drawer = document.getElementById('favoritesDrawer');
    if (drawer && drawer.classList.contains('active')) {
        closeFavoritesDrawer();
    } else {
        openFavoritesDrawer();
    }
}

function toggleCurrentPhotoFavorite() {
    if (!currentPhotoItem) return;
    toggleFavorite(currentPhotoItem.id);
}

function toggleFavoritesFilter(btnEl) {
    if (currentCatalogGender === 'favorites') {
        selectCatalogGender('all', document.querySelector('.gender-pill-btn[data-gender="all"]'));
    } else {
        selectCatalogGender('favorites', btnEl);
    }
}

function viewFavoritesInCatalog() {
    closeFavoritesDrawer();
    if (!document.getElementById('catalog')) {
        window.location.href = 'index.html?gender=favorites#catalog';
        return;
    }
    const favTab = document.getElementById('btnFilterFav');
    if (favTab) {
        toggleFavoritesFilter(favTab);
    }
    const catalog = document.getElementById('catalog');
    if (catalog) {
        catalog.scrollIntoView({ behavior: 'smooth' });
    }
}

// Render Cart UI (Drawer, Badges, Checkout Summary)
function renderCart() {
    const cart = getCart();
    const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    // Update Badges
    const badgeEls = document.querySelectorAll('.cart-badge');
    badgeEls.forEach(badge => {
        badge.textContent = totalCount;
        if (totalCount > 0) {
            badge.classList.add('has-items');
        } else {
            badge.classList.remove('has-items');
        }
    });

    const drawerCountEl = document.getElementById('cartDrawerTotalCount');
    if (drawerCountEl) drawerCountEl.textContent = totalCount;

    const drawerPriceEl = document.getElementById('cartDrawerTotalPrice');
    if (drawerPriceEl) {
        drawerPriceEl.textContent = totalPrice.toLocaleString('uk-UA') + ' грн';
    }

    // Render Drawer Items
    const drawerBody = document.getElementById('cartDrawerBody');
    const drawerFooter = document.getElementById('cartDrawerFooter');

    if (drawerBody) {
        if (cart.length === 0) {
            drawerBody.innerHTML = `
                <div class="cart-empty-state">
                    <div class="cart-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
                    <h4>Ваш кошик порожній</h4>
                    <p>Перегляньте наш каталог трендових кросівок та оберіть свою пару!</p>
                    <a href="javascript:void(0)" class="btn-primary-sm btn-go-catalog" onclick="closeCart(); if (document.getElementById('catalog')) { const c = document.getElementById('catalog'); if (c) c.scrollIntoView({ behavior: 'smooth' }); } else { if (typeof returnToCatalogProduct === 'function') { returnToCatalogProduct(); } else { window.location.href = 'index.html'; } }">
                        Перейти до каталогу
                    </a>
                </div>
            `;
            if (drawerFooter) drawerFooter.style.display = 'none';
        } else {
            if (drawerFooter) drawerFooter.style.display = 'block';
            let html = '<div class="cart-items-list">';
            cart.forEach(item => {
                const itemTotal = (item.price * item.qty).toLocaleString('uk-UA');
                const cartProdUrl = item.prodId ? `/product/${generateProductSlug(item.title, item.prodId)}` : '';
                html += `
                    <div class="cart-item" data-id="${item.id}">
                        ${cartProdUrl ? `<a href="${cartProdUrl}" onclick="closeCart()" class="cart-item-img-link" title="Переглянути товар"><img src="${item.img}" alt="${item.title}" class="cart-item-img" referrerpolicy="no-referrer" onerror="handleCardThumbError(this, 'shoes')"></a>` : `<img src="${item.img}" alt="${item.title}" class="cart-item-img" referrerpolicy="no-referrer" onerror="handleCardThumbError(this, 'shoes')">`}
                        <div class="cart-item-info">
                            ${cartProdUrl ? `<a href="${cartProdUrl}" onclick="closeCart()" style="text-decoration:none; color:inherit;" title="Переглянути товар"><h4 class="cart-item-title">${item.title}</h4></a>` : `<h4 class="cart-item-title">${item.title}</h4>`}
                            <div class="cart-item-meta">
                                <span class="cart-item-size">Розмір: <b>${item.size}</b></span>
                                ${item.art ? `<span class="cart-item-art" style="margin-left: 8px; color: #64748b; font-size: 0.8rem;">Арт: <b>${item.art}</b></span>` : ''}
                            </div>
                            <div class="cart-item-price-row">
                                <span class="cart-item-price">${itemTotal} грн</span>
                                <div class="cart-qty-ctrls">
                                    <button type="button" class="cart-qty-btn minus" onclick="updateCartQty('${item.id}', -1)" aria-label="Зменшити">−</button>
                                    <span class="cart-qty-val">${item.qty}</span>
                                    <button type="button" class="cart-qty-btn plus" onclick="updateCartQty('${item.id}', 1)" aria-label="Збільшити">+</button>
                                </div>
                            </div>
                        </div>
                        <button type="button" class="cart-item-remove" onclick="removeFromCart('${item.id}')" aria-label="Видалити">✕</button>
                    </div>
                `;
            });
            html += '</div>';
            drawerBody.innerHTML = html;
        }
    }

    // Sync Checkout Form
    syncCartWithForm();
}

// Synchronize Cart Data into Checkout Form
function syncCartWithForm() {
    const cart = getCart();
    const summaryBox = document.getElementById('cartOrderSummaryBox');
    const summaryList = document.getElementById('cartOrderSummaryList');
    const hiddenDetails = document.getElementById('cartOrderDetails');
    const hiddenTotal = document.getElementById('cartTotalSum');
    const finalPriceDisplay = document.getElementById('finalOrderPrice');
    const singleProductGroup = document.getElementById('formSingleProductGroup');
    const singleSizeGroup = document.getElementById('formSingleSizeGroup');
    const productSelect = document.getElementById('productSelect');
    const selectedSize = document.getElementById('selectedSize');

    if (cart.length > 0) {
        const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
        const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const formattedTotal = totalPrice.toLocaleString('uk-UA') + ' грн';

        if (summaryBox) summaryBox.style.display = 'block';
        if (singleProductGroup) singleProductGroup.style.display = 'none';
        if (singleSizeGroup) singleSizeGroup.style.display = 'none';
        if (productSelect) productSelect.disabled = true;
        if (selectedSize) selectedSize.disabled = true;

        if (summaryList) {
            let listHtml = '';
            cart.forEach((item, idx) => {
                listHtml += `
                    <div class="cart-summary-line-item">
                        <img src="${item.img}" alt="${item.title}" class="cart-summary-item-img" referrerpolicy="no-referrer" onerror="handleCardThumbError(this, 'shoes')">
                        <div class="cart-summary-item-text">
                            <b>${idx + 1}. ${item.title}</b>
                            <span>${item.art ? `Арт: <b>${item.art}</b> | ` : ''}Розмір: <b>${item.size}</b> | К-сть: <b>${item.qty} шт.</b> — ${(item.price * item.qty).toLocaleString('uk-UA')} грн</span>
                        </div>
                    </div>
                `;
            });
            summaryList.innerHTML = listHtml;
        }

        // Formatted plain text for email in FormSubmit
        if (hiddenDetails) {
            let text = `Кількість позицій у кошику: ${totalCount}\n`;
            cart.forEach((item, idx) => {
                text += `${idx + 1}. ${item.title} | ${item.art ? `Арт: ${item.art} | ` : ''}Розмір: ${item.size} | Кількість: ${item.qty} шт. | Вартість: ${(item.price * item.qty).toLocaleString('uk-UA')} грн\n`;
            });
            text += `ЗАГАЛЬНА СУМА: ${formattedTotal}`;
            hiddenDetails.value = text;
        }

        if (hiddenTotal) {
            hiddenTotal.value = formattedTotal;
        }

        if (finalPriceDisplay) {
            finalPriceDisplay.textContent = formattedTotal;
        }
    } else {
        if (summaryBox) summaryBox.style.display = 'none';
        if (singleProductGroup) singleProductGroup.style.display = '';
        if (singleSizeGroup) singleSizeGroup.style.display = '';
        if (productSelect) productSelect.disabled = false;
        if (selectedSize) selectedSize.disabled = false;
        if (hiddenDetails) hiddenDetails.value = '';
        if (hiddenTotal) hiddenTotal.value = '';
        updateFormPrice();
    }
}

// Proceed to Checkout from Cart Drawer
function proceedToCheckoutFromCart() {
    closeCart();
    const orderSection = document.getElementById('order-form');
    if (orderSection) {
        orderSection.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => {
        const nameInput = document.getElementById('fullName');
        if (nameInput) nameInput.focus();
    }, 450);
}

// Select specific model and add to cart from product cards
function selectModelInForm(modelVal, priceStr, evt, prodIdParam) {
    const event = evt || window.event;
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    const clickedEl = event ? event.target : null;
    const card = clickedEl ? clickedEl.closest('.product-card') : null;

    let selectedSizeVal = '42 (26.5 см)';
    let imgUrl = 'images/sneakers.webp';
    let cleanTitle = modelVal.replace(/\s*\(\d+\s*грн\)$/i, '').trim();
    let artVal = (card ? card.dataset.art : '') || '';
    let prodIdVal = prodIdParam || (card ? card.dataset.id : '') || '';
    let matVal = (card ? card.dataset.mat : '') || '';
    let originVal = (card ? card.dataset.origin : '') || '';

    if (card) {
        const activeSizeBtn = card.querySelector('.size-btn.active');
        if (activeSizeBtn) {
            const onclickAttr = activeSizeBtn.getAttribute('onclick') || '';
            const match = onclickAttr.match(/selectSize\(this,\s*['"]([^'"]+)['"]\)/);
            selectedSizeVal = match ? match[1] : activeSizeBtn.textContent.trim();
        }
        const img = card.querySelector('.product-img-wrapper img');
        if (img) {
            imgUrl = img.getAttribute('src') || img.src;
        }
        const titleEl = card.querySelector('.product-title');
        if (titleEl && titleEl.textContent.trim()) {
            cleanTitle = titleEl.textContent.trim();
        }
        if (!artVal) {
            const artEl = card.querySelector('.spec-row .spec-val b') || card.querySelector('.product-specs b');
            if (artEl) artVal = artEl.textContent.trim();
        }
    }

    // Lookup in catalogProducts if still missing art
    if ((!artVal || !prodIdVal) && typeof catalogProducts !== 'undefined' && Array.isArray(catalogProducts)) {
        const found = catalogProducts.find(p => p.id == prodIdVal || p.name === cleanTitle);
        if (found) {
            if (!artVal) artVal = found.art || '';
            if (!prodIdVal) prodIdVal = found.id || '';
            if (!matVal) matVal = found.mat || '';
            if (!originVal) originVal = found.origin || '';
        }
    }

    const numericPrice = parseInt(priceStr.replace(/\D/g, ''), 10) || 0;

    // Add to cart with complete details (SKU, title, size, mat, origin, link)
    addToCart({
        id: (prodIdVal ? prodIdVal + '___' : cleanTitle + '___') + selectedSizeVal,
        prodId: prodIdVal,
        title: cleanTitle,
        art: artVal,
        mat: matVal,
        origin: originVal,
        size: selectedSizeVal,
        price: numericPrice,
        priceFormatted: priceStr,
        img: imgUrl,
        qty: 1
    });

    // Also update 1-Click Order Form with chosen model AND article!
    const quickChosenInput = document.getElementById('quickOrderChosenModel');
    const artBadge = artVal ? ` (Арт: ${artVal})` : '';
    if (quickChosenInput) {
        quickChosenInput.value = `${cleanTitle}${artBadge} — Розмір: ${selectedSizeVal} — ${priceStr}`;
    }
    const quickBanner = document.getElementById('quickOrderModelBanner');
    const quickName = document.getElementById('quickOrderModelName');
    if (quickBanner && quickName) {
        quickName.textContent = `${cleanTitle}${artBadge} (${selectedSizeVal}) — ${priceStr}`;
        quickBanner.style.display = 'flex';
    }

    // Also update single-product select in form for backup
    const select = document.getElementById('productSelect');
    if (select) {
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value.includes(modelVal) || select.options[i].text.includes(cleanTitle)) {
                select.selectedIndex = i;
                break;
            }
        }
    }
    const sizeInput = document.getElementById('selectedSize');
    if (sizeInput) {
        sizeInput.value = selectedSizeVal;
    }
}

// Update Price in Checkout Form
function updateFormPrice() {
    const select = document.getElementById('productSelect');
    const priceDisplay = document.getElementById('finalOrderPrice');
    if (!select || !priceDisplay) return;

    const val = select.value;
    const match = val.match(/\((\d+)\s*грн\)/);
    if (match) {
        priceDisplay.textContent = parseInt(match[1], 10).toLocaleString('uk-UA') + ' грн';
        return;
    }
    if (val.includes('3300')) {
        priceDisplay.textContent = '3 300 грн';
    } else if (val.includes('3100')) {
        priceDisplay.textContent = '3 100 грн';
    } else if (val.includes('3000')) {
        priceDisplay.textContent = '3 000 грн';
    } else if (val.includes('2900')) {
        priceDisplay.textContent = '2 900 грн';
    } else if (val.includes('2850')) {
        priceDisplay.textContent = '2 850 грн';
    } else if (val.includes('2800')) {
        priceDisplay.textContent = '2 800 грн';
    } else if (val.includes('2750')) {
        priceDisplay.textContent = '2 750 грн';
    } else if (val.includes('2700')) {
        priceDisplay.textContent = '2 700 грн';
    } else if (val.includes('2670')) {
        priceDisplay.textContent = '2 670 грн';
    } else if (val.includes('2620')) {
        priceDisplay.textContent = '2 620 грн';
    } else if (val.includes('2600')) {
        priceDisplay.textContent = '2 600 грн';
    } else if (val.includes('2590')) {
        priceDisplay.textContent = '2 590 грн';
    } else if (val.includes('2550')) {
        priceDisplay.textContent = '2 550 грн';
    } else if (val.includes('2500')) {
        priceDisplay.textContent = '2 500 грн';
    } else if (val.includes('2450')) {
        priceDisplay.textContent = '2 450 грн';
    } else if (val.includes('2400')) {
        priceDisplay.textContent = '2 400 грн';
    } else if (val.includes('2380')) {
        priceDisplay.textContent = '2 380 грн';
    } else if (val.includes('2350')) {
        priceDisplay.textContent = '2 350 грн';
    } else if (val.includes('2330')) {
        priceDisplay.textContent = '2 330 грн';
    } else if (val.includes('2320')) {
        priceDisplay.textContent = '2 320 грн';
    } else if (val.includes('2280')) {
        priceDisplay.textContent = '2 280 грн';
    } else if (val.includes('2260')) {
        priceDisplay.textContent = '2 260 грн';
    } else if (val.includes('2200')) {
        priceDisplay.textContent = '2 200 грн';
    } else if (val.includes('2140')) {
        priceDisplay.textContent = '2 140 грн';
    } else if (val.includes('1990')) {
        priceDisplay.textContent = '1 990 грн';
    } else if (val.includes('1690')) {
        priceDisplay.textContent = '1 690 грн';
    } else {
        priceDisplay.textContent = '1 690 грн';
    }
}

// Payment Method Switcher (COD vs Prepayment)
function handlePaymentChange(input) {
    document.querySelectorAll('.payment-card').forEach(card => card.classList.remove('active'));
    const parent = input.closest('.payment-card');
    if (parent) parent.classList.add('active');

    const submitBtn = document.getElementById('submitOrderBtn');
    const summaryLabel = document.getElementById('orderSummaryLabel');
    const paymentSubtext = document.getElementById('orderPaymentSubtext');
    const securityNote = document.getElementById('formSecurityNote');

    if (input.value.includes('Передплата') || input.value.includes('передплата') || input.value.includes('карт')) {
        if (submitBtn) submitBtn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ (ОПЛАТА НА КАРТУ)';
        if (summaryLabel) summaryLabel.textContent = 'Разом до сплати (оплата на карту):';
        if (paymentSubtext) paymentSubtext.textContent = 'Економія на комісії Нової Пошти (без переплат за переказ)';
        if (securityNote) securityNote.innerHTML = '<b>Оплата на карту:</b> реквізити для оплати надішле менеджер після підтвердження замовлення.';
    } else {
        if (submitBtn) submitBtn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ (НАКЛАДЕНИЙ ПЛАТІЖ)';
        if (summaryLabel) summaryLabel.textContent = 'Разом до сплати при отриманні:';
        if (paymentSubtext) paymentSubtext.textContent = 'Огляд та примірка перед оплатою на Новій Пошті';
        if (securityNote) securityNote.innerHTML = '<b>Накладений платіж:</b> без обов\'язкової передплати, оплата після огляду та примірки.';
    }
}

// Size Calculator Modal
function openSizeGuideModal() {
    const modal = document.getElementById('sizeModal');
    if (modal) modal.classList.add('active');
}

function closeSizeGuideModal() {
    const modal = document.getElementById('sizeModal');
    if (modal) modal.classList.remove('active');
}

function calculateRecommendedSize() {
    const footInput = document.getElementById('userFoot');
    const foot = footInput ? (parseFloat(footInput.value) || 24) : 24;

    let shoe = '38 (24 см)';
    if (foot >= 26) shoe = '41 (26.5 см)';
    else if (foot >= 25) shoe = '40 (25.5 см)';
    else if (foot >= 24.2) shoe = '39 (24.5 см)';
    else if (foot >= 23.8) shoe = '38 (24 см)';
    else if (foot >= 23.2) shoe = '37 (23.5 см)';
    else shoe = '36 (23 см)';

    const recEl = document.getElementById('recShoeSize');
    if (recEl) recEl.textContent = shoe;
    const resEl = document.getElementById('calcResult');
    if (resEl) resEl.classList.remove('hidden');
}

function applyCalculatedSize() {
    const recEl = document.getElementById('recShoeSize');
    const shoe = recEl ? recEl.textContent : '38 (24 см)';

    const sizeInput = document.getElementById('selectedSize');
    if (sizeInput) {
        sizeInput.value = shoe;
    }
    closeSizeGuideModal();

    const orderSection = document.getElementById('order-form');
    if (orderSection) {
        orderSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==========================================================================
// PDF INVOICE GENERATION & ORDER SUBMISSION
// ==========================================================================
let lastGeneratedPdfBlob = null;
let lastGeneratedPdfName = 'Zamovlennya_URBAN.pdf';
let isSubmittingOrder = false;

function populatePdfTemplate(orderId, orderDate) {
    const cart = getCart();
    const customerName = (document.getElementById('cartFullName')?.value || document.getElementById('quickFullName')?.value || document.getElementById('fullName')?.value || '').trim() || 'Покупець';
    const customerPhone = (document.getElementById('cartPhone')?.value || document.getElementById('quickPhone')?.value || document.getElementById('phone')?.value || '').trim() || '—';
    const customerAddress = (document.getElementById('cityNP')?.value || document.getElementById('npCityName')?.value || '').trim() || '—';
    
    const payRadio = document.querySelector('input[name="cartPayment"]:checked, input[name="Оплата"]:checked, input[name="Спосіб оплати"]:checked');
    const paymentMethod = payRadio ? payRadio.value : 'Накладений платіж (при отриманні)';

    // Update Header Meta
    const badgeEl = document.getElementById('pdfOrderNumberBadge');
    if (badgeEl) badgeEl.textContent = `№ ${orderId}`;
    
    const dateEl = document.getElementById('pdfOrderDateText');
    if (dateEl) dateEl.textContent = orderDate;

    // Update Customer Info
    const nameEl = document.getElementById('pdfCustomerName');
    if (nameEl) nameEl.textContent = customerName;

    const phoneEl = document.getElementById('pdfCustomerPhone');
    if (phoneEl) phoneEl.textContent = customerPhone;

    const addrEl = document.getElementById('pdfCustomerAddress');
    if (addrEl) addrEl.textContent = customerAddress;

    const payEl = document.getElementById('pdfPaymentMethod');
    if (payEl) payEl.textContent = paymentMethod;

    const payNoteEl = document.getElementById('pdfPaymentTypeNote');
    if (payNoteEl) payNoteEl.textContent = paymentMethod;

    // Update Items Table
    const tbody = document.getElementById('pdfOrderItemsList');
    let subtotal = 0;

    if (tbody) {
        let rowsHtml = '';
        if (cart && cart.length > 0) {
            cart.forEach((item, index) => {
                const itemTotal = (item.price || 0) * (item.qty || 1);
                subtotal += itemTotal;
                rowsHtml += `
                    <tr>
                        <td style="text-align: center;">${index + 1}</td>
                        <td>
                            <div class="pdf-item-title">${item.title}</div>
                            ${item.art ? `<div class="pdf-item-art" style="font-size: 11px; color: #475569; margin-top: 3px;">Артикул (SKU): <b>${item.art}</b></div>` : ''}
                            ${item.origin ? `<div style="font-size: 10px; color: #94a3b8;">Виробник: ${item.origin}</div>` : ''}
                        </td>
                        <td style="text-align: center;"><b>${item.size}</b></td>
                        <td style="text-align: center;">${item.qty}</td>
                        <td style="text-align: right;">${item.price.toLocaleString('uk-UA')} грн</td>
                        <td style="text-align: right;"><b>${itemTotal.toLocaleString('uk-UA')} грн</b></td>
                    </tr>
                `;
            });
        } else {
            const productSelect = document.getElementById('productSelect');
            const selectedModel = productSelect ? productSelect.value : 'Кросівки URBAN';
            const sizeInput = document.getElementById('selectedSize');
            const chosenSize = sizeInput ? sizeInput.value : '38 (24 см)';
            const finalPriceEl = document.getElementById('finalOrderPrice');
            const priceText = finalPriceEl ? finalPriceEl.textContent : '2 670 грн';
            const numPrice = parseInt(priceText.replace(/\D/g, ''), 10) || 2670;
            subtotal = numPrice;

            rowsHtml = `
                <tr>
                    <td style="text-align: center;">1</td>
                    <td>
                        <div class="pdf-item-title">${selectedModel}</div>
                    </td>
                    <td style="text-align: center;"><b>${chosenSize}</b></td>
                    <td style="text-align: center;">1</td>
                    <td style="text-align: right;">${numPrice.toLocaleString('uk-UA')} грн</td>
                    <td style="text-align: right;"><b>${numPrice.toLocaleString('uk-UA')} грн</b></td>
                </tr>
            `;
        }
        tbody.innerHTML = rowsHtml;
    }

    const subtotalEl = document.getElementById('pdfSubtotalSum');
    if (subtotalEl) subtotalEl.textContent = `${subtotal.toLocaleString('uk-UA')} грн`;

    const grandTotalEl = document.getElementById('pdfGrandTotalSum');
    if (grandTotalEl) grandTotalEl.textContent = `${subtotal.toLocaleString('uk-UA')} грн`;

    return {
        orderId,
        orderDate,
        customerName,
        customerPhone,
        customerAddress,
        paymentMethod,
        subtotalFormatted: `${subtotal.toLocaleString('uk-UA')} грн`,
        itemsSummary: cart && cart.length > 0 
            ? cart.map(i => `${i.title}${i.art ? ` (Арт: ${i.art})` : ''} [${i.size}] × ${i.qty}`).join(', ')
            : `${document.getElementById('productSelect')?.value || ''} [${document.getElementById('selectedSize')?.value || ''}]`
    };
}

async function generateOrderPdf(orderId, orderDate) {
    const orderData = populatePdfTemplate(orderId, orderDate);
    const element = document.getElementById('orderPdfInvoiceTemplate');
    const cleanId = (orderId || 'UG-00000').replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `Zamovlennya_${cleanId}.pdf`;

    if (!element) {
        return { blob: null, fileName, orderData };
    }

    if (typeof html2pdf === 'undefined') {
        try {
            await new Promise((resolve, reject) => {
                const s = document.createElement('script');
                s.src = 'html2pdf.bundle.min.js';
                s.onload = resolve;
                s.onerror = reject;
                document.head.appendChild(s);
            });
        } catch (e) {
            console.warn('html2pdf dynamic load non-critical error:', e);
            return { blob: null, fileName, orderData };
        }
    }

    if (typeof html2pdf === 'undefined') {
        return { blob: null, fileName, orderData };
    }

    const opt = {
        margin: [6, 6, 6, 6],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
        const pdfPromise = html2pdf().set(opt).from(element).outputPdf('blob');
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 1500));
        const blob = await Promise.race([pdfPromise, timeoutPromise]);
        if (blob) {
            lastGeneratedPdfBlob = blob;
            lastGeneratedPdfName = fileName;
        }
        return { blob: blob || null, fileName, orderData };
    } catch (err) {
        console.warn('PDF generation non-critical error:', err);
        return { blob: null, fileName, orderData };
    }
}

/**
 * Резервований багатоканальний диспетчер надсилання замовлень:
 * 1. Автономний локальний реєстр (localStorage + sessionStorage) — 100% збереження
 * 2. Telegram Bot (основний миттєвий канал із звуковим push-сповіщенням менеджеру)
 * 3. Slapform (хмарне резервне збереження)
 * 4. FormSubmit (резервна пошта на Gmail)
 */
function escapeTelegramHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
window.escapeTelegramHtml = escapeTelegramHtml;

function saveOrderToLedger(orderRecord) {
    if (!orderRecord) return;
    try {
        sessionStorage.setItem('ug_last_order', JSON.stringify(orderRecord));
        const existingLedger = JSON.parse(localStorage.getItem('ug_orders_ledger') || '[]');
        existingLedger.unshift(orderRecord);
        if (existingLedger.length > 100) existingLedger.length = 100;
        localStorage.setItem('ug_orders_ledger', JSON.stringify(existingLedger));
    } catch (e) {
        console.warn('Order ledger save note:', e);
    }
}
window.saveOrderToLedger = saveOrderToLedger;

async function sendTelegramOrderNotification({
    orderId,
    customerName,
    customerPhone,
    delivery,
    payment,
    itemsText,
    quickTtn,
    total,
    contactPreference
}) {
    const TG_TOKEN = window.TG_ORDER_BOT_TOKEN || '8679193496:AAGi5T0ZijUX1ksKkY0T2KB8Hh0UK_W2MyE';
    const TG_CHAT = window.TG_ORDER_CHAT_ID || '7907920864';
    if (!TG_TOKEN || !TG_CHAT) return false;

    const safeId = escapeTelegramHtml(orderId);
    const safeName = escapeTelegramHtml(customerName);
    const safePhone = escapeTelegramHtml(customerPhone);
    const safeDelivery = escapeTelegramHtml(delivery);
    const safePayment = escapeTelegramHtml(payment);
    const safeContact = escapeTelegramHtml(contactPreference || '');
    const safeTotal = escapeTelegramHtml(total);
    const safeItems = escapeTelegramHtml(itemsText);
    const safeTtn = escapeTelegramHtml(quickTtn);

    const htmlText = `🛍️ <b>НОВЕ ЗАМОВЛЕННЯ ${safeId}</b>\n\n` +
        `👤 <b>Клієнт:</b> ${safeName}\n` +
        `📞 <b>Телефон:</b> ${safePhone}\n` +
        `📍 <b>Доставка:</b> ${safeDelivery}\n` +
        `💳 <b>Оплата:</b> ${safePayment}\n` +
        (safeContact ? `💬 <b>Зв'язок:</b> ${safeContact}\n` : '') +
        `💰 <b>Сума:</b> <b>${safeTotal}</b>\n\n` +
        `📦 <b>Товари:</b>\n${safeItems}\n\n` +
        `📋 <b>Дані для швидкої ТТН (Нова Пошта):</b>\n<code>${safeTtn}</code>`;

    const plainText = `🛍️ НОВЕ ЗАМОВЛЕННЯ ${orderId}\n\n` +
        `👤 Клієнт: ${customerName}\n` +
        `📞 Телефон: ${customerPhone}\n` +
        `📍 Доставка: ${delivery}\n` +
        `💳 Оплата: ${payment}\n` +
        (contactPreference ? `💬 Зв'язок: ${contactPreference}\n` : '') +
        `💰 Сума: ${total}\n\n` +
        `📦 Товари:\n${itemsText}\n\n` +
        `📋 Дані для швидкої ТТН (Нова Пошта):\n${quickTtn}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
        const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TG_CHAT,
                text: htmlText,
                parse_mode: 'HTML'
            }),
            signal: controller.signal
        });

        if (res.ok) {
            clearTimeout(timeoutId);
            return true;
        }

        console.warn('Telegram HTML send status:', res.status, 'Retrying as plain text...');
        const plainRes = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            keepalive: true,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TG_CHAT,
                text: plainText
            }),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return plainRes.ok;
    } catch (err) {
        clearTimeout(timeoutId);
        console.warn('Telegram dispatch note:', err);
        return false;
    }
}
window.sendTelegramOrderNotification = sendTelegramOrderNotification;

async function sendOrderDispatch({
    orderId,
    orderDate,
    customerName,
    customerPhone,
    delivery,
    payment,
    itemsText,
    quickTtn,
    total,
    subject,
    contactPreference,
    pdfResult
}) {
    const formattedOrderId = (orderId || 'UG-0000').startsWith('#') ? orderId : `#${orderId}`;
    const cleanPhone = (customerPhone || '').replace(/[^\d+]/g, '');

    // 1. Автономне локальне збереження в журнал замовлень (100% захист даних)
    const orderRecord = {
        orderId: formattedOrderId,
        date: orderDate || new Date().toLocaleString('uk-UA'),
        customerName: customerName || 'Клієнт',
        customerPhone: cleanPhone || customerPhone,
        delivery: delivery || 'Узгодити з менеджером',
        payment: payment || 'Накладений платіж',
        items: itemsText || '',
        quickTtn: quickTtn || '',
        total: total || '',
        timestamp: Date.now()
    };
    saveOrderToLedger(orderRecord);

    let submitted = false;

    // 2. Головний найнадійніший канал: Telegram Bot (миттєве звукове push-сповіщення менеджеру)
    try {
        const tgOk = await sendTelegramOrderNotification({
            orderId: formattedOrderId,
            customerName: customerName || 'Клієнт',
            customerPhone: cleanPhone || customerPhone,
            delivery: delivery || 'Узгодити з менеджером',
            payment: payment || 'Накладений платіж',
            itemsText: itemsText || '',
            quickTtn: quickTtn || '',
            total: total || '',
            contactPreference: contactPreference || ''
        });
        if (tgOk) submitted = true;
    } catch (tgErr) {
        console.warn('Telegram notification dispatch error:', tgErr);
    }

    // 3. Резервний канал 1: Slapform (хмарна база)
    const SLAPFORM_FORM_ID = window.SLAPFORM_FORM_ID || '6Z5d923ip';
    if (SLAPFORM_FORM_ID) {
        try {
            const controller0 = new AbortController();
            const timeoutId0 = setTimeout(() => controller0.abort(), 4000);
            const slapPayload = {
                slap_subject: subject || `Замовлення ${formattedOrderId} | ${total} | ${customerName}`,
                'Замовлення': formattedOrderId,
                'Дата': orderRecord.date,
                'Клієнт': customerName,
                'Телефон': cleanPhone || customerPhone,
                'Доставка': delivery,
                'Оплата': payment,
                'Сума': total,
                'Товари': itemsText,
                'Дані для ТТН': quickTtn
            };
            if (contactPreference) {
                slapPayload['Дзвінок'] = contactPreference;
            }

            fetch(`https://api.slapform.com/${SLAPFORM_FORM_ID}`, {
                method: 'POST',
                keepalive: true,
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify(slapPayload),
                signal: controller0.signal
            }).then(res => {
                clearTimeout(timeoutId0);
                if (res.ok) submitted = true;
            }).catch(() => {
                clearTimeout(timeoutId0);
            });
        } catch (slapErr) {
            console.warn('Slapform dispatch note:', slapErr);
        }
    }

    // 4. Резервний канал 2: FormSubmit (відправка на Gmail)
    try {
        const emailSubject = subject || `Замовлення ${formattedOrderId} | ${total} | ${customerName}`;
        const currentOrigin = window.location.origin || 'https://urbangrid.com.ua';
        const fd = new FormData();
        fd.append('_captcha', 'false');
        fd.append('_template', 'table');
        fd.append('_subject', emailSubject);
        fd.append('_url', currentOrigin);
        fd.append('№', `${formattedOrderId} (${orderRecord.date})`);
        fd.append('Сума', total);
        fd.append('Оплата', payment);
        if (contactPreference) fd.append('Дзвінок', contactPreference);
        fd.append('Клієнт', customerName);
        fd.append('Тел', cleanPhone || customerPhone);
        fd.append('Доставка', delivery);
        fd.append('Товари', itemsText);
        fd.append('Для ТТН', quickTtn);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        fetch('https://formsubmit.co/ajax/lunarecho94@gmail.com', {
            method: 'POST',
            keepalive: true,
            body: fd,
            signal: controller.signal
        }).then(res => {
            clearTimeout(timeoutId);
            if (res.ok) submitted = true;
        }).catch(() => {
            clearTimeout(timeoutId);
        });
    } catch (err1) {}

    return submitted;
}

async function handleCheckoutFormSubmit(e) {
    if (e && e.preventDefault) {
        e.preventDefault();
    }

    if (isSubmittingOrder) return;

    const form = document.getElementById('checkoutForm');
    if (!form) return;

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    // Sync cart with hidden form fields
    syncCartWithForm();
    syncCityNPCombined();

    const submitBtn = document.getElementById('submitOrderBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Оформлення замовлення...';
    }
    isSubmittingOrder = true;

    // Generate Order ID and Date
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `UG-${randomNum}`;
    const now = new Date();
    const formattedDate = now.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
        ', ' + now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    const orderNumInput = document.getElementById('orderNumberInput');
    if (orderNumInput) orderNumInput.value = `#${orderId}`;

    const orderDateInput = document.getElementById('orderDateInput');
    if (orderDateInput) orderDateInput.value = formattedDate;

    // Generate the PDF
    let pdfResult = null;
    try {
        pdfResult = await generateOrderPdf(orderId, formattedDate);
    } catch (pdfErr) {
        console.error('PDF generation error:', pdfErr);
    }

    // Save order data to sessionStorage for thank-you screen
    if (pdfResult && pdfResult.orderData) {
        try {
            sessionStorage.setItem('ug_last_order', JSON.stringify(pdfResult.orderData));
        } catch (storageErr) {
            console.warn('sessionStorage error:', storageErr);
        }
    }

    // Build Customer, Delivery & Order Information
    const cart = getCart();
    const isCartOrder = cart && cart.length > 0;

    const customerName = (document.getElementById('fullName')?.value || '').trim() || 'Клієнт';
    const customerPhone = (document.getElementById('phone')?.value || '').trim();
    const cityVal = (document.getElementById('npCityInput')?.value || '').trim();
    const whVal = (document.getElementById('npWarehouseInput')?.value || '').trim();
    const combinedAddress = (document.getElementById('cityNP')?.value || '').trim() || 
        (cityVal && whVal ? `${cityVal}, ${whVal}` : (cityVal || whVal || 'Узгодити з клієнтом'));

    const payRadio = document.querySelector('input[name="cartPayment"]:checked, input[name="Оплата"]:checked, input[name="Спосіб оплати"]:checked');
    const paymentRaw = payRadio ? payRadio.value : 'Накладений платіж';
    const isPrepayment = paymentRaw.includes('Передплата') || paymentRaw.includes('передплата') || paymentRaw.includes('карт') || paymentRaw.includes('IBAN');
    const paymentFormatted = isPrepayment 
        ? 'Оплата на карту' 
        : 'Накладений платіж (оплата при отриманні у відділенні Нової Пошти)';

    const noCallChecked = document.getElementById('noCallCheckbox')?.checked;
    const contactPreference = noCallChecked 
        ? 'Не телефонувати: підтвердження та номер ТТН у месенджер (Telegram / Viber)' 
        : 'Зателефонувати: очікує дзвінка менеджера у робочий час (10:00-18:00)';

    const wideDivider = '— — — — — — — — — — — — — — — — — — — — — —';
    let orderItemsText = '';
    let quickCopyItems = '';
    let orderTotalNum = 0;
    let shortModelSummary = '';

    if (isCartOrder) {
        let totalQty = 0;
        cart.forEach((item, idx) => {
            const lineSum = item.price * (item.qty || 1);
            orderTotalNum += lineSum;
            totalQty += (item.qty || 1);
            const artText = item.art ? ` (Арт: ${item.art})` : '';
            const qtyText = (item.qty || 1) > 1 ? ` | ${item.qty || 1} шт. × ${item.price.toLocaleString('uk-UA')} грн` : '';
            const detailsArr = [];
            if (item.mat) detailsArr.push(`Матеріал: ${item.mat}`);
            const detailsLine = detailsArr.length > 0 ? `• ${detailsArr.join(' | ')}\n` : '';
            const linkLine = item.prodId ? `• https://urbangrid.com.ua/#prod-${item.prodId}\n` : '';

            orderItemsText += `№${idx + 1}. ${item.title}${artText}\n` +
                              `• Розмір: ${item.size} | Сума: ${lineSum.toLocaleString('uk-UA')} грн${qtyText}\n` +
                              detailsLine +
                              linkLine +
                              `\n`;

            quickCopyItems += `${item.title}${artText} [${item.size}, ${item.qty || 1} шт. — ${lineSum.toLocaleString('uk-UA')} грн]; `;
        });
        orderItemsText += `─────────────────────────────\nВсього: ${totalQty} шт. на суму ${orderTotalNum.toLocaleString('uk-UA')} грн`;
        const firstTitle = cart[0].title.split(' (')[0].replace(/^[🔥👟🛡🏀⚡✨🌸🖤💖❄️⚪🍫💙🏃‍♀️🐊🍷🛹\s]+/u, '').trim();
        const firstArt = cart[0].art ? ` (Арт: ${cart[0].art})` : '';
        shortModelSummary = `${totalQty} тов. (${firstTitle}${firstArt}${totalQty > 1 ? ' та ін.' : ''})`;
    } else {
        const productSelect = document.getElementById('productSelect');
        const selectedModel = productSelect ? productSelect.value : 'Кросівки';
        const sizeInput = document.getElementById('selectedSize');
        const chosenSize = sizeInput ? sizeInput.value.trim() : '38 (24 см)';
        const finalPriceEl = document.getElementById('finalOrderPrice');
        const priceText = finalPriceEl ? finalPriceEl.textContent : '2 670 грн';
        orderTotalNum = parseInt(priceText.replace(/\D/g, ''), 10) || 2670;

        orderItemsText = `№1. ${selectedModel}\n` +
                          `• Розмір: ${chosenSize} | К-сть: 1 шт. | Сума: ${orderTotalNum.toLocaleString('uk-UA')} грн\n` +
                          `─────────────────────────────\nВсього: 1 шт. на суму ${orderTotalNum.toLocaleString('uk-UA')} грн`;
        quickCopyItems = `${selectedModel} — ${chosenSize} — 1 шт.`;

        const cleanName = selectedModel.split(' (')[0].replace(/^[🔥👟🛡🏀⚡✨🌸🖤💖❄️⚪🍫💙🏃‍♀️🐊🍷🛹\s]+/u, '').trim();
        const shortSize = chosenSize.split(' ')[0] || chosenSize;
        shortModelSummary = `${cleanName} (${shortSize}р)`;
    }

    const formattedTotal = `${orderTotalNum.toLocaleString('uk-UA')} грн`;

    // Informative Dynamic Subject Line
    const emailSubject = `Замовлення #${orderId} | ${formattedTotal} | ${customerName} | ${shortModelSummary}`;

    // Clean phone number for quick actions
    const cleanPhone = customerPhone.replace(/[^\d+]/g, '');

    // Quick Copy Block for TTN (Nova Poshta app or Telegram supplier)
    const quickTtnBlock = 
`ПІБ: ${customerName}
Тел: ${cleanPhone || customerPhone}
Доставка: ${combinedAddress}
Товари: ${quickCopyItems}
Оплата: ${isPrepayment ? 'Оплачено (Оплата на карту)' : 'Накладений платіж'} — ${formattedTotal}`;

    // Update hidden form inputs for native fallback
    const subjectInput = document.getElementById('formSubmitSubject');
    if (subjectInput) subjectInput.value = emailSubject;

    const summaryTextInput = document.getElementById('orderSummaryText');
    if (summaryTextInput) summaryTextInput.value = orderItemsText;

    const quickCopyInput = document.getElementById('quickTtnCopy');
    if (quickCopyInput) quickCopyInput.value = quickTtnBlock;

    const cityNPHidden = document.getElementById('cityNP');
    if (cityNPHidden) cityNPHidden.value = combinedAddress;

    // Ensure _url is set to current origin
    const urlInput = document.getElementById('formSubmitUrl');
    if (urlInput) {
        urlInput.value = window.location.origin || 'https://urbangrid.com.ua';
    }

    // Attach PDF to Form via DataTransfer (for native fallback)
    if (pdfResult && pdfResult.blob) {
        try {
            const pdfFile = new File([pdfResult.blob], pdfResult.fileName, { type: 'application/pdf' });
            if (window.DataTransfer) {
                const dt = new DataTransfer();
                dt.items.add(pdfFile);
                const fileInput = document.getElementById('orderPdfAttachment');
                if (fileInput) {
                    fileInput.files = dt.files;
                }
            }
        } catch (dtErr) {
            console.warn('DataTransfer error:', dtErr);
        }
    }

    // Dispatch order to email and save to local ledger
    await sendOrderDispatch({
        orderId,
        orderDate: formattedDate,
        customerName,
        customerPhone,
        delivery: combinedAddress,
        payment: paymentFormatted,
        itemsText: orderItemsText,
        quickTtn: quickTtnBlock,
        total: formattedTotal,
        subject: emailSubject,
        contactPreference,
        pdfResult
    });

    // Save rich order summary in sessionStorage for the thank-you page
    const orderTotalNumPurchase = orderTotalNum || 0;
    const orderSummaryInfo = {
        orderId,
        orderDate: formattedDate,
        customerName,
        customerPhone,
        customerAddress: combinedAddress,
        delivery: combinedAddress,
        payment: paymentFormatted,
        paymentMethod: paymentFormatted,
        itemsSummary: orderItemsText,
        itemsText: orderItemsText,
        total: formattedTotal,
        totalNum: orderTotalNumPurchase
    };
    try {
        sessionStorage.setItem('ug_last_order', JSON.stringify(orderSummaryInfo));
    } catch (e) {}

    clearCart();
    isSubmittingOrder = false;
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ (НАКЛАДЕНИЙ ПЛАТІЖ)';
    }

    // Redirect to welcome / thank-you page (Pixel Purchase triggers strictly there)
    window.location.href = `thank-you.html?orderId=${encodeURIComponent(orderId)}&total=${encodeURIComponent(orderTotalNumPurchase)}`;
}

function checkOrderSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ordered') === '1') {
        clearCart();

        // Retrieve last order details from sessionStorage if available
        let orderInfo = null;
        try {
            const stored = sessionStorage.getItem('ug_last_order');
            if (stored) orderInfo = JSON.parse(stored);
        } catch (e) {}

        showOrderSuccessModal(orderInfo);

        // Remove ?ordered=1 from URL without reload
        if (window.history && window.history.replaceState) {
            const cleanUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, cleanUrl);
        }
    }
}

function showOrderSuccessModal(orderInfo) {
    const modal = document.getElementById('orderSuccessModal');
    if (!modal) {
        alert('Дякуємо за замовлення!\n\nВаше замовлення успішно прийнято. Менеджер зв\'яжеться з вами найближчим часом для узгодження деталей та відправки.');
        return;
    }

    const orderNumEl = document.getElementById('successOrderNum') || document.getElementById('successOrderId');
    const detailsBox = document.getElementById('successOrderDetailsBox') || document.getElementById('successOrderDetails');

    if (orderInfo) {
        if (orderNumEl) orderNumEl.textContent = `№ ${orderInfo.orderId}`;
        if (detailsBox) {
            detailsBox.innerHTML = `
                <div class="details-row"><span>Одержувач:</span> <b>${orderInfo.customerName}</b></div>
                <div class="details-row"><span>Телефон:</span> <b>${orderInfo.customerPhone}</b></div>
                <div class="details-row"><span>Доставка:</span> <b>${orderInfo.customerAddress || orderInfo.delivery || 'Узгодити з менеджером'}</b></div>
                <div class="details-row"><span>Оплата:</span> <b>${orderInfo.paymentMethod || orderInfo.payment || 'Накладений платіж'}</b></div>
                <div class="details-row"><span>Товари:</span> <b>${orderInfo.itemsSummary || orderInfo.itemsText}</b></div>
                <div class="details-row"><span>Сума до сплати:</span> <b>${orderInfo.subtotalFormatted || orderInfo.total}</b></div>
            `;
        }
    } else {
        const randomNum = Math.floor(10000 + Math.random() * 90000);
        if (orderNumEl) orderNumEl.textContent = `№ UG-${randomNum}`;
        if (detailsBox) {
            detailsBox.innerHTML = `
                <div class="details-row"><span>Статус:</span> <b>Замовлення прийнято в обробку</b></div>
                <div class="details-row"><span>Зв'язок:</span> <b>Очікуйте дзвінка менеджера найближчим часом</b></div>
                <div class="details-row"><span>Доставка:</span> <b>Нова Пошта (1-2 дні по Україні)</b></div>
            `;
        }
    }

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeOrderSuccessModal() {
    const modal = document.getElementById('orderSuccessModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
    const catalogSection = document.getElementById('catalog');
    if (catalogSection) {
        catalogSection.scrollIntoView({ behavior: 'smooth' });
    }
}

async function downloadLastGeneratedPdf() {
    const btn = document.getElementById('btnDownloadSuccessPdf');
    if (btn) {
        btn.innerHTML = 'Підготовка розрахунку...';
        btn.disabled = true;
    }

    try {
        if (lastGeneratedPdfBlob) {
            const url = URL.createObjectURL(lastGeneratedPdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = lastGeneratedPdfName || 'Zamovlennya_URBAN.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // Re-generate from template with stored data
            let orderInfo = null;
            try {
                const stored = sessionStorage.getItem('ug_last_order');
                if (stored) orderInfo = JSON.parse(stored);
            } catch (e) {}

            const orderId = orderInfo ? orderInfo.orderId : 'UG-2026';
            const orderDate = orderInfo ? orderInfo.orderDate : new Date().toLocaleDateString('uk-UA');
            
            const res = await generateOrderPdf(orderId, orderDate);
            if (res && res.blob) {
                const url = URL.createObjectURL(res.blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = res.fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        }
    } catch (err) {
        console.error('Download PDF error:', err);
    } finally {
        if (btn) {
            btn.innerHTML = 'Завантажити чек';
            btn.disabled = false;
        }
    }
}

// ==========================================
// DYNAMIC CATALOG ENGINE (EASYDROP FEED INTEGRATION)
// ==========================================
let catalogAllProducts = [];
let catalogMeta = null;
let currentCatalogGender = 'all'; // 'all', 'men', 'women'
let currentCatalogCategory = 'all'; // 'all', 'shoes', 'clothing', 'socks', 'underwear', 'accessories'
let currentCatalogSeason = 'all'; // 'all', 'demi', 'winter', 'summer'
let currentCatalogBrand = 'all';
let currentCatalogSize = 'all';
let currentCatalogPriceRange = 'all';
let currentCatalogSearchQuery = '';
let currentCatalogSort = 'popular';

function productMatchesGender(p, gender) {
    if (!gender || gender === 'all') return true;
    if (gender === 'favorites') return isFavorite(p.id);
    if (gender === 'men') return p.gender === 'men' || p.gender === 'unisex';
    if (gender === 'women') return p.gender === 'women' || p.gender === 'unisex';
    return true;
}

function productMatchesCategory(p, cat) {
    if (!cat || cat === 'all') return true;
    if (cat === 'sale') return !!p.is_sale;
    if (cat === 'clothing') return p.cat === 'clothing';
    if (cat === 'winter_jacket') return p.subcat === 'winter_jacket' || p.subcat === 'down_jacket';
    return p.cat === cat || p.subcat === cat;
}

function productMatchesSeason(p, season) {
    if (!season || season === 'all') return true;
    return p.season === season;
}

function productMatchesSize(p, size) {
    if (!size || size === 'all') return true;
    if (!p.sizes || !Array.isArray(p.sizes) || p.sizes.length === 0) return false;

    const targetLower = String(size).trim().toLowerCase();
    const targetNum = parseInt(targetLower, 10);

    return p.sizes.some(s => {
        const sStr = String(s).trim().toLowerCase();
        if (sStr === targetLower) return true;

        // Check range like "36-42" or "36–42"
        const rangeMatch = sStr.match(/^(\d{2})\s*[-–—]\s*(\d{2})$/);
        if (rangeMatch && !isNaN(targetNum)) {
            const min = parseInt(rangeMatch[1], 10);
            const max = parseInt(rangeMatch[2], 10);
            if (targetNum >= min && targetNum <= max) return true;
        }

        // Check comma/slash list
        const parts = sStr.split(/[/,\s]+/).map(x => x.trim());
        if (parts.includes(targetLower)) return true;

        return false;
    });
}
let catalogFilteredProducts = [];
let catalogRenderedCount = 0;
const CATALOG_PAGE_SIZE = 24;
let catalogSearchDebounceTimer = null;
let returnProductId = null;
let savedCatalogState = null;

function checkCatalogReturnState() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        returnProductId = urlParams.get('return') || urlParams.get('return_product') || urlParams.get('p') || '';
        
        // Always purge any stale sessionStorage records so they NEVER persist across page reloads
        try {
            sessionStorage.removeItem('urban_catalog_state');
            sessionStorage.removeItem('urban_last_viewed_product_id');
        } catch (e) {}

        savedCatalogState = null;

        // ONLY if the user navigated with an explicit return parameter in the URL do we center that product once
        if (returnProductId) {
            returnProductId = String(returnProductId).trim();
            // Clean the parameter from the browser URL bar immediately so page refresh never repeats the jump
            if (window.history && window.history.replaceState) {
                const url = new URL(window.location.href);
                url.searchParams.delete('return');
                url.searchParams.delete('return_product');
                url.searchParams.delete('p');
                const clean = url.pathname + (url.search ? url.search : '') + (url.hash && !url.hash.startsWith('#prod-') ? url.hash : '');
                window.history.replaceState({}, document.title, clean);
            }
        }
    } catch (err) {
        console.warn('Error reading return state:', err);
    }
}
window.checkCatalogReturnState = checkCatalogReturnState;

function renderCatalogSkeletons(grid, count = 8) {
    if (!grid) return;
    const skeletonHtml = Array(count).fill(0).map(() => `
        <div class="card-skeleton">
            <div class="skeleton-box" style="height: 240px; margin-bottom: 8px;"></div>
            <div class="skeleton-box" style="height: 18px; width: 55%; margin-bottom: 8px;"></div>
            <div class="skeleton-box" style="height: 22px; width: 85%; margin-bottom: 12px;"></div>
            <div class="skeleton-box" style="height: 38px; width: 100%;"></div>
        </div>
    `).join('');
    grid.innerHTML = skeletonHtml;
}

function isSneakerProductItem(item) {
    if (!item) return false;
    if (item.cat === 'shoes' || item.cat === 'winter') return true;
    const name = (item.name || '').toLowerCase();
    if (/кросів|кроссов|кед|черевик|ботинк|ботиль|чобот|sneaker|сникер|хайтоп|boot/i.test(name)) return true;
    const models = [
        'air force', 'air jordan', 'jordan 1', 'jordan 4', 'dunk', 'yeezy',
        'samba', 'gazelle', 'campus', 'spezial', 'lowmel', 'highmel',
        '1906', '2002', '9060', '530', '550', '574', 'v2k', 'zoom pulse',
        'vomero', 'initiator', 'terrex', 'hoka', 'speedcross', 'xt-6',
        'cortez', 'air max', 'knu skool', 'old skool', 'm2k', 'blazer'
    ];
    if (models.some(m => name.includes(m))) {
        if (item.cat === 'winter' || (item.sizes && item.sizes.some(s => /^(3[5-9]|4[0-8])/.test(s)))) {
            return true;
        }
    }
    return false;
}

function isLvBagItem(item) {
    if (!item) return false;
    const name = (item.name || '').toLowerCase();
    const cat = item.cat || '';
    const brand = item.brand || '';
    const isLv = brand === 'louisvuitton' || /\b(lv|лв|louis\s*vuitton)\b/i.test(name);
    if (cat === 'bags' && isLv) return true;
    if (name.includes('сумка') && isLv) return true;
    return false;
}

function isWinterClothingItem(item) {
    if (!item) return false;
    const isClothing = item.cat === 'clothing' || (item.cat_name && /одяг/i.test(item.cat_name));
    if (!isClothing) return false;

    // Direct winter tag
    if (item.season === 'winter' || (item.season_name && /зим/i.test(item.season_name))) {
        return true;
    }

    // Winter apparel keywords in title, description, material or badge
    const text = `${item.name || ''} ${item.mat || ''} ${item.badge || ''} ${item.desc || ''}`.toLowerCase();
    return /зим|winter|пуховик|куртк|парк|пальто|дублянк|фліс|флис|fleece|термо|thermo|утепл|холофайбер|холлофайбер|пух|синтепон|силікон|силикон|овчин|байка|начес/i.test(text);
}

function formatProductDisplayName(item) {
    let name = (item.name || '').trim();
    if (/^(?:Піжама\s+комбінезон(?:\s*\(попожама\))?|Попожама)($|\s|[.,\(\)])/i.test(name)) {
        return 'Жіноча піжама-комбінезон';
    }
    // Clean any 'оригінал / офіційно' references
    name = name.replace(/\[?\(?\s*оригінальна\s+магнітна\s+брендована\s+коробка\s*\]?\)?/gi, '[фірмова магнітна коробка]');
    name = name.replace(/\[?\(?\s*оригінальна\s+брендована\s+коробка\s*\]?\)?/gi, '[фірмова брендована коробка]');
    name = name.replace(/\[?\(?\s*оригінальна\s+магнітна\s+коробка\s*\]?\)?/gi, '[фірмова магнітна коробка]');
    name = name.replace(/\[?\(?\s*оригінальна\s+коробка\s*\]?\)?/gi, '[фірмова коробка]');
    name = name.replace(/\b(?:оригінал|оригінальний|оригінальна|оригінальне|оригінальні|оригінального|оригінальних)\b/gi, 'фірмовий');
    name = name.replace(/\b(?:оригинал|оригинальный|оригинальная|оригинальное|оригинальные|оригинального|оригинальных)\b/gi, 'фирменный');
    name = name.replace(/\b(?:офіційний|офіційна|офіційне|офіційні|офіційно|офіційного)\b/gi, '');
    name = name.replace(/\b(?:официальный|официальная|официальное|официальные|официально|официального)\b/gi, '');

    // Strip URLs and No brand
    name = name.replace(/https?:\/\/[^\s]+/g, '').trim();
    name = name.replace(/\s*\bNo\s*brand\b/gi, '').trim();
    name = name.replace(/^(?:ЮБКА|Юбка)\s*/i, 'Спідниця ');
    name = name.replace(/\bюбка\b/gi, 'спідниця');
    name = name.replace(/^КАРГО\s+(2Y|\d+)/i, 'Штани карго $1');
    name = name.replace(/^V(\d{2,3})$/i, (m, c) => 'Вітровка з капюшоном демісезонна V' + c);
    name = name.replace(/^F(\d{2,4})$/i, (m, c) => 'Худі оверсайз F' + c);
    name = name.replace(/^SJ(\d{2,4})$/i, (m, c) => 'Куртка демісезонна SJ' + c);
    name = name.replace(/^WJ(\d{2,4})$/i, (m, c) => 'Куртка зимова WJ' + c);
    name = name.replace(/^SS(\d{2,4})$/i, (m, c) => 'Спортивний костюм SS' + c);
    name = name.replace(/^H(\d{3,4})$/i, (m, c) => 'Сланці H' + c);
    name = name.replace(/^SL(\d{2,4})$/i, (m, c) => 'Шльопанці SL' + c);
    name = name.replace(/^J(\d{1,4})$/i, (m, c) => 'Куртка демісезонна J' + c);
    name = name.replace(/^SH(\d{1,4})$/i, (m, c) => 'Шорти SH' + c);
    name = name.replace(/^TS(\d{1,4})$/i, (m, c) => 'Футболка TS' + c);
    name = name.replace(/б\/нкз\d+/gi, 'Зимовий спортивний костюм');
    name = name.replace(/б\/нко\d+/gi, 'Олімпійка спортивна');
    name = name.replace(/б\/нк\d+/gi, 'Спортивний костюм');
    name = name.replace(/Б\/Н\d+/gi, 'Зимова тепла куртка');
    name = name.replace(/SPб\/н\d+/gi, 'Спортивні штани');
    name = name.replace(/\bб\/н\b/gi, '').trim();

    name = name.replace(/\s{2,}/g, ' ').trim();
    if (!name || name.length <= 2 || /^\d+$/.test(name) || /^[A-Z]\d{1,3}$/i.test(name)) {
        const catName = getCategoryTitle(item.cat);
        const brandName = (item.brand_name && item.brand_name !== 'Інші бренди') ? item.brand_name : '';
        if (catName.includes('Одяг') || item.cat === 'clothing') {
            if (/^P\d/i.test(name)) {
                name = `Спортивні штани ${name}`;
            } else if (/^S\d/i.test(name)) {
                name = `Світшот ${name}`;
            } else if (/^T\d/i.test(name)) {
                name = `Флісовий світшот ${name}`;
            } else if (/^(?:PT|PS)/i.test(name)) {
                name = `Спортивний костюм ${name}`;
            } else if (/^SC/i.test(name)) {
                name = `Літній комплект ${name}`;
            } else {
                name = brandName ? `${brandName} ${name}` : `Одяг ${name}`;
            }
        } else if (catName.includes('Кросівки') || item.cat === 'shoes' || item.cat === 'winter') {
            name = brandName ? `Кросівки ${brandName} ${name}` : `Кросівки ${name}`;
        } else if (catName.includes('Сумки') || item.cat === 'accessories' || item.cat === 'bags') {
            name = brandName ? `Сумка ${brandName} ${name}` : `Сумка ${name}`;
        } else {
            name = brandName ? `${brandName} ${name}` : `Товар ${name}`;
        }
    }
    return name;
}

async function initDynamicCatalog() {
    const grid = document.getElementById('catalogProductsGrid') || (document.getElementById('productDetailPage') ? null : document.querySelector('.products-grid'));
    if (!grid) return;

    renderCatalogSkeletons(grid, 8);

    try {
        const [prodResp, metaResp] = await Promise.all([
            fetch('/data/products.json'),
            fetch('/data/meta.json')
        ]);

        if (!prodResp.ok || !metaResp.ok) {
            throw new Error(`HTTP error: ${prodResp.status} / ${metaResp.status}`);
        }

        const rawProducts = await prodResp.json();
        const defectSizeRegex = /нюанс|дефект|брак|плям|уцінк|потертост|потёрт|скидк|-50%/i;
        catalogAllProducts = rawProducts.filter(item => {
            if (item.sizes && Array.isArray(item.sizes)) {
                item.sizes = item.sizes.filter(s => !defectSizeRegex.test(s));
            }
            if (!item.sizes || item.sizes.length === 0) {
                return false;
            }
            if (isSneakerProductItem(item) && item.sizes.length < 3) {
                return false;
            }
            if (isLvBagItem(item)) {
                return false;
            }
            return true;
        });

        // Tag and preserve showcase order (jackets, vests, hoodies, winter apparel, shoes)
        catalogAllProducts.forEach((item, idx) => {
            if (typeof item._order !== 'number') {
                item._order = idx;
            }
        });

        catalogMeta = await metaResp.json();

        // Check if returning from a product detail page
        checkCatalogReturnState();

        // Render Dynamic 3-tier Tabs
        renderGenderTabs(catalogMeta);
        renderCategoryTabs(catalogMeta);
        renderSeasonTabs(catalogMeta);

        // Render Dynamic Brand Chips
        renderBrandFilterChips(catalogMeta);

        // Initial URL params, Badges calculation & Catalog Render
        checkCatalogUrlParams();
        updateFilterBadges();
        syncDrawerActiveStates();
        syncQuickCatalogPills();
        updateCatalogModelsCountText();
        applyCatalogFilters(false);
    } catch (err) {
        console.error('Failed to load dynamic catalog:', err);
        grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <p style="font-size: 18px; font-weight: 700; color: #ef4444; margin-bottom: 12px;">Помилка завантаження каталогу товарів.</p>
                <button type="button" class="btn-buy" onclick="location.reload()">Оновити сторінку</button>
            </div>
        `;
    }
}

function renderGenderTabs(meta) {
    const container = document.getElementById('catalogGenderTabs');
    if (!container || !meta || !meta.genders) return;

    container.innerHTML = meta.genders.map(g => `
        <button type="button" class="gender-pill-btn ${currentCatalogGender === g.slug ? 'active' : ''}" data-gender="${g.slug}" onclick="selectCatalogGender('${g.slug}', this)">
            <span class="pill-icon">${g.icon}</span>
            <span class="pill-title">${escapeHtml(g.name)}</span>
            <span class="pill-badge" id="badgeGender_${g.slug}">${g.count.toLocaleString('uk-UA')}</span>
        </button>
    `).join('');
}

function renderCategoryTabs(meta) {
    const container = document.getElementById('mainCategoryTabs');
    if (!container || !meta || !meta.categories) return;

    container.innerHTML = meta.categories.map(cat => `
        <button type="button" class="main-cat-btn ${currentCatalogCategory === cat.slug ? 'active' : ''}" data-cat="${cat.slug}" onclick="selectCatalogCategory('${cat.slug}', this)">
            <span class="cat-icon">${cat.icon}</span>
            <span class="cat-title">${escapeHtml(cat.name)}</span>
            <span class="cat-badge" id="badgeCat_${cat.slug}">${cat.count.toLocaleString('uk-UA')}</span>
        </button>
    `).join('');
}

function renderSeasonTabs(meta) {
    const container = document.getElementById('catalogSeasonTabs');
    if (!container || !meta || !meta.seasons) return;

    container.innerHTML = meta.seasons.map(s => `
        <button type="button" class="season-pill-btn ${currentCatalogSeason === s.slug ? 'active' : ''}" data-season="${s.slug}" onclick="selectCatalogSeason('${s.slug}', this)">
            <span class="pill-icon">${s.icon}</span>
            <span class="pill-title">${escapeHtml(s.name)}</span>
            <span class="pill-badge" id="badgeSeason_${s.slug}">${s.count.toLocaleString('uk-UA')}</span>
        </button>
    `).join('');
}

function updateFilterBadges() {
    if (!catalogAllProducts.length) return;

    const genderCounts = { all: 0, men: 0, women: 0 };
    const categoryCounts = { all: 0, shoes: 0, clothing: 0, socks: 0, underwear: 0, accessories: 0 };
    if (typeof catalogMeta !== 'undefined' && catalogMeta && catalogMeta.categories) {
        catalogMeta.categories.forEach(c => { categoryCounts[c.slug] = 0; });
    }
    const seasonCounts = { all: 0, demi: 0, winter: 0, summer: 0 };

    catalogAllProducts.forEach(p => {
        // Gender counts given current Category & Season
        if (productMatchesCategory(p, currentCatalogCategory) && productMatchesSeason(p, currentCatalogSeason)) {
            genderCounts.all++;
            if (p.gender === 'men' || p.gender === 'unisex') genderCounts.men++;
            if (p.gender === 'women' || p.gender === 'unisex') genderCounts.women++;
        }

        // Category counts given current Gender & Season
        if (productMatchesGender(p, currentCatalogGender) && productMatchesSeason(p, currentCatalogSeason)) {
            categoryCounts.all++;
            if (p.cat && categoryCounts[p.cat] !== undefined) {
                categoryCounts[p.cat]++;
            }
            if (p.subcat && categoryCounts[p.subcat] !== undefined) {
                categoryCounts[p.subcat]++;
            }
            if (p.subcat === 'down_jacket' && categoryCounts['winter_jacket'] !== undefined) {
                categoryCounts['winter_jacket']++;
            }
        }

        // Season counts given current Gender & Category
        if (productMatchesGender(p, currentCatalogGender) && productMatchesCategory(p, currentCatalogCategory)) {
            seasonCounts.all++;
            if (p.season && seasonCounts[p.season] !== undefined) {
                seasonCounts[p.season]++;
            }
        }
    });

    Object.keys(genderCounts).forEach(g => {
        const el = document.getElementById(`badgeGender_${g}`);
        if (el) el.textContent = genderCounts[g].toLocaleString('uk-UA');
        const drawerEl = document.getElementById(`drawerGenderCount_${g}`);
        if (drawerEl) drawerEl.textContent = genderCounts[g].toLocaleString('uk-UA');
    });

    Object.keys(categoryCounts).forEach(c => {
        const el = document.getElementById(`badgeCat_${c}`);
        if (el) el.textContent = categoryCounts[c].toLocaleString('uk-UA');
        const drawerEl = document.getElementById(`drawerCatCount_${c}`);
        if (drawerEl) drawerEl.textContent = categoryCounts[c].toLocaleString('uk-UA');
    });

    Object.keys(seasonCounts).forEach(s => {
        const el = document.getElementById(`badgeSeason_${s}`);
        if (el) el.textContent = seasonCounts[s].toLocaleString('uk-UA');
        const drawerEl = document.getElementById(`drawerSeasonCount_${s}`);
        if (drawerEl) drawerEl.textContent = seasonCounts[s].toLocaleString('uk-UA');
    });

    const drawerFav = document.getElementById('drawerGenderCount_fav');
    if (drawerFav && typeof getFavorites === 'function') {
        drawerFav.textContent = getFavorites().length;
    }
}

function selectCatalogGender(gender, btn) {
    currentCatalogGender = gender || 'all';
    currentCatalogBrand = 'all';

    document.querySelectorAll('.gender-pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.gender === currentCatalogGender);
    });

    updateFilterBadges();

    if (catalogMeta) {
        renderBrandFilterChips(catalogMeta);
    }

    applyCatalogFilters();
}

function selectCatalogCategory(catSlug, btn) {
    currentCatalogCategory = catSlug || 'all';
    currentCatalogBrand = 'all';

    document.querySelectorAll('.main-cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === currentCatalogCategory);
    });

    updateFilterBadges();

    if (catalogMeta) {
        renderBrandFilterChips(catalogMeta);
    }

    applyCatalogFilters();
}

function selectCatalogSeason(seasonSlug, btn) {
    currentCatalogSeason = seasonSlug || 'all';
    currentCatalogBrand = 'all';

    document.querySelectorAll('.season-pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.season === currentCatalogSeason);
    });

    updateFilterBadges();

    if (catalogMeta) {
        renderBrandFilterChips(catalogMeta);
    }

    applyCatalogFilters();
}

// ==========================================================================
// CATALOG OFF-CANVAS BURGER DRAWER & ACTIVE FILTER TAGS
// ==========================================================================

function openCatalogDrawer() {
    const drawer = document.getElementById('catalogDrawer');
    const overlay = document.getElementById('catalogDrawerOverlay');
    if (drawer && overlay) {
        drawer.classList.add('active');
        overlay.classList.add('active');
        document.body.classList.add('catalog-drawer-open');
        syncDrawerActiveStates();
        updateDrawerServiceBadges();
    }
}

function closeCatalogDrawer() {
    const drawer = document.getElementById('catalogDrawer');
    const overlay = document.getElementById('catalogDrawerOverlay');
    if (drawer && overlay) {
        drawer.classList.remove('active');
        overlay.classList.remove('active');
        document.body.classList.remove('catalog-drawer-open');
    }
}

function toggleCatalogDrawer() {
    const drawer = document.getElementById('catalogDrawer');
    if (drawer && drawer.classList.contains('active')) {
        closeCatalogDrawer();
    } else {
        openCatalogDrawer();
    }
}

function toggleDrawerAccordion(accordionId) {
    const acc = document.getElementById(accordionId);
    if (!acc) return;
    acc.classList.toggle('open');
}

function toggleDrawerNested(subId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const subList = document.getElementById(subId);
    if (!subList) return;
    const isExpanded = subList.classList.toggle('open');
    if (event && event.currentTarget) {
        event.currentTarget.classList.toggle('open', isExpanded);
    }
}

function updateDrawerServiceBadges() {
    const favCount = (typeof getFavorites === 'function') ? getFavorites().length : 0;
    const cartItems = (typeof getCart === 'function') ? getCart() : [];
    const cartCount = cartItems.reduce((sum, item) => sum + (item.qty || 1), 0);

    const favEl = document.getElementById('drawerFavBadge');
    if (favEl) favEl.textContent = favCount;
    const favCountGender = document.getElementById('drawerGenderCount_fav');
    if (favCountGender) favCountGender.textContent = favCount;

    const cartEl = document.getElementById('drawerCartBadge');
    if (cartEl) cartEl.textContent = cartCount;
}

function applyDrawerCategory(cat) {
    closeCatalogDrawer();
    if (!document.getElementById('catalog')) {
        window.location.href = `index.html?cat=${encodeURIComponent(cat)}#catalog`;
        return;
    }
    selectCatalogCategory(cat);
    const catSection = document.getElementById('catalog');
    if (catSection) catSection.scrollIntoView({ behavior: 'smooth' });
}

function applyDrawerGender(gender) {
    closeCatalogDrawer();
    if (!document.getElementById('catalog')) {
        window.location.href = `index.html?gender=${encodeURIComponent(gender)}#catalog`;
        return;
    }
    selectCatalogGender(gender);
    const catSection = document.getElementById('catalog');
    if (catSection) catSection.scrollIntoView({ behavior: 'smooth' });
}

function applyDrawerSeason(season) {
    closeCatalogDrawer();
    if (!document.getElementById('catalog')) {
        window.location.href = `index.html?season=${encodeURIComponent(season)}#catalog`;
        return;
    }
    selectCatalogSeason(season);
    const catSection = document.getElementById('catalog');
    if (catSection) catSection.scrollIntoView({ behavior: 'smooth' });
}

function applyDrawerBrand(brand) {
    closeCatalogDrawer();
    if (!document.getElementById('catalog')) {
        window.location.href = `index.html?brand=${encodeURIComponent(brand)}#catalog`;
        return;
    }
    currentCatalogBrand = brand || 'all';
    updateBrandButtonState();
    updateFilterBadges();
    syncDrawerActiveStates();
    applyCatalogFilters();
    const catSection = document.getElementById('catalog');
    if (catSection) catSection.scrollIntoView({ behavior: 'smooth' });
}

function applyDrawerSize(size) {
    closeCatalogDrawer();
    if (!document.getElementById('catalog')) {
        window.location.href = size === 'all' ? 'index.html#catalog' : `index.html?size=${encodeURIComponent(size)}#catalog`;
        return;
    }
    if (size === 'all') {
        filterCatalogBySize('all');
    } else {
        filterCatalogBySize(size);
    }
    const catSection = document.getElementById('catalog');
    if (catSection) catSection.scrollIntoView({ behavior: 'smooth' });
}

function applyDrawerSubSearch(keyword, cat) {
    closeCatalogDrawer();
    if (!document.getElementById('catalog')) {
        window.location.href = `index.html?cat=${encodeURIComponent(cat)}&search=${encodeURIComponent(keyword)}#catalog`;
        return;
    }
    if (cat) currentCatalogCategory = cat;
    currentCatalogSearchQuery = keyword;
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) searchInput.value = keyword;
    updateBrandButtonState();
    updateFilterBadges();
    syncDrawerActiveStates();
    applyCatalogFilters();
    const catSection = document.getElementById('catalog');
    if (catSection) catSection.scrollIntoView({ behavior: 'smooth' });
}

function applyDrawerFavorites() {
    closeCatalogDrawer();
    if (!document.getElementById('catalog')) {
        window.location.href = 'index.html?gender=favorites#catalog';
        return;
    }
    selectCatalogGender('favorites');
    const catSection = document.getElementById('catalog');
    if (catSection) catSection.scrollIntoView({ behavior: 'smooth' });
}

function handleDrawerSearch(val) {
    const trimmed = (val || '').trim();
    if (!document.getElementById('catalog')) {
        if (trimmed) {
            window.location.href = `index.html?search=${encodeURIComponent(trimmed)}#catalog`;
        }
        return;
    }
    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) {
        searchInput.value = trimmed;
    }
    currentCatalogSearchQuery = trimmed;
    applyCatalogFilters();
}

function checkCatalogUrlParams() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        let changed = false;

        const cat = urlParams.get('cat') || urlParams.get('category');
        if (cat) {
            currentCatalogCategory = cat;
            changed = true;
        } else if (currentCatalogCategory !== 'all') {
            currentCatalogCategory = 'all';
            changed = true;
        }

        const gender = urlParams.get('gender');
        if (gender) {
            currentCatalogGender = gender;
            changed = true;
        } else if (currentCatalogGender !== 'all') {
            currentCatalogGender = 'all';
            changed = true;
        }

        const season = urlParams.get('season');
        if (season) {
            currentCatalogSeason = season;
            changed = true;
        } else if (currentCatalogSeason !== 'all') {
            currentCatalogSeason = 'all';
            changed = true;
        }

        const brand = urlParams.get('brand');
        if (brand) {
            currentCatalogBrand = brand;
            changed = true;
        } else if (currentCatalogBrand !== 'all') {
            currentCatalogBrand = 'all';
            changed = true;
        }

        const size = urlParams.get('size');
        if (size) {
            currentCatalogSize = size;
            changed = true;
        } else if (currentCatalogSize !== 'all') {
            currentCatalogSize = 'all';
            changed = true;
        }

        const search = urlParams.get('search') || urlParams.get('q');
        if (search) {
            currentCatalogSearchQuery = search;
            const searchInput = document.getElementById('catalogSearchInput');
            if (searchInput) searchInput.value = search;
            changed = true;
        } else if (currentCatalogSearchQuery) {
            currentCatalogSearchQuery = '';
            const searchInput = document.getElementById('catalogSearchInput');
            if (searchInput) searchInput.value = '';
            changed = true;
        }

        const sort = urlParams.get('sort');
        if (sort) {
            currentCatalogSort = sort;
            const sortSelect = document.getElementById('catalogSortSelect');
            if (sortSelect) sortSelect.value = sort;
            updateSortDisplayLabel(sort);
            changed = true;
        } else if (currentCatalogSort !== 'default') {
            currentCatalogSort = 'default';
            const sortSelect = document.getElementById('catalogSortSelect');
            if (sortSelect) sortSelect.value = 'default';
            updateSortDisplayLabel('default');
            changed = true;
        } else {
            updateSortDisplayLabel(currentCatalogSort);
        }

        const filter = urlParams.get('filter');
        if (filter === 'favorites') {
            currentCatalogGender = 'favorites';
            changed = true;
        }

        document.querySelectorAll('.gender-pill-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.gender === currentCatalogGender);
        });
        document.querySelectorAll('.main-cat-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.cat === currentCatalogCategory);
        });
        document.querySelectorAll('.season-pill-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.season === currentCatalogSeason);
        });
        updateBrandButtonState();
        updateSizeButtonState();
    } catch (e) {}
}

function syncCatalogUrl(pushToHistory = true) {
    if (!document.getElementById('catalogProductsGrid')) return;

    const params = new URLSearchParams();
    if (currentCatalogCategory && currentCatalogCategory !== 'all') {
        params.set('cat', currentCatalogCategory);
    }
    if (currentCatalogGender && currentCatalogGender !== 'all') {
        params.set('gender', currentCatalogGender);
    }
    if (currentCatalogSeason && currentCatalogSeason !== 'all') {
        params.set('season', currentCatalogSeason);
    }
    if (currentCatalogBrand && currentCatalogBrand !== 'all') {
        params.set('brand', currentCatalogBrand);
    }
    if (currentCatalogSize && currentCatalogSize !== 'all') {
        params.set('size', currentCatalogSize);
    }
    const q = (currentCatalogSearchQuery || '').trim();
    if (q) {
        params.set('search', q);
    }
    if (currentCatalogSort && currentCatalogSort !== 'default') {
        params.set('sort', currentCatalogSort);
    }

    const queryString = params.toString();
    const newPath = window.location.pathname;
    const newUrl = queryString ? `${newPath}?${queryString}` : `${newPath}`;

    // Update canonical link in head:
    // Filtered URLs point to category canonical or root, avoiding duplicate content indexation
    let canonicalHref = 'https://urbangrid.com.ua/';
    if (currentCatalogCategory && currentCatalogCategory !== 'all') {
        canonicalHref = `https://urbangrid.com.ua/?cat=${encodeURIComponent(currentCatalogCategory)}`;
    }
    let canonicalTag = document.querySelector('link[rel="canonical"]');
    if (!canonicalTag) {
        canonicalTag = document.createElement('link');
        canonicalTag.rel = 'canonical';
        document.head.appendChild(canonicalTag);
    }
    canonicalTag.href = canonicalHref;

    const stateObj = {
        cat: currentCatalogCategory,
        gender: currentCatalogGender,
        season: currentCatalogSeason,
        brand: currentCatalogBrand,
        size: currentCatalogSize,
        search: q,
        sort: currentCatalogSort
    };

    try {
        const currentSearch = window.location.search.replace(/^\?/, '');
        if (pushToHistory) {
            if (currentSearch !== queryString) {
                window.history.pushState(stateObj, document.title, newUrl);
            }
        } else {
            window.history.replaceState(stateObj, document.title, newUrl);
        }
    } catch (e) {
        // Safe fallback in sandboxed iframe or restricted environment
    }
}
window.syncCatalogUrl = syncCatalogUrl;

// Listen for browser back / forward buttons to restore filter state
window.addEventListener('popstate', (e) => {
    if (!document.getElementById('catalogProductsGrid') && !document.querySelector('.products-grid')) return;
    checkCatalogUrlParams();
    updateFilterBadges();
    syncDrawerActiveStates();
    syncQuickNavChips();
    syncQuickCatalogPills();
    updateCatalogModelsCountText();
    applyCatalogFilters(false);
});

function syncDrawerActiveStates() {
    // 1. Categories
    document.querySelectorAll('#drawerCatList .drawer-nav-item, #drawerCategoriesList .drawer-nav-item').forEach(btn => {
        const cat = btn.getAttribute('data-cat');
        btn.classList.toggle('active', cat === currentCatalogCategory);
    });

    // 2. Gender
    document.querySelectorAll('#drawerGenderList .drawer-nav-item').forEach(btn => {
        const g = btn.getAttribute('data-gender');
        btn.classList.toggle('active', g === currentCatalogGender);
    });

    // 3. Season
    document.querySelectorAll('#drawerSeasonList .drawer-nav-item').forEach(btn => {
        const s = btn.getAttribute('data-season');
        btn.classList.toggle('active', s === currentCatalogSeason);
    });

    // 4. Brands
    document.querySelectorAll('#drawerBrandsList .drawer-nav-item').forEach(btn => {
        const b = btn.getAttribute('data-brand');
        btn.classList.toggle('active', b === currentCatalogBrand);
    });

    // 5. Sizes
    document.querySelectorAll('.drawer-size-chip').forEach(btn => {
        const s = btn.getAttribute('data-drawer-size');
        btn.classList.toggle('active', s === currentCatalogSize);
    });
}

function updateCatalogFilterBadge() {
    let count = 0;
    if (typeof currentCatalogCategory !== 'undefined' && currentCatalogCategory !== 'all') count++;
    if (typeof currentCatalogGender !== 'undefined' && currentCatalogGender !== 'all') count++;
    if (typeof currentCatalogSeason !== 'undefined' && currentCatalogSeason !== 'all') count++;
    if (typeof currentCatalogBrand !== 'undefined' && currentCatalogBrand !== 'all') count++;
    if (typeof currentCatalogSize !== 'undefined' && currentCatalogSize !== 'all') count++;
    if (typeof currentCatalogPriceRange !== 'undefined' && currentCatalogPriceRange !== 'all') count++;

    const badge = document.getElementById('catalogFilterBadge');
    const filterBtn = document.getElementById('catalogFilterTriggerBtn');
    if (badge) {
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'inline-flex';
        } else {
            badge.style.display = 'none';
        }
    }
    if (filterBtn) {
        filterBtn.classList.toggle('active', count > 0);
    }
}

function renderActiveFilterTags() {
    const bar = document.getElementById('catalogActiveFiltersBar');
    const container = document.getElementById('activeFiltersChips');
    if (!bar || !container) return;

    const tags = [];

    // Gender
    if (currentCatalogGender !== 'all') {
        let label = 'Для всіх';
        if (currentCatalogGender === 'favorites') label = 'Обрані товари';
        else if (currentCatalogGender === 'men') label = 'Чоловіче';
        else if (currentCatalogGender === 'women') label = 'Жіноче';
        tags.push({
            type: 'gender',
            label: label,
            removeAction: "removeActiveFilterTag('gender')"
        });
    }

    // Category
    if (currentCatalogCategory !== 'all') {
        tags.push({
            type: 'category',
            label: getCategoryTitle(currentCatalogCategory),
            removeAction: "removeActiveFilterTag('category')"
        });
    }

    // Season
    if (currentCatalogSeason !== 'all') {
        tags.push({
            type: 'season',
            label: getSeasonTitle(currentCatalogSeason),
            removeAction: "removeActiveFilterTag('season')"
        });
    }

    // Brand
    if (currentCatalogBrand !== 'all') {
        const brandItem = catalogMeta && catalogMeta.brands && catalogMeta.brands.find(b => b.slug === currentCatalogBrand);
        const bName = brandItem ? brandItem.name : currentCatalogBrand;
        tags.push({
            type: 'brand',
            label: `Бренд: ${bName}`,
            removeAction: "removeActiveFilterTag('brand')"
        });
    }

    // Size
    if (currentCatalogSize !== 'all') {
        tags.push({
            type: 'size',
            label: `Розмір: ${currentCatalogSize}`,
            removeAction: "removeActiveFilterTag('size')"
        });
    }

    // Price Range
    if (currentCatalogPriceRange !== 'all') {
        let pLabel = '';
        if (currentCatalogPriceRange === 'under-1500') pLabel = 'до 1 500 грн';
        else if (currentCatalogPriceRange === '1500-2500') pLabel = '1 500 - 2 500 грн';
        else if (currentCatalogPriceRange === '2500-3500') pLabel = '2 500 - 3 500 грн';
        else if (currentCatalogPriceRange === 'above-3500') pLabel = 'від 3 500 грн';
        tags.push({
            type: 'price',
            label: `Ціна: ${pLabel}`,
            removeAction: "removeActiveFilterTag('price')"
        });
    }

    // Search query
    if (currentCatalogSearchQuery && currentCatalogSearchQuery.trim()) {
        tags.push({
            type: 'search',
            label: `Пошук: «${currentCatalogSearchQuery.trim()}»`,
            removeAction: "removeActiveFilterTag('search')"
        });
    }

    if (tags.length === 0) {
        bar.style.display = 'none';
        container.innerHTML = '';
        updateCatalogFilterBadge();
        return;
    }

    bar.style.display = 'flex';
    container.innerHTML = tags.map(tag => `
        <span class="active-filter-chip">
            <span class="chip-text">${escapeHtml(tag.label)}</span>
            <button type="button" class="chip-remove-btn" onclick="${tag.removeAction}" aria-label="Видалити фільтр ${escapeHtml(tag.label)}">&times;</button>
        </span>
    `).join('');
    updateCatalogFilterBadge();
}

function removeActiveFilterTag(type) {
    if (type === 'gender') {
        currentCatalogGender = 'all';
    } else if (type === 'category') {
        currentCatalogCategory = 'all';
    } else if (type === 'season') {
        currentCatalogSeason = 'all';
    } else if (type === 'brand') {
        currentCatalogBrand = 'all';
        updateBrandButtonState();
    } else if (type === 'size') {
        currentCatalogSize = 'all';
        updateSizeButtonState();
    } else if (type === 'price') {
        currentCatalogPriceRange = 'all';
        const priceSelect = document.getElementById('catalogPriceFilter');
        if (priceSelect) priceSelect.value = 'all';
    } else if (type === 'search') {
        currentCatalogSearchQuery = '';
        const searchInput = document.getElementById('catalogSearchInput');
        if (searchInput) searchInput.value = '';
        const drawerSearch = document.getElementById('drawerSearchInput');
        if (drawerSearch) drawerSearch.value = '';
    }

    updateFilterBadges();
    syncDrawerActiveStates();
    applyCatalogFilters();
}

function resetAllCatalogFilters() {
    currentCatalogCategory = 'all';
    currentCatalogGender = 'all';
    currentCatalogSeason = 'all';
    currentCatalogBrand = 'all';
    currentCatalogSize = 'all';
    currentCatalogPriceRange = 'all';
    currentCatalogSearchQuery = '';

    const searchInput = document.getElementById('catalogSearchInput');
    if (searchInput) searchInput.value = '';
    const drawerSearch = document.getElementById('drawerSearchInput');
    if (drawerSearch) drawerSearch.value = '';
    const priceSelect = document.getElementById('catalogPriceFilter');
    if (priceSelect) priceSelect.value = 'all';
    const sortSelect = document.getElementById('catalogSortSelect');
    if (sortSelect) sortSelect.value = 'popular';
    currentCatalogSort = 'popular';
    updateSortDisplayLabel('popular');

    updateBrandButtonState();
    updateSizeButtonState();
    updateFilterBadges();
    updateCatalogFilterBadge();
    syncDrawerActiveStates();
    syncQuickNavChips('all');
    syncQuickCatalogPills();
    applyCatalogFilters();
}

function applyQuickNavFilter(key, btn) {
    if (key === 'all') {
        currentCatalogCategory = 'all';
        currentCatalogGender = 'all';
        currentCatalogSeason = 'all';
        currentCatalogBrand = 'all';
        currentCatalogSize = 'all';
        currentCatalogPriceRange = 'all';
        currentCatalogSearchQuery = '';
        const searchInput = document.getElementById('catalogSearchInput');
        if (searchInput) searchInput.value = '';
        const sortSelect = document.getElementById('catalogSortSelect');
        if (sortSelect) sortSelect.value = 'popular';
        currentCatalogSort = 'popular';
        updateSortDisplayLabel('popular');
    } else if (key === 'shoes') {
        currentCatalogCategory = 'shoes';
    } else if (key === 'men') {
        currentCatalogGender = 'men';
    } else if (key === 'women') {
        currentCatalogGender = 'women';
    } else if (key === 'winter') {
        currentCatalogSeason = 'winter';
    } else if (key === 'clothing') {
        currentCatalogCategory = 'clothing';
    } else if (key === 'accessories') {
        currentCatalogCategory = 'accessories';
    } else if (key === 'discount') {
        handleCatalogSort('discount');
        const sortSelect = document.getElementById('catalogSortSelect');
        if (sortSelect) sortSelect.value = 'discount';
        syncQuickNavChips('discount');
        return;
    }

    updateBrandButtonState();
    updateSizeButtonState();
    updateFilterBadges();
    syncDrawerActiveStates();
    syncQuickNavChips(key);
    applyCatalogFilters();

    const catSection = document.getElementById('catalog');
    if (catSection) {
        const topPos = catSection.getBoundingClientRect().top + window.pageYOffset - 90;
        window.scrollTo({ top: topPos, behavior: 'smooth' });
    }
}

function syncQuickNavChips(explicitKey) {
    const chips = document.querySelectorAll('.catalog-nav-chip');
    if (!chips.length) return;
    chips.forEach(c => c.classList.remove('active'));

    let activeKey = explicitKey;
    if (!activeKey) {
        if (currentCatalogSeason === 'winter') {
            activeKey = 'winter';
        } else if (currentCatalogCategory === 'shoes') {
            activeKey = 'shoes';
        } else if (currentCatalogCategory === 'clothing') {
            activeKey = 'clothing';
        } else if (currentCatalogCategory === 'accessories') {
            activeKey = 'accessories';
        } else if (currentCatalogGender === 'men') {
            activeKey = 'men';
        } else if (currentCatalogGender === 'women') {
            activeKey = 'women';
        } else if (currentCatalogSort === 'discount') {
            activeKey = 'discount';
        } else {
            activeKey = 'all';
        }
    }

    const activeChip = document.querySelector(`.catalog-nav-chip[data-nav="${activeKey}"]`);
    if (activeChip) {
        activeChip.classList.add('active');
        try {
            activeChip.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
        } catch (e) {}
    }
}

function setQuickCatalogFilter(filter, btn) {
    if (filter === 'all') {
        currentCatalogGender = 'all';
        currentCatalogSeason = 'all';
        currentCatalogCategory = 'all';
    } else if (filter === 'men') {
        currentCatalogGender = (currentCatalogGender === 'men') ? 'all' : 'men';
        currentCatalogSeason = 'all';
    } else if (filter === 'women') {
        currentCatalogGender = (currentCatalogGender === 'women') ? 'all' : 'women';
        currentCatalogSeason = 'all';
    } else if (filter === 'demi') {
        currentCatalogSeason = (currentCatalogSeason === 'demi') ? 'all' : 'demi';
        currentCatalogGender = 'all';
    } else if (filter === 'winter') {
        currentCatalogSeason = (currentCatalogSeason === 'winter') ? 'all' : 'winter';
        currentCatalogGender = 'all';
    }

    syncQuickCatalogPills();
    updateFilterBadges();
    syncDrawerActiveStates();
    updateCatalogFilterBadge();
    applyCatalogFilters();

    const catSection = document.getElementById('catalog');
    if (catSection && window.pageYOffset > catSection.offsetTop + 100) {
        catSection.scrollIntoView({ behavior: 'smooth' });
    }
}

function syncQuickCatalogPills() {
    let activeQuick = 'all';
    if (currentCatalogGender === 'men' && currentCatalogSeason === 'all') {
        activeQuick = 'men';
    } else if (currentCatalogGender === 'women' && currentCatalogSeason === 'all') {
        activeQuick = 'women';
    } else if (currentCatalogSeason === 'demi' && currentCatalogGender === 'all') {
        activeQuick = 'demi';
    } else if (currentCatalogSeason === 'winter' && currentCatalogGender === 'all') {
        activeQuick = 'winter';
    } else if (currentCatalogGender === 'all' && currentCatalogSeason === 'all') {
        activeQuick = 'all';
    } else {
        activeQuick = null;
    }

    document.querySelectorAll('.catalog-pill-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.quick === activeQuick);
    });
}

function updateCatalogModelsCountText() {
    const modelsCountEl = document.getElementById('catalogModelsCount');
    if (!modelsCountEl) return;
    const total = (typeof catalogFilteredProducts !== 'undefined' && catalogFilteredProducts) 
        ? catalogFilteredProducts.length 
        : (typeof catalogAllProducts !== 'undefined' && catalogAllProducts ? catalogAllProducts.length : 159);
    
    let countWord = 'моделей';
    if (total % 10 === 1 && total % 100 !== 11) countWord = 'модель';
    else if ([2, 3, 4].includes(total % 10) && ![12, 13, 14].includes(total % 100)) countWord = 'моделі';

    modelsCountEl.textContent = `Знайдено ${total.toLocaleString('uk-UA')} ${countWord} у наявності`;
}

// Global window exposure for inline onclick handlers
window.openCatalogDrawer = openCatalogDrawer;
window.closeCatalogDrawer = closeCatalogDrawer;
window.toggleCatalogDrawer = toggleCatalogDrawer;
window.toggleDrawerAccordion = toggleDrawerAccordion;
window.toggleDrawerNested = toggleDrawerNested;
window.applyDrawerCategory = applyDrawerCategory;
window.applyDrawerGender = applyDrawerGender;
window.applyDrawerSeason = applyDrawerSeason;
window.applyDrawerBrand = applyDrawerBrand;
window.applyDrawerSize = applyDrawerSize;
window.applyDrawerSubSearch = applyDrawerSubSearch;
window.applyDrawerFavorites = applyDrawerFavorites;
window.handleDrawerSearch = handleDrawerSearch;
window.resetAllCatalogFilters = resetAllCatalogFilters;
window.updateCatalogFilterBadge = updateCatalogFilterBadge;
window.removeActiveFilterTag = removeActiveFilterTag;
window.applyQuickNavFilter = applyQuickNavFilter;
window.syncQuickNavChips = syncQuickNavChips;
window.setQuickCatalogFilter = setQuickCatalogFilter;
window.syncQuickCatalogPills = syncQuickCatalogPills;
window.updateCatalogModelsCountText = updateCatalogModelsCountText;

// Global Escape and Enter handlers for catalog drawer
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeCatalogDrawer();
    }
    if (e.key === 'Enter' && e.target && e.target.id === 'drawerSearchInput') {
        const val = e.target.value.trim();
        if (val) {
            closeCatalogDrawer();
            if (!document.getElementById('catalog')) {
                window.location.href = `index.html?search=${encodeURIComponent(val)}#catalog`;
            } else {
                const cat = document.getElementById('catalog');
                if (cat) cat.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }
    if (e.key === 'Enter' && e.target && e.target.id === 'catalogSearchInput') {
        clearTimeout(catalogSearchDebounceTimer);
        currentCatalogSearchQuery = e.target.value.trim();
        applyCatalogFilters();
        e.target.blur();
        const grid = document.querySelector('.products-grid');
        if (grid) {
            const topPos = grid.getBoundingClientRect().top + window.pageYOffset - 120;
            window.scrollTo({ top: topPos, behavior: 'smooth' });
        }
    }
});

let currentBrandsList = [];

function updateBrandButtonState() {
    const btn = document.getElementById('brandSelectBtn');
    const label = document.getElementById('brandBtnLabel');
    const countEl = document.getElementById('brandBtnCount');
    const clearBtn = document.getElementById('brandQuickClearBtn');
    if (!btn || !label) return;

    if (currentCatalogBrand !== 'all') {
        const brandItem = currentBrandsList.find(b => b.slug === currentCatalogBrand) ||
            (catalogMeta && catalogMeta.brands && catalogMeta.brands.find(b => b.slug === currentCatalogBrand));
        const name = brandItem ? brandItem.name : currentCatalogBrand;
        const count = brandItem ? brandItem.count : 0;

        btn.classList.add('active');
        label.textContent = name;
        if (countEl) {
            countEl.textContent = `(${count.toLocaleString('uk-UA')})`;
            countEl.style.display = 'inline';
        }
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    } else {
        btn.classList.remove('active');
        label.textContent = 'Всі бренди';
        if (countEl) {
            const allItem = currentBrandsList.find(b => b.slug === 'all');
            const totalCount = allItem ? allItem.count : ((catalogMeta && catalogMeta.brands && catalogMeta.brands[0]) ? catalogMeta.brands[0].count : (catalogAllProducts.length || 7804));
            countEl.textContent = `(${totalCount.toLocaleString('uk-UA')})`;
            countEl.style.display = 'inline';
        }
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

function renderBrandFilterChips(meta) {
    if (!meta || !meta.brands) return;

    let brandsList = meta.brands;
    const filterByGender = currentCatalogGender !== 'all';
    const filterByCat = currentCatalogCategory !== 'all';
    const filterBySeason = currentCatalogSeason !== 'all';

    if ((filterByGender || filterByCat || filterBySeason) && catalogAllProducts.length) {
        const counts = {};
        catalogAllProducts.forEach(p => {
            if (!productMatchesGender(p, currentCatalogGender)) return;
            if (!productMatchesCategory(p, currentCatalogCategory)) return;
            if (!productMatchesSeason(p, currentCatalogSeason)) return;

            counts[p.brand] = (counts[p.brand] || 0) + 1;
        });
        const activeTotal = Object.values(counts).reduce((a, b) => a + b, 0);

        brandsList = [
            { slug: 'all', name: 'Всі бренди', count: activeTotal },
            ...meta.brands.filter(b => b.slug !== 'all' && (counts[b.slug] || 0) > 0).map(b => ({
                slug: b.slug,
                name: b.name,
                count: counts[b.slug]
            }))
        ];
    }

    currentBrandsList = brandsList;
    updateBrandButtonState();
    renderBrandModalItems(brandsList);
}

function renderBrandModalItems(list) {
    const modalList = document.getElementById('brandModalList');
    if (!modalList) return;

    const subtitle = document.getElementById('brandModalTotalSubtitle');
    if (subtitle && list) {
        const brandsCount = list.filter(b => b.slug !== 'all').length;
        subtitle.textContent = `Доступно брендів: ${brandsCount}`;
    }

    if (!list || list.length === 0) {
        modalList.innerHTML = `
            <div class="brand-modal-empty">
                <p>Брендів за вашим запитом не знайдено</p>
            </div>
        `;
        return;
    }

    modalList.innerHTML = list.map(b => {
        const isActive = currentCatalogBrand === b.slug;
        const icon = '';
        return `
            <button type="button" class="brand-list-item ${isActive ? 'active' : ''}" data-brand="${b.slug}" onclick="selectBrandFromModal('${b.slug}')">
                <span class="brand-item-name">${icon}${escapeHtml(b.name)}</span>
                <span class="brand-item-count">${b.count.toLocaleString('uk-UA')}</span>
                <span class="brand-item-check">${isActive ? '✓' : ''}</span>
            </button>
        `;
    }).join('');
}

function openBrandModal() {
    const modal = document.getElementById('brandModal');
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    const searchInput = document.getElementById('brandModalSearchInput');
    if (searchInput) {
        searchInput.value = '';
        if (window.innerWidth > 768) {
            setTimeout(() => searchInput.focus(), 100);
        }
    }
    const clearBtn = document.getElementById('brandModalSearchClear');
    if (clearBtn) clearBtn.style.display = 'none';

    renderBrandModalItems(currentBrandsList);
}

function closeBrandModal() {
    const modal = document.getElementById('brandModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
}

function handleBrandOverlayClick(e) {
    if (e.target.id === 'brandModal') {
        closeBrandModal();
    }
}

function selectBrandFromModal(brandSlug) {
    closeBrandModal();
    filterCatalog(brandSlug);
    const grid = document.querySelector('.products-grid');
    if (grid) {
        const topPos = grid.getBoundingClientRect().top + window.pageYOffset - 120;
        window.scrollTo({ top: topPos, behavior: 'smooth' });
    }
}

function clearBrandSelection(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    filterCatalog('all');
}

function handleBrandModalSearch(val) {
    const clearBtn = document.getElementById('brandModalSearchClear');
    if (clearBtn) clearBtn.style.display = val ? 'flex' : 'none';

    const q = val.trim().toLowerCase();
    if (!q) {
        renderBrandModalItems(currentBrandsList);
        return;
    }

    const filtered = (currentBrandsList || []).filter(b => {
        if (b.slug === 'all') return true;
        return b.name.toLowerCase().includes(q) || b.slug.toLowerCase().includes(q);
    });

    renderBrandModalItems(filtered);
}

function clearBrandModalSearch() {
    const input = document.getElementById('brandModalSearchInput');
    if (input) {
        input.value = '';
        input.focus();
    }
    const clearBtn = document.getElementById('brandModalSearchClear');
    if (clearBtn) clearBtn.style.display = 'none';
    renderBrandModalItems(currentBrandsList);
}

// --- Quick Choice State & Handlers ---
let currentQuickChoice = { type: null, val: null, label: null };

function openQuickChoiceModal() {
    const modal = document.getElementById('quickChoiceModal');
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    document.querySelectorAll('.quick-modal-chip').forEach(chip => {
        const matches = currentQuickChoice.type === chip.dataset.type && currentQuickChoice.val === chip.dataset.val;
        chip.classList.toggle('active', !!matches);
    });
}

function closeQuickChoiceModal() {
    const modal = document.getElementById('quickChoiceModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
}

function handleQuickChoiceOverlayClick(e) {
    if (e.target.id === 'quickChoiceModal') {
        closeQuickChoiceModal();
    }
}

function selectQuickChoice(type, val, label) {
    closeQuickChoiceModal();
    currentQuickChoice = { type, val, label };
    updateQuickChoiceButtonState();

    if (type === 'gender') {
        selectCatalogGender(val);
    } else if (type === 'category') {
        selectCatalogCategory(val);
    } else if (type === 'season') {
        selectCatalogSeason(val);
    } else if (type === 'search') {
        const input = document.getElementById('catalogSearchInput');
        if (input) input.value = val;
        currentCatalogSearchQuery = val;
        applyCatalogFilters();
    } else if (type === 'sort') {
        currentCatalogSort = val;
        const sortSel = document.getElementById('catalogSortSelect');
        if (sortSel) sortSel.value = val;
        applyCatalogFilters();
    } else if (type === 'size') {
        filterCatalogBySize(val);
    }

    const grid = document.querySelector('.products-grid');
    if (grid) {
        const topPos = grid.getBoundingClientRect().top + window.pageYOffset - 120;
        window.scrollTo({ top: topPos, behavior: 'smooth' });
    }
}

function clearQuickChoiceSelection(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    const prevType = currentQuickChoice.type;
    currentQuickChoice = { type: null, val: null, label: null };
    updateQuickChoiceButtonState();

    if (prevType === 'gender') {
        selectCatalogGender('all');
    } else if (prevType === 'category') {
        selectCatalogCategory('all');
    } else if (prevType === 'season') {
        selectCatalogSeason('all');
    } else if (prevType === 'size') {
        filterCatalogBySize('all');
    } else if (prevType === 'search') {
        const input = document.getElementById('catalogSearchInput');
        if (input) input.value = '';
        currentCatalogSearchQuery = '';
        applyCatalogFilters();
    } else if (prevType === 'sort') {
        const sortSel = document.getElementById('catalogSortSelect');
        if (sortSel) sortSel.value = 'popular';
        handleCatalogSort('popular');
    }
}

function updateQuickChoiceButtonState() {
    const btn = document.getElementById('quickChoiceBtn');
    const label = document.getElementById('quickChoiceBtnLabel');
    const clearBtn = document.getElementById('quickChoiceClearBtn');
    if (!btn || !label) return;

    if (currentQuickChoice.val && currentQuickChoice.val !== 'all') {
        btn.classList.add('active');
        label.textContent = currentQuickChoice.label || currentQuickChoice.val;
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    } else {
        btn.classList.remove('active');
        label.textContent = 'Швидкий вибір';
        if (clearBtn) clearBtn.style.display = 'none';
    }

    document.querySelectorAll('.quick-modal-chip').forEach(chip => {
        const matches = currentQuickChoice.type === chip.dataset.type && currentQuickChoice.val === chip.dataset.val;
        chip.classList.toggle('active', !!matches);
    });
}

let currentSizeModalCategory = 'shoes';

function updateSizeButtonState() {
    const btn = document.getElementById('sizeSelectBtn');
    const label = document.getElementById('sizeBtnLabel');
    const clearBtn = document.getElementById('sizeQuickClearBtn');
    if (!btn || !label) return;

    if (currentCatalogSize !== 'all') {
        btn.classList.add('active');
        label.textContent = `Розмір: ${currentCatalogSize}`;
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    } else {
        btn.classList.remove('active');
        label.textContent = 'Розмір';
        if (clearBtn) clearBtn.style.display = 'none';
    }
}

function openSizeModal() {
    if (!document.getElementById('catalog')) {
        window.location.href = 'index.html#catalog';
        return;
    }
    const modal = document.getElementById('sizeModal');
    if (!modal) return;
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';

    // Default to clothing tab since catalog is jackets & outerwear
    switchSizeModalCategory('clothing');

    renderSizeModalItems();
}

function closeSizeModal() {
    const modal = document.getElementById('sizeModal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
    document.body.style.overflow = '';
}

function handleSizeOverlayClick(e) {
    if (e.target.id === 'sizeModal') {
        closeSizeModal();
    }
}

function switchSizeModalCategory(cat) {
    currentSizeModalCategory = cat;
    const tabShoes = document.getElementById('sizeModalTabShoes');
    const tabClothing = document.getElementById('sizeModalTabClothing');
    const paneShoes = document.getElementById('sizeModalPaneShoes');
    const paneClothing = document.getElementById('sizeModalPaneClothing');

    if (tabShoes && tabClothing && paneShoes && paneClothing) {
        if (cat === 'shoes') {
            tabShoes.classList.add('active');
            tabClothing.classList.remove('active');
            paneShoes.style.display = 'block';
            paneClothing.style.display = 'none';
        } else {
            tabClothing.classList.add('active');
            tabShoes.classList.remove('active');
            paneClothing.style.display = 'block';
            paneShoes.style.display = 'none';
        }
    }
}

function renderSizeModalItems() {
    const shoeSizes = ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46'];
    const clothingSizes = ['S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL', '6XL'];

    // Compute live counts
    const counts = {};
    if (catalogAllProducts && catalogAllProducts.length) {
        catalogAllProducts.forEach(p => {
            if (!productMatchesGender(p, currentCatalogGender)) return;
            if (!productMatchesSeason(p, currentCatalogSeason)) return;
            if (currentCatalogBrand !== 'all' && p.brand !== currentCatalogBrand) return;

            shoeSizes.forEach(sz => {
                if (productMatchesSize(p, sz)) {
                    counts[sz] = (counts[sz] || 0) + 1;
                }
            });
            clothingSizes.forEach(sz => {
                if (productMatchesSize(p, sz)) {
                    counts[sz] = (counts[sz] || 0) + 1;
                }
            });
        });
    }

    const shoesGrid = document.getElementById('sizeModalShoesGrid');
    if (shoesGrid) {
        shoesGrid.innerHTML = shoeSizes.map(sz => {
            const count = counts[sz] || 0;
            const isActive = currentCatalogSize === sz;
            return `
                <button type="button" class="size-modal-item ${isActive ? 'active' : ''} ${count === 0 ? 'empty' : ''}" data-size="${sz}" onclick="selectSizeFromModal('${sz}')">
                    <span class="size-modal-num">${sz}</span>
                    <span class="size-modal-count">${count ? count.toLocaleString('uk-UA') + ' мод.' : 'немає'}</span>
                    <span class="size-modal-check">${isActive ? '✓' : ''}</span>
                </button>
            `;
        }).join('');
    }

    const clothingGrid = document.getElementById('sizeModalClothingGrid');
    if (clothingGrid) {
        clothingGrid.innerHTML = clothingSizes.map(sz => {
            const count = counts[sz] || 0;
            const isActive = currentCatalogSize === sz;
            return `
                <button type="button" class="size-modal-item ${isActive ? 'active' : ''} ${count === 0 ? 'empty' : ''}" data-size="${sz}" onclick="selectSizeFromModal('${sz}')">
                    <span class="size-modal-num">${sz}</span>
                    <span class="size-modal-count">${count ? count.toLocaleString('uk-UA') + ' мод.' : 'немає'}</span>
                    <span class="size-modal-check">${isActive ? '✓' : ''}</span>
                </button>
            `;
        }).join('');
    }
}

function selectSizeFromModal(size) {
    closeSizeModal();
    if (!document.getElementById('catalog')) {
        window.location.href = size === 'all' ? 'index.html#catalog' : `index.html?size=${encodeURIComponent(size)}#catalog`;
        return;
    }
    if (currentCatalogSize === size) {
        filterCatalogBySize('all');
    } else {
        filterCatalogBySize(size);
    }
    const grid = document.querySelector('.products-grid');
    if (grid) {
        const topPos = grid.getBoundingClientRect().top + window.pageYOffset - 120;
        window.scrollTo({ top: topPos, behavior: 'smooth' });
    }
}

function clearSizeSelection(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    filterCatalogBySize('all');
}

function filterCatalog(brand, btn) {
    if (currentCatalogBrand === brand && brand !== 'all') {
        currentCatalogBrand = 'all';
    } else {
        currentCatalogBrand = brand;
    }

    updateBrandButtonState();
    renderBrandModalItems(currentBrandsList);
    applyCatalogFilters();
}

function filterCatalogBySize(size, btn) {
    if (currentCatalogSize === size && size !== 'all') {
        currentCatalogSize = 'all';
    } else {
        currentCatalogSize = size;
    }

    updateSizeButtonState();
    applyCatalogFilters();
}

function filterCatalogByPrice(range, btn) {
    if (currentCatalogPriceRange === range && range !== 'all') {
        currentCatalogPriceRange = 'all';
    } else {
        currentCatalogPriceRange = range;
    }

    const container = document.querySelector('.price-filter-chips');
    if (container) {
        container.querySelectorAll('.price-filter-chip').forEach(b => {
            if (b.dataset.price === currentCatalogPriceRange) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    const indicator = document.getElementById('activePriceLabel');
    if (indicator) {
        const labels = {
            'all': 'Всі',
            'under-1500': 'До 1 500 грн',
            '1500-2500': '1 500 – 2 500 грн',
            '2500-3500': '2 500 – 3 500 грн',
            'above-3500': 'Від 3 500 грн'
        };
        indicator.textContent = labels[currentCatalogPriceRange] || 'Всі';
    }

    applyCatalogFilters();
}

function handleCatalogSearch(query) {
    clearTimeout(catalogSearchDebounceTimer);
    catalogSearchDebounceTimer = setTimeout(() => {
        currentCatalogSearchQuery = query;
        applyCatalogFilters();
    }, 150);
}

function clearCatalogSearch() {
    const input = document.getElementById('catalogSearchInput');
    if (input) input.value = '';
    currentCatalogSearchQuery = '';
    currentCatalogGender = 'all';
    currentCatalogBrand = 'all';
    currentCatalogCategory = 'all';
    currentCatalogSeason = 'all';
    currentCatalogSize = 'all';
    currentCatalogPriceRange = 'all';
    currentQuickChoice = { type: null, val: null, label: null };
    updateQuickChoiceButtonState();

    document.querySelectorAll('.gender-pill-btn').forEach((b, idx) => {
        if (idx === 0) b.classList.add('active');
        else b.classList.remove('active');
    });

    document.querySelectorAll('.main-cat-btn').forEach((b, idx) => {
        if (idx === 0) b.classList.add('active');
        else b.classList.remove('active');
    });

    document.querySelectorAll('.season-pill-btn').forEach((b, idx) => {
        if (idx === 0) b.classList.add('active');
        else b.classList.remove('active');
    });

    const sizeContainer = document.getElementById('catalogSizeFilterChips');
    if (sizeContainer) {
        sizeContainer.querySelectorAll('.size-filter-btn').forEach((b, idx) => {
            if (idx === 0) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    const priceContainer = document.querySelector('.price-filter-chips');
    if (priceContainer) {
        priceContainer.querySelectorAll('.price-filter-chip').forEach((b, idx) => {
            if (idx === 0) b.classList.add('active');
            else b.classList.remove('active');
        });
    }

    const activeSizeLabel = document.getElementById('activeSizeLabel');
    if (activeSizeLabel) activeSizeLabel.textContent = 'Всі розміри';

    const activePriceLabel = document.getElementById('activePriceLabel');
    if (activePriceLabel) activePriceLabel.textContent = 'Всі';

    updateFilterBadges();
    updateSizeButtonState();

    if (catalogMeta) {
        renderBrandFilterChips(catalogMeta);
    }

    applyCatalogFilters();
}

function quickSearch(term) {
    const input = document.getElementById('catalogSearchInput');
    if (input) {
        input.value = term;
        input.focus();
    }
    currentCatalogSearchQuery = term;
    currentQuickChoice = { type: 'search', val: term, label: term };
    updateQuickChoiceButtonState();
    applyCatalogFilters();
}

const SORT_DISPLAY_MAP = {
    'popular': 'За популярністю',
    'default': 'За популярністю',
    'discount': 'Найбільша знижка',
    'price-asc': 'Ціна: від дешевих',
    'price-desc': 'Ціна: від дорогих',
    'newest': 'Новинки спочатку',
    'name-asc': 'За назвою (А-Я)'
};

function updateSortDisplayLabel(criteria) {
    const displayEl = document.getElementById('catalogSortCurrentVal');
    if (!displayEl) return;
    const sortSelect = document.getElementById('catalogSortSelect');
    const val = criteria || (sortSelect ? sortSelect.value : 'popular');
    if (SORT_DISPLAY_MAP[val]) {
        displayEl.textContent = SORT_DISPLAY_MAP[val];
    } else if (sortSelect && sortSelect.options && sortSelect.selectedIndex >= 0) {
        displayEl.textContent = sortSelect.options[sortSelect.selectedIndex].text;
    } else {
        displayEl.textContent = 'За популярністю';
    }
}

function handleCatalogSort(criteria) {
    currentCatalogSort = criteria;
    const sortSelect = document.getElementById('catalogSortSelect');
    if (sortSelect && sortSelect.value !== criteria) {
        sortSelect.value = criteria;
    }
    updateSortDisplayLabel(criteria);
    applyCatalogFilters();
}

let catalogProductSearchScores = new Map();

const CYRILLIC_HOMOGLYPH_MAP = {
    'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'ё': 'e',
    'н': 'h', 'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p',
    'т': 't', 'х': 'x', 'і': 'i', 'ї': 'i', 'у': 'y'
};

function normalizeSearchCode(str) {
    if (!str) return '';
    let s = String(str).toLowerCase().trim();
    for (const [cyr, lat] of Object.entries(CYRILLIC_HOMOGLYPH_MAP)) {
        s = s.split(cyr).join(lat);
    }
    return s.replace(/[^a-z0-9]/g, '');
}

function extractArticleSearchQuery(raw) {
    if (!raw) return '';
    let str = String(raw).trim().toLowerCase();
    str = str.replace(/^(?:артикул|арт|код\s*товару|код\s*товара|код|sku|id|товар|номер|модель|№|#)[\s.:#№\-_/]*/i, '');
    return normalizeSearchCode(str);
}

function getProductArtMatchScore(item, rawQuery) {
    if (!item || !rawQuery) return 0;
    const cleanQ = extractArticleSearchQuery(rawQuery);
    const normArt = normalizeSearchCode(item.art);
    const normId = normalizeSearchCode(item.id);

    // 1. Whole query match
    if (cleanQ && cleanQ.length >= 2) {
        if (normArt && normArt === cleanQ) return 1000;
        if (normId && normId === cleanQ) return 950;
        if (cleanQ.length >= 3 && normArt && normArt.startsWith(cleanQ)) return 800;
        if (cleanQ.length >= 3 && normId && normId.startsWith(cleanQ)) return 750;
        if (cleanQ.length >= 3 && normArt && normArt.includes(cleanQ)) return 600;
        if (cleanQ.length >= 4 && normId && normId.includes(cleanQ)) return 550;
    }

    // 2. Token match if query has multiple words (e.g. "Nike N00367", "арт А00136")
    const words = String(rawQuery).trim().split(/\s+/);
    if (words.length > 1) {
        let bestTokScore = 0;
        for (const w of words) {
            const tokCode = extractArticleSearchQuery(w);
            if (!tokCode || tokCode.length < 2) continue;
            if (/^\d+$/.test(tokCode) && tokCode.length < 4) continue;

            let score = 0;
            if (normArt && normArt === tokCode) score = 900;
            else if (normId && normId === tokCode) score = 850;
            else if (tokCode.length >= 3 && normArt && normArt.startsWith(tokCode)) score = 700;
            else if (tokCode.length >= 3 && normArt && normArt.includes(tokCode)) score = 500;

            if (score > bestTokScore) bestTokScore = score;
        }
        if (bestTokScore > 0) return bestTokScore;
    }

    return 0;
}

function applyCatalogFilters(updateHistory = true) {
    if (!catalogAllProducts.length) return;

    catalogProductSearchScores.clear();

    const query = currentCatalogSearchQuery.trim();
    const queryLower = query.toLowerCase();
    const clearBtn = document.getElementById('clearSearchBtn');

    if (clearBtn) {
        clearBtn.style.display = query ? 'flex' : 'none';
    }

    // Clean tokens for haystack fulltext
    const rawTokens = queryLower ? queryLower.split(/\s+/).filter(Boolean) : [];
    const noiseWords = new Set(['арт', 'арт.', 'артикул', 'артикул:', 'код', 'код:', 'sku', 'sku:', 'id', 'id:', '№', '#']);
    const queryTokens = (rawTokens.length > 1)
        ? rawTokens.filter(t => !noiseWords.has(t))
        : rawTokens;

    // Filter array
    catalogFilteredProducts = catalogAllProducts.filter(item => {
        const artScore = query ? getProductArtMatchScore(item, query) : 0;
        if (artScore > 0) {
            catalogProductSearchScores.set(String(item.id), artScore);
        }

        // Direct article/ID matches (score >= 600) bypass category, gender, brand, season, size filters!
        const isDirectArtMatch = artScore >= 600;

        if (!isDirectArtMatch) {
            // 0. Gender Filter
            if (!productMatchesGender(item, currentCatalogGender)) return false;

            // 1. Category Filter
            if (!productMatchesCategory(item, currentCatalogCategory)) return false;

            // 2. Season Filter
            if (!productMatchesSeason(item, currentCatalogSeason)) return false;

            // 3. Brand
            if (currentCatalogBrand !== 'all' && item.brand !== currentCatalogBrand) {
                return false;
            }

            // 4. Size Filter
            if (!productMatchesSize(item, currentCatalogSize)) {
                return false;
            }

            // 5. Price Range Filter
            if (currentCatalogPriceRange !== 'all') {
                if (currentCatalogPriceRange === 'under-1500' && item.price >= 1500) return false;
                if (currentCatalogPriceRange === '1500-2500' && (item.price < 1500 || item.price > 2500)) return false;
                if (currentCatalogPriceRange === '2500-3500' && (item.price < 2500 || item.price > 3500)) return false;
                if (currentCatalogPriceRange === 'above-3500' && item.price <= 3500) return false;
            }

            // 6. Query Search
            if (queryTokens.length > 0) {
                if (artScore === 0) {
                    const haystack = `${item.id || ''} ${item.name || ''} ${item.brand_name || ''} ${item.art || ''} ${item.mat || ''} ${item.origin || ''} ${item.cat || ''} ${item.season || ''} ${item.cat_name || ''} ${item.season_name || ''}`.toLowerCase();
                    const normHaystack = normalizeSearchCode(haystack);
                    const matchesAll = queryTokens.every(tok => {
                        if (haystack.includes(tok)) return true;
                        const normTok = normalizeSearchCode(tok);
                        return normTok && normHaystack.includes(normTok);
                    });
                    if (!matchesAll) return false;
                }
            }
        }
        return true;
    });

    // Fallback: If query produced 0 results under active restrictive filters, search the entire catalog!
    if (query && catalogFilteredProducts.length === 0) {
        const globalMatches = catalogAllProducts.filter(item => {
            const artScore = getProductArtMatchScore(item, query);
            if (artScore > 0) {
                catalogProductSearchScores.set(String(item.id), artScore);
                if (artScore >= 500) return true;
            }
            if (queryTokens.length > 0) {
                const haystack = `${item.id || ''} ${item.name || ''} ${item.brand_name || ''} ${item.art || ''} ${item.mat || ''} ${item.origin || ''} ${item.cat || ''} ${item.season || ''} ${item.cat_name || ''} ${item.season_name || ''}`.toLowerCase();
                const normHaystack = normalizeSearchCode(haystack);
                return queryTokens.every(tok => {
                    if (haystack.includes(tok)) return true;
                    const normTok = normalizeSearchCode(tok);
                    return normTok && normHaystack.includes(normTok);
                });
            }
            return false;
        });

        if (globalMatches.length > 0) {
            catalogFilteredProducts = globalMatches;
        }
    }

    // Sort
    sortFilteredProducts(currentCatalogSort);

    // Calculate how many products to render (Hard safety cap to prevent mobile WebKit memory crashes)
    let initialBatchCount = CATALOG_PAGE_SIZE;
    if (returnProductId) {
        let targetIdx = catalogFilteredProducts.findIndex(p => String(p.id) === String(returnProductId));
        if (targetIdx === -1) {
            // Target product is not in current filtered list; search catalogAllProducts
            const itemMatch = catalogAllProducts.find(p => String(p.id) === String(returnProductId));
            if (itemMatch) {
                // Reset restrictive filters so the user's viewed item is guaranteed to appear
                currentCatalogCategory = 'all';
                currentCatalogGender = 'all';
                currentCatalogSeason = 'all';
                currentCatalogBrand = 'all';
                currentCatalogSize = 'all';
                currentCatalogSearchQuery = '';
                catalogFilteredProducts = catalogAllProducts.slice();
                sortFilteredProducts(currentCatalogSort);
                targetIdx = catalogFilteredProducts.findIndex(p => String(p.id) === String(returnProductId));
            }
        }
        if (targetIdx !== -1) {
            if (targetIdx < 48) {
                // Render up to 48 items so target card is fully present in DOM
                initialBatchCount = Math.max(initialBatchCount, Math.ceil((targetIdx + 4) / CATALOG_PAGE_SIZE) * CATALOG_PAGE_SIZE);
            } else {
                // To prevent mobile memory crashes, never render hundreds or thousands of cards at once!
                // Move the viewed product to the beginning of the view list so it is immediately rendered in the first batch
                const targetItem = catalogFilteredProducts.splice(targetIdx, 1)[0];
                if (targetItem) {
                    catalogFilteredProducts.unshift(targetItem);
                }
                initialBatchCount = CATALOG_PAGE_SIZE;
            }
        }
    }
    if (savedCatalogState && savedCatalogState.renderedCount) {
        // Cap saved batch count on mobile/reload to at most 48 items
        initialBatchCount = Math.max(initialBatchCount, Math.min(48, savedCatalogState.renderedCount));
    }

    // Absolute hard ceiling: NEVER render more than 48 cards synchronously
    initialBatchCount = Math.min(48, Math.max(CATALOG_PAGE_SIZE, initialBatchCount));

    // Render from page 1 with initialBatchCount
    catalogRenderedCount = 0;
    renderCatalogGrid(false, initialBatchCount);

    // Update Filter Summary Bar & Active Filter Chips
    updateCatalogFilterUI(query);
    updateSizeButtonState();
    renderActiveFilterTags();
    syncDrawerActiveStates();
    syncQuickNavChips();
    syncQuickCatalogPills();
    updateCatalogModelsCountText();

    // If returning from viewed product, scroll directly to that product card
    if (returnProductId) {
        scrollToCatalogProductCard(returnProductId, savedCatalogState ? savedCatalogState.scrollY : null);
    } else {
        // Deep link auto-scroll check (Ad message-match)
        checkDeepLinkPromo();
    }

    if (updateHistory) {
        syncCatalogUrl(true);
    }
}

function sortFilteredProducts(criteria) {
    catalogFilteredProducts.sort((a, b) => {
        // 1. Article / ID match score takes absolute top priority
        const scoreA = catalogProductSearchScores.get(String(a.id)) || 0;
        const scoreB = catalogProductSearchScores.get(String(b.id)) || 0;
        if (scoreA !== scoreB) {
            return scoreB - scoreA;
        }

        const idA = parseInt(a.id, 10) || 0;
        const idB = parseInt(b.id, 10) || 0;

        const orderA = typeof a._order === 'number' ? a._order : 999999;
        const orderB = typeof b._order === 'number' ? b._order : 999999;

        switch (criteria) {
            case 'price-asc': {
                const diff = a.price - b.price;
                if (diff !== 0) return diff;
                if (orderA !== orderB) return orderA - orderB;
                return idB - idA;
            }
            case 'price-desc': {
                const diff = b.price - a.price;
                if (diff !== 0) return diff;
                if (orderA !== orderB) return orderA - orderB;
                return idB - idA;
            }
            case 'discount': {
                const discountA = (a.old_price || a.price) - a.price;
                const discountB = (b.old_price || b.price) - b.price;
                const diff = discountB - discountA;
                if (diff !== 0) return diff;
                if (orderA !== orderB) return orderA - orderB;
                return idB - idA;
            }
            case 'name-asc': {
                const diff = a.name.localeCompare(b.name, 'uk', { sensitivity: 'base' });
                if (diff !== 0) return diff;
                if (orderA !== orderB) return orderA - orderB;
                return idB - idA;
            }
            case 'newest':
            case 'popular':
            default: {
                // Priority showcase order: jackets, vests, hoodies, winter apparel, shoes
                if (orderA !== orderB) return orderA - orderB;
                return idB - idA;
            }
        }
    });
}

function checkDeepLinkPromo() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const targetId = urlParams.get('id') || urlParams.get('product') || (urlParams.has('promo') ? '117306' : null);
        if (targetId && !window._hasScrolledToPromo) {
            window._hasScrolledToPromo = true;
            setTimeout(() => {
                if (window.scrollToPromoCard) {
                    window.scrollToPromoCard(targetId);
                }
            }, 600);
        }
    } catch (e) {}
}

window.scrollToPromoCard = function(id) {
    const card = document.getElementById(`prod-${id}`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.transition = 'all 0.4s ease';
        card.style.outline = '3px solid #ef4444';
        card.style.boxShadow = '0 0 25px rgba(239, 68, 68, 0.45)';
        setTimeout(() => {
            card.style.outline = '';
            card.style.boxShadow = '';
        }, 4000);
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function getCategoryTitle(cat, item) {
    if (typeof catalogMeta !== 'undefined' && catalogMeta && catalogMeta.categories) {
        const found = catalogMeta.categories.find(c => c.slug === cat);
        if (found) return found.name;
    }
    switch (cat) {
        case 'winter_jacket': return 'Зимові куртки та пуховики';
        case 'coat': return 'Чоловічі стильні пальто';
        case 'leather': return 'Шкіряні куртки та косухи';
        case 'bomber': return 'Бомбери';
        case 'windbreaker': return 'Вітровки';
        case 'jacket': return 'Демісезонні куртки';
        case 'denim': return 'Джинсівки';
        case 'vest': return 'Жіночі жилетки та безрукавки';
        case 'leggings': return 'Жіночі лосини та легінси';
        case 'clothing': return 'Одяг';
        case 'sale': return 'Знижки & SALE';
        default: return 'Товари';
    }
}

function getSeasonTitle(season) {
    switch (season) {
        case 'demi': return 'Демісезон';
        case 'winter': return 'Зима';
        case 'summer': return 'Літо';
        default: return 'Всі сезони';
    }
}

function formatSizeLabel(sz) {
    if (!sz) return '';
    let str = String(sz).trim();
    // Normalize spaces around dashes in ranges: "36 - 42" -> "36–42"
    str = str.replace(/(\d+)\s*[-–]\s*(\d+)/g, '$1–$2');
    // Normalize one size capitalization
    if (/^one\s*size$/i.test(str)) return 'One Size';
    return str;
}

function createProductCardElement(item, index = 10) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.id = `prod-${item.id}`;
    card.dataset.brand = item.brand || '';
    card.dataset.category = item.cat || '';
    card.dataset.price = item.price || 0;
    card.dataset.name = item.name || '';
    card.dataset.art = item.art || '';
    card.dataset.id = item.id || '';
    card.dataset.mat = item.mat || '';
    card.dataset.origin = item.origin || '';

    const displayName = formatProductDisplayName(item);
    const mainImg = (item.imgs && item.imgs[0]) ? item.imgs[0] : 'images/sneakers.webp';
    const prodUrl = getProductUrl(item);

    const isFav = isFavorite(item.id);
    const favBtnHtml = `
        <button type="button" class="btn-card-fav ${isFav ? 'active' : ''}" data-id="${item.id}" onclick="toggleFavorite('${item.id}', event)" aria-label="${isFav ? 'Видалити з обраного' : 'Додати в обране'}" title="${isFav ? 'Видалити з обраного' : 'Додати в обране'}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? '#ef4444' : '#ffffff'}" stroke="${isFav ? '#ef4444' : '#000000'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/>
            </svg>
        </button>
    `;

    // Sizes display (list all available sizes, never through a hyphen)
    let sizesText = '';
    if (item.sizes && item.sizes.length > 0) {
        sizesText = item.sizes.map(s => String(s).trim()).filter(Boolean).join(', ');
    }

    // Optional badge
    let badgeHtml = '';
    const isGtx = /gtx|gore-?tex/i.test(item.name || '') || /gtx|gore-?tex/i.test(item.cat || '');
    if (isGtx) {
        badgeHtml = `
            <div class="card-badge-diamond" title="GORE-TEX">
                <span class="diamond-sub">GUARANTEED<br>TO KEEP YOU DRY</span>
                <span class="diamond-main">GORE-TEX</span>
            </div>
        `;
    }

    const formattedPrice = item.price.toLocaleString('uk-UA') + ' грн.';
    const formattedOldPrice = item.old_price && item.old_price > item.price ? item.old_price.toLocaleString('uk-UA') + ' грн.' : '';

    const isOutOfStock = !item.in_stock;
    if (isOutOfStock) {
        card.classList.add('is-out-of-stock');
    }
    const stockBadgeHtml = isOutOfStock
        ? '<span class="card-out-of-stock-pill">Немає в наявності</span>'
        : '';

    const isLcp = (index === 0);
    const isAboveFold = (index < 4);
    const imgPriorityAttrs = isLcp
        ? 'fetchpriority="high" loading="eager"'
        : (isAboveFold ? 'loading="eager"' : 'loading="lazy"');

    card.innerHTML = `
        <a href="${prodUrl}" class="want-card-link" onclick="openProductPage('${item.id}', event, '${prodUrl}', false)">
            <div class="product-img-wrapper" title="${escapeHtml(displayName)}">
                ${badgeHtml}
                ${favBtnHtml}
                ${stockBadgeHtml}
                <img src="${mainImg}" alt="${escapeHtml(displayName)}" id="cardImg-${item.id}" ${imgPriorityAttrs} width="275" height="360" decoding="async" referrerpolicy="no-referrer" onerror="handleCardImgError(this, '${item.cat}')">
            </div>
            <div class="product-details">
                <p class="product-title" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}</p>
                ${sizesText ? `<p class="product-sizes-text" title="Розміри: ${escapeHtml(sizesText)}">${escapeHtml(sizesText)}</p>` : '<p class="product-sizes-text">&nbsp;</p>'}
                <div class="product-price-row">
                    ${formattedOldPrice ? `<span class="price-old">${formattedOldPrice}</span>` : ''}
                    <span class="price-now">${formattedPrice}</span>
                </div>
            </div>
        </a>
    `;

    return card;
}

function renderCatalogGrid(append, customBatchSize) {
    const grid = document.querySelector('.products-grid');
    const pagination = document.getElementById('catalogPagination');
    const showingCountEl = document.getElementById('catalogShowingCount');
    const progressFillEl = document.getElementById('catalogProgressFill');
    const btnLoadMore = document.getElementById('btnLoadMore');
    const noResultsBox = document.getElementById('noSearchResultsBox');
    const noResultsDetail = document.getElementById('noResultsDetail');

    if (!grid) return;

    if (!append) {
        grid.innerHTML = '';
        catalogRenderedCount = 0;
    }

    const total = catalogFilteredProducts.length;

    if (total === 0) {
        if (pagination) pagination.style.display = 'none';
        if (noResultsBox) {
            noResultsBox.style.display = 'block';
            grid.appendChild(noResultsBox);
            if (noResultsDetail) {
                if (currentCatalogGender === 'favorites') {
                    noResultsDetail.textContent = 'У вас поки немає збережених товарів. Натискайте на сердечко на картці будь-якої моделі, щоб зберегти її в Обране!';
                } else {
                    noResultsDetail.textContent = currentCatalogSearchQuery 
                        ? `За запитом «${currentCatalogSearchQuery}» товарів на складі не знайдено. Спробуйте інше слово або скиньте фільтри.`
                        : 'У вибраній категорії наразі немає доступних моделей.';
                }
            }
        }
        return;
    }

    if (noResultsBox) noResultsBox.style.display = 'none';

    const batchSize = (customBatchSize && customBatchSize > CATALOG_PAGE_SIZE) ? customBatchSize : CATALOG_PAGE_SIZE;
    const nextBatch = catalogFilteredProducts.slice(catalogRenderedCount, catalogRenderedCount + batchSize);
    catalogRenderedCount += nextBatch.length;

    const fragment = document.createDocumentFragment();
    const startIdx = catalogRenderedCount - nextBatch.length;
    nextBatch.forEach((item, idx) => {
        fragment.appendChild(createProductCardElement(item, startIdx + idx));
    });
    grid.appendChild(fragment);

    // Touch gesture swipe support
    initSwipeGalleries();

    // Pagination
    if (pagination) {
        pagination.style.display = 'flex';
        const percent = Math.min(100, Math.round((catalogRenderedCount / total) * 100));
        if (showingCountEl) {
            showingCountEl.textContent = `Показано ${catalogRenderedCount.toLocaleString('uk-UA')} з ${total.toLocaleString('uk-UA')} товарів`;
        }
        if (progressFillEl) {
            progressFillEl.style.width = `${percent}%`;
        }
        if (btnLoadMore) {
            if (catalogRenderedCount >= total) {
                btnLoadMore.style.display = 'none';
            } else {
                btnLoadMore.style.display = 'inline-flex';
                const remaining = total - catalogRenderedCount;
                const nextChunk = Math.min(CATALOG_PAGE_SIZE, remaining);
                const loadMoreSpan = btnLoadMore.querySelector('span');
                if (loadMoreSpan) {
                    loadMoreSpan.textContent = `Показати ще ${nextChunk} моделей`;
                } else {
                    btnLoadMore.textContent = `Показати ще ${nextChunk} моделей`;
                }
            }
        }
    }
}

function loadMoreProducts() {
    renderCatalogGrid(true);
}

function updateCatalogFilterUI(query) {
    const resultsInfo = document.getElementById('searchResultsInfo');
    const resultsCountEl = document.getElementById('searchResultsCount');

    const hasActiveFilters = (
        query !== '' || 
        currentCatalogGender !== 'all' || 
        currentCatalogCategory !== 'all' || 
        currentCatalogSeason !== 'all' || 
        currentCatalogBrand !== 'all' ||
        currentCatalogSize !== 'all' ||
        currentCatalogPriceRange !== 'all'
    );
    if (resultsInfo && resultsCountEl) {
        if (hasActiveFilters) {
            resultsInfo.style.display = 'flex';

            const labels = [];
            if (currentCatalogGender !== 'all') {
                if (currentCatalogGender === 'favorites') {
                    labels.push('Обране');
                } else {
                    labels.push(currentCatalogGender === 'men' ? 'Чоловіче' : 'Жіноче');
                }
            }
            if (currentCatalogCategory !== 'all') {
                labels.push(getCategoryTitle(currentCatalogCategory));
            }
            if (currentCatalogSeason !== 'all') {
                labels.push(getSeasonTitle(currentCatalogSeason));
            }
            if (currentCatalogBrand !== 'all') {
                const brandItem = catalogMeta && catalogMeta.brands.find(b => b.slug === currentCatalogBrand);
                labels.push(brandItem ? brandItem.name : currentCatalogBrand);
            }
            if (currentCatalogSize !== 'all') {
                labels.push(`Розмір: ${currentCatalogSize}`);
            }

            const total = catalogFilteredProducts.length;
            let countWord = 'моделей';
            if (total % 10 === 1 && total % 100 !== 11) countWord = 'модель';
            else if ([2, 3, 4].includes(total % 10) && ![12, 13, 14].includes(total % 100)) countWord = 'моделі';

            const labelText = labels.length ? ` • ${labels.join(' • ')}` : '';
            if (query) {
                resultsCountEl.textContent = `Знайдено: ${total.toLocaleString('uk-UA')} ${countWord}${labelText} за запитом «${currentCatalogSearchQuery}»`;
            } else {
                resultsCountEl.textContent = `Обрано: ${total.toLocaleString('uk-UA')} ${countWord}${labelText}`;
            }
        } else {
            resultsInfo.style.display = 'none';
        }
    }
}

function focusSearchInput(e) {
    if (e && e.preventDefault) e.preventDefault();
    openCatalogDrawer();
    setTimeout(() => {
        const input = document.getElementById('drawerSearchInput');
        if (input) {
            input.focus();
            input.select();
        }
    }, 250);
}

// Mobile Swipe Support for Product Cards (Strictly horizontal intentional swipe)
function initSwipeGalleries() {
    document.querySelectorAll('.product-card').forEach(card => {
        if (card._swipeInitialized) return;
        const wrapper = card.querySelector('.product-img-wrapper');
        const thumbs = card.querySelectorAll('.card-thumb-img');
        if (!wrapper || thumbs.length <= 1) return;
        card._swipeInitialized = true;

        let startX = 0;
        let startY = 0;
        let startTime = 0;

        wrapper.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
                startTime = Date.now();
            }
        }, { passive: true });

        wrapper.addEventListener('touchend', (e) => {
            if (e.changedTouches.length > 0) {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                const diffX = endX - startX;
                const diffY = endY - startY;
                const elapsedTime = Date.now() - startTime;

                // Only trigger on fast, intentional horizontal swipe (prevents accidental triggers during vertical scroll)
                if (elapsedTime < 450 && Math.abs(diffX) > 65 && Math.abs(diffX) > Math.abs(diffY) * 2.5) {
                    const currentActive = card.querySelector('.card-thumb-img.active') || thumbs[0];
                    let currentIndex = Array.from(thumbs).indexOf(currentActive);

                    if (diffX < 0) {
                        // Swipe Left -> Next
                        currentIndex = (currentIndex + 1) % thumbs.length;
                    } else {
                        // Swipe Right -> Prev
                        currentIndex = (currentIndex - 1 + thumbs.length) % thumbs.length;
                    }
                    thumbs[currentIndex].click();
                }
            }
        }, { passive: true });
    });
}

// High-Speed Smooth Scroll to Top (Ease-Out-Quint)
function scrollToTop(duration = 360) {
    scrollToTopAnimated(duration);
}
window.scrollToTop = scrollToTop;

function scrollToTopAnimated(duration = 360) {
    const startY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (startY <= 0) return;

    // Subtle haptic tick on supported mobile devices
    if (navigator.vibrate) {
        try { navigator.vibrate(15); } catch (_) {}
    }

    const startTime = ('now' in window.performance) ? performance.now() : new Date().getTime();

    // Ease-out quint: rapid initial burst that lands with buttery smoothness
    function easeOutQuint(t) {
        return 1 - Math.pow(1 - t, 5);
    }

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = easeOutQuint(progress);

        window.scrollTo(0, Math.round(startY * (1 - ease)));

        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            window.scrollTo(0, 0);
        }
    }

    window.requestAnimationFrame(step);
}

// Scroll to Top Floating Button (Instant One-Touch Return)
function initScrollTop() {
    const scrollBtn = document.getElementById('scrollTopBtn');
    if (!scrollBtn) return;

    let isTicking = false;
    const updateScrollVisibility = () => {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
        if (scrollY > 280) {
            scrollBtn.classList.add('visible');
        } else {
            scrollBtn.classList.remove('visible');
        }
        isTicking = false;
    };

    window.addEventListener('scroll', () => {
        if (!isTicking) {
            window.requestAnimationFrame(updateScrollVisibility);
            isTicking = true;
        }
    }, { passive: true });
    updateScrollVisibility();

    // Instant one-touch response without 300ms click delay or momentum scroll suppression
    let touchHandled = false;

    const handleTrigger = (e) => {
        if (e && e.cancelable) e.preventDefault();
        if (e && e.stopPropagation) e.stopPropagation();
        scrollToTopAnimated(360);
    };

    // touchend fires immediately on the first finger release
    scrollBtn.addEventListener('touchend', (e) => {
        touchHandled = true;
        handleTrigger(e);
        setTimeout(() => { touchHandled = false; }, 400);
    }, { passive: false });

    // pointerup for pointer devices
    scrollBtn.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'touch') return;
        handleTrigger(e);
    });

    // click as desktop/mouse fallback
    scrollBtn.addEventListener('click', (e) => {
        if (touchHandled) return;
        handleTrigger(e);
    });

    // Logo click in sticky header also smoothly scrolls to top on index.html
    const brandLogo = document.querySelector('.urbano-animated-logo, .header .logo');
    if (brandLogo) {
        brandLogo.addEventListener('click', (e) => {
            if (document.getElementById('productDetailPage')) {
                // On product page, returning via logo returns to catalog product
                e.preventDefault();
                if (typeof returnToCatalogProduct === 'function') {
                    returnToCatalogProduct();
                } else {
                    window.location.href = 'index.html';
                }
                return;
            }
            const currentY = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
            if (currentY > 120) {
                e.preventDefault();
                scrollToTopAnimated(360);
            }
        });
    }
}

// ==========================================
// Nova Poshta API Delivery Autocomplete
// ==========================================
const NP_API_ENDPOINT = 'https://api.novaposhta.ua/v2.0/json/';

// Preloaded top Ukrainian cities for instantaneous 0ms display on focus
const NP_TOP_CITIES = [
    { name: 'Київ', present: 'м. Київ, Київська обл.', ref: 'e718a680-4b33-11e4-ab6d-005056801329', deliveryCity: '8d5a980d-391c-11dd-90d9-001a92567626' },
    { name: 'Львів', present: 'м. Львів, Львівська обл.', ref: 'e71abb60-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88f5-391c-11dd-90d9-001a92567626' },
    { name: 'Одеса', present: 'м. Одеса, Одеська обл.', ref: 'e718bc80-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88d0-391c-11dd-90d9-001a92567626' },
    { name: 'Харків', present: 'м. Харків, Харківська обл.', ref: 'e718b520-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88e0-391c-11dd-90d9-001a92567626' },
    { name: 'Дніпро', present: 'м. Дніпро, Дніпропетровська обл.', ref: 'e718ae30-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88f0-391c-11dd-90d9-001a92567626' },
    { name: 'Запоріжжя', present: 'м. Запоріжжя, Запорізька обл.', ref: 'e718b950-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88c6-391c-11dd-90d9-001a92567626' },
    { name: 'Вінниця', present: 'м. Вінниця, Вінницька обл.', ref: 'e718b050-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88c0-391c-11dd-90d9-001a92567626' },
    { name: 'Івано-Франківськ', present: 'м. Івано-Франківськ, Івано-Франківська обл.', ref: 'e71abb50-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88c4-391c-11dd-90d9-001a92567626' },
    { name: 'Полтава', present: 'м. Полтава, Полтавська обл.', ref: 'e718b320-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88d2-391c-11dd-90d9-001a92567626' },
    { name: 'Тернопіль', present: 'м. Тернопіль, Тернопільська обл.', ref: 'e71abb70-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88d8-391c-11dd-90d9-001a92567626' },
    { name: 'Черкаси', present: 'м. Черкаси, Черкаська обл.', ref: 'e718b760-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88e2-391c-11dd-90d9-001a92567626' },
    { name: 'Житомир', present: 'м. Житомир, Житомирська обл.', ref: 'e718b240-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88c2-391c-11dd-90d9-001a92567626' },
    { name: 'Чернівці', present: 'м. Чернівці, Чернівецька обл.', ref: 'e718b870-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88e4-391c-11dd-90d9-001a92567626' },
    { name: 'Хмельницький', present: 'м. Хмельницький, Хмельницька обл.', ref: 'e718b650-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88de-391c-11dd-90d9-001a92567626' },
    { name: 'Рівне', present: 'м. Рівне, Рівненська обл.', ref: 'e71abb80-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88d4-391c-11dd-90d9-001a92567626' },
    { name: 'Луцьк', present: 'м. Луцьк, Волинська обл.', ref: 'e71abb90-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88ca-391c-11dd-90d9-001a92567626' },
    { name: 'Ужгород', present: 'м. Ужгород, Закарпатська обл.', ref: 'e71abba0-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88dc-391c-11dd-90d9-001a92567626' },
    { name: 'Кривий Ріг', present: 'м. Кривий Ріг, Дніпропетровська обл.', ref: 'e718af20-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88cc-391c-11dd-90d9-001a92567626' },
    { name: 'Миколаїв', present: 'м. Миколаїв, Миколаївська обл.', ref: 'e718b430-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88ce-391c-11dd-90d9-001a92567626' },
    { name: 'Кременчук', present: 'м. Кременчук, Полтавська обл.', ref: 'e718b330-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88d3-391c-11dd-90d9-001a92567626' },
    { name: 'Біла Церква', present: 'м. Біла Церква, Київська обл.', ref: 'e718a700-4b33-11e4-ab6d-005056801329', deliveryCity: 'db5c88ba-391c-11dd-90d9-001a92567626' }
];

let npSelectedCity = null;
let npAllWarehouses = [];
let npActiveWarehouseType = 'all'; // 'all' | 'Branch' | 'Postomat'
let npCityDebounce = null;
let npWarehouseDebounce = null;

function initNovaPoshtaAutocomplete() {
    const cityInput = document.getElementById('npCityInput');
    const cityDropdown = document.getElementById('npCityDropdown');
    const cityClearBtn = document.getElementById('npCityClearBtn');
    const citySpinner = document.getElementById('npCitySpinner');
    const warehouseInput = document.getElementById('npWarehouseInput');
    const warehouseDropdown = document.getElementById('npWarehouseDropdown');
    const warehouseClearBtn = document.getElementById('npWarehouseClearBtn');
    const warehouseSpinner = document.getElementById('npWarehouseSpinner');

    if (!cityInput || !warehouseInput) return;

    // --- City Autocomplete Handlers ---
    cityInput.addEventListener('focus', () => {
        const q = cityInput.value.trim();
        if (!q) {
            renderNpCityDropdown(NP_TOP_CITIES);
        } else if (q.length >= 2) {
            triggerCitySearch(q);
        }
    });

    cityInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (cityClearBtn) cityClearBtn.style.display = q ? 'block' : 'none';
        
        clearTimeout(npCityDebounce);
        if (!q) {
            renderNpCityDropdown(NP_TOP_CITIES);
            resetWarehouseSelection();
            return;
        }

        if (q.length < 2) {
            const matches = NP_TOP_CITIES.filter(c => c.name.toLowerCase().startsWith(q.toLowerCase()));
            renderNpCityDropdown(matches.length ? matches : NP_TOP_CITIES);
            return;
        }

        npCityDebounce = setTimeout(() => {
            triggerCitySearch(q);
        }, 220);
    });

    cityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const firstItem = cityDropdown ? cityDropdown.querySelector('.np-dropdown-item') : null;
            if (firstItem && cityDropdown.style.display !== 'none') {
                e.preventDefault();
                firstItem.click();
            }
        }
    });

    cityInput.addEventListener('blur', () => {
        syncCityNPCombined();
    });

    if (cityClearBtn) {
        cityClearBtn.addEventListener('click', () => {
            cityInput.value = '';
            cityClearBtn.style.display = 'none';
            document.getElementById('npCityRef').value = '';
            document.getElementById('npSettlementRef').value = '';
            document.getElementById('npCityName').value = '';
            document.getElementById('cityNP').value = '';
            npSelectedCity = null;
            resetWarehouseSelection();
            cityInput.focus();
            renderNpCityDropdown(NP_TOP_CITIES);
        });
    }

    // --- Warehouse Autocomplete Handlers ---
    warehouseInput.addEventListener('focus', () => {
        if (!npSelectedCity && cityInput.value.trim()) {
            const typed = cityInput.value.trim().toLowerCase();
            const matched = NP_TOP_CITIES.find(c => c.name.toLowerCase() === typed || c.present.toLowerCase().includes(typed));
            if (matched) {
                selectNpCity(encodeURIComponent(JSON.stringify(matched)));
                return;
            }
        }
        if (npAllWarehouses.length > 0) {
            renderFilteredWarehouses(warehouseInput.value.trim());
        }
    });

    warehouseInput.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        if (warehouseClearBtn) warehouseClearBtn.style.display = q ? 'block' : 'none';
        syncCityNPCombined();

        clearTimeout(npWarehouseDebounce);
        npWarehouseDebounce = setTimeout(() => {
            renderFilteredWarehouses(q);
        }, 120);
    });

    warehouseInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const firstItem = warehouseDropdown ? warehouseDropdown.querySelector('.np-dropdown-item') : null;
            if (firstItem && warehouseDropdown.style.display !== 'none') {
                e.preventDefault();
                firstItem.click();
            }
        }
    });

    warehouseInput.addEventListener('blur', () => {
        syncCityNPCombined();
    });

    if (warehouseClearBtn) {
        warehouseClearBtn.addEventListener('click', () => {
            warehouseInput.value = '';
            warehouseClearBtn.style.display = 'none';
            document.getElementById('npWarehouseRef').value = '';
            document.getElementById('npWarehouseNum').value = '';
            syncCityNPCombined();
            warehouseInput.focus();
            renderFilteredWarehouses('');
        });
    }

    // Close dropdowns on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#npCityDropdown') && e.target !== cityInput && e.target !== cityClearBtn) {
            if (cityDropdown) cityDropdown.style.display = 'none';
        }
        if (!e.target.closest('#npWarehouseDropdown') && e.target !== warehouseInput && e.target !== warehouseClearBtn && !e.target.closest('#npWarehouseFilterTabs')) {
            if (warehouseDropdown) warehouseDropdown.style.display = 'none';
        }
    });

}

async function triggerCitySearch(query) {
    const cityDropdown = document.getElementById('npCityDropdown');
    const citySpinner = document.getElementById('npCitySpinner');
    if (citySpinner) citySpinner.style.display = 'block';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    try {
        const res = await fetch(NP_API_ENDPOINT, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apiKey: '',
                modelName: 'Address',
                calledMethod: 'searchSettlements',
                methodProperties: {
                    CityName: query,
                    Limit: '12',
                    Page: '1'
                }
            })
        });
        clearTimeout(timer);
        const json = await res.json();
        if (json.success && json.data && json.data[0] && json.data[0].Addresses) {
            const results = json.data[0].Addresses.map(a => ({
                name: a.MainDescription,
                present: a.Present,
                ref: a.Ref,
                deliveryCity: a.DeliveryCity
            }));
            renderNpCityDropdown(results);
        } else {
            const local = NP_TOP_CITIES.filter(c => c.present.toLowerCase().includes(query.toLowerCase()));
            renderNpCityDropdown(local);
        }
    } catch (err) {
        clearTimeout(timer);
        console.warn('NP Search Settlements fallback:', err);
        const local = NP_TOP_CITIES.filter(c => c.present.toLowerCase().includes(query.toLowerCase()));
        renderNpCityDropdown(local);
    } finally {
        clearTimeout(timer);
        if (citySpinner) citySpinner.style.display = 'none';
    }
}

function renderNpCityDropdown(cities) {
    const dropdown = document.getElementById('npCityDropdown');
    if (!dropdown) return;

    if (!cities || !cities.length) {
        dropdown.innerHTML = '<div class="np-dropdown-empty">Місто не знайдено. Перевірте написання або введіть вручну.</div>';
        dropdown.style.display = 'block';
        return;
    }

    let html = '';
    cities.forEach(city => {
        const parts = city.present.split(',');
        const title = parts[0];
        const region = parts.slice(1).join(',').trim();
        html += `
            <div class="np-dropdown-item" onclick="selectNpCity('${encodeURIComponent(JSON.stringify(city))}')">
                <div class="np-item-content">
                    <span class="np-item-main">${title}</span>
                    ${region ? `<span class="np-item-sub">${region}</span>` : ''}
                </div>
            </div>
        `;
    });

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
}

async function selectNpCity(encodedCity) {
    const city = JSON.parse(decodeURIComponent(encodedCity));
    npSelectedCity = city;

    const cityInput = document.getElementById('npCityInput');
    const cityDropdown = document.getElementById('npCityDropdown');
    const cityClearBtn = document.getElementById('npCityClearBtn');
    const warehouseInput = document.getElementById('npWarehouseInput');
    const warehouseHint = document.getElementById('npWarehouseHint');

    if (cityInput) cityInput.value = city.present;
    if (cityDropdown) cityDropdown.style.display = 'none';
    if (cityClearBtn) cityClearBtn.style.display = 'block';

    document.getElementById('npCityRef').value = city.deliveryCity || '';
    document.getElementById('npSettlementRef').value = city.ref || '';
    document.getElementById('npCityName').value = city.name || city.present;

    syncCityNPCombined();

    // Enable Warehouse Input & Pre-fetch Warehouses
    if (warehouseInput) {
        warehouseInput.disabled = false;
        warehouseInput.value = '';
        warehouseInput.placeholder = 'Завантаження відділень...';
    }
    if (warehouseHint) {
        warehouseHint.textContent = `Завантажуємо відділення Нової Пошти у ${city.present}...`;
    }

    await loadCityWarehouses(city);

    if (warehouseInput) {
        warehouseInput.placeholder = 'Введіть номер (напр. 25) або вулицю...';
        warehouseInput.focus();
    }
    if (warehouseHint) {
        warehouseHint.textContent = `Доступно ${npAllWarehouses.length} відділень та поштоматів. Почніть вводити номер або вулицю:`;
    }
    renderFilteredWarehouses('');
}

async function loadCityWarehouses(city) {
    const spinner = document.getElementById('npWarehouseSpinner');
    if (spinner) spinner.style.display = 'block';

    npAllWarehouses = [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    try {
        const payload = {
            apiKey: '',
            modelName: 'AddressGeneral',
            calledMethod: 'getWarehouses',
            methodProperties: {
                SettlementRef: city.ref,
                Limit: '500'
            }
        };

        let res = await fetch(NP_API_ENDPOINT, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let json = await res.json();

        // Fallback by CityName if SettlementRef returns 0
        if ((!json.success || !json.data || !json.data.length) && city.name) {
            payload.methodProperties = { CityName: city.name, Limit: '500' };
            res = await fetch(NP_API_ENDPOINT, {
                method: 'POST',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            json = await res.json();
        }

        clearTimeout(timer);
        if (json.success && Array.isArray(json.data) && json.data.length) {
            npAllWarehouses = json.data.map(w => {
                const isPostomat = (w.CategoryOfWarehouse === 'Postomat') || (w.Description && w.Description.includes('Поштомат'));
                return {
                    number: parseInt(w.Number, 10) || w.Number,
                    numberStr: String(w.Number),
                    desc: w.Description,
                    shortAddress: w.ShortAddress || w.Description,
                    ref: w.Ref,
                    type: isPostomat ? 'Postomat' : 'Branch',
                    maxWeight: w.TotalMaxWeightAllowed ? `до ${w.TotalMaxWeightAllowed} кг` : ''
                };
            });

            // Sort logically: branches first sorted by number, then postomats sorted by number
            npAllWarehouses.sort((a, b) => {
                const numA = typeof a.number === 'number' ? a.number : 999999;
                const numB = typeof b.number === 'number' ? b.number : 999999;
                return numA - numB;
            });
        }
    } catch (err) {
        clearTimeout(timer);
        console.warn('NP Load Warehouses error or timeout:', err);
    } finally {
        clearTimeout(timer);
        if (spinner) spinner.style.display = 'none';
        const warehouseInput = document.getElementById('npWarehouseInput');
        const warehouseHint = document.getElementById('npWarehouseHint');
        if (warehouseInput) {
            warehouseInput.disabled = false;
            warehouseInput.placeholder = 'Введіть номер (напр. 25) або вулицю...';
        }
        if (warehouseHint) {
            if (npAllWarehouses.length > 0) {
                warehouseHint.textContent = `Доступно ${npAllWarehouses.length} відділень та поштоматів. Почніть вводити номер або вулицю:`;
            } else {
                warehouseHint.textContent = 'Вкажіть номер відділення, поштомату або адресу доставки:';
            }
        }
    }
}

function filterWarehouseType(type, btn) {
    npActiveWarehouseType = type;
    document.querySelectorAll('#npWarehouseFilterTabs .np-tab').forEach(t => t.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const warehouseInput = document.getElementById('npWarehouseInput');
    const query = warehouseInput ? warehouseInput.value.trim() : '';
    renderFilteredWarehouses(query);
}

function renderFilteredWarehouses(query) {
    const dropdown = document.getElementById('npWarehouseDropdown');
    if (!dropdown || !npSelectedCity) return;

    const q = query.toLowerCase();
    let filtered = npAllWarehouses;

    // Filter by tab type (all / Branch / Postomat)
    if (npActiveWarehouseType !== 'all') {
        filtered = filtered.filter(w => w.type === npActiveWarehouseType);
    }

    // Filter by query (number or street)
    if (q) {
        filtered = filtered.filter(w => {
            return w.numberStr === q || 
                   w.numberStr.startsWith(q) || 
                   w.desc.toLowerCase().includes(q) || 
                   w.shortAddress.toLowerCase().includes(q);
        });
    }

    if (!filtered.length) {
        dropdown.innerHTML = `
            <div class="np-dropdown-empty">
                Відділень або поштоматів за запитом «${query}» не знайдено.
                <br><small style="color:#94a3b8;">Спробуйте ввести тільки цифри номеру (напр. 12) або скиньте фільтр типу.</small>
            </div>
        `;
        dropdown.style.display = 'block';
        return;
    }

    // Render up to 40 items for performance
    const displayList = filtered.slice(0, 40);
    let html = '';
    displayList.forEach(w => {
        const isPostomat = w.type === 'Postomat';
        const badgeClass = isPostomat ? 'np-badge-postomat' : 'np-badge-branch';
        const badgeText = isPostomat ? 'Поштомат' : (w.maxWeight || 'Відділення');

        html += `
            <div class="np-dropdown-item" onclick="selectNpWarehouse('${encodeURIComponent(JSON.stringify(w))}')">
                <div class="np-item-content">
                    <span class="np-item-main">${w.desc}</span>
                    <span class="np-item-sub">№${w.numberStr} • ${w.shortAddress}</span>
                </div>
                <span class="np-item-badge ${badgeClass}">${badgeText}</span>
            </div>
        `;
    });

    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
}

function selectNpWarehouse(encodedWarehouse) {
    const w = JSON.parse(decodeURIComponent(encodedWarehouse));
    const warehouseInput = document.getElementById('npWarehouseInput');
    const warehouseDropdown = document.getElementById('npWarehouseDropdown');
    const warehouseClearBtn = document.getElementById('npWarehouseClearBtn');

    if (warehouseInput) warehouseInput.value = w.desc;
    if (warehouseDropdown) warehouseDropdown.style.display = 'none';
    if (warehouseClearBtn) warehouseClearBtn.style.display = 'block';

    document.getElementById('npWarehouseRef').value = w.ref || '';
    document.getElementById('npWarehouseNum').value = w.numberStr || '';

    syncCityNPCombined();
}

function resetWarehouseSelection() {
    const warehouseInput = document.getElementById('npWarehouseInput');
    const warehouseClearBtn = document.getElementById('npWarehouseClearBtn');
    const warehouseDropdown = document.getElementById('npWarehouseDropdown');
    const warehouseHint = document.getElementById('npWarehouseHint');

    if (warehouseInput) {
        warehouseInput.value = '';
        warehouseInput.disabled = false;
        warehouseInput.placeholder = 'Введіть або оберіть відділення / поштомат...';
    }
    if (warehouseClearBtn) warehouseClearBtn.style.display = 'none';
    if (warehouseDropdown) warehouseDropdown.style.display = 'none';
    if (warehouseHint) warehouseHint.textContent = 'Почніть вводити номер (напр. 45) або вулицю для швидкого пошуку';

    document.getElementById('npWarehouseRef').value = '';
    document.getElementById('npWarehouseNum').value = '';
    npAllWarehouses = [];
    syncCityNPCombined();
}

function syncCityNPCombined() {
    const cityInputEl = document.getElementById('npCityInput');
    const warehouseInputEl = document.getElementById('npWarehouseInput');
    const cityVal = npSelectedCity ? npSelectedCity.present : (cityInputEl?.value.trim() || '');
    const warehouseVal = warehouseInputEl?.value.trim() || '';
    const cityNPHidden = document.getElementById('cityNP');
    const cityNameHidden = document.getElementById('npCityName');

    if (cityNameHidden && (!cityNameHidden.value || cityNameHidden.value !== cityVal) && cityVal) {
        cityNameHidden.value = cityVal;
    }

    if (cityNPHidden) {
        if (cityVal && warehouseVal) {
            cityNPHidden.value = `${cityVal}, ${warehouseVal}`;
        } else if (cityVal) {
            cityNPHidden.value = cityVal;
        } else {
            cityNPHidden.value = '';
        }
    }
}

// --- Messenger Checkout Logic (Telegram & Viber) ---
const TG_MANAGER_USERNAME = 'lunarecho94';
const VIBER_MANAGER_PHONE = '+380974524435';

function getFormattedOrderForMessenger() {
    const cart = getCart();
    let itemsText = '';
    let totalPrice = 0;
    let totalQty = 0;
    let itemsSummaryList = '';

    if (cart && cart.length > 0) {
        cart.forEach((item, idx) => {
            const lineSum = item.price * (item.qty || 1);
            totalPrice += lineSum;
            totalQty += (item.qty || 1);
            itemsText += `ПОЗИЦІЯ #${idx + 1}:\n`;
            itemsText += `• Назва товару: ${item.title}\n`;
            if (item.art) itemsText += `  Артикул (АРТ): ${item.art}\n`;
            itemsText += `  Розмір: ${item.size}\n`;
            itemsText += `  Кількість: ${item.qty || 1} шт.\n`;
            itemsText += `  Ціна: ${item.price.toLocaleString('uk-UA')} грн (разом: ${lineSum.toLocaleString('uk-UA')} грн)\n`;
            if (item.mat) itemsText += `  Матеріал: ${item.mat}\n`;
            if (item.prodId) itemsText += `  Посилання на сайті: https://urbangrid.com.ua/#prod-${item.prodId}\n`;
            itemsText += `\n`;
            itemsSummaryList += `${item.title}${item.art ? ` (Арт: ${item.art})` : ''} [${item.size}, ${item.qty || 1} шт.]; `;
        });
    } else {
        const productSelect = document.getElementById('productSelect');
        const sizeSelect = document.getElementById('shoeSizeSelect');
        const selectedModel = productSelect ? productSelect.value : 'Кросівки (з каталогу)';
        const selectedSize = sizeSelect ? sizeSelect.value : '38';
        const finalPriceEl = document.getElementById('finalOrderPrice');
        const priceText = finalPriceEl ? finalPriceEl.textContent.trim() : '2 670 грн';
        totalPrice = parseInt(priceText.replace(/\D/g, ''), 10) || 2670;
        totalQty = 1;
        itemsText = `• Назва товару: ${selectedModel}\n  Розмір: ${selectedSize} • 1 шт. • ${priceText}\n\n`;
        itemsSummaryList = `${selectedModel} [${selectedSize}, 1 шт.]`;
    }

    const customerName = (document.getElementById('cartFullName')?.value || document.getElementById('quickFullName')?.value || document.getElementById('fullName')?.value || document.getElementById('customerNameInput')?.value || '').trim();
    const customerPhone = (document.getElementById('cartPhone')?.value || document.getElementById('quickPhone')?.value || document.getElementById('phone')?.value || document.getElementById('customerPhoneInput')?.value || '').trim();
    const city = (document.getElementById('npCityName')?.value || document.getElementById('npCityInput')?.value || '').trim();
    const warehouse = (document.getElementById('npWarehouseInput')?.value || '').trim();
    const noCall = document.getElementById('noCallCheckbox')?.checked;

    let paymentMethod = 'Накладений платіж (при отриманні на пошті)';
    const checkedPay = document.querySelector('input[name="cartPayment"]:checked, input[name="Оплата"]:checked, input[name="Спосіб оплати"]:checked');
    if (checkedPay && (checkedPay.value.includes('Передплата') || checkedPay.value.includes('IBAN') || checkedPay.value.includes('карт'))) {
        paymentMethod = 'Оплата на карту';
    }

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `UG-${randomNum}`;

    let msg = `ЗАМОВЛЕННЯ З САЙТУ URBAN\n№ #${orderId}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `ДЕТАЛІ ЗАМОВЛЕННЯ (${totalQty} шт.):\n\n${itemsText}`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `РАЗОМ ДО СПЛАТИ: ${totalPrice.toLocaleString('uk-UA')} грн\n`;
    msg += `Оплата: ${paymentMethod}\n`;
    msg += `Доставка: Нова Пошта\n`;
    if (city && warehouse) {
        msg += `  ${city}, ${warehouse}\n`;
    } else if (city) {
        msg += `  ${city} (відділення узгодимо в чаті)\n`;
    } else {
        msg += `  (місто та відділення узгодимо в чаті)\n`;
    }
    msg += `Одержувач: ${customerName || '(узгодимо в чаті)'}\n`;
    msg += `Телефон: ${customerPhone || '(узгодимо в чаті)'}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (noCall) {
        msg += `Прошу підтвердити замовлення текстовим повідомленням без дзвінка. Дякую!`;
    } else {
        msg += `Прошу надіслати підтвердження та номер ТТН сюди в чат. Дякую!`;
    }

    return {
        orderId,
        totalPrice,
        text: msg,
        customerName,
        customerPhone,
        city,
        warehouse,
        itemsSummaryList
    };
}

async function copyTextToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {}
    }
    try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        return false;
    }
}

async function checkoutViaMessenger(messenger) {
    const cart = getCart();
    if (!cart || cart.length === 0) {
        showCartToast('Кошик порожній! Оберіть товар у каталозі.');
        return;
    }
    const order = getFormattedOrderForMessenger();
    await copyTextToClipboard(order.text);

    // Meta Pixel Contact Tracking
    safeTrackFbq('Contact', {
        content_name: messenger === 'telegram' ? 'Telegram' : 'Viber',
        value: order.totalPrice || 0,
        currency: 'UAH'
    });

    // Track lead and record in order dispatch ledger
    try {
        if (order.customerPhone) {
            const messengerName = messenger === 'telegram' ? 'Telegram' : 'Viber';
            sendOrderDispatch({
                orderId: order.orderId,
                orderDate: new Date().toLocaleString('uk-UA'),
                customerName: order.customerName || 'Клієнт (месенджер)',
                customerPhone: order.customerPhone || 'Вказати в чаті',
                delivery: `${order.city || ''} ${order.warehouse || ''}`.trim() || 'Узгодити в месенджері',
                payment: `Оформлення через ${messengerName}`,
                itemsText: order.text || '',
                quickTtn: `${order.customerName || 'Клієнт'} — ${order.customerPhone || ''}`,
                total: `${order.totalPrice.toLocaleString('uk-UA')} грн`,
                subject: `Запит у ${messengerName} #${order.orderId} | ${order.totalPrice.toLocaleString('uk-UA')} грн | ${order.customerName || 'Клієнт'}`,
                contactPreference: `Перехід клієнта у ${messengerName}`,
                pdfResult: null
            }).catch(() => {});
        }
    } catch (e) {}

    showCartToast(
        messenger === 'telegram' 
            ? 'Текст замовлення скопійовано! Відкриваємо чат у Telegram...' 
            : 'Текст замовлення скопійовано! Відкриваємо чат у Viber...'
    );

    if (messenger === 'telegram') {
        const tgUrl = `https://t.me/${TG_MANAGER_USERNAME}?text=${encodeURIComponent(order.text)}`;
        const win = window.open(tgUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = tgUrl;
        }
    } else if (messenger === 'viber') {
        const cleanPhone = VIBER_MANAGER_PHONE.replace(/\D/g, '');
        const viberUrl = `viber://chat?number=%2B${cleanPhone}`;
        window.location.href = viberUrl;
    }
}

function confirmOrderInMessenger(messenger) {
    let orderNum = '#UG-00000';
    try {
        const stored = sessionStorage.getItem('ug_last_order');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed.orderId) orderNum = `#${parsed.orderId}`;
        }
    } catch (e) {}

    const text = `Вітаю! Я оформив(ла) замовлення ${orderNum} на сайті URBAN. Підтверджую відправку Новою Поштою. Прошу надіслати ТТН сюди в чат!`;
    copyTextToClipboard(text);

    if (messenger === 'telegram') {
        const tgUrl = `https://t.me/${TG_MANAGER_USERNAME}?text=${encodeURIComponent(text)}`;
        const win = window.open(tgUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = tgUrl;
        }
    } else {
        const cleanPhone = VIBER_MANAGER_PHONE.replace(/\D/g, '');
        window.location.href = `viber://chat?number=%2B${cleanPhone}`;
    }
}

// Global window exposure for inline onclick handlers
window.selectNpCity = selectNpCity;
window.selectNpWarehouse = selectNpWarehouse;
window.filterWarehouseType = filterWarehouseType;
window.checkoutViaMessenger = checkoutViaMessenger;
window.confirmOrderInMessenger = confirmOrderInMessenger;
window.openFavoritesDrawer = openFavoritesDrawer;
window.closeFavoritesDrawer = closeFavoritesDrawer;
window.toggleFavoritesDrawer = toggleFavoritesDrawer;
window.toggleFavorite = toggleFavorite;
window.toggleCurrentPhotoFavorite = toggleCurrentPhotoFavorite;
window.addFavoriteItemToCart = addFavoriteItemToCart;
window.addAllFavoritesToCart = addAllFavoritesToCart;
window.clearFavorites = clearFavorites;
window.toggleFavoritesFilter = toggleFavoritesFilter;
window.viewFavoritesInCatalog = viewFavoritesInCatalog;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    checkOrderSuccess();
    renderCart();
    updateFavoritesUI();
    initSwipeGalleries();
    initScrollTop();
    initDynamicCatalog();
    initNovaPoshtaAutocomplete();
    initPhotoViewerInteractions();

    if (document.getElementById('productDetailPage')) {
        initProductDetailPage();
    }


    // Handle Form Submit with PDF Generation
    const form = document.getElementById('checkoutForm');
    if (form) {
        form.addEventListener('submit', handleCheckoutFormSubmit);
    }

    // Check if manager opened ?orders or ?admin in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('orders') || urlParams.has('admin')) {
        setTimeout(showManagerOrdersModal, 300);
    }
});


// ==========================================================================
// STRICT UKRAINIAN PHONE NUMBER VALIDATION & FORMATTING
// ==========================================================================

const VALID_UA_OPERATOR_CODES = new Set([
    '050', '066', '095', '099', '075', // Vodafone
    '067', '068', '096', '097', '098', '077', // Kyivstar
    '063', '073', '093', // lifecell
    '091', '092', '094', '089', '039'  // 3Mob, PeopleNet, Intertelecom, etc.
]);

function validateUkrainianPhone(phoneStr) {
    if (!phoneStr || typeof phoneStr !== 'string') {
        return { valid: false, message: "Введіть номер телефону" };
    }

    const digits = phoneStr.replace(/\D/g, '');
    let nationalNumber = '';

    if (digits.startsWith('380') && digits.length === 12) {
        nationalNumber = digits.slice(2); // e.g. 0671234567
    } else if (digits.startsWith('80') && digits.length === 11) {
        nationalNumber = '0' + digits.slice(2);
    } else if (digits.startsWith('0') && digits.length === 10) {
        nationalNumber = digits;
    } else if (digits.length === 9) {
        // Customer entered 9 digits without leading 0 (e.g. 97 452 44 35)
        nationalNumber = '0' + digits;
    } else {
        return { 
            valid: false, 
            message: "Номер має містити 10 цифр українського оператора (+38 0XX XXX-XX-XX)" 
        };
    }

    const opCode = nationalNumber.slice(0, 3);
    if (!VALID_UA_OPERATOR_CODES.has(opCode)) {
        return { 
            valid: false, 
            message: `Код оператора (${opCode}) не дійсний в Україні. Перевірте номер.` 
        };
    }

    const subscriber = nationalNumber.slice(3);
    if (/^(\d)\1{6}$/.test(subscriber)) {
        return { 
            valid: false, 
            message: "Вкажіть реальний контактний номер телефону." 
        };
    }

    const formatted = `+38 (${opCode}) ${subscriber.slice(0, 3)}-${subscriber.slice(3, 5)}-${subscriber.slice(5, 7)}`;
    return { valid: true, nationalNumber, formatted };
}

function formatPhoneInput(e) {
    const input = e.target;
    let val = input.value.replace(/\D/g, '');

    // Normalize country/area code prefixes
    if (val.startsWith('380')) val = val.slice(2);
    else if (val.startsWith('38')) val = val.slice(2);
    else if (val.startsWith('3') && val.length > 1) val = val.slice(1);
    else if (val.startsWith('80') && val.length > 2) val = '0' + val.slice(2);

    // If user starts typing without leading 0 (e.g. 97...), auto-prepend 0
    if (val.length > 0 && !val.startsWith('0') && val !== '3') {
        val = '0' + val;
    }

    if (val.length > 10) val = val.slice(0, 10);

    if (!val || val === '3') {
        input.value = '';
        return;
    }

    let res = '+38 (';
    if (val.length <= 3) {
        res += val;
    } else if (val.length <= 6) {
        res += val.slice(0, 3) + ') ' + val.slice(3);
    } else if (val.length <= 8) {
        res += val.slice(0, 3) + ') ' + val.slice(3, 6) + '-' + val.slice(6);
    } else {
        res += val.slice(0, 3) + ') ' + val.slice(3, 6) + '-' + val.slice(6, 8) + '-' + val.slice(8, 10);
    }
    input.value = res;

    // Reset error state on active typing
    input.classList.remove('input-error');
    const errHint = input.parentElement ? input.parentElement.querySelector('.phone-error-hint') : null;
    if (errHint) {
        errHint.style.display = 'none';
        errHint.textContent = '';
    }
}


// ==========================================================================
// SIZE CHART MODAL HANDLERS
// ==========================================================================

function openSizeChartModal(category = 'shoes') {
    const modal = document.getElementById('sizeChartModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        const isClothing = (category === 'clothing' || category === 'underwear' || category === 'socks');
        switchSizeChartTab(isClothing ? 'clothing' : 'shoes');
    }
}

function switchSizeChartTab(tab) {
    const tabShoes = document.getElementById('sizeTabShoes');
    const tabClothing = document.getElementById('sizeTabClothing');
    const paneShoes = document.getElementById('sizePaneShoes');
    const paneClothing = document.getElementById('sizePaneClothing');
    const modalTitle = document.getElementById('sizeChartTitle');

    if (tab === 'clothing') {
        if (tabShoes) tabShoes.classList.remove('active');
        if (tabClothing) tabClothing.classList.add('active');
        if (paneShoes) paneShoes.style.display = 'none';
        if (paneClothing) paneClothing.style.display = 'block';
        if (modalTitle) modalTitle.textContent = 'Таблиця розмірів одягу та білизни';
    } else {
        if (tabShoes) tabShoes.classList.add('active');
        if (tabClothing) tabClothing.classList.remove('active');
        if (paneShoes) paneShoes.style.display = 'block';
        if (paneClothing) paneClothing.style.display = 'none';
        if (modalTitle) modalTitle.textContent = 'Таблиця розмірів взуття';
    }
}

function closeSizeChartModal() {
    const modal = document.getElementById('sizeChartModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ==========================================================================
// FAST 1-CLICK ORDER FORM SUBMISSION
// ==========================================================================

function clearQuickOrderModel() {
    const chosenInput = document.getElementById('quickOrderChosenModel');
    if (chosenInput) chosenInput.value = 'Уточнити по телефону';
    const banner = document.getElementById('quickOrderModelBanner');
    if (banner) banner.style.display = 'none';
}

async function handleQuickOrderSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nameInput = document.getElementById('quickFullName');
    const phoneInput = document.getElementById('quickPhone');
    const errHint = document.getElementById('quickPhoneError');
    const submitBtn = document.getElementById('submitQuickOrderBtn');

    if (!nameInput || !phoneInput) return;

    const nameVal = nameInput.value.trim();
    const phoneVal = phoneInput.value.trim();

    // Strict Ukrainian Phone Validation
    const phoneCheck = validateUkrainianPhone(phoneVal);
    if (!phoneCheck.valid) {
        phoneInput.classList.add('input-error');
        if (errHint) {
            errHint.textContent = phoneCheck.message;
            errHint.style.display = 'block';
        }
        phoneInput.focus();
        return;
    }

    phoneInput.classList.remove('input-error');
    if (errHint) errHint.style.display = 'none';

    const chosenModel = (document.getElementById('quickOrderChosenModel')?.value || '').trim();
    const cart = getCart();

    let orderItemsDesc = chosenModel;
    if (!orderItemsDesc || orderItemsDesc === 'Уточнити по телефону') {
        if (cart && cart.length > 0) {
            orderItemsDesc = cart.map((i, idx) => `${idx + 1}. ${i.title}${i.art ? ` (Артикул: ${i.art})` : ''} — Розмір: ${i.size} — ${i.price.toLocaleString('uk-UA')} грн`).join('\n');
        } else {
            orderItemsDesc = 'Уточнити по телефону (клієнт не обрав конкретну пару з каталогу)';
        }
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Оформлення замовлення...';
    }

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `UG-Q${randomNum}`;
    const now = new Date();
    const formattedDate = now.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
        ', ' + now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    const firstItemShort = orderItemsDesc.split('\n')[0].slice(0, 60);
    const subject = `ШВИДКЕ ЗАМОВЛЕННЯ В 1 КЛІК #${orderId} | ${phoneCheck.formatted} | ${nameVal} | ${firstItemShort}`;

    const quickItems = chosenModel || orderItemsDesc;
    const quickOrderData = {
        orderId: orderId,
        orderDate: formattedDate,
        customerName: nameVal,
        customerPhone: phoneCheck.formatted,
        customerAddress: 'Уточнити по телефону (менеджер зателефонує)',
        paymentMethod: 'Узгодити з менеджером',
        itemsSummary: quickItems,
        subtotalFormatted: 'Згідно з обраною парою'
    };

    await sendOrderDispatch({
        orderId,
        orderDate: formattedDate,
        customerName: nameVal,
        customerPhone: phoneCheck.formatted,
        delivery: 'Уточнити по телефону (Нова Пошта)',
        payment: 'Узгодити з менеджером (Накладений платіж / передплата)',
        itemsText: quickItems,
        quickTtn: `${nameVal} — ${phoneCheck.formatted} — ${quickItems}`,
        total: 'Швидке замовлення в 1 клік',
        subject: subject,
        contactPreference: 'Очікує швидкого дзвінка менеджера (1 клік)',
        pdfResult: null
    });

    safeTrackFbq('Lead', {
        content_name: chosenModel || 'Замовлення в 1 клік',
        currency: 'UAH'
    });

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Замовити в 1 клік';
    }
    nameInput.value = '';
    phoneInput.value = '';
    clearQuickOrderModel();

    try {
        sessionStorage.setItem('ug_last_order', JSON.stringify(quickOrderData));
    } catch (e) {}

    const quickPriceNum = parseInt((quickOrderData.subtotalFormatted || '2500').replace(/\D/g, ''), 10) || 2500;
    window.location.href = `thank-you.html?orderId=${encodeURIComponent(orderId)}&total=${encodeURIComponent(quickPriceNum)}`;
}

// ==========================================================================
// CART DRAWER DIRECT CHECKOUT HANDLERS
// ==========================================================================

function showCartCheckoutForm() {
    const cart = getCart();
    if (!cart || cart.length === 0) {
        showCartToast('Кошик порожній! Оберіть хоча б одну пару кросівок.');
        return;
    }
    const formBox = document.getElementById('cartCheckoutFormBox');
    const openBtn = document.getElementById('btnOpenCartCheckout');
    if (formBox) formBox.style.display = 'block';
    if (openBtn) openBtn.style.display = 'none';

    // Meta Pixel & GA4 Checkout Tracking
    const checkoutTotal = cart.reduce((sum, it) => sum + (it.price * (it.qty || 1)), 0);
    safeTrackFbq('InitiateCheckout', {
        num_items: cart.length,
        value: checkoutTotal,
        currency: 'UAH',
        content_type: 'product'
    });

    // Auto-scroll inside drawer
    const drawerBody = document.getElementById('cartDrawer');
    if (drawerBody) {
        setTimeout(() => {
            formBox?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }
}

function hideCartCheckoutForm() {
    const formBox = document.getElementById('cartCheckoutFormBox');
    const openBtn = document.getElementById('btnOpenCartCheckout');
    if (formBox) formBox.style.display = 'none';
    if (openBtn) openBtn.style.display = 'block';
}

async function handleCartDirectCheckout(e) {
    if (e && e.preventDefault) e.preventDefault();

    const nameInput = document.getElementById('cartFullName');
    const phoneInput = document.getElementById('cartPhone');
    const cityInput = document.getElementById('npCityInput') || document.getElementById('cartCityInput');
    const whInput = document.getElementById('npWarehouseInput') || document.getElementById('cartWarehouseInput');
    const errHint = document.getElementById('cartPhoneError');
    const submitBtn = document.getElementById('cartSubmitOrderBtn');

    if (!nameInput || !phoneInput) return;

    const phoneVal = phoneInput.value.trim();
    const phoneCheck = validateUkrainianPhone(phoneVal);
    if (!phoneCheck.valid) {
        phoneInput.classList.add('input-error');
        if (errHint) {
            errHint.textContent = phoneCheck.message;
            errHint.style.display = 'block';
        }
        phoneInput.focus();
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ';
        }
        return;
    }
    phoneInput.classList.remove('input-error');
    if (errHint) errHint.style.display = 'none';

    // Validate Nova Poshta City Selection
    const cityVal = (document.getElementById('npCityName')?.value || cityInput?.value || '').trim();
    if (!cityVal || cityVal.length < 2) {
        cityInput?.classList.add('input-error');
        cityInput?.focus();
        showCartToast('Будь ласка, вкажіть місто доставки');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ';
        }
        return;
    }
    cityInput?.classList.remove('input-error');

    // Validate Nova Poshta Warehouse / Postomat Selection
    const whVal = (whInput?.value || '').trim();
    if (!whVal) {
        whInput?.classList.add('input-error');
        whInput?.focus();
        showCartToast('Будь ласка, вкажіть відділення або поштомат Нової Пошти');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ';
        }
        return;
    }
    whInput?.classList.remove('input-error');

    const cart = getCart();
    if (!cart || cart.length === 0) {
        showCartToast('Кошик порожній!');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ';
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Оформлення замовлення...';
    }

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `UG-${randomNum}`;
    const now = new Date();
    const formattedDate = now.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' }) + 
        ', ' + now.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

    let orderTotalNum = 0;
    let orderItemsText = '';
    let itemsSummaryList = '';
    let totalQty = 0;

    cart.forEach((item, idx) => {
        const lineSum = item.price * (item.qty || 1);
        orderTotalNum += lineSum;
        totalQty += (item.qty || 1);
        const artText = item.art ? ` (Арт: ${item.art})` : '';
        const qtyText = (item.qty || 1) > 1 ? ` | ${item.qty || 1} шт. × ${item.price.toLocaleString('uk-UA')} грн` : '';
        const detailsArr = [];
        if (item.mat) detailsArr.push(`Матеріал: ${item.mat}`);
        const detailsLine = detailsArr.length > 0 ? `• ${detailsArr.join(' | ')}\n` : '';
        const linkLine = item.prodId ? `• https://urbangrid.com.ua/#prod-${item.prodId}\n` : '';

        orderItemsText += `№${idx + 1}. ${item.title}${artText}\n` +
                          `• Розмір: ${item.size} | Сума: ${lineSum.toLocaleString('uk-UA')} грн${qtyText}\n` +
                          detailsLine +
                          linkLine +
                          `\n`;

        itemsSummaryList += `${item.title}${artText} [${item.size}, ${item.qty || 1} шт. — ${lineSum.toLocaleString('uk-UA')} грн]; `;
    });

    orderItemsText += `─────────────────────────────\nВсього: ${totalQty} шт. на суму ${orderTotalNum.toLocaleString('uk-UA')} грн`;

    const formattedTotal = `${orderTotalNum.toLocaleString('uk-UA')} грн`;
    const customerName = nameInput.value.trim();
    const fullDelivery = (document.getElementById('cityNP')?.value || '').trim() || (whVal ? `${cityVal}, ${whVal}` : cityVal);
    
    const payRadio = document.querySelector('input[name="cartPayment"]:checked');
    const paymentMethod = payRadio ? payRadio.value : 'Накладений платіж';

    const firstTitle = cart[0].title.split(' (')[0].replace(/^[🔥👟🛡🏀⚡✨🌸🖤💖❄️⚪🍫💙🏃‍♀️🐊🍷🛹\s]+/u, '').trim();
    const firstArt = cart[0].art ? ` (Арт: ${cart[0].art})` : '';
    const subject = `Замовлення з кошика #${orderId} | ${formattedTotal} | ${customerName} | ${totalQty} тов. (${firstTitle}${firstArt}${totalQty > 1 ? ' та ін.' : ''})`;

    const quickTtnBlock = 
`ПІБ: ${customerName}
Тел: ${phoneCheck.formatted}
Доставка: ${fullDelivery}
Товари: ${itemsSummaryList}
Оплата: ${paymentMethod} — ${formattedTotal}`;

    const orderSummaryData = {
        orderId: orderId,
        orderDate: formattedDate,
        customerName: customerName,
        customerPhone: phoneCheck.formatted,
        customerAddress: fullDelivery,
        paymentMethod: paymentMethod,
        itemsSummary: itemsSummaryList,
        subtotalFormatted: formattedTotal
    };

    try {
        sessionStorage.setItem('ug_last_order', JSON.stringify(orderSummaryData));
    } catch (e) {}

    // Generate PDF silently in background with strict 1.5s timeout
    let pdfResult = null;
    try {
        pdfResult = await generateOrderPdf(orderId, formattedDate);
    } catch (pdfErr) {
        console.warn('PDF generation in cart checkout:', pdfErr);
    }

    await sendOrderDispatch({
        orderId,
        orderDate: formattedDate,
        customerName,
        customerPhone: phoneCheck.formatted,
        delivery: fullDelivery,
        payment: paymentMethod,
        itemsText: orderItemsText,
        quickTtn: quickTtnBlock,
        total: formattedTotal,
        subject,
        contactPreference: 'Оформлення через кошик',
        pdfResult
    });

    clearCart();
    closeCart();
    hideCartCheckoutForm();
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ';
    }

    try {
        sessionStorage.setItem('ug_last_order', JSON.stringify(orderSummaryData));
    } catch (e) {}

    // Redirect to welcome / thank-you page (Pixel Purchase triggers strictly there)
    window.location.href = `thank-you.html?orderId=${encodeURIComponent(orderId)}&total=${encodeURIComponent(orderTotalNum)}`;
}

// Global window exposure
window.selectCatalogGender = selectCatalogGender;
window.selectCatalogCategory = selectCatalogCategory;
window.selectCatalogSeason = selectCatalogSeason;
window.filterCatalogBySize = filterCatalogBySize;
window.filterCatalogByPrice = filterCatalogByPrice;
window.loadMoreProducts = loadMoreProducts;
window.handleCatalogSort = handleCatalogSort;
window.updateSortDisplayLabel = updateSortDisplayLabel;
window.openSizeChartModal = openSizeChartModal;
window.switchSizeChartTab = switchSizeChartTab;
window.closeSizeChartModal = closeSizeChartModal;
window.handleQuickOrderSubmit = handleQuickOrderSubmit;
window.clearQuickOrderModel = clearQuickOrderModel;
window.formatPhoneInput = formatPhoneInput;
window.showCartCheckoutForm = showCartCheckoutForm;
window.hideCartCheckoutForm = hideCartCheckoutForm;
window.handleCartDirectCheckout = handleCartDirectCheckout;
window.openBrandModal = openBrandModal;
window.closeBrandModal = closeBrandModal;
window.handleBrandOverlayClick = handleBrandOverlayClick;
window.selectBrandFromModal = selectBrandFromModal;
window.clearBrandSelection = clearBrandSelection;
window.handleBrandModalSearch = handleBrandModalSearch;
window.clearBrandModalSearch = clearBrandModalSearch;
window.openSizeModal = openSizeModal;
window.closeSizeModal = closeSizeModal;
window.handleSizeOverlayClick = handleSizeOverlayClick;
window.switchSizeModalCategory = switchSizeModalCategory;
window.selectSizeFromModal = selectSizeFromModal;
window.clearSizeSelection = clearSizeSelection;
window.updateSizeButtonState = updateSizeButtonState;
window.openQuickChoiceModal = openQuickChoiceModal;
window.closeQuickChoiceModal = closeQuickChoiceModal;
window.handleQuickChoiceOverlayClick = handleQuickChoiceOverlayClick;
window.selectQuickChoice = selectQuickChoice;
window.clearQuickChoiceSelection = clearQuickChoiceSelection;
window.showOrderSuccessModal = showOrderSuccessModal;
window.closeOrderSuccessModal = closeOrderSuccessModal;
window.openCart = openCart;
window.closeCart = closeCart;
window.toggleCart = toggleCart;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQty = updateCartQty;
window.clearCart = clearCart;
window.showCartToast = showCartToast;
window.switchGalleryImg = switchGalleryImg;
window.switchCardImg = switchCardImg;
window.selectSize = selectSize;
window.handleCardImgError = handleCardImgError;
window.handleCardThumbError = handleCardThumbError;
window.handlePhotoModalImgError = handlePhotoModalImgError;
window.downloadLastGeneratedPdf = downloadLastGeneratedPdf;
window.scrollToTopAnimated = scrollToTopAnimated;
window.photoViewerNext = photoViewerNext;
window.photoViewerPrev = photoViewerPrev;
window.photoViewerZoomIn = photoViewerZoomIn;
window.photoViewerZoomOut = photoViewerZoomOut;
window.photoViewerResetZoom = photoViewerResetZoom;
window.photoModalBuyAction = photoModalBuyAction;
window.switchPhotoModalImage = switchPhotoModalImage;

// ==============================================================================
// FULL-SCREEN HIGH-DEFINITION PHOTO DETAIL VIEWER CONTROLLER
// ==============================================================================
let currentPhotoItem = null;
let currentPhotoIndex = 0;
let photoZoomScale = 1.0;
let photoPanX = 0;
let photoPanY = 0;
let isPhotoDragging = false;
let photoDragStartX = 0;
let photoDragStartY = 0;
let photoPinchStartDistance = 0;
let photoPinchStartScale = 1.0;
let lastPhotoTapTime = 0;

function openPhotoModal(productId, photoIdx) {
    if (!productId) return;
    openProductPage(productId);
}

function closePhotoModal() {
    const modal = document.getElementById('photoDetailModal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function resetPhotoZoomAndPan() {
    photoZoomScale = 1.0;
    photoPanX = 0;
    photoPanY = 0;
    applyPhotoTransform(false);
    updatePhotoZoomControls();
}

function applyPhotoTransform(animate = true) {
    const mainImg = document.getElementById('photoModalMainImg');
    const canvas = document.getElementById('photoImgCanvas');
    if (!mainImg) return;

    if (animate) {
        mainImg.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)';
    } else {
        mainImg.style.transition = 'none';
    }

    mainImg.style.transform = `translate3d(${photoPanX}px, ${photoPanY}px, 0) scale(${photoZoomScale})`;

    if (canvas) {
        if (photoZoomScale > 1.05) {
            canvas.classList.add('zoomed');
        } else {
            canvas.classList.remove('zoomed');
            canvas.classList.remove('panning');
        }
    }
}

function updatePhotoZoomControls() {
    const zoomLevelEl = document.getElementById('photoZoomLevel');
    if (zoomLevelEl) {
        zoomLevelEl.textContent = `${Math.round(photoZoomScale * 100)}%`;
    }
}

function renderPhotoModalContent() {
    if (!currentPhotoItem) return;

    const item = currentPhotoItem;
    const imgs = (item.imgs && item.imgs.length > 0) ? item.imgs : ['images/sneakers.webp'];
    const totalImgs = imgs.length;
    const currentImgUrl = imgs[currentPhotoIndex] || imgs[0];
    const displayName = formatProductDisplayName(item);

    // Update Header
    const artEl = document.getElementById('photoModalArt');
    if (artEl) artEl.textContent = `АРТ: ${item.art || '---'}`;

    const titleEl = document.getElementById('photoModalTitle');
    if (titleEl) titleEl.textContent = displayName;

    const priceEl = document.getElementById('photoModalPrice');
    if (priceEl) priceEl.textContent = `${item.price.toLocaleString('uk-UA')} грн`;

    const counterEl = document.getElementById('photoModalCounter');
    if (counterEl) counterEl.textContent = `${currentPhotoIndex + 1} / ${totalImgs}`;

    const photoFavBtn = document.getElementById('btnPhotoFav');
    if (photoFavBtn) {
        const isFav = isFavorite(item.id);
        photoFavBtn.classList.toggle('active', isFav);
        photoFavBtn.setAttribute('title', isFav ? 'Видалити з обраного' : 'Додати в обране');
        const svg = photoFavBtn.querySelector('svg');
        if (svg) {
            svg.setAttribute('fill', isFav ? '#ef4444' : 'none');
            svg.setAttribute('stroke', isFav ? '#ef4444' : 'currentColor');
        }
    }

    // Update Main Image
    const mainImg = document.getElementById('photoModalMainImg');
    const canvas = document.getElementById('photoImgCanvas');
    if (mainImg) {
        mainImg.setAttribute('referrerpolicy', 'no-referrer');
        mainImg.dataset.srcOrig = currentImgUrl;
        mainImg.dataset.retried = '0';
        mainImg.onload = function() {
            if (canvas) canvas.classList.remove('loading');
        };
        mainImg.onerror = function() {
            if (canvas) canvas.classList.remove('loading');
            handlePhotoModalImgError(this, item.cat);
        };
        if (canvas) canvas.classList.add('loading');
        mainImg.src = currentImgUrl;
        mainImg.alt = `${displayName} — фото ${currentPhotoIndex + 1}`;
    }

    // Prev / Next buttons
    const prevBtn = document.getElementById('btnPhotoPrev');
    const nextBtn = document.getElementById('btnPhotoNext');
    if (prevBtn && nextBtn) {
        if (totalImgs <= 1) {
            prevBtn.style.display = 'none';
            nextBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'flex';
            nextBtn.style.display = 'flex';
        }
    }

    // Render Thumbnails
    const thumbsContainer = document.getElementById('photoModalThumbs');
    if (thumbsContainer) {
        if (totalImgs > 1) {
            thumbsContainer.style.display = 'flex';
            thumbsContainer.innerHTML = imgs.map((img, idx) => `
                <img src="${img}" alt="${escapeHtml(displayName)} ${idx + 1}" class="photo-modal-thumb-img ${idx === currentPhotoIndex ? 'active' : ''}" onclick="switchPhotoModalImage(${idx})" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="handleCardThumbError(this, '${item.cat}')">
            `).join('');

            const activeThumb = thumbsContainer.querySelector('.photo-modal-thumb-img.active');
            if (activeThumb) {
                const offset = activeThumb.offsetLeft - (thumbsContainer.clientWidth / 2) + (activeThumb.clientWidth / 2);
                thumbsContainer.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
            }
        } else {
            thumbsContainer.style.display = 'none';
            thumbsContainer.innerHTML = '';
        }
    }

    updatePhotoZoomControls();
}

function switchPhotoModalImage(idx) {
    if (!currentPhotoItem) return;
    const imgs = currentPhotoItem.imgs || [];
    if (idx < 0 || idx >= imgs.length) return;

    currentPhotoIndex = idx;
    resetPhotoZoomAndPan();
    renderPhotoModalContent();

    // Sync card image in catalog
    const cardImg = document.getElementById(`cardImg-${currentPhotoItem.id}`);
    if (cardImg && imgs[idx]) {
        cardImg.src = imgs[idx];
        cardImg.dataset.currentIndex = idx;
    }
    const card = document.getElementById(`prod-${currentPhotoItem.id}`);
    if (card) {
        const thumbs = card.querySelectorAll('.card-thumb-img');
        if (thumbs[idx]) {
            thumbs.forEach(t => t.classList.remove('active'));
            thumbs[idx].classList.add('active');
        }
    }
}

function photoViewerNext() {
    if (!currentPhotoItem) return;
    const imgs = currentPhotoItem.imgs || [];
    if (imgs.length <= 1) return;
    const nextIdx = (currentPhotoIndex + 1) % imgs.length;
    switchPhotoModalImage(nextIdx);
}

function photoViewerPrev() {
    if (!currentPhotoItem) return;
    const imgs = currentPhotoItem.imgs || [];
    if (imgs.length <= 1) return;
    const prevIdx = (currentPhotoIndex - 1 + imgs.length) % imgs.length;
    switchPhotoModalImage(prevIdx);
}

function photoViewerZoomIn() {
    photoZoomScale = Math.min(3.5, Math.round((photoZoomScale + 0.5) * 10) / 10);
    applyPhotoTransform(true);
    updatePhotoZoomControls();
}

function photoViewerZoomOut() {
    photoZoomScale = Math.max(1.0, Math.round((photoZoomScale - 0.5) * 10) / 10);
    if (photoZoomScale <= 1.05) {
        photoZoomScale = 1.0;
        photoPanX = 0;
        photoPanY = 0;
    }
    applyPhotoTransform(true);
    updatePhotoZoomControls();
}

function photoViewerResetZoom() {
    if (photoZoomScale > 1.05) {
        resetPhotoZoomAndPan();
    } else {
        photoZoomScale = 2.0;
        photoPanX = 0;
        photoPanY = 0;
        applyPhotoTransform(true);
        updatePhotoZoomControls();
    }
}

function photoModalBuyAction() {
    if (!currentPhotoItem) return;
    const item = currentPhotoItem;
    const displayName = formatProductDisplayName(item);
    const formattedPrice = item.price.toLocaleString('uk-UA') + ' грн';

    closePhotoModal();

    setTimeout(() => {
        const card = document.getElementById(`prod-${item.id}`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.transition = 'box-shadow 0.4s ease, transform 0.4s ease';
            card.style.transform = 'scale(1.02)';
            card.style.boxShadow = '0 0 0 3px #7c3aed, 0 16px 36px rgba(124, 58, 237, 0.3)';
            setTimeout(() => {
                card.style.transform = '';
                card.style.boxShadow = '';
            }, 1800);
        }
        selectModelInForm(`${displayName} (${item.price} грн)`, formattedPrice, null, String(item.id));
    }, 280);
}

function initPhotoViewerInteractions() {
    const viewport = document.getElementById('photoViewport');
    const mainImg = document.getElementById('photoModalMainImg');
    const canvas = document.getElementById('photoImgCanvas');
    if (!viewport || !mainImg || !canvas) return;

    // Double Click on image toggles zoom
    mainImg.addEventListener('dblclick', (e) => {
        e.preventDefault();
        if (photoZoomScale > 1.05) {
            resetPhotoZoomAndPan();
        } else {
            const rect = mainImg.getBoundingClientRect();
            const clickX = e.clientX - rect.left - rect.width / 2;
            const clickY = e.clientY - rect.top - rect.height / 2;
            photoZoomScale = 2.2;
            photoPanX = -clickX * 1.2;
            photoPanY = -clickY * 1.2;
            applyPhotoTransform(true);
            updatePhotoZoomControls();
        }
    });

    // Mouse Wheel Zoom
    viewport.addEventListener('wheel', (e) => {
        const modal = document.getElementById('photoDetailModal');
        if (!modal || !modal.classList.contains('active')) return;
        e.preventDefault();
        if (e.deltaY < 0) {
            photoZoomScale = Math.min(3.5, Math.round((photoZoomScale + 0.25) * 100) / 100);
        } else {
            photoZoomScale = Math.max(1.0, Math.round((photoZoomScale - 0.25) * 100) / 100);
            if (photoZoomScale <= 1.05) {
                photoZoomScale = 1.0;
                photoPanX = 0;
                photoPanY = 0;
            }
        }
        applyPhotoTransform(false);
        updatePhotoZoomControls();
    }, { passive: false });

    // Desktop Mouse Drag / Pan
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (photoZoomScale > 1.05) {
            isPhotoDragging = true;
            photoDragStartX = e.clientX - photoPanX;
            photoDragStartY = e.clientY - photoPanY;
            canvas.classList.add('panning');
            e.preventDefault();
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!isPhotoDragging) return;
        photoPanX = e.clientX - photoDragStartX;
        photoPanY = e.clientY - photoDragStartY;
        applyPhotoTransform(false);
    });

    window.addEventListener('mouseup', () => {
        if (isPhotoDragging) {
            isPhotoDragging = false;
            if (canvas) canvas.classList.remove('panning');
        }
    });

    // Mobile Touch: Pinch to zoom, double tap, pan and swipe
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    viewport.addEventListener('touchstart', (e) => {
        const modal = document.getElementById('photoDetailModal');
        if (!modal || !modal.classList.contains('active')) return;

        if (e.touches.length === 2) {
            isPhotoDragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            photoPinchStartDistance = Math.hypot(dx, dy);
            photoPinchStartScale = photoZoomScale;
        } else if (e.touches.length === 1) {
            const now = Date.now();
            if (now - lastPhotoTapTime < 300) {
                e.preventDefault();
                photoViewerResetZoom();
                lastPhotoTapTime = 0;
                return;
            }
            lastPhotoTapTime = now;

            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = now;

            if (photoZoomScale > 1.05) {
                isPhotoDragging = true;
                photoDragStartX = e.touches[0].clientX - photoPanX;
                photoDragStartY = e.touches[0].clientY - photoPanY;
            }
        }
    }, { passive: false });

    viewport.addEventListener('touchmove', (e) => {
        const modal = document.getElementById('photoDetailModal');
        if (!modal || !modal.classList.contains('active')) return;

        if (e.touches.length === 2 && photoPinchStartDistance > 0) {
            e.preventDefault();
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDistance = Math.hypot(dx, dy);
            const scaleFactor = currentDistance / photoPinchStartDistance;
            photoZoomScale = Math.min(3.5, Math.max(1.0, photoPinchStartScale * scaleFactor));
            if (photoZoomScale <= 1.05) {
                photoPanX = 0;
                photoPanY = 0;
            }
            applyPhotoTransform(false);
            updatePhotoZoomControls();
        } else if (e.touches.length === 1 && isPhotoDragging && photoZoomScale > 1.05) {
            e.preventDefault();
            photoPanX = e.touches[0].clientX - photoDragStartX;
            photoPanY = e.touches[0].clientY - photoDragStartY;
            applyPhotoTransform(false);
        }
    }, { passive: false });

    viewport.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            photoPinchStartDistance = 0;
        }
        if (isPhotoDragging && e.touches.length === 0) {
            isPhotoDragging = false;
        }

        if (photoZoomScale <= 1.05 && e.changedTouches.length === 1) {
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            const diffX = touchEndX - touchStartX;
            const diffY = touchEndY - touchStartY;
            const duration = Date.now() - touchStartTime;

            if (duration < 450 && Math.abs(diffX) > 45 && Math.abs(diffX) > Math.abs(diffY) * 1.8) {
                if (diffX < 0) {
                    photoViewerNext();
                } else {
                    photoViewerPrev();
                }
            }
        }
    }, { passive: true });
}

window.openPhotoModal = openPhotoModal;
window.closePhotoModal = closePhotoModal;
window.photoViewerNext = photoViewerNext;
window.photoViewerPrev = photoViewerPrev;
window.photoViewerZoomIn = photoViewerZoomIn;
window.photoViewerZoomOut = photoViewerZoomOut;
window.photoViewerResetZoom = photoViewerResetZoom;
window.switchPhotoModalImage = switchPhotoModalImage;
window.photoModalBuyAction = photoModalBuyAction;

// Keyboard accessibility for all Modals, Drawers & Dropdowns
document.addEventListener('keydown', (e) => {
    const photoModal = document.getElementById('photoDetailModal');
    const isPhotoModalOpen = photoModal && photoModal.classList.contains('active');

    if (isPhotoModalOpen) {
        if (e.key === 'Escape') {
            closePhotoModal();
            return;
        }
        if (e.key === 'ArrowLeft') {
            photoViewerPrev();
            return;
        }
        if (e.key === 'ArrowRight') {
            photoViewerNext();
            return;
        }
        if (e.key === '+' || e.key === '=') {
            photoViewerZoomIn();
            return;
        }
        if (e.key === '-' || e.key === '_') {
            photoViewerZoomOut();
            return;
        }
    }

    if (e.key === 'Escape') {
        const cityDropdown = document.getElementById('npCityDropdown');
        if (cityDropdown && cityDropdown.style.display !== 'none') {
            cityDropdown.style.display = 'none';
        }
        const warehouseDropdown = document.getElementById('npWarehouseDropdown');
        if (warehouseDropdown && warehouseDropdown.style.display !== 'none') {
            warehouseDropdown.style.display = 'none';
        }
        const brandModal = document.getElementById('brandModal');
        if (brandModal && brandModal.classList.contains('active')) {
            closeBrandModal();
        }
        const quickModal = document.getElementById('quickChoiceModal');
        if (quickModal && quickModal.classList.contains('active')) {
            closeQuickChoiceModal();
        }
        const sizeModal = document.getElementById('sizeChartModal');
        if (sizeModal && sizeModal.style.display !== 'none') {
            closeSizeChartModal();
        }
        const sizeGuideModal = document.getElementById('sizeModal');
        if (sizeGuideModal && sizeGuideModal.classList.contains('active')) {
            closeSizeGuideModal();
        }
        const orderSuccessModal = document.getElementById('orderSuccessModal');
        if (orderSuccessModal && orderSuccessModal.style.display !== 'none') {
            closeOrderSuccessModal();
        }
        const managerModal = document.getElementById('managerOrdersModal');
        if (managerModal && managerModal.style.display !== 'none') {
            closeManagerOrdersModal();
        }
        const cartDrawer = document.getElementById('cartDrawer');
        if (cartDrawer && cartDrawer.classList.contains('active')) {
            closeCart();
        }
        const favoritesDrawer = document.getElementById('favoritesDrawer');
        if (favoritesDrawer && favoritesDrawer.classList.contains('active')) {
            closeFavoritesDrawer();
        }
    }
});

// ==========================================================================
// MANAGER ORDERS LEDGER (Fail-Safe Offline/Online Order Storage & Review)
// ==========================================================================

function getOrdersLedger() {
    try {
        return JSON.parse(localStorage.getItem('ug_orders_ledger') || '[]');
    } catch (e) {
        return [];
    }
}

function showManagerOrdersModal() {
    let modal = document.getElementById('managerOrdersModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'managerOrdersModal';
        modal.className = 'manager-orders-modal';
        modal.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(4px);';
        modal.innerHTML = `
            <div style="background:#fff;width:100%;max-width:850px;max-height:90vh;border-radius:16px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);font-family:inherit;">
                <div style="padding:16px 20px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;background:#f9fafb;">
                    <div>
                        <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:#111827;">Журнал замовлень URBAN</h3>
                        <p style="margin:2px 0 0;font-size:0.8rem;color:#6b7280;">Автономний резервний реєстр замовлень на цьому пристрої</p>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <button type="button" onclick="exportOrdersAsText()" style="padding:6px 12px;background:#10b981;color:#fff;border:none;border-radius:8px;font-size:0.8rem;font-weight:600;cursor:pointer;">Експорт (.txt)</button>
                        <button type="button" onclick="closeManagerOrdersModal()" style="padding:6px 12px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:0.9rem;font-weight:700;cursor:pointer;">✕</button>
                    </div>
                </div>
                <div id="managerOrdersList" style="padding:16px 20px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:12px;"></div>
                <div style="padding:12px 20px;border-top:1px solid #e5e7eb;background:#f9fafb;display:flex;justify-content:space-between;align-items:center;">
                    <button type="button" onclick="clearOrdersLedger()" style="padding:6px 12px;background:#fee2e2;color:#b91c1c;border:none;border-radius:6px;font-size:0.75rem;cursor:pointer;">Очистити список</button>
                    <span id="managerOrdersCount" style="font-size:0.8rem;color:#6b7280;"></span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    renderManagerOrdersList();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeManagerOrdersModal() {
    const modal = document.getElementById('managerOrdersModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

function renderManagerOrdersList() {
    const list = document.getElementById('managerOrdersList');
    const countEl = document.getElementById('managerOrdersCount');
    if (!list) return;

    const orders = getOrdersLedger();
    if (countEl) countEl.textContent = `Всього замовлень: ${orders.length}`;

    if (orders.length === 0) {
        list.innerHTML = `
            <div style="text-align:center;padding:48px 16px;color:#9ca3af;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 12px;"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
                <p style="font-weight:600;font-size:1rem;color:#4b5563;margin-bottom:4px;">Поки що немає збережених замовлень</p>
                <p style="font-size:0.85rem;color:#6b7280;">Кожне нове замовлення, оформлене на сайті, автоматично зберігатиметься тут.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = orders.map((ord, idx) => {
        const cleanPhone = (ord.customerPhone || '').replace(/[^\d+]/g, '');
        const tgMsg = `Замовлення ${ord.orderId}:\nКлієнт: ${ord.customerName} (${ord.customerPhone})\nДоставка: ${ord.delivery}\nСума: ${ord.total}\nТовари:\n${ord.items}`;
        const tgLink = `https://t.me/lunarecho94?text=${encodeURIComponent(tgMsg)}`;

        return `
            <div style="border:1px solid #e5e7eb;border-radius:12px;padding:14px;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.05);display:flex;flex-direction:column;gap:8px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;border-bottom:1px solid #f3f4f6;padding-bottom:8px;">
                    <div>
                        <span style="background:#111827;color:#fff;font-size:0.75rem;font-weight:800;padding:2px 8px;border-radius:6px;margin-right:6px;">${escapeHtml(ord.orderId || '')}</span>
                        <span style="font-size:0.8rem;color:#6b7280;">${escapeHtml(ord.date || '')}</span>
                    </div>
                    <div style="font-size:0.95rem;font-weight:800;color:#059669;">
                        ${escapeHtml(ord.total || '')}
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:6px;font-size:0.85rem;">
                    <div><span style="color:#6b7280;">Клієнт:</span> <b>${escapeHtml(ord.customerName || '')}</b></div>
                    <div><span style="color:#6b7280;">Тел:</span> <a href="tel:${cleanPhone}" style="color:#2563eb;font-weight:700;text-decoration:none;">${escapeHtml(ord.customerPhone || '')}</a></div>
                    <div style="grid-column:1/-1;"><span style="color:#6b7280;">Доставка:</span> <b>${escapeHtml(ord.delivery || '')}</b></div>
                    <div style="grid-column:1/-1;"><span style="color:#6b7280;">Оплата:</span> <b>${escapeHtml(ord.payment || '')}</b></div>
                </div>
                <div style="background:#f9fafb;padding:8px 10px;border-radius:8px;font-size:0.8rem;color:#374151;white-space:pre-wrap;line-height:1.4;">${escapeHtml(ord.items || '')}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px;">
                    <button type="button" onclick="copyOrderTtn(${idx})" style="padding:6px 12px;background:#f3f4f6;border:1px solid #d1d5db;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer;">Копіювати для Нової Пошти</button>
                    <a href="${tgLink}" target="_blank" style="padding:6px 12px;background:#e0f2fe;color:#0284c7;border-radius:6px;font-size:0.75rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">Відкрити в Telegram</a>
                    <a href="tel:${cleanPhone}" style="padding:6px 12px;background:#ecfdf5;color:#059669;border-radius:6px;font-size:0.75rem;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px;">Зателефонувати</a>
                </div>
            </div>
        `;
    }).join('');
}

function copyOrderTtn(idx) {
    const orders = getOrdersLedger();
    const ord = orders[idx];
    if (!ord) return;
    const cleanPhone = (ord.customerPhone || '').replace(/[^\d+]/g, '');
    const ttnCopyText = `ПІБ: ${ord.customerName}\nТел: ${cleanPhone}\nДоставка: ${ord.delivery}\nТовари: ${ord.quickTtn || ord.items}\nОплата: ${ord.payment} — ${ord.total}`;
    copyTextToClipboard(ttnCopyText);
    showCartToast('Дані для ТТН скопійовано!');
}
window.copyOrderTtn = copyOrderTtn;

function exportOrdersAsText() {
    const orders = getOrdersLedger();
    if (orders.length === 0) {
        showCartToast('Журнал замовлень порожній');
        return;
    }

    let text = `URBAN — ЖУРНАЛ ЗАМОВЛЕНЬ (${new Date().toLocaleString('uk-UA')})\n\n`;
    orders.forEach((ord, i) => {
        text += `========================================\n`;
        text += `ЗАМОВЛЕННЯ ${ord.orderId} від ${ord.date}\n`;
        text += `Клієнт: ${ord.customerName}\n`;
        text += `Тел: ${ord.customerPhone}\n`;
        text += `Доставка: ${ord.delivery}\n`;
        text += `Оплата: ${ord.payment}\n`;
        text += `Сума: ${ord.total}\n`;
        text += `Товари:\n${ord.items}\n`;
        text += `ДЛЯ ТТН: ${ord.quickTtn}\n\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `URBAN_Zamovlennya_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showCartToast('Файл із замовленнями завантажено!');
}

function clearOrdersLedger() {
    if (confirm('Ви впевнені, що хочете очистити історію замовлень на цьому пристрої?')) {
        localStorage.removeItem('ug_orders_ledger');
        renderManagerOrdersList();
        showCartToast('Журнал замовлень очищено');
    }
}

window.showManagerOrdersModal = showManagerOrdersModal;
window.closeManagerOrdersModal = closeManagerOrdersModal;
window.exportOrdersAsText = exportOrdersAsText;
window.clearOrdersLedger = clearOrdersLedger;

// ==========================================================================
// DEDICATED PRODUCT DETAIL PAGE (PDP) LOGIC
// ==========================================================================

let pdpCurrentProduct = null;
let pdpSelectedSize = '';
let pdpCurrentPhotoIndex = 0;

function generateProductSlug(name, id) {
    const cyrMap = {
        'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye',
        'ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l',
        'м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
        'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'',
        'ю':'yu','я':'ya','ъ':'','ы':'y','э':'e'
    };
    const s = String(name || '').toLowerCase();
    let trans = '';
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        trans += cyrMap[ch] !== undefined ? cyrMap[ch] : ch;
    }
    const clean = trans.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const cleanId = String(id || '').trim();
    if (clean && cleanId) {
        return `${clean}-${cleanId}`;
    }
    return clean || cleanId || 'product';
}
window.generateProductSlug = generateProductSlug;

function getProductUrl(item) {
    if (!item) return '#';
    const slug = generateProductSlug(item.name || item.title || item.brand_name || item.brand || 'product', item.id);
    return `/product/${slug}`;
}
window.getProductUrl = getProductUrl;

function returnToCatalogProduct(productId) {
    let targetId = productId;
    if (!targetId && window.currentPdpProduct) {
        targetId = window.currentPdpProduct.id;
    }
    if (!targetId && typeof currentPhotoItem !== 'undefined' && currentPhotoItem) {
        targetId = currentPhotoItem.id;
    }

    try {
        sessionStorage.removeItem('urban_last_viewed_product_id');
        sessionStorage.removeItem('urban_catalog_state');
    } catch (e) {}

    const url = targetId ? `index.html?return=${encodeURIComponent(targetId)}` : 'index.html';
    window.location.href = url;
}
window.returnToCatalogProduct = returnToCatalogProduct;

function scrollToCatalogProductCard(productId, fallbackY) {
    if (!productId) return;
    const targetId = String(productId).trim();

    const doScroll = () => {
        const card = document.getElementById(`prod-${targetId}`);
        if (card) {
            // Instantly center the card in viewport
            card.scrollIntoView({ behavior: 'auto', block: 'center' });

            // Apply distinct visual cue so user immediately sees the chosen card
            card.classList.add('product-card-returned');
            setTimeout(() => {
                card.classList.remove('product-card-returned');
            }, 2500);

            // Clear return state from memory so subsequent calls never repeat
            returnProductId = null;
            try {
                sessionStorage.removeItem('urban_last_viewed_product_id');
                sessionStorage.removeItem('urban_catalog_state');
            } catch (e) {}

            // Clean return parameter from URL
            if (window.history && window.history.replaceState) {
                const url = new URL(window.location.href);
                if (url.searchParams.has('return') || url.searchParams.has('return_product')) {
                    url.searchParams.delete('return');
                    url.searchParams.delete('return_product');
                    const clean = url.pathname + (url.search ? url.search : '') + (url.hash && !url.hash.startsWith('#prod-') ? url.hash : '');
                    window.history.replaceState({}, document.title, clean);
                }
            }
            return true;
        } else if (fallbackY && fallbackY > 100) {
            window.scrollTo({ top: fallbackY, behavior: 'auto' });
            return true;
        }
        return false;
    };

    if (!doScroll()) {
        requestAnimationFrame(() => {
            if (!doScroll()) {
                setTimeout(doScroll, 80);
                setTimeout(doScroll, 250);
            }
        });
    } else {
        // Double check after 150ms in case lazy images shifted document geometry
        setTimeout(() => {
            const card = document.getElementById(`prod-${targetId}`);
            if (card) {
                const rect = card.getBoundingClientRect();
                if (rect.top < 0 || rect.bottom > window.innerHeight) {
                    card.scrollIntoView({ behavior: 'auto', block: 'center' });
                }
            }
        }, 150);
    }
}
window.scrollToCatalogProductCard = scrollToCatalogProductCard;

function openProductPage(productId, e, directUrl, openInNewWindow = false) {
    if (e) {
        if (e.ctrlKey || e.metaKey || e.button === 1) return; // Allow native browser new tab
        if (e.target && (
            e.target.closest('.btn-card-fav') || 
            e.target.closest('.card-thumbnails') || 
            e.target.closest('.size-options') || 
            e.target.closest('.btn-buy') || 
            e.target.closest('.btn-size-chart-link')
        )) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();
    }

    let targetUrl = directUrl;
    if (!targetUrl && productId) {
        const item = (typeof catalogAllProducts !== 'undefined' && catalogAllProducts && catalogAllProducts.find(p => String(p.id) === String(productId))) || { id: productId };
        targetUrl = getProductUrl(item);
    }

    if (!targetUrl || targetUrl === '#') return;

    if (productId) {
        try {
            sessionStorage.removeItem('urban_last_viewed_product_id');
            sessionStorage.removeItem('urban_catalog_state');
        } catch (err) {}
    }

    if (openInNewWindow) {
        try {
            const win = window.open(targetUrl, '_blank', 'noopener,noreferrer');
            if (win) {
                try { win.focus(); } catch (err) {}
                return;
            }
        } catch (err) {
            console.warn('window.open blocked, falling back to current window', err);
        }
    }
    window.location.href = targetUrl;
}
window.openProductPage = openProductPage;

async function initProductDetailPage() {
    const pdpEl = document.getElementById('productDetailPage');
    if (!pdpEl) return;

    const skeleton = document.getElementById('pdpLoadingSkeleton');
    const notFound = document.getElementById('pdpNotFound');
    const content = document.getElementById('pdpContent');

    // 1. Get Product ID, Art or Slug from URL
    const urlParams = new URLSearchParams(window.location.search);
    let rawQuery = urlParams.get('slug') || urlParams.get('id') || urlParams.get('p') || '';
    let productArt = urlParams.get('art');

    let pathSlug = '';
    const pathMatch = window.location.pathname.match(/\/(?:p|product)\/([^/?#]+)/i);
    if (pathMatch) {
        pathSlug = decodeURIComponent(pathMatch[1]);
    }

    const candidate = pathSlug || rawQuery;
    let extractedId = null;
    if (candidate) {
        // e.g. "adidas-originals-campus-00s-olive-black-176797" -> "176797"
        const idMatch = candidate.match(/-([a-zA-Z0-9_]+)$/);
        if (idMatch) {
            extractedId = idMatch[1];
        } else {
            extractedId = candidate;
        }
    }

    if (!extractedId && !candidate && !productArt) {
        if (skeleton) skeleton.style.display = 'none';
        if (notFound) notFound.style.display = 'block';
        return;
    }

    // 2. Fetch catalog products if not loaded
    try {
        if (!catalogAllProducts || catalogAllProducts.length === 0) {
            const resp = await fetch('/data/products.json');
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const raw = await resp.json();
            const defectSizeRegex = /нюанс|дефект|брак|плям|уцінк|потертост|потёрт|скидк|-50%/i;
            catalogAllProducts = raw.filter(item => {
                if (item.sizes && Array.isArray(item.sizes)) {
                    item.sizes = item.sizes.filter(s => !defectSizeRegex.test(s));
                }
                if (!item.sizes || item.sizes.length === 0) return false;
                if (isSneakerProductItem(item) && item.sizes.length < 3) return false;
                if (isLvBagItem(item)) return false;
                return true;
            });
        }
    } catch (err) {
        console.error('Error loading products for PDP:', err);
    }

    if (!catalogAllProducts || catalogAllProducts.length === 0) {
        if (skeleton) skeleton.style.display = 'none';
        if (notFound) notFound.style.display = 'block';
        return;
    }

    // 3. Find Product
    let product = null;
    if (extractedId) {
        product = catalogAllProducts.find(p => String(p.id) === String(extractedId));
    }
    if (!product && candidate) {
        product = catalogAllProducts.find(p => String(p.id) === String(candidate));
    }
    if (!product && candidate) {
        product = catalogAllProducts.find(p => generateProductSlug(p.name || p.title, p.id) === candidate);
    }
    if (!product && candidate) {
        const candLower = candidate.toLowerCase();
        const candNorm = normalizeSearchCode(candidate);
        product = catalogAllProducts.find(p => p.art && (p.art.toLowerCase() === candLower || normalizeSearchCode(p.art) === candNorm));
    }
    if (!product && productArt) {
        const artLower = productArt.toLowerCase();
        const artNorm = normalizeSearchCode(productArt);
        product = catalogAllProducts.find(p => p.art && (p.art.toLowerCase() === artLower || normalizeSearchCode(p.art) === artNorm));
    }

    if (!product) {
        if (skeleton) skeleton.style.display = 'none';
        if (notFound) notFound.style.display = 'block';
        return;
    }

    pdpCurrentProduct = product;
    pdpCurrentPhotoIndex = 0;

    // 4. Update canonical browser URL to clean SEO slug if on query string or generic path
    try {
        const canonicalSlug = generateProductSlug(product.name || product.title, product.id);
        const expectedPath = `/product/${canonicalSlug}`;
        if (window.history && window.history.replaceState && window.location.pathname !== expectedPath) {
            window.history.replaceState(null, '', expectedPath);
        }
    } catch (e) {
        // ignore history state errors
    }

    // 5. Render Product Details
    renderProductDetailPage(product);

    if (skeleton) skeleton.style.display = 'none';
    if (content) content.style.display = 'grid';

    // 6. Render Recommended Products
    renderPdpRecommendedProducts(product);

    // 7. Track ViewContent
    safeTrackFbq('ViewContent', {
        content_name: product.name,
        content_category: product.cat_name || product.cat,
        content_ids: [product.id],
        content_type: 'product',
        value: product.price,
        currency: 'UAH'
    });
}
window.initProductDetailPage = initProductDetailPage;

function renderProductDetailPage(item) {
    window.currentPdpProduct = item;
    try {
        sessionStorage.removeItem('urban_last_viewed_product_id');
        sessionStorage.removeItem('urban_catalog_state');
    } catch (e) {}

    const returnUrl = `index.html?return=${encodeURIComponent(item.id)}`;
    const displayName = formatProductDisplayName(item);
    const categoryTitle = getCategoryTitle(item.cat, item);
    const formattedPrice = item.price.toLocaleString('uk-UA') + ' грн';
    const formattedOldPrice = item.old_price ? item.old_price.toLocaleString('uk-UA') + ' грн' : '';

    const canonicalSlug = generateProductSlug(item.name || item.title, item.id);
    const canonicalUrl = `https://urbangrid.com.ua/product/${canonicalSlug}`;

    // Document Meta
    document.title = `${displayName} | URBAN`;
    const metaDesc = document.getElementById('pdpMetaDesc');
    if (metaDesc) metaDesc.content = `${displayName}. Матеріал: ${item.mat || 'високоякісні матеріали'}. Швидка відправка Новою Поштою 1-2 дні по Україні, оплата при отриманні або на карту.`;
    
    // OpenGraph
    const ogTitle = document.getElementById('ogTitle');
    if (ogTitle) ogTitle.content = `${displayName} | URBAN`;
    const ogDesc = document.getElementById('ogDesc');
    if (ogDesc) ogDesc.content = generateProductDescription(item);
    const ogImage = document.getElementById('ogImage');
    if (ogImage && item.imgs && item.imgs[0]) ogImage.content = item.imgs[0];
    const ogUrl = document.getElementById('ogUrl');
    if (ogUrl) ogUrl.content = canonicalUrl;

    // Twitter
    const twTitle = document.getElementById('twTitle');
    if (twTitle) twTitle.content = `${displayName} | URBAN`;
    const twDesc = document.getElementById('twDesc');
    if (twDesc) twDesc.content = generateProductDescription(item);
    const twImage = document.getElementById('twImage');
    if (twImage && item.imgs && item.imgs[0]) twImage.content = item.imgs[0];

    // Breadcrumbs & Return Navigation
    const crumbHome = document.getElementById('pdpCrumbHome') || document.querySelector('.pdp-breadcrumbs a[href="index.html"]');
    if (crumbHome) {
        crumbHome.href = returnUrl;
        crumbHome.onclick = (e) => {
            e.preventDefault();
            returnToCatalogProduct(item.id);
        };
    }
    const backLink = document.getElementById('pdpBackLink') || document.querySelector('.pdp-back-link');
    if (backLink) {
        backLink.href = returnUrl;
        backLink.onclick = (e) => {
            e.preventDefault();
            returnToCatalogProduct(item.id);
        };
    }
    const goHomeBtn = document.querySelector('.btn-pdp-go-home');
    if (goHomeBtn) {
        goHomeBtn.href = returnUrl;
        goHomeBtn.onclick = (e) => {
            e.preventDefault();
            returnToCatalogProduct(item.id);
        };
    }

    const crumbCat = document.getElementById('pdpCrumbCat');
    if (crumbCat) {
        crumbCat.textContent = 'Одяг';
        crumbCat.href = returnUrl;
        crumbCat.onclick = (e) => {
            e.preventDefault();
            returnToCatalogProduct(item.id);
        };
    }

    const subcatSlug = item.subcat || (item.cat !== 'clothing' ? item.cat : '');
    const subcatTitle = subcatSlug ? getCategoryTitle(subcatSlug, item) : '';
    const crumbSubcat = document.getElementById('pdpCrumbSubcat');
    const crumbSepSub = document.getElementById('pdpCrumbSepSub');
    if (crumbSubcat) {
        if (subcatTitle) {
            crumbSubcat.textContent = subcatTitle;
            crumbSubcat.href = `index.html?cat=${encodeURIComponent(subcatSlug)}#catalog`;
            crumbSubcat.style.display = '';
            if (crumbSepSub) crumbSepSub.style.display = '';
        } else {
            crumbSubcat.style.display = 'none';
            if (crumbSepSub) crumbSepSub.style.display = 'none';
        }
    }

    const isExternalBrand = item.brand && item.brand !== 'urban' && item.brand !== 'radrop' && item.brand !== 'all';
    const crumbBrand = document.getElementById('pdpCrumbBrand');
    const crumbSepBrand = document.getElementById('pdpCrumbSepBrand');
    if (crumbBrand) {
        if (isExternalBrand && item.brand_name) {
            crumbBrand.textContent = item.brand_name;
            crumbBrand.style.display = '';
            if (crumbSepBrand) crumbSepBrand.style.display = '';
        } else if (!crumbSubcat && subcatTitle) {
            crumbBrand.textContent = subcatTitle;
            crumbBrand.style.display = '';
            if (crumbSepBrand) crumbSepBrand.style.display = '';
        } else {
            crumbBrand.style.display = 'none';
            if (crumbSepBrand) crumbSepBrand.style.display = 'none';
        }
    }

    const crumbTitle = document.getElementById('pdpCrumbTitle');
    if (crumbTitle) {
        crumbTitle.textContent = displayName;
    }

    // Badge
    const badgeEl = document.getElementById('pdpBadge');
    if (badgeEl) {
        badgeEl.textContent = item.badge || 'Топ якість';
    }

    // Discount
    const discEl = document.getElementById('pdpDiscountBadge');
    const discPill = document.getElementById('pdpDiscountPill');
    if (item.old_price && item.old_price > item.price) {
        const pct = Math.round(((item.old_price - item.price) / item.old_price) * 100);
        if (discEl) {
            discEl.textContent = `-${pct}%`;
            discEl.style.display = 'block';
        }
        if (discPill) {
            discPill.textContent = `-${pct}%`;
            discPill.style.display = 'inline-flex';
        }
    } else {
        if (discEl) discEl.style.display = 'none';
        if (discPill) discPill.style.display = 'none';
    }

    // Title
    const titleEl = document.getElementById('pdpTitle');
    if (titleEl) titleEl.textContent = displayName;

    // Brand Tag
    const brandTag = document.getElementById('pdpBrandTag');
    if (brandTag) {
        if (isExternalBrand && item.brand_name) {
            brandTag.textContent = item.brand_name;
        } else {
            brandTag.textContent = subcatTitle || '';
        }
    }

    // Art
    const artVal = document.getElementById('pdpArtVal');
    if (artVal) artVal.textContent = item.art || '---';

    // Prices
    const priceNow = document.getElementById('pdpPriceNow');
    if (priceNow) priceNow.textContent = formattedPrice;

    const priceOld = document.getElementById('pdpPriceOld');
    if (priceOld) {
        if (formattedOldPrice) {
            priceOld.textContent = formattedOldPrice;
            priceOld.style.display = 'inline';
        } else {
            priceOld.style.display = 'none';
        }
    }

    // Description text (natural editorial description, no duplicate characteristics)
    const descText = document.getElementById('pdpDescText');
    if (descText) {
        descText.textContent = generateProductDescription(item);
    }

    // Gallery
    renderPdpGallery(item);

    // Sizes
    renderPdpSizes(item);

    // Specs
    renderPdpSpecs(item);

    // Accordions (Dynamic Size guide & returns adapted to category)
    renderPdpAccordions(item);

    // Favorite Button State
    updatePdpFavoriteButton(item.id);

    // Init swipe gesture on main image box
    initPdpSwipe(item);
}

function renderPdpGallery(item) {
    const mainImg = document.getElementById('pdpMainImg');
    const thumbsStrip = document.getElementById('pdpThumbsStrip');
    const btnPrev = document.getElementById('pdpBtnPrev');
    const btnNext = document.getElementById('pdpBtnNext');

    const imgs = (item.imgs && item.imgs.length > 0) ? item.imgs : ['images/sneakers.webp'];
    if (pdpCurrentPhotoIndex >= imgs.length) pdpCurrentPhotoIndex = 0;

    if (mainImg) {
        mainImg.src = imgs[pdpCurrentPhotoIndex];
        mainImg.alt = formatProductDisplayName(item);
    }

    if (imgs.length <= 1) {
        if (btnPrev) btnPrev.style.display = 'none';
        if (btnNext) btnNext.style.display = 'none';
        if (thumbsStrip) thumbsStrip.style.display = 'none';
    } else {
        if (btnPrev) btnPrev.style.display = 'flex';
        if (btnNext) btnNext.style.display = 'flex';
        if (thumbsStrip) {
            thumbsStrip.style.display = 'flex';
            thumbsStrip.innerHTML = imgs.map((img, idx) => `
                <button type="button" class="pdp-thumb-btn ${idx === pdpCurrentPhotoIndex ? 'active' : ''}" onclick="pdpSwitchPhoto(${idx})" aria-label="Фото ${idx + 1}">
                    <img src="${img}" alt="Фото ${idx + 1}" loading="lazy" referrerpolicy="no-referrer">
                </button>
            `).join('');
        }
    }
}

function pdpSwitchPhoto(idx) {
    if (!pdpCurrentProduct) return;
    const imgs = pdpCurrentProduct.imgs || ['images/sneakers.webp'];
    if (idx < 0) idx = imgs.length - 1;
    if (idx >= imgs.length) idx = 0;
    pdpCurrentPhotoIndex = idx;

    const mainImg = document.getElementById('pdpMainImg');
    if (mainImg) {
        mainImg.style.opacity = '0.35';
        mainImg.src = imgs[pdpCurrentPhotoIndex];
        setTimeout(() => { mainImg.style.opacity = '1'; }, 100);
    }

    const thumbs = document.querySelectorAll('.pdp-thumb-btn');
    const thumbsStrip = document.getElementById('pdpThumbsStrip');
    thumbs.forEach((tb, i) => {
        if (i === pdpCurrentPhotoIndex) {
            tb.classList.add('active');
            if (thumbsStrip) {
                const offset = tb.offsetLeft - (thumbsStrip.clientWidth / 2) + (tb.clientWidth / 2);
                thumbsStrip.scrollTo({ left: Math.max(0, offset), behavior: 'smooth' });
            }
        } else {
            tb.classList.remove('active');
        }
    });
}
window.pdpSwitchPhoto = pdpSwitchPhoto;

function pdpGalleryPrev() { pdpSwitchPhoto(pdpCurrentPhotoIndex - 1); }
window.pdpGalleryPrev = pdpGalleryPrev;

function pdpGalleryNext() { pdpSwitchPhoto(pdpCurrentPhotoIndex + 1); }
window.pdpGalleryNext = pdpGalleryNext;

function initPdpSwipe(item) {
    const box = document.getElementById('pdpMainImgBox');
    if (!box || box._pdpSwipeInit) return;
    box._pdpSwipeInit = true;

    let touchStartX = 0;
    let touchEndX = 0;

    box.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
        }
    }, { passive: true });

    box.addEventListener('touchend', (e) => {
        if (e.changedTouches && e.changedTouches.length === 1) {
            touchEndX = e.changedTouches[0].clientX;
            const diff = touchEndX - touchStartX;
            if (Math.abs(diff) > 40) {
                if (diff < 0) {
                    pdpGalleryNext();
                } else {
                    pdpGalleryPrev();
                }
            }
        }
    }, { passive: true });
}

function renderPdpSizes(item) {
    const grid = document.getElementById('pdpSizeGrid');
    const label = document.getElementById('pdpSelectedSizeLabel');
    const hint = document.getElementById('pdpSizeHint');
    if (!grid) return;

    const sizes = item.sizes || [];
    if (sizes.length === 0) {
        grid.innerHTML = '<span style="color:#64748b; font-size:13px;">Універсальний розмір (One Size)</span>';
        pdpSelectedSize = 'One Size';
        if (label) label.textContent = 'One Size';
        if (hint) hint.textContent = 'Розмір: One Size';
        return;
    }

    pdpSelectedSize = formatSizeLabel(String(sizes[0]).trim());
    if (label) label.textContent = pdpSelectedSize;
    if (hint) hint.textContent = `Обраний розмір: ${pdpSelectedSize}`;

    grid.innerHTML = sizes.map((sz, idx) => {
        const rawSz = String(sz || '').trim();
        const displaySz = formatSizeLabel(rawSz);
        return `
            <button type="button" class="pdp-size-btn ${idx === 0 ? 'active' : ''}" onclick="pdpSelectSize(this, '${escapeHtml(displaySz)}')" title="Розмір ${escapeHtml(displaySz)}">
                ${escapeHtml(displaySz)}
            </button>
        `;
    }).join('');
}

function pdpSelectSize(btn, szVal) {
    document.querySelectorAll('.pdp-size-btn, .pdp-size-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    pdpSelectedSize = szVal;
    const label = document.getElementById('pdpSelectedSizeLabel');
    if (label) label.textContent = szVal;
    const hint = document.getElementById('pdpSizeHint');
    if (hint) hint.textContent = `Обраний розмір: ${szVal}`;
}
window.pdpSelectSize = pdpSelectSize;

function generateProductDescription(item) {
    if (item && item.desc && typeof item.desc === 'string') {
        const lines = item.desc.split('\n');
        const kept = [];
        const itemName = (item.name || '').toLowerCase();
        const titleTokens = itemName.split(/\s+/).filter(w => w.length > 2);

        for (let rawLine of lines) {
            let line = rawLine.trim();
            if (!line) continue;

            const noEmoji = line.replace(/[\u{1F000}-\u{1FFFF}\u{2000}-\u{3300}]/gu, '').trim();
            if (!noEmoji) continue;

            if (/^(?:Артикул|Арт|Розмір[иі]?|Матеріал|Сезон|Виробник|Країна|Стан|Комплектація)\b/i.test(noEmoji)) {
                const matExtra = noEmoji.match(/^Матеріал\s*:\s*[^.]+\.\s*(.+)$/i);
                if (matExtra && matExtra[1] && matExtra[1].trim().length > 8) {
                    kept.push(matExtra[1].trim());
                }
                continue;
            }

            if (titleTokens.length > 0 && noEmoji.length > 5) {
                const lineTokens = noEmoji.toLowerCase().split(/\s+/).filter(w => w.length > 2);
                const overlap = lineTokens.filter(tok => titleTokens.includes(tok)).length;
                if (lineTokens.length > 0 && (overlap / lineTokens.length) >= 0.6 && lineTokens.length <= 8) {
                    continue;
                }
            }

            let cleanLine = line.replace(/[\u{1F000}-\u{1FFFF}\u{2000}-\u{3300}]/gu, '')
                .replace(/(?:Артикул|Арт|Розмір[иі]?|Матеріал|Сезон|Виробник|Країна|Стан)\s*:\s*[^,.]+[.,]?/gi, '')
                .replace(/\s+/g, ' ')
                .trim();

            if (cleanLine.length > 5) {
                kept.push(cleanLine);
            }
        }

        let combined = kept.join(' ').replace(/\s{2,}/g, ' ').trim();
        if (combined.length > 15) {
            return combined.charAt(0).toUpperCase() + combined.slice(1);
        }
    }

    const cat = item.cat || 'shoes';
    const season = item.season || 'demi';
    const nameLower = (item.name || '').toLowerCase();

    // 1. Footwear
    if (cat === 'shoes') {
        if (nameLower.includes('gore-tex') || nameLower.includes('gtx')) {
            return "Технологічна модель із захистом від вологи та вітру. Забезпечує оптимальний мікроклімат, комфортну підтримку стопи та надійність за будь-яких примх міської погоди.";
        }
        if (season === 'winter' || nameLower.includes('зимов') || nameLower.includes('термо') || nameLower.includes('угг') || nameLower.includes('winter')) {
            return "Тепла та надійна модель для прохолодного сезону. Зручна анатомічна посадка, чіпка зносостійка підошва для впевненого зчеплення з поверхнею та високі термоізоляційні властивості для щоденного комфорту в будь-яку негоду.";
        }
        if (season === 'summer' || nameLower.includes('сітка') || nameLower.includes('літо') || nameLower.includes('сланц') || nameLower.includes('сандал') || nameLower.includes('crocs')) {
            return "Легка повітропроникна модель для теплої погоди. Продумана перфорація забезпечує чудову вентиляцію, а м'яка гнучка підошва дарує легкість кожного кроку під час активного міського дня.";
        }
        return "Культовий міський силует із виразним сучасним дизайном та бездоганною ергономікою. Забезпечує м'яку амортизацію під час ходьби, надійну фіксацію стопи та відчуття легкості впродовж усього дня. Ідеально підходить для створення стильного щоденного образу.";
    }

    // 2. Clothing
    if (cat === 'clothing') {
        if (nameLower.includes('куртк') || nameLower.includes('пуховик') || nameLower.includes('жилет')) {
            return "Практичний та стильний верхній одяг для щоденного захисту від холоду та вітру. Продуманий ергономічний крій зберігає свободу рухів і комфортне тепло під час прогулянок містом.";
        }
        if (nameLower.includes('худі') || nameLower.includes('світшот') || nameLower.includes('толстовк') || nameLower.includes('костюм')) {
            return "Базова та затишна річ для невимушеного вуличного образу. Зручний вільний крій, м'яка внутрішня текстура та висока зносостійкість для максимального повсякденного комфорту.";
        }
        if (nameLower.includes('штани') || nameLower.includes('карго') || nameLower.includes('джогер') || nameLower.includes('шорти') || nameLower.includes('джинс')) {
            return "Зручна та функціональна модель для активного міського життя. Анатомічний крій та комфортна посадка забезпечують свободу рухів протягом усього дня.";
        }
        if (nameLower.includes('футболк') || nameLower.includes('поло') || nameLower.includes('майк')) {
            return "Лаконічна та стильна модель для базового гардеробу. Зручна посадка по фігурі, комфортна тканина та відмінна стійкість до щоденного носіння.";
        }
        return "Стильний та зручний елемент гардеробу у сучасному вуличному стилі. Забезпечує комфортну посадку, свободу рухів та відмінно поєднується з іншими речами.";
    }

    // 3. Accessories
    if (cat === 'accessories') {
        if (nameLower.includes('сумк') || nameLower.includes('рюкзак') || nameLower.includes('бананка') || nameLower.includes('месенджер') || nameLower.includes('клатч')) {
            return "Функціональний та місткий аксесуар для зберігання найнеобхідніших речей. Ергономічний формат, міцні матеріали та надійна фурнітура для динамічного щоденного ритму.";
        }
        if (nameLower.includes('кепк') || nameLower.includes('шапк') || nameLower.includes('панам')) {
            return "Стильний головний убір, що гармонійно доповнює повсякденний образ та забезпечує захист і комфорт за будь-якої погоди.";
        }
        return "Практичний та якісний аксесуар у сучасному стилі, створений для зручності та завершення вашого індивідуального образу.";
    }

    // 4. Underwear
    if (cat === 'underwear') {
        return "Комфортна білизна анатомічного крою з м'якою еластичною резинкою. Забезпечує приємне відчуття до тіла, повітропроникність та ідеальну посадку на весь день.";
    }

    // 5. Socks
    if (cat === 'socks') {
        return "Зручні шкарпетки з еластичною фіксацією, що надійно тримаються на нозі без передавлювання. Забезпечують сухість, повітрообмін та довговічність при щоденному носінні.";
    }

    // Fallback
    return "Оригінальна якість та сучасний дизайн для вашого щоденного гардеробу. Відмінний вибір для тих, хто цінує комфорт, практичність та актуальний стиль.";
}
window.generateProductDescription = generateProductDescription;

function renderPdpSpecs(item) {
    const list = document.getElementById('pdpSpecsList');
    if (!list) return;

    const rows = [
        { label: 'Артикул товару:', val: item.art || '---' }
    ];

    const brandName = (item.brand_name || '').trim();
    const brandSlug = (item.brand || '').toLowerCase().trim();
    const isUrbanOrEmpty = !brandName || brandName.toLowerCase() === 'urban' || brandSlug === 'urban' || brandName.toLowerCase() === 'ра дроп' || brandName.toLowerCase() === 'r.a drop' || brandSlug === 'radrop';

    if (!isUrbanOrEmpty) {
        rows.push({ label: 'Бренд:', val: brandName });
    }

    rows.push(
        { label: 'Категорія:', val: getCategoryTitle(item.cat, item) },
        { label: 'Сезон:', val: item.season_name || (item.season === 'winter' ? 'Зима' : (item.season === 'summer' ? 'Літо' : 'Демісезон')) }
    );
    if (item.mat) rows.push({ label: 'Матеріал:', val: item.mat });
    rows.push({
        label: 'Стан:',
        val: 'Новий'
    });

    list.innerHTML = rows.map(r => `
        <div class="pdp-spec-row">
            <span class="pdp-spec-label">${escapeHtml(r.label)}</span>
            <span class="pdp-spec-val">${escapeHtml(r.val)}</span>
        </div>
    `).join('');
}

function renderPdpAccordions(item) {
    const cat = item ? (item.cat || 'shoes') : 'shoes';
    const titleEl = document.getElementById('pdpAccSizeGuideTitle');
    const bodyEl = document.getElementById('pdpAccSizeGuideBody');
    const returnsEl = document.getElementById('pdpAccReturnsBody');
    const sizeGuideBtnText = document.getElementById('pdpSizeGuideBtnText');

    if (cat === 'shoes') {
        if (titleEl) titleEl.textContent = 'Як підібрати точний розмір взуття?';
        if (bodyEl) {
            bodyEl.innerHTML = `
                <p style="margin-bottom: 8px;">1. <strong>Замір стопи:</strong> поставте стопу на аркуш паперу біля стіни, обведіть її ручкою та виміряйте лінійкою точну відстань від краю п'яти до кінчика найдовшого пальця (довжину стопи в сантиметрах).</p>
                <p style="margin-bottom: 8px;">2. <strong>Вибір розміру:</strong> знайдіть отримані сантиметри в таблиці розмірів під цією моделлю. Якщо довжина стопи знаходиться між двома розмірами — рекомендуємо обрати більший розмір.</p>
                <p style="margin-bottom: 12px;">3. <strong>Допомога менеджера:</strong> під час дзвінка або в чаті менеджер обов'язково перевірить довжину устілки саме цієї пари перед відправкою!</p>
                <div>
                    <button type="button" class="btn-pdp-guide-inline" onclick="pdpOpenSizeGuide()">Таблиця розмірів взуття →</button>
                </div>
            `;
        }
        if (returnsEl) {
            returnsEl.textContent = "Відповідно до Закону України «Про захист прав споживачів», ви маєте право на обмін розміру або повернення товару протягом 14 днів з моменту отримання посилки. Обов'язкова умова: збереження товарного вигляду взуття, оригінальної коробки та ярликів. Огляд та примірка доступні у відділенні Нової Пошти.";
        }
        if (sizeGuideBtnText) sizeGuideBtnText.textContent = 'Підібрати розмір взуття';
    } else if (cat === 'clothing') {
        if (titleEl) titleEl.textContent = 'Як підібрати точний розмір одягу?';
        if (bodyEl) {
            bodyEl.innerHTML = `
                <p style="margin-bottom: 8px;">1. <strong>Основні параметри:</strong> для точного підбору одягу орієнтуйтеся на ваш зріст, вагу та ключові обхвати: грудей (для худі, курток, футболок), талії та стегон (для штанів та спортивних костюмів).</p>
                <p style="margin-bottom: 8px;">2. <strong>Посадка:</strong> якщо ви віддаєте перевагу вільній оверсайз-посадці або ваші мірки знаходяться між двома розмірами — рекомендуємо обрати на 1 розмір більший.</p>
                <p style="margin-bottom: 12px;">3. <strong>Індивідуальний підбір:</strong> при оформленні замовлення вкажіть ваш зріст та вагу в коментарі, або менеджер особисто уточнить ваші мірки по телефону для 100% ідеальної посадки!</p>
                <div>
                    <button type="button" class="btn-pdp-guide-inline" onclick="pdpOpenSizeGuide()">Таблиця розмірів одягу →</button>
                </div>
            `;
        }
        if (returnsEl) {
            returnsEl.textContent = "Відповідно до Закону України «Про захист прав споживачів», ви маєте право на обмін розміру або повернення товару протягом 14 днів з моменту отримання посилки. Обов'язкова умова: збереження товарного вигляду одягу, оригінальної упаковки та фабричних ярликів. Огляд та примірка доступні у відділенні Нової Пошти.";
        }
        if (sizeGuideBtnText) sizeGuideBtnText.textContent = 'Підібрати розмір одягу';
    } else if (cat === 'underwear') {
        if (titleEl) titleEl.textContent = 'Як підібрати розмір білизни?';
        if (bodyEl) {
            bodyEl.innerHTML = `
                <p style="margin-bottom: 8px;">1. <strong>Замір пояса та стегон:</strong> розмір білизни підбирається за обхватом пояса (резинки на рівні талії/стегон) або за вашим звичним розміром джинсів чи штанів (M, L, XL, 2XL, 3XL).</p>
                <p style="margin-bottom: 8px;">2. <strong>Комфортна посадка:</strong> фірмові комплекти виготовлені з якісної еластичної бавовни з додаванням спандексу. Для комфортної щоденної посадки рекомендуємо обирати на один розмір більше (наприклад, L замість M).</p>
                <p style="margin-bottom: 12px;">3. <strong>Консультація менеджера:</strong> при підтвердженні замовлення наш менеджер підкаже точну ширину резинки в сантиметрах під обрану модель!</p>
                <div>
                    <button type="button" class="btn-pdp-guide-inline" onclick="pdpOpenSizeGuide()">Таблиця розмірів білизни та одягу →</button>
                </div>
            `;
        }
        if (returnsEl) {
            returnsEl.textContent = "Обмін та повернення білизни здійснюється згідно з чинним законодавством України: перевірка комплектації та розміру проводиться при отриманні у відділенні Нової Пошти. При виявленні невідповідності розміру або фабричного дефекту обмін здійснюється оперативно та за наш рахунок.";
        }
        if (sizeGuideBtnText) sizeGuideBtnText.textContent = 'Підібрати розмір білизни';
    } else if (cat === 'socks') {
        if (titleEl) titleEl.textContent = 'Розмірна сітка шкарпеток';
        if (bodyEl) {
            bodyEl.innerHTML = `
                <p style="margin-bottom: 8px;">1. <strong>Універсальний еластичний розмір:</strong> більшість моделей шкарпеток мають універсальний розмір One Size (36–41 або 41–45) завдяки якісній бавовні з додаванням еластану.</p>
                <p style="margin-bottom: 8px;">2. <strong>Посадка:</strong> анатомічна резинка м'яко фіксує шкарпетку на нозі без передавлювання судин.</p>
                <p style="margin-bottom: 0;">3. <strong>Уточнення:</strong> наш менеджер підкаже точну відповідність вашому розміру взуття перед відправкою посилки.</p>
            `;
        }
        if (returnsEl) {
            returnsEl.textContent = "Огляд та перевірка шкарпеток здійснюється при отриманні у відділенні Нової Пошти. Збереження оригінальної фабричної упаковки та ярликів є обов'язковим для збереження товарного вигляду.";
        }
        if (sizeGuideBtnText) sizeGuideBtnText.textContent = 'Розмірна сітка шкарпеток';
    } else {
        // Accessories
        if (titleEl) titleEl.textContent = 'Параметри та розмір';
        if (bodyEl) {
            bodyEl.innerHTML = `
                <p style="margin-bottom: 8px;">1. <strong>Універсальний розмір (One Size):</strong> аксесуари (сумки, рюкзаки, головні убори, прикраси) мають універсальний формат або регульовані ремені та застібки.</p>
                <p style="margin-bottom: 0;">2. <strong>Детальні заміри:</strong> якщо вам потрібні точні габарити (висота, ширина, глибина у см або довжина ланцюжка) — наш менеджер з радістю надасть повні виміри при оформленні.</p>
            `;
        }
        if (returnsEl) {
            returnsEl.textContent = "Відповідно до Закону України «Про захист прав споживачів», ви маєте право на обмін або повернення аксесуару протягом 14 днів з моменту отримання посилки за умови збереження товарного вигляду, пломб, упаковки та бірок.";
        }
        if (sizeGuideBtnText) sizeGuideBtnText.textContent = 'Параметри та розмір';
    }
}

function pdpAddToCartAction() {
    if (!pdpCurrentProduct) return;
    const item = pdpCurrentProduct;
    const displayName = formatProductDisplayName(item);
    const mainImg = (item.imgs && item.imgs[0]) ? item.imgs[0] : 'images/sneakers.webp';
    const chosenSize = pdpSelectedSize || (item.sizes && item.sizes[0] ? formatSizeLabel(item.sizes[0]) : '42');

    addToCart({
        id: `${item.id}-${chosenSize}`,
        prodId: item.id,
        title: displayName,
        art: item.art || '',
        price: item.price,
        size: chosenSize,
        img: mainImg,
        mat: item.mat || '',
        origin: item.origin || '',
        link: window.location.href,
        qty: 1
    });
}
window.pdpAddToCartAction = pdpAddToCartAction;

function pdpQuickOrderAction() {
    if (!pdpCurrentProduct) return;
    const item = pdpCurrentProduct;
    const displayName = formatProductDisplayName(item);
    const chosenSize = pdpSelectedSize || (item.sizes && item.sizes[0] ? formatSizeLabel(item.sizes[0]) : '42');

    const modal = document.getElementById('quickOrderModalWrapper');
    const subtitle = document.getElementById('pdpQuickModalSubtitle');
    const inputModel = document.getElementById('pdpQuickChosenModel');

    if (subtitle) subtitle.textContent = `${displayName} (Арт: ${item.art || '---'}) • ${item.price} грн • Розмір: ${chosenSize}`;
    if (inputModel) inputModel.value = `${displayName} (Арт: ${item.art || '---'}, Розмір: ${chosenSize}, Ціна: ${item.price} грн)`;
    if (modal) {
        modal.style.display = 'flex';
        void modal.offsetWidth;
        modal.classList.add('active');
    }
}
window.pdpQuickOrderAction = pdpQuickOrderAction;

function pdpCloseQuickOrderModal() {
    const modal = document.getElementById('quickOrderModalWrapper');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => { modal.style.display = 'none'; }, 200);
    }
}
window.pdpCloseQuickOrderModal = pdpCloseQuickOrderModal;

async function pdpSubmitQuickOrder(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!pdpCurrentProduct) return;
    const item = pdpCurrentProduct;
    const displayName = formatProductDisplayName(item);
    const chosenSize = pdpSelectedSize || (item.sizes && item.sizes[0] ? formatSizeLabel(item.sizes[0]) : '42');

    const nameInput = document.getElementById('pdpQuickName');
    const phoneInput = document.getElementById('pdpQuickPhone');
    const errorEl = document.getElementById('pdpQuickPhoneError');

    const customerName = (nameInput ? nameInput.value.trim() : '') || 'Покупець';
    const customerPhone = phoneInput ? phoneInput.value.trim() : '';

    const phoneCheck = validateUkrainianPhone(customerPhone);
    if (!phoneCheck.valid) {
        if (errorEl) {
            errorEl.textContent = phoneCheck.message;
            errorEl.style.display = 'block';
        }
        if (phoneInput) phoneInput.focus();
        return;
    }
    if (errorEl) errorEl.style.display = 'none';

    const btn = document.getElementById('btnPdpSubmitQuick');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'ОФОРМЛЕННЯ...';
    }

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `UG-Q${randomNum}`;
    const formattedTotal = `${item.price.toLocaleString('uk-UA')} грн`;
    const fullItemSummary = `1. ${displayName} (Арт: ${item.art || '---'}) | Розмір: ${chosenSize} | 1 шт. × ${formattedTotal}`;

    const quickTtnBlock = `ПІБ: ${customerName}\nТел: ${phoneCheck.formatted}\nДоставка: Узгодити по телефону (швидке замовлення з картки товару)\nТовари: ${displayName} (Арт: ${item.art || '---'}, Р: ${chosenSize})\nОплата: Узгодити з менеджером — ${formattedTotal}`;

    const quickOrderData = {
        orderId: orderId,
        orderDate: new Date().toLocaleString('uk-UA'),
        customerName: customerName,
        customerPhone: phoneCheck.formatted,
        customerAddress: 'Узгодити при дзвінку менеджера',
        delivery: 'Узгодити при дзвінку менеджера',
        paymentMethod: 'Узгодити з менеджером',
        payment: 'Узгодити з менеджером',
        itemsSummary: fullItemSummary,
        itemsText: fullItemSummary,
        total: formattedTotal,
        subtotalFormatted: formattedTotal,
        totalNum: item.price || 0
    };

    saveOrderToLedger({
        orderId: orderId,
        date: quickOrderData.orderDate,
        customerName: customerName,
        customerPhone: phoneCheck.formatted,
        delivery: 'Узгодити по телефону (швидке замовлення з картки товару)',
        payment: 'Узгодити з менеджером',
        total: formattedTotal,
        items: fullItemSummary,
        quickTtn: quickTtnBlock
    });

    try {
        await sendOrderDispatch({
            orderId: orderId,
            orderDate: quickOrderData.orderDate,
            customerName: customerName,
            customerPhone: phoneCheck.formatted,
            delivery: 'Узгодити по телефону (швидке замовлення з картки товару)',
            payment: 'Узгодити з менеджером (Накладений платіж / передплата)',
            itemsText: fullItemSummary,
            quickTtn: quickTtnBlock,
            total: formattedTotal,
            subject: `ШВИДКЕ ЗАМОВЛЕННЯ З ТОВАРУ #${orderId} | ${formattedTotal} | ${customerName} | ${displayName}`,
            contactPreference: 'Очікує швидкого дзвінка менеджера (1 клік з картки товару)',
            pdfResult: null
        });
    } catch (dispErr) {
        console.warn('PDP order dispatch note:', dispErr);
    }

    safeTrackFbq('Lead', {
        content_name: displayName,
        value: item.price,
        currency: 'UAH'
    });

    try {
        sessionStorage.setItem('ug_last_order', JSON.stringify(quickOrderData));
    } catch (e) {}

    pdpCloseQuickOrderModal();
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ';
    }

    window.location.href = `thank-you.html?orderId=${encodeURIComponent(orderId)}&total=${encodeURIComponent(item.price || 2500)}`;
}
window.pdpSubmitQuickOrder = pdpSubmitQuickOrder;

function pdpOrderViaMessenger(type, e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!pdpCurrentProduct) return;
    const item = pdpCurrentProduct;
    const displayName = formatProductDisplayName(item);
    const chosenSize = pdpSelectedSize || (item.sizes && item.sizes[0] ? formatSizeLabel(item.sizes[0]) : '42');

    const msg = `Доброго дня! Хочу замовити цей товар з сайту URBAN:\n\n` +
        `Модель: ${displayName}\n` +
        `Артикул: ${item.art || '---'}\n` +
        `Розмір: ${chosenSize}\n` +
        `Ціна: ${item.price.toLocaleString('uk-UA')} грн\n` +
        `Посилання: ${window.location.href}\n\n` +
        `Підкажіть, будь ласка, наявність та як оформити доставку!`;

    copyTextToClipboard(msg);
    showCartToast('Текст замовлення скопійовано!');

    safeTrackFbq('Contact', { content_name: displayName });

    if (type === 'telegram') {
        const tgUrl = `https://t.me/+380974524435`;
        window.open(tgUrl, '_blank');
    } else {
        const vbUrl = `viber://chat?number=%2B380974524435`;
        window.location.href = vbUrl;
    }
}
window.pdpOrderViaMessenger = pdpOrderViaMessenger;

function pdpCopyArt() {
    if (!pdpCurrentProduct || !pdpCurrentProduct.art) return;
    copyTextToClipboard(pdpCurrentProduct.art);
    showCartToast(`Артикул ${pdpCurrentProduct.art} скопійовано!`);
    const hint = document.getElementById('pdpArtCopyHint');
    if (hint) {
        hint.textContent = 'скопійовано!';
        setTimeout(() => { hint.textContent = 'копіювати'; }, 2000);
    }
}
window.pdpCopyArt = pdpCopyArt;

function pdpOpenSizeGuide() {
    const cat = pdpCurrentProduct ? (pdpCurrentProduct.cat || 'shoes') : 'shoes';
    if (cat === 'accessories' || cat === 'socks') {
        const acc = document.getElementById('pdpAccSizeGuide');
        if (acc) {
            acc.classList.add('open');
            acc.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }
    openSizeChartModal(cat);
}
window.pdpOpenSizeGuide = pdpOpenSizeGuide;

function pdpOpenZoomModal() {
    // Zoom modal disabled per user instruction
}
window.pdpOpenZoomModal = pdpOpenZoomModal;

function pdpScrollToAccordion(type) {
    const targetId = type === 'delivery' ? 'pdpAccDelivery' : 'pdpAccReturns';
    const acc = document.getElementById(targetId);
    if (acc) {
        acc.classList.add('open');
        acc.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}
window.pdpScrollToAccordion = pdpScrollToAccordion;

function pdpToggleFavoriteAction() {
    if (!pdpCurrentProduct) return;
    toggleFavorite(pdpCurrentProduct.id);
    updatePdpFavoriteButton(pdpCurrentProduct.id);
}
window.pdpToggleFavoriteAction = pdpToggleFavoriteAction;

function updatePdpFavoriteButton(prodId) {
    const btn = document.getElementById('btnPdpFav');
    const textEl = document.getElementById('btnPdpFavText');
    if (!btn) return;
    const isFav = isFavorite(prodId);
    if (isFav) {
        btn.classList.add('active');
        if (textEl) textEl.textContent = 'В ОБРАНОМУ';
        const svgPath = btn.querySelector('svg path');
        if (svgPath) {
            svgPath.setAttribute('fill', '#ef4444');
            svgPath.setAttribute('stroke', '#ef4444');
        }
    } else {
        btn.classList.remove('active');
        if (textEl) textEl.textContent = 'В ОБРАНЕ';
        const svgPath = btn.querySelector('svg path');
        if (svgPath) {
            svgPath.setAttribute('fill', '#ffffff');
            svgPath.setAttribute('stroke', '#000000');
        }
    }
}

function renderPdpRecommendedProducts(currentProduct) {
    const sec = document.getElementById('pdpRecommendedSection');
    const grid = document.getElementById('pdpRecommendedGrid');
    const title = document.getElementById('pdpRecTitle');
    if (!sec || !grid || !catalogAllProducts) return;

    let recs = catalogAllProducts.filter(p => String(p.id) !== String(currentProduct.id) && (p.subcat && currentProduct.subcat ? p.subcat === currentProduct.subcat : p.brand === currentProduct.brand));
    if (recs.length < 4) {
        const catRecs = catalogAllProducts.filter(p => String(p.id) !== String(currentProduct.id) && !recs.some(r => String(r.id) === String(p.id)));
        recs = recs.concat(catRecs);
    }
    recs = recs.slice(0, 4);

    if (recs.length === 0) {
        sec.style.display = 'none';
        return;
    }

    if (title) {
        title.textContent = 'СХОЖІ ПРОПОЗИЦІЇ';
    }

    grid.innerHTML = '';
    recs.forEach(item => {
        grid.appendChild(createProductCardElement(item));
    });
    sec.style.display = 'block';
}

function pdpToggleAccordion(btn) {
    const item = btn.closest('.pdp-acc-item');
    if (item) {
        item.classList.toggle('open');
    }
}
window.pdpToggleAccordion = pdpToggleAccordion;

// ==========================================
// PDP LIVE VIEWERS COUNTER (0 - 39)
// ==========================================
let pdpViewersInterval = null;

function getPdpViewersSuffix(count) {
    const safeCount = Math.max(0, Math.min(39, Math.round(count)));
    const mod100 = safeCount % 100;
    const mod10 = safeCount % 10;
    if (mod100 >= 11 && mod100 <= 14) {
        return 'людей зараз переглядають цей товар';
    }
    if (mod10 === 1) {
        return 'людина зараз переглядає цей товар';
    }
    if (mod10 >= 2 && mod10 <= 4) {
        return 'людини зараз переглядають цей товар';
    }
    return 'людей зараз переглядають цей товар';
}

function updatePdpViewersDisplay(count) {
    const safeCount = Math.max(0, Math.min(39, Math.round(count)));
    const textEl = document.getElementById('pdpViewersText');
    const countEl = document.getElementById('pdpViewersCount');
    const suffix = getPdpViewersSuffix(safeCount);

    if (textEl) {
        textEl.innerHTML = `<strong id="pdpViewersCount">${safeCount}</strong> ${suffix}`;
    } else if (countEl) {
        countEl.textContent = String(safeCount);
        const parentSpan = countEl.parentElement;
        if (parentSpan) {
            parentSpan.innerHTML = `<strong id="pdpViewersCount">${safeCount}</strong> ${suffix}`;
        }
    }
    return safeCount;
}

function initPdpViewersCounter() {
    // Disabled per specification (no fake viewer counters)
    const pill = document.getElementById('pdpViewersPill');
    if (pill) pill.style.display = 'none';
}
window.getPdpViewersSuffix = getPdpViewersSuffix;
window.updatePdpViewersDisplay = updatePdpViewersDisplay;
window.initPdpViewersCounter = initPdpViewersCounter;



