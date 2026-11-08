// Presentation-only foul territory. Distances remain authored values in the design.
export function cubicPoint(a,b,c,d,t){const s=1-t;return{x:s*s*s*a.x+3*s*s*t*b.x+3*s*t*t*c.x+t*t*t*d.x,z:s*s*s*a.z+3*s*s*t*b.z+3*s*t*t*c.z+t*t*t*d.z};}
function controls(back,side,pole,t){const k=Math.min(side*.45,back*.8);return t<=.5?[[{x:0,z:-back},{x:side*.55,z:-back},{x:side-k,z:-k},{x:side,z:0}],t*2]:[[{x:side,z:0},{x:side+24,z:24},{x:pole.x+side*.7,z:pole.z-10},pole],(t-.5)*2];}
export function niikuraFoulPoint(back,side,pole,t){const [p,s]=controls(back,side,pole,t);return cubicPoint(...p,s);}
export function niikuraFoulNodes(d){const back=d.foul.backstopMeters,points=[];
 for(const sign of [-1,1]){const pole=d.fencePoints.find(p=>p.id===(sign<0?'LF':'RF')),a=Math.abs(pole.angleDegrees)*Math.PI/180,end={x:Math.sin(a)*pole.distanceMeters,z:Math.cos(a)*pole.distanceMeters},side=sign<0?d.foul.thirdSideMeters:d.foul.firstSideMeters;
  // Include exact BACK/SIDE anchors. The fair pole is supplied by fencePoints.
  for(let i=0;i<64;i++){const p=niikuraFoulPoint(back,side,end,i/64),angleDegrees=i===0?sign*180:Math.atan2(sign*p.x,p.z)*180/Math.PI;points.push({id:i===0?'BACK':i===32?(sign<0?'THIRD_SIDE':'FIRST_SIDE'):'NIIKURA_FOUL_'+sign+'_'+i,angleDegrees,distanceMeters:Math.hypot(p.x,p.z),heightMeters:d.foul.heightMeters});}
 }return points;
}
export function niikuraFoulSeatPoint(g,u,sideSign){
 const back=g.vertices.find(p=>p.id==='BACK').distanceMeters,side=g.vertices.find(p=>p.id===(sideSign<0?'THIRD_SIDE':'FIRST_SIDE')).distanceMeters,pole=g.fencePoints.find(p=>p.id===(sideSign<0?'LF':'RF')),
 t=u<=1/12?u*6:.5+(u-1/12)*3.6,[control,s]=controls(back,side,{x:Math.abs(pole.x),z:pole.z},t),p=cubicPoint(...control,s),[a,b,c,d]=control,dx=3*(1-s)**2*(b.x-a.x)+6*(1-s)*s*(c.x-b.x)+3*s*s*(d.x-c.x),dz=3*(1-s)**2*(b.z-a.z)+6*(1-s)*s*(c.z-b.z)+3*s*s*(d.z-c.z),n=Math.hypot(dx,dz);
 return{x:sideSign*(p.x+dz/n*.5),z:p.z-dx/n*.5};
}
