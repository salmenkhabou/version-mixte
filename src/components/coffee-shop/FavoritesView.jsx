import { Heart, Star, Clock, X } from 'lucide-react';

export default function FavoritesView({
  isMobile,
  coffeeItems,
  favorites,
  toggleFavorite,
  clearAllFavorites,
  isDarkMode,
  showOrdersModule,
  onAddToCart,
}) {
  const favoritedItems = coffeeItems.filter((item) => favorites.includes(item.id));

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
                  : 'Start building your perfect coffee collection'}
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
                      {showOrdersModule && (
                        <button
                          onClick={() => onAddToCart(item)}
                          className={`px-6 py-3 text-xs font-medium tracking-wider transition-all duration-300 ${
                            isDarkMode
                              ? 'bg-amber-500 text-black hover:bg-white'
                              : 'bg-amber-600 text-white hover:bg-amber-700'
                          }`}
                        >
                          ADD
                        </button>
                      )}
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
