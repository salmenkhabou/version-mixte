import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Clock, Trophy, Users, Pause, Play, RotateCcw, Volume2, VolumeX, Flame, X } from "lucide-react"
import footballQuestionsData from "../../data/footballQuestions.json"
import footballDaresData from "../../data/footballDares.json"

const clubs = [
    {
        name: "ريال مدريد",
        players: [
            "كريم بنزيما",
            "لوكا مودريتش",
            "فينيسيوس جونيور",
            "كاسيميرو",
            "سيرجيو راموس",
            "مارسيلو",
            "توني كروس",
            "كورتوا",
            "أسينسيو",
            "رودريجو",
            "فيدي فالفيردي",
            "إيدير ميليتاو",
            "ديفيد ألابا",
            "كامافينجا",
            "تشواميني",
        ],
    },
    {
        name: "برشلونة",
        players: [
            "ليونيل ميسي",
            "أنسو فاتي",
            "بيدري",
            "فرانكي دي يونغ",
            "جيرارد بيكيه",
            "جوردي ألبا",
            "سيرجيو بوسكيتس",
            "مارك تير شتيغن",
            "عثمان ديمبلي",
            "فيران توريس",
            "غافي",
            "رونالد أراوخو",
            "إريك غارسيا",
            "فيرمين لوبيز",
            "روبرت ليفاندوفسكي",
        ],
    },
    {
        name: "مانشستر سيتي",
        players: [
            "كيفين دي بروين",
            "إيرلينغ هالاند",
            "رياض محرز",
            "رحيم سترلينغ",
            "فيل فودين",
            "إيدرسون",
            "روبن دياس",
            "جواو كانسيلو",
            "برناردو سيلفا",
            "إلكاي غوندوغان",
            "جاك غريليش",
            "كايل ووكر",
            "ناثان أكي",
            "جوليان ألفاريز",
            "مانويل أكانجي",
        ],
    },
    {
        name: "ليفربول",
        players: [
            "محمد صلاح",
            "ساديو ماني",
            "فيرجيل فان دايك",
            "أليسون بيكر",
            "جوردان هندرسون",
            "فابينيو",
            "أندرو روبرتسون",
            "ترينت ألكسندر أرنولد",
            "روبرتو فيرمينو",
            "ثياغو ألكانتارا",
            "داروين نونيز",
            "لويس دياز",
            "كودي غاكبو",
            "دومينيك سوبوسلاي",
            "أليكسيس ماك أليستر",
        ],
    },
    {
        name: "مانشستر يونايتد",
        players: [
            "كريستيانو رونالدو",
            "ماركوس راشفورد",
            "بول بوغبا",
            "هاري ماغواير",
            "ديفيد دي خيا",
            "برونو فيرنانديز",
            "جادون سانشو",
            "رافائيل فاران",
            "أنطونيو فالنسيا",
            "فريد",
            "أنتوني",
            "كاسيميرو",
            "ليساندرو مارتينيز",
            "تايريل مالاسيا",
            "أليخاندرو غارناتشو",
        ],
    },
    {
        name: "تشيلسي",
        players: [
            "تياغو سيلفا",
            "ماسون ماونت",
            "كاي هافيرتز",
            "تيمو فيرنر",
            "ن'غولو كانتي",
            "كيبا أريزابالاغا",
            "ريس جيمس",
            "بن تشيلويل",
            "كريستيان بوليسيتش",
            "ماتيو كوفاتشيتش",
            "إنزو فيرنانديز",
            "ميخايلو مودريك",
            "ويسلي فوفانا",
            "كونور غالاغر",
            "نيكولاس جاكسون",
        ],
    },
    {
        name: "أرسنال",
        players: [
            "بوكايو ساكا",
            "مارتن أوديغارد",
            "غابرييل جيسوس",
            "توماس بارتي",
            "غابرييل مارتينيلي",
            "آرون رامسديل",
            "بن وايت",
            "غابرييل ماغالهايس",
            "غرانيت تشاكا",
            "إيمي سميث رو",
            "ديكلان رايس",
            "كاي هافيرتز",
            "ويليام ساليبا",
            "أولكسندر زينتشينكو",
            "ليندرو تروسارد",
        ],
    },
    {
        name: "بايرن ميونخ",
        players: [
            "روبرت ليفاندوفسكي",
            "توماس مولر",
            "مانويل نوير",
            "جوشوا كيميتش",
            "ليون غوريتسكا",
            "سيرج غنابري",
            "كينغسلي كومان",
            "ألفونسو ديفيس",
            "نيكلاس زوله",
            "لوكاس هيرنانديز",
            "هاري كين",
            "جمال موسيالا",
            "ماتيس دي ليخت",
            "ليروي ساني",
            "ساديو ماني",
        ],
    },
    {
        name: "باريس سان جيرمان",
        players: [
            "كيليان مبابي",
            "نيمار",
            "ليونيل ميسي",
            "أشرف حكيمي",
            "ماركينيوس",
            "فيراتي",
            "جيانلويجي دوناروما",
            "بريسنيل كيمبيمبي",
            "أنخيل دي ماريا",
            "إيدريسا غانا غي",
            "فابيان رويز",
            "فيتينيا",
            "نونو مينديز",
            "وارين زاير إيميري",
            "غونسالو راموس",
        ],
    },
    {
        name: "يوفنتوس",
        players: [
            "كريستيانو رونالدو",
            "باولو ديبالا",
            "فيديريكو كييزا",
            "مانويل لوكاتيلي",
            "ماتياس دي ليخت",
            "فويتشيخ تشيزني",
            "خوان كوادرادو",
            "أدريان رابيو",
            "دوسان فلاهوفيتش",
            "أنخيل دي ماريا",
            "نيكولو فاجيولي",
            "فيديريكو غاتي",
            "دانيلو",
            "ويستون ماكيني",
            "أركاديوش ميليك",
        ],
    },
]

// Questions très difficiles depuis JSON
const veryHardQuestions = footballQuestionsData.veryHardQuestions

const players = [
    {
        name: "كريم بنزيما",
        position: "مهاجم",
        currentClub: "الاتحاد السعودي",
        previousClubs: ["ريال مدريد", "أولمبيك ليون"],
        achievements: ["دوري أبطال أوروبا 5 مرات", "الدوري الإسباني 4 مرات", "الكرة الذهبية 2022"],
        nationality: "فرنسا",
        age: 36,
    },
    {
        name: "ليونيل ميسي",
        position: "جناح أيمن / مهاجم",
        currentClub: "إنتر ميامي",
        previousClubs: ["برشلونة", "باريس سان جيرمان"],
        achievements: ["الكرة الذهبية 8 مرات", "دوري أبطال أوروبا 4 مرات", "كأس العالم 2022"],
        nationality: "الأرجنتين",
        age: 37,
    },
    {
        name: "كيليان مبابي",
        position: "جناح أيسر / مهاجم",
        currentClub: "ريال مدريد",
        previousClubs: ["باريس سان جيرمان", "موناكو"],
        achievements: ["كأس العالم 2018", "الدوري الفرنسي 6 مرات", "هداف كأس العالم 2022"],
        nationality: "فرنسا",
        age: 25,
    },
    {
        name: "إيرلينغ هالاند",
        position: "مهاجم",
        currentClub: "مانشستر سيتي",
        previousClubs: ["بوروسيا دورتموند", "ريد بول سالزبورغ"],
        achievements: ["الدوري الإنجليزي 2023", "دوري أبطال أوروبا 2023", "هداف الدوري الإنجليزي"],
        nationality: "النرويج",
        age: 24,
    },
    {
        name: "محمد صلاح",
        position: "جناح أيمن",
        currentClub: "ليفربول",
        previousClubs: ["روما", "فيورنتينا", "تشيلسي", "بازل"],
        achievements: ["دوري أبطال أوروبا 2019", "الدوري الإنجليزي 2020", "هداف الدوري الإنجليزي 3 مرات"],
        nationality: "مصر",
        age: 32,
    },
    {
        name: "كيفين دي بروين",
        position: "وسط مهاجم",
        currentClub: "مانشستر سيتي",
        previousClubs: ["فولفسبورغ", "تشيلسي", "فيردر بريمن"],
        achievements: ["الدوري الإنجليزي 6 مرات", "دوري أبطال أوروبا 2023", "أفضل لاعب في الدوري الإنجليزي مرتين"],
        nationality: "بلجيكا",
        age: 33,
    },
    {
        name: "فيرجيل فان دايك",
        position: "مدافع وسط",
        currentClub: "ليفربول",
        previousClubs: ["ساوثهامبتون", "سيلتيك", "غرونينغن"],
        achievements: ["دوري أبطال أوروبا 2019", "الدوري الإنجليزي 2020", "أفضل مدافع في العالم"],
        nationality: "هولندا",
        age: 33,
    },
    {
        name: "لوكا مودريتش",
        position: "وسط",
        currentClub: "ريال مدريد",
        previousClubs: ["توتنهام", "دينامو زغرب"],
        achievements: ["الكرة الذهبية 2018", "دوري أبطال أوروبا 6 مرات", "كأس العالم نائب البطل 2018"],
        nationality: "كرواتيا",
        age: 39,
    },
    {
        name: "نيمار",
        position: "جناح أيسر / مهاجم",
        currentClub: "الهلال السعودي",
        previousClubs: ["باريس سان جيرمان", "برشلونة", "سانتوس"],
        achievements: ["دوري أبطال أوروبا 2015", "الدوري الفرنسي 5 مرات", "الأولمبياد الذهبية 2016"],
        nationality: "البرازيل",
        age: 32,
    },
    {
        name: "روبرت ليفاندوفسكي",
        position: "مهاجم",
        currentClub: "برشلونة",
        previousClubs: ["بايرن ميونخ", "بوروسيا دورتموند"],
        achievements: ["دوري أبطال أوروبا 2020", "الدوري الألماني 8 مرات", "هداف أوروبا 5 مرات"],
        nationality: "بولندا",
        age: 36,
    },
]

export default function FootballChallengeGame({ isMobile, setCurrentGame, isDarkMode }) {
    const [gameMode, setGameMode] = useState("menu")
    const [currentPlayer, setCurrentPlayer] = useState(0)
    const [scores, setScores] = useState([0, 0])
    const [timer, setTimer] = useState(0)
    const [isRunning, setIsRunning] = useState(false)
    const [currentQuestion, setCurrentQuestion] = useState(null)
    const [selectedClub, setSelectedClub] = useState(null)
    const [gamePhase, setGamePhase] = useState("setup")
    const [usedPlayers, setUsedPlayers] = useState([])
    const [usedQuestions, setUsedQuestions] = useState([])
    const [selectedAnswer, setSelectedAnswer] = useState(null)
    const [showResult, setShowResult] = useState(false)
    const [winner, setWinner] = useState(null)
    const [soundEnabled, setSoundEnabled] = useState(true)
    const [showDarePopup, setShowDarePopup] = useState(false)
    const [currentDare, setCurrentDare] = useState(null)
    const [loserPlayer, setLoserPlayer] = useState(null)
    const [dareCompleted, setDareCompleted] = useState(false)
    const intervalRef = useRef(null)
    const tickSoundRef = useRef(null)
    const urgentSoundRef = useRef(null)
    const correctSoundRef = useRef(null)
    const wrongSoundRef = useRef(null)

    // Initialize audio on mount
    useEffect(() => {
        // Create Audio Context for Web Audio API (better performance)
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if (AudioContext) {
            const audioContext = new AudioContext()
            
            // Create simple beep sounds using oscillator
            const createBeep = (frequency, duration) => {
                return () => {
                    if (!soundEnabled) return
                    const oscillator = audioContext.createOscillator()
                    const gainNode = audioContext.createGain()
                    
                    oscillator.connect(gainNode)
                    gainNode.connect(audioContext.destination)
                    
                    oscillator.frequency.value = frequency
                    oscillator.type = 'sine'
                    
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration)
                    
                    oscillator.start(audioContext.currentTime)
                    oscillator.stop(audioContext.currentTime + duration)
                }
            }
            
            tickSoundRef.current = createBeep(800, 0.1)
            urgentSoundRef.current = createBeep(1200, 0.15)
            correctSoundRef.current = createBeep(600, 0.3)
            wrongSoundRef.current = createBeep(200, 0.5)
        }
    }, [soundEnabled])

    useEffect(() => {
        if (isRunning && timer > 0) {
            intervalRef.current = setInterval(() => {
                setTimer((prev) => {
                    if (prev <= 1) {
                        setIsRunning(false)
                        if (wrongSoundRef.current) wrongSoundRef.current()
                        
                        // Show dare popup when time expires in ALL game modes
                        const loser = currentPlayer
                        setLoserPlayer(loser)
                        const randomDare = footballDaresData.dares[Math.floor(Math.random() * footballDaresData.dares.length)]
                        setCurrentDare(randomDare)
                        setShowDarePopup(true)
                        setDareCompleted(false)
                        
                        if (gameMode === "turns") {
                            const winnerPlayer = currentPlayer === 0 ? 1 : 0
                            setWinner(winnerPlayer)
                            // Don't set finished yet, wait for dare completion
                        } else if (gameMode === "guess" || gameMode === "quick") {
                            // In guess/quick mode, other player gets a chance after dare
                            // Game continues
                        }
                        return 0
                    }
                    // Play sound effects
                    if (prev <= 5 && urgentSoundRef.current) {
                        urgentSoundRef.current()
                    } else if (prev <= 10 && tickSoundRef.current) {
                        tickSoundRef.current()
                    }
                    return prev - 1
                })
            }, 1000)
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
        }
    }, [isRunning, timer, gameMode, currentPlayer])

    const startGuessGame = () => {
        setGameMode("guess")
        setGamePhase("playing")
        setCurrentPlayer(0)
        setScores([0, 0])
        setTimer(30)
        setIsRunning(true)
        generateQuestion()
    }

    const startQuickGame = () => {
        setGameMode("quick")
        setGamePhase("playing")
        setCurrentPlayer(0)
        setScores([0, 0])
        setTimer(60)
        setIsRunning(true)
        const randomClub = clubs[Math.floor(Math.random() * clubs.length)]
        setSelectedClub(randomClub)
    }

    const startTurnsGame = () => {
        setGameMode("turns")
        setGamePhase("playing")
        setCurrentPlayer(0)
        setScores([0, 0])
        setTimer(10)
        setIsRunning(true)
        setUsedPlayers([])
        setWinner(null)
        const randomClub = clubs[Math.floor(Math.random() * clubs.length)]
        setSelectedClub(randomClub)
    }

    const startHardQuizGame = () => {
        setGameMode("hardquiz")
        setGamePhase("playing")
        setCurrentPlayer(0)
        setScores([0, 0])
        setTimer(20)
        setIsRunning(true)
        setUsedQuestions([])
        setWinner(null)
        generateHardQuestion()
    }

    const generateQuestion = () => {
        const randomPlayer = players[Math.floor(Math.random() * players.length)]
        setCurrentQuestion(randomPlayer)
    }

    const generateHardQuestion = () => {
        const availableQuestions = veryHardQuestions.filter(q => !usedQuestions.includes(q.id))
        if (availableQuestions.length === 0) {
            setGamePhase("finished")
            setIsRunning(false)
            return
        }
        const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)]
        setCurrentQuestion(randomQuestion)
        setSelectedAnswer(null)
        setShowResult(false)
    }

    const handleAnswerSelect = (answer) => {
        if (showResult) return
        
        setSelectedAnswer(answer)
        setShowResult(true)
        setIsRunning(false)
        
        const newScores = [...scores]
        const isCorrect = answer === currentQuestion.correctAnswer
        
        if (isCorrect) {
            newScores[currentPlayer] += 10
            setScores(newScores)
            if (correctSoundRef.current) correctSoundRef.current()
        } else {
            if (wrongSoundRef.current) wrongSoundRef.current()
        }
        
        setTimeout(() => {
            setUsedQuestions([...usedQuestions, currentQuestion.id])
            switchPlayer()
            generateHardQuestion()
            setTimer(20)
            setIsRunning(true)
        }, 3000)
    }

    const handleCorrectAnswer = () => {
        const newScores = [...scores]
        newScores[currentPlayer] += 1
        setScores(newScores)

        if (gameMode === "guess") {
            generateQuestion()
        }
        
        // Switch to next player automatically
        switchPlayer()
    }

    const handleWrongAnswer = () => {
        if (gameMode === "turns") {
            setIsRunning(false)
            if (wrongSoundRef.current) wrongSoundRef.current()
            
            // Show dare popup for losing player
            const loser = currentPlayer
            setLoserPlayer(loser)
            const randomDare = footballDaresData.dares[Math.floor(Math.random() * footballDaresData.dares.length)]
            setCurrentDare(randomDare)
            setShowDarePopup(true)
            setDareCompleted(false)
            
            const winnerPlayer = currentPlayer === 0 ? 1 : 0
            setWinner(winnerPlayer)
            // Don't set finished yet, wait for dare completion
        }
    }

    const switchPlayer = () => {
        if (gameMode === "turns") {
            setCurrentPlayer(currentPlayer === 0 ? 1 : 0)
            setTimer(10)
        } else if (gameMode === "hardquiz") {
            setCurrentPlayer(currentPlayer === 0 ? 1 : 0)
        } else {
            setCurrentPlayer(currentPlayer === 0 ? 1 : 0)
        }
    }

    const pauseGame = () => setIsRunning(false)
    const resumeGame = () => setIsRunning(true)
    const toggleSound = () => setSoundEnabled(!soundEnabled)
    
    const completeDare = () => {
        setDareCompleted(true)
        setTimeout(() => {
            setShowDarePopup(false)
            if (gameMode === "turns" && winner !== null) {
                setGamePhase("finished")
            }
        }, 1500)
    }

    const resetGame = () => {
        setGameMode("menu")
        setGamePhase("setup")
        setCurrentPlayer(0)
        setScores([0, 0])
        setTimer(0)
        setIsRunning(false)
        setCurrentQuestion(null)
        setSelectedClub(null)
        setUsedPlayers([])
        setWinner(null)
        setShowDarePopup(false)
        setCurrentDare(null)
        setLoserPlayer(null)
        setDareCompleted(false)
    }

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    return (
        <div
            className={`min-h-screen transition-colors duration-300 ${
                isDarkMode 
                    ? 'bg-gradient-to-br from-green-900 via-blue-900 to-purple-900' 
                    : 'bg-gradient-to-br from-green-100 via-blue-100 to-purple-100'
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
                <div className="text-center">
                    <h1
                        className={`font-bold ${isMobile ? "text-2xl" : "text-4xl"} mb-2 transition-colors ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                        }`}
                    >
                        ⚽ تحدي كرة القدم
                    </h1>
                    <p className={`transition-colors ${
                        isDarkMode ? 'text-green-200' : 'text-green-700'
                    }`}>4 ألعاب مثيرة للمحترفين</p>
                </div>
                <button
                    onClick={toggleSound}
                    className={`rounded-xl p-3 transition-all duration-300 ${
                        isDarkMode 
                            ? 'text-white hover:bg-white/20' 
                            : 'text-gray-800 hover:bg-black/10'
                    }`}
                    title={soundEnabled ? "إيقاف الصوت" : "تشغيل الصوت"}
                >
                    {soundEnabled ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </button>
            </div>

            {/* Game Menu */}
            {gameMode === "menu" && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                    {/* Advanced Player Guess */}
                    <div className={`group hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl rounded-2xl ${
                        isDarkMode 
                            ? 'bg-gradient-to-br from-blue-600 to-purple-700' 
                            : 'bg-gradient-to-br from-blue-400 to-purple-500'
                    }`}>
                        <div className="p-6 text-center text-white">
                            <div className="text-6xl mb-4">🧠</div>
                            <h3 className="text-xl font-bold mb-3">خمن اللاعب المتقدم</h3>
                            <p className={`mb-4 text-sm leading-relaxed ${
                                isDarkMode ? 'text-blue-100' : 'text-blue-50'
                            }`}>
                                أسئلة صعبة عن اللاعبين مع تفاصيل دقيقة - إجابات شفهية
                            </p>
                            <div className={`flex items-center justify-center gap-2 text-sm mb-4 ${
                                isDarkMode ? 'text-blue-200' : 'text-blue-50'
                            }`}>
                                <Clock className="w-4 h-4" />
                                <span>30 ثانية لكل سؤال</span>
                            </div>
                            <button
                                onClick={startGuessGame}
                                className="w-full bg-white text-blue-600 hover:bg-blue-50 font-bold px-6 py-3 rounded-xl transition-all duration-300"
                            >
                                ابدأ التحدي
                            </button>
                        </div>
                    </div>

                    {/* Quick Players Challenge */}
                    <div className={`group hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl rounded-2xl ${
                        isDarkMode 
                            ? 'bg-gradient-to-br from-orange-600 to-red-600' 
                            : 'bg-gradient-to-br from-orange-400 to-red-400'
                    }`}>
                        <div className="p-6 text-center text-white">
                            <div className="text-6xl mb-4">⚡</div>
                            <h3 className="text-xl font-bold mb-3">تحدي اللاعبين السريع</h3>
                            <p className={`mb-4 text-sm leading-relaxed ${
                                isDarkMode ? 'text-orange-100' : 'text-orange-50'
                            }`}>
                                اذكر أكبر عدد من لاعبي النادي شفهياً في 60 ثانية
                            </p>
                            <div className={`flex items-center justify-center gap-2 text-sm mb-4 ${
                                isDarkMode ? 'text-orange-200' : 'text-orange-50'
                            }`}>
                                <Trophy className="w-4 h-4" />
                                <span>الأكثر لاعبين يفوز</span>
                            </div>
                            <button
                                onClick={startQuickGame}
                                className="w-full bg-white text-orange-600 hover:bg-orange-50 font-bold px-6 py-3 rounded-xl transition-all duration-300"
                            >
                                ابدأ السباق
                            </button>
                        </div>
                    </div>

                    {/* Turn-Based Challenge */}
                    <div className={`group hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl rounded-2xl ${
                        isDarkMode 
                            ? 'bg-gradient-to-br from-purple-600 to-pink-600' 
                            : 'bg-gradient-to-br from-purple-400 to-pink-400'
                    }`}>
                        <div className="p-6 text-center text-white">
                            <div className="text-6xl mb-4">🔄</div>
                            <h3 className="text-xl font-bold mb-3">تحدي الأدوار</h3>
                            <p className={`mb-4 text-sm leading-relaxed ${
                                isDarkMode ? 'text-purple-100' : 'text-purple-50'
                            }`}>
                                نادي واحد ثابت - كل لاعب 10 ثوان - خطأ واحد = خسارة
                            </p>
                            <div className={`flex items-center justify-center gap-2 text-sm mb-4 ${
                                isDarkMode ? 'text-purple-200' : 'text-purple-50'
                            }`}>
                                <Users className="w-4 h-4" />
                                <span>لاعبان - إقصاء مباشر</span>
                            </div>
                            <button
                                onClick={startTurnsGame}
                                className="w-full bg-white text-purple-600 hover:bg-purple-50 font-bold px-6 py-3 rounded-xl transition-all duration-300"
                            >
                                ابدأ المواجهة
                            </button>
                        </div>
                    </div>

                    {/* Hard Quiz Challenge - NEW */}
                    <div className={`group hover:scale-105 transition-all duration-300 cursor-pointer shadow-xl rounded-2xl ${
                        isDarkMode 
                            ? 'bg-gradient-to-br from-red-700 to-black' 
                            : 'bg-gradient-to-br from-red-600 to-gray-800'
                    }`}>
                        <div className="p-6 text-center text-white">
                            <div className="text-6xl mb-4">🔥</div>
                            <h3 className="text-xl font-bold mb-3">أسئلة صعبة جداً</h3>
                            <p className={`mb-4 text-sm leading-relaxed ${
                                isDarkMode ? 'text-red-100' : 'text-red-50'
                            }`}>
                                أسئلة تاريخية وأرقام نادرة - للمحترفين فقط!
                            </p>
                            <div className={`flex items-center justify-center gap-2 text-sm mb-4 ${
                                isDarkMode ? 'text-red-200' : 'text-red-50'
                            }`}>
                                <Trophy className="w-4 h-4" />
                                <span>50 سؤال - 10 نقاط لكل إجابة صحيحة</span>
                            </div>
                            <button
                                onClick={startHardQuizGame}
                                className="w-full bg-white text-red-600 hover:bg-red-50 font-bold px-6 py-3 rounded-xl transition-all duration-300"
                            >
                                ابدأ التحدي الأصعب
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Game Interface */}
            {gameMode !== "menu" && (
                <div className="max-w-4xl mx-auto">
                    {/* Game Header */}
                    <div className={`backdrop-blur-sm rounded-3xl p-6 mb-6 shadow-2xl border transition-colors ${
                        isDarkMode 
                            ? 'bg-white/10 border-white/20' 
                            : 'bg-white/95 border-gray-200'
                    }`}>
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                            <div className="text-center flex-1">
                                <h3 className={`text-xl md:text-2xl font-bold mb-2 transition-colors ${
                                    isDarkMode ? 'text-white' : 'text-gray-800'
                                }`}>
                                    {gameMode === "guess" && "خمن اللاعب المتقدم"}
                                    {gameMode === "quick" && "تحدي اللاعبين السريع"}
                                    {gameMode === "turns" && "تحدي الأدوار"}
                                    {gameMode === "hardquiz" && "أسئلة صعبة جداً 🔥"}
                                </h3>
                                {selectedClub && (
                                    <p className={`text-base md:text-lg transition-colors ${
                                        isDarkMode ? 'text-white/70' : 'text-gray-600'
                                    }`}>
                                        النادي:{" "}
                                        <span className={`font-bold ${
                                            isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                        }`}>
                                            {selectedClub.name}
                                        </span>
                                    </p>
                                )}
                            </div>
                            <div className="text-center">
                                <div
                                    className={`text-3xl md:text-4xl font-bold ${
                                        timer <= 5 ? "text-red-500 animate-pulse" : isDarkMode ? "text-white" : "text-gray-800"
                                    }`}
                                >
                                    {formatTime(timer)}
                                </div>
                                <div className="flex gap-2 mt-2 justify-center">
                                    {gameMode !== "turns" && (
                                        <>
                                            {isRunning ? (
                                                <button 
                                                    onClick={pauseGame} 
                                                    className={`p-2 rounded-lg transition-all ${
                                                        isDarkMode 
                                                            ? 'bg-white/20 hover:bg-white/30 text-white' 
                                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                                    }`}
                                                >
                                                    <Pause className="w-4 h-4" />
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={resumeGame} 
                                                    className={`p-2 rounded-lg transition-all ${
                                                        isDarkMode 
                                                            ? 'bg-white/20 hover:bg-white/30 text-white' 
                                                            : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                                    }`}
                                                >
                                                    <Play className="w-4 h-4" />
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <button 
                                        onClick={resetGame} 
                                        className={`p-2 rounded-lg transition-all ${
                                            isDarkMode 
                                                ? 'bg-white/20 hover:bg-white/30 text-white' 
                                                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                                        }`}
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Scores */}
                        <div className="grid grid-cols-2 gap-4">
                            <div
                                className={`text-center p-4 rounded-2xl transition-all ${
                                    currentPlayer === 0
                                        ? isDarkMode 
                                            ? "bg-blue-500/30 border-2 border-blue-400" 
                                            : "bg-blue-100 border-2 border-blue-500"
                                        : isDarkMode 
                                            ? "bg-white/5" 
                                            : "bg-gray-100"
                                }`}
                            >
                                <h4 className={`font-bold mb-2 ${
                                    isDarkMode ? 'text-white' : 'text-gray-800'
                                }`}>اللاعب الأول</h4>
                                <div className={`text-2xl md:text-3xl font-bold ${
                                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                                }`}>{scores[0]}</div>
                            </div>
                            <div
                                className={`text-center p-4 rounded-2xl transition-all ${
                                    currentPlayer === 1
                                        ? isDarkMode 
                                            ? "bg-green-500/30 border-2 border-green-400" 
                                            : "bg-green-100 border-2 border-green-500"
                                        : isDarkMode 
                                            ? "bg-white/5" 
                                            : "bg-gray-100"
                                }`}
                            >
                                <h4 className={`font-bold mb-2 ${
                                    isDarkMode ? 'text-white' : 'text-gray-800'
                                }`}>اللاعب الثاني</h4>
                                <div className={`text-2xl md:text-3xl font-bold ${
                                    isDarkMode ? 'text-green-400' : 'text-green-600'
                                }`}>{scores[1]}</div>
                            </div>
                        </div>

                        {gameMode === "turns" && gamePhase === "playing" && (
                            <div className="mt-4 text-center">
                                <p className={`text-lg font-semibold ${
                                    isDarkMode ? 'text-white' : 'text-gray-700'
                                }`}>
                                    دور:{" "}
                                    <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>
                                        اللاعب {currentPlayer + 1}
                                    </span>
                                </p>
                                <p className={`text-sm mt-1 ${
                                    isDarkMode ? 'text-white/60' : 'text-gray-500'
                                }`}>
                                    اذكر لاعب من {selectedClub?.name} لم يُذكر من قبل
                                </p>
                            </div>
                        )}
                    </div>
                    {/* Game Content */}
                    {gameMode === "guess" && currentQuestion && gamePhase === "playing" && (
                        <div className={`rounded-2xl shadow-2xl overflow-hidden ${
                            isDarkMode 
                                ? 'bg-gradient-to-br from-blue-600 to-purple-700' 
                                : 'bg-gradient-to-br from-blue-400 to-purple-500'
                        }`}>
                            <div className="p-6 md:p-8 text-center text-white">
                                <div className="text-5xl md:text-6xl mb-6">🤔</div>
                                <h3 className="text-xl md:text-2xl font-bold mb-6">من هذا اللاعب؟</h3>
                                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 md:p-6 mb-6 text-right">
                                    <div className="space-y-2 md:space-y-3">
                                        <p className="text-sm md:text-base">
                                            <strong>المركز:</strong> {currentQuestion.position}
                                        </p>
                                        <p className="text-sm md:text-base">
                                            <strong>النادي الحالي:</strong> {currentQuestion.currentClub}
                                        </p>
                                        <p className="text-sm md:text-base">
                                            <strong>الأندية السابقة:</strong> {currentQuestion.previousClubs.join(", ")}
                                        </p>
                                        <p className="text-sm md:text-base">
                                            <strong>الإنجازات:</strong> {currentQuestion.achievements.join(", ")}
                                        </p>
                                        <p className="text-sm md:text-base">
                                            <strong>الجنسية:</strong> {currentQuestion.nationality}
                                        </p>
                                        <p className="text-sm md:text-base">
                                            <strong>العمر:</strong> {currentQuestion.age} سنة
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-3 md:gap-4 justify-center flex-wrap">
                                    <button
                                        onClick={handleCorrectAnswer}
                                        className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 md:px-8 py-2 md:py-3 rounded-lg transition-all duration-300 hover:scale-105"
                                    >
                                        إجابة صحيحة ✓
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hard Quiz Game Interface */}
                    {gameMode === "hardquiz" && currentQuestion && gamePhase === "playing" && (
                        <div className={`rounded-2xl shadow-2xl overflow-hidden ${
                            isDarkMode 
                                ? 'bg-gradient-to-br from-red-700 to-black' 
                                : 'bg-gradient-to-br from-red-600 to-gray-800'
                        }`}>
                            <div className="p-6 md:p-8 text-white">
                                <div className="text-5xl md:text-6xl mb-6 text-center">🔥</div>
                                
                                {/* Question Info */}
                                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 md:p-6 mb-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="bg-yellow-500 text-black px-3 py-1 rounded-full text-xs md:text-sm font-bold">
                                            {currentQuestion.category}
                                        </span>
                                        <span className="text-xs md:text-sm">
                                            دور: <span className="font-bold">اللاعب {currentPlayer + 1}</span>
                                        </span>
                                        <span className="bg-purple-500 text-white px-3 py-1 rounded-full text-xs md:text-sm font-bold">
                                            {usedQuestions.length + 1} / {veryHardQuestions.length}
                                        </span>
                                    </div>
                                    <h3 className="text-xl md:text-2xl font-bold mb-4 text-center leading-relaxed">
                                        {currentQuestion.question}
                                    </h3>
                                </div>

                                {/* Answer Options */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-6">
                                    {currentQuestion.answers.map((answer, index) => {
                                        const isCorrect = answer === currentQuestion.correctAnswer
                                        const isSelected = selectedAnswer === answer
                                        
                                        let buttonClass = "bg-white/20 hover:bg-white/30 border-2 border-white/30"
                                        
                                        if (showResult) {
                                            if (isCorrect) {
                                                buttonClass = "bg-green-500 border-green-600"
                                            } else if (isSelected && !isCorrect) {
                                                buttonClass = "bg-red-500 border-red-600"
                                            } else {
                                                buttonClass = "bg-white/10 border-white/20 opacity-50"
                                            }
                                        }
                                        
                                        return (
                                            <button
                                                key={index}
                                                onClick={() => handleAnswerSelect(answer)}
                                                disabled={showResult}
                                                className={`${buttonClass} text-white font-bold px-6 py-4 rounded-xl transition-all duration-300 hover:scale-105 text-base md:text-lg disabled:cursor-not-allowed`}
                                            >
                                                {answer}
                                                {showResult && isCorrect && " ✓"}
                                                {showResult && isSelected && !isCorrect && " ✗"}
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Result Message */}
                                {showResult && (
                                    <div className={`text-center p-4 rounded-xl ${
                                        selectedAnswer === currentQuestion.correctAnswer 
                                            ? 'bg-green-500/20' 
                                            : 'bg-red-500/20'
                                    }`}>
                                        <p className="text-xl md:text-2xl font-bold mb-2">
                                            {selectedAnswer === currentQuestion.correctAnswer 
                                                ? "إجابة صحيحة! 🎉 +10 نقاط" 
                                                : `إجابة خاطئة! ❌ الإجابة الصحيحة: ${currentQuestion.correctAnswer}`
                                            }
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {gameMode === "quick" && selectedClub && gamePhase === "playing" && (
                        <div className={`rounded-2xl shadow-2xl overflow-hidden ${
                            isDarkMode 
                                ? 'bg-gradient-to-br from-orange-600 to-red-600' 
                                : 'bg-gradient-to-br from-orange-400 to-red-400'
                        }`}>
                            <div className="p-6 md:p-8 text-center text-white">
                                <div className="text-5xl md:text-6xl mb-6">⚡</div>
                                <h3 className="text-2xl md:text-3xl font-bold mb-4">{selectedClub.name}</h3>
                                <p className="text-lg md:text-xl mb-6">اذكر أكبر عدد من اللاعبين شفهياً!</p>
                                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 md:p-6 mb-6">
                                    <p className="text-base md:text-lg">
                                        دور: <span className="font-bold">اللاعب {currentPlayer + 1}</span>
                                    </p>
                                    <p className="text-xs md:text-sm mt-2">قل أسماء اللاعبين بصوت عالٍ</p>
                                </div>
                                <div className="flex gap-3 md:gap-4 justify-center flex-wrap">
                                    <button
                                        onClick={handleCorrectAnswer}
                                        className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 md:px-8 py-2 md:py-3 rounded-lg transition-all duration-300 hover:scale-105"
                                    >
                                        لاعب صحيح ✓
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {gameMode === "turns" && selectedClub && gamePhase === "playing" && (
                        <div className={`rounded-2xl shadow-2xl overflow-hidden ${
                            isDarkMode 
                                ? 'bg-gradient-to-br from-purple-600 to-pink-600' 
                                : 'bg-gradient-to-br from-purple-400 to-pink-400'
                        }`}>
                            <div className="p-6 md:p-8 text-center text-white">
                                <div className="text-5xl md:text-6xl mb-6">🔄</div>
                                <h3 className="text-2xl md:text-3xl font-bold mb-4">{selectedClub.name}</h3>
                                <p className="text-lg md:text-xl mb-6">اذكر لاعب واحد من هذا النادي!</p>
                                <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-4 md:p-6 mb-6">
                                    <p className="text-xl md:text-2xl font-bold mb-2">دور: اللاعب {currentPlayer + 1}</p>
                                    <p className="text-base md:text-lg mb-4">لديك 10 ثوان فقط</p>
                                    <div className="text-xs md:text-sm">
                                        <p>⚠️ لا تكرر الأسماء المذكورة</p>
                                        <p>⚠️ خطأ واحد = خسارة فورية</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 md:gap-4 justify-center flex-wrap">
                                    <button
                                        onClick={() => {
                                            handleCorrectAnswer()
                                            switchPlayer()
                                            setTimer(10) // Reset timer for next player
                                        }}
                                        className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 md:px-8 py-2 md:py-3 rounded-lg transition-all duration-300 hover:scale-105"
                                    >
                                        إجابة صحيحة
                                    </button>
                                    <button
                                        onClick={handleWrongAnswer}
                                        className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 md:px-8 py-2 md:py-3 rounded-lg transition-all duration-300 hover:scale-105"
                                    >
                                        إجابة خاطئة
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Game Finished */}
                    {gamePhase === "finished" && (
                        <div className={`rounded-2xl shadow-2xl overflow-hidden ${
                            isDarkMode 
                                ? 'bg-gradient-to-br from-yellow-500 to-orange-600' 
                                : 'bg-gradient-to-br from-yellow-400 to-orange-500'
                        }`}>
                            <div className="p-6 md:p-8 text-center text-white">
                                <div className="text-5xl md:text-6xl mb-6">🏆</div>
                                <h3 className="text-2xl md:text-3xl font-bold mb-4">انتهت اللعبة!</h3>
                                {winner !== null && gameMode === "turns" ? (
                                    <div>
                                        <p className="text-xl md:text-2xl mb-4">
                                            الفائز: <span className="font-bold">اللاعب {winner + 1}</span>
                                        </p>
                                        <p className="text-base md:text-lg mb-6">تهانينا! 🎉</p>
                                    </div>
                                ) : (
                                    <div>
                                        <p className="text-xl md:text-2xl mb-4">النتيجة النهائية</p>
                                        {gameMode === "hardquiz" && (
                                            <p className="text-base md:text-lg mb-4 bg-white/20 rounded-xl p-3">
                                                انتهت جميع الأسئلة! 🔥
                                            </p>
                                        )}
                                        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6">
                                            <div className="bg-white/20 rounded-xl p-3 md:p-4">
                                                <p className="font-bold text-sm md:text-base">اللاعب الأول</p>
                                                <p className="text-2xl md:text-3xl">{scores[0]}</p>
                                                {gameMode === "hardquiz" && <p className="text-xs mt-1">نقطة</p>}
                                            </div>
                                            <div className="bg-white/20 rounded-xl p-3 md:p-4">
                                                <p className="font-bold text-sm md:text-base">اللاعب الثاني</p>
                                                <p className="text-2xl md:text-3xl">{scores[1]}</p>
                                                {gameMode === "hardquiz" && <p className="text-xs mt-1">نقطة</p>}
                                            </div>
                                        </div>
                                        <p className="text-lg md:text-xl mb-6">
                                            الفائز:{" "}
                                            <span className="font-bold">
                                                اللاعب {scores[0] > scores[1] ? "الأول" : scores[1] > scores[0] ? "الثاني" : "تعادل"}
                                            </span>
                                        </p>
                                    </div>
                                )}
                                <button 
                                    onClick={resetGame} 
                                    className="bg-white text-orange-600 hover:bg-orange-50 font-bold px-6 md:px-8 py-2 md:py-3 rounded-lg transition-all duration-300 hover:scale-105"
                                >
                                    لعبة جديدة
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Dare Popup - Mandatory when player loses */}
            {showDarePopup && currentDare && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 md:p-6 animate-fadeIn overflow-y-auto">
                    <div className={`rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 max-w-2xl w-full shadow-2xl relative overflow-hidden my-4 ${
                        isDarkMode 
                            ? 'bg-gradient-to-br from-red-900 via-orange-900 to-yellow-900' 
                            : 'bg-gradient-to-br from-red-500 via-orange-500 to-yellow-500'
                    }`}>
                        {/* Fire animation background */}
                        <div className="absolute inset-0 opacity-20">
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-transparent via-red-500 to-transparent animate-pulse"></div>
                        </div>

                        <div className="relative z-10 text-center text-white">
                            {!dareCompleted ? (
                                <>
                                    {/* Header */}
                                    <div className="text-5xl sm:text-6xl md:text-7xl mb-3 sm:mb-4 animate-bounce">🔥</div>
                                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 animate-pulse">
                                        وقت العقاب! ⚡
                                    </h2>
                                    
                                    {/* Loser announcement */}
                                    <div className="bg-black/30 backdrop-blur-sm rounded-xl sm:rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6">
                                        <p className="text-lg sm:text-xl md:text-2xl mb-1 sm:mb-2">
                                            اللاعب الخاسر: <span className="font-bold text-red-300">اللاعب {loserPlayer + 1}</span>
                                        </p>
                                        <p className="text-xs sm:text-sm md:text-base opacity-80">
                                            {gameMode === "turns" && winner !== null ? "❌ إجابة خاطئة!" : "⏰ انتهى الوقت!"} يجب عليك تنفيذ التحدي
                                        </p>
                                    </div>

                                    {/* Dare category badge */}
                                    <div className="flex flex-wrap justify-center gap-2 mb-3 sm:mb-4">
                                        <span className="bg-yellow-400 text-black px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold">
                                            {currentDare.category}
                                        </span>
                                        <span className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold ${
                                            currentDare.difficulty === 'easy' ? 'bg-green-500' :
                                            currentDare.difficulty === 'medium' ? 'bg-orange-500' :
                                            'bg-red-600'
                                        }`}>
                                            {currentDare.difficulty === 'easy' ? 'سهل' :
                                             currentDare.difficulty === 'medium' ? 'متوسط' : 'صعب'}
                                        </span>
                                    </div>

                                    {/* The Dare */}
                                    <div className="bg-white/10 backdrop-blur-lg rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 mb-4 sm:mb-6 border-2 border-yellow-400 shadow-2xl">
                                        <Flame className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 mx-auto mb-3 sm:mb-4 text-yellow-400 animate-pulse" />
                                        <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold leading-relaxed">
                                            {currentDare.text}
                                        </p>
                                    </div>

                                    {/* Warning message */}
                                    <div className="bg-red-900/50 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                                        <p className="text-sm sm:text-base md:text-lg font-semibold flex items-center justify-center gap-2 flex-wrap">
                                            ⚠️ يجب تنفيذ التحدي قبل المتابعة!
                                        </p>
                                    </div>

                                    {/* Complete button */}
                                    <button 
                                        onClick={completeDare} 
                                        className="w-full bg-white text-red-600 hover:bg-yellow-100 font-bold px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl transition-all duration-300 hover:scale-105 text-base sm:text-lg shadow-2xl"
                                    >
                                        ✅ أكملت التحدي!
                                    </button>

                                    <p className="text-xs sm:text-sm mt-3 sm:mt-4 opacity-70">
                                        * يجب تنفيذ التحدي بشكل كامل
                                    </p>
                                </>
                            ) : (
                                <>
                                    {/* Success message */}
                                    <div className="text-5xl sm:text-6xl md:text-7xl mb-3 sm:mb-4">🎉</div>
                                    <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
                                        أحسنت! 👏
                                    </h2>
                                    <p className="text-lg sm:text-xl md:text-2xl mb-3 sm:mb-4">
                                        تم تنفيذ التحدي بنجاح
                                    </p>
                                    <div className="text-4xl sm:text-5xl">✅</div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>

    )
}
