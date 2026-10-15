"""產生 App 圖示（APK／手機桌面／瀏覽器分頁）。
來源：sources/app-icon-travel-bear.png（使用者指定的「旅遊熊熊.png」，Drive ID 1p5XsE-HThStXMV-Ti8H47Pl-SdwAMPAt，1254×1254 滿版藍底）。
只做等比例縮放；遮罩圖示另外在同色藍底上縮小置中，避免手機裁成圓形時切到帽子與耳朵。不改繪圖案。
遊戲內的熊寶角色仍是 dist/assets/bearbao.png，與此圖示無關、不受影響。
用法：python tools/build-app-icons.py   （需 Pillow）
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageStat

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'sources/app-icon-travel-bear.png'
OUT = ROOT / 'dist/icons'

def full(size, name):
    Image.open(SRC).convert('RGB').resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)

def maskable(size, name, fill=.80):
    src = Image.open(SRC).convert('RGB')
    # 底：取原圖四邊外框的平均藍色；圖案本身等比例縮小置中，邊緣柔和接到底色
    w, h = src.size; b = max(2, w // 60)
    means = [ImageStat.Stat(src.crop(box)).mean for box in ((0, 0, w, b), (0, h - b, w, h), (0, 0, b, h), (w - b, 0, w, h))]
    bg = tuple(round(sum(m[i] for m in means) / len(means)) for i in range(3))
    canvas = Image.new('RGB', (size, size), bg)
    inner = src.resize((round(size * fill),) * 2, Image.LANCZOS)
    edge = round(inner.width * .06)
    mask = Image.new('L', inner.size, 0)
    ImageDraw.Draw(mask).rectangle((edge, edge, inner.width - edge, inner.height - edge), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(edge / 2))
    canvas.paste(inner, ((size - inner.width) // 2, (size - inner.height) // 2), mask)
    canvas.save(OUT / name, optimize=True)

OUT.mkdir(parents=True, exist_ok=True)
full(192, 'icon-192.png')
full(512, 'icon-512.png')
maskable(512, 'icon-maskable-512.png')
full(180, 'apple-touch-icon.png')
full(32, 'favicon-32.png')
print('icons written to', OUT)
