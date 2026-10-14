import {vi} from 'vitest';
import {SqliteOfficialStateStore} from '../../../src/host/SqliteOfficialStateStore';
import * as scoring from '../../../src/host/SqliteOfficialScoringStore';
import * as effort from '../../../src/host/world/SqliteOfficialPitchWorkloadStore';
import * as workload from '../../../src/host/world/SqlitePlayerWorkloadRecoveryStore';
import * as closure from '../../../src/host/world/SqlitePhysicalPlayClosureStore';
import {forwardObservedOwner,installObservationHooks,observeReturnedMethod,type ReturnedOwnerObserver} from './ReturnedOwnerObservation.test-support';
/** Install only after real modules initialize, before any owner opens. No
 * module reset/importOriginal cycle, global SQL hook or substituted receipt. */
export const installCompletionOwnerObservationHooks=(observer:ReturnedOwnerObserver)=>
 installObservationHooks(register=>{
   for(const name of ['applyAndActivate','applyAndFinalize']as const){const original=SqliteOfficialStateStore.prototype[name];const spy=vi.spyOn(SqliteOfficialStateStore.prototype,name);register(()=>spy.mockRestore());spy.mockImplementation(observeReturnedMethod(original,'official.'+name,observer));}
   const scoreOpen=scoring.openSqliteOfficialScoringStore,scoreSpy=vi.spyOn(scoring,'openSqliteOfficialScoringStore');register(()=>scoreSpy.mockRestore());scoreSpy.mockImplementation((...args)=>forwardObservedOwner(Reflect.apply(scoreOpen,scoring,args),{apply:'scoring'},observer));
   const effortOpen=effort.openSqliteOfficialPitchWorkloadStore,effortSpy=vi.spyOn(effort,'openSqliteOfficialPitchWorkloadStore');register(()=>effortSpy.mockRestore());effortSpy.mockImplementation((...args)=>forwardObservedOwner(Reflect.apply(effortOpen,effort,args),{accept:'effort'},observer));
   const workloadOpen=workload.openSqlitePlayerWorkloadRecoveryStore,workloadSpy=vi.spyOn(workload,'openSqlitePlayerWorkloadRecoveryStore');register(()=>workloadSpy.mockRestore());workloadSpy.mockImplementation((...args)=>forwardObservedOwner(Reflect.apply(workloadOpen,workload,args),{apply:'workload'},observer));
   const closureOpen=closure.openSqlitePhysicalPlayClosureStore,closureSpy=vi.spyOn(closure,'openSqlitePhysicalPlayClosureStore');register(()=>closureSpy.mockRestore());closureSpy.mockImplementation((...args)=>forwardObservedOwner(Reflect.apply(closureOpen,closure,args),{resume:'completion'},observer));
  });
