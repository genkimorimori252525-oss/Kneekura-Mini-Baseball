import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const artifact = resolve(process.argv[2] ?? '../../outputs/にーくら野球メーカー_v75_技術得能調整版.html');
const evidence = resolve('docs/verification/releases/v75/maker');
const sha = value => createHash('sha256').update(value).digest('hex');
const {chromium} = createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const families = ['baserunning', 'bunting', 'advanced_fielding', 'bat_to_run_transition', 'slow_ball_charge', 'low_zone_command'];
const legacy = ['bad_ball_hitting', 'throw_accuracy', 'plate_aggression', 'running_aggression', 'fielding_aggression', 'pitch_approach', 'swing_mode_preference'];
await mkdir(evidence, {recursive:true});
const report = {pass:false, phase:'load', artifact, views:[], faults:[], scope:'v75 technique state/source authoring and real JSON round trips, legacy 7-family compatibility, pending rejection, comparison input wiring, existing v74 layout, 1200/390 offline browser'};
let browser;

async function openTrait(page, id) {
  const control = page.locator('#' + id);
  if (!await control.isVisible()) await control.locator('xpath=ancestor::details[1]').locator('summary').first().click();
  return control;
}
async function state(page, family, value) {
  await (await openTrait(page, 'live-trait-' + family)).selectOption(value);
}
async function scale(page, family, value) {
  await (await openTrait(page, 'live-trait-effect-' + family)).fill(String(value));
}
async function roster(page) { return page.evaluate(() => baseballMaker.getLiveRoster()); }
async function trait(page, family) { return page.evaluate(id => baseballMaker.getTraitProjection().traits.find(t => t.familyId === id), family); }
async function selectPlayer(page, id) {
  await page.locator('#tab-player').click();
  await page.locator('#live-roster-player').selectOption(id);
}
async function download(page, id) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator('#' + id).click()]);
  return JSON.parse(await readFile(await file.path(), 'utf8'));
}
async function blockedDownload(page, id) {
  const emitted = page.waitForEvent('download', {timeout:350}).then(() => true, () => false);
  await page.evaluate(button => document.getElementById(button).click(), id);
  assert.equal(await emitted, false, 'invalid pending value must block ' + id);
}
async function compare(page) {
  await page.locator('#tab-bat').click();
  await page.locator('#comparison-run').click();
  await page.waitForFunction(() => KneekuraBallComparison.inspect().ready || KneekuraBallComparison.inspect().error);
  assert.equal(await page.evaluate(() => KneekuraBallComparison.inspect().error), null);
  return page.evaluate(() => KneekuraBallComparison.getInput());
}
function samePhysical(actual, expected) {
  for (const entry of actual.entries) assert.deepEqual(entry.physical, expected.entries.find(e => e.playerId === entry.playerId).physical, entry.playerId + ' physical unchanged');
}

try {
  const metadata = JSON.parse(await readFile(artifact + '.build.json', 'utf8'));
  const pins = JSON.parse(await readFile(artifact + '.bundle-inputs.json', 'utf8'));
  const initial = JSON.parse(await readFile('docs/demos/live-game-roster-v62.json', 'utf8'));
  const catalog = JSON.parse(await readFile('docs/demos/live-trait-availability-v75.json', 'utf8'));
  const oldCatalog = JSON.parse(await readFile('docs/demos/live-trait-availability-v54.json', 'utf8'));
  report.sha256 = sha(await readFile(artifact)); report.coreSha256 = metadata.coreSha256;
  assert.equal(report.sha256, metadata.sha256);
  for (const [path, hash] of Object.entries(pins.inputs)) assert.equal(sha(await readFile(path)), hash, 'source pin ' + path);
  assert.equal(catalog.version, 'live_trait_availability_v75'); assert.equal(catalog.entries.length, 119);
  assert.deepEqual(catalog.supportedFamilyIds, [...legacy, ...families]);
  assert.deepEqual(catalog.entries.filter((entry, index) => JSON.stringify(entry) !== JSON.stringify(oldCatalog.entries[index])).map(e => e.familyId).sort(), [...families].sort());
  browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', args:['--disable-accelerated-2d-canvas']});
  for (const width of [1200, 390]) {
    report.phase = 'startup-' + width;
    const context = await browser.newContext({viewport:{width, height:900}, hasTouch:width === 390, acceptDownloads:true});
    const page = await context.newPage(), row = {width, families:[]}, fault = {width, errors:[], external:[]};
    report.views.push(row); report.faults.push(fault); page.setDefaultTimeout(10000);
    page.on('pageerror', error => fault.errors.push(String(error)));
    page.on('request', request => {if (!/^(file:|data:|blob:|about:)/.test(request.url())) fault.external.push(request.url());});
    await page.goto(pathToFileURL(artifact).href);
    await page.waitForFunction(() => globalThis.KneekuraSwingMaker?.inspect().ready);
    const startup = await page.evaluate(() => ({flag:KneekuraTechnicalTraitsV75, legacy:KneekuraBaseballWorkbench.getLiveTraitCatalogV1().map(t => t.familyId), extended:KneekuraBaseballWorkbench.getLiveTraitCatalogV1({includeTechnical:true}), projection:baseballMaker.getTraitProjection(), players:KneekuraLiveGameRosterCatalog.players.map(p => ({id:p.playerId, role:p.role})), raw:JSON.stringify(KneekuraReferenceBatMotions)}));
    assert.equal(startup.flag, true); assert.deepEqual(startup.legacy, legacy); assert.equal(startup.extended.length, 13); assert.equal(startup.projection.traits.length, 13);
    row.publicResolverBoundary = await page.evaluate(() => {
      const profiles = {
        unknownFamily:{version:'live_trait_profile_v1',selections:[{familyId:'unknown_technique',stateId:null,source:{effectScale:1}}]},
        wrongVersion:{version:'live_trait_profile_v999',selections:[{familyId:'bunting',stateId:'LEARNED',source:{effectScale:1}}]},
        extraSourceKey:{version:'live_trait_profile_v1',selections:[{familyId:'bunting',stateId:'LEARNED',source:{effectScale:1,extra:1}}]},
      };
      return Object.fromEntries(Object.entries(profiles).map(([id,profile]) => {
        const before=JSON.stringify(profile); let rejected=false, message=null;
        try {KneekuraBaseballWorkbench.resolveLiveTechnicalTraitsV75(profile);} catch(error) {rejected=true;message=error.message;}
        return [id,{rejected,unchanged:JSON.stringify(profile)===before,message}];
      }));
    });
    for (const observed of Object.values(row.publicResolverBoundary)) {assert.equal(observed.rejected, true); assert.equal(observed.unchanged, true);}
    assert.deepEqual(await roster(page), initial, 'rendering must not initialize or alter the original 20 entries');
    row.referenceSha256 = sha(startup.raw);
    const batterId = startup.players.find(p => p.role !== 'P').id, pitcherId = startup.players.find(p => p.role === 'P').id;
    await selectPlayer(page, pitcherId);
    const sections = await page.evaluate(() => Object.fromEntries(['low_zone_command','bunting','bat_to_run_transition','baserunning','advanced_fielding','slow_ball_charge'].map(id => [id, document.getElementById('live-trait-' + id).closest('details')?.dataset.traitSecondary ?? 'primary'])));
    assert.equal(sections.low_zone_command, 'primary'); assert.equal(sections.bunting, 'batter'); assert.equal(sections.bat_to_run_transition, 'batter');
    for (const family of ['baserunning','advanced_fielding','slow_ball_charge']) assert.equal(sections[family], 'primary'); row.pitcherSections = sections;
    await selectPlayer(page, batterId);
    assert.equal(await page.locator('#live-trait-low_zone_command').evaluate(e => e.closest('details').dataset.traitSecondary), 'pitcher');
    report.phase = 'states-and-strength-' + width;
    for (const family of families) {
      assert.equal((await trait(page, family)).stateId, null);
      const initialInput = await openTrait(page, 'live-trait-effect-' + family);
      assert.equal(await initialInput.getAttribute('data-trait-effect-scale'), family);
      assert.equal(await initialInput.getAttribute('min'), '0'); assert.equal(await initialInput.getAttribute('max'), '2'); assert.equal(await initialInput.getAttribute('step'), '0.05');
      assert.equal(Number(await initialInput.inputValue()), 1);
      const definition = startup.extended.find(t => t.familyId === family);
      const states = definition.states.map(s => s.stateId);
      if (family === 'baserunning') assert.deepEqual(states, ['G','F','E','D','C','B','A','GOLD']);
      else assert.deepEqual(states, family === 'slow_ball_charge' ? ['LEARNED'] : ['LEARNED','MASTERED']);
      for (const id of states) {await state(page, family, id); assert.equal((await trait(page, family)).stateId, id);}
      const chosen = states.at(-1);
      for (const value of [0, 1, 2]) {
        await scale(page, family, value);
        const authored = await roster(page), selection = authored.entries.find(e => e.playerId === batterId).traitProfile.selections.find(t => t.familyId === family);
        assert.equal(selection.stateId, chosen); assert.equal(selection.source.effectScale, value); samePhysical(authored, initial);
        await page.evaluate(packet => baseballMaker.importLiveRoster(packet), authored);
        assert.equal((await trait(page, family)).sourceValue.effectScale, value);
      }
      await state(page, family, ''); assert.equal((await trait(page, family)).sourceValue.effectScale, 2);
      await state(page, family, states[0]); assert.equal((await trait(page, family)).sourceValue.effectScale, 2);
      row.families.push({id:family, states, strengths:[0,1,2], stateStrengthMutualRetention:true, imported:true});
    }
    report.phase = 'pending-' + width;
    const accepted = await roster(page);
    for (const value of ['2.1', '']) {
      await scale(page, 'bunting', value);
      assert.equal(await page.locator('#live-trait-effect-bunting').evaluate(e => e.validity.customError), true);
      assert.deepEqual(await roster(page), accepted);
      assert.deepEqual(await page.evaluate(() => baseballMaker.getState().livePhysicalRoster), accepted, 'snapshot getter retains accepted state while the export handlers enforce pending guards');
      await blockedDownload(page, 'save-json'); await blockedDownload(page, 'export-live-roster');
      const refused = await page.evaluate(async () => {try {await KneekuraBallComparison.run(); return false;} catch (error) {return error.message;}});
      assert.equal(typeof refused, 'string'); assert(refused.includes('未確定'));
      await scale(page, 'bunting', '2'); assert.equal(await page.locator('#live-trait-effect-bunting').evaluate(e => e.validity.customError), false);
      assert.deepEqual(await roster(page), accepted);
    }
    row.pending = {emptyAndRangeAtomic:true, bothRealExportsBlocked:true, compareBlocked:true, correctionAccepted:true};
    for (const family of families) {await state(page, family, ''); await scale(page, family, 1);}
    const off = await page.evaluate(id => {const r=baseballMaker.getLiveRoster(),entry=r.entries.find(e=>e.playerId===id);return{source:r, resolved:KneekuraBaseballWorkbench.resolveLiveTechnicalTraitsV75(entry.traitProfile)??null};}, batterId);
    assert.equal(off.resolved, null); samePhysical(off.source, initial);
    for (const family of families) {await state(page, family, startup.extended.find(d => d.familyId === family).states.at(-1).stateId); await scale(page, family, 0);}
    const zero = await page.evaluate(id => {const r=baseballMaker.getLiveRoster(),entry=r.entries.find(e=>e.playerId===id);return{source:r, resolved:KneekuraBaseballWorkbench.resolveLiveTechnicalTraitsV75(entry.traitProfile)??null};}, batterId);
    assert.equal(zero.resolved, null); samePhysical(zero.source, initial);
    row.disabled = {offAndZeroRuntimeAbsent:true, originalPhysicalExact:true};
    report.phase = 'comparison-wiring-' + width;
    await scale(page, 'bunting', 1.5); await state(page, 'bunting', 'MASTERED');
    await selectPlayer(page, pitcherId); await state(page, 'low_zone_command', 'MASTERED'); await scale(page, 'low_zone_command', 1.25);
    await selectPlayer(page, batterId); await page.locator('#tab-bat').click();
    await page.locator('#comparison-pitcher').selectOption(pitcherId); await page.locator('#comparison-location').selectOption('low');
    const input = await compare(page);
    assert.equal(input.batter.technicalSkills.bunting, 1.5); assert.equal(input.pitcher.technicalSkills.low_zone_command, 1.25);
    assert.equal(input.location, 'low'); assert.equal(await page.evaluate(() => KneekuraBallComparison.getResult().cases.length), 4);
    const layout = await page.evaluate(() => {const box=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,bottom:r.bottom};};return{comparisonParent:document.getElementById('ball-comparison-editor').parentElement.id, comparison:box('ball-comparison-editor'), preview:box('maker-preview-column'), bat:box('bat-panel'), canvas:box('comparison-canvas-batter'), actions:document.getElementById('comparison-run').parentElement.id};});
    assert.equal(layout.comparisonParent, 'maker-layout'); assert.equal(layout.actions, 'comparison-batter-actions');
    if (width === 1200) {assert(layout.comparison.width >= 900); assert(layout.canvas.width >= 850); assert(Math.abs(layout.preview.y - layout.bat.y) < 2); assert(layout.comparison.y >= Math.max(layout.preview.bottom, layout.bat.bottom) - 1);}
    row.comparison = {bunting:input.batter.technicalSkills.bunting, lowZoneCommand:input.pitcher.technicalSkills.low_zone_command, cases:4, layout};
    await page.locator('#comparison-batter-panel').screenshot({path:resolve(evidence, 'comparison-' + width + '.png')});
    await page.locator('#tab-player').click(); assert.equal(await page.locator('#ball-comparison-editor').isVisible(), false);
    report.phase = 'real-json-' + width;
    const edited = await roster(page); samePhysical(edited, initial);
    for (const entry of edited.entries) if (![batterId, pitcherId].includes(entry.playerId)) assert.deepEqual(entry, initial.entries.find(e => e.playerId === entry.playerId));
    const full = await download(page, 'save-json'), gameRoster = await download(page, 'export-live-roster');
    assert.deepEqual(full.livePhysicalRoster, edited); assert.deepEqual(gameRoster, edited);
    await writeFile(resolve(evidence, 'authored-' + width + '.json'), JSON.stringify(full, null, 2) + '\n');
    await scale(page, 'bunting', .5);
    await page.locator('#import-file').setInputFiles({name:'v75-full.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(full))});
    await page.waitForFunction(expected => JSON.stringify(baseballMaker.getLiveRoster()) === expected, JSON.stringify(edited));
    await scale(page, 'bunting', .25);
    await page.locator('#live-roster-file').setInputFiles({name:'v75-roster.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(gameRoster))});
    await page.waitForFunction(expected => JSON.stringify(baseballMaker.getLiveRoster()) === expected, JSON.stringify(edited));
    assert.equal(sha(await page.evaluate(() => JSON.stringify(KneekuraReferenceBatMotions))), row.referenceSha256);
    row.json = {realFullAndRosterDownloads:true, bothFileInputs:true, all20PhysicalExact:true, unrelated18EntriesExact:true, referenceDataExact:true};
    await page.evaluate(() => {KneekuraMakerHelp.hide(); scrollTo(0, document.getElementById('live-trait-editor').getBoundingClientRect().top + scrollY - 20);});
    await page.screenshot({path:resolve(evidence, 'traits-' + width + '.png')});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#tab-bat').click(); assert.equal(await page.locator('#ball-comparison-editor').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(fault.errors, []); assert.deepEqual(fault.external, []); await context.close();
  }
  for (const [path, hash] of Object.entries(pins.inputs)) assert.equal(sha(await readFile(path)), hash, 'final source pin ' + path);
  assert.equal(sha(await readFile(artifact)), report.sha256); report.pass = true; report.phase = 'complete';
  console.log(JSON.stringify({pass:true,sha256:report.sha256,coreSha256:report.coreSha256,widths:[1200,390]}));
} catch (error) {
  report.error = String(error.stack ?? error);
  await writeFile(resolve(evidence, 'maker-v75-failure-' + Date.now() + '.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(JSON.stringify({pass:false,phase:report.phase,error:String(error)})); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await writeFile(resolve(evidence, 'maker-check.json'), JSON.stringify(report, null, 2) + '\n');
}
