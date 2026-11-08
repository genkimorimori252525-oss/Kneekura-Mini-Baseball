import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out=process.argv[2]??'docs/verification/releases/v110/matrix-1';await mkdir(out,{recursive:true});
const code=await readFile('dist/native-match-core-browser.js','utf8'),api=new Function(code+';return KneekuraNativeMatchCore;')(),
 base=JSON.parse(await readFile('docs/demos/field-double-play-v106.json','utf8')),report={coreSha256:createHash('sha256').update(code).digest('hex'),cases:[]},
 v=(x=0,y=0,z=0)=>({x,y,z}),physical=(r,role)=>r.fieldInput.players.find(p=>p.playerId===r.fieldInput.defense[role]).physical,
 roles=Object.keys(base.fieldInput.defense),roleFor=(r,id)=>roles.find(role=>r.fieldInput.defense[role]===id)??id;
function run(id,request){
 const raw=JSON.stringify(request),started=performance.now(),r=api.runFieldPracticeV98(request),f=r.field;
 assert.equal(JSON.stringify(request),raw,'authoring mutation '+id);
 const releases=f.facts.filter(x=>x.kind==='throw_release'),throws=releases.map(x=>{
  const command=f.diagnostics.throwEffortCommandsV103.filter(c=>c.playerId===x.playerId&&c.from<=x.elapsedSeconds).at(-1),
   secure=f.facts.filter(c=>c.kind==='catch_secured'&&c.playerId===x.playerId&&c.elapsedSeconds<=x.elapsedSeconds).at(-1),
   receiver=f.frames.filter(a=>a.elapsedSeconds<=x.elapsedSeconds).at(-1)?.fielders.find(a=>a.playerId===x.receiverPlayerId),
   timing=f.diagnostics.aiTelemetry.receiveTimingV99.find(t=>t.throwerPlayerId===x.playerId&&Math.abs(t.elapsedSeconds-x.elapsedSeconds)<1e-8),
   nextSecure=f.facts.find(a=>a.kind==='catch_secured'&&a.playerId===x.receiverPlayerId&&a.tick>x.tick);
  return {...x,throwerRole:roleFor(request,x.playerId),receiverRole:roleFor(request,x.receiverPlayerId),
   sinceSecureSeconds:secure?x.elapsedSeconds-secure.elapsedSeconds:null,command,timing,
   receiverDistanceAtRelease:receiver?Math.hypot(receiver.position.x-x.target.x,receiver.position.z-x.target.z):null,
   receiverSecuredAt:nextSecure?.elapsedSeconds??null};
 });
 const row={id,request,generationMs:performance.now()-started,end:f.end,unresolved:f.diagnostics.unresolvedDetail,
  nextMatchOuts:r.match.outs,outs:f.finalRunners.filter(x=>x.retired).length,retired:f.finalRunners.filter(x=>x.retired).map(x=>x.runnerId),throws,
  actualBaseContacts:f.ruleFacts.controlledBaseContacts,actualTags:f.ruleFacts.controlledRunnerTags,
  contacts:f.diagnostics.aiTelemetry.contactDiagnostics,finalRunners:f.finalRunners,
  preservedField:r.input.field,preservedPlayers:r.input.fielders.map(x=>({playerId:x.playerId,throwSpeedMps:x.throwSpeedMps,
   transferSeconds:x.transferSeconds,topSpeedMps:x.topSpeedMps,fieldRelationshipsV99:x.fieldRelationshipsV99,bodyModelV105:x.bodyModelV105}))};
 report.cases.push(row);console.log(JSON.stringify({id,end:row.end.reason,complete:row.end.complete,outs:row.outs,
  throws:throws.map(x=>({from:x.throwerRole,to:x.receiverRole,base:x.base,delay:x.sinceSecureSeconds,speed:x.command?.commandSpeedMps,
   reason:x.command?.reason,trust:x.timing?.trust,allow:x.timing?.allow,receiverDistance:x.receiverDistanceAtRelease}))}));
}
for(const route of ['643','543'])for(const variant of ['normal','moving','ready','weak','strong','trust-low','trust-high','slow-transfer','wet-small','firm-large']){
 const r=structuredClone(base),holder=route==='643'?'SS':'3B',receiver='2B',i=r.fieldInput;
 // The authored TBD 3B is slower than the SS. A fieldable, legal shifted
 // grounder exercises the requested 5-4-3 instead of one collected by LF.
 i.ball.ball.velocity=route==='643'?v(-8,-2,27):v(-12,-2,14);
 if(route==='543')i.placements['3B']={...i.placements['3B'],x:-18,z:23};
 if(variant==='moving')i.placements[receiver].x=16;
 if(variant==='ready')i.placements[receiver]={...i.placements[receiver],x:i.field.bases.second.x,z:i.field.bases.second.z};
 if(variant==='weak')physical(r,holder).throwSpeedMps=24;
 if(variant==='strong')physical(r,holder).throwSpeedMps=65;
 if(variant.startsWith('trust-'))for(const role of [holder,receiver])physical(r,role).fieldRelationshipsV99=[{
  toPlayerId:i.defense[role===holder?receiver:'1B'],trust:variant==='trust-low'?0:100,coordination:variant==='trust-low'?0:100}];
 if(variant==='slow-transfer')physical(r,holder).transferSeconds=.8;
 if(variant==='wet-small'){i.field.fenceRadiusMeters=95;i.physics.ground.material.rollingDecelerationMps2=.65;
  for(const [role,x]of [['LF',-35],['RF',35]])i.placements[role]={...i.placements[role],x,z:65};}
 if(variant==='firm-large'){i.field.fenceRadiusMeters=125;i.physics.ground.material.rollingDecelerationMps2=1.8;}
 run(route+'-'+variant,r);
}
{
 const r=structuredClone(base),i=r.fieldInput;i.ball.ball.velocity=v(-12,-2,14);
 i.placements['3B']={...i.placements['3B'],x:-18,z:23};
 i.players.find(p=>p.playerId===i.batterRunnerId).physical.topSpeedMps=6;
 run('543-slower-batter',r);
}
for(const variant of ['normal','waiting-relay','strong-holder','strong-no-direction-error','weak-relay','trust-low','trust-high','small-park','large-park']){
 const r=structuredClone(base),i=r.fieldInput;i.outs=2;i.maxPlaySeconds=35;
 i.ball.ball.position=v(0,.2,90);i.ball.ball.velocity=v(0,-1,.1);i.ball.ball.spin=v();
 i.placements.CF={...i.placements.CF,x:0,z:90};i.placements.LF={...i.placements.LF,x:0,z:70};
 physical(r,'CF').throwSpeedMps=variant.startsWith('strong-')?50:16;
 if(variant==='strong-no-direction-error')for(const p of i.players)p.physical.throwDirectionStdRadians=0;
 physical(r,'LF').throwSpeedMps=variant==='weak-relay'?20:38;
 if(variant==='waiting-relay')physical(r,'LF').defensiveDecisionSeconds=1.4;
 if(variant.startsWith('trust-'))for(const role of roles)physical(r,role).fieldRelationshipsV99=roles.filter(x=>x!==role).map(to=>({
  toPlayerId:i.defense[to],trust:variant==='trust-low'?0:100,coordination:variant==='trust-low'?0:100}));
 if(variant==='small-park'){i.field.fenceRadiusMeters=95;i.placements.RF={...i.placements.RF,x:35,z:65};}
 if(variant==='large-park')i.field.fenceRadiusMeters=125;
 i.occupiedBases={first:'0-b1',second:'0-b2',third:'0-b3'};
 for(const id of ['0-b0','0-b1','0-b2','0-b3'])i.players.find(p=>p.playerId===id).physical.topSpeedMps=id==='0-b3'?3:12;
 if(r.context?.beforeMatch)delete r.context.beforeMatch;
 run('relay-'+variant,r);
}
// Completion is a physical play result, not a claim that every attempted race
// must be won. Preserve all rows before checking safety/completion invariants.
report.assertions={allComplete:report.cases.every(c=>c.end.complete),
 allCommandCaps:report.cases.every(c=>c.throws.every(t=>!t.command||t.command.commandSpeedMps<=t.command.capacitySpeedMps+1e-10))};
await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
assert(report.assertions.allComplete,'a physical practice case did not complete; inspect preserved report');
assert(report.assertions.allCommandCaps,'selected output exceeded its authored mode capacity');
console.log(JSON.stringify({cases:report.cases.length,incomplete:report.cases.filter(x=>!x.end.complete).map(x=>x.id),out:out+'/report.json'}));
