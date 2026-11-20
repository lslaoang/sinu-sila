"""Give every portrait the same background: cut the person out (macOS Vision, tools/cutout.swift) and save a
transparent WebP in place. The page paints one background colour (--photo) behind every face.

Run: python3 tools/cutout_photos.py        (macOS 14+, needs Pillow; mirror_photos.py calls it for new photos)
Skips photos that already have transparency, so it is safe to re-run. Originals stay in git history.
"""
import glob, os, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
todo = [f for f in sorted(glob.glob(os.path.join(ROOT, "assets/photos/*.webp"))) if Image.open(f).mode != "RGBA"]
if not todo: sys.exit(print("cutout: all photos already done"))
out = subprocess.run(["swift", os.path.join(ROOT, "tools/cutout.swift"), *todo], capture_output=True, text=True).stdout
done, skipped = 0, [l for l in out.splitlines() if l.startswith("skip")]
for f in todo:
    cut = f[:-5] + ".cut.png"
    if not os.path.exists(cut): continue
    Image.open(cut).convert("RGBA").save(f, "WEBP", quality=80, alpha_quality=90, method=6)
    os.remove(cut); done += 1
print(f"cutout: {done}/{len(todo)} done" + "".join(f"\n  {l}" for l in skipped))
