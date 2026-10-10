import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import { SqliteOfficialParticipationStore, type CompletedPlayParticipationReceipt } from './SqliteOfficialParticipationStore';
import { openSqliteOfficialInitialWorldStore } from './SqliteOfficialInitialWorldStore';
import { openSqlitePlayerPersonLinkStore } from './SqlitePlayerPersonLinkStore';
import { openSqlitePlayerWorkloadRecoveryStore } from './SqlitePlayerWorkloadRecoveryStore';
import { openSqlitePlayerPitchTimingStore } from './SqlitePlayerPitchTimingStore';
import { openSqlitePlayerReleaseGeometryStore } from './SqlitePlayerReleaseGeometryStore';
import { openSqlitePitchFatiguePolicyStore } from './SqlitePitchFatiguePolicyStore';
import { openSqlitePhysicalPitchProgressStore, type AcceptedPhysicalPitchActionSource } from './SqlitePhysicalPitchProgressStore';
import { readPhysicalPitchProgressFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { actorHash as hash, actorJson as json, readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readNationalMatchOrigin, nationalFixtureGame } from './NationalMatchOriginFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { openSqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import { nationCompetitionRegionEvidenceFromSqlite } from './SqliteNationCompetitionRegionStore';
import { worldCompetitionCycleEvidenceFromSqlite } from './SqliteWorldCompetitionCycleStore';
import { nationalCompetitionSelectionEvidenceFromSqlite } from './SqliteNationalCompetitionSelectionStore';
import { openSqliteNationalEligibilityFactStore } from './SqliteNationalEligibilityFactStore';
import { openSqliteNationalRosterSnapshotStore } from './SqliteNationalRosterSnapshotStore';
import { openSqliteNationalCallupStore, type DurableNationalAppearance } from './SqliteNationalCallupStore';
import { nationalPhysicalPitchFixtureSource } from './NationalPhysicalMatchFixtures.test-support';
import { continueNationalBattedFoulOriginalTail, type NationalBattedFoulTailContext } from './NationalBattedFoulOriginalTail.test-support';
import type { OfficialPlayerOutcomeAttribution } from './OfficialPlayerOutcomeEvidenceFromSqlite';

/** Only the untouched second play or its one committed original pitch is a
 * supported retained cut. The unchanged helper's exact retry still authenticates
 * the complete Source/history; these structural rows never supply owner evidence. */
export const assertNationalBattedFoulRetainedPitchFrontier = (
  db: Pick<import('node:sqlite').DatabaseSync, 'prepare'>, gameId: string,
) => {
  const scope={game:gameId,source:'national-live:pitch-0'};
  const actions=db.prepare(`SELECT source_id,game_id,play_id,progress_revision FROM physical_pitch_progress_actions
    WHERE (game_id=$game AND play_id=8) OR source_id=$source`).all(scope).map(row=>({...row}));
  const heads=db.prepare(`SELECT game_id,play_id,revision,last_source_id FROM physical_pitch_progress_heads
    WHERE (game_id=$game AND play_id=8) OR last_source_id=$source`).all(scope).map(row=>({...row}));
  if (actions.length===0) { assert.deepEqual(heads,[]); return; }
  assert.deepEqual(actions,[{source_id:scope.source,game_id:gameId,play_id:8,progress_revision:1}]);
  assert.deepEqual(heads,[{game_id:gameId,play_id:8,revision:1,last_source_id:scope.source}]);
};

/** This specific NAT-N01 cut already owns the completed foul, its appearance,
 * next batter and strikeout attribution. Reopen their stores without invoking
 * initialization/enrollment/admission. Every new play still uses real owners. */
export const continueRetainedNationalBattedFoulOriginalTail = (path: string, progress: (phase: string) => void) => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const db = new DatabaseSync(path), handles: {close():void}[]=[];
  let closed=false;
  const track=<T extends {close():void}>(store:T):T=>{handles.push(store);return store;};
  const close=()=>{if(!closed){closed=true;handles.reverse().forEach(store=>store.close());db.close();}};
  try {
    const official=track(new SqliteOfficialStateStore(path));
    const links=track(openSqlitePlayerPersonLinkStore(path));
    // Historical reopening still needs accepted fixture/Person authority. The
    // original National origin owns those fixture pins after Match advancement.
    const participation=track(new SqliteOfficialParticipationStore(path,{
      readGame:gameId=>{const saved=readNationalMatchOrigin(db,gameId);return saved?nationalFixtureGame(saved.fixture):null;},
      readRoster:()=>null,
      readPersonLink:(playerId,sourceId)=>{const link=links.readLink(sourceId);return link?.playerId===playerId?link:null;},
    }));
    const initialWorlds=track(openSqliteOfficialInitialWorldStore(path,{matches:official,participation}));
    const initial=withBattedVenueLegalReadSnapshot(db,()=>initialWorlds.readAcceptedSource('initial-world'));assert(initial);
    const original=withBattedVenueLegalReadSnapshot(db,()=>{
      const nextActor=readPhysicalPlateAppearanceActorFromSqlite(db,'national-live:batter');assert(nextActor);
      assert.equal(nextActor.binding.playerId,'p10');assert.equal(nextActor.match.playId,8);
      assert('activationApplicationId' in nextActor.source);assert.equal(nextActor.source.activationApplicationId,'national-foul:application');
      assert.deepEqual(nextActor.match,{balls:0,bases:{first:null,second:null,third:null},half:'top',inning:1,outs:1,playId:8,
        ruleProfileId:'npb-2026',score:{away:0,home:0},strikes:0});
      const gameId=nextActor.source.gameId;assert.equal(initial.source.gameId,gameId);
      assertNationalBattedFoulRetainedPitchFrontier(db,gameId);
      const prefix=readPhysicalPitchProgressFromSqlite(db,gameId,7);
      assert.deepEqual(prefix.map(pitch=>pitch.source.sourceId),['national-foul:pitch-0','national-foul:pitch-1','national-foul:pitch-2']);
      const origin=readNationalMatchOrigin(db,gameId);assert(origin);
      return {nextActor,prefix,origin};
    });
    const {nextActor,prefix,origin}=original, gameId=origin.source.gameId, effort=prefix[2].source.effortPolicy;
    const workload=track(openSqlitePlayerWorkloadRecoveryStore(path,links));
    const timing=track(openSqlitePlayerPitchTimingStore(path,links));
    const release=track(openSqlitePlayerReleaseGeometryStore(path,links));
    const policies=track(openSqlitePitchFatiguePolicyStore(path));
    const response=policies.readAcceptedPolicy(prefix[2].source.request.policySourceId);assert(response);
    const stores={workload,timing,release,policies,effortPolicies:{readAcceptedPolicy:(sourceId:string)=>sourceId===effort.sourceId?effort:null}};
    const actions=new Map<string,AcceptedPhysicalPitchActionSource>();
    const pitches=track(openSqlitePhysicalPitchProgressStore(path,{matches:official,initialWorlds,participation,runtime:stores},
      {readAcceptedAction:sourceId=>actions.get(sourceId)??null}));
    const roster=track(openSqliteManagerRosterDecisionStore(path));
    const nations=nationCompetitionRegionEvidenceFromSqlite(db);
    const selections=nationalCompetitionSelectionEvidenceFromSqlite(db,{cycle:worldCompetitionCycleEvidenceFromSqlite(db)});
    const facts=track(openSqliteNationalEligibilityFactStore(path,{nations,personLinks:links}));
    const rosterSnapshots=track(openSqliteNationalRosterSnapshotStore(path,{roster}));
    const callups=track(openSqliteNationalCallupStore(path,{nations,selections,personLinks:links,facts,rosterSnapshots,participation,
      games:{readGame:sourceId=>{const saved=readNationalMatchOrigin(db,sourceId);return saved?nationalFixtureGame(saved.fixture):null;}}}));
    // These archived values are expected bytes for later changed-state checks,
    // never evidence callbacks or substitutes for a physical/scoring owner.
    const receiptRow=db.prepare('SELECT receipt_json FROM official_participation_receipts WHERE game_id=? AND player_id=?').get(gameId,'p9');assert(receiptRow);
    const foulReceipt=JSON.parse(String(receiptRow.receipt_json)) as CompletedPlayParticipationReceipt;
    const appearanceRow=db.prepare('SELECT entry_json FROM world_national_callups WHERE career_id=? AND event_id=?').get('career-a','national-foul:appearance');assert(appearanceRow);
    const adoptedFoul=JSON.parse(String(appearanceRow.entry_json)) as DurableNationalAppearance;
    const statisticsRow=db.prepare('SELECT * FROM official_player_outcome_applications WHERE owner=? AND source_id=?').get('actual_foul_terminal_applications','national-foul:terminal');assert(statisticsRow);
    const preservedFoulStatistics=JSON.parse(String(statisticsRow.snapshot_json)) as OfficialPlayerOutcomeAttribution;
    assert.equal(hash(preservedFoulStatistics),statisticsRow.snapshot_hash);
    assert.equal(foulReceipt.closureSourceId,'national-foul:terminal');assert.equal(adoptedFoul.input.receiptId,foulReceipt.receiptId);
    assert.equal(preservedFoulStatistics.source.sourceId,'national-foul:terminal');assert.equal(preservedFoulStatistics.gameId,gameId);
    const f:NationalBattedFoulTailContext={path,db,track,close,official,links,source:origin.source,roster,callups,facts,participation,
      origins:{read:sourceId=>readNationalMatchOrigin(db,sourceId)},fixture:{binding:{venueId:origin.fixture.venueId}},
      setup:{...initial.source.worldSetup,defenders:initial.source.worldSetup.defenders.map(defender=>({...defender}))},workload,stores,effort,actions,pitches,
      pitchSource:(index,readyAtUs)=>nationalPhysicalPitchFixtureSource(gameId,origin.fixture.gameDay,effort,response.sourceId,index,readyAtUs)};
    progress('retained_original_context_reopened');
    continueNationalBattedFoulOriginalTail({f,nextActor,foulTerminalSource:{sourceId:'national-foul:terminal',applicationId:'national-foul:application'},
      foulReceipt,adoptedFoul,originBytes:json(origin),clubBefore:roster.readHead('career-a','club-a'),progress,preservedFoulStatistics});
  } finally { close(); }
};
