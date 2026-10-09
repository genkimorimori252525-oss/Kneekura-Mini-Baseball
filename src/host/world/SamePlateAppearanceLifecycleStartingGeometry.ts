import type { DatabaseSync } from 'node:sqlite';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import { actorHash as hash, actorJson as json, actorFreeze as freeze, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertInitialOfficialWorldEvidence, type DurableInitialOfficialWorld } from './SqliteOfficialInitialWorldStore';
import { readPriorActualLiveActivationReadiness, readPriorFoulTerminalActivationReadiness } from './ActualLivePlayClosureEvidenceFromSqlite';
import { samePaFields as fields } from './SamePlateAppearanceWorkPrefix';
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('same-PA starting geometry original setup differs');};
/** Internal normal-owner composition. The enclosing lifecycle phase has already
 * authenticated the actor; this verifies its exact setup Source, never infers
 * base locations from player positions or another game's geometry. */
export const samePaStartingBaseCenters=(db:Pick<DatabaseSync,'prepare'>,actor:DurablePhysicalPlateAppearanceActor):BetweenPlayWorldSetup['baseCenters']=>{
  let setup: BetweenPlayWorldSetup | undefined;
  if('initialWorldSourceId' in actor.source){
    const row=db.prepare('SELECT * FROM main.official_initial_world_sources WHERE source_id=?').get(actor.source.initialWorldSourceId);
    if(!row)throw new Error('same-PA initial setup missing');const initial=JSON.parse(String(row.snapshot_json)) as DurableInitialOfficialWorld;
    assertInitialOfficialWorldEvidence(db,initial,true);same(initial.match,actor.match);same(initial.world,actor.world);same(hash(row),actor.origin.initialWorldHash);setup=initial.source.worldSetup;
  }else if(actor.origin.foulTerminalReadiness){
    const ready=readPriorFoulTerminalActivationReadiness(db,actor.source.activationApplicationId);
    if(!ready)throw new Error('same-PA completed terminal setup missing');same(ready.reference,actor.origin.foulTerminalReadiness);
    const c=ready.archive.result.completion;same(c.nextWorld,actor.world);same(c.activation.nextMatchState,actor.match);setup=c.source.worldSetup;
  }else if(actor.origin.actualLiveReadiness){
    const ready=readPriorActualLiveActivationReadiness(db,actor.source.activationApplicationId);
    if(!ready||ready.kind!=='ready')throw new Error('same-PA completed actual-live setup missing');same(ready.reference,actor.origin.actualLiveReadiness);
    const result=ready.closure.proposal.expectedOfficial;if(!('activation' in result))throw new Error('same-PA final result cannot supply geometry');
    same(result.nextWorld,actor.world);same(result.activation.nextMatchState,actor.match);
    if(ready.closure.source.worldSetup===null)throw new Error('same-PA completed actual-live setup missing');setup=ready.closure.source.worldSetup;
  }else{
    const row=db.prepare('SELECT * FROM main.official_scoring_applications WHERE official_application_id=?').get(actor.source.activationApplicationId);
    if(!row||hash(row)!==actor.origin.scoringHash)throw new Error('same-PA normal activation setup missing or changed');
    const saved=JSON.parse(String(row.request_json));if(json(saved)!==row.request_json)throw new Error('same-PA normal setup archive differs');setup=saved.input?.officialApplication?.worldSetup;
  }
  const centers=setup?.baseCenters;if(!fields(centers,['first','second','third'])||Object.values(centers!).some(p=>!fields(p,['x','z'])||![p.x,p.z].every(Number.isFinite)))throw new Error('same-PA owned starting base centers missing');
  return freeze(centers!);
};
