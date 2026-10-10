#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URBAN — Static Site Prerendering & SSR Engine
Generates static, SEO-optimized HTML pages for all products and categories with:
  - Full Schema.org microdata (Product + Offer in UAH, BreadcrumbList, CollectionPage)
  - Dedicated unique <title>, <meta description>, <link rel="canonical">, <meta property="og:image">
  - Transliterated Ukrainian slugs
  - Concrete Ukrainian copy without marketing fluff
  - Zero placeholder reviews, timers, or fake pills
"""

import os
import json
import re
from xml.sax.saxutils import escape

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_DIR, 'data')
PRODUCTS_FILE = os.path.join(DATA_DIR, 'products.json')
META_FILE = os.path.join(DATA_DIR, 'meta.json')
PRODUCT_OUT_DIR = os.path.join(PROJECT_DIR, 'product')
CATEGORY_OUT_DIR = os.path.join(PROJECT_DIR, 'category')
SITEMAP_FILE = os.path.join(PROJECT_DIR, 'sitemap.xml')

os.makedirs(PRODUCT_OUT_DIR, exist_ok=True)
os.makedirs(CATEGORY_OUT_DIR, exist_ok=True)

CYR_MAP = {
    'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye',
    'ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l',
    'м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
    'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'',
    'ю':'yu','я':'ya','ъ':'','ы':'y','э':'e'
}


def generate_product_slug(name, pid):
    s = str(name or '').lower()
    trans = ''.join(CYR_MAP.get(ch, ch) for ch in s)
    clean = re.sub(r'[^a-z0-9]+', '-', trans).strip('-')
    clean_id = str(pid or '').strip()
    if clean and clean_id:
        return f"{clean}-{clean_id}"
    return clean or clean_id or 'product'


def get_subcat_title(subcat):
    titles = {
        'zip_hoodie': 'Зіп-худі Maison Margiela',
        'hoodie': 'Зіп-худі',
        'vest': 'Жіночі жилетки та безрукавки',
        'leggings': 'Жіночі лосини та легінси',
        'winter_jacket': 'Дублянки на хутрі',
        'coat': 'Чоловічі стильні пальто',
        'leather': 'Жіночі косухи',
        'bomber': 'Бомбери',
        'windbreaker': 'Вітровки',
        'jacket': 'Демісезонні жіночі куртки',
        'denim': 'Джинсівки'
    }
    return titles.get(subcat, 'Одяг та верхній одяг')


def build_product_page_html(p, all_products):
    slug = p.get('slug') or generate_product_slug(p['name'], p['id'])
    display_name = p['name']
    price = p['price']
    old_price = p.get('old_price') or 0
    formatted_price = f"{price:,}".replace(',', ' ') + " грн"
    formatted_old_price = f"{old_price:,}".replace(',', ' ') + " грн" if old_price > price else ""
    discount_pct = round(((old_price - price) / old_price) * 100) if old_price > price else 0

    subcat = p.get('subcat') or 'jacket'
    cat_title = get_subcat_title(subcat)
    season_name = p.get('season_name') or 'Демісезон'
    art = p.get('art') or f"#ra{p['id']}"
    mat = p.get('mat') or 'Поліестер / Плащівка'
    in_stock = bool(p.get('in_stock'))
    availability_schema = "https://schema.org/InStock" if in_stock else "https://schema.org/OutOfStock"
    stock_status_text = "В наявності" if in_stock else "Немає в наявності"
    stock_dot_class = "in-stock" if in_stock else "out-of-stock"

    imgs = p.get('imgs') or ['https://urbangrid.com.ua/images/outerwear.webp']
    main_img = imgs[0]

    canonical_url = f"https://urbangrid.com.ua/product/{slug}"
    meta_title = f"{display_name} — Купити за {price} грн | URBAN"
    meta_desc = f"{display_name}. Ціна {price} грн. Матеріал: {mat}. Сезон: {season_name}. Оплата при отриманні накладним платежем, швидка доставка Новою Поштою 1-2 дні по Україні."

    # JSON-LD Schema.org Product with Offer and BreadcrumbList
    product_schema = {
        "@context": "https://schema.org/",
        "@type": "Product",
        "name": display_name,
        "image": imgs,
        "description": meta_desc,
        "sku": art,
        "brand": {
            "@type": "Brand",
            "name": p.get('brand_name') or "URBAN"
        },
        "offers": {
            "@type": "Offer",
            "url": canonical_url,
            "priceCurrency": "UAH",
            "price": str(price),
            "itemCondition": "https://schema.org/NewCondition",
            "availability": availability_schema,
            "seller": {
                "@type": "Organization",
                "name": "URBAN"
            }
        }
    }

    breadcrumb_schema = {
        "@context": "https://schema.org/",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {
                "@type": "ListItem",
                "position": 1,
                "name": "Головна",
                "item": "https://urbangrid.com.ua/"
            },
            {
                "@type": "ListItem",
                "position": 2,
                "name": cat_title,
                "item": f"https://urbangrid.com.ua/?cat={subcat}"
            },
            {
                "@type": "ListItem",
                "position": 3,
                "name": display_name,
                "item": canonical_url
            }
        ]
    }

    # Render thumbnails
    thumbs_html = []
    for idx, img_url in enumerate(imgs):
        active_cls = "active" if idx == 0 else ""
        thumbs_html.append(f'''
            <button type="button" class="pdp-thumb-btn {active_cls}" onclick="pdpSwitchPhoto({idx})" aria-label="Фото {idx + 1}">
                <img src="{img_url}" alt="Фото {idx + 1}" loading="lazy" referrerpolicy="no-referrer">
            </button>
        ''')

    # Render sizes
    sizes = p.get('sizes') or []
    sizes_html = []
    for s in sizes:
        sizes_html.append(f'''
            <button type="button" class="pdp-size-btn" data-size="{escape(s)}" onclick="pdpSelectSize(this, '{escape(s)}')">
                {escape(s)}
            </button>
        ''')

    # Related products
    related = [item for item in all_products if item.get('subcat') == subcat and str(item['id']) != str(p['id']) and item.get('in_stock')][:4]
    related_cards_html = []
    for r in related:
        r_slug = r.get('slug') or generate_product_slug(r['name'], r['id'])
        r_img = r['imgs'][0] if r.get('imgs') else 'https://urbangrid.com.ua/images/outerwear.webp'
        r_price = f"{r['price']:,}".replace(',', ' ') + " грн"
        related_cards_html.append(f'''
            <div class="product-card" id="prod-{r['id']}">
                <a href="/product/{r_slug}" class="want-card-link">
                    <div class="product-img-wrapper" title="{escape(r['name'])}">
                        <img src="{r_img}" alt="{escape(r['name'])}" loading="lazy" referrerpolicy="no-referrer">
                    </div>
                    <div class="product-details">
                        <p class="product-title">{escape(r['name'])}</p>
                        <div class="product-price-row">
                            <span class="price-now">{r_price}</span>
                        </div>
                    </div>
                </a>
            </div>
        ''')

    related_section_html = ""
    if related_cards_html:
        cards_str = ''.join(related_cards_html)
        related_section_html = f'''
            <section class="pdp-recommended-section" id="pdpRecommendedSection" style="display: block;">
                <div class="pdp-rec-header">
                    <h3 class="pdp-rec-title">СХОЖІ МОДЕЛІ</h3>
                    <div class="pdp-rec-line"></div>
                </div>
                <div class="products-grid">
                    {cards_str}
                </div>
            </section>
        '''

    html_content = f'''<!DOCTYPE html>
<html lang="uk">
<head>
    <base href="/">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="referrer" content="strict-origin-when-cross-origin">
    <meta name="format-detection" content="telephone=no">
    <meta name="theme-color" content="#ffffff">
    <title>{escape(meta_title)}</title>
    <meta name="description" content="{escape(meta_desc)}">
    <link rel="canonical" href="{canonical_url}">

    <!-- Open Graph / Social Sharing -->
    <meta property="og:type" content="product">
    <meta property="og:url" content="{canonical_url}">
    <meta property="og:title" content="{escape(display_name)} | URBAN">
    <meta property="og:description" content="{escape(meta_desc)}">
    <meta property="og:image" content="{main_img}">
    <meta property="og:locale" content="uk_UA">
    <meta property="og:site_name" content="URBAN">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{escape(display_name)} | URBAN">
    <meta name="twitter:description" content="{escape(meta_desc)}">
    <meta name="twitter:image" content="{main_img}">

    <!-- Schema.org Microdata (JSON-LD) -->
    <script type="application/ld+json">
{json.dumps(product_schema, ensure_ascii=False, indent=2)}
    </script>
    <script type="application/ld+json">
{json.dumps(breadcrumb_schema, ensure_ascii=False, indent=2)}
    </script>

    <!-- LCP Preload: Main Product Photo -->
    <link rel="preload" as="image" href="{main_img}" fetchpriority="high">

    <!-- Fonts (Non-render-blocking asynchronous load) -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap" media="print" onload="this.media='all'">
    <noscript>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap">
    </noscript>

    <!-- Favicon -->
    <link rel="icon" type="image/png" href="images/urbano_emblem.png">
    <link rel="apple-touch-icon" href="images/urbano_emblem.png">

    <!-- Styles -->
    <link rel="stylesheet" href="style.css?v=8.7">

    <!-- Meta Pixel Code -->
    <script>
    !function(f,b,e,v,n,t,s)
    {{if(f.fbq)return;n=f.fbq=function(){{n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)}};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '1423887033036082');
    fbq('track', 'PageView');
    fbq('track', 'ViewContent', {{
        content_name: '{escape(display_name)}',
        content_category: '{escape(cat_title)}',
        content_ids: ['{p["id"]}'],
        content_type: 'product',
        value: {price},
        currency: 'UAH'
    }});
    </script>
    <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=1423887033036082&ev=PageView&noscript=1"
    /></noscript>
</head>
<body class="pdp-body">

    <!-- Header Navigation -->
    <header class="header">
        <div class="container header-container">
            <div class="header-brand-wrap">
                <a href="/" class="logo urbano-animated-logo" title="URBAN">
                    <div class="logo-mark-box">
                        <img src="images/urbano_emblem.png" alt="URBAN" class="logo-mark-img">
                    </div>
                    <div class="logo-text-box">
                        <span class="logo-text-title">URBAN</span>
                        <span class="logo-text-sub">OUTERWEAR & APPAREL</span>
                    </div>
                </a>
            </div>

            <div class="header-status">
                <span class="status-dot {stock_dot_class}"></span>
                <span>{stock_status_text}</span>
            </div>

            <div class="header-actions">
                <button type="button" class="header-search-btn" onclick="focusSearchInput(event)" aria-label="Пошук у каталозі">
                    <svg class="header-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </button>
                <button type="button" class="header-fav-btn" onclick="openFavoritesDrawer()" aria-label="Обрані товари">
                    <svg class="header-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                    </svg>
                    <span class="fav-badge header-fav-badge" id="headerFavBadge" style="display: none;">0</span>
                </button>
                <button type="button" class="header-cart-btn" onclick="openCart()" aria-label="Кошик покупок">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    <span class="cart-badge header-cart-badge">0</span>
                </button>
            </div>
        </div>
    </header>

    <!-- Main PDP Container -->
    <main class="pdp-section" id="productDetailPage">
        <div class="container">

            <!-- Breadcrumbs -->
            <div class="pdp-breadcrumbs-bar">
                <a href="/" class="pdp-back-link" id="pdpBackLink">
                    ← Назад до каталогу
                </a>
                <nav class="pdp-breadcrumbs" aria-label="Навігація">
                    <a href="/" id="pdpCrumbHome">Головна</a>
                    <span class="sep">/</span>
                    <a href="/?cat={subcat}#catalog" id="pdpCrumbSubcat">{cat_title}</a>
                    <span class="sep">/</span>
                    <span class="curr" id="pdpCrumbTitle">{escape(display_name)}</span>
                </nav>
            </div>

            <!-- Active Product Content (Pre-rendered for instantaneous SEO) -->
            <div id="pdpContent" class="pdp-grid" style="display: grid;">

                <!-- Gallery -->
                <div class="pdp-gallery-wrap">
                    <div class="pdp-gallery-inner">
                        <div class="pdp-thumbs-strip" id="pdpThumbsStrip">
                            {''.join(thumbs_html)}
                        </div>

                        <div class="pdp-main-image-box" id="pdpMainImgBox">
                            {f'<span class="pdp-discount-badge">-{discount_pct}%</span>' if discount_pct > 0 else ''}
                            <img src="{main_img}" alt="{escape(display_name)}" id="pdpMainImg" class="pdp-main-img" fetchpriority="high" loading="eager" width="500" height="650" referrerpolicy="no-referrer">

                            <div class="pdp-gallery-arrows">
                                <button type="button" class="pdp-gallery-nav-btn prev" id="pdpBtnPrev" onclick="pdpGalleryPrev()" aria-label="Попереднє фото">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                </button>
                                <button type="button" class="pdp-gallery-nav-btn next" id="pdpBtnNext" onclick="pdpGalleryNext()" aria-label="Наступне фото">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Info Column -->
                <div class="pdp-info-wrap">

                    <div class="pdp-art-line">
                        <span class="pdp-art-text">АРТИКУЛ: <strong id="pdpArtVal">{escape(art)}</strong></span>
                        <button type="button" class="pdp-art-copy-btn" onclick="pdpCopyArt()" title="Скопіювати артикул">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            <span id="pdpArtCopyHint">копіювати</span>
                        </button>
                    </div>

                    <h1 class="pdp-title" id="pdpTitle">{escape(display_name)}</h1>

                    <div class="pdp-price-row">
                        <span class="pdp-price-now" id="pdpPriceNow">{formatted_price}</span>
                        {f'<span class="pdp-price-old" id="pdpPriceOld">{formatted_old_price}</span>' if formatted_old_price else ''}
                        {f'<span class="pdp-discount-pill">-{discount_pct}%</span>' if discount_pct > 0 else ''}
                    </div>

                    <div class="pdp-divider"></div>

                    <!-- Size Selection -->
                    <div class="pdp-size-block" id="pdpSizeBlock">
                        <div class="pdp-size-title">РОЗМІР</div>
                        <div class="pdp-size-grid" id="pdpSizeGrid">
                            {''.join(sizes_html)}
                        </div>
                        <button type="button" class="pdp-size-guide-link" id="pdpSizeGuideLink" onclick="pdpOpenSizeGuide()">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><line x1="7" y1="5" x2="7" y2="10"/><line x1="12" y1="5" x2="12" y2="8"/><line x1="17" y1="5" x2="17" y2="10"/></svg>
                            <span id="pdpSizeGuideBtnText">Таблиця розмірів</span>
                        </button>
                        <div class="pdp-size-hint" id="pdpSizeHint">Оберіть розмір, щоб додати в кошик</div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="pdp-actions-box">
                        <button type="button" class="btn-pdp-fav-outline" id="btnPdpFav" onclick="pdpToggleFavoriteAction()">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" stroke="#000000" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                            <span id="btnPdpFavText">В ОБРАНЕ</span>
                        </button>

                        <button type="button" class="btn-pdp-buy" id="btnPdpAddToCart" onclick="pdpAddToCartAction()">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                            <span>ДОДАТИ В КОШИК</span>
                        </button>

                        <button type="button" class="btn-pdp-1click" id="btnPdp1Click" onclick="pdpQuickOrderAction()">
                            <span>ШВИДКЕ ЗАМОВЛЕННЯ В 1 КЛІК</span>
                        </button>

                        <div class="pdp-msg-row">
                            <a href="https://t.me/+380974524435" target="_blank" rel="noopener noreferrer" class="btn-pdp-msg tg">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="m20.665 3.717-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l-.313 4.67c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z"/></svg>
                                <span>Telegram</span>
                            </a>
                            <a href="viber://chat?number=%2B380974524435" target="_blank" rel="noopener noreferrer" class="btn-pdp-msg vb">
                                <svg width="18" height="18" viewBox="0 0 512 512" fill="currentColor"><path d="M444.3 49.9c-12.7-11.7-64.1-49-178.7-49.5 0 0-135.1-8.1-200.9 52.3-36.6 36.6-49.5 90.3-50.9 156.8s-3.1 191.1 117 224.9l.1 0-.1 51.6s-.8 20.9 13 25.1c16.6 5.2 26.4-10.7 42.3-27.8 8.7-9.4 20.7-23.2 29.8-33.7 82.2 6.9 145.3-8.9 152.5-11.2 16.6-5.4 110.5-17.4 125.7-142 15.8-128.6-7.6-209.8-49.8-246.5zM458.2 287c-12.9 104-89 110.6-103 115.1-6 1.9-61.5 15.7-131.2 11.2 0 0-52 62.7-68.2 79-5.3 5.3-11.1 4.8-11-5.7 0-6.9 .4-85.7 .4-85.7l0 0C43.4 372.7 49.4 266.6 50.5 211.1s11.6-101 42.6-131.6c55.7-50.5 170.4-43 170.4-43 96.9 .4 143.3 29.6 154.1 39.4 35.7 30.6 53.9 103.8 40.6 211.1zm-139-80.8c.4 8.6-12.5 9.2-12.9 .6-1.1-22-11.4-32.7-32.6-33.9-8.6-.5-7.8-13.4 .7-12.9 27.9 1.5 43.4 17.5 44.8 46.2zm20.3 11.3c1-42.4-25.5-75.6-75.8-79.3-8.5-.6-7.6-13.5 .9-12.9 58 4.2 88.9 44.1 87.8 92.5-.1 8.6-13.1 8.2-12.9-.3zm47 13.4c.1 8.6-12.9 8.7-12.9 .1-.6-81.5-54.9-125.9-120.8-126.4-8.5-.1-8.5-12.9 0-12.9 73.7 .5 133 51.4 133.7 139.2zM375.2 329l0 .2c-10.8 19-31 40-51.8 33.3l-.2-.3c-21.1-5.9-70.8-31.5-102.2-56.5-16.2-12.8-31-27.9-42.4-42.4-10.3-12.9-20.7-28.2-30.8-46.6-21.3-38.5-26-55.7-26-55.7-6.7-20.8 14.2-41 33.3-51.8l.2 0c9.2-4.8 18-3.2 23.9 3.9 0 0 12.4 14.8 17.7 22.1 5 6.8 11.7 17.7 15.2 23.8 6.1 10.9 2.3 22-3.7 26.6l-12 9.6c-6.1 4.9-5.3 14-5.3 14s17.8 67.3 84.3 84.3c0 0 9.1 .8 14-5.3l9.6-12c4.6-6 15.7-9.8 26.6-3.7 14.7 8.3 33.4 21.2 45.8 32.9 7 5.7 8.6 14.4 3.8 23.6z"/></svg>
                                <span>Viber</span>
                            </a>
                        </div>
                    </div>

                    <!-- Characteristics -->
                    <div class="pdp-specs-box">
                        <div class="pdp-specs-title">ХАРАКТЕРИСТИКИ</div>
                        <div class="pdp-specs-list" id="pdpSpecsList">
                            <div class="spec-row"><span class="spec-label">Матеріал:</span> <span class="spec-val"><b>{escape(mat)}</b></span></div>
                            <div class="spec-row"><span class="spec-label">Сезон:</span> <span class="spec-val"><b>{escape(season_name)}</b></span></div>
                            <div class="spec-row"><span class="spec-label">Стан:</span> <span class="spec-val"><b>Новий</b></span></div>
                            <div class="spec-row"><span class="spec-label">Артикул:</span> <span class="spec-val"><b>{escape(art)}</b></span></div>
                        </div>
                    </div>

                    <!-- Concrete Terms & Service -->
                    <div class="pdp-trust-card">
                        <div class="pdp-trust-item">
                            <span class="pdp-trust-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                            </span>
                            <div class="pdp-trust-text">
                                <strong>Доставка Новою Поштою</strong>
                                <span>1-2 дні у відділення або поштомат по Україні</span>
                            </div>
                        </div>
                        <div class="pdp-trust-item">
                            <span class="pdp-trust-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
                            </span>
                            <div class="pdp-trust-text">
                                <strong>Накладений платіж без передплати</strong>
                                <span>Оплата після огляду та примірки при отриманні</span>
                            </div>
                        </div>
                        <div class="pdp-trust-item">
                            <span class="pdp-trust-icon">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
                            </span>
                            <div class="pdp-trust-text">
                                <strong>Обмін та повернення 14 днів</strong>
                                <span>Гарантія відповідно до Закону України «Про захист прав споживачів»</span>
                            </div>
                        </div>
                    </div>

                    <!-- Accordions -->
                    <div class="pdp-accordions">
                        <div class="pdp-acc-item" id="pdpAccDelivery">
                            <button type="button" class="pdp-acc-head" onclick="pdpToggleAccordion(this)">
                                <span>Доставка та оплата</span>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="pdp-acc-body">
                                Відправлення здійснюється Новою Поштою щодня. Термін доставки: 1–2 дні. Оплата при отриманні у відділенні (накладений платіж після огляду) або на банківську карту. Телефон підтримки: +380974524435.
                            </div>
                        </div>
                        <div class="pdp-acc-item" id="pdpAccReturns">
                            <button type="button" class="pdp-acc-head" onclick="pdpToggleAccordion(this)">
                                <span>Обмін та повернення</span>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </button>
                            <div class="pdp-acc-body">
                                Обмін або повернення можливі протягом 14 днів з моменту отримання посилки за умови збереження товарного вигляду та ярликів. Огляд та примірка доступні перед оплатою у відділенні.
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <!-- Related Products -->
            {related_section_html}

        </div>
    </main>

    <!-- Cart Drawer -->
    <div id="cartDrawerOverlay" class="cart-drawer-overlay" onclick="closeCart()"></div>
    <aside id="cartDrawer" class="cart-drawer" aria-label="Кошик товарів" role="dialog" aria-modal="true">
        <div class="cart-drawer-header">
            <button type="button" class="btn-cart-back-step" id="btnCartBackStep" onclick="hideCartCheckoutForm()" style="display:none;" aria-label="Назад до товарів">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
                <span>Назад</span>
            </button>
            <div class="cart-header-title">
                <h3 id="cartDrawerHeading">Кошик</h3>
                <span class="cart-header-count" id="cartDrawerCountWrap">(<span id="cartDrawerTotalCount">0</span>)</span>
            </div>
            <button type="button" class="cart-drawer-close" onclick="closeCart()" aria-label="Закрити кошик">&times;</button>
        </div>

        <!-- VIEW 1: Items List & Cart Footer -->
        <div id="cartViewItems" class="cart-view-container">
            <div id="cartDrawerBody" class="cart-drawer-body">
                <!-- Items rendered dynamically by JS -->
            </div>

            <div id="cartDrawerFooter" class="cart-drawer-footer">
                <div class="cart-summary-line">
                    <span>Загальна сума:</span>
                    <b id="cartDrawerTotalPrice" class="cart-total-price">0 грн</b>
                </div>
                <button type="button" id="btnOpenCartCheckout" class="btn-primary btn-checkout-cart" onclick="showCartCheckoutForm()">
                    ОФОРМИТИ ЗАМОВЛЕННЯ
                </button>
                <div class="cart-msg-quick-row">
                    <span class="cart-msg-quick-title">або через месенджер без дзвінка:</span>
                    <div class="cart-msg-quick-btns">
                        <button type="button" class="btn-cart-msg-pill tg" onclick="checkoutViaMessenger('telegram')" title="Оформити через Telegram"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="m20.665 3.717-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l-.313 4.67c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z"/></svg> <span>Telegram</span></button>
                        <button type="button" class="btn-cart-msg-pill viber" onclick="checkoutViaMessenger('viber')" title="Оформити через Viber"><svg width="20" height="20" viewBox="0 512 512" fill="currentColor"><path d="M444.3 49.9c-12.7-11.7-64.1-49-178.7-49.5 0 0-135.1-8.1-200.9 52.3-36.6 36.6-49.5 90.3-50.9 156.8s-3.1 191.1 117 224.9l.1 0-.1 51.6s-.8 20.9 13 25.1c16.6 5.2 26.4-10.7 42.3-27.8 8.7-9.4 20.7-23.2 29.8-33.7 82.2 6.9 145.3-8.9 152.5-11.2 16.6-5.4 110.5-17.4 125.7-142 15.8-128.6-7.6-209.8-49.8-246.5zM458.2 287c-12.9 104-89 110.6-103 115.1-6 1.9-61.5 15.7-131.2 11.2 0 0-52 62.7-68.2 79-5.3 5.3-11.1 4.8-11-5.7 0-6.9 .4-85.7 .4-85.7l0 0C43.4 372.7 49.4 266.6 50.5 211.1s11.6-101 42.6-131.6c55.7-50.5 170.4-43 170.4-43 96.9 .4 143.3 29.6 154.1 39.4 35.7 30.6 53.9 103.8 40.6 211.1zm-139-80.8c.4 8.6-12.5 9.2-12.9 .6-1.1-22-11.4-32.7-32.6-33.9-8.6-.5-7.8-13.4 .7-12.9 27.9 1.5 43.4 17.5 44.8 46.2zm20.3 11.3c1-42.4-25.5-75.6-75.8-79.3-8.5-.6-7.6-13.5 .9-12.9 58 4.2 88.9 44.1 87.8 92.5-.1 8.6-13.1 8.2-12.9-.3zm47 13.4c.1 8.6-12.9 8.7-12.9 .1-.6-81.5-54.9-125.9-120.8-126.4-8.5-.1-8.5-12.9 0-12.9 73.7 .5 133 51.4 133.7 139.2zM375.2 329l0 .2c-10.8 19-31 40-51.8 33.3l-.2-.3c-21.1-5.9-70.8-31.5-102.2-56.5-16.2-12.8-31-27.9-42.4-42.4-10.3-12.9-20.7-28.2-30.8-46.6-21.3-38.5-26-55.7-26-55.7-6.7-20.8 14.2-41 33.3-51.8l.2 0c9.2-4.8 18-3.2 23.9 3.9 0 0 12.4 14.8 17.7 22.1 5 6.8 11.7 17.7 15.2 23.8 6.1 10.9 2.3 22-3.7 26.6l-12 9.6c-6.1 4.9-5.3 14-5.3 14s17.8 67.3 84.3 84.3c0 0 9.1 .8 14-5.3l9.6-12c4.6-6 15.7-9.8 26.6-3.7 14.7 8.3 33.4 21.2 45.8 32.9 7 5.7 8.6 14.4 3.8 23.6z"/></svg> <span>Viber</span></button>
                    </div>
                </div>
                <button type="button" class="btn-continue-shopping" onclick="closeCart()">
                    ← Продовжити покупки
                </button>
            </div>
        </div>

        <!-- VIEW 2: Clean Dedicated Checkout View -->
        <div id="cartCheckoutFormBox" class="cart-checkout-view" style="display: none;">
            <div id="cartCheckoutMiniSummary" class="cart-checkout-mini-summary"></div>

            <form id="cartDirectCheckoutForm" class="cart-direct-checkout-form" onsubmit="handleCartDirectCheckout(event)">
                <div class="cart-form-section-title">Дані одержувача</div>
                <div class="cart-form-group">
                    <label for="cartFullName">Прізвище та Ім'я:</label>
                    <input type="text" id="cartFullName" class="form-input" placeholder="Олена Петренко" required autocomplete="name">
                </div>
                <div class="cart-form-group">
                    <label for="cartPhone">Номер телефону:</label>
                    <input type="tel" id="cartPhone" class="form-input" placeholder="+38 (067) 123-45-67" required autocomplete="tel" oninput="formatPhoneInput(event)">
                    <div id="cartPhoneError" class="phone-error-hint" style="display: none;"></div>
                </div>

                <div class="cart-form-section-title">Доставка Новою Поштою</div>
                <div class="cart-form-group np-autocomplete-group" style="position: relative;">
                    <label for="npCityInput">Місто отримання:</label>
                    <div class="np-input-wrapper">
                        <span class="np-input-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                        </span>
                        <input type="text" id="npCityInput" class="form-input np-input" placeholder="Введіть місто (напр. Київ, Львів...)" autocomplete="off" required>
                        <button type="button" class="np-clear-btn" id="npCityClearBtn" style="display:none;" title="Очистити">✕</button>
                        <div class="np-loading-spinner" id="npCitySpinner" style="display:none;"></div>
                    </div>
                    <input type="hidden" id="npCityRef" name="NP_City_Ref" value="">
                    <input type="hidden" id="npSettlementRef" name="NP_Settlement_Ref" value="">
                    <input type="hidden" id="npCityName" name="Місто доставки" value="">
                    <div class="np-dropdown-list" id="npCityDropdown" style="display:none;"></div>
                </div>

                <div class="cart-form-group np-autocomplete-group" id="npWarehouseGroup" style="position: relative;">
                    <div class="np-warehouse-header">
                        <label for="npWarehouseInput">Відділення або поштомат:</label>
                        <div class="np-type-filter" id="npWarehouseFilterTabs">
                            <button type="button" class="np-tab active" data-type="all" onclick="filterWarehouseType('all', this)">Всі</button>
                            <button type="button" class="np-tab" data-type="Branch" onclick="filterWarehouseType('Branch', this)">Відділення</button>
                            <button type="button" class="np-tab" data-type="Postomat" onclick="filterWarehouseType('Postomat', this)">Поштомати</button>
                        </div>
                    </div>
                    <div class="np-input-wrapper">
                        <span class="np-input-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                        </span>
                        <input type="text" id="npWarehouseInput" class="form-input np-input" placeholder="Введіть або оберіть відділення / поштомат..." autocomplete="off" required>
                        <button type="button" class="np-clear-btn" id="npWarehouseClearBtn" style="display:none;" title="Очистити">✕</button>
                        <div class="np-loading-spinner" id="npWarehouseSpinner" style="display:none;"></div>
                    </div>
                    <input type="hidden" id="npWarehouseRef" name="NP_Warehouse_Ref" value="">
                    <input type="hidden" id="npWarehouseNum" name="Номер відділення" value="">
                    <input type="hidden" id="cityNP" name="Місто та Відділення НП" value="">
                    <div class="np-dropdown-list" id="npWarehouseDropdown" style="display:none;"></div>
                    <span class="np-helper-hint" id="npWarehouseHint">Почніть вводити номер або вулицю</span>
                </div>

                <div class="cart-form-section-title">Спосіб оплати</div>
                <div class="cart-form-group">
                    <div class="cart-payment-cards">
                        <label class="cart-payment-card active">
                            <input type="radio" name="cartPayment" value="Накладений платіж (при отриманні)" checked onchange="updatePaymentCardState(this)">
                            <div class="payment-card-body">
                                <span class="payment-card-title">Накладений платіж</span>
                                <span class="payment-card-desc">Оплата при отриманні у відділенні після огляду</span>
                            </div>
                        </label>
                        <label class="cart-payment-card">
                            <input type="radio" name="cartPayment" value="Оплата на карту" onchange="updatePaymentCardState(this)">
                            <div class="payment-card-body">
                                <span class="payment-card-title">Оплата на карту</span>
                                <span class="payment-card-desc">Реквізити надішлемо в SMS або месенджер</span>
                            </div>
                        </label>
                    </div>
                </div>

                <button type="submit" id="cartSubmitOrderBtn" class="btn-primary btn-cart-submit-final">
                    ПІДТВЕРДИТИ ЗАМОВЛЕННЯ
                </button>
                <div class="cart-trust-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span>Оплата при отриманні • Швидка відправка 1-2 дні Новою Поштою</span>
                </div>
            </form>
        </div>
    </aside>

    <!-- Size Chart Modal -->
    <div id="sizeChartModal" class="size-chart-modal" style="display: none;" role="dialog" aria-modal="true">
        <div class="size-chart-overlay" onclick="closeSizeChartModal()"></div>
        <div class="size-chart-card">
            <div class="size-chart-head">
                <h3 class="size-chart-title">Таблиця розмірів</h3>
                <button type="button" class="btn-close-modal" onclick="closeSizeChartModal()" aria-label="Закрити">✕</button>
            </div>
            <div class="size-chart-body" style="padding: 16px;">
                <p>Таблиця стандартних розмірів одягу:</p>
                <div class="size-table-container">
                    <table class="size-table">
                        <thead>
                            <tr><th>Розмір</th><th>Зріст</th><th>Обхват грудей</th></tr>
                        </thead>
                        <tbody>
                            <tr><td><b>XS</b></td><td>160–168 см</td><td>82–88 см</td></tr>
                            <tr><td><b>S</b></td><td>165–172 см</td><td>88–94 см</td></tr>
                            <tr><td><b>M</b></td><td>170–178 см</td><td>94–100 см</td></tr>
                            <tr><td><b>L</b></td><td>175–184 см</td><td>100–108 см</td></tr>
                            <tr><td><b>XL</b></td><td>180–190 см</td><td>108–116 см</td></tr>
                            <tr><td><b>XXL</b></td><td>185–195 см</td><td>116–124 см</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="size-chart-foot">
                <button type="button" class="btn-primary" onclick="closeSizeChartModal()">Зрозуміло</button>
            </div>
        </div>
    </div>

    <!-- Quick 1-Click Modal -->
    <div id="quickOrderModalWrapper" class="brand-modal-overlay" style="display:none;" onclick="pdpCloseQuickOrderModal(event)">
        <div class="brand-modal-sheet" onclick="event.stopPropagation()" style="max-width: 480px; margin: auto;">
            <div class="brand-modal-header">
                <div class="brand-modal-title-box">
                    <h3 class="brand-modal-title">Швидке замовлення в 1 клік</h3>
                    <span class="brand-modal-subtitle">Залиште ваш номер — менеджер зв'яжеться для уточнення деталей</span>
                </div>
                <button type="button" class="brand-modal-close" onclick="pdpCloseQuickOrderModal()">✕</button>
            </div>
            <div class="brand-modal-body" style="padding: 20px;">
                <form id="pdpQuickOrderForm" onsubmit="pdpSubmitQuickOrder(event)">
                    <input type="hidden" id="pdpQuickChosenModel" name="Обраний_товар" value="{escape(display_name)}">
                    <div class="cart-form-group">
                        <label for="pdpQuickName">Ваше Ім'я:</label>
                        <input type="text" id="pdpQuickName" class="form-input" placeholder="Олена Петренко" required autocomplete="name">
                    </div>
                    <div class="cart-form-group">
                        <label for="pdpQuickPhone">Номер телефону:</label>
                        <input type="tel" id="pdpQuickPhone" class="form-input" placeholder="+38 (067) 123-45-67" required autocomplete="tel" oninput="formatPhoneInput(event)">
                    </div>
                    <button type="submit" id="btnPdpSubmitQuick" class="btn-primary" style="width: 100%; height: 50px; font-weight: 800; font-size: 15px; margin-top: 10px;">
                        ПІДТВЕРДИТИ ЗАМОВЛЕННЯ
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- Scripts -->
    <script src="script.js?v=11.0" defer></script>
    <script>
    // Pre-populate page context for script.js
    window.currentPdpProduct = {json.dumps(p, ensure_ascii=False)};
    window.pdpCurrentProduct = window.currentPdpProduct;
    </script>
</body>
</html>'''
    return html_content


def main():
    with open(PRODUCTS_FILE, encoding='utf-8') as f:
        products = json.load(f)

    with open(META_FILE, encoding='utf-8') as f:
        meta = json.load(f)

    # Clean old product files to prevent stale products
    if os.path.exists(PRODUCT_OUT_DIR):
        for fname in os.listdir(PRODUCT_OUT_DIR):
            if fname.endswith('.html'):
                os.remove(os.path.join(PRODUCT_OUT_DIR, fname))

    # Clean old category files
    if os.path.exists(CATEGORY_OUT_DIR):
        for fname in os.listdir(CATEGORY_OUT_DIR):
            if fname.endswith('.html'):
                os.remove(os.path.join(CATEGORY_OUT_DIR, fname))

    print(f"Prerendering {len(products)} product pages...")
    rendered_count = 0
    for p in products:
        slug = p.get('slug') or generate_product_slug(p['name'], p['id'])
        out_path = os.path.join(PRODUCT_OUT_DIR, f"{slug}.html")
        html = build_product_page_html(p, products)
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(html)
        rendered_count += 1

    print(f"Successfully generated {rendered_count} prerendered product pages in {PRODUCT_OUT_DIR}!")

    # Generate Category Prerendered Pages
    cat_items = meta.get('categories', [])
    for cat in cat_items:
        cat_slug = cat['slug']
        if cat_slug == 'all':
            continue
        cat_prods = [p for p in products if p.get('subcat') == cat_slug and p.get('in_stock')]
        cat_title = cat['name']
        cat_url = f"https://urbangrid.com.ua/category/{cat_slug}"
        cat_meta_title = f"{cat_title} — Купити в інтернет-магазині | URBAN"
        cat_meta_desc = f"Каталог {cat_title.lower()} в наявності. Оплата при отриманні накладним платежем, швидка доставка Новою Поштою 1-2 дні по Україні."

        cat_schema = {
            "@context": "https://schema.org/",
            "@type": "CollectionPage",
            "name": cat_title,
            "url": cat_url,
            "description": cat_meta_desc
        }

        cards_html = []
        for p in cat_prods[:24]:
            p_slug = p.get('slug') or generate_product_slug(p['name'], p['id'])
            p_img = p['imgs'][0] if p.get('imgs') else 'https://urbangrid.com.ua/images/outerwear.webp'
            p_price = f"{p['price']:,}".replace(',', ' ') + " грн"
            cards_html.append(f'''
                <div class="product-card" id="prod-{p['id']}">
                    <a href="/product/{p_slug}" class="want-card-link">
                        <div class="product-img-wrapper" title="{escape(p['name'])}">
                            <img src="{p_img}" alt="{escape(p['name'])}" loading="lazy" referrerpolicy="no-referrer">
                        </div>
                        <div class="product-details">
                            <p class="product-title">{escape(p['name'])}</p>
                            <div class="product-price-row">
                                <span class="price-now">{p_price}</span>
                            </div>
                        </div>
                    </a>
                </div>
            ''')

        cat_html = f'''<!DOCTYPE html>
<html lang="uk">
<head>
    <base href="/">
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>{escape(cat_meta_title)}</title>
    <meta name="description" content="{escape(cat_meta_desc)}">
    <link rel="canonical" href="{cat_url}">
    <link rel="stylesheet" href="style.css?v=8.6">
    <script type="application/ld+json">
{json.dumps(cat_schema, ensure_ascii=False, indent=2)}
    </script>
</head>
<body>
    <header class="header">
        <div class="container header-container">
            <a href="/" class="logo">URBAN</a>
        </div>
    </header>
    <main class="container" style="padding-top: 30px;">
        <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 20px;">{escape(cat_title)}</h1>
        <div class="products-grid">
            {''.join(cards_html)}
        </div>
    </main>
    <script src="script.js?v=11.0" defer></script>
</body>
</html>'''
        cat_file = os.path.join(CATEGORY_OUT_DIR, f"{cat_slug}.html")
        with open(cat_file, 'w', encoding='utf-8') as f:
            f.write(cat_html)

    # Fallback redirects for root /category and /product folders
    with open(os.path.join(CATEGORY_OUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write('<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=/"><title>URBAN</title></head><body><script>window.location.replace("/");</script></body></html>')

    with open(os.path.join(PRODUCT_OUT_DIR, 'index.html'), 'w', encoding='utf-8') as f:
        f.write('<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"><meta http-equiv="refresh" content="0; url=/"><title>URBAN</title></head><body><script>window.location.replace("/");</script></body></html>')

    print(f"Generated category pages in {CATEGORY_OUT_DIR}")

    # Prerender product cards directly into index.html
    prerender_index_catalog(products)

    # Generate sitemap strictly matching items for sale
    in_stock_prods = [p for p in products if p.get('in_stock')]
    sitemap_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for p in in_stock_prods:
        sitemap_lines.append(f'  <url><loc>https://urbangrid.com.ua/product/{p["slug"]}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>')
    sitemap_lines.append('</urlset>')

    with open(SITEMAP_FILE, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sitemap_lines) + '\n')

    print(f"Sitemap updated: {len(in_stock_prods)} URLs (matches products for sale).")


def prerender_index_catalog(products):
    index_file = os.path.join(PROJECT_DIR, 'index.html')
    if not os.path.exists(index_file):
        return

    with open(index_file, 'r', encoding='utf-8') as f:
        html = f.read()

    cards_html = []
    for idx, p in enumerate(products):
        slug = p.get('slug') or generate_product_slug(p['name'], p['id'])
        img = p['imgs'][0] if p.get('imgs') else 'https://urbangrid.com.ua/images/outerwear.webp'
        price_str = f"{p['price']:,}".replace(',', ' ') + " грн."
        old_price_str = f"{p['old_price']:,}".replace(',', ' ') + " грн." if p.get('old_price') and p['old_price'] > p['price'] else ""
        sizes_str = ', '.join(p.get('sizes', []))
        is_lcp = (idx == 0)
        priority_attrs = 'fetchpriority="high" loading="eager"' if is_lcp else ('loading="eager"' if idx < 4 else 'loading="lazy"')
        name_esc = escape(p['name'])
        
        cards_html.append(f'''
                <div class="product-card" id="prod-{p['id']}" data-brand="{escape(p.get('brand',''))}" data-category="{escape(p.get('cat',''))}" data-price="{p['price']}" data-name="{name_esc}" data-art="{escape(p.get('art',''))}" data-id="{p['id']}">
                    <a href="/product/{slug}" class="want-card-link" onclick="openProductPage('{p['id']}', event, '/product/{slug}', false)">
                        <div class="product-img-wrapper" title="{name_esc}">
                            <button type="button" class="btn-card-fav" data-id="{p['id']}" onclick="toggleFavorite('{p['id']}', event)" aria-label="Додати в обране" title="Додати в обране">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff" stroke="#000000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"/>
                                </svg>
                            </button>
                            <img src="{img}" alt="{name_esc}" id="cardImg-{p['id']}" {priority_attrs} width="275" height="360" decoding="async" referrerpolicy="no-referrer">
                        </div>
                        <div class="product-details">
                            <p class="product-title" title="{name_esc}">{name_esc}</p>
                            <p class="product-sizes-text" title="Розміри: {sizes_str}">{sizes_str}</p>
                            <div class="product-price-row">
                                {f'<span class="price-old">{old_price_str}</span>' if old_price_str else ''}
                                <span class="price-now">{price_str}</span>
                            </div>
                        </div>
                    </a>
                </div>''')

    all_cards_str = '\n'.join(cards_html)

    # Replace .products-grid content
    pattern = re.compile(r'(<div class="products-grid">\s*<div id="noSearchResultsBox".*?</div>\s*)(?:<div class="card-skeleton">.*?</div>\s*|<div class="product-card".*?</div>\s*)*', re.DOTALL)
    if pattern.search(html):
        new_grid_content = r'\1' + all_cards_str + '\n            '
        html = pattern.sub(new_grid_content, html, count=1)
    else:
        html = re.sub(
            r'(<div class="products-grid">)(.*?)(</div>\s*<!-- Catalog Pagination)',
            r'\1\n' + all_cards_str + r'\n            \3',
            html,
            flags=re.DOTALL
        )

    # Update progress info and count
    html = re.sub(r'<span id="catalogShowingCount">.*?</span>', f'<span id="catalogShowingCount">Показано {len(products)} з {len(products)} моделей</span>', html)
    html = re.sub(r'<div class="catalog-progress-fill"[^>]*>', '<div class="catalog-progress-fill" id="catalogProgressFill" style="width: 100%;">', html)
    html = re.sub(r'<p class="catalog-models-count"[^>]*>.*?</p>', f'<p class="catalog-models-count" id="catalogModelsCount">Знайдено {len(products)} моделей у наявності</p>', html)

    with open(index_file, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Prerendered {len(products)} product cards directly into index.html!")


if __name__ == '__main__':
    main()
