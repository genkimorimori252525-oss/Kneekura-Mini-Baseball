import {expect,it} from 'vitest';
import {ACTOR_CONTACT_SEARCH_BUDGET,firstContact} from './LiveFieldPlayV1';

it('ends the search for a ball lying still just off a still glove, as an ambiguity the play handles',()=>{
  let calls=0;
  // The gap never closes and never opens beyond the rounding, so no interval can be ruled out.
  const hit=firstContact(()=>{calls++;return 1e-9;},10,1e-6,0,8,0,1e-6,ACTOR_CONTACT_SEARCH_BUDGET);
  expect(hit).toMatchObject({ambiguous:true});
  expect(calls).toBeLessThan(50_000);
});

it('still finds a real contact to the tick',()=>{
  // 183 splits, the same with or without the bound. (With a rounding of 1e-6 at 1 m/s the old search split 35 million times
  // through the last microsecond before the contact, which is this same trap.)
  const hit=firstContact(t=>3-t,1,0,0,8,0,1e-6,ACTOR_CONTACT_SEARCH_BUDGET);
  expect(hit?.ambiguous).toBeUndefined();
  expect(hit!.t).toBeCloseTo(3,9);
});
