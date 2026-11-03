import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compileLiveFenceShapeV1, liveFenceVerticesV1, type LiveFenceShapeInputV1 } from './LiveFenceShapeV1';
// @ts-expect-error the studio is plain .mjs
import { dodgerStadiumDesign, fukuokaDomeDesign, koshienDesign, niikuraDomeDesign, russianDomeDesign, validateDesign, wallAt } from '../../../../tools/ballpark-studio/model.mjs';
import { simulateLiveFieldPlayV1, deriveLiveFieldFenceGeometryV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { createGroundWallRollingCurveV1 } from './GroundWallRollingCurveV1';
import { predictLiveDefensiveOpportunityV1 } from './LiveDefensiveOpportunityV1';
import { settleBattedBallV1 } from '../../../integration/browser/LiveBaseRunningV1';
import { createLiveBaseballMatchV1, LIVE_MATCH_PHYSICS_V1 } from '../../../integration/browser/LiveBaseballMatchV1';
import { liveMatchFixture } from '../../../integration/browser/LiveBaseballMatchV1.test-support';

const shapesText = readFileSync(new URL('../../../../release/game/parts/park-shapes-v1.js', import.meta.url), 'utf8');
const SHAPES: Record<string, LiveFenceShapeInputV1> = JSON.parse(shapesText.slice(shapesText.indexOf('(') + 1, shapesText.lastIndexOf(')')));
const DESIGNS = { fukuoka: fukuokaDomeDesign, tambov: russianDomeDesign, niikura: niikuraDomeDesign, koshien: koshienDesign, dodger: dodgerStadiumDesign } as const;
const home = { x: 0, z: 0 };
const at = (degrees: number, meters: number) => ({ x: Math.sin(degrees * Math.PI / 180) * meters, z: Math.cos(degrees * Math.PI / 180) * meters });
const physics = LIVE_MATCH_PHYSICS_V1, r = physics.ground.radiusM, tps = physics.air.ticksPerSecond;
const bases = Object.freeze({ home: { x: 0, y: 0, z: 0 }, first: { x: 19.3973, y: 0, z: 19.3973 }, second: { x: 0, y: 0, z: 38.7946 }, third: { x: -19.3973, y: 0, z: 19.3973 } });
const retention = { ticksPerSecond: tps, ballRadiusMeters: r, ballMassKg: physics.air.aerodynamics.ballMassKg, pocketRadiusMeters: .08,
  centerRetentionCapacityJ: 90, captureDissipationPowerW: 1400, failedContactRestitution: .3, failedTangentialDamping: .6, failedSpinDamping: .6 };
const fielder = (playerId: string, x: number, z: number) => ({ playerId, position: { x, y: .9, z }, reactionSeconds: 30, topSpeedMps: 7, accelerationMps2: 4,
  gloveSpeedMps: 7, gloveReachMeters: .7, gloveRadiusMeters: .12, catchRetention: retention, transferSeconds: .5, throwSpeedMps: 30 });
const nine = () => [[0, 18], [0, 1.5], [24, 22], [12, 34], [-24, 22], [-12, 34], [-30, 70], [0, 86], [30, 70]].map(([x, z], i) => fielder('f' + i, x, z));
const play = (shape: LiveFenceShapeInputV1 | null, position: { x: number; y: number; z: number }, velocity: { x: number; y: number; z: number }, spin = { x: 0, y: 0, z: 0 }, extra: Partial<LiveFieldPlayInputV1> = {}) =>
  simulateLiveFieldPlayV1({ ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position, velocity, spin } }, physics,
    field: { bases, fenceRadiusMeters: 110, fenceHeightMeters: 3, ...(shape ? { fenceShapeV1: shape } : {}) },
    fielders: nine(), runners: [{ runnerId: 'b', initialBase: 0, topSpeedMps: 8, accelerationMps2: 4, reactionSeconds: .2 }], outs: 0, seed: 7, maxPlaySeconds: 14, ...extra });

describe('live fence shape data', () => {
  it('the exported part is the studio outline and its radial lookup', () => {
    for (const [key, make] of Object.entries(DESIGNS)) {
      const g = validateDesign(make()).geometry, vertices = liveFenceVerticesV1(SHAPES[key]), shape = compileLiveFenceShapeV1(SHAPES[key], home);
      expect(vertices.length).toBe(g.vertices.length);
      vertices.forEach((p, i) => { expect(p.x).toBe(g.vertices[i].x); expect(p.z).toBe(g.vertices[i].z); expect(p.heightMeters).toBe(g.vertices[i].heightMeters); });
      for (let d = -179; d <= 179; d += 7.3) {
        const theirs = wallAt(g, d * Math.PI / 180), ours = shape.wallAt(d * Math.PI / 180);
        expect(ours.distanceMeters).toBeCloseTo(theirs.distanceMeters, 9); expect(ours.heightMeters).toBeCloseTo(theirs.heightMeters, 9);
      }
    }
  });
  it('Niikura is 142/94.5 with a positive backstop, and the circle cannot hold it', () => {
    const w = compileLiveFenceShapeV1(SHAPES.niikura, home).wallAt;
    expect(w(0).distanceMeters).toBeCloseTo(142, 9); expect(w(Math.PI / 4).distanceMeters).toBeCloseTo(94.5, 9); expect(w(Math.PI).distanceMeters).toBeCloseTo(8.2, 9);
    expect(() => deriveLiveFieldFenceGeometryV1({ bases, fenceRadiusMeters: 142, fenceHeightMeters: 3, foulFenceRadiusMeters: -5 })).toThrow();
    expect(deriveLiveFieldFenceGeometryV1({ bases, fenceRadiusMeters: 142, fenceHeightMeters: 3, foulFenceRadiusMeters: -5, fenceShapeV1: SHAPES.niikura }).fenceVerticesV1!.length).toBe(145);
  });
  it('Dodger drops to 1.397m at the pole and stands 2.4384m in the gaps', () => {
    const w = compileLiveFenceShapeV1(SHAPES.dodger, home).wallAt;
    expect(w(44 * Math.PI / 180).heightMeters).toBe(1.397); expect(w(-41 * Math.PI / 180).heightMeters).toBe(1.397); expect(w(0).heightMeters).toBe(2.4384);
    const ramp = w(36 * Math.PI / 180).heightMeters; expect(ramp).toBeGreaterThan(1.397); expect(ramp).toBeLessThan(2.4384);
  });
  it('the signed gap is exact against a brute force over every edge, at every park', () => {
    for (const shape of Object.values(SHAPES)) {
      const c = compileLiveFenceShapeV1(shape, home), v = c.vertices;
      const brute = (x: number, z: number) => { let d = Infinity; for (let e = 0; e + 1 < v.length; e++) d = Math.min(d, c.edgeDistance(e, { x, z })); return d; };
      for (let i = 0; i < 4000; i++) {
        const a = -180 + 360 * ((i * 0.6180339887) % 1), m = 170 * ((i * 0.7548776662) % 1), p = at(a, m), gap = c.gapAt(p);
        expect(Math.abs(gap)).toBeCloseTo(brute(p.x, p.z), 10);
        expect(gap > 0).toBe(m < c.wallAt(a * Math.PI / 180).distanceMeters);
      }
    }
  });
  it('clampInside keeps a clearance at convex corners and reflex notches alike', () => {
    for (const shape of Object.values(SHAPES)) {
      const c = compileLiveFenceShapeV1(shape, home);
      for (let a = -180; a < 180; a += 3.1) {
        const q = c.clampInside({ ...at(a, 300), y: 1 }, .4); expect(c.gapAt(q)).toBeGreaterThanOrEqual(.4 - 1e-6); expect(q.y).toBe(1);
      }
      const free = { x: 1, y: 2, z: 30 }; expect(c.clampInside(free, .4)).toBe(free);
    }
  });
  it('rejects an open outline', () => {
    expect(() => compileLiveFenceShapeV1({ points: SHAPES.dodger.points, foul: { ...SHAPES.dodger.foul, nodes: SHAPES.dodger.foul.nodes!.slice(1) } }, home)).toThrow();
  });
});

describe('ball against the real wall', () => {
  const launch = (degrees: number, height: number, speed: number, from = 60) => {
    const a = degrees * Math.PI / 180, p = at(degrees, from);
    return { position: { x: p.x, y: height, z: p.z }, velocity: { x: Math.sin(a) * speed, y: 6, z: Math.cos(a) * speed } };
  };

  it('one flight clears the low pole segment and strikes the high gap segment at the same height', () => {
    // The same ball towards two angles: 1.397m near the pole, 2.4384m by centre.
    const flight = (degrees: number) => {
      const c = compileLiveFenceShapeV1(SHAPES.dodger, home), wall = c.wallAt(degrees * Math.PI / 180), a = degrees * Math.PI / 180, speed = 30, from = wall.distanceMeters - 4;
      const p = at(degrees, from), y = 1.9;
      return play(SHAPES.dodger, { x: p.x, y, z: p.z }, { x: Math.sin(a) * speed, y: .3, z: Math.cos(a) * speed });
    };
    const low = flight(40), high = flight(20);
    expect(low.ruleFacts.overFence).toMatchObject({ fair: true, untouchedGround: true, cause: 'batted' });
    expect(high.ruleFacts.overFence).toBeNull();
    const circle = (degrees: number) => { const a = degrees * Math.PI / 180, p = at(degrees, 96); return play(null, { x: p.x, y: 1.9, z: p.z }, { x: Math.sin(a) * 30, y: .3, z: Math.cos(a) * 30 }); };
    expect(circle(40).ruleFacts.overFence).toBeNull();
  });
  it('a rebound off a straight edge leaves along its own normal, not towards the circle centre', () => {
    const c = compileLiveFenceShapeV1(SHAPES.tambov, home), { position, velocity } = launch(20, 1, 34), result = play(SHAPES.tambov, position, velocity);
    expect(result.ruleFacts.overFence).toBeNull(); expect(result.end.reason).not.toBe('numerical_contact_refinement_required');
    const frames = result.frames.filter(f => f.ball); expect(Math.min(...frames.map(f => c.gapAt(f.ball!.position)))).toBeGreaterThan(r - 5e-3);
  });
  it('a ball through a vertex is decided once, on either side of it, with no stop', () => {
    for (const key of ['fukuoka', 'tambov', 'koshien', 'dodger', 'niikura']) {
      const c = compileLiveFenceShapeV1(SHAPES[key], home);
      for (const v of c.vertices.filter(p => [-39.375, 16.875].includes(p.angleDegrees))) {
        const a = v.angleDegrees * Math.PI / 180, speed = 30, position = { x: v.x * .95, y: 1, z: v.z * .95 };
        for (const height of [1, 3.5]) {
          const result = play(SHAPES[key], { ...position, y: height + 2 }, { x: Math.sin(a) * speed, y: 0, z: Math.cos(a) * speed });
          expect(result.end.reason, key + ' ' + v.angleDegrees).not.toBe('numerical_contact_refinement_required');
          expect(result.ruleFacts.overFence === null || result.ruleFacts.overFence.fair).toBe(true);
        }
      }
    }
  });
  it('exact bisector into a convex corner: two walls, a bounce each, and no pass through', () => {
    const shape: LiveFenceShapeInputV1 = { points: [-45, 0, 45].map(angleDegrees => ({ angleDegrees, distanceMeters: angleDegrees === 0 ? 100 : 141.42, heightMeters: 5 })),
      foul: { firstSideMeters: 30, thirdSideMeters: 30, backstopMeters: 30, heightMeters: 5 } };
    const result = play(shape, { x: 40, y: 1, z: 40 }, { x: 30, y: 2, z: 30 }), c = compileLiveFenceShapeV1(shape, home);
    expect(result.end.reason).not.toBe('numerical_contact_refinement_required');
    expect(result.ruleFacts.overFence).toBeNull();
    expect(Math.min(...result.frames.filter(f => f.ball).map(f => c.gapAt(f.ball!.position)))).toBeGreaterThan(0);
  });
  it('the foul pole: a hair fair is a fair home run, a hair foul is a dead foul, at the low wall', () => {
    const shot = (degrees: number) => { const a = degrees * Math.PI / 180, p = at(degrees, 90); return play(SHAPES.dodger, { x: p.x, y: 6, z: p.z }, { x: Math.sin(a) * 30, y: 1, z: Math.cos(a) * 30 }); };
    const fair = shot(44.9), foul = shot(45.1);
    expect(fair.ruleFacts.overFence?.fair).toBe(true); expect(fair.ruleFacts.territory).toBe('fair');
    expect(foul.ruleFacts.overFence?.fair).toBe(false); expect(foul.end.reason).toBe('foul_dead_ball');
  });
  it('foul territory ends at the real wall: Niikura is dead at 12m where the circle ran on', () => {
    const c = compileLiveFenceShapeV1(SHAPES.niikura, home), a = 100 * Math.PI / 180, result = play(SHAPES.niikura, { x: 1, y: 1, z: -.2 }, { x: Math.sin(a) * 25, y: 5, z: Math.cos(a) * 25 });
    expect(result.end.reason).toBe('foul_dead_ball');
    expect(Math.hypot(result.facts.find(f => f.kind === 'over_fence')!.position!.x, result.facts.find(f => f.kind === 'over_fence')!.position!.z))
      .toBeCloseTo(c.wallAt(Math.atan2(result.facts.find(f => f.kind === 'over_fence')!.position!.x, result.facts.find(f => f.kind === 'over_fence')!.position!.z)).distanceMeters, 0);
  });
  it('ground-rule double: a bounce over the low wall is not a home run', () => {
    const a = 42 * Math.PI / 180, p = at(42, 88), result = play(SHAPES.dodger, { x: p.x, y: 1.5, z: p.z }, { x: Math.sin(a) * 32, y: -2, z: Math.cos(a) * 32 });
    expect(result.ruleFacts.firstGroundContactTick).not.toBeNull();
    if (result.ruleFacts.overFence) { expect(result.ruleFacts.overFence.untouchedGround).toBe(false); expect(result.ruleFacts.overFence.fair).toBe(true); }
  });
  it('a grounder runs into the wall, rolls along its straight edge and past a corner, and stays in play', () => {
    const c = compileLiveFenceShapeV1(SHAPES.koshien, home), wall = c.wallAt(10 * Math.PI / 180), p = at(10, wall.distanceMeters - .6), edge = c.touching(p, 2)[0];
    // Nearly along the wall: the normal energy is gone at once and the rest becomes a supported roll.
    const speed = 12, t = edge.tangent, n = edge.normal, velocity = { x: t.x * speed - n.x * .02, y: 0, z: t.z * speed - n.z * .02 };
    const close = { x: edge.point.x + n.x * (r + .001), y: r, z: edge.point.z + n.z * (r + .001) };
    const result = play(SHAPES.koshien, close, velocity, { x: 0, y: 0, z: 0 }, { fielders: nine().map(f => ({ ...f, position: { ...f.position, z: Math.min(f.position.z, 40) } })) });
    expect(result.diagnostics.wallKernelBuilds).toBeGreaterThan(0);
    expect(result.facts.some(f => f.kind === 'wall_support')).toBe(true);
    expect(result.end.reason).not.toBe('numerical_contact_refinement_required');
    const gaps = result.frames.filter(f => f.ball).map(f => c.gapAt(f.ball!.position) - r); expect(Math.min(...gaps)).toBeGreaterThan(-.0021);
  });
  it('the straight wall source keeps its line, speed law and pole-window query', () => {
    const initial = { originTick: 0, elapsedSeconds: 0, ball: { tick: 0, position: { x: 10, y: r, z: 20 }, velocity: { x: 6, y: 0, z: 8 }, spin: { x: 0, y: 0, z: 0 } } };
    const curve = createGroundWallRollingCurveV1({ initial, throughElapsedSeconds: 3, profile: physics, fenceCenter: { x: 0, y: 0, z: 0 }, nominalContactRadiusMeters: 100,
      maximumCompressionMeters: .002, edgeV1: { tangent: { x: .6, z: .8 }, signedGapMeters: -1e-4 } });
    expect(curve.kind).toBe('compliant_ground_wall_edge_source_v1');
    for (const t of [.1, 1, 2.5]) { const p = curve.evaluateAt(t).moment.ball.position; expect((p.x - 10) * .8 - (p.z - 20) * .6).toBeCloseTo(0, 11); }
    expect(curve.queryNoPoleContactWindowV170({ fromElapsedSeconds: 0, throughElapsedSeconds: 1, poles: [{ surfaceId: 'p', center: { x: -50, z: -50 }, radiusM: .1 }] }).kind).toBe('clear');
  });
});

describe('fielders and judgments at the real wall', () => {
  it('a fielder chasing past the wall stops inside it, at a corner too', () => {
    const c = compileLiveFenceShapeV1(SHAPES.dodger, home), a = 15 * Math.PI / 180, wall = c.wallAt(a).distanceMeters;
    const result = play(SHAPES.dodger, { ...at(15, wall - 30), y: 12 }, { x: Math.sin(a) * 18, y: 10, z: Math.cos(a) * 18 }, { x: 0, y: 0, z: 0 },
      { fielders: nine().map((f, i) => i === 7 ? { ...f, reactionSeconds: .1, position: { ...at(14, wall - 6), y: .9 } } : f) });
    const cf = result.frames.map(f => f.fielders[7]); expect(Math.max(...cf.map(f => Math.hypot(f.position.x, f.position.z)))).toBeGreaterThan(wall - 5);
    for (const frame of result.frames) for (const f of frame.fielders) expect(c.gapAt(f.position)).toBeGreaterThan(.2);
  });
  it('the decisive-over-fence cue reads the wall at the crossing', () => {
    const c = compileLiveFenceShapeV1(SHAPES.dodger, home), path = (degrees: number, climb: number) => {
      const a = degrees * Math.PI / 180, speed = 36, sample = (s: number) => ({ position: { x: Math.sin(a) * (60 + speed * s), y: 3 + climb * s - .4 * s * s, z: Math.cos(a) * (60 + speed * s) }, velocity: { x: Math.sin(a) * speed, y: climb - .8 * s, z: Math.cos(a) * speed } });
      return predictLiveDefensiveOpportunityV1({ availableAtTick: 0, observationTick: 0, ballRadiusMeters: r, home: bases.home, fenceCenter: bases.home, fenceRadiusMeters: 500, fenceHeightMeters: 99, fenceShapeV1: c,
        prediction: { maximumSeconds: 4, firstPredictedGroundSeconds: 3.5, maximumPositionSpeedMps: 45, sample }, fielders: nine() .map(f => ({ ...f, velocity: { x: 0, y: 0, z: 0 } })) });
    };
    expect(path(10, 6)?.kind).toBe('none-decisive-over-fence'); expect(path(10, -.2)).toBeNull();
  });
  it('the plain fallback settles against the wall at its own angle', () => {
    const ball = (degrees: number, speed: number) => { const a = degrees * Math.PI / 180; return { position: { x: 0, y: 1, z: 0 }, velocity: { x: Math.sin(a) * speed, y: 19, z: Math.cos(a) * speed } }; };
    const seed = { fenceRadiusMeters: 136.5, fenceHeightMeters: 3, seed: 1, pitchOrdinal: 1 };
    expect(settleBattedBallV1({ ...seed, ball: ball(0, 50) }).outcome).toBe('home_run');
    expect(settleBattedBallV1({ ...seed, ball: ball(0, 50), fenceShapeV1: SHAPES.niikura }).outcome).not.toBe('home_run');
  });
});

describe('a match on the real wall', () => {
  it('Niikura starts, keeps everyone inside and hands the game its outline', () => {
    const c = compileLiveFenceShapeV1(SHAPES.niikura, home), host = createLiveBaseballMatchV1({ ...liveMatchFixture(4), park: { fenceRadiusMeters: 136.5, fenceHeightMeters: 3, foulFenceRadiusMeters: 8.2, fenceShapeV1: SHAPES.niikura } });
    let fieldFrames = 0;
    for (let n = 0; n < 16; n++) {
      const r = host.issuePitch({ batting: 'balanced', pitchType: 'auto', location: 'auto', managedTeam: 0 });
      expect((r.play.contact as { fieldFallbackV1?: string } | null)?.fieldFallbackV1).toBeUndefined();
      for (const frame of r.play.field?.frames ?? []) { fieldFrames++; for (const f of frame.fielders) expect(c.gapAt(f.position)).toBeGreaterThan(0); }
    }
    expect(fieldFrames).toBeGreaterThan(0);
    const fence = host.inspect().fenceGeometry as { shapeV1?: { vertices: readonly { distanceMeters: number }[] }; radiusMeters: number };
    expect(fence.shapeV1!.vertices.length).toBe(145); expect(fence.radiusMeters).toBeCloseTo(142, 9);
  });
  it('without a shape the game record is exactly the circle it always was', () => {
    const fence = createLiveBaseballMatchV1(liveMatchFixture(4)).inspect().fenceGeometry;
    expect(Object.keys(fence).sort()).toEqual(['center', 'heightMeters', 'radiusMeters']);
  });
});
