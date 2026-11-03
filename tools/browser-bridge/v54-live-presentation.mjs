import {transformLiveV53} from './v53-live-presentation.mjs';
function once(source,before,after){if(source.split(before).length!==2)throw Error('v54 presentation guard: '+before.slice(0,90));return source.replace(before,after);}
export function transformLiveV54(source,runtime){
 let html=transformLiveV53(source,runtime);
 html=once(html,'presentationVersion:53','presentationVersion:54');
 return once(html,'<select id="batting-choice"><option value="balanced">',
  '<select id="batting-choice"><option value="auto" selected>選手に任せる</option><option value="balanced">');
}
