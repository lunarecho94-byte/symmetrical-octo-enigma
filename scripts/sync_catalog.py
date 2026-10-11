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
import subprocess
import urllib.request
import urllib.parse
import http.cookiejar
import html as html_lib
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
    'denim tears': ('denim_tears', 'Denim Tears'),
    'c.p. company': ('cp_company', 'C.P. Company'),
    'c.p.  company': ('cp_company', 'C.P. Company'),
    'cp company': ('cp_company', 'C.P. Company'),
    'cp. company': ('cp_company', 'C.P. Company'),
    'c.p.company': ('cp_company', 'C.P. Company'),
    'cp.': ('cp_company', 'C.P. Company'),
    'mertra': ('mertra', 'Mertra'),
    'valentino': ('valentino', 'Valentino'),
    'moncler x valentino': ('moncler', 'Moncler x Valentino'),
    'moncler x palm angels': ('moncler', 'Moncler x Palm Angels'),
    'palm angels': ('palm_angels', 'Palm Angels'),
    'armani exchange': ('armani', 'Armani Exchange'),
    'armani': ('armani', 'Armani Exchange'),
    'trapstar': ('trapstar', 'Trapstar'),
    'jordan x psg': ('jordan', 'Jordan x PSG'),
    'psg': ('jordan', 'Jordan x PSG'),
    'broken planet': ('broken_planet', 'Broken Planet'),
    'yarm': ('yarm', 'YARM'),
    'ruthles': ('ruthles', 'Ruthles'),
    'penjoy life': ('enjoy_life', 'Enjoy Life'),
    'enjoy life': ('enjoy_life', 'Enjoy Life'),
    'blackarmada': ('blackarmada', 'Black Armada'),
    'black armada': ('blackarmada', 'Black Armada'),
    'omialpha': ('omialpha', 'Omialpha'),
    'pioneer': ('pioneer', 'Pioneer'),
    'blackenerge': ('blackenerge', 'Blackenerge'),
    'decency concept': ('decency_concept', 'Decency Concept'),
    're star': ('re_star', 'Re Star'),
    'mafavintage': ('mafavintage', 'Mafavintage'),
    'milko': ('milko', 'Milko'),
}

SUPPLIER_TOKENS = {
    '911': '25162466829867',
    'lastore': '25162466829867',
    'moloko': '78230719008224',
}

WOMEN_IDS = {
    '201252', '201254', '201253', '201679', '197755', '192325',
    '201708', '201710', '197765',
    '194901',
    '197749', '197751', '143436', '143437',
    '188355', '188357', '188356',
    '192323', '192324', '137043',
    '212319', '212321', '212320', '198789', '198790', '131883', '131885', '131884', '139295', '71984', '194647', '194653', '194655', '194656',
    '201705', '201706', '193785', '193787', '193786', '141977', '141976', '138573', '138574', '136823', '76829', '76830', '127833', '127834', '194863'
}

PINNED_PRODUCT_IDS = []



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
    if len(clean_name.split()) > 2 or any(w in b_low for w in ['куртка', 'курточка', 'бомбер', 'худі', 'зіп', 'штани', 'вітровка', 'вітрівка', 'жилетка', 'пальто', 'олімпійка']):
        return 'urban', 'URBAN'
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


def fetch_mydrop_category(vendor_id, category_id, markup=0.20, min_stock=2):
    url = f"{BACKEND_BASE_URL}/vendors/{vendor_id}/products?categoryId={category_id}"
    req = urllib.request.Request(url, headers=HEADERS)
    print(f"Fetching MyDrop category {category_id} (vendor {vendor_id}, націнка: {markup*100:.0f}%, мін. наявність: {min_stock})...")
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f"Error fetching MyDrop category {category_id}: {e}")
        return None

    results = data.get('results', [])
    print(f"Found {len(results)} items in MyDrop category {category_id}. Filtering items with stock >= {min_stock}...")

    eligible_items = []
    for itm in results:
        sizes = itm.get('sizes', [])
        valid_sizes = [s for s in sizes if s.get('availableDropshipper') and 'нюанс' not in s.get('title', '').lower()]
        total_qty = sum(s.get('realCountDropshipper', 0) for s in valid_sizes)
        avail_count = len(valid_sizes)
        if total_qty >= min_stock or (avail_count >= min_stock and total_qty > 0):
            eligible_items.append(itm)
        else:
            print(f"Skipping MyDrop item {itm.get('id')} ({itm.get('title')}): stock {total_qty} < {min_stock}")

    print(f"Eligible items with stock >= {min_stock}: {len(eligible_items)} of {len(results)}.")

    def fetch_full_and_transform(itm):
        pid = itm['id']
        full_p = fetch_mydrop_product(vendor_id, pid)
        if not full_p:
            full_p = itm
        transformed = transform_mydrop_product(full_p, markup=markup)
        if transformed and transformed.get('imgs'):
            ensure_local_thumbnail(pid, transformed['imgs'][0])
        return transformed

    with ThreadPoolExecutor(max_workers=5) as ex:
        products = [p for p in ex.map(fetch_full_and_transform, eligible_items) if p]

    print(f"Successfully processed {len(products)} MyDrop products.")
    return products



def ensure_local_thumbnail(pk, remote_img_path):
    if not remote_img_path:
        return
    catalog_dir = os.path.join(PROJECT_DIR, 'images', 'catalog')
    os.makedirs(catalog_dir, exist_ok=True)
    thumb_path = os.path.join(catalog_dir, f"{pk}.jpg")
    if os.path.exists(thumb_path) and os.path.getsize(thumb_path) > 30000:
        return
    remote_url = remote_img_path if remote_img_path.startswith('http') else f"https://easydrop.one{remote_img_path}"
    temp_path = os.path.join(catalog_dir, f"{pk}_tmp.jpg")
    try:
        req = urllib.request.Request(remote_url, headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'})
        with urllib.request.urlopen(req, timeout=15, context=ctx) as r:
            with open(temp_path, 'wb') as f:
                f.write(r.read())
        subprocess.run(['sips', '-Z', '800', '-s', 'format', 'jpeg', '-s', 'formatOptions', '85', temp_path, '--out', thumb_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if os.path.exists(temp_path):
            os.remove(temp_path)
    except Exception as e:
        print(f"Warning downloading thumb {pk}: {e}")


def fetch_easydrop_category(token, category_id, markup=0.20):
    url = f"https://easydrop.one/supplier-catalog/{token}/{category_id}/"
    cj = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj), urllib.request.HTTPSHandler(context=ctx))

    print(f"Fetching EasyDrop catalog: {url} (націнка: {markup*100:.0f}%)...")
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    try:
        with opener.open(req, timeout=15) as r:
            html = r.read().decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"Error loading EasyDrop URL: {e}")
        return None

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
        raw_brand = html_lib.unescape(h5.group(1).strip()) if h5 else ''
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

        # Images (High-resolution photos + size chart, exclude low-quality itemimage thumbnails)
        base_m = re.search(r'showImage\([\'\"]([^\'\"]+)[\'\"]\)', card_html)
        base_img = base_m.group(1).strip() if base_m else ''
        mini_m = re.search(r'<img [^>]*src=[\'\"]([^\'\"]+)[\'\"]', card_html)
        mini_img = mini_m.group(1).strip() if mini_m else ''
        gal_imgs = galleries.get(pk, [])

        # Filter out low-resolution itemimage previews
        clean_raw_imgs = []
        for img_path in (gal_imgs + [base_img]):
            if not img_path: continue
            if 'itemimage' in img_path: continue
            clean_raw_imgs.append(img_path)

        if not clean_raw_imgs and mini_img:
            clean_raw_imgs.append(mini_img)

        # Auto-download and compress thumbnail locally for catalog cards
        ensure_local_thumbnail(pk, clean_raw_imgs[0] if clean_raw_imgs else mini_img)
        local_thumb = f"/images/catalog/{pk}.jpg"

        img_list = []
        for img_path in clean_raw_imgs:
            full_url = img_path if img_path.startswith('http') else f"https://easydrop.one{img_path}"
            if full_url not in img_list:
                img_list.append(full_url)

        if not img_list and local_thumb:
            img_list = [local_thumb]

        # Extract extra model info from raw_brand if present
        brand_lower = brand_name.lower()
        raw_lower = raw_brand.lower()
        model_part = raw_brand
        if raw_lower.startswith(brand_lower):
            model_part = raw_brand[len(brand_name):].strip()
        model_part = re.sub(r'[\'"]', '', model_part).strip()
        model_part = re.sub(r'(?i)\b(puffer\s+jacket|jacket|куртка)\b', '', model_part).strip()
        model_part = ' '.join(model_part.split())

        # Title & Category
        is_vest = 'жилет' in raw_brand.lower() or 'жилет' in card_html.lower()[:300]
        if is_vest:
            subcat = 'vest'
            cat_name = 'Одяг & Жилетки'
            brand_slug = 'urban'
            brand_name = 'URBAN'
            title = f"Утеплений жилет {sku}"
            season = 'demi'
            season_name = 'Демісезон / Утеплений'
            badge = 'Хіт • Утеплений'
            mat = '100% поліестер / Водовідштовхувальна плащівка / Холофайбер'
            origin = 'Фабричне виробництво (Туреччина)'
            desc = (
                f"Стильний утеплений чоловічий жилет URBAN ({sku}). "
                f"Якісна водовідштовхувальна плащівка (100% поліестер), надійний наповнювач холофайбер для збереження тепла та захисту від вітру. "
                f"Зручні місткі кишені, анатомічний крій та комфортна посадка. {origin}."
            )
        else:
            subcat = 'winter_jacket'
            cat_name = 'Одяг & Зимові куртки'
            title = f"Зимова куртка {brand_name} {sku}"
            season = 'winter'
            season_name = 'Зима / Утеплена'
            badge = 'Зима • Термо'
            mat = '100% поліестер / Водовідштовхувальна плащівка / Холофайбер'
            origin_m = re.search(r'<tr class=\"text-left\"><td colspan=\"3\">\s*(.*?)\s*</td></tr>', card_html)
            origin_text = origin_m.group(1).strip() if origin_m else 'Турция'
            origin = 'Фабричне виробництво (Туреччина)' if 'турц' in origin_text.lower() else 'Фабричне виробництво'
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
            'subcat': subcat,
            'cat_name': cat_name,
            'season': season,
            'season_name': season_name,
            'brand': brand_slug,
            'brand_name': brand_name,
            'gender': 'women' if str(pk) in WOMEN_IDS else 'men',
            'art': sku,
            'color': '',
            'mat': mat,
            'origin': origin,
            'badge': badge,
            'desc': desc,
            'thumb': local_thumb,
            'imgs': img_list,
            'sizes': final_sizes,
            'in_stock': len(final_sizes) > 0
        })

    print(f"Successfully processed {len(products)} EasyDrop products.")
    return products


def transform_mydrop_product(p, markup=0.20):
    pid = str(p['id'])
    raw_title = (p.get('title') or '').strip()
    clean_title = re.sub(r'\s*\([Кк]опія\)', '', raw_title).strip()
    clean_title = re.sub(r'\s+,', ',', clean_title)
    sku = (p.get('sku') or f"ART{pid}").strip()
    title_lower = clean_title.lower()

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
        elif 'графіт' in title_lower or 'graphite' in title_lower: color = 'Графіт'
        elif 'чорн' in title_lower or 'black' in title_lower: color = 'Чорний'
        elif 'сір' in title_lower or 'grey' in title_lower: color = 'Сірий'
        elif 'біл' in title_lower or 'молоч' in title_lower or 'white' in title_lower: color = 'Білий'
        elif 'беж' in title_lower or 'beige' in title_lower: color = 'Бежевий'
        elif 'broken planet' in title_lower: color = 'Чорний'

    # Category, subcategory, season classification
    if 'жилет' in title_lower or 'безрукав' in title_lower:
        cat = 'clothing'
        subcat = 'vest'
        cat_name = 'Одяг & Жилетки'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Водовідштовхувальна плащівка / Холофайбер'
        badge = 'Хіт'
    elif 'анорак' in title_lower:
        cat = 'clothing'
        subcat = 'winter_jacket'
        cat_name = 'Одяг & Анораки'
        season = 'winter'
        season_name = 'Зима / Утеплений'
        mat = 'Водовідштовхувальна плащівка / Рефлективні вставки / Утеплювач'
        badge = 'Рефлектив • Утеплений'
    elif 'джинсов' in title_lower:
        cat = 'clothing'
        subcat = 'jacket'
        cat_name = 'Одяг & Джинсові куртки'
        season = 'demi'
        season_name = 'Демісезон'
        mat = '100% щільний якісний денім (бавовна)'
        badge = 'Денім • Хіт'
    elif 'бомбер' in title_lower:
        cat = 'clothing'
        subcat = 'jacket'
        cat_name = 'Одяг & Бомбери'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Щільна зносостійка плащівка / Трикотажні манжети'
        badge = 'Бомбер'
    elif 'вітровк' in title_lower or 'вітрівк' in title_lower or 'олімпійк' in title_lower:
        cat = 'clothing'
        subcat = 'jacket'
        cat_name = 'Одяг & Вітровки' if ('вітровк' in title_lower or 'вітрівк' in title_lower) else 'Одяг & Олімпійки'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Легка вітрозахисна водовідштовхувальна плащівка'
        badge = 'Вітрозахисна'
    elif 'пальто' in title_lower:
        cat = 'clothing'
        subcat = 'jacket'
        cat_name = 'Одяг & Пальто'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Преміальне вовняне сукно / Кашемір'
        badge = 'Класика'
    elif 'демісезон' in title_lower or 'демі' in title_lower:
        cat = 'clothing'
        subcat = 'jacket'
        cat_name = 'Одяг & Демісезонні куртки'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Плащівка матова (100% поліестер)'
        badge = 'Демісезон'
    elif 'дублянк' in title_lower or 'хутро' in title_lower or 'пуховик' in title_lower or 'парка' in title_lower or 'куртка' in title_lower or 'зим' in title_lower or 'тепл' in title_lower:
        cat = 'clothing'
        subcat = 'winter_jacket'
        cat_name = 'Одяг & Зимові куртки'
        season = 'winter'
        season_name = 'Зима / Утеплена'
        if 'teddi' in title_lower or 'тедді' in title_lower:
            mat = 'Шерпа / Штучне хутро Teddi / Утеплювач'
            badge = 'Teddi • Тепла'
        elif 'хутро' in title_lower:
            mat = 'Плащівка / М’яке штучне хутро / Утеплювач'
            badge = 'Хутро • Тепла'
        else:
            mat = '100% поліестер / Водовідштовхувальна плащівка / Холофайбер'
            badge = 'Зима • Термо'
    elif 'косух' in title_lower:
        cat = 'clothing'
        subcat = 'leather'
        cat_name = 'Одяг & Косухи'
        season = 'demi'
        season_name = 'Демісезон'
        mat = "М'яка еко-шкіра"
        badge = 'Еко-шкіра'
    elif 'худі' in title_lower or 'hoodie' in title_lower or 'зіп' in title_lower or 'світшот' in title_lower:
        cat = 'clothing'
        subcat = 'zip_hoodie'
        cat_name = 'Одяг & Зіп-худі' if ('зіп' in title_lower or 'zip' in title_lower) else 'Одяг & Худі'
        season = 'winter' if 'фліс' in title_lower else 'demi'
        season_name = 'Зима / Фліс' if 'фліс' in title_lower else 'Демісезон'
        mat = 'Трьохнитка на флісі (бавовна / поліестер)' if 'фліс' in title_lower else 'Преміальна трьохнитка пеньє (100% бавовна)'
        badge = 'Оверсайз' if 'oversize' in title_lower else ('Фліс • Тепле' if 'фліс' in title_lower else 'Хіт сезону')
    else:
        cat = 'clothing'
        subcat = 'jacket'
        cat_name = 'Одяг & Куртки'
        season = 'demi'
        season_name = 'Демісезон'
        mat = 'Плащівка матова (100% поліестер)'
        badge = 'Новинка'

    if sku.lower().startswith('ya'):
        brand_slug, brand_name = 'yarm', 'YARM'
    else:
        brand_slug, brand_name = resolve_brand(clean_title)

    gender = 'women' if ('жіноч' in title_lower or 'жінк' in title_lower) else 'men'

    raw_desc = p.get('description') or ''
    clean_lines = []
    for line in raw_desc.split('\n'):
        line_clean = re.sub(r'[\U00010000-\U0010ffff\u2000-\u3300]', '', line).strip()
        line_clean = re.sub(r'^[•\-\*\s]+', '', line_clean).strip()
        if line_clean and not any(line_clean.lower().startswith(x) for x in ['артикул:', 'розміри:']):
            clean_lines.append(line_clean)
    if clean_lines:
        desc = '\n'.join(clean_lines)
    elif subcat == 'vest':
        desc = f"Стильна брендова жилетка {clean_title}. Якісна водовідштовхувальна плащівка, надійний легкий утеплювач холофайбер для захисту від вітру та холоду. Зручні місткі кишені, анатомічний крій та якісна фурнітура. Фабричне виробництво."
    elif 'анорак' in title_lower:
        desc = f"Теплий брендовий анорак {clean_title}. Якісна водовідштовхувальна плащівка з надійним захистом від негоди, рефлективні вставки, зручна кишеня-кенгуру та м'який утеплювач. Фабричне виробництво."
    elif subcat == 'winter_jacket':
        desc = f"Теплий зимовий брендовий пуховик {clean_title}. Якісна водовідштовхувальна плащівка ({mat}), надійний утеплювач для захисту від морозів та вітру. Зручні місткі кишені, анатомічний крій та якісна фурнітура. Фабричне виробництво."
    elif subcat == 'zip_hoodie':
        type_word = "зіп-худі" if ('зіп' in title_lower or 'zip' in title_lower) else "худі"
        desc = f"Стильне брендове {type_word} {brand_name} {clean_title}. Преміальна щільна трьохнитка ({mat}), зручний подвійний капюшон, якісна фурнітура, місткі кишені та комфортний крій. Фабричне виробництво."
    elif 'бомбер' in title_lower:
        desc = f"Стильний брендовий бомбер {clean_title}. Якісна зносостійка тканина ({mat}), зручний крій, еластичні манжети та надійна фурнітура. Фабричне виробництво."
    elif 'джинсов' in title_lower:
        desc = f"Стильна джинсова куртка {clean_title}. Натуральний якісний денім ({mat}), автентичний streetwear крій, міцні ґудзики та місткі кишені. Фабричне виробництво."
    elif 'вітровк' in title_lower or 'вітрівк' in title_lower or 'олімпійк' in title_lower:
        desc = f"Легка брендова вітровка {clean_title}. Надійний захист від вітру та легкої негоди ({mat}), комфортна посадка, якісна блискавка. Фабричне виробництво."
    elif 'пальто' in title_lower:
        desc = f"Стильне вкорочене пальто {clean_title}. Преміальна тканина ({mat}), елегантний класичний крій, комфортна посадка та надійна фурнітура. Фабричне виробництво."
    else:
        desc = f"{clean_title}. Якісний матеріал ({mat}), зручний крій, надійні застібки."

    imgs = []
    if p.get('images'):
        for img in p['images']:
            if img.get('filename') and not img.get('deleted'):
                imgs.append(f"https://backend.mydrop.com.ua/vendor/products/uploads/{img['filename']}")
    if not imgs and p.get('titleImage') and p['titleImage'].get('filename'):
        imgs.append(f"https://backend.mydrop.com.ua/vendor/products/uploads/{p['titleImage']['filename']}")

    clean_sizes = []
    for s in p.get('sizes', []):
        stitle = s.get('title', '').strip().upper()
        if s.get('availableDropshipper') and 'нюанс' not in s.get('title', '').lower():
            if stitle and stitle not in clean_sizes:
                clean_sizes.append(stitle)
    if not clean_sizes:
        for s in p.get('sizes', []):
            stitle = s.get('title', '').strip().upper()
            if 'нюанс' not in s.get('title', '').lower() and stitle and stitle not in clean_sizes:
                clean_sizes.append(stitle)

    slug = f"{slugify(clean_title)}-{pid}"
    thumb = f"/images/catalog/{pid}.jpg"

    return {
        'id': str(pid),
        'slug': slug,
        'name': clean_title,
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
        'thumb': thumb,
        'imgs': imgs,
        'sizes': clean_sizes,
        'in_stock': len(clean_sizes) > 0
    }


def parse_source_url(url_str, markup=0.20):
    u = url_str.strip()

    # EasyDrop category URL e.g. supplier-catalog/78230719008224/4122/
    m_ed = re.search(r'easydrop\.one/supplier-catalog/(\w+)/(\d+)', u)
    if m_ed:
        token = m_ed.group(1)
        cat_id = m_ed.group(2)
        resolved_token = SUPPLIER_TOKENS.get(token, token)
        return {
            'type': 'easydrop_category',
            'token': resolved_token,
            'category_id': cat_id,
            'url': f"https://easydrop.one/supplier-catalog/{resolved_token}/{cat_id}/",
            'markup': markup
        }

    # EasyDrop catalog-view cabinet URL e.g. easydrop.one/catalog-view/911/15395/
    m_cv = re.search(r'easydrop\.one/catalog-view/(\w+)/(\d+)', u)
    if m_cv:
        supplier_id = m_cv.group(1)
        cat_id = m_cv.group(2)
        resolved_token = SUPPLIER_TOKENS.get(supplier_id, supplier_id)
        return {
            'type': 'easydrop_category',
            'token': resolved_token,
            'category_id': cat_id,
            'url': f"https://easydrop.one/supplier-catalog/{resolved_token}/{cat_id}/",
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
            return {'type': 'mydrop_category', 'vendor_id': vendor_id, 'category_id': str(cat_id), 'vendor_slug': vendor_slug, 'url': u, 'markup': markup, 'min_stock': 2}

    return None


def generate_meta_dict(products):
    women_count = sum(1 for p in products if p.get('gender') == 'women')
    men_count = sum(1 for p in products if p.get('gender') == 'men')

    subcat_counts = Counter(p['subcat'] for p in products)
    season_counts = Counter(p['season'] for p in products)
    brand_counts = Counter(p['brand'] for p in products)

    subcat_names = {
        'winter_jacket': 'Зимові куртки та пуховики',
        'jacket': 'Демісезонні куртки',
        'leather': 'Косухи',
        'zip_hoodie': 'Худі та зіп-худі',
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

    # Always put newest loaded products at the beginning of the catalog (latest added source first, then newest item id)
    products.sort(key=lambda p: (p.get('source_priority', 0), int(p.get('id', 0))), reverse=True)

    with open(OUTPUT_PRODUCTS, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, indent=2)
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
    existing_products = []
    if os.path.exists(OUTPUT_PRODUCTS):
        try:
            with open(OUTPUT_PRODUCTS, encoding='utf-8') as f:
                existing_products = json.load(f)
        except Exception:
            existing_products = []

    synced_products = []
    seen_pids = set()
    failed_sources = []

    for s_idx, s in enumerate(sources):
        stype = s.get('type')
        markup = float(s.get('markup', 0.20))

        if stype == 'easydrop_category':
            token = s.get('token')
            cid = s.get('category_id')
            if token and cid:
                items = fetch_easydrop_category(token, cid, markup=markup)
                if items is None:
                    failed_sources.append(s)
                else:
                    for itm in items:
                        if str(itm['id']) not in seen_pids:
                            seen_pids.add(str(itm['id']))
                            itm['source_priority'] = s_idx
                            synced_products.append(itm)

        elif stype == 'mydrop_product':
            vid = s.get('vendor_id')
            pid = s.get('product_id')
            if vid and pid:
                pdata = fetch_mydrop_product(vid, pid)
                if pdata and str(pdata['id']) not in seen_pids:
                    seen_pids.add(str(pdata['id']))
                    transformed = transform_mydrop_product(pdata, markup=markup)
                    transformed['source_priority'] = s_idx
                    synced_products.append(transformed)

        elif stype == 'mydrop_category':
            vid = s.get('vendor_id')
            cid = s.get('category_id')
            min_stock = int(s.get('min_stock', 2))
            if vid and cid:
                items = fetch_mydrop_category(vid, cid, markup=markup, min_stock=min_stock)
                if items is None:
                    failed_sources.append(s)
                else:
                    for itm in items:
                        if str(itm['id']) not in seen_pids:
                            seen_pids.add(str(itm['id']))
                            itm['source_priority'] = s_idx
                            synced_products.append(itm)

    if failed_sources:
        print(f"Safety guard triggered: {len(failed_sources)} of {len(sources)} sources failed to load (network/server error). Keeping existing catalog intact to prevent data loss.")
        return

    if not synced_products and sources:
        print("Safety guard triggered: active sources exist but 0 products were fetched (network issue / error). Keeping existing catalog intact.")
        return

    if existing_products and len(synced_products) < int(len(existing_products) * 0.7):
        print(f"Safety guard triggered: synced only {len(synced_products)} items, while existing catalog has {len(existing_products)} items. Keeping existing catalog intact.")
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

        # If source exists, bump it to the end so it gets highest priority (newest additions at top of catalog)
        existing_match = None
        for s in sources:
            if s.get('type') == parsed['type'] and s.get('url') == parsed.get('url'):
                existing_match = s
                break
        if existing_match:
            sources.remove(existing_match)
            existing_match['markup'] = markup
            sources.append(existing_match)
            added_any = True
            print(f"Bumped existing source to newest top priority: {existing_match}")
        else:
            sources.append(parsed)
            added_any = True
            print(f"Added new source to top priority: {parsed}")

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
