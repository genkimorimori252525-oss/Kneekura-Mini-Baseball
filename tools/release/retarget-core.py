"""Builds maker.html and lab.html on the current Core without touching their UI.

Both embed older game pages as escaped strings. Each embedded Native bundle is
swapped for the new one and the Workbench script part is replaced.
usage: retarget-core.py <app-dir> <native.js> <workbench.js> <output.html> [roster.json]
A roster file replaces the embedded default roster and must stay out of git.
"""
import json
import os
import subprocess
import sys

app, native_path, workbench_path, output = sys.argv[1:5]
roster_path = sys.argv[5] if len(sys.argv) > 5 else None
native = open(native_path, encoding="utf-8").read()
workbench = open(workbench_path, encoding="utf-8").read()
escaped = json.dumps(native, ensure_ascii=False)[1:-1].replace("<", "\\u003c")
START = '\\"use strict\\";\\nvar KneekuraNativeMatchCore = (() => {'
END = "\\u003c/script>"
parts = os.path.join(app, "parts")
build = os.path.join(app, "build")
os.makedirs(build, exist_ok=True)
slots = []
manifest = json.load(open(os.path.join(app, "manifest.json")))
for entry in manifest["entries"]:
    name = entry["file"]
    if not name.endswith(".js"):
        continue
    path = os.path.join(parts, name)
    if roster_path and name == "034-script.js":
        target = os.path.join(build, name)
        roster = open(roster_path, encoding="utf-8").read()
        text = open(path, encoding="utf-8").read()
        at = text.index("{", text.index("KneekuraLiveGameRosterData="))
        end = json.JSONDecoder().raw_decode(text, at)[1]
        open(target, "w", encoding="utf-8").write(text[:at] + roster + text[end:])
        slots.append(f"{name}={target}")
        print("roster", name)
        continue
    if os.path.getsize(path) < 300000:
        continue
    text = open(path, encoding="utf-8", errors="surrogatepass").read()
    if text.lstrip().startswith('"use strict"; var KneekuraBaseballWorkbench') or text.lstrip().startswith('"use strict";\nvar KneekuraBaseballWorkbench'):
        target = os.path.join(build, name)
        open(target, "w", encoding="utf-8").write(workbench)
        slots.append(f"{name}={target}")
        print("workbench", name)
        continue
    count = 0
    at = text.find(START)
    while at >= 0:
        end = text.index(END, at)
        text = text[:at] + escaped + text[end:]
        count += 1
        at = text.find(START, at + len(escaped))
    if count:
        target = os.path.join(build, name)
        open(target, "w", encoding="utf-8").write(text)
        slots.append(f"{name}={target}")
        print("native", name, count)
for slot in slots:
    name = slot.split("=", 1)[0]
    for entry in manifest["entries"]:
        if entry["file"] == name:
            entry["slot"] = name
json.dump(manifest, open(os.path.join(app, "manifest-built.json"), "w"), indent=0)
subprocess.run(["node", "tools/release/assemble-html.mjs", app, output, "--manifest=manifest-built.json", *slots], check=True)
