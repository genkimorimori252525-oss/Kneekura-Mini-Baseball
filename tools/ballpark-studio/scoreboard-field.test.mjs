import {test} from 'node:test';import assert from 'node:assert/strict';
import {defaultFieldDiagram,scoreboardCapabilities,fieldDiagramFromView} from './scoreboard-field.mjs';
import {koshienDesign,russianDomeDesign,dodgerStadiumDesign,validateDesign} from './model.mjs';
test('field capability is stadium-specific and old design JSON stays untouched',()=>{
 for(const preset of [koshienDesign,russianDomeDesign,dodgerStadiumDesign]){const d=preset(),before=JSON.stringify(d);assert(validateDesign(d).ok);assert.equal(JSON.stringify(d),before);assert.equal(scoreboardCapabilities(d.architecture.style).fieldDiagram,d.architecture.style==='koshien');}
 const d=koshienDesign();d.architecture.scoreboard.fieldDiagram=defaultFieldDiagram();assert(validateDesign(d).ok);d.architecture.style='dodger_stadium';assert(!validateDesign(d).ok);
});
test('optional field data validates names, finite coordinates, role uniqueness and base occupancy',()=>{
 const d=koshienDesign();d.architecture.scoreboard.fieldDiagram=defaultFieldDiagram();assert(validateDesign(d).ok);
 for(const change of [f=>f.defenders[0].x=NaN,f=>f.defenders[1].role='P',f=>f.defenders.pop(),f=>f.defenders[0].label='',f=>f.runners.first='yes',f=>f.version=2,f=>f.enabled=1]){const bad=structuredClone(d);change(bad.architecture.scoreboard.fieldDiagram);assert(!validateDesign(bad).ok);}
});
test('observed positions and occupied bases become an independent read-only display snapshot',()=>{
 const original=defaultFieldDiagram(),view={actors:original.defenders.map(p=>({role:p.role,name:'選手'+p.role,position:{x:p.x+1,y:0,z:p.z+2}})),occupiedBases:{first:true,second:false,third:true}},before=JSON.stringify(view),f=fieldDiagramFromView(view);
 assert.equal(JSON.stringify(view),before);assert.equal(f.defenders[0].x,original.defenders[0].x+1);assert.deepEqual(f.runners,view.occupiedBases);f.runners.first=false;f.defenders[0].x=77;assert(view.occupiedBases.first);assert.equal(view.actors[0].position.x,1);original.enabled=false;assert.equal(fieldDiagramFromView(view,original).enabled,false);assert.throws(()=>fieldDiagramFromView({...view,occupiedBases:{}}));
});
