import { Mail, Phone, MapPin } from 'lucide-react';

export default function ContactView({ isMobile, isDarkMode }) {
  const contactCards = [
    { title: 'Society', value: 'chi5a.tn', icon: MapPin },
    { title: 'Salmen Khabou', value: 'salmenkhabou3@gmail.com', icon: Mail },
    { title: 'Mohamed Amin Mallek', value: 'aminmallek02@gmail.com', icon: Mail },
    { title: 'Phone Numbers', value: '21074001 / 24494492', icon: Phone },
  ];

  return (
    <div className='w-full min-h-screen bg-[var(--bg-primary)] overflow-x-hidden transition-colors duration-300'>
      <div className='w-full pt-32 sm:pt-36 lg:pt-40 pb-16 sm:pb-24 lg:pb-40'>
        <div className='max-w-[1400px] mx-auto px-4 sm:px-8 md:px-12 lg:px-16'>
          <section className='mb-20 sm:mb-24 lg:mb-28'>
            <div className='max-w-5xl mx-auto text-center'>
              <div className='mb-8 sm:mb-10 lg:mb-12'>
                <div className='inline-flex items-center gap-3 sm:gap-4'>
                  <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
                  <span className='text-amber-500 text-[9px] sm:text-[10px] tracking-[0.5em] font-light uppercase'>
                    Contact
                  </span>
                  <div className='h-px w-8 sm:w-12 bg-amber-500'></div>
                </div>
              </div>

              <h1 className={`text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-extralight leading-[0.92] tracking-tighter mb-8 sm:mb-10 ${
                isDarkMode ? 'text-white' : 'text-black'
              }`}>
                Let&apos;s
                <br />
                <span className='text-amber-500'>Talk</span>
              </h1>

              <p className={`text-sm sm:text-base md:text-lg lg:text-xl font-light leading-relaxed max-w-3xl mx-auto ${
                isDarkMode ? 'text-white/50' : 'text-black/60'
              }`}>
                Questions, feedback, or collaboration ideas? Reach out directly to the chi5a.tn developers using the contacts below.
              </p>
            </div>
          </section>

          <section className='mb-20 sm:mb-24 lg:mb-28'>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6'>
              {contactCards.map((card) => {
                const Icon = card.icon;
                return (
                  <article
                    key={card.title}
                    className={`border p-5 sm:p-6 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5'}`}
                  >
                    <Icon size={18} className='text-amber-500 mb-4' strokeWidth={1.7} />
                    <h3 className={`text-xs tracking-[0.3em] uppercase mb-2 ${isDarkMode ? 'text-white/70' : 'text-black/70'}`}>
                      {card.title}
                    </h3>
                    <p className={`text-sm sm:text-base font-light break-words ${isDarkMode ? 'text-white' : 'text-black'}`}>
                      {card.value}
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={`border-t pt-12 sm:pt-16 lg:pt-20 ${isDarkMode ? 'border-white/10' : 'border-black/10'}`}>
            <div className='max-w-3xl'>
              <h2 className={`text-2xl sm:text-3xl lg:text-4xl font-light mb-8 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Send a Message
              </h2>

              <form className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5' onSubmit={(e) => e.preventDefault()}>
                <input
                  type='text'
                  placeholder='Your name'
                  className={`sm:col-span-1 bg-transparent border px-4 py-3 text-sm font-light focus:outline-none focus:border-amber-500 transition-colors ${
                    isDarkMode ? 'border-white/20 text-white placeholder:text-white/30' : 'border-black/20 text-black placeholder:text-black/40'
                  }`}
                />
                <input
                  type='email'
                  placeholder='Your email'
                  className={`sm:col-span-1 bg-transparent border px-4 py-3 text-sm font-light focus:outline-none focus:border-amber-500 transition-colors ${
                    isDarkMode ? 'border-white/20 text-white placeholder:text-white/30' : 'border-black/20 text-black placeholder:text-black/40'
                  }`}
                />
                <input
                  type='text'
                  placeholder='Subject'
                  className={`sm:col-span-2 bg-transparent border px-4 py-3 text-sm font-light focus:outline-none focus:border-amber-500 transition-colors ${
                    isDarkMode ? 'border-white/20 text-white placeholder:text-white/30' : 'border-black/20 text-black placeholder:text-black/40'
                  }`}
                />
                <textarea
                  rows={isMobile ? 5 : 6}
                  placeholder='Tell us how we can help'
                  className={`sm:col-span-2 bg-transparent border px-4 py-3 text-sm font-light focus:outline-none focus:border-amber-500 transition-colors resize-none ${
                    isDarkMode ? 'border-white/20 text-white placeholder:text-white/30' : 'border-black/20 text-black placeholder:text-black/40'
                  }`}
                />
                <button
                  type='submit'
                  className={`sm:col-span-2 w-full sm:w-fit px-10 py-3 text-xs tracking-[0.3em] uppercase transition-all duration-300 font-light ${
                    isDarkMode ? 'bg-amber-500 text-black hover:bg-white' : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  Send Message
                </button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
