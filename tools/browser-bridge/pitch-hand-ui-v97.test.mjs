import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {applyPitchHandUiV97} from './pitch-hand-ui-v97.mjs';

const paths={pitcher:'docs/demos/baseball-maker-pitcher-v92.js',menu:'docs/demos/baseball-maker-pitch-menu-v82.js',arrows:'docs/demos/baseball-maker-pitch-arrows-v89.js',movement:'docs/demos/baseball-maker-pitch-movement-v92.js'};
const sources=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,path])=>[key,await readFile(path,'utf8')])));
test('all four canonical UI sources use hand-aware Core; candidate preset generation stays unchanged',()=>{
  const out=applyPitchHandUiV97(sources);
  for(const text of Object.values(out))new Function(text);
  assert.match(out.pitcher,/mirrorPitcherPhysicalHandV97\(p.physical,p.throws\?\?'R',hand\)/);
  assert.match(out.pitcher,/migratePitchRepertoireV77ToV78\(physical,currentPlayer\(\).throws\?\?'R'\)/);
  for(const key of ['menu','arrows','movement'])assert.match(out[key],/resolvePitcherRepertoireV78\(player.physical,player.throws\?\?'R'\)/);
  assert.match(out.movement,/migratePitchRepertoireV77ToV78\(entry.physical,state.player.throws\?\?'R'\)/);
  assert.equal(out.menu.match(/createPitchSnapshotFromPresetV78[^\n]+/)[0],sources.menu.match(/createPitchSnapshotFromPresetV78[^\n]+/)[0]);
  assert.equal(out.arrows.slice(out.arrows.indexOf('function describe'),out.arrows.indexOf('function refresh')),sources.arrows.slice(sources.arrows.indexOf('function describe'),sources.arrows.indexOf('function refresh')),'SVG math must not reflect left snapshots a second time');
  assert.equal(Object.values(out).some(text=>text.includes('</script')),false);
});
test('missing/duplicate markers and second application fail instead of publishing stale UI',()=>{
  assert.throws(()=>applyPitchHandUiV97({...sources,pitcher:''}));
  assert.throws(()=>applyPitchHandUiV97({...sources,menu:sources.menu+sources.menu}));
  assert.throws(()=>applyPitchHandUiV97(applyPitchHandUiV97(sources)));
});
test('CRLF sources retain their line endings and source objects stay unchanged',()=>{
  const crlf=Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,v.replace(/\r?\n/g,'\r\n')])),saved=structuredClone(crlf),out=applyPitchHandUiV97(crlf);
  assert.deepEqual(crlf,saved);for(const text of Object.values(out))assert.equal(/(?<!\r)\n/.test(text),false);
});
