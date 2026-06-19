from flask import Flask, request, jsonify
from flask_cors import CORS
from utils.model_loader import DentalModelLoader
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize model loader
model_loader = DentalModelLoader()

@app.route('/health', methods=['GET'])
def health_check():
    """Check if backend is running and model is loaded"""
    model_loaded = model_loader.model is not None
    return jsonify({
        "status": "healthy" if model_loaded else "model_not_loaded",
        "model_loaded": model_loaded,
        "classes": len(model_loader.classes),
        "class_labels": list(model_loader.class_labels.values())
    }), 200 if model_loaded else 503

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict dental condition from image
    
    Args:
        file: Image file (JPEG, PNG, etc.)
    
    Returns:
        JSON with prediction results
    """
    try:
        # Check if model is loaded
        if model_loader.model is None:
            return jsonify({
                "error": "Model not loaded",
                "status": "model_not_loaded"
            }), 503
        
        # Check if file is in request
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Read file content
        contents = file.read()
        
        if not contents:
            return jsonify({"error": "File is empty"}), 400
        
        # Make prediction
        result = model_loader.predict(contents)
        
        return jsonify(result), 200
    
    except Exception as e:
        print(f"Error in /predict endpoint: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze dental image (alias for /predict)"""
    return predict()

@app.route('/', methods=['GET'])
def root():
    """API information"""
    return jsonify({
        "name": "ACU Dental AI - Local Model Backend",
        "version": "1.0.0",
        "endpoints": {
            "/health": "GET - Check API and model status",
            "/predict": "POST - Analyze dental image",
            "/analyze": "POST - Alias for /predict"
        },
        "model_info": {
            "type": "Keras H5 Model",
            "classes": model_loader.classes,
            "status": "loaded" if model_loader.model else "not_found"
        }
    }), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
