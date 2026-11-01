import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { prepareDirectionMakerHtml } from './prepare-maker-direction.mjs';

const oldNative = 'var KneekuraNativeMatchCore = (()=>{var __toCommonJS=1;return {};})();';
const oldWorkbench = 'var KneekuraBaseballWorkbench = (()=>{var __toCommonJS=1;return {};})();';
const anchor = '/* Four physical experiments share one pitch, one player and one measured form. */';
const oldUi = anchor + '\n(function(root){root.KneekuraBallComparison=Object.freeze({});})(globalThis);';
const game = '<!doctype html><script>' + oldNative + '</script><p>game-kept</p>';
const gameLiteral = JSON.stringify(game).replace(/</g, '\\u003c');
const html = '<!doctype html><script>' + oldWorkbench + '</script><div>maker-kept</div><script>globalThis.KneekuraMakerMatchHtmlV70=' +
  gameLiteral + ';globalThis.KneekuraMakerPitcherMatchHtmlV77=' + gameLiteral + ';\n' + oldUi + '</script>';

test('updates the workbench, embedded game Core and actual comparison UI without discarding surrounding code', () => {
  const result = prepareDirectionMakerHtml({ html, nativeCode: 'new-native', workbenchCode: 'new-workbench', comparisonSource: 'new-comparison' });
  assert.equal(result.embeddedGameCount, 2); assert.equal(result.workbenchCount, 1);
  assert(result.html.includes('<div>maker-kept</div>'));
  assert(result.html.includes('new-workbench')); assert(result.html.includes('new-comparison'));
  assert(!result.html.includes(oldUi)); assert(!result.html.includes('var KneekuraBaseballWorkbench ='));
  assert(result.html.includes('new-native')); assert(result.html.includes('game-kept'));
  assert(!result.html.includes(oldNative));
});

test('refuses ambiguous embedded games and a missing UI seam', () => {
  assert.throws(() => prepareDirectionMakerHtml({ html: html.replace(oldUi, ''), nativeCode: 'n', workbenchCode: 'w', comparisonSource: 'u' }), /comparison UI/);
  const duplicate = html.replace('globalThis.KneekuraMakerMatchHtmlV70=', 'globalThis.KneekuraMakerMatchHtmlV70=' + gameLiteral + ';globalThis.KneekuraMakerMatchHtmlV70=');
  assert.throws(() => prepareDirectionMakerHtml({ html: duplicate, nativeCode: 'n', workbenchCode: 'w', comparisonSource: 'u' }), /embedded game/);
});

test('appends one isolated practice UI with its actual build and exact compact codec', () => {
  const practiceSource = 'globalThis.practiceMarker=true;',
    result = prepareDirectionMakerHtml({ html: html + '</body>', nativeCode: 'n', workbenchCode: 'w', comparisonSource: 'u', practiceSource });
  assert.equal(result.editedSpans, 5);
  assert.equal(result.html.split('KneekuraBattingPracticeBuildV150=').length - 1, 1);
  assert(result.html.includes('globalThis.KneekuraBattingPracticeCodecV150={stringify:function stringifyDebugRecord'));
  assert(result.html.indexOf(practiceSource) < result.html.lastIndexOf('</body>'));
  assert.throws(() => prepareDirectionMakerHtml({ html, nativeCode: 'n', workbenchCode: 'w', comparisonSource: 'u', practiceSource }), /fresh maker body/);
  assert.throws(() => prepareDirectionMakerHtml({ html: html + '</body>', nativeCode: 'n', workbenchCode: 'w', comparisonSource: 'u', practiceSource: '</script>' }), /unsafe practice/);
});

test('replaces the one current pitcher UI and binds its actual Source without touching other scripts', () => {
  const oldPitcher='/* Canonical authoring UI. Pitch trajectories and trial metrics */\n(function(root){root.KneekuraPitcherMakerV78=Object.freeze({old:true});})(globalThis);',
    source=html.replace(oldUi,oldPitcher+'\n'+oldUi),pitcherSource='globalThis.newPitcherMarker=true;',
    result=prepareDirectionMakerHtml({html:source,nativeCode:'n',workbenchCode:'w',comparisonSource:'u',pitcherSource});
  assert.equal(result.pitcherUiCount,1);assert.equal(result.editedSpans,5);
  assert(!result.html.includes(oldPitcher));assert(result.html.includes(pitcherSource));
  assert(result.html.includes('KneekuraPitcherLabBuildV155=Object.freeze('));assert(result.html.includes('pitcherUiSha256'));
  assert(result.html.includes('<div>maker-kept</div>'));
  assert.equal(result.embeddedGameCount,2);assert(result.html.includes('game-kept'));
  assert.throws(()=>prepareDirectionMakerHtml({html,nativeCode:'n',workbenchCode:'w',comparisonSource:'u',pitcherSource}),/one current pitcher UI/);
  assert.throws(()=>prepareDirectionMakerHtml({html:source+'<script>'+oldPitcher+'</script>',nativeCode:'n',workbenchCode:'w',comparisonSource:'u',pitcherSource}),/one current pitcher UI/);
});

test('updates the existing isolated practice script and its build without removing adjacent UI', () => {
  const oldPractice='<script>globalThis.KneekuraBattingPracticeBuildV150={old:true};\nglobalThis.KneekuraBattingPracticeCodecV150={};\n(function(root){root.KneekuraBattingPractice=Object.freeze({old:true});})(globalThis);</script>',
    source=html+'<div>before-practice</div>'+oldPractice+'<script>globalThis.adjacentUiKept=true;</script></body>',
    result=prepareDirectionMakerHtml({html:source,nativeCode:'n',workbenchCode:'w',comparisonSource:'u',practiceSource:'globalThis.newPractice=true;'});
  assert.equal(result.html.split('KneekuraBattingPracticeBuildV150=').length-1,1);
  assert(!result.html.includes('KneekuraBattingPractice=Object.freeze({old:true})'));
  assert(result.html.includes('globalThis.newPractice=true;'));assert(result.html.includes('<div>before-practice</div>'));
  assert(result.html.includes('<script>globalThis.adjacentUiKept=true;</script>'));
  assert.throws(()=>prepareDirectionMakerHtml({html:source.replace('</body>',oldPractice+'</body>'),nativeCode:'n',workbenchCode:'w',comparisonSource:'u',practiceSource:'p'}),/one isolated practice/);
});

const oldMaker = `(() => {
  const independentTraits = true;
  function initializeLiveRoster() {}
  globalThis.oldMaker = true;
  initializeLiveRoster();
})();`;
const newMaker = `(() => {
  const independentTraits = true;
  function initializeLiveRoster() {}
  globalThis.newKireMaker = true;
  initializeLiveRoster();
})();\n`;
const withMaker = maker => html.replace(oldUi, maker + '\n' + oldUi);
const baseOptions = source => ({html:source,nativeCode:'new-native',workbenchCode:'new-workbench',comparisonSource:'new-comparison'});

test('replaces only the maker IIFE span, preserving literal copies, adjacent modules, games and PNG bytes', () => {
  const embedded='const embeddedMakerText='+JSON.stringify(oldMaker)+';',
    before='/* maker-prefix-kept */\nglobalThis.previewKept=true;\n'+embedded+'\n',
    after='\n/* maker-suffix-kept */\nglobalThis.libraryKept=true;\n',
    source=withMaker(before+oldMaker+after)+'<img src="data:image/png;base64,PNG_ORIGINAL_BYTES">',
    ordinary=prepareDirectionMakerHtml(baseOptions(source)),
    result=prepareDirectionMakerHtml({...baseOptions(source),makerSource:newMaker});
  assert.equal(result.html,ordinary.html.replace(oldMaker,newMaker.trimEnd()));
  assert.equal(result.makerUiCount,1);assert.equal(result.editedSpans,ordinary.editedSpans+1);
  assert.equal(result.makerUiSha256,createHash('sha256').update(newMaker).digest('hex'));
  assert(result.html.includes(embedded));assert(result.html.includes(before));assert(result.html.includes(after));
  assert(result.html.includes('data:image/png;base64,PNG_ORIGINAL_BYTES'));
  assert.equal(result.embeddedGameCount,2);assert(result.html.includes('game-kept'));
  assert(result.html.includes('<div>maker-kept</div>'));
});

test('recognizes parenthesized arrow and function IIFEs with direct maker variables', () => {
  const arrow='((((()=>{let independentTraits=true;function initializeLiveRoster(){};initializeLiveRoster();}))))();',
    regular='((function(root){var independentTraits=true;function initializeLiveRoster(){};initializeLiveRoster();})(globalThis));';
  for(const previous of [arrow,regular]){
    const result=prepareDirectionMakerHtml({...baseOptions(withMaker(previous)),makerSource:newMaker});
    assert.equal(result.makerUiCount,1);assert(!result.html.includes(previous));assert(result.html.includes(newMaker.trimEnd()));
  }
});

test('rejects missing or duplicate maker spans and ignores marker text, nested functions and block-local variables', () => {
  const nested='function hiddenMaker(){'+oldMaker+'}',
    indirect='(()=>{if(true){const independentTraits=true;}function initializeLiveRoster(){};initializeLiveRoster();})();',
    textOnly='(()=>{const independentTraits=true;const text="initializeLiveRoster";/* initializeLiveRoster */})();';
  for(const source of [html,withMaker('const literal='+JSON.stringify(oldMaker)+';'),withMaker(nested),withMaker(indirect),withMaker(textOnly)])
    assert.throws(()=>prepareDirectionMakerHtml({...baseOptions(source),makerSource:newMaker}),/one current maker UI/);
  for(const source of [withMaker(oldMaker+'\n'+oldMaker),withMaker(oldMaker)+'<script>'+oldMaker+'</script>'])
    assert.throws(()=>prepareDirectionMakerHtml({...baseOptions(source),makerSource:newMaker}),/one current maker UI/);
});

test('rejects unsafe, malformed or non-IIFE replacement source and a malformed owning script', () => {
  for(const makerSource of [null,42,'</ScRiPt>','(()=> {','globalThis.notMaker=true;',newMaker+newMaker])
    assert.throws(()=>prepareDirectionMakerHtml({...baseOptions(withMaker(oldMaker)),makerSource}),/maker.*source|maker UI IIFE/);
  const malformed=oldMaker.replace('independentTraits = true','independentTraits = ');
  assert.throws(()=>prepareDirectionMakerHtml({...baseOptions(withMaker(malformed)),makerSource:newMaker}),/maker inline script must parse/);
});

test('leaves the existing output contract exact when makerSource is omitted or undefined', () => {
  const options=baseOptions(withMaker(oldMaker)),omitted=prepareDirectionMakerHtml(options),
    explicitUndefined=prepareDirectionMakerHtml({...options,makerSource:undefined});
  assert.deepEqual(explicitUndefined,omitted);assert(omitted.html.includes(oldMaker));
  assert.equal(Object.hasOwn(omitted,'makerUiCount'),false);assert.equal(Object.hasOwn(omitted,'makerUiSha256'),false);
});
