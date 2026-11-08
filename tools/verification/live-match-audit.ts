import { deepStrictEqual, strictEqual, ok } from 'node:assert';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createLiveBaseballMatchV1 } from '../../src/integration/browser/LiveBaseballMatchV1';
import { liveMatchFixture } from '../../src/integration/browser/LiveBaseballMatchV1.test-support';
import { reducePlayableMatchV1 } from '../../src/integration/browser/PlayableMatchRulesV1';
import { compactLiveIssuedPitchV1, hashLiveMatchRecordingValueV1 as sha } from './LiveMatchRecordingV1';
const count=Number(process.argv[2]??101),directory=resolve(process.argv[3]??'../../outputs/verification-authored-with-bat-v33-matches-v1'),firstGame=Number(process.argv[4]??0);
const pattern=process.argv[5]??'audit';
if(!Number.isSafeInteger(count)||count<1)throw new Error('positive game count required');
mkdirSync(directory,{recursive:false});
const aggregate={games:count,pitches:0,contacts:0,throws:0,catches:0,groundContacts:0,homeRuns:0,walks:0,strikeouts:0,
  multiOutPlays:0,runs:0,maximumInning:0,maximumPitchMs:0,failures:[] as unknown[],summaries:[] as unknown[]};
const began=Date.now();
const template=liveMatchFixture(),measurementHash=sha(template.measuredClips);
for(let game=0;game<count;game++){
  const seed=2468+(firstGame+game)*7919,host=createLiveBaseballMatchV1({...template,seed}),records:unknown[]=[],classes:Record<string,number>={};let chain='0'.repeat(64),pitches=0;
  try{
    while(!host.inspect().finished&&pitches<1200){
      const before=host.inspect().match,command={batting:(pattern!=='unit'&&pitches%11===0?'take':pitches%7===0?'power':pitches%5===0?'contact':'balanced') as 'take'|'power'|'contact'|'balanced',
        pitchType:'auto',location:'auto',managedTeam:(pattern==='unit'?0:pitches%2) as 0|1},start=Date.now(),record=host.issuePitch(command);
      aggregate.maximumPitchMs=Math.max(aggregate.maximumPitchMs,Date.now()-start);pitches++;aggregate.pitches++;
      deepStrictEqual(record.beforeMatch,before);ok(record.frames.length>0);ok(record.match.balls>=0&&record.match.balls<=3);ok(record.match.strikes>=0&&record.match.strikes<=2);
      ok(record.match.outs>=0&&record.match.outs<=3);ok(record.match.score.away>=before.score.away&&record.match.score.home>=before.score.home);
      const field=record.play.field,rules=record.play.rules;strictEqual(rules.kind,'applied');
      if(rules.kind==='applied'){
        strictEqual(record.match.score.away+record.match.score.home-before.score.away-before.score.home,rules.scoredRunnerIds.length);
        if(rules.outcomes.length>1)aggregate.multiOutPlays++;
        const event=field?{kind:'field_play' as const,facts:field.ruleFacts}:{kind:'pitch_call' as const,tick:rules.endedAtTick,call:record.play.call!};
        deepStrictEqual(reducePlayableMatchV1({match:before,batterRunnerId:record.batterPlayerId,regulationInnings:9,event}),rules);
      }
      if(record.play.contact){aggregate.contacts++;ok(field);}
      if(field){ok(field.end.complete);aggregate.throws+=field.facts.filter(f=>f.kind==='throw_release').length;
        aggregate.catches+=field.facts.filter(f=>f.kind==='catch_secured').length;aggregate.groundContacts+=field.facts.filter(f=>f.kind==='ground_contact').length;
        ok(field.frames.filter(f=>f.ball.possessedBy!==null).every(f=>!f.ball.visible));
      }
      classes[record.play.classification]=(classes[record.play.classification]??0)+1;
      if(record.play.classification==='home_run')aggregate.homeRuns++;if(record.play.classification==='walk')aggregate.walks++;if(record.play.classification==='strikeout')aggregate.strikeouts++;
      // Hashes expose file corruption in this audit pack; they do not authenticate
      // a browser export as Native history or replace re-execution verification.
      const item=compactLiveIssuedPitchV1(record,pitches,chain);
      chain=item.hash;records.push(item);
    }
    const final=host.inspect();ok(final.finished,'game exceeded bounded audit pitches');ok(final.match.inning>=9,'regulation not reached');
    aggregate.runs+=final.match.score.away+final.match.score.home;aggregate.maximumInning=Math.max(aggregate.maximumInning,final.match.inning);
    const summary={seed,pitches,final:final.match,line:final.line,classes,recordsHash:chain};aggregate.summaries.push(summary);
    writeFileSync(resolve(directory,`game-${String(game+1).padStart(3,'0')}.json`),JSON.stringify({authority:'LOCAL_BROWSER_CORE_HOST_V1',summary,records})+'\n',{flag:'wx'});
    process.stdout.write(JSON.stringify({game:game+1,seed,pitches,contacts:aggregate.contacts,score:final.match.score,inning:final.match.inning,seconds:(Date.now()-began)/1000})+'\n');
  }catch(error){aggregate.failures.push({game:game+1,seed,pitches,error:String(error)});writeFileSync(resolve(directory,`failed-${game+1}.json`),JSON.stringify({error:String(error),cause:(error as Error).cause,state:host.inspect(),records})+'\n',{flag:'wx'});throw error;}
}
writeFileSync(resolve(directory,'audit.json'),JSON.stringify({...aggregate,measurementHash,elapsedSeconds:(Date.now()-began)/1000,
  limitations:['Explicit SI test calibration, not empirical named NLB/MLB ability.','Browser-local Core execution, not SQLite Native authority.','No real-phone proof or official H/E scorer.']},null,2)+'\n',{flag:'wx'});
process.stdout.write(JSON.stringify({...aggregate,summaries:aggregate.summaries.length,elapsedSeconds:(Date.now()-began)/1000})+'\n');
