#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
URBAN — Catalog Synchronization Engine
Synchronizes products from MyDrop for Maison Margiela zip-hoodies.
Supplier: Ro&Go Drop (Vendor ID: 26510), Category: 144063
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

MYDROP_VENDOR_ID = 26510  # Ro&Go Drop (https://mydrop.com.ua/rogo)
TARGET_CATEGORY_ID = 144063  # Зіп-худі Maison Margiela
BACKEND_BASE_URL = 'https://backend.mydrop.com.ua/dropshipper'

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*'
}


def fetch_category_products(category_id=TARGET_CATEGORY_ID, vendor_id=MYDROP_VENDOR_ID):
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


def fetch_product_details(products, vendor_id=MYDROP_VENDOR_ID):
    """Fetches full product details including image galleries, params, and descriptions concurrently."""
    print(f"Fetching full product details for {len(products)} items...")

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


def transform_product(p):
    """Transforms a MyDrop product object into the store schema with 25% markup."""
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

    # Title formatting: unique, clean, readable
    if color:
        title = f"Зіп-худі Maison Margiela {sku} ({color})"
    else:
        title = f"Зіп-худі Maison Margiela {sku}"

    # Pricing: Supplier drop price + 25% markup
    drop_price = int(float(p.get('dropPrice') or 1150))
    # 25% markup: 1150 * 1.25 = 1437.5 -> rounded to 10 грн is 1440 грн
    price = int(round(drop_price * 1.25 / 10) * 10)
    # Old price: 1800 грн gives a 20% discount badge: (1800 - 1440) / 1800 = 20%
    old_price = int(round(price * 1.25 / 10) * 10)

    # Product specifications
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

    # Clean description
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


def main():
    parser = argparse.ArgumentParser(description="Synchronize MyDrop Maison Margiela zip-hoodies catalog.")
    parser.add_argument('--download', action='store_true', help="Download fresh catalog from supplier API")
    args = parser.parse_args()

    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Fetch products from MyDrop
    raw_products = fetch_category_products(TARGET_CATEGORY_ID, MYDROP_VENDOR_ID)
    if not raw_products:
        print("Warning: No products fetched from target category.")
        return

    # 2. Fetch full specifications
    detailed_products = fetch_product_details(raw_products)

    # 3. Transform to store schema
    products = [transform_product(p) for p in detailed_products]

    if len(products) < 5:
        print(f"Safety guard triggered: Fetched only {len(products)} products (expected >= 5). Keeping existing files.")
        return

    # Prioritize: in-stock first, then sort by SKU ascending (ZMM001, ZMM002, ...)
    def sku_sort_key(item):
        sku = item.get('art', '')
        num_match = re.search(r'\d+', sku)
        num = int(num_match.group()) if num_match else 9999
        return (0 if item['in_stock'] else 1, num, sku)

    products.sort(key=sku_sort_key)

    # Save data/products.json
    with open(OUTPUT_PRODUCTS, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Saved {OUTPUT_PRODUCTS} ({os.path.getsize(OUTPUT_PRODUCTS)} bytes, {len(products)} products)")

    # 4. Generate data/meta.json
    meta = {
        'total': len(products),
        'genders': [
            {'slug': 'all', 'name': 'Всі товари', 'icon': '', 'count': len(products)},
            {'slug': 'women', 'name': 'Жіночі', 'icon': '', 'count': len(products)},
            {'slug': 'men', 'name': 'Чоловічі', 'icon': '', 'count': len(products)},
        ],
        'categories': [
            {'slug': 'all', 'name': 'Всі моделі', 'icon': '', 'count': len(products)},
            {'slug': 'zip_hoodie', 'name': 'Зіп-худі Maison Margiela', 'icon': '', 'count': len(products)},
        ],
        'seasons': [
            {'slug': 'all', 'name': 'Всі сезони', 'icon': '', 'count': len(products)},
            {'slug': 'demi', 'name': 'Демісезон', 'icon': '', 'count': len(products)},
        ],
        'brands': [
            {'slug': 'all', 'name': 'Всі бренди', 'count': len(products)},
            {'slug': 'maison_margiela', 'name': 'Maison Margiela', 'count': len(products)},
        ]
    }

    with open(OUTPUT_META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Saved {OUTPUT_META} with {len(meta['categories'])} categories and {len(meta['brands'])} brands")

    # 5. Generate feed.xml for Google/Meta Merchant
    feed_items = products
    feed_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
        '  <channel>',
        '    <title>URBAN — Зіп-худі Maison Margiela</title>',
        '    <link>https://urbangrid.com.ua</link>',
        '    <description>Каталог оригінальних зіп-худі Maison Margiela від URBAN. Швидка доставка Новою Поштою по Україні.</description>'
    ]

    for p in feed_items:
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
            f'      <g:brand>Maison Margiela</g:brand>',
            f'      <g:gender>unisex</g:gender>',
            '      <g:age_group>adult</g:age_group>',
            '      <g:condition>new</g:condition>',
            '      <g:availability>in_stock</g:availability>',
            f'      <g:price>{p["price"]} UAH</g:price>',
            '      <g:google_product_category>212</g:google_product_category>',
            '      <g:product_type>Одяг &gt; Толстовки та худі &gt; Зіп-худі</g:product_type>',
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

    # 6. Generate sitemap.xml strictly for in-stock products for sale
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
    print(f"Saved {OUTPUT_SITEMAP} with {len(in_stock_products)} URLs (matching items for sale)")


if __name__ == '__main__':
    main()
