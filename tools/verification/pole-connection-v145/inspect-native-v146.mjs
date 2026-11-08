import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const directory=resolve(process.argv[2]);
const locator=JSON.parse(readFileSync(join(directory,'original-database.json'),'utf8'));
assert.equal(dirname(resolve(locator.path)),directory,'inspect only this original database');
const db=new DatabaseSync(locator.path,{readOnly:true});
try{
  const check=db.prepare('PRAGMA quick_check').all();assert.deepEqual(check.map(x=>Object.values(x)),[['ok']]);
  const pins={};
  for(const [owner,kind]of [['pa_physical_v1_field_roots','root'],['pa_physical_v1_field_steps','step']]){
    pins[kind]=db.prepare(`SELECT source_id,source_hash,snapshot_hash,operation_ordinal FROM main.${owner} ORDER BY operation_ordinal`).all().map(row=>({
      reference:{owner,sourceId:row.source_id,sourceHash:row.source_hash,snapshotHash:row.snapshot_hash},operationOrdinal:row.operation_ordinal}));
  }
  const declarations=new Map(JSON.parse(readFileSync(join(directory,'partial-declarations.json'),'utf8')));
  const impact=declarations.get('pole-native-v146:impact');assert.ok(impact,'exact originally declared impact Source required');
  const output={version:'pv146-original-locators-only',databasePath:locator.path,quickCheck:'ok',pins,
    pendingImpactSource:impact,interpretation:'RAW_LOCATORS_ONLY_NOT_NATIVE_AUTHENTICATION',nativeAdmissionProven:false};
  writeFileSync(join(directory,'original-locators.json'),JSON.stringify(output,null,2));
  console.log(JSON.stringify({quickCheck:'ok',rootRows:pins.root.length,stepRows:pins.step.length,nativeAuthentication:false,
    originalDatabaseCopied:false,originalDatabaseWritten:false}));
}finally{db.close();}
