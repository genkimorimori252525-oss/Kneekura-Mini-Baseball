// Photo-derived presentation outline. Fixed bases/lines are defined separately in model.mjs.
const rad=a=>a*Math.PI/180,smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function paypayPremiumInset(z,poleZ,side){const u=z/poleZ;
 return Math.min(9,side*.28)*smooth((u-.10)/.16)*(1-smooth((u-.48)/.52));
}
export function paypayTerraceWidth(theta){const a=Math.abs(theta)*180/Math.PI;return 4.5*smooth((a-6)/10)*smooth((45-a)/8);}
export function paypayFoulPoint(foul,pole,sign,t,premium=true){const side=sign<0?foul.thirdSideMeters:foul.firstSideMeters;
 if(t<=0){const u=t+1,s=1-u,k=Math.min(foul.backstopMeters*.55,side*.35),slope=(pole.x-side)/pole.z,
  a={x:0,z:-foul.backstopMeters},b={x:side*.62,z:-foul.backstopMeters},c={x:side-k*slope,z:-k},d={x:side,z:0};
  return{x:sign*(s**3*a.x+3*s*s*u*b.x+3*s*u*u*c.x+u**3*d.x),z:s**3*a.z+3*s*s*u*b.z+3*s*u*u*c.z+u**3*d.z};}
 const z=t*pole.z,x=side+(pole.x-side)*t-(premium?paypayPremiumInset(z,pole.z,side):0);return{x:sign*x,z};
}
export function paypayFoulNodes(foul,fencePoints,premium=true){const nodes=[];
 for(const sign of [-1,1]){const a=fencePoints.find(p=>p.id===(sign<0?'LF':'RF')),angle=Math.abs(rad(a.angleDegrees)),pole={x:Math.sin(angle)*a.distanceMeters,z:Math.cos(angle)*a.distanceMeters};
  for(let i=0;i<=64;i++){const t=i/32-1,p=paypayFoulPoint(foul,pole,sign,t,premium);nodes.push({id:i===0?'BACK':i===32?(sign<0?'THIRD_SIDE':'FIRST_SIDE'):'PAYPAY_FOUL_'+sign+'_'+i,angleDegrees:i===0?sign*180:i===32?sign*90:Math.atan2(p.x,p.z)*180/Math.PI,distanceMeters:Math.hypot(p.x,p.z),heightMeters:foul.heightMeters});}
 }return nodes.filter(p=>Math.abs(p.angleDegrees)>45+.00001);
}
export function paypayFoulParameters(g){return{foul:{firstSideMeters:g.vertices.find(p=>p.id==='FIRST_SIDE').distanceMeters,thirdSideMeters:g.vertices.find(p=>p.id==='THIRD_SIDE').distanceMeters,backstopMeters:g.vertices.find(p=>p.id==='BACK').distanceMeters,heightMeters:g.vertices.find(p=>p.id==='BACK').heightMeters},pole:sign=>{const p=g.fencePoints.find(p=>p.id===(sign<0?'LF':'RF'));return{x:Math.abs(p.x),z:p.z};}};}
