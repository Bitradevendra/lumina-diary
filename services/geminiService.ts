import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";
import { AIAnalysis } from "../types";

// Helper to get client with dynamic key
const getAiClient = (apiKey?: string) => {
  const key = apiKey || process.env.API_KEY;
  if (!key) {
    console.warn("Gemini API Key is missing. Features may not work.");
    // We return a dummy client or let it fail downstream, 
    // but better to throw here if we want strict handling.
    // For this app, we'll try to proceed to allow graceful failure in catch blocks.
  }
  return new GoogleGenAI({ apiKey: key || 'DUMMY_KEY' });
};

// Helper: Retry logic for API robustness
async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const isRetryable = error?.status === 429 || (error?.status && error?.status >= 500);
    if (retries > 0 && isRetryable) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

export const analyzeDiaryEntry = async (text: string, apiKey?: string): Promise<AIAnalysis> => {
  const ai = getAiClient(apiKey);
  const model = "gemini-3-flash-preview";
  
  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model,
      contents: `You are an empathetic, scientific, and psychologically grounded diary assistant. 
      Analyze the following diary entry. Provide a brief summary, psychological insight based on CBT principles, a sentiment score (0-100), actionable advice for the user, and keywords.
      
      Entry: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            psychologicalInsight: { type: Type.STRING },
            sentimentScore: { type: Type.NUMBER },
            actionableAdvice: { type: Type.STRING },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        }
      }
    }));

    if (response.text) {
      return JSON.parse(response.text) as AIAnalysis;
    }
    throw new Error("No response text from AI");
  } catch (error) {
    console.error("Analysis failed", error);
    return {
      summary: "Unable to generate analysis.",
      psychologicalInsight: "Please check your API Key settings or internet connection.",
      sentimentScore: 50,
      actionableAdvice: "Continue reflecting on your day.",
      keywords: []
    };
  }
};

export const summarizeVoiceToText = async (transcript: string, apiKey?: string): Promise<string> => {
  const ai = getAiClient(apiKey);
  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The following is a raw voice transcript for a diary entry. Please rewrite it into a coherent, well-structured diary entry, maintaining the original tone and meaning but fixing grammar and flow. Do not add any conversational filler.
      
      Transcript: "${transcript}"`
    }));
    return response.text || transcript;
  } catch (e) {
    console.error("Summarization failed", e);
    return transcript;
  }
};

export const generateSpeech = async (text: string, apiKey?: string): Promise<string | null> => {
  const ai = getAiClient(apiKey);
  try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    }));

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (e) {
    console.error("TTS failed", e);
    return null;
  }
};

export const detectIntent = async (command: string, apiKey?: string): Promise<{intent: 'save' | 'new_entry' | 'analyze' | 'text_input', confidence: number}> => {
   const ai = getAiClient(apiKey);
   try {
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Classify the intent of this voice input from a user in a diary app.
      
      Input: "${command}"
      
      Rules:
      - "save", "save entry", "save this" -> 'save'
      - "new entry", "start over", "create new" -> 'new_entry'
      - "analyze", "what do you think", "give me insights" -> 'analyze'
      - Anything else (describing a day, feelings, events) -> 'text_input'
      
      Return JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            intent: { type: Type.STRING, enum: ['save', 'new_entry', 'analyze', 'text_input'] },
            confidence: { type: Type.NUMBER }
          }
        }
      }
    }));
     if (response.text) return JSON.parse(response.text);
     return { intent: 'text_input', confidence: 0 };
   } catch(e) {
     return { intent: 'text_input', confidence: 0 };
   }
};