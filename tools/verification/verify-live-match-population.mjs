import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {strictEqual,deepStrictEqual,ok} from 'node:assert';

const [runtimeArg,populationArg,countArg='101',replaysArg='1']=process.argv.slice(2);
if(!runtimeArg||!populationArg)throw new Error('requires retained runtime and completed population directory');
const runtime=resolve(runtimeArg),directory=resolve(populationArg),expectedGames=Number(countArg),replays=Number(replaysArg);
ok(Number.isSafeInteger(expectedGames)&&expectedGames>0);ok(Number.isSafeInteger(replays)&&replays>=0);
const read=path=>JSON.parse(readFileSync(path,'utf8')),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=read(resolve(runtime,'manifest.json')),population=read(resolve(directory,'population.json'));
strictEqual(manifest.kind,'retained-local-core-match-audit-runtime-v1');strictEqual(manifest.nativeAuthentication,false);
strictEqual(population.kind,'local-core-match-population-v1');strictEqual(population.success,true);
strictEqual(population.nativeAuthentication,false);strictEqual(population.targetGames,expectedGames);
strictEqual(population.total.games,expectedGames);strictEqual(population.uniqueSeeds,expectedGames);
strictEqual(population.bundleSha256,manifest.bundleSha256);
strictEqual(sha(readFileSync(resolve(runtime,'live-match-audit.mjs'))),manifest.bundleSha256);
strictEqual(sha(readFileSync(resolve(runtime,'verify-live-match-recordings.mjs'))),manifest.verificationSha256);
strictEqual(sha(readFileSync(manifest.measured.path)),manifest.measured.sha256);
const expectedMeasurementHash=sha(JSON.stringify(read(manifest.measured.path).clips));
for(const input of manifest.inputs)strictEqual(sha(readFileSync(input.path)),input.sha256,'current source '+input.path);
const totals={games:0,pitches:0,contacts:0,throws:0,catches:0,groundContacts:0,homeRuns:0,walks:0,strikeouts:0,multiOutPlays:0,runs:0,maximumInning:0};
const seeds=new Set(),gameOrdinals=new Set(),measurementHashes=new Set();let nextOrdinal=0,maximumPitchMs=0;
for(const shard of population.shards){
  ok(/^shard-\d+$/.test(shard.name));strictEqual(shard.passed,true);strictEqual(shard.code,0);strictEqual(shard.firstGame,nextOrdinal);
  ok(Number.isSafeInteger(shard.games)&&shard.games>0);nextOrdinal+=shard.games;
  const path=resolve(directory,shard.name),audit=read(resolve(path,'audit.json'));
  deepStrictEqual(audit,shard.audit);strictEqual(audit.games,shard.games);deepStrictEqual(audit.failures,[]);
  ok(Number.isFinite(audit.maximumPitchMs)&&audit.maximumPitchMs>=0);maximumPitchMs=Math.max(maximumPitchMs,audit.maximumPitchMs);
  strictEqual(audit.measurementHash,expectedMeasurementHash);
  ok(!readdirSync(path).some(name=>/^failed-\d+\.json$/.test(name)),'failed game retained in successful shard');
  const files=readdirSync(path).filter(name=>/^game-\d+\.json$/.test(name)).sort();strictEqual(files.length,shard.games);
  strictEqual(audit.summaries.length,shard.games);measurementHashes.add(audit.measurementHash);
  const actual={...totals};for(const key of Object.keys(actual))actual[key]=0;
  for(let index=0;index<files.length;index++){
    strictEqual(files[index],`game-${String(index+1).padStart(3,'0')}.json`);
    const saved=read(resolve(path,files[index])),summary=saved.summary,ordinal=shard.firstGame+index;
    strictEqual(summary.seed,2468+ordinal*7919);ok(!gameOrdinals.has(ordinal));gameOrdinals.add(ordinal);
    ok(!seeds.has(summary.seed));seeds.add(summary.seed);deepStrictEqual(summary,audit.summaries[index]);
    strictEqual(saved.authority,'LOCAL_BROWSER_CORE_HOST_V1');strictEqual(saved.records.length,summary.pitches);
    const classes={};for(const record of saved.records){
      actual.pitches++;if(record.play.contact)actual.contacts++;
      const field=record.play.field;if(field){
        actual.throws+=field.facts.filter(f=>f.kind==='throw_release').length;
        actual.catches+=field.facts.filter(f=>f.kind==='catch_secured').length;
        actual.groundContacts+=field.facts.filter(f=>f.kind==='ground_contact').length;
      }
      const classification=record.play.classification;classes[classification]=(classes[classification]??0)+1;
      if(classification==='home_run')actual.homeRuns++;if(classification==='walk')actual.walks++;if(classification==='strikeout')actual.strikeouts++;
      if(record.play.rules.outcomes.length>1)actual.multiOutPlays++;
    }
    deepStrictEqual(classes,summary.classes);actual.games++;actual.runs+=summary.final.score.away+summary.final.score.home;
    actual.maximumInning=Math.max(actual.maximumInning,summary.final.inning);
  }
  for(const key of Object.keys(actual)){strictEqual(actual[key],audit[key],shard.name+' '+key);
    totals[key]=key==='maximumInning'?Math.max(totals[key],actual[key]):totals[key]+actual[key];}
}
strictEqual(nextOrdinal,expectedGames);strictEqual(gameOrdinals.size,expectedGames);strictEqual(seeds.size,expectedGames);
strictEqual(measurementHashes.size,1);for(const key of Object.keys(totals))strictEqual(totals[key],population.total[key],key);
strictEqual(maximumPitchMs,population.total.maximumPitchMs);

// Each child checks every chain and re-applies Core adjudication. A selected
// number per shard also re-executes the physical pitches and compares full
// compact records. This is local reproducibility, not Native authentication.
const verification=[],children=new Set();let cursor=0;
const stop=()=>{for(const child of children)child.kill('SIGTERM');};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
try{await Promise.all(Array.from({length:Math.min(8,population.shards.length)},async()=>{
  while(cursor<population.shards.length){const shard=population.shards[cursor++],path=resolve(directory,shard.name);
    await new Promise((done,fail)=>{
      const child=spawn(process.execPath,[resolve(runtime,'verify-live-match-recordings.mjs'),path,String(replays)],
        {cwd:process.cwd(),windowsHide:true,stdio:['ignore','ignore','pipe']});children.add(child);let error='';
      child.stderr.on('data',bytes=>{if(error.length<12000)error+=bytes.toString();});
      child.once('error',error=>{children.delete(child);fail(error);});child.once('exit',(code,signal)=>{
        children.delete(child);code===0?done():fail(new Error(shard.name+' saved verification failed '+code+'/'+signal+' '+error));});
    });
    const report=read(resolve(path,'saved-record-verification.json'));strictEqual(report.verifiedGames,shard.games);
    strictEqual(report.replayedGames,Math.min(replays,shard.games));strictEqual(report.nativeAuthentication,false);
    ok(Number.isSafeInteger(report.tamperChecks)&&report.tamperChecks>=2*shard.games);
    verification.push({shard:shard.name,...report});console.log(JSON.stringify({shard:shard.name,verifiedGames:report.verifiedGames,replayedGames:report.replayedGames}));
  }
}));}catch(error){stop();throw error;}
const report={kind:'local-core-population-records-verified-v1',targetGames:expectedGames,verifiedGames:totals.games,
  totalPitches:totals.pitches,replayedGames:verification.reduce((n,v)=>n+v.replayedGames,0),
  tamperChecks:verification.reduce((n,v)=>n+v.tamperChecks,0),nativeAuthentication:false,
  bundleSha256:manifest.bundleSha256,verificationSha256:manifest.verificationSha256,measurementHash:[...measurementHashes][0],
  totals,verification:verification.sort((a,b)=>a.shard.localeCompare(b.shard)),
  scope:'All expected seeds, files, summaries and aggregate statistics; every saved chain and Core adjudication; selected complete physical re-executions.'};
writeFileSync(resolve(directory,'population-record-verification.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,verification:verification.length}));
