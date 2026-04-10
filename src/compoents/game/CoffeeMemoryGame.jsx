import React, { useState, useEffect } from "react";
import { RotateCcw, Trophy, Clock, Zap, ArrowLeft, Coffee, Users, UserPlus, X, Crown, Award, Brain, Hand, CircleHelp, Target } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { getTranslation } from "../../translations/gameTranslations";
import LanguageSelector from "../LanguageSelector";

import CoffeeTruthOrDare from "./CoffeeTruthOrDare";

import CoffeeNameThreeThings from "./CoffeeNameThreeThings";
import FingerSelectionGame from "./FingerSelectionGame";
import FootballChallengeGame from "./FootballChallengeGame";
import FirstDateGame from "./FirstDateGame";

const coffeeItems = [
  { type: "espresso", emoji: "☕", name: "Espresso" },
  { type: "cappuccino", emoji: "🥛", name: "Cappuccino" },
  { type: "latte", emoji: "🍼", name: "Latte" },
  { type: "mocha", emoji: "🍫", name: "Mocha" },
  { type: "americano", emoji: "☕", name: "Americano" },
  { type: "macchiato", emoji: "🥤", name: "Macchiato" },
  { type: "frappuccino", emoji: "🧊", name: "Frappuccino" },
  { type: "turkish", emoji: "🫖", name: "Turkish Coffee" },
];

export default function CoffeeMemoryGame({ isMobile, setCurrentView, isDarkMode }) {
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);
  
  const [currentGame, setCurrentGame] = useState("menu");
  const [cards, setCards] = useState([]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [bestScore, setBestScore] = useState(null);
  const [coffeeBeans, setCoffeeBeans] = useState(1000);
  
  // Friends & Challenge System
  const [friends, setFriends] = useState([]);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [newFriendName, setNewFriendName] = useState("");
  const [currentPlayer, setCurrentPlayer] = useState(null);

  // Init game + localStorage
  useEffect(() => {
    if (currentGame === "memory") {
      initializeMemoryGame();
    }
    const savedBest = localStorage.getItem("coffee-memory-best-score");
    const savedBeans = localStorage.getItem("coffee-beans");
    const savedFriends = localStorage.getItem("coffee-memory-friends");
    const savedPlayer = localStorage.getItem("coffee-memory-current-player");
    
    if (savedBest) setBestScore(parseInt(savedBest));
    if (savedBeans) setCoffeeBeans(parseInt(savedBeans));
    if (savedFriends) setFriends(JSON.parse(savedFriends));
    if (savedPlayer) setCurrentPlayer(JSON.parse(savedPlayer));
  }, [currentGame]);

  useEffect(() => {
    localStorage.setItem("coffee-beans", coffeeBeans.toString());
  }, [coffeeBeans]);

  useEffect(() => {
    if (friends.length > 0) {
      localStorage.setItem("coffee-memory-friends", JSON.stringify(friends));
    }
  }, [friends]);

  useEffect(() => {
    if (currentPlayer) {
      localStorage.setItem("coffee-memory-current-player", JSON.stringify(currentPlayer));
    }
  }, [currentPlayer]);

  useEffect(() => {
    let interval;
    if (gameStarted && !gameCompleted && currentGame === "memory") {
      interval = setInterval(() => setTimeElapsed((t) => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameCompleted, currentGame]);

  useEffect(() => {
    if (matchedPairs === coffeeItems.length && gameStarted && currentGame === "memory") {
      setGameCompleted(true);
      setGameStarted(false);
      
      // Update player score
      if (currentPlayer) {
        const updatedPlayer = {
          ...currentPlayer,
          gamesPlayed: (currentPlayer.gamesPlayed || 0) + 1,
          bestScore: !currentPlayer.bestScore || moves < currentPlayer.bestScore ? moves : currentPlayer.bestScore,
          totalTime: (currentPlayer.totalTime || 0) + timeElapsed,
          lastPlayed: new Date().toISOString()
        };
        setCurrentPlayer(updatedPlayer);
        
        // Update in friends list
        setFriends(prev => prev.map(f => 
          f.id === currentPlayer.id ? updatedPlayer : f
        ));
      }
      
      if (!bestScore || moves < bestScore) {
        setBestScore(moves);
        localStorage.setItem("coffee-memory-best-score", moves.toString());
        setCoffeeBeans((b) => b + 100);
      } else {
        setCoffeeBeans((b) => b + 50);
      }
    }
  }, [matchedPairs, moves, bestScore, gameStarted, currentGame, timeElapsed, currentPlayer]);

  const initializeMemoryGame = () => {
    let id = 0;
    const gameCards = coffeeItems.flatMap((item) => [
      { id: id++, type: item.type, emoji: item.emoji, name: item.name, isFlipped: false, isMatched: false },
      { id: id++, type: item.type, emoji: item.emoji, name: item.name, isFlipped: false, isMatched: false },
    ]);
    setCards(gameCards.sort(() => Math.random() - 0.5));
    setFlippedCards([]);
    setMatchedPairs(0);
    setMoves(0);
    setTimeElapsed(0);
    setGameStarted(false);
    setGameCompleted(false);
  };

  const handleCardClick = (cardId) => {
    if (!gameStarted) setGameStarted(true);
    const card = cards.find((c) => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched || flippedCards.length >= 2) return;

    const newFlipped = [...flippedCards, cardId];
    setFlippedCards(newFlipped);
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, isFlipped: true } : c)));

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = newFlipped;
      const ca = cards.find((c) => c.id === a);
      const cb = cards.find((c) => c.id === b);
      if (ca && cb && ca.type === cb.type) {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => (c.id === a || c.id === b ? { ...c, isMatched: true } : c))
          );
          setMatchedPairs((p) => p + 1);
          setFlippedCards([]);
        }, 500);
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => (c.id === a || c.id === b ? { ...c, isFlipped: false } : c))
          );
          setFlippedCards([]);
        }, 1000);
      }
    }
  };

  const addFriend = () => {
    if (!newFriendName.trim()) return;

    const newFriend = {
      id: Date.now(),
      name: newFriendName.trim(),
      gamesPlayed: 0,
      bestScore: null,
      totalTime: 0,
      createdAt: new Date().toISOString(),
    };

    setFriends([...friends, newFriend]);
    setNewFriendName("");
    setShowAddFriend(false);
  };

  const selectPlayer = (friend) => {
    setCurrentPlayer(friend);
    setShowLeaderboard(false);
  };

  const removeFriend = (friendId) => {
    setFriends(friends.filter((f) => f.id !== friendId));
    if (currentPlayer?.id === friendId) {
      setCurrentPlayer(null);
    }
  };

  const getSortedLeaderboard = () => {
    return [...friends]
      .filter((f) => f.gamesPlayed > 0)
      .sort((a, b) => {
        if (!a.bestScore) return 1;
        if (!b.bestScore) return -1;
        return a.bestScore - b.bestScore;
      });
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // === GAME MENU ===
  if (currentGame === "menu") {
    const gameItems = [
      {
        key: "memory",
        icon: Brain,
        title: t('memoryGame'),
        description: t('memoryGameDesc'),
      },
      {
        key: "fingerGame",
        icon: Hand,
        title: t('fingerSelection'),
        description: t('fingerSelectionDesc'),
      },
      {
        key: "footballChallenge",
        icon: Trophy,
        title: t('footballChallenge'),
        description: t('footballChallengeDesc'),
      },
      {
        key: "firstDate",
        icon: Users,
        title: t('firstDateGame'),
        description: t('firstDateGameDesc'),
      },
      {
        key: "truthOrDare",
        icon: CircleHelp,
        title: t('truthOrDare'),
        description: t('truthOrDareDesc'),
      },
      {
        key: "threeThings",
        icon: Target,
        title: t('nameThreeThings'),
        description: t('nameThreeThingsDesc'),
      },
    ];

    return (
      <div className='w-full'>
        <section className='mb-24 sm:mb-28 lg:mb-32'>
          <div className='max-w-5xl mx-auto text-center'>
            <div className='mb-8 sm:mb-10 lg:mb-12'>
              <div className='inline-flex items-center gap-3 sm:gap-4'>
                <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
                <span className='text-amber-500 text-[9px] sm:text-[10px] tracking-[0.5em] font-light uppercase'>
                  Brew Games
                </span>
                <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
              </div>
            </div>

            <div className='mb-12 sm:mb-16 lg:mb-20'>
              <h1 className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[9rem] font-extralight leading-[0.9] tracking-tighter transition-colors ${
                isDarkMode ? 'text-white' : 'text-black'
              }`}>
                Coffee
                <br />
                <span className='text-amber-500'>Games</span>
              </h1>
            </div>

            <div className='mb-10 sm:mb-12 lg:mb-14'>
              <p className={`text-base sm:text-lg md:text-xl lg:text-2xl font-light leading-relaxed max-w-3xl mx-auto mb-4 sm:mb-6 px-4 transition-colors ${
                isDarkMode ? 'text-white/50' : 'text-black/60'
              }`}>
                Play together. Laugh together. Make every cup more memorable.
              </p>
              <p className={`text-sm sm:text-base md:text-lg lg:text-xl font-light leading-relaxed max-w-3xl mx-auto px-4 transition-colors ${
                isDarkMode ? 'text-white/30' : 'text-black/40'
              }`}>
                {t('selectGame')}
              </p>
            </div>

            <div className='flex justify-center'>
              <LanguageSelector isDarkMode={isDarkMode} />
            </div>
          </div>
        </section>

        <section>
          <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3"} gap-6 sm:gap-8`}>
            {gameItems.map((game) => {
              const Icon = game.icon;
              return (
              <button
                key={game.key}
                onClick={() => setCurrentGame(game.key)}
                className={`group relative text-left p-6 sm:p-8 border transition-all duration-500 hover:-translate-y-1.5 ${
                  isDarkMode
                    ? 'bg-white/[0.02] border-white/10 hover:bg-white/[0.06] hover:border-amber-500/50'
                    : 'bg-black/[0.02] border-black/10 hover:bg-black/[0.04] hover:border-amber-600/40'
                }`}
              >
                <div className='mb-5 sm:mb-6 flex items-center justify-between'>
                  <Icon className={`w-10 h-10 sm:w-12 sm:h-12 ${isDarkMode ? 'text-white/85' : 'text-black/80'}`} strokeWidth={1.5} />
                  <span className='text-[9px] sm:text-[10px] tracking-[0.35em] uppercase text-amber-500 font-light'>
                    Play
                  </span>
                </div>

                <h3 className={`font-light text-xl sm:text-2xl mb-3 tracking-tight transition-colors ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}>
                  {game.title}
                </h3>

                <p className={`text-sm leading-relaxed font-light transition-colors ${
                  isDarkMode ? 'text-white/55' : 'text-black/55'
                }`}>
                  {game.description}
                </p>

                <div className='mt-6 sm:mt-8'>
                  <span className='inline-flex items-center gap-2 text-[10px] sm:text-xs tracking-[0.28em] uppercase text-amber-500 font-light'>
                    Start Game
                    <Zap className='w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300' />
                  </span>
                </div>
              </button>
              );
            })}
          </div>
        </section>
      </div>
    );
  }

  // === OTHER GAMES ===
  if (currentGame === "fingerGame") return <FingerSelectionGame isMobile={isMobile} setCurrentGame={setCurrentGame} isDarkMode={isDarkMode} />;
  if (currentGame === "footballChallenge") return <FootballChallengeGame isMobile={isMobile} setCurrentGame={setCurrentGame} isDarkMode={isDarkMode} />;
  if (currentGame === "truthOrDare") return <CoffeeTruthOrDare isMobile={isMobile} setCurrentGame={setCurrentGame} coffeeBeans={coffeeBeans} setCoffeeBeans={setCoffeeBeans} isDarkMode={isDarkMode} />;
  if (currentGame === "firstDate") return <FirstDateGame isMobile={isMobile} setCurrentGame={setCurrentGame} isDarkMode={isDarkMode} />;
  if (currentGame === "threeThings") return <CoffeeNameThreeThings isMobile={isMobile} setCurrentGame={setCurrentGame} coffeeBeans={coffeeBeans} setCoffeeBeans={setCoffeeBeans} isDarkMode={isDarkMode} />;

  // === MEMORY GAME ===
  return (
    <div className={`${isMobile ? "px-6 pt-8 pb-24" : "px-8 pt-12 pb-8"} min-h-screen transition-colors ${
      isDarkMode ? 'bg-black' : 'bg-white'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setCurrentGame("menu")} 
            className={`p-2 rounded-xl border transition-all duration-300 hover:shadow-lg ${
              isDarkMode 
                ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                : 'bg-white/80 border-black/10 hover:bg-white'
            }`}
          >
            <ArrowLeft className={`w-5 h-5 transition-colors ${
              isDarkMode ? 'text-white/60' : 'text-gray-500'
            }`} />
          </button>
          <div>
            <h1 className={`font-bold ${isMobile ? "text-xl" : "text-3xl"} transition-colors ${
              isDarkMode ? 'text-white' : 'text-gray-800'
            }`}>{t('memoryGame')}</h1>
            <p className={`text-sm transition-colors ${
              isDarkMode ? 'text-white/60' : 'text-gray-500'
            }`}>{currentPlayer ? `Playing as: ${currentPlayer.name}` : t('memoryGameDesc')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowLeaderboard(true)} 
            className={`px-4 py-2 rounded-xl flex items-center hover:shadow-lg transition-all duration-300 hover:scale-105 font-semibold ${
              isDarkMode 
                ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30' 
                : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
            }`}
          >
            <Users className="w-4 h-4 mr-2" /> {!isMobile && 'Friends'}
          </button>
          <button 
            onClick={initializeMemoryGame} 
            className={`px-4 py-2 rounded-xl flex items-center hover:shadow-lg transition-all duration-300 hover:scale-105 font-semibold ${
              isDarkMode 
                ? 'bg-amber-500 text-black hover:bg-amber-400' 
                : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'
            }`}
          >
            <RotateCcw className="w-4 h-4 mr-2" /> {!isMobile && t('restart')}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className={`grid ${isMobile ? "grid-cols-3" : "grid-cols-4"} gap-4 mb-8`}>
        <div className={`p-4 rounded-xl shadow-lg border-2 transition-colors ${
          isDarkMode 
            ? 'bg-blue-500/10 border-blue-500/20' 
            : 'bg-white border-blue-200'
        }`}>
          <div className={`flex items-center gap-2 mb-2 transition-colors ${
            isDarkMode ? 'text-blue-400' : 'text-blue-600'
          }`}>
            <Zap className="w-5 h-5" />
            <span className="font-semibold">{t('moves')}</span>
          </div>
          <p className={`text-2xl font-bold transition-colors ${
            isDarkMode ? 'text-white' : 'text-gray-800'
          }`}>{moves}</p>
        </div>
        <div className={`p-4 rounded-xl shadow-lg border-2 transition-colors ${
          isDarkMode 
            ? 'bg-green-500/10 border-green-500/20' 
            : 'bg-white border-green-200'
        }`}>
          <div className={`flex items-center gap-2 mb-2 transition-colors ${
            isDarkMode ? 'text-green-400' : 'text-green-600'
          }`}>
            <Trophy className="w-5 h-5" />
            <span className="font-semibold">{t('matchedPairs')}</span>
          </div>
          <p className={`text-2xl font-bold transition-colors ${
            isDarkMode ? 'text-white' : 'text-gray-800'
          }`}>{matchedPairs}/{coffeeItems.length}</p>
        </div>
        <div className={`p-4 rounded-xl shadow-lg border-2 transition-colors ${
          isDarkMode 
            ? 'bg-purple-500/10 border-purple-500/20' 
            : 'bg-white border-purple-200'
        }`}>
          <div className={`flex items-center gap-2 mb-2 transition-colors ${
            isDarkMode ? 'text-purple-400' : 'text-purple-600'
          }`}>
            <Clock className="w-5 h-5" />
            <span className="font-semibold">{t('time')}</span>
          </div>
          <p className={`text-2xl font-bold transition-colors ${
            isDarkMode ? 'text-white' : 'text-gray-800'
          }`}>{formatTime(timeElapsed)}</p>
        </div>
        {!isMobile && (
          <div className={`p-4 rounded-xl shadow-lg border-2 transition-colors ${
            isDarkMode 
              ? 'bg-amber-500/10 border-amber-500/20' 
              : 'bg-gradient-to-br from-amber-100 to-yellow-100 border-amber-200'
          }`}>
            <div className={`flex items-center gap-2 mb-2 transition-colors ${
              isDarkMode ? 'text-amber-400' : 'text-amber-700'
            }`}>
              <Coffee className="w-5 h-5" />
              <span className="font-semibold">Beans</span>
            </div>
            <p className={`text-2xl font-bold transition-colors ${
              isDarkMode ? 'text-amber-500' : 'text-amber-800'
            }`}>{coffeeBeans}</p>
          </div>
        )}
      </div>

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-3xl p-6 max-w-md w-full shadow-2xl transition-colors ${
            isDarkMode ? 'bg-zinc-900 border border-white/10' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`text-xl font-bold transition-colors ${
                isDarkMode ? 'text-white' : 'text-gray-800'
              }`}>Add Friend</h3>
              <button 
                onClick={() => setShowAddFriend(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                }`}
              >
                <X className={`w-5 h-5 transition-colors ${
                  isDarkMode ? 'text-white/60' : 'text-gray-500'
                }`} />
              </button>
            </div>
            
            <input
              type="text"
              value={newFriendName}
              onChange={(e) => setNewFriendName(e.target.value)}
              placeholder="Enter friend's name"
              className={`w-full px-4 py-3 rounded-xl mb-4 border-2 transition-colors ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-white placeholder-white/40 focus:border-amber-500' 
                  : 'bg-gray-50 border-gray-200 focus:border-orange-500'
              } outline-none`}
              onKeyPress={(e) => e.key === 'Enter' && addFriend()}
            />
            
            <button
              onClick={addFriend}
              className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center transition-all ${
                isDarkMode 
                  ? 'bg-amber-500 text-black hover:bg-amber-400' 
                  : 'bg-gradient-to-br from-orange-500 to-red-500 text-white hover:shadow-lg'
              }`}
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Add Friend
            </button>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-3xl p-6 max-w-2xl w-full shadow-2xl transition-colors max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-zinc-900 border border-white/10' : 'bg-white'
          }`}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Trophy className={`w-6 h-6 transition-colors ${
                  isDarkMode ? 'text-amber-500' : 'text-orange-600'
                }`} />
                <h3 className={`text-2xl font-bold transition-colors ${
                  isDarkMode ? 'text-white' : 'text-gray-800'
                }`}>Friends & Leaderboard</h3>
              </div>
              <button 
                onClick={() => setShowLeaderboard(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isDarkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100'
                }`}
              >
                <X className={`w-5 h-5 transition-colors ${
                  isDarkMode ? 'text-white/60' : 'text-gray-500'
                }`} />
              </button>
            </div>

            {/* Add Friend Button */}
            <button
              onClick={() => {
                setShowLeaderboard(false);
                setShowAddFriend(true);
              }}
              className={`w-full py-3 rounded-xl mb-6 font-semibold flex items-center justify-center transition-all ${
                isDarkMode 
                  ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-500/30' 
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              <UserPlus className="w-5 h-5 mr-2" />
              Add New Friend
            </button>

            {/* Current Player */}
            {currentPlayer && (
              <div className={`p-4 rounded-xl mb-4 border-2 ${
                isDarkMode 
                  ? 'bg-amber-500/10 border-amber-500/30' 
                  : 'bg-amber-50 border-amber-300'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Crown className={`w-6 h-6 transition-colors ${
                      isDarkMode ? 'text-amber-500' : 'text-amber-600'
                    }`} />
                    <div>
                      <p className={`font-bold transition-colors ${
                        isDarkMode ? 'text-white' : 'text-gray-800'
                      }`}>{currentPlayer.name}</p>
                      <p className={`text-sm transition-colors ${
                        isDarkMode ? 'text-white/60' : 'text-gray-600'
                      }`}>Currently Playing</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold transition-colors ${
                      isDarkMode ? 'text-amber-500' : 'text-amber-600'
                    }`}>{currentPlayer.bestScore || '-'}</p>
                    <p className={`text-xs transition-colors ${
                      isDarkMode ? 'text-white/40' : 'text-gray-500'
                    }`}>{currentPlayer.gamesPlayed} games</p>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <div className="space-y-3 mb-4">
              <h4 className={`font-semibold text-sm transition-colors ${
                isDarkMode ? 'text-white/60' : 'text-gray-600'
              }`}>RANKINGS</h4>
              {getSortedLeaderboard().length > 0 ? (
                getSortedLeaderboard().map((friend, index) => (
                  <div
                    key={friend.id}
                    className={`p-4 rounded-xl flex items-center justify-between transition-all hover:scale-102 cursor-pointer ${
                      currentPlayer?.id === friend.id
                        ? isDarkMode
                          ? 'bg-amber-500/10 border-2 border-amber-500/30'
                          : 'bg-amber-50 border-2 border-amber-300'
                        : isDarkMode
                          ? 'bg-white/5 hover:bg-white/10'
                          : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => selectPlayer(friend)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0
                          ? isDarkMode ? 'bg-amber-500 text-black' : 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white'
                          : index === 1
                            ? isDarkMode ? 'bg-gray-400 text-black' : 'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800'
                            : index === 2
                              ? isDarkMode ? 'bg-orange-600 text-white' : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                              : isDarkMode ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {index === 0 ? '👑' : index + 1}
                      </div>
                      <div>
                        <p className={`font-semibold transition-colors ${
                          isDarkMode ? 'text-white' : 'text-gray-800'
                        }`}>{friend.name}</p>
                        <p className={`text-xs transition-colors ${
                          isDarkMode ? 'text-white/40' : 'text-gray-500'
                        }`}>{friend.gamesPlayed} games played</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold transition-colors ${
                        isDarkMode ? 'text-amber-500' : 'text-orange-600'
                      }`}>{friend.bestScore} moves</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFriend(friend.id);
                        }}
                        className={`text-xs transition-colors hover:underline ${
                          isDarkMode ? 'text-red-400' : 'text-red-600'
                        }`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className={`text-center py-8 transition-colors ${
                  isDarkMode ? 'text-white/40' : 'text-gray-400'
                }`}>
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No games played yet</p>
                  <p className="text-sm">Add friends and start playing!</p>
                </div>
              )}
            </div>

            {/* All Friends */}
            {friends.filter(f => f.gamesPlayed === 0).length > 0 && (
              <>
                <h4 className={`font-semibold text-sm mb-3 transition-colors ${
                  isDarkMode ? 'text-white/60' : 'text-gray-600'
                }`}>NOT PLAYED YET</h4>
                <div className="space-y-2">
                  {friends.filter(f => f.gamesPlayed === 0).map((friend) => (
                    <div
                      key={friend.id}
                      className={`p-3 rounded-xl flex items-center justify-between transition-all hover:scale-102 cursor-pointer ${
                        currentPlayer?.id === friend.id
                          ? isDarkMode
                            ? 'bg-amber-500/10 border border-amber-500/30'
                            : 'bg-amber-50 border border-amber-300'
                          : isDarkMode
                            ? 'bg-white/5 hover:bg-white/10'
                            : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => selectPlayer(friend)}
                    >
                      <p className={`font-medium transition-colors ${
                        isDarkMode ? 'text-white' : 'text-gray-800'
                      }`}>{friend.name}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFriend(friend.id);
                        }}
                        className={`text-xs transition-colors hover:underline ${
                          isDarkMode ? 'text-red-400' : 'text-red-600'
                        }`}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/*   ? 'bg-purple-500/10 border-purple-500/20' 
            : 'bg-white border-purple-200'
        }`}>
          <div className={`flex items-center gap-2 mb-2 transition-colors ${
            isDarkMode ? 'text-purple-400' : 'text-purple-600'
          }`}>
            <Clock className="w-5 h-5" />
            <span className="font-semibold">{t('time')}</span>
          </div>
          <p className={`text-2xl font-bold transition-colors ${
            isDarkMode ? 'text-white' : 'text-gray-800'
          }`}>{formatTime(timeElapsed)}</p>
        </div>
        {!isMobile && (
          <div className={`p-4 rounded-xl shadow-lg border-2 transition-colors ${
            isDarkMode 
              ? 'bg-amber-500/10 border-amber-500/20' 
              : 'bg-gradient-to-br from-amber-100 to-yellow-100 border-amber-200'
          }`}>
            <div className={`flex items-center gap-2 mb-2 transition-colors ${
              isDarkMode ? 'text-amber-400' : 'text-amber-700'
            }`}>
              <Coffee className="w-5 h-5" />
              <span className="font-semibold">Beans</span>
            </div>
            <p className={`text-2xl font-bold transition-colors ${
              isDarkMode ? 'text-amber-500' : 'text-amber-800'
            }`}>{coffeeBeans}</p>
          </div>
        )}
      </div>

      {/* Game Board */}
      <div className={`grid ${isMobile ? "grid-cols-4" : "grid-cols-8"} gap-3 mb-8`}>
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => handleCardClick(card.id)}
            className={`aspect-square flex items-center justify-center rounded-2xl shadow-lg cursor-pointer transition-all duration-300 ${
              card.isMatched 
                ? isDarkMode 
                  ? "bg-green-500/20 border-2 border-green-500/40" 
                  : "bg-gradient-to-br from-green-200 to-emerald-300 border-2 border-green-400"
                : card.isFlipped 
                  ? isDarkMode 
                    ? "bg-amber-500 text-black scale-105" 
                    : "bg-gradient-to-br from-orange-400 to-red-500 text-white scale-105"
                  : isDarkMode 
                    ? "bg-white/5 hover:bg-white/10 hover:scale-105 hover:shadow-xl border-2 border-white/10" 
                    : "bg-white hover:scale-105 hover:shadow-xl border-2 border-gray-200"
            }`}
          >
            {card.isFlipped || card.isMatched ? (
              <div className="text-center">
                <div className={`${isMobile ? "text-2xl" : "text-4xl"} mb-1`}>{card.emoji}</div>
                <p className="text-xs font-semibold">{card.name}</p>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-3xl">☕</div>
                <p className={`text-xs transition-colors ${
                  isDarkMode ? 'text-white/40' : 'text-gray-500'
                }`}>?</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Game Completed Modal */}
      {gameCompleted && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-3xl p-8 max-w-md w-full shadow-2xl transition-colors ${
            isDarkMode ? 'bg-zinc-900 border border-white/10' : 'bg-white'
          }`}>
            <div className="text-center">
              <Award className={`w-14 h-14 mx-auto mb-4 ${isDarkMode ? 'text-amber-500' : 'text-amber-600'}`} strokeWidth={1.5} />
              <h2 className={`text-3xl font-bold mb-2 transition-colors ${
                isDarkMode ? 'text-white' : 'text-gray-800'
              }`}>{t('congratulations')}</h2>
              <p className={`mb-6 transition-colors ${
                isDarkMode ? 'text-white/60' : 'text-gray-600'
              }`}>{t('gameComplete')}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className={`p-4 rounded-xl transition-colors ${
                  isDarkMode ? 'bg-blue-500/10' : 'bg-blue-50'
                }`}>
                  <Zap className={`w-6 h-6 mx-auto mb-2 transition-colors ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`} />
                  <p className={`text-sm transition-colors ${
                    isDarkMode ? 'text-white/60' : 'text-gray-600'
                  }`}>{t('moves')}</p>
                  <p className={`text-2xl font-bold transition-colors ${
                    isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  }`}>{moves}</p>
                </div>
                <div className={`p-4 rounded-xl transition-colors ${
                  isDarkMode ? 'bg-purple-500/10' : 'bg-purple-50'
                }`}>
                  <Clock className={`w-6 h-6 mx-auto mb-2 transition-colors ${
                    isDarkMode ? 'text-purple-400' : 'text-purple-600'
                  }`} />
                  <p className={`text-sm transition-colors ${
                    isDarkMode ? 'text-white/60' : 'text-gray-600'
                  }`}>{t('time')}</p>
                  <p className={`text-2xl font-bold transition-colors ${
                    isDarkMode ? 'text-purple-400' : 'text-purple-600'
                  }`}>{formatTime(timeElapsed)}</p>
                </div>
              </div>

              <div className={`p-4 rounded-xl mb-6 transition-colors ${
                isDarkMode 
                  ? 'bg-amber-500/10' 
                  : 'bg-gradient-to-br from-amber-100 to-yellow-100'
              }`}>
                <Coffee className={`w-8 h-8 mx-auto mb-2 transition-colors ${
                  isDarkMode ? 'text-amber-400' : 'text-amber-600'
                }`} />
                <p className={`text-sm font-semibold transition-colors ${
                  isDarkMode ? 'text-amber-400' : 'text-amber-700'
                }`}>Coffee Beans Earned</p>
                <p className={`text-3xl font-bold transition-colors ${
                  isDarkMode ? 'text-amber-500' : 'text-amber-800'
                }`}>
                  +{!bestScore || moves < bestScore ? "100" : "50"}
                </p>
              </div>

              {bestScore && moves < bestScore && (
                <div className={`p-3 rounded-xl mb-6 transition-colors ${
                  isDarkMode ? 'bg-green-500/10' : 'bg-green-50'
                }`}>
                  <Trophy className={`w-6 h-6 mx-auto mb-1 transition-colors ${
                    isDarkMode ? 'text-green-400' : 'text-green-600'
                  }`} />
                  <p className={`font-semibold transition-colors ${
                    isDarkMode ? 'text-green-400' : 'text-green-700'
                  }`}>New Best Score!</p>
                </div>
              )}

              <button 
                onClick={initializeMemoryGame} 
                className={`w-full py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105 ${
                  isDarkMode 
                    ? 'bg-amber-500 text-black hover:bg-amber-400' 
                    : 'bg-gradient-to-br from-orange-500 to-red-500 text-white'
                }`}
              >
                {t('restart')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
