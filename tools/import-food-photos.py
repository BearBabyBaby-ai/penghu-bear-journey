"""Import the user-approved cell snapshot; never invent a photo or coordinate."""
import json
import re
import sys
from pathlib import Path

snapshot = json.loads(Path(sys.argv[1]).read_text())
path = Path('dist/data.json')
data = json.loads(path.read_text())
data['records'] = [r for r in data['records'] if r['kind'] != 'food']
for row, values in enumerate(snapshot['food']['values'][1:], 2):
    v = (values + [''] * 14)[:14]
    if not v[3]:
        continue
    number = lambda value: float(value) if value is not None and str(value).strip() else None
    data['records'].append(dict(
        id=f'food-{row}', kind='food', sheet='美食清單', row=row,
        area=v[0] or '', village='', mainCategory=v[1] or '', category=v[2] or '',
        name=v[3], description=v[4] or '', special=v[5] or '', phone=v[6] or '',
        address=v[7] or '', hours=v[8] or '', url=v[13] or v[9] or '',
        lat=number(v[10]), lng=number(v[11]), legend='',
    ))
by_source = {(r['sheet'], r['row']): r for r in data['records']}
image_rows = list(snapshot['images'])
image_rows += [dict(sheet='美食清單', row=i+2, raw=v[12])
               for i, v in enumerate(snapshot['food']['values'][1:]) if len(v)>12 and v[12]]
for r in data['records']:
    r['images'] = []
    r.pop('imageLinks', None)
for cell in image_rows:
    record = by_source.get((cell['sheet'], cell['row']))
    if not record:
        raise ValueError(f"Photo row has no matching record: {cell['sheet']} {cell['row']}")
    text = re.sub(r'^/?drive\.google\.com/', 'https://drive.google.com/', cell['raw'])
    for url in re.findall(r'https?://[^\s<>\"]+', text):
        match = re.search(r'/file/d/([A-Za-z0-9_-]+)', url)
        if match:
            record['images'].append(dict(sourceURL=url, driveFileId=match[1]))
        else:
            record.setdefault('imageLinks', []).append(url)
data['meta']['sheets'] = ['美食清單','景點','廟宇','奎壁山摩西分海','澎湖縣-未來30天潮汐預報']
data['meta']['excludedSheets'] = []
data['meta']['foodReadAt'] = '2026-10-15'
data['meta']['photoReadAt'] = '2026-10-15'
path.write_text(json.dumps(data, ensure_ascii=False, separators=(',',':'))+'\n')
print(json.dumps(dict(records=len(data['records']), food=sum(r['kind']=='food' for r in data['records']), photos=sum(len(r['images']) for r in data['records'])),ensure_ascii=False))
