#!/usr/bin/env python3
"""產生 A1~D5 共 20 桌的點歌 QR Code PNG（新版 Next.js App，路徑 /c?table=）。

用法:
    python make_qrcodes_app.py "https://jukebox-sandy-ten.vercel.app"

每張 QR 對應  <BASE>/c?table=<桌號>  ，輸出到 qrcodes-app/ 資料夾。
"""
import os
import sys
import qrcode

ROWS = ["A", "B", "C", "D"]
COLS = range(1, 6)


def main():
    if len(sys.argv) < 2:
        print('用法: python make_qrcodes_app.py "https://你的網址.vercel.app"')
        sys.exit(1)

    base = sys.argv[1].rstrip("/")
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qrcodes-app")
    os.makedirs(out_dir, exist_ok=True)

    tables = [f"{r}{c}" for r in ROWS for c in COLS]
    for table in tables:
        url = f"{base}/c?table={table}"
        qrcode.make(url).save(os.path.join(out_dir, f"{table}.png"))
        print(f"  {table}.png  ->  {url}")

    print(f"\n完成，共 {len(tables)} 張，輸出於: {out_dir}")


if __name__ == "__main__":
    main()
