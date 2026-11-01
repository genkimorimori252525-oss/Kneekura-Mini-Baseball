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
for gait, family in (("run", "b2-runner-direct-rear-v1"), ("walk", "b2-walk-direct-rear-v1")):
    for i in range(2):
        wanted[f"{gait}/rear/{i}"] = (f"{family}:{i + 1}", "original", .98)
for kit in ("home", "away"):
    for i in range(3):
        wanted[f"ground/{kit}/{i}"] = (f"b2-field-ground-v1:{i + 1}", kit, .6)
        wanted[f"throw/in/{kit}/{i}"] = (f"b2-infield-throw-v1:{i + 1}", kit, .9)
        wanted[f"throw/out/{kit}/{i}"] = (f"b2-outfield-throw-v1:{i + 1}", kit, .9)
    wanted[f"fly/in/{kit}"] = ("b2-fly-infield-outfield-v1:infield-fly", kit, 1.05)
    wanted[f"fly/out/{kit}"] = ("b2-fly-infield-outfield-v1:outfield-fly", kit, 1.05)
# Robin's own frames, addressed by the B2 pose each one redraws.
robin = json.load(open(os.path.join(root, "generated_images", "robin-defense-v1", "manifest.json"), encoding="utf-8"))
robin_pose = {"b2-sidearm-v1:1": "robin/pitch/0", "b2-sidearm-v1:3": "robin/pitch/1", "b2-sidearm-v1:4": "robin/pitch/2",
              "b2-infield-throw-v1:1": "robin/throw/0", "b2-infield-throw-v1:2": "robin/throw/1", "b2-infield-throw-v1:3": "robin/throw/2",
              "b2-field-ground-v1:1": "robin/ground/0", "b2-field-ground-v1:2": "robin/ground/1", "b2-field-ground-v1:3": "robin/ground/2"}
robin_files = {robin_pose[f["sourceId"]]: f for f in robin["frames"] if f["sourceId"] in robin_pose}

MAX_SIDE = 256
out, family_height, assets = {}, {}, {}
for key in robin_files:
    wanted[key] = (robin_files[key]["id"], None, 1)
for key, (entry_id, kit, ratio) in wanted.items():
    if key.startswith("robin/"):
        image = Image.open(os.path.join(root, "generated_images", "robin-defense-v1", robin_files[key]["file"])).convert("RGBA")
    else:
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
    group = key.rsplit("/", 1)[0] if key.startswith(("pitch/", "robin/pitch", "run/", "walk/")) else key
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
