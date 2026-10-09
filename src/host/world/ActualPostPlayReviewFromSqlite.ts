import { deriveSamePaCatchReviewNativeSeed } from './SamePlateAppearanceCatchReviewFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { capturePostPlayBaseAppeal, type PostPlayBaseAppealAdmission } from './ActualPostPlayBaseAppealFromSqlite';
import { actualPostPlayReviewSessionInput, actualPostPlayReviewEventInput, actualPostPlayReviewIntentInput,
  postPlayHash, postPlayRevision, type AcceptedActualPostPlayReviewEvent, type AcceptedActualPostPlayReviewIntent,
  type AcceptedActualPostPlayReviewSession } from './ActualPostPlayReviewSource';
import { advanceActualPostPlayReview, type ActualPostPlayReviewProjection } from './ActualPostPlayReview';
import { derivePostPlayReviewSession, assertPostPlayOriginalMatchOpen, type PostPlayReviewDb } from './ActualPostPlayReviewNativeScope';
import { capturePostPlayReviewAdmission, replayPostPlayReviewAdmission, type PostPlayReviewAdmission } from './ActualPostPlayReviewNativeAuthority';
import { postPlayReviewIdentityRow, postPlayReviewSessionClaims, postPlayReviewEventRows, postPlayReviewHeadRows,
  assertNoPostPlayClosureReservation, postPlayTableExists, type PostPlayRow } from './ActualPostPlayReviewNativeMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type NativePostPlaySessionArchive = ReturnType<typeof derivePostPlayReviewSession>;
export type NativePostPlayEventReceipt = Readonly<{ source: AcceptedActualPostPlayReviewEvent;
  value: ActualPostPlayReviewProjection; admissionEvidence: PostPlayReviewAdmission | PostPlayBaseAppealAdmission }>;
export const actualPostPlayReviewEvidenceFromSqlite = (db: PostPlayReviewDb) => {
  // All evidence operations share the existing Native proof bracket, including
  // when called inside the journal's writable transaction. It restores the
  // caller's query_only setting before INSERT/UPDATE or Source callbacks.
  const proof = <T>(read: () => T): T => withBattedWorldPhysicalReadTraversal(db, read);
  const session = (sourceId: string): NativePostPlaySessionArchive | null => {
    if (!postPlayTableExists(db, 'actual_post_play_review_sessions')) return null;
    const row = postPlayReviewIdentityRow(db, 'session', sourceId); if (!row) return null;
    const source = actualPostPlayReviewSessionInput(JSON.parse(String(row.source_json)), sourceId);
    const archive = derivePostPlayReviewSession(db, source);
    const peers = postPlayReviewSessionClaims(db, source.adjudicationSourceId, archive.scope);
    if (archive.intakeReasons.length || peers.length !== 1 || peers[0].source_id !== sourceId
      || row.game_id !== archive.scope.gameId || row.play_id !== archive.scope.playId
      || row.physical_pitch_source_id !== archive.scope.physicalPitchSourceId || row.adjudication_source_id !== source.adjudicationSourceId
      || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(archive) || row.snapshot_hash !== hash(archive)) throw new Error('Native review session archive or ownership differs');
    return archive;
  };
  const eventFromRow = (root: NativePostPlaySessionArchive, previous: ActualPostPlayReviewProjection, row: PostPlayRow) => {
    const sourceId = String(row.source_id), claimed = postPlayReviewIdentityRow(db, 'event', sourceId);
    if (!claimed || json(claimed) !== json(row)) throw new Error('Native review event Source identity differs');
    const source = actualPostPlayReviewEventInput(JSON.parse(String(row.source_json)), sourceId);
    const parsedIntent = row.intent_json === null ? null : JSON.parse(String(row.intent_json));
    const intent = parsedIntent === null ? null : actualPostPlayReviewIntentInput(parsedIntent, parsedIntent.sourceId);
    const admission = JSON.parse(String(row.admission_json)) as PostPlayReviewAdmission | PostPlayBaseAppealAdmission;
    if (row.session_source_id !== root.value.source.sourceId || !postPlayRevision(row.revision) || row.revision !== previous.revision + 1
      || row.parent_source_id !== source.parent.sourceId || row.parent_snapshot_hash !== source.parent.snapshotHash
      || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.intent_json !== (intent === null ? null : json(intent)) || row.admission_json !== json(admission)) {
      throw new Error('Native review event archive or parent revision differs');
    }
    if (source.action.kind === 'defender_base_appeal') {
      const actual = capturePostPlayBaseAppeal(db, root.scope, previous, source, false);
      if (intent !== null || actual.kind !== 'admitted' || json(actual.evidence) !== json(admission)) throw new Error('original base appeal execution archive differs');
    } else {
      if (admission.kind === 'base_appeal') throw new Error('unexpected base appeal admission');
      replayPostPlayReviewAdmission(root.scope, previous, source, intent, admission);
    }
    const value = advanceActualPostPlayReview({ previous, source, ...(intent === null ? {} : { intent }),
      ...(admission.kind === 'base_appeal' ? { baseAppeal: admission.execution } : {}) });
    if (row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('Native review event snapshot differs');
    return { source, intent, value, admissionEvidence: admission, previous };
  };
  const at = (root: NativePostPlaySessionArchive, revision: number) => {
    if (!postPlayRevision(revision)) throw new Error('invalid Native review historical revision');
    if (revision === 0) return { value: root.value, last: null };
    const rows = postPlayReviewEventRows(db, root.value.source.sourceId);
    if (rows.some(row => !postPlayRevision(row.revision) || row.revision === 0 || row.session_source_id !== root.value.source.sourceId)) {
      throw new Error('Native review event extent metadata differs');
    }
    const prefix = rows.filter(row => (row.revision as number) <= revision);
    if (!prefix.some(row => row.revision === revision) && rows.every(row => (row.revision as number) < revision)) return null;
    if (prefix.length !== revision || prefix.some((row, i) => row.revision !== i + 1)) throw new Error('Native review journal has a missing or duplicate revision');
    let value = root.value, last: ReturnType<typeof eventFromRow> | null = null;
    // Later rows contribute only integer extent metadata; their domain payloads
    // are not decoded or replayed into this historical prefix.
    for (const row of prefix) { last = eventFromRow(root, value, row); value = last.value; }
    return { value, last };
  };
  const currentFrom = (root: NativePostPlaySessionArchive) => {
    const heads = postPlayReviewHeadRows(db, root.value.source.sourceId);
    if (heads.length !== 1 || heads[0].session_source_id !== root.value.source.sourceId
      || !postPlayRevision(heads[0].revision) || !postPlayHash(heads[0].head_hash)) throw new Error('Native review current head ownership differs');
    const head = heads[0], result = at(root, head.revision as number);
    if (!result || result.value.headSourceId !== head.head_source_id || result.value.headHash !== head.head_hash
      || postPlayReviewEventRows(db, root.value.source.sourceId).length !== result.value.revision) throw new Error('Native review current head or journal extent differs');
    return result.value;
  };
  const currentDetails = (sourceId: string) => {
    const root = session(sourceId); return root && { root, value: currentFrom(root) };
  };
  const eventDetails = (sourceId: string) => {
    if (!postPlayTableExists(db, 'actual_post_play_review_events')) return null;
    const row = postPlayReviewIdentityRow(db, 'event', sourceId); if (!row) return null;
    const source = actualPostPlayReviewEventInput(JSON.parse(String(row.source_json)), sourceId);
    const root = session(source.sessionSourceId); if (!root) throw new Error('Native review event session is missing');
    if (source.expectedRevision === Number.MAX_SAFE_INTEGER) throw new Error('Native review event revision overflow');
    const result = at(root, source.expectedRevision + 1);
    if (!result?.last || result.last.source.sourceId !== sourceId) throw new Error('Native review event prefix differs');
    return { root, ...result.last };
  };
  const writable = (root: NativePostPlaySessionArchive) => {
    if (root.value.source.reservedCatchSeed) deriveSamePaCatchReviewNativeSeed(db, root.value.source.reservedCatchSeed, true);
    assertPostPlayOriginalMatchOpen(db, root.scope);
    assertNoPostPlayClosureReservation(db, root.value.source.adjudicationSourceId, root.scope);
  };
  return {
    session: (sourceId: string) => proof(() => session(sourceId)),
    currentDetails: (sourceId: string) => proof(() => currentDetails(sourceId)),
    eventDetails: (sourceId: string) => proof(() => eventDetails(sourceId)),
    writable: (root: NativePostPlaySessionArchive) => proof(() => writable(root)),
    readSession(sourceId: string) { return proof(() => session(sourceId)?.value ?? null); },
    readCurrent(sourceId: string) { return proof(() => currentDetails(sourceId)?.value ?? null); },
    readAt(sourceId: string, revision: number) { return proof(() => { const root = session(sourceId); return root ? at(root, revision)?.value ?? null : null; }); },
    readEvent(sourceId: string): NativePostPlayEventReceipt | null { return proof(() => {
      const result = eventDetails(sourceId);
      return result && freeze({ source: result.source, value: result.value, admissionEvidence: result.admissionEvidence });
    }); },
    deriveSession(source: AcceptedActualPostPlayReviewSession) { return proof(() => {
      const root = derivePostPlayReviewSession(db, source); writable(root);
      if (postPlayReviewSessionClaims(db, source.adjudicationSourceId, root.scope).length) throw new Error('Native review session/play already has an owner');
      return root;
    }); },
    deriveEvent(source: AcceptedActualPostPlayReviewEvent, intent: AcceptedActualPostPlayReviewIntent | null) { return proof(() => {
      const current = currentDetails(source.sessionSourceId); if (!current) throw new Error('Native review session is missing');
      writable(current.root);
      if (source.action.kind === 'defender_base_appeal' && intent !== null) throw new Error('base appeal cannot substitute a review intent');
      const admission = source.action.kind === 'defender_base_appeal'
        ? capturePostPlayBaseAppeal(db, current.root.scope, current.value, source, true)
        : capturePostPlayReviewAdmission(db, current.root.scope, current.value, source, intent);
      if (admission.kind === 'intent_pending') return { kind: 'intent_pending' as const, reason: admission.reason };
      const value = advanceActualPostPlayReview({ previous: current.value, source, ...(intent === null ? {} : { intent }),
        ...(admission.evidence.kind === 'base_appeal' ? { baseAppeal: admission.evidence.execution } : {}) });
      return { kind: 'admitted' as const, root: current.root, previous: current.value, value, admissionEvidence: admission.evidence };
    }); },
    assertCurrentAdmission(result: NonNullable<ReturnType<typeof eventDetails>>) { return proof(() => {
      writable(result.root);
      const current = result.source.action.kind === 'defender_base_appeal'
        ? capturePostPlayBaseAppeal(db, result.root.scope, result.previous, result.source, true)
        : capturePostPlayReviewAdmission(db, result.root.scope, result.previous, result.source, result.intent);
      if (current.kind !== 'admitted' || json(current.evidence) !== json(result.admissionEvidence)) throw new Error('Native review admission authority changed during write');
    }); },
  };
};
