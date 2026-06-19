# ACU Dental AI - Setup & Run Instructions

## تحضير النموذج المحلي (Setup Local Model)

### 1. أضف ملف النموذج
ضع ملف `dental_model_best.h5` في المجلد:
```
backend/model/dental_model_best.h5
```

### 2. تثبيت المتطلبات (Python Backend)
```bash
cd backend
pip install -r requirements.txt
```

### 3. تشغيل الخادم (Frontend - Terminal 1)
```bash
npm run dev
```

### 4. تشغيل النموذج المحلي (Backend - Terminal 2)
```bash
cd backend
python main.py
```

يجب أن يبدأ الخادم على: `http://localhost:5000`

### 5. التحقق من النموذج
زر هذا الرابط في المتصفح:
```
http://localhost:8000/health
```

يجب أن ترى:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "classes": 7,
  "class_labels": ["تسوس", "التهاب اللثة", ...]
}
```

---

## كيفية عمل النظام؟

1. ✅ يحاول Gemini API أولاً
2. ❌ إذا فشل Gemini → يستخدم النموذج المحلي تلقائياً
3. 📊 النموذج المحلي يعطي 7 فئات (7 classes)

---

## الفئات (Classes)

```
1. تسوس (Cavity)
2. التهاب اللثة (Gingivitis)
3. البلاك (Plaque)
4. صحي (Healthy)
5. تآكل الأسنان (Enamel Erosion)
6. الجير (Tartar)
7. خراج الأسنان (Tooth Abscess)
```

---

## استكشاف الأخطاء

### المشكلة: "Model not loaded"
- تأكد من وجود ملف `dental_model_best.h5` في `backend/model/`
- أعد تشغيل خادم FastAPI

### المشكلة: "Failed to connect to localhost:8000"
- تأكد من أن خادم FastAPI يعمل
- تحقق من أن البورت 8000 متاح

### المشكلة: "Requirements install failed"
- قد تحتاج إلى Python 3.8+
- جرب: `pip install --upgrade pip`

---

## ملاحظات مهمة

- حجم الملف: 28 MB
- التنسيق: .h5 (Keras)
- الفئات: 7 classes
- الاستجابة: تلقائي Fallback من Gemini للنموذج المحلي
