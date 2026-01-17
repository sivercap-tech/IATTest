import React, { useState, useEffect, useCallback, useRef } from 'react';
import { STIMULI_POOL } from '../constants';
import { Category, StimulusType } from '../types';
import { saveResults } from '../services/supabaseService';

// Helper to get random item
const getRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Configuration of the 6 Blocks
const BLOCKS = [
  {
    id: 1,
    title: "Этап 1: Слова",
    instruction: "Нажимайте 'E' (слева) для БАШКИРСКИХ слов.\nНажимайте 'I' (справа) для РУССКИХ слов.",
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
      
      // Trigger next trial (which might trigger finish if it was the last one)
      // Note: We use the functional update in nextTrial logic, but for 'results' state 
      // we need to be careful. However, nextTrial relies on stateRef or just updates indices.
      // The issue is if nextTrial calls finishTest immediately, 'results' state might not be updated yet in closure.
      // FIX: We will pass the *new* list to nextTrial/finishTest implicitly or explicitly.
      
      // Actually, React state updates are batched. 
      // A safer way for the final trial is to check if it is the final trial inside handleInput 
      // OR let nextTrial handle it but use a ref for results or pass them.
      // For simplicity in this structure: we update state, then call nextTrial.
      // But nextTrial uses 'results' from closure which is stale.
      
      // Let's manually check for end-of-test condition here to pass correct results
      const isLastBlock = state.currentBlockIndex >= BLOCKS.length - 1;
      const isLastTrial = state.trialCount >= block.trials - 1; // -1 because trialCount is 0-indexed visually but logic compares >= trials
      
      if (isLastBlock && isLastTrial) {
         // This was the last trial of the last block
         finishTest([...results, result]);
      } else {
         nextTrial();
      }
    }
  }, [nextTrial, results, finishTest]);

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

        <button 
          onClick={onComplete}
          className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-colors mt-4"
        >
          Вернуться в меню
        </button>
      </div>
    );
  }

  // Instruction Screen
  if (isInstruction) {
    return (
      <div 
        className="flex flex-col items-center justify-center h-screen bg-slate-900 text-white p-8 text-center max-w-2xl mx-auto cursor-pointer"
        onClick={() => handleInput('SPACE')} // Allow click to start
      >
        <h2 className="text-2xl font-bold mb-6 text-blue-400">{currentBlock.title}</h2>
        <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-2xl mb-8 select-none">
          <pre className="whitespace-pre-wrap font-sans text-xl leading-relaxed text-slate-200">
            {currentBlock.instruction}
          </pre>
        </div>
        <div className="animate-pulse text-emerald-400 font-bold text-lg">
          Нажмите ПРОБЕЛ или коснитесь экрана, чтобы начать
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
             <div key={c}>{c === Category.BASHKIR ? 'Башкиры' : c === Category.RUSSIAN ? 'Русские' : c === Category.HORSE ? 'Лошади' : 'Коровы'}</div>
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
             <div key={c}>{c === Category.BASHKIR ? 'Башкиры' : c === Category.RUSSIAN ? 'Русские' : c === Category.HORSE ? 'Лошади' : 'Коровы'}</div>
          ))}
        </div>
      </div>

      {/* Stimulus Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative pointer-events-none">
        {mistake && (
          <div className="absolute text-red-500 text-8xl md:text-9xl font-bold animate-bounce opacity-80">
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