import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const [artifactArg, directoryArg] = process.argv.slice(2);
if (!artifactArg || !directoryArg) throw Error('requires maker HTML and evidence directory');
const artifact = resolve(artifactArg), directory = resolve(directoryArg);
const sha = value => createHash('sha256').update(value).digest('hex');
const {chromium} = createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
await mkdir(directory, {recursive:true});
const report = {pass:false, phase:'metadata', artifact, views:[], faults:[], scope:'v82 internal capability recovery, explicit proposals and discard, cm/SI and arbitrary precision, research draft recovery, comparison population removal/undo, 1200/390 offline browser.'};
report.harnessSha256 = sha(await readFile(new URL(import.meta.url)));
let browser;

const japanese = /[\u3040-\u30ff\u3400-\u9fff]/;
const fieldId = (path, entryPath = false) => '#live-ability-' + (entryPath ? 'entry-' : '') + path.replaceAll('.', '-');
const roster = page => page.evaluate(() => baseballMaker.getLiveRoster());
const recovery = page => page.evaluate(() => baseballMaker.getRecoveryStateV82());
async function selectPlayer(page, id) {
  await page.locator('#tab-player').click();
  await page.locator('#live-roster-player').selectOption(id);
  await page.locator('#live-roster-internals').evaluate(node => {node.open = true;});
}
async function pendingField(page, playerId, path, raw) {
  const state = await recovery(page), pending = state.pendingFields.find(item => item.playerId === playerId && item.path === path);
  assert(pending, 'pending field ' + playerId + '/' + path);
  assert.equal(pending.raw, raw); assert.match(pending.label, japanese); assert.match(pending.error, japanese);
  assert.equal(await page.locator(fieldId(path, path === 'heightMeters')).evaluate(node => node.validity.customError), true);
  return pending;
}
function onlyChangedPath(before, after, playerId, path, expected, entryPath = false) {
  const prior = structuredClone(before), next = structuredClone(after);
  const selected = next.entries.find(entry => entry.playerId === playerId), original = prior.entries.find(entry => entry.playerId === playerId);
  const keys = path.split('.'), leaf = keys.pop();
  const parent = keys.reduce((value, key) => value[key], entryPath ? selected : selected.physical);
  const oldParent = keys.reduce((value, key) => value[key], entryPath ? original : original.physical);
  assert.equal(parent[leaf], expected, playerId + '/' + path + ' exact value');
  parent[leaf] = oldParent[leaf];
  next.sourceId = prior.sourceId; selected.sourceId = original.sourceId;
  assert.deepEqual(next, prior, 'only requested field and source revision may change');
}
async function assertLayout(page, width, stage) {
  const layout = await page.evaluate(() => ({client:document.documentElement.clientWidth, scroll:document.documentElement.scrollWidth, inner:innerWidth}));
  assert(layout.scroll <= layout.client + 1 && layout.scroll <= width + 1, stage + ' horizontal overflow ' + JSON.stringify(layout));
  return layout;
}
async function proposal(page, path, requested, suggested) {
  await page.locator('[data-recovery-auto="' + path + '"]').click();
  const state = await recovery(page);
  assert(state.proposal, 'proposal must be explicit');
  assert.equal(state.proposal.path, path);
  if (requested !== undefined) assert.equal(state.proposal.requestedValue, requested);
  if (suggested !== undefined) assert.equal(state.proposal.suggestedValue, suggested);
  assert(Array.isArray(state.proposal.changes) && state.proposal.changes.length > 0, 'proposal contains exact changes');
  assert.match(state.proposal.message, japanese);
  assert(await page.locator('#maker-recovery-proposal-v82').isVisible());
  await page.waitForFunction(() => {
    const box = document.getElementById('maker-recovery-proposal-v82').getBoundingClientRect();
    return box.top >= 0 && box.bottom <= innerHeight && box.left >= 0 && box.right <= innerWidth;
  }, undefined, {timeout:3000});
  return state.proposal;
}
async function downloadJson(page, id) {
  const [file] = await Promise.all([page.waitForEvent('download'), page.locator('#' + id).click()]);
  return JSON.parse(await readFile(await file.path(), 'utf8'));
}

try {
  const artifactBytes = await readFile(artifact), metadataBytes = await readFile(artifact + '.build.json'), metadata = JSON.parse(metadataBytes);
  const manifestBytes = await readFile(artifact + '.bundle-inputs.json'), manifest = JSON.parse(manifestBytes);
  const nativeArtifact = resolve(metadata.matchRendererSourcePath), nativeBytes = await readFile(nativeArtifact), nativeMetadataBytes = await readFile(nativeArtifact + '.build.json');
  const nativeMetadata = JSON.parse(nativeMetadataBytes), nativeManifestBytes = await readFile(nativeArtifact + '.bundle-inputs.json'), nativeManifest = JSON.parse(nativeManifestBytes);
  report.sha256 = sha(artifactBytes); report.coreSha256 = metadata.coreSha256;
  report.metadataSha256 = sha(metadataBytes); report.manifestSha256 = sha(manifestBytes);
  assert.equal(report.sha256, metadata.sha256, 'artifact matches build metadata');
  assert.equal(report.manifestSha256, metadata.bundleInputManifestSha256, 'manifest matches build metadata');
  assert.equal(manifest.entrySha256, metadata.coreSha256, 'embedded Core matches manifest');
  assert(Object.keys(manifest.inputs).length >= 87, 'complete shared Core source manifest');
  assert.equal(sha(nativeBytes), metadata.matchRendererSourceSha256, 'normal renderer matches maker dependency');
  assert.equal(sha(nativeBytes), nativeMetadata.sha256, 'normal renderer matches metadata');
  assert.equal(nativeManifest.entrySha256, nativeMetadata.sourceCoreSha256, 'normal renderer Core matches manifest');
  report.native = {artifact:nativeArtifact, sha256:sha(nativeBytes), coreSha256:nativeManifest.entrySha256, metadataSha256:sha(nativeMetadataBytes), manifestSha256:sha(nativeManifestBytes)};
  browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe', args:['--disable-accelerated-2d-canvas']});
  for (const width of [1200, 390]) {
    report.phase = 'recovery-api-' + width;
    const page = await browser.newPage({viewport:{width, height:1000}, acceptDownloads:true});
    const row = {width, checks:[]}, fault = {width, errors:[], external:[]};
    report.views.push(row); report.faults.push(fault);
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => fault.errors.push(String(error)));
    page.on('request', request => {if (!/^(file:|data:|blob:|about:)/.test(request.url())) fault.external.push(request.url());});
    await page.goto(pathToFileURL(artifact).href, {timeout:60000});
    await page.waitForFunction(() => globalThis.baseballMaker?.getLiveRoster()?.entries.length === 20, undefined, {timeout:60000});
    const api = await page.evaluate(() => Object.fromEntries(['getRecoveryStateV82', 'requestInternalAdjustmentV82', 'applyInternalAdjustmentV82', 'cancelInternalAdjustmentV82', 'revertInternalEditsV82', 'requestWorkbenchAdjustmentV82', 'revertWorkbenchDraftV82'].map(key => [key, typeof baseballMaker[key]])));
    assert(Object.values(api).every(value => value === 'function'), 'v82 recovery API is required: ' + JSON.stringify(api));
    row.api = api;
    const initial = await roster(page), source = JSON.parse(await readFile('docs/demos/live-game-roster-v62.json', 'utf8'));
    assert.deepEqual(initial, source, 'opening maker does not alter source roster');
    const catalog = await page.evaluate(() => KneekuraLiveGameRosterCatalog.players);
    const selectedId = catalog.find(player => player.role !== 'P').playerId, otherId = catalog.find(player => player.playerId !== selectedId && player.role !== 'P').playerId;
    row.source = await page.evaluate(() => ({clips:KneekuraReferenceBatMotions.clips.length, reference:JSON.stringify(KneekuraReferenceBatMotions)}));
    assert.equal(row.source.clips, 673); row.source.referenceSha256 = sha(row.source.reference); delete row.source.reference;
    assert.equal((await recovery(page)).pendingFields.length, 0); assert.equal((await recovery(page)).proposal, null);
    await selectPlayer(page, selectedId);

    report.phase = 'target-speed-proposal-' + width;
    await page.locator(fieldId('maximumSweetSpotSpeedMps')).fill('40');
    const accepted = await roster(page), target = page.locator(fieldId('targetSweetSpotSpeedMps'));
    assert.equal(await target.getAttribute('max'), '40', 'target maximum follows capability');
    assert.equal(await target.getAttribute('step'), 'any', 'catalog increment never quantizes input');
    assert.match(await target.locator('xpath=..').innerText(), /40/, 'current upper bound is visible');
    await target.fill('60');
    const invalid = await pendingField(page, selectedId, 'targetSweetSpotSpeedMps', '60');
    assert.match(invalid.error, /40/); assert.deepEqual(await roster(page), accepted, 'invalid target is only pending');
    const inlineError = target.locator('xpath=..').locator('[data-recovery-field-error="targetSweetSpotSpeedMps"]');
    assert(await inlineError.isVisible(), 'Japanese error is visible beside the invalid field');
    const inlineErrorText = await inlineError.innerText(); assert.match(inlineErrorText, japanese);
    for (const value of ['60', '40', '20']) assert(inlineErrorText.includes(value), 'inline error explains ' + value);
    const targetProposal = await proposal(page, 'targetSweetSpotSpeedMps', 60, 40);
    assert.equal(targetProposal.playerId, selectedId);
    const proposalText = await page.locator('#maker-recovery-proposal-v82').innerText();
    for (const value of ['60', '40', '20']) assert(proposalText.includes(value), 'proposal visibly explains ' + value);
    assert.deepEqual(await roster(page), accepted, 'requesting adjustment does not mutate accepted roster');
    row.proposalLayout = await assertLayout(page, width, 'proposal');
    row.proposalViewport = await page.locator('#maker-recovery-proposal-v82').evaluate(node => {const box = node.getBoundingClientRect(); return {top:box.top, bottom:box.bottom, left:box.left, right:box.right, viewportWidth:innerWidth, viewportHeight:innerHeight};});
    row.inlineError = inlineErrorText;
    await page.screenshot({path:resolve(directory, 'target-proposal-' + width + '.png'), fullPage:true});
    await page.locator('#maker-recovery-proposal-v82').screenshot({path:resolve(directory, 'target-proposal-panel-' + width + '.png')});
    await page.locator('#maker-recovery-cancel-v82').click();
    assert.equal((await recovery(page)).proposal, null); assert.equal(await target.inputValue(), '60');
    assert.deepEqual(await roster(page), accepted, 'cancel retains accepted roster and raw input');
    await page.locator('#tab-bat').click(); await page.locator('#tab-player').click();
    assert.equal(await target.inputValue(), '60', 'invalid input never traps navigation');
    await proposal(page, 'targetSweetSpotSpeedMps', 60, 40);
    await page.locator('#maker-recovery-apply-v82').click();
    const applied = await roster(page); onlyChangedPath(accepted, applied, selectedId, 'targetSweetSpotSpeedMps', 40);
    assert.equal((await recovery(page)).pendingFields.length, 0); assert.equal((await recovery(page)).proposal, null);
    assert.equal(await target.inputValue(), '40'); assert.equal(await target.evaluate(node => node.validity.valid), true);
    await target.fill('60'); await pendingField(page, selectedId, 'targetSweetSpotSpeedMps', '60');
    await page.locator('[data-recovery-revert="targetSweetSpotSpeedMps"]').click();
    assert.equal(await target.inputValue(), '40'); assert.equal((await recovery(page)).pendingFields.length, 0);
    assert.deepEqual(await roster(page), applied, 'field revert keeps previous accepted value');
    await target.fill('60'); await page.locator('#maker-recovery-discard-v82').click();
    assert.equal(await target.inputValue(), '40'); assert.deepEqual(await roster(page), applied);
    assert.equal((await recovery(page)).pendingFields.length, 0);
    row.checks.push({targetSpeed:{requested:60, suggested:40, difference:20, explicitApply:true, cancelKeepsRaw:true, discardKeepsAccepted:true, dynamicMaximum:true, canLeaveInvalidInput:true}});

    report.phase = 'cm-and-precision-' + width;
    for (const spec of [{path:'heightMeters', entryPath:true, raw:'300', display:'250', si:2.5, min:'110', max:'250'}, {path:'batLengthM', raw:'400', display:'300', si:3, min:'20', max:'300'}, {path:'batLengthM', raw:'0', display:'20', si:.2, min:'20', max:'300'}]) {
      const control = page.locator(fieldId(spec.path, spec.entryPath)), before = await roster(page);
      assert.equal(await control.getAttribute('min'), spec.min); assert.equal(await control.getAttribute('max'), spec.max); assert.equal(await control.getAttribute('step'), 'any');
      assert.match(await control.locator('xpath=..').innerText(), /cm/);
      await control.fill(spec.raw); await pendingField(page, selectedId, spec.path, spec.raw);
      await proposal(page, spec.path);
      const text = await page.locator('#maker-recovery-proposal-v82').innerText(); assert(text.includes(spec.raw) && text.includes(spec.display) && text.includes('cm'), 'cm proposal explains requested and adjusted value');
      assert.deepEqual(await roster(page), before);
      await page.locator('#maker-recovery-apply-v82').click();
      onlyChangedPath(before, await roster(page), selectedId, spec.path, spec.si, spec.entryPath);
      assert.equal(await control.inputValue(), spec.display); assert.equal(await control.evaluate(node => node.validity.valid), true);
    }
    await page.locator(fieldId('batLengthM')).fill('150');
    assert.equal((await roster(page)).entries.find(entry => entry.playerId === selectedId).physical.batLengthM, 1.5, 'valid 1.5m bat remains supported');
    const precise = 7.123456789012345, beforePrecise = await roster(page);
    await page.locator(fieldId('topSpeedMps')).fill(String(precise));
    onlyChangedPath(beforePrecise, await roster(page), selectedId, 'topSpeedMps', precise);
    assert.equal(await page.locator(fieldId('topSpeedMps')).inputValue(), String(precise), 'arbitrary numeric precision is retained');
    assert.equal(await page.locator(fieldId('topSpeedMps')).evaluate(node => node.validity.valid), true);
    row.checks.push({units:{heightCmToM:[300,250,2.5], batCmToM:[[400,300,3],[0,20,.2]], validLongBatM:1.5}, precision:precise});

    report.phase = 'pending-across-players-' + width;
    const acceptedPlayers = await roster(page);
    await page.locator(fieldId('topSpeedMps')).fill('');
    await pendingField(page, selectedId, 'topSpeedMps', '');
    await selectPlayer(page, otherId); await page.locator(fieldId('batLengthM')).fill('400');
    await pendingField(page, otherId, 'batLengthM', '400');
    const multiple = await recovery(page);
    assert(multiple.pendingFields.some(item => item.playerId === selectedId) && multiple.pendingFields.some(item => item.playerId === otherId));
    const status = await page.locator('#live-roster-status').innerText();
    for (const id of [selectedId, otherId]) assert(status.includes(catalog.find(player => player.playerId === id).name), 'pending status names player ' + id);
    await page.evaluate(playerId => baseballMaker.revertInternalEditsV82({playerId}), otherId);
    assert((await recovery(page)).pendingFields.some(item => item.playerId === selectedId), 'selected-player revert does not discard another player');
    assert(!(await recovery(page)).pendingFields.some(item => item.playerId === otherId));
    await page.evaluate(() => baseballMaker.revertInternalEditsV82({allPlayers:true}));
    assert.equal((await recovery(page)).pendingFields.length, 0); assert.deepEqual(await roster(page), acceptedPlayers);
    await selectPlayer(page, selectedId); assert.equal(await page.locator(fieldId('topSpeedMps')).inputValue(), String(precise));
    row.checks.push({pendingAcrossPlayers:{named:true, selectedOnlyRevert:true, explicitAllPlayersRevert:true, acceptedRosterExact:true}});

    report.phase = 'research-workbench-recovery-' + width;
    await page.locator('#standalone-player-editor').evaluate(node => {node.open = true;});
    const researchBefore = await page.evaluate(() => baseballMaker.getState().player), liveBeforeResearch = await roster(page);
    await page.locator('#body-mass').fill('400');
    await page.evaluate(() => baseballMaker.requestWorkbenchAdjustmentV82({path:'body.massKg'}));
    const researchProposal = (await recovery(page)).proposal;
    assert(researchProposal); assert.equal(researchProposal.path, 'body.massKg'); assert.equal(researchProposal.requestedValue, 400); assert.equal(researchProposal.suggestedValue, 300);
    assert(await page.locator('#maker-recovery-proposal-v82').isVisible());
    await page.locator('#maker-recovery-cancel-v82').click(); assert.equal(await page.locator('#body-mass').inputValue(), '400');
    await page.locator('#maker-workbench-discard-v82').click(); assert.equal(Number(await page.locator('#body-mass').inputValue()), researchBefore.body.massKg);
    assert.deepEqual(await page.evaluate(() => baseballMaker.getState().player), researchBefore, 'research discard restores prior valid draft');
    await page.locator('#body-mass').fill('400');
    await page.evaluate(() => baseballMaker.requestWorkbenchAdjustmentV82({path:'body.massKg'}));
    await page.locator('#maker-recovery-apply-v82').click();
    assert.equal(await page.locator('#body-mass').inputValue(), '300'); assert.equal((await page.evaluate(() => baseballMaker.getState().player)).body.massKg, 300);
    assert.deepEqual(await roster(page), liveBeforeResearch, 'research recovery never mutates game roster');
    row.checks.push({researchWorkbench:{cancelKeepsRaw:true, discardRestoresValidDraft:true, applyExact:true, gameRosterExact:true}});

    report.phase = 'research-text-draft-recovery-' + width;
    row.textDraftRecovery = [];
    for (const id of ['player-name', 'player-id']) {
      const control = page.locator('#' + id), before = await page.evaluate(() => baseballMaker.getState().player), previousInput = await control.inputValue(), errorsBefore = fault.errors.length;
      await control.fill('');
      assert.equal(await control.inputValue(), '', 'blank text is retained for explicit correction');
      const errorStatus = await page.locator('#error-status').evaluate(node => ({visible:!node.hidden && getComputedStyle(node).display !== 'none', text:node.textContent}));
      const errors = fault.errors.slice(errorsBefore);
      await page.locator('#maker-workbench-discard-v82').click();
      assert.equal(await control.inputValue(), previousInput, id + ' discard restores accepted text');
      assert.deepEqual(await page.evaluate(() => baseballMaker.getState().player), before, id + ' discard restores entire valid research player');
      assert.deepEqual(await roster(page), liveBeforeResearch, id + ' blank text never changes game roster');
      row.textDraftRecovery.push({id, blankRetained:true, errorStatus, errors, discardRestored:true, gameRosterExact:true});
    }
    row.checks.push({researchTextDraft:{fields:row.textDraftRecovery.map(item => item.id), explicitDiscard:true}});

    report.phase = 'reference-experiment-recovery-' + width;
    await page.locator('#tab-bat').click();
    if (!await page.locator('#swing-legacy-research').evaluate(node => node.open)) await page.locator('#swing-legacy-research > summary').click();
    await page.waitForFunction(() => baseballMaker.getPlayerSwingPreview().active === false);
    await page.locator('#trajectory-mode').selectOption('reference-experiment');
    const experimentBefore = await page.evaluate(() => ({massKg:baseballMaker.getReferenceExperimentInput()?.player.bat.massKg, mode:baseballMaker.getState().reference.mode}));
    assert.equal(experimentBefore.mode, 'reference-experiment'); assert.equal(typeof experimentBefore.massKg, 'number'); assert.notEqual(experimentBefore.massKg, 5, 'experiment fixture starts at a different valid mass');
    await page.locator('#tab-player').click();
    await page.locator('#bat-mass').evaluate(node => {for (let current = node.parentElement; current; current = current.parentElement) if (current.tagName === 'DETAILS') current.open = true;});
    await page.locator('#bat-mass').fill('10');
    await page.evaluate(() => baseballMaker.requestWorkbenchAdjustmentV82({path:'bat.massKg'}));
    assert.equal((await recovery(page)).proposal.suggestedValue, 5);
    await page.locator('#maker-recovery-apply-v82').click();
    row.referenceExperimentRecovery = await page.evaluate(() => {
      const state = baseballMaker.getState(), input = baseballMaker.getReferenceExperimentInput(), expectedInput = structuredClone(input);
      expectedInput.player = structuredClone(state.player);
      const expected = KneekuraBaseballWorkbench.simulateReferenceBattingWorkbench(expectedInput);
      return {mode:state.reference.mode, inputMassKg:input.player.bat.massKg, draftMassKg:state.player.bat.massKg, resultMatchesCurrentPlayer:JSON.stringify(baseballMaker.getPhysicsResult()) === JSON.stringify(expected)};
    });
    assert.deepEqual(await roster(page), liveBeforeResearch, 'reference recovery never mutates game roster');
    row.referenceExperimentRecovery.beforeInputMassKg = experimentBefore.massKg;
    row.checks.push({referenceExperiment:{requestedMassKg:10, suggestedMassKg:5, currentInputAndResult:true}});
    await page.locator('#tab-bat').click(); await page.locator('#trajectory-mode').selectOption('core'); await page.locator('#tab-player').click();

    report.phase = 'comparison-population-' + width;
    const poolBefore = await page.evaluate(() => baseballMaker.getState().population), prefix = 'qa-v82-' + width + '-';
    for (const suffix of ['A', 'B']) {
      await page.locator('#player-id').fill(prefix + suffix); await page.locator('#player-name').fill('受け入れ試験' + suffix);
      await page.locator('#add-player-population').click();
    }
    const poolTwo = await page.evaluate(() => baseballMaker.getState().population);
    assert.equal(poolTwo.length, poolBefore.length + 2);
    await page.locator('#population-member-v82').selectOption(prefix + 'A'); await page.locator('#population-remove-v82').click();
    const removed = await page.evaluate(() => baseballMaker.getState().population);
    assert.deepEqual(removed, poolTwo.filter(player => player.identity.playerId !== prefix + 'A'), 'only selected comparison member is removed');
    await page.locator('#population-undo-v82').click(); assert.deepEqual(await page.evaluate(() => baseballMaker.getState().population), poolTwo, 'undo restores exact comparison population');
    await page.locator('#population-member-v82').selectOption(prefix + 'A'); await page.locator('#population-remove-v82').click();
    await page.locator('#player-id').fill(prefix + 'C'); await page.locator('#add-player-population').click();
    const afterNewEdit = await page.evaluate(() => baseballMaker.getState().population);
    await page.locator('#population-undo-v82').evaluate(node => node.click());
    assert.deepEqual(await page.evaluate(() => baseballMaker.getState().population), afterNewEdit, 'stale undo cannot overwrite later confirmed edit');
    await page.locator('#population-member-v82').selectOption(prefix + 'B'); await page.locator('#population-remove-v82').click();
    const importState = await page.evaluate(() => baseballMaker.getState()); await page.evaluate(state => baseballMaker.importState(state), importState);
    await page.locator('#population-undo-v82').evaluate(node => node.click());
    assert.deepEqual(await page.evaluate(() => baseballMaker.getState().population), importState.population, 'stale undo cannot overwrite imported state');
    assert.deepEqual(await roster(page), liveBeforeResearch);
    row.checks.push({comparisonPopulation:{individualRemove:true, exactUndo:true, laterEditInvalidatesUndo:true, importInvalidatesUndo:true}});

    report.phase = 'save-and-layout-' + width;
    await selectPlayer(page, selectedId);
    const fullJson = await downloadJson(page, 'save-json'), rosterJson = await downloadJson(page, 'export-live-roster');
    assert.deepEqual(fullJson.livePhysicalRoster, await roster(page)); assert.deepEqual(rosterJson, await roster(page));
    assert.equal((await recovery(page)).pendingFields.length, 0); assert.equal((await recovery(page)).proposal, null);
    row.layout = await assertLayout(page, width, 'maker');
    await page.screenshot({path:resolve(directory, 'recovered-maker-' + width + '.png'), fullPage:true});
    await page.locator('#standalone-player-editor').evaluate(node => {node.open = true;}); row.researchLayout = await assertLayout(page, width, 'research');
    assert.equal(sha(await page.evaluate(() => JSON.stringify(KneekuraReferenceBatMotions))), row.source.referenceSha256, 'all 673 source clips unchanged');
    assert.deepEqual(fault.external, []);
    row.checks.push({realJsonDownloads:true, noDependencyErrors:true, noExternalRequests:true, sourceClipsExact:true});
    await page.close();
  }
  report.phase = 'text-draft-and-page-errors';
  for (const row of report.views) for (const item of row.textDraftRecovery) {
    assert.deepEqual(item.errors, [], row.width + '/' + item.id + ' blank research text must not throw pageerror');
    assert(item.errorStatus.visible && japanese.test(item.errorStatus.text), row.width + '/' + item.id + ' blank research text must show a Japanese error');
  }
  for (const row of report.views) {
    assert.equal(row.referenceExperimentRecovery.mode, 'reference-experiment');
    assert.equal(row.referenceExperimentRecovery.draftMassKg, 5, row.width + ' experiment draft mass is adjusted');
    assert.equal(row.referenceExperimentRecovery.inputMassKg, 5, row.width + ' reference experiment input must refresh after recovery');
    assert.equal(row.referenceExperimentRecovery.resultMatchesCurrentPlayer, true, row.width + ' reference result matches current adjusted player');
  }
  for (const fault of report.faults) assert.deepEqual(fault.errors, [], fault.width + ' page errors');
  report.phase = 'source-pins';
  for (const [path, expected] of Object.entries(manifest.inputs)) assert.equal(sha(await readFile(resolve(path))), expected, 'source pin ' + path);
  const nativeCurrentSourceDifferences = [];
  for (const [path, expected] of Object.entries(nativeManifest.inputs)) {
    const actual = sha(await readFile(resolve(path)));
    if (actual !== expected) nativeCurrentSourceDifferences.push({path, frozenSourceSha256:expected, currentSourceSha256:actual});
  }
  assert.equal(sha(await readFile('dist/batting-workbench-core.js')), report.coreSha256, 'latest compiled Core matches tested artifact');
  report.native.latestCompiledCoreSha256 = sha(await readFile('dist/native-match-core-browser.js'));
  report.native.latestCompiledCoreMatchesFrozen = report.native.latestCompiledCoreSha256 === report.native.coreSha256;
  assert.equal(sha(await readFile(artifact)), report.sha256, 'artifact unchanged during browser QA');
  assert.equal(sha(await readFile(artifact + '.build.json')), report.metadataSha256, 'metadata unchanged during browser QA');
  assert.equal(sha(await readFile(artifact + '.bundle-inputs.json')), report.manifestSha256, 'manifest unchanged during browser QA');
  assert.equal(sha(await readFile(new URL(import.meta.url))), report.harnessSha256, 'harness unchanged during browser QA');
  assert.equal(sha(await readFile(nativeArtifact)), report.native.sha256, 'normal renderer unchanged during browser QA');
  assert.equal(sha(await readFile(nativeArtifact + '.build.json')), report.native.metadataSha256, 'normal renderer metadata unchanged during browser QA');
  assert.equal(sha(await readFile(nativeArtifact + '.bundle-inputs.json')), report.native.manifestSha256, 'normal renderer manifest unchanged during browser QA');
  report.sourcePinsAtEnd = {verified:true, count:Object.keys(manifest.inputs).length, entrySha256:manifest.entrySha256};
  report.native.sourcePinsAtEnd = {frozenManifestUnchanged:true, count:Object.keys(nativeManifest.inputs).length, entrySha256:nativeManifest.entrySha256, currentSourceDifferences:nativeCurrentSourceDifferences, scope:'Frozen normal renderer bytes/metadata/manifest are verified. Its historical source hashes are not asserted equal to current authoring sources.'};
  report.pass = true; report.phase = 'complete';
} catch (error) {
  report.error = String(error.stack ?? error);
  console.error(JSON.stringify({pass:false, phase:report.phase, error:String(error)}));
  process.exitCode = 1;
} finally {
  await browser?.close();
  await writeFile(resolve(directory, 'maker-internal-recovery-check.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({pass:report.pass, artifact, sha256:report.sha256, widths:report.views.map(view => view.width), report:resolve(directory, 'maker-internal-recovery-check.json')}));
