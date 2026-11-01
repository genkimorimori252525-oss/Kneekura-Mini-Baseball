import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Script} from 'node:vm';
export const makerLayoutPathsV112=['docs/demos/baseball-maker-layout-v112.js','docs/demos/baseball-maker-layout-v112.css'];
export async function makerLayoutAssetsV112(){
 const [script,style]=await Promise.all(makerLayoutPathsV112.map(p=>readFile(p,'utf8')));
 assert(!/<\/script/i.test(script)&&!/<\/style/i.test(style));new Script(script);
 return{script,style,hashes:Object.fromEntries(makerLayoutPathsV112.map((p,i)=>[p,createHash('sha256').update([script,style][i]).digest('hex')]))};
}
export function applyMakerLayoutV112(html,assets){
 assert(!html.includes('id="maker-layout-script-v112"'),'Layout already installed');
 const injections=[['</head>','<style id="maker-layout-style-v112">\n'+assets.style+'\n</style>'],['</body>','<script id="maker-layout-script-v112">\n'+assets.script+'\n</script>']];
 for(const [marker,code]of injections){assert.equal(html.split(marker).length,2,'Unique maker closing marker '+marker);html=html.replace(marker,()=>code+marker);}
 return html;
}
