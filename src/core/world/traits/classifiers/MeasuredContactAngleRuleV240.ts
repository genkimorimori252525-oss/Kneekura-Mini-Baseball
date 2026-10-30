export type ContactAngleRuleV240 = Readonly<{lowerAngleDeg:number;upperAngleDeg:number;minimumFraction:number}>;
export function contactAngleDegV240(v:Readonly<{x:number;y:number;z:number}>):number {
  return Math.atan2(v.y,Math.hypot(v.x,v.z))*180/Math.PI;
}
export function evaluateContactAngleRuleV240(angles:readonly number[], rule:ContactAngleRuleV240):Readonly<{count:number;fraction:number;matched:boolean}> {
  const count=angles.filter(x=>x>=rule.lowerAngleDeg&&x<rule.upperAngleDeg).length;
  const fraction=count/angles.length;
  return {count,fraction,matched:fraction>=rule.minimumFraction};
}
