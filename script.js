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

// Select specific model in order form
function selectModelInForm(modelVal, priceStr) {
    const select = document.getElementById('productSelect');
    if (select) {
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value.includes(modelVal) || select.options[i].text.includes(modelVal)) {
                select.selectedIndex = i;
                break;
            }
        }
    }
    const priceDisplay = document.getElementById('finalOrderPrice');
    if (priceDisplay && priceStr) {
        priceDisplay.textContent = priceStr;
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
    } else {
        priceDisplay.textContent = '2 350 грн';
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
    initSwipeGalleries();
    initScrollTop();
});
