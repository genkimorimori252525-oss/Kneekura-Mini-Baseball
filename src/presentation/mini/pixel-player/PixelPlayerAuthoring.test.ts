import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { inflateSync } from 'node:zlib';
import { expect, it } from 'vitest';
const source='assets/pixel-players/fixtures/b1-prototype.pixel.json';
const cli=(...args:string[])=>spawnSync(process.execPath,['scripts/pixel-player.mjs',...args],{encoding:'utf8'});
it('compiles a byte-identical PNG atlas twice and exports the actual transparent raster',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pixel-author-'));
 try {
  const a=join(dir,'a'),b=join(dir,'b');
  expect(cli('compile',source,a).status).toBe(0);
  expect(cli('compile',source,b).status).toBe(0);
  const png=readFileSync(join(a,'atlas.png'));
  expect(png.equals(readFileSync(join(b,'atlas.png')))).toBe(true);
  expect([...png.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
  let offset=8;const data:Buffer[]=[];
  while(offset<png.length){const len=png.readUInt32BE(offset);if(png.toString('ascii',offset+4,offset+8)==='IDAT')data.push(png.subarray(offset+8,offset+8+len));offset+=12+len;}
  const raw=inflateSync(Buffer.concat(data));
  expect(raw.length).toBe(24*(24*4+1));
  expect([...raw.subarray(1,5)]).toEqual([0,0,0,0]);
  expect(readFileSync(join(a,'preview.html'),'utf8')).toContain('data:image/png;base64,');
 } finally {rmSync(dir,{recursive:true,force:true});}
});
it('edits only a named cell, refuses unsafe clone and makes a new player without collateral changes',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pixel-edit-'));
 try{
  const edited=join(dir,'edited.json');
  expect(cli('edit',source,'idle-front-R','leg-right','13','16','U',edited).status).toBe(0);
  const before=JSON.parse(readFileSync(source,'utf8')),after=JSON.parse(readFileSync(edited,'utf8'));
  expect(after.frames[0].parts.find((p:{name:string})=>p.name==='leg-right').rows[16][13]).toBe('U');
  expect(after.frames[0].parts.filter((p:{name:string})=>p.name!=='leg-right')).toEqual(before.frames[0].parts.filter((p:{name:string})=>p.name!=='leg-right'));
  expect(cli('clone-part','assets/pixel-players/players/b1-test.pixel.json','batting-R-0','bat','batting-L-0',join(dir,'bad.json')).status).not.toBe(0);
  expect(cli('new',source,join(dir,'new.json'),'new-player').status).toBe(0);
  expect(JSON.parse(readFileSync(join(dir,'new.json'),'utf8'))).toEqual({...before,id:'new-player'});
 } finally {rmSync(dir,{recursive:true,force:true});}
});
