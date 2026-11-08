import {expect,test} from 'vitest';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {presentationControlsSourceV84} from './presentation-cadence-v84.mjs';
test('maker transfers only presentation settings to its renderer frames and does not advance playback',()=>{
 const calls=[],listeners={},children=[0,1].map(()=>({KneekuraPresentationControlsV84:{configure:value=>calls.push(value)}})),root={
  document:{querySelectorAll:()=>children.map(contentWindow=>({contentWindow})),addEventListener:(name,fn)=>{listeners['document:'+name]=fn;}},
  addEventListener:(name,fn)=>{listeners[name]=fn;},dispatchEvent:event=>listeners[event.type]?.(event),CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
 vm.runInNewContext(presentationControlsSourceV84,{globalThis:root});
 vm.runInNewContext(readFileSync(new URL('./maker-presentation-bridge-v84.js',import.meta.url),'utf8'),{globalThis:root});
 root.KneekuraPresentationControlsV84.configure({frequencyScale:1,qualityScale:1});
 expect(calls).toEqual([{frequencyScale:1,qualityScale:1},{frequencyScale:1,qualityScale:1}]);
 listeners['document:load']({target:{tagName:'IFRAME',contentWindow:children[0]}});expect(calls).toHaveLength(3);
});
