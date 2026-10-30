import {transformLiveV38} from './v38-live-presentation.mjs';
export function transformLiveV39(source,runtime){
 const html=transformLiveV38(source,runtime),before='presentationVersion:38';
 if(html.split(before).length!==2)throw new Error('v39 presentation guard');
 return html.replace(before,'presentationVersion:39');
}
