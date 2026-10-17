import { expect, it } from 'vitest';
import { originalTeamMotorSelectionsV1 } from './SamePlateAppearanceTeamMotorSelectionV1';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';

// Structural seam tests only: these rows are not Native Source admissions.
const fixture = () => {
  const ids = Array.from({ length: 9 }, (_, i) => `p${i}`), rows: any[] = [];
  const field = { motion: { actors: [{ playerId: 'p0', primitive: { startTick: 0, endTick: 1000 } }],
    carrierPlayerId: null, world: { kind: 'moving', moment: { originTick: 0, elapsedSeconds: 0 } } } };
  const append = (kind: string | undefined, actionResult: any, elapsedSeconds = 0) => {
    const source = { sourceId: `row-${rows.length}`, sourceVersion: 'structural-only', ...(kind ? { action: { kind } } : {}) };
    const row: any = { kind: 'same_pa_physical_field_step_v1', source, field: structuredClone(field), actionResult };
    row.field.motion.world.moment.elapsedSeconds = elapsedSeconds; rows.push(row); return row;
  };
  const ref = (row: any) => reference('pa_physical_v1_field_steps', row);
  const decisions = ids.map(playerId => {
    const observation = append('defender_observation_v1', { kind: 'defender_observation_v1', playerId });
    return append('defender_decision_v1', { kind: 'defender_decision_v1', playerId, observationReference: ref(observation) });
  });
  const team = append('defender_team_selection_v1', { kind: 'defender_team_selection_v1', plan: { assignments: ids.map(playerId => ({ playerId })) } });
  const actors = decisions.map(decision => append('defender_actor_selection_v1', { kind: 'defender_actor_selection_v1',
    playerId: decision.actionResult.playerId, teamSelectionReference: ref(team), originalDecisionReference: ref(decision),
    observationReference: decision.actionResult.observationReference }));
  const selections = actors.map(actor => ({ member: { playerId: actor.actionResult.playerId }, decisionReference: ref(actor) }));
  return { ids, rows, selections, actors, append, ref };
};
it('preserves legacy selections and admits one complete owned team with an unchanged-body due wait', () => {
  const h = fixture();
  expect(originalTeamMotorSelectionsV1(h.rows.slice(0, 18) as any, [{ member: { playerId: 'p0' }, decisionReference: h.ref(h.rows[1]) }] as any, h.ids)).toBeNull();
  h.append(undefined, undefined, 0.001);
  expect(originalTeamMotorSelectionsV1(h.rows as any, h.selections as any, h.ids)?.map(v => v.playerId)).toEqual(h.ids);
});
it('rejects a team subset, mixed old decisions, duplicate members and a different team', () => {
  for (const mutate of [
    (h: ReturnType<typeof fixture>) => h.selections.pop(),
    (h: ReturnType<typeof fixture>) => { h.selections[0].decisionReference = h.ref(h.rows[1]); },
    (h: ReturnType<typeof fixture>) => { h.selections[0] = h.selections[1]; },
    (h: ReturnType<typeof fixture>) => { h.actors[0].actionResult.teamSelectionReference = h.ref(h.rows[0]); h.selections[0].decisionReference = h.ref(h.actors[0]); },
  ]) { const h = fixture(); mutate(h); expect(() => originalTeamMotorSelectionsV1(h.rows as any, h.selections as any, h.ids)).toThrow(); }
});
it('rejects superseding perception, decisions, team, motor, catch, throw or a physical boundary', () => {
  for (const kind of ['defender_observation_v1', 'defender_decision_v1', 'defender_team_selection_v1', 'defender_motion_v1', 'defender_catch_response_v1', 'throw_plan_v1']) {
    const h = fixture(); h.append(kind, { kind, playerId: 'p0', plan: { assignments: h.ids.map(playerId => ({ playerId })) } });
    expect(() => originalTeamMotorSelectionsV1(h.rows as any, h.selections as any, h.ids)).toThrow();
  }
  for (const mutate of [
    (row: any) => { row.field.motion.world.kind = 'boundary'; },
    (row: any) => { row.field.motion.carrierPlayerId = 'p0'; },
    (row: any) => { row.field.motion.actors[0].primitive.startTick = 1; },
    (row: any) => { row.field.motion.world.moment.originTick = 1; },
  ]) { const h = fixture(), wait = h.append(undefined, undefined, 0.001); mutate(wait);
    expect(() => originalTeamMotorSelectionsV1(h.rows as any, h.selections as any, h.ids)).toThrow(); }
});
it('rejects backwards due wait and changed body, custody or time in an actor metadata sibling', () => {
  const h = fixture(); h.append(undefined, undefined, 0.001); h.append(undefined, undefined, 0.0005);
  expect(() => originalTeamMotorSelectionsV1(h.rows as any, h.selections as any, h.ids)).toThrow(/clock changed/);
  for (const mutate of [
    (row: any) => { row.field.motion.carrierPlayerId = 'p3'; },
    (row: any) => { row.field.motion.actors[0].primitive.endTick = 999; },
    (row: any) => { row.field.motion.world.moment.elapsedSeconds = 0.0001; },
  ]) {
    const h = fixture(); mutate(h.actors[4]); h.selections[4].decisionReference = h.ref(h.actors[4]);
    expect(() => originalTeamMotorSelectionsV1(h.rows as any, h.selections as any, h.ids)).toThrow();
  }
});
it('rejects a received catch even if the same actor selection is republished afterward', () => {
  const h = fixture(), value = structuredClone(h.actors[4].actionResult);
  h.append('defender_catch_response_v1', { kind: 'defender_catch_response_v1', playerId: 'p4' });
  const replacement = h.append('defender_actor_selection_v1', value);
  h.selections[4].decisionReference = h.ref(replacement);
  expect(() => originalTeamMotorSelectionsV1(h.rows as any, h.selections as any, h.ids)).toThrow(/catch response/);
});
