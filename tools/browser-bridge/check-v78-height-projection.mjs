import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const realm={},path=process.argv[2]??'tools/browser-bridge/live-ball-display-controls-v78.js';
vm.runInNewContext(await readFile(path,'utf8'),realm);
const api=realm.KneekuraBallDisplayControls,plain=x=>JSON.parse(JSON.stringify(x));
assert.equal(api.defaults.overheadHeightModel,'VIRTUAL_HEIGHT_V1');
const ground=.0366,projection=Object.freeze({eye:Object.freeze({x:0,y:100,z:0}),yaw:0,pitch:Math.PI/2,f:100,cx:300,cy:216});
const close=(a,b)=>assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const size=(height,factor,kind='batted',camera='overhead',p=projection)=>{
 api.configure({overheadHeightEmphasis:factor});
 const position=Object.freeze({x:0,y:ground+height,z:0});
 return api.heightSizingForProjection({camera,kind,position,projection:p,groundDisplayDiameterPx:1.25,legacyDisplayDiameterPx:1.25});
};
let cases=0;
for(const height of [0,.001,.1,.5,2,10,30])for(const factor of [1,1.1,1.5,2,4,8]){
 const actual=size(height,factor),virtualHeight=height*factor,D=100-ground,ratio=D/Math.max(D/16,D-virtualHeight);
 close(actual.diameterPx,1.25*ratio);close(actual.virtualHeightMeters,virtualHeight);
 assert.equal(actual.clamped,virtualHeight>D*15/16);cases++;
}
close(size(2,2).diameterPx,size(4,1).diameterPx);
close(size(10,2).diameterPx,size(20,1).diameterPx);
assert(size(2,2).diameterPx<2*size(2,1).diameterPx,'height projection is not a constant diameter multiplier');
for(const factor of[1,2,8])close(size(0,factor).diameterPx,1.25);
for(const camera of['batter','catcher','mound','fielder','runner'])assert.equal(size(10,8,'batted',camera).diameterPx,1.25);
for(const kind of['pitch','throw'])assert.equal(size(10,8,kind).diameterPx,1.25);
const before=plain(projection);size(2,2);assert.deepEqual(plain(projection),before);
assert.equal(api.normalizeImportedSettings({overheadHeightEmphasis:2}).overheadHeightModel,'LEGACY_DIAMETER_V4');
assert.equal(api.normalizeImportedSettings({overheadHeightModel:'VIRTUAL_HEIGHT_V1',overheadHeightEmphasis:2}).overheadHeightModel,'VIRTUAL_HEIGHT_V1');
const legacyRealm={};vm.runInNewContext(await readFile('tools/browser-bridge/live-ball-display-controls-v76.js','utf8'),legacyRealm);
api.configure({overheadHeightModel:'LEGACY_DIAMETER_V4'});
for(const height of[0,.0366,.1,.5366,1,1.5366,2,10])for(const factor of[1,1.00001,1.5,2,8]){
 api.configure({overheadHeightEmphasis:factor});legacyRealm.KneekuraBallDisplayControls.configure({overheadHeightEmphasis:factor});
 assert.deepEqual(plain(api.heightSizingFor('overhead',.2,.15,1.25,1.25,height)),plain(legacyRealm.KneekuraBallDisplayControls.heightSizingFor('overhead',.2,.15,1.25,1.25,height)));
}
const current=plain(api.inspect());let getter=false;const bad={};Object.defineProperty(bad,'overheadHeightModel',{enumerable:true,get(){getter=true;return 'VIRTUAL_HEIGHT_V1';}});
for(const input of[{overheadHeightModel:'unknown'},{overheadHeightModel:1},{overheadHeightEmphasis:9},bad]){
 assert.throws(()=>api.configure(input));assert.deepEqual(plain(api.inspect()),current);
}
assert.equal(getter,false);
console.log(JSON.stringify({pass:true,projectionCases:cases,twoMetersAtTwoEqualsFourMetersAtOne:true,groundInvariant:true,legacyExactCases:40,otherCamerasAndBallKindsUnchanged:true,physicsChanged:false}));
