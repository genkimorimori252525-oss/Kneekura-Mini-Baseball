/** Presentation heuristics: continuous screen-footprint LOD, adjustable after visual evidence. */
export function projectedMaterialDetail(points,maximum=6,step=10/3){
 const p=points.filter(Boolean),edge=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 if(p.length<3)return null;
 const width=p.length===4?(edge(p[0],p[1])+edge(p[3],p[2]))/2:Math.max(...p.map(q=>q.x))-Math.min(...p.map(q=>q.x)),
  height=p.length===4?(edge(p[0],p[3])+edge(p[1],p[2]))/2:Math.max(...p.map(q=>q.y))-Math.min(...p.map(q=>q.y)),
  depth=p.reduce((n,q)=>n+q.depth,0)/p.length,t=Math.max(0,Math.min(1,Math.min(width,height)/80)),
  distanceT=Math.max(0,Math.min(1,(depth-70)/350)),distanceBlend=distanceT*distanceT*(3-2*distanceT),
  quality=t*t*(3-2*t),density=Math.max(1.6,Math.min(maximum,1+(maximum-1)*(.6+.4*quality))),blurScale=1+.15*distanceBlend;
 return {widthPixels:width,heightPixels:height,depth,maximum,density,
  brightness:1.45,glow:.08,contrast:1,
  footprintU:blurScale*step/density/Math.max(.01,width)/.88,footprintV:blurScale*step/density/Math.max(.01,height)/.88,
  sampling:'premultiplied_mipmap_trilinear',policy:'mild_distance_softening_without_fade'};
}
