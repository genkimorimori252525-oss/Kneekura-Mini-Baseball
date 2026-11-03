/* Read-only affine PNG proxy from the current Source foot/head projection.
 * Does not integrate actions, change palettes, paint pixels or move the camera.
 * Degenerate/clipped projections retain the existing crouch raster path. */
(function(root){
 'use strict';
 const point=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 function pixelMap({sprite,unit,foot,head,athletic,retroScale=.90}){
  const referenceHeight=sprite?.referenceHeight||44;
  if(!athletic||!['jump','dive','feet_slide','head_slide'].includes(athletic.kind)||!point(foot)||!point(head)
   ||!sprite||![unit,retroScale,sprite.originX,sprite.baseline,referenceHeight].every(Number.isFinite)
   ||unit<=0||retroScale<=0||referenceHeight<=0)return null;
  const dx=head.x-foot.x,dy=head.y-foot.y,length=Math.hypot(dx,dy);
  // A body viewed exactly along its axis has no invertible screen-height.
  // Fall back rather than inventing a facing direction or an infinite inverse.
  if(length<1e-8)return null;
  const xx=-dy/length,yx=dx/length,xy=-dx*retroScale/(unit*referenceHeight),
   yy=-dy*retroScale/(unit*referenceHeight),det=xx*yy-xy*yx;
  if(![xx,yx,xy,yy,det].every(Number.isFinite)||Math.abs(det)<1e-12)return null;
  const ox=sprite.originX,oy=sprite.baseline,
   map=(x,y)=>({x:ox+xx*(x-ox)+xy*(y-oy),y:oy+yx*(x-ox)+yy*(y-oy)}),
   unmap=(x,y)=>({x:ox+(yy*(x-ox)-xy*(y-oy))/det,y:oy+(-yx*(x-ox)+xx*(y-oy))/det}),
   bounds=s=>{const p=[map(s.minX,s.minY),map(s.maxX+1,s.minY),map(s.minX,s.maxY+1),map(s.maxX+1,s.maxY+1)],
    x=Math.min(...p.map(a=>a.x)),y=Math.min(...p.map(a=>a.y));
    return{x,y,w:Math.max(...p.map(a=>a.x))-x,h:Math.max(...p.map(a=>a.y))-y};};
  return Object.freeze({kind:'SOURCE_FOOT_HEAD_PNG_AFFINE_PROXY_V115',map,unmap,bounds});
 }
 root.KneekuraAthleticBodyPresentationV115=Object.freeze({pixelMap});
})(typeof globalThis==='object'?globalThis:this);
