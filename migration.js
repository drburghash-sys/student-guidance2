'use strict';
(() => {
const LABELS={daily:'المواقف اليومية الطارئة',attendance:'الغياب والمواظبة',behavior:'المخالفات والسلوك',health:'الحالات الصحية',social:'الحالات الاجتماعية',material:'الحالات المادية',events:'البرامج والفعاليات',guardians:'التواصل مع أولياء الأمور',followup:'الطالبات المحتاجات للمتابعة',honor:'تكريم الطالبات',academic:'التحصيل الدراسي'};
const $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const arNums=x=>String(x??'').replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
const norm=x=>arNums(x).normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
const schoolLabel=x=>x==='p31'?'الابتدائية ٣١':x==='m34'?'المتوسطة ٣٤':'غير محددة';
let source=null, rows=[], selected=new Map(), inspection=null, loading=false;
function status(msg){$('progress').textContent=msg}
function clear(){source=null;rows=[];selected.clear();inspection=null;$('sourceInfo').textContent='لا يوجد مصدر مفتوح.';for(const id of ['schoolStats','countTable','reviewList'])$(id).innerHTML='';$('qualityMessage').textContent='';$('backupFile').value='';for(const k of ['authorizedImport','keepBackup'])$(k).checked=false;status('');availability()}
function explicitSchool(row){
 const s=norm(row.school_code||row.school||'').toLowerCase();
 if(['p31','ابتدائيه 31','الابتدائية 31'].includes(s))return 'p31';
 if(['m34','متوسطه 34','المتوسطة 34'].includes(s))return 'm34';
 return '';
}
function gradeSchool(row){
 const grade=norm(row.grade||'').toLowerCase();
 if(!grade)return '';
 if(/مت(?:و|ي)سط/.test(grade)||/(?:^| )(?:اول|ثاني|ثالث) م(?:ت|$)/.test(grade)||/^[123]م$/.test(grade))return 'm34';
 if(/ابتدا(?:ئي|ي)/.test(grade)||/(?:^|\s)(?:رابع|خامس|سادس)(?:$|\s)/.test(grade))return 'p31';
 if(/^[456]$/.test(grade))return 'p31';
 const classlike=grade.match(/^[1-9]\s*\/\s*([1-6])$/);
 if(classlike&&Number(classlike[1])>=4)return 'p31';  // malformed old grade, see quality message
 return '';
}
function compoundName(row){return /[\/／]/.test(String(row?.name??''))}
function nameKey(row){return norm(row.name??'').toLowerCase()}
function analyze(db){
 rows=[];selected.clear();const known=new Map();
 // Phase 1: infer from explicit code or grade; never infer middle/primary from ambiguous class "١/٣".
 for(const [cat,label] of Object.entries(LABELS))for(const [index,data] of (db[cat]||[]).entries()){
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error('سجل غير صالح في '+label+' رقم '+(index+1));
  const explicit=explicitSchool(data),fromGrade=gradeSchool(data);
  const mismatched=explicit&&fromGrade&&explicit!==fromGrade;
  const school=mismatched?'':explicit||fromGrade;
  const row={key:cat+':'+index,cat,index,data,school,reason:mismatched?'تعارض رمز المدرسة مع المرحلة':school?'':'لا توجد مرحلة دراسية واضحة',multi:compoundName(data)};
  rows.push(row);
  const name=nameKey(data);
  // Restrict name matching to non-compound names of at least three words.
  if(school&&!row.multi&&name.split(' ').length>=3){
    if(!known.has(name))known.set(name,new Set());
    known.get(name).add(school);
  }
 }
 // Phase 2: attempt conservative match by full name across known-grade records.
 for(const item of rows){
  if(item.school||item.multi)continue;
  const name=nameKey(item.data),matched=known.get(name);
  if(matched?.size===1){item.school=[...matched][0];item.reason='الاسم الكامل مطابق لسجل محدد المرحلة'}
 }
 inspection={
   counts:Object.fromEntries(Object.keys(LABELS).map(k=>[k,rows.filter(r=>r.cat===k).length])),
   total:rows.length,
   multi:rows.filter(r=>r.multi).length,
   missing:rows.filter(r=>!r.school).length,
   invalidGrade:rows.filter(r=>r.school==='p31'&&/^[1-9]\s*\/\s*[4-6]$/.test(norm(r.data.grade||''))).length
 };
}
function assigned(r){return selected.get(r.key)||r.school||''}
function render(){
 if(!inspection)return;
 const p=rows.filter(x=>assigned(x)==='p31').length,m=rows.filter(x=>assigned(x)==='m34').length,u=inspection.total-p-m;
 $('schoolStats').innerHTML=[['السجلات كلها',inspection.total],['الابتدائية ٣١',p],['المتوسطة ٣٤',m],['بانتظار تحديد المدرسة',u]].map(([t,v])=>'<div><small>'+esc(t)+'</small><b>'+v+'</b></div>').join('');
 $('countTable').innerHTML='<table><thead><tr><th>القسم</th><th>الإجمالي</th><th>الابتدائية</th><th>المتوسطة</th><th>غير محدد</th></tr></thead><tbody>'+Object.entries(LABELS).map(([key,label])=>{
 const a=rows.filter(r=>r.cat===key);return '<tr><td>'+esc(label)+'</td><td>'+a.length+'</td><td>'+a.filter(r=>assigned(r)==='p31').length+'</td><td>'+a.filter(r=>assigned(r)==='m34').length+'</td><td>'+a.filter(r=>!assigned(r)).length+'</td></tr>'
 }).join('')+'</tbody></table>';
 const review=rows.filter(r=>!r.school||r.reason.startsWith('تعارض'));
 $('reviewList').innerHTML=review.length?'<table><thead><tr><th>القسم والسجل</th><th>الصف المدخل</th><th>المدرسة الصحيحة</th></tr></thead><tbody>'+review.map(r=>'<tr><td>'+esc(LABELS[r.cat])+' — '+esc(r.data.name||r.data.type||('سجل '+(r.index+1)))+'<small>'+esc(r.reason)+'</small></td><td>'+esc(r.data.grade||'غير مدخل')+'</td><td><select data-assign="'+esc(r.key)+'"><option value="">اختيار مطلوب</option><option value="p31" '+(assigned(r)==='p31'?'selected':'')+'>الابتدائية ٣١</option><option value="m34" '+(assigned(r)==='m34'?'selected':'')+'>المتوسطة ٣٤</option></select></td></tr>').join('')+'</tbody></table>':'<p>تم تحديد مدرسة جميع السجلات.</p>';
 $('qualityMessage').textContent=[inspection.multi?('يوجد '+inspection.multi+' سجلًا بأسماء مركبة أو متعددة؛ تُحفظ كما وردت في الأرشيف ولا تُنشأ منها هوية طالبة واحدة.'):'',inspection.invalidGrade?('يوجد '+inspection.invalidGrade+' سجلًا وضع رقم الفصل في حقل الصف؛ تحتاج مراجعة الصف دون تغيير الأصل.'):''].filter(Boolean).join(' ');
 availability();
}
function availability(){
 const count=rows.filter(r=>!assigned(r)).length;
 const cloudReady=CloudClient.ready(),logged=!!CloudClient.user(),approved=CloudClient.allowLegacyImport?.()===true;
 const consent=$('authorizedImport').checked,backup=$('keepBackup').checked;
 $('transfer').disabled=loading||!inspection||!inspection.total||count>0||!cloudReady||!logged||!approved||!consent||!backup;
 $('cloudInfo').textContent=!cloudReady?'إعداد Firebase غير مكتمل.':
   !logged?'لا توجد جلسة Firebase معتمدة في هذه الصفحة. افتحي البرنامج وسجلي الدخول ثم عودي لأداة الترحيل.':
   !approved?'هذا الرابط مخصص للفحص فقط. لنقل البيانات يلزم نشر التطبيق على Firebase Hosting بعنوان مستقل، ثم تسجيل الدخول والتأكد من التصريح.':
   count?'حددي مدرسة كل سجل غير واضح قبل الاستيراد ('+count+' سجلات).':
   !consent||!backup?'أقري بوجود تصريح من الجهة المسؤولة وبقاء نسخة احتياطية آمنة، حتى يتاح زر النقل.':
   'جاهز للنقل بعد التأكيد النهائي. ستُرسل السجلات إلى Firestore؛ قد يتعذر التراجع دون إجراء إداري منفصل.';
}
function validate(json){
 const db=json?.db??json;
 if(!db||typeof db!=='object'||Array.isArray(db))throw Error('بنية JSON غير صحيحة.');
 let recognized=0;
 for(const k of Object.keys(LABELS)){
   if(db[k]!==undefined&&!Array.isArray(db[k]))throw Error('القسم '+k+' ليس قائمة.');
   if(Array.isArray(db[k]))recognized++;
 }
 if(!recognized)throw Error('الملف ليس نسخة نظام الموجّهة المعروفة.');
 return db;
}
function openSource(data,origin){
 const db=validate(data);analyze(db);
 if(!inspection.total)throw Error('هذا المصدر لا يحتوي سجلات.');
 source=db;
 $('sourceInfo').textContent='المصدر: '+origin+' | عدد الأقسام في النسخة: '+Object.keys(LABELS).filter(k=>Array.isArray(db[k])).length+' / ١١ | إجمالي السجلات: '+inspection.total;
 render();status('تم الفحص محليًا، دون إرسال البيانات إلى السحابة أو تعديل الأصل.');
}
$('checkOld').onclick=()=>{try{const raw=localStorage.getItem('student_guidance_unified_v2');if(!raw)throw Error('لا توجد بيانات للنسخة القديمة في مساحة هذا المتصفح. استخدمي ملف JSON الاحتياطي.');openSource(JSON.parse(raw),'التخزين المحلي للبرنامج القديم (قراءة فقط)')}catch(err){clear();status('تعذر الفحص: '+err.message)}};
$('backupFile').onchange=async ev=>{const f=ev.target.files?.[0];if(!f)return;try{if(f.size>25*1024*1024)throw Error('الملف أكبر من ٢٥ ميجابايت، ويلزم فحصه بطريقة أخرى.');openSource(JSON.parse(await f.text()),f.name)}catch(err){clear();status('تعذر قراءة النسخة: '+err.message)}};
$('reviewList').addEventListener('change',ev=>{const key=ev.target.dataset?.assign;if(!key)return;const val=ev.target.value;if(val!=='p31'&&val!=='m34')selected.delete(key);else selected.set(key,val);render()});
$('clearPreview').onclick=clear;
async function idFor(text){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));const n=new Uint8Array(hash).slice(0,16);n[6]=(n[6]&15)|80;n[8]=(n[8]&63)|128;const h=Array.from(n).map(x=>x.toString(16).padStart(2,'0')).join('');return [h.slice(0,8),h.slice(8,12),h.slice(12,16),h.slice(16,20),h.slice(20)].join('-')}
async function prepare(owner){
 const students=[],records=[],entries=[],studentIds=new Map(),frequencies=new Map(),time=new Date().toISOString();
 for(const r of rows){const k=r.cat+'|'+String(r.data.id??'');frequencies.set(k,(frequencies.get(k)||0)+1)}
 for(const r of rows){
  const school=assigned(r);
  if(!school)throw Error('توجد سجلات لم تُحدد مدرستها.');
  const item=r.data,name=String(item.name||'').trim(),
    grade=String(item.grade||'').trim(),cls=String(item.classroom||item.class_name||'').trim();
  // Only confidently identified names become a student profile. Short/multiple names
  // stay verbatim in the archive and entry — no accidental student merging.
  let studentId=null;
  if(name&&!r.multi&&r.cat!=='events'&&norm(name).split(' ').length>=3&&grade){
    const key=[school,nameKey(item),norm(grade),norm(cls)].join('|');
    if(!studentIds.has(key)){
      const id=await idFor('guidance-v2-student|'+key);
      studentIds.set(key,id);
      students.push({id,owner_id:owner,school_code:school,name,grade,
        class_name:cls||'غير محدد',updated_at:time,revision:1,is_deleted:false});
    }
    studentId=studentIds.get(key);
  }
  const k=r.cat+'|'+String(item.id??'');
  const stable=item.id!==undefined&&item.id!==null&&frequencies.get(k)===1;
  const identifier=stable?'source-id|'+String(item.id):'content-and-position|'+r.index+'|'+JSON.stringify(item);
  const id=await idFor('guidance-v2-archive|'+school+'|'+r.cat+'|'+identifier);
  const base={id,owner_id:owner,school_code:school,category:r.cat,student_id:studentId,
    student_name:name,grade,class_name:cls,source_key:id,source_index:r.index,
    source_id:String(item.id??''),event_date:/^\d{4}-\d{2}-\d{2}$/.test(String(item.date||''))?item.date:null,
    raw_data:item,updated_at:time,revision:1,is_deleted:false};
  records.push(base);
  const detail=[item.type,item.reason,item.notes].filter(x=>String(x||'').trim()).map(String).join(' — ');
  const detail2=[item.result,item.lives&&('المعيشة: '+item.lives),item.level&&('الأهمية: '+item.level),
    item.status&&('الحالة الأصلية: '+item.status),item.follow&&('متابعة: '+item.follow)]
    .filter(x=>String(x||'').trim()).map(String).join(' — ');
  const currentStatus=['مفتوحة','مغلقة'].includes(item.status)?item.status:'غير محددة';
  entries.push({
    id:await idFor('guidance-v2-entry|'+id),owner_id:owner,school_code:school,
    student_id:studentId,student_name:name,type:LABELS[r.cat],
    date:base.event_date||'',status:currentStatus,notes:detail,action_note:detail2,
    source_legacy_id:id,updated_at:time,revision:1,is_deleted:false
  });
 }
 return {students,records,entries};
}
$('transfer').onclick=async()=>{
 if(loading||!source||!inspection||rows.some(r=>!assigned(r)))return;
 if(!$('authorizedImport').checked||!$('keepBackup').checked){
   status('لم يجر أي نقل؛ يلزم إقرار التصريح وحفظ نسخة احتياطية أولًا.');availability();return;
 }
 if(!CloudClient.allowLegacyImport?.()){
   status('لم يجر أي نقل؛ الحساب غير جاهز أو غير مصرح بالاستيراد.');availability();return;
 }
 const session=await CloudClient.ensureSession();
 if(!session){status('جلسة الدخول غير نشطة؛ لم تُنقل سجلات.');availability();return}
 const expectedCount=inspection.total;
 if(!confirm('تنبيه: هل تؤكدين وجود تفويض من الجهة التعليمية لحفظ بيانات الطالبات على Firebase، وأن عدد '+expectedCount+' سجلاً وتصنيف المدرستين صحيحان، ولديك نسخة احتياطية منفصلة؟ سيجري رفع بيانات حساسة إلى السحابة عند الموافقة.'))return;
 loading=true;availability();
 try{
   const payload=await prepare(session.user.id);
   status('عدد السجلات الأصلية '+expectedCount+'. تجهيز '+payload.students.length+' ملفات طالبات و'+payload.records.length+' سجلات أصلية.');
   const confirmed={userConfirmed:true};
   // Import archive first, followed by display entries, then confident student profiles.
   const parts=[['legacy_records',payload.records,'الأرشيف الأصلي'],
     ['entries',payload.entries,'السجلات المصنفة'],['students',payload.students,'ملفات الطالبات']];
   for(const [table,items,label] of parts){
     const stats=await CloudClient.insertManyIfMissing(table,items,15,
       (n,counts)=>status(label+': '+n+'/'+items.length+' | جديد: '+counts.inserted+' | موجود سابقاً: '+counts.existing),
       confirmed);
     status(label+': تم التحقق من رفع '+stats.total+' سجلًا (جديد: '+stats.inserted+' / موجود: '+stats.existing+').');
   }
   const archive=await CloudClient.fetchAll('legacy_records');
   const display=await CloudClient.fetchAll('entries');
   const aIds=new Set(archive.map(x=>x.id)),dIds=new Set(display.map(x=>x.id));
   const missingA=payload.records.filter(x=>!aIds.has(x.id));
   const missingD=payload.entries.filter(x=>!dIds.has(x.id));
   if(missingA.length||missingD.length)throw Error('التحقق غير مكتمل: سجلات الأرشيف الناقصة '+missingA.length+'، والمدخلات الناقصة '+missingD.length);
   status('اكتمل النقل والتحقق: '+payload.records.length+' سجلًا أصليًا و'+payload.entries.length+' سجلًا معروضًا، مع '+payload.students.length+' ملف طالبة مؤكد الاسم. لا تحذفي النسخة القديمة قبل اختبار الأجهزة الأربعة والتقارير.');
 }catch(err){
   status('لم يكتمل النقل بالكامل: '+err.message+'؛ احتفظي بالمصدر. إعادة المحاولة لا تستبدل السجلات الموجودة وتمنع التكرار.');
 }finally{loading=false;availability()}
};
$('authorizedImport').addEventListener('change',availability);
$('keepBackup').addEventListener('change',availability);
// Firebase Auth restores an existing session on this separate page. It must be
// initialized before deciding whether to allow transferring any records.
CloudClient.ensureSession().then(availability).catch(()=>availability());

availability();
})();