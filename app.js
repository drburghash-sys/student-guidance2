'use strict';
const types=['المواقف اليومية الطارئة','الغياب والمواظبة','المخالفات والسلوك','الحالات الصحية','الحالات الاجتماعية','الحالات المادية','البرامج والفعاليات','التواصل مع أولياء الأمور','الطالبات المحتاجات للمتابعة','تكريم الطالبات','التحصيل الدراسي'];
const icons=['◈','◷','⚑','✚','♡','◇','✦','✉','◎','★','▥'];
const fbcfg=window.GUIDANCE_FIREBASE||{},dbName=CloudClient.ready()?'guidance-firebase-demo-'+fbcfg.projectId+'-'+fbcfg.allowedUid:'guidance-v2-demo-2026',tables=['students','entries','tasks','legacy_records'];let db,state={students:[],entries:[],tasks:[],legacy_records:[],school:'p31',page:'home'},formContext={kind:null,id:null};let busy=false,realtimeStarted=false;
const $=x=>document.getElementById(x),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stamp=()=>new Date().toISOString(),today=()=>new Date().toLocaleDateString('en-CA'),uuid=()=>crypto.randomUUID(),schoolName=s=>s==='p31'?'الابتدائية ٣١':'المتوسطة ٣٤';
function notify(t){$('toast').textContent=t;$('toast').style.display='block';clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('toast').style.display='none',3300)}
function startDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(dbName,2);req.onupgradeneeded=()=>{const d=req.result;for(const name of [...tables,'queue','meta'])if(!d.objectStoreNames.contains(name))d.createObjectStore(name,{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
function tx(store,mode='readonly'){return db.transaction(store,mode).objectStore(store)}
function all(name){return new Promise((ok,no)=>{const q=tx(name).getAll();q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
function get(name,id){return new Promise((ok,no)=>{const q=tx(name).get(id);q.onsuccess=()=>ok(q.result);q.onerror=()=>no(q.error)})}
function put(name,v){return new Promise((ok,no)=>{const q=tx(name,'readwrite').put(v);q.onsuccess=()=>ok(v);q.onerror=()=>no(q.error)})}
function remove(name,id){return new Promise((ok,no)=>{const q=tx(name,'readwrite').delete(id);q.onsuccess=()=>ok();q.onerror=()=>no(q.error)})}
async function refresh(){
 if(CloudClient.ready()&&!CloudClient.user()){for(const t of tables)state[t]=[];render();return}
 for(const t of tables)state[t]=await all(t);
 render();
}
async function save(table,entity,queue=true){
 if(CloudClient.ready()&&!CloudClient.user())throw new Error('يجب تسجيل الدخول قبل الحفظ');
 entity.updated_at=stamp();
 await put(table,entity);
 if(queue&&CloudClient.ready())await put('queue',{id:uuid(),table,entity:{...entity},created_at:stamp()});
 await refresh();
 if(CloudClient.ready()&&navigator.onLine)void syncCloud();
}
async function seedDemo(){if(CloudClient.ready()||(await get('meta','seed'))?.yes)return;const a={id:uuid(),school_code:'p31',name:'طالبة تجريبية أ',grade:'الخامس',class_name:'١',updated_at:stamp(),is_deleted:false};const b={id:uuid(),school_code:'m34',name:'طالبة تجريبية ب',grade:'الثالث متوسط',class_name:'٢',updated_at:stamp(),is_deleted:false};await put('students',a);await put('students',b);await put('entries',{id:uuid(),school_code:'p31',student_id:a.id,type:types[0],date:today(),status:'مفتوحة',notes:'موقف وهمي لغرض التجربة فقط',action_note:'تجربة آلية المتابعة',updated_at:stamp(),is_deleted:false});await put('tasks',{id:uuid(),school_code:'p31',title:'مراجعة واجهة النسخة التجريبية',due_date:today(),done:false,updated_at:stamp(),is_deleted:false});await put('meta',{id:'seed',yes:true})}
const live=table=>state[table].filter(x=>!x.is_deleted&&x.school_code===state.school);const byId=id=>state.students.find(s=>s.id===id)?.name||'غير مسجلة';
function navigate(page){state.page=page;document.querySelectorAll('.page').forEach(el=>el.classList.toggle('hidden',el.id!==page));document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('selected',b.dataset.page===page));render()}
function card(title,meta='',buttons=''){return `<article class="list-card"><div><h3>${title}</h3><div class="meta">${meta}</div></div><div class="buttons">${buttons}</div></article>`}
function render(){const students=live('students'),entries=live('entries'),tasks=live('tasks');$('stats').innerHTML=[['الطالبات',students.length],['متابعات مفتوحة',entries.filter(x=>x.status==='مفتوحة').length],['مواقف وسجلات',entries.length],['مهام غير منتهية',tasks.filter(x=>!x.done).length]].map(([k,v])=>`<div class="stat"><small>${k}</small><strong>${v}</strong></div>`).join('');$('modules').innerHTML=types.map((name,i)=>`<button class="module" data-type="${i}"><span class="emoji">${icons[i]}</span><b>${name}</b><small>${entries.filter(x=>x.type===name).length} سجل</small></button>`).join('');$('recent').innerHTML=entries.slice().sort((a,b)=>b.updated_at.localeCompare(a.updated_at)).slice(0,4).map(e=>entryCard(e)).join('')||empty('لا توجد سجلات بعد');renderStudents();renderEntries();renderTasks();renderReports();renderLegacy();renderSyncInfo()}
function empty(t){return `<div class="empty">${esc(t)}</div>`}
function studentCard(s){const count=live('entries').filter(e=>e.student_id===s.id).length;return card(esc(s.name),`${esc(s.grade)} • فصل ${esc(s.class_name)} • ${count} سجلات`,`<button data-profile="${s.id}">الملف</button><button data-edit="students:${s.id}">تعديل</button>`)}
function renderStudents(){const school=live('students'),grades=[...new Set(school.map(x=>x.grade))].sort();const old=$('studentGrade').value;$('studentGrade').innerHTML='<option value="">كل الصفوف</option>'+grades.map(g=>`<option value="${esc(g)}">${esc(g)}</option>`).join('');$('studentGrade').value=grades.includes(old)?old:'';const term=$('studentSearch').value.trim().toLowerCase(),grade=$('studentGrade').value;const filtered=school.filter(x=>(!grade||x.grade===grade)&&(`${x.name} ${x.grade} ${x.class_name}`.toLowerCase().includes(term)));$('studentList').innerHTML=filtered.map(studentCard).join('')||empty('لا توجد طالبات مطابقة')}
function showProfile(id){const s=state.students.find(x=>x.id===id);if(!s)return;const records=live('entries').filter(x=>x.student_id===id).sort((a,b)=>b.date.localeCompare(a.date));$('studentProfile').classList.remove('hidden');$('studentProfile').innerHTML=`<h2>الملف الموحّد: ${esc(s.name)}</h2><p>${schoolName(s.school_code)} • ${esc(s.grade)} • الفصل ${esc(s.class_name)}</p><div class="actions"><button class="secondary" data-edit="students:${s.id}">تعديل البيانات</button><button class="primary" data-newrecord="${s.id}">إضافة متابعة</button><button class="secondary" data-closeprofile="1">إغلاق الملف</button></div>${records.map(entryCard).join('')||empty('لا توجد سجلات للطالبة')}`}
function entryCard(e){const name=e.student_name||byId(e.student_id);return card(esc(e.type),`${esc(e.date)} • ${esc(name)} • <span class="pill ${e.status==='مفتوحة'?'open':e.status==='مغلقة'?'done':''}">${esc(statusFor(e))}</span><div><b>الموضوع:</b> ${esc(subjectFor(e))}</div><div><b>الإجراء:</b> ${esc(actionFor(e)||'لم يُدوّن إجراء')}</div>`, `<button data-edit="entries:${e.id}">تعديل</button><button data-toggleentry="${e.id}">${e.status==='مفتوحة'?'إغلاق':e.status==='مغلقة'?'إعادة فتح':'تحديد حالة المتابعة'}</button>`)}
function renderEntries(){const term=$('recordSearch').value.toLowerCase(),type=$('recordType').value,status=$('recordStatus').value;const entries=live('entries').filter(x=>(!type||x.type===type)&&(!status||x.status===status)&&(`${subjectFor(x)} ${detailsFor(x)} ${actionFor(x)} ${x.type} ${x.student_name||byId(x.student_id)}`.toLowerCase().includes(term))).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));$('recordList').innerHTML=entries.map(entryCard).join('')||empty('لا توجد نتائج')}
function renderTasks(){const tasks=live('tasks').slice().sort((a,b)=>(a.done-b.done)||a.due_date.localeCompare(b.due_date));$('taskList').innerHTML=tasks.map(t=>card(esc(t.title),`${esc(t.due_date)} • <span class="pill ${t.done?'done':'open'}">${t.done?'منتهية':'قيد التنفيذ'}</span>`,`<button data-toggletask="${t.id}">${t.done?'إعادة فتح':'إنجاز'}</button><button data-edit="tasks:${t.id}">تعديل</button>`)).join('')||empty('لا توجد مهام')}
function reportData(){
 const from=$('fromDate').value,to=$('toDate').value,type=$('reportType').value,status=$('reportStatus').value;
 return live('entries').filter(x=>(!from||x.date>=from)&&(!to||x.date<=to)&&(!type||x.type===type)&&(!status||x.status===status)).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))
}
// Imported records are immutable in legacy_records. Existing Firestore entries
// are enhanced for printing without a second import or overwriting student data.
function originalFor(e){return e.source_legacy_id
 ? state.legacy_records.find(x=>x.id===e.source_legacy_id):null}
function subjectFor(e){
 if(String(e.subject||'').trim())return String(e.subject).trim();
 const legacy=originalFor(e);
 if(legacy){
   const r=legacy.raw_data||{};
   return [r.type,r.reason].filter(x=>String(x||'').trim()).map(String).join(' — ') || 'لم يُسجّل موضوع الحالة';
 }
 return String(e.notes||'').trim()||'لم يُسجّل موضوع الحالة';
}
function detailsFor(e){
 if(e.details_override!==undefined)return String(e.details_override||'').trim();
 const legacy=originalFor(e);
 if(legacy){
  const r=legacy.raw_data||{};
  const pieces=[];
  // 'notes' in daily legacy records commonly describe an action rather than
  // symptoms; display in action column with attribution, not twice here.
  if(legacy.category!=='daily'&&r.notes)pieces.push(String(r.notes));
  if(r.lives)pieces.push('الإقامة: '+r.lives);
  if(r.level)pieces.push('درجة الأهمية: '+r.level);
  if(r.follow)pieces.push('تحتاج متابعة: '+r.follow);
  return pieces.join(' — ');
 }
 return String(e.notes||'').trim();
}
function actionFor(e){
 if(e.action_taken!==undefined)return String(e.action_taken||'').trim();
 const legacy=originalFor(e);
 if(legacy){
  const r=legacy.raw_data||{};
  if(legacy.category==='guardians'&&r.result)return String(r.result);
  if(legacy.category==='material'&&r.status)return 'النتيجة المدونة: '+r.status;
  if(legacy.category==='daily'&&r.notes)return 'ورد في ملاحظات السجل القديم: '+r.notes;
  return '';
 }
 return String(e.action_note||'').trim();
}
function statusFor(e){
 return e.status==='مفتوحة'||e.status==='مغلقة'?e.status:'لم تُوثّق حالة المتابعة';
}
function reportHTML(){
 const entries=reportData(),showNames=$('showNames').checked;
 const groups=types.map(t=>[t,entries.filter(e=>e.type===t).length]).filter(x=>x[1]);
 const max=Math.max(...groups.map(x=>x[1]),1);
 const unknown=entries.filter(e=>!['مفتوحة','مغلقة'].includes(e.status)).length;
 const head='<th>م</th><th>التاريخ</th><th>القسم</th>'+(showNames?'<th>اسم الطالبة</th>':'')+
   '<th>موضوع الحالة</th><th>التفاصيل والملاحظات</th><th>الإجراء المتخذ أو الموثق</th><th>حالة المتابعة</th>';
 const contents=entries.map((e,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(e.date||'—')+'</td><td>'+esc(e.type)+
   '</td>'+(showNames?'<td>'+esc(e.student_name||byId(e.student_id))+'</td>':'')+
   '<td>'+esc(subjectFor(e))+'</td><td>'+esc(detailsFor(e)||'—')+
   '</td><td>'+esc(actionFor(e)||'لم يُدوّن إجراء')+'</td><td>'+esc(statusFor(e))+'</td></tr>').join('');
 return '<article class="report-sheet"><header><div>وزارة التعليم — سجل إرشادي (للاستخدام المصرح به)</div><h2>'+schoolName(state.school)+
   '</h2><div>تقرير الموجّهة الطلابية • '+esc(today())+'</div></header><p><b>إجمالي السجلات:</b> '+entries.length+
   ' • <b>متابعات مفتوحة:</b> '+entries.filter(x=>x.status==='مفتوحة').length+
   ' • <b>متابعات مغلقة:</b> '+entries.filter(x=>x.status==='مغلقة').length+
   ' • <b>لم تُوثّق حالة المتابعة:</b> '+unknown+'</p>'+
   (unknown?'<p class="report-note">السجلات القديمة التي لم تُذكر فيها حالة المتابعة لا يمكن اعتبارها مفتوحة أو مغلقة تلقائيًا؛ راجعيها وحددي حالتها من صفحة السجلات.</p>':'')+
   '<div class="barchart">'+groups.map(([name,count])=>'<div class="barrow"><b>'+esc(name)+'</b><span class="bar" style="width:'+Math.round(count/max*60)+'%"></span><small>'+count+'</small></div>').join('')+
   '</div><div class="report-table-scroll"><table><thead><tr>'+head+'</tr></thead><tbody>'+(
   contents||'<tr><td colspan="'+(showNames?8:7)+'">لا توجد سجلات مطابقة</td></tr>')+
   '</tbody></table></div><footer><div>الموجّهة الطلابية: ____________</div><div>التوقيع: ____________</div></footer></article>';
}
function renderReports(){$('reportPreview').innerHTML=reportHTML()}
const legacyLabels={daily:'المواقف اليومية الطارئة',attendance:'الغياب والمواظبة',behavior:'المخالفات والسلوك',health:'الحالات الصحية',social:'الحالات الاجتماعية',material:'الحالات المادية',events:'البرامج والفعاليات',guardians:'أولياء الأمور',followup:'المحتاجات للمتابعة',honor:'تكريم الطالبات',academic:'التحصيل الدراسي'};
function renderLegacy(){
const box=$('legacyList');if(!box)return;
const categories=$('legacyCategory'),previous=categories.value;
categories.innerHTML='<option value="">جميع الأقسام</option>'+Object.entries(legacyLabels).map(([key,value])=>'<option value="'+esc(key)+'">'+esc(value)+'</option>').join('');
categories.value=previous in legacyLabels?previous:'';
const rows=live('legacy_records'),search=$('legacySearch').value.trim().toLowerCase();
const selected=rows.filter(r=>(!categories.value||r.category===categories.value)&&(!search||JSON.stringify(r.raw_data||{}).toLowerCase().includes(search)||String(r.student_name).toLowerCase().includes(search)));
$('legacySummary').textContent='سجلات الأرشيف في المدرسة الحالية: '+rows.length+' | المعروضة: '+selected.length;
box.innerHTML=selected.slice(0,300).map(r=>'<details class="panel"><summary><b>'+esc(legacyLabels[r.category]||r.category)+'</b> — '+esc(r.student_name||'سجل نشاط بدون طالبة')+' — '+esc(r.event_date||'')+'</summary><pre style="white-space:pre-wrap;overflow-wrap:anywhere;direction:rtl">'+esc(JSON.stringify(r.raw_data||{},null,2))+'</pre></details>').join('')||empty('لم تُنقل سجلات قديمة لهذه المدرسة بعد');
if(selected.length>300)box.innerHTML+='<p>يظهر أول ٣٠٠ سجل؛ استخدمي البحث لتضييق النتائج.</p>';
}

function renderSyncInfo(){
 const enabled=CloudClient.ready(),user=CloudClient.user(),
       uid=CloudClient.bootstrapUid?.(),status=$('syncStatus');
 status.textContent=!enabled?'Firebase غير مربوط':user?'Firebase • متصل'
   :uid?'بانتظار اعتماد UID':'الدخول بكلمة المرور';
 status.className='status '+(user?'online':enabled?'warn':'');
 $('cloudMessage').textContent=!enabled
   ?'لم يتم تهيئة Firebase بعد. نسخة تجريبية ببيانات وهمية فقط.'
   :user?'تم تسجيل الدخول إلى حساب Firebase التجريبي. لا تدخلي بيانات طالبات حقيقية.'
   :uid?'تم تسجيل الدخول بنجاح. يلزم ربط UID بحساب الموجّهة في قواعد Firestore قبل تفعيل المزامنة.'
   :'أدخلي بريد الحساب الذي أنشأتِه داخل Firebase Authentication وكلمة المرور الخاصة بهذا الحساب.';
 $('authBox').innerHTML=!enabled
   ?'<p class="note">الإعدادات السحابية غير مكتملة.</p>'
   :user?'<p class="note">المزامنة التجريبية مخصصة لحساب واحد فقط، وتعمل على الأجهزة الأربعة بعد اعتماد UID.</p>'
   :uid?'<div class="note"><p>رمز المستخدم (UID) لاعتماد الحساب:</p><code id="firebaseUid">'+esc(uid)+'</code><div class="actions"><button type="button" class="secondary" id="copyUid">نسخ UID</button></div><p>انسخي UID فقط، ولا تشاركي كلمة المرور.</p></div>'
   :'<form id="loginForm" class="toolbar"><input name="email" type="email" autocomplete="username" required placeholder="البريد الإلكتروني"><input name="password" type="password" autocomplete="current-password" required placeholder="كلمة مرور حساب التطبيق"><button type="submit" class="primary">تسجيل الدخول</button></form>';
 $('syncNow').disabled=!enabled||!user;
 $('signOut').disabled=!enabled||(!user&&!uid);
}

function input(name,title,val='',required=false,type='text'){return `<div class="field"><label for="f_${name}">${title}</label><input id="f_${name}" name="${name}" type="${type}" value="${esc(val)}" ${required?'required':''}></div>`}
function select(name,title,values,val='',required=false){return `<div class="field"><label for="f_${name}">${title}</label><select id="f_${name}" name="${name}" ${required?'required':''}>${values.map(([v,l])=>`<option value="${esc(v)}" ${v===val?'selected':''}>${esc(l)}</option>`).join('')}</select></div>`}
function textarea(name,title,val=''){return `<div class="field wide"><label for="f_${name}">${title}</label><textarea id="f_${name}" name="${name}">${esc(val)}</textarea></div>`}

// Arabic-insensitive partial search helps find an existing pupil without
// scrolling a native select through the entire school's student list.
function normalizeStudentName(value){
 return String(value||'').normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g,'')
  .replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه')
  .replace(/\s+/g,' ').trim().toLowerCase();
}
function studentPickerMarkup(selectedId=''){
 const selected=live('students').find(s=>s.id===selectedId);
 return '<div class="field wide student-picker" id="studentPicker"><label for="studentQuickSearch">ابحثي عن الطالبة بالاسم (تظهر النتائج بمجرد كتابة حروف)</label>'+
   '<input type="search" id="studentQuickSearch" autocomplete="off" placeholder="اكتبي أول حروف الاسم أو جزءًا منه" value="'+esc(selected?selected.name:'')+'">'+
   '<input id="f_student_id" type="hidden" name="student_id" value="'+esc(selectedId)+'">'+
   '<div id="selectedStudentLabel" class="student-selected" role="status">'+(selected?'الطالبة المختارة: '+esc(selected.name)+' — '+esc(selected.grade):'لم يتم اختيار طالبة بعد')+'</div>'+
   '<div id="studentMatchList" class="student-match-list" role="listbox" aria-label="نتائج البحث عن الطالبات"></div>'+
   '<button type="button" id="toggleInlineStudent" class="secondary">+ إضافة طالبة جديدة من هذه الصفحة</button>'+
   '<div id="inlineStudent" class="inline-new-student hidden">'+
   '<p class="subtle">ستُضاف الطالبة إلى قائمة المدرسة الحالية، وتُسجّل لها هذه الحالة في العملية نفسها.</p>'+
   input('new_student_name','اسم الطالبة الجديدة','')+
   input('new_student_grade','الصف','')+
   input('new_student_class','الفصل','')+
   '</div></div>';
}
function studentMatches(query){
 const list=$('studentMatchList');
 if(!list)return;
 const term=normalizeStudentName(query);
 if(!term){list.innerHTML='<p class="subtle">اكتبي بعض الحروف لعرض الطالبات المطابقات.</p>';return}
 const matching=live('students').filter(student=>normalizeStudentName(student.name).includes(term));
 list.innerHTML=matching.length
   ?matching.slice(0,15).map(s=>'<button type="button" role="option" data-select-student="'+esc(s.id)+'">'+esc(s.name)+' <small>• '+esc(s.grade)+' • فصل '+esc(s.class_name)+'</small></button>').join('')+
     (matching.length>15?'<p class="subtle">ظهرت ١٥ نتيجة فقط. اكتبي المزيد لتضييق البحث.</p>':'')
   :'<p class="subtle">لا توجد طالبة بهذا البحث. يمكنك إضافتها من الزر أدناه.</p>';
}
function chooseStudent(id){
 const student=live('students').find(s=>s.id===id);
 if(!student)return;
 $('f_student_id').value=id;
 $('studentQuickSearch').value=student.name;
 $('selectedStudentLabel').textContent='الطالبة المختارة: '+student.name+' — '+student.grade;
 $('studentMatchList').innerHTML='';
 $('inlineStudent').classList.add('hidden');
 $('toggleInlineStudent').textContent='+ إضافة طالبة جديدة من هذه الصفحة';
}
function toggleNewStudent(){
 const section=$('inlineStudent');
 if(!section)return;
 const opening=section.classList.contains('hidden');
 section.classList.toggle('hidden',!opening);
 $('toggleInlineStudent').textContent=opening?'إلغاء إضافة طالبة جديدة':'+ إضافة طالبة جديدة من هذه الصفحة';
 $('f_student_id').value='';
 $('selectedStudentLabel').textContent=opening?'جارٍ إضافة طالبة جديدة':'لم يتم اختيار طالبة بعد';
 if(opening){
   const guess=$('studentQuickSearch').value.trim();
   $('f_new_student_name').value=guess;
   $('studentMatchList').innerHTML='';
   $('f_new_student_name').focus();
 }else{
   studentMatches($('studentQuickSearch').value);
 }
}
function openEditor(kind,id=null,student=null){
 if(CloudClient.ready()&&!CloudClient.user()){
   notify('سجلي الدخول إلى Firebase قبل إضافة البيانات');navigate('settings');return;
 }
 formContext={kind,id};
 const old=id?state[kind].find(x=>x.id===id):{};
 if(id&&!old){notify('هذا السجل غير موجود');return}
 $('editorTitle').textContent=({students:'بيانات الطالبة',entries:'تسجيل موقف أو حالة',tasks:'مهمة أسبوعية'})[kind];
 let fields='';
 if(kind==='students')fields=
   input('name','اسم الطالبة',old.name,true)+input('grade','الصف',old.grade,true)+input('class_name','الفصل',old.class_name,true);
 if(kind==='entries'){
   fields=studentPickerMarkup(student||old.student_id||'')+
    select('type','القسم / نوع السجل',types.map(t=>[t,t]),old.type||types[0])+
    input('date','التاريخ',old.date||today(),true,'date')+
    select('status','حالة المتابعة',[
      ['غير محددة','لم تُوثّق بعد'],['مفتوحة','مفتوحة'],['مغلقة','مغلقة']
    ],old.status||'مفتوحة',true)+
    input('subject','موضوع الحالة (مثال: ربو، مخالفة سلوكية، ضعف دراسي)',id?subjectFor(old):'',true)+
    textarea('notes','تفاصيل وملاحظات إضافية',id?detailsFor(old):'')+
    textarea('action_taken','الإجراء المتخذ (إن وُجد)',id?actionFor(old):'');
 }
 if(kind==='tasks')fields=
   input('title','عنوان المهمة',old.title,true)+input('due_date','موعد المتابعة',old.due_date||today(),true,'date')+
   select('done','حالة المهمة',[['false','قيد التنفيذ'],['true','منتهية']],String(Boolean(old.done)));
 $('formFields').innerHTML='<div class="fields-grid">'+fields+'</div>';
 $('editor').showModal();
 if(kind==='entries'){
  studentMatches('');
  if(student||old.student_id)chooseStudent(student||old.student_id);
 }
}
function putLinkedStudentAndEntry(student,entry){
 // Atomic local persistence: a new student is never created without her case.
 return new Promise((resolve,reject)=>{
  const names=CloudClient.ready()?['students','entries','queue']:['students','entries'];
  const transaction=db.transaction(names,'readwrite');
  transaction.objectStore('students').put(student);
  transaction.objectStore('entries').put(entry);
  if(CloudClient.ready()){
    const q=transaction.objectStore('queue');
    const created=stamp();
    q.put({id:uuid(),table:'students',entity:{...student},created_at:created});
    q.put({id:uuid(),table:'entries',entity:{...entry},created_at:created});
  }
  transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error||Error('تعذر حفظ السجلين'));
  transaction.onabort=()=>reject(transaction.error||Error('أُلغي الحفظ'));
 });
}
async function saveEditor(e){
 e.preventDefault();
 const button=$('editorForm').querySelector('button[type="submit"]');
 if(button)button.disabled=true;
 try{
   const {kind,id}=formContext,old=id?state[kind].find(x=>x.id===id):null;
   const form=new FormData($('editorForm'));
   const value={...old,id:id||uuid(),school_code:state.school,updated_at:stamp(),is_deleted:false};
   for(const [k,v] of form.entries())if(!k.startsWith('new_student_'))value[k]=String(v).trim();
   if(kind==='tasks')value.done=value.done==='true';
   if(kind==='students'&&!value.name?.trim())throw Error('اسم الطالبة مطلوب.');
   if(kind==='entries'){
     if(!value.subject?.trim())throw Error('موضوع الحالة مطلوب.');
     if(!['مفتوحة','مغلقة','غير محددة'].includes(value.status))throw Error('اختاري حالة المتابعة الصحيحة.');
     const createSection=$('inlineStudent'),adding=createSection&&!createSection.classList.contains('hidden');
     let freshStudent=null;
     if(adding){
       const name=String(form.get('new_student_name')||'').trim();
       const grade=String(form.get('new_student_grade')||'').trim();
       const className=String(form.get('new_student_class')||'').trim();
       if(!name||!grade||!className)throw Error('أكملي اسم الطالبة الجديدة والصف والفصل.');
       if(live('students').some(s=>normalizeStudentName(s.name)===normalizeStudentName(name)))
         throw Error('اسم الطالبة موجود في القائمة. اختاريها من نتائج البحث بدل تكرار ملفها.');
       freshStudent={id:uuid(),school_code:state.school,name,grade,
         class_name:className,updated_at:stamp(),is_deleted:false};
       value.student_id=freshStudent.id;
       value.student_name=name;
     }else{
       const existing=live('students').find(s=>s.id===value.student_id);
       if(!existing)throw Error('اختاري الطالبة من نتائج البحث، أو اضغطي «إضافة طالبة جديدة».');
       value.student_name=existing.name;
     }
     if(old?.source_legacy_id)value.details_override=value.notes;
     if(freshStudent){
       await putLinkedStudentAndEntry(freshStudent,value);
       await refresh();
       if(CloudClient.ready()&&navigator.onLine)void syncCloud();
     }else{
       await save('entries',value);
     }
   }else await save(kind,value);
   $('editor').close();
   notify(CloudClient.ready()?'حُفظت الحالة على الجهاز وأُضيفت إلى قائمة المزامنة.':'تم حفظ السجل');
 }catch(err){
   notify(err.message||'تعذر الحفظ');
 }finally{
   if(button&&button.isConnected)button.disabled=false;
 }
}
async function handleClick(e){const b=e.target.closest('button');if(!b)return;if(b.dataset.page)navigate(b.dataset.page);if(b.dataset.type!==undefined){$('recordType').value=types[Number(b.dataset.type)];navigate('records')}if(b.dataset.profile)showProfile(b.dataset.profile);if(b.dataset.closeprofile)$('studentProfile').classList.add('hidden');if(b.dataset.newrecord)openEditor('entries',null,b.dataset.newrecord);if(b.dataset.edit){const [kind,id]=b.dataset.edit.split(':');openEditor(kind,id)}if(b.dataset.toggleentry){const x=state.entries.find(v=>v.id===b.dataset.toggleentry);if(x&&['مفتوحة','مغلقة'].includes(x.status))await save('entries',{...x,status:x.status==='مفتوحة'?'مغلقة':'مفتوحة'});else if(x)openEditor('entries',x.id)}if(b.dataset.toggletask){const x=state.tasks.find(v=>v.id===b.dataset.toggletask);if(x)await save('tasks',{...x,done:!x.done})}}
async function exportJson(){const snapshot={schema:'guidance-v2-demo-1',exported_at:stamp(),warning:'بيانات تجريبية فقط',students:state.students,entries:state.entries,tasks:state.tasks};download('student-guidance-demo-'+today()+'.json',JSON.stringify(snapshot,null,2),'application/json');notify('تم تنزيل النسخة التجريبية')}
function download(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},1000)}
async function importJson(file){if(!file)return;let data;try{data=JSON.parse(await file.text());if(data.schema!=='guidance-v2-demo-1'||!tables.every(t=>Array.isArray(data[t])))throw new Error('نسخة غير مطابقة');if(!confirm('سيتم دمج بيانات نسخة تجريبية فقط. هل تريد المتابعة؟'))return;for(const t of tables)for(const r of data[t]){if(!r.id||!['p31','m34'].includes(r.school_code))throw Error('بنية غير صالحة');await put(t,r)}await refresh();notify('اكتمل استيراد البيانات التجريبية')}catch(err){notify('تعذر الاستيراد: '+err.message)}}
function exportCSV(){const names=$('showNames').checked;const rows=[['التاريخ','المدرسة','النوع',...(names?['اسم الطالبة']:[]),'الحالة'],...reportData().map(e=>[e.date,schoolName(e.school_code),e.type,...(names?[e.student_name||byId(e.student_id)]:[]),e.status])];const safe=x=>{let v=String(x??'');if(/^[=+\-@\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"'};download('تقرير-الموجهة-'+today()+'.csv','\ufeff'+rows.map(row=>row.map(safe).join(',')).join('\r\n'),'text/csv;charset=utf-8')}
async function syncCloud(){
 if(!CloudClient.ready()||busy)return;
 busy=true;
 try{
   const session=await CloudClient.ensureSession();
   if(!session){await refresh();renderSyncInfo();return}
   const queued=(await all('queue')).sort((a,b)=>a.created_at.localeCompare(b.created_at));
   // Only the most recent unsent edit per document is pushed, to avoid
   // duplicate updates while offline. Older queued edits stay until ACK.
   const last=new Map();
   for(const job of queued)last.set(job.table+':'+job.entity.id,job);
   let pushed=0;
   for(const [key,job] of last){
     const updated=await CloudClient.upsert(job.table,{...job.entity,owner_id:session.user.id});
     await put(job.table,updated);
     for(const queuedJob of queued)if(queuedJob.table+':'+queuedJob.entity.id===key)await remove('queue',queuedJob.id);
     pushed++;
   }
   if(!realtimeStarted){
     await CloudClient.startListeners(async(table,rows)=>{
       if(!db||!CloudClient.user())return;
       const dirty=new Set((await all('queue')).filter(j=>j.table===table).map(j=>j.entity.id));
       for(const row of rows)if(!dirty.has(row.id))await put(table,row);
       await refresh();
     });
     realtimeStarted=true;
   }
   await refresh();
   $('syncStatus').textContent='Firebase • متصل';
   if(pushed)notify('تمت مزامنة '+pushed+' سجل تجريبي');
 }catch(error){
   $('syncStatus').textContent='مزامنة معلقة';
   $('syncStatus').className='status warn';
   notify('المزامنة غير مكتملة: '+(String(error.message||error).includes('CONFLICT')?'هناك تعديل متعارض محفوظ على هذا الجهاز':error.message));
 }finally{busy=false}
}
function setup(){document.body.addEventListener('click',handleClick);$('school').addEventListener('change',e=>{state.school=e.target.value;$('studentProfile').classList.add('hidden');render()});$('studentSearch').addEventListener('input',renderStudents);$('studentGrade').addEventListener('change',renderStudents);for(const id of ['recordSearch','recordType','recordStatus'])$(id).addEventListener('input',renderEntries);for(const id of ['legacySearch','legacyCategory'])$(id).addEventListener('input',renderLegacy);for(const id of ['fromDate','toDate','reportType','reportStatus','showNames'])$(id).addEventListener('change',renderReports);$('quickAdd').onclick=()=>openEditor('entries');$('addRecord').onclick=()=>openEditor('entries');$('addStudent').onclick=()=>openEditor('students');$('addTask').onclick=()=>openEditor('tasks');$('closeEditor').onclick=$('cancelEditor').onclick=()=>$('editor').close();$('editorForm').addEventListener('submit',saveEditor);
 $('formFields').addEventListener('input',e=>{
   if(e.target.id==='studentQuickSearch'){
     $('f_student_id').value='';
     $('selectedStudentLabel').textContent='اختاري الطالبة من النتائج';
     studentMatches(e.target.value);
   }
 });
 $('formFields').addEventListener('click',e=>{
   const found=e.target.closest('[data-select-student]');
   if(found){chooseStudent(found.dataset.selectStudent);return;}
   if(e.target.closest('#toggleInlineStudent'))toggleNewStudent();
 });$('exportJson').onclick=exportJson;$('importJson').onchange=e=>importJson(e.target.files[0]);$('previewReport').onclick=renderReports;$('printReport').onclick=()=>{$('printArea').innerHTML=reportHTML();window.print()};$('exportCsv').onclick=exportCSV;$('syncNow').onclick=syncCloud;$('signOut').onclick=async()=>{if((await all('queue')).length){notify('يجب مزامنة التعديلات المعلقة قبل تسجيل الخروج');return}await CloudClient.signOut();realtimeStarted=false;await refresh();navigate('settings');notify('تم تسجيل الخروج')};$('authBox').addEventListener('submit',async e=>{
 if(e.target.id!=='loginForm')return;
 e.preventDefault();
 const form=new FormData(e.target),button=e.target.querySelector('button[type="submit"]');
 if(button)button.disabled=true;
 try{
   const result=await CloudClient.signIn(form.get('email'),form.get('password'));
   await refresh();renderSyncInfo();
   if(result.allowed)await syncCloud();
   else notify('نجح الدخول. انسخي UID لاعتماد الحساب وتفعيل المزامنة.');
 }catch(error){
   const msg=String(error.code||'');
   notify(msg==='auth/invalid-credential'?'بيانات الدخول غير صحيحة أو أن المستخدم غير منشأ في Firebase.':'تعذر تسجيل الدخول: '+error.message)
 }finally{if(button&&button.isConnected)button.disabled=false}
});$('authBox').addEventListener('click',async e=>{
 if(e.target.id!=='copyUid')return;
 const uid=CloudClient.bootstrapUid?.();
 if(!uid)return;
 try{await navigator.clipboard.writeText(uid);notify('تم نسخ UID')}catch(_){notify('حددي رمز UID وانسخيه يدويًا')}
});window.addEventListener('online',()=>syncCloud());for(const id of ['recordType','reportType'])$(id).innerHTML='<option value="">كل الأقسام</option>'+types.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join('');if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./service-worker.js').catch(()=>{})}
(async function init(){
 try{
   db=await startDB();setup();
   if(CloudClient.ready()){
     CloudClient.setAuthObserver(async user=>{
       if(!db)return;
       if(!user){realtimeStarted=false;await refresh();navigate('settings')}
       else {await refresh();void syncCloud()}
     });
     await CloudClient.ensureSession();
   } else {await seedDemo();}
   await refresh();
   if(CloudClient.ready()&&!CloudClient.user())navigate('settings');
   if(CloudClient.ready()&&CloudClient.user())void syncCloud();
   // Firebase realtime listeners perform remote updates: this interval only
   // retries queued offline edits, not full collection reads.
   setInterval(async()=>{
     if(navigator.onLine&&CloudClient.ready()&&CloudClient.user()&&(await all('queue')).length)void syncCloud()
   },45000);
 }catch(err){document.querySelector('main').innerHTML='<div class="empty">تعذر بدء التطبيق المحلي. افتح الصفحة عبر HTTPS أو localhost.<div>'+esc(err.message)+'</div></div>'}
})();
