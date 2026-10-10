import { battedWorldFieldGeometry } from './BattedWorldFieldRoot';
import type { DatabaseSync } from 'node:sqlite';
import { deriveBattedWorldFieldMotionAdoption,type BattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import { battedWorldResponseInput } from './SqliteBattedWorldContinuationStore';
import { battedWorldMotionPrimitiveCommands } from './SqliteBattedWorldMotionStore';
import { ownedScheduledMotionActualState } from './OwnedScheduledMotionState';
import { pendingOwnedScheduledPlan } from './OwnedScheduledMotionExecution';
import { actualReceivedUmpireRenewalMotorEvidenceFromSqlite } from './SqliteActualReceivedUmpireRenewalMotorStore';
import { deriveReceivedRenewalComposition,type ReceivedRenewalComposition } from './ActualReceivedUmpireRenewalComposition';
import { renewalAdoptionInput,renewalExactCut,assertRenewalCut,type RenewalAdoptionExecutionSource } from './ActualReceivedUmpireRenewal';
import { renewalJournal } from './ActualReceivedUmpireRenewalJournal';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableBattedWorldFieldAction } from './SqliteBattedWorldFieldStore';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

/** The physical owner installs the strictly bounded predecessor context before
 * entering this immutable graph. Current qualification is never performed here. */
export const deriveReceivedRenewalPhysicalExecution=(db:DatabaseSync,raw:RenewalAdoptionExecutionSource,
  baseField:DurableBattedWorldFieldAction,prefix:readonly DurableBattedWorldFieldExecution[]):ReceivedRenewalPhysicalExecution=>{
  const source=renewalAdoptionInput(raw),previous=prefix.at(-1),state=ownedScheduledMotionActualState(baseField.field,prefix);
  if(!previous||previous.source.sourceId!==source.previousExecutionSourceId||pendingOwnedScheduledPlan(prefix)||!state.cursor)throw new Error('received renewal adoption requires a resolved predecessor without pending operation');
  const world=baseField.response.touch.worldContact,batter=world.flight.physicalPitch.frame.batterActor!;
  const bindings=[batter.binding,...batter.defenderBindings],tps=world.flight.source.execution.ballFlightParameters.ticksPerSecond;
  const cut=renewalExactCut({originTick:state.moment.originTick,elapsedSeconds:state.moment.elapsedSeconds,tick:state.moment.ball.tick},tps);
  const result=actualReceivedUmpireRenewalMotorEvidenceFromSqlite(db).withOriginal(source.action.renewalMotorSourceId,({value:motor,original})=>{
    const e=original.value,journal=renewalJournal(db,e),stored=db.prepare('SELECT source_id FROM batted_world_field_executions WHERE source_id=?').get(source.sourceId);
    if(stored&&(journal.length!==4||journal[3].source_id!==source.sourceId)||!stored&&journal.length!==3)throw new Error('received renewal physical admission family differs');
    if(e.source.sourceId!==source.action.renewalEnrollmentSourceId||json(original.baseField.source)!==json(baseField.source)
      ||ownedScheduledMotionArchiveHash(original.execution)!==ownedScheduledMotionArchiveHash(previous))throw new Error('received renewal adoption original predecessor differs');
    const composition=deriveReceivedRenewalComposition(source,e,motor,original.selves,bindings,cut);
    const field=deriveBattedWorldFieldMotionAdoption({response:battedWorldResponseInput(baseField.response),geometry:battedWorldFieldGeometry(baseField),
      actors:state.actors,cursor:state.cursor!,carrierPlayerId:state.carrierPlayerId,availableAtTick:cut.tick,coverageThroughTick:composition.coverageThroughTick,
      commands:battedWorldMotionPrimitiveCommands(baseField.response,composition.commands)});
    const at=field.motion.world.moment;
    assertRenewalCut(cut,renewalExactCut({originTick:at.originTick,elapsedSeconds:at.elapsedSeconds,tick:at.ball.tick},tps));
    if(json(at)!==json(state.moment)||json(field.motion.cursor)!==json(state.cursor)||field.motion.carrierPlayerId!==state.carrierPlayerId
      ||field.baseContacts.length||field.motion.world.kind==='boundary')throw new Error('received renewal adoption changed physical time ball cursor or contacts');
    return freeze({kind:'received_renewal_adoption_v1' as const,field,composition,
      adoption:{kind:'received_renewal_adoption_v1' as const,owner:'batted_world_field_executions' as const,sourceId:source.sourceId,
        renewalEnrollmentSourceId:e.source.sourceId,renewalDecisionSourceId:motor.source.renewalDecisionSourceId,renewalMotorSourceId:motor.source.sourceId,
        playerId:e.playerId,adoptedAt:composition.at,executedThrough:composition.at,ticksPerSecond:tps,coverageThroughTick:composition.coverageThroughTick},
      liveWork:{kind:'physical_continuation' as const,sourceId:source.sourceId,originProcessSourceId:e.originProcessSourceId,playerId:e.playerId,dueTick:cut.tick}});
  });
  if(!result)throw new Error('received renewal adoption motor missing');return result;
};
export type ReceivedRenewalPhysicalExecution=Readonly<{
  kind:'received_renewal_adoption_v1';field:BattedWorldFieldMotion;composition:ReceivedRenewalComposition;
  adoption:Readonly<{kind:'received_renewal_adoption_v1';owner:'batted_world_field_executions';sourceId:string;renewalEnrollmentSourceId:string;renewalDecisionSourceId:string;renewalMotorSourceId:string;
    playerId:string;adoptedAt:ReceivedRenewalComposition['at'];executedThrough:ReceivedRenewalComposition['at'];ticksPerSecond:number;coverageThroughTick:number}>;
  liveWork:Readonly<{kind:'physical_continuation';sourceId:string;originProcessSourceId:string;playerId:string;dueTick:number}>;
}>;
