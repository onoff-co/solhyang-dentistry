import {landing} from './landing.mjs';
import {treatments,treatment,clinic} from '/shared/catalog.mjs';
import {icon,action,api,escapeText as e} from './ui.mjs';
import {createReservations} from './reservations.mjs';
document.querySelector('#landing').innerHTML=landing();
for(const node of document.querySelectorAll('[data-icon]'))node.insertAdjacentHTML('afterbegin',icon(node.dataset.icon));
document.querySelector('#quick-service').innerHTML=treatments.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
const dialog=document.querySelector('#content-dialog'),workspace=document.querySelector('#workspace');
function notify(text){const el=document.querySelector('#toast');el.textContent=text;el.hidden=false;clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.hidden=true,4000);}
function openDialog(title,html){document.querySelector('#dialog-content').innerHTML=`<h2 id="dialog-title">${e(title)}</h2>${html}`;if(!dialog.open)dialog.showModal();}
const closeDialog=()=>dialog.close();
const reservations=createReservations({root:workspace,notify,openDialog,closeDialog});
const quickControl=document.querySelector('.quick-control'),quickToggle=document.querySelector('#quick-toggle'),quickLinks=document.querySelector('#quick-links');
function setQuickMenu(open){quickToggle.setAttribute('aria-expanded',String(open));quickLinks.hidden=!open;quickToggle.querySelector('.quick-toggle-label').textContent=open?'닫기':'빠른 메뉴';}
quickToggle.addEventListener('click',()=>setQuickMenu(quickToggle.getAttribute('aria-expanded')!=='true'));
document.addEventListener('click',event=>{if(!quickControl.contains(event.target)||event.target.closest('#quick-links a, #quick-links button'))setQuickMenu(false);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!quickLinks.hidden){setQuickMenu(false);quickToggle.focus();}});
function consultation(){openDialog('빠른 상담 신청',`<p class="dialog-description">상담하고 싶은 진료와 연락처를 남겨 주세요.</p><form id="consult-form"><div class="field"><label for="consult-name">이름</label><input id="consult-name" name="name" maxlength="30" autocomplete="off" required></div><div class="field"><label for="consult-phone">휴대폰 번호</label><input id="consult-phone" name="phone" type="tel" maxlength="13" autocomplete="off" required></div><div class="field"><label for="consult-service">상담 진료</label><select id="consult-service" name="service">${treatments.map(s=>`<option value="${s.id}">${s.name}</option>`).join('')}</select></div><label class="consent-row"><input type="checkbox" name="consent" required><span>상담 정보 수집·이용에 동의합니다.<small>이름, 휴대폰 번호와 상담 진료를 상담 관리에 사용합니다.</small></span></label><p class="form-message" id="consult-error" role="alert" hidden></p><button class="btn solid full" type="submit">상담 신청하기</button></form>`);}
function privacy(){openDialog('개인정보 수집·이용 안내','<div class="privacy-content"><h3>수집 항목과 목적</h3><p>이름, 휴대폰 번호, 진료 항목, 예약 일정은 예약·상담의 접수와 관리에 사용합니다. 증상이나 진료기록은 입력하지 않습니다.</p><h3>보관과 확인</h3><p>연락처는 서버에 암호화해 저장합니다. 예약 내역은 접수번호와 예약자 정보로 확인할 수 있습니다. 접수번호는 다른 사람에게 공유하지 마세요.</p><h3>동의와 이용</h3><p>동의하지 않을 수 있으며, 동의하지 않으면 온라인 접수를 이용할 수 없습니다. 접수 관련 문의는 고객센터로 연락해 주세요.</p></div>');}
function detail(id){const s=treatment(id);if(!s)return;openDialog(s.name,`<h3 class="detail-heading">${s.heading}</h3><p>${s.intro}</p><ul class="detail-list">${s.points.map(point=>`<li>${icon('check')}${point}</li>`).join('')}</ul><h3 class="faq-label">자주 묻는 질문</h3>${s.faq.map(([question,answer])=>`<details><summary>${question}</summary><p>${answer}</p></details>`).join('')}<p class="small muted">치료 적합성·방법·기간·비용은 진료 결과에 따라 개별적으로 안내합니다.</p>${action('#booking?service='+s.id,'이 진료로 상담 예약')}`);}
async function route(){
 setQuickMenu(false);
 const [hash,query='']=(location.hash.slice(1)||'home').split('?'),isWorkflow=['booking','reservations'].includes(hash);
 document.querySelector('#landing').hidden=isWorkflow;workspace.hidden=!isWorkflow;document.body.classList.toggle('workflow-open',isWorkflow);
 document.querySelector('.header nav').classList.remove('expanded');document.querySelector('#mobile-menu').setAttribute('aria-expanded','false');closeDialog();
 if(isWorkflow){await reservations.open(hash,new URLSearchParams(query).get('service'));workspace.scrollIntoView({block:'start'});}
 else document.getElementById(hash)?.scrollIntoView({block:'start',behavior:'smooth'});
 document.title='솔향치과';document.querySelectorAll('.header nav a').forEach(a=>{if(a.hash==='#'+hash)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
const requestIds=new WeakMap();
async function submitConsultation(form){
 const submit=form.querySelector('[type="submit"]');if(submit.disabled)return;submit.disabled=true;
 if(!requestIds.has(form))requestIds.set(form,crypto.randomUUID());
 const data=new FormData(form),payload={name:data.get('name'),phone:data.get('phone'),service:data.get('service'),consent:data.get('consent')==='on',requestId:requestIds.get(form)};
 try{const result=await api('/api/consultations',payload);form.reset();requestIds.delete(form);openDialog('상담 신청이 접수되었습니다.',`<div class="consult-success">${icon('check')}<p>선택하신 진료의 상담 신청을 저장했습니다.</p><p class="receipt-label">접수번호</p><strong>${e(result.receipt)}</strong><p class="small muted">일정 예약을 원하시면 온라인 예약을 이용해 주세요.</p>${action('#booking','방문 일정 예약하기')}</div>`);}
 catch(error){const node=form.querySelector('#consult-error')||document.querySelector('#bottom-message');node.textContent=error.message;node.hidden=false;}
 finally{submit.disabled=false;}
}
document.addEventListener('click',async event=>{
 if(event.target.closest('.skip')){event.preventDefault();document.querySelector('main').focus();return;}
 const button=event.target.closest('button');if(!button)return;
 if(button.hasAttribute('data-close'))return closeDialog();
 if(button.id==='mobile-menu'){const expanded=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',expanded);document.querySelector('.header nav').classList.toggle('expanded',expanded);return;}
 if(button.dataset.open==='consult')return consultation();if(button.dataset.open==='privacy')return privacy();
 if(button.dataset.treatment)return detail(button.dataset.treatment);
 if(button.hasAttribute('data-copy-address')){try{await navigator.clipboard.writeText(clinic.address);notify('주소를 복사했습니다.');}catch{openDialog('오시는 길',`<p>${e(clinic.address)}</p>`);}return;}
 await reservations.click(button);
});
document.addEventListener('input',event=>reservations.input(event.target));
document.addEventListener('submit',async event=>{const form=event.target;event.preventDefault();if(['bottom-consult-form','consult-form'].includes(form.id))await submitConsultation(form);else await reservations.submit(form);});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
window.addEventListener('hashchange',route);route();
