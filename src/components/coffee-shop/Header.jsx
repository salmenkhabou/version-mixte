import {
  Coffee,
  Heart,
  ShoppingCart,
  Sun,
  Moon,
  Gamepad2,
  User,
  X,
  QrCode,
  Box,
} from 'lucide-react';

export default function Header({
  isMobile,
  scrolled,
  currentView,
  setCurrentView,
  menuOpen,
  setMenuOpen,
  favorites,
  cartCount,
  isDarkMode,
  toggleTheme,
  showGames,
  showOrdersModule,
  onOpenQRScanner,
  onOpen3DViewer,
}) {
  return (
    <>
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
              <div className='flex items-center gap-4 cursor-pointer group' onClick={() => setCurrentView('shop')}>
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
                <NavLink label='Menu' view='shop' currentView={currentView} setCurrentView={setCurrentView} isDarkMode={isDarkMode} />
                <button
                  onClick={onOpen3DViewer}
                  className="group text-xs tracking-[0.25em] transition-all duration-500 relative font-light uppercase text-amber-500/90 hover:text-amber-400 flex items-center gap-1.5"
                >
                  <Box size={15} />
                  3D Studio
                </button>
                {showGames && (
                  <NavLink label='Games' view='game' currentView={currentView} setCurrentView={setCurrentView} isDarkMode={isDarkMode} />
                )}
                <NavLink label='About' view='about' currentView={currentView} setCurrentView={setCurrentView} isDarkMode={isDarkMode} />
                <NavLink label='Contact' view='contact' currentView={currentView} setCurrentView={setCurrentView} isDarkMode={isDarkMode} />
              </div>

              {/* Right Actions - Enhanced */}
              <div className='flex items-center gap-6'>
                {/* QR Scanner Trigger Button */}
                <button
                  onClick={onOpenQRScanner}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-light tracking-wider rounded-full border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-black transition-all shadow-sm"
                  title="Scanner un QR code (Table / Item)"
                >
                  <QrCode size={16} />
                  <span>Scan QR</span>
                </button>

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
                {showOrdersModule && (
                  <button onClick={() => setCurrentView('cart')} className='relative group'>
                    <ShoppingCart
                      size={20}
                      strokeWidth={1.5}
                      className={`transition-colors duration-300 ${
                        currentView === 'cart'
                          ? 'text-amber-500'
                          : isDarkMode
                            ? 'text-white/60 group-hover:text-amber-500'
                            : 'text-black/60 group-hover:text-amber-600'
                      }`}
                    />
                    <span className='absolute -top-2 -right-2 w-4 h-4 bg-amber-500 text-black text-[9px] font-medium rounded-full flex items-center justify-center'>
                      {cartCount}
                    </span>
                  </button>
                )}
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
            <div className='flex items-center gap-3' onClick={() => setCurrentView('shop')}>
              <Coffee size={24} className='text-amber-500' strokeWidth={1.5} />
              <h1 className={`text-xl font-light tracking-[0.25em] ${isDarkMode ? 'text-white' : 'text-black'}`}>
                BREW
              </h1>
            </div>

            <div className="flex items-center gap-3">
              {/* QR Scan Button Mobile */}
              <button
                onClick={onOpenQRScanner}
                className="p-2 rounded-full border border-amber-500/40 text-amber-500 bg-amber-500/10 active:scale-95 transition-transform"
                aria-label="Scan QR"
              >
                <QrCode size={18} />
              </button>

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
            <MobileNavButton
              view='shop'
              currentView={currentView}
              setCurrentView={setCurrentView}
              isDarkMode={isDarkMode}
              icon={<Coffee size={24} strokeWidth={1.5} />}
              label='MENU'
            />

            {showGames && (
              <MobileNavButton
                view='game'
                currentView={currentView}
                setCurrentView={setCurrentView}
                isDarkMode={isDarkMode}
                icon={<Gamepad2 size={24} strokeWidth={1.5} />}
                label='GAMES'
              />
            )}

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

            {showOrdersModule && (
              <button
                onClick={() => setCurrentView('cart')}
                className='flex flex-col items-center gap-1 min-w-[60px] relative'
              >
                <ShoppingCart
                  size={24}
                  strokeWidth={1.5}
                  className={`transition-colors duration-300 ${
                    currentView === 'cart'
                      ? 'text-amber-500'
                      : isDarkMode ? 'text-white/40' : 'text-black/40'
                  }`}
                />
                <span className='absolute top-0 right-3 w-4 h-4 bg-amber-500 text-black text-[9px] font-medium rounded-full flex items-center justify-center'>
                  {cartCount}
                </span>
                <span className={`text-[10px] font-light tracking-wider ${
                  currentView === 'cart'
                    ? 'text-amber-500'
                    : isDarkMode ? 'text-white/40' : 'text-black/40'
                }`}>
                  CART
                </span>
              </button>
            )}

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

              <MobileMenuLink view='shop' label='MENU' currentView={currentView} setCurrentView={setCurrentView} setMenuOpen={setMenuOpen} isDarkMode={isDarkMode} />
              {showGames && (
                <MobileMenuLink view='game' label='GAMES' currentView={currentView} setCurrentView={setCurrentView} setMenuOpen={setMenuOpen} isDarkMode={isDarkMode} />
              )}
              <MobileMenuLink view='about' label='ABOUT' currentView={currentView} setCurrentView={setCurrentView} setMenuOpen={setMenuOpen} isDarkMode={isDarkMode} />
              <MobileMenuLink view='contact' label='CONTACT' currentView={currentView} setCurrentView={setCurrentView} setMenuOpen={setMenuOpen} isDarkMode={isDarkMode} />

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
              {showOrdersModule && (
                <button
                  onClick={() => {
                    setCurrentView('cart');
                    setMenuOpen(false);
                  }}
                  className={`flex items-center gap-4 transition-colors group ${
                    currentView === 'cart'
                      ? 'text-amber-500'
                      : isDarkMode ? 'text-white/60 hover:text-white' : 'text-black/60 hover:text-black'
                  }`}
                >
                  <ShoppingCart size={22} strokeWidth={1.5} className='group-hover:text-amber-500 transition-colors' />
                  <span className='text-base tracking-wider'>CART ({cartCount})</span>
                </button>
              )}

              <button className={`mt-10 px-10 py-4 text-sm font-medium tracking-wider transition-all duration-300 ${
                isDarkMode ? 'bg-amber-500 text-black hover:bg-white' : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}>
                SIGN IN
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function NavLink({ label, view, currentView, setCurrentView, isDarkMode }) {
  return (
    <button
      onClick={() => setCurrentView(view)}
      className={`group text-xs tracking-[0.25em] transition-all duration-500 relative font-light uppercase ${
        currentView === view
          ? isDarkMode ? 'text-white' : 'text-black'
          : isDarkMode ? 'text-white/40 hover:text-white/80' : 'text-black/40 hover:text-black/80'
      }`}
    >
      {label}
      <span className={`absolute -bottom-2 left-0 h-px bg-amber-500 transition-all duration-500 ${
        currentView === view ? 'w-full' : 'w-0 group-hover:w-full'
      }`}></span>
    </button>
  );
}

function MobileNavButton({ view, currentView, setCurrentView, isDarkMode, icon, label }) {
  return (
    <button
      onClick={() => setCurrentView(view)}
      className='flex flex-col items-center gap-1 min-w-[60px] transition-all duration-300'
    >
      <div className={`relative ${currentView === view ? 'scale-110' : ''}`}>
        <span className={`transition-colors duration-300 ${
          currentView === view
            ? 'text-amber-500'
            : isDarkMode ? 'text-white/40' : 'text-black/40'
        }`}>
          {icon}
        </span>
        {currentView === view && (
          <div className='absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-amber-500 rounded-full'></div>
        )}
      </div>
      <span className={`text-[10px] font-light tracking-wider transition-colors duration-300 ${
        currentView === view
          ? 'text-amber-500'
          : isDarkMode ? 'text-white/40' : 'text-black/40'
      }`}>
        {label}
      </span>
    </button>
  );
}

function MobileMenuLink({ view, label, currentView, setCurrentView, setMenuOpen, isDarkMode }) {
  return (
    <button
      onClick={() => {
        setCurrentView(view);
        setMenuOpen(false);
      }}
      className={`text-3xl font-light tracking-wider transition-all text-left group ${
        currentView === view
          ? 'text-amber-500'
          : isDarkMode ? 'text-white/60' : 'text-black/60'
      }`}
    >
      {label}
      <div className={`h-px mt-2 transition-all duration-300 ${
        currentView === view ? 'w-20 bg-amber-500' : isDarkMode ? 'w-0 bg-white/20 group-hover:w-12' : 'w-0 bg-black/20 group-hover:w-12'
      }`}></div>
    </button>
  );
}
