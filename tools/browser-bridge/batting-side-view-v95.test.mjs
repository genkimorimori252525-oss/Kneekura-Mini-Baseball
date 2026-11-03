import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile('tools/browser-bridge/live-batting-setup-view-v95.js','utf8');
function view(){const realm={KneekuraNativeMatchCore:{resolveLiveBattingSetupV94(input){
 assert(['R','L'].includes(input.bats));assert.equal(input.heightMeters,1.78);return input;
}}};vm.runInNewContext(source,realm);return realm.KneekuraBattingSetupViewV94;}
test('uses the resolved hand of a switch hitter and refreshes the cached stance after a hand change',()=>{
 const api=view(),batter={height:1.78,bats:'S',hand:'R',physical:{}};
 assert.equal(api.resolveBatter(batter).bats,'R');batter.hand='L';assert.equal(api.resolveBatter(batter).bats,'L');
});
test('keeps an explicit single side and does not replace invalid input with a default player',()=>{
 const api=view();assert.equal(api.resolveBatter({height:1.78,bats:'L',physical:{}}).bats,'L');
 assert.throws(()=>api.resolveBatter({height:1.78,bats:'S',physical:{}}));assert.throws(()=>api.resolveBatter(null));
});
