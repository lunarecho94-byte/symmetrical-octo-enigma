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
from xml.sax.saxutils import escape
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
                
        if os.path.exists(EXPORT_FILE):
            os.replace(temp_path, EXPORT_FILE)
        else:
            os.rename(temp_path, EXPORT_FILE)
        print(f"Successfully downloaded {file_size} bytes to {EXPORT_FILE}")
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        print(f"Download failed: {e}")
        if not os.path.exists(EXPORT_FILE):
            sys.exit(1)

def clean_text(s):
    if not s:
        return ""
    clean = re.sub(r'<[^>]+>', ' ', s)
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean

def sort_sizes(sizes):
    if not sizes:
        return []
    size_order = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL']
    num_sizes = []
    text_sizes = []
    for s in sizes:
        m = re.match(r'^(\d+(?:[.,]\d+)?)$', s)
        if m:
            val = float(m.group(1).replace(',', '.'))
            num_sizes.append((val, s))
        else:
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

# Precise 5-category classification regexes
BAG_KEYWORDS = re.compile(
    r'сумк|рюкзак|бананка|месенджер|портмоне|гаманець|кошелек|клатч|шопер|шоппер|валіза|чемодан|холдер|баул|'
    r'\bbag\b|\bbags\b|\bbackpack\b|\bwallet\b|\btote\b|\bhandbag\b|\bcrossbody\b|\bкейс\b|'
    r'\bочки\b|окуляр|пасок|\bремінь\b|\bремень\b|браслет|годинник|кардхолдер|jw pei|chiquito|bambino|book tote|'
    r'шапк|кепк|панам|баф\b|шарф|рукавиц|перчатк|\bbelt\b|\bhat\b|\bbeanie\b|бейсболк',
    re.I
)

CLOTHING_KEYWORDS = re.compile(
    r'костюм|худі|худи|світшот|толстовка|вітровк|ветровк|куртк|пуховик|штани|штаны|джинс|футболк|шорти|шорты|'
    r'жилет|анорак|парка|бомбер|спідниц|сукня|плать|лонгслів|светр|кофта|кардиган|сорочк|рубашк|поло\b|майк|'
    r'кроп-топ|кроптоп|\bтопік\b|жіночий топ|топ бра|tracksuit|hoodie|jacket|pants|shorts|t-shirt|tee\b',
    re.I
)

WINTER_KEYWORDS = re.compile(
    r'\bugg\b|угг|черевик|ботинки|ботильон|\bboots\b|\bboot\b|хутро|\bмех\b|зимов|winter|сноубутс|дутики|мунбут|moon boot',
    re.I
)

KNOWN_BRANDS = [
    ('nike', 'Nike', [r'nike', r'dunk', r'air max', r'p-6000', r'force 1', r'shox', r'initiator', r'nocta', r'vomero', r'v2k']),
    ('jordan', 'Air Jordan', [r'jordan']),
    ('newbalance', 'New Balance', [r'new balance', r'\bnb\b', r'9060', r'1906', r'530', r'2002', r'725', r'550', r'574', r'990', r'992']),
    ('adidas', 'Adidas', [r'adidas', r'yeezy', r'niteball', r'samba', r'spezial', r'campus', r'gazelle', r'forum', r'adi 2000', r'astir', r'retropy']),
    ('asics', 'Asics', [r'asics', r'onitsuka']),
    ('salomon', 'Salomon', [r'salomon', r'solomon', r'xt-6', r'xt-4', r'acs pro']),
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
    ('lacoste', 'Lacoste', [r'lacoste', r'lactose']),
    ('carhartt', 'Carhartt', [r'carhartt']),
    ('stussy', 'Stussy', [r'stussy']),
    ('underarmour', 'Under Armour', [r'under armour']),
    ('bottega', 'Bottega Veneta', [r'bottega']),
    ('loropiana', 'Loro Piana', [r'loro piana']),
    ('miumiu', 'Miu Miu', [r'miu miu']),
    ('mcqueen', 'Alexander McQueen', [r'mcqueen']),
    ('hugo', 'Hugo Boss', [r'hugo', r'boss']),
    ('premiata', 'Premiata', [r'premiata', r'moerun']),
    ('oncloud', 'On Cloud', [r'\bon\b.*cloud', r'cloudmonster', r'cloudtilt', r'cloudsurfer', r'cloudhorizon', r'on running']),
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
    ('columbia', 'Columbia', [r'columbia', r'montrail']),
    ('merrell', 'Merrell', [r'merrell']),
    ('guess', 'Guess', [r'guess']),
    ('fila', 'Fila', [r'fila']),
    ('cartier', 'Cartier', [r'cartier']),
    ('chloe', 'Chloé', [r'chloe', r'chloé']),
    ('armani', 'Armani', [r'armani', r'ea7']),
]

def determine_category(name, cat_name, desc, params_str="", sizes=None, mat="", brand_slug=""):
    title_cat = f"{name} {cat_name}".strip()
    title_cat_lower = title_cat.lower()
    sizes = sizes or []
    shoe_sizes = [s for s in sizes if re.match(r'^(3[5-9]|4[0-8])$', str(s).strip())]

    # Special Kids Homme t-shirt
    if 'k0025 homme' in title_cat_lower or title_cat_lower == 'homme':
        return 'clothing', 'Одяг', '🧥'

    # 1. Definitive Footwear Brand & Model overrides:
    # UGG, Merrell, Crocs, Birkenstock in EasyDrop are ALWAYS footwear (shoes)
    if brand_slug in ('ugg', 'merrell', 'birkenstock') or re.search(r'\b(ugg|угг|merrell|birkenstock)\b', title_cat_lower):
        return 'shoes', 'Взуття', '👟'

    # Models with 'sock', 'cap', 'pouch' that are actually footwear
    if re.search(r'tazz sock|sock dart|speed sock|ice cap|drainmaker|2002r.*pouch|knu skool|old skool', title_cat_lower):
        return 'shoes', 'Взуття', '👟'

    # Feed category name explicitly marks footwear:
    if '(взуття)' in cat_name.lower() or re.search(r'кросівки|кеди|сланці|шльопанці|тапочки|\bboots\b|\bsneakers\b|зим.*взуття', cat_name, re.I):
        return 'shoes', 'Взуття', '👟'

    # Footwear models & numeric shoe sizes (e.g. 36-47):
    # If it has 2+ numeric shoe sizes and comes from a sneaker brand or has sneaker keywords
    if len(shoe_sizes) >= 2 and any(k in title_cat_lower for k in [
        'new balance', 'nike', 'adidas', 'puma', 'asics', 'jordan', 'vans', 'converse', 'salomon', 'saucony', 'reebok', 'hoka', 'on cloud', 'premiata', 'dr.martens', 'martens',
        'кросів', 'кроссов', 'кеди', 'кеды', 'ботинк', 'черевик', 'хайтоп', 'sneaker', 'сникер', 'лофер', 'туфл', 'чобот', 'сабо', 'сандал', 'шльоп', 'сланц', 'slide'
    ]):
        if not any(k in title_cat_lower for k in ['футболк', 'худі', 'світшот', 'штани', 'шорти', 'куртка', 'костюм', 'шапка', 'кепка', 'панама', 'сумка', 'рюкзак']):
            return 'shoes', 'Взуття', '👟'

    # 2. Underwear (Труси / Нижня білизна)
    # Feed category marks underwear:
    if re.search(r'труси\s*\(одяг\)|чоловіча білизна|комплекти білизни', cat_name, re.I):
        return 'underwear', 'Труси & Білизна', '🩲'
    # Text marks underwear (including sets of underwear + socks):
    if re.search(r'трус|боксер|білизн|плавки|\bunderwear\b|\bbriefs?\b|\bboxers?\b', title_cat_lower):
        return 'underwear', 'Труси & Білизна', '🩲'

    # 3. Socks (Шкарпетки)
    # Feed category marks pure socks:
    if re.search(r'комплекти шкарпеток|\bноски\b|шкарпетки', cat_name, re.I) and 'білизн' not in cat_name.lower():
        return 'socks', 'Шкарпетки', '🧦'
    # Name marks socks (only if not a shoe with shoe sizes):
    if re.search(r'шкарпетк|носк|\bsocks?\b', title_cat_lower):
        if not (len(shoe_sizes) >= 2 and any(k in title_cat_lower for k in ['ugg', 'nike', 'adidas', 'runner', 'trainer', 'boot', 'tazz'])):
            return 'socks', 'Шкарпетки', '🧦'

    # 4. Bags & Accessories
    desc_start = ''
    m = re.search(r'Опис\s*:\s*([^<\n\r]+)', desc)
    if m:
        desc_start = m.group(1).strip()[:150]

    # Handbag/Belt dimensions check: e.g. "34 x 26 x 13", "25x17x9", "100 х 2,5"
    if params_str and re.search(r'\d+\s*[xх]\s*\d+', params_str) and not any(k in title_cat_lower for k in ['кросівки', 'кеди', 'взуття', 'костюм']):
        return 'accessories', 'Аксесуари & Сумки', '🎒'

    if BAG_KEYWORDS.search(title_cat) or (desc_start and re.search(r'^(сумка|рюкзак|бананка|гаманець|ремінь|окуляри|браслет|клатч|шапка|кепка|панама)', desc_start, re.I)):
        return 'accessories', 'Аксесуари & Сумки', '🎒'

    # 5. Clothing & Outerwear
    if '(одяг)' in cat_name.lower() or CLOTHING_KEYWORDS.search(title_cat) or (desc_start and re.search(r'^(костюм|куртка|пуховик|худі|світшот|штани|футболка|шорти|сорочка)', desc_start, re.I)):
        return 'clothing', 'Одяг & Куртки', '🧥'

    # 6. Fallback is Shoes
    return 'shoes', 'Взуття', '👟'

def determine_season(name, cat_slug, mat="", desc=""):
    txt = f"{name} {mat} {desc}".lower()
    
    # 1. Winter (Зима / Термо / Хутро / Пуховики)
    if re.search(r'зимов|термо|хутр|мех|winter|пуховик|сноубутс|дутики|мунбут|\bugg\b|угг|термобілизн|термокостюм|фліс|шерсть|тепл', txt):
        return 'winter', 'Зима', '❄️'
        
    # 2. Summer (Літо / Сітка / Шорти / Футболки / Сланці / Сандалі)
    if re.search(r'літн|лето|літо|summer|шорти|шорты|майк|футболк|сланц|шльоп|шлеп|сандал|\bcrocs\b|крокс|mesh|сітка|сетка|топ\b', txt):
        return 'summer', 'Літо', '☀️'
        
    # 3. Demi-season (Демісезон / Весна-Осінь / Базове щоденне)
    return 'demi', 'Демісезон', '🍂'

def determine_brand(name, cat_name):
    combined = f"{name} {cat_name}".lower()
    for slug, title, pats in KNOWN_BRANDS:
        if any(re.search(p, combined) for p in pats):
            return slug, title
    return 'other', 'Інші бренди'

GENDER_WOMEN_KW = re.compile(r'жіноч|женск|women|woman|дівчат|для неї', re.I)
GENDER_MEN_KW = re.compile(r'чоловіч|мужск|men\b|man\b|хлопц|для нього', re.I)
GENDER_UNISEX_KW = re.compile(r'унісекс|унисекс|unisex', re.I)
WOMEN_BAGS_BRANDS = {'chanel', 'pinko', 'jacquemus', 'chloe', 'miumiu', 'hermes'}
WOMEN_BAGS_KW = re.compile(r'жіноч|женск|клатч|лоро піана|loro piana|lady dior|book tote', re.I)

def determine_gender(name, cat_slug, brand_slug, sizes, cname="", desc=""):
    full_text = f"{name} {cname} {desc}".lower()
    if GENDER_UNISEX_KW.search(full_text):
        return 'unisex'
    is_w = bool(GENDER_WOMEN_KW.search(full_text))
    is_m = bool(GENDER_MEN_KW.search(full_text))
    if is_w and not is_m:
        return 'women'
    if is_m and not is_w:
        return 'men'

    if cat_slug in ('accessories', 'bags'):
        if brand_slug in WOMEN_BAGS_BRANDS or WOMEN_BAGS_KW.search(full_text):
            return 'women'
        if any(k in name.lower() for k in ['сумка жіноча', 'сумка', 'клатч', 'tote', 'handbag']) and not any(k in name.lower() for k in ['рюкзак', 'бананка', 'месенджер', 'баул']):
            return 'women'
        return 'unisex'

    if cat_slug == 'underwear':
        if re.search(r'чоловіч|мужск|боксер|boxer', full_text, re.I):
            return 'men'
        if re.search(r'жіноч|женск|бюст|топ|бра\b', full_text, re.I):
            return 'women'
        return 'men'

    if cat_slug == 'socks':
        return 'unisex'

    if cat_slug == 'shoes':
        num_sizes = []
        for s in sizes:
            m = re.match(r'^(\d+(?:[.,]\d+)?)$', str(s).strip())
            if m:
                num_sizes.append(float(m.group(1).replace(',', '.')))
        if num_sizes:
            min_s = min(num_sizes)
            max_s = max(num_sizes)
            if max_s <= 40:
                return 'women'
            elif min_s >= 41:
                return 'men'
            else:
                return 'unisex'

    return 'unisex'

def is_sneaker_product(name, clean_name, cat_slug, cname="", desc="", sizes=None):
    if cat_slug == 'shoes':
        return True


    text_all = f"{name} {clean_name} {cname} {desc}".lower()
    
    # Exclude bags & accessories
    if cat_slug == 'bags' or any(b in clean_name.lower() for b in ['сумка', 'рюкзак', 'бананка', 'гаманець', 'ремінь', 'клатч', 'duffel', 'tote', 'backpack']):
        return False

    # Exclude apparel unless it contains numeric shoe sizes and a known sneaker model
    if cat_slug == 'clothing' and any(w in clean_name.lower() for w in ['костюм', 'світшот', 'худі', 'футболка', 'штани', 'шорти', 'куртка', 'пуховик', 'кепка']):
        has_shoe_sizes = sizes and any(re.match(r'^(3[5-9]|4[0-8])(\.5)?$', str(s).strip()) for s in sizes)
        if not (has_shoe_sizes and any(m in text_all for m in ['new balance 530', 'air jordan 1', 'dunk'])):
            return False

    # Generic footwear keywords (Ukrainian, Russian, English)
    if any(k in text_all for k in ['кросів', 'кроссов', 'кед', 'черевик', 'ботинк', 'ботиль', 'чобот', 'sneaker', 'сникер', 'хайтоп', 'boot', 'угг', 'ugg']):
        return True

    # Sneaker model patterns
    SNEAKER_MODELS = [
        'air force', 'air jordan', 'jordan 1', 'jordan 4', 'dunk', 'yeezy',
        'samba', 'gazelle', 'campus', 'spezial', 'special', 'lowmel', 'highmel',
        '1906', '2002', '9060', '530', '550', '574', 'v2k', 'zoom pulse',
        'vomero', 'initiator', 'terrex', 'hoka', 'speedcross', 'xt-6',
        'cortez', 'air max', 'knu skool', 'old skool', 'm2k', 'blazer'
    ]
    if any(m in text_all for m in SNEAKER_MODELS):
        has_shoe_sizes = sizes and any(re.match(r'^(3[5-9]|4[0-8])(\.5)?$', str(s).strip()) for s in sizes)
        if cat_slug in ('shoes', 'winter') or has_shoe_sizes:
            return True

    return False


KNOWN_NUMERIC_MODELS = {
    '1906', '2002', '9060', '550', '574', '530', '990', '991', '992', '993', 
    '725', '610', '860', '350', '500', '700', '1460', '327', '452', '410'
}

COLOR_WORDS = {
    'white', 'black', 'grey', 'gray', 'beige', 'brown', 'green', 'blue', 'pink', 
    'red', 'orange', 'yellow', 'purple', 'olive', 'khaki', 'silver', 'gold', 
    'classic', 'oreo', 'zebra', 'blush', 'salt', 'cinder', 'bone', 'flax', 'clay', 'ash', 'mono'
}

MODEL_MAP = {
    '9060': 'New Balance 9060',
    '1906': 'New Balance 1906R',
    '1906r': 'New Balance 1906R',
    '2002': 'New Balance 2002R',
    '2002r': 'New Balance 2002R',
    '530': 'New Balance 530',
    '550': 'New Balance 550',
    '574': 'New Balance 574',
    '725': 'New Balance 725',
    '990': 'New Balance 990',
    '991': 'New Balance 991',
    '992': 'New Balance 992',
    '993': 'New Balance 993',
    '610': 'New Balance 610',
    '860': 'New Balance 860 v2',
    '860 v2': 'New Balance 860 v2',
    '350': 'Adidas Yeezy Boost 350',
    '500': 'Adidas Yeezy 500',
    '700': 'Adidas Yeezy Boost 700',
    'v2k': 'Nike V2K Run',
    'p-6000': 'Nike P-6000',
    'm2k': 'Nike M2K Tekno',
    'sb': 'Nike SB Dunk',
    'initiator': 'Nike Initiator',
    'zoom': 'Nike Air Zoom',
    'zoomx': 'Nike ZoomX',
    'superstar': 'Adidas Superstar',
    'samba': 'Adidas Samba',
    'spezial': 'Adidas Handball Spezial',
    'gazelle': 'Adidas Gazelle',
    'niteball': 'Adidas Niteball',
    'campus': 'Adidas Campus',
    'astir': 'Adidas Astir',
    'retropy': 'Adidas Retropy',
    'xt-6': 'Salomon XT-6',
    'xt-4': 'Salomon XT-4',
    'gel-sonoma': 'Asics Gel-Sonoma',
    'gel-kahana': 'Asics Gel-Kahana',
    'gel-kayano': 'Asics Gel-Kayano',
    'gel-nyc': 'Asics Gel-NYC',
    'crocs': 'Сабо Crocs',
    'shield': 'Nike Pegasus Shield',
    'fast x': 'Nike Fast X',
    'synth': 'Adidas Yeezy Boost 350 V2 Synth',
    'asriel': 'Adidas Yeezy Boost 350 V2 Asriel',
    'moerun': 'Premiata Moerun',
    'cloudhorizon': 'On Cloud Cloudhorizon',
    'track': 'Balenciaga Track',
}

RU_TRANSLATIONS = [
    (r'\bзимний с начесом\b', 'зимовий на флісі'),
    (r'\bзимний\b', 'зимовий'),
    (r'\bзимняя\b', 'зимова'),
    (r'\bзимние\b', 'зимові'),
    (r'\bфлисовый\b', 'флісовий'),
    (r'\bфлисовые\b', 'флісові'),
    (r'\bспортивный\b', 'спортивний'),
    (r'\bспортивные\b', 'спортивні'),
    (r'\bчерный\b', 'чорний'),
    (r'\bчерные\b', 'чорні'),
    (r'\bчерная\b', 'чорна'),
    (r'\bсерый\b', 'сірий'),
    (r'\bсерые\b', 'сірі'),
    (r'\bсерая\b', 'сіра'),
    (r'\bкрасный\b', 'червоний'),
    (r'\bкрасные\b', 'червоні'),
    (r'\bкрасная\b', 'червона'),
    (r'\bжелтый\b', 'жовтий'),
    (r'\bжелтые\b', 'жовті'),
    (r'\bжелтая\b', 'жовта'),
    (r'\bголубой\b', 'блакитний'),
    (r'\bголубые\b', 'блакитні'),
    (r'\bбежевый\b', 'бежевий'),
    (r'\bбежевые\b', 'бежеві'),
    (r'\bбелый\b', 'білий'),
    (r'\bбелые\b', 'білі'),
    (r'\bбелая\b', 'біла'),
    (r'\bзеленый\b', 'зелений'),
    (r'\bзеленые\b', 'зелені'),
    (r'\bфиолетовый\b', 'фіолетовий'),
    (r'\bкофейный\b', 'кавовий'),
    (r'\bпесочный\b', 'пісочний'),
    (r'\bкоричневый\b', 'коричневий'),
    (r'\bкоричневые\b', 'коричневі'),
    (r'\bкожанный\b', 'шкіряний'),
    (r'\bкожаный\b', 'шкіряний'),
    (r'\bчиносы\b', 'штани чинос'),
    (r'\bшорты\b', 'шорти'),
    (r'\bэко\b', 'еко'),
    (r'разноцветная/лошадь', 'Різнокольорова (Кінь)'),
    (r'красный/волк', 'Червоний (Вовк)'),
    (r'красный/гризли', 'Червоний (Грізлі)'),
    (r'желтый/волк', 'Жовтий (Вовк)'),
    (r'желтый/питбуль', 'Жовтий (Пітбуль)'),
    (r'красный/питбуль', 'Червоний (Пітбуль)'),
]

EMOJI_PATTERN = re.compile(
    r'[\U00010000-\U0010ffff\u2600-\u27bf\u2b50\u2b55\u23cf\u23e9-\u23f3\u25aa-\u25fe\ufe00-\ufe0f]+',
    re.UNICODE
)

def clean_product_title(name, cat_slug, brand_slug, brand_title, cat_name, desc="", params_str=""):
    t = name.strip()
    
    # 1. Junk rejection: omit completely from site
    if t in ['-', '.', 'Test', 'test', 'Не бренд', 'не бренд']:
        return None
    if re.match(r'^(?:LOT:\s*\d+|Cod:\s*\d+)', t, re.I):
        return None
    if any(w in t.lower() or w in desc.lower() for w in ['(з дефектом)', 'дефект', 'брак', 'розпаровка', 'уцінка брак']):
        return None
        
    # 2. Strip emojis across all unicode blocks and variation selectors
    t = EMOJI_PATTERN.sub('', t).strip()
    t = re.sub(r'^[⭐️★❄️❗️⚡️🔥✨✔️✦•!\(\)\-\s]+', '', t).strip()
    t = re.sub(r'[⭐️★❄️❗️⚡️🔥✨✔️✦•!\(\)\-\s]+$', '', t).strip()
    
    # 3. Strip supplier SALE / discount tags
    t = re.sub(r'\s*\((?:распродажа|розпродаж|скидка|уценка|уцінка|sale)\)?', '', t, flags=re.I).strip()
    t = re.sub(r'^(?:!*SALE!*|\(SALE\))\s*', '', t, flags=re.I).strip()
    t = re.sub(r'\s+(?:!*SALE!*|\(SALE\))$', '', t, flags=re.I).strip()
    
    # Clean quotes
    t = t.replace('\"\"', '\"').replace("''", "'")
    
    # 4. Translate / clean Russian supplier prefixes
    t = re.sub(r'^МУЖСКОЕ БЕЛЬЕ\s*', 'Чоловіча білизна ', t, flags=re.I)
    t = re.sub(r'^ЖЕНСКОЕ БЕЛЬЕ\s*', 'Жіноча білизна ', t, flags=re.I)
    t = re.sub(r'^МУЖСКИЕ\s*', 'Чоловічі ', t, flags=re.I)
    t = re.sub(r'^ЖЕНСКИЕ\s*', 'Жіночі ', t, flags=re.I)
    t = re.sub(r'^СВИТШОТ\s*', 'Світшот ', t, flags=re.I)
    t = re.sub(r'^ФУТБОЛКА\s*', 'Футболка ', t, flags=re.I)
    t = re.sub(r'^ШТАНЫ\s*', 'Штани ', t, flags=re.I)
    t = re.sub(r'^КУРТКА\s*', 'Куртка ', t, flags=re.I)
    t = re.sub(r'^ПУХОВИК\s*', 'Пуховик ', t, flags=re.I)
    t = re.sub(r'^ХУДИ\s*', 'Худі ', t, flags=re.I)
    t = re.sub(r'^ТОЛСТОВКА\s*', 'Толстовка ', t, flags=re.I)
    t = re.sub(r'^КОСТЮМ\s*', 'Костюм ', t, flags=re.I)
    t = re.sub(r'^ДЖИНСЫ\s*', 'Джинси ', t, flags=re.I)
    t = re.sub(r'^ДЖИНСИ\s*', 'Джинси ', t, flags=re.I)
    t = re.sub(r'^КЕПКА\s*', 'Кепка ', t, flags=re.I)
    
    # Apply Russian words translations
    for pat, rep in RU_TRANSLATIONS:
        t = re.sub(pat, rep, t, flags=re.I)

    t = re.sub(r'\(?\s*\bмех\b\s*\)?', ' (хутро)', t, flags=re.I)
    t = re.sub(r'\(?\s*\b(?:утепленные|утеплені|термо)\b\s*\)?', ' (термо)', t, flags=re.I)

    # Special Dr Martens 'без меха' fix
    if brand_slug == 'drmartens' and 'без меха' in name.lower():
        if 'лак' in name.lower():
            t = 'Dr. Martens 1460 (лакові)'
        elif 'змейк' in name.lower() or 'змійк' in name.lower():
            t = 'Dr. Martens 1460 із змійкою'
        else:
            t = 'Dr. Martens 1460 (демісезонні)'
            
    # 5. Strip category suffixes in brackets
    t = re.sub(r'\s*\((?:взуття|одяг|аксесуари|взуття.*?)\)', '', t, flags=re.I).strip()
    
    # 6. Strip leading warehouse codes:
    # 6a. Leading zero articles like 0547, 0001, 0097, 0366
    m_zero = re.match(r'^0\d{3,4}\s+(.+)$', t)
    if m_zero:
        t = m_zero.group(1).strip()
    # 6b. Warehouse codes like K0044, F0003
    m_kf = re.match(r'^[KF]\d{4}\s+(.+)$', t)
    if m_kf:
        t = m_kf.group(1).strip()
    # 6c. 4-digit supplier articles when followed by a brand or model name
    m_art = re.match(r'^(\d{4})\s+(.+)$', t)
    if m_art:
        code, rest = m_art.groups()
        if code not in KNOWN_NUMERIC_MODELS:
            if re.match(r'^[A-Z][a-z]+', rest):
                t = rest.strip()
                
    # 7. Check direct model map
    low = t.lower()
    if low in MODEL_MAP:
        t = MODEL_MAP[low]
    elif low.startswith(('9060 ', '1906 ', '2002 ', '530 ', '550 ', '574 ', '725 ', '990 ', '991 ', '992 ', '993 ', '610 ')):
        if 'new balance' not in low:
            t = f'New Balance {t}'
    elif low.startswith(('350 ', '500 ', '700 ')):
        if 'yeezy' not in low and 'adidas' not in low:
            t = f'Adidas Yeezy {t}'
    elif low.startswith('1460 '):
        if 'martens' not in low:
            t = f'Dr. Martens {t}'
            
    # 8. Handle code-only names (V82, WJ153, SS28, F34, H042, SL60, NTR495, NB299, VN02)
    if re.match(r'^V\d{2,3}$', t, re.I):
        t = f'Вітровка {t.upper()}'
    elif re.match(r'^WJ\d{2,4}$', t, re.I):
        t = f'Куртка зимова {t.upper()}'
    elif re.match(r'^SS\d{2,4}$', t, re.I):
        t = f'Спортивний костюм {t.upper()}'
    elif re.match(r'^F\d{2,4}$', t, re.I):
        t = f'Худі {t.upper()}'
    elif re.match(r'^H\d{3,4}$', t, re.I):
        t = f'Сланці {t.upper()}'
    elif re.match(r'^SL\d{2,4}$', t, re.I):
        t = f'Зимові черевики {t.upper()}'
    elif re.match(r'^J\d{1,4}$', t, re.I):
        t = f'Куртка демісезонна {t.upper()}'
    elif re.match(r'^SJ\d{1,4}$', t, re.I):
        t = f'Куртка {t.upper()}'
    elif re.match(r'^SP(?:б/н)?\d{1,4}$', t, re.I):
        t = f'Спортивні штани {t.upper()}'
    elif re.match(r'^SH\d{1,4}$', t, re.I):
        t = f'Шорти {t.upper()}'
    elif re.match(r'^TS\d{1,4}$', t, re.I):
        t = f'Футболка {t.upper()}'
    elif re.match(r'^JS\d{1,4}$', t, re.I):
        t = f'Спортивний костюм {t.upper()}'
    elif re.match(r'^M\d{4,5}$', t, re.I):
        t = f'Кросівки {t.upper()}'
    elif re.match(r'^\d{2}$', t):
        if cat_slug == 'clothing':
            t = f'Куртка / Вітровка {t}'
        elif cat_slug in ('accessories', 'bags'):
            t = f'Сумка {t}'
        elif cat_slug == 'shoes':
            t = f'Кросівки / Взуття {t}'
        else:
            t = f'Товар {t}'
    elif re.match(r'^(?:NTR|NB|VN|CR|YE)\d{2,4}$', t, re.I):
        if brand_slug != 'other':
            if cat_slug in ('accessories', 'bags'):
                t = f'Сумка {brand_title} {t.upper()}'
            elif cat_slug == 'clothing':
                t = f'Одяг {brand_title} {t.upper()}'
            elif cat_slug == 'underwear':
                t = f'Комплект білизни {brand_title} {t.upper()}'
            elif cat_slug == 'socks':
                t = f'Шкарпетки {brand_title} {t.upper()}'
            else:
                t = f'Кросівки {brand_title} {t.upper()}'
        else:
            t = f'Кросівки {t.upper()}'
    elif re.match(r'^[A-Z]{2}\d{4}-\d{3}$', t):
        t = f'Спортивний одяг Nike {t}'
    elif re.match(r'^[A-Z]{1,2}\d{4}$', t) and cat_slug == 'clothing':
        t = f'Спортивний одяг {brand_title if brand_slug != "other" else ""} {t}'.strip()

    # 9. Color-only or truncated words (e.g. 'White', 'Black', 'Grey', 'Classic')
    if t.lower() in COLOR_WORDS:
        clean_cname = EMOJI_PATTERN.sub('', cat_name)
        clean_cname = re.sub(r'\s*\((?:взуття|одяг|аксесуари)\)', '', clean_cname, flags=re.I)
        parts = [p.strip(' .\t\n\r\xa0') for p in clean_cname.split('|')]
        parts = [p for p in parts if p]
        if parts:
            extracted_model = ' '.join(parts)
            if t.lower() not in extracted_model.lower():
                t = f'{extracted_model} {t.capitalize()}'
            else:
                t = extracted_model

    # 10. Single brand name titles (e.g. 'Nike', 'Puma', 'Lacoste', 'Balenciaga')
    if t.lower() in [brand_slug, brand_title.lower()] or t.lower() in ['nike', 'adidas', 'puma', 'lacoste', 'lactose', 'gucci', 'prada', 'dior', 'chanel', 'balenciaga', 'reebok', 'under armour', 'guess', 'fila', 'cartier', 'columbia', 'merrell', 'chloe', 'calvin klein', 'hugo boss']:
        actual_brand = brand_title if brand_slug != 'other' else t.title()
        if cat_slug == 'clothing':
            if any(k in cat_name.lower() for k in ['костюм', 'спорт']):
                t = f'Спортивний костюм {actual_brand}'
            elif any(k in cat_name.lower() for k in ['куртк', 'пуховик', 'жилет']):
                t = f'Куртка {actual_brand}'
            elif any(k in cat_name.lower() for k in ['штани', 'штаны', 'джинс']):
                t = f'Спортивні штани {actual_brand}'
            elif any(k in cat_name.lower() for k in ['футболк']):
                t = f'Футболка {actual_brand}'
            elif any(k in cat_name.lower() for k in ['білизн', 'труси']):
                t = f'Чоловіча білизна {actual_brand}'
            elif any(k in cat_name.lower() for k in ['худі', 'худи', 'світшот']):
                t = f'Худі {actual_brand}'
            elif any(k in cat_name.lower() for k in ['кепк', 'панам', 'шапк']):
                t = f'Головний убір {actual_brand}'
            else:
                t = f'Одяг {actual_brand}'
        elif cat_slug in ('accessories', 'bags'):
            if 'окуляр' in cat_name.lower():
                t = f'Окуляри {actual_brand}'
            elif any(k in cat_name.lower() for k in ['шапк', 'кепк', 'панам']):
                t = f'Головний убір {actual_brand}'
            elif 'ремін' in cat_name.lower():
                t = f'Ремінь {actual_brand}'
            else:
                t = f'Сумка {actual_brand}'
        elif cat_slug == 'underwear':
            t = f'Комплект білизни {actual_brand}'
        elif cat_slug == 'socks':
            t = f'Шкарпетки {actual_brand}'
        else:
            t = f'Кросівки {actual_brand}'

    # 11. Special underwear brand enrichments (e.g. CK 048, ASORTI, FL 059, MS 058)
    if 'білизн' in cat_name.lower() or cat_slug == 'underwear':
        if not t.lower().startswith(('комплект', 'чоловіча', 'жіноча', 'труси')):
            if brand_slug != 'other':
                t = f'Комплект білизни {brand_title} {t}'
            else:
                t = f'Комплект білизни {t}'
        t = re.sub(r'Комплект білизни\s+Кросівки\s*', 'Комплект білизни ', t, flags=re.I)
        t = re.sub(r'(Комплект білизни\s*)+', 'Комплект білизни ', t, flags=re.I)

    # 12. Single generic words expansion
    if t.lower() == 'кепка':
        t = 'Кепка бейсболка'
    elif t.lower() == 'лофери':
        t = 'Чоловічі лофери'
    elif t.lower() == 'джинси':
        t = 'Джинси класичні'
    elif t.lower() == 'polo':
        t = 'Футболка поло'
    elif t.lower() == 'homme':
        t = 'Футболка Homme'

    # 13. Bags naming cleanup: prepend "Сумка" if it's a bag without product type
    if cat_slug == 'bags':
        if not any(t.lower().startswith(p) for p in ['сумка', 'рюкзак', 'бананка', 'гаманець', 'ремінь', 'окуляри', 'браслет', 'годинник', 'клатч', 'шопер']):
            t = f'Сумка {t}'

    # 14. Prepend brand if known and missing from title
    if brand_slug != 'other' and brand_title.lower() not in t.lower() and brand_slug not in t.lower():
        if brand_slug == 'jordan' and 'jordan' in t.lower():
            pass
        elif brand_slug == 'adidas' and 'yeezy' in t.lower():
            pass
        elif brand_slug == 'drmartens' and 'martens' in t.lower():
            pass
        elif any(t.lower().startswith(p) for p in ['сумка', 'спортивний костюм', 'куртка', 'зимове взуття', 'кросівки', 'худі', 'кепка', 'шапка', 'чоловіча білизна', 'жіноча білизна', 'окуляри', 'ремінь']):
            pass
        else:
            t = f'{brand_title} {t}'
            
    # 15. If title is very short (<= 3 chars) or bare numbers
    if re.match(r'^\d{3,4}[a-zA-Z]?$', t):
        t = f'{brand_title} {t}'
    elif len(t) <= 4 and brand_slug != 'other' and brand_title.lower() not in t.lower():
        t = f'{brand_title} {t}'
        
    # 16. Strip unclosed parentheses and clean double brand words
    if t.count('(') > t.count(')'):
        t = re.sub(r'\s*\([^\)]*$', '', t).strip()
    t = re.sub(r'\bBottega Veneta Veneta\b', 'Bottega Veneta', t, flags=re.I)
    t = re.sub(r'\bNew Balance New Balane\b', 'New Balance', t, flags=re.I)
    t = re.sub(r'\bNew Balance New Balance\b', 'New Balance', t, flags=re.I)

    t = re.sub(r'\s+', ' ', t).strip(' -.,')
    return t

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
    season_counts = Counter()
    brand_counts = Counter()

    for gid, items in groups.items():
        first = items[0]
        name = clean_text(first.findtext('name'))
        if not name:
            continue
            
        try:
            raw_price = int(first.findtext('priceuah') or 0)
        except ValueError:
            raw_price = 0
            
        if raw_price <= 0:
            continue
            
        cid = first.findtext('categoryId')
        cname = cat_names.get(cid, '')
        desc = first.findtext('description') or ''
        
        # Regex specs
        art_m = re.search(r'Артикул\s*:\s*([^<]+)', desc)
        mat_m = re.search(r'Матеріал\s*:\s*([^<]+)', desc)
        prod_m = re.search(r'Виробник\s*:\s*([^<]+)', desc)
        
        art = clean_text(art_m.group(1)) if art_m else ''
        if not art:
            vc = first.findtext('vendorCode') or first.findtext('barcode') or ''
            art = clean_text(vc.split('-')[0]) if '-' in vc else clean_text(vc)
        if not art or art.lower() in ('none', 'null', '-'):
            art = str(gid)

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
            avail = it.attrib.get('available') == 'true' or it.findtext('available') == 'true'
            if not avail:
                continue
            param = it.find('param')
            if param is not None and param.text:
                s = clean_text(param.text)
                if s and s not in sizes:
                    sizes.append(s)
        if not sizes:
            continue


        sorted_sizes = sort_sizes(sizes)
        params_str = ' '.join(clean_text(p.text) for it in items for p in it.findall('param') if p.text)
        
        brand_slug, brand_title = determine_brand(name, cname)
        cat_slug, cat_title, cat_icon = determine_category(name, cname, desc, params_str, sorted_sizes, mat, brand_slug)

        clean_name = clean_product_title(name, cat_slug, brand_slug, brand_title, cname, desc, params_str)
        if not clean_name:
            continue

        # Rule: if sneakers has less than 3 sizes in stock, do not add to site
        if is_sneaker_product(name, clean_name, cat_slug, cname, desc, sorted_sizes):
            if len(sorted_sizes) < 3:
                continue
        
        # Rule: Exclude LV bags ("Сумка LV" / Louis Vuitton bags)
        if cat_slug in ('bags', 'accessories') and (brand_slug == 'louisvuitton' or re.search(r'\b(lv|лв|louis\s*vuitton)\b', f"{name} {clean_name}", re.I)):
            continue
        if 'сумка' in clean_name.lower() and re.search(r'\b(lv|лв|louis\s*vuitton)\b', clean_name, re.I):
            continue
        
        gender = determine_gender(clean_name, cat_slug, brand_slug, sorted_sizes, cname, desc)
        season_slug, season_title, season_icon = determine_season(clean_name, cat_slug, mat, desc)

        category_counts[cat_slug] += 1
        season_counts[season_slug] += 1
        brand_counts[brand_slug] += 1
        
        # Selling price with +30% markup, rounded to 10 грн
        price = round((raw_price * 1.30) / 10) * 10

        # Old price for visual discount (15-20% above selling price, rounded to 10 грн)
        old_price = round((price * 1.18) / 10) * 10
        
        # Badge
        badge = "✨ Топ якість"
        if season_slug == 'winter':
            badge = "❄️ Зима • Термо"
        elif season_slug == 'summer':
            badge = "☀️ Літо • Легкість"
        elif 'sale' in cname.lower() or 'уцінка' in cname.lower():
            badge = "🏷 Знижка"
        elif brand_slug in ['nike', 'jordan', 'newbalance', 'adidas']:
            badge = "🔥 Хіт продажів"
            
        products.append({
            'id': str(gid),
            'name': clean_name,
            'price': price,
            'old_price': old_price,
            'cost_price': raw_price,
            'cat': cat_slug,
            'cat_name': cat_title,
            'season': season_slug,
            'season_name': season_title,
            'brand': brand_slug,
            'brand_name': brand_title,
            'gender': gender,
            'art': art or str(gid),
            'mat': mat,
            'origin': origin if origin != '-' else "В'єтнам",
            'badge': badge,
            'imgs': imgs[:5], # up to 5 images
            'sizes': sorted_sizes
        })

    print(f"Processed valid products: {len(products)}")
    print("Categories distribution:", dict(category_counts))
    print("Seasons distribution:", dict(season_counts))
    print("Brands distribution:", dict(brand_counts.most_common(15)))

    # Keep original article matching EasyDrop database exactly
    for p in products:
        if not p.get('art') or str(p.get('art')).lower() in ('none', 'null', '-'):
            p['art'] = str(p.get('id'))

    # Save data/products.json
    os.makedirs('data', exist_ok=True)
    with open(OUTPUT_PRODUCTS, 'w', encoding='utf-8') as f:
        json.dump(products, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Saved {OUTPUT_PRODUCTS} ({os.path.getsize(OUTPUT_PRODUCTS)} bytes)")

    men_count = sum(1 for p in products if p['gender'] in ('men', 'unisex'))
    women_count = sum(1 for p in products if p['gender'] in ('women', 'unisex'))

    # Save data/meta.json
    meta = {
        'total': len(products),
        'genders': [
            {'slug': 'all', 'name': 'Всі товари', 'icon': '🔥', 'count': len(products)},
            {'slug': 'men', 'name': 'Чоловічі', 'icon': '👨', 'count': men_count},
            {'slug': 'women', 'name': 'Жіночі', 'icon': '👩', 'count': women_count}
        ],
        'categories': [
            {'slug': 'all', 'name': 'Всі товари', 'icon': '🔥', 'count': len(products)},
            {'slug': 'shoes', 'name': 'Взуття', 'icon': '👟', 'count': category_counts['shoes']},
            {'slug': 'clothing', 'name': 'Одяг', 'icon': '🧥', 'count': category_counts['clothing']},
            {'slug': 'socks', 'name': 'Шкарпетки', 'icon': '🧦', 'count': category_counts['socks']},
            {'slug': 'underwear', 'name': 'Труси & Білизна', 'icon': '🩲', 'count': category_counts['underwear']},
            {'slug': 'accessories', 'name': 'Аксесуари & Сумки', 'icon': '🎒', 'count': category_counts['accessories']},
        ],
        'seasons': [
            {'slug': 'all', 'name': 'Всі сезони', 'icon': '🌍', 'count': len(products)},
            {'slug': 'demi', 'name': 'Демісезон', 'icon': '🍂', 'count': season_counts['demi']},
            {'slug': 'winter', 'name': 'Зима', 'icon': '❄️', 'count': season_counts['winter']},
            {'slug': 'summer', 'name': 'Літо', 'icon': '☀️', 'count': season_counts['summer']},
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
            if b_count > 0 and b_slug != 'other'
        ] + (
            [{'slug': 'other', 'name': 'Інші бренди', 'count': brand_counts['other']}]
            if brand_counts['other'] > 0 else []
        ))()
    }
    with open(OUTPUT_META, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    print(f"Saved {OUTPUT_META} with {len(meta['brands'])} brands")

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
        g_gender = 'male' if p.get('gender') == 'men' else ('female' if p.get('gender') == 'women' else 'unisex')
        feed_xml_lines.extend([
            '    <item>',
            f'      <g:id>prod-{p["id"]}</g:id>',
            f'      <title>{escape(p["name"])}</title>',
            f'      <description>{escape(desc_str)}</description>',
            f'      <link>https://urbangrid.com.ua/#prod-{p["id"]}</link>',
            f'      <g:image_link>{main_img}</g:image_link>',
            f'      <g:brand>{escape(p["brand_name"])}</g:brand>',
            f'      <g:gender>{g_gender}</g:gender>',
            '      <g:age_group>adult</g:age_group>',
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
