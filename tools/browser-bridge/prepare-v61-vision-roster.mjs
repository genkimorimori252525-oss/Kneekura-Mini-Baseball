import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const sha=b=>createHash('sha256').update(b).digest('hex');
const core=await readFile('dist/native-match-core-browser.js','utf8'),realm=vm.createContext({});vm.runInContext(core,realm);
const rosterBytes=await readFile('docs/demos/live-game-roster-v3.json'),referenceBytes=await readFile('docs/demos/live-public-ability-reference-v1.json'),catalogBytes=await readFile('docs/demos/live-game-roster-catalog-v4.json');
const previous=JSON.parse(rosterBytes),reference=JSON.parse(referenceBytes),catalog=JSON.parse(catalogBytes);
realm.inputJson=JSON.stringify({roster:previous,reference});
const result=JSON.parse(vm.runInContext('JSON.stringify(KneekuraNativeMatchCore.materializeLivePlateVisionV1(JSON.parse(inputJson)))',realm));
for(const entry of result.roster.entries){
 const old=previous.entries.find(e=>e.playerId===entry.playerId),{plateVision,...physical}=entry.physical;
 if(JSON.stringify(physical)!==JSON.stringify(old.physical)||entry.sourceId!==old.sourceId)throw Error('Absolute migration changed SI/source identity');
 if(!Number.isFinite(plateVision)||plateVision<1||plateVision>100)throw Error('Invalid migrated vision');
}
const nextCatalog={...catalog,notes:[...(Array.isArray(catalog.notes)?catalog.notes:[catalog.notes]).filter(Boolean),'選球眼は1〜100の絶対能力。既存の個人公開値を初期値として引き継ぎ、リーグ比較では再計算しません。']};
await writeFile('docs/demos/live-game-roster-v61.json',JSON.stringify(result.roster,null,2)+'\n');
await writeFile('docs/demos/live-game-roster-catalog-v61.json',JSON.stringify(nextCatalog,null,2)+'\n');
await writeFile('docs/demos/live-game-roster-v61.migration.json',JSON.stringify({policy:'ONE_TIME_LEGACY_INDIVIDUAL_PUBLIC_VALUE_TO_ABSOLUTE_VISION',sourceRosterSha256:sha(rosterBytes),referenceSha256:sha(referenceBytes),catalogSha256:sha(catalogBytes),coreSha256:sha(core),siAndSourceIdsUnchanged:true,migrations:result.migrations},null,2)+'\n');
console.log(JSON.stringify({players:result.roster.entries.length,visions:result.roster.entries.map(e=>({id:e.playerId,plateVision:e.physical.plateVision})),siUnchanged:true}));
