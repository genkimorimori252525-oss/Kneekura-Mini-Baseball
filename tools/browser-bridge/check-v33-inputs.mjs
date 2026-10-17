import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const [htmlArg,frozenArg,reportArg]=process.argv.slice(2);
if(!htmlArg||!frozenArg||!reportArg)throw new Error('requires final HTML, frozen audit manifest and NEW report file');
const html=resolve(htmlArg),frozenPath=resolve(frozenArg),reportPath=resolve(reportArg);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const [htmlBytes,buildBytes,inputBytes,frozenBytes]=await Promise.all([
 readFile(html),readFile(html+'.build.json'),readFile(html+'.bundle-inputs.json'),readFile(frozenPath)]);
const build=JSON.parse(buildBytes),browser=JSON.parse(inputBytes),frozen=JSON.parse(frozenBytes);
assert.equal(sha(htmlBytes),build.sha256,'HTML differs from its build receipt');
assert.equal(browser.entrySha256,build.nativeBundleSha256,'browser entry differs from HTML build');
const canonicalPath=path=>path.replaceAll('\\','/');
const browserInputs=Object.fromEntries(Object.entries(browser.inputs).map(([path,digest])=>[canonicalPath(path),digest]));
const auditOnly=frozen.inputs.filter(input=>!canonicalPath(input.path).startsWith('src/')||/\.test(?:-support)?\.[cm]?[jt]sx?$/.test(input.path));
const shared=frozen.inputs.filter(input=>!auditOnly.includes(input));
assert(shared.length>0,'frozen audit has no shared source inputs');
const mismatches=shared.flatMap(input=>browserInputs[canonicalPath(input.path)]===input.sha256?[]:[{
 path:input.path,frozenSha256:input.sha256,browserSha256:browserInputs[canonicalPath(input.path)]??null}]);
const measuredEqual=frozen.measured.sha256===browser.measuredReferenceSha256&&frozen.measured.sha256===build.measuredReferenceSha256;
const report={status:mismatches.length===0&&measuredEqual?'PASS_SHARED_CORE_AND_MEASURED_INPUTS':'FAIL_SHARED_INPUTS',
 html,htmlSha256:sha(htmlBytes),browserEntrySha256:browser.entrySha256,frozenManifest:frozenPath,
 frozenManifestSha256:sha(frozenBytes),frozenAuditEntrySha256:frozen.bundleSha256,
 sharedSourceInputCount:shared.length,browserSourceInputCount:Object.keys(browserInputs).length,
 sharedSourceInputs:shared,frozenAuditOnlyInputs:auditOnly,mismatches,measuredReference:frozen.measured,measuredEqual,
 boundary:'Source and measured-input identity; browser and Node keep separate runtime/ownership evidence'};
await writeFile(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
assert.equal(mismatches.length,0,JSON.stringify(mismatches));assert(measuredEqual,'measured JSON differs');
console.log(JSON.stringify({status:report.status,htmlSha256:report.htmlSha256,sharedSourceInputCount:shared.length,
 browserSourceInputCount:report.browserSourceInputCount,measuredEqual,report:reportPath},null,2));
