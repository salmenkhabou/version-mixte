import React, { useState } from 'react';
import { Languages, ChevronDown } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSelector = ({ isDarkMode }) => {
  const { language, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'ar', name: 'العربية', flag: '🇹🇳' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
  ];

  const currentLang = languages.find(lang => lang.code === language);

  return (
    <div className="relative">
      {/* Dropdown Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl
          font-medium text-sm sm:text-base transition-all duration-300
          shadow-lg hover:shadow-xl transform hover:scale-105
          ${isDarkMode
            ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-500 hover:to-orange-500'
            : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-400 hover:to-orange-400'
          }
        `}
      >
        <Languages className="w-4 h-4 sm:w-5 sm:h-5" />
        <span className="text-xl sm:text-2xl">{currentLang.flag}</span>
        <span className="hidden sm:inline font-semibold">{currentLang.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Menu */}
          <div className={`
            absolute top-full right-0 mt-2 w-48 sm:w-56 rounded-2xl shadow-2xl
            overflow-hidden z-50 animate-fadeIn
            ${isDarkMode 
              ? 'bg-gray-800 border border-gray-700' 
              : 'bg-white border border-gray-200'
            }
          `}>
            {languages.map((lang, index) => (
              <button
                key={lang.code}
                onClick={() => {
                  changeLanguage(lang.code);
                  setIsOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 sm:py-3.5 text-left
                  transition-all duration-200 font-medium
                  ${language === lang.code
                    ? isDarkMode
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-500 text-white'
                    : isDarkMode
                      ? 'text-gray-200 hover:bg-gray-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }
                  ${index !== 0 ? 'border-t ' + (isDarkMode ? 'border-gray-700' : 'border-gray-200') : ''}
                `}
              >
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1">
                  <div className="text-sm sm:text-base font-semibold">{lang.name}</div>
                  <div className={`text-xs ${language === lang.code ? 'text-white/80' : isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    {lang.code.toUpperCase()}
                  </div>
                </div>
                {language === lang.code && (
                  <span className="text-lg">✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;
