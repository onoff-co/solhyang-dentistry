import {treatment} from '../shared/catalog.mjs';
export const dateInSeoul=now=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
export const normalizePhone=value=>String(value||'').replace(/[\s-]/g,'');
export function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const d=new Date(value+'T00:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===value;}
export const toMinutes=value=>/^\d{2}:\d{2}$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):NaN;
export function slots(date,service,busy=[],now=new Date()){
 if(!validDate(date)||!treatment(service))return [];
 const today=dateInSeoul(now),last=new Date(today+'T00:00:00Z');last.setUTCDate(last.getUTCDate()+90);
 if(date<today||date>last.toISOString().slice(0,10))return [];
 const weekday=new Date(date+'T00:00:00Z').getUTCDay();if(weekday===0)return [];
 const start=weekday===6?570:600,end=weekday===1?1230:weekday===6?810:1140,duration=treatment(service).duration;
 const result=[];
 for(let m=start;m+duration<=end;m+=30){
  if(weekday!==6&&m<840&&m+duration>780)continue;
  const time=`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  if(new Date(date+'T'+time+':00+09:00')<=now)continue;
  if(busy.some(row=>m<toMinutes(row.time)+row.duration&&m+duration>toMinutes(row.time)))continue;
  result.push(time);
 }
 return result;
}
export function validateContact(body,consent=true){
 const errors={};if(!/^[가-힣a-zA-Z\s]{2,30}$/.test(String(body.name||'').trim()))errors.name='이름을 한글 또는 영문 2~30자로 입력해 주세요.';
 if(!/^010\d{8}$/.test(normalizePhone(body.phone)))errors.phone='010으로 시작하는 휴대폰 번호를 확인해 주세요.';
 if(consent&&body.consent!==true)errors.consent='예약 정보 수집·이용에 동의해 주세요.';
 return errors;
}
