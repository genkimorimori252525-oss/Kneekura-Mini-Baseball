import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { runFieldPracticeV98 } from './FieldPracticeWorkbenchV98';

// Real V106 maker, unchanged TBD default abilities, RF_ground_pull.
const frozen = readFileSync('docs/demos/field-rf-ground-v107.json', 'utf8');
const request = () => JSON.parse(frozen);
const speed = (v: { x:number; y:number; z:number }) => Math.hypot(v.x,v.y,v.z);

it('receives the actual right-field grounder without striking against the ball or boosting retention', () => {
  const input = request(), before = JSON.stringify(input), r = runFieldPracticeV98(input),
    id = input.fieldInput.defense.RF, contact = r.field.diagnostics.aiTelemetry.contactDiagnostics.find(c => c.playerId === id)!;
  expect(contact.retention?.outcome).toBe('secured');
  expect(contact.retention!.retentionLoadJ).toBeLessThan(contact.retention!.effectiveCapacityJ);
  expect(speed(contact.retention!.relativeVelocity)).toBeLessThanOrEqual(contact.ballSpeedMps + contact.bodySpeedMps);
  expect(r.input.fielders.find(f => f.playerId === id)!.catchRetention.centerRetentionCapacityJ).toBe(160);
  expect(r.field.facts.some(f => f.kind === 'catch_secured' && f.playerId === id)).toBe(true);
  expect(r.field.end.complete).toBe(true);
  for (const f of r.field.frames) for (const a of f.fielders) expect(a.bodyPoseV105!.reachMarginMeters).toBeGreaterThanOrEqual(-1e-7);
  expect(JSON.stringify(input)).toBe(before);
});

it('still lets a weak pocket fail and an upright short reach miss the same rolling ball', () => {
  const weak = request(), id = weak.fieldInput.defense.RF;
  weak.fieldInput.maxPlaySeconds = 3;
  weak.fieldInput.players.find((p:{ playerId:string }) => p.playerId === id).physical.retentionCapacityJ = 10;
  const missed = runFieldPracticeV98(weak);
  expect(missed.field.diagnostics.aiTelemetry.contactDiagnostics.find(c => c.playerId === id)?.retention?.outcome).toBe('live-ball');
  expect(missed.field.facts.some(f => f.kind === 'catch_secured' && f.playerId === id)).toBe(false);
  const upright = request(); upright.fieldInput.maxPlaySeconds = 3;
  upright.fieldInput.players.find((p:{ playerId:string }) => p.playerId === id).physical.fieldCrouchFractionV105 = 0;
  const unreachable = runFieldPracticeV98(upright);
  expect(unreachable.field.facts.some(f => f.kind === 'glove_contact' && f.playerId === id)).toBe(false);
});

it('keeps physical contacts and official results independent of rendering frequency', () => {
  const input = request(), a = runFieldPracticeV98(input),
    b = runFieldPracticeV98({ ...input, fieldInput: { ...input.fieldInput, frameSeconds: .11 } });
  expect(b.field.facts).toEqual(a.field.facts);
  expect(b.field.ruleFacts).toEqual(a.field.ruleFacts);
  expect(b.rules).toEqual(a.rules);
});
