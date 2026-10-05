import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurablePhysicalPitch } from './SqlitePhysicalPitchProgressStore';

export type AcceptedOriginalBattingIntent = Readonly<{
  version: 'original_batting_intent_v1'; actorSourceId: string; attempt: 'ordinary_swing' | 'bunt';
}>;
export type OriginalBattingIntentEvidence = Readonly<{
  version: 'original_batting_intent_evidence_v1';
  physicalPitch: Readonly<{ owner: 'physical_pitch_progress_actions'; sourceId: string; sourceVersion: string;
    sourceHash: string; snapshotHash: string; progressRevision: number }>;
  actor: Readonly<{ owner: 'physical_plate_appearance_actors'; sourceId: string; sourceVersion: string;
    snapshotHash: string; bindingHash: string; personHash: string }>;
  contact: Readonly<{ tick: number; sequence: number; eventHash: string; resultTimelineHash: string }>;
  intent: Readonly<{ kind: 'declared'; version: 'original_batting_intent_v1'; attempt: 'ordinary_swing' | 'bunt' }>
    | Readonly<{ kind: 'unresolved'; reason: 'original_batting_intent_missing' }>;
}>;

const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
export const originalBattingIntentInput = (raw: AcceptedOriginalBattingIntent): AcceptedOriginalBattingIntent => {
  const value = cloneInert(raw);
  if (!value || json(Object.keys(value).sort()) !== json(['actorSourceId', 'attempt', 'version'])
    || value.version !== 'original_batting_intent_v1' || !id(value.actorSourceId)
    || value.attempt !== 'ordinary_swing' && value.attempt !== 'bunt') throw new Error('invalid original batting intent');
  return freeze(value);
};

/** Pure extraction after the Native pitch owner authenticates the complete original
 * Source/frame/timeline. This helper is not a substitute for that Native read. */
export const deriveOriginalBattingIntentEvidence = (raw: DurablePhysicalPitch): OriginalBattingIntentEvidence => {
  const pitch = cloneInert(raw), actor = pitch.frame.batterActor, resolution = pitch.result.pitch.resolution;
  const timeline = resolution.timeline, before = pitch.beforeTimeline;
  if (!actor || !Number.isSafeInteger(pitch.progressRevision) || pitch.progressRevision < 1
    || pitch.source.gameId !== pitch.frame.gameId || actor.source.gameId !== pitch.frame.gameId
    || actor.match.playId !== pitch.frame.match.playId || timeline.playId !== pitch.frame.match.playId || before.playId !== timeline.playId
    || pitch.source.request.batter.action.kind !== 'swing' || resolution.kind !== 'recorded'
    || resolution.physical.kind !== 'swing' || resolution.physical.result.kind !== 'contact'
    || before.status.kind !== 'active' || timeline.status.kind !== 'batted_ball_pending'
    || json(timeline.events.slice(0, before.events.length)) !== json(before.events)) {
    throw new Error('original batting intent requires its owned actor and actual pitch contact');
  }
  const contacts = timeline.events.filter(event => event.kind === 'BatBallContact' && event.sequence >= before.nextSequence);
  const contact = contacts[0];
  if (contacts.length !== 1 || contact?.kind !== 'BatBallContact' || contact.sequence !== timeline.nextSequence - 1
    || contact.tick !== timeline.lastEventTick || contact.tick !== timeline.status.contactTick || contact.tick < before.lastEventTick
    || json(contact.payload.contact) !== json(resolution.physical.result.contact)
    || json(contact.payload.countBefore) !== json(before.status.count) || json(timeline.status.count) !== json(before.status.count)) {
    throw new Error('original batting intent contact lineage differs');
  }
  const declared = Object.hasOwn(pitch.source, 'battingIntent') ? originalBattingIntentInput(pitch.source.battingIntent!) : null;
  if (declared && declared.actorSourceId !== actor.source.sourceId) throw new Error('original batting intent actor reference differs');
  return freeze({ version: 'original_batting_intent_evidence_v1',
    physicalPitch: { owner: 'physical_pitch_progress_actions', sourceId: pitch.source.sourceId, sourceVersion: pitch.source.sourceVersion,
      sourceHash: hash(pitch.source), snapshotHash: hash(pitch), progressRevision: pitch.progressRevision },
    actor: { owner: 'physical_plate_appearance_actors', sourceId: actor.source.sourceId, sourceVersion: actor.source.sourceVersion,
      snapshotHash: hash(actor), bindingHash: hash(actor.binding), personHash: hash(actor.person) },
    contact: { tick: contact.tick, sequence: contact.sequence, eventHash: hash(contact), resultTimelineHash: hash(timeline) },
    intent: declared ? { kind: 'declared', version: declared.version, attempt: declared.attempt }
      : { kind: 'unresolved', reason: 'original_batting_intent_missing' } });
};
