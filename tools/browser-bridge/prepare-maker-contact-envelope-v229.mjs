import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import vm from 'node:vm';
import { build } from 'esbuild';
import ts from 'typescript';
const root=process.cwd(), [outputArg,envelopeArg]=process.argv.slice(2),output=resolve(outputArg??''),rel=relative(root,output);
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel)&&envelopeArg,'new workspace HTML and genuine envelope required');
const basePath='docs/verification/realism-debug-20261027/candidate-maker-observed-region-v222-01/maker.html', makerPath='docs/demos/baseball-maker-ui-v94.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const base=await readFile(basePath,'utf8'),maker=await readFile(makerPath,'utf8'),envelopeText=await readFile(resolve(envelopeArg),'utf8');
assert.equal(sha(base),'cdfadbaf8ed1a0e857bc6a3282ad162cd6d4cbcb9584715ab9b1556060c48067','V222 accepted base differs');
assert(!/<\/script/i.test(maker));
const result=await build({entryPoints:['src/integration/traits/ContactDescriptorEnvelopeV229.ts'],bundle:true,write:false,platform:'browser',format:'iife',globalName:'KneekuraContactEnvelopeV229',target:['es2022'],legalComments:'none',metafile:true});
assert.equal(result.outputFiles.length,1);const parser=result.outputFiles[0].text;assert(!/<\/script/i.test(parser));
const context=vm.createContext({envelopeText});vm.runInContext(parser,context);
const envelope=JSON.parse(JSON.stringify(vm.runInContext('KneekuraContactEnvelopeV229.readContactDescriptorEnvelopeV229(JSON.parse(envelopeText))',context)));
const source=ts.createSourceFile('maker-ui.js',maker,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);assert.equal(source.parseDiagnostics.length,0);
function isMaker(statement){if(!ts.isExpressionStatement(statement))return false;let node=statement.expression;while(ts.isParenthesizedExpression(node))node=node.expression;
 if(!ts.isCallExpression(node))return false;node=node.expression;while(ts.isParenthesizedExpression(node))node=node.expression;
 if(!(ts.isArrowFunction(node)||ts.isFunctionExpression(node))||!ts.isBlock(node.body))return false;
 const ownsTraits=node.body.statements.some(row=>ts.isVariableStatement(row)&&row.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text==='independentTraits'));if(!ownsTraits)return false;
 let has=false;function visit(n){if(ts.isIdentifier(n)&&n.text==='initializeLiveRoster')has=true;ts.forEachChild(n,visit)}visit(node.body);return has;}
assert.equal(source.statements.filter(isMaker).length,1);
const edits=[];for(const m of base.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
 const body=m[1],offset=m.index+m[0].indexOf('>')+1, ast=ts.createSourceFile('inline.js',body,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 for(const item of ast.statements.filter(isMaker)){assert.equal(ast.parseDiagnostics.length,0);edits.push({start:offset+item.getStart(ast),end:offset+item.getEnd(),old:item.getText(ast)});}}
assert.equal(edits.length,1,'one V222 maker UI seam required');const edit=edits[0];
const injection='<script>\n'+parser+'\n;globalThis.KneekuraNativeContactDescriptorEnvelopeV229='+JSON.stringify(envelope).replace(/</g,'\\u003c')+';\n</script>\n';
const head=base.toLowerCase().indexOf('</head>');assert(head>=0&&head<edit.start);
const outputText=base.slice(0,head)+injection+base.slice(head,edit.start)+maker.trimEnd()+base.slice(edit.end);
const reversed=outputText.replace(injection,'').replace(maker.trimEnd(),edit.old);assert.equal(reversed,base,'changes must reverse to every V222 base byte');
await writeFile(output,outputText,{flag:'wx'});
const manifest={boundary:'V229_LOCAL_MAKER_CANDIDATE_ONLY',basePath,baseSha256:sha(base),output,outputSha256:sha(outputText),makerSha256:sha(maker),
 parserSha256:sha(parser),parserInputs:Object.fromEntries(await Promise.all(Object.keys(result.metafile.inputs).sort().map(async p=>[p,sha(await readFile(p))]))),
 envelopeSha256:sha(envelopeText),reconstructsBaseBytes:true,existingWorkbenchAndPracticeBuildUnchanged:true,physicsEffects:'NONE'};
await writeFile(output+'.manifest.json',JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(manifest));
