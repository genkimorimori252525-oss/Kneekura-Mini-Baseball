import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqliteSamePlateAppearanceLiveBallStateStore } from './SqliteSamePlateAppearanceLiveBallStateStore';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaOfficialSourceReference, type AcceptedSamePaOfficialPerson } from './SamePlateAppearanceCatchCommunicationSource';
import { samePaLiveBallActionInput, samePaLiveBallAssignmentInput, samePaLiveBallOriginalsInput,
  type AcceptedSamePaLiveBallAction, type AcceptedSamePaLiveBallAssignment } from './SamePlateAppearanceLiveBallStateSource';
import { deriveSamePaLiveBallPlayProof, deriveSamePaLiveBallPostPlayStatus } from './SamePlateAppearanceLiveBallState';
const ref = <T extends string>(owner: T) => ({ owner, sourceId: owner, sourceHash: hash(owner), snapshotHash: hash(owner) });
const original = () => {
  const person: AcceptedSamePaOfficialPerson = { sourceId: 'person', sourceVersion: 'v1', capability: 'accepted_original_umpire_person_v1',
    careerId: 'career', officialId: 'umpire', personId: 'umpire-person' };
  const assignment: AcceptedSamePaLiveBallAssignment = { sourceId: 'assignment', sourceVersion: 'v1', capability: 'same_pa_explicit_live_ball_assignment_v1',
    role: 'plate_umpire', enrollmentReference: ref('same_pa_enrollments'), gameId: 'game', playId: 1, physicalPitchSourceId: 'pitch',
    officialId: person.officialId, personId: person.personId, personReference: samePaOfficialSourceReference(person),
    policy: { sourceId: 'policy', sourceVersion: 'v1', ruleProfileId: 'npb-2026', kind: 'accepted_original_live_ball_action_v1' } };
  const source: AcceptedSamePaLiveBallAction = { sourceId: 'play', sourceVersion: 'v1', capability: 'same_pa_explicit_live_ball_action_v1',
    enrollmentReference: assignment.enrollmentReference, viewReference: ref('pa_lifecycle_v1_execution_views'),
    assignmentReference: samePaOfficialSourceReference(assignment), officialId: person.officialId, personId: person.personId,
    declaration: 'play', priorStateReference: null };
  return { source, person, assignment };
};
it('LB01 accepts only explicit declaration identity and separate original plate-umpire capability', () => {
  const h = original();
  expect(samePaLiveBallActionInput(h.source)).toEqual(h.source);
  expect(samePaLiveBallOriginalsInput({ assignment: h.assignment, person: h.person }, h.source)).toEqual({ assignment: h.assignment, person: h.person });
  expect(samePaLiveBallActionInput({ ...h.source, declaration: 'time' }).declaration).toBe('time');
  for (const changed of [{ capability: 'same_pa_explicit_catch_assignment_v1' }, { role: 'base_umpire' }, { policy: null }])
    expect(() => samePaLiveBallAssignmentInput({ ...h.assignment, ...changed })).toThrow();
});
it('LB02 caller timestamps, backdates, live flags and completeness claims never enter a request', () => {
  const { source } = original();
  for (const extra of [{ calledAt: { originTick: 0, tick: 0, elapsedSeconds: 0 } }, { occurredAt: 0 }, { live: true },
    { state: 'live' }, { complete: true }, { playOccurredBeforeCatch: true }, { pitcherOnPlate: true }, { hasBall: true }])
    expect(() => samePaLiveBallActionInput({ ...source, ...extra })).toThrow(/Native-owned/);
  expect(() => samePaLiveBallActionInput({ ...source, declaration: 'automatic_time' })).toThrow();
});
it('LB03 original identity bindings reject changed Person, assignment hash and prior-state aliases', () => {
  const h = original();
  expect(() => samePaLiveBallOriginalsInput({ assignment: h.assignment, person: { ...h.person, personId: 'other' } }, h.source)).toThrow();
  expect(() => samePaLiveBallOriginalsInput({ assignment: { ...h.assignment, physicalPitchSourceId: 'other' }, person: h.person }, h.source)).toThrow();
  expect(() => samePaLiveBallActionInput({ ...h.source, priorStateReference: { ...ref('pa_live_ball_v1_actions'), sourceId: h.source.sourceId } })).toThrow();
  expect(() => samePaLiveBallActionInput({ ...h.source, priorStateReference: ref('pa_catch_v1_work') })).toThrow();
});
/** Pure physical inputs test the calculation seam, not Native source ownership. */
const physical = () => {
  const moment = { originTick: 10, elapsedSeconds: 1, ball: { tick: 1_000_010, position: { x: 0, y: 1, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } };
  const cursor = { moment, previousContacts: [] };
  const actors = (['left_foot', 'right_foot'] as const).map(role => ({ playerId: 'pitcher', primitive: { role, radius: 0.1,
    startTick: 10, endTick: 1_000_010, ticksPerSecond: 1_000_000, startCenter: { x: 0, y: 0, z: 0 },
    startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } }));
  const value = { pitcherId: 'pitcher', plate: { region: { center: { x: 0, z: 0 }, halfSize: { x: 0.3, z: 0.15 }, rotationRadians: 0 }, surfaceHeightMeters: 0 },
    field: { field: { motion: { world: { moment }, cursor, response: { kind: 'carried', cursor }, carrierPlayerId: 'pitcher' } } },
    evidence: { physical: { field: { evidence: { horizon: moment } }, segments: [{ originTick: 10, startElapsedSeconds: 0, endElapsedSeconds: 1, actors }],
      controlWindows: [{ playerId: 'pitcher', startElapsedSeconds: 0.5, endElapsedSeconds: 1, endInclusive: true }] }, rule: { possessionEvidence: { pending: [] } } } };
  return value;
};
const proof = (v: ReturnType<typeof physical>) => deriveSamePaLiveBallPlayProof(v as unknown as Parameters<typeof deriveSamePaLiveBallPlayProof>[0]);
it('LB04 actual secure pitcher and physical foot/plate intersection prove Play only at this exact cut', () => {
  const h = physical(), result = proof(h);
  expect(result).toMatchObject({ kind: 'original_pitcher_secure_on_plate_v1', pitcherId: 'pitcher',
    moment: { originTick: 10, elapsedSeconds: 1, tick: 1_000_010 }, baseContactHistory: { contactAtHorizon: true } });
  expect(result).not.toHaveProperty('liveFromPitch');
  expect(Object.isFrozen(result)).toBe(true);
});
it('LB05 a fielder, unconfirmed capture, missing or just-released control cannot restart Play', () => {
  const other = physical(); other.field.field.motion.carrierPlayerId = 'fielder';
  expect(proof(other)).toMatchObject({ kind: 'pending', reason: 'original_pitcher_secure_custody_required' });
  const released = physical(); released.evidence.physical.controlWindows[0].endInclusive = false;
  expect(proof(released)).toMatchObject({ kind: 'pending', reason: 'original_pitcher_current_secure_custody_required' });
  const absent = physical(); absent.evidence.physical.controlWindows = [];
  expect(proof(absent)).toMatchObject({ kind: 'pending', reason: 'original_pitcher_current_secure_custody_required' });
});
it('LB06 nominal pitcher position is insufficient when both actual feet miss or leave the plate', () => {
  const h = physical(); h.evidence.physical.segments[0].actors.forEach(a => { a.primitive.startCenter.x = 2; });
  expect(proof(h)).toMatchObject({ kind: 'pending', reason: 'original_pitcher_actual_plate_contact_required' });
  const elevated = physical(); elevated.evidence.physical.segments[0].actors.forEach(a => { a.primitive.startCenter.y = 0.1; });
  expect(proof(elevated)).toMatchObject({ kind: 'pending', reason: 'original_pitcher_actual_plate_contact_required' });
  const departed = physical(); departed.evidence.physical.segments[0].actors.forEach(a => { a.primitive.startVelocity.x = 2; });
  expect(proof(departed)).toMatchObject({ kind: 'pending', reason: 'original_pitcher_actual_plate_contact_required' });
  const incomplete = physical(); incomplete.evidence.physical.segments[0].actors.pop();
  expect(() => proof(incomplete)).toThrow(/feet/);
});
it('LB07 physical clock and owned custody mirrors must identify the same cut', () => {
  const h = physical(); h.evidence.physical.field.evidence.horizon = structuredClone(h.evidence.physical.field.evidence.horizon);
  h.evidence.physical.field.evidence.horizon.elapsedSeconds += 0.00000001;
  expect(() => proof(h)).toThrow(/physical cut/);
});
it('LB08 actual later Play starts live coverage at its own moment without backfilling an uncertain past', () => {
  const point = { classification: 'inside_playable_region', regionIds: ['field'] };
  const interval = (start: number, end: number, classification: string) => ({ segmentIndex: 0,
    startElapsedSeconds: start, endElapsedSeconds: end, classification, regionIds: [], start: point, end: point });
  const venue = { input: { originTick: 10 }, coverage: { intervals: [interval(0, 1, 'unresolved')] }, carrierCoverage: [], unresolvedCarrierSpans: [] };
  const status = (v: typeof venue) => deriveSamePaLiveBallPostPlayStatus(v as unknown as Parameters<typeof deriveSamePaLiveBallPostPlayStatus>[0],
    { originTick: 10, elapsedSeconds: 1, tick: 1_000_010 });
  expect(status(venue)).toEqual({ status: 'live', reason: null });
  const later = { ...venue, coverage: { intervals: [...venue.coverage.intervals, interval(1, 2, 'unresolved')] } };
  expect(status(later)).toEqual({ status: 'unknown', reason: 'original_post_play_legal_coverage_required' });
  later.coverage.intervals[1].classification = 'inside_playable_region';
  expect(status(later)).toEqual({ status: 'live', reason: null });
});
it('LB09 carried and glove-constrained geometry outside needs entry semantics while a free ball outside proves dead', () => {
  const point = { classification: 'inside_playable_region', regionIds: ['field'] };
  const interval = { segmentIndex: 0, startElapsedSeconds: 1, endElapsedSeconds: 2,
    classification: 'inside_playable_region', regionIds: ['field'], start: point, end: point };
  const venue = { input: { originTick: 10 }, coverage: { intervals: [interval] },
    fieldSegments: [{ carrierPlayerId: 'pitcher' as string | null, constraint: 'carried' as 'free' | 'carried' | 'glove_constraint' }],
    carrierCoverage: [{ coverage: { intervals: [{ ...interval, classification: 'out_of_play' }] } }], unresolvedCarrierSpans: [] };
  const status = () => deriveSamePaLiveBallPostPlayStatus(venue as unknown as Parameters<typeof deriveSamePaLiveBallPostPlayStatus>[0],
    { originTick: 10, elapsedSeconds: 1, tick: 1_000_010 });
  expect(status()).toEqual({ status: 'unknown', reason: 'original_carrier_dead_ball_entry_semantics_required' });
  venue.carrierCoverage[0].coverage.intervals[0].classification = 'unresolved';
  expect(status()).toEqual({ status: 'unknown', reason: 'original_post_play_legal_coverage_required' });
  venue.fieldSegments[0].carrierPlayerId = null; venue.coverage.intervals[0].classification = 'out_of_play';
  venue.fieldSegments[0].constraint = 'glove_constraint';
  expect(status()).toEqual({ status: 'unknown', reason: 'original_carrier_dead_ball_entry_semantics_required' });
  venue.fieldSegments[0].constraint = 'free';
  expect(status()).toEqual({ status: 'dead', reason: 'original_out_of_play_occurrence' });
});
it('LB10 Native absent action/assignment preserves an uninitialized world and does not create an action table', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const directory = mkdtempSync(join(tmpdir(), 'same-pa-live-ball-')), path = join(directory, 'world.sqlite');
  const inspect = new DatabaseSync(path);
  inspect.exec('CREATE TABLE initial_world(ball TEXT); INSERT INTO initial_world VALUES(NULL)');
  const before = inspect.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all();
  const h = original(), owner = openSqliteSamePlateAppearanceLiveBallStateStore(path, {
    readAcceptedAction: id => id === 'time' ? { ...h.source, sourceId: 'time', declaration: 'time' } : null,
    readAcceptedAssignment: () => null, readAcceptedOfficialPerson: () => null,
  });
  try {
    expect(owner.accept('absent')).toEqual({ kind: 'pending', reason: 'accepted_explicit_live_ball_action_missing' });
    expect(owner.accept('time')).toEqual({ kind: 'pending', reason: 'original_plate_umpire_assignment_and_person_required' });
    expect(owner.read('absent')).toBeNull();
    expect(inspect.prepare('SELECT * FROM main.sqlite_master ORDER BY name').all()).toEqual(before);
    expect(inspect.prepare('SELECT ball FROM initial_world').get()!.ball).toBeNull();
  } finally { owner.close(); inspect.close(); rmSync(directory, { recursive: true }); }
});
