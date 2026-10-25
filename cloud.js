/* مكوّن اختياري للمزامنة: لا يعمل حتى إدخال عنوان مشروع Supabase ومفتاح publishable في config.js. */
(function(){
const cfg=window.GUIDANCE_CLOUD||{},key='sgv2_cloud_session';
let session=null;try{session=JSON.parse(localStorage.getItem(key)||'null')}catch{}
const ready=()=>Boolean(cfg.url&&cfg.anonKey);
async function request(path,method='GET',body=null,token=null,extra={}){
 if(!ready())throw new Error('المزامنة السحابية غير مهيأة');
 const headers={apikey:cfg.anonKey,'Content-Type':'application/json',...extra};if(token)headers.Authorization='Bearer '+token;
 let resp;try{resp=await fetch(cfg.url.replace(/\/$/,'')+path,{method,headers,body:body===null?undefined:JSON.stringify(body),cache:'no-store'})}catch{throw new Error('تعذر الاتصال بالخادم')}
 let data=null;try{data=await resp.json()}catch{}if(!resp.ok)throw new Error(data?.msg||data?.message||data?.error_description||`تعذر الطلب (${resp.status})`);return data;
}
async function ensureSession(){if(!session)return null;if(Date.now()<session.expires_at-60000)return session;try{const t=await request('/auth/v1/token?grant_type=refresh_token','POST',{refresh_token:session.refresh_token});session={access_token:t.access_token,refresh_token:t.refresh_token,expires_at:Date.now()+t.expires_in*1000,user:t.user};localStorage.setItem(key,JSON.stringify(session));return session}catch{session=null;localStorage.removeItem(key);return null}}
async function signIn(email,password){const t=await request('/auth/v1/token?grant_type=password','POST',{email,password});session={access_token:t.access_token,refresh_token:t.refresh_token,expires_at:Date.now()+t.expires_in*1000,user:t.user};localStorage.setItem(key,JSON.stringify(session));return t.user}
function signOut(){session=null;localStorage.removeItem(key)}
async function fetchAll(table){const s=await ensureSession();if(!s)throw new Error('يرجى تسجيل الدخول للمزامنة');return request(`/rest/v1/${table}?select=*&order=updated_at.asc&limit=10000`,'GET',null,s.access_token)}
async function upsert(table,value){const s=await ensureSession();if(!s)throw new Error('انتهت الجلسة، سجلي الدخول مجددًا');return request(`/rest/v1/${table}?on_conflict=id`,'POST',value,s.access_token,{'Prefer':'resolution=merge-duplicates,return=minimal'})}
window.CloudClient={ready,signIn,signOut,ensureSession,fetchAll,upsert,user:()=>session?.user||null};
})();
