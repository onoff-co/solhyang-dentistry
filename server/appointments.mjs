import {randomBytes,randomUUID} from 'node:crypto';
import {treatment} from '../shared/catalog.mjs';
import {slots,validateContact,normalizePhone} from './schedule.mjs';
export class RequestError extends Error{constructor(status,message,fields){super(message);this.status=status;this.fields=fields;}}
export function createRecords(vault,now){
 const {database:db,hash,encrypt,decrypt,transaction}=vault;
 const contact=body=>({name:body.name.trim().replace(/\s+/g,' '),phone:normalizePhone(body.phone)});
 const validate=(body,needConsent=true)=>{const fields=validateContact(body,needConsent);if(Object.keys(fields).length)throw new RequestError(422,'입력 내용을 확인해 주세요.',fields);};
 const requestId=body=>{if(typeof body.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(body.requestId))throw new RequestError(422,'요청 정보를 새로 만든 뒤 다시 시도해 주세요.');};
 const dto=row=>({id:row.id,service:row.service,serviceName:treatment(row.service)?.name,date:row.date,time:row.time,duration:row.duration,status:row.status,name:decrypt(row.contact).name,phoneMasked:'010-****-'+decrypt(row.contact).phone.slice(-4)});
 const occupied=(date,except='')=>db.prepare("SELECT time,duration FROM appointments WHERE date=? AND status='confirmed' AND id<>?").all(date,except);
 const authorize=body=>{
  validate(body,false);if(!/^SL-[A-F0-9]{16}$/i.test(body.receipt||''))throw new RequestError(404,'예약자 정보 또는 접수번호를 확인해 주세요.');
  const person=contact(body),row=db.prepare('SELECT * FROM appointments WHERE receipt_hash=? AND phone_hash=? AND name_hash=?').get(hash(body.receipt.toUpperCase()),hash(person.phone),hash(person.name));
  if(!row)throw new RequestError(404,'예약자 정보 또는 접수번호를 확인해 주세요.');return row;
 };
 return {
  availability:(date,service)=>slots(date,service,occupied(date),now()),
  create(body){
   validate(body);requestId(body);if(!treatment(body.service))throw new RequestError(422,'진료 항목을 선택해 주세요.',{service:'진료 항목을 선택해 주세요.'});
   const person=contact(body),fingerprint=hash(JSON.stringify({...person,service:body.service,date:body.date,time:body.time}));
   return transaction(()=>{
    const previous=db.prepare('SELECT * FROM appointments WHERE request_id=?').get(body.requestId);
    if(previous){if(previous.fingerprint!==fingerprint)throw new RequestError(409,'변경된 예약 정보로 다시 접수해 주세요.');return {appointment:dto(previous),receipt:decrypt(previous.receipt_cipher)};}
    if(!slots(body.date,body.service,occupied(body.date),now()).includes(body.time))throw new RequestError(409,'선택한 시간은 예약할 수 없습니다. 다른 시간을 선택해 주세요.',{time:'예약 가능한 시간을 다시 선택해 주세요.'});
    const id=randomUUID(),receipt='SL-'+randomBytes(8).toString('hex').toUpperCase();
    db.prepare('INSERT INTO appointments(id,receipt_hash,receipt_cipher,contact,phone_hash,name_hash,service,date,time,duration,request_id,fingerprint,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,hash(receipt),encrypt(receipt),encrypt(person),hash(person.phone),hash(person.name),body.service,body.date,body.time,treatment(body.service).duration,body.requestId,fingerprint,now().toISOString());
    return {appointment:dto(db.prepare('SELECT * FROM appointments WHERE id=?').get(id)),receipt};
   });
  },
  lookup:body=>({appointment:dto(authorize(body))}),
  reschedule(body){return transaction(()=>{const row=authorize(body);if(row.status!=='confirmed')throw new RequestError(409,'취소된 예약은 변경할 수 없습니다.');if(!slots(body.date,row.service,occupied(body.date,row.id),now()).includes(body.time))throw new RequestError(409,'변경 가능한 날짜와 시간을 선택해 주세요.');db.prepare('UPDATE appointments SET date=?,time=? WHERE id=?').run(body.date,body.time,row.id);return {appointment:dto(db.prepare('SELECT * FROM appointments WHERE id=?').get(row.id))};});},
  cancel(body){const row=authorize(body);db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(row.id);return {appointment:{...dto(row),status:'cancelled'}};},
  calendar(body){const row=authorize(body);if(row.status!=='confirmed')throw new RequestError(409,'취소된 예약입니다.');const start=new Date(row.date+'T'+row.time+':00+09:00'),end=new Date(start.getTime()+row.duration*60000),stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z/,'Z');return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Solhyang Dentistry//Appointment//KO','BEGIN:VEVENT',`UID:${row.id}@solhyang.local`,`DTSTAMP:${stamp(now())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(end)}`,`SUMMARY:솔향치과 ${treatment(row.service).name}`,'END:VEVENT','END:VCALENDAR',''].join('\r\n');},
  consult(body){validate(body);requestId(body);if(!treatment(body.service))throw new RequestError(422,'상담할 진료를 선택해 주세요.');const person=contact(body),fingerprint=hash(JSON.stringify({...person,service:body.service}));const previous=db.prepare('SELECT * FROM consultations WHERE request_id=?').get(body.requestId);if(previous){if(previous.fingerprint!==fingerprint)throw new RequestError(409,'변경한 정보로 다시 신청해 주세요.');return {receipt:previous.receipt};}const receipt='SC-'+randomBytes(6).toString('hex').toUpperCase();db.prepare('INSERT INTO consultations VALUES(?,?,?,?,?,?,?)').run(randomUUID(),receipt,encrypt(person),body.service,body.requestId,fingerprint,now().toISOString());return {receipt};}
 };
}
