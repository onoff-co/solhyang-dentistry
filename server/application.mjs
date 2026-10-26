import http from 'node:http';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {openDatabase} from './database.mjs';
import {createRecords,RequestError} from './appointments.mjs';
import {dateInSeoul} from './schedule.mjs';
import {treatments,clinic} from '../shared/catalog.mjs';
const project=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
function readBody(req){return new Promise((resolve,reject)=>{
 let chunks=[],size=0,settled=false;
 req.on('data',chunk=>{if(settled)return;size+=chunk.length;if(size>8192){settled=true;chunks=[];reject(new RequestError(413,'입력 내용이 너무 깁니다.'));return;}chunks.push(chunk);});
 req.on('end',()=>{if(settled)return;settled=true;try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch{reject(new RequestError(400,'입력 형식을 확인해 주세요.'));}});
 req.on('error',()=>{if(!settled){settled=true;reject(new RequestError(400,'요청을 읽지 못했습니다.'));}});
});}
export function createApplication({databasePath,key,now=()=>new Date(),production=false,allowedOrigin,rateLimit=100}={}){
 const vault=openDatabase(databasePath,key),records=createRecords(vault,now),attempts=new Map();
 const security={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",'Cache-Control':'no-store'};
 const server=http.createServer(async(req,res)=>{
  const json=(status,data)=>{res.writeHead(status,{...security,'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try{
   const url=new URL(req.url,'http://localhost'),pathname=url.pathname;
   if(pathname==='/api/health')return json(200,{status:'ok'});
   if(pathname==='/api/config'&&req.method==='GET')return json(200,{clinic,treatments,today:dateInSeoul(now())});
   if(pathname==='/api/availability'&&req.method==='GET')return json(200,{slots:records.availability(url.searchParams.get('date'),url.searchParams.get('service'))});
   if(pathname.startsWith('/api/')){
    if(req.method!=='POST')throw new RequestError(405,'지원하지 않는 요청입니다.');
    const origin=allowedOrigin||'http://'+req.headers.host;
    if(req.headers.origin!==origin)throw new RequestError(403,'요청 출처를 확인할 수 없습니다.');
    const address=req.socket.remoteAddress,entry=attempts.get(address)||{count:0,until:Date.now()+60000};
    if(entry.until<Date.now()){entry.count=0;entry.until=Date.now()+60000;}entry.count++;attempts.set(address,entry);
    if(entry.count>rateLimit)throw new RequestError(429,'요청이 많습니다. 잠시 후 다시 시도해 주세요.');
    if(attempts.size>10000)for(const [k,v] of attempts)if(v.until<Date.now())attempts.delete(k);
    if(!req.headers['content-type']?.startsWith('application/json'))throw new RequestError(415,'JSON 요청이 필요합니다.');
    const body=await readBody(req);if(!body||typeof body!=='object'||Array.isArray(body))throw new RequestError(400,'입력 형식을 확인해 주세요.');
    const handlers={'/api/appointments':()=>records.create(body),'/api/appointments/lookup':()=>records.lookup(body),'/api/appointments/reschedule':()=>records.reschedule(body),'/api/appointments/cancel':()=>records.cancel(body),'/api/consultations':()=>records.consult(body)};
    if(pathname==='/api/appointments/calendar'){const calendar=records.calendar(body);res.writeHead(200,{...security,'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':'attachment; filename="solhyang-appointment.ics"'});return res.end(calendar);}
    if(!handlers[pathname])throw new RequestError(404,'요청을 찾을 수 없습니다.');
    return json(['/api/appointments','/api/consultations'].includes(pathname)?201:200,handlers[pathname]());
   }
   if(!['GET','HEAD'].includes(req.method))throw new RequestError(405,'지원하지 않는 요청입니다.');
   let root,relative;
   if(production){root=path.join(project,'dist');relative=decodeURIComponent(pathname==='/'?'/index.html':pathname);}
   else if(pathname.startsWith('/assets/')){root=path.join(project,'assets');relative=decodeURIComponent(pathname.slice(7));}
   else if(pathname.startsWith('/shared/')){root=path.join(project,'shared');relative=decodeURIComponent(pathname.slice(7));}
   else{root=path.join(project,'web');relative=decodeURIComponent(pathname==='/'?'/index.html':pathname);}
   const file=path.resolve(root,'.'+relative);if(!file.startsWith(root+path.sep)||!['.html','.mjs','.css','.webp','.svg','.woff2'].includes(path.extname(file)))throw new RequestError(404,'페이지를 찾을 수 없습니다.');
   let bytes;try{bytes=await readFile(file);}catch{throw new RequestError(404,'페이지를 찾을 수 없습니다.');}
   const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(file)];
   res.writeHead(200,{...security,'Content-Type':mime});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(error){if(error instanceof RequestError)json(error.status,{error:{message:error.message,fields:error.fields}});else{console.error('Request failed:',error.code||error.name);json(500,{error:{message:'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'}});}}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 return {server,database:vault.database,close:()=>vault.database.close()};
}
