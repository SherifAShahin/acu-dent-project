import tensorflow as tf
from tensorflow import keras
import numpy as np
from PIL import Image
import io
import os
from pathlib import Path

class DentalModelLoader:
    def __init__(self):
        self.model = None
        self.model_path = Path(__file__).parent.parent / 'model' / 'dental_model_best.h5'
        
        # 7 Classes from the model
        self.classes = [
            "Calculus",
            "Caries_Gingivitus_ToothDiscoloration_Ulcer-yolo_annotated-Dataset",
            "Data caries",
            "Gingivitis",
            "Mouth Ulcer",
            "Tooth Discoloration",
            "hypodontia"
        ]
        
        # Mapping to readable names
        self.class_labels = {
            "Calculus": "الجير (Calculus)",
            "Caries_Gingivitus_ToothDiscoloration_Ulcer-yolo_annotated-Dataset": "تسوس و التهاب اللثة",
            "Data caries": "تسوس الأسنان (Data Caries)",
            "Gingivitis": "التهاب اللثة (Gingivitis)",
            "Mouth Ulcer": "قرحة الفم (Mouth Ulcer)",
            "Tooth Discoloration": "تغير لون السن (Tooth Discoloration)",
            "hypodontia": "نقص الأسنان (Hypodontia)"
        }
        
        # Medical information
        self.medical_info = {
            "Calculus": {
                "description": "تراكم جير على الأسنان",
                "treatment": "تنظيف احترافي عند طبيب الأسنان"
            },
            "Caries_Gingivitus_ToothDiscoloration_Ulcer-yolo_annotated-Dataset": {
                "description": "مشاكل متعددة في الأسنان واللثة",
                "treatment": "ملء السن والتنظيف والعناية باللثة"
            },
            "Data caries": {
                "description": "تسوس في الأسنان",
                "treatment": "ملء السن تحت إشراف طبيب الأسنان"
            },
            "Gingivitis": {
                "description": "التهاب في اللثة",
                "treatment": "تنظيف احترافي وتحسين نظافة الفم"
            },
            "Mouth Ulcer": {
                "description": "قروح مؤلمة في الفم",
                "treatment": "أدوية موضعية ورعاية طبية"
            },
            "Tooth Discoloration": {
                "description": "تغير في لون السن",
                "treatment": "تبييض الأسنان أو ترميم"
            },
            "hypodontia": {
                "description": "نقص في عدد الأسنان",
                "treatment": "زراعة أسنان أو تقويم أسنان"
            }
        }
        
        self.load_model()
    
    def load_model(self):
        """Load the dental model from .h5 file"""
        try:
            if self.model_path.exists():
                self.model = keras.models.load_model(str(self.model_path))
                print(f"✓ Model loaded successfully from {self.model_path}")
            else:
                print(f"⚠ Model file not found at {self.model_path}")
                print(f"  Please place dental_model_best.h5 in /backend/model/ folder")
        except Exception as e:
            print(f"✗ Error loading model: {e}")
    
    def preprocess_image(self, image_data: bytes, target_size: tuple = (224, 224)) -> np.ndarray:
        """Preprocess image for model prediction"""
        try:
            # Load image from bytes
            image = Image.open(io.BytesIO(image_data)).convert('RGB')
            
            # Resize to target size
            image = image.resize(target_size)
            
            # Convert to numpy array and normalize
            img_array = np.array(image).astype(np.float32) / 255.0
            
            # Add batch dimension
            img_array = np.expand_dims(img_array, axis=0)
            
            return img_array
        except Exception as e:
            print(f"Error preprocessing image: {e}")
            return None
    
    def predict(self, image_data: bytes) -> dict:
        """Make prediction on image"""
        if self.model is None:
            return {
                "error": "Model not loaded",
                "condition": "خطأ",
                "confidence": "0",
                "explanation": "فشل تحميل النموذج المحلي",
                "treatment": "يرجى المحاولة لاحقاً",
                "recommendation": False
            }
        
        try:
            # Preprocess image
            img_array = self.preprocess_image(image_data)
            
            if img_array is None:
                raise Exception("Failed to preprocess image")
            
            # Make prediction
            predictions = self.model.predict(img_array, verbose=0)
            class_idx = int(np.argmax(predictions[0]))
            confidence = float(np.max(predictions[0])) * 100
            
            # Get class names
            long_class_name = self.classes[class_idx] if class_idx < len(self.classes) else "غير محدد"
            short_class_name = self.class_labels.get(long_class_name, long_class_name)
            info = self.medical_info.get(long_class_name, {})
            
            return {
                "condition": short_class_name,
                "confidence": f"{confidence:.1f}",
                "explanation": info.get("description", "يرجى زيارة طبيب الأسنان"),
                "treatment": info.get("treatment", "استشارة طبية مطلوبة"),
                "recommendation": True  # Always recommend dentist visit
            }
        
        except Exception as e:
            print(f"Prediction error: {e}")
            return {
                "error": str(e),
                "condition": "خطأ في التحليل",
                "confidence": "0",
                "explanation": "حدث خطأ أثناء تحليل الصورة",
                "treatment": "يرجى محاولة صورة أخرى",
                "recommendation": False
            }

