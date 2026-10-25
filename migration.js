'use strict';
(() => {
const CATEGORY={daily:'المواقف اليومية الطارئة',attendance:'الغياب والمواظبة',behavior:'المخالفات والسلوك',health:'الحالات الصحية',social:'الحالات الاجتماعية',material:'الحالات المادية',events:'البرامج والفعاليات',guardians:'أولياء الأمور',followup:'المحتاجات للمتابعة',honor:'تكريم الطالبات',academic:'التحصيل الدراسي'};
const $=id=>document.getElementById(id), e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let source=null, origin='', report=null, importInProgress=false;
function clean(){source=null;report=null;origin='';$('sourceInfo').textContent='تم مسح المعاينة من الذاكرة. لم تُغيّر بيانات التطبيق القديم.';$('countTable').replaceChildren();$('progress').textContent='';$('backupFile').value='';$('transfer').disabled=true}
function status(s){$('progress').textContent=s}
function normalize(obj,where){
  const db=obj?.db??obj;
  if(!db||typeof db!=='object'||Array.isArray(db))throw Error('الملف غير صالح أو لا يحتوي قاعدة بيانات التطبيق');
  const valid=Object.keys(CATEGORY).filter(k=>Array.isArray(db[k]));
  if(valid.length===0)throw Error('لا توجد أقسام معروفة في هذا المصدر. الملف ليس نسخة الموجّهة المعتمدة.');
  for(const key of Object.keys(CATEGORY))if(db[key]!==undefined&&!Array.isArray(db[key]))throw Error('القسم '+key+' ليس قائمة بيانات صالحة');
  const counts=Object.fromEntries(Object.keys(CATEGORY).map(k=>[k,(db[k]||[]).length]));
  const total=Object.values(counts).reduce((a,b)=>a+b,0);
  return {db,counts,total,sections:valid.length,where};
}
function preview(){
 const rows=Object.entries(CATEGORY).map(([k,name])=>'<tr><td>'+e(name)+'</td><td>'+report.counts[k]+'</td></tr>').join('');
 $('sourceInfo').textContent='المصدر: '+origin+'\nالأقسام الموجودة: '+report.sections+' / ١١\nعدد السجلات الكلي: '+report.total;
 $('countTable').innerHTML='<table><thead><tr><th>القسم</th><th>عدد السجلات</th></tr></thead><tbody>'+rows+'<tr><th>الإجمالي</th><th>'+report.total+'</th></tr></tbody></table>';
 availability();
}
function availability(){
 const ok=CloudClient.ready()&&!!CloudClient.user();
 $('transfer').disabled=!ok||!report||!report.total||!$('targetSchool').value||importInProgress;
 $('cloudInfo').textContent=!CloudClient.ready()?'النقل السحابي معطل: لم تُعتمد استضافة/تهيئة سحابية بعد. تظل معاينة الأعداد متاحة.':!CloudClient.user()?'المزامنة مجهّزة لكن تسجيل الدخول غير مكتمل. افتحي التطبيق الجديد وسجّلي الدخول أولًا.':'حساب متصل. لا تبدأي النقل إلا بعد مراجعة الأعداد والصلاحيات واعتماد مكان التخزين.';
}
$('checkOld').onclick=()=>{
 try{
  const txt=localStorage.getItem('student_guidance_unified_v2');
  if(!txt)throw Error('لا توجد سجلات في تخزين هذا المتصفح. جرّبي ملف النسخة الاحتياطية من الجهاز الذي يحتوي السجلات.');
  const parsed=JSON.parse(txt); const p=normalize(parsed,'تخزين المتصفح القديم (قراءة فقط)');
  if(p.total===0)throw Error('المصدر يحتوي صفر سجلات. لن ننقل نسخة فارغة فوق أي بيانات.');
  source=parsed;report=p;origin=p.where;preview();status('تم الفحص فقط؛ لم يُجر أي نسخ أو تعديل.');
 }catch(err){clean();status('تعذر فحص التخزين: '+err.message)}
};
$('backupFile').onchange=async ev=>{
 const f=ev.target.files?.[0];if(!f)return;
 try{
  if(f.size>25*1024*1024)throw Error('الملف كبير جدًا للفحص المباشر (>25 MB).');
  const parsed=JSON.parse(await f.text());const p=normalize(parsed,'ملف النسخة الاحتياطية المختار');
  if(!p.total)throw Error('الملف يحتوي صفر سجلات؛ النقل ممنوع.');
  source=parsed;report=p;origin=f.name;preview();status('فُحص الملف محليًا ولم يُرفع إلى أي خادم.');
 }catch(err){clean();status('تعذر قراءة الملف: '+err.message)}
};
$('targetSchool').addEventListener('change',availability);$('clearPreview').onclick=clean;
async function makeId(str){const b=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str)));const h=Array.from(b).map(v=>v.toString(16).padStart(2,'0')).join('');const p=Array.from(b.slice(0,16));p[6]=(p[6]&15)|80;p[8]=(p[8]&63)|128;const hex=p.map(v=>v.toString(16).padStart(2,'0')).join('');return {id:[hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20,32)].join('-'),hash:h}}
const canon=x=>String(x??'').trim().replace(/\s+/g,' ');
const isDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)?x:null;
async function transform(db,school,owner){
 const students=[],records=[],ids=new Map(),stamp=new Date().toISOString();
 const nameKeys=new Map();
 for(const [category,rows] of Object.entries(CATEGORY)){
  const idFrequency=new Map();
  for(const row of (db[category]||[])){
    if(row?.id!==undefined&&row?.id!==null){const k=String(row.id);idFrequency.set(k,(idFrequency.get(k)||0)+1)}
  }
  for(const [i,row] of (db[category]||[]).entries()){
   if(!row||typeof row!=='object'||Array.isArray(row))throw Error('سجل غير صالح في '+rows+' رقم '+(i+1));
   const name=category==='events'?'':canon(row.name),grade=canon(row.grade),className=canon(row.classroom||row.class_name);
   let studentId=null;
   if(name){
    const key=[school,name,grade,className].join('|');
    if(!nameKeys.has(key)){
      const u=await makeId('student-guidance-legacy-student|'+key);
      nameKeys.set(key,u.id);
      students.push({id:u.id,owner_id:owner,school_code:school,name,grade:grade||'غير محدد',class_name:className||'غير محدد',updated_at:stamp,is_deleted:false});
    }studentId=nameKeys.get(key);
   }
   const original=JSON.stringify(row);
   const stableId=row.id!==undefined&&row.id!==null&&String(row.id)!==''&&idFrequency.get(String(row.id))===1;
   const provenance=stableId?'old-id|'+String(row.id):'fallback|'+i+'|'+original;
   const u=await makeId('student-guidance-legacy-row|'+school+'|'+category+'|'+provenance);
   records.push({id:u.id,owner_id:owner,school_code:school,category,student_id:studentId,student_name:name,grade,class_name:className,source_key:u.hash,source_index:i,source_id:String(row.id??''),event_date:isDate(row.date),raw_data:row,updated_at:stamp,is_deleted:false});
  }
 }
 return {students,records};
}
$('transfer').onclick=async()=>{
 if(importInProgress||!source||!report||!report.total)return;
 const school=$('targetSchool').value;if(!school)return;
 const session=await CloudClient.ensureSession();
 if(!session||!CloudClient.ready()){status('المزامنة غير متصلة؛ لم تُنقل أي بيانات.');availability();return}
 const schoolLabel=school==='p31'?'الابتدائية ٣١':'المتوسطة ٣٤';
 if(!confirm('ستُنقل '+report.total+' سجلات إلى حساب الموجّهة في '+schoolLabel+'. تأكدي أنها تخص هذه المدرسة حصريًا. متابعة؟'))return;
 importInProgress=true;availability();
 try{
 const {students,records}=await transform(source.db||source,school,session.user.id);
 status('تم التحضير: '+students.length+' طالبة و'+records.length+' سجل أصلي. جارٍ النقل...');
 await CloudClient.insertManyIfMissing('students',students,50,completed=>status('تم إرسال '+completed+' / '+students.length+' من ملفات الطالبات'));
 await CloudClient.insertManyIfMissing('legacy_records',records,25,completed=>status('تم إرسال '+completed+' / '+records.length+' من السجلات الأصلية'));
 const remoteStudents=await CloudClient.fetchAll('students'),remoteRecords=await CloudClient.fetchAll('legacy_records');
 const got=new Set(remoteRecords.map(x=>x.id)),missing=records.filter(x=>!got.has(x.id));
 if(missing.length)throw Error('التحقق كشف '+missing.length+' سجلات غير موجودة على الخادم. أعيدي المحاولة دون حذف المصدر.');
 status('✓ النقل اكتمل وتأكدنا من وجود '+records.length+' سجلًا أصليًا في الخادم ضمن أرشيف مستقل، مع '+students.length+' ملف طالبة مُحَضّر.\nاحتفظي بالنسخة القديمة والملف الاحتياطي حتى اختبار العرض والتقارير على جهاز آخر.');
 }catch(err){status('النقل لم يكتمل: '+err.message+'\nلا تحذفي بيانات المصدر. يمكن إعادة المحاولة بعد معالجة السبب، والتكرار محدود بمعرّفات ثابتة.')}
 finally{importInProgress=false;availability()}
};
availability();
})();
