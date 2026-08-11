import CoffeeMemoryGame from '../game/CoffeeMemoryGame';

export default function GameView({ isMobile, isDarkMode }) {
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
