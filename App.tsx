import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import IATTest from './components/IATTest';

// Simple UUID generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const Dashboard = ({ startTest }) => {
  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-8 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 gap-8">
        
        {/* Header Section */}
        <div className="text-center mb-4">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-4">
            Culture IAT
          </h1>
          <p className="text-slate-400 text-lg">
            Исследование имплицитных ассоциаций: Башкирская vs Русская культура
          </p>
        </div>

        {/* Start Test Card */}
        <div className="bg-gradient-to-r from-blue-900/50 to-slate-800 rounded-2xl p-8 md:p-12 border border-blue-500/30 shadow-lg flex flex-col items-center justify-center text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Готовы пройти тест?</h2>
          <p className="text-blue-200 mb-8 max-w-2xl text-lg">
            Тест займет около 5-10 минут. Вам предстоит классифицировать слова и изображения как можно быстрее.
          </p>
          <button 
            onClick={startTest}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xl font-bold py-4 px-12 rounded-full shadow-lg shadow-blue-500/20 transform hover:scale-105 transition-all active:scale-95"
          >
            Начать Тест
          </button>
        </div>

      </div>
    </div>
  );
};

const AppContent = () => {
  const [session, setSession] = useState(null);
  const [testActive, setTestActive] = useState(false);

  useEffect(() => {
    // Initialize Session
    const userId = generateUUID();
    const referrer = document.referrer || "direct";
    const newSession = {
      userId,
      referrer,
      startTime: Date.now()
    };
    setSession(newSession);
    console.log(`User initialized: ${userId}`);
  }, []);

  const handleStartTest = () => {
    if (session) {
      setTestActive(true);
    } else {
      console.warn("Session not initialized yet");
    }
  };

  const handleTestComplete = () => {
    setTestActive(false);
  };

  if (testActive && session) {
    return <IATTest session={session} onComplete={handleTestComplete} />;
  }

  return <Dashboard startTest={handleStartTest} />;
};

const App = () => {
  return (
    <HashRouter>
       <Routes>
         <Route path="/" element={<AppContent />} />
       </Routes>
    </HashRouter>
  );
};

export default App;