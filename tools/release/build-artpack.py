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
ANCHOR_FOOT = ("swing/", "pitch/", "pickoff/", "liner/", "bat/", "catch/", "catchx/", "umpire/", "ground/", "throw/", "fly/", "backhand/", "robin/pitch", "robin/pickoff", "robin/ground", "robin/throw")
ANCHOR_BODY = ("run/", "walk/", "look/", "robin/run")


def anchor_x(name, small, height):
    # A player's own set and the Dragons' kits sit in the same slots as the generic art.
    key = re.sub(r"^(lotso/|chinsuke/|tbd/(home|away)/(\d-[bp]\d/)?)", "", name)
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
# ---- batting for everyone without a set of their own: the body without a bat, holding the Core's real bat ----
# The owner approved the probe on 2026-11-03 (output/b2-form-01-motion-probe). Frames 1-3 are the batless sheet, two by
# two; the follow-through is the normal one, arms high, that the owner asked for. The registration below is the probe's
# own (body.cjs: box, foot, grip, hip line, torso core), in the source pictures' pixels. The pictures are drawn as a
# left-handed batter seen from the pitcher. Nothing is redrawn: each frame is cut out as it is.
PROBE = os.path.join(root, "output", "b2-form-01-motion-probe")
BODY_FRAMES = (
    ("b2-form01-body-only-v2.png", (0, 0, 602, 653), (387.704, 226.860), 339, (240, 262, 315, 339), 517),
    ("b2-form01-body-only-v2.png", (602, 0, 1204, 653), (950.723, 262.636), 336, (835, 270, 910, 336), 517),
    ("b2-form01-body-only-v2.png", (0, 653, 602, 1306), (362.337, 917.077), 994, (240, 860, 305, 994), 517),
    ("b2-form01-normal-follow-body-v1.png", (0, 0, 1075, 1463), (442, 461), 820, (620, 550, 760, 815), 1167),
)


def crop_box(image):
    """The alpha box crop_of_image would cut, so a point on the picture can follow the crop."""
    alpha = image.getchannel("A")
    hist = alpha.histogram()
    if sum(hist[224:]) and sum(hist[96:224]) > .09 * sum(hist[224:]):
        alpha = alpha.point(lambda a: a if a >= 224 else 0)
    return alpha.point(lambda a: 255 if a > 24 else 0).getbbox()


def bend_rig(box, scale, grip, pivot, top, bottom, faces=1, bat=None):
    """How the runtime may bend this picture so its hands reach the Core's grip, in the packed picture's pixels: the
    hands, the hip it turns about, the band where the turn fades from all (above top) to nothing (below bottom), and which
    way the batter faces on the picture (1: screen right). A drawn bat (its box) turns rigidly with the hands."""
    to = lambda x, y: (round((x - box[0]) * scale, 1), round((y - box[1]) * scale, 1))
    rig = {"grip": to(*grip), "pivot": to(*pivot), "top": to(0, top)[1], "bottom": to(0, bottom)[1], "faces": faces}
    if bat:
        rig["bat"] = (*to(bat[0], bat[1]), *to(bat[2], bat[3]))
    return rig


for i, (file, region, grip, hip, torso, standing) in enumerate(BODY_FRAMES):
    picture = Image.open(os.path.join(PROBE, file)).convert("RGBA").crop(region)
    box = crop_box(picture)
    crop = crop_of_image(picture)
    name = f"body/mound/{i}"
    store(name, f"{file}:{i}", os.path.join(PROBE, file), "OWNER_ADOPTED_2026-11-03", crop, crop.height / standing, name)
    scale = MAX_SIDE / max(crop.size)
    local = (grip[0] - region[0], grip[1] - region[1])
    hip_y, foot_y = hip - region[1], box[3]
    out[name]["grip"] = (round((local[0] - box[0]) * scale, 1), round((local[1] - box[1]) * scale, 1))
    out[name]["bend"] = bend_rig(box, scale, local, ((torso[0] + torso[2]) / 2 - region[0], hip_y),
                                 hip_y - .14 * (foot_y - box[1]), hip_y + .6 * (foot_y - hip_y))

# ---- ちんすけ and ロッツォ bend at impact toward the ball ----
# The owner's probe (output/b2-defense-motion-probe/afro-redraw/height/height.js), approved 2026-11-03 for both: the
# impact frame turns about the hip, fully above the waist and fading out by the knees; the legs never move. Their own
# pictures carry a drawn bat, which turns with the body. Points are fractions of each source picture.
for who, path, faces, pivot, hands, bat in (("chinsuke", afro_batting["swing"][0], 1, (.33, .54), (.62, .55), (.64, .44, 1, .80)),
                                                   ("lotso", lotso_special["swing"][0], -1, (.65, .52), (.47, .45), (0, .39, .44, .57))):
    picture = Image.open(path).convert("RGBA")
    w, h = picture.size
    box = crop_box(picture)
    scale = MAX_SIDE / max(box[2] - box[0], box[3] - box[1])
    out[f"{who}/bat/mound/2"]["bend"] = bend_rig(box, scale, (hands[0] * w, hands[1] * h), (pivot[0] * w, pivot[1] * h), .48 * h, .84 * h, faces,
                                                (bat[0] * w, bat[1] * h, bat[2] * w, bat[3] * h))

# ---- the swing: every batter is drawn with the bat of the art, which follows the Core's bat ----
# The owner's decision (2026-11-06, docs/ai-continuity/DESIGN-2026-11-06-swing-drawing.md): the body and bat of the adopted
# art, the upper body turning with the bat about the hip. The owner then asked for the bat to be its own piece, so the game's
# bat length and the player's height both show: each frame is split into the body (the bat taken out and the body behind
# it filled from either side) and the bat as the art drew it, which the runtime stretches along its axis to the bat's
# length and turns rigidly with the hands. Nothing is redrawn: both pieces are the frame's own pixels.
# Points are in the source picture's pixels: grip (between the hands), tip (end of the barrel), hip (belt centre, the
# turn's pivot); cut = share of grip-to-tip still held in the hands (it stays with the body); radius = the bat's half width
# with its outline. B2 form 1 is drawn as a left-handed batter seen from the pitcher, like the batless body. The impact
# frames come from the height sheet, because the canonical third frame's barrel is cut off by its cell; the follow-throughs
# from the matching height sheet, so impact and follow share one drawing. Standing height in source pixels: the canonical
# frames as the batless body (517), the sheets from the cap width against the canonical frame.
B2_ART = os.path.join(art, "assets", "batting")
REF1, REF2 = (os.path.join(B2_ART, f"b2-form-01-reference_frame-{n}__original__original.png") for n in ("1_cf9081", "2_0f110e"))
SHEET3 = os.path.join(B2_ART, "b2-form-01-height-v1_frame-3-heights_1e3ce7__original__original.png")
SHEET4 = os.path.join(B2_ART, "b2-form-01-height-v1_frame-4-heights_53e966__original__original.png")
# key, picture, region, standing (source px) or None for the dedicated slot's own ratio, grip, tip, hip, cut, radius, faces
SWING_FRAMES = [
    ("swing/mound/0", REF1, None, 517, (474.6, 309.8), (290.0, 22.6), (294.5, 429), .12, 25, 1),
    ("swing/mound/1", REF2, None, 517, (388.8, 315.7), (287.3, 30.8), (237.5, 429), .06, 23, 1),
    ("swing/mound/2/high", SHEET3, (0, 0, 800, 724), 628, (508.5, 246.8), (745.8, 179.3), (390.5, 345), .06, 30, 1),
    ("swing/mound/2/middle", SHEET3, (800, 0, 1420, 724), 628, (1128.2, 303.8), (1376.0, 361.5), (1015.5, 351), .06, 31, 1),
    ("swing/mound/2/low", SHEET3, (1420, 0, 2172, 724), 628, (1741.1, 363.8), (1988.2, 503.2), (1626.5, 362), .06, 31, 1),
    ("swing/mound/3/high", SHEET4, (0, 0, 598, 887), 677, (277.9, 238.7), (75.5, 24.4), (402.5, 484), .06, 27, 1),
    ("swing/mound/3/middle", SHEET4, (598, 0, 1164, 887), 677, (838.9, 329.4), (632.8, 111.2), (962.0, 515), .06, 27, 1),
    ("swing/mound/3/low", SHEET4, (1164, 0, 1774, 887), 677, (1422.0, 466.4), (1206.6, 284.7), (1538.5, 541), .06, 26, 1),
    # ちんすけ (afro set, drawn left-handed like B2) and ロッツォ (beard set, facing screen left): one impact and one follow each.
    ("chinsuke/swing/mound/0", afro_batting["stance"][0], None, None, (735, 660), (548, 20), (390, 935), .06, 44, 1),
    ("chinsuke/swing/mound/1", afro_batting["load"][0], None, None, (620, 610), (250, 20), (340, 1000), .1, 44, 1),
    ("chinsuke/swing/mound/2/middle", afro_batting["swing"][0], None, None, (650, 680), (1205, 912), (300, 670), .06, 44, 1),
    ("chinsuke/swing/mound/3/middle", afro_batting["follow"][0], None, None, (440, 420), (100, 12), (610, 800), .06, 44, 1),
    ("lotso/swing/mound/0", lotso_special["stance"][0], None, None, (240, 100), (1000, 205), (520, 790), .12, 50, -1),
    ("lotso/swing/mound/1", lotso_special["load"][0], None, None, (320, 320), (578, 15), (560, 860), .06, 50, -1),
    ("lotso/swing/mound/2/middle", lotso_special["swing"][0], None, None, (450, 660), (22, 792), (680, 780), .06, 50, -1),
    ("lotso/swing/mound/3/middle", lotso_special["follow"][0], None, None, (690, 330), (935, 40), (360, 790), .06, 50, -1),
]
SWING_STATUS = {"swing/": "ADOPTED", "chinsuke/": "OWNER_ADOPTED", "lotso/": "OWNER_ADOPTED"}


def split_bat(picture, grip, tip, cut, radius):
    """The frame as two pictures of the same size: the body with the bat taken out, and the bat alone, and the bat's axis
    refitted to its pixels. The bat grows from its core (inked pixels near the axis, past the hands) through pixels of the
    core's own colours or the dark outline, never farther than 1.8 radii from the axis. Where the bat crossed the body,
    the body is filled from the nearer side across the bat; where it crossed the background, it is left open."""
    px = picture.load()
    w, h = picture.size
    dx, dy = tip[0] - grip[0], tip[1] - grip[1]
    length = (dx * dx + dy * dy) ** .5
    ux, uy = dx / length, dy / length
    along = lambda x, y: ((x - grip[0]) * ux + (y - grip[1]) * uy, -(x - grip[0]) * uy + (y - grip[1]) * ux)
    inked = lambda c: c[3] >= 96 and not (c[0] > 175 and c[1] > 175 and c[2] > 160) and not (c[2] > c[0] + 60 and c[2] > c[1] + 20)
    span = 1.8 * radius
    x0, x1 = max(0, int(min(grip[0], tip[0]) - span - 2)), min(w, int(max(grip[0], tip[0]) + span + 3))
    y0, y1 = max(0, int(min(grip[1], tip[1]) - span - 2)), min(h, int(max(grip[1], tip[1]) + span + 3))
    core, colors = [], {}
    for y in range(y0, y1):
        for x in range(x0, x1):
            t, q = along(x, y)
            if cut * length + radius < t < length and abs(q) < .7 * radius and inked(px[x, y]):
                core.append((x, y))
                key = tuple(v // 24 for v in px[x, y][:3])
                colors[key] = colors.get(key, 0) + 1
    # The core's colours, any shade near them, and the darker shading and outline (no blue: that is the uniform).
    palette = [tuple(v * 24 + 12 for v in k) for k, n in colors.items() if n >= .01 * len(core)]
    allowed = lambda c: inked(c) and (any(max(abs(a - b) for a, b in zip(c, p)) <= 60 for p in palette) or sum(c[:3]) < 330)
    # The art is dots with clear gaps between them: the growth may cross a gap of a few pixels, never more.
    is_bat, seen, todo = set(core), {p: 0 for p in core}, [(x, y, 0) for x, y in core]
    while todo:
        x, y, gap = todo.pop()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if not (x0 <= nx < x1 and y0 <= ny < y1):
                continue
            t, q = along(nx, ny)
            # Next to the hands only the bat's own width: the fingers and forearms are the body's.
            limit = span if t > cut * length + radius else radius
            if not (cut * length < t < length + span and abs(q) < limit):
                continue
            c = px[nx, ny]
            step = 0 if allowed(c) else gap + 1 if c[3] < 96 else 99
            if step > 4 or seen.get((nx, ny), 99) <= step:
                continue
            seen[(nx, ny)] = step
            if step == 0:
                is_bat.add((nx, ny))
            todo.append((nx, ny, step))
    # The axis refitted to the bat's pixels: the grip stays where the hands hold it, moved onto the axis.
    n = len(is_bat)
    mx, my = sum(x for x, y in is_bat) / n, sum(y for x, y in is_bat) / n
    sxx = sum((x - mx) ** 2 for x, y in is_bat) / n
    syy = sum((y - my) ** 2 for x, y in is_bat) / n
    sxy = sum((x - mx) * (y - my) for x, y in is_bat) / n
    angle = .5 * math.atan2(2 * sxy, sxx - syy)
    vx, vy = math.cos(angle), math.sin(angle)
    if vx * ux + vy * uy < 0:
        vx, vy = -vx, -vy
    g = (grip[0] - mx) * vx + (grip[1] - my) * vy
    far = max((x - mx) * vx + (y - my) * vy for x, y in is_bat)
    grip, tip = (mx + vx * g, my + vy * g), (mx + vx * far, my + vy * far)
    body, bat = picture.copy(), Image.new("RGBA", picture.size, (0, 0, 0, 0))
    bpx, tpx = body.load(), bat.load()
    for x, y in is_bat:
        tpx[x, y] = px[x, y]
        found = []
        for side in (1, -1):
            for step in range(1, int(3 * radius)):
                sx, sy = round(x - side * vy * step), round(y + side * vx * step)
                if not (0 <= sx < w and 0 <= sy < h) or px[sx, sy][3] < 96:
                    break
                if (sx, sy) not in is_bat:
                    found.append((step, px[sx, sy]))
                    break
        bpx[x, y] = min(found)[1] if len(found) == 2 else (0, 0, 0, 0)
    return body, bat, grip, tip


def unhaze(image):
    """The alpha cut crop_of_image makes, kept on the picture so both pieces share it."""
    hist = image.getchannel("A").histogram()
    if sum(hist[224:]) and sum(hist[96:224]) > .09 * sum(hist[224:]):
        image.putalpha(image.getchannel("A").point(lambda a: a if a >= 224 else 0))
    return image


for key, path, region, standing, grip, tip, hip, cut, radius, faces in SWING_FRAMES:
    picture = Image.open(path).convert("RGBA")
    if region:
        picture = picture.crop(region)
        grip, tip, hip = ((p[0] - region[0], p[1] - region[1]) for p in (grip, tip, hip))
    picture = unhaze(picture)
    box = picture.getchannel("A").point(lambda a: 255 if a > 24 else 0).getbbox()
    body, bat, grip, tip = split_bat(picture, grip, tip, cut, radius)
    who = key.split("/")[0] if not key.startswith("swing/") else None
    slot = key.split("/", 1)[1] if who else key
    scale = MAX_SIDE / max(box[2] - box[0], box[3] - box[1])
    # A player's own pose is the same picture as his bat/mound/<frame> and keeps its standing height.
    ratio = (box[3] - box[1]) / standing if standing else (box[3] - box[1]) * scale / out[f"{who}/bat/mound/{slot.split('/')[2]}"]["referenceHeight"]
    status = next(v for k, v in SWING_STATUS.items() if key.startswith(k))
    rel = os.path.relpath(path, root).replace("\\", "/")
    store(key, f"{rel}:{region or 'whole'}", path, status, body.crop(box), ratio, key)
    bat_key = key.replace("swing/", "swingbat/")
    store(bat_key, f"{rel}:{region or 'whole'}:bat", path, status, bat.crop(box), ratio, key)
    out[bat_key]["footX"] = out[key]["footX"]
    to =lambda p: (round((p[0] - box[0]) * scale, 1), round((p[1] - box[1]) * scale, 1))
    foot_y = box[3]
    out[key]["swing"] = {"grip": to(grip), "tip": to(tip), "pivot": to(hip), "cut": cut, "faces": faces,
                         "top": to((0, hip[1] - .14 * (foot_y - box[1])))[1], "bottom": to((0, hip[1] + .6 * (foot_y - hip[1])))[1]}
# ---- the Tambov Dragons' home and away uniforms ----
# Rendered by tools/release/render-tbd-kits.cjs with the owner's uniform compositor (tbd-uniform-integration in the
# drawing folder) onto the same catalog poses the generic slots use. The home kit is owner-adopted (2026-10-29); the
# owner asked for both kits in the match on 2026-11-04. A pose that shows the back has one picture per player.
KITS = os.path.join(game, "assets", "tbd-kits")
if os.path.isdir(KITS):
    kit_sources = json.load(open(os.path.join(KITS, "sources.json"), encoding="utf-8"))
    rendered = {s["id"]: s["back"] for s in kit_sources["sources"]}
    for key, (entry_id, kit, ratio) in list(wanted.items()):
        if kit != "home" or entry_id not in rendered:
            continue
        for tbd in ("home", "away"):
            base = f"{tbd}__{re.sub(r'[:/]', '_', entry_id)}"
            for player in ([None] + kit_sources["players"] if rendered[entry_id] else [None]):
                path = os.path.join(KITS, base + (f"__{player}" if player else "") + ".png")
                name = f"tbd/{tbd}/" + (f"{player}/" if player else "") + key
                store(name, entry_id, path, "OWNER_ADOPTED_HOME_2026-10-29_BOTH_IN_MATCH_2026-11-04", crop_of(path), ratio_of(key), name, {"kit": tbd})

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
pack_js = ",".join(f'{json.dumps(k)}:{{id:{json.dumps(v["id"])},referenceHeight:{v["referenceHeight"]},footX:{v["footX"]},data:"@@ASSET:{v["asset"]}@@"' + (f',grip:{json.dumps(v["grip"])}' if "grip" in v else '') + (f',bend:{json.dumps(v["bend"])}' if "bend" in v else '') + (f',swing:{json.dumps(v["swing"])}' if "swing" in v else '') + '}' for k, v in out.items())
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
