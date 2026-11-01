import { beforeAll, expect, it } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { buildLiveFieldPlayInputV95, type LiveFieldInputRequestV95 } from '../../../integration/browser/LiveFieldInputV95';
import { simulateLiveFieldPlayV1 } from './LiveFieldPlayV1';
import type { LivePositionV1 } from '../../../integration/browser/LiveBaseballMatchV1';

const source = JSON.parse(readFileSync('docs/demos/field-infield-bounce-v108.json', 'utf8'))['1'].fieldInput as LiveFieldInputRequestV95;
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const cases: readonly Readonly<{ name: string; role: LivePositionV1; speed?: number; closeTeammate?: true }>[] = [
  { name: 'SS-standard', role: 'SS' }, { name: '2B-standard', role: '2B' },
  { name: '1B-standard', role: '1B' }, { name: '3B-standard', role: '3B' },
  { name: 'SS-faster-ball', role: 'SS', speed: 16 }, { name: 'SS-close-teammate', role: 'SS', speed: 16, closeTeammate: true },
];

function fixture(scene: typeof cases[number]) {
  const mapped = buildLiveFieldPlayInputV95(source), playerId = source.defense[scene.role],
    fielder = mapped.fielders.find(f => f.playerId === playerId)!, home = mapped.field.bases.home,
    dx = fielder.position.x - home.x, dz = fielder.position.z - home.z, distance = Math.hypot(dx, dz),
    direction = { x: dx / distance, z: dz / distance }, speed = scene.speed ?? 12;
  return { playerId, input: { ...mapped, outs: 2, maxPlaySeconds: 1.8, frameSeconds: .04,
    ball: { originTick: 0, elapsedSeconds: 0, ball: { tick: 0,
      position: v(fielder.position.x - direction.x * 6, 1.2, fielder.position.z - direction.z * 6),
      velocity: v(direction.x * speed, -3, direction.z * speed), spin: v() } },
    fielders: mapped.fielders.map(f => scene.closeTeammate && f.playerId === source.defense['3B']
      ? { ...f, position: v(fielder.position.x + .8, f.position.y, fielder.position.z) } : f),
  } };
}

function runCases() {
  return cases.map(scene => {
    const { playerId, input } = fixture(scene), before = JSON.stringify(input), result = simulateLiveFieldPlayV1(input),
      actor = input.fielders.find(f => f.playerId === playerId)!, actions = result.diagnostics.athleticDecisionsV115.filter(a => a.playerId === playerId),
      contacts = result.diagnostics.aiTelemetry.contactDiagnostics.filter(c => c.playerId === playerId),
      snapshots = result.frames.filter(f => f.fielders.find(a => a.playerId === playerId)?.athleticV115).map(f => ({
        elapsedSeconds: f.elapsedSeconds, actor: f.fielders.find(a => a.playerId === playerId),
      }));
    expect(JSON.stringify(input)).toBe(before);
    return { scene, playerId, input, actor, end: result.end, actions, allActions: result.diagnostics.athleticDecisionsV115,
      facts: result.facts, ruleFacts: result.ruleFacts, contacts, snapshots, detail: result.diagnostics.unresolvedDetail };
  });
}

let report: ReturnType<typeof runCases>;
beforeAll(() => {
  report = runCases();
  if (process.env.INFIELD_DIVE_AUDIT_V117 === '1') {
    mkdirSync('docs/verification/releases/v117/infield-dive', { recursive: true });
    const hash = createHash('sha256').update(readFileSync('src/core/sim/fielding/LiveFieldPlayV1.ts')).digest('hex');
    writeFileSync('docs/verification/releases/v117/infield-dive/six-conditions.json', JSON.stringify({ sourceSha256: hash, report }, null, 2) + '\n');
    console.log('INFIELD_DIVE_V117', JSON.stringify(report.map(r => ({ name: r.scene.name, id: r.playerId,
      actions: r.actions, contacts: r.contacts.map(c => ({ time: c.elapsedSeconds, outcome: c.retention?.outcome })), end: r.end, detail: r.detail }))));
  }
}, 30000);

it('makes a real dive and ground-ball contact from the ordinary SS placement without changing its authored body or ability', () => {
  const r = report.find(r => r.scene.name === 'SS-faster-ball')!,
    original = buildLiveFieldPlayInputV95(source).fielders.find(f => f.playerId === r.playerId)!;
  expect(r.actor).toEqual(original);
  expect(r.actions.some(a => a.kind === 'dive')).toBe(true);
  expect(r.contacts.some(c => c.role === 'glove' && c.retention?.outcome === 'secured')).toBe(true);
  expect(r.facts.some(f => f.kind === 'glove_contact' && f.playerId === r.playerId)).toBe(true);
  expect(r.facts.some(f => f.kind === 'catch_secured' && f.playerId === r.playerId)).toBe(true);
  expect(r.snapshots.some(f => f.actor!.bodyPoseV105!.head.y < 1)).toBe(true);
  expect(r.ruleFacts.firstGroundContactTick).not.toBeNull();
  expect(r.ruleFacts.flyCatch).toBeNull();
  expect(r.detail).toBeNull();
});

it('uses ordinary reception for easier SS and 2B balls rather than diving on every close pass', () => {
  for (const name of ['SS-standard', '2B-standard']) {
    const r = report.find(r => r.scene.name === name)!;
    expect(r.actions).toEqual([]);
    expect(r.contacts.some(c => c.role === 'glove' && c.retention?.outcome === 'secured')).toBe(true);
    expect(r.detail).toBeNull();
  }
});

it('keeps the close-teammate collision reserve for the identical difficult SS ball', () => {
  const normal = report.find(r => r.scene.name === 'SS-faster-ball')!, close = report.find(r => r.scene.closeTeammate)!;
  expect(close.input.ball).toEqual(normal.input.ball);
  expect(close.actor).toEqual(normal.actor);
  expect(normal.actions.some(a => a.kind === 'dive')).toBe(true);
  expect(close.actions).toEqual([]);
  expect(close.detail).toBeNull();
});
