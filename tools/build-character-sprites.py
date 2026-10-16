"""把使用者提供的透明背景角色圖轉成網頁用 WebP（只等比例縮小，不裁切、不改繪、不鏡像）。
來源（雲端硬碟「遊戲測試」資料夾）：
  sources/characters/bear-boat-original.png ← 熊熊搭觀光遊艇_透明背景.png（Drive ID 1ZcCgq0plukScgjsEjyxlpSOEdryuh9CL）：搭船時
  sources/characters/bear-ride-original.png ← 熊熊騎機車_透明背景.png（Drive ID 1MIU_UAVYMLhwqAVJVGx6f5x7jlZKUZ6m）：沿路移動時
停下來（含剛上岸）仍顯示原始 dist/assets/bearbao.png。
用法：python tools/build-character-sprites.py   （需 Pillow）
"""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
for src, out in [('bear-boat-original.png', 'bear-boat.webp'), ('bear-ride-original.png', 'bear-ride.webp')]:
    im = Image.open(ROOT / 'sources/characters' / src).convert('RGBA')
    im.thumbnail((512, 512), Image.LANCZOS)
    im.save(ROOT / 'dist/assets' / out, 'WEBP', quality=90, method=6)
    print(out, im.size, (ROOT / 'dist/assets' / out).stat().st_size)
