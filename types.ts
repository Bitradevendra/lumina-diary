export interface DiaryEntry {
  id: string;
  date: string; // ISO Date string YYYY-MM-DD
  content: string;
  title: string;
  mood: MoodType;
  media: DiaryMedia[]; // Replaces simple images array
  images?: string[]; // Deprecated, kept for migration
  tags: string[];
  aiAnalysis?: AIAnalysis;
  lastModified: number;
}

export interface DiaryMedia {
  id: string;
  type: 'image' | 'video';
  url: string; // Base64 data
  thumbnail?: string; // For videos
  timestamp: number;
}

export type MoodType = 'ecstatic' | 'happy' | 'neutral' | 'sad' | 'anxious' | 'angry' | 'tired';

export interface AIAnalysis {
  summary: string;
  psychologicalInsight: string;
  sentimentScore: number; // 0 to 100
  actionableAdvice: string;
  keywords: string[];
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasEntry: boolean;
  mood?: MoodType;
}

export interface Reminder {
  id: string;
  date: string; // ISO string
  message: string;
  createdAt: number;
}

export enum AppView {
  CALENDAR = 'CALENDAR',
  EDITOR = 'EDITOR',
  INSIGHTS = 'INSIGHTS'
}

export interface VoiceCommandState {
  isListening: boolean;
  lastTranscript: string;
  status: 'idle' | 'listening' | 'processing' | 'success';
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
}