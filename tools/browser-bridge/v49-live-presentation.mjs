import {transformLiveV48} from './v48-live-presentation.mjs';
export function transformLiveV49(source,runtime){
 const html=transformLiveV48(source,runtime);
 if(html.split('presentationVersion:48').length!==2)throw Error('v49 presentation version guard');
 return html.replace('presentationVersion:48','presentationVersion:49');
}
