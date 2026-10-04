"""Checks palette.py and ui_compare.py on generated mockups (needs Pillow)."""
import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
failures = 0


def check(cond, msg):
    global failures
    if not cond:
        failures += 1
        print(f"    {msg}")


with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    ref = Image.new("RGB", (1440, 900), "#F8FAFC")
    d = ImageDraw.Draw(ref)
    d.rectangle([120, 120, 1320, 780], fill="#FFFFFF")
    d.rectangle([160, 160, 900, 200], fill="#101828")
    d.rounded_rectangle([160, 320, 400, 364], radius=8, fill="#1F4FD8")
    ref.save(tmp / "ref.png")
    act = ref.copy()
    ImageDraw.Draw(act).rectangle([160, 320, 400, 364], fill="#F8FAFC")
    ImageDraw.Draw(act).rounded_rectangle([160, 344, 400, 388], radius=8, fill="#1F4FD8")
    act.save(tmp / "act.png")

    out = subprocess.run([sys.executable, ROOT / "scripts" / "palette.py", tmp / "ref.png", "--json"], capture_output=True, text=True)
    check(out.returncode == 0, f"palette.py failed: {out.stderr}")
    hexes = [c["hex"] for c in json.loads(out.stdout)["colors"]]
    for want in ("#FFFFFF", "#F8FAFC", "#101828", "#1F4FD8"):
        check(want in hexes, f"palette.py missed {want}: {hexes}")

    same = subprocess.run([sys.executable, ROOT / "scripts" / "ui_compare.py", tmp / "ref.png", tmp / "ref.png", tmp / "same.png", "--json"], capture_output=True, text=True)
    check(same.returncode == 0 and json.loads(same.stdout)["similarity_percent"] == 100.0, "identical images should score 100%")

    diff = subprocess.run([sys.executable, ROOT / "scripts" / "ui_compare.py", tmp / "ref.png", tmp / "act.png", tmp / "diff.png", "--json"], capture_output=True, text=True)
    check(diff.returncode == 0, f"ui_compare.py failed: {diff.stderr}")
    res = json.loads(diff.stdout)
    check(res["similarity_percent"] < 100, "moved button not detected")
    check(any(b["y"] <= 360 <= b["y"] + b["height"] for b in res["difference_bands"]), f"difference band misplaced: {res['difference_bands']}")
    check((tmp / "diff.png").exists(), "comparison sheet not written")

    # Transparent exports are read on white, and the sheet's folder is created when missing.
    clear = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(clear).rectangle([0, 0, 39, 39], fill="#E11D48")
    clear.save(tmp / "clear.png")
    out = subprocess.run([sys.executable, ROOT / "scripts" / "palette.py", tmp / "clear.png", "--json"], capture_output=True, text=True)
    top = json.loads(out.stdout)["colors"][0]["hex"] if out.returncode == 0 else out.stderr
    check(top == "#FFFFFF", f"transparent pixels should read as white, got {top}")
    nested = subprocess.run([sys.executable, ROOT / "scripts" / "ui_compare.py", tmp / "ref.png", tmp / "act.png", tmp / "compare" / "x.png"], capture_output=True, text=True)
    check(nested.returncode == 0 and (tmp / "compare" / "x.png").exists(), f"ui_compare.py should create the output folder: {nested.stderr}")
    # A large photo-like image (every pixel different) finishes quickly.
    Image.effect_noise((2400, 1600), 80).convert("RGB").save(tmp / "photo.jpg")
    started = time.monotonic()
    photo = subprocess.run([sys.executable, ROOT / "scripts" / "palette.py", tmp / "photo.jpg", "--json"], capture_output=True, text=True)
    took = time.monotonic() - started
    check(photo.returncode == 0 and took < 15, f"palette.py on a large photo: exit {photo.returncode} after {took:.1f}s")
    missing = subprocess.run([sys.executable, ROOT / "scripts" / "palette.py", tmp / "none.png"], capture_output=True, text=True)
    check(missing.returncode != 0 and "Traceback" not in missing.stderr, "a missing image should give a short error, not a traceback")

if failures:
    print(f"  {failures} image check(s) failed")
    sys.exit(1)
