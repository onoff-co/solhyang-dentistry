import test from 'node:test';
import assert from 'node:assert/strict';
import {slots,dateInSeoul,validateContact} from '../server/schedule.mjs';
const now=new Date('2026-10-26T00:00:00Z');
test('Korean timezone, closed days, invalid days and horizon are respected',()=>{
 assert.equal(dateInSeoul(new Date('2026-10-26T16:00:00Z')),'2026-10-27');
 for(const date of ['2026-10-25','2026-11-01','2026-02-30','2027-06-01'])assert.deepEqual(slots(date,'implant',[],now),[]);
});
test('durations fit operating hours, night clinic, lunch and Saturday',()=>{
 assert.equal(slots('2026-10-26','implant',[],now).at(-1),'19:30');
 assert.equal(slots('2026-10-27','implant',[],now).at(-1),'18:00');
 assert.equal(slots('2026-10-31','child',[],now).at(-1),'13:00');
 assert.ok(!slots('2026-10-27','implant',[],now).includes('12:30'));
 assert.ok(!slots('2026-10-27','child',[],now).includes('13:00'));
});
test('overlapping durations exclude all blocked slots',()=>{
 const busy=[{time:'10:00',duration:60}];
 const available=slots('2026-10-27','child',busy,now);
 assert.ok(!available.includes('10:00'));assert.ok(!available.includes('10:30'));assert.ok(available.includes('11:00'));
});
test('contact schema rejects injected text, malformed phone and absent consent',()=>{
 assert.deepEqual(validateContact({name:'김솔향',phone:'010-0000-0000',consent:true}),{});
 const errors=validateContact({name:'<script>',phone:'123',consent:false});
 assert.ok(errors.name);assert.ok(errors.phone);assert.ok(errors.consent);
});
