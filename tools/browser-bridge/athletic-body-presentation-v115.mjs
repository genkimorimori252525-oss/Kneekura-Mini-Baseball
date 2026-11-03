import assert from 'node:assert/strict';

/** Explicit reversible seams for the frozen V105+ ordinary PNG renderer.
 * Caller also installs athletic-body-presentation-v115.js in the gaze/runtime
 * script. Core, portraits, camera, PNG data, palette and lattice remain intact. */
export function athleticPresentationChangesV115(){
 return [
  {label:'Source athletic actor metadata',
   before:'   ...(actor.bodyPoseV105?{bodyPoseV105:actor.bodyPoseV105}:{}),',
   after:'   ...(actor.bodyPoseV105?{bodyPoseV105:actor.bodyPoseV105}:{}),\n   ...(actor.athleticV115?{athleticV115:actor.athleticV115}:{}),'},
  {label:'optional athletic PNG mapping',
   before:'function spriteAtGrid(sprite,unit,left,top,visit,rowMapV105=null){',
   after:'function spriteAtGrid(sprite,unit,left,top,visit,rowMapV105=null,pixelMapV115=null){'},
  {label:'bounds from the Source PNG transform',
   before:' const mappedRowV105=y=>rowMapV105?rowMapV105.map(y):y,topRowV105=mappedRowV105(sprite.minY),bottomRowV105=mappedRowV105(sprite.maxY+1),bounds={x:left+sprite.minX*unit,y:top+topRowV105*unit,w:(sprite.maxX-sprite.minX+1)*unit,h:(bottomRowV105-topRowV105)*unit};',
   after:' const mappedRowV105=y=>rowMapV105?rowMapV105.map(y):y,topRowV105=mappedRowV105(sprite.minY),bottomRowV105=mappedRowV105(sprite.maxY+1),localBoundsV115=pixelMapV115?.bounds(sprite),bounds=localBoundsV115?{x:left+localBoundsV115.x*unit,y:top+localBoundsV115.y*unit,w:localBoundsV115.w*unit,h:localBoundsV115.h*unit}:{x:left+sprite.minX*unit,y:top+topRowV105*unit,w:(sprite.maxX-sprite.minX+1)*unit,h:(bottomRowV105-topRowV105)*unit};'},
  {label:'inverse sampling on the unchanged lattice',
   before:' const get=(x,y)=>{const i=Math.floor(x),j=Math.floor(rowMapV105?rowMapV105.unmap(y):y);return i>=0&&i<sprite.size&&j>=0&&j<sprite.size?sprite.pixels[j*sprite.size+i]:0};',
   after:' const get=(x,y)=>{const sourceV115=pixelMapV115?.unmap(x,y),i=Math.floor(sourceV115?sourceV115.x:x),j=Math.floor(sourceV115?sourceV115.y:rowMapV105?rowMapV105.unmap(y):y);return i>=0&&i<sprite.size&&j>=0&&j<sprite.size?sprite.pixels[j*sprite.size+i]:0};'},
  {label:'Source pose projected onto original PNG',
   before:'   bounds=spriteAtGrid(sprite,unit,left,top,(u,v,index,coverage)=>paintWorldCell(u,v,foot.depth-.001,palette[index],coverage,a.id),crouchRowsV105);',
   after:'   const athleticPixelsV115=window.KneekuraAthleticBodyPresentationV115?.pixelMap({sprite,unit,foot,head:a.bodyPoseV105?project(a.bodyPoseV105.head):null,athletic:a.athleticV115,retroScale:RETRO_SCALE});\n   athleticPresentationV115=athleticPixelsV115?.kind??\'SOURCE_DEGENERATE_OR_CLIPPED_CROUCH_FALLBACK_V115\';\n   bounds=spriteAtGrid(sprite,unit,left,top,(u,v,index,coverage)=>paintWorldCell(u,v,foot.depth-.001,palette[index],coverage,a.id),athleticPixelsV115?null:crouchRowsV105,athleticPixelsV115);'},
  {label:'read-only Source action diagnostic',
   before:'  labelPositions.push({id:a.id,role:a.role,...(a.bodyPoseV105?{bodyPoseV105:a.bodyPoseV105,crouchPresentationV105:\'PNG_UPPER_TRANSLATION_LOWER_FOLD_PROXY\'}:{}),animationAction,',
   after:'  labelPositions.push({id:a.id,role:a.role,...(a.bodyPoseV105?{bodyPoseV105:a.bodyPoseV105,crouchPresentationV105:\'PNG_UPPER_TRANSLATION_LOWER_FOLD_PROXY\'}:{}),...(a.athleticV115?{athleticV115:a.athleticV115,athleticPresentationV115}:{}),animationAction,'},
  {label:'local diagnostic of the actual raster path',
   before:'  const palette=spritePalette(a.player.team);let bounds,diameter,p,animationAction=null,animationFrame=null;',
   after:'  const palette=spritePalette(a.player.team);let bounds,diameter,p,animationAction=null,animationFrame=null,athleticPresentationV115=null;'},
 ];
}
export function replaceAthleticSeamV115(text,before,after){
 const at=text.indexOf(before);assert(at>=0,'V115 missing athletic presentation seam: '+before.slice(0,90));
 assert.equal(text.indexOf(before,at+before.length),-1,'V115 ambiguous athletic presentation seam');
 return text.slice(0,at)+after+text.slice(at+before.length);
}
export function applyAthleticPresentationV115(html){
 for(const change of athleticPresentationChangesV115())html=replaceAthleticSeamV115(html,change.before,change.after);
 return html;
}
