import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {simulateLiveFieldPlayV1,type LiveFieldPlayInputV1} from './LiveFieldPlayV1';

const fixture=()=>JSON.parse(readFileSync(new URL('./__fixtures__/contact-51-v119.json',import.meta.url),'utf8')) as LiveFieldPlayInputV1;
describe('V119 observed short feed and shared base continuation',()=>{
 it('completes the original pitch-51 field input without bypassing actual contact or rule events',()=>{
  const input=fixture(),before=JSON.stringify(input),r=simulateLiveFieldPlayV1(input);
  expect(r.end.complete,JSON.stringify(r.diagnostics.unresolvedDetail)).toBe(true);
  expect(r.end.reason).not.toBe('numerical_contact_refinement_required');
  expect(JSON.stringify(input)).toBe(before);
  expect(r.diagnostics.renderFramesOwnPhysics).toBe(false);
  for(const fact of r.facts.filter(f=>f.kind==='throw_release'))expect(Number.isSafeInteger(fact.tick)).toBe(true);
 },60000);
});
