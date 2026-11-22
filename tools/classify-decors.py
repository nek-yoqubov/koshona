# Категории декоров для фильтра: дерево / камень / однотон / другое.
# По словам в названии, однотонность — по разбросу яркости карточки; ручные правки в raw/decor-cat-overrides.json
import json, re
from PIL import Image, ImageStat
d=json.load(open('public/catalog/decors.json'))
WOOD=r'дуб|орех|ясен|сосн|бук|вишн|акаци|берёз|берез|каштан|гикори|эвкалипт|древесин|ноче|oak|wood|walnut|pine|ash|тик|зебрано|вяз|клён|клен|ольх|венге|бамбук|лиственниц|кедр|канйон|каньон|паркет|файнлайн|cherry|teak|elm|maple|larch|olmo|rovere|noce|legno|дерев|wenge|тонсберг|галифакс|шерман|палисандр|махагон|сандал|ирок|ироко|карагач'
STONE=r'мрамор|бетон|камен|камн|гранит|сланец|оникс|травертин|кварц|терраццо|marble|stone|concrete|granite|slate|onyx|travertin|quartz|terrazzo|цемент|cement|базальт|галактика|семолина|штейн|лава|кальк|calacatta|калакатта|статуар|statuario|nero|pietra|пьетро|скиваро|кандела|левано|кристалл|аурум|джейд|бронз|каррар|бернини|кумана|гагат|опал|паладин|терезин|марквин|лабрадор|агат|яшм|порфир|stromboly|стромбол|canyon|keramik|керамик|плитк|rock|рок'
OTHER=r'металл|metal|текстил|лен |лён|textile|linen|хромикс|кобра|cobra|файн|алюмин|сталь|steel|кожа|leather|ткан|fabric'
out={}; un=[]
for x in d:
    n=x['name'].lower()
    if re.search(OTHER,n) and not re.search(WOOD,n): c='other'
    elif re.search(WOOD,n): c='wood'
    elif re.search(STONE,n): c='stone'
    else:
        im=Image.open('public/'+x['card']).convert('L').resize((128,128)); sd=ImageStat.Stat(im).stddev[0]
        c='plain' if sd<9 else 'pattern?'; 
        if c!='plain': un.append((x['code'],x['name'],round(sd,1)))
    out[x['code']]=c
out.update(json.load(open('raw/decor-cat-overrides.json')))
import collections; print(collections.Counter(out.values()))
for u in un:
    if u[0] not in out or out[u[0]]=='pattern?': print('проверить вручную:', u)
json.dump(out,open('public/catalog/cats.json','w'),ensure_ascii=False,separators=(',',':'))
