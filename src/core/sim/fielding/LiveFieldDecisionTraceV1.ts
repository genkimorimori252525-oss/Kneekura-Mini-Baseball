import {createCausalDebugTrace,type CausalDebugTraceEntry,type CausalDebugStage} from '../../validation/CausalDebugTrace';
import {quantizeEventTick} from '../ExactEventTime';

/** Diagnostics owns these copies. Neither recording nor truncation feeds a command. */
export function createLiveFieldDecisionTraceV1(input:Readonly<{enabled:boolean;originTick:number;ticksPerSecond:number;seed:number;maximumEntries?:number}>){
  const maximum=input.maximumEntries??2048,entries:CausalDebugTraceEntry[]=[],keys=new Map<string,string>();
  if(!Number.isSafeInteger(maximum)||maximum<9||maximum>16384)throw new Error('invalid field decision trace capacity');
  let sequence=0,droppedEntries=0,deduplicatedEntries=0;
  return {
    record(elapsedSeconds:number,playerId:string,evidence:Readonly<Record<string,unknown>>,key?:string,stage:CausalDebugStage='decision'){
      if(!input.enabled)return;
      if(key!==undefined&&keys.get(playerId+':'+stage)===key){deduplicatedEntries++;return;}
      if(key!==undefined)keys.set(playerId+':'+stage,key);
      const copied=JSON.parse(JSON.stringify({...evidence,playerId,decisionId:playerId+':'+sequence}));
      const entry:CausalDebugTraceEntry={availableAtTick:quantizeEventTick(input.originTick,elapsedSeconds,input.ticksPerSecond),sequence:sequence++,stage,kind:'live_field_'+stage,evidence:copied};
      if(entries.length===maximum){entries.shift();droppedEntries++;}entries.push(entry);
    },
    finish(){
      if(!input.enabled)return undefined;
      return {...createCausalDebugTrace({scenarioId:'live-field-v118',matchSeed:input.seed,playId:0,entries}),
        droppedEntries,deduplicatedEntries,maximumEntries:maximum,readOnly:true as const};
    },
  };
}
