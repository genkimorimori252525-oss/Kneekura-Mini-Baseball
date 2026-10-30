import { describe,it,expect } from 'vitest';
import { contactAngleDegV240, evaluateContactAngleRuleV240 } from './MeasuredContactAngleRuleV240';
describe('contact angle rule',()=>{it('preserves the angle expression and half-open range',()=>{
 const v={x:2,y:3,z:-4}, angle=Math.atan2(v.y,Math.hypot(v.x,v.z))*180/Math.PI;
 expect(Object.is(contactAngleDegV240(v),angle)).toBe(true);
 expect(evaluateContactAngleRuleV240([10,20,30],{lowerAngleDeg:10,upperAngleDeg:30,minimumFraction:2/3})).toEqual({count:2,fraction:2/3,matched:true});
});});
