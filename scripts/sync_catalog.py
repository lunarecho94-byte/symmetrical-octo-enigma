#!/usr/bin/env python3
"""
sync_catalog.py
Parses easydrop_export.xml and creates optimized data/products.json and data/meta.json
"""

import os
import sys
import re
import json
import urllib.request
import tempfile
import shutil
import xml.etree.ElementTree as ET
from collections import defaultdict, Counter

EXPORT_FILE = 'easydrop_export.xml'
EXPORT_URL = (
    "https://easydrop.one/prom-export?key=96092464432393,30816448450308,25162466829867,"
    "12333849528094,80233932855850,30580088002009,70419283037987,63422357219127,"
    "96825986992025,40170268472376,11341144510008,47558675150578,30048652742791,"
    "20168635902038,64017479183198,61619894907221,89534434099545,26277378991043,"
    "50967565248169,94320236562495&pid=86764974149158"
)
OUTPUT_PRODUCTS = 'data/products.json'
OUTPUT_META = 'data/meta.json'

def download_export_feed():
    print("Downloading latest XML feed from EasyDrop...")
    req = urllib.request.Request(
        EXPORT_URL,
        headers={'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'}
    )
    temp_path = EXPORT_FILE + '.tmp'
    try:
        with urllib.request.urlopen(req, timeout=90) as response, open(temp_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
        
        file_size = os.path.getsize(temp_path)
        if file_size < 100000:
            raise ValueError(f"Downloaded file too small: {file_size} bytes")
        with open(temp_path, 'rb') as f:
            header = f.read(500).decode('utf-8', errors='ignore')
            if '<?xml' not in header and '<yml_catalog' not in header:
                raise ValueError("Downloaded file is not valid XML")
                
        os.replace(temp_path, EXPORT_FILE)
        print(f"Successfully downloaded and updated {EXPORT_FILE} ({file_size} bytes)")
        return True
    except Exception as e:
        print(f"Warning: Failed to download feed ({e}). Falling back to existing {EXPORT_FILE} if available.")
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                pass
        if not os.path.exists(EXPORT_FILE):
            raise
        return False

def clean_text(s):
    if not s:
        return ''
    s = re.sub(r'\s+', ' ', s)
    return s.strip()

def sort_sizes(sizes):
    # Try numeric sorting if all are numbers
    num_sizes = []
    text_sizes = []
    size_order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL', '5XL']
    
    for s in sizes:
        s_clean = s.strip().upper()
        # Check if float/int
        try:
            val = float(s_clean.replace(',', '.'))
            num_sizes.append((val, s))
        except ValueError:
            text_sizes.append(s)
            
    if num_sizes and not text_sizes:
        num_sizes.sort(key=lambda x: x[0])
        return [x[1] for x in num_sizes]
    
    if text_sizes and not num_sizes:
        def get_order(txt):
            t = txt.upper()
            if t in size_order:
                return size_order.index(t)
            return 999
        text_sizes.sort(key=get_order)
        return text_sizes
        
    return sizes

# Precise categorization regexes
BAG_KEYWORDS = re.compile(
    r'сумк|рюкзак|бананка|месенджер|портмоне|гаманець|кошелек|клатч|шопер|шоппер|валіза|чемодан|холдер|баул|'
    r'\bbag\b|\bbags\b|\bbackpack\b|\bwallet\b|\btote\b|\bhandbag\b|\bcrossbody\b|\bкейс\b|'
    r'\bочки\b|окуляр|пасок|\bремінь\b|\bремень\b|браслет|годинник|кардхолдер',
    re.I
)

CLOTHING_KEYWORDS = re.compile(
    r'костюм|худі|худи|світшот|толстовка|вітровк|ветровк|куртк|пуховик|штани|штаны|джинс|футболк|шорти|шорты|'
    r'жилет|анорак|парка|бомбер|спідниц|сукня|плать|лонгслів|светр|кофта|кардиган|сорочк|рубашк|поло\b|майк|'
    r'топ\b|термобілизн|білизн|шкарпетк|носк|шапк|кепк|панам|баф\b|tracksuit|hoodie|jacket|pants|shorts|t-shirt|tee\b',
    re.I
)

WINTER_KEYWORDS = re.compile(
    r'\bugg\b|угг|черевик|ботинки|ботильон|\bboots\b|\bboot\b|хутро|\bмех\b|зимов|winter|сноубутс|дутики|мунбут|moon boot',
    re.I
)

KNOWN_BRANDS = [
    ('nike', 'Nike', [r'nike', r'dunk', r'air max', r'p-6000', r'force 1', r'shox', r'initiator', r'nocta', r'vomero', r'v2k']),
    ('jordan', 'Air Jordan', [r'jordan']),
    ('newbalance', 'New Balance', [r'new balance', r'\bnb\b', r'9060', r'1906', r'530', r'2002', r'725', r'550', r'574', r'990']),
    ('adidas', 'Adidas', [r'adidas', r'yeezy', r'niteball', r'samba', r'spezial', r'campus', r'gazelle', r'forum', r'adi 2000']),
    ('asics', 'Asics', [r'asics', r'onitsuka']),
    ('salomon', 'Salomon', [r'salomon']),
    ('ugg', 'UGG', [r'\bugg\b', r'угг']),
    ('puma', 'Puma', [r'puma']),
    ('vans', 'Vans', [r'\bvans\b']),
    ('drmartens', 'Dr. Martens', [r'martens', r'мартенс']),
    ('stoneisland', 'Stone Island', [r'stone island', r'\bsi\b']),
    ('tnf', 'The North Face', [r'north face', r'\btnf\b']),
    ('trapstar', 'Trapstar', [r'trapstar']),
    ('prada', 'Prada', [r'prada']),
    ('gucci', 'Gucci', [r'gucci']),
    ('dior', 'Dior', [r'dior']),
    ('chanel', 'Chanel', [r'chanel']),
    ('louisvuitton', 'Louis Vuitton', [r'louis vuitton', r'\blv\b']),
    ('balenciaga', 'Balenciaga', [r'balenciaga']),
    ('coach', 'Coach', [r'coach']),
    ('pinko', 'Pinko', [r'pinko']),
    ('diesel', 'Diesel', [r'diesel']),
    ('saintlaurent', 'Yves Saint Laurent', [r'saint laurent', r'ysl']),
    ('michaelkors', 'Michael Kors', [r'michael kors']),
    ('lacoste', 'Lacoste', [r'lacoste']),
    ('carhartt', 'Carhartt', [r'carhartt']),
    ('stussy', 'Stussy', [r'stussy']),
    ('underarmour', 'Under Armour', [r'under armour']),
    ('bottega', 'Bottega Veneta', [r'bottega']),
    ('loropiana', 'Loro Piana', [r'loro piana']),
    ('miumiu', 'Miu Miu', [r'miu miu']),
    ('mcqueen', 'Alexander McQueen', [r'mcqueen']),
    ('hugo', 'Hugo Boss', [r'hugo', r'boss']),
    ('premiata', 'Premiata', [r'premiata']),
    ('oncloud', 'On Cloud', [r'\bon\b.*cloud', r'cloudmonster', r'cloudtilt', r'cloudsurfer', r'on running']),
    ('hermes', 'Hermes', [r'hermes', r'hermès']),
    ('offwhite', 'Off-White', [r'off-white', r'off white']),
    ('goldengoose', 'Golden Goose', [r'golden goose']),
    ('celine', 'Celine', [r'celine', r'céline']),
    ('converse', 'Converse', [r'converse', r'chuck taylor', r'all star']),
    ('calvinklein', 'Calvin Klein', [r'calvin klein', r'\bck\b']),
    ('dolcegabbana', 'Dolce & Gabbana', [r'dolce', r'gabbana', r'd&g']),
    ('jacquemus', 'Jacquemus', [r'jacquemus']),
    ('arcteryx', "Arc'teryx", [r'arc\'?teryx']),
    ('champion', 'Champion', [r'champion']),
    ('marcjacobs', 'Marc Jacobs', [r'marc jacobs']),
    ('bape', 'Bape', [r'\bbape\b', r'bathing ape']),
    ('timberland', 'Timberland', [r'timberland']),
    ('essentials', 'Essentials / FOG', [r'essentials', r'fear of god']),
    ('loewe', 'Loewe', [r'loewe']),
    ('crocs', 'Crocs', [r'crocs']),
    ('palace', 'Palace', [r'palace']),
    ('birkenstock', 'Birkenstock', [r'birkenstock']),
    ('ralphlauren', 'Ralph Lauren', [r'ralph lauren', r'polo ralph']),
]

def determine_category(name, cat_name, desc):
    title_cat = f"{name} {cat_name}"
    
    # Exception: New Balance 2002R Pouch is a sneaker
    if '2002r' in title_cat.lower() and 'pouch' in title_cat.lower():
        return 'shoes', 'Кросівки & Кеди', '👟'
        
    desc_start = ''
    m = re.search(r'Опис\s*:\s*([^<\n\r]+)', desc)
    if m:
        desc_start = m.group(1).strip()[:150]
        
    # 1. Bags & Accessories
    if BAG_KEYWORDS.search(title_cat) or (desc_start and re.search(r'^(сумка|рюкзак|бананка|гаманець|ремінь|окуляри|браслет|клатч)', desc_start, re.I)):
        return 'bags', 'Сумки & Аксесуари', '🎒'
        
    # 2. Clothing & Outerwear
    if CLOTHING_KEYWORDS.search(title_cat) or (desc_start and re.search(r'^(костюм|куртка|пуховик|худі|світшот|штани|футболка|шорти|сорочка)', desc_start, re.I)):
        return 'clothing', 'Одяг & Куртки', '🧥'
        
    # 3. Winter Footwear
    if WINTER_KEYWORDS.search(title_cat):
        return 'winter', 'Зимове взуття', '❄️'
        
    # 4. Sneakers & Casual Shoes
    return 'shoes', 'Кросівки & Кеди', '👟'

def determine_brand(name, cat_name):
    combined = f"{name} {cat_name}".lower()
    for slug, title, pats in KNOWN_BRANDS:
        if any(re.search(p, combined) for p in pats):
            return slug, title
    return 'other', 'Інші бренди'

def clean_product_title(name, cat_slug, brand_slug, brand_title, cat_name):
    title = name.strip()
    # Strip leading emojis / stars / symbols
    title = re.sub(r'^[⭐️★❄️❗️⚡️🔥✨✔️✦•\s!\(\)\-]+', '', title).strip()
    
    # Clean SALE markers
    title = re.sub(r'^(?:!*SALE!*|\(SALE\))\s*', '', title, flags=re.I).strip()
    title = re.sub(r'\s+(?:!*SALE!*|\(SALE\))$', '', title, flags=re.I).strip()
    
    # Clean double quotes
    title = title.replace('\"\"', '\"').replace("''", "'")
    
    # Translate / clean Russian supplier prefixes
    title = re.sub(r'^МУЖСКОЕ БЕЛЬЕ\s*', 'Чоловіча білизна ', title, flags=re.I)
    title = re.sub(r'^ЖЕНСКОЕ БЕЛЬЕ\s*', 'Жіноча білизна ', title, flags=re.I)
    title = re.sub(r'^МУЖСКИЕ\s*', 'Чоловічі ', title, flags=re.I)
    title = re.sub(r'^ЖЕНСКИЕ\s*', 'Жіночі ', title, flags=re.I)
    title = re.sub(r'^СВИТШОТ\s*', 'Світшот ', title, flags=re.I)
    title = re.sub(r'^ФУТБОЛКА\s*', 'Футболка ', title, flags=re.I)
    title = re.sub(r'^ШТАНЫ\s*', 'Штани ', title, flags=re.I)
    title = re.sub(r'^КУРТКА\s*', 'Куртка ', title, flags=re.I)
    title = re.sub(r'^ПУХОВИК\s*', 'Пуховик ', title, flags=re.I)
    title = re.sub(r'^ХУДИ\s*', 'Худі ', title, flags=re.I)
    title = re.sub(r'^ТОЛСТОВКА\s*', 'Толстовка ', title, flags=re.I)
    title = re.sub(r'^КОСТЮМ\s*', 'Костюм ', title, flags=re.I)
    
    # Strip category suffixes in brackets like (взуття), (одяг)
    title = re.sub(r'\s*\((?:взуття|одяг|аксесуари|взуття.*?)\)', '', title, flags=re.I).strip()
    
    # Special fix for single word "Track" under Balenciaga
    if title.lower() == 'track' and brand_slug == 'balenciaga':
        title = 'Balenciaga Track'
        
    # Enrich cryptic names
    if title.lower() in [brand_slug, brand_title.lower()]:
        if cat_slug == 'clothing':
            title = f'Спортивний костюм {brand_title}'
        elif cat_slug == 'bags':
            title = f'Сумка {brand_title}'
        elif cat_slug == 'winter':
            title = f'Черевики {brand_title}'
        else:
            title = f'Кросівки {brand_title}'
    elif re.match(r'^\d{3,4}[a-zA-Z]?$', title) and brand_slug in ['newbalance', 'adidas', 'nike', 'asics']:
        title = f'{brand_title} {title}'
    elif len(title) <= 6 and not any(k in title.lower() for k in ['ugg', 'dunk', 'max', 'air']):
        if brand_slug != 'other':
            title = f'{brand_title} {title}'
        elif 'білизн' in cat_name.lower():
            title = f'Комплект білизни {title}'
            
    title = re.sub(r'\s+', ' ', title).strip()
    return title

def main():
    if '--download' in sys.argv or not os.path.exists(EXPORT_FILE):
        download_export_feed()

    print(f"Reading {EXPORT_FILE}...")
    tree = ET.parse(EXPORT_FILE)
    root = tree.getroot()

    cat_names = {cat.attrib.get('id'): clean_text(cat.text) for cat in root.findall('.//catalog/category')}

    # Group by group_id or clean barcode
    groups = defaultdict(list)
    for it in root.findall('.//items/item'):
        gid = it.attrib.get('group_id') or it.findtext('barcode', '').split('-')[0]
        groups[gid].append(it)

    print(f"Total raw groups: {len(groups)}")

    products = []
    category_counts = Counter()
    brand_counts = Counter()

    for gid, items in groups.items():
        first = items[0]
        name = clean_text(first.findtext('name'))
        if not name:
            continue
            
        try:
            price = int(first.findtext('priceuah') or 0)
        except ValueError:
            price = 0
            
        if price <= 0:
            continue
            
        cid = first.findtext('categoryId')
        cname = cat_names.get(cid, '')
        desc = first.findtext('description') or ''
        
        # Exclude defective / broken supplier items
        if any(w in name.lower() or w in desc.lower() for w in ['(з дефектом)', 'дефект', 'брак', 'розпаровка', 'уцінка брак']):
            continue
        
        # Regex specs
        art_m = re.search(r'Артикул\s*:\s*([^<]+)', desc)
        mat_m = re.search(r'Матеріал\s*:\s*([^<]+)', desc)
        prod_m = re.search(r'Виробник\s*:\s*([^<]+)', desc)
        
        art = clean_text(art_m.group(1)) if art_m else ''
        mat = clean_text(mat_m.group(1)) if mat_m else ''
        origin = clean_text(prod_m.group(1)) if prod_m else ''
        
        # Images
        imgs = []
        for it in items:
            for img in it.findall('image'):
                if img.text:
                    url = img.text.strip()
                    if url and url not in imgs:
                        imgs.append(url)
                        
        if not imgs:
            continue
            
        # Available sizes
        sizes = []
        for it in items:
            # Check availability
            avail = it.attrib.get('available') == 'true' or it.findtext('available') == 'true'
            if not avail:
                continue
            param = it.find('param')
            if param is not None and param.text:
                s = clean_text(param.text)
                if s and s not in sizes:
                    sizes.append(s)
                    
        # If no variants flagged available, take all listed params
        if not sizes:
            for it in items:
                param = it.find('param')
                if param is not None and param.text:
                    s = clean_text(param.text)
                    if s and s not in sizes:
                        sizes.append(s)
                        
        if not sizes:
            continue

        sorted_sizes = sort_sizes(sizes)
        
        cat_slug, cat_title, cat_icon = determine_category(name, cname, desc)
        brand_slug, brand_title = determine_brand(name, cname)

        # Rule: if sneakers has less than 3 sizes in stock, do not add to site
        is_sneaker = (cat_slug == 'shoes') or any(k in name.lower() for k in ['кросівки', 'кеди', 'sneakers'])
        if is_sneaker and len(sorted_sizes) < 3:
            continue
        
        category_counts[cat_slug] += 1
        brand_counts[brand_slug] += 1
        
        # Old price for visual discount (15-20% markup, rounded to 10 грн)
        old_price = round(price * 1.18 / 10) * 10
        
        # Badge
        badge = "✨ Топ якість"
        if cat_slug == 'winter':
            badge = "❄️ Зима • Термо"
        elif 'sale' in cname.lower() or 'уцінка' in cname.lower():
            badge = "🏷 Знижка"
        elif brand_slug in ['nike', 'jordan', 'newbalance', 'adidas']:
            badge = "🔥 Хіт продажів"
            
        clean_name = clean_product_title(name, cat_slug, brand_slug, brand_title, cname)
        products.append({
            'id': str(gid),
            'name': clean_name,
            'price': price,
            'old_price': old_price,
            'cat': cat_slug,
            'brand': brand_slug,
            'brand_name': brand_title,
            'art': art or str(gid),
            'mat': mat,
            'origin': origin if origin != '-' else "В'єтнам",
            'badge': badge,
            'imgs': imgs[:5], # up to 5 images
            'sizes': sorted_sizes
        })

    print(f"Processed valid products: {len(products)}")
    print("Categories distribution:", dict(category_counts))
    print("Brands distribution:", dict(brand_counts.most_common(15)))

    # Save data/products.json
    os.makedirs('data', exist_ok=True)
    with open(OUTPUT_PRODUCTS, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Saved {OUTPUT_PRODUCTS} ({os.path.getsize(OUTPUT_PRODUCTS)} bytes)")

    # Save data/meta.json
    meta = {
        'total': len(products),
        'categories': [
            {'slug': 'all', 'name': 'Всі товари', 'icon': '🔥', 'count': len(products)},
            {'slug': 'shoes', 'name': 'Кросівки & Кеди', 'icon': '👟', 'count': category_counts['shoes']},
            {'slug': 'winter', 'name': 'Зимове взуття', 'icon': '❄️', 'count': category_counts['winter']},
            {'slug': 'clothing', 'name': 'Одяг & Куртки', 'icon': '🧥', 'count': category_counts['clothing']},
            {'slug': 'bags', 'name': 'Сумки & Аксесуари', 'icon': '🎒', 'count': category_counts['bags']},
        ],
        'brands': (lambda: [
            {'slug': 'all', 'name': 'Всі бренди', 'count': len(products)}
        ] + [
            {
                'slug': b_slug,
                'name': {s: t for s, t, _ in KNOWN_BRANDS}.get(b_slug, b_slug.title()),
                'count': b_count
            }
            for b_slug, b_count in brand_counts.most_common()
            if b_slug != 'other' and b_count > 0
        ] + ([{'slug': 'other', 'name': 'Інші бренди', 'count': brand_counts['other']}] if brand_counts['other'] > 0 else []))()
    }

    with open(OUTPUT_META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Saved {OUTPUT_META}")

    # Generate feed.xml with top 500 models for Google / Meta Catalog
    feed_items = products[:500]
    feed_xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
        '  <channel>',
        '    <title>URBAN — Каталог трендового взуття та одягу</title>',
        '    <link>https://urbangrid.com.ua</link>',
        '    <description>Каталог кросівок, зимового взуття та одягу: Nike, New Balance, Adidas, Asics, Salomon, UGG. Доставка Новою Поштою по Україні.</description>'
    ]

    for p in feed_items:
        desc_parts = [p['name']]
        if p.get('mat'): desc_parts.append(f"Матеріал: {p['mat']}")
        if p.get('origin'): desc_parts.append(f"Виробник: {p['origin']}")
        if p.get('sizes'): desc_parts.append(f"Розміри: {', '.join(p['sizes'][:6])}")
        desc_parts.append(f"Арт: {p['art']}")
        desc_str = ' • '.join(desc_parts)

        main_img = p['imgs'][0] if p.get('imgs') else 'https://urbangrid.com.ua/images/sneakers.webp'
        feed_xml_lines.extend([
            '    <item>',
            f'      <g:id>prod-{p["id"]}</g:id>',
            f'      <title>{p["name"]}</title>',
            f'      <description>{desc_str}</description>',
            f'      <link>https://urbangrid.com.ua/#prod-{p["id"]}</link>',
            f'      <g:image_link>{main_img}</g:image_link>',
            f'      <g:brand>{p["brand_name"]}</g:brand>',
            '      <g:condition>new</g:condition>',
            '      <g:availability>in_stock</g:availability>',
            f'      <g:price>{p["price"]} UAH</g:price>',
            '      <g:google_product_category>187</g:google_product_category>',
            '      <g:product_type>Одяг та взуття &gt; Взуття &gt; Кросівки</g:product_type>',
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

    with open('feed.xml', 'w', encoding='utf-8') as f:
        f.write('\n'.join(feed_xml_lines) + '\n')
    print("Saved feed.xml with 500 items")

if __name__ == '__main__':
    main()
