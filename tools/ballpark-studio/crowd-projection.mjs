// Artistic world-space size of one shared 16x12 crowd patch, not a seating regulation.
export const CROWD_METRIC=Object.freeze({widthMeters:2.24,depthMeters:1.68});
export function crowdSurfaceUV(points){const length=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),w0=length(points[0],points[1])/CROWD_METRIC.widthMeters,w1=length(points[3],points[2])/CROWD_METRIC.widthMeters,h0=length(points[0],points[3])/CROWD_METRIC.depthMeters,h1=length(points[1],points[2])/CROWD_METRIC.depthMeters;
 return[{u:-w0/2,v:0},{u:w0/2,v:0},{u:w1/2,v:h1},{u:-w1/2,v:h0}];}
/** Differential of perspective-correct UV. A sample represents one raster cell. */
export function perspectiveUvFootprint(a,b,c,pixelStep){const area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),ux=(b.y-c.y)/area,vx=(c.y-a.y)/area,wx=-ux-vx,uy=(c.x-b.x)/area,vy=(a.x-c.x)/area,wy=-uy-vy,
 dx=ux/a.depth+vx/b.depth+wx/c.depth,dy=uy/a.depth+vy/b.depth+wy/c.depth,duX=ux*a.u/a.depth+vx*b.u/b.depth+wx*c.u/c.depth,duY=uy*a.u/a.depth+vy*b.u/b.depth+wy*c.u/c.depth,dvX=ux*a.v/a.depth+vx*b.v/b.depth+wx*c.v/c.depth,dvY=uy*a.v/a.depth+vy*b.v/b.depth+wy*c.v/c.depth;
 return(d,u,v)=>[Math.hypot(duX-u*dx,duY-u*dy)*d*pixelStep,Math.hypot(dvX-v*dx,dvY-v*dy)*d*pixelStep];}
