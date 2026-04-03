import React, { useState } from 'react';
import { Icons } from '../constants';
import { saveUserSettings } from '../services/firebase';

interface Props {
  userId: string;
  onComplete: (key: string) => void;
}

export const ApiKeyOnboarding: React.FC<Props> = ({ userId, onComplete }) => {
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const handleSave = async () => {
    if (!apiKey.trim()) return;
    setIsSaving(true);
    try {
      // We only save the key, preserving other settings if they exist is handled by merge:true in service
      await saveUserSettings(userId, { geminiApiKey: apiKey.trim() });
      onComplete(apiKey.trim());
    } catch (e) {
      console.error("Failed to save key", e);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-md animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white text-center">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Icons.Brain className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-serif font-bold">Activate AI Assistant</h2>
          <p className="text-indigo-100 text-sm mt-1">Connect your Google Account to power Lumina</p>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 flex-1">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <p className="text-stone-600 font-medium">To keep your data private and secure, Lumina uses your own personal Google API Key.</p>
                <p className="text-stone-400 text-xs">This ensures all AI processing happens under your account and control.</p>
              </div>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-start gap-3">
                 <div className="bg-green-100 text-green-700 p-1.5 rounded-full shrink-0 mt-0.5">
                    <Icons.Check className="w-4 h-4" />
                 </div>
                 <div className="text-sm text-stone-600">
                    <span className="font-bold text-stone-800">Free of charge.</span><br/>
                    Google provides a generous free tier for personal use.
                 </div>
              </div>

              <button 
                onClick={() => {
                    window.open('https://aistudio.google.com/app/apikey', '_blank');
                    setStep(2);
                }}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <span>Get My API Key</span>
                <Icons.ChevronRight className="w-4 h-4" />
              </button>
              <p className="text-[10px] text-center text-stone-400">Opens Google AI Studio in a new tab</p>
            </div>
          ) : (
            <div className="space-y-6">
               <div className="text-center">
                <h3 className="font-bold text-stone-800 text-lg mb-2">Paste your Key</h3>
                <p className="text-stone-500 text-sm">Copy the key starting with <code className="bg-stone-100 px-1 py-0.5 rounded text-stone-700">AIza...</code> and paste it below.</p>
              </div>

              <div className="relative">
                <input 
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste API Key here..."
                    className="w-full bg-stone-50 border-2 border-stone-200 focus:border-indigo-500 rounded-xl px-4 py-3 outline-none transition-colors font-mono text-sm"
                    autoFocus
                />
              </div>

              <button 
                onClick={handleSave}
                disabled={!apiKey || isSaving}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-stone-300 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                    <>
                        <Icons.Sparkles className="w-4 h-4" />
                        <span>Activate App</span>
                    </>
                )}
              </button>
              
              <button onClick={() => setStep(1)} className="w-full text-stone-400 text-xs font-medium hover:text-stone-600">
                  Go Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};