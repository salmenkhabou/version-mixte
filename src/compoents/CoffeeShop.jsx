import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  Coffee,
  Heart,
  ShoppingCart,
  User,
  Star,
  Clock,
  Flame,
  Sparkles,
  Award,
  TrendingUp,
  ChevronRight,
  Play,
  Gamepad2,
  Instagram,
  Twitter,
  Facebook,
  Sun,
  Moon,
} from 'lucide-react';
import CoffeeMemoryGame from './game/CoffeeMemoryGame';
import { useMobile } from './use-mobile';

export default function Component() {
  const isMobile = useMobile();
  const [currentView, setCurrentView] = useState('shop');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    // Load favorites from localStorage on init
    try {
      const saved = localStorage.getItem('coffeeFavorites');
      return saved ? JSON.parse(saved) : [];
    } catch (err) {
      console.error('Error loading favorites:', err);
      return [];
    }
  });
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Apply theme to document
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Save favorites to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('coffeeFavorites', JSON.stringify(favorites));
    } catch (err) {
      console.error('Error saving favorites:', err);
    }
  }, [favorites]);

  const toggleFavorite = (id) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const clearAllFavorites = () => {
    if (confirm('هل تريد حذف جميع المفضلة؟')) {
      setFavorites([]);
      localStorage.removeItem('coffeeFavorites');
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const launchARExperience = async (coffeeId) => {
    const sharedData = window.AR_SHARED_DATA || {};
    const fallbackMap = {
      1: 'coffee',
      2: 'latte',
      3: 'coffee',
      4: 'latte',
      5: 'latte',
      6: 'coffee',
      7: 'latte',
      8: 'coffee',
    };
    const coffeeToDishMap = sharedData.coffeeToDishMap || fallbackMap;
    const defaultDishId = sharedData.defaultDishId || 'coffee';
    const selectedDish = coffeeToDishMap[coffeeId] || defaultDishId;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera not supported on this browser.');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
    } catch (error) {
      alert('Camera permission is required to start AR.');
      return;
    }

    localStorage.setItem('selectedDish', selectedDish);
    window.location.href = '/ar/ar.html';
  };

  const coffeeItems = [
    {
      id: 1,
      name: 'Velvet Cappuccino',
      subtitle: 'Dark Chocolate & Vanilla Bean',
      description: 'Luxurious espresso blend with velvety steamed milk, artisan dark chocolate, and Madagascar vanilla',
      price: 20.0,
      originalPrice: null,
      rating: 4.9,
      reviews: 1247,
      image: 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=800&h=600&fit=crop&q=90',
      isPopular: true,
      isTrending: true,
      isNew: false,
      calories: 180,
      prepTime: '4 min',
      badge: '🔥 Trending',
      tags: ['Signature', 'Sweet', 'Creamy'],
    },
    {
      id: 2,
      name: 'Golden Oat Latte',
      subtitle: 'Turmeric & Honey Infusion',
      description: 'Creamy oat milk latte with golden turmeric, raw honey, and a hint of cinnamon',
      price: 18.0,
      originalPrice: null,
      rating: 4.8,
      reviews: 892,
      image: 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=800&h=600&fit=crop&q=90',
      isPopular: false,
      isTrending: false,
      isNew: true,
      calories: 150,
      prepTime: '3 min',
      badge: '✨ New',
      tags: ['Vegan', 'Healthy', 'Unique'],
    },
    {
      id: 3,
      name: 'Midnight Espresso',
      subtitle: 'Single Origin Ethiopian',
      description: 'Intense double shot from Ethiopian highlands with notes of dark chocolate and wild berries',
      price: 13.0,
      originalPrice: null,
      rating: 5.0,
      reviews: 2156,
      image: 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?w=800&h=600&fit=crop&q=90',
      isPopular: true,
      isTrending: false,
      isNew: false,
      calories: 5,
      prepTime: '2 min',
      badge: '⭐ Top Rated',
      tags: ['Strong', 'Bold', 'Premium'],
    },
    {
      id: 4,
      name: 'Cloud Nine Latte',
      subtitle: 'Brown Butter & Sea Salt Caramel',
      description: 'Silky smooth latte with house-made brown butter caramel and Himalayan pink salt',
      price: 21.5,
      originalPrice: 23.5,
      rating: 4.9,
      reviews: 1543,
      image: 'https://images.unsplash.com/photo-1534778101976-62847782c213?w=800&h=600&fit=crop&q=90',
      isPopular: true,
      isTrending: true,
      isNew: false,
      calories: 220,
      prepTime: '5 min',
      badge: '🏆 Award Winner',
      tags: ['Signature', 'Sweet', 'Artisan'],
    },
    {
      id: 5,
      name: 'Rose Garden Latte',
      subtitle: 'Rose Petals & White Chocolate',
      description: 'Delicate latte infused with organic rose petals and creamy Belgian white chocolate',
      price: 22.5,
      originalPrice: null,
      rating: 4.7,
      reviews: 678,
      image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&h=600&fit=crop&q=90',
      isPopular: false,
      isTrending: true,
      isNew: true,
      calories: 195,
      prepTime: '4 min',
      badge: '💐 Limited Edition',
      tags: ['Floral', 'Sweet', 'Instagram-Worthy'],
    },
    {
      id: 6,
      name: 'Midnight Mocha',
      subtitle: 'Dark Chocolate & Espresso Fusion',
      description: 'Decadent mocha with 70% dark chocolate, double espresso, and hand-whipped vanilla cream',
      price: 21.0,
      originalPrice: 24.0,
      rating: 4.9,
      reviews: 1891,
      image: 'https://images.unsplash.com/photo-1578374173705-0cae7ebaf74e?w=800&h=600&fit=crop&q=90',
      isPopular: true,
      isTrending: false,
      isNew: false,
      calories: 280,
      prepTime: '5 min',
      badge: '💎 Premium',
      tags: ['Rich', 'Chocolate', 'Indulgent'],
    },
    {
      id: 7,
      name: 'Matcha Cloud',
      subtitle: 'Japanese Ceremonial Grade',
      description: 'Premium ceremonial matcha with oat milk foam and a touch of agave',
      price: 19.0,
      originalPrice: null,
      rating: 4.8,
      reviews: 756,
      image: 'https://images.unsplash.com/photo-1569825201748-e15f8c4f3adf?w=800&h=600&fit=crop&q=90',
      isPopular: false,
      isTrending: true,
      isNew: true,
      calories: 120,
      prepTime: '3 min',
      badge: '🍃 Wellness',
      tags: ['Healthy', 'Energizing', 'Vegan'],
    },
    {
      id: 8,
      name: 'Iced Caramel Macchiato',
      subtitle: 'Cold Foam Perfection',
      description: 'Layered iced espresso with vanilla, caramel drizzle, and cold foam',
      price: 18.5,
      originalPrice: null,
      rating: 4.7,
      reviews: 1123,
      image: 'https://images.unsplash.com/photo-1517487881594-2787fef5ebf7?w=800&h=600&fit=crop&q=90',
      isPopular: true,
      isTrending: false,
      isNew: false,
      calories: 210,
      prepTime: '4 min',
      badge: '❄️ Refreshing',
      tags: ['Iced', 'Sweet', 'Popular'],
    },
  ];

  const categories = [
    { name: 'All', icon: '☕', count: 8 },
    { name: 'Trending', icon: '🔥', count: 4 },
    { name: 'New', icon: '✨', count: 3 },
    { name: 'Premium', icon: '💎', count: 3 },
    { name: 'Iced', icon: '❄️', count: 1 },
  ];

  return (
    <div className='w-full min-h-screen bg-[var(--bg-primary)] transition-colors duration-300'>
      {/* Enhanced Navbar - Desktop Only */}
      {!isMobile && (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          scrolled 
            ? 'bg-[var(--overlay-bg)] backdrop-blur-xl border-b border-[var(--border-color)] py-4' 
            : 'backdrop-blur-md py-6'
        } ${isDarkMode ? 'bg-black/50' : 'bg-white/50'}`}>
          <div className='max-w-[1400px] mx-auto px-6 sm:px-12 lg:px-16'>
            <div className='flex items-center justify-between'>
              
              {/* Logo - Enhanced */}
              <div className='flex items-center gap-4 cursor-pointer group'>
                <div className='relative'>
                  <Coffee size={28} className='text-amber-500 group-hover:rotate-12 transition-transform duration-500' strokeWidth={1.5} />
                  <div className='absolute inset-0 bg-amber-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500'></div>
                </div>
                <div>
                  <h1 className='text-2xl lg:text-3xl font-light text-[var(--text-primary)] tracking-[0.25em] group-hover:text-amber-500 transition-colors duration-500'>
                    BREW
                  </h1>
                  <p className='text-[9px] text-[var(--text-tertiary)] tracking-[0.3em] uppercase font-light mt-0.5'>
                    Artisan Coffee
                  </p>
                </div>
              </div>

              {/* Desktop Navigation - Enhanced */}
              <div className='hidden lg:flex items-center gap-16'>
                <button
                  onClick={() => setCurrentView('shop')}
                  className={`group text-xs tracking-[0.25em] transition-all duration-500 relative font-light uppercase ${
                    currentView === 'shop'
                      ? isDarkMode ? 'text-white' : 'text-black'
                      : isDarkMode ? 'text-white/40 hover:text-white/80' : 'text-black/40 hover:text-black/80'
                  }`}
                >
                  Menu
                  <span className={`absolute -bottom-2 left-0 h-px bg-amber-500 transition-all duration-500 ${
                    currentView === 'shop' ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </button>
                <button
                  onClick={() => setCurrentView('game')}
                  className={`group text-xs tracking-[0.25em] transition-all duration-500 relative font-light uppercase ${
                    currentView === 'game'
                      ? isDarkMode ? 'text-white' : 'text-black'
                      : isDarkMode ? 'text-white/40 hover:text-white/80' : 'text-black/40 hover:text-black/80'
                  }`}
                >
                  Games
                  <span className={`absolute -bottom-2 left-0 h-px bg-amber-500 transition-all duration-500 ${
                    currentView === 'game' ? 'w-full' : 'w-0 group-hover:w-full'
                  }`}></span>
                </button>
                <button
                  onClick={() => launchARExperience(3)}
                  className={`group text-xs tracking-[0.25em] transition-all duration-500 relative font-light uppercase ${
                    isDarkMode ? 'text-white/40 hover:text-white/80' : 'text-black/40 hover:text-black/80'
                  }`}
                >
                  AR
                  <span className='absolute -bottom-2 left-0 w-0 h-px bg-amber-500 transition-all duration-500 group-hover:w-full'></span>
                </button>
                <button className={`group text-xs tracking-[0.25em] transition-all duration-500 relative font-light uppercase ${
                  isDarkMode ? 'text-white/40 hover:text-white/80' : 'text-black/40 hover:text-black/80'
                }`}>
                  About
                  <span className='absolute -bottom-2 left-0 w-0 h-px bg-amber-500 transition-all duration-500 group-hover:w-full'></span>
                </button>
                <button className={`group text-xs tracking-[0.25em] transition-all duration-500 relative font-light uppercase ${
                  isDarkMode ? 'text-white/40 hover:text-white/80' : 'text-black/40 hover:text-black/80'
                }`}>
                  Contact
                  <span className='absolute -bottom-2 left-0 w-0 h-px bg-amber-500 transition-all duration-500 group-hover:w-full'></span>
                </button>
              </div>

              {/* Right Actions - Enhanced */}
              <div className='flex items-center gap-8'>
                {/* Theme Toggle */}
                <button 
                  onClick={toggleTheme}
                  className='relative group p-2 hover:bg-white/5 rounded-full transition-all duration-300'
                  aria-label='Toggle theme'
                >
                  {isDarkMode ? (
                    <Sun size={20} strokeWidth={1.5} className='text-white/60 group-hover:text-amber-500 transition-colors duration-300' />
                  ) : (
                    <Moon size={20} strokeWidth={1.5} className='text-gray-600 group-hover:text-amber-600 transition-colors duration-300' />
                  )}
                </button>
                
                <button 
                  onClick={() => setCurrentView('favorites')}
                  className='relative group'
                >
                  <Heart
                    size={20}
                    strokeWidth={1.5}
                    className={`transition-all duration-300 ${
                      currentView === 'favorites'
                        ? 'text-amber-500 fill-amber-500'
                        : favorites.length > 0
                          ? 'text-red-500 fill-red-500 group-hover:scale-110'
                          : isDarkMode 
                            ? 'text-white/60 group-hover:text-amber-500 group-hover:fill-amber-500' 
                            : 'text-black/60 group-hover:text-amber-600 group-hover:fill-amber-600'
                    }`}
                  />
                  {favorites.length > 0 && (
                    <span className='absolute -top-2 -right-2 w-4 h-4 bg-amber-500 text-black text-[9px] font-medium rounded-full flex items-center justify-center'>
                      {favorites.length}
                    </span>
                  )}
                </button>
                <button className='relative group'>
                  <ShoppingCart
                    size={20}
                    strokeWidth={1.5}
                    className={`transition-colors duration-300 ${
                      isDarkMode 
                        ? 'text-white/60 group-hover:text-amber-500' 
                        : 'text-black/60 group-hover:text-amber-600'
                    }`}
                  />
                  <span className='absolute -top-2 -right-2 w-4 h-4 bg-amber-500 text-black text-[9px] font-medium rounded-full flex items-center justify-center'>
                    0
                  </span>
                </button>
                
                <div className={`h-6 w-px transition-colors ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}></div>
                <button className={`group relative overflow-hidden bg-transparent border px-8 py-2.5 text-xs tracking-[0.25em] transition-colors duration-500 font-light uppercase ${
                  isDarkMode 
                    ? 'border-amber-500/50 text-amber-500 hover:text-black' 
                    : 'border-amber-600/50 text-amber-600 hover:text-white'
                }`}>
                  <span className='relative z-10'>Sign In</span>
                  <div className={`absolute inset-0 transform -translate-y-full group-hover:translate-y-0 transition-transform duration-500 ${
                    isDarkMode ? 'bg-amber-500' : 'bg-amber-600'
                  }`}></div>
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Mobile Top Bar - Minimal */}
      {isMobile && (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isDarkMode ? 'bg-black/80' : 'bg-white/80'
        } backdrop-blur-xl border-b ${isDarkMode ? 'border-white/10' : 'border-black/10'} py-4`}>
          <div className='px-6 flex items-center justify-between'>
            {/* Logo */}
            <div className='flex items-center gap-3'>
              <Coffee size={24} className='text-amber-500' strokeWidth={1.5} />
              <h1 className={`text-xl font-light tracking-[0.25em] ${isDarkMode ? 'text-white' : 'text-black'}`}>
                BREW
              </h1>
            </div>
            
            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className='p-2 rounded-full transition-all duration-300'
              aria-label='Toggle theme'
            >
              {isDarkMode ? (
                <Sun size={20} strokeWidth={1.5} className='text-white/60' />
              ) : (
                <Moon size={20} strokeWidth={1.5} className='text-gray-600' />
              )}
            </button>
          </div>
        </nav>
      )}

      {/* Bottom Navigation Bar - Mobile Only */}
      {isMobile && (
        <nav className={`fixed bottom-0 left-0 right-0 z-50 transition-colors duration-300 ${
          isDarkMode ? 'bg-black/95' : 'bg-white/95'
        } backdrop-blur-xl border-t ${isDarkMode ? 'border-white/10' : 'border-black/10'} pb-safe`}>
          <div className='flex items-center justify-around px-4 py-3'>
            {/* Menu/Shop */}
            <button
              onClick={() => setCurrentView('shop')}
              className='flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300'
            >
              <div className={`relative ${currentView === 'shop' ? 'scale-110' : ''}`}>
                <Coffee 
                  size={24} 
                  strokeWidth={1.5}
                  className={`transition-colors duration-300 ${
                    currentView === 'shop'
                      ? 'text-amber-500'
                      : isDarkMode ? 'text-white/40' : 'text-black/40'
                  }`}
                />
                {currentView === 'shop' && (
                  <div className='absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full'></div>
                )}
              </div>
              <span className={`text-[10px] font-light tracking-wider transition-colors duration-300 ${
                currentView === 'shop'
                  ? 'text-amber-500'
                  : isDarkMode ? 'text-white/40' : 'text-black/40'
              }`}>
                MENU
              </span>
            </button>

            {/* Games */}
            <button
              onClick={() => setCurrentView('game')}
              className='flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300'
            >
              <div className={`relative ${currentView === 'game' ? 'scale-110' : ''}`}>
                <Gamepad2 
                  size={24} 
                  strokeWidth={1.5}
                  className={`transition-colors duration-300 ${
                    currentView === 'game'
                      ? 'text-amber-500'
                      : isDarkMode ? 'text-white/40' : 'text-black/40'
                  }`}
                />
                {currentView === 'game' && (
                  <div className='absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full'></div>
                )}
              </div>
              <span className={`text-[10px] font-light tracking-wider transition-colors duration-300 ${
                currentView === 'game'
                  ? 'text-amber-500'
                  : isDarkMode ? 'text-white/40' : 'text-black/40'
              }`}>
                GAMES
              </span>
            </button>

            {/* AR */}
            <button
              onClick={() => launchARExperience(3)}
              className='flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300'
            >
              <Play
                size={24}
                strokeWidth={1.5}
                className={`transition-colors duration-300 ${
                  isDarkMode ? 'text-white/40 hover:text-amber-500' : 'text-black/40 hover:text-amber-600'
                }`}
              />
              <span className={`text-[10px] font-light tracking-wider ${
                isDarkMode ? 'text-white/40' : 'text-black/40'
              }`}>
                AR
              </span>
            </button>

            {/* Favorites */}
            <button 
              onClick={() => setCurrentView('favorites')}
              className='flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300'
            >
              <div className={`relative ${currentView === 'favorites' ? 'scale-110' : ''}`}>
                <Heart 
                  size={24} 
                  strokeWidth={1.5}
                  className={`transition-colors duration-300 ${
                    currentView === 'favorites'
                      ? 'text-amber-500 fill-amber-500'
                      : favorites.length > 0 
                        ? 'text-red-500 fill-red-500' 
                        : isDarkMode ? 'text-white/40' : 'text-black/40'
                  }`}
                />
                {favorites.length > 0 && (
                  <span className='absolute top-0 right-3 w-4 h-4 bg-amber-500 text-black text-[9px] font-medium rounded-full flex items-center justify-center'>
                    {favorites.length}
                  </span>
                )}
                {currentView === 'favorites' && (
                  <div className='absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full'></div>
                )}
              </div>
              <span className={`text-[10px] font-light tracking-wider ${
                currentView === 'favorites'
                  ? 'text-amber-500'
                  : isDarkMode ? 'text-white/40' : 'text-black/40'
              }`}>
                SAVED
              </span>
            </button>

            {/* Cart */}
            <button className='flex flex-col items-center gap-1 min-w-[60px] relative'>
              <ShoppingCart 
                size={24} 
                strokeWidth={1.5}
                className={`transition-colors duration-300 ${
                  isDarkMode ? 'text-white/40' : 'text-black/40'
                }`}
              />
              <span className='absolute top-0 right-3 w-4 h-4 bg-amber-500 text-black text-[9px] font-medium rounded-full flex items-center justify-center'>
                0
              </span>
              <span className={`text-[10px] font-light tracking-wider ${
                isDarkMode ? 'text-white/40' : 'text-black/40'
              }`}>
                CART
              </span>
            </button>

            {/* Profile/Sign In */}
            <button className='flex flex-col items-center gap-1 min-w-[60px]'>
              <User 
                size={24} 
                strokeWidth={1.5}
                className={`transition-colors duration-300 ${
                  isDarkMode ? 'text-white/40' : 'text-black/40'
                }`}
              />
              <span className={`text-[10px] font-light tracking-wider ${
                isDarkMode ? 'text-white/40' : 'text-black/40'
              }`}>
                PROFILE
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* Mobile Menu Overlay - Enhanced */}
      {isMobile && menuOpen && (
        <div
          className={`fixed inset-0 z-40 backdrop-blur-xl animate-fadeIn ${isDarkMode ? 'bg-black/95' : 'bg-white/95'}`}
          onClick={() => setMenuOpen(false)}
        >
          <div
            className={`absolute right-0 top-0 h-full w-full max-w-sm border-l p-8 transform transition-transform duration-500 ease-out ${
              isDarkMode 
                ? 'bg-gradient-to-br from-black via-black to-amber-950/20 border-amber-500/20' 
                : 'bg-gradient-to-br from-white via-gray-50 to-amber-50/50 border-amber-300/30'
            }`}
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'slideInRight 0.5s ease-out' }}
          >
            <div className='flex flex-col gap-10 mt-24'>
              {/* Theme Toggle in Mobile Menu */}
              <button
                onClick={toggleTheme}
                className='flex items-center gap-4 text-left group'
              >
                {isDarkMode ? (
                  <>
                    <Sun size={24} className='text-amber-500' strokeWidth={1.5} />
                    <span className={`text-lg tracking-wide ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>Light Mode</span>
                  </>
                ) : (
                  <>
                    <Moon size={24} className='text-amber-600' strokeWidth={1.5} />
                    <span className={`text-lg tracking-wide ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>Dark Mode</span>
                  </>
                )}
              </button>

              <div className={`h-px my-2 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}></div>

              <button
                onClick={() => {
                  setCurrentView('shop');
                  setMenuOpen(false);
                }}
                className={`text-3xl font-light tracking-wider transition-all text-left group ${
                  currentView === 'shop'
                    ? 'text-amber-500'
                    : isDarkMode ? 'text-white/60' : 'text-black/60'
                }`}
              >
                MENU
                <div className={`h-px mt-2 transition-all duration-300 ${
                  currentView === 'shop' ? 'w-20 bg-amber-500' : isDarkMode ? 'w-0 bg-white/20 group-hover:w-12' : 'w-0 bg-black/20 group-hover:w-12'
                }`}></div>
              </button>
              <button
                onClick={() => {
                  setCurrentView('game');
                  setMenuOpen(false);
                }}
                className={`text-3xl font-light tracking-wider transition-all text-left group ${
                  currentView === 'game'
                    ? 'text-amber-500'
                    : isDarkMode ? 'text-white/60' : 'text-black/60'
                }`}
              >
                GAMES
                <div className={`h-px mt-2 transition-all duration-300 ${
                  currentView === 'game' ? 'w-20 bg-amber-500' : isDarkMode ? 'w-0 bg-white/20 group-hover:w-12' : 'w-0 bg-black/20 group-hover:w-12'
                }`}></div>
              </button>
              <button
                onClick={() => {
                  launchARExperience(3);
                  setMenuOpen(false);
                }}
                className={`text-3xl font-light tracking-wider transition-all text-left group ${
                  isDarkMode ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'
                }`}
              >
                AR EXPERIENCE
                <div className={`h-px mt-2 transition-all duration-300 ${
                  isDarkMode ? 'w-0 bg-white/20 group-hover:w-12' : 'w-0 bg-black/20 group-hover:w-12'
                }`}></div>
              </button>

              <div className={`h-px my-6 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}></div>

              <button 
                onClick={() => {
                  setCurrentView('favorites');
                  setMenuOpen(false);
                }}
                className={`flex items-center gap-4 transition-colors group ${
                  currentView === 'favorites'
                    ? 'text-amber-500'
                    : isDarkMode ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'
                }`}
              >
                <Heart size={22} strokeWidth={1.5} className={`transition-colors ${
                  currentView === 'favorites' ? 'text-amber-500 fill-amber-500' : 'group-hover:text-amber-500'
                }`} />
                <span className='text-base tracking-wider'>FAVORITES ({favorites.length})</span>
              </button>
              <button className={`flex items-center gap-4 transition-colors group ${isDarkMode ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'}`}>
                <ShoppingCart size={22} strokeWidth={1.5} className='group-hover:text-amber-500 transition-colors' />
                <span className='text-base tracking-wider'>CART (0)</span>
              </button>
              
              <button className={`mt-10 px-10 py-4 text-sm font-medium tracking-wider transition-all duration-300 ${
                isDarkMode ? 'bg-amber-500 text-black hover:bg-white' : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}>
                SIGN IN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      {currentView === 'shop' ? (
        <ShopContent
          isMobile={isMobile}
          coffeeItems={coffeeItems}
          categories={categories}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          isDarkMode={isDarkMode}
          onLaunchAR={launchARExperience}
        />
      ) : currentView === 'favorites' ? (
        <FavoritesContent
          isMobile={isMobile}
          coffeeItems={coffeeItems}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
          clearAllFavorites={clearAllFavorites}
          isDarkMode={isDarkMode}
        />
      ) : (
        <GameContent isMobile={isMobile} isDarkMode={isDarkMode} />
      )}
    </div>
  );
}

function FavoritesContent({ isMobile, coffeeItems, favorites, toggleFavorite, clearAllFavorites, isDarkMode }) {
  const favoritedItems = coffeeItems.filter(item => favorites.includes(item.id));

  return (
    <div className='w-full min-h-screen bg-[var(--bg-primary)] overflow-x-hidden transition-colors duration-300'>
      <div className='w-full pt-32 sm:pt-36 lg:pt-40 pb-16 sm:pb-24 lg:pb-40'>
        <div className='max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16'>
          
          {/* Header */}
          <div className='mb-16 sm:mb-20 lg:mb-24'>
            <div className='max-w-5xl mx-auto text-center'>
              
              {/* Overline */}
              <div className='mb-8 sm:mb-10 lg:mb-12'>
                <div className='inline-flex items-center gap-3 sm:gap-4'>
                  <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
                  <span className='text-amber-500 text-[9px] sm:text-[10px] tracking-[0.5em] font-light uppercase'>
                    Your Collection
                  </span>
                  <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
                </div>
              </div>

              {/* Title */}
              <h1 className='text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-light tracking-[-0.02em] mb-6 sm:mb-8 text-[var(--text-primary)]'>
                MY <span className='font-serif italic text-amber-500'>Favorites</span>
              </h1>

              {/* Subtitle */}
              <p className='text-sm sm:text-base lg:text-lg text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed'>
                {favoritedItems.length > 0 
                  ? `${favoritedItems.length} coffee${favoritedItems.length > 1 ? 's' : ''} saved for your next indulgence`
                  : 'Start building your perfect coffee collection'
                }
              </p>

              {/* Clear All Button */}
              {favoritedItems.length > 0 && (
                <div className='mt-8 sm:mt-10'>
                  <button
                    onClick={clearAllFavorites}
                    className={`group px-6 sm:px-8 py-3 sm:py-4 text-xs sm:text-sm font-medium tracking-wider transition-all duration-300 border ${
                      isDarkMode
                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500'
                        : 'border-red-600/30 text-red-600 hover:bg-red-50 hover:border-red-600'
                    }`}
                  >
                    <span className='flex items-center gap-2'>
                      <X size={16} />
                      CLEAR ALL FAVORITES
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Favorites Grid or Empty State */}
          {favoritedItems.length === 0 ? (
            // Empty State
            <div className='max-w-2xl mx-auto text-center py-20 sm:py-32'>
              <div className='mb-8 sm:mb-10'>
                <div className='inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-amber-500/10 mb-6 sm:mb-8'>
                  <Heart size={isMobile ? 40 : 48} strokeWidth={1.5} className='text-amber-500' />
                </div>
                <h2 className='text-2xl sm:text-3xl lg:text-4xl font-light mb-4 sm:mb-6 text-[var(--text-primary)]'>
                  No Favorites Yet
                </h2>
                <p className='text-sm sm:text-base lg:text-lg text-[var(--text-secondary)] leading-relaxed mb-8 sm:mb-10'>
                  Tap the heart icon on any coffee to save it here for quick access
                </p>
              </div>
            </div>
          ) : (
            // Favorites Grid
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-10'>
              {favoritedItems.map((item) => (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden transition-all duration-500 hover:scale-[1.02] ${
                    isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
                  }`}
                >
                  {/* Image */}
                  <div className='relative aspect-[4/3] overflow-hidden'>
                    <img
                      src={item.image}
                      alt={item.name}
                      className='w-full h-full object-cover transition-transform duration-700 group-hover:scale-110'
                    />
                    <div className={`absolute inset-0 bg-gradient-to-t ${
                      isDarkMode ? 'from-black/80 via-black/20 to-transparent' : 'from-white/80 via-white/20 to-transparent'
                    }`}></div>
                    
                    {/* Badge */}
                    {item.badge && (
                      <div className='absolute top-4 left-4 px-3 py-1.5 text-[10px] tracking-wider font-medium bg-amber-500 text-black backdrop-blur-sm'>
                        {item.badge}
                      </div>
                    )}
                    
                    {/* Favorite Button */}
                    <button
                      onClick={() => toggleFavorite(item.id)}
                      className='absolute top-4 right-4 w-10 h-10 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center transition-all duration-300 hover:bg-black/60 hover:scale-110'
                    >
                      <Heart
                        size={18}
                        strokeWidth={1.5}
                        className='text-red-500 fill-red-500 transition-all duration-300'
                      />
                    </button>
                  </div>

                  {/* Content */}
                  <div className='p-6 sm:p-8'>
                    <div className='mb-4'>
                      <h3 className='text-lg sm:text-xl font-light tracking-wide mb-2 text-[var(--text-primary)]'>
                        {item.name}
                      </h3>
                      <p className='text-xs sm:text-sm text-amber-500 font-light tracking-wide'>
                        {item.subtitle}
                      </p>
                    </div>

                    <p className='text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-6'>
                      {item.description}
                    </p>

                    {/* Meta Info */}
                    <div className='flex items-center justify-between mb-6'>
                      <div className='flex items-center gap-4 text-xs text-[var(--text-secondary)]'>
                        <div className='flex items-center gap-1.5'>
                          <Star size={14} className='text-amber-500 fill-amber-500' />
                          <span>{item.rating}</span>
                        </div>
                        <div className='flex items-center gap-1.5'>
                          <Clock size={14} />
                          <span>{item.prepTime}</span>
                        </div>
                      </div>
                      <div className='text-xs text-[var(--text-secondary)]'>
                        {item.calories} cal
                      </div>
                    </div>

                    {/* Price & Add Button */}
                    <div className='flex items-center justify-between'>
                      <div>
                        <div className='text-2xl sm:text-3xl font-light tracking-tight text-[var(--text-primary)]'>
                          {item.price.toFixed(1)} <span className='text-base sm:text-lg text-amber-500'>DT</span>
                        </div>
                        {item.originalPrice && (
                          <div className='text-xs text-[var(--text-secondary)] line-through mt-1'>
                            {item.originalPrice.toFixed(1)} DT
                          </div>
                        )}
                      </div>
                      <button className={`px-6 py-3 text-xs font-medium tracking-wider transition-all duration-300 ${
                        isDarkMode
                          ? 'bg-amber-500 text-black hover:bg-white'
                          : 'bg-amber-600 text-white hover:bg-amber-700'
                      }`}>
                        ADD
                      </button>
                    </div>

                    {/* Tags */}
                    <div className='flex flex-wrap gap-2 mt-6'>
                      {item.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className='px-3 py-1 text-[9px] tracking-widest font-light bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ShopContent({ isMobile, coffeeItems, categories, favorites, toggleFavorite, isDarkMode, onLaunchAR }) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [hoveredCard, setHoveredCard] = useState(null);

  const filteredItems = selectedCategory === 'All'
    ? coffeeItems
    : coffeeItems.filter((item) => {
        if (selectedCategory === 'Trending') return item.isTrending;
        if (selectedCategory === 'New') return item.isNew;
        if (selectedCategory === 'Premium') return item.price > 20;
        if (selectedCategory === 'Iced') return item.name.toLowerCase().includes('iced');
        return true;
      });

  return (
    <div className='w-full min-h-screen bg-[var(--bg-primary)] overflow-x-hidden transition-colors duration-300'>
      <div className='w-full pt-32 sm:pt-36 lg:pt-40 pb-16 sm:pb-24 lg:pb-40'>
        <div className='max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16'>
        
          {/* Hero Section - Centered & Responsive */}
          <section className='mb-32 sm:mb-40 lg:mb-48 xl:mb-56'>
            <div className='max-w-5xl mx-auto text-center'>
            
              {/* Overline */}
              <div className='mb-8 sm:mb-10 lg:mb-12'>
                <div className='inline-flex items-center gap-3 sm:gap-4'>
                  <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
                  <span className='text-amber-500 text-[9px] sm:text-[10px] tracking-[0.5em] font-light uppercase'>
                    Premium Coffee
                  </span>
                  <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
                </div>
              </div>

              {/* Main Headline */}
              <div className='mb-12 sm:mb-16 lg:mb-20'>
                <h1 className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-[10rem] font-extralight leading-[0.9] tracking-tighter transition-colors ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}>
                  Exceptional
                  <br />
                  <span className='text-amber-500'>Coffee</span>
                </h1>
              </div>
              
              {/* Description */}
              <div className='mb-16 sm:mb-20 lg:mb-24'>
                <p className={`text-base sm:text-lg md:text-xl lg:text-2xl font-light leading-relaxed max-w-3xl mx-auto mb-4 sm:mb-6 px-4 transition-colors ${
                  isDarkMode ? 'text-white/50' : 'text-black/60'
                }`}>
                  Meticulously sourced. Expertly roasted. Perfectly brewed.
                </p>
                <p className={`text-sm sm:text-base md:text-lg lg:text-xl font-light leading-relaxed max-w-3xl mx-auto px-4 transition-colors ${
                  isDarkMode ? 'text-white/30' : 'text-black/40'
                }`}>
                  Experience the art of coffee craftsmanship.
                </p>
              </div>
              
              {/* CTA */}
              <div className='flex flex-col sm:flex-row justify-center gap-4 px-4'>
                <button className={`group relative px-10 sm:px-14 lg:px-16 py-4 sm:py-5 lg:py-6 text-xs sm:text-sm tracking-[0.3em] transition-all duration-500 font-medium uppercase overflow-hidden w-full sm:w-auto ${
                  isDarkMode ? 'bg-amber-500 text-black hover:bg-white' : 'bg-amber-600 text-white hover:bg-amber-700'
                }`}>
                  <span className='relative z-10 flex items-center justify-center gap-3'>
                    Explore Collection
                    <ChevronRight size={18} className='group-hover:translate-x-2 transition-transform duration-500' />
                  </span>
                </button>
                <button
                  onClick={() => onLaunchAR(3)}
                  className={`group relative px-10 sm:px-14 lg:px-16 py-4 sm:py-5 lg:py-6 text-xs sm:text-sm tracking-[0.3em] transition-all duration-500 font-medium uppercase overflow-hidden w-full sm:w-auto border ${
                    isDarkMode
                      ? 'border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-black'
                      : 'border-amber-600/50 text-amber-700 hover:bg-amber-600 hover:text-white'
                  }`}
                >
                  <span className='relative z-10 flex items-center justify-center gap-3'>
                    View in AR
                    <Play size={16} className='group-hover:scale-110 transition-transform duration-300' />
                  </span>
                </button>
              </div>
            </div>
          </section>

          {/* Categories Section - Responsive */}
          <section className='mb-24 sm:mb-28 lg:mb-32'>
            <div className={`border-t pt-10 sm:pt-12 lg:pt-16 transition-colors ${
              isDarkMode ? 'border-white/10' : 'border-black/10'
            }`}>
              <div className='flex gap-8 sm:gap-12 lg:gap-16 overflow-x-auto pb-6 scrollbar-hide justify-start sm:justify-center px-4 sm:px-0'>
                {categories.map((category) => (
                  <button
                    key={category.name}
                    onClick={() => setSelectedCategory(category.name)}
                    className={`text-[10px] sm:text-xs tracking-[0.3em] whitespace-nowrap transition-all duration-500 pb-3 border-b font-light uppercase relative ${
                      selectedCategory === category.name
                        ? `${isDarkMode ? 'text-white' : 'text-black'} border-amber-500`
                        : `${isDarkMode ? 'text-white/30' : 'text-black/30'} border-transparent ${isDarkMode ? 'hover:text-white/60 hover:border-white/20' : 'hover:text-black/60 hover:border-black/20'}`
                    }`}
                  >
                    {category.name}
                    {selectedCategory === category.name && (
                      <span className='absolute -bottom-[2px] left-0 right-0 h-[2px] bg-amber-500'></span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Products Grid Section - Fully Responsive */}
          <section className='mb-32 sm:mb-36 lg:mb-40'>
            {/* Section Header */}
            <div className='mb-12 sm:mb-16 lg:mb-20 text-center'>
              <div className='inline-flex flex-col items-center'>
              <h2 className='text-[10px] sm:text-xs tracking-[0.4em] text-amber-500 font-light uppercase mb-3 sm:mb-4'>
                Our Selection
              </h2>
              <div className='h-px bg-amber-500/30 w-16 sm:w-24'></div>
            </div>
          </div>
          
          {/* Products Grid - Optimized Breakpoints */}
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-x-10 sm:gap-y-16 md:gap-x-12 md:gap-y-20 lg:gap-x-16 lg:gap-y-24'>
            {filteredItems.map((item, index) => (
              <article
                key={item.id}
                onMouseEnter={() => setHoveredCard(item.id)}
                onMouseLeave={() => setHoveredCard(null)}
                className={`group cursor-pointer ${
                  isMobile ? 'flex gap-4' : ''
                }`}
                style={{ animation: `fadeIn 0.8s ease-out ${index * 0.15}s both` }}
              >
                {/* Image Container - Responsive */}
                <div className={`relative overflow-hidden border transition-colors duration-500 ${
                  isMobile 
                    ? 'w-28 h-28 flex-shrink-0 rounded-lg' 
                    : 'aspect-[3/4] mb-5 sm:mb-6'
                } ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/5 group-hover:border-amber-500/30' 
                    : 'bg-black/5 border-black/5 group-hover:border-amber-600/40'
                }`}>
                  <img
                    src={item.image}
                    alt={item.name}
                    className='w-full h-full object-cover transition-transform duration-700 group-hover:scale-105'
                  />
                  
                  {/* Hover Overlay - Desktop Only */}
                  {!isMobile && (
                    <div className={`absolute inset-0 backdrop-blur-sm transition-opacity duration-500 flex flex-col items-center justify-center gap-4 sm:gap-6 ${
                      isDarkMode ? 'bg-black/70' : 'bg-white/90'
                    } ${hoveredCard === item.id ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                      {/* Favorite Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(item.id);
                        }}
                        className='absolute top-6 sm:top-8 right-6 sm:right-8 w-10 h-10 flex items-center justify-center hover:scale-110 transition-transform'
                      >
                        <Heart
                          size={20}
                          strokeWidth={1.5}
                          className={`${
                            favorites.includes(item.id)
                              ? 'text-red-500 fill-red-500'
                              : 'text-white'
                          } transition-colors`}
                        />
                      </button>
                      
                      {/* Product Info on Hover */}
                      <div className='text-center px-6 sm:px-8'>
                        <p className={`text-xs font-light mb-2 tracking-wider ${isDarkMode ? 'text-white/60' : 'text-black/70'}`}>{item.prepTime}</p>
                        <p className={`text-xs font-light tracking-wider ${isDarkMode ? 'text-white/60' : 'text-black/70'}`}>{item.calories} cal</p>
                      </div>
                    </div>
                  )}

                  {/* Badge */}
                  {item.isNew && (
                    <div className={`absolute bg-amber-500 text-black px-2 sm:px-3 py-1 text-[8px] sm:text-[9px] tracking-[0.3em] font-light uppercase ${
                      isMobile ? 'top-2 left-2' : 'top-6 sm:top-8 left-6 sm:left-8'
                    }`}>
                      New
                    </div>
                  )}

                  {/* Favorite Button - Mobile */}
                  {isMobile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      className='absolute top-2 right-2 w-8 h-8 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-full'
                    >
                      <Heart
                        size={16}
                        strokeWidth={1.5}
                        className={`${
                          favorites.includes(item.id)
                            ? 'text-red-500 fill-red-500'
                            : 'text-white'
                        } transition-colors`}
                      />
                    </button>
                  )}
                </div>

                {/* Product Info - Responsive */}
                <div className={`flex-1 ${isMobile ? 'flex flex-col justify-between' : 'space-y-4 sm:space-y-5'}`}>
                  {/* Title & Rating */}
                  <div className='flex items-start justify-between gap-2'>
                    <h3 className={`font-light tracking-wide flex-1 transition-colors ${
                      isMobile ? 'text-sm line-clamp-2' : 'text-lg sm:text-xl'
                    } ${
                      isDarkMode ? 'text-white' : 'text-black'
                    }`}>{item.name}</h3>
                    <div className='flex items-center gap-1 flex-shrink-0'>
                      <Star size={isMobile ? 11 : 13} strokeWidth={1.5} className='text-amber-500 fill-amber-500' />
                      <span className={`text-xs font-light transition-colors ${
                        isDarkMode ? 'text-white/60' : 'text-black/60'
                      }`}>{item.rating}</span>
                    </div>
                  </div>
                  
                  {/* Subtitle - Desktop Only */}
                  {!isMobile && (
                    <p className={`text-xs sm:text-sm font-light leading-relaxed transition-colors ${
                      isDarkMode ? 'text-white/40' : 'text-black/50'
                    }`}>
                      {item.subtitle}
                    </p>
                  )}
                  
                  {/* Mobile Info */}
                  {isMobile && (
                    <p className={`text-[10px] font-light line-clamp-1 transition-colors ${
                      isDarkMode ? 'text-white/40' : 'text-black/50'
                    }`}>
                      {item.prepTime} • {item.calories} cal
                    </p>
                  )}
                  
                  {/* Divider - Desktop Only */}
                  {!isMobile && (
                    <div className={`h-px transition-colors ${isDarkMode ? 'bg-white/5' : 'bg-black/10'}`}></div>
                  )}
                  
                  {/* Price & Button Row for Mobile */}
                  <div className={isMobile ? 'flex items-center justify-between gap-2 mt-1' : 'space-y-4 sm:space-y-5'}>
                    {/* Price */}
                    <div className='flex items-baseline gap-1.5 sm:gap-2'>
                      <span className={`font-light tracking-wide transition-colors ${
                        isMobile ? 'text-base' : 'text-xl sm:text-2xl'
                      } ${
                        isDarkMode ? 'text-white' : 'text-black'
                      }`}>{item.price.toFixed(1)} DT</span>
                      {item.originalPrice && (
                        <span className={`text-xs line-through font-light transition-colors ${
                          isDarkMode ? 'text-white/20' : 'text-black/30'
                        }`}>
                          {item.originalPrice.toFixed(1)} DT
                        </span>
                      )}
                    </div>

                    {/* Add to Cart Button */}
                    <button className={`tracking-[0.3em] transition-all duration-300 font-light uppercase flex items-center justify-center gap-2 ${
                      isMobile 
                        ? 'px-3 py-2 text-[9px] flex-shrink-0' 
                        : 'w-full px-6 sm:px-8 py-3 sm:py-4 text-[10px] sm:text-xs'
                    } ${
                      isDarkMode ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}>
                      <ShoppingCart size={isMobile ? 14 : 16} strokeWidth={1.5} />
                      {!isMobile && 'Add to Cart'}
                      {isMobile && 'Add'}
                    </button>
                    {!isMobile && (
                      <button
                        onClick={() => onLaunchAR(item.id)}
                        className={`w-full px-6 sm:px-8 py-3 sm:py-4 text-[10px] sm:text-xs tracking-[0.3em] transition-all duration-300 font-light uppercase flex items-center justify-center gap-2 border ${
                          isDarkMode
                            ? 'border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black'
                            : 'border-amber-600/40 text-amber-700 hover:bg-amber-600 hover:text-white'
                        }`}
                      >
                        <Play size={16} strokeWidth={1.5} />
                        View in AR
                      </button>
                    )}
                  </div>
                  {isMobile && (
                    <button
                      onClick={() => onLaunchAR(item.id)}
                      className={`mt-2 px-3 py-2 text-[9px] tracking-[0.3em] transition-all duration-300 font-light uppercase flex items-center justify-center gap-2 border ${
                        isDarkMode
                          ? 'border-amber-500/40 text-amber-500 hover:bg-amber-500 hover:text-black'
                          : 'border-amber-600/40 text-amber-700 hover:bg-amber-600 hover:text-white'
                      }`}
                    >
                      <Play size={14} strokeWidth={1.5} />
                      AR
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

          {/* Newsletter Section - Added Back */}
          <section className='mb-32 sm:mb-36 lg:mb-40'>
            <div className={`border-t pt-16 sm:pt-20 lg:pt-24 transition-colors ${
              isDarkMode ? 'border-white/10' : 'border-black/10'
            }`}>
              <div className='max-w-4xl mx-auto'>
                {/* Section Header */}
                <div className='text-center mb-12 sm:mb-14 lg:mb-16 px-4'>
                  <p className='text-amber-500 text-[10px] sm:text-xs tracking-[0.4em] font-light uppercase mb-6 sm:mb-8'>
                    Stay Connected
                  </p>
                  <h2 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light mb-6 sm:mb-8 leading-tight transition-colors ${
                    isDarkMode ? 'text-white' : 'text-black'
                  }`}>
                    Join Our
                    <br />
                    Community
                  </h2>
                  <p className={`text-sm sm:text-base lg:text-lg font-light leading-relaxed max-w-2xl mx-auto transition-colors ${
                    isDarkMode ? 'text-white/40' : 'text-black/50'
                  }`}>
                    Subscribe for exclusive offers, coffee insights, and be the first to know about new arrivals
                  </p>
                </div>
                
                {/* Newsletter Form */}
                <div className='max-w-2xl mx-auto px-4'>
                  <div className='flex flex-col sm:flex-row gap-4'>
                    <div className='flex-1'>
                      <input
                        type='email'
                        placeholder='Enter your email address'
                        className={`w-full bg-transparent border px-6 sm:px-8 py-4 sm:py-5 text-sm tracking-wide focus:outline-none focus:border-amber-500 transition-all duration-300 font-light placeholder:tracking-wide ${
                          isDarkMode 
                            ? 'border-white/20 text-white placeholder:text-white/30' 
                            : 'border-black/20 text-black placeholder:text-black/40'
                        }`}
                      />
                    </div>
                    <button className={`px-10 sm:px-12 py-4 sm:py-5 text-xs tracking-[0.3em] transition-all duration-300 font-light uppercase whitespace-nowrap ${
                      isDarkMode ? 'bg-amber-500 text-black hover:bg-white' : 'bg-amber-600 text-white hover:bg-amber-700'
                    }`}>
                      Subscribe
                    </button>
                  </div>
                  
                  {/* Privacy Note */}
                  <p className={`text-xs font-light mt-6 text-center tracking-wide transition-colors ${
                    isDarkMode ? 'text-white/20' : 'text-black/30'
                  }`}>
                    We respect your privacy. Unsubscribe at any time.
                  </p>
                </div>
              </div>
            </div>
          </section>
          {/* Professional Footer - Responsive with Theme Support */}
          <footer className={`border-t mt-32 sm:mt-40 lg:mt-48 pt-16 sm:pt-20 lg:pt-24 pb-12 sm:pb-14 lg:pb-16 transition-colors ${
            isDarkMode ? 'border-white/10' : 'border-black/10'
          }`}>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 sm:gap-14 lg:gap-16 xl:gap-20 mb-16 sm:mb-18 lg:mb-20'>
              
              {/* Brand Column */}
              <div className='space-y-6'>
                <div className='flex items-center gap-3'>
                  <Coffee size={24} className='text-amber-500' strokeWidth={1.5} />
                  <h3 className={`text-xl font-light tracking-[0.25em] transition-colors ${
                    isDarkMode ? 'text-white' : 'text-black'
                  }`}>BREW</h3>
                </div>
                <p className={`text-sm font-light leading-relaxed transition-colors ${
                  isDarkMode ? 'text-white/40' : 'text-black/50'
                }`}>
                  Crafting exceptional coffee experiences since 2020. Premium beans, expert roasting, perfect brewing.
                </p>
                {/* Social Links */}
                <div className='flex items-center gap-4'>
                  <button className={`transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-amber-500' : 'text-black/40 hover:text-amber-600'
                  }`}>
                    <Instagram size={18} strokeWidth={1.5} />
                  </button>
                  <button className={`transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-amber-500' : 'text-black/40 hover:text-amber-600'
                  }`}>
                    <Twitter size={18} strokeWidth={1.5} />
                  </button>
                  <button className={`transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-amber-500' : 'text-black/40 hover:text-amber-600'
                  }`}>
                    <Facebook size={18} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* Shop Column */}
              <div className='space-y-6'>
                <h4 className={`text-xs tracking-[0.3em] font-light uppercase transition-colors ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}>Shop</h4>
                <ul className='space-y-4'>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Coffee Beans</a></li>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Equipment</a></li>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Merchandise</a></li>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Gift Cards</a></li>
                </ul>
              </div>

              {/* Company Column */}
              <div className='space-y-6'>
                <h4 className={`text-xs tracking-[0.3em] font-light uppercase transition-colors ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}>Company</h4>
                <ul className='space-y-4'>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>About Us</a></li>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Our Story</a></li>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Locations</a></li>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Careers</a></li>
                </ul>
              </div>

              {/* Support Column */}
              <div className='space-y-6'>
                <h4 className={`text-xs tracking-[0.3em] font-light uppercase transition-colors ${
                  isDarkMode ? 'text-white' : 'text-black'
                }`}>Support</h4>
                <ul className='space-y-4'>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Contact Us</a></li>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>FAQ</a></li>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Shipping</a></li>
                  <li><a href='#' className={`text-sm font-light tracking-wide transition-colors duration-300 ${
                    isDarkMode ? 'text-white/40 hover:text-white' : 'text-black/50 hover:text-black'
                  }`}>Returns</a></li>
                </ul>
              </div>
            </div>

            {/* Footer Bottom - Responsive */}
            <div className={`border-t pt-8 sm:pt-10 lg:pt-12 flex flex-col sm:flex-row items-center justify-between gap-6 transition-colors ${
              isDarkMode ? 'border-white/10' : 'border-black/10'
            }`}>
              <p className={`text-xs font-light tracking-wide text-center sm:text-left transition-colors ${
                isDarkMode ? 'text-white/30' : 'text-black/40'
              }`}>
                © 2024 BREW. All rights reserved.
              </p>
              <div className='flex flex-wrap items-center justify-center gap-6 sm:gap-8 lg:gap-10'>
                <a href='#' className={`text-xs font-light tracking-wide transition-colors duration-300 ${
                  isDarkMode ? 'text-white/30 hover:text-white' : 'text-black/40 hover:text-black'
                }`}>Privacy Policy</a>
                <a href='#' className={`text-xs font-light tracking-wide transition-colors duration-300 ${
                  isDarkMode ? 'text-white/30 hover:text-white' : 'text-black/40 hover:text-black'
                }`}>Terms of Service</a>
                <a href='#' className={`text-xs font-light tracking-wide transition-colors duration-300 ${
                  isDarkMode ? 'text-white/30 hover:text-white' : 'text-black/40 hover:text-black'
                }`}>Cookies</a>
              </div>
            </div>
          </footer>        {/* Footer Spacing */}
        <div className='h-12 sm:h-14 lg:h-16'></div>
        </div>
      </div>
    </div>
  );
}

function GameContent({ isMobile, isDarkMode }) {
  return (
    <div className='w-full min-h-screen bg-[var(--bg-primary)] overflow-x-hidden transition-colors duration-300'>
      <div className='w-full pt-32 sm:pt-36 lg:pt-40 pb-16 sm:pb-24 lg:pb-40'>
        <div className='max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16'>
          <CoffeeMemoryGame isMobile={isMobile} isDarkMode={isDarkMode} />
        </div>
      </div>
    </div>
  );
}
