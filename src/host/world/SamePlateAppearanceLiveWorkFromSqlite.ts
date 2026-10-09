import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readSamePaLifecycleCalibrationFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalActionFromSqlite, readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { deriveSamePaLiveWorkCensus, type SamePaLiveWorkCensusInput } from './SamePlateAppearanceLiveWorkCensus';
import { deriveSamePaCatchCommunication } from './SamePlateAppearanceCatchCommunication';
import { samePaCatchCommunicationInput, samePaCatchActionInput, samePaCatchAssignmentInput, samePaOfficialPersonInput,
  assertSamePaAcceptedOfficialSource, type SamePaCatchCommunicationAuthority } from './SamePlateAppearanceCatchCommunicationSource';
import { actualCommunicationModelInput } from './ActualCallCommunication';
import { samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';

/** One authenticated read phase supplies the exact original physical prefix,
 * accepted refresh calibration and immutable original participants. A missing
 * external official action never replaces this useful scheduler census. */
export const readSamePaLiveWorkFromSqlite = (db: DatabaseSync,
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>, mode: 'current' | 'historical',
  communication?: Readonly<{ sourceId: string; authority: SamePaCatchCommunicationAuthority }>) => withSamePaLifecycleReadPhase(db, () => {
  const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, viewReference, mode);
  if (pair.kind !== 'same_pa_field_rule_read_pair_v1') return pair;
  const observationPolicies: SamePaLiveWorkCensusInput['observationPolicies'][number][] = [];
  for (const f of pair.fields) {
    if (f.kind !== 'same_pa_physical_field_step_v1' || f.actionResult?.kind !== 'defender_observation_v1') continue;
    const action = f.source.action;
    if (action?.kind !== 'defender_observation_v1') throw new Error('same-PA census observation Source differs');
    const c = readSamePaLifecycleCalibrationFromSqlite(db, action.calibrationReference);
    if (c.source.route !== 'defender_observation' || c.source.member.playerId !== f.actionResult.playerId
      || json(c.source.viewReference) !== json(f.source.viewReference) || json(c.lineage) !== json(pair.value.lineage))
      throw new Error('same-PA census original observation calibration differs');
    observationPolicies.push({ observationReference: reference('pa_physical_v1_field_steps', f), refreshPolicy: c.source.response.values.refreshPolicy });
  }
  const participantIds = [pair.actor.binding.playerId, ...pair.actor.defenderBindings.map(d => d.playerId), ...pair.actor.world.runners.map(r => r.playerId)];
  const census = deriveSamePaLiveWorkCensus({ fields: pair.fields, participantIds, observationPolicies,
    possessionEvidence: pair.value.evidence.rule.possessionEvidence });
  const result = <T>(call: T) => Object.freeze({ kind: 'same_pa_live_work_read_v1' as const,
    physical: pair.value, census, communication: call, physicalEnd: null });
  if (!communication) return result(freeze({ kind: 'pending' as const, reason: 'accepted_original_catch_communication_source_missing' as const }));
  if (!samePaText(communication.sourceId)) throw new Error('invalid same-PA communication Source identity');
  const authority = communication.authority;
  for (const key of ['readAcceptedCommunication', 'readAcceptedAction', 'readAcceptedAssignment', 'readAcceptedOfficialPerson', 'readAcceptedReceptionModel'] as const)
    if (typeof authority?.[key] !== 'function') throw new Error('invalid same-PA original official Source authority');
  const raw = authority.readAcceptedCommunication(communication.sourceId);
  if (raw === null || raw === undefined) return result(freeze({ kind: 'pending' as const, reason: 'accepted_original_catch_communication_source_missing' as const }));
  const source = samePaCatchCommunicationInput(raw, communication.sourceId);
  if (json(source.viewReference) !== json(viewReference)) throw new Error('same-PA communication selected evaluation view differs');
  const rawAction = source.actionReference && authority.readAcceptedAction(source.actionReference.sourceId);
  const action = rawAction == null ? null : samePaCatchActionInput(rawAction, source.actionReference!.sourceId);
  if (action) assertSamePaAcceptedOfficialSource(action, source.actionReference!);
  const rawAssignment = action && authority.readAcceptedAssignment(action.assignmentReference.sourceId);
  const assignment = rawAssignment == null ? null : samePaCatchAssignmentInput(rawAssignment, action!.assignmentReference.sourceId);
  if (assignment) assertSamePaAcceptedOfficialSource(assignment, action!.assignmentReference);
  const rawPerson = assignment && authority.readAcceptedOfficialPerson(assignment.personReference.sourceId);
  const person = rawPerson == null ? null : samePaOfficialPersonInput(rawPerson, assignment!.personReference.sourceId);
  if (person) assertSamePaAcceptedOfficialSource(person, assignment!.personReference);
  const rawModel = source.modelReference && authority.readAcceptedReceptionModel(source.modelReference.sourceId);
  const model = rawModel == null ? null : actualCommunicationModelInput(rawModel, source.modelReference!.sourceId);
  if (model) assertSamePaAcceptedOfficialSource(model, source.modelReference!);
  const basis = action && readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, action.viewReference, 'historical');
  if (basis && (basis.kind !== 'same_pa_field_rule_read_pair_v1'
    || json(basis.value.lineage) !== json(pair.value.lineage)
    || json(basis.value.physicalPitchReference) !== json(pair.value.physicalPitchReference)
    || !pair.value.fieldReferences.some(r => json(r) === json(basis.value.physicalOperationReference))))
    throw new Error('same-PA original catch action is outside the evaluated physical prefix');
  const root = pair.fields[0];
  if (root.kind !== 'same_pa_physical_field_root_v1') throw new Error('same-PA census original field root missing');
  const launch = readSamePaPhysicalOperationFromSqlite(db, root.source.launchReference).record;
  if (launch.kind !== 'same_pa_physical_launch_v1') throw new Error('same-PA communication original pitch launch missing');
  const pitch = readSamePaPhysicalActionFromSqlite(db, launch.source.actionReference);
  const ball = pair.value.evidence.physical.field.evidence;
  const proposal = deriveSamePaCatchCommunication({ source, action, assignment, person, model, scope: {
    lineage: pair.value.lineage, physicalPitchSourceId: pair.value.physicalPitchReference.sourceId,
    ruleProfileId: pair.actor.match.ruleProfileId, matchSeed: pitch.source.nominalPitch.delivery.matchSeed,
    ticksPerSecond: ball.ticksPerSecond,
    at: { originTick: ball.originTick, elapsedSeconds: ball.horizon.elapsedSeconds, tick: ball.horizon.ball.tick },
    actionBasisAt: basis?.kind === 'same_pa_field_rule_read_pair_v1' ? {
      originTick: basis.value.evidence.physical.field.evidence.originTick,
      elapsedSeconds: basis.value.evidence.physical.field.evidence.horizon.elapsedSeconds,
      tick: basis.value.evidence.physical.field.evidence.horizon.ball.tick } : null,
    participantIds, segments: pair.value.evidence.physical.segments,
  } });
  // The proposal is deliberately not a new canonical work receipt. Preserve the
  // accepted input snapshots and hashes for subsequent admission, without
  // accepting a caller PlayEnd or claiming any player consumed the message.
  return result(Object.freeze({ ...proposal, originalSourceSnapshot: freeze(cloneInert({ source, action, assignment, person, model })),
    physicalCoverageHash: pair.value.coverageHash, censusHash: hash(census) }));
});
