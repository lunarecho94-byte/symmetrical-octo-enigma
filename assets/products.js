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
  {
    slug: 'girlyanda-z-prishchipkami-lu999-4-5m',
    sku: '59140',
    name: 'Гірлянда з прищіпками для фото LU999 4,5 м 20 LED USB',
    short: 'Світлодіодна фотогірлянда з теплим білим світлом, 20 прозорих прищіпок, USB-живлення',
    price: 250,
    oldPrice: 390,
    badge: '✨ Затишок',
    image: '/assets/img/girlyanda-1.webp',
    url: '/products/girlyanda-z-prishchipkami-lu999-4-5m/',
  },
  {
    slug: 'fotopanno-kar296-125-sm-z-prishchipkami',
    sku: '59139',
    name: 'Фотопанно KAR296 125 см з деревʼяними сердечками та прищіпками',
    short: 'Настінний тримач для 9 фотографій 125 см з натурального дерева, сердечками та намистинами',
    price: 300,
    oldPrice: 450,
    badge: '🤍 Деревʼяний декор',
    image: '/assets/img/fotopanno-1.webp',
    url: '/products/fotopanno-kar296-125-sm-z-prishchipkami/',
  },
  {
    slug: 'dispenser-dlya-kharchovoyi-plivki-ta-folgi-26x-409',
    sku: '59040',
    name: 'Диспенсер для харчової плівки та фольги 26X-409 магнітний',
    short: 'Кухонний різак для ідеально рівного нарізання плівки та фольги з вбудованим лезом і магнітним кріпленням',
    price: 499,
    oldPrice: 750,
    badge: '🧲 Магнітний різак',
    image: '/assets/img/dispenser-1.webp',
    url: '/products/dispenser-dlya-kharchovoyi-plivki-ta-folgi-26x-409/',
  },
  {
    slug: 'nabir-led-svichok-ma765-3-sht-z-pultom',
    sku: '59137',
    name: 'Набір LED свічок MA765 3 шт. з пультом та таймером',
    short: 'Електронні свічки 10, 12.5 та 15 см з теплим жовтим світлом, пультом ДК і таймером',
    price: 499,
    oldPrice: 750,
    badge: '🕯️ LED декор',
    image: '/assets/img/candles-1.webp',
    url: '/products/nabir-led-svichok-ma765-3-sht-z-pultom/',
  },
];
