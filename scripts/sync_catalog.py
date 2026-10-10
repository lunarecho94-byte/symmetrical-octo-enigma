#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URBAN — Catalog Synchronization Engine
Manages products imported strictly from user-provided URLs/sources with automatic markup (default 20%).
Supports:
  - EasyDrop supplier catalogs (e.g. https://easydrop.one/supplier-catalog/{token}/{category_id}/)
  - MyDrop dropshipper and storefront URLs
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
import urllib.parse
import http.cookiejar
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

BRAND_MAP = {
    'nike': ('nike', 'Nike'),
    'tnf': ('the_north_face', 'The North Face'),
    'the north face': ('the_north_face', 'The North Face'),
    'jordan': ('jordan', 'Jordan'),
    'jordan nike': ('jordan', 'Jordan'),
    'stone island': ('stone_island', 'Stone Island'),
    'napapijri': ('napapijri', 'Napapijri'),
    'polo': ('polo_ralph_lauren', 'Polo Ralph Lauren'),
    'boss': ('boss', 'Hugo Boss'),
    'hugo': ('boss', 'Hugo Boss'),
    'moncler': ('moncler', 'Moncler'),
    'nike nocta': ('nike', 'Nike Nocta'),
    'calvin klein': ('calvin_klein', 'Calvin Klein'),
    'louis vuitton': ('louis_vuitton', 'Louis Vuitton'),
    'columbia': ('columbia', 'Columbia'),
    'lacoste': ('lacoste', 'Lacoste'),
    'tommy hilfiger': ('tommy_hilfiger', 'Tommy Hilfiger'),
    'c.p. company': ('cp_company', 'C.P. Company'),
    'c.p.  company': ('cp_company', 'C.P. Company'),
    'cp company': ('cp_company', 'C.P. Company'),
    'c.p.company': ('cp_company', 'C.P. Company'),
}


def slugify(text):
    s = str(text or '').lower()
    trans = ''.join(CYR_MAP.get(ch, ch) for ch in s)
    clean = re.sub(r'[^a-z0-9]+', '-', trans).strip('-')
    return clean or 'product'


def resolve_brand(brand_raw):
    b_low = str(brand_raw or '').strip().lower()
    for k, v in BRAND_MAP.items():
        if k in b_low:
            return v[0], v[1]
    clean_name = str(brand_raw or 'URBAN').strip()
    return slugify(clean_name), clean_name


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


def fetch_easydrop_category(token, category_id, markup=0.20):
    url = f"https://easydrop.one/supplier-catalog/{token}/{category_id}/"
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    print(f"Fetching EasyDrop catalog: {url} (націнка: {markup*100:.0f}%)...")
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    try:
        with opener.open(req, timeout=15) as r:
            html = r.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Error loading EasyDrop URL: {e}")
        return []

    csrftoken = ''
    for c in cj:
        if c.name == 'csrftoken':
            csrftoken = c.value

    # Extract all item cards
    cards = re.findall(r'<div class=\"[^\"]*item-container\" id=\"itm-(\d+)\">(.*?)</div>\s*</div>\s*</div>', html, re.DOTALL)
    print(f"Found {len(cards)} item cards on EasyDrop. Fetching gallery images concurrently...")

    def fetch_card_gallery(item):
        pk, card_html = item
        data = urllib.parse.urlencode({'action': 'get-item-images', 'pk': pk, 'csrfmiddlewaretoken': csrftoken}).encode('utf-8')
        headers_post = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Referer': url
        }
        req_post = urllib.request.Request('https://easydrop.one/change-api', data=data, headers=headers_post)
        try:
            with opener.open(req_post, timeout=7) as r:
                return pk, json.loads(r.read().decode('utf-8'))
        except Exception:
            return pk, []

    with ThreadPoolExecutor(max_workers=15) as ex:
        galleries = dict(ex.map(fetch_card_gallery, cards))

    products = []
    for pk, card_html in cards:
        h5 = re.search(r'<h5>(.*?)</h5>', card_html)
        raw_brand = h5.group(1).strip() if h5 else ''
        brand_slug, brand_name = resolve_brand(raw_brand)

        sku_m = re.search(r'Код/Арт:.*?<td[^>]*><nobr>(.*?)</nobr></td>', card_html, re.DOTALL)
        sku = sku_m.group(1).strip() if sku_m else f"ED{pk}"

        price_m = re.search(r'Дроп ціна:.*?<td><nobr>(\d+)</nobr></td>', card_html, re.DOTALL)
        drop_price = int(price_m.group(1)) if price_m else 0

        # Markup calculation (specified by user, e.g. 20%)
        sale_price = int(round(drop_price * (1 + markup) / 10) * 10)
        old_price = int(round(sale_price * 1.20 / 10) * 10)

        # Sizes
        sizes = []
        avail_sizes = []
        size_blocks = re.findall(r'<a class=\"size-option\s*([^\"]*)\">\s*<div class=\"size-val[^\"]*\"[^>]*>(.*?)</div>\s*<div class=\"size-qty[^\"]*\">\s*(.*?)\s*</div>', card_html, re.DOTALL)
        for cls, sval, sqty in size_blocks:
            sv = sval.strip()
            sizes.append(sv)
            if 'available-True' in cls or sqty.strip() != '0':
                avail_sizes.append(sv)
        final_sizes = avail_sizes if avail_sizes else sizes

        # Images
        base_m = re.search(r'showImage\([\'\"]([^\'\"]+)[\'\"]\)', card_html)
        base_img = base_m.group(1).strip() if base_m else ''
        mini_m = re.search(r'<img [^>]*src=[\'\"]([^\'\"]+)[\'\"]', card_html)
        mini_img = mini_m.group(1).strip() if mini_m else ''
        gal_imgs = galleries.get(pk, [])

        local_thumb = f"/images/catalog/{pk}.jpg"
        img_list = [local_thumb]
        for img_path in (gal_imgs + [base_img, mini_img]):
            if not img_path: continue
            full_url = img_path if img_path.startswith('http') else f"https://easydrop.one{img_path}"
            if full_url not in img_list:
                img_list.append(full_url)

        # Title
        title = f"Зимова куртка {brand_name} {sku}"

        origin_m = re.search(r'<tr class=\"text-left\"><td colspan=\"3\">\s*(.*?)\s*</td></tr>', card_html)
        origin_text = origin_m.group(1).strip() if origin_m else 'Турция'
        origin = 'Фабричне виробництво (Туреччина)' if 'турц' in origin_text.lower() else 'Фабричне виробництво'
        mat = '100% поліестер / Водовідштовхувальна плащівка / Холофайбер'

        desc = (
            f"Тепла зимова брендова куртка {brand_name} ({sku}). "
            f"Якісна водовідштовхувальна плащівка (100% поліестер), надійний утеплювач холофайбер для надійного захисту від холоду та вітру. "
            f"Зручні місткі кишені, анатомічний крій та якісна фурнітура. {origin}."
        )

        slug = f"{slugify(title)}-{pk}"

        products.append({
            'id': str(pk),
            'slug': slug,
            'name': title,
            'price': sale_price,
            'old_price': old_price,
            'cost_price': drop_price,
            'cat': 'clothing',
            'subcat': 'winter_jacket',
            'cat_name': 'Одяг & Зимові куртки',
            'season': 'winter',
            'season_name': 'Зима / Утеплена',
            'brand': brand_slug,
            'brand_name': brand_name,
            'gender': 'men',
            'art': sku,
            'color': '',
            'mat': mat,
            'origin': origin,
            'badge': 'Зима • Термо',
            'desc': desc,
            'imgs': img_list,
            'sizes': final_sizes,
            'in_stock': len(final_sizes) > 0
        })

    print(f"Successfully processed {len(products)} EasyDrop products.")
    return products


def transform_mydrop_product(p, markup=0.20):
    pid = str(p['id'])
    raw_title = (p.get('title') or '').strip()
    sku = (p.get('sku') or f"ART{pid}").strip()
    title_lower = raw_title.lower()

    drop_price = int(float(p.get('dropPrice') or 0))
    price = int(round(drop_price * (1 + markup) / 10) * 10)
    old_price = int(round(price * 1.20 / 10) * 10)

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

    # Category, subcategory, season classification
    if 'дублянк' in title_lower or 'хутро' in title_lower or 'пуховик' in title_lower or 'зим' in title_lower:
        cat = 'clothing'
        subcat = 'winter_jacket'
        cat_name = 'Одяг & Зимові куртки'
        season = 'winter'
        season_name = 'Зима'
        mat = 'Штучна шкіра / Штучне хутро / Холофайбер'
        badge = 'Зима • Термо'
    elif 'косух' in title_lower:
        cat = 'clothing'
        subcat = 'leather'
        cat_name = 'Одяг & Косухи'
        season = 'demi'
        season_name = 'Демісезон'
        mat = "М'яка еко-шкіра"
        badge = 'Еко-шкіра'
    elif 'худі' in title_lower or 'hoodie' in title_lower or 'зіп' in title_lower:
        cat = 'clothing'
        subcat = 'zip_hoodie'
        cat_name = 'Одяг & Зіп-худі'
        season = 'demi'
        season_name = 'Демісезон'
        mat = '95% Бавовна / 5% Поліестер (петля)'
        badge = 'DTF друк'
    else:
        cat = 'clothing'
        subcat = 'jacket'
        cat_name = 'Одяг & Куртки'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Плащівка матова (100% поліестер)'
        badge = 'Новинка'

    brand_slug, brand_name = resolve_brand(raw_title)

    gender = 'women' if ('жіноч' in title_lower or 'жінк' in title_lower) else ('men' if 'чоловіч' in title_lower else 'unisex')

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
        'brand': brand_slug,
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


def parse_source_url(url_str, markup=0.20):
    u = url_str.strip()

    # EasyDrop category URL
    m_ed = re.search(r'easydrop\.one/supplier-catalog/(\w+)/(\d+)', u)
    if m_ed:
        return {
            'type': 'easydrop_category',
            'token': m_ed.group(1),
            'category_id': m_ed.group(2),
            'url': u,
            'markup': markup
        }

    # MyDrop Backend direct product URL
    m = re.search(r'vendors/(\d+)/products/(\d+)', u)
    if m:
        return {'type': 'mydrop_product', 'vendor_id': int(m.group(1)), 'product_id': int(m.group(2)), 'url': u, 'markup': markup}

    # MyDrop Storefront product URL: mydrop.com.ua/:vendorUrl/products/:productId or /p/:productId
    m = re.search(r'mydrop\.com\.ua/([^/]+)/(?:products|p)/(\d+)', u)
    if m:
        vendor_slug = m.group(1)
        product_id = int(m.group(2))
        vendor_id = resolve_vendor_id(vendor_slug)
        if vendor_id:
            return {'type': 'mydrop_product', 'vendor_id': vendor_id, 'product_id': product_id, 'vendor_slug': vendor_slug, 'url': u, 'markup': markup}

    # MyDrop Storefront category URL: mydrop.com.ua/:vendorUrl/c/:categoryId
    m = re.search(r'mydrop\.com\.ua/([^/]+)/(?:c|products/categories)/(\d+)', u)
    if m:
        vendor_slug = m.group(1)
        cat_id = int(m.group(2))
        vendor_id = resolve_vendor_id(vendor_slug)
        if vendor_id:
            return {'type': 'mydrop_category', 'vendor_id': vendor_id, 'category_id': cat_id, 'vendor_slug': vendor_slug, 'url': u, 'markup': markup}

    return None


def generate_meta_dict(products):
    women_count = sum(1 for p in products if p['gender'] in ('women', 'unisex'))
    men_count = sum(1 for p in products if p['gender'] in ('men', 'unisex'))

    subcat_counts = Counter(p['subcat'] for p in products)
    season_counts = Counter(p['season'] for p in products)
    brand_counts = Counter(p['brand'] for p in products)

    subcat_names = {
        'winter_jacket': 'Зимові куртки та пуховики',
        'jacket': 'Демісезонні куртки',
        'leather': 'Косухи',
        'zip_hoodie': 'Зіп-худі',
        'vest': 'Жилетки',
        'pants': 'Штани та карго',
        'jeans': 'Джинси',
        'tshirt': 'Футболки',
        'sneakers': 'Кросівки',
        'apparel': 'Одяг'
    }

    brand_names_map = {}
    for p in products:
        brand_names_map[p['brand']] = p['brand_name']

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
    if season_counts.get('winter'):
        seasons.append({'slug': 'winter', 'name': 'Зима / Утеплена', 'icon': '', 'count': season_counts['winter']})
    if season_counts.get('demi'):
        seasons.append({'slug': 'demi', 'name': 'Демісезон', 'icon': '', 'count': season_counts['demi']})
    if season_counts.get('summer'):
        seasons.append({'slug': 'summer', 'name': 'Літо', 'icon': '', 'count': season_counts['summer']})

    brands = [{'slug': 'all', 'name': 'Всі бренди', 'count': len(products)}]
    for slug, count in brand_counts.most_common():
        brands.append({
            'slug': slug,
            'name': brand_names_map.get(slug, slug.upper()),
            'count': count
        })

    return {
        'total': len(products),
        'genders': [
            {'slug': 'all', 'name': 'Всі товари', 'icon': '', 'count': len(products)},
            {'slug': 'men', 'name': 'Чоловічі', 'icon': '', 'count': men_count},
            {'slug': 'women', 'name': 'Жіночі', 'icon': '', 'count': women_count},
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
        if main_img.startswith('/'):
            main_img = f"https://urbangrid.com.ua{main_img}"

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

    with open(OUTPUT_PRODUCTS, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2 if not products else None, separators=(',', ':') if products else None)
    print(f"Saved {OUTPUT_PRODUCTS} with {len(products)} products")

    meta = generate_meta_dict(products)
    with open(OUTPUT_META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Saved {OUTPUT_META} (total: {meta['total']})")

    feed_content = generate_feed_xml(products)
    with open(OUTPUT_FEED, 'w', encoding='utf-8') as f:
        f.write(feed_content)
    print(f"Saved {OUTPUT_FEED}")

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
        markup = float(s.get('markup', 0.20))

        if stype == 'easydrop_category':
            token = s.get('token')
            cid = s.get('category_id')
            if token and cid:
                items = fetch_easydrop_category(token, cid, markup=markup)
                for itm in items:
                    if str(itm['id']) not in seen_pids:
                        seen_pids.add(str(itm['id']))
                        synced_products.append(itm)

        elif stype == 'mydrop_product':
            vid = s.get('vendor_id')
            pid = s.get('product_id')
            if vid and pid:
                pdata = fetch_mydrop_product(vid, pid)
                if pdata and str(pdata['id']) not in seen_pids:
                    seen_pids.add(str(pdata['id']))
                    synced_products.append(transform_mydrop_product(pdata, markup=markup))

        elif stype == 'mydrop_category':
            vid = s.get('vendor_id')
            cid = s.get('category_id')
            if vid and cid:
                # category fetch
                pass

    if not synced_products and sources:
        print("Safety guard triggered: active sources exist but 0 products were fetched (network issue / error). Keeping existing catalog intact.")
        return

    commit_catalog_files(synced_products)
    print(f"Successfully synced {len(synced_products)} products.")


def add_source_urls(urls, markup=0.20):
    sources = load_sources()
    added_any = False

    for u in urls:
        parsed = parse_source_url(u, markup=markup)
        if not parsed:
            print(f"Could not parse URL format: {u}")
            continue

        exists = any(
            s.get('type') == parsed['type'] and
            s.get('url') == parsed.get('url')
            for s in sources
        )
        if not exists:
            sources.append(parsed)
            added_any = True
            print(f"Added source: {parsed}")
        else:
            # Update markup if changed
            for s in sources:
                if s.get('url') == parsed.get('url'):
                    s['markup'] = markup
            added_any = True
            print(f"Updated existing source with markup {markup*100:.0f}%: {parsed}")

    if added_any:
        save_sources(sources)
        sync_sources()


def main():
    parser = argparse.ArgumentParser(description="URBAN Catalog Sync Engine (User Links Only)")
    parser.add_argument('--clear', action='store_true', help="Clear all products and configured sources")
    parser.add_argument('--download', '--sync', action='store_true', help="Sync stock/prices for configured user sources only")
    parser.add_argument('--add', nargs='+', help="Add one or more product/category links to the catalog")
    parser.add_argument('--markup', type=float, default=0.20, help="Markup percentage (default 0.20 = 20%)")
    parser.add_argument('--list', action='store_true', help="List configured sources")
    args = parser.parse_args()

    if args.clear:
        clear_catalog()
    elif args.add:
        add_source_urls(args.add, markup=args.markup)
    elif args.download:
        sync_sources()
    elif args.list:
        sources = load_sources()
        print(f"Configured sources ({len(sources)}):")
        for s in sources:
            print(f"  - {s}")
    else:
        sync_sources()


if __name__ == '__main__':
    main()
