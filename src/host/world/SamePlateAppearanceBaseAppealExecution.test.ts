import { expect, it } from 'vitest';
import * as appeal from './SamePlateAppearanceBaseAppealExecution';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { fixture, material, v } from '../../core/sim/ball/BattedWorldScheduledFieldThrow.test-support';
import { deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { deriveSamePaPhysicalFieldCapture } from './SamePlateAppearancePhysicalFieldCapture';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { createCanonicalPlateAppearanceTimeline, recordBatBallContact } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
const roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
const fieldRef = (f: any) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
/** Structural Native records with real Core capture, continuous foot histories
 * and custody kernels. This fixture does not claim SQLite admission. */
const setup = (originTick = 0, runnerSpeed = 2, defenderX = 3, defenderFootSpeed = 0) => {
  const original = fixture(originTick, 1, 5, 5);
  const actors = ['batter', 'carrier', 'runner'].flatMap((playerId, index) => roles.map(role => {
    const foot = role.endsWith('foot'), glove = playerId === 'carrier' && role === 'glove';
    return { playerId, primitive: { role, radius: 0.125, startTick: originTick, endTick: originTick + 5_000_000, ticksPerSecond: 1_000_000,
      startCenter: glove ? v(2.25, 5, 5) : foot && playerId !== 'batter' ? v(playerId === 'carrier' ? defenderX : 3, 1, 0) : v(20 + index * 5, 10, 5),
      startVelocity: glove ? v(1, 0, 0) : playerId === 'runner' ? v(0, 0, runnerSpeed)
        : foot && playerId === 'carrier' ? v(0, 0, defenderFootSpeed) : v(0, 0, 0), acceleration: v(0, 0, 0) } };
  }));
  const response: any = { ...original.response, world: { ...original.response.world, actors }, actors: actors.map(a => ({ playerId: a.playerId,
    profile: a.primitive.role === 'glove' ? original.response.actors[0].profile : { role: a.primitive.role, material } })) };
  const field = deriveInitialBattedWorldFieldMotion({ ...original, response,
    commands: actors.map(a => ({ playerId: a.playerId, role: a.primitive.role, acceleration: v(0, 0, 0) })) });
  const match: any = { ruleProfileId: asRuleProfileId('npb-2026'), playId: 1, inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
    bases: { first: 'runner', second: null, third: null }, score: { away: 0, home: 0 } };
  const timeline = recordBatBallContact(createCanonicalPlateAppearanceTimeline(match, originTick), response.world.flight.contact);
  const root: any = { kind: 'same_pa_physical_field_root_v1', source: { sourceId: 'root', sourceVersion: 'fixture-only', parameters: response.world.parameters },
    physicalPitchSourceId: 'pitch', pitchOrdinal: 1, operationOrdinal: 1, evaluationTick: field.motion.world.moment.ball.tick,
    response, geometry: original.geometry, field, lineage: { playId: 1 }, timeline };
  const plan = prepareBattedWorldScheduledFieldAcquisition({ response, geometry: root.geometry, field });
  const source: any = { sourceId: 'capture', sourceVersion: 'fixture-only', previousOperationReference: fieldRef(root), previousFieldReference: fieldRef(root),
    fieldRootReference: fieldRef(root), throughTick: originTick + Math.ceil(plan.fenceElapsedSeconds * 1_000_000),
    action: { kind: 'capture_checkpoint_v1', candidateReference: fieldRef(root), throughElapsedSeconds: plan.fenceElapsedSeconds } };
  const captured: any = { ...root, kind: 'same_pa_physical_field_step_v1', source, operationOrdinal: 2,
    ...deriveSamePaPhysicalFieldCapture(source, root, root, root) };
  const fields = [root, captured];
  const evidence = deriveSamePaFieldRuleEvidence({ fields, batterRunnerId: 'batter', defenderIds: ['carrier'], occupiedRunnerIds: ['runner'], outsAtStart: 0 });
  return { indication: { defenderId: 'carrier', runnerId: 'runner', base: 'first' as const }, match, root, fields, evidence };
};
const derive = (input: ReturnType<typeof setup>): any => {
  const fn = (appeal as { deriveSamePaBaseAppealExecution?: Function }).deriveSamePaBaseAppealExecution;
  expect(fn, 'base-appeal physical qualification helper is missing').toBeTypeOf('function');
  return fn!(input);
};
it('BAE01 qualifies an intentional controlled-base appeal at the current physical instant without adding motion or an outcome', () => {
  const h = setup(), before = JSON.stringify(h), result = derive(h), end = h.evidence.physical.field.evidence.horizon;
  expect(result.kind, JSON.stringify(result)).toBe('ready');
  expect(result.attempt).toEqual({ kind: 'defensive_appeal_attempt', defenderId: 'carrier', runnerId: 'runner', base: 1,
    reason: 'tag_up_early_departure', tick: end.ball.tick });
  expect(result.moment).toEqual({ originTick: 0, elapsedSeconds: end.elapsedSeconds, tick: end.ball.tick });
  expect(result.complianceEvidence).toMatchObject({ kind: 'ball_world_tag_up_history_v1', originBase: 'first',
    history: { playerId: 'runner', endElapsedSeconds: end.elapsedSeconds, contactAtStart: true, contactAtHorizon: false } });
  expect(result.compliance.kind).toBe('appealable_early_departure');
  expect(result.fieldReference).toEqual(fieldRef(h.fields.at(-1)));
  expect(result.firstFielderTouchReference).toEqual(fieldRef(h.root));
  for (const key of ['out', 'officialRuling', 'physicalEnd', 'ledger', 'settlement']) expect(result).not.toHaveProperty(key);
  expect(JSON.stringify(h)).toBe(before);
});
it('BAE02 preserves a compliant runner even when a qualified appeal is indicated', () => {
  const result = derive(setup(0, 0));
  expect(result.kind).toBe('ready'); expect(result.compliance).toMatchObject({ kind: 'compliant', basis: 'contact_at_first_fielder_touch' });
});
it('BAE03 leaves an unconfirmed capture pending', () => {
  const h = setup(); h.fields = [h.root]; h.evidence = deriveSamePaFieldRuleEvidence({ fields: h.fields,
    batterRunnerId: 'batter', defenderIds: ['carrier'], occupiedRunnerIds: ['runner'], outsAtStart: 0 });
  expect(derive(h)).toMatchObject({ kind: 'pending', reason: 'actual_fair_catch_required' });
});
it('BAE04 does not turn secure possession without current base contact into an appeal execution', () => {
  expect(derive(setup(0, 2, 4))).toMatchObject({ kind: 'pending', reason: 'current_defender_controlled_base_contact_required' });
});
it.each(['wrong_runner', 'wrong_base', 'foreign_defender'])('BAE05 rejects %s outside original membership', fault => {
  const h: any = setup();
  if (fault === 'wrong_runner') h.indication.runnerId = 'batter';
  if (fault === 'wrong_base') h.indication.base = 'second';
  if (fault === 'foreign_defender') h.indication.defenderId = 'runner';
  expect(() => derive(h)).toThrow(/membership|original/);
});
it('BAE06 retains the original large integer clock and fractional physical cut', () => {
  const h = setup(2 ** 52), result = derive(h), end = h.evidence.physical.field.evidence.horizon;
  expect(result.kind).toBe('ready'); expect(result.moment).toEqual({ originTick: 2 ** 52, elapsedSeconds: end.elapsedSeconds, tick: end.ball.tick });
  expect(result.complianceEvidence.firstTouch.originTick).toBe(2 ** 52);
});
it.each(['horizon', 'cursor', 'response_cursor', 'custody'])('BAE07 rejects changed %s evidence at the original cut', fault => {
  const h: any = structuredClone(setup());
  if (fault === 'horizon') h.evidence.physical.field.evidence.horizon.elapsedSeconds += 0.001;
  if (fault === 'cursor') h.fields.at(-1).field.motion.cursor.moment.elapsedSeconds += 0.001;
  if (fault === 'response_cursor') h.fields.at(-1).field.motion.response.cursor = { ...h.fields.at(-1).field.motion.response.cursor,
    moment: { ...h.fields.at(-1).field.motion.response.cursor.moment, elapsedSeconds: 1.5 } };
  if (fault === 'custody') h.evidence.physical.controlWindows[0].endInclusive = false;
  expect(() => derive(h)).toThrow(/clock|cut|evidence|custody/);
});
it.each(['throw_plan_v1', 'defender_base_appeal', 'unknown_dead_ball'])('BAE08 leaves %s outside the bounded uninterrupted catch prefix', kind => {
  const h: any = structuredClone(setup()), last = h.fields.at(-1);
  h.fields.push({ ...last, source: { ...last.source, sourceId: 'unsupported', action: { kind } }, actionResult: { kind }, operationOrdinal: 3 });
  expect(derive(h)).toMatchObject({ kind: 'pending', reason: 'uninterrupted_fair_catch_prefix_required' });
});
it('BAE09 does not reuse an earlier base contact after the defender has left it', () => {
  const h = setup(0, 2, 3, 2);
  expect(h.evidence.defendersFirstBase[0].history).toMatchObject({ contactAtStart: true, contactAtHorizon: false });
  expect(derive(h)).toMatchObject({ kind: 'pending', reason: 'current_defender_controlled_base_contact_required' });
});
