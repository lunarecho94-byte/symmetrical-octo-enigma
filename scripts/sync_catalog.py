#!/usr/bin/env python3
"""
sync_catalog.py
Parses easydrop_export.xml and creates optimized data/products.json and data/meta.json
"""

import os
import sys
import re
import json
import math
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
        s = re.sub(r'(\d+)\s*[-–]\s*(\d+)', r'\1–\2', str(s).strip())
        m = re.match(r'^(\d+(?:[.,]\d+)?)$', s)
        if m:
            val = float(m.group(1).replace(',', '.'))
            num_sizes.append((val, s))
        else:
            text_sizes.append(s)
            
    num_sizes.sort(key=lambda x: x[0])

    def get_order(txt):
        t = txt.upper()
        if t in size_order:
            return size_order.index(t)
        return 999
    text_sizes.sort(key=get_order)

    if num_sizes and not text_sizes:
        return [x[1] for x in num_sizes]
    if text_sizes and not num_sizes:
        return text_sizes
    return [x[1] for x in num_sizes] + text_sizes

DEFECT_SIZE_KEYWORDS = re.compile(
    r'нюанс|дефект|брак|плямк?а|уцінк|потертост|потёрт|вигорів|скидк|-50%|\bб/у\b|\bклей\b|без коробк|без ремен|зацеп|пошкодж|некомплект',
    re.I
)

def clean_origin(origin):
    if not origin:
        return ""
    orig = origin.strip()
    orig = re.sub(r'\(.*?\)', '', orig).strip()
    orig = re.sub(r'по бірці.*', '', orig, flags=re.I).strip()
    orig = re.sub(r'по факту.*', '', orig, flags=re.I).strip()
    orig = re.sub(r'Люкс.*', '', orig, flags=re.I).strip()
    
    orig_lower = orig.lower()
    if any(k in orig_lower for k in ['маломір', 'розмір', 'топ якість', 'топ качеств', 'lux', 'сезон', 'наявност', 'увага на см', 'роз сітку', 'шнурки', 'замша', 'шкіра', 'black', 'текстиль']):
        return ""
        
    if re.search(r'[вb][\'ʼ`]?.*[тt]нам|vietn|vuetn', orig_lower):
        return "В'єтнам"
    elif re.search(r'кита|china', orig_lower):
        return "Китай"
    elif re.search(r'туреч|турц|turkey', orig_lower):
        return "Туреччина"
    elif re.search(r'італія|италия|italy', orig_lower):
        return "Італія"
    elif re.search(r'франц|france|paris', orig_lower):
        return "Франція"
    elif re.search(r'індонез|индонез|indonesia', orig_lower):
        return "Індонезія"
    elif re.search(r'україна|украина|ukraine', orig_lower):
        return "Україна"
    elif re.search(r'єгипет|египет|egypt', orig_lower):
        return "Єгипет"
    elif re.search(r'австрал|australia', orig_lower):
        return "Австралія"
    elif re.search(r'португал|portugal', orig_lower):
        return "Португалія"
    elif re.search(r'німеч|герман|germany', orig_lower):
        return "Німеччина"
    elif re.search(r'сша|usa', orig_lower):
        return "США"
    elif re.search(r'камбодж|cambodia', orig_lower):
        return "Камбоджа"
    elif re.search(r'бангладеш|bangladesh', orig_lower):
        return "Бангладеш"
    elif re.search(r'іспан|испан|spain', orig_lower):
        return "Іспанія"
    elif re.search(r'індія|индия|india', orig_lower):
        return "Індія"
    elif re.search(r'швеція|швеция|sweden', orig_lower):
        return "Швеція"
    elif re.search(r'румунія|румыния|romania', orig_lower):
        return "Румунія"
        
    return orig

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
    ('reebok', 'Reebok', [r'reebok']),
    ('mizuno', 'Mizuno', [r'mizuno']),
    ('dsquared2', 'Dsquared2', [r'dsquared']),
    ('tommy', 'Tommy Hilfiger', [r'tommy', r'hilfiger']),
    ('aloyoga', 'Alo Yoga', [r'\balo\b', r'alo\s*yoga']),
]

def determine_category(name, cat_name, desc, params_str="", sizes=None, mat="", brand_slug=""):
    title_cat = f"{name} {cat_name}".strip()
    title_cat_lower = title_cat.lower()
    sizes = sizes or []
    shoe_sizes = [s for s in sizes if re.match(r'^(3[5-9]|4[0-8])$', str(s).strip())]
    clothing_sizes = [s for s in sizes if str(s).upper() in ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL']]

    # Special Kids Homme t-shirt
    if 'k0025 homme' in title_cat_lower or title_cat_lower == 'homme':
        return 'clothing', 'Одяг', ''

    # 1. Definitive Footwear Brand & Model overrides:
    # UGG, Merrell, Crocs, Birkenstock in EasyDrop are ALWAYS footwear (shoes)
    if brand_slug in ('ugg', 'merrell', 'birkenstock') or re.search(r'\b(ugg|угг|merrell|birkenstock)\b', title_cat_lower):
        return 'shoes', 'Взуття', ''

    # Models with 'sock', 'cap', 'pouch' that are actually footwear
    if re.search(r'tazz sock|sock dart|speed sock|ice cap|drainmaker|2002r.*pouch|knu skool|old skool', title_cat_lower):
        return 'shoes', 'Взуття', ''

    # Feed category name explicitly marks footwear:
    if '(взуття)' in cat_name.lower() or re.search(r'кросівки|кеди|сланці|шльопанці|тапочки|\bboots\b|\bsneakers\b|зим.*взуття', cat_name, re.I):
        return 'shoes', 'Взуття', ''

    # 2. Underwear (Труси / Нижня білизна / Домашній одяг / Піжами)
    # Feed category marks underwear & pajamas:
    if re.search(r'труси\s*\(одяг\)|\bтруси\b|чоловіча білизна|комплекти білизни|попожам|піжам', cat_name, re.I):
        return 'underwear', 'Труси & Білизна', ''
    # Text marks underwear (including sets of underwear + socks, pajamas):
    if re.search(r'трус|боксер|білизн|плавки|попожам|піжам|пеньюар|кігурумі|нічна сорочк|\bunderwear\b|\bbriefs?\b|\bboxers?\b', title_cat_lower):
        return 'underwear', 'Труси & Білизна', ''

    # 3. Socks (Шкарпетки)
    # Feed category marks pure socks:
    if re.search(r'комплекти шкарпеток|\bноски\b|шкарпетки', cat_name, re.I) and 'білизн' not in cat_name.lower():
        return 'socks', 'Шкарпетки', ''
    # Name marks socks (only if not a shoe with shoe sizes):
    if re.search(r'шкарпетк|носк|\bsocks?\b', title_cat_lower):
        if not (len(shoe_sizes) >= 2 and any(k in title_cat_lower for k in ['ugg', 'nike', 'adidas', 'runner', 'trainer', 'boot', 'tazz'])):
            return 'socks', 'Шкарпетки', ''

    # 4. Bags & Accessories
    desc_start = ''
    m = re.search(r'Опис\s*:\s*([^<\n\r]+)', desc)
    if m:
        desc_start = m.group(1).strip()[:150]

    # Handbag/Belt dimensions check: e.g. "34 x 26 x 13", "25x17x9", "100 х 2,5"
    if params_str and re.search(r'\d+\s*[xх]\s*\d+', params_str) and not any(k in title_cat_lower for k in ['кросівки', 'кеди', 'взуття', 'костюм']):
        return 'accessories', 'Аксесуари & Сумки', ''

    if BAG_KEYWORDS.search(title_cat) or (desc_start and re.search(r'^(сумка|рюкзак|бананка|гаманець|ремінь|окуляри|браслет|клатч|шапка|кепка|панама)', desc_start, re.I)):
        return 'accessories', 'Аксесуари & Сумки', ''

    # 5. Clothing & Outerwear
    if re.search(r'\bодяг\b|\(одяг\)|костюм|куртк|пуховик|худі|світшот|толстовк|штани|шорти|футболк|сорочк|рубашк|джинс', cat_name, re.I):
        return 'clothing', 'Одяг & Куртки', ''

    if CLOTHING_KEYWORDS.search(title_cat) or (desc_start and re.search(r'^(костюм|куртка|пуховик|худі|світшот|штани|футболка|шорти|сорочка)', desc_start, re.I)):
        return 'clothing', 'Одяг & Куртки', ''

    # If product has clothing sizes (S, M, L, XL, XXL) and NO shoe sizes, it is Clothing!
    if clothing_sizes and not shoe_sizes:
        return 'clothing', 'Одяг & Куртки', ''

    # 6. Footwear models & numeric shoe sizes (e.g. 36-47):
    # If it has 2+ numeric shoe sizes and comes from a sneaker brand or has sneaker keywords
    if len(shoe_sizes) >= 2 and any(k in title_cat_lower for k in [
        'new balance', 'nike', 'adidas', 'puma', 'asics', 'jordan', 'vans', 'converse', 'salomon', 'saucony', 'reebok', 'hoka', 'on cloud', 'premiata', 'dr.martens', 'martens',
        'кросів', 'кроссов', 'кеди', 'кеды', 'ботинк', 'черевик', 'хайтоп', 'sneaker', 'сникер', 'лофер', 'туфл', 'чобот', 'сабо', 'сандал', 'шльоп', 'сланц', 'slide'
    ]):
        if not any(k in title_cat_lower for k in ['футболк', 'худі', 'світшот', 'штани', 'шорти', 'куртка', 'костюм', 'шапка', 'кепка', 'панама', 'сумка', 'рюкзак', 'попожам', 'піжам']):
            return 'shoes', 'Взуття', ''

    if shoe_sizes:
        return 'shoes', 'Взуття', ''

    # 7. Fallback is Shoes
    return 'shoes', 'Взуття', ''

def determine_season(name, cat_slug, mat="", desc="", cname=""):
    name_lower = name.lower()
    mat_lower = (mat or '').lower()
    cname_lower = (cname or '').lower()
    full_ctx = f"{name_lower} {mat_lower} {cname_lower}"

    # 0. Check 'без меха' / 'без хутра'
    has_no_fur = bool(re.search(r'без\s+(?:меха|хутра)', full_ctx))

    # 1. WINTER (Зима / Термо / Хутро / Пуховики / Утеплені моделі)
    is_polar = bool(re.search(r'antarktik|gaiadome|duckboot', name_lower))
    winter_kw = bool(re.search(
        r'(?:зима|зимов|winter|термо|хутр|мех|мехом|пуховик|пуховики|парка|сноубут|дутик|мунбут|фліс|флис|fleece|шерсть|утепл|єврозима|еврозима|primaloft|thinsulate|холлофайбер|холофайбер|силікон|силикон|жилет|безрукав)',
        full_ctx
    ))
    is_ugg = bool(re.search(r'\b(ugg|угг)\b', name_lower)) and not bool(re.search(r'сланц|сандал|шльоп', name_lower))
    has_fur_in_title = bool(re.search(r'\(хутро\)|\(термо\)', name_lower))
    is_warm_apparel = bool(re.search(r'пуховик|парка|пальто|дублянк|куртк|анорак', name_lower)) and cat_slug == 'clothing' and not bool(re.search(r'вітровк|ветровк', name_lower))

    if (winter_kw or is_polar or is_ugg or is_warm_apparel or has_fur_in_title) and not has_no_fur:
        return 'winter', 'Зима', ''

    # 2. SUMMER (Літо / Сланці / Сандалі / Шорти / Футболки)
    # Tactical / Waterproof / Heavy boots / Warm clothing MUST NEVER be summer:
    is_gtx_waterproof = bool(re.search(r'gore[-\s]?tex|gtx|cordura|waterproof|forces|quest\s*4d', name_lower))
    is_heavy_boot = bool(re.search(r'ботинк|черевик|берц|чобот|хайтоп|дутик|сноубут|мунбут', name_lower))
    is_warm_clothing = bool(re.search(r'худі|худи|світшот|свитшот|толстовк|штани|штаны|джинс|куртк|вітровк|ветровк|бомбер|анорак|костюм', name_lower))

    if not (is_gtx_waterproof or is_heavy_boot or is_warm_clothing or is_warm_apparel):
        is_open_shoe = bool(re.search(r'сланц|шльоп|шлеп|сандал|босоніж|\bcrocs\b|крокс|вьетнамк|в\'єтнамк|\bslides?\b|\bclog\b', name_lower)) and cat_slug == 'shoes'
        is_summer_clothing = (bool(re.search(r'\b(?:шорти|шорты|майка|майки|футболка|футболки|поло|купальник|купальники|плавки)\b', name_lower)) or bool(re.search(r'шорти|шорты', cname_lower))) and cat_slug in ('clothing', 'underwear')
        is_summer_mesh = bool(re.search(r'\b(?:climacool|breeze)\b', name_lower)) and cat_slug == 'shoes' and not bool(re.search(r'шкіра|кожа|замша|нубук|suede|leather', full_ctx))
        is_summer_acc = bool(re.search(r'\b(?:панама|панамка)\b', name_lower)) and cat_slug == 'accessories'

        if is_open_shoe or is_summer_clothing or is_summer_mesh or is_summer_acc:
            return 'summer', 'Літо', ''

    # 3. DEMI-SEASON (Демісезон / Весна-Осінь / Базове щоденне взуття та одяг)
    return 'demi', 'Демісезон', ''

EXPLICIT_PRODUCT_OVERRIDES = {
    # 1. б/н products
    '125679': {'name': 'Спортивний костюм Adidas Originals Білий / Чорний', 'brand': ('adidas', 'Adidas')},
    '125825': {'name': 'Зимовий спортивний костюм Tommy Jeans x Coca-Cola Червоний', 'brand': ('tommy', 'Tommy Hilfiger')},
    '125826': {'name': 'Зимовий спортивний костюм Tommy Jeans x Coca-Cola Сірий', 'brand': ('tommy', 'Tommy Hilfiger')},
    '125828': {'name': 'Зимовий спортивний костюм Adidas Originals Tape Білий', 'brand': ('adidas', 'Adidas')},
    '125617': {'name': 'Спортивний костюм Nike Swoosh Чорний', 'brand': ('nike', 'Nike')},
    '125622': {'name': 'Спортивний костюм Nike Just Do It Рефлективний', 'brand': ('nike', 'Nike')},
    '125625': {'name': 'Спортивний костюм Nike Swoosh Червоний / Чорний', 'brand': ('nike', 'Nike')},
    '125681': {'name': 'Спортивний костюм Adidas Чорний / Жовтий', 'brand': ('adidas', 'Adidas')},
    '125694': {'name': 'Спортивний костюм Under Armour Рефлективний Сірий', 'brand': ('underarmour', 'Under Armour')},
    '125696': {'name': 'Спортивний костюм Under Armour Рефлективний Графітовий', 'brand': ('underarmour', 'Under Armour')},
    '125842': {'name': 'Олімпійка Adidas Originals Біла', 'brand': ('adidas', 'Adidas')},
    '125844': {'name': 'Олімпійка Adidas Originals Чорна', 'brand': ('adidas', 'Adidas')},
    '126117': {'name': 'Спортивні штани Tommy Jeans Темно-сині', 'brand': ('tommy', 'Tommy Hilfiger')},
    '126120': {'name': 'Спортивні штани Adidas Originals 3-Stripes', 'brand': ('adidas', 'Adidas')},
    '126123': {'name': 'Спортивні штани Givenchy Чорні', 'brand': ('other', 'Givenchy')},
    '126230': {'name': 'Зимові спортивні штани Adidas Originals 3-Stripes Чорні', 'brand': ('adidas', 'Adidas')},
    '126234': {'name': 'Зимові спортивні штани Adidas Originals Tape Білі', 'brand': ('adidas', 'Adidas')},
    '125320': {'name': 'Пуховик The North Face 1996 Nuptse Синій', 'brand': ('tnf', 'The North Face')},
    '125322': {'name': 'Пуховик The North Face 1996 Nuptse Помаранчевий', 'brand': ('tnf', 'The North Face')},

    # 2. NB357-360 winter sneakers
    '194279': {'name': 'Зимові кросівки New Balance 9060 Black Fur', 'brand': ('newbalance', 'New Balance')},
    '194281': {'name': 'Зимові кросівки New Balance 9060 Grey Fur', 'brand': ('newbalance', 'New Balance')},
    '194282': {'name': 'Зимові кросівки New Balance 9060 Khaki / Brown Fur', 'brand': ('newbalance', 'New Balance')},
    '194283': {'name': 'Зимові кросівки New Balance 9060 Light Grey Fur', 'brand': ('newbalance', 'New Balance')},

    # 3. H slides
    '123029': {'name': "В'єтнамки Rider Soft Dry Foam Хакі", 'brand': ('other', 'Rider')},
    '123042': {'name': 'Сланці Reebok Classic White / Black', 'brand': ('reebok', 'Reebok')},
    '168381': {'name': 'Сланці Rider на липучці Сірі', 'brand': ('other', 'Rider')},
    '168382': {'name': 'Сланці Rider на липучці Black / Blue', 'brand': ('other', 'Rider')},

    # 4. SC summer sets
    '126296': {'name': 'Літній комплект Jordan Jumpman + Шорти Nike Білий / Чорний', 'brand': ('jordan', 'Air Jordan')},
    '126297': {'name': 'Літній комплект Nike Swoosh Білий', 'brand': ('nike', 'Nike')},
    '126484': {'name': 'Літній комплект Adidas Чорний', 'brand': ('adidas', 'Adidas')},
    '126486': {'name': 'Літній комплект Adidas Білий / Чорний', 'brand': ('adidas', 'Adidas')},
    '126487': {'name': 'Літній комплект Adidas Червоний / Чорний', 'brand': ('adidas', 'Adidas')},

    # 5. SH shorts
    '126268': {'name': 'Шорти Nike Air Білі з чорними вставками', 'brand': ('nike', 'Nike')},
    '126266': {'name': 'Шорти Nike Air з лампасами Білі', 'brand': ('nike', 'Nike')},
    '126269': {'name': 'Шорти Adidas Originals 3-Stripes Червоні', 'brand': ('adidas', 'Adidas')},

    # 6. TS t-shirts
    '126283': {'name': 'Футболка Nike Air Fly Higher Світло-оливкова', 'brand': ('nike', 'Nike')},
    '126285': {'name': 'Футболка Nike Air Fly Higher Сіра', 'brand': ('nike', 'Nike')},
    '126287': {'name': 'Футболка Nike Air Fly Higher Чорна', 'brand': ('nike', 'Nike')},
    '126289': {'name': 'Футболка Nike Air Fly Higher Біла', 'brand': ('nike', 'Nike')},
    '126290': {'name': 'Футболка Nike Air Сіра', 'brand': ('nike', 'Nike')},
    '126293': {'name': 'Футболка Nike Air Чорна', 'brand': ('nike', 'Nike')},
    '126294': {'name': 'Футболка Nike Air Біла', 'brand': ('nike', 'Nike')},
    '126279': {'name': 'Футболка Machinist Shift Жовта', 'brand': ('other', 'Machinist')},
    '126280': {'name': 'Футболка Polo Ralph Lauren Чорна', 'brand': ('ralphlauren', 'Ralph Lauren')},
    '126282': {'name': 'Футболка Polo Ralph Lauren Біла', 'brand': ('ralphlauren', 'Ralph Lauren')},

    # 7. P sweatpants
    '162206': {'name': 'Спортивні штани джогери Basic Бежеві', 'brand': ('other', 'Basic')},
    '162208': {'name': 'Спортивні штани джогери Basic Блакитні', 'brand': ('other', 'Basic')},

    # 8. S sweatshirts / pullovers
    '162179': {'name': 'Світшот Colorblock Бежевий / Білий', 'brand': ('other', 'Basic')},
    '162180': {'name': 'Світшот Colorblock Блакитний / Білий', 'brand': ('other', 'Basic')},
    '162181': {'name': 'Світшот Colorblock Чорний / Білий', 'brand': ('other', 'Basic')},
    '162183': {'name': 'Світшот Colorblock Графітовий / Білий', 'brand': ('other', 'Basic')},
    '162184': {'name': 'Світшот Colorblock Оливковий / Білий', 'brand': ('other', 'Basic')},
    '162186': {'name': 'Світшот Colorblock Світло-сірий / Білий', 'brand': ('other', 'Basic')},
    '162188': {'name': 'Світшот Basic Чорний', 'brand': ('other', 'Basic')},
    '162190': {'name': 'Анорак на блискавці Colorblock Білий / Сірий / Чорний', 'brand': ('other', 'Basic')},

    # 9. T oversize t-shirts
    '162192': {'name': 'Футболка оверсайз Colorblock Бежева / Біла', 'brand': ('other', 'Basic')},
    '162195': {'name': 'Футболка оверсайз Colorblock Блакитна / Біла', 'brand': ('other', 'Basic')},
    '162197': {'name': 'Футболка оверсайз Colorblock Чорна / Біла', 'brand': ('other', 'Basic')},
    '162199': {'name': 'Футболка оверсайз Colorblock Графітова / Біла', 'brand': ('other', 'Basic')},
    '162201': {'name': 'Футболка оверсайз Colorblock Оливкова / Біла', 'brand': ('other', 'Basic')},
    '162204': {'name': 'Футболка оверсайз Colorblock Світло-сіра / Біла', 'brand': ('other', 'Basic')},

    # 10. M apparel
    '48529': {'name': 'Худі Jordan Flight Чорне', 'brand': ('jordan', 'Air Jordan')},
    '48531': {'name': 'Спортивні штани Jordan Flight Чорні', 'brand': ('jordan', 'Air Jordan')},
    '48550': {'name': 'Штани карго Nike Чорні', 'brand': ('nike', 'Nike')},
    '48551': {'name': 'Спортивні штани Nike Swoosh Чорні', 'brand': ('nike', 'Nike')},
    '48554': {'name': 'Штани карго Jordan Flight Чорні', 'brand': ('jordan', 'Air Jordan')},
    '48557': {'name': 'Штани карго Nike Sportswear Чорні', 'brand': ('nike', 'Nike')},
    '48559': {'name': 'Спортивні штани Nike Dri-FIT Чорні', 'brand': ('nike', 'Nike')},
    '48574': {'name': 'Тепла вовняна сорочка Stone Island в клітинку', 'brand': ('stoneisland', 'Stone Island')},
    '48576': {'name': 'Штани карго Stone Island Сірі', 'brand': ('stoneisland', 'Stone Island')},
    '53873': {'name': 'Олімпійка Balenciaga Colorblock Бежева / Чорна', 'brand': ('balenciaga', 'Balenciaga')},
    '53874': {'name': 'Олімпійка Balenciaga Colorblock Сіра / Чорна', 'brand': ('balenciaga', 'Balenciaga')},

    # 11. Stone Island & Arc'teryx jackets
    '70180': {'name': "Куртка вітровка Arc'teryx Beta LT Чорна (Gore-Tex)", 'brand': ('arcteryx', "Arc'teryx")},
    '70190': {'name': 'Куртка вітровка Stone Island Grid Чорна', 'brand': ('stoneisland', 'Stone Island')},
    '70174': {'name': 'Куртка вітровка Stone Island Soft Shell Чорна', 'brand': ('stoneisland', 'Stone Island')},
    '70189': {'name': 'Куртка вітровка Stone Island Garment Dyed Чорна', 'brand': ('stoneisland', 'Stone Island')},

    # 12. Adidas hoodies
    '76343': {'name': 'Худі на блискавці Adidas 3-Stripes Чорне', 'brand': ('adidas', 'Adidas')},
    '80147': {'name': 'Худі на блискавці Adidas Originals Чорне', 'brand': ('adidas', 'Adidas')},

    # 13. Bare brand footwear
    '153641': {'name': 'Кросівки Adidas Yeezy Boost 350 V2 Cream White', 'brand': ('adidas', 'Adidas')},
    '130610': {'name': 'Кросівки Adidas Forum Low White / Green', 'brand': ('adidas', 'Adidas')},
    '179886': {'name': 'Кросівки Nike Zoom Fly Pink', 'brand': ('nike', 'Nike')},
    '140244': {'name': 'Кросівки Nike Air Max 90 Mid Winter Black / Orange', 'brand': ('nike', 'Nike')},
    '183737': {'name': 'Кросівки Gucci Re-Web Burgundy GG', 'brand': ('gucci', 'Gucci')},
    '183732': {'name': 'Кросівки Gucci Tennis 1977 Platform Pink GG', 'brand': ('gucci', 'Gucci')},
    '183734': {'name': 'Кросівки Gucci Tennis 1977 Platform Black / White GG', 'brand': ('gucci', 'Gucci')},
    '183735': {'name': 'Кросівки Gucci Tennis 1977 Platform Red GG', 'brand': ('gucci', 'Gucci')},
    '215515': {'name': 'Кросівки Premiata Mick Blue / Grey', 'brand': ('premiata', 'Premiata')},
    '219545': {'name': 'Кросівки Premiata Mick Black', 'brand': ('premiata', 'Premiata')},
    '224015': {'name': 'Кросівки Fila Original Fitness White / Black / Red', 'brand': ('fila', 'Fila')},

    # 14. No brand sneakers
    '19683': {'name': 'Кросівки Nike M2K Tekno White', 'brand': ('nike', 'Nike')},
    '19677': {'name': 'Кросівки Adidas Yeezy Boost 700 V2 Vanta Black', 'brand': ('adidas', 'Adidas')},
    '20371': {'name': 'Кросівки Converse Run Star Hike White', 'brand': ('converse', 'Converse')},
    '19687': {'name': 'Кросівки Converse Run Star Hike Low Black', 'brand': ('converse', 'Converse')},
    '19685': {'name': 'Кросівки Nike Air VaporMax Blue', 'brand': ('nike', 'Nike')},
    '20699': {'name': 'Кросівки Adidas Ozweego White', 'brand': ('adidas', 'Adidas')},
    '20766': {'name': 'Кросівки Nike Dunk Low Black White', 'brand': ('nike', 'Nike')},
    '20769': {'name': 'Кросівки Chunky Holographic Reflective', 'brand': ('other', 'Інші бренди')},
    '19686': {'name': 'Кросівки Converse Run Star Hike Black', 'brand': ('converse', 'Converse')},
    '19688': {'name': 'Кросівки Nike Air VaporMax White', 'brand': ('nike', 'Nike')},
    '19684': {'name': 'Кросівки Nike Air Force 1 Low White', 'brand': ('nike', 'Nike')},
    '20768': {'name': 'Кеди Casual Skate Beige Suede', 'brand': ('other', 'Інші бренди')},

    # 15. Special items
    '189527': {'name': 'Зимові черевики UGG Lowmel Black', 'brand': ('ugg', 'UGG')},
    '125083': {'name': 'Вітровка Tommy Hilfiger Демісезонна', 'brand': ('tommy', 'Tommy Hilfiger')},
    '252213': {'name': 'Кросівки Asics Gel-Pickax Black', 'brand': ('asics', 'Asics')},

    # 16. Specific V windbreakers
    '124793': {'name': 'Вітровка The North Face Black / Grey', 'brand': ('tnf', 'The North Face')},
    '124803': {'name': 'Вітровка Under Armour Black', 'brand': ('underarmour', 'Under Armour')},
    '124839': {'name': 'Вітровка New Balance Black з капюшоном', 'brand': ('newbalance', 'New Balance')},
    '124565': {'name': 'Вітровка Adidas Adventure Black з капюшоном', 'brand': ('adidas', 'Adidas')},
    '124567': {'name': 'Вітровка Adidas Neo Black з капюшоном', 'brand': ('adidas', 'Adidas')},
    '124788': {'name': 'Вітровка The North Face Black', 'brand': ('tnf', 'The North Face')},

    # 17. Additional specific fixes (No brand boots, bags, loafers, sneakers)
    '25291': {'name': 'Черевики челсі шкіряні зимові з пряжкою Чорні', 'brand': ('other', 'Інші бренди')},
    '25292': {'name': 'Черевики челсі шкіряні зимові з пряжкою Бежеві', 'brand': ('other', 'Інші бренди')},
    '21336': {'name': 'Жіночі високі черевики на платформі з хутром Бежеві', 'brand': ('other', 'Інші бренди')},
    '99491': {'name': 'Сумка месенджер текстильна End&start Чорна', 'brand': ('other', 'Інші бренди')},
    '106510': {'name': 'Кросівки лакові на платформі Alexander McQueen Бежеві', 'brand': ('other', 'Alexander McQueen')},
    '106493': {'name': 'Кросівки Adidas Yeezy Boost 700 V2 Black / White', 'brand': ('adidas', 'Adidas')},
    '106512': {'name': 'Масивні кросівки Chunky Sole Black / White', 'brand': ('other', 'Інші бренди')},
    '220512': {'name': 'Кросівки трекінгові Salomon S/LAB Genesis Zip Чорні', 'brand': ('salomon', 'Salomon')},
    '220513': {'name': 'Кросівки Asics Gel-Kinsei FluidRide Чорні', 'brand': ('asics', 'Asics')},
    '220519': {'name': 'Кросівки Asics Gel-Kinsei FluidRide Світло-сірі', 'brand': ('asics', 'Asics')},
    '220514': {'name': 'Кросівки Asics Gel-Contend 4 Бежеві', 'brand': ('asics', 'Asics')},
    '220516': {'name': 'Кросівки Asics Gel-Contend 4 Оливкові', 'brand': ('asics', 'Asics')},
    '220523': {'name': 'Кросівки New Balance 1906R Silver / Navy', 'brand': ('newbalance', 'New Balance')},
    '220525': {'name': 'Кросівки Adidas Campus 00s Grey Gum', 'brand': ('adidas', 'Adidas')},
    '226382': {'name': 'Кросівки замшеві Miu Miu з подвійними шнурками Чорні', 'brand': ('miumiu', 'Miu Miu')},
    '226383': {'name': 'Кросівки замшеві Miu Miu з подвійними шнурками Коричневі', 'brand': ('miumiu', 'Miu Miu')},
    '226387': {'name': 'Лофери замшеві Loro Piana Summer Charms Walk Пісочні', 'brand': ('loropiana', 'Loro Piana')},
    '226389': {'name': 'Лофери замшеві Loro Piana Summer Walk Світло-сірі', 'brand': ('loropiana', 'Loro Piana')},
    '226391': {'name': 'Лофери замшеві Loro Piana Summer Walk Бежеві', 'brand': ('loropiana', 'Loro Piana')},
    '226393': {'name': 'Мюлі замшеві Loro Piana Summer Walk Темно-коричневі', 'brand': ('loropiana', 'Loro Piana')},
    '226394': {'name': 'Мюлі замшеві Loro Piana Summer Walk Чорні', 'brand': ('loropiana', 'Loro Piana')},
    '226395': {'name': 'Лофери замшеві Loro Piana Summer Charms Walk Чорні', 'brand': ('loropiana', 'Loro Piana')},
    '226407': {'name': 'Лофери замшеві Loro Piana Summer Charms Walk Коричневі', 'brand': ('loropiana', 'Loro Piana')},
    '253107': {'name': 'Спідниця Alo Yoga Black', 'brand': ('aloyoga', 'Alo Yoga')},
    '253108': {'name': 'Спідниця Alo Yoga White', 'brand': ('aloyoga', 'Alo Yoga')},
    '253103': {'name': 'Жіночий спортивний костюм Alo Yoga Brown', 'brand': ('aloyoga', 'Alo Yoga')},
    '253105': {'name': 'Жіночий спортивний комплект Alo Yoga Basic Black', 'brand': ('aloyoga', 'Alo Yoga')},
    '253106': {'name': 'Жіночий спортивний комплект Alo Yoga Basic Pink', 'brand': ('aloyoga', 'Alo Yoga')},
    '253110': {'name': 'Жіночі широкі штани Alo Yoga Сині', 'brand': ('aloyoga', 'Alo Yoga')},
    '253109': {'name': 'Жіноча футболка Alo Yoga Basic Black', 'brand': ('aloyoga', 'Alo Yoga')},
    '208541': {'name': 'Кросівки Alo Yoga Runner Beige', 'brand': ('aloyoga', 'Alo Yoga')},
    '170405': {'name': 'Жіноча футболка оверсайз Balenciaga Logo Embroidery Black', 'brand': ('balenciaga', 'Balenciaga')},
    '167814': {'name': 'Жіноче худі оверсайз Balenciaga Political Campaign Beige', 'brand': ('balenciaga', 'Balenciaga')},
    '173658': {'name': 'Шорти Nike ACG UV Black', 'brand': ('nike', 'Nike')},
    '234799': {'name': 'Шорти Nike Black', 'brand': ('nike', 'Nike')},
    '234800': {'name': 'Шорти Nike Blue', 'brand': ('nike', 'Nike')},
    '98991': {'name': 'Шорти Patagonia Khaki', 'brand': ('other', 'Patagonia')},
    '234797': {'name': 'Шорти Salomon 11byBBS', 'brand': ('salomon', 'Salomon')},
}

EXPLICIT_NAME_OVERRIDES = {
    'б/нк8': ('Спортивний костюм Adidas Originals Білий / Чорний', ('adidas', 'Adidas')),
    'б/нкз1': ('Зимовий спортивний костюм Tommy Jeans x Coca-Cola Червоний', ('tommy', 'Tommy Hilfiger')),
    'б/нкз2': ('Зимовий спортивний костюм Tommy Jeans x Coca-Cola Сірий', ('tommy', 'Tommy Hilfiger')),
    'б/нкз3': ('Зимовий спортивний костюм Adidas Originals Tape Білий', ('adidas', 'Adidas')),
    'б/нк2': ('Спортивний костюм Nike Swoosh Чорний', ('nike', 'Nike')),
    'б/нк4': ('Спортивний костюм Nike Just Do It Рефлективний', ('nike', 'Nike')),
    'б/нк5': ('Спортивний костюм Nike Swoosh Червоний / Чорний', ('nike', 'Nike')),
    'б/нк10': ('Спортивний костюм Adidas Чорний / Жовтий', ('adidas', 'Adidas')),
    'б/нк11': ('Спортивний костюм Under Armour Рефлективний Сірий', ('underarmour', 'Under Armour')),
    'б/нк14': ('Спортивний костюм Under Armour Рефлективний Графітовий', ('underarmour', 'Under Armour')),
    'б/нко1': ('Олімпійка Adidas Originals Біла', ('adidas', 'Adidas')),
    'б/нко2': ('Олімпійка Adidas Originals Чорна', ('adidas', 'Adidas')),
    'spб/н1': ('Спортивні штани Tommy Jeans Темно-сині', ('tommy', 'Tommy Hilfiger')),
    'spб/н2': ('Спортивні штани Adidas Originals 3-Stripes', ('adidas', 'Adidas')),
    'spб/н3': ('Спортивні штани Givenchy Чорні', ('other', 'Givenchy')),
    'spб/н4': ('Зимові спортивні штани Adidas Originals 3-Stripes Чорні', ('adidas', 'Adidas')),
    'spб/н5': ('Зимові спортивні штани Adidas Originals Tape Білі', ('adidas', 'Adidas')),
    'б/н3': ('Пуховик The North Face 1996 Nuptse Синій', ('tnf', 'The North Face')),
    'б/н4': ('Пуховик The North Face 1996 Nuptse Помаранчевий', ('tnf', 'The North Face')),
    'nb357': ('Зимові кросівки New Balance 9060 Black Fur', ('newbalance', 'New Balance')),
    'nb358': ('Зимові кросівки New Balance 9060 Grey Fur', ('newbalance', 'New Balance')),
    'nb359': ('Зимові кросівки New Balance 9060 Khaki / Brown Fur', ('newbalance', 'New Balance')),
    'nb360': ('Зимові кросівки New Balance 9060 Light Grey Fur', ('newbalance', 'New Balance')),
    'h018': ("В'єтнамки Rider Soft Dry Foam Хакі", ('other', 'Rider')),
    'h028': ('Сланці Reebok Classic White / Black', ('reebok', 'Reebok')),
    'h041': ('Сланці Rider на липучці Сірі', ('other', 'Rider')),
    'h042': ('Сланці Rider на липучці Black / Blue', ('other', 'Rider')),
    'sc03': ('Літній комплект Jordan Jumpman + Шорти Nike Білий / Чорний', ('jordan', 'Air Jordan')),
    'sc04': ('Літній комплект Nike Swoosh Білий', ('nike', 'Nike')),
    'sc06': ('Літній комплект Adidas Чорний', ('adidas', 'Adidas')),
    'sc07': ('Літній комплект Adidas Білий / Чорний', ('adidas', 'Adidas')),
    'sc08': ('Літній комплект Adidas Червоний / Чорний', ('adidas', 'Adidas')),
    'sh03': ('Шорти Nike Air Білі з чорними вставками', ('nike', 'Nike')),
    'sh05': ('Шорти Nike Air з лампасами Білі', ('nike', 'Nike')),
    'sh06': ('Шорти Adidas Originals 3-Stripes Червоні', ('adidas', 'Adidas')),
    'ts01': ('Футболка Nike Air Fly Higher Світло-оливкова', ('nike', 'Nike')),
    'ts02': ('Футболка Nike Air Fly Higher Сіра', ('nike', 'Nike')),
    'ts03': ('Футболка Nike Air Fly Higher Чорна', ('nike', 'Nike')),
    'ts04': ('Футболка Nike Air Fly Higher Біла', ('nike', 'Nike')),
    'ts05': ('Футболка Nike Air Сіра', ('nike', 'Nike')),
    'ts08': ('Футболка Nike Air Чорна', ('nike', 'Nike')),
    'ts09': ('Футболка Nike Air Біла', ('nike', 'Nike')),
    'ts12': ('Футболка Machinist Shift Жовта', ('other', 'Machinist')),
    'ts13': ('Футболка Polo Ralph Lauren Чорна', ('ralphlauren', 'Ralph Lauren')),
    'ts14': ('Футболка Polo Ralph Lauren Біла', ('ralphlauren', 'Ralph Lauren')),
    'p001': ('Спортивні штани джогери Basic Бежеві', ('other', 'Basic')),
    'p002': ('Спортивні штани джогери Basic Блакитні', ('other', 'Basic')),
    's001': ('Світшот Colorblock Бежевий / Білий', ('other', 'Basic')),
    's002': ('Світшот Colorblock Блакитний / Білий', ('other', 'Basic')),
    's003': ('Світшот Colorblock Чорний / Білий', ('other', 'Basic')),
    's004': ('Світшот Colorblock Графітовий / Білий', ('other', 'Basic')),
    's005': ('Світшот Colorblock Оливковий / Білий', ('other', 'Basic')),
    's006': ('Світшот Colorblock Світло-сірий / Білий', ('other', 'Basic')),
    's007': ('Світшот Basic Чорний', ('other', 'Basic')),
    's008': ('Анорак на блискавці Colorblock Білий / Сірий / Чорний', ('other', 'Basic')),
    't001': ('Футболка оверсайз Colorblock Бежева / Біла', ('other', 'Basic')),
    't002': ('Футболка оверсайз Colorblock Блакитна / Біла', ('other', 'Basic')),
    't003': ('Футболка оверсайз Colorblock Чорна / Біла', ('other', 'Basic')),
    't004': ('Футболка оверсайз Colorblock Графітова / Біла', ('other', 'Basic')),
    't005': ('Футболка оверсайз Colorblock Оливкова / Біла', ('other', 'Basic')),
    't006': ('Футболка оверсайз Colorblock Світло-сіра / Біла', ('other', 'Basic')),
    'm8011': ('Худі Jordan Flight Чорне', ('jordan', 'Air Jordan')),
    'm8012': ('Спортивні штани Jordan Flight Чорні', ('jordan', 'Air Jordan')),
    'm8029': ('Штани карго Nike Чорні', ('nike', 'Nike')),
    'm8030': ('Спортивні штани Nike Swoosh Чорні', ('nike', 'Nike')),
    'm8033': ('Штани карго Jordan Flight Чорні', ('jordan', 'Air Jordan')),
    'm8036': ('Штани карго Nike Sportswear Чорні', ('nike', 'Nike')),
    'm8038': ('Спортивні штани Nike Dri-FIT Чорні', ('nike', 'Nike')),
    'm8049': ('Тепла вовняна сорочка Stone Island в клітинку', ('stoneisland', 'Stone Island')),
    'm8051': ('Штани карго Stone Island Сірі', ('stoneisland', 'Stone Island')),
    'm8054': ('Олімпійка Balenciaga Colorblock Бежева / Чорна', ('balenciaga', 'Balenciaga')),
    'm8055': ('Олімпійка Balenciaga Colorblock Сіра / Чорна', ('balenciaga', 'Balenciaga')),
    'ic8261': ('Худі на блискавці Adidas 3-Stripes Чорне', ('adidas', 'Adidas')),
    'ia8135': ('Худі на блискавці Adidas Originals Чорне', ('adidas', 'Adidas')),
    'v111': ('Вітровка The North Face Black / Grey', ('tnf', 'The North Face')),
    'v82': ('Вітровка Under Armour Black', ('underarmour', 'Under Armour')),
    'v98': ('Вітровка New Balance Black з капюшоном', ('newbalance', 'New Balance')),
    'v101': ('Вітровка Adidas Adventure Black з капюшоном', ('adidas', 'Adidas')),
    'v102': ('Вітровка Adidas Neo Black з капюшоном', ('adidas', 'Adidas')),
    'v88': ('Вітровка The North Face Black', ('tnf', 'The North Face')),
    'hilfiger': ('Вітровка Tommy Hilfiger Демісезонна', ('tommy', 'Tommy Hilfiger')),
}

def determine_brand(name, cat_name, gid=None):
    if gid and str(gid) in EXPLICIT_PRODUCT_OVERRIDES:
        override = EXPLICIT_PRODUCT_OVERRIDES[str(gid)]
        if 'brand' in override:
            return override['brand']
            
    name_clean = name.strip().lower()
    name_clean_no_sale = re.sub(r'\s*\(?(?:sale|розпродаж|уцінка|скидка)\)?', '', name_clean).strip()
    if name_clean in EXPLICIT_NAME_OVERRIDES:
        return EXPLICIT_NAME_OVERRIDES[name_clean][1]
    if name_clean_no_sale in EXPLICIT_NAME_OVERRIDES:
        return EXPLICIT_NAME_OVERRIDES[name_clean_no_sale][1]

    combined = f"{name} {cat_name}".lower()
    for slug, title, pats in KNOWN_BRANDS:
        if any(re.search(p, combined) for p in pats):
            return slug, title
    return 'other', 'Інші бренди'

GENDER_WOMEN_KW = re.compile(r'жіноч|женск|\bwomen\b|\bwoman\b|\bdamen\b|дівчат|для неї', re.I)
GENDER_MEN_KW = re.compile(r'чоловіч|мужск|\bmen\b|\bman\b|хлопц|для нього', re.I)
GENDER_UNISEX_KW = re.compile(r'унісекс|унисекс|unisex', re.I)
WOMEN_BAGS_BRANDS = {'chanel', 'pinko', 'jacquemus', 'chloe', 'miumiu', 'hermes', 'aloyoga'}
WOMEN_BAGS_KW = re.compile(r'жіноч|женск|клатч|лоро піана|loro piana|lady dior|book tote', re.I)
WOMEN_SHOE_MODELS = re.compile(
    r'platform|платформ|clog|slipper|dipper|funkette|tazzlita|disquette|tazz|tasman|mary jane|каблук|балетк|love pink|bailey|bow|coquette|fur slipper|босоніж|ботильйон|туфл|лодочк|шпильк|mule|мюли|мюлі',
    re.I
)

def determine_gender(name, cat_slug, brand_slug, sizes, cname="", desc="", gid=None):
    full_text = f"{name} {cname} {desc}".lower()

    if gid and str(gid) in ('170405', '167814', '167810', '167806', '167815', '167812'):
        return 'women'
    if cname and '1740596413644' in str(cname):
        return 'women'
    if brand_slug == 'aloyoga':
        return 'women'

    if cat_slug in ('accessories', 'bags'):
        if brand_slug in WOMEN_BAGS_BRANDS or WOMEN_BAGS_KW.search(full_text):
            return 'women'
        if any(k in name.lower() for k in ['сумка жіноча', 'сумка', 'клатч', 'tote', 'handbag']) and not any(k in name.lower() for k in ['рюкзак', 'бананка', 'месенджер', 'баул']):
            return 'women'
        return 'unisex'

    if cat_slug == 'underwear':
        is_w = bool(GENDER_WOMEN_KW.search(full_text)) or bool(re.search(r'бюст|топ\b|бра\b|стринги|стрінги|трусики|піжам|попожам|пеньюар|кігурумі|нічна сорочк', full_text, re.I))
        is_m = bool(GENDER_MEN_KW.search(full_text)) or bool(re.search(r'боксер|boxer', full_text, re.I))
        if is_w and not is_m:
            return 'women'
        if is_m and not is_w:
            return 'men'
        if is_w:
            return 'women'
        return 'men'

    if cat_slug == 'socks':
        if GENDER_WOMEN_KW.search(full_text):
            return 'women'
        if GENDER_MEN_KW.search(full_text):
            return 'men'
        return 'unisex'

    if cat_slug == 'shoes':
        if brand_slug in WOMEN_BAGS_BRANDS or WOMEN_SHOE_MODELS.search(name):
            return 'women'
        if brand_slug == 'ugg':
            is_men = bool(re.search(r'\b(neumel|lowmel|highmel)\b', name, re.I)) and not bool(re.search(r'platform|chelsea|pink|fur|mini|tazz|tasman', name, re.I))
            if is_men:
                num_sizes = []
                for s in sizes:
                    m = re.match(r'^(\d+(?:[.,]\d+)?)$', str(s).strip())
                    if m:
                        num_sizes.append(float(m.group(1).replace(',', '.')))
                if num_sizes and min(num_sizes) >= 41:
                    return 'men'
                elif num_sizes and max(num_sizes) >= 42:
                    return 'unisex'
            return 'women'

        num_sizes = []
        for s in sizes:
            m = re.match(r'^(\d+(?:[.,]\d+)?)$', str(s).strip())
            if m:
                num_sizes.append(float(m.group(1).replace(',', '.')))
        if num_sizes:
            min_s = min(num_sizes)
            max_s = max(num_sizes)
            if max_s <= 41:
                return 'women'
            elif min_s >= 41:
                return 'men'
            else:
                return 'unisex'

    if cat_slug == 'clothing':
        is_w = (
            bool(GENDER_WOMEN_KW.search(full_text)) or
            bool(re.search(r'жіноч|женск|плаття|сукня|спідниця|юбк|юбка|топ\b|боді|боди|легінси|лосіни|попожам|піжам|пеньюар|кігурумі|велосипедки|корсет|alo\s*yoga|\balo\b|miu\s*miu|political\s*campaign|logo\s*embroidery', full_text, re.I)) or
            brand_slug in ('miumiu', 'chanel', 'chloe', 'pinko', 'jacquemus', 'aloyoga')
        )
        if is_w:
            return 'women'
        return 'men'

    if GENDER_UNISEX_KW.search(full_text):
        return 'unisex'
    is_w = bool(GENDER_WOMEN_KW.search(full_text))
    is_m = bool(GENDER_MEN_KW.search(full_text))
    if is_w and not is_m:
        return 'women'
    if is_m and not is_w:
        return 'men'

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

def clean_product_title(name, cat_slug, brand_slug, brand_title, cat_name, desc="", params_str="", gid=None):
    if gid and str(gid) in EXPLICIT_PRODUCT_OVERRIDES:
        return EXPLICIT_PRODUCT_OVERRIDES[str(gid)]['name']
        
    name_clean = name.strip().lower()
    name_clean_no_sale = re.sub(r'\s*\(?(?:sale|розпродаж|уцінка|скидка|распродажа)\)?', '', name_clean).strip()
    if name_clean in EXPLICIT_NAME_OVERRIDES:
        return EXPLICIT_NAME_OVERRIDES[name_clean][0]
    if name_clean_no_sale in EXPLICIT_NAME_OVERRIDES:
        return EXPLICIT_NAME_OVERRIDES[name_clean_no_sale][0]

    t = name.strip()
    
    # 1. Junk rejection: omit completely from site
    if t in ['-', '.', 'Test', 'test', 'Не бренд', 'не бренд']:
        return None
    if re.match(r'^(?:LOT:\s*\d+|Cod:\s*\d+)', t, re.I):
        return None
    if any(w in t.lower() or w in desc.lower() for w in ['(з дефектом)', 'дефект', 'брак', 'розпаровка', 'уцінка брак']):
        return None

    # Strip URLs
    t = re.sub(r'https?://[^\s]+', '', t).strip()

    # Strip "No brand"
    t = re.sub(r'\s*\bNo\s*brand\b', '', t, flags=re.I).strip()
        
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
    t = re.sub(r'^КОМПЛЕКТ\s+Calvin\s+Klein\b', 'Жіночий комплект білизни Calvin Klein', t, flags=re.I)
    t = re.sub(r'^Термо\s*костюм\s+Columbia\s+Women\b', 'Жіноча термобілизна Columbia', t, flags=re.I)
    t = re.sub(r'^Термо\s*костюм\s+Columbia\s+Black\s+Men\b', 'Чоловіча термобілизна Columbia Black', t, flags=re.I)
    t = re.sub(r'^(?:Піжама\s+комбінезон(?:\s*\(попожама\))?|Попожама)\b', 'Жіноча піжама-комбінезон', t, flags=re.I)
    t = re.sub(r'^(?:ЮБКА|Юбка)\s*', 'Спідниця ', t, flags=re.I)
    t = re.sub(r'\bюбка\b', 'спідниця', t, flags=re.I)
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
            
    # Clean any 'оригінал / офіційно' references
    t = re.sub(r'\[?\(?\s*оригінальна\s+магнітна\s+брендована\s+коробка\s*\]?\)?', '[фірмова магнітна коробка]', t, flags=re.I)
    t = re.sub(r'\[?\(?\s*оригінальна\s+брендована\s+коробка\s*\]?\)?', '[фірмова брендована коробка]', t, flags=re.I)
    t = re.sub(r'\[?\(?\s*оригінальна\s+магнітна\s+коробка\s*\]?\)?', '[фірмова магнітна коробка]', t, flags=re.I)
    t = re.sub(r'\[?\(?\s*оригінальна\s+коробка\s*\]?\)?', '[фірмова коробка]', t, flags=re.I)
    t = re.sub(r'\b(?:оригінал|оригінальний|оригінальна|оригінальне|оригінальні|оригінального|оригінальних)\b', 'фірмовий', t, flags=re.I)
    t = re.sub(r'\b(?:оригинал|оригинальный|оригинальная|оригинальное|оригинальные|оригинального|оригинальных)\b', 'фирменный', t, flags=re.I)
    t = re.sub(r'\b(?:офіційний|офіційна|офіційне|офіційні|офіційно|офіційного)\b', '', t, flags=re.I)
    t = re.sub(r'\b(?:официальный|официальная|официальное|официальные|официально|официального)\b', '', t, flags=re.I)
    t = re.sub(r'\s{2,}', ' ', t).strip()

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

    if brand_slug == 'aloyoga' and cat_slug == 'shoes':
        t = re.sub(r'^Alo\s+Yoga\s+', 'Кросівки Alo Yoga ', t, flags=re.I)
        t = re.sub(r'^Alo\s+Shoes\s+', 'Кросівки Alo Yoga ', t, flags=re.I)
        t = re.sub(r'^Alo\s+Recovery\s+', 'Кросівки Alo Yoga Recovery ', t, flags=re.I)
        if not t.lower().startswith(('кросівки', 'кеди', 'черевики')):
            t = f'Кросівки {t}'

    if re.search(r'шорти|шорты', cat_name.lower()) and not re.search(r'шорт', t.lower()):
        t = f'Шорти {t}'
            
    # 8. Handle code-only names (V82, WJ153, SS28, F34, H042, SL60, NTR495, NB299, VN02)
    t = re.sub(r'^КАРГО\s+(2Y|\d+)', r'Штани карго \1', t, flags=re.I)
    if re.match(r'^V\d{2,3}$', t, re.I):
        t = f'Вітровка з капюшоном демісезонна {t.upper()}'
    elif re.match(r'^WJ\d{2,4}$', t, re.I):
        t = f'Куртка зимова {t.upper()}'
    elif re.match(r'^SS\d{2,4}$', t, re.I):
        t = f'Спортивний костюм {t.upper()}'
    elif re.match(r'^F\d{2,4}$', t, re.I):
        t = f'Худі оверсайз {t.upper()}'
    elif re.match(r'^H\d{3,4}$', t, re.I):
        t = f'Сланці {t.upper()}'
    elif re.match(r'^SL\d{2,4}$', t, re.I):
        t = f'Зимові черевики {t.upper()}'
    elif re.match(r'^J\d{1,4}$', t, re.I):
        t = f'Куртка демісезонна {t.upper()}'
    elif re.match(r'^SJ\d{1,4}$', t, re.I):
        t = f'Куртка демісезонна {t.upper()}'
    elif re.match(r'^SP(?:б/н)?\d{1,4}$', t, re.I):
        t = f'Спортивні штани {t.upper()}'
    elif re.match(r'^SH\d{1,4}$', t, re.I):
        t = f'Шорти {t.upper()}'
    elif re.match(r'^TS\d{1,4}$', t, re.I):
        t = f'Футболка {t.upper()}'
    elif re.match(r'^JS\d{1,4}$', t, re.I):
        t = f'Спортивний костюм {t.upper()}'
    elif re.match(r'^M\d{4,5}$', t, re.I):
        if cat_slug == 'clothing':
            t = f'Спортивний одяг {t.upper()}'
        else:
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
    elif re.match(r'^(?:[A-Z]{2}\d{4}|\d{6,8})-\d{3}$', t):
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
        if not t.lower().startswith(('комплект', 'чоловіч', 'жіноч', 'трус', 'термо')):
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

    # 13. Bags naming cleanup: prepend "Сумка" / "Рюкзак" / "Гаманець" if it's an accessory without product type
    if cat_slug in ('accessories', 'bags'):
        t_lower = t.lower()
        has_type = any(t_lower.startswith(p) for p in ['сумка', 'рюкзак', 'бананка', 'гаманець', 'ремінь', 'окуляри', 'браслет', 'годинник', 'клатч', 'шопер', 'коробка', 'шапка', 'кепка', 'панама', 'головний убір', 'чохол'])
        if not has_type:
            if 'kanken' in t_lower or 'rainbow' in t_lower:
                t = f'Рюкзак Fjallraven Kanken {t}' if 'kanken' not in t_lower else f'Рюкзак {t}'
            elif any(k in t_lower for k in ['гаманець', 'кошелек', 'wallet', 'card case', 'card holder', 'purse']):
                t = f'Гаманець {t}'
            elif any(k in cat_name.lower() for k in ['бананк']):
                t = f'Бананка {t}'
            elif any(k in cat_name.lower() for k in ['рюкзак', 'backpack']):
                t = f'Рюкзак {t}'
            else:
                t = f'Сумка {t}'

    # 13b. Clothing naming cleanup: enrich bare codes and missing product types
    if cat_slug == 'clothing':
        t_lower = t.lower()
        cname_lower = cat_name.lower()
        if re.match(r'^P\d{3}$', t):
            t = f'Спортивні штани {t}'
        elif re.match(r'^S\d{3}$', t):
            t = f'Світшот {t}'
        elif re.match(r'^T\d{3}$', t):
            t = f'Флісовий світшот {t}'
        elif re.match(r'^(?:PT|PS)\d{3}$', t):
            t = f'Спортивний костюм {t}'
        elif re.match(r'^SC\d{2}$', t):
            t = f'Літній комплект {t}'
        elif re.match(r'^б\/нкз\d+$', t, re.I):
            t = 'Зимовий спортивний костюм'
        elif re.match(r'^б\/нко\d+$', t, re.I):
            t = 'Олімпійка спортивна'
        elif re.match(r'^б\/нк\d+$', t, re.I):
            t = 'Спортивний костюм'
        elif re.match(r'^Б\/Н\d+$', t, re.I):
            t = 'Зимова тепла куртка'
        elif re.match(r'^SPб\/н\d+$', t, re.I):
            t = 'Спортивні штани'
        elif t_lower.startswith('nike storm fit'):
            t = f'Пуховик {t}'
        elif t_lower.startswith('the north face 700') or t_lower == 'the north face purple':
            t = f'Пуховик {t}'
        elif t_lower.startswith("arc'teryx") and 'куртка' not in t_lower:
            t = f'Куртка {t}'
        elif t_lower.startswith('stone island david'):
            t = f'Куртка {t}'
        elif any(k in t_lower for k in ['adidas x gucci', 'the north face x gucci', 'palm angels']) and not any(k in t_lower for k in ['футболка', 'костюм', 'худі']):
            t = f'Футболка {t}'
        elif any(k in cname_lower for k in ['штани', 'штаны', 'джогер', 'карго']) and not any(k in t_lower for k in ['штани', 'джинси', 'джогер', 'карго']):
            t = f'Спортивні штани {t}'
        elif any(k in cname_lower for k in ['куртк', 'пуховик']) and not any(k in t_lower for k in ['куртка', 'пуховик', 'парка', 'бомбер', 'вітровка', 'анорак']):
            t = f'Куртка {t}'
        elif any(k in cname_lower for k in ['світшот', 'толстовк']) and not any(k in t_lower for k in ['світшот', 'толстовка', 'худі', 'кофта']):
            t = f'Світшот {t}'
        elif any(k in cname_lower for k in ['костюм']) and not any(k in t_lower for k in ['костюм', 'комплект']):
            t = f'Спортивний костюм {t}'

    # 14. Prepend brand if known and missing from title
    if brand_slug != 'other' and brand_title.lower() not in t.lower() and brand_slug not in t.lower():
        if brand_slug == 'jordan' and 'jordan' in t.lower():
            pass
        elif brand_slug == 'adidas' and 'yeezy' in t.lower():
            pass
        elif brand_slug == 'drmartens' and 'martens' in t.lower():
            pass
        elif any(t.lower().startswith(p) for p in ['сумка', 'рюкзак', 'бананка', 'спортивний костюм', 'спортивні штани', 'світшот', 'літній комплект', 'пуховик', 'куртка', 'зимове взуття', 'кросівки', 'худі', 'кепка', 'шапка', 'чоловіча білизна', 'жіноча білизна', 'окуляри', 'ремінь']):
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
    t = re.sub(r'\bSalomon\s+Solomon\b', 'Salomon', t, flags=re.I)
    t = re.sub(r'\bSolomon\b', 'Salomon', t, flags=re.I)

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
        origin = clean_origin(clean_text(prod_m.group(1))) if prod_m else ''
        
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
                if not s:
                    continue
                
                # Rule: Filter out defect / flawed / damaged sizes ("нюанс", "дефект", "брак", "плямка", "уцінка")
                if DEFECT_SIZE_KEYWORDS.search(s):
                    continue
                    
                # Clean up asterisk or punctuation (e.g. "36*" -> "36", "38*" -> "38")
                s = s.rstrip('*').strip()
                
                # Clean up sock/accessory pack counts in size (e.g. "3. (41-45)" -> "41-45", "10.(41-45)" -> "41-45")
                s = re.sub(r'^\d+\.\s*\(([^)]+)\)$', r'\1', s).strip()
                
                # Replace comma with dot in decimal sizes (e.g. "42,5" -> "42.5")
                if re.match(r'^\d+,\d+$', s):
                    s = s.replace(',', '.')
                if s.lower() in ('over size', 'oversize'):
                    s = 'one size'

                # Clean up "-" to "one size" for single-size items
                if s in ('-', 'null', 'none', 'undefined'):
                    s = 'one size'
                
                s = re.sub(r'(\d+)\s*[-–]\s*(\d+)', r'\1–\2', s.strip())
                
                if s and s not in sizes:
                    sizes.append(s)
        if not sizes:
            continue


        sorted_sizes = sort_sizes(sizes)
        params_str = ' '.join(clean_text(p.text) for it in items for p in it.findall('param') if p.text)
        
        brand_slug, brand_title = determine_brand(name, cname, gid=gid)
        cat_slug, cat_title, cat_icon = determine_category(name, cname, desc, params_str, sorted_sizes, mat, brand_slug)

        clean_name = clean_product_title(name, cat_slug, brand_slug, brand_title, cname, desc, params_str, gid=gid)
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
        
        gender = determine_gender(clean_name, cat_slug, brand_slug, sorted_sizes, cname, desc, gid=gid)
        season_slug, season_title, season_icon = determine_season(clean_name, cat_slug, mat, desc, cname=cname)

        category_counts[cat_slug] += 1
        season_counts[season_slug] += 1
        brand_counts[brand_slug] += 1
        
        # Selling price with +25% markup (strictly not less than 500 UAH), rounded to 10 грн
        markup = max(raw_price * 0.25, 500)
        price = round((raw_price + markup) / 10) * 10
        if price - raw_price < 500:
            price = math.ceil((raw_price + 500) / 10) * 10

        # Old price for visual discount (15-20% above selling price, rounded to 10 грн)
        old_price = round((price * 1.18) / 10) * 10
        
        # Badge
        is_gtx = bool(re.search(r'gore[-\s]?tex|gtx|cordura|waterproof|forces|quest\s*4d', clean_name, re.I))
        badge = "Топ якість"
        if re.search(r'піжам|попожам|пеньюар', clean_name, re.I):
            badge = "Домашній затишок"
        elif season_slug == 'winter':
            badge = "Зима • Термо"
        elif is_gtx:
            badge = "Вологозахист Gore-Tex"
        elif season_slug == 'summer':
            badge = "Літо • Легкість"
        elif 'sale' in cname.lower() or 'уцінка' in cname.lower():
            badge = "Знижка"
        elif brand_slug in ['nike', 'jordan', 'newbalance', 'adidas']:
            badge = "Хіт продажів"
            
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

    def get_apparel_type(p):
        name = (p.get('name') or '').lower()
        cat = p.get('cat') or ''
        mat = (p.get('mat') or '').lower()
        desc = (p.get('desc') or '').lower()
        full = f'{name} {mat} {desc}'

        is_clothing = (cat == 'clothing') or bool(re.search(r'одяг', p.get('cat_name', ''), re.I))

        # 1. Жилетки / Безрукавки (vests)
        if is_clothing and bool(re.search(r'\b(?:жилет|безрукав)[а-яіїєґ\']*|\bvest\b', name)):
            return 'vest'

        # 2. Курточки / Пуховики / Парки (jackets)
        if is_clothing and bool(re.search(r'куртк|пуховик|парка|пальто|дублянк|анорак', name)) and not bool(re.search(r'вітровк|ветровк', name)):
            return 'jacket'

        # 3. Кофти / Худі / Світшоти / Толстовки / Фліски / Светри (hoodies/sweaters)
        if is_clothing and bool(re.search(r'кофт|худі|худи|світшот|свитшот|толстовк|фліс|флис|fleece|светр|джемпер|кардиган|лонгас|кенгуру', name)):
            return 'hoodie'

        # 4. Зимові костюми & теплий зимовий одяг
        if is_clothing and (
            p.get('season') == 'winter' or
            bool(re.search(r'костюм', name)) and bool(re.search(r'зим|winter|фліс|флис|fleece|термо|thermo|утепл|начес|байка|теплий|теплый', full)) or
            bool(re.search(r'зим|winter|термо|thermo|утепл|холофайбер|холлофайбер|пух|синтепон|силікон|силикон|овчин|байка|начес', full))
        ):
            return 'suit'

        # 5. Зимове взуття (UGG, термо, хутро, сноубути)
        if cat == 'shoes' and (p.get('season') == 'winter' or bool(re.search(r'зим|winter|термо|thermo|хутр|мех|сноубут|дутик|мунбут|угг|\bugg\b', full))):
            return 'winter_shoe'

        if cat == 'shoes':
            return 'shoe'

        return 'other'

    jackets = sorted([p for p in products if get_apparel_type(p) == 'jacket'], key=lambda p: -int(p.get('id') or 0))
    vests = sorted([p for p in products if get_apparel_type(p) == 'vest'], key=lambda p: -int(p.get('id') or 0))
    hoodies = sorted([p for p in products if get_apparel_type(p) == 'hoodie'], key=lambda p: -int(p.get('id') or 0))
    suits = sorted([p for p in products if get_apparel_type(p) == 'suit'], key=lambda p: -int(p.get('id') or 0))
    winter_shoes = sorted([p for p in products if get_apparel_type(p) == 'winter_shoe'], key=lambda p: -int(p.get('id') or 0))
    shoes = sorted([p for p in products if get_apparel_type(p) == 'shoe'], key=lambda p: -int(p.get('id') or 0))
    others = sorted([p for p in products if get_apparel_type(p) == 'other'], key=lambda p: -int(p.get('id') or 0))

    showcase = []
    idx_j, idx_v, idx_h, idx_s, idx_ws = 0, 0, 0, 0, 0

    while idx_v < len(vests):
        for _ in range(2):
            if idx_j < len(jackets): showcase.append(jackets[idx_j]); idx_j += 1
        if idx_v < len(vests):
            showcase.append(vests[idx_v]); idx_v += 1
        for _ in range(2):
            if idx_h < len(hoodies): showcase.append(hoodies[idx_h]); idx_h += 1
        if idx_s < len(suits):
            showcase.append(suits[idx_s]); idx_s += 1
        if idx_ws < len(winter_shoes):
            showcase.append(winter_shoes[idx_ws]); idx_ws += 1

    while idx_j < len(jackets) or idx_h < len(hoodies) or idx_s < len(suits):
        for _ in range(2):
            if idx_j < len(jackets): showcase.append(jackets[idx_j]); idx_j += 1
        for _ in range(2):
            if idx_h < len(hoodies): showcase.append(hoodies[idx_h]); idx_h += 1
        if idx_s < len(suits): showcase.append(suits[idx_s]); idx_s += 1
        if idx_ws < len(winter_shoes): showcase.append(winter_shoes[idx_ws]); idx_ws += 1

    while idx_ws < len(winter_shoes):
        showcase.append(winter_shoes[idx_ws]); idx_ws += 1

    showcase.extend(shoes)
    showcase.extend(others)
    products = showcase

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
            {'slug': 'all', 'name': 'Всі товари', 'icon': '', 'count': len(products)},
            {'slug': 'men', 'name': 'Чоловічі', 'icon': '', 'count': men_count},
            {'slug': 'women', 'name': 'Жіночі', 'icon': '', 'count': women_count}
        ],
        'categories': [
            {'slug': 'all', 'name': 'Всі товари', 'icon': '', 'count': len(products)},
            {'slug': 'shoes', 'name': 'Взуття', 'icon': '', 'count': category_counts['shoes']},
            {'slug': 'clothing', 'name': 'Одяг', 'icon': '', 'count': category_counts['clothing']},
            {'slug': 'socks', 'name': 'Шкарпетки', 'icon': '', 'count': category_counts['socks']},
            {'slug': 'underwear', 'name': 'Труси & Білизна', 'icon': '', 'count': category_counts['underwear']},
            {'slug': 'accessories', 'name': 'Аксесуари & Сумки', 'icon': '', 'count': category_counts['accessories']},
        ],
        'seasons': [
            {'slug': 'all', 'name': 'Всі сезони', 'icon': '', 'count': len(products)},
            {'slug': 'demi', 'name': 'Демісезон', 'icon': '', 'count': season_counts['demi']},
            {'slug': 'winter', 'name': 'Зима', 'icon': '', 'count': season_counts['winter']},
            {'slug': 'summer', 'name': 'Літо', 'icon': '', 'count': season_counts['summer']},
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
