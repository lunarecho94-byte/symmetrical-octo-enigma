#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URBAN — Catalog Synchronization Engine
Manages products imported strictly from user-provided URLs/sources with automatic 25% markup.
Sources are stored in data/sources.json.
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
OUTPUT_SOURCES = os.path.join(DATA_DIR, 'sources.json')
OUTPUT_FEED = os.path.join(PROJECT_DIR, 'feed.xml')
OUTPUT_SITEMAP = os.path.join(PROJECT_DIR, 'sitemap.xml')

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
    return clean or 'product'


def load_sources():
    if os.path.exists(OUTPUT_SOURCES):
        try:
            with open(OUTPUT_SOURCES, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning loading sources: {e}")
    return []


def save_sources(sources):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(OUTPUT_SOURCES, 'w', encoding='utf-8') as f:
        json.dump(sources, f, ensure_ascii=False, indent=2)


def resolve_vendor_id(vendor_slug_or_id):
    s = str(vendor_slug_or_id).strip()
    if s.isdigit():
        return int(s)
    url = f"{BACKEND_BASE_URL}/vendors/join/{s}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('id')
    except Exception as e:
        print(f"Error resolving vendor '{s}': {e}")
        return None


def fetch_mydrop_product(vendor_id, product_id):
    url = f"{BACKEND_BASE_URL}/vendors/{vendor_id}/products/{product_id}"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching product {product_id} (vendor {vendor_id}): {e}")
        return None


def fetch_mydrop_category_products(vendor_id, category_id):
    all_products = []
    print(f"Fetching products for vendor {vendor_id}, category {category_id}...")
    for page in range(1, 20):
        url = f"{BACKEND_BASE_URL}/vendors/{vendor_id}/products?categoryId={category_id}&page={page}&perPage=100"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                results = data.get('results', [])
                if not results:
                    break
                all_products.extend(results)
                if len(results) < 100:
                    break
        except Exception as e:
            print(f"  Error fetching page {page}: {e}")
            break
    return all_products


def transform_product(p, vendor_name=''):
    pid = str(p['id'])
    raw_title = (p.get('title') or '').strip()
    sku = (p.get('sku') or f"ART{pid}").strip()
    title_lower = raw_title.lower()

    # Drop price and 25% markup
    drop_price = int(float(p.get('dropPrice') or 0))
    price = int(round(drop_price * 1.25 / 10) * 10)
    old_price = int(round(price * 1.25 / 10) * 10)

    # Color extraction
    color = ''
    for param in p.get('params', []):
        if (param.get('title') or '').strip().lower() == 'колір':
            color = (param.get('value') or '').strip()
            break
    if not color:
        if 'лавандов' in title_lower: color = 'Світло-лавандовий'
        elif 'графіт' in title_lower: color = 'Графіт'
        elif 'чорн' in title_lower: color = 'Чорний'
        elif 'сір' in title_lower: color = 'Сірий'
        elif 'біл' in title_lower or 'молоч' in title_lower: color = 'Білий'
        elif 'беж' in title_lower: color = 'Бежевий'
        elif 'синій' in title_lower or 'син' in title_lower: color = 'Синій'
        elif 'зелен' in title_lower: color = 'Зелений'
        elif 'коричнев' in title_lower: color = 'Коричневий'

    # Category, subcategory, season classification
    if 'дублянк' in title_lower:
        cat = 'clothing'
        subcat = 'winter_jacket'
        cat_name = 'Одяг & Дублянки'
        season = 'winter'
        season_name = 'Зима'
        mat = 'Штучна шкіра / Штучне хутро'
        badge = 'На хутрі • Дублянка'
    elif 'косух' in title_lower:
        cat = 'clothing'
        subcat = 'leather'
        cat_name = 'Одяг & Косухи'
        if 'хутр' in title_lower:
            season = 'winter'
            season_name = 'Зима / Демісезон'
            mat = "М'яка еко-шкіра / Штучне хутро"
            badge = 'На хутрі • Еко-шкіра'
        else:
            season = 'demi'
            season_name = 'Демісезон'
            mat = "М'яка еко-шкіра"
            badge = f"{color} • Еко-шкіра" if color else 'Еко-шкіра'
    elif 'худі' in title_lower or 'hoodie' in title_lower or 'зіп' in title_lower:
        cat = 'clothing'
        subcat = 'zip_hoodie'
        cat_name = 'Одяг & Зіп-худі'
        season = 'demi'
        season_name = 'Демісезон'
        mat = '95% Бавовна / 5% Поліестер (петля)'
        badge = f"{color} • DTF друк" if color else 'DTF друк'
    elif 'куртк' in title_lower or 'пуховик' in title_lower or 'парк' in title_lower:
        cat = 'clothing'
        subcat = 'jacket'
        cat_name = 'Одяг & Куртки'
        season = 'winter' if 'зим' in title_lower else 'demi'
        season_name = 'Зима' if season == 'winter' else 'Демісезон'
        mat = 'Плащівка матова (100% поліестер) / Синтепон'
        badge = f"{color} • {season_name}" if color else season_name
    elif 'жилет' in title_lower or 'безрукавк' in title_lower:
        cat = 'clothing'
        subcat = 'vest'
        cat_name = 'Одяг & Жилетки'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Плащівка / Синтепон'
        badge = 'Жилетка'
    elif 'штани' in title_lower or 'карго' in title_lower or 'джогер' in title_lower or 'брюк' in title_lower:
        cat = 'clothing'
        subcat = 'pants'
        cat_name = 'Одяг & Штани'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Бавовна / Еластан'
        badge = 'Штани карго'
    elif 'джинс' in title_lower:
        cat = 'clothing'
        subcat = 'jeans'
        cat_name = 'Одяг & Джинси'
        season = 'demi'
        season_name = 'Демісезон'
        mat = '100% Бавовна (денім)'
        badge = 'Джинси'
    elif 'футболк' in title_lower or 'лонгслів' in title_lower:
        cat = 'clothing'
        subcat = 'tshirt'
        cat_name = 'Одяг & Футболки'
        season = 'summer'
        season_name = 'Літо'
        mat = '100% Бавовна'
        badge = 'Футболка'
    elif 'кросівк' in title_lower or 'кеди' in title_lower or 'sneaker' in title_lower:
        cat = 'shoes'
        subcat = 'sneakers'
        cat_name = 'Взуття & Кросівки'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Шкіра / Текстиль'
        badge = 'Кросівки'
    else:
        cat = 'clothing'
        subcat = 'apparel'
        cat_name = 'Одяг'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Текстиль / Бавовна'
        badge = 'Новинка'

    # Brand detection
    brand = 'urban'
    brand_name = 'URBAN'
    if 'margiela' in title_lower:
        brand = 'maison_margiela'
        brand_name = 'Maison Margiela'
    elif 'nike' in title_lower:
        brand = 'nike'
        brand_name = 'Nike'
    elif 'adidas' in title_lower:
        brand = 'adidas'
        brand_name = 'Adidas'
    elif 'new balance' in title_lower or 'nb' in title_lower:
        brand = 'new_balance'
        brand_name = 'New Balance'
    elif 'trapstar' in title_lower:
        brand = 'trapstar'
        brand_name = 'Trapstar'

    # Gender detection
    if 'жіноч' in title_lower or 'жінк' in title_lower:
        gender = 'women'
    elif 'чоловіч' in title_lower:
        gender = 'men'
    else:
        gender = 'unisex'

    # Clean description
    raw_desc = p.get('description') or ''
    clean_lines = []
    for line in raw_desc.split('\n'):
        line_clean = re.sub(r'[\U00010000-\U0010ffff\u2000-\u3300]', '', line).strip()
        line_clean = re.sub(r'^[•\-\*\s]+', '', line_clean).strip()
        if line_clean and not any(line_clean.lower().startswith(x) for x in ['артикул:', 'розміри:']):
            clean_lines.append(line_clean)
    desc = '\n'.join(clean_lines) if clean_lines else (
        f"{raw_title}. Якісний матеріал ({mat}), зручний крій, надійні застібки."
    )

    # Images
    imgs = []
    if p.get('images'):
        for img in p['images']:
            if img.get('filename') and not img.get('deleted'):
                imgs.append(f"https://backend.mydrop.com.ua/vendor/products/uploads/{img['filename']}")
    if not imgs and p.get('titleImage') and p['titleImage'].get('filename'):
        imgs.append(f"https://backend.mydrop.com.ua/vendor/products/uploads/{p['titleImage']['filename']}")

    # Sizes
    avail_sizes = [s['title'].strip() for s in p.get('sizes', []) if s.get('availableDropshipper')]
    all_sizes = [s['title'].strip() for s in p.get('sizes', [])]
    sizes = avail_sizes if avail_sizes else all_sizes

    slug = f"{slugify(raw_title)}-{pid}"

    return {
        'id': str(pid),
        'slug': slug,
        'name': raw_title,
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
        'origin': 'Фабричне виробництво',
        'badge': badge,
        'desc': desc,
        'imgs': imgs,
        'sizes': sizes,
        'in_stock': len(avail_sizes) > 0
    }


def parse_source_url(url_str):
    """
    Parses a URL and extracts source parameters.
    Supported formats:
    - https://mydrop.com.ua/:vendorUrl/products/:productId (or /p/:productId)
    - https://mydrop.com.ua/:vendorUrl/c/:categoryId (or /categories/:categoryId)
    - https://backend.mydrop.com.ua/dropshipper/vendors/:vendorId/products/:productId
    - https://mydrop.com.ua/product/:productId
    """
    u = url_str.strip()

    # 1. Backend direct product URL
    m = re.search(r'vendors/(\d+)/products/(\d+)', u)
    if m:
        return {'type': 'product', 'vendor_id': int(m.group(1)), 'product_id': int(m.group(2)), 'url': u}

    # 2. Storefront product URL: mydrop.com.ua/:vendorUrl/products/:productId or /p/:productId
    m = re.search(r'mydrop\.com\.ua/([^/]+)/(?:products|p)/(\d+)', u)
    if m:
        vendor_slug = m.group(1)
        product_id = int(m.group(2))
        vendor_id = resolve_vendor_id(vendor_slug)
        if vendor_id:
            return {'type': 'product', 'vendor_id': vendor_id, 'product_id': product_id, 'vendor_slug': vendor_slug, 'url': u}

    # 3. Storefront category URL: mydrop.com.ua/:vendorUrl/c/:categoryId
    m = re.search(r'mydrop\.com\.ua/([^/]+)/(?:c|products/categories)/(\d+)', u)
    if m:
        vendor_slug = m.group(1)
        cat_id = int(m.group(2))
        vendor_id = resolve_vendor_id(vendor_slug)
        if vendor_id:
            return {'type': 'category', 'vendor_id': vendor_id, 'category_id': cat_id, 'vendor_slug': vendor_slug, 'url': u}

    # 4. Direct /product/:productId format
    m = re.search(r'mydrop\.com\.ua/products?/(\d+)', u)
    if m:
        return {'type': 'product_id_only', 'product_id': int(m.group(1)), 'url': u}

    return None


def generate_meta_dict(products):
    women_count = sum(1 for p in products if p['gender'] in ('women', 'unisex'))
    men_count = sum(1 for p in products if p['gender'] in ('men', 'unisex'))

    subcat_counts = Counter(p['subcat'] for p in products)
    season_counts = Counter(p['season'] for p in products)
    brand_counts = Counter(p['brand'] for p in products)

    subcat_names = {
        'jacket': 'Демісезонні жіночі куртки',
        'leather': 'Жіночі косухи',
        'winter_jacket': 'Дублянки на хутрі',
        'zip_hoodie': 'Зіп-худі',
        'vest': 'Жилетки',
        'pants': 'Штани та карго',
        'jeans': 'Джинси',
        'tshirt': 'Футболки',
        'sneakers': 'Кросівки',
        'apparel': 'Одяг'
    }

    brand_names = {
        'urban': 'URBAN',
        'maison_margiela': 'Maison Margiela',
        'nike': 'Nike',
        'adidas': 'Adidas',
        'new_balance': 'New Balance',
        'trapstar': 'Trapstar'
    }

    categories = [{'slug': 'all', 'name': 'Всі моделі', 'icon': '', 'count': len(products)}]
    for slug, count in subcat_counts.items():
        categories.append({
            'slug': slug,
            'name': subcat_names.get(slug, slug.capitalize()),
            'icon': '',
            'count': count
        })

    seasons = [
        {'slug': 'all', 'name': 'Всі сезони', 'icon': '', 'count': len(products)},
    ]
    if season_counts.get('demi'):
        seasons.append({'slug': 'demi', 'name': 'Демісезон', 'icon': '', 'count': season_counts['demi']})
    if season_counts.get('winter'):
        seasons.append({'slug': 'winter', 'name': 'Зима / Хутро', 'icon': '', 'count': season_counts['winter']})
    if season_counts.get('summer'):
        seasons.append({'slug': 'summer', 'name': 'Літо', 'icon': '', 'count': season_counts['summer']})

    brands = [{'slug': 'all', 'name': 'Всі бренди', 'count': len(products)}]
    for slug, count in brand_counts.items():
        brands.append({
            'slug': slug,
            'name': brand_names.get(slug, slug.upper()),
            'count': count
        })

    return {
        'total': len(products),
        'genders': [
            {'slug': 'all', 'name': 'Всі товари', 'icon': '', 'count': len(products)},
            {'slug': 'women', 'name': 'Жіночі', 'icon': '', 'count': women_count},
            {'slug': 'men', 'name': 'Чоловічі', 'icon': '', 'count': men_count},
        ],
        'categories': categories,
        'seasons': seasons,
        'brands': brands
    }


def generate_feed_xml(products):
    feed_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
        '  <channel>',
        '    <title>URBAN — Одяг та аксесуари</title>',
        '    <link>https://urbangrid.com.ua</link>',
        '    <description>Каталог одягу та взуття від URBAN. Швидка доставка Новою Поштою по Україні.</description>'
    ]

    for p in products:
        desc_parts = [p['name']]
        if p.get('mat'): desc_parts.append(f"Матеріал: {p['mat']}")
        if p.get('sizes'): desc_parts.append(f"Розміри: {', '.join(p['sizes'][:6])}")
        desc_parts.append(f"Арт: {p['art']}")
        desc_str = ' • '.join(desc_parts)

        main_img = p['imgs'][0] if p.get('imgs') else 'https://urbangrid.com.ua/images/outerwear.webp'

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
            f'      <g:product_type>{escape(p.get("cat_name", "Одяг"))}</g:product_type>',
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
    return '\n'.join(feed_xml_lines) + '\n'


def generate_sitemap_xml(products):
    in_stock_products = [p for p in products if p.get('in_stock')]
    sitemap_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
    ]
    for p in in_stock_products:
        sitemap_lines.append(f'  <url><loc>https://urbangrid.com.ua/product/{p["slug"]}</loc><changefreq>daily</changefreq><priority>0.8</priority></url>')
    sitemap_lines.append('</urlset>')
    return '\n'.join(sitemap_lines) + '\n'


def commit_catalog_files(products):
    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Save data/products.json
    with open(OUTPUT_PRODUCTS, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2 if not products else None, separators=(',', ':') if products else None)
    print(f"Saved {OUTPUT_PRODUCTS} with {len(products)} products")

    # 2. Save data/meta.json
    meta = generate_meta_dict(products)
    with open(OUTPUT_META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Saved {OUTPUT_META} (total: {meta['total']})")

    # 3. Save feed.xml
    feed_content = generate_feed_xml(products)
    with open(OUTPUT_FEED, 'w', encoding='utf-8') as f:
        f.write(feed_content)
    print(f"Saved {OUTPUT_FEED}")

    # 4. Save sitemap.xml
    sitemap_content = generate_sitemap_xml(products)
    with open(OUTPUT_SITEMAP, 'w', encoding='utf-8') as f:
        f.write(sitemap_content)
    print(f"Saved {OUTPUT_SITEMAP}")


def clear_catalog():
    print("Clearing all products and sources as requested by user...")
    save_sources([])
    commit_catalog_files([])
    print("Catalog cleared successfully.")


def sync_sources():
    sources = load_sources()
    if not sources:
        print("No active sources in data/sources.json. Catalog remains empty.")
        commit_catalog_files([])
        return

    print(f"Syncing {len(sources)} sources from data/sources.json...")
    synced_products = []
    seen_pids = set()

    for s in sources:
        stype = s.get('type')
        if stype == 'product':
            vid = s.get('vendor_id')
            pid = s.get('product_id')
            if vid and pid:
                pdata = fetch_mydrop_product(vid, pid)
                if pdata and str(pdata['id']) not in seen_pids:
                    seen_pids.add(str(pdata['id']))
                    synced_products.append(transform_product(pdata))
        elif stype == 'category':
            vid = s.get('vendor_id')
            cid = s.get('category_id')
            if vid and cid:
                raw_items = fetch_mydrop_category_products(vid, cid)
                # Fetch details for in-stock
                in_stock_raw = [r for r in raw_items if any(sz.get('availableDropshipper') for sz in r.get('sizes', []))]
                for item in in_stock_raw:
                    pid = item['id']
                    if str(pid) not in seen_pids:
                        detail = fetch_mydrop_product(vid, pid) or item
                        seen_pids.add(str(pid))
                        synced_products.append(transform_product(detail))

    commit_catalog_files(synced_products)
    print(f"Successfully synced {len(synced_products)} products.")


def add_source_urls(urls):
    sources = load_sources()
    added_any = False

    for u in urls:
        parsed = parse_source_url(u)
        if not parsed:
            print(f"Could not parse URL format: {u}")
            continue

        # Check if already in sources
        exists = any(
            s.get('type') == parsed['type'] and
            s.get('vendor_id') == parsed.get('vendor_id') and
            s.get('product_id') == parsed.get('product_id') and
            s.get('category_id') == parsed.get('category_id')
            for s in sources
        )
        if not exists:
            sources.append(parsed)
            added_any = True
            print(f"Added source: {parsed}")
        else:
            print(f"Source already exists: {parsed}")

    if added_any:
        save_sources(sources)
        sync_sources()


def main():
    parser = argparse.ArgumentParser(description="URBAN Catalog Sync Engine (User Links Only)")
    parser.add_argument('--clear', action='store_true', help="Clear all products and configured sources")
    parser.add_argument('--download', '--sync', action='store_true', help="Sync stock/prices for configured user sources only")
    parser.add_argument('--add', nargs='+', help="Add one or more product/category links to the catalog")
    parser.add_argument('--list', action='store_true', help="List configured sources")
    args = parser.parse_args()

    if args.clear:
        clear_catalog()
    elif args.add:
        add_source_urls(args.add)
    elif args.download:
        sync_sources()
    elif args.list:
        sources = load_sources()
        print(f"Configured sources ({len(sources)}):")
        for s in sources:
            print(f"  - {s}")
    else:
        # Default run (e.g. called without args)
        sync_sources()


if __name__ == '__main__':
    main()
