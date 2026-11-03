import {PAYPAY,paypayOuter} from './paypay-layout.mjs';
// Widths are source display arc lengths. All bays share one top datum and one mounting ring.
export function paypayDisplayLayout(){const radius=94,topY=38.4,widths=[33.6,33.28,58.88,33.28,33.6],heights=[5.76,9.6,15.36,9.6,5.76],total=widths.reduce((a,b)=>a+b,0);let angle=-total/(2*radius);
 const boards=widths.map((width,index)=>{const start=angle,end=start+width/radius,theta=(start+end)/2;
  angle=end;const height=heights[index],center=paypayOuter(theta,topY-height,radius);return{index,role:index===2?'scoreboard':'monitor',width,height,baseY:topY-height,topY,start,end,theta,x:center.x,z:center.z};});
 return{radius,topY,totalWidth:total,start:boards[0].start,end:boards.at(-1).end,boards};
}
export function paypayDisplayPoint(layout,board,u,y,offset=0){return paypayOuter(board.start+(board.end-board.start)*u,y,layout.radius+offset);}
/** Reserve the rear suite area under the actual display bays, using the same world coordinates. */
export function paypaySuiteClearance(p,layout=paypayDisplayLayout()){
 const theta=Math.atan2(p.x,p.z-PAYPAY.centerZ);let cap=35;
 for(const b of layout.boards){const distance=Math.max(b.start-.07-theta,theta-b.end-.07,0),t=Math.min(1,distance/.07),blend=t*t*(3-2*t);cap=Math.min(cap,b.baseY-.7+(35-b.baseY+.7)*blend);}
 return cap;
}
/** Vision bays replace the top of the upper stand; neighboring sections blend into them. */
export function paypaySeatElevation(p,y,layout){
 if(y<17.1||y>29.3)return y;
 const cap=Math.min(29.2,paypaySuiteClearance(p,layout));
 return 17.1+(y-17.1)*(cap-17.1)/(29.2-17.1);
}
