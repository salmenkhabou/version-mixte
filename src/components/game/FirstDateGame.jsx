import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "../ui/card"
import { ArrowLeft, Heart, Sparkles, Clock, Zap, MessageCircle, Star, Camera, Download, X, Volume2, VolumeX } from "lucide-react"
import { dateScenarios, intimacyLevels } from "../../data/firstDateData"
import { useLanguage } from "../../contexts/LanguageContext"


export default function FirstDateGame({ isMobile, setCurrentGame, isDarkMode }) {
    const { language } = useLanguage()
    const texts = {
        ar: {
            title: "لعبة الموعد الأول",
            preparing: "جاري تحضير لحظات رومانسية...",
            ready: "استعدوا لأجمل اللحظات معاً",
            level: "اختر مستوى التقارب",
            scenario: "اختر السيناريو",
            startDate: "ابدأ الموعد",
            back: "العودة",
            finishDate: "إنهاء الموعد",
            deepQuestion: "سؤال عميق",
            romanticChallenge: "تحدي رومانسي",
            takePhoto: "صورة معاً",
        },
        fr: {
            title: "Jeu du Premier Rendez-vous",
            preparing: "Preparation des moments romantiques...",
            ready: "Preparez-vous pour de beaux moments",
            level: "Choisir le niveau de proximite",
            scenario: "Choisir le scenario",
            startDate: "Commencer",
            back: "Retour",
            finishDate: "Terminer",
            deepQuestion: "Question profonde",
            romanticChallenge: "Defi romantique",
            takePhoto: "Prendre une photo",
        },
        en: {
            title: "First Date Game",
            preparing: "Preparing romantic moments...",
            ready: "Get ready for beautiful moments",
            level: "Choose intimacy level",
            scenario: "Choose scenario",
            startDate: "Start Date",
            back: "Back",
            finishDate: "End Date",
            deepQuestion: "Deep Question",
            romanticChallenge: "Romantic Challenge",
            takePhoto: "Take Photo",
        },
    }
    const t = (key) => texts[language]?.[key] || texts.ar[key]
    const l = (ar, fr, en) => (language === "fr" ? fr : language === "en" ? en : ar)

    const [isLoading, setIsLoading] = useState(true)
    const [gameState, setGameState] = useState("menu") // "menu" | "scenario" | "playing" | "question" | "dare" | "camera"
    const [selectedScenario, setSelectedScenario] = useState(null)
    const [selectedLevel, setSelectedLevel] = useState(0)
    const [currentQuestion, setCurrentQuestion] = useState("")
    const [currentDare, setCurrentDare] = useState("")
    const [usedQuestions, setUsedQuestions] = useState([])
    const [usedDares, setUsedDares] = useState([])
    const [timer, setTimer] = useState(0)
    const [isTimerActive, setIsTimerActive] = useState(false)
    const [isSpeaking, setIsSpeaking] = useState(false)
    const [autoRead, setAutoRead] = useState(true)
    const [capturedPhotos, setCapturedPhotos] = useState(() => {
        // Load photos from localStorage on init
        try {
            const saved = localStorage.getItem('firstDatePhotos')
            return saved ? JSON.parse(saved) : []
        } catch (err) {
            console.error("Error loading photos from localStorage:", err)
            return []
        }
    })
    const [showCamera, setShowCamera] = useState(false)
    const videoRef = useRef(null)
    const canvasRef = useRef(null)
    const [stream, setStream] = useState(null)
    const speechRef = useRef(null)

    // Loading effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false)
        }, 2500)
        return () => clearTimeout(timer)
    }, [])

    // Timer effect
    useEffect(() => {
        let interval
        if (isTimerActive && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1)
            }, 1000)
        } else if (timer === 0 && isTimerActive) {
            setIsTimerActive(false)
        }
        return () => clearInterval(interval)
    }, [isTimerActive, timer])

    // Cleanup camera on unmount
    useEffect(() => {
        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop())
            }
        }
    }, [stream])

    // Save photos to localStorage whenever they change
    useEffect(() => {
        try {
            localStorage.setItem('firstDatePhotos', JSON.stringify(capturedPhotos))
        } catch (err) {
            console.error("Error saving photos to localStorage:", err)
            // If localStorage is full, remove oldest photos
            if (err.name === 'QuotaExceededError') {
                const reducedPhotos = capturedPhotos.slice(-5) // Keep only last 5
                setCapturedPhotos(reducedPhotos)
                try {
                    localStorage.setItem('firstDatePhotos', JSON.stringify(reducedPhotos))
                } catch (e) {
                    console.error("Still can't save, clearing all:", e)
                    localStorage.removeItem('firstDatePhotos')
                }
            }
        }
    }, [capturedPhotos])

    // Text to speech function
    const speakText = (text) => {
        if (!autoRead) return
        
        // Stop any ongoing speech
        if (speechRef.current) {
            window.speechSynthesis.cancel()
        }

        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = language === "fr" ? "fr-FR" : language === "en" ? "en-US" : "ar-SA"
        utterance.rate = 0.9 // Slightly slower for clarity
        utterance.pitch = 1
        utterance.volume = 1

        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => setIsSpeaking(false)
        utterance.onerror = () => setIsSpeaking(false)

        speechRef.current = utterance
        window.speechSynthesis.speak(utterance)
    }

    const stopSpeaking = () => {
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
    }

    const toggleAutoRead = () => {
        setAutoRead(!autoRead)
        if (!autoRead === false) {
            stopSpeaking()
        }
    }

    // Auto-read when question or dare changes
    useEffect(() => {
        if (gameState === "question" && currentQuestion && autoRead) {
            speakText(currentQuestion)
        }
    }, [currentQuestion, gameState, autoRead])

    useEffect(() => {
        if (gameState === "dare" && currentDare && autoRead) {
            speakText(currentDare)
        }
    }, [currentDare, gameState, autoRead])

    // Stop speaking when leaving question/dare state
    useEffect(() => {
        if (gameState !== "question" && gameState !== "dare") {
            stopSpeaking()
        }
    }, [gameState])

    const selectScenario = (scenario) => {
        setSelectedScenario(scenario)
        setGameState("scenario")
        setUsedQuestions([])
        setUsedDares([])
    }

    const startGame = () => setGameState("playing")

    const getRandomQuestion = () => {
        if (!selectedScenario) return
        const available = selectedScenario.questions
            .map((q, i) => ({ q, i }))
            .filter((q) => !usedQuestions.includes(q.i))

        if (available.length === 0) {
            setUsedQuestions([])
            return selectedScenario.questions[0]
        }

        const random = available[Math.floor(Math.random() * available.length)]
        setUsedQuestions([...usedQuestions, random.i])
        setCurrentQuestion(random.q)
        setGameState("question")
        setTimer(120)
        setIsTimerActive(true)
    }

    const getRandomDare = () => {
        if (!selectedScenario) return
        const available = selectedScenario.dares
            .map((d, i) => ({ d, i }))
            .filter((d) => !usedDares.includes(d.i))

        if (available.length === 0) {
            setUsedDares([])
            return selectedScenario.dares[0]
        }

        const random = available[Math.floor(Math.random() * available.length)]
        setUsedDares([...usedDares, random.i])
        setCurrentDare(random.d)
        setGameState("dare")
        setTimer(300)
        setIsTimerActive(true)
    }

    const backToPlaying = () => {
        setGameState("playing")
        setIsTimerActive(false)
        setTimer(0)
    }

    const resetGame = () => {
        setGameState("menu")
        setSelectedScenario(null)
        setSelectedLevel(0)
        setUsedQuestions([])
        setUsedDares([])
        setIsTimerActive(false)
        setTimer(0)
        stopCamera()
    }

    const formatTime = (s) => {
        const m = Math.floor(s / 60)
        const sec = s % 60
        return `${m}:${sec.toString().padStart(2, "0")}`
    }

    // Camera functions
    const startCamera = async () => {
        console.log("Starting camera...")
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert(l("متصفحك لا يدعم الوصول إلى الكاميرا", "Votre navigateur ne prend pas en charge l'acces a la camera", "Your browser does not support camera access"))
                return
            }

            const mediaStream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    facingMode: 'user',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }, 
                audio: false 
            })
            
            console.log("Camera stream obtained:", mediaStream)
            setStream(mediaStream)
            setShowCamera(true)
            
            // Wait for video element to be ready
            setTimeout(() => {
                if (videoRef.current) {
                    videoRef.current.srcObject = mediaStream
                    videoRef.current.play()
                        .then(() => console.log("Video playing"))
                        .catch(err => console.error("Error playing video:", err))
                }
            }, 100)
        } catch (err) {
            console.error("Error accessing camera:", err)
            let errorMessage = l("لا يمكن الوصول إلى الكاميرا. ", "Impossible d'acceder a la camera. ", "Cannot access the camera. ")
            
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                errorMessage += l("يرجى السماح للمتصفح باستخدام الكاميرا.", "Veuillez autoriser le navigateur a utiliser la camera.", "Please allow the browser to use the camera.")
            } else if (err.name === 'NotFoundError') {
                errorMessage += l("لم يتم العثور على كاميرا.", "Aucune camera trouvee.", "No camera was found.")
            } else {
                errorMessage += l("تأكد من إعطاء الإذن للمتصفح.", "Assurez-vous d'avoir accorde l'autorisation.", "Make sure camera permission is granted.")
            }
            
            alert(errorMessage)
        }
    }

    const stopCamera = () => {
        console.log("Stopping camera...")
        if (stream) {
            stream.getTracks().forEach(track => {
                track.stop()
                console.log("Track stopped:", track.kind)
            })
            setStream(null)
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
        setShowCamera(false)
    }

    const capturePhoto = () => {
        console.log("Capturing photo...")
        const canvas = canvasRef.current
        const video = videoRef.current
        
        if (!canvas || !video) {
            console.error("Canvas or video not available")
            alert(l("الكاميرا غير جاهزة بعد", "La camera n'est pas encore prete", "Camera is not ready yet"))
            return
        }

        console.log("Video ready state:", video.readyState)
        console.log("Video dimensions:", video.videoWidth, "x", video.videoHeight)

        if (video.readyState < video.HAVE_CURRENT_DATA) {
            alert(l("انتظر قليلاً حتى تصبح الكاميرا جاهزة...", "Attendez un peu que la camera soit prete...", "Please wait a bit for the camera to be ready..."))
            return
        }

        // Set canvas size to match video (reduced for localStorage)
        const maxWidth = 800 // Reduced size to save space
        const width = video.videoWidth || 640
        const height = video.videoHeight || 480
        const scale = Math.min(maxWidth / width, 1)
        const scaledWidth = width * scale
        const scaledHeight = height * scale
        
        canvas.width = scaledWidth
        canvas.height = scaledHeight
        
        console.log("Canvas size set to:", scaledWidth, "x", scaledHeight)
        
        const ctx = canvas.getContext('2d')
        
        try {
            // Draw video frame
            ctx.drawImage(video, 0, 0, scaledWidth, scaledHeight)
            
            // Add romantic overlay
            ctx.fillStyle = 'rgba(255, 192, 203, 0.1)'
            ctx.fillRect(0, 0, scaledWidth, scaledHeight)
            
            // Add text overlay (scaled)
            const textSize = Math.floor(20 * scale)
            ctx.font = `bold ${textSize}px Arial`
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
            ctx.textAlign = 'center'
            ctx.fillText(l('لحظة خاصة', 'Moment special', 'Special moment'), scaledWidth / 2, scaledHeight - (30 * scale))
            
            // Convert to JPEG with quality 0.7 to reduce size
            const photoData = canvas.toDataURL('image/jpeg', 0.7)
            console.log("Photo captured successfully, size:", Math.round(photoData.length / 1024), "KB")
            
            const newPhoto = { 
                id: Date.now(), 
                data: photoData,
                scenario: selectedScenario?.title || l('موعد رومانسي', 'Rendez-vous romantique', 'Romantic date'),
                timestamp: new Date().toLocaleString(language === "fr" ? 'fr-FR' : language === "en" ? 'en-US' : 'ar-TN', { 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
            }
            
            // Update state without blocking
            setTimeout(() => {
                setCapturedPhotos(prev => {
                    const updated = [...prev, newPhoto]
                    // Keep only last 10 photos to avoid localStorage issues
                    return updated.slice(-10)
                })
            }, 0)
            
            // Flash effect
            const flash = document.createElement('div')
            flash.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background-color: white;
                z-index: 9999;
                opacity: 1;
                transition: opacity 0.3s;
                pointer-events: none;
            `
            document.body.appendChild(flash)
            
            setTimeout(() => {
                flash.style.opacity = '0'
                setTimeout(() => {
                    if (document.body.contains(flash)) {
                        document.body.removeChild(flash)
                    }
                }, 300)
            }, 100)
            
        } catch (err) {
            console.error("Error capturing photo:", err)
            alert(l("حدث خطأ أثناء التقاط الصورة: ", "Erreur lors de la capture: ", "Error while capturing photo: ") + err.message)
        }
    }

    const downloadPhoto = (photo) => {
        const link = document.createElement('a')
        link.download = `love-moment-${photo.id}.png`
        link.href = photo.data
        link.click()
    }

    const deletePhoto = (photoId) => {
        setCapturedPhotos(prev => prev.filter(p => p.id !== photoId))
    }

    const clearAllPhotos = () => {
        if (confirm(l("هل أنت متأكد من حذف جميع الصور؟", "Voulez-vous vraiment supprimer toutes les photos ?", "Are you sure you want to delete all photos?"))) {
            setCapturedPhotos([])
            localStorage.removeItem('firstDatePhotos')
        }
    }

    return (
        <div
            className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-white'} ${isMobile ? "px-4 py-6" : "px-8 py-12"
                }`}
        >
            {/* Loader */}
            {isLoading && (
                <div className={`fixed inset-0 z-50 flex items-center justify-center ${isDarkMode ? 'bg-black' : 'bg-white'}`}>
                    <div className="text-center">
                        <div className="relative mb-8 flex justify-center">
                            <Heart className="w-20 h-20 md:w-24 md:h-24 text-amber-500 animate-pulse" strokeWidth={1.5} />
                        </div>

                        {/* Title */}
                        <h1 className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'} ${isMobile ? "text-3xl" : "text-5xl"} mb-4 drop-shadow-lg animate-fade-in`}>
                            {t("title")}
                        </h1>
                        
                        {/* Subtitle */}
                        <p className={`${isDarkMode ? 'text-white/80' : 'text-black/70'} text-lg md:text-xl mb-8 animate-fade-in-delay`}>
                            {t("preparing")}
                        </p>

                        {/* Loading bar */}
                        <div className="w-64 md:w-96 mx-auto bg-white/20 rounded-full h-2 overflow-hidden backdrop-blur-sm">
                            <div className="h-full bg-white rounded-full animate-loading-bar shadow-lg"></div>
                        </div>

                        {/* Loading dots */}
                        <div className="flex justify-center items-center gap-2 mt-6">
                            <div className="w-3 h-3 bg-white rounded-full animate-bounce"></div>
                            <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-100"></div>
                            <div className="w-3 h-3 bg-white rounded-full animate-bounce delay-200"></div>
                        </div>

                        {/* Romantic messages */}
                        <div className={`mt-8 text-sm md:text-base animate-fade-in-slow ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>
                            <p className="animate-pulse">{t("ready")}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className={`flex items-center mb-6 ${isMobile ? 'gap-2' : 'justify-between mb-8'}`}>
                <button
                    onClick={() => {
                        stopCamera()
                        setCurrentGame("menu")
                    }}
                    className="text-white hover:bg-white/20 rounded-xl transition-all duration-300 hover:scale-110 flex-shrink-0 min-w-[48px] min-h-[48px] flex items-center justify-center"
                    aria-label="Back to menu"
                >
                    <ArrowLeft className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                </button>
                <div className="text-center flex-1">
                    <h1
                        className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'} drop-shadow-lg ${isMobile ? "text-xl leading-tight" : "text-4xl mb-2"}`}
                    >
                        {t("title")}
                    </h1>
                    {!isMobile && (
                        <p className="text-pink-100 drop-shadow text-sm md:text-base">{l("اكتشفا بعضكما البعض في أجواء رومانسية", "Decouvrez-vous dans une ambiance romantique", "Discover each other in a romantic atmosphere")}</p>
                    )}
                </div>
                <div className={`${isMobile ? 'w-8' : 'w-12'}`}></div>
            </div>

            {/* Game States */}
            {gameState === "menu" && (
                <div className="max-w-6xl mx-auto">
                    {/* Level select */}
                    <div className={`${isMobile ? 'mb-5' : 'mb-8'}`}>
                        <h2 className={`font-bold text-white text-center drop-shadow-lg ${isMobile ? 'text-lg mb-3' : 'text-2xl md:text-3xl mb-6'}`}>
                            {t("level")}
                        </h2>
                        <div className={`grid ${isMobile ? 'grid-cols-2 gap-2.5' : 'grid-cols-2 md:grid-cols-4 gap-4'}`}>
                            {intimacyLevels.map((level, i) => (
                                <Card
                                    key={i}
                                    className={`cursor-pointer transition-all duration-300 hover:scale-105 border-0 ${selectedLevel === i ? "ring-4 ring-white shadow-2xl scale-105" : "shadow-xl"
                                        }`}
                                    onClick={() => setSelectedLevel(i)}
                                >
                                    <CardContent
                                        className={`text-center bg-gradient-to-br ${level.color} text-white rounded-xl flex flex-col items-center justify-center ${isMobile ? 'p-3 py-4 min-h-[100px]' : 'p-6 min-h-[120px]'}`}
                                    >
                                        <div className={`${isMobile ? 'text-3xl mb-1.5' : 'text-5xl mb-3'} ${selectedLevel === i ? 'animate-bounce' : ''}`}>{level.icon}</div>
                                        <p className={`font-bold leading-tight ${isMobile ? 'text-xs mb-0.5' : 'text-sm mb-1'}`}>{level.name}</p>
                                        {selectedLevel === i && (
                                            <div className={`${isMobile ? 'mt-1' : 'mt-2'}`}>
                                                <span className={`bg-white/30 rounded-full inline-block ${isMobile ? 'text-[9px] px-2 py-0.5' : 'text-xs px-2 py-1'}`}>{l("✓ محدد", "✓ Selectionne", "✓ Selected")}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Scenario select */}
                    <h2 className={`font-bold text-white text-center drop-shadow-lg ${isMobile ? 'text-xl mb-4' : 'text-2xl md:text-3xl mb-6'}`}>
                        {t("scenario")}
                    </h2>
                    <div className={`grid grid-cols-2 lg:grid-cols-3 ${isMobile ? 'gap-3' : 'gap-6'}`}>
                        {dateScenarios.map((s) => (
                            <Card
                                key={s.id}
                                onClick={() => selectScenario(s)}
                                className="group hover:scale-105 hover:shadow-2xl transition-all duration-300 cursor-pointer shadow-xl border-0 bg-white/95 backdrop-blur-sm overflow-hidden"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                <CardContent className={`text-center relative flex flex-col ${isMobile ? 'p-3 py-4 min-h-[160px]' : 'p-6 min-h-[240px]'}`}>
                                    <div className={`group-hover:scale-110 transition-transform duration-300 ${isMobile ? 'text-3xl mb-2' : 'text-6xl mb-4'}`}>
                                        {s.title.split(" ")[0]}
                                    </div>
                                    <h3 className={`font-bold text-gray-800 group-hover:text-pink-600 transition-colors ${isMobile ? 'text-sm mb-1.5 leading-tight' : 'text-xl mb-3'}`}>
                                        {s.title.substring(2)}
                                    </h3>
                                    <p className={`text-gray-600 leading-tight flex-grow ${isMobile ? 'text-[10px] mb-2' : 'text-sm mb-4'}`}>{s.description}</p>
                                    <div className={`flex justify-center items-center gap-3 text-gray-500 bg-gray-50 rounded-lg ${isMobile ? 'text-[10px] p-1.5 mt-auto' : 'text-sm p-3'}`}>
                                        <div className="flex items-center gap-1">
                                            <Heart className={`text-pink-500 ${isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'}`} />
                                            <span className="font-semibold">{s.questions.length}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Sparkles className={`text-purple-500 ${isMobile ? 'w-2.5 h-2.5' : 'w-4 h-4'}`} />
                                            <span className="font-semibold">{s.dares.length}</span>
                                        </div>
                                    </div>
                                    {!isMobile && (
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 mt-3">
                                            <span className="text-pink-600 font-bold text-sm">{l("اضغط للبدء ←", "Cliquez pour commencer ←", "Click to start ←")}</span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {/* Scenario details */}
            {gameState === "scenario" && selectedScenario && (
                <div className="max-w-3xl mx-auto">
                    <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl overflow-hidden">
                        <div className={`bg-gradient-to-r from-pink-500 to-rose-500 text-white ${isMobile ? 'p-4' : 'p-6'}`}>
                            <div className={`text-center animate-bounce ${isMobile ? 'text-5xl mb-3' : 'text-7xl mb-4'}`}>
                                {selectedScenario.title.split(" ")[0]}
                            </div>
                            <h2 className={`font-bold text-center ${isMobile ? 'text-2xl mb-1' : 'text-3xl md:text-4xl mb-2'}`}>
                                {selectedScenario.title.substring(2)}
                            </h2>
                            <p className={`text-pink-100 text-center ${isMobile ? 'text-sm' : 'text-lg'}`}>
                                {selectedScenario.description}
                            </p>
                        </div>
                        <CardContent className={`${isMobile ? 'p-4' : 'p-8'}`}>
                            {/* Level badge */}
                            <div className={`flex justify-center ${isMobile ? 'mb-4' : 'mb-6'}`}>
                                <div className={`rounded-full bg-gradient-to-r ${intimacyLevels[selectedLevel].color} text-white font-bold shadow-lg ${isMobile ? 'px-4 py-2' : 'px-6 py-3'}`}>
                                    <span className={`mr-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>{intimacyLevels[selectedLevel].icon}</span>
                                    <span className={`${isMobile ? 'text-sm' : 'text-base'}`}>{intimacyLevels[selectedLevel].name}</span>
                                </div>
                            </div>

                            {/* Info cards */}
                            <div className={`grid grid-cols-2 ${isMobile ? 'gap-3 mb-6' : 'gap-4 mb-8'}`}>
                                <div className={`bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl text-center border-2 border-blue-200 flex flex-col items-center justify-center ${isMobile ? 'p-3 min-h-[130px]' : 'p-6 min-h-[160px]'}`}>
                                    <Heart className={`mx-auto text-blue-600 ${isMobile ? 'w-7 h-7 mb-2' : 'w-10 h-10 mb-3'}`} />
                                    <p className={`font-bold text-blue-600 ${isMobile ? 'text-2xl mb-1' : 'text-3xl mb-1'}`}>{selectedScenario.questions.length}</p>
                                    <p className={`text-gray-600 font-semibold leading-tight ${isMobile ? 'text-xs mb-1' : 'text-sm mb-1'}`}>{l("أسئلة عميقة", "Questions profondes", "Deep questions")}</p>
                                    <p className={`text-gray-500 leading-tight ${isMobile ? 'text-[11px]' : 'text-xs'}`}>{l("لاكتشاف بعضكما", "Pour mieux vous decouvrir", "To discover each other")}</p>
                                </div>
                                <div className={`bg-gradient-to-br from-pink-50 to-red-50 rounded-xl text-center border-2 border-pink-200 flex flex-col items-center justify-center ${isMobile ? 'p-3 min-h-[130px]' : 'p-6 min-h-[160px]'}`}>
                                    <Sparkles className={`mx-auto text-pink-600 ${isMobile ? 'w-7 h-7 mb-2' : 'w-10 h-10 mb-3'}`} />
                                    <p className={`font-bold text-pink-600 ${isMobile ? 'text-2xl mb-1' : 'text-3xl mb-1'}`}>{selectedScenario.dares.length}</p>
                                    <p className={`text-gray-600 font-semibold leading-tight ${isMobile ? 'text-xs mb-1' : 'text-sm mb-1'}`}>{l("تحديات رومانسية", "Defis romantiques", "Romantic challenges")}</p>
                                    <p className={`text-gray-500 leading-tight ${isMobile ? 'text-[11px]' : 'text-xs'}`}>{l("لحظات لا تنسى", "Moments inoubliables", "Unforgettable moments")}</p>
                                </div>
                            </div>

                            {/* Instructions */}
                            <div className={`bg-yellow-50 border-l-4 border-yellow-400 rounded-r-xl ${isMobile ? 'p-3 mb-6' : 'p-4 mb-8'}`}>
                                <p className={`font-semibold text-yellow-800 ${isMobile ? 'text-sm mb-1' : 'mb-2'}`}>{l("كيف تلعبون؟", "Comment jouer ?", "How to play?")}</p>
                                <ul className={`text-yellow-700 space-y-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                    <li>{l("• اختاروا بين الأسئلة العميقة أو التحديات الرومانسية", "• Choisissez entre questions profondes et defis romantiques", "• Choose between deep questions and romantic challenges")}</li>
                                    <li>{l("• أجيبوا بصدق وانفتاح لتقوية الرابطة بينكما", "• Repondez avec sincerite et ouverture", "• Answer with honesty and openness")}</li>
                                    <li>{l("• استمتعوا باللحظات واصنعوا ذكريات جميلة", "• Profitez des moments et creez de beaux souvenirs", "• Enjoy the moments and create beautiful memories")}</li>
                                </ul>
                            </div>

                            {/* Buttons */}
                            <div className={`flex ${isMobile ? 'flex-col gap-3' : 'gap-4'}`}>
                                <button
                                    onClick={startGame}
                                    className={`bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 ${isMobile ? 'flex-none px-6 py-3 text-base' : 'flex-1 px-8 py-4 text-lg'}`}
                                >
                                    {t("startDate")}
                                </button>
                                <button
                                    onClick={() => setGameState("menu")}
                                    className={`bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-all duration-300 ${isMobile ? 'flex-none px-6 py-3 text-base' : 'px-8 py-4'}`}
                                >
                                    ← {t("back")}
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Playing */}
            {gameState === "playing" && (
                <div className="max-w-4xl mx-auto">
                    <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl mb-6">
                        <CardContent className={`${isMobile ? 'p-4' : 'p-8'}`}>
                            <div className={`text-center ${isMobile ? 'mb-6' : 'mb-8'}`}>
                                <div className={`${isMobile ? 'text-4xl mb-3' : 'text-6xl mb-4'}`}>{selectedScenario?.title.split(" ")[0]}</div>
                                <h2 className={`font-bold text-gray-800 ${isMobile ? 'text-xl mb-1' : 'text-3xl mb-2'}`}>
                                    {selectedScenario?.title.substring(2)}
                                </h2>
                                <p className={`text-gray-600 ${isMobile ? 'text-sm' : 'text-base'}`}>{selectedScenario?.description}</p>
                            </div>

                            {/* Level indicator */}
                            <div className={`flex justify-center ${isMobile ? 'mb-6' : 'mb-8'}`}>
                                <div className={`rounded-full bg-gradient-to-r ${intimacyLevels[selectedLevel].color} text-white font-bold shadow-lg ${isMobile ? 'px-4 py-2' : 'px-6 py-3'}`}>
                                    <span className={`mr-2 ${isMobile ? 'text-xl' : 'text-2xl'}`}>{intimacyLevels[selectedLevel].icon}</span>
                                    <span className={`${isMobile ? 'text-sm' : 'text-base'}`}>{intimacyLevels[selectedLevel].name}</span>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className={`mb-6`}>
                                {/* First row - Two buttons */}
                                <div className={`grid grid-cols-2 ${isMobile ? 'gap-2.5 mb-2.5' : 'gap-4 mb-4'}`}>
                                    <button
                                        onClick={getRandomQuestion}
                                        className={`group relative overflow-hidden bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 flex flex-col items-center justify-between ${isMobile ? 'rounded-xl py-3.5 px-2 min-h-[145px]' : 'rounded-2xl p-6 min-h-[180px]'}`}
                                    >
                                        <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                        <div className="relative flex flex-col items-center justify-center w-full flex-1">
                                            <MessageCircle className={`mb-2 flex-shrink-0 ${isMobile ? 'w-7 h-7' : 'w-10 h-10'}`} />
                                            <h3 className={`font-bold leading-tight text-center w-full ${isMobile ? 'text-[11px] mb-1' : 'text-xl mb-1'}`}>{t("deepQuestion")}</h3>
                                            <p className={`text-white/90 text-center leading-tight w-full ${isMobile ? 'text-[9px] mb-2' : 'text-sm mb-3'}`}>{language === "ar" ? "اكتشفوا بعضكما أكثر" : language === "fr" ? "Decouvrez-vous davantage" : "Discover each other more"}</p>
                                            <div className={`flex items-center justify-center gap-1 mt-auto ${isMobile ? 'text-[8px]' : 'text-xs'}`}>
                                                <Clock className={`flex-shrink-0 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                                                <span className="whitespace-nowrap">{isMobile ? l('2 دقيقة', '2 min', '2 min') : l('دقيقتين للإجابة', '2 min pour repondre', '2 minutes to answer')}</span>
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={getRandomDare}
                                        className={`group relative overflow-hidden bg-gradient-to-br from-pink-500 to-red-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 flex flex-col items-center justify-between ${isMobile ? 'rounded-xl py-3.5 px-2 min-h-[145px]' : 'rounded-2xl p-6 min-h-[180px]'}`}
                                    >
                                        <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                        <div className="relative flex flex-col items-center justify-center w-full flex-1">
                                            <Sparkles className={`mb-2 flex-shrink-0 ${isMobile ? 'w-7 h-7' : 'w-10 h-10'}`} />
                                            <h3 className={`font-bold leading-tight text-center w-full ${isMobile ? 'text-[11px] mb-1' : 'text-xl mb-1'}`}>{t("romanticChallenge")}</h3>
                                            <p className={`text-white/90 text-center leading-tight w-full ${isMobile ? 'text-[9px] mb-2' : 'text-sm mb-3'}`}>{l("لحظات لا تنسى", "Moments inoubliables", "Unforgettable moments")}</p>
                                            <div className={`flex items-center justify-center gap-1 mt-auto ${isMobile ? 'text-[8px]' : 'text-xs'}`}>
                                                <Zap className={`flex-shrink-0 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                                                <span className="whitespace-nowrap">{isMobile ? l('5 دقائق', '5 min', '5 min') : l('5 دقائق للتحدي', '5 min pour le defi', '5 minutes for challenge')}</span>
                                            </div>
                                        </div>
                                    </button>
                                </div>

                                {/* Second row - Centered button */}
                                <div className="flex justify-center">
                                    <button
                                        onClick={startCamera}
                                        className={`group relative overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105 flex flex-col items-center justify-between ${isMobile ? 'rounded-xl py-3.5 px-2 min-h-[145px] w-[calc(50%-5px)]' : 'rounded-2xl p-6 min-h-[180px] w-[calc(33.333%-11px)]'}`}
                                    >
                                        <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                                        <div className="relative flex flex-col items-center justify-center w-full flex-1">
                                            <Camera className={`mb-2 flex-shrink-0 ${isMobile ? 'w-7 h-7' : 'w-10 h-10'}`} />
                                            <h3 className={`font-bold leading-tight text-center w-full ${isMobile ? 'text-[11px] mb-1' : 'text-xl mb-1'}`}>{t("takePhoto")}</h3>
                                            <p className={`text-white/90 text-center leading-tight w-full ${isMobile ? 'text-[9px] mb-2' : 'text-sm mb-3'}`}>{l("احفظوا هذه اللحظة", "Gardez ce moment", "Save this moment")}</p>
                                            <div className={`flex items-center justify-center gap-1 mt-auto ${isMobile ? 'text-[8px]' : 'text-xs'}`}>
                                                <Heart className={`animate-pulse flex-shrink-0 ${isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                                                <span className="whitespace-nowrap">{capturedPhotos.length} {isMobile ? '' : l('صور', 'photos', 'photos')}</span>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Progress */}
                            <div className={`bg-gray-100 rounded-xl mb-6 ${isMobile ? 'p-3' : 'p-4'}`}>
                                <div className={`flex justify-between items-center ${isMobile ? 'mb-1.5' : 'mb-2'}`}>
                                    <span className={`font-semibold text-gray-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>{l('التقدم في الموعد', 'Progression du rendez-vous', 'Date progress')}</span>
                                    <span className={`text-gray-500 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                        {usedQuestions.length + usedDares.length} / {selectedScenario?.questions.length + selectedScenario?.dares.length}
                                    </span>
                                </div>
                                <div className={`bg-gray-300 rounded-full overflow-hidden ${isMobile ? 'h-2' : 'h-3'}`}>
                                    <div
                                        className="bg-gradient-to-r from-pink-500 to-purple-600 h-full transition-all duration-500"
                                        style={{
                                            width: `${((usedQuestions.length + usedDares.length) / (selectedScenario?.questions.length + selectedScenario?.dares.length)) * 100}%`
                                        }}
                                    ></div>
                                </div>
                            </div>

                            {/* Stats */}
                            <div className={`grid grid-cols-2 mb-6 ${isMobile ? 'gap-3' : 'gap-4'}`}>
                                <div className={`bg-blue-50 rounded-xl text-center ${isMobile ? 'p-3' : 'p-4'}`}>
                                    <MessageCircle className={`mx-auto text-blue-600 ${isMobile ? 'w-5 h-5 mb-1.5' : 'w-6 h-6 mb-2'}`} />
                                    <p className={`font-bold text-blue-600 ${isMobile ? 'text-xl' : 'text-2xl'}`}>{usedQuestions.length}</p>
                                    <p className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>{l('أسئلة مجابة', 'Questions repondues', 'Answered questions')}</p>
                                </div>
                                <div className={`bg-pink-50 rounded-xl text-center ${isMobile ? 'p-3' : 'p-4'}`}>
                                    <Sparkles className={`mx-auto text-pink-600 ${isMobile ? 'w-5 h-5 mb-1.5' : 'w-6 h-6 mb-2'}`} />
                                    <p className={`font-bold text-pink-600 ${isMobile ? 'text-xl' : 'text-2xl'}`}>{usedDares.length}</p>
                                    <p className={`text-gray-600 ${isMobile ? 'text-xs' : 'text-sm'}`}>{l('تحديات منجزة', 'Defis accomplis', 'Completed challenges')}</p>
                                </div>
                            </div>

                            {/* Back button */}
                            <button
                                onClick={resetGame}
                                className={`w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-all duration-300 ${isMobile ? 'py-2.5 text-sm' : 'py-3 text-base'}`}
                            >
                                {t("finishDate")}
                            </button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Question */}
            {gameState === "question" && (
                <div className="max-w-3xl mx-auto">
                    <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
                        <CardContent className={`${isMobile ? 'p-4' : 'p-8'}`}>
                            {/* Header */}
                            <div className={`text-center ${isMobile ? 'mb-6' : 'mb-8'}`}>
                                <div className={`inline-block bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full ${isMobile ? 'px-4 py-2 mb-3' : 'px-6 py-3 mb-4'}`}>
                                    <MessageCircle className={`inline mr-2 ${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                                    <span className={`font-bold ${isMobile ? 'text-base' : 'text-lg'}`}>{t("deepQuestion")}</span>
                                </div>
                                
                                {/* Audio controls */}
                                <div className={`flex justify-center ${isMobile ? 'gap-1.5 mt-3' : 'gap-2 mt-4'}`}>
                                    <button
                                        onClick={toggleAutoRead}
                                        className={`flex items-center rounded-lg transition-all ${isMobile ? 'gap-1.5 px-3 py-1.5' : 'gap-2 px-4 py-2'} ${
                                            autoRead 
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                        title={autoRead ? l("تعطيل القراءة التلقائية", "Desactiver la lecture auto", "Disable auto read") : l("تفعيل القراءة التلقائية", "Activer la lecture auto", "Enable auto read")}
                                    >
                                        {autoRead ? <Volume2 className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} /> : <VolumeX className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />}
                                        <span className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                            {autoRead ? l("قراءة تلقائية", "Lecture auto", "Auto read") : l("قراءة معطلة", "Lecture desactivee", "Read disabled")}
                                        </span>
                                    </button>
                                    
                                    {isSpeaking && (
                                        <button
                                            onClick={stopSpeaking}
                                            className={`flex items-center bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-all ${isMobile ? 'gap-1.5 px-3 py-1.5' : 'gap-2 px-4 py-2'}`}
                                        >
                                            <X className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                                            <span className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>{l("إيقاف", "Arreter", "Stop")}</span>
                                        </button>
                                    )}
                                    
                                    {!isSpeaking && autoRead && (
                                        <button
                                            onClick={() => speakText(currentQuestion)}
                                            className={`flex items-center bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg transition-all ${isMobile ? 'gap-1.5 px-3 py-1.5' : 'gap-2 px-4 py-2'}`}
                                        >
                                            <Volume2 className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                                            <span className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>{l("إعادة القراءة", "Relire", "Read again")}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Timer */}
                            <div className={`${isMobile ? 'mb-6' : 'mb-8'}`}>
                                <div className={`flex justify-center items-center mb-4 ${isMobile ? 'gap-2' : 'gap-3'}`}>
                                    <Clock className={`${timer <= 30 ? 'text-red-500 animate-pulse' : 'text-blue-600'} ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
                                    <div className={`font-bold ${timer <= 30 ? 'text-red-500 animate-pulse' : 'text-blue-600'} ${isMobile ? 'text-4xl' : 'text-6xl'}`}>
                                        {formatTime(timer)}
                                    </div>
                                </div>
                                <div className={`bg-gray-200 rounded-full overflow-hidden ${isMobile ? 'h-3' : 'h-4'}`}>
                                    <div
                                        className={`h-full transition-all duration-1000 ${timer <= 30 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-blue-500 to-purple-600'}`}
                                        style={{ width: `${(timer / 120) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Question */}
                            <div className={`bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border-2 border-blue-200 ${isMobile ? 'p-5 mb-6' : 'p-8 mb-8'}`}>
                                <div className="flex justify-center mb-4">
                                    <MessageCircle className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} text-blue-500`} />
                                </div>
                                <p className={`text-gray-800 font-bold text-center leading-relaxed ${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
                                    {currentQuestion}
                                </p>
                            </div>

                            {/* Tips */}
                            <div className={`bg-yellow-50 border-l-4 border-yellow-400 rounded-r-xl mb-6 ${isMobile ? 'p-3' : 'p-4'}`}>
                                <div className={`flex items-start ${isMobile ? 'gap-2' : 'gap-3'}`}>
                                    <Star className={`text-yellow-600 flex-shrink-0 mt-1 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    <div>
                                        <p className={`font-semibold text-yellow-800 ${isMobile ? 'text-sm mb-0.5' : 'mb-1'}`}>{l("نصيحة", "Conseil", "Tip")}</p>
                                        <p className={`text-yellow-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>{l("كونوا صادقين ومنفتحين في إجاباتكم. الصدق يقرب القلوب!", "Soyez sinceres et ouverts. La sincerite rapproche les coeurs !", "Be honest and open. Honesty brings hearts closer!")}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className={`flex ${isMobile ? 'flex-col gap-3' : 'gap-4'}`}>
                                <button
                                    onClick={backToPlaying}
                                    className={`bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all duration-300 hover:scale-105 shadow-lg ${isMobile ? 'flex-none py-3 text-base' : 'flex-1 py-4 text-lg'}`}
                                >
                                    {l("✓ تم الإجابة", "✓ Repondu", "✓ Answered")}
                                </button>
                                <button
                                    onClick={getRandomQuestion}
                                    className={`bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-all duration-300 ${isMobile ? 'flex-none py-3 text-base' : 'px-6 py-4 text-lg'}`}
                                >
                                    {l("⤴ سؤال آخر", "⤴ Autre question", "⤴ Another question")}
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Dare */}
            {gameState === "dare" && (
                <div className="max-w-3xl mx-auto">
                    <Card className="bg-white/95 backdrop-blur-sm border-0 shadow-2xl">
                        <CardContent className={`${isMobile ? 'p-4' : 'p-8'}`}>
                            {/* Header */}
                            <div className={`text-center ${isMobile ? 'mb-6' : 'mb-8'}`}>
                                <div className={`inline-block bg-gradient-to-r from-pink-500 to-red-600 text-white rounded-full animate-pulse ${isMobile ? 'px-4 py-2 mb-3' : 'px-6 py-3 mb-4'}`}>
                                    <Sparkles className={`inline mr-2 ${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                                    <span className={`font-bold ${isMobile ? 'text-base' : 'text-lg'}`}>{t("romanticChallenge")}</span>
                                </div>
                                
                                {/* Audio controls */}
                                <div className={`flex justify-center ${isMobile ? 'gap-1.5 mt-3' : 'gap-2 mt-4'}`}>
                                    <button
                                        onClick={toggleAutoRead}
                                        className={`flex items-center rounded-lg transition-all ${isMobile ? 'gap-1.5 px-3 py-1.5' : 'gap-2 px-4 py-2'} ${
                                            autoRead 
                                                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                        title={autoRead ? l("تعطيل القراءة التلقائية", "Desactiver la lecture auto", "Disable auto read") : l("تفعيل القراءة التلقائية", "Activer la lecture auto", "Enable auto read")}
                                    >
                                        {autoRead ? <Volume2 className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} /> : <VolumeX className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />}
                                        <span className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                            {autoRead ? l("قراءة تلقائية", "Lecture auto", "Auto read") : l("قراءة معطلة", "Lecture desactivee", "Read disabled")}
                                        </span>
                                    </button>
                                    
                                    {isSpeaking && (
                                        <button
                                            onClick={stopSpeaking}
                                            className={`flex items-center bg-red-100 text-red-700 hover:bg-red-200 rounded-lg transition-all ${isMobile ? 'gap-1.5 px-3 py-1.5' : 'gap-2 px-4 py-2'}`}
                                        >
                                            <X className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                                            <span className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>{l("إيقاف", "Arreter", "Stop")}</span>
                                        </button>
                                    )}
                                    
                                    {!isSpeaking && autoRead && (
                                        <button
                                            onClick={() => speakText(currentDare)}
                                            className={`flex items-center bg-pink-100 text-pink-700 hover:bg-pink-200 rounded-lg transition-all ${isMobile ? 'gap-1.5 px-3 py-1.5' : 'gap-2 px-4 py-2'}`}
                                        >
                                            <Volume2 className={`${isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
                                            <span className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>{l("إعادة القراءة", "Relire", "Read again")}</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Timer */}
                            <div className={`${isMobile ? 'mb-6' : 'mb-8'}`}>
                                <div className={`flex justify-center items-center mb-4 ${isMobile ? 'gap-2' : 'gap-3'}`}>
                                    <Clock className={`${timer <= 60 ? 'text-red-500 animate-pulse' : 'text-pink-600'} ${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
                                    <div className={`font-bold ${timer <= 60 ? 'text-red-500 animate-pulse' : 'text-pink-600'} ${isMobile ? 'text-4xl' : 'text-6xl'}`}>
                                        {formatTime(timer)}
                                    </div>
                                </div>
                                <div className={`bg-gray-200 rounded-full overflow-hidden ${isMobile ? 'h-3' : 'h-4'}`}>
                                    <div
                                        className={`h-full transition-all duration-1000 ${timer <= 60 ? 'bg-gradient-to-r from-red-500 to-orange-500' : 'bg-gradient-to-r from-pink-500 to-red-600'}`}
                                        style={{ width: `${(timer / 300) * 100}%` }}
                                    ></div>
                                </div>
                            </div>

                            {/* Dare */}
                            <div className={`bg-gradient-to-br from-pink-50 to-red-50 rounded-2xl border-2 border-pink-200 relative overflow-hidden ${isMobile ? 'p-5 mb-6' : 'p-8 mb-8'}`}>
                                <div className={`absolute top-0 right-0 opacity-10 ${isMobile ? 'text-6xl' : 'text-9xl'}`}>❤️</div>
                                <div className="relative">
                                    <div className={`text-center ${isMobile ? 'text-3xl mb-3' : 'text-4xl mb-4'}`}>💫</div>
                                    <p className={`text-gray-800 font-bold text-center leading-relaxed ${isMobile ? 'text-xl' : 'text-2xl md:text-3xl'}`}>
                                        {currentDare}
                                    </p>
                                </div>
                            </div>

                            {/* Encouragement */}
                            <div className={`bg-gradient-to-r from-pink-100 to-red-100 border-l-4 border-pink-500 rounded-r-xl mb-6 ${isMobile ? 'p-3' : 'p-4'}`}>
                                <div className={`flex items-start ${isMobile ? 'gap-2' : 'gap-3'}`}>
                                    <Heart className={`text-pink-600 flex-shrink-0 mt-1 animate-pulse ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                    <div>
                                        <p className={`font-semibold text-pink-800 ${isMobile ? 'text-sm mb-0.5' : 'mb-1'}`}>{l("تشجيع", "Encouragement", "Encouragement")}</p>
                                        <p className={`text-pink-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>{l("لا تخجلوا! هذه اللحظات ستكون من أجمل ذكرياتكم", "N'hesitez pas ! Ces moments seront parmi vos plus beaux souvenirs", "Don't be shy! These moments will become beautiful memories")}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Action buttons */}
                            <div className={`flex ${isMobile ? 'flex-col gap-3' : 'gap-4'}`}>
                                <button
                                    onClick={backToPlaying}
                                    className={`bg-gradient-to-r from-pink-500 to-red-600 hover:from-pink-600 hover:to-red-700 text-white font-bold rounded-xl transition-all duration-300 hover:scale-105 shadow-lg ${isMobile ? 'flex-none py-3 text-base' : 'flex-1 py-4 text-lg'}`}
                                >
                                    {l("✓ تم التحدي", "✓ Defi termine", "✓ Challenge done")}
                                </button>
                                <button
                                    onClick={getRandomDare}
                                    className={`bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl transition-all duration-300 ${isMobile ? 'flex-none py-3 text-base' : 'px-6 py-4 text-lg'}`}
                                >
                                    {l("⤴ تحدي آخر", "⤴ Autre defi", "⤴ Another challenge")}
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Camera Modal */}
            {showCamera && (
                <div className={`fixed inset-0 bg-black/90 z-50 flex items-center justify-center overflow-y-auto ${isMobile ? 'p-2' : 'p-4'}`}>
                    <div className={`w-full ${isMobile ? 'my-4' : 'max-w-4xl my-8'}`}>
                        <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
                            {/* Camera header */}
                            <div className={`bg-gradient-to-r from-purple-500 to-pink-600 text-white ${isMobile ? 'p-3' : 'p-4'}`}>
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={backToPlaying}
                                        className={`bg-white/20 hover:bg-white/30 rounded-full transition-all flex items-center ${isMobile ? 'p-1.5 gap-1' : 'p-2 gap-2'}`}
                                    >
                                        <ArrowLeft className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                        <span className={`font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}>{t("back")}</span>
                                    </button>
                                    <h2 className={`font-bold flex items-center ${isMobile ? 'text-base gap-1' : 'text-2xl gap-2'}`}>
                                        <Camera className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                                        <span className={`${isMobile ? 'hidden' : 'inline'}`}>{l("التقاط صورة رومانسية", "Prendre une photo romantique", "Take a romantic photo")}</span>
                                        <span className={`${isMobile ? 'inline' : 'hidden'}`}>{l("صورة رومانسية", "Photo romantique", "Romantic photo")}</span>
                                    </h2>
                                    <button
                                        onClick={stopCamera}
                                        className={`bg-white/20 hover:bg-white/30 rounded-full transition-all ${isMobile ? 'p-1.5' : 'p-2'}`}
                                    >
                                        <X className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                                    </button>
                                </div>
                            </div>

                            {/* Camera view */}
                            <div className="relative bg-black">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className={`w-full object-cover mx-auto ${isMobile ? 'max-h-[50vh]' : 'max-h-[60vh]'}`}
                                    onLoadedMetadata={() => {
                                        if (videoRef.current) {
                                            videoRef.current.play().catch(err => console.error("Play error:", err))
                                        }
                                    }}
                                />
                                <canvas ref={canvasRef} className="hidden" />
                                
                                {/* Frame overlay */}
                                <div className="absolute inset-0 pointer-events-none">
                                    <div className={`absolute inset-0 border-pink-500/30 rounded-lg ${isMobile ? 'border-2 m-2' : 'border-4 m-4'}`}></div>
                                </div>
                            </div>

                            {/* Camera controls */}
                            <div className={`bg-gradient-to-br from-pink-50 to-purple-50 ${isMobile ? 'p-4' : 'p-6'}`}>
                                <button
                                    onClick={capturePhoto}
                                    className={`w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold rounded-xl transition-all duration-300 hover:scale-105 shadow-lg flex items-center justify-center ${isMobile ? 'py-3 gap-2 text-base' : 'py-4 gap-3 text-lg'}`}
                                >
                                    <Camera className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                                    {l("التقاط الصورة", "Prendre la photo", "Capture photo")}
                                </button>
                            </div>
                        </div>

                        {/* Photos gallery */}
                        {capturedPhotos.length > 0 && (
                            <div className={`bg-white rounded-3xl shadow-2xl ${isMobile ? 'mt-4 p-4' : 'mt-6 p-6'}`}>
                                <div className={`flex items-center justify-between ${isMobile ? 'mb-3' : 'mb-4'}`}>
                                    <h3 className={`font-bold text-gray-800 flex items-center ${isMobile ? 'text-base gap-1.5' : 'text-xl gap-2'}`}>
                                        <Heart className={`text-pink-500 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                        {l("ذكرياتكما", "Vos souvenirs", "Your memories")} ({capturedPhotos.length})
                                    </h3>
                                    <div className={`flex items-center ${isMobile ? 'gap-1.5' : 'gap-2'}`}>
                                        <button
                                            onClick={clearAllPhotos}
                                            className={`text-red-500 hover:text-red-700 font-semibold ${isMobile ? 'text-xs' : 'text-sm'}`}
                                        >
                                            {l("حذف الكل", "Tout supprimer", "Delete all")}
                                        </button>
                                        <button
                                            onClick={backToPlaying}
                                            className={`bg-gray-200 hover:bg-gray-300 rounded-full transition-all ${isMobile ? 'p-1.5' : 'p-2'}`}
                                            title={l("إغلاق", "Fermer", "Close")}
                                        >
                                            <X className={`text-gray-700 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                        </button>
                                    </div>
                                </div>
                                <div className={`grid max-h-[50vh] overflow-y-auto pr-2 ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-2 md:grid-cols-3 gap-4'}`}>
                                    {capturedPhotos.map((photo) => (
                                        <div key={photo.id} className="relative group">
                                            <img
                                                src={photo.data}
                                                alt="Love moment"
                                                className={`w-full object-cover rounded-xl shadow-lg ${isMobile ? 'h-24' : 'h-32'}`}
                                            />
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-xl flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => downloadPhoto(photo)}
                                                    className={`bg-white/90 hover:bg-white rounded-full transition-all ${isMobile ? 'p-1.5' : 'p-2'}`}
                                                    title={l("تحميل", "Telecharger", "Download")}
                                                >
                                                    <Download className={`text-pink-600 ${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                                </button>
                                                <button
                                                    onClick={() => deletePhoto(photo.id)}
                                                    className={`bg-white/90 hover:bg-white rounded-full transition-all ${isMobile ? 'p-1.5' : 'p-2'}`}
                                                    title={l("حذف", "Supprimer", "Delete")}
                                                >
                                                    <span className={`text-red-600 font-bold ${isMobile ? 'text-sm' : 'text-base'}`}>✕</span>
                                                </button>
                                            </div>
                                            <div className={`text-gray-500 text-center ${isMobile ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'}`}>{photo.timestamp}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}