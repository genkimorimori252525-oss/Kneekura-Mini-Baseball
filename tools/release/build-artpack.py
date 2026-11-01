"""Builds the game art bank from the accepted-art catalog.

Keeps originals untouched: each chosen PNG is cropped to its alpha box and scaled
for the game. usage: build-artpack.py <drawing-root> <parts-dir>
"""
import base64
import hashlib
import io
import json
import os
import sys

from PIL import Image

root, game = sys.argv[1], sys.argv[2]
art = os.path.join(root, "generated_images", "accepted-art-v2")
catalog = json.load(open(os.path.join(art, "catalog.json"), encoding="utf-8"))
entries = {e["id"]: e for e in catalog["entries"]}
# bank key -> (catalog id, kit, standing-height ratio of this pose)
wanted = {}
for form, family in (("over", "b2-overhand-v3"), ("side", "b2-sidearm-v1"), ("under", "b2-underarm-v1")):
    for i in range(6):
        wanted[f"pitch/{form}/{i}"] = (f"{family}:{i + 1}", "original", None)
for i, key in enumerate(["ready", "load", "impact-middle", "follow-middle"]):
    wanted[f"bat/rear/{i}"] = (f"b2-form-01-direct-rear-v1:{key}", "original", .92)
wanted["catch/home"] = ("b2-catcher-ready-v1:both-knees-up", "home", .62)
wanted["catch/away"] = ("b2-catcher-ready-v1:both-knees-up", "away", .62)
wanted["umpire/ready"] = ("b2-plate-umpire-ready-v1:hands-on-knees", "original", .8)

MAX_SIDE = 256
out, family_height, assets = {}, {}, {}
for key, (entry_id, kit, ratio) in wanted.items():
    entry = entries[entry_id]
    variant = next(v for v in entry["variants"] if v.get("kit") == kit and v.get("skin", "original") == "original")
    image = Image.open(os.path.join(art, variant["file"])).convert("RGBA")
    box = image.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    crop = image.crop(box)
    scale = MAX_SIDE / max(crop.size)
    small = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS)
    buffer = io.BytesIO()
    small.quantize(colors=48, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(buffer, "PNG", optimize=True)
    data = base64.b64encode(buffer.getvalue())
    name = hashlib.sha256(data).hexdigest()[:24]
    with open(os.path.join(game, "assets", name + ".b64"), "wb") as f:
        f.write(data)
    # Frames of one motion share the height of its first, standing frame.
    group = key.rsplit("/", 1)[0] if key.startswith("pitch/") else key
    raw_height = crop.height / (ratio or 1)
    family_height.setdefault(group, raw_height * scale)
    out[key] = {"id": entry_id, "asset": name, "referenceHeight": round(family_height[group], 2)}
    print(key, small.size, len(data))
body = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "art-bank-runtime.js"), encoding="utf-8").read()
pack = ",".join(f'{json.dumps(k)}:{{id:{json.dumps(v["id"])},referenceHeight:{v["referenceHeight"]},data:"@@ASSET:{v["asset"]}@@"}}' for k, v in out.items())
with open(os.path.join(game, "parts", "art-bank-v1.js"), "w", encoding="utf-8", newline="") as f:
    f.write(body.replace("/*ART_PACK*/", pack))
manifest = json.load(open(os.path.join(game, "manifest.json")))
names = [e["file"] for e in manifest["entries"]]
if "art-bank-v1.js" not in names:
    i = names.index("032-script.js")
    with open(os.path.join(game, "parts", "art-bank-shell.html"), "w", encoding="utf-8", newline="") as f:
        f.write('</script>\n<script id="art-bank-v1">')
    manifest["entries"][i + 1:i + 1] = [{"kind": "shell", "file": "art-bank-shell.html"}, {"kind": "js", "file": "art-bank-v1.js"}]
    json.dump(manifest, open(os.path.join(game, "manifest.json"), "w"), indent=0)
print("sprites", len(out))
