import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { runFieldPracticeV98 } from './FieldPracticeWorkbenchV98';

// Frozen, unedited request from the released V105 maker: TBD, second_force.
// The source hashes in context identify that reproduction, not this test Core.
const request = JSON.parse(readFileSync('docs/demos/field-double-play-v106.json', 'utf8'));

it('turns the actual TBD second-base practice into two physically received force outs without changing abilities', () => {
  const before = JSON.stringify(request), result = runFieldPracticeV98(request),
    forces = result.field.facts.filter(f => f.kind === 'controlled_base_contact');
  expect(result.field.end.complete).toBe(true);
  expect(result.match.outs).toBe(2);
  expect(forces.map(f => f.base)).toEqual([2, 1]);
  expect(result.field.finalRunners.filter(r => r.retired)).toHaveLength(2);
  expect(result.field.facts.filter(f => f.kind === 'catch_secured')).toHaveLength(3);
  expect(result.field.diagnostics.aiTelemetry.doublePlayDecisionsV106?.some(
    d => d.decision.reason === 'ATTEMPT_DOUBLE_PLAY')).toBe(true);
  expect(JSON.stringify(request)).toBe(before);
});

it('uses one remaining out at two outs instead of manufacturing a double play', () => {
  const result = runFieldPracticeV98({ ...request, fieldInput: { ...request.fieldInput, outs: 2 } });
  expect(result.field.end.complete).toBe(true);
  expect(result.field.finalRunners.filter(r => r.retired)).toHaveLength(1);
  expect(result.field.diagnostics.aiTelemetry.doublePlayDecisionsV106).toEqual([]);
});
