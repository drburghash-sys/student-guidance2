# إعداد تسجيل الدخول بكلمة المرور — Firebase / الموجّهة الطلابية
**التاريخ:** ٢٥ أكتوبر ٢٠٢٦  
**المشروع:** `student-guidance2` — مستخدمة واحدة على أربعة أجهزة.  
**الحالة:** جرى تحديث الكود في GitHub ليستخدم **Email/Password** بدل رابط البريد. ربط UID ونشر قواعد Firestore واختبار المزامنة على Firebase لم تكتمل بعد.

> وضع تجريبي ببيانات وهمية فقط. يمنع إدخال أو رفع بيانات الطالبات الحقيقية أو استيراد النسخة السابقة حتى موافقة الجهة المسؤولة ومراجعة حماية البيانات والنسخ الاحتياطية.

## الخطوات المطلوبة منك في Firebase Console

1. افتح: https://console.firebase.google.com/project/student-guidance2/authentication/providers
2. من **Authentication → Sign-in method**، ضمن **Email/Password** فعّل الخيار الأول **Email/Password** ثم احفظ. يمكنك إيقاف خيار **Email link (passwordless sign-in)** إن لم تعد تريده.
3. افتح **Authentication → Users** واختر **Add user**.
4. أدخل البريد الإلكتروني لزوجتك، واختر **كلمة مرور جديدة خاصة بحساب التطبيق**، ثم احفظ. **لا تستخدم كلمة مرور Gmail نفسها، ولا ترسلها عبر ChatGPT أو GitHub.** كلمة المرور هنا لحساب Firebase Authentication، وليست كلمة مرور Google.
5. في جدول **Users** يظهر عمود **UID**. انسخ UID لهذا الحساب فقط. إذا لم يظهر كاملًا، افتح تفاصيل المستخدم.
6. افتح التطبيق من متصفح Chrome عبر: https://drburghash-sys.github.io/student-guidance2/?v=20261025-password-1
7. من **الإعدادات** أدخل البريد وكلمة مرور حساب التطبيق اللذين أنشأتهما. عند نجاح تسجيل الدخول، سيظهر UID مؤقتًا في التطبيق لأن `allowedUid` لم يُعتمد بعد.
8. أرسل **UID فقط** للمساعدة في تثبيته داخل `config.js` و`firestore.rules` (لا ترسل كلمة المرور أو رمز التحقق).
9. من **Build → Firestore Database** أنشئ قاعدة **Standard** بوضع **Production mode** (لا تستخدم Test mode)، وانشر `firestore.rules` بعد استبدال `REPLACE_WITH_TEST_UID` بالـ UID المعتمد.
10. نختبر المزامنة بين الأجهزة الأربعة بسجلات وهمية فقط، ثم إعداد النسخ الاحتياطية ومراجعة جاهزية التشغيل الحقيقي.

## حالة الكود

- `firebase-sync.js`: `signInWithEmailAndPassword` مع التحقق من `allowedUid`.
- `app.js`: نموذج بريد + كلمة مرور؛ عرض UID فقط بعد أول دخول للمستخدم غير المعتمد.
- `config.js`: إعدادات Firebase Web العامة مضبوطة؛ UID ما زال فارغًا عمدًا؛ `mode:'demo'` و `allowLegacyImport:false`.
- `firestore.rules`: يمنع الوصول إلى أي مجموعة حتى تثبيت UID ونشر القواعد يدويًا؛ لا يعتمد الأمن على `allowedUid` في المتصفح وحده.
- `migration.js`: استيراد بيانات الطالبات الحقيقية معطل.

## ملاحظات الأمان

- تسجيل الدخول هنا ليس Gmail: كلمة المرور الجديدة مخصصة لـ Firebase Authentication ولا ترسل عبر البريد.
- رابط Firebase Web `apiKey` تعريف عام، **ليس** مفتاح خدمة سريًا؛ لا ترفع إلى GitHub أي بيانات طالبة أو كلمة مرور أو Service Account.
- GitHub Pages الحالي للتجربة فقط، إذ تشترك التطبيقات المنشورة عبر الحساب ذاته في أصل المتصفح؛ لا يصح تشغيل بيانات مدرسية حقيقية قبل وضع معايير العزل والحماية.
- تخزين IndexedDB المحلي في هذه النسخة غير مشفر بما يكفي لبيانات حقيقية؛ يجب معالجة ذلك قبل الاعتماد.
- بيانات المدرسة الخاصة بأجهزة شخصية وسحابة خارجية تتطلب موافقة جهة البيانات، حتى لو كانت صاحبة الحساب هي الموجّهة.

المراجع الرسمية:
- https://firebase.google.com/docs/auth/web/password-auth
- https://firebase.google.com/docs/firestore/security/rules-conditions
- https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
