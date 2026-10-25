import {readFile,writeFile} from 'node:fs/promises';
import {referenceDesign,symmetricDesign,russianDomeDesign,inspection} from './model.mjs';
const [command,file]=process.argv.slice(2);
if(command==='example'&&file){await writeFile(file,JSON.stringify(symmetricDesign(),null,2)+'\n');console.log(file);}
else if(command==='reference'&&file){await writeFile(file,JSON.stringify(referenceDesign(),null,2)+'\n');console.log(file);}
else if(command==='dome'&&file){await writeFile(file,JSON.stringify(russianDomeDesign(),null,2)+'\n');console.log(file);}
else if(command==='check'&&file){try{const result=inspection(JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,'')));
  console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}catch(e){console.error('JSONを読めません: '+e.message);process.exitCode=1;}}
else{console.error('Usage: node tools/ballpark-studio/cli.mjs example|reference|dome|check <file.json>');process.exitCode=2;}
