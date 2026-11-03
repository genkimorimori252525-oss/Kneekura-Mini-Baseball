import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const out = resolve(process.argv[2] || 'docs/verification/releases/v111/policy-probe');
await mkdir(out, { recursive: true });
const core = await readFile('dist/native-match-core-browser.js', 'utf8');
const data = {};
for (const [key, file] of Object.entries({ catalog: 'live-game-roster-catalog-v105.json', roster: 'live-game-roster-v98.json', clips: 'measured-bat-motions.json' })) data[key] = JSON.parse(await readFile('docs/demos/' + file, 'utf8'));
const api = new Function(core + ';return KneekuraNativeMatchCore;')();
const result = JSON.parse(new Function('KneekuraNativeMatchCore', 'inputJson', 'performance', `return JSON.stringify((()=>{
 const api=KneekuraNativeMatchCore,data=JSON.parse(inputJson),base=api.buildPitcherWorkbenchInputV77({players:data.catalog.players,roster:data.roster,
  pitcherId:'1-p0',batterId:'0-b0',catcherId:'1-b0',measuredClips:data.clips.clips,seed:1234,pitchType:'fastball',location:'auto'}),
  zone={halfWidth:.2159,lowerY:.55,upperY:1.25},situation={balls:3,strikes:0,outs:0,occupiedBases:{first:false,second:false,third:false}},
  source={zone,ballRadiusMeters:.0366,seed:1,situation,pitcher:{commandStdMeters:.1},batter:base.batter};
 for(let n=0;n<100;n++)api.planLivePitchTargetV111({...source,seed:n});
 const start=performance.now();for(let n=0;n<1000;n++)api.planLivePitchTargetV111({...source,seed:n});
 const planning={trials:1000,totalMs:performance.now()-start},grid=[];
 for(const sigma of [.015,.08,.2])for(const [balls,strikes]of [[0,0],[0,2],[3,0],[3,2]])for(const strong of [false,true]){
  const plans=Array.from({length:32},(_,seed)=>api.planLivePitchTargetV111({...source,seed,situation:{...situation,balls,strikes},pitcher:{commandStdMeters:sigma},
   batter:strong?{...source.batter,targetSweetSpotSpeedMps:60,maximumSweetSpotSpeedMps:65,aimStdMeters:.004,timingStdSeconds:.002}:source.batter})),
   average=f=>plans.reduce((sum,p)=>sum+f(p),0)/plans.length;
  grid.push({sigma,balls,strikes,strong,meanPStrike:average(p=>p.diagnostics.pStrike),meanPHeart:average(p=>p.diagnostics.pHeart),
   meanTargetRadius:average(p=>Math.hypot(p.position.x/zone.halfWidth,(p.position.y-.9)/.35)),maxCandidates:Math.max(...plans.map(p=>p.diagnostics.candidateCount)),
   minimumChallengeMargin:balls===3?Math.min(...plans.map(p=>p.diagnostics.pStrike-p.diagnostics.challengeProbabilityFloor)):null});
 }
 const physical=[];
 for(const sigma of [.015,.2]){let balls=0,strikes=0,walks=0,strikeouts=0,pitches=0,calledStrikes=0,calledBalls=0;
  while(walks+strikeouts<40&&pitches<600){
   const pitch=api.simulatePitcherWorkbenchV77({pitch:{...base,seed:(3000+Math.imul(pitches+1,0x9e3779b9))>>>0,batting:'take',pitcher:{...base.pitcher,commandStdMeters:sigma},
    pitchSituationV111:{...situation,balls,strikes}}}).pitch;
   if(pitch.call==='ball'){balls++;calledBalls++;}else if(pitch.call==='called_strike'){strikes++;calledStrikes++;}else throw Error('take produced an invalid call');
   pitches++;if(balls===4){walks++;balls=0;strikes=0;}if(strikes===3){strikeouts++;balls=0;strikes=0;}
  }
  physical.push({sigma,plateAppearances:walks+strikeouts,pitches,walks,strikeouts,calledStrikes,calledBalls,actualSourceAndOfficialVolume:true,batting:'take'});
 }
 return {planning,grid,physical};
})())`)(api, JSON.stringify(data), performance));
assert.equal(result.physical[0].plateAppearances, 40); assert.equal(result.physical[1].plateAppearances, 40);
assert(result.physical[0].walks < result.physical[1].walks, 'precise command did not reduce actual walks');
assert(result.grid.every(row => row.maxCandidates <= 104));
assert(result.grid.filter(row=>row.balls===3).every(row=>row.minimumChallengeMargin>=-1e-12),'three-ball exploration discarded the normal contest policy');
result.status = 'PASS'; result.sourceCoreSha256 = createHash('sha256').update(core).digest('hex');
result.limitations = 'Synthetic authored players; 40 take-only PA per condition, not empirical MLB rates or calibrated official strike probabilities. Timing is this local Node run only.';
await writeFile(resolve(out, 'report.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, physical: result.physical, planning: result.planning }));
