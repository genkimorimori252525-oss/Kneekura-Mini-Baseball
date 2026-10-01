import type { CompiledPixelAsset, CompiledPixelFrame, PixelAction, PixelDirectionBucket, PixelHand, PixelPoint } from './PixelPlayerModel';
export type VisualFrameFacts=Readonly<{action:PixelAction;direction:PixelDirectionBucket;hand:PixelHand;phase:0|1|2|3;contact?:PixelPoint}>;
export type SpritePlacement=Readonly<{root:PixelPoint;scale:1|2}>;

// Distance to actual authored bat cells, not a generous bounding rectangle.
export function visualBatDistance(frame:CompiledPixelFrame,_width:number,placement:SpritePlacement,p:PixelPoint):number {
  if (!frame.bat) return Infinity;
  let best=Infinity;
  const originX=placement.root.x-frame.anchors.root.x*placement.scale;
  const originY=placement.root.y-frame.anchors.root.y*placement.scale;
  for(const {x,y} of frame.visibleBatCells) {
    const left=originX+x*placement.scale,top=originY+y*placement.scale;
    const dx=Math.max(left-p.x,0,p.x-(left+placement.scale));
    const dy=Math.max(top-p.y,0,p.y-(top+placement.scale));
    best=Math.min(best,Math.hypot(dx,dy));
  }
  return best;
}
export function selectPixelFrame(asset:CompiledPixelAsset,facts:VisualFrameFacts,placement:SpritePlacement):CompiledPixelFrame {
  const frames=asset.frames.filter(f=>f.action===facts.action&&f.direction===facts.direction&&f.hand===facts.hand);
  if(facts.contact) {
    const compatible=frames.filter(f=>f.bat&&(facts.action!=='batting'||f.phase===2))
      .map(f=>({f,distance:visualBatDistance(f,asset.width,placement,facts.contact!)}))
      .filter(entry=>entry.distance<=1).sort((a,b)=>a.distance-b.distance||(a.f.id<b.f.id?-1:1));
    if(!compatible.length) throw new Error('No contact-compatible pixel frame; revise source/mapping, never physics');
    return compatible[0].f;
  }
  const frame=frames.find(f=>(f.phase??0)===facts.phase);
  if(!frame) throw new Error(`Missing authored coverage: ${facts.action}/${facts.direction}/${facts.hand}/${facts.phase}`);
  return frame;
}
