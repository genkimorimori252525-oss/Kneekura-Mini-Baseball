import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { resolvePitchCountRule } from '../../core/rules/PitchCountRule';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import type { PitchCountState } from '../../core/rules/PitchCountRule';
import { deriveBallWorldSettledFoulDeadEvidence, type BallWorldSettledFoulDeadEvidence } from '../../core/rules/BallWorldSettledFoulDeadEvidence';
import type { RuleProfileId } from '../../core/model/RuleProfileRef';
import type { DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';
import { battedVenueLegalPolicyEvidenceFromSqlite, withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { battedWorldFieldEvidenceFromSqlite, type DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { actualObservationPhysicalPrefixEvidence } from './ActualObservationPhysicalPrefixHash';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';

export type BattedVenueLegalObservation = Readonly<{
  version: 'batted_venue_legal_observation_v1'; policySourceId: string;
  baseFieldSourceId: string; executionSourceId: string | null;
}>;
export type BattedVenuePhysicalOwnerReference = Readonly<{
  owner: 'batted_world_field_actions' | 'batted_world_field_executions';
  sourceId: string; sourceVersion: string; revision: number; sourceHash: string; snapshotHash: string;
}>;
export type BattedVenueRawContactOrigin = Readonly<{
  reference: BattedVenuePhysicalOwnerReference;
  location: 'field.motion.world.contacts' | 'execution.field.motion.world.contacts';
  rawContactIndex: number; kind: 'ground' | 'rolling_stop'; moment: BallWorldMoment;
}>;
export type BattedVenueOriginalCountEvidence = Readonly<{
  version: 'batted_venue_original_count_v1'; physicalPitchSourceId: string; progressRevision: number;
  contactTick: number; contactSequence: number; count: PitchCountState;
  beforeTimelineHash: string; resultTimelineHash: string;
}>;
export type BattedVenueLegalEvidence = Readonly<{
  version: 'batted_venue_legal_evidence_v1'; gameId: string; playId: number; physicalPitchSourceId: string;
  fixtureEventId: string; venueId: string; ruleProfileId: RuleProfileId;
  policyReference: Readonly<{ owner: 'batted_venue_legal_policies'; sourceId: string; sourceVersion: string;
    sourceHash: string; snapshotHash: string; ruleProfileHash: string }>;
  physicalCut: Readonly<{ baseFieldSourceId: string; baseFieldRevision: number;
    executionSourceId: string | null; executionRevision: number | null }>;
  physicalPrefixReference: Readonly<{ physicalPrefixHash: string;
    physicalPrefixHashConvention?: 'owned_motion_observation_prefix_manifest_v1' }>;
  physicalPrefixReferences: readonly BattedVenuePhysicalOwnerReference[];
  originalCount: BattedVenueOriginalCountEvidence;
  evidence: BallWorldSettledFoulDeadEvidence;
  contactOrigins: Readonly<{ firstGround: readonly BattedVenueRawContactOrigin[];
    decisiveStop: readonly BattedVenueRawContactOrigin[] }> | null;
}>;

const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const fieldReference = (value: DurableBattedWorldFieldAction): BattedVenuePhysicalOwnerReference => ({
  owner: 'batted_world_field_actions', sourceId: value.source.sourceId, sourceVersion: value.source.sourceVersion,
  revision: value.revision, sourceHash: hash(value.source), snapshotHash: hash(value),
});
const executionReference = (value: DurableBattedWorldFieldExecution): BattedVenuePhysicalOwnerReference => ({
  owner: 'batted_world_field_executions', sourceId: value.source.sourceId, sourceVersion: value.source.sourceVersion,
  revision: value.revision, sourceHash: hash(value.source), snapshotHash: ownedScheduledMotionArchiveHash(value),
});

/** Read one explicit historical cut. No rule event, live action or schema is written. */
export const battedVenueLegalEvidenceFromSqlite = (db: DatabaseSync): Readonly<{
  read(request: BattedVenueLegalObservation): BattedVenueLegalEvidence;
}> => Object.freeze({ read(raw): BattedVenueLegalEvidence {
  const request = cloneInert(raw);
  if (!request || json(Object.keys(request).sort()) !== json(['baseFieldSourceId', 'executionSourceId', 'policySourceId', 'version'])
    || request.version !== 'batted_venue_legal_observation_v1' || !id(request.policySourceId) || !id(request.baseFieldSourceId)
    || request.executionSourceId !== null && !id(request.executionSourceId)) throw new Error('invalid venue legal observation cut');
  return withBattedVenueLegalReadSnapshot(db, () => {
    const policy = battedVenueLegalPolicyEvidenceFromSqlite(db).read(request.policySourceId);
    if (!policy) throw new Error('accepted venue legal policy is missing');
    const fieldOwner = battedWorldFieldEvidenceFromSqlite(db), baseField = fieldOwner.read(request.baseFieldSourceId);
    if (!baseField) throw new Error('venue legal original field cut is missing');
    const fields = fieldOwner.scope(baseField, request.baseFieldSourceId);
    const anchor = fields.find(value => value.source.sourceId === policy.anchor.sourceId);
    if (!anchor || json(fieldReference(anchor)) !== json(policy.anchor)) throw new Error('venue legal policy anchor is outside the original cut');
    const world = baseField.response.touch.worldContact, pitch = world.flight.physicalPitch, geometry = baseField.geometry;
    const fixture = geometry.baseGeometry.fixture;
    if (pitch.source.sourceId !== policy.physicalPitchSourceId || pitch.frame.match.playId !== policy.playId
      || pitch.frame.gameId !== policy.source.gameId || pitch.frame.match.ruleProfileId !== policy.source.rulePolicy.ruleProfileId
      || fixture.fixture_event_id !== policy.source.fixtureEventId || fixture.venue_id !== policy.source.venueId
      || fixture.fixture_revision !== policy.fixtureRevision
      || hash(pitch) !== policy.dependencies.physicalPitchHash || hash(fixture) !== policy.dependencies.fixtureHash
      || hash(world.model) !== policy.dependencies.worldModelHash || hash(baseField.response.model) !== policy.dependencies.responseModelHash
      || hash(geometry) !== policy.dependencies.fieldGeometryHash || hash(geometry.baseGeometry) !== policy.dependencies.baseGeometryHash) {
      throw new Error('venue legal physical cut differs from its accepted policy dependencies');
    }
    const tables = db.prepare("SELECT name,type FROM main.sqlite_master WHERE name IN ('batted_world_field_executions','batted_world_field_execution_heads')").all();
    let executions: readonly DurableBattedWorldFieldExecution[];
    if (tables.length === 0 && request.executionSourceId === null) executions = [];
    else {
      if (tables.length !== 2 || tables.some(table => table.type !== 'table')) throw new Error('venue legal execution ownership is missing or partial');
      executions = battedWorldFieldExecutionEvidenceFromSqlite(db).scope(baseField, request.executionSourceId);
    }
    const prefix = { baseField, fields, executions }, physical = battedWorldFieldPhysicalPrefix(prefix);
    const originalCount = battedVenueOriginalContactCount(pitch);
    const evidence = deriveBallWorldSettledFoulDeadEvidence({ field: physical.field, count: originalCount.count, policy: policy.source.rulePolicy });
    const references = [...fields.map(fieldReference), ...executions.map(executionReference)];
    const origins = (moment: BallWorldMoment, kind: 'ground' | 'rolling_stop'): readonly BattedVenueRawContactOrigin[] => {
      const result: BattedVenueRawContactOrigin[] = [];
      const append = (field: DurableBattedWorldFieldAction['field'], reference: BattedVenuePhysicalOwnerReference,
        location: BattedVenueRawContactOrigin['location']) => {
        const boundary = field.motion.world;
        if (boundary.kind !== 'boundary') return;
        boundary.contacts.forEach((contact, rawContactIndex) => {
          const at = contact.moment;
          // The authenticated projection can coalesce contact identities after a
          // same-time response. Retain every original moment, including velocity.
          if (contact.kind === kind && at.originTick === moment.originTick && at.elapsedSeconds === moment.elapsedSeconds
            && at.ball.tick === moment.ball.tick && json(at.ball.position) === json(moment.ball.position)) {
            result.push({ reference, location, rawContactIndex, kind, moment: at });
          }
        });
      };
      fields.forEach((value, index) => append(value.field, references[index], 'field.motion.world.contacts'));
      executions.forEach((value, index) => {
        // Observations and plans repeat an earlier field; they are not new contacts.
        if (['motion', 'motion_checkpoint_v1', 'retained_motion_checkpoint_v1', 'owned_motion_v1', 'owned_motion_v2', 'throw', 'throw_advance']
          .includes(value.execution.kind)) append(value.execution.field, references[fields.length + index], 'execution.field.motion.world.contacts');
      });
      return result;
    };
    let contactOrigins: BattedVenueLegalEvidence['contactOrigins'] = null;
    if (evidence.interpretation.kind === 'dead_ball') {
      const stop = evidence.interpretation.moment;
      const ground = evidence.physicalContacts.find(frame => frame.moment.elapsedSeconds < stop.elapsedSeconds
        && frame.contacts.length === 1 && frame.contacts[0].kind === 'ground');
      if (!ground) throw new Error('venue legal original ground contact is missing');
      const firstGround = origins(ground.moment, 'ground'), decisiveStop = origins(stop, 'rolling_stop');
      if (!firstGround.length || !decisiveStop.length) throw new Error('venue legal physical contact origins are incomplete');
      contactOrigins = { firstGround, decisiveStop };
    }
    return freeze({ version: 'batted_venue_legal_evidence_v1', gameId: policy.source.gameId, playId: policy.playId,
      physicalPitchSourceId: policy.physicalPitchSourceId, fixtureEventId: policy.source.fixtureEventId, venueId: policy.source.venueId,
      ruleProfileId: policy.source.rulePolicy.ruleProfileId,
      policyReference: { owner: 'batted_venue_legal_policies', sourceId: policy.source.sourceId, sourceVersion: policy.source.sourceVersion,
        sourceHash: hash(policy.source), snapshotHash: hash(policy), ruleProfileHash: policy.ruleProfileHash },
      physicalCut: { baseFieldSourceId: baseField.source.sourceId, baseFieldRevision: baseField.revision,
        executionSourceId: request.executionSourceId, executionRevision: executions.at(-1)?.revision ?? null },
      physicalPrefixReference: actualObservationPhysicalPrefixEvidence(prefix), physicalPrefixReferences: references,
      originalCount, evidence, contactOrigins });
  });
} });

/** Original-pitch count extraction; caller must authenticate the physical pitch first. */
export const battedVenueOriginalContactCount = (raw: DurablePhysicalPitch): BattedVenueOriginalCountEvidence => {
  const pitch = cloneInert(raw), before = pitch.beforeTimeline, result = pitch.result.pitch.resolution.timeline;
  if (!Number.isSafeInteger(pitch.progressRevision) || pitch.progressRevision < 1
    || before.playId !== pitch.frame.match.playId || result.playId !== before.playId
    || before.status.kind !== 'active' || result.status.kind !== 'batted_ball_pending'
    || json(result.events.slice(0, before.events.length)) !== json(before.events)) {
    throw new Error('venue legal original pitch count scope differs');
  }
  const contacts = result.events.filter(event => event.kind === 'BatBallContact' && event.sequence >= before.nextSequence);
  const contact = contacts[0];
  if (contacts.length !== 1 || contact?.kind !== 'BatBallContact'
    || contact.sequence !== result.nextSequence - 1 || contact.tick !== result.lastEventTick
    || contact.tick !== result.status.contactTick || contact.tick < before.lastEventTick
    || json(before.status.count) !== json(contact.payload.countBefore)
    || json(before.status.count) !== json(result.status.count)) {
    throw new Error('venue legal original contact count evidence differs');
  }
  const count = before.status.count;
  resolvePitchCountRule(count, { kind: 'ball_in_play' });
  return freeze({ version: 'batted_venue_original_count_v1', physicalPitchSourceId: pitch.source.sourceId,
    progressRevision: pitch.progressRevision, contactTick: contact.tick, contactSequence: contact.sequence,
    count, beforeTimelineHash: hash(before), resultTimelineHash: hash(result) });
};
