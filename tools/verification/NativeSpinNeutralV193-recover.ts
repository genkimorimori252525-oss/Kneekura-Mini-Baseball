import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from '../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readSamePaBattingExecutionInputFromSqlite } from '../../src/host/world/SqliteBattingExecutionInputStore';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { calculateBattingExecution } from '../../src/core/world/psychology/batting/BattingCommitment';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import type { DurableSamePaBattingExecutionInput } from '../../src/host/world/NativeBattingExecutionInput';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

type Pins = Readonly<{ actorReference: SamePaReference<'physical_plate_appearance_actors'>;
  resolutionReference: SamePaReference<'pa_physical_v1_resolutions'>; inputReference: SamePaReference<'batting_execution_v1_inputs'>;
  qualificationReferences: readonly SamePaReference<'world_spin_mastery_v123'>[]; originalInput: DurableSamePaBattingExecutionInput }>;
const same = (a: unknown, b: unknown) => assert.equal(json(a), json(b), 'retained V193 full reference differs');

/** Recovery reads immutable accepted operations only. It never accepts a new
 * operation, resumes a lifecycle writer, or treats an incomplete view as current. */
export const recoverNativeSpinNeutralV193AcceptedContact = (db: DatabaseSync, pins: Pins, emit: (name: string, value: unknown) => void) =>
  withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
    const actor = readPhysicalPlateAppearanceActorFromSqlite(db, pins.actorReference.sourceId);
    assert(actor); same(reference('physical_plate_appearance_actors', actor), pins.actorReference);
    assert.equal(actor.binding.gameDay, 40);
    const proof = readSamePaPhysicalOperationFromSqlite(db, pins.resolutionReference), resolution = proof.record;
    assert.equal(resolution.kind, 'same_pa_physical_resolution_v1');
    if (resolution.kind !== 'same_pa_physical_resolution_v1') throw Error('accepted Native resolution missing');
    same(proof.actor, actor); same(resolution.lineage.actorReference, pins.actorReference);
    emit('accepted-resolution-authenticated', { proof });
    const commitmentReference = resolution.source.commitmentReference; assert(commitmentReference);
    const committed = readSamePaPhysicalOperationFromSqlite(db, commitmentReference), commitment = committed.record;
    assert.equal(commitment.kind, 'same_pa_physical_commitment_v1');
    if (commitment.kind !== 'same_pa_physical_commitment_v1' || commitment.source.capability !== 'same_pa_physical_commitment_v123') throw Error('accepted Native spin commitment missing');
    same(committed.actor, actor); same(commitment.lineage, resolution.lineage); same(committed.physicalPitchReference, proof.physicalPitchReference);
    same(commitment.source.spinBindingV123.qualificationReferences, pins.qualificationReferences);
    same(commitment.source.inputReference, pins.inputReference);
    const qualifications = pins.qualificationReferences.map(ref => {
      const value = readNativeSpinControlMasteryV123(db, ref.sourceId); assert(value); same(reference('world_spin_mastery_v123', value), ref); return value;
    });
    assert.deepEqual(qualifications.map(q => q.source.technique), ['BACKSPIN', 'TOPSPIN']);
    assert.equal(new Set(qualifications.map(q => q.source.sourceEffectIdentity)).size, 2);
    assert.equal(new Set(qualifications.map(q => q.projection.qualified[0].episodeId)).size, 2);
    assert.equal(new Set(qualifications.flatMap(q => q.contacts.map(c => c.eventId))).size, 6);
    for (const q of qualifications) {
      assert.equal(q.source.careerId, actor.binding.careerId); assert.equal(q.source.playerId, actor.binding.playerId);
      assert.equal(q.person.personId, actor.binding.personId); assert.equal(q.source.personLinkSourceId, actor.person.sourceId);
      assert(q.source.acceptedAtDay <= actor.binding.gameDay); assert.equal(q.successfulContacts, 3);
    }
    const input = readSamePaBattingExecutionInputFromSqlite(db, pins.inputReference);
    assert.deepEqual(input, pins.originalInput); same(input.lineage, commitment.lineage);
    const actual = commitment.calculation;
    if (actual.algorithm !== 'batting-spin-execution-calculation-v123') throw Error('Native spin consumer calculation missing');
    assert.deepEqual(actual.spinContext.techniques.map(t => t.technique), ['BACKSPIN', 'TOPSPIN']);
    assert.deepEqual(actual.spinContext.techniques.map(t => t.qualificationRef), qualifications.map(q => ({ sourceId: q.source.sourceId, sourceVersion: q.source.sourceVersion })));
    assert(actual.spinContext.techniques.every(t => t.motorProfileRefs.length > 0));
    const plan = actual.spinMotorPlanV123; assert(plan);
    assert.deepEqual({ declared: plan.declaredIntent, selected: plan.selectedIntent, qualification: plan.selectedQualificationRef, fallback: plan.fallbackReason },
      { declared: 'NO_SPIN_TARGET', selected: 'NO_SPIN_TARGET', qualification: null, fallback: null });
    const ordinary = calculateBattingExecution({ nominalRequest: input.nominalRequest, effectiveValues: input.effectiveValues });
    assert(ordinary.ok); if (!ordinary.ok) throw Error('ordinary comparator calculation failed');
    for (const key of ['nominalRequest', 'effectiveValues', 'commitment', 'status', 'scheduledTick'] as const) assert.deepEqual(actual[key], ordinary.value[key]);
    assert.notEqual(resolution.contact, null);
    assert.equal(resolution.timeline.events.filter(e => e.kind === 'BatBallContact').length, 1);
    const records = { boundary: 'NATIVE_RETAINED_ACCEPTED_OPERATION_RECOVERY_ONLY', actor, qualifications, qualificationReferences: pins.qualificationReferences,
      resolutionReference: pins.resolutionReference, resolution, commitmentReference, commitment,
      inputReference: pins.inputReference, input, ordinary: ordinary.value };
    emit('accepted-contact-consumer-and-ordinary-equality-authenticated', records);
    return { records, summary: { consumerAdoptionProven: true, actualContactCount: 1, consumerTechniqueCount: actual.spinContext.techniques.length,
      selectedIntent: plan.selectedIntent, ordinaryExecutionEqual: true, originalInputBitValuesEqual: true,
      newPhysicalOperationsAccepted: 0, practiceRegenerated: false, lifecycleAfterResolutionCurrentProven: false,
      syntheticCalibrationOnly: true, productionMasteryCalibrationProven: false, naturalGoldRarityProven: false, normalAiProven: false,
      secondNativeControlBranchProven: false, flightExercised: false, officialTerminalProven: false, wholeRngConsumptionProven: false, performancePass: false } };
  }));
