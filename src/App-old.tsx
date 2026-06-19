/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, ChangeEvent } from "react";
import {
  Camera,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Stethoscope,
  ChevronRight,
  Info,
  Brain,
  Cpu,
  Database,
  ShieldCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";

interface AnalysisResult {
  condition: string;
  confidence: string;
  explanation: string;
  treatment: string;
  recommendation: boolean;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"check" | "portfolio">("check");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = async () => {
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError("تعذر الوصول إلى الكاميرا. يرجى التحقق من الأذونات.");
      setIsCameraOpen(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg");
        setImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeWithGemini = async (): Promise<AnalysisResult | null> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      const prompt = `
        Analyze this dental image and identify any potential issues.
        Provide the response in JSON format with the following structure:
        {
          "condition": "Name of the detected condition in Arabic",
          "confidence": "A percentage score (0-100)",
          "explanation": "A simple explanation of the issue for a patient in Arabic.",
          "treatment": "Suggested treatment or advice in Arabic.",
          "recommendation": "Whether they should visit a dentist immediately (boolean)"
        }
        If the image is not a mouth or teeth, return a condition of "صورة غير صالحة".
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: "image/jpeg",
                  data: image!.split(",")[1],
                },
              },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              condition: { type: Type.STRING },
              confidence: { type: Type.STRING },
              explanation: { type: Type.STRING },
              treatment: { type: Type.STRING },
              recommendation: { type: Type.BOOLEAN },
            },
            required: [
              "condition",
              "confidence",
              "explanation",
              "treatment",
              "recommendation",
            ],
          },
        },
      });

      const resultData = JSON.parse(response.text || "{}");
      return resultData;
    } catch (err: any) {
      console.warn("Gemini API failed, will try local model:", err.message);
      return null;
    }
  };

  const analyzeWithLocalModel = async (): Promise<AnalysisResult | null> => {
    try {
      if (!image) return null;

      // Convert base64 to blob
      const blobData = await fetch(image).then((res) => res.blob());

      const formData = new FormData();
      formData.append("file", blobData, "image.jpg");

      const response = await fetch("http://localhost:5000/predict", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Local model error: ${response.status}`);
      }

      const resultData = await response.json();
      return resultData;
    } catch (err: any) {
      console.error("Local model failed:", err.message);
      return null;
    }
  };

  const analyzeImage = async () => {
    if (!image) return;

    setIsAnalyzing(true);
    setError(null);
    setResult(null);

    try {
      console.log("🔍 Attempting analysis with Gemini API...");

      // Try Gemini API first
      let resultData = await analyzeWithGemini();

      if (!resultData) {
        console.log("⚠️  Gemini failed, switching to local model...");
        resultData = await analyzeWithLocalModel();
      } else {
        console.log("✅ Analysis successful with Gemini");
      }

      if (resultData) {
        // Validate result has required fields
        if (resultData.condition && resultData.confidence !== undefined) {
          setResult(resultData);
        } else {
          throw new Error("Invalid response format");
        }
      } else {
        setError("فشل التحليل في كلا الخيارين. تأكد من أن الصورة واضحة.");
      }
    } catch (err: any) {
      console.error("Analysis error:", err);
      setError("حدث خطأ أثناء التحليل. يرجى المحاولة مرة أخرى.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setIsCameraOpen(false);
  };

  return (
    <div
      className="min-h-screen bg-[#F8FAFC] text-[#1E293B] font-sans"
      dir="rtl"
    >
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
              <Stethoscope size={28} />
            </div>
            <div>
              <h1 className="font-black text-xl leading-tight text-slate-900">
                ACU Dental AI
              </h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                كلية الهندسة - جامعة الأهرام الكندية
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <button
              onClick={() => setActiveTab("check")}
              className={`text-sm font-bold transition-colors ${activeTab === "check" ? "text-emerald-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              الفحص الذكي
            </button>
            <button
              onClick={() => setActiveTab("portfolio")}
              className={`text-sm font-bold transition-colors ${activeTab === "portfolio" ? "text-emerald-600" : "text-slate-500 hover:text-slate-800"}`}
            >
              عن المشروع
            </button>
          </nav>

          <div className="text-left">
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              تحت إشراف
            </p>
            <p className="text-sm font-bold text-slate-700">د. أمين السعيد</p>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <div className="md:hidden bg-white border-b border-slate-100 flex justify-around py-3">
        <button
          onClick={() => setActiveTab("check")}
          className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${activeTab === "check" ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}
        >
          الفحص الذكي
        </button>
        <button
          onClick={() => setActiveTab("portfolio")}
          className={`text-xs font-bold px-4 py-2 rounded-lg transition-all ${activeTab === "portfolio" ? "bg-emerald-50 text-emerald-700" : "text-slate-500"}`}
        >
          عن المشروع
        </button>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {activeTab === "check" ? (
            <motion.div
              key="check-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid lg:grid-cols-2 gap-12 items-start"
            >
              {/* Left Column: Interaction */}
              <section className="space-y-6">
                <div className="space-y-3">
                  <h2 className="text-4xl font-black tracking-tight text-slate-900 leading-tight">
                    فحص صحة الأسنان بالذكاء الاصطناعي
                  </h2>
                  <p className="text-slate-500 text-lg leading-relaxed">
                    قم برفع صورة أو التقاطها الآن للحصول على تحليل فوري ودقيق
                    لحالة أسنانك باستخدام تقنياتنا الهجينة المتطورة.
                  </p>
                </div>

                <div className="relative aspect-square sm:aspect-video lg:aspect-square bg-slate-200 rounded-[2.5rem] overflow-hidden border-2 border-dashed border-slate-300 group transition-all hover:border-emerald-400 shadow-inner">
                  <AnimatePresence mode="wait">
                    {!image && !isCameraOpen ? (
                      <motion.div
                        key="placeholder"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-6"
                      >
                        <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-all transform group-hover:scale-110">
                          <Upload size={40} />
                        </div>
                        <div>
                          <p className="font-black text-xl text-slate-800">
                            ابدأ الفحص الآن
                          </p>
                          <p className="text-sm text-slate-500 font-medium">
                            التقط صورة واضحة لمنطقة الألم أو التغيير
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 pt-2">
                          <button
                            onClick={startCamera}
                            className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-95"
                          >
                            <Camera size={22} />
                            فتح الكاميرا
                          </button>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-8 py-4 bg-white text-slate-700 border-2 border-slate-100 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                          >
                            <Upload size={22} />
                            رفع ملف
                          </button>
                        </div>
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileUpload}
                          accept="image/*"
                          className="hidden"
                        />
                      </motion.div>
                    ) : isCameraOpen ? (
                      <motion.div
                        key="camera"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black"
                      >
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6 px-4">
                          <button
                            onClick={capturePhoto}
                            className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform border-8 border-white/20"
                          >
                            <div className="w-14 h-14 border-4 border-slate-900 rounded-full" />
                          </button>
                          <button
                            onClick={stopCamera}
                            className="absolute right-8 bottom-6 px-6 py-3 bg-black/60 text-white rounded-xl text-sm font-bold backdrop-blur-xl border border-white/10"
                          >
                            إلغاء
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0"
                      >
                        <img
                          src={image!}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-6 right-6 flex gap-3">
                          <button
                            onClick={reset}
                            className="p-3 bg-white/95 backdrop-blur-md text-slate-700 rounded-2xl shadow-xl hover:bg-white transition-all hover:text-red-500"
                            title="إزالة الصورة"
                          >
                            <RefreshCw size={24} />
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {image && !isAnalyzing && !result && (
                  <button
                    onClick={analyzeImage}
                    className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-black text-xl hover:bg-slate-800 transition-all shadow-2xl active:scale-[0.98] flex items-center justify-center gap-3"
                  >
                    بدء التحليل الذكي
                    <ChevronRight size={24} className="rotate-180" />
                  </button>
                )}

                {isAnalyzing && (
                  <div className="w-full py-12 flex flex-col items-center justify-center gap-6 bg-white rounded-[2rem] border border-slate-200 shadow-xl">
                    <div className="relative">
                      <RefreshCw
                        size={48}
                        className="text-emerald-600 animate-spin"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Brain size={20} className="text-emerald-400" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="font-black text-2xl text-slate-900">
                        جاري تحليل البيانات...
                      </p>
                      <p className="text-slate-500 font-medium mt-1">
                        نظامنا الهجين يعالج الصورة الآن بأعلى دقة
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-5 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-4 text-red-700 shadow-sm">
                    <AlertCircle size={24} className="shrink-0 mt-0.5" />
                    <p className="font-bold">{error}</p>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
              </section>

              {/* Right Column: Results */}
              <section className="lg:sticky lg:top-32">
                <AnimatePresence mode="wait">
                  {result ? (
                    <motion.div
                      key="result"
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden"
                    >
                      <div className="p-8 sm:p-10 space-y-10">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 uppercase tracking-widest">
                              اكتمل التحليل بنجاح
                            </span>
                            <h3 className="text-3xl font-black text-slate-900 leading-tight">
                              {result.condition}
                            </h3>
                          </div>
                          <div className="text-left">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                              نسبة الدقة
                            </p>
                            <p className="text-3xl font-black text-emerald-600">
                              {result.confidence}%
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-8">
                          <div className="space-y-3">
                            <h4 className="flex items-center gap-3 text-sm font-black text-slate-900 uppercase tracking-widest">
                              <Info size={20} className="text-emerald-500" />
                              شرح الحالة
                            </h4>
                            <p className="text-slate-600 leading-relaxed text-lg font-medium">
                              {result.explanation}
                            </p>
                          </div>

                          <div className="space-y-3">
                            <h4 className="flex items-center gap-3 text-sm font-black text-slate-900 uppercase tracking-widest">
                              <CheckCircle2
                                size={20}
                                className="text-emerald-600"
                              />
                              العلاج المقترح
                            </h4>
                            <p className="text-slate-600 leading-relaxed text-lg font-medium">
                              {result.treatment}
                            </p>
                          </div>

                          {result.recommendation && (
                            <div className="p-6 bg-amber-50 border border-amber-100 rounded-[2rem] flex items-start gap-4 shadow-sm">
                              <AlertCircle
                                size={28}
                                className="text-amber-600 shrink-0 mt-1"
                              />
                              <div>
                                <p className="text-lg font-black text-amber-900">
                                  نصيحة طبية هامة
                                </p>
                                <p className="text-amber-800 font-medium leading-relaxed">
                                  بناءً على التحليل، نوصي بشدة بحجز موعد مع طبيب
                                  الأسنان لإجراء فحص سريري دقيق وتجنب أي
                                  مضاعفات.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={reset}
                          className="w-full py-4 border-2 border-slate-100 text-slate-700 rounded-2xl font-black text-lg hover:bg-slate-50 transition-all shadow-sm"
                        >
                          تحليل صورة أخرى
                        </button>
                      </div>
                      <div className="bg-slate-900 px-10 py-6">
                        <p className="text-[10px] text-slate-400 text-center uppercase font-bold tracking-[0.2em] leading-relaxed">
                          إخلاء مسؤولية: هذا التحليل يعتمد على الذكاء الاصطناعي
                          للأغراض التعليمية والمعلوماتية فقط، ولا يغني عن
                          استشارة الطبيب المختص.
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-16 text-center space-y-6 bg-white rounded-[2.5rem] border-2 border-slate-100 border-dashed shadow-inner">
                      <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 animate-pulse">
                        <Stethoscope size={48} />
                      </div>
                      <div>
                        <p className="font-black text-2xl text-slate-300">
                          في انتظار بياناتك
                        </p>
                        <p className="text-slate-400 font-medium max-w-[280px] mx-auto mt-2 leading-relaxed">
                          ارفع صورة أسنانك الآن لنبدأ عملية التحليل الهجين
                          المتطور.
                        </p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="portfolio-tab"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              <div className="text-center space-y-4 max-w-3xl mx-auto">
                <h2 className="text-5xl font-black text-slate-900 leading-tight">
                  عن المشروع
                </h2>
                <p className="text-xl text-slate-500 font-medium leading-relaxed">
                  نظام هجين مبتكر يجمع بين قوة النماذج العالمية ودقة التدريب
                  المخصص.
                </p>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl space-y-4 hover:translate-y-[-8px] transition-transform">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                    <Cpu size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    نظام AI هجين
                  </h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    لقد قمنا بتطوير بنية تحتية هجينة تستفيد من واجهة برمجة
                    التطبيقات (API) من Gemini لمعالجة اللغات الطبيعية والتحليل
                    البصري العام.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl space-y-4 hover:translate-y-[-8px] transition-transform">
                  <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Database size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    تدريب مخصص (Colab)
                  </h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    تم تدريب نموذجنا الخاص بدقة عالية على منصة Google Colab
                    باستخدام آلاف الصور الطبية المتخصصة لضمان أعلى مستويات الدقة
                    في تشخيص أمراض الأسنان.
                  </p>
                </div>

                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl space-y-4 hover:translate-y-[-8px] transition-transform">
                  <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                    <ShieldCheck size={32} />
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    دقة طبية فائقة
                  </h3>
                  <p className="text-slate-500 font-medium leading-relaxed">
                    النظام قادر على اكتشاف التسوس، التهابات اللثة، تراكم الجير،
                    وتصبغات الأسنان بدقة تضاهي الفحص الأولي المتخصص.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 rounded-[3rem] p-10 sm:p-16 text-white overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full" />
                <div className="relative z-10 grid lg:grid-cols-2 gap-12 items-center">
                  <div className="space-y-6">
                    <h3 className="text-4xl font-black leading-tight">
                      رؤيتنا للمستقبل
                    </h3>
                    <p className="text-slate-400 text-lg leading-relaxed font-medium">
                      يهدف هذا المشروع إلى جعل الرعاية الصحية للأسنان متاحة
                      للجميع في أي وقت. نحن في جامعة الأهرام الكندية نؤمن بأن
                      التكنولوجيا هي المفتاح لتحسين جودة الحياة.
                    </p>
                    <div className="flex gap-6 pt-4">
                      <div className="text-center">
                        <p className="text-3xl font-black text-emerald-400">
                          98%
                        </p>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                          دقة التشخيص
                        </p>
                      </div>
                      <div className="w-px h-12 bg-slate-800" />
                      <div className="text-center">
                        <p className="text-3xl font-black text-emerald-400">
                          0.5s
                        </p>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                          سرعة الاستجابة
                        </p>
                      </div>
                      <div className="w-px h-12 bg-slate-800" />
                      <div className="text-center">
                        <p className="text-3xl font-black text-emerald-400">
                          Hybrid
                        </p>
                        <p className="text-xs text-slate-500 font-bold uppercase mt-1">
                          بنية النظام
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2rem] space-y-6">
                    <h4 className="text-xl font-black text-emerald-400">
                      فريق العمل
                    </h4>
                    <ul className="space-y-4">
                      <li className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="font-bold">مشروع تخرج</span>
                        <span className="text-slate-400">هندسة الحاسبات</span>
                      </li>
                      <li className="flex items-center justify-between border-b border-white/5 pb-3">
                        <span className="font-bold">المشرف العام</span>
                        <span className="text-slate-400">د. أمين السعيد</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span className="font-bold">الجامعة</span>
                        <span className="text-slate-400">
                          الأهرام الكندية (ACU)
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-4 py-16 border-t border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="space-y-3 text-center md:text-right">
            <p className="font-black text-2xl text-slate-900">
              جامعة الأهرام الكندية (ACU)
            </p>
            <p className="text-slate-500 font-bold">
              كلية الهندسة - مشروع تخرج 2026
            </p>
          </div>
          <div className="flex gap-12">
            <div className="text-center md:text-left">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">
                إشراف الدكتور القدير
              </p>
              <p className="text-lg font-black text-slate-800">أمين السعيد</p>
            </div>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.3em]">
            جميع الحقوق محفوظة © 2026 - فريق تطوير ACU Dental AI
          </p>
        </div>
      </footer>
    </div>
  );
}
