import {cp,mkdir,stat,rm} from 'node:fs/promises';
import path from 'node:path';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),target=path.join(root,'dist');
if(path.resolve(target)!==path.join(root,'dist'))throw new Error('Unexpected build directory');
await rm(target,{recursive:true,force:true});await mkdir(target,{recursive:true});
await cp(path.join(root,'web'),target,{recursive:true});
for(const directory of ['assets','shared'])await cp(path.join(root,directory),path.join(target,directory),{recursive:true});
for(const name of ['hero','sedation','consultation','care','team','teeth','guide','child'])if((await stat(path.join(target,'assets',name+'.webp'))).size<1000)throw new Error('Missing original asset '+name);
if((await stat(path.join(target,'assets','preservation.jpg'))).size<1000)throw new Error('Missing preservation image');
if(process.argv.includes('--pages')){
 for(const name of await readdir(target)){
  if(!/\.(html|mjs)$/.test(name))continue;
  const file=path.join(target,name),source=await readFile(file,'utf8');
  await writeFile(file,source.replace(/(["'])\/(assets|shared)\//g,'$1./$2/').replaceAll('href="/styles.css"','href="./styles.css"').replaceAll('src="/app.mjs"','src="./app.mjs"'));
 }
 await writeFile(path.join(target,'deployment.mjs'),'export const staticHosting=true;\n');
 await writeFile(path.join(target,'.nojekyll'),'');
 await cp(path.join(target,'index.html'),path.join(target,'404.html'));
}
console.log(`Solhyang web build complete · 9 original images · ${process.argv.includes('--pages')?'GitHub Pages':'server APIs retained'}.`);
