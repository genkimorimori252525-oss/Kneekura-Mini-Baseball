import {readFile,writeFile,mkdir} from 'node:fs/promises';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),realm={},bundle=await readFile('dist/batting-workbench-core.js'),
 pins=JSON.parse(await readFile('../../outputs/にーくら野球メーカー_v78_球種と縫い目物理版.html.bundle-inputs.json')),
 meta=JSON.parse(await readFile('../../outputs/ばせぼーるlv78_TBD_vs_LAD_球種と縫い目物理版.html.build.json'));
if(sha(bundle)!==pins.entrySha256)throw Error('Consultation source bundle differs');
for(const[path,hash]of Object.entries(pins.inputs))if(sha(await readFile(path))!==hash)throw Error('Consultation input changed: '+path);
vm.runInNewContext(bundle.toString('utf8'),realm);const core=realm.KneekuraBaseballWorkbench,catalog=core.getLivePitchCatalogV78();
const contract={version:78,authority:'CONSULTATION_SUMMARY_NOT_RUNTIME_AUTHORITY',sourceCoreSha256:meta.sourceCoreSha256,
 authoringCoreSha256:sha(bundle),pitchTypes:catalog.types.map(t=>({id:t.pitchType,name:t.name})),presetCount:catalog.presets.length,
 authoringApi:Object.keys(core).filter(k=>/V78$/.test(k)&&typeof core[k]==='function'),
 repertoire:{version:'pitch_repertoire_v78',identity:'pitchId differs from pitchType; multiple pitches of one classification allowed',assignment:'complete immutable physical snapshot',legacy:'V77 fields optional and semantically preserved'},
 spinRepeatability:{field:'physical.minimumSpinRatio',range:[0,1],omitted:1,meaning:'actual magnitude between nominal*minimumSpinRatio and nominal; axis preserved',distribution:'AUTHORED_UNIFORM_NOT_EMPIRICALLY_FITTED',owner:'independent seeded stream after nominal aim solver'},
 seamForce:{version:'baseball_seam_force_v1',coefficientScale:[0,2],referenceMaximumCoefficient:0.25,owner:'shared source physics with material orientation',scope:'AUTHORED_QUASISTEADY_SEAM_GEOMETRY_NOT_CFD_FIT'},
 overhead:{model:'VIRTUAL_HEIGHT_V1',legacyModel:'LEGACY_DIAMETER_V4',default:2,range:[1,8],meaning:'scale height above ground for diameter projection only',groundCenterMeters:0.0366,maximumProjectionRatio:16,camera:'overhead',ballKind:'batted',physicsAffected:false},
 publicAbilities:{traitsChangeBase:false,gameDisplayMaximum:100,plateVisionAbsolute:[1,100]},traits:core.getLiveTraitCatalogV77(),
 limitations:['No empirical 100-game calibration','No real-device mobile certification','Native authenticated continuous world unfinished','See CURRENT-SPEC and original plan for remaining systems']};
await mkdir('docs/design-consultation',{recursive:true});
for(const[path,value]of [['docs/demos/live-pitch-catalog-v78.json',catalog],['docs/design-consultation/runtime-contract-v78.json',contract]])await writeFile(path,JSON.stringify(value,null,2)+'\n');
if(catalog.types.length!==15||catalog.presets.length!==24||contract.traits.length!==17)throw Error('Consultation inventory differs');
const proof={pass:true,sourceCoreSha256:meta.sourceCoreSha256,authoringCoreSha256:sha(bundle),types:catalog.types.length,presets:catalog.presets.length,traits:contract.traits.length,sourceInputCount:Object.keys(pins.inputs).length};
await writeFile('docs/verification/releases/v78/consultation-check.json',JSON.stringify(proof,null,2)+'\n');
console.log(JSON.stringify(proof));
