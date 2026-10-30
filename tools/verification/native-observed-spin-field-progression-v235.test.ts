import { expect, it } from 'vitest';
import { planInitialDefenderClockV235, initialSensoryHorizonV235 } from './native-observed-spin-field-progression-v235';
it('uses the authenticated contact cut and limits observation to common body coverage',()=>{
 expect(planInitialDefenderClockV235(100,100,[{startTick:100,endTick:150},{startTick:90,endTick:140}])).toEqual({observationTick:100,coverageThroughTick:140,elapsedTicks:0});
 expect(()=>planInitialDefenderClockV235(99,100,[{startTick:100,endTick:150}])).toThrow();
 expect(()=>planInitialDefenderClockV235(100,100,[{startTick:101,endTick:150}])).toThrow();
 expect(()=>planInitialDefenderClockV235(100,100,[])).toThrow();
});

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { advanceNativeObservedSpinFieldClockV235, type NativeObservedSpinFieldClockV235Input } from './native-observed-spin-field-progression-v235';
const dbPath=process.env.BASEBALL_V235_DATABASE,inputPath=process.env.BASEBALL_V235_INPUT,outputPath=process.env.BASEBALL_V235_OUTPUT;
it.skipIf(!dbPath||!inputPath||!outputPath)('V235 actual field progression on an owned copy only',()=>{
 const codec=createRequire(import.meta.url)('./live-debug-record.mjs') as {parseDebugRecord(s:string):NativeObservedSpinFieldClockV235Input;stringifyDebugRecord(v:unknown):string};
 const input=codec.parseDebugRecord(readFileSync(inputPath!,'utf8')),out=resolve(outputPath!);mkdirSync(out,{recursive:false});let index=0;
 const save=(name:string,value:unknown)=>writeFileSync(resolve(out,name),codec.stringifyDebugRecord(value)+'\n',{flag:'wx'});
 const emit=(name:string,value?:unknown)=>{const i=++index;save('stage-'+i+'-'+name+'.lossless.json',value);appendFileSync(resolve(out,'stages.jsonl'),JSON.stringify({index:i,name})+'\n')};
 try{const result=advanceNativeObservedSpinFieldClockV235(dbPath!,input,emit);save('result.lossless.json',result)}catch(e){save('failure.json',{error:String((e as Error).stack??e)});throw e}
},900_000);

it('declares only one millisecond within original body coverage',()=>{
 expect(initialSensoryHorizonV235(100,1_000_000,1200,[{startTick:100,endTick:1200}])).toBe(1100);
 expect(()=>initialSensoryHorizonV235(100,1_000,1200,[{startTick:100,endTick:1200}])).toThrow();
 expect(initialSensoryHorizonV235(100,1_000_000,1099,[{startTick:100,endTick:1200}])).toBe(1099);
 expect(initialSensoryHorizonV235(100,1_000_000,1200,[{startTick:100,endTick:101}])).toBe(101);
 expect(()=>initialSensoryHorizonV235(100,1_000_000,100,[{startTick:100,endTick:1200}])).toThrow();
});
