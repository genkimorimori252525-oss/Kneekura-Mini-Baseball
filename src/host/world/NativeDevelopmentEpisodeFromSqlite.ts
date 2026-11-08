import { isStandalonePracticeEvent, readStandalonePracticeRepetition } from './SqliteStandalonePracticeStore';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { appendDevelopmentLearningEvent, type DevelopmentLearningEpisode, type DevelopmentLearningEventInput } from '../../core/world/development/DevelopmentLearningEpisode';
import type { RecordedDevelopmentInitiation } from '../../core/world/development/DevelopmentInitiationHistory';
import { readNationalExposureDevelopmentBoundary, NATIONAL_EXPOSURE_DEVELOPMENT_KIND } from './NationalExposureDevelopmentOrigin';
import { readPracticeDevelopmentBoundary, PRACTICE_DEVELOPMENT_KIND, type PracticeInitiationRow } from './PracticeDevelopmentOrigin';
import { readRosterDevelopmentBoundary, readRosterDevelopmentOrigin } from './RosterDevelopmentOrigin';
import { readNativePitchPracticeAttemptFromSqlite, readNativePitchPracticeRepetitionFromSqlite } from './NativePitchPracticeEvidenceFromSqlite';
import { readNativeNonPitchRepetitionFromSqlite } from './SqliteNonPitchRepetitionStore';
import { isNonPitchRepetitionEvent, nonPitchId as id } from './NonPitchDevelopmentRepetition';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {memoSamePaContinuationRead,withSamePaContinuationReadPhase} from './SamePlateAppearanceContinuationFromSqlite';

type Row = PracticeInitiationRow & { current_json: string; revision: number };
type LearningRow = { source_id: string; episode_id: string; before_revision: number; after_revision: number; event_json: string; state_json: string };
type PrefixRead = { stack: { episodeId: string; revision: number }[];
  memo: Map<string, RecordedDevelopmentInitiation | null>; changes: number };
// Lifespan is one synchronous top-level read, never a transaction or a live
// Owner handle. Recursive repetitions often authenticate the same older prefix.
const active = new WeakMap<DatabaseSync, PrefixRead>();
const changes = (db: DatabaseSync) => Number(db.prepare('SELECT total_changes() AS changes').get()!.changes);
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('Native development original history differs'); };

/** Read only a pinned original prefix. All cross-owner dependencies replay on
 * this Native snapshot and recursive same-episode dependencies must decrease. */
const readOriginalNativeDevelopmentEpisode = (db: DatabaseSync, episodeId: string,
  revision: number): RecordedDevelopmentInitiation | null => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction || !id(episodeId) || !Number.isSafeInteger(revision) || revision < 1) {
    throw new Error('Native development requires an active original prefix snapshot');
  }
  const context = active.get(db) ?? { stack: [], memo: new Map<string, RecordedDevelopmentInitiation | null>(), changes: changes(db) };
  const stack = context.stack, key = JSON.stringify([episodeId, revision]), before = changes(db);
  if (stack.some(value => value.episodeId === episodeId && value.revision <= revision)) throw new Error('Native development history cycle or forward dependency');
  if (context.changes !== before) { context.memo.clear(); context.changes = before; }
  if (context.memo.has(key)) return context.memo.get(key)!;
  stack.push({ episodeId, revision }); active.set(db, context);
  try { const value = withBattedVenueLegalReadSnapshot(db, () => {
    const rows = db.prepare(`SELECT * FROM world_development_initiations WHERE episode_id=$id
      OR ${claim('request_json', ['episodeId'], '$id')} OR ${claim('initial_json', ['episodeId'], '$id')}
      OR ${claim('current_json', ['episodeId'], '$id')}`).all({ id: episodeId }) as Row[];
    if (rows.length > 1 || rows.length === 1 && rows[0].episode_id !== episodeId) throw new Error('Native development episode ownership differs');
    const row = rows[0]; if (!row) return null;
    const request = JSON.parse(row.request_json) as { kind?: unknown; episodeId: string; appraisalSourceId: string };
    const prior = JSON.parse(row.prior_json) as readonly RecordedDevelopmentInitiation[];
    if (row.request_json !== json(request) || row.prior_json !== json(prior) || !Array.isArray(prior)
      || request.episodeId !== episodeId || request.appraisalSourceId !== row.appraisal_source_id
      || !Number.isSafeInteger(row.revision) || revision > row.revision) throw new Error('Native development original intake or revision differs');
    for (const previous of prior) {
      if (!previous?.episode || previous.episode.episodeId === episodeId || previous.episode.careerId !== row.career_id
        || previous.episode.playerId !== row.player_id) throw new Error('Native development prior episode scope differs');
      same(readNativeDevelopmentEpisodeFromSqlite(db, previous.episode.episodeId, previous.episode.revision), previous);
    }
    const installed = (table: string) => !!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name=?").get(table);
    const hasOrigin = (table: string) => installed(table) && !!db.prepare(`SELECT 1 FROM ${table} WHERE episode_id=?`).get(episodeId);
    if (request.kind !== PRACTICE_DEVELOPMENT_KIND && hasOrigin('world_development_practice_origins')
      || request.kind !== NATIONAL_EXPOSURE_DEVELOPMENT_KIND && hasOrigin('world_development_national_exposure_origins')
      || Object.hasOwn(request, 'kind') && readRosterDevelopmentOrigin(db, episodeId)) throw new Error('Native development origin discriminator differs');
    const initial = request.kind === NATIONAL_EXPOSURE_DEVELOPMENT_KIND ? readNationalExposureDevelopmentBoundary(db, row).initial
      : request.kind === PRACTICE_DEVELOPMENT_KIND ? readPracticeDevelopmentBoundary(db, row,
        attemptId => readNativePitchPracticeAttemptFromSqlite(db, attemptId)).initial
        : !Object.hasOwn(request, 'kind') ? readRosterDevelopmentBoundary(db, row).initial
          : (() => { throw new Error('Native development origin kind is unsupported'); })();
    if (row.assessment_json !== json(initial.assessment) || row.initial_json !== json(initial.episode)
      || initial.episode.revision > revision || initial.assessment.careerId !== row.career_id || initial.assessment.playerId !== row.player_id
      || initial.assessment.atDay !== row.at_day) throw new Error('Native development original assessment differs');
    let current: DevelopmentLearningEpisode = initial.episode;
    const learning = db.prepare(`SELECT * FROM world_development_learning_events WHERE episode_id=$id
      OR ${claim('state_json', ['episodeId'], '$id')} ORDER BY after_revision`).all({ id: episodeId }) as LearningRow[];
    for (const update of learning) {
      const event = JSON.parse(update.event_json) as DevelopmentLearningEventInput;
      const state = JSON.parse(update.state_json) as DevelopmentLearningEpisode;
      if (update.episode_id !== episodeId || state.episodeId !== episodeId || state.revision !== update.after_revision
        || update.before_revision + 1 !== update.after_revision || update.source_id !== event.sourceEventId
        || json(event) !== update.event_json || json(state) !== update.state_json) throw new Error('Native development learning identity differs');
      if (update.after_revision > revision) continue;
      if (update.before_revision !== current.revision) throw new Error('Native development learning prefix is not contiguous');
      const peers = db.prepare(`SELECT * FROM world_development_learning_events WHERE source_id=$id
        OR ${claim('event_json', ['sourceEventId'], '$id')}`).all({ id: event.sourceEventId });
      if (peers.length !== 1) throw new Error('Native development learning Source ownership differs');
      if (event.kind === 'PRACTICE_RECORDED' || isStandalonePracticeEvent(event) || isNonPitchRepetitionEvent(event) || event.sourceEventId.startsWith('practice-workload:pitch-practice:')) {
        const owned = isStandalonePracticeEvent(event) ? readStandalonePracticeRepetition(db, null, event.sourceEventId)
          : isNonPitchRepetitionEvent(event) ? readNativeNonPitchRepetitionFromSqlite(db, event.sourceEventId)
          : event.sourceEventId.startsWith('practice-workload:pitch-practice:') ? readNativePitchPracticeRepetitionFromSqlite(db, event.sourceEventId)
            : (() => { throw new Error('Native development practice owner is unsupported'); })();
        if (owned.episodeId !== episodeId || owned.careerId !== row.career_id || owned.playerId !== row.player_id) {
          throw new Error('Native development repetition scope differs');
        }
        same(owned.event, event);
      }
      current = appendDevelopmentLearningEvent(current, current.revision, event); same(current, state);
    }
    if (current.revision !== revision || revision === row.revision && row.current_json !== json(current)) throw new Error('Native development historical endpoint differs');
    return freeze({ assessment: initial.assessment, episode: current });
  });
    if (changes(db) !== before) { context.memo.clear(); throw new Error('Native development original snapshot changed during read'); }
    context.memo.set(key, value); return value;
  } finally { stack.pop(); if (!stack.length) active.delete(db); }
};

/** Archive-only proof sharing. Owned readCurrent/provider/learning callbacks
 * retain their separate path. Never share across operations or writable work. */
export const readNativeDevelopmentEpisodeFromSqlite = (db:DatabaseSync,episodeId:string,revision:number):RecordedDevelopmentInitiation|null=>{
 const {DatabaseSync:Native}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
 if(!(db instanceof Native)||!db.isTransaction||db.prepare('PRAGMA query_only').get()!.query_only!==1)
  return readOriginalNativeDevelopmentEpisode(db,episodeId,revision);
 return withSamePaContinuationReadPhase(db,()=>withBattedVenueLegalReadSnapshot(db,()=>{
  // Check before a completed-cache hit too: an older active prefix must not
  // follow a later prefix that happened to have been read earlier in the phase.
  if(active.get(db)?.stack.some(value=>value.episodeId===episodeId&&value.revision<=revision))
   throw Error('Native development history cycle or forward dependency');
  return memoSamePaContinuationRead(db,'native-development-prefix-v126:'+json([episodeId,revision]),
   ()=>readOriginalNativeDevelopmentEpisode(db,episodeId,revision));
 }));
};
