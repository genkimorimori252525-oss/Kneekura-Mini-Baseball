import type {DatabaseSync} from 'node:sqlite';
import {prepareBetweenPlayWorld} from '../../core/adjudication/BetweenPlayWorldReset';
import {deriveClosedNonLiveMatchState} from '../../core/adjudication/NonLiveOfficialApplication';
import type {AcceptedFoulTerminalPostPlayBoundary} from './ActualFoulTerminalPostPlayBoundary';
import type {FoulTerminalApplicationProposal} from './ActualFoulTerminalApplication';
import type {FoulTerminalIncomingDefender,FoulTerminalHalfChangeCompletion} from './ActualFoulTerminalPostPlayCompletion';
import {readOfficialActorPersonLink} from './SqliteOfficialInitialWorldStore';
import type {OfficialParticipantBinding} from './SqliteOfficialParticipationStore';
import {assertNationalMatchBindings} from './NationalMatchOriginFromSqlite';
import {readActualRoleWorkloadState} from './ActualRoleWorkloadState';
import {actorJson as json,actorHash as hash,actorFreeze as freeze} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import {foulApplicationOwnershipRows} from './ActualFoulTerminalApplicationOwnership';
import {originalFoulMetadataValues as values} from './OriginalFoulOwnershipMetadata';
type Half=Extract<AcceptedFoulTerminalPostPlayBoundary,{kind:'half_change_continuing'}>;
const binding=(db:DatabaseSync,p:FoulTerminalApplicationProposal,playerId:string):OfficialParticipantBinding=>{
 const rows=foulApplicationOwnershipRows(db,'official_participant_bindings',{game_id:'TEXT',player_id:'TEXT',binding_json:'TEXT'}).filter(row=>{
  const doc=typeof row.binding_json==='string'?row.binding_json:'';
  return (row.game_id===p.gameId||values(db,doc,['gameId']).includes(p.gameId))&&(row.player_id===playerId||values(db,doc,['playerId']).includes(playerId));
 });
 const row=rows[0],b=row&&JSON.parse(String(row.binding_json)) as OfficialParticipantBinding;
 const first=p.participants[0]?.binding,game=p.applicationBody.game,side=p.nextMatch.half==='top'?'HOME':'AWAY';
 if(rows.length!==1||!b||!first||!game||row.game_id!==p.gameId||row.player_id!==playerId||row.binding_json!==JSON.stringify(b)
  ||b.gameId!==p.gameId||b.playerId!==playerId||b.careerId!==first.careerId||b.careerId!==p.seasonFixture.careerId
  ||b.competitionEditionId!==game.seasonId||b.competitionEditionId!==p.seasonFixture.competitionEditionId||b.gameDay!==first.gameDay
  ||b.fixtureEventId!==p.fixture.fixtureEventId||b.fixtureEventId!==first.fixtureEventId||p.seasonFixture.game.gameId!==p.gameId
  ||b.side!==side||b.clubId!==(side==='HOME'?game.homeClubId:game.awayClubId)
  ||game.homeClubId!==p.seasonFixture.game.homeClubId||game.awayClubId!==p.seasonFixture.game.awayClubId)throw new Error('terminal completion incoming defense binding differs');
 const person=readOfficialActorPersonLink(db,b);
 if(person.personId!==b.personId)throw new Error('terminal completion incoming defense Person differs');
 return b;
};
/** Fresh calls archive the current accepted workload. Historical calls replay
 * precisely the archived revision and never replace it with today's head. */
export const deriveFoulTerminalIncomingDefenders=(db:DatabaseSync,p:FoulTerminalApplicationProposal,source:Half,
 archived?:readonly FoulTerminalIncomingDefender[]):readonly FoulTerminalIncomingDefender[]=>{
 const body=p.applicationBody,next=deriveClosedNonLiveMatchState(body);
 if(!body.game||body.match.outs!==2||body.context.kind!=='strikeout'||body.match.half===next.half||json(next)!==json(p.nextMatch)
  ||Object.values(body.match.bases).some(x=>x!==null))throw new Error('terminal completion incoming defense requires third-out half change');
 prepareBetweenPlayWorld(next,source.nextStartedAtTick,source.worldSetup);
 const ids=source.worldSetup.defenders.map(d=>d.playerId).sort();
 if(archived&&json(archived.map(d=>d.playerId))!==json(ids))throw new Error('terminal completion incoming defense archive order differs');
 const incoming=ids.map(playerId=>binding(db,p,playerId));
 assertNationalMatchBindings(db,incoming);
 const result=ids.map((playerId,i)=>{
  const b=incoming[i],state=readActualRoleWorkloadState(db,b.careerId,playerId,archived?.[i].workloadRevision,b.personLinkSourceId);
  if(!state||state.careerId!==b.careerId||state.playerId!==playerId||state.effectiveDay>b.gameDay)throw new Error('terminal completion incoming defense workload missing or differs');
  const ref={playerId,personId:b.personId,bindingHash:hash(b),workloadRevision:state.revision,workloadHash:hash(state)};
  if(archived&&json(archived[i])!==json(ref))throw new Error('terminal completion incoming defense archived workload differs');return ref;
 });
 if(new Set(result.map(d=>d.personId)).size!==9)throw new Error('terminal completion incoming defense Persons are not unique');
 return freeze(result);
};
export const assertFoulTerminalIncomingDefendersCurrent=(db:DatabaseSync,p:FoulTerminalApplicationProposal,c:FoulTerminalHalfChangeCompletion):void=>{
 deriveFoulTerminalIncomingDefenders(db,p,c.source,c.incomingDefenders);
 for(const ref of c.incomingDefenders){const b=binding(db,p,ref.playerId),head=readActualRoleWorkloadState(db,b.careerId,b.playerId,undefined,b.personLinkSourceId);
  if(!head||head.careerId!==b.careerId||head.playerId!==b.playerId||head.revision<ref.workloadRevision||head.effectiveDay>b.gameDay
   ||head.revision===ref.workloadRevision&&hash(head)!==ref.workloadHash)throw new Error('terminal readiness incoming defense current workload differs');}
};
