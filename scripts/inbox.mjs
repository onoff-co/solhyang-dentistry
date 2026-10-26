import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {openDatabase} from '../server/database.mjs';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url))),key=await readFile(path.join(root,'.local/storage.key'));
const vault=openDatabase(path.join(root,'.local/solhyang.db'),key);
console.log('예약 접수');console.table(vault.database.prepare('SELECT * FROM appointments ORDER BY created_at DESC LIMIT 100').all().map(row=>({진료:row.service,일정:row.date+' '+row.time,상태:row.status,...vault.decrypt(row.contact)})));
console.log('상담 접수');console.table(vault.database.prepare('SELECT * FROM consultations ORDER BY created_at DESC LIMIT 100').all().map(row=>({접수번호:row.receipt,진료:row.service,...vault.decrypt(row.contact)})));
vault.database.close();
