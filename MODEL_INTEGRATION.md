# ACU Dental AI - Model Integration Guide

This project currently uses the **Gemini 3 Flash** multimodal model for high-accuracy dental disease detection and explanation. To integrate your custom model exported from Google Colab (.h5, .keras, or .pt), follow these steps:

## 1. Backend Setup (Python)

Since your model is likely trained in Python (TensorFlow/Keras or PyTorch), you should create a Python-based backend using **FastAPI** or **Flask**.

### Recommended Structure:
```
/backend
  main.py          # FastAPI application
  model_loader.py  # Logic to load .h5 or .pt file
  processor.py     # Image preprocessing (resize, normalize)
/model
  dental_model.h5  # Your exported model
```

### Example FastAPI Implementation (main.py):
```python
from fastapi import FastAPI, UploadFile, File
import tensorflow as tf
import numpy as np
from PIL import Image
import io

app = FastAPI()
model = tf.keras.models.load_model('../model/dental_model.h5')

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    # 1. Read image
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert('RGB')
    
    # 2. Preprocess (Match your Colab training settings)
    image = image.resize((224, 224)) 
    img_array = np.array(image) / 255.0
    img_array = np.expand_dims(img_array, axis=0)
    
    # 3. Inference
    predictions = model.predict(img_array)
    class_idx = np.argmax(predictions[0])
    confidence = float(np.max(predictions[0]))
    
    # 4. Map to labels
    labels = ["Cavity", "Gingivitis", "Plaque", "Healthy"]
    return {
        "condition": labels[class_idx],
        "confidence": f"{confidence * 100:.1f}",
        "recommendation": True if labels[class_idx] != "Healthy" else False
    }
```

## 2. Connecting Frontend to Python Backend

In `server.ts` (or directly from `App.tsx`), change the API call to point to your Python server:

```typescript
// In App.tsx
const analyzeImage = async () => {
  // ...
  const response = await fetch('http://localhost:8000/predict', { 
    method: 'POST',
    body: formData // Use FormData for file uploads
  });
  // ...
}
```

## 3. Running Locally

1. **Frontend**:
   - `npm install`
   - `npm run dev`
2. **Backend**:
   - `pip install fastapi uvicorn tensorflow pillow`
   - `uvicorn main:app --reload`

---
**Project Supervised by:** Dr. Amin El-Saeed
**University:** Ahram Canadian University (ACU)
