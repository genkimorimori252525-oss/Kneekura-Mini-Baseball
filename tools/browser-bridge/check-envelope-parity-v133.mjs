import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const folder = resolve(process.argv[2]), out = resolve(process.argv[3]);
await mkdir(out); // Preserve previous evidence rather than overwriting it.
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const prior = JSON.parse(await readFile('docs/verification/spin-trial-v124/integrity.json', 'utf8'));
const artifact = prior.artifacts.find(row => row.path.includes('ばせぼーる'));
const html = await readFile(artifact.path, 'utf8');
assert.equal(sha(html), artifact.sha256);
const oldCode = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(match => match[1]).filter(code => code.includes('var KneekuraNativeMatchCore ='))
  .map(code => code.endsWith('\n') ? code.slice(0, -1) : code).find(code => sha(code) === prior.sourceCoreSha256);
assert(oldCode, 'exact protected V124 Core required');
const build = JSON.parse(await readFile(resolve(folder, 'build-report-v133.json'), 'utf8'));
const code = await readFile('dist/native-match-core-browser.js', 'utf8');
assert.equal(sha(code), build.sourceCoreSha256);
const oldApi = new Function(oldCode + ';return KneekuraNativeMatchCore;')();
const api = new Function(code + ';return KneekuraNativeMatchCore;')();
const roles = ['P','C','1B','2B','3B','SS','LF','CF','RF'];
const teams = [0,1].map(t => ({ id:'t'+t, name:'T'+t,
  battingOrder:Array.from({length:9}, (_,i) => t+'-b'+i), pitcherId:t+'-p0',
  defense:Object.fromEntries(roles.map((r,i) => [r,i===0?t+'-p0':t+'-b'+(i-1)])) }));
const players = [0,1].flatMap(t => [...Array.from({length:9}, (_,i) => ({playerId:t+'-b'+i,name:'test',heightMeters:1.8,bats:i%3===0?'L':'R'})),
  {playerId:t+'-p0',name:'test',heightMeters:1.88,bats:'R'}]).map(p => ({...p,physical:{...api.LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,
    maximumSweetSpotSpeedMps:45,targetSweetSpotSpeedMps:30,motorLatencySeconds:.02,timingStdSeconds:.04,aimStdMeters:.1}}));
const clips = JSON.parse(await readFile('docs/demos/measured-bat-motions.json','utf8')).clips;
const configuration = {seed:31,innings:1,teams,players,measuredClips:clips};
const old = oldApi.createLiveBaseballMatchV1(configuration), current = api.createLiveBaseballMatchV1(configuration);
const records = [], started = performance.now();
for (const batting of ['take','take','take','balanced','power']) {
  const command = {managedTeam:0,batting,pitchType:'auto',location:'auto'};
  const a = JSON.stringify(old.issuePitch(command)), b = JSON.stringify(current.issuePitch(command));
  assert.equal(b,a,'V124/V133 legacy full-record mismatch at '+(records.length+1));
  records.push({batting,sha256:sha(a),bytes:Buffer.byteLength(a)});
}
assert.deepEqual(current.inspect().match,old.inspect().match);
const report = {pass:true,boundary:'PROTECTED_V124_TO_V133_NO_OPTIONAL_ENVELOPE_FULL_RECORD',
  previousCoreSha256:prior.sourceCoreSha256,sourceCoreSha256:sha(code),pitches:records.length,records,elapsedMs:performance.now()-started};
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
