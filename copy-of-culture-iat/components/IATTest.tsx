import React, { useState, useEffect, useCallback, useRef } from 'react';
import { STIMULI_POOL, BASHKIR_WORDS, RUSSIAN_WORDS, COW_IMAGES, HORSE_IMAGES } from '../constants';
import { Category, StimulusType } from '../types';
import { saveResults } from '../services/supabaseService';

// Helper to get random item
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Configuration of the 6 Blocks
const BLOCKS = [
  {
    id: 1,
    title: "Этап 1: Слова",
    instruction: "Запомните слова для каждой категории.\nНажимайте 'E' (слева) для БАШКИРСКИХ слов.\nНажимайте 'I' (справа) для РУССКИХ слов.",
    leftCategories: [Category.BASHKIR],
    rightCategories: [Category.RUSSIAN],
    trials: 10
  },
  {
    id: 2,
    title: "Этап 2: Картинки",
    instruction: "Нажимайте 'E' (слева) для КОРОВ.\nНажимайте 'I' (справа) для ЛОШАДЕЙ.",
    leftCategories: [Category.COW],
    rightCategories: [Category.HORSE],
    trials: 10
  },
  {
    id: 3,
    title: "Этап 3: Совмещение (Тренировка)",
    instruction: "Нажимайте 'E' для БАШКИРЫ или КОРОВЫ.\nНажимайте 'I' для РУССКИЕ или ЛОШАДИ.",
    leftCategories: [Category.BASHKIR, Category.COW],
    rightCategories: [Category.RUSSIAN, Category.HORSE],
    trials: 20
  },
  {
    id: 4,
    title: "Этап 4: Смена сторон (Слова)",
    instruction: "ВНИМАНИЕ: Стороны поменялись!\nНажимайте 'E' (слева) для РУССКИХ слов.\nНажимайте 'I' (справа) для БАШКИРСКИХ слов.",
    leftCategories: [Category.RUSSIAN],
    rightCategories: [Category.BASHKIR],
    trials: 10
  },
  {
    id: 5,
    title: "Этап 5: Обратное совмещение",
    instruction: "Нажимайте 'E' для РУССКИЕ или КОРОВЫ.\nНажимайте 'I' для БАШКИРЫ или ЛОШАДИ.",
    leftCategories: [Category.RUSSIAN, Category.COW],
    rightCategories: [Category.BASHKIR, Category.HORSE],
    trials: 20
  },
  {
    id: 6,
    title: "Этап 6: Финал",
    instruction: "Повторим предыдущее задание.\nНажимайте 'E' для РУССКИЕ или КОРОВЫ.\nНажимайте 'I' для БАШКИРЫ или ЛОШАДИ.",
    leftCategories: [Category.RUSSIAN, Category.COW],
    rightCategories: [Category.BASHKIR, Category.HORSE],
    trials: 20
  }
];

const IATTest = ({ session, onComplete }) => {
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [isInstruction, setIsInstruction] = useState(true);
  const [trialCount, setTrialCount] = useState(0);
  const [currentStimulus, setCurrentStimulus] = useState(null);
  const [startTime, setStartTime] = useState(0);
  const [mistake, setMistake] = useState(false);
  const [results, setResults] = useState([]);
  
  // States for finishing process
  const [finished, setFinished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isCopied, setIsCopied] = useState(false);

  // Buffer references to avoid closure staleness in event listeners
  const stateRef = useRef({
    currentBlockIndex,
    isInstruction,
    currentStimulus,
    startTime,
    mistake,
    trialCount,
    finished,
    isSaving
  });

  // Sync ref
  useEffect(() => {
    stateRef.current = { 
      currentBlockIndex, 
      isInstruction, 
      currentStimulus, 
      startTime, 
      mistake, 
      trialCount, 
      finished,
      isSaving 
    };
  }, [currentBlockIndex, isInstruction, currentStimulus, startTime, mistake, trialCount, finished, isSaving]);

  const currentBlock = BLOCKS[currentBlockIndex];

  const finishTest = useCallback(async (finalResults) => {
    setFinished(true);
    setIsSaving(true);
    
    const response = await saveResults(session, finalResults);
    
    setIsSaving(false);
    if (response.error) {
      setSaveError(response.error.message || "Неизвестная ошибка при сохранении");
    }
  }, [session]);

  const nextTrial = useCallback(() => {
    const block = BLOCKS[currentBlockIndex];
    if (stateRef.current.trialCount >= block.trials) {
      // End of block
      if (currentBlockIndex >= BLOCKS.length - 1) {
        // Pass the current accumulated results to finishTest
        finishTest(results); 
        return;
      }
      setCurrentBlockIndex(prev => prev + 1);
      setTrialCount(0);
      setIsInstruction(true);
      return;
    }

    // Pick a stimulus that matches active categories
    const validCategories = [...block.leftCategories, ...block.rightCategories];
    const pool = STIMULI_POOL.filter(s => validCategories.includes(s.category));
    const nextStim = getRandom(pool);

    setCurrentStimulus(nextStim);
    setMistake(false);
    setStartTime(performance.now());
    setTrialCount(prev => prev + 1);
  }, [currentBlockIndex, results, finishTest]);

  const handleInput = useCallback((action) => {
    const state = stateRef.current;
    if (state.finished || state.isSaving) return;

    // Handle Instruction Screen
    if (state.isInstruction) {
      if (action === 'SPACE') {
        setIsInstruction(false);
        nextTrial();
      }
      return;
    }

    // Handle Test
    if (!state.currentStimulus) return;

    const block = BLOCKS[state.currentBlockIndex];
    
    let isLeft = false; 
    let isRight = false;
    
    if (action === 'LEFT') isLeft = true;
    if (action === 'RIGHT') isRight = true;

    if (!isLeft && !isRight) return;

    const correctSide = block.leftCategories.includes(state.currentStimulus.category) ? 'left' : 'right';
    const pressedSide = isLeft ? 'left' : 'right';

    if (correctSide !== pressedSide) {
      setMistake(true);
      // In standard IAT, user must correct the mistake. Time continues.
    } else {
      const endTime = performance.now();
      const rt = endTime - state.startTime;
      
      const result = {
        blockId: block.id,
        stimulusId: state.currentStimulus.id,
        category: state.currentStimulus.category,
        isCorrect: !state.mistake,
        reactionTime: rt,
        timestamp: Date.now()
      };

      // Update results locally
      setResults(prev => [...prev, result]);
      
      const isLastBlock = state.currentBlockIndex >= BLOCKS.length - 1;
      const isLastTrial = state.trialCount >= block.trials - 1;
      
      if (isLastBlock && isLastTrial) {
         finishTest([...results, result]);
      } else {
         nextTrial();
      }
    }
  }, [nextTrial, results, finishTest]);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  useEffect(() => {
    const listener = (e) => {
      // Use e.code to ignore keyboard layout (English vs Russian)
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        handleInput('SPACE');
      }
      if (e.code === 'KeyE') handleInput('LEFT');
      if (e.code === 'KeyI') handleInput('RIGHT');
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [handleInput]);

  if (finished) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-8 text-center">
        <h1 className="text-4xl font-bold mb-4 text-emerald-400">Тест завершен!</h1>
        
        {isSaving ? (
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-lg text-slate-300">Сохранение результатов...</p>
          </div>
        ) : saveError ? (
          <div className="bg-red-900/50 border border-red-500 p-6 rounded-xl max-w-md mb-8">
            <h3 className="text-xl font-bold text-red-400 mb-2">Ошибка сохранения</h3>
            <p className="text-slate-200 mb-4">{saveError}</p>
            <p className="text-sm text-slate-400">Пожалуйста, сообщите администратору или проверьте настройки Supabase URL.</p>
          </div>
        ) : (
          <p className="text-lg mb-8 text-slate-300">Данные успешно сохранены. Спасибо за участие.</p>
        )}

        <div className="flex gap-4 mt-4">
          <button 
            onClick={onComplete}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-colors"
          >
            Вернуться в меню
          </button>
          
          <button 
            onClick={handleShare}
            className={`px-8 py-3 rounded-lg font-bold text-lg transition-colors flex items-center gap-2 ${
              isCopied 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
            }`}
          >
            {isCopied ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                Скопировано!
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                Поделиться
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Instruction Screen
  if (isInstruction) {
    return (
      <div 
        className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-8 text-center max-w-5xl mx-auto cursor-pointer"
        onClick={() => handleInput('SPACE')} // Allow click to start
      >
        <h2 className="text-2xl font-bold mb-4 text-blue-400">{currentBlock.title}</h2>
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-2xl mb-6 select-none w-full max-w-3xl">
          <pre className="whitespace-pre-wrap font-sans text-xl leading-relaxed text-slate-200 mb-4">
            {currentBlock.instruction}
          </pre>
          
          {/* Learning Phase Visualization */}
          {currentBlock.id === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-left border-t border-slate-600 pt-4">
              <div className="bg-slate-900/50 p-4 rounded-lg">
                <h3 className="font-bold text-emerald-400 mb-2 text-center">Башкирские слова (E)</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {BASHKIR_WORDS.map(w => (
                    <span key={w} className="px-2 py-1 bg-emerald-900/40 border border-emerald-500/30 rounded text-sm text-emerald-100">{w}</span>
                  ))}
                </div>
              </div>
              <div className="bg-slate-900/50 p-4 rounded-lg">
                <h3 className="font-bold text-blue-400 mb-2 text-center">Русские слова (I)</h3>
                <div className="flex flex-wrap gap-2 justify-center">
                  {RUSSIAN_WORDS.map(w => (
                    <span key={w} className="px-2 py-1 bg-blue-900/40 border border-blue-500/30 rounded text-sm text-blue-100">{w}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentBlock.id === 2 && (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 border-t border-slate-600 pt-4">
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <h3 className="font-bold text-emerald-400 mb-2">Коровы (E)</h3>
                  <div className="flex justify-center gap-2">
                     {COW_IMAGES.map((src, i) => (
                       <img key={i} src={src} className="w-16 h-16 object-cover rounded border border-slate-600" alt="cow" />
                     ))}
                  </div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg">
                  <h3 className="font-bold text-blue-400 mb-2">Лошади (I)</h3>
                  <div className="flex justify-center gap-2">
                     {HORSE_IMAGES.map((src, i) => (
                       <img key={i} src={src} className="w-16 h-16 object-cover rounded border border-slate-600" alt="horse" />
                     ))}
                  </div>
                </div>
             </div>
          )}

        </div>
        <div className="animate-pulse text-emerald-400 font-bold text-lg">
          Нажмите ПРОБЕЛ, чтобы начать
        </div>
      </div>
    );
  }

  // Test Screen
  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      {/* Header / Labels */}
      <div className="flex justify-between items-start p-4 md:p-8">
        <div className="text-left w-1/3 text-lg md:text-2xl font-bold uppercase tracking-wider text-blue-400 break-words">
          {currentBlock.leftCategories.map(c => (
             <div key={c} className="mb-1">{c === Category.BASHKIR ? 'Башкиры' : c === Category.RUSSIAN ? 'Русские' : c === Category.HORSE ? 'Лошади' : 'Коровы'}</div>
          ))}
        </div>

        {/* Progress Indicator */}
        <div className="flex flex-col items-center justify-center w-1/3 mt-1">
          <div className="text-slate-500 text-xs md:text-sm font-medium uppercase tracking-widest mb-1">
            Блок {currentBlockIndex + 1} из {BLOCKS.length}
          </div>
          <div className="w-full max-w-[8rem] h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
             <div 
               className="h-full bg-emerald-500 transition-all duration-300 ease-out" 
               style={{ width: `${(trialCount / currentBlock.trials) * 100}%` }}
             ></div>
          </div>
          <div className="text-slate-600 text-[10px] md:text-xs">
            {trialCount} / {currentBlock.trials}
          </div>
        </div>

        <div className="text-right w-1/3 text-lg md:text-2xl font-bold uppercase tracking-wider text-blue-400 break-words">
          {currentBlock.rightCategories.map(c => (
             <div key={c} className="mb-1">{c === Category.BASHKIR ? 'Башкиры' : c === Category.RUSSIAN ? 'Русские' : c === Category.HORSE ? 'Лошади' : 'Коровы'}</div>
          ))}
        </div>
      </div>

      {/* Stimulus Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative pointer-events-none">
        {mistake && (
          <div className="absolute text-red-500 text-8xl md:text-9xl font-bold animate-bounce opacity-80 z-20">
            X
          </div>
        )}
        
        {currentStimulus?.type === StimulusType.WORD && (
          <div className="text-4xl md:text-6xl font-bold text-white drop-shadow-md text-center px-4">
            {currentStimulus.content}
          </div>
        )}

        {currentStimulus?.type === StimulusType.IMAGE && (
          <div className="flex flex-col items-center">
            <img 
              src={currentStimulus.content} 
              alt="stimulus" 
              className="max-h-[300px] md:max-h-[400px] w-auto rounded-lg shadow-2xl border-4 border-slate-700"
            />
          </div>
        )}
      </div>

      {/* Footer Instructions & Controls */}
      <div className="p-4 flex gap-4 w-full h-24 md:h-auto z-10">
        <button 
          className="flex-1 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600 rounded-xl flex items-center justify-center active:bg-slate-700 transition-colors"
          onClick={() => handleInput('LEFT')}
        >
          <span className="text-2xl font-bold text-blue-300 block md:hidden">ЛЕВО</span>
          <span className="text-slate-400 hidden md:block">Нажмите <b>E</b></span>
        </button>
        <button 
          className="flex-1 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-600 rounded-xl flex items-center justify-center active:bg-slate-700 transition-colors"
          onClick={() => handleInput('RIGHT')}
        >
           <span className="text-2xl font-bold text-blue-300 block md:hidden">ПРАВО</span>
           <span className="text-slate-400 hidden md:block">Нажмите <b>I</b></span>
        </button>
      </div>
    </div>
  );
};

export default IATTest;