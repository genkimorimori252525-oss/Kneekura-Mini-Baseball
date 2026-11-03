import {wallAt} from './model.mjs';
import {paypayFoulNodes,paypayFoulParameters,paypayFoulPoint,paypayPremiumInset,paypayTerraceWidth} from './paypay-field.mjs';
export const PAYPAY=Object.freeze({centerZ:46,outerRadius:111,roofRadius:106,eaveY:38,apexY:68,rotationRadians:2*Math.PI/3});
const TAU=2*Math.PI;
const fieldCache=new WeakMap();
function fieldLayout(g){let value=fieldCache.get(g);if(!value){const parameters=paypayFoulParameters(g),nodes=paypayFoulNodes(parameters.foul,g.fencePoints,false),vertices=[...nodes.map(p=>({...p,x:Math.sin(p.angleDegrees*Math.PI/180)*p.distanceMeters,z:Math.cos(p.angleDegrees*Math.PI/180)*p.distanceMeters})),...g.fencePoints].sort((a,b)=>a.angleDegrees-b.angleDegrees);value={...parameters,bowl:{...g,vertices}};fieldCache.set(g,value);}return value;}
export function paypayOuter(t,y=0,r=PAYPAY.outerRadius){return{x:r*Math.sin(t),y,z:PAYPAY.centerZ+r*Math.cos(t)};}
export function paypayBowlPoint(g,t,offset,y){
 const w=wallAt(fieldLayout(g).bowl,t),p=w.position,n=Math.hypot(p.x,p.z-PAYPAY.centerZ),nx=p.x/n,nz=(p.z-PAYPAY.centerZ)/n,d=offset+paypayTerraceWidth(t);
 return{x:p.x+nx*d,y,z:p.z+nz*d};
}
export function paypaySeatPoint(g,t,v,y){
 const w=wallAt(g,t),inner=paypayBowlPoint(g,t,2,y),dx=Math.sin(t),dz=Math.cos(t),cz=PAYPAY.centerZ,
  outerR=cz*dz+Math.sqrt((PAYPAY.outerRadius-8)**2-cz*cz*dx*dx);
 if(y>=2.1&&y<=15.2){const f=fieldLayout(g),b=wallAt(f.bowl,t),p=b.position,side=p.x<0?f.foul.thirdSideMeters:f.foul.firstSideMeters,pole=f.pole(p.x<0?-1:1),inset=Math.abs(t)>Math.PI/4&&p.z>0?paypayPremiumInset(p.z,pole.z,side):0,
  front=Math.max(2.4,b.heightMeters+.6+(paypayTerraceWidth(t)>0?1.5:0),2.4+3.4*Math.min(1,inset/7));y+=(front-2.4)*(15.2-y)/(15.2-2.4);}
 return{x:inner.x+(dx*outerR-inner.x)*v,y,z:inner.z+(dz*outerR-inner.z)*v};
}
export function paypayPremiumSection(g,sign,t){const f=fieldLayout(g),pole=f.pole(sign),sample=paypayFoulPoint(f.foul,pole,sign,t),w=wallAt(g,Math.atan2(sample.x,sample.z)),front=w.position,back=paypayFoulPoint(f.foul,pole,sign,t,false),width=Math.abs(back.x-front.x);return{front:{...front,y:w.heightMeters+.05},back:{...back,y:2.4+3.4*Math.min(1,width/7)},width};}
export function paypayTerraceSection(g,t){const w=wallAt(g,t),p=w.position,width=paypayTerraceWidth(t),n=Math.hypot(p.x,p.z-PAYPAY.centerZ);return{front:{...p,y:w.heightMeters+.04},back:{x:p.x+p.x/n*width,y:w.heightMeters+1.5,z:p.z+(p.z-PAYPAY.centerZ)/n*width},width};}
/** The two moving panels sit above the fixed one, so they can overlap without z-fighting. */
export function paypayRoofPoint(leaf,u,v,openingPercent,under=false){
 const shift=(leaf===0?1:leaf===2?-1:0)*PAYPAY.rotationRadians*openingPercent/100,
  theta=-Math.PI+leaf*TAU/3+(u*1.08-.04)*TAU/3+shift,r=v*PAYPAY.roofRadius,
  level=[1.4,0,2.8][leaf],y=PAYPAY.eaveY+(PAYPAY.apexY-PAYPAY.eaveY-2.8)*Math.cos(v*Math.PI/2)+level-(under?2.3:0);
 return{x:r*Math.sin(theta),y,z:PAYPAY.centerZ+r*Math.cos(theta)};
}
