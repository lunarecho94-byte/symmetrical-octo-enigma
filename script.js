// Gallery Image Switcher
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
    if (val.includes('5000')) {
        priceDisplay.textContent = '5 000 грн';
    } else if (val.includes('2850')) {
        priceDisplay.textContent = '2 850 грн';
    } else if (val.includes('2550')) {
        priceDisplay.textContent = '2 550 грн';
    } else {
        priceDisplay.textContent = '2 620 грн';
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

// Live Purchase Toast Notifications
const toastData = [
    { name: "Ангеліна з м. Київ", text: "щойно замовила Nike SB Dunk Low 38 розміру (2 хв тому)" },
    { name: "Олена з м. Львів", text: "замовила Nike SB Dunk Low 37 розміру" },
    { name: "Вікторія з м. Дніпро", text: "замовила 2 пари Nike SB Dunk Low Premium" },
    { name: "Дмитро з м. Одеса", text: "замовив Nike SB Dunk Low 40 розміру в подарунок" },
    { name: "Катерина з м. Харків", text: "замовила Nike SB Dunk Low 39 розміру" }
];

let toastIndex = 0;
function showPurchaseToast() {
    const toast = document.getElementById('purchaseToast');
    const toastName = document.getElementById('toastName');
    const toastDetails = document.getElementById('toastDetails');

    if (!toast || !toastName || !toastDetails) return;

    const current = toastData[toastIndex];
    toastName.textContent = current.name;
    toastDetails.textContent = current.text;

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);

    toastIndex = (toastIndex + 1) % toastData.length;
}

function checkOrderSuccess() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('ordered') === '1') {
        alert('🎉 ДЯКУЄМО ЗА ЗАМОВЛЕННЯ!\n\nВаші дані успішно передані менеджеру на пошту (lunarecho94@icloud.com).\nМи зателефонуємо вам протягом 10 хвилин для підтвердження відправки Новою Поштою!');
    }
}

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    checkOrderSuccess();
    startTimer(15500); // 4 hours countdown
    setInterval(showPurchaseToast, 9000);
    setTimeout(showPurchaseToast, 3000);
});
