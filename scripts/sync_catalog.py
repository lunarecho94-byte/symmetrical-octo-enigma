#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URBAN — Catalog Synchronization Engine
Synchronizes products from MyDrop:
  1. Ro&Go Drop (Vendor ID: 26510, Category: 144063) — Maison Margiela zip-hoodies (28 items)
  2. R.A drop (Vendor ID: 2473, Category: 139443) — Women's outerwear in stock (8 items)
Generates:
  - data/products.json
  - data/meta.json
  - feed.xml
  - sitemap.xml
"""

import os
import sys
import json
import re
import time
import ssl
import argparse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from collections import Counter
from xml.sax.saxutils import escape

PROJECT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(PROJECT_DIR, 'data')
OUTPUT_PRODUCTS = os.path.join(DATA_DIR, 'products.json')
OUTPUT_META = os.path.join(DATA_DIR, 'meta.json')
OUTPUT_FEED = os.path.join(PROJECT_DIR, 'feed.xml')
OUTPUT_SITEMAP = os.path.join(PROJECT_DIR, 'sitemap.xml')

VENDOR_ROGO = 26510
CAT_ROGO_HOODIES = 144063

VENDOR_RA = 2473
CAT_RA_OUTERWEAR = 139443

BACKEND_BASE_URL = 'https://backend.mydrop.com.ua/dropshipper'

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
}

CYR_MAP = {
    'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye',
    'ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l',
    'м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u',
    'ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'',
    'ю':'yu','я':'ya','ъ':'','ы':'y','э':'e'
}


def slugify(text):
    s = str(text or '').lower()
    trans = ''.join(CYR_MAP.get(ch, ch) for ch in s)
    clean = re.sub(r'[^a-z0-9]+', '-', trans).strip('-')
    return clean


def fetch_category_products(category_id, vendor_id):
    """Fetches all products for the target category from MyDrop."""
    all_products = []
    print(f"Fetching products for vendor {vendor_id}, category {category_id}...")
    for page in range(1, 10):
        url = f"{BACKEND_BASE_URL}/vendors/{vendor_id}/products?categoryId={category_id}&page={page}&perPage=100"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                results = data.get('results', [])
                if not results:
                    break
                all_products.extend(results)
                print(f"  Page {page}: {len(results)} items (Total: {len(all_products)})")
                if len(results) < 100:
                    break
        except Exception as e:
            print(f"  Error fetching page {page}: {e}")
            break
    print(f"Total category products fetched: {len(all_products)}")
    return all_products


def fetch_product_details(products, vendor_id):
    """Fetches full product details concurrently."""
    print(f"Fetching full product details for vendor {vendor_id} ({len(products)} items)...")

    def fetch_single(p):
        pid = p['id']
        url = f"{BACKEND_BASE_URL}/vendors/{vendor_id}/products/{pid}"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                detail = json.loads(resp.read().decode('utf-8'))
                return detail
        except Exception as e:
            print(f"  Warning: could not fetch details for ID {pid}: {e}")
            return p

    start_time = time.time()
    with ThreadPoolExecutor(max_workers=10) as executor:
        detailed_products = list(executor.map(fetch_single, products))

    duration = time.time() - start_time
    print(f"Completed details fetch in {duration:.2f} seconds.")
    return detailed_products


def transform_rogo_hoodie(p):
    """Transforms a Ro&Go Drop Maison Margiela zip-hoodie."""
    pid = str(p['id'])
    sku = (p.get('sku') or f"ZMM{pid}").strip().upper()

    # Extract color from params
    color = ''
    for param in p.get('params', []):
        if (param.get('title') or '').strip().lower() == 'колір':
            color = (param.get('value') or '').strip()
            break
    if not color:
        t_low = (p.get('title') or '').lower()
        if 'чорн' in t_low: color = 'Чорний'
        elif 'сір' in t_low: color = 'Сірий'
        elif 'біл' in t_low: color = 'Білий'

    title = f"Зіп-худі Maison Margiela {sku} ({color})" if color else f"Зіп-худі Maison Margiela {sku}"

    drop_price = int(float(p.get('dropPrice') or 1150))
    price = int(round(drop_price * 1.25 / 10) * 10)
    old_price = int(round(price * 1.25 / 10) * 10)

    mat = '95% Бавовна / 5% Поліестер (петля)'
    season = 'demi'
    season_name = 'Демісезон'
    gender = 'unisex'
    brand = 'maison_margiela'
    brand_name = 'Maison Margiela'
    cat = 'clothing'
    subcat = 'zip_hoodie'
    cat_name = 'Одяг & Зіп-худі'
    origin = 'Фабричне виробництво'
    badge = f"{color} • DTF друк" if color else 'DTF друк'

    raw_desc = p.get('description') or ''
    clean_lines = []
    for line in raw_desc.split('\n'):
        line_str = re.sub(r'[\U00010000-\U0010ffff\u2000-\u3300]', '', line).strip()
        if line_str:
            clean_lines.append(line_str)
    desc = '\n'.join(clean_lines) if clean_lines else (
        "Комфортне зіп-худі Maison Margiela вільного крою. "
        "М'яка тканина тринитка петля (95% бавовна / 5% поліестер), якісна повноцінна блискавка, "
        "зручний капюшон та зносостійкий DTF друк."
    )

    imgs = []
    if p.get('images'):
        for img in p['images']:
            if img.get('filename') and not img.get('deleted'):
                imgs.append(f"https://backend.mydrop.com.ua/vendor/products/uploads/{img['filename']}")
    if not imgs and p.get('titleImage') and p['titleImage'].get('filename'):
        imgs.append(f"https://backend.mydrop.com.ua/vendor/products/uploads/{p['titleImage']['filename']}")

    avail_sizes = [s['title'].strip() for s in p.get('sizes', []) if s.get('availableDropshipper')]
    all_sizes = [s['title'].strip() for s in p.get('sizes', [])]
    sizes = avail_sizes if avail_sizes else all_sizes

    slug = f"zip-khudi-maison-margiela-{sku.lower()}-{pid}"

    return {
        'id': str(pid),
        'slug': slug,
        'name': title,
        'price': price,
        'old_price': old_price,
        'cost_price': drop_price,
        'cat': cat,
        'subcat': subcat,
        'cat_name': cat_name,
        'season': season,
        'season_name': season_name,
        'brand': brand,
        'brand_name': brand_name,
        'gender': gender,
        'art': sku,
        'color': color,
        'mat': mat,
        'origin': origin,
        'badge': badge,
        'desc': desc,
        'imgs': imgs,
        'sizes': sizes,
        'in_stock': len(avail_sizes) > 0
    }


def transform_ra_product(p):
    """Transforms an R.A drop women's outerwear product."""
    pid = str(p['id'])
    raw_title = (p.get('title') or '').strip()
    sku = (p.get('sku') or f"RA{pid}").strip()
    title_lower = raw_title.lower()

    drop_price = int(float(p.get('dropPrice') or 0))
    raw_price = p.get('price')
    if raw_price:
        price = int(float(raw_price))
    else:
        price = int(round(drop_price * 1.25 / 10) * 10)
    old_price = int(round(price * 1.25 / 10) * 10)

    # Color extraction
    color = ''
    if 'лавандов' in title_lower: color = 'Світло-лавандовий'
    elif 'графіт' in title_lower: color = 'Графіт'
    elif 'чорн' in title_lower: color = 'Чорний'
    elif 'сір' in title_lower: color = 'Сірий'
    elif 'біл' in title_lower or 'молоч' in title_lower: color = 'Молочний'

    # Subcategory & metadata classification
    if 'дублянк' in title_lower:
        subcat = 'winter_jacket'
        cat_name = 'Одяг & Дублянки'
        season = 'winter'
        season_name = 'Зима'
        mat = 'Штучна шкіра / Штучне хутро'
        badge = 'На хутрі • Дублянка'
        title = f"Куртка-дублянка на хутрі {sku}"
    elif 'косух' in title_lower:
        subcat = 'leather'
        cat_name = 'Одяг & Косухи'
        if 'хутр' in title_lower:
            season = 'winter'
            season_name = 'Зима / Демісезон'
            mat = "М'яка еко-шкіра / Штучне хутро"
            badge = 'На хутрі • Еко-шкіра'
            title = f"Жіноча куртка косуха на хутрі {sku}"
        else:
            season = 'demi'
            season_name = 'Демісезон'
            mat = "М'яка еко-шкіра"
            badge = f"{color} • Еко-шкіра" if color else 'Еко-шкіра'
            title = f"Жіноча куртка косуха {sku} ({color})" if color else f"Жіноча куртка косуха {sku}"
    else:
        subcat = 'jacket'
        cat_name = 'Одяг & Куртки'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Плащівка матова (100% поліестер) / Синтепон 200'
        badge = f"{color} • Демісезон" if color else 'Демісезон'
        if 'резинк' in title_lower:
            title = f"Утеплена жіноча куртка пояс-резинка {sku} ({color})" if color else f"Утеплена жіноча куртка {sku}"
        elif 'коротк' in title_lower:
            title = f"Утеплена жіноча коротка куртка з капюшоном {sku}"
        else:
            title = f"Утеплена жіноча куртка {sku} ({color})" if color else f"Утеплена жіноча куртка {sku}"

    # Clean description
    raw_desc = p.get('description') or ''
    clean_lines = []
    for line in raw_desc.split('\n'):
        line_clean = re.sub(r'[\U00010000-\U0010ffff\u2000-\u3300]', '', line).strip()
        line_clean = re.sub(r'^[•\-\*\s]+', '', line_clean).strip()
        if line_clean and not any(line_clean.lower().startswith(x) for x in ['артикул:', 'розміри:']):
            clean_lines.append(line_clean)
    desc = '\n'.join(clean_lines) if clean_lines else (
        f"{title}. Якісний матеріал ({mat}), зручний крій, надійні кишені на застібках."
    )

    imgs = []
    if p.get('images'):
        for img in p['images']:
            if img.get('filename') and not img.get('deleted'):
                imgs.append(f"https://backend.mydrop.com.ua/vendor/products/uploads/{img['filename']}")
    if not imgs and p.get('titleImage') and p['titleImage'].get('filename'):
        imgs.append(f"https://backend.mydrop.com.ua/vendor/products/uploads/{p['titleImage']['filename']}")

    avail_sizes = [s['title'].strip() for s in p.get('sizes', []) if s.get('availableDropshipper')]
    all_sizes = [s['title'].strip() for s in p.get('sizes', [])]
    sizes = avail_sizes if avail_sizes else all_sizes

    slug = f"{slugify(title)}-{pid}"

    return {
        'id': str(pid),
        'slug': slug,
        'name': title,
        'price': price,
        'old_price': old_price,
        'cost_price': drop_price,
        'cat': 'clothing',
        'subcat': subcat,
        'cat_name': cat_name,
        'season': season,
        'season_name': season_name,
        'brand': 'urban',
        'brand_name': 'URBAN',
        'gender': 'women',
        'art': sku,
        'color': color,
        'mat': mat,
        'origin': 'Фабричне виробництво (Китай)',
        'badge': badge,
        'desc': desc,
        'imgs': imgs,
        'sizes': sizes,
        'in_stock': len(avail_sizes) > 0
    }


def main():
    parser = argparse.ArgumentParser(description="Synchronize MyDrop outerwear catalog.")
    parser.add_argument('--download', action='store_true', help="Download fresh catalog from supplier API")
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Fetch Ro&Go Drop Maison Margiela zip-hoodies
    raw_rogo = fetch_category_products(CAT_ROGO_HOODIES, VENDOR_ROGO)
    detailed_rogo = fetch_product_details(raw_rogo, VENDOR_ROGO) if raw_rogo else []
    rogo_products = [transform_rogo_hoodie(p) for p in detailed_rogo]

    # 2. Fetch R.A drop women's outerwear (filter only in-stock with available sizes)
    raw_ra = fetch_category_products(CAT_RA_OUTERWEAR, VENDOR_RA)
    in_stock_ra_raw = [r for r in raw_ra if any(s.get('availableDropshipper') for s in r.get('sizes', []))]
    detailed_ra = fetch_product_details(in_stock_ra_raw, VENDOR_RA) if in_stock_ra_raw else []
    ra_products = [transform_ra_product(p) for p in detailed_ra]

    print(f"Fetched {len(rogo_products)} Ro&Go hoodies and {len(ra_products)} R.A drop in-stock outerwear items.")

    if len(rogo_products) < 5:
        print(f"Safety guard triggered: Ro&Go fetched only {len(rogo_products)} products. Aborting.")
        return

    # Sort Ro&Go hoodies by SKU
    def sku_num(p):
        m = re.search(r'\d+', p.get('art', ''))
        return int(m.group()) if m else 9999

    rogo_products.sort(key=sku_num)

    # Sort R.A drop items by subcat/id: jackets, leather, winter_jacket
    subcat_order = {'jacket': 1, 'leather': 2, 'winter_jacket': 3}
    ra_products.sort(key=lambda p: (subcat_order.get(p.get('subcat'), 9), p.get('price', 0)))

    # Combine: R.A drop women's outerwear first, followed by Ro&Go zip-hoodies
    products = ra_products + rogo_products

    print(f"Total catalog products: {len(products)}")

    # Save data/products.json
    with open(OUTPUT_PRODUCTS, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Saved {OUTPUT_PRODUCTS} ({os.path.getsize(OUTPUT_PRODUCTS)} bytes, {len(products)} products)")

    # 4. Generate data/meta.json
    women_count = sum(1 for p in products if p['gender'] in ('women', 'unisex'))
    men_count = sum(1 for p in products if p['gender'] in ('men', 'unisex'))

    subcat_counts = Counter(p['subcat'] for p in products)
    season_counts = Counter(p['season'] for p in products)
    brand_counts = Counter(p['brand'] for p in products)

    meta = {
        'total': len(products),
        'genders': [
            {'slug': 'all', 'name': 'Всі товари', 'icon': '', 'count': len(products)},
            {'slug': 'women', 'name': 'Жіночі', 'icon': '', 'count': women_count},
            {'slug': 'men', 'name': 'Чоловічі', 'icon': '', 'count': men_count},
        ],
        'categories': [
            {'slug': 'all', 'name': 'Всі моделі', 'icon': '', 'count': len(products)},
            {'slug': 'jacket', 'name': 'Демісезонні жіночі куртки', 'icon': '', 'count': subcat_counts.get('jacket', 0)},
            {'slug': 'leather', 'name': 'Жіночі косухи', 'icon': '', 'count': subcat_counts.get('leather', 0)},
            {'slug': 'winter_jacket', 'name': 'Дублянки на хутрі', 'icon': '', 'count': subcat_counts.get('winter_jacket', 0)},
            {'slug': 'zip_hoodie', 'name': 'Зіп-худі Maison Margiela', 'icon': '', 'count': subcat_counts.get('zip_hoodie', 0)},
        ],
        'seasons': [
            {'slug': 'all', 'name': 'Всі сезони', 'icon': '', 'count': len(products)},
            {'slug': 'demi', 'name': 'Демісезон', 'icon': '', 'count': season_counts.get('demi', 0)},
            {'slug': 'winter', 'name': 'Зима / Хутро', 'icon': '', 'count': season_counts.get('winter', 0)},
        ],
        'brands': [
            {'slug': 'all', 'name': 'Всі бренди', 'count': len(products)},
            {'slug': 'urban', 'name': 'URBAN', 'count': brand_counts.get('urban', 0)},
            {'slug': 'maison_margiela', 'name': 'Maison Margiela', 'count': brand_counts.get('maison_margiela', 0)},
        ]
    }

    with open(OUTPUT_META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Saved {OUTPUT_META} with {len(meta['categories'])} categories and {len(meta['brands'])} brands")

    # 5. Generate feed.xml
    feed_items = products
    feed_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
        '  <channel>',
        '    <title>URBAN — Одяг та верхній одяг</title>',
        '    <link>https://urbangrid.com.ua</link>',
        '    <description>Каталог жіночого верхнього одягу та зіп-худі Maison Margiela від URBAN. Швидка доставка Новою Поштою по Україні.</description>'
    ]

    for p in feed_items:
        desc_parts = [p['name']]
        if p.get('mat'): desc_parts.append(f"Матеріал: {p['mat']}")
        if p.get('sizes'): desc_parts.append(f"Розміри: {', '.join(p['sizes'][:6])}")
        desc_parts.append(f"Арт: {p['art']}")
        desc_str = ' • '.join(desc_parts)

        main_img = p['imgs'][0] if p.get('imgs') else 'https://urbangrid.com.ua/images/outerwear.webp'

        if p['subcat'] == 'zip_hoodie':
            prod_type = 'Одяг &gt; Толстовки та худі &gt; Зіп-худі'
        elif p['subcat'] == 'leather':
            prod_type = 'Одяг &gt; Верхній одяг &gt; Жіночі косухи'
        elif p['subcat'] == 'winter_jacket':
            prod_type = 'Одяг &gt; Верхній одяг &gt; Дублянки'
        else:
            prod_type = 'Одяг &gt; Верхній одяг &gt; Демісезонні куртки'

        feed_xml_lines.extend([
            '    <item>',
            f'      <g:id>prod-{p["id"]}</g:id>',
            f'      <title>{escape(p["name"])}</title>',
            f'      <description>{escape(desc_str)}</description>',
            f'      <link>https://urbangrid.com.ua/product/{p["slug"]}</link>',
            f'      <g:image_link>{main_img}</g:image_link>',
            f'      <g:brand>{escape(p["brand_name"])}</g:brand>',
            f'      <g:gender>{escape(p["gender"])}</g:gender>',
            '      <g:age_group>adult</g:age_group>',
            '      <g:condition>new</g:condition>',
            '      <g:availability>in_stock</g:availability>',
            f'      <g:price>{p["price"]} UAH</g:price>',
            '      <g:google_product_category>212</g:google_product_category>',
            f'      <g:product_type>{prod_type}</g:product_type>',
            '      <g:shipping>',
            '        <g:country>UA</g:country>',
            '        <g:service>Нова Пошта</g:service>',
            '        <g:price>80 UAH</g:price>',
            '      </g:shipping>',
            '    </item>'
        ])

    feed_xml_lines.extend([
        '  </channel>',
        '</rss>'
    ])

    with open(OUTPUT_FEED, 'w', encoding='utf-8') as f:
        f.write('\n'.join(feed_xml_lines) + '\n')
    print(f"Saved {OUTPUT_FEED} with {len(feed_items)} items")

    # 6. Generate sitemap.xml strictly for in-stock products
    in_stock_products = [p for p in products if p.get('in_stock')]
    sitemap_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for p in in_stock_products:
        sitemap_lines.append(f'  <url><loc>https://urbangrid.com.ua/product/{p["slug"]}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>')
    sitemap_lines.append('</urlset>')

    with open(OUTPUT_SITEMAP, 'w', encoding='utf-8') as f:
        f.write('\n'.join(sitemap_lines) + '\n')
    print(f"Saved {OUTPUT_SITEMAP} with {len(in_stock_products)} URLs")


if __name__ == '__main__':
    main()
