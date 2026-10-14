import type { DatabaseSync } from 'node:sqlite';
import { actualFoulClosedEvidenceFromSqlite, actualFoulEndArchiveEncoding } from './SqliteActualFoulPlayEndStore';
import { actualFoulRuleConsumptionEvidenceFromSqlite } from './SqliteActualFoulRuleConsumptionStore';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { actualLiveAdjudicationProfile } from './ActualLiveAdjudicationSource';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { initializeFoulOfficialProjection, advanceFoulOfficialProjection, type FoulOfficialFacts } from './ActualFoulOfficialProjection';
import { foulOfficialSessionInput, foulOfficialEventInput, foulOfficialIntentInput, deriveFoulOfficialOpeningClock,
  foulOfficialRevision } from './ActualFoulOfficialSource';
import { foulOfficialIdentity, foulOfficialClaims, foulOfficialHeads, foulOfficialIntentClaims, foulOfficialIntentProducerClaims, type FoulOfficialScope,
  type FoulOfficialRow } from './ActualFoulOfficialOwnership';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { AcceptedFoulOfficialSession, AcceptedFoulOfficialEvent, AcceptedFoulOfficialIntent, FoulOfficialProjection } from './ActualFoulOfficial';

export const foulOfficialEvidenceFromSqlite = (db: DatabaseSync) => {
  const derive = (source: AcceptedFoulOfficialSession) => {
    const end = actualFoulClosedEvidenceFromSqlite(db).read(source.physicalEndReference.sourceId);
    if (!end) throw new Error('accepted original foul physical end is missing');
    const expectedEnd = { owner:'actual_foul_play_ends',sourceId:end.source.sourceId,sourceVersion:end.source.sourceVersion,
      sourceHash:hash(end.source),snapshotHash:actualFoulEndArchiveEncoding(end).hash };
    if (json(expectedEnd) !== json(source.physicalEndReference)) throw new Error('foul official physical end reference differs');
    const count = actualFoulRuleConsumptionEvidenceFromSqlite(db).read(end.source.ruleConsumptionSourceId);
    if (!count) throw new Error('foul official count owner is missing');
    const reference = { owner:'actual_foul_rule_consumptions',sourceId:count.source.sourceId,sourceHash:hash(count.source),snapshotHash:hash(count) };
    const child = end.dispositionObligations.official, assignment = source.assignment;
    if (json(reference) !== json(end.dispositionObligations.consumptionReference)
      || json(reference) !== json(child.scope.consumptionReference) || json(count.successor) !== json(end.dispositionObligations.original)
      || child.status !== 'pending' || child.consumer !== null || child.originalSuccessorKey !== count.successor.successorKey
      || count.gameId !== end.gameId || count.playId !== end.playId || count.physicalPitchSourceId !== end.physicalPitchSourceId
      || count.firstPhysicalPitchSourceId !== end.firstPhysicalPitchSourceId
      || assignment.gameId !== end.gameId || assignment.playId !== end.playId || assignment.physicalPitchSourceId !== end.physicalPitchSourceId) {
      throw new Error('foul official original PA, episode or assignment scope differs');
    }
    const pitch = readOriginalPhysicalPitchPrefixFromSqlite(db,end.physicalPitchSourceId).at(-1);
    if (!pitch || pitch.source.sourceId !== count.physicalPitchSourceId || pitch.frame.gameId !== end.gameId
      || pitch.frame.match.playId !== end.playId || !pitch.frame.batterActor || pitch.frame.world.runners.length
      || Object.values(pitch.frame.match.bases).some(v => v !== null)) throw new Error('foul official original empty-base actor scope differs');
    const boundary = deriveQuantizerClosedGenerationBoundary({ originTick:end.exactEnd.originTick,throughTick:end.exactEnd.tick,
      ticksPerSecond:end.preCorePhysicalProof.boundary.ticksPerSecond });
    if (json(boundary) !== json(end.preCorePhysicalProof.boundary)) throw new Error('foul official sealed quantizer boundary differs');
    const cursor = deriveFoulOfficialOpeningClock({ originTick:boundary.originTick,throughTick:boundary.throughTick,ticksPerSecond:boundary.ticksPerSecond });
    const ruleProfile = actualLiveAdjudicationProfile(pitch.frame.match.ruleProfileId,source.officialPolicy);
    const reasons = ['review','challenge'].filter(k => !ruleProfile.officialWindows?.[k as 'review'|'challenge'])
      .map(k => `official_window_policy_unconfigured:${k}`);
    if (count.disposition.kind === 'pending_original_intent') reasons.push('original_batting_intent_missing');
    const facts: FoulOfficialFacts = { source,end,count,match:pitch.frame.match,ruleProfile,cursor };
    const scope: FoulOfficialScope = { sourceId:source.sourceId,gameId:end.gameId,playId:end.playId,
      physicalPitchSourceId:end.physicalPitchSourceId,physicalEndSourceId:end.source.sourceId,consumptionSourceId:count.source.sourceId,
      officialObligationKey:child.obligationKey,originalSuccessorKey:count.successor.successorKey };
    return Object.freeze({ facts,scope,intakeReasons:reasons,value:reasons.length ? null : initializeFoulOfficialProjection(facts),
      originalOfficialRevision:pitch.frame.officialRevision,
      originalActivationJson:pitch.frame.activation === null ? null : json({ activation:pitch.frame.activation,nextWorld:pitch.frame.world }) });
  };
  type Root = ReturnType<typeof derive>;
  const assertCurrentMatch = (root: Root) => {
    const row = db.prepare('SELECT * FROM main.matches WHERE match_id=?').get(root.scope.gameId);
    if (!row || row.durable_revision !== root.originalOfficialRevision || row.state_json !== json(root.facts.match)
      || row.activation_json !== root.originalActivationJson) throw new Error('foul official original Match changed before write');
  };
  const assertRowScope = (row: FoulOfficialRow, root: Root) => {
    const s = root.scope;
    if (row.game_id !== s.gameId || row.play_id !== s.playId || row.physical_pitch_source_id !== s.physicalPitchSourceId
      || row.official_obligation_key !== s.officialObligationKey) throw new Error('foul official ownership claim scope differs');
  };
  const session = (sourceId: string): Root | null => {
    const row = foulOfficialIdentity(db,'session',sourceId); if (!row) return null;
    const source = foulOfficialSessionInput(JSON.parse(String(row.source_json)),sourceId), root = derive(source);
    const peers = foulOfficialClaims(db,'actual_foul_official_sessions',root.scope);
    assertRowScope(row,root);
    if (!root.value || peers.length !== 1 || peers[0].source_id !== sourceId || row.physical_end_source_id !== source.physicalEndReference.sourceId
      || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(root.value) || row.snapshot_hash !== hash(root.value)) throw new Error('foul official session archive or ownership differs');
    return root;
  };
  const rows = (root: Root) => {
    const result = foulOfficialClaims(db,'actual_foul_official_events',root.scope);
    for (const row of result) {
      assertRowScope(row,root);
      if (row.session_source_id !== root.scope.sourceId || !foulOfficialRevision(row.revision) || row.revision === 0) throw new Error('foul official journal extent ownership differs');
    }
    return result.sort((a,b) => (a.revision as number)-(b.revision as number) || String(a.source_id).localeCompare(String(b.source_id)));
  };
  const assertHandoff = (root: Root, value: FoulOfficialProjection, allEvents: readonly FoulOfficialRow[]) => {
    const claims = foulOfficialClaims(db,'actual_foul_official_handoffs',root.scope);
    if (claims.length > 1) throw new Error('foul official handoff obligation ownership claims differ');
    const row = claims[0];
    if (row) {
      assertRowScope(row,root);
      if (row.session_source_id !== root.scope.sourceId || !foulOfficialRevision(row.revision) || row.revision === 0
        || !allEvents.some(e => e.source_id === row.source_id && e.revision === row.revision)) throw new Error('foul official handoff event ownership differs');
    }
    // A later legitimate acknowledgement is extent metadata in a historical
    // prefix. Its payload and current head do not become earlier authority.
    if (row && (row.revision as number) > value.revision) return;
    if (value.handoff === null) { if (row) throw new Error('foul official premature handoff claim'); return; }
    const event = allEvents.find(e => e.source_id === value.headSourceId);
    if (!row || !event || row.source_id !== value.headSourceId || row.revision !== value.revision
      || row.source_json !== event.source_json || row.source_hash !== event.source_hash
      || row.snapshot_json !== json(value.handoff) || row.snapshot_hash !== hash(value.handoff)) throw new Error('foul official handoff ownership archive differs');
  };
  const at = (root: Root, revision: number) => {
    if (!foulOfficialRevision(revision)) throw new Error('invalid foul official historical revision');
    const all = rows(root), prefix = all.filter(r => (r.revision as number) <= revision);
    if (revision > 0 && !all.some(r => r.revision === revision) && all.every(r => (r.revision as number) < revision)) return null;
    if (prefix.length !== revision || prefix.some((r,i) => r.revision !== i+1)) throw new Error('foul official journal has a missing or duplicate revision');
    let value = root.value!;
    let last: { source:AcceptedFoulOfficialEvent; intent:AcceptedFoulOfficialIntent|null; value:FoulOfficialProjection } | null = null;
    const intentIds = new Set<string>();
    for (const row of prefix) {
      const sourceId = String(row.source_id), identity = foulOfficialIdentity(db,'event',sourceId);
      if (!identity || json(identity) !== json(row)) throw new Error('foul official event Source identity differs');
      const source = foulOfficialEventInput(JSON.parse(String(row.source_json)),sourceId);
      const rawIntent = row.intent_json === null ? null : JSON.parse(String(row.intent_json));
      const intent = rawIntent === null ? null : foulOfficialIntentInput(rawIntent,rawIntent.sourceId);
      if (intent && intentIds.has(intent.sourceId)) throw new Error('foul official intent already consumed');
      if (intent && foulOfficialIntentProducerClaims(db,intent.sourceId).some(peer => peer.source_id !== sourceId)) throw new Error('foul official intent ownership claims differ');
      if (intent) intentIds.add(intent.sourceId);
      const next = advanceFoulOfficialProjection(root.facts,value,source,intent);
      if (row.parent_source_id !== source.parent.sourceId || row.parent_snapshot_hash !== source.parent.snapshotHash
        || row.source_json !== json(source) || row.source_hash !== hash(source) || row.intent_json !== (intent === null ? null : json(intent))
        || row.snapshot_json !== json(next) || row.snapshot_hash !== hash(next)) throw new Error('foul official event archive differs');
      value = next; last = { source,intent,value };
    }
    assertHandoff(root,value,all);
    return { root,value,last,rows:all };
  };
  const currentFromRoot = (root: Root) => {
    const events = rows(root), heads = foulOfficialHeads(db,root.scope,events.map(r => String(r.source_id)));
    if (heads.length !== 1 || heads[0].session_source_id !== root.scope.sourceId || !foulOfficialRevision(heads[0].revision)) throw new Error('foul official head ownership differs');
    const head = heads[0], result = at(root,head.revision as number);
    if (!result || result.value.headSourceId !== head.head_source_id || result.value.headHash !== head.head_hash
      || result.value.revision !== events.length) throw new Error('foul official current head or journal extent differs');
    return result;
  };
  const current = (sourceId: string) => { const root = session(sourceId); return root && currentFromRoot(root); };
  const event = (sourceId: string) => {
    const row = foulOfficialIdentity(db,'event',sourceId); if (!row) return null;
    const source = foulOfficialEventInput(JSON.parse(String(row.source_json)),sourceId), root = session(source.sessionSourceId);
    if (!root || source.expectedRevision === Number.MAX_SAFE_INTEGER) throw new Error('foul official event session or revision differs');
    const result = at(root,source.expectedRevision+1);
    if (!result?.last || result.last.source.sourceId !== sourceId) throw new Error('foul official event original prefix differs');
    return { ...result,...result.last };
  };
  const pin = (root: Root) => ({ sessions:foulOfficialClaims(db,'actual_foul_official_sessions',root.scope),
    events:rows(root),heads:foulOfficialHeads(db,root.scope,rows(root).map(r => String(r.source_id))),
    handoffs:foulOfficialClaims(db,'actual_foul_official_handoffs',root.scope) });
  return { derive,session,current,currentFromRoot,event,pin,assertCurrentMatch,
    at(sourceId: string,revision: number) { const root = session(sourceId); return root && at(root,revision); },
    deriveEvent(source: AcceptedFoulOfficialEvent,intent: AcceptedFoulOfficialIntent|null) {
      const prior = current(source.sessionSourceId); if (!prior) throw new Error('foul official event session is missing');
      assertCurrentMatch(prior.root);
      if (foulOfficialIdentity(db,'event',source.sourceId) || source.sourceId === source.sessionSourceId) throw new Error('foul official event Source already has an owner');
      if (intent && foulOfficialIntentClaims(db,intent.sourceId).length) throw new Error('foul official intent already has an ownership claim');
      return { ...prior,previous:prior.value,value:advanceFoulOfficialProjection(prior.root.facts,prior.value,source,intent) };
    },
  };
};
