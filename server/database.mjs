import {DatabaseSync} from 'node:sqlite';
import {createCipheriv,createDecipheriv,createHmac,randomBytes} from 'node:crypto';
export function openDatabase(filename,key){
 const database=new DatabaseSync(filename,{timeout:5000});
 database.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS appointments(id TEXT PRIMARY KEY, receipt_hash TEXT UNIQUE NOT NULL, receipt_cipher TEXT NOT NULL, contact TEXT NOT NULL, phone_hash TEXT NOT NULL, name_hash TEXT NOT NULL, service TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL, duration INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'confirmed', request_id TEXT UNIQUE NOT NULL, fingerprint TEXT NOT NULL, created_at TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS appointment_date ON appointments(date,status);
 CREATE TABLE IF NOT EXISTS consultations(id TEXT PRIMARY KEY, receipt TEXT NOT NULL,contact TEXT NOT NULL,service TEXT NOT NULL,request_id TEXT UNIQUE NOT NULL,fingerprint TEXT NOT NULL,created_at TEXT NOT NULL);`);
 const hash=value=>createHmac('sha256',key).update(String(value)).digest('hex');
 const encrypt=value=>{const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');};
 const decrypt=value=>{const raw=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));decipher.setAuthTag(raw.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString('utf8'));};
 const transaction=action=>{database.exec('BEGIN IMMEDIATE');try{const result=action();database.exec('COMMIT');return result;}catch(error){database.exec('ROLLBACK');throw error;}};
 return {database,hash,encrypt,decrypt,transaction};
}
