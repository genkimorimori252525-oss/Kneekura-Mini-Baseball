import {transformLiveV50} from './v50-live-presentation.mjs';
export function transformLiveV51(source,runtime){
 const html=transformLiveV50(source,runtime);
 if(html.split('presentationVersion:50').length!==2)throw Error('v51 presentation version guard');
 return html.replace('presentationVersion:50','presentationVersion:51');
}
