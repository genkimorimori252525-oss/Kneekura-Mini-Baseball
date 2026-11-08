/** Density changes only the renderer's sampling lattice, never SI geometry. */
const once=(source,a,b)=>{if(source.split(a).length!==2)throw Error('V84 quality marker differs: '+a.slice(0,100));return source.replace(a,()=>b);};
const lattice=source=>source
 .replace(/Math\.(round|floor|ceil)\(([^;\n]*?)\/4\)\*4/g,(_,mode,value)=>`gridV84.${mode==='round'?'snap':mode}(${value})`)
 .replaceAll('Math.max(4,','Math.max(gridV84.step(),')
 .replaceAll('596','(600-gridV84.step())').replaceAll('428','(432-gridV84.step())')
 .replace(/\b(u|v|x|y|pr\.x|pr\.y|p\.x|p\.y)(>=|<=|>|<)4\b/g,'$1$2gridV84.step()')
 .replaceAll('u%4!==0','!gridV84.aligned(u)').replaceAll('v%4!==0','!gridV84.aligned(v)')
 .replaceAll('x%4===0','gridV84.aligned(x)').replaceAll('y%4===0','gridV84.aligned(y)')
 .replace(/for\(let ([xy])=([^;\n]+);\1<=([^;\n]+);\1\+=4\)/g,(_,name,from,to)=>`for(const ${name} of gridV84.range(${from==='4'?'gridV84.step()':from},${to}))`);
export function applyPresentationRenderControlsV84(html){
 if(typeof html!=='string'||html.includes('V84_DENSITY_LATTICE'))throw Error('V84 quality requires one unmodified renderer');
 const start=html.indexOf('function makeBroadcastRenderer(canvas,labelHost){'),end=html.indexOf("\n'use strict';\nconst freeze=o=>",start);
 if(start<0||end<0)throw Error('V84 quality renderer boundary unavailable');
 const original=html.slice(start,end);let r=lattice(original);
 r=once(r," const ctx=canvas.getContext('2d'),BallSurface=window.KneekuraBallSurface,Symbols=window.KneekuraPitchSymbols;",` // V84_DENSITY_LATTICE: all depth keys use integer lattice indices.
 const gridV84=window.KneekuraPresentationControlsV84.grid,qualityV84=()=>window.KneekuraPresentationControlsV84.qualityScale;
 const ctx=canvas.getContext('2d'),BallSurface=window.KneekuraBallSurface,Symbols=window.KneekuraPitchSymbols;`);
 r=once(r,"rasterKeyV81=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)?x*512+y:x+','+y;",'rasterKeyV81=(x,y)=>gridV84.key(x,y);');
 r=once(r,'canvas.width,canvas.height,ctx.globalCompositeOperation','qualityV84(),canvas.width,canvas.height,ctx.globalCompositeOperation');
 r=once(r,'ctx.arc(x,y,r,0,Math.PI*2)','ctx.arc(x,y,r/qualityV84(),0,Math.PI*2)');
 r=r.replaceAll('spacing=4','spacing=gridV84.step()');
 r=r.replaceAll('C.wall,1.2,.95,4,1','C.wall,1.2,.95,gridV84.step(),1').replaceAll("j%3===0?.58:.42,4)","j%3===0?.58:.42,gridV84.step())").replaceAll("'#82887d',.75,.5,4)","'#82887d',.75,.5,gridV84.step())");
 r=r.replaceAll('p.x-4],[dx,','p.x-gridV84.step()],[dx,').replaceAll('p.y-4],[dy,','p.y-gridV84.step()],[dy,');
 r=r.replaceAll('diameterPx<4','diameterPx<gridV84.step()').replaceAll('bounds.h<4','bounds.h<gridV84.step()')
  .replaceAll('(diameterPx/2)**2/16','(diameterPx/2)**2/(gridV84.step()**2)').replaceAll('w:x1-x0+4,h:y1-y0+4','w:x1-x0+gridV84.step(),h:y1-y0+gridV84.step()');
 r=r.replaceAll('sphereHit(x+dx,y+dy,','sphereHit(x+dx/qualityV84(),y+dy/qualityV84(),');
 r=r.replaceAll('cell.x-2,cell.y-2,4,4','cell.x-gridV84.step()/2,cell.y-gridV84.step()/2,gridV84.step(),gridV84.step()')
  .replaceAll('c.x-2,c.y-2,4,4','c.x-gridV84.step()/2,c.y-gridV84.step()/2,gridV84.step(),gridV84.step()');
 r=once(r,'n=Math.ceil(d/4)','n=Math.ceil(d/gridV84.step())');
 r=once(r,'Math.ceil(displayBatRadius(t)*pr.scale/4)','Math.ceil(displayBatRadius(t)*pr.scale/gridV84.step())');
 r=once(r,'const x=cx+ox*4,y=cy+oy*4;','const x=gridV84.coordinate(gridV84.index(cx)+ox),y=gridV84.coordinate(gridV84.index(cy)+oy);');
 r=once(r,'Math.hypot(ox*4,oy*4)','Math.hypot(ox*gridV84.step(),oy*gridV84.step())');
 r=once(r,'if(displayD<4)','if(displayD<gridV84.step())');
 r=once(r,'radius:LIGHT_RADIUS,color:surface.sample(normal).color','radius:LIGHT_RADIUS/qualityV84(),color:surface.sample(normal).color');
 html=html.slice(0,start)+r+html.slice(end);
 // PNG data, sprite geometry and palette remain byte-identical. Only their
 // screen sampling visits the same canonical lattice as the world/depth maps.
 const spriteStart=html.indexOf('function spriteAtGrid('),spriteEnd=html.indexOf('\nfunction makeBroadcastRenderer',spriteStart),sprite=html.slice(spriteStart,spriteEnd);
 let spriteNext=lattice(sprite);
 spriteNext=once(spriteNext,'function spriteAtGrid(sprite,unit,left,top,visit){','function spriteAtGrid(sprite,unit,left,top,visit){\n const gridV84=window.KneekuraPresentationControlsV84.grid,q=window.KneekuraPresentationControlsV84.qualityScale;');
 spriteNext=spriteNext.replaceAll('(x+dx-left)/unit,(y+dy-top)/unit','(x+dx/q-left)/unit,(y+dy/q-top)/unit');
 html=once(html,sprite,spriteNext);
 const ballStart=html.indexOf(' const GRID=4,WHITE='),ballEnd=html.indexOf('})(typeof globalThis',ballStart),ball=html.slice(ballStart,ballEnd);
 let ballNext=ball.replace('const GRID=4,WHITE=','const WHITE=');
 ballNext=once(ballNext,' function rasterize({center,radius,orientation,project,ray,width,height}){',' function rasterize({center,radius,orientation,project,ray,width,height}){\n  const gridV84=root.KneekuraPresentationControlsV84.grid,GRID=gridV84.step(),qualityV84=root.KneekuraPresentationControlsV84.qualityScale;');
 ballNext=once(ballNext,'for(let y=y0;y<=y1;y+=GRID)for(let x=x0;x<=x1;x+=GRID)','for(const y of gridV84.range(y0,y1))for(const x of gridV84.range(x0,x1))');
 ballNext=once(ballNext,'ray(x+dx,y+dy)','ray(x+dx/qualityV84,y+dy/qualityV84)');
 ballNext=once(ballNext,'function material(orientation,diameterPx){','function material(orientation,diameterPx){\n  diameterPx*=root.KneekuraPresentationControlsV84.qualityScale;');
 ballNext=once(ballNext,'version:1,grid:GRID,white:','version:1,get grid(){return root.KneekuraPresentationControlsV84.grid.step();},white:');
 html=once(html,ball,ballNext);
 // Confirmed pitch marks are also snapped through the shared lattice.
 html=once(html,'const x=Math.round(p.x/4)*4,y=Math.round(p.y/4)*4,r=options.radius||16',"const x=root.KneekuraPresentationControlsV84.grid.snap(p.x),y=root.KneekuraPresentationControlsV84.grid.snap(p.y),r=options.radius||16");
 return html;
}
