import React, { useState } from 'react';
import { generateImage } from '../services/geminiService';

const ImageGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [size, setSize] = useState<'1K' | '2K' | '4K'>('1K');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt) return;
    
    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      const result = await generateImage({ prompt, size });
      setImageUrl(result);
    } catch (e) {
      setError("Не удалось сгенерировать изображение. Проверьте API ключ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
      <div className="flex items-center gap-2 mb-6 text-emerald-400">
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        <h2 className="text-xl font-bold">Генератор Изображений</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Описание (Промпт)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-24 bg-slate-900 border border-slate-600 rounded-lg p-3 text-white focus:outline-none focus:border-emerald-500 resize-none"
            placeholder="Опишите, что вы хотите увидеть..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-1">Размер</label>
          <div className="flex gap-4">
            {(['1K', '2K', '4K'] as const).map((s) => (
              <label key={s} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="size"
                  value={s}
                  checked={size === s}
                  onChange={() => setSize(s)}
                  className="mr-2 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-slate-200">{s}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading || !prompt}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white py-3 rounded-lg font-bold transition-all"
        >
          {loading ? 'Генерация...' : 'Создать'}
        </button>

        {error && (
          <div className="p-3 bg-red-900/50 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {imageUrl && (
          <div className="mt-6">
             <div className="relative group rounded-lg overflow-hidden border border-slate-600">
               <img src={imageUrl} alt="Generated" className="w-full h-auto" />
               <a 
                 href={imageUrl} 
                 download="generated-image.png"
                 className="absolute bottom-2 right-2 bg-black/70 hover:bg-black text-white px-3 py-1 rounded-md text-sm opacity-0 group-hover:opacity-100 transition-opacity"
               >
                 Скачать
               </a>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGenerator;
