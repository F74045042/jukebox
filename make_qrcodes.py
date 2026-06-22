#!/usr/bin/env python3
"""產生 A1~D5 共 20 桌的點歌 QR Code PNG。

用法:
    python make_qrcodes.py "https://<user>.github.io/<repo>/"

每張 QR 對應  <BASE>customer.html?table=<桌號>  ，輸出到 qrcodes/ 資料夾。
"""
import os
import sys
import qrcode

# 桌號：A~D 列，每列 1~5，共 20 桌
ROWS = ["A", "B", "C", "D"]
COLS = range(1, 6)


def main():
    if len(sys.argv) < 2:
        print("用法: python make_qrcodes.py <BASE_URL>")
        print('例如: python make_qrcodes.py "https://user.github.io/jukebox/"')
        sys.exit(1)

    base = sys.argv[1]
    if not base.endswith("/"):
        base += "/"

    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qrcodes")
    os.makedirs(out_dir, exist_ok=True)

    tables = [f"{r}{c}" for r in ROWS for c in COLS]
    for table in tables:
        url = f"{base}customer.html?table={table}"
        img = qrcode.make(url)
        path = os.path.join(out_dir, f"{table}.png")
        img.save(path)
        print(f"  {table}.png  ->  {url}")

    print(f"\n完成，共 {len(tables)} 張，輸出於: {out_dir}")


if __name__ == "__main__":
    main()
