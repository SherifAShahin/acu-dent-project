from flask import Flask, request, render_template, send_from_directory, session, redirect, url_for, jsonify
from tensorflow.keras.models import load_model
from tensorflow.keras.preprocessing import image
import numpy as np
import os
from PIL import Image
import json

# ------------------ Gemini ------------------
import google.generativeai as genai
# ضع هنا مفتاح API الخاص بك أو احفظه في env variables
os.environ["GOOGLE_API_KEY"] = "AIzaSyAVz9_1qBkA4MIWEscdozjgAn-EX2nI7eM"
genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

SYSTEM_INSTRUCTION = """
You are a warm, professional, and knowledgeable Dental Assistant AI named "ToothFairy" 
for a dental clinic called "Bright Smiles Dental".
Responsibilities:
1. Patient Education: Answer questions about dental procedures, oral hygiene, and pain management.
2. Scheduling: Ask for preferred time if they want to book, then confirm a receptionist will call.
3. Pricing: Give ranges with disclaimers.
4. Emergency: Advise immediate visit for severe cases.
Tone: Empathetic, calm, concise.
"""
gemini_model = genai.GenerativeModel(model_name="gemini-2.5-flash", system_instruction=SYSTEM_INSTRUCTION)

def chat_with_ai(user_input):
    try:
        if 'chat_history' not in session:
            session['chat_history'] = []

        # تجهيز history للـ Gemini
        history_for_gemini = []
        for msg in session['chat_history']:
            role = "user" if msg['sender'] == 'user' else "model"
            history_for_gemini.append({'role': role, 'parts': [msg['text']]})

        chat = gemini_model.start_chat(history=history_for_gemini)
        response = chat.send_message(user_input)
        bot_reply = response.text

        # تحديث الـ session
        session['chat_history'].append({'sender': 'user', 'text': user_input})
        session['chat_history'].append({'sender': 'bot', 'text': bot_reply})
        session.modified = True
        return bot_reply

    except Exception as e:
        print(f"Error calling Gemini: {e}")
        return "I apologize, I'm having trouble connecting to the dental AI right now. Please try again."

# ------------------ إعداد Flask ------------------
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads/'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
app.secret_key = os.urandom(24)

# ------------------ تحميل الموديل ------------------
model = load_model('dental_model_best.h5')

# ------------------ الفئات ------------------
classes = [
    "Calculus",
    "Caries_Gingivitus_ToothDiscoloration_Ulcer-yolo_annotated-Dataset",
    "Data caries",
    "Gingivitis",
    "Mouth Ulcer",
    "Tooth Discoloration",
    "hypodontia"
]

class_mapping = {
    "Calculus": "Calculus",
    "Caries_Gingivitus_ToothDiscoloration_Ulcer-yolo_annotated-Dataset": "Caries_Ulcer_Discoloration",
    "Data caries": "Data_Caries",
    "Gingivitis": "Gingivitis",
    "Mouth Ulcer": "Mouth_Ulcer",
    "Tooth Discoloration": "Tooth_Discoloration",
    "hypodontia": "Hypodontia"
}

medical_info = {
    "Caries_Ulcer_Discoloration": {"description": "Multiple tooth issues.", "treatment": "Dental filling, cleaning, whitening."},
    "Data_Caries": {"description": "Tooth decay.", "treatment": "Dental filling and hygiene."},
    "Gingivitis": {"description": "Gum inflammation.", "treatment": "Professional cleaning."},
    "Calculus": {"description": "Hardened plaque.", "treatment": "Scaling."},
    "Mouth_Ulcer": {"description": "Painful sores.", "treatment": "Topical meds."},
    "Tooth_Discoloration": {"description": "Change in tooth color.", "treatment": "Whitening."},
    "Hypodontia": {"description": "Missing teeth.", "treatment": "Implants/orthodontics."}
}

# ------------------ دوال مساعدة ------------------
def prepare_image(img_path):
    try:
        img = Image.open(img_path).convert('RGB')
        if img.size != (224,224):
            img = img.resize((224,224))
            img.save(img_path)
        img_array = image.img_to_array(img)/255.0
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except:
        return None

def resize_image_to_224(img_path):
    try:
        img = Image.open(img_path).convert('RGB')
        original_size = img.size
        if original_size != (224, 224):
            img = img.resize((224,224))
            img.save(img_path)
        new_size = Image.open(img_path).size
        return original_size, new_size
    except:
        return None, None

def predict_image(img_path):
    img_array = prepare_image(img_path)
    if img_array is None:
        raise ValueError("الصورة غير صالحة أو غير مدعومة")
    
    pred = model.predict(img_array)
    if pred.size == 0:
        raise ValueError("Prediction فشلت، الصورة ممكن تكون غير مناسبة للموديل")

    class_index = int(np.argmax(pred))
    long_class_name = classes[class_index]
    short_class_name = class_mapping[long_class_name]
    info = medical_info[short_class_name]
    return short_class_name, info

def analyze_symptoms(symptoms_text, predicted_label, info):
    # نسخة مبسطة مع الحفاظ على النصائح الطبية
    return f"AI Summary Placeholder for: {predicted_label or 'No image'}, symptoms: {symptoms_text or 'None'}"

# ------------------ Routes ------------------
@app.route('/', methods=['GET','POST'])
def index():
    if not session.get('logged_in'):
        return redirect(url_for('login'))
    if request.method == 'POST':
        img_file = request.files.get('image')
        symptoms_text = request.form.get('symptoms', '').strip()
        action = request.form.get('action')

        if img_file and action == 'check_size':
            try:
                filename = img_file.filename.encode('ascii','ignore').decode('ascii')
                path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                img_file.save(path)
                original, new = resize_image_to_224(path)
                if original is None:
                    return render_template('index.html', error='Invalid image or unsupported format')
                return render_template('index.html', size_checked=True, original_size=original, new_size=new, img_filename=filename)
            except Exception as e:
                return render_template('index.html', error=str(e))

        if img_file and action == 'predict':
            try:
                filename = img_file.filename.encode('ascii','ignore').decode('ascii')
                path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                img_file.save(path)
                pred_label, info = predict_image(path)
                ai_result = analyze_symptoms(symptoms_text, pred_label, info)
                return render_template('index.html',
                                       prediction=pred_label,
                                       description=info['description'],
                                       treatment=info['treatment'],
                                       img_filename=filename,
                                       ai_result=ai_result)
            except Exception as e:
                return render_template('index.html', error=str(e))

        if (not img_file) and action == 'predict' and symptoms_text:
            try:
                ai_result = analyze_symptoms(symptoms_text, None, {})
                return render_template('index.html', ai_result=ai_result, symptoms=symptoms_text)
            except Exception as e:
                return render_template('index.html', error=str(e))
    return render_template('index.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        if not username:
            return render_template('login.html', error='أدخل اسم المستخدم')
        if password == '01019808098':
            session['logged_in'] = True
            session['username'] = username
            return redirect(url_for('index'))
        return render_template('login.html', error='خطأ في اسم المستخدم أو كلمة المرور')
    return render_template('login.html')


@app.route('/chat', methods=['GET','POST'])
def chat():
    # Redirect any /chat requests to the external Be2 model site
    return redirect("https://be2-dental-ai.netlify.app/")


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
