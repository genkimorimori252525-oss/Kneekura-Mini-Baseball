import {test,expect,beforeAll,afterAll} from 'vitest';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
let browser;
beforeAll(async()=>{browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});});
afterAll(async()=>{await browser?.close();});
async function fixture(){const page=await browser.newPage();await page.setContent('<div id="map"></div><div id="fan"></div><output id="selected"></output>');await page.addScriptTag({content:readFileSync(new URL('./course-charts-v87.js',import.meta.url),'utf8')});return page;}
test('13-region map preserves missing values and routes keyboard selection to its region',async()=>{
 const page=await fixture();try{
  const observed=await page.evaluate(()=>{
   const api=globalThis.KneekuraCourseChartsV87??globalThis.KneekuraCourseChartsV79;if(!api.renderMap)return {available:false};
   api.renderMap(document.getElementById('map'),{regions:[1,2,3,4,5,6,7,8,9,11,12,13,14].map((zoneId,i)=>({zoneId,average:i===0?.33:i===1?.18:null})),selectedZoneId:1,editable:true,onSelect:id=>document.getElementById('selected').value=id});
   return {available:true,ids:[...document.querySelectorAll('[data-zone-id]')].map(node=>Number(node.dataset.zoneId)),
    values:[...document.querySelectorAll('[data-zone-id] [data-zone-average]')].map(node=>node.textContent),
    colors:[...document.querySelectorAll('[data-zone-id] path')].map(node=>node.getAttribute('fill'))};
  });
  expect(observed.available).toBe(true);expect(observed.ids).toEqual([1,2,3,4,5,6,7,8,9,11,12,13,14]);
  expect(observed.values.slice(0,3)).toEqual(['.330','.180','—']);expect(observed.colors.slice(0,3)).toEqual(['#f5a6a5','#c8e5f4','#e5e9e7']);
  await page.locator('[data-zone-id="12"]').focus();await page.keyboard.press('Enter');expect(await page.locator('#selected').textContent()).toBe('12');
 }finally{await page.close();}
});
test('direction fill area changes with ratio while the five direction boundaries stay fixed',async()=>{
 const page=await fixture();try{
  const render=ratios=>page.evaluate(ratios=>{const api=globalThis.KneekuraCourseChartsV87??globalThis.KneekuraCourseChartsV79;api.renderSpray(document.getElementById('fan'),{ratios});return {boundaries:[...document.querySelectorAll('[data-direction-boundary]')].map(path=>path.getAttribute('d')),fills:[...document.querySelectorAll('[data-direction-fill]')].map(path=>path.getAttribute('d')),text:document.querySelector('#fan svg').textContent};},ratios);
  const even=await render([.2,.2,.2,.2,.2]),center=await render([.05,.05,.8,.05,.05]);
  expect(center.boundaries).toHaveLength(5);expect(center.boundaries).toEqual(even.boundaries);expect(center.fills).toHaveLength(5);
  expect(center.fills[2]).not.toBe(even.fills[2]);expect(center.fills[0]).not.toBe(even.fills[0]);expect(center.text).toContain('80.0%');
 }finally{await page.close();}
});
