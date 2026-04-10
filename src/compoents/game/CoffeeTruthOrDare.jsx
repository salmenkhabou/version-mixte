import { useState } from "react"
import { Card, CardContent } from "../ui/card"
import { Badge } from "../ui/badge"
import { ArrowLeft, Coffee, Users, RotateCcw, Crown, Heart, Zap, AlertTriangle, Shuffle } from "lucide-react"

import { truthQuestions, dareActions, playerRoles } from "../../data/truthOrDareData"

export default function CoffeeTruthOrDare({ isMobile, setCurrentGame, coffeeBeans, setCoffeeBeans, isDarkMode }) {
    const [gameState, setGameState] = useState("setup") // "setup" | "spinning" | "playing" | "finished"
    const [players, setPlayers] = useState([])
    const [newPlayerName, setNewPlayerName] = useState("")
    const [selectedPlayer, setSelectedPlayer] = useState(null)
    const [currentQuestion, setCurrentQuestion] = useState(null)
    const [questionsAsked, setQuestionsAsked] = useState(0)
    const [maxQuestions, setMaxQuestions] = useState(20)
    const [difficulty, setDifficulty] = useState("medium") // "easy" | "medium" | "hard"
    const [usedQuestions, setUsedQuestions] = useState([])
    const [adultContentEnabled, setAdultContentEnabled] = useState(true) // Auto-enabled since all content is now adult
    const [showAgeVerification, setShowAgeVerification] = useState(true) // Show age verification first
    const [isSpinning, setIsSpinning] = useState(false)
    const [spinningPlayer, setSpinningPlayer] = useState(null)
    const [showPointsAnimation, setShowPointsAnimation] = useState(null) // { show, points, player }

    const addPlayer = () => {
        if (newPlayerName.trim() && players.length < 8) {
            const availableRoles = playerRoles.filter(
                (role) => !players.some((p) => p.role.id === role.id)
            )
            const randomRole =
                availableRoles.length > 0
                    ? availableRoles[Math.floor(Math.random() * availableRoles.length)]
                    : playerRoles[Math.floor(Math.random() * playerRoles.length)]

            const newPlayer = {
                id: Date.now().toString(),
                name: newPlayerName.trim(),
                score: 0,
                isSelected: false,
                role: randomRole,
            }

            setPlayers([...players, newPlayer])
            setNewPlayerName("")
        }
    }

    const removePlayer = (playerId) => {
        setPlayers(players.filter((p) => p.id !== playerId))
    }

    const startGame = () => {
        if (players.length < 2) {
            alert("You need at least 2 players to start!")
            return
        }

        setPlayers(players.map((p) => ({ ...p, isSelected: false })))
        setGameState("spinning")
        setQuestionsAsked(0)
        setUsedQuestions([])
        spinWheel()
    }

    const spinWheel = () => {
        setIsSpinning(true)
        setSelectedPlayer(null)
        setCurrentQuestion(null)

        let spinCount = 0
        const maxSpins = 20 + Math.floor(Math.random() * 20) // 20-40 spins

        const spinInterval = setInterval(() => {
            const randomPlayer = players[Math.floor(Math.random() * players.length)]
            setSpinningPlayer(randomPlayer)
            spinCount++

            if (spinCount >= maxSpins) {
                clearInterval(spinInterval)
                const finalPlayer = players[Math.floor(Math.random() * players.length)]
                setSelectedPlayer(finalPlayer)
                setSpinningPlayer(null)
                setIsSpinning(false)

                setPlayers(players.map((p) => ({ ...p, isSelected: p.id === finalPlayer.id })))

                setTimeout(() => {
                    setGameState("playing")
                }, 1000)
            }
        }, 100)
    }

    const getRandomQuestion = (type) => {
        const questions = type === "truth" ? truthQuestions : dareActions
        let availableQuestions = questions.filter(
            (q) => q.difficulty === difficulty && !usedQuestions.includes(q.id)
        )

        // Since all content is now adult/hot, we don't filter by adult content
        // All questions are available regardless of adultContentEnabled setting

        if (availableQuestions.length === 0) {
            // Reset used questions if we've used all questions at this difficulty
            setUsedQuestions([])
            availableQuestions = questions.filter((q) => q.difficulty === difficulty)
        }

        // Extra safety check in case no questions exist for this difficulty
        if (availableQuestions.length === 0) {
            // Fall back to all questions if no questions available at current difficulty
            availableQuestions = questions
        }

        const randomQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)]
        setUsedQuestions([...usedQuestions, randomQuestion.id])
        return randomQuestion
    }

    const chooseTruthOrDare = (choice) => {
        const question = getRandomQuestion(choice)
        setCurrentQuestion(question)
    }

    const completeChallenge = (completed) => {
        if (currentQuestion && completed && selectedPlayer) {
            setShowPointsAnimation({
                show: true,
                points: currentQuestion.points,
                player: selectedPlayer.name,
            })

            const updatedPlayers = players.map((player) =>
                player.id === selectedPlayer.id
                    ? { ...player, score: player.score + currentQuestion.points }
                    : player
            )
            setPlayers(updatedPlayers)
            setCoffeeBeans((prev) => prev + currentQuestion.points)

            setTimeout(() => {
                setShowPointsAnimation(null)
            }, 2000)
        }

        setQuestionsAsked((prev) => prev + 1)

        if (questionsAsked + 1 >= maxQuestions) {
            setGameState("finished")
        } else {
            setGameState("spinning")
            setTimeout(() => {
                spinWheel()
            }, 1000)
        }
    }

    const resetGame = () => {
        setGameState("setup")
        setPlayers([])
        setSelectedPlayer(null)
        setCurrentQuestion(null)
        setQuestionsAsked(0)
        setUsedQuestions([])
        setIsSpinning(false)
        setSpinningPlayer(null)
    }

    const getWinner = () => {
        return players.reduce(
            (winner, player) => (player.score > winner.score ? player : winner),
            players[0]
        )
    }

    const enableAdultContent = () => {
        setAdultContentEnabled(true)
        setShowAgeVerification(false)
    }

    if (showAgeVerification) {
        return (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <Card className="bg-white rounded-3xl shadow-2xl max-w-md w-full">
                    <CardContent className={`${isMobile ? 'p-6' : 'p-8'} text-center`}>
                        <AlertTriangle className={`${isMobile ? 'w-12 h-12 mb-4' : 'w-14 h-14 mb-6'} mx-auto text-red-500`} />
                        <h2 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-[#2f2d2c] mb-4`}>Adult Content Warning - 18+ ONLY</h2>
                        <p className={`text-[#9b9b9b] mb-4 ${isMobile ? 'text-sm' : 'text-base'}`}>
                            This game contains <strong>EXPLICIT ADULT CONTENT</strong> with mature sexual themes.
                        </p>
                        <p className="text-sm text-red-600 mb-6 font-semibold">
                            By continuing, you confirm that ALL players are 18+ years old and consent to very hot/spicy adult content.
                        </p>
                        <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-3`}>
                            <button 
                                onClick={enableAdultContent} 
                                className="flex-1 bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 px-4 font-medium transition-colors"
                            >
                                I'm 18+ - Let's Play
                            </button>
                            <button
                                onClick={() => setCurrentGame("menu")}
                                className="flex-1 rounded-xl border-2 border-[#ededed] hover:bg-gray-50 py-3 px-4 font-medium transition-colors"
                            >
                                Exit
                            </button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // ---------------- SETUP PHASE ----------------
    if (gameState === "setup") {
        return (
            <div
                className={`min-h-screen ${isMobile ? "mt-12 px-4 pt-6 pb-8" : "px-8 pt-12 pb-12"} relative transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
            >
                {/* Header */}
                <div className={`flex ${isMobile ? 'flex-col gap-4' : 'flex-row items-center justify-between'} mb-6`}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setCurrentGame("menu")}
                            className="rounded-xl border-2 border-[#ededed] bg-white/80 backdrop-blur-sm p-2 hover:bg-white transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                        >
                            <ArrowLeft className={`${isMobile ? 'w-5 h-5' : 'w-5 h-5'} text-[#9b9b9b]`} />
                        </button>
                        <div className="flex-1">
                            <h1 className={`font-bold text-[#2f2d2c] ${isMobile ? "text-xl leading-tight" : "text-4xl"} mb-1`}>
                                لعبة صراحة أو جرأة - نسخة ساخنة
                            </h1>
                            <p className={`text-red-600 font-semibold ${isMobile ? 'text-sm' : 'text-base'}`}>18+ للبالغين فقط - محتوى جريء</p>
                        </div>
                    </div>

                    {/* Coffee Beans Balance */}
                    <Card className={`bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-200 shadow-lg ${isMobile ? 'w-full' : ''}`}>
                        <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3 justify-center`}>
                            <Coffee className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-amber-600`} />
                            <div>
                                <p className="text-xs text-amber-700 font-medium">حبوب القهوة</p>
                                <p className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-amber-800`}>{coffeeBeans.toLocaleString()}</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Game Setup */}
                <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-4 mb-6`}>
                    {/* Add Players */}
                    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                            <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-[#2f2d2c] mb-4 flex items-center gap-2`}>
                                <Users className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                أضف لاعبين ({players.length}/8)
                            </h3>

                            <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-2 mb-4`}>
                                <input
                                    placeholder="Enter player name"
                                    value={newPlayerName}
                                    onChange={(e) => setNewPlayerName(e.target.value)}
                                    onKeyPress={(e) => e.key === "Enter" && addPlayer()}
                                    className={`${isMobile ? 'w-full' : 'flex-1'} px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-red-400 focus:outline-none ${isMobile ? 'text-sm' : 'text-base'}`}
                                />
                                <button
                                    onClick={addPlayer}
                                    disabled={!newPlayerName.trim() || players.length >= 8}
                                    className={`bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isMobile ? 'w-full px-4 py-2 text-sm' : 'px-6 py-2'}`}
                                >
                                    Add
                                </button>
                            </div>

                            <div className={`space-y-2 overflow-y-auto ${isMobile ? 'max-h-48' : 'max-h-64'}`}>
                                {players.map((player, index) => (
                                    <div key={player.id} className={`flex items-center justify-between bg-gray-50 rounded-lg ${isMobile ? 'p-2' : 'p-3'}`}>
                                        <div className="flex items-center gap-2 flex-1 min-w-0">
                                            <span className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-gray-600 min-w-[24px]`}>#{index + 1}</span>
                                            <span className={`${isMobile ? 'text-xl' : 'text-2xl'}`}>{player.role.emoji}</span>
                                            <div className="flex-1 min-w-0">
                                                <span className={`font-medium block truncate ${isMobile ? 'text-sm' : 'text-base'}`}>{player.name}</span>
                                                <p className={`text-[#9b9b9b] truncate ${isMobile ? 'text-xs' : 'text-xs'}`}>{player.role.name}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removePlayer(player.id)}
                                            className={`text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center ${isMobile ? 'text-xs' : 'text-sm'}`}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Game Settings */}
                    <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                            <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-[#2f2d2c] mb-4`}>إعدادات اللعبة</h3>

                            {/* Difficulty */}
                            <div className={`${isMobile ? 'mb-4' : 'mb-6'}`}>
                                <p className="text-sm font-medium text-[#9b9b9b] mb-2">مستوى الصعوبة</p>
                                <div className={`grid grid-cols-3 gap-2`}>
                                    {["easy", "medium", "hard"].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() => setDifficulty(level)}
                                            className={`${isMobile ? 'px-2 py-2 text-xs' : 'px-4 py-2 text-base'} rounded-xl font-medium transition-all ${difficulty === level
                                                ? "bg-red-500 hover:bg-red-600 text-white shadow-md"
                                                : "border-2 border-gray-200 text-[#9b9b9b] hover:border-red-300"
                                                }`}
                                        >
                                            {level.charAt(0).toUpperCase() + level.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Adult Content Warning */}
                            <div className={`${isMobile ? 'mb-4' : 'mb-6'}`}>
                                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle className="w-5 h-5 text-red-600" />
                                        <p className="text-sm font-bold text-red-600">محتوى للبالغين فقط</p>
                                    </div>
                                    <p className={`text-red-700 ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                        جميع الأسئلة والتحديات في هذه اللعبة مخصصة للبالغين +18 فقط
                                    </p>
                                </div>
                            </div>

                            {/* Total Questions */}
                            <div className={`${isMobile ? 'mb-4' : 'mb-6'}`}>
                                <p className="text-sm font-medium text-[#9b9b9b] mb-2">مجموع الأسئلة</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {[10, 20, 30, 50].map((questions) => (
                                        <button
                                            key={questions}
                                            onClick={() => setMaxQuestions(questions)}
                                            className={`${isMobile ? 'px-2 py-2 text-sm' : 'px-4 py-2'} rounded-xl font-medium transition-all ${maxQuestions === questions
                                                ? "bg-red-500 hover:bg-red-600 text-white shadow-md"
                                                : "border-2 border-gray-200 text-[#9b9b9b] hover:border-red-300"
                                                }`}
                                        >
                                            {questions}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={startGame}
                                disabled={players.length < 2}
                                className={`w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white rounded-xl shadow-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 ${isMobile ? 'py-3 text-base' : 'py-4 text-lg'}`}
                            >
                                <Shuffle className={`${isMobile ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                ابدأ اللعب!
                            </button>
                        </CardContent>
                    </Card>
                </div>

                {/* Player Roles Preview */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-6">
                    <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                        <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-[#2f2d2c] mb-4`}>Player Roles</h3>
                        <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'grid-cols-4 gap-4'}`}>
                            {playerRoles.slice(0, 8).map((role) => (
                                <div key={role.id} className={`text-center bg-gray-50 rounded-lg ${isMobile ? 'p-2' : 'p-3'}`}>
                                    <div className={`${isMobile ? 'text-2xl mb-1' : 'text-3xl mb-2'}`}>{role.emoji}</div>
                                    <h4 className={`font-semibold text-[#2f2d2c] mb-1 ${isMobile ? 'text-xs' : 'text-sm'}`}>{role.name}</h4>
                                    <p className={`text-[#9b9b9b] line-clamp-2 ${isMobile ? 'text-xs' : 'text-xs'}`}>{role.description}</p>
                                </div>
                            ))}
                        </div>
                        <p className={`text-[#9b9b9b] mt-4 text-center ${isMobile ? 'text-xs' : 'text-sm'}`}>
                            Each player gets a random role that adds personality to the game!
                        </p>
                    </CardContent>
                </Card>

                {/* Game Rules */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                        <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-[#2f2d2c] mb-4`}>How to Play</h3>
                        <div className={`grid ${isMobile ? 'grid-cols-1 gap-3' : 'md:grid-cols-4 gap-4'} ${isMobile ? 'text-xs' : 'text-sm'} text-[#9b9b9b]`}>
                            <div className={`${isMobile ? 'p-3 bg-gray-50 rounded-lg' : ''}`}>
                                <h4 className={`font-semibold text-[#2f2d2c] mb-${isMobile ? '1' : '2'}`}>1. Spin the Wheel</h4>
                                <p>The wheel randomly selects a player for each question</p>
                            </div>
                            <div className={`${isMobile ? 'p-3 bg-gray-50 rounded-lg' : ''}`}>
                                <h4 className={`font-semibold text-[#2f2d2c] mb-${isMobile ? '1' : '2'}`}>2. Choose Wisely</h4>
                                <p>Selected player picks Truth or Dare based on their comfort level</p>
                            </div>
                            <div className={`${isMobile ? 'p-3 bg-gray-50 rounded-lg' : ''}`}>
                                <h4 className={`font-semibold text-[#2f2d2c] mb-${isMobile ? '1' : '2'}`}>3. Complete Challenges</h4>
                                <p>Answer truthfully or complete dares to earn points</p>
                            </div>
                            <div className={`${isMobile ? 'p-3 bg-gray-50 rounded-lg' : ''}`}>
                                <h4 className={`font-semibold text-[#2f2d2c] mb-${isMobile ? '1' : '2'}`}>4. Win Big</h4>
                                <p>Earn coffee beans and points. Highest score wins!</p>
                            </div>
                        </div>
                        <div className={`mt-4 ${isMobile ? 'p-3' : 'p-4'} bg-yellow-50 rounded-lg border border-yellow-200`}>
                            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-yellow-800`}>
                                <strong>New:</strong> Random player selection each turn! No more waiting for your turn - anyone could be
                                next!
                            </p>
                        </div>
                        <div className={`mt-3 ${isMobile ? 'p-3' : 'p-4'} bg-red-50 rounded-lg border-2 border-red-300`}>
                            <p className={`${isMobile ? 'text-xs' : 'text-sm'} text-red-700 font-semibold text-center`}>
                                <strong>Warning:</strong> This game contains VERY HOT & EXPLICIT adult content! 18+ only.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    // Spinning Phase
    if (gameState === "spinning") {
        return (
            <div
                className={`min-h-screen ${isMobile ? "mt-12 px-4 pt-6 pb-8" : "px-8 pt-12 pb-12"} relative transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
            >
                {/* Header */}
                <div className={`flex ${isMobile ? 'flex-col gap-4' : 'flex-row items-center justify-between'} mb-6`}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={resetGame}
                            className="rounded-xl border-2 border-[#ededed] bg-white/80 backdrop-blur-sm p-2 hover:bg-white transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                        >
                            <RotateCcw className="w-5 h-5 text-[#9b9b9b]" />
                        </button>
                        <div className="flex-1">
                            <h1 className={`font-bold text-[#2f2d2c] ${isMobile ? "text-xl" : "text-3xl"} mb-1`}>
                                Question {questionsAsked + 1} of {maxQuestions}
                            </h1>
                            <p className={`text-[#9b9b9b] ${isMobile ? 'text-sm' : 'text-base'}`}>Spinning the wheel...</p>
                        </div>
                    </div>

                    {/* Coffee Beans Balance */}
                    <Card className={`bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-200 ${isMobile ? 'w-full' : ''}`}>
                        <CardContent className={`${isMobile ? 'p-3' : 'p-3'} flex items-center gap-2 justify-center`}>
                            <Coffee className="w-5 h-5 text-amber-600" />
                            <span className={`font-bold text-amber-800 ${isMobile ? 'text-lg' : 'text-xl'}`}>{coffeeBeans}</span>
                        </CardContent>
                    </Card>
                </div>

                {/* Spinning Wheel */}
                <div className="mb-6 text-center">
                    <Card className="bg-gradient-to-r from-purple-100 to-pink-100 border-purple-200 shadow-2xl">
                        <CardContent className={`${isMobile ? 'p-6' : 'p-12'}`}>
                            <div className={`${isMobile ? 'text-6xl mb-4' : 'text-8xl mb-6'}`}>🎡</div>
                            <h2 className={`font-bold text-purple-700 mb-4 ${isMobile ? 'text-2xl' : 'text-4xl'}`}>Spinning the Wheel!</h2>

                            {/* Current spinning player */}
                            {isSpinning && spinningPlayer && (
                                <div className="mb-6">
                                    <div
                                        className={`inline-block ${isMobile ? 'p-4' : 'p-6'} rounded-3xl ${spinningPlayer.role.color} bg-opacity-20 border-4 border-purple-300 animate-pulse`}
                                    >
                                        <div className={`${isMobile ? 'text-4xl mb-2' : 'text-6xl mb-3'}`}>{spinningPlayer.role.emoji}</div>
                                        <h3 className={`font-bold text-[#2f2d2c] ${isMobile ? 'text-xl' : 'text-2xl'}`}>{spinningPlayer.name}</h3>
                                        <span className={`inline-block ${spinningPlayer.role.color} text-white mt-2 rounded-full ${isMobile ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm'} font-medium`}>
                                            {spinningPlayer.role.name}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Final selected player */}
                            {selectedPlayer && !isSpinning && (
                                <div className="mb-6">
                                    <div className={`${isMobile ? 'text-4xl mb-3' : 'text-6xl mb-4'}`}>🎯</div>
                                    <div
                                        className={`inline-block ${isMobile ? 'p-6' : 'p-8'} rounded-3xl ${selectedPlayer.role.color} bg-opacity-30 border-4 border-green-400 animate-bounce`}
                                    >
                                        <div className={`${isMobile ? 'text-6xl mb-3' : 'text-8xl mb-4'}`}>{selectedPlayer.role.emoji}</div>
                                        <h3 className={`font-bold text-[#2f2d2c] mb-2 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>{selectedPlayer.name}</h3>
                                        <span className={`inline-block ${selectedPlayer.role.color} text-white rounded-full font-medium ${isMobile ? 'text-sm px-3 py-1' : 'text-lg px-4 py-2'}`}>
                                            {selectedPlayer.role.name}
                                        </span>
                                        <p className={`text-[#9b9b9b] mt-3 ${isMobile ? 'text-sm' : 'text-base'}`}>{selectedPlayer.role.description}</p>
                                    </div>
                                    <p className={`font-bold text-green-600 mt-4 ${isMobile ? 'text-xl' : 'text-2xl'}`}>You're up!</p>
                                </div>
                            )}

                            {/* Spinner animation */}
                            {isSpinning && (
                                <div className="flex items-center justify-center gap-3">
                                    <Shuffle className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'} text-purple-600 animate-spin`} />
                                    <p className={`text-purple-600 font-semibold ${isMobile ? 'text-base' : 'text-xl'}`}>Finding the next player...</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* All Players Display */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                        <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-[#2f2d2c] mb-4 text-center`}>All Players</h3>
                        <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'md:grid-cols-4 gap-4'}`}>
                            {players.map((player) => (
                                <div
                                    key={player.id}
                                    className={`${isMobile ? 'p-3' : 'p-4'} rounded-xl text-center transition-all duration-300 ${player.isSelected
                                        ? `${player.role.color} bg-opacity-30 border-4 border-green-400 scale-110`
                                        : spinningPlayer?.id === player.id
                                            ? "bg-purple-100 border-2 border-purple-300 scale-105"
                                            : "bg-gray-50 hover:bg-gray-100"
                                        }`}
                                >
                                    <div className={`${isMobile ? 'text-3xl mb-1' : 'text-4xl mb-2'}`}>{player.role.emoji}</div>
                                    <span className={`font-semibold text-[#2f2d2c] block truncate ${isMobile ? 'text-sm' : 'text-base'}`}>{player.name}</span>
                                    <p className={`text-[#9b9b9b] mb-2 truncate ${isMobile ? 'text-xs' : 'text-xs'}`}>{player.role.name}</p>
                                    <p className={`font-bold text-purple-600 ${isMobile ? 'text-base' : 'text-lg'}`}>{player.score}</p>
                                    <p className="text-xs text-[#9b9b9b]">points</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Playing Phase
    if (gameState === "playing" && selectedPlayer) {
        return (
            <div
                className={`min-h-screen ${isMobile ? "mt-12 px-4 pt-6 pb-8" : "px-8 pt-12 pb-12"} relative transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
            >
                {/* Header */}
                <div className={`flex ${isMobile ? 'flex-col gap-4' : 'flex-row items-center justify-between'} mb-6`}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={resetGame}
                            className="rounded-xl border-2 border-[#ededed] bg-white/80 backdrop-blur-sm p-2 hover:bg-white transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                        >
                            <RotateCcw className="w-5 h-5 text-[#9b9b9b]" />
                        </button>
                        <div className="flex-1">
                            <h1 className={`font-bold text-[#2f2d2c] ${isMobile ? "text-xl" : "text-3xl"} mb-1`}>
                                Question {questionsAsked + 1} of {maxQuestions}
                            </h1>
                            <p className={`text-[#9b9b9b] ${isMobile ? 'text-sm' : 'text-base'}`}>{selectedPlayer.name}'s turn</p>
                        </div>
                    </div>

                    {/* Coffee Beans Balance */}
                    <Card className={`bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-200 ${isMobile ? 'w-full' : ''}`}>
                        <CardContent className={`${isMobile ? 'p-3' : 'p-3'} flex items-center gap-2 justify-center`}>
                            <Coffee className="w-5 h-5 text-amber-600" />
                            <span className={`font-bold text-amber-800 ${isMobile ? 'text-lg' : 'text-xl'}`}>{coffeeBeans}</span>
                        </CardContent>
                    </Card>
                </div>

                {/* Selected Player */}
                <div className="mb-8 text-center">
                    <Card className={`border-2 shadow-xl ${selectedPlayer.role.color} bg-opacity-20`}>
                        <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                            <div className={`${isMobile ? 'text-4xl mb-2' : 'text-6xl mb-3'}`}>{selectedPlayer.role.emoji}</div>
                            <h2 className={`font-bold text-[#2f2d2c] mb-2 ${isMobile ? 'text-2xl' : 'text-3xl'}`}>{selectedPlayer.name}</h2>
                            <span className={`inline-block ${selectedPlayer.role.color} text-white mb-3 rounded-full font-medium ${isMobile ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'}`}>
                                {selectedPlayer.role.name}
                            </span>
                            <p className={`text-[#9b9b9b] mb-4 ${isMobile ? 'text-xs' : 'text-sm'}`}>{selectedPlayer.role.description}</p>
                            <span className={`inline-block bg-red-500 text-white rounded-full font-medium ${isMobile ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'}`}>
                                Scores: {selectedPlayer.score} points
                            </span>
                        </CardContent>
                    </Card>
                </div>

                {/* Choice: Truth or Dare */}
                {!currentQuestion && (
                    <div className="mb-8 text-center">
                        <Card className="bg-gradient-to-br from-red-100 to-pink-100 border-red-200 shadow-2xl">
                            <CardContent className={`${isMobile ? 'p-6' : 'p-8'}`}>
                                <h3 className={`${isMobile ? 'text-xl' : 'text-2xl'} font-bold text-[#2f2d2c] mb-4`}>Choose Your Challenge</h3>
                                <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-4`}>
                                    <button
                                        onClick={() => chooseTruthOrDare("truth")}
                                        className={`bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${isMobile ? 'py-6' : 'py-8'}`}
                                    >
                                        <Heart className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
                                        <div className="text-left">
                                            <div className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'}`}>TRUTH</div>
                                            <div className={`${isMobile ? 'text-xs' : 'text-sm'} opacity-90`}>Answer honestly</div>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => chooseTruthOrDare("dare")}
                                        className={`bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${isMobile ? 'py-6' : 'py-8'}`}
                                    >
                                        <Zap className={`${isMobile ? 'w-6 h-6' : 'w-8 h-8'}`} />
                                        <div className="text-left">
                                            <div className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'}`}>DARE</div>
                                            <div className={`${isMobile ? 'text-xs' : 'text-sm'} opacity-90`}>Take the challenge</div>
                                        </div>
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Current Question/Dare */}
                {currentQuestion && (
                    <div className="mb-6">
                        <Card
                            className={`border-0 shadow-xl ${currentQuestion.type === "truth"
                                ? "bg-gradient-to-r from-blue-100 to-cyan-100 border-blue-200"
                                : "bg-gradient-to-r from-orange-100 to-red-100 border-orange-200"
                                } ${currentQuestion.isAdult ? "border-4 border-red-400" : ""}`}
                        >
                            <CardContent className={`${isMobile ? 'p-4' : 'p-8'} text-center`}>
                                <div className={`${isMobile ? 'text-4xl mb-3' : 'text-6xl mb-4'}`}>
                                    {currentQuestion.isAdult ? "18+" : currentQuestion.type === "truth" ? "Truth" : "Dare"}
                                </div>
                                <div className={`flex flex-wrap justify-center gap-2 mb-4`}>
                                    <span
                                        className={`${isMobile ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'} rounded-full ${currentQuestion.type === "truth" ? "bg-blue-500" : "bg-orange-500"} text-white font-medium`}
                                    >
                                        {currentQuestion.category}
                                    </span>
                                    <span
                                        className={`${isMobile ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'} rounded-full ${currentQuestion.type === "truth" ? "bg-blue-500" : "bg-orange-500"} text-white font-medium`}
                                    >
                                        {currentQuestion.difficulty}
                                    </span>
                                    <span
                                        className={`${isMobile ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'} rounded-full ${currentQuestion.type === "truth" ? "bg-blue-500" : "bg-orange-500"} text-white font-medium`}
                                    >
                                        {currentQuestion.points} points
                                    </span>
                                    {currentQuestion.isAdult && (
                                        <span className={`${isMobile ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'} rounded-full bg-red-600 text-white font-medium flex items-center gap-1`}>
                                            <AlertTriangle className="w-3 h-3" />
                                            18+
                                        </span>
                                    )}
                                </div>
                                <h3
                                    className={`${isMobile ? 'text-lg' : 'text-2xl'} font-bold mb-6 ${currentQuestion.type === "truth" ? "text-blue-700" : "text-orange-700"}`}
                                >
                                    {currentQuestion.text}
                                </h3>
                                <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} gap-3 justify-center`}>
                                    <button
                                        onClick={() => completeChallenge(true)}
                                        className={`bg-green-500 hover:bg-green-600 active:bg-green-700 text-white rounded-xl font-bold transition-all active:scale-95 ${isMobile ? 'py-3 px-6 text-base' : 'px-8 py-3 text-lg'}`}
                                    >
                                        Completed
                                    </button>
                                    <button
                                        onClick={() => completeChallenge(false)}
                                        className={`border-2 border-red-300 text-red-600 hover:bg-red-50 active:bg-red-100 rounded-xl font-bold transition-all active:scale-95 ${isMobile ? 'py-3 px-6 text-base' : 'px-8 py-3 text-lg'}`}
                                    >
                                        Skip
                                    </button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Points Earned Notification */}
                {currentQuestion && (
                    <div className="mb-4 text-center">
                        <span className={`inline-block bg-green-500 text-white rounded-full font-semibold ${isMobile ? 'text-sm px-3 py-2' : 'text-lg px-4 py-2'}`}>
                            Complete this challenge to earn {currentQuestion.points} points
                        </span>
                    </div>
                )}

                {/* Points Animation */}
                {showPointsAnimation?.show && (
                    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none px-4">
                        <div className={`bg-green-500 text-white rounded-3xl shadow-2xl animate-bounce ${isMobile ? 'px-6 py-3' : 'px-8 py-4'}`}>
                            <div className="text-center">
                                <p className={`font-bold ${isMobile ? 'text-lg' : 'text-xl'}`}>{showPointsAnimation.player}</p>
                                <p className={`${isMobile ? 'text-base' : 'text-lg'}`}>+{showPointsAnimation.points} نقطة!</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Scoreboard */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                        <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-[#2f2d2c] mb-4`}>Scoreboard</h3>
                        <div className={`grid ${isMobile ? 'grid-cols-2 gap-3' : 'md:grid-cols-4 gap-4'}`}>
                            {players
                                .sort((a, b) => b.score - a.score)
                                .map((player, index) => (
                                    <div
                                        key={player.id}
                                        className={`${isMobile ? 'p-3' : 'p-4'} rounded-xl text-center transition-all duration-300 ${player.isSelected
                                            ? "bg-gradient-to-r from-red-100 to-pink-100 border-2 border-red-300 scale-105"
                                            : "bg-gray-50 hover:bg-gray-100"
                                            }`}
                                    >
                                        <div className="flex items-center justify-center gap-1 mb-2">
                                            <span className={`${isMobile ? 'text-xl' : 'text-2xl'}`}>{player.role.emoji}</span>
                                            {index === 0 && player.score > 0 && <Crown className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-yellow-500`} />}
                                        </div>
                                        <span className={`font-semibold text-[#2f2d2c] block truncate ${isMobile ? 'text-xs' : 'text-sm'}`}>{player.name}</span>
                                        <p className={`text-[#9b9b9b] mb-2 truncate ${isMobile ? 'text-xs' : 'text-xs'}`}>{player.role.name}</p>
                                        <p className={`font-bold text-red-600 ${isMobile ? 'text-xl' : 'text-2xl'}`}>{player.score}</p>
                                        <p className="text-xs text-[#9b9b9b]">نقاط</p>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Finished Phase
    if (gameState === "finished") {
        const winner = getWinner();
        const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

        return (
            <div
                className={`min-h-screen ${isMobile ? "mt-12 px-4 pt-6 pb-8" : "px-8 pt-12 pb-12"} relative transition-colors duration-300 ${isDarkMode ? 'bg-black' : 'bg-white'}`}
            >
                {/* Header */}
                <div className={`flex ${isMobile ? 'flex-col gap-4' : 'flex-row items-center justify-between'} mb-6`}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={resetGame}
                            className="rounded-xl border-2 border-[#ededed] bg-white/80 backdrop-blur-sm p-2 hover:bg-white transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                        >
                            <RotateCcw className="w-5 h-5 text-[#9b9b9b]" />
                        </button>
                        <div className="flex-1">
                            <h1 className={`font-bold text-[#2f2d2c] ${isMobile ? "text-2xl" : "text-4xl"} mb-2`}>
                                Game Over!
                            </h1>
                            <p className={`text-[#9b9b9b] ${isMobile ? 'text-sm' : 'text-base'}`}>
                                Thanks for playing Coffee Truth or Dare!
                            </p>
                        </div>
                    </div>

                    {/* Coffee Beans Balance */}
                    <Card className={`bg-gradient-to-r from-amber-100 to-yellow-100 border-amber-200 shadow-lg ${isMobile ? 'w-full' : ''}`}>
                        <CardContent className={`${isMobile ? 'p-3' : 'p-4'} flex items-center gap-3 justify-center`}>
                            <Coffee className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'} text-amber-600`} />
                            <div>
                                <p className={`text-amber-700 font-medium ${isMobile ? 'text-xs' : 'text-sm'}`}>Coffee Beans</p>
                                <p className={`font-bold text-amber-800 ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                                    {coffeeBeans.toLocaleString()}
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Winner Card */}
                <div className="mb-6 text-center">
                    <Card className="bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300 shadow-2xl">
                        <CardContent className={`${isMobile ? 'p-6' : 'p-8'}`}>
                            <div className={`${isMobile ? 'text-6xl mb-3' : 'text-8xl mb-4'}`}>{winner.role.emoji}</div>
                            <h2 className={`font-bold text-yellow-800 mb-2 ${isMobile ? 'text-3xl' : 'text-4xl'}`}>
                                {winner.name} Wins!
                            </h2>
                            <span className={`inline-block ${winner.role.color} text-white mb-4 rounded-full font-medium ${isMobile ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'}`}>
                                {winner.role.name}
                            </span>
                            <p className={`text-yellow-700 mb-4 ${isMobile ? 'text-lg' : 'text-xl'}`}>
                                Final Score: {winner.score} points
                            </p>
                            <span className={`inline-block bg-yellow-500 text-white rounded-full font-medium ${isMobile ? 'text-base px-3 py-2' : 'text-lg px-4 py-2'}`}>
                                Coffee Truth or Dare Champion!
                            </span>
                        </CardContent>
                    </Card>
                </div>

                {/* Final Scoreboard */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg mb-6">
                    <CardContent className={`${isMobile ? 'p-4' : 'p-6'}`}>
                        <h3 className={`${isMobile ? 'text-lg' : 'text-xl'} font-bold text-[#2f2d2c] mb-4 text-center`}>
                            Final Scoreboard
                        </h3>
                        <div className="space-y-3">
                            {sortedPlayers.map((player, index) => (
                                <div
                                    key={player.id}
                                    className={`flex items-center justify-between ${isMobile ? 'p-3' : 'p-4'} rounded-xl ${index === 0
                                            ? "bg-gradient-to-r from-yellow-100 to-amber-100 border-2 border-yellow-300"
                                            : index === 1
                                                ? "bg-gradient-to-r from-gray-100 to-gray-200 border-2 border-gray-300"
                                                : index === 2
                                                    ? "bg-gradient-to-r from-orange-100 to-red-100 border-2 border-orange-300"
                                                    : "bg-gray-50"
                                        }`}
                                >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <div
                                            className={`${isMobile ? 'w-7 h-7 text-sm' : 'w-8 h-8 text-base'} rounded-full flex items-center justify-center font-bold ${index === 0
                                                    ? "bg-yellow-500 text-white"
                                                    : index === 1
                                                        ? "bg-gray-500 text-white"
                                                        : index === 2
                                                            ? "bg-orange-500 text-white"
                                                            : "bg-gray-300 text-gray-600"
                                                }`}
                                        >
                                            {index + 1}
                                        </div>
                                        <span className={`${isMobile ? 'text-2xl' : 'text-3xl'}`}>{player.role.emoji}</span>
                                        <div className="flex-1 min-w-0">
                                            <span className={`font-semibold text-[#2f2d2c] block truncate ${isMobile ? 'text-sm' : 'text-base'}`}>
                                                {player.name}
                                            </span>
                                            <span className={`text-[#9b9b9b] truncate block ${isMobile ? 'text-xs' : 'text-sm'}`}>
                                                {player.role.name}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-bold text-[#2f2d2c] ${isMobile ? 'text-xl' : 'text-2xl'}`}>
                                            {player.score}
                                        </p>
                                        <p className={`text-[#9b9b9b] ${isMobile ? 'text-xs' : 'text-sm'}`}>points</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Play Again Button */}
                <div className="text-center pb-32">
                    <button
                        onClick={resetGame}
                        className={`bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 active:from-red-700 active:to-pink-700 text-white rounded-xl shadow-lg font-bold transition-all active:scale-95 flex items-center justify-center gap-3 mx-auto ${isMobile ? 'px-6 py-3 text-base' : 'px-8 py-4 text-xl'}`}
                    >
                        <Shuffle className={`${isMobile ? 'w-5 h-5' : 'w-6 h-6'}`} />
                        Spin Again!
                    </button>
                </div>
            </div>
        );
    }

    return null;
}