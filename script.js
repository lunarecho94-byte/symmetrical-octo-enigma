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

// Universal Card Image Switcher (Catalog Products)
function switchCardImg(thumbElement, targetImgId, imgSrc) {
    const targetImg = document.getElementById(targetImgId);
    if (targetImg) {
        targetImg.src = imgSrc;
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
// URBAN GRID SHOPPING CART SYSTEM
// ==========================================

const CART_STORAGE_KEY = 'urbangrid_cart_v1';

// Get Cart from localStorage
function getCart() {
    try {
        const data = localStorage.getItem(CART_STORAGE_KEY);
        return data ? JSON.parse(data) : [];
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
    } else {
        cart.push(item);
    }
    saveCart(cart);
    showCartToast(`✅ "${item.title}" (${item.size}) додано в кошик!`);
    openCart();
}

// Update Item Quantity in Cart
function updateCartQty(id, delta) {
    let cart = getCart();
    const item = cart.find(i => i.id === id);
    if (!item) return;

    item.qty += delta;
    if (item.qty <= 0) {
        cart = cart.filter(i => i.id !== id);
        showCartToast(`🗑️ Товар видалено з кошика`);
    }
    saveCart(cart);
}

// Remove Item from Cart
function removeFromCart(id) {
    let cart = getCart();
    cart = cart.filter(i => i.id !== id);
    saveCart(cart);
    showCartToast(`🗑️ Товар видалено з кошика`);
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
                    <div class="cart-empty-icon">🛒</div>
                    <h4>Ваш кошик порожній</h4>
                    <p>Перегляньте наш каталог трендових кросівок та оберіть свою пару!</p>
                    <a href="#catalog" class="btn-primary-sm btn-go-catalog" onclick="closeCart()">
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
                html += `
                    <div class="cart-item" data-id="${item.id}">
                        <img src="${item.img}" alt="${item.title}" class="cart-item-img" onerror="this.src='images/nike_court_legacy_lift_1.jpg'">
                        <div class="cart-item-info">
                            <h4 class="cart-item-title">${item.title}</h4>
                            <div class="cart-item-meta">
                                <span class="cart-item-size">Розмір: <b>${item.size}</b></span>
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

    if (cart.length > 0) {
        const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
        const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
        const formattedTotal = totalPrice.toLocaleString('uk-UA') + ' грн';

        if (summaryBox) summaryBox.style.display = 'block';
        if (summaryList) {
            let listHtml = '';
            cart.forEach((item, idx) => {
                listHtml += `
                    <div class="cart-summary-line-item">
                        <img src="${item.img}" alt="${item.title}" class="cart-summary-item-img">
                        <div class="cart-summary-item-text">
                            <b>${idx + 1}. ${item.title}</b>
                            <span>Розмір: <b>${item.size}</b> | К-сть: <b>${item.qty} шт.</b> — ${(item.price * item.qty).toLocaleString('uk-UA')} грн</span>
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
                text += `${idx + 1}. ${item.title} | Розмір: ${item.size} | Кількість: ${item.qty} шт. | Вартість: ${(item.price * item.qty)} грн\n`;
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
function selectModelInForm(modelVal, priceStr, evt) {
    const event = evt || window.event;
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    const clickedEl = event ? event.target : null;
    const card = clickedEl ? clickedEl.closest('.product-card') : null;

    let selectedSizeVal = '38 (24 см)';
    let imgUrl = 'images/nike_court_legacy_lift_1.jpg';
    let cleanTitle = modelVal.replace(/\s*\(\d+\s*грн\)$/i, '').trim();

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
    }

    const numericPrice = parseInt(priceStr.replace(/\D/g, ''), 10) || 0;

    // Add to cart
    addToCart({
        id: cleanTitle + '___' + selectedSizeVal,
        title: cleanTitle,
        size: selectedSizeVal,
        price: numericPrice,
        priceFormatted: priceStr,
        img: imgUrl,
        qty: 1
    });

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
    if (val.includes('2850')) {
        priceDisplay.textContent = '2 850 грн';
    } else if (val.includes('2800')) {
        priceDisplay.textContent = '2 800 грн';
    } else if (val.includes('2750')) {
        priceDisplay.textContent = '2 750 грн';
    } else if (val.includes('2670')) {
        priceDisplay.textContent = '2 670 грн';
    } else if (val.includes('2620')) {
        priceDisplay.textContent = '2 620 грн';
    } else if (val.includes('2600')) {
        priceDisplay.textContent = '2 600 грн';
    } else if (val.includes('2550')) {
        priceDisplay.textContent = '2 550 грн';
    } else if (val.includes('2500')) {
        priceDisplay.textContent = '2 500 грн';
    } else if (val.includes('2450')) {
        priceDisplay.textContent = '2 450 грн';
    } else if (val.includes('2400')) {
        priceDisplay.textContent = '2 400 грн';
    } else if (val.includes('2350')) {
        priceDisplay.textContent = '2 350 грн';
    } else if (val.includes('2330')) {
        priceDisplay.textContent = '2 330 грн';
    } else if (val.includes('2320')) {
        priceDisplay.textContent = '2 320 грн';
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

    if (input.value.includes('Передплата') || input.value.includes('передплата')) {
        if (submitBtn) submitBtn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ (ОПЛАТА НА КАРТКУ)';
        if (summaryLabel) summaryLabel.textContent = 'Разом до сплати (передплата):';
        if (paymentSubtext) paymentSubtext.textContent = 'Економія на комісії Нової Пошти (без переплат за переказ)';
        if (securityNote) securityNote.innerHTML = '💳 <b>Передплата:</b> реквізити для оплати надішле менеджер після підтвердження замовлення.';
    } else {
        if (submitBtn) submitBtn.textContent = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ (НАКЛАДЕНИЙ ПЛАТІЖ)';
        if (summaryLabel) summaryLabel.textContent = 'Разом до сплати при отриманні:';
        if (paymentSubtext) paymentSubtext.textContent = 'Огляд та примірка перед оплатою на Новій Пошті';
        if (securityNote) securityNote.innerHTML = '🔒 <b>Накладений платіж:</b> без обов\'язкової передплати, оплата після огляду та примірки.';
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
    const foot = parseFloat(document.getElementById('userFoot').value) || 24;

    let shoe = '38 (24 см)';
    if (foot >= 26) shoe = '41 (26.5 см)';
    else if (foot >= 25) shoe = '40 (25.5 см)';
    else if (foot >= 24.2) shoe = '39 (24.5 см)';
    else if (foot >= 23.8) shoe = '38 (24 см)';
    else if (foot >= 23.2) shoe = '37 (23.5 см)';
    else shoe = '36 (23 см)';

    document.getElementById('recShoeSize').textContent = shoe;
    document.getElementById('calcResult').classList.remove('hidden');
}

function applyCalculatedSize() {
    const shoe = document.getElementById('recShoeSize').textContent;

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

// Order Form Submit
function submitOrder(e) {
    e.preventDefault();
    const name = document.getElementById('fullName').value;
    const phone = document.getElementById('phone').value;
    const product = document.getElementById('productSelect').value;
    const size = document.getElementById('selectedSize').value;
    const price = document.getElementById('finalOrderPrice').textContent;

    alert(`🎉 ДЯКУЄМО ЗА ЗАМОВЛЕННЯ, ${name.toUpperCase()}!\n\nМодель: ${product}\nРозмір: ${size}\nСума до сплати при отриманні: ${price}\n\nМенеджер зателефонує на номер ${phone} протягом 10 хвилин для підтвердження відправки Новою Поштою!`);
}
function checkOrderSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ordered') === '1') {
        clearCart();
        alert('🎉 ДЯКУЄМО ЗА ЗАМОВЛЕННЯ!\n\nВаші дані успішно передані менеджеру на пошту (lunarecho94@icloud.com).\nМи зателефонуємо вам протягом 10 хвилин для підтвердження відправки Новою Поштою!');
    }
}

// Category Filtering
function filterCatalog(brand, btn) {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const cards = document.querySelectorAll('.product-card');
    cards.forEach(card => {
        if (brand === 'all' || card.dataset.brand === brand) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// Mobile Swipe Support for Product Cards (Strictly horizontal intentional swipe)
function initSwipeGalleries() {
    document.querySelectorAll('.product-card').forEach(card => {
        const wrapper = card.querySelector('.product-img-wrapper');
        const thumbs = card.querySelectorAll('.card-thumb-img');
        if (!wrapper || thumbs.length <= 1) return;

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

// Scroll to Top Floating Button
function initScrollTop() {
    const scrollBtn = document.getElementById('scrollTopBtn');
    window.addEventListener('scroll', () => {
        if (scrollBtn) {
            if (window.scrollY > 450) {
                scrollBtn.style.display = 'inline-flex';
            } else {
                scrollBtn.style.display = 'none';
            }
        }
    }, { passive: true });
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    checkOrderSuccess();
    renderCart();
    initSwipeGalleries();
    initScrollTop();

    // Close Cart on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCart();
            closeSizeGuideModal();
        }
    });

    // Sync Cart on Form Submit
    const form = document.getElementById('checkoutForm');
    if (form) {
        form.addEventListener('submit', () => {
            syncCartWithForm();
        });
    }
});
