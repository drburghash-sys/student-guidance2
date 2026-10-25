/* Firebase sync adapter — DEMO ONLY until hosting/privacy approval.
 * SDK version: Firebase JS 13.1.0 (2026-10-21).
 * No student data or secret keys belong in this repository.
 */
(function () {
  'use strict';
  const config = window.GUIDANCE_FIREBASE || {};
  const sdk = 'https://www.gstatic.com/firebasejs/13.1.0/';
  const validTables = new Set(['students','entries','tasks','legacy_records']);
  const enabled = () => Boolean(config.apiKey && config.projectId && config.authDomain && config.appId && config.mode === 'demo');
  // Authentication works before enrollment; Firestore remains deny-all until UID approval.
  let contextPromise = null, authUser = null, listeners = [];
  let notifyAuth = () => {};

  async function initialize() {
    if (!enabled()) throw Error('Firebase غير مهيأ — أضيفي بيانات المشروع أولًا.');
    if (!contextPromise) contextPromise = (async () => {
      const [appLib, authLib, storeLib] = await Promise.all([
        import(sdk+'firebase-app.js'),
        import(sdk+'firebase-auth.js'),
        import(sdk+'firebase-firestore.js')
      ]);
      const app = appLib.initializeApp({
        apiKey: config.apiKey, authDomain: config.authDomain,
        projectId: config.projectId, appId: config.appId
      }, 'student-guidance-v2-demo');
      const auth = authLib.getAuth(app);
      // No durable Firestore cache: the browser's existing test IndexedDB is still
      // unencrypted. All real student data remains disallowed at this stage.
      const db = storeLib.initializeFirestore(app,{localCache:storeLib.memoryLocalCache()});
      authLib.onAuthStateChanged(auth, user => {
        lastAuthenticatedUser=user;
        authUser = user && user.uid===config.allowedUid
          ? { id:user.uid, uid:user.uid, email:user.email } : null;
        if(!authUser){for(const unsub of listeners.splice(0))unsub();}
        notifyAuth(authUser);
      });
      await auth.authStateReady();
      lastAuthenticatedUser=auth.currentUser;
      authUser = auth.currentUser?.uid===config.allowedUid
        ? {id:auth.currentUser.uid,uid:auth.currentUser.uid,email:auth.currentUser.email} : null;
      return {auth,authLib,storeLib,db};
    })().catch(err=>{contextPromise=null;throw err});
    return contextPromise;
  }
  async function ensureSession() {
    const ctx = await initialize();
    if(!ctx.auth.currentUser || ctx.auth.currentUser.uid !== config.allowedUid)return null;
    return {user:{id:ctx.auth.currentUser.uid,email:ctx.auth.currentUser.email}};
  }
  // First authenticated login can reveal a test UID for one-time enrollment.
  // Access to Firestore remains denied until the UID is approved in BOTH
  // config.js and the deployed Firestore security rules.
  let lastAuthenticatedUser = null;
  const bootstrapUid = () => !config.allowedUid && lastAuthenticatedUser
    ? lastAuthenticatedUser.uid : null;

  async function signIn(email,password) {
    const c=await initialize();
    const address=String(email||'').trim(),secret=String(password||'');
    if(!address || !secret)throw Error('أدخلي البريد الإلكتروني وكلمة مرور حساب التطبيق.');
    const result=await c.authLib.signInWithEmailAndPassword(c.auth,address,secret);
    lastAuthenticatedUser=result.user;
    const approved=Boolean(config.allowedUid && result.user.uid===config.allowedUid);
    authUser=approved
      ? {id:result.user.uid,uid:result.user.uid,email:result.user.email}
      : null;
    notifyAuth(authUser);
    return {uid:result.user.uid,allowed:approved,email:result.user.email};
  }
  async function signOut() {
    if(!enabled())return;
    const c=await initialize();
    for(const unsub of listeners.splice(0))unsub();
    await c.authLib.signOut(c.auth);authUser=null;lastAuthenticatedUser=null;notifyAuth(null);
  }
  function requireTable(table) {
    if(!validTables.has(table))throw Error('جدول غير معتمد: '+table);
  }
  async function collectionFor(table) {
    requireTable(table);
    const c=await initialize(),s=await ensureSession();
    if(!s)throw Error('يرجى تسجيل الدخول بحساب الموجّهة.');
    return {c,s,collection:c.storeLib.collection(c.db,'users',s.user.id,table)};
  }
  async function fetchAll(table) {
    const {c,collection} = await collectionFor(table);
    const snapshot = await c.storeLib.getDocs(collection);
    return snapshot.docs.map(d=>d.data());
  }
  async function upsert(table,raw) {
    const {c,s} = await collectionFor(table);
    if(!raw || typeof raw!=='object' || !raw.id || !['p31','m34'].includes(raw.school_code))throw Error('بيانات السجل غير مكتملة');
    const ref=c.storeLib.doc(c.db,'users',s.user.id,table,String(raw.id));
    // Detect concurrent edits using server-side revision checks; do not silently
    // discard pending offline edits or trust phone clock as conflict arbiter.
    return c.storeLib.runTransaction(c.db,async tr=>{
      const before=await tr.get(ref);
      const oldRevision=before.exists()?Number(before.data().revision||0):0;
      const expected=Number(raw.revision||0);
      if(expected!==oldRevision)throw Error('CONFLICT: تغير هذا السجل على جهاز آخر. التعديل محفوظ محليًا للمراجعة.');
      const next={...raw,revision:oldRevision+1,owner_id:s.user.id};
      tr.set(ref,next);
      return next;
    });
  }
  // Preview an exact-id cascade. Never match a person by name because
  // different pupils can share a name, and old archives have ambiguities.
  async function previewStudentDeletion(studentId,schoolCode){
    if(!studentId || !['p31','m34'].includes(schoolCode))throw Error('مدرسة أو معرف غير صالح.');
    const {c,s}=await collectionFor('students');
    const ref=c.storeLib.doc(c.db,'users',s.user.id,'students',String(studentId));
    const found=await c.storeLib.getDoc(ref);
    if(!found.exists())throw Error('ملف الطالبة غير موجود في Firebase.');
    const student=found.data();
    if(student.id!==studentId||student.school_code!==schoolCode||student.owner_id!==s.user.id)
      throw Error('ملف الطالبة لا يطابق المدرسة والحساب الحالي.');
    const [entries,archives,tasks]=await Promise.all([
      fetchAll('entries'),fetchAll('legacy_records'),fetchAll('tasks')
    ]);
    const valid=r=>r.school_code===schoolCode&&r.owner_id===s.user.id;
    const linkedArchives=archives.filter(r=>valid(r)&&r.student_id===studentId);
    const archiveIds=new Set(linkedArchives.map(r=>r.id));
    const linkedEntries=entries.filter(r=>valid(r)&&(
      r.student_id===studentId||(r.source_legacy_id&&archiveIds.has(r.source_legacy_id))));
    const linkedTasks=tasks.filter(r=>valid(r)&&r.student_id===studentId);
    const docs=[
      ...linkedEntries.map(r=>({table:'entries',id:r.id})),
      ...linkedArchives.map(r=>({table:'legacy_records',id:r.id})),
      ...linkedTasks.map(r=>({table:'tasks',id:r.id})),
      {table:'students',id:studentId}
    ];
    if(docs.length>250)throw Error('عدد السجلات المرتبطة كبير، يلزم إجراء حذف مراجع ومجزأ.');
    return {student,docs,counts:{entries:linkedEntries.length,legacy:linkedArchives.length,tasks:linkedTasks.length}};
  }
  async function deleteStudentBundle(preview){
    const {student,docs}=preview||{};
    if(!student?.id||!['p31','m34'].includes(student.school_code)||
       !Array.isArray(docs)||docs.length<1||docs.length>250)
      throw Error('طلب الحذف غير صالح.');
    if(docs.at(-1).table!=='students'||docs.at(-1).id!==student.id)
      throw Error('ملف الطالبة ليس ضمن مجموعة الحذف.');
    const {c,s}=await collectionFor('students');
    if(student.owner_id!==s.user.id)throw Error('الحذف غير مصرح به.');
    const refs=docs.map(({table,id})=>{
      if(!validTables.has(table)||!id)throw Error('نوع سجل غير صالح للحذف.');
      return c.storeLib.doc(c.db,'users',s.user.id,table,String(id))
    });
    // One atomic server transaction removes the selected pupil and all verified
    // linked records. Any failed rule/transaction leaves every document intact.
    await c.storeLib.runTransaction(c.db,async tx=>{
      const snapshots=[];
      for(const ref of refs)snapshots.push(await tx.get(ref));
      for(let i=0;i<snapshots.length;i++){
        const snapshot=snapshots[i],item=docs[i];
        if(!snapshot.exists())throw Error('تغيّر أحد السجلات أثناء المراجعة. أعيدي المحاولة.');
        const row=snapshot.data();
        if(row.id!==item.id || row.owner_id!==s.user.id ||
           row.school_code!==student.school_code)
          throw Error('تغيّر ارتباط أحد السجلات؛ ألغي الحذف حفاظًا على البيانات.');
        if(item.table!=='students' && row.student_id!==student.id &&
           !(item.table==='entries'&&docs.some(d=>d.table==='legacy_records'&&d.id===row.source_legacy_id)))
          throw Error('أحد السجلات لا يرتبط بالطالبة المحددة.');
      }
      for(const ref of refs)tx.delete(ref);
    });
    return docs;
  }
  async function startListeners(onRows) {
    const {c,s}=await collectionFor('students');
    if(listeners.length)return;
    for(const table of validTables){
      const coll=c.storeLib.collection(c.db,'users',s.user.id,table);
      const unsub=c.storeLib.onSnapshot(coll,
        snapshot=>{
          const changed=snapshot.docChanges();
          const upserts=changed.filter(ch=>ch.type!=='removed').map(ch=>ch.doc.data());
          const removed=changed.filter(ch=>ch.type==='removed').map(ch=>ch.doc.id);
          if(upserts.length||removed.length)Promise.resolve(onRows(table,upserts,removed)).catch(()=>{});
        },
        error=>{console.warn('تعذر استقبال تغييرات Firestore ('+table+')',error.code||'');});
      listeners.push(unsub);
    }
  }
  // Sensitive school data may only be imported from a dedicated Firebase
  // Hosting origin, NOT shared-owner GitHub Pages (or localhost).
  const approvedWebOrigin=()=>{
    if(typeof location==='undefined'||location.protocol!=='https:')return false;
    const hostname=String(location.hostname||'').toLowerCase();
    return hostname===String(config.projectId).toLowerCase()+'.web.app'
        || hostname===String(config.projectId).toLowerCase()+'.firebaseapp.com';
  };
  // Owner-confirmed, create-only import. Never overwrites existing records.
  // The caller must pass explicit user attestation and a known valid session;
  // data is transmitted only after the person presses Import.
  async function insertManyIfMissing(table, rows, batchSize=20, onProgress=()=>{}, opts={}) {
    if(!['students','entries','legacy_records'].includes(table))
      throw Error('هذه الفئة غير مسموح باستيرادها.');
    if(opts?.userConfirmed!==true)
      throw Error('لا يمكن البدء دون إقرار المستخدم الصريح بصلاحية نقل البيانات.');
    if(!approvedWebOrigin())throw Error('استيراد بيانات حقيقية محجوب على GitHub Pages. انشري التطبيق أولاً على Firebase Hosting.');
    const {c,s}=await collectionFor(table);
    if(!Array.isArray(rows)||rows.length>10000)throw Error('قائمة السجلات غير صالحة.');
    let inserted=0,existing=0;
    for(let i=0;i<rows.length;i+=Math.max(1,Math.min(20,batchSize))){
      const batch=rows.slice(i,i+Math.max(1,Math.min(20,batchSize)));
      for(const row of batch){
        if(row.owner_id!==s.user.id||!row.id||
           !['p31','m34'].includes(row.school_code) ||
           row.revision!==1)throw Error('بيانات أحد السجلات غير صالحة أو غير مصرح بها.');
        const ref=c.storeLib.doc(c.db,'users',s.user.id,table,String(row.id));
        const result=await c.storeLib.runTransaction(c.db,async tx=>{
          const before=await tx.get(ref);
          if(before.exists()){
            const data=before.data();
            if(data.owner_id!==row.owner_id || data.school_code!==row.school_code)
              throw Error('تعارض معرف موجود في قاعدة البيانات: '+row.id);
            if(table==='legacy_records' && (data.source_id!==row.source_id || data.source_fingerprint!==row.source_fingerprint))
              throw Error('محتوى السجل الأصلي مختلف عن نسخة مستوردة سابقًا؛ لا يمكن استبداله تلقائيًا.');
            if(table==='entries' && data.source_legacy_id!==row.source_legacy_id)
              throw Error('سجل جديد مختلف يستعمل المعرّف نفسه.');
            return false;
          }
          tx.set(ref,row);
          return true;
        });
        if(result)inserted++;else existing++;
      }
      onProgress(Math.min(i+batch.length,rows.length),{inserted,existing});
    }
    return {inserted,existing,total:rows.length};
  }
  window.CloudClient={
    ready:enabled,
    user:()=>authUser,
    setAuthObserver:callback=>{notifyAuth=callback;},
    ensureSession,signIn,bootstrapUid,signOut,upsert,fetchAll,startListeners,insertManyIfMissing,previewStudentDeletion,deleteStudentBundle,
    allowLegacyImport:()=>Boolean(config.allowedUid && config.mode==='demo' && approvedWebOrigin())
  };
})();
