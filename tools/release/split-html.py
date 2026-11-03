"""Split a built single-file HTML into editable parts plus an ordered manifest.

Text between blocks, inline scripts and styles become separate files. Long base64
runs move to assets/ so the code files stay small enough to edit.
usage: split-html.py <input.html> <output-dir>
"""
import hashlib
import json
import os
import re
import sys

src, out = sys.argv[1], sys.argv[2]
os.makedirs(out + "/parts", exist_ok=True)
os.makedirs(out + "/assets", exist_ok=True)
data = open(src, "rb").read()
sha = hashlib.sha256(data).hexdigest()
OPEN = re.compile(rb"<(script|style)\b([^>]*)>")
B64 = re.compile(rb"[A-Za-z0-9+/]{4096,}={0,2}")
manifest = {"sourceSha256": sha, "entries": []}
assets = {}


def put_part(index, label, ext, body):
    name = f"{index:03d}-{label}.{ext}"

    def to_asset(m):
        h = hashlib.sha256(m.group(0)).hexdigest()[:24]
        if h not in assets:
            assets[h] = len(m.group(0))
            with open(f"{out}/assets/{h}.b64", "wb") as f:
                f.write(m.group(0))
        return b"@@ASSET:" + h.encode() + b"@@"

    with open(f"{out}/parts/{name}", "wb") as f:
        f.write(B64.sub(to_asset, body))
    return name


pos = 0
index = 0
while True:
    m = OPEN.search(data, pos)
    if not m:
        break
    tag = m.group(1)
    end = data.find(b"</" + tag + b">", m.end())
    assert end >= 0
    index += 1
    manifest["entries"].append({"kind": "shell", "file": put_part(index, "shell", "html", data[pos:m.end()])})
    attrs = m.group(2).decode("utf-8", "replace")
    idm = re.search(r'id="([^"]+)"', attrs)
    is_json = 'application/json' in attrs
    label = re.sub(r"[^a-zA-Z0-9-]", "-", idm.group(1)) if idm else tag.decode()
    ext = "css" if tag == b"style" else ("json" if is_json else "js")
    index += 1
    manifest["entries"].append({"kind": ext, "file": put_part(index, label, ext, data[m.end():end])})
    pos = end
index += 1
manifest["entries"].append({"kind": "shell", "file": put_part(index, "shell", "html", data[pos:])})
json.dump(manifest, open(out + "/manifest.json", "w"), indent=0)
sizes = sorted(((os.path.getsize(f"{out}/parts/{e['file']}"), e["file"]) for e in manifest["entries"]), reverse=True)
print("entries", len(manifest["entries"]), "assets", len(assets), sum(assets.values()))
print(sizes[:14])
