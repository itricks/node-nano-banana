
import React, { useState, useEffect } from 'react';
import { translations, Language, Theme } from './types';
import { Canvas } from './components/Canvas';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>('ar');
  const [theme, setTheme] = useState<Theme>('dark-blue');
  const t = translations[lang];

  useEffect(() => {
    // Update HTML dir attribute for proper RTL/LTR behavior
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    // Update Theme
    document.documentElement.setAttribute('data-theme', theme);
    // Add/Remove 'dark' class for Tailwind consistency (White Apple is light mode)
    if (theme === 'white-apple') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
  }, [theme]);

  const toggleLanguage = () => {
    setLang(prev => prev === 'ar' ? 'en' : 'ar');
  };

  return (
    <div className="flex flex-col h-full bg-app-bg text-text-main overflow-hidden font-display selection:bg-primary/30 selection:text-white">
      <Canvas 
        t={t} 
        lang={lang} 
        onToggleLanguage={toggleLanguage} 
        theme={theme}
        onSetTheme={setTheme}
      />
    </div>
  );
};

export default App;
