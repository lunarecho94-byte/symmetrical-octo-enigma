/* ==========================================================
   КАТАЛОГ ТОВАРІВ WarmHome UA
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
    slug: 'obigrivach-kamin-900',
    sku: '24433188',
    name: 'Керамічний обігрівач з ефектом каміна 900 Вт',
    short: 'Ефект живого полумʼя, 3 режими, захист від перегріву',
    price: 1599,
    oldPrice: 2190,
    badge: '🔥 Хіт сезону',
    image: 'https://dropt.in.ua/image/cache/catalog/elektrychnyy-obihrivach-z-efektom-kamina-900-vt-bilyy-kerami-19184_3-1000x1000.webp',
    url: '/products/obigrivach-kamin-900/',
  },
  {
    slug: 'obigrivach-ptc-ph16',
    sku: '59191',
    name: 'Підлоговий обігрівач PTC-PH16 2000 Вт з пультом',
    short: 'До 20 м², термостат, таймер 12 год, пульт ДК',
    price: 2500,
    oldPrice: null,
    badge: '2000 Вт',
    image: '/assets/img/ph16-main-600.webp',
    url: '/products/obigrivach-ptc-ph16/',
  },
  {
    slug: 'teploventilyator-domotec-ms-5963',
    sku: '59173',
    name: 'Настінний тепловентилятор DOMOTEC MS-5963 2000 Вт із сушаркою',
    short: 'Сушарка для рушників, пульт ДК, термостат, таймер 8 год',
    price: 1400,
    oldPrice: null,
    badge: 'На стіну',
    image: '/assets/img/domotec-main-600.webp',
    url: '/products/teploventilyator-domotec-ms-5963/',
  },
  {
    slug: 'elektrokamin-flame-heater',
    sku: '59149',
    name: 'Електрокамін Flame Heater з ефектом полумʼя і пультом',
    short: 'Ефект полумʼя, 500–800 Вт, термостат, таймер 12 год',
    price: 3200,
    oldPrice: null,
    badge: '🔥 Ефект полумʼя',
    image: '/assets/img/flame-heater-main-600.webp',
    url: '/products/elektrokamin-flame-heater/',
  },
  {
    slug: 'konvektor-mh-20k',
    sku: '59148',
    name: 'Конвектор MH-20K 2000 Вт з термостатом',
    short: 'До 20 м², 2 режими 1200/2000 Вт, без вентилятора, на колесах',
    price: 2700,
    oldPrice: null,
    badge: 'Без вентилятора',
    image: '/assets/img/mh20k-main-600.webp',
    url: '/products/konvektor-mh-20k/',
  },
  {
    slug: 'mini-obigrivach-zodiak-dragon',
    sku: '59120',
    name: 'Міні-обігрівач Zodiak Dragon 800 Вт',
    short: 'Компактний 16×9×12 см, 2 режими, захист від перегріву',
    price: 800,
    oldPrice: null,
    badge: 'Міні · 800 Вт',
    image: '/assets/img/zodiak-dragon-main-600.webp',
    url: '/products/mini-obigrivach-zodiak-dragon/',
  },
  {
    slug: 'obigrivach-tower-heat',
    sku: '59050',
    name: 'Керамічний обігрівач Tower Heat 2000 Вт',
    short: 'До 20 м², 3 режими, таймер, захист від перегріву і перекидання',
    price: 1500,
    oldPrice: null,
    badge: 'Колона · 2000 Вт',
    image: '/assets/img/tower-heat-main-600.webp',
    url: '/products/obigrivach-tower-heat/',
  },
];
