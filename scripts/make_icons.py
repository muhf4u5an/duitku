"""Membuat ikon PNG DuitKu tanpa library tambahan (hanya Python standar).

Jalankan: python scripts/make_icons.py
Hasil: public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png, public/favicon.png
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'public')

C1 = (0x6C, 0x5C, 0xE7)  # ungu
C2 = (0xE8, 0x43, 0x93)  # pink


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def pixel(x, y, s):
    u, v = x / s, y / s
    # latar gradasi diagonal (full-bleed, iOS membulatkan sudut sendiri)
    col = lerp(C1, C2, min(1.0, max(0.0, (u + v) / 2 * 1.15 - 0.1)))
    # kartu dompet putih
    cx0, cy0, cx1, cy1, r = 0.2, 0.3, 0.8, 0.72, 0.07
    dx = max(cx0 + r - u, 0, u - (cx1 - r))
    dy = max(cy0 + r - v, 0, v - (cy1 - r))
    inside_card = (cx0 <= u <= cx1 and cy0 <= v <= cy1) and (dx * dx + dy * dy <= r * r)
    if inside_card:
        col = (255, 255, 255)
        # kantong koin di kanan
        px0, py0, px1, py1 = 0.56, 0.44, 0.86, 0.58
        if px0 <= u <= px1 and py0 <= v <= py1:
            col = lerp(C1, C2, 0.35)
            if math.hypot(u - 0.64, v - 0.51) <= 0.03:
                col = (255, 255, 255)
        # garis di atas kartu
        elif 0.26 <= u <= 0.5 and 0.38 <= v <= 0.41:
            col = lerp((255, 255, 255), C1, 0.35)
    return col


def write_png(path, size):
    raw = bytearray()
    for y in range(size):
        raw.append(0)
        for x in range(size):
            raw.extend(pixel(x + 0.5, y + 0.5, size))
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180), ('favicon.png', 64)]:
        write_png(os.path.join(OUT, name), size)
        print('ok', name)
