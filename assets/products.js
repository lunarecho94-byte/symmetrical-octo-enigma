/* ==========================================================
   КАТАЛОГ ТОВАРІВ HomeNest UA
   Один блок = один товар. З цього списку автоматично будуються
   головна сторінка (каталог), блок «Дивіться також» і кошик.

   slug     — коротка унікальна назва латиницею (= папка сторінки в /products/)
   sku      — артикул постачальника
   name     — назва товару
   short    — 1 рядок про головні переваги (показується в картці)
   price    — ціна продажу, грн
   oldPrice — стара ціна, грн (лише якщо справді була; інакше null)
   badge    — коротка позначка на фото (необовʼязково)
   image    — посилання на головне фото
   url      — адреса сторінки товару
   ========================================================== */
window.PRODUCTS = [
  {
    slug: 'nichnik-proyektor-astronavt-bluetooth',
    sku: '59192',
    name: 'Нічник-проєктор зоряного неба Астронавт Bluetooth',
    short: 'Проєкція зірок та туманності, Bluetooth-колонка, пульт ДК, обертання 360°',
    price: 500,
    oldPrice: 750,
    badge: '✨ Хіт продажу',
    image: '/assets/img/astronavt-1.webp',
    url: '/products/nichnik-proyektor-astronavt-bluetooth/',
  },
  {
    slug: 'stelazh-nad-pralnoyu-mashynoyu-3-polytsi',
    sku: '59190',
    name: 'Стелаж над пральною машиною 3 полиці чорний',
    short: 'Підлогова стійка-органайзер 72×25×155 см із нержавіючої сталі над пральною машиною та унітазом',
    price: 490,
    oldPrice: 720,
    badge: '🧺 Органайзер',
    image: '/assets/img/stelazh-1.webp',
    url: '/products/stelazh-nad-pralnoyu-mashynoyu-3-polytsi/',
  },
];
