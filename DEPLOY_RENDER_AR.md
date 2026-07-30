# نشر Mosque WorldClass V7 على Render

هذه النسخة جاهزة للنشر عبر Render Blueprint مع خادم Node.js وقاعدة PostgreSQL.

## 1. ارفع المشروع إلى GitHub

أنشئ مستودعًا جديدًا، ثم ارفع **محتويات هذا المجلد** بحيث يكون `render.yaml`
في جذر المستودع.

## 2. أنشئ Blueprint

1. افتح Render.
2. اختر **New +** ثم **Blueprint**.
3. اربط مستودع GitHub.
4. Render سيقرأ `render.yaml` وينشئ:
   - Web Service باسم `mosque-worldclass-v7`.
   - PostgreSQL باسم `mosque-worldclass-db`.
5. عند طلب `ADMIN_PIN`، اكتب رمزًا سريًا قويًا واحفظه.
6. اضغط **Deploy Blueprint**.

## 3. رابط التطبيق

بعد نجاح النشر سيظهر رابط شبيه بـ:

`https://mosque-worldclass-v7.onrender.com`

قد يضيف Render أحرفًا للاسم إذا كان الرابط محجوزًا. استخدم الرابط الذي يظهر
في صفحة Web Service.

- شاشة المسجد: `/`
- تطبيق الهاتف: `/mobile-app.html`
- لوحة الإدارة: `/admin.html`
- فحص النظام: `/api/health`

رابط HTTPS يجعل موقع الهاتف والبوصلة يعملان بعد منح الصلاحيات.

## التشغيل المحلي

```powershell
npm install
npm start
```

بدون `DATABASE_URL` يستخدم المشروع ملف JSON محليًا. على Render يستخدم
PostgreSQL تلقائيًا.
