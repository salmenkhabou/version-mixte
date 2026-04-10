import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "../ui/card";
import { ArrowLeft, Users, Zap } from "lucide-react";

const challenges = [
  "أرسل رسالة على الإنستغرام لشخص عشوائي من أصدقائك وقل له 'أشتقت إليك'",
  "انشر ستوري على الإنستغرام واكتب 'أحب فلان' واذكر اسم شخص يختاره المجموعة",
  "أرسل رسالة واتساب لآخر شخص تحدثت معه وقل له 'أحبك'",
  "اتصل بشخص عشوائي من جهات الاتصال وقل له شيء رومانسي",
  "انشر منشور على الفيسبوك واكتب 'أبحث عن علاقة جدية'",
  "أرسل صورة سيلفي مثيرة لآخر 3 أشخاص تحدثت معهم على الواتساب",
  "أرسل رسالة لحبيبك السابق وقل له 'أشتقت إليك'",
  "أرسل رسالة صوتية لشخص يختاره المجموعة وقل له 'أحبك وأريد أن أراك الليلة'",
  "انشر ستوري على السناب شات واكتب 'متاح للتعارف'",
  "أرسل رسالة لـ 5 أشخاص واسألهم إذا كانوا يريدون الخروج معك",
  "اتصل بشخص عشوائي وقل له 'هل تريد أن نتقابل الليلة؟'",
  "أرسل صورة جسمك لشخص يختاره المجموعة",
  "انشر على الإنستغرام لايف وقل 'أنا عاشق ومجنون'",
  "أرسل رسالة لشخص وقل له 'تعال قابلني الليلة'",
  "أرسل رسالة صوتية مثيرة لآخر شخص تحدثت معه",
  "انشر منشور على الفيسبوك واكتب 'أريد حبيب جديد'",
  "أرسل رسالة لحبيبك السابق وقل له 'أريد أن أراك'",
  "اتصل بشخص وقل له 'أحبك منذ فترة طويلة'",
  "أرسل صورة مثيرة على الواتساب لشخص يختاره المجموعة",
  "انشر ستوري على الإنستغرام واكتب 'أبحث عن المتعة'",
  "أرسل رسالة لـ 3 أشخاء وقل لهم 'أريد أن أخرج معك'",
  "اتصل بشخص عشوائي وقل له كلمات رومانسية",
  "أرسل رسالة واتساب لشخص وقل له 'أنت جميل جداً'",
  "انشر على الإنستغرام صورة واكتب 'أبحث عن الحب الحقيقي'",
  "أرسل رسالة صوتية مثيرة لشخص يختاره المجموعة وقل له 'أشتقت إليك'",
];

export default function FingerSelectionGame({ isMobile, setCurrentGame, isDarkMode }) {
  const [gameState, setGameState] = useState("waiting");
  const [touches, setTouches] = useState([]);
  const [selectedFinger, setSelectedFinger] = useState(null);
  const [currentChallenge, setCurrentChallenge] = useState("");
  const [countdown, setCountdown] = useState(0);
  const gameAreaRef = useRef(null);

  const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#ffeaa7", "#dda0dd", "#98d8c8", "#f7dc6f"];

  useEffect(() => {
    let interval;
    if (countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0 && gameState === "detecting") {
      selectRandomFinger();
    }
    return () => clearInterval(interval);
  }, [countdown, gameState]);

  const handleStart = (e) => {
    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    let newTouches = [];

    if (e.touches) {
      // Touch event
      newTouches = Array.from(e.touches).map((touch, index) => ({
        id: touch.identifier,
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        color: colors[index % colors.length],
      }));
    } else {
      // Mouse event
      newTouches = [{
        id: Date.now(),
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        color: colors[0],
      }];
    }

    setTouches(newTouches);

    if (newTouches.length >= 1 && gameState === "waiting") {
      setGameState("detecting");
      setCountdown(3);
    }
  };

  const handleMove = (e) => {
    if (gameState !== "detecting") return;

    const rect = gameAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    let updatedTouches = [];

    if (e.touches) {
      updatedTouches = Array.from(e.touches).map((touch, index) => ({
        id: touch.identifier,
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
        color: colors[index % colors.length],
      }));
    }

    setTouches(updatedTouches);
  };

  const handleEnd = (e) => {
    if ((e.touches && e.touches.length === 0) || !e.touches) {
      setTouches([]);
      if (gameState === "detecting") {
        setGameState("waiting");
        setCountdown(0);
      }
    }
  };

  const selectRandomFinger = () => {
    if (touches.length === 0) return;

    const randomIndex = Math.floor(Math.random() * touches.length);
    setSelectedFinger(randomIndex);
    setGameState("selected");

    setTimeout(() => {
      const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
      setCurrentChallenge(randomChallenge);
      setGameState("challenge");
    }, 2000);
  };

  const resetGame = () => {
    setGameState("waiting");
    setTouches([]);
    setSelectedFinger(null);
    setCurrentChallenge("");
    setCountdown(0);
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDarkMode 
          ? 'bg-gradient-to-br from-purple-900 via-pink-900 to-red-900' 
          : 'bg-gradient-to-br from-purple-100 via-pink-100 to-red-100'
      } ${isMobile ? "px-4 py-6 pb-24" : "px-8 py-12 pb-8"}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => setCurrentGame("menu")}
          className={`rounded-xl p-3 transition-all duration-300 ${
            isDarkMode 
              ? 'text-white hover:bg-white/20' 
              : 'text-gray-800 hover:bg-black/10'
          }`}
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="text-center flex-1">
          <h1
            className={`font-bold ${isMobile ? "text-2xl" : "text-4xl"} mb-2 transition-colors ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}
          >
            👆 لعبة اختيار الإصبع
          </h1>
          <div className={`flex items-center justify-center gap-2 ${
            isDarkMode ? 'text-red-200' : 'text-red-700'
          }`}>
            <span className="text-2xl">🔞</span>
            <span className="font-semibold">للبالغين فقط +18</span>
          </div>
        </div>
        <div className="w-12"></div>
      </div>

      {/* Game Area */}
      <div className="flex flex-col items-center">
        {gameState === "waiting" && (
          <div className={`backdrop-blur-sm border shadow-2xl max-w-md w-full rounded-2xl animate-pulse ${
            isDarkMode 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white/95 border-gray-200'
          }`}>
            <div className="p-8 text-center">
              <div className="text-6xl mb-6 animate-bounce">👆</div>
              <h2 className={`text-2xl font-bold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-800'
              }`}>ضعوا أصابعكم على الشاشة</h2>
              <p className={`mb-6 ${
                isDarkMode ? 'text-white/70' : 'text-gray-600'
              }`}>يجب أن يضع لاعب واحد على الأقل إصبعه على الشاشة</p>
              <div className={`flex items-center justify-center gap-4 text-sm ${
                isDarkMode ? 'text-white/60' : 'text-gray-500'
              }`}>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  <span>1+ لاعبين</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  <span>تحديات جريئة</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {gameState === "detecting" && (
          <div className={`backdrop-blur-sm border shadow-2xl max-w-md w-full rounded-2xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white/95 border-gray-200'
          }`}>
            <div className="p-8 text-center">
              <div className="text-6xl mb-6">⏰</div>
              <h2 className={`text-3xl font-bold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-800'
              }`}>{countdown}</h2>
              <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>جاري الاختيار...</p>
              <div className={`mt-4 text-sm ${
                isDarkMode ? 'text-white/60' : 'text-gray-500'
              }`}>تم اكتشاف {touches.length} أصابع</div>
            </div>
          </div>
        )}

        {gameState === "selected" && selectedFinger !== null && (
          <div className={`backdrop-blur-sm border shadow-2xl max-w-md w-full rounded-2xl ${
            isDarkMode 
              ? 'bg-white/10 border-white/20' 
              : 'bg-white/95 border-gray-200'
          }`}>
            <div className="p-8 text-center">
              <div className="text-6xl mb-6">🎯</div>
              <h2 className={`text-2xl font-bold mb-4 ${
                isDarkMode ? 'text-white' : 'text-gray-800'
              }`}>تم الاختيار!</h2>
              <div
                className="w-16 h-16 rounded-full mx-auto mb-4 animate-pulse shadow-lg"
                style={{ backgroundColor: touches[selectedFinger]?.color }}
              ></div>
              <p className={isDarkMode ? 'text-white/70' : 'text-gray-600'}>الإصبع المختار هو الإصبع الملون</p>
            </div>
          </div>
        )}

        {gameState === "challenge" && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className={`shadow-2xl max-w-2xl w-full rounded-2xl transform transition-all duration-500 scale-100 ${
              isDarkMode 
                ? 'bg-gradient-to-br from-red-600 to-pink-600' 
                : 'bg-gradient-to-br from-red-400 to-pink-400'
            }`}>
              <div className="p-8 text-center">
                <div className="text-6xl mb-6 animate-bounce">🔥</div>
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-6">تحديك الجريء!</h2>
                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-6 min-h-[120px] flex items-center justify-center">
                  <p className="text-white text-base md:text-lg leading-relaxed font-medium">{currentChallenge}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={resetGame}
                    className={`font-bold px-8 py-3 rounded-xl transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white text-red-600 hover:bg-gray-100 hover:scale-105' 
                        : 'bg-white text-red-600 hover:bg-red-50 hover:scale-105'
                    }`}
                  >
                    لعبة جديدة
                  </button>
                  <button
                    onClick={() => setGameState("waiting")}
                    className={`font-bold px-8 py-3 rounded-xl transition-all duration-300 ${
                      isDarkMode 
                        ? 'bg-white/20 text-white hover:bg-white/30 border-2 border-white/50' 
                        : 'bg-black/20 text-white hover:bg-black/30 border-2 border-white'
                    }`}
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Touch Detection Area */}
        <div
          ref={gameAreaRef}
          className={`relative backdrop-blur-sm rounded-3xl border-2 ${
            isMobile ? "w-full h-96 mt-8" : "w-full max-w-4xl h-96 mt-12"
          } overflow-hidden transition-colors cursor-pointer ${
            isDarkMode 
              ? 'bg-white/10 border-white/30 hover:border-white/50' 
              : 'bg-white/30 border-gray-300 hover:border-gray-400'
          }`}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          onMouseDown={handleStart}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          style={{ touchAction: "none" }}
        >
          {touches.map((touch, index) => (
            <div
              key={touch.id}
              className={`absolute w-16 h-16 rounded-full transform -translate-x-1/2 -translate-y-1/2 ${
                selectedFinger === index ? "animate-ping shadow-2xl scale-150" : "animate-pulse"
              }`}
              style={{
                left: touch.x,
                top: touch.y,
                backgroundColor: touch.color,
                boxShadow:
                  selectedFinger === index ? `0 0 30px ${touch.color}` : `0 0 15px ${touch.color}`,
              }}
            >
              <div className="w-full h-full rounded-full bg-white/30 flex items-center justify-center">
                <span className="text-white font-bold text-lg">{index + 1}</span>
              </div>
            </div>
          ))}

          {gameState === "waiting" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`text-center ${
                isDarkMode ? 'text-white/60' : 'text-gray-600'
              }`}>
                <div className="text-4xl mb-4">👋</div>
                <p className="text-lg font-medium">ضعوا أصابعكم هنا</p>
                <p className="text-sm mt-2">أو انقر بالماوس للتجربة</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
