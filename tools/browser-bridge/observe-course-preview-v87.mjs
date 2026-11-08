import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const artifact=resolve('../../outputs/にーくら野球メーカー_v86_入力確定とエラー復帰版.html'),directory=resolve('docs/verification/experiments/v87-course-preview');
const sha=value=>createHash('sha256').update(value).digest('hex');
const report={pass:false,projectRoot:process.cwd(),artifact,artifactSha256:sha(await readFile(artifact)),probePath:new URL(import.meta.url).pathname,probeSha256:sha(await readFile(new URL(import.meta.url))),cases:[]};
await mkdir(directory,{recursive:true});const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
async function snapshot(page,phase){const row=await page.evaluate(()=>{
 const api=KneekuraBatterMakerV79,state=api.inspect(),profile=api.getProfile(),cell=document.getElementById('course-cell-'+state.courseId),svg=document.querySelector('#course-direction-input-v79 svg');
 return {courseId:state.courseId,direction:state.direction,pending:state.pending.map(row=>row.id),status:document.getElementById('course-status-v79').textContent,
  input:{course:document.getElementById('course-value-v79').value,courseRange:document.getElementById('course-value-range-v79').value,effect:document.getElementById('course-effect-v79').value,direction:document.getElementById('course-direction-value-v79').value,directionRange:document.getElementById('course-direction-range-v79').value},
  saved:profile?{course:profile.referenceAverages[(Math.floor(state.courseId/10)-1)*7+state.courseId%10],effect:profile.effectScale,direction:profile.directionWeights??null}:null,
  selectedCell:{text:cell.children[0].textContent,color:getComputedStyle(cell).backgroundColor,aria:cell.getAttribute('aria-label')},
  publicNine:[...document.querySelectorAll('#course-setting-preview-v79 > div')].map(cell=>({text:cell.textContent,color:getComputedStyle(cell).backgroundColor})),
  fan:{paths:[...svg.querySelectorAll('path')].map(path=>({d:path.getAttribute('d'),fill:path.getAttribute('fill')})),text:[...svg.querySelectorAll('text')].map(text=>text.textContent),aria:svg.getAttribute('aria-label'),list:[...document.querySelectorAll('#course-direction-input-v79 li')].map(li=>li.textContent)}};
 });const {paths,...fan}=row.fan;return {phase,...row,fan:{...fan,geometrySha256:sha(JSON.stringify(paths))}};}
async function range(page,id,value){await page.locator('#'+id).evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);}
async function roundTrip(page){await page.locator('#tab-player').click();await page.locator('#tab-course-v79').click();}
try{
 for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),item={width,errors:[],external:[],phases:[]};report.cases.push(item);
  page.on('pageerror',error=>item.errors.push(String(error)));page.on('request',request=>{if(!/^(file:|data:|blob:|about:)/.test(request.url()))item.external.push(request.url());});
  await page.goto(pathToFileURL(artifact).href,{timeout:60000});await page.waitForFunction(()=>globalThis.KneekuraBatterMakerV79);await page.locator('#tab-course-v79').click();
  const record=async phase=>{const row=await snapshot(page,phase);item.phases.push(row);return row;};
  const initial=await record('initial');assert.equal(initial.courseId,54);
  await page.locator('#course-value-v79').fill('0.330');const courseDraft=await record('course-number-unconfirmed');
  await roundTrip(page);const courseDraftTab=await record('course-number-unconfirmed-tab-roundtrip');
  assert.equal(courseDraft.selectedCell.text,initial.selectedCell.text);assert.equal(courseDraft.saved,initial.saved);assert.equal(courseDraftTab.input.course,'0.330');
  await page.locator('#course-apply-v79').click();const courseSaved=await record('course-number-applied');assert.equal(courseSaved.saved.course,.33);assert.equal(courseSaved.selectedCell.text,'.330');assert.notEqual(courseSaved.selectedCell.color,initial.selectedCell.color);assert.equal(courseSaved.pending.length,0);
  await page.locator('#course-value-v79').fill('0.360');await page.locator('#course-apply-v79').click();const sameColor=await record('course-same-color-bucket-applied');assert.equal(sameColor.saved.course,.36);assert.equal(sameColor.selectedCell.color,courseSaved.selectedCell.color);assert.notEqual(sameColor.selectedCell.text,courseSaved.selectedCell.text);
  await range(page,'course-value-range-v79',.18);await page.locator('#course-apply-v79').click();const blue=await record('course-range-applied');assert.equal(blue.saved.course,.18);assert.equal(blue.selectedCell.text,'.180');assert.notEqual(blue.selectedCell.color,sameColor.selectedCell.color);
  await page.locator('#course-direction-value-v79').fill('80');const directionDraft=await record('direction-number-unconfirmed');assert.deepEqual(directionDraft.fan,blue.fan);assert.deepEqual(directionDraft.saved.direction,blue.saved.direction);
  await roundTrip(page);const directionTab=await record('direction-number-unconfirmed-tab-roundtrip');assert.equal(directionTab.input.direction,'80');assert.deepEqual(directionTab.fan,blue.fan);
  await page.locator('#course-direction-apply-v79').click();const directionSaved=await record('direction-number-applied');assert.equal(directionSaved.saved.direction[2],.8);assert.match(directionSaved.fan.text[2],/80\.0%/);assert.equal(directionSaved.fan.geometrySha256,initial.fan.geometrySha256);assert.notDeepEqual(directionSaved.fan.text,initial.fan.text);assert.equal(directionSaved.pending.length,0);
  await roundTrip(page);const savedTab=await record('direction-applied-tab-roundtrip');assert.deepEqual(savedTab.fan,directionSaved.fan);assert.deepEqual(savedTab.saved,directionSaved.saved);
  await range(page,'course-direction-range-v79',30);await page.locator('#course-direction-apply-v79').click();const directionRange=await record('direction-range-applied');assert.equal(directionRange.saved.direction[2],.3);assert.match(directionRange.fan.text[2],/30\.0%/);assert.equal(directionRange.fan.geometrySha256,initial.fan.geometrySha256);
  await page.locator('#course-cell-10').focus();const outsideBefore=await record('outside-course-selected');await page.locator('#course-value-v79').fill('0.900');await page.locator('#course-apply-v79').click();const outsideAfter=await record('outside-course-applied');assert.equal(outsideAfter.saved.course,.9);assert.equal(outsideAfter.selectedCell.text,'.900');assert.deepEqual(outsideAfter.publicNine,outsideBefore.publicNine);
  item.result={immediatePreview:false,courseSavedValueAndCellRefresh:true,directionSavedPercentRefresh:true,directionGeometryFixed:true,sameBucketColorFixed:true,outsideCoursePublicNineFixed:true,unconfirmedAndConfirmedTabRoundtripRetained:true};
  assert.deepEqual(item.errors,[]);assert.deepEqual(item.external,[]);await page.close();
 }
 assert.equal(sha(await readFile(artifact)),report.artifactSha256);report.pass=true;
}finally{await browser.close();await writeFile(resolve(directory,'observation.json'),JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({pass:report.pass,artifactSha256:report.artifactSha256,cases:report.cases.length,phases:report.cases.map(row=>row.phases.length),result:report.cases.map(row=>row.result),output:resolve(directory,'observation.json')}));