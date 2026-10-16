import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const entry=fileURLToPath(new URL('../tools/pixel-player/authoring.ts',import.meta.url));
try {
 const result=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false});
 const module=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
 module.runPixelAuthoring(process.argv.slice(2),fileURLToPath(new URL('../assets/fonts/NotoSansJP-review.woff',import.meta.url)));
} catch(error){console.error(error.message);process.exitCode=1;}
