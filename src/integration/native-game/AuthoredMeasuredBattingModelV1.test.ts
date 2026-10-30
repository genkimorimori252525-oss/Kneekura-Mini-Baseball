import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { initializeAuthoredNativeMatchV1, readAuthoredNativeMatchV1 } from './AuthoredNativeMatchV1';
import { authoredNativeMatchFixture } from './AuthoredNativeMatchV1.test-support';
import { measuredClips } from '../../core/world/psychology/batting/MeasuredBattingFixtures.test-support';
import { openSqlitePlayerBattingModelStore } from '../../host/world/SqlitePlayerBattingModelStore';
import { acceptAuthoredMeasuredBattingFixture } from './AuthoredMeasuredBattingV1.test-support';
const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync;
const audit=(path:string)=>{
  const db=new Native(path,{readOnly:true});
  try{return Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map(r=>[r.name,db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all()]));}finally{db.close();}
};

it('stores measured repertoire on the new Native genesis Person/body and rereads without any author callbacks',()=>{
  const path=join(mkdtempSync(join(tmpdir(),'baseball-measured-native-')),'state.sqlite');
  const declaration=authoredNativeMatchFixture(),genesis=initializeAuthoredNativeMatchV1(path,declaration),before=audit(path);
  const body=genesis.materializations.find(m=>m.source.role==='batter')!;
  const {source,parameters,model:accepted}=acceptAuthoredMeasuredBattingFixture(path,genesis,declaration.clocks[0].namespace,declaration.gameDay);
  expect(accepted.repertoire).toEqual(parameters.repertoire);expect(accepted.bodyMaterialization).toEqual(body);
  expect(accepted.repertoire.values.sampledProfiles![0].measured.frames).toEqual(measuredClips[0].measurements);
  expect(accepted.source.playerId).toBe(genesis.actor.binding.playerId);
  expect(Object.isFrozen(accepted.repertoire.values.sampledProfiles![0].measured.frames)).toBe(true);
  const rows=audit(path),reader=openSqlitePlayerBattingModelStore(path);
  try{expect(reader.read(source.sourceId)).toEqual(accepted);}finally{reader.close();}
  expect(audit(path)).toEqual(rows);
  for(const [table,original] of Object.entries(before))expect(rows[table]).toEqual(original);
  expect(readAuthoredNativeMatchV1(path,genesis.readPins)).toEqual({initial:genesis.initial,actor:genesis.actor,models:genesis.models,
    materializations:genesis.materializations,scene:genesis.scene});
  const evidence=process.env.BASEBALL_MEASURED_MODEL_EVIDENCE;
  if(evidence){
    mkdirSync(evidence,{recursive:false});
    const db=new Native(path,{readOnly:true});try{db.prepare('VACUUM INTO ?').run(join(evidence,'model.sqlite'));}finally{db.close();}
    for(const [name,value] of Object.entries({declaration,genesisPins:genesis.readPins,modelSource:source,parameters,expectedModel:accepted}))
      writeFileSync(join(evidence,name+'.json'),JSON.stringify(value),{flag:'wx'});
  }
},120_000);
