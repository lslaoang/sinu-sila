"""Copy every portrait onto our own host so pages don't wait on senate.gov.ph or Wikimedia.

Run: python3 tools/mirror_photos.py   (needs Pillow; safe to re-run, skips files already saved)
For each person with a remote `photo`, it saves a resized WebP to assets/photos/<id>.webp, keeps the original
URL in `photo_src` (provenance) and points `photo` at the local file. Credits (`photo_credit_url`) are unchanged.
"""
import io, json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

UA = {"User-Agent": "ph-politicians/0.1 (contact: [removed])"}
OUT = "assets/photos"
WIDTH = {"senate": 480, "house": 300}


def fetch(url, tries=5):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()
        except Exception as e:
            time.sleep(2 * (i + 1))
    raise RuntimeError(url)


def save(p):
    src = p.get("photo_src") or p["photo"]
    dest = f"{OUT}/{p['id']}.webp"
    if not os.path.exists(dest):
        im = Image.open(io.BytesIO(fetch(src))).convert("RGB")
        w = WIDTH[p.get("body", "senate")]
        if im.width > w: im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
        im.save(dest, "WEBP", quality=80, method=6)
    return p, src, dest


def main():
    os.makedirs(OUT, exist_ok=True)
    off = json.load(open("data/officials.json"))
    hs = json.load(open("data/house.json"))
    people = [p for p in off if p.get("photo")] + [p for p in hs["people"] if p.get("photo")]
    failed = []
    with ThreadPoolExecutor(4) as ex:
        for fut in [ex.submit(save, p) for p in people]:
            try:
                p, src, dest = fut.result()
                p["photo_src"], p["photo"] = src, dest
            except Exception as e:
                failed.append(str(e))
    json.dump(off, open("data/officials.json", "w"), indent=1, ensure_ascii=False)
    json.dump(hs, open("data/house.json", "w"), indent=1, ensure_ascii=False)
    kb = sum(os.path.getsize(f"{OUT}/{f}") for f in os.listdir(OUT)) // 1024
    print(f"{len(people) - len(failed)}/{len(people)} saved, {kb} KB total; failed: {failed}")


main()
