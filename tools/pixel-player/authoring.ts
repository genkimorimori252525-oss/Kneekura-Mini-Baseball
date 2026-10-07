import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { compilePixelPlayerAsset, validatePixelPlayerAsset, validateTargetedEdit, assertSafeMirror } from '../../src/presentation/mini/pixel-player/PixelPlayerAsset';
import type { PixelPlayerAsset } from '../../src/presentation/mini/pixel-player/PixelPlayerModel';

function crc32(data:Buffer):number {
 let c=0xffffffff;
 for(const byte of data){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}
 return (c^0xffffffff)>>>0;
}
function chunk(kind:string,data:Buffer):Buffer {
 const name=Buffer.from(kind),header=Buffer.alloc(4),crc=Buffer.alloc(4);
 header.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([name,data])));
 return Buffer.concat([header,name,data,crc]);
}
function png(width:number,height:number,rgba:Uint8Array):Buffer {
 const header=Buffer.alloc(13);header.writeUInt32BE(width,0);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const scan=Buffer.alloc(height*(width*4+1));
 for(let y=0;y<height;y++)scan.set(rgba.subarray(y*width*4,(y+1)*width*4),y*(width*4+1)+1);
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
function load(path:string):PixelPlayerAsset {
 const source=JSON.parse(readFileSync(path,'utf8'));validatePixelPlayerAsset(source);return source;
}
function save(path:string,source:unknown):void {validatePixelPlayerAsset(source);writeFileSync(path,JSON.stringify(source,null,2)+'\n');}
function escaped(value:string):string {return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');}
export function runPixelAuthoring(args:readonly string[], fontPath?:string):void {
 const [command,path,...rest]=args;
 if(!path)throw new Error('Usage: pixel-player validate|compile|new|edit|clone-part|compare source ...');
 const source=load(path);
 if(command==='validate'){console.log(`Valid: ${source.id}, ${source.frames.length} frames`);return;}
 if(command==='new'){const [out,id]=rest;if(!out||!id)throw new Error('new source output id');save(out,{...source,id});return;}
 if(command==='edit'){
  const [frameId,partName,xText,yText,symbol,out]=rest,x=Number(xText),y=Number(yText);
  if(!out||!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=source.canvas.width||y>=source.canvas.height||symbol.length!==1)throw new Error('Invalid edit arguments');
  const after=structuredClone(source),target=after.frames.find(f=>f.id===frameId)?.parts.find(p=>p.name===partName);
  if(!target)throw new Error('Unknown named part');
  const rows=[...target.rows];rows[y]=rows[y].slice(0,x)+symbol+rows[y].slice(x+1);
  const result={...after,frames:after.frames.map(f=>f.id!==frameId?f:{...f,parts:f.parts.map(p=>p.name!==partName?p:{...p,rows})})};
  validateTargetedEdit(source,result,frameId,partName);save(out,result);return;
 }
 if(command==='compare'){const [other,frameId,partName]=rest;validateTargetedEdit(source,load(other),frameId,partName);console.log('Only the named part changed');return;}
 if(command==='clone-part'){
  const [fromId,partName,toId,out]=rest;
  const from=source.frames.find(f=>f.id===fromId),to=source.frames.find(f=>f.id===toId);
  if(!from||!to||!out||!to.parts.some(p=>p.name===partName))throw new Error('Unknown clone target');
  assertSafeMirror(from,[partName]);
  const shared=from.parts.find(p=>p.name===partName)!;
  const result={...source,frames:source.frames.map(f=>f.id!==toId?f:{...f,parts:f.parts.map(p=>p.name!==partName?p:structuredClone(shared))})};
  validateTargetedEdit(source,result,toId,partName);save(out,result);return;
 }
 if(command!=='compile')throw new Error('Unknown command');
 const [out]=rest;if(!out)throw new Error('compile source output-directory');
 const compiled=compilePixelPlayerAsset(source),columns=Math.min(8,compiled.frames.length),rows=Math.ceil(compiled.frames.length/columns);
 const width=compiled.width*columns,height=compiled.height*rows,rgba=new Uint8Array(width*height*4);
 const entries=compiled.frames.map((frame,index)=>{
  const x=(index%columns)*compiled.width,y=Math.floor(index/columns)*compiled.height;
  for(let yy=0;yy<compiled.height;yy++)for(let xx=0;xx<compiled.width;xx++)rgba.set(frame.rgba.slice((yy*compiled.width+xx)*4,(yy*compiled.width+xx+1)*4),((y+yy)*width+x+xx)*4);
  return {id:frame.id,x,y,width:compiled.width,height:compiled.height,anchors:frame.anchors,bodyBounds:frame.bodyBounds,bat:frame.bat};
 });
 mkdirSync(out,{recursive:true});
 const raster=png(width,height,rgba);
 const sourceHash=createHash('sha256').update(JSON.stringify(source)).digest('hex');
 writeFileSync(join(out,'atlas.png'),raster);
 writeFileSync(join(out,'atlas.json'),JSON.stringify({version:1,assetId:source.id,sourceHash,width,height,frames:entries},null,2)+'\n');
 writeFileSync(join(out,'runtime.json'),JSON.stringify(compiled)+'\n');
 const atlasUrl=`data:image/png;base64,${raster.toString('base64')}`;
 const fontCss=fontPath?`@font-face{font-family:PixelReview;src:url(data:font/woff;base64,${readFileSync(fontPath).toString('base64')}) format('woff')}`:'';
 const cards=entries.map(f=>`<figure><canvas width="96" height="96" data-x="${f.x}" data-y="${f.y}"></canvas><figcaption>${escaped(f.id)}</figcaption></figure>`).join('');
 writeFileSync(join(out,'preview.html'),`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Pixel Player — ${escaped(source.id)}</title><style>${fontCss}*{box-sizing:border-box}body{margin:0;background:#090d0b;color:#e7e6dc;font:14px PixelReview,system-ui;padding:24px}h1{font-size:24px}p{color:#a4aaa1}main{display:flex;flex-wrap:wrap;gap:12px}figure{margin:0;background:#121915;border:1px solid #2e3731;padding:16px;width:180px}canvas{display:block;margin:auto;image-rendering:pixelated;background:#263c2b}figcaption{font-size:11px;color:#c7ac63;margin-top:12px;overflow-wrap:anywhere}</style><h1>Pixel Player · ${escaped(source.id)}</h1><p>顔なし・小顔・厚い体格。1セル＝4px。原本は名前付きパーツのJSON。PNGは生成物。</p><main>${cards}</main><script>const image=new Image();image.src='${atlasUrl}';image.onload=()=>document.querySelectorAll('canvas').forEach(c=>{const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(image,+c.dataset.x,+c.dataset.y,${compiled.width},${compiled.height},0,0,96,96)});</script></html>`);
 console.log(`Compiled ${compiled.frames.length} frames -> ${out}; source ${sourceHash}`);
}
