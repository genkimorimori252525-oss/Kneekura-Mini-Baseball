import assert from 'node:assert/strict';
import {vi} from 'vitest';
import {cloneInert} from '../../../src/core/adjudication/OfficialWindowPolicy';
import {actorJson} from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import * as actors from '../../../src/host/world/SqlitePhysicalPlateAppearanceActorStore';
import {terminalContinuationFixtureIds as ids} from '../../../src/host/world/TerminalContinuationFixtureInputs.test-support';
import {forwardObservedOwner,installObservationHooks,type ReturnedOwnerObserver} from './ReturnedOwnerObservation.test-support';
/** Observe only the actual accepted actor and exact retry. Original readers
 * still prove the completed ancestry and explicit accepted selection. */
export const installNextActorObservationHook=(observer:ReturnedOwnerObserver)=>installObservationHooks(register=>{
 const original=actors.openSqlitePhysicalPlateAppearanceActorStore,spy=vi.spyOn(actors,'openSqlitePhysicalPlateAppearanceActorStore');register(()=>spy.mockRestore());
 spy.mockImplementation((...args)=>forwardObservedOwner(Reflect.apply(original,actors,args),{accept:'actor'},observer));
});
export const assertReturnedNextActor=(raw:readonly Readonly<{operation:string;value:unknown}>[])=>{
 const rows=cloneInert(raw);assert(rows.length===2&&rows.every(row=>row.operation==='actor'),'next actor return inventory differs');
 const [first,retry]=rows.map(row=>row.value)as any[];
 assert.equal(actorJson(first?.source),actorJson({sourceId:ids.nextActorSourceId,sourceVersion:'fixture-v1',gameId:'game-1',playerId:ids.nextActorPlayerId,activationApplicationId:ids.applicationId}),'explicit returned next actor Source differs');
 assert(first.officialRevision===2&&first.match.playId===9&&first.match.outs===2&&first.match.inning===1&&first.match.half==='top','returned next actor frame differs');
 assert.equal(actorJson(first),actorJson(retry),'actual next actor retry differs');
};
