// Photo-derived visual contour; immutable diamond and authored anchor distances stay separate.
const cubic=(a,b,c,d,t)=>{const s=1-t;return{x:s**3*a.x+3*s*s*t*b.x+3*s*t*t*c.x+t**3*d.x,z:s**3*a.z+3*s*s*t*b.z+3*s*t*t*c.z+t**3*d.z};};
function controls(back,side,pole){const k=Math.min(back*.55,side*.35),slope=(pole.x-side)/pole.z;return[{x:0,z:-back},{x:side*.55228475,z:-back},{x:side-k*slope,z:-k},{x:side,z:0}];}
function cubicTangent([a,b,c,d],t){const s=1-t;return{x:3*s*s*(b.x-a.x)+6*s*t*(c.x-b.x)+3*t*t*(d.x-c.x),z:3*s*s*(b.z-a.z)+6*s*t*(c.z-b.z)+3*t*t*(d.z-c.z)};}
function backCurve(back,side,pole,t,style){
 if(style!=='koshien'){const c=controls(back,side,pole);return{p:cubic(...c,t),d:cubicTangent(c,t)};}
 // Keep Koshien's existing ellipse except the short tangent transition at each SIDE.
 const ellipse=s=>({x:side*Math.sin(s*Math.PI/2),z:-back*Math.cos(s*Math.PI/2)}),tangent=s=>({x:side*Math.cos(s*Math.PI/2)*Math.PI/2,z:back*Math.sin(s*Math.PI/2)*Math.PI/2});
 if(t<=.75)return{p:ellipse(t),d:tangent(t)};
 const a=ellipse(.75),b={x:side,z:0},da=tangent(.75),dz=back*Math.PI/2,slope=(pole.x-side)/pole.z,c=[a,{x:a.x+da.x/12,z:a.z+da.z/12},{x:b.x-slope*dz/12,z:-dz/12},b],s=(t-.75)*4;
 return{p:cubic(...c,s),d:cubicTangent(c,s)};
}
const defaults={dodger_stadium:{back:23,first:24,third:24,pole:330*.3048/Math.SQRT2},koshien:{back:18.4,first:28,third:28,pole:95/Math.SQRT2}};
function parameters(g,style,sign){const d=defaults[style],back=g?.vertices.find(p=>p.id==='BACK')?.distanceMeters??d.back,side=g?.vertices.find(p=>p.id===(sign<0?'THIRD_SIDE':'FIRST_SIDE'))?.distanceMeters??(sign<0?d.third:d.first),p=g?.fencePoints.find(p=>p.id===(sign<0?'LF':'RF'));return{back,side,pole:p?{x:Math.abs(p.x),z:p.z}:{x:d.pole,z:d.pole}};}
export function realParkFoulNodes(foul,fencePoints,style='dodger_stadium'){const nodes=[];
 for(const sign of [-1,1]){const p=fencePoints.find(p=>p.id===(sign<0?'LF':'RF')),r=Math.abs(p.angleDegrees)*Math.PI/180,pole={x:Math.sin(r)*p.distanceMeters,z:Math.cos(r)*p.distanceMeters},side=sign<0?foul.thirdSideMeters:foul.firstSideMeters;
  for(let i=0;i<=32;i++){const q=backCurve(foul.backstopMeters,side,pole,i/32,style).p;nodes.push({id:i===0?'BACK':i===32?(sign<0?'THIRD_SIDE':'FIRST_SIDE'):'REAL_PARK_FOUL_'+sign+'_'+i,angleDegrees:i===0?sign*180:i===32?sign*90:Math.atan2(sign*q.x,q.z)*180/Math.PI,distanceMeters:Math.hypot(q.x,q.z),heightMeters:foul.heightMeters});}
 }return nodes;
}
function backSeat(p,t,clearance,sign,style){const c=backCurve(p.back,p.side,p.pole,t,style),q=c.p,{x:dx,z:dz}=c.d,n=Math.hypot(dx,dz);return{x:sign*(q.x+clearance*dz/n),z:q.z-clearance*dx/n};}
export function realParkSeatRim(g,style,u,legacy){
 const k=style==='koshien',v=k?Math.min(u,1-u):Math.abs(u-.5),sign=k?(u<=.5?-1:1):(u>=.5?1:-1),sideU=k?2/14:.18,start=k?3/14:.32,end=k?4/14:.46,clearance=k?1.2:.3,nearZ=k?35:25,toLegacy=t=>k?(sign<0?t:1-t):.5+sign*t;
 if(v>=end)return legacy(u);const p=parameters(g,style,sign);
 if(v<=sideU)return backSeat(p,v/sideU,clearance,sign,style);
 const slope=(p.pole.x-p.side)/p.pole.z,n=Math.hypot(1,slope),line=z=>({x:sign*(p.side+slope*z+clearance/n),z:z-clearance*slope/n});
 if(v<=start)return line(nearZ*(v-sideU)/(start-sideU));
 const a=line(nearZ),b=legacy(toLegacy(end)),next=legacy(toLegacy(end+1e-5)),span=end-start,dz=nearZ/(start-sideU),c1={x:a.x+sign*slope*dz*span/3,z:a.z+dz*span/3},c2={x:b.x-(next.x-b.x)/1e-5*span/3,z:b.z-(next.z-b.z)/1e-5*span/3};return cubic(a,c1,c2,b,(v-start)/span);
}
