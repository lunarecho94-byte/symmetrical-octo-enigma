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
            timer = 16000; // Reset
        }
    }, 1000);
}

// Size Selection
function selectSize(btnElement, sizeValue) {
    const parentContainer = btnElement.closest('.size-options');
    if (!parentContainer) return;

    parentContainer.querySelectorAll('.size-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    // Update size in order form
    const sizeInput = document.getElementById('selectedSize');
    if (sizeInput) {
        sizeInput.value = sizeValue;
    }
}

// Quick Order Product Button
function quickOrderProduct(productName, price) {
    const select = document.getElementById('productSelect');
    if (select) {
        for (let i = 0; i < select.options.length; i++) {
            if (select.options[i].value.includes(productName)) {
                select.selectedIndex = i;
                break;
            }
        }
        updateFormPrice();
    }

    const orderSection = document.getElementById('order-form');
    if (orderSection) {
        orderSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Bundle Offer Selection
function selectBundleOffer() {
    const select = document.getElementById('productSelect');
    if (select) {
        select.selectedIndex = select.options.length - 1; // Select full bundle
        updateFormPrice();
    }

    const orderSection = document.getElementById('order-form');
    if (orderSection) {
        orderSection.scrollIntoView({ behavior: 'smooth' });
    }
}

// Update Price in Checkout Form
function updateFormPrice() {
    const select = document.getElementById('productSelect');
    const priceDisplay = document.getElementById('finalOrderPrice');
    if (!select || !priceDisplay) return;

    const val = select.value;
    if (val.includes('1490')) {
        priceDisplay.textContent = '1 490 грн';
    } else if (val.includes('790')) {
        priceDisplay.textContent = '790 грн';
    } else if (val.includes('1190')) {
        priceDisplay.textContent = '1 190 грн';
    } else if (val.includes('2890')) {
        priceDisplay.textContent = '2 890 грн';
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
    const weight = parseFloat(document.getElementById('userWeight').value) || 75;
    const height = parseFloat(document.getElementById('userHeight').value) || 178;
    const foot = parseFloat(document.getElementById('userFoot').value) || 27;

    let clothing = 'M';
    if (weight > 85 || height > 185) clothing = 'XL';
    else if (weight > 78 || height > 180) clothing = 'L';
    else if (weight < 65 && height < 170) clothing = 'S';

    let shoe = '42 (27см)';
    if (foot >= 29) shoe = '45 (29.5см)';
    else if (foot >= 28.5) shoe = '44 (29см)';
    else if (foot >= 27.5) shoe = '43 (28см)';
    else if (foot >= 26.5) shoe = '42 (27.5см)';
    else if (foot >= 25.5) shoe = '41 (26.5см)';
    else shoe = '40 (26см)';

    document.getElementById('recClothingSize').textContent = clothing;
    document.getElementById('recShoeSize').textContent = shoe;
    document.getElementById('calcResult').classList.remove('hidden');
}

function applyCalculatedSize() {
    const clothing = document.getElementById('recClothingSize').textContent;
    const shoe = document.getElementById('recShoeSize').textContent;

    const sizeInput = document.getElementById('selectedSize');
    if (sizeInput) {
        sizeInput.value = `Взуття: ${shoe}, Одяг: ${clothing}`;
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
    const price = document.getElementById('finalOrderPrice').textContent;

    alert(`🎉 ДЯКУЄМО ЗА ЗАМОВЛЕННЯ, ${name.toUpperCase()}!\n\nВаше замовлення: ${product}\nСума до сплати при отриманні: ${price}\n\nМенеджер зателефонує на номер ${phone} протягом 10 хвилин для підтвердження відправки!`);
}

// Live Purchase Toast Notifications
const toastData = [
    { name: "Олександр з м. Київ", text: "щойно замовив Повний Сет 3-в-1 (2 хв тому)" },
    { name: "Богдан з м. Львів", text: "замовив Кросівки Urban Runner 43 розміру" },
    { name: "Дмитро з м. Дніпро", text: "замовив Футболку District 08 Oversize" },
    { name: "Сергій з м. Одеса", text: "замовив Повний Сет (Отримав шкарпетки в подарунок)" },
    { name: "Андрій з м. Харків", text: "замовив Карго штани Tactical Black L" }
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

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    startTimer(16122); // 4 hours countdown
    setInterval(showPurchaseToast, 9000);
    setTimeout(showPurchaseToast, 3000);
});
