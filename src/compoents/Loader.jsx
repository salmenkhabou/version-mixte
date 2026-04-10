import { useEffect, useState } from "react"

export default function Loader({ onLoadComplete }) {
    const [progress, setProgress] = useState(0)
    const [isComplete, setIsComplete] = useState(false)

    useEffect(() => {
        // Simulate loading progress - slower for better UX
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval)
                    setIsComplete(true)
                    // Instant transition to next page
                    setTimeout(() => {
                        if (onLoadComplete) onLoadComplete()
                    }, 100)
                    return 100
                }
                return prev + Math.random() * 10
            })
        }, 150)

        return () => clearInterval(interval)
    }, [onLoadComplete])

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#2C1810] via-[#3D2415] to-[#1F0F08] transition-opacity duration-200 ${isComplete ? 'opacity-0' : 'opacity-100'}`}>
            {/* Animated background elements */}
            <div className="absolute inset-0 overflow-hidden">
                {/* Subtle grid */}
                <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
                
                {/* Animated gradient orbs */}
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-radial from-amber-600/20 to-transparent rounded-full blur-3xl animate-float-slow"></div>
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-gradient-radial from-orange-600/20 to-transparent rounded-full blur-3xl animate-float-slow-reverse"></div>
            </div>

            {/* Main content */}
            <div className={`relative z-10 w-full max-w-lg px-8 transition-opacity duration-200 ${isComplete ? 'opacity-0' : 'opacity-100'}`}>
                {/* Professional Coffee Logo */}
                <div className="mb-16 text-center">
                    <div className="inline-block relative">
                        {/* Outer rotating circle */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-40 h-40 animate-spin-slow" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    fill="none"
                                    stroke="url(#gradient1)"
                                    strokeWidth="0.5"
                                    strokeDasharray="8 4"
                                    opacity="0.4"
                                />
                                <defs>
                                    <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor="#F59E0B" />
                                        <stop offset="100%" stopColor="#F97316" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>

                        {/* Middle rotating ring */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <svg className="w-36 h-36 animate-spin-slow-reverse" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="40"
                                    fill="none"
                                    stroke="url(#gradient2)"
                                    strokeWidth="1"
                                    strokeDasharray="4 8"
                                    opacity="0.6"
                                />
                                <defs>
                                    <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
                                        <stop offset="0%" stopColor="#F97316" />
                                        <stop offset="100%" stopColor="#FB923C" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>

                        {/* Professional Coffee Cup SVG */}
                        <div className="relative w-40 h-40 flex items-center justify-center">
                            <svg className="w-20 h-20 drop-shadow-2xl" viewBox="0 0 64 64" fill="none">
                                {/* Cup body */}
                                <path
                                    d="M16 22C16 20.8954 16.8954 20 18 20H46C47.1046 20 48 20.8954 48 22V38C48 44.6274 42.6274 50 36 50H28C21.3726 50 16 44.6274 16 38V22Z"
                                    fill="url(#cupGradient)"
                                />
                                {/* Handle */}
                                <path
                                    d="M48 26H50C52.7614 26 55 28.2386 55 31V33C55 35.7614 52.7614 38 50 38H48"
                                    stroke="#D97706"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                                {/* Steam */}
                                <path
                                    d="M24 16C24 16 26 12 26 10C26 8 24 6 24 6"
                                    stroke="#FCD34D"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    opacity="0.8"
                                    className="animate-steam-1"
                                />
                                <path
                                    d="M32 14C32 14 34 10 34 8C34 6 32 4 32 4"
                                    stroke="#FCD34D"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    opacity="0.8"
                                    className="animate-steam-2"
                                />
                                <path
                                    d="M40 16C40 16 42 12 42 10C42 8 40 6 40 6"
                                    stroke="#FCD34D"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    opacity="0.8"
                                    className="animate-steam-3"
                                />
                                
                                <defs>
                                    <linearGradient id="cupGradient" x1="32" y1="20" x2="32" y2="50">
                                        <stop offset="0%" stopColor="#F59E0B" />
                                        <stop offset="50%" stopColor="#F97316" />
                                        <stop offset="100%" stopColor="#EA580C" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </div>
                </div>

                {/* Brand Name */}
                <div className="mb-12 text-center">
                    <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-orange-300 to-amber-200 mb-3 tracking-wide drop-shadow-lg">
                        COFFEE GAMES
                    </h1>
                    <div className="flex items-center justify-center gap-2 text-amber-400/60 text-sm tracking-widest">
                        <div className="w-8 h-px bg-gradient-to-r from-transparent to-amber-400/60"></div>
                        <span>ENTERTAINMENT PLATFORM</span>
                        <div className="w-8 h-px bg-gradient-to-l from-transparent to-amber-400/60"></div>
                    </div>
                </div>

                {/* Progress section */}
                <div className="space-y-5">
                    {/* Progress bar container */}
                    <div className="relative">
                        {/* Glow effect */}
                        <div className="absolute inset-0 blur-sm">
                            <div 
                                className="h-2 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent rounded-full transition-all duration-300"
                                style={{ width: `${progress}%`, marginLeft: '0' }}
                            ></div>
                        </div>
                        
                        {/* Main progress bar */}
                        <div className="relative h-2 bg-gradient-to-r from-amber-950/40 to-orange-950/40 rounded-full overflow-hidden backdrop-blur-sm border border-amber-900/30">
                            <div 
                                className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 rounded-full transition-all duration-300 ease-out relative shadow-lg"
                                style={{ width: `${progress}%` }}
                            >
                                {/* Animated shine effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer-fast"></div>
                                
                                {/* End glow */}
                                <div className="absolute right-0 top-0 w-8 h-full bg-gradient-to-l from-white/60 to-transparent"></div>
                            </div>
                        </div>
                    </div>

                    {/* Progress info */}
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-3">
                            {!isComplete ? (
                                <>
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></div>
                                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse delay-100"></div>
                                        <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse delay-200"></div>
                                    </div>
                                    <span className="text-amber-300/90 text-sm font-medium tracking-wide">
                                        {progress < 25 && "INITIALIZING SYSTEM"}
                                        {progress >= 25 && progress < 50 && "LOADING RESOURCES"}
                                        {progress >= 50 && progress < 75 && "PREPARING INTERFACE"}
                                        {progress >= 75 && progress < 100 && "FINALIZING"}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center animate-scale-in">
                                        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="text-green-400 text-sm font-medium tracking-wide animate-fade-in">
                                        COMPLETE
                                    </span>
                                </>
                            )}
                        </div>
                        <span className="text-white font-bold text-lg tabular-nums tracking-wider">
                            {Math.round(progress)}%
                        </span>
                    </div>
                </div>

                {/* Footer */}
                <div className="mt-20 text-center space-y-3">
                    <div className="flex items-center justify-center gap-2 text-amber-700/50 text-xs tracking-widest">
                        <span>POWERED BY</span>
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">REACT</span>
                            <span>•</span>
                            <span className="font-semibold">VITE</span>
                        </div>
                    </div>
                    <div className="text-amber-800/40 text-xs">
                        © 2025 Coffee Games. All rights reserved.
                    </div>
                </div>
            </div>
        </div>
    )
}
