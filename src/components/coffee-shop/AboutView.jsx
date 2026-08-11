export default function AboutView({ isDarkMode }) {
  const highlights = [
    { title: 'Premium Beans', text: 'Single-origin beans sourced from trusted farms and seasonal lots.' },
    { title: 'Expert Roasting', text: 'Each profile is tuned to preserve aroma, body, and balanced acidity.' },
    { title: 'Craft Service', text: 'Every cup is hand-finished for consistency and memorable flavor.' },
  ];

  return (
    <div className='w-full min-h-screen bg-[var(--bg-primary)] overflow-x-hidden transition-colors duration-300'>
      <div className='w-full pt-32 sm:pt-36 lg:pt-40 pb-16 sm:pb-24 lg:pb-40'>
        <div className='max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16'>
          <section className='mb-24 sm:mb-28 lg:mb-32'>
            <div className='max-w-5xl mx-auto text-center'>
              <div className='mb-8 sm:mb-10 lg:mb-12'>
                <div className='inline-flex items-center gap-3 sm:gap-4'>
                  <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
                  <span className='text-amber-500 text-[9px] sm:text-[10px] tracking-[0.5em] font-light uppercase'>
                    About Brew
                  </span>
                  <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
                </div>
              </div>

              <h1 className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extralight leading-[0.92] tracking-tighter mb-8 sm:mb-10 ${
                isDarkMode ? 'text-white' : 'text-black'
              }`}>
                Our
                <br />
                <span className='text-amber-500'>Story</span>
              </h1>

              <p className={`text-sm sm:text-base md:text-lg lg:text-xl font-light leading-relaxed max-w-3xl mx-auto ${
                isDarkMode ? 'text-white/50' : 'text-black/60'
              }`}>
                BREW started with one idea: make specialty coffee approachable without compromising quality. From bean selection to final pour, we build every detail around flavor, warmth, and craftsmanship.
              </p>

              <div className={`mt-8 sm:mt-10 max-w-3xl mx-auto border px-5 py-5 sm:px-7 sm:py-6 ${
                isDarkMode ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-600/20 bg-amber-500/10'
              }`}>
                <p className={`text-xs sm:text-sm tracking-[0.25em] uppercase mb-3 ${isDarkMode ? 'text-amber-500' : 'text-amber-700'}`}>
                  Development Credits
                </p>
                <p className={`text-sm sm:text-base font-light leading-relaxed ${isDarkMode ? 'text-white/70' : 'text-black/70'}`}>
                  All of this is developed by our society chi5a.tn by Salmen Khabou and Mohamed Amin Mallek.
                </p>
              </div>
            </div>
          </section>

          <section className='mb-24 sm:mb-28 lg:mb-32'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8'>
              {highlights.map((item) => (
                <article
                  key={item.title}
                  className={`border p-6 sm:p-8 transition-colors ${
                    isDarkMode ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'
                  }`}
                >
                  <h3 className={`text-lg sm:text-xl tracking-wide font-light mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    {item.title}
                  </h3>
                  <p className={`text-sm leading-relaxed font-light ${isDarkMode ? 'text-white/50' : 'text-black/60'}`}>
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className={`border-t pt-12 sm:pt-16 lg:pt-20 ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
            <div className='grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-12 lg:gap-16'>
              <div>
                <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-light mb-6 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  What We Believe
                </h2>
                <p className={`text-sm sm:text-base leading-relaxed font-light ${isDarkMode ? 'text-white/50' : 'text-black/60'}`}>
                  Great coffee is a daily ritual. We design our menu and experience around consistency, hospitality, and transparent sourcing so every visit feels intentional.
                </p>
              </div>

              <div className={`p-6 sm:p-8 border ${isDarkMode ? 'border-amber-500/20 bg-amber-500/5' : 'border-amber-600/20 bg-amber-500/10'}`}>
                <h3 className={`text-xs tracking-[0.35em] uppercase mb-5 ${isDarkMode ? 'text-amber-500' : 'text-amber-700'}`}>
                  Quick Facts
                </h3>
                <ul className='space-y-3 text-sm sm:text-base font-light'>
                  <li className={isDarkMode ? 'text-white/70' : 'text-black/70'}>Opened in 2020</li>
                  <li className={isDarkMode ? 'text-white/70' : 'text-black/70'}>8 signature drinks</li>
                  <li className={isDarkMode ? 'text-white/70' : 'text-black/70'}>Locally roasted partnerships</li>
                  <li className={isDarkMode ? 'text-white/70' : 'text-black/70'}>Community-first events monthly</li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
