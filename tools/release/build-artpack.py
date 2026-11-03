"""Builds the game art bank from the accepted-art catalog.

Keeps originals untouched: each chosen PNG is cropped to its alpha box and scaled
for the game. usage: build-artpack.py <drawing-root> <parts-dir> [gallery.png] [sources.json]

Four kinds of sprite are packed:
 * generic B2 art, every one marked ADOPTED in accepted-art-v2/catalog.json;
 * Robin's own frames (robin-defense-v1);
 * front and glove locomotion (locomotion-four-directions-v1, b2-forward-run-v1), never the rejected side views;
 * dedicated sets that exactly one named player may use: the afro set (ちんすけ,
   b2-afro-regenerated-v1) and the purple-beard set (ロッツォ, purple-beard-planned).
   They are keyed "<who>/<generic key>" and are looked up by the runtime only for that
   player; nobody else can reach them.
"""
import base64
import hashlib
import io
import json
import math
import os
import re
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

root, game = sys.argv[1], sys.argv[2]
gallery_path = sys.argv[3] if len(sys.argv) > 3 else None
sources_path = sys.argv[4] if len(sys.argv) > 4 else None
gen = os.path.join(root, "generated_images")
art = os.path.join(gen, "accepted-art-v2")
catalog = json.load(open(os.path.join(art, "catalog.json"), encoding="utf-8"))
entries = {e["id"]: e for e in catalog["entries"]}
# Share of standing height each delivery frame fills. Every frame of a sheet was once stretched to the first frame's
# height, which made the stride frames half as tall again; these come from the head circle measured on each frame
# (a B2 head is 19 cm on a 1.8 m figure) and are capped at standing height, because over/0 and over/1 are drawn long.
PITCH_RATIO = {"over": (1, 1, .72, .76, .72, .75), "side": (1, 1, .97, .77, .77, .83), "under": (.85, .88, .95, .64, .85, .82),
               "montage": (1.15, .84, .77, .9, .68, .84)}
# bank key -> (catalog id, kit, standing-height ratio of this pose)
wanted = {}
for form, family in (("over", "b2-overhand-v3"), ("side", "b2-sidearm-v1"), ("under", "b2-underarm-v1"), ("montage", "b2-pitch-montage-form-v1")):
    for i in range(6):
        wanted[f"pitch/{form}/{i}"] = (f"{family}:{i + 1}", "original", PITCH_RATIO[form][i])
wanted["catch/home"] = ("b2-catcher-ready-v1:both-knees-up", "home", .62)
wanted["catch/away"] = ("b2-catcher-ready-v1:both-knees-up", "away", .62)
wanted["umpire/ready"] = ("b2-plate-umpire-ready-v1:hands-on-knees", "original", .8)
for gait, family in (("run", "b2-runner-direct-rear-v1"), ("walk", "b2-walk-direct-rear-v1")):
    for i in range(2):
        wanted[f"{gait}/rear/{i}"] = (f"{family}:{i + 1}", "original", .98)
for kit in ("home", "away"):
    for i in range(3):
        wanted[f"ground/{kit}/{i}"] = (f"b2-field-ground-v1:{i + 1}", kit, (.78, .7, .78)[i])
        wanted[f"throw/in/{kit}/{i}"] = (f"b2-infield-throw-v1:{i + 1}", kit, .9)
        wanted[f"throw/out/{kit}/{i}"] = (f"b2-outfield-throw-v1:{i + 1}", kit, .9)
    wanted[f"fly/in/{kit}"] = ("b2-fly-infield-outfield-v1:infield-fly", kit, .95)
    wanted[f"fly/out/{kit}"] = ("b2-fly-infield-outfield-v1:outfield-fly", kit, 1.05)
    wanted[f"liner/{kit}"] = ("b2-pitcher-line-v1:pitcher-liner", kit, 1.02)

# ---- adopted art the bank did not carry yet. Ratio None = derive from the sheet's standing height
# (FAMILY_S below): the pose's crop height in sheet pixels divided by one standing figure on that sheet. ----
for kit in ("home", "away"):
    # Catcher: where the ball arrives (art-bank-runtime.js catcherKey names them).
    wanted[f"catchx/one-knee/{kit}"] = ("b2-catcher-ready-v1:one-knee-down", kit, None)
    for n in ("left", "right", "high", "low"):
        wanted[f"catchx/zone-{n}/{kit}"] = (f"b2-catcher-zone-v1:mitt-{n}", kit, None)
        wanted[f"catchx/kzone-{n}/{kit}"] = (f"b2-catcher-one-knee-positions-v1:zone-{n}", kit, None)
    for n in ("left", "right", "high", "low-kneeling"):
        wanted[f"catchx/ball-{n}/{kit}"] = (f"b2-catcher-ball-v1:ball-{n}", kit, None)
    for n in ("left", "right", "high"):
        wanted[f"catchx/kball-{n}/{kit}"] = (f"b2-catcher-one-knee-positions-v1:ball-{n}", kit, None)
    for n in ("low", "middle", "high"):
        wanted[f"catchx/extreme-{n}/{kit}"] = (f"b2-catcher-extreme-v1:extreme-{n}", kit, None)
    # Diving, backhand and the pitcher's pickoff.
    for n in ("horizontal-dive", "low-forward-dive", "lateral-slide"):
        wanted[f"dive/{n}/{kit}"] = (f"b2-diving-reach-v1:{n}", kit, None)
    for n in ("forward", "lateral"):
        wanted[f"dive/{n}-dejected/{kit}"] = (f"b2-diving-dejection-v1:{n}-dejected", kit, None)
    for n in ("1", "2"):
        wanted[f"backhand/{n}/{kit}"] = (f"b2-field-backhand-v1:{n}", kit, None)
    for b in (1, 2, 3):
        for i in (1, 2, 3):
            wanted[f"pickoff/{b}/{i - 1}/{kit}"] = (f"b2-pickoff-v1:{b}-{i}", kit, None)
# Plate umpire: the count shown between pitches, the call after it, the strikeout signals, the tag-out.
wanted["umpire/time"] = ("umpire:time", "original", None)
wanted["umpire/play-ball"] = ("umpire:play-ball", "original", None)
for b in range(4):
    for s in range(3):
        wanted[f"umpire/count/{b}-{s}"] = (f"umpire:count:B{b}-S{s}", "original", None)
for n in ("diagonal-up", "knee-lift", "side-punch", "arms-spread", "overhead-twist"):
    wanted[f"umpire/strikeout/{n}"] = (f"b2-plate-umpire-strikeout-v1:{n}", "original", None)
wanted["umpire/home-tag-out"] = ("b2-umpire-field-calls-v1:home-tag-out", "original", None)
for n in ("safe", "out", "foul", "fair-front", "fair-rear"):
    wanted[f"umpire/base-{n}"] = (f"b2-umpire-field-calls-v1:base-{n}", "original", None)
# Runner slides and the batter's reactions after a looking strikeout.
wanted["slide/feet"] = ("b2-runner-slide-v1:feet-first-slide", "original", None)
wanted["slide/head"] = ("b2-runner-head-slide-v1:head-first-slide", "original", None)
wanted["slide/dejected"] = ("b2-runner-head-slide-dejection-v1:head-first-dejected", "original", None)
for n in ("look-up-front", "look-up-rear", "bent-forward-front", "bent-forward-rear"):
    wanted[f"look/{n}"] = (f"b2-looking-strikeout-v1:{n}", "original", None)
for n in ("front", "rear"):
    wanted[f"look/photo-{n}"] = (f"b2-looking-strikeout-photo-v1:{n}", "original", None)
# Jumping catches by situation (one drawing sheet, no team kit).
for n in ("lateral-high", "retreat-diagonal", "vertical-reach", "compact-jump", "front-jump"):
    wanted[f"jump/{n}"] = (f"b2-jump-catch-situations-v1:{n}", "original", None)

# Standing height S of one figure on each drawing sheet, in the sheet's own pixels. No two sheets share a scale,
# so each family states its own: derived from a pose that already has a ratio, or read off the sheet by eye
# (head and limb proportions) and checked on the gallery. A pose's ratio = crop height / S.
FAMILY_S = {
    "catcher": "from:catch/home", "umpire": "from:umpire/ready",
    "slide": 1500, "dive": 1100, "dive-dejected": 1500, "backhand": 1200, "jump": 1150,
    "look": 1000, "look-photo": 1080, "pickoff": 740,
}
# A pose drawn at another scale than the rest of its sheet: multiply its ratio. Measured by head circle and body area.
POSE_SCALE = {"catchx/extreme-": 1.15, "catchx/ball-left/": 1.13, "backhand/2/": 1.3, "jump/compact-jump": .78, "jump/front-jump": .85}
FAMILY_OF = (("catchx/", "catcher"), ("umpire/", "umpire"), ("slide/", "slide"), ("dive/forward-dejected", "dive-dejected"),
             ("dive/lateral-dejected", "dive-dejected"), ("dive/", "dive"), ("backhand/", "backhand"), ("jump/", "jump"),
             ("look/photo", "look-photo"), ("look/", "look"), ("pickoff/", "pickoff"))


def family_of(key):
    return next((family for prefix, family in FAMILY_OF if key.startswith(prefix)), None)


# Robin's own frames, addressed by the B2 pose each one redraws.
robin = json.load(open(os.path.join(gen, "robin-defense-v1", "manifest.json"), encoding="utf-8"))
robin_pose = {"b2-sidearm-v1:1": "robin/pitch/0", "b2-sidearm-v1:3": "robin/pitch/1", "b2-sidearm-v1:4": "robin/pitch/2",
              "b2-infield-throw-v1:1": "robin/throw/0", "b2-infield-throw-v1:2": "robin/throw/1", "b2-infield-throw-v1:3": "robin/throw/2",
              "b2-field-ground-v1:1": "robin/ground/0", "b2-field-ground-v1:2": "robin/ground/1", "b2-field-ground-v1:3": "robin/ground/2"}
robin_files = {robin_pose[f["sourceId"]]: f for f in robin["frames"] if f["sourceId"] in robin_pose}
ROBIN_RATIO = {"robin/pitch/0": 1, "robin/pitch/1": .93, "robin/pitch/2": .96, "robin/ground/0": .71, "robin/ground/1": .66,
               "robin/ground/2": .72, "robin/throw/0": 1, "robin/throw/1": .98, "robin/throw/2": .95}
for key in robin_files:
    wanted[key] = (robin_files[key]["id"], None, ROBIN_RATIO[key])
# The adopted pickoffs of her 69; the later hair revision of these nine is still a candidate.
robin_pickoff = {f"robin/pickoff/{b}/{i - 1}": f"pickoff/{b}/{i - 1}/home" for b in (1, 2, 3) for i in (1, 2, 3)}
robin_files.update({key: next(f for f in robin["frames"] if f["sourceId"] == f"b2-pickoff-v1:{generic[8]}-{int(generic[10]) + 1}") for key, generic in robin_pickoff.items()})
for key, generic in robin_pickoff.items():
    wanted[key] = (robin_files[key]["id"], None, None)

# ---- dedicated sets: one named player only ----
CATALOG_REF = re.compile(r"^(?P<family>.+?-v\d+)_(?P<name>.+?)_[0-9a-f]{6}__(?P<kit>[a-z]+)__(?P<skin>[a-z-]+)\.png$")


def lotso_overrides():
    """catalog id -> (png, status) from purple-beard-planned. Each entry redraws one B2 catalog image (its 'reference');
    `current` selects the picture the owner's index calls current (short sleeves for offence, long for defence)."""
    base = os.path.join(gen, "purple-beard-planned")
    index = json.load(open(os.path.join(base, "motions-index.json"), encoding="utf-8"))
    by_catalog, special = {}, {}
    for e in index["entries"]:
        outs, cur = e["outputs"], e.get("current")
        if not outs or not isinstance(cur, int) or cur >= len(outs):
            continue
        out_row = outs[cur]
        path, status = os.path.join(base, out_row["file"]), out_row["status"]
        if path.endswith("follow-owner-adopted-beard.png"):
            path = path.replace("follow-owner-adopted-beard.png", "follow-owner-adopted-beard-clean-v1.png")
        # The owner reviewed every Lotso picture in the bank on 2026-11-02 (follow-photo-revision/owner-review-2026-11-02.json).
        special[e["id"]] = (path, "OWNER_ADOPTED")
        m = CATALOG_REF.match(os.path.basename(e.get("reference", "")))
        if m and status in ("CANDIDATE", "OWNER_ADOPTED"):
            by_catalog[f'{m["family"]}:{m["name"]}'] = (path, "OWNER_ADOPTED")
    return by_catalog, special


def afro_overrides():
    """catalog id -> (png, status) from b2-afro-regenerated-v1: the last usable output of each catalog entry."""
    base = os.path.join(gen, "b2-afro-regenerated-v1")
    by_catalog = {}
    for group in ("bat_pitch_move", "catcher_base", "field_reaction"):
        index = json.load(open(os.path.join(base, group, "index.json"), encoding="utf-8"))
        for e in index["entries"]:
            good = [o for o in (e.get("outputs") or []) if o.get("status") in ("CANDIDATE", "OWNER_ADOPTED")]
            if good:
                by_catalog[e["id"]] = (os.path.join(base, group, good[-1]["file"]), good[-1]["status"])
    return by_catalog


lotso_by_catalog, lotso_special = lotso_overrides()
afro_by_catalog = afro_overrides()
afro_dir = os.path.join(gen, "b2-afro-regenerated-v1", "batting")
afro_batting = {e["id"].split(":")[1]: (os.path.join(afro_dir, e["file"]), "OWNER_ADOPTED")
                for e in json.load(open(os.path.join(afro_dir, "owner-adoption-2026-10-28.json"), encoding="utf-8"))["entries"]}
# Certainty home run: the owner's order is held bat, then released bat (home-run-sequence.json).
afro_hr = [(os.path.join(afro_dir, f["file"]), "OWNER_ADOPTED")
           for f in sorted(json.load(open(os.path.join(afro_dir, "home-run-sequence.json"), encoding="utf-8"))["frames"], key=lambda f: f["order"])]

# What each exclusive player does in the game, as key prefixes (roster position decides it).
DEDICATED_ROLES = {
    "chinsuke": ("bat/", "run/", "walk/", "slide/", "look/"),                                   # DH: bats and runs
    "lotso": ("bat/", "run/", "walk/", "slide/", "look/", "ground/", "throw/in/", "fly/in/", "dive/", "jump/", "backhand/"),  # 3B
}

MAX_SIDE = 256
out, family_height, family_S, sources = {}, {}, {}, {}


# ball-left is a cut-out of a larger sheet, not a plain shrink: matched by eye to the other catcher poses.
SHEET_SCALE = {"b2-catcher-ball-v1:ball-left": .55}


def variant_path(entry_id, kit):
    entry = entries[entry_id]
    variant = next(v for v in entry["variants"] if v.get("kit") == kit and v.get("skin", "original") == "original")
    rect = (entry.get("originalArt") or {}).get("rect")
    sheet_scale = variant["width"] / rect[2] if rect else 1.0   # a catalog file is sometimes a shrunk copy of its sheet
    sheet_scale = SHEET_SCALE.get(entry_id, sheet_scale)
    return os.path.join(art, variant["file"]), sheet_scale


def crop_of(path):
    """Crop to the alpha box. 96 is the runtime's own cut; a few pictures carry a haze of part-transparent pixels (the
    owner-adopted beard follow-through does) and there the figure is solid from 224 up, so the haze is dropped.
    Only this packed copy changes; the PNG on disk is never touched."""
    return crop_of_image(Image.open(path).convert("RGBA"))


def crop_of_image(image):
    hist = image.getchannel("A").histogram()
    if sum(hist[224:]) and sum(hist[96:224]) > .09 * sum(hist[224:]):
        image.putalpha(image.getchannel("A").point(lambda a: a if a >= 224 else 0))
    return image.crop(image.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox())


def clean(small):
    """Every packed pixel is either solid or gone, and no enclosed gap lets the stadium show through the body.
    The runtime cuts at alpha 96, so that is the edge here too."""
    alpha = small.getchannel("A").point(lambda a: 255 if a >= 96 else 0)
    sealed = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    outside = ImageOps.expand(sealed, 1, 0)
    ImageDraw.floodfill(outside, (0, 0), 128)
    inside = outside.crop((1, 1, outside.width - 1, outside.height - 1)).point(lambda a: 0 if a == 128 else 255)
    gaps = ImageChops.subtract(inside, alpha)
    # A gap wider than a few pixels is real daylight, between an arm and the body, and stays open.
    gaps = ImageChops.subtract(gaps, gaps.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7)))
    rgb = small.convert("RGB")
    filler = rgb.filter(ImageFilter.MedianFilter(5))
    rgb.paste(filler, (0, 0), gaps)
    rgb.putalpha(ImageChops.lighter(alpha, gaps))
    return rgb


def encode(crop):
    scale = MAX_SIDE / max(crop.size)
    small = clean(crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.LANCZOS))
    buffer = io.BytesIO()
    small.quantize(colors=48, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE).save(buffer, "PNG", optimize=True)
    data = base64.b64encode(buffer.getvalue())
    name = hashlib.sha256(data).hexdigest()[:24]
    with open(os.path.join(game, "assets", name + ".b64"), "wb") as f:
        f.write(data)
    return scale, small, name, len(data)


for family, spec in FAMILY_S.items():
    if isinstance(spec, str):
        entry_id, kit, ratio = wanted[spec[5:]]
        path, sheet_scale = variant_path(entry_id, kit)
        family_S[family] = crop_of(path).height / sheet_scale / ratio
    else:
        family_S[family] = spec


def ratio_of(key):
    if key in robin_pickoff:
        return ratio_of(robin_pickoff[key])
    entry_id, kit, ratio = wanted[key]
    if ratio is None and family_of(key) is not None:
        path, sheet_scale = variant_path(entry_id, kit)
        ratio = crop_of(path).height / sheet_scale / family_S[family_of(key)]
    return ratio * next((v for prefix, v in POSE_SCALE.items() if key.startswith(prefix)), 1)


# Where the world position sits on the picture. The crop's middle moves with an arm or a bat, so a motion would jump
# sideways between frames: planted poses stand on the lowest foot, moving ones on their mass, flat ones on the crop.
ANCHOR_FOOT = ("pitch/", "pickoff/", "liner/", "bat/", "catch/", "catchx/", "umpire/", "ground/", "throw/", "fly/", "backhand/", "robin/pitch", "robin/pickoff", "robin/ground", "robin/throw")
ANCHOR_BODY = ("run/", "walk/", "look/", "robin/run")


def anchor_x(name, small, height):
    key = name.split("/", 1)[1] if name.startswith(("lotso/", "chinsuke/")) else name
    alpha = small.getchannel("A")
    if key.startswith(ANCHOR_FOOT):
        band = alpha.crop((0, max(0, small.height - max(2, round(height * .06))), small.width, small.height)).getbbox()
        return round((band[0] + band[2]) / 2, 1)
    if key.startswith(ANCHOR_BODY):
        columns = alpha.resize((small.width, 1), Image.BOX).getdata()
        return round(sum((x + .5) * v for x, v in enumerate(columns)) / max(1, sum(columns)), 1)
    return round(small.width / 2, 1)


def store(name, entry_id, path, status, crop, ratio_value, group, extra=None):
    scale, small, asset, size = encode(crop)
    # Frames of one motion share the height of its first, standing frame.
    family_height.setdefault(group, crop.height / (ratio_value or 1) * scale)
    out[name] = {"id": entry_id, "asset": asset, "referenceHeight": round(family_height[group], 2), "footX": anchor_x(name, small, family_height[group]), "small": small, "bytes": size}
    sources[name] = {"catalogId": entry_id, "file": os.path.relpath(path, root).replace("\\", "/"), "status": status,
                     "ratio": round(ratio_value, 4) if ratio_value else None, **(extra or {})}
    print(name, small.size, size)


for key, (entry_id, kit, ratio) in wanted.items():
    if key.startswith("robin/"):
        path, status = os.path.join(gen, "robin-defense-v1", robin_files[key]["file"]), "ROBIN_OWN"
    else:
        path, _ = variant_path(entry_id, kit)
        status = "ADOPTED"
    group = key.rsplit("/", 1)[0] if key.startswith(("run/", "walk/")) else key
    store(key, entry_id, path, status, crop_of(path), ratio_of(key), group)

# ---- dedicated frames ----
# A dedicated frame replaces the generic one in the same slot and is drawn at the same height as it (same ratio),
# so an exclusive player keeps the proportions the slot was tuned for.
def dedicate(who, key, path, status, ratio_value, entry_id, extra=None):
    group = f"{who}/" + (key.rsplit("/", 1)[0] if key.startswith(("run/", "walk/")) else key)
    store(f"{who}/{key}", entry_id, path, status, crop_of(path), ratio_value, group, extra)


for who, table in (("lotso", lotso_by_catalog), ("chinsuke", afro_by_catalog)):
    for key, (entry_id, kit, ratio) in wanted.items():
        if key.startswith("robin/") or kit == "away" or not key.startswith(DEDICATED_ROLES[who]):
            continue
        if entry_id in table:
            dedicate(who, key, table[entry_id][0], table[entry_id][1], ratio_of(key), entry_id)

# Batting seen from the pitcher's side replaces a B1 silhouette, so each frame states its own standing height.
# Afro: the head (hair mass) width, measured once per frame in source pixels, is the same size in every frame,
# and the upright part of the stance gives standing height = 4.27 head widths.
AFRO_HEAD = {"stance": 328, "load": 368, "swing": 364, "follow": 308, "home-run": 348}
STANDING_PER_HEAD = 4.27
for i, name in enumerate(("stance", "load", "swing", "follow")):
    path, status = afro_batting[name]
    dedicate("chinsuke", f"bat/mound/{i}", path, status, crop_of(path).height / (STANDING_PER_HEAD * AFRO_HEAD[name]), "owner-afro-batting:" + name)
for i, (path, status) in enumerate(afro_hr):
    dedicate("chinsuke", f"bat/hr/{i}", path, status, crop_of(path).height / (STANDING_PER_HEAD * AFRO_HEAD["home-run"]), f"owner-afro-batting:home-run:{i + 1}")
# Beard set: crop height / standing height per pose (bat above the head, lunge, arms up), checked on the gallery.
LOTSO_BAT = {"stance": .88, "load": .92, "swing": .88, "follow": .96}
for i, name in enumerate(("stance", "load", "swing", "follow")):
    path, status = lotso_special[name]
    dedicate("lotso", f"bat/mound/{i}", path, status, LOTSO_BAT[name], "purple-beard:" + name,
             {"note": "UNRESOLVED in the owner's index; connected only so the swing is not a silhouette"} if status == "UNRESOLVED" else None)
path, status = lotso_special["home-run"]
dedicate("lotso", "bat/hr/0", path, status, 1.02, "purple-beard:home-run")
# ---- batting for everyone without a set of their own: the body without a bat, and the Core's real bat in its hands ----
# The owner approved this on 2026-11-03 after seeing the probe. The sheet holds four frames, two by two, drawn as a
# left-handed batter seen from the pitcher; body-repair-guide-v2.json gives each frame's foot and the point where the
# real bat's grip belongs, in the frame's own pixels. Nothing is redrawn: the cells are cut out of the sheet as they are.
PROBE = os.path.join(root, "output", "b2-form-01-motion-probe")
BODY_RATIO = (.80, .80, .82, .86)


def crop_box(image):
    """The alpha box crop_of_image would cut, so a point on the picture can follow the crop."""
    alpha = image.getchannel("A")
    hist = alpha.histogram()
    if sum(hist[224:]) and sum(hist[96:224]) > .09 * sum(hist[224:]):
        alpha = alpha.point(lambda a: a if a >= 224 else 0)
    return alpha.point(lambda a: 255 if a > 24 else 0).getbbox()


body_sheet = Image.open(os.path.join(PROBE, "b2-form01-body-only-v2.png")).convert("RGBA")
cell_w, cell_h = body_sheet.width // 2, body_sheet.height // 2
for guide in json.load(open(os.path.join(PROBE, "body-repair-guide-v2.json"), encoding="utf-8")):
    i = guide["cell"]
    cell = body_sheet.crop(((i % 2) * cell_w, (i // 2) * cell_h, (i % 2 + 1) * cell_w, (i // 2 + 1) * cell_h))
    box = crop_box(cell)
    crop = crop_of_image(cell)
    name = f"body/mound/{i}"
    store(name, f"b2-form01-body-only-v2:{i}", os.path.join(PROBE, "b2-form01-body-only-v2.png"), "OWNER_ADOPTED_2026-11-03", crop, BODY_RATIO[i], name)
    scale = MAX_SIDE / max(crop.size)
    out[name]["grip"] = (round((guide["grip"][0] - box[0]) * scale, 1), round((guide["grip"][1] - box[1]) * scale, 1))

# ---- the upper body bends to where the ball is: high, middle or low, inside, middle or outside ----
# The owner's probe (output/b2-defense-motion-probe/afro-redraw/height/height.js), approved 2026-11-03 for ちんすけ and
# for ロッツォ: the frame at impact bends about the hip. Above the hip the body turns by up to the request's angle,
# fading to nothing at the knees; the drawn bat is lifted out and turned rigidly with the hands. The legs never move.
# Values are in the probe's pixels on its 1236 x 1272 picture and scale with each picture.
ARC_NX, ARC_NY, ARC_REACH, ARC_LIFT = 36, 36, 40 / 1236, 160 / 1272
ARC_SETS = {
    # who: (picture, standing height in its pixels, faces screen right, hip pivot, bat box, bat anchor), as fractions
    "chinsuke": (afro_batting["swing"][0], STANDING_PER_HEAD * AFRO_HEAD["swing"], True, (.33, .54), (.64, .44, 1, .80), (.64, .56)),
    "lotso": (lotso_special["swing"][0], None, False, (.65, .52), (0, .39, .44, .57), (.44, .45)),
}


def arc_weight(y, h):
    t = max(0.0, min(1.0, (y / h - .48) / .36))
    return 1 - t * t * (3 - 2 * t)


def arc_picture(image, pivot, bat_box, anchor, reach, lift):
    """image faces screen right. Returns the bent picture on a padded canvas (padding = pad on every side)."""
    w, h = image.size
    pad = round(max(w, h) * .25)
    px, py = pivot[0] * w, pivot[1] * h
    angle = math.atan2(lift, w * .35)
    bat_rect = (round(bat_box[0] * w), round(bat_box[1] * h), round(bat_box[2] * w), round(bat_box[3] * h))
    body = image.copy()
    body.paste((0, 0, 0, 0), bat_rect)

    def forward(x, y):
        k = arc_weight(y, h)
        t = angle * k
        c, s = math.cos(t), math.sin(t)
        dx, dy = x - px, y - py
        return px + c * dx - s * dy + reach * k, py + s * dx + c * dy

    out = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    src, dst = body.load(), out.load()
    grid = [[(x * w / ARC_NX, y * h / ARC_NY) for x in range(ARC_NX + 1)] for y in range(ARC_NY + 1)]
    moved = [[forward(*p) for p in row] for row in grid]
    for gy in range(ARC_NY):
        for gx in range(ARC_NX):
            for tri in (((gy, gx), (gy, gx + 1), (gy + 1, gx + 1)), ((gy, gx), (gy + 1, gx + 1), (gy + 1, gx))):
                a, b, c = (moved[j][i] for j, i in tri)
                sa, sb, sc = (grid[j][i] for j, i in tri)
                den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
                if abs(den) < 1e-9:
                    continue
                x0, x1 = int(math.floor(min(a[0], b[0], c[0]))), int(math.ceil(max(a[0], b[0], c[0])))
                y0, y1 = int(math.floor(min(a[1], b[1], c[1]))), int(math.ceil(max(a[1], b[1], c[1])))
                for y in range(y0, y1 + 1):
                    for x in range(x0, x1 + 1):
                        u = ((b[1] - c[1]) * (x + .5 - c[0]) + (c[0] - b[0]) * (y + .5 - c[1])) / den
                        v = ((c[1] - a[1]) * (x + .5 - c[0]) + (a[0] - c[0]) * (y + .5 - c[1])) / den
                        q = 1 - u - v
                        if u < -1e-6 or v < -1e-6 or q < -1e-6:
                            continue
                        sx, sy = int(u * sa[0] + v * sb[0] + q * sc[0]), int(u * sa[1] + v * sb[1] + q * sc[1])
                        if 0 <= sx < w and 0 <= sy < h and 0 <= x + pad < out.width and 0 <= y + pad < out.height:
                            pixel = src[sx, sy]
                            if pixel[3]:
                                dst[x + pad, y + pad] = pixel
    # The bat turns with the hands as one piece.
    ax, ay = anchor[0] * w, anchor[1] * h
    qx, qy = forward(ax, ay)
    turn = angle * arc_weight(ay, h)
    c, s = math.cos(turn), math.sin(turn)
    whole = image.load()
    corners = [(bat_rect[0], bat_rect[1]), (bat_rect[2], bat_rect[1]), (bat_rect[2], bat_rect[3]), (bat_rect[0], bat_rect[3])]
    placed = [(qx + c * (x - ax) - s * (y - ay), qy + s * (x - ax) + c * (y - ay)) for x, y in corners]
    for y in range(int(min(p[1] for p in placed)) - 1, int(max(p[1] for p in placed)) + 2):
        for x in range(int(min(p[0] for p in placed)) - 1, int(max(p[0] for p in placed)) + 2):
            dx, dy = x + .5 - qx, y + .5 - qy
            sx, sy = int(ax + c * dx + s * dy), int(ay - s * dx + c * dy)
            if bat_rect[0] <= sx < bat_rect[2] and bat_rect[1] <= sy < bat_rect[3] and 0 <= x + pad < out.width and 0 <= y + pad < out.height:
                pixel = whole[sx, sy]
                if pixel[3]:
                    dst[x + pad, y + pad] = pixel
    return out


ARC_WORK_SIDE = 520   # bend at this size: the bank keeps at most 256 pixels a side, so nothing finer survives
for who, (path, standing, faces_right, pivot, bat_box, anchor) in ARC_SETS.items():
    source = Image.open(path).convert("RGBA")
    base_crop = crop_of(path)
    if standing is None:
        standing = base_crop.height / LOTSO_BAT["swing"]
    shrink = ARC_WORK_SIDE / max(source.size)
    work = source.resize((round(source.width * shrink), round(source.height * shrink)), Image.NEAREST)
    if not faces_right:
        work = ImageOps.mirror(work)
        pivot, anchor = (1 - pivot[0], pivot[1]), (1 - anchor[0], anchor[1])
        bat_box = (1 - bat_box[2], bat_box[1], 1 - bat_box[0], bat_box[3])
    for height, lift in (("-high", -1), ("", 0), ("-low", 1)):
        for course, reach in (("-in", -1), ("", 0), ("-out", 1)):
            if not lift and not reach:
                continue
            bent = arc_picture(work, pivot, bat_box, anchor, reach * ARC_REACH * work.width, lift * ARC_LIFT * work.height)
            if not faces_right:
                bent = ImageOps.mirror(bent)
            crop = crop_of_image(bent)
            name = f"bat/mound/2{height}{course}"
            store(f"{who}/{name}", f"arc:{who}:{height or '-middle'}{course or '-middle'}", path, "OWNER_ADOPTED_2026-11-03", crop,
                  crop.height / shrink / standing, f"{who}/{name}", {"arc": {"lift": lift, "reach": reach}})
# Art for a player facing the camera or carrying a glove: front and rear only, never the rejected side views.
LOCO = os.path.join(gen, "locomotion-four-directions-v1", "sprites")
FORWARD = os.path.join(gen, "b2-forward-run-v1", "sprites")
for gait, base, gear, view in (("run", FORWARD, "bare", "front"), ("run", FORWARD, "glove", "front"), ("run", FORWARD, "glove", "rear"), ("walk", LOCO, "bare", "front")):
    for frame, phase in enumerate("AB"):
        source_id = f"{gait}:{gear}:{view}:{phase}"
        name = f"{gait}/{'glove-' if gear == 'glove' else ''}{view}/{frame}"
        path = os.path.join(base, f"b2_{gait}_{gear}_{view}_{phase}.png")
        store(name, source_id, path, "OWNER_UNREJECTED", crop_of(path), .98, name.rsplit("/", 1)[0])
        if gear == "bare" and "b2:" + source_id in afro_by_catalog:   # the DH never carries a glove
            dedicate("chinsuke", name, *afro_by_catalog["b2:" + source_id], .98, "b2:" + source_id)
        beard = lotso_special.get(f"loco-{gait}-{gear}-{view}-{phase}")
        if beard:
            dedicate("lotso", name, *beard, .98, "purple-beard:" + source_id)
for view in ("front", "rear"):
    for frame, phase in enumerate("AB"):
        path = os.path.join(LOCO, f"robin_run_glove_{view}_{phase}.png")
        store(f"robin/run/{view}/{frame}", f"robin:run:glove:{view}:{phase}", path, "ROBIN_OWN", crop_of(path), .98, f"robin/run/{view}")
# Walking to base: the beard set's bare rear walk (the direct-rear walk redraw is UNRESOLVED).
for i, name in enumerate(("loco-walk-bare-rear-A", "loco-walk-bare-rear-B")):
    if lotso_special[name][1] in ("CANDIDATE", "OWNER_ADOPTED"):
        dedicate("lotso", f"walk/rear/{i}", lotso_special[name][0], lotso_special[name][1], .98, "purple-beard:" + name)

body = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "art-bank-runtime.js"), encoding="utf-8").read()
pack_js = ",".join(f'{json.dumps(k)}:{{id:{json.dumps(v["id"])},referenceHeight:{v["referenceHeight"]},footX:{v["footX"]},data:"@@ASSET:{v["asset"]}@@"' + (f',grip:{json.dumps(v["grip"])}' if "grip" in v else '') + '}' for k, v in out.items())
with open(os.path.join(game, "parts", "art-bank-v1.js"), "w", encoding="utf-8", newline="") as f:
    f.write(body.replace("/*ART_PACK*/", pack_js))
manifest = json.load(open(os.path.join(game, "manifest.json")))
names = [e["file"] for e in manifest["entries"]]
if "art-bank-v1.js" not in names:
    i = names.index("032-script.js")
    with open(os.path.join(game, "parts", "art-bank-shell.html"), "w", encoding="utf-8", newline="") as f:
        f.write('</script>\n<script id="art-bank-v1">')
    manifest["entries"][i + 1:i + 1] = [{"kind": "shell", "file": "art-bank-shell.html"}, {"kind": "js", "file": "art-bank-v1.js"}]
    json.dump(manifest, open(os.path.join(game, "manifest.json"), "w"), indent=0)
print("sprites", len(out), "bytes", sum(v["bytes"] for v in out.values()))
if sources_path:
    json.dump({"sprites": sources, "familyStandingHeight": family_S}, open(sources_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
if gallery_path:
    # Every sprite at the size the game draws a 1.8 m player: a quick check that poses keep their proportions.
    PPM, cell_w, cell_h, cols = 110, 250, 280, 8
    sheet = Image.new("RGB", (cols * cell_w, ((len(out) + cols - 1) // cols) * cell_h), (60, 90, 60))
    draw = ImageDraw.Draw(sheet)
    for n, (key, row) in enumerate(out.items()):
        s = PPM * 1.8 / row["referenceHeight"]
        im = row["small"].resize((max(1, round(row["small"].width * s)), max(1, round(row["small"].height * s))), Image.NEAREST)
        x, y = (n % cols) * cell_w, (n // cols) * cell_h
        draw.line((x, y + cell_h - 20, x + cell_w, y + cell_h - 20), fill=(30, 50, 30))
        draw.line((x + 4, y + cell_h - 20 - PPM * 1.8, x + 4, y + cell_h - 20), fill=(255, 255, 0))
        sheet.paste(im, (x + cell_w // 2 - round(row["footX"] * s), y + cell_h - 20 - im.height), im)
        draw.text((x + 8, y + 2), key[:34], fill=(255, 255, 255))
    sheet.save(gallery_path)
