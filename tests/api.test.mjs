import test from 'node:test';
import assert from 'node:assert/strict';
import {createApplication} from '../server/application.mjs';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../server/database.mjs';
import {createRecords} from '../server/appointments.mjs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {rm} from 'node:fs/promises';
const now=()=>new Date('2026-10-26T00:00:00Z');
async function fixture(t,options={}){
 const app=createApplication({databasePath:':memory:',key:Buffer.alloc(32,7),now,...options});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${app.server.address().port}`;
 t.after(async()=>{await new Promise(resolve=>app.server.close(resolve));app.close();});
 const post=async(path,body,headers={})=>{const response=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...headers},body:JSON.stringify(body)});return {status:response.status,data:await response.json()};};
 return {app,base,post};
}
const contact={name:'김솔향',phone:'01000000000',consent:true};
const booking=()=>({...contact,service:'implant',date:'2026-10-27',time:'10:00',requestId:randomUUID()});
test('appointment creation, private lookup, rescheduling, calendar and cancellation',async t=>{
 const {post,base}=await fixture(t),input=booking(),created=await post('/api/appointments',input);
 assert.equal(created.status,201);assert.ok(created.data.receipt);
 const auth={name:input.name,phone:input.phone,receipt:created.data.receipt};
 assert.equal((await post('/api/appointments/lookup',{...auth,phone:'01011111111'})).status,404);
 assert.equal((await post('/api/appointments/lookup',auth)).data.appointment.time,'10:00');
 assert.equal((await post('/api/appointments/reschedule',{...auth,date:'2026-10-28',time:'11:00'})).data.appointment.date,'2026-10-28');
 const calendar=await fetch(base+'/api/appointments/calendar',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(auth)});
 assert.equal(calendar.status,200);assert.match(await calendar.text(),/BEGIN:VCALENDAR/);
 assert.equal((await post('/api/appointments/cancel',auth)).data.appointment.status,'cancelled');
 assert.equal((await post('/api/appointments/reschedule',{...auth,date:'2026-10-29',time:'11:00'})).status,409);
});
test('idempotent submissions and overlapping time conflicts',async t=>{
 const {post}=await fixture(t),input=booking(),first=await post('/api/appointments',input),again=await post('/api/appointments',input);
 assert.equal(first.data.receipt,again.data.receipt);
 assert.equal((await post('/api/appointments',{...booking(),time:'10:30',service:'child'})).status,409);
 assert.equal((await post('/api/appointments',{...input,time:'12:00'})).status,409);
});
test('input, consent, origin and private route protections',async t=>{
 const {base,post}=await fixture(t);
 assert.equal((await post('/api/appointments',{...booking(),name:'<script>'})).status,422);
 assert.equal((await post('/api/appointments',{...booking(),consent:false})).status,422);
 assert.equal((await post('/api/appointments',booking(),{Origin:'https://elsewhere.invalid'})).status,403);
 assert.equal((await fetch(base+'/.local/secret.key')).status,404);
 assert.equal((await fetch(base+'/server/database.mjs')).status,404);
});
test('consultation requests persist and keep contact encrypted',async t=>{
 const {app,post}=await fixture(t);
 const saved=await post('/api/consultations',{...contact,service:'child',requestId:randomUUID()});
 assert.equal(saved.status,201);assert.ok(saved.data.receipt);
 const row=app.database.prepare('SELECT contact FROM consultations').get();
 assert.ok(!row.contact.includes(contact.name));assert.ok(!row.contact.includes(contact.phone));
});
test('concurrent appointment submissions cannot double-book the same time',async t=>{
 const {post}=await fixture(t),results=await Promise.all([post('/api/appointments',booking()),post('/api/appointments',booking())]);
 assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
});
test('reservation attempts are rate limited',async t=>{
 const {post}=await fixture(t,{rateLimit:2}),auth={name:'김솔향',phone:'01000000000',receipt:'SL-0000000000000000'};
 assert.equal((await post('/api/appointments/lookup',auth)).status,404);
 assert.equal((await post('/api/appointments/lookup',auth)).status,404);
 assert.equal((await post('/api/appointments/lookup',auth)).status,429);
});
test('encrypted file-backed records survive a database restart',async t=>{
 const filename=path.join(tmpdir(),'solhyang-test-'+randomUUID()+'.db'),key=Buffer.alloc(32,9);
 t.after(async()=>{for(const suffix of ['','-wal','-shm'])await rm(filename+suffix,{force:true});});
 let vault=openDatabase(filename,key),records=createRecords(vault,now);const input=booking(),saved=records.create(input);vault.database.close();
 vault=openDatabase(filename,key);records=createRecords(vault,now);
 assert.equal(records.lookup({...contact,receipt:saved.receipt}).appointment.date,input.date);
 vault.database.close();
});
test('oversized and malformed JSON requests fail without server errors',async t=>{
 const {base,post}=await fixture(t);
 assert.equal((await post('/api/appointments',{...booking(),name:'a'.repeat(9000)})).status,413);
 const response=await fetch(base+'/api/appointments',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:'{broken'});
 assert.equal(response.status,400);
});
