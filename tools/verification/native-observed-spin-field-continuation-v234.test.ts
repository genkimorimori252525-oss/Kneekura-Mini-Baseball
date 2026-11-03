import { expect, it } from 'vitest';
import { initialStationaryControlsV234 } from './native-observed-spin-field-continuation-v234';
it('declares new stationary controls only for the given actor and primitive identities', () => {
  const actors = [{ playerId: 'defender', primitives: [{ role: 'glove' as const }, { role: 'body' as const }] }];
  const commands = initialStationaryControlsV234(actors);
  expect(commands).toEqual([{ playerId: 'defender', bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: [
    { role: 'glove', offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } },
    { role: 'body', offsetVelocity: { x: 0, y: 0, z: 0 }, offsetAcceleration: { x: 0, y: 0, z: 0 } },
  ] }]);
  expect(actors).toEqual([{ playerId: 'defender', primitives: [{ role: 'glove' }, { role: 'body' }] }]);
});

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { admitNativeObservedSpinFieldRootV234, type NativeObservedSpinFieldContinuationV234Input } from './native-observed-spin-field-continuation-v234';
const database = process.env.BASEBALL_V234_DATABASE, inputPath = process.env.BASEBALL_V234_INPUT, outputPath = process.env.BASEBALL_V234_OUTPUT;
it.skipIf(!database || !inputPath || !outputPath)('V234 actual field-root on an owned copy only', () => {
  const codec = createRequire(import.meta.url)('./live-debug-record.mjs') as { parseDebugRecord(s:string):NativeObservedSpinFieldContinuationV234Input; stringifyDebugRecord(v:unknown):string };
  const input = codec.parseDebugRecord(readFileSync(inputPath!, 'utf8')), output=resolve(outputPath!);mkdirSync(output,{recursive:false});
  const save=(name:string,value:unknown)=>writeFileSync(resolve(output,name),codec.stringifyDebugRecord(value)+'\n',{flag:'wx'});let index=0;
  const emit=(name:string,value?:unknown)=>{const n=++index;save('stage-'+n+'-'+name+'.lossless.json',value);appendFileSync(resolve(output,'stages.jsonl'),JSON.stringify({index:n,name})+'\n');};
  try { const result=admitNativeObservedSpinFieldRootV234(database!,input,emit);save('result.lossless.json',result); }
  catch(error){save('failure.json',{error:String((error as Error).stack??error)});throw error;}
}, 600_000);
