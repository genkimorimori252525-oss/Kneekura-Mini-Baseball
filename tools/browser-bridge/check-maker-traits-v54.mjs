import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url),{chromium}=require('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const [artifactArg,evidenceArg,gameArg]=process.argv.slice(2);
if(!artifactArg||!evidenceArg)throw Error('requires NEW v54 executable-trait maker HTML, NEW evidence directory, optional current v54 game HTML');
const artifact=resolve(artifactArg),evidence=resolve(evidenceArg),sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(evidence,{recursive:false});
const sourcePaths=['docs/demos/live-game-roster-v3.json','docs/demos/live-game-roster-catalog-v4.json','docs/demos/live-public-ability-reference-v1.json',
 'docs/demos/live-game-roster-v1.json','docs/demos/live-game-roster-v2.json','docs/demos/live-trait-availability-v54.json'];
const sourceBytes=await Promise.all(sourcePaths.map(path=>readFile(path))),[packet,catalog,reference,legacyV1,legacyV2,availability]=sourceBytes.map(bytes=>JSON.parse(bytes)),legacyPackets=[legacyV1,legacyV2];
const report={artifact,sha256:sha(await readFile(artifact)),inputs:sourcePaths.map((path,i)=>({path,sha256:sha(sourceBytes[i])})),views:[]};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const family='bad_ball_hitting',selected='1-b2',traitSelector='#live-trait-editor [data-trait-family="'+family+'"]';
const close=(a,b,label)=>assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<1e-8,label+': '+a+' / '+b);
const selectedEntry=roster=>roster.entries.find(entry=>entry.playerId===selected);
const selectedTrait=roster=>selectedEntry(roster).traitProfile?.selections.find(trait=>trait.familyId===family);
const traitOf=(roster,id)=>selectedEntry(roster).traitProfile?.selections.find(trait=>trait.familyId===id);
const scalarAt=(value,path)=>path.split('.').reduce((item,key)=>item?.[key],value);
const allLeaves=(value,prefix='')=>Object.entries(value).flatMap(([key,item])=>item&&typeof item==='object'?allLeaves(item,prefix+key+'.'):[prefix+key]);
const onlyPhysicalPaths=(before,after,allowed,label)=>{
 const a=selectedEntry(before).physical,b=selectedEntry(after).physical;
 for(const path of new Set([...allLeaves(a),...allLeaves(b)]))if(!allowed.includes(path))assert.deepEqual(scalarAt(b,path),scalarAt(a,path),label+': unrelated SI '+path);
 assert.deepEqual(after.entries.filter(entry=>entry.playerId!==selected),before.entries.filter(entry=>entry.playerId!==selected),label+': other players');
};
const revealTrait=async(page,id)=>{
 const input=page.locator('#live-trait-editor [data-trait-family="'+id+'"]');
 if(!await input.isVisible())await input.locator('xpath=ancestor::details[@data-trait-secondary]/summary').click();
 return input;
};
const chooseTrait=async(page,id,state)=>{await(await revealTrait(page,id)).selectOption(state);};
const traitProjection=async(page,id)=>(await readTraits(page)).traits.find(trait=>trait.familyId===id);
const ensureInternals=async page=>{if(await page.locator('#live-roster-internals').getAttribute('open')===null)await page.locator('#live-roster-internals > summary').click();};
const checkUnrelated=(before,after,label)=>{
 assert.deepEqual(after.entries.filter(entry=>entry.playerId!==selected),before.entries.filter(entry=>entry.playerId!==selected),label+': other players');
 const {badBallControl:oldControl,...oldPhysical}=selectedEntry(before).physical,{badBallControl:newControl,...newPhysical}=selectedEntry(after).physical;
 assert.deepEqual(newPhysical,oldPhysical,label+': unrelated physical controls');
 assert.equal(typeof oldControl,'number');assert.equal(typeof newControl,'number');
};
const revealAbility=async(page,id)=>{
 const input=page.locator('[data-public-ability="'+id+'"]');
 if(!await input.isVisible())await page.locator('#live-public-secondary > summary').click();
 return input;
};
const readStandalone=page=>page.evaluate(()=>{
 const api=window.baseballMaker,{livePhysicalRoster,...state}=api.getState();
 return{state,result:api.getResult(),revision:api.getRevision(),physics:api.getPhysicsResult(),experiment:api.getReferenceExperimentInput()};
});
const readPacket=page=>page.evaluate(()=>window.baseballMaker.getLiveRoster());
const readTraits=page=>page.evaluate(()=>window.baseballMaker.getTraitProjection());
const readPublic=page=>page.evaluate(()=>window.baseballMaker.getPublicProjection());
const executed=page=>page.evaluate(playerId=>{
 const applied=window.KneekuraBaseballWorkbench.applyLivePhysicalRosterV1({players:window.KneekuraLiveGameRosterCatalog.players,roster:window.baseballMaker.getLiveRoster()});
 const player=applied.players.find(item=>item.playerId===playerId);
 return{physical:player.physical,traitProfile:player.traitProfile??null};
},selected);
const downloadJson=async(page,button)=>{
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator(button).click()]);
 const text=await readFile(await download.path(),'utf8');
 return{text,json:JSON.parse(text),suggestedFilename:download.suggestedFilename()};
};

try{
 assert.equal(packet.entries.length,20);assert.equal(catalog.players.length,20);assert.equal(catalog.fields.length,44);
 assert.equal(availability.entries.length,119);
 close(selectedEntry(packet).physical.badBallControl,.95,'retained approved NLB technique source');
 assert.equal(selectedTrait(packet).stateId,'LEARNED');close(selectedTrait(packet).source.badBallControl,.95,'approved trait source binding');
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:860},acceptDownloads:true}),errors=[],network=[];
  page.on('pageerror',error=>errors.push(String(error)));
  page.on('request',request=>{if(!/^(file:|data:|blob:)/.test(request.url()))network.push(request.url());});
  await page.goto(pathToFileURL(artifact).href);
  await page.waitForFunction(()=>window.baseballMaker?.getPublicProjection()?.abilities.length===10&&window.baseballMaker?.getTraitProjection()?.traits.length===7);
  const definitions=await page.evaluate(()=>window.KneekuraBaseballWorkbench.getLiveTraitCatalogV1());
  assert.equal(definitions.length,7);assert.deepEqual(definitions.map(item=>item.familyId),availability.supportedFamilyIds);
  assert.deepEqual(await page.evaluate(()=>window.KneekuraLiveTraitAvailabilityCatalog),availability);
  assert.equal(await page.locator('#tab-player').getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#maker-preview-column').isVisible(),false);
  assert.equal(await page.locator('#live-roster-player option').count(),20);
  assert.equal(await page.locator('[data-public-ability="badBallControl"]').count(),0,'technique ownership is separate from public abilities');
  assert.equal(await page.locator('[data-roster-path]').count(),44);
  assert.equal(await page.locator('#live-roster-internals').getAttribute('open'),null);
  assert.deepEqual(await readPacket(page),packet);
  const standalone=await readStandalone(page),coverage=[];

  // Every player's secondary abilities remain present without occupying the primary form.
  for(const anchor of reference.anchors){
   await page.locator('#live-roster-player').selectOption(anchor.playerId);
   const identity=catalog.players.find(player=>player.playerId===anchor.playerId),pitcher=identity.role==='P';
   assert.equal(await page.locator('#live-public-secondary').getAttribute('open'),null);
   assert.equal(await page.locator('#live-public-secondary > summary').innerText(),pitcher?'投手の打撃能力':'野手の投球能力');
   assert.equal(await page.locator('[data-public-ability]:visible').count(),pitcher?7:8);
   const shown=await page.locator('[data-public-ability]').evaluateAll(inputs=>inputs.map(input=>({id:input.dataset.publicAbility,value:Number(input.value)})));
   assert.equal(shown.length,10);assert.equal(new Set(shown.map(ability=>ability.id)).size,10);
   for(const ability of shown)close(ability.value,ability.id==='maxSpeedKmh'?anchor.entry.physical.maximumPitchSpeedMps*3.6:anchor.ratings[ability.id],anchor.playerId+'/'+ability.id);
   await page.locator('#live-public-secondary > summary').click();
   assert.equal(await page.locator('[data-public-ability]:visible').count(),10);
   const projection=await readTraits(page),source=packet.entries.find(entry=>entry.playerId===anchor.playerId),owned=source.traitProfile?.selections.find(trait=>trait.familyId===family);
   assert.equal(projection.traits.find(trait=>trait.familyId===family).owned,owned?owned.stateId!==null:null);
   assert.equal(await page.locator(traitSelector).inputValue(),owned?owned.stateId??'':'UNASSESSED');
   assert.equal(await page.locator('[data-trait-family]').count(),7);
   const secondary=page.locator('#live-trait-editor details[data-trait-secondary="'+(pitcher?'batter':'pitcher')+'"]');
   assert.equal(await secondary.count(),1);assert.equal(await secondary.getAttribute('open'),null);
   assert.equal(await page.locator('[data-trait-family]:visible').count(),pitcher?4:6);
   for(const definition of definitions){const input=page.locator('[data-trait-family="'+definition.familyId+'"]');
    assert.equal(await input.getAttribute('data-trait-editor'),definition.editor);
    const options=await input.locator('option').evaluateAll(items=>items.map(item=>item.value));
    for(const state of definition.states)assert(options.includes(state.stateId),'every catalog state is selectable '+definition.familyId+'/'+state.stateId);
   }
   await secondary.locator('summary').click();assert.equal(await page.locator('[data-trait-family]:visible').count(),7);
   const throwing=projection.traits.find(trait=>trait.familyId==='throw_accuracy');
   assert.equal(throwing.status,'DERIVED');assert.equal(throwing.editor,'GRADE');
   assert(!source.traitProfile?.selections.some(trait=>trait.familyId==='throw_accuracy'),'grade is not a saved second authority');
   coverage.push({playerId:anchor.playerId,role:identity.role,primaryCount:pitcher?7:8,publicCount:shown.length,traitStatus:projection.traits.find(trait=>trait.familyId===family).status,throwingGrade:throwing.stateId,traitSecondary:pitcher?'batter':'pitcher'});
  }
  assert.equal(coverage.length,20);assert.deepEqual(await readPacket(page),packet,'browsing all players does not author data');
  await page.locator('#live-roster-player').selectOption(selected);
  const publicBefore=await readPublic(page),onBefore=await readTraits(page);
  assert.equal(await page.locator(traitSelector).inputValue(),'LEARNED');
  assert.equal(onBefore.traits.find(trait=>trait.familyId===family).color,'blue');
  close((await executed(page)).physical.badBallControl,.95,'ON numerical execution owner');

  await page.locator(traitSelector).selectOption('');
  const offPacket=await readPacket(page),offProjection=await readTraits(page);
  assert.equal(selectedTrait(offPacket).stateId,null);close(selectedTrait(offPacket).source.badBallControl,.95,'OFF retains source');
  close(selectedEntry(offPacket).physical.badBallControl,0,'OFF numerical owner');close((await executed(page)).physical.badBallControl,0,'OFF adapter execution');
  assert.equal(offProjection.traits.find(trait=>trait.familyId===family).owned,false);
  assert.equal(await page.locator('[data-roster-path="badBallControl"]').isDisabled(),true);
  assert.deepEqual(await readPublic(page),publicBefore,'OFF preserves all public abilities');checkUnrelated(packet,offPacket,'OFF');

  await page.locator(traitSelector).selectOption('LEARNED');
  const restoredPacket=await readPacket(page);
  close(selectedEntry(restoredPacket).physical.badBallControl,.95,'ON restores original source');
  close(selectedTrait(restoredPacket).source.badBallControl,.95,'ON source is not reinitialized');
  assert.equal(await page.locator('[data-roster-path="badBallControl"]').isDisabled(),false);
  assert.deepEqual(await readPublic(page),publicBefore);checkUnrelated(packet,restoredPacket,'restored ON');
  await page.locator('#live-roster-internals > summary').click();
  await page.locator('[data-roster-path="badBallControl"]').fill('.73');
  assert.equal(await page.locator('[data-roster-path="badBallControl"]').evaluate(input=>input.validationMessage),'');
  const internallyEdited=await readPacket(page);
  close(selectedEntry(internallyEdited).physical.badBallControl,.73,'internal numeric owner');
  close(selectedTrait(internallyEdited).source.badBallControl,.73,'internal source synchronized once');
  close((await readTraits(page)).traits.find(trait=>trait.familyId===family).effectiveSourceValue,.73,'edited effective projection');
  assert.deepEqual(await readPublic(page),publicBefore);checkUnrelated(packet,internallyEdited,'internal source edit');
  await page.locator(traitSelector).selectOption('');
  assert.equal(await page.locator('[data-roster-path="badBallControl"]').isDisabled(),true);
  close(selectedTrait(await readPacket(page)).source.badBallControl,.73,'edited source retained while OFF');
  close((await executed(page)).physical.badBallControl,0,'edited source remains disabled while OFF');
  await page.locator(traitSelector).selectOption('LEARNED');
  close((await executed(page)).physical.badBallControl,.73,'edited source restored once');
  assert.deepEqual(await readStandalone(page),standalone,'trait ownership and numeric editing preserve standalone experiment');

  const traitBaseline=await readPacket(page),stateChecks=[],gradeSources={G:.065,F:.04,E:.024,D:.016,C:.010,B:.006,A:.003,GOLD:.0015},
   gradeFor=value=>Object.entries(gradeSources).reverse().find(([,upper])=>value<=upper)?.[0]??'G';
  for(const definition of definitions)for(const state of definition.states){
   await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),traitBaseline);
   if(definition.editor==='GRADE')await chooseTrait(page,definition.familyId,state.stateId==='GOLD'?'G':'GOLD');
   const before=await readPacket(page);await chooseTrait(page,definition.familyId,state.stateId);
   const after=await readPacket(page),projection=await traitProjection(page,definition.familyId);
   assert.equal(projection.stateId,state.stateId);assert.equal(projection.color,state.color);
   assert.equal(projection.editor,definition.editor);
   assert.equal(await page.locator('[data-trait-family="'+definition.familyId+'"]').evaluate(element=>element.style.color),
    ({blue:'rgb(126, 202, 255)',red:'rgb(255, 138, 138)',green:'rgb(169, 229, 173)',gold:'rgb(241, 207, 101)',neutral:''})[state.color],'rendered state color');
   if(definition.editor==='GRADE'){
    assert.equal(projection.status,'DERIVED');close(selectedEntry(after).physical.throwDirectionStdRadians,gradeSources[state.stateId],'grade writes one actual sigma');
    assert.equal(traitOf(after,'throw_accuracy'),undefined,'grade never creates profile metadata');
    onlyPhysicalPaths(before,after,['throwDirectionStdRadians'],'grade '+state.stateId);
    const shown=await readPublic(page),expected=await page.evaluate(()=>window.KneekuraBaseballWorkbench.projectLivePublicAbilitiesV1({roster:window.baseballMaker.getLiveRoster(),
     reference:window.KneekuraLivePublicAbilityReference,playerId:document.getElementById('live-roster-player').value}));
    assert.deepEqual(shown,expected,'public accuracy projects the same sigma once');
    close(Number(await page.locator('[data-public-ability="throwingAccuracy"]').inputValue()),shown.abilities.find(item=>item.id==='throwingAccuracy').value,'public display follows grade sigma');
   }else if(['pitch_approach','swing_mode_preference'].includes(definition.familyId)){
    assert.deepEqual(traitOf(after,definition.familyId).source,{});onlyPhysicalPaths(before,after,[],'virtual preference');
   }else if(definition.familyId==='running_aggression'){
    const base=selectedEntry(traitBaseline).physical.baserunningSafetyMarginSeconds??.35;
    close(selectedEntry(after).physical.baserunningSafetyMarginSeconds,state.stateId==='AGGRESSIVE'?Math.max(0,base-.25):base,'running source applies once');
    onlyPhysicalPaths(before,after,['baserunningSafetyMarginSeconds'],'running preference');
   }else if(definition.familyId==='fielding_aggression'){
    const base=selectedEntry(traitBaseline).physical.fieldingPursuitCostWeight??1;
    close(selectedEntry(after).physical.fieldingPursuitCostWeight,state.stateId==='AGGRESSIVE'?Math.max(.25,base*.65):base,'fielding source applies once');
    onlyPhysicalPaths(before,after,['fieldingPursuitCostWeight'],'fielding preference');
   }else if(definition.familyId==='plate_aggression'){
    const base=selectedEntry(traitBaseline).physical.swingDecision.threshold;
    close(selectedEntry(after).physical.swingDecision.threshold,Math.max(0,Math.min(1,base+(state.stateId==='AGGRESSIVE'?-.12:state.stateId==='CAUTIOUS'?.12:0))),'plate threshold applies once');
    onlyPhysicalPaths(before,after,['swingDecision.threshold'],'plate preference');
   }else onlyPhysicalPaths(before,after,['badBallControl'],'ownership');
   await chooseTrait(page,definition.familyId,state.stateId);assert.deepEqual(await readPacket(page),after,'repeated state is a true no-op');
   stateChecks.push({familyId:definition.familyId,stateId:state.stateId,color:state.color,editor:definition.editor});
  }

  const baselineDefaults={running_aggression:{key:'baserunningSafetyMarginSeconds',base:selectedEntry(traitBaseline).physical.baserunningSafetyMarginSeconds??.35},
   fielding_aggression:{key:'fieldingPursuitCostWeight',base:selectedEntry(traitBaseline).physical.fieldingPursuitCostWeight??1},
   plate_aggression:{key:'swingDecision.threshold',base:selectedEntry(traitBaseline).physical.swingDecision.threshold}};
  const cycleChecks=[];
  for(const [id,{key,base}]of Object.entries(baselineDefaults)){
   await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),traitBaseline);
   for(const state of ['AGGRESSIVE','BALANCED','AGGRESSIVE',...(id==='plate_aggression'?['CAUTIOUS','AGGRESSIVE']:[]),'','AGGRESSIVE','']){
    await chooseTrait(page,id,state);const current=await readPacket(page);
    const expected=state==='AGGRESSIVE'?id==='running_aggression'?Math.max(0,base-.25):id==='fielding_aggression'?Math.max(.25,base*.65):Math.max(0,base-.12)
     :state==='CAUTIOUS'?Math.min(1,base+.12):base;
    close(scalarAt(selectedEntry(current).physical,key),expected,'nonaccumulating cycle '+id+'/'+state);
    close(Number(traitOf(current,id).source[key]),base,'retained baseline '+id);
    cycleChecks.push({familyId:id,stateId:state||null,effectiveSource:expected});
   }
  }

  await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),traitBaseline);
  for(const id of Object.keys(baselineDefaults))await chooseTrait(page,id,'AGGRESSIVE');
  await chooseTrait(page,'pitch_approach','BREAKING');await chooseTrait(page,'swing_mode_preference','POWER');
  const combined=await readPacket(page),directChecks=[];
  for(const [id,path,value]of [['running_aggression','baserunningSafetyMarginSeconds',1.2],['fielding_aggression','fieldingPursuitCostWeight',.77],
   ['plate_aggression','swingDecision.threshold',.61]]){
   await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),combined);await ensureInternals(page);
   const input=page.locator('[data-roster-path="'+path+'"]'),same=scalarAt(selectedEntry(combined).physical,path);
   await input.fill(String(same));assert.deepEqual(selectedEntry(await readPacket(page)).traitProfile,selectedEntry(combined).traitProfile,'no-op detail preserves metadata');
   await input.fill(String(value));assert.equal(await input.evaluate(element=>element.validationMessage),'');
   const direct=await readPacket(page);assert.equal(traitOf(direct,id),undefined,'direct source edit removes only its green metadata');
   for(const selection of selectedEntry(combined).traitProfile.selections.filter(item=>item.familyId!==id))assert.deepEqual(traitOf(direct,selection.familyId),selection,'other metadata retained');
   close(scalarAt(selectedEntry(direct).physical,path),value,'direct SI wins');onlyPhysicalPaths(combined,direct,[path],'direct '+id);
   directChecks.push({familyId:id,path,value});
  }
  await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),traitBaseline);await ensureInternals(page);
  const accuracyBefore=(await readPublic(page)).abilities.find(item=>item.id==='throwingAccuracy'),accuracyValue=accuracyBefore.value>98?accuracyBefore.value-2:accuracyBefore.value+2;
  await(await revealAbility(page,'throwingAccuracy')).fill(String(accuracyValue));
  const accuracyPacket=await readPacket(page),accuracyProjection=await traitProjection(page,'throw_accuracy');
  assert.equal(accuracyProjection.stateId,gradeFor(selectedEntry(accuracyPacket).physical.throwDirectionStdRadians));
  assert.equal(await page.locator('[data-trait-family="throw_accuracy"]').inputValue(),accuracyProjection.stateId);
  assert.equal(traitOf(accuracyPacket,'throw_accuracy'),undefined);
  await page.locator('[data-roster-path="throwDirectionStdRadians"]').fill('.04');
  assert.equal((await traitProjection(page,'throw_accuracy')).stateId,'F');assert.equal((await traitProjection(page,'throw_accuracy')).color,'red');
  assert.equal(traitOf(await readPacket(page),'throw_accuracy'),undefined);
  const missingGrade=await page.evaluate(({roster,playerId})=>{const missing=structuredClone(roster);delete missing.entries.find(item=>item.playerId===playerId).physical.throwDirectionStdRadians;
   return window.KneekuraBaseballWorkbench.projectLiveTraitProfilesV1({roster:missing,playerId}).traits.find(item=>item.familyId==='throw_accuracy');},{roster:traitBaseline,playerId:selected});
  assert.equal(missingGrade.status,'UNASSESSED');assert.equal(missingGrade.stateId,null);assert.equal(missingGrade.sourceValue,null);

  // Unsupported inventory is presentation-only and must never author a family.
  await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),traitBaseline);
  const unsupported=availability.entries.filter(entry=>!definitions.some(definition=>definition.familyId===entry.familyId));
  assert.equal(unsupported.length,112);assert.equal(await page.locator('[data-unsupported-trait]').count(),112);
  for(const entry of unsupported){const row=page.locator('[data-unsupported-trait="'+entry.familyId+'"]');
   assert.equal(await row.getAttribute('data-trait-availability'),entry.status);assert(['UNSUPPORTED','OUT_OF_SCOPE','REVIEW_REQUIRED'].includes(entry.status));
   assert.equal(await row.locator('input,select,button').count(),0);assert((await row.textContent()).includes(entry.userReason??entry.reason),'Japanese unsupported reason '+entry.familyId);
  }
  const beforeSearch=JSON.stringify(await readPacket(page));await page.locator('#live-trait-unsupported > summary').click();
  await page.locator('#live-trait-search').fill('レーザー');
  assert.equal(await page.locator('[data-unsupported-trait="throw_velocity_descriptor"]').isVisible(),true);
  assert.equal(await page.locator('[data-unsupported-trait="pitch_pressure"]').isVisible(),false);
  await page.locator('#live-trait-search').fill('');assert.equal(await page.locator('[data-unsupported-trait]:visible').count(),112);
  assert.equal(JSON.stringify(await readPacket(page)),beforeSearch,'search never changes source packet');
  const rejection=await page.evaluate(()=>{const api=window.baseballMaker,before=JSON.stringify(api.getState()),checks=[];
   for(const familyId of ['pitch_pressure','throw_velocity_descriptor','throw_accuracy']){
    const forged=structuredClone(api.getLiveRoster()),entry=forged.entries.find(item=>item.playerId==='1-b2');
    entry.traitProfile.selections.push({familyId,stateId:familyId==='throw_accuracy'?'GOLD':'LEARNED',source:familyId==='throw_accuracy'?{throwDirectionStdRadians:.0015}:{}});
    let error=null;try{api.importLiveRoster(forged);}catch(problem){error=problem.message;}
    if(!error||JSON.stringify(api.getState())!==before)throw Error('non-atomic unsupported or duplicate-authority import '+familyId);
    checks.push({familyId,error});
   }return checks;
  });
  assert.deepEqual(await readStandalone(page),standalone,'all seven trait controls preserve standalone experiment');
  await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),traitBaseline);
  let authored=await readPacket(page);const editChecks=[];
  // Public round trips must preserve the trait source as well as every other player.
  for(const ability of publicBefore.abilities){
   await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),authored);
   const value=ability.value+2<=ability.max?ability.value+2:ability.value-2;
   for(const nextValue of [value,ability.value]){
    const expected=await page.evaluate(({playerId,abilityId,value})=>window.KneekuraBaseballWorkbench.editLivePublicAbilityV1({roster:window.baseballMaker.getLiveRoster(),
     reference:window.KneekuraLivePublicAbilityReference,playerId,abilityId,value}),{playerId:selected,abilityId:ability.id,value:nextValue});
    await(await revealAbility(page,ability.id)).fill(String(nextValue));
    assert.equal(await page.locator('[data-public-ability="'+ability.id+'"]').evaluate(input=>input.validationMessage),'');
    const actual=await readPacket(page);assert.deepEqual(actual,expected.roster,'public UI source update '+ability.id);
    close(Number(await page.locator('[data-public-ability="'+ability.id+'"]').inputValue()),nextValue,'public round trip '+ability.id);
    assert.deepEqual(selectedTrait(actual),selectedTrait(authored),'public edit preserves trait source');
    close(selectedEntry(actual).physical.badBallControl,.73,'public edit preserves executed bad-ball source');
    assert.deepEqual(actual.entries.filter(entry=>entry.playerId!==selected),authored.entries.filter(entry=>entry.playerId!==selected),'public edit preserves other players');
    const changed=new Set(expected.changes.map(change=>change.path));
    for(const [path,oldValue]of Object.entries(selectedEntry(authored).physical))if(!changed.has(path))assert.deepEqual(selectedEntry(actual).physical[path],oldValue,'unrelated SI '+ability.id+'/'+path);
    editChecks.push({abilityId:ability.id,value:nextValue,changes:expected.changes});
   }
  }
  assert.equal(editChecks.length,20);assert.deepEqual(await readStandalone(page),standalone,'public editing preserves standalone experiment');

  await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),combined);
  await chooseTrait(page,'throw_accuracy','GOLD');await chooseTrait(page,'throw_accuracy','B');
  close(selectedEntry(await readPacket(page)).physical.throwDirectionStdRadians,.006,'final packet carries the authored grade source');
  // Put virtual preferences on the actual first batter/pitcher as well, so an
  // optional game import can prove they reach the first issued normal pitch.
  await page.locator('#live-roster-player').selectOption('0-b0');await chooseTrait(page,'swing_mode_preference','POWER');
  await page.locator('#live-roster-player').selectOption('1-p0');await chooseTrait(page,'pitch_approach','BREAKING');
  await page.locator('#live-roster-player').selectOption(selected);authored=await readPacket(page);
  assert.equal(traitOf(authored,'throw_accuracy'),undefined);assert.deepEqual(traitOf(authored,'pitch_approach').source,{});
  assert.deepEqual(traitOf(authored,'swing_mode_preference').source,{});
  for(const playerId of ['0-b0','1-p0'])assert.deepEqual(authored.entries.find(entry=>entry.playerId===playerId).physical,packet.entries.find(entry=>entry.playerId===playerId).physical,'virtual first-actor preference preserves SI');

  const legacyChecks=[];
  for(let index=0;index<legacyPackets.length;index++){
   const legacy=legacyPackets[index],serialized=JSON.stringify(legacy);
   await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),legacy);
   for(const identity of catalog.players){
    await page.locator('#live-roster-player').selectOption(identity.playerId);
    assert.equal(await page.locator(traitSelector).inputValue(),'UNASSESSED');
    const projection=(await readTraits(page)).traits.find(trait=>trait.familyId===family);
    assert.equal(projection.owned,null);assert.equal(projection.status,'UNASSESSED');
    close(projection.effectiveSourceValue,legacy.entries.find(entry=>entry.playerId===identity.playerId).physical.badBallControl,'legacy numerical source retained');
    const grade=(await readTraits(page)).traits.find(trait=>trait.familyId==='throw_accuracy'),sigma=legacy.entries.find(entry=>entry.playerId===identity.playerId).physical.throwDirectionStdRadians;
    assert.equal(grade.status,sigma===undefined?'UNASSESSED':'DERIVED');assert.equal(grade.stateId,sigma===undefined?null:gradeFor(sigma));
   }
   const current=await readPacket(page);assert.equal(JSON.stringify(current),serialized,'legacy serialized bytes unchanged after projection');
   assert(current.entries.every(entry=>!Object.hasOwn(entry,'traitProfile')),'legacy import does not infer ownership');
   const downloaded=await downloadJson(page,'#export-live-roster');
   assert.equal(downloaded.text,JSON.stringify(legacy,null,2)+'\n','legacy export has exact canonical JSON bytes');
   legacyChecks.push({version:index+1,serializedSha256:sha(Buffer.from(serialized)),canonicalExportSha256:sha(Buffer.from(downloaded.text)),allPlayersUnassessed:true});
  }

  await page.evaluate(value=>window.baseballMaker.importLiveRoster(value),authored);
  await page.locator('#live-roster-player').selectOption(selected);
  const exported=await downloadJson(page,'#export-live-roster');assert.deepEqual(exported.json,authored);
  const full=await downloadJson(page,'#save-json');assert.deepEqual(full.json,await page.evaluate(()=>window.baseballMaker.getState()));
  // Exercise both real JSON file inputs, and a fresh document load.
  await page.locator('#live-roster-file').setInputFiles({name:'trait-roster.json',mimeType:'application/json',buffer:Buffer.from(exported.text)});
  assert.deepEqual(await readPacket(page),authored);
  await page.reload();await page.waitForFunction(()=>window.baseballMaker?.getTraitProjection());
  await page.locator('#import-file').setInputFiles({name:'trait-state.json',mimeType:'application/json',buffer:Buffer.from(full.text)});
  await page.waitForFunction(expected=>JSON.stringify(window.baseballMaker.getLiveRoster())===expected,JSON.stringify(authored));
  assert.deepEqual(await page.evaluate(()=>window.baseballMaker.getState()),full.json);
  await page.locator('#live-roster-player').selectOption(selected);
  assert.equal(await page.locator(traitSelector).inputValue(),'LEARNED');close((await executed(page)).physical.badBallControl,.73,'reload retains one executed source');
  assert.equal((await traitProjection(page,'throw_accuracy')).stateId,'B');assert.equal(traitOf(await readPacket(page),'throw_accuracy'),undefined);
  const reloadedStandalone=await readStandalone(page);
  // A full-state import explicitly recomputes the same standalone experiment;
  // unlike trait-only edits, that operation may advance its revision counter.
  assert.deepEqual({...reloadedStandalone,revision:standalone.revision},standalone,'reload preserves the standalone experiment state and result');
  assert(reloadedStandalone.revision>=standalone.revision);
  if(await page.locator('#live-roster-internals').getAttribute('open')!==null)await page.locator('#live-roster-internals > summary').click();
  await page.screenshot({path:resolve(evidence,'trait-maker-'+width+'.png'),fullPage:true});

  const gameChecks=[];
  if(gameArg){
   const gamePage=await browser.newPage({viewport:{width,height:860}});
   gamePage.on('pageerror',error=>errors.push('game: '+String(error)));
   await gamePage.goto(pathToFileURL(resolve(gameArg)).href);await gamePage.waitForFunction(()=>window.liveMatchPlayback?.inspect().physicalRoster);
   for(const [label,state,expectedSource]of [['OFF',{...full.json,livePhysicalRoster:offPacket},0],['ON',full.json,.73]]){
    await gamePage.locator('#physical-roster-file').setInputFiles({name:'trait-'+label+'.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(state))});
    await gamePage.waitForFunction(()=>document.getElementById('physical-roster-status').dataset.error==='false');
    await gamePage.locator('#batting-choice').selectOption('auto');await gamePage.locator('#managed-team').selectOption('0');
    await gamePage.evaluate(()=>{window.liveMatchPlayback.newGame();document.getElementById('next-pitch').click();window.liveMatchPlayback.stop();});
    const game=await gamePage.evaluate(playerId=>{const state=window.liveMatchPlayback.inspect();return{error:state.error,packet:state.physicalRoster.active,
     player:state.physicalRoster.players.find(player=>player.playerId===playerId),generatedPitches:state.generatedPitches,frames:state.lastResult.frames.length,version:state.version,
     traitPreferences:state.host.history.at(-1).play.diagnostics.traitPreferences??null};},selected);
    assert.equal(game.error,null);assert.deepEqual(game.packet,state.livePhysicalRoster);assert.equal(game.generatedPitches,1);assert(game.frames>1);
    assert.deepEqual(game.player.physical,selectedEntry(state.livePhysicalRoster).physical);close(game.player.physical.badBallControl,expectedSource,label+' normal-game source');
    assert.deepEqual(game.player.traitProfile,selectedTrait(state.livePhysicalRoster)?selectedEntry(state.livePhysicalRoster).traitProfile:undefined);
    if(label==='ON'){
     close(game.player.physical.throwDirectionStdRadians,.006,'normal game receives one grade sigma');
     close(game.player.physical.baserunningSafetyMarginSeconds,.1,'normal game receives adjusted running source');
     close(game.player.physical.fieldingPursuitCostWeight,.65,'normal game receives adjusted pursuit source');
     close(game.player.physical.swingDecision.threshold,selectedEntry(packet).physical.swingDecision.threshold-.12,'normal game receives adjusted plate source');
     assert.equal(game.traitPreferences.batting.preference,'POWER');assert.equal(game.traitPreferences.batting.resolvedCommand,'power');assert.equal(game.traitPreferences.batting.source,'player_preference');
     assert.equal(game.traitPreferences.pitching.preference,'BREAKING');assert.equal(game.traitPreferences.pitching.source,'player_preference');
    }
    gameChecks.push({state:label,sourceValue:expectedSource,generatedPitches:game.generatedPitches,frames:game.frames,version:game.version,traitPreferences:game.traitPreferences});
   }
   await gamePage.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(network,[]);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  report.views.push({width,coverage,selected,originalSource:.95,restoredOriginalSource:.95,editedSource:.73,offSource:0,editChecks,legacyChecks,stateChecks,cycleChecks,directChecks,rejection,
   catalogFamilyCount:definitions.length,availabilityCount:availability.entries.length,unsupportedCount:unsupported.length,missingGrade,
   internalSourceSynchronized:true,offNumericEditorDisabled:true,standaloneUnchanged:true,completeStateRoundTrip:true,gameChecks,errors,network});
  await page.close();
 }
 for(const input of report.inputs)assert.equal(sha(await readFile(input.path)),input.sha256,'source file bytes unchanged: '+input.path);
 report.status='PASS';await writeFile(resolve(evidence,'trait-maker-check.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:'PASS',widths:report.views.map(view=>view.width),players:20,publicAbilities:10,internalFields:44,
  traitFamilies:7,availabilityEntries:119,unsupportedEntries:112,legacyVersions:[1,2],gameImportChecked:!!gameArg}));
}catch(error){
 report.status='FAIL';report.error=error.stack;await writeFile(resolve(evidence,'trait-maker-check.json'),JSON.stringify(report,null,2)+'\n');throw error;
}finally{await browser.close();}
