type PlayerRecord=any;
import { vec3 } from '../math/vec3';
import { PitchPath } from './PitchFlightSolver';
import { PitchTypeDef } from './pitchTypes';
import { FIELD } from '../geometry/FieldConstants';

export type RobinPitchId =
  | 'robin_2'
  | 'robin_3'
  | 'robin_3_slow'
  | 'robin_3_horizontal'
  | 'robin_3_horizontal_slow'
  | 'robin_4'
  | 'robin_5'
  | 'robin_5_slow'
  | 'robin_5_original'
  | 'robin_6'
  | 'robin_6_original';

export interface RobinPitchSpec {
  id: RobinPitchId;
  name: string;
  trajectory: 'straight' | 'wave_vertical' | 'wave_horizontal' | 'accelerating' | 'zigzag' | 'invisible';
  /** 固定球速。速度範囲を使う球では省略する。 */
  speedKmh?: number;
  /** 原作の base 速度乱数。 */
  baseSpeedRangeKmh?: readonly [number, number];
  /** 原作のロビン共通速度補正。 */
  speedBoostRangeKmh?: readonly [number, number];
  acceleratesToKmh?: number;
  accelerationStartsAtProgress?: number;
  movementAmplitudeM?: number;
  movementCycles?: number;
  hideDistanceFromBatterM?: number;
}

export interface RobinPitchSample {
  id: RobinPitchId;
  initialSpeedKmh: number;
  acceleratedSpeedKmh: number;
  angleDeg: number;
  zigzagPhase: number;
}

interface RandomSource {
  nextFloat(): number;
}

/** ゲームへそのまま渡す、JSON互換の数値プリセット。 */
export const ROBIN_PITCH_SPECS: readonly RobinPitchSpec[] = [
  { id: 'robin_2', name: 'ロビン Type 2・直球', trajectory: 'straight', speedKmh: 210 },
  { id: 'robin_3', name: 'ロビン Type 3・上下変化', trajectory: 'wave_vertical', speedKmh: 165, movementAmplitudeM: 0.236, movementCycles: 2.5 },
  { id: 'robin_3_slow', name: 'ロビン Type 3・上下変化 100', trajectory: 'wave_vertical', speedKmh: 100, movementAmplitudeM: 0.236, movementCycles: 2.5 },
  { id: 'robin_3_horizontal', name: 'ロビン Original・横変化', trajectory: 'wave_horizontal', speedKmh: 165, movementAmplitudeM: 0.236, movementCycles: 2.5 },
  { id: 'robin_3_horizontal_slow', name: 'ロビン Original・横変化 100', trajectory: 'wave_horizontal', speedKmh: 100, movementAmplitudeM: 0.236, movementCycles: 2.5 },
  { id: 'robin_4', name: 'ロビン Type 4・加速球', trajectory: 'accelerating', baseSpeedRangeKmh: [20, 40], speedBoostRangeKmh: [10, 50], acceleratesToKmh: 200, accelerationStartsAtProgress: 0.36 },
  { id: 'robin_5', name: 'ロビン Type 5・大ジグザグ', trajectory: 'zigzag', baseSpeedRangeKmh: [70, 90], speedBoostRangeKmh: [10, 50], movementAmplitudeM: 0.2, movementCycles: 3 },
  { id: 'robin_5_slow', name: 'ロビン Type 5・大ジグザグ 100', trajectory: 'zigzag', speedKmh: 100, movementAmplitudeM: 0.2, movementCycles: 3 },
  { id: 'robin_5_original', name: 'ロビン Type 5・ジグザグ 原作', trajectory: 'zigzag', baseSpeedRangeKmh: [70, 90], speedBoostRangeKmh: [10, 50], movementAmplitudeM: 0.105, movementCycles: 5 },
  { id: 'robin_6', name: 'ロビン Type 6・消える球 4.3m', trajectory: 'invisible', speedKmh: 170, hideDistanceFromBatterM: 4.3 },
  { id: 'robin_6_original', name: 'ロビン Type 6・消える球 原作', trajectory: 'invisible', speedKmh: 170, hideDistanceFromBatterM: 9.02 },
] as const;

const ROBIN_SPEC_BY_ID = new Map<RobinPitchId, RobinPitchSpec>(
  ROBIN_PITCH_SPECS.map((spec) => [spec.id, spec])
);
const ROBIN_IDS = new Set<RobinPitchId>(ROBIN_PITCH_SPECS.map((spec) => spec.id));

/** 既存の投球選択器へ渡す形式も、上の数値プリセットから導出する。 */
export const ROBIN_PITCH_TYPES: readonly PitchTypeDef[] = ROBIN_PITCH_SPECS.map((spec) => ({
  id: spec.id,
  name: spec.name,
  speedKmh: spec.speedKmh ?? 60,
  tiltDeg: 0,
  gyroDeg: 90,
  breakLevel: 1,
  wobble: 0,
  sswDeviationDeg: 0,
}));

export function isRobinPitchId(id: string): id is RobinPitchId {
  return ROBIN_IDS.has(id as RobinPitchId);
}

/** 固定値はそのまま、原作値を残す球だけ base + boost の乱数を使う。 */
export function sampleRobinPitch(id: RobinPitchId, rng: RandomSource): RobinPitchSample {
  const spec = ROBIN_SPEC_BY_ID.get(id);
  if (!spec) throw new Error(`unknown Robin pitch: ${id}`);
  const baseQ = rng.nextFloat();
  const boostQ = rng.nextFloat();
  const base = spec.baseSpeedRangeKmh
    ? lerp(spec.baseSpeedRangeKmh[0], spec.baseSpeedRangeKmh[1], baseQ)
    : spec.speedKmh ?? 0;
  const robinBoost = spec.speedBoostRangeKmh
    ? lerp(spec.speedBoostRangeKmh[0], spec.speedBoostRangeKmh[1], boostQ)
    : 0;
  return {
    id,
    initialSpeedKmh: base + robinBoost,
    acceleratedSpeedKmh: spec.acceleratesToKmh ?? base + robinBoost,
    angleDeg: 179 + 2 * rng.nextFloat(),
    zigzagPhase: 8 * rng.nextFloat(),
  };
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const triangle = (cycles: number, phase: number): number =>
  (2 / Math.PI) * Math.asin(Math.sin(Math.PI * 2 * cycles + phase));

function crossingTimeAtZ(points: PitchPath['points'], dt: number, targetZ: number): number | undefined {
  for (let i = 1; i < points.length; i++) {
    const before = points[i - 1];
    const after = points[i];
    if (before.z >= targetZ && after.z <= targetZ) {
      const f = (before.z - targetZ) / (before.z - after.z);
      return (i - 1 + f) * dt;
    }
  }
  return undefined;
}

function applyAcceleratingPitchPath(
  path: PitchPath,
  sample: RobinPitchSample,
  spec: RobinPitchSpec
): PitchPath {
  const start = path.points[0];
  const plate = path.plate;
  const plateDistanceM = Math.max(start.z, 0.001);
  const catchDistanceM = Math.max(plateDistanceM, start.z - FIELD.CATCH_Z);
  const changeDistanceM = plateDistanceM * (spec.accelerationStartsAtProgress ?? 0.36);
  const slowMps = Math.max(sample.initialSpeedKmh / 3.6, 0.001);
  const fastMps = Math.max(sample.acceleratedSpeedKmh / 3.6, 0.001);
  const changeTimeSec = changeDistanceM / slowMps;
  const plateTimeSec = changeTimeSec + (plateDistanceM - changeDistanceM) / fastMps;
  const catchTimeSec = changeTimeSec + (catchDistanceM - changeDistanceM) / fastMps;
  const pointCount = Math.ceil(catchTimeSec / path.dt) + 1;

  const points = Array.from({ length: pointCount }, (_, i) => {
    const timeSec = i * path.dt;
    const distanceM = Math.min(
      catchDistanceM,
      timeSec <= changeTimeSec
        ? slowMps * timeSec
        : changeDistanceM + fastMps * (timeSec - changeTimeSec)
    );
    const u = clamp01(distanceM / plateDistanceM);
    return vec3(
      lerp(start.x, plate.x, u),
      lerp(start.y, plate.y, u),
      start.z - distanceM
    );
  });

  return {
    ...path,
    points,
    plate: {
      ...plate,
      t: plateTimeSec,
      vx: ((plate.x - start.x) / plateDistanceM) * fastMps,
      vy: ((plate.y - start.y) / plateDistanceM) * fastMps,
      vz: -fastMps,
    },
  };
}

/**
 * 通常物理が作った始点・到達点・刻みを保ったまま、ロビン固有の3D軌道へ置き換える。
 * 描画と打撃判定は、この同じ `PitchPath` を読む。
 */
export function applyRobinPitchPath(path: PitchPath, sample: RobinPitchSample): PitchPath {
  const spec = ROBIN_SPEC_BY_ID.get(sample.id);
  if (!spec) return path;
  if (spec.trajectory === 'accelerating') {
    return applyAcceleratingPitchPath(path, sample, spec);
  }
  const plateIndex = path.points.findIndex((p) => p.z <= 0);
  if (plateIndex <= 1) return path;

  const start = path.points[0];
  const plate = path.plate;
  const points = path.points.slice();
  const phase = (sample.zigzagPhase / 8) * Math.PI * 2;

  for (let i = 0; i <= plateIndex; i++) {
    const timeU = i / plateIndex;
    const u = clamp01(timeU);
    let x = lerp(start.x, plate.x, u);
    let y = lerp(start.y, plate.y, u);

    const wave = (spec.movementAmplitudeM ?? 0) *
      Math.sin(Math.PI * 2 * (spec.movementCycles ?? 0) * u);
    if (spec.trajectory === 'wave_vertical') {
      y += wave;
    }
    if (spec.trajectory === 'wave_horizontal') {
      x += wave;
    }
    if (spec.trajectory === 'zigzag') {
      const cycles = spec.movementCycles ?? 5;
      const zigzag = triangle(cycles * u, phase);
      const startWave = triangle(0, phase);
      const endWave = triangle(cycles, phase);
      x += (spec.movementAmplitudeM ?? 0) * (zigzag - lerp(startWave, endWave, u));
    }
    points[i] = vec3(x, y, lerp(start.z, 0, u));
  }

  const prev = points[plateIndex - 1];
  const at = points[plateIndex];
  const invDt = 1 / path.dt;
  const plateOut = {
    ...plate,
    x: at.x,
    y: at.y,
    t: plateIndex * path.dt,
    vx: (at.x - prev.x) * invDt,
    vy: (at.y - prev.y) * invDt,
    vz: (at.z - prev.z) * invDt,
  };

  const hiddenAfterT = spec.hideDistanceFromBatterM === undefined
    ? undefined
    : crossingTimeAtZ(points, path.dt, spec.hideDistanceFromBatterM);

  return {
    ...path,
    points,
    plate: plateOut,
    ...(hiddenAfterT === undefined ? {} : { hiddenAfterT }),
  };
}

export function createRobinPitcher(): PlayerRecord {
  return {
    id: 'robin',
    name: 'ロビン',
    bats: 'R',
    throws: 'R',
    heightM: 1.63,
    pitchTypes: [...ROBIN_PITCH_TYPES],
    ratings: {
      contact: 50,
      power: 50,
      discipline: 50,
      speed: 50,
      velocity: 50,
      control: 82,
      breakBoost: 50,
      stamina: 100,
      fielding: 70,
      arm: 70,
      pullIntent: 50,
      centerIntent: 50,
      oppoIntent: 50,
      homerConviction: 50,
    },
  };
}
