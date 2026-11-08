import {expect,it,vi} from 'vitest';
import {DeterministicRng} from '../../rng/DeterministicRng';
import {createLiveFieldCoordinationV1} from './LiveFieldCoordinationV1';

const create=()=>createLiveFieldCoordinationV1({clock:{originTick:0,ticksPerSecond:1000},maximumMessages:3});
const message=(revision=1)=>({messageId:'cover',revision,sourceId:'p',recipientId:'ss',issuedAtElapsedSeconds:0,
 expiresAtElapsedSeconds:2,propagationDelaySeconds:.1,payload:{kind:'intent' as const,intent:{kind:'base_cover' as const,base:1 as const},estimatedArrivalSeconds:.7}});

it('delivers declared intent only to its recipient after the exact finite delay and before expiry',()=>{
 const q=create(),input=message(),before=JSON.stringify(input);q.issue(input);
 expect(q.receive({observerId:'ss',elapsedSeconds:.099})).toEqual([]);expect(q.receive({observerId:'rf',elapsedSeconds:.2})).toEqual([]);
 const received=q.receive({observerId:'ss',elapsedSeconds:.1});expect(received).toHaveLength(1);
 expect(received[0].received.event.content.payload.intent).toEqual({kind:'base_cover',base:1});
 expect(received[0].received.receivedAt).toBe(100);expect(Object.isFrozen(received[0])).toBe(true);
 expect(q.receive({observerId:'ss',elapsedSeconds:2})).toEqual([]);expect(JSON.stringify(input)).toBe(before);
});
it('does not let a future revision or withdrawal erase the older information before delivery',()=>{
 const q=create();q.issue(message());q.issue({...message(2),issuedAtElapsedSeconds:.2,propagationDelaySeconds:.3,payload:{kind:'withdraw'}});
 expect(q.receive({observerId:'ss',elapsedSeconds:.3})[0].received.event.content.revision).toBe(1);
 const latest=q.receive({observerId:'ss',elapsedSeconds:.5});expect(latest).toHaveLength(1);
 expect(latest[0].received.event.content.payload.kind).toBe('withdraw');
 expect(q.receive({observerId:'ss',elapsedSeconds:.3})[0].received.event.content.revision).toBe(1);
});
it('keeps message storage bounded and does not expose any unseen message through diagnostics',()=>{
 const q=create();for(let i=0;i<6;i++)q.issue({...message(),messageId:'m'+i});
 const s=q.inspect();expect(s.entries).toBe(3);expect(s.evictions).toBe(3);expect('messages'in s).toBe(false);
 expect(q.receive({observerId:'ss',elapsedSeconds:.1})).toHaveLength(3);
});
it('copies only allowed inert intent data and never publishes caller world or callbacks',()=>{
 const q=create(),raw={...message(),world:()=>{throw Error('world');}};let invoked=false;
 Object.defineProperty(raw.payload,'futureMotion',{enumerable:true,get(){invoked=true;throw Error('future');}});
 q.issue(raw);expect(invoked).toBe(false);const received=q.receive({observerId:'ss',elapsedSeconds:.2});
 expect(JSON.stringify(received)).not.toMatch(/world|futureMotion/);
 raw.payload.estimatedArrivalSeconds=99;expect(received[0].received.event.content.payload.estimatedArrivalSeconds).toBe(.7);
});
it('rejects stale revisions and invalid timing/payload instead of manufacturing a successful receipt',()=>{
 const q=create();q.issue(message(2));expect(()=>q.issue(message(1))).toThrow();
 for(const patch of [{expiresAtElapsedSeconds:0},{propagationDelaySeconds:-1},{revision:0},{sourceId:''}])
  expect(()=>create().issue({...message(),...patch})).toThrow();
 expect(()=>create().issue({...message(),payload:{kind:'intent',intent:{kind:'base_cover',base:9}}} as never)).toThrow();
 expect(()=>createLiveFieldCoordinationV1({clock:{originTick:0,ticksPerSecond:1},maximumMessages:10000})).toThrow();
});
it('has deterministic deliveries in independent scopes and no global actor or decision state',()=>{
 const a=create(),b=create();a.issue(message());b.issue(message());
 expect(a.receive({observerId:'ss',elapsedSeconds:.2})).toEqual(b.receive({observerId:'ss',elapsedSeconds:.2}));
 a.issue({...message(2),issuedAtElapsedSeconds:.3});expect(b.inspect().entries).toBe(1);
});
it('never resurrects a superseded intent after the delivered withdrawal expires',()=>{
 const q=create();q.issue(message());q.issue({...message(2),issuedAtElapsedSeconds:.2,expiresAtElapsedSeconds:.6,payload:{kind:'withdraw'}});
 expect(q.receive({observerId:'ss',elapsedSeconds:.4})[0].received.event.content.payload.kind).toBe('withdraw');
 expect(q.receive({observerId:'ss',elapsedSeconds:.7})).toEqual([]);
});
it('does not consume a random draw for a deterministic delivery',()=>{
 const draw=vi.spyOn(DeterministicRng.prototype,'nextFloat');try{create().issue(message());expect(draw).not.toHaveBeenCalled();}finally{draw.mockRestore();}
});
