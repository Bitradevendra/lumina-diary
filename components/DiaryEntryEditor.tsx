import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DiaryEntry, MoodType, AIAnalysis, DiaryMedia } from '../types';
import { Icons, MOOD_COLORS } from '../constants';
import { analyzeDiaryEntry, generateSpeech, summarizeVoiceToText } from '../services/geminiService';

interface Props {
  entry: DiaryEntry | null;
  date: string;
  onSave: (entry: DiaryEntry) => void;
  onBack: () => void;
  voiceInput?: string;
  apiKey?: string;
}

const MoodSelector: React.FC<{ selected: MoodType; onSelect: (m: MoodType) => void }> = ({ selected, onSelect }) => {
  const moods: MoodType[] = ['ecstatic', 'happy', 'neutral', 'sad', 'anxious', 'angry', 'tired'];
  return (
    <div className="flex gap-1.5 md:gap-2 overflow-x-auto py-0.5 no-scrollbar px-1">
      {moods.map((m) => (
        <button
          key={m}
          onClick={() => onSelect(m)}
          className={`px-2 py-0.5 md:px-3 md:py-1 rounded-full text-[10px] md:text-xs font-medium capitalize transition-all whitespace-nowrap shrink-0 ${
            selected === m
              ? `${MOOD_COLORS[m]} border shadow-sm scale-105`
              : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );
};

const DiaryEntryEditor: React.FC<Props> = ({ entry, date, onSave, onBack, voiceInput, apiKey }) => {
  const [content, setContent] = useState(entry?.content || '');
  const [title, setTitle] = useState(entry?.title || '');
  const [mood, setMood] = useState<MoodType>(entry?.mood || 'neutral');
  const [media, setMedia] = useState<DiaryMedia[]>(() => {
    if (entry?.media) return entry.media;
    if (entry?.images) {
      return entry.images.map(img => ({
        id: crypto.randomUUID(),
        type: 'image',
        url: img,
        timestamp: Date.now()
      }));
    }
    return [];
  });
  
  const [tags, setTags] = useState<string[]>(entry?.tags || []);
  const [newTag, setNewTag] = useState('');

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis | undefined>(entry?.aiAnalysis);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [isPlayingAnalysis, setIsPlayingAnalysis] = useState(false);
  const [isReadMode, setIsReadMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preRefineContent, setPreRefineContent] = useState<string | null>(null);
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  
  // Lightbox State
  const [lightboxMedia, setLightboxMedia] = useState<DiaryMedia | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (voiceInput) {
      const newContent = content ? `${content}\n\n${voiceInput}` : voiceInput;
      setContent(newContent);
    }
  }, [voiceInput]);

  // --- Auto Save Logic ---
  const handleSave = useCallback(() => {
    setIsSaving(true);
    const newEntry: DiaryEntry = {
      id: entry?.id || crypto.randomUUID(),
      date,
      content,
      title: title || 'Untitled Entry',
      mood,
      media,
      tags,
      aiAnalysis: analysis,
      lastModified: Date.now()
    };
    onSave(newEntry);
    
    setTimeout(() => {
        setIsSaving(false);
        setLastSaved(new Date());
    }, 500);
  }, [entry?.id, date, content, title, mood, media, tags, analysis, onSave]);

  useEffect(() => {
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    if (content || title || media.length > 0 || tags.length > 0) {
        setIsSaving(true); 
        autoSaveTimerRef.current = setTimeout(() => {
            handleSave();
        }, 1000); 
    }
    return () => {
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [content, title, mood, media, tags, handleSave]);


  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video/');
      const reader = new FileReader();
      reader.onloadend = () => {
        const newMedia: DiaryMedia = {
          id: crypto.randomUUID().split('-')[0], 
          type: isVideo ? 'video' : 'image',
          url: reader.result as string,
          timestamp: Date.now()
        };
        setMedia(prev => [...prev, newMedia]);
      };
      reader.readAsDataURL(file);
    }
  };

  const insertMediaTag = (mediaId: string) => {
    const tag = `[[media:${mediaId}]]`;
    const textarea = textareaRef.current;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + tag + content.substring(end);
      setContent(newContent);
      
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + tag.length, start + tag.length);
      }, 0);
    } else {
      setContent(prev => prev + `\n${tag}`);
    }
  };
  
  const handleAddTag = () => {
      if (newTag.trim() && !tags.includes(newTag.trim())) {
          setTags([...tags, newTag.trim()]);
          setNewTag('');
      }
  };
  
  const removeTag = (tagToRemove: string) => {
      setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleRunAnalysis = async () => {
    if (!content.trim()) return;
    setIsAnalyzing(true);
    const result = await analyzeDiaryEntry(content, apiKey);
    setAnalysis(result);
    const combinedTags = Array.from(new Set([...tags, ...result.keywords]));
    setTags(combinedTags);
    setIsAnalyzing(false);
    setShowFullAnalysis(false); 
  };

  const handleSummarize = async () => {
      if (!content.trim()) return;
      setPreRefineContent(content); 
      setIsAnalyzing(true);
      const summary = await summarizeVoiceToText(content, apiKey);
      setContent(summary);
      setIsAnalyzing(false);
  };

  const handleUndoRefine = () => {
      if (preRefineContent) {
          setContent(preRefineContent);
          setPreRefineContent(null);
      }
  };
  
  const playAnalysisAudio = async () => {
    if (!analysis || isPlayingAnalysis) return;
    setIsPlayingAnalysis(true);
    
    const textToSpeak = `Here is your insight. ${analysis.psychologicalInsight}. My advice is: ${analysis.actionableAdvice}`;
    
    const base64Audio = await generateSpeech(textToSpeak, apiKey);
    if (base64Audio) {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        
        try {
            const binaryString = atob(base64Audio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const dataInt16 = new Int16Array(bytes.buffer);
            const buffer = audioContextRef.current.createBuffer(1, dataInt16.length, 24000);
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < dataInt16.length; i++) {
                channelData[i] = dataInt16[i] / 32768.0;
            }

            const source = audioContextRef.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContextRef.current.destination);
            source.start(0);
            
            source.onended = () => setIsPlayingAnalysis(false);
        } catch (e) {
            console.error("Audio playback error", e);
            setIsPlayingAnalysis(false);
        }
    } else {
        setIsPlayingAnalysis(false);
    }
  };

  const renderReadMode = () => {
    const parts = content.split(/(\[\[media:[a-zA-Z0-9-]+\]\])/g);
    
    return (
      <div className="prose prose-stone max-w-none">
        {parts.map((part, index) => {
          const match = part.match(/\[\[media:([a-zA-Z0-9-]+)\]\]/);
          if (match) {
            const mediaId = match[1];
            const item = media.find(m => m.id === mediaId);
            if (item) {
              return (
                <span 
                    key={index}
                    onClick={(e) => {
                        e.stopPropagation();
                        setLightboxMedia(item);
                    }}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-1 my-1 text-indigo-600 hover:text-indigo-800 bg-indigo-50/50 hover:bg-indigo-100 rounded cursor-pointer transition-colors align-baseline select-none border-b border-indigo-200 hover:border-indigo-400 group"
                    title="Click to view full size"
                >
                    {item.type === 'video' ? <Icons.Video className="w-3.5 h-3.5" /> : <Icons.Image className="w-3.5 h-3.5" />}
                    <span className="text-base font-serif font-medium underline decoration-indigo-300 decoration-1 underline-offset-2 group-hover:decoration-indigo-500">
                        View {item.type === 'video' ? 'Video' : 'Image'}
                    </span>
                </span>
              );
            }
            return <span key={index} className="text-red-400 text-xs bg-red-50 px-1 rounded border border-red-100 font-mono">[Missing Media: {mediaId}]</span>;
          }
          if (!part) return null;
          return <p key={index} className="whitespace-pre-wrap text-base md:text-lg leading-relaxed text-stone-700 font-serif mb-4">{part}</p>;
        })}
      </div>
    );
  };

  const renderToolsPanel = (isMobile: boolean) => (
    <div className={`flex flex-col h-full ${isMobile ? 'bg-white' : 'bg-stone-50 border-l border-stone-200'}`}>
        {isMobile && (
            <div className="flex items-center justify-between p-4 border-b border-stone-100 bg-white shrink-0">
                <span className="text-sm font-bold text-stone-800 uppercase tracking-wider">Assets & Tools</span>
                <button onClick={() => setIsMobileToolsOpen(false)} className="p-1 hover:bg-stone-100 rounded-full text-stone-500">
                    <Icons.X className="w-5 h-5" />
                </button>
            </div>
        )}

        <div className="flex flex-col flex-1 min-h-0">
            <div className="p-3 md:p-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center shrink-0">
                <div>
                    <span className="text-xs font-bold text-stone-500 uppercase tracking-widest block">Assets</span>
                    <span className="text-[10px] text-stone-400 font-medium">For {new Date(date).toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                </div>
                <label className="cursor-pointer px-3 py-1.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-md flex items-center gap-1.5">
                    <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
                    <Icons.Image className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">Add</span>
                </label>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 md:p-4 gap-3 flex flex-col no-scrollbar">
                <div className={`grid gap-3 ${isMobile ? 'grid-cols-3' : 'grid-cols-1'}`}>
                    {media.length === 0 ? (
                        <div className={`text-center text-stone-400 py-4 md:py-8 text-xs md:text-sm w-full ${isMobile ? 'col-span-3' : 'col-span-1'}`}>
                            No assets.<br/>Upload photos/videos.
                        </div>
                    ) : (
                        media.map((item) => (
                            <div key={item.id} className="group relative rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shadow-sm hover:shadow-md transition-all cursor-pointer aspect-square" onClick={() => setLightboxMedia(item)}>
                                {item.type === 'video' ? (
                                    <video src={item.url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                                ) : (
                                    <img src={item.url} alt="asset" className="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
                                )}
                                
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                                    <button 
                                        onClick={() => insertMediaTag(item.id)}
                                        className="p-1.5 bg-white text-indigo-600 rounded-full hover:scale-110 transition-transform shadow-lg"
                                        title="Insert at cursor"
                                    >
                                        <Icons.Paperclip className="w-3.5 h-3.5" />
                                    </button>
                                    <button 
                                        onClick={() => setLightboxMedia(item)}
                                        className="p-1.5 bg-white text-stone-600 rounded-full hover:scale-110 transition-transform shadow-lg"
                                        title="View Full Size"
                                    >
                                        <Icons.Eye className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                
                                <div className="absolute top-1 left-1 right-1 flex justify-between items-start pointer-events-none">
                                    <span className="bg-black/60 text-white text-[8px] font-mono px-1 py-0.5 rounded backdrop-blur-sm truncate max-w-[60px]">
                                        {item.id.substring(0,4)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="p-3 md:p-4 border-t border-stone-200 bg-stone-50 flex gap-2 shrink-0 pb-safe">
                <button 
                    onClick={handleSummarize}
                    disabled={isAnalyzing}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:border-purple-400 hover:text-purple-600 transition-all text-sm shadow-sm font-medium"
                >
                    {isAnalyzing ? <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div> : <Icons.Sparkles className="w-4 h-4" />}
                    Refine
                </button>
                
                 <button 
                    onClick={handleRunAnalysis}
                    disabled={isAnalyzing}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-stone-200 text-stone-600 hover:border-indigo-400 hover:text-indigo-600 transition-all text-sm shadow-sm font-medium"
                >
                    <Icons.Brain className="w-4 h-4" />
                    Analyze
                </button>
                
                {preRefineContent && (
                    <button 
                        onClick={handleUndoRefine}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-stone-200 text-stone-600 hover:bg-stone-300 transition-all text-sm font-medium"
                        title="Undo Refinement"
                    >
                        Undo
                    </button>
                )}
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-sm md:shadow-xl overflow-hidden animate-fade-in relative">
      {/* Lightbox Overlay */}
      {lightboxMedia && (
        <div 
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setLightboxMedia(null)}
        >
            <button 
                className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-all"
                onClick={() => setLightboxMedia(null)}
            >
                <Icons.X className="w-8 h-8" />
            </button>
            <div 
                className="max-w-7xl max-h-[90vh] w-full flex flex-col items-center justify-center gap-4"
                onClick={e => e.stopPropagation()}
            >
                {lightboxMedia.type === 'video' ? (
                    <video 
                        src={lightboxMedia.url} 
                        controls 
                        autoPlay 
                        className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" 
                    />
                ) : (
                    <img 
                        src={lightboxMedia.url} 
                        alt="Full view" 
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
                    />
                )}
            </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-3 md:p-6 border-b border-stone-100 flex justify-between items-center bg-white z-20 sticky top-0 shadow-sm shrink-0 gap-2">
        <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
            <button onClick={onBack} className="p-2 -ml-2 hover:bg-stone-100 rounded-full transition-colors text-stone-500 shrink-0">
               <Icons.ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <div className="flex flex-col min-w-0">
                <h2 className="text-sm md:text-lg font-serif font-bold text-stone-800 truncate">
                {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' })}
                </h2>
                <div className="flex items-center gap-1.5 h-3 md:h-4">
                    {isSaving ? (
                        <>
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                            <span className="text-[10px] text-indigo-500 font-medium uppercase tracking-wide">Saving...</span>
                        </>
                    ) : lastSaved ? (
                        <>
                            <Icons.Cloud className="w-3 h-3 text-green-500" />
                            <span className="text-[10px] text-stone-400 font-medium">Saved {lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </>
                    ) : null}
                </div>
            </div>
        </div>

        <div className="flex gap-1 md:gap-2 shrink-0">
             {!isReadMode && (
                <button 
                    onClick={() => setIsMobileToolsOpen(true)} 
                    className="md:hidden p-2 bg-stone-50 text-stone-600 rounded-full hover:bg-stone-100 transition-colors border border-stone-100"
                    title="Open Tools"
                >
                    <Icons.Sparkles className="w-4 h-4 text-indigo-500" />
                </button>
            )}

            <button 
                onClick={() => setIsReadMode(!isReadMode)} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium transition-all ${isReadMode ? 'bg-indigo-100 text-indigo-700' : 'bg-stone-100 text-stone-600'}`}
            >
                {isReadMode ? <><Icons.Edit className="w-3.5 h-3.5"/> <span className="hidden sm:inline">Edit</span></> : <><Icons.Eye className="w-3.5 h-3.5"/> <span className="hidden sm:inline">Read</span></>}
            </button>
            <button onClick={handleSave} className="p-2 hover:bg-green-50 text-green-600 rounded-full transition-colors" title="Manual Save">
              <Icons.Save className="w-5 h-5" />
            </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <div className="flex-1 overflow-y-auto px-4 py-6 md:p-10 bg-stone-50/50 scroll-smooth">
            <div className="mb-4 md:mb-6">
                <div className="mb-2 md:mb-3 -mx-1">
                     <MoodSelector selected={mood} onSelect={setMood} />
                </div>
                {isReadMode ? (
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-stone-800 mb-4 md:mb-6 leading-tight">{title || 'Untitled'}</h1>
                ) : (
                    <input
                        type="text"
                        placeholder="Title your day..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full text-3xl md:text-4xl font-serif font-bold text-stone-800 bg-transparent outline-none placeholder:text-stone-300 mb-4 md:mb-6 leading-tight"
                    />
                )}
                
                {!isReadMode ? (
                    <div className="flex flex-wrap items-center gap-2 mb-6">
                        {tags.map(t => (
                            <span key={t} className="flex items-center gap-1 px-2 py-1 bg-stone-200 text-stone-600 rounded-md text-xs font-medium">
                                #{t}
                                <button onClick={() => removeTag(t)} className="hover:text-red-500 p-0.5"><Icons.X className="w-3 h-3"/></button>
                            </span>
                        ))}
                        <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-md px-2 py-1">
                            <span className="text-stone-400 text-xs">#</span>
                            <input 
                                type="text" 
                                value={newTag}
                                onChange={e => setNewTag(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                                placeholder="Add tag"
                                className="text-xs bg-transparent outline-none w-16 text-stone-600"
                            />
                            <button onClick={handleAddTag} className="text-indigo-500 p-0.5"><Icons.Plus className="w-3 h-3"/></button>
                        </div>
                    </div>
                ) : (
                   <div className="flex flex-wrap gap-2 mb-6">
                        {tags.map(t => (
                            <span key={t} className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded-md text-xs font-bold">#{t}</span>
                        ))}
                   </div>
                )}
            </div>

            {isReadMode ? (
                renderReadMode()
            ) : (
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Start writing... Use the sidebar to insert media tags."
                    className="w-full min-h-[50vh] bg-transparent outline-none text-base md:text-lg leading-relaxed text-stone-700 resize-none font-serif pb-20"
                />
            )}

            {analysis && (
                <div className="mt-8 md:mt-12 pt-8 border-t border-stone-200 pb-20">
                    <div className="bg-white rounded-2xl shadow-xl ring-1 ring-stone-100 overflow-hidden">
                        {!showFullAnalysis ? (
                            <div 
                                onClick={() => setShowFullAnalysis(true)} 
                                className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 cursor-pointer hover:bg-indigo-100 transition-colors flex justify-between items-center"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-full text-indigo-600 shadow-sm shrink-0">
                                        <Icons.Sparkles className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="font-bold text-indigo-900 text-sm">AI Insight Ready</h3>
                                        <p className="text-stone-600 text-xs mt-0.5 truncate">{analysis.summary}</p>
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-indigo-600 px-3 py-1 bg-white rounded-full shadow-sm shrink-0">View</span>
                            </div>
                        ) : (
                            <div className="p-6 animate-fade-in">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg md:text-xl font-serif font-bold text-indigo-900">Dr. Lumina's Insight</h3>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${analysis.sentimentScore > 70 ? 'bg-green-100 text-green-700' : analysis.sentimentScore < 40 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {analysis.sentimentScore}
                                        </span>
                                        <button onClick={playAnalysisAudio} disabled={isPlayingAnalysis} className="p-2 bg-indigo-50 text-indigo-600 rounded-full hover:bg-indigo-100 transition-colors">
                                            {isPlayingAnalysis ? <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div> : <Icons.Speaker />}
                                        </button>
                                        <button onClick={() => setShowFullAnalysis(false)} className="p-2 text-stone-400 hover:text-stone-600">
                                            <Icons.X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                                
                                <p className="text-stone-600 leading-relaxed mb-4 italic border-l-4 border-indigo-200 pl-4 text-sm md:text-base">
                                    "{analysis.psychologicalInsight}"
                                </p>
                                
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <h4 className="text-sm font-bold text-indigo-800 uppercase tracking-wider mb-1">Actionable Advice</h4>
                                    <p className="text-indigo-900 text-sm md:text-base">{analysis.actionableAdvice}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {!isReadMode && isMobileToolsOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:hidden animate-fade-in">
                <div className="absolute inset-0 bg-stone-900/40 backdrop-blur-sm transition-opacity" onClick={() => setIsMobileToolsOpen(false)} />
                <div className="relative w-full max-w-xs bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh] z-10">
                    {renderToolsPanel(true)}
                </div>
            </div>
        )}

        {!isReadMode && (
            <div className="hidden md:flex w-80 shrink-0 h-full relative z-10">
                {renderToolsPanel(false)}
            </div>
        )}
      </div>
    </div>
  );
};

export default DiaryEntryEditor;