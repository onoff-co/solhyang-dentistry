import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createApplication} from './application.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),folder=path.join(root,'.local');await mkdir(folder,{recursive:true});
const keyfile=path.join(folder,'storage.key');let key;
try{key=await readFile(keyfile);}catch(error){if(error.code!=='ENOENT')throw error;key=randomBytes(32);await writeFile(keyfile,key,{flag:'wx',mode:0o600});}
if(key.length!==32)throw new Error('Storage key must be 32 bytes');
const app=createApplication({databasePath:path.join(folder,'solhyang.db'),key,production:process.argv.includes('--production'),allowedOrigin:process.env.APP_ORIGIN});
const port=Number(process.env.PORT||5185),host=process.env.HOST||'127.0.0.1';
app.server.listen(port,host,()=>console.log(`솔향치과 · http://${host}:${port}`));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.server.close(()=>{app.close();process.exit(0);}));
