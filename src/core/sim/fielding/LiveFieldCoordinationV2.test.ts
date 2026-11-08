import {expect,it} from 'vitest';
import {createLiveFieldCoordinationV1} from './LiveFieldCoordinationV1';
import {createLiveFieldCoordinationV2} from './LiveFieldCoordinationV2';
import {resolveLiveFielderBodyModelV105} from './LiveFielderBodyGeometryV105';
const clock={originTick:0,ticksPerSecond:1000000},message=()=>({messageId:'one',revision:1,sourceId:'one',recipientId:'two',issuedAtElapsedSeconds:0,
 expiresAtElapsedSeconds:1,propagationDelaySeconds:.2,payload:{kind:'intent' as const,intent:{kind:'ball_handler' as const},point:{x:0,y:.5,z:2}}});
const command=()=>({schemaVersion:1 as const,actorId:'one',commandId:'one:dive',revision:1,clock,worldRevision:3,fromSeconds:0,throughSeconds:1,fromTick:0,throughTick:1000000,
 kind:'athletic' as const,bodyModel:resolveLiveFielderBodyModelV105(1.8,1.35),bodyRadiusMeters:.24,gloveRadiusMeters:.1,extraFootReachMeters:0,
 segments:[{fromSeconds:0,throughSeconds:1,controls:[{x:0,y:1,z:0},{x:0,y:1,z:1},{x:0,y:1,z:2},{x:0,y:1,z:3}] as const}]});
it('replays legacy v1 messages with identical timing and one bounded delivery queue',()=>{
 const a=createLiveFieldCoordinationV1({clock,maximumMessages:2}),b=createLiveFieldCoordinationV2({clock,maximumMessages:2});
 expect(b.issue(message())).toEqual(a.issue(message()));
 for(const elapsedSeconds of [.1,.2,.9,1])expect(b.receive({observerId:'two',elapsedSeconds})).toEqual(a.receive({observerId:'two',elapsedSeconds}));
 expect(b.inspect()).toEqual(a.inspect());
});
it('does not expose a commitment before its original reception time and expires it once',()=>{
 const q=createLiveFieldCoordinationV2({clock});q.issue({schemaVersion:2,message:message(),commitment:command()});
 expect(q.receiveWithCommitments({observerId:'two',elapsedSeconds:.1})).toEqual([]);
 expect(q.receiveWithCommitments({observerId:'two',elapsedSeconds:.2})[0].commitment?.commandId).toBe('one:dive');
 expect(q.receiveWithCommitments({observerId:'two',elapsedSeconds:1})).toEqual([]);
 expect(q.inspect().issued).toBe(1);
});
it('rejects unsupported envelope versions and mismatched source/clock before issuing',()=>{
 const q=createLiveFieldCoordinationV2({clock});
 expect(()=>q.issue({schemaVersion:3,message:message()} as never)).toThrow();
 expect(()=>q.issue({schemaVersion:2,message:message(),commitment:{...command(),actorId:'hidden'}})).toThrow();
 expect(q.inspect().issued).toBe(0);
});
it('retains the private original clock if construction options are later changed',()=>{
 const options={clock:{...clock}},q=createLiveFieldCoordinationV2(options);options.clock.originTick=100;
 expect(()=>q.issue({schemaVersion:2,message:message(),commitment:command()})).not.toThrow();
 expect(q.receive({observerId:'two',elapsedSeconds:.2})[0].received.event.issuedAt).toBe(0);
});
it('withdraws a delivered path without reviving an old version or retaining extra sidecar entries',()=>{
 const q=createLiveFieldCoordinationV2({clock,maximumMessages:2});q.issue({schemaVersion:2,message:message(),commitment:command()});
 q.issue({...message(),revision:2,issuedAtElapsedSeconds:.3,payload:{kind:'withdraw'}});
 expect(q.receiveWithCommitments({observerId:'two',elapsedSeconds:.5})[0].commitment).toBeUndefined();
 expect(q.inspect().entries).toBe(2);
});
