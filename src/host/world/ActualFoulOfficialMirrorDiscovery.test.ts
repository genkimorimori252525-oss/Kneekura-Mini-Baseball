import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { foulOfficialClaims, foulOfficialIntentClaims, type FoulOfficialScope } from './ActualFoulOfficialOwnership';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
let db: InstanceType<typeof DatabaseSync>;
const scope: FoulOfficialScope = { sourceId:'original-session',gameId:'original-game',playId:7,physicalPitchSourceId:'original-pitch',
  physicalEndSourceId:'original-end',consumptionSourceId:'original-count',officialObligationKey:'original-child',originalSuccessorKey:'original-parent' };
const intentId = 'original-intent';
const rawHash = (s: string) => createHash('sha256').update(s).digest('hex');
const snapshot = (foreign: boolean, retained = false) => {
  const s = foreign ? { sourceId:'foreign-session',gameId:'foreign-game',playId:8,physicalPitchSourceId:'foreign-pitch',
    physicalEndSourceId:'foreign-end',consumptionSourceId:'foreign-count',officialObligationKey:'foreign-child',originalSuccessorKey:'foreign-parent' } : scope;
  const intent = { sourceId:foreign ? 'foreign-intent' : intentId,sourceVersion:'contract-v1',capability:'actual_post_play_foul_official_intent_v1',
    sessionSourceId:s.sourceId,gameId:s.gameId,playId:s.playId,physicalPitchSourceId:s.physicalPitchSourceId,
    assignmentSourceId:foreign ? 'foreign-assignment' : 'original-assignment',officialId:'umpire-1',judgment:'foul' };
  // A metadata-only projection shape. No fixture below authenticates physical
  // facts, invokes the official owner, or claims a real call/handoff occurred.
  return { source:{ sourceId:s.sourceId },revision:retained ? 2 : 1,headSourceId:foreign ? 'foreign-event' : retained ? 'retained-event' : 'original-event',
    gameId:s.gameId,playId:s.playId,physicalPitchSourceId:s.physicalPitchSourceId,callIntent:intent,
    officialObligation:{ obligationKey:s.officialObligationKey,originalSuccessorKey:s.originalSuccessorKey },
    handoff:{ scope:{ consumptionReference:{ owner:'actual_foul_rule_consumptions',sourceId:s.consumptionSourceId } } } };
};
const insert = (foreign: boolean, retained = false) => {
  const saved = snapshot(foreign,retained), sourceId = saved.headSourceId;
  const source = { sourceId,sourceVersion:'contract-v1',capability:'actual_post_play_foul_official_event_v1',
    sessionSourceId:saved.source.sourceId,expectedRevision:saved.revision-1,
    parent:{ sourceId:retained ? 'original-event' : saved.source.sourceId,snapshotHash:'a'.repeat(64) },
    action:retained ? { kind:'advance_tick',schedulerId:'scheduler' } : { kind:'record_call',intentSourceId:saved.callIntent.sourceId } };
  const raw = json(saved), encoded = json(source);
  db.prepare('INSERT INTO actual_foul_official_events VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(sourceId,source.sessionSourceId,
    saved.gameId,saved.playId,saved.physicalPitchSourceId,saved.officialObligation.obligationKey,saved.revision,
    source.parent.sourceId,source.parent.snapshotHash,encoded,rawHash(encoded),retained ? null : json(saved.callIntent),raw,rawHash(raw));
  return saved;
};
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  // Exact event-table column/constraint shape of the frozen production owner.
  db.exec(`CREATE TABLE actual_foul_official_events(source_id TEXT PRIMARY KEY,session_source_id TEXT NOT NULL,
    game_id TEXT NOT NULL,play_id INTEGER NOT NULL,physical_pitch_source_id TEXT NOT NULL,official_obligation_key TEXT NOT NULL,
    revision INTEGER NOT NULL,parent_source_id TEXT NOT NULL,parent_snapshot_hash TEXT NOT NULL,source_json TEXT NOT NULL,
    source_hash TEXT NOT NULL,intent_json TEXT,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(session_source_id,revision));`);
  insert(false);
});
afterEach(() => db.close());
const selected = () => foulOfficialClaims(db,'actual_foul_official_events',scope).map(row => String(row.source_id));
const rows = () => json(db.prepare('SELECT * FROM actual_foul_official_events ORDER BY source_id').all());

it('metadata-discovery baseline selects the original row and ignores an unrelated foreign row', () => {
  insert(true); const before = rows();
  expect(selected()).toEqual(['original-event']);
  expect(foulOfficialIntentClaims(db,intentId).map(row => row.source_id)).toEqual(['original-event']);
  expect(rows()).toBe(before);
});

it('metadata-discovery baseline retains a later same-session projection without treating its retained intent as another call action', () => {
  insert(false,true); const before = rows();
  expect(selected()).toEqual(['original-event','retained-event']);
  expect(JSON.parse(String(db.prepare('SELECT snapshot_json FROM actual_foul_official_events WHERE source_id=?').get('retained-event')!.snapshot_json)).callIntent.sourceId).toBe(intentId);
  expect(db.prepare('SELECT intent_json FROM actual_foul_official_events WHERE source_id=?').get('retained-event')!.intent_json).toBeNull();
  expect(rows()).toBe(before);
});

const cases = [
  ['call_intent_session','plain'],['call_intent_session','escaped_middle'],
  ['call_intent_pitch','plain'],['call_intent_pitch','escaped_middle'],
  ['call_intent_identity','plain'],['call_intent_identity','escaped_middle'],
  ['official_parent','plain'],['official_parent','escaped_middle'],
  ['handoff_scope_count','plain'],['handoff_scope_count','escaped_middle'],
] as const;
it.each(cases)('discovers the sole %s target claim through its %s raw mirror', (path,encoding) => {
  const saved = insert(true);
  let container: Record<string,unknown>, key: string, target: string;
  if (path === 'call_intent_session') { container=saved.callIntent; key='sessionSourceId'; target=scope.sourceId; }
  else if (path === 'call_intent_pitch') { container=saved.callIntent; key='physicalPitchSourceId'; target=scope.physicalPitchSourceId; }
  else if (path === 'call_intent_identity') { container=saved.callIntent; key='sourceId'; target=intentId; }
  else if (path === 'official_parent') { container=saved.officialObligation; key='originalSuccessorKey'; target=scope.originalSuccessorKey; }
  else { container=saved.handoff.scope.consumptionReference; key='sourceId'; target=scope.consumptionSourceId; }
  const foreignValue=String(container[key]), originalContainer=json(container);
  const raw = (middle: string) => {
    const escaped=key.includes('I') ? key.replace('I','\\u0049') : key.replace('K','\\u004b');
    const replacement=encoding==='plain' ? json({ ...container,[key]:middle }) : originalContainer.slice(0,-1)
      + ',"'+escaped+'":'+JSON.stringify(middle)+','+JSON.stringify(key)+':'+JSON.stringify(foreignValue)+'}';
    return json(saved).replace(originalContainer,replacement);
  };
  const set = (document: string) => {
    db.prepare('UPDATE actual_foul_official_events SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(document,rawHash(document),'foreign-event');
    const row=db.prepare('SELECT snapshot_json,snapshot_hash FROM actual_foul_official_events WHERE source_id=?').get('foreign-event')!;
    expect(row.snapshot_json).toBe(document); expect(row.snapshot_hash).toBe(rawHash(document));
  };
  const discover = () => path==='call_intent_identity' ? foulOfficialIntentClaims(db,intentId).map(row => String(row.source_id)) : selected();
  // Both encodings first prove a harmless foreign control, including the same
  // noncanonical duplicate structure and a hash of the exact raw bytes.
  set(raw(foreignValue)); const foreign = rows();
  expect(discover()).toEqual(['original-event']); expect(rows()).toBe(foreign);
  if (path==='handoff_scope_count') {
    const wrongOwner={ ...saved,handoff:{ scope:{ consumptionReference:{ owner:'foreign-owner',sourceId:target } } } };
    set(json(wrongOwner)); expect(discover()).toEqual(['original-event']); set(raw(foreignValue));
  }
  set(raw(target)); const changed=rows();
  expect(discover().includes('foreign-event')).toBe(true);
  expect(rows()).toBe(changed);
});
