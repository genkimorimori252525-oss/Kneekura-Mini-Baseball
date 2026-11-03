import {transformLiveV49} from './v49-live-presentation.mjs';
export function transformLiveV50(source,runtime){
 const html=transformLiveV49(source,runtime);
 if(html.split('presentationVersion:49').length!==2)throw Error('v50 presentation version guard');
 return html.replace('presentationVersion:49','presentationVersion:50');
}
