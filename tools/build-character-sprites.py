"""把使用者提供的透明背景角色圖轉成網頁用 WebP（只等比例縮小或重新壓縮，不裁切、不改繪、不鏡像）。
來源（雲端硬碟「遊戲測試」資料夾）：
  sources/characters/bear-boat-original.png ← 熊熊搭觀光遊艇_透明背景.png（Drive ID 1ZcCgq0plukScgjsEjyxlpSOEdryuh9CL）：靜態搭船圖（備用）
  sources/characters/bear-ride-original.png ← 熊熊騎機車_透明背景.png（Drive ID 1MIU_UAVYMLhwqAVJVGx6f5x7jlZKUZ6m）：靜態騎車圖（備用）
  sources/characters/bear-ride-anim-original.webp ← 熊熊騎機車_完整圓弧輪胎旋轉_透明動畫.webp（Drive ID 1hZ9r8DFP04fi_a9x-OeMj_VoDty1OCZc）：沿路移動時（60 格、每格 40ms）
  sources/characters/bear-boat-anim-original.webp ← 熊熊搭觀光遊艇_船體航行與破浪_透明動畫.webp（Drive ID 1jVxfyt0mpkLsAkGUGfyxjgRCY7XaDoNH）：搭船時（120 格、每格 40ms）
停下來（含剛上岸）仍顯示原始 dist/assets/bearbao.png。
動畫保留原本每格時間與無限循環：騎車動畫原檔直接使用；搭船原檔 5.9MB 太大，等比例縮成 384px 重新壓縮。
用法：python tools/build-character-sprites.py   （需 Pillow）
"""
import struct
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'sources/characters', ROOT / 'dist/assets'

def durations(path):
    """讀 WebP ANMF 區塊的每格時間（Pillow 讀不到時用）"""
    b = path.read_bytes(); i = 12; out = []
    while i < len(b):
        tag, n = b[i:i + 4], struct.unpack('<I', b[i + 4:i + 8])[0]
        if tag == b'ANMF': out.append(int.from_bytes(b[i + 8 + 12:i + 8 + 15], 'little'))
        i += 8 + n + (n & 1)
    return out

for src, out in [('bear-boat-original.png', 'bear-boat.webp'), ('bear-ride-original.png', 'bear-ride.webp')]:
    im = Image.open(SRC / src).convert('RGBA')
    im.thumbnail((512, 512), Image.LANCZOS)
    im.save(OUT / out, 'WEBP', quality=90, method=6)
    print(out, im.size, (OUT / out).stat().st_size)

# 騎車動畫原檔已是 512px、594KB：直接複製，位元組不變
(OUT / 'bear-ride-anim.webp').write_bytes((SRC / 'bear-ride-anim-original.webp').read_bytes())
print('bear-ride-anim.webp', 'copied', (OUT / 'bear-ride-anim.webp').stat().st_size)
# 搭船動畫原檔 5.9MB：等比例縮成 384px、重新壓縮（每格 40ms、120 格、無限循環不變）；遊戲在需要搭船時才載入
src = SRC / 'bear-boat-anim-original.webp'; im = Image.open(src); ms = durations(src); frames = []
for k in range(im.n_frames):
    im.seek(k); frames.append(im.convert('RGBA').resize((384, 384), Image.LANCZOS))
assert len(ms) == len(frames)
frames[0].save(OUT / 'bear-boat-anim.webp', 'WEBP', save_all=True, append_images=frames[1:], duration=ms, loop=0, quality=70, method=4, minimize_size=True, allow_mixed=True, kmax=12)
print('bear-boat-anim.webp', frames[0].size, len(frames), 'frames', sum(ms), 'ms', (OUT / 'bear-boat-anim.webp').stat().st_size)
