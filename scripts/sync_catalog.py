#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URBAN — Catalog Synchronization Engine
Synchronizes products from MyDrop for jackets & coats.
Generates:
  - data/products.json
  - data/meta.json
  - feed.xml
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

MYDROP_VENDOR_ID = 2473  # Outerwear supplier (https://mydrop.com.ua/ra)
BACKEND_BASE_URL = 'https://backend.mydrop.com.ua/dropshipper'

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
}


def fetch_all_vendor_products(vendor_id=MYDROP_VENDOR_ID):
    """Fetches all products listed under the specified MyDrop supplier."""
    all_products = []
    print(f"Fetching products from MyDrop supplier ID {vendor_id}...")
    for page in range(1, 20):
        url = f"{BACKEND_BASE_URL}/vendors/{vendor_id}/products?page={page}&perPage=100"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                results = data.get('results', [])
                if not results:
                    break
                all_products.extend(results)
                print(f"  Page {page}: {len(results)} items (Total: {len(all_products)})")
        except Exception as e:
            print(f"  Error on page {page}: {e}")
            break
    print(f"Total supplier products fetched: {len(all_products)}")
    return all_products


def fetch_category_products(category_id, vendor_id=MYDROP_VENDOR_ID):
    """Fetches all products for a specific category ID from MyDrop."""
    url = f"{BACKEND_BASE_URL}/vendors/{vendor_id}/products?categoryId={category_id}&perPage=100"
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get('results', [])
    except Exception as e:
        print(f"  Error fetching category {category_id}: {e}")
        return []


def filter_target_products(products):
    """Filters products to include jackets, parkas, windbreakers, and coats."""
    pattern = re.compile(
        r'куртк|пальто|бомбер|вітр[іі]вк|косух|пуховик|парк[аи]|анорак|softshell|софтшел|дублянк|джинс[іі]вк|джинсовк',
        re.IGNORECASE
    )
    matched = []
    for p in products:
        title = (p.get('title') or '').strip()
        if pattern.search(title):
            matched.append(p)
    print(f"Filtered {len(matched)} outerwear products from {len(products)} total products.")
    return matched


def fetch_product_details(products, vendor_id=MYDROP_VENDOR_ID):
    """Fetches full product details including image galleries and descriptions concurrently."""
    print(f"Fetching full product details for {len(products)} items...")
    
    def fetch_single(p):
        pid = p['id']
        url = f"{BACKEND_BASE_URL}/vendors/{vendor_id}/products/{pid}"
        req = urllib.request.Request(url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=12) as resp:
                detail = json.loads(resp.read().decode('utf-8'))
                return detail
        except Exception as e:
            print(f"  Warning: could not fetch details for ID {pid}: {e}")
            return p

    start_time = time.time()
    with ThreadPoolExecutor(max_workers=15) as executor:
        detailed_products = list(executor.map(fetch_single, products))
    
    duration = time.time() - start_time
    print(f"Completed details fetch in {duration:.2f} seconds.")
    return detailed_products


def transform_product(p):
    """Transforms a MyDrop product object into the store schema."""
    pid = str(p['id'])
    title = p.get('title', '').strip()
    title = re.sub(r'\s+', ' ', title)
    t_lower = title.lower()

    price = int(p.get('price') or 0)
    drop_price = int(p.get('dropPrice') or 0)
    old_price = int(round(price * 1.25 / 10) * 10) if price else 0
    sku = p.get('sku') or f"#ra{pid}"

    desc = p.get('description') or ''
    
    # Material extraction
    mat = ''
    m_mat = re.search(r'Матеріал:\s*([^\n\r.]+)', desc, re.I)
    if m_mat:
        mat = m_mat.group(1).strip()
    elif 'шкіра' in t_lower or 'кож' in t_lower:
        mat = 'Штучна шкіра'
    elif 'замш' in t_lower:
        mat = 'Замша'
    elif 'плащівк' in t_lower or 'вітрівк' in t_lower:
        mat = 'Плащівка / Поліестер'
    elif 'бавовн' in t_lower or 'котон' in t_lower:
        mat = '100% Бавовна'
    else:
        mat = 'Поліестер / Плащівка'

    # Clean description: no duplicated characteristics or emojis
    origin = ""
    lines = desc.split('\n')
    kept = []
    title_tokens = [w for w in re.findall(r'\w+', t_lower) if len(w) > 2]
    for raw_line in lines:
        line_str = raw_line.strip()
        if not line_str:
            continue
        no_emoji = re.sub(r'[\U00010000-\U0010ffff\u2000-\u3300]', '', line_str).strip()
        if not no_emoji:
            continue
        if re.match(r'^(?:Артикул|Арт|Розмір[иі]?|Матеріал|Сезон|Виробник|Країна|Стан|Комплектація)\b', no_emoji, re.I):
            mat_extra = re.match(r'^Матеріал\s*:\s*[^.]+\.\s*(.+)$', no_emoji, re.I)
            if mat_extra and mat_extra.group(1) and len(mat_extra.group(1).strip()) > 8:
                kept.append(mat_extra.group(1).strip())
            continue
        if title_tokens and len(no_emoji) > 5:
            line_tokens = [w for w in re.findall(r'\w+', no_emoji.lower()) if len(w) > 2]
            overlap = len([tok for tok in line_tokens if tok in title_tokens])
            if line_tokens and (overlap / len(line_tokens)) >= 0.6 and len(line_tokens) <= 8:
                continue
        clean_line = re.sub(r'[\U00010000-\U0010ffff\u2000-\u3300]', '', line_str)
        clean_line = re.sub(r'(?:Артикул|Арт|Розмір[иі]?|Матеріал|Сезон|Виробник|Країна|Стан)\s*:\s*[^,.]+[.,]?', '', clean_line, flags=re.I)
        clean_line = re.sub(r'\s+', ' ', clean_line).strip()
        if len(clean_line) > 5:
            kept.append(clean_line)
    desc = ' '.join(kept)
    desc = re.sub(r'\s{2,}', ' ', desc).strip()
    if len(desc) > 15:
        desc = desc[0].upper() + desc[1:]
    else:
        desc = ""

    # Category and subcategory classification
    p_cat_id = str(p.get('category', {}).get('id') if isinstance(p.get('category'), dict) else '')
    is_leggings = ('лосин' in t_lower or 'легінс' in t_lower or 'леггинс' in t_lower or p_cat_id == '162679')
    is_vest = ('жилет' in t_lower or 'безрукавк' in t_lower or p_cat_id == '153947')

    if is_leggings:
        cat_name = 'Одяг & Лосини та легінси'
        subcat = 'leggings'
        mat = 'Еластичний біфлекс / Спандекс'
        origin = 'Туреччина 🇹🇷'
        badge = 'Лосини • Еластичні'
        if not desc:
            desc = f"Комфортні {title.lower()} з високою посадкою. Еластичний матеріал біфлекс приємний до тіла, не просвічує, чудово тягнеться, забезпечує бездоганну підтримку під час тренувань і щоденного носіння."
    elif is_vest:
        cat_name = 'Одяг & Жилетки та безрукавки'
        subcat = 'vest'
        mat = mat or '100% Поліестер / Синтепон 100'
        badge = 'Жилетка • Утеплена'
    elif 'пальто' in t_lower:
        cat_name = 'Одяг & Пальто'
        subcat = 'coat'
    elif 'джинс' in t_lower:
        cat_name = 'Одяг & Джинсівки'
        subcat = 'denim'
    elif 'пуховик' in t_lower or 'парк' in t_lower:
        cat_name = 'Одяг & Пуховики'
        subcat = 'down_jacket'
    elif 'шкірян' in t_lower or 'косух' in t_lower:
        cat_name = 'Одяг & Шкіряні куртки'
        subcat = 'leather'
    elif 'вітр' in t_lower:
        cat_name = 'Одяг & Вітровки'
        subcat = 'windbreaker'
    elif 'бомбер' in t_lower:
        cat_name = 'Одяг & Бомбери'
        subcat = 'bomber'
    elif 'зимов' in t_lower or 'дублянк' in t_lower or 'утеплен' in t_lower:
        cat_name = 'Одяг & Зимові куртки'
        subcat = 'winter_jacket'
    else:
        cat_name = 'Одяг & Куртки'
        subcat = 'jacket'

    # Season classification
    is_winter = any(k in t_lower or k in desc.lower() for k in [
        'зим', 'пуховик', 'хутр', 'дублянк', 'холлофайбер', 'g-loft', 'тинсулейт', 'термо', '-20', '-25', '-30'
    ])
    if is_winter:
        season = 'winter'
        season_name = 'Зима'
        badge = 'Зима • На хутрі' if 'хутр' in t_lower else 'Зима • Тепла'
    elif is_leggings:
        season = 'demi'
        season_name = 'Всесезон'
    elif is_vest:
        season = 'demi'
        season_name = 'Демісезон'
        badge = 'Демісезон • Жилетка'
    else:
        season = 'demi'
        season_name = 'Демісезон'
        badge = 'Демісезон • Джинс' if subcat == 'denim' else 'Демісезон • Тренд'

    # Gender classification
    if is_leggings or p_cat_id == '153947' or 'жіноч' in t_lower or (p.get('category') and 'жіноч' in str(p.get('category')).lower()):
        gender = 'women'
    else:
        gender = 'men'

    # Brand detection
    brand_map = [
        ('the north face', 'tnf', 'The North Face'),
        ('tnf', 'tnf', 'The North Face'),
        ('columbia', 'columbia', 'Columbia'),
        ('columbua', 'columbia', 'Columbia'),
        ('nike', 'nike', 'Nike'),
        ('zara', 'zara', 'Zara'),
        ('stone island', 'stoneisland', 'Stone Island'),
        ('tommy', 'tommy', 'Tommy Hilfiger'),
    ]
    brand = ''
    brand_name = ''
    combined_search_text = (t_lower + ' ' + desc.lower())
    for k, b_slug, b_name in brand_map:
        if k in combined_search_text:
            brand = b_slug
            brand_name = b_name
            break

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

    return {
        'id': str(pid),
        'name': title,
        'price': price,
        'old_price': old_price,
        'cost_price': drop_price,
        'cat': 'clothing',
        'subcat': subcat,
        'cat_name': cat_name,
        'season': season,
        'season_name': season_name,
        'brand': brand,
        'brand_name': brand_name,
        'gender': gender,
        'art': sku,
        'mat': mat,
        'origin': origin,
        'badge': badge,
        'desc': desc,
        'imgs': imgs,
        'sizes': sizes,
        'in_stock': len(avail_sizes) > 0
    }


def main():
    parser = argparse.ArgumentParser(description="Synchronize MyDrop jackets & coats catalog.")
    parser.add_argument('--download', action='store_true', help="Download fresh catalog from supplier API")
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Fetch products from MyDrop
    raw_products = fetch_all_vendor_products()
    matched_products = filter_target_products(raw_products)
    cat_162679_prods = fetch_category_products(162679)
    cat_153947_prods = fetch_category_products(153947)
    existing_ids = {p['id'] for p in matched_products}
    for p in cat_162679_prods + cat_153947_prods:
        if p['id'] not in existing_ids:
            matched_products.append(p)
            existing_ids.add(p['id'])

    # 2. Fetch full specifications
    detailed_products = fetch_product_details(matched_products)

    # 3. Transform to store schema
    products = [transform_product(p) for p in detailed_products]

    # Prioritize: In-stock first, women's categories first, then Winter season first, then newest ID desc
    products.sort(key=lambda x: (
        0 if x['in_stock'] else 1,
        0 if x.get('gender') == 'women' else 1,
        0 if x['season'] == 'winter' else 1,
        -int(x['id'])
    ))

    # Save data/products.json
    with open(OUTPUT_PRODUCTS, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Saved {OUTPUT_PRODUCTS} ({os.path.getsize(OUTPUT_PRODUCTS)} bytes, {len(products)} products)")

    # 4. Generate data/meta.json
    gender_counts = Counter(p['gender'] for p in products)
    season_counts = Counter(p['season'] for p in products)
    subcat_counts = Counter(p['subcat'] for p in products)
    brand_counts = Counter(p['brand'] for p in products if p.get('brand'))

    brand_name_map = {
        'tnf': 'The North Face',
        'columbia': 'Columbia',
        'nike': 'Nike',
        'zara': 'Zara',
        'stoneisland': 'Stone Island',
        'tommy': 'Tommy Hilfiger'
    }

    meta = {
        'total': len(products),
        'genders': [
            {'slug': 'all', 'name': 'Всі товари', 'icon': '', 'count': len(products)},
            {'slug': 'women', 'name': 'Жіночі', 'icon': '', 'count': gender_counts.get('women', 0)},
            {'slug': 'men', 'name': 'Чоловічі', 'icon': '', 'count': gender_counts.get('men', 0)},
        ],
        'categories': [
            {'slug': 'all', 'name': 'Всі моделі', 'icon': '🧥', 'count': len(products)},
            {'slug': 'vest', 'name': 'Жіночі жилетки та безрукавки', 'icon': '🦺', 'count': subcat_counts.get('vest', 0)},
            {'slug': 'leggings', 'name': 'Жіночі лосини та легінси', 'icon': '✨', 'count': subcat_counts.get('leggings', 0)},
            {'slug': 'winter_jacket', 'name': 'Зимові куртки та пуховики', 'icon': '❄️', 'count': subcat_counts.get('winter_jacket', 0) + subcat_counts.get('down_jacket', 0)},
            {'slug': 'coat', 'name': 'Чоловічі стильні пальто', 'icon': '🧥', 'count': subcat_counts.get('coat', 0)},
            {'slug': 'leather', 'name': 'Шкіряні куртки та косухи', 'icon': '⚡', 'count': subcat_counts.get('leather', 0)},
            {'slug': 'bomber', 'name': 'Бомбери', 'icon': '🔥', 'count': subcat_counts.get('bomber', 0)},
            {'slug': 'windbreaker', 'name': 'Вітровки', 'icon': '💨', 'count': subcat_counts.get('windbreaker', 0)},
            {'slug': 'jacket', 'name': 'Демісезонні куртки', 'icon': '🍂', 'count': subcat_counts.get('jacket', 0)},
            {'slug': 'denim', 'name': 'Джинсівки', 'icon': '👖', 'count': subcat_counts.get('denim', 0)},
        ],
        'seasons': [
            {'slug': 'all', 'name': 'Всі сезони', 'icon': '', 'count': len(products)},
            {'slug': 'winter', 'name': 'Зима', 'icon': '', 'count': season_counts.get('winter', 0)},
            {'slug': 'demi', 'name': 'Демісезон', 'icon': '', 'count': season_counts.get('demi', 0)},
        ],
        'brands': [{'slug': 'all', 'name': 'Всі бренди', 'count': len(products)}] + [
            {
                'slug': b_slug,
                'name': brand_name_map.get(b_slug, b_slug.title()),
                'count': b_count
            }
            for b_slug, b_count in brand_counts.most_common()
            if b_slug and b_slug != 'urban'
        ]
    }

    with open(OUTPUT_META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Saved {OUTPUT_META} with {len(meta['categories'])} categories and {len(meta['brands'])} brands")

    # 5. Generate feed.xml for Google/Meta Merchant
    feed_items = products[:500]
    feed_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
        '  <channel>',
        '    <title>URBAN — Куртки, Пальто та Верхній одяг</title>',
        '    <link>https://urbangrid.com.ua</link>',
        '    <description>Каталог курток, пальто та пуховиків URBAN. Швидка доставка Новою Поштою по Україні.</description>'
    ]

    for p in feed_items:
        desc_parts = [p['name']]
        if p.get('mat'): desc_parts.append(f"Матеріал: {p['mat']}")
        if p.get('sizes'): desc_parts.append(f"Розміри: {', '.join(p['sizes'][:6])}")
        desc_parts.append(f"Арт: {p['art']}")
        desc_str = ' • '.join(desc_parts)

        main_img = p['imgs'][0] if p.get('imgs') else 'https://urbangrid.com.ua/images/outerwear.webp'
        g_gender = 'male' if p.get('gender') == 'men' else ('female' if p.get('gender') == 'women' else 'unisex')
        feed_brand = p.get('brand_name') or 'URBAN'
        feed_xml_lines.extend([
            '    <item>',
            f'      <g:id>prod-{p["id"]}</g:id>',
            f'      <title>{escape(p["name"])}</title>',
            f'      <description>{escape(desc_str)}</description>',
            f'      <link>https://urbangrid.com.ua/#prod-{p["id"]}</link>',
            f'      <g:image_link>{main_img}</g:image_link>',
            f'      <g:brand>{escape(feed_brand)}</g:brand>',
            f'      <g:gender>{g_gender}</g:gender>',
            '      <g:age_group>adult</g:age_group>',
            '      <g:condition>new</g:condition>',
            '      <g:availability>in_stock</g:availability>',
            f'      <g:price>{p["price"]} UAH</g:price>',
            '      <g:google_product_category>203</g:google_product_category>',
            '      <g:product_type>Одяг &gt; Верхній одяг &gt; Куртки та пальто</g:product_type>',
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


if __name__ == '__main__':
    main()
