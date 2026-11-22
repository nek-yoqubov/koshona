# Категории декоров для фильтра: дерево / камень / однотон / другое.
# Egger — по букве кода (H дерево, U/W однотон, F фантазийные: камень или другое).
# Остальные — по словам в начале слов названия; без слов — однотон, если карточка ровная.
# Ручные правки — raw/decor-cat-overrides.json (они главнее всего).
import json, re
from PIL import Image, ImageStat
d = json.load(open('public/catalog/decors.json'))
B = r'(?<![а-яёa-z])'
WOOD = B + r'(дуб|орех|ясен|сосн|бук\b|вишн|акаци|бер[её]з|каштан|гикори|эвкалипт|древесин|ноче|oak|wood|walnut|pine|тик\b|зебрано|вяз|кл[её]н|ольх|венге|бамбук|лиственниц|паркет|cherry|teak|elm|maple|larch|olmo|rovere|noce|legno|дерев|wenge|палисандр|махагон|сандал|ироко|карагач|тис\b|таксус|кокобол|крослайн|финлайн|файнлайн|артвуд|блэквуд|блеквуд|тессеа)'
STONE = B + r'(мрамор|бетон|камен|камн|гранит|сланец|оникс|травертин|кварц|терраццо|marble|stone|concrete|granite|slate|onyx|quartz|terrazzo|цемент|cement|базальт|галактик|семолин|штейн|лава|калакатт|статуар|pietra|пьетро|скиваро|кандела|левано|кристалл|аурум|джейд|бронз|каррар|бернини|кумана|гагат|опал|паладин|терезин|марквин|лабрадор|агат|яшм|stromboly|андромед|ароза|известняк|пирит|шунгит|содалит|брекчи|обсидиан|бриллиант|сахара|тунис)'
OTHER = B + r'(металл|metal|текстил|л[её]н\b|линен|textile|linen|хромикс|кобра|алюмин|сталь|steel|inox|кожа|leather|ткан|fabric|сплав|акапулько|волна|tokyo|linea)'
over = json.load(open('raw/decor-cat-overrides.json'))
out, check = {}, []
for x in d:
    n, code = x['name'].lower(), x['code']
    if x['supplier'] == 'EGGER':
        c = 'wood' if code.startswith('H') else 'plain' if code[0] in 'UW' or code.startswith('AU') else ('stone' if re.search(STONE, n) else 'other')
    elif re.search(OTHER, n): c = 'other'
    elif re.search(WOOD, n): c = 'wood'
    elif re.search(STONE, n): c = 'stone'
    else:
        sd = ImageStat.Stat(Image.open('public/' + x['card']).convert('L').resize((128, 128))).stddev[0]
        c = 'plain' if sd < 9 else 'check'
        if c == 'check': check.append((code, x['name'], round(sd, 1)))
    out[code] = over.get(code, c)
import collections
print(collections.Counter(out.values()))
for u in check:
    if out[u[0]] == 'check': print('проверить вручную:', u)
json.dump(out, open('public/catalog/cats.json', 'w'), ensure_ascii=False, separators=(',', ':'))
