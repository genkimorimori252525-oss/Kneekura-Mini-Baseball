import type { Vec3 } from '../../model/geometry';

/** Authored stadium perimeter, in the ballpark studio's polar terms: angle 0 is
 * dead centre, positive towards first base, distance from the plate. The
 * outfield `points` and the foul side form one closed wall of real, per-point
 * height. `foul.nodes` are the studio's rounded foul-side vertices; without them
 * the foul side is the studio's plain backstop/side/side outline. */
export type LiveFenceNodeV1 = Readonly<{ angleDegrees: number; distanceMeters: number; heightMeters: number }>;
export type LiveFenceShapeInputV1 = Readonly<{ points: readonly LiveFenceNodeV1[];
  foul: Readonly<{ firstSideMeters: number; thirdSideMeters: number; backstopMeters: number; heightMeters: number; nodes?: readonly LiveFenceNodeV1[] }> }>;
export type LiveFenceVertexV1 = LiveFenceNodeV1 & Readonly<{ x: number; z: number }>;
/** The nearest wall feature of a point. `normal` points from the wall to the point. */
export type LiveFenceContactV1 = Readonly<{ edge: number; u: number; endpoint: boolean; distanceMeters: number; heightMeters: number;
  point: Readonly<{ x: number; z: number }>; normal: Readonly<{ x: number; z: number }>; tangent: Readonly<{ x: number; z: number }> }>;
export type LiveFenceShapeV1 = Readonly<{ vertices: readonly LiveFenceVertexV1[]; maximumDistanceMeters: number; maximumHeightMeters: number;
  /** Signed horizontal distance to the wall, positive inside. It is 1-Lipschitz, so a speed bound bounds it. */
  gapAt: (p: Readonly<{ x: number; z: number }>) => number;
  /** Same, ignoring some edges. Exact below 2.8 metres, a lower bound beyond it. */
  gapExcluding: (p: Readonly<{ x: number; z: number }>, skip: ReadonlySet<number>) => number;
  edgeDistance: (edge: number, p: Readonly<{ x: number; z: number }>) => number;
  /** Metres left along an edge before the point's projection runs off either end of it. */
  edgeRunGap: (edge: number, p: Readonly<{ x: number; z: number }>) => number;
  touching: (p: Readonly<{ x: number; z: number }>, withinMeters: number) => readonly LiveFenceContactV1[];
  /** The wall feature a ball moving with `velocity` strikes at `p`: of the features at the nearest distance, the one met head-on. */
  contactAt: (p: Readonly<{ x: number; z: number }>, velocity: Readonly<{ x: number; z: number }>) => LiveFenceContactV1;
  /** Radial wall lookup from the plate, the Core form of the studio's `wallAt`. */
  wallAt: (radians: number) => Readonly<{ distanceMeters: number; heightMeters: number; edge: number }>;
  clampInside: (p: Vec3, padMeters: number) => Vec3 }>;

const rad = (d: number) => d * Math.PI / 180;
const polar = (a: number, d: number) => ({ x: a === 0 || Math.abs(a) === 180 ? 0 : Math.sin(rad(a)) * d, z: Math.abs(a) === 90 ? 0 : Math.cos(rad(a)) * d });
const CELL = 4, CELL_REACH = CELL * Math.SQRT1_2, ALL_MARGIN = 40;

/** The closed outline, plate-relative, in the studio's order: BACK at -180 through the outfield to BACK at +180. */
export function liveFenceVerticesV1(shape: LiveFenceShapeInputV1): readonly LiveFenceVertexV1[] {
  const f = shape?.foul, side = (angleDegrees: number, distanceMeters: number) => ({ angleDegrees, distanceMeters, heightMeters: f.heightMeters }),
    nodes = f?.nodes ?? (f ? [side(-180, f.backstopMeters), side(-90, f.thirdSideMeters), side(90, f.firstSideMeters), side(180, f.backstopMeters)] : []),
    all = [...nodes, ...(shape?.points ?? [])].sort((a, b) => a.angleDegrees - b.angleDegrees);
  if (all.length < 5 || all[0].angleDegrees !== -180 || all[all.length - 1].angleDegrees !== 180
    || all.some((n, i) => ![n.angleDegrees, n.distanceMeters, n.heightMeters].every(Number.isFinite) || n.distanceMeters <= 0 || n.heightMeters < 0
      || i > 0 && !(n.angleDegrees > all[i - 1].angleDegrees))
    || all[0].distanceMeters !== all[all.length - 1].distanceMeters) throw Error('live fence shape requires a closed star outline');
  return all.map(n => ({ angleDegrees: n.angleDegrees, distanceMeters: n.distanceMeters, heightMeters: n.heightMeters, ...polar(n.angleDegrees, n.distanceMeters) }));
}

function buildLiveFenceShapeV1(shape: LiveFenceShapeInputV1, home: Readonly<{ x: number; z: number }>): LiveFenceShapeV1 {
  const local = liveFenceVerticesV1(shape), n = local.length - 1,
    vertices = Object.freeze(local.map(p => Object.freeze({ ...p, x: p.x + home.x, z: p.z + home.z }))),
    ax = new Float64Array(n), az = new Float64Array(n), dx = new Float64Array(n), dz = new Float64Array(n), len2 = new Float64Array(n), homeSide = new Float64Array(n);
  for (let e = 0; e < n; e++) {
    const a = vertices[e], b = vertices[e + 1]; ax[e] = a.x; az[e] = a.z; dx[e] = b.x - a.x; dz[e] = b.z - a.z; len2[e] = dx[e] * dx[e] + dz[e] * dz[e];
    if (!(len2[e] > 0)) throw Error('live fence shape has a zero-length edge');
    homeSide[e] = Math.sign(dx[e] * (home.z - a.z) - dz[e] * (home.x - a.x));
  }
  const along = (e: number, x: number, z: number) => Math.max(0, Math.min(1, ((x - ax[e]) * dx[e] + (z - az[e]) * dz[e]) / len2[e]));
  const distance = (e: number, x: number, z: number) => { const u = along(e, x, z); return Math.hypot(x - ax[e] - u * dx[e], z - az[e] - u * dz[e]); };
  // Lazily built, exact: from any point of a cell the nearest edge is within
  // (distance from the cell's centre) + 2*(centre-to-corner). Lookups stay
  // independent of the order of queries, so results never depend on this cache.
  const minX = Math.min(...vertices.map(p => p.x)) - ALL_MARGIN, minZ = Math.min(...vertices.map(p => p.z)) - ALL_MARGIN,
    nx = Math.ceil((Math.max(...vertices.map(p => p.x)) + ALL_MARGIN - minX) / CELL), nz = Math.ceil((Math.max(...vertices.map(p => p.z)) + ALL_MARGIN - minZ) / CELL),
    cells: (Uint16Array | undefined)[] = new Array(nx * nz), all = Uint16Array.from({ length: n }, (_, i) => i);
  const candidates = (x: number, z: number) => {
    const ix = Math.floor((x - minX) / CELL), iz = Math.floor((z - minZ) / CELL);
    if (!(ix >= 0 && ix < nx && iz >= 0 && iz < nz)) return all;
    const k = ix + iz * nx, cached = cells[k]; if (cached) return cached;
    const cx = minX + (ix + .5) * CELL, cz = minZ + (iz + .5) * CELL; let best = Infinity;
    for (let e = 0; e < n; e++) best = Math.min(best, distance(e, cx, cz));
    const near: number[] = []; for (let e = 0; e < n; e++) if (distance(e, cx, cz) <= best + 2 * CELL_REACH) near.push(e);
    return cells[k] = Uint16Array.from(near);
  };
  // The outline is sorted by angle about the plate, so one sector decides sides.
  const inside = (x: number, z: number) => {
    const angle = Math.atan2(x - home.x, z - home.z) * 180 / Math.PI; let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (vertices[mid].angleDegrees <= angle) lo = mid; else hi = mid - 1; }
    const side = dx[lo] * (z - az[lo]) - dz[lo] * (x - ax[lo]); return side === 0 || Math.sign(side) === homeSide[lo];
  };
  const nearest = (x: number, z: number) => { const list = candidates(x, z); let best = Infinity; for (let i = 0; i < list.length; i++) { const d = distance(list[i], x, z); if (d < best) best = d; } return best; };
  const gapAt: LiveFenceShapeV1['gapAt'] = p => { const d = nearest(p.x, p.z); return inside(p.x, p.z) ? d : -d; };
  const gapExcluding: LiveFenceShapeV1['gapExcluding'] = (p, skip) => {
    const list = candidates(p.x, p.z); let best = list.length === n ? Infinity : CELL_REACH;
    for (let i = 0; i < list.length; i++) if (!skip.has(list[i])) best = Math.min(best, distance(list[i], p.x, p.z));
    return inside(p.x, p.z) ? best : -best;
  };
  const feature = (e: number, x: number, z: number): LiveFenceContactV1 => {
    const u = along(e, x, z), qx = ax[e] + u * dx[e], qz = az[e] + u * dz[e], d = Math.hypot(x - qx, z - qz), len = Math.sqrt(len2[e]), tx = dx[e] / len, tz = dz[e] / len,
      side = homeSide[e] || 1, normal = d > 0 ? { x: (x - qx) / d, z: (z - qz) / d } : { x: -tz * side, z: tx * side };
    return { edge: e, u, endpoint: u === 0 || u === 1, distanceMeters: d, heightMeters: vertices[e].heightMeters + (vertices[e + 1].heightMeters - vertices[e].heightMeters) * u,
      point: { x: qx, z: qz }, normal, tangent: { x: tx, z: tz } };
  };
  const touching: LiveFenceShapeV1['touching'] = (p, within) => {
    const list = candidates(p.x, p.z), out: LiveFenceContactV1[] = [];
    for (let i = 0; i < list.length; i++) if (distance(list[i], p.x, p.z) <= within) out.push(feature(list[i], p.x, p.z));
    return out;
  };
  const contactAt: LiveFenceShapeV1['contactAt'] = (p, velocity) => {
    const near = touching(p, nearest(p.x, p.z) + 1e-6); let best = near[0], rate = Infinity;
    for (const c of near) { const r = c.normal.x * velocity.x + c.normal.z * velocity.z; if (r < rate) { rate = r; best = c; } }
    return best;
  };
  const wallAt: LiveFenceShapeV1['wallAt'] = radians => {
    const wrapped = ((radians * 180 / Math.PI + 180) % 360 + 360) % 360 - 180; let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (vertices[mid].angleDegrees <= wrapped) lo = mid; else hi = mid - 1; }
    const sx = Math.sin(rad(wrapped)), sz = Math.cos(rad(wrapped)), ox = ax[lo] - home.x, oz = az[lo] - home.z,
      den = sx * dz[lo] - sz * dx[lo], d = (ox * dz[lo] - oz * dx[lo]) / den,
      u = Math.max(0, Math.min(1, ((sx * d - ox) * dx[lo] + (sz * d - oz) * dz[lo]) / len2[lo]));
    return { distanceMeters: d, heightMeters: vertices[lo].heightMeters + (vertices[lo + 1].heightMeters - vertices[lo].heightMeters) * u, edge: lo };
  };
  const clampInside: LiveFenceShapeV1['clampInside'] = (p, pad) => {
    if (gapAt(p) >= pad) return p;
    let x = p.x, z = p.z;
    for (let i = 0; i < 8; i++) {
      const signed = gapAt({ x, z }); if (signed >= pad) return { x, y: p.y, z };
      const list = touching({ x, z }, Math.abs(signed) + 1e-9), c = list[0]; if (!c) break;
      const toward = signed >= 0 ? 1 : -1, move = pad - signed + 1e-9;
      x += c.normal.x * toward * move; z += c.normal.z * toward * move;
    }
    // A reflex notch can make projection oscillate: the outline is a star about the plate.
    let lo = 0, hi = 1; const at = (u: number) => ({ x: home.x + (p.x - home.x) * u, z: home.z + (p.z - home.z) * u });
    for (let i = 0; i < 48; i++) { const mid = (lo + hi) / 2; if (gapAt(at(mid)) >= pad) lo = mid; else hi = mid; }
    return { ...at(lo), y: p.y };
  };
  const edgeRunGap: LiveFenceShapeV1['edgeRunGap'] = (e, p) => {
    const s = ((p.x - ax[e]) * dx[e] + (p.z - az[e]) * dz[e]) / Math.sqrt(len2[e]); return Math.min(s, Math.sqrt(len2[e]) - s);
  };
  return Object.freeze({ vertices, maximumDistanceMeters: Math.max(...local.map(p => p.distanceMeters)), maximumHeightMeters: Math.max(...local.map(p => p.heightMeters)),
    gapAt, gapExcluding, edgeDistance: (e, p) => distance(e, p.x, p.z), edgeRunGap, touching, contactAt, wallAt, clampInside });
}

// A play clones its input, so identity cannot key this. The compiled shape holds
// closures: it stays out of play results, which cross a worker boundary.
const memo = new Map<string, LiveFenceShapeV1>();
export function compileLiveFenceShapeV1(shape: LiveFenceShapeInputV1, home: Readonly<{ x: number; z: number }>): LiveFenceShapeV1 {
  const key = JSON.stringify([home.x, home.z, shape]), cached = memo.get(key); if (cached) return cached;
  const built = buildLiveFenceShapeV1(shape, home);
  if (memo.size === 16) memo.delete(memo.keys().next().value!);
  memo.set(key, built); return built;
}
