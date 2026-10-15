"""產生 App 圖示：以原始熊寶 PNG 等比例縮放後置中貼到海色底，不改繪熊寶本身。
用法：python tools/build-app-icons.py   （需 Pillow）
輸出：dist/icons/ 內 icon-192、icon-512、icon-maskable-512、apple-touch-icon、favicon-32
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'dist/assets/bearbao.png'
OUT = ROOT / 'dist/icons'
BG = (172, 210, 210, 255)  # 與遊戲海面底色 #acd2d2 相同

def make(size, fill, name):
    bear = Image.open(SRC).convert('RGBA')
    bear = bear.crop(bear.getbbox())
    scale = size * fill / max(bear.size)
    bear = bear.resize((max(1, round(bear.width * scale)), max(1, round(bear.height * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (size, size), BG)
    canvas.alpha_composite(bear, ((size - bear.width) // 2, (size - bear.height) // 2))
    canvas.convert('RGB').save(OUT / name, optimize=True)

OUT.mkdir(parents=True, exist_ok=True)
make(192, .86, 'icon-192.png')
make(512, .86, 'icon-512.png')
make(512, .62, 'icon-maskable-512.png')   # 遮罩圖示：熊寶落在中央安全區內
make(180, .84, 'apple-touch-icon.png')
make(32, .94, 'favicon-32.png')
print('icons written to', OUT)
