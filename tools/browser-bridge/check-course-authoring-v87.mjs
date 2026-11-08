import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const file=resolve(process.argv[2]),directory=resolve(process.argv[3]??'docs/verification/releases/v87/course-authoring'),sha=value=>createHash('sha256').update(value).digest('hex');
const report={pass:false,file,artifactSha256:sha(await readFile(file)),cases:[],faults:[]};await mkdir(directory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),faults={width,errors:[],external:[]};report.faults.push(faults);
  page.on('pageerror',error=>faults.errors.push(String(error)));page.on('request',request=>{if(!/^(file:|data:|blob:|about:)/.test(request.url()))faults.external.push(request.url());});
  await page.goto(pathToFileURL(file).href,{timeout:60000});await page.waitForFunction(()=>globalThis.KneekuraBatterMakerV79);await page.locator('#tab-course-v79').click();
  assert.equal(await page.locator('#course-map-v87 [data-zone-id]').count(),13,'public editing uses 13 regions');
  const original=await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()));
  await page.locator('#course-value-v79').fill('0.333');assert.equal(await page.locator('#course-map-v87 [data-zone-id="5"] [data-zone-average]').textContent(),'.333');
  assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),original,'preview preserves canonical roster');
  await page.locator('#tab-player').click();await page.locator('#tab-course-v79').click();assert.equal(await page.locator('#course-value-v79').inputValue(),'0.333','draft survives tabs');
  await page.locator('#course-cancel-v79').click();assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),original,'cancel preserves canonical roster');
  await page.locator('#course-value-v79').fill('0.333');await page.locator('#course-apply-v79').click();
  const saved=await page.evaluate(()=>{const id=KneekuraBatterMakerV79.inspect().playerId;return baseballMaker.getLiveRoster().entries.find(row=>row.playerId===id).physical.batterCourseProfileV87;});assert.equal(saved.referenceAverages[4],.333);
  const fanBefore=await page.locator('#course-direction-input-v79 [data-direction-fill]').nth(2).getAttribute('d');
  await page.locator('#course-direction-value-v79').fill('80');assert.notEqual(await page.locator('#course-direction-input-v79 [data-direction-fill]').nth(2).getAttribute('d'),fanBefore);
  assert.match(await page.locator('#course-direction-input-v79 svg').textContent(),/80.0%/);await page.locator('#course-direction-apply-v79').click();
  assert.equal(await page.evaluate(()=>KneekuraBatterMakerV79.getPreviewV87().profile.directionWeights[2]),.8);
  const committed=await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()));
  for(const layer of ['adapted','public','mlb']){await page.locator('#course-layer-v87').selectOption(layer);assert.equal(await page.locator('#course-map-v87 [data-zone-id]').count(),13);assert(await page.locator('#course-value-v79').isDisabled());}
  assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),committed,'comparison layers never replace author values');
  await page.locator('#course-layer-v87').selectOption('innate');await page.locator('#course-value-v79').fill('');assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),committed,'partial input never writes');await page.locator('#course-cancel-v79').click();
  await page.locator('#course-recognition-v87').evaluate(node=>node.open=true);
  const gridShape=await page.locator('.course-recognition-grid-v87').evaluate(grid=>{
   const box=grid.getBoundingClientRect(),strike=grid.querySelector('.course-recognition-strike-v87')?.getBoundingClientRect(),style=getComputedStyle(grid),cells=[...grid.querySelectorAll('[data-recognition-course]')];
   return {width:box.width,height:box.height,borderColor:style.borderTopColor,borderStyle:style.borderTopStyle,ids:cells.map(node=>Number(node.dataset.recognitionCourse)),
    central:cells.filter(node=>{const id=Number(node.dataset.recognitionCourse);return Math.floor(id/10)>=3&&Math.floor(id/10)<=7&&id%10>=1&&id%10<=5;}).map(node=>({id:Number(node.dataset.recognitionCourse),color:getComputedStyle(node).color})),
    lineStyle:getComputedStyle(cells[0]).borderRightStyle,columns:[...grid.parentElement.querySelectorAll('.course-recognition-columns-v87 span')].map(node=>node.textContent),rows:[...grid.parentElement.querySelectorAll('.course-recognition-rows-v87 span')].map(node=>node.textContent),
    strike:strike?{left:(strike.left-box.left)/box.width,top:(strike.top-box.top)/box.height,right:(box.right-strike.right)/box.width,bottom:(box.bottom-strike.bottom)/box.height,color:getComputedStyle(grid.querySelector('.course-recognition-strike-v87')).borderTopColor}:null};
  });
  assert(Math.abs(gridShape.width/gridShape.height-1)<.03,'63-grid preserves the almost-square reference shape');assert.equal(gridShape.ids.length,63);assert.deepEqual(gridShape.ids.slice(0,9),[16,26,36,46,56,66,76,86,96]);assert.deepEqual(gridShape.ids.slice(-9),[10,20,30,40,50,60,70,80,90]);
  assert.deepEqual(gridShape.columns,['1','2','3','4','5','6','7','8','9']);assert.deepEqual(gridShape.rows,['6','5','4','3','2','1','0']);assert.equal(gridShape.lineStyle,'dotted');assert.equal(gridShape.borderStyle,'solid');assert.equal(gridShape.borderColor,'rgb(21, 62, 102)');
  assert(gridShape.strike,'inner strike frame exists');for(const key of ['left','right'])assert(Math.abs(gridShape.strike[key]-2/9)<.006,key+' strike frame is at 2/9');for(const key of ['top','bottom'])assert(Math.abs(gridShape.strike[key]-1/7)<.006,key+' strike frame is at 1/7');assert.equal(gridShape.strike.color,'rgb(235, 55, 43)');assert.equal(gridShape.central.length,25);assert(gridShape.central.every(node=>node.color==='rgb(235, 55, 43)'),'central 5x5 IDs remain red');
  await page.locator('.course-recognition-frame-v87').screenshot({path:resolve(directory,`grid63-${width}.png`)});
  await page.locator('#course-recognition-cell-54').click();assert.equal(await page.locator('#course-recognition-cell-v87').inputValue(),'54');
  await page.locator('#course-recognition-bias-x-v87').fill('0.12');await page.locator('#course-recognition-bias-y-v87').fill('-0.08');await page.locator('#course-recognition-uncertainty-v87').fill('1.5');await page.locator('#course-recognition-weight-v87').fill('1.8');await page.locator('#course-recognition-save-v87').click();
  const recognition=await page.evaluate(()=>{const id=KneekuraBatterMakerV79.inspect().playerId;return baseballMaker.getLiveRoster().entries.find(row=>row.playerId===id).physical.zoneRecognitionV87;});assert.deepEqual(recognition.batter.cells[32],{biasXM:.12,biasYM:-.08,uncertaintyScale:1.5,targetWeight:1.8});
  const savedRecognitionRoster=await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()));for(const [id,value]of [['course-recognition-bias-x-v87','0.2'],['course-recognition-bias-y-v87','0.15'],['course-recognition-uncertainty-v87','0.5'],['course-recognition-weight-v87','0.4']])await page.locator('#'+id).fill(value);
  await page.locator('#course-recognition-cancel-v87').click();assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),savedRecognitionRoster);for(const [id,value]of [['course-recognition-bias-x-v87','0.12'],['course-recognition-bias-y-v87','-0.08'],['course-recognition-uncertainty-v87','1.5'],['course-recognition-weight-v87','1.8']])assert.equal(await page.locator('#'+id).inputValue(),value,'recognition cancel restores '+id);
  for(const [role,cell,bias]of [['pitcher','96','-0.1'],['catcher','10','0.2']]){
   await page.locator('#course-recognition-role-v87').selectOption(role);await page.locator('#course-recognition-cell-v87').selectOption(cell);await page.locator('#course-recognition-bias-x-v87').fill(bias);await page.locator('#course-recognition-save-v87').click();
   const value=await page.evaluate(({role,cell})=>{const id=KneekuraBatterMakerV79.inspect().playerId,raw=baseballMaker.getLiveRoster().entries.find(row=>row.playerId===id).physical.zoneRecognitionV87;return raw[role].cells[(Math.floor(Number(cell)/10)-1)*7+Number(cell)%10].biasXM;},{role,cell});assert.equal(value,Number(bias));
  }
  const beforeInvalidRecognition=await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()));await page.locator('#course-recognition-bias-x-v87').fill('0.6');await page.locator('#course-recognition-save-v87').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),beforeInvalidRecognition);assert.equal(await page.locator('#course-recognition-bias-x-v87').getAttribute('aria-invalid'),'true');await page.locator('#course-recognition-cancel-v87').click();assert.equal(await page.locator('#course-recognition-bias-x-v87').getAttribute('aria-invalid'),'false');
  const legacy=await page.evaluate(()=>{const profile=structuredClone(KneekuraBaseballWorkbench.createNeutralBatterCourseProfileV79());profile.referenceAverages[32]=.6;KneekuraBatterMakerV79.setProfile(profile);return profile;});
  await page.locator('#course-value-v79').fill('0.44');await page.locator('#course-apply-v79').click();
  assert.deepEqual(await page.evaluate(()=>{const id=KneekuraBatterMakerV79.inspect().playerId;return baseballMaker.getLiveRoster().entries.find(row=>row.playerId===id).physical.batterCourseProfileV79;}),legacy,'13 editing preserves legacy original');
  await page.locator('#course-remove-v79').click();assert.deepEqual(await page.evaluate(()=>KneekuraBatterMakerV79.getProfile()),legacy,'removing 13 overlay restores exact legacy source');
  await page.locator('#course-season-id-v79').fill('ui-v87-'+width);await page.locator('#course-season-name-v79').fill('UI検証');await page.locator('#course-season-create-v79').click();await page.locator('#course-layer-v87').selectOption('adapted');
  const adaptation=await page.evaluate(()=>{const s=KneekuraBatterMakerV79.inspect();return KneekuraBaseballWorkbench.deriveLiveCourseProfileV87({store:KneekuraCourseSeasonsV79.getState(),seasonId:s.seasonId,playerId:s.playerId,profile:KneekuraBatterMakerV79.getProfileV87()}).referenceAverages[4];});
  const beforePractice=await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster()));await page.locator('#course-adapt-v87').click();await page.locator('#course-practice-id-v79').fill('ui-practice-'+width);await page.locator('#course-practice-attempts-v79').fill('100');await page.locator('#course-practice-quality-v79').fill('1');await page.locator('#course-practice-record-v79').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(baseballMaker.getLiveRoster())),beforePractice,'practice changes neither innate author profile nor public stats');
  const adapted=await page.evaluate(()=>{const s=KneekuraBatterMakerV79.inspect();return KneekuraBaseballWorkbench.deriveLiveCourseProfileV87({store:KneekuraCourseSeasonsV79.getState(),seasonId:s.seasonId,playerId:s.playerId,profile:KneekuraBatterMakerV79.getProfileV87()}).referenceAverages[4];});assert(adapted>adaptation,'recorded practice updates the adapted layer');
  await page.locator('#course-layer-v87').selectOption('public');assert.equal(await page.locator('#course-map-v87 [data-zone-id="5"] [data-zone-average]').textContent(),'—');await page.locator('#course-layer-v87').selectOption('mlb');
  const mlb=await page.evaluate(()=>KneekuraMlbCourseReferenceV87.zones.find(row=>row.zoneId===5).average);assert.equal(await page.locator('#course-map-v87 [data-zone-id="5"] [data-zone-average]').textContent(),mlb.toFixed(3).replace(/^0\./,'.'));
  await page.locator('#course-layer-v87').selectOption('innate');
  assert.equal(await page.evaluate(()=>KneekuraBatterMakerV79.inspect().pending.length),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#course-panel-v79').screenshot({path:resolve(directory,`course-${width}.png`)});assert.deepEqual(faults.errors,[]);assert.deepEqual(faults.external,[]);
  report.cases.push({width,regions:13,previewCommitCancel:true,proportionalDirection:true,readOnlyComparisons:true,roleRecognitionSaved:true,gridShape,allRolesAndBounds:true,legacyOriginalRestored:true,practiceHistoryAdaptation:true,zeroAbMissing:true,mlbExactReference:true});await page.close();
 }
 assert.equal(sha(await readFile(file)),report.artifactSha256);report.pass=true;
}catch(error){report.error=String(error.stack??error);throw error;}
finally{await browser.close();await writeFile(resolve(directory,'report.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:true,artifactSha256:report.artifactSha256,cases:report.cases.length}));
