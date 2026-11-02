
"use strict";
(() => {
  // tools/ballpark-studio/niikura-scoreboard.mjs
  function defaultNiikuraScoreboard() {
    return {
      version: 1,
      inning: 5,
      half: "top",
      portrait: true,
      monitors: true,
      lineups: [
        [["\u68EE\u7530", "8"], ["\u8FD1\u85E4", "4"], ["\u30CB\u30C3\u30C1\u30ED\u30FC", "9"], ["\u5C71\u5D0E", "3"], ["\u6E21\u8FBA", "D"], ["\u4E2D\u6751", "7"], ["\u5C0F\u5DDD", "5"], ["\u7530\u4E2D", "2"], ["\u85E4\u539F", "6"]],
        [["\u4F50\u85E4", "8"], ["\u9234\u6728", "6"], ["\u9AD8\u6A4B", "9"], ["\u5C71\u7530", "3"], ["\u4F0A\u85E4", "D"], ["\u4E2D\u5CF6", "7"], ["\u52A0\u85E4", "5"], ["\u5409\u7530", "2"], ["\u677E\u672C", "4"]]
      ].map((team) => team.map(([name, position]) => ({ name, position }))),
      batter: { name: "\u30CB\u30C3\u30C1\u30ED\u30FC", number: 51, average: 0.315, homeRuns: 18, rbis: 62, salaryManYen: 125e3 },
      pitcher: { pitchCount: 64, era: 2.35 }
    };
  }
  function formatSalaryManYen(n) {
    if (n === 0) return "0\u4E07\u5186";
    const cho = Math.floor(n / 1e8), oku = Math.floor(n % 1e8 / 1e4), man = n % 1e4;
    return (cho ? cho + "\u5146" : "") + (oku ? oku + "\u5104" : "") + (man ? man + "\u4E07" : "") + "\u5186";
  }
  function validateNiikuraScoreboard(s, error, path = "architecture.scoreboard.niikura") {
    const object2 = (o, keys, p) => {
      if (!o || typeof o !== "object" || Array.isArray(o)) {
        error(p, "\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        return false;
      }
      for (const k2 of Object.keys(o)) if (!keys.includes(k2)) error(p + "." + k2, "\u672A\u5BFE\u5FDC\u306E\u8868\u793A\u9805\u76EE\u3067\u3059");
      return true;
    }, number = (v, min, max, p, integer = false) => {
      if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || integer && !Number.isInteger(v)) error(p, `${min}\u301C${max}\u306E${integer ? "\u6574\u6570" : "\u6570\u5024"}\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044`);
    }, name = (v, p) => {
      if (typeof v !== "string" || !v.trim() || v.length > 12 || /[\x00-\x1f<>]/.test(v)) error(p, "\u8868\u793A\u540D\u306F1\u301C12\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    };
    if (!object2(s, ["version", "inning", "half", "portrait", "monitors", "lineups", "batter", "pitcher"], path)) return;
    if (s.version !== 1) error(path + ".version", "\u8868\u793A\u8A2D\u5B9A\u306Eversion\u306F1\u3067\u3059");
    number(s.inning, 1, 99, path + ".inning", true);
    if (!["top", "bottom"].includes(s.half)) error(path + ".half", "\u8868\u304B\u88CF\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    if (s.monitors !== void 0 && typeof s.monitors !== "boolean") error(path + ".monitors", "\u30E2\u30CB\u30BF\u30FC\u306E\u8868\u793A\u6709\u7121\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    if (typeof s.portrait !== "boolean") error(path + ".portrait", "\u9854\u5199\u771F\u306E\u8868\u793A\u6709\u7121\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    if (!Array.isArray(s.lineups) || s.lineups.length !== 2) error(path + ".lineups", "2\u30C1\u30FC\u30E0\u306E\u6253\u9806\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    else s.lineups.forEach((team, i) => {
      const p = path + ".lineups." + i;
      if (!Array.isArray(team) || team.length !== 9) {
        error(p, "\u6253\u9806\u306F9\u4EBA\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        return;
      }
      team.forEach((v, j) => {
        const at = p + "." + j;
        if (object2(v, ["name", "position"], at)) {
          name(v.name, at + ".name");
          if (!/^[1-9D]$/.test(v.position) || typeof v.position !== "string") error(at + ".position", "\u5B88\u5099\u306F1\u301C9\u307E\u305F\u306FD\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        }
      });
    });
    if (object2(s.batter, ["name", "number", "average", "homeRuns", "rbis", "salaryManYen"], path + ".batter")) {
      const p = path + ".batter";
      name(s.batter.name, p + ".name");
      number(s.batter.number, 0, 999, p + ".number", true);
      number(s.batter.average, 0, 1, p + ".average");
      for (const k2 of ["homeRuns", "rbis"]) number(s.batter[k2], 0, 999, p + "." + k2, true);
      number(s.batter.salaryManYen, 0, 999999999, p + ".salaryManYen", true);
    }
    if (object2(s.pitcher, ["pitchCount", "era"], path + ".pitcher")) {
      number(s.pitcher.pitchCount, 0, 999, path + ".pitcher.pitchCount", true);
      number(s.pitcher.era, 0, 99.99, path + ".pitcher.era");
    }
  }

  // tools/ballpark-studio/camera-presets.mjs
  var CAMERA_VIEWS = Object.freeze(["effects", "stadium", "exterior", "outfield", "entrance", "interior", "scoreboard", "overhead", "mound-detail", "backnet", "catcher", "mound", "batter", "fielder"]);
  var object = (v) => v && typeof v === "object" && !Array.isArray(v);
  var DEG = 180 / Math.PI;
  function validateCameraViews(views, error, path = "cameraViews") {
    if (!object(views)) {
      error(path, "\u8996\u70B9\u3054\u3068\u306E\u8A2D\u5B9A\u3092\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    for (const [key, p] of Object.entries(views)) {
      const at = path + "." + key;
      if (!CAMERA_VIEWS.includes(key)) {
        error(at, "\u767B\u9332\u3067\u304D\u306A\u3044\u8996\u70B9\u3067\u3059");
        continue;
      }
      if (!object(p)) {
        error(at, "\u30AB\u30E1\u30E9\u8A2D\u5B9A\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        continue;
      }
      for (const field of Object.keys(p)) if (!["eye", "yawDegrees", "pitchDegrees", "zoom", "f", "cx", "cy", "roofCutaway"].includes(field)) error(at + "." + field, "\u30AB\u30E1\u30E9\u306E\u767B\u9332\u9805\u76EE\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
      const number = (v, min, max, suffix) => {
        if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) error(at + "." + suffix, `${min}\u301C${max}\u306E\u6570\u5024\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044`);
      };
      if (!object(p.eye)) error(at + ".eye", "\u30AB\u30E1\u30E9\u306E\u4F4D\u7F6E\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      else {
        for (const k2 of Object.keys(p.eye)) if (!["x", "y", "z"].includes(k2)) error(at + ".eye." + k2, "\u4F4D\u7F6E\u306Fx\u30FBy\u30FBz\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        number(p.eye.x, -2e3, 2e3, "eye.x");
        number(p.eye.y, 0.1, 1500, "eye.y");
        number(p.eye.z, -2e3, 2e3, "eye.z");
      }
      for (const [k2, min, max] of [["yawDegrees", -180, 180], ["pitchDegrees", -89.9, 89.9], ["zoom", 0.4, 2.5], ["f", 10, 4e3], ["cx", -600, 1200], ["cy", -432, 864]]) number(p[k2], min, max, k2);
      if (typeof p.roofCutaway !== "boolean") error(at + ".roofCutaway", "\u5C4B\u6839\u7701\u7565\u306Ftrue/false\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  }

  // tools/ballpark-studio/niikura-infield.mjs
  function cubicPoint(a, b, c, d, t) {
    const s = 1 - t;
    return { x: s * s * s * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t * t * t * d.x, z: s * s * s * a.z + 3 * s * s * t * b.z + 3 * s * t * t * c.z + t * t * t * d.z };
  }
  function controls(back, side, pole, t) {
    const k2 = Math.min(side * 0.45, back * 0.8);
    return t <= 0.5 ? [[{ x: 0, z: -back }, { x: side * 0.55, z: -back }, { x: side - k2, z: -k2 }, { x: side, z: 0 }], t * 2] : [[{ x: side, z: 0 }, { x: side + 24, z: 24 }, { x: pole.x + side * 0.7, z: pole.z - 10 }, pole], (t - 0.5) * 2];
  }
  function niikuraFoulPoint(back, side, pole, t) {
    const [p, s] = controls(back, side, pole, t);
    return cubicPoint(...p, s);
  }
  function niikuraFoulNodes(d) {
    const back = d.foul.backstopMeters, points = [];
    for (const sign of [-1, 1]) {
      const pole = d.fencePoints.find((p) => p.id === (sign < 0 ? "LF" : "RF")), a = Math.abs(pole.angleDegrees) * Math.PI / 180, end = { x: Math.sin(a) * pole.distanceMeters, z: Math.cos(a) * pole.distanceMeters }, side = sign < 0 ? d.foul.thirdSideMeters : d.foul.firstSideMeters;
      for (let i = 0; i < 64; i++) {
        const p = niikuraFoulPoint(back, side, end, i / 64), angleDegrees = i === 0 ? sign * 180 : Math.atan2(sign * p.x, p.z) * 180 / Math.PI;
        points.push({ id: i === 0 ? "BACK" : i === 32 ? sign < 0 ? "THIRD_SIDE" : "FIRST_SIDE" : "NIIKURA_FOUL_" + sign + "_" + i, angleDegrees, distanceMeters: Math.hypot(p.x, p.z), heightMeters: d.foul.heightMeters });
      }
    }
    return points;
  }
  function niikuraFoulSeatPoint(g, u, sideSign) {
    const back = g.vertices.find((p2) => p2.id === "BACK").distanceMeters, side = g.vertices.find((p2) => p2.id === (sideSign < 0 ? "THIRD_SIDE" : "FIRST_SIDE")).distanceMeters, pole = g.fencePoints.find((p2) => p2.id === (sideSign < 0 ? "LF" : "RF")), t = u <= 1 / 12 ? u * 6 : 0.5 + (u - 1 / 12) * 3.6, [control, s] = controls(back, side, { x: Math.abs(pole.x), z: pole.z }, t), p = cubicPoint(...control, s), [a, b, c, d] = control, dx = 3 * (1 - s) ** 2 * (b.x - a.x) + 6 * (1 - s) * s * (c.x - b.x) + 3 * s * s * (d.x - c.x), dz = 3 * (1 - s) ** 2 * (b.z - a.z) + 6 * (1 - s) * s * (c.z - b.z) + 3 * s * s * (d.z - c.z), n = Math.hypot(dx, dz);
    return { x: sideSign * (p.x + dz / n * 0.5), z: p.z - dx / n * 0.5 };
  }

  // tools/ballpark-studio/real-park-infield.mjs
  var cubic = (a, b, c, d, t) => {
    const s = 1 - t;
    return { x: s ** 3 * a.x + 3 * s * s * t * b.x + 3 * s * t * t * c.x + t ** 3 * d.x, z: s ** 3 * a.z + 3 * s * s * t * b.z + 3 * s * t * t * c.z + t ** 3 * d.z };
  };
  function controls2(back, side, pole) {
    const k2 = Math.min(back * 0.55, side * 0.35), slope = (pole.x - side) / pole.z;
    return [{ x: 0, z: -back }, { x: side * 0.55228475, z: -back }, { x: side - k2 * slope, z: -k2 }, { x: side, z: 0 }];
  }
  function cubicTangent([a, b, c, d], t) {
    const s = 1 - t;
    return { x: 3 * s * s * (b.x - a.x) + 6 * s * t * (c.x - b.x) + 3 * t * t * (d.x - c.x), z: 3 * s * s * (b.z - a.z) + 6 * s * t * (c.z - b.z) + 3 * t * t * (d.z - c.z) };
  }
  function backCurve(back, side, pole, t, style) {
    if (style !== "koshien") {
      const c2 = controls2(back, side, pole);
      return { p: cubic(...c2, t), d: cubicTangent(c2, t) };
    }
    const ellipse = (s2) => ({ x: side * Math.sin(s2 * Math.PI / 2), z: -back * Math.cos(s2 * Math.PI / 2) }), tangent = (s2) => ({ x: side * Math.cos(s2 * Math.PI / 2) * Math.PI / 2, z: back * Math.sin(s2 * Math.PI / 2) * Math.PI / 2 });
    if (t <= 0.75) return { p: ellipse(t), d: tangent(t) };
    const a = ellipse(0.75), b = { x: side, z: 0 }, da = tangent(0.75), dz = back * Math.PI / 2, slope = (pole.x - side) / pole.z, c = [a, { x: a.x + da.x / 12, z: a.z + da.z / 12 }, { x: b.x - slope * dz / 12, z: -dz / 12 }, b], s = (t - 0.75) * 4;
    return { p: cubic(...c, s), d: cubicTangent(c, s) };
  }
  var defaults = { dodger_stadium: { back: 23, first: 24, third: 24, pole: 330 * 0.3048 / Math.SQRT2 }, koshien: { back: 18.4, first: 28, third: 28, pole: 95 / Math.SQRT2 } };
  function parameters(g, style, sign) {
    const d = defaults[style], back = g?.vertices.find((p2) => p2.id === "BACK")?.distanceMeters ?? d.back, side = g?.vertices.find((p2) => p2.id === (sign < 0 ? "THIRD_SIDE" : "FIRST_SIDE"))?.distanceMeters ?? (sign < 0 ? d.third : d.first), p = g?.fencePoints.find((p2) => p2.id === (sign < 0 ? "LF" : "RF"));
    return { back, side, pole: p ? { x: Math.abs(p.x), z: p.z } : { x: d.pole, z: d.pole } };
  }
  function realParkFoulNodes(foul, fencePoints, style = "dodger_stadium") {
    const nodes = [];
    for (const sign of [-1, 1]) {
      const p = fencePoints.find((p2) => p2.id === (sign < 0 ? "LF" : "RF")), r = Math.abs(p.angleDegrees) * Math.PI / 180, pole = { x: Math.sin(r) * p.distanceMeters, z: Math.cos(r) * p.distanceMeters }, side = sign < 0 ? foul.thirdSideMeters : foul.firstSideMeters;
      for (let i = 0; i <= 32; i++) {
        const q = backCurve(foul.backstopMeters, side, pole, i / 32, style).p;
        nodes.push({ id: i === 0 ? "BACK" : i === 32 ? sign < 0 ? "THIRD_SIDE" : "FIRST_SIDE" : "REAL_PARK_FOUL_" + sign + "_" + i, angleDegrees: i === 0 ? sign * 180 : i === 32 ? sign * 90 : Math.atan2(sign * q.x, q.z) * 180 / Math.PI, distanceMeters: Math.hypot(q.x, q.z), heightMeters: foul.heightMeters });
      }
    }
    return nodes;
  }
  function backSeat(p, t, clearance, sign, style) {
    const c = backCurve(p.back, p.side, p.pole, t, style), q = c.p, { x: dx, z: dz } = c.d, n = Math.hypot(dx, dz);
    return { x: sign * (q.x + clearance * dz / n), z: q.z - clearance * dx / n };
  }
  function realParkSeatRim(g, style, u, legacy) {
    const k2 = style === "koshien", v = k2 ? Math.min(u, 1 - u) : Math.abs(u - 0.5), sign = k2 ? u <= 0.5 ? -1 : 1 : u >= 0.5 ? 1 : -1, sideU = k2 ? 2 / 14 : 0.18, start = k2 ? 3 / 14 : 0.32, end = k2 ? 4 / 14 : 0.46, clearance = k2 ? 1.2 : 0.3, nearZ = k2 ? 35 : 25, toLegacy = (t) => k2 ? sign < 0 ? t : 1 - t : 0.5 + sign * t;
    if (v >= end) return legacy(u);
    const p = parameters(g, style, sign);
    if (v <= sideU) return backSeat(p, v / sideU, clearance, sign, style);
    const slope = (p.pole.x - p.side) / p.pole.z, n = Math.hypot(1, slope), line = (z) => ({ x: sign * (p.side + slope * z + clearance / n), z: z - clearance * slope / n });
    if (v <= start) return line(nearZ * (v - sideU) / (start - sideU));
    const a = line(nearZ), b = legacy(toLegacy(end)), next = legacy(toLegacy(end + 1e-5)), span = end - start, dz = nearZ / (start - sideU), c1 = { x: a.x + sign * slope * dz * span / 3, z: a.z + dz * span / 3 }, c2 = { x: b.x - (next.x - b.x) / 1e-5 * span / 3, z: b.z - (next.z - b.z) / 1e-5 * span / 3 };
    return cubic(a, c1, c2, b, (v - start) / span);
  }

  // tools/ballpark-studio/paypay-field.mjs
  var rad = (a) => a * Math.PI / 180;
  var smooth = (t) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };
  function paypayPremiumInset(z, poleZ, side) {
    const u = z / poleZ;
    return Math.min(9, side * 0.28) * smooth((u - 0.1) / 0.16) * (1 - smooth((u - 0.48) / 0.52));
  }
  function paypayTerraceWidth(theta) {
    const a = Math.abs(theta) * 180 / Math.PI;
    return 4.5 * smooth((a - 6) / 10) * smooth((45 - a) / 8);
  }
  function paypayFoulPoint(foul, pole, sign, t, premium = true) {
    const side = sign < 0 ? foul.thirdSideMeters : foul.firstSideMeters;
    if (t <= 0) {
      const u = t + 1, s = 1 - u, k2 = Math.min(foul.backstopMeters * 0.55, side * 0.35), slope = (pole.x - side) / pole.z, a = { x: 0, z: -foul.backstopMeters }, b = { x: side * 0.62, z: -foul.backstopMeters }, c = { x: side - k2 * slope, z: -k2 }, d = { x: side, z: 0 };
      return { x: sign * (s ** 3 * a.x + 3 * s * s * u * b.x + 3 * s * u * u * c.x + u ** 3 * d.x), z: s ** 3 * a.z + 3 * s * s * u * b.z + 3 * s * u * u * c.z + u ** 3 * d.z };
    }
    const z = t * pole.z, x = side + (pole.x - side) * t - (premium ? paypayPremiumInset(z, pole.z, side) : 0);
    return { x: sign * x, z };
  }
  function paypayFoulNodes(foul, fencePoints, premium = true) {
    const nodes = [];
    for (const sign of [-1, 1]) {
      const a = fencePoints.find((p) => p.id === (sign < 0 ? "LF" : "RF")), angle = Math.abs(rad(a.angleDegrees)), pole = { x: Math.sin(angle) * a.distanceMeters, z: Math.cos(angle) * a.distanceMeters };
      for (let i = 0; i <= 64; i++) {
        const t = i / 32 - 1, p = paypayFoulPoint(foul, pole, sign, t, premium);
        nodes.push({ id: i === 0 ? "BACK" : i === 32 ? sign < 0 ? "THIRD_SIDE" : "FIRST_SIDE" : "PAYPAY_FOUL_" + sign + "_" + i, angleDegrees: i === 0 ? sign * 180 : i === 32 ? sign * 90 : Math.atan2(p.x, p.z) * 180 / Math.PI, distanceMeters: Math.hypot(p.x, p.z), heightMeters: foul.heightMeters });
      }
    }
    return nodes.filter((p) => Math.abs(p.angleDegrees) > 45 + 1e-5);
  }
  function paypayFoulParameters(g) {
    return { foul: { firstSideMeters: g.vertices.find((p) => p.id === "FIRST_SIDE").distanceMeters, thirdSideMeters: g.vertices.find((p) => p.id === "THIRD_SIDE").distanceMeters, backstopMeters: g.vertices.find((p) => p.id === "BACK").distanceMeters, heightMeters: g.vertices.find((p) => p.id === "BACK").heightMeters }, pole: (sign) => {
      const p = g.fencePoints.find((p2) => p2.id === (sign < 0 ? "LF" : "RF"));
      return { x: Math.abs(p.x), z: p.z };
    } };
  }

  // tools/ballpark-studio/scoreboard-field.mjs
  var DEFENDER_ROLES = Object.freeze([
    { role: "P", label: "\u6295\u624B", x: 0, z: 18.4404 },
    { role: "C", label: "\u6355\u624B", x: 0, z: -3 },
    { role: "1B", label: "\u4E00\u5841", x: 27, z: 25 },
    { role: "2B", label: "\u4E8C\u5841", x: 13, z: 40 },
    { role: "3B", label: "\u4E09\u5841", x: -27, z: 25 },
    { role: "SS", label: "\u904A\u6483", x: -13, z: 40 },
    { role: "LF", label: "\u5DE6\u7FFC", x: -53, z: 92 },
    { role: "CF", label: "\u4E2D\u5805", x: 0, z: 108 },
    { role: "RF", label: "\u53F3\u7FFC", x: 53, z: 92 }
  ].map(Object.freeze));
  var YES = Object.freeze({ fieldDiagram: true });
  var NO = Object.freeze({ fieldDiagram: false });
  var scoreboardCapabilities = (style) => ["koshien", "niikura_dome", "fukuoka_dome"].includes(style) ? YES : NO;
  var defaultFieldDiagram = () => ({ version: 1, enabled: true, defenders: DEFENDER_ROLES.map((p) => ({ ...p })), runners: { first: false, second: false, third: false } });
  function scoreboardFieldDiagram(architecture) {
    return scoreboardCapabilities(architecture?.style).fieldDiagram ? architecture.scoreboard?.fieldDiagram ?? defaultFieldDiagram() : null;
  }
  function validateFieldDiagram(f, error, path = "architecture.scoreboard.fieldDiagram") {
    const object2 = (v, keys, p) => {
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        error(p, "\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        return false;
      }
      for (const k2 of Object.keys(v)) if (!keys.includes(k2)) error(p + "." + k2, "\u672A\u5BFE\u5FDC\u306E\u5B88\u5099\u56F3\u9805\u76EE\u3067\u3059");
      return true;
    };
    if (!object2(f, ["version", "enabled", "defenders", "runners"], path)) return;
    if (f.version !== 1) error(path + ".version", "\u5B88\u5099\u56F3\u306Eversion\u306F1\u3067\u3059");
    if (typeof f.enabled !== "boolean") error(path + ".enabled", "\u5B88\u5099\u56F3\u306E\u8868\u793A\u6709\u7121\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    if (!Array.isArray(f.defenders) || f.defenders.length !== 9) error(path + ".defenders", "\uFF19\u5B88\u5099\u4F4D\u7F6E\u3092\u305D\u308C\u305E\u308C\uFF11\u3064\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    else {
      const seen = /* @__PURE__ */ new Set();
      f.defenders.forEach((p, i) => {
        const at = path + ".defenders." + i;
        if (!object2(p, ["role", "label", "x", "z"], at)) return;
        if (!DEFENDER_ROLES.some((d) => d.role === p.role) || seen.has(p.role)) error(at + ".role", "\u5B88\u5099\u4F4D\u7F6E\u304C\u4E0D\u6B63\u307E\u305F\u306F\u91CD\u8907\u3057\u3066\u3044\u307E\u3059");
        seen.add(p.role);
        if (typeof p.label !== "string" || !p.label.trim() || p.label.length > 12 || /[\x00-\x1f<>]/.test(p.label)) error(at + ".label", "\u8868\u793A\u540D\u306F1\u301C12\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        for (const k2 of ["x", "z"]) if (typeof p[k2] !== "number" || !Number.isFinite(p[k2]) || p[k2] < -300 || p[k2] > 300) error(at + "." + k2, "\u5EA7\u6A19\u306F\u2212300\u301C300m\u306E\u6570\u5024\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      });
    }
    if (object2(f.runners, ["first", "second", "third"], path + ".runners")) {
      for (const k2 of ["first", "second", "third"]) if (typeof f.runners[k2] !== "boolean") error(path + ".runners." + k2, "\u8D70\u8005\u306E\u6709\u7121\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  }
  function projectFieldDiagramPoint(p) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.z)) return null;
    const a = Math.abs(p.x), x = Math.sign(p.x) * (a <= 30 ? a * 3.2 : 96 + (a - 30) * 0.9), y = p.z <= 40 ? 510 - p.z * 3.8 : 358 - (p.z - 40) * 1.2;
    return { u: Math.max(0.04, Math.min(0.96, 0.5 + x / 400)), v: Math.max(0.04, Math.min(0.96, (y - 250) / 300)) };
  }
  var SCOREBOARD_BASES = Object.freeze([
    { id: "first", label: "\u4E00\u5841", x: 19.397, z: 19.397 },
    { id: "second", label: "\u4E8C\u5841", x: 0, z: 38.794 },
    { id: "third", label: "\u4E09\u5841", x: -19.397, z: 19.397 }
  ].map(Object.freeze));

  // tools/ballpark-studio/paypay-scoreboard.mjs
  function defaultPaypayScoreboard() {
    const positions = ["8", "4", "9", "3", "5", "D", "7", "2", "6"];
    return { version: 1, inning: 5, half: "top", pitchCount: 64, lineups: [0, 1].map(() => positions.map((position, i) => ({ name: i + 1 + "\u756A\u6253\u8005", position }))) };
  }
  function validatePaypayScoreboard(s, error, path = "architecture.scoreboard.paypay") {
    if (!s || typeof s !== "object" || Array.isArray(s)) {
      error(path, "\u8868\u793A\u8A2D\u5B9A\u3092\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    for (const key of Object.keys(s)) if (!["version", "inning", "half", "pitchCount", "lineups"].includes(key)) error(path + "." + key, "\u672A\u5BFE\u5FDC\u306E\u8868\u793A\u9805\u76EE\u3067\u3059");
    if (s.version !== 1) error(path + ".version", "\u8868\u793A\u8A2D\u5B9A\u306Eversion\u306F1\u3067\u3059");
    for (const [key, min, max] of [["inning", 1, 99], ["pitchCount", 0, 999]]) if (!Number.isInteger(s[key]) || s[key] < min || s[key] > max) error(path + "." + key, `${min}\u301C${max}\u306E\u6574\u6570\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044`);
    if (!["top", "bottom"].includes(s.half)) error(path + ".half", "\u8868\u304B\u88CF\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    if (!Array.isArray(s.lineups) || s.lineups.length !== 2) {
      error(path + ".lineups", "2\u30C1\u30FC\u30E0\u306E\u6253\u9806\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      return;
    }
    s.lineups.forEach((team, t) => {
      const p = path + ".lineups." + t;
      if (!Array.isArray(team) || team.length !== 9) {
        error(p, "\u6253\u9806\u306F9\u4EBA\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        return;
      }
      team.forEach((v, i) => {
        const at = p + "." + i;
        if (!v || typeof v !== "object" || Array.isArray(v)) {
          error(at, "\u540D\u524D\u3068\u5B88\u5099\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
          return;
        }
        for (const k2 of Object.keys(v)) if (!["name", "position"].includes(k2)) error(at + "." + k2, "\u672A\u5BFE\u5FDC\u306E\u9805\u76EE\u3067\u3059");
        if (typeof v.name !== "string" || !v.name.trim() || v.name.length > 12 || /[\x00-\x1f<>]/.test(v.name)) error(at + ".name", "\u540D\u524D\u306F1\u301C12\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        if (typeof v.position !== "string" || !/^[1-9D]$/.test(v.position)) error(at + ".position", "\u5B88\u5099\u306F1\u301C9\u307E\u305F\u306FD\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      });
    });
  }

  // tools/ballpark-studio/texture-filter.mjs
  function mipPyramid(source, strength = (data, i) => data[i + 3] / 255) {
    const levels = [{ ...source, strength }];
    let previous = levels[0];
    while (previous.width > 1 || previous.height > 1) {
      const width = Math.ceil(previous.width / 2), height = Math.ceil(previous.height / 2), data = new Uint8ClampedArray(width * height * 4);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        let alpha = 0, r = 0, g = 0, b = 0, count = 0;
        for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
          const sx = x * 2 + ox, sy = y * 2 + oy;
          if (sx >= previous.width || sy >= previous.height) continue;
          const i2 = (sy * previous.width + sx) * 4, a = previous.strength ? previous.strength(previous.data, i2) : previous.data[i2 + 3] / 255;
          count++;
          alpha += a;
          r += previous.data[i2] * a;
          g += previous.data[i2 + 1] * a;
          b += previous.data[i2 + 2] * a;
        }
        const i = (y * width + x) * 4;
        if (alpha > 0) {
          data[i] = r / alpha;
          data[i + 1] = g / alpha;
          data[i + 2] = b / alpha;
        }
        data[i + 3] = alpha / count * 255;
      }
      previous = { width, height, data };
      levels.push(previous);
    }
    return levels;
  }
  function bilinear(level, u, v) {
    const px = u * level.width - 0.5, py = v * level.height - 0.5, x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
    let r = 0, g = 0, b = 0, a = 0;
    for (let oy = 0; oy < 2; oy++) for (let ox = 0; ox < 2; ox++) {
      const x = Math.max(0, Math.min(level.width - 1, x0 + ox)), y = Math.max(0, Math.min(level.height - 1, y0 + oy)), i = (y * level.width + x) * 4, weight = (ox ? fx : 1 - fx) * (oy ? fy : 1 - fy), alpha = (level.strength ? level.strength(level.data, i) : level.data[i + 3] / 255) * weight;
      a += alpha;
      r += level.data[i] * alpha;
      g += level.data[i + 1] * alpha;
      b += level.data[i + 2] * alpha;
    }
    return { r, g, b, a };
  }
  function sampleMip(levels, u, v, footprintU, footprintV) {
    if (!levels.length || u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    const lod = Math.max(0, Math.min(levels.length - 1, Math.log2(Math.max(1, levels[0].width * footprintU, levels[0].height * footprintV)))), low = Math.floor(lod), t = lod - low, p = bilinear(levels[low], u, v), q = bilinear(levels[Math.min(low + 1, levels.length - 1)], u, v), a = p.a * (1 - t) + q.a * t;
    if (a < 1 / 1024) return null;
    return { r: (p.r * (1 - t) + q.r * t) / a, g: (p.g * (1 - t) + q.g * t) / a, b: (p.b * (1 - t) + q.b * t) / a, a, lod };
  }

  // tools/ballpark-studio/scoreboard.mjs
  function defaultScoreboard() {
    return { enabled: true, teams: [
      { name: "TBD", innings: [0, 0, 1, 0, 0, 2, 0, 1, 0], hits: 8, errors: 0 },
      { name: "LAD", innings: [1, 0, 0, 0, 0, 0, 1, 0, 0], hits: 6, errors: 1 }
    ], balls: 3, strikes: 2, outs: 2, speedKmh: 148 };
  }
  var runs = (team) => team.innings.reduce((n, v) => n + (v ?? 0), 0);
  function validateScoreboard(s, error) {
    const path = "architecture.scoreboard", object2 = (o, keys, p) => {
      if (!o || typeof o !== "object" || Array.isArray(o)) {
        error(p, "\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        return false;
      }
      for (const k2 of Object.keys(o)) if (!keys.includes(k2)) error(p + "." + k2, "\u672A\u5BFE\u5FDC\u306E\u8868\u793A\u9805\u76EE\u3067\u3059");
      return true;
    }, integer = (v, min, max, p) => {
      if (!Number.isInteger(v) || v < min || v > max) error(p, `${min}\u301C${max}\u306E\u6574\u6570\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044`);
    };
    if (!object2(s, ["enabled", "teams", "balls", "strikes", "outs", "speedKmh", "fieldDiagram", "niikura", "paypay"], path)) return;
    if (s.paypay !== void 0) validatePaypayScoreboard(s.paypay, error);
    if (s.niikura !== void 0) validateNiikuraScoreboard(s.niikura, error);
    if (s.fieldDiagram !== void 0) validateFieldDiagram(s.fieldDiagram, error, path + ".fieldDiagram");
    if (typeof s.enabled !== "boolean") error(path + ".enabled", "\u8868\u793A\u306E\u6709\u7121\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    if (!Array.isArray(s.teams) || s.teams.length !== 2) error(path + ".teams", "2\u30C1\u30FC\u30E0\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    else s.teams.forEach((t, i) => {
      const p = path + ".teams." + i;
      if (!object2(t, ["name", "innings", "hits", "errors"], p)) return;
      if (typeof t.name !== "string" || t.name.trim().length < 1 || t.name.length > 12 || /[\x00-\x1f<>]/.test(t.name)) error(p + ".name", "\u30C1\u30FC\u30E0\u540D\u306F1\u301C12\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      if (!Array.isArray(t.innings) || t.innings.length !== 9) error(p + ".innings", "1\u301C9\u56DE\u306E9\u500B\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      else t.innings.forEach((v, j) => {
        if (v !== null) integer(v, 0, 99, p + ".innings." + j);
      });
      integer(t.hits, 0, 999, p + ".hits");
      integer(t.errors, 0, 99, p + ".errors");
    });
    for (const [k2, max] of [["balls", 3], ["strikes", 2], ["outs", 2]]) integer(s[k2], 0, max, path + "." + k2);
    if (typeof s.speedKmh !== "number" || !Number.isFinite(s.speedKmh) || s.speedKmh < 0 || s.speedKmh > 300) error(path + ".speedKmh", "0\u301C300\u306E\u6570\u5024\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
  }
  var cache = /* @__PURE__ */ new WeakMap();
  function texture(g, part) {
    if (typeof document === "undefined") return null;
    let entry = cache.get(g);
    if (!entry) {
      entry = {};
      cache.set(g, entry);
    }
    if (entry[part]) return entry[part];
    const s = g.architecture.scoreboard ?? defaultScoreboard(), c = g.architecture.colors, canvas = document.createElement("canvas");
    canvas.width = 1792;
    canvas.height = part === "scoreboard-title" ? 96 : 256;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#0b182b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const text = (value, x, y, width, size = 50, color = "#ffe5a1") => {
      ctx.font = `700 ${size}px monospace`;
      const measured = ctx.measureText(String(value)).width;
      if (measured > width) ctx.font = `700 ${Math.max(14, size * width / measured)}px monospace`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeText(String(value), x, y);
      ctx.fillText(String(value), x, y);
    }, line = (x0, y0, x1, y1) => {
      ctx.strokeStyle = c.gold;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };
    if (part === "scoreboard-title") {
      text("TAMBOV DRAGONS", 896, 49, 1300, 55, c.gold);
      for (const sign of [-1, 1]) {
        const x = 896 + sign * 720;
        line(x - 14, 49, x, 35);
        line(x, 35, x + 14, 49);
        line(x + 14, 49, x, 63);
        line(x, 63, x - 14, 49);
      }
    } else {
      const start = 198, cell = 98;
      [...Array.from({ length: 9 }, (_, i) => String(i + 1)), "R", "H", "E"].forEach((v, i) => text(v, start + (i + 0.5) * cell, 40, 80, 40));
      for (let row = 0; row < 2; row++) {
        const t = s.teams[row], y = 119 + row * 83;
        text(t.name, 98, y, 172, 52);
        [...t.innings, runs(t), t.hits, t.errors].forEach((v, i) => text(v === null ? "" : v, start + (i + 0.5) * cell, y, 82, 52));
      }
      for (const y of [76, 160, 246]) line(10, y, 1376, y);
      for (const x of [188, 1080, 1376, 1582]) line(x, 8, x, 248);
      [["B", s.balls, 3, "#84dc76"], ["S", s.strikes, 2, "#f2be50"], ["O", s.outs, 2, "#ee6564"]].forEach(([name, count, max, color], row) => {
        const y = 48 + row * 79;
        text(name, 1407, y, 42, 43);
        for (let i = 0; i < max; i++) {
          ctx.fillStyle = i < count ? color : "#243042";
          ctx.beginPath();
          ctx.arc(1463 + i * 38, y, 12, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      text(Number(s.speedKmh.toFixed(1)), 1682, 109, 176, 58);
      text("km/h", 1682, 182, 160, 31);
    }
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    entry[part] = mipPyramid({ width: canvas.width, height: canvas.height, data });
    return entry[part];
  }
  function sampleScoreboard(g, part, u, v, profile) {
    const levels = texture(g, part);
    if (!levels) return null;
    const s = sampleMip(levels, u, 1 - v, profile.footprintU * 0.88, profile.footprintV * 0.88);
    if (!s) return null;
    return { color: "#" + [s.r, s.g, s.b].map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join(""), logoGlow: 0.12 * Math.max(0, (Math.max(s.r, s.g, s.b) - 40) / 215) };
  }

  // tools/ballpark-studio/stadium-effects.mjs
  function validateEffects(e, error) {
    const fields = (o, keys, path) => {
      if (!o || typeof o !== "object" || Array.isArray(o)) {
        error(path, "\u6F14\u51FA\u8A2D\u5B9A\u3092\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        return false;
      }
      for (const k2 of Object.keys(o)) if (!keys.includes(k2)) error(path + "." + k2, "\u5BFE\u5FDC\u3057\u3066\u3044\u306A\u3044\u6F14\u51FA\u9805\u76EE\u3067\u3059");
      return true;
    }, number = (v, min, max, path) => {
      if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) error(path, `${min}\u301C${max}\u306E\u6570\u5024\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044`);
    }, color = (c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c), root = "architecture.effects";
    if (!fields(e, ["version", "lighting", "fireworks", "environment"], root)) return;
    if (e.version !== 1) error(root + ".version", "\u5BFE\u5FDC\u3057\u3066\u3044\u306A\u3044\u6F14\u51FA\u8A2D\u5B9A\u306E\u7248\u3067\u3059");
    if (e.environment !== void 0 && fields(e.environment, ["period", "weather", "flags", "wind"], root + ".environment")) {
      if (!["day", "night"].includes(e.environment.period)) error(root + ".environment.period", "\u663C\u304B\u591C\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      if (!["clear", "cloudy"].includes(e.environment.weather)) error(root + ".environment.weather", "\u6674\u308C\u304B\u66C7\u308A\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      if (typeof e.environment.flags !== "boolean") error(root + ".environment.flags", "\u65D7\u306E\u52D5\u4F5C\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      if (e.environment.wind !== void 0 && fields(e.environment.wind, ["directionDegrees", "speedMps"], root + ".environment.wind")) {
        number(e.environment.wind.directionDegrees, 0, 359, root + ".environment.wind.directionDegrees");
        number(e.environment.wind.speedMps, 0, 30, root + ".environment.wind.speedMps");
      }
    }
    if (fields(e.lighting, ["enabled", "brightness", "color"], root + ".lighting")) {
      if (typeof e.lighting.enabled !== "boolean") error(root + ".lighting.enabled", "\u7167\u660E\u306E\u70B9\u706F\u72B6\u614B\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      number(e.lighting.brightness, 0, 2.5, root + ".lighting.brightness");
      if (!color(e.lighting.color)) error(root + ".lighting.color", "\u8272\u306F # \u30686\u6841\u306E16\u9032\u6570\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    if (fields(e.fireworks, ["enabled", "autoHomeRun", "colors", "x", "z", "height", "size", "variation"], root + ".fireworks")) {
      const f = e.fireworks;
      for (const k2 of ["enabled", "autoHomeRun"]) if (typeof f[k2] !== "boolean") error(root + ".fireworks." + k2, "\u6709\u52B9\u30FB\u7121\u52B9\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      if (!Array.isArray(f.colors) || f.colors.length !== 2 || !f.colors.every(color)) error(root + ".fireworks.colors", "6\u6841\u306E16\u9032\u6570\u306E\u8272\u30922\u3064\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      for (const [k2, min, max] of [["x", -350, 350], ["z", -150, 500], ["height", 40, 180], ["size", 5, 35]]) number(f[k2], min, max, root + ".fireworks." + k2);
      if (f.variation !== void 0) number(f.variation, 0, 1, root + ".fireworks.variation");
    }
  }
  var neutralLighting = (l) => !l || l.enabled && l.brightness === 1 && l.color.toLowerCase() === "#ffffff";
  var directions = Array.from({ length: 48 }, (_, i) => {
    const y = 1 - 2 * (i + 0.5) / 48, r = Math.sqrt(1 - y * y), a = i * 2.399963229728653;
    return { x: r * Math.cos(a), y, z: r * Math.sin(a) };
  });

  // tools/ballpark-studio/architecture.mjs
  function russianArchitecture() {
    return {
      version: 1,
      style: "russian_dome",
      capacity: 12e4,
      tiers: 5,
      colors: { red: "#b72e3d", blue: "#254f9a", gold: "#d6ae4d" },
      roof: { type: "retractable", openingPercent: 100 },
      details: { factor: 6, logos: true, ornaments: true },
      scoreboard: defaultScoreboard(),
      logo: { enabled: true, detail: "fine", widthMeters: 28, centerZ: 82, brightness: 0.8, glow: 0.3 },
      surfaceDetail: { factor: 6, marginMeters: 0.6, featherMeters: 0.8 },
      crowd: { density: 0.75, detail: "simple", size: 1, brightness: 1, glow: 0.7, attendance: "full" }
    };
  }
  function validateArchitecture(a, error) {
    const fields = (o, keys, path) => {
      if (!o || typeof o !== "object" || Array.isArray(o)) {
        error(path, "\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        return false;
      }
      for (const k2 of Object.keys(o)) if (!keys.includes(k2)) error(path + "." + k2, "\u3053\u306E\u5EFA\u7BC9\u9805\u76EE\u306F\u7DE8\u96C6\u3067\u304D\u307E\u305B\u3093");
      return true;
    }, number = (v, min, max, path) => {
      if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max) error(path, `${min}\u301C${max}\u306E\u6570\u5024\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044`);
    };
    if (!fields(a, ["version", "style", "capacity", "tiers", "colors", "roof", "logo", "surfaceDetail", "crowd", "details", "scoreboard", "atmosphere", "effects"], "architecture")) return;
    if (a.effects !== void 0) validateEffects(a.effects, error);
    if (a.version !== 1) error("architecture.version", "\u5BFE\u5FDC\u3057\u3066\u3044\u306A\u3044\u5EFA\u7BC9\u8A2D\u5B9A\u306E\u7248\u3067\u3059");
    if (!["russian_dome", "dodger_stadium", "koshien", "niikura_dome", "fukuoka_dome"].includes(a.style)) error("architecture.style", "\u5BFE\u5FDC\u3057\u3066\u3044\u306A\u3044\u5EFA\u7BC9\u5F62\u5F0F\u3067\u3059");
    if (a.atmosphere !== void 0 && fields(a.atmosphere, ["period", "strength"], "architecture.atmosphere")) {
      if (!["day", "night"].includes(a.atmosphere.period)) error("architecture.atmosphere.period", "\u663C\u304B\u591C\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
      number(a.atmosphere.strength, 0, 1, "architecture.atmosphere.strength");
    }
    number(a.capacity, 1e3, 25e4, "architecture.capacity");
    if (!Number.isInteger(a.capacity)) error("architecture.capacity", "\u5B9A\u54E1\u306F\u6574\u6570\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    number(a.tiers, a.style === "niikura_dome" ? 2 : 3, a.style === "niikura_dome" ? 2 : 6, "architecture.tiers");
    if (!Number.isInteger(a.tiers)) error("architecture.tiers", "\u968E\u5C64\u6570\u306F\u6574\u6570\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    if (fields(a.colors, ["red", "blue", "gold"], "architecture.colors")) {
      for (const k2 of ["red", "blue", "gold"]) if (typeof a.colors[k2] !== "string" || !/^#[0-9a-f]{6}$/i.test(a.colors[k2])) error("architecture.colors." + k2, "\u8272\u306F # \u30686\u6841\u306E16\u9032\u6570\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    if (fields(a.roof, ["type", "openingPercent"], "architecture.roof")) {
      const type = ["dodger_stadium", "koshien", "niikura_dome"].includes(a.style) ? "open" : "retractable";
      if (a.roof.type !== type) error("architecture.roof.type", type === "open" ? "\u3053\u306E\u7403\u5834\u306F\u5C4B\u5916\u3067\u3059" : "\u5C4B\u6839\u306F retractable \u3067\u3059");
      number(a.roof.openingPercent, 0, 100, "architecture.roof.openingPercent");
      if (type === "open" && a.roof.openingPercent !== 100) error("architecture.roof.openingPercent", "\u5C4B\u5916\u7403\u5834\u306F100\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    if (a.logo !== void 0 && fields(a.logo, ["enabled", "detail", "widthMeters", "centerZ", "brightness", "glow"], "architecture.logo")) {
      if (typeof a.logo.enabled !== "boolean") error("architecture.logo.enabled", "\u8868\u793A\u306E\u6709\u7121\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      if (!["fine", "dots"].includes(a.logo.detail)) error("architecture.logo.detail", "\u7CBE\u5BC6\u8868\u793A\u304B\u5149\u70B9\u8868\u793A\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
      number(a.logo.widthMeters, 10, 40, "architecture.logo.widthMeters");
      number(a.logo.centerZ, 60, 110, "architecture.logo.centerZ");
      if (a.logo.brightness !== void 0) number(a.logo.brightness, 0.5, 3, "architecture.logo.brightness");
      if (a.logo.glow !== void 0) number(a.logo.glow, 0, 1, "architecture.logo.glow");
    }
    if (a.surfaceDetail !== void 0 && fields(a.surfaceDetail, ["factor", "marginMeters", "featherMeters"], "architecture.surfaceDetail")) {
      number(a.surfaceDetail.factor, 2, 8, "architecture.surfaceDetail.factor");
      if (!Number.isInteger(a.surfaceDetail.factor)) error("architecture.surfaceDetail.factor", "\u5BC6\u5EA6\u306E\u500D\u7387\u306F\u6574\u6570\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      number(a.surfaceDetail.marginMeters, 0, 30, "architecture.surfaceDetail.marginMeters");
      number(a.surfaceDetail.featherMeters, 0.1, 20, "architecture.surfaceDetail.featherMeters");
    }
    if (a.scoreboard !== void 0) validateScoreboard(a.scoreboard, error);
    if (a.scoreboard?.niikura !== void 0 && a.style !== "niikura_dome") error("architecture.scoreboard.niikura", "\u3053\u306E\u8868\u793A\u8A2D\u5B9A\u306F\u306B\u30FC\u304F\u3089\u30C9\u30FC\u30E0\u5C02\u7528\u3067\u3059");
    if (a.scoreboard?.fieldDiagram !== void 0 && !scoreboardCapabilities(a.style).fieldDiagram) error("architecture.scoreboard.fieldDiagram", "\u3053\u306E\u7403\u5834\u306E\u8868\u793A\u76E4\u306F\u5B88\u5099\u30FB\u8D70\u8005\u306E\u56F3\u306B\u5BFE\u5FDC\u3057\u3066\u3044\u307E\u305B\u3093");
    if (a.details !== void 0 && fields(a.details, ["factor", "logos", "ornaments"], "architecture.details")) {
      number(a.details.factor, 2, 8, "architecture.details.factor");
      if (!Number.isInteger(a.details.factor)) error("architecture.details.factor", "\u5BC6\u5EA6\u306E\u500D\u7387\u306F\u6574\u6570\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
      for (const k2 of ["logos", "ornaments"]) if (typeof a.details[k2] !== "boolean") error("architecture.details." + k2, "\u8868\u793A\u306E\u6709\u7121\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    if (a.crowd !== void 0 && fields(a.crowd, ["density", "detail", "size", "brightness", "glow", "attendance", "homeColors", "visitorColors"], "architecture.crowd")) {
      for (const key of ["homeColors", "visitorColors"]) if (a.crowd[key] !== void 0) {
        const p = a.crowd[key];
        if (a.style !== "koshien" && !(a.style === "fukuoka_dome" && key === "homeColors")) error("architecture.crowd." + key, "\u3053\u306E\u7403\u5834\u306E\u89B3\u5BA2\u914D\u8272\u306F\u5171\u901A\u8272\u3067\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        if (!Array.isArray(p) || p.length !== 2 || !p.every((c) => typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c))) error("architecture.crowd." + key, "# \u30686\u6841\u306E16\u9032\u6570\u306E\u8272\u30922\u3064\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      }
      number(a.crowd.density, 0.05, 1, "architecture.crowd.density");
      number(a.crowd.size, 0.5, 1.8, "architecture.crowd.size");
      number(a.crowd.brightness, 0.2, 1.5, "architecture.crowd.brightness");
      if (!["lights", "simple", "full"].includes(a.crowd.detail)) error("architecture.crowd.detail", "\u5149\u3060\u3051\u30FB\u7C21\u7D20\u30FB\u8A73\u3057\u304F\u3001\u306E\u3044\u305A\u308C\u304B\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      if (a.crowd.glow !== void 0) number(a.crowd.glow, 0, 1, "architecture.crowd.glow");
      if (a.crowd.attendance !== void 0 && !["full", "empty"].includes(a.crowd.attendance)) error("architecture.crowd.attendance", "\u89B3\u5BA2\u5E2D\u306F\u6E80\u54E1\u304B\u7121\u89B3\u5BA2\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
    }
  }

  // tools/ballpark-studio/koshien-home.mjs
  var KOSHIEN_NET = Object.freeze({ heightMeters: 32, meshSpacingMeters: 0.08, wireAlpha: 0.1, panelCount: 12 });
  var KOSHIEN_BACKSTOP_METERS = 18.4;
  function koshienFoulNodes(foul, fencePoints = [{ id: "LF", angleDegrees: -45, distanceMeters: 95 }, { id: "RF", angleDegrees: 45, distanceMeters: 95 }]) {
    return realParkFoulNodes(foul, fencePoints, "koshien");
  }
  function koshienBowlRim(g) {
    const back = g?.vertices.find((p) => p.id === "BACK")?.distanceMeters ?? KOSHIEN_BACKSTOP_METERS, first = g?.vertices.find((p) => p.id === "FIRST_SIDE")?.distanceMeters ?? 28, third = g?.vertices.find((p) => p.id === "THIRD_SIDE")?.distanceMeters ?? 28;
    return [
      [0, -back - 1.2],
      [-third * 0.74, -back * 0.82],
      [-third - 1.5, 0],
      [-52, 35],
      [-76, 72],
      [-72, 96],
      [-46, 118],
      [0, 126],
      [46, 118],
      [72, 96],
      [76, 72],
      [52, 35],
      [first + 1.5, 0],
      [first * 0.74, -back * 0.82]
    ];
  }

  // tools/ballpark-studio/model.mjs
  var SCHEMA = "kneekura_ballpark_design_v2";
  var LEGACY_SCHEMA = "kneekura_ballpark_design_v1";
  var freeze = (o) => {
    if (o && typeof o === "object") {
      Object.values(o).forEach(freeze);
      Object.freeze(o);
    }
    return o;
  };
  var FIXED = freeze({
    id: "professional_fixed_diamond_v1",
    baseDistanceMeters: 27.432,
    pitcherPlateFrontMeters: 18.4404,
    pitcherPlateHeightMeters: 0.254,
    foulAngleDegrees: 90,
    baseSideMeters: 0.4572,
    homePlateWidthMeters: 0.4318
  });
  var ANCHORS = freeze([
    { id: "LF", angleDegrees: -45, label: "\u5DE6\u7FFC" },
    { id: "LCF", angleDegrees: -22.5, label: "\u5DE6\u4E2D\u9593" },
    { id: "CF", angleDegrees: 0, label: "\u4E2D\u5805" },
    { id: "RCF", angleDegrees: 22.5, label: "\u53F3\u4E2D\u9593" },
    { id: "RF", angleDegrees: 45, label: "\u53F3\u7FFC" }
  ]);
  var LIMITS = freeze({ distanceMin: 76.2, distanceMax: 220, heightMax: 30, maximumPoints: 65 });
  var rad2 = (d) => d * Math.PI / 180;
  var deg = (r) => r * 180 / Math.PI;
  var circle = freeze({ center: { x: 0, z: 37.5 }, radiusMeters: 72.5, heightMeters: 3 });
  function circleAt(theta) {
    const along = circle.center.x * Math.sin(theta) + circle.center.z * Math.cos(theta);
    return along + Math.sqrt(along * along + circle.radiusMeters * circle.radiusMeters - circle.center.x * circle.center.x - circle.center.z * circle.center.z);
  }
  function referenceDesign() {
    return {
      schema: SCHEMA,
      name: "\u73FE\u884C\u7403\u5834",
      mode: "reference_circle",
      ruleset: "obr_general_2026",
      fencePoints: ANCHORS.map((a) => ({ id: a.id, angleDegrees: a.angleDegrees, distanceMeters: circleAt(rad2(a.angleDegrees)), heightMeters: 3 })),
      foul: { firstSideMeters: circleAt(Math.PI / 2), thirdSideMeters: circleAt(-Math.PI / 2), backstopMeters: 35, heightMeters: 3 },
      trackWidthMeters: 3.5
    };
  }
  function symmetricDesign() {
    const d = referenceDesign();
    d.name = "\u5DE6\u53F3\u5BFE\u79F0\u306E\u5BF8\u6CD5\u4F8B";
    d.mode = "editable";
    d.ruleset = "mlb_new_2026";
    d.fencePoints.forEach((p, i) => p.distanceMeters = [100, 116, 122, 116, 100][i]);
    return d;
  }
  function fukuokaDomeDesign() {
    const d = symmetricDesign();
    d.name = "\u307F\u305A\u307BPayPay\u30C9\u30FC\u30E0\u798F\u5CA1";
    d.ruleset = "obr_general_2026";
    d.architecture = { ...russianArchitecture(), style: "fukuoka_dome", capacity: 39894, tiers: 3, colors: { red: "#f0c43c", blue: "#ecebdb", gold: "#d8dcd2" }, roof: { type: "retractable", openingPercent: 0 } };
    d.architecture.logo = { ...d.architecture.logo, enabled: false };
    d.architecture.crowd = { ...d.architecture.crowd, density: 0.65, brightness: 0.8, glow: 0.12 };
    d.architecture.scoreboard.teams[0].name = "HAWKS";
    d.architecture.scoreboard.teams[1].name = "VISITOR";
    d.foul = { firstSideMeters: 32, thirdSideMeters: 32, backstopMeters: 20, heightMeters: 1.2 };
    d.trackWidthMeters = 2;
    d.fencePoints = Array.from({ length: 17 }, (_, i) => {
      const angleDegrees = -45 + i * 5.625, a = ANCHORS.find((a2) => a2.angleDegrees === angleDegrees), u = Math.abs(angleDegrees) / 22.5, j = Math.min(1, Math.floor(u)), t = u - j, values = [122, 110, 100], slopes = [0, -11, -10], distanceMeters = (2 * t ** 3 - 3 * t * t + 1) * values[j] + (t ** 3 - 2 * t * t + t) * slopes[j] + (-2 * t ** 3 + 3 * t * t) * values[j + 1] + (t ** 3 - t * t) * slopes[j + 1];
      return { id: a?.id ?? "PAYPAY_" + i, angleDegrees, distanceMeters, heightMeters: 4.2 };
    });
    return d;
  }
  function inert(raw, depth = 0) {
    if (depth > 10) throw Error("JSON\u306E\u968E\u5C64\u304C\u6DF1\u3059\u304E\u307E\u3059");
    if (raw === null || ["string", "number", "boolean"].includes(typeof raw)) return raw;
    if (typeof raw !== "object") throw Error("JSON\u306E\u5024\u3060\u3051\u3092\u4F7F\u7528\u3057\u3066\u304F\u3060\u3055\u3044");
    const array = Array.isArray(raw), proto = Object.getPrototypeOf(raw);
    if (!array && proto !== Object.prototype && proto !== null) throw Error("\u901A\u5E38\u306EJSON\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u304C\u5FC5\u8981\u3067\u3059");
    const result = array ? [] : {};
    for (const key of Reflect.ownKeys(raw)) {
      if (array && key === "length") continue;
      const d = Object.getOwnPropertyDescriptor(raw, key);
      if (typeof key !== "string" || !d.enumerable || !("value" in d) || ["__proto__", "constructor", "prototype"].includes(key)) throw Error("\u7279\u6B8A\u306A\u30D7\u30ED\u30D1\u30C6\u30A3\u306F\u4F7F\u7528\u3067\u304D\u307E\u305B\u3093");
      result[key] = inert(d.value, depth + 1);
    }
    return result;
  }
  var polar = (angleDegrees, distanceMeters) => ({
    x: angleDegrees === 0 || Math.abs(angleDegrees) === 180 ? 0 : Math.sin(rad2(angleDegrees)) * distanceMeters,
    z: Math.abs(angleDegrees) === 90 ? 0 : Math.cos(rad2(angleDegrees)) * distanceMeters
  });
  var cross = (a, b) => a.x * b.z - a.z * b.x;
  function segmentMinimumDistance(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, den = dx * dx + dz * dz, t = den ? Math.max(0, Math.min(1, -(a.x * dx + a.z * dz) / den)) : 0;
    return Math.hypot(a.x + t * dx, a.z + t * dz);
  }
  function compile(d) {
    const points = [...d.fencePoints].sort((a, b) => a.angleDegrees - b.angleDegrees), nodes = [
      { id: "BACK", angleDegrees: -180, distanceMeters: d.foul.backstopMeters, heightMeters: d.foul.heightMeters },
      { id: "THIRD_SIDE", angleDegrees: -90, distanceMeters: d.foul.thirdSideMeters, heightMeters: d.foul.heightMeters },
      ...points,
      { id: "FIRST_SIDE", angleDegrees: 90, distanceMeters: d.foul.firstSideMeters, heightMeters: d.foul.heightMeters },
      { id: "BACK", angleDegrees: 180, distanceMeters: d.foul.backstopMeters, heightMeters: d.foul.heightMeters }
    ], boundary = d.architecture?.style === "fukuoka_dome" ? [...paypayFoulNodes(d.foul, points), ...points].sort((a, b) => a.angleDegrees - b.angleDegrees) : d.architecture?.style === "niikura_dome" ? [...niikuraFoulNodes(d), ...points].sort((a, b) => a.angleDegrees - b.angleDegrees) : d.architecture?.style === "dodger_stadium" ? [...realParkFoulNodes(d.foul, points), ...points].sort((a, b) => a.angleDegrees - b.angleDegrees) : d.architecture?.style === "koshien" ? [...koshienFoulNodes(d.foul, points), ...points].sort((a, b) => a.angleDegrees - b.angleDegrees) : nodes, vertices = boundary.map((p) => ({ ...p, ...polar(p.angleDegrees, p.distanceMeters) }));
    return freeze({
      version: 1,
      kind: d.mode,
      fixedLayoutId: FIXED.id,
      circle,
      vertices,
      architecture: d.architecture ?? null,
      boundaryKey: JSON.stringify([d.mode, d.fencePoints, d.foul, d.trackWidthMeters, ...d.architecture?.style === "fukuoka_dome" ? ["paypay-field-profile-v1"] : d.architecture?.style === "niikura_dome" ? ["niikura-close-rounded-foul-v1"] : d.architecture?.style === "koshien" ? ["koshien-rounded-foul-v2"] : d.architecture?.style === "dodger_stadium" ? ["dodger-rounded-foul-v1"] : []]),
      surfaceKey: JSON.stringify(d.architecture?.style === "fukuoka_dome" ? [d.architecture.details?.logos !== false, "paypay-ground-ads-v1"] : d.architecture?.style === "koshien" ? [d.architecture.logo ?? null, d.architecture.surfaceDetail ?? null, "koshien"] : d.architecture?.style === "dodger_stadium" ? [d.architecture.logo ?? null, d.architecture.surfaceDetail ?? null, d.architecture.style, d.architecture.details?.logos !== false] : [d.architecture?.logo ?? null, d.architecture?.surfaceDetail ?? null]),
      fencePoints: points.map((p) => ({ ...p, ...polar(p.angleDegrees, p.distanceMeters) })),
      maximumHeightMeters: Math.max(d.foul.heightMeters, ...points.map((p) => p.heightMeters)),
      trackWidthMeters: d.trackWidthMeters
    });
  }
  function wallAt(g, theta) {
    const angle = ((deg(theta) + 180) % 360 + 360) % 360 - 180;
    if (g.kind === "reference_circle") {
      const distance2 = circleAt(theta);
      return { angleDegrees: angle, distanceMeters: distance2, heightMeters: 3, position: polar(deg(theta), distance2), segmentIndex: null };
    }
    const v = g.vertices;
    let lo = 0, hi = v.length - 2;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (v[mid].angleDegrees <= angle) lo = mid;
      else hi = mid - 1;
    }
    const a = v[lo], b = v[lo + 1], direction = { x: Math.sin(rad2(angle)), z: Math.cos(rad2(angle)) }, edge = { x: b.x - a.x, z: b.z - a.z }, den = cross(direction, edge), distance = cross(a, edge) / den, position = { x: direction.x * distance, z: direction.z * distance }, length2 = edge.x * edge.x + edge.z * edge.z, t = Math.max(0, Math.min(1, ((position.x - a.x) * edge.x + (position.z - a.z) * edge.z) / length2));
    return { angleDegrees: angle, distanceMeters: distance, heightMeters: a.heightMeters + (b.heightMeters - a.heightMeters) * t, position, segmentIndex: lo };
  }
  function validateDesign(raw) {
    const errors = [], warnings = [], error = (path, message) => errors.push({ path, message });
    let d;
    try {
      d = inert(raw);
    } catch (e) {
      return { ok: false, errors: [{ path: "json", message: e.message }], warnings, geometry: null };
    }
    const fields = (o, allowed, path) => {
      if (!o || typeof o !== "object" || Array.isArray(o)) {
        error(path, "\u30AA\u30D6\u30B8\u30A7\u30AF\u30C8\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
        return false;
      }
      for (const k2 of Object.keys(o)) if (!allowed.includes(k2)) error(path ? path + "." + k2 : k2, "\u3053\u306E\u9805\u76EE\u306F\u7DE8\u96C6\u3067\u304D\u307E\u305B\u3093\u3002\u5841\u30FB\u767D\u7DDA\u30FB\u6295\u624B\u677F\u306F\u5171\u901A\u56FA\u5B9A\u3067\u3059");
      return true;
    }, number = (n, min, max, path) => {
      if (typeof n !== "number" || !Number.isFinite(n)) {
        error(path, "\u6570\u5024\u3092\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
        return false;
      }
      if (n < min || n > max) {
        error(path, `${min}\u301C${max}\u306E\u7BC4\u56F2\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044`);
        return false;
      }
      return true;
    };
    if (!fields(d, ["schema", "name", "mode", "ruleset", "fencePoints", "foul", "trackWidthMeters", "architecture", "cameraViews"], "")) return { ok: false, errors, warnings, geometry: null };
    if (d.cameraViews !== void 0) validateCameraViews(d.cameraViews, error);
    if (![SCHEMA, LEGACY_SCHEMA].includes(d.schema)) error("schema", "\u7403\u5834\u8A2D\u8A08\u5BA4v1/v2\u306EJSON\u3067\u306F\u3042\u308A\u307E\u305B\u3093");
    if (d.architecture !== void 0) {
      if (d.schema === LEGACY_SCHEMA) error("schema", "\u5EFA\u7BC9\u8A2D\u5B9A\u3092\u542B\u3081\u308B\u5834\u5408\u306Fv2\u306Eschema\u3092\u6307\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044");
      validateArchitecture(d.architecture, error);
    }
    if (typeof d.name !== "string" || !d.name.trim() || d.name.length > 80) error("name", "\u7403\u5834\u540D\u30921\u301C80\u6587\u5B57\u3067\u5165\u529B\u3057\u3066\u304F\u3060\u3055\u3044");
    if (!["reference_circle", "editable"].includes(d.mode)) error("mode", "\u5F62\u72B6\u306F reference_circle \u307E\u305F\u306F editable \u3067\u3059");
    if (!["obr_general_2026", "mlb_new_2026"].includes(d.ruleset)) error("ruleset", "\u78BA\u8A8D\u3059\u308B\u898F\u5247\u3092\u9078\u3093\u3067\u304F\u3060\u3055\u3044");
    number(d.trackWidthMeters, 0, 12, "trackWidthMeters");
    if (fields(d.foul, ["firstSideMeters", "thirdSideMeters", "backstopMeters", "heightMeters"], "foul")) {
      const sideMin = d.architecture?.style === "niikura_dome" ? 8 : 18.288;
      number(d.foul.firstSideMeters, sideMin, 180, "foul.firstSideMeters");
      number(d.foul.thirdSideMeters, sideMin, 180, "foul.thirdSideMeters");
      if (sideMin === 8 && (d.foul.firstSideMeters < 18.288 || d.foul.thirdSideMeters < 18.288)) warnings.push("\u306B\u30FC\u304F\u3089\u30C9\u30FC\u30E0\u306E\u5185\u91CE\u5E2D\u3092\u8FD1\u3065\u3051\u305F\u8A2D\u8A08\u3067\u3059\u3002\u30D5\u30A1\u30A6\u30EB\u5074\u306E\u8DDD\u96E2\u306F\u4E00\u822C\u898F\u5247\u306E\u63A8\u5968\u502418.288m\u3088\u308A\u77ED\u3044\u8A2D\u5B9A\u3067\u3059\u3002");
      number(d.foul.backstopMeters, 8, 100, "foul.backstopMeters");
      number(d.foul.heightMeters, 0, LIMITS.heightMax, "foul.heightMeters");
      if (d.foul.backstopMeters < 18.288) warnings.push("\u30D0\u30C3\u30AF\u30CD\u30C3\u30C8\u307E\u306718.288m\u4EE5\u4E0A\u3068\u3044\u3046\u63A8\u5968\u5024\u3092\u4E0B\u56DE\u308A\u307E\u3059\uFF08OBR2.01\uFF09\u3002");
    }
    if (!Array.isArray(d.fencePoints) || d.fencePoints.length < 5 || d.fencePoints.length > LIMITS.maximumPoints) error("fencePoints", "\u5916\u91CE\u306E\u70B9\u306F5\u301C65\u500B\u306B\u3057\u3066\u304F\u3060\u3055\u3044");
    else {
      const ids = /* @__PURE__ */ new Set(), angles = [];
      d.fencePoints.forEach((p, i) => {
        const path = "fencePoints." + i;
        if (!fields(p, ["id", "angleDegrees", "distanceMeters", "heightMeters"], path)) return;
        if (typeof p.id !== "string" || !/^[_a-zA-Z][_a-zA-Z0-9-]{0,47}$/.test(p.id) || ids.has(p.id)) error(path + ".id", "\u70B9\u306EID\u306F\u91CD\u8907\u3057\u306A\u3044\u82F1\u6570\u5B57\u306B\u3057\u3066\u304F\u3060\u3055\u3044");
        ids.add(p.id);
        number(p.angleDegrees, -45, 45, path + ".angleDegrees");
        number(p.distanceMeters, 76.2, LIMITS.distanceMax, path + ".distanceMeters");
        number(p.heightMeters, 0, LIMITS.heightMax, path + ".heightMeters");
        angles.push(p.angleDegrees);
      });
      for (const a of ANCHORS) {
        const found = d.fencePoints.find((p) => p?.id === a.id);
        if (!found || found.angleDegrees !== a.angleDegrees) error("fencePoints", a.label + "\u306E\u89D2\u5EA6\u3068\u57FA\u6E96\u70B9\u306F\u56FA\u5B9A\u3067\u3059");
      }
      angles.sort((a, b) => a - b);
      if (angles.some((a, i) => i > 0 && a - angles[i - 1] < 1e-3)) error("fencePoints", "\u70B9\u306E\u89D2\u5EA6\u306F0.001\u5EA6\u4EE5\u4E0A\u96E2\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    if (d.mode === "reference_circle") {
      const reference = referenceDesign();
      for (const k2 of ["fencePoints", "foul", "trackWidthMeters"]) if (JSON.stringify(d[k2]) !== JSON.stringify(reference[k2])) error(k2, "\u73FE\u884C\u7403\u5834\u306F\u57FA\u6E96\u5C02\u7528\u3067\u3059\u3002\u5F62\u72B6\u3092\u7DE8\u96C6\u3059\u308B\u5834\u5408\u306F mode \u3092 editable \u306B\u3057\u3066\u304F\u3060\u3055\u3044");
    }
    if (errors.length) return { ok: false, errors, warnings, geometry: null };
    const g = compile(d), point = (id) => d.fencePoints.find((p) => p.id === id), fairMin = g.kind === "reference_circle" ? Math.min(circleAt(-Math.PI / 4), circleAt(Math.PI / 4)) : Math.min(...g.fencePoints.slice(1).map((p, i) => segmentMinimumDistance(g.fencePoints[i], p)));
    if (fairMin < 76.2 - 1e-9) error("fencePoints", "\u70B9\u3068\u70B9\u306E\u9593\u306E\u30D5\u30A7\u30F3\u30B9\u304C\u672C\u5841\u304B\u308976.2m\u672A\u6E80\u3067\u3059\u3002\u6D45\u3044\u89D2\u3092\u5916\u3078\u5E83\u3052\u3066\u304F\u3060\u3055\u3044");
    if (d.ruleset === "mlb_new_2026") {
      for (const id of ["LF", "RF"]) if (point(id).distanceMeters < 99.06) error("fencePoints." + d.fencePoints.indexOf(point(id)) + ".distanceMeters", "MLB\u65B0\u8A2D\u57FA\u6E96\u3067\u306F\u4E21\u7FFC99.06m\u4EE5\u4E0A\u304C\u5FC5\u8981\u3067\u3059");
      if (point("CF").distanceMeters < 121.92) error("fencePoints." + d.fencePoints.indexOf(point("CF")) + ".distanceMeters", "MLB\u65B0\u8A2D\u57FA\u6E96\u3067\u306F\u4E2D\u5805121.92m\u4EE5\u4E0A\u304C\u5FC5\u8981\u3067\u3059");
    } else {
      if (point("LF").distanceMeters < 97.536 || point("RF").distanceMeters < 97.536) warnings.push("\u4E21\u7FFC97.536m\u4EE5\u4E0A\u3068\u3044\u3046\u4E00\u822C\u898F\u5247\u306E\u63A8\u5968\u5024\u3092\u4E0B\u56DE\u308A\u307E\u3059\u3002");
      if (point("CF").distanceMeters < 121.92) warnings.push("\u4E2D\u5805121.92m\u4EE5\u4E0A\u3068\u3044\u3046\u63A8\u5968\u5024\u3092\u4E0B\u56DE\u308A\u307E\u3059\u3002");
    }
    return { ok: errors.length === 0, errors, warnings, geometry: errors.length ? null : g, design: d, fairMinimumDistanceMeters: fairMin };
  }

  // tools/ballpark-studio/crowd-projection.mjs
  var CROWD_METRIC = Object.freeze({ widthMeters: 2.24, depthMeters: 1.68 });
  function crowdSurfaceUV(points) {
    const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), w0 = length(points[0], points[1]) / CROWD_METRIC.widthMeters, w1 = length(points[3], points[2]) / CROWD_METRIC.widthMeters, h0 = length(points[0], points[3]) / CROWD_METRIC.depthMeters, h1 = length(points[1], points[2]) / CROWD_METRIC.depthMeters;
    return [{ u: -w0 / 2, v: 0 }, { u: w0 / 2, v: 0 }, { u: w1 / 2, v: h1 }, { u: -w1 / 2, v: h0 }];
  }
  function perspectiveUvFootprint(a, b, c, pixelStep) {
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x), ux = (b.y - c.y) / area, vx = (c.y - a.y) / area, wx = -ux - vx, uy = (c.x - b.x) / area, vy = (a.x - c.x) / area, wy = -uy - vy, dx = ux / a.depth + vx / b.depth + wx / c.depth, dy = uy / a.depth + vy / b.depth + wy / c.depth, duX = ux * a.u / a.depth + vx * b.u / b.depth + wx * c.u / c.depth, duY = uy * a.u / a.depth + vy * b.u / b.depth + wy * c.u / c.depth, dvX = ux * a.v / a.depth + vx * b.v / b.depth + wx * c.v / c.depth, dvY = uy * a.v / a.depth + vy * b.v / b.depth + wy * c.v / c.depth;
    return (d, u, v) => [Math.hypot(duX - u * dx, duY - u * dy) * d * pixelStep, Math.hypot(dvX - v * dx, dvY - v * dy) * d * pixelStep];
  }

  // tools/ballpark-studio/material-lod.mjs
  function projectedMaterialDetail(points, maximum = 6, step = 10 / 3) {
    const p = points.filter(Boolean), edge = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    if (p.length < 3) return null;
    const width = p.length === 4 ? (edge(p[0], p[1]) + edge(p[3], p[2])) / 2 : Math.max(...p.map((q) => q.x)) - Math.min(...p.map((q) => q.x)), height = p.length === 4 ? (edge(p[0], p[3]) + edge(p[1], p[2])) / 2 : Math.max(...p.map((q) => q.y)) - Math.min(...p.map((q) => q.y)), depth = p.reduce((n, q) => n + q.depth, 0) / p.length, t = Math.max(0, Math.min(1, Math.min(width, height) / 80)), distanceT = Math.max(0, Math.min(1, (depth - 70) / 350)), distanceBlend = distanceT * distanceT * (3 - 2 * distanceT), quality = t * t * (3 - 2 * t), density = Math.max(1.6, Math.min(maximum, 1 + (maximum - 1) * (0.6 + 0.4 * quality))), blurScale = 1 + 0.15 * distanceBlend;
    return {
      widthPixels: width,
      heightPixels: height,
      depth,
      maximum,
      density,
      brightness: 1.45,
      glow: 0.08,
      contrast: 1,
      footprintU: blurScale * step / density / Math.max(0.01, width) / 0.88,
      footprintV: blurScale * step / density / Math.max(0.01, height) / 0.88,
      sampling: "premultiplied_mipmap_trilinear",
      policy: "mild_distance_softening_without_fade"
    };
  }

  // tools/ballpark-studio/ground-logo.mjs
  var texture2 = null;
  function logoStrength(data, index) {
    const luminance = (0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]) / 255, core = Math.max(0, Math.min(1, (luminance - 0.25) / 0.55));
    return Math.pow(data[index + 3] / 255, 1.4) * core * core * 0.9;
  }
  function sampleLogoUV(u, v, footprint = null) {
    if (!texture2 || u < 0 || u >= 1 || v < 0 || v >= 1) return null;
    if (footprint) return sampleMip(texture2.mips, u, v, footprint.footprintU, footprint.footprintV);
    const i = (Math.floor(v * texture2.height) * texture2.width + Math.floor(u * texture2.width)) * 4, a = logoStrength(texture2.data, i);
    return a < 0.06 ? null : { r: texture2.data[i], g: texture2.data[i + 1], b: texture2.data[i + 2], a };
  }

  // tools/ballpark-studio/paypay-ground-ads.mjs
  var k = Math.SQRT1_2;
  var PAYPAY_ADS = Object.freeze([
    { id: "third-side", x: -13.5, z: 7.5, width: 13.8, length: 2.4, ux: k, uz: -k, quad: [[164, 307], [267, 346], [255, 368], [152, 329]] },
    { id: "first-side", x: 13.5, z: 7.5, width: 13.8, length: 2.4, ux: k, uz: k, quad: [[373, 346], [476, 307], [488, 329], [385, 368]] },
    { id: "home", x: 0, z: -9, width: 9, length: 3, ux: 1, uz: 0, quad: [[281, 365], [359, 365], [359, 385], [281, 385]] }
  ]);

  // tools/ballpark-studio/paypay-scoreboard-material.mjs
  function drawPaypayMainBoard(ctx, g, width, height) {
    const s = g.architecture.scoreboard ?? defaultScoreboard(), p = s.paypay ?? defaultPaypayScoreboard(), field = scoreboardFieldDiagram(g.architecture);
    ctx.save();
    ctx.scale(width / 3072, height / 800);
    ctx.fillStyle = "#111719";
    ctx.fillRect(0, 0, 3072, 800);
    const text = (value, x, y, size = 44, color = "#f0f1eb", max = 600, align = "center") => {
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.font = `700 ${size}px sans-serif`;
      ctx.fillText(String(value), x, y, max);
    }, line = (x, y, x1, y1) => {
      ctx.strokeStyle = "#a5a99a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    };
    for (let team = 0; team < 2; team++) {
      const x = team === 0 ? 24 : 2482, cx = x + 274;
      ctx.fillStyle = team ? "#e9bb16" : "#cbd9da";
      ctx.fillRect(x, 24, 548, 70);
      text(s.teams[team].name, cx, 60, 46, "#15201c", 520);
      text("\u6253\u9806", x + 54, 132, 31);
      text("\u9078\u624B\u540D", x + 275, 132, 31);
      text("\u5B88\u5099", x + 495, 132, 31);
      line(x, 158, x + 548, 158);
      p.lineups[team].forEach((v, i) => {
        const y = 202 + i * 59;
        text(i + 1, x + 53, y, 39, "#e8c54a");
        text(v.name, x + 275, y, 42, "#f2f1e8", 340);
        text(v.position, x + 495, y, 40);
      });
      line(x, 734, x + 548, 734);
    }
    text("FUKUOKA  \xB7  SCOREBOARD", 1536, 44, 38, "#e3c958", 1400);
    const left = 650, cell = 121, start = left + 255;
    [...Array.from({ length: 9 }, (_, i) => i + 1), "R", "H", "E"].forEach((v, i) => text(v, start + (i + 0.5) * cell, 132, 38));
    s.teams.forEach((team, row) => {
      const y = 220 + row * 100;
      text(team.name, left + 113, y, 39, "#eef1ea", 218);
      [...team.innings, runs(team), team.hits, team.errors].forEach((v, i) => text(v === null ? "\u2013" : v, start + (i + 0.5) * cell, y, 61, i > 8 ? "#f5cb42" : "#f1f2eb", 106));
    });
    for (const y of [164, 270, 370]) line(left, y, 2425, y);
    for (const x of [left, left + 248, start + cell * 9, 2425]) line(x, 96, x, 370);
    [["B", s.balls, 3, "#68d98a"], ["S", s.strikes, 2, "#f4ce37"], ["O", s.outs, 2, "#f65f65"]].forEach(([label, count, max, color], row) => {
      const x = 778 + row * 540;
      text(label, x, 434, 54);
      for (let i = 0; i < max; i++) {
        ctx.fillStyle = i < count ? color : "#26312e";
        ctx.beginPath();
        ctx.arc(x + 89 + i * 76, 434, 24, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    line(left, 490, 2425, 490);
    text(p.inning + "\u56DE" + (p.half === "top" ? "\u8868" : "\u88CF"), 950, 565, 72, "#f2d574");
    text("PITCH", 720, 665, 32);
    text(p.pitchCount, 895, 665, 66, "#eec14a");
    text("SPEED", 1220, 665, 32);
    text(s.speedKmh.toFixed(1), 1430, 665, 62);
    text("km/h", 1630, 665, 30);
    if (field?.enabled) {
      const map = (v) => {
        const q = projectFieldDiagramPoint(v);
        return { x: 1820 + q.u * 500, y: 515 + q.v * 215 };
      }, home = map({ x: 0, z: 0 }), bases = SCOREBOARD_BASES.map(map);
      ctx.strokeStyle = "#e2e4d9";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(home.x, home.y);
      for (const b of bases) ctx.lineTo(b.x, b.y);
      ctx.closePath();
      ctx.stroke();
      for (const base of SCOREBOARD_BASES) {
        const q = map(base), r = 14;
        ctx.fillStyle = field.runners[base.id] ? "#f4c633" : "#21322c";
        ctx.strokeStyle = "#b2c3b0";
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - r);
        ctx.lineTo(q.x + r, q.y);
        ctx.lineTo(q.x, q.y + r);
        ctx.lineTo(q.x - r, q.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      for (const d of field.defenders) {
        const q = map(d);
        text(d.label, q.x, q.y, 21, "#d5e4d1", 80);
      }
    }
    text("\u8868\u793A\u898B\u672C", 1536, 769, 25, "#a7b3a7", 500);
    ctx.restore();
  }

  // tools/ballpark-studio/paypay-materials.mjs
  var cache2 = /* @__PURE__ */ new WeakMap();
  var hex = (c) => "#" + c.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("");
  function texture3(part, g) {
    if (typeof document === "undefined") return null;
    let entry = cache2.get(g);
    if (!entry) {
      entry = {};
      cache2.set(g, entry);
    }
    if (entry[part]) return entry[part];
    const canvas = document.createElement("canvas"), isVision = part === "paypay:vision", isEntry = part === "paypay:entry", isMonitor = part.startsWith("paypay:monitor-"), monitor = Number(part.split("-").at(-1));
    canvas.width = isVision ? 3072 : isMonitor ? 1536 : 1024;
    canvas.height = isVision ? 800 : isMonitor ? [0, 4].includes(monitor) ? 264 : 444 : isEntry ? 128 : 256;
    const ctx = canvas.getContext("2d", { willReadFrequently: true }), W = canvas.width, H = canvas.height, s = g.architecture.scoreboard ?? defaultScoreboard();
    ctx.fillStyle = isVision ? "#161a1b" : isEntry ? "#a9a99e" : "#193f35";
    ctx.fillRect(0, 0, W, H);
    const text = (value, x, y, size = 45, color = "#eff0e4", align = "center") => {
      ctx.fillStyle = color;
      ctx.textAlign = align;
      ctx.textBaseline = "middle";
      ctx.font = `700 ${size}px sans-serif`;
      ctx.fillText(String(value), x, y);
    };
    if (isVision) {
      drawPaypayMainBoard(ctx, g, W, H);
    } else if (isEntry) {
      text("MIZUHO", 155, 64, 46, "#1c2b4b");
      text("PayPay Dome FUKUOKA", 640, 64, 51, "#eeeee0");
      ctx.fillStyle = "#ce3839";
      ctx.fillRect(285, 33, 46, 60);
      text("P", 308, 64, 45);
    } else if (isMonitor) {
      const yellow = "#eac21d", paper = "#f2f1df";
      ctx.fillStyle = [0, 4].includes(monitor) ? paper : "#131f1d";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = yellow;
      ctx.beginPath();
      ctx.moveTo(W * 0.62, 0);
      ctx.lineTo(W, 0);
      ctx.lineTo(W, H);
      ctx.lineTo(W * 0.32, H);
      ctx.closePath();
      ctx.fill();
      if (monitor === 1) {
        text("PLAY BALL", W * 0.36, H * 0.32, 112, paper);
        text("SoftBank HAWKS", W * 0.35, H * 0.72, 48, yellow);
        ctx.fillStyle = "#17231e";
        ctx.beginPath();
        ctx.arc(W * 0.82, H * 0.26, H * 0.09, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(W * 0.77, H * 0.38, W * 0.09, H * 0.4);
        ctx.strokeStyle = "#17231e";
        ctx.lineWidth = H * 0.07;
        ctx.beginPath();
        ctx.moveTo(W * 0.81, H * 0.49);
        ctx.lineTo(W * 0.68, H * 0.23);
        ctx.moveTo(W * 0.72, H * 0.34);
        ctx.lineTo(W * 0.6, H * 0.06);
        ctx.stroke();
      } else if (monitor === 3) {
        text("NEXT PLAY", W * 0.37, H * 0.3, 112, paper);
        text("FUKUOKA", W * 0.36, H * 0.72, 54, yellow);
        ctx.strokeStyle = "#f2f0dd";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(W * 0.68, H * 0.82);
        ctx.lineTo(W * 0.83, H * 0.34);
        ctx.lineTo(W * 0.96, H * 0.82);
        ctx.closePath();
        ctx.stroke();
        ctx.fillStyle = paper;
        ctx.beginPath();
        ctx.arc(W * 0.84, H * 0.36, H * 0.07, 0, Math.PI * 2);
        ctx.fill();
      } else {
        text(monitor === 0 ? "HAWKS" : "FUKUOKA", W * 0.45, H * 0.43, 110, "#17231e");
        text("BASEBALL  \xB7  YELLOW SPIRIT", W * 0.43, H * 0.81, 37, "#425344");
        ctx.fillStyle = "#17231e";
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.moveTo(W * 0.81 + i * 34, H * 0.25);
          ctx.lineTo(W * 0.87 + i * 34, H * 0.5);
          ctx.lineTo(W * 0.81 + i * 34, H * 0.75);
          ctx.lineTo(W * 0.84 + i * 34, H * 0.5);
          ctx.closePath();
          ctx.fill();
        }
      }
    } else if (part === "paypay:side-vision") {
      ctx.fillStyle = "#d2ac15";
      ctx.fillRect(0, 0, W, H);
      text("HAWKS", W / 2, 91, 100, "#18211c");
      text("\u307F\u305A\u307BPayPay\u30C9\u30FC\u30E0\u798F\u5CA1", W / 2, 196, 44, "#18211c");
    } else if (part === "paypay:wall") {
      text("MIZUHO     SANKYU     DUSKIN", W / 2, H / 2, 53);
    } else if (part === "paypay:upper-ad") {
      ctx.fillStyle = "#9d292c";
      ctx.fillRect(0, 0, W, H);
      text("\u5927\u548C\u8A3C\u5238", W / 2, 100, 72);
      text("Daiwa Securities", W / 2, 192, 35);
    } else if (part === "paypay:suite") {
      ctx.fillStyle = "#b4a77b";
      ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 10; i++) {
        ctx.fillStyle = "#233e38";
        ctx.fillRect(i * 102 + 8, 18, 86, 218);
        ctx.fillStyle = "#bbaa74";
        ctx.fillRect(i * 102 + 15, 30, 70, 98);
        ctx.fillStyle = "#565b47";
        ctx.fillRect(i * 102 + 15, 146, 70, 72);
      }
    }
    const data = ctx.getImageData(0, 0, W, H).data;
    return entry[part] = mipPyramid({ width: W, height: H, data });
  }
  function samplePaypayMaterial(part, u, v, profile, g) {
    const levels = texture3(part, g);
    if (!levels) return null;
    const c = sampleMip(levels, u, 1 - v, profile?.footprintU ?? 2e-3, profile?.footprintV ?? 2e-3);
    return c ? { color: hex([c.r, c.g, c.b]), logoGlow: part.includes("vision") ? 0.1 : 0 } : null;
  }

  // tools/ballpark-studio/dodger-stands.mjs
  var rim = [[-77, 78], [-58, 49], [-38, 13], [-25, -13], [0, -25], [25, -13], [38, 13], [58, 49], [77, 78]];
  function curve(u) {
    const t = Math.max(0, Math.min(1, u)) * (rim.length - 1), i = Math.min(rim.length - 2, Math.floor(t)), s = t - i, p = [rim[Math.max(0, i - 1)], rim[i], rim[i + 1], rim[Math.min(rim.length - 1, i + 2)]];
    return [0, 1].map((k2) => 0.5 * (2 * p[1][k2] + (-p[0][k2] + p[2][k2]) * s + (2 * p[0][k2] - 5 * p[1][k2] + 4 * p[2][k2] - p[3][k2]) * s * s + (-p[0][k2] + 3 * p[1][k2] - 3 * p[2][k2] + p[3][k2]) * s * s * s));
  }
  function dodgerSeatPoint(u, offset, y, g) {
    const legacy = (t) => {
      const p2 = curve(t);
      return { x: p2[0], z: p2[1] };
    }, point = (t) => realParkSeatRim(g, "dodger_stadium", Math.max(0, Math.min(1, t)), legacy), p = point(u), a = point(u - 1e-5), b = point(u + 1e-5), dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz);
    return { x: p.x + dz / n * offset, y, z: p.z - dx / n * offset };
  }
  var DODGER_DECKS = Object.freeze([
    { name: "field", offset: 2, depth: 16, y: 1.8, rise: 5, trim: 0, color: "#b5a469", rows: 14 },
    { name: "loge", offset: 17, depth: 13, y: 10, rise: 5.3, trim: 0.018, color: "#b49677", rows: 12 },
    { name: "club", offset: 28, depth: 6, y: 18, rise: 2, trim: 0.07, color: "#779e9d", rows: 5 },
    { name: "reserve", offset: 31, depth: 19, y: 23, rise: 8.5, trim: 0.04, color: "#7395ab", rows: 16 },
    { name: "top", offset: 49, depth: 14, y: 34, rise: 6.5, trim: 0.25, color: "#7f9eb5", rows: 12 }
  ]);
  function appendDodgerStands({ geometry: g, architecture: a, face, line, tile }) {
    const decks = DODGER_DECKS.slice(0, a.tiers), counts = { decks: decks.length, aisles: 0, rows: 0, concourses: 0 }, S = 72;
    for (const d of decks) {
      counts.rows += d.rows;
      const point = (u, v) => dodgerSeatPoint(u, d.offset + d.depth * v, d.y + d.rise * v, g);
      for (let i = 0; i < S; i++) {
        const u0 = d.trim + (1 - 2 * d.trim) * i / S, u1 = d.trim + (1 - 2 * d.trim) * (i + 1) / S, aisle = i % 6 === 0, split = u0 + (u1 - u0) * 0.3;
        for (let band = 0; band < 4; band++) {
          const v0 = band / 4, v1 = (band + 1) / 4;
          face("seats-" + d.name, [point(aisle ? split : u0, v0), point(u1, v0), point(u1, v1), point(aisle ? split : u0, v1)], d.color, { crowdTile: { ...tile(), seatTint: d.color } });
          if (aisle) {
            face("aisle-" + d.name, [point(u0, v0), point(split, v0), point(split, v1), point(u0, v1)], "#89918e");
            counts.aisles++;
          }
        }
        for (let row = 1; row < d.rows; row++) {
          const v = row / d.rows;
          line(point(aisle ? split : u0, v), point(u1, v), "#455a66");
          if (aisle) line(point(u0, v), point(split, v), "#a1a59d");
        }
        const p = point(u0, 0), q = point(u1, 0);
        face("fascia-" + d.name, [{ ...p, y: p.y - 1.8 }, { ...q, y: q.y - 1.8 }, q, p], "#657987");
        line(p, q, "#99a9af");
        face("walkway-" + d.name, [dodgerSeatPoint(u0, d.offset - 2, d.y - 0.2, g), dodgerSeatPoint(u1, d.offset - 2, d.y - 0.2, g), q, p], "#697773");
        counts.concourses++;
        const b0 = point(u0, 1), b1 = point(u1, 1), c0 = dodgerSeatPoint(u0, d.offset + d.depth + 3, d.y + d.rise, g), c1 = dodgerSeatPoint(u1, d.offset + d.depth + 3, d.y + d.rise, g);
        face("rear-concourse-" + d.name, [b0, b1, c1, c0], "#5d6d70");
        line(b0, b1, "#829aa7");
        face("outer-wall-" + d.name, [{ ...c0, y: c0.y - 4 }, { ...c1, y: c1.y - 4 }, c1, c0], "#394d5c");
        if (d.name === "top") face("top-shade", [c0, c1, { ...b1, y: b1.y + 2 }, { ...b0, y: b0.y + 2 }], "#798b99", { roof: true });
      }
      for (const u of [d.trim, 1 - d.trim]) {
        const p = point(u, 0), q = point(u, 1);
        face("deck-end-" + d.name, [{ ...p, y: d.y - 2 }, { ...q, y: d.y - 2 }, q, p], "#506672");
      }
    }
    return counts;
  }

  // tools/ballpark-studio/dodger-landscape.mjs
  var DEFAULT_DODGER_ATMOSPHERE = Object.freeze({ period: "night", strength: 0.35 });
  var scenes = /* @__PURE__ */ new WeakMap();
  var TAU = Math.PI * 2;
  var N = 48;
  var RINGS = [0.7, 1.04, 1.17, 1.33, 1.59, 1.89, 2.3];
  var clamp = (t) => Math.max(0, Math.min(1, t));
  var smooth2 = (t) => {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  };
  var hash = (x, z) => ((Math.imul(x + 51, 73856093) ^ Math.imul(z + 17, 19349663)) >>> 0) / 4294967296;
  function scene(g) {
    if (scenes.has(g)) return scenes.get(g);
    const far = Math.max(...g.fencePoints.map((p) => p.distanceMeters)), rx = Math.max(152, far * 0.95 + 30), rz = Math.max(144, far * 0.75 + 50), patches = [];
    const radius = (x, z) => Math.hypot(x / rx, (z - 45) / rz), ground = (x, z) => {
      const r = radius(x, z), h = 27 * Math.exp(-(((x + 200) / 145) ** 2 + ((z - 255) / 125) ** 2)) + 23 * Math.exp(-(((x - 190) / 155) ** 2 + ((z - 280) / 130) ** 2)) + 16 * Math.exp(-((x / 180) ** 2 + ((z + 290) / 110) ** 2));
      return -1 + smooth2((r - 1.15) / 0.8) * (4 + h);
    }, polar2 = (t, r) => {
      const x = Math.sin(t) * rx * r, z = 45 + Math.cos(t) * rz * r;
      return { x, y: ground(x, z), z };
    }, add = (kind, points, group = null) => patches.push({ kind, points, group });
    for (let ring = 0; ring < RINGS.length - 1; ring++) for (let i = 0; i < N; i++) {
      const r0 = RINGS[ring], r1 = RINGS[ring + 1], t0 = i * TAU / N, t1 = (i + 1) * TAU / N, kind = ring === 0 ? "plaza" : ring === 1 ? "road" : ring < 5 ? "parking" : "hill";
      add(kind, [polar2(t0, r0), polar2(t1, r0), polar2(t1, r1), polar2(t0, r1)]);
    }
    const groves = [
      [-32, 1.78, 43, 26, 8],
      [0, 1.86, 57, 30, 10],
      [34, 1.78, 45, 26, 8],
      [-75, 1.78, 40, 24, 7],
      [75, 1.78, 40, 24, 7],
      [-112, 1.87, 52, 25, 7],
      [112, 1.87, 52, 25, 7],
      [-148, 1.95, 48, 29, 8],
      [148, 1.95, 48, 29, 8],
      [180, 1.92, 58, 27, 7],
      [-55, 1.36, 24, 12, 5],
      [55, 1.36, 24, 12, 5],
      [-98, 1.42, 25, 12, 5],
      [98, 1.42, 25, 12, 5],
      [-139, 1.4, 27, 12, 5],
      [139, 1.4, 27, 12, 5],
      [176, 1.37, 30, 12, 5]
    ];
    groves.forEach(([degrees, r, tangent, radial, height], index) => {
      const t = degrees * Math.PI / 180, c = polar2(t, r), s = Math.sin(t), q = Math.cos(t), point = (angle, k2) => {
        const irregular = 1 + 0.12 * Math.sin(angle * 3 + index) + 0.07 * Math.cos(angle * 5 - index), a = Math.cos(angle) * tangent * k2 * irregular, b = Math.sin(angle) * radial * k2 * irregular, x = c.x + q * a + s * b, z = c.z - s * a + q * b, y = ground(x, z) + 0.3 + height * Math.sqrt(Math.max(0, 1 - k2 * k2)) * (0.96 + 0.04 * k2 * Math.sin(angle * 2 + index));
        return { x, y, z };
      };
      for (const [r0, r1] of [[0, 0.57], [0.57, 1]]) for (let i = 0; i < 12; i++) {
        const t0 = i * TAU / 12, t1 = (i + 1) * TAU / 12;
        add("canopy", [point(t0, r0), point(t1, r0), point(t1, r1), point(t0, r1)], { x: c.x, z: c.z, tangent, radial, index });
      }
    });
    const result = { patches, rx, rz, innerRadius: RINGS[0], groves: groves.length, parkingPatches: patches.filter((p) => p.kind === "parking").length };
    scenes.set(g, result);
    return result;
  }
  function appendDodgerLandscape(g, face) {
    const a = g.architecture.atmosphere ?? DEFAULT_DODGER_ATMOSPHERE;
    if (a.strength === 0) return { enabled: false, ...a, layers: 0, individualTrees: 0 };
    const s = scene(g);
    s.patches.forEach((p, i) => face(p.kind, p.points, "#000000", { material: "dodger:landscape:" + i }));
    return { enabled: true, ...a, worldSpace: true, rx: s.rx, rz: s.rz, innerRadius: s.innerRadius, groves: s.groves, parkingPatches: s.parkingPatches, individualTrees: 0, individualCars: 0 };
  }
  function landscapeMaterial(part, u, v, g, profile = null) {
    const s = scene(g), p = s.patches[Number(part.slice(part.lastIndexOf(":") + 1))];
    if (!p) return null;
    const mix2 = (key) => {
      const a2 = p.points[0][key] * (1 - u) + p.points[1][key] * u, b = p.points[3][key] * (1 - u) + p.points[2][key] * u;
      return a2 * (1 - v) + b * v;
    }, x = mix2("x"), z = mix2("z"), a = g.architecture.atmosphere ?? DEFAULT_DODGER_ATMOSPHERE, day = a.period === "day", r = Math.hypot(x / s.rx, (z - 45) / s.rz), fade = 1 - smooth2((r - 1.85) / 0.45), noise = 0.94 + 0.035 * Math.sin(x * 0.037 + z * 0.027) + 0.025 * Math.sin(x * 0.11 - z * 0.08), gain = Math.sqrt(a.strength) * fade * noise, palette = day ? { plaza: [111, 114, 109], road: [80, 86, 87], parking: [125, 128, 120], hill: [99, 110, 82], canopy: [55, 88, 60] } : { plaza: [27, 34, 36], road: [22, 28, 31], parking: [34, 40, 41], hill: [28, 41, 34], canopy: [27, 47, 35] };
    let color = palette[p.kind], light = 1;
    if (p.kind === "canopy") light = 0.83 + 0.12 * Math.sin(x * 0.043 + z * 0.031) + 0.05 * Math.cos(z * 0.09);
    if (p.kind === "road") {
      const lane = Math.abs((r - 1.105) * s.rx);
      if (lane < 0.18) color = day ? [145, 143, 118] : [43, 47, 43];
    }
    if (p.kind === "parking") {
      const xx = x * 0.94 + z * 0.34, zz = z * 0.94 - x * 0.34, band = (zz % 21 + 21) % 21, bay = (xx % 3 + 3) % 3, bx = Math.floor(xx / 3), bz = Math.floor(zz / 21);
      if (band < 0.16 || band > 6 && band < 15 && bay < 0.12) color = day ? [155, 157, 146] : [43, 49, 49];
      else if (band > 6 && band < 14 && bay > 0.6 && bay < 2.4 && hash(bx, bz) > 0.36) {
        const h = hash(bx + 37, bz + 11);
        color = day ? [88 + 62 * h, 95 + 57 * h, 98 + 53 * h] : [28 + 15 * h, 36 + 14 * h, 42 + 12 * h];
      }
    }
    const haze = smooth2(((profile?.depth ?? 260) - 150) / 500) * 0.22, fog = day ? [105, 124, 130] : [19, 28, 31];
    return { color: "#" + color.map((c, i) => Math.max(0, Math.min(255, Math.round((c * light * (1 - haze) + fog[i] * haze) * gain))).toString(16).padStart(2, "0")).join("") };
  }

  // tools/ballpark-studio/dodger-materials.mjs
  function laPaint(u, v) {
    const x = u * 100, y = v * 100;
    const bar = (x0, y0, x1, y1) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const l = bar(17, 8, 30, 71) || bar(17, 60, 62, 73), a = y >= 30 && y <= 94 && Math.abs(x - (62 + (y - 30) * 0.31)) < 7 || y >= 30 && y <= 94 && Math.abs(x - (62 - (y - 30) * 0.31)) < 7 || bar(41, 70, 82, 80);
    return l || a;
  }
  var cache3 = /* @__PURE__ */ new Map();
  var scoreCache = /* @__PURE__ */ new WeakMap();
  function texture4(part, g) {
    if (typeof document === "undefined") return null;
    const previous = part === "dodger:score" ? scoreCache.get(g) : cache3.get(part);
    if (previous) return previous;
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = part === "dodger:score" ? 512 : part === "dodger:entry-welcome" ? 96 : 256;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.fillStyle = part.includes("76") ? "#ee682f" : part === "dodger:score" ? "#0c1b29" : "#093b77";
    x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = "#f5f5ee";
    x.textAlign = "center";
    x.textBaseline = "middle";
    if (part === "dodger:entry-welcome") {
      x.fillStyle = "#1686c4";
      x.fillRect(0, 0, 1024, 96);
      x.fillStyle = "#f3f6ef";
      x.font = "bold 48px sans-serif";
      x.fillText("WELCOME TO DODGER STADIUM", 512, 48, 980);
    } else if (part === "dodger:entry-script") {
      x.fillStyle = "#dce6e6";
      x.fillRect(0, 0, 1024, 256);
      x.fillStyle = "#1555a1";
      x.font = "italic bold 164px Georgia";
      x.fillText("Dodgers", 535, 150, 900);
      x.strokeStyle = "#b94743";
      x.lineWidth = 7;
      x.beginPath();
      x.arc(180, 48, 24, 0, Math.PI * 2);
      x.stroke();
      for (let i = 0; i < 4; i++) {
        x.beginPath();
        x.moveTo(165 + i * 11, 74);
        x.lineTo(90 + i * 12, 160);
        x.stroke();
      }
    } else if (part === "dodger:score") {
      const s = g.architecture.scoreboard ?? defaultScoreboard();
      x.font = "bold 52px sans-serif";
      x.fillText("DODGER STADIUM", 512, 58);
      x.fillStyle = "#e8ca76";
      x.font = "38px sans-serif";
      const headings = [...Array.from({ length: 9 }, (_, i) => i + 1), "R", "H", "E"];
      headings.forEach((h, i) => x.fillText(String(h), 225 + i * 66, 132));
      x.fillStyle = "#f1e4b9";
      s.teams.forEach((t2, row) => {
        const y = 210 + row * 85;
        x.textAlign = "left";
        x.font = "bold 42px sans-serif";
        x.fillText(t2.name, 22, y, 170);
        x.textAlign = "center";
        x.font = "44px monospace";
        [...t2.innings, runs(t2), t2.hits, t2.errors].forEach((v, i) => x.fillText(v === null ? "\u2013" : String(v), 225 + i * 66, y));
      });
      x.strokeStyle = "#8c9aa1";
      x.lineWidth = 3;
      for (const y of [155, 251, 337]) {
        x.beginPath();
        x.moveTo(18, y);
        x.lineTo(1004, y);
        x.stroke();
      }
      x.font = "bold 44px sans-serif";
      x.fillStyle = "#edf3f1";
      x.fillText("B " + s.balls + "    S " + s.strikes + "    O " + s.outs, 450, 397);
      x.font = "bold 52px sans-serif";
      x.fillText(s.speedKmh.toFixed(1) + " km/h", 512, 466);
    } else if (part === "dodger:la") {
      for (let y = 0; y < 100; y++) for (let z = 0; z < 100; z++) if (laPaint(z / 100, y / 100)) x.fillRect(z * 6 + 200, y * 2.3 + 12, 6, 2.3);
    } else {
      x.font = part === "dodger:wordmark" ? "italic bold 168px Georgia" : "bold 126px sans-serif";
      x.fillText(part === "dodger:76" ? "76" : part === "dodger:wordmark" ? "Dodgers" : part === "dodger:stadium" ? "DODGER STADIUM" : part === "dodger:distance" ? "395" : part === "dodger:ribbon" ? "LOS ANGELES DODGERS" : "LA", 512, 134, 980);
    }
    const data = x.getImageData(0, 0, c.width, c.height).data, t = mipPyramid({ width: c.width, height: c.height, data });
    if (part === "dodger:score") scoreCache.set(g, t);
    else cache3.set(part, t);
    return t;
  }
  function sampleDodgerMaterial(part, u, v, profile, g) {
    if (part.startsWith("dodger:facade:")) {
      const name = part.split(":")[2], d = DODGER_DECKS.find((d2) => d2.name === name), h = d ? d.y + d.rise - 4 : 9, y = v * h, f = y % 3.4 / 3.4;
      return { color: u < 0.12 || u > 0.88 || f > 0.73 ? "#bac3bf" : y < 1.3 ? "#347ca1" : f < 0.17 ? "#78919a" : "#2d4d62" };
    }
    if (part.startsWith("dodger:landscape:")) return landscapeMaterial(part, u, v, g, profile);
    if (part.startsWith("dodger:entry-")) u = 1 - u;
    if (part === "dodger:rear-la") {
      part = "dodger:la";
      u = 1 - u;
    }
    const t = texture4(part, g);
    if (!t) return null;
    const s = sampleMip(t, u, 1 - v, profile?.footprintU ?? 0, profile?.footprintV ?? 0);
    return s ? { color: "#" + [s.r, s.g, s.b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("") } : null;
  }

  // tools/ballpark-studio/koshien-materials.mjs
  var cache4 = /* @__PURE__ */ new Map();
  var scores = /* @__PURE__ */ new WeakMap();
  var KOSHIEN_BOARD = Object.freeze({ width: 62, bodyHeight: 21, baseY: 9, topY: 30, z: 144, screenWidth: 59, screenHeight: 18.8, clockTop: 44 });
  var KOSHIEN_FACADE_SECTORS = 84;
  var KOSHIEN_MOUND = Object.freeze({ center: Object.freeze({ x: 0, z: 17.9832 }), radius: 2.7432, cover: Object.freeze({ x: -0.35, z: 19.65, radius: 0.24 }) });
  var smooth3 = (t) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };
  function koshienIvyCoverage(u, height) {
    const t = u * Math.PI * 2, climb = 12 + 7 * Math.sin(t * 4 + 0.3) + 4 * Math.sin(t * 9 - 0.5), edge = climb + 1.5 * Math.sin(t * 22) - height, body = 0.5 + 0.3 * Math.sin(t * 7 + height * 0.18) + 0.18 * Math.cos(t * 13 - height * 0.21);
    return smooth3((edge + 1) / 2.5) * smooth3((body - 0.15) / 0.35);
  }
  function texture5(part, g) {
    if (typeof document === "undefined") return null;
    const dynamic = part === "koshien:score" || part === "koshien:clock", entry = scores.get(g), old = dynamic ? entry?.[part] : cache4.get(part);
    if (old) return old;
    const c = document.createElement("canvas");
    c.width = part === "koshien:facade-wrap" ? 4096 : part === "koshien:score" ? 1792 : part === "koshien:clock" ? 512 : part.startsWith("koshien:flag") || part === "koshien:tower" || part === "koshien:sankyu-side" ? 256 : 1024;
    c.height = part === "koshien:score" ? 576 : part === "koshien:clock" ? 896 : part === "koshien:backscreen" ? 256 : part === "koshien:sankyu-side" ? 512 : part.startsWith("koshien:flag") ? 160 : part === "koshien:tower" ? 1024 : ["koshien:facade-wrap", "koshien:roof"].includes(part) ? 512 : 128;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.fillStyle = dynamic ? "#080d0e" : "#153e35";
    x.fillRect(0, 0, c.width, c.height);
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillStyle = "#eceee7";
    if (part === "koshien:score") {
      const s = g.architecture.scoreboard ?? defaultScoreboard(), order = [..."\u4E00\u4E8C\u4E09\u56DB\u4E94\u516D\u4E03\u516B\u4E5D"], positions = ["\u5DE6\u7FFC", "\u4E8C\u5841", "\u4E2D\u5805", "\u4E00\u5841", "\u4E09\u5841", "\u53F3\u7FFC", "\u6355\u624B", "\u904A\u6483", "\u6295\u624B"], vertical = (text, cx, cy, size) => {
        x.font = `bold ${size}px sans-serif`;
        [...text].forEach((ch, i) => x.fillText(ch, cx, cy + i * (size + 4)));
      };
      order.forEach((v, i) => {
        const cx = 170 + i * 56;
        x.font = "bold 34px sans-serif";
        x.fillText(v, cx, 43);
        vertical(positions[i], cx, 113, 35);
        x.font = "bold 36px monospace";
        x.fillText(String([7, 4, 8, 3, 5, 9, 2, 6, 1][i]), cx, 242);
        x.fillText(String([8, 6, 4, 3, 7, 9, 5, 2, 1][i]), cx, 301);
        vertical(positions[(i + 2) % 9], cx, 374, 35);
      });
      for (let row = 0; row < 2; row++) {
        const name = s.teams[row].name;
        vertical(name, 62, row ? 348 : 111, Math.min(46, 155 / name.length));
      }
      x.font = "bold 31px sans-serif";
      [...order, "\u8A08", "H", "E"].forEach((v, i) => x.fillText(v, 852 + i * 72, 46));
      s.teams.forEach((t2, row) => {
        const y = 114 + row * 66;
        x.font = "bold 34px sans-serif";
        x.fillText(t2.name, 755, y, 130);
        x.font = "bold 43px monospace";
        [...t2.innings, runs(t2), t2.hits, t2.errors].forEach((v, i) => x.fillText(v === null ? "\u2013" : String(v), 852 + i * 72, y));
      });
      x.strokeStyle = "#53605a";
      x.lineWidth = 2;
      x.beginPath();
      x.moveTo(716, 232);
      x.lineTo(1750, 232);
      x.stroke();
      const diagram = scoreboardFieldDiagram(g.architecture), point = (p) => {
        const q = projectFieldDiagramPoint(p);
        return { x: 800 + q.u * 400, y: 250 + q.v * 300 };
      };
      if (diagram?.enabled) {
        const home = point({ x: 0, z: 0 }), bases = SCOREBOARD_BASES.map(point);
        x.strokeStyle = "#9ca99d";
        x.lineWidth = 2;
        x.beginPath();
        x.moveTo(home.x, home.y);
        for (const b of bases) x.lineTo(b.x, b.y);
        x.closePath();
        x.stroke();
        for (const b of SCOREBOARD_BASES) {
          const q = point(b), r = 9;
          x.fillStyle = diagram.runners[b.id] ? "#8cdf7d" : "#14231c";
          x.strokeStyle = diagram.runners[b.id] ? "#b4f49e" : "#697c6a";
          x.beginPath();
          x.moveTo(q.x, q.y - r);
          x.lineTo(q.x + r, q.y);
          x.lineTo(q.x, q.y + r);
          x.lineTo(q.x - r, q.y);
          x.closePath();
          x.fill();
          x.stroke();
        }
        for (const d of diagram.defenders) {
          const q = point(d);
          x.fillStyle = "#e5e9de";
          x.font = "bold 26px sans-serif";
          x.fillText(d.label, q.x, q.y, 76);
        }
      }
      x.fillStyle = "#eceee7";
      x.font = "bold 30px sans-serif";
      x.fillText("\u7403 \u901F", 1458, 302);
      x.font = "bold 56px monospace";
      x.fillText(s.speedKmh.toFixed(1), 1420, 375);
      x.font = "32px sans-serif";
      x.fillText("km/h", 1632, 381);
      x.font = "29px sans-serif";
      x.fillText("\u962A\u795E\u7532\u5B50\u5712\u7403\u5834", 1460, 459);
      x.font = "24px sans-serif";
      x.fillText("\u8868\u793A\u898B\u672C \xB7 \u5DE6\u6B04\u306F\u5B88\u5099\u4F4D\u7F6E", 1440, 507);
      x.strokeStyle = "#46504b";
      x.beginPath();
      x.moveTo(8, 542);
      x.lineTo(1784, 542);
      x.stroke();
      x.font = "bold 26px sans-serif";
      x.textAlign = "right";
      x.fillText("\u4E09\u4E95\u4F4F\u53CB\u9280\u884C", 1754, 560);
    } else if (part === "koshien:clock") {
      const s = g.architecture.scoreboard ?? defaultScoreboard(), cx = 256, cy = 216, r = 181;
      x.fillStyle = "#222b2d";
      x.fillRect(0, 0, 512, 896);
      x.strokeStyle = "#e9ece6";
      x.fillStyle = "#e9ece6";
      x.lineWidth = 5;
      for (let i = 0; i < 12; i++) {
        const t2 = i * Math.PI / 6, outer = 177, inner = i % 3 === 0 ? 151 : 161;
        x.beginPath();
        x.moveTo(cx + Math.sin(t2) * inner, cy - Math.cos(t2) * inner);
        x.lineTo(cx + Math.sin(t2) * outer, cy - Math.cos(t2) * outer);
        x.stroke();
      }
      x.font = "bold 56px sans-serif";
      for (const [text, xx, yy] of [["12", cx, cy - r + 35], ["3", cx + r - 33, cy], ["6", cx, cy + r - 33], ["9", cx - r + 33, cy]]) x.fillText(text, xx, yy);
      x.lineWidth = 12;
      x.lineCap = "round";
      for (const [angle, length] of [[-Math.PI / 3, 91], [Math.PI / 3, 133]]) {
        x.beginPath();
        x.moveTo(cx, cy);
        x.lineTo(cx + Math.sin(angle) * length, cy - Math.cos(angle) * length);
        x.stroke();
      }
      x.font = "bold 75px Georgia";
      x.fillText("CITIZEN", 256, 453, 490);
      for (const [row, name, count, max, color] of [[0, "B", s.balls, 3, "#49d782"], [1, "S", s.strikes, 2, "#f0d33e"], [2, "O", s.outs, 2, "#ef4444"]]) {
        const y = 565 + row * 117;
        x.fillStyle = "#eeeee5";
        x.font = "bold 66px sans-serif";
        x.fillText(name, 67, y);
        for (let i = 0; i < max; i++) {
          x.fillStyle = s.enabled && i < count ? color : "#10201c";
          x.beginPath();
          x.arc(184 + i * 105, y, 27, 0, Math.PI * 2);
          x.fill();
        }
      }
    } else if (part.startsWith("koshien:flag")) {
      x.fillStyle = part === "koshien:flag-japan" ? "#dedfd8" : part === "koshien:flag-team" ? "#c9b74d" : "#354f5d";
      x.fillRect(0, 0, 256, 160);
      if (part === "koshien:flag-japan") {
        x.fillStyle = "#ad3a3b";
        x.beginPath();
        x.arc(128, 80, 43, 0, Math.PI * 2);
        x.fill();
      } else if (part === "koshien:flag-team") {
        x.fillStyle = "#2e3332";
        for (let i = 1; i < 5; i += 2) x.fillRect(0, i * 32, 256, 32);
      } else {
        x.font = "bold 48px sans-serif";
        x.fillStyle = "#d7ddd7";
        x.fillText("K", 128, 84);
      }
    } else if (part === "koshien:facade-wrap") {
      for (let iy = 0; iy < 128; iy++) for (let ix = 0; ix < 1024; ix++) {
        const u = ix / 1024, h = (1 - iy / 128) * 29, cover = koshienIvyCoverage(u, h), light = 0.97 + 0.03 * Math.sin(u * Math.PI * 74 + h * 0.27), stone = [165, 158, 135], ivy = [49, 79 + 8 * Math.sin(u * Math.PI * 18 + h * 0.23), 38];
        x.fillStyle = "rgb(" + stone.map((n, k2) => Math.round((n + (ivy[k2] - n) * cover) * light)).join(",") + ")";
        x.fillRect(ix * 4, iy * 4, 4, 4);
      }
      x.fillStyle = "#25463c";
      x.fillRect(0, 0, 4096, 59);
      x.fillStyle = "#819181";
      x.fillRect(0, 57, 4096, 3);
      x.fillRect(0, 207, 4096, 3);
      const count = 126, spacing = 4096 / count;
      for (let col = 0; col < count; col++) {
        const cx = (col + 0.5) * spacing;
        for (const h of [22, 14, 9]) {
          const y = (1 - h / 29) * 512;
          x.fillStyle = "#bec1ab";
          x.fillRect(cx - 6, y - 18, 12, 36);
          x.fillStyle = "#18342e";
          x.fillRect(cx - 4, y - 15, 8, 29);
          x.fillStyle = "#87917d";
          x.fillRect(cx - 6, y + 16, 12, 3);
        }
        x.fillStyle = "#1b4638";
        x.beginPath();
        x.moveTo(cx - 10, 512);
        x.lineTo(cx - 10, 459);
        x.arc(cx, 459, 10, Math.PI, Math.PI * 2);
        x.lineTo(cx + 10, 512);
        x.closePath();
        x.fill();
        x.strokeStyle = "#a5b09a";
        x.lineWidth = 2;
        x.stroke();
      }
    } else if (part === "koshien:sankyu-side") {
      x.fillStyle = "#214c39";
      x.fillRect(0, 0, 256, 512);
      x.fillStyle = "#d8bd43";
      x.font = "bold 192px sans-serif";
      x.fillText("\u5C71", 128, 145, 226);
      x.fillText("\u4E5D", 128, 365, 226);
    } else if (part === "koshien:sankyu") {
      x.fillStyle = "#e0e6de";
      x.fillRect(0, 0, 1024, 128);
      x.strokeStyle = "#a7b8b3";
      x.lineWidth = 5;
      x.strokeRect(3, 3, 1018, 122);
      x.fillStyle = "#286aab";
      x.beginPath();
      x.arc(73, 65, 48, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = "#dfe7df";
      x.font = "bold 20px sans-serif";
      x.fillText("\u5C71\u4E5D", 73, 55);
      x.font = "bold 14px sans-serif";
      x.fillText("SANKYU", 73, 77);
      x.fillStyle = "#2c659b";
      x.font = "bold 83px sans-serif";
      x.fillText("SANKYU", 570, 83, 840);
      x.font = "18px sans-serif";
      x.fillText("\u7DCF\u5408\u7269\u6D41\u30B5\u30FC\u30D3\u30B9", 570, 22);
    } else if (part === "koshien:backscreen") {
      x.fillStyle = "#15392c";
      x.fillRect(0, 0, 1024, 256);
      x.fillStyle = "#234536";
      for (let i = 0; i < 86; i++) x.fillRect(i * 12, 0, 2, 256);
      x.fillStyle = "#102b23";
      x.fillRect(0, 126, 1024, 3);
    } else if (part === "koshien:roof") {
      x.fillStyle = "#a2acae";
      x.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 18; i++) {
        x.fillStyle = i % 4 === 0 ? "#c0c7c6" : "#7e9094";
        x.fillRect(i * 60, 0, 3, 512);
      }
      x.fillStyle = "#62777e";
      for (let i = 0; i < 8; i++) x.fillRect(40 + i * 122, 235, 96, 220);
    } else if (part === "koshien:tower") {
      x.font = "bold 170px sans-serif";
      [..."\u7532\u5B50\u5712"].forEach((c2, i) => x.fillText(c2, 128, 240 + i * 250));
    } else {
      const labels = { "koshien:entrance": "\u962A\u795E\u7532\u5B50\u5712\u7403\u5834", "koshien:wall": "HANSHIN  KOSHIEN", "koshien:header": "\u962A \u795E \u7532 \u5B50 \u5712 \u7403 \u5834", "koshien:distance": "118m", "koshien:vision": "MITSUBISHI \u30AA\u30FC\u30ED\u30E9\u30D3\u30B8\u30E7\u30F3" };
      x.font = "bold 100px sans-serif";
      x.fillText(labels[part] ?? "KOSHIEN", 512, 64, 980);
    }
    const t = mipPyramid({ width: c.width, height: c.height, data: x.getImageData(0, 0, c.width, c.height).data });
    if (dynamic) {
      const slots = entry ?? {};
      slots[part] = t;
      scores.set(g, slots);
    } else cache4.set(part, t);
    return t;
  }
  function sampleKoshienMaterial(part, u, v, profile, g) {
    let fu = profile?.footprintU ?? 0, fv = profile?.footprintV ?? 0;
    if (part.startsWith("koshien:ivy:") || part.startsWith("koshien:facade:")) {
      const lower = part.startsWith("koshien:ivy:"), sector = Number(part.slice(part.lastIndexOf(":") + 1));
      u = (sector + u) / KOSHIEN_FACADE_SECTORS;
      v = (lower ? v * 17 : 17 + v * 12) / 29;
      fu /= KOSHIEN_FACADE_SECTORS;
      fv *= (lower ? 17 : 12) / 29;
      part = "koshien:facade-wrap";
    }
    const t = texture5(part, g);
    if (!t) return null;
    const s = sampleMip(t, u, 1 - v, fu, fv);
    return s ? { color: "#" + [s.r, s.g, s.b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("") } : null;
  }

  // tools/ballpark-studio/surface-layers.mjs
  var DEFAULT_SURFACE_DETAIL = Object.freeze({ factor: 3, marginMeters: 0.6, featherMeters: 0.8 });
  var rgbCache = /* @__PURE__ */ new Map();
  var rgb = (color) => {
    if (!rgbCache.has(color)) rgbCache.set(color, [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)));
    return rgbCache.get(color);
  };
  function blendMaterial(base, overlay, { brightness = 1, glow = 0 } = {}) {
    if (!base || !overlay || overlay.a <= 0) return base;
    const old = rgb(base.color), lift = Math.max(0, brightness - 1) * 0.12, n = [overlay.r, overlay.g, overlay.b].map((v) => v + (255 - v) * lift), a = Math.max(0, Math.min(1, overlay.a * brightness));
    return { ...base, color: "#" + old.map((v, i) => Math.round(v + (n[i] - v) * a).toString(16).padStart(2, "0")).join(""), logoCoverage: a, logoGlow: glow * a * 4 };
  }

  // tools/ballpark-studio/crowd.mjs
  var reactions = Object.freeze({ hit: { interval: 95, duration: 2400, priority: 2 }, home_run: { interval: 80, duration: 4500, priority: 3 }, out: { interval: 140, duration: 1400, priority: 1 }, error: { interval: 120, duration: 1800, priority: 1 } });
  var DEFAULT_CROWD_APPEARANCE = Object.freeze({ density: 0.75, detail: "simple", size: 1, brightness: 1, glow: 0.7 });
  var PENLIGHT_LENGTH_METERS = 0.07;
  var ledColors = /* @__PURE__ */ new Map();
  function ledColor(hex5) {
    if (ledColors.has(hex5)) return ledColors.get(hex5);
    const rgb5 = hex5.slice(1).match(/../g).map((v) => parseInt(v, 16)), scale = 255 / Math.max(1, ...rgb5), color = "#" + rgb5.map((v) => Math.round(Math.min(255, v * scale) * 0.88 + 255 * 0.12).toString(16).padStart(2, "0")).join("");
    ledColors.set(hex5, color);
    return color;
  }

  // tools/ballpark-studio/crowd-tiles.mjs
  var CROWD_TILE = Object.freeze({ width: 16, height: 12, frameCount: 3, variantCount: 8, occupancy: 1, individualWorldObjects: 0 });
  var cache5 = /* @__PURE__ */ new Map();
  var rgb2 = (hex5) => hex5.slice(1).match(/../g).map((v) => parseInt(v, 16));
  var hex2 = (values) => "#" + values.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  var shade = (c, k2) => hex2(rgb2(c).map((v) => v * k2));
  var seed = (n) => (Math.imul(n + 1, 2654435761) ^ n >>> 4) >>> 0;
  function crowdAtlas(colors, appearance, packed = false, wardrobe = null) {
    const key = JSON.stringify([colors, appearance, packed, wardrobe]);
    if (cache5.has(key)) return cache5.get(key);
    if (packed) return packedAtlas(colors, appearance, key);
    const clothing = (id, variant) => {
      if (wardrobe !== "mixed-yellow") return colors[id % 2];
      const slot = (id + variant * 3) % 8;
      return slot < 3 ? colors[slot % 2] : ["#e3e0d5", "#ddd8c9", "#9caaa9", "#314657", "#775452"][slot - 3];
    };
    const variants = [], W = CROWD_TILE.width, H = CROWD_TILE.height, order = [0, 3, 1, 4, 2, 5], jumps = [0, 2, 3], budget = appearance.density <= 0 ? 0 : Math.max(1, Math.min(6, Math.round(appearance.density * 6)));
    for (let variant = 0; variant < CROWD_TILE.variantCount; variant++) {
      const frames = [];
      for (let frame = 0; frame < 3; frame++) {
        const cells2 = Array.from({ length: W * H }, (_, i) => ({ color: shade(wardrobe ? clothing(Math.floor(i / W / 3) + Math.floor(i % W / 4), variant) : colors[(Math.floor(i / W / 3) + Math.floor(i % W / 4) + variant) % 2], 0.45 + seed(i + variant * 193) % 4 * 0.05), glow: 0, kind: "crowd" })), put = (x, y, color, kind = "crowd", glow = 0, cluster = null) => {
          if (x >= 0 && x < W && y >= 0 && y < H) cells2[y * W + x] = { color, glow, kind, ...cluster === null ? {} : { cluster } };
        }, active = new Set(Array.from({ length: budget }, (_, i) => order[(variant * 5 + jumps[frame] + i) % 6]));
        for (let row = 0; row < 2; row++) for (let column = 0; column < 3; column++) {
          const id = row * 3 + column, pose = (frame + (seed(id + variant * 13) >>> 8) % 3) % 3, lean = [-1, 0, 1][pose], x = 2 + column * 5 + row % 2 - (seed(id + variant * 19) & 1), y = 3 + row * 6, bx = x + lean, shirt = wardrobe ? clothing(id, variant) : colors[(column + row + variant) % 2];
          if (appearance.detail !== "lights") {
            put(bx, y + 1, shade(shirt, 0.7));
            put(bx + 1, y + 1, shade(shirt, 0.85));
            put(x, y + 2, shade(shirt, 0.65));
            put(x + 1, y + 2, shade(shirt, 0.65));
            put(bx, y, "#a99076", "head");
            put(bx + lean, y - 1, shade(shirt, 0.7));
            if (appearance.detail === "full") {
              put(bx + 1, y, "#d6bb98", "head");
              put(bx - 1, y + 1, shade(shirt, 0.6));
            }
          }
          if (active.has(id)) {
            const lx = bx, ly = y - 2 - (pose === 1 ? 1 : 0), color = hex2(rgb2(ledColor(colors[(id + row + variant) % 2])).map((v) => v * appearance.brightness));
            for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(
              lx + dx,
              ly + dy,
              dx === 0 && dy === 0 ? hex2(rgb2(color).map((v) => v * 0.7 + 255 * 0.3)) : color,
              "led",
              (appearance.glow ?? 0.7) * 9,
              id
            );
          }
        }
        frames.push(cells2);
      }
      variants.push(frames);
    }
    const atlas = { key, frames: variants[0], variants, ...CROWD_TILE, ...wardrobe ? { wardrobe } : {} };
    if (cache5.size >= 4) cache5.delete(cache5.keys().next().value);
    cache5.set(key, atlas);
    return atlas;
  }
  function packedAtlas(colors, appearance, key) {
    const W = CROWD_TILE.width, H = CROWD_TILE.height, variants = [], order = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5], budget = appearance.density <= 0 ? 0 : Math.max(1, Math.min(12, Math.round(appearance.density * 12)));
    for (let variant = 0; variant < CROWD_TILE.variantCount; variant++) {
      const base = Array.from({ length: W * H }, (_, i) => ({ color: shade(colors[(Math.floor(i / W / 4) + Math.floor(i % W / 4) + variant) % 2], 0.55 + seed(i + variant * 193) % 4 * 0.05), glow: 0, kind: "crowd" }));
      if (appearance.detail !== "lights") for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
        const x = col * 4, y = row * 4, shirt = colors[(row + col + variant) % 2];
        for (let dx = 0; dx < 4; dx++) {
          base[(y + 3) * W + x + dx] = { color: shade(shirt, 0.7 + dx % 2 * 0.12), glow: 0, kind: "crowd" };
          base[(y + 2) * W + x + dx] = { color: dx === 1 ? "#bda084" : dx === 2 ? "#dec2a0" : shade(shirt, 0.72), glow: 0, kind: dx === 1 || dx === 2 ? "head" : "crowd" };
        }
      }
      const frames = [];
      for (let frame = 0; frame < 3; frame++) {
        const cells2 = base.slice(), active = new Set(Array.from({ length: budget }, (_, i) => order[(variant * 5 + frame * 4 + i) % 12]));
        for (const id of active) {
          const row = Math.floor(id / 4), col = id % 4, pose = (frame + (seed(id + variant * 13) >>> 8) % 3) % 3, x = col * 4 + pose, y = row * 4, color = hex2(rgb2(ledColor(colors[(id + row + variant) % 2])).map((v) => v * appearance.brightness));
          for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) cells2[(y + dy) * W + x + dx] = { color: dx === 0 && dy === 0 ? hex2(rgb2(color).map((v) => v * 0.7 + 255 * 0.3)) : color, kind: "led", glow: (appearance.glow ?? 0.7) * 9, cluster: id };
        }
        frames.push(cells2);
      }
      variants.push(frames);
    }
    const atlas = { key, frames: variants[0], variants, ...CROWD_TILE, layout: "packed", pockets: 12 };
    if (cache5.size >= 4) cache5.delete(cache5.keys().next().value);
    cache5.set(key, atlas);
    return atlas;
  }
  function sampleCrowdTile(atlas, u, v, tile, frame, frames, size = 1) {
    const su = (tile % 2 ? 1 - u : u) / size, sv = v / size, block = seed(tile ^ Math.imul(Math.floor(su), 73856093) ^ Math.imul(Math.floor(sv), 19349663)), phase = (frame + (block >>> 11) % frames) % frames, index = frames === 2 ? phase * 2 : phase, fraction = (n) => n - Math.floor(n), x = Math.floor(fraction(su) * atlas.width), y = Math.floor(fraction(sv) * atlas.height), variant = atlas.variants?.[(block >>> 3) % atlas.variants.length] ?? atlas.frames;
    return variant[index][y * atlas.width + x];
  }
  var metricCache = /* @__PURE__ */ new WeakMap();
  var tints = /* @__PURE__ */ new Map();
  function metricLevels(atlas) {
    let levels = metricCache.get(atlas);
    if (levels) return levels;
    levels = atlas.variants.map((frames) => frames.map((cells2) => {
      const color = new Uint8ClampedArray(cells2.length * 4), tint = new Uint8ClampedArray(color.length), led = new Uint8ClampedArray(color.length);
      let glow = 0;
      cells2.forEach((p, i) => {
        const c = rgb2(p.color), a = i * 4;
        for (let k2 = 0; k2 < 3; k2++) color[a + k2] = tint[a + k2] = led[a + k2] = c[k2];
        color[a + 3] = 255;
        tint[a + 3] = atlas.wardrobe ? 0 : p.kind === "led" ? 0 : p.kind === "head" ? 0.3 * 255 : 0.6 * 255;
        led[a + 3] = p.kind === "led" ? 255 : 0;
        if (p.kind === "led") glow = p.glow;
      });
      const mip = (data) => mipPyramid({ width: atlas.width, height: atlas.height, data });
      return { color: mip(color), tint: mip(tint), led: mip(led), glow };
    }));
    metricCache.set(atlas, levels);
    return levels;
  }
  function sampleMetricCrowdTile(atlas, u, v, tile, frame, frames, size, footprint, seatTint, shadeDiffuse) {
    const su = (tile % 2 ? 1 - u : u) / size, sv = v / size, block = seed(tile ^ Math.imul(Math.floor(su), 73856093) ^ Math.imul(Math.floor(sv), 19349663)), phase = (frame + (block >>> 11) % frames) % frames, index = frames === 2 ? phase * 2 : phase, levels = metricLevels(atlas)[(block >>> 3) % atlas.variants.length][index], fu = footprint[0] / size, fv = footprint[1] / size, fx = su - Math.floor(su), fy = sv - Math.floor(sv), color = sampleMip(levels.color, fx, fy, fu, fv), tint = sampleMip(levels.tint, fx, fy, fu, fv), led = sampleMip(levels.led, fx, fy, fu, fv), coverage = led?.a ?? 0, body = 1 - coverage;
    let target = tints.get(seatTint);
    if (!target) {
      target = rgb2(seatTint);
      if (tints.size >= 64) tints.delete(tints.keys().next().value);
      tints.set(seatTint, target);
    }
    const total = [color.r, color.g, color.b], emitted = led ? [led.r, led.g, led.b] : [0, 0, 0], removed = tint ? [tint.r, tint.g, tint.b] : [0, 0, 0], weight = tint?.a ?? 0, diffuse = body > 1e-6 ? rgb2(shadeDiffuse(hex2(total.map((c, i) => (c - emitted[i] * coverage - removed[i] * weight + target[i] * weight) / body)))) : [0, 0, 0];
    return { color: hex2(diffuse.map((c, i) => c * body + emitted[i] * coverage)), glow: levels.glow * coverage, alpha: 1 };
  }

  // tools/ballpark-studio/paypay-layout.mjs
  var PAYPAY = Object.freeze({ centerZ: 46, outerRadius: 111, roofRadius: 106, eaveY: 38, apexY: 68, rotationRadians: 2 * Math.PI / 3 });
  var TAU2 = 2 * Math.PI;
  var fieldCache = /* @__PURE__ */ new WeakMap();
  function fieldLayout(g) {
    let value = fieldCache.get(g);
    if (!value) {
      const parameters2 = paypayFoulParameters(g), nodes = paypayFoulNodes(parameters2.foul, g.fencePoints, false), vertices = [...nodes.map((p) => ({ ...p, x: Math.sin(p.angleDegrees * Math.PI / 180) * p.distanceMeters, z: Math.cos(p.angleDegrees * Math.PI / 180) * p.distanceMeters })), ...g.fencePoints].sort((a, b) => a.angleDegrees - b.angleDegrees);
      value = { ...parameters2, bowl: { ...g, vertices } };
      fieldCache.set(g, value);
    }
    return value;
  }
  function paypayOuter(t, y = 0, r = PAYPAY.outerRadius) {
    return { x: r * Math.sin(t), y, z: PAYPAY.centerZ + r * Math.cos(t) };
  }
  function paypayBowlPoint(g, t, offset, y) {
    const w = wallAt(fieldLayout(g).bowl, t), p = w.position, n = Math.hypot(p.x, p.z - PAYPAY.centerZ), nx = p.x / n, nz = (p.z - PAYPAY.centerZ) / n, d = offset + paypayTerraceWidth(t);
    return { x: p.x + nx * d, y, z: p.z + nz * d };
  }
  function paypaySeatPoint(g, t, v, y) {
    const w = wallAt(g, t), inner = paypayBowlPoint(g, t, 2, y), dx = Math.sin(t), dz = Math.cos(t), cz = PAYPAY.centerZ, outerR = cz * dz + Math.sqrt((PAYPAY.outerRadius - 8) ** 2 - cz * cz * dx * dx);
    if (y >= 2.1 && y <= 15.2) {
      const f = fieldLayout(g), b = wallAt(f.bowl, t), p = b.position, side = p.x < 0 ? f.foul.thirdSideMeters : f.foul.firstSideMeters, pole = f.pole(p.x < 0 ? -1 : 1), inset = Math.abs(t) > Math.PI / 4 && p.z > 0 ? paypayPremiumInset(p.z, pole.z, side) : 0, front = Math.max(2.4, b.heightMeters + 0.6 + (paypayTerraceWidth(t) > 0 ? 1.5 : 0), 2.4 + 3.4 * Math.min(1, inset / 7));
      y += (front - 2.4) * (15.2 - y) / (15.2 - 2.4);
    }
    return { x: inner.x + (dx * outerR - inner.x) * v, y, z: inner.z + (dz * outerR - inner.z) * v };
  }
  function paypayPremiumSection(g, sign, t) {
    const f = fieldLayout(g), pole = f.pole(sign), sample = paypayFoulPoint(f.foul, pole, sign, t), w = wallAt(g, Math.atan2(sample.x, sample.z)), front = w.position, back = paypayFoulPoint(f.foul, pole, sign, t, false), width = Math.abs(back.x - front.x);
    return { front: { ...front, y: w.heightMeters + 0.05 }, back: { ...back, y: 2.4 + 3.4 * Math.min(1, width / 7) }, width };
  }
  function paypayTerraceSection(g, t) {
    const w = wallAt(g, t), p = w.position, width = paypayTerraceWidth(t), n = Math.hypot(p.x, p.z - PAYPAY.centerZ);
    return { front: { ...p, y: w.heightMeters + 0.04 }, back: { x: p.x + p.x / n * width, y: w.heightMeters + 1.5, z: p.z + (p.z - PAYPAY.centerZ) / n * width }, width };
  }
  function paypayRoofPoint(leaf, u, v, openingPercent, under = false) {
    const shift = (leaf === 0 ? 1 : leaf === 2 ? -1 : 0) * PAYPAY.rotationRadians * openingPercent / 100, theta = -Math.PI + leaf * TAU2 / 3 + (u * 1.08 - 0.04) * TAU2 / 3 + shift, r = v * PAYPAY.roofRadius, level = [1.4, 0, 2.8][leaf], y = PAYPAY.eaveY + (PAYPAY.apexY - PAYPAY.eaveY - 2.8) * Math.cos(v * Math.PI / 2) + level - (under ? 2.3 : 0);
    return { x: r * Math.sin(theta), y, z: PAYPAY.centerZ + r * Math.cos(theta) };
  }

  // tools/ballpark-studio/paypay-display-layout.mjs
  function paypayDisplayLayout() {
    const radius = 94, topY = 38.4, widths = [33.6, 33.28, 58.88, 33.28, 33.6], heights = [5.76, 9.6, 15.36, 9.6, 5.76], total = widths.reduce((a, b) => a + b, 0);
    let angle = -total / (2 * radius);
    const boards = widths.map((width, index) => {
      const start = angle, end = start + width / radius, theta = (start + end) / 2;
      angle = end;
      const height = heights[index], center = paypayOuter(theta, topY - height, radius);
      return { index, role: index === 2 ? "scoreboard" : "monitor", width, height, baseY: topY - height, topY, start, end, theta, x: center.x, z: center.z };
    });
    return { radius, topY, totalWidth: total, start: boards[0].start, end: boards.at(-1).end, boards };
  }
  function paypayDisplayPoint(layout, board, u, y, offset = 0) {
    return paypayOuter(board.start + (board.end - board.start) * u, y, layout.radius + offset);
  }
  function paypaySuiteClearance(p, layout = paypayDisplayLayout()) {
    const theta = Math.atan2(p.x, p.z - PAYPAY.centerZ);
    let cap = 35;
    for (const b of layout.boards) {
      const distance = Math.max(b.start - 0.07 - theta, theta - b.end - 0.07, 0), t = Math.min(1, distance / 0.07), blend = t * t * (3 - 2 * t);
      cap = Math.min(cap, b.baseY - 0.7 + (35 - b.baseY + 0.7) * blend);
    }
    return cap;
  }
  function paypaySeatElevation(p, y, layout) {
    if (y < 17.1 || y > 29.3) return y;
    const cap = Math.min(29.2, paypaySuiteClearance(p, layout));
    return 17.1 + (y - 17.1) * (cap - 17.1) / (29.2 - 17.1);
  }

  // tools/ballpark-studio/paypay-mesh.mjs
  var TAU3 = 2 * Math.PI;
  function paypayMesh(g) {
    const display = paypayDisplayLayout(), a = g.architecture, s = a.scoreboard ?? defaultScoreboard(), surfaces = [], segments = [], lights = [], illuminationFixtures = [], N2 = 120;
    let tiles = 0;
    const face = (id, points, color, opts = {}) => surfaces.push({ id: "paypay-" + id + "-" + surfaces.length, points, color, roof: false, detailDensity: 2, ...opts }), line = (id, p, q, color, roof = false, density = 1) => segments.push({ id: "paypay-" + id, p, q, color, roof, detailDensity: density }), seat = (t, v, y) => {
      const p = paypaySeatPoint(g, t, v, y);
      p.y = paypaySeatElevation(p, y, display);
      return p;
    }, quad = (t, u, v, w, y, z) => [seat(t, v, y), seat(u, v, y), seat(u, w, z), seat(t, w, z)], shell = (t, y, r = 111) => paypayOuter(t, y, r), panel = (id, x, z, w, y, h, color, material = null, angle = 0) => {
      const tangent = { x: Math.cos(angle), z: -Math.sin(angle) }, point = (n, yy) => ({ x: x + tangent.x * n, y: yy, z: z + tangent.z * n });
      face(id, [point(-w / 2, y), point(w / 2, y), point(w / 2, y + h), point(-w / 2, y + h)], color, { material });
      return { point };
    }, beam = (id, p, q, width, color, roof = false) => {
      const dx = q.x - p.x, dz = q.z - p.z, n = Math.hypot(dx, dz) || 1, ox = -dz / n * width / 2, oz = dx / n * width / 2;
      face(id, [{ x: p.x + ox, y: p.y, z: p.z + oz }, { x: q.x + ox, y: q.y, z: q.z + oz }, { x: q.x - ox, y: q.y, z: q.z - oz }, { x: p.x - ox, y: p.y, z: p.z - oz }], color, { roof, detailDensity: roof ? 4 : 2 });
    };
    for (let i = 0; i < g.vertices.length - 1; i++) {
      const p = g.vertices[i], q = g.vertices[i + 1];
      face("fence", [{ ...p, y: 0 }, { ...q, y: 0 }, { ...q, y: q.heightMeters }, { ...p, y: p.heightMeters }], "#153d32", { material: i % 4 === 0 ? "paypay:wall" : null });
      line("fence-cap", { ...p, y: p.heightMeters }, { ...q, y: q.heightMeters }, "#bcab53");
    }
    const decks = [{ v0: 0.025, v1: 0.49, y0: 2.4, y1: 15.2, bands: 8 }, { v0: 0.55, v1: 0.96, y0: 17.4, y1: 29.2, bands: 7 }];
    for (let i = 0; i < N2; i++) {
      const t = -Math.PI + i * TAU3 / N2, u = t + TAU3 / N2, aisle = i % 6 === 0;
      const p = seat(t, 0.025, 2.4), q = seat(u, 0.025, 2.4), edgeT = paypayBowlPoint(g, t, 0, p.y - 0.15), edgeU = paypayBowlPoint(g, u, 0, q.y - 0.15);
      face("lower-apron", [edgeT, edgeU, q, p], "#405348", { detailDensity: 3 });
      for (let tier = 0; tier < decks.length; tier++) {
        const d = decks[tier];
        for (let band = 0; band < d.bands; band++) {
          const v = d.v0 + (d.v1 - d.v0) * band / d.bands, w = d.v0 + (d.v1 - d.v0) * (band + 1) / d.bands, y = d.y0 + (d.y1 - d.y0) * band / d.bands, z = d.y0 + (d.y1 - d.y0) * (band + 1) / d.bands;
          face(aisle ? "steps" : "seats", quad(t, u, v, w, y, z), aisle ? "#7b8274" : tier ? "#35644b" : "#416953", aisle ? {} : { crowdTile: { id: tiles++, tier, band, sector: i, seatTint: "#35614b" } });
          face("tier-underside", quad(t, u, v, w, y - 0.3, z - 0.3), "#324339");
          if (band % 2 === 1) line("seat-row", seat(t, w, z + 0.02), seat(u, w, z + 0.02), "#526f5c");
        }
      }
      face("cross-concourse", quad(t, u, 0.49, 0.55, 15.2, 15.2), "#777d6a");
      face("concourse-fascia", [seat(t, 0.55, 15.2), seat(u, 0.55, 15.2), seat(u, 0.55, 17.4), seat(t, 0.55, 17.4)], "#475a4a");
      const suiteY = Math.min(paypaySuiteClearance(seat(t, 0.98, 35), display), paypaySuiteClearance(seat(u, 0.98, 35), display));
      if (suiteY > 29.5) face("suite-band", [seat(t, 0.98, 29.5), seat(u, 0.98, 29.5), seat(u, 0.98, suiteY), seat(t, 0.98, suiteY)], "#a9a07f", { material: "paypay:suite" });
      face("exterior", [shell(t, 0), shell(u, 0), shell(u, 38), shell(t, 38)], "#aaa99c");
      face("lower-foot", [shell(t, -0.2, 111), shell(u, -0.2, 111), shell(u, -0.2, 120), shell(t, -0.2, 120)], "#626b66", { detailDensity: 1 });
      const m = (t + u) / 2, slit = 7e-3;
      face("upper-slit", [shell(m - slit, 30.5, 111.06), shell(m + slit, 30.5, 111.06), shell(m + slit, 35.6, 111.06), shell(m - slit, 35.6, 111.06)], "#625f4c");
      face("rail-ring", [shell(t, 38, 106), shell(u, 38, 106), shell(u, 38, 111), shell(t, 38, 111)], "#6e7770", { roof: true });
      line("rim-top", shell(t, 38), shell(u, 38), "#c7c5b7");
      line("rim-bottom", shell(t, 0), shell(u, 0), "#727d76");
      if (i % 10 === 0) {
        const f = shell(m, 1.1, 115);
        illuminationFixtures.push({ ...f, target: shell(m, 24, 111), kind: "facade", power: 0.65 });
      }
      if (i % 3 === 0) {
        const f = shell(m, 39.5, 98), target = { x: -f.x * 0.22, y: 0, z: 46 + (46 - f.z) * 0.15 };
        illuminationFixtures.push({ ...f, target, kind: "field", power: 1.1 });
        for (let row = 0; row < 2; row++) {
          const p2 = shell(t + 6e-3, 39.5 + row * 0.65, 98), q2 = shell(u - 6e-3, 39.5 + row * 0.65, 98);
          face("lamp-bank", [p2, q2, { ...q2, y: q2.y + 0.36 }, { ...p2, y: p2.y + 0.36 }], "#fff6dc");
        }
      }
    }
    const blend = (section, v) => ({ x: section.front.x + (section.back.x - section.front.x) * v, y: section.front.y + (section.back.y - section.front.y) * v, z: section.front.z + (section.back.z - section.front.z) * v });
    for (const side of [-1, 1]) {
      for (let i = 4; i < 32; i++) {
        const p2 = paypayPremiumSection(g, side, i / 32), q2 = paypayPremiumSection(g, side, (i + 1) / 32);
        for (let row = 0; row < 4; row++) face("premium-seats", [blend(p2, row / 4), blend(q2, row / 4), blend(q2, (row + 1) / 4), blend(p2, (row + 1) / 4)], "#763c38", { crowdTile: { id: tiles++, tier: 0, band: row, sector: side * i, seatTint: "#763c38" } });
      }
      const p = paypayPremiumSection(g, side, 0.02), q = paypayPremiumSection(g, side, 0.14);
      beam("dugout-roof", { ...p.back, y: 1.8 }, { ...q.back, y: 1.8 }, 3.1, "#243d34");
    }
    for (let i = 0; i < g.fencePoints.length - 1; i++) {
      const a2 = g.fencePoints[i], b = g.fencePoints[i + 1], p = paypayTerraceSection(g, a2.angleDegrees * Math.PI / 180), q = paypayTerraceSection(g, b.angleDegrees * Math.PI / 180);
      if (Math.max(p.width, q.width) < 0.01) continue;
      for (let row = 0; row < 3; row++) face("terrace-seats", [blend(p, row / 3), blend(q, row / 3), blend(q, (row + 1) / 3), blend(p, (row + 1) / 3)], "#8b8f79", { crowdTile: { id: tiles++, tier: 0, band: row, sector: i, seatTint: "#8b8f79" } });
      line("terrace-rail", p.back, q.back, "#b9c1a9");
    }
    const boards = display.boards;
    for (const board of boards) {
      const count = Math.ceil(board.width / 4), point = (u, y, o = 0) => paypayDisplayPoint(display, board, u, y, o), part = board.role === "scoreboard" ? "paypay:vision" : "paypay:monitor-" + board.index;
      for (let i = 0; i < count; i++) {
        const u = i / count, v = (i + 1) / count, at = (u2, y, vv, o = 0) => ({ ...point(u2, y, o), u: u2, v: vv });
        face("vision-housing", [point(u, board.baseY - 0.45, 0.45), point(v, board.baseY - 0.45, 0.45), point(v, board.topY + 0.45, 0.45), point(u, board.topY + 0.45, 0.45)], "#343d39");
        face("score-vision-" + board.index, [at(u, board.baseY, 0, -0.12), at(v, board.baseY, 0, -0.12), at(v, board.topY, 1, -0.12), at(u, board.topY, 1, -0.12)], "#11191b", { material: s.enabled ? part : null });
        face("vision-top-frame", [point(u, board.topY, 0), point(v, board.topY, 0), point(v, board.topY + 0.45, 0), point(u, board.topY + 0.45, 0)], "#869181");
        face("vision-bottom-frame", [point(u, board.baseY - 0.45, 0), point(v, board.baseY - 0.45, 0), point(v, board.baseY, 0), point(u, board.baseY, 0)], "#67776b");
        face("vision-back", [point(v, board.baseY - 0.45, 1), point(u, board.baseY - 0.45, 1), point(u, board.topY + 0.45, 1), point(v, board.topY + 0.45, 1)], "#3d4d42");
        face("vision-podium", [point(u, board.baseY - 1.8, 0.45), point(v, board.baseY - 1.8, 0.45), point(v, board.baseY - 0.45, 0.45), point(u, board.baseY - 0.45, 0.45)], "#536355");
      }
      for (const u of [0, 1]) {
        face("vision-end", [point(u, board.baseY - 0.45, 0), point(u, board.baseY - 0.45, 1), point(u, board.topY + 0.45, 1), point(u, board.topY + 0.45, 0)], "#4c5a4c");
      }
      for (const u of [0.18, 0.5, 0.82]) beam("vision-support", point(u, 19, 1), point(u, board.baseY - 0.45, 1), 0.55, "#465048");
    }
    const cf = wallAt(g, 0).distanceMeters;
    panel("batters-eye", 0, cf + 0.3, 17, 0, 8.8, "#102f27");
    for (const side of [-1, 1]) {
      const c = shell(side * 0.23, 46, 93);
      panel("sponsor", c.x, c.z, 15.5, 43, 3.7, "#9d292c", a.details?.logos !== false ? "paypay:upper-ad" : null, side * 0.23);
    }
    const opening = a.roof.openingPercent, angular = 24, rings = 10;
    for (let leaf = 0; leaf < 3; leaf++) for (let i = 0; i < angular; i++) for (let j = 0; j < rings; j++) {
      const u = i / angular, v = (i + 1) / angular, r = j / rings, w = (j + 1) / rings, point = (uu, vv, under = false) => paypayRoofPoint(leaf, uu, vv, opening, under), p = point(u, r), q = point(v, r), h = point(v, w), k2 = point(u, w);
      face("roof-skin-" + leaf, j === 0 ? [p, h, k2] : [p, q, h, k2], j % 2 ? "#626b62" : "#697067", { roof: true, detailDensity: 3 });
      if (j > 0) {
        const a0 = point(u, r, true), b0 = point(v, r, true), c0 = point(v, w, true), d0 = point(u, w, true);
        beam("roof-lower-chord", a0, b0, 0.48, "#abb7a6", true);
        beam("roof-lower-chord", a0, d0, 0.48, "#abb7a6", true);
        beam("roof-diagonal", i % 2 ? a0 : b0, i % 2 ? c0 : d0, 0.3, "#91a08c", true);
        if (i % 3 === 0 && j % 2 === 0) {
          beam("roof-web", a0, point(v, w), 0.12, "#7b887a", true);
          beam("roof-web", point(u, r), c0, 0.12, "#7b887a", true);
        }
      }
    }
    for (let leaf = 0; leaf < 3; leaf++) for (const u of [0, 1]) for (let j = 0; j < 10; j++) {
      const p = paypayRoofPoint(leaf, u, j / 10, opening), q = paypayRoofPoint(leaf, u, (j + 1) / 10, opening), r = paypayRoofPoint(leaf, u, (j + 1) / 10, opening, true), h = paypayRoofPoint(leaf, u, j / 10, opening, true);
      face("roof-panel-edge", [p, q, r, h], "#6e796b", { roof: true, detailDensity: 3 });
    }
    for (let i = -7; i < 7; i++) {
      const t = Math.PI + i * 0.035, u = t + 0.035;
      for (let row = 0; row < 4; row++) {
        const y = 3 + row * 4.6;
        face("entry-glass", [shell(t + 3e-3, y, 111.12), shell(u - 3e-3, y, 111.12), shell(u - 3e-3, y + 3.8, 111.12), shell(t + 3e-3, y + 3.8, 111.12)], "#6a756b");
      }
      beam("entry-pier", shell(t, 2.5, 111.4), shell(t, 23.5, 111.4), 0.6, "#c4bfa9");
    }
    panel("entry-name", 0, 46 - 111 - 0.3, 49, 25, 4, "#a9a99e", a.details?.logos !== false ? "paypay:entry" : null);
    for (let i = 0; i < 4; i++) {
      const y = -0.1 + i * 0.25, r = 120 - i * 2;
      face("entry-step", [shell(2.83, y, r), shell(3.45, y, r), shell(3.45, y, r - 2), shell(2.83, y, r - 2)], "#92958a");
    }
    return {
      surfaces,
      segments,
      lights,
      illuminationFixtures,
      capacity: a.capacity,
      tiers: 3,
      rowsPerTier: decks.map((d) => d.bands),
      spectatorTiles: tiles,
      spectatorLights: 0,
      seating: { decks: 2, upperSuites: true, crossConcourse: true },
      envelope: { rx: 111, rz: 111, centerZ: 46, frontZ: -65, bowlTop: 29.2, eaveY: 38, topY: 68, exponent: 2 },
      roof: { type: "three_layer_rotating_shells", openingPercent: opening, leafCount: 3, movingLeafCount: 2, rotationDegrees: 120, trussDepthMeters: 2.3 },
      scoreboard: { enabled: s.enabled, mode: "DESIGN_SAMPLE", layout: "fukuoka_continuous_panorama", display, boards, z: display.boards[2].z, baseY: display.boards[2].baseY, scale: 0.55, teams: s.teams.map((t) => ({ ...t, runs: runs(t) })), balls: s.balls, strikes: s.strikes, outs: s.outs, speedKmh: s.speedKmh }
    };
  }

  // tools/ballpark-studio/niikura-scoreboard-material.mjs
  var portrait = null;
  var cache6 = /* @__PURE__ */ new Map();
  function niikuraBoardTexture(g) {
    if (typeof document === "undefined") return null;
    const board = g.architecture.scoreboard ?? defaultScoreboard(), key = JSON.stringify([board, !!portrait]);
    let t = cache6.get(key);
    if (t) return t;
    const s = board.niikura ?? defaultNiikuraScoreboard(), field = scoreboardFieldDiagram(g.architecture), canvas = document.createElement("canvas");
    canvas.width = 3072;
    canvas.height = 1280;
    const x = canvas.getContext("2d", { willReadFrequently: true });
    x.scale(0.8, 0.8);
    const gold = "#eac867", white = "#f3f1dc", green = "#07291f";
    const text = (value, cx, cy, width, size = 60, color = white, serif = false) => {
      const str = String(value);
      x.font = `bold ${size}px ${serif ? "Georgia, serif" : "sans-serif"}`;
      const measured = x.measureText(str).width;
      if (measured > width) x.font = `bold ${Math.max(16, size * width / measured)}px ${serif ? "Georgia, serif" : "sans-serif"}`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      x.fillStyle = color;
      x.fillText(str, cx, cy);
    }, line = (a, b, c, d, width = 3, color = gold) => {
      x.strokeStyle = color;
      x.lineWidth = width;
      x.beginPath();
      x.moveTo(a, b);
      x.lineTo(c, d);
      x.stroke();
    }, box = (a, b, w2, h, width = 3, color = gold) => {
      x.strokeStyle = color;
      x.lineWidth = width;
      x.strokeRect(a, b, w2, h);
    }, diamond = (cx, cy, r, color) => {
      x.fillStyle = color;
      x.beginPath();
      x.moveTo(cx, cy - r);
      x.lineTo(cx + r, cy);
      x.lineTo(cx, cy + r);
      x.lineTo(cx - r, cy);
      x.closePath();
      x.fill();
    };
    const gradient = x.createLinearGradient(0, 0, 0, 1600);
    gradient.addColorStop(0, "#103d2c");
    gradient.addColorStop(0.5, "#03170f");
    gradient.addColorStop(1, "#092e21");
    x.fillStyle = gradient;
    x.fillRect(0, 0, 3840, 1600);
    box(20, 20, 3800, 1560, 13);
    box(40, 40, 3760, 1520, 3, "#fff0b3");
    text("Kneekura Dome", 1920, 160, 3300, 205, gold, true);
    line(55, 285, 3785, 285, 8);
    for (let team = 0; team < 2; team++) {
      const left = 65 + team * 535, w2 = 515;
      box(left, 315, w2, 1190);
      text(board.teams[team].name, left + w2 / 2, 380, w2 - 25, 58, gold, true);
      line(left, 440, left + w2, 440);
      text("\u6253\u9806", left + 55, 480, 95, 44, gold);
      text("\u9078\u624B\u540D", left + 275, 480, 310, 44, gold);
      text("\u5B88\u5099", left + 460, 480, 90, 44, gold);
      for (let row = 0; row < 9; row++) {
        const y = 575 + row * 98, p = s.lineups[team][row];
        line(left, y + 48, left + w2, y + 48, 2, "#8c7b42");
        text(row + 1, left + 55, y, 90, 62, gold);
        text(p.name, left + 265, y, 310, 60);
        text(p.position, left + 463, y, 90, 62);
      }
      line(left + 110, 440, left + 110, 1505, 2);
      line(left + 412, 440, left + 412, 1505, 2);
    }
    const start = 1160, w = 1510, nameWidth = 240, cell = (w - nameWidth) / 12;
    box(start, 315, w, 335);
    for (let row = 0; row < 3; row++) line(start, 405 + row * 112, start + w, 405 + row * 112, 2);
    for (let col = 0; col < 12; col++) {
      const cx = start + nameWidth + (col + 0.5) * cell;
      text(col < 9 ? col + 1 : ["R", "H", "E"][col - 9], cx, 362, cell - 8, 58, gold);
      line(start + nameWidth + col * cell, 315, start + nameWidth + col * cell, 650, 2);
    }
    for (let row = 0; row < 2; row++) {
      const team = board.teams[row], y = 461 + row * 112;
      text(team.name, start + nameWidth / 2, y, nameWidth - 15, 48, gold, true);
      [...team.innings, runs(team), team.hits, team.errors].forEach((v, i) => text(v === null ? "\u2013" : v, start + nameWidth + (i + 0.5) * cell, y, cell - 8, 70));
    }
    box(start, 674, w, 125);
    text(s.inning + "\u56DE" + (s.half === "top" ? "\u8868" : "\u88CF"), start + 170, 736, 300, 91);
    for (const [label, count, max, color, left] of [["B", board.balls, 3, "#35e87f", 1540], ["S", board.strikes, 2, "#ffd244", 2015], ["O", board.outs, 2, "#f04f58", 2350]]) {
      text(label, left + 35, 736, 70, 78);
      for (let i = 0; i < max; i++) {
        x.fillStyle = i < count ? color : "#18372b";
        x.beginPath();
        x.arc(left + 125 + i * 95, 736, 34, 0, Math.PI * 2);
        x.fill();
      }
    }
    const plot = { x: start, y: 825, w, h: 540 }, point = (p) => {
      const q = projectFieldDiagramPoint(p);
      return { x: plot.x + q.u * plot.w, y: plot.y + q.v * plot.h };
    };
    x.fillStyle = "#1a4c2e";
    x.fillRect(plot.x, plot.y, plot.w, plot.h);
    for (let i = 0; i < 12; i++) {
      x.fillStyle = i % 2 ? "#285d34" : "#24552f";
      x.fillRect(plot.x + i * plot.w / 12, plot.y, plot.w / 12, plot.h);
    }
    const home = point({ x: 0, z: 0 }), bases = SCOREBOARD_BASES.map(point);
    x.fillStyle = "#947045";
    x.beginPath();
    x.moveTo(home.x, home.y);
    for (const p of bases) x.lineTo(p.x, p.y);
    x.closePath();
    x.fill();
    x.strokeStyle = "#f4e5b6";
    x.lineWidth = 4;
    x.stroke();
    if (field?.enabled) {
      for (let i = 0; i < 3; i++) diamond(bases[i].x, bases[i].y, field.runners[SCOREBOARD_BASES[i].id] ? 24 : 10, field.runners[SCOREBOARD_BASES[i].id] ? "#ffcf45" : "#e9e6c3");
      for (const d of field.defenders) {
        const q = point(d);
        x.fillStyle = "#092b21";
        x.fillRect(q.x - 112, q.y - 33, 224, 66);
        box(q.x - 112, q.y - 33, 224, 66, 2);
        text(d.label, q.x, q.y, 211, 51);
      }
    }
    box(start, 1380, w, 110);
    ["\u6295\u7403\u6570 " + s.pitcher.pitchCount + "\u7403", "\u7403\u901F " + Number(board.speedKmh.toFixed(1)) + " km/h", "\u9632\u5FA1\u7387 " + s.pitcher.era.toFixed(2)].forEach((v, i) => text(v, start + (i + 0.5) * w / 3, 1435, w / 3 - 30, 56));
    const right = 2740;
    box(right, 315, 1035, 1190);
    if (s.portrait && portrait) {
      const crop = { x: portrait.width * 0.694, y: portrait.height * 0.217, w: portrait.width * 0.162, h: portrait.height * 0.426 };
      x.drawImage(portrait, crop.x, crop.y, crop.w, crop.h, right + 12, 327, 570, 760);
    } else {
      x.fillStyle = "#194c37";
      x.fillRect(right + 12, 327, 570, 760);
      x.fillStyle = "#65806b";
      x.beginPath();
      x.arc(right + 297, 565, 125, 0, Math.PI * 2);
      x.fill();
      x.beginPath();
      x.ellipse(right + 297, 970, 235, 235, 0, Math.PI, 0);
      x.fill();
    }
    text(s.batter.number, right + 800, 450, 420, 170, gold, true);
    text(s.batter.name, right + 800, 610, 415, 74);
    [["\u6253\u7387", s.batter.average.toFixed(3).replace(/^0/, "")], ["\u672C\u5841\u6253", s.batter.homeRuns], ["\u6253\u70B9", s.batter.rbis]].forEach(([label, value], i) => {
      const y = 778 + i * 125;
      line(right + 610, y - 63, right + 1020, y - 63, 2);
      text(label, right + 708, y, 180, 50);
      text(value, right + 923, y, 195, 77);
    });
    x.fillStyle = "#061d14";
    x.fillRect(right + 12, 1120, 1010, 370);
    box(right + 14, 1120, 1007, 368, 9);
    box(right + 30, 1137, 975, 334, 2);
    text("\u5E74\u4FF8", right + 520, 1186, 850, 95, gold);
    text(formatSalaryManYen(s.batter.salaryManYen), right + 520, 1362, 955, 173, "#ffe4a0", true);
    for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
      const xx = right + 520 + side * (475 - i * 5), yy = 1157 + i * 46;
      x.fillStyle = gold;
      x.beginPath();
      x.ellipse(xx, yy, 5, 15, side * 0.65, 0, Math.PI * 2);
      x.fill();
    }
    text("\u9078\u624B\u30FB\u6210\u7E3E\u30FB\u5E74\u4FF8\u306F\u8868\u793A\u30B5\u30F3\u30D7\u30EB", 3260, 1540, 1e3, 29);
    t = mipPyramid({ width: canvas.width, height: canvas.height, data: x.getImageData(0, 0, canvas.width, canvas.height).data });
    if (cache6.size >= 2) cache6.delete(cache6.keys().next().value);
    cache6.set(key, t);
    return t;
  }
  function sampleNiikuraBoard(g, u, v, profile) {
    const t = niikuraBoardTexture(g);
    if (!t) return null;
    const c = sampleMip(t, u, 1 - v, profile?.footprintU ?? 0, profile?.footprintV ?? 0);
    return c ? { color: "#" + [c.r, c.g, c.b].map((v2) => Math.round(v2).toString(16).padStart(2, "0")).join(""), logoGlow: 0.04 * Math.max(c.r, c.g, c.b) / 255 } : null;
  }

  // tools/ballpark-studio/niikura-materials.mjs
  var rgb3 = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  var hex3 = (v) => "#" + v.map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
  var mixNiikura = (a, b, t) => hex3(rgb3(a).map((v, i) => v * (1 - t) + rgb3(b)[i] * t));
  function niikuraMosaic(u, v, c) {
    const x = Math.floor((u % 1 + 1) % 1 * 112), y = Math.floor(Math.max(0, Math.min(0.99999, v)) * 28), block = Math.floor(x / 2), h = (Math.imul(block + 31, 2654435761) ^ Math.imul(Math.floor(y / (block % 3 === 0 ? 2 : 1)) + 17, 1597334677)) >>> 0, palette = [c.red, c.red, c.blue, c.gold, mixNiikura(c.red, c.gold, 0.23), c.red, c.blue, mixNiikura(c.red, "#091f17", 0.3)];
    return palette[h % palette.length];
  }
  var cache7 = /* @__PURE__ */ new Map();
  function texture6(part, g) {
    if (typeof document === "undefined") return null;
    const c = g.architecture.colors, s = g.architecture.scoreboard ?? defaultScoreboard(), env = g.architecture.effects?.environment, l = g.architecture.effects?.lighting, night = env?.period !== "day" && l?.enabled !== false, key = JSON.stringify([part, c, night, part.startsWith("niikura:screen") ? s : null]);
    if (cache7.has(key)) return cache7.get(key);
    const canvas = document.createElement("canvas");
    canvas.width = part === "niikura:mosaic" ? 2048 : 1024;
    canvas.height = part === "niikura:mosaic" ? 512 : part === "niikura:entry" ? 160 : 512;
    const x = canvas.getContext("2d", { willReadFrequently: true });
    x.fillStyle = c.red;
    x.fillRect(0, 0, canvas.width, canvas.height);
    x.textAlign = "center";
    x.textBaseline = "middle";
    if (part === "niikura:mosaic") {
      for (let y = 0; y < 28; y++) for (let col = 0; col < 112; col++) {
        x.fillStyle = niikuraMosaic((col + 0.5) / 112, (y + 0.5) / 28, c);
        x.fillRect(col * canvas.width / 112, y * canvas.height / 28, canvas.width / 112 + 1, canvas.height / 28 + 1);
      }
    } else if (part === "niikura:vip") {
      x.fillStyle = mixNiikura(c.red, "#061c15", 0.6);
      x.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 12; i++) {
        const left = (i + 0.5) * 1024 / 12 - 33.5;
        x.fillStyle = night ? "#efcc73" : "#487b69";
        x.fillRect(left, 55, 67, 365);
        x.fillStyle = night ? "#f7e7b9" : "#a0b7a6";
        x.fillRect(left + 7, 65, 5, 350);
      }
      x.fillStyle = c.blue;
      x.fillRect(0, 438, 1024, 17);
    } else if (part === "niikura:entry") {
      x.fillStyle = mixNiikura(c.red, "#00150c", 0.5);
      x.fillRect(0, 0, 1024, 160);
      x.strokeStyle = c.blue;
      x.lineWidth = 5;
      x.strokeRect(7, 7, 1010, 146);
      x.strokeStyle = c.gold;
      x.lineWidth = 2;
      x.strokeRect(15, 15, 994, 130);
      x.fillStyle = night ? "#ffe8a6" : c.blue;
      x.font = "bold 90px Georgia, serif";
      x.fillText("Kneekura Dome", 512, 83, 920);
    } else if (part === "niikura:doors") {
      x.fillStyle = "#07281e";
      x.fillRect(0, 0, 1024, 512);
      for (let i = 0; i < 4; i++) {
        x.fillStyle = night ? "#c69b4d" : "#41705b";
        x.fillRect(22 + i * 252, 24, 226, 464);
        x.fillStyle = night ? "#f3d899" : "#81a990";
        x.fillRect(32 + i * 252, 38, 11, 430);
        x.fillStyle = c.blue;
        x.fillRect(122 + i * 252, 242, 5, 70);
      }
      x.fillStyle = c.blue;
      x.fillRect(0, 6, 1024, 10);
    } else if (part.startsWith("niikura:video:")) {
      const index = Number(part.split(":")[2]);
      x.fillStyle = "#08291e";
      x.fillRect(0, 0, 1024, 512);
      x.fillStyle = "#3f895a";
      x.fillRect(0, 325, 1024, 187);
      x.fillStyle = c.blue;
      x.font = "bold 62px sans-serif";
      x.fillText("KNEEKURA DOME", 512, 65);
      x.save();
      x.translate(index % 2 === 0 ? 480 : 540, 290);
      x.rotate(index % 2 === 0 ? -0.25 : 0.2);
      x.strokeStyle = c.gold;
      x.lineWidth = 40;
      x.lineCap = "round";
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(-80, 100);
      x.moveTo(0, 0);
      x.lineTo(80, 100);
      x.moveTo(0, -90);
      x.lineTo(0, 0);
      x.moveTo(0, -75);
      x.lineTo(-85, -45);
      x.moveTo(0, -75);
      x.lineTo(100, -145);
      x.stroke();
      x.fillStyle = c.blue;
      x.beginPath();
      x.arc(0, -130, 35, 0, Math.PI * 2);
      x.fill();
      x.restore();
      x.fillStyle = c.gold;
      x.font = "bold 48px sans-serif";
      x.fillText("LIVE", 512, 458);
    } else if (part === "niikura:membrane") {
      x.fillStyle = mixNiikura(c.gold, c.red, 0.08);
      x.fillRect(0, 0, 1024, 512);
      x.strokeStyle = mixNiikura(c.gold, c.red, 0.25);
      x.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        x.beginPath();
        x.moveTo(i * 128, 0);
        x.lineTo(i * 128 + 40, 512);
        x.stroke();
      }
    }
    const t = mipPyramid({ width: canvas.width, height: canvas.height, data: x.getImageData(0, 0, canvas.width, canvas.height).data });
    if (cache7.size >= 24) cache7.delete(cache7.keys().next().value);
    cache7.set(key, t);
    return t;
  }
  function sampleNiikuraMaterial(part, u, v, profile, g) {
    if (part === "niikura:main-scoreboard") return sampleNiikuraBoard(g, u, v, profile);
    if (part.endsWith(":mirror")) {
      part = part.slice(0, -7);
      u = 1 - u;
    }
    let fu = profile?.footprintU ?? 0;
    if (part.startsWith("niikura:mosaic:")) {
      u = (Number(part.split(":")[2]) + u) / 96;
      fu /= 96;
      part = "niikura:mosaic";
    }
    if (part.startsWith("niikura:vip:")) {
      u = (Number(part.split(":")[2]) % 8 + u) / 8;
      fu /= 8;
      part = "niikura:vip";
    }
    const t = texture6(part, g);
    if (!t) return null;
    const s = sampleMip(t, u, 1 - v, fu, profile?.footprintV ?? 0);
    return s ? { color: hex3([s.r, s.g, s.b]), logoGlow: part === "niikura:vip" && g.architecture.effects?.environment?.period !== "day" && g.architecture.effects?.lighting?.enabled !== false ? 0.12 : 0 } : null;
  }

  // tools/ballpark-studio/niikura-facility-layout.mjs
  function niikuraFacilityLayout(g, seatPoint) {
    const sectors = 96, podiumY = 13, mainBoard = { x: 0, z: wallAt(g, 0).position.z + 17, baseY: 14, width: 60, height: 25 };
    const monitors = [28, 37, 59, 68].map((sector, index) => {
      const v = seatPoint(sector / sectors, 25, 23);
      return { index, sector, x: v.x, z: v.z, baseY: v.y, width: 18, height: 10.5 };
    });
    const bays = [{ id: "main", start: 40, end: 56, topY: 41 }, ...monitors.map((b) => ({ id: "monitor-" + b.index, start: b.sector - 2, end: b.sector + 2, topY: 36.5 }))];
    return { sectors, podiumY, mainBoard, monitors, bays, stairs: [39, 56] };
  }
  var facilityBayAt = (layout, sector) => layout.bays.find((b) => sector >= b.start && sector < b.end);
  var mirroredNiikuraMaterial = (part, sector) => "niikura:" + part + ":" + (sector < 48 ? sector : 95 - sector) + (sector < 48 ? "" : ":mirror");

  // tools/ballpark-studio/niikura-mesh.mjs
  var TAU4 = 2 * Math.PI;
  function rim2(g) {
    const back = wallAt(g, Math.PI).distanceMeters + 0.5, shoulder = -Math.min(13, back - 6), cf = wallAt(g, 0).distanceMeters + 8, wing = wallAt(g, Math.PI / 4).distanceMeters / Math.sqrt(2);
    return [[0, -back], [28, shoulder], [46, 32], [wing + 10, 77], [61, cf - 24], [32, cf - 2], [0, cf], [-32, cf - 2], [-61, cf - 24], [-wing - 10, 77], [-46, 32], [-28, shoulder]];
  }
  function curve2(u, points) {
    const n = points.length, t = (u % 1 + 1) % 1 * n, i = Math.floor(t), s = t - i, p = [-1, 0, 1, 2].map((k2) => points[(i + k2 + n) % n]);
    return [0, 1].map((k2) => 0.5 * (2 * p[1][k2] + (-p[0][k2] + p[2][k2]) * s + (2 * p[0][k2] - 5 * p[1][k2] + 4 * p[2][k2] - p[3][k2]) * s * s + (-p[0][k2] + 3 * p[1][k2] - 3 * p[2][k2] + p[3][k2]) * s * s * s));
  }
  function seatRim(g, u) {
    u = (u % 1 + 1) % 1;
    const r = rim2(g);
    if (u >= 0.25 && u <= 0.75) {
      const p = curve2(u, r);
      return { x: p[0], z: p[1] };
    }
    const sign = u > 0.75 ? -1 : 1, t = sign < 0 ? 1 - u : u;
    if (t <= 1 / 6) return niikuraFoulSeatPoint(g, t, sign);
    const start = 1 / 6, end = 0.25, span = end - start, a = niikuraFoulSeatPoint(g, start, sign), prev = niikuraFoulSeatPoint(g, start - 1e-5, sign), q = curve2(sign < 0 ? 1 - end : end, r), next = curve2(sign < 0 ? 1 - end - 1e-5 : end + 1e-5, r), b = { x: q[0], z: q[1] }, c1 = { x: a.x + (a.x - prev.x) / 1e-5 * span / 3, z: a.z + (a.z - prev.z) / 1e-5 * span / 3 }, c2 = { x: b.x - (next[0] - b.x) / 1e-5 * span / 3, z: b.z - (next[1] - b.z) / 1e-5 * span / 3 };
    return cubicPoint(a, c1, c2, b, (t - start) / span);
  }
  function niikuraSeatPoint(g, u, offset, y) {
    const p = seatRim(g, u), a = seatRim(g, u - 1e-5), b = seatRim(g, u + 1e-5), dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz);
    return { x: p.x + dz / n * offset, y, z: p.z - dx / n * offset };
  }
  function niikuraMesh(g) {
    const a = g.architecture, c = a.colors, N2 = 96, surfaces = [], segments = [], lights = [], illuminationFixtures = [], boards = [], score = a.scoreboard ?? defaultScoreboard();
    let tiles = 0;
    const p = (u, o, y) => niikuraSeatPoint(g, u, o, y), face = (id, points, color, { material = null, crowdTile = null, roof = false, detailDensity = 3 } = {}) => surfaces.push({ id: "niikura-" + id + "-" + surfaces.length, points, color, material, crowdTile, roof, detailDensity }), line = (id, p2, q, color, roof = false, density = 2) => segments.push({ id: "niikura-" + id, p: p2, q, color, roof, detailDensity: density }), quad = (u0, u1, o0, o1, y0, y1) => [p(u0, o0, y0), p(u1, o0, y0), p(u1, o1, y1), p(u0, o1, y1)], strip = (id, u0, u1, o, y0, y1, color, material = null) => face(id, [p(u0, o, y0), p(u1, o, y0), p(u1, o, y1), p(u0, o, y1)], color, { material }), tube = (id, path, r, color, sides = 5) => {
      const rings = path.map((v2, i) => {
        const prev = path[Math.max(0, i - 1)], next = path[Math.min(path.length - 1, i + 1)], dx = next.x - prev.x, dy = next.y - prev.y, dz = next.z - prev.z, n2 = Math.hypot(dx, dy, dz), t = { x: dx / n2, y: dy / n2, z: dz / n2 }, h2 = Math.hypot(t.x, t.y) || 1, b = { x: -t.y / h2, y: t.x / h2, z: 0 }, d = { x: -t.z * b.y, y: t.z * b.x, z: t.x * b.y - t.y * b.x };
        return Array.from({ length: sides }, (_, j) => {
          const co = Math.cos(j * TAU4 / sides) * r, si = Math.sin(j * TAU4 / sides) * r;
          return { x: v2.x + b.x * co + d.x * si, y: v2.y + b.y * co + d.y * si, z: v2.z + b.z * co + d.z * si };
        });
      });
      for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < sides; j++) face(id, [rings[i][j], rings[i][(j + 1) % sides], rings[i + 1][(j + 1) % sides], rings[i + 1][j]], color, { detailDensity: id.startsWith("arch") ? 3 : 2 });
    };
    const facilities = niikuraFacilityLayout(g, p);
    const angles = [.../* @__PURE__ */ new Set([...Array.from({ length: 97 }, (_, i) => -Math.PI + i * TAU4 / 96), ...g.vertices.map((v2) => v2.angleDegrees * Math.PI / 180)])].sort((a2, b) => a2 - b);
    for (let i = 0; i < angles.length - 1; i++) {
      const x = wallAt(g, angles[i]), y = wallAt(g, angles[i + 1]);
      face("wall", [{ ...x.position, y: 0 }, { ...y.position, y: 0 }, { ...y.position, y: y.heightMeters }, { ...x.position, y: x.heightMeters }], c.red);
      line("wall-cap", { ...x.position, y: x.heightMeters }, { ...y.position, y: y.heightMeters }, c.blue);
    }
    for (let i = 0; i < N2; i++) {
      const q0 = p(i / N2, 0, 0.02), q1 = p((i + 1) / N2, 0, 0.02), w0 = wallAt(g, Math.atan2(q0.x, q0.z)), w1 = wallAt(g, Math.atan2(q1.x, q1.z));
      face("apron", [{ ...w0.position, y: 0.02 }, { ...w1.position, y: 0.02 }, q1, q0], mixNiikura(c.red, c.gold, 0.08));
      face("seat-base", [q0, q1, { ...q1, y: 2 }, { ...q0, y: 2 }], c.red);
    }
    const tiers = [{ offset: 0, depth: 23, y: 2, rise: 11, bands: 8 }, { offset: 27, depth: 28, y: 19.5, rise: 17, bands: 10 }];
    for (let tier = 0; tier < 2; tier++) {
      const d = tiers[tier];
      for (let i = 0; i < N2; i++) {
        const u0 = i / N2, u1 = (i + 1) / N2, bay = facilityBayAt(facilities, i), start = u0 + (i % 6 === 0 ? 15e-4 : 0), end = u1 - ((i + 1) % 6 === 0 ? 15e-4 : 0);
        if (tier === 1 && bay || tier === 0 && (bay?.id === "main" || facilities.stairs.includes(i))) continue;
        for (let band = 0; band < d.bands; band++) {
          const v0 = band / d.bands, v1 = (band + 1) / d.bands, tint = niikuraMosaic(Math.min((u0 + u1) / 2, 1 - (u0 + u1) / 2), (band + 0.5) / d.bands, c);
          face("seats-" + tier, quad(start, end, d.offset + d.depth * v0, d.offset + d.depth * v1, d.y + d.rise * v0, d.y + d.rise * v1), tint, { crowdTile: { id: tiles++, tier, band, sector: i, seatTint: tint } });
          for (const [a2, b] of [[u0, start], [end, u1]]) if (b > a2) face("aisle-" + tier, quad(a2, b, d.offset + d.depth * v0, d.offset + d.depth * v1, d.y + d.rise * v0, d.y + d.rise * v1), mixNiikura(c.red, c.gold, 0.14));
        }
        strip("seat-fascia", u0, u1, d.offset, d.y - 1.1, d.y, c.red);
        face("seat-underside", quad(u0, u1, d.offset, d.offset + d.depth + 3, d.y - 0.7, d.y + d.rise - 0.7), "#637963");
        for (let row = 1; row <= d.bands; row++) line("row", p(start, d.offset + d.depth * row / d.bands, d.y + d.rise * row / d.bands), p(end, d.offset + d.depth * row / d.bands, d.y + d.rise * row / d.bands), mixNiikura(c.red, c.gold, 0.24), false, 1);
      }
    }
    for (let i = 0; i < N2; i++) {
      const u0 = i / N2, u1 = (i + 1) / N2, bay = facilityBayAt(facilities, i);
      if (!bay) {
        strip("score-vip", u0, u1, 25, 13.5, 18.7, c.red, mirroredNiikuraMaterial("vip", i));
        strip("mosaic-fascia", u0, u1, 26, 18.7, 19.5, c.blue, mirroredNiikuraMaterial("mosaic", i));
      }
      strip("facade", u0, u1, 60, i < 4 || i > 91 ? 7 : 0, 37, c.red, mirroredNiikuraMaterial("mosaic", i));
      if (i < 20 || i > 75) strip("score-exterior-glass", u0, u1, 60.2, 8, 20, c.red, mirroredNiikuraMaterial("vip", i));
      face("facade-foot", quad(u0, u1, 60, 65, 0.05, 0.05), "#7b8877");
      if (i % 4 === 0) tube("yellow-column", [p(u0, 60, 0), p(u0, 60, 44 + 5 * Math.cos(u0 * TAU4 * 2 + 0.3))], 0.6, c.blue, 4);
      if (i % 6 === 0) {
        const f = p(u0, 64, 1.1), target = p(u0, 60, 26);
        illuminationFixtures.push({ ...f, target, kind: "facade", power: 0.9 });
        face("lamp-wallwasher", [{ ...f, x: f.x - 0.4 }, { ...f, x: f.x + 0.4 }, { ...f, x: f.x + 0.4, y: 1.7 }, { ...f, x: f.x - 0.4, y: 1.7 }], c.gold);
      }
    }
    for (const bay of facilities.bays) {
      const u0 = bay.start / N2, u1 = bay.end / N2, front2 = bay.id === "main" ? 0 : 23, base = facilities.podiumY;
      for (let i = bay.start; i < bay.end; i++) {
        face("facility-" + bay.id + "-floor", quad(i / N2, (i + 1) / N2, front2, 55, base, base), c.red);
        strip("facility-" + bay.id + "-base", i / N2, (i + 1) / N2, front2, 0, 9.7, c.red);
        strip("facility-" + bay.id + "-lintel", i / N2, (i + 1) / N2, front2, 12.6, base, c.blue);
        strip("facility-" + bay.id + "-gallery", i / N2, (i + 1) / N2, front2, 9.7, 12.6, c.red, mirroredNiikuraMaterial("vip", i));
        strip("facility-" + bay.id + "-rear", i / N2, (i + 1) / N2, 55, base, bay.topY, c.red, mirroredNiikuraMaterial("mosaic", i));
        face("facility-" + bay.id + "-canopy", quad(i / N2, (i + 1) / N2, 27, 55, bay.topY, bay.topY), c.gold);
      }
      for (const u of [u0, u1]) {
        face("facility-" + bay.id + "-cheek", [p(u, front2, base), p(u, 55, base), p(u, 55, bay.topY), p(u, 27, bay.topY)], c.red);
        tube("facility-" + bay.id + "-pier", [p(u, 27, base), p(u, 27, bay.topY)], 0.45, c.blue, 4);
      }
    }
    for (const i of facilities.stairs) {
      const u0 = i / N2, u1 = (i + 1) / N2;
      for (let step = 0; step < 64; step++) {
        const o0 = 23 * step / 64, o1 = 23 * (step + 1) / 64, y = 2 + 11 * (step + 1) / 64;
        face("facility-main-stair", quad(u0, u1, o0, o1, y, y), c.gold, { detailDensity: 2 });
        strip("facility-main-riser", u0, u1, o0, y - 11 / 64, y, c.red);
      }
      for (const u of [u0, u1]) line("facility-main-handrail", p(u, 0, 3), p(u, 23, 14), c.blue, false, 2);
    }
    for (const [index, u] of [0.04, 0.16, 0.84, 0.96].entries()) {
      const center2 = p(u, 62, 0), r = 6.5, top = 41;
      for (let j = 0; j < 16; j++) {
        const angle = j * TAU4 / 16, next = (j + 1) * TAU4 / 16, a2 = { x: center2.x + r * Math.cos(angle), y: 0, z: center2.z + r * Math.sin(angle) }, b = { x: center2.x + r * Math.cos(next), y: 0, z: center2.z + r * Math.sin(next) };
        face("mosaic-tower", [a2, b, { ...b, y: top }, { ...a2, y: top }], c.red, { material: "niikura:mosaic:" + (index + j / 16) / 4 * 96 });
        face("tower-cap", [{ ...center2, y: top + 0.2 }, { ...a2, y: top + 0.2 }, { ...b, y: top + 0.2 }], c.gold, { detailDensity: 1 });
      }
    }
    const innerY = (u) => 43 + 3 * Math.cos(u * TAU4 * 2), outerY = (u) => 44 + 5 * Math.cos(u * TAU4 * 2 + 0.3);
    for (let i = 0; i < N2; i++) {
      const u0 = i / N2, u1 = (i + 1) / N2;
      for (let band = 0; band < 3; band++) {
        const v0 = band / 3, v1 = (band + 1) / 3, point2 = (u, v2) => p(u, 16 + 49 * v2, innerY(u) * (1 - v2) + outerY(u) * v2);
        face("membrane", [point2(u0, v0), point2(u1, v0), point2(u1, v1), point2(u0, v1)], c.gold, { material: "niikura:membrane", roof: true, detailDensity: 2 });
      }
      if (i % 2 === 0) {
        line("roof-rib", p(u0, 16, innerY(u0) - 0.4), p(u0, 65, outerY(u0) - 0.4), c.red, true, 2);
        line("roof-cross", p(u0, 16, innerY(u0) - 0.5), p(u1, 65, outerY(u1) - 0.5), c.blue, true, 2);
      }
      line("roof-inner", p(u0, 16, innerY(u0)), p(u1, 16, innerY(u1)), c.red, true, 2);
      line("roof-outer", p(u0, 65, outerY(u0)), p(u1, 65, outerY(u1)), c.blue, true, 2);
      if (i % 8 === 0) {
        const f = p(u0, 21, innerY(u0) - 2.1);
        illuminationFixtures.push({ ...f, target: { x: 0, y: 0, z: 55 }, kind: "field", power: 1 });
        const tangent = { x: Math.cos(u0 * TAU4), z: Math.sin(u0 * TAU4) };
        for (let row = 0; row < 2; row++) face("lamp-bank", [{ x: f.x - tangent.x * 4, y: f.y + row * 0.9, z: f.z - tangent.z * 4 }, { x: f.x + tangent.x * 4, y: f.y + row * 0.9, z: f.z + tangent.z * 4 }, { x: f.x + tangent.x * 4, y: f.y + row * 0.9 + 0.6, z: f.z + tangent.z * 4 }, { x: f.x - tangent.x * 4, y: f.y + row * 0.9 + 0.6, z: f.z - tangent.z * 4 }], c.gold);
      }
    }
    const arch = Array.from({ length: 49 }, (_, i) => {
      const t = i * Math.PI / 48;
      return { x: -164 * Math.cos(t), y: 40 + 98 * Math.sin(t), z: 66 + 48 * Math.sin(t) };
    });
    const archGreen = mixNiikura(c.red, "#00150c", 0.82);
    for (const side of [-1, 1]) tube("arch-support-leg", [{ x: side * 164, y: 0, z: 66 }, { x: side * 164, y: 40, z: 66 }], 2, archGreen);
    tube("arch-green-front", arch.map((p2) => ({ ...p2, z: p2.z - 2.8 })), 1.05, archGreen);
    tube("arch-green-back", arch.map((p2) => ({ ...p2, z: p2.z + 2.8 })), 1.05, archGreen);
    for (let i = 0; i < 48; i += 2) {
      tube("arch-yellow-web", [{ ...arch[i], z: arch[i].z - 2.8 }, { ...arch[i + 2], z: arch[i + 2].z + 2.8 }], 0.38, c.blue, 4);
      tube("arch-yellow-web", [{ ...arch[i], z: arch[i].z + 2.8 }, { ...arch[i + 2], z: arch[i + 2].z - 2.8 }], 0.38, c.blue, 4);
    }
    for (let i = 4; i < 46; i += 4) {
      const v2 = arch[i], u = 0.5 - v2.x / 656;
      line("arch-cable", v2, p(u, 55, outerY(u)), mixNiikura(c.gold, c.red, 0.25), false, 1);
    }
    for (const side of [-1, 1]) {
      const f = { x: side * 161, y: 2, z: 67 };
      illuminationFixtures.push({ ...f, target: { x: side * 85, y: 117, z: 108 }, kind: "facade", power: 1.8 });
      face("lamp-arch", [{ ...f, x: f.x - 0.7 }, { ...f, x: f.x + 0.7 }, { ...f, x: f.x + 0.7, y: 3 }, { ...f, x: f.x - 0.7, y: 3 }], c.gold);
    }
    for (const board of facilities.monitors) {
      const { index, width: w, height: h2 } = board, v2 = { x: board.x, y: board.baseY, z: board.z }, n2 = Math.hypot(v2.x, v2.z), tx2 = v2.z / n2, tz2 = -v2.x / n2, point2 = (sign, y, back = 0) => ({ x: v2.x + tx2 * w / 2 * sign + v2.x / n2 * back, y, z: v2.z + tz2 * w / 2 * sign + v2.z / n2 * back });
      face("score-screen-" + index, [point2(-1, v2.y), point2(1, v2.y), point2(1, v2.y + h2), point2(-1, v2.y + h2)], "#092d20", { material: score.niikura?.monitors ?? true ? "niikura:video:" + index : null });
      face("monitor-back", [point2(1, v2.y, 1), point2(-1, v2.y, 1), point2(-1, v2.y + h2, 1), point2(1, v2.y + h2, 1)], c.red);
      for (const s of [-1, 1]) {
        face("monitor-side", [point2(s, v2.y), point2(s, v2.y, 1), point2(s, v2.y + h2, 1), point2(s, v2.y + h2)], c.blue);
        tube("monitor-post", [point2(s * 0.55, facilities.podiumY), point2(s * 0.55, v2.y)], 0.4, c.red, 4);
      }
      boards.push({ index, x: v2.x, z: v2.z, baseY: v2.y, width: w, height: h2 });
    }
    const mainBoard = facilities.mainBoard, v = { x: mainBoard.x, y: mainBoard.baseY, z: mainBoard.z }, n = Math.hypot(v.x, v.z), tx = v.z / n, tz = -v.x / n, point = (sign, y, back = 0) => ({ x: v.x + tx * mainBoard.width / 2 * sign + v.x / n * back, y, z: v.z + tz * mainBoard.width / 2 * sign + v.z / n * back }), h = mainBoard.height, gold = mixNiikura(c.blue, c.gold, 0.22);
    face("score-screen-main", [point(-1, v.y), point(1, v.y), point(1, v.y + h), point(-1, v.y + h)], "#092d20", { material: score.enabled ? "niikura:main-scoreboard" : null });
    face("facility-main-housing-back", [point(1, v.y, 1), point(-1, v.y, 1), point(-1, v.y + h, 1), point(1, v.y + h, 1)], c.red);
    const frame = (id, s0, s1, y0, y1) => face(id, [point(s0, y0, -0.12), point(s1, y0, -0.12), point(s1, y1, -0.12), point(s0, y1, -0.12)], gold, { detailDensity: 3 });
    frame("score-frame-bottom", -1.04, 1.04, v.y - 0.65, v.y + 0.12);
    frame("score-frame-top", -1.04, 1.04, v.y + h - 0.12, v.y + h + 0.65);
    for (const side of [-1, 1]) {
      frame("score-frame-side", side < 0 ? -1.04 : 1, side < 0 ? -1 : 1.04, v.y, v.y + h);
      face("score-housing-side", [point(side, v.y), point(side, v.y, 1), point(side, v.y + h, 1), point(side, v.y + h)], c.blue);
      tube("score-column", [point(side * 1.065, facilities.podiumY, -0.05), point(side * 1.065, v.y + h + 0.9, -0.05)], 0.75, c.red, 4);
      for (let y = 16; y < v.y + h; y += 6) line("score-column-ring", point(side * 1.065 - 0.025, y, -0.9), point(side * 1.065 + 0.025, y, -0.9), gold, false, 3);
    }
    if (a.details?.ornaments !== false) tube("score-crown", [point(-1.04, v.y + h + 0.7), point(0, v.y + h + 2), point(1.04, v.y + h + 0.7)], 0.24, gold, 4);
    const center = wallAt(g, 0);
    face("batter-eye", [{ x: -9, y: 0, z: center.position.z + 2 }, { x: 9, y: 0, z: center.position.z + 2 }, { x: 9, y: 9, z: center.position.z + 2 }, { x: -9, y: 9, z: center.position.z + 2 }], c.red);
    const front = p(0, 60, 0).z, entryZ = front - 10.5;
    face("score-entry", [{ x: -23, y: 9.5, z: entryZ }, { x: 23, y: 9.5, z: entryZ }, { x: 23, y: 15.5, z: entryZ }, { x: -23, y: 15.5, z: entryZ }], c.red, { material: a.details?.logos === false ? null : "niikura:entry" });
    face("entry-canopy", [{ x: -27, y: 8.3, z: front + 1 }, { x: 27, y: 8.3, z: front + 1 }, { x: 27, y: 8.3, z: front - 10 }, { x: -27, y: 8.3, z: front - 10 }], c.gold);
    face("lamp-entry-canopy", [{ x: -27, y: 7.7, z: front - 10 }, { x: 27, y: 7.7, z: front - 10 }, { x: 27, y: 8.3, z: front - 10 }, { x: -27, y: 8.3, z: front - 10 }], c.blue);
    for (let i = 0; i < 5; i++) {
      const x = -21 + i * 8.5;
      face("score-entry-doors", [{ x, y: 0.75, z: front - 0.4 }, { x: x + 7.5, y: 0.75, z: front - 0.4 }, { x: x + 7.5, y: 7, z: front - 0.4 }, { x, y: 7, z: front - 0.4 }], c.red, { material: "niikura:doors" });
    }
    for (const x of [-25, -16.5, -8, 8, 16.5, 25]) tube("entry-column", [{ x, y: 0.75, z: front - 8 }, { x, y: 8.3, z: front - 8 }], 0.45, c.blue, 4);
    for (let i = 0; i < 3; i++) {
      const y = (3 - i) * 0.25, z = front - 10 - i * 2;
      face("entry-step", [{ x: -29, y, z }, { x: 29, y, z }, { x: 29, y, z: z - 2 }, { x: -29, y, z: z - 2 }], mixNiikura(c.gold, c.blue, 0.08));
      face("entry-riser", [{ x: -29, y: y - 0.25, z: z - 2 }, { x: 29, y: y - 0.25, z: z - 2 }, { x: 29, y, z: z - 2 }, { x: -29, y, z: z - 2 }], c.gold);
    }
    face("arrival-plaza", [{ x: -95, y: -0.03, z: front - 10 }, { x: 95, y: -0.03, z: front - 10 }, { x: 95, y: -0.03, z: front - 50 }, { x: -95, y: -0.03, z: front - 50 }], "#8d9279");
    return {
      surfaces,
      segments,
      lights,
      illuminationFixtures,
      capacity: a.capacity,
      tiers: 2,
      rowsPerTier: tiers.map((d) => d.bands),
      seating: { decks: 2, mosaic: true, sharedFacadePalette: true },
      facilities,
      spectatorLights: 0,
      spectatorTiles: tiles,
      envelope: { rx: 170, rz: 180, centerZ: 55, frontZ: -98, bowlTop: 37, eaveY: 44, topY: 141, exponent: 2 },
      roof: { type: "open", openingPercent: 100, centralAperture: true },
      arch: { count: 1, topY: 138, width: 328 },
      scoreboard: { enabled: score.enabled, mode: "DESIGN_SAMPLE", mainBoard, monitors: boards, boards, z: mainBoard.z, baseY: mainBoard.baseY, scale: 1, width: mainBoard.width, teams: score.teams.map((t) => ({ ...t, runs: runs(t) })), balls: score.balls, strikes: score.strikes, outs: score.outs, speedKmh: score.speedKmh }
    };
  }

  // tools/ballpark-studio/dodger-envelope.mjs
  function appendDodgerEnvelope({ geometry: g, architecture: a, face, line }) {
    const S = 72, decks = DODGER_DECKS.slice(0, a.tiers), gates = [];
    let wallPanels = 0, soffits = 0;
    const box = (id, x0, x1, z0, z1, y0, y1, color) => {
      const p = [{ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y0, z: z1 }, { x: x0, y: y0, z: z1 }];
      face(id + "-top", p.map((p2) => ({ ...p2, y: y1 })), color);
      for (let i = 0; i < 4; i++) face(id + "-side", [p[i], p[(i + 1) % 4], { ...p[(i + 1) % 4], y: y1 }, { ...p[i], y: y1 }], color);
    };
    const panel = (id, x0, x1, y0, y1, z, color, material = null) => face(id, [{ x: x0, y: y0, z }, { x: x1, y: y0, z }, { x: x1, y: y1, z }, { x: x0, y: y1, z }], color, { material });
    for (const d of decks) {
      const outer = d.offset + d.depth + 3, top = d.y + d.rise, wallTop = Math.max(0, top - 4), point = (u, y, o = outer) => dodgerSeatPoint(u, o, y, g);
      for (let i = 0; i < S; i++) {
        const u0 = d.trim + (1 - 2 * d.trim) * i / S, u1 = d.trim + (1 - 2 * d.trim) * (i + 1) / S, opening = i === 5 || i === 6 || i === 35 || i === 36 || i === 65 || i === 66, lo = opening ? 3.8 : 0, p = point(u0, lo), q = point(u1, lo);
        if (wallTop > lo) {
          face("facade-" + d.name, [p, q, point(u1, wallTop), point(u0, wallTop)], "#aeb7b4", { material: "dodger:facade:" + d.name });
          wallPanels++;
        }
        if (opening) gates.push({ deck: d.name, u0, u1, height: Math.min(3.8, wallTop), outerOffset: outer });
        face("facade-plinth", [point(u0, 0.06), point(u1, 0.06), point(u1, 0.06, outer + 1.5), point(u0, 0.06, outer + 1.5)], "#707f82");
        face("soffit-" + d.name, [point(u0, d.y - 0.55, d.offset), point(u1, d.y - 0.55, d.offset), point(u1, top - 0.55), point(u0, top - 0.55)], "#8d9b9d");
        soffits++;
        if (i % 4 === 0) {
          const c = point(u0, 0, outer + 0.2);
          box("facade-column", c.x - 0.45, c.x + 0.45, c.z - 0.45, c.z + 0.45, 0, wallTop, "#bec6c1");
        }
        if (i % 6 === 0) line(point(u0, Math.min(wallTop, 3.1)), point(u1, Math.min(wallTop, 3.1)), "#4c7896", 2);
      }
    }
    for (const side of [-1, 1]) for (let i = 0; i < 12; i++) {
      const p = { x: side * (12 + i * 68 / 12), y: 0, z: 144.8 - i * 40 / 12 }, q = { x: side * (12 + (i + 1) * 68 / 12), y: 0, z: 144.8 - (i + 1) * 40 / 12 }, lo = i % 4 === 1 ? 3.5 : 0;
      face("pavilion-rear-wall", [{ ...p, y: lo }, { ...q, y: lo }, { ...q, y: 9 }, { ...p, y: 9 }], "#b1babb", { material: "dodger:facade:pavilion" });
      wallPanels++;
      face("pavilion-soffit", [{ ...p, y: 9 }, { ...q, y: 9 }, { ...q, y: 9, z: q.z - 17 }, { ...p, y: 9, z: p.z - 17 }], "#7e8f93");
    }
    face("entry-plaza", [{ x: -100, y: -0.04, z: 153 }, { x: 100, y: -0.04, z: 153 }, { x: 100, y: -0.04, z: 203 }, { x: -100, y: -0.04, z: 203 }], "#667a7f");
    for (const side of [-1, 1]) {
      const x0 = side < 0 ? -103 : 22, x1 = side < 0 ? -22 : 103;
      box("entry-boundary", x0, x1, 181.5, 182.5, 0, 2.7, "#326c93");
      box("entry-link", side < 0 ? -24 : 18, side < 0 ? -18 : 24, 150, 185, 6.7, 7.2, "#a7b3b5");
      for (const x of [side * 18, side * 23]) {
        line({ x, y: 7.3, z: 150 }, { x, y: 7.3, z: 185 }, "#658fa7", 2);
        line({ x, y: 8.3, z: 150 }, { x, y: 8.3, z: 185 }, "#658fa7", 2);
      }
      for (let i = 0; i < 16; i++) {
        const z = 185 - i * 1.4, y = (i + 1) * 7.2 / 16;
        box("entry-stair", side < 0 ? -34 : 25, side < 0 ? -25 : 34, z - 1.4, z, 0, y, "#84999e");
      }
      for (const z of [151, 167, 183]) box("entry-pier", side * 21 - 0.45, side * 21 + 0.45, z - 0.45, z + 0.45, 0, 6.7, "#b8c1bd");
    }
    for (const x of [-18, -6, 6, 18]) box("entry-post", x - 0.35, x + 0.35, 183, 184, 0, 9.2, "#5a91a9");
    box("entry-bridge", -20, 20, 181, 187, 7.2, 7.7, "#5a7e92");
    for (let x = -18; x <= 18; x += 3) line({ x, y: 7.7, z: 186 }, { x, y: 8.9, z: 186 }, "#8aaab6", 2);
    line({ x: -20, y: 8.9, z: 186 }, { x: 20, y: 8.9, z: 186 }, "#8aaab6", 2);
    panel("entry-score-welcome", -19.8, 19.8, 5, 7.2, 187.05, "#137dbb", a.details?.logos === false ? null : "dodger:entry-welcome");
    panel("entry-score-script", -11, 11, 9, 13.5, 184.1, "#24485e", a.details?.logos === false ? null : "dodger:entry-script");
    return { wallPanels, soffits, gates, centerfieldGate: { x: 0, z: 187, clearWidth: 11.3, clearHeight: 5 }, approximation: "photo-derived-not-surveyed" };
  }

  // tools/ballpark-studio/dodger-mesh.mjs
  function dodgerMesh(g) {
    const a = g.architecture, surfaces = [], segments = [], lights = [], c = a.colors, score = a.scoreboard ?? defaultScoreboard();
    let tiles = 0;
    const face = (id, points, color, { roof = false, crowdTile = null, material = null } = {}) => surfaces.push({ id: "dodger-" + id + "-" + surfaces.length, points, color, roof, crowdTile, material, detailDensity: /^(seats|aisle|fascia|walkway|rear-concourse|outer-wall|deck-end|pavilion|lamp|facade|soffit|entry)/.test(id) ? 3 : 1 }), line = (p, q, color, detailDensity = 1) => segments.push({ p, q, color, roof: false, detailDensity }), panel = (id, x0, x1, y0, y1, z, color, material = null) => face(id, [{ x: x0, y: y0, z }, { x: x1, y: y0, z }, { x: x1, y: y1, z }, { x: x0, y: y1, z }], color, { material }), seat = (theta, offset, y) => {
      const w = wallAt(g, theta);
      return { x: Math.sin(theta) * (w.distanceMeters + offset), y, z: Math.cos(theta) * (w.distanceMeters + offset) };
    }, tile = () => ({ id: tiles++, tier: 0, band: 0, sector: tiles });
    const angles = [.../* @__PURE__ */ new Set([...Array.from({ length: 81 }, (_, i) => -Math.PI + i * Math.PI / 40), ...g.vertices.map((p) => p.angleDegrees * Math.PI / 180)])].sort((a2, b) => a2 - b);
    for (let i = 0; i < angles.length - 1; i++) {
      const t0 = angles[i], t1 = angles[i + 1], w0 = wallAt(g, t0), w1 = wallAt(g, t1);
      face("wall", [{ ...w0.position, y: 0 }, { ...w1.position, y: 0 }, { ...w1.position, y: w1.heightMeters }, { ...w0.position, y: w0.heightMeters }], "#2978b7");
    }
    const seating = appendDodgerStands({ geometry: g, architecture: a, face, line: (p, q, c2) => line(p, q, c2, 3), tile });
    for (let i = 0; i < 96; i++) {
      const p = dodgerSeatPoint(i / 96, 2, 0, g), q = dodgerSeatPoint((i + 1) / 96, 2, 0, g), w = wallAt(g, Math.atan2(p.x, p.z)).position, v = wallAt(g, Math.atan2(q.x, q.z)).position;
      face("apron", [{ ...w, y: 0 }, { ...v, y: 0 }, q, p], "#49453e");
    }
    for (const side of [-1, 1]) {
      const p = { x: side * 27, y: 1.5, z: 18 }, q = { x: side * 50, y: 1.5, z: 41 }, offset = (p2) => ({ ...p2, x: p2.x + side * 3.8, z: p2.z - 3.8 });
      face("dugout-roof", [p, q, offset(q), offset(p)], "#1e5183");
      face("dugout-front", [{ ...p, y: 0 }, { ...q, y: 0 }, q, p], "#102333");
      line(p, q, "#7e9ba9");
    }
    for (const side of [-1, 1]) {
      for (let section = 0; section < 12; section++) for (let band = 0; band < 6; band++) {
        const point = (section2, band2) => ({ x: side * (12 + section2 * 68 / 12), y: 3 + band2 * 1.3, z: 126 - section2 * 40 / 12 + band2 * 3.1 }), p = point(section, band), q = point(section + 1, band), r = point(section + 1, band + 1), s = point(section, band + 1);
        face("pavilion", [p, q, r, s], "#839ca7", section % 4 === 0 ? {} : { crowdTile: { ...tile(), seatTint: "#839ca7" } });
        line(p, q, "#465f6e");
        if (band === 0) face("pavilion-front", [{ ...p, y: 0.6 }, { ...q, y: 0.6 }, q, p], "#2f6791");
      }
      for (let i = 0; i < 24; i++) {
        const x0 = side * (12 + i * 68 / 24), x1 = side * (12 + (i + 1) * 68 / 24), z0 = 146 - i * 40 / 24, z1 = 146 - (i + 1) * 40 / 24, h0 = 12 + Math.sin(i * Math.PI / 6) * 0.3, h1 = 12 + Math.sin((i + 1) * Math.PI / 6) * 0.3;
        face("pavilion-canopy", [{ x: x0, y: h0, z: z0 }, { x: x1, y: h1, z: z1 }, { x: x1, y: h1 + 0.6, z: z1 + 5 }, { x: x0, y: h0 + 0.6, z: z0 + 5 }], "#8399a5", { roof: true });
      }
      panel("bullpen", side < 0 ? -92 : 73, side < 0 ? -73 : 92, 0, 3.2, 102, "#337fb7");
      for (const x of [side * 18, side * 68]) line({ x, y: 0, z: 154 }, { x, y: 14, z: 154 }, "#62747e");
    }
    panel("eye", -10, 10, 0, 11, wallAt(g, 0).distanceMeters + 2, "#172e29");
    panel("eye-upper", -9, 9, 11, 15, wallAt(g, 0).distanceMeters + 7, "#20382c");
    for (const side of [-1, 1]) {
      const w = wallAt(g, side * Math.PI / 4), p = { ...w.position, y: 0 };
      line(p, { ...p, y: 29 }, "#e6c734");
      line({ ...p, x: p.x + side * 0.65 }, { ...p, x: p.x + side * 0.65, y: 29 }, "#d1b72f");
    }
    const boards = [];
    for (const side of [-1, 1]) {
      const x = side * 55, z = 145, y = 23, w = 34, h = 17;
      boards.push({ x, z, baseY: y, width: w, height: h });
      for (const dx of [-10, 10]) {
        panel("board-support", x + dx - 0.65, x + dx + 0.65, 4, y, z + 2, "#9caaad");
      }
      panel("board-back", x - w / 2 - 1, x + w / 2 + 1, y - 1, y + h + 1, z + 1.5, "#28495e");
      if (a.details?.logos !== false) panel("board-rear-mark", x - w / 2, x + w / 2, y, y + h, z + 1.52, "#164b79", "dodger:rear-la");
      panel("board-service", x - w / 2 - 3, x + w / 2 + 3, 0, 6, z + 3, "#33434a");
      panel("board-front", x - w / 2 - 1, x + w / 2 + 1, y - 1, y + h + 1, z, "#e4ebea");
      if (score.enabled) panel("display", x - w / 2, x + w / 2, y, y + h, z - 0.08, "#091928", side === 1 ? "dodger:score" : "dodger:wordmark");
      else panel("display-off", x - w / 2, x + w / 2, y, y + h, z - 0.08, "#14212a");
      face("board-cap", [{ x: x - w / 2 - 1, y: y + h, z }, { x: x - w / 2 + 3, y: y + h + 2.4, z }, { x: x + w / 2 - 3, y: y + h + 2.4, z }, { x: x + w / 2 + 1, y: y + h, z }], "#e4ebea");
      panel("76-sign", x - 3, x + 3, y + h + 3, y + h + 9, z, "#ed6a30", "dodger:76");
    }
    for (const [x, z] of [[-100, -5], [100, -5], [-115, 77], [115, 77], [-55, 152], [55, 152]]) {
      const top = 54;
      for (const dx of [-5, -1.7, 1.7, 5]) line({ x: x + dx * 0.65, y: 5, z }, { x: x + dx, y: top, z }, "#3c4c59");
      for (let y = 14; y < top; y += 10) line({ x: x - 4, y, z }, { x: x + 4, y: y + 9, z }, "#303e48");
      panel("light-rack", x - 9, x + 9, top, top + 4.2, z, "#879199");
      for (let row = 0; row < 3; row++) for (let i = 0; i < 12; i++) panel("lamp", x - 8.5 + i * 1.45, x - 7.7 + i * 1.45, top + 0.3 + row * 1.3, top + 1.2 + row * 1.3, z - 0.03, "#eeeede");
    }
    if (a.details?.logos !== false) {
      panel("stadium-sign", -22, 22, 35, 42, -67, "#0d4984", "dodger:stadium");
      for (const x of [-94, -28, 28, 94]) panel("ribbon", x - 13, x + 13, 10, 13, 124 - Math.abs(x) * 0.15, "#17539a", "dodger:ribbon");
      panel("center-distance", -3, 3, 0, 1.4, wallAt(g, 0).distanceMeters - 0.06, "#2e78af", "dodger:distance");
      for (const x of [-91, -76, -27, -17, 17, 27, 76, 91]) {
        const z = 146 - Math.abs(x) * 0.32;
        panel("small-sign", x - 5, x + 5, 15, 18.5, z, "#23333d", "dodger:ribbon");
        for (const dx of [-3, 3]) line({ x: x + dx, y: 8, z: z + 1 }, { x: x + dx, y: 15, z: z + 1 }, "#56636a");
      }
    }
    const enclosure = appendDodgerEnvelope({ geometry: g, architecture: a, face, line });
    const landscape = appendDodgerLandscape(g, face);
    return {
      surfaces,
      segments,
      lights,
      seating,
      landscape,
      enclosure,
      lightTowers: 6,
      capacity: a.capacity,
      tiers: a.tiers,
      rowsPerTier: 16,
      outerOffset: 50,
      envelope: { rx: 142, rz: 139, centerZ: 48, frontZ: -75, bowlTop: 43, eaveY: 43, topY: 57, exponent: 2 },
      roof: { type: "open", openingPercent: 100, halfX: 0, z0: 0, z1: 0, y: 0 },
      spectatorLights: 0,
      spectatorTiles: tiles,
      scoreboard: { enabled: score.enabled, mode: "DESIGN_SAMPLE", boards, x: 55, z: 145, baseY: 23, scale: 0.55, width: 34, teams: score.teams.map((t) => ({ ...t, runs: runs(t) })), balls: score.balls, strikes: score.strikes, outs: score.outs, speedKmh: score.speedKmh }
    };
  }

  // tools/ballpark-studio/koshien-fans.mjs
  var HOME = Object.freeze(["#ffd33c", "#eab51a"]);
  var VISITOR = Object.freeze(["#5287d0", "#dfe8ef"]);
  var PAYPAY_HOME_COLORS = Object.freeze(["#f7c600", "#db9f10"]);
  function koshienFanPalettes(a) {
    if (a.style === "fukuoka_dome") return { home: a.crowd?.homeColors ?? PAYPAY_HOME_COLORS, visitor: null };
    return a.style === "koshien" ? { home: a.crowd?.homeColors ?? HOME, visitor: a.crowd?.visitorColors ?? VISITOR } : { home: [a.colors.red, a.colors.blue], visitor: null };
  }
  function koshienFanZone(sector, tier) {
    return tier === 2 && sector >= 32 && sector < 38 ? "visitor" : "home";
  }

  // tools/ballpark-studio/koshien-mesh.mjs
  var TAU5 = Math.PI * 2;
  function curve3(u, rim3) {
    const t = (u % 1 + 1) % 1 * rim3.length, i = Math.floor(t), s = t - i, p = [-1, 0, 1, 2].map((k2) => rim3[(i + k2 + rim3.length) % rim3.length]);
    return [0, 1].map((k2) => 0.5 * (2 * p[1][k2] + (-p[0][k2] + p[2][k2]) * s + (2 * p[0][k2] - 5 * p[1][k2] + 4 * p[2][k2] - p[3][k2]) * s * s + (-p[0][k2] + 3 * p[1][k2] - 3 * p[2][k2] + p[3][k2]) * s * s * s));
  }
  function koshienSeatPoint(u, offset, y, g) {
    const rim3 = koshienBowlRim(g), legacy = (t) => {
      const p2 = curve3(t, rim3);
      return { x: p2[0], z: p2[1] };
    }, point = (t) => realParkSeatRim(g, "koshien", (t % 1 + 1) % 1, legacy), p = point(u), a = point(u - 1e-5), b = point(u + 1e-5), dx = b.x - a.x, dz = b.z - a.z, n = Math.hypot(dx, dz);
    return { x: p.x - dz / n * offset, y, z: p.z + dx / n * offset };
  }
  function koshienMesh(g) {
    const a = g.architecture, surfaces = [], segments = [], lights = [], S = KOSHIEN_FACADE_SECTORS, score = a.scoreboard ?? defaultScoreboard(), gapStart = S / 2 - 4, gapEnd = S / 2 + 4, central = (i) => i >= gapStart && i < gapEnd;
    let tiles = 0;
    const seatPoint = (u, o, y) => koshienSeatPoint(u, o, y, g), entranceZ = seatPoint(0, 57, 0).z - 0.8;
    const face = (id, points, color, { roof = false, crowdTile = null, material = null, density = 3 } = {}) => surfaces.push({ id: "koshien-" + id + "-" + surfaces.length, points, color, roof, crowdTile, material, detailDensity: density }), line = (p, q, color, roof = false) => segments.push({ p, q, color, roof, detailDensity: 2 }), panel = (id, x0, x1, y0, y1, z2, color, material = null) => face(id, [{ x: x0, y: y0, z: z2 }, { x: x1, y: y0, z: z2 }, { x: x1, y: y1, z: z2 }, { x: x0, y: y1, z: z2 }], color, { material }), quad = (u0, u1, o0, o1, y0, y1) => [seatPoint(u0, o0, y0), seatPoint(u1, o0, y0), seatPoint(u1, o1, y1), seatPoint(u0, o1, y1)], box = (id, x, z2, w, d, y, h, color) => {
      const p = [{ x: x - w / 2, y, z: z2 - d / 2 }, { x: x + w / 2, y, z: z2 - d / 2 }, { x: x + w / 2, y, z: z2 + d / 2 }, { x: x - w / 2, y, z: z2 + d / 2 }];
      face(id + "-top", p.map((p2) => ({ ...p2, y: y + h })), color, { density: 1 });
      for (let i = 0; i < 4; i++) face(id + "-side", [p[i], p[(i + 1) % 4], { ...p[(i + 1) % 4], y: y + h }, { ...p[i], y: y + h }], color, { density: 1 });
    };
    const angles = [.../* @__PURE__ */ new Set([...Array.from({ length: 129 }, (_, i) => -Math.PI + i * TAU5 / 128), ...g.vertices.map((p) => p.angleDegrees * Math.PI / 180)])].sort((a2, b) => a2 - b);
    for (let i = 0; i < angles.length - 1; i++) {
      const p = wallAt(g, angles[i]), q = wallAt(g, angles[i + 1]);
      face("fence", [{ ...p.position, y: 0 }, { ...q.position, y: 0 }, { ...q.position, y: q.heightMeters }, { ...p.position, y: p.heightMeters }], "#1b4d3d", { density: 2 });
    }
    const bands = [{ offset: 1, depth: 12, y: 2, rise: 4.7, rows: 10 }, { offset: 15, depth: 18, y: 7.2, rise: 9.8, rows: 18 }, { offset: 36, depth: 17, y: 18, rise: 11, rows: 18 }];
    for (let i = 0; i < S; i++) {
      const u0 = i / S, u1 = (i + 1) / S, back = i < 18 || i >= 66, alps = i >= 18 && i < 28 || i >= 56 && i < 66, seatColor = back ? "#456958" : alps ? "#718575" : "#597c68";
      if (central(i)) continue;
      for (const [tier, d] of bands.entries()) {
        const aisle = i % 4 === 0, split = u0 + (u1 - u0) * 0.28, start = aisle ? split : u0;
        for (let b = 0; b < 4; b++) {
          const v0 = b / 4, v1 = (b + 1) / 4;
          face("seats", quad(start, u1, d.offset + d.depth * v0, d.offset + d.depth * v1, d.y + d.rise * v0, d.y + d.rise * v1), seatColor, { crowdTile: { id: i * 12 + tier * 4 + b, tier, band: b, sector: i, seatTint: seatColor, fanZone: koshienFanZone(i, tier) } });
          tiles++;
          if (aisle) face("stairs", quad(u0, split, d.offset + d.depth * v0, d.offset + d.depth * v1, d.y + d.rise * v0, d.y + d.rise * v1), "#a4a48c");
        }
        for (let row = 1; row < d.rows; row++) {
          const v = row / d.rows;
          line(seatPoint(start, d.offset + d.depth * v, d.y + d.rise * v), seatPoint(u1, d.offset + d.depth * v, d.y + d.rise * v), "#27493c");
        }
        face("walkway", quad(u0, u1, d.offset - 1.7, d.offset, d.y - 0.1, d.y), "#747e6a");
        const p = seatPoint(u0, d.offset, d.y), q = seatPoint(u1, d.offset, d.y);
        face("fascia", [{ ...p, y: p.y - 1.1 }, { ...q, y: q.y - 1.1 }, q, p], "#3b5e4a");
        line(p, q, "#a6b2a0");
      }
      face("rear-walk", quad(u0, u1, 53, 57, 29, 29), "#7d8477");
      const lo0 = seatPoint(u0, 57, 0), lo1 = seatPoint(u1, 57, 0), hi0 = { ...lo0, y: 29 }, hi1 = { ...lo1, y: 29 };
      const mid0 = { ...lo0, y: 17 }, mid1 = { ...lo1, y: 17 };
      face("outer-wall", [lo0, lo1, mid1, mid0], "#a59e87", { material: a.details?.ornaments !== false ? "koshien:ivy:" + i : null });
      face("outer-upper", [mid0, mid1, hi1, hi0], "#a59e87", { material: a.details?.ornaments !== false ? "koshien:facade:" + i : null });
      line(hi0, hi1, "#9da999");
      if ([7, 18, 27, 42, 57, 66, 77].includes(i)) {
        const u = i / S, p0 = seatPoint(u - 5e-3, 60, 0), p1 = seatPoint(u + 5e-3, 60, 0), q0 = { ...p0, y: 31 }, q1 = { ...p1, y: 31 };
        face("pier", [p0, p1, q1, q0], "#b1a68a");
        for (const [p, q, side] of [[p0, q0, -1], [p1, q1, 1]]) {
          const inner = seatPoint(u + side * 5e-3, 57, 0);
          face("pier-side", [p, inner, { ...inner, y: 31 }, q], "#8c856f");
        }
        face("pier-cap", [q0, q1, seatPoint(u + 5e-3, 57, 31), seatPoint(u - 5e-3, 57, 31)], "#c1b9a0");
      }
      if (back) {
        face("roof", quad(u0, u1, 17, 59, 33, 37.5), "#a8b3b3", { roof: true, material: "koshien:roof" });
        face("roof-under", quad(u0, u1, 17, 59, 32.6, 37.1), "#152623", { roof: true });
        const p = seatPoint(u0, 17, 32.5), q = seatPoint(u1, 17, 32.5);
        line(p, q, "#b5c3bd", true);
        if (i % 2 === 0) {
          line(p, seatPoint(u0, 59, 36.9), "#68796e", true);
          line(seatPoint(u0, 57, 20), seatPoint(u0, 59, 37), "#5b6f61", true);
        }
        for (const offset of [28, 41, 53]) {
          const y = 32.6 + (offset - 17) * 4.5 / 42;
          line(seatPoint(u0, offset, y - 0.04), seatPoint(u1, offset, y - 0.04), "#3e5149", true);
        }
        if (i % 3 !== 0) line({ ...p, y: 33.1 }, { ...q, y: 33.1 }, "#ece9cf", true);
      }
    }
    for (let i = 0; i < S; i++) {
      if (central(i)) continue;
      const p = seatPoint(i / S, 0, 0), q = seatPoint((i + 1) / S, 0, 0), wp = wallAt(g, Math.atan2(p.x, p.z)), wq = wallAt(g, Math.atan2(q.x, q.z));
      face("apron", [{ ...wp.position, y: 0 }, { ...wq.position, y: 0 }, q, p], "#485c3d", { density: 1 });
    }
    const net = { ...KOSHIEN_NET, panels: [] }, netPoint = (angle) => ({ ...wallAt(g, angle * Math.PI / 180).position, y: g.vertices[0].heightMeters }), upperZ = seatPoint(0, 17, 32).z, upper = (p) => ({ x: p.x, y: KOSHIEN_NET.heightMeters, z: upperZ });
    for (let i = 0; i < KOSHIEN_NET.panelCount; i++) {
      const angle = 145 + i * 70 / KOSHIEN_NET.panelCount, p = netPoint(angle), q = netPoint(angle + 70 / KOSHIEN_NET.panelCount);
      net.panels.push({ p, q, topP: upper(p), topQ: upper(q), topY: KOSHIEN_NET.heightMeters });
    }
    for (let i = 0; i <= KOSHIEN_NET.panelCount; i++) {
      const p = i < KOSHIEN_NET.panelCount ? net.panels[i].p : net.panels.at(-1).q, top = upper(p);
      if (i % 2 === 0) {
        segments.push({ id: "koshien-net-support", p, q: top, color: "#607c79", alpha: 0.5, detailDensity: 4 });
        segments.push({ id: "koshien-net-tie", p: top, q: { ...top, y: 33 }, color: "#69756b", alpha: 0.42, detailDensity: 4 });
      }
      if (i < KOSHIEN_NET.panelCount) {
        const panel2 = net.panels[i];
        segments.push({ id: "koshien-net-top", p: top, q: panel2.topQ, color: "#768070", alpha: 0.48, detailDensity: 4 });
        for (const t of [0.25, 0.5, 0.75]) {
          const p2 = { x: panel2.p.x, y: panel2.p.y + (top.y - panel2.p.y) * t, z: panel2.p.z + (top.z - panel2.p.z) * t }, q = { x: panel2.q.x, y: panel2.q.y + (top.y - panel2.q.y) * t, z: panel2.q.z + (top.z - panel2.q.z) * t };
          segments.push({ id: "koshien-net-cross", p: p2, q, color: "#4e6867", alpha: 0.4, detailDensity: 4 });
        }
      }
    }
    for (const side of [-1, 1]) {
      const p = { x: side * 29, y: 1.8, z: 7 }, q = { x: side * 45, y: 1.8, z: 30 };
      face("dugout", [p, q, { ...q, x: q.x + side * 4, z: q.z - 3 }, { ...p, x: p.x + side * 4, z: p.z - 3 }], "#245c47");
      line(p, q, "#b1bea9");
      const w = wallAt(g, side * Math.PI / 4);
      line({ ...w.position, y: 0 }, { ...w.position, y: 31 }, "#d5b83f");
    }
    const board = KOSHIEN_BOARD, z = board.z;
    const front = wallAt(g, 0).distanceMeters + 1;
    box("backscreen-plinth", 0, z, board.width, 16, 0, board.baseY, "#234d3c");
    box("backscreen-rear", 0, 168, 64, 32, 0, 9, "#244638");
    box("backscreen-lower", 0, (front + 136) / 2, 26, 136 - front, 0, 6.2, "#183d30");
    panel("backscreen-eye", -13, 13, 0, 6.2, front - 0.03, "#14362c", "koshien:backscreen");
    face("backscreen-terrace", [{ x: -31, y: 6.3, z: 127 }, { x: 31, y: 6.3, z: 127 }, { x: 31, y: 6.3, z: 136 }, { x: -31, y: 6.3, z: 136 }], "#29523e");
    for (const side of [-1, 1]) {
      const edge = side < 0 ? gapStart / S : gapEnd / S, inside = edge - side * 6e-3;
      for (const d of bands) {
        const p = seatPoint(edge, d.offset, d.y), q = seatPoint(edge, d.offset + d.depth, d.y + d.rise);
        face("backscreen-seat-end", [{ ...p, y: 0 }, { ...q, y: 0 }, q, p], "#234b3a");
        for (let row = 0; row < d.rows; row++) {
          const v0 = row / d.rows, v1 = (row + 1) / d.rows, o0 = d.offset + d.depth * v0, o1 = d.offset + d.depth * v1, y0 = d.y + d.rise * v0, y1 = d.y + d.rise * v1;
          face("backscreen-stair", quad(Math.min(edge, inside), Math.max(edge, inside), o0, o1, y1, y1), "#627d68");
          const a0 = seatPoint(edge, o0, y0), a1 = seatPoint(inside, o0, y0);
          face("backscreen-stair-riser", [a0, a1, { ...a1, y: y1 }, { ...a0, y: y1 }], "#355843");
        }
        for (const u of [edge, inside]) {
          const p2 = seatPoint(u, d.offset, d.y + 1), q2 = seatPoint(u, d.offset + d.depth, d.y + d.rise + 1);
          line(p2, q2, "#8aa391");
          for (let j = 0; j <= 3; j++) {
            const t = j / 3, r = seatPoint(u, d.offset + d.depth * t, d.y + d.rise * t);
            line(r, { ...r, y: r.y + 1 }, "#779380");
          }
        }
      }
      const x0 = side < 0 ? -18 : 14, x1 = x0 + 4;
      for (let row = 0; row < 18; row++) {
        const z0 = front + (136 - front) * row / 18, z1 = front + (136 - front) * (row + 1) / 18, y = 6.3 * (row + 1) / 18;
        face("backscreen-stair", [{ x: x0, y, z: z0 }, { x: x1, y, z: z0 }, { x: x1, y, z: z1 }, { x: x0, y, z: z1 }], "#58765f");
        panel("backscreen-step", x0, x1, 6.3 * row / 18, y, z0, "#244b37");
      }
      for (const x2 of [x0, x1]) {
        line({ x: x2, y: 1, z: front }, { x: x2, y: 7.3, z: 136 }, "#90a797");
        for (let row = 0; row <= 6; row++) {
          const t = row / 6, p = { x: x2, y: 6.3 * t, z: front + (136 - front) * t };
          line(p, { ...p, y: p.y + 1 }, "#789783");
        }
      }
      const x = side * 15.8;
      panel("backscreen-flank", x - 2, x + 2, 0, 6.2, front + 0.1, "#214c39");
      if (a.details?.logos !== false) panel("backscreen-sankyu-side", x - 1.1, x + 1.1, 3.25, 6.1, front + 0.08, "#214c39", "koshien:sankyu-side");
    }
    if (a.details?.logos !== false) panel("backscreen-sankyu", -10.5, 10.5, 3.25, 5.95, front - 0.06, "#dfe5dc", "koshien:sankyu");
    box("score-body", 0, z + 1.3, board.width, 2.6, board.baseY, board.bodyHeight, "#2b3434");
    panel("score-display", -board.screenWidth / 2, board.screenWidth / 2, 10.1, 28.9, z - 0.08, score.enabled ? "#080d0e" : "#101817", score.enabled ? "koshien:score" : null);
    box("score-cap", 0, z + 1, 64, 3, 29.8, 0.65, "#3c4543");
    box("clock-shoulders", 0, z + 1.4, 14, 2.8, 30, 7.5, "#293334");
    box("clock-tower", 0, z + 1.5, 8.8, 3, 30, 14, "#293334");
    panel("clock-face", -4.1, 4.1, 30.1, 43.7, z - 0.12, "#222b2d", "koshien:clock");
    box("clock-cap", 0, z + 1.5, 10, 3.8, 44, 0.65, "#424c48");
    for (const [x, h] of [[-27, 39], [-13, 48], [0, 56], [13, 48], [27, 39]]) {
      line({ x, y: 30, z: z + 1 }, { x, y: h, z: z + 1 }, "#8d9a91");
      const width = x === 0 ? 6 : 5, height = x === 0 ? 4 : 3;
      face("flag", [{ x: x - width, y: h - 0.25, z: z + 1.2 }, { x, y: h, z: z + 1 }, { x, y: h - height, z: z + 1 }, { x: x - width, y: h - height - 0.25, z: z + 1.7 }], "#737d70", { material: x === 0 ? "koshien:flag-japan" : x === 27 ? "koshien:flag-team" : "koshien:flag-club" });
    }
    if (a.details?.logos !== false) panel("vision-sign", -27, 27, 6.5, 8.8, 135.94, "#244b3b", "koshien:vision");
    for (const [x, z2] of [[-101, 70], [101, 70], [-67, 139], [67, 139]]) {
      const y = 49;
      for (const dx of [-3.3, 3.3]) {
        line({ x: x + dx, y: 1, z: z2 }, { x: x + dx * 0.72, y, z: z2 }, "#98a49a");
        line({ x: x + dx, y: 1, z: z2 + 2 }, { x: x + dx * 0.72, y, z: z2 + 2 }, "#748e7c");
      }
      for (let h = 5; h < 49; h += 5) {
        line({ x: x - 3, y: h, z: z2 }, { x: x + 3, y: h + 5, z: z2 }, "#768d7d");
        line({ x: x + 3, y: h, z: z2 }, { x: x - 3, y: h + 5, z: z2 }, "#768d7d");
      }
      panel("tower-ad", x - 3, x + 3, 25, 40, z2 - 0.2, "#356454", "koshien:tower");
      panel("light-rack", x - 11, x + 11, y, y + 4, z2, "#a5b3a6");
      for (let i = 0; i < 14; i++) for (let row = 0; row < 2; row++) panel("lamp", x - 10 + i * 1.48, x - 9.2 + i * 1.48, y + 0.5 + row * 1.7, y + 1.5 + row * 1.7, z2 - 0.1, "#ecebd4");
    }
    if (a.details?.logos !== false) {
      panel("distance", -3, 3, 0.4, 2.5, wallAt(g, 0).distanceMeters - 0.08, "#1b4d3d", "koshien:distance");
      panel("entrance", -22, 22, 20, 25, entranceZ, "#295544", "koshien:entrance");
      for (let i = 3; i < S - 3; i += 4) {
        if (i < gapEnd && i + 3 > gapStart) continue;
        const p = seatPoint(i / S, 54, 31), q = seatPoint((i + 3) / S, 54, 31);
        face("rim-sign", [p, q, { ...q, y: 34 }, { ...p, y: 34 }], i % 3 === 0 ? "#b9b59c" : "#315b48", { material: "koshien:wall" });
        const bp = seatPoint(i / S, 54.15, 31), bq = seatPoint((i + 3) / S, 54.15, 31);
        face("rim-sign-back", [bp, bq, { ...bq, y: 34 }, { ...bp, y: 34 }], "#3b5144");
      }
    }
    for (let i = -2; i <= 2; i++) {
      const x = i * 9;
      panel("gate-door", x - 2.7, x + 2.7, 0, 3, entranceZ, "#183d30");
      for (let j = 0; j < 12; j++) {
        const a2 = j * Math.PI / 12, b = (j + 1) * Math.PI / 12, p = { x: x + 2.7 * Math.cos(a2), y: 3 + 2.1 * Math.sin(a2), z: entranceZ }, q = { x: x + 2.7 * Math.cos(b), y: 3 + 2.1 * Math.sin(b), z: entranceZ };
        face("gate-arch", [{ x, y: 3, z: entranceZ }, p, q], "#183d30");
        line(p, q, "#9cae96");
      }
      for (const side of [-1, 1]) line({ x: x + side * 2.7, y: 0, z: entranceZ }, { x: x + side * 2.7, y: 3, z: entranceZ }, "#9cae96");
    }
    face("surroundings", [{ x: -205, y: -1, z: -145 }, { x: 205, y: -1, z: -145 }, { x: 205, y: -1, z: 225 }, { x: -205, y: -1, z: 225 }], "#202e2a", { density: 1 });
    for (const [x, z2, w, d, h] of [[-156, 26, 30, 28, 17], [156, 34, 26, 30, 19], [-139, 121, 27, 24, 25], [139, 130, 29, 22, 23], [-80, 195, 25, 22, 22], [-35, 207, 28, 27, 31], [32, 204, 25, 22, 26], [84, 196, 30, 23, 18]]) box("city", x, z2, w, d, -1, h, "#394640");
    face("road", [{ x: -190, y: 2, z: -112 }, { x: 190, y: 2, z: -112 }, { x: 190, y: 2, z: -124 }, { x: -190, y: 2, z: -124 }], "#394641", { density: 1 });
    for (const z2 of [-115, -121]) line({ x: -190, y: 2.05, z: z2 }, { x: 190, y: 2.05, z: z2 }, "#6f7b70");
    return {
      surfaces,
      segments,
      lights,
      net,
      capacity: a.capacity,
      tiers: 3,
      rowsPerTier: 46,
      outerOffset: 57,
      spectatorTiles: tiles,
      spectatorLights: 0,
      lightTowers: 4,
      seating: { decks: 3, rows: 46 },
      envelope: { rx: 139, rz: 155, centerZ: 44, frontZ: entranceZ - 1, bowlTop: 29, eaveY: 33, topY: 56, exponent: 2 },
      roof: { type: "fixed_canopy", openingPercent: 100, y: 37.5, innerOffset: 17, outerOffset: 59 },
      scoreboard: { enabled: score.enabled, mode: "DESIGN_SAMPLE", layout: "koshien_split_black", capabilities: scoreboardCapabilities(a.style), fieldDiagram: scoreboardFieldDiagram(a), z, baseY: board.baseY, scale: 0.55, width: board.width, bodyHeight: board.bodyHeight, clock: { mode: "DISPLAY_SAMPLE", bso: { balls: score.balls, strikes: score.strikes, outs: score.outs } }, teams: score.teams.map((t) => ({ ...t, runs: runs(t) })), balls: score.balls, strikes: score.strikes, outs: score.outs, speedKmh: score.speedKmh }
    };
  }

  // tools/ballpark-studio/stadium-atmosphere.mjs
  var clamp2 = (n, a, b) => Math.max(a, Math.min(b, n));
  var rgb4 = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  var hex4 = (c) => "#" + c.map((n) => Math.round(clamp2(n, 0, 255)).toString(16).padStart(2, "0")).join("");
  function lightingFixtures(g, m) {
    if (["niikura_dome", "fukuoka_dome"].includes(g.architecture?.style)) return m.illuminationFixtures;
    if (g.architecture?.style === "russian_dome") {
      const e = m.envelope;
      return Array.from({ length: 8 }, (_, i) => {
        const t = (i + 0.5) * Math.PI / 4;
        return { x: e.rx * 0.78 * Math.sin(t), y: e.eaveY - 2, z: e.centerZ + e.rz * 0.78 * Math.cos(t), target: { x: 0, y: 0, z: 45 } };
      });
    }
    const groups = [];
    for (const s of m.surfaces) {
      if (!s.id.includes("lamp")) continue;
      const p = s.points.reduce((a, p2) => ({ x: a.x + p2.x / s.points.length, y: a.y + p2.y / s.points.length, z: a.z + p2.z / s.points.length }), { x: 0, y: 0, z: 0 });
      let group = groups.find((q) => Math.hypot(q.x / q.n - p.x, q.z / q.n - p.z) < 30);
      if (!group) {
        group = { x: 0, y: 0, z: 0, n: 0 };
        groups.push(group);
      }
      for (const k2 of ["x", "y", "z"]) group[k2] += p[k2];
      group.n++;
    }
    return groups.map((p) => ({ x: p.x / p.n, y: p.y / p.n, z: p.z / p.n, target: { x: 0, y: 0, z: 45 } }));
  }
  function fixtureContribution(f, p) {
    const dx = p.x - f.x, dy = p.y - f.y, dz = p.z - f.z, d = Math.hypot(dx, dy, dz), ax = f.target.x - f.x, ay = f.target.y - f.y, az = f.target.z - f.z, cos = (dx * ax + dy * ay + dz * az) / (Math.max(0.01, d) * Math.hypot(ax, ay, az));
    return clamp2((cos - 0.25) / 0.75, 0, 1) ** 2 / (1 + (d / 160) ** 2);
  }
  function createSpatialLight(g, m) {
    const e = g.architecture.effects.environment, l = g.architecture.effects.lighting, fixtures = lightingFixtures(g, m), day = e.period === "day", on = (!day || g.architecture.style === "fukuoka_dome" && g.architecture.roof.openingPercent < 80) && l.enabled && l.brightness > 0, tint = rgb4(l.color).map((v) => v / 255), reference = fixtures.reduce((v, f) => v + fixtureContribution(f, { x: 0, y: 0, z: 45 }), 0) || 1, cache9 = /* @__PURE__ */ new Map(), closed = ["russian_dome", "fukuoka_dome"].includes(g.architecture.style) && g.architecture.roof.openingPercent < 5;
    const beams = ["niikura_dome", "fukuoka_dome"].includes(g.architecture.style) ? fixtures.flatMap((f) => f.kind === "facade" ? [{ ...f, power: f.power }] : [{ ...f, power: 1.5 }, { ...f, target: { x: -f.x * 0.65, y: 20, z: 55 + (55 - f.z) * 0.5 }, power: 1.1 }]) : g.architecture.style === "dodger_stadium" ? fixtures.flatMap((f) => [{ ...f, power: 1.35 }, { ...f, target: { x: -f.x * 0.65, y: 20, z: 45 + (45 - f.z) * 0.55 }, power: 1.15 }]) : fixtures.map((f) => ({ ...f, power: 1 }));
    const illumination = (p) => {
      const artificial = on ? beams.reduce((v, f) => v + (g.architecture.style === "fukuoka_dome" && f.kind === "facade" && Math.hypot(p.x, p.z - m.envelope.centerZ) < 108 ? 0 : fixtureContribution(f, p)) * f.power * (["niikura_dome", "fukuoka_dome"].includes(g.architecture.style) && f.kind === "facade" ? reference : 1), 0) / reference * l.brightness : 0;
      const underRoof = closed && Math.abs(p.x) < m.envelope.rx * 0.9 && Math.abs(p.z - m.envelope.centerZ) < m.envelope.rz * 0.9 && p.y < m.envelope.eaveY;
      const ambient = day ? underRoof ? 0.25 : e.weather === "clear" ? 1.08 : 0.86 : g.architecture.style === "fukuoka_dome" ? p.y > 38 ? 0.42 : 0.24 : 0.16;
      return { ambient, artificial };
    };
    function color(c, p, emissive = false) {
      if (emissive || !p) return c;
      const y = p.y ?? 0, key = [Math.round(p.x / 5), Math.round(y / 10), Math.round(p.z / 5)].join(","), a = cache9.get(key) ?? illumination({ x: Math.round(p.x / 5) * 5, y: Math.round(y / 10) * 10, z: Math.round(p.z / 5) * 5 });
      if (!cache9.has(key)) {
        if (cache9.size >= 8192) cache9.delete(cache9.keys().next().value);
        cache9.set(key, a);
      }
      const lit = rgb4(c).map((v, i) => v * (a.ambient + a.artificial * 0.84 * tint[i])), peak = Math.max(...lit);
      if (["dodger_stadium", "niikura_dome", "fukuoka_dome"].includes(g.architecture.style) && on && peak > 235) for (let i = 0; i < 3; i++) lit[i] *= 235 / peak;
      return hex4(lit);
    }
    return { color, illumination, fixtures, on, day, model: "fixture-cone-distance-artistic", shadows: false };
  }
  var spatialCache = /* @__PURE__ */ new WeakMap();
  function spatialLight(g, m) {
    if (!g?.architecture?.effects?.environment) return null;
    let s = spatialCache.get(g);
    if (!s) {
      s = createSpatialLight(g, m);
      spatialCache.set(g, s);
    }
    return s;
  }

  // tools/ballpark-studio/stadium-mesh.mjs
  var TAU6 = Math.PI * 2;
  var cache8 = /* @__PURE__ */ new WeakMap();
  var mix = (a, b, t) => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
    ...a.u === void 0 ? {} : { u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t }
  });
  var shade2 = (hex5, k2) => "#" + hex5.slice(1).match(/../g).map((v) => Math.min(255, Math.round(parseInt(v, 16) * k2)).toString(16).padStart(2, "0")).join("");
  var crowdTintCache = /* @__PURE__ */ new Map();
  function seatCrowdColor(color, tint, strength = 0.3) {
    const key = color + tint + strength;
    if (crowdTintCache.has(key)) return crowdTintCache.get(key);
    const b = [1, 3, 5].map((i) => Math.round(parseInt(color.slice(i, i + 2), 16) * (1 - strength) + parseInt(tint.slice(i, i + 2), 16) * strength).toString(16).padStart(2, "0")), v = "#" + b.join("");
    if (crowdTintCache.size >= 256) crowdTintCache.delete(crowdTintCache.keys().next().value);
    crowdTintCache.set(key, v);
    return v;
  }
  function stadiumMesh(g) {
    if (!g.architecture) return null;
    if (cache8.has(g)) return cache8.get(g);
    if (g.architecture.style === "fukuoka_dome") {
      const mesh3 = paypayMesh(g);
      cache8.set(g, mesh3);
      return mesh3;
    }
    if (g.architecture.style === "niikura_dome") {
      const mesh3 = niikuraMesh(g);
      cache8.set(g, mesh3);
      return mesh3;
    }
    if (g.architecture.style === "dodger_stadium") {
      const mesh3 = dodgerMesh(g);
      cache8.set(g, mesh3);
      return mesh3;
    }
    if (g.architecture.style === "koshien") {
      const mesh3 = koshienMesh(g);
      cache8.set(g, mesh3);
      return mesh3;
    }
    const a = g.architecture, c = a.colors, surfaces = [], segments = [], lights = [], N2 = 96, rows = Math.max(12, Math.ceil(a.capacity / (a.tiers * 1e3))), tierStride = rows * 0.68 + 5, outerOffset = 7 + (a.tiers - 1) * tierStride + (rows - 1) * 0.68 + 8, rimY = 4 + (a.tiers - 1) * (rows * 0.52 + 4) + (rows - 1) * 0.52 + 12, radial = (t, offset, y) => {
      const r = wallAt(g, t).distanceMeters + offset;
      return { x: Math.sin(t) * r, y, z: Math.cos(t) * r };
    }, seatPoint = (t, offset, y) => radial(t, offset + 7 - 5 * Math.max(0, Math.min(1, (Math.abs(t) - Math.PI / 4) / (Math.PI / 12))), y), face = (points, color, roof = false, crowdTile = null, material = null) => surfaces.push({ id: `${material ?? "surface"}-${surfaces.length}`, points, color, roof, crowdTile, material }), line = (p, q, color, roof = false) => segments.push({ p, q, color, roof });
    const wallAngles = [.../* @__PURE__ */ new Set([...Array.from({ length: N2 + 1 }, (_, i) => -Math.PI + i * TAU6 / N2), ...g.vertices.map((p) => p.angleDegrees * Math.PI / 180)])].sort((a2, b) => a2 - b);
    for (let i = 0; i < wallAngles.length - 1; i++) {
      const t0 = wallAngles[i], t1 = wallAngles[i + 1], w0 = wallAt(g, t0), w1 = wallAt(g, t1), p0 = { ...w0.position, y: 0 }, p1 = { ...w1.position, y: 0 }, q0 = { ...w0.position, y: w0.heightMeters }, q1 = { ...w1.position, y: w1.heightMeters };
      face([p0, p1, q1, q0], shade2(c.blue, 0.85));
      line(q0, q1, c.gold);
    }
    for (let tier = 0; tier < a.tiers; tier++) {
      const offset = tier * tierStride, y = 3 + tier * (rows * 0.52 + 4);
      for (let band = 0; band < 4; band++) for (let i = 0; i < N2; i++) {
        const r0 = band * (rows - 1) / 4, r1 = (band + 1) * (rows - 1) / 4, t0 = -Math.PI + i * TAU6 / N2, t1 = -Math.PI + (i + 1) * TAU6 / N2, color = (Math.floor(i / 8) + tier) % 2 ? c.blue : c.red;
        face([seatPoint(t0, offset + r0 * 0.68, y + r0 * 0.52), seatPoint(t1, offset + r0 * 0.68, y + r0 * 0.52), seatPoint(t1, offset + r1 * 0.68, y + r1 * 0.52), seatPoint(t0, offset + r1 * 0.68, y + r1 * 0.52)], shade2(color, 0.65 + band * 0.06), false, { id: tier * 4 * N2 + band * N2 + i, tier, band, sector: i });
      }
      for (let i = 0; i < N2; i++) {
        const t0 = -Math.PI + i * TAU6 / N2, t1 = -Math.PI + (i + 1) * TAU6 / N2;
        line(seatPoint(t0, offset - 1, y - 0.4), seatPoint(t1, offset - 1, y - 0.4), c.gold);
        line(seatPoint(t0, offset + (rows - 1) * 0.68 + 1, y + (rows - 1) * 0.52 + 0.5), seatPoint(t1, offset + (rows - 1) * 0.68 + 1, y + (rows - 1) * 0.52 + 0.5), c.gold);
      }
      for (let i = 0; i < 24; i++) {
        const t = -Math.PI + i * TAU6 / 24;
        line(seatPoint(t, offset, y), seatPoint(t, offset + (rows - 1) * 0.68, y + (rows - 1) * 0.52), shade2(c.gold, 0.85));
      }
    }
    for (let tier = 0; tier < a.tiers; tier++) for (let i = 0; i < N2; i++) {
      const t0 = -Math.PI + i * TAU6 / N2, t1 = -Math.PI + (i + 1) * TAU6 / N2, offset = tier * tierStride, y = 3 + tier * (rows * 0.52 + 4), p = seatPoint(t0, offset - 1.3, y), q = seatPoint(t1, offset - 1.3, y), bottom = Math.max(0.3, y - 3.2);
      face([{ ...p, y: bottom }, { ...q, y: bottom }, q, p], shade2(c.blue, 0.52));
      face([{ ...p, y: y - 0.25 }, { ...q, y: y - 0.25 }, seatPoint(t1, offset + 1, y - 0.25), seatPoint(t0, offset + 1, y - 0.25)], shade2(c.gold, 0.65));
      line({ ...p, y: y - 1.1 }, { ...q, y: y - 1.1 }, c.gold);
      line(p, q, "#fff0ba");
    }
    const seatVertices = surfaces.filter((s) => s.crowdTile).flatMap((s) => s.points), xs = seatVertices.map((p) => Math.abs(p.x)), zs = seatVertices.map((p) => p.z), centerZ = (Math.max(...zs) + Math.min(...zs)) / 2, rx = Math.max(...xs) + 13, rz = (Math.max(...zs) - Math.min(...zs)) / 2 + 13, exponent = 3.3, bowlTop = Math.max(...seatVertices.map((p) => p.y)), eaveY = bowlTop + 8, shell = (t, y) => {
      const sn = Math.sin(t), cs = Math.cos(t);
      return { x: rx * Math.sign(sn) * Math.abs(sn) ** (2 / exponent), y, z: centerZ + rz * Math.sign(cs) * Math.abs(cs) ** (2 / exponent) };
    }, shellSpan = (z) => rx * Math.max(0, 1 - Math.abs((z - centerZ) / rz) ** exponent) ** (1 / exponent), frontZ = centerZ - rz, roofY = eaveY + 10, z0 = Math.max(frontZ + 28, -95), z1 = Math.min(centerZ + rz - 30, wallAt(g, 0).distanceMeters + 28), halfX = Math.min(shellSpan(z0), shellSpan(z1)) * 0.49, opening = a.roof.openingPercent / 100, rectangle = (t) => {
      const sx = Math.sin(t), sz = Math.cos(t), distance = Math.min(Math.abs(sx) > 1e-9 ? halfX / Math.abs(sx) : Infinity, Math.abs(sz) > 1e-9 ? (sz > 0 ? z1 - centerZ : z0 - centerZ) / sz : Infinity);
      return { x: sx * distance, z: centerZ + sz * distance };
    };
    for (let i = 0; i < N2; i++) {
      const t0 = -Math.PI + i * TAU6 / N2, t1 = -Math.PI + (i + 1) * TAU6 / N2, p = (t, y) => shell(t, y), color = Math.floor(i / 8) % 2 ? c.blue : c.red;
      face([p(t0, 0), p(t1, 0), p(t1, 13), p(t0, 13)], i % 2 ? "#193445" : "#3e5861");
      face([p(t0, 13), p(t1, 13), p(t1, 16), p(t0, 16)], c.gold);
      face([p(t0, 16), p(t1, 16), p(t1, eaveY - 7), p(t0, eaveY - 7)], shade2(color, 0.8), false, null, a.details?.ornaments === false ? null : "facade:" + i);
      face([p(t0, eaveY - 7), p(t1, eaveY - 7), p(t1, eaveY), p(t0, eaveY)], shade2(c.gold, 0.85));
      line(p(t0, 0), p(t0, 13), "#e7b75c");
      line(p(t0, 6), p(t1, 6), "#bd9853");
      line(p(t0, eaveY - 1), p(t1, eaveY - 1), "#ead39a");
      const seatEdge0 = seatPoint(t0, (a.tiers - 1) * tierStride + (rows - 1) * 0.68, bowlTop), seatEdge1 = seatPoint(t1, (a.tiers - 1) * tierStride + (rows - 1) * 0.68, bowlTop);
      face([seatEdge0, seatEdge1, p(t1, bowlTop), p(t0, bowlTop)], shade2(c.blue, 0.55));
      line(p(t0, bowlTop + 1), p(t1, bowlTop + 1), c.gold);
      const in0 = rectangle(t0), in1 = rectangle(t1), out0 = p(t0, eaveY), out1 = p(t1, eaveY), canopy = (out, inner, u) => ({ x: out.x + (inner.x - out.x) * u, z: out.z + (inner.z - out.z) * u, y: eaveY + 10 * u + 3 * Math.sin(u * Math.PI) });
      for (let ring = 0; ring < 4; ring++) {
        const u = ring / 4, v = (ring + 1) / 4;
        face([canopy(out0, in0, u), canopy(out1, in1, u), canopy(out1, in1, v), canopy(out0, in0, v)], shade2("#a2b2c6", 0.72 + 0.22 * Math.sin(t0 + 0.8) + ring * 0.035), true);
      }
      line(out0, out1, "#55aeff", true);
      line({ ...in0, y: roofY }, { ...in1, y: roofY }, c.gold, true);
      if (i % 4 === 0) {
        const a0 = { ...out0, y: eaveY - 3 }, a1 = { ...in0, y: roofY - 3 };
        line(a0, a1, c.gold, true);
        const mid = mix(a0, a1, 0.5);
        line({ ...a0, y: a0.y - 4 }, mid, c.gold, true);
        line(mid, { ...a1, y: a1.y - 4 }, c.gold, true);
      }
    }
    const leafPoint = (side, u, v) => ({ x: side * halfX * (u + opening), y: roofY + 5 * (1 - u * u) * Math.sin(v * Math.PI), z: z0 + (z1 - z0) * v });
    for (const side of [-1, 1]) for (let i = 0; i < 8; i++) for (let j = 0; j < 20; j++) {
      const p = leafPoint(side, i / 8, j / 20), q = leafPoint(side, (i + 1) / 8, j / 20), r = leafPoint(side, (i + 1) / 8, (j + 1) / 20), s = leafPoint(side, i / 8, (j + 1) / 20);
      face([p, q, r, s], shade2("#aab8cc", 0.78 + i * 0.028 + (side === -1 ? 0.08 : 0)), true);
      if (i === 0 || i === 7) line(p, s, i === 0 ? "#f1dc9e" : "#69bfff", true);
      if (j % 5 === 0) line(p, q, shade2(c.gold, 0.85), true);
    }
    for (const z of [z0, z1]) {
      const span = shellSpan(z) - 1;
      line({ x: -span, y: roofY - 1, z }, { x: span, y: roofY - 1, z }, c.gold, true);
      line({ x: -span, y: roofY - 4, z }, { x: span, y: roofY - 4, z }, shade2(c.gold, 0.7), true);
      for (let i = 0; i < 16; i++) {
        const x = -span + i * span * 2 / 16, dx = span * 2 / 16;
        line({ x, y: roofY - 1, z }, { x: x + dx / 2, y: roofY - 4, z }, c.gold, true);
        line({ x: x + dx / 2, y: roofY - 4, z }, { x: x + dx, y: roofY - 1, z }, c.gold, true);
      }
    }
    const board = (z, y, w, h) => {
      face([{ x: -w / 2, y, z }, { x: w / 2, y, z }, { x: w / 2, y: y + h, z }, { x: -w / 2, y: y + h, z }], "#101d33", false, null, a.details?.logos === false ? null : "wolf");
      line({ x: -w / 2, y, z: z - 0.08 }, { x: -w / 2, y: y + h, z: z - 0.08 }, c.gold);
      line({ x: w / 2, y, z: z - 0.08 }, { x: w / 2, y: y + h, z: z - 0.08 }, c.gold);
      line({ x: -w / 2, y: y + h, z: z - 0.08 }, { x: w / 2, y: y + h, z: z - 0.08 }, c.gold);
    };
    const score = a.scoreboard ?? defaultScoreboard(), scoreZ = wallAt(g, 0).distanceMeters + outerOffset * 0.3, scoreBase = bowlTop - 42, scoreScale = Math.min(1, Math.max(0.25, (roofY - 6) / 59)), fittedBase = Math.max(5, Math.min(scoreBase, roofY - 1 - 59 * scoreScale)), panel = (x0, x1, y0, y1, z, color, material = null) => face([{ x: x0, y: y0, z }, { x: x1, y: y0, z }, { x: x1, y: y1, z }, { x: x0, y: y1, z }], color, false, null, material);
    if (score.enabled) {
      const firstFace = surfaces.length, firstSegment = segments.length;
      panel(-82, 82, scoreBase, scoreBase + 31, scoreZ + 3, "#111d30");
      for (const x of [-82, 82]) face([{ x, y: scoreBase, z: scoreZ }, { x, y: scoreBase, z: scoreZ + 3 }, { x, y: scoreBase + 31, z: scoreZ + 3 }, { x, y: scoreBase + 31, z: scoreZ }], shade2(c.gold, 0.7));
      face([{ x: -82, y: scoreBase + 31, z: scoreZ }, { x: 82, y: scoreBase + 31, z: scoreZ }, { x: 82, y: scoreBase + 31, z: scoreZ + 3 }, { x: -82, y: scoreBase + 31, z: scoreZ + 3 }], c.gold);
      panel(-82, 82, scoreBase, scoreBase + 31, scoreZ, c.gold);
      panel(-80, 80, scoreBase + 1, scoreBase + 30, scoreZ - 0.12, "#0b182b");
      panel(-77, 77, scoreBase + 2, scoreBase + 24, scoreZ - 0.25, "#0b182b", "scoreboard");
      panel(-77, 77, scoreBase + 24, scoreBase + 30, scoreZ - 0.25, "#0b182b", "scoreboard-title");
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -91 : 82, x1 = x0 + 9;
        panel(x0, x1, scoreBase - 1, scoreBase + 42, scoreZ, side < 0 ? c.red : c.blue, a.details?.ornaments === false ? null : "facade:0");
        for (const x2 of [x0, x1]) line({ x: x2, y: scoreBase - 1, z: scoreZ - 0.1 }, { x: x2, y: scoreBase + 42, z: scoreZ - 0.1 }, c.gold);
        line({ x: x0, y: scoreBase + 42, z: scoreZ - 0.1 }, { x: x1, y: scoreBase + 42, z: scoreZ - 0.1 }, c.gold);
        const x = side * 66;
        panel(x - 1.2, x + 1.2, scoreBase - 16, scoreBase, scoreZ + 1, shade2(c.gold, 0.7));
      }
      board(scoreZ - 0.3, scoreBase + 30, 31, 27.5);
      const crest = [[-18, scoreBase + 30], [-18, scoreBase + 53], [0, scoreBase + 59], [18, scoreBase + 53], [18, scoreBase + 30]];
      for (let i = 1; i < crest.length; i++) line({ x: crest[i - 1][0], y: crest[i - 1][1], z: scoreZ - 0.4 }, { x: crest[i][0], y: crest[i][1], z: scoreZ - 0.4 }, c.gold);
      if (scoreScale !== 1 || fittedBase !== scoreBase) {
        const fit = (p) => {
          p.x *= scoreScale;
          p.y = Math.max(0, fittedBase + (p.y - scoreBase) * scoreScale);
          p.z = scoreZ + (p.z - scoreZ) * scoreScale;
        };
        for (let i = firstFace; i < surfaces.length; i++) surfaces[i].points.forEach(fit);
        for (let i = firstSegment; i < segments.length; i++) {
          fit(segments[i].p);
          fit(segments[i].q);
        }
      }
    } else board(wallAt(g, 0).distanceMeters + outerOffset * 0.55, bowlTop - 23, 38, 34);
    board(frontZ - 0.35, 21, 42, 38);
    for (let i = 0; i < 8; i++) {
      const z = frontZ - 4 - i * 1.4, y = (8 - i) * 0.32;
      face([{ x: -40, y, z }, { x: 40, y, z }, { x: 40, y, z: z - 1.4 }, { x: -40, y, z: z - 1.4 }], shade2("#b7aa8e", 0.5 + i * 0.025));
      line({ x: -40, y, z }, { x: 40, y, z }, shade2(c.gold, 0.75));
    }
    const mesh2 = {
      scoreboard: { enabled: score.enabled, mode: "DESIGN_SAMPLE", z: scoreZ, baseY: fittedBase, scale: scoreScale, width: 164 * scoreScale, teams: score.teams.map((t) => ({ ...t, runs: runs(t) })), balls: score.balls, strikes: score.strikes, outs: score.outs, speedKmh: score.speedKmh },
      surfaces,
      segments,
      lights,
      capacity: a.capacity,
      tiers: a.tiers,
      rowsPerTier: rows,
      outerOffset,
      envelope: { rx, rz, centerZ, frontZ, bowlTop, eaveY, topY: roofY + 5, exponent },
      roof: { halfX, z0, z1, y: roofY, openingPercent: a.roof.openingPercent, leftInnerEdge: opening === 0 ? 0 : -opening * halfX, rightInnerEdge: opening * halfX },
      spectatorLights: 0,
      spectatorTiles: a.tiers * 4 * N2
    };
    cache8.set(g, mesh2);
    return mesh2;
  }
  // Live scoreboard (display only). Cells that sampled a scoreboard material keep a closure that
  // re-samples that material from liveGeometry, so the board can change without rebuilding the stadium.
  var liveGeometry = null;
  var liveBoard = null, liveBase = null, liveBoardKey = "";
  var MOVING_DENSITY = 1.0001, REST_DELAY_MS = 160, REST_SLICE_MS = 5, REST_GAP_MS = 11;
  var BOARD_MATERIAL = /^(scoreboard|paypay:vision|niikura:main-scoreboard|koshien:score|dodger:score)/;
  function sampleBoardLive(g, material, u, v, profile) {
    if (material.startsWith("paypay:")) return samplePaypayMaterial(material, u, v, profile, g);
    if (material.startsWith("niikura:")) return sampleNiikuraMaterial(material, u, v, profile, g);
    if (material.startsWith("koshien:")) return sampleKoshienMaterial(material, u, v, profile, g);
    if (material.startsWith("dodger:")) return sampleDodgerMaterial(material, u, v, profile, g);
    return sampleScoreboard(g, material, u, v, profile);
  }
  function liveGeometryFor(base) {
    if (!liveBoard || !base) return null;
    const key = JSON.stringify(liveBoard);
    if (liveBase !== base || liveBoardKey !== key) {
      liveGeometry = { ...base, architecture: { ...base.architecture, scoreboard: { ...(base.architecture.scoreboard ?? {}), ...liveBoard } } };
      liveBase = base;
      liveBoardKey = key;
    }
    return liveGeometry;
  }
  function renderStadium(input) {
    const steps = renderStadiumSteps(input);
    let next = steps.next();
    while (!next.done) next = steps.next();
    return next.value;
  }
  function* renderStadiumSteps({ geometry: g, project, paint, grid, cam, cutaway = false, crowd = { frame: 0, frames: 3, visible: true }, onEffectOcclusion = null, moving = false }) {
    const m = stadiumMesh(g);
    if (!m) return null;
    const appearance = g.architecture.crowd ?? DEFAULT_CROWD_APPEARANCE, palettes = koshienFanPalettes(g.architecture), palette = palettes.home, atlas = crowd.visible && appearance.attendance !== "empty" ? crowdAtlas(palette, appearance, g.architecture.style === "niikura_dome", g.architecture.style === "fukuoka_dome" ? "mixed-yellow" : null) : null, visitorAtlas = atlas && palettes.visitor ? crowdAtlas(palettes.visitor, appearance) : null;
    const metricCrowd = ["niikura_dome", "fukuoka_dome"].includes(g.architecture.style), step = grid.step(), sinYaw = Math.sin(cam.yaw), cosYaw = Math.cos(cam.yaw), sinPitch = Math.sin(cam.pitch), cosPitch = Math.cos(cam.pitch), depth = (p) => -sinPitch * (p.y - cam.eye.y) + cosPitch * (sinYaw * (p.x - cam.eye.x) + cosYaw * (p.z - cam.eye.z)), omit = (roof, ps) => roof && cutaway && cam.eye.y > 20 && ps.reduce((n, p) => n + p.z, 0) / ps.length < 35;
    const depthBins = /* @__PURE__ */ new Map(), fineJobs = [], logoProfiles = [], binSize = 24;
    let lightPoint = null;
    let cells2 = 0, triangles = 0, omitted = 0, crowdCells = 0, ledCells = 0, glowEnergy = 0, fineCells = 0, emblemCells = 0, fineGeometryOccluded = 0;
    const spatial = spatialLight(g, m), shadeCrowdDiffuse = (c) => spatial ? spatial.color(c, lightPoint, false) : c, lighting = spatial ? { ...g.architecture.effects.lighting, enabled: spatial.on } : g.architecture.effects?.lighting, lightOverride = !!spatial || !neutralLighting(lighting);
    const emit = (x, y, d, color, glow = 0, density = 1, surfaceId = null, alpha = 1, prelit = false, altColor = null, resample = null, fan = null, waveAt = null) => {
      if (Number.isFinite(d) && d >= 0.121) {
        if (lightOverride && surfaceId?.includes("lamp")) {
          const on = lighting.enabled && lighting.brightness > 0;
          color = on ? shade2(lighting.color, Math.min(1, Math.sqrt(lighting.brightness))) : "#27332d";
          glow = on ? Math.sqrt(lighting.brightness) * 5 : 0;
        }
        if (spatial && !prelit) color = spatial.color(color, lightPoint, /score|clock|lamp/.test(surfaceId ?? "") || glow > 0);
        paint(x, y, d, color, alpha, "ballpark", glow, density, surfaceId, altColor, resample ? ((point) => () => { const s = resample(); if (!s) return null; return { color: spatial && !prelit ? spatial.color(s.color, point, /score|clock|lamp/.test(surfaceId ?? "") || glow > 0) : s.color, alpha: s.alpha ?? 1 }; })(lightPoint) : null, fan, waveAt && (spatial && !prelit ? ((point) => (frame) => spatial.color(waveAt(frame), point, glow > 0))(lightPoint) : waveAt));
        cells2++;
        if (density > 1) fineCells++;
      }
    }, clip = (ps) => {
      const output = [];
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i], q = ps[(i + 1) % ps.length], dp = depth(p), dq = depth(q);
        if (dp >= 0.121) output.push(p);
        if (dp < 0.121 !== dq < 0.121) output.push(mix(p, q, (0.121 - dp) / (dq - dp)));
      }
      return output;
    }, raster = (a, b, c, color, tile = null, material = null, surfaceId = null, density = 1, sMaterialZ = Infinity, lodProfile = null) => {
      const edge = (p, q, x, y) => (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x), area = edge(a, b, c.x, c.y);
      if (!Number.isFinite(area) || Math.abs(area) < 1e-3) return;
      const crowdFootprint = metricCrowd && tile ? perspectiveUvFootprint(a, b, c, step / density) : null;
      const x0 = Math.max(step, grid.ceil(Math.min(a.x, b.x, c.x) * density) / density), x1 = Math.min(600 - step, grid.floor(Math.max(a.x, b.x, c.x) * density) / density), y0 = Math.max(step, grid.ceil(Math.min(a.y, b.y, c.y) * density) / density), y1 = Math.min(432 - step, grid.floor(Math.max(a.y, b.y, c.y) * density) / density);
      if (density === 1) {
        for (let by = Math.floor(Math.max(0, Math.min(a.y, b.y, c.y)) / binSize); by <= Math.floor(Math.min(432, Math.max(a.y, b.y, c.y)) / binSize); by++) for (let bx = Math.floor(Math.max(0, Math.min(a.x, b.x, c.x)) / binSize); bx <= Math.floor(Math.min(600, Math.max(a.x, b.x, c.x)) / binSize); bx++) {
          const key = bx + "," + by;
          if (!depthBins.has(key)) depthBins.set(key, []);
          depthBins.get(key).push({ a, b, c, area, surfaceId });
        }
      }
      if (x0 > x1 || y0 > y1) return;
      triangles++;
      if (density === 1 && material && !(tile && atlas && material !== "crowd-refine")) return;
      for (let y = y0; y <= y1 + 1e-8; y += step / density) {
        let left = Infinity, right = -Infinity;
        for (const [p, q] of [[a, b], [b, c], [c, a]]) {
          if (y < Math.min(p.y, q.y) - 0.01 || y > Math.max(p.y, q.y) + 0.01) continue;
          if (Math.abs(q.y - p.y) < 0.01) {
            left = Math.min(left, p.x, q.x);
            right = Math.max(right, p.x, q.x);
            continue;
          }
          const t = Math.min(1, Math.max(0, (y - p.y) / (q.y - p.y))), at = p.x + (q.x - p.x) * t;
          left = Math.min(left, at);
          right = Math.max(right, at);
        }
        if (left === Infinity) continue;
        left -= 0.01;
        right += 0.01;
        for (let x = x0; x <= x1 + 1e-8; x += step / density) {
          if (x < left) continue;
          if (x > right) break;
        const u = edge(b, c, x, y) / area, v = edge(c, a, x, y) / area, w = 1 - u - v;
        if (u >= -1e-8 && v >= -1e-8 && w >= -1e-8) {
          const d = 1 / (u / a.depth + v / b.depth + w / c.depth);
          if (density > 1) {
            let hidden = false;
            for (const t of depthBins.get(Math.floor(x / binSize) + "," + Math.floor(y / binSize)) ?? []) {
              if (t.surfaceId === surfaceId) continue;
              const u0 = edge(t.b, t.c, x, y) / t.area, v0 = edge(t.c, t.a, x, y) / t.area, w0 = 1 - u0 - v0;
              if (u0 >= -1e-8 && v0 >= -1e-8 && w0 >= -1e-8 && 1 / (u0 / t.a.depth + v0 / t.b.depth + w0 / t.c.depth) < d - 0.02) {
                hidden = true;
                break;
              }
            }
            if (hidden) {
              fineGeometryOccluded++;
              continue;
            }
          }
          if (tile && atlas) {
            if (density === 1 && material === "crowd-refine") {
              emit(x, y, d, color, 0, 1, "crowd-" + surfaceId, 0);
              continue;
            }
            const tu = d * (u * a.u / a.depth + v * b.u / b.depth + w * c.u / c.depth), tv = d * (u * a.v / a.depth + v * b.v / b.depth + w * c.v / c.depth);
            if (metricCrowd) {
              const selected = tile.sector >= 55 && tile.sector < 60;
              const footprint = crowdFootprint(d, tu, tv), tint = g.architecture.style === "fukuoka_dome" ? palette[tile.id % 2] : tile.seatTint ?? color;
              const s = sampleMetricCrowdTile(atlas, tu, tv, tile.id, !crowd.dualFrame && crowd.awayHit && selected ? 1 : crowd.frame, crowd.frames, appearance.size, footprint, tint, shadeCrowdDiffuse);
              const alternate = crowd.dualFrame && selected ? sampleMetricCrowdTile(atlas, tu, tv, tile.id, 1, crowd.frames, appearance.size, footprint, tint, shadeCrowdDiffuse).color : null;
              const point = lightPoint;
              emit(x, y, d, s.color, s.glow, density, "crowd-" + surfaceId, 1, true, alternate, null, selected ? "visitor" : "home", moving ? null : (frame) => {
                lightPoint = point;
                return sampleMetricCrowdTile(atlas, tu, tv, tile.id, frame, crowd.frames, appearance.size, footprint, tint, shadeCrowdDiffuse).color;
              });
              crowdCells++;
              glowEnergy += s.glow;
              if (s.glow > 0) ledCells++;
            } else {
              const s = sampleCrowdTile(tile.fanZone === "visitor" ? visitorAtlas : atlas, tu, tv, tile.id, crowd.frame, crowd.frames, appearance.size);
              emit(x, y, d, tile.seatTint && s.kind !== "led" ? seatCrowdColor(s.color, tile.seatTint) : s.color, s.glow, density, "crowd-" + surfaceId, 1, false, null, null, tile.fanZone === "visitor" ? "visitor" : "home", moving ? null : (frame) => {
                const w = sampleCrowdTile(tile.fanZone === "visitor" ? visitorAtlas : atlas, tu, tv, tile.id, frame, crowd.frames, appearance.size);
                return tile.seatTint && w.kind !== "led" ? seatCrowdColor(w.color, tile.seatTint) : w.color;
              });
              crowdCells++;
              glowEnergy += s.glow;
              if (s.kind === "led") ledCells++;
            }
          } else if (material) {
            const tu = d * (u * a.u / a.depth + v * b.u / b.depth + w * c.u / c.depth), tv = d * (u * a.v / a.depth + v * b.v / b.depth + w * c.v / c.depth);
            if (density === 1) {
              emit(x, y, d, color, 0, 1, surfaceId, 0);
              continue;
            }
            const baseSample = { color };
            let sample = baseSample;
            if (material === "net-average") sample = { color: "#14261d", alpha: 0.05 };
            else if (material === "crowd-refine") {
            } else if (material === "wolf" && cam.eye.z < sMaterialZ) {
              const overlay = sampleLogoUV((tu - 0.06) / 0.88, (1 - tv - 0.06) / 0.88, lodProfile);
              sample = blendMaterial(sample, overlay && lodProfile ? { ...overlay, a: overlay.a * lodProfile.contrast } : overlay, lodProfile ?? { brightness: 1.7, glow: 0.15 });
              if (sample.logoCoverage) emblemCells++;
            } else if (material.startsWith("dodger:")) {
              if (material.startsWith("dodger:landscape:") || material.startsWith("dodger:facade:") || (material.startsWith("dodger:entry-") || material === "dodger:rear-la" ? cam.eye.z > sMaterialZ : cam.eye.z < sMaterialZ)) sample = sampleDodgerMaterial(material, tu, tv, lodProfile, g) ?? sample;
            } else if (material.startsWith("paypay:")) {
              sample = samplePaypayMaterial(material, tu, tv, lodProfile, g) ?? sample;
            } else if (material.startsWith("niikura:")) {
              sample = sampleNiikuraMaterial(material, tu, tv, lodProfile, g) ?? sample;
            } else if (material.startsWith("koshien:")) {
              sample = sampleKoshienMaterial(material, tu, tv, lodProfile, g) ?? sample;
            } else if (material.startsWith("scoreboard")) {
              if (cam.eye.z < sMaterialZ) sample = sampleScoreboard(g, material, tu, tv, lodProfile) ?? sample;
            } else if (material !== "wolf") {
              const du = Math.abs((tu * 3 + tv * 7) % 1 - 0.5), dv = Math.abs((tu * 3 - tv * 7 + 20) % 1 - 0.5);
              const sector = Number(material.split(":")[1] ?? 0), vBrace = Math.abs((sector + tu) % 8 / 4 - 1);
              if (Math.abs(tv - vBrace) < 0.065) sample = { color: shade2(g.architecture.colors.gold, 1.16) };
              else if (Math.min(du, dv) < 0.045) sample = { color: shade2(g.architecture.colors.gold, 0.78) };
            }
            emit(x, y, d, sample.color, sample.logoGlow ?? 0, density, surfaceId, sample.alpha ?? 1, false, null, sample !== baseSample && BOARD_MATERIAL.test(material) ? () => sampleBoardLive(liveGeometry ?? g, material, tu, tv, lodProfile) : null);
          } else emit(x, y, d, color, 0, 1, surfaceId);
        }
      }
      }
    }, dot = (p, color, id = null) => {
      lightPoint = p;
      const q = project(p);
      if (q && q.x >= step && q.x <= 600 - step && q.y >= step && q.y <= 432 - step) emit(q.x, q.y, q.depth - 0.025, color, 0, 1, id);
    }, line = (p, q, color, density = 1, alpha = 1, surfaceId = null) => {
      lightPoint = mix(p, q, 0.5);
      const dp = depth(p), dq = depth(q);
      if (dp < 0.121 && dq < 0.121) return;
      if (dp < 0.121) p = mix(p, q, (0.121 - dp) / (dq - dp));
      else if (dq < 0.121) q = mix(q, p, (0.121 - dq) / (dp - dq));
      const a = project(p), b = project(q);
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      let lo = 0, hi = 1;
      for (const [v, w] of [[-dx, a.x - step], [dx, 600 - step - a.x], [-dy, a.y - step], [dy, 432 - step - a.y]]) {
        if (Math.abs(v) < 1e-12) {
          if (w < 0) return;
          continue;
        }
        const t = w / v;
        if (v < 0) lo = Math.max(lo, t);
        else hi = Math.min(hi, t);
        if (lo > hi) return;
      }
      const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) * (hi - lo) * density / step));
      for (let i = 0; i <= n; i++) {
        const t = lo + (hi - lo) * i / n, x = a.x + dx * t, y = a.y + dy * t, d = 1 / ((1 - t) / a.depth + t / b.depth) - 0.035;
        if (density > 1) {
          let hidden = false;
          for (const triangle of depthBins.get(Math.floor(x / binSize) + "," + Math.floor(y / binSize)) ?? []) {
            const edge = (p2, q2) => (q2.x - p2.x) * (y - p2.y) - (q2.y - p2.y) * (x - p2.x), u = edge(triangle.b, triangle.c) / triangle.area, v = edge(triangle.c, triangle.a) / triangle.area, w = 1 - u - v;
            if (u >= -1e-8 && v >= -1e-8 && w >= -1e-8 && 1 / (u / triangle.a.depth + v / triangle.b.depth + w / triangle.c.depth) < d - 0.02) {
              hidden = true;
              break;
            }
          }
          if (hidden) continue;
        }
        emit(x, y, d, color, 0, density, surfaceId ?? (density > 1 ? "dodger-detail-line" : null), alpha);
      }
    };
    let surfaceCount = 0;
    for (const original of m.surfaces) {
      if ((++surfaceCount & 63) === 0) yield;
      if ((g.architecture.effects?.environment?.flags || g.architecture.effects?.environment?.wind) && original.material?.startsWith("koshien:flag-")) continue;
      const center = original.points.reduce((a, p) => ({ x: a.x + p.x / original.points.length, y: a.y + p.y / original.points.length, z: a.z + p.z / original.points.length }), { x: 0, y: 0, z: 0 }), s = original;
      lightPoint = center;
      if (omit(s.roof, s.points)) {
        omitted++;
        continue;
      }
      const material = s.material ?? ((s.detailDensity ?? 1) > 1 ? "crowd-refine" : null), metricUV = s.crowdTile && atlas && metricCrowd ? crowdSurfaceUV(s.points) : null, source = s.crowdTile && atlas || material ? s.points.map((p, i) => ({ ...p, u: metricUV?.[i].u ?? p.u ?? [0, 1, 1, 0][i], v: metricUV?.[i].v ?? p.v ?? [0, 0, 1, 1][i] })) : s.points, ps = clip(source).map((p) => {
        const q = project(p);
        return q ? { ...q, u: p.u, v: p.v } : null;
      });
      const profile = material === "wolf" || material?.startsWith("scoreboard") || material?.startsWith("dodger:") || material?.startsWith("koshien:") || material?.startsWith("niikura:") || material?.startsWith("paypay:") || material === "crowd-refine" ? projectedMaterialDetail(ps, material.startsWith("dodger:landscape:") ? 2 : material === "crowd-refine" ? s.detailDensity : g.architecture.details?.factor ?? 6, step) : null;
      if (profile && s.points.some((p) => p.u !== void 0)) {
        profile.footprintU *= Math.max(...s.points.map((p) => p.u)) - Math.min(...s.points.map((p) => p.u));
        profile.footprintV *= Math.max(...s.points.map((p) => p.v)) - Math.min(...s.points.map((p) => p.v));
      }
      if (profile && /^paypay-(roof-|seats-|steps-|tier-underside-|cross-concourse-)/.test(s.id ?? "")) profile.density = 3;
      if (profile && s.material === "wolf") logoProfiles.push({ id: s.id, ...profile });
      for (let i = 1; i < ps.length - 1; i++) if (ps[0] && ps[i] && ps[i + 1]) {
        raster(ps[0], ps[i], ps[i + 1], s.color, s.crowdTile, material, s.id, 1, s.points[0].z);
        if (material) fineJobs.push([ps[0], ps[i], ps[i + 1], s.color, s.crowdTile, material, s.id, moving ? MOVING_DENSITY : profile ? profile.density : 2, s.points[0].z, profile, center]);
      }
    }
    for (let i = 0; i < fineJobs.length; i++) {
      const job = fineJobs[i];
      lightPoint = job.pop();
      raster(...job);
      if ((i & 31) === 31) yield;
    }
    for (const s of m.segments) {
      if (omit(s.roof, [s.p, s.q])) continue;
      line(s.p, s.q, s.color, moving ? Math.min(s.detailDensity ?? 1, MOVING_DENSITY) : s.detailDensity ?? 1, s.alpha ?? 1, s.id ?? null);
    }
    if (lightOverride && g.architecture.style === "russian_dome") for (let i = 0; i < 8; i++) {
      const t = (i + 0.5) * Math.PI / 4;
      dot({ x: m.envelope.rx * 0.78 * Math.sin(t), y: m.envelope.eaveY - 2, z: m.envelope.centerZ + m.envelope.rz * 0.78 * Math.cos(t) }, lighting.color, "effects-flood-lamp");
    }
    const netReport = m.net ? { heightMeters: m.net.heightMeters, meshSpacingMeters: m.net.meshSpacingMeters, opaquePanels: 0, meshPanels: 0, averagePanels: 0, meshLines: 0 } : null;
    if (m.net) for (const panel of m.net.panels) {
      const { p, q, topP, topQ, topY } = panel, len = Math.hypot(q.x - p.x, q.z - p.z), v = (8 - p.y) / (topY - p.y), mid = mix(mix(p, q, 0.5), mix(topP, topQ, 0.5), v), a = project(mid), b = project(mix(mix(p, q, 0.5 + m.net.meshSpacingMeters / len), mix(topP, topQ, 0.5 + m.net.meshSpacingMeters / len), v)), pitch = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
      if (!a || a.depth < 0.12) continue;
      const corners = clip([p, q, topQ, topP].map((p2, i) => ({ ...p2, u: [0, 1, 1, 0][i], v: [0, 0, 1, 1][i] }))).map(project).filter(Boolean);
      if (corners.every((c) => c.x < 0) || corners.every((c) => c.x > 600) || corners.every((c) => c.y < 0) || corners.every((c) => c.y > 432)) continue;
      if (pitch < 1.2) {
        netReport.averagePanels++;
        for (let i = 1; i < corners.length - 1; i++) raster(corners[0], corners[i], corners[i + 1], "#14261d", null, "net-average", "koshien-net-average", 2);
        continue;
      }
      netReport.meshPanels++;
      const alpha = m.net.wireAlpha * Math.min(1, (pitch - 1.2) / 2), draw = (p2, q2) => {
        line(p2, q2, "#4d5b50", 4, alpha, "koshien-net-mesh");
        netReport.meshLines++;
      };
      for (let x = m.net.meshSpacingMeters; x < len; x += m.net.meshSpacingMeters) draw(mix(p, q, x / len), mix(topP, topQ, x / len));
      for (let y = p.y + m.net.meshSpacingMeters; y < topY; y += m.net.meshSpacingMeters) {
        const v2 = (y - p.y) / (topY - p.y);
        draw(mix(p, topP, v2), mix(q, topQ, v2));
      }
    }
    if (onEffectOcclusion) onEffectOcclusion((x, y, d) => {
      for (const t of depthBins.get(Math.floor(x / binSize) + "," + Math.floor(y / binSize)) ?? []) {
        const edge = (p, q) => (q.x - p.x) * (y - p.y) - (q.y - p.y) * (x - p.x), u = edge(t.b, t.c) / t.area, v = edge(t.c, t.a) / t.area, w = 1 - u - v;
        if (u >= -1e-8 && v >= -1e-8 && w >= -1e-8 && 1 / (u / t.a.depth + v / t.b.depth + w / t.c.depth) < d - 0.04) return true;
      }
      return false;
    });
    return {
      scoreboard: m.scoreboard,
      seating: m.seating ?? null,
      arch: m.arch ?? null,
      enclosure: m.enclosure ?? null,
      net: netReport,
      lighting: lighting ?? null,
      illumination: spatial ? { model: spatial.model, shadows: spatial.shadows, fixtures: spatial.fixtures, enabled: spatial.on, day: spatial.day } : null,
      landscape: m.landscape ?? null,
      lightTowers: m.lightTowers ?? 0,
      capacity: m.capacity,
      tiers: m.tiers,
      rowsPerTier: m.rowsPerTier,
      spectatorLights: m.spectatorLights,
      crowd: { ...crowd, mode: "tiled_clusters", attendance: atlas ? "full" : "empty", textureMapping: metricCrowd ? "metric_perspective_mipmap" : "normalized_perspective", worldTileMeters: metricCrowd ? CROWD_METRIC : null, groups: atlas ? m.spectatorTiles : 0, coverage: atlas ? 1 : 0, individualWorldObjects: 0, tile: CROWD_TILE, candidateCrowdCells: crowdCells, candidateLedCells: ledCells, candidateGlowEnergy: glowEnergy, appearance, penLengthMeters: PENLIGHT_LENGTH_METERS, palette, ...palettes.visitor ? { visitorPalette: palettes.visitor, visitorGroups: atlas ? m.surfaces.filter((s) => s.crowdTile?.fanZone === "visitor").length : 0 } : {} },
      envelope: m.envelope,
      detail: { logoProfiles, fineCells, emblemCells, fineGeometryOccluded, depthMethod: "projected_triangle_bins_then_shared_world_depth", raster: "shared_circle_dots", material: "approved_wolf_png_and_facade_ornament", factor: g.architecture.details?.factor ?? 6 },
      roof: { ...m.roof, cutaway },
      surfaces: m.surfaces.length,
      triangles,
      candidateCells: cells2,
      omittedRoofSurfaces: omitted,
      renderer: "original_projection_grid_depth_and_dot",
      simulationIntegration: "DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED"
    };
  }

  // work/playable-art-stadium-latency-20261101/stadium/v3/entry.mjs
  var design = fukuokaDomeDesign();
  var validation = validateDesign(design);
  if (!validation.ok) throw Error("Invalid stadium geometry");
  var geometry;
  var mesh;
  var originalSurfaces;
  var originalSegments;
  var parkKey = "";
  var cacheKey = "";
  var cells = [];
  function adapt(park) {
    const center = park.center, r = park.radiusMeters, height = park.heightMeters;
    const point = (angleDegrees, id) => {
      const t = angleDegrees * Math.PI / 180, s = Math.sin(t), c = Math.cos(t), along = center.x * s + center.z * c;
      const distanceMeters = along + Math.sqrt(along * along + r * r - center.x * center.x - center.z * center.z);
      return { id, angleDegrees, distanceMeters, heightMeters: height, x: s * distanceMeters, z: c * distanceMeters };
    };
    if (park.shapeV1) {
      // The delivered wall itself: the mesh, its clip and the fielders all use one outline.
      const named = /* @__PURE__ */ new Map([[-180, "BACK"], [-90, "THIRD_SIDE"], [-45, "LF"], [-22.5, "LCF"], [0, "CF"], [22.5, "RCF"], [45, "RF"], [90, "FIRST_SIDE"], [180, "BACK"]]);
      const vertices = park.shapeV1.vertices.map((p) => ({ ...p, id: named.get(p.angleDegrees) ?? "SHAPE_" + p.angleDegrees }));
      geometry = { ...validation.geometry, kind: "editable", vertices, fencePoints: vertices.filter((p) => Math.abs(p.angleDegrees) <= 45), boundaryKey: shapeKey(park) };
      mesh = stadiumMesh(geometry);
      originalSurfaces = mesh.surfaces.slice();
      originalSegments = mesh.segments.slice();
      return;
    }
    const ids = /* @__PURE__ */ new Map([[-180, "BACK"], [-90, "THIRD_SIDE"], [-45, "LF"], [-22.5, "LCF"], [0, "CF"], [22.5, "RCF"], [45, "RF"], [90, "FIRST_SIDE"], [180, "BACK"]]);
    const angles = [.../* @__PURE__ */ new Set([...Array.from({ length: 361 }, (_, i) => i - 180), ...ids.keys()])].sort((a, b) => a - b);
    const vertices = angles.map((a) => point(a, ids.get(a) ?? "CIRCLE_" + a));
    const fencePoints = [-45, -22.5, 0, 22.5, 45].map((a) => point(a, ids.get(a)));
    geometry = { ...validation.geometry, kind: "editable", vertices, fencePoints, boundaryKey: JSON.stringify([center.x, center.z, r, height]) };
    mesh = stadiumMesh(geometry);
    originalSurfaces = mesh.surfaces.slice();
    originalSegments = mesh.segments.slice();
  }
  var shapeKeys = /* @__PURE__ */ new WeakMap();
  function shapeKey(park) {
    const s = park.shapeV1;
    if (!s) return "";
    let k = shapeKeys.get(s);
    if (!k) shapeKeys.set(s, k = JSON.stringify(s.vertices.map((p) => [p.angleDegrees, p.distanceMeters, p.heightMeters])));
    return k;
  }
  function insideWall(park, p, margin) {
    if (!park.shapeV1) return Math.hypot(p.x - park.center.x, p.z - park.center.z) < park.radiusMeters + margin;
    const v = park.shapeV1.vertices, a = Math.atan2(p.x, p.z) * 180 / Math.PI;
    let lo = 0, hi = v.length - 2;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (v[mid].angleDegrees <= a) lo = mid;
      else hi = mid - 1;
    }
    const q = v[lo], r = v[lo + 1], ex = r.x - q.x, ez = r.z - q.z, s = Math.sin(a * Math.PI / 180), c = Math.cos(a * Math.PI / 180);
    return Math.hypot(p.x, p.z) < (q.x * ez - q.z * ex) / (s * ez - c * ex) + margin;
  }
  function worldXZ(x, y, d, cam) {
    const right = (x - cam.cx) * d / cam.f, up = (cam.cy - y) * d / cam.f;
    const forward = Math.cos(cam.pitch) * d + Math.sin(cam.pitch) * up;
    return {
      x: cam.eye.x + Math.cos(cam.yaw) * right + Math.sin(cam.yaw) * forward,
      z: cam.eye.z - Math.sin(cam.yaw) * right + Math.cos(cam.yaw) * forward
    };
  }
  function renderRun(park, cam, project, grid, moving) {
    mesh.surfaces = originalSurfaces.filter((s) => !/^paypay-(fence-|score-vision-|batters-eye-)/.test(s.id));
    mesh.segments = originalSegments.filter((s) => !s.id?.startsWith("paypay-fence-cap"));
    const map = /* @__PURE__ */ new Map(), step = grid.step();
    return { map, steps: renderStadiumSteps({ geometry, project, grid, cam, cutaway: true, moving, crowd: { frame: 0, frames: 3, visible: true, dualFrame: true }, paint: (x, y, d, color, alpha, owner, glow, density, surfaceId, altColor, live, fan, wave) => {
      if (alpha <= 0) return;
      const sx = Math.round(x / step) * step, sy = Math.round(y / step) * step, k2 = sx + "," + sy, old = map.get(k2);
      if (old && d >= old.d) return;
      if (insideWall(park, worldXZ(x, y, d, cam), 0)) return;
      map.set(k2, { x: sx, y: sy, d, color, alpha, altColor, live: live ?? null, fan, wave });
    } }) };
  }
  function commitRun(run, report, key) {
    cells = [...run.map.values()];
    cacheKey = key;
    globalThis.PlayableStadiumV1.report = { surfaces: mesh.surfaces.length, totalSurfaces: originalSurfaces.length, segments: mesh.segments.length, totalSegments: originalSegments.length, cells: cells.length, render: report, key };
  }
  // The camera rested: finish the full picture a few milliseconds at a time, then tell the renderer.
  var resting = null;
  function cancelRest() {
    if (resting) clearTimeout(resting.timer);
    resting = null;
  }
  function rest(key, park, cam, grid) {
    const eye = { ...cam.eye }, sinYaw = Math.sin(cam.yaw), cosYaw = Math.cos(cam.yaw), sinPitch = Math.sin(cam.pitch), cosPitch = Math.cos(cam.pitch), f = cam.f, cx = cam.cx, cy = cam.cy;
    const project = (p) => {
      const dx = p.x - eye.x, dy = (p.y || 0) - eye.y, dz = p.z - eye.z, side = cosYaw * dx - sinYaw * dz, ahead = sinYaw * dx + cosYaw * dz, up = cosPitch * dy + sinPitch * ahead, depth = -sinPitch * dy + cosPitch * ahead;
      return depth < 0.12 ? null : { x: cx + f * side / depth, y: cy - f * up / depth, scale: f / depth, depth };
    };
    const job = resting = { key, run: null, timer: 0, advance(budget) {
      if (resting !== job || cacheKey !== key) return;
      job.run ??= renderRun(park, { ...cam, eye }, project, grid, false);
      const until = performance.now() + budget;
      for (let next = job.run.steps.next(); ; next = job.run.steps.next()) {
        if (next.done) {
          commitRun(job.run, next.value, key);
          resting = null;
          globalThis.dispatchEvent?.(new Event("kneekura:stadium-settled"));
          return;
        }
        if (performance.now() >= until) break;
      }
      job.timer = setTimeout(() => job.advance(REST_SLICE_MS), REST_GAP_MS);
    } };
    job.timer = setTimeout(() => job.advance(REST_SLICE_MS), REST_DELAY_MS);
  }
  globalThis.PlayableStadiumV1 = { cells({ park, cam, project, grid }) {
    if (!park?.center || !Number.isFinite(park.radiusMeters)) return null;
    const nextParkKey = JSON.stringify([park.center.x, park.center.z, park.radiusMeters, park.heightMeters, shapeKey(park)]);
    if (parkKey !== nextParkKey) {
      adapt(park);
      parkKey = nextParkKey;
      cacheKey = "";
    }
    const key = JSON.stringify([nextParkKey, cam.eye.x, cam.eye.y, cam.eye.z, cam.yaw, cam.pitch, cam.f, cam.cx, cam.cy, grid.step()]);
    if (key !== cacheKey) {
      cancelRest();
      const run = renderRun(park, cam, project, grid, true);
      let next = run.steps.next();
      while (!next.done) next = run.steps.next();
      commitRun(run, next.value, key);
      rest(key, park, cam, grid);
    }
    return cells;
  }, settle() { resting?.advance(Infinity); }, render(input) {
    const list = this.cells(input);
    if (!list) return;
    const { paint, awayHit = false } = input;
    for (const c of list) paint(c.x, c.y, c.d, awayHit && c.altColor !== null ? c.altColor : c.color, c.alpha, "ballpark");
  }
  , setScoreboard(board) { liveBoard = board; }
  , scoreboardCells(input) {
    const list = this.cells(input);
    if (!list || !liveBoard || !liveGeometryFor(geometry)) return [];
    const out = [];
    for (const c of list) {
      if (!c.live) continue;
      const s = c.live();
      if (s) out.push({ x: c.x, y: c.y, color: s.color, alpha: s.alpha });
    }
    return out;
  }
  };
})();

