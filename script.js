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
// URBANO SHOPPING CART SYSTEM
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

    // Ad Conversion Tracking (Meta Pixel & GA4)
    if (window.fbq) {
        try {
            fbq('track', 'AddToCart', {
                content_name: item.title,
                value: item.price,
                currency: 'UAH'
            });
        } catch (e) {}
    }
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
    if (val.includes('3100')) {
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

// ==========================================================================
// PDF INVOICE GENERATION & ORDER SUBMISSION
// ==========================================================================
let lastGeneratedPdfBlob = null;
let lastGeneratedPdfName = 'Zamovlennya_URBANO.pdf';
let isSubmittingOrder = false;

function populatePdfTemplate(orderId, orderDate) {
    const customerName = (document.getElementById('fullName')?.value || '').trim() || 'Покупець';
    const customerPhone = (document.getElementById('phone')?.value || '').trim() || '—';
    const customerAddress = (document.getElementById('cityNP')?.value || '').trim() || '—';
    
    const payRadio = document.querySelector('input[name="Спосіб оплати"]:checked');
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
            const selectedModel = productSelect ? productSelect.value : 'Кросівки URBANO';
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
            ? cart.map(i => `${i.title} [${i.size}] × ${i.qty}`).join(', ')
            : `${document.getElementById('productSelect')?.value || ''} [${document.getElementById('selectedSize')?.value || ''}]`
    };
}

async function generateOrderPdf(orderId, orderDate) {
    const orderData = populatePdfTemplate(orderId, orderDate);
    const element = document.getElementById('orderPdfInvoiceTemplate');
    if (!element) return null;

    const cleanId = orderId.replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `Zamovlennya_${cleanId}.pdf`;

    const opt = {
        margin: [6, 6, 6, 6],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    if (typeof html2pdf !== 'undefined') {
        try {
            const blob = await html2pdf().set(opt).from(element).outputPdf('blob');
            lastGeneratedPdfBlob = blob;
            lastGeneratedPdfName = fileName;
            return { blob, fileName, orderData };
        } catch (err) {
            console.error('Error generating PDF:', err);
            return null;
        }
    } else {
        console.warn('html2pdf library is not yet loaded');
        return null;
    }
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
        submitBtn.innerHTML = '⏳ Формування замовлення та PDF...';
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

    // Ensure _url is set to current origin
    const urlInput = document.getElementById('formSubmitUrl');
    if (urlInput) {
        urlInput.value = window.location.origin || 'https://urbangrid.com.ua';
    }

    // Attach PDF to Form via DataTransfer (for fallback)
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

    // Prepare FormData for AJAX submission
    const formData = new FormData(form);
    if (pdfResult && pdfResult.blob) {
        formData.set('attachment', pdfResult.blob, pdfResult.fileName);
    }

    try {
        const response = await fetch('https://formsubmit.co/ajax/lunarecho94@icloud.com', {
            method: 'POST',
            body: formData
        });
        const result = await response.json();

        if (result.success === 'true' || result.success === true) {
            // Ad Conversion Tracking (Meta Pixel & GA4)
            const orderTotalNum = parseInt((document.getElementById('pdfGrandTotalSum')?.textContent || '2500').replace(/\D/g, ''), 10) || 2500;
            if (window.fbq) {
                try {
                    fbq('track', 'Purchase', {
                        value: orderTotalNum,
                        currency: 'UAH',
                        content_type: 'product'
                    });
                } catch (e) {}
            }
            if (window.gtag) {
                try {
                    gtag('event', 'purchase', {
                        transaction_id: orderId,
                        value: orderTotalNum,
                        currency: 'UAH'
                    });
                } catch (e) {}
            }

            clearCart();
            isSubmittingOrder = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'ПІДТВЕРДИТИ ЗАМОВЛЕННЯ (НАКЛАДЕНИЙ ПЛАТІЖ)';
            }
            showOrderSuccessModal(pdfResult ? pdfResult.orderData : null);
            return;
        } else {
            console.warn('FormSubmit returned non-success:', result);
            throw new Error(result.message || 'Submission failed');
        }
    } catch (fetchErr) {
        console.warn('AJAX submission failed, attempting native form submit fallback:', fetchErr);
        form.action = 'https://formsubmit.co/lunarecho94@icloud.com';
        form.submit();
    }
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
        alert('🎉 ДЯКУЄМО ЗА ЗАМОВЛЕННЯ!\n\nВаше замовлення успішно передано менеджеру на пошту (lunarecho94@icloud.com) у форматі PDF.\nМи зателефонуємо вам протягом 10 хвилин для підтвердження відправки Новою Поштою!');
        return;
    }

    const orderNumEl = document.getElementById('successOrderNum');
    const detailsBox = document.getElementById('successOrderDetailsBox');

    if (orderInfo) {
        if (orderNumEl) orderNumEl.textContent = `№ ${orderInfo.orderId}`;
        if (detailsBox) {
            detailsBox.innerHTML = `
                <div class="details-row"><span>Одержувач:</span> <b>${orderInfo.customerName}</b></div>
                <div class="details-row"><span>Телефон:</span> <b>${orderInfo.customerPhone}</b></div>
                <div class="details-row"><span>Доставка:</span> <b>${orderInfo.customerAddress}</b></div>
                <div class="details-row"><span>Оплата:</span> <b>${orderInfo.paymentMethod}</b></div>
                <div class="details-row"><span>Товари:</span> <b>${orderInfo.itemsSummary}</b></div>
                <div class="details-row"><span>Сума до сплати:</span> <b>${orderInfo.subtotalFormatted}</b></div>
            `;
        }
    } else {
        if (orderNumEl) orderNumEl.textContent = 'УСПІШНО';
        if (detailsBox) {
            detailsBox.innerHTML = `
                <div class="details-row"><span>Статус:</span> <b>Замовлення надіслано на пошту менеджера</b></div>
                <div class="details-row"><span>Формат:</span> <b>Електронна накладна (PDF)</b></div>
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
}

async function downloadLastGeneratedPdf() {
    const btn = document.getElementById('btnDownloadSuccessPdf');
    if (btn) {
        btn.innerHTML = '⏳ Підготовка PDF...';
        btn.disabled = true;
    }

    try {
        if (lastGeneratedPdfBlob) {
            const url = URL.createObjectURL(lastGeneratedPdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = lastGeneratedPdfName || 'Zamovlennya_URBANO.pdf';
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
            btn.innerHTML = '📥 Завантажити електронний чек (PDF)';
            btn.disabled = false;
        }
    }
}

// ==========================================
// Catalog Search & Brand Filtering
// ==========================================
let currentCatalogBrand = 'all';
let currentCatalogSearchQuery = '';
let cachedProductCards = [];

function initCatalogCardsCache() {
    const cards = document.querySelectorAll('.product-card');
    cachedProductCards = Array.from(cards).map(card => {
        const title = card.querySelector('.product-title')?.textContent || '';
        const cat = card.querySelector('.product-cat')?.textContent || '';
        const desc = card.querySelector('.product-desc')?.textContent || '';
        const badge = card.querySelector('.badge-new-arrival')?.textContent || '';
        const brand = card.dataset.brand || '';
        const id = card.id || '';
        const price = card.querySelector('.price-now')?.textContent || '';

        const searchText = `${title} ${cat} ${desc} ${badge} ${brand} ${id} ${price}`.toLowerCase();
        return {
            el: card,
            brand: brand,
            searchText: searchText
        };
    });
}

function applyCatalogFilters() {
    if (!cachedProductCards.length) {
        initCatalogCardsCache();
    }

    const query = currentCatalogSearchQuery.trim().toLowerCase();
    const queryTokens = query ? query.split(/\s+/).filter(Boolean) : [];
    const clearBtn = document.getElementById('clearSearchBtn');
    const resultsInfo = document.getElementById('searchResultsInfo');
    const resultsCountEl = document.getElementById('searchResultsCount');
    const noResultsBox = document.getElementById('noSearchResultsBox');
    const noResultsDetail = document.getElementById('noResultsDetail');

    if (clearBtn) {
        clearBtn.style.display = query ? 'flex' : 'none';
    }

    let visibleCount = 0;

    cachedProductCards.forEach(item => {
        const matchesBrand = (currentCatalogBrand === 'all' || item.brand === currentCatalogBrand);
        const matchesSearch = queryTokens.length === 0 || queryTokens.every(token => item.searchText.includes(token));

        if (matchesBrand && matchesSearch) {
            item.el.style.display = '';
            visibleCount++;
        } else {
            item.el.style.display = 'none';
        }
    });

    // Update results counter info
    const hasActiveFilters = (query !== '' || currentCatalogBrand !== 'all');
    if (resultsInfo && resultsCountEl) {
        if (hasActiveFilters) {
            resultsInfo.style.display = 'flex';
            
            const labels = [];
            if (currentCatalogBrand === 'nike') labels.push('Nike');
            else if (currentCatalogBrand === 'nb') labels.push('New Balance');
            else if (currentCatalogBrand === 'adidas') labels.push('Adidas');
            else if (currentCatalogBrand === 'skate') labels.push('Vans & Puma');

            let countWord = 'моделей';
            if (visibleCount % 10 === 1 && visibleCount % 100 !== 11) countWord = 'модель';
            else if ([2, 3, 4].includes(visibleCount % 10) && ![12, 13, 14].includes(visibleCount % 100)) countWord = 'моделі';

            const labelText = labels.length ? ` • ${labels.join(' • ')}` : '';
            if (query) {
                resultsCountEl.textContent = `Знайдено: ${visibleCount} ${countWord}${labelText} за запитом «${currentCatalogSearchQuery}»`;
            } else {
                resultsCountEl.textContent = `Обрано: ${visibleCount} ${countWord}${labelText}`;
            }
        } else {
            resultsInfo.style.display = 'none';
        }
    }

    // Show/hide empty state
    if (noResultsBox) {
        noResultsBox.style.display = (visibleCount === 0) ? 'block' : 'none';
        if (visibleCount === 0 && noResultsDetail) {
            const filterTerms = [];
            if (currentCatalogBrand !== 'all') filterTerms.push(currentCatalogBrand.toUpperCase());
            if (query) filterTerms.push(`«${query}»`);
            noResultsDetail.textContent = filterTerms.length 
                ? `За запитом (${filterTerms.join(' • ')}) товарів на складі не знайдено. Спробуйте інше ключове слово або скиньте фільтр.`
                : 'Товарів не знайдено. Спробуйте інший пошуковий запит.';
        }
    }
}

function filterCatalog(brand, btn) {
    if (currentCatalogBrand === brand && brand !== 'all') {
        currentCatalogBrand = 'all';
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        const allBtn = document.querySelector('.filter-chip');
        if (allBtn) allBtn.classList.add('active');
    } else {
        currentCatalogBrand = brand;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }
    applyCatalogFilters();
}

function filterCatalogGender() {}
function filterCatalogSize() {}

function handleCatalogSearch(query) {
    currentCatalogSearchQuery = query;
    applyCatalogFilters();
}

function clearCatalogSearch() {
    const input = document.getElementById('catalogSearchInput');
    if (input) {
        input.value = '';
    }
    currentCatalogSearchQuery = '';
    currentCatalogBrand = 'all';

    // Reset Brand
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    const allBrand = document.querySelector('.filter-chip');
    if (allBrand) allBrand.classList.add('active');

    applyCatalogFilters();
}

function quickSearch(term) {
    const input = document.getElementById('catalogSearchInput');
    if (input) {
        input.value = term;
        input.focus();
    }
    currentCatalogSearchQuery = term;
    applyCatalogFilters();
}

function focusSearchInput(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('catalogSearchInput');
    if (input) {
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            input.focus();
        }, 300);
    }
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

// High-Speed Smooth Scroll to Top (Ease-Out-Quint)
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

    // Logo click in sticky header also smoothly scrolls to top
    const brandLogo = document.querySelector('.urbano-animated-logo, .header .logo');
    if (brandLogo) {
        brandLogo.addEventListener('click', (e) => {
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
        if (!npSelectedCity) {
            cityInput.focus();
            return;
        }
        renderFilteredWarehouses(warehouseInput.value.trim());
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

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (cityDropdown) cityDropdown.style.display = 'none';
            if (warehouseDropdown) warehouseDropdown.style.display = 'none';
        }
    });
}

async function triggerCitySearch(query) {
    const cityDropdown = document.getElementById('npCityDropdown');
    const citySpinner = document.getElementById('npCitySpinner');
    if (citySpinner) citySpinner.style.display = 'block';

    try {
        const res = await fetch(NP_API_ENDPOINT, {
            method: 'POST',
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
        console.warn('NP Search Settlements fallback:', err);
        const local = NP_TOP_CITIES.filter(c => c.present.toLowerCase().includes(query.toLowerCase()));
        renderNpCityDropdown(local);
    } finally {
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
                    <span class="np-item-main">📍 ${title}</span>
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
        warehouseHint.textContent = `⚡ Завантажуємо відділення Нової Пошти у ${city.present}...`;
    }

    await loadCityWarehouses(city);

    if (warehouseInput) {
        warehouseInput.placeholder = 'Введіть номер (напр. 25) або вулицю...';
        warehouseInput.focus();
    }
    if (warehouseHint) {
        warehouseHint.textContent = `⚡ Доступно ${npAllWarehouses.length} відділень та поштоматів. Почніть вводити номер або вулицю:`;
    }
    renderFilteredWarehouses('');
}

async function loadCityWarehouses(city) {
    const spinner = document.getElementById('npWarehouseSpinner');
    if (spinner) spinner.style.display = 'block';

    npAllWarehouses = [];
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
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        let json = await res.json();

        // Fallback by CityName if SettlementRef returns 0
        if ((!json.success || !json.data || !json.data.length) && city.name) {
            payload.methodProperties = { CityName: city.name, Limit: '500' };
            res = await fetch(NP_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            json = await res.json();
        }

        if (json.success && Array.isArray(json.data)) {
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
        console.warn('NP Load Warehouses error:', err);
    } finally {
        if (spinner) spinner.style.display = 'none';
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
        const icon = isPostomat ? '📮' : '📦';
        const badgeClass = isPostomat ? 'np-badge-postomat' : 'np-badge-branch';
        const badgeText = isPostomat ? 'Поштомат' : (w.maxWeight || 'Відділення');

        html += `
            <div class="np-dropdown-item" onclick="selectNpWarehouse('${encodeURIComponent(JSON.stringify(w))}')">
                <div class="np-item-content">
                    <span class="np-item-main">${icon} ${w.desc}</span>
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
        warehouseInput.disabled = true;
        warehouseInput.placeholder = 'Спочатку оберіть місто вище...';
    }
    if (warehouseClearBtn) warehouseClearBtn.style.display = 'none';
    if (warehouseDropdown) warehouseDropdown.style.display = 'none';
    if (warehouseHint) warehouseHint.textContent = '⚡ Почніть вводити номер (напр. 45) або вулицю для швидкого пошуку';

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

    if (cart && cart.length > 0) {
        cart.forEach(item => {
            const lineSum = item.price * (item.qty || 1);
            totalPrice += lineSum;
            itemsText += `• ${item.title}\n  👟 Розмір: ${item.size} • К-сть: ${item.qty || 1} шт. • ${(lineSum).toLocaleString('uk-UA')} грн\n`;
        });
    } else {
        const productSelect = document.getElementById('productSelect');
        const sizeSelect = document.getElementById('shoeSizeSelect');
        const selectedModel = productSelect ? productSelect.value : 'Кросівки (з каталогу)';
        const selectedSize = sizeSelect ? sizeSelect.value : '38';
        const finalPriceEl = document.getElementById('finalOrderPrice');
        const priceText = finalPriceEl ? finalPriceEl.textContent.trim() : '2 670 грн';
        totalPrice = parseInt(priceText.replace(/\D/g, ''), 10) || 2670;
        itemsText = `• ${selectedModel}\n  👟 Розмір: ${selectedSize} • 1 шт. • ${priceText}\n`;
    }

    const customerName = (document.getElementById('fullName')?.value || document.getElementById('customerNameInput')?.value || '').trim();
    const customerPhone = (document.getElementById('phone')?.value || document.getElementById('customerPhoneInput')?.value || '').trim();
    const city = (document.getElementById('npCityInput')?.value || '').trim();
    const warehouse = (document.getElementById('npWarehouseInput')?.value || '').trim();
    const noCall = document.getElementById('noCallCheckbox')?.checked;

    let paymentMethod = 'Накладений платіж (при отриманні на пошті)';
    const checkedPay = document.querySelector('input[name="Спосіб оплати"]:checked');
    if (checkedPay && checkedPay.value.includes('Передплата')) {
        paymentMethod = 'Повна передплата на картку (без комісії)';
    }

    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const orderId = `UG-${randomNum}`;

    let msg = `🛍️ ЗАМОВЛЕННЯ З САЙТУ URBANO\n№ #${orderId}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👟 ТОВАРИ:\n${itemsText}`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💰 РАЗОМ: ${totalPrice.toLocaleString('uk-UA')} грн\n`;
    msg += `💳 Оплата: ${paymentMethod}\n`;
    msg += `📍 Доставка: Нова Пошта\n`;
    if (city && warehouse) {
        msg += `  ${city}, ${warehouse}\n`;
    } else if (city) {
        msg += `  ${city} (відділення узгодимо в чаті)\n`;
    } else {
        msg += `  (місто та відділення узгодимо в чаті)\n`;
    }
    msg += `👤 Одержувач: ${customerName || '(узгодимо в чаті)'}\n`;
    msg += `📞 Телефон: ${customerPhone || '(узгодимо в чаті)'}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    if (noCall) {
        msg += `💬 Прошу підтвердити замовлення текстовим повідомленням без дзвінка. Дякую! 🙏`;
    } else {
        msg += `💬 Прошу надіслати підтвердження та номер ТТН сюди в чат. Дякую!`;
    }

    return {
        orderId,
        totalPrice,
        text: msg,
        customerName,
        customerPhone,
        city,
        warehouse
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
    const order = getFormattedOrderForMessenger();
    await copyTextToClipboard(order.text);

    // Track lead asynchronously in background
    try {
        if (order.customerPhone) {
            const formData = new FormData();
            formData.append('Номер замовлення', `#${order.orderId}`);
            formData.append('Джерело', `Месенджер: ${messenger.toUpperCase()}`);
            formData.append('Ім\'я клієнта', order.customerName || 'Клієнт (месенджер)');
            formData.append('Телефон', order.customerPhone);
            formData.append('Адреса доставки', `${order.city} ${order.warehouse}`.trim() || 'Узгодити в месенджері');
            formData.append('Сума замовлення', `${order.totalPrice} грн`);
            formData.append('Статус', 'Клієнт перейшов у месенджер для підтвердження');

            fetch('https://formsubmit.co/ajax/lunarecho94@icloud.com', {
                method: 'POST',
                body: formData
            }).catch(() => {});
        }
    } catch (e) {}

    showCartToast(
        messenger === 'telegram' 
            ? '✈️ Текст замовлення скопійовано! Відкриваємо чат у Telegram...' 
            : '💬 Текст замовлення скопійовано! Відкриваємо чат у Viber...'
    );

    setTimeout(() => {
        if (messenger === 'telegram') {
            const tgUrl = `https://t.me/${TG_MANAGER_USERNAME}?text=${encodeURIComponent(order.text)}`;
            window.open(tgUrl, '_blank');
        } else if (messenger === 'viber') {
            const cleanPhone = VIBER_MANAGER_PHONE.replace(/\D/g, '');
            const viberUrl = `viber://chat?number=%2B${cleanPhone}`;
            window.open(viberUrl, '_blank');
        }
    }, 350);
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

    const text = `Вітаю! Я оформив(ла) замовлення ${orderNum} на сайті URBANO. Підтверджую відправку Новою Поштою. Прошу надіслати ТТН сюди в чат!`;
    copyTextToClipboard(text);

    if (messenger === 'telegram') {
        window.open(`https://t.me/${TG_MANAGER_USERNAME}?text=${encodeURIComponent(text)}`, '_blank');
    } else {
        const cleanPhone = VIBER_MANAGER_PHONE.replace(/\D/g, '');
        window.open(`viber://chat?number=%2B${cleanPhone}`, '_blank');
    }
}

// Global window exposure for inline onclick handlers
window.selectNpCity = selectNpCity;
window.selectNpWarehouse = selectNpWarehouse;
window.filterWarehouseType = filterWarehouseType;
window.checkoutViaMessenger = checkoutViaMessenger;
window.confirmOrderInMessenger = confirmOrderInMessenger;

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    checkOrderSuccess();
    renderCart();
    initSwipeGalleries();
    initScrollTop();
    initCatalogCardsCache();
    initNovaPoshtaAutocomplete();

    // Close Cart on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCart();
            closeSizeGuideModal();
        }
    });

    // Handle Form Submit with PDF Generation
    const form = document.getElementById('checkoutForm');
    if (form) {
        form.addEventListener('submit', handleCheckoutFormSubmit);
    }
});
