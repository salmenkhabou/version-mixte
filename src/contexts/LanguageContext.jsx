import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Load language from localStorage or default to Arabic
    const saved = localStorage.getItem('gameLanguage');
    return saved || 'ar';
  });

  useEffect(() => {
    // Save language preference
    localStorage.setItem('gameLanguage', language);
  }, [language]);

  const changeLanguage = (lang) => {
    if (['ar', 'fr', 'en'].includes(lang)) {
      setLanguage(lang);
    }
  };

  const value = {
    language,
    changeLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
