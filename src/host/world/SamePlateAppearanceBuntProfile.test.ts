import { expect, it } from 'vitest';
import { actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaPhysicalEpisodeSourceInput as parse } from './SamePlateAppearancePhysicalEpisode';
import { samePaBuntProfileAvailable as available, samePaBuntProfileBindingInput } from './SamePlateAppearanceBuntProfile';
import { calculateBattingExecution } from '../../core/world/psychology/batting/BattingCommitment';
import { fixture, value } from '../../core/world/psychology/batting/BattingFixtures.test-support';
import type { DurableSamePaBattingExecutionInput } from './NativeBattingExecutionInput';

const ref = (owner: string, sourceId = owner) => ({ owner, sourceId, sourceHash: hash(['source', sourceId]), snapshotHash: hash(['snapshot', sourceId]) });
const member = { playerId: 'fixture-batter', bindingHash: hash('binding'), personHash: hash('person'), baselineSourceId: 'baseline', reservedRevision: 0,
  reservedStateHash: hash('reserved'), projectedStateHash: hash('projected') };
const binding = () => ({ kind: 'accepted_bunt_course_profile_v1', intentReference: ref('batting_execution_v1_intents'),
  viewReference: ref('pa_lifecycle_v1_execution_views'), member, modelReference: ref('world_player_batting_models'),
  calibrationReference: ref('pa_lifecycle_v1_execution_calibrations'), repertoireId: 'explicit-fixture-repertoire', repertoireVersion: 'fixture-only-v1',
  profileId: 'explicit-fixture-profile', profileVersion: 'fixture-only-v1', profileHash: hash('profile') });
const source = () => ({ sourceId: 'explicit-bunt-commitment', sourceVersion: 'fixture-only-v1', capability: 'same_pa_physical_commitment_v1',
  viewReference: ref('pa_lifecycle_v1_execution_views'), launchReference: ref('pa_physical_v1_launches'), previousOperationReference: ref('pa_physical_v1_cuts'),
  inputReference: ref('batting_execution_v1_inputs'), intentReference: ref('batting_execution_v1_intents'), buntProfileBinding: binding() });

it('BP01 an accepted physical commitment can explicitly pin the existing owned bunt profile without supplying motion or result', () => {
  const s = source();
  expect(parse(s)).toEqual(s);
  for (const extra of [{ trajectory: {} }, { contactTick: 30 }, { bunt: true }, { exitVelocity: 2 }, { profile: {} }]) {
    expect(() => parse({ ...s, buntProfileBinding: { ...s.buntProfileBinding, ...extra } })).toThrow();
  }
});

// Real Core calculation with synthetic reference shapes. These tests exercise
// binding behavior, not authentication by the Native owners.
const computed = () => {
  const nominalRequest = fixture(), s = nominalRequest.source;
  const effectiveValues = { decision: s.decisionModel, motor: { motorLatencyTicks: s.motorLatencyTicks,
    technicalTimingOffsetTicks: s.technicalTimingOffsetTicks, maximumSweetSpotSpeedMps: s.maximumSweetSpotSpeedMps },
    repertoire: { repertoireId: s.repertoireId, repertoireVersion: s.repertoireVersion, profiles: s.profiles } };
  const calculation = value(calculateBattingExecution({ nominalRequest, effectiveValues }));
  const seed = samePaBuntProfileBindingInput(binding());
  const input = { nominalRequest, effectiveValues, source: { capability: 'owned_in_flight_same_pa_batting_execution_input_v1',
    intentReference: seed.intentReference, viewReference: seed.viewReference, member,
    calibrationReferences: [{ route: 'batter_swing', calibrationReference: seed.calibrationReference }] } } as unknown as DurableSamePaBattingExecutionInput;
  const profile = s.profiles.find(p => p.profile.profileId === calculation.commitment!.profileId)!.profile;
  const explicit = { ...seed, repertoireId: s.repertoireId, repertoireVersion: s.repertoireVersion,
    profileId: profile.profileId, profileVersion: profile.version, profileHash: hash(profile) };
  const basis = { intentReference: seed.intentReference, originalIntent: { version: 'original_batting_intent_v1' as const,
    actorSourceId: 'explicit-fixture-actor', attempt: 'bunt' as const }, input, modelReference: seed.modelReference, calculation };
  return { explicit, basis };
};
it('BP02 a bunt tag alone stays unavailable and an exact explicit binding preserves the existing calculated curve', () => {
  const { explicit, basis } = computed(), before = hash(basis);
  expect(basis.calculation.commitment!.action).toBe('SWING');
  expect(available(undefined, basis)).toBe(false);
  expect(available(explicit, basis)).toBe(true);
  expect(hash(basis)).toBe(before);
  expect(available(undefined, { ...basis, originalIntent: { ...basis.originalIntent, attempt: 'ordinary_swing' } })).toBe(true);
});
it('BP03 a declaration cannot borrow another intent, Person, workload view, model, calibration, repertoire or profile', () => {
  const { explicit, basis } = computed();
  const changes = [
    { intentReference: { ...explicit.intentReference, sourceId: 'other-intent' } },
    { viewReference: { ...explicit.viewReference, snapshotHash: hash('other-view') } },
    { member: { ...member, personHash: hash('other-person') } },
    { member: { ...member, projectedStateHash: hash('earlier-work') } },
    { modelReference: { ...explicit.modelReference, snapshotHash: hash('other-model') } },
    { calibrationReference: { ...explicit.calibrationReference, sourceId: 'older-calibration' } },
    { repertoireId: 'another-repertoire' }, { repertoireVersion: 'another-version' },
    { profileId: 'unselected-profile' }, { profileVersion: 'another-version' }, { profileHash: hash('same-name-different-motion') },
  ];
  for (const changed of changes) expect(() => available({ ...explicit, ...changed }, basis)).toThrow(/binding differs/);
  const altered = { ...basis, calculation: { ...basis.calculation, effectiveValues: { ...basis.calculation.effectiveValues,
    motor: { ...basis.calculation.effectiveValues.motor, technicalTimingOffsetTicks: basis.calculation.effectiveValues.motor.technicalTimingOffsetTicks + 1 } } } };
  expect(() => available(explicit, altered)).toThrow(/binding differs/);
});
it('BP04 a binding cannot relabel an ordinary commitment or a TAKE as an executed bunt', () => {
  const { explicit, basis } = computed();
  expect(() => available(explicit, { ...basis, originalIntent: { ...basis.originalIntent, attempt: 'ordinary_swing' } })).toThrow(/actual bunt commitment/);
  const take = { ...basis, calculation: { ...basis.calculation, commitment: { ...basis.calculation.commitment!, action: 'TAKE' as const, trajectory: null } } };
  expect(() => available(explicit, take)).toThrow(/actual bunt commitment/);
  expect(available(undefined, take)).toBe(true);
});
it('BP05 malformed or active declarations reject without executing accessors', () => {
  const s = source();
  for (const changed of [undefined, null, { ...binding(), profileHash: 'bad' }, { ...binding(), member: null },
    { ...binding(), modelReference: ref('world_player_body_materializations') }]) {
    expect(() => parse({ ...s, buntProfileBinding: changed })).toThrow();
  }
  let accessed = false;
  const active = binding(); Object.defineProperty(active, 'profileHash', { enumerable: true, get() { accessed = true; return hash('profile'); } });
  expect(() => parse({ ...s, buntProfileBinding: active })).toThrow(); expect(accessed).toBe(false);
});
