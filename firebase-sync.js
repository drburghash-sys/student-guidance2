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
  async function startListeners(onRows) {
    const {c,s}=await collectionFor('students');
    if(listeners.length)return;
    for(const table of validTables){
      const coll=c.storeLib.collection(c.db,'users',s.user.id,table);
      const unsub=c.storeLib.onSnapshot(coll,
        snapshot=>{const changed=snapshot.docChanges().filter(ch=>ch.type!=='removed').map(ch=>ch.doc.data());if(changed.length)Promise.resolve(onRows(table,changed)).catch(()=>{});},
        error=>{console.warn('تعذر استقبال تغييرات Firestore ('+table+')',error.code||'');});
      listeners.push(unsub);
    }
  }
  async function insertManyIfMissing(table,rows,batchSize=20,onProgress=()=>{}) {
    if(config.allowLegacyImport!==true || config.mode!=='approved')throw Error('استيراد سجلات حقيقية غير مفعّل قبل موافقة الجهة.');
    const {c,s}=await collectionFor(table);
    for(let i=0;i<rows.length;i+=batchSize){
      for(const row of rows.slice(i,i+batchSize)){
        const ref=c.storeLib.doc(c.db,'users',s.user.id,table,String(row.id));
        await c.storeLib.runTransaction(c.db,async tx=>{const old=await tx.get(ref);if(!old.exists())tx.set(ref,{...row,owner_id:s.user.id,revision:1})});
      }
      onProgress(Math.min(i+batchSize,rows.length));
    }
  }
  window.CloudClient={
    ready:enabled,
    user:()=>authUser,
    setAuthObserver:callback=>{notifyAuth=callback;},
    ensureSession,signIn,bootstrapUid,signOut,upsert,fetchAll,startListeners,insertManyIfMissing,
    allowLegacyImport:()=>config.mode==='approved'&&config.allowLegacyImport===true
  };
})();
