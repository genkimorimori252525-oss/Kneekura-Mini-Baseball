import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve(process.argv[2]),out=resolve(process.argv[3]);await mkdir(out,{recursive:true});
const bytes=await readFile(source),record=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),code=await readFile('dist/native-match-core-browser.js','utf8'),
 needle='function simulateLiveFieldPlayV1(raw) {';assert.equal(code.split(needle).length,2);
let pitchIndex=0;const captures=[];
const stub=raw=>{
 const p=record.pitches[pitchIndex],f=p.play.field;assert(f,'field disagreement at pitch '+(pitchIndex+1));
 writeFileSync(resolve(out,'pitch-'+(pitchIndex+1)+'-field-input.json'),JSON.stringify(raw));
 captures.push({pitch:pitchIndex+1,contactTick:raw.ball.ball.tick??raw.ball.originTick,initial:raw.ball,runnerIds:raw.runners.map(r=>r.runnerId)});
 return {...f,frames:[f.finalFrame]};
};
const api=new Function('_captureFieldV113',code.replace(needle,needle+'\n return _captureFieldV113(raw);')+';return KneekuraNativeMatchCore;')(stub),
 roster=new Map(record.configuration.physicalRoster.entries.map(e=>[e.playerId,e])),
 players=record.configuration.players.map(p=>({...p,...(roster.get(p.playerId)?.traitProfile?{traitProfile:roster.get(p.playerId).traitProfile}:{})})),
 decode=new Function(await readFile('tools/browser-bridge/measured-bat-library-v1.js','utf8')+';return KneekuraMeasuredBatLibrary.decode;')(),
 clips=decode(await readFile('docs/demos/measured-bat-library-v1.json','utf8')).clips,
 host=api.createLiveBaseballMatchV1({seed:record.numericSeed,innings:record.configuration.innings,teams:record.configuration.teams,players,park:record.configuration.park,measuredClips:clips});
const report={pass:false,inputSha256:createHash('sha256').update(bytes).digest('hex'),diagnosticMethod:'REPLAY_PITCHES_WITH_RECORDED_FIELD_ENDS_NOT_A_DEFENSE_VERIFICATION',maximumNumericResidual:0,captures};
function sameNumeric(a,b){
 if(typeof a==='number'&&typeof b==='number'){const residual=Math.abs(a-b);report.maximumNumericResidual=Math.max(report.maximumNumericResidual,residual);assert(residual<=1e-10,'cross-runtime numerical mismatch '+residual);return;}
 if(a&&b&&typeof a==='object'&&typeof b==='object'){assert.deepEqual(Object.keys(a),Object.keys(b));for(const k of Object.keys(a))sameNumeric(a[k],b[k]);return;}
 assert.equal(a,b);
}
try{
 for(pitchIndex=0;pitchIndex<record.pitches.length;pitchIndex++){
  const expected=record.pitches[pitchIndex];assert.deepEqual(host.inspect().match,expected.beforeMatch,'before pitch '+(pitchIndex+1));
  const result=host.issuePitch(expected.command);assert.deepEqual(result.match,expected.match,'after pitch '+(pitchIndex+1));
  if(expected.play.contact)sameNumeric(result.play.contact,expected.play.contact);
 }
 report.pass=true;
}catch(e){report.error=String(e.stack??e);process.exitCode=1;}
await writeFile(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({pass:report.pass,pitches:pitchIndex,captures:captures.length,error:report.error}));
