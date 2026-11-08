import { transformLiveV46 } from './v46-live-presentation.mjs';
export function transformLiveV47(source, runtime) {
 const html = transformLiveV46(source, runtime);
 if (html.split('presentationVersion:46').length !== 2) throw Error('v47 presentation version guard');
 return html.replace('presentationVersion:46', 'presentationVersion:47');
}
