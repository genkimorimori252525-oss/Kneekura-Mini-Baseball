import {transformLiveV39} from './v39-live-presentation.mjs';
export function transformLiveV40(source,runtime){
 const html=transformLiveV39(source,runtime),before='presentationVersion:39';
 if(html.split(before).length!==2)throw new Error('v40 presentation guard');
 return html.replace(before,'presentationVersion:40');
}
