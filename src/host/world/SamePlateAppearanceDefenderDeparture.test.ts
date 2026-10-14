import { expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from '../../core/rules/RuleProfile';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { battedVenueLegalCoveragePolicyInput, bindSamePaVenueLegalCoveragePolicy } from './BattedVenueLegalCoveragePolicy';
import { deriveSamePaDefenderDeparturePurpose, deriveSamePaDefenderDepartureEvidence,
  deriveSamePaDefenderDepartureCensus, samePaDefenderDeparturePurposeInput } from './SamePlateAppearanceDefenderDeparture';
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const fieldRef = (f: any) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
const needed = ['P', '1B', '2B', '3B', 'SS'];
// Structural authenticated-pair seam with original retained accelerated curves.
// This fixture is not a Native SQLite admission or a generated departure route.
const setup = () => {
  const fixture = { game_id: 'game', fixture_event_id: 'fixture', venue_id: 'venue' };
  const actor: any = { source: { gameId: 'game' }, fixtureHash: hash(fixture),
    match: { playId: 1, ruleProfileId: NPB_2026_RULE_PROFILE.id, outs: 2 },
    binding: { careerId: 'career', fixtureEventId: 'fixture', gameDay: 1 },
    world: { defenders: positions.map(registeredPosition => ({ playerId: registeredPosition, registeredPosition })) },
    defenderBindings: positions.map(playerId => ({ playerId, personId: playerId + ':person' })),
    defenderPersons: positions.map(playerId => ({ playerId, personId: playerId + ':person' })) };
  const policy: any = { sourceId: 'venue', sourceVersion: 'test-v1', version: 'batted_venue_legal_coverage_policy_v1',
    gameId: 'game', careerId: 'career', playId: 1, physicalPitchSourceId: 'pitch', fixtureEventId: 'fixture', venueId: 'venue',
    baseFieldSourceId: 'root', worldModelSourceId: 'model', worldModelSourceVersion: 'v1', responseModelSourceId: 'response',
    responseModelSourceVersion: 'v1', geometryBindingHash: hash('geometry'), availableAtDay: 1,
    rulePolicy: { version: 'closed_interior_venue_legal_regions_v1', ruleProfileId: NPB_2026_RULE_PROFILE.id,
      rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision, regions: [{ regionId: 'known', classification: 'inside_playable_region',
        minimum: { x: -100, y: -10, z: -100 }, maximum: { x: 100, y: 10, z: 100 } }] },
    defenseExits: [{ exitId: 'dugout', kind: 'bench', minimum: { x: -5, y: -2, z: 1 }, maximum: { x: -1, y: 4, z: 20 } }] };
  const actors = ['batter', ...positions].flatMap((playerId, index) => roles.map(role => ({ playerId, primitive: {
    role, radius: 0.1, startTick: 0, endTick: 10_000, ticksPerSecond: 1000,
    startCenter: { x: 2, y: role.endsWith('foot') ? 0 : 1, z: 3 + index },
    startVelocity: { x: -1, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } })));
  const ball = { tick: 0, position: { x: 20, y: 1, z: 20 }, velocity: { x: 0, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } };
  const field = (time: number) => ({ motion: { actors: clone(actors), world: { moment: { originTick: 0, elapsedSeconds: time, ball: { ...ball, tick: time * 1000 } } } } });
  const root: any = { kind: 'same_pa_physical_field_root_v1', source: { sourceId: 'root', sourceVersion: 'test-v1',
    launchReference: { sourceId: 'pitch' }, venueLegalCoveragePolicy: policy }, physicalPitchSourceId: 'pitch', operationOrdinal: 0,
    lineage: { gameId: 'game', careerId: 'career', playId: 1 }, evaluationTick: 0, geometryBindingHash: hash('geometry'),
    response: { world: { parameters: { ticksPerSecond: 1000 }, flight: { initialBall: ball }, actors }, actors: actors.map(a => ({ playerId: a.playerId, profile: { role: a.primitive.role } })) },
    geometry: { baseGeometry: { field: { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } } } }, field: field(0) };
  root.venueLegalCoveragePolicyBinding = bindSamePaVenueLegalCoveragePolicy(root.source, { actor, fixture, geometryBindingHash: hash('geometry'),
    model: { sourceId: 'model', sourceVersion: 'v1', gameId: 'game', careerId: 'career', fixtureEventId: 'fixture', venueId: 'venue' },
    responseModel: { sourceId: 'response', sourceVersion: 'v1', gameId: 'game', careerId: 'career', fixtureEventId: 'fixture', venueId: 'venue' } } as any);
  const fields: any[] = [root];
  const member = (playerId: string) => ({ playerId, bindingHash: hash(actor.defenderBindings.find((b: any) => b.playerId === playerId)),
    personHash: hash(actor.defenderPersons.find((b: any) => b.playerId === playerId)), baselineSourceId: playerId + ':baseline',
    reservedRevision: 0, reservedStateHash: hash('reserved'), projectedStateHash: hash('projected') });
  const append = (time: number, action?: any, actionResult?: any) => {
    const previous = fields.at(-1), value = { kind: 'same_pa_physical_field_step_v1', source: { sourceId: 'step:' + fields.length,
      sourceVersion: 'test-v1', throughTick: time * 1000, fieldRootReference: fieldRef(root), previousFieldReference: fieldRef(previous), previousOperationReference: fieldRef(previous), ...(action ? { action } : {}) },
      lineage: root.lineage, physicalPitchSourceId: 'pitch', operationOrdinal: fields.length, evaluationTick: time * 1000, field: field(time), ...(actionResult ? { actionResult } : {}) };
    fields.push(value); return value;
  };
  const declare = (playerId: string, exitId = 'dugout') => {
    const previous = fields.at(-1), action = { kind: 'defender_departure_purpose_v1', member: member(playerId), exitId };
    const value = append(previous.field.motion.world.moment.elapsedSeconds, action);
    value.actionResult = deriveSamePaDefenderDeparturePurpose(value.source as any, root, previous, actor); return value;
  };
  const pair = (): any => ({ kind: 'same_pa_field_rule_read_pair_v1', actor, fields, view: { lineage: root.lineage },
    value: { fieldReferences: fields.map(fieldRef), physicalOperationReference: fieldRef(fields.at(-1)) } });
  return { root, actor, actors, policy, fields, member, append, declare, pair };
};
it('DD01 accepts explicit source-owned venue exits without changing old policy shape', () => {
  const h = setup(); expect(battedVenueLegalCoveragePolicyInput(h.policy).defenseExits).toEqual(h.policy.defenseExits);
  const old = clone(h.policy); delete old.defenseExits; expect(battedVenueLegalCoveragePolicyInput(old)).not.toHaveProperty('defenseExits');
  for (const exits of [[], [h.policy.defenseExits[0], h.policy.defenseExits[0]], [{ ...h.policy.defenseExits[0], kind: 'foul_ground' }],
    [{ ...h.policy.defenseExits[0], maximum: { x: -5, y: 4, z: 20 } }]]) expect(() => battedVenueLegalCoveragePolicyInput({ ...h.policy, defenseExits: exits })).toThrow();
});
it('DD02 binds current purpose without movement or retrospective timestamps', () => {
  const h = setup(), before = clone(h.root.field), d = h.declare('P');
  expect(d.actionResult).toMatchObject({ kind: 'defender_departure_purpose_v1', playerId: 'P', exitId: 'dugout', declaredAt: { elapsedSeconds: 0 } });
  expect(d.field).toEqual(before); expect(deriveSamePaDefenderDepartureEvidence(h.pair()).kind).toBe('pending');
  expect(() => samePaDefenderDeparturePurposeInput({ ...d.source.action, declaredAt: 0 } as any)).toThrow();
  expect(() => h.declare('P', 'invented')).toThrow(/exit/);
  const later = setup(); later.append(5); expect(() => later.declare('P')).toThrow(/already/);
});
it('DD03 five original infield roles departing toward an accepted exit yield only an upper bound', () => {
  const h = setup(); needed.forEach(id => h.declare(id));
  h.append(1); expect(deriveSamePaDefenderDepartureEvidence(h.pair()).kind).toBe('pending');
  h.append(5); const before = JSON.stringify(h.fields), result = deriveSamePaDefenderDepartureEvidence(h.pair());
  expect(result).toMatchObject({ kind: 'same_pa_defense_departure_bound_v1', closedNoLaterThan: { elapsedSeconds: 5, tick: 5000 } });
  if (result.kind !== 'same_pa_defense_departure_bound_v1') throw new Error('bound missing');
  expect(result.purposeReferences).toHaveLength(5); expect(result.fieldReference).toEqual(fieldRef(h.fields.at(-1)));
  expect(result).not.toHaveProperty('closedAtElapsedSeconds'); expect(JSON.stringify(h.fields)).toBe(before);
});
it('DD04 missing original infield purpose and source-forged role sets remain unproved', () => {
  const h = setup(); needed.slice(1).forEach(id => h.declare(id)); h.append(5);
  expect(deriveSamePaDefenderDepartureEvidence(h.pair()).kind).toBe('pending');
  h.actor.world.defenders[0].registeredPosition = 'LF'; expect(() => deriveSamePaDefenderDepartureEvidence(h.pair())).toThrow(/role/);
});
it('DD05 fair-line contact and a single retained foot still in fair cannot certify departure', () => {
  const h = setup(); needed.forEach(id => h.declare(id)); h.append(2.1);
  expect(deriveSamePaDefenderDepartureEvidence(h.pair()).kind).toBe('pending');
  const last = h.append(5), rightFoot = last.field.motion.actors.find(a => a.playerId === 'P' && a.primitive.role === 'right_foot');
  if (!rightFoot) throw new Error('original pitcher right foot missing');
  rightFoot.primitive.startVelocity.x = 0;
  expect(deriveSamePaDefenderDepartureEvidence(h.pair()).kind).toBe('pending');
});
it.each(['defender_decision_v1', 'defender_catch_response_v1', 'throw_plan_v1'])('DD06 later %s invalidates unexecuted departure purpose', kind => {
  const h = setup(); needed.forEach(id => h.declare(id));
  h.append(0, { kind, member: h.member('P') }, { kind, playerId: 'P' }); h.append(5);
  expect(deriveSamePaDefenderDepartureEvidence(h.pair()).kind).toBe('pending');
  expect(deriveSamePaDefenderDepartureCensus(h.fields).purposes.find((p: any) => p.purpose.playerId === 'P')!.status).toBe(kind === 'throw_plan_v1' ? 'superseded' : 'active');
  if (kind !== 'throw_plan_v1') expect(deriveSamePaDefenderDepartureCensus(h.fields).sources.find(s => s.intents.some(i => i.actorId === 'P'))).toBeDefined();
});
it('DD07 accepted retained progress may prove the bound, but same-cut changes and foreign hashes cannot', () => {
  const h = setup(); needed.forEach(id => h.declare(id));
  const p = h.pair(); p.value.fieldReferences[1].snapshotHash = hash('forged'); expect(() => deriveSamePaDefenderDepartureEvidence(p)).toThrow(/prefix/);
  const d = h.fields[1]; d.field.motion.actors[0].primitive.startCenter.x = 42;
  expect(() => deriveSamePaDefenderDepartureCensus(h.fields)).toThrow(/physical/);
});

it('DD08 catcher remains outside the departure census, and later new motor adoption cannot reuse a departure label', () => {
  const h = setup();
  for (const actors of [h.actors, h.root.field.motion.actors]) for (const part of actors.filter((a: any) => a.playerId === 'C')) {
    part.primitive.startCenter.x = -0.5; part.primitive.startVelocity.x = -0.5;
  }
  needed.forEach(id => h.declare(id)); h.append(5);
  expect(deriveSamePaDefenderDepartureEvidence(h.pair()).kind).toBe('same_pa_defense_departure_bound_v1');
  const other = setup(); needed.forEach(id => other.declare(id));
  other.append(0, { kind: 'defender_motion_v1', selections: [{ member: other.member('P') }] }, { kind: 'defender_motion_v1' }); other.append(5);
  expect(deriveSamePaDefenderDepartureEvidence(other.pair()).kind).toBe('pending');
});
it('DD09 an established departure bound survives later contrary decisions and does not backdate earlier cuts', () => {
  const h = setup(); needed.forEach(id => h.declare(id)); const prefix = clone(h.pair());
  expect(deriveSamePaDefenderDepartureEvidence(prefix).kind).toBe('pending');
  const arrived = h.append(5), before = deriveSamePaDefenderDepartureEvidence(h.pair());
  h.append(5, { kind: 'defender_decision_v1', member: h.member('P') }, { kind: 'defender_decision_v1', playerId: 'P' });
  expect(deriveSamePaDefenderDepartureEvidence(h.pair())).toEqual(before);
  if (before.kind !== 'same_pa_defense_departure_bound_v1') throw new Error('bound missing');
  expect(before.fieldReference).toEqual(fieldRef(arrived));
  h.root.source.venueLegalCoveragePolicy.defenseExits[0].maximum.x = 0;
  expect(() => deriveSamePaDefenderDepartureEvidence(h.pair())).toThrow(/binding/);
});
it('DD10 explicit purpose stays live work until individual owned arrival or genuine supersession', () => {
  const h = setup(), declaration = h.declare('P');
  const live = deriveSamePaDefenderDepartureCensus(h.fields);
  expect(live.purposes[0].status).toBe('active'); expect(live.sources).toHaveLength(1);
  expect(live.sources[0].intents).toMatchObject([{ kind: 'issued_intent', actorId: 'P', dueTick: 0 }]);
  expect(live.sources[0]).not.toHaveProperty('completion');
  h.append(1); expect(deriveSamePaDefenderDepartureCensus(h.fields).sources[0]).not.toHaveProperty('completion');
  const arrival = h.append(5), completed = deriveSamePaDefenderDepartureCensus(h.fields);
  expect(completed.purposes[0].status).toBe('completed'); expect(completed.sources[0].intents).toEqual([]);
  expect(completed.sources[0].completion).toEqual({ completedAtTick: 5000, basisEventId: arrival.source.sourceId });
  expect(completed.purposes[0].purposeReference).toEqual(fieldRef(declaration));
  expect(deriveSamePaDefenderDepartureEvidence(h.pair()).kind).toBe('pending');
  const other = setup(); other.declare('P'); const later = other.append(0, { kind: 'defender_motion_v1', selections: [{ member: other.member('P') }] }, { kind: 'defender_motion_v1' });
  const superseded = deriveSamePaDefenderDepartureCensus(other.fields);
  expect(superseded.sources[0].intents).toEqual([]);
  expect(superseded.sources[0].completion).toEqual({ completedAtTick: 0, basisEventId: later.source.sourceId });
});
it('DD11 an actually issued received response may retire a pending departure intent', () => {
  const h = setup(); h.declare('P');
  const next = h.append(0, { kind: 'defender_catch_response_v1', member: h.member('P') });
  next.actionResult = { kind: 'defender_catch_response_v1', playerId: 'P', issuedBySourceId: next.source.sourceId,
    replan: { selectedAt: { originTick: 0, elapsedSeconds: 0, tick: 0 } } };
  const census = deriveSamePaDefenderDepartureCensus(h.fields);
  expect(census.purposes[0].status).toBe('superseded'); expect(census.sources[0].intents).toEqual([]);
  expect(census.sources[0].completion?.basisEventId).toBe(next.source.sourceId);
});

it('DD12 actual departure toward the accepted exit is proved before bench arrival', () => {
  const h = setup(); needed.forEach(id => h.declare(id)); h.append(2.5);
  const bound = deriveSamePaDefenderDepartureEvidence(h.pair());
  expect(bound).toMatchObject({ kind: 'same_pa_defense_departure_bound_v1', closedNoLaterThan: { elapsedSeconds: 2.5 } });
  const census = deriveSamePaDefenderDepartureCensus(h.fields);
  expect(census.sources.every(s => s.completion?.completedAtTick === 2500)).toBe(true);
  const away = setup(); away.policy.defenseExits[0].minimum.x = 4; away.policy.defenseExits[0].maximum.x = 8;
  away.root.venueLegalCoveragePolicyBinding = { ...away.root.venueLegalCoveragePolicyBinding, policyHash: hash(away.policy) };
  needed.forEach(id => away.declare(id)); away.append(2.5);
  expect(deriveSamePaDefenderDepartureEvidence(away.pair()).kind).toBe('pending');
  expect(deriveSamePaDefenderDepartureCensus(away.fields).sources.every(s => s.intents.length === 1)).toBe(true);
});
