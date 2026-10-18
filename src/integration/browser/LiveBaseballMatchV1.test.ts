import { expect, it } from 'vitest';
import {writeFileSync} from 'node:fs';
import { createLiveBaseballMatchV1, LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';
const command={batting:'balanced' as const,pitchType:'auto',location:'auto',managedTeam:0 as const};
it('does not pre-generate an initial pitch, and freezes observations independently of later issues',()=>{
  const input=liveMatchFixture(),before=JSON.stringify(input),host=createLiveBaseballMatchV1(input),initial=host.inspect();
  expect(initial.pitchCount).toBe(0);expect(initial.frame.phase).toBe('ready');expect(initial.frame.ball?.visible).toBe(false);
  const pitch=host.issuePitch(command);expect(pitch.beforeMatch).toEqual(initial.match);expect(host.inspect().pitchCount).toBe(1);
  expect(initial.pitchCount).toBe(0);expect(pitch.frames.length).toBeGreaterThan(3);expect(Object.isFrozen(pitch.frames)).toBe(true);
  expect(JSON.stringify(input)).toBe(before);expect(initial.nativeAuthentication).toBe(false);
});
it('copies each current analytic runner velocity into its Host actor frame',()=>{
  const host=createLiveBaseballMatchV1(liveMatchFixture(2468));
  let observed=false,moving=0;
  for(let i=0;i<30&&!observed;i++){
    const record=host.issuePitch(command),field=record.play.field;
    if(!field)continue;
    for(const source of field.frames)for(const runner of source.runners){
      if(runner.retired)continue;
      const shown=record.frames.find(f=>f.tick===source.tick&&f.actors.some(a=>a.playerId===runner.runnerId&&a.role==='runner'));
      expect(shown?.actors.find(a=>a.playerId===runner.runnerId)?.velocity).toEqual(runner.velocity);
      if(Math.hypot(runner.velocity.x,runner.velocity.y,runner.velocity.z)>0)moving++;
    }
    observed=true;
  }
  expect(observed).toBe(true);expect(moving).toBeGreaterThan(0);
});
it('plays a mixed physical game through regulation without a replay frontier or old engine result',()=>{
  const host=createLiveBaseballMatchV1(liveMatchFixture(2468));let pitches=0,contacts=0,fieldPlays=0,halfChanges=0;
  while(!host.inspect().finished&&pitches<700){const before=host.inspect().match;
    const r=(()=>{try{return host.issuePitch({...command,batting:pitches%7===0?'power':pitches%5===0?'contact':'balanced'});}
      catch(error){const path='../../outputs/verification-authored-with-bat-v33-unit-failure-'+Date.now()+'.json';
        try{writeFileSync(path,JSON.stringify({error:String(error),cause:(error as Error).cause,before,pitch:pitches+1})+'\n',{flag:'wx'});
          console.error('Physical failure input retained:',path);}
        catch(archiveError){console.error('Could not retain diagnostic input:',String(archiveError));}
        throw error;}})();pitches++;
    if(r.play.contact){contacts++;const contact=r.play.contact as {exitVelocity:unknown;exitSpin:unknown};
      expect(r.play.outgoingBallMoment!.ball.velocity).toEqual(contact.exitVelocity);expect(r.play.outgoingBallMoment!.ball.spin).toEqual(contact.exitSpin);
      expect(r.play.outgoingBallMoment!.elapsedSeconds).toBe(r.play.contactMoment!.elapsedSeconds);
      expect(r.play.outgoingBallMoment!.ball.position).toEqual(r.play.contactMoment!.ball.position);
      expect(r.play.field!.frames[0].ball.velocity).toEqual(contact.exitVelocity);
    }if(r.play.field){fieldPlays++;expect(r.play.field.end.complete).toBe(true);}
    if(r.match.half!==before.half||r.match.inning!==before.inning)halfChanges++;
    expect(r.frames.every(f=>Number.isSafeInteger(f.tick))).toBe(true);
    expect(r.match.score.away).toBeGreaterThanOrEqual(before.score.away);expect(r.match.score.home).toBeGreaterThanOrEqual(before.score.home);
  }
  const final=host.inspect();expect(final.finished).toBe(true);expect(final.match.inning).toBeGreaterThanOrEqual(9);
  expect(pitches).toBeGreaterThan(54);expect(contacts).toBeGreaterThan(5);expect(fieldPlays).toBe(contacts);expect(halfChanges).toBeGreaterThanOrEqual(16);
  expect(()=>host.issuePitch(command)).toThrow('game already finished');
},120000);
it('does not derive SI or alter results from presentation names or league labels',()=>{
  const input=liveMatchFixture(88),renamed={...input,players:input.players.map(p=>({...p,name:'Different '+p.name})),
    teams:input.teams.map(t=>({...t,name:t.name+' NLB'})) as unknown as typeof input.teams};
  const one=createLiveBaseballMatchV1(input),two=createLiveBaseballMatchV1(renamed);
  for(let i=0;i<5;i++)expect(one.issuePitch(command)).toEqual(two.issuePitch(command));
});
it('rejects malformed physical rosters and mutating a frozen result',()=>{
  const input=liveMatchFixture();expect(()=>createLiveBaseballMatchV1({...input,players:[...input.players,input.players[0]]})).toThrow('unique physical players');
  expect(()=>createLiveBaseballMatchV1({...input,players:input.players.map((p,i)=>i? p:{...p,physical:{...LIVE_MATCH_AUTHORED_SI_DEFAULTS_V1,throwSpeedMps:NaN}})})).toThrow('must be finite');
  const result=createLiveBaseballMatchV1(input).issuePitch(command);
  expect(()=>{(result.match.score as {away:number}).away=999;}).toThrow();
});
