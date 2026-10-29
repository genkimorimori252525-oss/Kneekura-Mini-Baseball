import assert from 'node:assert/strict';
import ts from 'typescript';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyPinnedLiveCore } from './live-debug-core.mjs';
import { replaceDebugPageCore } from './live-debug-case.mjs';
import { stringifyDebugRecord, parseDebugRecord } from './live-debug-record.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');

function makerIifes(source) {
  const unparenthesized = node => {
    while (ts.isParenthesizedExpression(node)) node = node.expression;
    return node;
  };
  return source.statements.filter(statement => {
    if (!ts.isExpressionStatement(statement)) return false;
    const call = unparenthesized(statement.expression);
    if (!ts.isCallExpression(call)) return false;
    const fn = unparenthesized(call.expression);
    if (!(ts.isArrowFunction(fn) || ts.isFunctionExpression(fn)) || !ts.isBlock(fn.body)) return false;
    const ownsTraits = fn.body.statements.some(row => ts.isVariableStatement(row)
      && row.declarationList.declarations.some(declaration => ts.isIdentifier(declaration.name) && declaration.name.text === 'independentTraits'));
    if (!ownsTraits) return false;
    let initializesRoster = false;
    function visit(node) {
      if (ts.isIdentifier(node) && node.text === 'initializeLiveRoster') initializesRoster = true;
      if (!initializesRoster) ts.forEachChild(node, visit);
    }
    visit(fn.body);
    return initializesRoster;
  });
}

/** The maker embeds the game as a JS string, not a top-level Native script.
 * Parse that literal instead of deleting its surrounding UI/preview code. */
export function prepareDirectionMakerHtml({ html, nativeCode, workbenchCode, comparisonSource, practiceSource, pitcherSource, makerSource }) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)], edits = [];
  const gameOwners = new Set(['globalThis.KneekuraMakerMatchHtmlV70', 'globalThis.KneekuraMakerPitcherMatchHtmlV77']), seen = new Set();
  let workbenchCount = 0, embeddedGameCount = 0, pitcherUiCount = 0, makerUiCount = 0;
  assert(!/<\/script/i.test(workbenchCode), 'unsafe workbench inline terminator');
  assert(pitcherSource===undefined||typeof pitcherSource==='string'&&!/<\/script/i.test(pitcherSource),'unsafe pitcher inline source');
  if (makerSource !== undefined) {
    assert(typeof makerSource === 'string' && !/<\/script/i.test(makerSource), 'unsafe maker inline source');
    const source = ts.createSourceFile('maker-replacement.js', makerSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    assert.equal(source.parseDiagnostics.length, 0, 'maker replacement source must parse');
    assert(source.statements.length === 1 && makerIifes(source).length === 1, 'one raw maker UI IIFE required');
  }
  for (const match of scripts) {
    const body = match[1], start = match.index + match[0].indexOf('>') + 1;
    if (body.includes('var KneekuraBaseballWorkbench =') && body.includes('__toCommonJS')) {
      workbenchCount++; edits.push({ start, end: start + body.length, text: workbenchCode + '\n' }); continue;
    }
    const ownsNative = body.includes('var KneekuraNativeMatchCore =');
    if (!ownsNative && makerSource === undefined) continue;
    const source = ts.createSourceFile('maker-inline.js', body, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (makerSource !== undefined) {
      for (const owner of makerIifes(source)) {
        assert.equal(source.parseDiagnostics.length, 0, 'maker inline script must parse before editing');
        edits.push({ start: start + owner.getStart(source), end: start + owner.getEnd(), text: makerSource.trimEnd() });
        makerUiCount++;
      }
    }
    if (!ownsNative) continue;
    assert.equal(source.parseDiagnostics.length, 0, 'maker inline script must parse before editing');
    function visit(node) {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
        && /<!doctype html/i.test(node.text) && node.text.includes('var KneekuraNativeMatchCore =')) {
        const owner = ts.isBinaryExpression(node.parent) ? node.parent.left.getText(source) : null;
        assert(gameOwners.has(owner) && !seen.has(owner), 'unexpected or duplicate embedded game'); seen.add(owner);
        const patched = replaceDebugPageCore(node.text, nativeCode);
        edits.push({ start: start + node.getStart(source), end: start + node.getEnd(),
          text: JSON.stringify(patched.html).replace(/</g, '\\u003c') }); embeddedGameCount++;
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  assert.equal(workbenchCount, 1, 'one workbench bundle required');
  assert.equal(embeddedGameCount, gameOwners.size, 'both owned embedded games required');
  if (makerSource !== undefined) assert.equal(makerUiCount, 1, 'one current maker UI required');
  if(pitcherSource!==undefined){
    // The real maker owns games and several UI modules in one script. Replace
    // only this module's explicit seam, never its enclosing script body.
    const anchor='/* Canonical authoring UI. Pitch trajectories',api='root.KneekuraPitcherMakerV78=Object.freeze',
      start=html.indexOf(anchor),apiAt=html.indexOf(api,start),close='})(globalThis);',end=html.indexOf(close,apiAt)+close.length;
    assert(start>=0&&start===html.lastIndexOf(anchor)&&apiAt>start&&apiAt===html.lastIndexOf(api)
      &&end>apiAt&&html.indexOf('</script>',start)>=end,'one current pitcher UI required');
    pitcherUiCount=1;
    const setup='globalThis.KneekuraPitcherLabBuildV155=Object.freeze('+JSON.stringify({workbenchSha256:sha(workbenchCode),pitcherUiSha256:sha(pitcherSource)})+');\n';
    edits.push({start,end,text:setup+pitcherSource.trimEnd()});
  }
  const anchor = '/* Four physical experiments share one pitch, one player and one measured form. */',
    uiStart = html.indexOf(anchor), close = '})(globalThis);', uiClose = html.indexOf(close, uiStart);
  assert(uiStart >= 0 && uiStart === html.lastIndexOf(anchor) && uiClose > uiStart
    && html.slice(uiStart, uiClose).includes('KneekuraBallComparison=Object.freeze'), 'one comparison UI seam required');
  edits.push({ start: uiStart, end: uiClose + close.length, text: comparisonSource.trimEnd() });
  if (practiceSource !== undefined) {
    assert(typeof practiceSource === 'string' && !/<\/script/i.test(practiceSource), 'unsafe practice inline source');
    const bodyEnd = html.toLowerCase().lastIndexOf('</body>');
    assert(bodyEnd >= 0, 'fresh maker body required for practice');
    const setup = 'globalThis.KneekuraBattingPracticeBuildV150=' + JSON.stringify({ workbenchSha256: sha(workbenchCode),
      practiceUiSha256: sha(practiceSource) }) + ';\nglobalThis.KneekuraBattingPracticeCodecV150={stringify:' +
      stringifyDebugRecord.toString() + ',parse:' + parseDebugRecord.toString() + '};\n';
    const prior=scripts.filter(match=>match[1].includes('globalThis.KneekuraBattingPracticeBuildV150=')),
      replacement='<script>\n'+setup+practiceSource+'\n</script>';
    if(prior.length){
      assert(prior.length===1&&prior[0][1].trimStart().startsWith('globalThis.KneekuraBattingPracticeBuildV150=')&&
        prior[0][1].includes('globalThis.KneekuraBattingPracticeCodecV150=')&&
        prior[0][1].includes('root.KneekuraBattingPractice=Object.freeze')&&prior[0][1].trimEnd().endsWith('})(globalThis);'),
      'one isolated practice script required');
      edits.push({start:prior[0].index,end:prior[0].index+prior[0][0].length,text:replacement});
    }else{
      assert(!html.includes('KneekuraBattingPracticeBuildV150='),'one isolated practice script required');
      edits.push({start:bodyEnd,end:bodyEnd,text:replacement+'\n'});
    }
  }
  edits.sort((a, b) => b.start - a.start);
  for (let i = 1; i < edits.length; i++) assert(edits[i].end <= edits[i - 1].start, 'maker edits overlap');
  let result = html;
  for (const edit of edits) result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  return { html: result, workbenchCount, embeddedGameCount, editedSpans: edits.length,...(pitcherSource===undefined?{}:{pitcherUiCount}),
    ...(makerSource === undefined ? {} : { makerUiCount, makerUiSha256: sha(makerSource) }) };
}

async function main(args) {
  const options = {};
  for (let i = 0; i < args.length; i += 2) {
    assert(/^--(base|native|workbench|out|pitcher|maker)$/.test(args[i]) && args[i + 1], 'named maker candidate arguments required');
    if (args[i] === '--maker') assert(!Object.hasOwn(options, 'maker'), 'one maker source argument required');
    options[args[i].slice(2)] = args[i + 1];
  }
  assert(options.base && options.native && options.workbench && options.out, 'base/native/workbench/out required');
  const native = await verifyPinnedLiveCore({ manifestPath: options.native }), workbench = await verifyPinnedLiveCore({ manifestPath: options.workbench });
  assert(native.manifest.target === 'native' && workbench.manifest.target === 'workbench', 'candidate entry targets differ');
  const base = await readFile(options.base, 'utf8'), ui = await readFile('docs/demos/baseball-maker-ball-comparison-v69.js', 'utf8'),
    practice = await readFile('docs/demos/baseball-maker-batting-practice-v150.js', 'utf8'),
    pitcher=options.pitcher===undefined?undefined:await readFile(options.pitcher,'utf8'),
    maker=options.maker===undefined?undefined:await readFile(options.maker,'utf8'),
    prepared = prepareDirectionMakerHtml({ html: base, nativeCode: native.code, workbenchCode: workbench.code, comparisonSource: ui, practiceSource: practice,pitcherSource:pitcher,makerSource:maker }), out = resolve(options.out);
  await mkdir(out);
  const html = prepared.html.replace(/<title>[^<]*<\/title>/, maker!==undefined?'<title>にーくら野球メーカー 方向・連続打席 統合検証候補</title>':
    options.pitcher===undefined?'<title>にーくら野球メーカー v153 主観予測と方向運動候補</title>':'<title>にーくら野球メーカー v155 投球の変化時刻と比較候補</title>');
  await writeFile(resolve(out, 'maker.html'), html, { flag: 'wx' });
  const report = { authority: 'LOCAL_DIRECTION_PRACTICE_CANDIDATE_NOT_FINAL_DELIVERY', htmlSha256: sha(html), baseSha256: sha(base),
    nativeCoreSha256: native.manifest.entry.sha256, workbenchCoreSha256: workbench.manifest.entry.sha256,
    comparisonUiSha256: sha(ui), embeddedGameCount: prepared.embeddedGameCount, workbenchCount: prepared.workbenchCount,
    practiceUiSha256: sha(practice),
    ...(pitcher===undefined?{}:{pitcherUiSha256:sha(pitcher),pitcherUiCount:prepared.pitcherUiCount}),
    ...(maker===undefined?{}:{makerUiSha256:prepared.makerUiSha256,makerUiCount:prepared.makerUiCount}),
    editedSpans: prepared.editedSpans };
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  assert.equal(sha(await readFile(options.base)), report.baseSha256, 'previous maker changed');
  console.log(JSON.stringify({ directory: options.out, ...report }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv.slice(2));
