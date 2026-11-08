import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { readPhysicalPlateAppearanceActorFromSqlite } from '../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaExecutionReference as reference } from '../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { readNativeSpinControlMasteryV123 } from '../../src/host/world/SqliteSpinControlMasteryV123';
import { readNativeStandaloneBattingMotorEvidenceV224 } from '../../src/host/world/SqliteStandalonePracticeStore';
import { openSqliteSpinMotionBindingV225, spinMotionBindingReferenceV225 } from '../../src/host/world/SqliteSpinMotionBindingV225';
import type { SpinMotionBindingSourceV225 } from '../../src/host/world/SpinMotionBindingV225';
import { resumeNativePostInputResolutionV210, type NativePostInputResolutionV210Input } from './native-post-input-resolution-v210';
import { createBattedBallInitialStateFromContact } from '../../src/core/sim/contact/BatBallContact';
import { observeBattedBallSpinV123 } from '../../src/core/sim/contact/BattedBallSpinObservationV123';
import { createSourceFreeBallKernel } from '../../src/core/sim/ball/SourceFreeBallKernel';

type OriginalRefs = NativePostInputResolutionV210Input['retainedInputReferences']['retainedInputReferences'];
type OriginalReadersV226 = Readonly<{
  actor: (sourceId: string) => ReturnType<typeof readPhysicalPlateAppearanceActorFromSqlite>;
  mastery: (sourceId: string) => ReturnType<typeof readNativeSpinControlMasteryV123>;
  evidence: (eventId: string) => ReturnType<typeof readNativeStandaloneBattingMotorEvidenceV224>;
}>;
/** Called within one normal read snapshot. No physical resolution reader is used. */
export function originalBindingSourcesV226(refs: Pick<OriginalRefs, 'actorReference' | 'qualificationReferences'>,
  readers: OriginalReadersV226): readonly SpinMotionBindingSourceV225[] {
  const actor = readers.actor(refs.actorReference.sourceId); assert(actor, 'V226 original actor missing');
  assert.deepEqual(reference('physical_plate_appearance_actors', actor), refs.actorReference);
  const qualifications = refs.qualificationReferences.map(ref => { const q = readers.mastery(ref.sourceId);
    assert(q, 'V226 original mastery missing'); assert.deepEqual(reference('world_spin_mastery_v123', q), ref); return q; });
  assert.deepEqual(qualifications.map(q => q.source.technique), ['BACKSPIN', 'TOPSPIN']);
  const events = qualifications.flatMap(q => q.contacts.map(c => c.eventId));
  assert.equal(events.length, 6); assert.equal(new Set(events).size, 6);
  return qualifications.map(q => {
    assert.equal(q.contacts.length, 3); assert.equal(q.source.careerId, actor.binding.careerId);
    assert.equal(q.source.playerId, actor.binding.playerId); assert.equal(q.source.personLinkSourceId, actor.person.sourceId);
    assert.equal(q.person.personId, actor.binding.personId); assert(q.source.acceptedAtDay <= actor.binding.gameDay);
    const evidenceReferences = q.contacts.map(c => { const e = readers.evidence(c.eventId);
      assert.equal(e.sourceEventId, c.eventId); assert.equal(e.acceptedEvidenceHash, c.proofHash);
      assert.deepEqual({ sourceId: e.source.sourceId, sourceVersion: e.source.sourceVersion }, c.sourceRef);
      return { sourceEventId: e.sourceEventId, sourceRef: c.sourceRef, acceptedEvidenceHash: e.acceptedEvidenceHash, physicalProofHash: e.physicalProofHash }; });
    return { version: 'spin_motion_binding_source_v225', sourceId: 'spin-motion-binding-v225:' + q.source.technique.toLowerCase(), sourceVersion: 'v1',
      careerId: q.source.careerId, playerId: q.source.playerId, personLinkSourceId: q.source.personLinkSourceId, acceptedAtDay: q.source.acceptedAtDay,
      technique: q.source.technique, masteryReference: reference('world_spin_mastery_v123', q), evidenceReferences,
      ruleVersion: 'ORIGINAL_DRILL_RELEASE_NEUTRAL_PLATE_V1' };
  });
}

function acceptOriginalBindingsV226(path: string, input: NativePostInputResolutionV210Input, emit: (stage: string, value: unknown) => void) {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db: DatabaseSync = new Native(path, { readOnly: true }); let sources: readonly SpinMotionBindingSourceV225[];
  try { db.exec('PRAGMA query_only=1'); sources = withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () =>
    originalBindingSourcesV226(input.retainedInputReferences.retainedInputReferences, {
      actor: id => readPhysicalPlateAppearanceActorFromSqlite(db, id), mastery: id => readNativeSpinControlMasteryV123(db, id),
      evidence: id => readNativeStandaloneBattingMotorEvidenceV224(db, id),
    }))); } finally { db.close(); }
  emit('normal-originals-authenticated', { qualificationCount: sources.length, evidenceCount: sources.reduce((n, s) => n + s.evidenceReferences.length, 0) });
  const accepted = new Map(sources.map(s => [s.sourceId, s]));
  const owner = openSqliteSpinMotionBindingV225(path, { readAcceptedBinding: id => accepted.get(id) ?? null });
  const registered = []; try { for (const source of sources) { const value = owner.accept(source.sourceId), ref = spinMotionBindingReferenceV225(value);
    assert.deepEqual(owner.read(source.sourceId), value); assert.equal(value.futureTransferProven, false); registered.push({ source, value, ref });
    emit('original-binding-accepted', { technique: source.technique, ref }); } } finally { owner.close(); }
  const reopened = openSqliteSpinMotionBindingV225(path); try { for (const item of registered) assert.deepEqual(reopened.read(item.source.sourceId), item.value); }
  finally { reopened.close(); } emit('providerless-reopen-complete', { count: registered.length }); return { registered };
}

export function classifyObservedSpinDirectionV226(spin: ReturnType<typeof observeBattedBallSpinV123> | null) {
  return !spin ? 'NO_CONTACT' : spin.basisStatus !== 'DEFINED' ? 'UNCLASSIFIED'
    : spin.topspinRadPerSecond > 0 ? 'TOPSPIN' : spin.backspinRadPerSecond > 0 ? 'REVERSE_BACKSPIN' : 'ZERO_COMPONENT';
}

/** Run only on a caller-owned fresh copy. The caller owns all file, source,
 * logical-row and caller-state checks, and persists each emitted item. */
export function runNativeObservedSpinAimTrialV226(path: string, input: NativePostInputResolutionV210Input,
  emit: (stage: string, value: unknown) => void) {
  const bindings = acceptOriginalBindingsV226(path, input, emit);
  const selected = bindings.registered.find(item => item.source.technique === 'TOPSPIN');
  assert(selected); const originalEvidenceEventId = selected.source.evidenceReferences[0].sourceEventId;
  let selectedSource: unknown;
  const result = resumeNativePostInputResolutionV210(path, input, emit, {
    prepareCommitment(source) {
      const { buntProfileBinding: _bunt, ...ordinary } = source;
      const trial = { authority: 'EXPLICIT_UNCALIBRATED_CONTROL' as const, domain: 'UNCALIBRATED_CURRENT_OBSERVED_DOMAIN' as const,
        bindingReference: selected.ref, originalEvidenceEventId, assessmentReference: input.resumePins.scoreReference,
        transform: 'PLATE_XY_TRANSLATION_V1' as const, coordinateSystem: 'NATIVE_RBOX_METERS_V1' as const };
      const next = { ...ordinary, capability: 'same_pa_physical_observed_spin_aim_trial_v226' as const, trial };
      selectedSource = next; emit('trial-source-before-acceptance', next); return next;
    },
    verifyCommitment(commitment) {
      assert.deepEqual(commitment.source, selectedSource);
      assert.equal(commitment.calculation.algorithm, 'batting-observed-spin-aim-trial-v226');
      assert(commitment.trialEvidenceV226); assert.equal(commitment.trialEvidenceV226.qualifiedTransferProven, false);
    },
  });
  const contact = result.actualContact;
  const spin = contact ? observeBattedBallSpinV123({ velocityMps: contact.exitVelocity, spinRadPerSecond: contact.exitSpin, bats: 'R' }) : null;
  emit('trial-actual-contact-before-flight', { actualContact: contact, spin });
  let flight: unknown = null;
  if (contact) {
    const profile = input.retainedInputReferences.futureProfileDeclarationOnly.futureBallPhysics;
    const ball = createBattedBallInitialStateFromContact(contact);
    assert.deepEqual(ball, { tick: contact.tick, position: contact.ballCenter, velocity: contact.exitVelocity, spin: contact.exitSpin });
    const initial = { originTick: ball.tick, elapsedSeconds: 0, ball };
    assert.deepEqual(initial.ball, ball);
    const kernel = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2', initial, throughElapsedSeconds: .025, profile });
    flight = { initial, evaluated: kernel.evaluateAt(.025), boundary: 'ACTUAL_CONTACT_TO_CORE_AERODYNAMIC_FLIGHT_ONLY', physicsAuthority: 'RETAINED_PROSPECTIVE_FIELD_DECLARATION_NOT_NATIVE_FIELD_ADOPTION' };
  }
  const spinDirection = classifyObservedSpinDirectionV226(spin);
  const summary = { trialSelected: true, actualContact: contact !== null, spinDirection,
    topspinDirection: spinDirection === 'TOPSPIN',
    spin, flight, fieldRootAccepted: false, officialTerminalProven: false, qualifiedTransferProven: false };
  emit('trial-actual-contact-and-limited-flight', summary); return { result, bindings, summary };
}
