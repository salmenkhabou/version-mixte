import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Coffee, Zap, Check, Users, X, Target, AlertTriangle, Trophy } from "lucide-react";



// Prompts for all ages
const prompts = [
    {
        id: 1,
        text: "سمي 3 حاجات كي تفيق في الصباح",
        category: "روتين",
        difficulty: "easy",
        points: 10,
        examples: ["غسل الوجه", "شرب قهوة", "فطور", "تفريش السنان", "تفقد الهاتف"],
    },
    {
        id: 2,
        text: "سمي 3 أنواع قهوة تونسية",
        category: "قهوة",
        difficulty: "easy",
        points: 10,
        examples: ["قهوة عربي", "قهوة بالحليب", "قهوة بالزنجبيل", "قهوة بالقرفة", "قهوة خفيفة"],
    },
    {
        id: 3,
        text: "سمي 3 مدن تونسية",
        category: "جغرافيا",
        difficulty: "easy",
        points: 10,
        examples: ["تونس", "صفاقس", "سوسة", "نابل", "بنزرت", "قابس"],
    },
    {
        id: 4,
        text: "سمي 3 أكلات تونسية",
        category: "طعام",
        difficulty: "easy",
        points: 10,
        examples: ["كسكسي", "مقرونة", "لبلابي", "مرقة", "سلاطة مشوية"],
    },
    {
        id: 5,
        text: "سمي 3 مغنيين تونسيين",
        category: "موسيقى",
        difficulty: "easy",
        points: 10,
        examples: ["صابر الرباعي", "لطفي بوشناق", "ذكرى", "سعاد ماهر", "أمينة فاخت"],
    },
    {
        id: 6,
        text: "سمي 3 أماكن سياحية في تونس",
        category: "سياحة",
        difficulty: "medium",
        points: 15,
        examples: ["قرطاج", "سيدي بوسعيد", "الحمامات", "جربة", "توزر"],
    },
    {
        id: 7,
        text: "سمي 3 أنواع حلويات تونسية",
        category: "حلويات",
        difficulty: "medium",
        points: 15,
        examples: ["بقلاوة", "كعك ورقة", "مقروض", "زلابية", "بمبالوني"],
    },
    {
        id: 8,
        text: "سمي 3 مشروبات غير القهوة",
        category: "مشروبات",
        difficulty: "medium",
        points: 15,
        examples: ["شاي", "عصير برتقال", "ليموناضة", "ماء", "حليب"],
    },
    {
        id: 9,
        text: "سمي 3 أفلام تونسية",
        category: "سينما",
        difficulty: "medium",
        points: 15,
        examples: ["صيف حلق الوادي", "الخشخاش", "عصفور السطح", "داكرة", "حكايات تونسية"],
    },
    {
        id: 10,
        text: "سمي 3 أنواع توابل تونسية",
        category: "طبخ",
        difficulty: "medium",
        points: 15,
        examples: ["فلفل", "كمون", "كركم", "قرفة", "زعتر"],
    },
    {
        id: 11,
        text: "سمي 3 كلمات تونسية ما يفهمهاش العرب",
        category: "لغة",
        difficulty: "hard",
        points: 20,
        examples: ["فيسع", "زردة", "مزيان", "برشا", "ياخي"],
    },
    {
        id: 12,
        text: "سمي 3 أمثال تونسية",
        category: "ثقافة",
        difficulty: "hard",
        points: 20,
        examples: ["اللي يحب الزين يصبر للشين", "الكذاب حافظ مش فاهم", "الباب اللي يجيك منو الريح سدو واستريح"],
    },
    {
        id: 13,
        text: "سمي 3 مناطق في تونس العاصمة",
        category: "جغرافيا",
        difficulty: "hard",
        points: 20,
        examples: ["باب بحر", "المرسى", "حلق الوادي", "باردو", "المنزه"],
    },
    {
        id: 14,
        text: "سمي 3 شخصيات تاريخية تونسية",
        category: "تاريخ",
        difficulty: "hard",
        points: 20,
        examples: ["الحبيب بورقيبة", "ابن خلدون", "حنبعل", "فرحات حشاد", "الطاهر الحداد"],
    },
    {
        id: 15,
        text: "سمي 3 أنواع رياضة يمارسوها التوانسة",
        category: "رياضة",
        difficulty: "hard",
        points: 20,
        examples: ["كرة القدم", "كرة اليد", "التنس", "السباحة", "الجري"],
    },
];

// Prompts for adults (18+)
const adultPrompts = [
    {
        id: 101,
        text: "سمي 3 أماكن رومانسية للمواعدة",
        category: "رومانسي",
        difficulty: "easy",
        points: 15,
        examples: ["مطعم فاخر", "شاطئ", "حديقة", "سينما", "مقهى هادئ"],
        isAdult: true,
    },
    {
        id: 102,
        text: "سمي 3 هدايا رومانسية",
        category: "رومانسي",
        difficulty: "easy",
        points: 15,
        examples: ["ورود", "شوكولاتة", "عطر", "مجوهرات", "رسالة حب"],
        isAdult: true,
    },
    {
        id: 103,
        text: "سمي 3 أفلام رومانسية مشهورة",
        category: "أفلام",
        difficulty: "easy",
        points: 15,
        examples: ["تايتانيك", "نوت بوك", "كاسابلانكا", "روميو وجولييت", "الحب الأعمى"],
        isAdult: true,
    },
    {
        id: 104,
        text: "سمي 3 حاجات تخلي الموعد الأول مثالي",
        category: "مواعدة",
        difficulty: "medium",
        points: 20,
        examples: ["محادثة شيقة", "مكان هادئ", "اهتمام بالتفاصيل", "احترام", "ضحك"],
        isAdult: true,
    },
    {
        id: 105,
        text: "سمي 3 علامات إنك معجب بحد",
        category: "مشاعر",
        difficulty: "medium",
        points: 20,
        examples: ["تفكر فيه كثير", "تبتسم لما تشوفه", "تحب تقضي وقت معاه", "تهتم بآرائه", "تحس بفراشات"],
        isAdult: true,
    },
    {
        id: 106,
        text: "سمي 3 أنواع مساج مريح",
        category: "استرخاء",
        difficulty: "medium",
        points: 20,
        examples: ["مساج الكتف", "مساج القدمين", "مساج الرأس", "مساج بالزيوت", "مساج سويدي"],
        isAdult: true,
    },
    {
        id: 107,
        text: "سمي 3 حاجات تخلي العلاقة الحميمة أفضل",
        category: "حميمي",
        difficulty: "hard",
        points: 30,
        examples: ["التواصل الصريح", "الثقة", "الراحة", "التجديد", "الاهتمام بالشريك"],
        isAdult: true,
    },
    {
        id: 108,
        text: "سمي 3 فانتازيات شائعة",
        category: "خيال",
        difficulty: "hard",
        points: 30,
        examples: ["رومانسية على الشاطئ", "ليلة في فندق فاخر", "رحلة رومانسية", "عشاء على ضوء الشموع", "مغامرة جديدة"],
        isAdult: true,
    },
    {
        id: 109,
        text: "سمي 3 أماكن مثيرة للمغامرة الرومانسية",
        category: "مغامرة",
        difficulty: "hard",
        points: 30,
        examples: ["جاكوزي", "شاطئ خاص", "كابينة في الجبل", "يخت", "جناح فندق"],
        isAdult: true,
    },
    {
        id: 110,
        text: "سمي 3 حاجات تثير الشهوة",
        category: "إثارة",
        difficulty: "hard",
        points: 30,
        examples: ["عطر مثير", "ملابس مثيرة", "مساج حسي", "موسيقى رومانسية", "إضاءة خافتة"],
        isAdult: true,
    },
    {
        id: 111,
        text: "سمي 3 وضعيات حميمة مريحة",
        category: "حميمي",
        difficulty: "hard",
        points: 35,
        examples: ["الوضعية التقليدية", "الملعقة", "الفارس", "الجانبية", "المواجهة"],
        isAdult: true,
    },
    {
        id: 112,
        text: "سمي 3 ألعاب للكبار فقط",
        category: "ألعاب",
        difficulty: "hard",
        points: 35,
        examples: ["لعبة الحقيقة الحميمة", "تدليك بالزيوت", "لعبة الأدوار", "الرقص المثير", "المداعبة"],
        isAdult: true,
    },
    {
        id: 113,
        text: "سمي 3 أغاني رومانسية عربية",
        category: "موسيقى",
        difficulty: "easy",
        points: 15,
        examples: ["عيشة", "حبيبي يا نور العين", "تعالى", "كل دا كان ليه", "أحبك موت"],
        isAdult: true,
    },
    {
        id: 114,
        text: "سمي 3 أماكن للقاء سري",
        category: "مغامرة",
        difficulty: "medium",
        points: 20,
        examples: ["سيارة", "مكان بعيد", "بيت خالي", "فندق", "حديقة ليلاً"],
        isAdult: true,
    },
    {
        id: 115,
        text: "سمي 3 حاجات تعملها في ليلة رومانسية",
        category: "رومانسي",
        difficulty: "easy",
        points: 15,
        examples: ["عشاء رومانسي", "مشاهدة فيلم", "الرقص", "المشي تحت النجوم", "الحضن"],
        isAdult: true,
    },
    {
        id: 116,
        text: "سمي 3 كلمات حلوة تقولها لحبيبك",
        category: "رومانسي",
        difficulty: "easy",
        points: 15,
        examples: ["حبيبي", "عمري", "روحي", "حياتي", "قلبي"],
        isAdult: true,
    },
    {
        id: 117,
        text: "سمي 3 أجزاء من الجسم تحب تقبلها",
        category: "حميمي",
        difficulty: "medium",
        points: 20,
        examples: ["الشفاه", "الرقبة", "اليد", "الجبين", "الخد"],
        isAdult: true,
    },
    {
        id: 118,
        text: "سمي 3 حاجات تعملها في شهر العسل",
        category: "رومانسي",
        difficulty: "medium",
        points: 20,
        examples: ["السفر", "الاسترخاء", "اكتشاف أماكن جديدة", "قضاء وقت حميم", "التصوير"],
        isAdult: true,
    },
    {
        id: 119,
        text: "سمي 3 ألوان ملابس داخلية مثيرة",
        category: "إثارة",
        difficulty: "medium",
        points: 20,
        examples: ["أحمر", "أسود", "أبيض", "وردي", "بنفسجي"],
        isAdult: true,
    },
    {
        id: 120,
        text: "سمي 3 أوقات مناسبة للرومانسية",
        category: "رومانسي",
        difficulty: "easy",
        points: 15,
        examples: ["ليلاً", "عند الغروب", "في الصباح", "بعد المطر", "في الليالي القمرية"],
        isAdult: true,
    },
    {
        id: 121,
        text: "سمي 3 حاجات تزيد الإثارة بين الزوجين",
        category: "إثارة",
        difficulty: "hard",
        points: 30,
        examples: ["التجديد", "المفاجآت", "الرسائل المثيرة", "الملابس الجذابة", "الوقت الخاص"],
        isAdult: true,
    },
    {
        id: 122,
        text: "سمي 3 مشروبات رومانسية",
        category: "رومانسي",
        difficulty: "easy",
        points: 15,
        examples: ["نبيذ أحمر", "شمبانيا", "كوكتيل فراولة", "شوكولاتة ساخنة", "عصير طبيعي"],
        isAdult: true,
    },
    {
        id: 123,
        text: "سمي 3 صفات تحبها في شريك حياتك",
        category: "مشاعر",
        difficulty: "medium",
        points: 20,
        examples: ["الأمانة", "الرومانسية", "الحنان", "الذكاء", "الاهتمام"],
        isAdult: true,
    },
    {
        id: 124,
        text: "سمي 3 أماكن للتقبيل في العلن",
        category: "مغامرة",
        difficulty: "medium",
        points: 20,
        examples: ["السينما", "السيارة", "الحديقة", "الشاطئ ليلاً", "الزاوية المخفية"],
        isAdult: true,
    },
    {
        id: 125,
        text: "سمي 3 حاجات تعملها قبل اللقاء الحميم",
        category: "حميمي",
        difficulty: "hard",
        points: 30,
        examples: ["الاستحمام", "وضع العطر", "تهيئة الجو", "ارتداء ملابس مناسبة", "الاسترخاء"],
        isAdult: true,
    },
    {
        id: 126,
        text: "سمي 3 عبارات مثيرة تقولها لشريكك",
        category: "إثارة",
        difficulty: "hard",
        points: 30,
        examples: ["تعال هنا", "اشتقتلك", "نفسي فيك", "عاوزك", "أنت مثير"],
        isAdult: true,
    },
    {
        id: 127,
        text: "سمي 3 أنواع عطور مثيرة",
        category: "إثارة",
        difficulty: "medium",
        points: 20,
        examples: ["المسك", "العنبر", "الفانيليا", "الياسمين", "الصندل"],
        isAdult: true,
    },
    {
        id: 128,
        text: "سمي 3 حاجات ممنوعة تحب تجربها",
        category: "خيال",
        difficulty: "hard",
        points: 35,
        examples: ["السفر بدون خطة", "القفز بالمظلة", "لقاء عفوي", "مغامرة ليلية", "تجربة جديدة"],
        isAdult: true,
    },
    {
        id: 129,
        text: "سمي 3 أماكن في البيت للرومانسية",
        category: "رومانسي",
        difficulty: "easy",
        points: 15,
        examples: ["غرفة النوم", "الحمام", "الصالون", "الشرفة", "المطبخ"],
        isAdult: true,
    },
    {
        id: 130,
        text: "سمي 3 حركات تعملها عشان تغري حد",
        category: "إثارة",
        difficulty: "hard",
        points: 30,
        examples: ["النظرات", "اللمس الخفيف", "الابتسامة", "الهمس", "الاقتراب"],
        isAdult: true,
    },
];

export default function CoffeeNameThreeThings({
    isMobile,
    setCurrentGame,
    coffeeBeans,
    setCoffeeBeans,
    isDarkMode,
}) {
    const [gameState, setGameState] = useState("setup");
    const [players, setPlayers] = useState([]);
    const [newPlayerName, setNewPlayerName] = useState("");
    const [currentPlayer, setCurrentPlayer] = useState(0);
    const [currentPrompt, setCurrentPrompt] = useState(null);
    const [timeLeft, setTimeLeft] = useState(5);
    const [roundResult, setRoundResult] = useState(null);
    const [rounds, setRounds] = useState(0);
    const [maxRounds, setMaxRounds] = useState(10);
    const [difficulty, setDifficulty] = useState("mixed");
    const [usedPrompts, setUsedPrompts] = useState([]);
    const [adultContentEnabled, setAdultContentEnabled] = useState(false);
    const [showAgeVerification, setShowAgeVerification] = useState(false);
    const [userAnswers, setUserAnswers] = useState(["", "", ""]);
    const [showIntro, setShowIntro] = useState(true);
    const [showResultPopup, setShowResultPopup] = useState(false);
    const tickSoundRef = useRef(null);
    const urgentSoundRef = useRef(null);
    const promptCardRef = useRef(null);

    // Initialize audio on mount
    useEffect(() => {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            const audioContext = new AudioContext();
            
            const createBeep = (frequency, duration) => {
                return () => {
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
                    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
                    
                    oscillator.frequency.value = frequency;
                    oscillator.type = 'sine';
                    
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
                    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + duration);
                };
            };
            
            tickSoundRef.current = createBeep(800, 0.1);
            urgentSoundRef.current = createBeep(1200, 0.15);
        }
    }, []);

    // Hide intro after animation
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowIntro(false);
        }, 2500);
        return () => clearTimeout(timer);
    }, []);

    // Add player
    const addPlayer = () => {
        if (newPlayerName.trim() && players.length < 8) {
            setPlayers([
                ...players,
                { id: Date.now().toString(), name: newPlayerName.trim(), score: 0 },
            ]);
            setNewPlayerName("");
        }
    };

    // Remove player
    const removePlayer = (playerId) => {
        setPlayers(players.filter((p) => p.id !== playerId));
    };

    // Start game
    const startGame = () => {
        if (players.length < 1) {
            alert("You need at least 1 player to start!");
            return;
        }
        setGameState("playing");
        setCurrentPlayer(0);
        setRounds(0);
        setUsedPrompts([]);
        nextPrompt();
        setTimeout(() => {
            if (promptCardRef.current) {
                promptCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    };

    // Get next prompt
    const nextPrompt = () => {
        // Keep adult prompts at the end when enabled
        let availablePrompts = adultContentEnabled ? [...prompts, ...adultPrompts] : prompts;

        if (difficulty !== "mixed") {
            availablePrompts = availablePrompts.filter(
                (p) => p.difficulty === difficulty
            );
        }
        availablePrompts = availablePrompts.filter(
            (p) => !usedPrompts.includes(p.id)
        );

        if (availablePrompts.length === 0) {
            setUsedPrompts([]);
            const basePrompts = adultContentEnabled
                ? [...prompts, ...adultPrompts]
                : prompts;
            availablePrompts =
                difficulty === "mixed"
                    ? basePrompts
                    : basePrompts.filter((p) => p.difficulty === difficulty);
        }

        const randomPrompt =
            availablePrompts[Math.floor(Math.random() * availablePrompts.length)];
        setCurrentPrompt(randomPrompt);
        setUsedPrompts([...usedPrompts, randomPrompt.id]);
        setTimeLeft(5);
        setRoundResult(null);
        setUserAnswers(["", "", ""]);
        setGameState("playing");
    };

    // Reset game
    const resetGame = () => {
        setGameState("setup");
        setPlayers([]);
        setCurrentPlayer(0);
        setCurrentPrompt(null);
        setTimeLeft(5);
        setRoundResult(null);
        setRounds(0);
        setUsedPrompts([]);
        setAdultContentEnabled(false);
        setShowAgeVerification(false);
        setUserAnswers(["", "", ""]);
    };

    // Get winner
    const getWinner = () => {
        return players.reduce(
            (winner, player) =>
                player.score > winner.score ? player : winner,
            players[0]
        );
    };

    const enableAdultContent = () => {
        setAdultContentEnabled(true);
        setShowAgeVerification(false);
    };

    // Submit answers - for correct answer
    const submitCorrectAnswer = () => {
        setRoundResult("success");
        const updatedPlayers = [...players];
        updatedPlayers[currentPlayer].score += currentPrompt.points;
        setPlayers(updatedPlayers);
        setCoffeeBeans((prev) => prev + currentPrompt.points);
        setShowResultPopup(true);
    };

    // Submit wrong answer
    const submitWrongAnswer = () => {
        setRoundResult("failed");
        setShowResultPopup(true);
    };

    // Close popup and continue
    const closeResultPopup = () => {
        setShowResultPopup(false);
        nextRound();
    };

    // Timer effect
    useEffect(() => {
        let timer;
        if (gameState === "playing" && timeLeft > 0 && !showResultPopup) {
            // Play sound effects
            if (timeLeft <= 3 && urgentSoundRef.current) {
                urgentSoundRef.current();
            } else if (tickSoundRef.current) {
                tickSoundRef.current();
            }
            
            timer = setTimeout(() => {
                setTimeLeft((t) => t - 1);
            }, 1000);
        } else if (gameState === "playing" && timeLeft === 0 && !showResultPopup) {
            submitWrongAnswer();
        }
        return () => clearTimeout(timer);
    }, [timeLeft, gameState, showResultPopup]);

    // Next round effect
    const nextRound = () => {
        const nextRounds = rounds + 1;
        setRounds(nextRounds);

        if (nextRounds >= maxRounds) {
            setGameState("finished");
            return;
        }
        // Sequential player selection
        const nextPlayer = (currentPlayer + 1) % players.length;
        setCurrentPlayer(nextPlayer);
        nextPrompt();
        setTimeout(() => {
            if (promptCardRef.current) {
                promptCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    };

    // Intro Animation
    if (showIntro) {
        return (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                <div className={`text-center animate-fadeIn ${isMobile ? "px-4 max-w-xs" : "px-8"}`}>
                    {/* Animated Icon */}
                    <div className={`${isMobile ? "mb-4" : "mb-6"} animate-bounce`}>
                        <Target className={`${isMobile ? "w-16 h-16" : "w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32"} mx-auto mb-2 text-cyan-400`} strokeWidth={1.5} />
                    </div>
                    
                    {/* Title with gradient */}
                    <h1 className={`${isMobile ? "text-2xl" : "text-4xl sm:text-5xl md:text-6xl lg:text-7xl"} font-bold mb-3 bg-gradient-to-r from-cyan-400 via-teal-400 to-blue-400 bg-clip-text text-transparent animate-pulse`}>
                        سمي 3 حاجات
                    </h1>
                    
                    {/* Subtitle */}
                    <p className={`${isMobile ? "text-sm" : "text-xl sm:text-2xl md:text-3xl"} text-white/90 font-semibold mb-6`}>
                        قول 3 إجابات بصوت عالي في 5 ثوان!
                    </p>
                    
                    {/* Loading indicator */}
                    <div className="flex justify-center gap-2 mb-3">
                        <div className={`${isMobile ? "w-2 h-2" : "w-3 h-3"} bg-cyan-400 rounded-full animate-bounce`} style={{ animationDelay: '0ms' }}></div>
                        <div className={`${isMobile ? "w-2 h-2" : "w-3 h-3"} bg-teal-400 rounded-full animate-bounce`} style={{ animationDelay: '150ms' }}></div>
                        <div className={`${isMobile ? "w-2 h-2" : "w-3 h-3"} bg-blue-400 rounded-full animate-bounce`} style={{ animationDelay: '300ms' }}></div>
                    </div>
                    
                    <p className={`text-white/60 ${isMobile ? "text-xs" : "text-sm sm:text-base"}`}>جاري التحميل...</p>
                </div>
            </div>
        );
    }

    // Age Verification Modal
    if (showAgeVerification) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className={`rounded-3xl shadow-2xl ${isMobile ? "w-full max-w-sm" : "max-w-md w-full"} overflow-hidden ${
                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                }`}>
                    <div className={`${isMobile ? "p-6" : "p-8"} text-center`}>
                        <AlertTriangle className={`${isMobile ? "w-12 h-12" : "w-14 h-14"} mx-auto mb-4 text-red-500`} strokeWidth={1.5} />
                        <h2 className={`${isMobile ? "text-xl" : "text-2xl"} font-bold mb-4 ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>تحذير - محتوى للبالغين</h2>
                        <p className={`${isMobile ? "text-sm" : "text-base"} mb-6 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                            المحتوى للبالغين يحتوي على مواضيع ناضجة ومناسب فقط للاعبين 18+ سنة
                        </p>
                        <p className={`text-xs ${isMobile ? "mb-4" : "mb-6"} text-red-500 font-semibold`}>
                            بتفعيل المحتوى للبالغين، أنت تؤكد أن جميع اللاعبين 18+ ويوافقون على المحتوى
                        </p>
                        <div className={`flex ${isMobile ? "flex-col" : "flex-row"} gap-3`}>
                            <button
                                onClick={enableAdultContent}
                                className={`${isMobile ? "w-full" : "flex-1"} bg-red-500 hover:bg-red-600 text-white rounded-xl px-6 py-3 font-bold transition-all duration-300 hover:scale-105`}
                            >
                                أنا 18+ - تفعيل
                            </button>
                            <button
                                onClick={() => setShowAgeVerification(false)}
                                className={`${isMobile ? "w-full" : "flex-1"} rounded-xl px-6 py-3 font-bold transition-all duration-300 hover:scale-105 ${
                                    isDarkMode 
                                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                                        : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                }`}
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Setup Phase
    if (gameState === "setup") {
        return (
            <div
                className={`min-h-screen transition-colors duration-300 ${
                    isDarkMode ? 'bg-black' : 'bg-white'
                } ${isMobile ? "px-4 pt-6 pb-24" : "px-8 pt-12 pb-8"}`}
            >
                {/* Header */}
                <div className={`flex items-center justify-between ${isMobile ? "mb-4" : "mb-8"}`}>
                    <button
                        onClick={() => setCurrentGame("menu")}
                        className={`rounded-xl ${isMobile ? "p-2" : "p-3"} transition-all duration-300 ${
                            isDarkMode 
                                ? 'text-white hover:bg-white/20' 
                                : 'text-gray-800 hover:bg-black/10'
                        }`}
                    >
                        <ArrowLeft className={`${isMobile ? "w-5 h-5" : "w-6 h-6"}`} />
                    </button>
                    <div className="text-center flex-1">
                        <h1 className={`font-bold ${isMobile ? "text-lg" : "text-4xl"} ${isMobile ? "mb-0.5" : "mb-2"} transition-colors ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                            سمي 3 حاجات
                        </h1>
                        <p className={`${isMobile ? "text-[10px]" : "text-base"} transition-colors ${
                            isDarkMode ? 'text-cyan-300' : 'text-cyan-700'
                        }`}>قول 3 إجابات في 5 ثوان!</p>
                    </div>
                    <div className={`rounded-xl shadow-lg ${isMobile ? "p-1.5" : "p-3"} ${
                        isDarkMode 
                            ? 'bg-gradient-to-r from-amber-600 to-yellow-600' 
                            : 'bg-gradient-to-r from-amber-100 to-yellow-100'
                    }`}>
                        <div className={`flex items-center ${isMobile ? "gap-1" : "gap-2"}`}>
                            <Coffee className={`${isMobile ? "w-3 h-3" : "w-5 h-5"} ${isDarkMode ? 'text-amber-100' : 'text-amber-600'}`} />
                            <span className={`font-bold ${isMobile ? "text-xs" : "text-lg"} ${isDarkMode ? 'text-white' : 'text-amber-800'}`}>
                                {coffeeBeans}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Game Setup */}
                <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} ${isMobile ? "gap-3" : "gap-6"} ${isMobile ? "mb-4" : "mb-8"}`}>
                    {/* Add Players */}
                    <div className={`rounded-2xl shadow-xl ${isMobile ? "p-4" : "p-6"} backdrop-blur-sm ${
                        isDarkMode 
                            ? 'bg-white/10 border border-white/20' 
                            : 'bg-white/90 border border-gray-200'
                    }`}>
                        <h3 className={`${isMobile ? "text-base" : "text-xl"} font-bold ${isMobile ? "mb-3" : "mb-4"} ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                            👥 أضف لاعبين ({players.length}/8)
                        </h3>

                        <div className="flex gap-2 mb-4">
                            <input
                                placeholder="اسم اللاعب"
                                value={newPlayerName}
                                onChange={(e) => setNewPlayerName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
                                className={`flex-1 ${isMobile ? "px-3 py-2 text-sm" : "px-4 py-3"} rounded-xl transition-all ${
                                    isDarkMode 
                                        ? 'bg-white/10 border-white/20 text-white placeholder-gray-400' 
                                        : 'bg-white border-gray-300 text-gray-900'
                                } border-2 focus:border-teal-500 focus:outline-none`}
                            />
                            <button
                                onClick={addPlayer}
                                disabled={!newPlayerName.trim() || players.length >= 8}
                                className={`${isMobile ? "px-4 py-2 text-sm" : "px-6 py-3"} rounded-xl font-bold transition-all duration-300 ${
                                    !newPlayerName.trim() || players.length >= 8
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-teal-500 hover:bg-teal-600 hover:scale-105'
                                } text-white`}
                            >
                                إضافة
                            </button>
                        </div>

                        <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                            {players.length === 0 ? (
                                <div className={`text-center py-8 ${
                                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                }`}>
                                    <Users className={`${isMobile ? "w-10 h-10" : "w-12 h-12"} mx-auto mb-2 opacity-50`} />
                                    <p className={isMobile ? "text-sm" : "text-base"}>لا يوجد لاعبين بعد</p>
                                </div>
                            ) : (
                                players.map((player, index) => (
                                    <div
                                        key={player.id}
                                        className={`flex items-center justify-between rounded-xl ${isMobile ? "p-2" : "p-3"} transition-all duration-300 hover:scale-102 ${
                                            isDarkMode 
                                                ? 'bg-white/10 hover:bg-white/20' 
                                                : 'bg-gray-100 hover:bg-gray-200'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`${isMobile ? "w-7 h-7 text-xs" : "w-8 h-8"} rounded-full flex items-center justify-center font-bold ${
                                                isDarkMode 
                                                    ? 'bg-teal-600 text-white' 
                                                    : 'bg-teal-500 text-white'
                                            }`}>
                                                {index + 1}
                                            </div>
                                            <span className={`${isMobile ? "text-sm" : "text-base"} font-medium ${
                                                isDarkMode ? 'text-white' : 'text-gray-900'
                                            }`}>{player.name}</span>
                                        </div>
                                        <button
                                            onClick={() => removePlayer(player.id)}
                                            className={`text-red-500 hover:text-red-700 ${isMobile ? "text-lg" : "text-xl"} font-bold transition-all duration-300 hover:scale-110`}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Game Settings */}
                    <div className={`rounded-2xl shadow-xl ${isMobile ? "p-4" : "p-6"} backdrop-blur-sm ${
                        isDarkMode 
                            ? 'bg-white/10 border border-white/20' 
                            : 'bg-white/90 border border-gray-200'
                    }`}>
                        <h3 className={`${isMobile ? "text-base" : "text-xl"} font-bold ${isMobile ? "mb-3" : "mb-4"} ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>⚙️ إعدادات اللعبة</h3>

                        {/* Difficulty */}
                        <div className={isMobile ? "mb-4" : "mb-6"}>
                            <p className={`text-sm font-medium mb-3 ${
                                isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>مستوى الصعوبة</p>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { value: "easy", label: "سهل", color: "green" },
                                    { value: "medium", label: "متوسط", color: "yellow" },
                                    { value: "hard", label: "صعب", color: "red" },
                                    { value: "mixed", label: "مختلط", color: "purple" }
                                ].map((level) => (
                                    <button
                                        key={level.value}
                                        onClick={() => setDifficulty(level.value)}
                                        className={`${isMobile ? "px-3 py-2 text-sm" : "px-4 py-3"} rounded-xl font-bold transition-all duration-300 ${
                                            difficulty === level.value
                                                ? `bg-${level.color}-500 text-white scale-105 shadow-lg`
                                                : isDarkMode
                                                    ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {level.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Number of Rounds */}
                        <div className="mb-6">
                            <p className={`text-sm font-medium mb-3 ${
                                isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>عدد الجولات</p>
                            <div className="grid grid-cols-4 gap-2">
                                {[5, 10, 15, 20].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => setMaxRounds(num)}
                                        className={`${isMobile ? "px-3 py-2 text-sm" : "px-4 py-3"} rounded-xl font-bold transition-all duration-300 ${
                                            maxRounds === num
                                                ? 'bg-cyan-500 text-white scale-105 shadow-lg'
                                                : isDarkMode
                                                    ? 'bg-white/10 text-gray-300 hover:bg-white/20'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                        }`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Adult Content Toggle */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-3">
                                <p className={`text-sm font-medium ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                }`}>محتوى للكبار (18+)</p>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                    adultContentEnabled 
                                        ? "bg-red-500 text-white" 
                                        : isDarkMode
                                            ? "bg-gray-700 text-gray-300"
                                            : "bg-gray-300 text-gray-700"
                                }`}>
                                    {adultContentEnabled ? "مفعّل" : "غير مفعّل"}
                                </span>
                            </div>
                            <button
                                onClick={() => setShowAgeVerification(true)}
                                disabled={adultContentEnabled}
                                className={`w-full ${isMobile ? "py-2 text-sm" : "py-3"} rounded-xl font-bold transition-all duration-300 ${
                                    adultContentEnabled
                                        ? 'bg-gray-400 cursor-not-allowed text-white'
                                        : 'bg-red-500 hover:bg-red-600 text-white hover:scale-105'
                                }`}
                            >
                                {adultContentEnabled
                                    ? "المحتوى للبالغين مفعّل"
                                    : "تفعيل المحتوى للبالغين"}
                            </button>
                        </div>

                        <button
                            onClick={startGame}
                            disabled={players.length < 1}
                            className={`w-full ${isMobile ? "py-3 text-base" : "py-4 text-lg"} rounded-xl font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                                players.length < 1
                                    ? 'bg-gray-400 cursor-not-allowed text-white'
                                    : 'bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white shadow-xl hover:scale-105'
                            }`}
                        >
                            <Zap className={`${isMobile ? "w-4 h-4" : "w-5 h-5"}`} />
                            ابدأ اللعب!
                        </button>
                    </div>
                </div>

                {/* Game Rules */}
                <div className={`rounded-2xl shadow-xl ${isMobile ? "p-3" : "p-6"} ${isMobile ? "mb-3" : "mb-8"} backdrop-blur-sm ${
                    isDarkMode 
                        ? 'bg-white/10 border border-white/20' 
                        : 'bg-white/90 border border-gray-200'
                }`}>
                    <h3 className={`${isMobile ? "text-base" : "text-xl"} font-bold ${isMobile ? "mb-2" : "mb-4"} ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>قواعد اللعبة</h3>
                    <div className={`${isMobile ? "space-y-2" : "space-y-4"} ${isMobile ? "text-xs" : "text-base"} ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        <div className="flex gap-3 items-start">
                            <div className={`bg-gradient-to-br from-teal-500 to-cyan-600 rounded-full ${isMobile ? "w-7 h-7 text-sm" : "w-8 h-8"} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg`}>
                                1
                            </div>
                            <p><span className="font-bold">قول 3 أشياء</span> في الموضوع المطروح قبل انتهاء الوقت (5 ثوان فقط!)</p>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className={`bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full ${isMobile ? "w-7 h-7 text-sm" : "w-8 h-8"} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg`}>
                                2
                            </div>
                            <p><span className="font-bold">إجابة شفهية:</span> اللاعبون الآخرون يحكمون على إجاباتك</p>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className={`bg-gradient-to-br from-blue-500 to-purple-600 rounded-full ${isMobile ? "w-7 h-7 text-sm" : "w-8 h-8"} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg`}>
                                3
                            </div>
                            <p><span className="font-bold">النقاط:</span> إجابة صحيحة = نقاط حسب الصعوبة • إجابة خاطئة = لا نقاط</p>
                        </div>
                        <div className="flex gap-3 items-start">
                            <div className={`bg-gradient-to-br from-purple-500 to-pink-600 rounded-full ${isMobile ? "w-7 h-7 text-sm" : "w-8 h-8"} flex items-center justify-center text-white font-bold flex-shrink-0 shadow-lg`}>
                                4
                            </div>
                            <p><span className="font-bold">الفوز:</span> اللاعب صاحب أعلى نقاط في النهاية يفوز</p>
                        </div>
                    </div>
                </div>

                {/* Points System */}
                <div className={`rounded-2xl shadow-xl ${isMobile ? "p-3" : "p-6"} backdrop-blur-sm ${
                    isDarkMode 
                        ? 'bg-white/10 border border-white/20' 
                        : 'bg-white/90 border border-gray-200'
                }`}>
                    <h3 className={`${isMobile ? "text-base" : "text-xl"} font-bold ${isMobile ? "mb-2" : "mb-4"} ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>نظام النقاط</h3>
                    <div className={`grid grid-cols-3 ${isMobile ? "gap-2" : "gap-3 md:gap-4"}`}>
                        <div className={`${isMobile ? "p-3" : "p-4"} rounded-2xl text-center relative overflow-hidden group hover:scale-105 transition-transform duration-300 ${
                            isDarkMode ? 'bg-gradient-to-br from-green-900 to-emerald-900' : 'bg-gradient-to-br from-green-100 to-emerald-100'
                        }`}>
                            <div className="absolute inset-0 bg-gradient-to-t from-green-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className={`relative bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-full ${isMobile ? "text-xs" : "text-sm"} font-bold inline-block mb-3 shadow-lg`}>
                                سهل
                            </div>
                            <p className={`${isMobile ? "text-3xl" : "text-4xl"} font-black mb-1 ${
                                isDarkMode ? 'text-green-400' : 'text-green-700'
                            }`}>10</p>
                            <p className={`text-xs font-semibold ${
                                isDarkMode ? 'text-green-300' : 'text-green-600'
                            }`}>نقاط</p>
                        </div>
                        <div className={`${isMobile ? "p-3" : "p-4"} rounded-2xl text-center relative overflow-hidden group hover:scale-105 transition-transform duration-300 ${
                            isDarkMode ? 'bg-gradient-to-br from-yellow-900 to-orange-900' : 'bg-gradient-to-br from-yellow-100 to-orange-100'
                        }`}>
                            <div className="absolute inset-0 bg-gradient-to-t from-yellow-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className={`relative bg-gradient-to-r from-yellow-500 to-orange-600 text-white px-3 py-1.5 rounded-full ${isMobile ? "text-xs" : "text-sm"} font-bold inline-block mb-3 shadow-lg`}>
                                متوسط
                            </div>
                            <p className={`${isMobile ? "text-3xl" : "text-4xl"} font-black mb-1 ${
                                isDarkMode ? 'text-yellow-400' : 'text-yellow-700'
                            }`}>15</p>
                            <p className={`text-xs font-semibold ${
                                isDarkMode ? 'text-yellow-300' : 'text-yellow-600'
                            }`}>نقاط</p>
                        </div>
                        <div className={`${isMobile ? "p-3" : "p-4"} rounded-2xl text-center relative overflow-hidden group hover:scale-105 transition-transform duration-300 ${
                            isDarkMode ? 'bg-gradient-to-br from-red-900 to-pink-900' : 'bg-gradient-to-br from-red-100 to-pink-100'
                        }`}>
                            <div className="absolute inset-0 bg-gradient-to-t from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className={`relative bg-gradient-to-r from-red-500 to-pink-600 text-white px-3 py-1.5 rounded-full ${isMobile ? "text-xs" : "text-sm"} font-bold inline-block mb-3 shadow-lg`}>
                                صعب
                            </div>
                            <p className={`${isMobile ? "text-3xl" : "text-4xl"} font-black mb-1 ${
                                isDarkMode ? 'text-red-400' : 'text-red-700'
                            }`}>20</p>
                            <p className={`text-xs font-semibold ${
                                isDarkMode ? 'text-red-300' : 'text-red-600'
                            }`}>نقاط</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Playing Phase
    if (gameState === "playing" && currentPrompt) {
        return (
            <div
                className={`min-h-screen transition-colors duration-300 ${
                    isDarkMode ? 'bg-black' : 'bg-white'
                } ${isMobile ? "px-4 pt-6 pb-24" : "px-8 pt-12 pb-8"}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <button
                        onClick={resetGame}
                        className={`rounded-xl p-3 transition-all duration-300 ${
                            isDarkMode 
                                ? 'text-white hover:bg-white/20' 
                                : 'text-gray-800 hover:bg-black/10'
                        }`}
                    >
                        <ArrowLeft className={`${isMobile ? "w-5 h-5" : "w-6 h-6"}`} />
                    </button>
                    <div className="text-center flex-1">
                        <h1 className={`font-bold ${isMobile ? "text-base" : "text-2xl"} mb-1 ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                            جولة {rounds + 1} من {maxRounds}
                        </h1>
                        <p className={`${isMobile ? "text-xs" : "text-base"} ${isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}`}>
                            {players[currentPlayer].name}
                        </p>
                    </div>
                    {/* Timer */}
                    <div className={`rounded-2xl shadow-xl ${isMobile ? "w-16 h-16" : "w-20 h-20"} flex items-center justify-center border-4 ${
                        timeLeft > 3 
                            ? isDarkMode 
                                ? "bg-green-900/50 border-green-500" 
                                : "bg-green-100 border-green-500"
                                : isDarkMode
                                    ? "bg-red-900/50 border-red-500 animate-pulse"
                                    : "bg-red-100 border-red-500 animate-pulse"
                    }`}>
                        <span className={`${isMobile ? "text-3xl" : "text-4xl"} font-bold ${
                            timeLeft > 3 
                                ? isDarkMode ? "text-green-400" : "text-green-600"
                                : isDarkMode ? "text-red-400" : "text-red-600"
                        }`}>
                            {timeLeft}
                        </span>
                    </div>
                </div>

                {/* Prompt Card */}
                <div ref={promptCardRef} className={`rounded-3xl shadow-2xl ${isMobile ? "p-4" : "p-6 md:p-8"} mb-6 ${
                    currentPrompt.difficulty === "easy"
                        ? isDarkMode
                            ? 'bg-gradient-to-br from-green-900 to-emerald-900'
                            : 'bg-gradient-to-br from-green-400 to-emerald-500'
                        : currentPrompt.difficulty === "medium"
                            ? isDarkMode
                                ? 'bg-gradient-to-br from-yellow-900 to-orange-900'
                                : 'bg-gradient-to-br from-yellow-400 to-orange-500'
                            : isDarkMode
                                ? 'bg-gradient-to-br from-red-900 to-pink-900'
                                : 'bg-gradient-to-br from-red-400 to-pink-500'
                }`}>
                    {/* Current Player Badge */}
                    <div className="flex items-center justify-center mb-6">
                        <div className={`bg-white/20 backdrop-blur-xl border-2 border-white/40 rounded-2xl ${isMobile ? "px-4 py-3" : "px-6 py-4"} flex items-center gap-3 shadow-2xl animate-pulse`}>
                            <div className={`${isMobile ? "w-10 h-10 text-lg" : "w-12 h-12 text-xl"} rounded-xl bg-white/30 flex items-center justify-center text-white font-black shadow-lg`}>
                                {players[currentPlayer].name.charAt(0).toUpperCase()}
                            </div>
                            <div className="text-left">
                                <p className={`${isMobile ? "text-xs" : "text-sm"} text-white/80 font-medium mb-0.5`}>دور اللاعب</p>
                                <p className={`${isMobile ? "text-base" : "text-xl"} text-white font-black`}>
                                    {players[currentPlayer].name}
                                </p>
                            </div>
                            <Target className={`${isMobile ? "w-8 h-8" : "w-10 h-10"} animate-bounce`} strokeWidth={1.5} />
                        </div>
                    </div>

                    <div className="text-center mb-6">
                        <div className={`inline-block px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm ${isMobile ? "mb-2" : "mb-4"}`}>
                            {currentPrompt.isAdult && <span className="mr-2">18+</span>}
                            <span className={`text-white font-bold ${isMobile ? "text-xs" : "text-sm"}`}>
                                {currentPrompt.category} • {currentPrompt.points} نقاط
                            </span>
                        </div>
                        <h2 className={`font-bold text-white ${isMobile ? "text-xl leading-tight" : "text-3xl md:text-5xl"} mb-4`}>
                            {currentPrompt.text}
                        </h2>
                        <p className={`text-white/90 ${isMobile ? "text-sm" : "text-lg md:text-xl"} font-semibold`}>قول 3 إجابات بصوت عالي!</p>
                    </div>

                    {/* Instructions */}
                    <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 md:p-6 mb-6">
                        <div className="flex items-center justify-center gap-3 mb-4">
                            <div className="text-4xl md:text-5xl">🗣️</div>
                            <p className={`text-white font-bold ${isMobile ? "text-base" : "text-xl md:text-2xl"}`}>
                                اذكر 3 أشياء الآن!
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 md:gap-3">
                            {[1, 2, 3].map((num) => (
                                <div key={num} className="bg-white/20 rounded-xl p-3 md:p-4 text-center">
                                    <div className={`text-white font-bold ${isMobile ? "text-2xl" : "text-3xl md:text-4xl"}`}>
                                        {num}
                                    </div>
                                    <div className={`text-white/70 ${isMobile ? "text-xs" : "text-sm"} mt-1`}>
                                        إجابة
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3 md:gap-4">
                        <button
                            onClick={submitCorrectAnswer}
                            disabled={timeLeft === 0}
                            className={`${isMobile ? "py-5 text-base" : "py-6 md:py-7 text-lg md:text-xl"} rounded-2xl font-black transition-all duration-300 flex flex-col items-center justify-center gap-2 shadow-2xl relative overflow-hidden group ${
                                timeLeft === 0
                                    ? 'bg-gray-400 cursor-not-allowed text-white/50'
                                    : 'bg-gradient-to-br from-green-500 to-emerald-600 text-white hover:scale-105 hover:shadow-[0_20px_50px_rgba(16,185,129,0.5)]'
                            }`}
                        >
                            {timeLeft > 0 && (
                                <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            )}
                            <div className="relative">
                                <div className={`${isMobile ? "w-12 h-12" : "w-14 h-14"} mx-auto mb-2 rounded-full bg-white/20 flex items-center justify-center`}>
                                    <Check className={`${isMobile ? "w-7 h-7" : "w-8 h-8"}`} strokeWidth={3} />
                                </div>
                                <span className="block mb-1">إجابة صحيحة</span>
                                <span className={`${isMobile ? "text-xs" : "text-sm"} bg-white/30 px-3 py-1 rounded-full inline-block font-bold`}>+{currentPrompt.points} نقطة</span>
                            </div>
                        </button>
                        <button
                            onClick={submitWrongAnswer}
                            disabled={timeLeft === 0}
                            className={`${isMobile ? "py-5 text-base" : "py-6 md:py-7 text-lg md:text-xl"} rounded-2xl font-black transition-all duration-300 flex flex-col items-center justify-center gap-2 shadow-2xl relative overflow-hidden group ${
                                timeLeft === 0
                                    ? 'bg-gray-400 cursor-not-allowed text-white/50'
                                    : 'bg-gradient-to-br from-red-500 to-pink-600 text-white hover:scale-105 hover:shadow-[0_20px_50px_rgba(239,68,68,0.5)]'
                            }`}
                        >
                            {timeLeft > 0 && (
                                <div className="absolute inset-0 bg-gradient-to-t from-white/0 to-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            )}
                            <div className="relative">
                                <div className={`${isMobile ? "w-12 h-12" : "w-14 h-14"} mx-auto mb-2 rounded-full bg-white/20 flex items-center justify-center`}>
                                    <X className={`${isMobile ? "w-7 h-7" : "w-8 h-8"}`} strokeWidth={3} />
                                </div>
                                <span className="block mb-1">إجابة خاطئة</span>
                                <span className={`${isMobile ? "text-xs" : "text-sm"} bg-white/30 px-3 py-1 rounded-full inline-block font-bold`}>0 نقطة</span>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Visual Timer Progress */}
                <div className="mb-6">
                    <div className={`rounded-full ${isMobile ? "h-4" : "h-5"} overflow-hidden ${
                        isDarkMode ? 'bg-white/20' : 'bg-gray-300'
                    }`}>
                        <div
                            className={`h-full transition-all duration-1000 ease-linear ${
                                timeLeft > 3 
                                    ? "bg-green-500" 
                                    : "bg-red-500 animate-pulse"
                            }`}
                            style={{ width: `${(timeLeft / 5) * 100}%` }}
                        />
                    </div>
                    <p className={`text-center mt-3 ${isMobile ? "text-base" : "text-lg md:text-xl"} font-bold ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                        {timeLeft > 0 ? (
                            <span className={timeLeft <= 3 ? 'text-red-500 animate-pulse' : ''}>
                                {timeLeft} ثوان متبقية
                            </span>
                        ) : (
                            <span className="text-red-500">انتهى الوقت</span>
                        )}
                    </p>
                </div>

                {/* Player Scores */}
                <div className={`rounded-2xl shadow-xl ${isMobile ? "p-4" : "p-6"} backdrop-blur-sm ${
                    isDarkMode 
                        ? 'bg-white/10 border border-white/20' 
                        : 'bg-white/90 border border-gray-200'
                }`}>
                    <h3 className={`${isMobile ? "text-base" : "text-xl"} font-bold mb-4 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>النتائج</h3>
                    <div className={`grid ${isMobile ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"} gap-3`}>
                        {players.map((player, index) => (
                            <div
                                key={player.id}
                                className={`${isMobile ? "p-3" : "p-4"} rounded-xl text-center transition-all duration-300 ${
                                    index === currentPlayer
                                        ? isDarkMode
                                            ? 'bg-teal-600/50 border-2 border-teal-400 scale-105'
                                            : 'bg-gradient-to-r from-teal-100 to-cyan-100 border-2 border-teal-400 scale-105'
                                        : isDarkMode
                                            ? 'bg-white/10'
                                            : 'bg-gray-100'
                                }`}
                            >
                                <span className={`font-semibold block ${isMobile ? "text-xs" : "text-sm"} ${
                                    isDarkMode ? 'text-white' : 'text-gray-900'
                                }`}>{player.name}</span>
                                {index === currentPlayer && <div className={`${isMobile ? "text-xs" : "text-sm"} my-1`}>الدور الحالي</div>}
                                <p className={`${isMobile ? "text-xl" : "text-2xl"} font-bold mt-2 ${
                                    isDarkMode ? 'text-teal-400' : 'text-teal-600'
                                }`}>{player.score}</p>
                                <p className={`text-xs ${
                                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>نقاط</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Result Popup - Professional Design */}
                {showResultPopup && (
                    <div className="fixed inset-0 bg-gradient-to-br from-black/80 via-black/70 to-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4 animate-fadeIn">
                        <div className={`${isMobile ? "w-full max-w-[95vw]" : "max-w-lg w-full"} relative`} style={{ animation: 'slideUp 0.4s ease-out' }}>
                            {/* Glassmorphism Card */}
                            <div className={`rounded-3xl backdrop-blur-2xl border shadow-2xl overflow-hidden ${
                                roundResult === "success"
                                    ? 'bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-green-500/20 border-emerald-400/30'
                                    : 'bg-gradient-to-br from-rose-500/20 via-red-500/20 to-pink-500/20 border-rose-400/30'
                            }`}>
                                {/* Gradient Overlay */}
                                <div className={`absolute inset-0 opacity-10 ${
                                    roundResult === "success" 
                                        ? 'bg-gradient-to-br from-emerald-400 to-teal-600' 
                                        : 'bg-gradient-to-br from-rose-400 to-pink-600'
                                }`}></div>
                                
                                <div className={`relative ${isMobile ? "p-5" : "p-10"}`}>
                                    {/* Status Badge */}
                                    <div className="flex justify-center mb-4">
                                        <div className={`inline-flex items-center ${isMobile ? "gap-2 px-4 py-2" : "gap-3 px-6 py-3"} rounded-full backdrop-blur-xl border-2 ${
                                            roundResult === "success"
                                                ? 'bg-emerald-500/30 border-emerald-400/50'
                                                : 'bg-rose-500/30 border-rose-400/50'
                                        }`}>
                                            <div className={`${isMobile ? "text-2xl" : "text-4xl"}`}>
                                                {roundResult === "success" ? "✓" : "✕"}
                                            </div>
                                            <span className={`${isMobile ? "text-base" : "text-2xl"} font-bold text-white`}>
                                                {roundResult === "success" ? "إجابة صحيحة" : "إجابة خاطئة"}
                                            </span>
                                        </div>
                                    </div>
                                    
                                    {/* Points Display */}
                                    <div className="text-center mb-5">
                                        <p className={`${isMobile ? "text-xs" : "text-base"} text-white/70 mb-1 uppercase tracking-wider font-semibold`}>
                                            {roundResult === "success" ? "النقاط المكتسبة" : "النقاط"}
                                        </p>
                                        <div className={`${isMobile ? "text-5xl" : "text-7xl"} font-black text-white mb-1`}>
                                            {roundResult === "success" ? `+${currentPrompt.points}` : "0"}
                                        </div>
                                        <p className={`${isMobile ? "text-sm" : "text-lg"} text-white/80 font-medium`}>
                                            {roundResult === "success" ? "نقطة رائعة! 🌟" : "حاول مرة أخرى"}
                                        </p>
                                    </div>
                                    
                                    {/* Divider */}
                                    <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent mb-4"></div>
                                    
                                    {/* Question */}
                                    <div className={`bg-white/10 backdrop-blur-xl rounded-2xl ${isMobile ? "p-3" : "p-4"} mb-3 border border-white/10`}>
                                        <p className="text-xs text-white/60 mb-1.5 uppercase tracking-wide font-semibold">السؤال</p>
                                        <p className={`${isMobile ? "text-xs" : "text-base"} text-white font-semibold leading-relaxed`}>
                                            {currentPrompt.text}
                                        </p>
                                    </div>
                                    
                                    {/* Examples */}
                                    <div className={`bg-white/10 backdrop-blur-xl rounded-2xl ${isMobile ? "p-3" : "p-4"} mb-3 border border-white/10`}>
                                        <p className="text-xs text-white/60 mb-2 uppercase tracking-wide font-semibold">أمثلة صحيحة</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {currentPrompt.examples.slice(0, 3).map((example, index) => (
                                                <span 
                                                    key={index} 
                                                    className={`bg-white/20 backdrop-blur-sm text-white ${isMobile ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"} rounded-lg font-medium border border-white/10`}
                                                >
                                                    {example}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    {/* Current Score */}
                                    <div className={`bg-white/10 backdrop-blur-xl rounded-2xl ${isMobile ? "p-3" : "p-4"} mb-4 border border-white/10`}>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs text-white/60 mb-1 uppercase tracking-wide font-semibold">نقاطك الحالية</p>
                                                <p className={`${isMobile ? "text-xl" : "text-3xl"} text-white font-black`}>
                                                    {players[currentPlayer].score}
                                                </p>
                                            </div>
                                            <div className={`${isMobile ? "w-12 h-12 text-lg" : "w-20 h-20 text-3xl"} rounded-2xl bg-gradient-to-br ${
                                                roundResult === "success" 
                                                    ? 'from-emerald-500 to-teal-600' 
                                                    : 'from-rose-500 to-pink-600'
                                            } flex items-center justify-center text-white font-black shadow-lg`}>
                                                {players[currentPlayer].name.charAt(0).toUpperCase()}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Continue Button */}
                                    <button
                                        onClick={closeResultPopup}
                                        className={`w-full bg-white hover:bg-white/95 text-gray-900 font-black ${isMobile ? "py-3 text-sm" : "py-5 text-lg"} rounded-2xl shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_20px_60px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2`}
                                    >
                                        <span>{rounds + 1 >= maxRounds ? "عرض النتائج النهائية" : "متابعة اللعب"}</span>
                                        <span className={isMobile ? "text-base" : "text-xl"}>→</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Result Phase
    if (gameState === "result" && currentPrompt) {
        const earnedPoints = roundResult === "success" ? currentPrompt.points : 0;
        
        return (
            <div
                className={`min-h-screen transition-colors duration-300 ${
                    isDarkMode ? 'bg-black' : 'bg-white'
                } ${isMobile ? "px-4 pt-6 pb-24" : "px-8 pt-12 pb-8"}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={resetGame}
                        className={`rounded-xl p-3 transition-all duration-300 ${
                            isDarkMode 
                                ? 'text-white hover:bg-white/20' 
                                : 'text-gray-800 hover:bg-black/10'
                        }`}
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="text-center flex-1">
                        <h1 className={`font-bold ${isMobile ? "text-xl" : "text-2xl"} mb-1 ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                            جولة {rounds + 1} من {maxRounds}
                        </h1>
                        <p className={isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}>
                            {players[currentPlayer].name}
                        </p>
                    </div>
                    <div className={`rounded-2xl shadow-lg p-3 ${
                        isDarkMode 
                            ? 'bg-gradient-to-r from-amber-600 to-yellow-600' 
                            : 'bg-gradient-to-r from-amber-100 to-yellow-100'
                    }`}>
                        <div className="flex items-center gap-2">
                            <Coffee className={`w-5 h-5 ${isDarkMode ? 'text-amber-100' : 'text-amber-600'}`} />
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-amber-800'}`}>
                                {coffeeBeans}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Result Card */}
                <div className={`rounded-3xl shadow-2xl mb-8 ${isMobile ? "p-6" : "p-8"} ${
                    roundResult === "success"
                        ? isDarkMode
                            ? "bg-gradient-to-br from-green-900 to-teal-900"
                            : "bg-gradient-to-br from-green-400 to-teal-500"
                        : isDarkMode
                            ? "bg-gradient-to-br from-red-900 to-pink-900"
                            : "bg-gradient-to-br from-red-400 to-pink-500"
                }`}>
                    <div className="text-center">
                        <div className={`${isMobile ? "text-6xl" : "text-7xl md:text-8xl"} mb-4`}>
                            {roundResult === "success" ? "تم" : "خطأ"}
                        </div>
                        <h2 className={`${isMobile ? "text-2xl" : "text-3xl md:text-4xl"} font-bold text-white mb-4`}>
                            {roundResult === "success" ? "ممتاز!" : "للأسف!"}
                        </h2>
                        <p className={`${isMobile ? "text-base" : "text-lg md:text-xl"} text-white/90 mb-6`}>
                            {roundResult === "success"
                                ? `أحسنت! حصلت على ${earnedPoints} نقطة! 🌟`
                                : "إجابة خاطئة - لا نقاط"}
                        </p>

                        {/* The original prompt */}
                        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-6">
                            <h3 className="font-bold text-white mb-3">السؤال كان:</h3>
                            <p className="text-xl md:text-2xl font-bold text-white">{currentPrompt.text}</p>
                        </div>

                        {/* Example Answers */}
                        <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-6">
                            <h3 className="font-bold text-white mb-3">أمثلة للإجابات:</h3>
                            <div className="flex flex-wrap gap-2 justify-center">
                                {currentPrompt.examples.map((example, index) => (
                                    <span 
                                        key={index} 
                                        className="bg-white/30 backdrop-blur-sm text-white px-4 py-2 rounded-xl font-medium"
                                    >
                                        {example}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={nextRound}
                            className="w-full md:w-auto bg-white text-gray-900 hover:bg-white/90 font-bold px-8 py-4 rounded-xl shadow-lg text-xl transition-all duration-300 hover:scale-105"
                        >
                            الجولة التالية →
                        </button>
                    </div>
                </div>

                {/* Player Scores */}
                <div className={`rounded-2xl shadow-xl p-6 backdrop-blur-sm ${
                    isDarkMode 
                        ? 'bg-white/10 border border-white/20' 
                        : 'bg-white/90 border border-gray-200'
                }`}>
                    <h3 className={`text-xl font-bold mb-4 ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>النتائج</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {players.map((player, index) => (
                            <div
                                key={player.id}
                                className={`p-4 rounded-xl text-center transition-all duration-300 ${
                                    index === currentPlayer
                                        ? isDarkMode
                                            ? 'bg-teal-600/50 border-2 border-teal-400'
                                            : 'bg-gradient-to-r from-teal-100 to-cyan-100 border-2 border-teal-400'
                                        : isDarkMode
                                            ? 'bg-white/10'
                                            : 'bg-gray-100'
                                }`}
                            >
                                <span className={`font-semibold block ${
                                    isDarkMode ? 'text-white' : 'text-gray-900'
                                }`}>{player.name}</span>
                                <p className={`text-2xl font-bold mt-2 ${
                                    isDarkMode ? 'text-teal-400' : 'text-teal-600'
                                }`}>{player.score}</p>
                                <p className={`text-xs ${
                                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                }`}>نقاط</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Finished Phase
    if (gameState === "finished") {
        const winner = getWinner();
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

        return (
            <div
                className={`min-h-screen transition-colors duration-300 ${
                    isDarkMode ? 'bg-black' : 'bg-white'
                } ${isMobile ? "px-4 pt-6 pb-24" : "px-8 pt-12 pb-8"}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <button
                        onClick={resetGame}
                        className={`rounded-xl p-3 transition-all duration-300 ${
                            isDarkMode 
                                ? 'text-white hover:bg-white/20' 
                                : 'text-gray-800 hover:bg-black/10'
                        }`}
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="text-center flex-1">
                        <h1 className={`font-bold ${isMobile ? "text-2xl" : "text-4xl"} mb-2 ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}>
                            انتهت اللعبة
                        </h1>
                        <p className={isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}>
                            شكراً على اللعب!
                        </p>
                    </div>
                    <div className={`rounded-2xl shadow-lg p-3 ${
                        isDarkMode 
                            ? 'bg-gradient-to-r from-amber-600 to-yellow-600' 
                            : 'bg-gradient-to-r from-amber-100 to-yellow-100'
                    }`}>
                        <div className="flex items-center gap-2">
                            <Coffee className={`w-5 h-5 ${isDarkMode ? 'text-amber-100' : 'text-amber-600'}`} />
                            <span className={`font-bold ${isDarkMode ? 'text-white' : 'text-amber-800'}`}>
                                {coffeeBeans}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Winner Announcement */}
                <div className="mb-8">
                    <div className={`rounded-3xl shadow-2xl p-8 text-center ${
                        isDarkMode 
                            ? 'bg-gradient-to-br from-teal-800 to-cyan-900 border border-teal-600' 
                            : 'bg-gradient-to-br from-teal-400 to-cyan-500'
                    }`}>
                        <Trophy className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-4 text-white" strokeWidth={1.5} />
                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">
                            {winner.name} فاز!
                        </h2>
                        <p className="text-xl text-white/90 mb-4">
                            النتيجة النهائية: {winner.score} نقطة
                        </p>
                        <div className="inline-block bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-full font-bold text-lg">
                            بطل اللعبة
                        </div>
                    </div>
                </div>

                {/* Final Scoreboard */}
                <div className={`rounded-2xl shadow-xl p-6 mb-8 backdrop-blur-sm ${
                    isDarkMode 
                        ? 'bg-white/10 border border-white/20' 
                        : 'bg-white/90 border border-gray-200'
                }`}>
                    <h3 className={`text-xl font-bold mb-4 text-center ${
                        isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>النتائج النهائية</h3>
                    <div className="space-y-3">
                        {sortedPlayers.map((player, index) => (
                            <div
                                key={player.id}
                                className={`flex items-center justify-between p-4 rounded-xl transition-all duration-300 ${
                                    index === 0
                                        ? isDarkMode
                                            ? 'bg-gradient-to-r from-teal-800 to-cyan-900 border-2 border-teal-500'
                                            : 'bg-gradient-to-r from-teal-100 to-cyan-100 border-2 border-teal-400'
                                        : index === 1
                                            ? isDarkMode
                                                ? 'bg-gradient-to-r from-gray-700 to-gray-800 border-2 border-gray-500'
                                                : 'bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-400'
                                            : index === 2
                                                ? isDarkMode
                                                    ? 'bg-gradient-to-r from-amber-800 to-yellow-900 border-2 border-amber-500'
                                                    : 'bg-gradient-to-r from-amber-100 to-yellow-100 border-2 border-amber-400'
                                                : isDarkMode
                                                    ? 'bg-white/10'
                                                    : 'bg-gray-100'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                                            index === 0
                                                ? "bg-teal-500 text-white"
                                                : index === 1
                                                    ? "bg-gray-500 text-white"
                                                    : index === 2
                                                        ? "bg-amber-500 text-white"
                                                        : isDarkMode
                                                            ? "bg-gray-700 text-gray-300"
                                                            : "bg-gray-300 text-gray-600"
                                        }`}
                                    >
                                        {index + 1}
                                    </div>
                                    <span className={`font-bold ${
                                        isDarkMode ? 'text-white' : 'text-gray-900'
                                    }`}>{player.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className={`text-2xl md:text-3xl font-bold ${
                                        isDarkMode ? 'text-white' : 'text-gray-900'
                                    }`}>{player.score}</p>
                                    <p className={`text-xs ${
                                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>نقاط</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Play Again */}
                <div className="text-center">
                    <button
                        onClick={resetGame}
                        className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white px-8 py-4 rounded-xl shadow-xl text-xl font-bold transition-all duration-300 hover:scale-105 flex items-center justify-center gap-3 mx-auto"
                    >
                        <ArrowLeft className="w-6 h-6" />
                        العب مرة أخرى
                    </button>
                </div>
            </div>
        );
    }
    return null;
}