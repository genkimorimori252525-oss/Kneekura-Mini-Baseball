import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase, readSamePaLifecycleRecordFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { openSqliteSamePlateAppearanceDispatchStore, readSamePaPreparedActionFromSqlite } from '../../src/host/world/SqliteSamePlateAppearanceDispatchStore';
import { prepareSamePaLifecycleFixture } from '../../src/host/world/SamePlateAppearanceLifecycleFixture.test-support';
import { readBattingEmotionGenesisFromSqlite } from '../../src/host/world/SqliteBattingEmotionStore';
import { openSqliteWorldControlStore } from '../../src/host/world/SqliteWorldControlStore';
import { openSqliteSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { openSqliteSamePlateAppearancePhysicalEpisodeStore } from '../../src/host/world/SqliteSamePlateAppearancePhysicalEpisodeStore';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { continueNativeSpinNeutralV193PostObservation, type NativeSpinNeutralPostObservationContextV193 } from '../../src/host/world/InFlightBattingLifecycleFixture.test-support';
import { calculateBattingExecution } from '../../src/core/world/psychology/batting/BattingCommitment';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { AcceptedBattingObservationCalibration } from '../../src/host/world/PlayerBattingModel';
import { authenticateNativeSpinNeutralV193Frontier } from './NativeSpinNeutralV193-frontier';

const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'retained V193 source identity differs');
const must = <T>(value: T | null | undefined): T => { if (value == null) throw Error('retained normal prerequisite missing'); return value; };
const locator = <O extends string>(db: DatabaseSync, owner: O, sourceId: string): SamePaReference<O> => {
  const row = must(db.prepare(`SELECT source_hash,snapshot_hash FROM main."${owner}" WHERE source_id=?`).get(sourceId));
  return { owner, sourceId, sourceHash: String(row.source_hash), snapshotHash: String(row.snapshot_hash) };
};

/** Normal Native readers restore only immutable owned inputs. Practice and all
 * accepted cut4 work are retained; future contact never supplies a plan input. */
export function runNativeSpinNeutralV193RetainedSuffix(path: string, emit: (stage: string, value?: unknown) => void) {
  const Native = (createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
  const db = new Native(path), owners = new Set<{ close(): void }>();
  const track = <T extends { close(): void }>(owner: T): T => { owners.add(owner); return owner; };
  const release = (owner: { close(): void }) => { owner.close(); owners.delete(owner); };
  try {
    const current = authenticateNativeSpinNeutralV193Frontier(db, (stage, value) => emit('retained-' + stage, value)), stored = current.retained;
    assert.equal(current.lifecycleViewReference.sourceId, 'physical-fixture:cut4:view'); assert(current.currentLifecycle);
    same(stored.historical.view.cut.operationReference, stored.observationReference);
    const prior = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
      const prefix = must(readSamePaLifecycleRecordFromSqlite(db, 'prefix', stored.historical.view.source.prefixReference.sourceId));
      if (prefix.kind !== 'same_pa_lifecycle_prefix') throw Error('normal retained prefix differs');
      same(reference('pa_lifecycle_v1_work_prefixes', prefix), stored.historical.view.source.prefixReference);
      const totals = readSamePaLifecycleSetFromSqlite(db, 'total', stored.historical.view.source.participantTotalReferences.map(p => p.assessmentReference.sourceId))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_total') throw Error('normal retained TOTAL missing'); return value; });
      for (const total of totals) same(reference('pa_lifecycle_v1_total_assessments', total), stored.historical.view.source.participantTotalReferences.find(p => p.playerId === total.source.participantReference.playerId)!.assessmentReference);
      const calibrations = readSamePaLifecycleSetFromSqlite(db, 'calibration', db.prepare('SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
        .all(stored.viewReference.sourceId).map(row => String(row.source_id)))
        .map(value => { if (!value || value.kind !== 'same_pa_lifecycle_calibration') throw Error('normal retained calibration missing'); return value; });
      assert.equal(calibrations.length, 32); for (const calibration of calibrations) same(calibration.source.viewReference, stored.viewReference);
      const acceptedAction = readSamePaPreparedActionFromSqlite(db, locator(db, 'pa_dispatch_v1_action_plans', 'native-action'));
      same(acceptedAction.lineage, prefix.lineage);
      const originalCalibrationIds = db.prepare('SELECT source_id FROM main.pa_dispatch_v1_execution_calibrations WHERE enrollment_source_id=? ORDER BY rowid')
        .all(prefix.lineage.enrollmentReference.sourceId).map(row => String(row.source_id));
      const sensor = calibrations.find(c => c.source.route === 'batter_observation' && c.source.member.playerId === stored.actor.binding.playerId);
      if (!sensor || sensor.source.response.kind !== 'accepted_execution_values_v1') throw Error('normal retained observation response missing');
      const genesis = must(readBattingEmotionGenesisFromSqlite(db, 'physical-fixture:emotion-genesis'));
      const pins = { postureReference: locator(db, 'batting_observation_v1_postures', 'native-spin-neutral-v193:pitch3:posture'),
        intentReference: locator(db, 'batting_execution_v1_intents', 'native-spin-neutral-v193:pitch3:intent'),
        launchReference: stored.physical.physicalPitchReference, captureCutReference: stored.physicalReference,
        observationReference: stored.observationReference };
      if (pins.captureCutReference.owner !== 'pa_physical_v1_cuts') throw Error('normal retained capture cut required');
      return { prefix, totals, calibrations, acceptedAction, originalCalibrationIds, genesis,
        pins: { ...pins, captureCutReference: { ...pins.captureCutReference, owner: 'pa_physical_v1_cuts' as const } },
        explicitBatterObservation: sensor.source.response.values as AcceptedBattingObservationCalibration['values'] };
    }));
    emit('retained-source-inputs-authenticated', { currentViewReference: stored.viewReference, prefix: prior.prefix, totals: prior.totals,
      calibrations: prior.calibrations, originalAction: prior.acceptedAction, genesis: prior.genesis, pins: prior.pins });
    const dispatch = track(openSqliteSamePlateAppearanceDispatchStore(path)), acceptedCalibrations = dispatch.readCalibrationSet(prior.originalCalibrationIds); release(dispatch);
    assert.equal(acceptedCalibrations.calibrations.length, 32);
    const masteries = track(openSqliteSpinControlMasteryV123(path)), inventory = masteries.selectAtDay(stored.actor.binding.careerId, stored.actor.binding.playerId, stored.actor.binding.gameDay); release(masteries);
    assert.equal(inventory.effectiveStateId, 'GOLD'); assert.equal(inventory.motorQualifications.length, 2); assert.equal(inventory.rejected.length, 0);
    emit('retained-native-gold-selected', { inventory, qualificationReferences: stored.qualificationReferences });
    const accepted = new Map<string, unknown>();
    const save = <T extends { sourceId: string }>(source: T): T => { accepted.set(source.sourceId, source); emit('inert-source-declaration', source); return source; };
    const f = { db, path, actor: stored.actor, acceptedAction: prior.acceptedAction, acceptedCalibrations, x: { f: { track } } };
    const events = [...prior.prefix.source.eventReferences], efforts = Object.fromEntries(prior.totals.map(t => [t.source.participantReference.playerId, t.source.effortUnits]));
    let basis: ReturnType<NativeSpinNeutralPostObservationContextV193['current']> = { view: stored.historical.view, viewReference: stored.viewReference,
      basis: stored.historical, calibrationSet: { calibrations: prior.calibrations } };
    const advance: NativeSpinNeutralPostObservationContextV193['advance'] = event => {
      events.push(event); const label = 'physical-fixture:cut' + events.length;
      emit('advance-' + events.length + '-start', { eventReference: event, anchorViewReference: prior.prefix.source.anchorViewReference, eventReferences: events });
      const next = prepareSamePaLifecycleFixture(f, prior.prefix.source.anchorViewReference, [...events], label, efforts, prior.explicitBatterObservation,
        undefined, undefined, undefined, stage => emit('advance-' + events.length + '-' + stage));
      basis = { view: next.view, viewReference: next.viewReference, basis: next.basis, calibrationSet: { calibrations: next.calibrationSet.calibrations } };
      emit('advance-' + events.length + '-accepted', { eventReference: event, prefix: next.prefix, totalSet: next.totalSet,
        viewReference: next.viewReference, view: next.view, calibrationSet: next.calibrationSet });
      release(next.owner); return next;
    };
    const physical = track(openSqliteSamePlateAppearancePhysicalEpisodeStore(path, { readAcceptedAction: id => accepted.get(id), readAcceptedRight: id => accepted.get(id),
      readAcceptedFieldCalibration: id => accepted.get(id), readAcceptedOperation: id => accepted.get(id) }));
    const worldOwner = track(openSqliteWorldControlStore(path));
    const original = prior.acceptedAction.source;
    if (original.variant !== 'declared_take_v1') throw Error('retained original fixture requires its declared first TAKE');
    const h: NativeSpinNeutralPostObservationContextV193 = { f, accepted, save, events, current: () => basis, advance, physical,
      original, genesis: prior.genesis, worldOwner };
    const swing = continueNativeSpinNeutralV193PostObservation(h, 'native-spin-neutral-v193:pitch3', prior.pins, { onStage: stage => emit(stage, { lifecycleViewReference: basis.viewReference, eventReferences: events }),
      prepareCommitment(source, input) {
        const { buntProfileBinding: _bunt, ...ordinary } = source;
        const qualified = { ...ordinary, capability: 'same_pa_physical_commitment_v123' as const, spinBindingV123: {
          kind: 'fixed_native_spin_binding_v123' as const, modelReference: stored.physical.batterModelReference,
          intent: { technique: 'NO_SPIN_TARGET' as const, selectedAtTick: input.nominalRequest.currentFrame.time.tick }, qualificationReferences: stored.qualificationReferences } };
        emit('before-native-commitment', { sourceDeclaration: qualified, input, inputReference: reference('batting_execution_v1_inputs', input),
          actorReference: stored.actorReference, modelReference: stored.physical.batterModelReference, qualificationReferences: stored.qualificationReferences, inventory });
        return qualified;
      } });
    const actual = swing.commitment.calculation;
    assert.equal(actual.algorithm, 'batting-spin-execution-calculation-v123');
    if (actual.algorithm !== 'batting-spin-execution-calculation-v123') throw Error('Native spin consumer calculation missing');
    assert.deepEqual(actual.spinContext.techniques.map(t => t.technique), ['BACKSPIN', 'TOPSPIN']);
    assert.deepEqual(actual.spinContext.techniques.map(t => t.qualificationRef), stored.qualifications.map(q => ({ sourceId: q.source.sourceId, sourceVersion: q.source.sourceVersion })));
    assert(actual.spinContext.techniques.every(t => t.motorProfileRefs.length > 0));
    const plan = must(actual.spinMotorPlanV123);
    assert.deepEqual({ declared: plan.declaredIntent, selected: plan.selectedIntent,
      qualification: plan.selectedQualificationRef, fallback: plan.fallbackReason },
    { declared: 'NO_SPIN_TARGET', selected: 'NO_SPIN_TARGET', qualification: null, fallback: null });
    const ordinary = calculateBattingExecution({ nominalRequest: swing.input.nominalRequest, effectiveValues: swing.input.effectiveValues });
    assert(ordinary.ok); if (!ordinary.ok) throw Error('ordinary comparator calculation failed');
    for (const key of ['nominalRequest', 'effectiveValues', 'commitment', 'status', 'scheduledTick'] as const) assert.deepEqual(actual[key], ordinary.value[key]);
    assert.notEqual(swing.resolution.contact, null); assert.equal(swing.resolution.timeline.events.filter(e => e.kind === 'BatBallContact').length, 1);
    const records = { boundary: 'NATIVE_RETAINED_TWO_QUALIFICATION_NO_TARGET_CONTACT_V193', inventory, qualifications: stored.qualifications,
      qualificationReferences: stored.qualificationReferences, actorReference: stored.actorReference, input: swing.input,
      launch: swing.launch, capture: swing.capture, delivery: swing.delivery, forecast: swing.forecast, score: swing.score, emotion: swing.emotion,
      commitment: swing.commitment, resolution: swing.resolution, ordinary: ordinary.value, finalLifecycleViewReference: basis.viewReference };
    emit('actual-native-contact-and-ordinary-equality-proven', records);
    return { records, summary: { consumerAdoptionProven: true, actualContactCount: 1, consumerTechniqueCount: actual.spinContext.techniques.length,
      selectedIntent: plan.selectedIntent, ordinaryExecutionEqual: true, practiceRegenerated: false,
      fixtureAuthority: 'SYNTHETIC_NATIVE_PRACTICE_AND_CALIBRATION', productionMasteryCalibrationProven: false, naturalGoldRarityProven: false,
      normalAiProven: false, secondNativeControlBranchProven: false, flightExercised: false, officialTerminalProven: false,
      wholeRngConsumptionProven: false, performancePass: false } };
  } finally { for (const owner of [...owners].reverse()) owner.close(); db.close(); }
}
