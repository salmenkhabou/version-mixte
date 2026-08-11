import { useState } from 'react';
import {
  Coffee,
  Star,
  Heart,
  ShoppingCart,
  Play,
  Instagram,
  Twitter,
  Facebook,
} from 'lucide-react';

export default function ShopView({
  isMobile,
  coffeeItems,
  categories,
  favorites,
  toggleFavorite,
  isDarkMode,
  onLaunchAR,
  showAR,
  showOrdersModule,
  onAddToCart,
}) {
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
                      {showOrdersModule && (
                        <button
                          onClick={() => onAddToCart(item)}
                          className={`tracking-[0.3em] transition-all duration-300 font-light uppercase flex items-center justify-center gap-2 ${
                            isMobile
                              ? 'px-3 py-2 text-[9px] flex-shrink-0'
                              : 'w-full px-6 sm:px-8 py-3 sm:py-4 text-[10px] sm:text-xs'
                          } ${
                            isDarkMode ? 'bg-amber-500 text-black hover:bg-amber-400' : 'bg-amber-600 text-white hover:bg-amber-700'
                          }`}
                        >
                          <ShoppingCart size={isMobile ? 14 : 16} strokeWidth={1.5} />
                          {!isMobile && 'Add to Cart'}
                          {isMobile && 'Add'}
                        </button>
                      )}
                      {!isMobile && showAR && (
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
                    {isMobile && showAR && (
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
          </footer>
          {/* Footer Spacing */}
          <div className='h-12 sm:h-14 lg:h-16'></div>
        </div>
      </div>
    </div>
  );
}
