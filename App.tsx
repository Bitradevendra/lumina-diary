import React, { useState, useEffect, useMemo } from 'react';
import { DiaryEntry, AppView, Reminder, UserProfile } from './types';
import CalendarView from './components/CalendarView';
import DiaryEntryEditor from './components/DiaryEntryEditor';
import VoiceCommandBar from './components/VoiceCommandBar';
import LoginPage from './components/LoginPage';
import { ApiKeyOnboarding } from './components/ApiKeyOnboarding';
import { Icons } from './constants';
import { format, subDays } from 'date-fns';
import JSZip from 'jszip';
import { 
    subscribeToAuth, 
    logoutUser, 
    subscribeToEntries, 
    saveDiaryEntryToCloud, 
    subscribeToReminders, 
    saveReminderToCloud,
    saveUserSettings,
    getUserSettings
} from './services/firebase';

const App: React.FC = () => {
  // --- Auth State ---
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // --- Data State ---
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);

  // --- Settings State ---
  const [wakeWord, setWakeWord] = useState('Hey Lumina');
  const [stopWord, setStopWord] = useState('Exit');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showSettingsSuccess, setShowSettingsSuccess] = useState(false);

  // --- UI State ---
  const [view, setView] = useState<AppView>(AppView.CALENDAR);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentDateView, setCurrentDateView] = useState<Date>(new Date()); 
  const [activeVoiceInput, setActiveVoiceInput] = useState<string>('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- 1. Auth & Data Subscription ---
  useEffect(() => {
    const unsubscribeAuth = subscribeToAuth(async (currentUser) => {
        if (currentUser) {
            // Load Settings FIRST before setting user to avoid flickering onboarding if possible
            const settings = await getUserSettings(currentUser.id);
            if (settings) {
                if (settings.wakeWord) setWakeWord(settings.wakeWord);
                if (settings.stopWord) setStopWord(settings.stopWord);
                if (settings.geminiApiKey) setGeminiApiKey(settings.geminiApiKey);
            }
            setUser(currentUser);
        } else {
            setUser(null);
            setGeminiApiKey('');
        }
        setLoadingAuth(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // --- 2. Cloud Sync Listeners ---
  useEffect(() => {
      if (!user) {
          setEntries([]);
          setReminders([]);
          return;
      }

      const unsubscribeEntries = subscribeToEntries(user.id, (cloudEntries) => {
          setEntries(cloudEntries);
      });

      const unsubscribeReminders = subscribeToReminders(user.id, (cloudReminders) => {
          setReminders(cloudReminders);
      });

      return () => {
          unsubscribeEntries();
          unsubscribeReminders();
      };
  }, [user]);


  const handleLogout = async () => {
      await logoutUser();
      setIsMobileMenuOpen(false);
      setGeminiApiKey('');
  };

  const handleSaveSettings = async () => {
      if (!user) return;
      await saveUserSettings(user.id, { wakeWord, stopWord, geminiApiKey });
      setShowSettingsSuccess(true);
      setTimeout(() => setShowSettingsSuccess(false), 2000);
  };

  const handleOnboardingComplete = (key: string) => {
      setGeminiApiKey(key);
      // Settings are saved inside the component, we just update local state to dismiss modal
  };

  // Derived state for all available tags
  const allTags = useMemo(() => {
      const tags = new Set<string>();
      entries.forEach(e => e.tags.forEach(t => tags.add(t)));
      return Array.from(tags).sort();
  }, [entries]);
  
  // Filtered entries for view (Search + Tags)
  const filteredEntries = useMemo(() => {
      let result = entries;

      if (selectedTagFilter) {
          result = result.filter(e => e.tags.includes(selectedTagFilter));
      }

      if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          result = result.filter(e => 
              e.title?.toLowerCase().includes(query) || 
              e.content?.toLowerCase().includes(query) || 
              e.tags.some(t => t.toLowerCase().includes(query)) ||
              e.aiAnalysis?.summary.toLowerCase().includes(query)
          );
      }

      return result;
  }, [entries, selectedTagFilter, searchQuery]);

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setView(AppView.EDITOR);
    setIsMobileMenuOpen(false); 
  };
  
  const handleAddReminder = async (date: Date, message: string) => {
      if (!user) return;
      try {
        const newReminder: Reminder = {
            id: crypto.randomUUID(),
            date: date.toISOString(),
            message,
            createdAt: Date.now()
        };
        await saveReminderToCloud(user.id, newReminder);
        alert("Reminder set for " + format(date, 'MMMM d'));
      } catch (e) {
          console.error("Error adding reminder", e);
      }
  };

  const handleSaveEntry = async (entry: DiaryEntry) => {
    if (!user) return;
    try {
        await saveDiaryEntryToCloud(user.id, entry);
    } catch (e) {
        console.error("Error saving entry", e);
    }
  };

  const getEntryForDate = (date: Date) => {
    try {
        const dateStr = format(date, 'yyyy-MM-dd');
        return entries.find(e => format(new Date(e.date), 'yyyy-MM-dd') === dateStr) || null;
    } catch (e) {
        console.error("Error getting entry for date", e);
        return null;
    }
  };
  
  const handleExportData = async () => {
      try {
          const zip = new JSZip();
          entries.forEach(entry => {
              const safeTitle = (entry.title || 'untitled').replace(/[^a-z0-9]/gi, '_');
              const fileName = `${entry.date}_${safeTitle}.txt`;
              const content = `Date: ${entry.date}
Title: ${entry.title}
Mood: ${entry.mood}
Tags: ${entry.tags.join(', ')}

${entry.content}

-- AI Insight --
Summary: ${entry.aiAnalysis?.summary || 'N/A'}
Score: ${entry.aiAnalysis?.sentimentScore || 'N/A'}
Insight: ${entry.aiAnalysis?.psychologicalInsight || 'N/A'}
Advice: ${entry.aiAnalysis?.actionableAdvice || 'N/A'}
`;
              zip.file(fileName, content);
          });
          
          const content = await zip.generateAsync({ type: "blob" });
          const url = window.URL.createObjectURL(content);
          const link = document.createElement('a');
          link.href = url;
          link.download = `lumina_export_${format(new Date(), 'yyyy-MM-dd')}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
      } catch (e) {
          console.error("Export failed", e);
          alert("Failed to export data.");
      }
  };

  const handleVoiceCommand = (intent: 'save' | 'new_entry' | 'analyze' | 'text_input', text?: string) => {
    try {
        if (intent === 'new_entry') {
          setSelectedDate(new Date());
          setView(AppView.EDITOR);
        } else if (intent === 'save') {
          console.log("Global save command received"); 
        } else if (intent === 'text_input' && text) {
          if (view === AppView.EDITOR) {
             setActiveVoiceInput(text);
             setTimeout(() => setActiveVoiceInput(''), 100);
          } else {
             const today = new Date();
             setSelectedDate(today);
             setView(AppView.EDITOR);
             setTimeout(() => {
                setActiveVoiceInput(text);
                setTimeout(() => setActiveVoiceInput(''), 100);
             }, 100);
          }
        }
    } catch (e) {
        console.error("Voice command error", e);
    }
  };

  if (loadingAuth) {
      return (
          <div className="h-screen w-screen flex items-center justify-center bg-[#FDFCF8]">
              <div className="flex flex-col items-center">
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mb-4 animate-bounce">
                    <Icons.Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-stone-400 text-sm font-medium">Connecting to cloud...</p>
              </div>
          </div>
      );
  }

  if (!user) {
      return <LoginPage />;
  }

  return (
    <div className="h-[100dvh] bg-[#FDFCF8] text-stone-800 font-sans selection:bg-indigo-100 selection:text-indigo-900 overflow-hidden relative flex flex-col md:flex-row">
      
      {/* Onboarding Modal - Appears if logged in but no API Key */}
      {user && !geminiApiKey && (
        <ApiKeyOnboarding userId={user.id} onComplete={handleOnboardingComplete} />
      )}

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-stone-200 z-30 shrink-0 shadow-sm">
         <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
            <span className="font-serif text-lg font-bold text-indigo-900">Lumina</span>
         </div>
         <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 -mr-2 text-stone-600 active:bg-stone-100 rounded-full">
            {isMobileMenuOpen ? <Icons.X className="w-6 h-6"/> : <Icons.Menu className="w-6 h-6" />}
         </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
          <div className="fixed inset-0 z-40 bg-black/40 md:hidden backdrop-blur-sm transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`
          fixed inset-y-0 left-0 z-50 w-72 pt-8 pb-6 px-6 border-r border-stone-200 bg-white h-full overflow-y-auto no-scrollbar shadow-2xl md:shadow-none
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          md:translate-x-0 md:static md:flex md:flex-col
      `}>
         <h1 className="hidden md:flex font-serif text-3xl font-bold text-indigo-900 mb-8 items-center gap-2">
           <span className="w-3 h-3 rounded-full bg-indigo-500"></span>
           Lumina
         </h1>

         <div className="md:hidden flex justify-between items-center mb-8">
            <span className="font-serif text-xl font-bold text-indigo-900">Menu</span>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-1"><Icons.X className="w-6 h-6 text-stone-400"/></button>
         </div>
         
         <div className="mb-6 flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
             <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full border border-white shadow-sm object-cover" />
             <div className="flex-1 min-w-0">
                 <p className="text-sm font-bold text-stone-800 truncate">{user.name}</p>
                 <p className="text-xs text-stone-500 truncate">{user.email}</p>
             </div>
         </div>

         <nav className="space-y-2">
           <button 
             onClick={() => { setView(AppView.CALENDAR); setIsMobileMenuOpen(false); }}
             className={`w-full text-left px-4 py-3 rounded-xl transition-all font-medium flex items-center gap-3 ${view === AppView.CALENDAR ? 'bg-indigo-50 text-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}
           >
             <Icons.Calendar className="w-4 h-4" />
             My Journey
           </button>
           <button 
              onClick={() => {
                  setSelectedDate(new Date());
                  setView(AppView.EDITOR);
                  setIsMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all font-medium flex items-center gap-3 ${view === AppView.EDITOR ? 'bg-indigo-50 text-indigo-600' : 'text-stone-500 hover:bg-stone-50'}`}
           >
             <Icons.Pen className="w-4 h-4" />
             Today's Entry
           </button>
         </nav>

         {/* Advanced Settings */}
         <div className="mt-8 mb-4 bg-stone-50 p-4 rounded-2xl border border-stone-100">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3">Settings</h4>
            <div className="space-y-3">
                <div>
                    <label className="text-[10px] text-stone-500 font-bold uppercase mb-1 block">Wake Word</label>
                    <input 
                      type="text" 
                      value={wakeWord} 
                      onChange={(e) => setWakeWord(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                      placeholder="e.g. Hey Lumina"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-stone-500 font-bold uppercase mb-1 block">Stop Word</label>
                    <input 
                      type="text" 
                      value={stopWord} 
                      onChange={(e) => setStopWord(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 transition-all"
                      placeholder="e.g. Exit"
                    />
                </div>
                <div>
                    <label className="text-[10px] text-stone-500 font-bold uppercase mb-1 block">Gemini API Key</label>
                    <input 
                      type="password" 
                      value={geminiApiKey} 
                      onChange={(e) => setGeminiApiKey(e.target.value)}
                      className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-stone-700 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all"
                      placeholder="AIza..."
                    />
                    <p className="text-[9px] text-stone-400 mt-1">AI services run under your account quota.</p>
                </div>
                <button 
                  onClick={handleSaveSettings}
                  className={`w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all mt-2 ${showSettingsSuccess ? 'bg-green-500 text-white' : 'bg-stone-800 text-white hover:bg-stone-900'}`}
                >
                  {showSettingsSuccess ? 'Saved!' : 'Save Settings'}
                </button>
            </div>
         </div>

         <div className="mt-auto space-y-4">
           <button 
              onClick={handleExportData}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-stone-50 hover:bg-stone-100 text-stone-600 transition-colors text-sm font-medium"
           >
              <Icons.Download className="w-4 h-4" />
              Export Data
           </button>
           
           <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors text-sm font-medium"
           >
              <Icons.MicOff className="w-4 h-4" /> 
              Sign Out
           </button>
         </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 h-full relative overflow-hidden bg-stone-50/50 flex flex-col">
          <div className="flex-1 w-full overflow-y-auto no-scrollbar pb-32 md:pb-6 p-2 md:p-6 lg:p-8"> 
            {view === AppView.CALENDAR ? (
              <CalendarView 
                currentDate={currentDateView}
                onDateChange={setCurrentDateView}
                entries={filteredEntries}
                reminders={reminders}
                onSelectDate={handleDateSelect}
                onAddReminder={(d, m) => handleAddReminder(d, m || "Check in")}
                tags={allTags}
                selectedTag={selectedTagFilter}
                onSelectTag={setSelectedTagFilter}
                searchQuery={searchQuery}
                onSearch={setSearchQuery}
              />
            ) : (
              <DiaryEntryEditor 
                key={format(selectedDate, 'yyyy-MM-dd')}
                date={format(selectedDate, 'yyyy-MM-dd')}
                entry={getEntryForDate(selectedDate)}
                onSave={handleSaveEntry}
                onBack={() => setView(AppView.CALENDAR)}
                voiceInput={activeVoiceInput}
                apiKey={geminiApiKey} 
              />
            )}
        </div>
      </main>

      <VoiceCommandBar 
          onCommand={handleVoiceCommand} 
          wakeWord={wakeWord}
          stopWord={stopWord}
          apiKey={geminiApiKey}
      />

    </div>
  );
};

export default App;