import React, { useEffect, useState, useRef } from 'react';
import { Icons } from '../constants';
import { detectIntent } from '../services/geminiService';

interface VoiceCommandBarProps {
  onCommand: (intent: 'save' | 'new_entry' | 'analyze' | 'text_input', text?: string) => void;
  wakeWord: string;
  stopWord: string;
  apiKey?: string;
}

const VoiceCommandBar: React.FC<VoiceCommandBarProps> = ({ onCommand, wakeWord, stopWord, apiKey }) => {
  const [status, setStatus] = useState<'standby' | 'listening' | 'processing' | 'error'>('standby');
  const [transcript, setTranscript] = useState('');
  const [accumulatedText, setAccumulatedText] = useState('');
  const [feedback, setFeedback] = useState(`Say '${wakeWord}' to start`);
  
  const recognitionRef = useRef<any>(null);
  const accumulatedTextRef = useRef('');
  const wakeWordRef = useRef(wakeWord);
  const stopWordRef = useRef(stopWord);
  const statusRef = useRef(status);
  const isMountedRef = useRef(true);

  // Sync refs
  useEffect(() => {
    wakeWordRef.current = wakeWord;
    if (status === 'standby') {
         setFeedback(`Say '${wakeWord}'`);
    } else if (status === 'listening') {
         setFeedback(`Listening... Say '${stopWord}'`);
    } else if (status === 'processing') {
         setFeedback(`Thinking...`);
    }
  }, [wakeWord, status, stopWord]);

  useEffect(() => {
    stopWordRef.current = stopWord;
  }, [stopWord]);

  useEffect(() => {
      statusRef.current = status;
      if (status === 'standby') {
          setTranscript('');
          setAccumulatedText('');
          accumulatedTextRef.current = '';
      }
  }, [status]);

  const processResult = async (text: string) => {
      // Clean up the text one last time to ensure no stop word artifacts remain
      const currentStopWord = stopWordRef.current.toLowerCase();
      // Regex to remove the stop word if it appears at the very end (case insensitive)
      const stopWordCleaner = new RegExp(`\\b${currentStopWord}[.!?,]?$`, 'i');
      const cleanText = text.replace(stopWordCleaner, '').trim();

      if (!cleanText) {
          setStatus('standby');
          return;
      }
      
      setStatus('processing');
      
      // Heuristic optimization:
      // If text is long (> 10 words), it's likely content, skip expensive AI intent detection
      const wordCount = cleanText.split(' ').length;
      if (wordCount > 10) {
           onCommand('text_input', cleanText);
           setStatus('standby');
           setFeedback("Saved.");
           return;
      }

      // Short text: could be a command
      try {
          const result = await detectIntent(cleanText, apiKey);
          if (result.confidence > 0.8 && result.intent !== 'text_input') {
              onCommand(result.intent as any);
              setFeedback(`Command: ${result.intent}`);
          } else {
              onCommand('text_input', cleanText);
              setFeedback("Saved.");
          }
      } catch (e) {
          // Fallback
          onCommand('text_input', cleanText);
      }
      
      if (isMountedRef.current) {
          setTimeout(() => {
             if (isMountedRef.current) setStatus('standby');
          }, 1500);
      }
  };

  useEffect(() => {
    isMountedRef.current = true;

    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      
      if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch(e) {}
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (statusRef.current === 'error' && isMountedRef.current) {
            setStatus('standby');
        }
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscriptChunk = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscriptChunk += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        const currentWakeWord = wakeWordRef.current.toLowerCase();
        const currentStopWord = stopWordRef.current.toLowerCase();
        
        // --- Standby Logic (Waiting for Wake Word) ---
        if (statusRef.current === 'standby') {
           const inputBuffer = (accumulatedTextRef.current + ' ' + finalTranscriptChunk + ' ' + interimTranscript).toLowerCase();
           
           // Simple check for wake word in the stream
           if (inputBuffer.includes(currentWakeWord)) {
               setStatus('listening');
               setFeedback(`Listening...`);
               setTranscript('');
               
               // Clear buffer so we don't save the wake word as text
               accumulatedTextRef.current = ''; 
               setAccumulatedText('');
           } else {
               // Keep a small buffer for wake word detection (prevent infinite memory growth in standby)
               if (finalTranscriptChunk) {
                    accumulatedTextRef.current = (accumulatedTextRef.current + ' ' + finalTranscriptChunk).slice(-100); 
               }
           }
        } 
        // --- Listening Logic ---
        else if (statusRef.current === 'listening') {
            
            // 1. Construct the Full Current Stream
            let fullStream = accumulatedTextRef.current;
            if (finalTranscriptChunk) fullStream += (fullStream ? ' ' : '') + finalTranscriptChunk;
            
            // Visual feedback uses the full stream + interim
            setAccumulatedText(fullStream);
            setTranscript(interimTranscript);

            const streamToCheck = (fullStream + ' ' + interimTranscript).trim();

            // 2. Check for Stop Word using Regex for Word Boundaries
            const stopRegex = new RegExp(`\\b${currentStopWord}\\b`, 'i');
            const match = streamToCheck.match(stopRegex);

            if (match && match.index !== undefined) {
                // STOP WORD DETECTED
                const validContent = streamToCheck.substring(0, match.index).trim();
                accumulatedTextRef.current = ''; 
                processResult(validContent);
                recognition.stop(); 
            } else {
                // No stop word yet, update the stable accumulator
                if (finalTranscriptChunk) {
                    // Remove wake word if it accidentally got in
                    const wakeRegex = new RegExp(`\\b${currentWakeWord}\\b`, 'gi');
                    const cleanChunk = finalTranscriptChunk.replace(wakeRegex, '').replace(/\s+/g, ' ').trim();
                    
                    if (cleanChunk) {
                        accumulatedTextRef.current = fullStream; 
                        setAccumulatedText(accumulatedTextRef.current);
                    }
                }
            }
        }
      };

      recognition.onend = () => {
        if (!isMountedRef.current) return;
        if (statusRef.current !== 'processing' && statusRef.current !== 'error') {
            setTimeout(() => {
                if (isMountedRef.current && recognitionRef.current) {
                    try { recognition.start(); } catch(e) {}
                }
            }, 300);
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
             if (isMountedRef.current) {
                 setStatus('error');
                 setFeedback("Microphone blocked");
             }
        }
      };

      try {
        recognition.start();
      } catch (e) {
         // ignore start errors
      }

    } else {
      setFeedback("Voice not supported");
      setStatus('error');
    }
    
    return () => {
        isMountedRef.current = false;
        if (recognitionRef.current) {
            recognitionRef.current.onend = null; 
            recognitionRef.current.onresult = null;
            recognitionRef.current.stop();
        }
    };
  }, []); 

  const handleManualActivation = () => {
      if (status !== 'listening' && status !== 'processing') {
          setStatus('listening');
          setFeedback(`Listening...`);
          setTranscript('');
          accumulatedTextRef.current = ''; 
          setAccumulatedText('');
      } else if (status === 'listening') {
          // Manual stop
          const content = accumulatedTextRef.current.trim();
          processResult(content);
      }
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center gap-2 w-[95%] md:w-full max-w-md pointer-events-none px-4">
      {/* Transcript Box */}
      {(transcript || accumulatedText) && status === 'listening' && (
        <div className="bg-black/80 backdrop-blur-xl text-white px-4 py-3 md:px-6 md:py-4 rounded-2xl text-base md:text-lg font-medium mb-2 shadow-2xl animate-float max-h-32 md:max-h-48 overflow-y-auto w-full text-center border border-white/10 pointer-events-auto transition-all duration-300">
          <span className="text-white/90">{accumulatedText}</span> 
          <span className="text-indigo-300 italic"> {transcript}</span>
        </div>
      )}
      
      {/* Main Button */}
      <div 
        onClick={handleManualActivation}
        className={`pointer-events-auto cursor-pointer flex items-center gap-3 bg-white/90 backdrop-blur-xl border border-white/50 shadow-2xl rounded-full p-2 pr-5 transition-all duration-500 hover:scale-105 active:scale-95 ${status === 'listening' ? 'ring-2 md:ring-4 ring-indigo-300 scale-105 shadow-indigo-200/50' : status === 'processing' ? 'ring-2 ring-purple-300' : ''}`}
      >
        <div
          className={`p-3 rounded-full transition-all duration-500 ${status === 'listening' ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-300' : status === 'processing' ? 'bg-purple-600 text-white animate-spin' : 'bg-indigo-600 text-white shadow-md'}`}
        >
          {status === 'listening' ? <Icons.Activity className="w-5 h-5" /> : status === 'processing' ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> : <Icons.Mic className="w-5 h-5" />}
        </div>
        
        <div className="flex flex-col min-w-0 text-left">
          <span className={`font-bold text-sm ${status === 'listening' ? 'text-indigo-600' : status === 'processing' ? 'text-purple-600' : 'text-stone-800'}`}>
              {status === 'listening' ? 'Listening...' : status === 'processing' ? 'Thinking...' : 'Voice Assistant'}
          </span>
          <span className="text-[10px] text-stone-500 font-medium truncate max-w-[120px] leading-tight">{feedback}</span>
        </div>
        
        {/* Visualizer bars */}
        {status === 'listening' && (
            <div className="flex gap-0.5 h-4 items-center ml-auto pl-2">
                <div className="w-1 bg-red-400 rounded-full animate-[pulse_0.4s_ease-in-out_infinite] h-2"></div>
                <div className="w-1 bg-red-500 rounded-full animate-[pulse_0.6s_ease-in-out_infinite] h-4"></div>
                <div className="w-1 bg-red-400 rounded-full animate-[pulse_0.5s_ease-in-out_infinite] h-2"></div>
            </div>
        )}
      </div>
    </div>
  );
};

export default VoiceCommandBar;